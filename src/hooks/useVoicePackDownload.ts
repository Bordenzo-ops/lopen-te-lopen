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
import { downloadPack, isPackAvailable, type DownloadPackResult } from '../services/voicePackService';
import type { VoiceType } from '../config/voiceConfig';

type ProgressListener = (done: number, total: number) => void;

interface InFlight {
  voice: VoiceType;
  promise: Promise<DownloadPackResult>;
  listeners: Set<ProgressListener>;
  lastPct: number;
}

let inFlight: InFlight | null = null;

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
  return entry.promise;
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
    setError(null);
    setBusy(true);
    setProgressPct(0);
    void startVoicePackDownload(voice, (done, total) => {
      if (mountedRef.current) setProgressPct(total > 0 ? Math.round((done / total) * 100) : 0);
    }).then(result => {
      if (!mountedRef.current) return;
      setBusy(false);
      setProgressPct(null);
      if (result.ok) setAvailable(isPackAvailable(voice));
      else setError(result.error ?? 'Downloaden mislukt. Probeer het later opnieuw.');
    });
  }, [voice]);

  // Sluit aan op een download die al elders (bv. paywall) gestart is.
  useEffect(() => {
    if (isVoicePackDownloading(voice) && !busy) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice]);

  return { available, busy, progressPct, error, start };
}
