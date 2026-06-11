/**
 * ShareRunCard
 *
 * Genereert een Instagram-Stories-stijl deelkaart (9:16) voor een
 * voltooide hardloopsessie. Strava-inspiratie:
 *  - Donkere achtergrond met oranje gradient sweep
 *  - Grote primaire stat bovenaan (afstand)
 *  - Mini route-silhouet als SVG
 *  - Secundaire stats (tijd, tempo, hartslag)
 *  - Zone-kleur accent + trainingsweek context
 *  - App-branding rechtsonder
 *
 * Gebruik:
 *   const cardRef = useRef<View>(null);
 *   <ShareRunCard ref={cardRef} session={completed} weekNumber={4} runnerName="Lars" />
 *   // daarna: captureAndShare(cardRef)
 */

import React, { forwardRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Rect, Circle } from 'react-native-svg';
import { colors, palette, typography, radius, spacing } from '../../theme/tokens';
import type { CompletedSession } from '../../store/appStore';

// ── Formaat: Instagram Stories 9:16 ──────────────────────────────────────────
const CARD_WIDTH  = 360;
const CARD_HEIGHT = 640;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPace(secPerKm: number): string {
  if (!secPerKm || secPerKm === 0) return '--:--';
  const mins = Math.floor(secPerKm / 60);
  const secs = Math.round(secPerKm % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

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

/** Dummy demo-route als er geen GPS-data is */
function demoRoutePath(width: number, height: number): string {
  // Gestileerde hardlooproute-vorm
  const w = width;
  const h = height;
  return [
    `M ${w * 0.12},${h * 0.65}`,
    `C ${w * 0.18},${h * 0.30} ${w * 0.35},${h * 0.15} ${w * 0.50},${h * 0.20}`,
    `C ${w * 0.65},${h * 0.25} ${w * 0.78},${h * 0.40} ${w * 0.85},${h * 0.55}`,
    `C ${w * 0.90},${h * 0.68} ${w * 0.82},${h * 0.82} ${w * 0.65},${h * 0.85}`,
    `C ${w * 0.48},${h * 0.88} ${w * 0.30},${h * 0.82} ${w * 0.22},${h * 0.72}`,
    `C ${w * 0.16},${h * 0.65} ${w * 0.12},${h * 0.65} ${w * 0.12},${h * 0.65}`,
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

// ── Component ─────────────────────────────────────────────────────────────────

export interface ShareRunCardProps {
  session: CompletedSession;
  weekNumber: number;
  runnerName?: string;
  totalWeeks?: number;
  /** max hartslag van de gebruiker voor zone-berekening */
  maxHeartRate?: number;
}

export const ShareRunCard = forwardRef<View, ShareRunCardProps>(function ShareRunCard(
  { session, weekNumber, runnerName, totalWeeks = 12, maxHeartRate = 190 },
  ref,
) {
  const accentColor = zoneColor(session.avgHeartRate, maxHeartRate);
  const route       = session.route ?? [];
  const hasRoute    = route.length > 1;

  const MAP_W = CARD_WIDTH;
  const MAP_H = 240;

  const svgPath = hasRoute
    ? routeToSvgPath(route, MAP_W, MAP_H)
    : demoRoutePath(MAP_W, MAP_H);

  // Voortgangsbalk (weken)
  const weekProgress = Math.min(weekNumber / totalWeeks, 1);

  // Datumstring
  const dateStr = new Date(session.completedAt).toLocaleDateString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <View ref={ref} style={styles.card}>

      {/* ── Achtergrond ── */}
      <Svg
        width={CARD_WIDTH}
        height={CARD_HEIGHT}
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          {/* Hoofd gradient: donker boven → iets lichter onder */}
          <LinearGradient id="bgGrad" x1="0" y1="0" x2="0.4" y2="1">
            <Stop offset="0"   stopColor={palette.neutral[950]} stopOpacity="1" />
            <Stop offset="0.6" stopColor={palette.neutral[900]} stopOpacity="1" />
            <Stop offset="1"   stopColor={palette.neutral[800]} stopOpacity="1" />
          </LinearGradient>
          {/* Accent sweep linksboven */}
          <LinearGradient id="sweepGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={accentColor} stopOpacity="0.22" />
            <Stop offset="1" stopColor={accentColor} stopOpacity="0"    />
          </LinearGradient>
          {/* Route gradient: zichtbaar boven, fade naar onder */}
          <LinearGradient id="routeFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"   stopColor={accentColor} stopOpacity="0.9" />
            <Stop offset="0.7" stopColor={accentColor} stopOpacity="0.5" />
            <Stop offset="1"   stopColor={accentColor} stopOpacity="0"   />
          </LinearGradient>
        </Defs>

        {/* Basis */}
        <Rect width={CARD_WIDTH} height={CARD_HEIGHT} fill="url(#bgGrad)" />
        {/* Accent sweep */}
        <Rect width={CARD_WIDTH} height={CARD_HEIGHT} fill="url(#sweepGrad)" />
      </Svg>

      {/* ── Route-kaart sectie ── */}
      <View style={styles.routeSection}>
        <Svg width={MAP_W} height={MAP_H}>
          <Defs>
            <LinearGradient id="routeStroke" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0"   stopColor={accentColor} stopOpacity="1"   />
              <Stop offset="1"   stopColor={accentColor} stopOpacity="0.4" />
            </LinearGradient>
          </Defs>

          {/* Route schaduwtracé voor diepte */}
          <Path
            d={svgPath}
            stroke={palette.neutral[950]}
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={0.6}
          />
          {/* Hoofd route */}
          <Path
            d={svgPath}
            stroke="url(#routeStroke)"
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Startpunt */}
          {hasRoute && (
            <Circle
              cx={parseFloat(svgPath.split(' ')[1])}
              cy={parseFloat(svgPath.split(' ')[2])}
              r={6}
              fill={accentColor}
              opacity={0.9}
            />
          )}
        </Svg>

        {/* Vervaagde overlay: route smooth laten overgaan in content */}
        <Svg
          width={MAP_W}
          height={MAP_H}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <Defs>
            <LinearGradient id="fadeOut" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0"   stopColor={palette.neutral[950]} stopOpacity="0"   />
              <Stop offset="0.6" stopColor={palette.neutral[950]} stopOpacity="0.3" />
              <Stop offset="1"   stopColor={palette.neutral[950]} stopOpacity="1"   />
            </LinearGradient>
          </Defs>
          <Rect width={MAP_W} height={MAP_H} fill="url(#fadeOut)" />
        </Svg>
      </View>

      {/* ── Content sectie ── */}
      <View style={styles.content}>

        {/* Datum + naam */}
        <View style={styles.headerRow}>
          <Text style={styles.dateText}>{dateStr}</Text>
          {runnerName && (
            <Text style={styles.nameText}>{runnerName}</Text>
          )}
        </View>

        {/* Zone badge */}
        <View style={[styles.zoneBadge, { backgroundColor: accentColor + '28', borderColor: accentColor + '60' }]}>
          <View style={[styles.zoneDot, { backgroundColor: accentColor }]} />
          <Text style={[styles.zoneText, { color: accentColor }]}>
            {zoneLabel(session.avgHeartRate, maxHeartRate)}
          </Text>
        </View>

        {/* Grote primaire stat: afstand */}
        <View style={styles.primaryStat}>
          <Text style={styles.primaryValue}>
            {session.actualDistanceKm.toFixed(2)}
          </Text>
          <Text style={styles.primaryUnit}>km</Text>
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: accentColor + '40' }]} />

        {/* Secundaire stats */}
        <View style={styles.secondaryStats}>
          <StatItem label="Tijd" value={formatDuration(session.durationSeconds)} />
          <View style={[styles.statSep, { backgroundColor: accentColor + '30' }]} />
          <StatItem label="Tempo" value={formatPace(session.avgPaceSecPerKm)} unit="/km" />
          {session.avgHeartRate && (
            <>
              <View style={[styles.statSep, { backgroundColor: accentColor + '30' }]} />
              <StatItem label="Hartslag" value={String(session.avgHeartRate)} unit="bpm" />
            </>
          )}
        </View>

        {/* Weekvoortgang */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Halve Marathon Training</Text>
            <Text style={styles.progressWeek}>Week {weekNumber}/{totalWeeks}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${weekProgress * 100}%` as any,
                  backgroundColor: accentColor,
                },
              ]}
            />
          </View>
        </View>

        {/* App branding */}
        <View style={styles.brandRow}>
          <Text style={styles.brandText}>🏃 Loop de halve</Text>
        </View>

      </View>
    </View>
  );
});

// ── Subcomponent ──────────────────────────────────────────────────────────────

function StatItem({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValueRow}>
        <Text style={styles.statValue}>{value}</Text>
        {unit && <Text style={styles.statUnit}>{unit}</Text>}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    width:  CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: palette.neutral[950],
    borderRadius: radius['2xl'],
    overflow: 'hidden',
  },

  // Route sectie (bovenste ~37%)
  routeSection: {
    width: CARD_WIDTH,
    height: 240,
  },

  // Content (onderste ~63%)
  content: {
    flex: 1,
    paddingHorizontal: spacing[3],
    paddingTop: spacing[1],
    paddingBottom: spacing[2],
    gap: spacing[1],
  },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: typography.fontSize.sm,
    color: palette.neutral[400],
    textTransform: 'capitalize',
  },
  nameText: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.sm,
    color: palette.neutral[300],
  },

  zoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: spacing[1],
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  zoneDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
  zoneText: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.sm,
    letterSpacing: typography.letterSpacing.wide,
  },

  primaryStat: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginTop: spacing[0.5],
  },
  primaryValue: {
    fontFamily: typography.fontFamily.display,
    fontSize: 86,
    color: palette.neutral[50],
    lineHeight: 86,
    letterSpacing: -3,
  },
  primaryUnit: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: typography.fontSize['2xl'],
    color: palette.neutral[400],
    marginBottom: 10,
  },

  divider: {
    height: 1,
    borderRadius: 1,
    marginVertical: spacing[0.5],
  },

  secondaryStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    gap: 3,
  },
  statLabel: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.xs,
    color: palette.neutral[500],
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wider,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  statValue: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: typography.fontSize['2xl'],
    color: palette.neutral[100],
    lineHeight: typography.fontSize['2xl'] * 1.1,
  },
  statUnit: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: typography.fontSize.sm,
    color: palette.neutral[500],
    marginBottom: 3,
  },
  statSep: {
    width: 1,
    height: 36,
    marginHorizontal: spacing[2],
  },

  progressSection: {
    gap: 8,
    marginTop: spacing[1],
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: typography.fontSize.sm,
    color: palette.neutral[500],
  },
  progressWeek: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.sm,
    color: palette.neutral[300],
  },
  progressTrack: {
    height: 4,
    backgroundColor: palette.neutral[800],
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
  },

  brandRow: {
    marginTop: 'auto' as any,
    alignItems: 'flex-end',
  },
  brandText: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: typography.fontSize.xs,
    color: palette.neutral[600],
    letterSpacing: typography.letterSpacing.wide,
  },
});

export { CARD_WIDTH, CARD_HEIGHT };
