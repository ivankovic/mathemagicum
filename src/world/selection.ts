// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { GridPoint } from "./topdown";

/**
 * A patch of ground the player has drawn round.
 *
 * The array spell used to choose its own rectangle and hand it to the child.
 * Now the child draws it — two corners on the map — and the spell asks about
 * what they drew. That is the right way round for a spell about *area*: the
 * numbers in the question are the numbers they just made with their hands.
 *
 * Which means the geometry is a thing of its own rather than a detail of the
 * spell: it has to normalise whichever way the drag went, hold itself inside
 * the world, and stop at a size the parchment can still draw. All three are
 * arithmetic on four numbers, so they live here where they can be proved
 * rather than in the scene where they would have to be screenshotted.
 */

/**
 * The longest side a patch may have.
 *
 * A cap is needed whatever else is true: a drag across half the map is a
 * thousand dots, and the parchment has no answer for that. Ten is where the
 * dots stop being countable at the size a child actually sees them, and it
 * is also where the times tables stop.
 *
 * **Flat, not per rung.** A reach that grew with the ladder would lock a
 * *tool* behind arithmetic, which is the one thing `difficulty.ts` rules out
 * — a rung changes the numbers, never what the game gives you. The child's
 * rectangle sets the numbers here; the rung only withdraws the help.
 */
export const PATCH_REACH = 10;

/** The fewest cells worth asking a multiplication about. */
export const PATCH_LEAST = 2;

/**
 * How far out to pull the camera while a patch is being drawn.
 *
 * **A reach you cannot see is not a reach.** The spell lets a child draw ten
 * squares across; at the world's own zoom, ten squares are 640 screen pixels
 * and an iPhone is 390 of them. So the far corner of anything but a small
 * rectangle was simply not on the screen, and a playtest came back with
 * children who could only ever mark one row or one column.
 *
 * It bites hardest indoors, which is where it was reported. A cottage fills
 * a phone from wall to wall, and the squares this spell *builds* on are the
 * ones beyond those walls — so the ground a child was being asked to draw
 * round was the one part of the room they could not see at all.
 *
 * **Integer zooms only**, which is the rule the whole renderer is built on:
 * every world pixel has to land on a whole number of screen pixels or the
 * art shimmers. So this picks the largest whole zoom that fits the reach
 * rather than the exact one that would — and never goes below 1, because
 * under that a tile is sixteen pixels and a finger is not.
 *
 * **The smaller side decides it.** A patch may be ten squares either way, so
 * the axis with less room to give is the one that has to fit. On a desktop
 * that is the height and it already clears the reach, so nothing there
 * changes at all — this is a phone's fix and it should be invisible
 * everywhere else.
 */
export function markingZoom(
  view: { readonly width: number; readonly height: number },
  tile: number,
  normal: number,
  reach: number = PATCH_REACH,
): number {
  const shorter = Math.min(view.width, view.height);
  const fits = Math.floor(shorter / (tile * reach));
  return Math.max(1, Math.min(normal, fits));
}

export interface Patch {
  readonly col: number;
  readonly row: number;
  readonly width: number;
  readonly height: number;
}

export interface WorldSize {
  readonly width: number;
  readonly height: number;
}

/**
 * The patch between two corners.
 *
 * `from` is where the drag started and is the corner that stays put: a patch
 * clamped by moving its anchor would slide out from under the finger that
 * placed it, which reads as the game arguing rather than as a limit.
 *
 * Clamped to the world before it is clamped to the reach, so a drag off the
 * edge of the map gives a smaller patch rather than one with cells that are
 * not there.
 */
export function patchBetween(from: GridPoint, to: GridPoint, world: WorldSize): Patch {
  const inside = (value: number, most: number) =>
    Math.max(0, Math.min(most - 1, Math.trunc(value)));
  const anchorCol = inside(from.col, world.width);
  const anchorRow = inside(from.row, world.height);
  const dragCol = inside(to.col, world.width);
  const dragRow = inside(to.row, world.height);

  // Signed reach from the anchor, so the patch grows the way the drag went
  // and stops at PATCH_REACH without the anchor moving.
  const far = (anchor: number, drag: number) => {
    const step = Math.sign(drag - anchor);
    const span = Math.min(Math.abs(drag - anchor), PATCH_REACH - 1);
    return anchor + step * span;
  };
  const endCol = far(anchorCol, dragCol);
  const endRow = far(anchorRow, dragRow);

  return {
    col: Math.min(anchorCol, endCol),
    row: Math.min(anchorRow, endRow),
    width: Math.abs(endCol - anchorCol) + 1,
    height: Math.abs(endRow - anchorRow) + 1,
  };
}

export function patchCells(patch: Patch): GridPoint[] {
  const cells: GridPoint[] = [];
  for (let row = patch.row; row < patch.row + patch.height; row++) {
    for (let col = patch.col; col < patch.col + patch.width; col++) {
      cells.push({ col, row });
    }
  }
  return cells;
}

export function patchArea(patch: Patch): number {
  return patch.width * patch.height;
}

export function patchHolds(patch: Patch, at: GridPoint): boolean {
  return (
    at.col >= patch.col &&
    at.col < patch.col + patch.width &&
    at.row >= patch.row &&
    at.row < patch.row + patch.height
  );
}

/**
 * Whether a patch is worth casting on at all.
 *
 * One cell is not a multiplication — "one times one" is a question with
 * nothing in it — so the spell wants two. A single *row* is fine: five in a
 * line is a perfectly good first times table, and refusing it would mean the
 * youngest child could not use the spell on the row of beds they have.
 */
export function patchIsCastable(patch: Patch): boolean {
  return patchArea(patch) >= PATCH_LEAST;
}
