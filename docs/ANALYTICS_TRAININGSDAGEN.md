# Trainingsdagen meten: is er een premium-laag te bouwen?

Sinds versie 1.0.2 kiest een gebruiker 3 t/m 7 trainingsdagen. Dagen boven de 3
worden gevuld met optionele bonus-duurloopjes. De functie is **bewust gratis**
uitgebracht (zie de afweging hieronder). Deze notitie beschrijft hoe je meet of
er een premium-laag bovenop de moeite waard is.

Draai deze queries in de **Supabase SQL-editor**. Row Level Security blokkeert
gewoon lezen van `public.events`; de editor draait als eigenaar en ziet alles.

## Waarom drie metingen en niet één

Kiezen is gratis. Op een onboardingscherm kost het niets om ambitieus te zijn,
dus "hoeveel mensen kiezen 5 dagen" meet **intentie**, geen waarde. Pas of die
bonusloopjes ook echt gelopen worden meet **gedrag** — en alleen gedrag betaalt.
Blijven ze structureel liggen, dan is dit geen premium-functie maar iets dat
juist vereenvoudigd moet worden.

## 1. Intentie — wat kiezen mensen bij de start?

```sql
select
  (props->>'trainingDays')::int as dagen,
  count(distinct user_id)       as gebruikers,
  round(100.0 * count(distinct user_id)
        / sum(count(distinct user_id)) over (), 1) as pct
from public.events
where event_name = 'onboarding_completed'
  and props ? 'trainingDays'
group by 1
order by 1;
```

## 2. Bijstelling — schalen ze later op of af?

Afschalen is het interessantste signaal: dat betekent dat de app te veel vroeg.

```sql
select
  case when (props->>'trainingDays')::int
          > (props->>'previousTrainingDays')::int then 'omhoog' else 'omlaag' end as richting,
  count(*)                as keer,
  count(distinct user_id) as gebruikers
from public.events
where event_name = 'training_days_changed'
group by 1;
```

Detail per overgang (van hoeveel dagen naar hoeveel):

```sql
select
  (props->>'previousTrainingDays')::int as van,
  (props->>'trainingDays')::int         as naar,
  count(*)                              as keer
from public.events
where event_name = 'training_days_changed'
group by 1, 2
order by 1, 2;
```

## 3. Gedrag — worden de bonusloopjes echt gelopen?

Dit is de beslissende query.

```sql
select
  (props->>'isOptional')::boolean as bonusloop,
  count(*)                        as runs,
  count(distinct user_id)         as gebruikers
from public.events
where event_name = 'run_completed'
  and props ? 'isOptional'
group by 1;
```

En het echte antwoord: verdelen we per gekozen aantal dagen, hoeveel van de
gelopen runs zijn dan bonus? De CTE pakt per gebruiker de **meest recente**
dagkeuze, zodat iemand die later bijstelt in de juiste groep valt.

```sql
with dagen as (
  select distinct on (user_id)
    user_id,
    (props->>'trainingDays')::int as dagen
  from public.events
  where event_name in ('onboarding_completed', 'training_days_changed')
    and props ? 'trainingDays'
  order by user_id, occurred_at desc
)
select
  d.dagen,
  count(distinct d.user_id)                                      as gebruikers,
  count(*) filter (where (e.props->>'isOptional')::boolean)       as bonus_runs,
  count(*) filter (where not (e.props->>'isOptional')::boolean)   as schema_runs
from dagen d
left join public.events e
  on  e.user_id    = d.user_id
  and e.event_name = 'run_completed'
  and e.props ?     'isOptional'
group by d.dagen
order by d.dagen;
```

## Beslisregel

Wacht tot er genoeg gebruikers doorheen zijn — met een handvol accounts is elk
percentage ruis. Kijk dan:

- **Veel mensen kiezen >3 dagen én lopen de bonusruns ook.** Dan is er waarde.
  Bouw de premium-laag als een volume-keuze ("rustig / normaal / stevig") die
  `BONUS_BUDGET_FRACTIE` in `src/data/trainingPlans.ts` verschuift van 25% naar
  bijvoorbeeld 15%, 25% of 40%. Die constante staat er los voor, juist hiervoor.
- **Ze kiezen wel meer dagen maar lopen de bonusruns niet.** Geen premium-laag.
  Overweeg het omgekeerde: de bonusloopjes minder prominent maken, of het
  standaardaantal dagen op 3 laten staan.
- **Ze schalen massaal terug naar 3.** Dan is het budget van 25% te agressief,
  niet te voorzichtig. Verlaag de constante in plaats van er iets voor te vragen.

## Waarom dit gratis is uitgebracht

1. De dagkiezer staat in de **onboarding**, vóór enige bewezen waarde. Een
   betaalmuur daar converteert nauwelijks en kost je de gebruiker.
2. In het vrije schema kon je **altijd al** onbeperkt sessies op elke dag zetten.
   Gaten zou bestaande gebruikers iets afnemen.
3. Het onderscheid bestaat al zonder extra werk: `paceForType` in
   `src/hooks/useRacePace.ts` geeft zonder premium `null` terug, dus een gratis
   gebruiker ziet een bonusloop mét afstand maar **zonder** tempo op zijn
   doeltijd, en zonder stembegeleiding. Dat volgt precies de lijn die in
   `src/config/premiumConfig.ts` staat: het schema is gratis, de personalisatie
   is premium.

## Privacy

De events bevatten uitsluitend **aantallen en booleans**. De gekozen weekdagen
zelf gaan bewust nooit mee: "loopt dinsdag, donderdag en zondag" is een
gedragspatroon dat naar een persoon herleidbaar is. Zie de filosofie boven in
`src/services/analyticsService.ts`.
