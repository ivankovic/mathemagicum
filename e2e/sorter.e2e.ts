// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { FixtureType } from "../src/world/fixtures";
import { MINUTES_PER_ROUND, SHARES } from "../src/world/machines";
import { type Game, play, shutDown, takeFromCrate } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * The first machine that does anything, end to end.
 *
 * `machines.test.ts` proves the dealing in a fraction of a second and every
 * assertion in it is a function call. What a child does is tap a sorter, be
 * shown one sum, tip a heap in and come back to three equal piles — and none
 * of that route is in the model. The waking is a parchment, the tipping
 * reaches into the basket, the dealing is driven by a clock nothing else in
 * the game measures, and the whole of it has to survive being written down.
 *
 * It is also the piece with the quietest failure mode in the game. A
 * machine's state is not an object on the grid, not in the basket, and not
 * on screen beyond three little heaps in three crates: a sorter that had
 * stopped dealing, or one dealing without ever having been woken, looks
 * exactly like one that works.
 */
const WITH_TIMBER = "&materials=60&hour=12&freezeNpcs&learned=all";

interface Machine {
  where: string;
  awake: boolean;
  holding: string | null;
  heap: number;
  crates: number[];
}

const machines = (game: Game) => game.seam<Machine[]>("machines");

/** An empty square next to her, to stand a machine on. */
async function squareBeside(game: Game): Promise<{ col: number; row: number }> {
  const here = await game.where();
  for (const step of [
    { col: 1, row: 0 },
    { col: -1, row: 0 },
    { col: 0, row: 1 },
    { col: 0, row: -1 },
  ]) {
    const at = { col: here.col + step.col, row: here.row + step.row };
    const on = await game.tab.evaluate(
      ([c, r]) => {
        const handle = (globalThis as never as Record<string, Record<string, unknown>>)
          .__mathemagicum;
        if (!handle) throw new Error("the game has not put its handle out");
        const session = handle.session as {
          grid: { getObjectAt: (col: number, row: number) => unknown };
        };
        return session.grid.getObjectAt(c as number, r as number) !== null;
      },
      [at.col, at.row] as const,
    );
    if (!on) return at;
  }
  throw new Error("she is boxed in on all four sides");
}

/** Build one, put it down beside her, and give back the square it is on. */
async function aSorterBeside(game: Game): Promise<{ col: number; row: number }> {
  expect(await takeFromCrate(game, FixtureType.Sorter)).toBe(true);
  await game.settle(400);
  const at = await squareBeside(game);
  await game.tapCell(at.col, at.row);
  await game.settle(500);
  return at;
}

describe("the first machine that does something", () => {
  test(
    "is shown one sum, then deals in silence for ever",
    async () => {
      await play({ seams: WITH_TIMBER }, async (game) => {
        const at = await aSorterBeside(game);
        // Standing there and asleep: a sculpture until it has been shown the
        // arithmetic it is about to spend its life doing.
        expect(await machines(game)).toEqual([]);

        // One tap opens the division parchment. Answered, and the machine is
        // awake — and that is the only sum it will ever ask for.
        await game.tapCell(at.col, at.row);
        await game.settle(400);
        await game.solveShare();
        await game.settle(500);
        const woken = await machines(game);
        expect(woken).toHaveLength(1);
        expect(woken[0]).toMatchObject({ awake: true, holding: null, heap: 0 });

        // A second tap tips in the biggest heap she is carrying. No sum: this
        // is the whole point of the design, and a second parchment here would
        // make the machine a spell with a worse interface.
        //
        // *Which* heap is not written down here, because the machine decides
        // — the biggest, since choosing would be a menu and a menu is what
        // this interaction is trying not to be. She is carrying wood and
        // stone in different amounts, so pinning it to one of them would be
        // pinning the tie-break rather than the behaviour.
        await game.tapCell(at.col, at.row);
        await game.settle(500);
        const fed = (await machines(game))[0];
        if (!fed?.holding) throw new Error("the sorter took nothing at all");
        expect(fed.heap).toBeGreaterThanOrEqual(SHARES);
        expect(fed.crates).toEqual([0, 0, 0]);
        // And it came out of the basket rather than being conjured.
        expect(await game.held(fed.holding)).toBe(0);
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
   * way to make a sorter deal a heap in the time anybody would sit still for.
   */
  test(
    "and winding the clock is what hurries it",
    async () => {
      await play({ seams: WITH_TIMBER }, async (game) => {
        const at = await aSorterBeside(game);
        await game.tapCell(at.col, at.row);
        await game.settle(400);
        await game.solveShare();
        await game.settle(400);
        await game.tapCell(at.col, at.row);
        await game.settle(400);

        const filled = (await machines(game))[0];
        const heap = filled?.heap ?? 0;
        const item = filled?.holding;
        if (!item) throw new Error("the sorter took nothing at all");
        expect(heap).toBeGreaterThanOrEqual(SHARES * 2);
        // Nothing dealt yet: a round is twenty minutes of work and she has
        // been standing here for seconds.
        expect((await machines(game))[0]?.crates).toEqual([0, 0, 0]);

        await game.windClock(12);
        await game.settle(1500);

        // Twelve hours is seven hundred and twenty minutes, which is far
        // more rounds than the heap has in it — so it deals the lot, and
        // what is left in the mouth is the remainder and nothing else.
        const dealt = (await machines(game))[0];
        if (!dealt) throw new Error("the sorter went missing");
        expect(dealt.crates).toEqual(Array(SHARES).fill(Math.floor(heap / SHARES)));
        expect(dealt.heap).toBe(heap % SHARES);
        expect(MINUTES_PER_ROUND * Math.floor(heap / SHARES)).toBeLessThanOrEqual(720);

        // One more tap takes one share — not the lot, which is the use of
        // the thing: an exact third, counted out by something that cannot
        // miscount.
        await game.tapCell(at.col, at.row);
        await game.settle(500);
        expect(await game.held(item)).toBe(Math.floor(heap / SHARES));
        const left = (await machines(game))[0];
        expect(left?.crates.filter((count) => count > 0)).toHaveLength(SHARES - 1);

        // And all of it is still true tomorrow. A machine is not an object
        // on the grid and not in the basket; if the save forgot it, a child
        // would come back to a sorter that had never been woken and a heap
        // of wood that had never existed.
        await game.reload(WITH_TIMBER);
        await game.settle(800);
        const remembered = (await machines(game))[0];
        expect(remembered).toMatchObject({
          awake: true,
          holding: item,
          heap: left?.heap ?? -1,
        });
        expect(remembered?.crates).toEqual(left?.crates ?? []);
      });
    },
    5 * MINUTES,
  );
});
