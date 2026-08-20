// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import {
  GROVE_BEATS,
  GROVE_LESSON_COLUMNS,
  GROVE_LESSON_ROWS,
  GroveBeat,
  groveLessonFor,
  isLastGroveBeat,
  nextGroveBeat,
} from "./groveLesson";
import { arrayRungAt } from "./multiplication";

describe("what the great tree shows you", () => {
  /**
   * The reported fault, as a test. The tree used to open straight onto the
   * lesson and write what it was asking for to the one-line message behind
   * the panel — so the game stated its only quest in the smallest type it
   * has, at the moment the child was reading something else. The task is a
   * page now, and it is the page the deck opens on.
   */
  test("asks before it teaches", () => {
    expect(GROVE_BEATS[0]).toBe(GroveBeat.Task);
    expect(GROVE_BEATS.indexOf(GroveBeat.Task)).toBeLessThan(GROVE_BEATS.indexOf(GroveBeat.Rune));
  });

  // The lesson itself still ends on the turn, which is the one fact a child
  // cannot arrive at by counting and the reason the deck exists at all.
  test("ends on the patch turned round", () => {
    expect(isLastGroveBeat(GroveBeat.Turn)).toBe(true);
    expect(isLastGroveBeat(GroveBeat.Task)).toBe(false);
  });

  test("every beat appears exactly once", () => {
    expect(new Set(GROVE_BEATS).size).toBe(GROVE_BEATS.length);
    expect(GROVE_BEATS.length).toBe(Object.keys(GroveBeat).length);
  });

  test("paging stops at both ends rather than wrapping", () => {
    expect(nextGroveBeat(GroveBeat.Task, -1)).toBe(GroveBeat.Task);
    expect(nextGroveBeat(GroveBeat.Task, 1)).toBe(GroveBeat.Rune);
    expect(nextGroveBeat(GroveBeat.Turn, 1)).toBe(GroveBeat.Turn);
    expect(nextGroveBeat(GroveBeat.Turn, -1)).toBe(GroveBeat.Count);
  });

  // A rectangle, not a square: the last page turns the patch on its side,
  // and a square turned round is indistinguishable from a square.
  test("teaches on a rectangle, at whatever rung the child is on", () => {
    expect(GROVE_LESSON_ROWS).not.toBe(GROVE_LESSON_COLUMNS);
    for (const at of [0, 3, 5]) {
      const example = groveLessonFor(arrayRungAt(at));
      expect({ at, rows: example.rows, columns: example.columns }).toEqual({
        at,
        rows: GROVE_LESSON_ROWS,
        columns: GROVE_LESSON_COLUMNS,
      });
    }
  });
});
