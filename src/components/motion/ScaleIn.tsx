/**
 * ScaleIn
 *
 * Wrapper die children bij mount licht opschaalt naar hun normale grootte
 * met een zachte spring-settle (hoge damping, geen bounce-overkill),
 * optioneel gecombineerd met een fade-in. Voor korte accent-momenten zoals
 * een trofee-icoon of een succes-icoon — gebruikt op meerdere schermen om
 * dezelfde subtiele "settle"-beweging te delen.
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
  withSpring,
  withTiming,
} from 'react-native-reanimated';

// Zachte settle: relatief hoge damping voorkomt een opvallende bounce.
const SPRING_CONFIG = { damping: 14, stiffness: 180, mass: 0.6 };
const FADE_DURATION_MS = 280;

interface ScaleInProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Startschaal voordat de spring naar 1 settelt. */
  fromScale?: number;
  /** Combineer met een fade-in vanaf opacity 0. */
  fade?: boolean;
  delay?: number;
}

export function ScaleIn({
  children,
  style,
  fromScale = 0.85,
  fade = true,
  delay = 0,
}: ScaleInProps) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(reducedMotion ? 1 : fromScale);
  const opacity = useSharedValue(reducedMotion || !fade ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      scale.value = 1;
      opacity.value = 1;
      return;
    }
    scale.value = withDelay(delay, withSpring(1, SPRING_CONFIG));
    if (fade) {
      opacity.value = withDelay(delay, withTiming(1, { duration: FADE_DURATION_MS, easing: Easing.out(Easing.cubic) }));
    }
    // Alleen bij mount, niet bij elke re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}
