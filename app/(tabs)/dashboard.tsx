import React, { useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, useWindowDimensions, Alert } from 'react-native';
import { router } from 'expo-router';
import { retryStravaQueue } from '../../src/services/stravaService';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Play, TrendingUp, Flame, Timer, Award } from 'lucide-react-native';
import { typography, spacing, radius, type ThemeColors } from '../../src/theme/tokens';
import { useThemeColors } from '../../src/theme/useTheme';
import { useAppStore, selectWeeklyKm, selectIsSessionCompleted, selectTotalKm } from '../../src/store/appStore';
import { getTrainingPlan, remapWeekDays, DEFAULT_TRAINING_DAYS } from '../../src/data/trainingPlans';
import { SessionCard } from '../../src/components/ui/SessionCard';
import { StatRing } from '../../src/components/ui/StatRing';
import { Button } from '../../src/components/ui/Button';
import { useRacePace } from '../../src/hooks/useRacePace';
import { computeRunStats, computeMilestones } from '../../src/data/achievements';
import { formatPacePerKm } from '../../src/data/paceModel';

const goalLabel = {
  '5km': '5 KM',
  '10km': '10 KM',
  'half_marathon': 'Halve marathon',
  'marathon': 'Marathon',
};

export default function DashboardScreen() {
  const profile = useAppStore(s => s.profile);
  const currentWeek = useAppStore(s => s.currentWeek);
  const completedSessions = useAppStore(s => s.completedSessions);
  const skippedSessions = useAppStore(s => s.skippedSessions);
  const skipSession = useAppStore(s => s.skipSession);
  const totalKm = useAppStore(selectTotalKm);
  const racePlan   = useAppStore(s => s.racePlan);
  const schemaMode = useAppStore(s => s.schemaMode);
  const { paceForType } = useRacePace();
  const { width } = useWindowDimensions();
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Best-effort herhaalpoging voor mislukte Strava-uploads bij het openen
  // van het dashboard. Stil, blokkeert de UI nooit.
  useEffect(() => {
    void retryStravaQueue();
  }, []);

  if (!profile) return null;

  const fallbackPlan = getTrainingPlan(profile.goal);
  const useRace      = schemaMode === 'race' && !!racePlan;
  const activePlan   = useRace ? racePlan!.weeks : fallbackPlan.plan;
  const totalWeeks   = useRace ? racePlan!.totalWeeks : fallbackPlan.weeks;
  const planLabel    = useRace ? racePlan!.race.name : goalLabel[profile.goal];

  // Werkelijk totaal km van het schema (voor de voortgangsring)
  const planTotalKm = activePlan.reduce((sum, w) => sum + w.totalKm, 0);

  const trainingDays = profile.trainingDays ?? DEFAULT_TRAINING_DAYS;
  // Remap de getoonde week naar de zelfgekozen trainingsdagen. De sessie-id's
  // blijven gelijk, alleen het dagveld verandert, dus de voltooide-sessie-
  // matching blijft werken.
  const rawWeek = activePlan[currentWeek - 1];
  const week = rawWeek ? remapWeekDays(rawWeek, trainingDays) : rawWeek;
  const weekKm = completedSessions
    .filter(s => s.weekNumber === currentWeek)
    .reduce((sum, s) => sum + s.actualDistanceKm, 0);
  const weekProgress = week ? Math.min(100, (weekKm / week.totalKm) * 100) : 0;

  const nextSession = week?.sessions.find(
    s => !completedSessions.some(c => c.sessionId === s.id) &&
         !skippedSessions.some(sk => sk.sessionId === s.id),
  );

  // Sla de huidige sessie bewust over na een korte bevestiging. Geruststellende
  // toon: een keer overslaan is normaal en brengt het doel niet in gevaar.
  const handleSkip = () => {
    if (!nextSession || !week) return;
    Alert.alert(
      'Even geen training?',
      'Geen probleem, een mindere dag hoort erbij. We slaan deze training over en je schema loopt gewoon door.',
      [
        { text: 'Toch lopen', style: 'cancel' },
        {
          text: 'Sla over',
          onPress: () => skipSession(nextSession.id, currentWeek, week.sessions),
        },
      ],
    );
  };

  // Voortgang op basis van werkelijk voltooide trainingen, niet op de kalenderweek.
  // Zo duwt elke afgewerkte sessie de hoofdring zichtbaar vooruit, in lijn met de
  // inspanning van de gebruiker.
  const planSessionIds = activePlan.flatMap(w => w.sessions.map(s => s.id));
  const planTotalSessions = planSessionIds.length;
  const completedInPlan = completedSessions.filter(c => planSessionIds.includes(c.sessionId)).length;
  const overallProgress = planTotalSessions > 0
    ? Math.round((completedInPlan / planTotalSessions) * 100)
    : 0;

  // Ringgrootte schaalt mee met de schermbreedte zodat drie ringen ook op
  // smalle toestellen naast elkaar passen.
  const ringSize = Math.min(110, Math.floor((width - spacing[3] * 2 - spacing[2] * 2) / 3));

  // Persoonlijke mijlpalen en records, lokaal berekend uit de voltooide sessies.
  const stats = useMemo(() => computeRunStats(completedSessions), [completedSessions]);
  const milestones = useMemo(() => computeMilestones(stats), [stats]);
  const reachedMilestones = milestones.filter(m => m.reached);
  const nextMilestone = milestones.find(m => !m.reached);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              {getGreeting()}, {profile.name} 👋
            </Text>
            <Text style={styles.goal}>{planLabel} · week {currentWeek} van {totalWeeks}</Text>
          </View>
        </View>

        {/* Progress ring + week km */}
        <View style={styles.statsRow}>
          <View style={styles.ringCard}>
            <StatRing
              value={overallProgress}
              size={ringSize}
              color={colors.brandPrimary}
              label={`${overallProgress}%`}
              sublabel="schema"
            />
            <Text style={styles.ringLabel}>Voortgang</Text>
          </View>
          <View style={styles.ringCard}>
            <StatRing
              value={weekProgress}
              size={ringSize}
              color={colors.zone2}
              label={`${weekKm.toFixed(1)}`}
              sublabel={`van ${week?.totalKm ?? 0} km`}
            />
            <Text style={styles.ringLabel}>Deze week</Text>
          </View>
          <View style={styles.ringCard}>
            <StatRing
              value={planTotalKm > 0 ? Math.min(100, (totalKm / planTotalKm) * 100) : 0}
              size={ringSize}
              color={colors.info}
              label={`${totalKm.toFixed(0)}`}
              sublabel="km totaal"
            />
            <Text style={styles.ringLabel}>Totaal</Text>
          </View>
        </View>

        {/* Volgende sessie */}
        {nextSession ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Volgende sessie</Text>
            <SessionCard
              session={nextSession}
              variant="next"
              trainingPaceSecPerKm={paceForType(nextSession.type)}
              onPress={() =>
                router.push({
                  pathname: '/session/active',
                  params: {
                    sessionId: nextSession.id,
                    weekNumber: String(currentWeek),
                  },
                })
              }
            />
            <Button
              label={`Start ${nextSession.distanceKm} km`}
              onPress={() =>
                router.push({
                  pathname: '/session/active',
                  params: {
                    sessionId: nextSession.id,
                    weekNumber: String(currentWeek),
                  },
                })
              }
              fullWidth
              size="lg"
              icon={<Play size={18} color={colors.textInverse} strokeWidth={2.5} fill={colors.textInverse} />}
            />
            <TouchableOpacity
              onPress={handleSkip}
              style={styles.skipBtn}
              activeOpacity={0.7}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Niet fit vandaag? Sla deze training over"
            >
              <Text style={styles.skipBtnText}>Niet fit vandaag? Sla over</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.weekCompleteCard}>
            <Text style={styles.weekCompleteEmoji}>🎉</Text>
            <Text style={styles.weekCompleteTitle}>Week {currentWeek - 1} afgerond!</Text>
            <Text style={styles.weekCompleteSub}>
              {currentWeek <= totalWeeks
                ? `Goed werk. Week ${currentWeek} start ${getNextMondayLabel()}.`
                : 'Je hebt het hele schema afgerond. Gefeliciteerd!'}
            </Text>
          </View>
        )}

        {/* Sessies deze week */}
        {week && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Week {currentWeek} overzicht</Text>
            <View style={styles.sessionList}>
              {week.sessions.map(session => {
                const isCompleted = completedSessions.some(c => c.sessionId === session.id);
                const isSkipped = skippedSessions.some(sk => sk.sessionId === session.id);
                return (
                  <SessionCard
                    key={session.id}
                    session={session}
                    isCompleted={isCompleted}
                    isSkipped={isSkipped}
                    trainingPaceSecPerKm={paceForType(session.type)}
                    onPress={
                      !isCompleted && !isSkipped
                        ? () => router.push({
                            pathname: '/session/active',
                            params: { sessionId: session.id, weekNumber: String(currentWeek) },
                          })
                        : undefined
                    }
                  />
                );
              })}
            </View>
          </View>
        )}

        {/* Week focus */}
        {week && (
          <View style={styles.focusCard}>
            <View style={styles.focusHeader}>
              <Flame size={16} color={colors.brandPrimary} strokeWidth={2} />
              <Text style={styles.focusLabel}>Focus deze week</Text>
            </View>
            <Text style={styles.focusText}>{week.focus}</Text>
          </View>
        )}

        {/* Persoonlijke mijlpalen, alleen zodra er minstens één training gelopen is */}
        {stats.totalRuns >= 1 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Jouw mijlpalen</Text>
            <View style={styles.milestoneCard}>
              <View style={styles.prRow}>
                {stats.currentWeekStreak >= 2 && (
                  <View style={styles.prItem}>
                    <Flame size={18} color={colors.brandPrimary} strokeWidth={2} />
                    <Text style={styles.prValue}>{stats.currentWeekStreak}</Text>
                    <Text style={styles.prLabel}>weken op rij</Text>
                  </View>
                )}
                <View style={styles.prItem}>
                  <TrendingUp size={18} color={colors.zone2} strokeWidth={2} />
                  <Text style={styles.prValue}>{stats.longestRunKm.toFixed(1)}</Text>
                  <Text style={styles.prLabel}>langste (km)</Text>
                </View>
                {stats.bestPaceSecPerKm != null && (
                  <View style={styles.prItem}>
                    <Timer size={18} color={colors.info} strokeWidth={2} />
                    <Text style={styles.prValue}>{formatPacePerKm(stats.bestPaceSecPerKm)}</Text>
                    <Text style={styles.prLabel}>beste tempo</Text>
                  </View>
                )}
              </View>

              {reachedMilestones.length > 0 && (
                <View style={styles.badgeWrap}>
                  {reachedMilestones.map(m => (
                    <View key={m.id} style={styles.badge}>
                      <Award size={12} color={colors.brandPrimary} strokeWidth={2} />
                      <Text style={styles.badgeText}>{m.label}</Text>
                    </View>
                  ))}
                </View>
              )}

              {nextMilestone && (
                <Text style={styles.nextMilestone}>
                  Volgende mijlpaal: {nextMilestone.label}
                </Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function getNextMondayLabel(): string {
  const today = new Date();
  const dow   = today.getDay(); // 0=zo, 1=ma, ...
  const daysUntilMonday = dow === 1 ? 7 : (8 - dow) % 7 || 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() + daysUntilMonday);
  return monday.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Goedemorgen';
  if (h < 18) return 'Goedemiddag';
  return 'Goedenavond';
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  scroll: { paddingHorizontal: spacing[3], paddingTop: spacing[2], paddingBottom: spacing[6], gap: spacing[3] },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingTop: spacing[1],
  },
  greeting: {
    fontFamily: typography.fontFamily.display, fontSize: typography.fontSize['2xl'],
    color: colors.textPrimary, letterSpacing: typography.letterSpacing.tight,
  },
  goal: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.sm,
    color: colors.textSecondary, marginTop: 4,
  },
  statsRow: { flexDirection: 'row', gap: spacing[2], justifyContent: 'space-between' },
  ringCard: { flex: 1, alignItems: 'center', gap: 6 },
  ringLabel: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.xs,
    color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider,
  },
  skipBtn: {
    alignSelf: 'center',
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[2],
    minHeight: 44,
    justifyContent: 'center',
  },
  skipBtnText: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
  },
  section: { gap: spacing[1.5] },
  sectionTitle: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm,
    color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider,
  },
  sessionList: { gap: spacing[1] },
  weekCompleteCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: spacing[3],
    alignItems: 'center', gap: spacing[1], borderWidth: 1.5, borderColor: colors.success + '44',
  },
  weekCompleteEmoji: { fontSize: 40 },
  weekCompleteTitle: {
    fontFamily: typography.fontFamily.sansBold, fontSize: typography.fontSize.xl, color: colors.textPrimary,
  },
  weekCompleteSub: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.base,
    color: colors.textSecondary, textAlign: 'center',
  },
  focusCard: {
    backgroundColor: colors.bgSurface, borderRadius: radius.lg, padding: spacing[2],
    borderWidth: 1, borderColor: colors.borderSubtle, gap: 6,
  },
  focusHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  focusLabel: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm,
    color: colors.brandPrimary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider,
  },
  focusText: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.base,
    color: colors.textSecondary, fontStyle: 'italic',
  },

  // Mijlpalen
  milestoneCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: spacing[2],
    borderWidth: 1, borderColor: colors.borderSubtle, gap: spacing[1.5],
  },
  prRow: { flexDirection: 'row', justifyContent: 'space-around' },
  prItem: { alignItems: 'center', gap: 2, flex: 1 },
  prValue: {
    fontFamily: typography.fontFamily.display, fontSize: typography.fontSize.xl,
    color: colors.textPrimary, marginTop: 2,
  },
  prLabel: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.xs,
    color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wide,
    textAlign: 'center',
  },
  badgeWrap: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1],
    borderTopWidth: 1, borderTopColor: colors.borderSubtle, paddingTop: spacing[1.5],
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.brandPrimary + '14',
    borderWidth: 1, borderColor: colors.brandPrimary + '33',
    borderRadius: radius.full, paddingHorizontal: spacing[1], paddingVertical: 4,
  },
  badgeText: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.xs,
    color: colors.brandLight,
  },
  nextMilestone: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
});
