/**
 * PremiumIntroScreen
 *
 * Het premium "value-scherm": toont gratis gebruikers in één oogopslag de
 * premium-belofte, in de merk-hero-look van de splash (donkere achtergrond,
 * gloeiend oranje spoor, de schoen). Geen feature-gating hier — dat gebeurt
 * elders (usePremium) — dit scherm is puur een uitnodiging naar de paywall.
 *
 * Dit scherm is ALTIJD donker, ongeacht het gekozen thema: het is een
 * merk-moment zoals de splash, geen thema-bewust instellingenscherm. Daarom
 * gebruiken we hier bewust vaste kleurwaarden uit src/theme/tokens.ts in
 * plaats van useThemeColors().
 *
 * Best-effort: registratie van de vertoning en analytics mogen dit scherm
 * nooit laten crashen of blokkeren.
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import {
  X,
  Target,
  Headphones,
  Map,
  TrendingUp,
  ShieldCheck,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react-native';
import { palette, spacing, radius, typography, shadows } from '../src/theme/tokens';
import { useAppStore } from '../src/store/appStore';
import { trackEvent } from '../src/services/analyticsService';
import {
  PREMIUM_INTRO_CAMPAIGN_LABEL,
  PREMIUM_INTRO_TITLE,
  PREMIUM_INTRO_SUBTITLE,
  PREMIUM_INTRO_BENEFITS,
  PREMIUM_INTRO_GUARANTEE_TITLE,
  PREMIUM_INTRO_GUARANTEE_TEXT,
  PREMIUM_INTRO_PRICE_LINE,
  PREMIUM_INTRO_PRICE_SUBLINE,
  PREMIUM_INTRO_CTA_PRIMARY,
  PREMIUM_INTRO_CTA_SECONDARY,
  PREMIUM_INTRO_CTA_DISMISS,
  type PremiumIntroIcon,
} from '../src/config/premiumIntroConfig';

// Vaste, donkere merkkleuren — bewust NIET via useThemeColors(), zie boven.
const BG = palette.neutral[950];
const BRAND = palette.primary[500];
const GOLD = palette.gold;
const TEXT_PRIMARY = palette.neutral[50];
const TEXT_SECONDARY = palette.neutral[400];
const TEXT_TERTIARY = palette.neutral[500];

/** Icoon-key uit de config gemapt naar de lucide-component in dit scherm. */
const ICON_MAP: Record<PremiumIntroIcon, LucideIcon> = {
  target: Target,
  headphones: Headphones,
  map: Map,
  'trending-up': TrendingUp,
};

export default function PremiumIntroScreen() {
  const styles = useMemo(() => makeStyles(), []);

  // Ref-guard: voorkomt dat de vertoning dubbel geregistreerd wordt (bv. bij
  // React 18 Strict Mode's dubbele mount-invoke in development).
  const registeredRef = useRef(false);

  useEffect(() => {
    if (registeredRef.current) return;
    registeredRef.current = true;
    useAppStore.getState().registerPremiumIntroShown();
    void trackEvent('premium_intro_shown');
  }, []);

  const close = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/dashboard');
    }
  };

  const onDismissForever = () => {
    useAppStore.getState().dismissPremiumIntro();
    close();
  };

  const onCta = () => {
    void trackEvent('premium_intro_cta');
    router.replace('/paywall');
  };

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
          <X size={24} color={TEXT_SECONDARY} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero: gloeiend diagonaal oranje spoor achter de schoen, zoals de splash */}
        <View style={styles.hero}>
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="heroTrail" x1="0%" y1="100%" x2="100%" y2="0%">
                <Stop offset="0" stopColor={BRAND} stopOpacity={0.5} />
                <Stop offset="0.6" stopColor={BRAND} stopOpacity={0.18} />
                <Stop offset="1" stopColor={BRAND} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" rx={32} fill="url(#heroTrail)" />
          </Svg>
          <View style={styles.heroIconGlow}>
            <Image source={require('../assets/icon.png')} style={styles.heroIcon} resizeMode="contain" />
          </View>
        </View>

        <Text style={styles.campaignLabel}>{PREMIUM_INTRO_CAMPAIGN_LABEL}</Text>
        <Text style={styles.title} accessibilityRole="header">{PREMIUM_INTRO_TITLE}</Text>
        <Text style={styles.subtitle}>{PREMIUM_INTRO_SUBTITLE}</Text>

        {/* Voordeel-tegels */}
        <View style={styles.benefitsGrid}>
          {PREMIUM_INTRO_BENEFITS.map((benefit) => {
            const Icon = ICON_MAP[benefit.icon];
            return (
              <View key={benefit.title} style={styles.benefitTile}>
                <View style={styles.benefitIconWrap}>
                  <Icon size={22} color={GOLD} strokeWidth={2} />
                </View>
                <Text style={styles.benefitTitle}>{benefit.title}</Text>
                <Text style={styles.benefitText}>{benefit.text}</Text>
              </View>
            );
          })}
        </View>

        {/* Finish-garantie */}
        <View style={styles.guaranteeCard}>
          <ShieldCheck size={26} color={GOLD} strokeWidth={2} />
          <View style={styles.guaranteeTextWrap}>
            <Text style={styles.guaranteeTitle}>{PREMIUM_INTRO_GUARANTEE_TITLE}</Text>
            <Text style={styles.guaranteeText}>{PREMIUM_INTRO_GUARANTEE_TEXT}</Text>
          </View>
        </View>

        <Text style={styles.priceLine}>{PREMIUM_INTRO_PRICE_LINE}</Text>
        <Text style={styles.priceSubline}>{PREMIUM_INTRO_PRICE_SUBLINE}</Text>

        {/* Primaire CTA: volle breedte, oranje gradient */}
        <TouchableOpacity
          onPress={onCta}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={PREMIUM_INTRO_CTA_PRIMARY}
          style={styles.ctaButton}
        >
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="ctaGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0" stopColor={BRAND} />
                <Stop offset="1" stopColor={palette.primary[400]} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" rx={radius.lg} fill="url(#ctaGradient)" />
          </Svg>
          <Text style={styles.ctaText}>{PREMIUM_INTRO_CTA_PRIMARY}</Text>
          <ArrowRight size={20} color={palette.neutral[0]} strokeWidth={2.5} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel={PREMIUM_INTRO_CTA_SECONDARY}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>{PREMIUM_INTRO_CTA_SECONDARY}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onDismissForever}
          accessibilityRole="button"
          accessibilityLabel={PREMIUM_INTRO_CTA_DISMISS}
          style={styles.dismissButton}
          hitSlop={8}
        >
          <Text style={styles.dismissButtonText}>{PREMIUM_INTRO_CTA_DISMISS}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const HERO_SIZE = 220;
const ICON_SIZE = 150;

const makeStyles = () => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing[2],
    paddingTop: spacing[1],
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: spacing[3],
    paddingBottom: spacing[5],
    alignItems: 'center',
  },
  hero: {
    width: '100%',
    maxWidth: 360,
    height: HERO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
    overflow: 'hidden',
  },
  heroIconGlow: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 12,
  },
  heroIcon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  campaignLabel: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.xs,
    color: GOLD,
    letterSpacing: typography.letterSpacing.widest,
    marginBottom: spacing[1],
    textAlign: 'center',
  },
  title: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize['2xl'],
    color: TEXT_PRIMARY,
    textAlign: 'center',
    lineHeight: typography.fontSize['2xl'] * typography.lineHeight.tight,
    marginBottom: spacing[1],
  },
  subtitle: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.base,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: typography.fontSize.base * typography.lineHeight.normal,
    marginBottom: spacing[3],
    paddingHorizontal: spacing[1],
  },
  benefitsGrid: {
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  benefitTile: {
    width: '48%',
    backgroundColor: `${BRAND}14`,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: `${GOLD}33`,
    padding: spacing[1.5],
    marginBottom: spacing[1.5],
  },
  benefitIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: `${GOLD}22`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[1],
  },
  benefitTitle: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.sm,
    color: TEXT_PRIMARY,
    marginBottom: 2,
  },
  benefitText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.xs,
    color: TEXT_SECONDARY,
    lineHeight: typography.fontSize.xs * typography.lineHeight.normal,
  },
  guaranteeCard: {
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[1.5],
    backgroundColor: `${GOLD}12`,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: `${GOLD}55`,
    padding: spacing[2],
    marginBottom: spacing[3],
  },
  guaranteeTextWrap: {
    flex: 1,
  },
  guaranteeTitle: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.base,
    color: TEXT_PRIMARY,
    marginBottom: 2,
  },
  guaranteeText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.sm,
    color: TEXT_SECONDARY,
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
  },
  priceLine: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.base,
    color: TEXT_PRIMARY,
    textAlign: 'center',
  },
  priceSubline: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.xs,
    color: TEXT_TERTIARY,
    textAlign: 'center',
    marginBottom: spacing[3],
  },
  ctaButton: {
    width: '100%',
    maxWidth: 480,
    height: 56,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
    overflow: 'hidden',
    ...shadows.md,
  },
  ctaText: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.md,
    color: palette.neutral[0],
  },
  secondaryButton: {
    marginTop: spacing[2],
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[2],
  },
  secondaryButtonText: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: typography.fontSize.base,
    color: TEXT_SECONDARY,
  },
  dismissButton: {
    marginTop: spacing[1],
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[2],
  },
  dismissButtonText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.xs,
    color: TEXT_TERTIARY,
  },
});
