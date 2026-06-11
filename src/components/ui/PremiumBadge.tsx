/**
 * PremiumBadge
 *
 * Klein gouden badge-label naast premium features.
 * Toont "Nu gratis" zolang de betaalmuur niet actief is,
 * en "Premium" zodra PAYWALL_ACTIVE = true.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Crown } from 'lucide-react-native';
import { typography, spacing, radius } from '../../theme/tokens';
import { PREMIUM_CONFIG } from '../../config/premiumConfig';

const GOLD = '#F59E0B';

interface PremiumBadgeProps {
  /** Overschrijf het label in de testfase (default: 'Nu gratis') */
  testLabel?: string;
}

export function PremiumBadge({ testLabel = 'Nu gratis' }: PremiumBadgeProps) {
  const label = PREMIUM_CONFIG.PAYWALL_ACTIVE ? 'Premium' : testLabel;

  return (
    <View style={styles.badge}>
      <Crown size={10} color={GOLD} strokeWidth={2.5} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:             3,
    backgroundColor: `${GOLD}22`,
    paddingHorizontal: 7,
    paddingVertical:   3,
    borderRadius:    radius.full,
    borderWidth:     1,
    borderColor:     `${GOLD}55`,
  },
  text: {
    fontFamily:    typography.fontFamily.sansSemi,
    fontSize:      typography.fontSize.xs,
    color:         GOLD,
    letterSpacing: typography.letterSpacing.wide,
  },
});
