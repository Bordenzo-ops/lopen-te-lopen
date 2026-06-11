import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../../src/theme/tokens';
import { Button } from '../../src/components/ui/Button';

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Hero area */}
        <View style={styles.hero}>
          <View style={styles.iconWrapper}>
            <Text style={styles.emoji}>🏃</Text>
          </View>
          <Text style={styles.headline}>Van de bank{'\n'}naar de finish</Text>
          <Text style={styles.sub}>
            Van je eerste kilometer tot de finishlijn, met een schema dat bij jou past.
          </Text>
        </View>

        {/* Features */}
        <View style={styles.features}>
          {[
            { icon: '📅', text: 'Persoonlijk weekschema',          soon: false },
            { icon: '❤️', text: 'Training op hartslag',             soon: false },
            { icon: '📍', text: 'GPS-tracking en live-tempo',      soon: false },
            { icon: '🔗', text: 'Strava, Garmin & Apple Health',   soon: true  },
          ].map((f, i) => (
            <View key={i} style={styles.feature}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureText}>{f.text}</Text>
              {f.soon && (
                <View style={styles.soonBadge}>
                  <Text style={styles.soonText}>binnenkort</Text>
                </View>
              )}
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
          <Text style={styles.disclaimer}>
            Gratis en zonder account. Jouw data blijft op jouw apparaat.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[3],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
    gap: spacing[2.5],
  },
  iconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: colors.brandPrimary + '22',
    borderWidth: 1,
    borderColor: colors.brandPrimary + '44',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[1],
  },
  emoji: {
    fontSize: 48,
  },
  headline: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize['3xl'],
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: typography.fontSize['3xl'] * typography.lineHeight.tight,
    letterSpacing: typography.letterSpacing.tight,
  },
  sub: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.fontSize.md * typography.lineHeight.relaxed,
    maxWidth: 300,
  },
  features: {
    gap: spacing[2],
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.bgCard,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2.5],
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  featureIcon: {
    fontSize: 24,
  },
  featureText: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    flex: 1,
  },
  soonBadge: {
    backgroundColor: colors.brandPrimary + '22',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.brandPrimary + '44',
  },
  soonText: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: typography.fontSize.xs,
    color: colors.brandPrimary,
    letterSpacing: 0.3,
  },
  actions: {
    gap: spacing[1.5],
    alignItems: 'center',
  },
  disclaimer: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
