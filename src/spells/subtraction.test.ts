// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { createRng } from "../world/rng";
import { beginCast, movedBy, runsDown, submit, typeDigit } from "./addition";
import { RUNGS, rungAt } from "./difficulty";
import {
  type SubtractionProblem,
  makeSubtractionProblem,
  pairCountFor,
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
