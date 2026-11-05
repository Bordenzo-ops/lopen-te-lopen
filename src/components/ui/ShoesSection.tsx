/**
 * ShoesSection
 *
 * Blok "Mijn schoenen" in het Logboek (schoenenteller): per actieve schoen de
 * naam, de kilometers tegenover de slijtagegrens en een voortgangsbalk, een
 * knop om een paar toe te voegen en een ingeklapte lijst "Met pensioen".
 * Beheert zelf de toevoeg-/bewerksheet.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Plus, ChevronDown, ChevronRight, Footprints } from 'lucide-react-native';
import { typography, spacing, radius, type ThemeColors } from '../../theme/tokens';
import { useThemeColors } from '../../theme/useTheme';
import { useAppStore } from '../../store/appStore';
import type { Shoe } from '../../store/appStore';
import { Tappable } from '../motion/Tappable';
import { Button } from './Button';
import { ShoeEditorSheet } from './ShoeEditorSheet';
import { activeShoes, retiredShoes, shoeKm, wearPercent, WEAR_WARN_PCT } from '../../utils/shoes';
import { formatKm } from '../../utils/format';

export function ShoesSection() {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const shoes = useAppStore(s => s.shoes);
  const completedSessions = useAppStore(s => s.completedSessions);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Shoe | null>(null);
  const [showRetired, setShowRetired] = useState(false);

  const active = activeShoes(shoes);
  const retired = retiredShoes(shoes);

  const openAdd = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (shoe: Shoe) => { setEditing(shoe); setEditorOpen(true); };
  const closeEditor = () => { setEditorOpen(false); };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Mijn schoenen</Text>

      {shoes.length === 0 ? (
        <View style={styles.emptyState}>
          <Footprints size={28} color={colors.textTertiary} strokeWidth={1.5} />
          <Text style={styles.emptyText}>
            Houd bij hoeveel kilometer je schoenen lopen. Na 500 tot 800 km is de demping meestal op.
          </Text>
          <Button label="Schoen toevoegen" onPress={openAdd} size="sm" />
        </View>
      ) : (
        <>
          <View style={styles.list}>
            {active.map(shoe => (
              <ShoeRow key={shoe.id} shoe={shoe} km={shoeKm(shoe, completedSessions)} onPress={() => openEdit(shoe)} />
            ))}
          </View>

          <Button
            label="Schoen toevoegen"
            onPress={openAdd}
            variant="secondary"
            size="sm"
            icon={<Plus size={16} color={colors.textPrimary} strokeWidth={2.5} />}
          />

          {retired.length > 0 && (
            <View style={styles.retiredWrap}>
              <Tappable
                style={styles.retiredHeader}
                onPress={() => setShowRetired(v => !v)}
                haptic="select"
                accessibilityRole="button"
                accessibilityLabel={`Met pensioen, ${retired.length} paar`}
                accessibilityState={{ expanded: showRetired }}
              >
                <Text style={styles.retiredTitle}>Met pensioen ({retired.length})</Text>
                {showRetired
                  ? <ChevronDown size={18} color={colors.textTertiary} strokeWidth={2} />
                  : <ChevronRight size={18} color={colors.textTertiary} strokeWidth={2} />}
              </Tappable>
              {showRetired && (
                <View style={styles.list}>
                  {retired.map(shoe => (
                    <ShoeRow
                      key={shoe.id}
                      shoe={shoe}
                      km={shoeKm(shoe, completedSessions)}
                      onPress={() => openEdit(shoe)}
                      muted
                    />
                  ))}
                </View>
              )}
            </View>
          )}
        </>
      )}

      <ShoeEditorSheet visible={editorOpen} shoe={editing} onClose={closeEditor} />
    </View>
  );
}

function ShoeRow({
  shoe, km, onPress, muted = false,
}: { shoe: Shoe; km: number; onPress: () => void; muted?: boolean }) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const percent = wearPercent(km, shoe.limitKm);
  const fillPct = Math.max(0, Math.min(100, percent));
  const isWorn = !muted && percent >= WEAR_WARN_PCT;
  const kmText = `${formatKm(Math.round(km))} van ${formatKm(shoe.limitKm)} km`;

  return (
    <Tappable
      style={[styles.shoeRow, muted && styles.shoeRowMuted]}
      onPress={onPress}
      haptic="tap"
      accessibilityRole="button"
      accessibilityLabel={`${shoe.name}, ${kmText}${shoe.isDefault ? ', standaardschoen' : ''}. Tik om te bewerken.`}
    >
      <View style={styles.shoeHeader}>
        <Text style={styles.shoeName} numberOfLines={1}>{shoe.name}</Text>
        {shoe.isDefault && !muted && (
          <View style={styles.defaultPill}>
            <Text style={styles.defaultPillText}>Standaard</Text>
          </View>
        )}
      </View>
      <Text style={styles.shoeKm}>{kmText}</Text>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${fillPct}%`, backgroundColor: isWorn ? colors.warning : colors.brandPrimary },
          ]}
        />
      </View>
    </Tappable>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  section: { gap: spacing[1.5] },
  sectionTitle: {
    fontFamily: typography.fontFamily.display, fontSize: typography.fontSize.xl,
    color: colors.textPrimary, letterSpacing: typography.letterSpacing.tight,
  },
  list: { gap: spacing[1] },

  emptyState: {
    alignItems: 'center', gap: spacing[1], padding: spacing[3],
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  emptyText: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm,
    color: colors.textSecondary, textAlign: 'center',
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
  },

  shoeRow: {
    gap: 6, padding: spacing[2],
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  shoeRowMuted: { opacity: 0.75 },
  shoeHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  shoeName: {
    flexShrink: 1,
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  defaultPill: {
    paddingHorizontal: spacing[1], paddingVertical: 2, borderRadius: radius.full,
    backgroundColor: colors.brandPrimary + '22',
  },
  defaultPillText: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.xs,
    color: colors.brandLight,
  },
  shoeKm: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  barTrack: {
    height: 8, borderRadius: radius.full, backgroundColor: colors.bgSurface, overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: radius.full },

  retiredWrap: { gap: spacing[1] },
  retiredHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 44, paddingHorizontal: spacing[0.5],
  },
  retiredTitle: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
});
