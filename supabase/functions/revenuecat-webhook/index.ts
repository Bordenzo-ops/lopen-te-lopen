/**
 * Supabase Edge Function: revenuecat-webhook
 *
 * Ontvangt de webhooks van RevenueCat en houdt per Supabase-gebruiker de tabel
 * `entitlements` bij (zie supabase/migrations/0007_entitlements.sql). Daarmee
 * is premium server-side te controleren, bijvoorbeeld door de functie `tts`.
 * Een databasetrigger zet daarna profiles.is_premium.
 *
 * Beveiliging:
 *  - De Authorization-header van het verzoek moet overeenkomen met het geheim
 *    REVENUECAT_WEBHOOK_AUTH (constant-time vergelijking). Zowel de kale
 *    waarde als "Bearer <waarde>" wordt geaccepteerd. Anders: 401.
 *  - Deze functie draait met --no-verify-jwt: RevenueCat stuurt geen Supabase-JWT.
 *  - De service role key verlaat de server nooit.
 *
 * Verwerking:
 *  - Elk event wordt eerst ruw opgeslagen in `revenuecat_events` (id = RevenueCat
 *    event-id, zonder subscriber_attributes). Een herhaald, al verwerkt event
 *    levert 200 op zonder opnieuw te verwerken (idempotent).
 *  - Gebruiker: app_user_id, anders original_app_user_id, anders de aliassen.
 *    Alleen uuid-vormige ids die in auth.users bestaan tellen.
 *  - is_active = entitlement `premium` hoort bij het event en de
 *    verloopdatum ligt in de toekomst. EXPIRATION zet altijd op false.
 *    CANCELLATION, BILLING_ISSUE en SUBSCRIPTION_PAUSED trekken de toegang niet
 *    in: die loopt door tot de verloopdatum (bij BILLING_ISSUE tot het einde
 *    van de grace period), conform de RevenueCat-documentatie.
 *  - TRANSFER: de bron-gebruikers worden op inactief gezet. De bestemming
 *    krijgt alleen een entitlement als het geheim REVENUECAT_API_KEY (secret
 *    API key v1) gezet is; anders volgt dat bij het eerstvolgende event.
 *  - Events die door een nieuwer event zijn ingehaald (event_timestamp_ms)
 *    worden genegeerd door public.apply_entitlement_event.
 *  - Er worden geen persoonsgegevens gelogd, alleen event-id, type en uitkomst.
 *
 * Deploy:
 *   npx supabase functions deploy revenuecat-webhook --project-ref zefiknynxppgbhiiunre --no-verify-jwt
 *   npx supabase secrets set REVENUECAT_WEBHOOK_AUTH=... --project-ref zefiknynxppgbhiiunre
 *   Optioneel (TRANSFER-bestemming): REVENUECAT_API_KEY=sk_...
 *
 * Antwoord:
 *   200 { ok: true, ... }   verwerkt, genegeerd of al eerder verwerkt
 *   400                     geen geldig RevenueCat-event
 *   401                     ontbrekende of foute Authorization-header
 *   405                     verkeerde methode
 *   500                     tijdelijke fout; RevenueCat probeert het opnieuw
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const WEBHOOK_AUTH = Deno.env.get('REVENUECAT_WEBHOOK_AUTH') ?? '';
const REVENUECAT_API_KEY = Deno.env.get('REVENUECAT_API_KEY') ?? '';

// Identifier van het entitlement in RevenueCat (docs/REVENUECAT_SETUP.md).
const PREMIUM_ENTITLEMENT_ID = 'premium';

const HANDLED_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'CANCELLATION',
  'UNCANCELLATION',
  'EXPIRATION',
  'BILLING_ISSUE',
  'SUBSCRIPTION_PAUSED',
  'TRANSFER',
  'TEST',
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ID_CANDIDATES = 10;

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function respond(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

/** Constant-time vergelijking: vergelijkt SHA-256-digests zodat lengte niets verraadt. */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const va = new Uint8Array(da);
  const vb = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

async function isAuthorized(req: Request): Promise<boolean> {
  if (!WEBHOOK_AUTH) return false; // zonder geheim blijft de functie dicht
  const header = (req.headers.get('authorization') ?? '').trim();
  const value = header.replace(/^Bearer\s+/i, '');
  return await safeEqual(value, WEBHOOK_AUTH);
}

// deno-lint-ignore no-explicit-any
type RcEvent = Record<string, any>;

function toIso(ms: unknown): string | null {
  return typeof ms === 'number' && Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function uuidCandidates(ev: RcEvent, primary: unknown[]): string[] {
  const all = [...primary, ...(Array.isArray(ev.aliases) ? ev.aliases : [])];
  const seen = new Set<string>();
  for (const id of all) {
    if (typeof id === 'string' && UUID_RE.test(id)) seen.add(id.toLowerCase());
    if (seen.size >= MAX_ID_CANDIDATES) break;
  }
  return [...seen];
}

// deno-lint-ignore no-explicit-any
async function findUserId(supabase: any, candidates: string[]): Promise<string | null> {
  for (const id of candidates) {
    const { data, error } = await supabase.auth.admin.getUserById(id);
    if (!error && data?.user?.id) return data.user.id as string;
  }
  return null;
}

// deno-lint-ignore no-explicit-any
async function applyEvent(supabase: any, userId: string, args: {
  isActive: boolean;
  productId: string | null;
  store: string | null;
  periodType: string | null;
  environment: string | null;
  expiresAt: string | null;
  eventType: string;
  eventAt: string;
}): Promise<boolean> {
  const { data, error } = await supabase.rpc('apply_entitlement_event', {
    p_user: userId,
    p_is_active: args.isActive,
    p_product_id: args.productId,
    p_store: args.store,
    p_period_type: args.periodType,
    p_environment: args.environment,
    p_expires_at: args.expiresAt,
    p_event_type: args.eventType,
    p_event_at: args.eventAt,
  });
  if (error) throw new Error(`apply_entitlement_event: ${error.code ?? 'fout'}`);
  return data === true;
}

/** Haalt de actuele premium-status van een TRANSFER-bestemming op (optioneel). */
async function fetchSubscriberPremium(appUserId: string): Promise<{
  isActive: boolean; productId: string | null; expiresAt: string | null;
} | null> {
  if (!REVENUECAT_API_KEY) return null;
  const res = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    { headers: { Authorization: `Bearer ${REVENUECAT_API_KEY}` } },
  );
  if (!res.ok) throw new Error(`revenuecat api ${res.status}`);
  const json = await res.json();
  const ent = json?.subscriber?.entitlements?.[PREMIUM_ENTITLEMENT_ID];
  if (!ent) return { isActive: false, productId: null, expiresAt: null };
  const expires = typeof ent.expires_date === 'string' ? Date.parse(ent.expires_date) : NaN;
  // Geen expires_date betekent een levenslang entitlement.
  const isActive = Number.isNaN(expires) ? true : expires > Date.now();
  return {
    isActive,
    productId: typeof ent.product_identifier === 'string' ? ent.product_identifier : null,
    expiresAt: Number.isNaN(expires) ? null : new Date(expires).toISOString(),
  };
}

async function processTransfer(
  // deno-lint-ignore no-explicit-any
  supabase: any, ev: RcEvent, eventAt: string,
): Promise<string> {
  const from: unknown[] = Array.isArray(ev.transferred_from) ? ev.transferred_from : [];
  const to: unknown[] = Array.isArray(ev.transferred_to) ? ev.transferred_to : [];
  const environment = typeof ev.environment === 'string' ? ev.environment : null;
  let touched = 0;

  for (const id of uuidCandidates({}, from)) {
    const userId = await findUserId(supabase, [id]);
    if (!userId) continue;
    await applyEvent(supabase, userId, {
      isActive: false, productId: null, store: null, periodType: null,
      environment, expiresAt: null, eventType: 'TRANSFER', eventAt,
    });
    touched++;
  }

  for (const id of uuidCandidates({}, to)) {
    const userId = await findUserId(supabase, [id]);
    if (!userId) continue;
    const status = await fetchSubscriberPremium(id);
    if (!status) continue; // geen API-sleutel: volgt bij het volgende event
    await applyEvent(supabase, userId, {
      isActive: status.isActive,
      productId: status.productId,
      store: typeof ev.store === 'string' ? ev.store : null,
      periodType: null,
      environment,
      expiresAt: status.expiresAt,
      eventType: 'TRANSFER',
      eventAt,
    });
    touched++;
  }
  return touched > 0 ? 'transfer_applied' : 'transfer_no_users';
}

async function processEvent(
  // deno-lint-ignore no-explicit-any
  supabase: any, ev: RcEvent,
): Promise<string> {
  const type: string = ev.type;
  if (type === 'TEST') return 'test';
  if (!HANDLED_TYPES.has(type)) return 'ignored_type';

  const eventAt = toIso(ev.event_timestamp_ms) ?? new Date().toISOString();

  if (type === 'TRANSFER') return await processTransfer(supabase, ev, eventAt);

  // Andere entitlements dan `premium` negeren we; ontbreekt de lijst, dan gaan
  // we uit van het enige entitlement van deze app.
  const ids: unknown[] = Array.isArray(ev.entitlement_ids)
    ? ev.entitlement_ids
    : (typeof ev.entitlement_id === 'string' ? [ev.entitlement_id] : []);
  if (ids.length > 0 && !ids.includes(PREMIUM_ENTITLEMENT_ID)) return 'other_entitlement';

  const userId = await findUserId(
    supabase,
    uuidCandidates(ev, [ev.app_user_id, ev.original_app_user_id]),
  );
  if (!userId) return 'no_user';

  const now = Date.now();
  const expirationMs = typeof ev.expiration_at_ms === 'number' ? ev.expiration_at_ms : null;
  const graceMs = type === 'BILLING_ISSUE' && typeof ev.grace_period_expiration_at_ms === 'number'
    ? ev.grace_period_expiration_at_ms
    : null;
  const effectiveExpiryMs = Math.max(expirationMs ?? 0, graceMs ?? 0) || null;

  const isActive = type === 'EXPIRATION'
    ? false
    : effectiveExpiryMs !== null && effectiveExpiryMs > now;

  const applied = await applyEvent(supabase, userId, {
    isActive,
    productId: typeof ev.product_id === 'string' ? ev.product_id : null,
    store: typeof ev.store === 'string' ? ev.store : null,
    periodType: typeof ev.period_type === 'string' ? ev.period_type : null,
    environment: typeof ev.environment === 'string' ? ev.environment : null,
    expiresAt: toIso(effectiveExpiryMs),
    eventType: type,
    eventAt,
  });
  return applied ? (isActive ? 'active' : 'inactive') : 'stale';
}

serve(async (req: Request) => {
  if (req.method !== 'POST') return respond(405, { error: 'Method not allowed' });
  if (!(await isAuthorized(req))) return respond(401, { error: 'Niet geautoriseerd.' });

  // deno-lint-ignore no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return respond(400, { error: 'Ongeldige JSON.' });
  }
  const ev: RcEvent | undefined = body?.event;
  if (!ev || typeof ev.id !== 'string' || typeof ev.type !== 'string') {
    return respond(400, { error: 'Geen RevenueCat-event.' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // 1. Ruw opslaan (zonder subscriber_attributes: kan e-mail of naam bevatten).
    // deno-lint-ignore no-unused-vars
    const { subscriber_attributes, ...payload } = ev;
    const { error: insertError } = await supabase
      .from('revenuecat_events')
      .insert({ id: ev.id, event_type: ev.type, payload });

    if (insertError) {
      if (insertError.code !== '23505') throw new Error(`insert: ${insertError.code ?? 'fout'}`);
      // Bekend event: al verwerkt? Dan klaar. Anders (eerdere poging mislukt) opnieuw.
      const { data: existing } = await supabase
        .from('revenuecat_events')
        .select('processed_at')
        .eq('id', ev.id)
        .maybeSingle();
      if (existing?.processed_at) {
        console.log(`revenuecat-webhook ${ev.id} ${ev.type} duplicate`);
        return respond(200, { ok: true, result: 'duplicate' });
      }
    }

    // 2. Verwerken.
    const result = await processEvent(supabase, ev);

    // 3. Als verwerkt markeren.
    const { error: markError } = await supabase
      .from('revenuecat_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('id', ev.id);
    if (markError) throw new Error(`mark: ${markError.code ?? 'fout'}`);

    console.log(`revenuecat-webhook ${ev.id} ${ev.type} ${result}`);
    return respond(200, { ok: true, result });
  } catch (e) {
    // Alleen foutmelding zonder gebruikersdata; RevenueCat probeert opnieuw.
    console.error(`revenuecat-webhook ${ev.id} ${ev.type} fout: ${(e as Error).message}`);
    return respond(500, { error: 'Verwerken mislukt.' });
  }
});
