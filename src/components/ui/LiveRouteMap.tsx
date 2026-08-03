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

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
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
import { typography, spacing, radius, shadows, type ThemeColors } from '../../theme/tokens';
import { useThemeColors, useIsLightTheme } from '../../theme/useTheme';
import type { PlannedRoute } from '../../services/routeService';

// ── Constanten ────────────────────────────────────────────────────────────────

const MAP_H_COMPACT  = 160;
const MAP_H_EXPANDED = 320;

// Straal van de aarde in meters (voor de haversineformule hieronder).
const EARTH_RADIUS_M = 6371000;

// Volgmodus: hoe ver terug in de afgelegde route kijken we om de looprichting
// te bepalen? Te kort en GPS-ruis (een paar meter afwijking per fix)
// domineert de uitkomst; te lang en bochten worden traag opgemerkt. 25 m is
// op hardlooptempo (~3-4 m/s) zo'n 7-8 seconden geleden — een goede
// middenweg. We gebruiken bewust de bewegingsrichting over deze afstand en
// NIET het kompas/de magnetometer: die slingert enorm mee met een telefoon
// in een zwaaiende hand of armband, terwijl de looprichting over enkele
// tientallen meters juist heel stabiel is.
const BEARING_LOOKBACK_METERS = 25;
// Onder deze afstand tussen ankerpunt en huidige positie is de peiling
// onbetrouwbaar (een GPS-sprongetje van een paar meter kan dan een compleet
// andere hoek opleveren) — dan houden we de laatst bekende koers aan in
// plaats van terug te springen naar het noorden.
const BEARING_MIN_DISTANCE_METERS = 8;
// Dempingsfactor voor de getoonde koers: bij elke update schuift de
// weergegeven hoek deze fractie op richting de nieuw gemeten hoek. Laag
// genoeg om schokkerig draaien te voorkomen, hoog genoeg om een bocht binnen
// enkele seconden te volgen.
const HEADING_SMOOTHING_FACTOR = 0.25;
// Drempels om de camera niet vaker te animeren dan nodig — anders animeert
// elke GPS-fix opnieuw, wat onrustig oogt.
const CAMERA_UPDATE_MIN_HEADING_DELTA_DEG = 3;
const CAMERA_UPDATE_MIN_DISTANCE_METERS   = 2;
const CAMERA_ANIMATE_DURATION_MS          = 500;
// Zoomniveau in volgmodus — komt ruwweg overeen met de vroegere vaste
// latitudeDelta van 0.008 (straatniveau, genoeg detail om je route te
// herkennen zonder voortdurend te hoeven scrollen).
const FOLLOW_ZOOM = 17;

// ── Navigatiewiskunde ─────────────────────────────────────────────────────────
// Kleine, afhankelijkheidsvrije helpers voor afstand en peiling. Bewust geen
// nieuwe package: react-native-maps biedt dit zelf niet aan.

type RoutePoint = { lat: number; lon: number };

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Afstand tussen twee punten in meters (haversineformule). */
function distanceMeters(a: RoutePoint, b: RoutePoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Peiling (bearing) van punt a naar punt b, in graden, 0-360 met 0 = noord. */
function bearingDegrees(a: RoutePoint, b: RoutePoint): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLon = toRad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Kortste hoekverschil van `from` naar `to`, in het bereik (-180, 180].
 * Voorkomt dat een naïeve interpolatie bij bv. 350° → 10° de lange weg om
 * gaat (via 180°) in plaats van de korte weg (via 0°).
 */
function shortestAngleDeltaDeg(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

/**
 * Bepaalt de looprichting uit de laatste stukken van de afgelegde route:
 * zoekt terug tot ~BEARING_LOOKBACK_METERS is afgelegd en peilt van dat
 * ankerpunt naar de huidige positie. Geeft `null` terug als er te weinig
 * punten zijn of te weinig is bewogen (bv. stilstand bij een stoplicht) —
 * de aanroeper behoudt dan zelf de laatst bekende richting.
 */
function computeBearingFromRoute(route: RoutePoint[], current: RoutePoint): number | null {
  if (route.length === 0) return null;

  let anchor = route[route.length - 1];
  let accumulated = distanceMeters(anchor, current);
  for (let i = route.length - 2; i >= 0 && accumulated < BEARING_LOOKBACK_METERS; i--) {
    accumulated += distanceMeters(route[i + 1], route[i]);
    anchor = route[i];
  }

  if (distanceMeters(anchor, current) < BEARING_MIN_DISTANCE_METERS) {
    return null;
  }

  return bearingDegrees(anchor, current);
}

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
  const [followMode, setFollowMode] = useState(true);
  const mapRef = useRef<MapView>(null);
  const colors = useThemeColors();
  const isLight = useIsLightTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Laatst bekende (gedempte) koers in graden. Blijft staan zolang de
  // volgmodus uit is of er even geen betrouwbare meting is, zodat de kaart
  // niet terugklapt naar het noorden.
  const headingRef = useRef(0);
  const hasHeadingRef = useRef(false);
  // Laatste camera-aanroep, om te bepalen of een nieuwe animatie nodig is.
  const lastCameraRef = useRef<{ lat: number; lon: number; heading: number } | null>(null);

  const plannedCoords = plannedRoute.waypoints.map(wp => ({
    latitude:  wp.lat,
    longitude: wp.lon,
  }));

  const coveredCoords = coveredRoute.map(p => ({
    latitude:  p.lat,
    longitude: p.lon,
  }));

  const applyCamera = useCallback(
    (lat: number, lon: number, heading: number, duration = CAMERA_ANIMATE_DURATION_MS) => {
      mapRef.current?.animateCamera(
        { center: { latitude: lat, longitude: lon }, heading, pitch: 0, zoom: FOLLOW_ZOOM },
        { duration },
      );
      lastCameraRef.current = { lat, lon, heading };
    },
    [],
  );

  // Volgmodus-knop: zet volgmodus weer aan en centreert meteen op de
  // huidige positie en laatst bekende koers.
  const handleFollowPress = useCallback(() => {
    setFollowMode(true);
    applyCamera(currentLat, currentLon, headingRef.current, 300);
  }, [applyCamera, currentLat, currentLon]);

  // Zodra de gebruiker zelf sleept of zoomt (alleen mogelijk als de kaart
  // uitgeklapt is), gaat de volgmodus uit zodat hij rustig kan rondkijken.
  // De kaartrotatie blijft daarbij gewoon op de laatste stand staan.
  const handleUserGesture = useCallback(() => {
    if (!expanded) return; // ingeklapt kan niet gesleept/gezoomd worden
    setFollowMode(false);
  }, [expanded]);

  // Houdt de gedempte looprichting bij en volgt de gebruiker met de camera
  // zolang volgmodus aan staat. Draait mee op elke nieuwe positie/routepunt.
  useEffect(() => {
    const current: RoutePoint = { lat: currentLat, lon: currentLon };
    const measuredBearing = computeBearingFromRoute(coveredRoute, current);

    if (measuredBearing !== null) {
      if (!hasHeadingRef.current) {
        // Eerste geldige meting: direct op de gemeten koers starten, geen sprong vanaf 0.
        headingRef.current = measuredBearing;
        hasHeadingRef.current = true;
      } else {
        const delta = shortestAngleDeltaDeg(headingRef.current, measuredBearing);
        headingRef.current = (headingRef.current + delta * HEADING_SMOOTHING_FACTOR + 360) % 360;
      }
    }
    // Bij stilstand of te weinig routepunten (measuredBearing === null)
    // laten we headingRef bewust ongewijzigd.

    if (!followMode) return;

    const last = lastCameraRef.current;
    const headingChanged =
      !last || Math.abs(shortestAngleDeltaDeg(last.heading, headingRef.current)) >= CAMERA_UPDATE_MIN_HEADING_DELTA_DEG;
    const movedEnough =
      !last || distanceMeters({ lat: last.lat, lon: last.lon }, current) >= CAMERA_UPDATE_MIN_DISTANCE_METERS;

    if (headingChanged || movedEnough) {
      applyCamera(currentLat, currentLon, headingRef.current);
    }
  }, [currentLat, currentLon, coveredRoute, followMode, applyCamera]);

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
        userInterfaceStyle={isLight ? 'light' : 'dark'}
        onPanDrag={handleUserGesture}
        onRegionChangeStart={(_region, details) => {
          if (details?.isGesture) handleUserGesture();
        }}
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
        <TouchableOpacity
          style={styles.mapBtn}
          onPress={handleFollowPress}
          activeOpacity={0.8}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Zet volgmodus aan en centreer op mijn positie"
        >
          <Navigation
            size={13}
            color={followMode ? accentColor : colors.textPrimary}
            strokeWidth={2}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.mapBtn}
          onPress={() => setExpanded(e => !e)}
          activeOpacity={0.8}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Kaart inklappen' : 'Kaart uitklappen'}
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

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
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
