import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronDown, ChevronRight, CalendarDays } from 'lucide-react-native';
import { typography, spacing, radius, type ThemeColors } from '../../src/theme/tokens';
import { useThemeColors } from '../../src/theme/useTheme';
import { useAppStore, selectIsSessionCompleted } from '../../src/store/appStore';
import { getTrainingPlan, zoneInfo, remapWeekDays, DEFAULT_TRAINING_DAYS } from '../../src/data/trainingPlans';
import { DayPicker } from '../../src/components/ui/DayPicker';
import { weeksUntilRace } from '../../src/data/rotterdamRaces';
import { Dumbbell, Trophy } from 'lucide-react-native';
import { useRacePace } from '../../src/hooks/useRacePace';
import { formatPacePerKm } from '../../src/data/paceModel';

const dayLabel = ['', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

export default function ScheduleScreen() {
  const profile = useAppStore(s => s.profile);
  const currentWeek = useAppStore(s => s.currentWeek);
  const completedSessions = useAppStore(s => s.completedSessions);
  const skippedSessions = useAppStore(s => s.skippedSessions);
  const racePlan = useAppStore(s => s.racePlan);
  const schemaMode = useAppStore(s => s.schemaMode);
  const setSchemaMode = useAppStore(s => s.setSchemaMode);
  const updateProfile = useAppStore(s => s.updateProfile);
  const { paceForType } = useRacePace();
  const [expandedWeek, setExpandedWeek] = useState<number>(currentWeek);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [draftDays, setDraftDays] = useState<number[] | null>(null);
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (!profile) return null;

  const trainingDays = profile.trainingDays ?? DEFAULT_TRAINING_DAYS;
  // Tijdens het bewerken volgen we een lokale concept-selectie, zodat de
  // gebruiker dagen kan wegklikken voordat er weer 3 gekozen zijn. Pas bij
  // precies 3 dagen slaan we de wijziging op in het profiel.
  const pickerDays = draftDays ?? trainingDays;

  const fallbackPlan = getTrainingPlan(profile.goal);
  const useRace = schemaMode === 'race' && !!racePlan;
  // Zet de sessies op de zelfgekozen trainingsdagen. Muteert het schema niet.
  const planWeeks = (useRace ? racePlan!.weeks : fallbackPlan.plan).map(w =>
    remapWeekDays(w, trainingDays),
  );
  const planName  = useRace ? racePlan!.race.name : fallbackPlan.name;
  const planTotal = useRace ? racePlan!.totalWeeks : fallbackPlan.weeks;
  const weeksLeft = useRace ? weeksUntilRace(racePlan!.race.date) : null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Schema</Text>

        {/* Toggle trainingsschema / wedstrijdschema */}
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, schemaMode === 'training' && styles.modeBtnActive]}
            onPress={() => setSchemaMode('training')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Trainingsschema"
            accessibilityState={{ selected: schemaMode === 'training' }}
          >
            <Dumbbell size={13} color={schemaMode === 'training' ? '#fff' : colors.textSecondary} strokeWidth={2} />
            <Text style={[styles.modeBtnLabel, schemaMode === 'training' && styles.modeBtnLabelActive]}>
              Trainingsschema
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, schemaMode === 'race' && styles.modeBtnActive]}
            onPress={() => setSchemaMode('race')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Wedstrijdschema"
            accessibilityState={{ selected: schemaMode === 'race' }}
          >
            <Trophy size={13} color={schemaMode === 'race' ? '#fff' : colors.textSecondary} strokeWidth={2} />
            <Text style={[styles.modeBtnLabel, schemaMode === 'race' && styles.modeBtnLabelActive]}>
              Wedstrijdschema
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sub-info */}
        {useRace ? (
          <View style={styles.raceInfo}>
            <Text style={styles.raceInfoName}>{planName}</Text>
            <Text style={styles.raceInfoMeta}>
              🏁 {new Date(racePlan!.race.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
              {'  ·  '}{weeksLeft} weken te gaan · {planTotal}-wekenschema
            </Text>
          </View>
        ) : (
          <Text style={styles.sub}>{planName} · {planTotal} weken</Text>
        )}

        {/* Geen race gekozen melding */}
        {schemaMode === 'race' && !racePlan && (
          <View style={styles.noRaceBox}>
            <View style={styles.noRaceRow}>
              <Trophy size={14} color={colors.brandPrimary} strokeWidth={2} />
              <Text style={styles.noRaceText}>
                Je hebt nog geen wedstrijd gekozen. Kies er een en je krijgt een schema op maat.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.noRaceBtn}
              onPress={() => router.push('/(tabs)/races')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Kies een wedstrijd"
            >
              <Text style={styles.noRaceBtnText}>Kies een wedstrijd</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Trainingsdagen aanpassen */}
        <TouchableOpacity
          style={styles.daysToggle}
          onPress={() => setShowDayPicker(v => !v)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Trainingsdagen aanpassen"
          accessibilityState={{ expanded: showDayPicker }}
        >
          <CalendarDays size={14} color={colors.brandPrimary} strokeWidth={2} />
          <Text style={styles.daysToggleText}>
            Trainingsdagen: {trainingDays.slice().sort((a, b) => a - b).map(d => dayLabel[d]).join(', ')}
          </Text>
          {showDayPicker
            ? <ChevronDown size={16} color={colors.textSecondary} strokeWidth={2} />
            : <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2} />
          }
        </TouchableOpacity>

        {showDayPicker && (
          <View style={styles.daysPickerBox}>
            <DayPicker
              value={pickerDays}
              onChange={(days) => {
                setDraftDays(days);
                // Bewaar pas zodra er precies 3 dagen gekozen zijn.
                if (days.length === 3) {
                  updateProfile({ trainingDays: days });
                  setDraftDays(null);
                }
              }}
              required={3}
            />
            <Text style={styles.daysPickerNote}>
              De lange duurloop komt op je laatste trainingsdag.
            </Text>
          </View>
        )}
      </View>

      {/* Zone legenda */}
      <View style={styles.zoneLegend}>
        {(Object.keys(zoneInfo) as Array<keyof typeof zoneInfo>).map(zone => (
          <View key={zone} style={styles.zoneLegendItem}>
            <View style={[styles.zoneDot, { backgroundColor: zoneInfo[zone].color }]} />
            <Text style={[styles.zoneLegendLabel, { color: zoneInfo[zone].color }]}>
              {zoneInfo[zone].label}
            </Text>
          </View>
        ))}
      </View>

      <FlatList
        data={planWeeks}
        keyExtractor={item => String(item.weekNumber)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: week }) => {
          const isExpanded = expandedWeek === week.weekNumber;
          const isCurrent = week.weekNumber === currentWeek;
          const isPast = week.weekNumber < currentWeek;
          const weekSessionIds = week.sessions.map(s => s.id);
          const completedCount = weekSessionIds.filter(
            id => completedSessions.some(c => c.sessionId === id),
          ).length;
          // Een week telt als afgehandeld zodra elke sessie voltooid of bewust
          // overgeslagen is, zodat een overgeslagen training de week niet open laat.
          const handledCount = weekSessionIds.filter(
            id =>
              completedSessions.some(c => c.sessionId === id) ||
              skippedSessions.some(sk => sk.sessionId === id),
          ).length;
          const allDone = handledCount === week.sessions.length;

          return (
            <View style={[styles.weekBlock, isCurrent && styles.weekBlockCurrent, allDone && styles.weekBlockDone]}>
              <TouchableOpacity
                onPress={() => setExpandedWeek(isExpanded ? 0 : week.weekNumber)}
                activeOpacity={0.75}
                style={styles.weekHeader}
              >
                <View style={styles.weekHeaderLeft}>
                  <View style={[styles.weekNumberBadge, isCurrent && styles.weekNumberBadgeActive, allDone && styles.weekNumberBadgeDone]}>
                    <Text style={[styles.weekNumber, (isCurrent || allDone) && styles.weekNumberLight]}>
                      {week.weekNumber}
                    </Text>
                  </View>
                  <View>
                    <Text style={[styles.weekTitle, isPast && !isCurrent && styles.textMuted]}>
                      Week {week.weekNumber}
                      {isCurrent && <Text style={styles.currentTag}> · Nu</Text>}
                    </Text>
                    <Text style={styles.weekFocus}>{week.focus}</Text>
                  </View>
                </View>
                <View style={styles.weekHeaderRight}>
                  <Text style={styles.weekKm}>{week.totalKm} km</Text>
                  {isExpanded
                    ? <ChevronDown size={18} color={colors.textSecondary} strokeWidth={2} />
                    : <ChevronRight size={18} color={colors.textSecondary} strokeWidth={2} />
                  }
                </View>
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.sessionList}>
                  {week.sessions.map(session => {
                    const isCompleted = completedSessions.some(c => c.sessionId === session.id);
                    const isSkipped = skippedSessions.some(sk => sk.sessionId === session.id);
                    const isHandled = isCompleted || isSkipped;
                    const pace = paceForType(session.type);
                    return (
                      <View key={session.id} style={[styles.sessionRow, isHandled && styles.sessionRowDone]}>
                        <View style={[styles.sessionDot, { backgroundColor: zoneInfo[session.zone].color }, isHandled && styles.sessionDotDone]} />
                        <Text style={styles.sessionDay}>{dayLabel[session.day]}</Text>
                        <Text style={[styles.sessionDesc, isHandled && styles.textMuted]} numberOfLines={1}>
                          {session.description}
                        </Text>
                        {/* Persoonlijk trainingstempo naast de afstand (premium + doeltijd) */}
                        {pace != null && pace > 0 && !isSkipped && (
                          <Text style={styles.sessionPace}>{formatPacePerKm(pace)}</Text>
                        )}
                        {isSkipped
                          ? <Text style={styles.skippedMark}>overgeslagen</Text>
                          : <Text style={styles.sessionKm}>{session.distanceKm} km</Text>
                        }
                        {isCompleted && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  header: { paddingHorizontal: spacing[3], paddingTop: spacing[2], paddingBottom: spacing[1] },
  title: {
    fontFamily: typography.fontFamily.display, fontSize: typography.fontSize['2xl'],
    color: colors.textPrimary, letterSpacing: typography.letterSpacing.tight,
  },
  sub: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm,
    color: colors.textSecondary, marginTop: 4,
  },
  raceDate: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.sm,
    color: colors.brandPrimary, marginTop: 3,
  },
  modeToggle: {
    flexDirection: 'row', backgroundColor: colors.bgCard,
    borderRadius: radius.xl, padding: 3,
    borderWidth: 1, borderColor: colors.borderSubtle,
    marginTop: spacing[1], gap: 3,
  },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 8, borderRadius: radius.lg, minHeight: 44,
  },
  modeBtnActive: { backgroundColor: colors.brandPrimary },
  modeBtnLabel: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  modeBtnLabelActive: { color: '#fff' },
  raceInfo: { marginTop: 6, gap: 2 },
  raceInfoName: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm, color: colors.textPrimary,
  },
  raceInfoMeta: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs, color: colors.textSecondary,
  },
  noRaceBox: {
    backgroundColor: colors.brandPrimary + '11', borderRadius: radius.lg,
    padding: spacing[1.5], borderWidth: 1, borderColor: colors.brandPrimary + '33',
    marginTop: 6, gap: spacing[1],
  },
  noRaceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noRaceText: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs,
    color: colors.textSecondary, flex: 1,
  },
  noRaceBtn: {
    backgroundColor: colors.brandPrimary, borderRadius: radius.md,
    minHeight: 44, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing[2], alignSelf: 'flex-start',
  },
  noRaceBtnText: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm, color: '#fff',
  },
  daysToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: spacing[1], minHeight: 44,
    paddingHorizontal: spacing[1.5],
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  daysToggleText: {
    flex: 1,
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  daysPickerBox: {
    marginTop: spacing[1], padding: spacing[1.5], gap: spacing[1],
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  daysPickerNote: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
  },
  zoneLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    gap: spacing[1],
  },
  zoneLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  zoneDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  zoneLegendLabel: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize: typography.fontSize.xs,
  },
  list: { paddingHorizontal: spacing[3], paddingBottom: spacing[6], paddingTop: spacing[1], gap: spacing[1] },
  weekBlock: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderSubtle, overflow: 'hidden',
  },
  weekBlockCurrent: { borderColor: colors.brandPrimary + '55' },
  weekBlockDone: { opacity: 0.6 },
  weekHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing[2],
  },
  weekHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] },
  weekHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weekNumberBadge: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.bgSurface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.borderDefault,
  },
  weekNumberBadgeActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  weekNumberBadgeDone: { backgroundColor: colors.success + '33', borderColor: colors.success + '44' },
  weekNumber: {
    fontFamily: typography.fontFamily.sansBold, fontSize: typography.fontSize.sm, color: colors.textSecondary,
  },
  weekNumberLight: { color: '#fff' },
  weekTitle: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.base, color: colors.textPrimary,
  },
  currentTag: { color: colors.brandPrimary },
  weekFocus: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs,
    color: colors.textSecondary, marginTop: 2,
  },
  weekKm: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.sm, color: colors.textSecondary,
  },
  sessionList: {
    borderTopWidth: 1, borderTopColor: colors.borderSubtle,
    paddingHorizontal: spacing[2], paddingVertical: spacing[1], gap: spacing[1],
  },
  sessionRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    paddingVertical: 6,
  },
  sessionRowDone: { opacity: 0.55 },
  sessionDot: { width: 8, height: 8, borderRadius: 4 },
  sessionDotDone: { opacity: 0.5 },
  sessionDay: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.sm,
    color: colors.textSecondary, width: 28,
  },
  sessionDesc: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm,
    color: colors.textPrimary, flex: 1,
  },
  sessionKm: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm, color: colors.textSecondary,
  },
  sessionPace: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.xs,
    color: colors.brandLight,
  },
  checkmark: { color: colors.success, fontSize: 14, fontFamily: typography.fontFamily.sansBold },
  skippedMark: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.xs,
    color: colors.textTertiary, fontStyle: 'italic',
  },
  textMuted: { color: colors.textTertiary },
});
