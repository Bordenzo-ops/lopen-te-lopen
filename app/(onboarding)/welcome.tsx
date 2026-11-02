import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Headphones, CalendarCheck, Footprints } from 'lucide-react-native';
import { typography, spacing, darkColors as colors } from '../../src/theme/tokens';
import { Button } from '../../src/components/ui/Button';
import { trackEvent } from '../../src/services/analyticsService';
import { useAppStore } from '../../src/store/appStore';

// Bottom fade built from plain Views (no SVG): alpha eases from 0 to 1.
const FADE_BANDS = 16;
const FADE_ALPHAS = Array.from({ length: FADE_BANDS }, (_, i) =>
  Math.min(1, Math.pow(i / 12, 1.6)),
);

const PROMISES = [
  { Icon: Headphones, text: 'Een Nederlandse coach in je oor' },
  { Icon: CalendarCheck, text: 'Een schema tot je wedstrijddag' },
  { Icon: Footprints, text: 'Begin gerust bij nul' },
];

export default function WelcomeScreen() {
  const { width, height } = useWindowDimensions();

  // Start van de funnel: het welkomstscherm is de eerste stap van de
  // onboarding. Eén keer bij het tonen. Best-effort, blokkeert niets.
  useEffect(() => {
    void trackEvent('onboarding_started');
  }, []);

  // Na inloggen op een bestaand account herstelt de cloudsync het profiel en
  // zet hasCompletedOnboarding aan (ook als dat pas na een timeout binnenkomt).
  // Alleen doorsturen als dit scherm in beeld is: tijdens de onboarding zelf
  // (andere schermen erboven) mag deze redirect niet afgaan.
  const onboardingDone = useAppStore(s => s.hasCompletedOnboarding);
  useFocusEffect(
    useCallback(() => {
      if (onboardingDone) router.replace('/(tabs)/dashboard');
    }, [onboardingDone]),
  );
  return (
    <View style={styles.container}>
      {/* Brand image with explicit size so Android always renders it. */}
      <View style={[styles.imageWrap, { width, height }]} pointerEvents="none">
        <Image
          source={require('../../assets/splash-full.png')}
          resizeMode="cover"
          fadeDuration={0}
          style={{ width, height }}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        />
      </View>
      {/* Bottom fade keeps buttons and text readable over the image. */}
      <View style={styles.bottomFade} pointerEvents="none">
        {FADE_ALPHAS.map((alpha, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: `rgba(10,15,26,${alpha})` }} />
        ))}
      </View>
      <SafeAreaView style={styles.safeArea}>
        {/* ScrollView: bij grotere systeemlettergrootte of op kleine toestellen past
            de inhoud niet altijd op het scherm, dus moet die kunnen scrollen. */}
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Hero area */}
          <View style={styles.hero}>
            <Text style={styles.headline}>Van de bank{'\n'}naar de finish</Text>
            <Text style={styles.sub}>
              Van je eerste kilometer tot de finishlijn, met een schema dat bij jou past.
            </Text>
          </View>

          <View style={styles.bottom}>
            <View style={styles.promises}>
              {PROMISES.map(({ Icon, text }) => (
                <View key={text} style={styles.promiseRow}>
                  <Icon size={18} color={colors.brandLight} />
                  <Text style={styles.promiseText}>{text}</Text>
                </View>
              ))}
            </View>

          {/* CTA */}
          <View style={styles.actions}>
            <Button
              label="Start jouw schema"
              onPress={() => router.push('/(onboarding)/goal')}
              fullWidth
              size="lg"
            />
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/account', params: { mode: 'login', from: 'welcome' } })}
              style={styles.loginLink}
              accessibilityRole="button"
              accessibilityLabel="Ik heb al een account"
            >
              <Text style={styles.loginLinkText}>Ik heb al een account</Text>
            </TouchableOpacity>
            <Text style={styles.disclaimer}>
              Gratis en zonder account. Je trainingen staan op je telefoon. Log je in, dan bewaren we ze ook veilig in de cloud.
            </Text>
          </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  imageWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '48%',
  },
  bottom: {
    gap: spacing[3],
  },
  promises: {
    gap: spacing[1],
  },
  promiseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
  },
  promiseText: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing[3],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'flex-start',
    gap: spacing[2.5],
  },
  headline: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize['4xl'],
    color: colors.textPrimary,
    textAlign: 'left',
    lineHeight: typography.fontSize['4xl'] * typography.lineHeight.tight,
    letterSpacing: -1,
  },
  sub: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.md,
    color: colors.textSecondary,
    textAlign: 'left',
    lineHeight: typography.fontSize.md * typography.lineHeight.relaxed,
    maxWidth: 320,
  },
  actions: {
    gap: spacing[1.5],
    alignItems: 'center',
  },
  loginLink: {
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[2],
  },
  loginLinkText: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.base,
    color: colors.brandPrimary,
  },
  disclaimer: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
