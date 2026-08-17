// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { Habitat } from "./habitat";
import { smoothNoise } from "./noise";
import type { Rng } from "./rng";
import { pick } from "./rng";
import { TerrainType } from "./terrain";

/**
 * The world as one slope running down from a single high corner.
 *
 * This replaced scattered habitat blobs, which produced a map with no shape
 * to it: patches of everything, everywhere, in no relation to each other. A
 * world the player can hold in their head needs somewhere to *be* — so one
 * randomly chosen corner is the top of a mountain, the ground falls away
 * from it through woodland and grass, and the two edges furthest from it are
 * open water.
 *
 * The consequence worth stating: every world has the same structure and only
 * its orientation and detail vary. That is the point. A player who has
 * learned that water is downhill and rock is uphill knows which way to walk
 * in a world they have never seen.
 */

export const HighCorner = {
  NorthWest: "north-west",
  NorthEast: "north-east",
  SouthWest: "south-west",
  SouthEast: "south-east",
} as const;

export type HighCorner = (typeof HighCorner)[keyof typeof HighCorner];

export const HIGH_CORNERS: readonly HighCorner[] = Object.values(HighCorner);

export function pickHighCorner(rng: Rng): HighCorner {
  return pick(rng, HIGH_CORNERS);
}

/** Which world edges the high corner touches — the ones that get walled. */
export function highEdges(corner: HighCorner): { top: boolean; left: boolean } {
  return {
    top: corner === HighCorner.NorthWest || corner === HighCorner.NorthEast,
    left: corner === HighCorner.NorthWest || corner === HighCorner.SouthWest,
  };
}

// How far the noise moves a tile up or down the slope. Large enough that the
// bands read as coastline and treeline rather than as contour lines on a
// diagram; small enough that the overall slope still reads.
const WARP = 0.3;
// Over what distance the warp varies, in tiles. Short enough to give a bay
// its shape, long enough not to fray the bands into noise.
const WARP_PERIOD = 46;

/**
 * Height at a tile: 1 at the high corner, 0 along both far edges.
 *
 * Chebyshev distance, not Euclidean, and that is load-bearing rather than an
 * approximation. `max` is exactly 1 along the *whole* of both far edges,
 * which is what puts water along all of them; a Euclidean or p-norm distance
 * reaches 1 only at their midpoints, and would leave the ends nearest the
 * high corner dry.
 */
export function elevationAt(
  col: number,
  row: number,
  width: number,
  height: number,
  corner: HighCorner,
  seed: number,
): number {
  const edges = highEdges(corner);
  const fx = width <= 1 ? 0 : (edges.left ? col : width - 1 - col) / (width - 1);
  const fy = height <= 1 ? 0 : (edges.top ? row : height - 1 - row) / (height - 1);
  const distance = Math.max(fx, fy);
  const warp = (smoothNoise(col, row, WARP_PERIOD, seed) - 0.5) * WARP;
  return Math.min(1, Math.max(0, 1 - distance + warp));
}

/**
 * The bands the slope is cut into, highest first.
 *
 * Hilly sits between mountain and woodland because the spec asks the
 * mountain to transition *slowly*; a rock face meeting a forest directly
 * reads as two regions abutting rather than one becoming the other.
 *
 * Dirt is deliberately absent. It is the game's material for paths and
 * gardens — things the village carves — so leaving it out of the natural
 * ground keeps "bare earth" meaning "somebody worked this".
 */
interface Band {
  readonly floor: number;
  readonly terrain: TerrainType;
  readonly habitat: Habitat;
}

// Chebyshev distance means the area below a height is quadratic in it: the
// fraction of the map above elevation e is (1 - e)^2. So these thresholds
// are not evenly spaced and cannot be read as shares — the grass band looks
// enormous and is about a third of the map, while mountain looks generous
// and is a twentieth. terrainFill.test.ts pins the resulting shares.
const BANDS: readonly Band[] = [
  { floor: 0.76, terrain: TerrainType.Mountain, habitat: Habitat.Highland },
  { floor: 0.62, terrain: TerrainType.Hilly, habitat: Habitat.Highland },
  { floor: 0.35, terrain: TerrainType.Woodland, habitat: Habitat.Woodland },
  { floor: 0.17, terrain: TerrainType.Grass, habitat: Habitat.Meadow },
  { floor: 0.09, terrain: TerrainType.Sand, habitat: Habitat.Coastal },
  { floor: 0, terrain: TerrainType.Water, habitat: Habitat.Coastal },
];

export function terrainForElevation(elevation: number): TerrainType {
  for (const band of BANDS) {
    if (elevation >= band.floor) return band.terrain;
  }
  return TerrainType.Water;
}

export function habitatForElevation(elevation: number): Habitat {
  for (const band of BANDS) {
    if (elevation >= band.floor) return band.habitat;
  }
  return Habitat.Coastal;
}

// Marshland sits across the seam where the meadow gives way to the trees:
// low enough to hold water, high enough that it is not simply the shore.
// The zone straddles the grass/woodland floor rather than sitting inside
// either, so a marsh reads as the boundary being wet rather than as a patch
// dropped into one band.
const WETLAND_LOW = 0.28;
const WETLAND_HIGH = 0.44;
// How much of that zone is actually marsh, and how much of the marsh is open
// water rather than boggy grass. Both are thresholds on a field of their
// own, so wetland comes in patches with ponds at their centres.
const WETLAND_THRESHOLD = 0.6;
const POND_THRESHOLD = 0.76;
const WETLAND_PERIOD = 37;
// Offset so the marsh field is independent of the one that warps the slope;
// sharing it would put every marsh in the same place on the hillside.
const WETLAND_SEED_OFFSET = 7717;

export interface Ground {
  terrain: TerrainType;
  habitat: Habitat;
}

/**
 * The ground at a tile, marsh included.
 *
 * Elevation alone cannot express wetland: a marsh is not a height, it is a
 * place where the ground at that height happens to hold water. So it is a
 * second field laid over the band — which is also why `terrainForElevation`
 * stays a pure function of height and this is the one callers should use.
 */
export function groundAt(col: number, row: number, elevation: number, seed: number): Ground {
  if (elevation >= WETLAND_LOW && elevation < WETLAND_HIGH) {
    const wetness = smoothNoise(col, row, WETLAND_PERIOD, seed + WETLAND_SEED_OFFSET);
    if (wetness >= WETLAND_THRESHOLD) {
      return {
        terrain: wetness >= POND_THRESHOLD ? TerrainType.Water : TerrainType.Grass,
        habitat: Habitat.Wetland,
      };
    }
  }
  return { terrain: terrainForElevation(elevation), habitat: habitatForElevation(elevation) };
}

/** The lowest elevation still counted as the given terrain's band. */
export function bandFloor(terrain: TerrainType): number {
  const band = BANDS.find((b) => b.terrain === terrain);
  if (!band) throw new Error(`no elevation band produces ${terrain}`);
  return band.floor;
}
