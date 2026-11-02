/**
 * sheetParts
 *
 * Gedeelde chrome van alle bottom sheets: het greepje bovenaan en de
 * sluitknop rechtsboven.
 *
 * Waarom apart: acht sheets hadden elk hun eigen kopie van deze twee
 * onderdelen, inclusief dezelfde fout. De sluitknop stond absoluut
 * gepositioneerd binnen de greeprij, en die rij is maar 12 punten hoog
 * (paddingTop 8 plus het greepje van 4). Een knop van 28 punten steekt daar
 * ruim onderuit. Op iOS werkt zo'n knop nog gewoon, op Android niet: daar
 * levert het systeem geen tikken af buiten de grenzen van de ouder, ook niet
 * met hitSlop. Het kruisje was op Android dus onaanraakbaar terwijl het
 * gewoon stond te wachten, en niets in de code verraadt dat.
 *
 * Daarom staat de sluitknop los van de greeprij. Render hem als LAATSTE kind
 * van de sheet zelf: die is hoog genoeg, dus de knop valt binnen de grenzen
 * van zijn ouder, en als laatste kind ligt hij boven de inhoud.
 *
 *   <BottomSheet visible={visible} onClose={onClose}>
 *     <SheetGrabZone>
 *       <SheetHandle />
 *       ...titelbalk...
 *     </SheetGrabZone>
 *     ...inhoud...
 *     <SheetCloseButton />
 *   </BottomSheet>
 */

import React, { createContext, useContext } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { GestureDetector, type GestureType } from 'react-native-gesture-handler';
import { X } from 'lucide-react-native';
import { spacing, radius } from '../../theme/tokens';
import { useThemeColors } from '../../theme/useTheme';

// Provided by BottomSheet. Lives here (not in BottomSheet.tsx) so the parts
// below can read it without a circular import.
interface BottomSheetContextValue {
  /** Closes the sheet with its exit animation (calls the sheet's onClose). */
  close: () => void;
  /** Swipe-down gesture, attached to the grab zone by SheetGrabZone. */
  pan: GestureType | null;
}

export const BottomSheetContext = createContext<BottomSheetContextValue>({
  close: () => {},
  pan: null,
});

/** Lets children of a BottomSheet close it with animation. */
export function useBottomSheet() {
  return useContext(BottomSheetContext);
}

/**
 * Drag zone at the top of a BottomSheet: wrap the SheetHandle and the title
 * bar in this. Only this zone reacts to the swipe-down gesture, so scrolling
 * the content below keeps working. Outside a BottomSheet it is a plain View.
 */
export function SheetGrabZone({ children }: { children: React.ReactNode }) {
  const { pan } = useBottomSheet();
  if (!pan) return <View>{children}</View>;
  return (
    <GestureDetector gesture={pan}>
      <View>{children}</View>
    </GestureDetector>
  );
}

/** Greepje bovenaan de sheet. Blijft 12 punten hoog, zodat de inhoud
 *  eronder op zijn plaats blijft. */
export function SheetHandle() {
  const colors = useThemeColors();
  return (
    <View style={styles.handleRow}>
      <View style={[styles.handle, { backgroundColor: colors.borderDefault }]} />
    </View>
  );
}

/**
 * Sluitknop rechtsboven. Moet het laatste kind van de sheet zijn, zie boven.
 */
export function SheetCloseButton({
  onPress,
  accessibilityLabel = 'Sluiten',
}: {
  /** Optional: inside a BottomSheet the default closes it with animation. */
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const colors = useThemeColors();
  const { close } = useBottomSheet();
  return (
    <TouchableOpacity
      style={styles.closeBtn}
      onPress={onPress ?? close}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <X size={20} color={colors.textSecondary} strokeWidth={2} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  handleRow: {
    alignItems: 'center',
    paddingTop: spacing[1],
    paddingHorizontal: spacing[2],
    flexDirection: 'row',
    justifyContent: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: radius.full,
  },
  closeBtn: {
    position: 'absolute',
    top: 0,
    // 44x44 is het aanraakvlak dat Apple en Google allebei als minimum
    // aanraden; hitSlop is dan niet meer nodig. De rechtermarge is zo
    // gekozen dat de rechterkant van het kruisje (12 + 12) uitkomt op de
    // inhoudsmarge van de sheets, spacing[3] = 24.
    right: spacing[1.5],
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    // Ligt over de inhoud heen, ook als die er (op Android) later overheen
    // getekend zou worden.
    zIndex: 10,
  },
});
