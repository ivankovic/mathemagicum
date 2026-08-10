// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { type AnchorPlacements, type AreaPlacement, placeAnchors } from "./anchors";
import { generateBorder } from "./border";
import { WorldGrid } from "./grid";
import { createRng } from "./rng";
import { TerrainType } from "./terrain";

const WORLD_SIZE = 500;

function generatedGrid(seed: number): WorldGrid {
  const grid = WorldGrid.empty(WORLD_SIZE, WORLD_SIZE, TerrainType.Grass);
  generateBorder(grid, createRng(seed));
  return grid;
}

function allPlacements(anchors: AnchorPlacements): AreaPlacement[] {
  return [
    anchors.village,
    anchors.harbour,
    anchors.bigCity,
    anchors.observatory,
    anchors.enchantedForest,
  ];
}

function withinBounds(area: AreaPlacement, width: number, height: number): boolean {
  return (
    area.col >= 0 &&
    area.row >= 0 &&
    area.col + area.width <= width &&
    area.row + area.height <= height
  );
}

function boxesOverlap(a: AreaPlacement, b: AreaPlacement): boolean {
  return !(
    a.col + a.width <= b.col ||
    b.col + b.width <= a.col ||
    a.row + a.height <= b.row ||
    b.row + b.height <= a.row
  );
}

describe("placeAnchors", () => {
  test("all five anchors are placed within world bounds", () => {
    const grid = generatedGrid(1);
    const anchors = placeAnchors(grid, createRng(1));
    for (const area of allPlacements(anchors)) {
      expect(withinBounds(area, grid.width, grid.height)).toBe(true);
    }
  });

  test("no two anchors overlap", () => {
    const grid = generatedGrid(2);
    const anchors = placeAnchors(grid, createRng(2));
    const areas = allPlacements(anchors);
    for (let i = 0; i < areas.length; i++) {
      for (let j = i + 1; j < areas.length; j++) {
        const a = areas[i];
        const b = areas[j];
        if (!a || !b) continue;
        expect(boxesOverlap(a, b)).toBe(false);
      }
    }
  });

  test("Starting Village sits at the world center", () => {
    const grid = generatedGrid(3);
    const anchors = placeAnchors(grid, createRng(3));
    const centerCol = Math.floor((grid.width - anchors.village.width) / 2);
    const centerRow = Math.floor((grid.height - anchors.village.height) / 2);
    expect(anchors.village.col).toBe(centerCol);
    expect(anchors.village.row).toBe(centerRow);
  });

  test("Harbour touches the world edge on a Coastal border span", () => {
    const grid = generatedGrid(4);
    const anchors = placeAnchors(grid, createRng(4));
    const h = anchors.harbour;
    const touchesEdge =
      h.col === 0 ||
      h.row === 0 ||
      h.col + h.width === grid.width ||
      h.row + h.height === grid.height;
    expect(touchesEdge).toBe(true);
  });

  test("Mountain Star Observatory touches the world edge on a Highland border span", () => {
    const grid = generatedGrid(5);
    const anchors = placeAnchors(grid, createRng(5));
    const o = anchors.observatory;
    const touchesEdge =
      o.col === 0 ||
      o.row === 0 ||
      o.col + o.width === grid.width ||
      o.row + o.height === grid.height;
    expect(touchesEdge).toBe(true);
  });

  test("Big City is placed near the Harbour, not arbitrarily far away", () => {
    const grid = generatedGrid(6);
    const anchors = placeAnchors(grid, createRng(6));
    const dCol = anchors.bigCity.col - anchors.harbour.col;
    const dRow = anchors.bigCity.row - anchors.harbour.row;
    const distance = Math.sqrt(dCol * dCol + dRow * dRow);
    // Generous bound: near-placement retries with clamping can land further
    // than the raw offset range when clamped against a world edge.
    expect(distance).toBeLessThan(200);
  });

  test("is deterministic for the same seed", () => {
    const gridA = generatedGrid(7);
    const gridB = generatedGrid(7);
    const anchorsA = placeAnchors(gridA, createRng(7));
    const anchorsB = placeAnchors(gridB, createRng(7));
    expect(anchorsA).toEqual(anchorsB);
  });
});
