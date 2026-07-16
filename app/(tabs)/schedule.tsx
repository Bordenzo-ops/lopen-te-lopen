import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronDown, ChevronRight, CalendarDays, Pencil, Check, Trash2, Plus } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { typography, spacing, radius, type ThemeColors } from '../../src/theme/tokens';
import { useThemeColors } from '../../src/theme/useTheme';
import { useAppStore, selectIsSessionCompleted, selectCurrentWeek } from '../../src/store/appStore';
import { getTrainingPlan, zoneInfo, remapWeekDays, DEFAULT_TRAINING_DAYS } from '../../src/data/trainingPlans';
import type { Session } from '../../src/data/trainingPlans';
import { resolveActivePlan } from '../../src/data/activePlan';
import { DayPicker } from '../../src/components/ui/DayPicker';
import { SessionEditorSheet } from '../../src/components/ui/SessionEditorSheet';
import { weeksUntilLabel } from '../../src/data/rotterdamRaces';
import { Dumbbell, Trophy } from 'lucide-react-native';
import { useRacePace } from '../../src/hooks/useRacePace';
import { formatPacePerKm } from '../../src/data/paceModel';
import { PressableScale } from '../../src/components/motion/PressableScale';
import { ScaleIn } from '../../src/components/motion/ScaleIn';

// Zachte fade + korte slide (8px) voor het uit-/inklappen van een weekblok.
// `.reduceMotion` zorgt dat de systeeminstelling voor verminderde beweging
// automatisch gerespecteerd wordt (dan verschijnt/verdwijnt de lijst direct).
const sessionListEntering = FadeIn.duration(260)
  .withInitialValues({ opacity: 0, transform: [{ translateY: -8 }] })
  .reduceMotion(ReduceMotion.System);
const sessionListExiting = FadeOut.duration(180).reduceMotion(ReduceMotion.System);

const dayLabel = ['', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

export default function ScheduleScreen() {
  const profile = useAppStore(s => s.profile);
  const currentWeek = useAppStore(selectCurrentWeek);
  const completedSessions = useAppStore(s => s.completedSessions);
  const skippedSessions = useAppStore(s => s.skippedSessions);
  const racePlan = useAppStore(s => s.racePlan);
  const customPlan = useAppStore(s => s.customPlan);
  const schemaMode = useAppStore(s => s.schemaMode);
  const setSchemaMode = useAppStore(s => s.setSchemaMode);
  const updateProfile = useAppStore(s => s.updateProfile);
  const initCustomPlan = useAppStore(s => s.initCustomPlan);
  const addCustomWeek = useAppStore(s => s.addCustomWeek);
  const removeCustomWeek = useAppStore(s => s.removeCustomWeek);
  const addCustomSession = useAppStore(s => s.addCustomSession);
  const updateCustomSession = useAppStore(s => s.updateCustomSession);
  const removeCustomSession = useAppStore(s => s.removeCustomSession);
  const clearCustomPlan = useAppStore(s => s.clearCustomPlan);
  const { paceForType } = useRacePace();
  const [expandedWeek, setExpandedWeek] = useState<number>(currentWeek);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [draftDays, setDraftDays] = useState<number[] | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editorState, setEditorState] = useState<{ weekNumber: number; session: Session | null } | null>(null);
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (!profile) return null;

  const trainingDays = profile.trainingDays ?? DEFAULT_TRAINING_DAYS;
  // Tijdens het bewerken volgen we een lokale concept-selectie, zodat de
  // gebruiker dagen kan wegklikken voordat er weer 3 gekozen zijn. Pas bij
  // precies 3 dagen slaan we de wijziging op in het profiel.
  const pickerDays = draftDays ?? trainingDays;

  const fallbackPlan = getTrainingPlan(profile.goal);
  const activePlan = resolveActivePlan({ schemaMode, racePlan, customPlan, goal: profile.goal });
  const useRace = activePlan.isRace;
  const isCustom = activePlan.isCustom;
  // Zet de sessies op de zelfgekozen trainingsdagen — maar alleen voor het
  // sjabloon-plan (training zonder customPlan) en het wedstrijdschema, exact
  // zoals voorheen. Een eigen vrij schema kiest de dag per sessie zelf, dus
  // daar remappen we niets: dat zou de bewuste keuze van de gebruiker
  // overschrijven. Muteert het schema niet.
  const planWeeks = isCustom
    ? activePlan.weeks
    : activePlan.weeks.map(w => remapWeekDays(w, trainingDays));
  const planName  = activePlan.name;
  const planTotal = activePlan.totalWeeks;
  const weeksLeftLabel = useRace && racePlan ? weeksUntilLabel(racePlan.race.date) : null;

  // Bewerkmodus is alleen zinvol met een actief vrij schema; verlaat hem
  // automatisch zodra dat niet meer zo is (schema gewist of van modus gewisseld).
  useEffect(() => {
    if (!isCustom && editMode) setEditMode(false);
  }, [isCustom, editMode]);

  const handleDeleteSession = (weekNumber: number, session: Session) => {
    Alert.alert(
      'Sessie verwijderen',
      `Weet je zeker dat je "${session.description}" wilt verwijderen?`,
      [
        { text: 'Annuleren', style: 'cancel' },
        { text: 'Verwijderen', style: 'destructive', onPress: () => removeCustomSession(weekNumber, session.id) },
      ],
    );
  };

  const handleDeleteWeek = (weekNumber: number) => {
    Alert.alert(
      'Week verwijderen',
      `Weet je zeker dat je week ${weekNumber} wilt verwijderen? De overige weken schuiven op.`,
      [
        { text: 'Annuleren', style: 'cancel' },
        { text: 'Verwijderen', style: 'destructive', onPress: () => removeCustomWeek(weekNumber) },
      ],
    );
  };

  const handleClearPlan = () => {
    Alert.alert(
      'Schema wissen',
      'Je eigen schema wordt gewist en je valt terug op het standaardschema. Dit kan niet ongedaan worden gemaakt.',
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Wissen',
          style: 'destructive',
          onPress: () => { clearCustomPlan(); setEditMode(false); },
        },
      ],
    );
  };

  const handleSaveSession = (session: Session | Omit<Session, 'id'>) => {
    if (!editorState) return;
    if ('id' in session) {
      updateCustomSession(editorState.weekNumber, session);
    } else {
      addCustomSession(editorState.weekNumber, session);
    }
    setEditorState(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Schema</Text>

        {/* Toggle trainingsschema / wedstrijdschema */}
        <View style={styles.modeToggle}>
          <PressableScale
            style={[styles.modeBtn, schemaMode === 'training' && styles.modeBtnActive]}
            onPress={() => setSchemaMode('training')}
            accessibilityRole="button"
            accessibilityLabel="Vrij schema"
            accessibilityState={{ selected: schemaMode === 'training' }}
          >
            <Dumbbell size={13} color={schemaMode === 'training' ? '#fff' : colors.textSecondary} strokeWidth={2} />
            <Text style={[styles.modeBtnLabel, schemaMode === 'training' && styles.modeBtnLabelActive]}>
              Vrij schema
            </Text>
          </PressableScale>
          <PressableScale
            style={[styles.modeBtn, schemaMode === 'race' && styles.modeBtnActive]}
            onPress={() => setSchemaMode('race')}
            accessibilityRole="button"
            accessibilityLabel="Wedstrijdschema"
            accessibilityState={{ selected: schemaMode === 'race' }}
          >
            <Trophy size={13} color={schemaMode === 'race' ? '#fff' : colors.textSecondary} strokeWidth={2} />
            <Text style={[styles.modeBtnLabel, schemaMode === 'race' && styles.modeBtnLabelActive]}>
              Wedstrijdschema
            </Text>
          </PressableScale>
        </View>

        {/* Sub-info */}
        {useRace ? (
          <View style={styles.raceInfo}>
            <Text style={styles.raceInfoName}>{planName}</Text>
            <Text style={styles.raceInfoMeta}>
              🏁 {racePlan ? new Date(racePlan.race.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
              {'  ·  '}{weeksLeftLabel} · {planTotal}-wekenschema
            </Text>
          </View>
        ) : isCustom ? (
          <View style={styles.customHeaderRow}>
            <Text style={styles.sub}>{planName} · {planTotal} weken</Text>
            <PressableScale
              onPress={() => setEditMode(v => !v)}
              style={styles.editToggleBtn}
              accessibilityRole="button"
              accessibilityLabel={editMode ? 'Klaar met bewerken' : 'Schema bewerken'}
              accessibilityState={{ selected: editMode }}
            >
              {/* key wisselt bij het togglen: laat ScaleIn opnieuw mounten
                  voor een klein cross-fade/scale-momentje tussen potlood en vinkje. */}
              <ScaleIn key={editMode ? 'done' : 'edit'} style={styles.editToggleContent} fromScale={0.8}>
                {editMode
                  ? <Check size={15} color={colors.success} strokeWidth={2.5} />
                  : <Pencil size={15} color={colors.brandPrimary} strokeWidth={2} />
                }
                <Text style={[styles.editToggleText, editMode && styles.editToggleTextDone]}>
                  {editMode ? 'Klaar' : 'Bewerk'}
                </Text>
              </ScaleIn>
            </PressableScale>
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

        {/* Nog geen eigen vrij schema: bied aan het sjabloon over te nemen of
            helemaal opnieuw te beginnen. Het sjabloon-plan blijft ondertussen
            gewoon zichtbaar en bruikbaar hieronder. */}
        {schemaMode === 'training' && !isCustom && (
          <View style={styles.noRaceBox}>
            <View style={styles.noRaceRow}>
              <Pencil size={14} color={colors.brandPrimary} strokeWidth={2} />
              <Text style={styles.noRaceText}>
                Maak er jouw schema van: pas het sjabloon aan of begin helemaal opnieuw.
              </Text>
            </View>
            <View style={styles.customCtaRow}>
              <TouchableOpacity
                style={[styles.noRaceBtn, styles.customCtaBtnFull]}
                onPress={() => initCustomPlan('template')}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Start met ${fallbackPlan.name} als basis`}
              >
                <Text style={styles.noRaceBtnText} numberOfLines={2}>
                  Start met {fallbackPlan.name} als basis
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.customCtaSecondaryBtn}
                onPress={() => initCustomPlan('empty')}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Begin met een leeg schema"
              >
                <Text style={styles.customCtaSecondaryBtnText} numberOfLines={2}>
                  Begin met een leeg schema
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Trainingsdagen aanpassen: bij een eigen vrij schema kies je de dag
            per sessie, dus is deze sectie dan niet relevant. */}
        {!isCustom && (
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
        )}

        {!isCustom && showDayPicker && (
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
                  <View style={styles.weekKmBlock}>
                    <Text style={styles.weekKm} numberOfLines={1}>{week.totalKm} km</Text>
                    <Text style={styles.weekKmLabel} numberOfLines={1}>totaal</Text>
                  </View>
                  {isCustom && editMode && (
                    <TouchableOpacity
                      onPress={() => handleDeleteWeek(week.weekNumber)}
                      hitSlop={8}
                      style={styles.weekDeleteBtn}
                      accessibilityRole="button"
                      accessibilityLabel={`Week ${week.weekNumber} verwijderen`}
                    >
                      <Trash2 size={16} color={colors.error} strokeWidth={2} />
                    </TouchableOpacity>
                  )}
                  {isExpanded
                    ? <ChevronDown size={18} color={colors.textSecondary} strokeWidth={2} />
                    : <ChevronRight size={18} color={colors.textSecondary} strokeWidth={2} />
                  }
                </View>
              </TouchableOpacity>

              {isExpanded && (
                <Animated.View
                  entering={sessionListEntering}
                  exiting={sessionListExiting}
                  style={styles.sessionList}
                >
                  {week.sessions.map(session => {
                    const isCompleted = completedSessions.some(c => c.sessionId === session.id);
                    const isSkipped = skippedSessions.some(sk => sk.sessionId === session.id);
                    const isHandled = isCompleted || isSkipped;
                    const pace = paceForType(session.type);
                    const canEditRow = isCustom && editMode;
                    return (
                      <TouchableOpacity
                        key={session.id}
                        activeOpacity={canEditRow ? 0.7 : 1}
                        disabled={!canEditRow}
                        onPress={() => setEditorState({ weekNumber: week.weekNumber, session })}
                        style={[styles.sessionRow, isHandled && !canEditRow && styles.sessionRowDone]}
                        accessibilityRole={canEditRow ? 'button' : undefined}
                        accessibilityLabel={canEditRow ? `${session.description} bewerken` : undefined}
                      >
                        <View style={[styles.sessionDot, { backgroundColor: zoneInfo[session.zone].color }, isHandled && !canEditRow && styles.sessionDotDone]} />
                        <Text style={styles.sessionDay}>{dayLabel[session.day]}</Text>
                        <Text style={[styles.sessionDesc, isHandled && !canEditRow && styles.textMuted]} numberOfLines={1}>
                          {session.description}
                        </Text>
                        {/* Persoonlijk trainingstempo naast de afstand (premium + doeltijd) */}
                        {!canEditRow && pace != null && pace > 0 && !isSkipped && (
                          <Text style={styles.sessionPace}>{formatPacePerKm(pace)}</Text>
                        )}
                        {!canEditRow && isSkipped ? (
                          <Text style={styles.skippedMark}>overgeslagen</Text>
                        ) : (
                          <Text style={styles.sessionKm}>{session.distanceKm} km</Text>
                        )}
                        {!canEditRow && isCompleted && <Text style={styles.checkmark}>✓</Text>}
                        {canEditRow && (
                          <TouchableOpacity
                            onPress={() => handleDeleteSession(week.weekNumber, session)}
                            hitSlop={8}
                            style={styles.sessionDeleteBtn}
                            accessibilityRole="button"
                            accessibilityLabel={`${session.description} verwijderen`}
                          >
                            <Trash2 size={15} color={colors.error} strokeWidth={2} />
                          </TouchableOpacity>
                        )}
                      </TouchableOpacity>
                    );
                  })}

                  {isCustom && editMode && (
                    <TouchableOpacity
                      onPress={() => setEditorState({ weekNumber: week.weekNumber, session: null })}
                      style={styles.addSessionRow}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Sessie toevoegen"
                    >
                      <Plus size={16} color={colors.brandPrimary} strokeWidth={2.5} />
                      <Text style={styles.addSessionText}>Sessie toevoegen</Text>
                    </TouchableOpacity>
                  )}
                </Animated.View>
              )}
            </View>
          );
        }}
        ListFooterComponent={
          isCustom && editMode ? (
            <View style={styles.customFooter}>
              <TouchableOpacity
                onPress={addCustomWeek}
                style={styles.addWeekBtn}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Week toevoegen"
              >
                <Plus size={16} color={colors.brandPrimary} strokeWidth={2.5} />
                <Text style={styles.addWeekText}>Week toevoegen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleClearPlan}
                style={styles.clearPlanBtn}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Schema wissen"
              >
                <Text style={styles.clearPlanText}>Schema wissen</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />

      <SessionEditorSheet
        visible={!!editorState}
        initialSession={editorState?.session ?? null}
        onClose={() => setEditorState(null)}
        onSave={handleSaveSession}
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
  customHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 6,
  },
  editToggleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    minHeight: 36, paddingHorizontal: spacing[1.5],
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.brandPrimary + '44',
    backgroundColor: colors.brandPrimary + '11',
  },
  editToggleContent: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  editToggleText: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.xs,
    color: colors.brandPrimary,
  },
  editToggleTextDone: { color: colors.success },
  customCtaRow: { gap: spacing[1] },
  customCtaBtnFull: { alignSelf: 'stretch' },
  customCtaSecondaryBtn: {
    minHeight: 44, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing[2], borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.brandPrimary + '55',
    alignSelf: 'stretch',
  },
  customCtaSecondaryBtnText: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm, color: colors.brandPrimary,
  },
  weekDeleteBtn: { padding: 4 },
  sessionDeleteBtn: { padding: 4, marginLeft: 2 },
  addSessionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: spacing[1], minHeight: 40,
  },
  addSessionText: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm,
    color: colors.brandPrimary,
  },
  customFooter: { gap: spacing[1.5], paddingTop: spacing[1], alignItems: 'center' },
  addWeekBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: 44, width: '100%',
    borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.brandPrimary + '55',
    borderStyle: 'dashed',
  },
  addWeekText: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm,
    color: colors.brandPrimary,
  },
  clearPlanBtn: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[2] },
  clearPlanText: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.xs,
    color: colors.textTertiary, textDecorationLine: 'underline',
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
  weekKmBlock: { alignItems: 'flex-end' },
  weekKm: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.sm, color: colors.textSecondary,
  },
  weekKmLabel: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs, color: colors.textSecondary,
    opacity: 0.7, marginTop: -1,
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
