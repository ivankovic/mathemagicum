// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { type Game, play, shutDown } from "./harness";

/**
 * Building a house, and coming back to it tomorrow.
 *
 * `houseScenario.test.ts` plays this same loop against the pure modules and
 * plays it in a tenth of a second — but everything it drives is a function
 * call. What a child does is arm a rune, tap a square, answer a wall of
 * bricks, and watch the room change, and the wiring between those lives in
 * the scene, which is where two of the three bugs written while this was
 * built actually were.
 *
 * The pure tests say the rules are right. These say the rules are *reached*.
 */

const MINUTES = 60_000;

/**
 * Noon so nothing is dark, a full basket so nothing has to be gathered
 * first, and the shortest wall on the ladder — the sums are not what is
 * being tested here, only that answering one builds something.
 */
const AT_HOME = "&hour=12&materials=40&brickRung=1";

// The dev server goes when this file is done with it, which is safe again
// now that `run.ts` gives every scenario file a process of its own: there is
// no next file in here to pull it out from under. Left to the process's own
// exit handler it did not go at all — a bun test that finishes does not run
// them reliably — and each run left a Vite behind.
afterAll(shutDown);

/** The room's floor plan, as the game will describe it. */
interface House {
  readonly id: string | null;
  /** Floor squares, in the plan's own coordinates, which may be negative. */
  readonly floor: string[];
  /** Plan coordinates minus grid coordinates. */
  readonly origin: { col: number; row: number };
  /** Where she could build next — in *grid* coordinates, as she taps them. */
  readonly buildable: { col: number; row: number }[];
}

interface Piece {
  readonly piece: string;
  readonly col: number;
  readonly row: number;
  readonly look: number;
}

/**
 * In through her own front door.
 *
 * Put down on the doorstep rather than walked there from the spawn: a child
 * starts in the middle of their own garden beds, eight rows off, and walking
 * that on a held arrow key is eight seconds of nothing being tested that
 * gets stuck the first time a fence moves.
 */
async function goHome(game: Game): Promise<House> {
  const door = (await game.seam<Record<string, { col: number; row: number }>>("doors"))[
    "player-house"
  ];
  if (!door) throw new Error("the village has no house for the player");
  await game.standAt(door.col, door.row + 2, "up");
  await game.walk("ArrowUp", 900);
  await game.settle(800);
  const house = await game.seam<House | null>("house");
  if (!house) throw new Error("walking through the front door did not go indoors");
  return house;
}

/**
 * Plan coordinates to the grid ones a tap is aimed in.
 *
 * The two are the same room described from two places, and every square
 * named in here is named the way the sidecar names it — the fireplace at
 * (1,1), the door at (4,5) — so the offset is applied once, here.
 */
function grid(house: House, col: number, row: number): { col: number; row: number } {
  return { col: col - house.origin.col, row: row - house.origin.row };
}

async function tapPlan(game: Game, house: House, col: number, row: number): Promise<void> {
  const at = grid(house, col, row);
  await game.tapCell(at.col, at.row);
}

/** The crate's tenth slot: seven fixtures, then bed, table, chair. */
const CHAIR_SLOT = "crate.9";

describe("building a room out", () => {
  test(
    "a square of floor costs a wall of bricks, a plank and a stone",
    async () => {
      await play({ seams: AT_HOME }, async (game) => {
        const before = await goHome(game);
        const wood = await game.held("wood");
        const stone = await game.held("stone");

        await game.tap("spellbook");
        await game.tap("spellbook.0");
        expect(await game.seam("armed")).toBe("growth");

        const wanted = before.buildable[0];
        if (!wanted) throw new Error("the starting room has nowhere to grow");
        await game.tapCell(wanted.col, wanted.row);

        // The wall comes first: a square of house is paid for with a sum.
        expect(await game.seam("bricks")).not.toBeNull();
        await game.solveWall();

        const after = await game.seam<House>("house");
        expect(after.floor.length).toBe(before.floor.length + 1);
        expect(await game.held("wood")).toBe(wood - 1);
        expect(await game.held("stone")).toBe(stone - 1);
      });
    },
    5 * MINUTES,
  );

  /**
   * An empty basket buys nothing, and says so before the sums start.
   *
   * The rule as it was asked for: a square of house costs a plank and a
   * stone, and a child who has neither should be told that rather than made
   * to answer a wall for a room that will not be built. The precondition is
   * what makes this negative assertion mean anything — the same cast with a
   * full basket, one test up, opens the parchment.
   */
  test(
    "with nothing in the basket, no wall is even offered",
    async () => {
      await play({ seams: "&hour=12&brickRung=1" }, async (game) => {
        const before = await goHome(game);
        expect(await game.held("wood")).toBe(0);
        expect(await game.held("stone")).toBe(0);

        await game.tap("spellbook");
        await game.tap("spellbook.0");
        expect(await game.seam("armed")).toBe("growth");
        const wanted = before.buildable[0];
        if (!wanted) throw new Error("the starting room has nowhere to grow");
        await game.tapCell(wanted.col, wanted.row);
        await game.settle(700);

        expect(await game.seam("bricks")).toBeNull();
        expect((await game.seam<House>("house")).floor.length).toBe(before.floor.length);
      });
    },
    5 * MINUTES,
  );

  /**
   * And the minus rune takes one back up, handing back what it cost.
   *
   * A refund that did not match the price would make the spell either a
   * penalty for changing your mind or a way of printing planks, and which of
   * those it is comes down to one constant nothing was checking.
   */
  test(
    "the minus rune takes one back up, with the materials returned",
    async () => {
      await play({ seams: AT_HOME }, async (game) => {
        const before = await goHome(game);
        const wood = await game.held("wood");

        await game.tap("spellbook");
        await game.tap("spellbook.1");
        expect(await game.seam("armed")).toBe("clearing");
        // (3,1) is bare floor: clear of the fireplace, the shelf and the bed.
        await tapPlan(game, before, 3, 1);

        expect(await game.seam("spell")).not.toBeNull();
        await game.solveNumberLine();

        const after = await game.seam<House>("house");
        expect(after.floor.length).toBe(before.floor.length - 1);
        expect(after.floor).not.toContain("3,1");
        expect(await game.held("wood")).toBe(wood + 1);
      });
    },
    5 * MINUTES,
  );

  /**
   * Except the square behind the front door, which it must never take.
   *
   * Take that up and the doorway opens onto nothing — the one mistake in
   * here a child could not undo from inside the game.
   *
   * The rug is lifted first on purpose. It covers that square, so a refusal
   * with the rug still down proves only that furniture is protected, which
   * is a different rule that is tested below.
   */
  test(
    "but never the square behind the front door",
    async () => {
      await play({ seams: AT_HOME }, async (game) => {
        const before = await goHome(game);
        await tapPlan(game, before, 3, 3);
        await game.settle(500);
        expect((await game.seam<Piece[]>("decor")).some((one) => one.piece === "rug")).toBe(false);

        await game.tap("spellbook");
        await game.tap("spellbook.1");
        expect(await game.seam("armed")).toBe("clearing");
        await tapPlan(game, before, 4, 4);
        await game.settle(600);

        // No sum asked at all: the square was refused before the parchment.
        expect(await game.seam("spell")).toBeNull();
        const after = await game.seam<House>("house");
        expect(after.floor).toContain("4,4");
        expect(after.floor.length).toBe(before.floor.length);

        // And the rune was live all along. Without this the whole test is
        // satisfied by nothing happening — a tap that missed, or a spellbook
        // that quietly stopped arming, reads exactly the same as a refusal.
        await game.tap("spellbook");
        await game.tap("spellbook.1");
        await tapPlan(game, before, 2, 3);
        await game.settle(600);
        expect(await game.seam("spell")).not.toBeNull();
        // Put it away before the tab closes. A parchment left open while the
        // context is torn down is a tween firing at a destroyed object, and
        // the console error that follows is collected by `play` — arriving
        // after every assertion passed, with nothing pointing back here.
        await game.press("Escape");
      });
    },
    5 * MINUTES,
  );

  /**
   * A whole wing for one wall and one multiplication.
   *
   * Three parchments in a row, and the order is the spell's entire argument:
   * do the thing once by hand, then say how many times it happened. A wing
   * that went up before the multiplication was answered would make the sum
   * decoration.
   */
  test(
    "a wing goes up for one wall and one multiplication",
    async () => {
      await play({ seams: `${AT_HOME}&learned=all&arrayRung=0` }, async (game) => {
        const before = await goHome(game);
        const wood = await game.held("wood");

        await game.tap("spellbook");
        await game.tap("spellbook.3");
        // Indoors the choice is plus or minus. Plus lays floor.
        expect(await game.tap("patch.0")).toBe(true);

        // A strip four deep down the western wall, corner to corner.
        await tapPlan(game, before, 0, 1);
        expect(await game.seam("bricks")).toBeNull();
        await tapPlan(game, before, 0, 4);
        await game.settle(800);

        // The wall first, and nothing built yet.
        expect(await game.seam("bricks")).not.toBeNull();
        expect(await game.seam("array")).toBeNull();
        expect((await game.seam<House>("house")).floor.length).toBe(before.floor.length);
        await game.solveWall();

        // Then how many times over, and only then the floor.
        // Four squares, however the parchment chose to stand them up.
        const asked = await game.seam<{ rows: number; columns: number } | null>("array");
        if (!asked) throw new Error("the wall was answered and nothing was asked next");
        expect(asked.rows * asked.columns).toBe(4);
        await game.solveArray();

        const after = await game.seam<House>("house");
        expect(after.floor.length).toBe(before.floor.length + 4);
        expect(await game.held("wood")).toBe(wood - 4);
      });
    },
    5 * MINUTES,
  );
});

describe("furnishing it", () => {
  test(
    "a chair is picked up, carried, and put down somewhere else",
    async () => {
      await play({ seams: AT_HOME }, async (game) => {
        const house = await goHome(game);
        const chair = (await game.seam<Piece[]>("decor")).find((one) => one.piece === "chair");
        if (!chair) throw new Error("the room she starts in has no chair");
        expect(await game.held("chair~0")).toBe(0);

        await tapPlan(game, house, chair.col, chair.row);
        await game.settle(600);
        expect(await game.held("chair~0")).toBe(1);
        expect((await game.seam<Piece[]>("decor")).some((one) => one.piece === "chair")).toBe(
          false,
        );

        // Stand on clear floor facing clear floor, and put it down there.
        // One colour owned is not a choice, so it goes straight down.
        const standing = grid(house, 2, 2);
        await game.standAt(standing.col, standing.row, "down");
        await game.tap("crate");
        await game.tap(CHAIR_SLOT);
        await game.settle(700);

        expect(await game.held("chair~0")).toBe(0);
        expect(
          (await game.seam<Piece[]>("decor")).find((one) => one.piece === "chair"),
        ).toMatchObject({ col: 2, row: 3, look: 0 });
      });
    },
    5 * MINUTES,
  );

  /**
   * And the floor under it stops coming up — under where it *now* stands.
   *
   * The rule the children asked for out loud, and the one that fails
   * quietly: what is protected has to be read off the arrangement as it is,
   * not off the placements the sidecar shipped, or a chair somebody moved
   * would go on guarding the corner it came from and leave itself exposed.
   *
   * So the same square is cast on twice: once bare, where the spell must
   * open, and once with the chair on it, where it must not.
   */
  test(
    "and the floor under it is safe from the minus rune, where it now stands",
    async () => {
      await play({ seams: AT_HOME }, async (game) => {
        const house = await goHome(game);

        await game.tap("spellbook");
        await game.tap("spellbook.1");
        await tapPlan(game, house, 2, 3);
        expect(await game.seam("spell")).not.toBeNull();
        // Walk away from the sum rather than answering it: the square has to
        // still be there for the second half of this.
        await game.press("Escape");
        await game.settle(400);
        // Shut, not merely un-answered: a parchment still up leaves
        // `modalOpen` true, and every tap after this would be refused by the
        // trays rather than by the rule being tested.
        expect(await game.seam("spell")).toBeNull();
        expect((await game.seam<House>("house")).floor).toContain("2,3");

        const chair = (await game.seam<Piece[]>("decor")).find((one) => one.piece === "chair");
        if (!chair) throw new Error("no chair");
        await tapPlan(game, house, chair.col, chair.row);
        await game.settle(600);
        const standing = grid(house, 2, 2);
        await game.standAt(standing.col, standing.row, "down");
        await game.tap("crate");
        await game.tap(CHAIR_SLOT);
        await game.settle(700);
        expect(
          (await game.seam<Piece[]>("decor")).find((one) => one.piece === "chair"),
        ).toMatchObject({ col: 2, row: 3 });

        await game.tap("spellbook");
        await game.tap("spellbook.1");
        await tapPlan(game, house, 2, 3);
        await game.settle(600);
        expect(await game.seam("spell")).toBeNull();
        expect((await game.seam<House>("house")).floor).toContain("2,3");
      });
    },
    5 * MINUTES,
  );
});

describe("coming back tomorrow", () => {
  /**
   * A room a child built is a room they find again.
   *
   * `savedWorld.test.ts` round-trips a plan through JSON, which proves the
   * writing and the reading agree with each other and nothing about whether
   * either is called. This closes the tab.
   */
  test(
    "the room she built and the chair she moved are both still there",
    async () => {
      await play({ seams: AT_HOME }, async (game) => {
        const before = await goHome(game);

        await game.tap("spellbook");
        await game.tap("spellbook.0");
        const wanted = before.buildable[0];
        if (!wanted) throw new Error("nowhere to build");
        await game.tapCell(wanted.col, wanted.row);
        await game.solveWall();

        const chair = (await game.seam<Piece[]>("decor")).find((one) => one.piece === "chair");
        if (!chair) throw new Error("no chair");
        await tapPlan(game, before, chair.col, chair.row);
        await game.settle(600);
        const standing = grid(before, 2, 2);
        await game.standAt(standing.col, standing.row, "down");
        await game.tap("crate");
        await game.tap(CHAIR_SLOT);
        await game.settle(700);

        const built = (await game.seam<House>("house")).floor.slice().sort();
        const furnished = await game.seam<Piece[]>("decor");
        expect(built.length).toBe(before.floor.length + 1);

        await game.reload();
        const back = await goHome(game);

        expect(back.floor.slice().sort()).toEqual(built);
        expect(await game.seam<Piece[]>("decor")).toEqual(furnished);
      });
    },
    5 * MINUTES,
  );
});
