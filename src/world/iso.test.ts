// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { TILE_HEIGHT, TILE_WIDTH, gridToScreen, isoDepth, screenToGrid } from "./iso";

describe("gridToScreen", () => {
  test("origin tile maps to screen origin", () => {
    expect(gridToScreen(0, 0)).toEqual({ x: 0, y: 0 });
  });

  test("moving one column right moves screen position right and down", () => {
    expect(gridToScreen(1, 0)).toEqual({ x: TILE_WIDTH / 2, y: TILE_HEIGHT / 2 });
  });

  test("moving one row down moves screen position left and down", () => {
    expect(gridToScreen(0, 1)).toEqual({ x: -TILE_WIDTH / 2, y: TILE_HEIGHT / 2 });
  });

  test("equal col and row stays on the vertical screen axis", () => {
    const p = gridToScreen(3, 3);
    expect(p.x).toBe(0);
    expect(p.y).toBe(3 * TILE_HEIGHT);
  });
});

describe("screenToGrid", () => {
  test("is the exact inverse of gridToScreen at tile centers", () => {
    for (let col = -3; col <= 3; col++) {
      for (let row = -3; row <= 3; row++) {
        const { x, y } = gridToScreen(col, row);
        expect(screenToGrid(x, y)).toEqual({ col, row });
      }
    }
  });

  test("a point well inside a tile still resolves to that tile", () => {
    // Quarter-way from tile (0,0)'s center toward its right-hand corner —
    // this is the case that breaks a naive Math.floor-based inverse.
    expect(screenToGrid(TILE_WIDTH / 4, 0)).toEqual({ col: 0, row: 0 });
  });

  test("a point near the top of a tile still resolves to that tile", () => {
    expect(screenToGrid(0, -TILE_HEIGHT / 4)).toEqual({ col: 0, row: 0 });
  });
});

describe("isoDepth", () => {
  test("increases as a tile moves further into the grid", () => {
    expect(isoDepth(0, 0)).toBeLessThan(isoDepth(1, 0));
    expect(isoDepth(0, 0)).toBeLessThan(isoDepth(0, 1));
    expect(isoDepth(2, 3)).toBe(5);
  });
});
