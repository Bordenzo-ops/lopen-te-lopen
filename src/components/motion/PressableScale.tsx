/**
 * PressableScale
 *
 * Drop-in vervanger voor TouchableOpacity die bij indrukken zacht schaalt
 * naar ~0.97 (spring, hoge damping, geen bounce-overkill). Geeft dezelfde
 * props-API door als TouchableOpacity (onPress, style, accessibility*,
 * disabled, hitSlop) en accepteert daarnaast alle overige Pressable-props.
 *
 * Respecteert de systeeminstelling voor verminderde beweging: bij
 * reduced motion wordt niet geanimeerd.
 */

import React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

// Eén geanimeerd Pressable-component (geen extra wrapper-View) zodat layout-
// kritische stijlen zoals `flex: 1` of `width: '100%'` zich precies zo
// gedragen als op een gewone TouchableOpacity/Pressable — een tussenliggende
// View zou die stijlen op het verkeerde niveau laten landen.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Zachte, coachende spring: hoge damping en gematigde stiffness geven een
// vlotte terugkeer zonder merkbare overshoot ("geen bounce-overkill").
const SPRING_CONFIG = { damping: 20, stiffness: 300, mass: 0.5 };
const PRESSED_SCALE = 0.97;

interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function PressableScale({
  style,
  children,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn: NonNullable<PressableProps['onPressIn']> = (event) => {
    if (!reducedMotion) {
      scale.value = withSpring(PRESSED_SCALE, SPRING_CONFIG);
    }
    onPressIn?.(event);
  };

  const handlePressOut: NonNullable<PressableProps['onPressOut']> = (event) => {
    if (!reducedMotion) {
      scale.value = withSpring(1, SPRING_CONFIG);
    }
    onPressOut?.(event);
  };

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
