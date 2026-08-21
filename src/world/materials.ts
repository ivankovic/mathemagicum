// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { SCENERY_FOR_TERRAIN } from "./scenery";

/**
 * What the world gives up when it is cleared.
 *
 * The clearing spell used to give nothing. A child solved a subtraction
 * problem, a tree came out of the ground, and that was the whole of it —
 * which made it the one loop in the game with no reward at the end, and the
 * reason the design doc had to keep explaining why anybody would cast it.
 *
 * Now a tree is wood and a rock is stone, and both are worth what a crop is
 * at the store. That is generous on purpose and it is the *pedagogy* rather
 * than the economy: subtraction is the spell this game under-uses, and
 * paying for it is the plainest way to have it practised. It cannot be
 * farmed, either — nothing regrows, so a child who clears everything within
 * reach has to go back to the garden.
 *
 * **How much depends on what.** A conifer is three, a boulder two, a dead
 * tree one. That is the first time in this game that *which* thing you clear
 * has mattered, and it is a small table a child can learn and then plan
 * around — which is the whole of what a resource is for.
 */

export const MaterialType = {
  /** From anything that grew: the two live trees and the dead one. */
  Wood: "wood",
  /** From anything that did not: boulders, spires, outcrops. */
  Stone: "stone",
} as const;

export type MaterialType = (typeof MaterialType)[keyof typeof MaterialType];

export const MATERIAL_TYPES: readonly MaterialType[] = Object.values(MaterialType);

/**
 * What one of each kind of scenery is worth, by the generator's own name for
 * it — the same keys `SCENERY_FOR_TERRAIN` maps terrain to.
 *
 * The bigger the thing, the more of it. A rock spire is the tallest thing
 * that scatters and gives three; an outcrop is a lump in the sand and gives
 * one. Nothing here is a random draw: a child who learns that conifers are
 * worth three should find that true the next time as well.
 */
export const CLEARED_YIELD: Record<string, { material: MaterialType; count: number }> = {
  // The woods.
  woodland: { material: MaterialType.Wood, count: 3 },
  grass: { material: MaterialType.Wood, count: 2 },
  dirt: { material: MaterialType.Wood, count: 1 },
  // And the rocks.
  mountain: { material: MaterialType.Stone, count: 3 },
  hilly: { material: MaterialType.Stone, count: 2 },
  sand: { material: MaterialType.Stone, count: 1 },
};

/** What clearing this kind of scenery leaves behind, or nothing. */
export function yieldOf(kind: string | null): { material: MaterialType; count: number } | null {
  return kind ? (CLEARED_YIELD[kind] ?? null) : null;
}

/**
 * Every kind of scenery the world scatters has something to give.
 *
 * Stated as a function rather than trusted, because the two lists live in
 * different files for good reasons — one is about terrain and the other
 * about what a thing is made of — and a kind added to the first without the
 * second would be a tree that vanished and paid nothing.
 */
export function everyKindPays(): boolean {
  return Object.values(SCENERY_FOR_TERRAIN).every(
    (kind) => kind !== undefined && kind in CLEARED_YIELD,
  );
}
