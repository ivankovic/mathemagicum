// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { TILE_HEIGHT, TILE_WIDTH, gridToScreen, isoDepth } from "./iso";

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

describe("isoDepth", () => {
  test("increases as a tile moves further into the grid", () => {
    expect(isoDepth(0, 0)).toBeLessThan(isoDepth(1, 0));
    expect(isoDepth(0, 0)).toBeLessThan(isoDepth(0, 1));
    expect(isoDepth(2, 3)).toBe(5);
  });
});
