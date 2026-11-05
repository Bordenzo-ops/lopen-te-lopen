/**
 * ShoeWearCard
 *
 * Kaart na een run: de schoenen naderen hun slijtagegrens (80%) of hebben die
 * bereikt (100%). Toont zelf niets over "eenmaal tonen": de aanroeper beslist
 * dat via pendingWearAlert en markShoeWearAlertShown.
 *
 * `extraAction` is een bewuste uitbreidingsplek in de 100%-kaart, tussen de
 * tekst en de knoppen, voor later (bijvoorbeeld een optionele extra knop of
 * link). Nu wordt er niets doorgegeven.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Footprints } from 'lucide-react-native';
import { typography, spacing, radius, type ThemeColors } from '../../theme/tokens';
import { useThemeColors } from '../../theme/useTheme';
import type { Shoe } from '../../store/appStore';
import { Card } from './Card';
import { Button } from './Button';
import { kmUntilLimit, roundedRemainingKm, type WearThreshold } from '../../utils/shoes';
import { formatKm } from '../../utils/format';

interface ShoeWearCardProps {
  shoe: Shoe;
  /** Huidige totale kilometers van het paar. */
  km: number;
  threshold: WearThreshold;
  /** "Nieuw paar toevoegen" (alleen in de 100%-kaart). */
  onAddNew: () => void;
  /** "Later" (100%) of "Oké" (80%). */
  onDismiss: () => void;
  /** Optionele extra knop of link in de 100%-kaart. */
  extraAction?: React.ReactNode;
}

export function ShoeWearCard({ shoe, km, threshold, onAddNew, onDismiss, extraAction }: ShoeWearCardProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const kmText = formatKm(Math.round(km));
  const isLimit = threshold === 100;

  return (
    <Card variant="surface" padding="lg" style={styles.card}>
      <View style={styles.header}>
        <Footprints size={20} color={colors.warning} strokeWidth={2} />
        <Text style={styles.title}>
          {isLimit ? 'Tijd voor een nieuw paar?' : `Je ${shoe.name} naderen hun grens`}
        </Text>
      </View>
      <Text style={styles.text}>
        {isLimit
          ? `Je ${shoe.name} hebben ${kmText} km gelopen. De demping is dan meestal op. Een nieuw paar voorkomt blessures.`
          : `Ze hebben al ${kmText} km gelopen. Over zo'n ${formatKm(roundedRemainingKm(kmUntilLimit(km, shoe.limitKm)))} km is het tijd voor een nieuw paar.`}
      </Text>
      {isLimit ? (
        <>
          {extraAction}
          <View style={styles.actions}>
            <View style={styles.actionCell}>
              <Button label="Later" onPress={onDismiss} variant="secondary" fullWidth />
            </View>
            <View style={styles.actionCell}>
              <Button label="Nieuw paar toevoegen" onPress={onAddNew} fullWidth />
            </View>
          </View>
        </>
      ) : (
        <Button label="Oké" onPress={onDismiss} variant="secondary" size="sm" />
      )}
    </Card>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  card: { gap: spacing[1.5], borderWidth: 1, borderColor: colors.warning + '66' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  title: {
    flexShrink: 1,
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  text: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm,
    color: colors.textSecondary, lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
  },
  actions: { flexDirection: 'row', gap: spacing[1], marginTop: spacing[0.5] },
  actionCell: { flex: 1, borderRadius: radius.lg },
});
