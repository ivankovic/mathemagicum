// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { WorldGrid } from "./grid";
import { TerrainType } from "./terrain";
import {
  CANONICAL_BLOB_MASKS,
  DOWN,
  DOWN_LEFT,
  DOWN_RIGHT,
  LEFT,
  RIGHT,
  TILE_VARIANTS,
  UP,
  UP_LEFT,
  UP_RIGHT,
  blobTileKey,
  cornerWedgeKey,
  edgeWedgeKey,
  ownCutMaskFor,
  reduceBlobMask,
  terrainPriorityRank,
  terrainTileKey,
  tileVariantFor,
} from "./tileset";

describe("reduceBlobMask", () => {
  test("leaves a corner bit alone when both flanking edges are 0", () => {
    expect(reduceBlobMask(UP_LEFT)).toBe(UP_LEFT);
  });

  test("zeroes a corner bit when either flanking edge is set", () => {
    expect(reduceBlobMask(UP_LEFT | UP)).toBe(UP);
    expect(reduceBlobMask(UP_LEFT | LEFT)).toBe(LEFT);
    expect(reduceBlobMask(UP_RIGHT | RIGHT)).toBe(RIGHT);
    expect(reduceBlobMask(DOWN_RIGHT | DOWN)).toBe(DOWN);
    expect(reduceBlobMask(DOWN_LEFT | DOWN)).toBe(DOWN);
  });

  test("is idempotent — reducing an already-reduced mask changes nothing", () => {
    for (const mask of CANONICAL_BLOB_MASKS) {
      expect(reduceBlobMask(mask)).toBe(mask);
    }
  });
});

describe("CANONICAL_BLOB_MASKS", () => {
  test("has exactly 47 values — the well-known blob-tileset count", () => {
    expect(CANONICAL_BLOB_MASKS.length).toBe(47);
  });

  test("every one of the 256 raw patterns reduces to a canonical value", () => {
    const canonical = new Set(CANONICAL_BLOB_MASKS);
    for (let raw = 0; raw < 256; raw++) {
      expect(canonical.has(reduceBlobMask(raw))).toBe(true);
    }
  });

  test("includes 0 (fully interior) and the fully-isolated tile", () => {
    // Raw 255 (every neighbour differs) reduces to just the 4 edge bits
    // (15) — once all 4 edges are cut, every corner's flanking edges are
    // both set, so reduceBlobMask always zeroes them. 255 itself never
    // survives reduction, which is exactly the point of reducing.
    expect(CANONICAL_BLOB_MASKS).toContain(0);
    expect(CANONICAL_BLOB_MASKS).toContain(UP | RIGHT | DOWN | LEFT);
    expect(reduceBlobMask(255)).toBe(UP | RIGHT | DOWN | LEFT);
  });
});

describe("blobTileKey", () => {
  test("mask 0 includes the given variant", () => {
    expect(blobTileKey(TerrainType.Sand, 0, 2)).toBe("sand-blob-0-2");
  });

  test("mask 0 defaults to variant 0 when omitted", () => {
    expect(blobTileKey(TerrainType.Sand, 0)).toBe("sand-blob-0-0");
  });

  test("non-zero masks ignore the variant argument entirely", () => {
    expect(blobTileKey(TerrainType.Sand, UP, 3)).toBe("sand-blob-1");
    expect(blobTileKey(TerrainType.Sand, UP)).toBe("sand-blob-1");
  });
});

describe("terrainTileKey", () => {
  test("mask 0 picks a variant deterministically from (col, row)", () => {
    const key = terrainTileKey(TerrainType.Grass, 0, 5, 9);
    expect(key).toBe(`grass-blob-0-${tileVariantFor(5, 9)}`);
  });

  test("non-zero masks ignore position — one fixed tile per mask", () => {
    expect(terrainTileKey(TerrainType.Grass, UP, 5, 9)).toBe("grass-blob-1");
    expect(terrainTileKey(TerrainType.Grass, UP, 100, 200)).toBe("grass-blob-1");
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

describe("ownCutMaskFor", () => {
  function grid5x5(fill: TerrainType): WorldGrid {
    return WorldGrid.empty(5, 5, fill);
  }

  test("a tile fully surrounded by its own terrain has mask 0", () => {
    const grid = grid5x5(TerrainType.Grass);
    expect(ownCutMaskFor(grid, 2, 2, TerrainType.Grass)).toBe(0);
  });

  test("a higher-priority terrain is never cut, regardless of neighbours", () => {
    const grid = grid5x5(TerrainType.Dirt);
    // Grass outranks dirt — every neighbour differs, but none outranks
    // grass, so grass stays a full plain tile here.
    expect(ownCutMaskFor(grid, 2, 2, TerrainType.Grass)).toBe(0);
  });

  test("a lower-priority terrain IS cut by a higher-priority neighbour", () => {
    const grid = grid5x5(TerrainType.Dirt);
    grid.setTerrain(2, 1, TerrainType.Grass); // north of (2,2), outranks dirt
    expect(ownCutMaskFor(grid, 2, 2, TerrainType.Dirt)).toBe(UP);
  });

  test("a differing but LOWER-priority neighbour causes no cut", () => {
    const grid = grid5x5(TerrainType.Dirt);
    grid.setTerrain(2, 1, TerrainType.Sand); // sand outranks nothing dirt cares about
    expect(ownCutMaskFor(grid, 2, 2, TerrainType.Dirt)).toBe(0);
  });

  test("a higher-priority diagonal neighbour sets the corner bit when both flanks are lower/equal", () => {
    const grid = grid5x5(TerrainType.Dirt);
    grid.setTerrain(1, 1, TerrainType.Grass); // north-west diagonal of (2,2)
    expect(ownCutMaskFor(grid, 2, 2, TerrainType.Dirt)).toBe(UP_LEFT);
  });

  test("a higher-priority diagonal is subsumed once its flanking edge also outranks", () => {
    const grid = grid5x5(TerrainType.Dirt);
    grid.setTerrain(1, 1, TerrainType.Grass); // corner
    grid.setTerrain(2, 1, TerrainType.Grass); // flanking "up" edge
    expect(ownCutMaskFor(grid, 2, 2, TerrainType.Dirt)).toBe(UP);
  });

  test("off the edge of the world counts as 'same' — no cut", () => {
    const grid = grid5x5(TerrainType.Dirt);
    expect(ownCutMaskFor(grid, 0, 0, TerrainType.Dirt)).toBe(0);
  });
});

describe("edgeWedgeKey / cornerWedgeKey", () => {
  // The actual wedge SHAPE (the geometry that makes it the exact alpha
  // inverse of ownCutMaskFor's cut) lives in tools/tileset-gen/src/
  // tileset_gen/blob.py's _wedge_tile and isn't something TS computes —
  // these just need to name the PNG that pairs with a given (terrain,
  // direction) consistently.
  test("names are distinct per direction and don't collide with blob keys", () => {
    const keys = new Set([
      edgeWedgeKey(TerrainType.Grass, UP),
      edgeWedgeKey(TerrainType.Grass, RIGHT),
      edgeWedgeKey(TerrainType.Grass, DOWN),
      edgeWedgeKey(TerrainType.Grass, LEFT),
      cornerWedgeKey(TerrainType.Grass, UP_LEFT),
      cornerWedgeKey(TerrainType.Grass, UP_RIGHT),
      cornerWedgeKey(TerrainType.Grass, DOWN_RIGHT),
      cornerWedgeKey(TerrainType.Grass, DOWN_LEFT),
      blobTileKey(TerrainType.Grass, 0, 0),
    ]);
    expect(keys.size).toBe(9);
  });
});
