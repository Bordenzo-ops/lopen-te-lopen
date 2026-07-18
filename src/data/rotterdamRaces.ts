/**
 * Hardloopwedstrijden per land, gestructureerd als land > provincie > stad
 *
 * Voeg nieuwe wedstrijden toe door een nieuw object in de juiste stad te plaatsen.
 * Voeg een nieuwe stad toe door een nieuw object in de juiste provincie te plaatsen.
 * Voeg een nieuwe provincie toe door een nieuw object in de provincies-array van
 * het juiste land te plaatsen.
 * Voeg een nieuw land toe door een nieuw object in COUNTRIES te plaatsen.
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

export interface RaceCountry {
  id: string;
  name: string;
  provinces: RaceProvince[];
}

// ── Data ──────────────────────────────────────────────────────────────────────

const NL_PROVINCES: RaceProvince[] = [
  {
    id: 'zuid-holland',
    name: 'Zuid-Holland',
    cities: [
      {
        id: 'rotterdam',
        name: 'Rotterdam',
        races: [
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
      {
        id: 'delft',
        name: 'Delft',
        races: [
          {
            id: 'golden-tenloop-delft-2027',
            name: 'Golden Tenloop',
            date: '2027-05-06',
            distance: '10km',
            url: 'https://goldentenloop.nl',
            description: 'Sfeervol hardloopfestival op Hemelvaartsdag door de historische binnenstad van Delft. Start en finish op de Burgwal. 5 km en 10 km beschikbaar.',
            location: 'Burgwal, Delft',
            accentColor: '#EAB308',
            registrationOpen: false,
            subRaces: [
              {
                id: 'golden-tenloop-delft-2027-10km',
                name: 'Golden Tenloop 10 km',
                date: '2027-05-06',
                distance: '10km',
                url: 'https://goldentenloop.nl/inschrijven/',
                description: '10 km door de binnenstad van Delft, het hoofdonderdeel van de Golden Tenloop.',
                location: 'Burgwal, Delft',
                accentColor: '#EAB308',
                registrationOpen: false,
              },
              {
                id: 'golden-tenloop-delft-2027-5km',
                name: 'Golden Tenloop 5 km',
                date: '2027-05-06',
                distance: '5km',
                url: 'https://goldentenloop.nl/inschrijven/',
                description: 'Toegankelijke 5 km door Delft, geschikt voor beginners.',
                location: 'Burgwal, Delft',
                accentColor: '#FDE047',
                registrationOpen: false,
              },
            ],
          },
        ],
      },
      {
        id: 'naaldwijk',
        name: 'Naaldwijk',
        races: [
          {
            id: 'halve-westland-naaldwijk-2027',
            name: 'Moore DRV Halve Westland',
            date: '2027-03-21',
            distance: 'half_marathon',
            url: 'https://westlandsehalvemarathon.nl',
            description: 'Populair hardloopevenement in het Westland met 5 km, 10 km en halve marathon. Finish bij sportpark De Hoge Bomen in Naaldwijk. Vorige editie volledig uitverkocht.',
            location: 'Sportpark De Hoge Bomen, Naaldwijk',
            accentColor: '#16A34A',
            registrationOpen: false,
            subRaces: [
              {
                id: 'halve-westland-naaldwijk-2027-hm',
                name: 'Halve Westland 21,1 km',
                date: '2027-03-21',
                distance: 'half_marathon',
                url: 'https://westlandsehalvemarathon.nl/index.php/inschrijven/halve-marathon',
                description: 'De volledige halve marathon van 21,1 km door het Westland.',
                location: 'Sportpark De Hoge Bomen, Naaldwijk',
                accentColor: '#15803D',
                registrationOpen: false,
              },
              {
                id: 'halve-westland-naaldwijk-2027-10km',
                name: 'Halve Westland 10 km',
                date: '2027-03-21',
                distance: '10km',
                url: 'https://westlandsehalvemarathon.nl/index.php/inschrijven/10km',
                description: '10 km door het Westland, langs de kassen en polders.',
                location: 'Sportpark De Hoge Bomen, Naaldwijk',
                accentColor: '#16A34A',
                registrationOpen: false,
              },
              {
                id: 'halve-westland-naaldwijk-2027-5km',
                name: 'Halve Westland 5 km',
                date: '2027-03-21',
                distance: '5km',
                url: 'https://westlandsehalvemarathon.nl/index.php/inschrijven/5km',
                description: 'Toegankelijke 5 km, geschikt voor beginners.',
                location: 'Sportpark De Hoge Bomen, Naaldwijk',
                accentColor: '#4ADE80',
                registrationOpen: false,
              },
            ],
          },
        ],
      },
      {
        id: 'waddinxveen',
        name: 'Waddinxveen',
        races: [
          {
            id: 'langs-de-gouweloop-waddinxveen-2026',
            name: 'Langs de Gouweloop',
            date: '2026-10-04',
            distance: '10km',
            url: 'https://www.langsdegouweloop.nl',
            description: 'Jaarlijkse hardloopwedstrijd langs de rivier de Gouwe in Waddinxveen. Vlak parcours, geschikt voor zowel beginners als gevorderde lopers. 5 km en 10 km beschikbaar.',
            location: 'Waddinxveen',
            accentColor: '#0891B2',
            registrationOpen: true,
            subRaces: [
              {
                id: 'langs-de-gouweloop-waddinxveen-2026-10km',
                name: 'Langs de Gouweloop 10 km',
                date: '2026-10-04',
                distance: '10km',
                url: 'https://www.langsdegouweloop.nl',
                description: '10 km langs de Gouwe, over vlakke wegen met natuurlijke en stedelijke afwisseling.',
                location: 'Waddinxveen',
                accentColor: '#0891B2',
                registrationOpen: true,
              },
              {
                id: 'langs-de-gouweloop-waddinxveen-2026-5km',
                name: 'Langs de Gouweloop 5 km',
                date: '2026-10-04',
                distance: '5km',
                url: 'https://www.langsdegouweloop.nl',
                description: 'Toegankelijke 5 km langs de Gouwe.',
                location: 'Waddinxveen',
                accentColor: '#22D3EE',
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
            id: 'dam2dam-2025',
            name: 'Dam tot Damloop',
            date: '2025-09-14',
            distance: '10km',
            url: 'https://www.damtotdamloop.nl',
            description: 'Iconische 10 km van Amsterdam naar Zaandam. Vlak en snel parcours.',
            location: 'Amsterdam → Zaandam',
            accentColor: '#3B82F6',
            registrationOpen: false,
          },
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

// België is voorbereid met de belangrijkste provincies/steden voor toekomstige
// wedstrijden. De races-arrays zijn bewust leeg: die worden in een aparte
// stap gevuld.
const BE_PROVINCES: RaceProvince[] = [
  {
    id: 'west-vlaanderen',
    name: 'West-Vlaanderen',
    cities: [
      {
        id: 'brugge',
        name: 'Brugge',
        races: [
          {
            id: 'athora-bruges-marathon-2026',
            name: 'Athora Bruges Marathon',
            date: '2026-10-11',
            distance: 'marathon',
            url: 'https://athorabrugesmarathon.com/en/',
            description: 'Vlak en snel parcours door de historische binnenstad van Brugge, via Zeebrugge, met finish op de Grote Markt.',
            location: 'Grote Markt, Brugge',
            accentColor: '#0F766E',
            registrationOpen: true,
            subRaces: [
              {
                id: 'athora-bruges-marathon-2026-marathon',
                name: 'Athora Bruges Marathon - Marathon',
                date: '2026-10-11',
                distance: 'marathon',
                url: 'https://athorabrugesmarathon.com/en/',
                description: "De volledige 42,195 km door Brugge, van 't Zand via Zeebrugge naar de Grote Markt.",
                location: 'Grote Markt, Brugge',
                accentColor: '#0D9488',
                registrationOpen: true,
              },
              {
                id: 'athora-bruges-marathon-2026-hm',
                name: 'Athora Bruges Marathon - Halve Marathon',
                date: '2026-10-11',
                distance: 'half_marathon',
                url: 'https://athorabrugesmarathon.com/en/',
                description: 'Halve marathon van 21,1 km door de historische binnenstad van Brugge, met finish op de Grote Markt.',
                location: 'Grote Markt, Brugge',
                accentColor: '#2DD4BF',
                registrationOpen: true,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'oost-vlaanderen',
    name: 'Oost-Vlaanderen',
    cities: [
      {
        id: 'gent',
        name: 'Gent',
        races: [
          {
            id: 'maes-gent-10mijl-2026',
            name: 'MAES Gent 10 Mijl',
            date: '2026-09-20',
            distance: '15km', // 10 mijl = 16,61 km; dichtstbijzijnde type
            url: 'https://maesgent10mijl.be/',
            description: 'Populairste loopfeest van Gent, met een parcours langs culturele hoogtepunten en een afterparty met live muziek.',
            location: 'Zuiderlaan, Gent',
            accentColor: '#FACC15',
            registrationOpen: true,
            subRaces: [
              {
                id: 'maes-gent-10mijl-2026-10mijl',
                name: 'MAES Gent 10 Mijl - 10 Mijl',
                date: '2026-09-20',
                distance: '15km', // 10 mijl = 16,61 km; dichtstbijzijnde type
                url: 'https://maesgent10mijl.be/',
                description: 'De hoofdafstand van 10 mijl (16,61 km), met start bij Parking Oost en finish bij Sport Vlaanderen Gent.',
                location: 'Parking Oost → Zuiderlaan, Gent',
                accentColor: '#FACC15',
                registrationOpen: true,
              },
              {
                id: 'maes-gent-10mijl-2026-5mijl',
                name: 'MAES Gent 10 Mijl - 5 Mijl',
                date: '2026-09-20',
                distance: '10km', // 5 mijl = 8,45 km; dichtstbijzijnde type
                url: 'https://maesgent10mijl.be/',
                description: '5 mijl (8,45 km) door Gent, langs culturele hoogtepunten.',
                location: 'Zuiderlaan, Gent',
                accentColor: '#FDE047',
                registrationOpen: true,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'antwerpen',
    name: 'Antwerpen',
    cities: [
      {
        id: 'antwerpen-stad',
        name: 'Antwerpen',
        races: [
          {
            id: 'trek-antwerp-marathon-2026',
            name: 'TREK Antwerp Marathon',
            date: '2026-10-18',
            distance: 'marathon',
            url: 'https://antwerpmarathon.com/en/',
            description: 'Grootste loopwedstrijd van Antwerpen met 20.000+ deelnemers, door de haven, tunnels en historische binnenstad. Finish bij het MAS.',
            location: 'MAS, Antwerpen',
            accentColor: '#B91C1C',
            registrationOpen: true,
            subRaces: [
              {
                id: 'trek-antwerp-marathon-2026-marathon',
                name: 'TREK Antwerp Marathon - Marathon',
                date: '2026-10-18',
                distance: 'marathon',
                url: 'https://antwerpmarathon.com/en/',
                description: 'De volledige 42,195 km door Antwerpen, langs de haven en tunnels naar de finish bij het MAS.',
                location: 'Kattendijkbrug → MAS, Antwerpen',
                accentColor: '#DC2626',
                registrationOpen: true,
              },
              {
                id: 'trek-antwerp-marathon-2026-hm',
                name: 'TREK Antwerp Marathon - Halve Marathon',
                date: '2026-10-18',
                distance: 'half_marathon',
                url: 'https://antwerpmarathon.com/en/',
                description: 'Halve marathon van 21,1 km door Antwerpen, met finish bij het MAS.',
                location: 'Kattendijkbrug → MAS, Antwerpen',
                accentColor: '#F87171',
                registrationOpen: true,
              },
              {
                id: 'trek-antwerp-marathon-2026-10km',
                name: 'TREK Antwerp Marathon - 10 km',
                date: '2026-10-18',
                distance: '10km',
                url: 'https://antwerpmarathon.com/en/',
                description: '10 km door de binnenstad van Antwerpen, start aan de Orteliuskaai.',
                location: 'Orteliuskaai → MAS, Antwerpen',
                accentColor: '#FCA5A5',
                registrationOpen: true,
              },
            ],
          },
          {
            id: 'baloise-antwerp-10-miles-2027',
            name: 'Baloise Antwerp 10 Miles',
            date: '2027-04-18',
            distance: '15km', // 10 mijl = 16,09 km; dichtstbijzijnde type
            url: 'https://baloiseantwerp10miles.be/en/',
            description: 'Populair hardloopevenement door Antwerpen met een parcours door de Kennedytunnel. De vorige editie was binnen twee dagen uitverkocht met 50.000 deelnemers.',
            location: 'Antwerpen',
            accentColor: '#2563EB',
            registrationOpen: false,
            subRaces: [
              {
                id: 'baloise-antwerp-10-miles-2027-10miles',
                name: 'Baloise Antwerp 10 Miles - 10 Miles',
                date: '2027-04-18',
                distance: '15km', // 10 mijl = 16,09 km; dichtstbijzijnde type
                url: 'https://baloiseantwerp10miles.be/en/',
                description: 'De hoofdafstand van 10 mijl (16,09 km) door Antwerpen, via de Kennedytunnel.',
                location: 'Antwerpen',
                accentColor: '#2563EB',
                registrationOpen: false,
              },
              {
                id: 'baloise-antwerp-10-miles-2027-5miles',
                name: 'Baloise Antwerp 10 Miles - 5 Miles',
                date: '2027-04-17',
                distance: '10km', // 5 mijl = 8,05 km; dichtstbijzijnde type
                url: 'https://baloiseantwerp10miles.be/en/',
                description: '5 mijl (8,05 km) door Antwerpen, op zaterdag voorafgaand aan de hoofdafstand.',
                location: 'Antwerpen',
                accentColor: '#60A5FA',
                registrationOpen: false,
              },
            ],
          },
        ],
      },
    ],
  },
];

export const COUNTRIES: RaceCountry[] = [
  { id: 'nederland', name: 'Nederland', provinces: NL_PROVINCES },
  { id: 'belgie', name: 'België', provinces: BE_PROVINCES },
];

/**
 * Backwards-compat: PROVINCES bevat alleen de Nederlandse provincies.
 * Bestaande UI (o.a. RacePickerScreen) is oorspronkelijk gebouwd op een
 * provincie > stad-hiërarchie zonder landniveau; deze alias houdt die code
 * werkend. Nieuwe schermen die het landniveau tonen, gebruiken COUNTRIES.
 */
export const PROVINCES: RaceProvince[] = NL_PROVINCES;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Alle wedstrijden plat als array (inclusief sub-races), over alle landen */
export function getAllRaces(): Race[] {
  return COUNTRIES.flatMap(country =>
    country.provinces.flatMap(p =>
      p.cities.flatMap(c =>
        c.races.flatMap(r => r.subRaces ? r.subRaces : [r]),
      ),
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

/** Leesbaar countdown-label, bijv. "5 weken te gaan", "1 week te gaan" of "Deze week" (< 1 week) */
export function weeksUntilLabel(raceDate: string, today = new Date()): string {
  const weeks = weeksUntilRace(raceDate, today);
  if (weeks < 1) return 'Deze week';
  return weeks === 1 ? '1 week te gaan' : `${weeks} weken te gaan`;
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
