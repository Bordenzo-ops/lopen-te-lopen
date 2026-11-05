/**
 * RunShoeRow
 *
 * Regel "Gelopen op: <schoen>" voor een afgeronde run (afrondscherm en
 * run-detail). Tikken opent een keuzesheet met de actieve schoenen en
 * "Geen schoen". Rendert niets zolang er geen enkel paar schoenen is.
 *
 * De run wordt live uit de store opgezocht (zelfde sleutel als clientRunId),
 * omdat de aanroeper vaak een oude kopie van de run vasthoudt.
 *
 * In een andere sheet gebruiken (RunDetailSheet): mount deze regel binnen die
 * sheet, zodat de keuzesheet op iOS als geneste Modal kan verschijnen.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check, ChevronRight } from 'lucide-react-native';
import { typography, spacing, radius, type ThemeColors } from '../../theme/tokens';
import { useThemeColors } from '../../theme/useTheme';
import { useAppStore } from '../../store/appStore';
import type { RunRef } from '../../store/appStore';
import { trackEvent } from '../../services/analyticsService';
import { Tappable } from '../motion/Tappable';
import { BottomSheet } from './BottomSheet';
import { SheetHandle, SheetCloseButton, SheetGrabZone } from './sheetParts';
import { activeShoes, shoeKm } from '../../utils/shoes';
import { formatKm } from '../../utils/format';

interface RunShoeRowProps {
  run: RunRef;
}

export function RunShoeRow({ run }: RunShoeRowProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const shoes = useAppStore(s => s.shoes);
  const completedSessions = useAppStore(s => s.completedSessions);
  const setRunShoe = useAppStore(s => s.setRunShoe);
  const [pickerOpen, setPickerOpen] = useState(false);

  const liveRun = completedSessions.find(
    c => c.sessionId === run.sessionId && c.weekNumber === run.weekNumber && c.completedAt === run.completedAt,
  );
  if (shoes.length === 0 || !liveRun) return null;

  const currentId = liveRun.shoeId;
  const current = shoes.find(s => s.id === currentId);
  const choices = activeShoes(shoes);

  const choose = (shoeId: string | undefined) => {
    setPickerOpen(false);
    if (shoeId === currentId) return;
    setRunShoe(run, shoeId);
    void trackEvent('shoe_switched_on_run');
  };

  return (
    <>
      <Tappable
        style={styles.row}
        onPress={() => setPickerOpen(true)}
        haptic="tap"
        accessibilityRole="button"
        accessibilityLabel={`Gelopen op ${current ? current.name : 'geen schoen'}. Tik om te wijzigen.`}
      >
        <Text style={styles.label} numberOfLines={1}>
          Gelopen op: <Text style={styles.value}>{current ? current.name : 'Geen schoen'}</Text>
        </Text>
        <ChevronRight size={18} color={colors.textTertiary} strokeWidth={2} />
      </Tappable>

      <BottomSheet visible={pickerOpen} onClose={() => setPickerOpen(false)}>
        <SheetGrabZone>
          <SheetHandle />
          <Text style={styles.title}>Gelopen op</Text>
        </SheetGrabZone>

        <View style={styles.list}>
          {choices.map(shoe => (
            <ChoiceRow
              key={shoe.id}
              label={shoe.name}
              sub={`${formatKm(Math.round(shoeKm(shoe, completedSessions)))} van ${formatKm(shoe.limitKm)} km`}
              selected={shoe.id === currentId}
              onPress={() => choose(shoe.id)}
            />
          ))}
          <ChoiceRow
            label="Geen schoen"
            selected={!currentId || !choices.some(s => s.id === currentId)}
            onPress={() => choose(undefined)}
          />
        </View>

        {/* Laatste kind, zie sheetParts. */}
        <SheetCloseButton />
      </BottomSheet>
    </>
  );
}

function ChoiceRow({
  label, sub, selected, onPress,
}: { label: string; sub?: string; selected: boolean; onPress: () => void }) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Tappable
      style={[styles.choice, selected && styles.choiceSelected]}
      onPress={onPress}
      haptic="select"
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
    >
      <View style={styles.choiceText}>
        <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]} numberOfLines={1}>{label}</Text>
        {sub && <Text style={styles.choiceSub}>{sub}</Text>}
      </View>
      {selected && <Check size={18} color={colors.brandLight} strokeWidth={2.5} />}
    </Tappable>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[1],
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderSubtle,
    paddingHorizontal: spacing[2], minHeight: 48,
  },
  label: {
    flex: 1,
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  value: { fontFamily: typography.fontFamily.sansSemi, color: colors.textPrimary },

  title: {
    fontFamily: typography.fontFamily.sansBold, fontSize: typography.fontSize.xl,
    color: colors.textPrimary, textAlign: 'center',
    marginTop: spacing[1], paddingHorizontal: spacing[3],
  },
  list: { paddingHorizontal: spacing[3], paddingTop: spacing[2], gap: spacing[1] },
  choice: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    minHeight: 52, paddingHorizontal: spacing[2], paddingVertical: spacing[1],
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.borderSubtle,
  },
  choiceSelected: {
    borderColor: colors.brandPrimary,
    backgroundColor: colors.brandPrimary + '11',
  },
  choiceText: { flex: 1, gap: 2 },
  choiceLabel: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  choiceLabelSelected: { color: colors.brandLight },
  choiceSub: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
});
