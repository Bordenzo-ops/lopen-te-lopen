/**
 * ShareRunCard
 *
 * Deelbare 9:16 social-kaart (Instagram Stories-formaat) voor één voltooide
 * hardloopsessie. Zusje van SharePeriodCard, die hetzelfde doet voor een hele
 * week, maand of jaar; beide delen hun bouwstenen via shareCardParts.
 *
 * De kaart is bewust ook een advertentie: wie de post van een ander ziet, moet
 * meteen zien wélke app dit is. Vandaar de merkbalk boven (app-icoon + naam)
 * en onder (naam + handle), en het artwork uit assets/brand/.
 *
 * Waar de periodekaart de schoen als held heeft, is dat hier het routetracé.
 * Daarom de rustige topografieplaat als achtergrond in plaats van de heldplaat:
 * de contourlijnen laten de route staan, en de oranje sweep van de plaat komt
 * onder de statistiek uit waar het verloop opengaat.
 *
 * Ontwerpreferentie op ware grootte: scripts/brand-assets/card-run-story.html
 * (1080x1920 = exact 3x deze kaart). Vermenigvuldig de waarden hier met 3 om
 * de twee naast elkaar te leggen.
 *
 * Gebruik:
 *   const cardRef = useRef<View>(null);
 *   <ShareRunCard ref={cardRef} session={completed} weekNumber={4} runnerName="Lars" />
 *   // daarna: captureAndShare(cardRef)
 */

import React, { forwardRef } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { palette, typography, radius, spacing } from '../../theme/tokens';
import type { CompletedSession } from '../../store/appStore';
import {
  ArtScrim,
  ART_TEXTURE,
  BrandFooter,
  CARD_HEIGHT,
  CARD_WIDTH,
  Hairline,
  NO_FONT_PADDING,
  PAD_H,
  StatCell,
  TopBar,
  formatDuration,
  formatPace,
  styles as shared,
} from './shareCardParts';

// ── Routetracé ──────────────────────────────────────────────────────────────
// Iets breder dan de tekstkolom, zodat de route niet in dezelfde marge staat
// als de cijfers en meer als beeld leest dan als inhoud.
const ROUTE_BLEED = 4;
const ROUTE_W = CARD_WIDTH - PAD_H * 2 + ROUTE_BLEED * 2;
const ROUTE_H = 154;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Vertaal GPS-coördinaten naar SVG-punten binnen een bounding box */
function routeToSvgPath(
  route: Array<{ lat: number; lon: number }>,
  width: number,
  height: number,
  padding = 20,
): string {
  if (route.length < 2) return '';

  const lats = route.map(p => p.lat);
  const lons = route.map(p => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const rangeX = maxLon - minLon || 0.001;
  const rangeY = maxLat - minLat || 0.001;

  // Behoud aspect ratio
  const drawW = width  - padding * 2;
  const drawH = height - padding * 2;
  const scale = Math.min(drawW / rangeX, drawH / rangeY);

  // Centreer
  const offsetX = padding + (drawW - rangeX * scale) / 2;
  const offsetY = padding + (drawH - rangeY * scale) / 2;

  const points = route.map(p => {
    const x = offsetX + (p.lon - minLon) * scale;
    // Lat neemt af naar beneden in SVG-ruimte, dus inverteren
    const y = offsetY + (maxLat - p.lat) * scale;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return `M ${points.join(' L ')}`;
}

/** Gestileerde lus als er geen GPS-data is (bijvoorbeeld een run op de band) */
function demoRoutePath(w: number, h: number): string {
  return [
    `M ${w * 0.12},${h * 0.65}`,
    `C ${w * 0.18},${h * 0.24} ${w * 0.35},${h * 0.10} ${w * 0.50},${h * 0.16}`,
    `C ${w * 0.65},${h * 0.23} ${w * 0.78},${h * 0.42} ${w * 0.86},${h * 0.58}`,
    `C ${w * 0.92},${h * 0.71} ${w * 0.87},${h * 0.85} ${w * 0.74},${h * 0.84}`,
    `C ${w * 0.59},${h * 0.83} ${w * 0.39},${h * 0.76} ${w * 0.28},${h * 0.72}`,
    `C ${w * 0.19},${h * 0.68} ${w * 0.12},${h * 0.65} ${w * 0.12},${h * 0.65}`,
  ].join(' ');
}

/** Kleur op basis van hartslagzone */
function zoneColor(avgHr?: number, maxHr = 190): string {
  if (!avgHr) return palette.zone.z2;
  const pct = avgHr / maxHr;
  if (pct < 0.60) return palette.zone.z1;
  if (pct < 0.70) return palette.zone.z2;
  if (pct < 0.80) return palette.zone.z3;
  if (pct < 0.90) return palette.zone.z4;
  return palette.zone.z5;
}

function zoneLabel(avgHr?: number, maxHr = 190): string {
  if (!avgHr) return 'Zone 2';
  const pct = avgHr / maxHr;
  if (pct < 0.60) return 'Zone 1';
  if (pct < 0.70) return 'Zone 2';
  if (pct < 0.80) return 'Zone 3';
  if (pct < 0.90) return 'Zone 4';
  return 'Zone 5';
}

/** Snelste kilometer uit de splits, als terugval wanneer er geen hartslag is. */
function fastestSplitSec(session: CompletedSession): number | null {
  const splits = session.splits;
  if (!splits || splits.length === 0) return null;
  return splits.reduce((best, s) => (s.seconds < best ? s.seconds : best), Infinity);
}

// ── Component ───────────────────────────────────────────────────────────────

export interface ShareRunCardProps {
  session: CompletedSession;
  weekNumber: number;
  runnerName?: string;
  totalWeeks?: number;
  /** max hartslag van de gebruiker voor zone-berekening */
  maxHeartRate?: number;
  /** Naam van het actieve schema, bijvoorbeeld "Marathon" of een wedstrijd. */
  planLabel?: string;
}

export const ShareRunCard = forwardRef<View, ShareRunCardProps>(function ShareRunCard(
  {
    session,
    weekNumber,
    runnerName,
    totalWeeks = 12,
    maxHeartRate = 190,
    planLabel = 'Trainingsschema',
  },
  ref,
) {
  const accentColor = zoneColor(session.avgHeartRate, maxHeartRate);
  const route       = session.route ?? [];
  const hasRoute    = route.length > 1;

  const svgPath = hasRoute
    ? routeToSvgPath(route, ROUTE_W, ROUTE_H)
    : demoRoutePath(ROUTE_W, ROUTE_H);

  // Startpunt: de eerste coördinaat uit het pad ("M x,y L ...").
  const startPoint = svgPath.split(' ')[1]?.split(',') ?? [];
  const startX = parseFloat(startPoint[0]);
  const startY = parseFloat(startPoint[1]);

  const weekProgress = Math.min(weekNumber / Math.max(totalWeeks, 1), 1);

  // Datumstring. Alleen de éérste letter een hoofdletter: in het Nederlands
  // schrijf je weekdag en maand klein, dus CSS-capitalize (dat elk woord pakt)
  // zou "Zondag 19 Juli" opleveren.
  const rawDate = new Date(session.completedAt).toLocaleDateString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  const dateStr = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);

  // Derde statistiekcel: hartslag als die er is, anders de snelste kilometer.
  const fastest = session.avgHeartRate ? null : fastestSplitSec(session);

  return (
    <View ref={ref} style={shared.card}>
      <Image source={ART_TEXTURE} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <ArtScrim profile="texture" />

      <View style={shared.content}>
        <TopBar runnerName={runnerName} />

        {/* ── Routetracé: de held van deze kaart ── */}
        <View style={styles.route}>
          <Svg width={ROUTE_W} height={ROUTE_H}>
            <Defs>
              <LinearGradient id="trace" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={palette.primary[400]} stopOpacity="1"    />
                <Stop offset="1" stopColor={palette.primary[500]} stopOpacity="0.55" />
              </LinearGradient>
            </Defs>

            {/* Schaduwtracé geeft diepte op een drukke ondergrond */}
            <Path
              d={svgPath}
              stroke={palette.neutral[950]}
              strokeWidth={9}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity={0.75}
            />
            <Path
              d={svgPath}
              stroke="url(#trace)"
              strokeWidth={3.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />

            {/* Startpunt */}
            {Number.isFinite(startX) && Number.isFinite(startY) && (
              <>
                <Circle cx={startX} cy={startY} r={8.5} fill={palette.primary[400]} opacity={0.20} />
                <Circle cx={startX} cy={startY} r={4.3} fill={palette.primary[400]} />
              </>
            )}
          </Svg>
        </View>

        {/* ── Datum + hartslagzone ── */}
        <View style={styles.meta}>
          <Text style={styles.dateLabel}>{dateStr.toUpperCase()}</Text>
          <View
            style={[
              styles.zoneBadge,
              { backgroundColor: accentColor + '28', borderColor: accentColor + '60' },
            ]}
          >
            <View style={[styles.zoneDot, { backgroundColor: accentColor }]} />
            <Text style={[styles.zoneText, { color: accentColor }]}>
              {zoneLabel(session.avgHeartRate, maxHeartRate)}
            </Text>
          </View>
        </View>

        {/* ── Hero-stat: afstand ── */}
        <View style={[shared.heroRow, styles.heroRow]}>
          <Text style={shared.heroValue} {...NO_FONT_PADDING}>
            {session.actualDistanceKm.toFixed(2)}
          </Text>
          <Text style={shared.heroUnit}>km</Text>
        </View>

        <Hairline style={styles.hairline} />

        {/* ── Statistiekraster ── */}
        <View style={styles.statsGrid}>
          <StatCell label="Tijd"  value={formatDuration(session.durationSeconds)} />
          <StatCell label="Tempo" value={formatPace(session.avgPaceSecPerKm)} unit="/km" />
          {session.avgHeartRate ? (
            <StatCell label="Hartslag" value={String(session.avgHeartRate)} unit="bpm" />
          ) : fastest ? (
            <StatCell label="Snelste km" value={formatPace(fastest)} unit="/km" />
          ) : null}
        </View>

        {/* ── Weekvoortgang: plaatst de run in het trainingsplan ── */}
        <View style={styles.week}>
          <View style={styles.weekRow}>
            <Text style={styles.weekPlan} numberOfLines={1}>{planLabel}</Text>
            <Text style={styles.weekNr}>Week {weekNumber} van {totalWeeks}</Text>
          </View>
          <View style={styles.weekTrack}>
            <View style={[styles.weekFill, { width: `${weekProgress * 100}%` as any }]} />
          </View>
        </View>

        <BrandFooter />
      </View>
    </View>
  );
});

// ── Styles ──────────────────────────────────────────────────────────────────
// Alle maten zijn precies een derde van card-run-story.html.

const styles = StyleSheet.create({
  route: {
    marginTop: 15,
    marginHorizontal: -ROUTE_BLEED,
    height: ROUTE_H,
  },

  meta: {
    marginTop: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateLabel: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 10,
    color: palette.primary[300],
    letterSpacing: 2,
    flexShrink: 1,
  },
  zoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  zoneDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
  },
  zoneText: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: 8,
    letterSpacing: typography.letterSpacing.wide,
  },

  heroRow:  { marginTop: 10 },
  hairline: { marginTop: 13 },

  statsGrid: {
    flexDirection: 'row',
    marginTop: 13,
  },

  week: {
    marginTop: 15,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing[1],
  },
  weekPlan: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: 8,
    color: palette.neutral[500],
    flexShrink: 1,
  },
  weekNr: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: 8,
    color: palette.neutral[400],
  },
  weekTrack: {
    marginTop: 5,
    height: 3,
    borderRadius: radius.full,
    backgroundColor: 'rgba(156,163,175,0.22)',
    overflow: 'hidden',
  },
  weekFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: palette.primary[500],
  },
});

export { CARD_WIDTH, CARD_HEIGHT };
