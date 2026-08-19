/**
 * raceSchedule
 *
 * Kalenderlogica voor het WEDSTRIJDSCHEMA. Los van deze module blijft de
 * trainingsmodus (currentWeekTraining) gewoon op voltooiing lopen — een
 * doelgericht schema zonder deadline mag daarop blijven draaien. Alleen het
 * wedstrijdschema is kalender-verankerd: de racedatum ligt vast, dus moet de
 * week-met-racedag in het schema altijd samenvallen met de echte racedag,
 * ongeacht hoeveel trainingen daadwerkelijk gelopen zijn.
 *
 * Aanleiding: vóór deze module hing het weeknummer van het wedstrijdschema af
 * van hoeveel sessies afgehandeld waren (zie de oude logica in
 * appStore.ts/completeSession en skipSession). Wie een training miste of
 * inhaalde, liet het hele schema mee opschuiven — met als gevolg dat de
 * racedag-week niet meer overeenkwam met de daadwerkelijke racedag. Deze
 * module rekent het weeknummer in plaats daarvan puur uit de kalender,
 * terugrekenend vanaf de racedatum: zit je in de week van de wedstrijd, dan
 * IS het weeknummer per definitie gelijk aan totalWeeks.
 */

import { startOfWeek, differenceInCalendarWeeks } from 'date-fns';
import type { RacePlan } from './buildRacePlan';

/**
 * Parseert een 'YYYY-MM-DD'-datumstring als LOKALE middernacht, niet als UTC
 * middernacht. `new Date('2026-09-20')` interpreteert een kale datumstring
 * als UTC-middernacht; in een tijdzone ten oosten van UTC (zoals Nederland)
 * valt dat moment lokaal nog op de vorige avond, en levert lokale
 * dag-berekening (welke maandag, welke week) daardoor een dag te vroeg op.
 * Precies de valkuil die de racedag-berekening hieronder moet vermijden.
 *
 * Enige definitie: buildRacePlan.ts importeert deze functie rechtstreeks in
 * plaats van hem te dupliceren. Dat levert GEEN circulaire runtime-
 * afhankelijkheid op, ook al importeert dit bestand hierboven `RacePlan` van
 * buildRacePlan.ts: dat is een `import type`, en zo'n type-only import wordt
 * bij het compileren volledig weggestreept. Aan runtime loopt de
 * afhankelijkheid dus maar één kant op (buildRacePlan.ts → raceSchedule.ts).
 */
export function parseLocalISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Spiegelbeeld van parseLocalISODate: formatteert een Date terug naar
 * 'YYYY-MM-DD' met LOKALE datumcomponenten. `date.toISOString().split('T')[0]`
 * (elders in de codebase nog in gebruik, bijv. weekStartISO in appStore.ts)
 * converteert eerst naar UTC en kan daardoor in een tijdzone ten oosten van
 * UTC een dag te vroeg uitkomen — dezelfde valkuil als bij parseLocalISODate,
 * maar dan aan de schrijfkant. buildRacePlan.ts gebruikt deze functie voor
 * `startDate`: zonder deze functie zou een berekende maandag als de
 * voorgaande zondag opgeslagen worden zodra het toestel/de server ten oosten
 * van UTC staat (bijv. Nederlandse zomertijd, UTC+2) — precies aangetoond
 * tijdens het verifiëren van de kalenderweek-fix hierboven.
 */
export function formatLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Aantal kalenderweken dat beschikbaar is voor een schema tot en met de
 * racedag, de HUIDIGE week meegeteld. Ligt de racedag deze week, dan is het
 * resultaat 1; ligt hij volgende week, dan is het 2; enzovoort.
 *
 * Dit is bewust dezelfde maat (kalenderweken vanaf de maandag van DEZE week)
 * als raceWeekForDate/raceScheduleStatus hieronder gebruiken voor hun
 * `weeksToGo`. buildRacePlan.ts gebruikt deze functie om `totalWeeks` te
 * bepalen — gebruikte het in plaats daarvan een DAG-gebaseerde telling
 * vanaf vandaag (zoals `weeksUntilRace` in rotterdamRaces.ts, bedoeld voor
 * countdown-teksten als "5 weken te gaan"), dan raakt totalWeeks niet meer
 * in de pas met de kalenderrekening hieronder: die dag-maat "verliest" de
 * dagen tussen vandaag en de maandag van deze week en komt daardoor
 * structureel één kalenderweek te laag uit. Gevolg was een reproduceerbare
 * bug: elke gebruiker die een haalbare wedstrijd koos, kreeg status 'voor'
 * (schema moet nog beginnen) in plaats van 'bezig' vanaf week 1 — zie de
 * git-geschiedenis van deze functie voor de volledige analyse. Verander
 * deze functie dus nooit los van raceWeekForDate/raceScheduleStatus.
 */
export function calendarWeeksAvailable(raceDate: string, today: Date): number {
  const raceWeekMonday = startOfWeek(parseLocalISODate(raceDate), { weekStartsOn: 1 });
  const thisMonday = startOfWeek(today, { weekStartsOn: 1 });
  return differenceInCalendarWeeks(raceWeekMonday, thisMonday, { weekStartsOn: 1 }) + 1;
}

/**
 * Geeft het huidige weeknummer van het wedstrijdschema terug, puur op basis
 * van de kalender — geen enkele afhankelijkheid van welke sessies wel of
 * niet afgehandeld zijn.
 *
 * weeksToGo = calendarWeeksAvailable(...) - 1: aantal hele kalenderweken
 *             tussen `thisMonday` en de maandag van de racedag-week
 *             (positief als de wedstrijd nog in de toekomst ligt, negatief
 *             als de wedstrijdweek al voorbij is).
 * week      = totalWeeks - weeksToGo, geklemd op [1, totalWeeks].
 *
 * Zit je in de week van de wedstrijd, dan is weeksToGo 0 en dus
 * week === totalWeeks: de racedag-week klopt daardoor altijd, wat er ook in
 * completedSessions/skippedSessions staat.
 */
export function raceWeekForDate(racePlan: RacePlan, today: Date): number {
  const weeksToGo = calendarWeeksAvailable(racePlan.race.date, today) - 1;
  const week = racePlan.totalWeeks - weeksToGo;
  return Math.min(Math.max(week, 1), racePlan.totalWeeks);
}

export interface RaceScheduleStatus {
  /** Het (geklemde) weeknummer, identiek aan raceWeekForDate. */
  week: number;
  /**
   * 'voor'  = de kalenderweek ligt nog vóór week 1 (de wedstrijd ligt verder
   *           weg dan het langste schema toelaat, zie buildRacePlan.ts).
   * 'bezig' = het schema loopt.
   * 'na'    = de wedstrijdweek is al voorbij.
   */
  status: 'voor' | 'bezig' | 'na';
  /** Alleen zinvol bij status 'voor': aantal kalenderweken tot de startweek. */
  startsInWeeks: number;
}

/**
 * Zelfde kalenderrekening als raceWeekForDate, maar geeft ook de ongeklemde
 * status terug zodat de UI eerlijk kan tonen dat een schema nog moet
 * beginnen (in plaats van stilzwijgend op week 1 te blijven hangen) of al
 * voorbij de wedstrijd is (in plaats van door te tellen voorbij totalWeeks).
 */
export function raceScheduleStatus(racePlan: RacePlan, today: Date): RaceScheduleStatus {
  const weeksToGo = calendarWeeksAvailable(racePlan.race.date, today) - 1;
  const rawWeek = racePlan.totalWeeks - weeksToGo;
  const week = Math.min(Math.max(rawWeek, 1), racePlan.totalWeeks);

  if (rawWeek < 1) {
    return { week, status: 'voor', startsInWeeks: 1 - rawWeek };
  }
  // rawWeek > totalWeeks betekent: thisMonday ligt na raceWeekMonday, dus de
  // hele wedstrijdweek (racedag inbegrepen) ligt al in het verleden.
  if (rawWeek > racePlan.totalWeeks) {
    return { week, status: 'na', startsInWeeks: 0 };
  }
  return { week, status: 'bezig', startsInWeeks: 0 };
}
