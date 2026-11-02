/**
 * BottomSheet
 *
 * Shared bottom sheet: a transparent Modal with its own animations, instead of
 * the Modal's built-in "slide" (which slides the dimming layer along with the
 * sheet, blocks swiping while a handle is shown, and on Android lets the tab
 * bar peek out below the sheet).
 *
 * - The dimming layer fades in/out separately; tapping it closes the sheet.
 * - The sheet slides in from the bottom and can be swiped away by its grab
 *   zone (SheetGrabZone in sheetParts).
 * - The Modal is edge-to-edge (statusBarTranslucent + navigationBarTranslucent)
 *   and the sheet pads its bottom with the safe-area inset.
 * - Reduced motion: no slide, a short fade only. Swiping keeps working.
 *
 * How to migrate a sheet
 *  1. Remove the sheet's own <Modal>, backdrop, KeyboardAvoidingView and
 *     absolute positioning, plus the styles for them (backdrop, wrapper, sheet
 *     background, radius, shadow, bottom padding, maxHeight).
 *  2. Render <BottomSheet visible onClose> around the content. Pass
 *     maxHeight if 88% is not right, and avoidKeyboard if the sheet has a
 *     text input.
 *  3. Wrap the SheetHandle and the title bar in <SheetGrabZone>. Content that
 *     scrolls stays outside it.
 *  4. Keep <SheetCloseButton /> as the LAST child (see sheetParts); without
 *     onPress it closes with animation. Buttons like "Annuleren" call
 *     onClose or useBottomSheet().close().
 *  5. Remove any `if (!visible) return null;`. BottomSheet hides the Modal
 *     itself after the exit animation; returning null early cuts it off. Do
 *     not unmount the sheet from the parent either: toggle `visible`.
 *  6. Close the sheet by setting `visible` to false in the parent (onClose).
 *     BottomSheet animates out on its own whenever `visible` turns false.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View,
} from 'react-native';
import { Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { animation, radius, shadows } from '../../theme/tokens';
import { useThemeColors } from '../../theme/useTheme';
import { haptics } from '../../utils/haptics';
import { BottomSheetContext } from './sheetParts';

export { useBottomSheet } from './sheetParts';

const DISMISS_DISTANCE_FRACTION = 0.25;
const DISMISS_VELOCITY = 800;
// Pulling up resists: the sheet follows the finger at this fraction.
const UPWARD_RESISTANCE = 0.1;

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeight?: `${number}%` | number;
  /** Pad the sheet above the keyboard. Use when the sheet has a text input. */
  avoidKeyboard?: boolean;
  accessibilityLabel?: string;
}

export function BottomSheet({
  visible,
  onClose,
  children,
  maxHeight = '88%',
  avoidKeyboard = false,
  accessibilityLabel,
}: BottomSheetProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  // Keeps the Modal alive while the exit animation runs.
  const [mounted, setMounted] = useState(visible);
  // 0 = hidden, 1 = fully shown.
  const progress = useSharedValue(0);
  // Finger offset while swiping (>= 0 after resistance applied upward).
  const drag = useSharedValue(0);
  const sheetHeight = useSharedValue(Dimensions.get('window').height);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (visible && !mounted) setMounted(true);
  }, [visible, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const duration = reduced ? animation.duration.select : animation.duration.sheet;
    const easing = Easing.out(Easing.cubic);
    if (visible) {
      drag.value = 0;
      progress.value = withTiming(1, { duration, easing });
    } else {
      progress.value = withTiming(0, { duration, easing }, finished => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
  }, [visible, mounted, reduced, progress, drag]);

  const requestClose = useCallback(() => {
    onCloseRef.current();
  }, []);

  const dismissBySwipe = useCallback(() => {
    haptics.tap();
    onCloseRef.current();
  }, []);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-8, 8])
        .onUpdate(e => {
          drag.value = e.translationY < 0 ? e.translationY * UPWARD_RESISTANCE : e.translationY;
        })
        .onEnd(e => {
          const shouldClose =
            drag.value > sheetHeight.value * DISMISS_DISTANCE_FRACTION ||
            e.velocityY > DISMISS_VELOCITY;
          if (shouldClose) {
            // Hand the finger position over to `progress`, so the exit animation
            // continues from where the sheet is instead of jumping.
            const remaining = 1 - Math.min(Math.max(drag.value / sheetHeight.value, 0), 1);
            progress.value = reduced ? 1 : remaining;
            drag.value = 0;
            runOnJS(dismissBySwipe)();
          } else {
            drag.value = withSpring(0, animation.spring);
          }
        }),
    [drag, progress, sheetHeight, reduced, dismissBySwipe],
  );

  const contextValue = useMemo(() => ({ close: requestClose, pan }), [requestClose, pan]);

  const backdropStyle = useAnimatedStyle(() => {
    const pulled = Math.min(Math.max(drag.value / sheetHeight.value, 0), 1);
    return { opacity: progress.value * (1 - pulled) };
  });

  const sheetStyle = useAnimatedStyle(() => {
    if (reduced) {
      return { opacity: progress.value, transform: [{ translateY: drag.value }] };
    }
    return {
      transform: [{ translateY: (1 - progress.value) * sheetHeight.value + drag.value }],
    };
  });

  if (!mounted) return null;

  const Wrapper = avoidKeyboard ? KeyboardAvoidingView : View;
  const wrapperProps = avoidKeyboard ? { behavior: 'padding' as const } : {};

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={requestClose}
    >
      <GestureHandlerRootView style={styles.root}>
        <Animated.View
          style={[styles.backdrop, { backgroundColor: colors.bgOverlay }, backdropStyle]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={requestClose}
            accessibilityRole="button"
            accessibilityLabel="Sluiten"
          />
        </Animated.View>

        <Wrapper style={styles.wrapper} pointerEvents="box-none" {...wrapperProps}>
          <Animated.View
            accessibilityViewIsModal
            accessibilityLabel={accessibilityLabel}
            onLayout={e => { sheetHeight.value = e.nativeEvent.layout.height; }}
            style={[
              styles.sheet,
              {
                backgroundColor: colors.bgSurface,
                maxHeight,
                paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 30 : 20),
              },
              sheetStyle,
            ]}
          >
            <BottomSheetContext.Provider value={contextValue}>
              {children}
            </BottomSheetContext.Provider>
          </Animated.View>
        </Wrapper>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill },
  wrapper: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    ...shadows.lg,
  },
});
