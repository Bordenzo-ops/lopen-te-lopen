/**
 * PaywallScreen
 *
 * Nederlandse betaalmuur voor premium. Toont de twee abonnementsopties
 * (maandelijks en jaarlijks), de premium-voordelen, en knoppen om te kopen,
 * aankopen te herstellen en te sluiten.
 *
 * Echte prijzen komen uit de RevenueCat-offering wanneer beschikbaar. Zonder
 * RevenueCat-sleutel of netwerk vallen we terug op vaste fallbackteksten en
 * blijven aankopen netjes uitgeschakeld. Het scherm crasht nooit.
 *
 * Dit scherm bouwt zelf geen feature-gating in: dat doet de premium-gating
 * laag via usePremium. Hier staat alleen de paywall zelf.
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Check, Crown } from 'lucide-react-native';
import { colors, typography, spacing, radius, shadows, type ThemeColors } from '../src/theme/tokens';
import { useThemeColors } from '../src/theme/useTheme';
import { Button } from '../src/components/ui/Button';
import { Card } from '../src/components/ui/Card';
import { useAppStore } from '../src/store/appStore';
import {
  getOfferings,
  purchasePackage,
  restorePurchases,
  FALLBACK_PRICE_MONTHLY,
  FALLBACK_PRICE_YEARLY,
  type PurchasesOffering,
  type PurchasesPackage,
} from '../src/services/purchaseService';

const GOLD = colors.premium;

const VOORDELEN = [
  'Onbeperkt routes plannen',
  "Alle wedstrijdschema's",
  'ElevenLabs premium-stemmen en coaching',
];

interface PlanOption {
  /** Het RevenueCat-pakket, of null als alleen de fallbacktekst beschikbaar is. */
  pkg: PurchasesPackage | null;
  /** Titel van de optie. */
  title: string;
  /** Prijstekst, uit RevenueCat of de fallback. */
  price: string;
  /** Korte ondertitel. */
  subtitle?: string;
}

export default function PaywallScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const setPremium = useAppStore(s => s.setPremium);
  const refreshPremium = useAppStore(s => s.refreshPremium);

  const [loadingOfferings, setLoadingOfferings] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [monthly, setMonthly] = useState<PlanOption>({
    pkg: null,
    title: 'Maandelijks',
    price: FALLBACK_PRICE_MONTHLY,
  });
  const [yearly, setYearly] = useState<PlanOption>({
    pkg: null,
    title: 'Jaarlijks',
    price: FALLBACK_PRICE_YEARLY,
    subtitle: 'Voordeligst',
  });

  // Haal de echte prijzen op uit de RevenueCat-offering, met fallback.
  useEffect(() => {
    let active = true;
    (async () => {
      const offering: PurchasesOffering | null = await getOfferings();
      if (!active) return;

      if (offering) {
        const m = offering.monthly ?? null;
        const y = offering.annual ?? null;
        if (m) {
          setMonthly({
            pkg: m,
            title: 'Maandelijks',
            price: `${m.product.priceString} per maand`,
          });
        }
        if (y) {
          setYearly({
            pkg: y,
            title: 'Jaarlijks',
            price: `${y.product.priceString} per jaar`,
            subtitle: 'Voordeligst',
          });
        }
      }
      setLoadingOfferings(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const close = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/dashboard');
    }
  };

  const onPurchase = async (option: PlanOption) => {
    if (!option.pkg) {
      Alert.alert(
        'Nog niet beschikbaar',
        'Abonnementen zijn nog niet ingesteld. Probeer het later opnieuw.',
      );
      return;
    }
    setBusyId(option.pkg.identifier);
    try {
      const result = await purchasePackage(option.pkg);
      if (result.cancelled) return;
      if (result.ok && result.isPremium) {
        setPremium(true);
        Alert.alert('Gelukt', result.message ?? 'Je premium is geactiveerd.', [
          { text: 'Top', onPress: close },
        ]);
      } else if (result.message) {
        Alert.alert('Aankoop', result.message);
      }
    } finally {
      setBusyId(null);
    }
  };

  const onRestore = async () => {
    setRestoring(true);
    try {
      const result = await restorePurchases();
      if (result.ok && result.isPremium) {
        setPremium(true);
        Alert.alert('Hersteld', result.message ?? 'Je premium is hersteld.', [
          { text: 'Top', onPress: close },
        ]);
      } else {
        await refreshPremium();
        Alert.alert('Herstellen', result.message ?? 'Geen actieve aankopen gevonden.');
      }
    } finally {
      setRestoring(false);
    }
  };

  const anyBusy = busyId !== null || restoring;

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

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.crownWrap}>
          <Crown size={40} color={GOLD} strokeWidth={2} />
        </View>

        <Text style={styles.title} accessibilityRole="header">
          Lopen te Lopen Premium
        </Text>
        <Text style={styles.subtitle}>
          Haal alles uit je training met onbeperkt plannen en de beste coaching.
        </Text>

        {/* Voordelen */}
        <Card variant="surface" padding="lg" style={styles.benefitsCard}>
          {VOORDELEN.map(voordeel => (
            <View key={voordeel} style={styles.benefitRow}>
              <View style={styles.benefitIcon}>
                <Check size={16} color={colors.success} strokeWidth={3} />
              </View>
              <Text style={styles.benefitText}>{voordeel}</Text>
            </View>
          ))}
        </Card>

        {/* Abonnementsopties */}
        {loadingOfferings ? (
          <View style={styles.loadingPrices}>
            <ActivityIndicator color={colors.brandPrimary} />
            <Text style={styles.loadingText}>Prijzen laden</Text>
          </View>
        ) : (
          <View style={styles.options}>
            <PlanCard
              option={yearly}
              highlighted
              busy={busyId === yearly.pkg?.identifier}
              disabled={anyBusy}
              onPress={() => onPurchase(yearly)}
            />
            <PlanCard
              option={monthly}
              busy={busyId === monthly.pkg?.identifier}
              disabled={anyBusy}
              onPress={() => onPurchase(monthly)}
            />
          </View>
        )}

        <Button
          label="Aankopen herstellen"
          variant="ghost"
          onPress={onRestore}
          loading={restoring}
          disabled={anyBusy}
          style={styles.restoreButton}
        />

        <Text style={styles.fineprint}>
          Het abonnement verlengt automatisch tot je opzegt. Opzeggen kan op elk
          moment via je Google Play-account.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

interface PlanCardProps {
  option: PlanOption;
  highlighted?: boolean;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}

function PlanCard({ option, highlighted, busy, disabled, onPress }: PlanCardProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Kies ${option.title}: ${option.price}`}
      accessibilityState={{ disabled, busy }}
      style={[
        styles.planCard,
        highlighted ? styles.planCardHighlighted : styles.planCardDefault,
        disabled && styles.planCardDisabled,
      ]}
    >
      <View style={styles.planInfo}>
        <View style={styles.planTitleRow}>
          <Text style={styles.planTitle}>{option.title}</Text>
          {option.subtitle && (
            <View style={styles.planTag}>
              <Text style={styles.planTagText}>{option.subtitle}</Text>
            </View>
          )}
        </View>
        <Text style={styles.planPrice}>{option.price}</Text>
      </View>
      {busy ? (
        <ActivityIndicator color={highlighted ? colors.textInverse : colors.brandPrimary} />
      ) : (
        <View
          style={[
            styles.planChoose,
            highlighted ? styles.planChooseHighlighted : styles.planChooseDefault,
          ]}
        >
          <Text
            style={[
              styles.planChooseText,
              highlighted ? styles.planChooseTextHighlighted : styles.planChooseTextDefault,
            ]}
          >
            Kiezen
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgBase,
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
  crownWrap: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: `${GOLD}1A`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
    borderWidth: 1,
    borderColor: `${GOLD}40`,
  },
  title: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize['2xl'],
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing[1],
  },
  subtitle: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.fontSize.base * typography.lineHeight.normal,
    marginBottom: spacing[3],
    paddingHorizontal: spacing[1],
  },
  benefitsCard: {
    width: '100%',
    marginBottom: spacing[3],
    gap: spacing[1.5],
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
  },
  benefitIcon: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
    backgroundColor: `${colors.success}22`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    flex: 1,
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  loadingPrices: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: spacing[3],
    gap: spacing[1],
  },
  loadingText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  options: {
    width: '100%',
    gap: spacing[1.5],
    marginBottom: spacing[2],
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.xl,
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[2],
    ...shadows.sm,
  },
  planCardDefault: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  planCardHighlighted: {
    backgroundColor: colors.bgCard,
    borderWidth: 1.5,
    borderColor: GOLD,
  },
  planCardDisabled: {
    opacity: 0.55,
  },
  planInfo: {
    flex: 1,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginBottom: 2,
  },
  planTitle: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  planTag: {
    backgroundColor: `${GOLD}22`,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: `${GOLD}55`,
  },
  planTagText: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.xs,
    color: GOLD,
    letterSpacing: typography.letterSpacing.wide,
  },
  planPrice: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  planChoose: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  planChooseDefault: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  planChooseHighlighted: {
    backgroundColor: colors.brandPrimary,
  },
  planChooseText: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.sm,
    letterSpacing: typography.letterSpacing.wide,
  },
  planChooseTextDefault: {
    color: colors.textPrimary,
  },
  planChooseTextHighlighted: {
    color: colors.textInverse,
  },
  restoreButton: {
    marginTop: spacing[1],
    marginBottom: spacing[2],
  },
  fineprint: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: typography.fontSize.xs * typography.lineHeight.normal,
    paddingHorizontal: spacing[2],
  },
});
