/**
 * reviewService
 *
 * Vraagt op een rustig moment om een winkelbeoordeling, met een eigen
 * voorvraag zodat een ontevreden gebruiker niet meteen naar de store-review
 * gestuurd wordt. Zelfde offline-first opzet als healthConnectService en
 * notificationService: zonder de geinstalleerde native module, zonder
 * beschikbare store-review-API of bij een willekeurige fout blijft dit
 * bestand overal stil in. Niets hier mag de app ooit laten crashen.
 *
 * Vereist: npx expo install expo-store-review
 */

import { Alert, Linking } from 'react-native';

// ── Eigen minimale typedefinitie voor expo-store-review ─────────────────────
// Geen import type van de package: tsc moet ook schoon blijven zonder dat het
// pakket geinstalleerd is. Dit dekt alleen wat wij gebruiken.

interface StoreReviewModule {
  isAvailableAsync: () => Promise<boolean>;
  requestReview: () => Promise<void>;
}

// Module-level lazy singleton: de require gebeurt maximaal eenmaal.
let storeReviewModule: StoreReviewModule | null = null;
let loadAttempted = false;

function loadStoreReviewModule(): StoreReviewModule | null {
  if (loadAttempted) return storeReviewModule;
  loadAttempted = true;

  try {
    // Dynamic require: als het pakket niet geinstalleerd is, gooit dit een
    // fout die we hier afvangen. De service blijft dan permanent uitgeschakeld.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('expo-store-review');
    storeReviewModule = mod as StoreReviewModule;
  } catch {
    storeReviewModule = null;
  }
  return storeReviewModule;
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/** Is het (opnieuw) tijd om te vragen? Nog nooit gevraagd, of langer dan 90 dagen geleden. */
function isPromptDue(lastReviewPromptAt: string | null): boolean {
  if (!lastReviewPromptAt) return true;
  const last = new Date(lastReviewPromptAt).getTime();
  if (Number.isNaN(last)) return true;
  return Date.now() - last > NINETY_DAYS_MS;
}

export interface ReviewContext {
  /** Totaal aantal ooit voltooide sessies (inclusief de zojuist afgeronde). */
  totalCompletedSessions: number;
  /** Was de zojuist afgeronde sessie volledig (doelafstand gehaald, niet vroegtijdig gestopt)? */
  sessionWasComplete: boolean;
  /** ISO-datum van de vorige keer dat we dit gevraagd hebben, of null. */
  lastReviewPromptAt: string | null;
  /** Callback om lastReviewPromptAt op nu te zetten in de store, ongeacht het antwoord. */
  onPromptShown: () => void;
}

/**
 * Vraagt hoogstens onder de juiste voorwaarden om een beoordeling: minstens
 * 3 voltooide sessies, de zojuist afgeronde sessie was volledig, de laatste
 * vraag was nooit of langer dan 90 dagen geleden, en de store-review-API is
 * op dit toestel beschikbaar. Toont eerst een eigen voorvraag; alleen bij
 * "Ja, zeker!" wordt de native review-flow geopend.
 */
export async function maybeAskForReview(context: ReviewContext): Promise<void> {
  try {
    if (context.totalCompletedSessions < 3) return;
    if (!context.sessionWasComplete) return;
    if (!isPromptDue(context.lastReviewPromptAt)) return;

    const StoreReview = loadStoreReviewModule();
    if (!StoreReview) return;

    const available = await StoreReview.isAvailableAsync();
    if (!available) return;

    Alert.alert(
      'Geniet je van Lopen te Lopen?',
      'We horen graag wat je ervan vindt.',
      [
        {
          text: 'Kan beter',
          onPress: () => {
            context.onPromptShown();
            void openFeedbackMail();
          },
        },
        {
          text: 'Ja, zeker!',
          onPress: () => {
            context.onPromptShown();
            void requestNativeReview(StoreReview);
          },
        },
      ],
      { cancelable: false },
    );
  } catch {
    // Faalt stil: een reviewvraag mag de app nooit laten crashen
  }
}

async function requestNativeReview(StoreReview: StoreReviewModule): Promise<void> {
  try {
    await StoreReview.requestReview();
  } catch {
    // Stil falen
  }
}

async function openFeedbackMail(): Promise<void> {
  try {
    const subject = encodeURIComponent('Feedback Lopen te Lopen');
    const body = encodeURIComponent(
      'Hoi Lars,\n\nBedankt dat je de tijd neemt om feedback te geven over Lopen te Lopen! Wat kan er beter?\n\n',
    );
    await Linking.openURL(`mailto:larsvdb1@hotmail.com?subject=${subject}&body=${body}`);
  } catch {
    // Stil falen: geen mailclient beschikbaar op dit toestel
  }
}
