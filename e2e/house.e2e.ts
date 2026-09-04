// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { Spell } from "../src/spells/spellbook";
import { DecorType } from "../src/world/decor";
import { Turn } from "../src/world/facing";
import { PatchAction } from "../src/world/selection";
import { type Game, patchButton, play, runeButton, shutDown, takeFromCrate } from "./harness";

/**
 * Building a house, and the wall of bricks that pays for each square of it.
 *
 * `houseScenario.test.ts` plays this same loop against the pure modules and
 * plays it in a tenth of a second — but everything it drives is a function
 * call. What a child does is arm a rune, tap a square, answer a wall of
 * bricks, and watch the room change, and the wiring between those lives in
 * the scene, which is where two of the three bugs written while this was
 * built actually were.
 *
 * The pure tests say the rules are right. These say the rules are *reached*.
 *
 * **The other half of this story is in `furnishing.e2e.ts`**, and the split
 * is for the browser rather than for the reader. One file gets one browser,
 * every reload re-boots the whole game — a world generated, sheets
 * recoloured, several hundred requests — and a browser asked for enough
 * pages in a row stops answering. At ten scenarios this file took seven
 * minutes and hung on the last of them; the same ten pass in two halves.
 * The fix for that is always to split the file and never to raise the
 * timeout, because a timeout raised is a browser given longer to die in.
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
  /** Which way round it is standing. See `turning.e2e.ts`. */
  readonly turn: number;
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
  await game.stopped();
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

/*
 * The crate's buttons were named by position here — "the tenth: seven
 * fixtures, then bed, table, chair" — which stopped being true when a
 * machine joined the fixtures, and stopped being *meaningful* when the crate
 * grew a second level and showed one group at a time.
 *
 * `takeFromCrate` opens the group a thing lives in and taps the thing, which
 * is what a child does and what these scenarios now say.
 */

describe("building a room out", () => {
  test(
    "a square of floor costs a wall of bricks, a plank and a stone",
    async () => {
      await play({ seams: AT_HOME }, async (game) => {
        const before = await goHome(game);
        const wood = await game.held("wood");
        const stone = await game.held("stone");

        await game.tap("spellbook");
        await game.tap(runeButton(Spell.Growth));
        expect(await game.seam<string | null>("armed")).toBe("growth");

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
        await game.tap(runeButton(Spell.Growth));
        expect(await game.seam<string | null>("armed")).toBe("growth");
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
        await game.tap(runeButton(Spell.Clearing));
        expect(await game.seam<string | null>("armed")).toBe("clearing");
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
        await game.tap(runeButton(Spell.Clearing));
        expect(await game.seam<string | null>("armed")).toBe("clearing");
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
        await game.tap(runeButton(Spell.Clearing));
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
        await game.tap(runeButton(Spell.Array));
        // Indoors the choice is plus or minus. Plus lays floor.
        expect(await game.tap(patchButton(PatchAction.Build))).toBe(true);

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
