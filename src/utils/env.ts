/**
 * envUtils
 *
 * Kleine, gedeelde hulpfuncties voor het uitlezen van omgevingsvariabelen
 * (EXPO_PUBLIC_*). Supabase-, RevenueCat- en ElevenLabs-configuratie hadden
 * hier eerder elk hun eigen (bijna identieke) kopie van; nu op één plek.
 */

/**
 * Haalt een omgevingsvariabele veilig op als string.
 *
 * Een niet-geexpandeerde placeholder (bijvoorbeeld de letterlijke string
 * "$EXPO_PUBLIC_SUPABASE_ANON_KEY" door een kapotte eas.json-configuratie)
 * begint met "$" en wordt behandeld als lege string, in plaats van als
 * geldige sleutel of URL te worden gebruikt.
 */
export function sanitizeEnvValue(raw: string | undefined): string {
  const value = raw ?? '';
  if (value.startsWith('$')) return '';
  return value;
}

/**
 * Is deze string een minimaal geldige https-URL? Gebruikt om te voorkomen
 * dat een lege of kapotte waarde (of een niet-geexpandeerde placeholder die
 * toevallig niet met "$" begint) als geldige Supabase-URL wordt aangezien.
 */
export function isHttpsUrl(value: string): boolean {
  return value.startsWith('https://');
}
