/**
 * Hardloopwedstrijden Nederland — gestructureerd per provincie > stad
 *
 * Voeg nieuwe wedstrijden toe door een nieuw object in de juiste stad te plaatsen.
 * Voeg een nieuwe stad toe door een nieuw object in de juiste provincie te plaatsen.
 * Voeg een nieuwe provincie toe door een nieuw object in PROVINCES te plaatsen.
 */

export type RaceDistance = '5km' | '10km' | '15km' | 'half_marathon' | 'marathon';

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
            id: 'city-pier-city-2027',
            name: 'City-Pier-City Loop',
            date: '2027-03-14',
            distance: 'half_marathon',
            url: 'https://www.cpc-loop.nl',
            description: 'De CPC Loop 2027: van het centrum van Den Haag naar Scheveningen en terug. Een van de grootste halve marathons van Nederland.',
            location: 'Den Haag Centrum → Scheveningen',
            accentColor: '#F59E0B',
            registrationOpen: false,
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
      {
        id: 'dordrecht',
        name: 'Dordrecht',
        races: [
          {
            id: 'drechtstadloop-2026',
            name: 'DrechtStadLoop',
            date: '2026-11-01',
            distance: 'half_marathon',
            url: 'https://drechtstadloop.nl',
            description: 'Sfeervolle loop door de historische binnenstad van Dordrecht. Kies uit 5 km, 10 km of de halve marathon. Start en finish op het Statenplein.',
            location: 'Statenplein, Dordrecht',
            accentColor: '#10B981',
            registrationOpen: true,
            subRaces: [
              {
                id: 'drechtstadloop-2026-5km',
                name: 'DrechtStadLoop 5 km',
                date: '2026-11-01',
                distance: '5km',
                url: 'https://drechtstadloop.nl/inschrijven/',
                description: 'Toegankelijke 5 km door het centrum van Dordrecht.',
                location: 'Statenplein, Dordrecht',
                accentColor: '#34D399',
                registrationOpen: true,
              },
              {
                id: 'drechtstadloop-2026-10km',
                name: 'DrechtStadLoop 10 km',
                date: '2026-11-01',
                distance: '10km',
                url: 'https://drechtstadloop.nl/inschrijven/',
                description: '10 km langs de grachten en monumenten van Dordrecht.',
                location: 'Statenplein, Dordrecht',
                accentColor: '#10B981',
                registrationOpen: true,
              },
              {
                id: 'drechtstadloop-2026-hm',
                name: 'DrechtStadLoop Halve Marathon',
                date: '2026-11-01',
                distance: 'half_marathon',
                url: 'https://drechtstadloop.nl/inschrijven/',
                description: 'Halve marathon van 21 km door de oudste stad van Nederland.',
                location: 'Statenplein, Dordrecht',
                accentColor: '#059669',
                registrationOpen: true,
              },
            ],
          },
          {
            id: 'boels-rental-run-2027',
            name: 'Boels Rental Run',
            date: '2027-03-13',
            distance: 'half_marathon',
            url: 'https://boelsrentalrun.nl',
            description: 'Klassiek voorjaarsevenement in Dordrecht met 5 km, 10 km en halve marathon. Snel en vlak parcours door de binnenstad.',
            location: 'Dordrecht',
            accentColor: '#0D9488',
            registrationOpen: false,
          },
        ],
      },
      {
        id: 'gouda',
        name: 'Gouda',
        races: [
          {
            id: 'halve-marathon-gouda-2026',
            name: 'Halve Marathon Gouda',
            date: '2026-11-08',
            distance: 'half_marathon',
            url: 'https://halvemarathongouda.nl',
            description: 'Populaire halve marathon door de historische binnenstad van Gouda. Start en finish op de Markt. Ook een 10 km beschikbaar.',
            location: 'Markt, Gouda',
            accentColor: '#FBBF24',
            registrationOpen: true,
            subRaces: [
              {
                id: 'halve-marathon-gouda-2026-hm',
                name: 'Halve Marathon Gouda 21.1 km',
                date: '2026-11-08',
                distance: 'half_marathon',
                url: 'https://halvemarathongouda.nl/informatie/inschrijven/',
                description: 'De volle 21,1 km door het centrum van Gouda. Inschrijving sluit 17 oktober.',
                location: 'Markt, Gouda',
                accentColor: '#D97706',
                registrationOpen: true,
              },
              {
                id: 'halve-marathon-gouda-2026-10km',
                name: 'Halve Marathon Gouda 10 km',
                date: '2026-11-08',
                distance: '10km',
                url: 'https://halvemarathongouda.nl/informatie/inschrijven/',
                description: '10 km langs de Goudse grachten en het kaasplein.',
                location: 'Markt, Gouda',
                accentColor: '#FBBF24',
                registrationOpen: true,
              },
            ],
          },
        ],
      },
      {
        id: 'leiden',
        name: 'Leiden',
        races: [
          {
            id: 'leiden-marathon-2027',
            name: 'Leiden Marathon',
            date: '2027-05-09',
            distance: 'marathon',
            url: 'https://marathon.nl',
            description: 'De 36e editie van de Leiden Marathon met ruim 14.000 deelnemers. Uniek stadsparcours langs de Leidse grachten en historische binnenstad. Marathon en halve marathon beschikbaar.',
            location: 'Leiden Centrum',
            accentColor: '#DC2626',
            registrationOpen: false,
            subRaces: [
              {
                id: 'leiden-marathon-2027-marathon',
                name: 'Leiden Marathon 42,195 km',
                date: '2027-05-09',
                distance: 'marathon',
                url: 'https://marathon.nl',
                description: 'De volledige 42,195 km door de historische Leidse binnenstad.',
                location: 'Leiden Centrum',
                accentColor: '#DC2626',
                registrationOpen: false,
              },
              {
                id: 'leiden-marathon-2027-hm',
                name: 'Leiden Halve Marathon 21,1 km',
                date: '2027-05-09',
                distance: 'half_marathon',
                url: 'https://marathon.nl',
                description: 'Halve marathon langs de Leidse grachten en door de historische binnenstad.',
                location: 'Leiden Centrum',
                accentColor: '#EF4444',
                registrationOpen: false,
              },
            ],
          },
        ],
      },
      {
        id: 'zoetermeer',
        name: 'Zoetermeer',
        races: [
          {
            id: 'halve-marathon-zoetermeer-2027',
            name: 'Halve Marathon Zoetermeer',
            date: '2027-01-24',
            distance: 'half_marathon',
            url: 'https://halvemarathonzoetermeer.nl',
            description: 'De 14e editie van de Halve Marathon Zoetermeer. Kies uit 5 km, 10 km of 21,1 km door de parken en wijken van Zoetermeer.',
            location: 'Zoetermeer',
            accentColor: '#6366F1',
            registrationOpen: true,
            subRaces: [
              {
                id: 'halve-marathon-zoetermeer-2027-5km',
                name: 'Zoetermeer 5 km',
                date: '2027-01-24',
                distance: '5km',
                url: 'https://halvemarathonzoetermeer.nl/afstanden-inschrijven/',
                description: 'Korte 5 km door de groene wijken van Zoetermeer.',
                location: 'Zoetermeer',
                accentColor: '#818CF8',
                registrationOpen: true,
              },
              {
                id: 'halve-marathon-zoetermeer-2027-10km',
                name: 'Zoetermeer 10 km',
                date: '2027-01-24',
                distance: '10km',
                url: 'https://halvemarathonzoetermeer.nl/afstanden-inschrijven/',
                description: '10 km door de parken en straten van Zoetermeer.',
                location: 'Zoetermeer',
                accentColor: '#6366F1',
                registrationOpen: true,
              },
              {
                id: 'halve-marathon-zoetermeer-2027-hm',
                name: 'Halve Marathon Zoetermeer 21.1 km',
                date: '2027-01-24',
                distance: 'half_marathon',
                url: 'https://halvemarathonzoetermeer.nl/afstanden/21-1km/',
                description: 'De halve marathon van 21,1 km. Early bird inschrijving €27,50 t/m augustus 2026.',
                location: 'Zoetermeer',
                accentColor: '#4F46E5',
                registrationOpen: true,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'noord-holland',
    name: 'Noord-Holland',
    cities: [
      {
        id: 'amsterdam',
        name: 'Amsterdam',
        races: [
          {
            id: 'dam2dam-2026',
            name: 'NN Dam tot Damloop',
            date: '2026-09-20',
            distance: '10km',
            url: 'https://www.nndamloop.nl',
            description: 'De 40e editie: iconische 10 mijl (16 km) van Amsterdam naar Zaandam. Uitverkocht voor 2026, maar een perfect trainingsdoel.',
            location: 'Amsterdam → Zaandam',
            accentColor: '#3B82F6',
            registrationOpen: false,
          },
          {
            id: 'tcs-amsterdam-marathon-2026',
            name: 'TCS Amsterdam Marathon',
            date: '2026-10-18',
            distance: 'marathon',
            url: 'https://www.tcsamsterdammarathon.nl',
            description: 'Iconische marathon door het hart van Amsterdam, met start en finish in het Olympisch Stadion. Ook een halve marathon beschikbaar.',
            location: 'Olympisch Stadion, Amsterdam',
            accentColor: '#EC4899',
            registrationOpen: true,
            subRaces: [
              {
                id: 'tcs-amsterdam-marathon-2026-marathon',
                name: 'TCS Amsterdam Marathon',
                date: '2026-10-18',
                distance: 'marathon',
                url: 'https://www.tcsamsterdammarathon.nl/inschrijven',
                description: 'De volledige 42,195 km door Amsterdam. Inschrijving sluit 5 oktober 2026.',
                location: 'Olympisch Stadion, Amsterdam',
                accentColor: '#DB2777',
                registrationOpen: true,
              },
              {
                id: 'tcs-amsterdam-half-marathon-2026',
                name: 'TCS Amsterdam Half Marathon',
                date: '2026-10-18',
                distance: 'half_marathon',
                url: 'https://www.tcsamsterdammarathon.nl/inschrijven',
                description: 'Halve marathon van 21,1 km door Amsterdam op hetzelfde parcours als de marathon.',
                location: 'Olympisch Stadion, Amsterdam',
                accentColor: '#EC4899',
                registrationOpen: true,
              },
            ],
          },
        ],
      },
      {
        id: 'egmond-aan-zee',
        name: 'Egmond aan Zee',
        races: [
          {
            id: 'egmond-halve-marathon-2027',
            name: 'NN Egmond Halve Marathon',
            date: '2027-01-10',
            distance: 'half_marathon',
            url: 'https://www.egmondhalvemarathon.nl',
            description: 'Een van de zwaarste halve marathons van Nederland. Strand, duinen en hoogtemeters langs de Noordzeekust bij Egmond aan Zee. Inschrijving opent medio augustus 2026.',
            location: 'Egmond aan Zee',
            accentColor: '#06B6D4',
            registrationOpen: false,
          },
        ],
      },
    ],
  },
  {
    id: 'noord-brabant',
    name: 'Noord-Brabant',
    cities: [
      {
        id: 'tilburg',
        name: 'Tilburg',
        races: [
          {
            id: 'tilburg-ten-miles-2026',
            name: 'CZ Tilburg Ten Miles',
            date: '2026-09-27',
            distance: '15km', // 10 mijl = 16,1 km; dichtstbijzijnde type
            url: 'https://tilburgtenmiles.nl',
            description: 'Het grootste hardloopevenement van Tilburg. 10 Engelse mijl (16,1 km) dwars door de stad, plus 10 km en 5 km. Jaarlijks op de laatste zondag van september.',
            location: 'Tilburg Centrum',
            accentColor: '#7C3AED',
            registrationOpen: true,
            subRaces: [
              {
                id: 'tilburg-ten-miles-2026-10miles',
                name: 'CZ Tilburg Ten Miles - 10 Mijl',
                date: '2026-09-27',
                distance: '15km',
                url: 'https://tilburgtenmiles.nl/inschrijven/',
                description: '10 Engelse mijl (16,1 km) dwars door Tilburg. Het iconische hoofdonderdeel.',
                location: 'Tilburg Centrum',
                accentColor: '#7C3AED',
                registrationOpen: true,
              },
              {
                id: 'tilburg-ten-miles-2026-10km',
                name: 'CZ Tilburg Ten Miles - 10 km',
                date: '2026-09-27',
                distance: '10km',
                url: 'https://tilburgtenmiles.nl/inschrijven/',
                description: '10 km door het centrum van Tilburg.',
                location: 'Tilburg Centrum',
                accentColor: '#8B5CF6',
                registrationOpen: true,
              },
              {
                id: 'tilburg-ten-miles-2026-5km',
                name: 'CZ Tilburg Ten Miles - 5 km',
                date: '2026-09-27',
                distance: '5km',
                url: 'https://tilburgtenmiles.nl/inschrijven/',
                description: 'Toegankelijke 5 km voor alle niveaus.',
                location: 'Tilburg Centrum',
                accentColor: '#A78BFA',
                registrationOpen: true,
              },
            ],
          },
        ],
      },
      {
        id: 'eindhoven',
        name: 'Eindhoven',
        races: [
          {
            id: 'asml-marathon-eindhoven-2026',
            name: 'ASML Marathon Eindhoven',
            date: '2026-10-11',
            distance: 'marathon',
            url: 'https://asmlmarathoneindhoven.nl',
            description: 'Een van de grootste hardloopevenementen van Nederland met 38.000 deelnemers. Vlak parcours door Eindhoven, met afstanden van 5 km tot marathon.',
            location: 'Vestdijk, Eindhoven',
            accentColor: '#F97316',
            registrationOpen: true,
            subRaces: [
              {
                id: 'asml-marathon-eindhoven-2026-marathon',
                name: 'ASML Marathon Eindhoven - Marathon',
                date: '2026-10-11',
                distance: 'marathon',
                url: 'https://asmlmarathoneindhoven.nl/en/register/',
                description: 'De volledige 42,195 km. Snel en vlak parcours. Inschrijving: €95 (eerste 1.500 deelnemers).',
                location: 'Vestdijk, Eindhoven',
                accentColor: '#EA580C',
                registrationOpen: true,
              },
              {
                id: 'asml-marathon-eindhoven-2026-hm',
                name: 'ASML Marathon Eindhoven - Halve Marathon',
                date: '2026-10-11',
                distance: 'half_marathon',
                url: 'https://asmlmarathoneindhoven.nl/en/register/',
                description: 'Halve marathon van 21,1 km. Een van de populairste afstanden van het evenement.',
                location: 'Vestdijk, Eindhoven',
                accentColor: '#F97316',
                registrationOpen: true,
              },
              {
                id: 'asml-marathon-eindhoven-2026-10km',
                name: 'ASML Marathon Eindhoven - 10 km',
                date: '2026-10-11',
                distance: '10km',
                url: 'https://asmlmarathoneindhoven.nl/en/register/',
                description: '10 km door het centrum van Eindhoven.',
                location: 'Vestdijk, Eindhoven',
                accentColor: '#FB923C',
                registrationOpen: true,
              },
              {
                id: 'asml-marathon-eindhoven-2026-5km',
                name: 'ASML Marathon Eindhoven - 5 km',
                date: '2026-10-11',
                distance: '5km',
                url: 'https://asmlmarathoneindhoven.nl/en/register/',
                description: 'Toegankelijke 5 km. Ideaal voor beginners of als warming-up voor het evenement.',
                location: 'Vestdijk, Eindhoven',
                accentColor: '#FDBA74',
                registrationOpen: true,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'utrecht',
    name: 'Utrecht',
    cities: [
      {
        id: 'utrecht',
        name: 'Utrecht',
        races: [
          {
            id: 'singelloop-utrecht-2026',
            name: 'TREK Singelloop Utrecht',
            date: '2026-10-04',
            distance: '10km',
            url: 'https://singellooputrecht.nl',
            description: 'De oudste stratenloop van Nederland, langs de Utrechtse singels en grachten. Start en finish bij het Domplein. 5 km en 10 km beschikbaar.',
            location: 'Domplein, Utrecht',
            accentColor: '#0369A1',
            registrationOpen: true,
            subRaces: [
              {
                id: 'singelloop-utrecht-2026-10km',
                name: 'TREK Singelloop Utrecht 10 km',
                date: '2026-10-04',
                distance: '10km',
                url: 'https://singellooputrecht.nl/inschrijven/',
                description: '10 km langs de singels en grachten van Utrecht.',
                location: 'Domplein, Utrecht',
                accentColor: '#0369A1',
                registrationOpen: true,
              },
              {
                id: 'singelloop-utrecht-2026-5km',
                name: 'TREK Singelloop Utrecht 5 km',
                date: '2026-10-04',
                distance: '5km',
                url: 'https://singellooputrecht.nl/inschrijven/',
                description: '5 km door de historische binnenstad van Utrecht.',
                location: 'Domplein, Utrecht',
                accentColor: '#0EA5E9',
                registrationOpen: true,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'gelderland',
    name: 'Gelderland',
    cities: [
      {
        id: 'nijmegen',
        name: 'Nijmegen',
        races: [
          {
            id: 'zevenheuvelenloop-2026',
            name: 'Garmin Zevenheuvelenloop',
            date: '2026-11-15',
            distance: '15km',
            url: 'https://zevenheuvelenloop.nl',
            description: 'Iconische 15 km over de heuvels van Nijmegen, Groesbeek en Berg en Dal. Een van de meest uitdagende lopen van Nederland, jaarlijks snel uitverkocht.',
            location: 'Nijmegen',
            accentColor: '#84CC16',
            registrationOpen: true,
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
