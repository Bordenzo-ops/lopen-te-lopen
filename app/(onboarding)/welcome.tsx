import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { typography, spacing, darkColors as colors } from '../../src/theme/tokens';
import { Button } from '../../src/components/ui/Button';
import { trackEvent } from '../../src/services/analyticsService';
import { useAppStore } from '../../src/store/appStore';

export default function WelcomeScreen() {
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
      {/* Brand image fills the screen so the native splash flows into it. */}
      <Image
        source={require('../../assets/splash-full.png')}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
        accessible={false}
      />
      {/* Bottom gradient keeps buttons and text readable over the image. */}
      <Svg width="100%" height="45%" style={styles.bottomFade} pointerEvents="none">
        <Defs>
          <LinearGradient id="welcomeFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0A0F1A" stopOpacity={0} />
            <Stop offset="0.75" stopColor="#0A0F1A" stopOpacity={1} />
            <Stop offset="1" stopColor="#0A0F1A" stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#welcomeFade)" />
      </Svg>
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
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
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
