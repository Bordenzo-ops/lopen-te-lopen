/**
 * analyticsService
 *
 * Lichte, offline-first productanalytics voor de funnel-metingen (WP2).
 * Geen extern SDK: events gaan naar onze eigen `events`-tabel in Supabase
 * (zie supabase/migrations/0003_events.sql). De omzetkant dekt RevenueCat al.
 *
 * Filosofie, gelijk aan syncService:
 *  - Best-effort: trackEvent en flush gooien nooit en blokkeren de UI nooit.
 *  - Offline-first: events worden lokaal in AsyncStorage gebufferd en later
 *    gebatcht verstuurd zodra er een Supabase-sessie en netwerk zijn.
 *  - Privacyvriendelijk: alleen een gebeurtenisnaam plus een kleine, generieke
 *    props-payload. NOOIT naam, locatie of andere persoonsgegevens meesturen.
 *  - Zonder sleutels/sessie/netwerk gebeurt er niets en crasht er niets.
 *
 * Idempotent: elk event krijgt een stabiele clientEventId, zodat een
 * opnieuw verzonden batch (na een mislukte flush) via upsert geen duplicaten
 * maakt (unique op user_id + client_event_id in de DB).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { getSupabase } from './supabaseClient';
import { getCurrentUser } from './authService';

/**
 * De vaste set gebeurtenisnamen. Als union getypt zodat aanroepers geen
 * losse strings kunnen doorgeven en de funnel-views in de migratie op
 * dezelfde namen kunnen rekenen.
 */
export type AnalyticsEvent =
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'race_goal_chosen'
  | 'paywall_shown'
  | 'paywall_plan_tapped'
  | 'trial_started'
  | 'purchase_completed'
  | 'run_started'
  | 'run_completed'
  | 'run_card_shared'
  | 'premium_intro_shown'
  | 'premium_intro_cta';

/** Kleine, generieke eigenschappen bij een event. Geen persoonsgegevens. */
export type AnalyticsProps = Record<string, string | number | boolean | null>;

interface QueuedEvent {
  clientEventId: string;
  name: AnalyticsEvent;
  props: AnalyticsProps;
  occurredAt: string; // ISO-tijd op het moment van het event
}

const QUEUE_KEY = 'analytics_queue_v1';
/** Bovengrens op de wachtrij: bij lang offline gebruik gooien we de oudste weg. */
const MAX_QUEUE = 500;
/** Aantal events per insert-batch naar Supabase. */
const FLUSH_BATCH = 100;

/** Voorkomt dat twee flushes tegelijk lopen (dubbele inserts / races). */
let flushing = false;

/** Genereer een stabiele, unieke id voor één event. */
function newClientEventId(): string {
  try {
    if (typeof Crypto.randomUUID === 'function') return Crypto.randomUUID();
  } catch {
    // val terug op de simpele variant hieronder
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function readQueue(): Promise<QueuedEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedEvent[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedEvent[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Stil falen: kan de wachtrij niet bewaren, dan gaat dit event verloren.
    // Analytics mag nooit de app raken.
  }
}

/**
 * Leg een event vast. Voegt het toe aan de lokale wachtrij en probeert daarna
 * best-effort te flushen. Veilig om overal aan te roepen: gooit nooit.
 */
export async function trackEvent(name: AnalyticsEvent, props: AnalyticsProps = {}): Promise<void> {
  try {
    const event: QueuedEvent = {
      clientEventId: newClientEventId(),
      name,
      props: props ?? {},
      occurredAt: new Date().toISOString(),
    };
    const queue = await readQueue();
    queue.push(event);
    // Houd de wachtrij begrensd: bewaar de nieuwste MAX_QUEUE events.
    const trimmed = queue.length > MAX_QUEUE ? queue.slice(queue.length - MAX_QUEUE) : queue;
    await writeQueue(trimmed);
  } catch {
    // Nooit laten crashen op het vastleggen van een event.
    return;
  }
  // Fire-and-forget: probeer meteen te versturen, maar wacht er niet op.
  void flushEvents();
}

/**
 * Verstuur de gebufferde events gebatcht naar Supabase. Best-effort:
 * zonder sleutels, sessie of netwerk gebeurt er niets en blijft de wachtrij
 * staan voor een latere poging. Idempotent via upsert op (user_id,
 * client_event_id).
 */
export async function flushEvents(): Promise<void> {
  if (flushing) return;
  const supabase = getSupabase();
  if (!supabase) return;

  flushing = true;
  try {
    const user = await getCurrentUser();
    // Zonder (anonieme) sessie kunnen we user_id niet zetten en zou RLS de
    // insert weigeren. Laat de events dan in de wachtrij staan.
    if (!user) return;

    let queue = await readQueue();
    while (queue.length > 0) {
      const batch = queue.slice(0, FLUSH_BATCH);
      const rows = batch.map(e => ({
        user_id: user.id,
        client_event_id: e.clientEventId,
        event_name: e.name,
        props: e.props,
        occurred_at: e.occurredAt,
      }));

      const { error } = await supabase
        .from('events')
        .upsert(rows, { onConflict: 'user_id,client_event_id' });

      // Bij een fout (netwerk, RLS, tijdelijke storing) stoppen we en laten
      // de resterende wachtrij intact voor de volgende flush.
      if (error) break;

      queue = queue.slice(batch.length);
      await writeQueue(queue);
    }
  } catch {
    // Stil falen: analytics mag de app nooit raken.
  } finally {
    flushing = false;
  }
}
