/**
 * RaceCountdownCard
 *
 * Compacte countdown voor het dashboard ("12 weken · 3 dagen tot Marathon
 * Rotterdam"). Tik opent de racepagina. Rekent via raceCountdown() zodat het
 * getal gelijk is aan dat op de racepagina en de deelkaart.
 */

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Flag, ChevronRight } from 'lucide-react-native';
import { typography, spacing, radius, type ThemeColors } from '../../theme/tokens';
import { useThemeColors } from '../../theme/useTheme';
import type { Race } from '../../data/rotterdamRaces';
import { raceCountdown, countdownText } from '../../data/raceDetails';

interface RaceCountdownCardProps {
  race: Race;
  onPress: () => void;
}

export function RaceCountdownCard({ race, onPress }: RaceCountdownCardProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const countdown = raceCountdown(race.date);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${countdownText(countdown)} tot ${race.name}. Open de racepagina`}
    >
      <View style={styles.iconWrap}>
        <Flag size={18} color={colors.brandPrimary} strokeWidth={2.2} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {countdown.isPast || countdown.isToday
            ? countdownText(countdown)
            : `${countdownText(countdown)} te gaan`}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>{race.name}</Text>
      </View>
      <ChevronRight size={18} color={colors.textTertiary} strokeWidth={2} />
    </TouchableOpacity>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.brandPrimary + '33',
    borderRadius: radius.xl,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1.5],
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandPrimary + '14',
  },
  body: { flex: 1, gap: 2 },
  title: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  sub: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
});
