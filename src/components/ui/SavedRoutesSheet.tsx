/**
 * SavedRoutesSheet
 *
 * Bottom sheet om te kiezen uit bewaarde routes (zie saveRoute in appStore.ts).
 * Verschijnt vanuit de routevraag-kaart op het GPS-wachtscherm van een sessie.
 *
 * Een bewaarde route hangt aan een startlocatie: sta je ergens anders, dan is
 * de route niet meteen bruikbaar. Deze sheet toont dat eerlijk — dichtstbij
 * eerst, verweg-routes gedempt en apart — in plaats van een lijst te tonen
 * alsof elke route hier en nu te lopen is.
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { X, MapPin, Bookmark, Trash2 } from 'lucide-react-native';
import { typography, spacing, radius, shadows, type ThemeColors } from '../../theme/tokens';
import { useThemeColors } from '../../theme/useTheme';
import { useAppStore, selectSavedRoutes, type SavedRoute } from '../../store/appStore';
import { PREMIUM_CONFIG } from '../../config/premiumConfig';
import { usePremium } from '../../hooks/usePremium';
import { haversineMeters } from '../../services/routeService';

// ── Constanten ────────────────────────────────────────────────────────────────

/**
 * Binnen deze afstand van het startpunt tonen we "Start hier" in plaats van
 * een exact aantal meters. GPS-jitter alleen al kan een paar tientallen
 * meters schelen, dus een letterlijke 0 m eisen zou een prima bruikbare
 * route onterecht als "verderop" laten voelen.
 */
const NEARBY_M = 75;

/**
 * Vanaf deze afstand is het startpunt niet meer iets waar je "even snel"
 * naartoe loopt: de wandel/jog erheen zou de warming-up alleen al een
 * kwartier of meer maken, wat de opgeslagen afstand van de route zelf niet
 * meer klopt met wat je feitelijk gaat lopen. Boven deze grens blijft de
 * route gewoon aantikbaar (iemand mag zelf beslissen ernaartoe te lopen),
 * maar dan gedempt en onder een eigen kopje, zodat er geen vals gevoel van
 * "meteen bruikbaar" ontstaat.
 */
const FAR_THRESHOLD_M = 3000;

/** Meters afronden op een net getal, zodat de tekst niet "437 m" toont. */
const NEAR_ROUNDING_M = 50;

/**
 * Formatteert de afstand tot het startpunt van een route in begrijpelijke
 * taal. Nederlandse decimale komma vanaf een kilometer, zelfde stijl als
 * suggestRouteName in appStore.ts.
 */
function formatStartDistance(meters: number): string {
  if (meters < NEARBY_M) return 'Start hier';
  // Eerst afronden, dan pas kiezen tussen meters en kilometers. Andersom
  // levert 999 m de tekst "1000 m verderop" op: de grens wordt dan getoetst
  // op de onafgeronde waarde terwijl de afronding er net overheen tilt.
  const rounded = Math.round(meters / NEAR_ROUNDING_M) * NEAR_ROUNDING_M;
  if (rounded < 1000) {
    return `Start ${rounded} m verderop`;
  }
  const km = (rounded / 1000).toFixed(1).replace('.', ',');
  return `Start ${km} km verderop`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface SavedRoutesSheetProps {
  visible: boolean;
  /** Huidige positie, om te tonen hoe ver het startpunt van elke route is. Null als er nog geen GPS-fix is. */
  currentPosition: { lat: number; lon: number } | null;
  onSelect: (route: SavedRoute) => void;
  onClose: () => void;
}

interface RouteRow {
  route: SavedRoute;
  /** Afstand tot het startpunt in meters, of null zonder GPS-fix. */
  distanceM: number | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SavedRoutesSheet({ visible, currentPosition, onSelect, onClose }: SavedRoutesSheetProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const savedRoutes = useAppStore(selectSavedRoutes);
  const deleteSavedRoute = useAppStore(s => s.deleteSavedRoute);
  const { hasAccess } = usePremium();

  // Nabij (bovenaan, op afstand gesorteerd) versus ver weg (eigen, gedempt
  // kopje) — zie FAR_THRESHOLD_M hierboven. Zonder GPS-fix laten we de
  // volgorde van selectSavedRoutes staan (nieuwste eerst) en verzinnen we
  // geen afstanden.
  const { nearby, far } = useMemo(() => {
    const rows: RouteRow[] = savedRoutes.map(route => ({
      route,
      distanceM: currentPosition
        ? haversineMeters(currentPosition.lat, currentPosition.lon, route.startLat, route.startLon)
        : null,
    }));

    if (!currentPosition) {
      return { nearby: rows, far: [] as RouteRow[] };
    }

    const sorted = [...rows].sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));
    return {
      nearby: sorted.filter(r => (r.distanceM ?? 0) < FAR_THRESHOLD_M),
      far:    sorted.filter(r => (r.distanceM ?? 0) >= FAR_THRESHOLD_M),
    };
  }, [savedRoutes, currentPosition]);

  function handleDelete(route: SavedRoute) {
    Alert.alert(
      'Route verwijderen',
      `Weet je zeker dat je "${route.name}" wilt verwijderen? Dit kan niet ongedaan gemaakt worden.`,
      [
        { text: 'Annuleren', style: 'cancel' },
        { text: 'Verwijderen', style: 'destructive', onPress: () => deleteSavedRoute(route.id) },
      ],
    );
  }

  function renderRow({ route, distanceM }: RouteRow, muted: boolean) {
    const typeLabel = route.type === 'loop' ? 'Lus' : 'Heen-en-terug';
    const distanceLabel = distanceM != null ? formatStartDistance(distanceM) : null;
    return (
      <View key={route.id} style={styles.row}>
        <TouchableOpacity
          style={styles.rowMain}
          onPress={() => onSelect(route)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={[
            route.name,
            `${route.distanceKm.toFixed(1)} km`,
            typeLabel,
            distanceLabel,
          ].filter(Boolean).join(', ')}
        >
          <View style={[styles.rowIconBox, muted && styles.rowIconBoxMuted]}>
            <Bookmark size={16} color={muted ? colors.textTertiary : colors.brandPrimary} strokeWidth={2} />
          </View>
          <View style={styles.rowText}>
            <Text style={[styles.rowName, muted && styles.rowTextMuted]} numberOfLines={1}>
              {route.name}
            </Text>
            <Text style={[styles.rowMeta, muted && styles.rowTextMuted]} numberOfLines={1}>
              {route.distanceKm.toFixed(1)} km · {typeLabel}
              {distanceLabel ? ` · ${distanceLabel}` : ''}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(route)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Verwijder ${route.name}`}
        >
          <Trash2 size={16} color={colors.textTertiary} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    );
  }

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
        <View style={styles.sheetTop}>
          <View style={styles.handle} />
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Sluiten"
          >
            <X size={20} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Bewaarde routes</Text>
        {savedRoutes.length > 0 && (
          <Text style={styles.subtitle}>
            {savedRoutes.length} bewaarde {savedRoutes.length === 1 ? 'route' : 'routes'}
            {!hasAccess
              ? ` · nog ${Math.max(0, PREMIUM_CONFIG.FREE_SAVED_ROUTES - savedRoutes.length)} van ${PREMIUM_CONFIG.FREE_SAVED_ROUTES} gratis`
              : ''}
          </Text>
        )}

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {savedRoutes.length === 0 ? (
            <View style={styles.emptyCard}>
              <MapPin size={28} color={colors.textTertiary} strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>Nog geen bewaarde routes</Text>
              <Text style={styles.emptySub}>
                Plan een route en tik op "Bewaar deze route" om hem hier terug te
                vinden. Handig voor je vaste rondje, ook zonder internet.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.list}>
                {nearby.map(item => renderRow(item, false))}
              </View>

              {far.length > 0 && (
                <>
                  <Text style={styles.farHeading}>Verder weg</Text>
                  <View style={styles.list}>
                    {far.map(item => renderRow(item, true))}
                  </View>
                </>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: colors.bgSurface,
    borderTopLeftRadius:  radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    ...shadows.lg,
  },
  sheetTop: {
    alignItems: 'center',
    paddingTop: spacing[1],
    paddingHorizontal: spacing[2],
    flexDirection: 'row',
    justifyContent: 'center',
  },
  handle: {
    width: 40, height: 4,
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
    fontSize: typography.fontSize.xl,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing[1],
    paddingHorizontal: spacing[3],
  },
  subtitle: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 2,
  },
  scroll: {
    paddingHorizontal: spacing[3],
    paddingTop: spacing[2],
    paddingBottom: spacing[2],
    gap: spacing[2],
  },
  emptyCard: {
    alignItems: 'center', gap: spacing[1],
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderSubtle,
    padding: spacing[3],
  },
  emptyTitle: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.base,
    color: colors.textPrimary, textAlign: 'center', marginTop: spacing[1],
  },
  emptySub: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm,
    color: colors.textSecondary, textAlign: 'center',
    lineHeight: typography.fontSize.sm * typography.lineHeight.relaxed,
  },
  farHeading: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wider,
    marginTop: spacing[0.5],
    marginBottom: 2,
  },
  list: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
  },
  rowMain: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[1.5],
    paddingHorizontal: spacing[2], paddingVertical: spacing[1.5],
  },
  rowIconBox: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: `${colors.brandPrimary}18`,
    alignItems: 'center', justifyContent: 'center',
  },
  rowIconBoxMuted: {
    backgroundColor: colors.bgCardHover,
  },
  rowText: { flex: 1 },
  rowName: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  rowMeta: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs,
    color: colors.textTertiary, marginTop: 2,
  },
  rowTextMuted: {
    color: colors.textTertiary,
  },
  deleteBtn: {
    paddingHorizontal: spacing[2], paddingVertical: spacing[1.5],
  },
});
