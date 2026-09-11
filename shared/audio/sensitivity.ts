/** Detection threshold on the VU meter: 10% → 90% in 1à% steps (free drag, snap on release). */
export const SENSITIVITY_MIN = 0.1;
export const SENSITIVITY_MAX = 0.9;
export const SENSITIVITY_STEP = 0.1;

export const SENSITIVITY_STEPS = [
  0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9,
] as const;

export const DEFAULT_AUDIO_SENSITIVITY = 0.3;

/**
 * Amplifies raw RMS for the VU meter and the detection gate.
 * Must stay in sync with `SpeechSession.LEVEL_DISPLAY_SCALE`.
 */
export const LEVEL_DISPLAY_SCALE = 14;

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
 * Cursor position on the meter (visual) maps 1:1 onto 10%..85%.
 * The effective detection threshold is the nearest tranche (see snapSensitivity).
 */
export function sensitivityToTrackPosition(sensitivity: number): number {
  return clampSensitivity(sensitivity);
}

export function trackPositionToSensitivity(position: number): number {
  return clampSensitivity(position);
}
