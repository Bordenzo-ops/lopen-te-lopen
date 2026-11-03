/**
 * useLastValue
 *
 * Returns the last non-null value it was given. Used by bottom sheets whose
 * parent clears the data in the same render that it closes the sheet: the
 * content keeps rendering from the last value while the exit animation of
 * BottomSheet runs, instead of vanishing or flipping.
 */

import { useRef } from 'react';

export function useLastValue<T>(value: T | null | undefined): T | null {
  const ref = useRef<T | null>(null);
  if (value != null) ref.current = value;
  return ref.current;
}
