import { useMemo } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useAppStore, useHasHydrated } from '../src/store/appStore';
import { type ThemeColors } from '../src/theme/tokens';
import { useThemeColors } from '../src/theme/useTheme';

export default function Index() {
  const hasHydrated             = useHasHydrated();
  const hasCompletedOnboarding  = useAppStore(s => s.hasCompletedOnboarding);
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
