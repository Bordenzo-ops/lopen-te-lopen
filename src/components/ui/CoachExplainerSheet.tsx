/**
 * CoachExplainerSheet
 *
 * Uitlegscherm "Wat kun je verwachten van je coach?" — vertelt vooraf wat de
 * gesproken/haptische begeleiding tijdens een sessie precies doet, zodat het
 * lopen voorspelbaar aanvoelt in plaats van dat de gebruiker verrast wordt.
 *
 * Elke regel hieronder is herleidbaar naar echt app-gedrag (zie de
 * bronverwijzingen per blok). Niets hier is een belofte die de app niet
 * waarmaakt: de opbouw volgt chronologisch wat iemand tijdens een run
 * meemaakt, van de briefing tot de finish.
 */

import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TouchableWithoutFeedback, ScrollView, Platform,
} from 'react-native';
import { X, Compass, Play, Footprints, Route, PartyPopper, Settings2 } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { typography, spacing, radius, shadows, type ThemeColors } from '../../theme/tokens';
import { useThemeColors } from '../../theme/useTheme';

// ── Inhoud ────────────────────────────────────────────────────────────────────
// Losstaand van de rendercode, zodat de copy later makkelijk bij te werken is.
// Bronnen (bestand → functie/constante) staan als code-commentaar bij elk blok
// zodat elke bewering herleidbaar blijft.

export interface CoachExplainerSection {
  key: string;
  icon: LucideIcon;
  title: string;
  items: string[];
}

/**
 * Intro-zin in de coach-stem van de app: nuchter, bemoedigend, geen
 * uitroeptekens-inflatie — zelfde toon als FIXED_TEXTS.greeting in
 * src/config/voicePhrases.ts ("Hoi! Ik ben je hardloopcoach. Samen gaan we
 * trainen.").
 *
 * De tweede zin legt één keer centraal uit wat wel/niet aan de gesproken
 * begeleiding hangt. Dat stond eerder als "(met spraak aan)" achter veertien
 * losse regels: feitelijk juist, maar het las als kleine lettertjes en het
 * maakte elke regel langer dan de inhoud rechtvaardigde. Eén keer het
 * principe uitleggen is korter én duidelijker — de regels die juist ZONDER
 * geluid werken (de tik per kilometer, de trilling voor een afslag) zeggen
 * dat zelf expliciet, want dat is het uitzonderlijke.
 */
export const COACH_EXPLAINER_INTRO =
  'Hoi, ik ben je hardloopcoach. Dit is wat je van me hoort en voelt tijdens het lopen. ' +
  'Alles wat ik zeg, hoor je alleen als je gesproken begeleiding aan hebt staan — ' +
  'wat je voelt werkt altijd.';

export const COACH_EXPLAINER_SECTIONS: CoachExplainerSection[] = [
  {
    key: 'before',
    icon: Compass,
    title: 'Voor je begint',
    items: [
      // app/session/active.tsx: briefingCard (profile.name, sessionTypeShort/
      // zoneInfo, session.coachTip) — visuele briefing, geen gesproken tekst.
      'Je ziet eerst een korte briefing over deze training: het type, de afstand en een tip.',
      // app/session/active.tsx: routeQuestionCard + routeQuestionLimit,
      // src/config/premiumConfig.ts: FREE_ROUTE_PLANS_PER_WEEK = 3.
      'We vragen of je een route wilt laten uitstippelen. Gratis kun je 3 routes per week plannen, met premium onbeperkt.',
      // app/session/active.tsx: countdown-effect, Haptics.impactAsync (Medium
      // per seconde, Heavy bij "Start").
      'Daarna telt de app af van 3 naar 0, met een tik bij elk telmoment.',
    ],
  },
  {
    key: 'start',
    icon: Play,
    title: 'Bij de start',
    items: [
      // voicePhrases.ts: greetingForSessionStart / GREET_TEXTS (ochtend/
      // middag/avond), meegegeven aan sessionIntroUtterance/
      // intervalIntroUtterance in active.tsx. Alleen met spraak aan.
      'Ik begroet je, afgestemd op het moment van de dag.',
      // voicePhrases.ts: sessionIntroUtterance (INTRO_TEXTS per type + goal_).
      'Ik vertel kort wat voor training dit is en wat de doelafstand is.',
      // voicePhrases.ts: sessionIntroUtterance, zone-zin via hasZone/
      // ZONE_DESCRIPTIONS.
      'Ik noem ook de hartslagzone die bij deze training hoort.',
      // voicePhrases.ts: PEP_TEXTS, sessionIntroUtterance pepVariant-argument;
      // active.tsx: alleen bij session.type === 'long' of isRaceDaySession.
      'Bij een lange duurloop of een wedstrijddag krijg je er nog een korte peptalk bij.',
      // voicePhrases.ts: intervalIntroUtterance / INTRO_INTERVAL_TEXT;
      // active.tsx: vervangt de gewone intro bij isInterval.
      'Bij een intervaltraining leg ik eerst uit hoe de training in elkaar zit — de begeleiding onderweg verloopt dan anders (zie hieronder).',
    ],
  },
  {
    key: 'during',
    icon: Footprints,
    title: 'Onderweg',
    items: [
      // active.tsx: Haptics.notificationAsync(Success) bij elke voltooide km
      // (altijd), useVoiceGuidance.onKmUpdate → kmSplitUtterance (met spraak
      // aan).
      'Bij elke afgelegde kilometer voel je een tik, en hoor je de kilometerstand, je tempo en een aanmoediging.',
      // useVoiceGuidance.ts: halfwayUtterance, getriggerd op 50% van
      // session.distanceKm.
      'Halverwege je doelafstand hoor je dat, met hoeveel kilometer je nog te gaan hebt.',
      // useTechniqueCoaching.ts: alleen bij session.type === 'long', vanaf 15
      // minuten, daarna elke 15 minuten, max. 6 keer.
      'Bij een lange duurloop krijg je af en toe — ongeveer elk kwartier — een korte houdings- of ademhalingstip.',
      // useHeartRateCoaching.ts: alleen met maxHr + doelzone + metingen
      // (dus een gekoppelde hartslagmeter), na 3 min. warming-up, bij
      // aanhoudende afwijking.
      'Heb je een hartslagmeter gekoppeld? Dan stuurt de coach rustig bij als je hartslag een tijdje boven of onder je doelzone zit, en bevestigt hij het zodra je weer in de zone zit.',
      // useIntervalCoaching.ts: cues per segment (aftellen/gaan, laatste 10
      // seconden, herstel, halverwege), alleen bij een intervaltraining —
      // vervangt de kilometermeldingen (active.tsx: onKmUpdate wordt dan
      // overgeslagen).
      'Bij een intervaltraining tel ik je door elke herhaling heen: aftellen, aanzetten, de laatste tien seconden en het herstelmoment. Dat vervangt dan de gewone kilometermeldingen.',
    ],
  },
  {
    key: 'route',
    icon: Route,
    title: 'Als je een route hebt gepland',
    items: [
      // useRouteCoaching.ts: PRE_ANNOUNCE_M = 150, FINAL_ANNOUNCE_M = 30,
      // navUtterance.
      'Rond 150 meter voor een afslag hoor je hem aankomen; vlak ervoor, op zo’n 30 meter, klinkt de afslag zelf nog een keer.',
      // useRouteCoaching.ts: HAPTIC_TRIGGER_M = 50, fireHapticTurnCue —
      // onafhankelijk van voiceEnabled.
      'Rond 50 meter voor de afslag voel je ook een trilling, die werkt ook zonder geluid.',
      // useRouteCoaching.ts: offRouteUtterance / backOnRouteUtterance,
      // justWentOffRoute / justReturnedToRoute.
      'Wijk je te ver van de uitgestippelde route af, dan hoor je dat rustig terug, en een bevestiging zodra je er weer op bent.',
      // useRouteCoaching.ts: MILESTONES [0.25,0.50,0.75] → milestoneUtterance.
      'Op een kwart, de helft en driekwart van je route hoor je hoeveel er nog te gaan is.',
    ],
  },
  {
    key: 'finish',
    icon: PartyPopper,
    title: 'Bij de finish',
    items: [
      // useVoiceGuidance.ts: onFinish → finishUtterance (afstand, tijd,
      // afsluitzin).
      'Aan het eind hoor je hoeveel kilometer je hebt gelopen, in hoeveel tijd, en een felicitatie.',
      // active.tsx: handleStop, isRaceDaySession → raceFinishUtterance i.p.v.
      // de gewone afsluiting.
      'Loop je de laatste training van een wedstrijdschema uit, dan feliciteert de coach je met de wedstrijd zelf.',
    ],
  },
  {
    key: 'settings',
    icon: Settings2,
    title: 'Zelf instellen',
    items: [
      // app/(tabs)/settings.tsx: sectie "Begeleiding tijdens het lopen",
      // Switch profile.voiceGuidance.
      'Gesproken begeleiding kun je helemaal uitzetten in Instellingen, bij "Begeleiding tijdens het lopen".',
      // app/(tabs)/settings.tsx: VOICES-lijst, voiceService.playPreview.
      'Er zijn meerdere stemmen om uit te kiezen; tik op een stem om hem te beluisteren.',
      // app/(tabs)/settings.tsx: sectie "Begeleiding tijdens het lopen",
      // Switch routeNotificationsEnabled ("Afslagen op je horloge").
      'Afslagen kunnen ook als melding naar je horloge gestuurd worden; dat zet je apart aan bij "Afslagen op je horloge".',
      // voiceService.ts: tryPlayPackClips (premium + gedownload pakket →
      // clips) vs. fallbackSpeak (telefoonstem) — geen betaalmuur op de
      // coaching zelf, wel op de stemkwaliteit/offline-gebruik.
      'Zonder premium (of zonder gedownload stempakket) hoor je alle coaching gewoon, via de stem van je telefoon. Met premium en een gedownload stempakket klinkt het natuurlijker, ook offline.',
    ],
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface CoachExplainerSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function CoachExplainerSheet({ visible, onClose }: CoachExplainerSheetProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
        {/* Handle + sluiten */}
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

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Titel + intro in de coach-stem */}
          <View style={styles.header}>
            <Text style={styles.title}>Wat kun je verwachten van je coach?</Text>
            <Text style={styles.intro}>{COACH_EXPLAINER_INTRO}</Text>
          </View>

          {COACH_EXPLAINER_SECTIONS.map(section => {
            const Icon = section.icon;
            return (
              <View key={section.key} style={styles.block}>
                <View style={styles.blockHeader}>
                  <View style={styles.blockIconBox}>
                    <Icon size={16} color={colors.brandPrimary} strokeWidth={2} />
                  </View>
                  <Text style={styles.blockTitle}>{section.title}</Text>
                </View>
                <View style={styles.itemList}>
                  {section.items.map((item, i) => (
                    <View key={i} style={styles.itemRow}>
                      <View style={styles.itemDot} />
                      <Text style={styles.itemText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
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
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
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
  scroll: {
    paddingHorizontal: spacing[3],
    paddingTop: spacing[2],
    paddingBottom: spacing[2],
    gap: spacing[2.5],
  },
  header: { gap: spacing[1] },
  title: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: typography.fontSize.xl,
    color: colors.textPrimary,
  },
  intro: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.base,
    fontStyle: 'italic',
    color: colors.textSecondary,
    lineHeight: typography.fontSize.base * 1.5,
  },
  block: { gap: spacing[1] },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  blockIconBox: {
    width: 28, height: 28,
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary + '1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockTitle: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wider,
  },
  itemList: { gap: spacing[1] },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[1],
  },
  itemDot: {
    width: 6, height: 6,
    borderRadius: 3,
    marginTop: 8,
    flexShrink: 0,
    backgroundColor: colors.brandPrimary,
  },
  itemText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: typography.fontSize.base * 1.55,
  },
});
