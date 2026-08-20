// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { WorldGrid } from "./grid";
import { type CornerLevels, isStraightStep, stepOf } from "./levels";
import type { TerrainType } from "./terrain";
import { type CornerTerrains, variationFor } from "./terrainAtlas";

/**
 * Drawing the steps between the world's levels.
 *
 * A second atlas beside the terrain's, and separate for the same reason the
 * generator keeps them apart: a cliff is not a terrain, it is a *step*
 * between two of them, and which pair it sits between is independent of
 * which pair meets at a tile's corners. Folding these into the terrain atlas
 * would multiply that atlas by every rock and every ramp for the benefit of
 * the few tiles that have a step in them.
 *
 * The lookup is the same shape as the terrain's: read the tile's four
 * corners, join them into a frame name, draw that frame. What is read is the
 * *level* at each corner rather than the terrain, and the name carries the
 * terrain above the step, the terrain below it, which corners are on top,
 * and which rock.
 */

export const CLIFF_ATLAS_KEY = "cliffs";

/**
 * Which rock a step is drawn in.
 *
 * Grey where there is rock about — anything at or above the hills — and
 * brown lower down, where a grey face would read as somebody having built a
 * wall in a meadow rather than as the ground stepping up.
 */
export type RockKind = "grey" | "brown";

const STONE_FROM_LEVEL = 1;

export function rockFor(upperLevel: number): RockKind {
  return upperLevel >= STONE_FROM_LEVEL ? "grey" : "brown";
}

/** The four corner levels of the dual tile at (col, row), clamped at the edge. */
export function cornerLevelsFor(grid: WorldGrid, col: number, row: number): CornerLevels {
  const west = Math.min(Math.max(col, 0), grid.width - 1);
  const east = Math.min(Math.max(col + 1, 0), grid.width - 1);
  const north = Math.min(Math.max(row, 0), grid.height - 1);
  const south = Math.min(Math.max(row + 1, 0), grid.height - 1);
  return [
    grid.getLevel(west, north),
    grid.getLevel(east, north),
    grid.getLevel(east, south),
    grid.getLevel(west, south),
  ];
}

/**
 * Whether this tile's step is one somebody may walk up.
 *
 * True when any corner of it is a ramp. A ramp is marked on both sides of
 * the step it cuts, so a tile straddling one has at least one ramp corner
 * whichever side of the seam it sits on — which is what makes the gap in the
 * rock line up with the gap in the rule.
 */
export function isRampTile(grid: WorldGrid, col: number, row: number): boolean {
  const west = Math.min(Math.max(col, 0), grid.width - 1);
  const east = Math.min(Math.max(col + 1, 0), grid.width - 1);
  const north = Math.min(Math.max(row, 0), grid.height - 1);
  const south = Math.min(Math.max(row + 1, 0), grid.height - 1);
  return (
    grid.isRamp(west, north) ||
    grid.isRamp(east, north) ||
    grid.isRamp(east, south) ||
    grid.isRamp(west, south)
  );
}

/**
 * Which ends of a ramp tile taper up to meet the cliff.
 *
 * A ramp wider than one tile is several of these in a row, and if each kept
 * full depth at every edge they would leave rock standing in the middle of
 * their shared seam — a post in the doorway. So a tile tapers only on the
 * sides where the ramp *ends*, which is where its neighbour along the step
 * is not itself a ramp.
 *
 * Which neighbours to look at depends on which way the step runs. A cliff
 * along an east-west border is crossed by walking north, so its gap is a
 * span of columns and its ends are east and west; a north-south border is
 * the same thing turned ninety degrees, and asking about the wrong pair
 * would cut a hole across the ramp rather than a way through it.
 */
export function rampSides(
  grid: WorldGrid,
  col: number,
  row: number,
  mask: readonly boolean[],
): string {
  // The border runs east-west when the two upper corners are both northern
  // or both southern — nw+ne or se+sw.
  const eastWest = mask[0] === mask[1] && mask[2] === mask[3];
  const before = eastWest ? isRampTile(grid, col - 1, row) : isRampTile(grid, col, row - 1);
  const after = eastWest ? isRampTile(grid, col + 1, row) : isRampTile(grid, col, row + 1);
  if (!before && !after) return eastWest ? "ew" : "ns";
  if (!before) return eastWest ? "w" : "n";
  if (!after) return eastWest ? "e" : "s";
  return "none";
}

export function cliffComboKey(
  upper: TerrainType,
  lower: TerrainType,
  mask: readonly boolean[],
  rock: RockKind,
  sides: string,
): string {
  const kind = sides === "full" ? "cliff" : "ramp";
  const bits = mask.map((on) => (on ? "1" : "0")).join("");
  return `${kind}_${upper}_${lower}_${bits}_${rock}_${sides}`;
}

/**
 * The cliff or ramp frame for one dual tile, or null if it has no step.
 *
 * Null is the common answer — most tiles are flat ground — so this is meant
 * to be asked before the terrain frame and to get out of the way cheaply.
 */
export function cliffFrameFor(
  grid: WorldGrid,
  corners: CornerTerrains,
  levels: CornerLevels,
  col: number,
  row: number,
  variations: ReadonlyMap<string, number>,
): string | null {
  const step = stepOf(levels);
  if (!step) return null;
  // The terrain above the step and the terrain below it, taken from corners
  // that are actually on each side — a cliff between wood and hills has to
  // be told which is which, and the mask is what knows.
  const upperAt = step.mask.indexOf(true);
  const lowerAt = step.mask.indexOf(false);
  const upper = corners[upperAt] as TerrainType;
  const lower = corners[lowerAt] as TerrainType;
  // Only a straight run can be a ramp — see `isStraightStep`. A tile inside
  // a way up whose step turns a corner has no ramp frame to draw and must
  // *not* fall back to the full cliff, which would stand rock in the middle
  // of the gap; null sends it to the ordinary terrain frame, which is open
  // ground — exactly what a ramp with all its rock tapered away would be.
  // `sealRampEdges` is what keeps such a tile from ever landing at the edge
  // of a way up, where the rock beside it would stop dead.
  const onRamp = isRampTile(grid, col, row);
  if (onRamp && !isStraightStep(step.mask)) return null;
  const sides = onRamp ? rampSides(grid, col, row, step.mask) : "full";
  const combo = cliffComboKey(upper, lower, step.mask, rockFor(step.upper), sides);
  const count = variations.get(combo);
  if (count === undefined || count <= 0) return null;
  return `${combo}_${variationFor(col, row, count)}`;
}
