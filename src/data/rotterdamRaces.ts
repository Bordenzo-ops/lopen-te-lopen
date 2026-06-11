/**
 * Hardloopwedstrijden Nederland — gestructureerd per provincie > stad
 *
 * Voeg nieuwe wedstrijden toe door een nieuw object in de juiste stad te plaatsen.
 * Voeg een nieuwe stad toe door een nieuw object in de juiste provincie te plaatsen.
 * Voeg een nieuwe provincie toe door een nieuw object in PROVINCES te plaatsen.
 */

export type RaceDistance = '5km' | '10km' | 'half_marathon' | 'marathon';

export interface Race {
  id: string;
  name: string;
  /** ISO datum van de wedstrijd */
  date: string;
  distance: RaceDistance;
  url?: string;
  description: string;
  location: string;
  accentColor: string;
  registrationOpen?: boolean;
  /**
   * Uitgelicht als ultiem doel — krijgt speciale UI-behandeling.
   */
  featured?: boolean;
  /**
   * Optioneel: meerdere afstanden binnen hetzelfde event.
   * Als dit veld aanwezig is, wordt de race als "evenement-groep"
   * getoond met een sub-dropdown per afstand.
   */
  subRaces?: Race[];
}

export interface RaceCity {
  id: string;
  name: string;
  races: Race[];
}

export interface RaceProvince {
  id: string;
  name: string;
  cities: RaceCity[];
}

// ── Data ──────────────────────────────────────────────────────────────────────

export const PROVINCES: RaceProvince[] = [
  {
    id: 'zuid-holland',
    name: 'Zuid-Holland',
    cities: [
      {
        id: 'rotterdam',
        name: 'Rotterdam',
        races: [
          {
            id: 'dam2dam-2025',
            name: 'Dam tot Damloop',
            date: '2025-09-14',
            distance: '10km',
            url: 'https://www.damtotdamloop.nl',
            description: 'Iconische 10 km van Amsterdam naar Zaandam. Vlak en snel parcours.',
            location: 'Rotterdam Centrum',
            accentColor: '#3B82F6',
            registrationOpen: false,
          },
          {
            id: 'rotterdam-hm-2025',
            name: 'Rotterdam Halve Marathon',
            date: '2025-09-21',
            distance: 'half_marathon',
            url: 'https://www.rotterdammarathon.nl/halve',
            description: 'De snelste halve marathon van Nederland. Vlak door het hart van Rotterdam.',
            location: 'Rotterdam Centrum',
            accentColor: '#F25011',
            registrationOpen: false,
          },
          {
            id: 'singelloop-2025',
            name: 'Singelloop Rotterdam',
            date: '2025-10-12',
            distance: '10km',
            url: 'https://www.singelloop.nl',
            description: 'Sfeervolle volksloop langs de Rotterdamse singels.',
            location: 'Rotterdamse Singels',
            accentColor: '#8B5CF6',
            registrationOpen: false,
          },
          {
            id: 'marathon-rotterdam-2026',
            name: 'NN Marathon Rotterdam',
            date: '2026-04-05',
            distance: 'marathon',
            url: 'https://www.rotterdammarathon.nl',
            description: 'Een van de snelste marathons ter wereld. Plat parcours, massaal evenement.',
            location: 'Rotterdam Centrum',
            accentColor: '#EF4444',
            registrationOpen: true,
          },
          {
            id: 'rotterdam-10km-2026',
            name: 'Rotterdam 10 KM',
            date: '2026-06-14',
            distance: '10km',
            url: 'https://www.rotterdammarathon.nl',
            description: 'Snelle 10 km door het stadscentrum. Ideale tussentest voor de halve marathon.',
            location: 'Rotterdam Centrum',
            accentColor: '#22C55E',
            registrationOpen: true,
          },
          {
            id: 'rotterdam-hm-2026',
            name: 'Rotterdam Halve Marathon',
            date: '2026-09-20',
            distance: 'half_marathon',
            url: 'https://www.rotterdammarathon.nl/halve',
            description: 'De snelste halve marathon van Nederland. Vlak, snel en met 30.000 deelnemers.',
            location: 'Rotterdam Centrum',
            accentColor: '#F25011',
            registrationOpen: true,
          },
          {
            id: 'singelloop-2026',
            name: 'Singelloop Rotterdam',
            date: '2026-10-11',
            distance: '10km',
            url: 'https://www.singelloop.nl',
            description: 'Sfeervolle loop langs de Rotterdamse singels. Perfect als najaarsafsluiter.',
            location: 'Rotterdamse Singels',
            accentColor: '#8B5CF6',
            registrationOpen: false,
          },
          {
            id: 'nn-marathon-rotterdam-2027',
            name: 'NN Marathon Rotterdam 2027',
            date: '2027-04-11',
            distance: 'marathon',
            url: 'https://www.rotterdammarathon.nl',
            description: 'Een van de snelste marathons ter wereld. Plat parcours door het hart van Rotterdam, erkend als World Athletics Platinum Label. De ultieme test voor iedere hardloper.',
            location: 'Rotterdam Centrum',
            accentColor: '#F25011',
            registrationOpen: false,
            featured: true,
          },
        ],
      },
      {
        id: 'den-haag',
        name: 'Den Haag',
        races: [
          {
            id: 'city-pier-city-2026',
            name: 'City-Pier-City Loop',
            date: '2026-03-15',
            distance: 'half_marathon',
            url: 'https://www.cpc-loop.nl',
            description: 'De CPC Loop: van het centrum van Den Haag naar Scheveningen en terug. Een van de grootste halve marathons van Nederland.',
            location: 'Den Haag Centrum → Scheveningen',
            accentColor: '#F59E0B',
            registrationOpen: true,
          },
          {
            id: 'haagse-kwart-2026',
            name: 'Haagse Kwart',
            date: '2026-05-10',
            distance: '10km',
            url: 'https://www.haagse-kwart.nl',
            description: 'Populaire volksloop door de Haagse wijken. 10 km voor alle niveaus.',
            location: 'Den Haag Centrum',
            accentColor: '#14B8A6',
            registrationOpen: true,
          },
          {
            id: 'scheveningen-5km-2026',
            name: 'Scheveningen Strandloop',
            date: '2026-07-19',
            distance: '5km',
            url: 'https://www.scheveningenstrandloop.nl',
            description: 'Unieke 5 km over het strand van Scheveningen. Zout, zand en zeebries.',
            location: 'Scheveningen Strand',
            accentColor: '#0EA5E9',
            registrationOpen: true,
          },
          {
            id: 'nn-marathon-den-haag-2026',
            name: 'NN Marathon The Hague',
            date: '2026-11-01',
            distance: 'marathon',
            url: 'https://nnmarathonthehague.nl/en/',
            description: 'Gloednieuw evenement op 1 november 2026. Loop door Den Haag langs paleizen, parken en de boulevard van Scheveningen. Kies uit marathon, 10K of 5K.',
            location: 'Den Haag Centrum',
            accentColor: '#F97316',
            registrationOpen: true,
            subRaces: [
              {
                id: 'nn-marathon-den-haag-2026-marathon',
                name: 'NN Marathon The Hague - Marathon',
                date: '2026-11-01',
                distance: 'marathon',
                url: 'https://nnmarathonthehague.nl/en/nn-marathon-the-hague/',
                description: 'De volledige 42,195 km door Den Haag. Een historisch eerste editie.',
                location: 'Den Haag Centrum',
                accentColor: '#EF4444',
                registrationOpen: true,
              },
              {
                id: 'nn-marathon-den-haag-2026-10k',
                name: 'NN The Hague 10K',
                date: '2026-11-01',
                distance: '10km',
                url: 'https://nnmarathonthehague.nl/en/nn-the-hague-10k/',
                description: 'Snelle 10 km door het centrum van Den Haag, op hetzelfde parcours als de marathon.',
                location: 'Den Haag Centrum',
                accentColor: '#F97316',
                registrationOpen: true,
              },
              {
                id: 'nn-marathon-den-haag-2026-5k',
                name: 'The Hague 5K',
                date: '2026-11-01',
                distance: '5km',
                url: 'https://nnmarathonthehague.nl/en/the-hague-5k/',
                description: 'Toegankelijke 5 km voor beginners en recreatieve lopers. Perfect als eerste wedstrijd.',
                location: 'Den Haag Centrum',
                accentColor: '#22C55E',
                registrationOpen: true,
              },
            ],
          },
        ],
      },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Alle wedstrijden plat als array (inclusief sub-races) */
export function getAllRaces(): Race[] {
  return PROVINCES.flatMap(p =>
    p.cities.flatMap(c =>
      c.races.flatMap(r => r.subRaces ? r.subRaces : [r]),
    ),
  );
}

/** Alleen toekomstige wedstrijden */
export function getUpcomingRaces(today = new Date()): Race[] {
  return getAllRaces()
    .filter(r => new Date(r.date) > today)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/** Wedstrijd op ID opzoeken */
export function getRaceById(id: string): Race | undefined {
  return getAllRaces().find(r => r.id === id);
}

/** Weken tot de wedstrijd */
export function weeksUntilRace(raceDate: string, today = new Date()): number {
  const diff = new Date(raceDate).getTime() - today.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 7));
}

/** Leesbare datum, bijv. "zondag 20 september 2026" */
export function formatRaceDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

/** Bereken startdatum schema */
export function schemaStartDate(raceDate: string, totalWeeks: number): Date {
  const race = new Date(raceDate);
  const start = new Date(race);
  start.setDate(race.getDate() - totalWeeks * 7);
  const day = start.getDay();
  const diff = day === 0 ? 1 : (day === 1 ? 0 : 8 - day);
  start.setDate(start.getDate() + diff);
  return start;
}

// Backwards-compat alias voor buildRacePlan
export type RotterdamRace = Race;
export const ROTTERDAM_RACES = getAllRaces();
