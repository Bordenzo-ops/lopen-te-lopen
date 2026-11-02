/**
 * Haptic feedback with one vocabulary for the whole app.
 *
 * - tap: a button or card was pressed
 * - select: a choice changed (tab, chip, toggle, segment)
 * - success / warning: an action finished, or needs attention
 *
 * Fire-and-forget: devices without a haptic motor reject, which is ignored.
 */

import * as Haptics from 'expo-haptics';

const ignore = () => {};

export const haptics = {
  tap: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(ignore); },
  select: () => { Haptics.selectionAsync().catch(ignore); },
  success: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignore); },
  warning: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(ignore); },
};
