/**
 * render-campaign-voiceovers — rendert de campagne-voice-overscripts uit
 * `_workspace/notities/Campagne-voiceovers.md` (creditpakket CP5) naar mp3's
 * met dezelfde vier ElevenLabs-stemmen als de app.
 *
 * WAAROM DIT SCRIPT BESTAAT — het oorspronkelijke plan was deze voice-overs
 * met de hand in ElevenLabs Studio in te spreken, omdat je daar meer regie
 * hebt over intonatie en pauzes. Dat kost handwerk, en het abonnement loopt af
 * op ±19-08-2026: daarna is elke opname in de stem van de app onmogelijk. Dit
 * script ruilt die regie in voor volledige automatisering — één commando levert
 * alle scripts in meerdere takes op. Wat er ligt kun je jarenlang blijven
 * monteren; wat er niet ligt, kan nooit meer gemaakt worden.
 *
 * Dit zijn GEEN app-clips: ze gaan niet door de zinnencatalogus en niet naar de
 * `voice-packs`-bucket. De output landt in `_workspace/campagne/` (gitignored).
 *
 * GEBRUIK (vanuit de projectroot, Node 18+):
 *
 *   Alleen de kostenraming, geen API-key nodig:
 *     npx tsx scripts/render-campaign-voiceovers.ts --dry-run
 *
 *   Renderen (standaard 3 takes per fragment):
 *     set ELEVENLABS_API_KEY=sk_...
 *     npx tsx scripts/render-campaign-voiceovers.ts
 *
 *   Meer of minder takes, of één script:
 *     npx tsx scripts/render-campaign-voiceovers.ts --takes 2
 *     npx tsx scripts/render-campaign-voiceovers.ts --script teaser
 *
 * Idempotent, net als generate-voice-packs.ts: een bestand dat er al staat
 * wordt overgeslagen, dus een afgebroken run hervat zichzelf zonder opnieuw
 * credits te kosten.
 */

/// <reference types="node" />
import * as fs from 'node:fs';
import * as path from 'node:path';

import { ELEVENLABS, voiceDefinition, type VoiceType } from '../src/config/voiceConfig';

const OUT_DIR = path.resolve(process.cwd(), '_workspace/campagne');
const REQUEST_DELAY_MS = 250;
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [5000, 15000, 30000];

// ── Takes ────────────────────────────────────────────────────────────────────
//
// Drie takes met bewust verschillende voice settings, want dat is waar Studio
// zijn meerwaarde had. Take 1 klinkt als de app zelf (identieke instellingen
// als het stempakket), take 2 is expressiever voor social, take 3 rustiger en
// stabieler voor voice-over onder beeld. Zo heb je bij de montage echt iets te
// kiezen in plaats van drie keer dezelfde voordracht.

interface TakePreset {
  name: string;
  settings: Record<string, number | boolean>;
}

const TAKE_PRESETS: TakePreset[] = [
  { name: 'app', settings: ELEVENLABS.voiceSettings },
  {
    name: 'expressief',
    settings: { stability: 0.3, similarity_boost: 0.75, style: 0.6, use_speaker_boost: true },
  },
  {
    name: 'rustig',
    settings: { stability: 0.6, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true },
  },
];

// ── Scripts ──────────────────────────────────────────────────────────────────
//
// Letterlijk overgenomen uit `_workspace/notities/Campagne-voiceovers.md`.
// Wijzig de teksten daar EN hier samen, anders lopen document en opname uiteen.
// Losse alinea's staan als aparte regels in de string: ElevenLabs leest een
// regeleinde als een korte adempauze, wat voor voice-over prettiger klinkt dan
// één lange lap tekst.

interface Segment {
  /** Wordt onderdeel van de bestandsnaam; houd 'm kort en kleingeschreven. */
  id: string;
  voice: VoiceType;
  text: string;
}

interface CampaignScript {
  id: string;
  title: string;
  segments: Segment[];
}

const APP_STORE_TEXT = [
  'Lopen te Lopen is jouw Nederlandstalige hardloopcoach. Kies je doel: vijf kilometer, tien kilometer, een halve marathon of een hele. Je krijgt een persoonlijk schema dat elke week met je meegroeit.',
  'Train je voor een specifieke wedstrijd? Geef je racedatum op, en het schema past zich automatisch aan, zodat je precies op tijd klaar bent.',
  'Tijdens het lopen coacht een natuurlijke Nederlandse stem je live: tempo, hartslagzone en aanmoediging, zonder dat je op je scherm hoeft te kijken. En de app plant zelf een hardlooproute, vanaf je eigen voordeur.',
  'Begin gratis. Geen advertenties, geen datahandel. Gewoon jij, je doel, en de weg ernaartoe.',
  'Lopen te Lopen. Download vandaag nog.',
].join('\n');

const ROTTERDAM_TEXT = [
  'Ergens in Rotterdam, op elf april tweeduizend zevenentwintig, lopen zeventienduizend mensen over de Coolsingel. Sommigen zijn al jaren hardloper. Anderen begonnen dit najaar, met niets meer dan een paar schoenen en een doel.',
  'Het verschil tussen hen? Een schema dat weet waar je naartoe traint.',
  'Lopen te Lopen bouwt jouw weg naar Rotterdam: elke training op het tempo dat jou naar de finish brengt, een Nederlandse stem die je er doorheen praat, en elke week het bewijs dat je dichterbij komt.',
  'Volg het schema, en je haalt de finish. Doe je dat toch niet, dan is je volgende jaar gratis.',
  'Road to Rotterdam begint nu. Waar begin jij?',
].join('\n');

const TEASER_TEXT = [
  'Elf april tweeduizend zevenentwintig. De marathon van Rotterdam.',
  'Lopen te Lopen brengt je er, stap voor stap: jouw schema, jouw tempo, een Nederlandse stem die meeloopt.',
  'Begin gratis. Road to Rotterdam.',
].join('\n');

// ── Seizoensscripts (toegevoegd 17-08-2026) ──────────────────────────────────
//
// De scripts 1 t/m 5 hierboven zijn campagne-specifiek (Road to Rotterdam).
// Deze vijf zijn seizoensgebonden en dus elk jaar opnieuw bruikbaar — het
// belangrijkste argument om ze nú op te nemen: januari is het drukste
// wervingsmoment voor hardloopapps, en tegen die tijd is dit abonnement al
// maanden opgezegd. Alle beweringen komen uit bestaande, live copy (paywall,
// STORE_LISTING, de scripts hierboven); er staat niets nieuws of onbewezens in.

const NIEUWJAAR_TEXT = [
  'Elk jaar dezelfde januari: nieuwe schoenen, goede voornemens, en in februari niets meer.',
  'Het verschil zit niet in discipline. Het zit in een schema dat weet waar je naartoe traint, en dat zich aanpast als het leven een keer tegenzit.',
  'Lopen te Lopen bouwt jouw schema rond jouw doel: vijf kilometer, tien, een halve marathon of een hele. Een Nederlandse stem loopt met je mee, en elke week zie je dat je verder komt.',
  'Begin gratis. Dit jaar haal je hem wel.',
].join('\n');

const NIEUWJAAR_TEASER_TEXT = [
  'Nieuw jaar. Nieuw doel.',
  'Lopen te Lopen maakt je schema, praat je er onderweg doorheen, en brengt je naar de finish.',
  'Begin gratis.',
].join('\n');

const VOORJAAR_TEXT = [
  'Het loopseizoen begint. Overal om je heen gaan inschrijvingen open.',
  'Kies je wedstrijd, geef de datum op, en je schema rekent terug naar vandaag. Elke training op het tempo dat jou naar die finish brengt.',
  'Van je eerste vijf kilometer tot een hele marathon, met een stem die je er doorheen praat.',
  'Lopen te Lopen. Schrijf je in, wij doen de rest.',
].join('\n');

const NAJAAR_TEXT = [
  'De zomer is voorbij, de avonden worden korter, en je schoenen staan nog in de gang.',
  'Weer beginnen is makkelijker dan je denkt, als iemand het voor je uitstippelt. Een paar keer per week, opgebouwd vanaf waar jij nu staat.',
  'Lopen te Lopen maakt je schema en loopt met je mee, ook als het donker is.',
  'Begin gratis, vandaag nog.',
].join('\n');

const EXPLAINER_TEXT = [
  'Zo werkt Lopen te Lopen.',
  'Je kiest een doel: een afstand, of een wedstrijd met een datum. Daar bouwt de app een schema omheen, week voor week, opgebouwd vanaf jouw niveau.',
  'Elke training staat klaar in je agenda. Je drukt op start, stopt je telefoon in je zak, en loopt. Onderweg hoor je je tempo, je hartslagzone en aanmoediging, in het Nederlands of het Vlaams.',
  'Weet je niet waar je moet lopen? De app plant een route vanaf je eigen voordeur, precies zo lang als je training vraagt.',
  'Na afloop zie je wat je gelopen hebt en hoe je ervoor staat. Mis je een week, dan past het schema zich aan.',
  'Veertien dagen gratis proberen. Daarna negenenveertig euro per jaar, of vijf euro negenennegentig per maand. Opzegbaar wanneer je wilt.',
  'Lopen te Lopen. Jouw doel, jouw tempo, jouw stem.',
].join('\n');

const SCRIPTS: CampaignScript[] = [
  {
    id: 'app-store-preview',
    title: '1. App-store-preview — wat doet de app',
    // Drie stemmen voor dezelfde tekst: Roos is de aanbevolen stem uit het
    // bronbestand, Adam geeft een alternatief om mee te A/B-testen, en Elke
    // levert meteen een Vlaamse variant voor de Belgische winkelpagina.
    segments: [
      { id: 'volledig', voice: 'female', text: APP_STORE_TEXT },
      { id: 'volledig-adam', voice: 'male', text: APP_STORE_TEXT },
      { id: 'volledig-vlaams', voice: 'flemish_female', text: APP_STORE_TEXT },
    ],
  },
  {
    id: 'road-to-rotterdam',
    title: '2. Social clip — van bank naar marathon',
    segments: [
      { id: 'volledig', voice: 'female', text: ROTTERDAM_TEXT },
      { id: 'volledig-adam', voice: 'male', text: ROTTERDAM_TEXT },
      // Vlaamse variant van exact dezelfde tekst, voor de Belgische markt.
      { id: 'volledig-vlaams', voice: 'flemish_female', text: ROTTERDAM_TEXT },
    ],
  },
  {
    id: 'vier-stemmen',
    title: '3. Premium-features — de vier stemmen stellen zich voor',
    // Per stem een apart fragment: in de montage aan elkaar knippen, met
    // ondertiteling per spreker (zie de opmerking in het bronbestand).
    segments: [
      {
        id: '1-roos',
        voice: 'female',
        text: 'Hoi, ik ben Roos. Duizenden lopers kennen mijn stem al van hun tempo-updates en aanmoedigingen.',
      },
      {
        id: '2-adam',
        voice: 'male',
        text: 'En ik ben Adam. Zelfde coaching, andere stem. Sommige lopers lopen liever met mij mee.',
      },
      {
        id: '3-elke',
        voice: 'flemish_female',
        text: 'Ik ben Elke, en ja, ik klink Vlaams. Voor wie liever een vertrouwd accent hoort tijdens het lopen.',
      },
      {
        id: '4-steven',
        voice: 'flemish_male',
        text: 'En ik ben Steven. Vier stemmen, een doel: jou naar de finish praten.',
      },
      {
        id: '5-roos-slot',
        voice: 'female',
        text: 'Kies je favoriet in de instellingen. Met premium hoor je ons tijdens elke run. Zonder premium, geen probleem: dan coacht de stem van je eigen telefoon je net zo goed.',
      },
    ],
  },
  {
    id: 'testimonial-stijl',
    // LET OP: geen echte testimonial. Zie de waarschuwing in het bronbestand —
    // nooit presenteren als citaat van een bestaande gebruiker.
    title: '4. Testimonial-stijl (GEEN echt citaat, generiek/aspiratief)',
    segments: [
      {
        id: 'volledig',
        voice: 'male',
        text: [
          'Ik had nog nooit verder dan vijf kilometer gelopen. Toen zag ik de inschrijving voor Rotterdam opengaan, en dacht: dit jaar wel.',
          'Het schema wist dat ik bij nul begon. Elke week een beetje verder, nooit te veel tegelijk. En tijdens het lopen praatte de stem me er gewoon doorheen. Ik hoefde niet eens op mijn scherm te kijken.',
          'Zo bouw je naar een marathon. Niet in een keer, maar week na week.',
          'Lopen te Lopen. Misschien is dit ook jouw jaar.',
        ].join('\n'),
      },
      // Vlaamse variant. Bewust Steven en niet Elke of Roos: het bronbestand
      // kiest hier expres een ANDERE stem dan de coach, zodat het niet klinkt
      // alsof de app zichzelf citeert. Elke is een coachstem, Steven is de
      // Vlaamse tegenhanger van diezelfde redenering.
      {
        id: 'volledig-vlaams',
        voice: 'flemish_male',
        text: [
          'Ik had nog nooit verder dan vijf kilometer gelopen. Toen zag ik de inschrijving voor Rotterdam opengaan, en dacht: dit jaar wel.',
          'Het schema wist dat ik bij nul begon. Elke week een beetje verder, nooit te veel tegelijk. En tijdens het lopen praatte de stem me er gewoon doorheen. Ik hoefde niet eens op mijn scherm te kijken.',
          'Zo bouw je naar een marathon. Niet in een keer, maar week na week.',
          'Lopen te Lopen. Misschien is dit ook jouw jaar.',
        ].join('\n'),
      },
    ],
  },
  {
    id: 'teaser',
    title: '5. Korte teaser (15 s)',
    segments: [
      { id: 'volledig', voice: 'female', text: TEASER_TEXT },
      { id: 'volledig-adam', voice: 'male', text: TEASER_TEXT },
      { id: 'volledig-vlaams', voice: 'flemish_female', text: TEASER_TEXT },
    ],
  },
  {
    id: 'nieuwjaar',
    title: '6. Nieuwjaarscampagne — januaripiek (30 s)',
    segments: [
      { id: 'volledig', voice: 'female', text: NIEUWJAAR_TEXT },
      { id: 'volledig-vlaams', voice: 'flemish_female', text: NIEUWJAAR_TEXT },
    ],
  },
  {
    id: 'nieuwjaar-teaser',
    title: '7. Nieuwjaarsteaser (15 s)',
    segments: [{ id: 'volledig', voice: 'female', text: NIEUWJAAR_TEASER_TEXT }],
  },
  {
    id: 'voorjaar',
    title: '8. Voorjaar — start van het wedstrijdseizoen (30 s)',
    segments: [{ id: 'volledig', voice: 'female', text: VOORJAAR_TEXT }],
  },
  {
    id: 'najaar',
    title: '9. Najaar — weer beginnen na de zomer (30 s)',
    segments: [{ id: 'volledig', voice: 'female', text: NAJAAR_TEXT }],
  },
  {
    id: 'explainer',
    title: '10. Website-explainer — hoe werkt het (60 s)',
    segments: [
      { id: 'volledig', voice: 'female', text: EXPLAINER_TEXT },
      { id: 'volledig-vlaams', voice: 'flemish_female', text: EXPLAINER_TEXT },
    ],
  },
];

// ── CLI ──────────────────────────────────────────────────────────────────────

interface CliOptions {
  dryRun: boolean;
  takes: number;
  scriptId?: string;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { dryRun: false, takes: TAKE_PRESETS.length };

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--takes': {
        const value = Number(argv[++i]);
        if (!Number.isInteger(value) || value < 1 || value > TAKE_PRESETS.length) {
          console.error(`--takes verwacht een getal van 1 tot ${TAKE_PRESETS.length}.`);
          process.exit(1);
        }
        options.takes = value;
        break;
      }
      case '--script': {
        const value = argv[++i];
        if (!SCRIPTS.some((s) => s.id === value)) {
          console.error(`Onbekend script "${value}". Keuze: ${SCRIPTS.map((s) => s.id).join(', ')}.`);
          process.exit(1);
        }
        options.scriptId = value;
        break;
      }
      default:
        console.error(`Onbekend argument: "${argv[i]}".`);
        process.exit(1);
    }
  }

  return options;
}

// ── ElevenLabs ───────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchClip(
  voiceId: string,
  text: string,
  settings: Record<string, number | boolean>,
): Promise<ArrayBuffer> {
  let lastError = '';

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1] ?? 30000);

    let response: Response;
    try {
      response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': process.env.ELEVENLABS_API_KEY ?? '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            model_id: ELEVENLABS.modelId,
            voice_settings: settings,
          }),
        },
      );
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      continue;
    }

    if (response.ok) return response.arrayBuffer();

    lastError = `HTTP ${response.status}: ${(await response.text().catch(() => '')).slice(0, 200)}`;
    // 4xx anders dan 429 is een blijvende fout (verkeerde sleutel, ongeldige
    // stem): opnieuw proberen kost alleen tijd.
    if (response.status !== 429 && response.status < 500) break;
  }

  throw new Error(lastError);
}

// ── Hoofdprogramma ───────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const scripts = options.scriptId ? SCRIPTS.filter((s) => s.id === options.scriptId) : SCRIPTS;

  // Kostenraming: ElevenLabs rekent per teken, per aanroep. Elke take is een
  // eigen aanroep, dus de tekst telt net zo vaak mee als er takes zijn.
  //
  // Bestanden die al op schijf staan worden overgeslagen en kosten dus niets.
  // Die worden hier apart geteld: bij een tweede run (bv. nadat er scripts zijn
  // bijgekomen) is het brutototaal veel hoger dan wat er daadwerkelijk in
  // rekening wordt gebracht, en op dat verschil wil je je beslissing baseren.
  let estimatedTotal = 0;
  let estimatedNew = 0;
  let alreadyOnDisk = 0;
  for (const script of scripts) {
    for (const segment of script.segments) {
      for (let take = 0; take < options.takes; take++) {
        estimatedTotal += segment.text.length;
        const filename = `${segment.id}-${segment.voice}-take${take + 1}-${TAKE_PRESETS[take].name}.mp3`;
        if (fs.existsSync(path.join(OUT_DIR, script.id, filename))) {
          alreadyOnDisk++;
        } else {
          estimatedNew += segment.text.length;
        }
      }
    }
  }

  console.log('=== Campagne-voice-overs ===');
  console.log(`Scripts:   ${scripts.length}`);
  console.log(`Fragmenten: ${scripts.reduce((n, s) => n + s.segments.length, 0)}`);
  console.log(`Takes:     ${options.takes} (${TAKE_PRESETS.slice(0, options.takes).map((t) => t.name).join(', ')})`);
  console.log(`Al op schijf: ${alreadyOnDisk} bestand(en) — die worden overgeslagen`);
  console.log(`Credits voor alles opnieuw: ${estimatedTotal}`);
  console.log(`CREDITS DIE DEZE RUN KOST:  ${estimatedNew}\n`);

  if (options.dryRun) {
    for (const script of scripts) {
      console.log(`--- ${script.title} ---`);
      for (const segment of script.segments) {
        const voice = voiceDefinition(segment.voice);
        console.log(`  ${segment.id} (${voice.name}, ${segment.text.length} tekens)`);
      }
      console.log('');
    }
    console.log('Dry-run: er is niets gegenereerd.');
    return;
  }

  if (!process.env.ELEVENLABS_API_KEY) {
    console.error('ELEVENLABS_API_KEY is niet gezet. Zet die als tijdelijke shell-variabele en probeer opnieuw.');
    process.exit(1);
  }

  let generated = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const script of scripts) {
    const scriptDir = path.join(OUT_DIR, script.id);
    fs.mkdirSync(scriptDir, { recursive: true });
    console.log(`--- ${script.title} ---`);

    for (const segment of script.segments) {
      const voice = voiceDefinition(segment.voice);
      if (!voice.elevenVoiceId) {
        failures.push(`${script.id}/${segment.id}: stem "${segment.voice}" heeft geen voice-id.`);
        continue;
      }

      for (let take = 0; take < options.takes; take++) {
        const preset = TAKE_PRESETS[take];
        const filename = `${segment.id}-${segment.voice}-take${take + 1}-${preset.name}.mp3`;
        const filePath = path.join(scriptDir, filename);

        if (fs.existsSync(filePath)) {
          skipped++;
          continue;
        }

        try {
          const audio = await fetchClip(voice.elevenVoiceId, segment.text, preset.settings);
          fs.writeFileSync(filePath, Buffer.from(audio));
          generated++;
          console.log(`  ${filename} (${(audio.byteLength / 1024).toFixed(0)} kB)`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          failures.push(`${script.id}/${filename}: ${message}`);
          console.warn(`  ${filename} MISLUKT: ${message}`);
        }

        await sleep(REQUEST_DELAY_MS);
      }
    }
    console.log('');
  }

  console.log(`Klaar: ${generated} gegenereerd, ${skipped} al aanwezig (overgeslagen).`);
  console.log(`Output: ${OUT_DIR}`);

  if (failures.length > 0) {
    console.error(`\n${failures.length} mislukt:`);
    failures.forEach((f) => console.error(`  ${f}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Onverwachte fout:', err);
  process.exit(1);
});
