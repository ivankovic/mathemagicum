// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { HARDEST_RUNG, SHARED_TOP_RUNG, rungAt } from "../src/spells/difficulty";
import { Spell } from "../src/spells/spellbook";
import { type Game, play, runeButton, shutDown } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * Sums at the top of the ladder.
 *
 * The six-digit band is the one setting no child reaches by playing — it is
 * sixteen rungs up and an adult has to choose it — so it is also the one
 * that could ship broken without anybody noticing. What it changes is not
 * one number: the problem generator stopped listing every pair and started
 * counting them, and the parchment stopped drawing three of everything.
 *
 * Unit tests cover the counting against counting. What they cannot see is
 * six arrows drawn on a real parchment on a real phone, and a child getting
 * to the end of one.
 */

interface Line {
  start: number;
  stops: number[];
  index: number;
}

/**
 * What each jump moved by, read off the stops.
 *
 * Derived rather than asked for: the seam publishes where the line lands,
 * and a jump is the difference between two landings. Working it out here
 * rather than widening the seam also means these checks are against what the
 * parchment will actually draw, not against a second copy of it.
 */
function jumpsOf(line: Line): number[] {
  return line.stops.map(
    (stop, at) => stop - (at === 0 ? line.start : (line.stops[at - 1] as number)),
  );
}

/** Plant something, then grow it: the number line opens on a crop. */
async function castGrowth(game: Game): Promise<Line> {
  // A seed is armed and then aimed, the same two taps a spell takes: pick
  // it up, then say which square.
  await game.tap("seeds");
  await game.tap("seeds.0");
  await game.tapNear(0, 1);
  await game.settle(500);
  await game.tap("spellbook");
  await game.tap(runeButton(Spell.Growth));
  await game.tapNear(0, 1);
  await game.settle(700);
  const line = await game.seam<Line | null>("spell");
  if (!line) throw new Error("the number line did not open");
  return line;
}

describe("six-digit sums", () => {
  /**
   * The whole of the hardest band, cast and finished.
   *
   * Six jumps, six boxes, and numbers up to a million — drawn on a parchment
   * whose furniture was built for three of each, and answered through a
   * keypad that has to take six digits into a box that used to take three.
   */
  test(
    "six jumps, all of them answerable",
    async () => {
      await play({ seams: `&learned=all&hour=12&rung=${HARDEST_RUNG}` }, async (game) => {
        const line = await castGrowth(game);
        const jumps = jumpsOf(line);
        expect(jumps).toHaveLength(6);
        // Six digits on both sides, which is what the band is for.
        expect(line.start).toBeGreaterThanOrEqual(100_000);
        expect(line.stops.at(-1)).toBeLessThan(1_000_000);
        // Ones, tens, hundreds, thousands, ten thousands, hundred thousands —
        // and not one of them a jump of nothing.
        for (const [at, jump] of jumps.entries()) {
          expect({ at, ok: jump > 0 && jump % 10 ** at === 0 }).toEqual({ at, ok: true });
        }

        await game.solveNumberLine();
        // Finished: the parchment closes only when every box is right.
        expect(await game.seam<Line | null>("spell")).toBeNull();
      });
    },
    5 * MINUTES,
  );

  /**
   * And the band the game shipped at is untouched.
   *
   * The generator was rewritten under every rung, not only the new ones, so
   * the case that matters most is the one nobody asked to change: three
   * places, carrying, exactly as before.
   */
  test(
    "and three-digit sums are still three jumps",
    async () => {
      await play({ seams: `&learned=all&hour=12&rung=${SHARED_TOP_RUNG}` }, async (game) => {
        const line = await castGrowth(game);
        expect(jumpsOf(line)).toHaveLength(3);
        expect(line.start).toBeGreaterThanOrEqual(100);
        expect(line.stops.at(-1)).toBeLessThan(1000);
        expect(rungAt(SHARED_TOP_RUNG).places).toBe(3);
        await game.solveNumberLine();
        expect(await game.seam<Line | null>("spell")).toBeNull();
      });
    },
    5 * MINUTES,
  );
});
