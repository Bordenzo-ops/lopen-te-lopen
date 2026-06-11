import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Minus, Plus } from 'lucide-react-native';
import { colors, typography, spacing, radius } from '../../src/theme/tokens';
import { Button } from '../../src/components/ui/Button';
import type { GoalType } from '../../src/data/trainingPlans';

export default function ProfileScreen() {
  const { goal, schemaMode, raceId } = useLocalSearchParams<{ goal: GoalType; schemaMode: string; raceId: string }>();
  const [name, setName] = useState('');
  const [age, setAge] = useState(30);

  const maxHr = 220 - age;
  const adjustAge = (delta: number) => {
    setAge(a => Math.max(14, Math.min(80, a + delta)));
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} hitSlop={8} accessibilityRole="button" accessibilityLabel="Terug">
          <ChevronLeft size={24} color={colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
        <View style={styles.progress}>
          {[1, 2, 3].map(i => (
            <View key={i} style={[styles.progressDot, i <= 2 && styles.progressDotActive]} />
          ))}
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.titleGroup}>
            <Text style={styles.step}>Stap 2 van 3</Text>
            <Text style={styles.title}>Jouw profiel</Text>
            <Text style={styles.sub}>
              We gebruiken dit om jouw hartslagzones te berekenen.
            </Text>
          </View>

          {/* Naam */}
          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Naam (optioneel)</Text>
              <Text style={styles.charCount}>{name.length}/40</Text>
            </View>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Jouw naam"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
              returnKeyType="done"
              maxLength={40}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>

          {/* Leeftijd */}
          <View style={styles.field}>
            <Text style={styles.label}>Leeftijd</Text>
            <View style={styles.stepper}>
              <TouchableOpacity onPress={() => adjustAge(-1)} style={styles.stepperBtn} accessibilityRole="button" accessibilityLabel="Leeftijd verlagen">
                <Minus size={20} color={colors.textPrimary} strokeWidth={2} />
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{age}</Text>
              <TouchableOpacity onPress={() => adjustAge(1)} style={styles.stepperBtn} accessibilityRole="button" accessibilityLabel="Leeftijd verhogen">
                <Plus size={20} color={colors.textPrimary} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Hartslagzone preview */}
          <View style={styles.hrCard}>
            <Text style={styles.hrTitle}>Jouw hartslagzones</Text>
            <Text style={styles.hrSub}>
              Geschatte maximale hartslag: {maxHr} bpm.{' '}
              <Text style={styles.hrSubNote}>
                Heb je een nauwkeurige meting? Pas dit aan in Instellingen.
              </Text>
            </Text>
            <View style={styles.zones}>
              {([
                { zone: 'Z1', label: 'Herstel',  pct: [0.50, 0.60], color: '#60A5FA' },
                { zone: 'Z2', label: 'Aeroob',   pct: [0.61, 0.70], color: '#34D399' },
                { zone: 'Z3', label: 'Tempo',    pct: [0.71, 0.80], color: '#FBBF24' },
                { zone: 'Z4', label: 'Drempel',  pct: [0.81, 0.90], color: '#F97316' },
                { zone: 'Z5', label: 'Maximaal', pct: [0.91, 1.00], color: '#EF4444' },
              ] as const).map(z => (
                <View key={z.zone} style={styles.zoneRow}>
                  <View style={[styles.zoneDot, { backgroundColor: z.color }]} />
                  <Text style={styles.zoneLabel}>{z.zone} {z.label}</Text>
                  <Text style={styles.zoneBpm}>
                    {Math.round(maxHr * z.pct[0])} – {Math.round(maxHr * z.pct[1])} bpm
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <Button
          label="Volgende"
          onPress={() => router.push({
            pathname: '/(onboarding)/voice',
            params: { goal, name, age: String(age), schemaMode: schemaMode ?? 'training', raceId: raceId ?? '' },
          })}
          fullWidth
          size="lg"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[2], paddingVertical: spacing[1],
  },
  back: { padding: spacing[1] },
  progress: { flexDirection: 'row', gap: 6 },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.borderDefault },
  progressDotActive: { backgroundColor: colors.brandPrimary, width: 20 },
  content: { paddingHorizontal: spacing[3], paddingTop: spacing[3], paddingBottom: spacing[3], gap: spacing[3] },
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
  field: { gap: spacing[1] },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.sm,
    color: colors.textSecondary, letterSpacing: typography.letterSpacing.wider, textTransform: 'uppercase',
  },
  charCount: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs, color: colors.textTertiary,
  },
  input: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.borderDefault, paddingHorizontal: spacing[2], paddingVertical: spacing[1.5],
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.md, color: colors.textPrimary,
  },
  stepper: {
    flexDirection: 'row', alignItems: 'center', gap: 0,
    backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.borderDefault, alignSelf: 'flex-start', overflow: 'hidden',
  },
  stepperBtn: {
    padding: spacing[1.5], paddingHorizontal: spacing[2],
    backgroundColor: colors.bgCard,
  },
  stepperValue: {
    fontFamily: typography.fontFamily.sansBold, fontSize: typography.fontSize.xl,
    color: colors.textPrimary, minWidth: 64, textAlign: 'center',
  },
  hrCard: {
    backgroundColor: colors.bgSurface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderSubtle, padding: spacing[2], gap: spacing[1.5],
  },
  hrTitle: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.md, color: colors.textPrimary,
  },
  hrSub: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm, color: colors.textSecondary,
    lineHeight: typography.fontSize.sm * 1.5,
  },
  hrSubNote: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm,
    color: colors.textTertiary, fontStyle: 'italic',
  },
  zones: { gap: spacing[1] },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  zoneDot: { width: 10, height: 10, borderRadius: 5 },
  zoneLabel: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.sm,
    color: colors.textSecondary, flex: 1,
  },
  zoneBpm: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm, color: colors.textPrimary,
  },
  footer: { paddingHorizontal: spacing[3], paddingBottom: spacing[3], paddingTop: spacing[2] },
});
