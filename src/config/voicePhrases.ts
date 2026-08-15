/**
 * voicePhrases — de zinnencatalogus voor de stempakketten
 *
 * Eén bron van waarheid voor zowel het (fase B) generatiescript als de app.
 * Zie `_workspace/notities/Stempakketten-ontwerp.md` voor de volledige
 * architectuur. Elke gesproken boodschap in de app bestaat straks uit een
 * rij van hele-zin-clips (`phraseId`'s) die na elkaar worden afgespeeld —
 * plakken op zinsniveau klinkt natuurlijk, op woordniveau niet. Zolang de
 * clips zelf nog niet bestaan (fase A/B) speelt de app altijd de
 * `fallbackText` af via de telefoonstem (expo-speech); zie `speakPhrases`
 * in `src/services/voiceService.ts`.
 *
 * `allPhrases()` enumereert ALLE clips die het generatiescript met
 * ElevenLabs moet aanmaken (729 stuks sinds fase E, zie de "Uitbreiding"-
 * sectie onderaan het ontwerpdoc). De compositiefuncties hieronder
 * (`kmSplitUtterance`, `finishUtterance`, enz.) bepalen welke clip-ids een
 * concrete boodschap tijdens het lopen gebruikt, plús de natuurlijke
 * volzin als vangnet.
 *
 * Afronding van dynamische delen is bewust ruw: het scherm toont exacte
 * waarden, de stem mag "ongeveer" zeggen. Zo blijft het aantal clips
 * eindig terwijl de gesproken boodschap toch natuurlijk klinkt. Zie de
 * toelichting bij elke groep hieronder.
 */

import { getAllRaces } from '../data/rotterdamRaces';

// ── Hulpfuncties voor afronding/klemmen ─────────────────────────────────────

/** Klemt een waarde tussen min en max (inclusief). */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Rondt af op de dichtstbijzijnde 0,5 en klemt tussen min en max. Gebruikt
 * voor "resterend"/"afgelegd"-afstanden: die lopen in stappen van een halve
 * kilometer (rem_/dist_-groepen).
 */
function roundHalfClamped(value: number, min: number, max: number): number {
  const rounded = Math.round(value * 2) / 2;
  return clamp(rounded, min, max);
}

/**
 * Zet een halve-kilometerwaarde (bv. 7 of 7.5) om in een phraseId-suffix
 * zonder punt/komma, bv. "7" of "7_5" — bestandsnamen mogen geen punt
 * bevatten en underscores lezen prettiger dan een letterlijke komma.
 */
function halfStepSuffix(value: number): string {
  const whole = Math.floor(value + 1e-9);
  const isHalf = value - whole >= 0.25;
  return isHalf ? `${whole}_5` : `${whole}`;
}

/**
 * Nederlandse getalnotatie voor een halve-kilometerwaarde in gesproken/
 * geschreven tekst: hele kilometers als "8", halve als "8,5" (komma, geen
 * punt — Nederlandse conventie).
 */
function formatHalfKm(value: number): string {
  const whole = Math.floor(value + 1e-9);
  const isHalf = value - whole >= 0.25;
  return isHalf ? `${whole},5` : `${whole}`;
}

// ── 1. Km-split — "5 kilometer." ────────────────────────────────────────────
// km_1 .. km_50. Verder dan 50 km komt in de praktijk niet voor (marathon +
// ruim); een langere afstand klemt op km_50 zodat er altijd een geldige clip-
// id is (de encouragement-rotatie hieronder blijft wel op de echte km-stand
// lopen, alleen de kilometer-clip zelf klemt).
const KM_SPLIT_MIN = 1;
const KM_SPLIT_MAX = 50;

// ── 2. Tempo — "Tempo 5 minuten en 30 seconden per kilometer." ──────────────
// Minuten geklemd 2..15 (sneller dan 2:00/km of trager dan 15:00/km komt bij
// hardlopen niet voor), seconden afgerond op een veelvoud van 5 (0,5,…,55).
const PACE_MIN_MIN = 2;
const PACE_MIN_MAX = 15;
const PACE_SEC_STEP = 5;

// ── 3. Aanmoediging per km-split — bestaande KM_MESSAGES (useVoiceGuidance) ─
// LET OP: index 0-5 zijn de OORSPRONKELIJKE zes teksten en blijven letterlijk
// staan — hun clips zijn al gegenereerd. Index 6-23 zijn de fase E-uitbreiding
// (18 nieuwe teksten, zelfde toon/lengte). De bestaande roulatie
// `(completedKm - 1) % ENC_MESSAGES.length` in kmSplitUtterance hieronder
// werkt ongewijzigd door met de langere lijst.
const ENC_MESSAGES = [
  'Goed bezig, houd dit tempo aan.',
  'Super! Blijf gelijkmatig lopen.',
  'Uitstekend! Je loopt geweldig.',
  'Fantastisch! Je bent sterk.',
  'Geweldig! Bijna bij het doel.',
  'Ongelooflijk! Je bent een machine.',
  'Sterk gedaan, blijf dit tempo vasthouden.',
  'Knap! Je loopt heel gelijkmatig.',
  'Wat een kracht, hou dit vast.',
  'Machtig! Je bent heerlijk bezig.',
  'Blijf zo doorgaan, het gaat goed.',
  'Topper! Dit tempo past bij je.',
  'Sterk bezig, hou deze lijn vast.',
  'Klasse! Je wordt steeds sterker.',
  'Volhouden, je bent bijna klaar.',
  'Indrukwekkend! Blijf zo lekker lopen.',
  'Je bent vandaag in topvorm.',
  'Prima tempo, hou dit erin.',
  'Wauw! Dit gaat je lukken.',
  'Sterke pas, blijf zo lopen.',
  'Chapeau! Je doet het fantastisch.',
  'Blijf ademen, blijf lopen, goed bezig.',
  'Kanjer! Nog even volhouden.',
  'Mooi ritme, ga zo verder.',
  // Index 24-39: fase F-uitbreiding (CP6, creditplan aug 2026).
  'Heerlijk om te zien, ga zo door.',
  'Je haalt dit met gemak.',
  'Lekker bezig, blijf ontspannen lopen.',
  'Dit is precies je ritme, vasthouden.',
  'Sterk! Je hebt dit helemaal onder controle.',
  'Mooi werk, je wordt met elke stap sterker.',
  'Blijf geloven in jezelf, het gaat prima.',
  'Wat een doorzettingsvermogen, ga zo verder.',
  'Je bent goed op weg, hou dit tempo vast.',
  'Fijn gelopen tot nu toe, blijf zo.',
  'Elke stap brengt je dichterbij, sterk!',
  'Je maakt indruk, hou dit vol.',
  'Rustig en sterk, precies goed.',
  'Vertrouw op je benen, het gaat goed.',
  'Je loopt met gemak, blijf zo lekker bezig.',
  'Genieten van dit tempo, hou het erin.',
];

// ── 4/5. Resterend / afgelegd — stappen van 0,5 km, 0,5..42 km ──────────────
// 42 km (marathon) als bovengrens; verder klemt de waarde op 42.
const KM_RANGE_MIN = 0.5;
const KM_RANGE_MAX = 42;

// ── 6. Tijd — "In 52 minuten." ──────────────────────────────────────────────
// 1..90 minuten per hele minuut (normale trainingsduur), daarboven per 5
// minuten (lange duurlopen/marathon), geklemd op 300 (5 uur).
const TIME_FINE_MAX = 90;
const TIME_STEP_ABOVE = 5;
const TIME_MAX = 300;

// ── 7. Zones — bestaande ZONE_DESCRIPTIONS (useVoiceGuidance) ──────────────
const ZONE_DESCRIPTIONS: Record<string, string> = {
  Z1: 'Herstelzone. Heel rustig tempo.',
  Z2: 'Aerobe zone. Comfortabel, je kunt praten.',
  Z3: 'Tempozone. Uitdagend maar houdbaar.',
  Z4: 'Drempelzone. Moeilijk, bijna geen gesprek mogelijk.',
  Z5: 'Maximale zone. Alles geven!',
};
const ZONE_IDS = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'] as const;

// ── 8. Hartslagcoaching — varianten per type (useHeartRateCoaching) ────────
// Variant 0 van elk type is de OORSPRONKELIJKE tekst en blijft letterlijk
// staan (clip al gegenereerd als hr_high/hr_low/hr_ok — wordt bij de
// hernummering naar hr_{type}_0 opnieuw aangemaakt, zie generatiescript).
// Varianten 1/2 zijn de fase E-uitbreiding, 3/4 de fase F-uitbreiding (CP6):
// zelfde strekking, andere woorden, zodat een gebruiker die vaker dezelfde
// coaching-melding hoort niet steeds identieke zinnen krijgt.
// useHeartRateCoaching.ts rouleert hierdoor per type met een eigen teller;
// hrUtterance hieronder klemt modulo de daadwerkelijke lijstlengte, dus een
// lijst verlengen vergt verder geen codewijziging.
const HR_TEXTS: Record<'high' | 'low' | 'ok', string[]> = {
  high: [
    'Je hartslag is wat hoog voor deze training. Doe een stapje terug.',
    'Je zit boven je doelzone. Rustig aan, bouw het tempo af.',
    'Even gas terugnemen, je hartslag loopt op. Zoek je ritme weer.',
    'Je hartslag piekt net iets te veel. Haal de vaart er even uit.',
    'Bouw het rustig af, je hartslag mag wat zakken.',
  ],
  low: [
    'Je hebt nog ruimte. Je mag iets versnellen.',
    'Je hartslag is nog laag. Je kunt best wat sneller.',
    'Er zit meer in. Voel je vrij om te versnellen.',
    'Je zit ruim onder je zone. Zet er gerust een tandje bij.',
    'Nog volop energie over, je mag best wat harder.',
  ],
  ok: [
    'Mooi zo, precies goed.',
    'Prima tempo, dit is precies je zone.',
    'Goed zo, je zit weer helemaal in het juiste ritme.',
    'Precies goed zo, hou deze zone vast.',
    'Dit is je zone, blijf lekker zo lopen.',
  ],
};

// ── 9. Mijlpalen — bestaande teksten (useRouteCoaching + useVoiceGuidance) ──
// mile_25/50/75 zijn de routevoortgangsmeldingen uit useRouteCoaching
// (MILESTONES). "halfway" is de aparte halverwege-melding uit
// useVoiceGuidance — dat is een ANDER concept (halverwege de geplande
// sessieafstand, niet halverwege de uitgestippelde route) met een eigen
// tekst. Let op de woordvolgorde: de oorspronkelijke zin is "Halverwege!
// Nog X kilometer te gaan. Je doet het geweldig." — met maar twee clip-ids
// beschikbaar (halfway + rem_X) is het niet mogelijk om "Je doet het
// geweldig" na de rem_-clip te laten volgen zonder een derde id. Daarom
// bevat de "halfway"-clip zelf beide bookend-zinnen ("Halverwege! Je doet
// het geweldig.") en klinkt rem_X ertussenin (fase C); dat is een bewuste
// afwijking van de exacte fallback-woordvolgorde, alleen relevant zodra de
// clips echt afgespeeld worden (fase C) — de fallbackText hieronder blijft
// woordelijk gelijk aan het huidige gedrag.
const MILE_TEXTS: Record<25 | 50 | 75, string> = {
  25: 'Een kwart van je route voltooid.',
  50: 'Halverwege de geplande route.',
  75: 'Driekwart onderweg. Bijna terug!',
};
const HALFWAY_TEXT = 'Halverwege! Je doet het geweldig.';

// ── 10. Navigatie — herkend uit de Nederlandse tekst van toNl() ────────────
// (src/services/routeService.ts). Geen straatnamen in de clips: alleen het
// type afslag wordt uitgesproken, de straatnaam blijft schermtekst/fallback.
const TURN_TEXTS: Record<string, string> = {
  turn_left:        'Sla links af.',
  turn_right:       'Sla rechts af.',
  turn_sharp_left:  'Sla scherp links af.',
  turn_sharp_right: 'Sla scherp rechts af.',
  turn_keep_left:   'Houd links aan.',
  turn_keep_right:  'Houd rechts aan.',
  turn_straight:    'Ga rechtdoor.',
  turn_uturn:       'Keer om.',
  turn_arrive:      'Doel bereikt.',
};

// Herkenningspatronen, in deze volgorde gecontroleerd (case-insensitive
// substring-match op de reeds vertaalde Nederlandse tekst). "scherp"- en
// "houd ... aan"-varianten staan bewust vóór de simpele "sla ... af", al
// overlappen ze toch niet als substring ("Sla scherp links af" bevat niet
// letterlijk "Sla links af"). "Keer om" komt in de huidige toNl() niet voor
// (ORS levert geen U-turn-instructie op onze routes), maar wordt hier al
// wel herkend zodat de catalogus toekomstvast is (zie ontwerpdoc).
const TURN_PATTERNS: Array<[string, string]> = [
  ['sla scherp links af',  'turn_sharp_left'],
  ['sla scherp rechts af', 'turn_sharp_right'],
  ['houd links aan',       'turn_keep_left'],
  ['houd rechts aan',      'turn_keep_right'],
  ['sla links af',         'turn_left'],
  ['sla rechts af',        'turn_right'],
  ['ga rechtdoor',         'turn_straight'],
  ['keer om',              'turn_uturn'],
  ['doel bereikt',         'turn_arrive'],
];

// ── 10b. Van-de-route-afdwalen — off-route-detectie tijdens het lopen ──────
// Aparte subsectie vlak na de turn-by-turn-navigatie (sectie 10): dit is
// GEEN afslag-instructie (geen match in TURN_PATTERNS/detectTurnType), maar
// een eigen coach-melding zodra de loper te ver van de uitgestippelde route
// afwijkt (>~40 m, detectie zit in een aparte sessie-hook) en zodra hij weer
// terug is. Bewust GEEN "turn_"-voorvoegsel — dat is gereserveerd voor de
// door toNl() herkende afslagtypes; "route_off_"/"route_on" maakt meteen
// duidelijk dat dit een ANDER concept is (afwijking van de lijn, geen
// navigatie-instructie naar een afslag).
// Twee rouleervarianten voor "je bent van de route af" (zelfde opzet als
// ENC_MESSAGES/HR_TEXTS/TECH_TEXTS hierboven), één vaste tekst voor "je bent
// er weer op" — dat laatste is kort en bevestigend, daar is geen variatie
// nodig.
// Toon: rustig en niet-beschuldigend — de loper kan bewust een andere weg
// genomen hebben, of het GPS-signaal hapert even, dus NIET "je loopt
// verkeerd". Ook geen loze belofte om een nieuwe route te zoeken (dat kan de
// app niet herberekenen); de enige zinvolle actie zonder scherm is
// teruggaan naar de uitgestippelde lijn, dus dat zeggen beide teksten
// letterlijk.
const OFFROUTE_TEXTS: string[] = [
  'Je loopt even naast de route. Ga terug naar de lijn zodra het uitkomt.',
  'Je wijkt af van de uitgestippelde route. Zoek de lijn weer op wanneer je kan.',
];
const BACK_ON_ROUTE_TEXT = 'Goed zo, je bent weer op de route.';

// ── 11. Nav-afstand — "Over 100 meter:" ─────────────────────────────────────
// Afgerond op 10 meter, geklemd 50..150 (binnen dat bereik wordt een afslag
// in useRouteCoaching aangekondigd; zie ANNOUNCE_AT_M).
const DIST_M_MIN = 50;
const DIST_M_MAX = 150;
const DIST_M_STEP = 10;

// ── 12. Vast — finish/well_done/greeting/preview/have_fun ───────────────────
const FIXED_TEXTS: Record<string, string> = {
  finish:    'Sessie voltooid!',
  well_done: 'Geweldig gedaan!',
  greeting:  'Hoi! Ik ben je hardloopcoach. Samen gaan we trainen.',
  preview:   'Hoi! Ik ben je hardloopcoach. Zo klink ik tijdens het lopen.',
  have_fun:  'Veel plezier!',
};

// ── 13. Sessie-intro — gesproken bij de start van een geplande sessie ──────
// Eén clip per trainingstype (rest-dagen worden nooit "gelopen" en krijgen
// dus geen intro, zie de aanroep in app/session/active.tsx).
const INTRO_TEXTS: Record<'easy' | 'tempo' | 'long' | 'cross', string> = {
  easy:  'Vandaag: een rustige duurloop.',
  tempo: 'Vandaag: een tempotraining.',
  long:  'Vandaag: een lange duurloop.',
  cross: 'Vandaag: een crosstraining.',
};

// ── 14. Doel — "Het doel is ongeveer 8,5 kilometer." ────────────────────────
// Zelfde halve-kilometersystematiek als rem_/dist_ hierboven (KM_RANGE_MIN..
// KM_RANGE_MAX, stappen van 0,5 km) — vergt dus geen eigen grenzen/helpers.

// ── 15b. Dagdeel-begroeting bij sessiestart — fase E-uitbreiding (CP4) ──────
// Tekstvarianten per dagdeel zodat de begroeting niet elke run identiek
// klinkt (zelfde rouleeropzet als ENC_MESSAGES/HR_TEXTS). Index 0/1 zijn de
// fase E-uitbreiding, 2/3 de fase F-uitbreiding (CP6). Het dagdeel zelf wordt
// bepaald door de aanroeper (new Date().getHours(), zie active.tsx) — hier
// alleen de teksten en de grenzen in greetingForSessionStart hieronder, die
// modulo de daadwerkelijke lijstlengte klemt.
const GREET_TEXTS: Record<'morning' | 'afternoon' | 'evening', string[]> = {
  morning: [
    'Goedemorgen! Klaar voor je ochtendrun?',
    'Goedemorgen! Tijd om de dag sportief te beginnen.',
    'Goedemorgen! Mooi begin van de dag, deze training.',
    'Goedemorgen! Frisse lucht en een goede loop, daar gaan we.',
  ],
  afternoon: [
    'Goedemiddag! Klaar voor je training?',
    'Goedemiddag! Mooi moment voor een run.',
    'Goedemiddag! Even je hoofd leegmaken met een training.',
    'Goedemiddag! Tijd voor een frisse onderbreking van de dag.',
  ],
  evening: [
    'Goedenavond! Klaar om nog even te lopen?',
    'Goedenavond! Laten we deze dag sportief afsluiten.',
    'Goedenavond! Mooi moment om de dag uit te lopen.',
    'Goedenavond! Nog even bewegen voor het rustig wordt.',
  ],
};

// ── 15c. Finish-afsluiters — fase E-uitbreiding (CP4) + fase F (CP6) ───────
// Index 0 ("Geweldig gedaan!") is de OORSPRONKELIJKE tekst en blijft
// letterlijk staan — zijn clip-id is en blijft 'well_done' (zie FIXED_TEXTS),
// niet hernoemen. Index 1+ zijn de varianten (finish_var_1.., zie allPhrases
// hieronder); finishUtterance rouleert modulo de daadwerkelijke lijstlengte.
const FINISH_CLOSERS: string[] = [
  'Geweldig gedaan!',
  'Wat een prestatie!',
  'Dat heb je verdiend!',
  'Knap gelopen!',
  'Sterk staaltje werk!',
  'Dat was topsport van jou!',
  'Mooi afgerond, goed gedaan!',
  'Weer een streepje erbij, knap!',
];

// ── 15. Race-felicitaties — "Gefeliciteerd! Je hebt {race} uitgelopen!" ────
// Eén clip per wedstrijdNAAM (niet per wedstrijd-id). getAllRaces() geeft de
// daadwerkelijk kiesbare "bladwedstrijden" terug (bij een evenement met
// subRaces tellen alleen die subRaces mee, niet de groepsrace zelf — precies
// wat een gebruiker in de racekiezer selecteert, zie buildRacePlan.ts). Begint
// de naam zelf al met een lidwoord ("De ..."/"Het ..."), dan geen extra "de"
// ervoor (zie raceNamePhrase).
//
// WAAROM OP NAAM EN NIET OP ID — race-ids dragen het jaartal
// ('drechtstadloop-2026'), dus de editie van volgend jaar zou onder een id-
// sleutel een compleet nieuwe clip zijn terwijl de uitgesproken tekst
// identiek is. Op naam gesleuteld dekt één clip alle edities van hetzelfde
// evenement, voor altijd. Dat is wat racedata-updates zonder app-build
// (scripts/publish-races.ts) én zonder ElevenLabs-abonnement mogelijk maakt:
// zolang de naam al eens is ingesproken, klinkt de felicitatie in de echte
// coachstem — ook voor een wedstrijd die pas jaren later gepubliceerd wordt.
const RACE_LIST = getAllRaces();

/**
 * Extra wedstrijdnamen die WEL een clip krijgen maar (nog) niet in
 * rotterdamRaces.ts staan: een vooruit ingesproken voorraad, zodat een later
 * gepubliceerde wedstrijd meteen zijn eigen felicitatie heeft zonder dat er
 * nog een ElevenLabs-abonnement aan te pas komt.
 *
 * Spelregels: exact de naam zoals die in de racedata komt te staan (de slug
 * wordt eruit afgeleid, zie raceVoiceClipId), en nooit een naam verwijderen —
 * dat zou de clip uit het manifest halen terwijl er misschien al een
 * wedstrijd onder die naam gepubliceerd is. Namen die intussen wél in
 * rotterdamRaces.ts staan mogen hier blijven: dubbele namen leveren dezelfde
 * slug op en worden bij het opbouwen van de catalogus ontdubbeld.
 *
 * De lijst bestaat uit twee groepen met een verschillend doel:
 *
 * 1. De vooruit ingesproken voorraad (Deel A/B/C hieronder, 132 namen, zie
 *    `_workspace/notities/Race-stemvoorraad-aug-2026.md`) — wedstrijden die
 *    nog niet in rotterdamRaces.ts staan maar wel al een felicitatie krijgen
 *    zodra ze via publish-races.ts verschijnen, ook ver na 19 augustus 2026
 *    (einde ElevenLabs-abonnement).
 *
 * 2. De oude sponsornamen (36 namen) — GEEN nieuwe voorraad, maar bestaande,
 *    al betaalde clips die anders wees zouden worden. Op 15-08-2026 zijn 44
 *    wedstrijdnamen in rotterdamRaces.ts hernoemd (sponsors en jaartallen
 *    eruit); daardoor verwijst geen enkele wedstrijd in de huidige data meer
 *    naar deze 36 oude naam-slugs, en het generatiescript ruimt wezen op bij
 *    upload. Gebruikers op app-versie 1.0/1.1 hebben echter nog de
 *    gebúndelde racedata met de OUDE namen (serverdata lezen begint pas bij
 *    1.2.0) — verdwijnen die clips, dan verliezen precies die gebruikers hun
 *    wedstrijdfelicitatie. Door de oude namen hier te laten staan blijven de
 *    clips in het manifest. Dit kost NUL credits: het generatiescript is
 *    idempotent op `{phraseId}-{hash}.mp3` en de tekst achter deze namen is
 *    ongewijzigd, dus de bestaande bestanden worden simpelweg overgeslagen.
 *    NIET opruimen, ook al lijkt er geen wedstrijd meer naar te verwijzen.
 */
const EXTRA_RACE_VOICE_NAMES: string[] = [
  // Voorraad Deel A — kale varianten van wedstrijden die al in de app staan
  "Marathon Rotterdam",
  "Marathon Rotterdam - Marathon",
  "Marathon Rotterdam - Halve Marathon",
  "Marathon Rotterdam - 10 km",
  "Marathon Eindhoven",
  "Marathon Eindhoven - Marathon",
  "Marathon Eindhoven - Halve Marathon",
  "Marathon Eindhoven - 10 km",
  "Marathon Eindhoven - 5 km",
  "Amsterdam Marathon",
  "Amsterdam Marathon - Marathon",
  "Amsterdam Marathon - Halve Marathon",
  "Marathon Den Haag",
  "Marathon Den Haag - Marathon",
  "Marathon Den Haag - 10 km",
  "Marathon Den Haag - 5 km",
  "Dam tot Damloop",
  "Egmond Halve Marathon",
  "Zevenheuvelenloop",
  "Bruggenloop Rotterdam",
  "Singelloop Utrecht",
  "Singelloop Utrecht - 10 km",
  "Singelloop Utrecht - 5 km",
  "Tilburg Ten Miles",
  "Tilburg Ten Miles - 10 Mijl",
  "Tilburg Ten Miles - 10 km",
  "Tilburg Ten Miles - 5 km",
  "Venloop",
  "Venloop - Halve Marathon",
  "Venloop - 10 km",
  "Venloop - 5 km",
  "Bruges Marathon",
  "Bruges Marathon - Marathon",
  "Bruges Marathon - Halve Marathon",
  "Antwerp Marathon",
  "Antwerp Marathon - Marathon",
  "Antwerp Marathon - Halve Marathon",
  "Antwerp Marathon - 10 km",
  "Antwerp 10 Miles",
  "Antwerp 10 Miles - 10 Miles",
  "Antwerp 10 Miles - 5 Miles",
  "Gent 10 Mijl",
  "Gent 10 Mijl - 10 Mijl",
  "Gent 10 Mijl - 5 Mijl",
  // Voorraad Deel B — nieuwe Nederlandse evenementen
  "CPC Loop Den Haag",
  "CPC Loop Den Haag - Halve Marathon",
  "CPC Loop Den Haag - 10 km",
  "CPC Loop Den Haag - 5 km",
  "Midwinter Marathon Apeldoorn",
  "Midwinter Marathon Apeldoorn - Marathon",
  "Midwinter Marathon Apeldoorn - Halve Marathon",
  "Midwinter Marathon Apeldoorn - 10 km",
  "Enschede Marathon",
  "Enschede Marathon - Marathon",
  "Enschede Marathon - Halve Marathon",
  "Enschede Marathon - 10 km",
  "Utrecht Marathon",
  "Utrecht Marathon - Marathon",
  "Utrecht Marathon - Halve Marathon",
  "Utrecht Marathon - 10 km",
  "Kustmarathon Zeeland",
  "Kustmarathon Zeeland - Marathon",
  "Kustmarathon Zeeland - Halve Marathon",
  "Kustmarathon Zeeland - 10 km",
  "Berenloop Terschelling",
  "Berenloop Terschelling - Marathon",
  "Berenloop Terschelling - Halve Marathon",
  "Berenloop Terschelling - 10 km",
  "Berenloop Terschelling - 5 km",
  "4 Mijl van Groningen",
  "Nacht van Groningen",
  "Nacht van Groningen - Halve Marathon",
  "Nacht van Groningen - 10 km",
  "Maastrichts Mooiste",
  "Maastrichts Mooiste - Halve Marathon",
  "Maastrichts Mooiste - 10 km",
  "Maastrichts Mooiste - 5 km",
  "Bredase Singelloop",
  "Bredase Singelloop - Halve Marathon",
  "Bredase Singelloop - 10 km",
  "Bredase Singelloop - 5 km",
  "Bridge to Bridge Arnhem",
  "Bridge to Bridge Arnhem - 10 Mijl",
  "Bridge to Bridge Arnhem - 10 km",
  "Bridge to Bridge Arnhem - 5 km",
  "Groet uit Schoorl Run",
  "Groet uit Schoorl Run - 20 km",
  "Groet uit Schoorl Run - 10 km",
  "Goudse Singelloop",
  "Goudse Singelloop - 10 km",
  "Goudse Singelloop - 5 km",
  "Halve Marathon van Texel",
  "Halve Marathon van Texel - Halve Marathon",
  "Halve Marathon van Texel - 10 km",
  "Montferland Halve Marathon",
  "Montferland Halve Marathon - Halve Marathon",
  "Montferland Halve Marathon - 10 km",
  "Parelloop Brunssum",
  "Parelloop Brunssum - 10 km",
  "Parelloop Brunssum - 5 km",
  "Zandvoort Circuit Run",
  "Amersfoort Marathon",
  "Amersfoort Marathon - Halve Marathon",
  "Amersfoort Marathon - 10 km",
  "Roosendaal Halve Marathon",
  "Roosendaal Halve Marathon - 10 km",
  "Two Rivers Marathon",
  "10 van Noordwijk",
  "Linschotenloop",
  "Linschotenloop - Halve Marathon",
  "Linschotenloop - 10 km",
  "Diepe Hel Holterbergloop",
  "Blaauwbekmarathon",
  "Kruikenloop",
  "Achtkastelenloop",
  "Lansingerland Run",
  // Voorraad Deel C — nieuwe Vlaamse evenementen
  "Ghent Marathon",
  "Ghent Marathon - Marathon",
  "Ghent Marathon - Halve Marathon",
  "Ghent Marathon - 10 km",
  "Dwars door Brugge",
  "Dwars door Brugge - 10 km",
  "Dwars door Brugge - 5 km",
  "In Flanders Fields Marathon",
  "In Flanders Fields Marathon - Marathon",
  "In Flanders Fields Marathon - Halve Marathon",
  "Dwars door Mechelen",
  "Bruggenloop Kortrijk",
  "Leiecorrida Wevelgem",
  "Flandrien Loop Oudenaarde",
  "Halve Marathon Poppel",
  "Mutotoloop",
  // Oude sponsornamen — wees geworden door de sponsorloze hernoeming van
  // 15-08-2026 in rotterdamRaces.ts; blijven hier zodat gebruikers op app-
  // versie 1.0/1.1 (gebundelde racedata, nog met deze namen) hun felicitatie
  // houden. Zie de toelichting boven deze constante.
  "NN Marathon Rotterdam 2027",
  "DSW Bruggenloop Rotterdam",
  "City-Pier-City Loop",
  "NN Marathon The Hague - Marathon",
  "NN The Hague 10K",
  "The Hague 5K",
  "Spijkenisse SPARK Marathon",
  "Spijkenisse SPARK Halve Marathon",
  "Spijkenisse SPARK 10 km",
  "Spijkenisse SPARK 5 km",
  "NN Dam tot Damloop",
  "TCS Amsterdam Marathon",
  "TCS Amsterdam Half Marathon",
  "NN Egmond Halve Marathon",
  "CZ Tilburg Ten Miles - 10 Mijl",
  "CZ Tilburg Ten Miles - 10 km",
  "CZ Tilburg Ten Miles - 5 km",
  "ASML Marathon Eindhoven - Marathon",
  "ASML Marathon Eindhoven - Halve Marathon",
  "ASML Marathon Eindhoven - 10 km",
  "ASML Marathon Eindhoven - 5 km",
  "TREK Singelloop Utrecht 10 km",
  "TREK Singelloop Utrecht 5 km",
  "Garmin Zevenheuvelenloop",
  "Arrow Venloop - Halve marathon",
  "Arrow Venloop - 10 km",
  "Arrow Venloop - 5 km",
  "Athora Bruges Marathon - Marathon",
  "Athora Bruges Marathon - Halve Marathon",
  "MAES Gent 10 Mijl - 10 Mijl",
  "MAES Gent 10 Mijl - 5 Mijl",
  "TREK Antwerp Marathon - Marathon",
  "TREK Antwerp Marathon - Halve Marathon",
  "TREK Antwerp Marathon - 10 km",
  "Baloise Antwerp 10 Miles - 10 Miles",
  "Baloise Antwerp 10 Miles - 5 Miles",
  // Idem, maar los besloten op 15-08-2026: de halve marathon van Dordrecht
  // heeft geen officiële sponsorloze naam (het evenement rebrandt volledig bij
  // elke sponsorwissel, eerder "Riwal Hoogwerkers Halve Marathon"). De data
  // gebruikt daarom bewust de zelfgekozen naam "Dordrecht Halve Marathon";
  // deze regel houdt de al betaalde clip van de oude naam in het manifest.
  "Boels Rental Run",
];

/** Vangnetclip als een wedstrijdnaam zelf niet in het pakket zit. */
const RACE_GENERIC_TEXT = 'Gefeliciteerd! Je hebt je wedstrijd uitgelopen!';

/**
 * Vaste vervangingen voor letters met een accent. Bewust een expliciete tabel
 * in plaats van String.prototype.normalize('NFD'): de slug moet in Node (het
 * generatiescript) en in Hermes (de app) tot op de letter hetzelfde resultaat
 * geven, en Unicode-normalisatie is precies het soort API waar die twee
 * omgevingen in kunnen verschillen. Een tabel is saai, maar controleerbaar.
 */
const SLUG_CHAR_MAP: Record<string, string> = {
  à: 'a', á: 'a', â: 'a', ã: 'a', ä: 'a', å: 'a',
  è: 'e', é: 'e', ê: 'e', ë: 'e',
  ì: 'i', í: 'i', î: 'i', ï: 'i',
  ò: 'o', ó: 'o', ô: 'o', õ: 'o', ö: 'o', ø: 'o',
  ù: 'u', ú: 'u', û: 'u', ü: 'u',
  ç: 'c', ñ: 'n', ý: 'y', ÿ: 'y',
  æ: 'ae', œ: 'oe', ß: 'ss',
};

/**
 * Clip-id voor de felicitatie bij een wedstrijdnaam: 'race_' + een slug van
 * de naam (kleine letters, accenten weg, alles buiten a-z0-9 wordt een
 * koppelteken). Deterministisch en stabiel — dezelfde naam levert altijd
 * hetzelfde id op, ongeacht jaartal, editie of wedstrijd-id.
 *
 * Levert een naam een lege slug op (denkbaar bij een naam die alleen uit
 * leestekens bestaat), dan valt dit terug op 'race_overig' zodat er nooit een
 * id als 'race_' ontstaat.
 */
export function raceVoiceClipId(raceName: string): string {
  let out = '';
  for (const char of (raceName ?? '').toLowerCase()) {
    const mapped = SLUG_CHAR_MAP[char] ?? char;
    out += /^[a-z0-9]+$/.test(mapped) ? mapped : '-';
  }
  const slug = out.replace(/-+/g, '-').replace(/^-|-$/g, '');
  return slug ? `race_${slug}` : 'race_overig';
}

/**
 * Voegt "de" toe vóór een wedstrijdnaam, tenzij die zelf al met een lidwoord
 * begint (case-insensitief op "de"/"het", zodat "De Gouden Loop" niet
 * "de De Gouden Loop" wordt).
 */
function raceNamePhrase(raceName: string): string {
  return /^(de|het)\s/i.test(raceName) ? raceName : `de ${raceName}`;
}

// ── 16. Interval-cues — gesproken cues tijdens een intervaltraining ─────────
// Aparte cue-groep naast INTRO_TEXTS: 'interval' is geen gewoon trainingstype
// uit die tabel maar krijgt een eigen intro (intro_interval, via
// intervalIntroUtterance) en een eigen set cues die tíjdens het lopen klinken
// (warming-up, aftellen, aanzetten, halverwege, laatste tien seconden,
// herstellen, halverwege de reeks, cooling-down). Waar herhaling anders saai
// zou worden staan meerdere varianten die rouleren (zelfde rouleeropzet als
// ENC_MESSAGES/HR_TEXTS/GREET_TEXTS hierboven, modulo op de lengte van de
// lijst). "Drie, twee, één." (iv_countdown) is een vaste clip die vóór elke
// "ga"-cue klinkt; in de fallbackText schrijven we "een" zonder trema (leest
// voor de telefoonstem prettiger), de clip-tekst zelf houdt het trema aan.
const INTRO_INTERVAL_TEXT =
  'Vandaag: een intervaltraining. We wisselen stevige inspanning af met rustig herstel. Ik tel je overal doorheen, jij hoeft alleen maar te lopen.';

const IV_COUNTDOWN_FALLBACK = 'Drie, twee, een.';

const IV_FIXED_TEXTS: Record<string, string> = {
  iv_warmup: 'We beginnen met een rustige warming-up. Loop losjes in en maak je lichaam wakker.',
  iv_countdown: 'Drie, twee, één.',
  iv_go_last: 'Laatste interval. Alles wat je hebt, geef het nu.',
  iv_work_half: 'Halverwege. Blijf sterk en houd je vorm vast.',
  iv_set_half: 'Je bent op de helft van je intervallen. Lekker bezig.',
  iv_cooldown: 'Dat waren al je intervallen, sterk gewerkt. We sluiten af met een rustige cooling-down. Loop losjes uit.',
};

const IV_GET_READY_TEXTS: string[] = [
  'Bijna. Maak je klaar voor de volgende versnelling.',
  'Zet je schrap, we gaan zo weer aan.',
  'Nog even, dan gaan we er weer voor.',
  'Klaar maken, de volgende komt eraan.',
];

const IV_GO_TEXTS: string[] = [
  'Gaan! Zet aan.',
  'Nu versnellen. Sterk en soepel.',
  'Volle focus, dit is jouw interval.',
  'Aanzetten! Voel de kracht in je benen.',
  'Erop! Laat zien wat je kan.',
  'Nu vol gas, dit is jouw moment.',
];

const IV_WORK_END_TEXTS: string[] = [
  'Nog tien seconden. Volhouden.',
  'Bijna, laatste tien tellen. Doorzetten.',
  'Tien seconden nog, geef alles.',
  'Bijna klaar met deze, hou vol.',
];

const IV_RECOVER_TEXTS: string[] = [
  'Mooi. Loop nu rustig uit en herstel.',
  'Goed gedaan. Adem diep en laat je hartslag zakken.',
  'Sterk. Dribbel rustig door, klaar voor de volgende.',
  'Knap. Even bijkomen, schud je armen los.',
  'Sterk werk. Rustig ademen, laat het los.',
  'Goed zo. Loop rustig door en herstel even.',
];

// ── 17. Warming-up & cooling-down — losse routine (CP3) ─────────────────────
// Losstaand van een geplande sessie: een gebruiker start deze routine via een
// eigen knop (zie app/routine/warmup.tsx en cooldown.tsx), niet gekoppeld aan
// active.tsx of aan een sessietype. Intervalsessies hebben al hun EIGEN,
// stille warming-up/cooling-down-fase met een korte cue (iv_warmup/
// iv_cooldown, zie sectie 16) — dat blijft ongewijzigd; deze routine is een
// apart, uitgebreider stap-voor-stap-format voor wie dat losstaand wil doen.
// Zinnen mogen hier langer zijn (±60-80 tekens, zie het creditplan) omdat het
// er maar 15 zijn. Stapduren (voor de timer in de UI) staan in
// src/data/warmupCooldown.ts, niet hier — dit bestand bevat alleen teksten.
const WU_INTRO_TEXT = 'We beginnen met een korte warming-up. Volg de stappen rustig op je eigen tempo.';
const WU_DONE_TEXT = 'Mooi zo, je bent los en warm. Veel plezier met je training!';
const WU_STEP_TEXTS: string[] = [
  'Begin met een minuut rustig dribbelen ter plaatse.',
  'Draai losjes met beide armen, eerst naar voren, dan naar achteren.',
  'Til om de beurt je knieën vijf keer flink op, allebei de kanten.',
  'Zwaai je benen om de beurt losjes naar voren en naar achteren.',
  'Doe drie lichte uitvalspassen per been om je benen wakker te maken.',
  'Rond af met dertig seconden rustig joggen op de plek.',
];

const CD_INTRO_TEXT = 'Tijd om rustig af te sluiten. Volg de stappen op je gemak.';
const CD_DONE_TEXT = 'Goed gedaan. Je spieren komen weer tot rust.';
// De drie rekstappen zijn eenzijdig: ze rekken één been tegelijk. Ze duren
// elk dertig seconden (zie COOLDOWN_STEP_DURATIONS_SEC in
// src/data/warmupCooldown.ts), dus de tekst noemt zelf het wisselmoment na
// vijftien seconden. Zonder die zin zou een loper die de stem letterlijk
// volgt maar één been rekken.
const CD_STEP_TEXTS: string[] = [
  'Loop nog drie minuten rustig uit en laat je hartslag geleidelijk zakken.',
  'Rek je kuiten: duw een hiel in de grond en leun rustig naar voren. Wissel na vijftien seconden van been.',
  'Rek je hamstrings: strek een been en buig langzaam voorover. Wissel na vijftien seconden van been.',
  'Rek je quadriceps: pak je enkel vast en trek je hiel richting je bil. Wissel na vijftien seconden van been.',
  'Adem een paar keer rustig diep in en uit, en voel hoe je ontspant.',
];

// ── 18. Techniek-cues tijdens lange duurlopen (CP7) ──────────────────────────
// Korte, rustige houdings-/ademhalingstips die alleen tijdens sessietype
// 'long' klinken (zie useTechniqueCoaching.ts) — bij kortere trainingen is
// hier geen ruimte/noodzaak voor. Rouleren net als ENC_MESSAGES, modulo de
// lijstlengte.
const TECH_TEXTS: string[] = [
  'Check je houding: rechte rug, ontspannen schouders.',
  'Adem rustig en diep, laat je ademhaling je tempo bepalen.',
  'Land zacht, onder je zwaartepunt, niet ver vooruit.',
  'Laat je armen ontspannen meebewegen, niet spannen.',
  'Kijk vooruit, hou je hoofd in het verlengde van je rug.',
  'Voel je voeten, licht en snel contact met de grond.',
  'Ontspan je kaak en je handen, dat scheelt energie.',
  'Blijf rechtop, ook als je moe wordt. Kleine pas, hoge cadans.',
];

// ── 19. Mentale pep-talk vóór een race of lange duurloop (CP7) ──────────────
// Eén extra motivatiezin, ALLEEN voor de sessie-intro (niet los aan te
// roepen) — zie het optionele `pep`-argument van sessionIntroUtterance
// hieronder. Getriggerd door de aanroeper (active.tsx) bij sessietype 'long'
// of de RACE-dagsessie van een actief wedstrijdschema (zelfde detectie als
// raceFinishUtterance). Rouleert net als de andere sessie-intro-varianten.
const PEP_TEXTS: string[] = [
  'Denk aan je waarom. Je hebt hiervoor getraind.',
  'Je bent klaar voor dit moment. Vertrouw op je training.',
  'Elke kilometer die je al hebt gelopen, bracht je hier. Ga ervoor.',
  'Dit is jouw moment. Geniet ervan en geef wat je hebt.',
];

// ── Catalogus-enumeratie ─────────────────────────────────────────────────────

export interface CatalogPhrase {
  id: string;
  text: string;
}

/**
 * Geeft ALLE clips terug die het generatiescript (fase B) met ElevenLabs
 * moet aanmaken — ongeacht of ze ooit tijdens een sessie gebruikt worden.
 * Dit is de volledige catalogus uit het ontwerpdocument (±560 clips).
 */
export function allPhrases(): CatalogPhrase[] {
  const phrases: CatalogPhrase[] = [];

  // 1. Km-split
  for (let km = KM_SPLIT_MIN; km <= KM_SPLIT_MAX; km++) {
    phrases.push({ id: `km_${km}`, text: `${km} kilometer.` });
  }

  // 2. Tempo
  for (let min = PACE_MIN_MIN; min <= PACE_MIN_MAX; min++) {
    for (let sec = 0; sec <= 55; sec += PACE_SEC_STEP) {
      phrases.push({
        id: `pace_${min}_${sec}`,
        text: sec === 0
          ? `Tempo ${min} minuten per kilometer.`
          : `Tempo ${min} minuten en ${sec} seconden per kilometer.`,
      });
    }
  }

  // 3. Aanmoedigingen
  ENC_MESSAGES.forEach((text, i) => {
    phrases.push({ id: `enc_${i}`, text });
  });

  // 4. Resterend
  for (let km = KM_RANGE_MIN; km <= KM_RANGE_MAX + 1e-9; km += 0.5) {
    phrases.push({
      id: `rem_${halfStepSuffix(km)}`,
      text: `Nog ongeveer ${formatHalfKm(km)} kilometer te gaan.`,
    });
  }

  // 5. Afstand gelopen
  for (let km = KM_RANGE_MIN; km <= KM_RANGE_MAX + 1e-9; km += 0.5) {
    phrases.push({
      id: `dist_${halfStepSuffix(km)}`,
      text: `Je hebt ongeveer ${formatHalfKm(km)} kilometer gelopen.`,
    });
  }

  // 6. Tijd — enkelvoud voor precies 1 minuut ("In 1 minuut.")
  for (let m = 1; m <= TIME_FINE_MAX; m++) {
    phrases.push({ id: `time_${m}`, text: m === 1 ? 'In 1 minuut.' : `In ${m} minuten.` });
  }
  for (let m = TIME_FINE_MAX + TIME_STEP_ABOVE; m <= TIME_MAX; m += TIME_STEP_ABOVE) {
    phrases.push({ id: `time_${m}`, text: `In ${m} minuten.` });
  }

  // 7. Zones
  ZONE_IDS.forEach((zx, i) => {
    phrases.push({ id: `zone_${zx}`, text: `Zone ${i + 1}. ${ZONE_DESCRIPTIONS[zx]}` });
  });

  // 8. Hartslagcoaching — varianten per type
  (Object.keys(HR_TEXTS) as Array<keyof typeof HR_TEXTS>).forEach(key => {
    HR_TEXTS[key].forEach((text, i) => {
      phrases.push({ id: `hr_${key}_${i}`, text });
    });
  });

  // 9. Mijlpalen
  ([25, 50, 75] as const).forEach(pct => {
    phrases.push({ id: `mile_${pct}`, text: MILE_TEXTS[pct] });
  });
  phrases.push({ id: 'halfway', text: HALFWAY_TEXT });

  // 10. Navigatie
  Object.entries(TURN_TEXTS).forEach(([id, text]) => {
    phrases.push({ id, text });
  });

  // 10b. Van-de-route-afdwalen
  OFFROUTE_TEXTS.forEach((text, i) => {
    phrases.push({ id: `route_off_${i}`, text });
  });
  phrases.push({ id: 'route_on', text: BACK_ON_ROUTE_TEXT });

  // 11. Nav-afstand
  for (let m = DIST_M_MIN; m <= DIST_M_MAX; m += DIST_M_STEP) {
    phrases.push({ id: `dist_m_${m}`, text: `Over ${m} meter:` });
  }

  // 12. Vast
  Object.entries(FIXED_TEXTS).forEach(([id, text]) => {
    phrases.push({ id, text });
  });

  // 13. Sessie-intro
  (Object.keys(INTRO_TEXTS) as Array<keyof typeof INTRO_TEXTS>).forEach(type => {
    phrases.push({ id: `intro_${type}`, text: INTRO_TEXTS[type] });
  });

  // 14. Doel
  for (let km = KM_RANGE_MIN; km <= KM_RANGE_MAX + 1e-9; km += 0.5) {
    phrases.push({
      id: `goal_${halfStepSuffix(km)}`,
      text: `Het doel is ongeveer ${formatHalfKm(km)} kilometer.`,
    });
  }

  // 15. Race-felicitaties — op naam gesleuteld (zie sectie 15 hierboven), dus
  // ontdubbeld: dezelfde naam in meerdere edities/steden = één clip. De eerste
  // voorkomende naam wint; identieke slugs leveren immers identieke tekst op.
  const raceClipTexts = new Map<string, string>();
  [...RACE_LIST.map(race => race.name), ...EXTRA_RACE_VOICE_NAMES].forEach(name => {
    const id = raceVoiceClipId(name);
    if (!raceClipTexts.has(id)) {
      raceClipTexts.set(id, `Gefeliciteerd! Je hebt ${raceNamePhrase(name)} uitgelopen!`);
    }
  });
  raceClipTexts.forEach((text, id) => {
    phrases.push({ id, text });
  });
  phrases.push({ id: 'race_generic', text: RACE_GENERIC_TEXT });

  // 15b. Dagdeel-begroeting
  (Object.keys(GREET_TEXTS) as Array<keyof typeof GREET_TEXTS>).forEach(period => {
    GREET_TEXTS[period].forEach((text, i) => {
      phrases.push({ id: `greet_${period}_${i}`, text });
    });
  });

  // 15c. Finish-afsluiters — index 0 is 'well_done' (al in FIXED_TEXTS), dus
  // hier alleen de 3 nieuwe varianten.
  FINISH_CLOSERS.slice(1).forEach((text, i) => {
    phrases.push({ id: `finish_var_${i + 1}`, text });
  });

  // 16. Interval-cues
  phrases.push({ id: 'intro_interval', text: INTRO_INTERVAL_TEXT });
  Object.entries(IV_FIXED_TEXTS).forEach(([id, text]) => {
    phrases.push({ id, text });
  });
  IV_GET_READY_TEXTS.forEach((text, i) => {
    phrases.push({ id: `iv_get_ready_${i}`, text });
  });
  IV_GO_TEXTS.forEach((text, i) => {
    phrases.push({ id: `iv_go_${i}`, text });
  });
  IV_WORK_END_TEXTS.forEach((text, i) => {
    phrases.push({ id: `iv_work_end_${i}`, text });
  });
  IV_RECOVER_TEXTS.forEach((text, i) => {
    phrases.push({ id: `iv_recover_${i}`, text });
  });

  // 17. Warming-up & cooling-down (losse routine)
  phrases.push({ id: 'wu_intro', text: WU_INTRO_TEXT });
  WU_STEP_TEXTS.forEach((text, i) => {
    phrases.push({ id: `wu_step_${i}`, text });
  });
  phrases.push({ id: 'wu_done', text: WU_DONE_TEXT });

  phrases.push({ id: 'cd_intro', text: CD_INTRO_TEXT });
  CD_STEP_TEXTS.forEach((text, i) => {
    phrases.push({ id: `cd_step_${i}`, text });
  });
  phrases.push({ id: 'cd_done', text: CD_DONE_TEXT });

  // 18. Techniek-cues
  TECH_TEXTS.forEach((text, i) => {
    phrases.push({ id: `tech_${i}`, text });
  });

  // 19. Mentale pep-talk
  PEP_TEXTS.forEach((text, i) => {
    phrases.push({ id: `pep_${i}`, text });
  });

  return phrases;
}

// ── Compositiefuncties ───────────────────────────────────────────────────────

/**
 * Eén gesproken boodschap: de clip-ids die (in fase C) na elkaar afgespeeld
 * worden, plús de volledige natuurlijke zin als vangnet voor de telefoonstem
 * (fase A: dit vangnet is altijd wat er daadwerkelijk klinkt).
 */
export type PhraseUtterance = {
  ids: string[];
  fallbackText: string;
  /**
   * Alternatieve clip-reeksen, op volgorde geprobeerd zodra `ids` niet
   * VOLLEDIG in het stempakket zit (voiceService speelt een reeks immers
   * alleen af als elke clip erin bestaat). Bedoeld voor boodschappen die een
   * minder specifieke, maar nog altijd echte-stem-variant hebben — nu alleen
   * de race-felicitatie (zie raceFinishUtterance). Blijft elke reeks
   * onvolledig, dan spreekt de telefoonstem gewoon de fallbackText.
   */
  altIds?: string[][];
};

/**
 * Km-split tijdens het lopen: "5 kilometer, tempo 5 minuten en 30 seconden
 * per kilometer. Super! Blijf gelijkmatig lopen."
 *
 * De fallbackText gebruikt het EXACTE tempo (niet afgerond) — precies zoals
 * useVoiceGuidance dat nu al doet. De clip-ids gebruiken het afgeronde tempo
 * (seconden op een veelvoud van 5) omdat anders elk denkbaar tempo een eigen
 * clip zou vergen.
 */
export function kmSplitUtterance(completedKm: number, paceSecPerKm: number): PhraseUtterance {
  const kmId = `km_${clamp(completedKm, KM_SPLIT_MIN, KM_SPLIT_MAX)}`;
  const encIndex = (completedKm - 1) % ENC_MESSAGES.length;
  const encId = `enc_${encIndex}`;

  const ids = [kmId];
  let paceStr = '';
  if (paceSecPerKm > 0) {
    // Clip-tempo: seconden afgerond op 5, met overloop naar de minuut.
    let totalSec = Math.round(paceSecPerKm);
    let min = Math.floor(totalSec / 60);
    let sec = Math.round((totalSec % 60) / PACE_SEC_STEP) * PACE_SEC_STEP;
    if (sec === 60) { sec = 0; min += 1; }
    min = clamp(min, PACE_MIN_MIN, PACE_MIN_MAX);
    ids.push(`pace_${min}_${sec}`);

    // Fallback-tempo: exact, niet afgerond (huidig gedrag).
    const paceMin = Math.floor(paceSecPerKm / 60);
    const paceSec = Math.round(paceSecPerKm % 60);
    paceStr = `, tempo ${paceMin} minuten en ${paceSec} seconden per kilometer`;
  }
  ids.push(encId);

  const encouragement = ENC_MESSAGES[encIndex];
  return {
    ids,
    fallbackText: `${completedKm} kilometer${paceStr}. ${encouragement}`,
  };
}

/**
 * Halverwege de geplande sessieafstand (niet te verwarren met de
 * routevoortgang van useRouteCoaching, zie milestoneUtterance). Zin: ids
 * [halfway, rem_X] — zie de toelichting bij HALFWAY_TEXT hierboven.
 */
export function halfwayUtterance(remainingKm: number): PhraseUtterance {
  const remId = `rem_${halfStepSuffix(roundHalfClamped(remainingKm, KM_RANGE_MIN, KM_RANGE_MAX))}`;
  const remaining = remainingKm.toFixed(1);
  return {
    ids: ['halfway', remId],
    fallbackText: `Halverwege! Nog ${remaining} kilometer te gaan. Je doet het geweldig.`,
  };
}

/**
 * Sessie voltooid: "Sessie voltooid! Je hebt 8,23 kilometer gelopen in 52
 * minuten. Geweldig gedaan!" Tijd in de clip-versie in hele/vijf minuten
 * (zie TIME_FINE_MAX/TIME_STEP_ABOVE), de fallback-tijd blijft exact
 * (minuten + seconden, huidig gedrag).
 *
 * `variant` rouleert de afsluitzin (0 = "Geweldig gedaan!"/well_done, 1+ de
 * varianten finish_var_1..) zodat een gebruiker die vaak loopt niet elke
 * keer exact dezelfde felicitatie hoort — zie CP4/CP6 in
 * Elevenlabs-creditplan-aug-2026.md. De aanroeper (useVoiceGuidance) geeft
 * hiervoor het aantal voltooide sessies mee; deze functie klemt zelf modulo
 * de daadwerkelijke lijstlengte.
 */
export function finishUtterance(
  distanceKm: number,
  durationSeconds: number,
  variant: number = 0,
): PhraseUtterance {
  const distId = `dist_${halfStepSuffix(roundHalfClamped(distanceKm, KM_RANGE_MIN, KM_RANGE_MAX))}`;

  const totalMinutes = durationSeconds / 60;
  let timeMin = totalMinutes <= TIME_FINE_MAX
    ? Math.round(totalMinutes)
    : Math.round(totalMinutes / TIME_STEP_ABOVE) * TIME_STEP_ABOVE;
  timeMin = clamp(timeMin, 1, TIME_MAX);
  const timeId = `time_${timeMin}`;

  const km = distanceKm.toFixed(2);
  const mins = Math.floor(durationSeconds / 60);
  const secs = durationSeconds % 60;
  const timeStr = secs > 0 ? `${mins} minuten en ${secs} seconden` : `${mins} minuten`;

  const idx = ((variant % FINISH_CLOSERS.length) + FINISH_CLOSERS.length) % FINISH_CLOSERS.length;
  const closerId = idx === 0 ? 'well_done' : `finish_var_${idx}`;
  const closerText = FINISH_CLOSERS[idx];

  return {
    ids: ['finish', distId, timeId, closerId],
    fallbackText: `Sessie voltooid! Je hebt ${km} kilometer gelopen in ${timeStr}. ${closerText}`,
  };
}

/** Hartslagzone-overgang: "Zone 3. Tempozone. Uitdagend maar houdbaar." */
export function zoneUtterance(zone: string): PhraseUtterance {
  const desc = ZONE_DESCRIPTIONS[zone] ?? zone;
  const fallbackText = `Zone ${zone}. ${desc}`;
  // Onbekende/onverwachte zone-waarde: geen catalogusclip, alleen fallback
  // (verdedigend — kan in theorie niet gebeuren, ZONE_IDS dekt Z1..Z5).
  if (!(zone in ZONE_DESCRIPTIONS)) return { ids: [], fallbackText };
  return { ids: [`zone_${zone}`], fallbackText };
}

/**
 * Hartslagcoaching: één van de drie types, met een variant (0/1/2) zodat
 * herhaalde meldingen van hetzelfde type niet steeds identiek klinken. De
 * aanroeper (useHeartRateCoaching) rouleert de variant per type. Een
 * ongeldige/ontbrekende variant klemt terug naar 0..2 (modulo), zodat deze
 * functie nooit een niet-bestaande clip-id kan opleveren.
 */
export function hrUtterance(kind: 'high' | 'low' | 'ok', variant: number = 0): PhraseUtterance {
  const texts = HR_TEXTS[kind];
  const idx = ((variant % texts.length) + texts.length) % texts.length;
  return { ids: [`hr_${kind}_${idx}`], fallbackText: texts[idx] };
}

/**
 * Routevoortgangsmijlpaal (25/50/75% van de UITGESTIPPELDE route, zie
 * useRouteCoaching): "Een kwart van je route voltooid. Nog 7,5 kilometer te
 * gaan."
 */
export function milestoneUtterance(pct: 25 | 50 | 75, remainingKm: number): PhraseUtterance {
  const remId = `rem_${halfStepSuffix(roundHalfClamped(remainingKm, KM_RANGE_MIN, KM_RANGE_MAX))}`;
  const remaining = remainingKm.toFixed(1);
  return {
    ids: [`mile_${pct}`, remId],
    fallbackText: `${MILE_TEXTS[pct]} Nog ${remaining} kilometer te gaan.`,
  };
}

/**
 * Herkent het afslagtype uit de (al naar het Nederlands vertaalde)
 * instructietekst — dezelfde patronen als toNl() in routeService.ts.
 * Onherkend → null (dan spreekt alleen de fallback, geen catalogusclip).
 */
function detectTurnType(instructionText: string): string | null {
  const haystack = instructionText.toLowerCase();
  for (const [pattern, id] of TURN_PATTERNS) {
    if (haystack.includes(pattern)) return id;
  }
  return null;
}

/**
 * Turn-by-turn navigatie-aankondiging. Geen straatnamen in de clip-ids
 * (privacy/eindigheid) — de fallbackText bevat wel de volledige
 * instructietekst (incl. eventuele straatnaam) met dezelfde "Over X meter: "
 * -prefix als het huidige gedrag. `distM` is hier al de afgeronde afstand
 * (of undefined als er geen afstandsprefix gebruikt wordt) — zie de
 * aanroep in useRouteCoaching.ts. Onherkend instructietype → ids: [].
 */
export function navUtterance(instructionText: string, distM?: number): PhraseUtterance {
  const prefix = distM !== undefined ? `Over ${distM} meter: ` : '';
  const fallbackText = `${prefix}${instructionText}`;

  const turnId = detectTurnType(instructionText);
  if (!turnId) return { ids: [], fallbackText };

  const ids: string[] = [];
  if (distM !== undefined) {
    const rounded = clamp(Math.round(distM / 10) * 10, DIST_M_MIN, DIST_M_MAX);
    ids.push(`dist_m_${rounded}`);
  }
  ids.push(turnId);

  return { ids, fallbackText };
}

/**
 * Van-de-route-afgedwaald-melding (off-route-detectie tijdens het lopen,
 * zie de toelichting bij OFFROUTE_TEXTS in sectie 10b hierboven). `variant`
 * rouleert tussen de twee teksten (modulo, zelfde opzet als hrUtterance/
 * techniqueCueUtterance) zodat een loper die vaker afwijkt niet steeds
 * dezelfde melding hoort.
 */
export function offRouteUtterance(variant: number = 0): PhraseUtterance {
  const idx = ((variant % OFFROUTE_TEXTS.length) + OFFROUTE_TEXTS.length) % OFFROUTE_TEXTS.length;
  return { ids: [`route_off_${idx}`], fallbackText: OFFROUTE_TEXTS[idx] };
}

/** Terug-op-route-melding: kort en bevestigend, geen varianten nodig. */
export function backOnRouteUtterance(): PhraseUtterance {
  return { ids: ['route_on'], fallbackText: BACK_ON_ROUTE_TEXT };
}

/** Onboarding-begroeting (stemkeuzescherm). */
export function greetingUtterance(): PhraseUtterance {
  return { ids: ['greeting'], fallbackText: FIXED_TEXTS.greeting };
}

/** Stem-preview in de instellingen. */
export function previewUtterance(): PhraseUtterance {
  return { ids: ['preview'], fallbackText: FIXED_TEXTS.preview };
}

/**
 * Dagdeel-begroeting bij sessiestart (fase E, CP4): "Goedemorgen! Klaar voor
 * je ochtendrun?" `hour` is 0-23 (de aanroeper geeft new Date().getHours()
 * mee — als parameter in plaats van intern opgevraagd, zodat deze functie
 * deterministisch test-baar blijft). Grenzen: ochtend 5-11, middag 12-17,
 * avond 18-4 (nacht/vroege ochtend telt als avond — geen aparte "nacht"-
 * variant, dat zou de catalogus vergroten voor een zeldzaam moment). `variant`
 * rouleert (modulo 2), zelfde opzet als de aanmoedigingen.
 */
export function greetingForSessionStart(hour: number, variant: number = 0): PhraseUtterance {
  const period: 'morning' | 'afternoon' | 'evening' =
    hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'afternoon' : 'evening';
  const texts = GREET_TEXTS[period];
  const idx = ((variant % texts.length) + texts.length) % texts.length;
  return { ids: [`greet_${period}_${idx}`], fallbackText: texts[idx] };
}

/**
 * Gesproken sessie-intro bij de start van een geplande sessie (fase E, zie
 * app/session/active.tsx): "Goedemorgen! Klaar voor je ochtendrun? Vandaag:
 * een tempotraining. Het doel is ongeveer 8,5 kilometer. Zone 3. Tempozone.
 * Uitdagend maar houdbaar. Veel plezier!"
 *
 * `zone` is optioneel en alleen gebruikt als hij een bekende ZONE_IDS-waarde
 * is — een onbekende/ontbrekende zone laat de zone-clip gewoon weg (net als
 * de rest van deze catalogus: nooit een niet-bestaande clip-id opleveren).
 * De fallbackText gebruikt de EXACTE sessieafstand (niet afgerond, in
 * tegenstelling tot de clip-versie via goal_X) zodat de telefoonstem-fallback
 * dezelfde precisie heeft als het scherm.
 *
 * `greeting` is optioneel (CP4): meegeven om de dagdeel-begroeting vóór de
 * intro te laten klinken, als ÉÉN doorlopende uitspraak (twee losse
 * speakPhrases-aanroepen zouden elkaar afkappen, zie de toelichting bij
 * finish/raceFinishUtterance in active.tsx). Zonder dit argument (bijv. de
 * race-felicitatie-tak, die geen sessie-intro gebruikt) verandert er niets
 * aan bestaand gedrag.
 *
 * `pepVariant` is optioneel (CP7): meegeven om er, vóór "Veel plezier!", één
 * mentale pep-talk-zin (pep_0.., zie sectie 19) doorheen te weven — bedoeld
 * voor een lange duurloop of de RACE-dagsessie, waar dat moment het meest
 * betekenisvol is. De aanroeper (active.tsx) bepaalt óf dit meegegeven wordt
 * (sessietype/race-detectie); deze functie rouleert alleen de variant, net
 * als greeting hierboven.
 */
export function sessionIntroUtterance(
  type: 'easy' | 'tempo' | 'long' | 'cross',
  distanceKm: number,
  zone?: string,
  greeting?: { hour: number; variant?: number },
  pepVariant?: number,
): PhraseUtterance {
  const ids: string[] = [];
  let greetSentence = '';
  if (greeting) {
    const g = greetingForSessionStart(greeting.hour, greeting.variant);
    ids.push(...g.ids);
    greetSentence = `${g.fallbackText} `;
  }

  const goalId = `goal_${halfStepSuffix(roundHalfClamped(distanceKm, KM_RANGE_MIN, KM_RANGE_MAX))}`;
  ids.push(`intro_${type}`, goalId);

  const hasZone = !!zone && zone in ZONE_DESCRIPTIONS;
  if (hasZone) ids.push(`zone_${zone}`);

  let pepSentence = '';
  if (pepVariant !== undefined) {
    const idx = ((pepVariant % PEP_TEXTS.length) + PEP_TEXTS.length) % PEP_TEXTS.length;
    ids.push(`pep_${idx}`);
    pepSentence = ` ${PEP_TEXTS[idx]}`;
  }

  ids.push('have_fun');

  const zoneSentence = hasZone ? ` ${zoneUtterance(zone as string).fallbackText}` : '';
  return {
    ids,
    // Nederlandse notatie met komma (bv. "7,5"), anders leest de telefoonstem
    // de punt voor als "punt".
    fallbackText: `${greetSentence}${INTRO_TEXTS[type]} Het doel is ongeveer ${String(distanceKm).replace('.', ',')} kilometer.${zoneSentence}${pepSentence} Veel plezier!`,
  };
}

/**
 * Eén techniek-cue tijdens een lange duurloop (CP7, sectie 18): een korte
 * houdings-/ademhalingstip. `variant` rouleert modulo de lijstlengte, net als
 * de andere rouleer-teksten in dit bestand — zie useTechniqueCoaching.ts voor
 * de tijdgedreven trigger (elke ~15 minuten, hooguit een handvol per sessie).
 */
export function techniqueCueUtterance(variant: number = 0): PhraseUtterance {
  const idx = ((variant % TECH_TEXTS.length) + TECH_TEXTS.length) % TECH_TEXTS.length;
  return { ids: [`tech_${idx}`], fallbackText: TECH_TEXTS[idx] };
}

/**
 * Race-felicitatie bij het uitlopen van de RACE-sessie van de laatste week
 * van een wedstrijdschema (fase E, zie app/session/active.tsx).
 *
 * Sleutelt op de NAAM (`raceVoiceClipId`), niet op `raceId` — zie sectie 15
 * voor het waarom. De naam zit in het opgeslagen racePlan en is dus altijd
 * bekend, ook voor een wedstrijd die de app pas via een serverupdate kent
 * (`setRaceCountriesOverride`). Er wordt hier bewust NIET meer gecontroleerd
 * of de wedstrijd in rotterdamRaces.ts voorkomt: die controle las een
 * momentopname van de gebundelde lijst en sloot serverwedstrijden dus juist
 * uit. Ontbreekt de clip in het pakket, dan lost voiceService dat al netjes
 * op via de reeksen hieronder.
 *
 * Drie niveaus, in deze volgorde:
 *  1. de clip van deze wedstrijdnaam;
 *  2. het oude, op wedstrijd-id gesleutelde clip-id — zodat een gebruiker die
 *     nog een ouder stempakket op de telefoon heeft staan de felicitatie toch
 *     in de echte stem hoort (die pakketten kennen alleen `race_{id}`);
 *  3. de naamloze vangnetclip ("Je hebt je wedstrijd uitgelopen!").
 * Lukt geen van drieën, dan spreekt de telefoonstem de volledige zin mét naam.
 */
export function raceFinishUtterance(raceId: string, raceName: string): PhraseUtterance {
  return {
    ids: [raceVoiceClipId(raceName)],
    altIds: [[`race_${raceId}`], ['race_generic']],
    fallbackText: `Gefeliciteerd! Je hebt ${raceNamePhrase(raceName)} uitgelopen!`,
  };
}

/**
 * Gesproken intro bij de start van een intervalsessie (vervangt de gewone
 * sessie-intro voor type 'interval'). Optioneel met dagdeel-begroeting ervoor,
 * net als sessionIntroUtterance, en afgesloten met "Veel plezier!".
 */
export function intervalIntroUtterance(
  greeting?: { hour: number; variant?: number },
): PhraseUtterance {
  const ids: string[] = [];
  let greetSentence = '';
  if (greeting) {
    const g = greetingForSessionStart(greeting.hour, greeting.variant);
    ids.push(...g.ids);
    greetSentence = `${g.fallbackText} `;
  }

  ids.push('intro_interval', 'have_fun');

  return {
    ids,
    fallbackText: `${greetSentence}${INTRO_INTERVAL_TEXT} Veel plezier!`,
  };
}

/**
 * Eén interval-cue tijdens het lopen. `kind` bepaalt het moment; `opts.variant`
 * rouleert waar er varianten zijn (modulo), `opts.isLast` markeert de laatste
 * werkherhaling.
 */
export function intervalCueUtterance(
  kind: 'warmup' | 'getReady' | 'go' | 'workHalf' | 'workEnd' | 'recover' | 'setHalf' | 'cooldown',
  opts?: { variant?: number; isLast?: boolean },
): PhraseUtterance {
  const variant = opts?.variant ?? 0;

  switch (kind) {
    case 'warmup':
      return { ids: ['iv_warmup'], fallbackText: IV_FIXED_TEXTS.iv_warmup };

    case 'getReady': {
      const n = IV_GET_READY_TEXTS.length;
      const idx = ((variant % n) + n) % n;
      return { ids: [`iv_get_ready_${idx}`], fallbackText: IV_GET_READY_TEXTS[idx] };
    }

    case 'go': {
      if (opts?.isLast) {
        return {
          ids: ['iv_countdown', 'iv_go_last'],
          fallbackText: `${IV_COUNTDOWN_FALLBACK} ${IV_FIXED_TEXTS.iv_go_last}`,
        };
      }
      const n = IV_GO_TEXTS.length;
      const idx = ((variant % n) + n) % n;
      return {
        ids: ['iv_countdown', `iv_go_${idx}`],
        fallbackText: `${IV_COUNTDOWN_FALLBACK} ${IV_GO_TEXTS[idx]}`,
      };
    }

    case 'workHalf':
      return { ids: ['iv_work_half'], fallbackText: IV_FIXED_TEXTS.iv_work_half };

    case 'workEnd': {
      const n = IV_WORK_END_TEXTS.length;
      const idx = ((variant % n) + n) % n;
      return { ids: [`iv_work_end_${idx}`], fallbackText: IV_WORK_END_TEXTS[idx] };
    }

    case 'recover': {
      const n = IV_RECOVER_TEXTS.length;
      const idx = ((variant % n) + n) % n;
      return { ids: [`iv_recover_${idx}`], fallbackText: IV_RECOVER_TEXTS[idx] };
    }

    case 'setHalf':
      return { ids: ['iv_set_half'], fallbackText: IV_FIXED_TEXTS.iv_set_half };

    case 'cooldown':
      return { ids: ['iv_cooldown'], fallbackText: IV_FIXED_TEXTS.iv_cooldown };
  }
}

/** Aantal stappen in de warming-up-routine (CP3) — voor de UI-stepper. */
export const WU_STEP_COUNT = WU_STEP_TEXTS.length;
/** Aantal stappen in de cooling-down-routine (CP3) — voor de UI-stepper. */
export const CD_STEP_COUNT = CD_STEP_TEXTS.length;

/**
 * Eén moment van de losstaande warming-up-routine (CP3, zie sectie 17
 * hierboven): 'intro' bij de start, een 0-based stapindex per oefening, of
 * 'done' aan het eind. Een stapindex buiten bereik klemt naar de dichtstbij-
 * zijnde geldige stap, zodat deze functie nooit een niet-bestaande clip-id
 * kan opleveren.
 */
export function warmupUtterance(step: 'intro' | number | 'done'): PhraseUtterance {
  if (step === 'intro') return { ids: ['wu_intro'], fallbackText: WU_INTRO_TEXT };
  if (step === 'done') return { ids: ['wu_done'], fallbackText: WU_DONE_TEXT };
  const idx = clamp(Math.round(step), 0, WU_STEP_TEXTS.length - 1);
  return { ids: [`wu_step_${idx}`], fallbackText: WU_STEP_TEXTS[idx] };
}

/**
 * Eén moment van de losstaande cooling-down-routine (CP3). Zelfde vorm als
 * warmupUtterance hierboven. Bewust een andere naam dan de bestaande
 * intervalCueUtterance('cooldown') — dat is de korte, enkele cue tijdens een
 * intervaltraining (sectie 16), dit is de uitgebreide, losstaande routine.
 */
export function cooldownRoutineUtterance(step: 'intro' | number | 'done'): PhraseUtterance {
  if (step === 'intro') return { ids: ['cd_intro'], fallbackText: CD_INTRO_TEXT };
  if (step === 'done') return { ids: ['cd_done'], fallbackText: CD_DONE_TEXT };
  const idx = clamp(Math.round(step), 0, CD_STEP_TEXTS.length - 1);
  return { ids: [`cd_step_${idx}`], fallbackText: CD_STEP_TEXTS[idx] };
}
