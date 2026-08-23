// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { GridPoint } from "./topdown";

/**
 * A room the person living in it can add to, a square at a time.
 *
 * Six of the game's seven rooms are a picture and stay one. The cottage is
 * where somebody lives, and a child builds it out a square at a time by
 * casting the addition spell on a floor that is not there yet — so it cannot
 * be a picture at all. The wall it grows through is a wall that has to come
 * down, and you cannot take a wall out of a PNG.
 *
 * **A plan is its floor, and nothing else.** Everything else about the room
 * is worked out from that: which cells are wall, what shape each wall is,
 * where the room begins and ends, what may be built next. Storing the walls
 * as well would be storing a second copy of the same fact, and a save whose
 * two copies disagreed would be a room with a wall through the middle of it.
 *
 * **A wall is a cell, not an edge.** The shipped cottage is eight by six with
 * a one-cell wall ring round a six-by-four floor — `blocked_cells` has always
 * said so. Walls here are exactly that: the cells around the floor, including
 * the diagonal ones, which is what gives a corner something to stand in.
 *
 * **Room space, not grid space.** The plan is written in coordinates whose
 * origin is the shipped room's own, and growing west or north takes cells
 * negative. That is fine and it is why `planBounds` exists: the grid the
 * player actually walks on is built over the bounding box, and the offset
 * between the two is carried by whoever built it. Forcing the plan to stay
 * positive instead would mean renumbering every cell in a save the first
 * time a child added a room on the west side.
 */

/** A cell, as it is keyed in a plan. `col,row`, and no spaces. */
export type CellKey = string;

export function cellKey(col: number, row: number): CellKey {
  return `${col},${row}`;
}

export function cellOf(key: CellKey): GridPoint {
  const [col, row] = key.split(",");
  return { col: Number(col), row: Number(row) };
}

/** The floor somebody has built. Everything else is derived from it. */
export interface RoomPlan {
  readonly floor: ReadonlySet<CellKey>;
}

/** The four ways a wall can have floor against it, and the one that faces you. */
export const WallBit = {
  FloorSouth: 1,
  FloorNorth: 2,
  FloorWest: 4,
  FloorEast: 8,
  /**
   * Set when the cell to the north is *outside the room*.
   *
   * Which is what makes a wall one you are looking at rather than one seen
   * from above, and the only reason a wall tile is taller than a cell. The
   * generator's atlas is indexed by exactly this number — see the note at
   * the foot of interiors.py.
   */
  Faces: 16,
} as const;

/** How many tiles the wall atlas holds: every combination of the five bits. */
export const WALL_MASKS = 32;

const ORTHOGONAL: readonly (readonly [number, number])[] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

const AROUND: readonly (readonly [number, number])[] = [
  ...ORTHOGONAL,
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

export function planOf(cells: Iterable<GridPoint>): RoomPlan {
  const floor = new Set<CellKey>();
  for (const { col, row } of cells) floor.add(cellKey(col, row));
  return { floor };
}

export function planFromKeys(keys: Iterable<CellKey>): RoomPlan {
  return { floor: new Set(keys) };
}

export function isFloor(plan: RoomPlan, col: number, row: number): boolean {
  return plan.floor.has(cellKey(col, row));
}

/**
 * Every cell the room occupies: its floor, and the ring of wall round it.
 *
 * Diagonals included. A room with only its orthogonal neighbours walled has
 * a hole at every outside corner, which is a room you can see the grass
 * through.
 */
export function roomCells(plan: RoomPlan): Set<CellKey> {
  const room = new Set<CellKey>(plan.floor);
  for (const key of plan.floor) {
    const { col, row } = cellOf(key);
    for (const [dc, dr] of AROUND) room.add(cellKey(col + dc, row + dr));
  }
  return room;
}

/** The cells that are wall: in the room, but not floor. */
export function wallCells(plan: RoomPlan): Set<CellKey> {
  const walls = roomCells(plan);
  for (const key of plan.floor) walls.delete(key);
  return walls;
}

/**
 * Which tile of the atlas this wall cell wears.
 *
 * The five facts, as one number, in the generator's own bit order. Computed
 * rather than stored for the reason the walls themselves are: it is a fact
 * about the plan, and a stored copy is a copy that can go stale the moment
 * somebody builds next to it.
 */
export function wallMaskAt(plan: RoomPlan, col: number, row: number): number {
  const room = roomCells(plan);
  return maskFrom(plan, room, col, row);
}

function maskFrom(plan: RoomPlan, room: ReadonlySet<CellKey>, col: number, row: number): number {
  let mask = room.has(cellKey(col, row - 1)) ? 0 : WallBit.Faces;
  if (isFloor(plan, col, row + 1)) mask |= WallBit.FloorSouth;
  if (isFloor(plan, col, row - 1)) mask |= WallBit.FloorNorth;
  if (isFloor(plan, col - 1, row)) mask |= WallBit.FloorWest;
  if (isFloor(plan, col + 1, row)) mask |= WallBit.FloorEast;
  return mask;
}

/** Every wall cell and the tile it wears, worked out in one pass. */
export function wallMasks(plan: RoomPlan): Map<CellKey, number> {
  const room = roomCells(plan);
  const masks = new Map<CellKey, number>();
  for (const key of room) {
    if (plan.floor.has(key)) continue;
    const { col, row } = cellOf(key);
    masks.set(key, maskFrom(plan, room, col, row));
  }
  return masks;
}

export interface PlanBounds {
  readonly minCol: number;
  readonly minRow: number;
  readonly maxCol: number;
  readonly maxRow: number;
  readonly cols: number;
  readonly rows: number;
}

/** The box the whole room fits in, walls included. */
export function planBounds(plan: RoomPlan): PlanBounds {
  let minCol = Number.POSITIVE_INFINITY;
  let minRow = Number.POSITIVE_INFINITY;
  let maxCol = Number.NEGATIVE_INFINITY;
  let maxRow = Number.NEGATIVE_INFINITY;
  for (const key of roomCells(plan)) {
    const { col, row } = cellOf(key);
    minCol = Math.min(minCol, col);
    minRow = Math.min(minRow, row);
    maxCol = Math.max(maxCol, col);
    maxRow = Math.max(maxRow, row);
  }
  return { minCol, minRow, maxCol, maxRow, cols: maxCol - minCol + 1, rows: maxRow - minRow + 1 };
}

/**
 * Why a square cannot be built on, or null if it can.
 *
 * A reason rather than a boolean, because every one of them is something the
 * game has to be able to say to a child standing on the spot. "You cannot
 * build there" with no more than that is the kind of refusal that reads as
 * the game being broken.
 */
export const NoBuild = {
  /** Already floor. Nothing to add. */
  Built: "built",
  /**
   * Not touching the room.
   *
   * A room has to stay one room. Without this a child could put a square of
   * floor in the middle of the village green, and the wall ring round it
   * would be a shed nobody can get into.
   */
  Adrift: "adrift",
  /**
   * At or past the front wall.
   *
   * The door is a hole in the south wall that lines up with the door of the
   * building outside, and the building does not move. So the front of the
   * house stays where it is and the room grows the other three ways — which
   * is also the rule that keeps a child from walling their own door in.
   */
  PastTheDoor: "past-the-door",
} as const;

export type NoBuild = (typeof NoBuild)[keyof typeof NoBuild];

export function whyNotBuild(plan: RoomPlan, at: GridPoint, door: GridPoint): NoBuild | null {
  if (isFloor(plan, at.col, at.row)) return NoBuild.Built;
  if (at.row >= door.row) return NoBuild.PastTheDoor;
  const touching = ORTHOGONAL.some(([dc, dr]) => isFloor(plan, at.col + dc, at.row + dr));
  if (!touching) return NoBuild.Adrift;
  return null;
}

export function canBuild(plan: RoomPlan, at: GridPoint, door: GridPoint): boolean {
  return whyNotBuild(plan, at, door) === null;
}

/**
 * Why a square cannot be taken up again, or null if it can.
 *
 * The mirror of `whyNotBuild`, and it needs more reasons than building does.
 * Putting a square down can only ever make a room bigger; taking one up can
 * strand somebody, bury the furniture, brick up the front door, or cut the
 * room in half — and the last of those is not visible from the square being
 * tapped, which is why it is worked out rather than guessed at.
 */
export const NoUnbuild = {
  /** Nothing there to take up. */
  Bare: "bare",
  /**
   * Somebody is standing on it, or something is.
   *
   * A child who pulled the floor out from under themselves would be standing
   * in a wall, and the bed does not move out of the way to be helpful.
   */
  Occupied: "occupied",
  /**
   * The square inside the front door.
   *
   * Take that one up and the doorway opens onto a wall: the way in is a hole
   * in the south wall with floor behind it, and this is the floor. The one
   * mistake in here that would need an adult and a save file to undo.
   */
  Doorway: "doorway",
  /**
   * The room would fall into two rooms.
   *
   * Not a rule about tidiness — a room in two halves is a child walled into
   * whichever half they were standing in. A hole in the middle is fine and
   * reads as a pillar; a hole that severs is not.
   */
  WouldSplit: "would-split",
} as const;

export type NoUnbuild = (typeof NoUnbuild)[keyof typeof NoUnbuild];

/** The square behind the front door: the floor the way in opens onto. */
export function doorInside(door: GridPoint): GridPoint {
  return { col: door.col, row: door.row - 1 };
}

export function whyNotUnbuild(
  plan: RoomPlan,
  at: GridPoint,
  door: GridPoint,
  occupied: Iterable<CellKey> = [],
): NoUnbuild | null {
  if (!isFloor(plan, at.col, at.row)) return NoUnbuild.Bare;
  const inside = doorInside(door);
  if (at.col === inside.col && at.row === inside.row) return NoUnbuild.Doorway;
  for (const key of occupied) {
    if (key === cellKey(at.col, at.row)) return NoUnbuild.Occupied;
  }
  if (!staysWhole(plan, at, inside)) return NoUnbuild.WouldSplit;
  return null;
}

export function canUnbuild(
  plan: RoomPlan,
  at: GridPoint,
  door: GridPoint,
  occupied: Iterable<CellKey> = [],
): boolean {
  return whyNotUnbuild(plan, at, door, occupied) === null;
}

/**
 * Whether every square left is still walkable to from the front door.
 *
 * A flood fill rather than a cleverer test, because the cheap tests are the
 * ones that are wrong: counting neighbours says a corridor one tile wide is
 * fine to cut, and looking only at the eight cells round the hole cannot see
 * that the two halves it separates rejoin the long way round. A room is at
 * most a few hundred squares and this runs once per tap.
 */
function staysWhole(plan: RoomPlan, without: GridPoint, from: GridPoint): boolean {
  const gone = cellKey(without.col, without.row);
  const left = new Set<CellKey>(plan.floor);
  left.delete(gone);
  const start = cellKey(from.col, from.row);
  if (!left.has(start)) return false;

  const seen = new Set<CellKey>([start]);
  const queue: GridPoint[] = [from];
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head] as GridPoint;
    for (const [dc, dr] of ORTHOGONAL) {
      const key = cellKey(at.col + dc, at.row + dr);
      if (!left.has(key) || seen.has(key)) continue;
      seen.add(key);
      queue.push(cellOf(key));
    }
  }
  return seen.size === left.size;
}

/** The plan with one square of floor taken back out of it. */
export function unbuildFrom(plan: RoomPlan, at: GridPoint): RoomPlan {
  const floor = new Set(plan.floor);
  floor.delete(cellKey(at.col, at.row));
  return { floor };
}

/**
 * Every square that could be taken up right now.
 *
 * What the game paints when the minus rune is armed indoors, and the same
 * function that decides whether a tap lands — so what a child is shown and
 * what they can do are one list rather than two rules that agree until they
 * do not.
 */
export function removableCells(
  plan: RoomPlan,
  door: GridPoint,
  occupied: Iterable<CellKey> = [],
): GridPoint[] {
  const taken = new Set(occupied);
  const wanted: GridPoint[] = [];
  for (const key of plan.floor) {
    const at = cellOf(key);
    if (canUnbuild(plan, at, door, taken)) wanted.push(at);
  }
  return wanted.sort((a, b) => a.row - b.row || a.col - b.col);
}

/** The plan with one more square of floor in it. */
export function buildOn(plan: RoomPlan, at: GridPoint): RoomPlan {
  const floor = new Set(plan.floor);
  floor.add(cellKey(at.col, at.row));
  return { floor };
}

/**
 * Every square that could be built on next.
 *
 * What the game paints when the spell is armed, and the same function that
 * decides whether a tap lands — so what a child is shown and what they can
 * do are the same list rather than two rules that agree until they do not.
 */
export function buildableCells(plan: RoomPlan, door: GridPoint): GridPoint[] {
  const wanted: GridPoint[] = [];
  for (const key of wallCells(plan)) {
    const at = cellOf(key);
    if (canBuild(plan, at, door)) wanted.push(at);
  }
  return wanted.sort((a, b) => a.row - b.row || a.col - b.col);
}

/**
 * Where the windows go.
 *
 * Only walls whose face is turned toward the viewer can hold one, and they
 * are spread rather than placed: a window every few columns along whatever
 * the north edge turned out to be. Derived from the plan for the same reason
 * everything else here is — a window remembered by cell would end up in the
 * middle of a room the first time somebody built north of it.
 */
export function windowCells(plan: RoomPlan, every = 3): GridPoint[] {
  const facing: GridPoint[] = [];
  for (const [key, mask] of wallMasks(plan)) {
    if ((mask & WallBit.Faces) === 0) continue;
    if ((mask & WallBit.FloorSouth) === 0) continue;
    facing.push(cellOf(key));
  }
  facing.sort((a, b) => a.row - b.row || a.col - b.col);
  // Spread along each run of north wall separately, so a wing three cells
  // wide gets one rather than inheriting the count of the wall behind it.
  const windows: GridPoint[] = [];
  let runRow = Number.NaN;
  let along = 0;
  let lastCol = Number.NaN;
  for (const at of facing) {
    if (at.row !== runRow || at.col !== lastCol + 1) {
      runRow = at.row;
      along = 0;
    }
    lastCol = at.col;
    if (along % every === 1) windows.push(at);
    along++;
  }
  return windows;
}

/**
 * A rectangle of the room, in the plan's own coordinates.
 *
 * The times spell marks one out and then does the same thing to every square
 * of it. Deliberately not the garden's `Patch`, which is measured in the
 * grid the player walks on — the two differ by the plan's origin, and the
 * conversion is the caller's to do once rather than this module's to guess.
 */
export interface PlanPatch {
  readonly col: number;
  readonly row: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Which squares of a marked rectangle could be built on, in the order they
 * may go down.
 *
 * **Walked forward rather than tested against the room as it stands.** Every
 * square laid changes what the next one may touch: a patch two squares deep
 * can only reach the far one because the near one is about to exist, and a
 * list checked against the plan on screen would offer the near square and
 * silently drop the far one. Repeated until a pass finds nothing new, which
 * is what lets a rectangle fill outward from whatever edge it touches.
 *
 * `most` caps it at what somebody can pay for. The cells kept are a *prefix*
 * of the order they were found in, and that is safe by construction: each
 * one was buildable given only the ones before it.
 */
export function buildableIn(
  plan: RoomPlan,
  patch: PlanPatch,
  door: GridPoint,
  most = Number.POSITIVE_INFINITY,
): GridPoint[] {
  let growing = plan;
  const wanted: GridPoint[] = [];
  let more = true;
  while (more) {
    more = false;
    for (let row = patch.row; row < patch.row + patch.height; row++) {
      for (let col = patch.col; col < patch.col + patch.width; col++) {
        const at = { col, row };
        if (!canBuild(growing, at, door)) continue;
        growing = buildOn(growing, at);
        wanted.push(at);
        more = true;
      }
    }
  }
  return wanted.slice(0, Math.max(0, most));
}

/**
 * Which squares of a marked rectangle could be taken up, in the order they
 * may go.
 *
 * Walked forward like `buildableIn`, for the sharper version of the same
 * reason: four squares that could each come up on their own can cut the room
 * in half if all four go, and a list checked against the room as it stands
 * would offer exactly that.
 */
export function removableIn(
  plan: RoomPlan,
  patch: PlanPatch,
  door: GridPoint,
  occupied: Iterable<CellKey> = [],
): GridPoint[] {
  const taken = new Set(occupied);
  let shrinking = plan;
  const wanted: GridPoint[] = [];
  for (let row = patch.row; row < patch.row + patch.height; row++) {
    for (let col = patch.col; col < patch.col + patch.width; col++) {
      const at = { col, row };
      if (!canUnbuild(shrinking, at, door, taken)) continue;
      shrinking = unbuildFrom(shrinking, at);
      wanted.push(at);
    }
  }
  return wanted;
}
