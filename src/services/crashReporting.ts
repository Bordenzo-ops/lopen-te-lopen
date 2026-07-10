/**
 * crashReporting
 *
 * Optionele Sentry-crashrapportage. Zonder EXPO_PUBLIC_SENTRY_DSN blijft dit
 * hele bestand stil: initCrashReporting() doet dan simpelweg niets, en de
 * ErrorBoundary vangt fouten alsnog netjes op met een Nederlandse
 * fallback-tekst, maar stuurt niets naar Sentry.
 *
 * Dit bestand heeft bewust de extensie .ts (geen JSX-syntax) en bouwt de
 * fallback-UI daarom op met React.createElement in plaats van JSX.
 *
 * BELANGRIJK: dit bestand initialiseert zichzelf niet automatisch. Een andere
 * agent (of Lars) moet in app/_layout.tsx nog het volgende toevoegen, zo vroeg
 * mogelijk (buiten de component, op module-niveau):
 *
 *   import { initCrashReporting } from '../src/services/crashReporting';
 *   initCrashReporting();
 *
 * En de root-JSX in datzelfde bestand wrappen met de geexporteerde
 * CrashReportingBoundary-component.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Lazy/optioneel geladen: als @sentry/react-native niet geinstalleerd is (of
// nog niet via npm opgehaald kon worden), mag dit bestand nooit een crash bij
// het opstarten veroorzaken.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Sentry: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Sentry = require('@sentry/react-native');
} catch {
  Sentry = null;
}

let initialized = false;

/**
 * Initialiseer Sentry, alleen als er een DSN is ingesteld via
 * EXPO_PUBLIC_SENTRY_DSN. Leeg of ontbrekend: sla stilletjes over, net als
 * de andere optionele backends in dit project (Supabase, RevenueCat).
 */
export function initCrashReporting(): void {
  if (initialized) return;
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  if (!Sentry) return;

  try {
    Sentry.init({
      dsn,
      // Prestatietracing en sessie-replay bewust uit: dit is puur voor
      // crashrapportage, niet voor uitgebreide monitoring.
      tracesSampleRate: 0,
      enableAutoSessionTracking: true,
    });
    initialized = true;
  } catch {
    // Faalt stil: geen crashrapportage is beter dan een crash bij het opstarten.
  }
}

const FALLBACK_TEXT = 'Er ging iets mis. Start de app opnieuw.';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A0F1A',
    padding: 24,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
  },
});

function renderFallback(): React.ReactElement {
  return React.createElement(
    View,
    { style: styles.container },
    React.createElement(Text, { style: styles.text }, FALLBACK_TEXT),
  );
}

interface BoundaryState {
  hasError: boolean;
}

/**
 * Eigen ErrorBoundary-implementatie met een Nederlandse fallback-tekst.
 * Wordt gebruikt als Sentry niet beschikbaar is: dan tonen we alleen de
 * fallback-tekst zonder ergens naartoe te rapporteren.
 */
class FallbackBoundary extends React.Component<React.PropsWithChildren, BoundaryState> {
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  componentDidCatch(): void {
    // Faalt stil: er is bewust geen verdere foutafhandeling nodig zonder Sentry.
  }

  render() {
    if (this.state.hasError) return renderFallback();
    return this.props.children as React.ReactElement;
  }
}

/**
 * Wrapper-component voor rond de hele app. Gebruik in app/_layout.tsx om
 * onverwachte render-fouten netjes op te vangen met een Nederlandse melding,
 * in plaats van een wit crash-schermpje. Gebruikt Sentry.ErrorBoundary als
 * die beschikbaar is (dan wordt de fout ook gerapporteerd), en valt anders
 * terug op de eigen FallbackBoundary hierboven.
 */
export function CrashReportingBoundary(
  props: React.PropsWithChildren<{}>,
): React.ReactElement {
  if (Sentry?.ErrorBoundary) {
    return React.createElement(
      Sentry.ErrorBoundary,
      { fallback: renderFallback },
      props.children,
    );
  }
  return React.createElement(FallbackBoundary, null, props.children);
}
