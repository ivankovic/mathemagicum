// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * How anybody who is not the player decides where to put their foot.
 *
 * The villagers and the animals walk the same way — a short circuit near
 * where they belong, and a straight-ish line home when the light goes — and
 * that walk lived in `GameScene` among the sprites and the tweens, where
 * none of it could be tested. What is here is the *deciding*: which square
 * is being tried, and in which order. Whose feet move and how they are
 * animated stays with the scene, because that is a fact about sprites.
 *
 * Nothing here touches the grid either. Both functions answer in candidate
 * squares and the caller asks whether they can be stepped on — which is the
 * one question the world can answer and this module cannot.
 */

import type { GridPoint } from "./topdown";

export interface Direction {
  readonly dCol: number;
  readonly dRow: number;
}

/** The four a foot can go. No diagonals: the art is drawn for four facings. */
export const STEP_DIRECTIONS: readonly Direction[] = [
  { dCol: 0, dRow: -1 },
  { dCol: 0, dRow: 1 },
  { dCol: -1, dRow: 0 },
  { dCol: 1, dRow: 0 },
];

/**
 * Whether a square is still within somebody's own patch of the world.
 *
 * Measured as a square rather than as a circle — the greater of the two
 * distances — because the thing being described is a patch of ground a
 * villager keeps to, and a chessboard distance is what "a few squares either
 * way" means to anybody looking at it.
 */
export function insideWander(centre: GridPoint, radius: number, at: GridPoint): boolean {
  return Math.max(Math.abs(at.col - centre.col), Math.abs(at.row - centre.row)) <= radius;
}

/**
 * The steps to try, in order, for somebody walking home.
 *
 * Greedy on the longer axis first, and the second axis offered as a fallback
 * for when the first is blocked. Not a path: the village is an open square
 * with spokes off it, so a straight-ish line home rarely needs to route
 * around anything, and a real search would be a great deal of machinery for
 * a walk across a plaza.
 *
 * Empty when they are already there, which is what stops a villager standing
 * on their own doorstep from twitching all evening.
 */
export function stepsToward(from: GridPoint, to: GridPoint): Direction[] {
  if (from.col === to.col && from.row === to.row) return [];
  const dCol = Math.sign(to.col - from.col);
  const dRow = Math.sign(to.row - from.row);
  const across = { dCol, dRow: 0 };
  const down = { dCol: 0, dRow };
  const first = Math.abs(to.col - from.col) >= Math.abs(to.row - from.row) ? across : down;
  const second = first === across ? down : across;
  return [first, second].filter((step) => step.dCol !== 0 || step.dRow !== 0);
}
