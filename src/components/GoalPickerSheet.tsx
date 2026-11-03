/**
 * GoalPickerSheet
 *
 * Kleine bottom sheet waarin de gebruiker een ander trainingsdoel kiest
 * (Instellingen > Huidig doel). De sheet kiest alleen; de bevestiging en de
 * wijziging zelf (changeTrainingGoal) doet de aanroeper.
 */

import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
} from 'react-native';
import { Check } from 'lucide-react-native';
import { typography, spacing, radius, type ThemeColors } from '../theme/tokens';
import { useThemeColors } from '../theme/useTheme';
import { GOAL_LABELS } from '../data/trainingPlans';
import type { GoalType } from '../data/trainingPlans';
import { BottomSheet } from './ui/BottomSheet';
import { SheetHandle, SheetCloseButton, SheetGrabZone } from './ui/sheetParts';

/** Kiesbare doelen, in oplopende volgorde, met de labels uit de rest van de app. */
export const GOAL_OPTIONS: ReadonlyArray<{ key: GoalType; label: string }> = (
  ['start', '5km', '10km', '15km', 'half_marathon', 'marathon'] as const
).map(key => ({ key, label: GOAL_LABELS[key] }));

interface GoalPickerSheetProps {
  visible: boolean;
  currentGoal: GoalType;
  onSelect: (goal: GoalType) => void;
  onClose: () => void;
}

export function GoalPickerSheet({ visible, currentGoal, onSelect, onClose }: GoalPickerSheetProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
        <SheetGrabZone>
          <SheetHandle />
          <View style={styles.titleBar}>
            <Text style={styles.title}>Doel wijzigen</Text>
          </View>
        </SheetGrabZone>

        <View style={styles.content}>
          <Text style={styles.intro}>Kies het doel waar je naartoe wilt trainen.</Text>

          <View style={styles.list}>
            {GOAL_OPTIONS.map(opt => {
              const active = opt.key === currentGoal;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => onSelect(opt.key)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`Doel ${opt.label}`}
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>{opt.label}</Text>
                  {active && <Check size={18} color={colors.brandPrimary} strokeWidth={2.5} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Laatste kind, zie sheetParts. */}
        <SheetCloseButton />
    </BottomSheet>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  titleBar: {
    paddingHorizontal: spacing[3],
    paddingTop: spacing[2],
    paddingBottom: spacing[1],
  },
  content: {
    paddingHorizontal: spacing[3],
    gap: spacing[1],
  },
  title: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: typography.fontSize.xl,
    color: colors.textPrimary,
  },
  intro: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  list: {
    marginTop: spacing[1],
    gap: spacing[1],
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  optionActive: {
    borderColor: colors.brandPrimary,
    backgroundColor: colors.brandPrimary + '1A',
  },
  optionText: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  optionTextActive: {
    color: colors.brandPrimary,
  },
});
