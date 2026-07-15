import React, { useState, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Animated, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Check, Trophy, Dumbbell, Calendar, Clock, Target, Medal } from 'lucide-react-native';
import { colors, palette, typography, spacing, radius, shadows, type ThemeColors } from '../../src/theme/tokens';
import { useThemeColors } from '../../src/theme/useTheme';
import { Button } from '../../src/components/ui/Button';
import { trainingPlans } from '../../src/data/trainingPlans';
import { getUpcomingRaces, weeksUntilLabel, formatRaceDate } from '../../src/data/rotterdamRaces';
import type { GoalType } from '../../src/data/trainingPlans';
import type { RotterdamRace } from '../../src/data/rotterdamRaces';
import { usePremium } from '../../src/hooks/usePremium';
import { isRaceDistanceFree } from '../../src/config/premiumConfig';
import { PremiumBadge } from '../../src/components/ui/PremiumBadge';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// ── Meta ──────────────────────────────────────────────────────────────────────

const goalMeta: Record<GoalType, { icon: React.ReactNode; tagline: string }> = {
  '5km':           { icon: <Target size={26} color={colors.brandLight} strokeWidth={2} />,   tagline: 'Ideaal als eerste doel' },
  '10km':          { icon: <Dumbbell size={26} color={colors.brandLight} strokeWidth={2} />, tagline: 'De klassieke uitdaging' },
  'half_marathon': { icon: <Medal size={26} color={colors.brandLight} strokeWidth={2} />,    tagline: 'Het ultieme doel' },
  'marathon':      { icon: <Trophy size={26} color={colors.brandLight} strokeWidth={2} />,   tagline: 'De ultieme uitdaging' },
};

const distanceLabel: Record<RotterdamRace['distance'], string> = {
  '5km':           '5 KM',
  '10km':          '10 KM',
  '15km':          '15 KM',
  'half_marathon': 'Halve Marathon',
  'marathon':      'Marathon',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function GoalScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [mode, setMode] = useState<'training' | 'race'>('training');
  const { hasAccess } = usePremium();

  // Training-modus
  const [selectedGoal, setSelectedGoal] = useState<GoalType | null>(null);

  // Wedstrijd-modus
  const upcomingRaces = getUpcomingRaces();
  const [selectedRace, setSelectedRace] = useState<RotterdamRace | null>(null);

  const canContinue = mode === 'training' ? !!selectedGoal : !!selectedRace;

  function handleContinue() {
    if (mode === 'training' && selectedGoal) {
      router.push({ pathname: '/(onboarding)/profile', params: { goal: selectedGoal, schemaMode: 'training' } });
    } else if (mode === 'race' && selectedRace) {
      router.push({
        pathname: '/(onboarding)/profile',
        params: { goal: 'half_marathon', schemaMode: 'race', raceId: selectedRace.id },
      });
    }
  }

  function switchMode(next: 'training' | 'race') {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMode(next);
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Nav header */}
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} hitSlop={8} accessibilityRole="button" accessibilityLabel="Terug">
          <ChevronLeft size={24} color={colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
        <View style={styles.progress}>
          {[1, 2, 3].map(i => (
            <View key={i} style={[styles.progressDot, i === 1 && styles.progressDotActive]} />
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Titel */}
        <View style={styles.titleGroup}>
          <Text style={styles.step}>Stap 1 van 3</Text>
          <Text style={styles.title}>Hoe wil je trainen?</Text>
          <Text style={styles.sub}>
            Kies een vrij trainingsschema of train gericht op een wedstrijd.
          </Text>
        </View>

        {/* Mode toggle */}
        <View style={styles.modeToggle}>
          <ModeTab
            icon={<Dumbbell size={16} color={mode === 'training' ? '#fff' : colors.textSecondary} strokeWidth={2} />}
            label="Vrij trainen"
            active={mode === 'training'}
            onPress={() => switchMode('training')}
          />
          <ModeTab
            icon={<Trophy size={16} color={mode === 'race' ? '#fff' : colors.textSecondary} strokeWidth={2} />}
            label="Wedstrijd"
            active={mode === 'race'}
            onPress={() => switchMode('race')}
          />
        </View>

        {/* Inhoud op basis van modus */}
        {mode === 'training' ? (
          <TrainingModeContent
            selected={selectedGoal}
            onSelect={setSelectedGoal}
          />
        ) : (
          <RaceModeContent
            races={upcomingRaces}
            selected={selectedRace}
            onSelect={setSelectedRace}
            onSwitchToTraining={() => switchMode('training')}
            hasAccess={hasAccess}
          />
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Volgende"
          onPress={handleContinue}
          disabled={!canContinue}
          fullWidth
          size="lg"
        />
      </View>
    </SafeAreaView>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function ModeTab({
  icon, label, active, onPress,
}: { icon: React.ReactNode; label: string; active: boolean; onPress: () => void }) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <TouchableOpacity
      style={[styles.modeTabBtn, active && styles.modeTabBtnActive]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      {icon}
      <Text style={[styles.modeTabLabel, active && styles.modeTabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function TrainingModeContent({
  selected, onSelect,
}: { selected: GoalType | null; onSelect: (g: GoalType) => void }) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Kies je doel</Text>
      <View style={styles.cards}>
        {trainingPlans.map(plan => {
          const meta = goalMeta[plan.id];
          const isSelected = selected === plan.id;
          return (
            <TouchableOpacity
              key={plan.id}
              onPress={() => onSelect(plan.id)}
              activeOpacity={0.8}
              style={[styles.goalCard, isSelected && styles.goalCardSelected]}
            >
              <View style={styles.goalLeft}>
                <View style={styles.goalEmoji}>{meta.icon}</View>
                <View style={styles.goalText}>
                  <Text style={[styles.goalName, isSelected && styles.goalNameSelected]}>
                    {plan.name}
                  </Text>
                  <Text style={styles.goalMeta}>
                    {plan.weeks} weken · {meta.tagline}
                  </Text>
                </View>
              </View>
              <View style={[styles.checkCircle, isSelected && styles.checkCircleSelected]}>
                {isSelected && <Check size={14} color="#fff" strokeWidth={3} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      {selected && (
        <View style={styles.descriptionBox}>
          <Text style={styles.descriptionText}>
            {trainingPlans.find(p => p.id === selected)?.description}
          </Text>
        </View>
      )}
    </View>
  );
}

function RaceModeContent({
  races, selected, onSelect, onSwitchToTraining, hasAccess,
}: {
  races: RotterdamRace[];
  selected: RotterdamRace | null;
  onSelect: (r: RotterdamRace) => void;
  onSwitchToTraining: () => void;
  hasAccess: boolean;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // Sommige afstanden zijn later premium. We blokkeren de keuze in de
  // onboarding bewust niet: een nieuwe gebruiker mag altijd een doel kiezen en
  // direct een werkend schema krijgen. We tonen wel een eerlijke premium-hint,
  // zodat het later niet als verrassing voelt. Zolang de betaalmuur uit staat
  // (hasAccess is dan true) verschijnt er niets.
  const anyPremiumRace = !hasAccess && races.some(r => !isRaceDistanceFree(r.distance));
  if (races.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Trophy size={36} color={colors.textTertiary} strokeWidth={1.5} />
        <Text style={styles.emptyText}>Geen aankomende wedstrijden gevonden.</Text>
        <Text style={styles.emptySub}>Je kunt wel alvast beginnen met een vrij trainingsschema.</Text>
        <TouchableOpacity
          style={styles.emptyBtn}
          onPress={onSwitchToTraining}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Kies een vrij trainingsschema"
        >
          <Text style={styles.emptyBtnText}>Kies een vrij trainingsschema</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Kies je wedstrijd</Text>
      <Text style={styles.sectionSub}>Het schema past zich automatisch aan op jouw wedstrijddag</Text>
      {anyPremiumRace && (
        <Text style={styles.racePremiumNote}>
          Je kunt nu elke wedstrijd kiezen. De halve marathon blijft altijd gratis.
          Voor andere afstanden, zoals de 5 km, 10 km of marathon, vraagt de app later
          om premium.
        </Text>
      )}
      <View style={styles.cards}>
        {races.map(race => {
          const isSelected = selected?.id === race.id;
          const accent = race.accentColor;
          const locked = !hasAccess && !isRaceDistanceFree(race.distance);
          return (
            <TouchableOpacity
              key={race.id}
              onPress={() => onSelect(race)}
              activeOpacity={0.8}
              style={[
                styles.raceCard,
                { borderColor: isSelected ? accent : colors.borderSubtle },
                isSelected && { backgroundColor: accent + '0D' },
              ]}
            >
              {/* Kleurstreep links */}
              <View style={[styles.raceBar, { backgroundColor: accent }]} />

              <View style={styles.raceCardInner}>
                <View style={styles.raceCardTop}>
                  <View style={styles.raceCardTitles}>
                    <Text style={[styles.raceName, isSelected && { color: colors.textPrimary }]}>
                      {race.name}
                    </Text>
                    <View style={styles.racePillRow}>
                      <View style={[styles.distancePill, { backgroundColor: accent + '22', borderColor: accent + '55' }]}>
                        <Text style={[styles.distancePillText, { color: accent }]}>
                          {distanceLabel[race.distance]}
                        </Text>
                      </View>
                      {locked && <PremiumBadge />}
                    </View>
                  </View>
                  <View style={[styles.checkCircle, isSelected && { backgroundColor: accent, borderColor: accent }]}>
                    {isSelected && <Check size={13} color="#fff" strokeWidth={3} />}
                  </View>
                </View>

                <View style={styles.raceMeta}>
                  <View style={styles.raceMetaItem}>
                    <Calendar size={12} color={colors.textTertiary} strokeWidth={2} />
                    <Text style={styles.raceMetaText}>{formatRaceDate(race.date)}</Text>
                  </View>
                  <View style={styles.raceMetaItem}>
                    <Clock size={12} color={accent} strokeWidth={2} />
                    <Text style={[styles.raceMetaText, { color: accent }]}>
                      {weeksUntilLabel(race.date)}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {selected && (
        <View style={[styles.descriptionBox, { borderColor: selected.accentColor + '44' }]}>
          <Text style={styles.descriptionText}>{selected.description}</Text>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },

  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[2],
    paddingTop: spacing[1],
    paddingBottom: spacing[1],
  },
  back: { padding: spacing[1] },
  progress: { flexDirection: 'row', gap: 6 },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.borderDefault },
  progressDotActive: { backgroundColor: colors.brandPrimary, width: 20 },

  content: {
    paddingHorizontal: spacing[3],
    paddingTop: spacing[3],
    paddingBottom: spacing[4],
    gap: spacing[3],
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
    color: colors.textSecondary, lineHeight: typography.fontSize.base * 1.55,
  },

  // Mode toggle
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: 4,
  },
  modeTabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, paddingVertical: spacing[1.5],
    borderRadius: radius.lg,
  },
  modeTabBtnActive: {
    backgroundColor: colors.brandPrimary,
    ...shadows.sm,
  },
  modeTabLabel: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  modeTabLabelActive: { color: '#fff' },

  section: { gap: spacing[1.5] },
  sectionTitle: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  sectionSub: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm,
    color: colors.textSecondary, marginTop: -spacing[1],
  },
  racePremiumNote: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    lineHeight: typography.fontSize.xs * 1.5,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderSubtle,
    padding: spacing[1.5],
  },
  racePillRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1], flexWrap: 'wrap',
  },

  cards: { gap: spacing[1.5] },

  // Training cards
  goalCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    padding: spacing[2], borderWidth: 1.5, borderColor: colors.borderSubtle,
  },
  goalCardSelected: { borderColor: colors.brandPrimary, backgroundColor: colors.brandPrimary + '11' },
  goalLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] },
  goalEmoji: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.brandPrimary + '14', alignItems: 'center', justifyContent: 'center' },
  goalText: { gap: 3 },
  goalName: {
    fontFamily: typography.fontFamily.sansBold, fontSize: typography.fontSize.md, color: colors.textPrimary,
  },
  goalNameSelected: { color: colors.brandLight },
  goalMeta: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm, color: colors.textSecondary,
  },

  // Race cards
  raceCard: {
    flexDirection: 'row', backgroundColor: colors.bgCard,
    borderRadius: radius.xl, borderWidth: 1.5, overflow: 'hidden',
  },
  raceBar: { width: 4 },
  raceCardInner: { flex: 1, padding: spacing[2], gap: spacing[0.5] },
  raceCardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  raceCardTitles: { flex: 1, gap: 6 },
  raceName: {
    fontFamily: typography.fontFamily.sansBold, fontSize: typography.fontSize.md, color: colors.textPrimary,
  },
  distancePill: {
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.full, borderWidth: 1,
  },
  distancePillText: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.xs,
    letterSpacing: typography.letterSpacing.wide,
  },
  raceMeta: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap', marginTop: 4 },
  raceMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  raceMetaText: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs,
    color: colors.textTertiary, textTransform: 'capitalize',
  },

  // Shared
  checkCircle: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: colors.borderDefault,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  checkCircleSelected: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  descriptionBox: {
    backgroundColor: colors.bgSurface, borderRadius: radius.lg,
    padding: spacing[2], borderWidth: 1, borderColor: colors.borderSubtle,
  },
  descriptionText: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.base,
    color: colors.textSecondary, lineHeight: typography.fontSize.base * 1.55, fontStyle: 'italic',
  },
  emptyBox: {
    alignItems: 'center', paddingVertical: spacing[5], gap: spacing[1],
  },
  emptyText: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.base, color: colors.textTertiary,
  },
  emptySub: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm,
    color: colors.textSecondary, textAlign: 'center',
  },
  emptyBtn: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.brandPrimary + '55',
    minHeight: 44, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing[2.5], marginTop: spacing[1],
  },
  emptyBtnText: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm, color: colors.brandPrimary,
  },

  footer: { paddingHorizontal: spacing[3], paddingBottom: spacing[3], paddingTop: spacing[2] },
});
