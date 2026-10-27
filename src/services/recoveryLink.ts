/**
 * recoveryLink
 *
 * Vangt wachtwoordherstel-links (lopentelopen://account#access_token=...) op
 * één altijd gemounte plek (app/_layout.tsx) en bewaart ze in een
 * module-level houder. Het accountscherm leest die bij het mounten uit en
 * luistert op latere aankomsten. Zo gaat een link niet verloren als hij
 * binnenkomt vóór /account gemount is, en wordt dezelfde link niet opnieuw
 * verwerkt als /account later nog eens mount (Linking.useURL start bij elke
 * mount weer vanaf de initiële URL).
 */

import * as Linking from 'expo-linking';
import { parseRecoveryLink } from './authService';

let pending: string | null = null;
const consumed = new Set<string>();
const listeners = new Set<() => void>();
let started = false;

function offer(url: string | null | undefined): void {
  if (!url || consumed.has(url) || url === pending) return;
  if (!parseRecoveryLink(url)) return;
  pending = url;
  listeners.forEach(listener => listener());
}

/** Idempotent: start het opvangen van de initiële URL en latere url-events. */
export function startRecoveryLinkCapture(): void {
  if (started) return;
  started = true;
  Linking.getInitialURL().then(offer).catch(() => {});
  Linking.addEventListener('url', event => offer(event.url));
}

/** Geeft de wachtende herstel-URL terug en markeert hem als verwerkt. */
export function takePendingRecoveryUrl(): string | null {
  const url = pending;
  if (!url) return null;
  pending = null;
  consumed.add(url);
  return url;
}

/** Roept `listener` aan zodra er een nieuwe herstel-URL wacht. Geeft een unsubscribe terug. */
export function subscribeRecoveryLink(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
