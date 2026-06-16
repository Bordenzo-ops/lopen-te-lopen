import React, { useState, useEffect } from 'react';
import {
  View, Text, Switch, TouchableOpacity, StyleSheet, ScrollView,
  Alert, TextInput, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Volume2, RefreshCw, Pencil, Check, X, ExternalLink } from 'lucide-react-native';
import { colors, typography, spacing, radius } from '../../src/theme/tokens';
import { useAppStore } from '../../src/store/appStore';
import { zoneInfo } from '../../src/data/trainingPlans';
import * as voiceService from '../../src/services/voiceService';
import type { VoiceType } from '../../src/config/voiceConfig';
import { router } from 'expo-router';
import { Minus, Plus } from 'lucide-react-native';

// ── Bewerkbare rij ─────────────────────────────────────────────────────────

function EditableRow({
  label,
  value,
  onSave,
  keyboardType = 'default',
  maxLength = 40,
  suffix,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  keyboardType?: 'default' | 'numeric';
  maxLength?: number;
  suffix?: string;
}) {
  const [editing, setEditing]   = useState(false);
  const [draft, setDraft]       = useState(value);

  // Sync draft met de store-waarde zodra die extern verandert (bijv. na reset)
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  function handleSave() {
    const trimmed = draft.trim();
    if (trimmed.length === 0) {
      setDraft(value);
      setEditing(false);
      return;
    }
    onSave(trimmed);
    setEditing(false);
  }

  function handleCancel() {
    setDraft(value);
    setEditing(false);
  }

  if (editing) {
    return (
      <View style={styles.editRow}>
        <Text style={styles.rowLabel}>{label}</Text>
        <View style={styles.editInputRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            keyboardType={keyboardType}
            maxLength={maxLength}
            autoFocus
            selectTextOnFocus
            style={styles.editInput}
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />
          <TouchableOpacity onPress={handleSave} style={styles.editActionBtn} hitSlop={12} accessibilityRole="button" accessibilityLabel="Opslaan">
            <Check size={18} color={colors.success} strokeWidth={2.5} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleCancel} style={styles.editActionBtn} hitSlop={12} accessibilityRole="button" accessibilityLabel="Annuleren">
            <X size={18} color={colors.error} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity style={styles.row} onPress={() => { setDraft(value); setEditing(true); }} activeOpacity={0.7}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowValueRow}>
        <Text style={styles.rowValue}>{suffix ? `${value} ${suffix}` : value}</Text>
        <Pencil size={14} color={colors.textTertiary} strokeWidth={2} />
      </View>
    </TouchableOpacity>
  );
}

// ── Leeftijdstepper in instellingen ────────────────────────────────────────

function AgeStepperRow({
  age,
  onSave,
}: { age: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(age);

  useEffect(() => {
    if (!editing) setDraft(age);
  }, [age, editing]);

  function adjust(delta: number) {
    setDraft(a => Math.max(14, Math.min(80, a + delta)));
  }

  if (!editing) {
    return (
      <TouchableOpacity style={styles.row} onPress={() => { setDraft(age); setEditing(true); }} activeOpacity={0.7}>
        <Text style={styles.rowLabel}>Leeftijd</Text>
        <View style={styles.rowValueRow}>
          <Text style={styles.rowValue}>{age} jaar</Text>
          <Pencil size={14} color={colors.textTertiary} strokeWidth={2} />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.editRow}>
      <Text style={styles.rowLabel}>Leeftijd</Text>
      <View style={styles.stepperEditRow}>
        <View style={styles.stepper}>
          <TouchableOpacity onPress={() => adjust(-1)} style={styles.stepperBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel="Leeftijd verlagen">
            <Minus size={18} color={colors.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.stepperValue}>{draft}</Text>
          <TouchableOpacity onPress={() => adjust(1)} style={styles.stepperBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel="Leeftijd verhogen">
            <Plus size={18} color={colors.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => { onSave(draft); setEditing(false); }} style={styles.editActionBtn} hitSlop={12} accessibilityRole="button" accessibilityLabel="Opslaan">
          <Check size={18} color={colors.success} strokeWidth={2.5} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setEditing(false)} style={styles.editActionBtn} hitSlop={12} accessibilityRole="button" accessibilityLabel="Annuleren">
          <X size={18} color={colors.error} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Hoofdscherm ────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const profile       = useAppStore(s => s.profile);
  const updateProfile = useAppStore(s => s.updateProfile);
  const resetProgress = useAppStore(s => s.resetProgress);
  if (!profile) return null;

  const maxHr = profile.maxHeartRate;

  const goalLabel: Record<string, string> = {
    '5km': '5 KM', '10km': '10 KM',
    'half_marathon': 'Halve marathon', 'marathon': 'Marathon',
  };

  const handleReset = () => {
    Alert.alert(
      'Voortgang resetten',
      'Weet je zeker dat je alle voortgang wilt verwijderen? Dit kan niet ongedaan worden gemaakt.',
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Alles wissen',
          style: 'destructive',
          onPress: async () => {
            await resetProgress();
            router.replace('/');
          },
        },
      ],
    );
  };

  function saveName(name: string) {
    updateProfile({ name: name.slice(0, 40) });
  }

  function saveAge(age: number) {
    const clamped = Math.max(14, Math.min(80, age));
    updateProfile({ age: clamped, maxHeartRate: 220 - clamped });
  }

  function saveMaxHr(raw: string) {
    const val = parseInt(raw);
    if (isNaN(val) || val < 140 || val > 220) {
      Alert.alert('Controleer je invoer', 'Vul een hartslag in tussen 140 en 220 bpm.');
      return;
    }
    updateProfile({ maxHeartRate: val });
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Instellingen</Text>

          {/* Profiel */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Profiel</Text>
            <View style={styles.card}>
              <EditableRow
                label="Naam"
                value={profile.name}
                onSave={saveName}
                maxLength={40}
              />
              <Divider />
              <AgeStepperRow age={profile.age} onSave={saveAge} />
              <Divider />
              <EditableRow
                label="Max. hartslag"
                value={String(maxHr)}
                onSave={saveMaxHr}
                keyboardType="numeric"
                maxLength={3}
                suffix="bpm"
              />
              <Divider />
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Huidig doel</Text>
                <Text style={styles.rowValue}>{goalLabel[profile.goal] ?? profile.goal}</Text>
              </View>
            </View>
            <Text style={styles.fieldNote}>
              Max. hartslag wordt automatisch herberekend als je je leeftijd aanpast. Heb je een nauwkeurige meting? Pas de waarde direct aan.
            </Text>
          </View>

          {/* Hartslagzones */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Hartslagzones</Text>
            <View style={styles.card}>
              {(Object.entries(zoneInfo) as Array<[keyof typeof zoneInfo, typeof zoneInfo[keyof typeof zoneInfo]]>).map(([zone, info], i, arr) => (
                <React.Fragment key={zone}>
                  <View style={styles.zoneRow}>
                    <View style={[styles.zoneDot, { backgroundColor: info.color }]} />
                    <View style={styles.zoneInfo}>
                      <Text style={styles.zoneLabel}>{zone} · {info.label}</Text>
                      <Text style={styles.zonePct}>{info.pct}</Text>
                    </View>
                    <Text style={styles.zoneBpm}>
                      {Math.round(maxHr * parseFloat(info.pct.split('-')[0]) / 100)} – {Math.round(maxHr * parseFloat(info.pct.split('-')[1]) / 100)} bpm
                    </Text>
                  </View>
                  {i < arr.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </View>
          </View>

          {/* Begeleiding */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Begeleiding tijdens het lopen</Text>
            <View style={styles.card}>
              <View style={styles.switchRow}>
                <Volume2 size={18} color={colors.textSecondary} strokeWidth={2} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>Gesproken begeleiding</Text>
                  <Text style={styles.switchSub}>Hartslagzone, kilometer-updates en aanmoedigingen</Text>
                </View>
                <Switch
                  value={profile.voiceGuidance}
                  onValueChange={v => updateProfile({ voiceGuidance: v })}
                  accessibilityLabel="Gesproken begeleiding"
                  trackColor={{ false: colors.borderDefault, true: colors.brandPrimary + '88' }}
                  thumbColor={profile.voiceGuidance ? colors.brandPrimary : colors.textTertiary}
                />
              </View>
              {profile.voiceGuidance && (
                <>
                  <Divider />
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Stem</Text>
                    <View style={styles.voiceToggle}>
                      {(['female', 'male'] as VoiceType[]).map(type => {
                        const isActive = (profile.voiceType ?? 'female') === type;
                        return (
                          <TouchableOpacity
                            key={type}
                            onPress={() => {
                              updateProfile({ voiceType: type });
                              voiceService.speak(
                                'Hoi! Ik ben je hardloopcoach. Zo klink ik tijdens het lopen.',
                                type,
                              );
                            }}
                            style={[styles.voiceToggleBtn, isActive && styles.voiceToggleBtnActive]}
                            activeOpacity={0.8}
                            accessibilityRole="radio"
                            accessibilityLabel={type === 'female' ? 'Vrouwenstem' : 'Mannenstem'}
                            accessibilityState={{ selected: isActive }}
                          >
                            <Text style={[styles.voiceToggleLabel, isActive && styles.voiceToggleLabelActive]}>
                              {type === 'female' ? 'Vrouw' : 'Man'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </>
              )}
            </View>
            {profile.voiceGuidance && (
              <Text style={styles.fieldNote}>
                Tik op een stem om die te beluisteren.
              </Text>
            )}
          </View>

          {/* Integraties */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Integraties (binnenkort)</Text>
            <View style={styles.card}>
              {[
                { name: 'Strava',            icon: '🟠' },
                { name: 'Garmin Connect',    icon: '🟢' },
                { name: 'Apple Health',      icon: '❤️' },
                { name: 'Google Fit',        icon: '🔵' },
                { name: 'Xiaomi Mi Fitness', icon: '🟡' },
              ].map((integration, i, arr) => (
                <React.Fragment key={integration.name}>
                  <View style={[styles.integrationRow, styles.integrationRowDisabled]}>
                    <Text style={styles.integrationIcon}>{integration.icon}</Text>
                    <Text style={[styles.integrationName, styles.integrationNameMuted]}>{integration.name}</Text>
                    <View style={styles.soonPill}>
                      <Text style={styles.soonPillText}>binnenkort</Text>
                    </View>
                  </View>
                  {i < arr.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </View>
          </View>

          {/* Overige */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Overige</Text>
            <View style={styles.card}>
              <TouchableOpacity
                onPress={() => Linking.openURL('https://bordenzo-ops.github.io/lopen-te-lopen/privacy-policy.html')}
                style={styles.row}
                activeOpacity={0.7}
              >
                <Text style={styles.rowLabel}>Privacybeleid</Text>
                <ExternalLink size={14} color={colors.textTertiary} strokeWidth={2} />
              </TouchableOpacity>
              <Divider />
              <TouchableOpacity onPress={handleReset} style={styles.dangerRow} activeOpacity={0.7}>
                <RefreshCw size={16} color={colors.error} strokeWidth={2} />
                <Text style={styles.dangerLabel}>Voortgang resetten</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.version}>Lopen te Lopen v1.0.0</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  scroll: { paddingHorizontal: spacing[3], paddingTop: spacing[2], paddingBottom: spacing[8], gap: spacing[2] },
  title: {
    fontFamily: typography.fontFamily.display, fontSize: typography.fontSize['2xl'],
    color: colors.textPrimary, letterSpacing: typography.letterSpacing.tight, marginBottom: spacing[1],
  },
  section: { gap: spacing[1] },
  sectionLabel: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.xs,
    color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.widest,
    paddingHorizontal: spacing[0.5],
  },
  fieldNote: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs,
    color: colors.textTertiary, paddingHorizontal: spacing[0.5], lineHeight: typography.fontSize.xs * 1.6,
  },
  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[2], paddingVertical: spacing[1.5],
  },
  rowValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowLabel: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.base, color: colors.textSecondary,
  },
  rowValue: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.base, color: colors.textPrimary,
  },
  divider: { height: 1, backgroundColor: colors.borderSubtle, marginHorizontal: spacing[2] },

  // Bewerkbare rij
  editRow: {
    paddingHorizontal: spacing[2], paddingVertical: spacing[1.5], gap: spacing[1],
  },
  editInputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  editInput: {
    flex: 1, backgroundColor: colors.bgSurface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.brandPrimary + '66',
    paddingHorizontal: spacing[1.5], paddingVertical: spacing[1],
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.base, color: colors.textPrimary,
  },
  editActionBtn: { padding: 4 },

  // Leeftijdstepper
  stepperEditRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  stepper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgSurface, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.borderDefault, overflow: 'hidden',
  },
  stepperBtn: { padding: spacing[1], paddingHorizontal: spacing[1.5] },
  stepperValue: {
    fontFamily: typography.fontFamily.sansBold, fontSize: typography.fontSize.lg,
    color: colors.textPrimary, minWidth: 44, textAlign: 'center',
  },

  switchRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1.5],
    paddingHorizontal: spacing[2], paddingVertical: spacing[1.5],
  },
  switchLabel: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.base, color: colors.textPrimary,
  },
  switchSub: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs, color: colors.textSecondary, marginTop: 2,
  },
  voiceToggle: {
    flexDirection: 'row', backgroundColor: colors.bgSurface,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSubtle,
    padding: 3, gap: 3,
  },
  voiceToggleBtn: {
    paddingHorizontal: spacing[2], minHeight: 38,
    alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm,
  },
  voiceToggleBtnActive: { backgroundColor: colors.brandPrimary },
  voiceToggleLabel: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  voiceToggleLabelActive: { color: '#fff' },
  zoneRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1.5],
    paddingHorizontal: spacing[2], paddingVertical: spacing[1.5],
  },
  zoneDot: { width: 10, height: 10, borderRadius: 5 },
  zoneInfo: { flex: 1 },
  zoneLabel: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.sm, color: colors.textPrimary,
  },
  zonePct: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs, color: colors.textSecondary,
  },
  zoneBpm: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.xs, color: colors.textSecondary,
  },
  integrationRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1.5],
    paddingHorizontal: spacing[2], paddingVertical: spacing[1.5],
  },
  integrationRowDisabled: { opacity: 0.6 },
  integrationIcon: { fontSize: 20 },
  integrationName: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.base, color: colors.textPrimary, flex: 1,
  },
  integrationNameMuted: { color: colors.textSecondary },
  soonPill: {
    backgroundColor: colors.brandPrimary + '22',
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1, borderColor: colors.brandPrimary + '44',
  },
  soonPillText: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.xs,
    color: colors.brandPrimary, letterSpacing: 0.3,
  },
  dangerRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1.5],
    paddingHorizontal: spacing[2], paddingVertical: spacing[1.5],
  },
  dangerLabel: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.base, color: colors.error,
  },
  version: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs,
    color: colors.textTertiary, textAlign: 'center', marginTop: spacing[2],
  },
});
