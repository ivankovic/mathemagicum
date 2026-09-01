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
const PATCH_LEAST = 2;

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

/**
 * What a marked patch is about to have done to it.
 *
 * Here rather than in the scene, and moved out of it for a reason worth
 * writing down: a scenario asking for the *build* button had to import this,
 * importing it pulled `GameScene` in, and pulling that in pulled Phaser into
 * a process with no `window` in it. A patch and what may be done to one are
 * facts about the world; only the drawing of the menu is the scene's.
 */
export const PatchAction = {
  /**
   * Sow every square of it, in one cast.
   *
   * The newest of them and the one the tree's errand turns on. A seed costs
   * nothing and planting one asks no arithmetic — it is a tap — so this is
   * the one action whose whole price is the multiplication. Sixteen squares
   * for one answer, against sixteen taps: that *is* the argument for
   * multiplication, made with the child's own hands rather than in a
   * sentence they cannot read.
   *
   * It plants whatever seed the pouch has last been asked for, which is the
   * same seed the number keys plant and the same one the button shows — a
   * patch action that picked its own crop would be a second way of choosing
   * a seed, and the pouch is already the first.
   */
  Plant: "plant",
  Grow: "grow",
  Clear: "clear",
  /**
   * Build every square of it, indoors.
   *
   * The one action that is not about the garden, and it is here rather than
   * as a spell of its own for the reason the others are: from the child's
   * side this is a *choice about a patch*. Multiplication is doing the same
   * thing many times without doing it many times, and laying nine squares of
   * floor is as good an example of that as planting nine carrots.
   */
  Build: "build",
  /**
   * Copy the whole block somewhere else, ground and all.
   *
   * The mirror spell's effect, taken from one square to a rectangle of them.
   * It is here rather than being a mode of the mirror spell for the reason
   * building is here: from the child's side this is a *choice about a
   * patch*, and what the times spell contributes is the block — doing a
   * thing to many squares without doing it many times, which is the whole
   * of what multiplication is for.
   */
  Copy: "copy",
  /**
   * Pick every ripe thing in it, in one cast.
   *
   * The division spell's, and the only patch action that is not the times
   * rune's. It is here rather than in a list of its own because from the
   * child's side this is the same gesture — mark out ground, and something
   * happens to all of it — and because `beginMarking` is where that gesture
   * lives.
   *
   * The parchment that opens is not the array's. Marking a rectangle is how
   * a patch is chosen; what is asked about it is the spell's own business,
   * and this one asks a share. See `castShareSpell`.
   */
  Pick: "pick",
} as const;

export type PatchAction = (typeof PatchAction)[keyof typeof PatchAction];
