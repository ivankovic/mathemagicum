// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { AreaPlacement } from "./anchors";
import type { WorldGrid } from "./grid";
import type { GridPoint } from "./iso";
import type { PlacedObject } from "./objects";
import { TerrainType } from "./terrain";

// Hub-and-spoke layout for the Starting Village's interior — see
// docs/WORLD_GENERATION.md's "Starting Village interior" section. The
// square (with the well at its centre) sits at the anchor box's centre;
// the 7 buildings ring it at a fixed radius along 7 of the 8 compass
// directions (skipping NW — no requirement to fill all 8, an asymmetric
// ring reads fine); gardens sit further out along the same direction;
// Dirt paths connect the square to each building.
// How big the Village's own anchor box needs to be to comfortably fit the
// layout below (square + 7 building/garden clusters), with margin. Bigger
// than the other 4 anchors' shared ANCHOR_SIZE (24, see anchors.ts) —
// intentional, since only the Village's interior is actually built yet.
export const VILLAGE_SIZE = 48;
const SQUARE_RADIUS = 4; // 9x9 plaza
const BUILDING_SIZE = 4;
const RING_RADIUS = 9;
const GARDEN_GAP = 1;
// NPCs "retreat" to a tile between the square and their building — on the
// path, just outside the building's own footprint. Needs more than 1 tile
// of clearance: rounding a diagonal direction's (col, row) independently
// can round both up together, landing back on the footprint's corner even
// when the true Euclidean distance already cleared it.
const NPC_HOME_CLEARANCE = 2;

interface Direction {
  dCol: number;
  dRow: number;
}

const DIRECTIONS: Record<string, Direction> = {
  N: { dCol: 0, dRow: -1 },
  NE: { dCol: 1, dRow: -1 },
  E: { dCol: 1, dRow: 0 },
  SE: { dCol: 1, dRow: 1 },
  S: { dCol: 0, dRow: 1 },
  SW: { dCol: -1, dRow: 1 },
  W: { dCol: -1, dRow: 0 },
};

interface GardenSpec {
  width: number;
  height: number;
}

interface BuildingSpec {
  id: string;
  type: "house" | "school" | "post-office" | "store";
  direction: Direction;
  npcId: string | null;
  garden: GardenSpec | null;
}

// Player's house has no NPC (see docs/WORLD_GENERATION.md — "A building is
// two linked story objects, not one"). Its garden is deliberately the
// biggest, per the original design request ("a big garden").
const BUILDINGS: readonly BuildingSpec[] = [
  {
    id: "player-house",
    type: "house",
    direction: DIRECTIONS.N as Direction,
    npcId: null,
    garden: { width: 7, height: 5 },
  },
  {
    id: "school",
    type: "school",
    direction: DIRECTIONS.NE as Direction,
    npcId: "teacher",
    garden: null,
  },
  {
    id: "villager-house-1",
    type: "house",
    direction: DIRECTIONS.E as Direction,
    npcId: "villager-1",
    garden: { width: 4, height: 4 },
  },
  {
    id: "post-office",
    type: "post-office",
    direction: DIRECTIONS.SE as Direction,
    npcId: "postal-worker",
    garden: null,
  },
  {
    id: "villager-house-2",
    type: "house",
    direction: DIRECTIONS.S as Direction,
    npcId: "villager-2",
    garden: { width: 4, height: 4 },
  },
  {
    id: "store",
    type: "store",
    direction: DIRECTIONS.SW as Direction,
    npcId: "shopkeeper",
    garden: null,
  },
  {
    id: "villager-house-3",
    type: "house",
    direction: DIRECTIONS.W as Direction,
    npcId: "villager-3",
    garden: { width: 4, height: 4 },
  },
];

export interface VillageNpcSpec {
  id: string;
  homeBuildingId: string;
  home: GridPoint;
}

export interface VillageLayout {
  well: PlacedObject;
  buildings: readonly PlacedObject[];
  npcs: readonly VillageNpcSpec[];
  playerSpawn: GridPoint;
}

function round(point: { x: number; y: number }): GridPoint {
  return { col: Math.round(point.x), row: Math.round(point.y) };
}

function alongDirection(center: GridPoint, direction: Direction, distance: number): GridPoint {
  const mag = Math.hypot(direction.dCol, direction.dRow);
  return round({
    x: center.col + (direction.dCol / mag) * distance,
    y: center.row + (direction.dRow / mag) * distance,
  });
}

// Distance from an axis-aligned square's centre to its own boundary along a
// given direction — h / max(|ux|, |uy|) for half-extent h and unit vector
// (ux, uy). For a cardinal direction this is just h (2); for a diagonal one
// the boundary is further away (a box's corner, not its edge midpoint), so
// using a flat BUILDING_SIZE/2 offset for every direction was placing
// diagonal NPC homes inside their own building's footprint.
function boxHalfExtentAlong(direction: Direction, halfSize: number): number {
  const mag = Math.hypot(direction.dCol, direction.dRow);
  const ux = Math.abs(direction.dCol) / mag;
  const uy = Math.abs(direction.dRow) / mag;
  return halfSize / Math.max(ux, uy);
}

function carveRect(grid: WorldGrid, topLeft: GridPoint, width: number, height: number): void {
  for (let row = topLeft.row; row < topLeft.row + height; row++) {
    for (let col = topLeft.col; col < topLeft.col + width; col++) {
      if (grid.inBounds(col, row)) grid.setTerrain(col, row, TerrainType.Dirt);
    }
  }
}

// Bresenham's line, carving Dirt as it goes — the spoke of the hub-and-
// spoke path network from the square out to one building.
function carvePath(grid: WorldGrid, from: GridPoint, to: GridPoint): void {
  let col = from.col;
  let row = from.row;
  const dCol = Math.abs(to.col - from.col);
  const dRow = -Math.abs(to.row - from.row);
  const stepCol = from.col < to.col ? 1 : -1;
  const stepRow = from.row < to.row ? 1 : -1;
  let err = dCol + dRow;

  for (;;) {
    if (grid.inBounds(col, row)) grid.setTerrain(col, row, TerrainType.Dirt);
    if (col === to.col && row === to.row) break;
    const e2 = 2 * err;
    if (e2 >= dRow) {
      err += dRow;
      col += stepCol;
    }
    if (e2 <= dCol) {
      err += dCol;
      row += stepRow;
    }
  }
}

function topLeftFor(center: GridPoint, width: number, height: number): GridPoint {
  return {
    col: center.col - Math.floor(width / 2),
    row: center.row - Math.floor(height / 2),
  };
}

export function layoutVillage(grid: WorldGrid, village: AreaPlacement): VillageLayout {
  const center: GridPoint = {
    col: village.col + Math.floor(village.width / 2),
    row: village.row + Math.floor(village.height / 2),
  };

  const squareSize = SQUARE_RADIUS * 2 + 1;
  carveRect(grid, topLeftFor(center, squareSize, squareSize), squareSize, squareSize);

  const well: PlacedObject = {
    id: "well",
    type: "well",
    col: center.col,
    row: center.row,
    width: 1,
    height: 1,
    blocksMovement: true,
  };
  grid.placeObject(well);

  const buildings: PlacedObject[] = [];
  const npcs: VillageNpcSpec[] = [];
  let playerSpawn: GridPoint | undefined;

  for (const spec of BUILDINGS) {
    const buildingCenter = alongDirection(center, spec.direction, RING_RADIUS);
    carvePath(grid, center, buildingCenter);

    const building: PlacedObject = {
      id: spec.id,
      type: spec.type,
      ...topLeftFor(buildingCenter, BUILDING_SIZE, BUILDING_SIZE),
      width: BUILDING_SIZE,
      height: BUILDING_SIZE,
      blocksMovement: true,
    };
    grid.placeObject(building);
    buildings.push(building);

    if (spec.garden) {
      const gardenRadialHalf = Math.max(spec.garden.width, spec.garden.height) / 2;
      const gardenDistance = RING_RADIUS + BUILDING_SIZE / 2 + GARDEN_GAP + gardenRadialHalf;
      const gardenCenter = alongDirection(center, spec.direction, gardenDistance);
      carveRect(
        grid,
        topLeftFor(gardenCenter, spec.garden.width, spec.garden.height),
        spec.garden.width,
        spec.garden.height,
      );
    }

    // The doorstep: a tile between the square and the building, just
    // outside its footprint, on the path — where an NPC retreats to at
    // night, and where the player starts if this is their own house.
    const nearEdge = boxHalfExtentAlong(spec.direction, BUILDING_SIZE / 2);
    const doorstep = alongDirection(
      center,
      spec.direction,
      RING_RADIUS - nearEdge - NPC_HOME_CLEARANCE,
    );

    if (spec.npcId) npcs.push({ id: spec.npcId, homeBuildingId: spec.id, home: doorstep });
    if (spec.id === "player-house") playerSpawn = doorstep;
  }

  if (!playerSpawn) throw new Error('BUILDINGS is missing "player-house"');

  return { well, buildings, npcs, playerSpawn };
}
