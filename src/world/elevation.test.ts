// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import {
  HIGH_CORNERS,
  HighCorner,
  WORLD_HIGH_CORNER,
  bandFloor,
  elevationAt,
  groundAt,
  habitatForElevation,
  highEdges,
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

describe("the corner every world is high in", () => {
  // It used to be drawn per seed. What that bought was four worlds a player
  // cannot carry between them: "water is downhill and rock is uphill" is
  // only worth knowing if it is true of the next world too.
  test("is the north-west, so the mountains are north and the sea is south", () => {
    expect(WORLD_HIGH_CORNER).toBe(HighCorner.NorthWest);
    expect(highEdges(WORLD_HIGH_CORNER)).toEqual({ top: true, left: true });
  });

  // Stated as heights rather than as a name, because the name is only a
  // label on the field — this is the fact a child actually meets.
  /**
   * The slope is a corner, so the honest claim is a *direction* rather than
   * an edge: the world rises to the north-west and falls to the south-east.
   *
   * Which is what a player actually meets. From anywhere, walking north or
   * west goes uphill toward rock and walking south or east goes downhill
   * toward water — so all four directions mean something, and none of them
   * means something different in the next world.
   *
   * Averaged along each row rather than sampled at one cell: the warp that
   * gives the coast its bays moves any single tile by up to a third of a
   * band, so one sample says as much about the noise as about the slope.
   */
  test("rises to the north and west, and falls to the south and east", () => {
    const mean = (cells: { col: number; row: number }[]) =>
      cells.reduce((sum, at) => sum + elevationAt(at.col, at.row, W, H, WORLD_HIGH_CORNER, 5), 0) /
      cells.length;
    const row = (r: number) => Array.from({ length: W }, (_, col) => ({ col, row: r }));
    const column = (c: number) => Array.from({ length: H }, (_, r) => ({ col: c, row: r }));

    expect(mean(row(0))).toBeGreaterThan(mean(row(H - 1)));
    expect(mean(column(0))).toBeGreaterThan(mean(column(W - 1)));
    // And the far corner really is under water, which is the half of it a
    // harbour depends on.
    expect(elevationAt(W - 1, H - 1, W, H, WORLD_HIGH_CORNER, 5)).toBeLessThan(
      bandFloor(TerrainType.Sand),
    );
  });
});

describe("groundAt", () => {
  test("puts marsh between the meadow and the trees, and nowhere else", () => {
    // Wetland is not a height, it is ground at a height that happens to hold
    // water — so it can only appear where the meadow gives way to the wood.
    const heights: number[] = [];
    for (let i = 0; i <= 400; i++) {
      const e = i / 400;
      for (let col = 0; col < 60; col += 3) {
        if (groundAt(col, col * 7, e, 3).habitat === Habitat.Wetland) heights.push(e);
      }
    }
    expect(heights.length).toBeGreaterThan(0);
    expect(Math.min(...heights)).toBeGreaterThan(bandFloor(TerrainType.Grass));
    expect(Math.max(...heights)).toBeLessThan(bandFloor(TerrainType.Hilly));
  });

  test("marsh is water or boggy grass, never anything else", () => {
    for (let i = 0; i <= 200; i++) {
      for (let col = 0; col < 40; col += 2) {
        const ground = groundAt(col, col * 3, i / 200, 5);
        if (ground.habitat !== Habitat.Wetland) continue;
        const marshTerrain: TerrainType[] = [TerrainType.Water, TerrainType.Grass];
        expect(marshTerrain).toContain(ground.terrain);
      }
    }
  });

  test("falls back to the plain band away from the marsh zone", () => {
    for (const e of [0.02, 0.5, 0.7, 0.95]) {
      const ground = groundAt(11, 23, e, 5);
      expect(ground.terrain).toBe(terrainForElevation(e));
      expect(ground.habitat).toBe(habitatForElevation(e));
    }
  });

  test("marsh comes in patches rather than speckle", () => {
    // Thresholded on a smooth field, so neighbours agree — the same reason
    // the terrain bands are coherent.
    // Sampled right on the seam the marsh straddles — halfway up the grass
    // band is below the marsh zone entirely.
    const e = bandFloor(TerrainType.Woodland);
    let flips = 0;
    let wet = 0;
    let previous = groundAt(0, 40, e, 9).habitat === Habitat.Wetland;
    for (let col = 1; col < 400; col++) {
      const now = groundAt(col, 40, e, 9).habitat === Habitat.Wetland;
      if (now) wet++;
      if (now !== previous) flips++;
      previous = now;
    }
    expect(wet).toBeGreaterThan(0);
    expect(flips).toBeLessThan(20);
  });

  test("is deterministic", () => {
    expect(groundAt(9, 9, 0.36, 2)).toEqual(groundAt(9, 9, 0.36, 2));
  });
});
