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
 * Boven het e-mailformulier staan sinds Fase B ook native "Doorgaan met
 * Apple" en "Doorgaan met Google"-knoppen. Die gebruiken dezelfde authService-
 * functies (signInWithApple/signInWithGoogle) en dezelfde AuthResult-vorm,
 * dus de afhandeling hieronder is voor alle drie de manieren identiek.
 *
 * Na een geslaagde aanmelding koppelen we RevenueCat meteen aan de nieuwe
 * Supabase-user-id en verversen we de premium-status, zodat een gebruiker
 * die op een nieuw toestel inlogt zijn premium direct terugziet. De globale
 * onAuthChange-listener in app/_layout.tsx doet dit ook al bij elke
 * auth-wijziging; dit is een extra directe aanroep zodat het scherm niet
 * hoeft te wachten op die listener voordat het teruggnavigeert.
 */

import React, { useEffect, useMemo, useState } from 'react';
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
import * as AppleAuthentication from 'expo-apple-authentication';
import { typography, spacing, radius, type ThemeColors } from '../src/theme/tokens';
import { useThemeColors, useIsLightTheme } from '../src/theme/useTheme';
import { Button } from '../src/components/ui/Button';
import {
  linkEmailAccount,
  signInWithEmail,
  signInWithGoogle,
  signInWithApple,
  getCurrentUser,
  type AuthResult,
} from '../src/services/authService';
import { identifyUser } from '../src/services/purchaseService';
import { useAppStore } from '../src/store/appStore';

type SocialProvider = 'google' | 'apple';

type Mode = 'create' | 'login';

export default function AccountScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const initialMode: Mode = params.mode === 'login' ? 'login' : 'create';

  const colors = useThemeColors();
  const isLight = useIsLightTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const refreshPremium = useAppStore(s => s.refreshPremium);

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [socialBusy, setSocialBusy] = useState<SocialProvider | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  // "Doorgaan met Apple" mag alleen getoond worden als het toestel dit ook
  // echt ondersteunt (iOS 13+). Best-effort: op een fout of op Android/web
  // blijft de knop gewoon verborgen.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let cancelled = false;
    AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (!cancelled) setAppleAvailable(available);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const anyBusy = busy || socialBusy !== null;

  const close = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/settings');
    }
  };

  /**
   * Verwerkt een geslaagde aanmelding, ongeacht de manier (e-mail, Google of
   * Apple): koppelt RevenueCat aan de nieuwe identiteit, ververst premium en
   * navigeert terug. Best-effort: een fout in deze nazorg mag de geslaagde
   * aanmelding nooit tenietdoen, en de globale onAuthChange-listener
   * (app/_layout.tsx) vangt het alsnog op zodra de auth-status doorkomt.
   */
  async function afterSignedIn(result: AuthResult, title: string) {
    try {
      const user = result.session?.user ?? await getCurrentUser();
      if (user?.id) {
        await identifyUser(user.id);
      }
      await refreshPremium();
    } catch {
      // Stil falen: zie toelichting hierboven.
    }

    Alert.alert(title, result.message, [{ text: 'Oké', onPress: close }]);
  }

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

      await afterSignedIn(result, mode === 'create' ? 'Account aangemaakt' : 'Ingelogd');
    } finally {
      setBusy(false);
    }
  }

  async function handleSocialSignIn(provider: SocialProvider) {
    setSocialBusy(provider);
    try {
      const result = provider === 'google' ? await signInWithGoogle() : await signInWithApple();

      if (!result.ok) {
        // Annuleerde de gebruiker zelf? Dan komt er bewust geen message mee
        // terug uit authService en tonen we niets. Alleen bij een echte fout
        // (met message) laten we iets zien.
        if (result.message) {
          Alert.alert('Inloggen', result.message);
        }
        return;
      }

      await afterSignedIn(result, 'Ingelogd');
    } finally {
      setSocialBusy(null);
    }
  }

  const cleanEmail = email.trim();
  const canSubmit = cleanEmail.length > 0 && password.length > 0 && !anyBusy;

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

          <View style={styles.socialGroup}>
            {Platform.OS === 'ios' && appleAvailable && (
              <View style={[styles.appleButtonWrap, anyBusy && styles.socialDisabled]} pointerEvents={anyBusy ? 'none' : 'auto'}>
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                  buttonStyle={
                    isLight
                      ? AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                      : AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                  }
                  cornerRadius={radius.lg}
                  style={styles.appleButton}
                  onPress={() => handleSocialSignIn('apple')}
                />
              </View>
            )}

            <Button
              label="Doorgaan met Google"
              onPress={() => handleSocialSignIn('google')}
              variant="secondary"
              size="lg"
              fullWidth
              loading={socialBusy === 'google'}
              disabled={anyBusy}
            />
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>of</Text>
            <View style={styles.dividerLine} />
          </View>

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
              editable={!anyBusy}
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
              editable={!anyBusy}
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
            disabled={anyBusy}
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

          {anyBusy && (
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
  socialGroup: { width: '100%', gap: spacing[1.5] },
  appleButtonWrap: { width: '100%' },
  appleButton: { width: '100%', height: 56 },
  socialDisabled: { opacity: 0.45 },
  dividerRow: {
    width: '100%', flexDirection: 'row', alignItems: 'center',
    marginVertical: spacing[3], gap: spacing[1.5],
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.borderDefault },
  dividerText: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
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
