/**
 * FadeSlideIn
 *
 * Wrapper die children bij mount zacht laat infaden en 8-12px omhoog laat
 * schuiven. Ondersteunt een optionele `delay` (ms) voor staggering, bv. bij
 * een lijst kaarten die na elkaar verschijnen.
 *
 * Respecteert de systeeminstelling voor verminderde beweging: bij reduced
 * motion verschijnen children direct in hun eindtoestand, zonder animatie.
 */

import React, { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

const DEFAULT_DURATION_MS = 320;
const DEFAULT_DISTANCE = 10;

interface FadeSlideInProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Vertraging (ms) voordat de animatie start, voor staggering. */
  delay?: number;
  /** Verticale afstand (px) waarover children omhoog invallen. */
  distance?: number;
  duration?: number;
}

export function FadeSlideIn({
  children,
  style,
  delay = 0,
  distance = DEFAULT_DISTANCE,
  duration = DEFAULT_DURATION_MS,
}: FadeSlideInProps) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      delay,
      withTiming(1, { duration, easing: Easing.out(Easing.cubic) }),
    );
    // Alleen bij mount opnieuw laten invallen, niet bij elke re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * distance }],
  }));

  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}
