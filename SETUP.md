# HalfMarathon Trainer — Installatie-instructies

## Vereisten
- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- Expo Go app op je telefoon (iOS of Android)

## Starten in 3 stappen

```bash
# 1. Naar de projectmap
cd "Hardloop app"

# 2. Dependencies installeren
npm install

# 3. App starten
npx expo start
```

Scan daarna de QR-code met Expo Go op je telefoon.

## Projectstructuur

```
app/
  _layout.tsx               # Root layout + fonts
  index.tsx                 # Redirect naar onboarding of dashboard
  (onboarding)/
    welcome.tsx             # Welkomstscherm
    goal.tsx                # Doelkeuze (5km / 10km / halve marathon)
    profile.tsx             # Naam + leeftijd + hartslagzones
    voice.tsx               # Gesproken begeleiding aan/uit
  (tabs)/
    dashboard.tsx           # Hoofdscherm: week-overzicht + volgende sessie
    schedule.tsx            # Volledig schema (alle weken)
    settings.tsx            # Profiel, zones, integraties
  session/
    active.tsx              # Actieve loopsessie met timer
    summary.tsx             # Samenvatting na afloop

src/
  theme/tokens.ts           # Design tokens (kleuren, spacing, typografie)
  data/trainingPlans.ts     # Schema's voor 5km, 10km en halve marathon
  store/appStore.ts         # Zustand state management
  components/ui/
    Button.tsx
    Card.tsx
    ZoneBadge.tsx
    StatRing.tsx
    SessionCard.tsx
```

## Volgende stappen (uitbreidingen)

- **Echte GPS**: Expo Location API is al geconfigureerd, vervang de mock-afstand in `session/active.tsx`
- **Strava OAuth**: Strava API koppeling via hun REST v3
- **Apple Health / Google Fit**: Via `expo-health-connect` (Android) en HealthKit (iOS)
- **Notificaties**: Sessieherinneringen via `expo-notifications`
- **Kaart**: MapView (react-native-maps) integreren in de actieve sessie
- **Persistentie**: Vervang Zustand in-memory store door Expo SQLite voor duurzame opslag
