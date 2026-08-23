// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import {
  NoBuild,
  NoUnbuild,
  type RoomPlan,
  WALL_MASKS,
  WallBit,
  buildOn,
  buildableCells,
  canBuild,
  canUnbuild,
  cellKey,
  cellOf,
  isFloor,
  planBounds,
  planOf,
  removableCells,
  roomCells,
  unbuildFrom,
  wallCells,
  wallMaskAt,
  wallMasks,
  whyNotBuild,
  whyNotUnbuild,
  windowCells,
} from "./growableRoom";
import { PLAN_MARGIN, buildPlanGrid } from "./interiors";

/** The cottage as it ships: a six-by-four floor inside a one-cell wall ring. */
const SHIPPED = planOf(
  Array.from({ length: 4 }, (_, r) =>
    Array.from({ length: 6 }, (_, c) => ({ col: c + 1, row: r + 1 })),
  ).flat(),
);
const DOOR = { col: 4, row: 5 };

const keys = (points: readonly { col: number; row: number }[]) =>
  points.map(({ col, row }) => cellKey(col, row)).sort();

describe("what a plan is", () => {
  test("a cell key survives the round trip, negatives included", () => {
    for (const at of [
      { col: 0, row: 0 },
      { col: 7, row: 3 },
      { col: -4, row: -12 },
    ]) {
      expect(cellOf(cellKey(at.col, at.row))).toEqual(at);
    }
  });

  test("the shipped cottage is six by four inside eight by six", () => {
    expect(SHIPPED.floor.size).toBe(24);
    const bounds = planBounds(SHIPPED);
    expect({ cols: bounds.cols, rows: bounds.rows }).toEqual({ cols: 8, rows: 6 });
    expect({ minCol: bounds.minCol, minRow: bounds.minRow }).toEqual({ minCol: 0, minRow: 0 });
  });

  // The one-cell ring the sidecar has always described: the room is the floor
  // plus everything touching it, diagonals included.
  test("the walls are the ring round the floor, corners and all", () => {
    const walls = wallCells(SHIPPED);
    expect(walls.size).toBe(8 * 6 - 24);
    expect(walls.has(cellKey(0, 0))).toBe(true); // the north-west corner
    expect(walls.has(cellKey(7, 5))).toBe(true); // the south-east corner
    expect(walls.has(cellKey(1, 1))).toBe(false); // floor
    expect(roomCells(SHIPPED).size).toBe(48);
  });

  // Without the diagonals every outside corner of the room is a hole you can
  // see the grass through.
  test("an L-shaped room has no gap at its inside corner", () => {
    const bent = planOf([
      { col: 1, row: 1 },
      { col: 2, row: 1 },
      { col: 1, row: 2 },
    ]);
    const room = roomCells(bent);
    expect(room.has(cellKey(2, 2))).toBe(true);
    expect(room.has(cellKey(3, 2))).toBe(true);
  });
});

describe("which tile a wall wears", () => {
  test("the mask is the five facts, in the atlas's own bit order", () => {
    // The north wall above the floor: nothing behind it, floor in front.
    expect(wallMaskAt(SHIPPED, 3, 0)).toBe(WallBit.Faces | WallBit.FloorSouth);
    // The south wall: floor behind it, and it is seen from above.
    expect(wallMaskAt(SHIPPED, 3, 5)).toBe(WallBit.FloorNorth);
    // The west wall: floor to its east.
    expect(wallMaskAt(SHIPPED, 0, 2)).toBe(WallBit.FloorEast);
    expect(wallMaskAt(SHIPPED, 7, 2)).toBe(WallBit.FloorWest);
  });

  // The rise is the face of a wall you look at. A corner of the north wall
  // has nothing behind it either, so it rises too — which is what the shipped
  // picture does, and why its plaster runs the full width of the room.
  test("a wall faces you when there is nothing north of it", () => {
    for (const col of [0, 3, 7]) {
      expect({ col, faces: (wallMaskAt(SHIPPED, col, 0) & WallBit.Faces) !== 0 }).toEqual({
        col,
        faces: true,
      });
    }
    for (const at of [
      { col: 0, row: 2 },
      { col: 3, row: 5 },
    ]) {
      expect({ at, faces: (wallMaskAt(SHIPPED, at.col, at.row) & WallBit.Faces) !== 0 }).toEqual({
        at,
        faces: false,
      });
    }
  });

  test("every wall gets exactly one tile, and it is one the atlas holds", () => {
    const masks = wallMasks(SHIPPED);
    expect(masks.size).toBe(wallCells(SHIPPED).size);
    for (const [key, mask] of masks) {
      expect({ key, ok: Number.isInteger(mask) && mask >= 0 && mask < WALL_MASKS }).toEqual({
        key,
        ok: true,
      });
      expect(masks.get(key)).toBe(wallMaskAt(SHIPPED, cellOf(key).col, cellOf(key).row));
    }
  });

  /**
   * The impossible combination, checked rather than assumed.
   *
   * `Faces` means the cell to the north is outside the room; `FloorNorth`
   * means it is floor. Both at once would be a wall with a hole behind it,
   * and a tile drawn for that case would be a tile nothing ever asks for.
   */
  test("no wall both faces you and has floor behind it", () => {
    const grown = [
      SHIPPED,
      buildOn(SHIPPED, { col: 3, row: 0 }),
      buildOn(buildOn(SHIPPED, { col: 0, row: 2 }), { col: -1, row: 2 }),
    ];
    for (const plan of grown) {
      for (const [key, mask] of wallMasks(plan)) {
        const both = (mask & WallBit.Faces) !== 0 && (mask & WallBit.FloorNorth) !== 0;
        expect({ key, both }).toEqual({ key, both: false });
      }
    }
  });
});

describe("growing it", () => {
  test("building north of the room adds a square and moves the wall up", () => {
    const at = { col: 3, row: 0 };
    expect(wallCells(SHIPPED).has(cellKey(at.col, at.row))).toBe(true);
    const grown = buildOn(SHIPPED, at);
    expect(isFloor(grown, at.col, at.row)).toBe(true);
    // The wall did not stay where it was: it is a row further out now.
    expect(wallCells(grown).has(cellKey(at.col, at.row))).toBe(false);
    expect(wallCells(grown).has(cellKey(at.col, at.row - 1))).toBe(true);
    expect(planBounds(grown).minRow).toBe(-1);
  });

  // Room space is allowed to go negative, and this is why. Renumbering every
  // cell in a save the first time somebody built on the west side is the
  // alternative, and it is a migration that runs on somebody's house.
  test("and growing west takes the plan negative rather than renumbering it", () => {
    let plan = SHIPPED;
    for (const col of [0, -1, -2]) plan = buildOn(plan, { col, row: 2 });
    expect(planBounds(plan).minCol).toBe(-3);
    expect(isFloor(plan, -2, 2)).toBe(true);
    // Everything that was there is still where it was.
    expect(isFloor(plan, 1, 1)).toBe(true);
  });

  test("a square already built on cannot be built on again", () => {
    expect(whyNotBuild(SHIPPED, { col: 1, row: 1 }, DOOR)).toBe(NoBuild.Built);
  });

  // A room has to stay one room. A square of floor out on the green would
  // come with a wall ring of its own — a shed nobody can get into.
  test("a square that touches nothing cannot be built on", () => {
    expect(whyNotBuild(SHIPPED, { col: 40, row: 2 }, DOOR)).toBe(NoBuild.Adrift);
    // Diagonal is not touching: two rooms joined at a corner is two rooms.
    expect(whyNotBuild(SHIPPED, { col: 0, row: 0 }, DOOR)).toBe(NoBuild.Adrift);
    expect(canBuild(SHIPPED, { col: 0, row: 2 }, DOOR)).toBe(true);
  });

  /**
   * The front of the house stays put.
   *
   * The door is a hole in the south wall lined up with the door of the
   * building outside, and the building does not move. It is also the rule
   * that stops a child walling in their own front door, which is the one
   * mistake here that would need an adult and a save file to undo.
   */
  test("nothing may be built at or past the front wall", () => {
    expect(whyNotBuild(SHIPPED, DOOR, DOOR)).toBe(NoBuild.PastTheDoor);
    expect(whyNotBuild(SHIPPED, { col: 2, row: 5 }, DOOR)).toBe(NoBuild.PastTheDoor);
    expect(whyNotBuild(SHIPPED, { col: 2, row: 9 }, DOOR)).toBe(NoBuild.PastTheDoor);
    // And the door is still a doorway in a wall after the room has grown.
    let plan = SHIPPED;
    for (const at of buildableCells(SHIPPED, DOOR).slice(0, 6)) plan = buildOn(plan, at);
    expect(isFloor(plan, DOOR.col, DOOR.row)).toBe(false);
    expect(isFloor(plan, DOOR.col, DOOR.row - 1)).toBe(true);
  });

  test("what is offered and what is allowed are the same list", () => {
    let plan = SHIPPED;
    for (let step = 0; step < 12; step++) {
      const offered = buildableCells(plan, DOOR);
      expect(offered.length).toBeGreaterThan(0);
      for (const at of offered) {
        expect({ at, ok: canBuild(plan, at, DOOR) }).toEqual({ at, ok: true });
      }
      // Everything allowed is offered, too — checked over the whole box the
      // room could reach into rather than over the offer itself.
      const bounds = planBounds(plan);
      const shown = new Set(keys(offered));
      for (let row = bounds.minRow - 1; row <= bounds.maxRow + 1; row++) {
        for (let col = bounds.minCol - 1; col <= bounds.maxCol + 1; col++) {
          if (!canBuild(plan, { col, row }, DOOR)) continue;
          expect({ col, row, offered: shown.has(cellKey(col, row)) }).toEqual({
            col,
            row,
            offered: true,
          });
        }
      }
      plan = buildOn(plan, offered[step % offered.length] as { col: number; row: number });
    }
  });

  test("building never loses a square that was there", () => {
    let plan: RoomPlan = SHIPPED;
    const was = new Set(plan.floor);
    for (const at of buildableCells(SHIPPED, DOOR)) plan = buildOn(plan, at);
    for (const key of was) expect(plan.floor.has(key)).toBe(true);
    // And the original is untouched: a plan is a value, not a thing to edit.
    expect(SHIPPED.floor.size).toBe(24);
  });
});

describe("where the windows go", () => {
  test("only on walls whose face is turned toward you", () => {
    for (const at of windowCells(SHIPPED)) {
      const mask = wallMaskAt(SHIPPED, at.col, at.row);
      expect({ at, faces: (mask & WallBit.Faces) !== 0 }).toEqual({ at, faces: true });
      expect({ at, indoors: (mask & WallBit.FloorSouth) !== 0 }).toEqual({ at, indoors: true });
    }
  });

  test("the shipped room gets the two it has always had", () => {
    expect(windowCells(SHIPPED).length).toBe(2);
  });

  // A window remembered by cell would end up in the middle of the room the
  // first time somebody built north of it.
  test("and they move to the new north wall when the room grows", () => {
    let plan = SHIPPED;
    for (let col = 1; col <= 6; col++) plan = buildOn(plan, { col, row: 0 });
    for (const at of windowCells(plan)) {
      expect({ at, row: at.row }).toEqual({ at, row: -1 });
    }
  });
});

describe("the grid a plan is walked on", () => {
  const parts = { cell: [1, 1] as const, footprint: [2, 1] as const, blocks: true };
  /** Plan space to grid space, which is what every caller actually does. */
  const on = (origin: { col: number; row: number }, col: number, row: number) => ({
    col: col - origin.col,
    row: row - origin.row,
  });

  test("it is the room, plus a margin of ground on every side", () => {
    const { grid, origin, extent } = buildPlanGrid(SHIPPED, DOOR);
    expect({ cols: extent.cols, rows: extent.rows }).toEqual({ cols: 8, rows: 6 });
    expect({ width: grid.width, height: grid.height }).toEqual({
      width: 8 + PLAN_MARGIN * 2,
      height: 6 + PLAN_MARGIN * 2,
    });
    expect(origin).toEqual({ col: -PLAN_MARGIN, row: -PLAN_MARGIN });
  });

  /**
   * The margin is the whole reason building out works at all.
   *
   * The grid used to stop at the wall, so the outermost cell anybody could
   * tap *was* the wall — `tileAtWorld` answers null past the grid's edge,
   * and a tap on nothing does nothing. One cast could add a strip one square
   * deep and no more.
   */
  test("and the margin is ground you can aim at but not stand on", () => {
    const { grid, origin } = buildPlanGrid(SHIPPED, DOOR);
    for (let out = 1; out <= PLAN_MARGIN; out++) {
      const above = on(origin, 3, -out);
      expect({ out, onTheGrid: grid.inBounds(above.col, above.row) }).toEqual({
        out,
        onTheGrid: true,
      });
      expect({ out, standable: grid.isPassable(above.col, above.row) }).toEqual({
        out,
        standable: false,
      });
    }
    // And it really does end somewhere.
    const far = on(origin, 3, -(PLAN_MARGIN + 1));
    expect(grid.inBounds(far.col, far.row)).toBe(false);
  });

  /**
   * The trap the margin set, written down so it cannot be reset.
   *
   * Walking out of a door used to be detected as *stepping off the grid* —
   * true of every room that is a picture, because their grid ends at the
   * wall. A growable room's does not: the cell past the doorway is still on
   * the grid, so the old rule shut a child inside their own house. Leaving
   * is stepping out of the *room*, and the two stopped being the same thing
   * here.
   */
  test("the cell past the doorway is still on the grid", () => {
    const { grid, origin } = buildPlanGrid(SHIPPED, DOOR);
    const out = on(origin, DOOR.col, DOOR.row + 1);
    expect(grid.inBounds(out.col, out.row)).toBe(true);
    expect(grid.isPassable(out.col, out.row)).toBe(false);
    // And the doorway itself is a long way from the grid's own edge.
    const door = on(origin, DOOR.col, DOOR.row);
    expect(door.row).toBeLessThan(grid.height - 1);
  });

  test("the offset comes back with it, and moves when the room grows", () => {
    const grown = buildOn(buildOn(SHIPPED, { col: 0, row: 2 }), { col: -1, row: 2 });
    const { origin, extent } = buildPlanGrid(grown, DOOR);
    expect(extent.minCol).toBe(-2);
    expect(origin.col).toBe(-2 - PLAN_MARGIN);
  });

  test("walls block, floor does not, and the doorway is the way out", () => {
    const { grid, origin } = buildPlanGrid(SHIPPED, DOOR);
    const at = (col: number, row: number) => on(origin, col, row);
    const floor = at(3, 2);
    expect(grid.isPassable(floor.col, floor.row)).toBe(true);
    for (const wall of [at(0, 2), at(3, 0)]) {
      expect(grid.isPassable(wall.col, wall.row)).toBe(false);
    }
    // The one wall cell left open. Stepping off it is how you leave.
    const door = at(DOOR.col, DOOR.row);
    expect(grid.isPassable(door.col, door.row)).toBe(true);
  });

  /**
   * A bent room has a hollow in its bounding box that is neither floor nor
   * wall, and nothing is drawn there. Nothing may be walked there either, or
   * a child standing in it can see the grass through their own house.
   */
  test("the hollow of a bent room is not somewhere you can stand", () => {
    const bent = buildOn(SHIPPED, { col: 0, row: 1 });
    const { grid, origin } = buildPlanGrid(bent, DOOR);
    const built = on(origin, 0, 1);
    expect(grid.isPassable(built.col, built.row)).toBe(true);
    // The corner beyond the room's reach, inside the grid all the same.
    const spare = on(origin, -1, 5);
    expect(grid.inBounds(spare.col, spare.row)).toBe(true);
    expect(grid.isPassable(spare.col, spare.row)).toBe(false);
  });

  test("furniture that blocks, blocks", () => {
    const { grid, origin } = buildPlanGrid(SHIPPED, DOOR, [parts]);
    const at = (col: number, row: number) => on(origin, col, row);
    for (const taken of [at(1, 1), at(2, 1)]) {
      expect(grid.isPassable(taken.col, taken.row)).toBe(false);
    }
    const free = at(3, 1);
    expect(grid.isPassable(free.col, free.row)).toBe(true);
    // And a rug does not.
    const loose = buildPlanGrid(SHIPPED, DOOR, [{ ...parts, blocks: false }]);
    const rug = on(loose.origin, 1, 1);
    expect(loose.grid.isPassable(rug.col, rug.row)).toBe(true);
  });

  // The room a child walks in is the room the plan describes, whatever they
  // built and in whatever order — checked over a run of them rather than at
  // one shape, because the offset is the thing most likely to drift.
  test("every square of floor is standable and every wall is not, as it grows", () => {
    let plan = SHIPPED;
    for (let step = 0; step < 14; step++) {
      const offered = buildableCells(plan, DOOR);
      plan = buildOn(plan, offered[step % offered.length] as { col: number; row: number });
      const { grid, origin } = buildPlanGrid(plan, DOOR);
      for (const key of plan.floor) {
        const { col, row } = cellOf(key);
        const at = on(origin, col, row);
        expect({ step, key, walkable: grid.isPassable(at.col, at.row) }).toEqual({
          step,
          key,
          walkable: true,
        });
      }
      for (const key of wallCells(plan)) {
        const { col, row } = cellOf(key);
        if (col === DOOR.col && row === DOOR.row) continue;
        const at = on(origin, col, row);
        expect({ step, key, walkable: grid.isPassable(at.col, at.row) }).toEqual({
          step,
          key,
          walkable: false,
        });
      }
    }
  });
});

describe("taking a square back up", () => {
  const inside = { col: DOOR.col, row: DOOR.row - 1 };

  test("a square with nothing on it comes up", () => {
    const at = { col: 1, row: 1 };
    expect(whyNotUnbuild(SHIPPED, at, DOOR)).toBeNull();
    const smaller = unbuildFrom(SHIPPED, at);
    expect(isFloor(smaller, at.col, at.row)).toBe(false);
    expect(smaller.floor.size).toBe(SHIPPED.floor.size - 1);
    // And it is a value: the plan it came from is untouched.
    expect(SHIPPED.floor.size).toBe(24);
  });

  test("bare ground has nothing to take up", () => {
    expect(whyNotUnbuild(SHIPPED, { col: 3, row: 0 }, DOOR)).toBe(NoUnbuild.Bare);
    expect(whyNotUnbuild(SHIPPED, { col: 40, row: 40 }, DOOR)).toBe(NoUnbuild.Bare);
  });

  // A child who pulled the floor out from under themselves would be standing
  // in a wall, and the bed does not move out of the way to be helpful.
  test("not from under somebody, and not from under the furniture", () => {
    const taken = [cellKey(2, 2), cellKey(5, 4)];
    expect(whyNotUnbuild(SHIPPED, { col: 2, row: 2 }, DOOR, taken)).toBe(NoUnbuild.Occupied);
    expect(whyNotUnbuild(SHIPPED, { col: 5, row: 4 }, DOOR, taken)).toBe(NoUnbuild.Occupied);
    expect(whyNotUnbuild(SHIPPED, { col: 3, row: 2 }, DOOR, taken)).toBeNull();
  });

  /**
   * The one mistake in here that would need an adult and a save file.
   *
   * The way in is a hole in the south wall with floor behind it. Take that
   * floor up and the doorway opens onto a wall.
   */
  test("never the square behind the front door", () => {
    expect(whyNotUnbuild(SHIPPED, inside, DOOR)).toBe(NoUnbuild.Doorway);
    // And it is still refused once the room has grown round it.
    let plan = SHIPPED;
    for (const at of buildableCells(SHIPPED, DOOR).slice(0, 8)) plan = buildOn(plan, at);
    expect(whyNotUnbuild(plan, inside, DOOR)).toBe(NoUnbuild.Doorway);
  });

  /**
   * A room in two halves is a child walled into whichever half they were
   * standing in — which the square being tapped gives no hint of, and which
   * the cheap tests get wrong: counting neighbours says a corridor one tile
   * wide is fine to cut.
   */
  test("and never a square that would cut the room in two", () => {
    // A dumbbell: two ends joined by a single square of corridor, with the
    // door at the bottom of one of them.
    const corridor = planOf([
      { col: 4, row: 4 }, // behind the door
      { col: 4, row: 3 },
      { col: 4, row: 2 }, // the neck
      { col: 4, row: 1 },
      { col: 3, row: 1 },
      { col: 5, row: 1 },
    ]);
    expect(whyNotUnbuild(corridor, { col: 4, row: 2 }, DOOR)).toBe(NoUnbuild.WouldSplit);
    // The far end is a dead end and may go: nothing is behind it.
    expect(whyNotUnbuild(corridor, { col: 3, row: 1 }, DOOR)).toBeNull();
  });

  // A hole in the middle of a room is fine and reads as a pillar. Only a
  // hole that *severs* is refused, which is the whole reason this is a flood
  // fill rather than a look at the eight cells round the tap.
  test("but a hole in the middle of a room is allowed", () => {
    expect(whyNotUnbuild(SHIPPED, { col: 3, row: 2 }, DOOR)).toBeNull();
    const holed = unbuildFrom(SHIPPED, { col: 3, row: 2 });
    // Everything else is still reachable, so the next one is allowed too.
    expect(whyNotUnbuild(holed, { col: 4, row: 2 }, DOOR)).toBeNull();
  });

  test("what is offered and what is allowed are the same list", () => {
    let plan = SHIPPED;
    for (let step = 0; step < 10; step++) {
      const taken = [cellKey(2, 3)];
      const offered = removableCells(plan, DOOR, taken);
      for (const at of offered) {
        expect({ at, ok: canUnbuild(plan, at, DOOR, taken) }).toEqual({ at, ok: true });
      }
      const shown = new Set(offered.map(({ col, row }) => cellKey(col, row)));
      for (const key of plan.floor) {
        const at = cellOf(key);
        if (!canUnbuild(plan, at, DOOR, taken)) continue;
        expect({ key, offered: shown.has(key) }).toEqual({ key, offered: true });
      }
      const next = offered[step % offered.length];
      if (!next) break;
      plan = unbuildFrom(plan, next);
    }
  });

  /**
   * However much is taken up, the room stays one room with a way out.
   *
   * Checked by taking squares up until nothing may be, rather than at one
   * shape: the rules are local and the thing they protect is not.
   */
  test("a room stripped as far as it will go is still one room with a door", () => {
    let plan = SHIPPED;
    for (let step = 0; step < 60; step++) {
      const offered = removableCells(plan, DOOR);
      const next = offered[0];
      if (!next) break;
      plan = unbuildFrom(plan, next);
      // Everything left is still walkable to from behind the front door.
      const seen = new Set<string>([cellKey(inside.col, inside.row)]);
      const queue = [inside];
      for (let head = 0; head < queue.length; head++) {
        const at = queue[head] as { col: number; row: number };
        for (const [dc, dr] of [
          [0, -1],
          [0, 1],
          [-1, 0],
          [1, 0],
        ]) {
          const key = cellKey(at.col + (dc as number), at.row + (dr as number));
          if (!plan.floor.has(key) || seen.has(key)) continue;
          seen.add(key);
          queue.push(cellOf(key));
        }
      }
      expect({ step, whole: seen.size === plan.floor.size }).toEqual({ step, whole: true });
      expect(isFloor(plan, inside.col, inside.row)).toBe(true);
    }
    // It strips down to the one square it may never take up.
    expect(plan.floor.size).toBe(1);
  });
});
