// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import type { AreaPlacement } from "./anchors";
import { BARRIER_DEPTH, placeEdgeBarriers } from "./barriers";
import { HIGH_CORNERS, type HighCorner, highEdges } from "./elevation";
import { WorldGrid } from "./grid";
import { SCENERY_KINDS, sceneryKind, sceneryType } from "./scenery";
import { TerrainType } from "./terrain";
import { fillFromElevation, sealFarEdges } from "./terrainFill";

const SIZE = 120;
const SEED = 17;

function walled(corner: HighCorner, boxes: readonly AreaPlacement[] = []) {
  const grid = WorldGrid.empty(SIZE, SIZE, TerrainType.Grass);
  fillFromElevation(grid, corner, SEED, boxes);
  sealFarEdges(grid, corner);
  return { grid, placed: placeEdgeBarriers(grid, corner, boxes) };
}

function nearHighEdge(corner: HighCorner, col: number, row: number): boolean {
  const edges = highEdges(corner);
  const fromHorizontal = edges.left ? col : SIZE - 1 - col;
  const fromVertical = edges.top ? row : SIZE - 1 - row;
  return fromHorizontal < BARRIER_DEPTH || fromVertical < BARRIER_DEPTH;
}

describe("placeEdgeBarriers", () => {
  test("puts something along both edges at the high corner", () => {
    for (const corner of HIGH_CORNERS) {
      const { placed } = walled(corner);
      expect({ corner, many: placed.length > 20 }).toEqual({ corner, many: true });
    }
  });

  test("stays on the two high edges and never wanders inland", () => {
    // A barrier further in could cut the map in two, and connectivity cannot
    // rescue that: it carves terrain, and an object blocks whatever the
    // terrain under it is.
    for (const corner of HIGH_CORNERS) {
      for (const object of walled(corner).placed) {
        expect({
          corner,
          col: object.col,
          row: object.row,
          ok: nearHighEdge(corner, object.col, object.row),
        }).toEqual({ corner, col: object.col, row: object.row, ok: true });
      }
    }
  });

  test("never stands anything in the sea", () => {
    for (const corner of HIGH_CORNERS) {
      const { grid, placed } = walled(corner);
      for (const object of placed) {
        for (let r = object.row; r < object.row + object.height; r++) {
          for (let c = object.col; c < object.col + object.width; c++) {
            expect({ c, r, t: grid.getTerrain(c, r) }).not.toEqual({ c, r, t: TerrainType.Water });
          }
        }
      }
    }
  });

  test("grows what the ground it stands on grows", () => {
    // Conifers through the trees, rock up in the mountains — the object is
    // chosen by the terrain rather than picked, which is what stops a
    // boulder appearing in the middle of a wood.
    for (const corner of HIGH_CORNERS) {
      const { grid, placed } = walled(corner);
      for (const object of placed) {
        const kind = sceneryKind(object.type);
        expect({
          kind,
          matches: kind === (grid.getTerrain(object.col, object.row) as string),
        }).toEqual({
          kind,
          matches: true,
        });
      }
    }
  });

  test("blocks every cell it occupies", () => {
    const { grid, placed } = walled(HIGH_CORNERS[0] as HighCorner);
    for (const object of placed) {
      expect(object.blocksMovement).toBe(true);
      expect(grid.isPassable(object.col, object.row)).toBe(false);
    }
  });

  test("packs with no gaps a player could slip through", () => {
    // Anchors sit on a 2-tile lattice because every scenery object is 2x2.
    // An odd anchor would leave a one-tile corridor straight out of the map.
    for (const corner of HIGH_CORNERS) {
      for (const object of walled(corner).placed) {
        expect(object.col % 2).toBe(0);
        expect(object.row % 2).toBe(0);
      }
    }
  });

  test("never overlaps two formations", () => {
    const seen = new Set<string>();
    for (const object of walled(HIGH_CORNERS[3] as HighCorner).placed) {
      for (let r = object.row; r < object.row + object.height; r++) {
        for (let c = object.col; c < object.col + object.width; c++) {
          expect({ c, r, twice: seen.has(`${c},${r}`) }).toEqual({ c, r, twice: false });
          seen.add(`${c},${r}`);
        }
      }
    }
  });

  test("leaves reserved story areas clear", () => {
    // The observatory sits in the mountain, which is exactly where the wall
    // is thickest. Walling it in would make it unreachable.
    const box: AreaPlacement = { id: "observatory", col: 0, row: 0, width: 24, height: 24 };
    const { placed } = walled("north-west" as HighCorner, [box]);
    for (const object of placed) {
      const overlaps =
        object.col < box.col + box.width &&
        object.col + object.width > box.col &&
        object.row < box.row + box.height &&
        object.row + object.height > box.row;
      expect({ col: object.col, row: object.row, overlaps }).toEqual({
        col: object.col,
        row: object.row,
        overlaps: false,
      });
    }
  });

  test("is deterministic", () => {
    const a = walled("south-east" as HighCorner).placed.map((o) => o.id);
    const b = walled("south-east" as HighCorner).placed.map((o) => o.id);
    expect(a).toEqual(b);
  });
});

describe("scenery kinds", () => {
  test("round-trip through the placed-object type", () => {
    for (const kind of SCENERY_KINDS) {
      expect(sceneryKind(sceneryType(kind))).toBe(kind);
    }
  });

  test("a non-scenery type is not mistaken for one", () => {
    expect(sceneryKind("well")).toBeNull();
    expect(sceneryKind("house")).toBeNull();
  });

  test("water grows nothing", () => {
    // It already blocks, and a boulder in the sea is not a barrier.
    expect(SCENERY_KINDS).not.toContain(TerrainType.Water);
  });
});
