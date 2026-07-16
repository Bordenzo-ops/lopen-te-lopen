/**
 * SharePeriodSheet
 *
 * Bottom-sheet stijl overlay om week-, maand-, kwartaal- of jaarprestaties te
 * delen (Strava-stijl periode-recap). Toont een live geschaalde preview van
 * de SharePeriodCard met een stijlkiezer (gradient/minimaal/grid) + dezelfde
 * deel-knoppen als ShareRunSheet. Hergebruikt de useShareRun-hook.
 *
 * Gebruik:
 *   <SharePeriodSheet
 *     visible={showShare}
 *     stats={getPeriodStats(completedSessions, 'month')}
 *     runnerName={profile.name}
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
} from 'react-native';
import { Share2, Download, X, Camera } from 'lucide-react-native';
import { palette, typography, spacing, radius, shadows, type ThemeColors } from '../../theme/tokens';
import { useThemeColors } from '../../theme/useTheme';
import {
  SharePeriodCard,
  CARD_WIDTH,
  CARD_HEIGHT,
  periodActionLabel,
  type SharePeriodCardVariant,
} from './SharePeriodCard';
import { useShareRun } from '../../hooks/useShareRun';
import type { PeriodStats } from '../../utils/periodStats';

export interface SharePeriodSheetProps {
  visible: boolean;
  stats: PeriodStats;
  runnerName?: string;
  onClose: () => void;
}

// Schaal de card zodat hij past in de preview (gelijk aan ShareRunSheet)
const PREVIEW_SCALE = 0.72;
const PREVIEW_W = CARD_WIDTH  * PREVIEW_SCALE;
const PREVIEW_H = CARD_HEIGHT * PREVIEW_SCALE;

const VARIANTS: Array<{ key: SharePeriodCardVariant; label: string }> = [
  { key: 'gradient', label: 'Gradient' },
  { key: 'minimal',  label: 'Minimaal' },
  { key: 'grid',     label: 'Grid' },
];

export function SharePeriodSheet({
  visible,
  stats,
  runnerName,
  onClose,
}: SharePeriodSheetProps) {
  const { cardRef, isSharing, share, saveToLibrary, captureCard } = useShareRun();
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [variant, setVariant] = useState<SharePeriodCardVariant>('gradient');

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
      console.error('[SharePeriodSheet] handleSave:', err);
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
        {/* Handle + sluitknop */}
        <View style={styles.sheetHeader}>
          <View style={styles.handle} />
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={12}>
            <X size={20} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>{periodActionLabel(stats.period)}</Text>
        <Text style={styles.subtitle}>
          Jouw prestaties van {stats.label.toLowerCase()} in één oogopslag.
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
          {/* Zichtbare geschaalde preview, wisselt live mee met de gekozen stijl */}
          <View style={[styles.previewWrapper, { width: PREVIEW_W, height: PREVIEW_H }]}>
            <View
              style={{
                width:     CARD_WIDTH,
                height:    CARD_HEIGHT,
                transform: [
                  { translateX: -(CARD_WIDTH * (1 - PREVIEW_SCALE)) / 2 },
                  { translateY: -(CARD_HEIGHT * (1 - PREVIEW_SCALE)) / 2 },
                  { scale: PREVIEW_SCALE },
                ],
              }}
              pointerEvents="none"
            >
              <SharePeriodCard
                stats={stats}
                runnerName={runnerName}
                variant={variant}
              />
            </View>
          </View>
        </ScrollView>

        {/* Onzichtbare full-res card voor de screenshot */}
        <View style={styles.offscreen} pointerEvents="none">
          <SharePeriodCard
            ref={cardRef}
            stats={stats}
            runnerName={runnerName}
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

  sheetHeader: {
    alignItems: 'center',
    paddingTop: spacing[1],
    paddingHorizontal: spacing[2],
    flexDirection: 'row',
    justifyContent: 'center',
  },
  handle: {
    width:  40,
    height: 4,
    backgroundColor: colors.borderDefault,
    borderRadius: radius.full,
  },
  closeBtn: {
    position: 'absolute',
    right: spacing[2],
    top: spacing[1],
    padding: 4,
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
    marginBottom: spacing[1.5],
    textTransform: 'capitalize',
  },

  // Stijlkiezer
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
