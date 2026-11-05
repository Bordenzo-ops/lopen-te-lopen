/**
 * ShoeEditorSheet
 *
 * Bottom sheet om een paar schoenen toe te voegen of te bewerken (schoenenteller).
 * Bij bewerken kan het paar ook met pensioen (of weer in gebruik) en verwijderd
 * worden. Praat direct met de store; de ouder hoeft alleen visible en onClose
 * te regelen.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Switch, Alert,
} from 'react-native';
import { typography, spacing, radius, type ThemeColors } from '../../theme/tokens';
import { useThemeColors } from '../../theme/useTheme';
import { useAppStore } from '../../store/appStore';
import type { Shoe } from '../../store/appStore';
import { BottomSheet } from './BottomSheet';
import { SheetHandle, SheetCloseButton, SheetGrabZone, useBottomSheet } from './sheetParts';
import { Button } from './Button';
import { DEFAULT_SHOE_LIMIT_KM, activeShoes, isActiveShoe, parseKmInput } from '../../utils/shoes';
import { formatKm } from '../../utils/format';

const NAME_MAX_LENGTH = 40;
const MAX_KM = 20000;

interface ShoeEditorSheetProps {
  visible: boolean;
  /** Het te bewerken paar, of null om een nieuw paar toe te voegen. */
  shoe: Shoe | null;
  onClose: () => void;
}

export function ShoeEditorSheet({ visible, shoe, onClose }: ShoeEditorSheetProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const shoes = useAppStore(s => s.shoes);
  const addShoe = useAppStore(s => s.addShoe);
  const updateShoe = useAppStore(s => s.updateShoe);
  const retireShoe = useAppStore(s => s.retireShoe);
  const reactivateShoe = useAppStore(s => s.reactivateShoe);
  const deleteShoe = useAppStore(s => s.deleteShoe);

  // De ouder wist `shoe` zodra de sheet sluit; houd de laatste waarde vast voor
  // de sluitanimatie, zodat de titel en knoppen niet omslaan.
  const lastShoeRef = useRef(shoe);
  if (visible) lastShoeRef.current = shoe;
  const editing = visible ? shoe : lastShoeRef.current;
  const isEditing = !!editing;
  const isRetired = !!editing && !isActiveShoe(editing);

  const [name, setName] = useState('');
  const [startKmText, setStartKmText] = useState('0');
  const [limitKmText, setLimitKmText] = useState(String(DEFAULT_SHOE_LIMIT_KM));
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Is er al een actieve schoen? Zo niet, dan wordt een nieuw paar altijd de standaard.
  const hasOtherActive = activeShoes(shoes).some(s => s.id !== shoe?.id);
  const mustBeDefault = !isEditing && !hasOtherActive;
  // Hint alleen bij het allereerste paar: bestaande runs tellen niet mee.
  const showStartHint = !isEditing && shoes.length === 0;

  // Velden terugzetten zodra de sheet opent.
  useEffect(() => {
    if (!visible) return;
    setError(null);
    if (shoe) {
      setName(shoe.name);
      setStartKmText(formatKm(shoe.startKm));
      setLimitKmText(formatKm(shoe.limitKm));
      setIsDefault(shoe.isDefault);
    } else {
      setName('');
      setStartKmText('0');
      setLimitKmText(String(DEFAULT_SHOE_LIMIT_KM));
      setIsDefault(!hasOtherActive);
    }
    // hasOtherActive bewust niet als dependency: alleen bij openen initialiseren.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, shoe]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Geef je schoenen een naam.');
      return;
    }
    const startKm = startKmText.trim() === '' ? 0 : parseKmInput(startKmText);
    if (startKm === null || startKm < 0 || startKm > MAX_KM) {
      setError('Vul bij "Al gelopen kilometers" een getal van 0 of hoger in.');
      return;
    }
    const limitKm = limitKmText.trim() === '' ? DEFAULT_SHOE_LIMIT_KM : parseKmInput(limitKmText);
    if (limitKm === null || limitKm < 1 || limitKm > MAX_KM) {
      setError('Vul bij "Slijtagegrens" een getal van 1 of hoger in.');
      return;
    }
    const roundedStart = Math.round(startKm * 10) / 10;
    const roundedLimit = Math.round(limitKm);

    if (shoe) {
      updateShoe(shoe.id, {
        name: trimmed,
        startKm: roundedStart,
        limitKm: roundedLimit,
        ...(isRetired ? {} : { isDefault }),
      });
    } else {
      addShoe({ name: trimmed, startKm: roundedStart, limitKm: roundedLimit, makeDefault: isDefault });
    }
    onClose();
  };

  const handleRetire = () => {
    if (!shoe) return;
    retireShoe(shoe.id);
    onClose();
  };

  const handleReactivate = () => {
    if (!shoe) return;
    reactivateShoe(shoe.id);
    onClose();
  };

  const handleDelete = () => {
    if (!shoe) return;
    Alert.alert(
      'Schoen verwijderen?',
      `Je ${shoe.name} verdwijnen uit de lijst. Runs die eraan gekoppeld waren, houden dan geen schoenen meer. Dit kan niet ongedaan worden gemaakt.`,
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Verwijderen',
          style: 'destructive',
          onPress: () => {
            deleteShoe(shoe.id);
            onClose();
          },
        },
      ],
    );
  };

  return (
    // avoidKeyboard: de velden komen anders onder het toetsenbord te staan.
    <BottomSheet visible={visible} onClose={onClose} avoidKeyboard>
      <SheetGrabZone>
        <SheetHandle />
        <Text style={styles.title}>{isEditing ? 'Schoen bewerken' : 'Schoen toevoegen'}</Text>
      </SheetGrabZone>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Naam</Text>
          <TextInput
            value={name}
            onChangeText={text => { setName(text); setError(null); }}
            maxLength={NAME_MAX_LENGTH}
            placeholder="Bijvoorbeeld: duurloopschoenen"
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
            accessibilityLabel="Naam van de schoen"
          />
        </View>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Al gelopen kilometers</Text>
          <TextInput
            value={startKmText}
            onChangeText={text => { setStartKmText(text); setError(null); }}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
            accessibilityLabel="Al gelopen kilometers op deze schoenen"
          />
          {showStartHint && (
            <Text style={styles.hint}>Al gelopen op dit paar? Vul de kilometers in.</Text>
          )}
        </View>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Slijtagegrens (km)</Text>
          <TextInput
            value={limitKmText}
            onChangeText={text => { setLimitKmText(text); setError(null); }}
            keyboardType="number-pad"
            placeholder={String(DEFAULT_SHOE_LIMIT_KM)}
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
            accessibilityLabel="Slijtagegrens in kilometers"
          />
        </View>

        {!isRetired && (
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={styles.switchLabel}>Standaardschoen</Text>
              <Text style={styles.switchSub}>Nieuwe runs worden automatisch aan dit paar gekoppeld.</Text>
            </View>
            <Switch
              value={mustBeDefault ? true : isDefault}
              onValueChange={setIsDefault}
              disabled={mustBeDefault}
              accessibilityLabel="Standaardschoen"
              trackColor={{ false: colors.borderDefault, true: colors.brandPrimary + '88' }}
              thumbColor={(mustBeDefault || isDefault) ? colors.brandPrimary : colors.textTertiary}
            />
          </View>
        )}

        {error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}

        {isEditing && (
          <View style={styles.secondaryActions}>
            {isRetired ? (
              <Button label="Weer in gebruik nemen" onPress={handleReactivate} variant="secondary" fullWidth />
            ) : (
              <Button label="Met pensioen" onPress={handleRetire} variant="secondary" fullWidth />
            )}
            <Button label="Verwijderen" onPress={handleDelete} variant="ghost" fullWidth />
          </View>
        )}
      </ScrollView>

      <SaveBar
        saveLabel={isEditing ? 'Opslaan' : 'Toevoegen'}
        onSave={handleSave}
      />

      {/* Laatste kind, zie sheetParts. */}
      <SheetCloseButton />
    </BottomSheet>
  );
}

function SaveBar({ saveLabel, onSave }: { saveLabel: string; onSave: () => void }) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { close } = useBottomSheet();
  return (
    <View style={styles.actions}>
      <View style={styles.actionCell}>
        <Button label="Annuleren" onPress={close} variant="secondary" fullWidth />
      </View>
      <View style={styles.actionCell}>
        <Button label={saveLabel} onPress={onSave} fullWidth />
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  title: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: typography.fontSize.xl,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing[1],
    paddingHorizontal: spacing[3],
  },
  scroll: {
    paddingHorizontal: spacing[3],
    paddingTop: spacing[2],
    paddingBottom: spacing[1],
    gap: spacing[2.5],
  },
  block: { gap: spacing[1] },
  blockTitle: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.widest,
  },
  input: {
    minHeight: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgCard,
    paddingHorizontal: spacing[1.5],
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  hint: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1.5],
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderSubtle,
    paddingHorizontal: spacing[1.5], paddingVertical: spacing[1.5],
  },
  switchText: { flex: 1, gap: 2 },
  switchLabel: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  switchSub: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  error: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: typography.fontSize.sm,
    color: colors.error,
  },
  secondaryActions: { gap: spacing[0.5] },
  actions: {
    flexDirection: 'row', gap: spacing[1],
    paddingHorizontal: spacing[3], paddingTop: spacing[2],
  },
  actionCell: { flex: 1 },
});
