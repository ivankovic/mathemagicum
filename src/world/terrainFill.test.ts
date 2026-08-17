// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import type { AreaPlacement } from "./anchors";
import { HIGH_CORNERS, HighCorner, highEdges } from "./elevation";
import { WorldGrid } from "./grid";
import { TerrainType } from "./terrain";
import { fillFromElevation, sealFarEdges } from "./terrainFill";

const SIZE = 120;
const SEED = 31;

function world(corner: HighCorner, boxes: readonly AreaPlacement[] = []): WorldGrid {
  const grid = WorldGrid.empty(SIZE, SIZE, TerrainType.Grass);
  fillFromElevation(grid, corner, SEED, boxes);
  sealFarEdges(grid, corner);
  return grid;
}

describe("fillFromElevation", () => {
  test("puts rock at the high corner and sea at the opposite one", () => {
    for (const corner of HIGH_CORNERS) {
      const grid = world(corner);
      const edges = highEdges(corner);
      const hc = edges.left ? 0 : SIZE - 1;
      const hr = edges.top ? 0 : SIZE - 1;
      expect({ corner, at: grid.getTerrain(hc, hr) }).toEqual({ corner, at: TerrainType.Mountain });
      expect({ corner, at: grid.getTerrain(SIZE - 1 - hc, SIZE - 1 - hr) }).toEqual({
        corner,
        at: TerrainType.Water,
      });
    }
  });

  test("leaves reserved boxes untouched for story-area generation", () => {
    const box: AreaPlacement = { id: "test", col: 40, row: 40, width: 20, height: 20 };
    const grid = world(HighCorner.NorthWest, [box]);
    for (let row = box.row; row < box.row + box.height; row++) {
      for (let col = box.col; col < box.col + box.width; col++) {
        expect(grid.getTerrain(col, row)).toBe(TerrainType.Grass);
      }
    }
  });

  test("never paints dirt", () => {
    const grid = world(HighCorner.SouthEast);
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        expect(grid.getTerrain(col, row)).not.toBe(TerrainType.Dirt);
      }
    }
  });

  test("produces every other terrain type somewhere", () => {
    const grid = world(HighCorner.NorthEast);
    const seen = new Set<TerrainType>();
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) seen.add(grid.getTerrain(col, row));
    }
    for (const terrain of [
      TerrainType.Water,
      TerrainType.Sand,
      TerrainType.Grass,
      TerrainType.Woodland,
      TerrainType.Hilly,
      TerrainType.Mountain,
    ]) {
      expect({ terrain, present: seen.has(terrain) }).toEqual({ terrain, present: true });
    }
  });
});

describe("sealFarEdges", () => {
  test("makes both far edges open water along their whole length", () => {
    for (const corner of HIGH_CORNERS) {
      const grid = world(corner);
      const edges = highEdges(corner);
      const farCol = edges.left ? SIZE - 1 : 0;
      const farRow = edges.top ? SIZE - 1 : 0;
      for (let col = 0; col < SIZE; col++) {
        expect({ corner, col, t: grid.getTerrain(col, farRow) }).toEqual({
          corner,
          col,
          t: TerrainType.Water,
        });
      }
      for (let row = 0; row < SIZE; row++) {
        expect({ corner, row, t: grid.getTerrain(farCol, row) }).toEqual({
          corner,
          row,
          t: TerrainType.Water,
        });
      }
    }
  });

  test("leaves the high corner's own two edges alone", () => {
    // They are meant to be walled by rock and forest, not by sea. If this
    // ever forced them too, the mountain corner would be ringed with water.
    const corner = HighCorner.NorthWest;
    const grid = world(corner);
    expect(grid.getTerrain(0, 0)).toBe(TerrainType.Mountain);
    const alongTop = new Set<TerrainType>();
    for (let col = 0; col < SIZE; col++) alongTop.add(grid.getTerrain(col, 0));
    expect(alongTop.size).toBeGreaterThan(1);
  });

  test("does not reach into the middle of the map", () => {
    const grid = world(HighCorner.SouthEast);
    const middle = new Set<TerrainType>();
    for (let row = 30; row < SIZE - 30; row++) {
      for (let col = 30; col < SIZE - 30; col++) middle.add(grid.getTerrain(col, row));
    }
    expect(middle.size).toBeGreaterThan(1);
  });
});
