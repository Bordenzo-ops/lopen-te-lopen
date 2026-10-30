/**
 * Display formatting for numbers shown to the user.
 *
 * The app is Dutch, so decimals use a comma on screen ("12,5"). Do not use this
 * for values that are stored, sent to an API or passed to text-to-speech.
 */

/**
 * Formats a distance in km without its unit: formatKm(12.5) gives "12,5".
 * With `decimals` the number of decimals is fixed: formatKm(8, 1) gives "8,0".
 */
export function formatKm(km: number, decimals?: number): string {
  const text = decimals === undefined ? String(km) : km.toFixed(decimals);
  return text.replace('.', ',');
}
