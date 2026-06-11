/**
 * RacePickerScreen
 *
 * Drill-down keuze: Provincie → Stad → Wedstrijd
 * Elke laag toont een dropdown/accordion.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  LayoutAnimation, Platform, UIManager, Alert,
} from 'react-native';
import {
  ChevronDown, ChevronRight, ChevronLeft,
  MapPin, Calendar, Clock, Trophy, CheckCircle2, X,
} from 'lucide-react-native';
import { colors, palette, typography, spacing, radius, shadows } from '../../theme/tokens';
import {
  PROVINCES, weeksUntilRace, formatRaceDate,
  type Race, type RaceCity, type RaceProvince,
} from '../../data/rotterdamRaces';
import { buildRacePlan, canTrainForRace, type RacePlan } from '../../data/buildRacePlan';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Modal } from 'react-native';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const distanceLabel: Record<Race['distance'], string> = {
  '5km': '5 KM', '10km': '10 KM',
  'half_marathon': 'Halve Marathon', 'marathon': 'Marathon',
};

// ── Subcomponents ─────────────────────────────────────────────────────────────

function ProvinceRow({
  province, isOpen, onToggle,
}: { province: RaceProvince; isOpen: boolean; onToggle: () => void }) {
  const totalRaces = province.cities.reduce((s, c) => s + c.races.length, 0);
  return (
    <TouchableOpacity style={styles.provinceRow} onPress={onToggle} activeOpacity={0.8}>
      <View style={styles.provinceLeft}>
        <View style={styles.provinceIcon}>
          <MapPin size={16} color={colors.brandPrimary} strokeWidth={2} />
        </View>
        <View>
          <Text style={styles.provinceName}>{province.name}</Text>
          <Text style={styles.provinceSub}>{province.cities.length} steden · {totalRaces} wedstrijden</Text>
        </View>
      </View>
      {isOpen
        ? <ChevronDown size={18} color={colors.textSecondary} strokeWidth={2} />
        : <ChevronRight size={18} color={colors.textSecondary} strokeWidth={2} />
      }
    </TouchableOpacity>
  );
}

function CityRow({
  city, isOpen, onToggle,
}: { city: RaceCity; isOpen: boolean; onToggle: () => void }) {
  const upcoming = city.races.filter(r => new Date(r.date) > new Date()).length;
  return (
    <TouchableOpacity style={styles.cityRow} onPress={onToggle} activeOpacity={0.8}>
      <View style={styles.cityLeft}>
        <View style={[styles.cityDot, isOpen && styles.cityDotActive]} />
        <View>
          <Text style={styles.cityName}>{city.name}</Text>
          <Text style={styles.citySub}>{upcoming} aankomende wedstrijden</Text>
        </View>
      </View>
      {isOpen
        ? <ChevronDown size={16} color={colors.textSecondary} strokeWidth={2} />
        : <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2} />
      }
    </TouchableOpacity>
  );
}

function RaceRow({
  race, onPress,
}: { race: Race; onPress: () => void }) {
  const isPast   = new Date(race.date) <= new Date();
  const weeks    = weeksUntilRace(race.date);
  const { possible } = canTrainForRace(race);
  const accent   = race.accentColor;

  return (
    <TouchableOpacity
      style={[styles.raceRow, isPast && styles.raceRowPast]}
      onPress={onPress}
      activeOpacity={isPast ? 1 : 0.75}
      disabled={isPast}
    >
      <View style={[styles.raceAccentBar, { backgroundColor: accent }]} />
      <View style={styles.raceRowInner}>
        <View style={styles.raceRowTop}>
          <Text style={styles.raceName} numberOfLines={1}>{race.name}</Text>
          <View style={[styles.distancePill, { backgroundColor: accent + '22', borderColor: accent + '55' }]}>
            <Text style={[styles.distancePillText, { color: accent }]}>
              {distanceLabel[race.distance]}
            </Text>
          </View>
        </View>
        <View style={styles.raceMeta}>
          <View style={styles.raceMetaItem}>
            <Calendar size={11} color={colors.textTertiary} strokeWidth={2} />
            <Text style={styles.raceMetaText}>{formatRaceDate(race.date)}</Text>
          </View>
          {!isPast && (
            <View style={styles.raceMetaItem}>
              <Clock size={11} color={possible ? accent : palette.warning} strokeWidth={2} />
              <Text style={[styles.raceMetaText, { color: possible ? accent : palette.warning }]}>
                {weeks} weken te gaan
              </Text>
            </View>
          )}
          {isPast && (
            <Text style={styles.pastLabel}>Afgelopen</Text>
          )}
        </View>
      </View>
      {!isPast && (
        <ChevronRight size={15} color={colors.textTertiary} strokeWidth={2} />
      )}
    </TouchableOpacity>
  );
}

// ── Event-groep (meerdere afstanden binnen één event) ────────────────────────

function EventGroupRow({
  event, isOpen, onToggle, onSelectSub,
}: {
  event: Race;
  isOpen: boolean;
  onToggle: () => void;
  onSelectSub: (race: Race) => void;
}) {
  const accent = event.accentColor;
  const isPast = new Date(event.date) <= new Date();

  return (
    <View style={[styles.eventGroup, isPast && styles.raceRowPast]}>
      {/* Hoofd event-rij — klikbaar om sub-races te tonen */}
      <TouchableOpacity
        style={styles.eventGroupHeader}
        onPress={onToggle}
        activeOpacity={0.8}
        disabled={isPast}
      >
        <View style={[styles.raceAccentBar, { backgroundColor: accent }]} />
        <View style={styles.raceRowInner}>
          <View style={styles.raceRowTop}>
            <Text style={styles.raceName} numberOfLines={1}>{event.name}</Text>
            <View style={[styles.multiDistancePill, { backgroundColor: accent + '22', borderColor: accent + '55' }]}>
              <Text style={[styles.distancePillText, { color: accent }]}>
                {event.subRaces!.length} afstanden
              </Text>
            </View>
          </View>
          <View style={styles.raceMeta}>
            <View style={styles.raceMetaItem}>
              <Calendar size={11} color={colors.textTertiary} strokeWidth={2} />
              <Text style={styles.raceMetaText}>{formatRaceDate(event.date)}</Text>
            </View>
            {!isPast && (
              <View style={styles.raceMetaItem}>
                <Clock size={11} color={accent} strokeWidth={2} />
                <Text style={[styles.raceMetaText, { color: accent }]}>
                  {weeksUntilRace(event.date)} weken te gaan
                </Text>
              </View>
            )}
          </View>
        </View>
        {isOpen
          ? <ChevronDown size={15} color={colors.textSecondary} strokeWidth={2} style={{ marginRight: spacing[1.5] }} />
          : <ChevronRight size={15} color={colors.textSecondary} strokeWidth={2} style={{ marginRight: spacing[1.5] }} />
        }
      </TouchableOpacity>

      {/* Sub-races */}
      {isOpen && (
        <View style={styles.subRacesContainer}>
          {event.subRaces!.map((sub, i) => {
            const subAccent = sub.accentColor;
            return (
              <TouchableOpacity
                key={sub.id}
                style={[
                  styles.subRaceRow,
                  i < event.subRaces!.length - 1 && styles.subRaceRowBorder,
                ]}
                onPress={() => onSelectSub(sub)}
                activeOpacity={0.75}
              >
                <View style={[styles.subRaceDot, { backgroundColor: subAccent }]} />
                <View style={styles.subRaceText}>
                  <Text style={styles.subRaceName}>{sub.name}</Text>
                  <Text style={styles.subRaceDesc} numberOfLines={1}>{sub.description}</Text>
                </View>
                <View style={[styles.distancePill, { backgroundColor: subAccent + '22', borderColor: subAccent + '55' }]}>
                  <Text style={[styles.distancePillText, { color: subAccent }]}>
                    {distanceLabel[sub.distance]}
                  </Text>
                </View>
                <ChevronRight size={13} color={colors.textTertiary} strokeWidth={2} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ── Bevestigingsmodal ─────────────────────────────────────────────────────────

function ConfirmModal({
  plan, onConfirm, onCancel,
}: { plan: RacePlan; onConfirm: () => void; onCancel: () => void }) {
  const accent = plan.race.accentColor;
  const startStr = new Date(plan.startDate).toLocaleDateString('nl-NL', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <Modal transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <TouchableOpacity style={styles.modalClose} onPress={onCancel} hitSlop={12}>
            <X size={20} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>

          <View style={[styles.modalIconBox, { backgroundColor: accent + '22' }]}>
            <Trophy size={28} color={accent} strokeWidth={1.5} />
          </View>
          <Text style={styles.modalTitle}>{plan.race.name}</Text>
          <Text style={styles.modalSub}>{plan.adaptationNote}</Text>

          <View style={styles.modalStats}>
            {[
              { label: 'Racedag',   value: formatRaceDate(plan.race.date) },
              { label: 'Schema',    value: `${plan.totalWeeks} weken` },
              { label: 'Start',     value: startStr },
              { label: 'Afstand',   value: distanceLabel[plan.race.distance] },
            ].map(({ label, value }) => (
              <View key={label} style={styles.modalStat}>
                <Text style={styles.modalStatLabel}>{label}</Text>
                <Text style={styles.modalStatValue}>{value}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: accent }]}
            onPress={onConfirm}
            activeOpacity={0.85}
          >
            <CheckCircle2 size={18} color="#fff" strokeWidth={2.5} />
            <Text style={styles.confirmBtnText}>Ja, start dit schema</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelBtnText}>Annuleren</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Hoofd component ───────────────────────────────────────────────────────────

// ── Featured race hero-kaart ──────────────────────────────────────────────────

function FeaturedRaceCard({
  race, onPress,
}: { race: Race; onPress: () => void }) {
  const weeks  = weeksUntilRace(race.date);
  const accent = race.accentColor;
  const months = Math.round(weeks / 4.3);

  return (
    <TouchableOpacity
      style={[styles.featuredCard, { borderColor: accent + '55' }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Achtergrond glow */}
      <View style={[styles.featuredGlow, { backgroundColor: accent + '18' }]} />

      {/* Kroontje */}
      <View style={styles.featuredBadgeRow}>
        <View style={[styles.featuredBadge, { backgroundColor: accent + '22', borderColor: accent + '55' }]}>
          <Trophy size={12} color={accent} strokeWidth={2} />
          <Text style={[styles.featuredBadgeText, { color: accent }]}>Ultiem doel</Text>
        </View>
      </View>

      {/* Titel */}
      <Text style={styles.featuredName}>{race.name}</Text>
      <Text style={styles.featuredLocation}>{race.location}</Text>

      {/* Stats row */}
      <View style={styles.featuredStats}>
        <View style={styles.featuredStat}>
          <Text style={[styles.featuredStatValue, { color: accent }]}>42,2</Text>
          <Text style={styles.featuredStatLabel}>km</Text>
        </View>
        <View style={styles.featuredStatDivider} />
        <View style={styles.featuredStat}>
          <Text style={[styles.featuredStatValue, { color: accent }]}>{weeks}</Text>
          <Text style={styles.featuredStatLabel}>weken te gaan</Text>
        </View>
        <View style={styles.featuredStatDivider} />
        <View style={styles.featuredStat}>
          <Text style={[styles.featuredStatValue, { color: accent }]}>{months}</Text>
          <Text style={styles.featuredStatLabel}>maanden</Text>
        </View>
      </View>

      {/* Datum */}
      <View style={styles.featuredDateRow}>
        <Calendar size={13} color={colors.textSecondary} strokeWidth={2} />
        <Text style={styles.featuredDate}>{formatRaceDate(race.date)}</Text>
      </View>

      {/* Inspiratietekst */}
      <Text style={styles.featuredQuote}>
        "De marathon van Rotterdam is meer dan een race, het is het bewijs dat je verder kunt gaan dan je dacht te kunnen."
      </Text>

      {/* CTA */}
      <View style={[styles.featuredCta, { backgroundColor: accent }]}>
        <Text style={styles.featuredCtaText}>Train voor dit doel</Text>
        <ChevronRight size={16} color="#fff" strokeWidth={2.5} />
      </View>
    </TouchableOpacity>
  );
}

export interface RacePickerScreenProps {
  onSelectRace: (plan: RacePlan) => void;
  onBack?: () => void;
}

export function RacePickerScreen({ onSelectRace, onBack }: RacePickerScreenProps) {
  const [openProvinces, setOpenProvinces] = useState<Set<string>>(new Set(['zuid-holland']));
  const [openCities,    setOpenCities]    = useState<Set<string>>(new Set(['rotterdam']));
  const [openEvents,    setOpenEvents]    = useState<Set<string>>(new Set());
  const [pendingPlan,   setPendingPlan]   = useState<RacePlan | null>(null);

  // Verzamel alle featured races (niet verlopen)
  const featuredRaces = PROVINCES
    .flatMap(p => p.cities.flatMap(c => c.races))
    .filter(r => r.featured && new Date(r.date) > new Date());

  function toggleProvince(id: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenProvinces(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleCity(id: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenCities(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleEvent(id: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenEvents(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleRacePress(race: Race) {
    const plan = buildRacePlan(race);
    if (!plan) {
      const { reason } = canTrainForRace(race);
      Alert.alert(
        'Te laat om te starten',
        reason ?? 'De wedstrijd is te dichtbij voor een volwaardig schema.',
        [{ text: 'Begrepen', style: 'cancel' }],
      );
      return;
    }
    setPendingPlan(plan);
  }

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={12}>
            <ChevronLeft size={22} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        )}
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Kies een wedstrijd</Text>
          <Text style={styles.headerSub}>Provincie · Stad · Wedstrijd</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>

        {/* Featured races — uitgelicht bovenaan */}
        {featuredRaces.length > 0 && (
          <View style={styles.featuredSection}>
            <Text style={styles.featuredSectionLabel}>⭐ Ultiem doel</Text>
            {featuredRaces.map(race => (
              <FeaturedRaceCard
                key={race.id}
                race={race}
                onPress={() => handleRacePress(race)}
              />
            ))}
          </View>
        )}

        {/* Alle wedstrijden per provincie */}
        <Text style={styles.allRacesLabel}>Alle wedstrijden</Text>

        {PROVINCES.map(province => (
          <View key={province.id} style={styles.provinceBlock}>
            {/* Provincie header */}
            <ProvinceRow
              province={province}
              isOpen={openProvinces.has(province.id)}
              onToggle={() => toggleProvince(province.id)}
            />

            {/* Steden */}
            {openProvinces.has(province.id) && (
              <View style={styles.citiesContainer}>
                {province.cities.map(city => (
                  <View key={city.id} style={styles.cityBlock}>
                    <CityRow
                      city={city}
                      isOpen={openCities.has(city.id)}
                      onToggle={() => toggleCity(city.id)}
                    />

                    {/* Wedstrijden */}
                    {openCities.has(city.id) && (
                      <View style={styles.racesContainer}>
                        {city.races.map(race =>
                          race.subRaces ? (
                            <EventGroupRow
                              key={race.id}
                              event={race}
                              isOpen={openEvents.has(race.id)}
                              onToggle={() => toggleEvent(race.id)}
                              onSelectSub={handleRacePress}
                            />
                          ) : (
                            <RaceRow
                              key={race.id}
                              race={race}
                              onPress={() => handleRacePress(race)}
                            />
                          )
                        )}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        <Text style={styles.footnote}>
          Datums zijn indicatief. Controleer altijd de officiële website van de wedstrijd.
        </Text>
      </ScrollView>

      {pendingPlan && (
        <ConfirmModal
          plan={pendingPlan}
          onConfirm={() => {
            onSelectRace(pendingPlan);
            setPendingPlan(null);
          }}
          onCancel={() => setPendingPlan(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgBase },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    paddingHorizontal: spacing[2], paddingTop: spacing[2], paddingBottom: spacing[1.5],
    borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
  },
  backBtn: { padding: 4 },
  headerText: { flex: 1 },
  headerTitle: {
    fontFamily: typography.fontFamily.display, fontSize: typography.fontSize['2xl'],
    color: colors.textPrimary, letterSpacing: typography.letterSpacing.tight,
  },
  headerSub: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs,
    color: colors.textTertiary, marginTop: 2,
    letterSpacing: typography.letterSpacing.wide,
  },

  list: { padding: spacing[2], gap: spacing[1.5], paddingBottom: spacing[6] },

  // Provincie
  provinceBlock: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderSubtle, overflow: 'hidden',
    ...shadows.sm,
  },
  provinceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing[2],
  },
  provinceLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] },
  provinceIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.brandPrimary + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  provinceName: {
    fontFamily: typography.fontFamily.sansBold, fontSize: typography.fontSize.md, color: colors.textPrimary,
  },
  provinceSub: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs, color: colors.textSecondary, marginTop: 2,
  },

  // Steden container
  citiesContainer: {
    borderTopWidth: 1, borderTopColor: colors.borderSubtle,
  },

  // Stad
  cityBlock: { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle + '80' },
  cityRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing[1.5], paddingHorizontal: spacing[2],
    backgroundColor: colors.bgSurface,
  },
  cityLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] },
  cityDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.borderDefault, marginLeft: 4 },
  cityDotActive: { backgroundColor: colors.brandPrimary },
  cityName: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.base, color: colors.textPrimary,
  },
  citySub: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs, color: colors.textSecondary, marginTop: 1,
  },

  // Wedstrijden
  racesContainer: { backgroundColor: colors.bgBase },
  raceRow: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: colors.borderSubtle + '60',
  },
  raceRowPast: { opacity: 0.4 },
  raceAccentBar: { width: 3, alignSelf: 'stretch' },
  raceRowInner: { flex: 1, paddingVertical: spacing[1.5], paddingHorizontal: spacing[2], gap: 5 },
  raceRowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], flexWrap: 'wrap' },
  raceName: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.base,
    color: colors.textPrimary, flex: 1,
  },
  distancePill: {
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: radius.full, borderWidth: 1,
  },
  multiDistancePill: {
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: radius.full, borderWidth: 1,
  },
  distancePillText: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.xs,
    letterSpacing: typography.letterSpacing.wide,
  },
  raceMeta: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' },
  raceMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  raceMetaText: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs,
    color: colors.textTertiary, textTransform: 'capitalize',
  },
  pastLabel: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.xs, color: colors.textTertiary,
  },

  // Event-groep
  eventGroup: { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle + '60' },
  eventGroupHeader: { flexDirection: 'row', alignItems: 'center' },
  subRacesContainer: {
    backgroundColor: colors.bgSurface + 'CC',
    borderTopWidth: 1, borderTopColor: colors.borderSubtle + '60', marginLeft: 3,
  },
  subRaceRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing[1.5], paddingHorizontal: spacing[2], gap: spacing[1],
  },
  subRaceRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle + '60' },
  subRaceDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  subRaceText: { flex: 1, gap: 2 },
  subRaceName: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm, color: colors.textPrimary,
  },
  subRaceDesc: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs, color: colors.textTertiary,
  },

  // Featured race hero-kaart
  featuredSection: { gap: spacing[1] },
  featuredSectionLabel: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.xs,
    color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.widest,
    paddingHorizontal: spacing[0.5],
  },
  allRacesLabel: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.xs,
    color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.widest,
    paddingHorizontal: spacing[0.5], marginTop: spacing[1],
  },
  featuredCard: {
    borderRadius: radius['2xl'], borderWidth: 1.5,
    backgroundColor: colors.bgCard, overflow: 'hidden',
    padding: spacing[2.5], gap: spacing[1.5],
    ...shadows.md,
  },
  featuredGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius['2xl'],
  },
  featuredBadgeRow: { flexDirection: 'row' },
  featuredBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing[1], paddingVertical: 4,
    borderRadius: radius.full, borderWidth: 1,
    alignSelf: 'flex-start',
  },
  featuredBadgeText: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.xs,
    letterSpacing: typography.letterSpacing.wide,
  },
  featuredName: {
    fontFamily: typography.fontFamily.display, fontSize: typography.fontSize['2xl'],
    color: colors.textPrimary, letterSpacing: typography.letterSpacing.tight,
  },
  featuredLocation: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm,
    color: colors.textSecondary, marginTop: -spacing[1],
  },
  featuredStats: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgSurface, borderRadius: radius.xl, padding: spacing[2],
    gap: spacing[1],
  },
  featuredStat: { flex: 1, alignItems: 'center', gap: 2 },
  featuredStatValue: {
    fontFamily: typography.fontFamily.sansBold, fontSize: typography.fontSize.xl,
    lineHeight: typography.fontSize.xl * 1.1,
  },
  featuredStatLabel: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs,
    color: colors.textSecondary, textAlign: 'center',
  },
  featuredStatDivider: { width: 1, height: 32, backgroundColor: colors.borderSubtle },
  featuredDateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  featuredDate: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.sm,
    color: colors.textSecondary, textTransform: 'capitalize',
  },
  featuredQuote: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm,
    color: colors.textTertiary, fontStyle: 'italic',
    lineHeight: typography.fontSize.sm * 1.6,
    paddingHorizontal: spacing[0.5],
  },
  featuredCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[1], paddingVertical: spacing[1.5], borderRadius: radius.xl,
    marginTop: spacing[0.5],
  },
  featuredCtaText: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.base, color: '#fff',
  },

  footnote: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs,
    color: colors.textTertiary, textAlign: 'center',
    paddingVertical: spacing[1], paddingHorizontal: spacing[2],
    lineHeight: typography.fontSize.xs * 1.6,
  },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.bgSurface,
    borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'],
    padding: spacing[3], paddingBottom: spacing[5], alignItems: 'center', gap: spacing[1.5],
  },
  modalClose: { alignSelf: 'flex-end', padding: 4 },
  modalIconBox: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  modalTitle: { fontFamily: typography.fontFamily.sansBold, fontSize: typography.fontSize.xl, color: colors.textPrimary, textAlign: 'center' },
  modalSub: { fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: typography.fontSize.sm * 1.55 },
  modalStats: { width: '100%', backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: spacing[2], gap: spacing[1], marginTop: spacing[0.5] },
  modalStat: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalStatLabel: { fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm, color: colors.textSecondary },
  modalStatValue: { fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm, color: colors.textPrimary, textTransform: 'capitalize' },
  confirmBtn: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[1], paddingVertical: spacing[1.5], borderRadius: radius.xl, marginTop: spacing[0.5] },
  confirmBtnText: { fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.base, color: '#fff' },
  cancelBtn: { paddingVertical: spacing[1] },
  cancelBtnText: { fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.sm, color: colors.textSecondary },
});
