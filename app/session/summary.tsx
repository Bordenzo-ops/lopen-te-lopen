import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle2, Home, Share2, Trophy, Sparkles } from 'lucide-react-native';
import { typography, spacing, radius, shadows, type ThemeColors } from '../../src/theme/tokens';
import { useThemeColors } from '../../src/theme/useTheme';
import { useAppStore } from '../../src/store/appStore';
import { getTrainingPlan, zoneInfo } from '../../src/data/trainingPlans';
import type { TrainingWeek } from '../../src/data/trainingPlans';
import { selectTotalKm } from '../../src/store/appStore';
import { detectPersonalRecords, detectCumulativeMilestone } from '../../src/data/achievements';
import { Button } from '../../src/components/ui/Button';
import { ZoneBadge } from '../../src/components/ui/ZoneBadge';
import { ShareRunSheet } from '../../src/components/ui/ShareRunSheet';

export default function SummaryScreen() {
  const { distanceKm, durationSeconds, avgPace, sessionId, weekNumber } =
    useLocalSearchParams<{
      distanceKm: string;
      durationSeconds: string;
      avgPace: string;
      sessionId: string;
      weekNumber: string;
    }>();

  const profile           = useAppStore(s => s.profile);
  const racePlan          = useAppStore(s => s.racePlan);
  const schemaMode        = useAppStore(s => s.schemaMode);
  const completedSessions = useAppStore(s => s.completedSessions);
  const currentWeek       = useAppStore(s => s.currentWeek);
  const [showShare, setShowShare] = useState(false);
  const completedInWeek = useAppStore(s =>
    s.completedSessions.filter(c => c.weekNumber === parseInt(weekNumber ?? '1')).length
  );
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (!profile) return null;

  const lastSession = completedSessions[completedSessions.length - 1];

  // Persoonlijke records detecteren: vergelijk de zojuist voltooide run met alle
  // eerdere runs (lastSession zit al in completedSessions, dus die sluiten we uit).
  const pr = lastSession
    ? detectPersonalRecords(lastSession, completedSessions.slice(0, -1))
    : { longestRun: false, fastestPace: false };
  const prText = pr.longestRun && pr.fastestPace
    ? 'Nieuw record: je langste én snelste run tot nu toe!'
    : pr.longestRun
    ? 'Nieuw record: je langste run tot nu toe!'
    : pr.fastestPace
    ? 'Nieuw record: je snelste gemiddelde tempo tot nu toe!'
    : null;

  // Vroeg, laagdrempelig mijlpaal-moment: de allereerste training, of de
  // cumulatieve afstand die net over 5 km resp. 10 km heen gaat. Dit geeft ook
  // wie nog geen reeks of persoonlijk record heeft toch iets om trots op te zijn.
  const cumulativeMilestone = lastSession
    ? detectCumulativeMilestone(lastSession, completedSessions.slice(0, -1))
    : null;
  const milestoneText =
    cumulativeMilestone === 'first-run'
      ? 'Je eerste training staat op de teller. Dit is het begin van iets moois!'
      : cumulativeMilestone === 'km-5'
      ? 'Mijlpaal: je hebt nu samen 5 km gelopen!'
      : cumulativeMilestone === 'km-10'
      ? 'Mijlpaal: je hebt nu samen 10 km gelopen!'
      : null;

  // Zoek week en sessie op in het juiste plan (vrij of race)
  const weekNum = parseInt(weekNumber ?? '1');
  const resolveWeek = (): TrainingWeek | undefined => {
    if (schemaMode === 'race' && racePlan) {
      return racePlan.weeks.find(w => w.weekNumber === weekNum);
    }
    return getTrainingPlan(profile.goal).plan.find(w => w.weekNumber === weekNum);
  };

  const week    = resolveWeek();
  const session = week?.sessions.find(s => s.id === sessionId);

  const km = parseFloat(distanceKm ?? '0');
  const secs = parseInt(durationSeconds ?? '0');
  const pace = parseInt(avgPace ?? '0');

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    if (s >= 3600) {
      const h = Math.floor(s / 3600);
      const rem = Math.floor((s % 3600) / 60);
      return `${h}u ${rem}m`;
    }
    return `${m}m ${sec}s`;
  };

  const formatPace = (secPerKm: number) => {
    if (secPerKm === 0) return '--:--';
    const m = Math.floor(secPerKm / 60);
    const s = Math.round(secPerKm % 60);
    return `${m}:${String(s).padStart(2, '0')} /km`;
  };

  const totalInWeek = week?.sessions.length ?? 3;
  const weekDone = completedInWeek >= totalInWeek;

  // Controleer of het hele schema nu klaar is
  const totalWeeks = schemaMode === 'race' && racePlan
    ? racePlan.totalWeeks
    : getTrainingPlan(profile.goal).weeks;
  const schemaComplete = weekDone && weekNum >= totalWeeks;

  const getMessage = () => {
    if (km >= (session?.distanceKm ?? 0)) return 'Doelafstand gehaald!';
    if (km >= (session?.distanceKm ?? 0) * 0.8) return 'Goed bezig! Elke training brengt je dichter bij je doel.';
    return 'Elke meter telt. Ga zo door!';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.checkIcon}>
            <CheckCircle2 size={48} color={colors.success} strokeWidth={1.5} />
          </View>
          <Text style={styles.heroTitle}>Sessie voltooid</Text>
          <Text style={styles.heroSub}>{getMessage()}</Text>
        </View>

        {/* Grote afstand */}
        <View style={styles.bigStat}>
          <Text style={styles.bigStatValue}>{km.toFixed(2)}</Text>
          <Text style={styles.bigStatUnit}>kilometer</Text>
        </View>

        {/* Persoonlijk record */}
        {prText && (
          <View style={styles.prBanner}>
            <Trophy size={18} color={colors.premium} strokeWidth={2} />
            <Text style={styles.prBannerText}>{prText}</Text>
          </View>
        )}

        {/* Vroeg mijlpaal-moment: eerste training of 5/10 km cumulatief */}
        {milestoneText && (
          <View style={styles.milestoneBanner}>
            <Sparkles size={18} color={colors.brandPrimary} strokeWidth={2} />
            <Text style={styles.milestoneBannerText}>{milestoneText}</Text>
          </View>
        )}

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Tijd</Text>
            <Text style={styles.statValue}>{formatDuration(secs)}</Text>
          </View>
          <View style={[styles.statCell, styles.statCellBorder]}>
            <Text style={styles.statLabel}>Tempo</Text>
            <Text style={styles.statValue}>{formatPace(pace)}</Text>
          </View>
          {session && (
            <View style={styles.statCell}>
              <Text style={styles.statLabel}>Zone</Text>
              <ZoneBadge zone={session.zone} size="sm" />
            </View>
          )}
        </View>

        {/* Week progress */}
        <View style={styles.weekCard}>
          <View style={styles.weekCardHeader}>
            <Text style={styles.weekCardTitle}>Week {weekNumber} voortgang</Text>
            <Text style={styles.weekCardCount}>{completedInWeek}/{totalInWeek} sessies</Text>
          </View>
          <View style={styles.sessionDots}>
            {Array.from({ length: totalInWeek }, (_, i) => (
              <View
                key={i}
                style={[styles.dot, i < completedInWeek && styles.dotDone]}
              />
            ))}
          </View>
          {weekDone && (
            <View style={styles.weekDoneBanner}>
              <Text style={styles.weekDoneText}>🎉 Week {weekNumber} volledig afgerond!</Text>
            </View>
          )}
        </View>

        {/* Coach bericht */}
        {session && (
          <View style={styles.coachCard}>
            <Text style={styles.coachLabel}>Tip van de coach</Text>
            <Text style={styles.coachText}>{session.coachTip}</Text>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.shareBtn} onPress={() => setShowShare(true)} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Deel je run">
          <Share2 size={18} color={colors.brandPrimary} strokeWidth={2} />
          <Text style={styles.shareBtnText}>Deel je run</Text>
        </TouchableOpacity>
        {schemaComplete ? (
          <Button
            label="Bekijk je prestatie"
            onPress={() => router.replace({
              pathname: '/session/complete',
              params: {
                totalWeeks: String(totalWeeks),
                weekNumber,
              },
            })}
            fullWidth
            size="lg"
          />
        ) : (
          <Button
            label="Terug naar dashboard"
            onPress={() => router.replace('/(tabs)/dashboard')}
            fullWidth
            size="lg"
            icon={<Home size={18} color={colors.textInverse} strokeWidth={2} />}
          />
        )}
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
  scroll: { paddingHorizontal: spacing[3], paddingTop: spacing[4], paddingBottom: spacing[3], gap: spacing[3] },
  hero: { alignItems: 'center', gap: spacing[1.5] },
  checkIcon: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: colors.success + '22', borderWidth: 1, borderColor: colors.success + '44',
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: {
    fontFamily: typography.fontFamily.display, fontSize: typography.fontSize['2xl'],
    color: colors.textPrimary, letterSpacing: typography.letterSpacing.tight,
  },
  heroSub: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.base,
    color: colors.textSecondary, textAlign: 'center',
  },
  bigStat: { alignItems: 'center' },
  bigStatValue: {
    fontFamily: typography.fontFamily.display, fontSize: typography.fontSize['5xl'],
    color: colors.textPrimary, letterSpacing: -4,
  },
  bigStatUnit: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.md,
    color: colors.textSecondary, marginTop: -4,
  },
  prBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[1],
    backgroundColor: colors.premium + '1A',
    borderWidth: 1, borderColor: colors.premium + '44',
    borderRadius: radius.lg, paddingVertical: spacing[1.5], paddingHorizontal: spacing[2],
  },
  prBannerText: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm,
    color: colors.textPrimary, flexShrink: 1,
  },
  milestoneBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[1],
    backgroundColor: colors.brandPrimary + '14',
    borderWidth: 1, borderColor: colors.brandPrimary + '44',
    borderRadius: radius.lg, paddingVertical: spacing[1.5], paddingHorizontal: spacing[2],
  },
  milestoneBannerText: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm,
    color: colors.textPrimary, flexShrink: 1,
  },
  statsGrid: {
    flexDirection: 'row', backgroundColor: colors.bgCard,
    borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderSubtle,
    ...shadows.sm,
  },
  statCell: { flex: 1, alignItems: 'center', paddingVertical: spacing[2] },
  statCellBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.borderSubtle },
  statLabel: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.xs,
    color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider, marginBottom: 6,
  },
  statValue: {
    fontFamily: typography.fontFamily.sansBold, fontSize: typography.fontSize.base, color: colors.textPrimary,
  },
  weekCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderSubtle, padding: spacing[2], gap: spacing[1.5],
  },
  weekCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weekCardTitle: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.base, color: colors.textPrimary,
  },
  weekCardCount: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.sm, color: colors.textSecondary,
  },
  sessionDots: { flexDirection: 'row', gap: spacing[1] },
  dot: {
    flex: 1, height: 6, borderRadius: radius.full, backgroundColor: colors.borderDefault,
  },
  dotDone: { backgroundColor: colors.success },
  weekDoneBanner: {
    backgroundColor: colors.success + '22', borderRadius: radius.md,
    padding: spacing[1], borderWidth: 1, borderColor: colors.success + '44',
  },
  weekDoneText: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm,
    color: colors.success, textAlign: 'center',
  },
  coachCard: {
    backgroundColor: colors.bgSurface, borderRadius: radius.lg,
    padding: spacing[2], borderWidth: 1, borderColor: colors.borderSubtle, gap: 6,
  },
  coachLabel: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.xs,
    color: colors.brandPrimary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.widest,
  },
  coachText: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.base,
    color: colors.textSecondary, lineHeight: typography.fontSize.base * typography.lineHeight.relaxed,
    fontStyle: 'italic',
  },
  footer: { paddingHorizontal: spacing[3], paddingBottom: spacing[3], paddingTop: spacing[2], gap: spacing[1] },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[1], paddingVertical: spacing[1.5],
    borderRadius: radius.xl, borderWidth: 1,
    borderColor: colors.brandPrimary + '55',
    backgroundColor: colors.brandPrimary + '11',
  },
  shareBtnText: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.base,
    color: colors.brandPrimary,
  },
});
