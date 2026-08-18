// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { AreaPlacement } from "./anchors";
import { type BuildingRole, footprintFor } from "./buildings";
import type { WorldGrid } from "./grid";
import type { PlacedObject } from "./objects";
import { TerrainType } from "./terrain";
import type { GridPoint } from "./topdown";

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
// Building footprints are per-type now (see buildings.ts) — they come from
// the art, which has a different shape per building. RING_RADIUS is measured
// to a building's centre, so it stays uniform regardless.
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
  type: BuildingRole;
  direction: Direction;
  npcId: string | null;
  garden: GardenSpec | null;
  // Whether that NPC is found inside the building rather than around it.
  // The shopkeeper and the teacher are: a shop and a school are somewhere you
  // go in to, and one who wandered the square was somewhere you had to find
  // first.
  npcIndoors?: boolean;
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
    // Like the shopkeeper, and for the same reason: a teacher you have to
    // find in the square is a teacher you meet by accident. She is where a
    // child would look for her, and the school has a reason to exist.
    npcIndoors: true,
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
    npcIndoors: true,
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
  /**
   * Found inside their building rather than walking about outside it.
   *
   * An indoor NPC has no wander and no retreat: they are simply there, on a
   * cell of the room, whenever the player walks in. `home` is still their
   * building's doorstep, because that is what the layout knows — where they
   * stand *inside* depends on the room's furniture and is the renderer's
   * business.
   */
  indoors: boolean;
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
// using a flat half-footprint offset for every direction was placing
// diagonal NPC homes inside their own building's footprint.
function boxHalfExtentAlong(direction: Direction, halfWidth: number, halfHeight: number): number {
  const mag = Math.hypot(direction.dCol, direction.dRow);
  const ux = Math.abs(direction.dCol) / mag;
  const uy = Math.abs(direction.dRow) / mag;
  // Whichever axis the ray leaves the box through first. A cardinal
  // direction zeroes one component, so that axis never bounds the exit.
  return Math.min(
    ux > 0 ? halfWidth / ux : Number.POSITIVE_INFINITY,
    uy > 0 ? halfHeight / uy : Number.POSITIVE_INFINITY,
  );
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

// The footprint cell closest to `target` — clamping is the closest point
// in an axis-aligned box to an external point, so this needs no per-
// direction case logic (see PlacedObject.anchorCol's docstring for why
// this is the cell a building's sprite gets anchored to: the one facing
// the village centre, whichever of the 7 ring directions it's in).
function nearestCellTo(
  topLeft: GridPoint,
  width: number,
  height: number,
  target: GridPoint,
): GridPoint {
  return {
    col: Math.min(Math.max(target.col, topLeft.col), topLeft.col + width - 1),
    row: Math.min(Math.max(target.row, topLeft.row), topLeft.row + height - 1),
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
    anchorCol: center.col,
    anchorRow: center.row,
  };
  grid.placeObject(well);

  const buildings: PlacedObject[] = [];
  const npcs: VillageNpcSpec[] = [];
  let playerSpawn: GridPoint | undefined;

  for (const spec of BUILDINGS) {
    const buildingCenter = alongDirection(center, spec.direction, RING_RADIUS);
    carvePath(grid, center, buildingCenter);

    const { width: buildingWidth, height: buildingHeight } = footprintFor(spec.type);
    const buildingTopLeft = topLeftFor(buildingCenter, buildingWidth, buildingHeight);
    const anchor = nearestCellTo(buildingTopLeft, buildingWidth, buildingHeight, center);
    const building: PlacedObject = {
      id: spec.id,
      type: spec.type,
      ...buildingTopLeft,
      width: buildingWidth,
      height: buildingHeight,
      blocksMovement: true,
      anchorCol: anchor.col,
      anchorRow: anchor.row,
    };
    grid.placeObject(building);
    buildings.push(building);

    if (spec.garden) {
      const gardenRadialHalf = Math.max(spec.garden.width, spec.garden.height) / 2;
      const gardenDistance =
        RING_RADIUS + Math.max(buildingWidth, buildingHeight) / 2 + GARDEN_GAP + gardenRadialHalf;
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
    const nearEdge = boxHalfExtentAlong(spec.direction, buildingWidth / 2, buildingHeight / 2);
    const doorstep = alongDirection(
      center,
      spec.direction,
      RING_RADIUS - nearEdge - NPC_HOME_CLEARANCE,
    );

    if (spec.npcId) {
      npcs.push({
        id: spec.npcId,
        homeBuildingId: spec.id,
        home: doorstep,
        indoors: spec.npcIndoors === true,
      });
    }
    if (spec.id === "player-house") playerSpawn = doorstep;
  }

  if (!playerSpawn) throw new Error('BUILDINGS is missing "player-house"');

  return { well, buildings, npcs, playerSpawn };
}
