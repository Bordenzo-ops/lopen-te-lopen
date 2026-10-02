import { Platform } from 'react-native';

/**
 * Juridische links, op één plek.
 *
 * Deze URL's wezen eerder naar `lopentelopen.nl`. Dat domein lag in augustus 2026
 * plat en kostte een afwijzing bij Apple: een onbereikbaar privacybeleid is een
 * blokkade. Een veld in de winkel pas je in minuten aan, maar een link ín de app
 * vereist een nieuwe build én een nieuwe beoordeling — precies wanneer je die tijd
 * niet hebt.
 *
 * De spiegel wordt door GitHub geserveerd en hangt niet aan één hoster. Beide
 * pagina's staan als bron op branch `master` en worden naar branch `main`
 * gekopieerd, die GitHub Pages voedt.
 *
 * Ze stonden als losse string in zowel paywall.tsx als settings.tsx, en liepen
 * daardoor uiteen: de paywall kreeg de spiegel, het instellingenscherm bleef naar
 * het eigen domein wijzen. Voeg hier toe, importeer overal — plak nooit opnieuw
 * een letterlijke URL in een scherm.
 */
const LEGAL_BASE = 'https://bordenzo-ops.github.io/lopen-te-lopen';

/** Privacybeleid, gelijk op beide platforms. */
export const PRIVACY_URL = `${LEGAL_BASE}/privacy-policy.html`;

/** Gebruiksvoorwaarden: op iOS de standaard Apple EULA, op Android onze eigen pagina. */
export const TERMS_URL = Platform.OS === 'ios'
  ? 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/'
  : `${LEGAL_BASE}/voorwaarden.html`;
