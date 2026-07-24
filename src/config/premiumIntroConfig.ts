/**
 * premiumIntroConfig
 *
 * Alle copy en instellingen voor het premium value-scherm
 * (app/premium-intro.tsx), centraal op één plek zodat de tekst en de
 * frequentie-logica makkelijk aan te passen zijn zonder het scherm zelf aan
 * te hoeven passen.
 *
 * De Rotterdam-marathondatum in de subkop hieronder is bevestigd op zondag
 * 11 april 2027. Werk deze bij zodra de campagne naar een volgende race gaat.
 *
 * De prijzen in de copy zijn campagne-tekst; de echte store-prijzen komen uit
 * de paywall zelf (zie app/paywall.tsx). Niet dynamisch maken.
 */

// ── Copy ───────────────────────────────────────────────────────────────────

export const PREMIUM_INTRO_CAMPAIGN_LABEL = 'ROAD TO ROTTERDAM';

export const PREMIUM_INTRO_TITLE = 'Jij over de finish op de Coolsingel.';

export const PREMIUM_INTRO_SUBTITLE =
  '11 april 2027 — het complete marathonprogramma dat je erheen brengt.';

/** Icoon-key per voordeel-tegel; wordt in het scherm gemapt naar de lucide-component. */
export type PremiumIntroIcon = 'target' | 'headphones' | 'map' | 'trending-up';

export interface PremiumIntroBenefit {
  icon: PremiumIntroIcon;
  title: string;
  text: string;
}

export const PREMIUM_INTRO_BENEFITS: PremiumIntroBenefit[] = [
  {
    icon: 'target',
    title: 'Schema op jóuw doeltijd',
    text: 'Elke training op het tempo dat jóu naar de finish brengt.',
  },
  {
    icon: 'headphones',
    title: 'Roos coacht elke run',
    text: 'Een warme Nederlandse stem die je er stap voor stap doorheen praat.',
  },
  {
    icon: 'map',
    title: 'Onbeperkt routes plannen',
    text: 'Zoveel routes als je wilt, waar je ook loopt.',
  },
  {
    icon: 'trending-up',
    title: 'Wekelijkse voortgang',
    text: 'Zie elke week dat de finish dichterbij komt.',
  },
];

export const PREMIUM_INTRO_GUARANTEE_TITLE = 'Finish-garantie';

export const PREMIUM_INTRO_GUARANTEE_TEXT =
  'Volg het schema en haal je de finish niet? Je volgende jaar is gratis.';

export const PREMIUM_INTRO_PRICE_LINE = '14 dagen gratis, daarna €49 per jaar';

export const PREMIUM_INTRO_PRICE_SUBLINE =
  'Dat is €4,08 per maand — minder dan één paar sokken.';

export const PREMIUM_INTRO_CTA_PRIMARY = 'Probeer 14 dagen gratis';

export const PREMIUM_INTRO_CTA_SECONDARY = 'Misschien later';

export const PREMIUM_INTRO_CTA_DISMISS = 'Niet meer tonen';

// ── Frequentie / eligibility ───────────────────────────────────────────────

/** Hooguit dit aantal keer tonen aan dezelfde gebruiker. */
export const PREMIUM_INTRO_MAX_SHOWS = 3;

/** Minimale tijd tussen twee vertoningen. */
export const PREMIUM_INTRO_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Bepaalt of het premium value-scherm getoond mag worden. Puur, geen
 * afhankelijkheid van de store of de klok: alle input komt van de aanroeper
 * (zie useMaybeShowPremiumIntro), zodat dit makkelijk te testen en te
 * hergebruiken is.
 */
export function canShowPremiumIntro(p: {
  /** Heeft de gebruiker al premium-toegang (echte premium óf paywall uit)? */
  hasAccess: boolean;
  dismissed: boolean;
  shownCount: number;
  lastShownAt: number | null;
  now: number;
}): boolean {
  if (p.hasAccess) return false;
  if (p.dismissed) return false;
  if (p.shownCount >= PREMIUM_INTRO_MAX_SHOWS) return false;
  if (p.lastShownAt != null && p.now - p.lastShownAt < PREMIUM_INTRO_COOLDOWN_MS) return false;
  return true;
}
