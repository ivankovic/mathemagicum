// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { type AnchorPlacements, type AreaPlacement, placeAnchors } from "./anchors";
import { placeEdgeBarriers } from "./barriers";
import { ensureConnectivity } from "./connectivity";
import { type HighCorner, elevationAt, pickHighCorner } from "./elevation";
import { WorldGrid } from "./grid";
import { createRng, randInt } from "./rng";
import { TerrainType } from "./terrain";
import { fillFromElevation, sealFarEdges } from "./terrainFill";
import type { GridPoint } from "./topdown";
import { type VillageLayout, layoutVillage } from "./villageLayout";

export interface GeneratedWorld {
  grid: WorldGrid;
  anchors: AnchorPlacements;
  playerStart: GridPoint;
  village: VillageLayout;
  // Which corner the world slopes down from. Everything else about the
  // layout follows from it, so it is worth handing back rather than making
  // callers infer it from the terrain.
  highCorner: HighCorner;
}

function centerOf(area: AreaPlacement): GridPoint {
  return {
    col: area.col + Math.floor(area.width / 2),
    row: area.row + Math.floor(area.height / 2),
  };
}

// Runs the full pipeline from docs/WORLD_GENERATION.md, steps 0-7 for the
// Village specifically (its interior is built — see villageLayout.ts) and
// steps 0-6 for the other 4 anchors (their interiors — step 7 — and
// stitching — step 8 — aren't built yet; they depend on story-object
// content that doesn't exist). One seed deterministically produces one
// world.
export function generateWorld(width: number, height: number, seed: number): GeneratedWorld {
  const rng = createRng(seed);
  const grid = WorldGrid.empty(width, height, TerrainType.Grass);

  // The whole map hangs off this one choice: which corner is the top of the
  // slope. Drawn first so every later decision can be made against it.
  const highCorner = pickHighCorner(rng);
  const fieldSeed = randInt(rng, 0, 0x7ffffffe);
  const elevation = (col: number, row: number) =>
    elevationAt(col, row, width, height, highCorner, fieldSeed);

  // Anchors are placed against elevation rather than against painted
  // terrain, so this needs nothing on the grid yet — which is what lets the
  // village carve its paths before the fill runs and skips over them.
  const anchors = placeAnchors(width, height, elevation, rng);
  const reservedBoxes = [
    anchors.village,
    anchors.harbour,
    anchors.bigCity,
    anchors.observatory,
    anchors.enchantedForest,
  ];

  // Before the fill, which skips every reserved box outright, so whatever
  // the layout carves (the square, gardens, paths) is exactly what survives
  // — and before ensureConnectivity, since the Village's centre tile is the
  // well (impassable), not a safe start point.
  const village = layoutVillage(grid, anchors.village);

  fillFromElevation(grid, highCorner, fieldSeed, reservedBoxes);
  sealFarEdges(grid, highCorner);
  // Before the connectivity check, so it sees the walled rim and reports
  // honestly. Carving cannot clear an object, so the barrier is confined to
  // the rim where it has nothing to cut off.
  placeEdgeBarriers(grid, highCorner, reservedBoxes);

  ensureConnectivity(grid, village.playerSpawn, [
    centerOf(anchors.harbour),
    centerOf(anchors.bigCity),
    centerOf(anchors.observatory),
    centerOf(anchors.enchantedForest),
  ]);

  return { grid, anchors, playerStart: village.playerSpawn, village, highCorner };
}
