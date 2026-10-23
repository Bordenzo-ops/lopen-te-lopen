/**
 * Racepagina: countdown, parcoursinfo, doeltijd -> startvak-advies en een
 * koppeling naar het wedstrijdschema. Werkt voor elke race in de racedata; de
 * extra uitwerking (parcours, startvakken) komt uit src/data/raceDetails.ts.
 */

import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Linking, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, MapPin, Calendar, Share2, ExternalLink, Timer, Route } from 'lucide-react-native';
import { typography, spacing, radius, type ThemeColors } from '../../src/theme/tokens';
import { useThemeColors } from '../../src/theme/useTheme';
import { useAppStore } from '../../src/store/appStore';
import { usePremium } from '../../src/hooks/usePremium';
import { isRaceDistanceFree } from '../../src/config/premiumConfig';
import { getRaceById, formatRaceDate } from '../../src/data/rotterdamRaces';
import { buildRacePlan, canTrainForRace } from '../../src/data/buildRacePlan';
import {
  getRaceDetails, raceCountdown, countdownText, startWaveForTime,
} from '../../src/data/raceDetails';
import {
  parseTimeToSeconds, formatDuration, formatPacePerKm, racePaceSecPerKm, raceDistanceToKm,
} from '../../src/data/paceModel';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { ShareCountdownSheet } from '../../src/components/ui/ShareCountdownSheet';

export default function RaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const race = id ? getRaceById(String(id)) : undefined;

  const profile              = useAppStore(s => s.profile);
  const racePlan             = useAppStore(s => s.racePlan);
  const raceTargetSeconds    = useAppStore(s => s.raceTargetSeconds);
  const setRacePlan          = useAppStore(s => s.setRacePlan);
  const setSchemaMode        = useAppStore(s => s.setSchemaMode);
  const updateProfile        = useAppStore(s => s.updateProfile);
  const { hasAccess, promptUpgrade } = usePremium();

  const isGoalRace = !!race && racePlan?.race.id === race.id;
  const [timeInput, setTimeInput] = useState(
    isGoalRace && raceTargetSeconds ? formatDuration(raceTargetSeconds) : '',
  );
  const [showShare, setShowShare] = useState(false);

  if (!race) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topRow}>
          <BackButton color={colors.textSecondary} />
        </View>
        <View style={styles.notFound}>
          <Text style={styles.notFoundTitle}>Race niet gevonden</Text>
          <Text style={styles.notFoundText}>
            Deze wedstrijd staat niet meer in de lijst. Kies een andere race.
          </Text>
          <Button label="Naar de wedstrijden" onPress={() => router.replace('/(tabs)/races')} size="sm" />
        </View>
      </SafeAreaView>
    );
  }

  const details = getRaceDetails(race.id);
  const countdown = raceCountdown(race.date);
  const raceKm = raceDistanceToKm(race.distance);

  // Doeltijd: gebruikers kunnen hier vrij proberen; de ingevoerde tijd wordt
  // niet opgeslagen (het doel instellen gaat via de racekeuze).
  const targetSeconds = parseTimeToSeconds(timeInput);
  const paceSecPerKm = targetSeconds ? racePaceSecPerKm(targetSeconds, raceKm) : null;
  const wave = details?.startAdvice && targetSeconds
    ? startWaveForTime(details.startAdvice, targetSeconds)
    : null;

  function handleSchedule() {
    if (!race) return;
    if (isGoalRace) {
      router.push('/(tabs)/schedule');
      return;
    }
    // Zelfde regel als de racekiezer: alle afstanden zijn nu gratis
    // (FREE_RACE_DISTANCES); deze tak is voor als dat ooit verandert.
    if (!hasAccess && !isRaceDistanceFree(race.distance)) {
      promptUpgrade(
        'Premium-wedstrijd',
        'Deze afstand hoort bij premium. Met premium train je voor elke wedstrijd, met een schema op je eigen doeltijd.',
      );
      return;
    }
    const plan = buildRacePlan(race);
    if (!plan) {
      const { reason } = canTrainForRace(race);
      Alert.alert(
        'Te laat om te starten',
        reason ?? 'De wedstrijd is te dichtbij voor een volwaardig schema.',
        [{ text: 'Begrepen', style: 'cancel' }],
      );
      return;
    }
    setRacePlan(plan);
    setSchemaMode('race');
    updateProfile({ goal: plan.goal });
    router.push('/(tabs)/schedule');
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <BackButton color={colors.textSecondary} />
        </View>

        {/* Kop */}
        <View style={styles.header}>
          <Text style={styles.title}>{race.name}</Text>
          <View style={styles.metaRow}>
            <Calendar size={14} color={colors.textTertiary} strokeWidth={2} />
            <Text style={styles.metaText}>{formatRaceDate(race.date)}</Text>
          </View>
          <View style={styles.metaRow}>
            <MapPin size={14} color={colors.textTertiary} strokeWidth={2} />
            <Text style={styles.metaText}>{race.location}</Text>
          </View>
        </View>

        {/* Countdown */}
        <Card variant="highlighted" padding="lg" style={styles.countdownCard}>
          {countdown.isPast || countdown.isToday ? (
            <Text style={styles.countdownDone}>{countdownText(countdown)}</Text>
          ) : (
            <View style={styles.countdownRow}>
              <CountdownUnit value={countdown.weeks} unit={countdown.weeks === 1 ? 'week' : 'weken'} styles={styles} />
              <CountdownUnit value={countdown.days} unit={countdown.days === 1 ? 'dag' : 'dagen'} styles={styles} />
            </View>
          )}
          {!countdown.isPast && !countdown.isToday && (
            <Text style={styles.countdownSub}>tot de start</Text>
          )}
          {!countdown.isPast && (
            <Button
              label="Deel je countdown"
              onPress={() => setShowShare(true)}
              variant="secondary"
              size="sm"
              icon={<Share2 size={16} color={colors.textPrimary} strokeWidth={2} />}
            />
          )}
        </Card>

        {/* Parcours */}
        <Card padding="lg" style={styles.section}>
          <View style={styles.sectionHeader}>
            <Route size={18} color={colors.brandPrimary} strokeWidth={2} />
            <Text style={styles.sectionTitle}>Parcours</Text>
          </View>
          <Text style={styles.body}>{race.description}</Text>
          {details?.courseFacts.map(f => (
            <View key={f.label} style={styles.factRow}>
              <Text style={styles.factLabel}>{f.label}</Text>
              <Text style={styles.factValue}>{f.value}</Text>
            </View>
          ))}
          {details?.courseHighlights.map(line => (
            <Text key={line} style={styles.bullet}>{'•'}  {line}</Text>
          ))}
          {race.url ? (
            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => Linking.openURL(race.url as string)}
              accessibilityRole="link"
              accessibilityLabel="Open de website van de organisatie"
            >
              <ExternalLink size={14} color={colors.brandPrimary} strokeWidth={2} />
              <Text style={styles.linkText}>Website van de organisatie</Text>
            </TouchableOpacity>
          ) : null}
        </Card>

        {/* Doeltijd en startvak */}
        {details?.startAdvice && (
          <Card padding="lg" style={styles.section}>
            <View style={styles.sectionHeader}>
              <Timer size={18} color={colors.brandPrimary} strokeWidth={2} />
              <Text style={styles.sectionTitle}>Doeltijd en startvak</Text>
            </View>
            <Text style={styles.body}>
              Vul je verwachte eindtijd in voor een indicatief startvak-advies.
            </Text>
            <TextInput
              style={styles.input}
              value={timeInput}
              onChangeText={setTimeInput}
              placeholder="Doeltijd, bijvoorbeeld 4:15:00"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numbers-and-punctuation"
              autoCorrect={false}
              accessibilityLabel="Doeltijd in uren, minuten en seconden"
            />
            {timeInput.trim() !== '' && !targetSeconds && (
              <Text style={styles.hintError}>Gebruik het formaat u:mm:ss, bijvoorbeeld 4:15:00.</Text>
            )}
            {targetSeconds && paceSecPerKm && wave && (
              <View style={styles.adviceBox}>
                <Text style={styles.adviceTitle}>{wave.label}</Text>
                <Text style={styles.adviceMeta}>
                  {formatDuration(targetSeconds)} komt neer op {formatPacePerKm(paceSecPerKm)}
                </Text>
                <Text style={styles.body}>{wave.hint}</Text>
              </View>
            )}
            <Text style={styles.disclaimer}>{details.startAdvice.note}</Text>
            {details.startAdvice.sourceUrl ? (
              <TouchableOpacity
                style={styles.linkRow}
                onPress={() => Linking.openURL(details.startAdvice!.sourceUrl as string)}
                accessibilityRole="link"
              >
                <ExternalLink size={14} color={colors.brandPrimary} strokeWidth={2} />
                <Text style={styles.linkText}>Officiële startvak-indeling</Text>
              </TouchableOpacity>
            ) : null}
          </Card>
        )}

        {/* Schema */}
        {!countdown.isPast && (
          <Button
            label={isGoalRace ? 'Bekijk je wedstrijdschema' : 'Train voor deze race'}
            onPress={handleSchedule}
            fullWidth
            size="lg"
          />
        )}
      </ScrollView>

      <ShareCountdownSheet
        visible={showShare}
        race={race}
        shortName={details?.shortName}
        runnerName={profile?.name}
        onClose={() => setShowShare(false)}
      />
    </SafeAreaView>
  );
}

function BackButton({ color }: { color: string }) {
  return (
    <TouchableOpacity
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'))}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Terug"
    >
      <ChevronLeft size={26} color={color} strokeWidth={2} />
    </TouchableOpacity>
  );
}

function CountdownUnit({
  value, unit, styles,
}: { value: number; unit: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.countdownUnit}>
      <Text style={styles.countdownValue}>{value}</Text>
      <Text style={styles.countdownUnitLabel}>{unit}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  scroll: { padding: spacing[3], paddingBottom: spacing[6], gap: spacing[2] },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[1] },

  header: { gap: 6 },
  title: {
    fontFamily: typography.fontFamily.sansBold, fontSize: typography.fontSize['2xl'],
    color: colors.textPrimary,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm,
    color: colors.textSecondary, flexShrink: 1,
  },

  countdownCard: { alignItems: 'center', gap: spacing[1.5] },
  countdownRow: { flexDirection: 'row', gap: spacing[4], justifyContent: 'center' },
  countdownUnit: { alignItems: 'center' },
  countdownValue: {
    fontFamily: typography.fontFamily.display, fontSize: typography.fontSize['5xl'],
    color: colors.brandPrimary,
  },
  countdownUnitLabel: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.xs,
    color: colors.textSecondary, textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wider,
  },
  countdownSub: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  countdownDone: {
    fontFamily: typography.fontFamily.sansBold, fontSize: typography.fontSize.xl,
    color: colors.textPrimary, textAlign: 'center',
  },

  section: { gap: spacing[1.5] },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  sectionTitle: {
    fontFamily: typography.fontFamily.sansBold, fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  body: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.base,
    color: colors.textSecondary, lineHeight: 22,
  },
  factRow: {
    flexDirection: 'row', justifyContent: 'space-between', gap: spacing[2],
    paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.borderSubtle,
  },
  factLabel: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
  },
  factValue: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm,
    color: colors.textPrimary, flexShrink: 1, textAlign: 'right',
  },
  bullet: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm,
    color: colors.textSecondary, lineHeight: 20,
  },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36 },
  linkText: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm,
    color: colors.brandPrimary,
  },

  input: {
    borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.lg,
    backgroundColor: colors.bgSurface, color: colors.textPrimary,
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.base,
    paddingHorizontal: spacing[2], paddingVertical: spacing[1.5],
  },
  hintError: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
  },
  adviceBox: {
    gap: 4, padding: spacing[2], borderRadius: radius.lg,
    backgroundColor: colors.brandPrimary + '14',
    borderWidth: 1, borderColor: colors.brandPrimary + '33',
  },
  adviceTitle: {
    fontFamily: typography.fontFamily.sansBold, fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
  },
  adviceMeta: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.sm,
    color: colors.brandLight,
  },
  disclaimer: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs,
    color: colors.textTertiary, lineHeight: 16,
  },

  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[2], padding: spacing[3] },
  notFoundTitle: {
    fontFamily: typography.fontFamily.sansBold, fontSize: typography.fontSize.xl,
    color: colors.textPrimary,
  },
  notFoundText: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.base,
    color: colors.textSecondary, textAlign: 'center',
  },
});
