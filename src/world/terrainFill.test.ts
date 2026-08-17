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
  flattenReservedAreas(grid, boxes, corner, SEED);
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
    flattenReservedAreas(grid, [box], corner, SEED);
    sealFarEdges(grid, corner);
    return { grid, before };
  }

  test("leaves the inside of a story area walkable", () => {
    // Content gets built in these, so a player has to be able to stand in
    // the part of one that is actually the clearing. The rim is deliberately
    // left as whatever the surroundings are — that is what stops the area
    // reading as a rectangle — so the guarantee is about the inside.
    const margin = 8;
    for (const corner of HIGH_CORNERS) {
      for (const box of [
        { id: "high", col: 4, row: 4, width: 24, height: 24 },
        { id: "low", col: SIZE - 32, row: SIZE - 32, width: 24, height: 24 },
      ] as AreaPlacement[]) {
        const { grid } = boxed(corner, box);
        for (let row = box.row + margin; row < box.row + box.height - margin; row++) {
          for (let col = box.col + margin; col < box.col + box.width - margin; col++) {
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

  test("a clearing in the mountain is not one flat colour", () => {
    // The failure this replaced: converting every impassable tile gave an
    // Observatory that came out 100% hilly — still a rectangle, just a
    // different one, with a hard line where it met the rock. So the test is
    // that no single terrain dominates, not merely that two appear.
    const box: AreaPlacement = { id: "high", col: 4, row: 4, width: 24, height: 24 };
    const { grid } = boxed(HighCorner.NorthWest, box);
    const counts = new Map<TerrainType, number>();
    for (let row = box.row; row < box.row + box.height; row++) {
      for (let col = box.col; col < box.col + box.width; col++) {
        const t = grid.getTerrain(col, row);
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    const cells = box.width * box.height;
    expect(counts.size).toBeGreaterThan(1);
    expect(Math.max(...counts.values()) / cells).toBeLessThan(0.85);
  });

  test("a clearing meets its surroundings on a slope, not a line", () => {
    // The outermost ring of the box is left exactly as it was, so there is
    // no edge to see.
    const box: AreaPlacement = { id: "high", col: 20, row: 20, width: 30, height: 30 };
    const plain = world(HighCorner.NorthWest);
    const { grid } = boxed(HighCorner.NorthWest, box);
    for (let col = box.col; col < box.col + box.width; col++) {
      expect({ col, t: grid.getTerrain(col, box.row) }).toEqual({
        col,
        t: plain.getTerrain(col, box.row),
      });
    }
  });

  test("keeps a story area looking like the ground it was cut from", () => {
    // A clearing in the mountain runs hilly and wooded, never sand or sea:
    // lowering the ground walks it down the bands, it does not teleport it.
    const box: AreaPlacement = { id: "high", col: 4, row: 4, width: 24, height: 24 };
    const { grid } = boxed(HighCorner.NorthWest, box);
    const inside = new Set<TerrainType>();
    for (let row = box.row; row < box.row + box.height; row++) {
      for (let col = box.col; col < box.col + box.width; col++)
        inside.add(grid.getTerrain(col, row));
    }
    expect(inside.has(TerrainType.Hilly)).toBe(true);
    expect(inside.has(TerrainType.Water)).toBe(false);
    expect(inside.has(TerrainType.Sand)).toBe(false);
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
