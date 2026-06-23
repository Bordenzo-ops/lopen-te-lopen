import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MapPin, Clock, Zap, CheckCircle2, Info, Timer, MinusCircle } from 'lucide-react-native';
import { typography, spacing, radius, type ThemeColors } from '../../theme/tokens';
import { useThemeColors } from '../../theme/useTheme';
import { ZoneBadge } from './ZoneBadge';
import { SessionTypeSheet } from './SessionTypeSheet';
import { formatPacePerKm } from '../../data/paceModel';
import type { Session } from '../../data/trainingPlans';

interface SessionCardProps {
  session: Session;
  isCompleted?: boolean;
  /** Bewust overgeslagen: toont een rustige "Overgeslagen"-markering. */
  isSkipped?: boolean;
  onPress?: () => void;
  variant?: 'default' | 'next';
  /**
   * Persoonlijk trainingstempo (sec/km) voor deze sessie. Alleen gevuld bij
   * premium met ingestelde doeltijd; dan tonen we het tempo naast de
   * hartslagzone. Null of undefined: er verandert niets aan de weergave.
   */
  trainingPaceSecPerKm?: number | null;
}

const sessionTypeLabel: Record<Session['type'], string> = {
  easy:  'Rustige duurloop',
  tempo: 'Tempoduurloop',
  long:  'Lange duurloop',
  rest:  'Rustdag',
  cross: 'Cross-training',
};

const dayLabel = ['', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];

export function SessionCard({ session, isCompleted = false, isSkipped = false, onPress, variant = 'default', trainingPaceSecPerKm }: SessionCardProps) {
  const isNext = variant === 'next';
  const [showInfo, setShowInfo] = useState(false);
  const showPace = trainingPaceSecPerKm != null && trainingPaceSecPerKm > 0;
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
      style={[
        styles.container,
        isNext && styles.containerNext,
        (isCompleted || isSkipped) && styles.containerCompleted,
      ]}
    >
      {/* Header row */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.day, (isCompleted || isSkipped) && styles.textMuted]}>
            {dayLabel[session.day]}
          </Text>
          <TouchableOpacity
            onPress={() => setShowInfo(true)}
            style={styles.typeRow}
            activeOpacity={0.7}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Uitleg over ${sessionTypeLabel[session.type]}`}
          >
            <Text style={[styles.type, (isCompleted || isSkipped) && styles.textMuted]}>
              {sessionTypeLabel[session.type]}
            </Text>
            <Info size={13} color={colors.textTertiary} strokeWidth={2} />
          </TouchableOpacity>
        </View>
        {isCompleted && (
          <CheckCircle2 size={22} color={colors.success} strokeWidth={2} />
        )}
        {isSkipped && !isCompleted && (
          <View style={styles.skippedTag}>
            <MinusCircle size={11} color={colors.textTertiary} strokeWidth={2} />
            <Text style={styles.skippedLabel}>Overgeslagen</Text>
          </View>
        )}
        {isNext && !isCompleted && !isSkipped && (
          <View style={styles.nextBadge}>
            <Zap size={11} color={colors.brandPrimary} strokeWidth={2.5} />
            <Text style={styles.nextLabel}>Volgende</Text>
          </View>
        )}
      </View>

      {/* Stats row */}
      <View style={styles.stats}>
        <View style={styles.stat}>
          <MapPin size={14} color={colors.textSecondary} strokeWidth={2} />
          <Text style={[styles.statValue, isCompleted && styles.textMuted]}>
            {session.distanceKm} km
          </Text>
        </View>
        <ZoneBadge zone={session.zone} size="sm" />
        {/* Persoonlijk trainingstempo naast de hartslagzone (premium + doeltijd) */}
        {showPace && (
          <View style={styles.paceChip} accessibilityLabel={`Doeltempo ${formatPacePerKm(trainingPaceSecPerKm)}`}>
            <Timer size={12} color={colors.brandLight} strokeWidth={2} />
            <Text style={styles.paceChipText}>{formatPacePerKm(trainingPaceSecPerKm)}</Text>
          </View>
        )}
      </View>

      {/* Coach tip */}
      {isNext && (
        <View style={styles.tipContainer}>
          <Text style={styles.tip} numberOfLines={2}>{session.coachTip}</Text>
        </View>
      )}

      <SessionTypeSheet
        sessionType={showInfo ? session.type : null}
        onClose={() => setShowInfo(false)}
      />
    </TouchableOpacity>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: spacing[2],
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing[1],
  },
  containerNext: {
    borderColor: colors.brandPrimary + '66',
    backgroundColor: colors.bgCard,
  },
  containerCompleted: {
    opacity: 0.65,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerLeft: {
    gap: 2,
  },
  day: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    letterSpacing: typography.letterSpacing.wider,
    textTransform: 'uppercase',
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  type: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  paceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing[1],
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.brandPrimary + '55',
    backgroundColor: colors.brandPrimary + '1A',
  },
  paceChipText: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.xs,
    color: colors.brandLight,
    letterSpacing: typography.letterSpacing.wide,
  },
  nextBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.brandPrimary + '22',
    paddingHorizontal: spacing[1],
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.brandPrimary + '44',
  },
  nextLabel: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.xs,
    color: colors.brandPrimary,
    letterSpacing: typography.letterSpacing.wide,
  },
  skippedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.bgSurface,
    paddingHorizontal: spacing[1],
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  skippedLabel: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    letterSpacing: typography.letterSpacing.wide,
  },
  tipContainer: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.md,
    padding: spacing[1],
    marginTop: 2,
  },
  tip: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
    fontStyle: 'italic',
  },
  textMuted: {
    color: colors.textTertiary,
  },
});
