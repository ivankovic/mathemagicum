// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { TerrainType } from "./terrain";

/**
 * How high off the ground a cell is, as a whole number of steps.
 *
 * This is what a cliff is drawn from, and it is stored rather than derived
 * from terrain for one reason that the art made obvious: two patches of the
 * same terrain can be at different heights. A step up in a meadow is grass
 * above and grass below, and nothing about the terrain distinguishes them.
 * The generator ships a grass-grass cliff precisely so that case is
 * drawable, and it is only drawable if the height is a fact of its own.
 *
 * It is also what makes a ramp possible. A ramp is not a different kind of
 * ground — it is a place where the level does *not* step, cut through a run
 * where it otherwise would.
 *
 * **Levels never differ by more than one between neighbours.** A tile is
 * drawn from the levels at its four corners, and the art has one cliff: a
 * step of one. A two-level jump would have nothing to draw and would read as
 * the ground teleporting. `smoothLevels` is what enforces it.
 */

/**
 * The level a terrain sits at before anything is carved through it.
 *
 * The two steps the design asks for — wood to hills and hills to mountain —
 * and nothing lower down. Sand gives way to meadow and meadow to wood by
 * *growing different things*, which is how those read in the world; a step
 * there would be a wall across open ground for no visible reason.
 */
export const LEVEL_FOR_TERRAIN: Record<TerrainType, number> = {
  [TerrainType.Water]: 0,
  [TerrainType.Sand]: 0,
  [TerrainType.Dirt]: 0,
  [TerrainType.Grass]: 0,
  [TerrainType.Woodland]: 0,
  [TerrainType.Cobble]: 0,
  [TerrainType.Hilly]: 1,
  [TerrainType.Mountain]: 2,
};

export function levelForTerrain(terrain: TerrainType): number {
  return LEVEL_FOR_TERRAIN[terrain] ?? 0;
}

/** The four corner levels of a dual tile, in CORNERS order: nw, ne, se, sw. */
export type CornerLevels = readonly [number, number, number, number];

/**
 * Whether a tile has a step in it at all.
 *
 * Most do not, and the answer decides whether the tile is drawn from the
 * terrain atlas or the cliff one — so it is worth being the cheapest thing
 * in the renderer.
 */
export function hasStep(levels: CornerLevels): boolean {
  return levels[0] !== levels[1] || levels[0] !== levels[2] || levels[0] !== levels[3];
}

export interface Step {
  /** The higher level, and the lower one. Always one apart. */
  readonly upper: number;
  readonly lower: number;
  /** Which corners are on the upper level, in CORNERS order. */
  readonly mask: readonly [boolean, boolean, boolean, boolean];
}

/**
 * The step in a tile, or null if it has none.
 *
 * Returns null rather than throwing when the corners hold three levels at
 * once. That should not happen — `smoothLevels` keeps neighbours within one
 * of each other — but a renderer that threw would take the whole screen down
 * over one tile, and drawing that tile as plain ground is a blemish nobody
 * will find.
 */
export function stepOf(levels: CornerLevels): Step | null {
  const distinct = [...new Set(levels)].sort((a, b) => a - b);
  if (distinct.length !== 2) return null;
  const [lower, upper] = distinct as [number, number];
  if (upper - lower !== 1) return null;
  return {
    upper,
    lower,
    mask: [levels[0] === upper, levels[1] === upper, levels[2] === upper, levels[3] === upper],
  };
}

/**
 * Whether a step runs straight across a tile rather than cutting a corner.
 *
 * Two of the four corners are upper and they are *adjacent*, so the border
 * enters one edge and leaves the opposite one: the step is a straight run
 * east-west or north-south. The other shapes — one corner upper, three
 * corners upper — turn inside the tile.
 *
 * Worth a name because it is the line between the two kinds of cliff tile
 * the atlas ships. Only a straight run can be a ramp: a ramp tapers from the
 * ends of the gap it cuts, and the ends have to lie along the border, which
 * is only well defined when the border has a direction. A corner tile in the
 * middle of a way up is simply open ground, and `sealRampEdges` is what
 * keeps one from ever landing at the *edge* of a way up, where it would
 * leave the rock stopping dead.
 */
export function isStraightStep(mask: readonly boolean[]): boolean {
  const eastWest = mask[0] === mask[1] && mask[2] === mask[3];
  const northSouth = mask[1] === mask[2] && mask[3] === mask[0];
  return (eastWest || northSouth) && mask[0] !== mask[2];
}

/**
 * Flatten any jump bigger than one step, by pulling the high ground down.
 *
 * Repeated until nothing moves, because lowering one cell can leave it too
 * far above one of *its* other neighbours. Pulling down rather than pushing
 * up on purpose: raising ground would grow the highlands outward on every
 * pass and could swallow the village, while lowering only ever shaves the
 * peaks, and the peaks are where nothing lives.
 *
 * **Diagonals count here, though nothing walks along one.** A tile is drawn
 * from the four levels at its corners, and those corners are a 2x2 block of
 * cells — so its north-west and south-east corners are *diagonal* to each
 * other. Smoothing only the four cells you can walk to left blocks like
 *
 *     0 1
 *     1 2
 *
 * perfectly legal, and a tile spanning two steps is one `stepOf` cannot
 * name and the atlas has no frame for: it fell through to plain ground, a
 * hole in the cliff line. Taking all eight neighbours makes every 2x2 block
 * span at most one level, which is exactly the condition that every step
 * tile is drawable — an invariant worth having by construction rather than
 * by a renderer that copes.
 */
export function smoothLevels(
  levels: Uint8Array,
  width: number,
  height: number,
  maxPasses = 16,
): Uint8Array {
  const out = Uint8Array.from(levels);
  for (let pass = 0; pass < maxPasses; pass++) {
    let moved = false;
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const at = row * width + col;
        const here = out[at] ?? 0;
        let lowestNeighbour = here;
        for (const [dCol, dRow] of AROUND) {
          const c = col + dCol;
          const r = row + dRow;
          if (c < 0 || r < 0 || c >= width || r >= height) continue;
          lowestNeighbour = Math.min(lowestNeighbour, out[r * width + c] ?? 0);
        }
        if (here - lowestNeighbour > 1) {
          out[at] = lowestNeighbour + 1;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  return out;
}

/** The eight cells touching one, corners included. See `smoothLevels`. */
const AROUND: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
];

/**
 * Whether the ground allows a step from one cell to the next.
 *
 * You may walk anywhere on your own level, and you may not change level —
 * except on a ramp, which is exactly a place where you may.
 *
 * The ramp had to become a fact about a cell rather than a shape in the
 * level field, and finding out why is worth writing down. The first attempt
 * cut ramps by *lowering* the ground: pull a lane of the upper level down to
 * meet the lower one, and the two sides are then the same level, so the
 * ordinary rule lets you across. It does not work, and it cannot: lowering a
 * cell moves the step rather than removing it. Whatever you lower is now a
 * step below whatever you did not, so the lane is a trench you can walk into
 * and not out of. With a rule that forbids every level change, no
 * arrangement of levels is ever walkable between two of them.
 *
 * So a ramp is a permission. One cell of it, on either side of the step, is
 * enough to make that step crossable.
 */
export function canStepBetween(
  fromLevel: number,
  toLevel: number,
  fromRamp = false,
  toRamp = false,
): boolean {
  if (fromLevel === toLevel) return true;
  if (Math.abs(fromLevel - toLevel) !== 1) return false;
  return fromRamp || toRamp;
}
