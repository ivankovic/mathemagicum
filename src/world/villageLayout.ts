// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { AreaPlacement } from "./anchors";
import { type BuildingRole, footprintFor } from "./buildings";
import { FixtureType } from "./fixtures";
import type { WorldGrid } from "./grid";
import type { PlacedObject } from "./objects";
import { createRng, randInt } from "./rng";
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

export interface Direction {
  dCol: number;
  dRow: number;
}

export const DIRECTIONS: Record<string, Direction> = {
  N: { dCol: 0, dRow: -1 },
  NE: { dCol: 1, dRow: -1 },
  E: { dCol: 1, dRow: 0 },
  SE: { dCol: 1, dRow: 1 },
  S: { dCol: 0, dRow: 1 },
  SW: { dCol: -1, dRow: 1 },
  W: { dCol: -1, dRow: 0 },
};

/**
 * The plot behind a child's house: seven across the frontage, five deep.
 *
 * One size for all four of them. House zero had a seven-by-five "per the
 * original design request (a big garden)" and the other three had a
 * four-by-four, which was fine while a world belonged to one child and is a
 * child getting half their sibling's garden the moment four of them share a
 * tablet.
 *
 * **Turned to face the square.** The long side always runs *across* the way
 * out of the village, so a plot to the north is seven wide and five deep and
 * one to the east is five wide and seven deep. Rotated rather than reshaped:
 * every child gets the same thirty-five squares to plant, and they all meet
 * their plot the same way round — walking in at the middle of a seven-tile
 * frontage. All four houses sit on cardinal directions, which is what makes
 * "across" a single axis rather than a diagonal to round off.
 */
const PLOT_ACROSS = 7;
const PLOT_DEEP = 5;

export function plotFor(direction: Direction): { width: number; height: number } {
  const radial = Math.abs(direction.dCol) > Math.abs(direction.dRow);
  return radial
    ? { width: PLOT_DEEP, height: PLOT_ACROSS }
    : { width: PLOT_ACROSS, height: PLOT_DEEP };
}

interface BuildingSpec {
  id: string;
  type: BuildingRole;
  direction: Direction;
  npcId: string | null;
  /** Whether it has a plot behind it. Its size comes from `plotFor`. */
  garden: boolean;
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
    garden: true,
  },
  {
    id: "school",
    type: "school",
    direction: DIRECTIONS.NE as Direction,
    npcId: "teacher",
    garden: false,
    // Like the shopkeeper, and for the same reason: a teacher you have to
    // find in the square is a teacher you meet by accident. She is where a
    // child would look for her, and the school has a reason to exist.
    npcIndoors: true,
  },
  {
    id: "villager-house-1",
    type: "house",
    direction: DIRECTIONS.E as Direction,
    // Nobody's but a child's. The villagers used to live in these three and
    // moved out when it became clear four children share a tablet and three
    // of them were being housed in somebody else's cottage. See
    // `scatterVillagerHomes`.
    npcId: null,
    garden: true,
  },
  {
    id: "post-office",
    type: "post-office",
    direction: DIRECTIONS.SE as Direction,
    npcId: "postal-worker",
    garden: false,
    // The tower is a study as well as a post office, and the geometry
    // teacher is in it. He is where the map on the wall is, which is the
    // one thing in the village that was already about distances.
    indoorNpcId: "geometer",
  },
  {
    id: "villager-house-2",
    type: "house",
    direction: DIRECTIONS.S as Direction,
    npcId: null,
    garden: true,
  },
  {
    id: "store",
    type: "store",
    direction: DIRECTIONS.SW as Direction,
    npcId: "shopkeeper",
    garden: false,
    npcIndoors: true,
    stalls: true,
  },
  {
    id: "villager-house-3",
    type: "house",
    direction: DIRECTIONS.W as Direction,
    npcId: null,
    garden: true,
  },
];

/**
 * The houses somebody can live in, in the order profiles are given them.
 *
 * Derived from `BUILDINGS` rather than written out, because a list typed by
 * hand is one that quietly stops matching the day a house is added or the
 * square is rearranged. `Profile.house` is an index into exactly this.
 *
 * The first is the player's own — the one with the big garden, the one the
 * game spawns at, and the one `houseLook` reserves a roof colour for. That
 * ordering is not an accident of the array: it is what makes "house zero" the
 * house the game has always treated as the player's.
 */
export const HOUSE_IDS: readonly string[] = BUILDINGS.filter((spec) => spec.type === "house").map(
  (spec) => spec.id,
);

/** Which building a profile's house number means, or nothing if it is past the end. */
export function houseIdFor(house: number): string | null {
  return HOUSE_IDS[house] ?? null;
}

/** Whether this building is one somebody could live in. */
export function isHouseId(id: string): boolean {
  return HOUSE_IDS.includes(id);
}

/**
 * How many cottages the villagers live in, off the square.
 *
 * Four, one per villager, and none of them on the ring. The ring's four
 * houses belong to the children now — there are four of those too, and a
 * child sent to live in a cottage with somebody else's name on the door is
 * the thing the nameplates made impossible to ignore.
 */
export const VILLAGER_HOME_COUNT = 4;

/** The villagers who live in them. One each, in this order. */
export const VILLAGER_IDS: readonly string[] = Array.from(
  { length: VILLAGER_HOME_COUNT },
  (_, at) => `villager-${at + 1}`,
);

/**
 * Open ground kept round a scattered cottage, on every side.
 *
 * Two, which is what stops them touching and what leaves somewhere to walk
 * between them. It is also the whole of "far enough apart": rather than a
 * distance between centres, every cottage simply insists on its own margin
 * being empty, which is the same rule stated where it can be checked one
 * cell at a time.
 */
const HOME_CLEARANCE = 2;

/** How many places are tried before the village admits it has no room. */
const HOME_TRIES = 600;

export interface VillageNpcSpec {
  id: string;
  /**
   * Which of the named parts this person plays, when their id cannot be it.
   *
   * The village has one shopkeeper and she is called `shopkeeper`, which is
   * both her name and her job. The city has four shops and the harbour has
   * one, and every id in the world has to be unique — so those five are
   * `city-shopkeeper-3` and so on, and this says what they *are*. It decides
   * which sheet they are drawn with and which panel they open.
   *
   * Absent for anybody whose id is already their part.
   */
  role?: string;
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
  /**
   * Where each of the four children's houses puts its owner down.
   *
   * By building id, because a child's house is `Profile.house` and that is an
   * index into `HOUSE_IDS`. The scene picks whichever belongs to whoever is
   * playing — see `GameScene.startFor` — and `playerSpawn` stays as the
   * fallback for a session that has no child in it at all.
   *
   * `inside` is the middle of their own beds where there is a garden, which
   * is where the game has always started; `doorstep` is the tile on the path
   * outside their front door, which is where it starts when there is not.
   */
  homes: Readonly<Record<string, { inside: GridPoint; doorstep: GridPoint }>>;
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
 * How wide the way in is, in tiles.
 *
 * Three, and it was one. A single cell is a target a six-year-old has to aim
 * at: they walk along the fence, arrive next to the gap rather than at it,
 * and press toward a fence panel that looks no different from the way
 * through. The same complaint the buildings' doorways answered with
 * `ENTRANCE_REACH`, and the same answer — except that a doorway can be three
 * cells wide to walk into while staying one cell wide to look at, and a hole
 * in a fence cannot. So the hole is really three wide.
 */
export const GARDEN_ENTRANCE_WIDTH = 3;

/**
 * The run of ring cells that is the way in: a gate, a gap, a gate.
 *
 * Centred on `gardenGate` and lying along its edge, shifted along if that
 * would put an end on a corner. The middle cell has nothing placed on it at
 * all — the two gates are its posts, and what stands between them is the
 * gateway.
 *
 * All three are walked through, not only the middle. Two gateposts round a
 * one-tile gap would be the same target it was before with more timber round
 * it.
 */
export function gardenEntrance(
  ring: readonly GridPoint[],
  towards: GridPoint,
): readonly GridPoint[] {
  const middle = gardenGate(ring, towards);
  const cols = ring.map((cell) => cell.col);
  const rows = ring.map((cell) => cell.row);
  const left = Math.min(...cols);
  const right = Math.max(...cols);
  const top = Math.min(...rows);
  const bottom = Math.max(...rows);
  const isCorner = (cell: GridPoint) =>
    (cell.col === left || cell.col === right) && (cell.row === top || cell.row === bottom);
  // Which of the four runs it is on. A cell can only be on one, because the
  // ones that are on two are the corners and `gardenGate` never returns one.
  const across = middle.row === top || middle.row === bottom;
  const edge = ring
    .filter(
      (cell) => !isCorner(cell) && (across ? cell.row === middle.row : cell.col === middle.col),
    )
    .sort((a, b) => (across ? a.col - b.col : a.row - b.row));
  // Short edges cannot happen with the gardens the village lays out, but a
  // spec somebody shrinks should give a narrower way in rather than reach
  // past the end of its own fence.
  if (edge.length <= GARDEN_ENTRANCE_WIDTH) return edge;
  const at = edge.findIndex((cell) => cell.col === middle.col && cell.row === middle.row);
  const start = Math.min(Math.max(at - 1, 0), edge.length - GARDEN_ENTRANCE_WIDTH);
  return edge.slice(start, start + GARDEN_ENTRANCE_WIDTH);
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

export function layoutVillage(grid: WorldGrid, village: AreaPlacement, seed = 0): VillageLayout {
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
  const homes: Record<string, { inside: GridPoint; doorstep: GridPoint }> = {};
  // Filled while the ring is laid out and read once it is: a garden is
  // placed before the doorstep it belongs to is worked out.
  const gardenMiddles: Record<string, GridPoint> = {};

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
      const plot = plotFor(spec.direction);
      const gardenRadialHalf = Math.max(plot.width, plot.height) / 2;
      const gardenDistance =
        RING_RADIUS + Math.max(buildingWidth, buildingHeight) / 2 + GARDEN_GAP + gardenRadialHalf;
      const gardenCenter = alongDirection(center, spec.direction, gardenDistance);
      const gardenTopLeft = topLeftFor(gardenCenter, plot.width, plot.height);
      carveRect(grid, gardenTopLeft, plot.width, plot.height);
      // The ground the fence stands on, carved too, so the enclosure reads as
      // one plot — and so nothing scatters scenery into the fence line, which
      // only ever lands on the terrain it grows from.
      carveRect(
        grid,
        { col: gardenTopLeft.col - 1, row: gardenTopLeft.row - 1 },
        plot.width + 2,
        plot.height + 2,
      );

      const ring = gardenFenceRing(gardenTopLeft, plot.width, plot.height);
      const entrance = gardenEntrance(ring, center);
      const gate = entrance[Math.floor(entrance.length / 2)] ?? gardenGate(ring, center);
      const left = gardenTopLeft.col - 1;
      const right = gardenTopLeft.col + plot.width;
      const bottomRow = gardenTopLeft.row + plot.height;
      const topRow = gardenTopLeft.row - 1;
      // A way up to it: the entrance faces the square, and what lies between
      // is whatever the world put there. Carved to the middle of the way in,
      // which is the cell with nothing on it.
      carvePath(grid, gate, buildingCenter);
      for (const cell of ring) {
        const inEntrance = entrance.some((at) => at.col === cell.col && at.row === cell.row);
        // The middle of the way in carries nothing at all. The two gates
        // either side of it are its posts, and a third gate between them
        // would be a gate in a gateway.
        if (inEntrance && cell.col === gate.col && cell.row === gate.row) continue;
        const isGate = inEntrance;
        // The sides run away from the camera and the top and bottom run
        // across it, which is two different pictures of the same fence. The
        // corners belong to the top and bottom, because that is the run whose
        // posts the sides line up under.
        const onSideRun = (col: number, row: number) =>
          (col === left || col === right) && row !== topRow && row !== bottomRow;
        const onSide = onSideRun(cell.col, cell.row);
        // The two the side runs come *down* into, which are the only cells
        // where the join does not draw itself. A side run overhangs the cell
        // above it and lands on that panel's post, so the top corners need
        // nothing; below one there is nothing to overhang with, and the
        // panel's post starts a third of a tile down. See `FenceCorner`.
        //
        // Only where something is actually standing above it, which is not
        // every bottom corner any more: the way in is three cells wide and
        // its middle is empty, so a corner under that gap would carry its
        // post up to meet nothing. A gate on a side run counts — its own art
        // runs to the bottom of its cell for exactly this reason.
        const bottomCorner =
          cell.row === bottomRow &&
          (cell.col === left || cell.col === right) &&
          onSideRun(cell.col, cell.row - 1) &&
          !(cell.col === gate.col && cell.row - 1 === gate.row);
        const type = isGate
          ? onSide
            ? // Which end of the way in this is. The leaf hangs off the run
              // it belongs to, and on a side run that run is above one gate
              // and below the other — so unlike every other pair in this
              // fence, mirroring cannot turn one into the other.
              cell.row < gate.row
              ? FixtureType.GateSide
              : FixtureType.GateSideLower
            : FixtureType.Gate
          : onSide
            ? FixtureType.FenceSide
            : bottomCorner
              ? FixtureType.FenceCorner
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
          // garden instead of into it. A bottom corner mirrors for the same
          // reason: its tall post has to stand under the run above it, and on
          // the right that run is against the cell's other edge.
          //
          // And the far gate of a way in that runs across the camera, so the
          // pair open away from each other: the leaf is hinged on the left
          // of its cell, and two unmirrored gates would both fold the same
          // way, which reads as one gate drawn twice rather than as a gap
          // with a gate at each side of it.
          flip:
            ((onSide || bottomCorner) && cell.col === right) ||
            (isGate && !onSide && cell.col > gate.col),
        });
      }
      // Standing in their own beds, inside their own fence: the first thing
      // the game is about is the thing the player is stood in. Recorded for
      // every house rather than only the first, because there are four
      // children and each of them starts in their own.
      if (isHouseId(spec.id)) {
        gardenMiddles[spec.id] = { col: gardenCenter.col, row: gardenCenter.row };
      }
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
    // The doorstep is the spawn's fallback too: a house without a garden
    // would otherwise have nowhere to put its owner.
    if (isHouseId(spec.id)) {
      homes[spec.id] = { inside: gardenMiddles[spec.id] ?? doorstep, doorstep };
    }
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

  // The villagers' own cottages, scattered over whatever green the village
  // has not built on. Last, so every path, plot and fence is already down
  // and counts as ground that is spoken for.
  for (const home of scatterVillagerHomes(grid, village, center, seed)) {
    buildings.push(home.building);
    npcs.push({
      id: home.villagerId,
      homeBuildingId: home.building.id,
      home: home.doorstep,
      indoors: false,
    });
  }

  return { well, buildings, npcs, playerSpawn, playerDoorstep, homes };
}

interface VillagerHome {
  readonly building: PlacedObject;
  readonly villagerId: string;
  readonly doorstep: GridPoint;
}

/**
 * Four cottages for the four villagers, strewn over the village's own green.
 *
 * **On ground the village has not carved.** Everything the layout builds —
 * the square, every path, every garden and the ring its fence stands on —
 * is set to dirt, and nothing else in the box is. So "not dirt, nothing
 * standing on it, and something you could walk on" excludes the plaza, the
 * roads, the plots and the seven buildings in one condition, without this
 * pass having to know what any of them are. The paths it carves as it goes
 * become dirt too, so no cottage lands on the way to another.
 *
 * The box is mostly woodland, which is the point: a cottage in a clearing
 * off the road reads as somebody living *near* the village rather than as an
 * eighth spoke on a wheel that already has seven.
 *
 * **A candidate is rejected if the walk to it crosses anything.** `carvePath`
 * draws a straight line and sets dirt under whatever it passes, which is
 * harmless running radially out of a square and is not harmless at all
 * running diagonally across somebody's fence. Checking the line before
 * carving it is cheaper than routing round things and says the same thing.
 * See `walkOutOfSquare` for why the line starts at the plaza's edge.
 *
 * Throws rather than settling for three. A village one cottage short is a
 * generator bug, not a world worth shipping, and a villager whose home is
 * nowhere is a villager every later pass has to special-case.
 */
function scatterVillagerHomes(
  grid: WorldGrid,
  village: AreaPlacement,
  center: GridPoint,
  seed: number,
): readonly VillagerHome[] {
  const rng = createRng(seed ^ 0x5eed_10c8);
  const { width, height } = footprintFor("house");
  const homes: VillagerHome[] = [];

  for (let tries = 0; tries < HOME_TRIES && homes.length < VILLAGER_HOME_COUNT; tries++) {
    // Anywhere in the box that leaves the cottage and its margin inside it.
    const topLeft = {
      col: randInt(
        rng,
        village.col + HOME_CLEARANCE,
        village.col + village.width - width - HOME_CLEARANCE - 1,
      ),
      row: randInt(
        rng,
        village.row + HOME_CLEARANCE,
        village.row + village.height - height - HOME_CLEARANCE - 1,
      ),
    };
    // The door is the bottom middle of a cottage and the step is the tile
    // below it. Stated as the shape rather than read from a sidecar, which
    // this pass has no access to — `villageLayout.test.ts` checks the two
    // agree against the art that actually ships.
    const doorstep = {
      col: topLeft.col + Math.floor(width / 2),
      row: topLeft.row + height,
    };
    if (!isClearGround(grid, topLeft, width, height, HOME_CLEARANCE)) continue;
    if (!grid.inBounds(doorstep.col, doorstep.row)) continue;
    const roadHead = walkOutOfSquare(grid, center, doorstep);
    if (!roadHead) continue;

    const villagerId = VILLAGER_IDS[homes.length];
    if (!villagerId) break;
    const anchor = nearestCellTo(topLeft, width, height, center);
    const building: PlacedObject = {
      id: `villager-home-${homes.length + 1}`,
      type: "house",
      ...topLeft,
      width,
      height,
      blocksMovement: true,
      anchorCol: anchor.col,
      anchorRow: anchor.row,
    };
    // Put down *here*, not by the caller. A cottage the grid has not been
    // told about is a cottage the next candidate's clearance check cannot
    // see, and four of them chosen against an empty green ended up in a
    // terrace with one-tile alleys between them.
    grid.placeObject(building);
    homes.push({ villagerId, doorstep, building });
    carvePath(grid, roadHead, doorstep);
  }

  if (homes.length < VILLAGER_HOME_COUNT) {
    throw new Error(
      `the village found room for ${homes.length} of ${VILLAGER_HOME_COUNT} villager cottages`,
    );
  }
  return homes;
}

/** Whether a footprint and the margin round it are untouched, walkable ground. */
function isClearGround(
  grid: WorldGrid,
  topLeft: GridPoint,
  width: number,
  height: number,
  margin: number,
): boolean {
  for (let row = topLeft.row - margin; row < topLeft.row + height + margin; row++) {
    for (let col = topLeft.col - margin; col < topLeft.col + width + margin; col++) {
      if (!grid.inBounds(col, row)) return false;
      // Dirt is the village's own mark: the square, the roads, the plots and
      // the ground their fences stand on are all of them carved to it.
      if (grid.getTerrain(col, row) === TerrainType.Dirt) return false;
      if (!grid.isPassable(col, row)) return false;
    }
  }
  return true;
}

/**
 * The walk out of the square to a cell, or null if it does not exist.
 *
 * Starts at the square's *edge* rather than its middle, for two reasons that
 * both bite. The middle is the well, which is a placed object and therefore
 * impassable — a line checked from there fails on its own first cell, every
 * time, for every candidate. And the plaza is paved last, over the ends of
 * the roads; a path carved from the centre would draw a dirt scar across
 * fresh cobble on its way out.
 *
 * Null when anything standing is in the way. `carvePath` draws a straight
 * line and sets dirt under whatever it crosses, which is harmless running
 * radially out of a square and is not harmless at all running diagonally
 * through somebody's fence.
 */
function walkOutOfSquare(grid: WorldGrid, center: GridPoint, to: GridPoint): GridPoint | null {
  const line = straightLine(center, to);
  const beyond = line.findIndex(
    (at) => Math.max(Math.abs(at.col - center.col), Math.abs(at.row - center.row)) > SQUARE_RADIUS,
  );
  if (beyond < 0) return null;
  for (const at of line.slice(beyond)) {
    if (!grid.inBounds(at.col, at.row)) return null;
    if (!grid.isPassable(at.col, at.row)) return null;
  }
  return line[beyond] ?? null;
}

/** Every cell a straight walk between two points passes through. */
function straightLine(from: GridPoint, to: GridPoint): GridPoint[] {
  const cells: GridPoint[] = [];
  let col = from.col;
  let row = from.row;
  const dCol = Math.abs(to.col - from.col);
  const dRow = -Math.abs(to.row - from.row);
  const stepCol = from.col < to.col ? 1 : -1;
  const stepRow = from.row < to.row ? 1 : -1;
  let err = dCol + dRow;
  for (;;) {
    cells.push({ col, row });
    if (col === to.col && row === to.row) return cells;
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
