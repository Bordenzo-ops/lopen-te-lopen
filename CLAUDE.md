# Lopen te Lopen — projectinstructies

## Modelbeleid (harde restrictie)

Het model **`fable` / `claude-fable-5` mag NOOIT automatisch worden aangeroepen of
gespawned.** Dit geldt voor de hoofdsessie én voor elke subagent, workflow of
geneste aanroep, zonder uitzondering.

- Roep `fable` nooit aan via de Agent-tool, een `model:`-override, een workflow of
  een skill.
- Stel het ook niet voor als automatische vervolgstap wanneer een taak zwaarder
  blijkt dan verwacht. Opschalen stopt bij `opus`.
- Wil een taak écht fable, leg dat dan expliciet aan Lars voor in de chat en wacht
  op zijn toestemming daar. Toestemming voor één taak geldt niet voor de volgende.

## Modelrouting via subagents

Kies het goedkoopste model dat de taak aankan. De drie projectagents staan in
`.claude/agents/`:

| Agent | Model | Waarvoor |
| --- | --- | --- |
| `code-searcher` | haiku | Zoeken, bestandslocaties vinden, context verzamelen. Read-only. |
| `app-coder` | sonnet | UI bouwen, features implementeren, bugs en typefouten fixen, tests, refactors. |
| `architect-planner` | opus | Architectuur, datamodellen, integratieontwerp, root-cause-analyse. |

Nieuwe agentbestanden worden pas na een herstart van Claude Code in de registry
geladen.

## Werkafspraken

- **Taal:** communicatie en alle gebruikerszichtbare app-teksten in het Nederlands.
  Code-identifiers en commentaar in de code zijn Engels.
- **Builds doet Lars zelf.** Draai geen EAS-builds of store-submissies; lever de
  code op en meld dat hij buildklaar is.
- **Parallelle sessies:** stage nooit met `git add -A`, alleen expliciet genoemde
  bestanden. Er kan een andere sessie in dezelfde repo werken.
- **Geen nieuwe npm-afhankelijkheden** zonder dat Lars daar ja op zegt.
- **Copy:** het einddoel heet altijd "marathon", nooit "halve marathon".
  Schemanamen in code blijven wel `half_marathon`.

## Waar staat wat

- `app/` — Expo Router-schermen (`(tabs)/` is de hoofdnavigatie)
- `src/components/` — herbruikbare UI, `src/components/ui/` de primitieven
- `src/services/` — Strava, Supabase, RevenueCat, voice/TTS, analytics
- `src/data/` — trainingsschema's en statische data
- `supabase/` — edge functions en migraties
- `_workspace/notities/` — jaarplan (WP1–WP14), businessplan, releaseplanning, milestones
- `docs/` — technische setup per integratie
