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

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import * as Linking from 'expo-linking';
import { typography, spacing, radius, type ThemeColors } from '../src/theme/tokens';
import { useThemeColors, useIsLightTheme } from '../src/theme/useTheme';
import { Button } from '../src/components/ui/Button';
import {
  linkEmailAccount,
  signInWithEmail,
  signInWithGoogle,
  signInWithApple,
  getCurrentUser,
  sendPasswordReset,
  parseRecoveryLink,
  startRecoverySession,
  setNewPassword,
  type AuthResult,
} from '../src/services/authService';
import { identifyUser } from '../src/services/purchaseService';
import { useAppStore } from '../src/store/appStore';

type SocialProvider = 'google' | 'apple';

/** Maximale wachttijd op het ophalen van clouddata na het inloggen. */
const RECONCILE_WAIT_MS = 10000;

/** Wacht maximaal `ms` op een promise; geeft anders `fallback` terug. Gooit nooit. */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>(resolve => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

/** 'reset' = nieuw wachtwoord kiezen na een wachtwoordherstel-link uit de mail. */
type Mode = 'create' | 'login' | 'reset';

export default function AccountScreen() {
  const params = useLocalSearchParams<{ mode?: string; from?: string }>();
  const initialMode: Mode = params.mode === 'login' ? 'login' : 'create';
  // Geopend vanaf het welkomstscherm (nog geen profiel op dit toestel): na het
  // inloggen moet de onboarding verdergaan of overgeslagen worden.
  const fromWelcome = params.from === 'welcome';

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

  // Wachtwoordherstel: de link in de mail opent de app op dit scherm met een
  // herstelsessie in het URL-fragment. Zet die sessie in en toon het formulier
  // voor een nieuw wachtwoord. Elke link wordt maar één keer verwerkt.
  const url = Linking.useURL();
  const handledRecoveryUrl = useRef<string | null>(null);
  useEffect(() => {
    if (!url || handledRecoveryUrl.current === url) return;
    const link = parseRecoveryLink(url);
    if (!link) return;
    handledRecoveryUrl.current = url;

    if (link.kind === 'error') {
      Alert.alert('Link verlopen', 'Deze link is verlopen of al gebruikt. Vraag een nieuwe aan via "Wachtwoord vergeten".');
      setMode('login');
      return;
    }
    setBusy(true);
    void startRecoverySession(link.accessToken, link.refreshToken)
      .then(result => {
        if (result.ok) {
          setPassword('');
          setMode('reset');
        } else {
          Alert.alert('Link verlopen', result.message);
          setMode('login');
        }
      })
      .finally(() => setBusy(false));
  }, [url]);

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
    let syncJustEnabled = false;
    try {
      syncJustEnabled = useAppStore.getState().enableCloudSyncForAccount();
    } catch {
      // Stil falen: cloudsync blijft dan uit en is te bedienen in Instellingen.
    }
    // Direct de clouddata van dit account ophalen en samenvoegen (parallel aan de
    // RevenueCat-nazorg hieronder). Gedeelde pull met syncNow: er is nooit meer
    // dan één tegelijk. Ook als cloudsync uit staat: inloggen betekent herstellen
    // (alleen lezen). Na de timeout loopt de pull op de achtergrond door.
    const reconcilePromise = withTimeout(
      useAppStore.getState().reconcileWithAccount(),
      RECONCILE_WAIT_MS,
      null,
    );
    try {
      const user = result.session?.user ?? await getCurrentUser();
      if (user?.id) {
        await identifyUser(user.id);
      }
      await refreshPremium();
    } catch {
      // Stil falen: zie toelichting hierboven.
    }

    const reconciled = await reconcilePromise;
    const cloudNote = syncJustEnabled
      ? '\nJe trainingen worden voortaan veilig in de cloud bewaard.'
      : '';

    // Na inloggen vanaf het welkomstscherm: is het profiel hersteld, dan stuurt
    // het welkomstscherm zelf door naar het dashboard zodra het weer in beeld is.
    const after = useAppStore.getState();
    const profileRestored = after.hasCompletedOnboarding && !!after.profile;

    let alertTitle = title;
    let message: string;
    if (reconciled === null) {
      // Timeout: de pull loopt op de achtergrond door, dus geen "mislukt" claimen.
      message = fromWelcome
        ? 'Je gegevens worden nog opgehaald. Zodra ze binnen zijn, gaat de app vanzelf verder.'
        : 'Je gegevens worden nog opgehaald. Dit kan even duren.';
    } else if (!reconciled.ok) {
      message = fromWelcome
        ? 'Je gegevens ophalen lukte nog niet. Je kunt alvast je schema instellen; lukt het ophalen later alsnog, dan zetten we je gegevens terug.'
        : 'Je gegevens ophalen lukte nog niet. We proberen het opnieuw de volgende keer dat de app synchroniseert.';
    } else if (fromWelcome && !profileRestored) {
      alertTitle = 'Nog geen profiel';
      message = 'Je bent ingelogd, maar bij dit account staat nog geen profiel. Stel eerst je schema in; daarna bewaren we alles in je account.';
    } else if (reconciled.restoredRuns > 0 || reconciled.hadRemoteProfile) {
      alertTitle = 'Welkom terug';
      const n = reconciled.restoredRuns;
      const restored = n > 0
        ? `je profiel en ${n} ${n === 1 ? 'training' : 'trainingen'}`
        : 'je profiel';
      message = `We hebben ${restored} uit je account op dit toestel gezet. Routekaarten bewaren we alleen op het toestel waarop je liep.${cloudNote}`;
    } else {
      message = `${result.message}${cloudNote}`;
    }
    Alert.alert(alertTitle, message, [{ text: 'Oké', onPress: close }]);
  }

  async function handleSubmit() {
    setBusy(true);
    try {
      if (mode === 'reset') {
        const result = await setNewPassword(password);
        if (!result.ok) {
          Alert.alert('Nieuw wachtwoord', result.message);
          return;
        }
        await afterSignedIn(result, 'Wachtwoord aangepast');
        return;
      }

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

  async function handleForgotPassword() {
    if (email.trim().length === 0) {
      Alert.alert('Wachtwoord vergeten', 'Vul eerst je e-mailadres in, dan sturen we je een mail.');
      return;
    }
    setBusy(true);
    try {
      const result = await sendPasswordReset(email);
      if (!result.ok) {
        Alert.alert('Wachtwoord vergeten', result.message);
        return;
      }
      Alert.alert(
        'Wachtwoord vergeten',
        'Als dit e-mailadres bij ons bekend is, ontvang je een mail om je wachtwoord opnieuw in te stellen.',
      );
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
  const isReset = mode === 'reset';
  const canSubmit = (isReset || cleanEmail.length > 0) && password.length > 0 && !anyBusy;

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
            {isReset ? 'Nieuw wachtwoord' : mode === 'create' ? 'Account aanmaken' : 'Inloggen'}
          </Text>
          <Text style={styles.subtitle}>
            {isReset
              ? 'Kies een nieuw wachtwoord voor je account.'
              : mode === 'create'
                ? 'Bewaar je trainingen veilig in de cloud en zet ze terug op een nieuw toestel.'
                : 'Log in om je profiel en trainingen op dit toestel terug te zetten.'}
          </Text>

          {!isReset && (
          <>
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
          </>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>{isReset ? 'Nieuw wachtwoord' : 'Wachtwoord'}</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={mode === 'login' ? 'Jouw wachtwoord' : 'Minstens 8 tekens'}
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType={mode === 'login' ? 'password' : 'newPassword'}
              returnKeyType="done"
              onSubmitEditing={() => canSubmit && handleSubmit()}
              editable={!anyBusy}
            />
            {mode === 'login' && (
              <TouchableOpacity
                onPress={handleForgotPassword}
                disabled={anyBusy}
                style={styles.forgotRow}
                accessibilityRole="button"
                accessibilityLabel="Wachtwoord vergeten"
              >
                <Text style={styles.switchModeLink}>Wachtwoord vergeten?</Text>
              </TouchableOpacity>
            )}
          </View>

          <Button
            label={isReset ? 'Wachtwoord opslaan' : mode === 'create' ? 'Account aanmaken' : 'Inloggen'}
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={busy}
            fullWidth
            size="lg"
            style={styles.submitButton}
          />

          {!isReset && (
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
          )}

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
  forgotRow: { alignSelf: 'flex-end', paddingVertical: spacing[0.5] },
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
