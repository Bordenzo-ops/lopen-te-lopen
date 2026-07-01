/**
 * SchemaCompleteScreen
 *
 * Toont een felicitatiescherm wanneer de gebruiker het volledige schema
 * heeft afgerond. Geeft de mogelijkheid om te delen, een nieuw doel
 * te kiezen of terug te gaan naar het dashboard.
 */

import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trophy, Share2, RefreshCw, ChevronRight, Dumbbell, Medal } from 'lucide-react-native';
import { typography, spacing, radius, shadows, type ThemeColors } from '../../src/theme/tokens';
import { useThemeColors } from '../../src/theme/useTheme';
import { useAppStore } from '../../src/store/appStore';
import { Button } from '../../src/components/ui/Button';
import { ShareRunSheet } from '../../src/components/ui/ShareRunSheet';

const goalLabel: Record<string, string> = {
  '5km':           '5 KM',
  '10km':          '10 KM',
  'half_marathon': 'Halve Marathon',
  'marathon':      'Marathon',
};

const nextGoalSuggestion: Record<string, string | null> = {
  '5km':           '10km',
  '10km':          'half_marathon',
  'half_marathon': 'marathon',
  'marathon':      null,
};

export default function SchemaCompleteScreen() {
  const { totalKm, totalWeeks, distanceKm, durationSeconds, avgPace, weekNumber } =
    useLocalSearchParams<{
      totalKm:         string;
      totalWeeks:      string;
      distanceKm:      string;
      durationSeconds: string;
      avgPace:         string;
      weekNumber:      string;
    }>();

  const profile           = useAppStore(s => s.profile);
  const completedSessions = useAppStore(s => s.completedSessions);
  const racePlan          = useAppStore(s => s.racePlan);
  const schemaMode        = useAppStore(s => s.schemaMode);
  const [showShare, setShowShare] = useState(false);
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (!profile) return null;

  const lastSession = completedSessions[completedSessions.length - 1];

  const planName = schemaMode === 'race' && racePlan
    ? racePlan.race.name
    : goalLabel[profile.goal] ?? profile.goal;

  const totalRunKm = completedSessions.reduce((s, c) => s + c.actualDistanceKm, 0);
  const totalRuns  = completedSessions.length;

  const nextGoal = nextGoalSuggestion[profile.goal] ?? null;

  function handleNewGoal() {
    // Stuur de gebruiker terug naar onboarding zodat hij een nieuw doel kan kiezen
    router.replace('/(onboarding)/goal');
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.trophyBox}>
            <Trophy size={56} color={colors.brandPrimary} strokeWidth={1.5} />
          </View>
          <Text style={styles.heroTitle}>Schema voltooid!</Text>
          <Text style={styles.heroSub}>
            Je hebt het volledige {planName}-schema afgerond.{'\n'}
            Wees trots op jezelf.
          </Text>
        </View>

        {/* Statistieken */}
        <View style={styles.statsGrid}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{totalRunKm.toFixed(0)}</Text>
            <Text style={styles.statLabel}>km gelopen</Text>
          </View>
          <View style={[styles.statCell, styles.statCellBorder]}>
            <Text style={styles.statValue}>{totalWeeks ?? '?'}</Text>
            <Text style={styles.statLabel}>weken</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{totalRuns}</Text>
            <Text style={styles.statLabel}>sessies</Text>
          </View>
        </View>

        {/* Motivatietekst */}
        <View style={styles.quoteCard}>
          <Text style={styles.quoteText}>
            "Elke grote prestatie begint met de beslissing om het te proberen.
            Jij hebt het niet alleen geprobeerd, maar ook voltooid."
          </Text>
        </View>

        {/* Volgende uitdaging */}
        {nextGoal && (
          <View style={styles.nextGoalCard}>
            <View style={styles.nextGoalHeader}>
              <Text style={styles.nextGoalLabel}>Volgende uitdaging</Text>
            </View>
            <TouchableOpacity
              style={styles.nextGoalBtn}
              onPress={handleNewGoal}
              activeOpacity={0.8}
            >
              <View style={styles.nextGoalLeft}>
                <View style={styles.nextGoalIcon}>
                  {nextGoal === '10km'
                    ? <Dumbbell size={22} color={colors.brandLight} strokeWidth={2} />
                    : nextGoal === 'half_marathon'
                      ? <Medal size={22} color={colors.brandLight} strokeWidth={2} />
                      : <Trophy size={22} color={colors.brandLight} strokeWidth={2} />}
                </View>
                <View>
                  <Text style={styles.nextGoalTitle}>{goalLabel[nextGoal]}</Text>
                  <Text style={styles.nextGoalSub}>Start een nieuw schema</Text>
                </View>
              </View>
              <ChevronRight size={20} color={colors.brandPrimary} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={() => setShowShare(true)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Deel je prestatie"
        >
          <Share2 size={18} color={colors.brandPrimary} strokeWidth={2} />
          <Text style={styles.shareBtnText}>Deel je prestatie</Text>
        </TouchableOpacity>

        <Button
          label="Terug naar dashboard"
          onPress={() => router.replace('/(tabs)/dashboard')}
          fullWidth
          size="lg"
        />
      </View>

      {lastSession && (
        <ShareRunSheet
          visible={showShare}
          session={lastSession}
          weekNumber={parseInt(weekNumber ?? '1')}
          runnerName={profile.name}
          maxHeartRate={profile.maxHeartRate}
          onClose={() => setShowShare(false)}
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  scroll: {
    paddingHorizontal: spacing[3], paddingTop: spacing[4],
    paddingBottom: spacing[3], gap: spacing[3],
  },

  hero: { alignItems: 'center', gap: spacing[2] },
  trophyBox: {
    width: 100, height: 100, borderRadius: 28,
    backgroundColor: colors.brandPrimary + '18',
    borderWidth: 1.5, borderColor: colors.brandPrimary + '44',
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize['3xl'],
    color: colors.textPrimary,
    letterSpacing: typography.letterSpacing.tight,
    textAlign: 'center',
  },
  heroSub: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.fontSize.base * typography.lineHeight.relaxed,
    maxWidth: 300,
  },

  statsGrid: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderSubtle,
    ...shadows.sm,
  },
  statCell: { flex: 1, alignItems: 'center', paddingVertical: spacing[2.5] },
  statCellBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.borderSubtle },
  statValue: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize['2xl'],
    color: colors.brandPrimary,
    letterSpacing: typography.letterSpacing.tight,
  },
  statLabel: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wider,
    marginTop: 3,
  },

  quoteCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    padding: spacing[2.5],
    borderWidth: 1, borderColor: colors.borderSubtle,
    borderLeftWidth: 3, borderLeftColor: colors.brandPrimary + '88',
  },
  quoteText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: typography.fontSize.base * typography.lineHeight.relaxed,
  },

  nextGoalCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  nextGoalHeader: {
    paddingHorizontal: spacing[2], paddingTop: spacing[1.5], paddingBottom: spacing[1],
    borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
  },
  nextGoalLabel: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.widest,
  },
  nextGoalBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing[2],
  },
  nextGoalLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] },
  nextGoalIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.brandPrimary + '18',
  },
  nextGoalTitle: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
  },
  nextGoalSub: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },

  footer: {
    paddingHorizontal: spacing[3], paddingBottom: spacing[3],
    paddingTop: spacing[2], gap: spacing[1],
  },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[1], paddingVertical: spacing[1.5],
    borderRadius: radius.xl, borderWidth: 1,
    borderColor: colors.brandPrimary + '55',
    backgroundColor: colors.brandPrimary + '11',
  },
  shareBtnText: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.base,
    color: colors.brandPrimary,
  },
});
