// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { WorldGrid } from "./grid";
import { Habitat } from "./habitat";
import type { GridPoint } from "./iso";
import { type Rng, chance, randInt } from "./rng";
import { TerrainType } from "./terrain";

// Perimeter arc lengths, in tiles. Small enough that a 500-tile edge gets
// several stretches of each habitat, large enough that arcs read as
// coherent coastline/mountain stretches rather than static.
const MIN_ARC_LENGTH = 20;
const MAX_ARC_LENGTH = 80;

// Walks the outermost ring once, clockwise from the top-left corner, with
// no duplicated corner tiles.
export function perimeterTiles(width: number, height: number): GridPoint[] {
  if (width <= 0 || height <= 0) return [];
  if (width === 1 && height === 1) return [{ col: 0, row: 0 }];

  const tiles: GridPoint[] = [];
  for (let col = 0; col < width; col++) tiles.push({ col, row: 0 });
  for (let row = 1; row < height; row++) tiles.push({ col: width - 1, row });
  if (height > 1) {
    for (let col = width - 2; col >= 0; col--) tiles.push({ col, row: height - 1 });
  }
  for (let row = height - 2; row >= 1; row--) tiles.push({ col: 0, row });

  // De-dupe: a width-1 or height-1 strip revisits tiles via the loops
  // above (e.g. a 1-wide world has no distinct left/right edges).
  const seen = new Set<string>();
  return tiles.filter((t) => {
    const key = `${t.col},${t.row}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const BORDER_HABITAT_TERRAIN: Record<
  typeof Habitat.Coastal | typeof Habitat.Highland,
  TerrainType
> = {
  [Habitat.Coastal]: TerrainType.Water,
  [Habitat.Highland]: TerrainType.Rock,
};

// Forces the outermost ring to a hard, impassable, mixed coastal/mountain
// border — arcs of random length, each Coastal (water) or Highland (rock).
// Directly setting terrain here (not sampling from habitat weights) is
// deliberate: the border must always be impassable, never probabilistic.
export function generateBorder(grid: WorldGrid, rng: Rng): void {
  const tiles = perimeterTiles(grid.width, grid.height);
  let i = 0;
  while (i < tiles.length) {
    const arcLength = randInt(rng, MIN_ARC_LENGTH, MAX_ARC_LENGTH);
    const habitat = chance(rng, 0.5) ? Habitat.Coastal : Habitat.Highland;
    const terrain = BORDER_HABITAT_TERRAIN[habitat];
    for (let j = 0; j < arcLength && i < tiles.length; j++, i++) {
      const tile = tiles[i];
      if (!tile) continue;
      grid.setTerrain(tile.col, tile.row, terrain);
      grid.setHabitat(tile.col, tile.row, habitat);
    }
  }
}
