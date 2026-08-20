// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { bandFloor } from "./elevation";
import { type Rng, randInt } from "./rng";
import { TerrainType } from "./terrain";
import { VILLAGE_SIZE } from "./villageLayout";

// Reserved bounding boxes for the 4 anchors whose interiors aren't built
// yet (Harbour, Big City, Observatory, Enchanted Forest — steps 7-8 of
// docs/WORLD_GENERATION.md). Tiles inside those stay at the grid's default
// terrain (passable Grass) so connectivity checks have something real to
// reach. The Village is sized separately (see VILLAGE_SIZE in
// villageLayout.ts) since its interior *is* built — a fixed 24 doesn't
// comfortably fit the square, 7 buildings, and gardens.
const ANCHOR_SIZE = 24;

/**
 * The two places that need more room than the default, and why.
 *
 * The comment above is now half out of date: the harbour and the big city
 * have interiors, and both are settlements. A city laid out on a grid of
 * streets needs enough width for more than two blocks each way — at 24 it
 * came out four blocks and three buildings, which is a hamlet with paving —
 * and the harbour has to fit a working front, the town behind it, and
 * enough sea in front for a pier to reach into.
 *
 * Sized here rather than inside each layout because it is placement that has
 * to know: a box is reserved from the terrain fill and checked against its
 * neighbours long before anything is built in it.
 */
const ANCHOR_SIZES: Readonly<Record<string, number>> = {
  "big-city": 36,
  harbour: 30,
};
const PADDING = 3;
const MAX_ATTEMPTS = 500;
const NEAR_DISTANCE = 40;

export interface AreaPlacement {
  id: string;
  col: number;
  row: number;
  width: number;
  height: number;
}

export interface AnchorPlacements {
  village: AreaPlacement;
  harbour: AreaPlacement;
  bigCity: AreaPlacement;
  observatory: AreaPlacement;
  enchantedForest: AreaPlacement;
}

interface AnchorSpec {
  id: string;
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function overlaps(a: AreaPlacement, b: AreaPlacement, padding: number): boolean {
  return !(
    a.col + a.width + padding <= b.col ||
    b.col + b.width + padding <= a.col ||
    a.row + a.height + padding <= b.row ||
    b.row + b.height + padding <= a.row
  );
}

function overlapsAny(candidate: AreaPlacement, placed: readonly AreaPlacement[]): boolean {
  return placed.some((p) => overlaps(candidate, p, PADDING));
}

function placeVillage(worldWidth: number, worldHeight: number, spec: AnchorSpec): AreaPlacement {
  return {
    id: spec.id,
    col: Math.floor((worldWidth - spec.width) / 2),
    row: Math.floor((worldHeight - spec.height) / 2),
    width: spec.width,
    height: spec.height,
  };
}

/**
 * Where each story area sits, given the slope the world is built on.
 *
 * Anchors are placed against *elevation* rather than against terrain that
 * has been painted yet, so this runs before the fill and needs nothing on
 * the grid. Each one asks for the band it belongs in — the observatory up in
 * the rock, the harbour down on the shore, the forest in the trees — which
 * is what makes a world legible: you can guess where to look for a place you
 * have not found.
 */
type ElevationAt = (col: number, row: number) => number;

function boxElevation(box: AreaPlacement, elevation: ElevationAt): number {
  // The centre alone is a poor test for a 24-tile box on a slope; sampling
  // the centre and the four corners rejects boxes that straddle a band edge.
  const right = box.col + box.width - 1;
  const bottom = box.row + box.height - 1;
  const midCol = box.col + Math.floor(box.width / 2);
  const midRow = box.row + Math.floor(box.height / 2);
  const samples = [
    elevation(midCol, midRow),
    elevation(box.col, box.row),
    elevation(right, box.row),
    elevation(box.col, bottom),
    elevation(right, bottom),
  ];
  return samples.reduce((sum, v) => sum + v, 0) / samples.length;
}

function placeInBand(
  worldWidth: number,
  worldHeight: number,
  spec: AnchorSpec,
  elevation: ElevationAt,
  floor: number,
  ceiling: number,
  placed: readonly AreaPlacement[],
  rng: Rng,
): AreaPlacement {
  let best: AreaPlacement | null = null;
  let bestMiss = Number.POSITIVE_INFINITY;
  const target = (floor + ceiling) / 2;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const box: AreaPlacement = {
      id: spec.id,
      col: randInt(rng, 0, worldWidth - spec.width),
      row: randInt(rng, 0, worldHeight - spec.height),
      width: spec.width,
      height: spec.height,
    };
    if (overlapsAny(box, placed)) continue;
    const height = boxElevation(box, elevation);
    if (height >= floor && height <= ceiling) return box;
    // Remember the near miss: a band can be small enough that random
    // sampling never lands squarely in it, and a story area slightly out of
    // its band beats throwing.
    const miss = Math.abs(height - target);
    if (miss < bestMiss) {
      bestMiss = miss;
      best = box;
    }
  }
  if (best) return best;
  throw new Error(`Could not place "${spec.id}" anywhere without overlapping`);
}

/**
 * How much of a harbour box has to be sea, and how much has to be land.
 *
 * A harbour with no water in it is not a harbour, and that is what the world
 * was making: placement asked only that the box's *mean* elevation sit in
 * the sand-to-grass band, which a box entirely above the waterline satisfies
 * comfortably. Most seeds put the docks in a field.
 *
 * The band test cannot see this because a mean says nothing about a spread.
 * So the harbour is placed by what its box *contains* instead — sea on one
 * side, dry ground on the other, and enough of each to be worth building on.
 * The lower bound is the sea to moor in; the upper is the ground to stand
 * the town on.
 */
const HARBOUR_SEA_LEAST = 0.2;
const HARBOUR_SEA_MOST = 0.55;
/**
 * How much of the box's sea has to lie in its southern half.
 *
 * The world rises to the north-west and falls to the south-east, so a
 * straddling box can find its water on its eastern side as easily as its
 * southern. Both are coasts; only one of them is the coast this game is
 * built around.
 *
 * **The harbour's water is south of its town** because everything that
 * happens there assumes it. Every door in the game is in the south wall, so
 * a quay laid along an eastern shore puts the warehouses' fronts facing the
 * sea and their backs to the town; the great ship moors with her entry port
 * pointing out to open water; and a child who has learned that the harbour
 * is *down* the map has learned something that holds in the next world too.
 */
const HARBOUR_SEA_SOUTH = 0.7;
/** How finely a box is sampled when asking how much of it is under water. */
const SHORE_SAMPLES = 8;

interface Shoreline {
  /** How much of the box is under water. */
  readonly sea: number;
  /** How much of that water lies in the box's southern half. */
  readonly southward: number;
}

function shorelineOf(box: AreaPlacement, elevation: ElevationAt): Shoreline {
  const waterline = bandFloor(TerrainType.Sand);
  let wet = 0;
  let south = 0;
  let cells = 0;
  for (let y = 0; y < SHORE_SAMPLES; y++) {
    for (let x = 0; x < SHORE_SAMPLES; x++) {
      const col = box.col + Math.floor(((x + 0.5) * box.width) / SHORE_SAMPLES);
      const row = box.row + Math.floor(((y + 0.5) * box.height) / SHORE_SAMPLES);
      if (elevation(col, row) < waterline) {
        wet++;
        if (y >= SHORE_SAMPLES / 2) south++;
      }
      cells++;
    }
  }
  return { sea: cells === 0 ? 0 : wet / cells, southward: wet === 0 ? 0 : south / wet };
}

/**
 * A box with the waterline running through it.
 *
 * Scored rather than accepted or rejected outright, and for the reason
 * `placeInBand` keeps its near miss: a world whose coast is all cliff may
 * have no box that lands squarely in the window, and a harbour slightly too
 * wet beats an exception thrown at world generation.
 */
function placeOnTheShore(
  worldWidth: number,
  worldHeight: number,
  spec: AnchorSpec,
  elevation: ElevationAt,
  placed: readonly AreaPlacement[],
  rng: Rng,
): AreaPlacement {
  const target = (HARBOUR_SEA_LEAST + HARBOUR_SEA_MOST) / 2;
  let best: AreaPlacement | null = null;
  let bestMiss = Number.POSITIVE_INFINITY;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const box: AreaPlacement = {
      id: spec.id,
      col: randInt(rng, 0, worldWidth - spec.width),
      row: randInt(rng, 0, worldHeight - spec.height),
      width: spec.width,
      height: spec.height,
    };
    if (overlapsAny(box, placed)) continue;
    const { sea, southward } = shorelineOf(box, elevation);
    const enough = sea >= HARBOUR_SEA_LEAST && sea <= HARBOUR_SEA_MOST;
    if (enough && southward >= HARBOUR_SEA_SOUTH) return box;
    // The near miss is scored on the water first and the *side* it is on
    // second, so a box that is wet enough but wet on the wrong side loses to
    // one that is slightly too dry and facing the right way.
    const miss = Math.abs(sea - target) + (1 - southward);
    if (miss < bestMiss) {
      bestMiss = miss;
      best = box;
    }
  }
  if (best) return best;
  throw new Error(`Could not place "${spec.id}" anywhere without overlapping`);
}

/**
 * Near another area, and on ground it can actually stand on.
 *
 * The band matters as much as the distance. Placed on proximity alone, the
 * Big City came out half underwater — it is put near the Harbour, and the
 * Harbour is on the shore, so "near the Harbour" includes the sea.
 */
function placeNear(
  worldWidth: number,
  worldHeight: number,
  spec: AnchorSpec,
  anchor: AreaPlacement,
  elevation: ElevationAt,
  floor: number,
  ceiling: number,
  placed: readonly AreaPlacement[],
  rng: Rng,
): AreaPlacement {
  let fallback: AreaPlacement | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const col = clamp(
      anchor.col + randInt(rng, -NEAR_DISTANCE, NEAR_DISTANCE),
      0,
      worldWidth - spec.width,
    );
    const row = clamp(
      anchor.row + randInt(rng, -NEAR_DISTANCE, NEAR_DISTANCE),
      0,
      worldHeight - spec.height,
    );
    const box: AreaPlacement = { id: spec.id, col, row, width: spec.width, height: spec.height };
    if (overlapsAny(box, placed)) continue;
    fallback ??= box;
    const height = boxElevation(box, elevation);
    if (height >= floor && height <= ceiling) return box;
  }
  // Somewhere near beats nowhere: proximity is the point of this placement,
  // and the clearing pass still makes the middle of it habitable.
  if (fallback) return fallback;
  throw new Error(
    `Could not place "${spec.id}" near "${anchor.id}" after ${MAX_ATTEMPTS} attempts`,
  );
}

// Placement order is load-bearing: each later anchor can be constrained
// relative to an earlier one (Big City needs Harbour's placement), never the
// reverse. See docs/WORLD_GENERATION.md's "Anchor areas" table.
export function placeAnchors(
  worldWidth: number,
  worldHeight: number,
  elevation: ElevationAt,
  rng: Rng,
): AnchorPlacements {
  const placed: AreaPlacement[] = [];
  // Capped against the world it is being placed in. The sizes above are
  // chosen for the 500-cell world the game actually generates; the tests
  // sweep 120- and 150-cell ones to stay fast, and a 36-wide city in a
  // 120-wide world alongside a 48-wide village leaves `placeNear` nothing it
  // can fit — which it reported by throwing, at world generation, in a test
  // that had nothing to do with cities.
  const room = Math.floor(Math.min(worldWidth, worldHeight) / 6);
  const spec = (id: string): AnchorSpec => {
    const size = Math.min(ANCHOR_SIZES[id] ?? ANCHOR_SIZE, Math.max(ANCHOR_SIZE, room));
    return { id, width: size, height: size };
  };

  const village = placeVillage(worldWidth, worldHeight, {
    id: "village",
    width: VILLAGE_SIZE,
    height: VILLAGE_SIZE,
  });
  placed.push(village);

  // Up in the rock, which is where an observatory wants to be and is also
  // the one band whose location the player can always find: it is the high
  // corner.
  const observatory = placeInBand(
    worldWidth,
    worldHeight,
    spec("observatory"),
    elevation,
    bandFloor(TerrainType.Mountain),
    1,
    placed,
    rng,
  );
  placed.push(observatory);

  // Straddling the waterline rather than merely near it: see
  // `placeOnTheShore`. Asking for the sand-to-grass band put most harbours
  // in a field, because a box entirely above the waterline has a mean
  // elevation squarely inside that band.
  const harbour = placeOnTheShore(worldWidth, worldHeight, spec("harbour"), elevation, placed, rng);
  placed.push(harbour);

  // Near the Harbour, but up out of the water: a city on the coastal plain
  // rather than in the shallows beside the docks.
  const bigCity = placeNear(
    worldWidth,
    worldHeight,
    spec("big-city"),
    harbour,
    elevation,
    bandFloor(TerrainType.Grass),
    bandFloor(TerrainType.Woodland),
    placed,
    rng,
  );
  placed.push(bigCity);

  const enchantedForest = placeInBand(
    worldWidth,
    worldHeight,
    spec("enchanted-forest"),
    elevation,
    bandFloor(TerrainType.Woodland),
    bandFloor(TerrainType.Hilly),
    placed,
    rng,
  );
  placed.push(enchantedForest);

  return { village, harbour, bigCity, observatory, enchantedForest };
}
