// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { AreaPlacement } from "./anchors";
import { type BuildingRole, footprintFor } from "./buildings";
import { FixtureType } from "./fixtures";
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
// Was 1, which put a garden's fence hard against its building's wall. Three
// leaves a tile to walk down between the two, which is what makes the plot
// read as a plot rather than as an extension of the house.
const GARDEN_GAP = 3;
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
  /**
   * Whether market stalls stand in front of it.
   *
   * Only the store. It is drawn with the barn sprite — a good big building,
   * and not obviously a place that sells anything — so what marks it out is
   * what is set up outside it, which is how a village shop announces itself
   * in the world too.
   */
  stalls?: boolean;
  // Whether that NPC is found inside the building rather than around it.
  // The shopkeeper and the teacher are: a shop and a school are somewhere you
  // go in to, and one who wandered the square was somewhere you had to find
  // first.
  npcIndoors?: boolean;
  /**
   * Somebody who is only ever found *inside*, alongside whoever the building
   * already has outside it.
   *
   * The post office is the first building with two people: the postal worker
   * walks the square, and the geometry teacher is up the tower with the map
   * on the wall. A second `npcId` would not do — that one is the person the
   * building is *for*, and it decides where they live and wander.
   */
  indoorNpcId?: string;
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
    // The tower is a study as well as a post office, and the geometry
    // teacher is in it. He is where the map on the wall is, which is the
    // one thing in the village that was already about distances.
    indoorNpcId: "geometer",
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
    stalls: true,
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
  /** Where the player starts: in their own beds, inside their own fence. */
  playerSpawn: GridPoint;
  /**
   * Their front door, and the world generator's route anchor.
   *
   * The two are separate because the spawn is now *inside* a fenced plot,
   * and the connectivity pass carves its routes by removing whatever stands
   * in the way. Starting it in the garden had it punch straight out through
   * the fence on its way to the first story area — which is how the gate
   * disappeared the first time this was drawn.
   */
  playerDoorstep: GridPoint;
}

/**
 * Where a shop's stalls stand: the row in front of it, at either end.
 *
 * The ends rather than the middle, because the door is in the middle. Two
 * rather than a row of them: a line of stalls across the whole frontage
 * reads as a market square, and this is a shop with a couple of stalls
 * outside it.
 */
export function stallCells(
  topLeft: GridPoint,
  width: number,
  height: number,
): readonly GridPoint[] {
  const row = topLeft.row + height;
  return [
    { col: topLeft.col, row },
    { col: topLeft.col + width - 1, row },
  ];
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

function carveRect(
  grid: WorldGrid,
  topLeft: GridPoint,
  width: number,
  height: number,
  terrain: TerrainType = TerrainType.Dirt,
): void {
  for (let row = topLeft.row; row < topLeft.row + height; row++) {
    for (let col = topLeft.col; col < topLeft.col + width; col++) {
      if (grid.inBounds(col, row)) grid.setTerrain(col, row, terrain);
    }
  }
}

/**
 * Where a garden's fence stands: the ring of cells one tile outside its beds.
 *
 * Outside rather than around the outermost row of beds, because every cell
 * of a garden is meant to be plantable — a fence standing on the beds would
 * quietly cost the player the row it sat on.
 */
export function gardenFenceRing(
  topLeft: GridPoint,
  width: number,
  height: number,
): readonly GridPoint[] {
  const left = topLeft.col - 1;
  const right = topLeft.col + width;
  const top = topLeft.row - 1;
  const bottom = topLeft.row + height;
  const ring: GridPoint[] = [];
  for (let col = left; col <= right; col++) {
    ring.push({ col, row: top });
    ring.push({ col, row: bottom });
  }
  for (let row = top + 1; row < bottom; row++) {
    ring.push({ col: left, row });
    ring.push({ col: right, row });
  }
  return ring;
}

/**
 * Which cell of the ring is the way in: the one nearest the village square,
 * never a corner.
 *
 * Nearest the square because that is where the player is coming from, and
 * never a corner because a gate in a corner opens onto the diagonal, which
 * is the one direction nobody here can walk.
 */
export function gardenGate(ring: readonly GridPoint[], towards: GridPoint): GridPoint {
  const cols = ring.map((cell) => cell.col);
  const rows = ring.map((cell) => cell.row);
  const left = Math.min(...cols);
  const right = Math.max(...cols);
  const top = Math.min(...rows);
  const bottom = Math.max(...rows);
  const isCorner = (cell: GridPoint) =>
    (cell.col === left || cell.col === right) && (cell.row === top || cell.row === bottom);
  const distance = (cell: GridPoint) =>
    (cell.col - towards.col) ** 2 + (cell.row - towards.row) ** 2;
  const candidates = ring.filter((cell) => !isCorner(cell));
  return candidates.reduce((best, cell) => (distance(cell) < distance(best) ? cell : best));
}

/**
 * Four lamp posts, one at each corner of the square.
 *
 * The village had no light of its own: night fell and the only thing lit was
 * whatever the player happened to be carrying. Corners rather than edges
 * because the paths leave the square along its edges, and a lamp post is a
 * solid thing — one dropped on a one-tile spoke would wall a house off.
 * Checked anyway before each is placed, since "the corners are clear" is a
 * property of today's layout rather than a law of it.
 */
function lightTheSquare(grid: WorldGrid, center: GridPoint, keepClear: readonly GridPoint[]): void {
  const reach = SQUARE_RADIUS - 1;
  for (const dCol of [-reach, reach]) {
    for (const dRow of [-reach, reach]) {
      const col = center.col + dCol;
      const row = center.row + dRow;
      if (!grid.inBounds(col, row) || !grid.isPassable(col, row)) continue;
      if (grid.getObjectAt(col, row)) continue;
      if (keepClear.some((cell) => cell.col === col && cell.row === row)) continue;
      grid.placeObject({
        id: `square-lamp-${col}-${row}`,
        type: FixtureType.Lamp,
        col,
        row,
        width: 1,
        height: 1,
        blocksMovement: true,
        anchorCol: col,
        anchorRow: row,
      });
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
  const squareTopLeft = topLeftFor(center, squareSize, squareSize);
  carveRect(grid, squareTopLeft, squareSize, squareSize);

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
  let playerDoorstep: GridPoint | undefined;

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

    if (spec.stalls) {
      for (const at of stallCells(buildingTopLeft, buildingWidth, buildingHeight)) {
        // Only where the ground is already clear. A stall blocks its cell, so
        // one dropped onto the path the square carves to this door would wall
        // the shop off — and a shop you cannot walk into is a worse outcome
        // than a shop with one stall in front of it instead of two.
        if (!grid.isPassable(at.col, at.row)) continue;
        grid.placeObject({
          id: `${spec.id}-stall-${at.col}-${at.row}`,
          type: FixtureType.Stall,
          col: at.col,
          row: at.row,
          width: 1,
          height: 1,
          blocksMovement: true,
          anchorCol: at.col,
          anchorRow: at.row,
        });
      }
    }

    if (spec.garden) {
      const gardenRadialHalf = Math.max(spec.garden.width, spec.garden.height) / 2;
      const gardenDistance =
        RING_RADIUS + Math.max(buildingWidth, buildingHeight) / 2 + GARDEN_GAP + gardenRadialHalf;
      const gardenCenter = alongDirection(center, spec.direction, gardenDistance);
      const gardenTopLeft = topLeftFor(gardenCenter, spec.garden.width, spec.garden.height);
      carveRect(grid, gardenTopLeft, spec.garden.width, spec.garden.height);
      // The ground the fence stands on, carved too, so the enclosure reads as
      // one plot — and so nothing scatters scenery into the fence line, which
      // only ever lands on the terrain it grows from.
      carveRect(
        grid,
        { col: gardenTopLeft.col - 1, row: gardenTopLeft.row - 1 },
        spec.garden.width + 2,
        spec.garden.height + 2,
      );

      const ring = gardenFenceRing(gardenTopLeft, spec.garden.width, spec.garden.height);
      const gate = gardenGate(ring, center);
      const left = gardenTopLeft.col - 1;
      const right = gardenTopLeft.col + spec.garden.width;
      // A way up to it: the gate faces the square, and what lies between is
      // whatever the world put there.
      carvePath(grid, gate, buildingCenter);
      for (const cell of ring) {
        const isGate = cell.col === gate.col && cell.row === gate.row;
        // The sides run away from the camera and the top and bottom run
        // across it, which is two different pictures of the same fence. The
        // corners belong to the top and bottom, because that is the run whose
        // posts the sides line up under.
        // Which run a cell belongs to, gate or not: the sides are the two
        // columns, minus the corners, which belong to the top and bottom —
        // that is the run whose posts the sides line up under.
        const onSide =
          (cell.col === left || cell.col === right) &&
          cell.row !== gardenTopLeft.row - 1 &&
          cell.row !== gardenTopLeft.row + spec.garden.height;
        const type = isGate
          ? onSide
            ? FixtureType.GateSide
            : FixtureType.Gate
          : onSide
            ? FixtureType.FenceSide
            : FixtureType.Fence;
        grid.placeObject({
          id: `${spec.id}-${type}-${cell.col}-${cell.row}`,
          type,
          col: cell.col,
          row: cell.row,
          width: 1,
          height: 1,
          // The gate is the one cell of the ring you can walk through, which
          // is why it is drawn standing open rather than shut.
          blocksMovement: !isGate,
          anchorCol: cell.col,
          anchorRow: cell.row,
          // The right-hand side is the left-hand sprite mirrored — the gate
          // in it as much as the fence, or its leaf would swing out of the
          // garden instead of into it.
          flip: onSide && cell.col === right,
        });
      }
      // Standing in their own beds, inside their own fence: the first thing
      // the game is about is the thing the player is stood in.
      if (spec.id === "player-house")
        playerSpawn = { col: gardenCenter.col, row: gardenCenter.row };
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
    // The indoor one, if the building has somebody as well as its own. Home
    // is the doorstep for both, which is never used for an indoor NPC — they
    // are spawned into the room they are found in and thrown away with it —
    // but a spec with nowhere to live would be a spec every other pass has
    // to special-case.
    if (spec.indoorNpcId) {
      npcs.push({
        id: spec.indoorNpcId,
        homeBuildingId: spec.id,
        home: doorstep,
        indoors: true,
      });
    }
    // The doorstep is the spawn's fallback too: a player house without a
    // garden would otherwise have nowhere to put its owner.
    if (spec.id === "player-house") {
      playerDoorstep = doorstep;
      playerSpawn ??= doorstep;
    }
  }

  if (!playerSpawn || !playerDoorstep) throw new Error('BUILDINGS is missing "player-house"');

  // The paving goes down last, over the ends of the roads rather than under
  // them: every spoke is carved outward from the middle of the square, so
  // paving first left dirt tracks scored across it. A village lays stone
  // where it gathers and wears a path where it walks — but the gathering
  // place is one surface, not a stone floor with ruts in it.
  carveRect(grid, squareTopLeft, squareSize, squareSize, TerrainType.Cobble);

  // After the buildings, so it knows which cells are doorsteps: those are
  // where the villagers stand at night, and a lamp post dropped on one is a
  // villager with nowhere to go home to.
  lightTheSquare(grid, center, [playerDoorstep, ...npcs.map((npc) => npc.home)]);

  return { well, buildings, npcs, playerSpawn, playerDoorstep };
}
