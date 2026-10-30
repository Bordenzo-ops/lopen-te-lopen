/**
 * PhaseBackdrop
 *
 * Absolute full-size layer that tints the screen with the current phase colour
 * at 12% opacity. When the colour changes it cross-fades from the old to the
 * new colour in 400 ms. Never intercepts touches.
 *
 * Respects the system reduced-motion setting: the colour then switches
 * instantly, without animation.
 */

import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const FADE_DURATION_MS = 400;
const BACKDROP_OPACITY = 0.12;

interface PhaseBackdropProps {
  color: string;
}

export function PhaseBackdrop({ color }: PhaseBackdropProps) {
  const reducedMotion = useReducedMotion();
  const fromColor = useSharedValue(color);
  const toColor = useSharedValue(color);
  const progress = useSharedValue(1);

  useEffect(() => {
    if (toColor.value === color) return;
    if (reducedMotion) {
      fromColor.value = color;
      toColor.value = color;
      progress.value = 1;
      return;
    }
    fromColor.value = toColor.value;
    toColor.value = color;
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: FADE_DURATION_MS,
      easing: Easing.inOut(Easing.cubic),
    });
    // Shared values are stable references.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [fromColor.value, toColor.value],
    ),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { opacity: BACKDROP_OPACITY }, animatedStyle]}
    />
  );
}
