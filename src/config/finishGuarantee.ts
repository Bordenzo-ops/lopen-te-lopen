/**
 * finishGuarantee
 *
 * Eén garantieregel voor op de paywall (app/paywall.tsx), met een link naar
 * de voorwaarden (FINISH_GUARANTEE_TERMS_URL in legalLinks.ts). Zolang
 * FINISH_GUARANTEE_TEXT leeg is, toont de paywall niets.
 *
 * Activeren pas nadat de voorwaardenparagraaf juridisch is getoetst en op
 * voorwaarden.html#finish-garantie staat (alle drie de plekken). Het volledige
 * draaiboek staat in docs/FINISH_GARANTIE.md.
 *
 * Tekst om dan in te vullen:
 *   'Haal je je wedstrijd niet? Dan krijg je een jaar Premium cadeau.'
 */

export const FINISH_GUARANTEE_TEXT = '';

/** Linktekst onder de garantieregel; alleen zichtbaar als de regel zelf getoond wordt. */
export const FINISH_GUARANTEE_LINK_LABEL = 'Bekijk de voorwaarden';
