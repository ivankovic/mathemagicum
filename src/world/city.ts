// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { AreaPlacement } from "./anchors";
import { type BuildingRole, footprintFor } from "./buildings";
import { FixtureType } from "./fixtures";
import type { WorldGrid } from "./grid";
import { LANDMARK_FOOTPRINT, LANDMARK_OVERHANG, LandmarkType } from "./landmarks";
import type { PlacedObject } from "./objects";
import { type Rng, randInt } from "./rng";
import { TerrainType } from "./terrain";
import type { GridPoint } from "./topdown";
import type { VillageNpcSpec } from "./villageLayout";

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

/**
 * How many people are out on the streets.
 *
 * Eight, against the village's four and its twenty-four buildings. Not one
 * per house: a city where everybody is outdoors at once is a parade, and the
 * point of the number is that a child turning a corner meets somebody rather
 * than that the census adds up.
 */
const TOWNSFOLK = 8;
/**
 * How many shops a city has, whatever the dice say.
 *
 * A playtest asked for shops in the city and the harbour, and "one block in
 * five, at random" answers that on most seeds and on some seeds not at all.
 * Five is enough that a child walking a lap meets one and few enough that
 * the place is still somewhere people live.
 */
const CITY_SHOPS = 5;
/** What the person behind a city counter is, whatever their id says. */
const SHOPKEEPER_ROLE = "shopkeeper";
/**
 * And the one person in the city who is not behind a counter.
 *
 * He teaches the hourglass, and he stands under the tower because that is
 * where a spell about telling the time belongs: the clock on the wall is
 * the only place in the world where the hour is written down for everybody
 * at once. Out in the square rather than in a room, since a clock tower is
 * a thing a child walks up to, and a teacher tucked into a building beside
 * it is a teacher nobody finds.
 */
const CLOCKMAKER_ROLE = "clockmaker";

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
/**
 * One rhythm for both axes, so the streets cross at right angles and the
 * blocks come out rectangular.
 *
 * Read as a stride rather than baked into a list of coordinates, because the
 * box's size is the generator's to choose and a table would go on being
 * right until somebody changed it. Nothing draws a street any more — the
 * whole enclosure is one paved surface — so the rhythm's only job now is to
 * say where the blocks start.
 */
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
  /**
   * The people: townsfolk on the streets, and a shopkeeper in every shop.
   *
   * A playtest put it plainly — *the city has no people*. Twenty-four
   * buildings and nobody on the street is a model of a city rather than one,
   * and four shops nobody is standing in are four rooms with a door.
   *
   * The same shape as the village's, because they are the same problem: a
   * person who walks a short circuit near where they belong, or one who
   * waits inside a room to be spoken to.
   */
  readonly npcs: readonly VillageNpcSpec[];
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
  /** Every piece of the ring wall, the gates among them. */
  readonly wall: readonly PlacedObject[];
  /**
   * Every way through it: one to each side of the compass that has one.
   *
   * A city with a single gate is a city with a back. Walk round it from the
   * north and the wall runs on and on, and the way in is wherever you did
   * not start — which is a long walk to learn a fact the place could simply
   * have told you.
   *
   * A side is skipped where the cell outside it is water, or is the world's
   * own rim — which stands a step above everything and cannot be walked on.
   * Both are gates onto nothing, and a gate that cannot be walked through is
   * a door that lies about being one.
   *
   * They are not all *routed* to. `doorstep` is still one cell and the
   * connectivity pass still carves to that one; the others open onto
   * whatever the world put there, which may be sand or a lake. That is what
   * a city gate is — a way through the wall, not a promise about the country
   * outside it.
   */
  readonly gates: readonly GridPoint[];
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
function chooseGates(
  grid: WorldGrid,
  box: AreaPlacement,
): { gates: GridPoint[]; doorstep: GridPoint } {
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
  // Two things make a side worth a gate, and both are about the cell
  // *outside* it.
  //
  // It must be one cell in from the world's own rim, not merely in bounds:
  // that ring stands a step above everything inside it so it cannot be
  // walked onto, and no route may run along it — a doorstep laid there is a
  // doorstep nothing can reach, and world generation says so by failing to
  // find any route at all.
  //
  // And it must be dry. The first city this was tried on sits with its back
  // to the sea, and the west gate opened straight onto deep water: a gate
  // that cannot be walked through is a door that lies about being one.
  // Trees are allowed — they can be cleared, and a wood outside a city gate
  // is a wood outside a city gate.
  const clear = ({ col, row }: GridPoint) =>
    col > 0 &&
    row > 0 &&
    col < grid.width - 1 &&
    row < grid.height - 1 &&
    grid.getTerrain(col, row) !== TerrainType.Water;
  const usable = sides.filter(({ doorstep }) => clear(doorstep));
  // Every side that has an outside gets a gate. The *route* still goes to
  // one of them — the south by preference, since every door in the city
  // faces that way and arriving there is arriving at the fronts of things.
  const opened = usable.length > 0 ? usable : [sides[0] as (typeof sides)[number]];
  return {
    gates: opened.map(({ gate }) => gate),
    doorstep: (opened[0] as (typeof sides)[number]).doorstep,
  };
}

/**
 * The ring wall, with a gate on every side that has one.
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
 * **The gate cells are the only ones here that do not block.** A closed gate
 * on this grid either walls the city off or lets the player walk through
 * solid stone; drawn open and left passable, it says "this is the way in"
 * and means it. Exactly what the village garden's gate does, one scale up.
 */
function buildWall(
  grid: WorldGrid,
  box: AreaPlacement,
  gates: readonly GridPoint[],
): PlacedObject[] {
  const built: PlacedObject[] = [];
  const ways = new Set(gates.map(({ col, row }) => `${col},${row}`));
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
      const isGate = ways.has(`${col},${row}`);
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

  // --- the ground ---------------------------------------------------------

  // The whole enclosure, in one pass, before anything is put on it.
  //
  // It was the streets and the ring road only, with each block left as
  // whatever had grown there and a patch of dirt under each building. That
  // reads as houses standing in a field: the wall and the street grid were
  // doing all the work of saying *city* and the ground was arguing with
  // them. Paving the blocks in *dirt* was tried before that and was worse —
  // bare orange between grey streets, a building site.
  //
  // Cobble everywhere is the third answer and the one a city actually looks
  // like. It also settles what a block is for: nothing inside these walls is
  // plantable, because laid stone is not soil, and a city you could farm
  // would be a village with more houses in it. The garden is at home.
  for (let row = box.row; row < box.row + box.height; row++) {
    for (let col = box.col; col < box.col + box.width; col++) {
      pave(grid, col, row, TerrainType.Cobble);
    }
  }

  // --- the streets --------------------------------------------------------

  // The streets are no longer paved *here* — everything is paved. What this
  // walk still does is say where the blocks are, and a block is a rectangle
  // with a size rather than a bag of cells that happened not to be paved.
  const blocks: CityBlock[] = [];
  for (let row = STREET_WIDTH; row < inner.height; row += RHYTHM) {
    for (let col = STREET_WIDTH; col < inner.width; col += RHYTHM) {
      const width = Math.min(BLOCK_SIZE, inner.width - col);
      const height = Math.min(BLOCK_SIZE, inner.height - row);
      // A sliver left over at the far edge is not a block: there is nowhere
      // in it to stand a building. It is simply street now, which it looks
      // like, because the whole enclosure is one surface.
      if (width < 3 || height < 3) continue;
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
  // What the clock tower's art covers, which is more than what it stands on:
  // five tiles above the two, so the block behind it is drawn over entirely.
  // A playtest called that "buildings behind the clocktower are blocked".
  // Nothing was blocked — every door was reachable and every cell inside the
  // walls could be walked to — but a building nobody can see is a building
  // that is not there, and a square in front of a town clock is a better
  // answer than a townhouse hidden behind it.
  const shadow = clockTower
    ? {
        col: clockTower.col,
        row: clockTower.row - LANDMARK_OVERHANG[LandmarkType.ClockTower],
        width: clockTower.width,
        height: clockTower.height + LANDMARK_OVERHANG[LandmarkType.ClockTower],
      }
    : null;
  const hidden = (block: CityBlock) =>
    shadow !== null &&
    block.col < shadow.col + shadow.width &&
    shadow.col < block.col + block.width &&
    block.row < shadow.row + shadow.height &&
    shadow.row < block.row + block.height;

  // Which blocks get a shop, drawn without replacement.
  //
  // It used to be a die roll per block — a one-in-five chance of a store —
  // which mostly came out at five or six shops and sometimes came out at
  // *none*. A city with no shop in it fails the thing the shops were asked
  // for, and it fails it on a seed nobody can predict, which is the worst
  // way for something to be missing.
  //
  // Drawn rather than dealt round in order, though, because that was the
  // other failure: a fixed cycle over a grid of blocks lands the same role
  // on the same relative position in every rank, and the first pass came
  // out as a column of warehouses down the middle of the city.
  //
  // Everything else is a townhouse. A city is people living in it, and a row
  // of nothing but warehouses reads as a depot. The cottage is deliberately
  // absent — it is the village's house, and a city that borrowed it would be
  // a village with more of them. So is the post office: there is one of
  // those in the world, it is where the map on the wall hangs, and a city
  // with four would be three more reasons not to climb the village's tower.
  const shopBlocks = new Set<number>();
  const buildable = blocks.filter((block) => block !== plaza && !hidden(block));
  while (shopBlocks.size < Math.min(CITY_SHOPS, buildable.length)) {
    shopBlocks.add(randInt(rng, 0, buildable.length - 1));
  }
  let n = 0;
  for (const [at, block] of buildable.entries()) {
    const role: BuildingRole = shopBlocks.has(at) ? "store" : "townhouse";
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

  // What the crossings get, which is where a city puts its street furniture
  // and also the only cells the grid guarantees are clear.
  //
  // It was a lamp at every one of them. A playtest asked for somewhere with
  // a bit more solarpunk about it, and the crossings are where a city says
  // what kind of city it is — so a lamp, then a sun panel, then greenery,
  // round and round. Three in rotation rather than a random draw: a child
  // walking a street should be able to see the pattern, which is also what
  // stops one crossing looking like a mistake.
  //
  // **The lamp keeps its share and keeps its place in the cycle**, because
  // it is the only one of the three that does something — it lights the
  // ground, and a city that swapped a third of its lamps for scenery would
  // be a city that got darker to look nicer.
  const CROSSING_CYCLE: readonly FixtureType[] = [
    FixtureType.Lamp,
    FixtureType.SunArray,
    FixtureType.Lamp,
    FixtureType.Planter,
  ];
  let crossing = 0;
  for (let row = 0; row < inner.height; row += RHYTHM) {
    for (let col = 0; col < inner.width; col += RHYTHM) {
      const at = { col: inner.col + col, row: inner.row + row };
      if (!grid.inBounds(at.col, at.row) || grid.getObjectAt(at.col, at.row)) continue;
      // Counted per *placed* thing rather than per crossing considered, so a
      // run of blocked cells does not silently skip the panel's turn.
      const type = CROSSING_CYCLE[crossing % CROSSING_CYCLE.length] ?? FixtureType.Lamp;
      crossing++;
      const dressing: PlacedObject = {
        id: `city-${type}-${at.col}-${at.row}`,
        type,
        col: at.col,
        row: at.row,
        width: 1,
        height: 1,
        blocksMovement: true,
        anchorCol: at.col,
        anchorRow: at.row,
      };
      grid.placeObject(dressing);
      placed.push(dressing);
    }
  }

  // --- the wall, and the way through it -----------------------------------

  const { gates, doorstep } = chooseGates(grid, box);
  const wall = buildWall(grid, box, gates);
  placed.push(...wall);
  grid.removeObjectAt(doorstep.col, doorstep.row);
  pave(grid, doorstep.col, doorstep.row, TerrainType.Cobble);
  // Every gateway is paved, not only the one the road arrives at: a way
  // through the wall that is still grass underfoot reads as a gap somebody
  // forgot to build rather than as a gate.
  for (const gate of gates) pave(grid, gate.col, gate.row, TerrainType.Cobble);

  if (clockTower) placed.push(clockTower);

  // --- the people ---------------------------------------------------------

  const npcs: VillageNpcSpec[] = [];
  // One behind every counter. The city builds shops already; what it has
  // never had is anybody in them, so walking into one got a room and a
  // silence.
  for (const shop of buildings.filter((building) => building.type === "store")) {
    npcs.push({
      id: `${shop.id}-keeper`,
      role: SHOPKEEPER_ROLE,
      homeBuildingId: shop.id,
      home: { col: shop.col + Math.floor(shop.width / 2), row: shop.row + shop.height },
      indoors: true,
    });
  }
  // The clockmaker, at the tower's foot. Below it rather than beside it:
  // the tower's art overhangs five tiles *upwards*, so a person standing to
  // the north of it is a person drawn behind a wall — and the approach to
  // the square comes from the south anyway.
  //
  // The first clear cell of a short list, worked outwards: the plaza is a
  // block of open ground but the tower does not always sit the same way in
  // it, and a person placed on a cell nothing checked would be a person
  // standing inside a building.
  if (clockTower) {
    const beside = [
      { col: clockTower.col, row: clockTower.row + clockTower.height },
      { col: clockTower.col + 1, row: clockTower.row + clockTower.height },
      { col: clockTower.col - 1, row: clockTower.row + clockTower.height - 1 },
      { col: clockTower.col + clockTower.width, row: clockTower.row + clockTower.height - 1 },
      { col: clockTower.col - 1, row: clockTower.row + clockTower.height },
      { col: clockTower.col + clockTower.width, row: clockTower.row + clockTower.height },
    ];
    const stands = beside.find((at) => grid.isPassable(at.col, at.row));
    if (stands) {
      npcs.push({
        id: "city-clockmaker",
        role: CLOCKMAKER_ROLE,
        homeBuildingId: "",
        home: stands,
        indoors: false,
      });
    }
  }

  // And some out on the streets. Spread along the ring road rather than
  // scattered at random: the ring is the one run of ground the layout knows
  // is walkable end to end, and people you meet while walking round a city
  // are people on a street rather than people standing in a yard.
  // Spaced along the cells of the ring that are clear, rather than along the
  // ring and then dropped where they are not — the lamps stand on it, and
  // sampling first put a person on a lamp post and then dropped them.
  const ring = ringWalk(box).filter((at) => grid.isPassable(at.col, at.row));
  for (let n = 0; n < TOWNSFOLK && ring.length > 0; n++) {
    const at = ring[Math.floor((n * ring.length) / TOWNSFOLK)] as GridPoint;
    npcs.push({
      id: `city-townsfolk-${n}`,
      homeBuildingId: "",
      home: { col: at.col, row: at.row },
      indoors: false,
    });
  }

  return {
    blocks,
    buildings,
    placed,
    plaza,
    clockTower,
    plazaCell,
    doorstep,
    wall,
    gates,
    npcs,
  };
}

/**
 * The ring road, as a loop of cells.
 *
 * Walked once round rather than sampled, so the people spaced along it are
 * spaced along the *road* — a city's crowd belongs on its streets, and a
 * random cell inside the walls is as likely to be somebody's doorstep.
 */
function ringWalk(box: AreaPlacement): GridPoint[] {
  const left = box.col + RING_INSET;
  const right = box.col + box.width - RING_INSET - 1;
  const top = box.row + RING_INSET;
  const bottom = box.row + box.height - RING_INSET - 1;
  const loop: GridPoint[] = [];
  for (let col = left; col <= right; col++) loop.push({ col, row: top });
  for (let row = top + 1; row <= bottom; row++) loop.push({ col: right, row });
  for (let col = right - 1; col >= left; col--) loop.push({ col, row: bottom });
  for (let row = bottom - 1; row > top; row--) loop.push({ col: left, row });
  return loop;
}
