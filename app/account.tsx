/**
 * AccountScreen
 *
 * Eenvoudig e-mail/wachtwoord-scherm om een account aan te maken (of een
 * anonieme sessie te upgraden) of in te loggen op een bestaand account.
 * Login is nooit verplicht: dit scherm is puur optioneel en bereikbaar
 * vanuit Instellingen > Account. Zonder Supabase-sleutels of netwerk geven
 * authService-functies een nette Nederlandse foutmelding terug in plaats
 * van te crashen.
 *
 * Na een geslaagde aanmelding koppelen we RevenueCat meteen aan de nieuwe
 * Supabase-user-id en verversen we de premium-status, zodat een gebruiker
 * die op een nieuw toestel inlogt zijn premium direct terugziet. De globale
 * onAuthChange-listener in app/_layout.tsx doet dit ook al bij elke
 * auth-wijziging; dit is een extra directe aanroep zodat het scherm niet
 * hoeft te wachten op die listener voordat het teruggnavigeert.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Mail } from 'lucide-react-native';
import { typography, spacing, radius, type ThemeColors } from '../src/theme/tokens';
import { useThemeColors } from '../src/theme/useTheme';
import { Button } from '../src/components/ui/Button';
import { linkEmailAccount, signInWithEmail, getCurrentUser } from '../src/services/authService';
import { identifyUser } from '../src/services/purchaseService';
import { useAppStore } from '../src/store/appStore';

type Mode = 'create' | 'login';

export default function AccountScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const initialMode: Mode = params.mode === 'login' ? 'login' : 'create';

  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const refreshPremium = useAppStore(s => s.refreshPremium);

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/settings');
    }
  };

  async function handleSubmit() {
    setBusy(true);
    try {
      const result = mode === 'create'
        ? await linkEmailAccount(email, password)
        : await signInWithEmail(email, password);

      if (!result.ok) {
        Alert.alert(mode === 'create' ? 'Account aanmaken' : 'Inloggen', result.message);
        return;
      }

      // Koppel RevenueCat meteen aan de nieuwe identiteit en ververs premium,
      // zodat de gebruiker direct zijn eventuele premium terugziet. Best-effort:
      // een fout hier mag de geslaagde aanmelding nooit tenietdoen.
      try {
        const user = result.session?.user ?? await getCurrentUser();
        if (user?.id) {
          await identifyUser(user.id);
        }
        await refreshPremium();
      } catch {
        // Stil falen: de globale onAuthChange-listener (app/_layout.tsx)
        // vangt dit alsnog op zodra de auth-status doorkomt.
      }

      Alert.alert(
        mode === 'create' ? 'Account aangemaakt' : 'Ingelogd',
        result.message,
        [{ text: 'Oké', onPress: close }],
      );
    } finally {
      setBusy(false);
    }
  }

  const cleanEmail = email.trim();
  const canSubmit = cleanEmail.length > 0 && password.length > 0 && !busy;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Sluiten"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.closeButton}
        >
          <X size={24} color={colors.textSecondary} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.iconWrap}>
            <Mail size={32} color={colors.brandPrimary} strokeWidth={2} />
          </View>

          <Text style={styles.title} accessibilityRole="header">
            {mode === 'create' ? 'Account aanmaken' : 'Inloggen'}
          </Text>
          <Text style={styles.subtitle}>
            {mode === 'create'
              ? 'Bewaar je voortgang veilig en herstel hem op een ander toestel.'
              : 'Log in om je data te herstellen op dit toestel.'}
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>E-mailadres</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="naam@voorbeeld.nl"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Wachtwoord</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={mode === 'create' ? 'Minstens 8 tekens' : 'Jouw wachtwoord'}
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType={mode === 'create' ? 'newPassword' : 'password'}
              returnKeyType="done"
              onSubmitEditing={() => canSubmit && handleSubmit()}
            />
          </View>

          <Button
            label={mode === 'create' ? 'Account aanmaken' : 'Inloggen'}
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={busy}
            fullWidth
            size="lg"
            style={styles.submitButton}
          />

          <TouchableOpacity
            onPress={() => setMode(m => (m === 'create' ? 'login' : 'create'))}
            style={styles.switchModeRow}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={mode === 'create' ? 'Ik heb al een account' : 'Ik heb nog geen account'}
          >
            <Text style={styles.switchModeText}>
              {mode === 'create'
                ? 'Heb je al een account? '
                : 'Nog geen account? '}
              <Text style={styles.switchModeLink}>
                {mode === 'create' ? 'Inloggen' : 'Account aanmaken'}
              </Text>
            </Text>
          </TouchableOpacity>

          {busy && (
            <ActivityIndicator style={{ marginTop: spacing[1] }} color={colors.brandPrimary} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgBase },
  header: {
    flexDirection: 'row', justifyContent: 'flex-end',
    paddingHorizontal: spacing[2], paddingTop: spacing[1],
  },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content: {
    paddingHorizontal: spacing[3], paddingBottom: spacing[5], alignItems: 'center',
  },
  iconWrap: {
    width: 72, height: 72, borderRadius: radius.full,
    backgroundColor: colors.brandPrimary + '1A',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[2],
    borderWidth: 1, borderColor: colors.brandPrimary + '40',
  },
  title: {
    fontFamily: typography.fontFamily.display, fontSize: typography.fontSize['2xl'],
    color: colors.textPrimary, textAlign: 'center', marginBottom: spacing[1],
  },
  subtitle: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.base,
    color: colors.textSecondary, textAlign: 'center',
    lineHeight: typography.fontSize.base * typography.lineHeight.normal,
    marginBottom: spacing[3], paddingHorizontal: spacing[1],
  },
  field: { width: '100%', gap: spacing[1], marginBottom: spacing[2] },
  label: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.sm,
    color: colors.textSecondary, letterSpacing: typography.letterSpacing.wider, textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.borderDefault, paddingHorizontal: spacing[2], paddingVertical: spacing[1.5],
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.md, color: colors.textPrimary,
  },
  submitButton: { marginTop: spacing[1] },
  switchModeRow: { marginTop: spacing[2.5], paddingVertical: spacing[1] },
  switchModeText: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm,
    color: colors.textSecondary, textAlign: 'center',
  },
  switchModeLink: {
    fontFamily: typography.fontFamily.sansSemi, color: colors.brandPrimary,
  },
});
