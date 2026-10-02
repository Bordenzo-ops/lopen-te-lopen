/**
 * shareCardParts
 *
 * Gedeelde bouwstenen van de deelkaarten (ShareRunCard en SharePeriodCard).
 *
 * Waarom apart: beide kaarten hadden hun eigen kopie van de merkbalk, de
 * statistiekcel en de merkvoet. Toen de huisstijl werd doorgevoerd kreeg de
 * periodekaart de nieuwe opmaak en de runkaart niet, en dat viel pas op bij
 * het testen op toestel. Door de onderdelen hier te zetten kan dat niet meer
 * gebeuren: een aanpassing raakt beide kaarten tegelijk.
 *
 * Ontwerpreferenties op ware grootte (1080x1920 = exact 3x deze kaarten):
 *   scripts/brand-assets/card-story.html               — periodekaart 'gradient'
 *   scripts/brand-assets/card-period-chart-story.html  — periodekaart 'chart'
 *   scripts/brand-assets/card-run-story.html           — runkaart
 * Deel elke waarde daar door 3 om bij de styles hier uit te komen.
 */

import React from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { palette, typography, radius, spacing } from '../../theme/tokens';

// ── Formaat: Instagram Stories 9:16 ─────────────────────────────────────────
export const CARD_WIDTH  = 360;
export const CARD_HEIGHT = 640;

/** Horizontale marge van alle varianten. */
export const PAD_H = spacing[3]; // 24

// ── Merk-assets ─────────────────────────────────────────────────────────────
export const APP_ICON    = require('../../../assets/icon.png');
/** Heldplaat: de schoen met oranje sweep. Draagt de periodekaart. */
export const ART_HERO    = require('../../../assets/brand/share-bg-hero.jpg');
/** Rustige topografieplaat. Laat een routetracé erover nog leesbaar. */
export const ART_TEXTURE = require('../../../assets/brand/share-bg-texture.jpg');

export const SOCIAL_HANDLE = '@lopentelopen';
export const BRAND_NAME    = 'Lopen te Lopen';

/** Android knijpt regels met negatieve letterSpacing af zonder deze vlag. */
export const NO_FONT_PADDING = Platform.OS === 'android' ? { includeFontPadding: false } : null;

// ── Formatters ──────────────────────────────────────────────────────────────

export function formatPace(secPerKm: number | null | undefined): string {
  if (!secPerKm || secPerKm <= 0) return '--:--';
  const mins = Math.floor(secPerKm / 60);
  const secs = Math.round(secPerKm % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Onderdelen ──────────────────────────────────────────────────────────────

/**
 * Kop: app-icoon + merknaam links, naam van de loper rechts.
 *
 * `transparent` is voor de sticker-variant (WP14): zonder scrim eronder moet
 * de tekst zichzelf leesbaar houden — wit + een subtiele donkere textShadow
 * in plaats van de gebruikelijke grijstinten.
 */
export function TopBar({
  runnerName,
  light = false,
  transparent = false,
}: {
  runnerName?: string;
  light?: boolean;
  transparent?: boolean;
}) {
  return (
    <View style={styles.topBar}>
      <View style={styles.lockup}>
        <Image source={APP_ICON} style={styles.topIcon} />
        <Text style={[styles.topName, light && styles.topNameLight, transparent && styles.topNameTransparent]}>
          {BRAND_NAME}
        </Text>
      </View>
      {runnerName ? (
        <Text
          style={[styles.runnerName, light && styles.runnerNameLight, transparent && styles.runnerNameTransparent]}
          numberOfLines={1}
        >
          {runnerName}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Voet: merknaam + handle. Het stukje dat nieuwsgierig moet maken.
 *
 * `compact`: laat `marginTop: 'auto'` vervallen (voor kaarten die met de
 * inhoud meegroeien in plaats van een vaste `CARD_HEIGHT` te vullen — zie
 * de transparante sticker-variant in ShareRunCard).
 */
export function BrandFooter({
  light = false,
  transparent = false,
  compact = false,
}: {
  light?: boolean;
  transparent?: boolean;
  compact?: boolean;
}) {
  return (
    <View style={[styles.brandFooter, compact && styles.brandFooterCompact]}>
      <Text style={[styles.brandName, light && styles.brandNameLight, transparent && styles.brandNameTransparent]}>
        {BRAND_NAME}
      </Text>
      <View style={styles.brandDot} />
      <Text style={[styles.brandHandle, light && styles.brandHandleLight, transparent && styles.brandHandleTransparent]}>
        {SOCIAL_HANDLE}
      </Text>
    </View>
  );
}

/** Eén cel in een statistiekraster van drie kolommen. */
export function StatCell({
  label,
  value,
  unit,
  transparent = false,
}: {
  label: string;
  value: string;
  unit?: string;
  transparent?: boolean;
}) {
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statLabel, transparent && styles.statLabelTransparent]}>{label}</Text>
      <View style={styles.statValueRow}>
        <Text style={[styles.statValue, transparent && styles.statValueTransparent]} {...NO_FONT_PADDING}>
          {value}
        </Text>
        {unit && <Text style={[styles.statUnit, transparent && styles.statUnitTransparent]}>{unit}</Text>}
      </View>
    </View>
  );
}

/** Oranje haarlijn die naar rechts uitdooft; scheidt de hero van de stats. */
export function Hairline({ style }: { style?: any }) {
  const w = CARD_WIDTH - PAD_H * 2;
  return (
    <Svg width={w} height={1} style={[styles.hairline, style]}>
      <Defs>
        <LinearGradient id="hair" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={palette.primary[500]} stopOpacity="0.75" />
          <Stop offset="1" stopColor={palette.primary[500]} stopOpacity="0.10" />
        </LinearGradient>
      </Defs>
      <Rect width={w} height={1} fill="url(#hair)" />
    </Svg>
  );
}

/**
 * Leesbaarheidsverloop over het artwork. De plaat moet ergens écht open gaan,
 * anders is het artwork er wel maar zie je het niet en oogt de kaart als een
 * vlakke gradient. Twee profielen:
 *  - 'hero'    — periodekaart: open vanaf 70%, waar de schoen staat.
 *  - 'texture' — runkaart: langer donker (route + statistiek staan hoger),
 *                open in de onderste derde waar de oranje sweep mag ademen.
 */
export function ArtScrim({ profile = 'hero' }: { profile?: 'hero' | 'texture' }) {
  const stops = profile === 'texture'
    ? [
        { offset: '0',    opacity: '0.97' },
        { offset: '0.52', opacity: '0.93' },
        { offset: '0.70', opacity: '0.35' },
        { offset: '0.80', opacity: '0'    },
      ]
    : [
        { offset: '0',    opacity: '0.97' },
        { offset: '0.38', opacity: '0.90' },
        { offset: '0.58', opacity: '0.30' },
        { offset: '0.70', opacity: '0'    },
      ];
  const bottomStart = profile === 'texture' ? '0.80' : '0.78';

  return (
    <Svg width={CARD_WIDTH} height={CARD_HEIGHT} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="scrimTop" x1="0" y1="0" x2="0" y2="1">
          {stops.map(s => (
            <Stop key={s.offset} offset={s.offset} stopColor={palette.neutral[950]} stopOpacity={s.opacity} />
          ))}
        </LinearGradient>
        <LinearGradient id="scrimBottom" x1="0" y1="0" x2="0" y2="1">
          <Stop offset={bottomStart} stopColor={palette.neutral[950]} stopOpacity="0" />
          <Stop offset="0.91"        stopColor={palette.neutral[950]} stopOpacity="0.55" />
          <Stop offset="1"           stopColor={palette.neutral[950]} stopOpacity="0.95" />
        </LinearGradient>
      </Defs>
      <Rect width={CARD_WIDTH} height={CARD_HEIGHT} fill="url(#scrimTop)" />
      <Rect width={CARD_WIDTH} height={CARD_HEIGHT} fill="url(#scrimBottom)" />
    </Svg>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

/**
 * Tekstschaduw voor de transparante sticker-variant (WP14). Zonder de
 * donkere ArtScrim staat alle tekst op een onbekende foto — grijstinten
 * verdwijnen dan. Oplossing: wit + deze subtiele schaduw voor contrast,
 * en hiërarchie via grootte/gewicht/letterafstand in plaats van grijswaarden
 * (contrast is geen ontwerpmiddel meer zodra de ondergrond onbekend is).
 */
const textShadowTransparent = {
  textShadowColor: 'rgba(0,0,0,0.55)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 4,
} as const;

export const styles = StyleSheet.create({
  /** Basis van beide kaarten. */
  card: {
    width:  CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: palette.neutral[950],
    borderRadius: radius['2xl'],
    overflow: 'hidden',
  },
  /**
   * Sticker-variant (WP14): geen achtergrond, geen vaste 9:16-hoogte — hij
   * groeit mee met de inhoud. Losstaand van `card` gehouden (nooit die style
   * hier hergebruiken via samenvoegen): `card` is gedeeld met SharePeriodCard.
   */
  cardTransparent: {
    width: CARD_WIDTH,
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
    paddingHorizontal: PAD_H,
    paddingTop: 28,
    paddingBottom: spacing[3],
  },
  /** Content-container voor `cardTransparent`: geen `flex: 1`, dus de hoogte
   *  volgt de inhoud in plaats van een kaart met vaste hoogte te vullen. */
  contentCompact: {
    paddingHorizontal: PAD_H,
    paddingTop: 28,
    paddingBottom: spacing[3],
  },

  // ── Merkbalk boven ──
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  topIcon: {
    width: 20,
    height: 20,
    borderRadius: 5,
  },
  topName: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 8,
    color: palette.neutral[0],
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  topNameLight: { color: palette.neutral[900] },
  // topName is al wit — heeft alleen de schaduw nodig zodra de scrim vervalt.
  topNameTransparent: { ...textShadowTransparent },
  runnerName: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: 9,
    color: palette.neutral[400],
    maxWidth: 110,
  },
  runnerNameLight: { color: palette.neutral[500] },
  // Lichter gewicht dan topName (sansBold, hoofdletters, letterSpacing 1) houdt
  // de merknaam bovenaan de hiërarchie ook als beide wit zijn.
  runnerNameTransparent: {
    color: palette.neutral[0],
    fontFamily: typography.fontFamily.sansMedium,
    ...textShadowTransparent,
  },

  // ── Hero-stat ──
  heroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  heroValue: {
    fontFamily: typography.fontFamily.display,
    fontSize: 96,
    lineHeight: 96,
    letterSpacing: -4,
    color: palette.neutral[0],
  },
  // Al wit — heeft op de sticker-variant alleen de schaduw nodig.
  heroValueTransparent: { ...textShadowTransparent },
  heroUnit: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 21,
    color: palette.neutral[400],
    letterSpacing: -0.4,
  },
  // Secundair aan heroValue via gewicht/grootte (21px vs 96px), niet via grijs.
  heroUnitTransparent: {
    color: palette.neutral[0],
    ...textShadowTransparent,
  },

  hairline: { marginTop: spacing[1.5] },

  // ── Statistiekraster ──
  statCell: {
    width: '33.33%',
  },
  statLabel: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: 7,
    color: palette.neutral[500],
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  // Compenseert het verlies van grijs als captionmarkering met meer gewicht
  // en bredere letterafstand — blijft zo ondanks wit leesbaar als bijschrift.
  statLabelTransparent: {
    color: palette.neutral[0],
    fontFamily: typography.fontFamily.sansBold,
    letterSpacing: 1.6,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    marginTop: 4,
  },
  statValue: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 17,
    lineHeight: 19,
    letterSpacing: -0.5,
    color: palette.neutral[0],
  },
  // Al wit — heeft alleen de schaduw nodig.
  statValueTransparent: { ...textShadowTransparent },
  statUnit: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: 9,
    color: palette.neutral[500],
  },
  // Blijft secundair aan statValue via het lichtere gewicht/kleinere corps,
  // niet via grijs.
  statUnitTransparent: {
    color: palette.neutral[0],
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // ── Merkbalk onder ──
  brandFooter: {
    marginTop: 'auto' as any,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  // Voor kaarten die met de inhoud meegroeien (geen vaste CARD_HEIGHT) —
  // zie de sticker-variant van ShareRunCard.
  brandFooterCompact: {
    marginTop: spacing[3],
  },
  brandName: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 10,
    color: palette.neutral[0],
    letterSpacing: -0.1,
  },
  brandNameLight: { color: palette.neutral[900] },
  // Al wit — heeft alleen de schaduw nodig.
  brandNameTransparent: { ...textShadowTransparent },
  brandDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: palette.primary[500],
  },
  brandHandle: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: 9,
    color: palette.neutral[400],
  },
  brandHandleLight: { color: palette.neutral[500] },
  // Lichter gewicht dan brandName (sansBold) houdt het handle-teken secundair
  // ook als beide wit zijn.
  brandHandleTransparent: {
    color: palette.neutral[0],
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
