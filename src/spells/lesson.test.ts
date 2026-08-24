// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { createRng } from "../world/rng";
import { PLACES, makeAdditionProblem, problemFor } from "./addition";
import { RUNGS, SHARED_TOP_RUNG, rungAt } from "./difficulty";
import {
  LESSON_ADDEND,
  LESSON_BEATS,
  LESSON_EXAMPLE,
  LESSON_START,
  LessonBeat,
  isLastBeat,
  lessonFor,
  nextBeat,
  partsOf,
} from "./lesson";

describe("the worked example", () => {
  // If the teacher's example were not a problem the spell could set, she
  // would be teaching a method for a game that does not exist.
  test("is the kind of problem the spell actually sets", () => {
    expect(LESSON_START).toBeGreaterThanOrEqual(100);
    expect(LESSON_START).toBeLessThanOrEqual(999);
    expect(LESSON_ADDEND).toBeGreaterThanOrEqual(100);
    expect(LESSON_START + LESSON_ADDEND).toBeLessThanOrEqual(999);
  });

  // A zero digit would make one of the three jumps land where it started —
  // an arrow pointing at the number it came from, in the one picture that
  // has to be clearest of all.
  test("has no zero digit to explain away", () => {
    for (const jump of LESSON_EXAMPLE.jumps) expect(jump).toBeGreaterThan(0);
  });

  // Three, which is the width of the pair rather than the parchment's
  // ceiling — the parchment reserves six now, and the shipped example is
  // still the three-digit sum it always was.
  test("is three jumps, ones then tens then hundreds", () => {
    expect(LESSON_EXAMPLE.jumps.length).toBe(3);
    expect(LESSON_EXAMPLE.jumps).toEqual([4, 10, 100]);
    expect(LESSON_EXAMPLE.stops).toEqual([152, 162, 262]);
  });

  test("its jumps add up to the number being added", () => {
    const total = LESSON_EXAMPLE.jumps.reduce((sum, jump) => sum + jump, 0);
    expect(total).toBe(LESSON_ADDEND);
    expect(LESSON_EXAMPLE.stops.at(-1)).toBe(LESSON_START + LESSON_ADDEND);
  });

  // Built by the same function, so the picture on the teacher's parchment
  // cannot drift from the one on the spell's.
  test("is shaped exactly like a problem the spell rolls", () => {
    const rolled = makeAdditionProblem(createRng(4), rungAt(SHARED_TOP_RUNG));
    expect(Object.keys(LESSON_EXAMPLE).sort()).toEqual(Object.keys(rolled).sort());
    expect(LESSON_EXAMPLE.jumps.length).toBe(rolled.jumps.length);
  });

  test("reads out biggest part first, though it is jumped smallest first", () => {
    expect(partsOf(LESSON_EXAMPLE)).toEqual([100, 10, 4]);
    expect(LESSON_EXAMPLE.jumps).toEqual([4, 10, 100]);
  });
});

describe("the beats", () => {
  test("are the four the panel knows how to draw, in order", () => {
    expect(LESSON_BEATS).toEqual([
      LessonBeat.Rune,
      LessonBeat.Split,
      LessonBeat.Jump,
      LessonBeat.Answer,
    ]);
    expect(new Set(LESSON_BEATS).size).toBe(LESSON_BEATS.length);
  });

  test("stepping forward and back walks them, and stops at the ends", () => {
    expect(nextBeat(LessonBeat.Rune, 1)).toBe(LessonBeat.Split);
    expect(nextBeat(LessonBeat.Split, -1)).toBe(LessonBeat.Rune);
    // Clamped rather than wrapping: a "next" that jumped back to the start
    // reads as the panel having lost its place.
    expect(nextBeat(LessonBeat.Rune, -1)).toBe(LessonBeat.Rune);
    expect(nextBeat(LessonBeat.Answer, 1)).toBe(LessonBeat.Answer);
  });

  test("only the last beat is the last one", () => {
    expect(isLastBeat(LessonBeat.Answer)).toBe(true);
    for (const beat of LESSON_BEATS.slice(0, -1)) expect(isLastBeat(beat)).toBe(false);
  });
});

describe("the lesson at every size of sum", () => {
  // She teaches on the numbers this child is actually being asked. A worked
  // example is only worth anything if it is a problem they can read.
  test("the example has as many jumps as the child's own sums", () => {
    for (const [index, rung] of RUNGS.entries()) {
      const example = lessonFor(rung);
      expect({ index, jumps: example.jumps.length }).toEqual({ index, jumps: rung.places });
    }
  });

  test("no jump is ever a plus nothing", () => {
    for (const rung of RUNGS) {
      for (const jump of lessonFor(rung).jumps) expect(jump).toBeGreaterThan(0);
    }
  });

  // A worked example that carries, shown to a child whose own sums never do,
  // demonstrates a step they have not been asked for and cannot check.
  test("it never carries when the child's own sums never carry", () => {
    for (const [index, rung] of RUNGS.entries()) {
      if (rung.crossing) continue;
      const { start, addend } = lessonFor(rung);
      for (let at = 0; at < rung.places; at++) {
        const sum = (Math.floor(start / 10 ** at) % 10) + (Math.floor(addend / 10 ** at) % 10);
        expect({ index, at, ok: sum <= 9 }).toEqual({ index, at, ok: true });
      }
    }
  });

  test("it is still built by the spell, at every size", () => {
    for (const rung of RUNGS) {
      const example = lessonFor(rung);
      expect(problemFor(example.start, example.addend, rung.places)).toEqual(example);
    }
  });

  // The sums the game shipped with are what the hardest rung still teaches:
  // nothing about adding a dial should have restyled the existing lesson.
  test("the hardest rung teaches exactly what it always did", () => {
    // Three places, which is where the shipped example lives — no longer
    // the top of the ladder, which now runs to six.
    expect(lessonFor(rungAt(SHARED_TOP_RUNG))).toEqual(LESSON_EXAMPLE);
  });

  test("the same sum, cut down — not a different one at every size", () => {
    const ones = RUNGS.map((rung) => lessonFor(rung).addend % 10);
    expect(new Set(ones).size).toBe(1);
  });
});

/**
 * The wide example and the shipped one are the same sum.
 *
 * The worked example grows to six places because the sums do, and it grows
 * by keeping its last digits rather than by becoming a different sum. This
 * is the join: cut the widest pair to three and the pair the game shipped
 * with comes out. Written down because the alternative is two constants that
 * drift, and a teacher demonstrating one sum while the spell sets another.
 */
describe("the example at six places", () => {
  test("is the shipped one with digits in front of it", () => {
    const wide = lessonFor({ places: 6, crossing: true, given: 0 });
    expect(String(wide.start).slice(-3)).toBe(String(LESSON_START));
    expect(String(wide.addend).slice(-3)).toBe(String(LESSON_ADDEND));
  });

  // The properties the three-digit pair was chosen for, kept all the way up.
  test("and keeps what made the shipped one a good example", () => {
    for (const places of [4, 5, 6]) {
      const wide = lessonFor({ places, crossing: true, given: 0 });
      expect({ places, jumps: wide.jumps.length }).toEqual({ places, jumps: places });
      // No jump that lands where it started.
      for (const jump of wide.jumps) expect(jump).toBeGreaterThan(0);
      // And an answer that still fits the width it was set at.
      expect(wide.stops.at(-1)).toBeLessThan(10 ** places);
      expect(wide.start).toBeGreaterThanOrEqual(10 ** (places - 1));
    }
  });
});
