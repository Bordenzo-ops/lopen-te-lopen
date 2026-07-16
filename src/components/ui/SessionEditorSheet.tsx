/**
 * SessionEditorSheet
 *
 * Bottom sheet om een sessie in het vrije schema ("Mijn schema") toe te
 * voegen of te bewerken. Verschijnt vanuit het Schema-tabblad in bewerkmodus.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TouchableWithoutFeedback, ScrollView, TextInput, Platform,
} from 'react-native';
import { X, Minus, Plus } from 'lucide-react-native';
import { typography, spacing, radius, shadows, type ThemeColors } from '../../theme/tokens';
import { useThemeColors } from '../../theme/useTheme';
import { zoneInfo } from '../../data/trainingPlans';
import type { Session, HeartRateZone } from '../../data/trainingPlans';

// ── Constanten ────────────────────────────────────────────────────────────────

type EditableType = 'easy' | 'tempo' | 'long' | 'cross';

const TYPE_OPTIONS: { value: EditableType; label: string }[] = [
  { value: 'easy',  label: 'Rustige duurloop' },
  { value: 'tempo', label: 'Tempoduurloop' },
  { value: 'long',  label: 'Lange duurloop' },
  { value: 'cross', label: 'Cross-training' },
];

const DEFAULT_ZONE_FOR_TYPE: Record<EditableType, HeartRateZone> = {
  easy:  'Z2',
  tempo: 'Z3',
  long:  'Z2',
  cross: 'Z1',
};

const DEFAULT_DESCRIPTION_FOR_TYPE: Record<EditableType, string> = {
  easy:  'Rustige duurloop',
  tempo: 'Tempoduurloop',
  long:  'Lange duurloop',
  cross: 'Cross-training',
};

const DEFAULT_COACHTIP_FOR_TYPE: Record<EditableType, string> = {
  easy:  'Loop dit rustig, op een tempo waarbij je nog een gesprek kunt voeren.',
  tempo: 'Dit mag stevig aanvoelen, maar blijf gecontroleerd. Warm goed op.',
  long:  'Neem de tijd. Dit is je langste sessie: focus op volhouden, niet op snelheid.',
  cross: 'Kies een activiteit die je leuk vindt. Dit spaart je loopspieren.',
};

const DAY_OPTIONS: { value: number; short: string; long: string }[] = [
  { value: 1, short: 'Ma', long: 'maandag' },
  { value: 2, short: 'Di', long: 'dinsdag' },
  { value: 3, short: 'Wo', long: 'woensdag' },
  { value: 4, short: 'Do', long: 'donderdag' },
  { value: 5, short: 'Vr', long: 'vrijdag' },
  { value: 6, short: 'Za', long: 'zaterdag' },
  { value: 7, short: 'Zo', long: 'zondag' },
];

const MIN_DISTANCE_KM = 1;
const MAX_DISTANCE_KM = 45;
const DISTANCE_STEP_KM = 0.5;
const DESCRIPTION_MAX_LENGTH = 40;

// ── Props ─────────────────────────────────────────────────────────────────────

interface SessionEditorSheetProps {
  visible: boolean;
  /** De te bewerken sessie, of null voor een nieuwe sessie. */
  initialSession: Session | null;
  onClose: () => void;
  /**
   * Bij bewerken (initialSession niet null) krijgt de callback de volledige
   * Session terug (id ongewijzigd). Bij een nieuwe sessie krijgt de callback
   * de sessie zonder id: de aanroeper genereert het id.
   */
  onSave: (session: Session | Omit<Session, 'id'>) => void;
}

export function SessionEditorSheet({ visible, initialSession, onClose, onSave }: SessionEditorSheetProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isEditing = !!initialSession;

  const [day, setDay] = useState(1);
  const [type, setType] = useState<EditableType>('easy');
  const [zone, setZone] = useState<HeartRateZone>('Z2');
  const [distanceKm, setDistanceKm] = useState(5);
  const [description, setDescription] = useState(DEFAULT_DESCRIPTION_FOR_TYPE.easy);

  // Zet de velden terug zodra de sheet opent, gebaseerd op de meegegeven sessie
  // (bewerken) of nette standaardwaarden (nieuwe sessie).
  useEffect(() => {
    if (!visible) return;
    if (initialSession) {
      const initType: EditableType = initialSession.type === 'rest' ? 'easy' : initialSession.type;
      setDay(initialSession.day);
      setType(initType);
      setZone(initialSession.zone);
      setDistanceKm(initialSession.distanceKm);
      setDescription(initialSession.description);
    } else {
      setDay(1);
      setType('easy');
      setZone(DEFAULT_ZONE_FOR_TYPE.easy);
      setDistanceKm(5);
      setDescription(DEFAULT_DESCRIPTION_FOR_TYPE.easy);
    }
  }, [visible, initialSession]);

  const handleSelectType = (next: EditableType) => {
    setType(next);
    // Stel een passende zone voor; de gebruiker kan die daarna nog aanpassen.
    setZone(DEFAULT_ZONE_FOR_TYPE[next]);
    setDescription(DEFAULT_DESCRIPTION_FOR_TYPE[next]);
  };

  const handleSave = () => {
    const base = {
      day,
      type,
      distanceKm,
      zone,
      description: description.trim() || DEFAULT_DESCRIPTION_FOR_TYPE[type],
      coachTip: initialSession?.coachTip ?? DEFAULT_COACHTIP_FOR_TYPE[type],
    };
    if (initialSession) {
      onSave({ ...base, id: initialSession.id });
    } else {
      onSave(base);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={styles.sheet}>
        <View style={styles.sheetTop}>
          <View style={styles.handle} />
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Sluiten">
            <X size={20} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>{isEditing ? 'Sessie bewerken' : 'Sessie toevoegen'}</Text>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Dag */}
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Dag</Text>
            <View style={styles.dayRow}>
              {DAY_OPTIONS.map(d => {
                const selected = day === d.value;
                return (
                  <TouchableOpacity
                    key={d.value}
                    onPress={() => setDay(d.value)}
                    activeOpacity={0.8}
                    style={[styles.dayBtn, selected && styles.dayBtnSelected]}
                    accessibilityRole="radio"
                    accessibilityLabel={d.long}
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.dayLabel, selected && styles.dayLabelSelected]}>{d.short}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Type */}
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Type training</Text>
            <View style={styles.typeGrid}>
              {TYPE_OPTIONS.map(opt => {
                const selected = type === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => handleSelectType(opt.value)}
                    activeOpacity={0.8}
                    style={[styles.typeBtn, selected && styles.typeBtnSelected]}
                    accessibilityRole="radio"
                    accessibilityLabel={opt.label}
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.typeBtnText, selected && styles.typeBtnTextSelected]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Zone */}
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Hartslagzone</Text>
            <View style={styles.zoneRow}>
              {(Object.keys(zoneInfo) as HeartRateZone[]).map(z => {
                const selected = zone === z;
                const zColor = zoneInfo[z].color;
                return (
                  <TouchableOpacity
                    key={z}
                    onPress={() => setZone(z)}
                    activeOpacity={0.8}
                    style={[
                      styles.zoneChip,
                      { borderColor: selected ? zColor : colors.borderSubtle },
                      selected && { backgroundColor: zColor + '22' },
                    ]}
                    accessibilityRole="radio"
                    accessibilityLabel={`${z}, ${zoneInfo[z].label}`}
                    accessibilityState={{ selected }}
                  >
                    <View style={[styles.zoneDot, { backgroundColor: zColor }]} />
                    <Text style={[styles.zoneChipText, selected && { color: zColor }]}>{z}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Afstand */}
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Afstand</Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity
                onPress={() => setDistanceKm(v => Math.max(MIN_DISTANCE_KM, Math.round((v - DISTANCE_STEP_KM) * 10) / 10))}
                style={styles.stepperBtn}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Afstand verlagen"
              >
                <Minus size={18} color={colors.textPrimary} strokeWidth={2.5} />
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{distanceKm.toFixed(1)} km</Text>
              <TouchableOpacity
                onPress={() => setDistanceKm(v => Math.min(MAX_DISTANCE_KM, Math.round((v + DISTANCE_STEP_KM) * 10) / 10))}
                style={styles.stepperBtn}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Afstand verhogen"
              >
                <Plus size={18} color={colors.textPrimary} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Omschrijving */}
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Omschrijving</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              maxLength={DESCRIPTION_MAX_LENGTH}
              placeholder={DEFAULT_DESCRIPTION_FOR_TYPE[type]}
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
            />
          </View>
        </ScrollView>

        {/* Acties */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onClose}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Annuleren"
          >
            <Text style={styles.cancelBtnText}>Annuleren</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={isEditing ? 'Opslaan' : 'Sessie toevoegen'}
          >
            <Text style={styles.saveBtnText}>{isEditing ? 'Opslaan' : 'Sessie toevoegen'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: colors.bgSurface,
    borderTopLeftRadius:  radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    maxHeight: '88%',
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    ...shadows.lg,
  },
  sheetTop: {
    alignItems: 'center',
    paddingTop: spacing[1],
    paddingHorizontal: spacing[2],
    flexDirection: 'row',
    justifyContent: 'center',
  },
  handle: {
    width: 40, height: 4,
    backgroundColor: colors.borderDefault,
    borderRadius: radius.full,
  },
  closeBtn: {
    position: 'absolute',
    right: spacing[2],
    top: spacing[1],
    padding: 4,
  },
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
  dayRow: { flexDirection: 'row', gap: 6, justifyContent: 'space-between' },
  dayBtn: {
    flex: 1,
    minWidth: 40,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
  },
  dayBtnSelected: {
    borderColor: colors.brandPrimary,
    backgroundColor: colors.brandPrimary + '11',
  },
  dayLabel: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  dayLabelSelected: { color: colors.brandLight },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1] },
  typeBtn: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[1],
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
  },
  typeBtnSelected: {
    borderColor: colors.brandPrimary,
    backgroundColor: colors.brandPrimary + '11',
  },
  typeBtnText: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  typeBtnTextSelected: { color: colors.brandLight, fontFamily: typography.fontFamily.sansSemi },
  zoneRow: { flexDirection: 'row', gap: spacing[1], flexWrap: 'wrap' },
  zoneChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing[1.5], paddingVertical: spacing[1],
    minHeight: 40,
    borderRadius: radius.full, borderWidth: 1.5,
    backgroundColor: colors.bgCard,
  },
  zoneDot: { width: 8, height: 8, borderRadius: 4 },
  zoneChipText: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  stepperRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[3],
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderSubtle,
    paddingVertical: spacing[1.5],
  },
  stepperBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderDefault,
  },
  stepperValue: {
    minWidth: 84, textAlign: 'center',
    fontFamily: typography.fontFamily.display, fontSize: typography.fontSize.xl,
    color: colors.textPrimary,
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
  actions: {
    flexDirection: 'row', gap: spacing[1],
    paddingHorizontal: spacing[3], paddingTop: spacing[2],
  },
  cancelBtn: {
    flex: 1, minHeight: 48,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderDefault,
  },
  cancelBtnText: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  saveBtn: {
    flex: 1, minHeight: 48,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.xl, backgroundColor: colors.brandPrimary,
  },
  saveBtnText: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.base,
    color: '#fff',
  },
});
