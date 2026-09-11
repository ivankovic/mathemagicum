// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { UNKNOWNS } from "../src/spells/addition";
import {
  HARDEST_RUNG,
  LONGEST_LINE_RUNG,
  RUNGS,
  SHARED_TOP_RUNG,
  rungAt,
} from "../src/spells/difficulty";
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
  place: { number: number; at: number; digit: number; zeros: number } | null;
  bare: {
    start: number;
    addend: number;
    total: number;
    unknown: string;
    takingAway: boolean;
  } | null;
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

/**
 * A cast that is a number line, however many tries that takes.
 *
 * A share of casts at these rungs now ask what a digit is worth instead —
 * a different question at the same rung. The scenarios below are about the
 * line, so they dismiss anything else and cast again, which is what a child
 * does without noticing she is doing it.
 */
async function castLine(game: Game): Promise<Line> {
  for (let go = 0; go < 12; go++) {
    const line = await castGrowth(game);
    if (!line.place) return line;
    await game.press("Escape");
    await game.settle(400);
  }
  throw new Error("twelve casts and never a number line");
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
      // No `?place`: the point of this rung is the longest line the
      // parchment ever draws, and a share of casts up here now ask what a
      // digit is worth instead — a different question at the same rung, and
      // not the one being tested. Cast until the line comes, which is what
      // a child does.
      await play(
        { seams: `&learned=all&hour=12&freezeNpcs&rung=${LONGEST_LINE_RUNG}` },
        async (game) => {
          const line = await castLine(game);
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
        },
      );
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
      await play(
        { seams: `&learned=all&hour=12&freezeNpcs&rung=${SHARED_TOP_RUNG}` },
        async (game) => {
          // Cast past the digit question, as above: this rung asks it one
          // cast in three, and a single cast that happens to draw it is a
          // one-jump line, which is not the generator being wrong.
          const line = await castLine(game);
          expect(jumpsOf(line)).toHaveLength(3);
          expect(line.start).toBeGreaterThanOrEqual(100);
          expect(line.stops.at(-1)).toBeLessThan(1000);
          expect(rungAt(SHARED_TOP_RUNG).places).toBe(3);
          await game.solveNumberLine();
          expect(await game.seam<Line | null>("spell")).toBeNull();
        },
      );
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
      await play(
        { seams: `&learned=all&hour=12&freezeNpcs&rung=${HARDEST_RUNG}` },
        async (game) => {
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
        },
      );
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
      await play(
        { seams: `&learned=all&hour=12&freezeNpcs&rung=${HARDEST_RUNG}` },
        async (game) => {
          const cast = await castGrowth(game);
          if (!cast.bare) throw new Error("the hardest rung did not ask a bare sum");
          const answer = String(cast.stops[0]);

          // A wrong answer, so the parchment offers what help it has.
          await game.type(1);
          await game.press("Enter");
          await game.settle(300);
          const hint = await game.seam<string>("spellHint");
          expect(hint).not.toContain(answer);
        },
      );
    },
    5 * MINUTES,
  );
});

/**
 * And the same sum written down, far lower on the ladder.
 *
 * The written form used to live on the top two rungs only, which meant
 * three of the four bands never reached it — `BANDS` are index pairs and
 * every one but the widest ends below them. It now sits on the rung of each
 * size that does not carry, which is the whole of the rule: the line is
 * where carrying is taught, and the written form is where the sum
 * underneath it is one she can already do.
 *
 * Driven through the game rather than asserted off the table, because what
 * changed is which *parchment* a middling rung opens — and a table can say
 * `bare` while the panel goes on drawing a number line.
 */
describe("a sum written down, in the middle of the ladder", () => {
  const WRITTEN = RUNGS.findIndex((rung) => rung.bare !== undefined && rung.places <= 3);

  test(
    "asks one box on a rung that is nothing like the top",
    async () => {
      expect(WRITTEN).toBeGreaterThan(0);
      await play({ seams: `&learned=all&hour=12&freezeNpcs&rung=${WRITTEN}` }, async (game) => {
        const cast = await castGrowth(game);
        const bare = cast.bare;
        if (!bare) throw new Error("a middling rung drew a line where it should write the sum");

        expect(bare.start + bare.addend).toBe(bare.total);
        expect(UNKNOWNS as readonly string[]).toContain(bare.unknown);
        // One box, and a small sum: this is the point of putting the form
        // down here at all. Six digits would be the top rung wearing a
        // lower number.
        expect(cast.stops).toHaveLength(1);
        expect(bare.total).toBeLessThan(1000);
        // And it does not carry — the rule that makes it safe this low.
        // Asked of the sum rather than of the table, so a generator that
        // ignored the rung would be caught here.
        expect((bare.start % 10) + (bare.addend % 10)).toBeLessThan(10);

        await game.solveNumberLine();
        expect(await game.seam<Line | null>("spell")).toBeNull();
      });
    },
    5 * MINUTES,
  );
});

/**
 * And the same, taking away.
 *
 * `Rung.bare` was addition's alone, and said so: the two spells share this
 * ladder — one instrument walked two ways — but taking the line off a
 * subtraction was "a separate decision about a separate spell, and nobody
 * has asked for it". This is that decision made, driven through the game
 * rather than asserted off a table, because what it changes is which
 * parchment the clearing rune opens.
 */
describe("a take-away written down", () => {
  const WRITTEN = RUNGS.findIndex((rung) => rung.bare !== undefined && rung.places <= 3);

  test(
    "asks one box, with a minus in it, and closes on the answer",
    async () => {
      await play(
        { seams: `&learned=all&hour=12&freezeNpcs&crops=5&rung=${WRITTEN}` },
        async (game) => {
          // Something to clear, first: the rune is refused on bare ground,
          // and a refusal looks exactly like a parchment that failed to open.
          await game.tap("seeds");
          await game.tap(seedButton(PlantType.Carrot));
          await game.tapNear(0, 1);
          await game.settle(500);

          // Clearing it: the ordinary way the rune is cast, at a rung that
          // now writes the sum instead of drawing it.
          await game.tap("spellbook");
          await game.tap(runeButton(Spell.Clearing));
          await game.tapNear(0, 1);
          await game.settle(700);

          const line = await game.seam<Line | null>("spell");
          if (!line) throw new Error("the clearing rune opened nothing");
          const bare = line.bare;
          if (!bare) throw new Error("a written rung drew a line for the clearing spell");

          // Written as a take-away, which is the whole of what changed.
          expect(bare.takingAway).toBe(true);
          // The same triple either way round, and never below nothing.
          expect(bare.total - bare.addend).toBe(bare.start);
          expect(bare.start).toBeGreaterThanOrEqual(0);
          expect(UNKNOWNS as readonly string[]).toContain(bare.unknown);
          // One box, whichever term it is.
          expect(line.stops).toHaveLength(1);

          await game.solveNumberLine();
          expect(await game.seam<Line | null>("spell")).toBeNull();
        },
      );
    },
    5 * MINUTES,
  );
});

/**
 * What a digit is worth, asked on a real parchment.
 *
 * One cast in three at the rungs that ask it, so this casts until it gets
 * one rather than trusting a seed — a fixed seed would be a scenario that
 * passes until the generator is touched and then fails for a reason nobody
 * can read.
 *
 * What it is really guarding is the *drawing*. This question runs on the
 * same degenerate one-jump line a bare sum does, whose single jump is the
 * answer — so a parchment that forgot to put its number line away writes
 * `+50` in an arc above a box asking what the five in 358 is worth. That
 * is not a thing a unit test can see, and it is exactly what the first
 * build did.
 */
describe("what a digit is worth", () => {
  test(
    "shows the number, lights one digit, and takes its value",
    async () => {
      // `?place` pins the question. It is one cast in three when a child
      // plays, which is right for playing and useless here: a scenario that
      // casts until it gets lucky fails on a generator change for a reason
      // nobody can read.
      await play(
        { seams: "&learned=all&hour=12&freezeNpcs&crops=9&rung=9&place" },
        async (game) => {
          await game.tap("seeds");
          await game.tap(seedButton(PlantType.Carrot));
          await game.tapNear(0, 1);
          await game.settle(500);

          await game.tap("spellbook");
          await game.tap(runeButton(Spell.Growth));
          await game.tapNear(0, 1);
          await game.settle(700);
          const asked = await game.seam<Line | null>("spell");
          const place = asked?.place;
          if (!place || !asked) throw new Error("the growth spell did not ask about a digit");

          // The lit digit is really in the number, in the place claimed.
          const digits = [...String(place.number)].map(Number);
          expect(digits).toHaveLength(place.zeros + place.at + 1);
          expect(digits[place.at]).toBe(place.digit);
          // Three digits at least: the question means nothing below that.
          expect(digits.length).toBeGreaterThanOrEqual(3);

          // One box, and its answer is the digit followed by its zeros — not
          // the digit, which is the whole of what is being taught.
          expect(asked.stops).toHaveLength(1);
          expect(asked.stops[0]).toBe(place.digit * 10 ** place.zeros);

          await game.solveNumberLine();
          expect(await game.seam<Line | null>("spell")).toBeNull();
        },
      );
    },
    6 * MINUTES,
  );
});
