/**
 * LiveRouteMap
 *
 * Compacte kaart die tijdens een actieve sessie de geplande route
 * en de huidige positie toont.
 *
 * - Geplande route: stippellijn in accentkleur
 * - Al gelopen stuk: volle lijn
 * - Huidige positie: geanimeerde stip
 * - Uitklapbaar via de pijlknop
 *
 * Vereiste native configuratie:
 *   Android → voeg je Google Maps API-sleutel toe in app.json:
 *     android.config.googleMaps.apiKey = "YOUR_KEY"
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import MapView, {
  Polyline,
  Marker,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
} from 'react-native-maps';
import { ChevronUp, ChevronDown, Navigation } from 'lucide-react-native';
import { colors, typography, spacing, radius, shadows } from '../../theme/tokens';
import type { PlannedRoute } from '../../services/routeService';

// ── Constanten ────────────────────────────────────────────────────────────────

const MAP_H_COMPACT  = 160;
const MAP_H_EXPANDED = 320;

// ── Props ─────────────────────────────────────────────────────────────────────

interface LiveRouteMapProps {
  plannedRoute:  PlannedRoute;
  currentLat:    number;
  currentLon:    number;
  coveredRoute:  Array<{ lat: number; lon: number; timestamp: number }>;
  accentColor:   string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LiveRouteMap({
  plannedRoute,
  currentLat,
  currentLon,
  coveredRoute,
  accentColor,
}: LiveRouteMapProps) {
  const [expanded, setExpanded] = useState(false);
  const mapRef = useRef<MapView>(null);

  const plannedCoords = plannedRoute.waypoints.map(wp => ({
    latitude:  wp.lat,
    longitude: wp.lon,
  }));

  const coveredCoords = coveredRoute.map(p => ({
    latitude:  p.lat,
    longitude: p.lon,
  }));

  const centerOnUser = useCallback(() => {
    mapRef.current?.animateToRegion(
      {
        latitude:      currentLat,
        longitude:     currentLon,
        latitudeDelta:  0.008,
        longitudeDelta: 0.008,
      },
      300,
    );
  }, [currentLat, currentLon]);

  return (
    <View style={[styles.container, expanded && styles.containerExpanded]}>
      <MapView
        ref={mapRef}
        style={[styles.map, { height: expanded ? MAP_H_EXPANDED : MAP_H_COMPACT }]}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        initialRegion={{
          latitude:      currentLat,
          longitude:     currentLon,
          latitudeDelta:  0.012,
          longitudeDelta: 0.012,
        }}
        showsUserLocation={false}
        showsCompass={false}
        showsScale={false}
        scrollEnabled={expanded}
        zoomEnabled={expanded}
        rotateEnabled={false}
        pitchEnabled={false}
        userInterfaceStyle="dark"
      >
        {/* Geplande route — subtiele stippellijn */}
        <Polyline
          coordinates={plannedCoords}
          strokeColor={`${accentColor}55`}
          strokeWidth={3}
          lineDashPattern={[8, 5]}
        />

        {/* Al gelopen stuk — volle lijn */}
        {coveredCoords.length > 1 && (
          <Polyline
            coordinates={coveredCoords}
            strokeColor={accentColor}
            strokeWidth={5}
            lineJoin="round"
          />
        )}

        {/* Startpunt marker */}
        {plannedCoords.length > 0 && (
          <Marker
            coordinate={plannedCoords[0]}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[styles.startMarker, { borderColor: accentColor }]}>
              <View style={[styles.startDot, { backgroundColor: accentColor }]} />
            </View>
          </Marker>
        )}

        {/* Huidige positie */}
        <Marker
          coordinate={{ latitude: currentLat, longitude: currentLon }}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={[styles.posOuter, { borderColor: accentColor }]}>
            <View style={[styles.posInner, { backgroundColor: accentColor }]} />
          </View>
        </Marker>
      </MapView>

      {/* Kaart-knoppen (rechtsboven) */}
      <View style={styles.mapBtns}>
        <TouchableOpacity style={styles.mapBtn} onPress={centerOnUser} activeOpacity={0.8}>
          <Navigation size={13} color={colors.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.mapBtn}
          onPress={() => setExpanded(e => !e)}
          activeOpacity={0.8}
        >
          {expanded
            ? <ChevronDown size={13} color={colors.textPrimary} strokeWidth={2} />
            : <ChevronUp   size={13} color={colors.textPrimary} strokeWidth={2} />
          }
        </TouchableOpacity>
      </View>

      {/* Info-strip onderaan */}
      <View style={styles.infoStrip}>
        <Text style={styles.infoText}>
          {plannedRoute.type === 'loop' ? '🔄 Lus' : '↔️ Heen-en-terug'}
          {'  ·  '}
          {plannedRoute.totalDistanceKm.toFixed(1)} km gepland
        </Text>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing[3],
    marginBottom:     spacing[2],
    borderRadius:     radius.xl,
    overflow:         'hidden',
    borderWidth:       1,
    borderColor:      colors.borderSubtle,
    ...shadows.sm,
  },
  containerExpanded: {},

  map: {
    width: '100%',
  },

  mapBtns: {
    position:  'absolute',
    top:        spacing[1],
    right:      spacing[1],
    gap:         6,
  },
  mapBtn: {
    width:           30,
    height:          30,
    borderRadius:     8,
    backgroundColor: `${colors.bgCard}DD`,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:      1,
    borderColor:     colors.borderSubtle,
  },

  startMarker: {
    width:           14,
    height:          14,
    borderRadius:     7,
    borderWidth:       2,
    backgroundColor: colors.bgBase,
    alignItems:      'center',
    justifyContent:  'center',
  },
  startDot: {
    width:        6,
    height:       6,
    borderRadius: 3,
  },

  posOuter: {
    width:           18,
    height:          18,
    borderRadius:     9,
    borderWidth:       2,
    backgroundColor: `${colors.bgBase}CC`,
    alignItems:      'center',
    justifyContent:  'center',
  },
  posInner: {
    width:        8,
    height:       8,
    borderRadius: 4,
  },

  infoStrip: {
    backgroundColor: colors.bgCard,
    paddingVertical:   5,
    paddingHorizontal: spacing[1],
    alignItems:       'center',
  },
  infoText: {
    fontFamily:    typography.fontFamily.sansMedium,
    fontSize:      typography.fontSize.xs,
    color:         colors.textSecondary,
    letterSpacing: typography.letterSpacing.wide,
  },
});
