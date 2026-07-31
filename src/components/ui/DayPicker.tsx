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
  /** Minimaal aantal dagen. Default 3. Puur informatief voor de statusregel —
   *  deselecteren blijft altijd mogelijk, ook onder dit minimum. De ouder
   *  bepaalt met dit gegeven of de gebruiker verder mag (bv. "Volgende"-knop). */
  min?: number;
  /** Maximaal aantal dagen. Default 7. Een tik boven dit maximum wordt genegeerd
   *  in plaats van dat de oudste keuze wordt vervangen. */
  max?: number;
}

/**
 * Compacte dagkiezer waarmee de gebruiker vrij tussen `min` en `max`
 * (default 3–7) trainingsdagen kiest. Toont 7 dagknoppen en een statusregel
 * die aangeeft hoeveel dagen er nog gekozen moeten worden om het minimum te
 * halen. Volledig herbruikbaar in de onboarding en het Schema-tabblad.
 *
 * Validatie van het minimum ligt bewust bij de ouder (bv. het al dan niet
 * actief zijn van een "Volgende"-knop): deze component dwingt zelf niets af,
 * zodat de gebruiker eerst dagen kan wegklikken en daarna opnieuw kan kiezen
 * zonder dat de component in de weg zit.
 */
export function DayPicker({ value, onChange, min = 3, max = 7 }: DayPickerProps) {
  const meetsMin = value.length >= min;
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  function toggleDay(day: number) {
    if (value.includes(day)) {
      // Deselecteren mag altijd, ook als je daarmee onder `min` uitkomt: de
      // gebruiker moet eerst kunnen wegklikken voor hij opnieuw kiest.
      onChange(value.filter(d => d !== day));
      return;
    }
    // Boven `max` wordt een nieuwe tik genegeerd in plaats van dat de oudste
    // keuze wordt vervangen — de gebruiker deselecteert dan bewust zelf eerst.
    if (value.length >= max) {
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
      <Text style={[styles.status, meetsMin && styles.statusOk]}>
        {meetsMin
          ? `Top, je traint ${value.length} dagen per week.`
          : `Kies nog ${min - value.length} ${min - value.length === 1 ? 'dag' : 'dagen'}.`}
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
