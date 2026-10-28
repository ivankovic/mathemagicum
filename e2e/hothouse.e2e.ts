// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { Spell } from "../src/spells/spellbook";
import { FixtureType } from "../src/world/fixtures";
import { MINUTES_PER_ROUND, SHARES } from "../src/world/machines";
import { type Game, play, runeButton, shutDown, takeFromCrate } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * The first machine, end to end: woken once, fed, worked by the clock, and
 * still there tomorrow.
 *
 * `machines.test.ts` proves the turning in a fraction of a second and every
 * assertion in it is a function call. What a child does is tap a hothouse,
 * be shown one sum, tip a heap of carrots in and come back to three piles of
 * timber — and none of that route is in the model. The waking is a
 * parchment, the tipping reaches into the basket, the work is driven by a
 * clock nothing else in the game measures, and the whole of it has to
 * survive being written down.
 *
 * It is also the piece with the quietest failure mode in the game. A
 * machine's state is not an object on the grid, not in the basket, and not
 * on screen beyond three little heaps in three crates: a hothouse that had
 * stopped working, or one working without ever having been woken, looks
 * exactly like one that works.
 *
 * This was the sorter's scenario until the sorter was taken out of the game.
 */
const WITH_TIMBER = "&materials=60&hour=12&freezeNpcs&learned=all";

/** How many carrots she tips in: a whole number of rounds, and few enough to finish in a wind. */
const CARROTS = 9;

interface Machine {
  where: string;
  awake: boolean;
  holding: string | null;
  heap: number;
  crates: number[];
  made: string | null;
}

const machines = (game: Game) => game.seam<Machine[]>("machines");

/** Build one, put it down beside her, and give back the square it is on. */
async function aHothouseBeside(game: Game): Promise<{ col: number; row: number }> {
  expect(await takeFromCrate(game, FixtureType.Hothouse)).toBe(true);
  await game.settle(400);
  const at = await game.squareBeside();
  await game.tapCell(at.col, at.row);
  await game.settle(500);
  return at;
}

/** Wake the one standing here, and tip a heap of carrots into it. */
async function wokenAndFed(game: Game, at: { col: number; row: number }): Promise<void> {
  await game.tapCell(at.col, at.row);
  await game.settle(400);
  await game.solveArray();
  await game.settle(500);
  await game.give("carrot", CARROTS);
  await game.settle(200);
  await game.feed(at);
}

describe("the first machine", () => {
  test(
    "is shown one sum, then works in silence for ever",
    async () => {
      await play({ seams: WITH_TIMBER }, async (game) => {
        const at = await aHothouseBeside(game);
        // Standing there and asleep: a sculpture until it has been shown the
        // arithmetic it is about to spend its life doing.
        expect(await machines(game)).toEqual([]);

        // One tap opens the rows-and-columns parchment. Answered, and the
        // machine is awake — and that is the only sum it will ever ask for.
        await game.tapCell(at.col, at.row);
        await game.settle(400);
        expect(await game.seam("array")).not.toBeNull();
        await game.solveArray();
        await game.settle(500);
        const woken = await machines(game);
        expect(woken).toHaveLength(1);
        expect(woken[0]).toMatchObject({ awake: true, holding: null, heap: 0 });

        // A second tap offers the biggest heap she is carrying that it wants
        // and asks how many of it. No sum: this is the whole point of the
        // design, and a second parchment here would make the machine a spell
        // with a worse interface. The question opens at the whole heap, so a
        // child who wants it all in is one tap from it. She has far more wood
        // than carrots, and it still offers the carrots, because a hothouse
        // does not take what it makes.
        await game.give("carrot", CARROTS + 2);
        await game.settle(200);
        await game.tapCell(at.col, at.row);
        await game.settle(500);
        const asked = await game.seam<{ count: number; most: number } | null>("mouth");
        if (!asked) throw new Error("the hothouse did not ask how many");
        expect(asked).toMatchObject({ count: CARROTS + 2, most: CARROTS + 2 });
        // Two fewer, and the tick: how much goes in is hers to say. A
        // playtest lost a whole forest of timber into one hopper before it
        // was.
        await game.tap("mouth.fewer");
        await game.tap("mouth.fewer");
        await game.settle(200);
        expect((await game.seam<{ count: number } | null>("mouth"))?.count).toBe(CARROTS);
        await game.tap("mouth.yes");
        await game.settle(500);
        const fed = (await machines(game))[0];
        expect(fed).toMatchObject({ holding: "carrot", heap: CARROTS });
        expect(fed?.crates).toEqual([0, 0, 0]);
        // And it came out of the basket rather than being conjured, with the
        // two she kept back still in it.
        expect(await game.held("carrot")).toBe(2);
        expect(await game.seam<unknown>("mouth")).toBe(null);
      });
    },
    5 * MINUTES,
  );

  /**
   * And the clock spell is how a child hurries it.
   *
   * The machine's minutes are minutes she was *there* for — see
   * `workMachines`, and the reason: a machine paid by elapsed time would pay
   * a child for having the tab shut. Winding the clock moves the world's
   * hour while she watches, so it moves the machine too, and that is the one
   * way to make a hothouse turn a heap in the time anybody would sit still
   * for.
   */
  test(
    "and winding the clock is what hurries it",
    async () => {
      await play({ seams: WITH_TIMBER }, async (game) => {
        const at = await aHothouseBeside(game);
        await wokenAndFed(game, at);
        // Nothing turned yet: a round is twenty minutes of work and she has
        // been standing here for seconds.
        expect((await machines(game))[0]?.crates).toEqual([0, 0, 0]);

        await game.windClock(12);
        await game.settle(1500);

        // Twelve hours is seven hundred and twenty minutes, which is more
        // rounds than the heap has in it — so it turns the lot, three wood
        // for every carrot, a pile of them in each crate.
        expect(MINUTES_PER_ROUND * CARROTS).toBeLessThanOrEqual(720);
        const turned = (await machines(game))[0];
        if (!turned) throw new Error("the hothouse went missing");
        expect(turned).toMatchObject({ heap: 0, made: "wood" });
        expect(turned.crates).toEqual(Array(SHARES).fill(CARROTS));

        // One more tap takes one crate — not the lot.
        const wood = await game.held("wood");
        await game.tapCell(at.col, at.row);
        await game.settle(500);
        expect(await game.held("wood")).toBe(wood + CARROTS);
        const left = (await machines(game))[0];
        expect(left?.crates.filter((count) => count > 0)).toHaveLength(SHARES - 1);

        // And all of it is still true tomorrow. A machine is not an object
        // on the grid and not in the basket; if the save forgot it, a child
        // would come back to a hothouse that had never been woken and a heap
        // of timber that had never existed.
        await game.reload(WITH_TIMBER);
        await game.settle(800);
        const remembered = (await machines(game))[0];
        expect(remembered).toMatchObject({ awake: true, made: "wood", heap: 0 });
        expect(remembered?.crates).toEqual(left?.crates ?? []);
      });
    },
    5 * MINUTES,
  );

  /**
   * And the minus rune takes it back, with everything that was in it.
   *
   * Tapping a machine is how it is *used*, so it cannot also be how a
   * machine is picked up — which left putting one down with no undo at all,
   * the same complaint that got crops theirs. This is the rune that unmakes
   * things and it already lifts a carrot out of the ground it was dropped
   * on.
   *
   * The contents coming back is the half worth asserting. Everything in
   * there was put there by casting, so a machine that ate a child's heap
   * when they moved it would be punishing them for changing their mind
   * about where a thing stands.
   */
  test(
    "and the minus rune takes it back, heap and all",
    async () => {
      await play({ seams: WITH_TIMBER }, async (game) => {
        const at = await aHothouseBeside(game);
        await wokenAndFed(game, at);
        expect(await game.held("carrot")).toBe(0);
        expect(await game.held(FixtureType.Hothouse)).toBe(0);

        await game.tap("spellbook");
        await game.tap(runeButton(Spell.Clearing));
        await game.tapCell(at.col, at.row);
        await game.settle(400);
        expect(await game.seam("spell")).not.toBeNull();
        await game.solveNumberLine();
        await game.settle(600);

        // The machine is back in the basket, the heap is back in the basket,
        // and nothing of it is left standing in the garden.
        expect(await game.held(FixtureType.Hothouse)).toBe(1);
        expect(await game.held("carrot")).toBe(CARROTS);
        expect(await machines(game)).toEqual([]);
      });
    },
    5 * MINUTES,
  );
});
