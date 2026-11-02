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
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, Linking, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { StatusBar } from 'expo-status-bar';
import { palette, darkColors, spacing, radius, typography, shadows } from '../src/theme/tokens';
import { useAppStore } from '../src/store/appStore';
import { trackEvent } from '../src/services/analyticsService';
import {
  PREMIUM_INTRO_CAMPAIGN_LABEL,
  PREMIUM_INTRO_TITLE,
  PREMIUM_INTRO_SUBTITLE,
  PREMIUM_INTRO_BENEFITS,
  PREMIUM_INTRO_GUARANTEE_TITLE,
  PREMIUM_INTRO_PRICE_LINE,
  PREMIUM_INTRO_PRICE_SUBLINE,
  PREMIUM_INTRO_CTA_PRIMARY,
  PREMIUM_INTRO_CTA_SECONDARY,
  PREMIUM_INTRO_CTA_DISMISS,
  type PremiumIntroIcon,
} from '../src/config/premiumIntroConfig';
import { FINISH_GUARANTEE_TERMS_URL } from '../src/config/legalLinks';
import { FINISH_GUARANTEE_LINK_LABEL, FINISH_GUARANTEE_TEXT } from '../src/config/finishGuarantee';

// Vaste, donkere merkkleuren — bewust NIET via useThemeColors(), zie boven.
const BG = palette.neutral[950];
const BRAND = palette.primary[500];
const TEXT_PRIMARY = palette.neutral[50];
const TEXT_SECONDARY = palette.neutral[400];
// Donker-thema textTertiary (#8B95A4): neutral[500] haalt op deze achtergrond maar 3,99:1.
const TEXT_TERTIARY = darkColors.textTertiary;

// Hero image height as a share of the screen, and the bottom share that fades into BG.
const HERO_HEIGHT_RATIO = 0.42;
const HERO_FADE_RATIO = 0.4;
const HERO_FADE_BANDS = 12;

/** Icoon-key uit de config gemapt naar de lucide-component in dit scherm. */
const ICON_MAP: Record<PremiumIntroIcon, LucideIcon> = {
  target: Target,
  headphones: Headphones,
  map: Map,
  'trending-up': TrendingUp,
};

export default function PremiumIntroScreen() {
  const styles = useMemo(() => makeStyles(), []);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const heroHeight = Math.round(height * HERO_HEIGHT_RATIO);
  const bandHeight = Math.ceil((heroHeight * HERO_FADE_RATIO) / HERO_FADE_BANDS);

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

  // Best-effort: lukt het openen niet, dan gebeurt er niets.
  const onOpenGuaranteeTerms = async () => {
    try {
      await Linking.openURL(FINISH_GUARANTEE_TERMS_URL);
    } catch {
      // Stil falen
    }
  };

  const onCta = () => {
    void trackEvent('premium_intro_cta');
    router.replace('/paywall');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Vaste donkere achtergrond: lichte statusbariconen, ook in lichte modus. */}
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero: borderless brand image, full width, fading into the background */}
        <View style={{ width, height: heroHeight }}>
          <Image
            source={require('../assets/icon.png')}
            style={{ width, height: heroHeight }}
            resizeMode="cover"
            fadeDuration={0}
            accessible={false}
          />
          {/* Stacked plain Views as a gradient (no SVG): alpha rises from 0 to 1 */}
          <View
            style={[styles.heroFade, { height: bandHeight * HERO_FADE_BANDS }]}
            pointerEvents="none"
          >
            {Array.from({ length: HERO_FADE_BANDS }, (_, i) => (
              <View
                key={i}
                style={{
                  height: bandHeight,
                  backgroundColor: `rgba(10,15,26,${(i / (HERO_FADE_BANDS - 1)).toFixed(3)})`,
                }}
              />
            ))}
          </View>
        </View>

        <Text style={styles.campaignLabel}>{PREMIUM_INTRO_CAMPAIGN_LABEL}</Text>
        <Text style={styles.title} accessibilityRole="header">{PREMIUM_INTRO_TITLE}</Text>
        <Text style={styles.subtitle}>{PREMIUM_INTRO_SUBTITLE}</Text>

        {/* Voordelen */}
        <View style={styles.benefitsList}>
          {PREMIUM_INTRO_BENEFITS.map((benefit) => {
            const Icon = ICON_MAP[benefit.icon];
            return (
              <View key={benefit.title} style={styles.benefitRow}>
                <View style={styles.benefitIconWrap}>
                  <Icon size={20} color={BRAND} strokeWidth={2} />
                </View>
                <View style={styles.benefitTextWrap}>
                  <Text style={styles.benefitTitle}>{benefit.title}</Text>
                  <Text style={styles.benefitText}>{benefit.text}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.footer}>
          {/* Finish-garantie: alleen zichtbaar als finishGuarantee.ts is geactiveerd */}
          {FINISH_GUARANTEE_TEXT ? (
            <View style={styles.guaranteeCard}>
              <ShieldCheck size={26} color={BRAND} strokeWidth={2} />
              <View style={styles.guaranteeTextWrap}>
                <Text style={styles.guaranteeTitle}>{PREMIUM_INTRO_GUARANTEE_TITLE}</Text>
                <Text style={styles.guaranteeText}>
                  {FINISH_GUARANTEE_TEXT}{' '}
                  <Text
                    style={styles.guaranteeLink}
                    onPress={onOpenGuaranteeTerms}
                    accessibilityRole="link"
                  >
                    {FINISH_GUARANTEE_LINK_LABEL}
                  </Text>
                </Text>
              </View>
            </View>
          ) : null}

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
            <ArrowRight size={20} color={palette.neutral[950]} strokeWidth={2.5} />
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
        </View>
      </ScrollView>

      {/* Close button on top of the image, inside the safe area */}
      <TouchableOpacity
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel="Sluiten"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={[styles.closeButton, { top: insets.top + spacing[1] }]}
      >
        <X size={20} color={TEXT_PRIMARY} strokeWidth={2.5} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const makeStyles = () => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
  closeButton: {
    position: 'absolute',
    right: spacing[2],
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(10,15,26,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingBottom: spacing[5],
  },
  heroFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  campaignLabel: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.sm,
    color: BRAND,
    textTransform: 'none',
    marginBottom: spacing[1],
    paddingHorizontal: spacing[3],
  },
  title: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize['2xl'],
    color: TEXT_PRIMARY,
    lineHeight: typography.fontSize['2xl'] * typography.lineHeight.tight,
    letterSpacing: -0.5,
    marginBottom: spacing[1],
    paddingHorizontal: spacing[3],
  },
  subtitle: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.base,
    color: TEXT_SECONDARY,
    lineHeight: typography.fontSize.base * typography.lineHeight.normal,
    marginBottom: spacing[3],
    paddingHorizontal: spacing[3],
  },
  benefitsList: {
    gap: spacing[2],
    marginBottom: spacing[3],
    paddingHorizontal: spacing[3],
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
  },
  benefitIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${BRAND}1F`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitTextWrap: {
    flex: 1,
  },
  benefitTitle: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.base,
    color: TEXT_PRIMARY,
    marginBottom: 2,
  },
  benefitText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.sm,
    color: TEXT_SECONDARY,
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
  },
  footer: {
    paddingHorizontal: spacing[3],
  },
  guaranteeCard: {
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[1.5],
    backgroundColor: `${BRAND}12`,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: `${BRAND}55`,
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
  guaranteeLink: {
    fontFamily: typography.fontFamily.sansSemi,
    color: BRAND,
    textDecorationLine: 'underline',
  },
  priceLine: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.base,
    color: TEXT_PRIMARY,
  },
  priceSubline: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.xs,
    color: TEXT_TERTIARY,
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
    color: palette.neutral[950],
  },
  secondaryButton: {
    alignSelf: 'center',
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
    alignSelf: 'center',
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
