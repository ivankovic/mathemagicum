// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { UNKNOWNS } from "../src/spells/addition";
import { HARDEST_RUNG, LONGEST_LINE_RUNG, SHARED_TOP_RUNG, rungAt } from "../src/spells/difficulty";
import { Spell } from "../src/spells/spellbook";
import { PlantType } from "../src/world/plants";
import { type Game, play, runeButton, seedButton, shutDown } from "./harness";

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
  /** Set only at the rungs that ask a sum with no number line under it. */
  bare: { start: number; addend: number; total: number; unknown: string } | null;
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
  await game.tap(seedButton(PlantType.Carrot));
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
   *
   * Cast at `LONGEST_LINE_RUNG` rather than at `HARDEST_RUNG`, which is no
   * longer the same rung: the two above it take the number line away
   * altogether. Named rather than numbered so this cannot go stale again the
   * next time something is added on top.
   */
  test(
    "six jumps, all of them answerable",
    async () => {
      await play({ seams: `&learned=all&hour=12&rung=${LONGEST_LINE_RUNG}` }, async (game) => {
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

describe("the sum with no line under it", () => {
  /**
   * The top of the ladder, where the scaffold comes off.
   *
   * Everything the parchment does for a number line — the line, the ticks,
   * the arcs, a box per place — is gone here, and what is left is one box
   * and an equation. That is a branch inside `render`, so the failure it can
   * produce is a panel that draws neither form properly, and no unit test
   * can see a panel.
   */
  test(
    "asks a whole equation, takes one answer, and closes",
    async () => {
      await play({ seams: `&learned=all&hour=12&rung=${HARDEST_RUNG}` }, async (game) => {
        const cast = await castGrowth(game);
        const bare = cast.bare;
        if (!bare) throw new Error("the hardest rung did not ask a bare sum");

        // The three numbers make a true sum, whichever of them is hidden.
        expect(bare.start + bare.addend).toBe(bare.total);
        expect(UNKNOWNS as readonly string[]).toContain(bare.unknown);
        // Six digits on both sides: taking the line off did not shrink the
        // sum, which is the discipline the ladder is arranged on.
        expect(bare.start).toBeGreaterThanOrEqual(100_000);
        expect(bare.total).toBeLessThan(1_000_000);

        // One box, not six. The cast runs on a degenerate one-jump line
        // whose only stop is whatever term was hidden.
        expect(cast.stops).toHaveLength(1);
        const answer =
          bare.unknown === "total"
            ? bare.total
            : bare.unknown === "addend"
              ? bare.addend
              : bare.start;
        expect(cast.stops[0]).toBe(answer);

        await game.solveNumberLine();
        expect(await game.seam<Line | null>("spell")).toBeNull();
      });
    },
    5 * MINUTES,
  );

  /**
   * And the hint never gives it away.
   *
   * The bug this nearly shipped with: a bare cast runs on a line whose one
   * jump *is* the answer, and the number line's own second hint prints
   * "from + jump = ?" — which on that line reads `0 + 612538 = ?`. It only
   * appears after a wrong answer, so the next one would have been right
   * every time and nothing would ever have looked broken.
   */
  test(
    "and a wrong answer is not answered for her",
    async () => {
      await play({ seams: `&learned=all&hour=12&rung=${HARDEST_RUNG}` }, async (game) => {
        const cast = await castGrowth(game);
        if (!cast.bare) throw new Error("the hardest rung did not ask a bare sum");
        const answer = String(cast.stops[0]);

        // A wrong answer, so the parchment offers what help it has.
        await game.type(1);
        await game.press("Enter");
        await game.settle(300);
        const hint = await game.seam<string>("spellHint");
        expect(hint).not.toContain(answer);
      });
    },
    5 * MINUTES,
  );
});
