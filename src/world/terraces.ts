// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { AreaPlacement } from "./anchors";
import { cornerLevelsFor, isRampTile } from "./cliffAtlas";
import type { WorldGrid } from "./grid";
import { isStraightStep, levelForTerrain, smoothLevels, stepOf } from "./levels";

/**
 * Giving the world its levels, and cutting the ways up.
 *
 * The slope runs down from a high corner through mountain, hills, wood,
 * meadow and sand to the sea, and that reads as a *gradient*. What makes it
 * read as **levels** is a step: the hills stand a step above the wood, and
 * the mountains a step above the hills, with a cliff along each seam.
 *
 * Two passes, and the order matters.
 *
 * **The levels come from the terrain**, then get smoothed so no neighbour is
 * more than one step away — the art has one cliff, a step of one, and a
 * two-level jump would have nothing to draw.
 *
 * **Then the ramps are cut**, by pulling strips of the upper level back down
 * to the lower one. That is what a ramp *is* here: not a different kind of
 * ground, but a place where the step does not happen. It needs no rule in
 * the movement code and no special tile in the collision — the two cells
 * either side of it are simply the same level, so walking between them is
 * allowed by the ordinary rule.
 *
 * Cutting them is not optional. Every level above the first would otherwise
 * be sealed, and nothing downstream could rescue it: the connectivity pass
 * carves *terrain*, and a step is not terrain.
 */

/**
 * How far apart the ways up are, and how wide, in tiles.
 *
 * Generous on purpose. This is a game with no map markers and a six-year-old
 * playing it, and a player who cannot find the way up concludes the
 * highlands are scenery.
 */
export const RAMP_PERIOD = 40;
export const RAMP_WIDTH = 8;
const RAMP_SEED_OFFSET = 8677;

/**
 * Whether a column falls in a gap left for a way up.
 *
 * One ramp per period, somewhere inside it — so the spacing is *guaranteed*
 * while the position still wanders. Thresholding a noise field was tried
 * first and the noise turned out to be skewed high enough that almost no
 * ramp was ever cut, which would have sealed the highlands. A rule that has
 * to hold is not a rule to leave to a distribution nobody has looked at.
 */
export function isRampLane(along: number, seed: number): boolean {
  const period = Math.floor(along / RAMP_PERIOD);
  const within = along - period * RAMP_PERIOD;
  let hash = (seed + RAMP_SEED_OFFSET) >>> 0;
  hash = Math.imul(hash ^ period, 0x0100_0193) >>> 0;
  const start = hash % (RAMP_PERIOD - RAMP_WIDTH + 1);
  return within >= start && within < start + RAMP_WIDTH;
}

function insideAnyBox(col: number, row: number, boxes: readonly AreaPlacement[]): boolean {
  return boxes.some(
    (b) => col >= b.col && col < b.col + b.width && row >= b.row && row < b.row + b.height,
  );
}

/**
 * The outermost ring of the world, where no way up may ever be cut.
 *
 * That ring stands a step above everything inside it, and the step is the
 * whole point of it: it is what stops a child walking to the edge of the
 * map. A ramp cut onto it is a flight of stairs up onto the boundary — and
 * cut *along* it, a promenade round the outside of the world.
 *
 * Checked here rather than left to the callers because both passes that mark
 * ramps have to obey it, and a rule half the code follows is a rule that
 * comes back.
 */
/**
 * Whether a cell is in the border no way up may be cut in.
 *
 * Exported because the connectivity pass marks ramps too, and it is allowed
 * to insist on a way through — including, left to itself, a way up onto the
 * boundary. One rule, two callers.
 */
export function nearTheRim(width: number, height: number, col: number, row: number): boolean {
  return (
    col <= RIM_KEEP_OUT - 1 ||
    row <= RIM_KEEP_OUT - 1 ||
    col >= width - RIM_KEEP_OUT ||
    row >= height - RIM_KEEP_OUT
  );
}

function onTheRim(grid: WorldGrid, col: number, row: number): boolean {
  return nearTheRim(grid.width, grid.height, col, row);
}

/**
 * Set every cell's level from its terrain, then flatten the big jumps.
 *
 * Reserved story areas are pinned to the lowest level they contain, so a
 * harbour or an observatory is never cut in half by a cliff running through
 * the middle of it.
 */
export function assignLevels(grid: WorldGrid, reservedBoxes: readonly AreaPlacement[]): void {
  const levels = new Uint8Array(grid.width * grid.height);
  for (let row = 0; row < grid.height; row++) {
    for (let col = 0; col < grid.width; col++) {
      levels[row * grid.width + col] = levelForTerrain(grid.getTerrain(col, row));
    }
  }
  for (const box of reservedBoxes) {
    let lowest = Number.POSITIVE_INFINITY;
    for (let row = box.row; row < box.row + box.height; row++) {
      for (let col = box.col; col < box.col + box.width; col++) {
        if (!grid.inBounds(col, row)) continue;
        lowest = Math.min(lowest, levels[row * grid.width + col] ?? 0);
      }
    }
    if (!Number.isFinite(lowest)) continue;
    for (let row = box.row; row < box.row + box.height; row++) {
      for (let col = box.col; col < box.col + box.width; col++) {
        if (!grid.inBounds(col, row)) continue;
        levels[row * grid.width + col] = lowest;
      }
    }
  }
  raiseRim(grid, levels);
  const smoothed = smoothLevels(levels, grid.width, grid.height);
  // Last word, after the smoothing rather than before it. See `sealRim`.
  sealRim(grid, smoothed);
  grid.setLevels(smoothed);
}

/**
 * The outermost ring, one step above the ground just inside it.
 *
 * This is what stops the player walking off the edge of the world, and it
 * replaces a wall of objects — first trees and boulders, then a standing
 * cliff sprite — that had to be placed, kept off the story areas, and
 * excused to the connectivity pass. A rim that is simply *higher* needs none
 * of that: the cliff draws itself out of the same tiles as every other step,
 * and the same movement rule that stops you climbing a cliff inland stops
 * you climbing out of the map.
 *
 * One step above whatever it borders, rather than a fixed height, so the
 * "no neighbour more than one step away" rule holds by construction — a rim
 * pinned to the top level would be a sheer drop wherever it met the coast,
 * and there is no art for that.
 */
const RIM_RISE = 2;

/**
 * How wide a border no way up may be cut in: the rim and the ring inside it.
 *
 * The rim alone is not enough, and the reason is a detail of the movement
 * rule: a step may be crossed if *either* of its two cells is a ramp. So a
 * ramp marked on the ground just inside the rim opens the rim, without a
 * single ramp ever being marked on the rim itself — which is exactly what
 * was happening, and exactly the sort of thing that only shows up when
 * somebody walks to the edge of the map and finds the stairs.
 */
const RIM_KEEP_OUT = 2;

function raiseRim(grid: WorldGrid, levels: Uint8Array): void {
  const at = (col: number, row: number) => levels[row * grid.width + col] ?? 0;
  // Two steps, not one, and then the smoothing pass takes it back down to
  // one wherever the ground beside it is lower.
  //
  // One was the first answer and it leaks: smoothing looks at all eight
  // neighbours, so a rim cell one above its own inside neighbour can still
  // be two above the cell diagonally in from it — and gets lowered to match,
  // which lands it *level* with the ground inside. Level means walkable, and
  // a walkable rim is a child standing on the edge of the world.
  //
  // Starting two above leaves smoothing somewhere to come down to.
  for (let col = 0; col < grid.width; col++) {
    levels[col] = at(col, 1) + RIM_RISE;
    levels[(grid.height - 1) * grid.width + col] = at(col, grid.height - 2) + RIM_RISE;
  }
  for (let row = 0; row < grid.height; row++) {
    levels[row * grid.width] = at(1, row) + RIM_RISE;
    levels[row * grid.width + grid.width - 1] = at(grid.width - 2, row) + RIM_RISE;
  }
}

/**
 * The last word on the rim: it must stand above the ground inside it.
 *
 * `raiseRim` puts it there and the smoothing pass takes it back down again —
 * not out of malice but because smoothing looks at all eight neighbours, and
 * a rim cell one above its own inside neighbour is often two above the cell
 * diagonally in from it. Lowered to match that one, it lands *level* with
 * the ground it is supposed to be a wall against. Level means walkable, and
 * a walkable rim is a child standing on the edge of the world.
 *
 * Raising it by two first was tried and leaks for the same reason, one step
 * further along. So this runs afterwards, repairs only the cells that
 * actually leaked, and puts each of them one above the highest ground it
 * borders.
 *
 * **It can leave a two-step along the rim**, where a repaired cell meets an
 * unrepaired one, and a two-step inside a tile's own 2x2 of corners has no
 * frame in the cliff atlas — so a handful of tiles on the boundary draw
 * plain ground where a cliff belongs. That is the trade, taken deliberately:
 * a seam a player can only see by standing at the edge of the map, against a
 * way out of the map. Measured at four to twelve cells per world before this
 * and none after.
 */
function sealRim(grid: WorldGrid, levels: Uint8Array): void {
  const at = (col: number, row: number) => levels[row * grid.width + col] ?? 0;
  const set = (col: number, row: number, value: number) => {
    levels[row * grid.width + col] = value;
  };
  const repair = (col: number, row: number, inside: readonly (readonly [number, number])[]) => {
    let highest = -1;
    for (const [c, r] of inside) {
      if (c < 0 || r < 0 || c >= grid.width || r >= grid.height) continue;
      highest = Math.max(highest, at(c, r));
    }
    if (highest >= 0 && at(col, row) <= highest) set(col, row, highest + 1);
  };
  for (let col = 0; col < grid.width; col++) {
    repair(col, 0, [[col, 1]]);
    repair(col, grid.height - 1, [[col, grid.height - 2]]);
  }
  for (let row = 0; row < grid.height; row++) {
    repair(0, row, [[1, row]]);
    repair(grid.width - 1, row, [[grid.width - 2, row]]);
  }
}

/**
 * Cut the ways up: lanes where a step may be crossed.
 *
 * A ramp is marked, not dug. The first attempt lowered a lane of the upper
 * level down to meet the lower one, on the reasoning that two cells at the
 * same level are walkable between — and that does not work, because lowering
 * a cell moves the step rather than removing it. The lane became a trench
 * you could walk into and not out of. See `canStepBetween`.
 *
 * So this marks every cell in a lane that stands next to a step. Marked on
 * *both* sides, because a ramp is a slope and a slope has a top and a
 * bottom; marking only the upper side would leave the tile below it drawing
 * a cliff across the foot of its own ramp.
 *
 * Lanes run on both axes, because a step runs whichever way the contour
 * does, and a ramp only helps where it crosses one. The two patterns are
 * seeded apart, so the ways up a north-south cliff are not in the same
 * places as the ways up an east-west one.
 */
export function cutRamps(
  grid: WorldGrid,
  reservedBoxes: readonly AreaPlacement[],
  seed: number,
): number {
  let cut = 0;
  const mark = (col: number, row: number): void => {
    if (!grid.inBounds(col, row)) return;
    if (onTheRim(grid, col, row)) return;
    if (insideAnyBox(col, row, reservedBoxes)) return;
    const here = grid.getLevel(col, row);
    for (const [dCol, dRow] of NEIGHBOURS) {
      const c = col + dCol;
      const r = row + dRow;
      if (!grid.inBounds(c, r)) continue;
      if (onTheRim(grid, c, r)) continue;
      if (grid.getLevel(c, r) === here) continue;
      // Both sides: a slope has a top and a bottom, and marking only one
      // would leave the other drawing a cliff across the foot of its own
      // ramp.
      if (!grid.isRamp(col, row)) {
        grid.setRamp(col, row, true);
        cut++;
      }
      if (!insideAnyBox(c, r, reservedBoxes) && !grid.isRamp(c, r)) {
        grid.setRamp(c, r, true);
        cut++;
      }
    }
  };

  for (let row = 0; row < grid.height; row++) {
    if (!isRampLane(row, seed)) continue;
    for (let col = 0; col < grid.width; col++) mark(col, row);
  }
  for (let col = 0; col < grid.width; col++) {
    if (!isRampLane(col, seed + 977)) continue;
    for (let row = 0; row < grid.height; row++) mark(col, row);
  }
  return cut;
}

/**
 * How far a way up may be widened to find an edge the art can draw.
 *
 * Bounded because the contour is noisy and a long run of corner tiles could
 * in principle keep pushing the edge outward. Generous, because the cost of
 * stopping early is the blemish coming back and the cost of another round
 * is one sweep that marks nothing: measured worlds settle in two or three,
 * and the worst seed in a sweep of eight wanted seven.
 */
const SEAL_ROUNDS = 16;

/**
 * Widen each way up until its edges land where the taper can be drawn.
 *
 * A ramp tile fades its rock out towards the middle of the gap, and that
 * taper only exists for a step running straight across the tile: the ends it
 * fades from have to lie *along* the border. Where the contour happens to
 * turn a corner at the very edge of a lane, the tile there has no ramp frame
 * and is drawn as open ground — with the full, un-tapered cliff standing
 * right beside it. The rock stops dead in mid-air, which is the exact
 * complaint the taper was written to answer.
 *
 * The fix is not more art. It is to move the edge: mark the neighbouring
 * step tile as part of the way up too, and look again. Sooner or later the
 * edge lands on a straight run — most of any contour is straight — and that
 * tile draws the taper. The cost is a way up a tile or two wider than the
 * lane asked for, which nobody can see and nothing depends on.
 *
 * Reserved story areas are left alone, so this can no more open a cliff
 * through the middle of the harbour than `cutRamps` can.
 */
export function sealRampEdges(
  grid: WorldGrid,
  reservedBoxes: readonly AreaPlacement[],
  rounds = SEAL_ROUNDS,
): number {
  let widened = 0;
  for (let round = 0; round < rounds; round++) {
    // Collected first and marked after, so the answer does not depend on
    // which way the sweep happens to run.
    const open: number[] = [];
    for (let row = 0; row < grid.height - 1; row++) {
      for (let col = 0; col < grid.width - 1; col++) {
        if (!isBareRampTile(grid, col, row)) continue;
        for (const [dCol, dRow] of NEIGHBOURS) {
          const c = col + dCol;
          const r = row + dRow;
          if (c < 0 || r < 0 || c >= grid.width - 1 || r >= grid.height - 1) continue;
          if (!stepOf(cornerLevelsFor(grid, c, r))) continue;
          if (isRampTile(grid, c, r)) continue;
          open.push(c, r);
        }
      }
    }
    let marked = 0;
    for (let i = 0; i < open.length; i += 2) {
      marked += openStepTile(grid, open[i] as number, open[i + 1] as number, reservedBoxes);
    }
    // A round that marks nothing is the fixpoint. Testing what was *marked*
    // rather than what was found matters: a tile whose only rocky neighbour
    // lies inside a reserved area is found every round and can never be
    // opened, and testing the find would spin until the budget ran out.
    if (marked === 0) return widened;
    widened += marked;
  }
  return widened;
}

/** A tile inside a way up whose step turns a corner: no frame, open ground. */
function isBareRampTile(grid: WorldGrid, col: number, row: number): boolean {
  const step = stepOf(cornerLevelsFor(grid, col, row));
  if (!step || isStraightStep(step.mask)) return false;
  return isRampTile(grid, col, row);
}

/**
 * Mark all four cells a tile is drawn from, so the tile becomes part of the
 * way up. All four, because the point of a ramp is a permission on both
 * sides of the step, and a tile with a step in it has cells on both.
 */
function openStepTile(
  grid: WorldGrid,
  col: number,
  row: number,
  reservedBoxes: readonly AreaPlacement[],
): number {
  let cut = 0;
  for (const [c, r] of [
    [col, row],
    [col + 1, row],
    [col + 1, row + 1],
    [col, row + 1],
  ] as const) {
    if (!grid.inBounds(c, r)) continue;
    if (onTheRim(grid, c, r)) continue;
    if (insideAnyBox(c, r, reservedBoxes)) continue;
    if (grid.isRamp(c, r)) continue;
    grid.setRamp(c, r, true);
    cut++;
  }
  return cut;
}

const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
