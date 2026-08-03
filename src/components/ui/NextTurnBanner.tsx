/**
 * NextTurnBanner
 *
 * Eén-oogopslag-afslagbalk voor het actieve sessie-scherm. Een hardloper
 * kijkt tijdens het lopen niet naar de kaart — hij hijgt, kijkt naar de weg,
 * heeft geen tijd om een kaartje met stippellijn te interpreteren. Deze balk
 * vervangt dat kijken door één regel die in een halve seconde te lezen is:
 * pijl, afstand, straatnaam.
 *
 * Puur weergave, geen eigen logica of throttling: alle afstandsberekening en
 * update-throttling gebeurt al in useRouteCoaching (zie de toelichting daar,
 * met name de "UI-snapshot"-sectie) — deze component rendert simpelweg wat
 * die hook op enig moment teruggeeft.
 *
 * Off-route heeft altijd voorrang op de eerstvolgende afslag: staat de loper
 * niet meer op de route, dan klopt "over 100 meter linksaf" toch niet meer
 * (hij staat er niet meer "voor") — dan is die informatie zinloos of zelfs
 * misleidend, dus tonen we in plaats daarvan een rustige terug-naar-de-route
 * melding.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  CornerUpLeft,
  CornerUpRight,
  ArrowUpLeft,
  ArrowUpRight,
  ArrowUp,
  RotateCcw,
  Flag,
  Navigation,
  MapPinOff,
} from 'lucide-react-native';
import { typography, spacing, radius, shadows, type ThemeColors } from '../../theme/tokens';
import { useThemeColors } from '../../theme/useTheme';
import type { NextTurn, TurnKind } from '../../hooks/useRouteCoaching';

interface NextTurnBannerProps {
  /** Eerstvolgende afslag, of null als er geen route (meer) is of geen volgende afslag. */
  nextTurn: NextTurn | null;
  /** Loopt de gebruiker van de route af? Heeft voorrang op nextTurn — zie boven. */
  isOffRoute: boolean;
  /** Accentkleur, in de praktijk zoneColor: houdt de kleurcodering per trainingszone consistent met de rest van het scherm. */
  accentColor: string;
}

// ── Iconen per afslagtype ─────────────────────────────────────────────────
// Dekt alle TurnKind-waarden (incl. 'unknown') zodat er nooit een lege plek
// valt.
//  - left/right: haakse hoekpijl (CornerUpLeft/CornerUpRight) — de meest
//    herkenbare "sla hier af"-vorm.
//  - sharp-left/sharp-right: hergebruiken dezelfde hoekpijl. lucide-react-
//    native heeft geen aparte "scherpe hoek"-variant; het woord "scherp"
//    in de instructietekst maakt het verschil al duidelijk, en optisch een
//    net iets andere pijl voor "scherp" zou vooral verwarren (twee
//    linksaf-pijlen die niet identiek ogen lijken twee vérschillende
//    manoeuvres).
//  - keep-left/keep-right: een diagonale pijl (ArrowUpLeft/ArrowUpRight) in
//    plaats van de haakse hoekpijl — visueel bewust "zachter", want "houd
//    links aan" is geen echte afslag maar een lichte koerscorrectie.
//  - straight: rechte pijl omhoog.
//  - uturn: RotateCcw (de universele "keer om"-pijl).
//  - arrive: vlaggetje — de finish van deze route/instructielijst.
//  - unknown: Navigation — hetzelfde neutrale kompasnaald-icoon dat
//    LiveRouteMap al gebruikt voor "een richting, geen specifiek type".
// (lucide-react-native exporteert het gedeelde icoontype zelf niet, vandaar
// `typeof CornerUpLeft` als steekproef — alle iconen van dit pakket delen
// dezelfde propvorm.)
const TURN_ICONS: Record<TurnKind, typeof CornerUpLeft> = {
  left:          CornerUpLeft,
  right:         CornerUpRight,
  'sharp-left':  CornerUpLeft,
  'sharp-right': CornerUpRight,
  'keep-left':   ArrowUpLeft,
  'keep-right':  ArrowUpRight,
  straight:      ArrowUp,
  uturn:         RotateCcw,
  arrive:        Flag,
  unknown:       Navigation,
};

// ── Afstandsafronding ─────────────────────────────────────────────────────
// Dichtbij nauwkeuriger dan veraf: vlak voor een afslag telt iedere meter
// mee om op tijd te reageren; op 300 m is 10 m verschil pure ruis. Drie
// stappen:
//  - < NOW_THRESHOLD_M: de afslag is er nu al — een getal voegt op dat
//    moment niets meer toe, "nu" is duidelijker dan bijvoorbeeld "12 m".
//  - < NEAR_FAR_BOUNDARY_M: rond af op 10 m. Dat is dezelfde stapgrootte
//    als de throttle in useRouteCoaching (RENDER_DISTANCE_STEP_M) — een
//    fijnere afronding zou hier schijnprecisie zijn, de hook zelf levert
//    toch nooit een fijnere update.
//  - < KM_BOUNDARY_M: rond af op 50 m — op deze afstand is de exacte meter
//    tijdens het lopen sowieso niet meer bruikbaar.
//  - >= KM_BOUNDARY_M: toon in kilometers, op één decimaal (een verre
//    volgende afslag, bijvoorbeeld vlak na de start van een lange rechte
//    weg — hoeft niet meterprecies te zijn).
const NOW_THRESHOLD_M     = 15;
const NEAR_FAR_BOUNDARY_M = 100;
const NEAR_ROUND_STEP_M   = 10;
const FAR_ROUND_STEP_M    = 50;
const KM_BOUNDARY_M       = 1000;

// Vanaf deze afstand (en uiteraard bij "nu") wordt de balk visueel
// urgenter — sterkere accentkleur, geen knipperende animatie. Dezelfde
// orde van grootte als de haptische trilcue in useRouteCoaching
// (HAPTIC_TRIGGER_M): die constante is daar niet geëxporteerd, dus een
// eigen constante hier, maar beide drukken bewust hetzelfde moment uit —
// "deze afslag is nu praktisch relevant, niet alleen theoretisch".
const URGENT_DISTANCE_M = 50;

interface RoundedDistance {
  isNow: boolean;
  /** Compacte weergave op het scherm, bv. "100 m", "1.2 km" of "nu". */
  label: string;
  /** Volledig uitgeschreven eenheid voor de screenreader-tekst ("100 meter" i.p.v. "100 m"); null bij "nu". */
  speechLabel: string | null;
}

function roundTurnDistance(distanceM: number): RoundedDistance {
  if (distanceM < NOW_THRESHOLD_M) {
    return { isNow: true, label: 'nu', speechLabel: null };
  }
  if (distanceM < KM_BOUNDARY_M) {
    const step    = distanceM < NEAR_FAR_BOUNDARY_M ? NEAR_ROUND_STEP_M : FAR_ROUND_STEP_M;
    const rounded = Math.round(distanceM / step) * step;
    return { isNow: false, label: `${rounded} m`, speechLabel: `${rounded} meter` };
  }
  const km = Math.round((distanceM / 1000) * 10) / 10;
  return { isNow: false, label: `${km} km`, speechLabel: `${km} kilometer` };
}

// Screentekst bij het afwijken van de route: kort, rustig en niet-
// beschuldigend — het GPS-signaal kan haperen, of de loper koos bewust een
// andere weg. Zelfde toon als OFFROUTE_TEXTS in voicePhrases.ts (niet
// letterlijk gekopieerd: dit is de schermvariant, die mag korter dan de
// gesproken tekst — geen "zodra het uitkomt"-bijzin nodig als de balk toch
// gewoon in beeld blijft tot de loper weer op de route staat).
const OFF_ROUTE_TEXT = 'Even naast de route. Zoek de lijn terug wanneer het lukt.';

export function NextTurnBanner({ nextTurn, isOffRoute, accentColor }: NextTurnBannerProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (isOffRoute) {
    return (
      <View
        style={styles.offRouteContainer}
        accessible
        accessibilityRole="alert"
        accessibilityLabel={`Je loopt naast de route. ${OFF_ROUTE_TEXT}`}
      >
        <MapPinOff size={24} color={colors.warning} strokeWidth={2.25} />
        <Text style={styles.offRouteText} numberOfLines={2} ellipsizeMode="tail">
          {OFF_ROUTE_TEXT}
        </Text>
      </View>
    );
  }

  if (!nextTurn) return null;

  const Icon      = TURN_ICONS[nextTurn.kind];
  const dist       = roundTurnDistance(nextTurn.distanceM);
  const isUrgent  = dist.isNow || nextTurn.distanceM <= URGENT_DISTANCE_M;

  // Zelfde opbouw als navUtterance() in voicePhrases.ts ("Over 100 meter: ..."),
  // zodat de screenreader-tekst en de gesproken begeleiding elkaar niet
  // tegenspreken.
  const accessibilityLabel = dist.speechLabel
    ? `Over ${dist.speechLabel}: ${nextTurn.text}`
    : nextTurn.text;

  return (
    <View
      style={[styles.container, isUrgent && { backgroundColor: `${accentColor}33`, borderColor: accentColor }]}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.iconCircle, { backgroundColor: `${accentColor}26` }]}>
        <Icon size={26} color={accentColor} strokeWidth={2.25} />
      </View>
      <View style={styles.textBlock}>
        <Text style={[styles.distance, { color: accentColor }]}>{dist.label}</Text>
        <Text style={styles.instruction} numberOfLines={1} ellipsizeMode="tail">
          {nextTurn.text}
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[1.5],
    marginHorizontal:  spacing[3],
    marginBottom:      spacing[1],
    paddingVertical:   spacing[1],
    paddingHorizontal: spacing[1.5],
    borderRadius:      radius.xl,
    borderWidth:       1,
    backgroundColor:   colors.bgCard,
    borderColor:       colors.borderSubtle,
    ...shadows.sm,
  },
  iconCircle: {
    width:          44,
    height:         44,
    borderRadius:   radius.full,
    alignItems:     'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex:     1,
    // minWidth: 0 is nodig binnen een flex-row zodat numberOfLines/ellipsis
    // op de instructietekst daadwerkelijk kan inkorten i.p.v. de rij te
    // laten uitrekken — zonder dit zou een lange straatnaam de balk breder
    // dan het scherm kunnen duwen.
    minWidth: 0,
  },
  distance: {
    fontFamily:    typography.fontFamily.display,
    fontSize:      typography.fontSize['2xl'],
    letterSpacing: typography.letterSpacing.tight,
  },
  instruction: {
    fontFamily: typography.fontFamily.sansMedium,
    fontSize:   typography.fontSize.sm,
    color:      colors.textSecondary,
    marginTop:  2,
  },

  offRouteContainer: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[1.5],
    marginHorizontal:  spacing[3],
    marginBottom:      spacing[1],
    padding:           spacing[1.5],
    borderRadius:      radius.xl,
    borderWidth:       1,
    backgroundColor:   `${colors.warning}22`,
    borderColor:       `${colors.warning}44`,
  },
  offRouteText: {
    flex:       1,
    fontFamily: typography.fontFamily.sansMedium,
    fontSize:   typography.fontSize.sm,
    color:      colors.warning,
  },
});
