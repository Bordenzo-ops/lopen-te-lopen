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
 *   scripts/brand-assets/card-story.html      — periodekaart
 *   scripts/brand-assets/card-run-story.html  — runkaart
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

/** Kop: app-icoon + merknaam links, naam van de loper rechts. */
export function TopBar({ runnerName, light = false }: { runnerName?: string; light?: boolean }) {
  return (
    <View style={styles.topBar}>
      <View style={styles.lockup}>
        <Image source={APP_ICON} style={styles.topIcon} />
        <Text style={[styles.topName, light && styles.topNameLight]}>{BRAND_NAME}</Text>
      </View>
      {runnerName ? (
        <Text style={[styles.runnerName, light && styles.runnerNameLight]} numberOfLines={1}>
          {runnerName}
        </Text>
      ) : null}
    </View>
  );
}

/** Voet: merknaam + handle. Het stukje dat nieuwsgierig moet maken. */
export function BrandFooter({ light = false }: { light?: boolean }) {
  return (
    <View style={styles.brandFooter}>
      <Text style={[styles.brandName, light && styles.brandNameLight]}>{BRAND_NAME}</Text>
      <View style={styles.brandDot} />
      <Text style={[styles.brandHandle, light && styles.brandHandleLight]}>{SOCIAL_HANDLE}</Text>
    </View>
  );
}

/** Eén cel in een statistiekraster van drie kolommen. */
export function StatCell({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValueRow}>
        <Text style={styles.statValue} {...NO_FONT_PADDING}>{value}</Text>
        {unit && <Text style={styles.statUnit}>{unit}</Text>}
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

export const styles = StyleSheet.create({
  /** Basis van beide kaarten. */
  card: {
    width:  CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: palette.neutral[950],
    borderRadius: radius['2xl'],
    overflow: 'hidden',
  },
  content: {
    flex: 1,
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
  runnerName: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: 9,
    color: palette.neutral[400],
    maxWidth: 110,
  },
  runnerNameLight: { color: palette.neutral[500] },

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
  heroUnit: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 21,
    color: palette.neutral[400],
    letterSpacing: -0.4,
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
  statUnit: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: 9,
    color: palette.neutral[500],
  },

  // ── Merkbalk onder ──
  brandFooter: {
    marginTop: 'auto' as any,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  brandName: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 10,
    color: palette.neutral[0],
    letterSpacing: -0.1,
  },
  brandNameLight: { color: palette.neutral[900] },
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
});
