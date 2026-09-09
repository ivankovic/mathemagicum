// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { createRng } from "../world/rng";
import {
  UNKNOWNS,
  Unknown,
  bareAnswer,
  bareSumText,
  beginCast,
  movedBy,
  runsDown,
  submit,
  typeDigit,
} from "./addition";
import { BareForm, RUNGS, rungAt } from "./difficulty";
import {
  type SubtractionProblem,
  makeBareSubtraction,
  makeSubtractionProblem,
  nthStartForTest,
  pairCountFor,
  subtractionCastFor,
  subtractionFor,
} from "./subtraction";

const DRAWS = 300;

function drawAll(rung = rungAt(9)): SubtractionProblem[] {
  return Array.from({ length: DRAWS }, (_, seed) =>
    makeSubtractionProblem(createRng(seed + 1), rung),
  );
}

describe("walking the line backwards", () => {
  test("the jumps are the number taken apart, smallest place first", () => {
    expect(subtractionFor(512, 265)).toEqual({
      start: 512,
      taken: 265,
      jumps: [5, 60, 200],
      stops: [507, 447, 247],
    });
  });

  test("the last stop is the answer, and it is the subtraction", () => {
    for (const problem of drawAll()) {
      expect({ start: problem.start, last: problem.stops.at(-1) }).toEqual({
        start: problem.start,
        last: problem.start - problem.taken,
      });
    }
  });

  test("every stop is lower than the one before", () => {
    for (const problem of drawAll()) {
      let at = problem.start;
      for (const stop of problem.stops) {
        expect({ problem: `${problem.start}-${problem.taken}`, down: stop < at }).toEqual({
          problem: `${problem.start}-${problem.taken}`,
          down: true,
        });
        at = stop;
      }
    }
  });

  // The same reason the addend has no zero digit: a jump of nothing lands
  // where it started, and an arrow pointing back at the number it came from
  // reads as a piece missing rather than as an easy one.
  test("no jump is a take-away-nothing", () => {
    for (const problem of drawAll()) {
      for (const jump of problem.jumps) expect(jump).toBeGreaterThan(0);
    }
  });

  // Nought is a fine answer arithmetically and a poor one here: "how many
  // are left" is a question about something rather than nothing.
  test("nothing ever comes out at nought or below", () => {
    for (const rung of RUNGS) {
      for (const problem of drawAll(rung)) {
        expect({ rung: rung.places, ok: (problem.stops.at(-1) as number) >= 1 }).toEqual({
          rung: rung.places,
          ok: true,
        });
      }
    }
  });
});

describe("what the rung changes", () => {
  test("as many places as it asks for", () => {
    for (const rung of RUNGS) {
      for (const problem of drawAll(rung)) {
        expect({ places: rung.places, jumps: problem.jumps.length }).toEqual({
          places: rung.places,
          jumps: rung.places,
        });
      }
    }
  });

  // A borrow is a carry coming down: the same dial, so a child who is not
  // being given carries is not given borrows either.
  test("no jump borrows when the rung says it may not", () => {
    for (const rung of RUNGS) {
      if (rung.crossing) continue;
      for (const problem of drawAll(rung)) {
        for (let at = 0; at < rung.places; at++) {
          const from = Math.floor(problem.start / 10 ** at) % 10;
          const taken = Math.floor(problem.taken / 10 ** at) % 10;
          const where = `${problem.start}-${problem.taken}@${at}`;
          expect({ where, ok: taken <= from }).toEqual({ where, ok: true });
        }
      }
    }
  });

  // At one place there is nothing to borrow *from*, so the rung would have
  // been identical to the one below it. Bridging ten coming down is a start
  // above ten — the reflection of addition's 7 + 5 = 12.
  test("crossing at a single place means starting above ten", () => {
    const flat = drawAll(RUNGS[0] as never);
    const crossing = drawAll(RUNGS[1] as never);
    expect(Math.max(...flat.map((p) => p.start))).toBeLessThanOrEqual(9);
    expect(Math.max(...crossing.map((p) => p.start))).toBeGreaterThan(9);
    expect(crossing.some((p) => p.start > 9 && p.taken > p.start % 10)).toBe(true);
  });

  // No-borrow is far more restrictive than addition's "two digits must not
  // overflow", so this is measured rather than assumed: a rung with a
  // handful of pairs would set the same three problems over and over.
  test("every rung has plenty of problems to draw from", () => {
    for (const [index, rung] of RUNGS.entries()) {
      const pairs = pairCountFor(rung.places, rung.crossing);
      expect({ index, enough: pairs >= 30 }).toEqual({ index, enough: true });
    }
    // And the hardest is not a handful dressed up as a lot.
    expect(pairCountFor(3, true)).toBeGreaterThan(10000);
  });

  // Uniform over the pairs that exist, not over the amounts that are legal:
  // weighting by amount would push every problem into the high end, because
  // a large subtrahend leaves almost nowhere to start from.
  test("it draws from across the range, not just the top of it", () => {
    const starts = drawAll(rungAt(6)).map((p) => p.start);
    const low = starts.filter((s) => s < 400).length;
    const high = starts.filter((s) => s >= 700).length;
    expect(low).toBeGreaterThan(DRAWS / 10);
    expect(high).toBeGreaterThan(DRAWS / 10);
  });
});

describe("the parchment reads it as a line like any other", () => {
  test("it knows which way the line runs, and by how much", () => {
    const problem = subtractionFor(512, 265);
    expect(runsDown(problem)).toBe(true);
    expect(movedBy(problem)).toBe(265);
  });

  // The bug this guards: the box was sized from the *last* stop, which going
  // up the line is the biggest and coming down is the smallest. A line that
  // ends in single figures would have stopped taking the second digit of its
  // first answer half way along.
  test("a box takes as many digits as the widest answer needs", () => {
    const problem = subtractionFor(95, 89, 2);
    expect(problem.stops).toEqual([86, 6]);
    let cast = beginCast(problem);
    cast = typeDigit(typeDigit(cast, 8), 6);
    expect(cast.entry).toBe("86");
    cast = submit(cast);
    expect(cast.index).toBe(1);
    cast = submit(typeDigit(cast, 6));
    expect(cast.index).toBe(2);
  });

  test("a whole cast can be answered with the growth spell's own machinery", () => {
    const problem = makeSubtractionProblem(createRng(4), rungAt(9));
    let cast = beginCast(problem);
    for (const stop of problem.stops) {
      for (const digit of String(stop)) cast = typeDigit(cast, Number(digit));
      cast = submit(cast);
    }
    expect(cast.index).toBe(problem.jumps.length);
  });
});

/**
 * The counting, against counting.
 *
 * The same guard addition has, and needed for the same reason: `pairsFor`
 * used to list every start each amount could be taken from, and now works
 * the count and the k-th of them out in closed form. This is the old way,
 * kept here and nowhere else, checked against the new one at every size the
 * old way can still be run at.
 *
 * The no-borrow rule is the more delicate of the two — it strikes out one
 * start, the amount itself, and it is the smallest — so the order matters as
 * much as the count and both are checked.
 */
describe("counting the pairs without listing them", () => {
  function byHand(places: number, crossing: boolean): { amount: number; starts: number[] }[] {
    const low = places === 1 ? 1 : 10 ** places / 10;
    const high = 10 ** places - 1;
    const most = 10 ** places - 1;
    const ceiling = crossing && places === 1 ? most * 2 : most;
    const digits = (value: number) => {
      const out: number[] = [];
      for (let at = 0; at < places; at++) out.push(Math.floor(value / 10 ** at) % 10);
      return out;
    };
    const out: { amount: number; starts: number[] }[] = [];
    for (let amount = low; amount <= high; amount++) {
      const takenDigits = digits(amount);
      if (takenDigits.some((digit) => digit === 0)) continue;
      const starts: number[] = [];
      for (let start = low; start <= ceiling; start++) {
        if (start - amount < 1) continue;
        const ok = crossing || takenDigits.every((digit, at) => digit <= (digits(start)[at] ?? 0));
        if (ok) starts.push(start);
      }
      if (starts.length > 0) out.push({ amount, starts });
    }
    return out;
  }

  for (const places of [1, 2, 3]) {
    for (const crossing of [false, true]) {
      test(`${places} place${places === 1 ? "" : "s"}, ${crossing ? "borrowing" : "not borrowing"}`, () => {
        const listed = byHand(places, crossing);
        const total = listed.reduce((sum, one) => sum + one.starts.length, 0);
        expect(pairCountFor(places, crossing)).toBe(total);
        for (const { amount, starts } of listed) {
          const rebuilt = starts.map((_, k) => nthStartForTest(places, crossing, amount, k));
          expect({ amount, rebuilt }).toEqual({ amount, rebuilt: starts });
        }
      });
    }
  }
});

describe("a subtraction written down", () => {
  /** The lowest rung that asks for the written form. */
  const WRITTEN = RUNGS.findIndex((rung) => rung.bare !== undefined);

  test("is the same three numbers, read from the other end", () => {
    // The invariant the whole flag rests on. `BareSum` keeps its triple in
    // the addition reading — what is left, plus what was taken, is what she
    // started with — and `takingAway` only changes the sentence.
    for (let seed = 0; seed < 200; seed++) {
      const sum = makeBareSubtraction(createRng(seed), rungAt(WRITTEN));
      expect(sum.start + sum.addend).toBe(sum.total);
      expect(sum.total - sum.addend).toBe(sum.start);
      expect(sum.takingAway).toBe(true);
      // Nothing goes below nothing: this game has no negative numbers, and
      // a bare subtraction is the easiest place to introduce one by
      // accident.
      expect(sum.start).toBeGreaterThanOrEqual(0);
      expect(sum.addend).toBeGreaterThan(0);
    }
  });

  test("is written with the bigger number in front", () => {
    const sum = makeBareSubtraction(createRng(4), rungAt(WRITTEN));
    const text = bareSumText({ ...sum, unknown: Unknown.Start }, "?");
    expect(text).toBe(`${sum.total} − ${sum.addend} = ?`);
    // The minus sign the game already uses, not a hyphen typed by hand.
    expect(text).toContain("−");
    expect(text).not.toContain("+");
  });

  test("puts the box wherever the hidden term is", () => {
    const sum = { start: 34, addend: 25, total: 59, unknown: Unknown.Start, takingAway: true };
    // What is left.
    expect(bareSumText(sum, "?")).toBe("59 − 25 = ?");
    // What was taken away.
    expect(bareSumText({ ...sum, unknown: Unknown.Addend }, "?")).toBe("59 − ? = 34");
    // What she started with, which is the undoing kind: the only way to it
    // is to add the other two back together.
    expect(bareSumText({ ...sum, unknown: Unknown.Total }, "?")).toBe("? − 25 = 34");
  });

  test("and the same triple written as an addition is the same fact", () => {
    // Stated because it is the argument for there being one type rather
    // than two: the plus and minus renderings of one triple are the same
    // sum, and `bareAnswer` does not need to know which is on screen.
    const sum = { start: 34, addend: 25, total: 59, unknown: Unknown.Total, takingAway: true };
    expect(bareSumText({ ...sum, takingAway: false }, "?")).toBe("34 + 25 = ?");
    expect(bareAnswer(sum)).toBe(bareAnswer({ ...sum, takingAway: false }));
  });

  test("asks for what is left, when the rung does not vary the box", () => {
    // `Total` in the addition reading is the number being taken *from*,
    // which is nobody's idea of "the result" of a subtraction. On a rung
    // that hides one fixed term it has to be the remainder.
    const fixed = RUNGS.findIndex((rung) => rung.bare === BareForm.Total);
    if (fixed < 0) return;
    for (let seed = 0; seed < 50; seed++) {
      expect(makeBareSubtraction(createRng(seed), rungAt(fixed)).unknown).toBe(Unknown.Start);
    }
  });

  test("and every term gets hidden where the rung varies it", () => {
    const seen = new Set(
      Array.from(
        { length: 200 },
        (_, seed) => makeBareSubtraction(createRng(seed), rungAt(WRITTEN)).unknown,
      ),
    );
    expect(seen.size).toBe(UNKNOWNS.length);
  });
});

describe("one cast of the clearing spell", () => {
  test("walks a line where the rung draws one", () => {
    const line = RUNGS.findIndex((rung) => rung.bare === undefined && !rung.counted);
    const cast = subtractionCastFor(createRng(1), rungAt(line));
    expect(cast.bare).toBe(null);
    expect(cast.problem.jumps.length).toBeGreaterThan(0);
  });

  test("and writes it down where the rung says so, in one box", () => {
    const written = RUNGS.findIndex((rung) => rung.bare !== undefined);
    const cast = subtractionCastFor(createRng(1), rungAt(written));
    if (!cast.bare) throw new Error("a bare rung drew a line");
    expect(cast.bare.takingAway).toBe(true);
    // One box, and nothing arrives done: a written sum has no journey to
    // have been part-way along.
    expect(cast.problem.stops).toHaveLength(1);
    expect(cast.given).toBe(0);
    expect(cast.problem.stops[0]).toBe(bareAnswer(cast.bare));
  });
});
