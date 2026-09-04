// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { SCENERY_FOR_TERRAIN } from "./scenery";

/**
 * What a basket holds that is not a crop, a fixture or a bit of furniture:
 * what the world gave up, and what a press has since made of it.
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
  /**
   * Squared timber, pinned with stone. The first thing in this game that is
   * *made* rather than found.
   */
  Beam: "beam",
  /** Rope, twisted out of straw and stem. The other half of a vessel. */
  Cord: "cord",
} as const;

export type MaterialType = (typeof MaterialType)[keyof typeof MaterialType];

export const MATERIAL_TYPES: readonly MaterialType[] = Object.values(MaterialType);

/**
 * The ones the world hands over, and the ones a press hands back.
 *
 * A basket does not care about the difference — both are counted, carried
 * and drawn the same way, which is why they are one type. Two places do
 * care, and both of them are about *where a thing can go*.
 *
 * **The store buys the gathered ones and not the made ones.** That is the
 * whole reason this split exists. Wood and stone are paid for because
 * subtraction is the spell this game under-uses and paying for it is the
 * plainest way to have it practised. A beam is what that wood was spent on;
 * putting a price on it would make a press a slower way of selling wood,
 * which is the exact shape the machines were built to get away from — the
 * design doc's complaint that materials with nowhere to go are "coins with
 * an extra step".
 *
 * Selling them would not even pay: a beam costs more wood than it is worth.
 * The rule is here because it should be a decision rather than an accident
 * of arithmetic.
 */
export const GATHERED_MATERIALS: readonly MaterialType[] = [MaterialType.Wood, MaterialType.Stone];

export const MADE_MATERIALS: readonly MaterialType[] = [MaterialType.Beam, MaterialType.Cord];

/** Whether the world gave this up, as opposed to a machine having made it. */
export function isGathered(material: string): boolean {
  return (GATHERED_MATERIALS as readonly string[]).includes(material);
}

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
