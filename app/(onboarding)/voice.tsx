import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Volume2, EyeOff, User, UserRound } from 'lucide-react-native';
import { typography, spacing, radius, type ThemeColors } from '../../src/theme/tokens';
import { useThemeColors } from '../../src/theme/useTheme';
import { Button } from '../../src/components/ui/Button';
import { useAppStore } from '../../src/store/appStore';
import * as voiceService from '../../src/services/voiceService';
import type { VoiceType } from '../../src/config/voiceConfig';
import type { GoalType } from '../../src/data/trainingPlans';
import { DEFAULT_TRAINING_DAYS } from '../../src/data/trainingPlans';
import { ROTTERDAM_RACES } from '../../src/data/rotterdamRaces';
import { buildRacePlan } from '../../src/data/buildRacePlan';
import { usePremium } from '../../src/hooks/usePremium';
import { PremiumBadge } from '../../src/components/ui/PremiumBadge';

export default function VoiceScreen() {
  const { goal, name, age, schemaMode, raceId, trainingDays } =
    useLocalSearchParams<{ goal: GoalType; name: string; age: string; schemaMode: string; raceId: string; trainingDays: string }>();
  const [voiceGuidance, setVoiceGuidance] = useState(true);
  const [voiceType, setVoiceType]         = useState<VoiceType>('female');
  const completeOnboarding = useAppStore(s => s.completeOnboarding);
  const setSchemaMode     = useAppStore(s => s.setSchemaMode);
  const setRacePlan       = useAppStore(s => s.setRacePlan);
  const { hasAccess, goToPaywall } = usePremium();
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Korte voorbeeldzin zodat de gebruiker de stem direct hoort
  const previewVoice = (type: VoiceType) => {
    setVoiceType(type);
    voiceService.speak('Hoi! Ik ben je hardloopcoach. Samen gaan we trainen.', type);
  };

  const handleStart = () => {
    voiceService.stop();

    // Trainingsdagen uit de onboarding-parameter teruglezen. Valt terug op de
    // standaarddagen bij ontbreken of een ongeldige waarde (geen 3 dagen).
    const parsedDays = (trainingDays ?? '')
      .split(',')
      .map(d => parseInt(d, 10))
      .filter(d => Number.isInteger(d) && d >= 1 && d <= 7);
    const chosenDays =
      parsedDays.length === 3 && new Set(parsedDays).size === 3
        ? parsedDays
        : DEFAULT_TRAINING_DAYS;

    completeOnboarding({
      name: name || 'Hardloper',
      goal: goal as GoalType,
      startDate: new Date().toISOString(),
      age: parseInt(age) || 30,
      maxHeartRate: 220 - (parseInt(age) || 30),
      voiceGuidance,
      voiceType,
      trainingDays: chosenDays,
    });

    const mode = schemaMode === 'race' ? 'race' : 'training';
    setSchemaMode(mode);

    // Als wedstrijdmodus: zoek de race op en bouw direct het plan
    if (mode === 'race' && raceId) {
      const race = ROTTERDAM_RACES.find(r => r.id === raceId);
      if (race) {
        const plan = buildRacePlan(race);
        if (plan) setRacePlan(plan);
      }
    }

    router.replace('/(tabs)/dashboard');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} hitSlop={8} accessibilityRole="button" accessibilityLabel="Terug">
          <ChevronLeft size={24} color={colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
        <View style={styles.progress}>
          {[1, 2, 3].map(i => (
            <View key={i} style={[styles.progressDot, i <= 3 && styles.progressDotActive]} />
          ))}
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.titleGroup}>
          <Text style={styles.step}>Stap 3 van 3</Text>
          <Text style={styles.title}>Hoe wil je begeleid worden?</Text>
          <Text style={styles.sub}>
            Wil je een stem die je begeleidt tijdens het lopen, of liever stilte met alles op het scherm?
          </Text>
        </View>

        <View style={styles.options}>
          <TouchableOpacity
            onPress={() => setVoiceGuidance(true)}
            activeOpacity={0.8}
            style={[styles.option, voiceGuidance && styles.optionSelected]}
            accessibilityRole="radio"
            accessibilityLabel="Gesproken begeleiding"
            accessibilityState={{ selected: voiceGuidance }}
          >
            <View style={[styles.optionIcon, { backgroundColor: '#34D399' + '22' }]}>
              <Volume2 size={28} color="#34D399" strokeWidth={1.5} />
            </View>
            <View style={styles.optionText}>
              <Text style={[styles.optionTitle, voiceGuidance && styles.optionTitleSelected]}>
                Gesproken begeleiding
              </Text>
              <Text style={styles.optionDesc}>
                Hartslagzone, kilometer-updates en aanmoedigingen.
              </Text>
            </View>
            <View style={[styles.radio, voiceGuidance && styles.radioSelected]}>
              {voiceGuidance && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setVoiceGuidance(false)}
            activeOpacity={0.8}
            style={[styles.option, !voiceGuidance && styles.optionSelected]}
            accessibilityRole="radio"
            accessibilityLabel="Alleen scherm"
            accessibilityState={{ selected: !voiceGuidance }}
          >
            <View style={[styles.optionIcon, { backgroundColor: '#60A5FA' + '22' }]}>
              <EyeOff size={28} color="#60A5FA" strokeWidth={1.5} />
            </View>
            <View style={styles.optionText}>
              <Text style={[styles.optionTitle, !voiceGuidance && styles.optionTitleSelected]}>
                Alleen scherm
              </Text>
              <Text style={styles.optionDesc}>
                Alle informatie op het scherm. Geen geluid, je eigen muziek draait door.
              </Text>
            </View>
            <View style={[styles.radio, !voiceGuidance && styles.radioSelected]}>
              {!voiceGuidance && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>
        </View>

        {/* Stemkeuze, alleen relevant bij gesproken begeleiding */}
        {voiceGuidance && (
          <View style={styles.voicePicker}>
            <Text style={styles.voicePickerLabel}>Welke stem wil je horen?</Text>
            <View style={styles.voicePickerRow}>
              <TouchableOpacity
                onPress={() => previewVoice('female')}
                activeOpacity={0.8}
                style={[styles.voiceBtn, voiceType === 'female' && styles.voiceBtnSelected]}
                accessibilityRole="radio"
                accessibilityLabel="Vrouwenstem"
                accessibilityState={{ selected: voiceType === 'female' }}
              >
                <View style={[styles.voiceBtnIcon, { backgroundColor: colors.brandLight + '22' }]}>
                  <UserRound size={18} color={colors.brandLight} strokeWidth={2} />
                </View>
                <Text style={[styles.voiceBtnLabel, voiceType === 'female' && styles.voiceBtnLabelSelected]}>
                  Vrouwenstem
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => previewVoice('male')}
                activeOpacity={0.8}
                style={[styles.voiceBtn, voiceType === 'male' && styles.voiceBtnSelected]}
                accessibilityRole="radio"
                accessibilityLabel="Mannenstem"
                accessibilityState={{ selected: voiceType === 'male' }}
              >
                <View style={[styles.voiceBtnIcon, { backgroundColor: colors.info + '22' }]}>
                  <User size={18} color={colors.info} strokeWidth={2} />
                </View>
                <Text style={[styles.voiceBtnLabel, voiceType === 'male' && styles.voiceBtnLabelSelected]}>
                  Mannenstem
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.voicePickerHint}>Tik op een stem om die te beluisteren.</Text>
            {!hasAccess && (
              <TouchableOpacity
                onPress={goToPaywall}
                activeOpacity={0.8}
                style={styles.premiumVoiceNote}
                accessibilityRole="button"
                accessibilityLabel="Premium-stemmen ontgrendelen"
              >
                <PremiumBadge />
                <Text style={styles.premiumVoiceText}>
                  Premium-stemmen klinken het meest natuurlijk. Gratis gebruik je de stem van je telefoon. Tik om premium te bekijken.
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <Text style={styles.note}>
          Je kunt dit altijd wijzigen in de instellingen.
        </Text>
      </View>

      <View style={styles.footer}>
        <Button label="Start mijn schema" onPress={handleStart} fullWidth size="lg" />
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[2], paddingVertical: spacing[1],
  },
  back: { padding: spacing[1] },
  progress: { flexDirection: 'row', gap: 6 },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.borderDefault },
  progressDotActive: { backgroundColor: colors.brandPrimary, width: 20 },
  content: {
    flex: 1, paddingHorizontal: spacing[3], paddingTop: spacing[3], gap: spacing[3],
  },
  titleGroup: { gap: spacing[1] },
  step: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.sm,
    color: colors.brandPrimary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.widest,
  },
  title: {
    fontFamily: typography.fontFamily.display, fontSize: typography.fontSize['2xl'],
    color: colors.textPrimary, letterSpacing: typography.letterSpacing.tight,
  },
  sub: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.base,
    color: colors.textSecondary, lineHeight: typography.fontSize.base * typography.lineHeight.relaxed,
  },
  options: { gap: spacing[1.5] },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1.5],
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    borderWidth: 1.5, borderColor: colors.borderSubtle, padding: spacing[2],
  },
  optionSelected: { borderColor: colors.brandPrimary, backgroundColor: colors.brandPrimary + '0D' },
  optionIcon: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  optionText: { flex: 1, gap: 4 },
  optionTitle: {
    fontFamily: typography.fontFamily.sansBold, fontSize: typography.fontSize.base, color: colors.textPrimary,
  },
  optionTitleSelected: { color: colors.brandLight },
  optionDesc: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm,
    color: colors.textSecondary, lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
  },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    borderColor: colors.borderDefault, alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.brandPrimary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brandPrimary },
  voicePicker: { gap: spacing[1] },
  voicePickerLabel: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  voicePickerRow: { flexDirection: 'row', gap: spacing[1.5] },
  voiceBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[1], minHeight: 52,
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.borderSubtle,
  },
  voiceBtnSelected: { borderColor: colors.brandPrimary, backgroundColor: colors.brandPrimary + '11' },
  voiceBtnIcon: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  voiceBtnLabel: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  voiceBtnLabelSelected: { color: colors.brandLight },
  voicePickerHint: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
  },
  premiumVoiceNote: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderSubtle,
    padding: spacing[1.5], marginTop: spacing[1],
  },
  premiumVoiceText: {
    flex: 1,
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    lineHeight: typography.fontSize.xs * 1.5,
  },
  note: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm,
    color: colors.textTertiary, textAlign: 'center',
  },
  footer: { paddingHorizontal: spacing[3], paddingBottom: spacing[3], paddingTop: spacing[2] },
});
