/**
 * StravaCallbackScreen
 *
 * Vangt de deep link lopentelopen://strava-callback op die de Supabase
 * Edge Function strava-oauth stuurt na de OAuth-uitwisseling met Strava.
 * Slaat bij succes de tokens op via stravaService en stuurt de gebruiker
 * direct door naar Instellingen met een geslaagd- of mislukt-melding.
 */

import { useEffect, useRef } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { typography, spacing, type ThemeColors } from '../src/theme/tokens';
import { useThemeColors } from '../src/theme/useTheme';
import { handleStravaCallback } from '../src/services/stravaService';

export default function StravaCallbackScreen() {
  const params = useLocalSearchParams<{
    access_token?: string;
    refresh_token?: string;
    expires_at?: string;
    athlete_name?: string;
    error?: string;
  }>();
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    void (async () => {
      const result = await handleStravaCallback(params);

      router.replace('/(tabs)/settings');

      // Even wachten tot de navigatie klaar is voordat de Alert verschijnt
      setTimeout(() => {
        if (result.ok) {
          Alert.alert('Verbonden met Strava', `Welkom, ${result.athleteName}! Je runs worden vanaf nu automatisch geupload.`);
        } else {
          Alert.alert('Verbinden mislukt', result.message ?? 'Er ging iets mis bij het verbinden met Strava.');
        }
      }, 400);
    })();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color={colors.brandPrimary} />
        <Text style={styles.text}>Verbinden met Strava...</Text>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  text: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
});
