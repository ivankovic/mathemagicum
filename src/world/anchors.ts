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

function placeNear(
  worldWidth: number,
  worldHeight: number,
  spec: AnchorSpec,
  anchor: AreaPlacement,
  placed: readonly AreaPlacement[],
  rng: Rng,
): AreaPlacement {
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
    return box;
  }
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
  const spec = (id: string): AnchorSpec => ({ id, width: ANCHOR_SIZE, height: ANCHOR_SIZE });

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

  // On the shore. The sand band is thin, so this asks for anything from the
  // waterline up to the bottom of the grass.
  const harbour = placeInBand(
    worldWidth,
    worldHeight,
    spec("harbour"),
    elevation,
    bandFloor(TerrainType.Sand),
    bandFloor(TerrainType.Grass),
    placed,
    rng,
  );
  placed.push(harbour);

  const bigCity = placeNear(worldWidth, worldHeight, spec("big-city"), harbour, placed, rng);
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
