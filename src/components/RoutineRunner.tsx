/**
 * RoutineRunner
 *
 * Gedeelde stap-voor-stap-uitvoering voor de losstaande warming-up- en
 * cooling-down-routine (CP3, zie Elevenlabs-creditplan-aug-2026.md). Los van
 * een geplande sessie en los van app/session/active.tsx — de gebruiker start
 * dit via een eigen knop op het dashboard, niet gekoppeld aan GPS/timer/
 * intervalcoaching.
 *
 * Flow: intro (uitleg, geen timer) → stappen 0..N-1 (elk met een eigen
 * countdown, auto-door naar de volgende zodra de tijd om is) → done (afronding,
 * geen timer). Elke stap spreekt zijn tekst via voiceService.speakPhrases als
 * gesproken begeleiding aan staat (profile.voiceGuidance) — staat dat uit, dan
 * blijft de routine gewoon werken met alleen de schermtekst en de timer.
 * Altijd volledig overslaanbaar via de sluitknop, op elk moment.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { typography, spacing, radius, type ThemeColors } from '../theme/tokens';
import { useThemeColors } from '../theme/useTheme';
import { Button } from './ui/Button';
import { useAppStore } from '../store/appStore';
import * as voiceService from '../services/voiceService';
import {
  warmupUtterance,
  cooldownRoutineUtterance,
  WU_STEP_COUNT,
  CD_STEP_COUNT,
  type PhraseUtterance,
} from '../config/voicePhrases';
import { WARMUP_STEP_DURATIONS_SEC, COOLDOWN_STEP_DURATIONS_SEC } from '../data/warmupCooldown';

type Mode = 'warmup' | 'cooldown';

const MODE_CONFIG: Record<Mode, {
  title: string;
  stepCount: number;
  durations: number[];
  utterance: (step: 'intro' | number | 'done') => PhraseUtterance;
}> = {
  warmup: {
    title: 'Warming-up',
    stepCount: WU_STEP_COUNT,
    durations: WARMUP_STEP_DURATIONS_SEC,
    utterance: warmupUtterance,
  },
  cooldown: {
    title: 'Cooling-down',
    stepCount: CD_STEP_COUNT,
    durations: COOLDOWN_STEP_DURATIONS_SEC,
    utterance: cooldownRoutineUtterance,
  },
};

export function RoutineRunner({ mode }: { mode: Mode }) {
  const config = MODE_CONFIG[mode];
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const profile = useAppStore(s => s.profile);
  const voiceEnabled = profile?.voiceGuidance ?? false;
  const voiceType = profile?.voiceType ?? 'female';

  // Houdt het scherm aan tijdens de routine, net als tijdens een actieve run.
  useKeepAwake();

  // -1 = intro, 0..stepCount-1 = stappen, stepCount = done.
  const [phase, setPhase] = useState(-1);
  const [remainingSec, setRemainingSec] = useState(0);

  const isStep = phase >= 0 && phase < config.stepCount;
  const isDone = phase === config.stepCount;

  // Spreekt de tekst bij elke fasewissel (intro/stap/done). Stopt bij het
  // verlaten van het scherm, net als active.tsx dat doet voor zijn spraak.
  useEffect(() => {
    if (!voiceEnabled) return;
    const step: 'intro' | number | 'done' = phase === -1 ? 'intro' : isDone ? 'done' : phase;
    void voiceService.speakPhrases(config.utterance(step), voiceType);
  }, [phase, voiceEnabled, voiceType, config, isDone]);

  useEffect(() => {
    return () => {
      voiceService.stop();
    };
  }, []);

  // Countdown-timer, alleen actief tijdens een stap (niet bij intro/done).
  // Telt terug naar 0 en gaat dan automatisch naar de volgende stap/done.
  useEffect(() => {
    if (!isStep) return;
    setRemainingSec(config.durations[phase] ?? 0);

    const interval = setInterval(() => {
      setRemainingSec(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setPhase(p => p + 1);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isStep]);

  const goNext = useCallback(() => {
    setPhase(p => Math.min(config.stepCount, p + 1));
  }, [config.stepCount]);

  const goPrev = useCallback(() => {
    setPhase(p => Math.max(-1, p - 1));
  }, []);

  const finish = useCallback(() => {
    voiceService.stop();
    router.back();
  }, []);

  const stepText = isStep
    ? config.utterance(phase).fallbackText
    : phase === -1
      ? config.utterance('intro').fallbackText
      : config.utterance('done').fallbackText;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{config.title}</Text>
        <Button
          label=""
          onPress={finish}
          variant="ghost"
          size="sm"
          icon={<X size={22} color={colors.textSecondary} strokeWidth={2.5} />}
          style={styles.closeBtn}
        />
      </View>

      <View style={styles.content}>
        {isStep && (
          <Text style={styles.stepCounter}>Stap {phase + 1} van {config.stepCount}</Text>
        )}

        <View style={styles.card}>
          <Text style={styles.stepText}>{stepText}</Text>
        </View>

        {isStep && (
          <View style={styles.timerWrap}>
            <Text style={styles.timerText}>{remainingSec}s</Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${config.durations[phase]
                      ? Math.max(0, Math.min(100, (1 - remainingSec / config.durations[phase]) * 100))
                      : 100}%`,
                  },
                ]}
              />
            </View>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        {isStep && (
          <View style={styles.navRow}>
            <Button
              label=""
              onPress={goPrev}
              variant="secondary"
              size="md"
              icon={<ChevronLeft size={20} color={colors.textPrimary} strokeWidth={2.5} />}
              style={styles.navBtn}
            />
            <Button
              label="Volgende"
              onPress={goNext}
              variant="secondary"
              size="md"
              fullWidth
              icon={<ChevronRight size={18} color={colors.textPrimary} strokeWidth={2.5} />}
            />
          </View>
        )}

        {phase === -1 && (
          <Button label="Beginnen" onPress={goNext} fullWidth size="lg" />
        )}

        {isDone && (
          <Button label="Klaar" onPress={finish} fullWidth size="lg" />
        )}

        {!isDone && (
          <Button label="Overslaan" onPress={finish} variant="ghost" size="sm" style={styles.skipBtn} />
        )}
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[3], paddingTop: spacing[1],
  },
  headerTitle: {
    fontFamily: typography.fontFamily.display, fontSize: typography.fontSize.xl,
    color: colors.textPrimary,
  },
  closeBtn: { minHeight: 44, paddingHorizontal: spacing[1] },
  content: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: spacing[3], gap: spacing[3],
  },
  stepCounter: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm,
    color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider,
  },
  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: spacing[4],
    borderWidth: 1, borderColor: colors.borderSubtle, width: '100%',
  },
  stepText: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.lg,
    color: colors.textPrimary, textAlign: 'center',
    lineHeight: typography.fontSize.lg * typography.lineHeight.relaxed,
  },
  timerWrap: { width: '100%', alignItems: 'center', gap: spacing[1] },
  timerText: {
    fontFamily: typography.fontFamily.display, fontSize: typography.fontSize['3xl'],
    color: colors.brandPrimary,
  },
  progressTrack: {
    width: '100%', height: 6, borderRadius: radius.full,
    backgroundColor: colors.bgSurface, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', borderRadius: radius.full, backgroundColor: colors.brandPrimary,
  },
  footer: { paddingHorizontal: spacing[3], paddingBottom: spacing[2], gap: spacing[1.5] },
  navRow: { flexDirection: 'row', gap: spacing[1.5] },
  navBtn: { paddingHorizontal: spacing[2] },
  skipBtn: { alignSelf: 'center' },
});
