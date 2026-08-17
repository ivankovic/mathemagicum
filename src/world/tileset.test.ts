// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { WorldGrid } from "./grid";
import { TerrainType } from "./terrain";
import {
  DOWN,
  DRAWABLE_MASKS,
  FULL_MASK,
  LEFT,
  RIGHT,
  TILE_VARIANTS,
  UP,
  baseTerrainFor,
  cornerMaskFor,
  dualTileKey,
  terrainPriorityRank,
  tileVariantFor,
} from "./tileset";

describe("DRAWABLE_MASKS", () => {
  test("is every mask 1-15 — 0 (no corners) needs no PNG", () => {
    expect(DRAWABLE_MASKS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });
});

describe("dualTileKey", () => {
  test("includes both the mask and the variant, for every mask", () => {
    expect(dualTileKey(TerrainType.Sand, FULL_MASK, 2)).toBe("sand-dual-15-2");
    expect(dualTileKey(TerrainType.Sand, UP, 3)).toBe("sand-dual-1-3");
  });
});

describe("tileVariantFor", () => {
  test("is deterministic for a given (col, row)", () => {
    expect(tileVariantFor(12, 34)).toBe(tileVariantFor(12, 34));
  });

  test("always returns an in-range variant index", () => {
    for (let col = 0; col < 50; col++) {
      for (let row = 0; row < 50; row++) {
        const variant = tileVariantFor(col, row);
        expect(variant).toBeGreaterThanOrEqual(0);
        expect(variant).toBeLessThan(TILE_VARIANTS);
      }
    }
  });
});

describe("terrainPriorityRank", () => {
  test("matches TERRAIN_PRIORITY order: water lowest, grass highest", () => {
    expect(terrainPriorityRank(TerrainType.Water)).toBeLessThan(
      terrainPriorityRank(TerrainType.Rock),
    );
    expect(terrainPriorityRank(TerrainType.Rock)).toBeLessThan(
      terrainPriorityRank(TerrainType.Sand),
    );
    expect(terrainPriorityRank(TerrainType.Sand)).toBeLessThan(
      terrainPriorityRank(TerrainType.Dirt),
    );
    expect(terrainPriorityRank(TerrainType.Dirt)).toBeLessThan(
      terrainPriorityRank(TerrainType.Grass),
    );
  });
});

describe("cornerMaskFor", () => {
  function grid5x5(fill: TerrainType): WorldGrid {
    return WorldGrid.empty(5, 5, fill);
  }

  test("a dual tile whose 4 corner cells are all the given terrain has FULL_MASK", () => {
    const grid = grid5x5(TerrainType.Grass);
    // Dual tile (2, 2)'s corners are data cells (2,2) UP, (3,2) RIGHT,
    // (3,3) DOWN, (2,3) LEFT — see tileset.ts's module docstring.
    expect(cornerMaskFor(grid, 2, 2, TerrainType.Grass)).toBe(FULL_MASK);
  });

  test("a dual tile with no matching corners has mask 0", () => {
    const grid = grid5x5(TerrainType.Grass);
    expect(cornerMaskFor(grid, 2, 2, TerrainType.Dirt)).toBe(0);
  });

  test("each corner bit lines up with the documented UP/RIGHT/DOWN/LEFT data cell", () => {
    const grid = grid5x5(TerrainType.Grass);
    grid.setTerrain(3, 2, TerrainType.Dirt); // dual tile (2,2)'s RIGHT corner
    expect(cornerMaskFor(grid, 2, 2, TerrainType.Grass)).toBe(UP | DOWN | LEFT);
    expect(cornerMaskFor(grid, 2, 2, TerrainType.Dirt)).toBe(RIGHT);
  });

  test("off the edge of the world clamps to the nearest in-bounds cell", () => {
    const grid = grid5x5(TerrainType.Grass);
    // Dual tile (-1, -1)'s UP/RIGHT/LEFT corners are all off-grid; only
    // its DOWN corner, (0, 0), is real — the other 3 clamp to it too.
    expect(cornerMaskFor(grid, -1, -1, TerrainType.Grass)).toBe(FULL_MASK);
    grid.setTerrain(0, 0, TerrainType.Dirt);
    expect(cornerMaskFor(grid, -1, -1, TerrainType.Dirt)).toBe(FULL_MASK);
    expect(cornerMaskFor(grid, -1, -1, TerrainType.Grass)).toBe(0);
  });
});

describe("baseTerrainFor", () => {
  function grid5x5(fill: TerrainType): WorldGrid {
    return WorldGrid.empty(5, 5, fill);
  }

  test("a tile fully surrounded by one terrain has that terrain as its base", () => {
    const grid = grid5x5(TerrainType.Grass);
    expect(baseTerrainFor(grid, 2, 2)).toBe(TerrainType.Grass);
  });

  test("picks the LOWEST-priority terrain among the 4 corners, not the highest", () => {
    const grid = grid5x5(TerrainType.Grass); // grass is highest priority
    grid.setTerrain(3, 2, TerrainType.Dirt); // RIGHT corner of dual tile (2,2)
    expect(baseTerrainFor(grid, 2, 2)).toBe(TerrainType.Dirt);
  });

  test("with 3 distinct terrains at the 4 corners, still picks the lowest-priority one", () => {
    const grid = grid5x5(TerrainType.Grass);
    grid.setTerrain(3, 2, TerrainType.Dirt); // RIGHT
    grid.setTerrain(3, 3, TerrainType.Water); // DOWN — lowest priority of the three
    expect(baseTerrainFor(grid, 2, 2)).toBe(TerrainType.Water);
  });
});
