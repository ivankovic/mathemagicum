// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { FixtureType } from "../src/world/fixtures";
import { MaterialType } from "../src/world/materials";
import { type Game, play, shutDown, takeFromCrate } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

interface Machine {
  where: string;
  awake: boolean;
  holding: string | null;
  heap: number;
  crates: number[];
  made: string | null;
  mark: number;
  other: string | null;
  otherHeap: number;
  otherMark: number;
}

const machines = (game: Game) => game.seam<Machine[]>("machines");

/**
 * The press, which is the first machine with two mouths and the first whose
 * behaviour a unit test genuinely cannot reach.
 *
 * `machines.test.ts` proves the arithmetic in a tenth of a second and every
 * assertion in it is a function call. What a child does is tip one thing in,
 * tip a *different* thing in, and watch — and that route runs through the
 * scene's `tipIn`, which is where the first version of this went wrong. It
 * had its own copy of the one-mouth rule, so it would only ever have offered
 * a child the first funnel's kind: a press that cannot be handed its second
 * thing by hand is a press that can never be shown a proportion, and the
 * proportion is the whole machine.
 *
 * So this is not a re-proof of the arithmetic. It is the two taps.
 */

/**
 * Enough for a press and then some, at noon, with the village still, and
 * every spell already learned.
 *
 * `learned=all` is not decoration. A machine is woken by the spell whose
 * arithmetic it does, and a child who has not met that spell is shown where
 * to go and learn it instead of the sum — which is the right behaviour and
 * looks exactly like a machine that ignores taps. Left off, this scenario
 * spent its time proving that a press cannot be woken by somebody who
 * cannot cast sharing.
 *
 * Forty of each: the press wants twenty wood and ten stone, so a build
 * leaves twenty and thirty — two different numbers, neither of them nought,
 * which is the only way to tell "spent the recipe" from "emptied the
 * basket".
 */
const WITH_TIMBER = "&materials=40&hour=12&freezeNpcs&learned=all";

async function squareBeside(game: Game): Promise<{ col: number; row: number }> {
  const here = await game.where();
  for (const step of [
    { col: 1, row: 0 },
    { col: -1, row: 0 },
    { col: 0, row: 1 },
    { col: 0, row: -1 },
  ]) {
    const at = { col: here.col + step.col, row: here.row + step.row };
    const taken = await game.tab.evaluate(
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
    if (!taken) return at;
  }
  throw new Error("she is boxed in on all four sides");
}

async function aPressBeside(game: Game): Promise<{ col: number; row: number }> {
  expect(await takeFromCrate(game, FixtureType.Press)).toBe(true);
  await game.settle(400);
  const at = await squareBeside(game);
  await game.tapCell(at.col, at.row);
  await game.settle(500);
  return at;
}

describe("the machine that takes two things at once", () => {
  test(
    "can be handed both of them by hand, and presses what they make together",
    async () => {
      await play({ seams: WITH_TIMBER }, async (game) => {
        const at = await aPressBeside(game);

        // Nothing in the machine map yet, and that is not the same as
        // "asleep": a machine gets no state at all until it is first tapped,
        // so an empty list here is a press standing on the ground having
        // done nothing — which is exactly what it should be.
        expect(await machines(game)).toEqual([]);
        await game.tapCell(at.col, at.row);
        await game.settle(400);
        await game.solveShare();
        await game.settle(400);
        expect((await machines(game))[0]?.awake).toBe(true);

        // The first tap fills one funnel with the biggest heap she is
        // carrying that the press can use.
        await game.tapCell(at.col, at.row);
        await game.settle(400);
        const half = (await machines(game))[0];
        if (!half?.holding) throw new Error("the press took nothing at all");
        expect(half.heap).toBeGreaterThan(0);
        // And nothing in the second yet, which is the state this machine
        // spends most of its life in.
        expect({ other: half.other, otherHeap: half.otherHeap }).toEqual({
          other: null,
          otherHeap: 0,
        });

        // The second tap is the one the old `tipIn` could never have made:
        // a different kind, into the funnel that is still empty.
        await game.tapCell(at.col, at.row);
        await game.settle(400);
        const both = (await machines(game))[0];
        if (!both?.other) throw new Error("the press would not take a second kind by hand");
        expect(both.other).not.toBe(both.holding);
        expect(both.otherHeap).toBeGreaterThan(0);
        // Both came out of the basket rather than being conjured.
        expect(await game.held(both.holding ?? "")).toBe(0);
        expect(await game.held(both.other)).toBe(0);

        // Nothing pressed yet: a round is twenty minutes of work and she has
        // been standing here for seconds.
        expect(both.crates).toEqual([0, 0, 0]);

        // The clock spell is how a child hurries a machine — the minutes are
        // minutes she was *there* for, so winding the world is the only way
        // to make one work in the time anybody would sit still for.
        await game.windClock(12);
        await game.settle(1500);

        const done = (await machines(game))[0];
        if (!done) throw new Error("the press went missing");
        // Wood and stone make a beam, and the press says so on the crates
        // rather than on the mouth: what came out is not what went in.
        expect(done.made).toBe(MaterialType.Beam);
        expect(done.crates.reduce((all, count) => all + count, 0)).toBeGreaterThan(0);
        // And it learned the proportion it was shown, from both funnels.
        expect(done.mark).toBeGreaterThan(0);
        expect(done.otherMark).toBeGreaterThan(0);
      });
    },
    5 * MINUTES,
  );

  /**
   * And the stall, which is the lesson rather than a limit.
   *
   * One funnel piled high and the other empty does nothing at all, however
   * long it is left. It cannot be checked by winding the clock and finding
   * nothing — that is also what an unwoken machine does — so this wakes it,
   * feeds one side only, winds twelve hours, and asks whether the heap it
   * was given is still sitting there.
   */
  test(
    "and stalls with one funnel full and the other empty",
    async () => {
      await play({ seams: WITH_TIMBER }, async (game) => {
        const at = await aPressBeside(game);
        await game.tapCell(at.col, at.row);
        await game.settle(400);
        await game.solveShare();
        await game.settle(400);
        await game.tapCell(at.col, at.row);
        await game.settle(400);

        const fed = (await machines(game))[0];
        const heap = fed?.heap ?? 0;
        expect(heap).toBeGreaterThan(0);

        await game.windClock(12);
        await game.settle(1500);

        const waiting = (await machines(game))[0];
        if (!waiting) throw new Error("the press went missing");
        // Twelve hours, and not one pressing: what it is short of is not
        // time.
        expect(waiting.heap).toBe(heap);
        expect(waiting.crates).toEqual([0, 0, 0]);
        expect(waiting.made).toBeNull();
      });
    },
    5 * MINUTES,
  );
});
