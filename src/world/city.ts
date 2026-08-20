// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { AreaPlacement } from "./anchors";
import { type BuildingRole, footprintFor } from "./buildings";
import { FixtureType } from "./fixtures";
import type { WorldGrid } from "./grid";
import { LANDMARK_FOOTPRINT, LandmarkType } from "./landmarks";
import type { PlacedObject } from "./objects";
import { type Rng, randInt } from "./rng";
import { TerrainType } from "./terrain";
import type { GridPoint } from "./topdown";

/**
 * The big city: streets and blocks, laid out on a grid.
 *
 * The third layout grammar, and the one that has to work hardest, because a
 * city is built from the same kit of buildings as the village and must not
 * read as a bigger village. The village is **round** — a ring about a well,
 * with everything placed by the direction it lies in from the middle. The
 * harbour is **linear** — a working front, with everything placed by how far
 * along it sits. This is **gridded**: streets at regular intervals, blocks
 * between them, and everything placed by which block it is in.
 *
 * That difference is doing the work a new building sprite would otherwise
 * have to do. A ring says village however many houses are in it; a grid says
 * town at four buildings.
 *
 * **Paved, not worn.** The village's paths are dirt because a village wears
 * its routes into the ground; a city lays its streets, so they are cobble —
 * the same stone the village square is, which is the one piece of built
 * ground the world already has.
 */

/** How far inside the box the ring road runs, and how wide it is. */
const RING_INSET = 1;
const RING_WIDTH = 2;
/**
 * The repeating street-and-block rhythm across the city, in cells.
 *
 * A street one cell wide and blocks of five. Two-wide streets were tried and
 * cost a whole rank of blocks each way for something no player can tell
 * apart at this scale — a city reads as a city from how *many* blocks it
 * has, not from how wide the gaps between them are.
 */
const STREET_WIDTH = 1;
const BLOCK_SIZE = 5;
const RHYTHM = STREET_WIDTH + BLOCK_SIZE;

export interface CityBlock {
  readonly col: number;
  readonly row: number;
  readonly width: number;
  readonly height: number;
}

export interface CityLayout {
  /** Every block between the streets, in reading order. */
  readonly blocks: readonly CityBlock[];
  readonly buildings: readonly PlacedObject[];
  readonly placed: readonly PlacedObject[];
  /** The paved square at the middle, and the tower that stands on it. */
  readonly plaza: CityBlock;
  /**
   * The town clock, standing on the plaza.
   *
   * Null if the plaza could not take it, which on a city small enough to
   * have no block wide enough is possible and not worth throwing over.
   */
  readonly clockTower: PlacedObject | null;
  /** A clear cell of the plaza, for anything that needs to stand on it. */
  readonly plazaCell: GridPoint;
  /** Every piece of the ring wall, the gate among them. */
  readonly wall: readonly PlacedObject[];
  /**
   * The cell in front of the gate, and the world generator's route anchor.
   *
   * Not the middle of the box, which is where the clock tower is about to
   * stand: the connectivity pass carves by removing whatever is in the way,
   * and aimed at a landmark it removes the landmark. That has now happened
   * once, to the great tree, and it was silent — a route to a square with
   * nothing on it is still a route.
   *
   * A gate is also the right answer for its own sake. A city you arrive at
   * by appearing in the middle of has no outside.
   */
  readonly doorstep: GridPoint;
}

/**
 * Whether an offset inside the city falls on a street rather than a block.
 *
 * One rhythm for both axes, so the streets cross at right angles and the
 * blocks come out rectangular. Read as a function rather than baked into a
 * list of coordinates, because the box's size is the generator's to choose
 * and a table would go on being right until somebody changed it.
 */
function onStreet(offset: number): boolean {
  return offset % RHYTHM < STREET_WIDTH;
}

function pave(grid: WorldGrid, col: number, row: number, terrain: TerrainType): void {
  if (grid.inBounds(col, row)) grid.setTerrain(col, row, terrain);
}

/**
 * Where the gate goes, and where somebody stands to walk through it.
 *
 * The south side by preference: every door in the city faces that way, so
 * arriving there is arriving at the fronts of things rather than at the
 * backs of them.
 *
 * But the doorstep is **outside** the gate, and a city box can sit against
 * the edge of the world — where the south side has no outside at all. So the
 * sides are tried in turn and the first with room in front of it wins.
 *
 * Outside rather than inside is the load-bearing half. The connectivity pass
 * carves by removing whatever is in the way, so a target within the walls is
 * a target it will happily reach by knocking a hole in them: the garden
 * gate's disappearing act again, at the scale of a city. Aimed in front of
 * the gate, the carve stops at the threshold, and the gate itself — the one
 * piece of the ring that does not block — carries the route the rest of the
 * way in.
 */
function chooseGate(grid: WorldGrid, box: AreaPlacement): { gate: GridPoint; doorstep: GridPoint } {
  const midCol = box.col + Math.floor(box.width / 2);
  const midRow = box.row + Math.floor(box.height / 2);
  const left = box.col + RING_INSET - 1;
  const right = box.col + box.width - RING_INSET;
  const top = box.row + RING_INSET - 1;
  const bottom = box.row + box.height - RING_INSET;
  const sides: { gate: GridPoint; doorstep: GridPoint }[] = [
    { gate: { col: midCol, row: bottom }, doorstep: { col: midCol, row: bottom + 1 } },
    { gate: { col: midCol, row: top }, doorstep: { col: midCol, row: top - 1 } },
    { gate: { col: right, row: midRow }, doorstep: { col: right + 1, row: midRow } },
    { gate: { col: left, row: midRow }, doorstep: { col: left - 1, row: midRow } },
  ];
  // One cell in from the world's own rim, not merely in bounds. That ring
  // stands a step above everything inside it so it cannot be walked onto,
  // and no route may run along it — so a doorstep laid there is a doorstep
  // nothing can reach, and world generation says so by failing to find any
  // route at all.
  const clear = ({ col, row }: GridPoint) =>
    col > 0 && row > 0 && col < grid.width - 1 && row < grid.height - 1;
  const usable = sides.find(({ doorstep }) => clear(doorstep));
  return usable ?? (sides[0] as { gate: GridPoint; doorstep: GridPoint });
}

/**
 * The ring wall, with one gate in it.
 *
 * Laid on the outermost ring of cells rather than on the ring road, so the
 * road runs *inside* the wall the way a city's does — a wall standing in the
 * middle of its own street would be a fence.
 *
 * Four pieces, chosen by which side of the ring a cell is on: the runs that
 * cross the camera get the panel, the runs that go away from it get the
 * side view, and the corners take the panel because that is what the garden
 * fence does and for the same reason — a corner drawn as a side run leaves
 * the horizontal stopping in mid-air.
 *
 * **The gate cell is the one thing here that does not block.** A closed gate
 * on this grid either walls the city off or lets the player walk through
 * solid stone; drawn open and left passable, it says "this is the way in"
 * and means it. Exactly what the village garden's gate does, one scale up.
 */
function buildWall(grid: WorldGrid, box: AreaPlacement, gate: GridPoint): PlacedObject[] {
  const built: PlacedObject[] = [];
  const left = box.col + RING_INSET - 1;
  const right = box.col + box.width - RING_INSET;
  const top = box.row + RING_INSET - 1;
  const bottom = box.row + box.height - RING_INSET;
  for (let row = top; row <= bottom; row++) {
    for (let col = left; col <= right; col++) {
      const onEdge = row === top || row === bottom || col === left || col === right;
      if (!onEdge) continue;
      if (!grid.inBounds(col, row) || grid.getObjectAt(col, row)) continue;
      // The gateway is one named cell of the ring, and which piece it is
      // drawn as follows from which run it lands in — so a gate in the east
      // wall gets the side view without anything having to be told.
      const isGate = col === gate.col && row === gate.row;
      const acrossCamera = row === top || row === bottom;
      const type = isGate
        ? acrossCamera
          ? FixtureType.CityGate
          : FixtureType.CityGateSide
        : acrossCamera
          ? FixtureType.CityWall
          : FixtureType.CityWallSide;
      const piece: PlacedObject = {
        id: `city-wall-${col}-${row}`,
        type,
        col,
        row,
        width: 1,
        height: 1,
        blocksMovement: !isGate,
        unbreakable: true,
        anchorCol: col,
        anchorRow: row,
      };
      grid.placeObject(piece);
      built.push(piece);
    }
  }
  return built;
}

/** Stand a landmark on a square, anchored at the given top-left, or refuse. */
function raise(grid: WorldGrid, id: string, type: string, at: GridPoint): PlacedObject | null {
  const size = LANDMARK_FOOTPRINT;
  for (let row = at.row; row < at.row + size; row++) {
    for (let col = at.col; col < at.col + size; col++) {
      if (!grid.inBounds(col, row) || grid.getObjectAt(col, row)) return null;
    }
  }
  const object: PlacedObject = {
    id,
    type,
    col: at.col,
    row: at.row,
    width: size,
    height: size,
    blocksMovement: true,
    anchorCol: at.col,
    anchorRow: at.row,
  };
  grid.placeObject(object);
  return object;
}

/**
 * Lay the city out.
 *
 * Streets first, then what stands in the blocks between them — the same
 * order the village carves its square before its ring, and for the same
 * reason: the ground has to be settled before anything is put on it, or
 * every later step has to know what the earlier ones were going to do.
 */
export function layoutCity(grid: WorldGrid, box: AreaPlacement, rng: Rng): CityLayout {
  const inner = {
    col: box.col + RING_INSET + RING_WIDTH,
    row: box.row + RING_INSET + RING_WIDTH,
    width: box.width - (RING_INSET + RING_WIDTH) * 2,
    height: box.height - (RING_INSET + RING_WIDTH) * 2,
  };

  // --- the ring road ------------------------------------------------------

  for (let row = box.row + RING_INSET; row < box.row + box.height - RING_INSET; row++) {
    for (let col = box.col + RING_INSET; col < box.col + box.width - RING_INSET; col++) {
      const onRing =
        row < inner.row ||
        row >= inner.row + inner.height ||
        col < inner.col ||
        col >= inner.col + inner.width;
      if (onRing) pave(grid, col, row, TerrainType.Cobble);
    }
  }

  // --- the streets --------------------------------------------------------

  const blocks: CityBlock[] = [];
  for (let row = 0; row < inner.height; row++) {
    for (let col = 0; col < inner.width; col++) {
      if (onStreet(col) || onStreet(row)) {
        pave(grid, inner.col + col, inner.row + row, TerrainType.Cobble);
      }
    }
  }
  // The blocks are what the streets leave. Walked separately rather than
  // collected above, so a block is a rectangle with a size rather than a bag
  // of cells that happened not to be paved.
  for (let row = STREET_WIDTH; row < inner.height; row += RHYTHM) {
    for (let col = STREET_WIDTH; col < inner.width; col += RHYTHM) {
      const width = Math.min(BLOCK_SIZE, inner.width - col);
      const height = Math.min(BLOCK_SIZE, inner.height - row);
      // A sliver left over at the far edge is paved over rather than left as
      // a block nobody could put a building in — an unpaved scrap inside the
      // ring road reads as a hole in the city, not as a small yard.
      if (width < 3 || height < 3) {
        for (let r = 0; r < height; r++) {
          for (let c = 0; c < width; c++) {
            pave(grid, inner.col + col + c, inner.row + row + r, TerrainType.Cobble);
          }
        }
        continue;
      }
      blocks.push({ col: inner.col + col, row: inner.row + row, width, height });
    }
  }

  // --- the plaza ----------------------------------------------------------

  const middle = { col: box.col + box.width / 2, row: box.row + box.height / 2 };
  const plaza = blocks.reduce((best, block) => {
    const distance = (b: CityBlock) =>
      Math.hypot(b.col + b.width / 2 - middle.col, b.row + b.height / 2 - middle.row);
    return distance(block) < distance(best) ? block : best;
  }, blocks[0] as CityBlock);
  for (let row = plaza.row; row < plaza.row + plaza.height; row++) {
    for (let col = plaza.col; col < plaza.col + plaza.width; col++) {
      pave(grid, col, row, TerrainType.Cobble);
    }
  }
  // Anchored so the tower sits in the middle of the square with its feet on
  // the lower half of it — a two-by-two block centred exactly would leave
  // the square's own middle cell blocked and the approach from the south
  // running into its wall.
  const towerAt = {
    col: plaza.col + Math.floor((plaza.width - LANDMARK_FOOTPRINT) / 2),
    row: plaza.row + Math.floor((plaza.height - LANDMARK_FOOTPRINT) / 2),
  };
  const clockTower = raise(grid, "city-clock-tower", LandmarkType.ClockTower, towerAt);
  // A corner of the square that the tower is not standing on, which is what
  // anything checking "can you get to the middle of the city" has to aim at
  // now that the middle of the city is a building.
  const plazaCell = { col: plaza.col, row: plaza.row };

  // --- what stands in the blocks -----------------------------------------

  const buildings: PlacedObject[] = [];
  const placed: PlacedObject[] = [];
  // Drawn rather than dealt round in order. A fixed cycle over a grid of
  // blocks lands the same role on the same relative position in every rank,
  // which is a pattern the eye finds immediately — the first pass came out
  // as a column of warehouses down the middle of the city.
  //
  // Mostly townhouses: a city is people living in it, and a row of nothing
  // but warehouses reads as a depot. The cottage is deliberately absent —
  // it is the village's house, and a city that borrowed it would be a
  // village with more of them. So is the post office: there is one of those
  // in the world, it is where the map on the wall hangs, and a city with
  // four of them would be four more maps and three more reasons not to
  // bother climbing the village's tower.
  const ROLES: readonly BuildingRole[] = [
    "townhouse",
    "townhouse",
    "townhouse",
    "store",
    "townhouse",
  ];
  let n = 0;
  for (const block of blocks) {
    if (block === plaza) continue;
    const role = ROLES[randInt(rng, 0, ROLES.length - 1)] as BuildingRole;
    const { width, height } = footprintFor(role);
    if (width > block.width || height > block.height) {
      n++;
      continue;
    }
    // Pushed to the *bottom* of its block, so its door opens straight onto
    // the street below rather than into the yard behind it. Every building
    // sprite in the game has its door in the south wall, which is a fact
    // about the art and therefore a fact the layout has to build around.
    // Nudged along the street rather than centred to the pixel. Twenty-five
    // buildings all sitting dead centre in their block is a spreadsheet, not
    // a town, and one cell either way is enough to break it.
    const slack = block.width - width;
    const topLeft = {
      col: block.col + (slack > 0 ? randInt(rng, 0, slack) : 0),
      row: block.row + block.height - height,
    };
    // Only the ground the building stands on, and a cell of yard round it.
    // Paving the whole block was the first pass and it filled the city with
    // bare orange dirt between grey streets — a building site rather than a
    // town. What is left of a block is whatever grew there, which reads as
    // the courtyards and gardens a block has behind its street frontage, and
    // gives the stone something to be stone against.
    for (let row = topLeft.row - 1; row <= topLeft.row + height; row++) {
      for (let col = topLeft.col - 1; col <= topLeft.col + width; col++) {
        pave(grid, col, row, TerrainType.Dirt);
      }
    }
    const building: PlacedObject = {
      id: `city-${role}-${n}`,
      type: role,
      ...topLeft,
      width,
      height,
      blocksMovement: true,
      anchorCol: topLeft.col,
      anchorRow: topLeft.row,
    };
    grid.placeObject(building);
    buildings.push(building);
    placed.push(building);
    n++;
  }

  // Street lamps at the crossings, which is where a city puts them and also
  // the only cells the grid guarantees are clear.
  for (let row = 0; row < inner.height; row += RHYTHM) {
    for (let col = 0; col < inner.width; col += RHYTHM) {
      const at = { col: inner.col + col, row: inner.row + row };
      if (!grid.inBounds(at.col, at.row) || grid.getObjectAt(at.col, at.row)) continue;
      const lamp: PlacedObject = {
        id: `city-lamp-${at.col}-${at.row}`,
        type: FixtureType.Lamp,
        col: at.col,
        row: at.row,
        width: 1,
        height: 1,
        blocksMovement: true,
        anchorCol: at.col,
        anchorRow: at.row,
      };
      grid.placeObject(lamp);
      placed.push(lamp);
    }
  }

  // --- the wall, and the way through it -----------------------------------

  const { gate, doorstep } = chooseGate(grid, box);
  const wall = buildWall(grid, box, gate);
  placed.push(...wall);
  grid.removeObjectAt(doorstep.col, doorstep.row);
  pave(grid, doorstep.col, doorstep.row, TerrainType.Cobble);
  pave(grid, gate.col, gate.row, TerrainType.Cobble);

  if (clockTower) placed.push(clockTower);
  return { blocks, buildings, placed, plaza, clockTower, plazaCell, doorstep, wall };
}
