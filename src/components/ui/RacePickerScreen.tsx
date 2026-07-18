/**
 * RacePickerScreen
 *
 * Drill-down keuze: Land → Provincie → Stad → Wedstrijd
 * Elke laag toont een dropdown/accordion. Een zoekbalk en filterchips
 * (afstand, land, inschrijfstatus) filteren de hiërarchie live.
 */

import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  LayoutAnimation, Platform, UIManager, Alert, TextInput,
} from 'react-native';
import {
  ChevronDown, ChevronRight, ChevronLeft,
  MapPin, Calendar, Clock, Trophy, CheckCircle2, X, Lock, Timer, Crown, Gauge,
  Search, Globe2, SlidersHorizontal, RotateCcw,
} from 'lucide-react-native';
import { palette, typography, spacing, radius, shadows, type ThemeColors } from '../../theme/tokens';
import { useThemeColors } from '../../theme/useTheme';
import {
  COUNTRIES, weeksUntilRace, weeksUntilLabel, formatRaceDate,
  type Race, type RaceCity, type RaceProvince, type RaceCountry, type RaceDistance,
} from '../../data/rotterdamRaces';
import { buildRacePlan, canTrainForRace, type RacePlan } from '../../data/buildRacePlan';
import { usePremium } from '../../hooks/usePremium';
import { isRaceDistanceFree } from '../../config/premiumConfig';
import {
  parseTimeToSeconds, parsePaceToSecPerKm, paceToTargetSeconds,
  raceDistanceToKm, realismHint, racePaceSecPerKm, formatPacePerKm,
} from '../../data/paceModel';
import { PremiumBadge } from './PremiumBadge';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Modal } from 'react-native';
import { useAppStore } from '../../store/appStore';

// Niveau-chips voor "hoeveel loop je nu al comfortabel?". Stappen aansluitend
// bij de sjabloonschema's in trainingPlans.ts (van eerste 5 km-mijlpaal tot
// de 15 km-instap-afstand).
const COMFORT_LEVELS: { km: number; label: string }[] = [
  { km: 0,  label: 'Nul, ik begin' },
  { km: 3,  label: '3 km' },
  { km: 5,  label: '5 km' },
  { km: 8,  label: '8 km' },
  { km: 10, label: '10 km' },
  { km: 15, label: '15 km' },
];

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const distanceLabel: Record<Race['distance'], string> = {
  '5km': '5 KM', '10km': '10 KM', '15km': '15 KM',
  'half_marathon': 'Halve Marathon', 'marathon': 'Marathon',
};

// Afstand-filterchips in de zoekbalk-sectie.
const DISTANCE_FILTERS: { value: RaceDistance; label: string }[] = [
  { value: '5km', label: '5 KM' },
  { value: '10km', label: '10 KM' },
  { value: '15km', label: '15 KM' },
  { value: 'half_marathon', label: 'Halve marathon' },
  { value: 'marathon', label: 'Hele marathon' },
];

// ── Zoek- en filterlogica ────────────────────────────────────────────────────
//
// Zoekterm en filters combineren met EN-logica: een wedstrijd moet aan alle
// actieve criteria voldoen. Bij event-groepen (races met subRaces) telt een
// match op een van de sub-afstanden ook mee, zodat "Halve Westland" met
// filter "10km" nog steeds de groep toont (met alleen de matchende afstand
// zichtbaar in de subrijen).

function raceMatchesQuery(race: Race, city: RaceCity, query: string): boolean {
  if (!query) return true;
  const nameMatch = race.name.toLowerCase().includes(query)
    || (race.subRaces?.some(sub => sub.name.toLowerCase().includes(query)) ?? false);
  const cityMatch = city.name.toLowerCase().includes(query);
  const locationMatch = race.location.toLowerCase().includes(query)
    || (race.subRaces?.some(sub => sub.location.toLowerCase().includes(query)) ?? false);
  return nameMatch || cityMatch || locationMatch;
}

function raceMatchesDistances(race: Race, distances: Set<RaceDistance>): boolean {
  if (distances.size === 0) return true;
  if (distances.has(race.distance)) return true;
  return race.subRaces?.some(sub => distances.has(sub.distance)) ?? false;
}

function raceMatchesRegistration(race: Race, openOnly: boolean): boolean {
  if (!openOnly) return true;
  if (race.registrationOpen) return true;
  return race.subRaces?.some(sub => sub.registrationOpen) ?? false;
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function CountryRow({
  country, isOpen, onToggle,
}: { country: RaceCountry; isOpen: boolean; onToggle: () => void }) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const totalRaces = country.provinces.reduce(
    (s, p) => s + p.cities.reduce((s2, c) => s2 + c.races.length, 0), 0,
  );
  return (
    <TouchableOpacity style={styles.countryRow} onPress={onToggle} activeOpacity={0.8}>
      <View style={styles.countryLeft}>
        <View style={styles.countryIcon}>
          <Globe2 size={16} color={colors.brandPrimary} strokeWidth={2} />
        </View>
        <View>
          <Text style={styles.countryName}>{country.name}</Text>
          <Text style={styles.countrySub}>{country.provinces.length} provincies · {totalRaces} wedstrijden</Text>
        </View>
      </View>
      {isOpen
        ? <ChevronDown size={18} color={colors.textSecondary} strokeWidth={2} />
        : <ChevronRight size={18} color={colors.textSecondary} strokeWidth={2} />
      }
    </TouchableOpacity>
  );
}

function ProvinceRow({
  province, isOpen, onToggle,
}: { province: RaceProvince; isOpen: boolean; onToggle: () => void }) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
  race, onPress, locked,
}: { race: Race; onPress: () => void; locked?: boolean }) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isPast   = new Date(race.date) <= new Date();
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
          {locked && <PremiumBadge />}
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
                {weeksUntilLabel(race.date)}
              </Text>
            </View>
          )}
          {isPast && (
            <Text style={styles.pastLabel}>Afgelopen</Text>
          )}
        </View>
      </View>
      {!isPast && (
        locked
          ? <Lock size={14} color={colors.textTertiary} strokeWidth={2} style={{ marginRight: spacing[1.5] }} />
          : <ChevronRight size={15} color={colors.textTertiary} strokeWidth={2} />
      )}
    </TouchableOpacity>
  );
}

// ── Event-groep (meerdere afstanden binnen één event) ────────────────────────

function EventGroupRow({
  event, isOpen, onToggle, onSelectSub, isLocked,
}: {
  event: Race;
  isOpen: boolean;
  onToggle: () => void;
  onSelectSub: (race: Race) => void;
  isLocked: (race: Race) => boolean;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const accent = event.accentColor;
  const isPast = new Date(event.date) <= new Date();

  return (
    <View style={[styles.eventGroup, isPast && styles.raceRowPast]}>
      {/* Hoofd event-rij, klikbaar om sub-races te tonen */}
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
                  {weeksUntilLabel(event.date)}
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
            const subLocked = isLocked(sub);
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
                {subLocked
                  ? <Lock size={13} color={colors.textTertiary} strokeWidth={2} />
                  : <ChevronRight size={13} color={colors.textTertiary} strokeWidth={2} />
                }
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ── Bevestigingsmodal ─────────────────────────────────────────────────────────

// ── Doeltijd-invoer (premium) ─────────────────────────────────────────────────
//
// De gebruiker kiest tussen een eindtijd (uu:mm:ss) of een tempo per km
// (mm:ss). Daaruit berekenen we een doel-racetempo. Premium-feature: gratis
// gebruikers krijgen dit blok als upgrade-uitnodiging te zien.

type TargetMode = 'time' | 'pace';

function TargetTimeInput({
  raceKm, accent, hasAccess, onChangeSeconds, onUpgrade,
}: {
  raceKm: number;
  accent: string;
  hasAccess: boolean;
  onChangeSeconds: (seconds: number | null) => void;
  onUpgrade: () => void;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [mode, setMode]   = useState<TargetMode>('time');
  const [value, setValue] = useState('');

  // Bereken seconden + hint live mee bij elke invoerwijziging.
  function handleChange(text: string) {
    setValue(text);
    if (!hasAccess) return;

    let seconds: number | null = null;
    if (mode === 'time') {
      seconds = parseTimeToSeconds(text);
    } else {
      const pace = parsePaceToSecPerKm(text);
      seconds = pace !== null ? paceToTargetSeconds(pace, raceKm) : null;
    }
    onChangeSeconds(seconds);
  }

  function switchMode(next: TargetMode) {
    if (next === mode) return;
    setMode(next);
    setValue('');
    onChangeSeconds(null);
  }

  // Afgeleide weergave voor premium-gebruikers met geldige invoer.
  const seconds =
    mode === 'time'
      ? parseTimeToSeconds(value)
      : (() => {
          const p = parsePaceToSecPerKm(value);
          return p !== null ? paceToTargetSeconds(p, raceKm) : null;
        })();
  const pace = seconds !== null ? racePaceSecPerKm(seconds, raceKm) : null;
  const hint = seconds !== null ? realismHint(seconds, raceKm) : null;

  return (
    <View style={styles.targetBox}>
      <View style={styles.targetHeaderRow}>
        <Timer size={15} color={accent} strokeWidth={2} />
        <Text style={styles.targetTitle}>Persoonlijk doeltempo</Text>
        <PremiumBadge />
      </View>

      {hasAccess ? (
        <>
          <Text style={styles.targetSub}>
            Geef een doel op, dan rekent de app per training een persoonlijk tempo uit naast je hartslagzones.
          </Text>

          {/* Toggle eindtijd of tempo */}
          <View style={styles.targetToggle}>
            <TouchableOpacity
              style={[styles.targetToggleBtn, mode === 'time' && { backgroundColor: accent }]}
              onPress={() => switchMode('time')}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Doel als eindtijd invoeren"
              accessibilityState={{ selected: mode === 'time' }}
            >
              <Text style={[styles.targetToggleText, mode === 'time' && styles.targetToggleTextActive]}>
                Eindtijd
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.targetToggleBtn, mode === 'pace' && { backgroundColor: accent }]}
              onPress={() => switchMode('pace')}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Doel als tempo per kilometer invoeren"
              accessibilityState={{ selected: mode === 'pace' }}
            >
              <Text style={[styles.targetToggleText, mode === 'pace' && styles.targetToggleTextActive]}>
                Tempo per km
              </Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.targetInput}
            value={value}
            onChangeText={handleChange}
            placeholder={mode === 'time' ? 'bijv. 1:55:00' : 'bijv. 5:30'}
            placeholderTextColor={colors.textTertiary}
            keyboardType="numbers-and-punctuation"
            accessibilityLabel={mode === 'time' ? 'Doel-eindtijd in uren, minuten, seconden' : 'Doeltempo in minuten en seconden per kilometer'}
          />

          {pace !== null && (
            <Text style={[styles.targetResult, { color: accent }]}>
              Doel-racetempo: {formatPacePerKm(pace)}
            </Text>
          )}
          {hint && (
            <Text style={styles.targetHint}>{hint}</Text>
          )}
          <Text style={styles.targetOptional}>
            Optioneel. Laat leeg voor het standaard wedstrijdschema.
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.targetSub}>
            Met premium reken je uit elke training een persoonlijk tempo uit, op basis van je gewenste eindtijd of doeltempo.
          </Text>
          <TouchableOpacity
            style={[styles.targetUpgradeBtn, { borderColor: accent + '66' }]}
            onPress={onUpgrade}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Ontgrendel persoonlijk doeltempo met premium"
          >
            <Crown size={14} color={accent} strokeWidth={2.5} />
            <Text style={[styles.targetUpgradeText, { color: accent }]}>
              Ontgrendel met premium
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

function ConfirmModal({
  race, initialComfortableKm, onConfirm, onCancel, hasAccess, onUpgrade,
}: {
  race: Race;
  /** Laatst opgeslagen niveau van de gebruiker, vooringevuld in de chips. */
  initialComfortableKm: number | null;
  onConfirm: (plan: RacePlan, targetSeconds: number | null, comfortableKm: number | null) => void;
  onCancel: () => void;
  hasAccess: boolean;
  onUpgrade: () => void;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [targetSeconds, setTargetSeconds]     = useState<number | null>(null);
  const [comfortableKm, setComfortableKmState] = useState<number>(initialComfortableKm ?? 0);

  // Wedstrijdschema's zijn kalender-verankerd (week 1 = aankomende maandag),
  // dus een nieuw schema begint altijd opnieuw bij week 1. Als de gebruiker
  // al voortgang had in een vorig schema, laten we dat hier weten zodat de
  // reset geen verrassing is (geen keuzedialoog, gewoon een infotekst).
  const existingRacePlan   = useAppStore(s => s.racePlan);
  const existingWeekRace   = useAppStore(s => s.currentWeekRace);
  const showsResetNotice   = existingRacePlan !== null && existingWeekRace > 1;

  // Herbouw het schema live zodra de gebruiker zijn niveau wijzigt. Bij 0
  // ("Nul, ik begin") gedraagt buildRacePlan zich identiek aan zonder niveau.
  const plan = useMemo(
    () => buildRacePlan(race, undefined, undefined, comfortableKm > 0 ? comfortableKm : undefined),
    [race, comfortableKm],
  );

  // Kan in theorie niet null zijn: de aanroeper heeft de haalbaarheid al
  // gecontroleerd zonder niveau, en een niveau maakt het schema alleen maar
  // korter, nooit onhaalbaar. Defensief toch afvangen.
  if (!plan) return null;

  const accent = plan.race.accentColor;
  const raceKm = raceDistanceToKm(plan.race.distance);
  const startStr = new Date(plan.startDate).toLocaleDateString('nl-NL', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <Modal transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <ScrollView
          style={styles.modalScroll}
          contentContainerStyle={styles.modalScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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

            {showsResetNotice && (
              <Text style={styles.resetNotice}>
                Je stond op week {existingWeekRace} van je vorige schema. Dit nieuwe schema start opnieuw bij week 1.
              </Text>
            )}

            {/* Niveau: hoeveel loop je nu al comfortabel? */}
            <View style={styles.levelBox}>
              <View style={styles.levelHeaderRow}>
                <Gauge size={15} color={accent} strokeWidth={2} />
                <Text style={styles.levelTitle}>Wat loop je nu al comfortabel?</Text>
              </View>
              <Text style={styles.levelSub}>
                Dan hoeft je schema niet op 0 te beginnen.
              </Text>
              <View style={styles.levelChipsRow}>
                {COMFORT_LEVELS.map(({ km, label }) => {
                  const selected = comfortableKm === km;
                  return (
                    <TouchableOpacity
                      key={km}
                      style={[styles.levelChip, selected && { backgroundColor: accent, borderColor: accent }]}
                      onPress={() => setComfortableKmState(km)}
                      activeOpacity={0.85}
                      accessibilityRole="radio"
                      accessibilityLabel={label}
                      accessibilityState={{ selected }}
                    >
                      <Text style={[styles.levelChipText, selected && styles.levelChipTextSelected]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Doeltijd-invoer (premium) */}
            <TargetTimeInput
              raceKm={raceKm}
              accent={accent}
              hasAccess={hasAccess}
              onChangeSeconds={setTargetSeconds}
              onUpgrade={onUpgrade}
            />

            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: accent }]}
              onPress={() => onConfirm(plan, hasAccess ? targetSeconds : null, comfortableKm)}
              activeOpacity={0.85}
            >
              <CheckCircle2 size={18} color="#fff" strokeWidth={2.5} />
              <Text style={styles.confirmBtnText}>Ja, start dit schema</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelBtnText}>Annuleren</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Hoofd component ───────────────────────────────────────────────────────────

// ── Featured race hero-kaart ──────────────────────────────────────────────────

function FeaturedRaceCard({
  race, onPress, locked,
}: { race: Race; onPress: () => void; locked?: boolean }) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
        {locked && <PremiumBadge />}
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
        <Text style={styles.featuredCtaText}>
          {locked ? 'Ontgrendel met premium' : 'Train voor dit doel'}
        </Text>
        {locked
          ? <Lock size={15} color="#fff" strokeWidth={2.5} />
          : <ChevronRight size={16} color="#fff" strokeWidth={2.5} />
        }
      </View>
    </TouchableOpacity>
  );
}

export interface RacePickerScreenProps {
  /**
   * Wordt aangeroepen na bevestiging. targetSeconds is de gekozen doeltijd in
   * totale seconden (premium), of null als er geen doeltijd is ingesteld.
   */
  onSelectRace: (plan: RacePlan, targetSeconds: number | null) => void;
  onBack?: () => void;
}

export function RacePickerScreen({ onSelectRace, onBack }: RacePickerScreenProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [openCountries, setOpenCountries] = useState<Set<string>>(new Set(['nederland']));
  const [openProvinces, setOpenProvinces] = useState<Set<string>>(new Set(['zuid-holland']));
  const [openCities,    setOpenCities]    = useState<Set<string>>(new Set(['rotterdam']));
  const [openEvents,    setOpenEvents]    = useState<Set<string>>(new Set());
  const [pendingRace,   setPendingRace]   = useState<Race | null>(null);

  // Zoekbalk en filterchips
  const [searchQuery, setSearchQuery]             = useState('');
  const [selectedDistances, setSelectedDistances] = useState<Set<RaceDistance>>(new Set());
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
  const [registrationOpenOnly, setRegistrationOpenOnly] = useState(false);

  const { hasAccess, promptUpgrade, goToPaywall } = usePremium();
  const comfortableKm    = useAppStore(s => s.comfortableKm);
  const setComfortableKm = useAppStore(s => s.setComfortableKm);

  // Gratis krijgt de halve marathon als standaardschema; andere afstanden
  // (en wedstrijden) zijn premium. Offline-first: onbekende status telt als gratis.
  const isRaceLocked = (race: Race): boolean =>
    !hasAccess && !isRaceDistanceFree(race.distance);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filtersActive = normalizedQuery !== ''
    || selectedDistances.size > 0
    || selectedCountries.size > 0
    || registrationOpenOnly;

  // Land → provincie → stad, gefilterd op zoekterm + chips (EN-logica). Als er
  // filters actief zijn, vallen lege steden/provincies/landen weg; zonder
  // filters blijft de volledige (ook nog lege) hiërarchie zichtbaar, zoals de
  // voorbereide Belgische steden.
  const filteredCountries = useMemo(() => {
    return COUNTRIES
      .filter(country => selectedCountries.size === 0 || selectedCountries.has(country.id))
      .map(country => ({
        ...country,
        provinces: country.provinces
          .map(province => ({
            ...province,
            cities: province.cities
              .map(city => ({
                ...city,
                races: city.races.filter(race =>
                  raceMatchesQuery(race, city, normalizedQuery)
                  && raceMatchesDistances(race, selectedDistances)
                  && raceMatchesRegistration(race, registrationOpenOnly),
                ),
              }))
              .filter(city => !filtersActive || city.races.length > 0),
          }))
          .filter(province => !filtersActive || province.cities.length > 0),
      }))
      .filter(country => !filtersActive || country.provinces.length > 0);
  }, [normalizedQuery, selectedDistances, selectedCountries, registrationOpenOnly, filtersActive]);

  // Verzamel alle featured races (niet verlopen), ook onderworpen aan de filters
  const featuredRaces = useMemo(() => {
    return filteredCountries
      .flatMap(country => country.provinces.flatMap(p => p.cities.flatMap(c => c.races)))
      .filter(r => r.featured && new Date(r.date) > new Date());
  }, [filteredCountries]);

  const hasAnyResults = filteredCountries.some(country =>
    country.provinces.some(p => p.cities.some(c => c.races.length > 0)),
  );

  function toggleCountry(id: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenCountries(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

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

  function toggleDistanceFilter(value: RaceDistance) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedDistances(prev => {
      const next = new Set(prev);
      next.has(value) ? next.delete(value) : next.add(value);
      return next;
    });
  }

  function toggleCountryFilter(id: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedCountries(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleRegistrationFilter() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setRegistrationOpenOnly(prev => !prev);
  }

  function clearFilters() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSearchQuery('');
    setSelectedDistances(new Set());
    setSelectedCountries(new Set());
    setRegistrationOpenOnly(false);
  }

  // Eén wedstrijd(-groep)-rij renderen; gedeeld tussen aankomende en afgelopen races.
  function renderRaceItem(race: Race) {
    return race.subRaces ? (
      <EventGroupRow
        key={race.id}
        event={race}
        isOpen={openEvents.has(race.id)}
        onToggle={() => toggleEvent(race.id)}
        onSelectSub={handleRacePress}
        isLocked={isRaceLocked}
      />
    ) : (
      <RaceRow
        key={race.id}
        race={race}
        onPress={() => handleRacePress(race)}
        locked={isRaceLocked(race)}
      />
    );
  }

  function handleRacePress(race: Race) {
    // Premium-gating: vergrendelde wedstrijden leiden naar de paywall
    if (isRaceLocked(race)) {
      promptUpgrade(
        'Premium-wedstrijd',
        "Met gratis train je voor de halve marathon. Met premium ontgrendel je alle wedstrijden en schema's, van de 5 km tot de marathon.",
      );
      return;
    }
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
    setPendingRace(race);
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
          <Text style={styles.headerSub}>Land · Provincie · Stad · Wedstrijd</Text>
        </View>
      </View>

      {/* Zoekbalk */}
      <View style={styles.searchBarWrap}>
        <View style={styles.searchBar}>
          <Search size={16} color={colors.textTertiary} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Zoek op wedstrijd, stad of locatie"
            placeholderTextColor={colors.textTertiary}
            returnKeyType="search"
            accessibilityLabel="Zoek een wedstrijd op naam, stad of locatie"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8} accessibilityLabel="Zoekterm wissen">
              <X size={16} color={colors.textTertiary} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filterchips */}
        <View style={styles.filtersSection}>
          <View style={styles.filterGroupHeaderRow}>
            <SlidersHorizontal size={13} color={colors.textTertiary} strokeWidth={2} />
            <Text style={styles.filterGroupHeaderText}>Filters</Text>
            {filtersActive && (
              <TouchableOpacity style={styles.clearFiltersBtn} onPress={clearFilters} hitSlop={8}>
                <RotateCcw size={12} color={colors.brandPrimary} strokeWidth={2} />
                <Text style={styles.clearFiltersText}>Wis filters</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.filterChipsRow}>
            {DISTANCE_FILTERS.map(({ value, label }) => {
              const selected = selectedDistances.has(value);
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.filterChip, selected && styles.filterChipActive]}
                  onPress={() => toggleDistanceFilter(value)}
                  activeOpacity={0.85}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`Filter op afstand ${label}`}
                  accessibilityState={{ checked: selected }}
                >
                  <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.filterChipsRow}>
            {COUNTRIES.map(country => {
              const selected = selectedCountries.has(country.id);
              return (
                <TouchableOpacity
                  key={country.id}
                  style={[styles.filterChip, selected && styles.filterChipActive]}
                  onPress={() => toggleCountryFilter(country.id)}
                  activeOpacity={0.85}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`Filter op land ${country.name}`}
                  accessibilityState={{ checked: selected }}
                >
                  <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>{country.name}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[styles.filterChip, registrationOpenOnly && styles.filterChipActive]}
              onPress={toggleRegistrationFilter}
              activeOpacity={0.85}
              accessibilityRole="checkbox"
              accessibilityLabel="Filter op wedstrijden waar inschrijving open is"
              accessibilityState={{ checked: registrationOpenOnly }}
            >
              <Text style={[styles.filterChipText, registrationOpenOnly && styles.filterChipTextActive]}>
                Inschrijving open
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>

        {/* Featured races, uitgelicht bovenaan */}
        {featuredRaces.length > 0 && (
          <View style={styles.featuredSection}>
            <Text style={styles.featuredSectionLabel}>⭐ Ultiem doel</Text>
            {featuredRaces.map(race => (
              <FeaturedRaceCard
                key={race.id}
                race={race}
                onPress={() => handleRacePress(race)}
                locked={isRaceLocked(race)}
              />
            ))}
          </View>
        )}

        {/* Alle wedstrijden per land / provincie */}
        <Text style={styles.allRacesLabel}>Alle wedstrijden</Text>

        {!hasAnyResults && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              Geen wedstrijden gevonden. Probeer een andere zoekterm of pas de filters aan.
            </Text>
          </View>
        )}

        {filteredCountries.map(country => (
          <View key={country.id} style={styles.countryBlock}>
            {/* Land header */}
            <CountryRow
              country={country}
              isOpen={filtersActive || openCountries.has(country.id)}
              onToggle={() => toggleCountry(country.id)}
            />

            {/* Provincies */}
            {(filtersActive || openCountries.has(country.id)) && (
              <View style={styles.provincesContainer}>
                {country.provinces.map(province => (
                  <View key={province.id} style={styles.provinceBlock}>
                    {/* Provincie header */}
                    <ProvinceRow
                      province={province}
                      isOpen={filtersActive || openProvinces.has(province.id)}
                      onToggle={() => toggleProvince(province.id)}
                    />

                    {/* Steden */}
                    {(filtersActive || openProvinces.has(province.id)) && (
                      <View style={styles.citiesContainer}>
                        {province.cities.map(city => (
                          <View key={city.id} style={styles.cityBlock}>
                            <CityRow
                              city={city}
                              isOpen={filtersActive || openCities.has(city.id)}
                              onToggle={() => toggleCity(city.id)}
                            />

                            {/* Wedstrijden: eerst aankomend, afgelopen races onderaan gegroepeerd */}
                            {(filtersActive || openCities.has(city.id)) && (() => {
                              const now = new Date();
                              const upcomingRaces = city.races.filter(r => new Date(r.date) > now);
                              const pastRaces     = city.races.filter(r => new Date(r.date) <= now);
                              return (
                                <View style={styles.racesContainer}>
                                  {upcomingRaces.map(renderRaceItem)}
                                  {pastRaces.length > 0 && (
                                    <Text style={styles.pastRacesLabel}>Afgelopen</Text>
                                  )}
                                  {pastRaces.map(renderRaceItem)}
                                </View>
                              );
                            })()}
                          </View>
                        ))}
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

      {pendingRace && (
        <ConfirmModal
          race={pendingRace}
          initialComfortableKm={comfortableKm}
          hasAccess={hasAccess}
          onUpgrade={goToPaywall}
          onConfirm={(plan, targetSeconds, chosenComfortableKm) => {
            setComfortableKm(chosenComfortableKm);
            onSelectRace(plan, targetSeconds);
            setPendingRace(null);
          }}
          onCancel={() => setPendingRace(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
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

  // Zoekbalk en filters
  searchBarWrap: {
    paddingHorizontal: spacing[2], paddingTop: spacing[1.5], paddingBottom: spacing[1],
    borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
    gap: spacing[1],
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderDefault,
    paddingHorizontal: spacing[1.5], minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  filtersSection: { gap: spacing[0.5] },
  filterGroupHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing[0.5],
  },
  filterGroupHeaderText: {
    flex: 1,
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.xs,
    color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wide,
  },
  clearFiltersBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clearFiltersText: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.xs, color: colors.brandPrimary,
  },
  filterChipsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1],
  },
  filterChip: {
    paddingHorizontal: spacing[1.5], paddingVertical: spacing[1], minHeight: 34,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface, alignItems: 'center', justifyContent: 'center',
  },
  filterChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  filterChipText: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.xs, color: colors.textSecondary,
  },
  filterChipTextActive: { color: '#fff' },

  list: { padding: spacing[2], gap: spacing[1.5], paddingBottom: spacing[6] },

  emptyState: {
    padding: spacing[3], alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  emptyStateText: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm,
    color: colors.textSecondary, textAlign: 'center', lineHeight: typography.fontSize.sm * 1.55,
  },

  // Land
  countryBlock: { gap: spacing[1] },
  countryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing[2],
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderSubtle,
    ...shadows.sm,
  },
  countryLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] },
  countryIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.brandPrimary + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  countryName: {
    fontFamily: typography.fontFamily.display, fontSize: typography.fontSize.md, color: colors.textPrimary,
  },
  countrySub: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs, color: colors.textSecondary, marginTop: 2,
  },
  provincesContainer: {
    gap: spacing[1], paddingLeft: spacing[1.5],
  },

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
  pastRacesLabel: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.xs,
    color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wide,
    paddingHorizontal: spacing[2], paddingTop: spacing[1.5], paddingBottom: spacing[0.5],
  },
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
    ...StyleSheet.absoluteFill,
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
  modalScroll: { maxHeight: '92%' },
  modalScrollContent: { flexGrow: 1, justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.bgSurface,
    borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'],
    padding: spacing[3], paddingBottom: spacing[5], alignItems: 'center', gap: spacing[1.5],
  },

  // Niveau: hoeveel loop je nu al comfortabel?
  levelBox: {
    width: '100%', backgroundColor: colors.bgCard, borderRadius: radius.xl,
    padding: spacing[2], gap: spacing[1], marginTop: spacing[0.5],
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  levelHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  levelTitle: {
    flex: 1,
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm, color: colors.textPrimary,
  },
  levelSub: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs,
    color: colors.textSecondary, lineHeight: typography.fontSize.xs * 1.55,
  },
  levelChipsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1], marginTop: spacing[0.5],
  },
  levelChip: {
    paddingHorizontal: spacing[1.5], paddingVertical: spacing[1], minHeight: 36,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface, alignItems: 'center', justifyContent: 'center',
  },
  levelChipText: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.xs, color: colors.textSecondary,
  },
  levelChipTextSelected: { color: '#fff' },

  // Doeltijd-invoer (premium)
  targetBox: {
    width: '100%', backgroundColor: colors.bgCard, borderRadius: radius.xl,
    padding: spacing[2], gap: spacing[1], marginTop: spacing[0.5],
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  targetHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  targetTitle: {
    flex: 1,
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm, color: colors.textPrimary,
  },
  targetSub: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs,
    color: colors.textSecondary, lineHeight: typography.fontSize.xs * 1.55,
  },
  targetToggle: {
    flexDirection: 'row', backgroundColor: colors.bgSurface, borderRadius: radius.lg,
    padding: 3, gap: 3, marginTop: spacing[0.5],
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  targetToggleBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 9, borderRadius: radius.md, minHeight: 44,
  },
  targetToggleText: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.xs, color: colors.textSecondary,
  },
  targetToggleTextActive: { color: '#fff' },
  targetInput: {
    backgroundColor: colors.bgSurface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.borderDefault,
    paddingHorizontal: spacing[1.5], minHeight: 44,
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.md,
    color: colors.textPrimary, marginTop: spacing[0.5],
  },
  targetResult: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm,
    marginTop: spacing[0.5],
  },
  targetHint: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs,
    color: palette.warning, lineHeight: typography.fontSize.xs * 1.55,
  },
  targetOptional: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
  },
  targetUpgradeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: 44, borderRadius: radius.lg, borderWidth: 1, marginTop: spacing[0.5],
    paddingHorizontal: spacing[2],
  },
  targetUpgradeText: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm,
  },
  modalClose: { alignSelf: 'flex-end', padding: 4 },
  modalIconBox: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  modalTitle: { fontFamily: typography.fontFamily.sansBold, fontSize: typography.fontSize.xl, color: colors.textPrimary, textAlign: 'center' },
  modalSub: { fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: typography.fontSize.sm * 1.55 },
  modalStats: { width: '100%', backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: spacing[2], gap: spacing[1], marginTop: spacing[0.5] },
  modalStat: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalStatLabel: { fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm, color: colors.textSecondary },
  modalStatValue: { fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm, color: colors.textPrimary, textTransform: 'capitalize' },
  resetNotice: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs,
    color: colors.textSecondary, textAlign: 'center', lineHeight: typography.fontSize.xs * 1.55,
    paddingHorizontal: spacing[1], marginTop: spacing[0.5],
  },
  confirmBtn: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[1], paddingVertical: spacing[1.5], borderRadius: radius.xl, marginTop: spacing[0.5] },
  confirmBtnText: { fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.base, color: '#fff' },
  cancelBtn: { paddingVertical: spacing[1] },
  cancelBtnText: { fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.sm, color: colors.textSecondary },
});
