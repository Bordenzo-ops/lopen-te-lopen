/**
 * Tappable
 *
 * The one pressable element for cards, rows and chips. Builds on
 * PressableScale (light scale, spring from the animation tokens, reduced
 * motion respected) and adds a dimmed opacity while pressed plus optional
 * haptic feedback on press.
 */

import React, { useState } from 'react';
import type { GestureResponderEvent, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { PressableScale } from './PressableScale';
import { haptics } from '../../utils/haptics';

const PRESSED_OPACITY = 0.85;

interface TappableProps extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** Haptic fired on press (not on press in). Defaults to none. */
  haptic?: 'tap' | 'select' | 'none';
  /** Scale while pressed. Defaults to 0.98. */
  scaleTo?: number;
}

export function Tappable({
  style,
  children,
  haptic = 'none',
  scaleTo = 0.98,
  disabled,
  accessibilityRole = 'button',
  onPress,
  onPressIn,
  onPressOut,
  ...rest
}: TappableProps) {
  const [pressed, setPressed] = useState(false);

  const handlePress = (event: GestureResponderEvent) => {
    if (!disabled && haptic !== 'none') {
      haptics[haptic]();
    }
    onPress?.(event);
  };

  return (
    <PressableScale
      {...rest}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      scaleTo={scaleTo}
      onPress={handlePress}
      onPressIn={(event) => {
        setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        onPressOut?.(event);
      }}
      style={[style, pressed && !disabled && { opacity: PRESSED_OPACITY }]}
    >
      {children}
    </PressableScale>
  );
}
