import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle2, Home, Share2, Trophy, Sparkles, FileDown, Zap, Crown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { typography, spacing, radius, shadows, type ThemeColors } from '../../src/theme/tokens';
import { useThemeColors } from '../../src/theme/useTheme';
import { useAppStore } from '../../src/store/appStore';
import { zoneInfo } from '../../src/data/trainingPlans';
import type { TrainingWeek } from '../../src/data/trainingPlans';
import { resolveActivePlan } from '../../src/data/activePlan';
import { selectTotalKm, selectShowRunUpsell } from '../../src/store/appStore';
import type { KmSplit } from '../../src/store/appStore';
import { detectPersonalRecords, detectCumulativeMilestone } from '../../src/data/achievements';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { ZoneBadge } from '../../src/components/ui/ZoneBadge';
import { ShareRunSheet } from '../../src/components/ui/ShareRunSheet';
import { exportSessionAsGpx } from '../../src/services/exportService';
import { maybeAskForReview } from '../../src/services/reviewService';
import { usePremium } from '../../src/hooks/usePremium';
import { ScaleIn } from '../../src/components/motion/ScaleIn';
import { FadeSlideIn } from '../../src/components/motion/FadeSlideIn';
import { CountUpText } from '../../src/components/motion/CountUpText';

export default function SummaryScreen() {
  const { distanceKm, durationSeconds, avgPace, sessionId, weekNumber, splits: splitsParam } =
    useLocalSearchParams<{
      distanceKm: string;
      durationSeconds: string;
      avgPace: string;
      sessionId: string;
      weekNumber: string;
      splits?: string;
    }>();

  const profile           = useAppStore(s => s.profile);
  const racePlan          = useAppStore(s => s.racePlan);
  const customPlan        = useAppStore(s => s.customPlan);
  const schemaMode        = useAppStore(s => s.schemaMode);
  const completedSessions = useAppStore(s => s.completedSessions);
  const [showShare, setShowShare] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const completedInWeek = useAppStore(s =>
    s.completedSessions.filter(c => c.weekNumber === parseInt(weekNumber ?? '1')).length
  );
  const { hasAccess } = usePremium();
  // Maximaal 1x per 3 voltooide runs: niet opdringerig, wel regelmatig zichtbaar.
  // De hook wordt altijd aangeroepen (rules of hooks); de combinatie met
  // hasAccess gebeurt pas daarna.
  const isRunUpsellTurn = useAppStore(selectShowRunUpsell);
  const showRunUpsell = !hasAccess && isRunUpsellTurn;
  const lastReviewPromptAt    = useAppStore(s => s.lastReviewPromptAt);
  const setLastReviewPromptAt = useAppStore(s => s.setLastReviewPromptAt);
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // In-app reviewvraag, 2 seconden na het renderen van een succesvolle
  // samenvatting zodat het trotsmoment eerst landt. Niet combineren met de
  // premium-upsellkaart hierboven: die krijgt dan voorrang en de reviewvraag
  // verschijnt gewoon een andere keer. De hook staat bewust vóór de
  // "!profile"-guard hieronder (rules of hooks) en herleidt de sessie-info
  // daarom zelf, in plaats van de later in dit bestand berekende `session`/
  // `km` te hergebruiken.
  useEffect(() => {
    if (!profile) return;
    if (showRunUpsell) return;

    const weekNumForReview = parseInt(weekNumber ?? '1');
    const planForReview = resolveActivePlan({ schemaMode, racePlan, customPlan, goal: profile.goal }).weeks;
    const sessionForReview = planForReview
      .find(w => w.weekNumber === weekNumForReview)
      ?.sessions.find(s => s.id === sessionId);
    const kmForReview = parseFloat(distanceKm ?? '0');
    const sessionWasComplete = sessionForReview ? kmForReview >= sessionForReview.distanceKm : true;

    const timer = setTimeout(() => {
      void maybeAskForReview({
        totalCompletedSessions: completedSessions.length,
        sessionWasComplete,
        lastReviewPromptAt,
        onPromptShown: () => setLastReviewPromptAt(new Date().toISOString()),
      });
    }, 2000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Eenmalige, lichte haptic bij een persoonlijk record, zelfde patroon als
  // de km-splits in session/active.tsx (geen platform-guard nodig, expo-haptics
  // is daar zelf al veilig in). Deze hook herleidt de PR-status zelf en staat
  // bewust vóór de "!profile"-guard hieronder (rules of hooks), net als de
  // reviewvraag hierboven.
  useEffect(() => {
    const lastCompleted = completedSessions[completedSessions.length - 1];
    if (!lastCompleted) return;
    const record = detectPersonalRecords(lastCompleted, completedSessions.slice(0, -1));
    if (record.longestRun || record.fastestPace) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!profile) return null;

  const lastSession = completedSessions[completedSessions.length - 1];

  // Km-splits: bij voorkeur uit de opgeslagen sessie (werkt ook na een herstart
  // van de app), anders uit de route-param direct na het afronden van de run.
  let splits: KmSplit[] = lastSession?.splits ?? [];
  if (splits.length === 0 && splitsParam) {
    try {
      const parsed = JSON.parse(splitsParam);
      if (Array.isArray(parsed)) splits = parsed;
    } catch (_) {
      // Ongeldige of ontbrekende splits-data: gewoon geen splits tonen
    }
  }
  const slowestSplitSeconds = splits.length > 0 ? Math.max(...splits.map(s => s.seconds)) : 0;
  const fastestSplitSeconds = splits.length > 0 ? Math.min(...splits.map(s => s.seconds)) : 0;

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

  // Zoek week en sessie op in het juiste plan (sjabloon, vrij schema of race)
  const weekNum = parseInt(weekNumber ?? '1');
  const activePlan = resolveActivePlan({ schemaMode, racePlan, customPlan, goal: profile.goal });
  const resolveWeek = (): TrainingWeek | undefined =>
    activePlan.weeks.find(w => w.weekNumber === weekNum);

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

  // Splittijd in mm:ss, voor de km-splits-lijst
  const formatSplitTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  // GPX-export is alleen zinvol met een route van minimaal 2 punten
  const hasRoute = (lastSession?.route?.length ?? 0) >= 2;

  const handleExportGpx = async () => {
    if (!lastSession || isExporting) return;
    setIsExporting(true);
    try {
      const result = await exportSessionAsGpx(lastSession);
      if (!result.success) {
        const message =
          result.error === 'delen_niet_beschikbaar'
            ? 'Delen is op dit toestel niet beschikbaar.'
            : result.error === 'geen_route'
            ? 'Deze training heeft geen route om te exporteren.'
            : 'Er ging iets mis bij het exporteren.';
        Alert.alert('Exporteren mislukt', message);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const totalInWeek = week?.sessions.length ?? 3;
  const weekDone = completedInWeek >= totalInWeek;

  // Controleer of het hele schema nu klaar is
  const totalWeeks = activePlan.totalWeeks;
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
          <ScaleIn style={styles.checkIcon}>
            <CheckCircle2 size={48} color={colors.success} strokeWidth={1.5} />
          </ScaleIn>
          <Text style={styles.heroTitle}>Sessie voltooid</Text>
          <Text style={styles.heroSub}>{getMessage()}</Text>
        </View>

        {/* Grote afstand */}
        <View style={styles.bigStat}>
          <CountUpText value={km} format={(n) => n.toFixed(2)} textStyle={styles.bigStatValue} />
          <Text style={styles.bigStatUnit}>kilometer</Text>
        </View>

        {/* Persoonlijk record */}
        {prText && (
          <FadeSlideIn style={styles.prBanner}>
            <Trophy size={18} color={colors.premium} strokeWidth={2} />
            <Text style={styles.prBannerText}>{prText}</Text>
          </FadeSlideIn>
        )}

        {/* Vroeg mijlpaal-moment: eerste training of 5/10 km cumulatief */}
        {milestoneText && (
          <FadeSlideIn style={styles.milestoneBanner} delay={prText ? 90 : 0}>
            <Sparkles size={18} color={colors.brandPrimary} strokeWidth={2} />
            <Text style={styles.milestoneBannerText}>{milestoneText}</Text>
          </FadeSlideIn>
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

        {/* Km-splits, in Strava-stijl: per km de tijd met een balkje relatief
            aan de langzaamste km, en de snelste km uitgelicht */}
        {splits.length > 0 && (
          <View style={styles.splitsCard}>
            <Text style={styles.splitsTitle}>Splits per kilometer</Text>
            <View style={styles.splitsList}>
              {splits.map(split => {
                const isFastest = split.seconds === fastestSplitSeconds && splits.length > 1;
                const barPct = slowestSplitSeconds > 0
                  ? Math.max(8, (split.seconds / slowestSplitSeconds) * 100)
                  : 0;
                return (
                  <View key={split.km} style={styles.splitRow}>
                    <Text style={[styles.splitKm, isFastest && styles.splitKmFastest]}>
                      {split.km}
                    </Text>
                    <View style={styles.splitBarTrack}>
                      <View
                        style={[
                          styles.splitBarFill,
                          { width: `${barPct}%` },
                          isFastest && styles.splitBarFillFastest,
                        ]}
                      />
                    </View>
                    <View style={styles.splitTimeRow}>
                      <Text style={[styles.splitTime, isFastest && styles.splitTimeFastest]}>
                        {formatSplitTime(split.seconds)}
                      </Text>
                      {isFastest && <Zap size={12} color={colors.success} strokeWidth={2.5} />}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

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

        {/* Contextuele premium-upsell na de run, alleen voor gratis gebruikers
            en hooguit eens per 3 voltooide runs, zodat het niet opdringerig wordt. */}
        {showRunUpsell && (
          <Card variant="surface" padding="lg" style={styles.upsellCard}>
            <View style={styles.upsellHeader}>
              <Crown size={20} color={colors.premium} strokeWidth={2} />
              <Text style={styles.upsellTitle}>Haal meer uit je volgende run</Text>
            </View>
            <Text style={styles.upsellText}>
              Probeer premium 14 dagen gratis: stemcoaching, onbeperkt routes plannen en
              tempo-advies op jouw doeltijd.
            </Text>
            <Button
              label="Probeer gratis"
              onPress={() => router.push('/paywall')}
              size="md"
              style={styles.upsellButton}
            />
          </Card>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.secondaryBtnRow}>
          <TouchableOpacity
            style={[styles.shareBtn, hasRoute && styles.secondaryBtnHalf]}
            onPress={() => setShowShare(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Deel je run"
          >
            <Share2 size={18} color={colors.brandPrimary} strokeWidth={2} />
            <Text style={styles.shareBtnText} numberOfLines={1} adjustsFontSizeToFit>Deel je run</Text>
          </TouchableOpacity>
          {hasRoute && (
            <TouchableOpacity
              style={[styles.shareBtn, styles.secondaryBtnHalf]}
              onPress={handleExportGpx}
              activeOpacity={0.8}
              disabled={isExporting}
              accessibilityRole="button"
              accessibilityLabel="Exporteer als GPX"
            >
              <FileDown size={18} color={colors.brandPrimary} strokeWidth={2} />
              <Text style={styles.shareBtnText} numberOfLines={1} adjustsFontSizeToFit>
                {isExporting ? 'Bezig...' : 'Exporteer als GPX'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
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
  splitsCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderSubtle, padding: spacing[2], gap: spacing[1.5],
  },
  splitsTitle: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.base, color: colors.textPrimary,
  },
  splitsList: { gap: spacing[1] },
  splitRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1.5],
  },
  splitKm: {
    width: 22,
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm,
    color: colors.textSecondary, textAlign: 'right',
  },
  splitKmFastest: { color: colors.success },
  splitBarTrack: {
    flex: 1, height: 8, borderRadius: radius.full,
    backgroundColor: colors.bgSurface, overflow: 'hidden',
  },
  splitBarFill: {
    height: '100%', borderRadius: radius.full,
    backgroundColor: colors.brandPrimary,
  },
  splitBarFillFastest: { backgroundColor: colors.success },
  splitTimeRow: {
    width: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4,
  },
  splitTime: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm,
    color: colors.textPrimary, fontVariant: ['tabular-nums'],
  },
  splitTimeFastest: { color: colors.success },
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
  upsellCard: {
    gap: spacing[1.5],
    borderWidth: 1,
    borderColor: colors.premium + '44',
  },
  upsellHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
  },
  upsellTitle: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.base,
    color: colors.textPrimary, flexShrink: 1,
  },
  upsellText: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm,
    color: colors.textSecondary, lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
  },
  upsellButton: {
    marginTop: spacing[0.5],
  },
  footer: { paddingHorizontal: spacing[3], paddingBottom: spacing[3], paddingTop: spacing[2], gap: spacing[1] },
  secondaryBtnRow: { flexDirection: 'row', gap: spacing[1] },
  shareBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[1], paddingVertical: spacing[1.5],
    borderRadius: radius.xl, borderWidth: 1,
    borderColor: colors.brandPrimary + '55',
    backgroundColor: colors.brandPrimary + '11',
  },
  secondaryBtnHalf: { flex: 1 },
  shareBtnText: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.base,
    color: colors.brandPrimary,
  },
});
