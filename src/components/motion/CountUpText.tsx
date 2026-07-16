/**
 * CountUpText
 *
 * Telt een numerieke waarde bij mount (of bij waardeverandering) op van 0
 * naar de eindwaarde in ~600ms, met een zacht ease-out verloop. Draait op
 * een reanimated shared value; de React-tekst wordt bijgewerkt via
 * useAnimatedReaction, doelbewust gethrottled tot hooguit ~20x per seconde
 * (geen setState per animatieframe op 60fps).
 *
 * Respecteert de systeeminstelling voor verminderde beweging: bij reduced
 * motion verschijnt direct de eindwaarde, zonder telanimatie.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const DEFAULT_DURATION_MS = 600;
// Throttle voor de JS-kant: max. 1 update per 50ms (~20x per seconde).
const UPDATE_INTERVAL_MS = 50;

interface CountUpTextProps {
  value: number;
  /** Formatteert de (tussentijdse) waarde naar tekst. Standaard: afgerond geheel getal. */
  format?: (n: number) => string;
  textStyle?: StyleProp<TextStyle>;
  duration?: number;
  numberOfLines?: number;
}

const defaultFormat = (n: number) => String(Math.round(n));

export function CountUpText({
  value,
  format = defaultFormat,
  textStyle,
  duration = DEFAULT_DURATION_MS,
  numberOfLines,
}: CountUpTextProps) {
  const reducedMotion = useReducedMotion();
  const animated = useSharedValue(reducedMotion ? value : 0);
  const lastEmitAt = useSharedValue(0);
  const [displayValue, setDisplayValue] = useState(reducedMotion ? value : 0);
  // Bewaart de meest recente format-functie zonder de animatie-effect opnieuw
  // te laten triggeren wanneer de aanroeper een nieuwe inline-functie meegeeft.
  const formatRef = useRef(format);
  formatRef.current = format;

  useEffect(() => {
    if (reducedMotion) {
      animated.value = value;
      setDisplayValue(value);
      return;
    }
    animated.value = withTiming(
      value,
      { duration, easing: Easing.out(Easing.cubic) },
      (finished) => {
        'worklet';
        // Garandeert dat de exacte eindwaarde altijd getoond wordt, ook als
        // de gethrottelde reactie hieronder de laatste frame(s) miste.
        if (finished) {
          runOnJS(setDisplayValue)(value);
        }
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reducedMotion, duration]);

  useAnimatedReaction(
    () => animated.value,
    (current) => {
      const now = Date.now();
      if (now - lastEmitAt.value >= UPDATE_INTERVAL_MS) {
        lastEmitAt.value = now;
        runOnJS(setDisplayValue)(current);
      }
    },
  );

  return (
    <Text style={textStyle} numberOfLines={numberOfLines}>
      {formatRef.current(displayValue)}
    </Text>
  );
}
