/**
 * PremiumBadge
 *
 * Klein gouden badge-label naast premium features.
 * Toont "Nu gratis" zolang de betaalmuur niet actief is,
 * en "Premium" zodra PAYWALL_ACTIVE = true.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Crown } from 'lucide-react-native';
import { typography, spacing, radius, type ThemeColors } from '../../theme/tokens';
import { useThemeColors } from '../../theme/useTheme';
import { PREMIUM_CONFIG } from '../../config/premiumConfig';

interface PremiumBadgeProps {
  /** Overschrijf het label in de testfase (default: 'Nu gratis') */
  testLabel?: string;
}

export function PremiumBadge({ testLabel = 'Nu gratis' }: PremiumBadgeProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const label = PREMIUM_CONFIG.PAYWALL_ACTIVE ? 'Premium' : testLabel;

  return (
    <View style={styles.badge}>
      <Crown size={10} color={colors.premium} strokeWidth={2.5} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  badge: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:             3,
    backgroundColor: `${colors.premium}22`,
    paddingHorizontal: 7,
    paddingVertical:   3,
    borderRadius:    radius.full,
    borderWidth:     1,
    borderColor:     `${colors.premium}55`,
  },
  text: {
    fontFamily:    typography.fontFamily.sansSemi,
    fontSize:      typography.fontSize.xs,
    color:         colors.premium,
    letterSpacing: typography.letterSpacing.wide,
  },
});
