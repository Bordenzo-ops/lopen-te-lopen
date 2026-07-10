import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { typography, spacing, radius, type ThemeColors } from '../../theme/tokens';
import { useThemeColors } from '../../theme/useTheme';

// Weekdagnummers: 1=ma t/m 7=zo.
const WEEK_DAYS: { value: number; short: string; long: string }[] = [
  { value: 1, short: 'Ma', long: 'maandag' },
  { value: 2, short: 'Di', long: 'dinsdag' },
  { value: 3, short: 'Wo', long: 'woensdag' },
  { value: 4, short: 'Do', long: 'donderdag' },
  { value: 5, short: 'Vr', long: 'vrijdag' },
  { value: 6, short: 'Za', long: 'zaterdag' },
  { value: 7, short: 'Zo', long: 'zondag' },
];

interface DayPickerProps {
  /** Huidige selectie: array van weekdagnummers (1 t/m 7). */
  value: number[];
  /** Wordt aangeroepen met de nieuwe selectie zodra de gebruiker tikt. */
  onChange: (days: number[]) => void;
  /** Aantal dagen dat exact gekozen moet worden. Default 3. */
  required?: number;
}

/**
 * Compacte dagkiezer waarmee de gebruiker precies `required` (default 3)
 * trainingsdagen kiest. Toont 7 dagknoppen en een statusregel die aangeeft
 * hoeveel dagen er nog gekozen moeten worden. Volledig herbruikbaar in de
 * onboarding en het Schema-tabblad.
 */
export function DayPicker({ value, onChange, required = 3 }: DayPickerProps) {
  const isComplete = value.length === required;
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  function toggleDay(day: number) {
    if (value.includes(day)) {
      onChange(value.filter(d => d !== day));
      return;
    }
    // Maximaal `required` dagen: bij vol vervangt een nieuwe tik de oudste keuze.
    if (value.length >= required) {
      const next = [...value.slice(1), day];
      onChange(next);
      return;
    }
    onChange([...value, day]);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {WEEK_DAYS.map(d => {
          const selected = value.includes(d.value);
          return (
            <TouchableOpacity
              key={d.value}
              onPress={() => toggleDay(d.value)}
              activeOpacity={0.8}
              style={[styles.dayBtn, selected && styles.dayBtnSelected]}
              accessibilityRole="checkbox"
              accessibilityLabel={d.long}
              accessibilityState={{ checked: selected }}
            >
              <Text style={[styles.dayLabel, selected && styles.dayLabelSelected]}>
                {d.short}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[styles.status, isComplete && styles.statusOk]}>
        {isComplete
          ? `Top, je traint ${required} dagen per week.`
          : `Kies nog ${required - value.length} ${required - value.length === 1 ? 'dag' : 'dagen'}.`}
      </Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  wrap: { gap: spacing[1] },
  row: { flexDirection: 'row', gap: 6, justifyContent: 'space-between' },
  dayBtn: {
    flex: 1,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
  },
  dayBtnSelected: {
    borderColor: colors.brandPrimary,
    backgroundColor: colors.brandPrimary + '11',
  },
  dayLabel: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  dayLabelSelected: { color: colors.brandLight },
  status: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
  },
  statusOk: { color: colors.success },
});
