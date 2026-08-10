// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { WorldGrid } from "./grid";
import { Habitat } from "./habitat";
import { type Rng, pick, randInt } from "./rng";
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

const SIDES = ["top", "bottom", "left", "right"] as const;
type Side = (typeof SIDES)[number];

function candidateBoxOnSide(
  side: Side,
  spec: AnchorSpec,
  worldWidth: number,
  worldHeight: number,
  rng: Rng,
): AreaPlacement | null {
  if (side === "top" || side === "bottom") {
    if (spec.width > worldWidth) return null;
    return {
      id: spec.id,
      col: randInt(rng, 0, worldWidth - spec.width),
      row: side === "top" ? 0 : worldHeight - spec.height,
      width: spec.width,
      height: spec.height,
    };
  }
  if (spec.height > worldHeight) return null;
  return {
    id: spec.id,
    col: side === "left" ? 0 : worldWidth - spec.width,
    row: randInt(rng, 0, worldHeight - spec.height),
    width: spec.width,
    height: spec.height,
  };
}

function edgeMatchesHabitat(
  grid: WorldGrid,
  side: Side,
  box: AreaPlacement,
  habitat: Habitat,
): boolean {
  if (side === "top" || side === "bottom") {
    const row = side === "top" ? 0 : grid.height - 1;
    for (let col = box.col; col < box.col + box.width; col++) {
      if (grid.getHabitat(col, row) !== habitat) return false;
    }
    return true;
  }
  const col = side === "left" ? 0 : grid.width - 1;
  for (let row = box.row; row < box.row + box.height; row++) {
    if (grid.getHabitat(col, row) !== habitat) return false;
  }
  return true;
}

// Placed flush against a world edge whose border habitat (from
// generateBorder) matches the given habitat along the whole touching span
// — e.g. Harbour needs a stretch of Coastal border, not just one tile.
function placeAgainstBorder(
  grid: WorldGrid,
  spec: AnchorSpec,
  requiredHabitat: typeof Habitat.Coastal | typeof Habitat.Highland,
  placed: readonly AreaPlacement[],
  rng: Rng,
): AreaPlacement {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const side = pick(rng, SIDES);
    const box = candidateBoxOnSide(side, spec, grid.width, grid.height, rng);
    if (!box) continue;
    if (overlapsAny(box, placed)) continue;
    if (!edgeMatchesHabitat(grid, side, box, requiredHabitat)) continue;
    return box;
  }
  throw new Error(
    `Could not place "${spec.id}" against a ${requiredHabitat} border after ${MAX_ATTEMPTS} attempts`,
  );
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

function placeWithSpacing(
  worldWidth: number,
  worldHeight: number,
  spec: AnchorSpec,
  placed: readonly AreaPlacement[],
  rng: Rng,
): AreaPlacement {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const box: AreaPlacement = {
      id: spec.id,
      col: randInt(rng, 0, worldWidth - spec.width),
      row: randInt(rng, 0, worldHeight - spec.height),
      width: spec.width,
      height: spec.height,
    };
    if (overlapsAny(box, placed)) continue;
    return box;
  }
  throw new Error(`Could not place "${spec.id}" after ${MAX_ATTEMPTS} attempts`);
}

// Placement order is load-bearing: each later anchor can be constrained
// relative to an earlier one (Harbour needs the border from generateBorder;
// Big City needs Harbour's placement), never the reverse. See
// docs/WORLD_GENERATION.md's "Anchor areas" table.
export function placeAnchors(grid: WorldGrid, rng: Rng): AnchorPlacements {
  const placed: AreaPlacement[] = [];
  const spec = (id: string): AnchorSpec => ({ id, width: ANCHOR_SIZE, height: ANCHOR_SIZE });

  const village = placeVillage(grid.width, grid.height, {
    id: "village",
    width: VILLAGE_SIZE,
    height: VILLAGE_SIZE,
  });
  placed.push(village);

  const harbour = placeAgainstBorder(grid, spec("harbour"), Habitat.Coastal, placed, rng);
  placed.push(harbour);

  const bigCity = placeNear(grid.width, grid.height, spec("big-city"), harbour, placed, rng);
  placed.push(bigCity);

  const observatory = placeAgainstBorder(grid, spec("observatory"), Habitat.Highland, placed, rng);
  placed.push(observatory);

  const enchantedForest = placeWithSpacing(
    grid.width,
    grid.height,
    spec("enchanted-forest"),
    placed,
    rng,
  );
  placed.push(enchantedForest);

  return { village, harbour, bigCity, observatory, enchantedForest };
}
