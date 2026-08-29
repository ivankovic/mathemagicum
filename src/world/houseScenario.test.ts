// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import {
  type Placed,
  cellsUnder,
  decorFromSave,
  decorToSave,
  fits,
  occupiedCells,
  same,
  without,
} from "./decor";
import { DecorType } from "./decor";
import { Turn } from "./facing";
import {
  type CellKey,
  type RoomPlan,
  buildOn,
  buildableCells,
  buildableIn,
  canUnbuild,
  cellKey,
  cellOf,
  doorInside,
  isFloor,
  planOf,
  removableCells,
  removableIn,
  unbuildFrom,
} from "./growableRoom";
import { PLAN_MARGIN, buildPlanGrid } from "./interiors";
import { createRng, randInt } from "./rng";
import type { GridPoint } from "./topdown";

/**
 * Playing a house, rather than testing one function of it.
 *
 * The rest of the suite checks each rule on its own and checks them well.
 * Every bug that actually got written while this feature was built lived
 * somewhere *between* two of them — a grid rebuilt from a plan that wiped the
 * furniture standing on it, a rule that read the shipped placements after the
 * bed had been moved, an arrangement compared by reference across an array
 * that is rebuilt on every read. None of those is visible from inside one
 * module, and all of them are visible from a room somebody is using.
 *
 * So these run the *sequence*: build a wing, furnish it, move things about,
 * take the floor back up, save it, load it, and carry on — asserting after
 * every step that the room is still a room.
 */

/** The cottage as it ships: a six-by-four floor inside a one-cell wall ring. */
const SHIPPED = planOf(
  Array.from({ length: 4 }, (_, r) =>
    Array.from({ length: 6 }, (_, c) => ({ col: c + 1, row: r + 1 })),
  ).flat(),
);
const DOOR: GridPoint = { col: 4, row: 5 };
const INSIDE = doorInside(DOOR);

/** The sizes the shipped art draws these at. */
const SIZES = {
  [DecorType.Bed]: { cols: 1, rows: 2 },
  [DecorType.Table]: { cols: 2, rows: 1 },
  [DecorType.Chair]: { cols: 1, rows: 1 },
  [DecorType.Rug]: { cols: 2, rows: 2 },
  [DecorType.Bookshelf]: { cols: 1, rows: 1 },
  // The fire, which is furniture now: a stove stands on the floor where a
  // fireplace was built into the wall.
  [DecorType.Stove]: { cols: 1, rows: 1 },
  // The kitchen and the washroom. One cell each but the bath, which is a
  // thing you lie down in.
  [DecorType.Sink]: { cols: 1, rows: 1 },
  [DecorType.Dresser]: { cols: 1, rows: 1 },
  [DecorType.Kettle]: { cols: 1, rows: 1 },
  [DecorType.Bath]: { cols: 2, rows: 1 },
  [DecorType.Washstand]: { cols: 1, rows: 1 },
  [DecorType.Privy]: { cols: 1, rows: 1 },
};

/** The arrangement the cottage ships with, in the same cells the sidecar has. */
const FURNISHED: Placed[] = [
  { piece: DecorType.Bookshelf, col: 6, row: 1, look: 0, turn: Turn.Toward },
  { piece: DecorType.Bed, col: 1, row: 2, look: 0, turn: Turn.Toward },
  { piece: DecorType.Table, col: 5, row: 2, look: 0, turn: Turn.Toward },
  { piece: DecorType.Chair, col: 5, row: 3, look: 0, turn: Turn.Toward },
  { piece: DecorType.Rug, col: 3, row: 3, look: 0, turn: Turn.Toward },
];

/** The hearth, which is not furniture and never moves. */
const HEARTH: readonly CellKey[] = [cellKey(1, 1), cellKey(2, 1)];

/**
 * The arrangement as the scene hands it back: fresh objects every time.
 *
 * `decorIn` rebuilds a room nobody has rearranged from the sidecar on every
 * read, so the chair a sprite captured a moment ago is a *different object*
 * from the chair that comes back this time. Every step here goes through
 * this, because without it a scenario passes with the arrangement compared
 * by reference — which is the bug that shipped, and this file was written to
 * catch it and did not until it did this.
 */
function reread(decor: readonly Placed[]): Placed[] {
  return decor.map((placed) => ({ ...placed }));
}

/** Everything the minus spell must not take the floor from under. */
function spokenFor(decor: readonly Placed[], standing?: GridPoint): Set<CellKey> {
  const taken = occupiedCells(decor, SIZES);
  for (const key of HEARTH) taken.add(key);
  if (standing) taken.add(cellKey(standing.col, standing.row));
  return taken;
}

/**
 * Everything that must be true of a room at every moment.
 *
 * Asserted after each step rather than at the end, so a failure names the
 * move that broke it rather than the one that happened to notice.
 */
function roomHolds(plan: RoomPlan, decor: readonly Placed[], step: string): void {
  // Nothing stands on air.
  for (const placed of decor) {
    for (const at of cellsUnder(placed, SIZES)) {
      expect({
        step,
        piece: placed.piece,
        at: cellKey(at.col, at.row),
        onFloor: isFloor(plan, at.col, at.row),
      }).toEqual({ step, piece: placed.piece, at: cellKey(at.col, at.row), onFloor: true });
    }
  }
  // Nothing stands on anything else. Counted rather than compared pairwise,
  // because the failure this catches is a piece *duplicated* rather than two
  // pieces overlapping — which is what a compare-by-reference bug produces.
  const cells = decor.flatMap((placed) => cellsUnder(placed, SIZES));
  expect({
    step,
    overlaps: cells.length - new Set(cells.map((c) => cellKey(c.col, c.row))).size,
  }).toEqual({ step, overlaps: 0 });
  // The way out is still floor, and every square of the room is walkable to
  // from it.
  expect({ step, doorway: isFloor(plan, INSIDE.col, INSIDE.row) }).toEqual({ step, doorway: true });
  const seen = new Set<CellKey>([cellKey(INSIDE.col, INSIDE.row)]);
  const queue: GridPoint[] = [INSIDE];
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head] as GridPoint;
    for (const [dc, dr] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ] as const) {
      const key = cellKey(at.col + dc, at.row + dr);
      if (!plan.floor.has(key) || seen.has(key)) continue;
      seen.add(key);
      queue.push(cellOf(key));
    }
  }
  expect({ step, whole: seen.size === plan.floor.size }).toEqual({ step, whole: true });

  // And the grid she walks on agrees with the plan she is walking in.
  const blockers = decor.map((placed) => {
    const size = SIZES[placed.piece];
    return {
      cell: [placed.row, placed.col] as const,
      footprint: [size.cols, size.rows] as const,
      blocks: placed.piece !== DecorType.Rug,
    };
  });
  const { grid, origin } = buildPlanGrid(plan, DOOR, blockers);
  for (const key of plan.floor) {
    const { col, row } = cellOf(key);
    const at = { col: col - origin.col, row: row - origin.row };
    const blocked = blockers.some((piece) => {
      if (!piece.blocks) return false;
      const [pr, pc] = piece.cell;
      const [pw, ph] = piece.footprint;
      return col >= pc && col < pc + pw && row >= pr && row < pr + ph;
    });
    expect({ step, key, standable: grid.isPassable(at.col, at.row) }).toEqual({
      step,
      key,
      standable: !blocked,
    });
  }
  // The ground beyond the walls is on the grid and not standable, which is
  // what lets a rectangle be aimed into it.
  const out = { col: INSIDE.col - origin.col, row: INSIDE.row - origin.row - PLAN_MARGIN };
  expect({ step, aimable: grid.inBounds(out.col, out.row) }).toEqual({ step, aimable: true });
}

describe("furnishing a room somebody built", () => {
  /**
   * The sequence the whole feature exists for, run end to end.
   *
   * Building a wing, walking a chair into it, and finding the floor under the
   * chair is now protected — three modules, and the rule that reads the
   * arrangement is in a fourth.
   */
  test("build a wing, move a chair into it, and the floor under it is safe", () => {
    let plan = SHIPPED;
    let decor = FURNISHED;

    // Four squares north of the old wall: a wing.
    const wing: GridPoint[] = [
      { col: 2, row: 0 },
      { col: 3, row: 0 },
      { col: 2, row: -1 },
      { col: 3, row: -1 },
    ];
    for (const at of wing) {
      expect({
        at: cellKey(at.col, at.row),
        buildable: buildableCells(plan, DOOR).some((one) =>
          same(
            { ...one, piece: DecorType.Chair, look: 0 },
            { ...at, piece: DecorType.Chair, look: 0 },
          ),
        ),
      }).toEqual({ at: cellKey(at.col, at.row), buildable: true });
      plan = buildOn(plan, at);
      roomHolds(plan, decor, `built ${cellKey(at.col, at.row)}`);
    }

    // The chair goes into it. Picked up first, which is what moving is —
    // and the arrangement is re-read in between, exactly as the scene does.
    const chair = decor.find((one) => one.piece === DecorType.Chair) as Placed;
    decor = without(reread(decor), chair);
    expect(decor.filter((one) => one.piece === DecorType.Chair)).toEqual([]);
    roomHolds(plan, decor, "chair lifted");

    const moved: Placed = { ...chair, col: 3, row: -1 };
    expect(fits(moved, decor, SIZES, (col, row) => isFloor(plan, col, row))).toBe(true);
    decor = [...decor, moved];
    roomHolds(plan, decor, "chair set down in the wing");

    // And now the floor under it is spoken for.
    expect(canUnbuild(plan, { col: 3, row: -1 }, DOOR, spokenFor(decor))).toBe(false);
    // The square beside it is not.
    expect(canUnbuild(plan, { col: 2, row: -1 }, DOOR, spokenFor(decor))).toBe(true);

    // Lift the chair again and the floor comes free.
    decor = without(reread(decor), moved);
    expect(canUnbuild(plan, { col: 3, row: -1 }, DOOR, spokenFor(decor))).toBe(true);
    plan = unbuildFrom(plan, { col: 3, row: -1 });
    roomHolds(plan, decor, "floor taken back up");

    // And the chair cannot go back where there is no longer a floor.
    expect(fits(moved, decor, SIZES, (col, row) => isFloor(plan, col, row))).toBe(false);
  });

  /**
   * The rug is walked over and still keeps its floor.
   *
   * Two different questions about one square — "may I stand here" and "may I
   * take this up" — and the answers differ for exactly one piece. Worth its
   * own step in a scenario because the two rules live in two modules and
   * nothing else makes them disagree.
   */
  test("a rug blocks the minus spell without blocking the player", () => {
    const rug = FURNISHED.find((one) => one.piece === DecorType.Rug) as Placed;
    const under = cellsUnder(rug, SIZES)[0] as GridPoint;
    expect(canUnbuild(SHIPPED, under, DOOR, spokenFor(FURNISHED))).toBe(false);

    const blockers = FURNISHED.map((placed) => {
      const size = SIZES[placed.piece];
      return {
        cell: [placed.row, placed.col] as const,
        footprint: [size.cols, size.rows] as const,
        blocks: placed.piece !== DecorType.Rug,
      };
    });
    const { grid, origin } = buildPlanGrid(SHIPPED, DOOR, blockers);
    expect(grid.isPassable(under.col - origin.col, under.row - origin.row)).toBe(true);
  });

  /**
   * The hearth is not furniture and its floor is safe anyway.
   *
   * It is not in the arrangement — a child cannot carry the fire out of their
   * own house — so nothing about the arrangement protects it, and the rule
   * has to add it by hand. That is exactly the sort of thing that gets
   * dropped in a refactor.
   */
  test("and the floor under the hearth can never be taken up", () => {
    for (const key of HEARTH) {
      expect({ key, safe: !canUnbuild(SHIPPED, cellOf(key), DOOR, spokenFor(FURNISHED)) }).toEqual({
        key,
        safe: true,
      });
    }
  });
});

describe("the times spell over a room", () => {
  /**
   * A rectangle two squares deep can only reach the far one because the near
   * one is about to exist — the whole reason the offer walks a plan forward
   * rather than testing against the room on screen.
   */
  test("a patch beyond the wall fills outward, not just its first row", () => {
    const patch = { col: 2, row: -1, width: 4, height: 2 };
    const offered = buildableIn(SHIPPED, patch, DOOR);
    expect(offered.length).toBe(8);
    // Every square in the rectangle, and each one buildable given only the
    // ones before it.
    let plan = SHIPPED;
    for (const at of offered) {
      expect({
        at: cellKey(at.col, at.row),
        ok: buildableCells(plan, DOOR).some((one) => one.col === at.col && one.row === at.row),
      }).toEqual({ at: cellKey(at.col, at.row), ok: true });
      plan = buildOn(plan, at);
    }
  });

  // Capped by the basket, and the prefix kept is safe by construction: each
  // cell was buildable given only the ones before it.
  test("and what the basket will pay for is a prefix that still works", () => {
    const patch = { col: 2, row: -1, width: 4, height: 2 };
    for (const most of [0, 1, 3, 8, 99]) {
      const offered = buildableIn(SHIPPED, patch, DOOR, most);
      expect({ most, count: offered.length }).toEqual({ most, count: Math.min(most, 8) });
      let plan = SHIPPED;
      for (const at of offered) {
        expect({
          most,
          at: cellKey(at.col, at.row),
          ok: buildableCells(plan, DOOR).some((o) => o.col === at.col && o.row === at.row),
        }).toEqual({ most, at: cellKey(at.col, at.row), ok: true });
        plan = buildOn(plan, at);
      }
    }
  });

  /**
   * Four squares that could each come up on their own can cut the room in
   * half if all four go.
   *
   * The offer has to walk forward for exactly this, and checking the
   * consequence is the only way to know it did: applying the whole list must
   * leave a room, not two rooms.
   */
  test("taking up a whole patch never leaves the room in two", () => {
    const patch = { col: 1, row: 1, width: 6, height: 4 };
    const offered = removableIn(SHIPPED, patch, DOOR, spokenFor([]));
    let plan = SHIPPED;
    for (const at of offered) plan = unbuildFrom(plan, at);
    roomHolds(plan, [], "whole patch taken up");
  });

  test("and it never offers a square something is standing on", () => {
    const patch = { col: 1, row: 1, width: 6, height: 4 };
    const taken = spokenFor(FURNISHED);
    for (const at of removableIn(SHIPPED, patch, DOOR, taken)) {
      expect({ at: cellKey(at.col, at.row), spoken: taken.has(cellKey(at.col, at.row)) }).toEqual({
        at: cellKey(at.col, at.row),
        spoken: false,
      });
    }
  });
});

describe("a room played with for a while", () => {
  /**
   * Build, unbuild, lift and set down at random, and check after every move.
   *
   * The bugs this is for do not need a clever sequence — they need *a*
   * sequence. A chair duplicated by a compare-by-reference, a piece left
   * standing on floor that was taken out from under it, a room quietly cut
   * in two: none survives two hundred moves with the invariants checked
   * between each.
   *
   * Seeded, so a failure is one somebody can reproduce.
   */
  test("stays a room, whatever is done to it", () => {
    const rng = createRng(20260823);
    let plan = SHIPPED;
    let decor = FURNISHED;

    for (let move = 0; move < 200; move++) {
      const roll = randInt(rng, 0, 3);
      if (roll === 0) {
        const offered = buildableCells(plan, DOOR);
        const at = offered[randInt(rng, 0, offered.length - 1)];
        if (at) plan = buildOn(plan, at);
      } else if (roll === 1) {
        const offered = removableCells(plan, DOOR, spokenFor(decor));
        const at = offered[randInt(rng, 0, offered.length - 1)];
        if (at) plan = unbuildFrom(plan, at);
      } else if (roll === 2 && decor.length > 0) {
        // Read, then act on what was read, with a rebuild in between: the
        // sprite that was tapped captured its piece one frame ago.
        const at = { ...(decor[randInt(rng, 0, decor.length - 1)] as Placed) };
        decor = without(reread(decor), at);
      } else {
        // Set something down on a square that will take it.
        const piece = [DecorType.Chair, DecorType.Rug, DecorType.Bed][
          randInt(rng, 0, 2)
        ] as DecorType;
        const floor = [...plan.floor].map(cellOf);
        const spot = floor[randInt(rng, 0, floor.length - 1)];
        if (spot) {
          const wanted: Placed = { piece, col: spot.col, row: spot.row, look: randInt(rng, 0, 4) };
          if (fits(wanted, decor, SIZES, (col, row) => isFloor(plan, col, row))) {
            decor = [...decor, wanted];
          }
        }
      }
      roomHolds(plan, decor, `move ${move}`);
    }
    // It really did get used: the room is not the one it started as.
    expect(plan.floor.size).not.toBe(SHIPPED.floor.size);
  });

  /**
   * Put it down, write it down, read it back, carry on.
   *
   * The save tests check one fact each — a crop, a fence, a plan. This is the
   * thing a child actually does: play, close the tab, come back, and keep
   * playing in the room they left.
   */
  test("a room survives being written down and picked up again", () => {
    let plan = SHIPPED;
    let decor = FURNISHED;
    for (const at of buildableCells(plan, DOOR).slice(0, 5)) plan = buildOn(plan, at);
    const chair = decor.find((one) => one.piece === DecorType.Chair) as Placed;
    decor = [...without(decor, chair), { ...chair, col: 2, row: 4, look: 3 }];
    roomHolds(plan, decor, "before saving");

    // Through JSON, because that is what a save is.
    const floorBack = JSON.parse(JSON.stringify([...plan.floor])) as CellKey[];
    const decorBack = decorFromSave(JSON.parse(JSON.stringify(decorToSave(decor))));
    const reopened: RoomPlan = { floor: new Set(floorBack) };

    expect(reopened.floor).toEqual(plan.floor);
    expect(decorBack).toEqual(decor);
    roomHolds(reopened, decorBack, "after loading");

    // And it can still be built on, which is the half a round trip usually
    // forgets to check.
    const next = buildableCells(reopened, DOOR)[0] as GridPoint;
    const grown = buildOn(reopened, next);
    roomHolds(grown, decorBack, "built on after loading");
  });
});
