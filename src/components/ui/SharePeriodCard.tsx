/**
 * SharePeriodCard
 *
 * Deelbare 9:16 social-kaart (Instagram Stories-formaat) met de prestaties
 * van een gebruiker over een week, maand, kwartaal of jaar. Zusje van
 * ShareRunCard, maar dan voor een hele periode in plaats van één run.
 *
 * De kaart is bewust ook een advertentie: wie de post van een ander ziet,
 * moet meteen zien wélke app dit is. Vandaar de merkbalk bovenaan (app-icoon
 * + naam) en onderaan (naam + handle), en het artwork uit assets/brand/.
 *
 * Drie stijlvarianten (prop `variant`):
 *  - 'gradient' — donker met het merk-artwork (schoen + oranje sweep) en één
 *    enorme totaal-km bovenaan; het meest uitgesproken uithangbord.
 *  - 'minimal'  — licht en clean, één hero-stat heel groot, veel witruimte.
 *  - 'grid'     — donker statsgrid (2 kolommen) op de rustige topografie-plaat,
 *    met een accentkleur per tegel.
 *
 * Ontwerpreferentie op ware grootte: scripts/brand-assets/card-story.html
 * (1080x1920 = exact 3x deze kaart). Vermenigvuldig de waarden hier met 3 om
 * de twee naast elkaar te leggen.
 *
 * Gebruik:
 *   const cardRef = useRef<View>(null);
 *   <SharePeriodCard ref={cardRef} stats={stats} runnerName="Lars" variant="gradient" />
 */

import React, { forwardRef } from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { palette, typography, radius, spacing } from '../../theme/tokens';
import type { PeriodStats, PeriodType } from '../../utils/periodStats';

// ── Formaat: Instagram Stories 9:16 (gelijk aan ShareRunCard) ───────────────
const CARD_WIDTH  = 360;
const CARD_HEIGHT = 640;

// ── Merk-assets ────────────────────────────────────────────────────────────
const APP_ICON    = require('../../../assets/icon.png');
const ART_HERO    = require('../../../assets/brand/share-bg-hero.jpg');
const ART_TEXTURE = require('../../../assets/brand/share-bg-texture.jpg');

const SOCIAL_HANDLE = '@lopentelopen';
const BRAND_NAME    = 'Lopen te Lopen';

/** Android knijpt regels met negatieve letterSpacing af zonder deze vlag. */
const NO_FONT_PADDING = Platform.OS === 'android' ? { includeFontPadding: false } : null;

// ── Helpers ───────────────────────────────────────────────────────────────

function formatPace(secPerKm: number | null): string {
  if (!secPerKm || secPerKm <= 0) return '--:--';
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

function formatKm(km: number | null): string {
  if (km === null) return '0.0';
  return km.toFixed(1);
}

/** "Deel je week" e.d. — ook gebruikt door SharePeriodSheet */
export function periodActionLabel(period: PeriodType): string {
  switch (period) {
    case 'week':    return 'Deel je week';
    case 'month':   return 'Deel je maand';
    case 'quarter': return 'Deel je kwartaal';
    case 'year':    return 'Deel je jaar';
  }
}

/** "vorige week" / "vorige maand" / "vorig kwartaal" / "vorig jaar" */
function prevPeriodNoun(period: PeriodType): string {
  switch (period) {
    case 'week':    return 'vorige week';
    case 'month':   return 'vorige maand';
    case 'quarter': return 'vorig kwartaal';
    case 'year':    return 'vorig jaar';
  }
}

function formatDelta(pct: number): string {
  const rounded = Math.round(pct);
  return `${rounded >= 0 ? '+' : ''}${rounded}%`;
}

// ── Component ─────────────────────────────────────────────────────────────

export type SharePeriodCardVariant = 'gradient' | 'minimal' | 'grid';

export interface SharePeriodCardProps {
  stats: PeriodStats;
  runnerName?: string;
  variant: SharePeriodCardVariant;
}

export const SharePeriodCard = forwardRef<View, SharePeriodCardProps>(function SharePeriodCard(
  { stats, runnerName, variant },
  ref,
) {
  if (variant === 'minimal') {
    return <MinimalCard ref={ref} stats={stats} runnerName={runnerName} />;
  }
  if (variant === 'grid') {
    return <GridCard ref={ref} stats={stats} runnerName={runnerName} />;
  }
  return <GradientCard ref={ref} stats={stats} runnerName={runnerName} />;
});

// ── Gedeelde bouwstenen ──────────────────────────────────────────────────

/**
 * Leesbaarheidsverloop over het artwork: donker bovenin voor de statistiek,
 * en een smalle donkere band onderin zodat de merkbalk over de schoen heen
 * leesbaar blijft. Zonder dit wordt de kaart onleesbaar zodra het artwork
 * licht uitvalt.
 */
function ArtScrim() {
  return (
    <Svg width={CARD_WIDTH} height={CARD_HEIGHT} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="scrimTop" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0"    stopColor={palette.neutral[950]} stopOpacity="0.97" />
          <Stop offset="0.38" stopColor={palette.neutral[950]} stopOpacity="0.90" />
          <Stop offset="0.58" stopColor={palette.neutral[950]} stopOpacity="0.30" />
          <Stop offset="0.70" stopColor={palette.neutral[950]} stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id="scrimBottom" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0.78" stopColor={palette.neutral[950]} stopOpacity="0" />
          <Stop offset="0.91" stopColor={palette.neutral[950]} stopOpacity="0.55" />
          <Stop offset="1"    stopColor={palette.neutral[950]} stopOpacity="0.95" />
        </LinearGradient>
      </Defs>
      <Rect width={CARD_WIDTH} height={CARD_HEIGHT} fill="url(#scrimTop)" />
      <Rect width={CARD_WIDTH} height={CARD_HEIGHT} fill="url(#scrimBottom)" />
    </Svg>
  );
}

/** Kop: app-icoon + merknaam links, naam van de loper rechts. */
function TopBar({ runnerName, light = false }: { runnerName?: string; light?: boolean }) {
  return (
    <View style={styles.topBar}>
      <View style={styles.lockup}>
        <Image source={APP_ICON} style={styles.topIcon} />
        <Text style={[styles.topName, light && styles.topNameLight]}>{BRAND_NAME}</Text>
      </View>
      {runnerName ? (
        <Text style={[styles.runnerName, light && styles.runnerNameLight]} numberOfLines={1}>
          {runnerName}
        </Text>
      ) : null}
    </View>
  );
}

/** Voet: merknaam + handle. Het stukje dat nieuwsgierig moet maken. */
function BrandFooter({ light = false }: { light?: boolean }) {
  return (
    <View style={styles.brandFooter}>
      <Text style={[styles.brandName, light && styles.brandNameLight]}>{BRAND_NAME}</Text>
      <View style={styles.brandDot} />
      <Text style={[styles.brandHandle, light && styles.brandHandleLight]}>{SOCIAL_HANDLE}</Text>
    </View>
  );
}

/** Eén cel in het 3-koloms statistiekraster. */
function StatCell({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValueRow}>
        <Text style={styles.statValue} {...NO_FONT_PADDING}>{value}</Text>
        {unit && <Text style={styles.statUnit}>{unit}</Text>}
      </View>
    </View>
  );
}

// ── Variant: gradient (merk-artwork) ─────────────────────────────────────

const GradientCard = forwardRef<View, { stats: PeriodStats; runnerName?: string }>(
  function GradientCard({ stats, runnerName }, ref) {
    const isYear = stats.period === 'year';

    return (
      <View ref={ref} style={styles.card}>
        <Image source={ART_HERO} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <ArtScrim />

        <View style={styles.content}>
          <TopBar runnerName={runnerName} />

          {isYear && <Text style={styles.yearLabel}>Jaaroverzicht</Text>}
          <Text style={styles.periodLabel}>{stats.label.toUpperCase()}</Text>

          {stats.kmDeltaPct !== null && (
            <View style={styles.deltaRow}>
              <View style={styles.deltaBadge}>
                <Text style={styles.deltaText}>
                  {formatDelta(stats.kmDeltaPct)} t.o.v. {prevPeriodNoun(stats.period)}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.heroRow}>
            <Text style={styles.heroValue} {...NO_FONT_PADDING}>{formatKm(stats.totalKm)}</Text>
            <Text style={styles.heroUnit}>km</Text>
          </View>

          <Hairline />

          <View style={styles.statsGrid}>
            <StatCell label="Runs"          value={String(stats.runCount)} />
            <StatCell label="Tijd"          value={formatDuration(stats.totalSeconds)} />
            <StatCell label="Gem. tempo"    value={formatPace(stats.avgPaceSecPerKm)} unit="/km" />
            <StatCell label="Langste run"   value={formatKm(stats.longestRunKm)} unit="km" />
            <StatCell label="Beste tempo"   value={formatPace(stats.bestPaceSecPerKm)} unit="/km" />
            <StatCell label="Actieve dagen" value={String(stats.activeDays)} />
          </View>

          <BrandFooter />
        </View>
      </View>
    );
  },
);

/** Oranje haarlijn die naar rechts uitdooft; scheidt hero van de stats. */
function Hairline() {
  return (
    <Svg width={CARD_WIDTH - spacing[3] * 2} height={1} style={styles.hairline}>
      <Defs>
        <LinearGradient id="hair" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={palette.primary[500]} stopOpacity="0.75" />
          <Stop offset="1" stopColor={palette.primary[500]} stopOpacity="0.10" />
        </LinearGradient>
      </Defs>
      <Rect width={CARD_WIDTH - spacing[3] * 2} height={1} fill="url(#hair)" />
    </Svg>
  );
}

// ── Variant: minimal (licht) ─────────────────────────────────────────────

const MinimalCard = forwardRef<View, { stats: PeriodStats; runnerName?: string }>(
  function MinimalCard({ stats, runnerName }, ref) {
    const isYear = stats.period === 'year';
    return (
      <View ref={ref} style={[styles.card, styles.minimalCard]}>
        <View style={styles.content}>
          <TopBar runnerName={runnerName} light />

          <View style={styles.minimalHero}>
            {isYear && <Text style={styles.minimalYearLabel}>Jaaroverzicht</Text>}
            <Text style={styles.minimalPeriodLabel}>{stats.label.toUpperCase()}</Text>

            <Text style={styles.minimalHeroValue} {...NO_FONT_PADDING}>
              {formatKm(stats.totalKm)}
            </Text>
            <Text style={styles.minimalHeroUnit}>kilometer</Text>

            {stats.kmDeltaPct !== null && (
              <View style={styles.minimalDeltaBadge}>
                <Text style={styles.minimalDeltaText}>
                  {formatDelta(stats.kmDeltaPct)} t.o.v. {prevPeriodNoun(stats.period)}
                </Text>
              </View>
            )}
          </View>

          <View>
            <View style={styles.minimalRule} />
            <View style={styles.minimalStatsRow}>
              <MinimalStat label="Runs"  value={String(stats.runCount)} />
              <MinimalStat label="Tijd"  value={formatDuration(stats.totalSeconds)} />
              <MinimalStat label="Tempo" value={formatPace(stats.avgPaceSecPerKm)} />
            </View>
          </View>

          <BrandFooter light />
        </View>
      </View>
    );
  },
);

function MinimalStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.minimalStatItem}>
      <Text style={styles.minimalStatValue} {...NO_FONT_PADDING}>{value}</Text>
      <Text style={styles.minimalStatLabel}>{label}</Text>
    </View>
  );
}

// ── Variant: grid ────────────────────────────────────────────────────────

const GRID_ACCENTS = [
  palette.primary[500],
  palette.zone.z2,
  palette.zone.z3,
  palette.zone.z1,
  palette.gold,
  palette.zone.z4,
];

const GridCard = forwardRef<View, { stats: PeriodStats; runnerName?: string }>(
  function GridCard({ stats, runnerName }, ref) {
    const isYear = stats.period === 'year';
    const tiles: Array<{ label: string; value: string; unit?: string }> = [
      { label: 'Runs',          value: String(stats.runCount) },
      { label: 'Kilometers',    value: formatKm(stats.totalKm), unit: 'km' },
      { label: 'Totale tijd',   value: formatDuration(stats.totalSeconds) },
      { label: 'Gem. tempo',    value: formatPace(stats.avgPaceSecPerKm), unit: '/km' },
      { label: 'Actieve dagen', value: String(stats.activeDays) },
      { label: 'Langste run',   value: formatKm(stats.longestRunKm), unit: 'km' },
    ];

    return (
      <View ref={ref} style={styles.card}>
        <Image source={ART_TEXTURE} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <ArtScrim />

        <View style={styles.content}>
          <TopBar runnerName={runnerName} />

          {isYear && <Text style={styles.yearLabel}>Jaaroverzicht</Text>}
          <Text style={styles.periodLabel}>{stats.label.toUpperCase()}</Text>

          {stats.kmDeltaPct !== null && (
            <View style={styles.deltaRow}>
              <View style={styles.deltaBadge}>
                <Text style={styles.deltaText}>
                  {formatDelta(stats.kmDeltaPct)} t.o.v. {prevPeriodNoun(stats.period)}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.grid}>
            {tiles.map((tile, i) => {
              const accent = GRID_ACCENTS[i % GRID_ACCENTS.length];
              return (
                <View key={tile.label} style={[styles.gridTile, { borderColor: accent + '40' }]}>
                  <View style={[styles.gridTileDot, { backgroundColor: accent }]} />
                  <Text style={styles.gridTileLabel}>{tile.label}</Text>
                  <View style={styles.gridTileValueRow}>
                    <Text style={styles.gridTileValue} {...NO_FONT_PADDING}>{tile.value}</Text>
                    {tile.unit && <Text style={styles.gridTileUnit}>{tile.unit}</Text>}
                  </View>
                </View>
              );
            })}
          </View>

          <BrandFooter />
        </View>
      </View>
    );
  },
);

// ── Styles ────────────────────────────────────────────────────────────────

const PAD_H = spacing[3]; // 24 — horizontale marge van alle varianten

const styles = StyleSheet.create({
  card: {
    width:  CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: palette.neutral[950],
    borderRadius: radius['2xl'],
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    paddingHorizontal: PAD_H,
    paddingTop: 28,
    paddingBottom: spacing[3],
  },

  // ── Merkbalk boven ──
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  topNameLight: { color: palette.neutral[900] },
  runnerName: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: 9,
    color: palette.neutral[400],
    maxWidth: 110,
  },
  runnerNameLight: { color: palette.neutral[500] },

  // ── Periode ──
  yearLabel: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: 9,
    color: palette.primary[300],
    letterSpacing: typography.letterSpacing.wide,
    marginTop: spacing[3],
  },
  periodLabel: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 12,
    color: palette.primary[300],
    letterSpacing: 2.4,
    marginTop: spacing[3],
  },

  deltaRow: {
    flexDirection: 'row',
    marginTop: spacing[1],
  },
  deltaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(242,80,17,0.45)',
    backgroundColor: 'rgba(242,80,17,0.16)',
  },
  deltaText: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: 9,
    color: palette.primary[300],
  },

  // ── Hero-stat ──
  heroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: spacing[1.5],
  },
  heroValue: {
    fontFamily: typography.fontFamily.display,
    fontSize: 96,
    lineHeight: 96,
    letterSpacing: -4,
    color: palette.neutral[0],
  },
  heroUnit: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 21,
    color: palette.neutral[400],
    letterSpacing: -0.4,
  },

  hairline: { marginTop: spacing[1.5] },

  // ── Statistiekraster (3 kolommen, 2 rijen) ──
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing[1.5],
    rowGap: spacing[1.5],
  },
  statCell: {
    width: '33.33%',
  },
  statLabel: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: 7,
    color: palette.neutral[500],
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    marginTop: 4,
  },
  statValue: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 17,
    lineHeight: 19,
    letterSpacing: -0.5,
    color: palette.neutral[0],
  },
  statUnit: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: 9,
    color: palette.neutral[500],
  },

  // ── Merkbalk onder ──
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
  brandNameLight: { color: palette.neutral[900] },
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
  brandHandleLight: { color: palette.neutral[500] },

  // ── minimal ──
  minimalCard: {
    backgroundColor: palette.neutral[0],
  },
  minimalHero: {
    marginTop: 'auto' as any,
    marginBottom: 'auto' as any,
  },
  minimalYearLabel: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: 9,
    color: palette.primary[600],
    letterSpacing: typography.letterSpacing.wide,
  },
  minimalPeriodLabel: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 12,
    color: palette.primary[600],
    letterSpacing: 2.4,
    marginBottom: spacing[1],
  },
  minimalHeroValue: {
    fontFamily: typography.fontFamily.display,
    fontSize: 108,
    lineHeight: 104,
    letterSpacing: -4.5,
    color: palette.neutral[900],
  },
  minimalHeroUnit: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: 15,
    color: palette.neutral[500],
    letterSpacing: 1,
    marginTop: 2,
  },
  minimalDeltaBadge: {
    alignSelf: 'flex-start',
    marginTop: spacing[1.5],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(242,80,17,0.10)',
  },
  minimalDeltaText: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: 9,
    color: palette.primary[600],
  },
  minimalRule: {
    height: 2,
    width: 36,
    borderRadius: 1,
    backgroundColor: palette.primary[500],
    marginBottom: spacing[1.5],
  },
  minimalStatsRow: {
    flexDirection: 'row',
    marginBottom: spacing[2],
  },
  minimalStatItem: {
    flex: 1,
  },
  minimalStatValue: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 20,
    lineHeight: 22,
    letterSpacing: -0.6,
    color: palette.neutral[900],
  },
  minimalStatLabel: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: 7,
    color: palette.neutral[500],
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginTop: 3,
  },

  // ── grid ──
  grid: {
    marginTop: spacing[2],
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing[1.5],
  },
  gridTile: {
    width: (CARD_WIDTH - PAD_H * 2 - spacing[1.5]) / 2,
    backgroundColor: 'rgba(17,24,39,0.72)',
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[1.5],
    paddingVertical: spacing[1.5],
    gap: 5,
  },
  gridTileDot: {
    width: 7,
    height: 7,
    borderRadius: radius.full,
  },
  gridTileLabel: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: 7,
    color: palette.neutral[500],
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  gridTileValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  gridTileValue: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 22,
    lineHeight: 24,
    letterSpacing: -0.7,
    color: palette.neutral[0],
  },
  gridTileUnit: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: 9,
    color: palette.neutral[500],
  },
});

export { CARD_WIDTH, CARD_HEIGHT };
