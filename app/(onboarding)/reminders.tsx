import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, BackHandler } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell } from 'lucide-react-native';
import { typography, spacing, radius, type ThemeColors } from '../../src/theme/tokens';
import { useThemeColors } from '../../src/theme/useTheme';
import { Button } from '../../src/components/ui/Button';
import { useAppStore } from '../../src/store/appStore';
import {
  requestNotificationPermission,
  rescheduleNotifications,
} from '../../src/services/notificationService';
import { trackEvent } from '../../src/services/analyticsService';

// Zelfde keuzes als de tijdkeuze in Instellingen (app/(tabs)/settings.tsx).
const REMINDER_HOURS = [7, 8, 12, 18] as const;

/**
 * Laatste onboardingstap: opt-in voor trainingsherinneringen. Het profiel en
 * schema staan op dit punt al klaar (voice.tsx), dus hier valt niets meer te
 * annuleren. Toestemming en opslag lopen via hetzelfde pad als de schakelaar in
 * Instellingen: requestNotificationPermission, setRemindersEnabled en
 * rescheduleNotifications.
 */
export default function RemindersScreen() {
  const { newGoal } = useLocalSearchParams<{ newGoal: string }>();
  const isNewGoal = newGoal === '1';
  const [hour, setHour] = useState<number>(() => useAppStore.getState().reminderHour);
  const [busy, setBusy] = useState(false);
  const setRemindersEnabled      = useAppStore(s => s.setRemindersEnabled);
  const setReminderHour          = useAppStore(s => s.setReminderHour);
  const setReminderOptinAnswered = useAppStore(s => s.setReminderOptinAnswered);
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const finish = () => {
    if (isNewGoal) {
      // Zie voice.tsx: terug naar het bestaande dashboard i.p.v. een extra kopie.
      router.dismissTo('/(tabs)/dashboard');
    } else {
      router.replace('/(tabs)/dashboard');
    }
  };

  const handleSkip = () => {
    if (busy) return;
    setReminderOptinAnswered(true);
    void trackEvent('reminder_optin_answered', { accepted: false, permission: 'skipped' });
    finish();
  };

  const handleAccept = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const granted = await requestNotificationPermission();
      setReminderOptinAnswered(true);
      if (granted) {
        setReminderHour(hour);
        setRemindersEnabled(true);
        void trackEvent('notification_category_toggled', { category: 'training', enabled: true });
        void trackEvent('reminder_optin_answered', { accepted: true, permission: 'granted' });
        void rescheduleNotifications();
      } else {
        // Systeem weigert: zonder melding door, schakelaar blijft uit (zoals in Instellingen).
        void trackEvent('reminder_optin_answered', { accepted: true, permission: 'denied' });
      }
    } finally {
      setBusy(false);
    }
    finish();
  };

  // Het profiel staat al, dus terug naar het vorige scherm zou het schema
  // opnieuw aanmaken. Hardware-terug op Android telt daarom als "Nu niet".
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleSkip();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.iconWrap}>
          <Bell size={32} color={colors.brandPrimary} strokeWidth={1.5} />
        </View>

        <View style={styles.titleGroup}>
          <Text style={styles.step}>Bijna klaar</Text>
          <Text style={styles.title}>Zal ik je herinneren op je trainingsdagen?</Text>
          <Text style={styles.sub}>
            Een seintje op de dagen dat je schema een training heeft. Je kiest zelf het tijdstip en zet het altijd weer uit in Instellingen.
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Tijdstip</Text>
          <View style={styles.timeRow}>
            {REMINDER_HOURS.map(h => {
              const active = hour === h;
              return (
                <TouchableOpacity
                  key={h}
                  style={[styles.timeBtn, active && styles.timeBtnActive]}
                  onPress={() => setHour(h)}
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
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Ja, herinner me" onPress={handleAccept} loading={busy} fullWidth size="lg" />
        <Button label="Nu niet" onPress={handleSkip} variant="ghost" disabled={busy} fullWidth size="lg" />
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  content: {
    paddingHorizontal: spacing[3], paddingTop: spacing[6], paddingBottom: spacing[3], gap: spacing[3],
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bgCard,
  },
  titleGroup: { gap: spacing[1] },
  step: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.sm,
    color: colors.brandPrimary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.widest,
  },
  title: {
    fontFamily: typography.fontFamily.display, fontSize: typography.fontSize['2xl'],
    color: colors.textPrimary, letterSpacing: typography.letterSpacing.tight,
  },
  sub: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.base,
    color: colors.textSecondary, lineHeight: typography.fontSize.base * typography.lineHeight.relaxed,
  },
  field: { gap: spacing[1] },
  label: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  timeRow: { flexDirection: 'row', gap: spacing[1] },
  timeBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderDefault, backgroundColor: colors.bgSurface,
  },
  timeBtnActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  timeBtnText: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm, color: colors.textSecondary,
  },
  timeBtnTextActive: { color: colors.textInverse },
  footer: { paddingHorizontal: spacing[3], paddingBottom: spacing[3], paddingTop: spacing[2], gap: spacing[1] },
});
