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

import React, { useCallback } from 'react';
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
import { colors, palette, typography, spacing, radius, shadows } from '../../theme/tokens';
import { ShareRunCard, CARD_WIDTH, CARD_HEIGHT } from './ShareRunCard';
import { useShareRun } from '../../hooks/useShareRun';
import type { CompletedSession } from '../../store/appStore';

interface ShareRunSheetProps {
  visible: boolean;
  session: CompletedSession;
  weekNumber: number;
  runnerName?: string;
  maxHeartRate?: number;
  totalWeeks?: number;
  onClose: () => void;
}

// Schaal de card zodat hij past in de preview (max 80% van de schermbreedte)
const PREVIEW_SCALE = 0.72;
const PREVIEW_W = CARD_WIDTH  * PREVIEW_SCALE;
const PREVIEW_H = CARD_HEIGHT * PREVIEW_SCALE;

export function ShareRunSheet({
  visible,
  session,
  weekNumber,
  runnerName,
  maxHeartRate,
  totalWeeks,
  onClose,
}: ShareRunSheetProps) {
  const { cardRef, isSharing, share, saveToLibrary, captureCard } = useShareRun();

  const handleInstagram = useCallback(async () => {
    const result = await share();
    if (result.success && result.method !== 'saved') {
      onClose();
    }
  }, [share, onClose]);

  const handleSave = useCallback(async () => {
    const uri = await captureCard();
    if (uri) {
      await saveToLibrary(uri);
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

        <Text style={styles.title}>Deel je run</Text>
        <Text style={styles.subtitle}>
          Klaar voor de 'gram? Jouw stats in één oogopslag.
        </Text>

        {/* Card preview — hier wordt de echte card gerenderd (buiten beeld) */}
        <ScrollView
          horizontal
          contentContainerStyle={styles.previewScroll}
          showsHorizontalScrollIndicator={false}
        >
          {/* Zichtbare geschaalde preview */}
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
              <ShareRunCard
                session={session}
                weekNumber={weekNumber}
                runnerName={runnerName}
                maxHeartRate={maxHeartRate}
                totalWeeks={totalWeeks}
              />
            </View>
          </View>
        </ScrollView>

        {/* Onzichtbare full-res card voor de screenshot */}
        <View style={styles.offscreen} pointerEvents="none">
          <ShareRunCard
            ref={cardRef}
            session={session}
            weekNumber={weekNumber}
            runnerName={runnerName}
            maxHeartRate={maxHeartRate}
            totalWeeks={totalWeeks}
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

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
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
