/**
 * RunDetailSheet
 *
 * Bottom sheet die de volledige statistieken van één gelopen sessie toont,
 * vanuit het logboek. Vóór deze component was die informatie (tijd, tempo,
 * hartslagzone, km-splits, route) alleen te zien vlak ná het lopen op
 * session/summary.tsx, of indirect via de deelkaart. Gebruikers gaven aan dat
 * ze die details ook later, uit het logboek, willen terugvinden.
 *
 * Bewust GEEN hergebruik van session/summary.tsx: dat scherm heeft
 * neveneffecten die alleen kloppen vlak na het afronden van een run (review-
 * prompt, PR-haptics op de laatst voltooide sessie, premium-upsell). Die
 * mogen nooit afgaan bij het terugkijken op een oude run. Wel is de opmaak
 * (grote afstand, statsgrid, splits-lijst met balkjes) hier bewust gelijk
 * gehouden aan dat scherm, zodat een run er overal in de app hetzelfde uitziet.
 *
 * Achterwaartse compatibiliteit is de kern van dit scherm: oudere runs missen
 * splits/route/maxHeartRateBpm, en geïmporteerde runs (Strava/Health) missen
 * vrijwel alles behalve afstand, tijd en tempo. Elk blok hieronder valt dus
 * gewoon weg als de data ontbreekt — nooit een leeg kader of een "0"/"—".
 *
 * Gebruik:
 *   {runToDetail && (
 *     <RunDetailSheet
 *       visible={!!runToDetail}
 *       session={runToDetail}
 *       onClose={() => setRunToDetail(null)}
 *     />
 *   )}
 */

import React, { useMemo, useState } from 'react';
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
import Svg, { Path, Circle } from 'react-native-svg';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Share2, FileDown, Zap } from 'lucide-react-native';
import { typography, spacing, radius, shadows, type ThemeColors } from '../../theme/tokens';
import { useThemeColors } from '../../theme/useTheme';
import { useAppStore } from '../../store/appStore';
import type { CompletedSession } from '../../store/appStore';
import type { HeartRateZone } from '../../data/trainingPlans';
import { resolveActivePlan } from '../../data/activePlan';
import { formatPacePerKm, formatDuration } from '../../data/paceModel';
import { exportSessionAsGpx } from '../../services/exportService';
import { SheetHandle, SheetCloseButton } from './sheetParts';
import { ZoneBadge } from './ZoneBadge';
import { ShareRunSheet } from './ShareRunSheet';

/**
 * Bronlabel per import-kanaal. Hier gedefinieerd (in plaats van in
 * logbook.tsx) omdat deze sheet 'm ook nodig heeft; logbook.tsx importeert
 * 'm vandaan om dubbele definities te voorkomen.
 */
export const sourceLabel: Record<CompletedSession['source'], string> = {
  app:           'App',
  strava:        'Strava',
  garmin:        'Garmin',
  apple_health:  'Apple Health',
  google_fit:    'Google Fit',
  mi_fitness:    'Mi Fitness',
};

// ── Routetracé ──────────────────────────────────────────────────────────────
// Vaste tekencoördinaten (viewBox) met een SVG die zelf 100% breed rekt: zo
// blijft de tekening scherp en responsive zonder Dimensions/metingen nodig te
// hebben. Zelfde aanpak als de routetekening in ShareRunCard.tsx, maar
// bewust een eigen (kleinere, kaartloze) kopie: dat bestand tekent voor een
// vaste 9:16 deelkaart en is niet herbruikbaar voor een schermbrede sheet.
const ROUTE_VIEWBOX_W = 320;
const ROUTE_H = 130;

function routeToSvgPath(
  route: Array<{ lat: number; lon: number }>,
  width: number,
  height: number,
  padding = 14,
): string {
  if (route.length < 2) return '';

  const lats = route.map(p => p.lat);
  const lons = route.map(p => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const rangeX = maxLon - minLon || 0.001;
  const rangeY = maxLat - minLat || 0.001;

  const drawW = width  - padding * 2;
  const drawH = height - padding * 2;
  const scale = Math.min(drawW / rangeX, drawH / rangeY);

  const offsetX = padding + (drawW - rangeX * scale) / 2;
  const offsetY = padding + (drawH - rangeY * scale) / 2;

  const points = route.map(p => {
    const x = offsetX + (p.lon - minLon) * scale;
    // Lat neemt af naar beneden in SVG-ruimte, dus inverteren
    const y = offsetY + (maxLat - p.lat) * scale;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return `M ${points.join(' L ')}`;
}

// ── Hartslagzone uit een gemeten gemiddelde ──────────────────────────────────
// Zelfde percentagegrenzen als zoneInfo in trainingPlans.ts (50-60 / 61-70 /
// 71-80 / 81-90 / 91-100% van de maximale hartslag), maar dan toegepast op de
// daadwerkelijk gelopen gemiddelde hartslag in plaats van op de geplande
// sessiezone. Zo laat de sheet zien in welke zone deze run ECHT zat.
function heartRateZoneFromAvg(avgHr: number, maxHr: number): HeartRateZone {
  const pct = avgHr / maxHr;
  if (pct < 0.61) return 'Z1';
  if (pct < 0.71) return 'Z2';
  if (pct < 0.81) return 'Z3';
  if (pct < 0.91) return 'Z4';
  return 'Z5';
}

/** Splittijd in mm:ss, voor de km-splits-lijst — gelijk aan session/summary.tsx. */
function formatSplitTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface RunDetailSheetProps {
  visible: boolean;
  session: CompletedSession;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RunDetailSheet({ visible, session, onClose }: RunDetailSheetProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const profile    = useAppStore(s => s.profile);
  const racePlan   = useAppStore(s => s.racePlan);
  const customPlan = useAppStore(s => s.customPlan);
  const schemaMode = useAppStore(s => s.schemaMode);

  const [showShare, setShowShare] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Plan- en sessienaam herleiden, zelfde patroon als logbook.tsx en
  // session/summary.tsx. Lukt dit niet (schema sindsdien gewijzigd, of een
  // geïmporteerde run zonder match), dan blijft het gewoon weg — de datum
  // staat er hoe dan ook.
  const activePlan = useMemo(
    () => profile
      ? resolveActivePlan({ schemaMode, racePlan, customPlan, goal: profile.goal, trainingDays: profile.trainingDays })
      : null,
    [schemaMode, racePlan, customPlan, profile],
  );
  const planSession = useMemo(() => {
    const week = activePlan?.weeks.find(w => w.weekNumber === session.weekNumber);
    return week?.sessions.find(s => s.id === session.sessionId) ?? null;
  }, [activePlan, session.weekNumber, session.sessionId]);

  const rawDateLabel = format(new Date(session.completedAt), "EEEE d MMMM 'om' HH:mm", { locale: nl });
  const dateLabel = rawDateLabel.charAt(0).toUpperCase() + rawDateLabel.slice(1);

  const route = session.route ?? [];
  const hasRoute = route.length >= 2;
  const routePath = hasRoute ? routeToSvgPath(route, ROUTE_VIEWBOX_W, ROUTE_H) : '';
  const startPoint = routePath.split(' ')[1]?.split(',') ?? [];
  const startX = parseFloat(startPoint[0]);
  const startY = parseFloat(startPoint[1]);

  // Hartslagregel: alleen de velden tonen die er zijn, in plaats van een vaste
  // sjabloonzin met streepjes voor ontbrekende waarden.
  const heartRateParts: string[] = [];
  if (session.avgHeartRate != null) heartRateParts.push(`gem. ${session.avgHeartRate} bpm`);
  if (session.maxHeartRateBpm != null) heartRateParts.push(`max ${session.maxHeartRateBpm} bpm`);
  const zone = (profile?.maxHeartRate && session.avgHeartRate != null)
    ? heartRateZoneFromAvg(session.avgHeartRate, profile.maxHeartRate)
    : null;

  const splits = session.splits ?? [];
  const fastestSplitSeconds = splits.length > 0 ? Math.min(...splits.map(s => s.seconds)) : 0;
  const slowestSplitSeconds = splits.length > 0 ? Math.max(...splits.map(s => s.seconds)) : 0;

  const handleExportGpx = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const result = await exportSessionAsGpx(session);
      if (!result.success) {
        const message =
          result.error === 'delen_niet_beschikbaar'
            ? 'Delen is op dit toestel niet beschikbaar.'
            : result.error === 'geen_route'
            ? 'Deze training heeft geen route om te exporteren.'
            : 'Er ging iets mis bij het exporteren.';
        Alert.alert('Exporteren mislukt', message);
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
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

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {/* Datum/tijd + evt. geplande sessie */}
            <View style={styles.header}>
              <Text style={styles.headerDate}>{dateLabel}</Text>
              {planSession && (
                <Text style={styles.headerSession} numberOfLines={1}>
                  Week {session.weekNumber}{activePlan?.name ? ` · ${activePlan.name}` : ''} · {planSession.description}
                </Text>
              )}
            </View>

            {/* Routetracé, alleen als er bruikbare GPS-punten zijn */}
            {hasRoute && (
              <View style={styles.routeCard}>
                <Svg width="100%" height={ROUTE_H} viewBox={`0 0 ${ROUTE_VIEWBOX_W} ${ROUTE_H}`}>
                  <Path
                    d={routePath}
                    stroke={colors.brandPrimary}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                  {Number.isFinite(startX) && Number.isFinite(startY) && (
                    <>
                      <Circle cx={startX} cy={startY} r={7} fill={colors.brandPrimary} opacity={0.22} />
                      <Circle cx={startX} cy={startY} r={3.6} fill={colors.brandPrimary} />
                    </>
                  )}
                </Svg>
              </View>
            )}

            {/* Grote afstand */}
            <View style={styles.bigStat}>
              <Text style={styles.bigStatValue}>{session.actualDistanceKm.toFixed(2)}</Text>
              <Text style={styles.bigStatUnit}>kilometer</Text>
            </View>

            {/* Tijd / tempo / (evt.) zone */}
            <View style={styles.statsGrid}>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>Tijd</Text>
                <Text style={styles.statValue}>{formatDuration(session.durationSeconds)}</Text>
              </View>
              <View style={[styles.statCell, styles.statCellBorder]}>
                <Text style={styles.statLabel}>Tempo</Text>
                <Text style={styles.statValue}>{formatPacePerKm(session.avgPaceSecPerKm)}</Text>
              </View>
              {zone && (
                <View style={styles.statCell}>
                  <Text style={styles.statLabel}>Zone</Text>
                  <ZoneBadge zone={zone} size="sm" />
                </View>
              )}
            </View>

            {/* Hartslag: alleen als er metingen zijn (gekoppelde BLE-monitor) */}
            {heartRateParts.length > 0 && (
              <View style={styles.heartRateRow}>
                <Text style={styles.heartRateText}>Hartslag: {heartRateParts.join(' · ')}</Text>
              </View>
            )}

            {/* Km-splits, in Strava-stijl: per km de tijd met een balkje relatief
                aan de langzaamste km, en de snelste km uitgelicht — gelijk aan
                session/summary.tsx */}
            {splits.length > 0 && (
              <View style={styles.splitsCard}>
                <Text style={styles.splitsTitle}>Splits per kilometer</Text>
                <View style={styles.splitsList}>
                  {splits.map(split => {
                    const isFastest = split.seconds === fastestSplitSeconds && splits.length > 1;
                    const barPct = slowestSplitSeconds > 0
                      ? Math.max(8, (split.seconds / slowestSplitSeconds) * 100)
                      : 0;
                    return (
                      <View key={split.km} style={styles.splitRow}>
                        <Text style={[styles.splitKm, isFastest && styles.splitKmFastest]}>
                          {split.km}
                        </Text>
                        <View style={styles.splitBarTrack}>
                          <View
                            style={[
                              styles.splitBarFill,
                              { width: `${barPct}%` },
                              isFastest && styles.splitBarFillFastest,
                            ]}
                          />
                        </View>
                        <View style={styles.splitTimeRow}>
                          <Text style={[styles.splitTime, isFastest && styles.splitTimeFastest]}>
                            {formatSplitTime(split.seconds)}
                          </Text>
                          {isFastest && <Zap size={12} color={colors.success} strokeWidth={2.5} />}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Bron, alleen als de run niet in de app zelf gelopen is */}
            {session.source !== 'app' && (
              <Text style={styles.sourceText}>via {sourceLabel[session.source]}</Text>
            )}

            {/* Knoppen */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionBtn, hasRoute && styles.actionBtnHalf]}
                onPress={() => setShowShare(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Deel deze run"
              >
                <Share2 size={18} color={colors.brandPrimary} strokeWidth={2} />
                <Text style={styles.actionBtnText} numberOfLines={1} adjustsFontSizeToFit>Delen</Text>
              </TouchableOpacity>
              {hasRoute && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnHalf]}
                  onPress={handleExportGpx}
                  disabled={isExporting}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Exporteer als GPX"
                >
                  <FileDown size={18} color={colors.brandPrimary} strokeWidth={2} />
                  <Text style={styles.actionBtnText} numberOfLines={1} adjustsFontSizeToFit>
                    {isExporting ? 'Bezig...' : 'GPX exporteren'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>

          {/* Laatste kind, zie sheetParts. */}
          <SheetCloseButton onPress={onClose} />
        </View>
      </Modal>

      {profile && (
        <ShareRunSheet
          visible={showShare}
          session={session}
          weekNumber={session.weekNumber}
          totalWeeks={activePlan?.totalWeeks}
          planLabel={activePlan?.name}
          runnerName={profile.name}
          maxHeartRate={profile.maxHeartRate}
          onClose={() => setShowShare(false)}
        />
      )}
    </>
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
    maxHeight: '88%',
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    ...shadows.lg,
  },

  scroll: {
    paddingHorizontal: spacing[3],
    paddingTop: spacing[2],
    paddingBottom: spacing[2],
    gap: spacing[2],
  },

  header: { alignItems: 'center', gap: 2, marginBottom: spacing[0.5] },
  headerDate: {
    fontFamily: typography.fontFamily.sansBold, fontSize: typography.fontSize.lg,
    color: colors.textPrimary, textAlign: 'center',
  },
  headerSession: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.sm,
    color: colors.textSecondary, textAlign: 'center',
  },

  routeCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderSubtle,
    paddingVertical: spacing[1],
  },

  bigStat: { alignItems: 'center' },
  bigStatValue: {
    fontFamily: typography.fontFamily.display, fontSize: typography.fontSize['4xl'],
    color: colors.textPrimary, letterSpacing: -2,
  },
  bigStatUnit: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.sm,
    color: colors.textSecondary, marginTop: -4,
  },

  statsGrid: {
    flexDirection: 'row', backgroundColor: colors.bgCard,
    borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderSubtle,
  },
  statCell: { flex: 1, alignItems: 'center', paddingVertical: spacing[1.5] },
  statCellBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.borderSubtle },
  statLabel: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.xs,
    color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider, marginBottom: 6,
  },
  statValue: {
    fontFamily: typography.fontFamily.sansBold, fontSize: typography.fontSize.base, color: colors.textPrimary,
  },

  heartRateRow: { alignItems: 'center' },
  heartRateText: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },

  splitsCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderSubtle, padding: spacing[2], gap: spacing[1.5],
  },
  splitsTitle: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.base, color: colors.textPrimary,
  },
  splitsList: { gap: spacing[1] },
  splitRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1.5],
  },
  splitKm: {
    width: 22,
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm,
    color: colors.textSecondary, textAlign: 'right',
  },
  splitKmFastest: { color: colors.success },
  splitBarTrack: {
    flex: 1, height: 8, borderRadius: radius.full,
    backgroundColor: colors.bgSurface, overflow: 'hidden',
  },
  splitBarFill: {
    height: '100%', borderRadius: radius.full,
    backgroundColor: colors.brandPrimary,
  },
  splitBarFillFastest: { backgroundColor: colors.success },
  splitTimeRow: {
    width: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4,
  },
  splitTime: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm,
    color: colors.textPrimary, fontVariant: ['tabular-nums'],
  },
  splitTimeFastest: { color: colors.success },

  sourceText: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs,
    color: colors.textTertiary, fontStyle: 'italic', textAlign: 'center',
  },

  actions: { flexDirection: 'row', gap: spacing[1] },
  actionBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[1], paddingVertical: spacing[1.5],
    borderRadius: radius.xl, borderWidth: 1,
    borderColor: colors.brandPrimary + '55',
    backgroundColor: colors.brandPrimary + '11',
  },
  actionBtnHalf: { flex: 1 },
  actionBtnText: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.base,
    color: colors.brandPrimary,
  },
});
