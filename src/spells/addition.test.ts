// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { createRng } from "../world/rng";
import {
  PLACES,
  backspace,
  beginCast,
  castResult,
  hintFor,
  isSolved,
  makeAdditionProblem,
  problemFor,
  submit,
  typeDigit,
} from "./addition";
import { HARDEST_RUNG, RUNGS, rungAt } from "./difficulty";

const SEEDS = Array.from({ length: 200 }, (_, i) => i * 7919 + 3);

function problems() {
  return SEEDS.map((seed) => makeAdditionProblem(createRng(seed)));
}

describe("problem generation", () => {
  test("both numbers are three digits and the sum still is", () => {
    for (const p of problems()) {
      expect(p.start).toBeGreaterThanOrEqual(100);
      expect(p.start).toBeLessThanOrEqual(999);
      expect(p.addend).toBeGreaterThanOrEqual(100);
      expect(p.addend).toBeLessThanOrEqual(999);
      expect(p.start + p.addend).toBeLessThan(1000);
    }
  });

  // The parchment draws one arrow per jump. A zero digit would make one of
  // them point at the number it started from, which reads as a missing piece
  // of the puzzle rather than as an easy one.
  test("every jump is a real jump, so every arrow has somewhere to point", () => {
    for (const p of problems()) {
      expect(p.jumps).toHaveLength(PLACES);
      for (const jump of p.jumps) expect(jump).toBeGreaterThan(0);
    }
  });

  test("the jumps are the addend's places, smallest first", () => {
    for (const p of problems()) {
      const [ones, tens, hundreds] = p.jumps as [number, number, number];
      expect(ones).toBe(p.addend % 10);
      expect(tens).toBe((Math.floor(p.addend / 10) % 10) * 10);
      expect(hundreds).toBe(Math.floor(p.addend / 100) * 100);
      expect(ones + tens + hundreds).toBe(p.addend);
    }
  });

  test("the stops are the running total and the last one is the answer", () => {
    for (const p of problems()) {
      expect(p.stops).toHaveLength(PLACES);
      expect(p.stops[0]).toBe(p.start + (p.jumps[0] as number));
      expect(p.stops[1]).toBe((p.stops[0] as number) + (p.jumps[1] as number));
      expect(p.stops[2]).toBe(p.start + p.addend);
    }
  });

  test("the stops climb, so the arrows never double back", () => {
    for (const p of problems()) {
      let previous = p.start;
      for (const stop of p.stops) {
        expect(stop).toBeGreaterThan(previous);
        previous = stop;
      }
    }
  });

  test("the same seed makes the same problem", () => {
    expect(makeAdditionProblem(createRng(42))).toEqual(makeAdditionProblem(createRng(42)));
  });

  // The distribution tests below pass on plenty of wrong constructions, so
  // they earn their place: drawing the addend evenly and then fitting a
  // start around it satisfies every correctness test above while quietly
  // pinning the start into the low hundreds and making the second number
  // reliably the bigger of the two.
  test("starts are not crowded into the low hundreds", () => {
    const starts = problems().map((p) => p.start);
    const high = starts.filter((s) => s >= 500).length;
    expect(high / starts.length).toBeGreaterThan(0.15);
  });

  test("neither number is systematically the bigger one", () => {
    const all = problems();
    const firstBigger = all.filter((p) => p.start > p.addend).length;
    expect(firstBigger / all.length).toBeGreaterThan(0.4);
    expect(firstBigger / all.length).toBeLessThan(0.6);
  });

  test("carrying happens often enough to be part of the lesson", () => {
    const carries = problems().filter((p) => (p.addend % 10) + (p.start % 10) >= 10).length;
    expect(carries / SEEDS.length).toBeGreaterThan(0.2);
  });
});

describe("working the problem", () => {
  const problem = problemFor(347, 265);

  test("the worked example is the one the docs use", () => {
    expect(problem.jumps).toEqual([5, 60, 200]);
    expect(problem.stops).toEqual([352, 412, 612]);
  });

  test("digits accumulate and backspace takes them off", () => {
    let state = beginCast(problem);
    for (const digit of [3, 5, 2]) state = typeDigit(state, digit);
    expect(state.entry).toBe("352");
    expect(backspace(state).entry).toBe("35");
  });

  test("a box takes no more than three digits", () => {
    let state = beginCast(problem);
    for (const digit of [3, 5, 2, 9]) state = typeDigit(state, digit);
    expect(state.entry).toBe("352");
  });

  test("a leading zero is dropped, since no stop starts with one", () => {
    expect(typeDigit(beginCast(problem), 0).entry).toBe("");
    // ...but a zero inside a number is fine.
    let state = typeDigit(beginCast(problem), 4);
    state = typeDigit(state, 0);
    expect(state.entry).toBe("40");
  });

  test("a correct answer advances to the next box", () => {
    let state = beginCast(problem);
    for (const digit of [3, 5, 2]) state = typeDigit(state, digit);
    state = submit(state);
    expect(state.index).toBe(1);
    expect(state.solved).toEqual([352]);
    expect(state.entry).toBe("");
    expect(state.wrong).toBe(false);
  });

  // The order is the lesson. If the hundreds could be answered first the
  // player would be doing 347 + 265 in their head and typing the result,
  // which is the thing the number line exists to replace.
  test("the answer to a later box is refused in an earlier one", () => {
    let state = beginCast(problem);
    for (const digit of [6, 1, 2]) state = typeDigit(state, digit);
    state = submit(state);
    expect(state.index).toBe(0);
    expect(state.wrong).toBe(true);
  });

  test("a wrong answer clears the box and counts an attempt, and nothing else", () => {
    let state = beginCast(problem);
    for (const digit of [3, 5, 1]) state = typeDigit(state, digit);
    state = submit(state);
    expect(state.index).toBe(0);
    expect(state.entry).toBe("");
    expect(state.attempts).toBe(1);
    expect(state.wrong).toBe(true);
    expect(isSolved(state)).toBe(false);
  });

  test("the wrong mark clears as soon as the player types again", () => {
    let state = beginCast(problem);
    state = submit(typeDigit(typeDigit(typeDigit(state, 3), 5), 1));
    expect(state.wrong).toBe(true);
    expect(typeDigit(state, 3).wrong).toBe(false);
  });

  test("attempts reset when the box is solved", () => {
    let state = beginCast(problem);
    state = submit(typeDigit(typeDigit(typeDigit(state, 3), 5), 1));
    state = submit(typeDigit(typeDigit(typeDigit(state, 3), 5), 2));
    expect(state.attempts).toBe(0);
  });

  test("submitting an empty box does nothing", () => {
    const state = beginCast(problem);
    expect(submit(state)).toEqual(state);
  });

  test("three correct answers solve the cast", () => {
    let state = beginCast(problem);
    for (const stop of problem.stops) {
      for (const digit of String(stop)) state = typeDigit(state, Number(digit));
      state = submit(state);
    }
    expect(isSolved(state)).toBe(true);
    expect(state.solved).toEqual([352, 412, 612]);
  });

  test("a solved cast ignores further input", () => {
    let state = beginCast(problem);
    for (const stop of problem.stops) {
      for (const digit of String(stop)) state = typeDigit(state, Number(digit));
      state = submit(state);
    }
    expect(typeDigit(state, 5)).toEqual(state);
    expect(backspace(state)).toEqual(state);
    expect(submit(state)).toEqual(state);
  });

  test("every generated problem can be solved by following the stops", () => {
    for (const p of problems()) {
      let state = beginCast(p);
      for (const stop of p.stops) {
        for (const digit of String(stop)) state = typeDigit(state, Number(digit));
        state = submit(state);
      }
      expect(isSolved(state)).toBe(true);
      expect(state.solved.at(-1)).toBe(p.start + p.addend);
    }
  });
});

describe("hints", () => {
  const problem = problemFor(347, 265);

  test("nothing is offered until something goes wrong", () => {
    expect(hintFor(beginCast(problem))).toBeNull();
  });

  test("the first hint names the place, the second the sum to do", () => {
    let state = beginCast(problem);
    state = submit(typeDigit(typeDigit(typeDigit(state, 3), 5), 1));
    expect(hintFor(state)).toBe("Add the ones to 347.");
    state = submit(typeDigit(typeDigit(typeDigit(state, 3), 5), 1));
    expect(hintFor(state)).toBe("347 + 5 = ?");
  });

  test("a hint counts from the previous stop, not from the start", () => {
    let state = beginCast(problem);
    state = submit(typeDigit(typeDigit(typeDigit(state, 3), 5), 2));
    state = submit(typeDigit(typeDigit(typeDigit(state, 4), 1), 1));
    expect(hintFor(state)).toBe("Add the tens to 352.");
  });

  // Naming the answer would turn the spell into a button, which the design
  // pillars rule out just as firmly as locking the player out would.
  test("no hint ever states the answer", () => {
    let state = beginCast(problem);
    for (let i = 0; i < 6; i++) {
      state = submit(typeDigit(typeDigit(typeDigit(state, 1), 1), 1));
      expect(hintFor(state)).not.toContain("352");
    }
  });
});

describe("problems at every difficulty", () => {
  const rungs = RUNGS.map((rung, index) => [index, rung] as const);

  test("a problem has exactly as many jumps as its rung has places", () => {
    for (const [index, rung] of rungs) {
      for (let seed = 0; seed < 40; seed++) {
        const problem = makeAdditionProblem(createRng(seed), rung);
        expect({ index, jumps: problem.jumps.length }).toEqual({ index, jumps: rung.places });
        expect({ index, stops: problem.stops.length }).toEqual({ index, stops: rung.places });
      }
    }
  });

  test("the jumps still add up to the addend, and the last stop to the sum", () => {
    for (const [index, rung] of rungs) {
      for (let seed = 0; seed < 40; seed++) {
        const p = makeAdditionProblem(createRng(seed), rung);
        const summed = p.jumps.reduce((sum, jump) => sum + jump, 0);
        expect({ index, seed, summed }).toEqual({ index, seed, summed: p.addend });
        expect({ index, seed, last: p.stops[p.stops.length - 1] }).toEqual({
          index,
          seed,
          last: p.start + p.addend,
        });
      }
    }
  });

  test("both numbers have the rung's number of digits", () => {
    for (const [index, rung] of rungs) {
      for (let seed = 0; seed < 40; seed++) {
        const p = makeAdditionProblem(createRng(seed), rung);
        expect({ index, ok: String(p.start).length === rung.places }).toEqual({ index, ok: true });
        expect({ index, ok: String(p.addend).length === rung.places }).toEqual({ index, ok: true });
      }
    }
  });

  // A carry at two or three places is internal — the tens spill into the
  // hundreds and the answer is still as wide as the numbers, which is what
  // keeps the number line the width the parchment draws. At one place there
  // is no such thing: crossing a ten *is* 7 + 5 = 12.
  test("the answer stays as wide as the numbers, except when bridging ten", () => {
    for (const [index, rung] of rungs) {
      const most = 10 ** rung.places - 1;
      const allowed = rung.crossing && rung.places === 1 ? most * 2 : most;
      for (let seed = 0; seed < 40; seed++) {
        const p = makeAdditionProblem(createRng(seed), rung);
        expect({ index, ok: p.start + p.addend <= allowed }).toEqual({ index, ok: true });
      }
      if (rung.places > 1) expect(allowed).toBe(most);
    }
  });

  // A zero digit makes one jump a `+0` that lands where it started, which
  // reads as a piece missing from the puzzle rather than as an easy one.
  test("no addend has a zero digit, at any size", () => {
    for (const [index, rung] of rungs) {
      for (let seed = 0; seed < 60; seed++) {
        const { addend } = makeAdditionProblem(createRng(seed), rung);
        expect({ index, zero: String(addend).includes("0") }).toEqual({ index, zero: false });
      }
    }
  });

  // The dial itself: on a number line a carry is "the jump crossed a ten".
  test("a no-crossing rung never sets a jump that carries", () => {
    for (const [index, rung] of rungs.filter(([, r]) => !r.crossing)) {
      for (let seed = 0; seed < 80; seed++) {
        const p = makeAdditionProblem(createRng(seed), rung);
        for (let at = 0; at < rung.places; at++) {
          const startDigit = Math.floor(p.start / 10 ** at) % 10;
          const addendDigit = Math.floor(p.addend / 10 ** at) % 10;
          expect({ index, seed, at, sum: startDigit + addendDigit <= 9 }).toEqual({
            index,
            seed,
            at,
            sum: true,
          });
        }
      }
    }
  });

  test("a crossing rung does actually set some that carry", () => {
    for (const [index, rung] of rungs.filter(([, r]) => r.crossing)) {
      const crossed = Array.from({ length: 60 }, (_, seed) => {
        const p = makeAdditionProblem(createRng(seed), rung);
        return (p.start % 10) + (p.addend % 10) > 9;
      });
      expect({ index, any: crossed.some(Boolean) }).toEqual({ index, any: true });
    }
  });

  // The bug this whole weighting scheme exists to prevent, and the reason it
  // has to be rebuilt per rung rather than filtered afterwards: a large
  // addend leaves very few legal starts, so drawing addends evenly squeezes
  // every start into the low end. It passed every correctness check the
  // first time and simply meant the player never saw a large first number —
  // and `startDigit + addendDigit <= 9` makes it far worse.
  test("the starting number is spread across its range, not crushed low", () => {
    for (const [index, rung] of rungs) {
      const low = rung.places === 1 ? 1 : 10 ** (rung.places - 1);
      const high = 10 ** rung.places - 1;
      const starts = Array.from(
        { length: 600 },
        (_, seed) => makeAdditionProblem(createRng(seed * 7919 + 13), rung).start,
      );
      const mean = starts.reduce((sum, s) => sum + s, 0) / starts.length;
      const span = high - low;
      // Comfortably inside the range rather than pinned to its bottom third.
      expect({ index, low: mean > low + span * 0.2 }).toEqual({ index, low: true });
      expect({ index, high: mean < high - span * 0.2 }).toEqual({ index, high: true });
      // And the top of the range is genuinely reachable.
      expect({ index, reach: Math.max(...starts) > low + span * 0.55 }).toEqual({
        index,
        reach: true,
      });
    }
  });

  test("the same seed and rung always sets the same problem", () => {
    for (const [, rung] of rungs) {
      expect(makeAdditionProblem(createRng(42), rung)).toEqual(
        makeAdditionProblem(createRng(42), rung),
      );
    }
  });
});

describe("a partly worked problem", () => {
  const rung = rungAt(2); // two places, first jump given

  test("starts on the box after the ones it was given", () => {
    const problem = makeAdditionProblem(createRng(3), rung);
    const state = beginCast(problem, rung.given);
    expect(state.index).toBe(1);
    expect(state.solved).toEqual([problem.stops[0] as number]);
    expect(isSolved(state)).toBe(false);
  });

  test("there is always something left to do", () => {
    for (const [index, r] of RUNGS.entries()) {
      const problem = makeAdditionProblem(createRng(index), r);
      // Even asked for more than the problem has, a cast is never over
      // before it starts.
      expect({ index, solved: isSolved(beginCast(problem, 99)) }).toEqual({ index, solved: false });
    }
  });

  test("a scaffolded cast still finishes on the right answer", () => {
    const problem = makeAdditionProblem(createRng(5), rung);
    let state = beginCast(problem, rung.given);
    while (!isSolved(state)) {
      const want = String(problem.stops[state.index] as number);
      for (const digit of want) state = typeDigit(state, Number(digit));
      state = submit(state);
    }
    expect(state.solved[state.solved.length - 1]).toBe(problem.start + problem.addend);
    expect(state.missteps).toBe(0);
  });
});

describe("what a finished cast reports back", () => {
  // There is no fail state, so `solved` is true however it went — and a
  // difficulty that could only see `solved` would see every cast as
  // identical and never move.
  test("a cast with no wrong answers is clean", () => {
    const problem = makeAdditionProblem(createRng(1), rungAt(0));
    let state = beginCast(problem);
    for (const digit of String(problem.stops[0] as number)) {
      state = typeDigit(state, Number(digit));
    }
    state = submit(state);
    expect(castResult(state, true)).toEqual({ solved: true, clean: true });
  });

  test("one wrong answer anywhere makes it not clean, even once corrected", () => {
    const problem = makeAdditionProblem(createRng(1), rungAt(HARDEST_RUNG));
    let state = beginCast(problem);
    state = typeDigit(state, 1);
    state = submit(state); // wrong
    while (!isSolved(state)) {
      for (const digit of String(problem.stops[state.index] as number)) {
        state = typeDigit(state, Number(digit));
      }
      state = submit(state);
    }
    expect(state.missteps).toBe(1);
    expect(castResult(state, true)).toEqual({ solved: true, clean: false });
  });

  test("a cast abandoned part-way is neither solved nor clean", () => {
    expect(castResult(beginCast(makeAdditionProblem(createRng(1))), false)).toEqual({
      solved: false,
      clean: false,
    });
    expect(castResult(null, true).clean).toBe(false);
  });
});

describe("the live box takes only digits the answer could need", () => {
  test("at one place it stops at two digits, not three", () => {
    const problem = makeAdditionProblem(createRng(2), rungAt(1));
    let state = beginCast(problem);
    state = typeDigit(typeDigit(typeDigit(state, 1), 2), 3);
    expect(state.entry).toBe("12");
  });

  test("at three places it still takes three", () => {
    const problem = makeAdditionProblem(createRng(2), rungAt(HARDEST_RUNG));
    let state = beginCast(problem);
    state = typeDigit(typeDigit(typeDigit(typeDigit(state, 1), 2), 3), 4);
    expect(state.entry).toBe("123");
  });
});
