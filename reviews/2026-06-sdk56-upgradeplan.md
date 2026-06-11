# Upgradeplan: Expo SDK 54 naar SDK 56

Datum: 10 juni 2026
Deadline: voor september 2026 (verwachte komst SDK 57, dan vervalt EAS support voor SDK 54)

## Waarom upgraden

SDK 54 is twee versies achter en is de laatste versie met Legacy Architecture. Vanaf SDK 55 draait alles verplicht op de New Architecture. SDK 56 (mei 2026) brengt React Native 0.85 en React 19.2.

## Compatibiliteitsanalyse (al uitgevoerd)

Per native dependency van deze app:

- react-native-maps 1.20.1: werkt op de New Architecture via de interop layer, stabiel voor de gebruikte features (kaart, polylines, markers). Versie 1.21+ is New Architecture first maar nog aan het stabiliseren. Laat expo install de juiste versie kiezen.
- react-native-view-shot 4.0.3: BREEKT op de New Architecture ("Failed to snapshot view tag"). Moet naar versie 5.x. Dit raakt de deelkaart-functie (ShareRunCard); test die grondig na de upgrade.
- expo-av: wordt nergens in de code geimporteerd en is vanaf SDK 55 uit de SDK verwijderd. Verwijderen dus. De app gebruikt expo-speech voor audio coaching, dat blijft gewoon bestaan.
- react-native-worklets-core 1.6.3: wordt nergens geimporteerd. Verwijderen. (react-native-worklets, zonder "-core", is wel nodig voor reanimated 4 en blijft staan.)
- reanimated, gesture-handler, screens, safe-area-context, svg: volgen automatisch mee met expo install, allemaal New Architecture compatibel.
- zustand 4 en date-fns 3: pure JavaScript, geen probleem. Major updates naar v5/v4 zijn optioneel en staan los van deze upgrade.
- lucide-react-native: pure JS bovenop react-native-svg, geen probleem.

Conclusie: er is geen blokkerende dependency. Het enige echte risico is react-native-view-shot, en daarvoor bestaat een werkende v5.

## Stappenplan (uitvoeren in Windows Terminal)

Stap 0, schone uitgangssituatie:

```
cd "C:\Users\Lars\Documents\Claude\Projects\Hardloop app"
git add -A
git commit -m "Snapshot voor SDK 56 upgrade"
```

Geen git repo? Sla deze stap over maar maak dan eerst een kopie van de map.

Stap 1, ongebruikte packages weg:

```
npm uninstall expo-av react-native-worklets-core
```

Stap 2, de upgrade zelf:

```
npx expo install expo@^56.0.0 --fix
```

Dit zet alle expo-packages en native dependencies op de juiste versie voor SDK 56, inclusief view-shot. Controleer daarna in package.json dat react-native-view-shot op 5.x staat; zo niet:

```
npx expo install react-native-view-shot
```

Stap 3, controleren:

```
npx expo-doctor
npx tsc --noEmit
```

Los meldingen van expo-doctor op met de voorgestelde commando's. TypeScript-errors kun je aan mij geven, die los ik op.

Stap 4, lokaal testen:

```
npx expo start
```

Test in elk geval: GPS tracking tijdens een (korte) run, de kaartweergave, audio coaching (expo-speech), opslaan en delen van de run-kaart (de view-shot feature, grootste risico), en de week- en schemaweergave.

Stap 5, testbuild via EAS:

```
eas build --profile preview --platform android
```

Installeer de APK op je telefoon en herhaal de tests. Daarna pas een productiebuild.

## Verwachte aandachtspunten

- Eerste keer bouwen op de New Architecture kan nieuwe warnings geven; alleen echte errors zijn blokkerend.
- Als de deelkaart leeg of zwart is na de upgrade: caches legen (npx expo start --clear) en checken dat view-shot echt op 5.x staat.
- React 19.2 is strikter met sommige patronen; eventuele nieuwe TypeScript-errors zijn meestal kleine fixes.

## Bronnen

- https://expo.dev/changelog/sdk-56
- https://expo.dev/changelog/sdk-55
- https://expo.dev/blog/upgrading-to-sdk-56
- https://docs.expo.dev/guides/new-architecture/
- https://docs.expo.dev/versions/latest/sdk/av/ (expo-av deprecatie)
