import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { zoneInfo } from '../../data/trainingPlans';
import type { HeartRateZone } from '../../data/trainingPlans';
import { typography, spacing, radius } from '../../theme/tokens';

interface ZoneBadgeProps {
  zone: HeartRateZone;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export function ZoneBadge({ zone, showLabel = true, size = 'md' }: ZoneBadgeProps) {
  const info = zoneInfo[zone];
  const isSm = size === 'sm';

  return (
    <View style={[styles.container, { backgroundColor: info.color + '22', borderColor: info.color + '55' }]}>
      <View style={[styles.dot, { backgroundColor: info.color }, isSm && styles.dotSm]} />
      {showLabel && (
        <Text style={[styles.label, { color: info.color }, isSm && styles.labelSm]}>
          {zone} {info.label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[0.5],
    paddingHorizontal: spacing[1],
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotSm: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: typography.fontSize.sm,
    letterSpacing: typography.letterSpacing.wide,
  },
  labelSm: {
    fontSize: typography.fontSize.xs,
  },
});
