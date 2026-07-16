import { useEffect, useMemo, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Redirect } from 'expo-router';
import { useAppStore, useHasHydrated } from '../src/store/appStore';
import { type ThemeColors } from '../src/theme/tokens';
import { useThemeColors } from '../src/theme/useTheme';
import { resolveActivePlan } from '../src/data/activePlan';
import {
  loadSnapshot, clearSnapshot, type RunSnapshot,
} from '../src/services/runRecoveryService';

// Snapshots ouder dan dit worden niet meer aangeboden voor herstel: na zo lang
// is een "wil je hem opslaan" vraag waarschijnlijk verwarrend in plaats van
// nuttig, dus ruimen we hem stilletjes op.
const SNAPSHOT_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 uur

/**
 * Slaat een crash-hersteld run-snapshot alsnog op als voltooide sessie, via
 * de bestaande store-acties (startSession + completeSession). Faalt overal
 * stil: kan de bijbehorende training niet meer teruggevonden worden (bijv.
 * schema aangepast), dan gooien we de snapshot gewoon weg zonder de gebruiker
 * te blokkeren.
 */
async function saveRecoveredRun(snapshot: RunSnapshot): Promise<void> {
  try {
    const { profile, racePlan, customPlan, schemaMode, startSession, completeSession } = useAppStore.getState();
    if (!profile) return;

    const week = resolveActivePlan({ schemaMode, racePlan, customPlan, goal: profile.goal })
      .weeks.find(w => w.weekNumber === snapshot.weekNumber);
    const session = week?.sessions.find(s => s.id === snapshot.sessionId);

    if (!week || !session) return;

    startSession(session, snapshot.weekNumber);

    const finalDist = parseFloat(snapshot.distanceKm.toFixed(2));
    const avgPace   = finalDist > 0 ? Math.round(snapshot.elapsed / finalDist) : 0;

    completeSession(
      {
        actualDistanceKm: finalDist,
        durationSeconds:  snapshot.elapsed,
        avgPaceSecPerKm:  avgPace,
        route:            snapshot.route,
        splits:           snapshot.splits,
        source:           'app',
      },
      week.sessions,
    );
  } catch {
    // Faalt stil: geen hersteld resultaat is beter dan een crash bij het opstarten.
  } finally {
    await clearSnapshot();
  }
}

export default function Index() {
  const hasHydrated             = useHasHydrated();
  const hasCompletedOnboarding  = useAppStore(s => s.hasCompletedOnboarding);
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const recoveryChecked = useRef(false);

  // Crash-herstel: eenmalig bij opstarten checken of er een onafgemaakte run
  // ligt van een sessie die onverwacht gestopt is (crash, geforceerd afsluiten).
  useEffect(() => {
    if (!hasHydrated || recoveryChecked.current) return;
    recoveryChecked.current = true;

    (async () => {
      try {
        const snapshot = await loadSnapshot();
        if (!snapshot) return;

        const age = Date.now() - snapshot.savedAt;
        if (age > SNAPSHOT_MAX_AGE_MS) {
          await clearSnapshot();
          return;
        }

        Alert.alert(
          'Onafgemaakte run gevonden',
          'Je vorige run is onverwacht gestopt. Wil je hem opslaan of verwijderen?',
          [
            {
              text: 'Verwijderen',
              style: 'destructive',
              onPress: () => { void clearSnapshot(); },
            },
            {
              text: 'Opslaan',
              onPress: () => { void saveRecoveredRun(snapshot); },
            },
          ],
        );
      } catch {
        // Faalt stil: geen herstelmelding is beter dan een crash bij het opstarten.
      }
    })();
  }, [hasHydrated]);

  // Wacht tot AsyncStorage volledig geladen is om een verkeerde redirect te voorkomen
  if (!hasHydrated) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    );
  }

  if (!hasCompletedOnboarding) {
    return <Redirect href="/(onboarding)/welcome" />;
  }

  return <Redirect href="/(tabs)/dashboard" />;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.bgBase,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
