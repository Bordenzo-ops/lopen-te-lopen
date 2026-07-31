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
import { View, Text, Image, StyleSheet, Platform, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Rect, Circle } from 'react-native-svg';
import { colors, palette, typography, radius, spacing } from '../../theme/tokens';
import type { CompletedSession } from '../../store/appStore';

// ── Formaat: Instagram Stories 9:16 ──────────────────────────────────────────
const CARD_WIDTH  = 360;
const CARD_HEIGHT = 640;

// ── Merk-assets ──────────────────────────────────────────────────────────────
// Dezelfde topografie-plaat als de 'grid'-variant van SharePeriodCard: rustig
// genoeg om het routetracé niet te storen, maar het haalt de kaart wel uit de
// vlakke-gradient-look.
const APP_ICON    = require('../../../assets/icon.png');
const ART_TEXTURE = require('../../../assets/brand/share-bg-texture.jpg');

const SOCIAL_HANDLE = '@lopentelopen';
const BRAND_NAME    = 'Lopen te Lopen';

/** Android knijpt regels met negatieve letterSpacing af zonder deze vlag. */
const NO_FONT_PADDING = Platform.OS === 'android' ? { includeFontPadding: false } : null;

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
  const MAP_H = 196;

  const svgPath = hasRoute
    ? routeToSvgPath(route, MAP_W, MAP_H)
    : demoRoutePath(MAP_W, MAP_H);

  // Voortgangsbalk (weken)
  const weekProgress = Math.min(weekNumber / totalWeeks, 1);

  // Datumstring. Alleen de éérste letter een hoofdletter: in het Nederlands
  // schrijf je weekdag en maand klein, dus CSS-capitalize (dat elk woord pakt)
  // zou "Zondag 19 Juli" opleveren.
  const rawDate = new Date(session.completedAt).toLocaleDateString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  const dateStr = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);

  return (
    <View ref={ref} style={styles.card}>

      {/* ── Achtergrond: merk-artwork + leesbaarheidsverloop ── */}
      <Image source={ART_TEXTURE} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <Svg
        width={CARD_WIDTH}
        height={CARD_HEIGHT}
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          {/* Donker bovenin voor de route, donker onderin voor de merkvoet */}
          <LinearGradient id="scrimTop" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"    stopColor={palette.neutral[950]} stopOpacity="0.94" />
            <Stop offset="0.45" stopColor={palette.neutral[950]} stopOpacity="0.86" />
            <Stop offset="0.72" stopColor={palette.neutral[950]} stopOpacity="0.55" />
            <Stop offset="1"    stopColor={palette.neutral[950]} stopOpacity="0.88" />
          </LinearGradient>
          {/* Zone-accent sweep linksboven, kleurt mee met de hartslagzone */}
          <LinearGradient id="sweepGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={accentColor} stopOpacity="0.20" />
            <Stop offset="1" stopColor={accentColor} stopOpacity="0"    />
          </LinearGradient>
        </Defs>

        <Rect width={CARD_WIDTH} height={CARD_HEIGHT} fill="url(#scrimTop)" />
        <Rect width={CARD_WIDTH} height={CARD_HEIGHT} fill="url(#sweepGrad)" />
      </Svg>

      {/* ── Merkbalk boven: app-icoon + naam links, loper rechts ── */}
      <View style={styles.topBar}>
        <View style={styles.lockup}>
          <Image source={APP_ICON} style={styles.topIcon} />
          <Text style={styles.topName}>{BRAND_NAME}</Text>
        </View>
        {runnerName && (
          <Text style={styles.runnerName} numberOfLines={1}>{runnerName}</Text>
        )}
      </View>

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

        {/* Datum + zone-badge op één regel */}
        <View style={styles.headerRow}>
          <Text style={styles.dateText}>{dateStr}</Text>
          <View style={[styles.zoneBadge, { backgroundColor: accentColor + '28', borderColor: accentColor + '60' }]}>
            <View style={[styles.zoneDot, { backgroundColor: accentColor }]} />
            <Text style={[styles.zoneText, { color: accentColor }]}>
              {zoneLabel(session.avgHeartRate, maxHeartRate)}
            </Text>
          </View>
        </View>

        {/* Grote primaire stat: afstand */}
        <View style={styles.primaryStat}>
          <Text style={styles.primaryValue} {...NO_FONT_PADDING}>
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

        {/* Merkvoet: dit is wat een kijker de app laat opzoeken */}
        <View style={styles.brandFooter}>
          <Text style={styles.brandName}>{BRAND_NAME}</Text>
          <View style={styles.brandDot} />
          <Text style={styles.brandHandle}>{SOCIAL_HANDLE}</Text>
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

  // Merkbalk boven (gelijk aan SharePeriodCard)
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[3],
    paddingTop: 28,
  },
  lockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  topIcon: {
    width: 20,
    height: 20,
    borderRadius: 5,
  },
  topName: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 8,
    color: palette.neutral[0],
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  runnerName: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: 9,
    color: palette.neutral[400],
    maxWidth: 110,
  },

  // Route sectie
  routeSection: {
    width: CARD_WIDTH,
    height: 196,
    marginTop: spacing[1],
  },

  // Content (onderste helft)
  content: {
    flex: 1,
    paddingHorizontal: spacing[3],
    paddingTop: spacing[1],
    paddingBottom: spacing[3],
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
  },

  zoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  zoneDot: {
    width: 7,
    height: 7,
    borderRadius: radius.full,
  },
  zoneText: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: 9,
    letterSpacing: typography.letterSpacing.wide,
  },

  primaryStat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: spacing[0.5],
  },
  primaryValue: {
    fontFamily: typography.fontFamily.display,
    fontSize: 90,
    color: palette.neutral[0],
    lineHeight: 90,
    letterSpacing: -4,
  },
  primaryUnit: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 21,
    color: palette.neutral[400],
    letterSpacing: -0.4,
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
    fontSize: 22,
    lineHeight: 24,
    letterSpacing: -0.7,
    color: palette.neutral[0],
  },
  statUnit: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: 10,
    color: palette.neutral[500],
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

  brandFooter: {
    marginTop: 'auto' as any,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  brandName: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 10,
    color: palette.neutral[0],
    letterSpacing: -0.1,
  },
  brandDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: palette.primary[500],
  },
  brandHandle: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: 9,
    color: palette.neutral[400],
  },
});

export { CARD_WIDTH, CARD_HEIGHT };
