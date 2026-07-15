/**
 * SharePeriodCard
 *
 * Deelbare 9:16 social-kaart (Instagram Stories-formaat) met de prestaties
 * van een gebruiker over een week, maand, kwartaal of jaar. Zusje van
 * ShareRunCard, maar dan voor een hele periode in plaats van één run.
 *
 * Drie stijlvarianten (prop `variant`):
 *  - 'gradient' — donker met oranje gradient sweep, familiegevoel met
 *    ShareRunCard: grote totaal-km bovenaan, secundaire stats eronder en een
 *    vergelijkingsbadge t.o.v. de vorige periode.
 *  - 'minimal'  — licht en clean, één hero-stat (totaal km) heel groot, veel
 *    witruimte, subtiele statsregel onderaan.
 *  - 'grid'     — donker statsgrid (2 kolommen) met een accentkleur per tegel.
 *
 * Gebruik:
 *   const cardRef = useRef<View>(null);
 *   <SharePeriodCard ref={cardRef} stats={stats} runnerName="Lars" variant="gradient" />
 */

import React, { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { palette, typography, radius, spacing } from '../../theme/tokens';
import type { PeriodStats, PeriodType } from '../../utils/periodStats';

// ── Formaat: Instagram Stories 9:16 (gelijk aan ShareRunCard) ───────────────
const CARD_WIDTH  = 360;
const CARD_HEIGHT = 640;

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

// ── Variant: gradient ────────────────────────────────────────────────────

const GradientCard = forwardRef<View, { stats: PeriodStats; runnerName?: string }>(
  function GradientCard({ stats, runnerName }, ref) {
    const accentColor = palette.primary[500];
    const isYear = stats.period === 'year';

    return (
      <View ref={ref} style={styles.card}>
        <Svg width={CARD_WIDTH} height={CARD_HEIGHT} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="periodBgGrad" x1="0" y1="0" x2="0.4" y2="1">
              <Stop offset="0"   stopColor={palette.neutral[950]} stopOpacity="1" />
              <Stop offset="0.6" stopColor={palette.neutral[900]} stopOpacity="1" />
              <Stop offset="1"   stopColor={palette.neutral[800]} stopOpacity="1" />
            </LinearGradient>
            <LinearGradient id="periodSweepGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={accentColor} stopOpacity="0.28" />
              <Stop offset="1" stopColor={accentColor} stopOpacity="0"    />
            </LinearGradient>
          </Defs>
          <Rect width={CARD_WIDTH} height={CARD_HEIGHT} fill="url(#periodBgGrad)" />
          <Rect width={CARD_WIDTH} height={CARD_HEIGHT} fill="url(#periodSweepGrad)" />
        </Svg>

        <View style={styles.gradientContent}>
          <View style={styles.headerRow}>
            <View>
              {isYear && <Text style={styles.yearOverviewLabel}>Jaaroverzicht</Text>}
              <Text style={styles.periodLabel}>{stats.label.toUpperCase()}</Text>
            </View>
            {runnerName && <Text style={styles.nameText}>{runnerName}</Text>}
          </View>

          {stats.kmDeltaPct !== null && (
            <View style={[styles.deltaBadge, { backgroundColor: accentColor + '28', borderColor: accentColor + '60' }]}>
              <Text style={[styles.deltaText, { color: accentColor }]}>
                {formatDelta(stats.kmDeltaPct)} t.o.v. {prevPeriodNoun(stats.period)}
              </Text>
            </View>
          )}

          <View style={styles.primaryStat}>
            <Text style={styles.primaryValue}>{formatKm(stats.totalKm)}</Text>
            <Text style={styles.primaryUnit}>km</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: accentColor + '40' }]} />

          <View style={styles.secondaryStats}>
            <StatItem label="Runs" value={String(stats.runCount)} />
            <View style={[styles.statSep, { backgroundColor: accentColor + '30' }]} />
            <StatItem label="Tijd" value={formatDuration(stats.totalSeconds)} />
            <View style={[styles.statSep, { backgroundColor: accentColor + '30' }]} />
            <StatItem label="Gem. tempo" value={formatPace(stats.avgPaceSecPerKm)} unit="/km" />
          </View>

          <View style={styles.secondaryStats}>
            <StatItem label="Langste run" value={formatKm(stats.longestRunKm)} unit="km" />
            <View style={[styles.statSep, { backgroundColor: accentColor + '30' }]} />
            <StatItem label="Beste tempo" value={formatPace(stats.bestPaceSecPerKm)} unit="/km" />
            <View style={[styles.statSep, { backgroundColor: accentColor + '30' }]} />
            <StatItem label="Actieve dagen" value={String(stats.activeDays)} />
          </View>

          <View style={styles.brandRow}>
            <Text style={styles.brandText}>Lopen te Lopen</Text>
          </View>
        </View>
      </View>
    );
  },
);

// ── Variant: minimal ────────────────────────────────────────────────────

const MinimalCard = forwardRef<View, { stats: PeriodStats; runnerName?: string }>(
  function MinimalCard({ stats, runnerName }, ref) {
    const isYear = stats.period === 'year';
    return (
      <View ref={ref} style={[styles.card, styles.minimalCard]}>
        <View style={styles.minimalContent}>
          <View>
            {isYear && <Text style={styles.minimalYearLabel}>Jaaroverzicht</Text>}
            <Text style={styles.minimalPeriodLabel}>{stats.label.toUpperCase()}</Text>
            {runnerName && <Text style={styles.minimalNameText}>{runnerName}</Text>}
          </View>

          <View style={styles.minimalHero}>
            <Text style={styles.minimalHeroValue}>{formatKm(stats.totalKm)}</Text>
            <Text style={styles.minimalHeroUnit}>kilometer</Text>
            {stats.kmDeltaPct !== null && (
              <Text style={styles.minimalDeltaText}>
                {formatDelta(stats.kmDeltaPct)} t.o.v. {prevPeriodNoun(stats.period)}
              </Text>
            )}
          </View>

          <View>
            <View style={styles.minimalDivider} />
            <View style={styles.minimalStatsRow}>
              <MinimalStatItem label="Runs" value={String(stats.runCount)} />
              <MinimalStatItem label="Tijd" value={formatDuration(stats.totalSeconds)} />
              <MinimalStatItem label="Tempo" value={formatPace(stats.avgPaceSecPerKm)} />
            </View>
            <View style={styles.minimalBrandRow}>
              <Text style={styles.minimalBrandText}>Lopen te Lopen</Text>
            </View>
          </View>
        </View>
      </View>
    );
  },
);

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
        <Svg width={CARD_WIDTH} height={CARD_HEIGHT} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="gridBgGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={palette.neutral[900]} stopOpacity="1" />
              <Stop offset="1" stopColor={palette.neutral[950]} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect width={CARD_WIDTH} height={CARD_HEIGHT} fill="url(#gridBgGrad)" />
        </Svg>

        <View style={styles.gridContent}>
          <View style={styles.headerRow}>
            <View>
              {isYear && <Text style={styles.yearOverviewLabel}>Jaaroverzicht</Text>}
              <Text style={styles.periodLabel}>{stats.label.toUpperCase()}</Text>
            </View>
            {runnerName && <Text style={styles.nameText}>{runnerName}</Text>}
          </View>

          {stats.kmDeltaPct !== null && (
            <View
              style={[
                styles.deltaBadge,
                { backgroundColor: GRID_ACCENTS[0] + '28', borderColor: GRID_ACCENTS[0] + '60', marginTop: spacing[1] },
              ]}
            >
              <Text style={[styles.deltaText, { color: GRID_ACCENTS[0] }]}>
                {formatDelta(stats.kmDeltaPct)} t.o.v. {prevPeriodNoun(stats.period)}
              </Text>
            </View>
          )}

          <View style={styles.grid}>
            {tiles.map((tile, i) => (
              <View
                key={tile.label}
                style={[
                  styles.gridTile,
                  { borderColor: GRID_ACCENTS[i % GRID_ACCENTS.length] + '40' },
                ]}
              >
                <View style={[styles.gridTileDot, { backgroundColor: GRID_ACCENTS[i % GRID_ACCENTS.length] }]} />
                <Text style={styles.gridTileLabel}>{tile.label}</Text>
                <View style={styles.gridTileValueRow}>
                  <Text style={styles.gridTileValue}>{tile.value}</Text>
                  {tile.unit && <Text style={styles.gridTileUnit}>{tile.unit}</Text>}
                </View>
              </View>
            ))}
          </View>

          <View style={styles.brandRow}>
            <Text style={styles.brandText}>Lopen te Lopen</Text>
          </View>
        </View>
      </View>
    );
  },
);

// ── Subcomponenten ────────────────────────────────────────────────────────

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

function MinimalStatItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.minimalStatItem}>
      <Text style={styles.minimalStatValue}>{value}</Text>
      <Text style={styles.minimalStatLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    width:  CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: palette.neutral[950],
    borderRadius: radius['2xl'],
    overflow: 'hidden',
  },

  // ── gradient/grid gedeelde header ──
  gradientContent: {
    flex: 1,
    paddingHorizontal: spacing[3],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
    gap: spacing[2],
  },
  gridContent: {
    flex: 1,
    paddingHorizontal: spacing[3],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
    gap: spacing[2],
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  yearOverviewLabel: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.sm,
    color: palette.primary[400],
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: 2,
  },
  periodLabel: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: typography.fontSize.lg,
    color: palette.neutral[100],
    letterSpacing: typography.letterSpacing.wide,
  },
  nameText: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.sm,
    color: palette.neutral[300],
    marginTop: 2,
  },

  deltaBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[1],
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  deltaText: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.sm,
  },

  primaryStat: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginTop: spacing[2],
  },
  primaryValue: {
    fontFamily: typography.fontFamily.display,
    fontSize: 90,
    color: palette.neutral[50],
    lineHeight: 90,
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
    marginVertical: spacing[1],
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
    fontSize: typography.fontSize.xl,
    color: palette.neutral[100],
    lineHeight: typography.fontSize.xl * 1.1,
  },
  statUnit: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: typography.fontSize.sm,
    color: palette.neutral[500],
    marginBottom: 2,
  },
  statSep: {
    width: 1,
    height: 34,
    marginHorizontal: spacing[1.5],
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

  // ── minimal ──
  minimalCard: {
    backgroundColor: palette.neutral[0],
  },
  minimalContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing[3],
    paddingTop: spacing[5],
    paddingBottom: spacing[3],
  },
  minimalYearLabel: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.sm,
    color: palette.primary[600],
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: 2,
  },
  minimalPeriodLabel: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: typography.fontSize.lg,
    color: palette.neutral[900],
    letterSpacing: typography.letterSpacing.wide,
  },
  minimalNameText: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: typography.fontSize.sm,
    color: palette.neutral[500],
    marginTop: 2,
  },
  minimalHero: {
    alignItems: 'center',
  },
  minimalHeroValue: {
    fontFamily: typography.fontFamily.display,
    fontSize: 104,
    color: palette.neutral[900],
    lineHeight: 104,
    letterSpacing: -3,
  },
  minimalHeroUnit: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: typography.fontSize.lg,
    color: palette.neutral[500],
    letterSpacing: typography.letterSpacing.wide,
    marginTop: 2,
  },
  minimalDeltaText: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.sm,
    color: palette.primary[600],
    marginTop: spacing[1.5],
  },
  minimalDivider: {
    height: 1,
    backgroundColor: palette.neutral[200],
    marginBottom: spacing[2],
  },
  minimalStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  minimalStatItem: {
    alignItems: 'center',
    gap: 4,
  },
  minimalStatValue: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: typography.fontSize.lg,
    color: palette.neutral[900],
  },
  minimalStatLabel: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.xs,
    color: palette.neutral[500],
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wider,
  },
  minimalBrandRow: {
    alignItems: 'center',
    marginTop: spacing[2],
  },
  minimalBrandText: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: typography.fontSize.xs,
    color: palette.neutral[400],
    letterSpacing: typography.letterSpacing.wide,
  },

  // ── grid ──
  grid: {
    marginTop: spacing[1],
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing[1.5],
  },
  gridTile: {
    width: (CARD_WIDTH - spacing[3] * 2 - spacing[1.5]) / 2,
    backgroundColor: palette.neutral[900],
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[1.5],
    paddingVertical: spacing[1.5],
    gap: 6,
  },
  gridTileDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
  gridTileLabel: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.xs,
    color: palette.neutral[500],
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wider,
  },
  gridTileValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  gridTileValue: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: typography.fontSize.xl,
    color: palette.neutral[50],
  },
  gridTileUnit: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: typography.fontSize.xs,
    color: palette.neutral[500],
    marginBottom: 3,
  },
});

export { CARD_WIDTH, CARD_HEIGHT };
