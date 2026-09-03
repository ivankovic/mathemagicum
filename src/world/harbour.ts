// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { AreaPlacement } from "./anchors";
import { type BuildingRole, footprintFor } from "./buildings";
import { FixtureType } from "./fixtures";
import type { WorldGrid } from "./grid";
import { LANDMARK_FOOTPRINT, LandmarkType } from "./landmarks";
import type { PlacedObject } from "./objects";
import type { Rng } from "./rng";
import { TerrainType } from "./terrain";
import type { GridPoint } from "./topdown";
import type { VillageNpcSpec } from "./villageLayout";

/**
 * The harbour: everything strung along a waterfront, facing the sea.
 *
 * The third place with anything in it, and the point of it is the *grammar*
 * rather than the contents. The village is **round** — a ring of buildings
 * about a well. The forest is **grown** — one great thing at the middle with
 * a wood thickening outward. This is **linear**: a line of working front
 * with the sea on one side and the town on the other, and everything placed
 * by how far along that line it sits.
 *
 * Three settlements built from the same kit of buildings would otherwise
 * read as the same settlement three times, which is the failure this is
 * shaped to avoid. Nothing here is a new sprite; what makes it a harbour is
 * that it is arranged like one.
 *
 * **Which way the sea is comes from the world, not from a constant.** The
 * anchor is placed straddling the waterline and the coast runs at whatever
 * angle it runs — so the layout finds the shore, works out which way is
 * seaward, and builds against that. A hardcoded "the sea is south" would be
 * right about a quarter of the time.
 *
 * **And there is traffic.** Four piers with one moored hull between them
 * looked like what it was: a set of walkways over a flat blue field. Every
 * pier that has open sea past its tip now gets a `Berth` — a mooring and the
 * lane of water a ship comes in over — and `shipping.ts` sails visiting
 * ships up and down them. What is decided *here* is where a ship may go, and
 * it is decided once, over the grid, when the world is made: the sea in a
 * box is not a rectangle, and a lane guessed at while a child watched would
 * put a hull through a sandbar on the first seed nobody sampled.
 *
 * The visitors are scenery and nothing else — no grid, no save, not
 * boardable. The great ship is the one you can walk into, and she stays
 * where she is moored.
 */

/** How far inland the working front is paved. */
const QUAY_DEPTH = 3;
/**
 * How many people are out on the working front.
 *
 * Fewer than the city's eight: a harbour is three buildings and a quay, and
 * the same crowd there would be a queue.
 */
const QUAYSIDE_FOLK = 4;
/**
 * And how many of them are out on the jetties with a line in the water.
 *
 * A playtest called the harbour *an idle plane* and asked for somebody
 * fishing in it. One to a pier, standing at the seaward end — which is the
 * whole of what makes them anglers, because they are drawn with the same
 * three villager sheets as everybody else. There is no rod in this game's
 * art and no fisherman's body but the teacher's, and dressing an extra as
 * him would undo the one thing his costume is for: the player has to know on
 * sight which person on the quay is the one who teaches.
 *
 * Placement is the whole characterisation, and it is enough. Somebody
 * standing at the end of a jetty over open water is doing one thing.
 */
const ANGLERS_PER_PIER = 1;
/** What the person behind a harbour counter is, whatever their id says. */
const SHOPKEEPER_ROLE = "shopkeeper";
/**
 * The fisherman on the quay, who teaches the sharing spell.
 *
 * His id and his role are the same word, unlike the keepers': there is one
 * of him in the world, the way there is one geometer and one astronomer, so
 * there is nothing for an id to tell apart.
 */
const FISHER_ID = "fisher";
const FISHER_ROLE = "fisher";
/** How far out a pier reaches, and how many the front carries. */
const PIER_REACH = 7;
/**
 * Four rather than three.
 *
 * Not every one gets built — a root in a shallow stretch makes a stub and is
 * dropped — so asking for four is how the front ends up with three on a
 * ragged coast where three used to get two. And a pier is now somewhere a
 * ship ties up rather than only somewhere to stand, so the number of them is
 * the number of things that can be happening at once out there.
 */
const PIERS = 4;
/** The least water a pier is worth building: shorter than this is a step. */
const PIER_LEAST = 2;
/** How far apart along the front things are spaced, in shoreline cells. */
const FRONT_GAP = 6;

export interface HarbourLayout {
  /** The cells of the working front, in order along the shore. */
  readonly quay: readonly GridPoint[];
  /**
   * Each pier, as the cells it decks, landward end first.
   *
   * The landward end is the shoreline cell itself, decked along with the
   * rest. That is not decoration: it is the cell that joins the pier to the
   * quay, and leaving it out of the pier left it looking like any other
   * stretch of working front — so the fish market put a stall on it and
   * sealed the pier off from the land. Every pier in the world was a jetty
   * standing alone in the bay, each plank of it decked, passable, and
   * connected to nothing.
   */
  readonly piers: readonly (readonly GridPoint[])[];
  readonly buildings: readonly PlacedObject[];
  readonly placed: readonly PlacedObject[];
  /**
   * The people: a few along the working front, and one behind each counter.
   *
   * The same complaint the city drew — a place with buildings and nobody in
   * it is a model of a place. A harbour's crowd belongs on the quay, which is
   * also the one run of ground here the layout knows is walkable end to end.
   */
  readonly npcs: readonly VillageNpcSpec[];
  /**
   * The lighthouse, standing on the headland at one end of the shore.
   *
   * The tip of the longest pier was the first answer and it is the better
   * picture — and it does not survive contact with the world. A pier ends
   * where the box does, so the tower's footprint would hang over the
   * boundary; the planks are one cell wide, so three quarters of it would
   * stand on open water and want decking under it; and a two-plank pier in
   * a shallow bay would put the beacon a step from the beach.
   *
   * A headland is always land, always inside the box, and always has room.
   * It is also what a lighthouse actually stands on.
   *
   * Null if even the headland could not take it — a two-by-two footprint
   * wants two clear cells each way, and a shore one cell wide has not got
   * them. A harbour with no beacon is a poorer harbour; a beacon standing
   * half in the sea is a bug.
   */
  readonly lighthouse: PlacedObject | null;
  /**
   * Where a visiting ship ties up, and the water she comes in over.
   *
   * One per pier that has open sea beyond its tip, which is not every pier —
   * a stub in a shallow corner of the bay has nowhere for a hull to sit.
   *
   * Worked out here rather than while the game is running, and that is the
   * whole reason this is on the layout at all. The sea in a harbour box is
   * not a rectangle: `findShore` exists because the coast runs at whatever
   * angle it runs, and `moorShip` carries the scars of two attempts that
   * berthed a ship beautifully somewhere she could not be reached. A lane
   * guessed at by a sprite while a child watches would sail through a
   * sandbar on the first seed nobody sampled. These are walked over the grid
   * once, with every cell of the hull checked, and the twenty-seed sweep in
   * `worldGenerator.test.ts` says so.
   */
  readonly berths: readonly Berth[];
  /**
   * The great ship, moored off the front, or null if there is no room.
   *
   * A building, to the rest of the game: it blocks a footprint, it has a
   * door, and there is a room behind the door. Nothing about walking into
   * one needed a new rule.
   */
  readonly ship: PlacedObject | null;
  /** The planks laid from the shore to her entry port. */
  readonly gangway: readonly GridPoint[];
  /**
   * The cell a visitor arrives on, and the world generator's route anchor.
   *
   * **Land, never a pier.** The connectivity pass carves its routes by
   * removing whatever is in the way, and a carve that had to reach a plank
   * would happily bulldoze the quay's approach — the pier being the one
   * structure whose whole job is to be the only way over water. The same
   * rule the grove's doorstep exists for, one place further along.
   */
  readonly doorstep: GridPoint;
}

/**
 * A berth: where a visiting ship sits, and the run of sea she arrives along.
 *
 * `lane[0]` is the mooring — where her hull's top-left corner goes when she
 * is tied up — and the rest runs out to sea, so `lane.at(-1)` is where she
 * comes from and where she goes back to. Every entry is a position at which
 * her *whole* hull is clear water inside the box, which is what makes it
 * safe for anything to move her along it without asking the grid again.
 */
export interface Berth {
  /** Which pier she ties up at, by index into `piers`. */
  readonly pier: number;
  /** Moored end first, open sea last. */
  readonly lane: readonly GridPoint[];
}

interface Shore {
  /** Land cells with the sea next to them, in order along the coast. */
  readonly front: readonly GridPoint[];
  /**
   * Which way the water lies, as a unit vector. Used for *ordering* — how
   * far along the coast a cell is, which end of it reaches furthest out.
   */
  readonly seaward: { readonly dCol: number; readonly dRow: number };
  /**
   * The same direction snapped to one axis, for *walking*.
   *
   * A pier laid along the true seaward vector goes diagonal the moment the
   * coast does, and a diagonal run of planks is a run nobody can walk: the
   * game moves in four directions, so each plank would be a corner touching
   * the last. Every pier in the world was a jetty in the middle of a bay,
   * and it took a reachability check to see it — each plank was decked,
   * passable and connected to nothing.
   *
   * Piers are built straight in any case, which is why this costs nothing.
   */
  readonly out: { readonly dCol: number; readonly dRow: number };
}

const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

function inside(box: AreaPlacement, col: number, row: number): boolean {
  return (
    col >= box.col && col < box.col + box.width && row >= box.row && row < box.row + box.height
  );
}

/**
 * Where the coast is, and which way is out to sea.
 *
 * Seaward is taken from the two centroids — the middle of the wet cells
 * against the middle of the dry ones — rather than from any single cell's
 * neighbours. A per-cell normal is noisy on a ragged coast and would have
 * every third pier setting off along the beach.
 *
 * The front is then sorted *across* that direction, which is what puts the
 * shoreline cells in order along the coast rather than in scan order. Every
 * spacing decision below counts in that order, so a bay and a straight beach
 * space their piers the same way.
 */
function findShore(grid: WorldGrid, box: AreaPlacement): Shore | null {
  const wet = { col: 0, row: 0, n: 0 };
  const dry = { col: 0, row: 0, n: 0 };
  const front: GridPoint[] = [];
  for (let row = box.row; row < box.row + box.height; row++) {
    for (let col = box.col; col < box.col + box.width; col++) {
      if (!grid.inBounds(col, row)) continue;
      const water = grid.getTerrain(col, row) === TerrainType.Water;
      const into = water ? wet : dry;
      into.col += col;
      into.row += row;
      into.n++;
      if (water) continue;
      const touchesSea = NEIGHBOURS.some(
        ([dCol, dRow]) =>
          grid.inBounds(col + dCol, row + dRow) &&
          grid.getTerrain(col + dCol, row + dRow) === TerrainType.Water,
      );
      if (touchesSea) front.push({ col, row });
    }
  }
  if (wet.n === 0 || dry.n === 0 || front.length === 0) return null;

  const away = {
    col: wet.col / wet.n - dry.col / dry.n,
    row: wet.row / wet.n - dry.row / dry.n,
  };
  const length = Math.hypot(away.col, away.row) || 1;
  const seaward = { dCol: away.col / length, dRow: away.row / length };
  const out =
    Math.abs(seaward.dCol) >= Math.abs(seaward.dRow)
      ? { dCol: Math.sign(seaward.dCol) || 1, dRow: 0 }
      : { dCol: 0, dRow: Math.sign(seaward.dRow) || 1 };
  // Along the coast is at right angles to seaward. Sorting by it turns a
  // scanline order into a walk from one end of the beach to the other.
  const along = (at: GridPoint) => at.col * -seaward.dRow + at.row * seaward.dCol;
  return { front: [...front].sort((a, b) => along(a) - along(b)), seaward, out };
}

/** Steps out to sea from a cell, along one axis so the run stays walkable. */
function seawardStep(shore: Shore, at: GridPoint, distance: number): GridPoint {
  return {
    col: at.col + shore.out.dCol * distance,
    row: at.row + shore.out.dRow * distance,
  };
}

/**
 * A pier from one shoreline cell, or null if there is not enough sea for it.
 *
 * Stops at the first cell that is not open water — the box's edge, a spit of
 * sand, another pier. A pier that ran onto the beach at the far end would be
 * a bridge, and a bridge across a corner of the bay is not what a harbour
 * looks like.
 */
function pierFrom(
  grid: WorldGrid,
  box: AreaPlacement,
  shore: Shore,
  root: GridPoint,
): GridPoint[] | null {
  const planks: GridPoint[] = [root];
  for (let out = 1; out <= PIER_REACH; out++) {
    const at = seawardStep(shore, root, out);
    if (!inside(box, at.col, at.row) || !grid.inBounds(at.col, at.row)) break;
    if (grid.getTerrain(at.col, at.row) !== TerrainType.Water) break;
    if (grid.isBridged(at.col, at.row)) break;
    planks.push(at);
  }
  // Counting the root, so PIER_LEAST is still a count of cells over water.
  return planks.length >= PIER_LEAST + 1 ? planks : null;
}

/**
 * Stand a landmark on a cell, or refuse.
 *
 * Anchored so the given cell is the *bottom* of its footprint and nudged
 * back inside the box if that pushes it over the edge — a landmark is placed
 * at a point somebody chose for a reason, and sliding it a cell is a smaller
 * lie than putting its feet outside the place it belongs to.
 */
function raise(
  grid: WorldGrid,
  box: AreaPlacement,
  id: string,
  type: string,
  at: GridPoint,
): PlacedObject | null {
  const size = LANDMARK_FOOTPRINT;
  const col = Math.min(Math.max(at.col - size + 1, box.col), box.col + box.width - size);
  const row = Math.min(Math.max(at.row - size + 1, box.row), box.row + box.height - size);
  for (let r = row; r < row + size; r++) {
    for (let c = col; c < col + size; c++) {
      if (!grid.inBounds(c, r) || grid.getObjectAt(c, r)) return null;
      // Never on the water and never on a plank: a tower needs ground under
      // it, and a pier is not ground.
      if (grid.getTerrain(c, r) === TerrainType.Water || grid.isBridged(c, r)) return null;
    }
  }
  const object: PlacedObject = {
    id,
    type,
    col,
    row,
    width: size,
    height: size,
    blocksMovement: true,
    anchorCol: col,
    anchorRow: row,
  };
  grid.placeObject(object);
  return object;
}

/**
 * A run of planks from a cell out at sea to the nearest ground.
 *
 * Breadth-first over open water, so the jetty it lays is the shortest one
 * there is — which on a south-facing coast means round the ship's hull and
 * back to the beach, and on any other means straight in. Stops at the first
 * cell somebody could already stand on: the shore, a pier, another jetty.
 *
 * Null when there is nothing within reach, which is a real answer. A jetty
 * that wandered fifteen cells to find a beach would be a causeway, and the
 * harbour is better off with the ship moored somewhere else.
 */
function walkAshore(
  grid: WorldGrid,
  box: AreaPlacement,
  from: GridPoint,
  berth: ReadonlySet<string>,
): GridPoint[] | null {
  const key = (at: GridPoint) => `${at.col},${at.row}`;
  const cameFrom = new Map<string, GridPoint | null>([[key(from), null]]);
  let edge: GridPoint[] = [from];
  const ashore = (at: GridPoint) =>
    grid.isPassable(at.col, at.row) || grid.isBridged(at.col, at.row);

  for (let step = 0; step <= GANGWAY_REACH && edge.length > 0; step++) {
    const next: GridPoint[] = [];
    for (const at of edge) {
      if (!inside(box, at.col, at.row) || !grid.inBounds(at.col, at.row)) continue;
      if (berth.has(key(at)) || grid.getObjectAt(at.col, at.row) !== null) continue;
      if (ashore(at)) {
        // Arrived. The path back is the jetty, minus this cell — it is
        // already something you can stand on and needs no planking.
        const planks: GridPoint[] = [];
        let walk = cameFrom.get(key(at)) ?? null;
        while (walk) {
          planks.push(walk);
          walk = cameFrom.get(key(walk)) ?? null;
        }
        return planks.reverse();
      }
      if (grid.getTerrain(at.col, at.row) !== TerrainType.Water) continue;
      for (const [dCol, dRow] of NEIGHBOURS) {
        const on = { col: at.col + dCol, row: at.row + dRow };
        if (cameFrom.has(key(on))) continue;
        cameFrom.set(key(on), at);
        next.push(on);
      }
    }
    edge = next;
  }
  return null;
}

/** The ship's footprint, mirroring her sidecar. See `buildings.ts`. */
const SHIP_SIZE = { width: 5, height: 2 };
/** How far a gangway may wander before it stops being a gangway. */
const GANGWAY_REACH = 10;

/**
 * The least sea a berth is worth having.
 *
 * Counted in hull-lengths of lane, not in cells: a ship that arrived from
 * two cells out has not arrived from anywhere, she has appeared. Four
 * positions is enough that she is well clear of the pier when she is away
 * and visibly travelling when she is not.
 */
const LANE_LEAST = 4;
/** And the most, so a ship does not set out from the far side of the bay. */
const LANE_REACH = 9;

/**
 * Where a ship can tie up at this pier, and the water she comes in over.
 *
 * Walked seaward from the tip with the *whole hull* checked at every step,
 * which is the point of doing it here. A lane is a promise that anything
 * following it is on open water for its full width from one end to the
 * other — so the thing that moves a ship along it never has to ask the grid,
 * and cannot be wrong about a sandbar on a seed nobody looked at.
 *
 * Null when there is not enough clear sea, which is ordinary: a stub pier in
 * a shallow corner of a bay is a place to fish from, not a place to berth.
 */
function berthAt(grid: WorldGrid, shore: Shore, pier: readonly GridPoint[]): GridPoint[] | null {
  const tip = pier.at(-1);
  if (!tip) return null;
  // Not held inside the box, unlike everything else here, and that is the
  // point rather than an oversight. The box is the stretch of coast this
  // layout *builds* on, and a pier is built out to the edge of it — so there
  // is no sea left inside for a ship to come from. She comes from outside
  // it, over the horizon, which is where ships come from. The grid is still
  // asked about every cell, so a lane that would run onto the next island
  // stops at its beach.
  const clearWater = (col: number, row: number) =>
    grid.inBounds(col, row) &&
    grid.getTerrain(col, row) === TerrainType.Water &&
    !grid.isBridged(col, row) &&
    grid.getObjectAt(col, row) === null;
  // Her hull is five cells by two and is drawn from its top-left corner, so
  // a hull sitting square on the end of the pier has that corner two cells
  // west of it and however many cells seaward.
  //
  // Five *columns* whichever way the coast faces, because the sprite does
  // not turn: a ship is drawn side-on like every other building here, and a
  // harbour on an east-facing shore has her sailing along her own length
  // rather than being redrawn end-on.
  const anchorFor = (out: number): GridPoint => ({
    col: tip.col + shore.out.dCol * out - 2,
    row: tip.row + shore.out.dRow * out,
  });
  const afloat = (at: GridPoint) => {
    for (let row = at.row; row < at.row + SHIP_SIZE.height; row++) {
      for (let col = at.col; col < at.col + SHIP_SIZE.width; col++) {
        if (!clearWater(col, row)) return false;
      }
    }
    return true;
  };
  const lane: GridPoint[] = [];
  for (let out = 1; out <= LANE_REACH; out++) {
    const at = anchorFor(out);
    // Stopped at the first position that will not float her rather than
    // skipped past: a lane with a hole in it is a ship that crosses a
    // sandbar on her way in.
    if (!afloat(at)) break;
    lane.push(at);
  }
  return lane.length >= LANE_LEAST ? lane : null;
}

/**
 * Moor the great ship, and lay a gangway to her entry port.
 *
 * **She floats, so her footprint is water** — every cell of it, or she is a
 * ship aground. Her door is in the middle of her southern row, because every
 * door in this game is, so what has to be found is a stretch of open water
 * with something walkable a few cells *south* of that door.
 *
 * The gangway is then the planks between the two. It is the same decking the
 * piers are made of and it is laid by the same rule: a run of cells the grid
 * is told are bridged, so water becomes something you can stand on. Without
 * it she would be a building whose doorstep is the sea.
 *
 * Null when the coast in this box has no water deep enough or no land close
 * enough south of it — which happens, and is better said than faked. The
 * harbour is a harbour either way; it simply has no ship in today.
 */
function moorShip(
  grid: WorldGrid,
  box: AreaPlacement,
  shore: Shore,
  quay: readonly GridPoint[],
): { ship: PlacedObject; gangway: GridPoint[] } | null {
  const clearWater = (col: number, row: number) =>
    inside(box, col, row) &&
    grid.inBounds(col, row) &&
    grid.getTerrain(col, row) === TerrainType.Water &&
    !grid.isBridged(col, row) &&
    grid.getObjectAt(col, row) === null;

  // Every stretch of water in the box, nearest the middle of the working
  // front first, so she moors where the town is rather than at whichever end
  // of the beach happens to be scanned first.
  //
  // The whole box rather than a line straight out from the quay: on a coast
  // that faces east or south there is nothing to the south of a mooring
  // straight offshore, and the only berths with ground below them are the
  // ones tucked into a bay. Searching the water finds those; searching
  // outward from the beach cannot.
  const heart = quay[Math.floor(quay.length / 2)] ?? shore.front[0];
  if (!heart) return null;
  const berths: GridPoint[] = [];
  for (let row = box.row; row < box.row + box.height; row++) {
    for (let col = box.col; col < box.col + box.width; col++) {
      if (grid.inBounds(col, row) && grid.getTerrain(col, row) === TerrainType.Water) {
        berths.push({ col, row });
      }
    }
  }
  berths.sort(
    (a, b) =>
      Math.hypot(a.col - heart.col, a.row - heart.row) -
      Math.hypot(b.col - heart.col, b.row - heart.row),
  );

  for (const door of berths) {
    // The door sits in the middle of her southern row, so her top-left is
    // two cells west of it and one north.
    const top = { col: door.col - Math.floor(SHIP_SIZE.width / 2), row: door.row - 1 };
    let afloat = true;
    for (let row = top.row; row < top.row + SHIP_SIZE.height && afloat; row++) {
      for (let col = top.col; col < top.col + SHIP_SIZE.width && afloat; col++) {
        if (!clearWater(col, row)) afloat = false;
      }
    }
    if (!afloat) continue;

    // **The gangway starts below her door and finds its own way ashore.**
    //
    // Every door in this game is in the south wall, so the cell a player
    // stands on to board is the one directly below her — and on this world's
    // south-facing coast that cell is open sea, with the beach *behind* her.
    // A jetty laid in a straight line from there sails away from the land.
    //
    // So it is walked instead: out from the boarding cell, over water, to
    // whatever is nearest that a person can already stand on — the beach, a
    // pier, another jetty. Round her hull and back to the shore, which is
    // what a jetty to a moored ship actually looks like. Two attempts came
    // before this one, and both moored her beautifully and left her
    // unboardable.
    const board = { col: door.col, row: door.row + 1 };
    const berth = new Set<string>();
    for (let row = top.row; row < top.row + SHIP_SIZE.height; row++) {
      for (let col = top.col; col < top.col + SHIP_SIZE.width; col++) {
        berth.add(`${col},${row}`);
      }
    }
    const gangway = walkAshore(grid, box, board, berth);
    if (!gangway) continue;
    for (const plank of gangway) grid.setBridge(plank.col, plank.row, true);

    const ship: PlacedObject = {
      id: "harbour-ship",
      type: "ship",
      col: top.col,
      row: top.row,
      width: SHIP_SIZE.width,
      height: SHIP_SIZE.height,
      blocksMovement: true,
      anchorCol: top.col,
      anchorRow: top.row,
    };
    grid.placeObject(ship);
    return { ship, gangway };
  }
  return null;
}

function put(grid: WorldGrid, id: string, type: string, at: GridPoint): PlacedObject | null {
  if (!grid.inBounds(at.col, at.row) || grid.getObjectAt(at.col, at.row)) return null;
  const object: PlacedObject = {
    id,
    type,
    col: at.col,
    row: at.row,
    width: 1,
    height: 1,
    blocksMovement: true,
    anchorCol: at.col,
    anchorRow: at.row,
  };
  grid.placeObject(object);
  return object;
}

/**
 * Build the harbour.
 *
 * Order matters and is the usual one: pave first, then deck, then put things
 * on top — so nothing has to be undone and every later step can ask the grid
 * what is already there rather than being told.
 */
export function layoutHarbour(grid: WorldGrid, box: AreaPlacement, rng: Rng): HarbourLayout | null {
  void rng;
  const shore = findShore(grid, box);
  if (!shore) return null;

  // --- the working front -------------------------------------------------

  // Paved back from the water, not out over it: the quay is the ground the
  // town works on, and the planks are a separate thing laid on the sea.
  const quay: GridPoint[] = [];
  for (const cell of shore.front) {
    for (let back = 0; back < QUAY_DEPTH; back++) {
      const at = seawardStep(shore, cell, -back);
      if (!inside(box, at.col, at.row) || !grid.inBounds(at.col, at.row)) continue;
      if (grid.getTerrain(at.col, at.row) === TerrainType.Water) continue;
      grid.setTerrain(at.col, at.row, TerrainType.Dirt);
      if (back === 0) quay.push(at);
    }
  }

  // --- the piers ---------------------------------------------------------

  const piers: GridPoint[][] = [];
  const spacing = Math.max(FRONT_GAP, Math.floor(shore.front.length / (PIERS + 1)));
  for (let n = 1; n <= PIERS && piers.length < PIERS; n++) {
    const root = shore.front[Math.min(shore.front.length - 1, n * spacing)];
    if (!root) continue;
    const planks = pierFrom(grid, box, shore, root);
    if (!planks) continue;
    for (const plank of planks) grid.setBridge(plank.col, plank.row, true);
    piers.push(planks);
  }
  // A harbour with nothing reaching the water is a beach. If the coast in
  // this box is too shallow or too ragged for the spaced roots, try every
  // shoreline cell rather than giving up on the piers.
  if (piers.length === 0) {
    for (const root of shore.front) {
      const planks = pierFrom(grid, box, shore, root);
      if (!planks) continue;
      for (const plank of planks) grid.setBridge(plank.col, plank.row, true);
      piers.push(planks);
      break;
    }
  }

  // --- the beacon ---------------------------------------------------------

  // Before the market rather than after it. The headland is a shoreline
  // cell like any other, and the stalls are laid along the whole front —
  // raised last, the lighthouse found its own point already occupied and
  // quietly gave up, which is exactly how the piers lost their landward
  // ends. The one-of-a-kind thing gets first refusal on where it stands.
  // The end of the shore that reaches furthest out to sea — the point,
  // rather than simply the first cell of the sorted front, which on a curved
  // coast is whichever end the sort happened to start at.
  const seawardness = (at: GridPoint) => at.col * shore.seaward.dCol + at.row * shore.seaward.dRow;
  const ends = [shore.front[0], shore.front.at(-1)].filter(Boolean) as GridPoint[];
  const point = (
    ends.length === 2
      ? ((seawardness(ends[0] as GridPoint) >= seawardness(ends[1] as GridPoint)
          ? ends[0]
          : ends[1]) as GridPoint)
      : ((ends[0] ?? quay[0]) as GridPoint)
  ) as GridPoint;
  const lighthouse = raise(grid, box, "harbour-lighthouse", LandmarkType.Lighthouse, point);

  // --- the ship -----------------------------------------------------------

  // Before the market, for the reason the beacon is: she moors off the
  // middle of the working front, and the stalls are laid the length of it.
  const moored = moorShip(grid, box, shore, quay);

  // --- where a visiting ship ties up --------------------------------------

  // After the great ship, never before her: she is an object on the grid the
  // moment she is moored, so asking now is what keeps a berth from being
  // found underneath her hull. One pier in a shallow corner may have no
  // berth and that is ordinary — it is a place to fish from.
  const berths: Berth[] = [];
  for (const [n, pier] of piers.entries()) {
    const lane = berthAt(grid, shore, pier);
    if (lane) berths.push({ pier: n, lane });
  }

  // --- what stands on the front ------------------------------------------

  const placed: PlacedObject[] = [];
  const buildings: PlacedObject[] = [];

  // Warehouses and a cottage behind the quay, spaced along the coast and set
  // back from the water by the quay's own depth plus their own height, so
  // the working front stays clear to walk.
  // Five, where it was three. *The harbour is an idle plane* — three
  // buildings and a quay, on a front laid out for four piers. Two more
  // warehouses fill the gaps between them, and the alternation keeps the
  // place somewhere people live rather than a row of sheds.
  //
  // Not every one gets built: a role whose anchor falls off the end of a
  // short shore, or whose footprint lands in the water, is quietly dropped
  // — which is what the three were already doing and why asking for more is
  // how a ragged coast ends up with any.
  const roles: readonly BuildingRole[] = ["store", "house", "store", "house", "store"];
  for (const [n, role] of roles.entries()) {
    const anchorCell = shore.front[Math.min(shore.front.length - 1, (n + 1) * spacing - 2)];
    if (!anchorCell) continue;
    const { width, height } = footprintFor(role);
    const back = seawardStep(shore, anchorCell, -(QUAY_DEPTH + height));
    const topLeft = { col: back.col - Math.floor(width / 2), row: back.row - height + 1 };
    if (!inside(box, topLeft.col, topLeft.row)) continue;
    if (!inside(box, topLeft.col + width - 1, topLeft.row + height - 1)) continue;
    let clear = true;
    for (let row = topLeft.row; row < topLeft.row + height && clear; row++) {
      for (let col = topLeft.col; col < topLeft.col + width && clear; col++) {
        if (!grid.inBounds(col, row)) clear = false;
        else if (grid.getObjectAt(col, row)) clear = false;
        else if (grid.getTerrain(col, row) === TerrainType.Water) clear = false;
        else if (grid.isBridged(col, row)) clear = false;
      }
    }
    if (!clear) continue;
    // The ground a building stands on is cleared, as the village does it, so
    // nothing scatters into its walls.
    for (let row = topLeft.row - 1; row <= topLeft.row + height; row++) {
      for (let col = topLeft.col - 1; col <= topLeft.col + width; col++) {
        if (grid.inBounds(col, row) && grid.getTerrain(col, row) !== TerrainType.Water) {
          grid.setTerrain(col, row, TerrainType.Dirt);
        }
      }
    }
    const building: PlacedObject = {
      id: `harbour-${role}-${n}`,
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
  }

  // The fish market: stalls along the front, between the piers, a lamp at
  // each pier root so the quay is legible after dark, and greenery between
  // them — a working front with nothing growing on it is a wharf.
  //
  // **Three rhythms sharing one run of cells, in a chain, so the order they
  // are written in is the order they get first refusal.** A cell is a stall,
  // else a lamp, else a planter — and because it is a chain rather than
  // three independent tests, the *last* arm is the common one however small
  // its modulus looks. Greenery is what has to be everywhere, so it is last.
  //
  // A wind pump was on this quay and has gone to the village. A playtest
  // said it did not make sense here and it does not: a pump lifts water for
  // something to grow, and what is beside a quay is the sea. The gardens are
  // where the water is wanted.
  //
  // `put` refuses a cell that is already taken, so nothing here has to be
  // undone: a rhythm that lands on an occupied cell simply does not place,
  // and the quay is one prop shorter.
  // Neither the piers nor the gangway: both are runs the player walks, and
  // a stall on one seals it off exactly as it sealed the piers off before
  // their landward ends were counted as part of them.
  const decked = new Set(
    [...piers.flat(), ...(moored?.gangway ?? [])].map((at) => `${at.col},${at.row}`),
  );
  for (const [n, cell] of quay.entries()) {
    if (decked.has(`${cell.col},${cell.row}`)) continue;
    if (n % 4 === 0) {
      placed.push(
        ...[put(grid, `harbour-stall-${n}`, FixtureType.Stall, cell)]
          .filter(Boolean)
          .map((o) => o as PlacedObject),
      );
    } else if (n % 7 === 0) {
      placed.push(
        ...[put(grid, `harbour-lamp-${n}`, FixtureType.Lamp, cell)]
          .filter(Boolean)
          .map((o) => o as PlacedObject),
      );
    } else if (n % 3 === 0) {
      // And the common one. Greenery is the half of this that has to be
      // everywhere — a quay with two machines and no plants on it is an
      // industrial estate, which is the exact thing solarpunk is not.
      placed.push(
        ...[put(grid, `harbour-planter-${n}`, FixtureType.Planter, cell)]
          .filter(Boolean)
          .map((o) => o as PlacedObject),
      );
    }
  }

  // --- where it is entered from -------------------------------------------

  // The middle of the front, stepped back off the quay onto plain land and
  // kept clear. Never a plank: see `doorstep` above.
  const middle = quay[Math.floor(quay.length / 2)] ?? shore.front[0];
  let doorstep = middle as GridPoint;
  for (let back = 1; back <= QUAY_DEPTH + 2; back++) {
    const at = seawardStep(shore, middle as GridPoint, -back);
    if (!grid.inBounds(at.col, at.row)) break;
    if (grid.getTerrain(at.col, at.row) === TerrainType.Water) continue;
    if (grid.isBridged(at.col, at.row) || grid.getObjectAt(at.col, at.row)) continue;
    doorstep = at;
    break;
  }
  grid.removeObjectAt(doorstep.col, doorstep.row);

  if (lighthouse) placed.push(lighthouse);
  if (moored) placed.push(moored.ship);

  const npcs: VillageNpcSpec[] = [];
  for (const shop of buildings.filter((building) => building.type === "store")) {
    npcs.push({
      id: `${shop.id}-keeper`,
      role: SHOPKEEPER_ROLE,
      homeBuildingId: shop.id,
      home: { col: shop.col + Math.floor(shop.width / 2), row: shop.row + shop.height },
      indoors: true,
    });
  }
  // Spaced along the cells of the front that are actually clear, rather than
  // along the front and then dropped where they are not: a quay has stalls
  // and bollards on it, and sampling first meant a harbour with one person
  // in it whenever the sample happened to land on them.
  const standing = quay.filter(
    (at) => grid.isPassable(at.col, at.row) && !grid.isBridged(at.col, at.row),
  );
  // The fisherman, at the foot of the first pier that has one.
  //
  // At a pier rather than anywhere along the front, and that is worth a
  // line: what he teaches is dealing a catch out into equal baskets, and
  // the place a catch is landed is where a boat ties up. A teacher standing
  // among the stalls would be a man who happens to be here.
  //
  // He keeps the quay's hours like everybody else, and he is placed before
  // the crowd so that the four of them spread round him rather than one of
  // them standing on his cell.
  const landing = piers[0]?.[0] ?? standing[Math.floor(standing.length / 2)];
  if (landing) {
    npcs.push({
      id: FISHER_ID,
      role: FISHER_ROLE,
      home: { ...landing },
      homeBuildingId: "",
      indoors: false,
    });
  }
  // The anglers, out at the ends of the jetties.
  //
  // Before the crowd, for the reason the fisherman is: the four along the
  // front are spread over whatever cells are left, and a person placed after
  // them can land on somebody. The pier's *last* plank, which is the one out
  // over open water — a jetty is only worth walking to the end of.
  const taken = new Set(npcs.map((npc) => `${npc.home.col},${npc.home.row}`));
  for (const [n, pier] of piers.entries()) {
    for (let which = 0; which < ANGLERS_PER_PIER; which++) {
      const tip = pier.at(-1 - which);
      if (!tip || taken.has(`${tip.col},${tip.row}`)) continue;
      taken.add(`${tip.col},${tip.row}`);
      npcs.push({
        id: `harbour-angler-${n}-${which}`,
        homeBuildingId: "",
        home: { ...tip },
        indoors: false,
      });
    }
  }
  for (let n = 0; n < QUAYSIDE_FOLK && standing.length > 0; n++) {
    const at = standing[Math.floor((n * standing.length) / QUAYSIDE_FOLK)] as GridPoint;
    npcs.push({
      id: `harbour-folk-${n}`,
      homeBuildingId: "",
      home: { col: at.col, row: at.row },
      indoors: false,
    });
  }

  return {
    quay,
    piers,
    berths,
    buildings,
    placed,
    npcs,
    lighthouse,
    ship: moored?.ship ?? null,
    gangway: moored?.gangway ?? [],
    doorstep,
  };
}
