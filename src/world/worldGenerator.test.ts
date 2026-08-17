// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import type { AnchorPlacements, AreaPlacement } from "./anchors";
import { floodFillReachable, isReachable } from "./connectivity";
import { type HighCorner, highEdges } from "./elevation";
import type { WorldGrid } from "./grid";
import { generateWorld } from "./worldGenerator";

// Smaller than the real 500x500 target so a 20-seed sweep stays fast
// (~350ms observed); a single dedicated test below runs at full scale.
const SWEEP_SIZE = 150;
const SWEEP_SEEDS = Array.from({ length: 20 }, (_, i) => i);

function allAnchors(anchors: AnchorPlacements): AreaPlacement[] {
  return [
    anchors.village,
    anchors.harbour,
    anchors.bigCity,
    anchors.observatory,
    anchors.enchantedForest,
  ];
}

function centerOf(area: AreaPlacement): { col: number; row: number } {
  return {
    col: area.col + Math.floor(area.width / 2),
    row: area.row + Math.floor(area.height / 2),
  };
}

function boxesOverlap(a: AreaPlacement, b: AreaPlacement): boolean {
  return !(
    a.col + a.width <= b.col ||
    b.col + b.width <= a.col ||
    a.row + a.height <= b.row ||
    b.row + b.height <= a.row
  );
}

/**
 * The world's two far edges are open water along their whole length.
 *
 * Only two: the world slopes down from one corner, so the two edges *at*
 * that corner are the high ground it descends from. They are meant to be
 * walled by rock and forest rather than by sea, and are checked separately.
 */
function assertFarEdgesAreWater(grid: WorldGrid, corner: HighCorner): void {
  const edges = highEdges(corner);
  const farCol = edges.left ? grid.width - 1 : 0;
  const farRow = edges.top ? grid.height - 1 : 0;
  for (let col = 0; col < grid.width; col++) {
    expect({ col, passable: grid.isPassable(col, farRow) }).toEqual({ col, passable: false });
  }
  for (let row = 0; row < grid.height; row++) {
    expect({ row, passable: grid.isPassable(farCol, row) }).toEqual({ row, passable: false });
  }
}

/**
 * The high corner really is the top of the slope.
 *
 * Cheap to state and the thing most likely to break silently: get the
 * corner's axes crossed and the world still generates, still connects, and
 * is simply upside down.
 */
function assertHighCornerIsHighest(grid: WorldGrid, corner: HighCorner): void {
  const edges = highEdges(corner);
  const cornerCol = edges.left ? 0 : grid.width - 1;
  const cornerRow = edges.top ? 0 : grid.height - 1;
  expect(grid.getTerrain(cornerCol, cornerRow)).toBe("mountain");
  // ...and the corner diagonally opposite is the bottom of it.
  expect(grid.getTerrain(grid.width - 1 - cornerCol, grid.height - 1 - cornerRow)).toBe("water");
}

describe("generateWorld seed sweep", () => {
  for (const seed of SWEEP_SEEDS) {
    test(`seed ${seed}: every invariant holds`, () => {
      const world = generateWorld(SWEEP_SIZE, SWEEP_SIZE, seed);
      const { grid, anchors, playerStart } = world;

      expect(grid.width).toBe(SWEEP_SIZE);
      expect(grid.height).toBe(SWEEP_SIZE);

      const areas = allAnchors(anchors);
      for (const area of areas) {
        expect(area.col).toBeGreaterThanOrEqual(0);
        expect(area.row).toBeGreaterThanOrEqual(0);
        expect(area.col + area.width).toBeLessThanOrEqual(grid.width);
        expect(area.row + area.height).toBeLessThanOrEqual(grid.height);
      }
      for (let i = 0; i < areas.length; i++) {
        for (let j = i + 1; j < areas.length; j++) {
          const a = areas[i];
          const b = areas[j];
          if (!a || !b) continue;
          expect(boxesOverlap(a, b)).toBe(false);
        }
      }

      assertFarEdgesAreWater(grid, world.highCorner);
      assertHighCornerIsHighest(grid, world.highCorner);

      // Stronger invariant than "playerStart is the village box's centre"
      // (no longer true — the well sits there now): playerStart must
      // actually be somewhere the player can stand.
      expect(grid.isPassable(playerStart.col, playerStart.row)).toBe(true);
      const reachable = floodFillReachable(grid, playerStart);
      for (const area of [
        anchors.harbour,
        anchors.bigCity,
        anchors.observatory,
        anchors.enchantedForest,
      ]) {
        expect(isReachable(reachable, grid, centerOf(area))).toBe(true);
      }
    });
  }

  test("the same seed reproduces an identical world", () => {
    const a = generateWorld(SWEEP_SIZE, SWEEP_SIZE, 999);
    const b = generateWorld(SWEEP_SIZE, SWEEP_SIZE, 999);
    expect(a.anchors).toEqual(b.anchors);
    expect(a.playerStart).toEqual(b.playerStart);
    for (let row = 0; row < SWEEP_SIZE; row += 7) {
      for (let col = 0; col < SWEEP_SIZE; col += 7) {
        expect(a.grid.getTerrain(col, row)).toBe(b.grid.getTerrain(col, row));
        expect(a.grid.getHabitat(col, row)).toBe(b.grid.getHabitat(col, row));
      }
    }
  });

  test("different seeds produce different worlds", () => {
    const a = generateWorld(SWEEP_SIZE, SWEEP_SIZE, 1);
    const b = generateWorld(SWEEP_SIZE, SWEEP_SIZE, 2);
    expect(a.anchors).not.toEqual(b.anchors);
  });
});

describe("generateWorld at full target scale", () => {
  test("500x500 generates successfully with all invariants holding", () => {
    const world = generateWorld(500, 500, 42);
    const { grid, anchors, playerStart } = world;

    expect(grid.width).toBe(500);
    expect(grid.height).toBe(500);
    assertFarEdgesAreWater(grid, world.highCorner);
    assertHighCornerIsHighest(grid, world.highCorner);

    const reachable = floodFillReachable(grid, playerStart);
    for (const area of [
      anchors.harbour,
      anchors.bigCity,
      anchors.observatory,
      anchors.enchantedForest,
    ]) {
      expect(isReachable(reachable, grid, centerOf(area))).toBe(true);
    }
  });
});
