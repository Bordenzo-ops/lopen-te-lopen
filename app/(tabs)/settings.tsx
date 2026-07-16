import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, Switch, TouchableOpacity, StyleSheet, ScrollView,
  Alert, TextInput, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Volume2, RefreshCw, Pencil, Check, X, ExternalLink, Link2, Sun, Moon, Smartphone, Cloud, Activity, Bell } from 'lucide-react-native';
import { typography, spacing, radius, type ThemeColors } from '../../src/theme/tokens';
import { useThemeColors } from '../../src/theme/useTheme';
import { useAppStore } from '../../src/store/appStore';
import { zoneInfo, DEFAULT_TRAINING_DAYS } from '../../src/data/trainingPlans';
import * as voiceService from '../../src/services/voiceService';
import type { VoiceType } from '../../src/config/voiceConfig';
import { router } from 'expo-router';
import { Minus, Plus } from 'lucide-react-native';
import { usePremium } from '../../src/hooks/usePremium';
import { PremiumBadge } from '../../src/components/ui/PremiumBadge';
import { connectStrava, disconnectStrava, isStravaConfigured } from '../../src/services/stravaService';
import { enableHealthConnect, isHealthConnectAvailable } from '../../src/services/healthConnectService';
import {
  requestNotificationPermission,
  scheduleTrainingReminders,
  cancelAllReminders,
  refreshWeeklyNotifications,
} from '../../src/services/notificationService';

/** Beschikbare tijdstippen voor de trainingsherinnering (geen picker-package nodig). */
const REMINDER_HOURS = [7, 8, 12, 18] as const;

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
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
  const themePreference = useAppStore(s => s.themePreference);
  const setThemePreference = useAppStore(s => s.setThemePreference);
  const { hasAccess, goToPaywall } = usePremium();
  const cloudSyncEnabled    = useAppStore(s => s.cloudSyncEnabled);
  const setCloudSyncEnabled = useAppStore(s => s.setCloudSyncEnabled);
  const syncStatus          = useAppStore(s => s.syncStatus);
  const lastSyncedAt        = useAppStore(s => s.lastSyncedAt);
  const stravaConnected     = useAppStore(s => s.stravaConnected);
  const stravaAthleteName   = useAppStore(s => s.stravaAthleteName);
  const stravaAutoUpload    = useAppStore(s => s.stravaAutoUpload);
  const setStravaAutoUpload = useAppStore(s => s.setStravaAutoUpload);
  const [stravaBusy, setStravaBusy] = useState(false);
  const healthConnectEnabled    = useAppStore(s => s.healthConnectEnabled);
  const setHealthConnectEnabled = useAppStore(s => s.setHealthConnectEnabled);
  const [healthConnectBusy, setHealthConnectBusy] = useState(false);
  const autoPauseEnabled    = useAppStore(s => s.autoPauseEnabled);
  const setAutoPauseEnabled = useAppStore(s => s.setAutoPauseEnabled);
  const completedSessions   = useAppStore(s => s.completedSessions);
  const remindersEnabled    = useAppStore(s => s.remindersEnabled);
  const setRemindersEnabled = useAppStore(s => s.setRemindersEnabled);
  const reminderHour        = useAppStore(s => s.reminderHour);
  const setReminderHour     = useAppStore(s => s.setReminderHour);
  const [remindersBusy, setRemindersBusy] = useState(false);
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (!profile) return null;

  const maxHr = profile.maxHeartRate;

  const goalLabel: Record<string, string> = {
    '5km': '5 KM', '10km': '10 KM', '15km': '15 KM',
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

  async function handleConnectStrava() {
    if (!isStravaConfigured()) {
      Alert.alert(
        'Strava-koppeling nog niet ingesteld',
        'De Strava-koppeling voor deze app moet nog ingesteld worden. Zie docs/STRAVA_SETUP.md.',
      );
      return;
    }
    setStravaBusy(true);
    try {
      const result = await connectStrava();
      if (!result.ok) {
        Alert.alert('Verbinden mislukt', result.message ?? 'Er ging iets mis bij het verbinden met Strava.');
      }
    } finally {
      setStravaBusy(false);
    }
  }

  function handleDisconnectStrava() {
    Alert.alert(
      'Strava ontkoppelen',
      'Weet je zeker dat je de koppeling met Strava wilt verbreken? Runs worden dan niet meer automatisch geupload.',
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Ontkoppelen',
          style: 'destructive',
          onPress: async () => {
            setStravaBusy(true);
            try {
              await disconnectStrava();
            } finally {
              setStravaBusy(false);
            }
          },
        },
      ],
    );
  }

  async function handleToggleHealthConnect(value: boolean) {
    if (!value) {
      setHealthConnectEnabled(false);
      return;
    }
    setHealthConnectBusy(true);
    try {
      const success = await enableHealthConnect();
      if (success) {
        setHealthConnectEnabled(true);
      } else {
        setHealthConnectEnabled(false);
        Alert.alert(
          'Health Connect niet ingeschakeld',
          'We konden geen toestemming krijgen voor Health Connect. Controleer of Health Connect op je toestel geinstalleerd is en of je toestemming hebt gegeven.',
        );
      }
    } finally {
      setHealthConnectBusy(false);
    }
  }

  async function handleToggleReminders(value: boolean) {
    if (!value) {
      setRemindersEnabled(false);
      void cancelAllReminders();
      return;
    }
    setRemindersBusy(true);
    try {
      const granted = await requestNotificationPermission();
      if (!granted) {
        setRemindersEnabled(false);
        Alert.alert(
          'Meldingen niet toegestaan',
          'We konden geen toestemming krijgen voor meldingen. Je kunt dit later alsnog inschakelen via de instellingen van je toestel.',
        );
        return;
      }
      setRemindersEnabled(true);
      await scheduleTrainingReminders(profile?.trainingDays ?? DEFAULT_TRAINING_DAYS, reminderHour);
      // Bereken direct de actuele streak- en weekoverzicht-status, zodat de
      // gebruiker niet hoeft te wachten tot de volgende voltooide sessie.
      await refreshWeeklyNotifications(completedSessions);
    } finally {
      setRemindersBusy(false);
    }
  }

  async function handleChangeReminderHour(hour: number) {
    setReminderHour(hour);
    if (remindersEnabled) {
      await scheduleTrainingReminders(profile?.trainingDays ?? DEFAULT_TRAINING_DAYS, hour);
    }
  }

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

          {/* Weergave */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Weergave</Text>
            <View style={styles.card}>
              <View style={styles.themeRow}>
                {([
                  { key: 'system', label: 'Systeem', icon: Smartphone },
                  { key: 'light',  label: 'Licht',   icon: Sun },
                  { key: 'dark',   label: 'Donker',  icon: Moon },
                ] as const).map(opt => {
                  const active = themePreference === opt.key;
                  const Icon = opt.icon;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.themeBtn, active && styles.themeBtnActive]}
                      onPress={() => setThemePreference(opt.key)}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={`Thema ${opt.label}`}
                      accessibilityState={{ selected: active }}
                    >
                      <Icon size={18} color={active ? '#fff' : colors.textSecondary} strokeWidth={2} />
                      <Text style={[styles.themeBtnText, active && styles.themeBtnTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <Text style={styles.fieldNote}>
              Kies Licht voor betere leesbaarheid buiten in fel daglicht. Systeem volgt de instelling van je telefoon.
            </Text>
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
              <Divider />
              <View style={styles.switchRow}>
                <Activity size={18} color={colors.textSecondary} strokeWidth={2} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>Auto-pauze</Text>
                  <Text style={styles.switchSub}>Pauzeert de timer automatisch als je stilstaat</Text>
                </View>
                <Switch
                  value={autoPauseEnabled}
                  onValueChange={setAutoPauseEnabled}
                  accessibilityLabel="Auto-pauze"
                  trackColor={{ false: colors.borderDefault, true: colors.brandPrimary + '88' }}
                  thumbColor={autoPauseEnabled ? colors.brandPrimary : colors.textTertiary}
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
            {profile.voiceGuidance && !hasAccess && (
              <TouchableOpacity
                onPress={goToPaywall}
                style={styles.premiumVoiceNote}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Premium-stemmen ontgrendelen"
              >
                <PremiumBadge />
                <Text style={styles.premiumVoiceText}>
                  Met gratis hoor je de stem van je telefoon. Premium-stemmen klinken natuurlijker en warmer. Tik om premium te bekijken.
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Herinneringen */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Herinneringen</Text>
            <View style={styles.card}>
              <View style={styles.switchRow}>
                <Bell size={18} color={colors.textSecondary} strokeWidth={2} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>Trainingsherinneringen</Text>
                  <Text style={styles.switchSub}>
                    Een melding op je trainingsdagen, plus een seintje als je dreigt je wekelijkse streak te missen
                  </Text>
                </View>
                <Switch
                  value={remindersEnabled}
                  onValueChange={handleToggleReminders}
                  disabled={remindersBusy}
                  accessibilityLabel="Trainingsherinneringen"
                  trackColor={{ false: colors.borderDefault, true: colors.brandPrimary + '88' }}
                  thumbColor={remindersEnabled ? colors.brandPrimary : colors.textTertiary}
                />
              </View>
              {remindersEnabled && (
                <>
                  <Divider />
                  <View style={styles.reminderTimeSection}>
                    <Text style={styles.rowLabel}>Tijdstip</Text>
                    <View style={styles.timeRow}>
                      {REMINDER_HOURS.map(h => {
                        const active = reminderHour === h;
                        return (
                          <TouchableOpacity
                            key={h}
                            style={[styles.timeBtn, active && styles.timeBtnActive]}
                            onPress={() => handleChangeReminderHour(h)}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                            accessibilityLabel={`Tijdstip ${String(h).padStart(2, '0')}:00`}
                            accessibilityState={{ selected: active }}
                          >
                            <Text style={[styles.timeBtnText, active && styles.timeBtnTextActive]}>
                              {String(h).padStart(2, '0')}:00
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </>
              )}
            </View>
            <Text style={styles.fieldNote}>
              We vragen eenmalig toestemming voor meldingen. Zet je toestemming later uit via je toestelinstellingen, dan werkt deze schakelaar niet meer.
            </Text>
          </View>

          {/* Koppelingen */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Koppelingen</Text>
            <View style={styles.card}>
              {!stravaConnected ? (
                <View style={styles.integrationRow}>
                  <Activity size={18} color={colors.textSecondary} strokeWidth={2} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchLabel}>Strava</Text>
                    <Text style={styles.switchSub}>
                      {isStravaConfigured()
                        ? 'Verbind je account om runs automatisch te uploaden.'
                        : 'De setup voor Strava moet nog gebeuren. Zie docs/STRAVA_SETUP.md.'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleConnectStrava}
                    style={styles.stravaConnectBtn}
                    activeOpacity={0.85}
                    disabled={stravaBusy}
                    accessibilityRole="button"
                    accessibilityLabel="Verbind met Strava"
                  >
                    <Text style={styles.stravaConnectBtnText}>
                      {stravaBusy ? 'Bezig...' : 'Verbind met Strava'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={styles.integrationRow}>
                    <Activity size={18} color={colors.success} strokeWidth={2} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.switchLabel}>{stravaAthleteName ?? 'Strava'}</Text>
                      <Text style={styles.switchSub}>Verbonden</Text>
                    </View>
                  </View>
                  <Divider />
                  <View style={styles.switchRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.switchLabel}>Upload runs automatisch</Text>
                      <Text style={styles.switchSub}>Voltooide runs gaan direct naar Strava</Text>
                    </View>
                    <Switch
                      value={stravaAutoUpload}
                      onValueChange={setStravaAutoUpload}
                      accessibilityLabel="Upload runs automatisch naar Strava"
                      trackColor={{ false: colors.borderDefault, true: colors.brandPrimary + '88' }}
                      thumbColor={stravaAutoUpload ? colors.brandPrimary : colors.textTertiary}
                    />
                  </View>
                  <Divider />
                  <TouchableOpacity
                    onPress={handleDisconnectStrava}
                    style={styles.dangerRow}
                    activeOpacity={0.7}
                    disabled={stravaBusy}
                  >
                    <Link2 size={16} color={colors.error} strokeWidth={2} />
                    <Text style={styles.dangerLabel}>Ontkoppel</Text>
                  </TouchableOpacity>
                </>
              )}
              <Divider />
              <View style={[styles.switchRow, !isHealthConnectAvailable() && styles.rowDisabled]}>
                <Activity size={18} color={colors.textSecondary} strokeWidth={2} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>Schrijf runs naar Health Connect</Text>
                  <Text style={styles.switchSub}>
                    {isHealthConnectAvailable()
                      ? 'Runs zijn dan ook zichtbaar in Mi Fitness en andere apps die Health Connect lezen.'
                      : 'Hiervoor is een nieuwe app-build nodig. Nog niet beschikbaar in deze versie.'}
                  </Text>
                </View>
                <Switch
                  value={healthConnectEnabled}
                  onValueChange={handleToggleHealthConnect}
                  disabled={!isHealthConnectAvailable() || healthConnectBusy}
                  accessibilityLabel="Schrijf runs naar Health Connect"
                  trackColor={{ false: colors.borderDefault, true: colors.brandPrimary + '88' }}
                  thumbColor={healthConnectEnabled ? colors.brandPrimary : colors.textTertiary}
                />
              </View>
            </View>
            <Text style={styles.fieldNote}>
              Garmin werkt via GPX-export op het samenvattingsscherm na elke training. Apple Health volgt pas bij een iOS-versie van de app.
            </Text>
          </View>

          {/* Cloudsync */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Gegevens</Text>
            <View style={styles.card}>
              <View style={styles.switchRow}>
                <Cloud size={18} color={colors.textSecondary} strokeWidth={2} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>Cloudsync</Text>
                  <Text style={styles.switchSub}>
                    {cloudSyncEnabled
                      ? syncStatus === 'synced' && lastSyncedAt
                        ? `Gesynchroniseerd om ${new Date(lastSyncedAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`
                        : syncStatus === 'syncing' ? 'Bezig met synchroniseren...'
                        : syncStatus === 'error' ? 'Synchronisatie mislukt'
                        : 'Trainingdata wordt opgeslagen in de cloud'
                      : 'Trainingsdata blijft alleen lokaal op dit apparaat'}
                  </Text>
                </View>
                <Switch
                  value={cloudSyncEnabled}
                  onValueChange={setCloudSyncEnabled}
                  accessibilityLabel="Cloudsync"
                  trackColor={{ false: colors.borderDefault, true: colors.brandPrimary + '88' }}
                  thumbColor={cloudSyncEnabled ? colors.brandPrimary : colors.textTertiary}
                />
              </View>
            </View>
            <Text style={styles.fieldNote}>
              Als cloudsync aan staat, worden je profiel en trainingsresultaten versleuteld opgeslagen bij Supabase (EU). Routes worden niet gesynchroniseerd. Zie het privacybeleid voor details.
            </Text>
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
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <View style={styles.divider} />;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  scroll: { paddingHorizontal: spacing[3], paddingTop: spacing[2], paddingBottom: spacing[8], gap: spacing[2] },

  themeRow: { flexDirection: 'row', gap: spacing[1], padding: spacing[1.5] },
  themeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, minHeight: 44, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderDefault, backgroundColor: colors.bgSurface,
  },
  themeBtnActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  themeBtnText: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm, color: colors.textSecondary,
  },
  themeBtnTextActive: { color: '#fff' },
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
  rowDisabled: { opacity: 0.5 },
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
  reminderTimeSection: {
    paddingHorizontal: spacing[2], paddingVertical: spacing[1.5], gap: spacing[1],
  },
  timeRow: { flexDirection: 'row', gap: spacing[1] },
  timeBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 40,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderDefault, backgroundColor: colors.bgSurface,
  },
  timeBtnActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  timeBtnText: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm, color: colors.textSecondary,
  },
  timeBtnTextActive: { color: '#fff' },
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
  premiumVoiceNote: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderSubtle,
    padding: spacing[1.5], marginTop: spacing[1],
  },
  premiumVoiceText: {
    flex: 1,
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    lineHeight: typography.fontSize.xs * 1.5,
  },
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
  integrationInfo: {
    flex: 1,
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm,
    color: colors.textSecondary, lineHeight: typography.fontSize.sm * 1.5,
  },
  stravaConnectBtn: {
    backgroundColor: colors.brandPrimary, borderRadius: radius.md,
    paddingHorizontal: spacing[1.5], paddingVertical: spacing[1],
  },
  stravaConnectBtnText: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm,
    color: '#fff',
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
