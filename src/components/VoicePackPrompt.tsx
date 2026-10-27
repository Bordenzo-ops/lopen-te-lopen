/**
 * VoicePackPrompt
 *
 * Dashboardkaart die premium-gebruikers met gesproken begeleiding aan
 * wijst op het nog niet gedownloade natuurlijke stempakket. Toont zichzelf
 * alleen als: premium-toegang, voice guidance aan en pakket nog niet
 * lokaal beschikbaar. Zodra de download klaar is verdwijnt de kaart.
 *
 * Gebruikt dezelfde download als Instellingen (via useVoicePackDownload).
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { typography, spacing, radius, type ThemeColors } from '../theme/tokens';
import { useThemeColors } from '../theme/useTheme';
import { useAppStore } from '../store/appStore';
import { usePremium } from '../hooks/usePremium';
import { useVoicePackDownload } from '../hooks/useVoicePackDownload';
import { getRemotePackSizeLabel } from '../services/voicePackService';

export function VoicePackPrompt() {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { hasAccess } = usePremium();
  const voiceGuidance = useAppStore(s => s.profile?.voiceGuidance ?? false);
  const voiceType = useAppStore(s => s.profile?.voiceType ?? 'female');
  const { available, busy, progressPct, error, start } = useVoicePackDownload(voiceType);

  if (!hasAccess || !voiceGuidance || available) return null;

  return (
    <Card variant="surface" padding="lg" style={styles.card}>
      <Text style={styles.title} accessibilityRole="header">
        Je natuurlijke coachstem staat klaar om te downloaden
      </Text>
      <Text style={styles.body}>
        Download de stem ({getRemotePackSizeLabel()}) en hoor je coach ook offline, zonder haperingen.
        Op wifi gaat het het snelst.
      </Text>

      {busy && (
        <View style={styles.progressWrap}>
          <View
            style={styles.progressTrack}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: progressPct ?? 0 }}
          >
            <View style={[styles.progressFill, { width: `${progressPct ?? 0}%` }]} />
          </View>
          <Text style={styles.progressText}>Downloaden… {progressPct ?? 0}%</Text>
        </View>
      )}

      {error && !busy && <Text style={styles.error}>{error}</Text>}

      {!busy && (
        <Button
          label={error ? 'Opnieuw proberen' : 'Nu downloaden'}
          onPress={start}
          size="sm"
          fullWidth
        />
      )}
    </Card>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  card: { gap: spacing[1.5] },
  title: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  body: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  progressWrap: { gap: spacing[0.5] },
  progressTrack: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.bgCard,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.brandPrimary,
  },
  progressText: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  error: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.sm,
    color: colors.error,
  },
});
