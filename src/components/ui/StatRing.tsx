import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { typography, type ThemeColors } from '../../theme/tokens';
import { useThemeColors } from '../../theme/useTheme';
import { CountUpText } from '../motion/CountUpText';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RING_FILL_DURATION_MS = 600;

interface StatRingProps {
  value: number;       // 0-100 (percentage)
  size?: number;
  strokeWidth?: number;
  color?: string;
  label: string;
  sublabel?: string;
  /** Optioneel: telt dit getal in het midden op i.p.v. de statische `label`-tekst te tonen. */
  countValue?: number;
  /** Formatteert `countValue` tijdens en na het optellen. Standaard: afgerond geheel getal. */
  countFormat?: (n: number) => string;
}

export function StatRing({
  value,
  size = 120,
  strokeWidth = 10,
  color,
  label,
  sublabel,
  countValue,
  countFormat,
}: StatRingProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const reducedMotion = useReducedMotion();
  const strokeColor = color ?? colors.brandPrimary;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, Math.max(0, value));
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  const center = size / 2;
  const roundedProgress = Math.round(progress);
  const accessibleLabel = sublabel ? `${label}, ${sublabel}` : label;

  // Animeert het vullen van de ring bij mount en bij elke waardeverandering.
  // Begint bij een lege ring (volledige offset) zodat de eerste keer tonen
  // ook zichtbaar vult in plaats van meteen in eindtoestand te verschijnen.
  const animatedOffset = useSharedValue(circumference);
  useEffect(() => {
    if (reducedMotion) {
      animatedOffset.value = strokeDashoffset;
      return;
    }
    animatedOffset.value = withTiming(strokeDashoffset, {
      duration: RING_FILL_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokeDashoffset, reducedMotion]);

  const animatedCircleProps = useAnimatedProps(() => ({
    strokeDashoffset: animatedOffset.value,
  }));

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
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          animatedProps={animatedCircleProps}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View style={styles.labelContainer}>
        {countValue != null ? (
          <CountUpText value={countValue} format={countFormat} textStyle={styles.label} />
        ) : (
          <Text style={styles.label}>{label}</Text>
        )}
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
