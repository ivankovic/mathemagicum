// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * Spell effects: what a cast looks like on the tile it lands on.
 *
 * These are the only sprites in the game that are neither terrain, scenery,
 * a character nor a crop — nothing walks round them, nothing is occluded by
 * them, and each one exists for well under a second. What they share with
 * everything else is the tile grid: an effect happens *at a tile*, so it is
 * drawn on the same cell and anchored the same way as a plant is.
 *
 * They play once and destroy themselves. That is stated in the generator's
 * sidecar rather than assumed here — an effect left looping would never go
 * away, and there would be nothing on screen to say whose fault it was.
 */

export const EffectType = {
  /** The addition spell landing on the crop it grows. */
  Plus: "plus",
  /**
   * The subtraction spell lifting what was in the way out of the ground.
   *
   * The plus's mirror in every respect, including the direction: that one
   * sinks *into* the tile because it is being added to what is down there,
   * and this one takes hold at the ground and rises. See the generator's own
   * note — reversed, it would say the spell puts something down.
   */
  Minus: "minus",
} as const;

export type EffectType = (typeof EffectType)[keyof typeof EffectType];

export const EFFECT_TYPES: readonly EffectType[] = Object.values(EffectType);

export function effectSheetKey(effect: EffectType): string {
  return `effect-${effect}`;
}

export function effectSidecarKey(effect: EffectType): string {
  return `effect-sidecar-${effect}`;
}

// Matches the sidecar's own animation name.
export function effectAnimKey(effect: EffectType): string {
  return `effect-${effect}-cast`;
}

// Eight frames at this rate is two thirds of a second: long enough for the
// plus to be read as a plus before it lands, short enough that the player is
// not waiting on it before they can move.
export const EFFECT_FPS = 12;
