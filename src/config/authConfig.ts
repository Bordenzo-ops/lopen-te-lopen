/**
 * authConfig
 *
 * Publieke configuratie voor de native "Doorgaan met Apple/Google"-knoppen
 * (Fase B van gebruikersauth). Deze client-ID's zijn NIET geheim: Google
 * markeert OAuth-client-ID's voor mobiele/web-clients zelf als publiek (ze
 * staan letterlijk in elke geinstalleerde APK/IPA en in elke browser-tab).
 * Ze mogen dus gewoon in de broncode staan en hoeven niet in .env.
 *
 * BELANGRIJK: de bijbehorende Google web-client-SECRET hoort hier NIET in
 * te staan. Die secret staat alleen in het Supabase-dashboard (Authentication
 * > Providers > Google), waar Supabase 'm gebruikt om de id_token van Google
 * te verifieren. De app zelf heeft nooit een secret nodig.
 *
 * Zie ook: docs/SUPABASE_SETUP.md voor de volledige Supabase-auth-opzet.
 */

/**
 * Web-client-ID (type "Web application" in Google Cloud Console). Wordt
 * gebruikt als `webClientId` bij GoogleSignin.configure zodat de teruggegeven
 * idToken geverifieerd kan worden door Supabase (die verwacht de audience
 * van de web-client).
 */
export const GOOGLE_WEB_CLIENT_ID =
  '886963433887-gutduc0dnf8mdevqc32bh33t8e3fbdhm.apps.googleusercontent.com';

/**
 * iOS-client-ID (type "iOS" in Google Cloud Console), gekoppeld aan de
 * bundle-identifier com.lopentelopen.app. Wordt gebruikt als `iosClientId`
 * bij GoogleSignin.configure. Het bijbehorende reversed-client-ID-schema
 * staat in app.json bij de google-signin-plugin (iosUrlScheme).
 */
export const GOOGLE_IOS_CLIENT_ID =
  '886963433887-ajddhje7rnv8ohsb18pk9tusuuk5o9hm.apps.googleusercontent.com';
