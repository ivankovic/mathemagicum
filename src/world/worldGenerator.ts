// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { type AnchorPlacements, type AreaPlacement, placeAnchors } from "./anchors";
import { generateBorder } from "./border";
import { ensureConnectivity } from "./connectivity";
import { WorldGrid } from "./grid";
import { fillTerrainFromHabitats, growHabitats } from "./habitatGrowth";
import type { GridPoint } from "./iso";
import { createRng } from "./rng";
import { TerrainType } from "./terrain";

export interface GeneratedWorld {
  grid: WorldGrid;
  anchors: AnchorPlacements;
  playerStart: GridPoint;
}

function centerOf(area: AreaPlacement): GridPoint {
  return {
    col: area.col + Math.floor(area.width / 2),
    row: area.row + Math.floor(area.height / 2),
  };
}

// Just past the box's right edge, clamped to world bounds — arbitrary but
// deterministic "outside, adjacent" point. growHabitats treats Enchanted
// Forest's own reserved interior like every other anchor's (untouched), so
// the seed has to sit outside the box for Woodland to actually grow.
function forestSeedPoint(
  forest: AreaPlacement,
  worldWidth: number,
  worldHeight: number,
): GridPoint {
  return {
    col: Math.min(worldWidth - 1, forest.col + forest.width + 1),
    row: Math.min(worldHeight - 1, forest.row + Math.floor(forest.height / 2)),
  };
}

// Runs the full pipeline from docs/WORLD_GENERATION.md, steps 0-6 (steps
// 7-8 — story area interiors and stitching — are deliberately not built
// yet; they depend on story-object content that doesn't exist). One seed
// deterministically produces one world.
export function generateWorld(width: number, height: number, seed: number): GeneratedWorld {
  const rng = createRng(seed);
  const grid = WorldGrid.empty(width, height, TerrainType.Grass);

  generateBorder(grid, rng);
  const anchors = placeAnchors(grid, rng);
  const reservedBoxes = [
    anchors.village,
    anchors.harbour,
    anchors.bigCity,
    anchors.observatory,
    anchors.enchantedForest,
  ];

  const forestSeed = forestSeedPoint(anchors.enchantedForest, grid.width, grid.height);
  growHabitats(grid, reservedBoxes, forestSeed, rng);
  fillTerrainFromHabitats(grid, reservedBoxes, rng);

  const villageCenter = centerOf(anchors.village);
  ensureConnectivity(grid, villageCenter, [
    centerOf(anchors.harbour),
    centerOf(anchors.bigCity),
    centerOf(anchors.observatory),
    centerOf(anchors.enchantedForest),
  ]);

  return { grid, anchors, playerStart: villageCenter };
}
