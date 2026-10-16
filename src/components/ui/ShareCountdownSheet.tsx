/**
 * ShareCountdownSheet
 *
 * Bottom-sheet om de "X weken tot <race>"-kaart te delen. Zelfde opzet en
 * deel-knoppen als ShareRunSheet, zonder stijlkiezer (er is één kaart).
 * Het delen wordt gelogd als 'race_countdown_shared'.
 *
 * Gebruik:
 *   <ShareCountdownSheet
 *     visible={showShare}
 *     race={race}
 *     shortName="Rotterdam"
 *     runnerName={profile?.name}
 *     onClose={() => setShowShare(false)}
 *   />
 */

import React, { useCallback, useMemo } from 'react';
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
import { Share2, Download, Camera } from 'lucide-react-native';
import { palette, typography, spacing, radius, shadows, type ThemeColors } from '../../theme/tokens';
import { useThemeColors } from '../../theme/useTheme';
import { SheetHandle, SheetCloseButton } from './sheetParts';
import { ShareCountdownCard } from './ShareCountdownCard';
import { CARD_WIDTH, CARD_HEIGHT } from './shareCardParts';
import { useShareRun } from '../../hooks/useShareRun';
import type { Race } from '../../data/rotterdamRaces';

export interface ShareCountdownSheetProps {
  visible: boolean;
  race: Race;
  shortName?: string;
  runnerName?: string;
  onClose: () => void;
}

// Schaal de card zodat hij past in de preview (gelijk aan ShareRunSheet)
const PREVIEW_SCALE = 0.72;
const PREVIEW_W = CARD_WIDTH  * PREVIEW_SCALE;
const PREVIEW_H = CARD_HEIGHT * PREVIEW_SCALE;

export function ShareCountdownSheet({
  visible,
  race,
  shortName,
  runnerName,
  onClose,
}: ShareCountdownSheetProps) {
  const { cardRef, isSharing, share, saveToLibrary, captureCard } = useShareRun({
    event: 'race_countdown_shared',
    eventProps: { raceId: race.id, distance: race.distance },
  });
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
      console.error('[ShareCountdownSheet] handleSave:', err);
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

        <Text style={styles.title}>Deel je countdown</Text>
        <Text style={styles.subtitle}>
          Laat je volgers weten waar je naartoe traint.
        </Text>

        {/* Zichtbare geschaalde preview */}
        <ScrollView
          horizontal
          contentContainerStyle={styles.previewScroll}
          showsHorizontalScrollIndicator={false}
        >
          <View style={[styles.previewWrapper, { width: PREVIEW_W, height: PREVIEW_H }]}>
            <View
              style={{
                width:     CARD_WIDTH,
                height:    CARD_HEIGHT,
                transform: [
                  { translateX: -(CARD_WIDTH  * (1 - PREVIEW_SCALE)) / 2 },
                  { translateY: -(CARD_HEIGHT * (1 - PREVIEW_SCALE)) / 2 },
                  { scale: PREVIEW_SCALE },
                ],
              }}
              pointerEvents="none"
            >
              <ShareCountdownCard race={race} shortName={shortName} runnerName={runnerName} />
            </View>
          </View>
        </ScrollView>

        {/* Onzichtbare full-res card voor de screenshot */}
        <View style={styles.offscreen} pointerEvents="none">
          <ShareCountdownCard ref={cardRef} race={race} shortName={shortName} runnerName={runnerName} />
        </View>

        {/* Knoppen */}
        <View style={styles.actions}>
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
