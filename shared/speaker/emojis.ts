/**
 * Stable emoji palette for speaker mode.
 * Locuteur N always maps to SPEAKER_EMOJIS[(N - 1) % length] across sessions.
 * Chosen for high visual contrast (shape + color) so adjacent speakers are easy to tell apart.
 */
export const SPEAKER_EMOJIS = [
  '🦊', // orange fox
  '🐸', // green frog
  '🐙', // purple octopus
  '🦄', // pastel unicorn
  '🐼', // black/white panda
  '🦁', // yellow lion
  '🐧', // tuxedo penguin
  '🦉', // brown owl
  '🦋', // blue butterfly
  '🐝', // yellow/black bee
  '🍎', // red apple
  '🍋', // yellow lemon
  '🍇', // purple grapes
  '🍉', // green/red melon
  '🥑', // green avocado
  '🥕', // orange carrot
  '🌽', // yellow corn
  '🍄', // red mushroom
  '⚽', // black/white ball
  '🎸', // brown guitar
  '🚀', // rocket
  '💎', // blue gem
  '🔥', // fire
  '❄️', // snowflake
  '⚡', // lightning
  '🌈', // rainbow
  '🎩', // top hat
  '👑', // crown
  '🧩', // puzzle piece
  '🎯', // bullseye
  '🎲', // dice
  '🧿', // nazar amulet
] as const;

const LOCUTEUR_PATTERN = /^Locuteur\s+(\d+)$/i;

export function speakerIndexFromLabel(label: string): number | null {
  const match = LOCUTEUR_PATTERN.exec(label.trim());
  if (!match) {
    return null;
  }
  const index = Number.parseInt(match[1], 10);
  return Number.isFinite(index) && index > 0 ? index : null;
}

export function emojiForSpeakerIndex(index: number): string {
  const offset = ((index - 1) % SPEAKER_EMOJIS.length + SPEAKER_EMOJIS.length) %
    SPEAKER_EMOJIS.length;
  return SPEAKER_EMOJIS[offset];
}

/** Prefixes the stable emoji before an existing "Locuteur N" label. */
export function formatSpeakerLabel(label: string): string {
  const index = speakerIndexFromLabel(label);
  if (index == null) {
    return label;
  }
  return `${emojiForSpeakerIndex(index)} ${label}`;
}
