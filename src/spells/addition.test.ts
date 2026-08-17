// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { createRng } from "../world/rng";
import {
  PLACES,
  backspace,
  beginCast,
  hintFor,
  isSolved,
  makeAdditionProblem,
  problemFor,
  submit,
  typeDigit,
} from "./addition";

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
