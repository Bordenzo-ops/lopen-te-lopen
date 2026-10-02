/**
 * ShareRunSheet
 *
 * Bottom-sheet stijl overlay die na een voltooide sessie verschijnt.
 * Toont een preview van de ShareRunCard + deel-knoppen.
 *
 * Gebruik:
 *   <ShareRunSheet
 *     visible={showShare}
 *     session={completedSession}
 *     weekNumber={currentWeek}
 *     runnerName={profile.name}
 *     maxHeartRate={profile.maxHeartRate}
 *     onClose={() => setShowShare(false)}
 *   />
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  ScrollView,
  Platform,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import { Share2, Download, Camera } from 'lucide-react-native';
import { palette, typography, spacing, radius, shadows, type ThemeColors } from '../../theme/tokens';
import { useThemeColors } from '../../theme/useTheme';
import { SheetHandle, SheetCloseButton } from './sheetParts';
import { ShareRunCard, CARD_WIDTH, CARD_HEIGHT, type ShareRunCardVariant } from './ShareRunCard';
import { useShareRun } from '../../hooks/useShareRun';
import type { CompletedSession } from '../../store/appStore';

interface ShareRunSheetProps {
  visible: boolean;
  session: CompletedSession;
  weekNumber: number;
  runnerName?: string;
  maxHeartRate?: number;
  totalWeeks?: number;
  /** Naam van het actieve schema, zodat de kaart de run in het plan plaatst. */
  planLabel?: string;
  onClose: () => void;
}

// Schaal de card zodat hij past in de preview (max 80% van de schermbreedte).
// De hoogte is niet langer een vaste constante: de transparante variant heeft
// geen CARD_HEIGHT en groeit mee met de inhoud (zie previewCardHeight verderop).
const PREVIEW_SCALE = 0.72;
const PREVIEW_W = CARD_WIDTH  * PREVIEW_SCALE;

// 'card' staat vooraan en is de standaard: bestaand gedrag, niets verandert
// voor wie de kiezer niet aanraakt.
const VARIANTS: Array<{ key: ShareRunCardVariant; label: string }> = [
  { key: 'card',        label: 'Kaart' },
  { key: 'transparent', label: 'Transparant' },
];

/**
 * Dambordpatroon achter de preview bij de transparante variant, zodat
 * zichtbaar is dát de kaart transparant is (zo doet Strava het ook — zonder
 * die hint lijkt de kaart stuk). Met react-native-svg getekend, geen nieuwe
 * afhankelijkheid nodig.
 */
function Checkerboard({ width, height }: { width: number; height: number }) {
  const cell = 12;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern id="checker" width={cell * 2} height={cell * 2} patternUnits="userSpaceOnUse">
          <Rect width={cell * 2} height={cell * 2} fill={palette.neutral[100]} />
          <Rect x={0} y={0} width={cell} height={cell} fill={palette.neutral[300]} />
          <Rect x={cell} y={cell} width={cell} height={cell} fill={palette.neutral[300]} />
        </Pattern>
      </Defs>
      <Rect width={width} height={height} fill="url(#checker)" />
    </Svg>
  );
}

export function ShareRunSheet({
  visible,
  session,
  weekNumber,
  runnerName,
  maxHeartRate,
  totalWeeks,
  planLabel,
  onClose,
}: ShareRunSheetProps) {
  const { cardRef, isSharing, share, saveToLibrary, captureCard } = useShareRun();
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [variant, setVariant] = useState<ShareRunCardVariant>('card');

  // De transparante variant heeft geen vaste CARD_HEIGHT — hij groeit mee met
  // de inhoud. De preview meet daarom de werkelijke hoogte van de onzichtbare
  // full-res kaart (die toch al gerenderd wordt) en schaalt daarnaar; de
  // kaartvariant blijft ongemoeid op de vaste CARD_HEIGHT.
  const [transparentHeight, setTransparentHeight] = useState<number | null>(null);
  const handleOffscreenLayout = useCallback((e: LayoutChangeEvent) => {
    if (variant === 'transparent') {
      setTransparentHeight(e.nativeEvent.layout.height);
    }
  }, [variant]);
  const previewCardHeight = variant === 'transparent' ? (transparentHeight ?? CARD_HEIGHT) : CARD_HEIGHT;
  const previewH = previewCardHeight * PREVIEW_SCALE;

  const handleInstagram = useCallback(async () => {
    const result = await share();
    if (result.success && result.method !== 'saved') {
      onClose();
    }
  }, [share, onClose]);

  const handleSave = useCallback(async () => {
    // onPress awaits deze functie niet — vang alles af zodat er nooit een
    // onafgehandelde rejection ontstaat (zie Sentry ANDROID-5).
    try {
      const uri = await captureCard();
      if (uri) {
        await saveToLibrary(uri);
      }
    } catch (err) {
      console.error('[ShareRunSheet] handleSave:', err);
    }
  }, [captureCard, saveToLibrary]);

  const handleGenericShare = useCallback(async () => {
    const result = await share();
    if (result.success) onClose();
  }, [share, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={styles.sheet}>
        <SheetHandle />

        <Text style={styles.title}>Deel je run</Text>
        <Text style={styles.subtitle}>
          Klaar voor de 'gram? Jouw stats in één oogopslag.
        </Text>

        {/* Stijlkiezer */}
        <View style={styles.variantRow}>
          {VARIANTS.map((v) => {
            const active = variant === v.key;
            return (
              <TouchableOpacity
                key={v.key}
                style={[styles.variantChip, active && styles.variantChipActive]}
                onPress={() => setVariant(v.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.variantChipText, active && styles.variantChipTextActive]}>
                  {v.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Card preview — hier wordt de echte card gerenderd (buiten beeld) */}
        <ScrollView
          horizontal
          contentContainerStyle={styles.previewScroll}
          showsHorizontalScrollIndicator={false}
        >
          {/* Zichtbare geschaalde preview. Bij 'transparent' staat er een
              dambordpatroon achter zodat zichtbaar is dát hij transparant is. */}
          <View style={[styles.previewWrapper, { width: PREVIEW_W, height: previewH }]}>
            {variant === 'transparent' && (
              <Checkerboard width={PREVIEW_W} height={previewH} />
            )}
            <View
              style={{
                width:     CARD_WIDTH,
                height:    previewCardHeight,
                transform: [
                  { translateX: -(CARD_WIDTH * (1 - PREVIEW_SCALE)) / 2 },
                  { translateY: -(previewCardHeight * (1 - PREVIEW_SCALE)) / 2 },
                  { scale: PREVIEW_SCALE },
                ],
              }}
              pointerEvents="none"
            >
              <ShareRunCard
                session={session}
                weekNumber={weekNumber}
                runnerName={runnerName}
                maxHeartRate={maxHeartRate}
                totalWeeks={totalWeeks}
                planLabel={planLabel}
                variant={variant}
              />
            </View>
          </View>
        </ScrollView>

        {/* Onzichtbare full-res card voor de screenshot. Zelfde variant als
            de preview hierboven — anders deelt de gebruiker iets anders dan
            hij ziet. */}
        <View style={styles.offscreen} pointerEvents="none" onLayout={handleOffscreenLayout}>
          <ShareRunCard
            ref={cardRef}
            session={session}
            weekNumber={weekNumber}
            runnerName={runnerName}
            maxHeartRate={maxHeartRate}
            totalWeeks={totalWeeks}
            planLabel={planLabel}
            variant={variant}
          />
        </View>

        {/* Knoppen */}
        <View style={styles.actions}>
          {/* Instagram (primaire actie) */}
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleInstagram}
            disabled={isSharing}
            activeOpacity={0.8}
          >
            {isSharing ? (
              <ActivityIndicator color={palette.neutral[50]} />
            ) : (
              <>
                <Camera size={20} color={palette.neutral[50]} strokeWidth={2} />
                <Text style={styles.primaryBtnText}>Deel op Instagram</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Secundaire knoppen */}
          <View style={styles.secondaryRow}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={handleSave}
              disabled={isSharing}
              activeOpacity={0.75}
            >
              <Download size={18} color={colors.textSecondary} strokeWidth={2} />
              <Text style={styles.secondaryBtnText}>Opslaan</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={handleGenericShare}
              disabled={isSharing}
              activeOpacity={0.75}
            >
              <Share2 size={18} color={colors.textSecondary} strokeWidth={2} />
              <Text style={styles.secondaryBtnText}>Meer opties</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Laatste kind, zie sheetParts. */}
        <SheetCloseButton onPress={onClose} />
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },

  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bgSurface,
    borderTopLeftRadius:  radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    ...shadows.lg,
  },


  title: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize:   typography.fontSize.xl,
    color:      colors.textPrimary,
    textAlign:  'center',
    marginTop:  spacing[1],
  },
  subtitle: {
    fontFamily: typography.fontFamily.sans,
    fontSize:   typography.fontSize.sm,
    color:      colors.textSecondary,
    textAlign:  'center',
    marginTop:  4,
    marginBottom: spacing[2],
  },

  // Stijlkiezer (zelfde opzet als SharePeriodSheet)
  variantRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    marginBottom: spacing[1.5],
  },
  variantChip: {
    paddingHorizontal: spacing[2],
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgCard,
  },
  variantChipActive: {
    borderColor: colors.brandPrimary,
    backgroundColor: colors.brandPrimary + '20',
  },
  variantChipText: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize:   typography.fontSize.sm,
    color:      colors.textSecondary,
  },
  variantChipTextActive: {
    fontFamily: typography.fontFamily.sansSemi,
    color:      colors.brandPrimary,
  },

  previewScroll: {
    paddingHorizontal: spacing[2],
    paddingBottom: spacing[2],
  },
  previewWrapper: {
    overflow: 'hidden',
    borderRadius: radius.xl,
    ...shadows.md,
  },

  // Volledig buiten zicht maar wel gerenderd — voor de screenshot
  // Op Android: links buiten beeld is betrouwbaarder dan negatieve top
  offscreen: {
    position: 'absolute',
    top: 0,
    left: -(CARD_WIDTH + 50),
  },

  actions: {
    paddingHorizontal: spacing[3],
    gap: spacing[1],
  },

  primaryBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap: spacing[1],
    backgroundColor: '#E1306C', // Instagram rood-roze
    borderRadius:    radius.xl,
    paddingVertical: spacing[1.5],
  },
  primaryBtnText: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize:   typography.fontSize.base,
    color:      palette.neutral[50],
  },

  secondaryRow: {
    flexDirection: 'row',
    gap: spacing[1],
  },
  secondaryBtn: {
    flex: 1,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.bgCard,
    borderRadius:    radius.xl,
    paddingVertical: spacing[1.5],
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  secondaryBtnText: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize:   typography.fontSize.sm,
    color:      colors.textSecondary,
  },
});
