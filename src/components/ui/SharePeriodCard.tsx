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
import { View, Text, Image, StyleSheet } from 'react-native';
import { palette, typography, radius, spacing } from '../../theme/tokens';
import type { PeriodStats, PeriodType } from '../../utils/periodStats';
import {
  ArtScrim,
  ART_HERO,
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

// ── Helpers ───────────────────────────────────────────────────────────────

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

// ── Variant: gradient (merk-artwork) ─────────────────────────────────────

const GradientCard = forwardRef<View, { stats: PeriodStats; runnerName?: string }>(
  function GradientCard({ stats, runnerName }, ref) {
    const isYear = stats.period === 'year';

    return (
      <View ref={ref} style={shared.card}>
        <Image source={ART_HERO} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <ArtScrim />

        <View style={shared.content}>
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

          <View style={[shared.heroRow, styles.heroRow]}>
            <Text style={shared.heroValue} {...NO_FONT_PADDING}>{formatKm(stats.totalKm)}</Text>
            <Text style={shared.heroUnit}>km</Text>
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

// ── Variant: minimal (licht) ─────────────────────────────────────────────

const MinimalCard = forwardRef<View, { stats: PeriodStats; runnerName?: string }>(
  function MinimalCard({ stats, runnerName }, ref) {
    const isYear = stats.period === 'year';
    return (
      <View ref={ref} style={[shared.card, styles.minimalCard]}>
        <View style={shared.content}>
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
      <View ref={ref} style={shared.card}>
        <Image source={ART_TEXTURE} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <ArtScrim />

        <View style={shared.content}>
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
// Wat beide deelkaarten delen (kaart, merkbalken, hero, statistiekcel) staat
// in shareCardParts; hier alleen wat eigen is aan de periodekaart.

const styles = StyleSheet.create({
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
  heroRow: { marginTop: spacing[1.5] },

  // ── Statistiekraster (3 kolommen, 2 rijen) ──
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing[1.5],
    rowGap: spacing[1.5],
  },

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
