// ─────────────────────────────────────────────
// Warming-up & cooling-down — losse routine (CP3)
// ─────────────────────────────────────────────
//
// Pure hulpmodule, geen React/state: alleen de stapduren voor de timer in de
// UI (app/routine/warmup.tsx en cooldown.tsx). De teksten zelf (gesproken én
// getoond) staan in src/config/voicePhrases.ts (warmupUtterance/
// cooldownRoutineUtterance) — dat blijft de ENE bron van waarheid voor tekst,
// dit bestand duplicceert die tekst dus bewust niet.
//
// Index-uitlijning: WARMUP_STEP_DURATIONS_SEC[i] hoort bij wu_step_{i},
// COOLDOWN_STEP_DURATIONS_SEC[i] bij cd_step_{i} (zelfde volgorde/lengte als
// WU_STEP_TEXTS/CD_STEP_TEXTS in voicePhrases.ts).

export const WARMUP_STEP_DURATIONS_SEC: number[] = [60, 20, 20, 20, 30, 30];
export const COOLDOWN_STEP_DURATIONS_SEC: number[] = [60, 30, 30, 30, 30];
