// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import {
  HIGH_CORNERS,
  HighCorner,
  bandFloor,
  elevationAt,
  habitatForElevation,
  highEdges,
  pickHighCorner,
  terrainForElevation,
} from "./elevation";
import { Habitat } from "./habitat";
import { createRng } from "./rng";
import { TERRAIN_TYPES, TerrainType } from "./terrain";

const W = 200;
const H = 200;

function cornerTile(corner: HighCorner): { col: number; row: number } {
  const edges = highEdges(corner);
  return { col: edges.left ? 0 : W - 1, row: edges.top ? 0 : H - 1 };
}

function farEdgeTiles(corner: HighCorner): { col: number; row: number }[] {
  const edges = highEdges(corner);
  const farCol = edges.left ? W - 1 : 0;
  const farRow = edges.top ? H - 1 : 0;
  const tiles: { col: number; row: number }[] = [];
  for (let col = 0; col < W; col += 7) tiles.push({ col, row: farRow });
  for (let row = 0; row < H; row += 7) tiles.push({ col: farCol, row });
  return tiles;
}

describe("highEdges", () => {
  test("names the two edges each corner actually touches", () => {
    expect(highEdges(HighCorner.NorthWest)).toEqual({ top: true, left: true });
    expect(highEdges(HighCorner.NorthEast)).toEqual({ top: true, left: false });
    expect(highEdges(HighCorner.SouthWest)).toEqual({ top: false, left: true });
    expect(highEdges(HighCorner.SouthEast)).toEqual({ top: false, left: false });
  });
});

describe("elevationAt", () => {
  test("is highest at the high corner, for every corner", () => {
    for (const corner of HIGH_CORNERS) {
      const { col, row } = cornerTile(corner);
      expect({
        corner,
        high: elevationAt(col, row, W, H, corner, 5) > bandFloor(TerrainType.Mountain),
      }).toEqual({ corner, high: true });
    }
  });

  test("is lowest at the corner diagonally opposite", () => {
    for (const corner of HIGH_CORNERS) {
      const { col, row } = cornerTile(corner);
      const opposite = elevationAt(W - 1 - col, H - 1 - row, W, H, corner, 5);
      expect({ corner, low: opposite < bandFloor(TerrainType.Sand) }).toEqual({
        corner,
        low: true,
      });
    }
  });

  test("never rises above the shore along either far edge", () => {
    // The property that puts water on those edges. It holds because the warp
    // is smaller than the sand band is deep — if that ever stops being true,
    // the far edges start growing grass and the world stops being bounded by
    // sea.
    for (const corner of HIGH_CORNERS) {
      for (const seed of [1, 2, 3]) {
        for (const { col, row } of farEdgeTiles(corner)) {
          const e = elevationAt(col, row, W, H, corner, seed);
          expect({ corner, col, row, dry: e >= bandFloor(TerrainType.Grass) }).toEqual({
            corner,
            col,
            row,
            dry: false,
          });
        }
      }
    }
  });

  test("stays within [0, 1]", () => {
    for (let row = 0; row < H; row += 3) {
      for (let col = 0; col < W; col += 3) {
        const e = elevationAt(col, row, W, H, HighCorner.NorthWest, 9);
        expect(e).toBeGreaterThanOrEqual(0);
        expect(e).toBeLessThanOrEqual(1);
      }
    }
  });

  test("falls, on average, with distance from the high corner", () => {
    const near: number[] = [];
    const far: number[] = [];
    for (let i = 0; i < W; i += 2) {
      near.push(elevationAt(i, i, W, H, HighCorner.NorthWest, 4));
    }
    for (let i = 0; i < W; i += 2) {
      far.push(elevationAt(W - 1 - i, H - 1 - i, W, H, HighCorner.NorthWest, 4));
    }
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(near)).toBeGreaterThan(mean(far));
  });

  test("survives a degenerate one-tile world", () => {
    expect(elevationAt(0, 0, 1, 1, HighCorner.NorthWest, 1)).toBeGreaterThanOrEqual(0);
  });

  test("is deterministic", () => {
    expect(elevationAt(31, 47, W, H, HighCorner.SouthEast, 77)).toBe(
      elevationAt(31, 47, W, H, HighCorner.SouthEast, 77),
    );
  });
});

describe("terrainForElevation", () => {
  test("runs water, sand, grass, woodland, hilly, mountain going uphill", () => {
    const order: TerrainType[] = [];
    for (let i = 0; i <= 500; i++) {
      const terrain = terrainForElevation(i / 500);
      if (order[order.length - 1] !== terrain) order.push(terrain);
    }
    expect(order).toEqual([
      TerrainType.Water,
      TerrainType.Sand,
      TerrainType.Grass,
      TerrainType.Woodland,
      TerrainType.Hilly,
      TerrainType.Mountain,
    ]);
  });

  test("never produces dirt — that is the village's material, not the world's", () => {
    for (let i = 0; i <= 500; i++) {
      expect(terrainForElevation(i / 500)).not.toBe(TerrainType.Dirt);
    }
  });

  test("only produces real terrain types", () => {
    for (let i = 0; i <= 200; i++) {
      expect(TERRAIN_TYPES).toContain(terrainForElevation(i / 200));
    }
  });
});

describe("habitatForElevation", () => {
  test("agrees with the terrain at every height", () => {
    const expected = new Map<TerrainType, Habitat>([
      [TerrainType.Mountain, Habitat.Highland],
      [TerrainType.Hilly, Habitat.Highland],
      [TerrainType.Woodland, Habitat.Woodland],
      [TerrainType.Grass, Habitat.Meadow],
      [TerrainType.Sand, Habitat.Coastal],
      [TerrainType.Water, Habitat.Coastal],
    ]);
    for (let i = 0; i <= 200; i++) {
      const e = i / 200;
      expect(habitatForElevation(e)).toBe(expected.get(terrainForElevation(e)) as Habitat);
    }
  });

  test("Wetland has no home on the slope", () => {
    // Recorded rather than asserted-away: the habitat exists and nothing
    // produces it any more. See docs/WORLD_GENERATION.md.
    const produced = new Set<Habitat>();
    for (let i = 0; i <= 500; i++) produced.add(habitatForElevation(i / 500));
    expect(produced.has(Habitat.Wetland)).toBe(false);
  });
});

describe("bandFloor", () => {
  test("orders the bands the way the slope does", () => {
    const floors = [
      TerrainType.Water,
      TerrainType.Sand,
      TerrainType.Grass,
      TerrainType.Woodland,
      TerrainType.Hilly,
      TerrainType.Mountain,
    ].map(bandFloor);
    expect(floors).toEqual([...floors].sort((a, b) => a - b));
  });

  test("throws for a terrain the slope never makes", () => {
    expect(() => bandFloor(TerrainType.Dirt)).toThrow("no elevation band");
  });
});

describe("pickHighCorner", () => {
  test("is deterministic for a seed", () => {
    expect(pickHighCorner(createRng(8))).toBe(pickHighCorner(createRng(8)));
  });

  test("reaches all four corners over many seeds", () => {
    const seen = new Set(Array.from({ length: 60 }, (_, i) => pickHighCorner(createRng(i))));
    expect(seen.size).toBe(4);
  });
});
