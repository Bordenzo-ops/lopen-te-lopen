/**
 * useVoicePackDownload
 *
 * Gedeelde, best-effort downloadlaag voor het natuurlijke stempakket buiten
 * Instellingen: gebruikt door de paywall (na aankoop/herstel) en de
 * VoicePackPrompt-kaart. Gebruikt dezelfde `downloadPack` als Instellingen.
 *
 * De lopende download staat module-breed, zodat een download die op de
 * paywall start gewoon doorloopt (ook als het scherm sluit) en de kaart op
 * het dashboard er daarna op kan aansluiten zonder een tweede download.
 * Gooit nooit: fouten komen terug als Nederlandse tekst.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { downloadPack, getInterruptedDownloads, isPackAvailable, type DownloadPackResult } from '../services/voicePackService';
import type { VoiceType } from '../config/voiceConfig';

type ProgressListener = (done: number, total: number) => void;

interface InFlight {
  voice: VoiceType;
  promise: Promise<DownloadPackResult>;
  listeners: Set<ProgressListener>;
  lastPct: number;
}

let inFlight: InFlight | null = null;

// Notified when a new download starts, so mounted hooks can attach to a
// download they did not start themselves (e.g. automatic resume).
const startedListeners = new Set<(voice: VoiceType) => void>();

/** Is er op dit moment een download voor deze stem bezig? */
export function isVoicePackDownloading(voice: VoiceType): boolean {
  return inFlight?.voice === voice;
}

/**
 * Start (of sluit aan op) de download van het stempakket voor `voice`.
 * Geeft altijd een resolved promise terug; gooit nooit.
 */
export function startVoicePackDownload(
  voice: VoiceType,
  onProgress?: ProgressListener,
): Promise<DownloadPackResult> {
  if (inFlight && inFlight.voice === voice) {
    if (onProgress) inFlight.listeners.add(onProgress);
    return inFlight.promise;
  }

  const listeners = new Set<ProgressListener>();
  if (onProgress) listeners.add(onProgress);

  const entry: InFlight = {
    voice,
    listeners,
    lastPct: 0,
    promise: Promise.resolve({ ok: false }),
  };
  entry.promise = (async () => {
    try {
      return await downloadPack(voice, (done, total) => {
        entry.lastPct = total > 0 ? Math.round((done / total) * 100) : 0;
        listeners.forEach(l => {
          try { l(done, total); } catch { /* listener mag de download niet breken */ }
        });
      });
    } catch {
      return { ok: false, error: 'Downloaden mislukt. Probeer het later opnieuw.' };
    } finally {
      if (inFlight === entry) inFlight = null;
    }
  })();
  inFlight = entry;
  startedListeners.forEach(l => {
    try { l(voice); } catch { /* listener mag de download niet breken */ }
  });
  return entry.promise;
}

/**
 * Resumes downloads that were interrupted earlier (app closed or connection
 * lost mid-download), one voice at a time. Best-effort: never throws.
 */
export async function resumeInterruptedVoicePackDownloads(): Promise<void> {
  try {
    for (const voice of getInterruptedDownloads()) {
      // Stop after the first failure: no connection means the rest would fail too
      const result = await startVoicePackDownload(voice);
      if (!result.ok) break;
    }
  } catch {
    // Best-effort
  }
}

export interface UseVoicePackDownload {
  /** Staat het pakket lokaal klaar? */
  available: boolean;
  /** Bezig met downloaden (ook als de download elders is gestart). */
  busy: boolean;
  /** Voortgang 0-100, of null als er niet gedownload wordt. */
  progressPct: number | null;
  error: string | null;
  start: () => void;
}

export function useVoicePackDownload(voice: VoiceType): UseVoicePackDownload {
  const [available, setAvailable] = useState(() => isPackAvailable(voice));
  const [busy, setBusy] = useState(() => isVoicePackDownloading(voice));
  const [progressPct, setProgressPct] = useState<number | null>(() =>
    isVoicePackDownloading(voice) ? inFlight?.lastPct ?? 0 : null,
  );
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  // Synchronous mirror of "this hook is attached to a download"
  const busyRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Stem gewisseld of pakket elders gewijzigd (bv. gewist in Instellingen):
  // beschikbaarheid opnieuw bepalen i.p.v. alleen de beginwaarde te houden.
  useEffect(() => {
    setAvailable(isPackAvailable(voice));
  }, [voice]);
  useFocusEffect(
    useCallback(() => {
      setAvailable(isPackAvailable(voice));
    }, [voice]),
  );

  const start = useCallback(() => {
    busyRef.current = true;
    setError(null);
    setBusy(true);
    setProgressPct(0);
    void startVoicePackDownload(voice, (done, total) => {
      if (mountedRef.current) setProgressPct(total > 0 ? Math.round((done / total) * 100) : 0);
    }).then(result => {
      busyRef.current = false;
      if (!mountedRef.current) return;
      setBusy(false);
      setProgressPct(null);
      if (result.ok) setAvailable(isPackAvailable(voice));
      else setError(result.error ?? 'Downloaden mislukt. Probeer het later opnieuw.');
    });
  }, [voice]);

  // Sluit aan op een download die al elders (bv. paywall) gestart is.
  useEffect(() => {
    if (isVoicePackDownloading(voice) && !busyRef.current) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice]);

  // Sluit ook aan op een download die start nadat de hook al gemount is
  // (bv. automatisch hervatten bij app-start of terug naar de voorgrond).
  useEffect(() => {
    const onStarted = (startedVoice: VoiceType) => {
      if (startedVoice === voice && !busyRef.current && mountedRef.current) start();
    };
    startedListeners.add(onStarted);
    return () => {
      startedListeners.delete(onStarted);
    };
  }, [voice, start]);

  return { available, busy, progressPct, error, start };
}
