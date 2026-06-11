/**
 * SessionTypeSheet
 *
 * Bottom sheet met uitleg over een sessie-type.
 * Verschijnt als de gebruiker op de sessie-titel tikt.
 */

import React from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TouchableWithoutFeedback, ScrollView, Platform,
} from 'react-native';
import { X } from 'lucide-react-native';
import { colors, palette, typography, spacing, radius, shadows } from '../../theme/tokens';
import type { Session } from '../../data/trainingPlans';

// ── Content per sessie-type ───────────────────────────────────────────────────

export const SESSION_TYPE_INFO: Record<Session['type'], {
  label: string;
  emoji: string;
  tagline: string;
  wat: string;
  hoe: string[];
  waarom: string;
  accentColor: string;
}> = {
  easy: {
    label: 'Rustige duurloop',
    emoji: '🐢',
    tagline: 'Het fundament van je training',
    wat: 'Een rustige duurloop is een loop waarbij je comfortabel een gesprek kunt voeren. Het tempo ligt lager dan je denkt dat nodig is, en dat is precies de bedoeling.',
    hoe: [
      'Loop in Zone 2: 61-70% van je maximale hartslag.',
      'Je kunt de hele zin uitspreken zonder te hijgen.',
      'Begin de eerste 5 minuten nog rustiger dan je van plan was.',
      'Tempo maakt niet uit, duur en consistentie wel.',
      'Als je twijfelt: langzamer is bijna altijd beter.',
    ],
    waarom: 'Rustige lopen bouwen je aerobe basis op. Ze trainen je hart, verbeteren vetverbranding en stimuleren herstel. 80% van je kilometers zou op dit tempo moeten zijn, ook al voelt het te makkelijk.',
    accentColor: palette.zone.z2,
  },
  tempo: {
    label: 'Tempoduurloop',
    emoji: '⚡',
    tagline: 'Comfortabel oncomfortabel',
    wat: 'Een tempoduurloop ligt net boven je comfortzone. Je kunt nog een paar woorden zeggen, maar geen volledige zinnen meer. Dit tempo traint je drempelwaarde: het punt waar melkzuur zich gaat opstapelen.',
    hoe: [
      'Loop in Zone 3-4: 71-90% van je maximale hartslag.',
      'Voelt uitdagend, maar niet als een sprint.',
      'Warm 10-15 minuten rustig op voor je het tempo opvoert.',
      'Houd het tempo gelijkmatig en begin niet te snel.',
      'Koel de laatste 5 minuten af met rustig tempo.',
    ],
    waarom: 'Tempolopen verhogen je lactaatdrempel: daarna kun je sneller lopen zonder dat het zuur wordt. Dit vertaalt zich direct naar een betere eindtijd bij je wedstrijd.',
    accentColor: palette.zone.z3,
  },
  long: {
    label: 'Lange duurloop',
    emoji: '🏃',
    tagline: 'De ruggengraat van je week',
    wat: 'De lange duurloop is je langste training van de week. Het doel is niet snelheid, maar tijd op de been. Je leert je lichaam om langdurig energie te leveren en went je gewrichten aan de belasting.',
    hoe: [
      'Loop in Zone 1-2: 50-70% van je maximale hartslag.',
      'Rustig. Echt rustig. Langzamer dan je denkt te moeten.',
      'Neem water mee vanaf 10 km.',
      'Loop-wandel strategie is prima als het te zwaar wordt.',
      'De laatste kilometers mogen aanvoelen als een uitdaging, maar geen pijn.',
    ],
    waarom: 'Lange lopen bouwen uithoudingsvermogen, verbeteren vetverbranding als brandstofbron en bereiden je voor op de wedstrijd. Ze zijn ook mentaal belangrijk: je leert vol te houden als het moeilijk wordt.',
    accentColor: palette.primary[500],
  },
  rest: {
    label: 'Rustdag',
    emoji: '😴',
    tagline: 'Herstel is ook training',
    wat: 'Een rustdag is geen verloren dag, het is een trainingsdag. Je spieren groeien en herstellen niet tijdens het lopen, maar erna. Zonder rust geen verbetering.',
    hoe: [
      'Geen hardlopen vandaag.',
      'Lichte activiteit zoals wandelen of fietsen is prima.',
      'Slaap genoeg, minstens 7-8 uur.',
      'Rekken of yoga kan helpen bij herstel.',
      'Eet voldoende om je lichaam te laten herstellen.',
    ],
    waarom: 'Overtraining is de meest gemaakte fout bij hardlopers. Je lichaam past zich aan in de rustperiode. Sla je rustdagen over, dan loop je het risico op blessures en verminderde prestaties.',
    accentColor: palette.zone.z1,
  },
  cross: {
    label: 'Cross-training',
    emoji: '🚴',
    tagline: 'Conditie zonder slijtage',
    wat: 'Cross-training is beweging die je conditie op peil houdt zonder de impact van hardlopen. Denk aan fietsen, zwemmen, roeien of de crosstrainer: activiteiten die je hart trainen maar je benen sparen.',
    hoe: [
      'Kies een activiteit die je leuk vindt: fiets, zwem, roei.',
      'Houd een vergelijkbare intensiteit als je normale rustige loop.',
      'Duur is belangrijker dan intensiteit.',
      'Dit is ook een goede dag voor krachttraining (romp, billen, benen).',
      'Vermijd zware beenspieren-training de dag voor een lange loop.',
    ],
    waarom: 'Cross-training vermindert de kans op blessures, geeft je loopspieren rust en houdt je conditie op niveau op dagen dat hardlopen te veel zou zijn. Het maakt je ook een completer atleet.',
    accentColor: palette.green[500],
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

interface SessionTypeSheetProps {
  sessionType: Session['type'] | null;
  onClose: () => void;
}

export function SessionTypeSheet({ sessionType, onClose }: SessionTypeSheetProps) {
  if (!sessionType) return null;
  const info = SESSION_TYPE_INFO[sessionType];
  const accent = info.accentColor;

  return (
    <Modal
      visible={!!sessionType}
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
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={12}>
            <X size={20} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Hero */}
          <View style={styles.hero}>
            <View style={[styles.emojiBox, { backgroundColor: accent + '22' }]}>
              <Text style={styles.emoji}>{info.emoji}</Text>
            </View>
            <View style={styles.heroText}>
              <Text style={[styles.label, { color: accent }]}>{info.label}</Text>
              <Text style={styles.tagline}>{info.tagline}</Text>
            </View>
          </View>

          {/* Wat */}
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Wat is het?</Text>
            <Text style={styles.bodyText}>{info.wat}</Text>
          </View>

          {/* Hoe */}
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Hoe doe je het?</Text>
            <View style={styles.tipList}>
              {info.hoe.map((tip, i) => (
                <View key={i} style={styles.tipRow}>
                  <View style={[styles.tipDot, { backgroundColor: accent }]} />
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Waarom */}
          <View style={[styles.whyBox, { borderColor: accent + '44', backgroundColor: accent + '0D' }]}>
            <Text style={[styles.whyTitle, { color: accent }]}>Waarom dit type training?</Text>
            <Text style={styles.whyText}>{info.waarom}</Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
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
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  emojiBox: {
    width: 64, height: 64,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 32 },
  heroText: { flex: 1, gap: 4 },
  label: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: typography.fontSize.xl,
  },
  tagline: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  block: { gap: spacing[1] },
  blockTitle: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.widest,
  },
  bodyText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    lineHeight: typography.fontSize.base * 1.6,
  },
  tipList: { gap: spacing[1] },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[1],
  },
  tipDot: {
    width: 6, height: 6,
    borderRadius: 3,
    marginTop: 8,
    flexShrink: 0,
  },
  tipText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: typography.fontSize.base * 1.55,
  },
  whyBox: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing[2],
    gap: spacing[1],
  },
  whyTitle: {
    fontFamily: typography.fontFamily.sansSemi,
    fontSize: typography.fontSize.sm,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wider,
  },
  whyText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    lineHeight: typography.fontSize.base * 1.6,
  },
});
