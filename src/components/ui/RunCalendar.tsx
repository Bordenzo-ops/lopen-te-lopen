/**
 * RunCalendar
 *
 * Eigen maandkalender (geen library) voor het Logboek. Toont per dag of er
 * een run gelopen is en laat de gebruiker een dag selecteren om de details
 * te bekijken. Weken beginnen op maandag, alles in het Nederlands.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { nl } from 'date-fns/locale';
import { typography, spacing, radius, type ThemeColors } from '../../theme/tokens';
import { useThemeColors } from '../../theme/useTheme';
import type { CompletedSession } from '../../store/appStore';
import { ScaleIn } from '../motion/ScaleIn';

// Zachte crossfade bij maandwissel; respecteert de systeeminstelling voor
// verminderde beweging automatisch.
const gridEntering = FadeIn.duration(220).reduceMotion(ReduceMotion.System);

interface RunCalendarProps {
  /** Voltooide runs, gegroepeerd per dag. Key = 'yyyy-MM-dd'. */
  runsByDay: Map<string, CompletedSession[]>;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

const dayHeaderLabels = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

export function RunCalendar({ runsByDay, selectedDate, onSelectDate }: RunCalendarProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [visibleMonth]);

  const monthLabel = useMemo(
    () => format(visibleMonth, 'MMMM yyyy', { locale: nl }),
    [visibleMonth],
  );

  return (
    <View style={styles.container}>
      {/* Maandnavigatie */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => setVisibleMonth(m => subMonths(m, 1))}
          style={styles.navBtn}
          hitSlop={8}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Vorige maand"
        >
          <ChevronLeft size={20} color={colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>
          {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
        </Text>
        <TouchableOpacity
          onPress={() => setVisibleMonth(m => addMonths(m, 1))}
          style={styles.navBtn}
          hitSlop={8}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Volgende maand"
        >
          <ChevronRight size={20} color={colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* Dagkoppen */}
      <View style={styles.weekRow}>
        {dayHeaderLabels.map(label => (
          <View key={label} style={styles.dayHeaderCell}>
            <Text style={styles.dayHeaderText}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Dagraster — crossfadet zacht bij maandwissel (key = zichtbare maand) */}
      <Animated.View key={monthLabel} style={styles.grid} entering={gridEntering}>
        {days.map(day => {
          const key = format(day, 'yyyy-MM-dd');
          const inMonth = isSameMonth(day, visibleMonth);
          const hasRuns = runsByDay.has(key);
          const isSelected = selectedDate === key;
          const isCurrentDay = isToday(day);
          const circleStyle = [
            styles.dayCircle,
            hasRuns && styles.dayCircleFilled,
            isCurrentDay && !hasRuns && styles.dayCircleToday,
            isSelected && styles.dayCircleSelected,
          ];
          const textStyle = [
            styles.dayText,
            !inMonth && styles.dayTextDimmed,
            hasRuns && styles.dayTextOnFilled,
            isSelected && !hasRuns && styles.dayTextSelected,
          ];

          return (
            <TouchableOpacity
              key={key}
              style={styles.dayCell}
              onPress={() => onSelectDate(key)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${format(day, 'd MMMM', { locale: nl })}${hasRuns ? ', run gelopen' : ''}`}
              accessibilityState={{ selected: isSelected }}
            >
              {isSelected ? (
                // Eenmalige, zachte highlight-puls (geen loop) zodra deze dag
                // geselecteerd wordt. `key` zorgt dat elke nieuwe selectie
                // opnieuw mount en dus opnieuw pulseert.
                <ScaleIn key={key} fromScale={1.15} fade={false} style={circleStyle}>
                  <Text style={textStyle}>{format(day, 'd')}</Text>
                </ScaleIn>
              ) : (
                <View style={circleStyle}>
                  <Text style={textStyle}>{format(day, 'd')}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </Animated.View>
    </View>
  );
}

const CELL_SIZE = 40;

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { gap: spacing[1.5] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[0.5],
  },
  navBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  monthLabel: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  dayHeaderText: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wide,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 3,
  },
  dayCircle: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: CELL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleFilled: {
    backgroundColor: colors.brandPrimary,
  },
  dayCircleToday: {
    borderWidth: 1.5,
    borderColor: colors.brandPrimary,
  },
  dayCircleSelected: {
    borderWidth: 2,
    borderColor: colors.textPrimary,
  },
  dayText: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  dayTextDimmed: {
    color: colors.textTertiary,
    opacity: 0.5,
  },
  dayTextOnFilled: {
    fontFamily: typography.fontFamily.sansBold,
    color: colors.textInverse,
  },
  dayTextSelected: {
    fontFamily: typography.fontFamily.sansBold,
    color: colors.textPrimary,
  },
});
