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
 *   <View style={styles.sheet}>
 *     <SheetHandle />
 *     ...inhoud...
 *     <SheetCloseButton onPress={onClose} />
 *   </View>
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { X } from 'lucide-react-native';
import { spacing, radius } from '../../theme/tokens';
import { useThemeColors } from '../../theme/useTheme';

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
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const colors = useThemeColors();
  return (
    <TouchableOpacity
      style={styles.closeBtn}
      onPress={onPress}
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
