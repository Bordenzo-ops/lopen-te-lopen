/**
 * ShareCountdownCard
 *
 * Deelbare 9:16 kaart "X weken tot <race>". Zusje van ShareRunCard en
 * SharePeriodCard en gebouwd op dezelfde onderdelen (shareCardParts), zodat
 * een huisstijlwijziging ook hier doorkomt.
 *
 * Deze kaart is vooral een advertentie: de app-naam staat in de kop én groot
 * onderaan, samen met de URL, zodat wie de story ziet weet waar hij de app
 * vindt.
 *
 * Gebruik:
 *   const cardRef = useRef<View>(null);
 *   <ShareCountdownCard ref={cardRef} race={race} shortName="Rotterdam" runnerName="Lars" />
 */

import React, { forwardRef } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { palette, typography, radius, spacing } from '../../theme/tokens';
import type { Race } from '../../data/rotterdamRaces';
import { formatRaceDate } from '../../data/rotterdamRaces';
import { raceCountdown, countdownText } from '../../data/raceDetails';
import {
  APP_ICON,
  ART_HERO,
  ArtScrim,
  BRAND_NAME,
  Hairline,
  NO_FONT_PADDING,
  SOCIAL_HANDLE,
  TopBar,
  styles as shared,
} from './shareCardParts';

/**
 * TODO(Lars): bevestig dat dit het publieke adres is dat op de kaart moet
 * staan (het domein lag in augustus 2026 even plat, zie src/config/legalLinks.ts).
 * Eén plek, zodat een wijziging alle gedeelde kaarten raakt.
 */
export const APP_SHARE_URL = 'lopentelopen.nl';

export interface ShareCountdownCardProps {
  race: Race;
  /** Korte naam voor in de zin, bijv. "Rotterdam". Valt terug op de racenaam. */
  shortName?: string;
  runnerName?: string;
}

export const ShareCountdownCard = forwardRef<View, ShareCountdownCardProps>(function ShareCountdownCard(
  { race, shortName, runnerName },
  ref,
) {
  const countdown = raceCountdown(race.date);
  const target = shortName ?? race.name;

  // Hero: hele weken zolang het er minstens één is, daarna de dagen.
  const useWeeks = countdown.weeks >= 1;
  const heroValue = useWeeks ? countdown.weeks : Math.max(0, countdown.totalDays);
  const heroUnit = useWeeks
    ? (countdown.weeks === 1 ? 'week' : 'weken')
    : (heroValue === 1 ? 'dag' : 'dagen');
  const showHero = !countdown.isToday && !countdown.isPast;

  return (
    <View ref={ref} style={shared.card}>
      <Image source={ART_HERO} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <ArtScrim />

      <View style={shared.content}>
        <TopBar runnerName={runnerName} />

        <Text style={styles.kicker}>{showHero ? 'NOG' : race.name.toUpperCase()}</Text>

        {showHero ? (
          <>
            <View style={[shared.heroRow, styles.heroRow]}>
              <Text style={shared.heroValue} {...NO_FONT_PADDING}>{heroValue}</Text>
              <Text style={shared.heroUnit}>{heroUnit}</Text>
            </View>
            <Text style={styles.toLine} numberOfLines={2}>tot {target}</Text>
          </>
        ) : (
          <Text style={styles.doneLine}>{countdownText(countdown)}</Text>
        )}

        <Hairline style={styles.hairline} />

        <Text style={styles.raceName} numberOfLines={2}>{race.name}</Text>
        <Text style={styles.raceMeta}>{formatRaceDate(race.date)}</Text>
        {useWeeks && countdown.days > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{countdownText(countdown)} te gaan</Text>
          </View>
        )}

        {/* Prominente app-blok: de eigenlijke advertentie. */}
        <View style={styles.promo}>
          <Image source={APP_ICON} style={styles.promoIcon} />
          <View style={styles.promoText}>
            <Text style={styles.promoName} numberOfLines={1}>{BRAND_NAME}</Text>
            <Text style={styles.promoUrl} numberOfLines={1}>{APP_SHARE_URL}</Text>
          </View>
        </View>
        <Text style={styles.handle}>{SOCIAL_HANDLE}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  kicker: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 12,
    color: palette.primary[300],
    letterSpacing: 2.4,
    marginTop: spacing[3],
  },
  heroRow: { marginTop: spacing[1] },
  toLine: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.5,
    color: palette.neutral[0],
    marginTop: 2,
  },
  doneLine: {
    fontFamily: typography.fontFamily.display,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.5,
    color: palette.neutral[0],
    marginTop: spacing[1],
  },
  hairline: { marginTop: spacing[2] },
  raceName: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: 15,
    color: palette.neutral[0],
    marginTop: spacing[1.5],
  },
  raceMeta: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: 10,
    color: palette.neutral[400],
    marginTop: 3,
  },
  badge: {
    alignSelf: 'flex-start',
    marginTop: spacing[1.5],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(242,80,17,0.45)',
    backgroundColor: 'rgba(242,80,17,0.16)',
  },
  badgeText: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: 9,
    color: palette.primary[300],
  },
  promo: {
    marginTop: 'auto' as any,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    padding: spacing[1.5],
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(242,80,17,0.45)',
    backgroundColor: 'rgba(17,24,39,0.78)',
  },
  promoIcon: { width: 44, height: 44, borderRadius: 11 },
  promoText: { flex: 1, gap: 2 },
  promoName: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 16,
    color: palette.neutral[0],
    letterSpacing: -0.2,
  },
  promoUrl: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: 13,
    color: palette.primary[300],
  },
  handle: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: 9,
    color: palette.neutral[400],
    textAlign: 'center',
    marginTop: spacing[1],
  },
});
