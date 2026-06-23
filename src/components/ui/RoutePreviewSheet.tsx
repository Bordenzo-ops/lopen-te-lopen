/**
 * RoutePreviewSheet
 *
 * Bottom-sheet die getoond wordt vóór het starten van een sessie.
 * Laat de gebruiker kiezen tussen een lus of heen-en-terug route,
 * toont een kaartpreview en stuurt de keuze terug via callbacks.
 *
 * Gebruik:
 *   <RoutePreviewSheet
 *     visible={showPreview}
 *     plannedRoute={planner.route}
 *     routeType={planner.routeType}
 *     isLoading={planner.isLoading}
 *     error={planner.error}
 *     targetDistanceKm={session.distanceKm}
 *     onSelectType={planner.setRouteType}
 *     onReplan={handleReplan}
 *     onStartWithRoute={handleStartWithRoute}
 *     onStartWithoutRoute={handleStartWithoutRoute}
 *     onClose={() => setShowPreview(false)}
 *   />
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import MapView, {
  Polyline,
  Marker,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
} from 'react-native-maps';
import { X, RefreshCw, Navigation, ArrowRight, MapPin } from 'lucide-react-native';
import { typography, spacing, radius, shadows, type ThemeColors } from '../../theme/tokens';
import { useThemeColors, useIsLightTheme } from '../../theme/useTheme';
import { PremiumBadge } from './PremiumBadge';
import type { PlannedRoute } from '../../services/routeService';
import type { RouteType } from '../../hooks/useRoutePlanner';

// ── Props ─────────────────────────────────────────────────────────────────────

interface RoutePreviewSheetProps {
  visible:             boolean;
  plannedRoute:        PlannedRoute | null;
  routeType:           RouteType;
  isLoading:           boolean;
  error:               string | null;
  targetDistanceKm:    number;
  onSelectType:        (type: RouteType) => void;
  onReplan:            () => void;
  onStartWithRoute:    () => void;
  onStartWithoutRoute: () => void;
  onClose:             () => void;
}

// ── Kaart-helpers ─────────────────────────────────────────────────────────────

/** Berekent het middelpunt van alle waypoints voor de initiële kaartregio */
function routeCenter(route: PlannedRoute) {
  const lats = route.waypoints.map(w => w.lat);
  const lons = route.waypoints.map(w => w.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  return {
    latitude:      (minLat + maxLat) / 2,
    longitude:     (minLon + maxLon) / 2,
    latitudeDelta:  Math.max((maxLat - minLat) * 1.4, 0.008),
    longitudeDelta: Math.max((maxLon - minLon) * 1.4, 0.008),
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RoutePreviewSheet({
  visible,
  plannedRoute,
  routeType,
  isLoading,
  error,
  targetDistanceKm,
  onSelectType,
  onReplan,
  onStartWithRoute,
  onStartWithoutRoute,
  onClose,
}: RoutePreviewSheetProps) {
  const colors = useThemeColors();
  const isLight = useIsLightTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const mapCoords = plannedRoute?.waypoints.map(wp => ({
    latitude:  wp.lat,
    longitude: wp.lon,
  })) ?? [];

  const estimatedMinutes = plannedRoute
    ? Math.round((plannedRoute.totalDistanceKm / 9) * 60)
    : Math.round((targetDistanceKm / 9) * 60);

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

        {/* Titel */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>Routeplanner</Text>
          <PremiumBadge />
        </View>
        <Text style={styles.subtitle}>
          Kies een routetype voor {targetDistanceKm} km
        </Text>

        {/* Type-knoppen */}
        <View style={styles.typeRow}>
          {(['loop', 'outAndBack'] as RouteType[]).map(type => (
            <TouchableOpacity
              key={type}
              style={[styles.typeBtn, routeType === type && styles.typeBtnActive]}
              onPress={() => onSelectType(type)}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.typeBtnText,
                routeType === type && styles.typeBtnTextActive,
              ]}>
                {type === 'loop' ? '🔄  Lus' : '↔️  Heen-en-terug'}
              </Text>
              <Text style={[
                styles.typeBtnSub,
                routeType === type && styles.typeBtnSubActive,
              ]}>
                {type === 'loop'
                  ? 'Route terug naar startpunt'
                  : 'Halverwege omdraaien'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Kaart / laad / fout */}
        <View style={styles.mapBox}>
          {isLoading ? (
            <View style={styles.mapCenter}>
              <ActivityIndicator color={colors.brandPrimary} size="large" />
              <Text style={styles.loadingText}>Route berekenen...</Text>
            </View>
          ) : error ? (
            <View style={styles.mapCenter}>
              <MapPin size={32} color={colors.error} strokeWidth={1.5} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={onReplan}>
                <RefreshCw size={13} color={colors.brandPrimary} strokeWidth={2} />
                <Text style={styles.retryText}>Opnieuw proberen</Text>
              </TouchableOpacity>
            </View>
          ) : plannedRoute ? (
            <>
              <MapView
                style={styles.map}
                provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
                region={routeCenter(plannedRoute)}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
                showsUserLocation={false}
                showsCompass={false}
                userInterfaceStyle={isLight ? 'light' : 'dark'}
              >
                <Polyline
                  coordinates={mapCoords}
                  strokeColor={colors.brandPrimary}
                  strokeWidth={4}
                  lineJoin="round"
                />
                {/* Start/eindpunt */}
                {mapCoords.length > 0 && (
                  <Marker coordinate={mapCoords[0]} anchor={{ x: 0.5, y: 0.5 }}>
                    <View style={styles.startMarker}>
                      <View style={styles.startDot} />
                    </View>
                  </Marker>
                )}
              </MapView>

              {/* Herplan-knop */}
              <TouchableOpacity style={styles.replanBtn} onPress={onReplan} activeOpacity={0.8}>
                <RefreshCw size={12} color={colors.textSecondary} strokeWidth={2} />
                <Text style={styles.replanText}>Andere route</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.mapCenter}>
              <Navigation size={32} color={colors.textTertiary} strokeWidth={1.5} />
              <Text style={styles.placeholderText}>
                Route wordt berekend zodra{'\n'}GPS-signaal beschikbaar is
              </Text>
            </View>
          )}
        </View>

        {/* Route-samenvatting */}
        {plannedRoute && (
          <View style={styles.summary}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Afstand</Text>
              <Text style={styles.summaryValue}>{plannedRoute.totalDistanceKm.toFixed(1)} km</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Schatting</Text>
              <Text style={styles.summaryValue}>~{estimatedMinutes} min</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Type</Text>
              <Text style={styles.summaryValue}>
                {plannedRoute.type === 'loop' ? 'Lus' : 'Heen-terug'}
              </Text>
            </View>
          </View>
        )}

        {/* Actie-knoppen */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              (!plannedRoute || isLoading) && styles.primaryBtnDisabled,
            ]}
            onPress={onStartWithRoute}
            disabled={!plannedRoute || isLoading}
            activeOpacity={0.8}
          >
            <Navigation size={18} color="#fff" strokeWidth={2} />
            <Text style={styles.primaryBtnText}>Start met route</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={onStartWithoutRoute}
            activeOpacity={0.8}
          >
            <ArrowRight size={16} color={colors.textSecondary} strokeWidth={2} />
            <Text style={styles.secondaryBtnText}>Start zonder route</Text>
          </TouchableOpacity>
        </View>
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
    position:             'absolute',
    bottom:                0,
    left:                  0,
    right:                 0,
    backgroundColor:      colors.bgSurface,
    borderTopLeftRadius:  radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingBottom:        Platform.OS === 'ios' ? 34 : 24,
    ...shadows.lg,
  },

  sheetHeader: {
    alignItems:        'center',
    paddingTop:         spacing[1],
    paddingHorizontal:  spacing[2],
    flexDirection:     'row',
    justifyContent:    'center',
  },
  handle: {
    width:           40,
    height:           4,
    backgroundColor: colors.borderDefault,
    borderRadius:    radius.full,
  },
  closeBtn: {
    position: 'absolute',
    right:     spacing[2],
    top:       spacing[1],
    padding:   4,
  },

  titleRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:             spacing[1],
    marginTop:      spacing[1],
  },
  title: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize:   typography.fontSize.xl,
    color:      colors.textPrimary,
  },
  subtitle: {
    fontFamily: typography.fontFamily.sans,
    fontSize:   typography.fontSize.sm,
    color:      colors.textSecondary,
    textAlign:  'center',
    marginTop:   4,
    marginBottom: spacing[2],
  },

  typeRow: {
    flexDirection:    'row',
    marginHorizontal: spacing[3],
    gap:               spacing[1],
    marginBottom:     spacing[2],
  },
  typeBtn: {
    flex:            1,
    paddingVertical: spacing[1.5],
    paddingHorizontal: spacing[1],
    borderRadius:    radius.xl,
    borderWidth:      1,
    borderColor:     colors.borderDefault,
    alignItems:      'center',
    backgroundColor: colors.bgCard,
    gap:              3,
  },
  typeBtnActive: {
    borderColor:     colors.brandPrimary,
    backgroundColor: `${colors.brandPrimary}18`,
  },
  typeBtnText: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize:   typography.fontSize.sm,
    color:      colors.textSecondary,
  },
  typeBtnTextActive: {
    color: colors.brandPrimary,
  },
  typeBtnSub: {
    fontFamily: typography.fontFamily.sans,
    fontSize:   typography.fontSize.xs,
    color:      colors.textTertiary,
  },
  typeBtnSubActive: {
    color: `${colors.brandPrimary}BB`,
  },

  mapBox: {
    marginHorizontal: spacing[3],
    height:            200,
    borderRadius:     radius.xl,
    overflow:         'hidden',
    borderWidth:       1,
    borderColor:      colors.borderSubtle,
    marginBottom:     spacing[2],
  },
  map: { flex: 1 },
  mapCenter: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
    gap:             spacing[1],
    padding:         spacing[2],
  },
  loadingText: {
    fontFamily: typography.fontFamily.sans,
    fontSize:   typography.fontSize.sm,
    color:      colors.textSecondary,
  },
  errorText: {
    fontFamily: typography.fontFamily.sans,
    fontSize:   typography.fontSize.sm,
    color:      colors.error,
    textAlign:  'center',
  },
  retryBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:             6,
    paddingHorizontal: spacing[2],
    paddingVertical:   spacing[1],
    borderRadius:   radius.full,
    borderWidth:     1,
    borderColor:    `${colors.brandPrimary}55`,
    marginTop:      spacing[0.5],
  },
  retryText: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize:   typography.fontSize.sm,
    color:      colors.brandPrimary,
  },
  placeholderText: {
    fontFamily: typography.fontFamily.sans,
    fontSize:   typography.fontSize.sm,
    color:      colors.textTertiary,
    textAlign:  'center',
  },
  replanBtn: {
    position:         'absolute',
    top:               spacing[1],
    right:             spacing[1],
    flexDirection:    'row',
    alignItems:       'center',
    gap:               4,
    backgroundColor:  `${colors.bgCard}EE`,
    paddingHorizontal: spacing[1],
    paddingVertical:   5,
    borderRadius:     radius.lg,
    borderWidth:       1,
    borderColor:      colors.borderSubtle,
  },
  replanText: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize:   typography.fontSize.xs,
    color:      colors.textSecondary,
  },
  startMarker: {
    width:           14,
    height:          14,
    borderRadius:     7,
    borderWidth:       2,
    borderColor:     colors.brandPrimary,
    backgroundColor: colors.bgBase,
    alignItems:      'center',
    justifyContent:  'center',
  },
  startDot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: colors.brandPrimary,
  },

  summary: {
    flexDirection:    'row',
    marginHorizontal: spacing[3],
    backgroundColor:  colors.bgCard,
    borderRadius:     radius.xl,
    borderWidth:       1,
    borderColor:      colors.borderSubtle,
    marginBottom:     spacing[2],
  },
  summaryItem: {
    flex:           1,
    alignItems:     'center',
    paddingVertical: spacing[1.5],
    gap:             3,
  },
  summaryDivider: {
    width:           1,
    backgroundColor: colors.borderSubtle,
    marginVertical:  spacing[1],
  },
  summaryLabel: {
    fontFamily:    typography.fontFamily.sans,
    fontSize:      typography.fontSize.xs,
    color:         colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wider,
  },
  summaryValue: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize:   typography.fontSize.base,
    color:      colors.brandPrimary,
  },

  actions: {
    paddingHorizontal: spacing[3],
    gap:               spacing[1],
  },
  primaryBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:             spacing[1],
    backgroundColor: colors.brandPrimary,
    borderRadius:   radius.xl,
    paddingVertical: spacing[1.5],
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize:   typography.fontSize.base,
    color:      '#fff',
  },
  secondaryBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:             6,
    paddingVertical: spacing[1.5],
    borderRadius:   radius.xl,
    borderWidth:     1,
    borderColor:    colors.borderDefault,
  },
  secondaryBtnText: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize:   typography.fontSize.sm,
    color:      colors.textSecondary,
  },
});
