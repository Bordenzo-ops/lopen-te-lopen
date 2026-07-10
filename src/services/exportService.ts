/**
 * exportService
 *
 * Exporteert een voltooide run als GPX-bestand (GPX 1.1), zodat de gebruiker
 * zijn training kan importeren in Garmin Connect of een andere hardloop-app
 * die GPX ondersteunt. De route komt uit CompletedSession.route (lat/lon/
 * timestamp per punt). Hartslag wordt bewust niet meegenomen: er is alleen
 * een gemiddelde over de hele run beschikbaar, geen waarde per punt, en dat
 * hoort niet thuis in een GPX-trackpunt.
 *
 * Vereist: expo-file-system (nieuwe File/Directory/Paths-API, SDK 56) en
 * expo-sharing, allebei al aanwezig in dit project.
 */

// @ts-ignore: al geinstalleerd, zelfde importpatroon als voiceService.ts
import { File, Directory, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { CompletedSession } from '../store/appStore';

// ── XML-helpers ───────────────────────────────────────────────────────────────

/** Escaped de vijf XML-speciale tekens, zodat willekeurige tekst veilig in GPX past */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Nederlandse datumnotatie voor de tracknaam, bijv. "1 juli 2026" */
function formatTrackDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Bestandsnaam-veilige datum, bijv. "2026-07-01" */
function formatFileDate(iso: string): string {
  return new Date(iso).toISOString().split('T')[0];
}

// ── GPX-generatie ─────────────────────────────────────────────────────────────

/**
 * Bouwt een geldige GPX 1.1-string uit een voltooide sessie.
 * Bevat: <metadata> met naam + tijdstip, één <trk> met Nederlandse naam en
 * één <trkseg> met alle routepunten (lat/lon + ISO-tijd per punt).
 *
 * Geeft null terug als de sessie geen (bruikbare) route heeft.
 */
export function generateGpx(session: CompletedSession): string | null {
  const route = session.route;
  if (!route || route.length === 0) return null;

  const trackName = escapeXml(`Training ${formatTrackDate(session.completedAt)}`);
  const metadataTime = escapeXml(new Date(session.completedAt).toISOString());

  const trkpts = route
    .map(point => {
      const time = escapeXml(new Date(point.timestamp).toISOString());
      return `      <trkpt lat="${point.lat}" lon="${point.lon}">\n        <time>${time}</time>\n      </trkpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Lopen te Lopen" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>Lopen te Lopen</name>
    <time>${metadataTime}</time>
  </metadata>
  <trk>
    <name>${trackName}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`;
}

// ── Bestand schrijven en delen ────────────────────────────────────────────────

export interface ExportGpxResult {
  success: boolean;
  error?: 'geen_route' | 'delen_niet_beschikbaar' | 'onbekende_fout';
}

/**
 * Genereert de GPX voor deze sessie, schrijft het bestand naar de
 * cache-directory en opent het native deelvenster (bijv. om naar Garmin
 * Connect, Strava of een bestandsapp te sturen).
 */
export async function exportSessionAsGpx(session: CompletedSession): Promise<ExportGpxResult> {
  try {
    const gpx = generateGpx(session);
    if (!gpx) {
      return { success: false, error: 'geen_route' };
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      return { success: false, error: 'delen_niet_beschikbaar' };
    }

    const fileName = `lopen-te-lopen-${formatFileDate(session.completedAt)}.gpx`;
    const dir = new Directory(Paths.cache);
    const file = new File(dir, fileName);

    // Bestaat er al een export met dezelfde naam (bijv. tweede export op
    // dezelfde dag)? Overschrijf die dan gewoon.
    if (file.exists) {
      file.delete();
    }
    file.write(gpx);

    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/gpx+xml',
      dialogTitle: 'Exporteer training als GPX',
      UTI: 'public.xml',
    });

    return { success: true };
  } catch (err) {
    console.error('[exportService] exportSessionAsGpx:', err);
    return { success: false, error: 'onbekende_fout' };
  }
}
