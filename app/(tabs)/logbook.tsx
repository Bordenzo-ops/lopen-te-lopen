import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Share2, CalendarX2 } from 'lucide-react-native';
import { typography, spacing, radius, type ThemeColors } from '../../src/theme/tokens';
import { useThemeColors } from '../../src/theme/useTheme';
import { useAppStore } from '../../src/store/appStore';
import type { CompletedSession } from '../../src/store/appStore';
import { RunCalendar } from '../../src/components/ui/RunCalendar';
import { ShareRunSheet } from '../../src/components/ui/ShareRunSheet';
import { formatPacePerKm, formatDuration } from '../../src/data/paceModel';
import { getPeriodStats, type PeriodType, type PeriodStats } from '../../src/utils/periodStats';
import { SharePeriodSheet } from '../../src/components/ui/SharePeriodSheet';

const periodOptions: { value: PeriodType; label: string; shareLabel: string }[] = [
  { value: 'week',    label: 'Week',      shareLabel: 'Deel je week' },
  { value: 'month',   label: 'Maand',     shareLabel: 'Deel je maand' },
  { value: 'quarter', label: 'Kwartaal',  shareLabel: 'Deel je kwartaal' },
  { value: 'year',    label: 'Jaar',      shareLabel: 'Deel je jaar' },
];

const sourceLabel: Record<CompletedSession['source'], string> = {
  app:           'App',
  strava:        'Strava',
  garmin:        'Garmin',
  apple_health:  'Apple Health',
  google_fit:    'Google Fit',
  mi_fitness:    'Mi Fitness',
};

export default function LogbookScreen() {
  const profile = useAppStore(s => s.profile);
  const completedSessions = useAppStore(s => s.completedSessions);
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [period, setPeriod] = useState<PeriodType>('week');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showPeriodShare, setShowPeriodShare] = useState(false);
  const [runToShare, setRunToShare] = useState<CompletedSession | null>(null);

  // Groepeer voltooide runs per dag (key = 'yyyy-MM-dd') voor de kalender en
  // het dagdetail hieronder.
  const runsByDay = useMemo(() => {
    const map = new Map<string, CompletedSession[]>();
    for (const session of completedSessions) {
      const key = format(new Date(session.completedAt), 'yyyy-MM-dd');
      const existing = map.get(key);
      if (existing) {
        existing.push(session);
      } else {
        map.set(key, [session]);
      }
    }
    // Nieuwste run eerst binnen elke dag
    for (const runs of map.values()) {
      runs.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
    }
    return map;
  }, [completedSessions]);

  const stats: PeriodStats = useMemo(
    () => getPeriodStats(completedSessions, period),
    [completedSessions, period],
  );

  const hasAnyRuns = completedSessions.length > 0;
  const selectedRuns = selectedDate ? runsByDay.get(selectedDate) ?? [] : [];
  const activePeriodOption = periodOptions.find(p => p.value === period)!;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Logboek</Text>

        {/* Periode-samenvatting */}
        <View style={styles.section}>
          <View style={styles.segmentControl}>
            {periodOptions.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.segmentBtn, period === opt.value && styles.segmentBtnActive]}
                onPress={() => setPeriod(opt.value)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={opt.label}
                accessibilityState={{ selected: period === opt.value }}
              >
                <Text style={[styles.segmentBtnLabel, period === opt.value && styles.segmentBtnLabelActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.statsCard}>
            <Text style={styles.statsPeriodLabel}>{stats.label}</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.totalKm.toFixed(1)}</Text>
                <Text style={styles.statLabel}>km</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.runCount}</Text>
                <Text style={styles.statLabel}>runs</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{formatDuration(stats.totalSeconds)}</Text>
                <Text style={styles.statLabel}>tijd</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{formatPacePerKm(stats.avgPaceSecPerKm)}</Text>
                <Text style={styles.statLabel}>gem. tempo</Text>
              </View>
            </View>
            {stats.kmDeltaPct != null && (
              <Text style={styles.statsDelta}>
                {stats.kmDeltaPct >= 0 ? '+' : ''}{stats.kmDeltaPct.toFixed(0)}% t.o.v. vorige periode
              </Text>
            )}

            <TouchableOpacity
              style={[styles.shareBtn, stats.runCount === 0 && styles.shareBtnDisabled]}
              onPress={() => setShowPeriodShare(true)}
              disabled={stats.runCount === 0}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={activePeriodOption.shareLabel}
            >
              <Share2 size={16} color={stats.runCount === 0 ? colors.textTertiary : colors.textInverse} strokeWidth={2} />
              <Text style={[styles.shareBtnLabel, stats.runCount === 0 && styles.shareBtnLabelDisabled]}>
                {activePeriodOption.shareLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Kalender */}
        <View style={styles.section}>
          <RunCalendar
            runsByDay={runsByDay}
            selectedDate={selectedDate}
            onSelectDate={date => setSelectedDate(date)}
          />
        </View>

        {/* Dagdetail */}
        <View style={styles.section}>
          {!hasAnyRuns ? (
            <View style={styles.emptyState}>
              <CalendarX2 size={28} color={colors.textTertiary} strokeWidth={1.5} />
              <Text style={styles.emptyStateTitle}>Nog geen runs gelopen</Text>
              <Text style={styles.emptyStateText}>
                Zodra je je eerste training afrondt, verschijnt hij hier in je logboek. Ga naar
                Dashboard om te starten!
              </Text>
            </View>
          ) : selectedRuns.length > 0 ? (
            <View style={styles.dayDetailList}>
              {selectedRuns.map((run, idx) => (
                <View key={`${run.sessionId}-${idx}`} style={styles.runRow}>
                  <View style={styles.runRowInfo}>
                    <Text style={styles.runRowDate}>
                      {format(new Date(run.completedAt), 'd MMMM, HH:mm', { locale: nl })}
                    </Text>
                    <View style={styles.runRowStats}>
                      <Text style={styles.runRowStat}>{run.actualDistanceKm.toFixed(1)} km</Text>
                      <Text style={styles.runRowDot}>·</Text>
                      <Text style={styles.runRowStat}>{formatDuration(run.durationSeconds)}</Text>
                      <Text style={styles.runRowDot}>·</Text>
                      <Text style={styles.runRowStat}>{formatPacePerKm(run.avgPaceSecPerKm)}</Text>
                    </View>
                    {run.source !== 'app' && (
                      <Text style={styles.runRowSource}>via {sourceLabel[run.source]}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.runShareBtn}
                    onPress={() => setRunToShare(run)}
                    hitSlop={8}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Deel deze run"
                  >
                    <Share2 size={18} color={colors.brandPrimary} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                Tik op een dag met een run om hem te bekijken en te delen.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {runToShare && profile && (
        <ShareRunSheet
          visible={!!runToShare}
          session={runToShare}
          weekNumber={runToShare.weekNumber}
          runnerName={profile.name}
          maxHeartRate={profile.maxHeartRate}
          onClose={() => setRunToShare(null)}
        />
      )}

      <SharePeriodSheet
        visible={showPeriodShare}
        stats={stats}
        runnerName={profile?.name}
        onClose={() => setShowPeriodShare(false)}
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  scroll: { paddingHorizontal: spacing[3], paddingTop: spacing[2], paddingBottom: spacing[6], gap: spacing[3] },
  title: {
    fontFamily: typography.fontFamily.display, fontSize: typography.fontSize['2xl'],
    color: colors.textPrimary, letterSpacing: typography.letterSpacing.tight,
  },
  section: { gap: spacing[1.5] },

  segmentControl: {
    flexDirection: 'row', backgroundColor: colors.bgCard,
    borderRadius: radius.xl, padding: 3,
    borderWidth: 1, borderColor: colors.borderSubtle,
    gap: 3,
  },
  segmentBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, borderRadius: radius.lg, minHeight: 40,
  },
  segmentBtnActive: { backgroundColor: colors.brandPrimary },
  segmentBtnLabel: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  segmentBtnLabelActive: { color: colors.textInverse },

  statsCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: spacing[2],
    borderWidth: 1, borderColor: colors.borderSubtle, gap: spacing[1.5],
  },
  statsPeriodLabel: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm,
    color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider,
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { alignItems: 'center', gap: 2, flex: 1 },
  statValue: {
    fontFamily: typography.fontFamily.display, fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
  },
  statLabel: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.xs,
    color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wide,
  },
  statsDelta: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.sm,
    color: colors.brandLight, textAlign: 'center',
  },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[1],
    backgroundColor: colors.brandPrimary, borderRadius: radius.lg,
    paddingVertical: spacing[1.5], minHeight: 44,
  },
  shareBtnDisabled: { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderDefault },
  shareBtnLabel: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm, color: colors.textInverse,
  },
  shareBtnLabelDisabled: { color: colors.textTertiary },

  emptyState: {
    alignItems: 'center', gap: spacing[1], padding: spacing[3],
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  emptyStateTitle: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.base, color: colors.textPrimary,
  },
  emptyStateText: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm,
    color: colors.textSecondary, textAlign: 'center',
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
  },

  dayDetailList: { gap: spacing[1] },
  runRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing[1.5],
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  runRowInfo: { gap: 3, flex: 1 },
  runRowDate: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm, color: colors.textPrimary,
  },
  runRowStats: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  runRowStat: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.xs, color: colors.textSecondary,
  },
  runRowDot: { color: colors.textTertiary, fontSize: typography.fontSize.xs },
  runRowSource: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs,
    color: colors.textTertiary, fontStyle: 'italic',
  },
  runShareBtn: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.md, backgroundColor: colors.brandPrimary + '14',
  },
});
