// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { TILE_SIZE, computeMapScreenBounds, depthFor, gridToScreen, screenToGrid } from "./topdown";

describe("gridToScreen", () => {
  test("names the tile's top-left corner", () => {
    expect(gridToScreen(0, 0)).toEqual({ x: 0, y: 0 });
    expect(gridToScreen(3, 2)).toEqual({ x: 3 * TILE_SIZE, y: 2 * TILE_SIZE });
  });

  test("negative coordinates project behind the origin", () => {
    expect(gridToScreen(-1, -1)).toEqual({ x: -TILE_SIZE, y: -TILE_SIZE });
  });
});

describe("screenToGrid", () => {
  test("inverts gridToScreen at a tile's own corner", () => {
    for (const [col, row] of [
      [0, 0],
      [7, 3],
      [-2, 5],
    ] as const) {
      const p = gridToScreen(col, row);
      expect(screenToGrid(p.x, p.y)).toEqual({ col, row });
    }
  });

  test("every point strictly inside a tile maps to it", () => {
    // Floor, not round: the tile's square starts at its coordinate rather
    // than being centred on it, so the last pixel before the next tile is
    // still this one's.
    expect(screenToGrid(0, 0)).toEqual({ col: 0, row: 0 });
    expect(screenToGrid(TILE_SIZE - 1, TILE_SIZE - 1)).toEqual({ col: 0, row: 0 });
    expect(screenToGrid(TILE_SIZE, TILE_SIZE)).toEqual({ col: 1, row: 1 });
  });

  test("points left of / above the origin land on negative tiles, not tile 0", () => {
    expect(screenToGrid(-1, -1)).toEqual({ col: -1, row: -1 });
  });
});

describe("depthFor", () => {
  test("sorts by vertical position, so lower on screen draws in front", () => {
    expect(depthFor(10)).toBeLessThan(depthFor(11));
  });

  test("is independent of the x axis — top-down occlusion is vertical only", () => {
    // The isometric depth this replaced summed col + row; here two things at
    // the same y never occlude each other whatever their column.
    expect(depthFor(5 * TILE_SIZE)).toBe(depthFor(5 * TILE_SIZE));
  });
});

describe("computeMapScreenBounds", () => {
  test("starts at the origin — a top-down map needs no shift to sit in view", () => {
    const bounds = computeMapScreenBounds(10, 8);
    expect(bounds).toEqual({ minX: 0, minY: 0, maxX: 10 * TILE_SIZE, maxY: 8 * TILE_SIZE });
  });

  test("contains every tile of the grid", () => {
    const width = 12;
    const height = 9;
    const bounds = computeMapScreenBounds(width, height);
    const last = gridToScreen(width - 1, height - 1);
    expect(last.x + TILE_SIZE).toBeLessThanOrEqual(bounds.maxX);
    expect(last.y + TILE_SIZE).toBeLessThanOrEqual(bounds.maxY);
  });
});
