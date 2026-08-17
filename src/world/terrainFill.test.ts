// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import type { AreaPlacement } from "./anchors";
import { HIGH_CORNERS, HighCorner, highEdges } from "./elevation";
import { WorldGrid } from "./grid";
import { TerrainType } from "./terrain";
import { fillFromElevation, flattenReservedAreas, sealFarEdges } from "./terrainFill";

const SIZE = 120;
const SEED = 31;

function world(corner: HighCorner, boxes: readonly AreaPlacement[] = []): WorldGrid {
  const grid = WorldGrid.empty(SIZE, SIZE, TerrainType.Grass);
  fillFromElevation(grid, corner, SEED);
  sealFarEdges(grid, corner);
  flattenReservedAreas(grid, boxes);
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

  test("paints story areas from the slope like everywhere else", () => {
    // They used to be skipped and left at the grid's default grass, which
    // made each one a green rectangle in whatever it was placed in — a lawn
    // in the mountains, a lawn on the beach.
    const box: AreaPlacement = { id: "test", col: 4, row: 4, width: 24, height: 24 };
    const grid = world(HighCorner.NorthWest, [box]);
    const inside = new Set<TerrainType>();
    for (let row = box.row; row < box.row + box.height; row++) {
      for (let col = box.col; col < box.col + box.width; col++)
        inside.add(grid.getTerrain(col, row));
    }
    // Placed in the high corner, so it should be highland — never a lawn.
    expect(inside.has(TerrainType.Grass)).toBe(false);
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

describe("flattenReservedAreas", () => {
  function boxed(corner: HighCorner, box: AreaPlacement) {
    // Flatten between fill and seal, exactly as the generator does: the
    // world's water edge outranks a story area that reaches it.
    const grid = WorldGrid.empty(SIZE, SIZE, TerrainType.Grass);
    fillFromElevation(grid, corner, SEED);
    const before: TerrainType[] = [];
    for (let row = box.row; row < box.row + box.height; row++) {
      for (let col = box.col; col < box.col + box.width; col++)
        before.push(grid.getTerrain(col, row));
    }
    flattenReservedAreas(grid, [box]);
    sealFarEdges(grid, corner);
    return { grid, before };
  }

  test("leaves a story area entirely walkable", () => {
    // These are the five places content gets built in, so a player has to be
    // able to stand anywhere in them. Boxes are kept clear of the sealed
    // shore here, which the generator lets outrank a story area — a Harbour
    // reaching the map's edge is meant to have sea in it.
    for (const corner of HIGH_CORNERS) {
      for (const box of [
        { id: "high", col: 4, row: 4, width: 24, height: 24 },
        { id: "low", col: SIZE - 32, row: SIZE - 32, width: 24, height: 24 },
      ] as AreaPlacement[]) {
        const { grid } = boxed(corner, box);
        for (let row = box.row; row < box.row + box.height; row++) {
          for (let col = box.col; col < box.col + box.width; col++) {
            expect({ corner, col, row, walkable: grid.isPassable(col, row) }).toEqual({
              corner,
              col,
              row,
              walkable: true,
            });
          }
        }
      }
    }
  });

  test("changes only the tiles that were impassable", () => {
    const box: AreaPlacement = { id: "mid", col: 40, row: 40, width: 20, height: 20 };
    const { grid, before } = boxed(HighCorner.NorthWest, box);
    let i = 0;
    for (let row = box.row; row < box.row + box.height; row++) {
      for (let col = box.col; col < box.col + box.width; col++) {
        const was = before[i++] as TerrainType;
        const now = grid.getTerrain(col, row);
        const wasWalkable = was !== TerrainType.Water && was !== TerrainType.Mountain;
        if (wasWalkable) expect({ col, row, now }).toEqual({ col, row, now: was });
      }
    }
  });

  test("keeps a story area looking like the ground it was cut from", () => {
    // Rock becomes the slope below it and sea the shore above it, so the
    // Observatory reads as a shelf in the mountain rather than as a lawn.
    const box: AreaPlacement = { id: "high", col: 2, row: 2, width: 24, height: 24 };
    const { grid } = boxed(HighCorner.NorthWest, box);
    const inside = new Set<TerrainType>();
    for (let row = box.row; row < box.row + box.height; row++) {
      for (let col = box.col; col < box.col + box.width; col++)
        inside.add(grid.getTerrain(col, row));
    }
    expect(inside.has(TerrainType.Hilly)).toBe(true);
    expect(inside.has(TerrainType.Grass)).toBe(false);
  });

  test("leaves everything outside the box alone", () => {
    const box: AreaPlacement = { id: "mid", col: 40, row: 40, width: 20, height: 20 };
    const plain = world(HighCorner.SouthEast);
    const { grid } = boxed(HighCorner.SouthEast, box);
    for (const [col, row] of [
      [10, 10],
      [SIZE - 5, SIZE - 5],
      [39, 39],
      [61, 61],
    ] as const) {
      expect({ col, row, t: grid.getTerrain(col, row) }).toEqual({
        col,
        row,
        t: plain.getTerrain(col, row),
      });
    }
  });
});
