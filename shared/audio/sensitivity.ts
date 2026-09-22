/** Detection threshold on the VU meter: 10% → 90% in 10% steps (free drag, snap on release). */
export const SENSITIVITY_MIN = 0.1;
export const SENSITIVITY_MAX = 0.9;
export const SENSITIVITY_STEP = 0.1;

export const SENSITIVITY_STEPS = [
  0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9,
] as const;

export const DEFAULT_AUDIO_SENSITIVITY = 0.3;

/**
 * dB floor/ceiling for RMS → VU / gate mapping.
 * Must stay in sync with `SpeechSession` (`LEVEL_DB_MIN` / `LEVEL_DB_MAX`).
 *
 * Wider span than a linear scale: quiet speech clears ~10%, ambient noise
 * stays out of the red, and high thresholds require louder input.
 */
export const LEVEL_DB_MIN = -55;
export const LEVEL_DB_MAX = -12;

/**
 * Maps raw PCM RMS (0..1) onto the 0..1 meter / detection scale.
 * Shared by the JS VU meter and the native audio gate.
 */
export function rmsToDisplayLevel(rms: number): number {
  if (!(rms > 0)) {
    return 0;
  }
  const db = 20 * Math.log10(rms);
  const normalized = (db - LEVEL_DB_MIN) / (LEVEL_DB_MAX - LEVEL_DB_MIN);
  return Math.min(1, Math.max(0, normalized));
}

export function clampSensitivity(value: number): number {
  return Math.min(SENSITIVITY_MAX, Math.max(SENSITIVITY_MIN, value));
}

export function snapSensitivity(value: number): number {
  const clamped = clampSensitivity(value);
  let best: number = SENSITIVITY_STEPS[0];
  let bestDistance = Math.abs(clamped - best);
  for (const step of SENSITIVITY_STEPS) {
    const distance = Math.abs(clamped - step);
    if (distance < bestDistance) {
      best = step;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Cursor position on the meter (visual) maps 1:1 onto 10%..90%.
 * The effective detection threshold is the nearest tranche (see snapSensitivity).
 */
export function sensitivityToTrackPosition(sensitivity: number): number {
  return clampSensitivity(sensitivity);
}

export function trackPositionToSensitivity(position: number): number {
  return clampSensitivity(position);
}
