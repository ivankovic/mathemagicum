// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { createRng } from "../world/rng";
import { PLACES, makeAdditionProblem } from "./addition";
import {
  LESSON_ADDEND,
  LESSON_BEATS,
  LESSON_EXAMPLE,
  LESSON_START,
  LessonBeat,
  isLastBeat,
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

  test("is three jumps, ones then tens then hundreds", () => {
    expect(LESSON_EXAMPLE.jumps.length).toBe(PLACES);
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
    const rolled = makeAdditionProblem(createRng(4));
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
