import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { typography, type ThemeColors } from '../../theme/tokens';
import { useThemeColors } from '../../theme/useTheme';

interface StatRingProps {
  value: number;       // 0-100 (percentage)
  size?: number;
  strokeWidth?: number;
  color?: string;
  label: string;
  sublabel?: string;
}

export function StatRing({
  value,
  size = 120,
  strokeWidth = 10,
  color,
  label,
  sublabel,
}: StatRingProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const strokeColor = color ?? colors.brandPrimary;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, Math.max(0, value));
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  const center = size / 2;
  const roundedProgress = Math.round(progress);
  const accessibleLabel = sublabel ? `${label}, ${sublabel}` : label;

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibleLabel}
      accessibilityValue={{ min: 0, max: 100, now: roundedProgress }}
    >
      <Svg width={size} height={size}>
        {/* Track */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.borderDefault}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View style={styles.labelContainer}>
        <Text style={styles.label}>{label}</Text>
        {sublabel && <Text style={styles.sublabel}>{sublabel}</Text>}
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  labelContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: 'Inter_700Bold',
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  sublabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
});
