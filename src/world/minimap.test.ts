// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import type { AnchorPlacements } from "./anchors";
import {
  MINIMAP_COLORS,
  MINIMAP_STEP,
  areaCentre,
  markedPlaces,
  minimapPoint,
  minimapSize,
  terrainsWithoutColour,
} from "./minimap";
import { TERRAIN_TYPES } from "./terrain";

describe("the colours", () => {
  // A terrain with no colour would be drawn as a hole in the map, and the
  // world gains terrains from time to time — the cobbles were the last one.
  test("every terrain the world can hold has one", () => {
    expect(terrainsWithoutColour()).toEqual([]);
    for (const terrain of TERRAIN_TYPES) {
      expect(MINIMAP_COLORS[terrain]).toBeGreaterThanOrEqual(0);
    }
  });

  // At one pixel a tile there is no texture to tell them apart by, so the
  // colours are all the map has.
  test("no two terrains share one", () => {
    const seen = new Set(TERRAIN_TYPES.map((terrain) => MINIMAP_COLORS[terrain]));
    expect(seen.size).toBe(TERRAIN_TYPES.length);
  });

  test("water is the bluest thing on it, which is how a coast reads", () => {
    const blue = (colour: number) => (colour & 0xff) - ((colour >> 16) & 0xff);
    for (const terrain of TERRAIN_TYPES) {
      if (terrain === "water") continue;
      expect(blue(MINIMAP_COLORS.water)).toBeGreaterThan(blue(MINIMAP_COLORS[terrain]));
    }
  });
});

describe("the scale", () => {
  test("shrinks the world by the sampling step", () => {
    expect(minimapSize(500, 500, 2)).toEqual({ width: 250, height: 250 });
    expect(minimapSize(500, 500, 4)).toEqual({ width: 125, height: 125 });
    // Rounded up, so the last strip of the world is not cut off the page.
    expect(minimapSize(101, 101, 2)).toEqual({ width: 51, height: 51 });
  });

  test("every cell lands inside the page", () => {
    const size = minimapSize(500, 500);
    for (const [col, row] of [
      [0, 0],
      [499, 499],
      [250, 13],
    ]) {
      const at = minimapPoint(col as number, row as number);
      expect(at.x).toBeGreaterThanOrEqual(0);
      expect(at.y).toBeGreaterThanOrEqual(0);
      expect(at.x).toBeLessThan(size.width);
      expect(at.y).toBeLessThan(size.height);
    }
  });

  test("neighbouring cells land on the same pixel or the next one", () => {
    for (let col = 0; col < 40; col++) {
      const here = minimapPoint(col, 0).x;
      const next = minimapPoint(col + 1, 0).x;
      expect(next - here).toBeGreaterThanOrEqual(0);
      expect(next - here).toBeLessThanOrEqual(1);
    }
    expect(MINIMAP_STEP).toBeGreaterThan(1);
  });
});

describe("the places marked on it", () => {
  const area = (id: string, col: number, row: number) => ({ id, col, row, width: 20, height: 10 });
  const anchors = {
    village: area("village", 100, 100),
    harbour: area("harbour", 10, 400),
    bigCity: area("bigCity", 300, 60),
    observatory: area("observatory", 400, 300),
    enchantedForest: area("enchantedForest", 60, 250),
  } as AnchorPlacements;

  test("are every anchor the world places, village first", () => {
    const marks = markedPlaces(anchors);
    expect(marks.map((mark) => mark.id)).toEqual([
      "village",
      "harbour",
      "bigCity",
      "observatory",
      "enchantedForest",
    ]);
    expect(marks.length).toBe(Object.keys(anchors).length);
  });

  test("a mark sits in the middle of its area, not at its corner", () => {
    expect(areaCentre(anchors.village)).toEqual({ col: 110, row: 105 });
  });
});
