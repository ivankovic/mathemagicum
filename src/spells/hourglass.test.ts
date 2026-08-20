// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import {
  CLOCK_RUNGS,
  HARDEST_CLOCK_RUNG,
  Reading,
  backspaceHour,
  beginHourglassCast,
  clockRungAt,
  handAngles,
  hourglassFor,
  hourglassHint,
  readClock,
  submitHour,
  typeHourDigit,
  worthCasting,
} from "./hourglass";

/** A local timestamp, so the clock reads what the wall clock would. */
const at = (hour: number, minute = 0) => new Date(2026, 0, 5, hour, minute, 0, 0).getTime();

describe("reading a clock face", () => {
  // Down, not to the nearest. A clock that jumped past the hour would show a
  // time that has not happened yet, and a child checking it against the one
  // on the wall would find the game wrong.
  test("rounds down to what the rung can read", () => {
    expect(readClock(at(9, 58), Reading.Hour)).toEqual({ hour: 9, minute: 0 });
    expect(readClock(at(9, 58), Reading.Half)).toEqual({ hour: 9, minute: 30 });
    expect(readClock(at(9, 58), Reading.Quarter)).toEqual({ hour: 9, minute: 45 });
  });

  // A clock face has twelve hours on it, not twenty-four.
  test("puts the afternoon on the same face as the morning", () => {
    expect(readClock(at(15), Reading.Hour)).toEqual({ hour: 3, minute: 0 });
    expect(readClock(at(0), Reading.Hour)).toEqual({ hour: 0, minute: 0 });
  });

  test("points the hands where a clock points them", () => {
    expect(handAngles({ hour: 3, minute: 0 })).toEqual({ hour: 90, minute: 0 });
    expect(handAngles({ hour: 6, minute: 30 })).toEqual({ hour: 195, minute: 180 });
    // The hour hand creeps: at half past nine it is halfway to ten, which is
    // the thing that makes a clock hard to read and the reason the harder
    // rungs put the hands off the numerals.
    expect(handAngles({ hour: 9, minute: 30 }).hour).toBe(285);
  });
});

describe("how long you were gone", () => {
  test("counts the whole hours between the two faces", () => {
    const problem = hourglassFor(at(4), at(9), clockRungAt(0));
    expect(problem.hours).toBe(5);
    expect(problem.left).toEqual({ hour: 4, minute: 0 });
    expect(problem.back).toEqual({ hour: 9, minute: 0 });
  });

  // The thing that makes clock arithmetic its own kind: every instinct a
  // child has built on the number line says ten plus four is fourteen.
  test("goes round the dial rather than off the end of it", () => {
    expect(hourglassFor(at(10), at(14), clockRungAt(0)).hours).toBe(4);
    expect(hourglassFor(at(23), at(2), clockRungAt(0)).hours).toBe(3);
  });

  // A twelve-hour face cannot tell half a day from none, and the spell does
  // not invent a number the picture will not support.
  test("has nothing to give after exactly half a day, or none at all", () => {
    expect(worthCasting(hourglassFor(at(4), at(16), clockRungAt(0)))).toBe(false);
    expect(worthCasting(hourglassFor(at(4, 10), at(4, 50), clockRungAt(0)))).toBe(false);
    expect(worthCasting(hourglassFor(at(4), at(5), clockRungAt(0)))).toBe(true);
  });

  /**
   * The answer is the span between the *rounded* faces, always. A child who
   * counts round the dial and a child who subtracts have to arrive at the
   * same number, and both have to agree with what the spell pays out.
   */
  test("matches the picture, whatever the real minutes were", () => {
    for (const [rungAt, reading] of [
      [0, Reading.Hour],
      [2, Reading.Half],
      [4, Reading.Quarter],
    ] as const) {
      const problem = hourglassFor(at(4, 55), at(9, 5), clockRungAt(rungAt));
      const left = readClock(at(4, 55), reading);
      const back = readClock(at(9, 5), reading);
      const minutes = (back.hour * 60 + back.minute - (left.hour * 60 + left.minute) + 720) % 720;
      expect({ rungAt, hours: problem.hours }).toEqual({ rungAt, hours: Math.floor(minutes / 60) });
    }
  });
});

describe("the ladder", () => {
  test("teaches the face, never the span", () => {
    // Nothing on a rung says how long the child was away — that is theirs.
    for (const rung of CLOCK_RUNGS) {
      expect(Object.keys(rung).sort()).toEqual(["hintAfter", "numerals", "reading"]);
    }
  });

  test("takes the numerals away and then puts the hands off them", () => {
    const fineness: Record<string, number> = { hour: 0, half: 1, quarter: 2 };
    const step = (reading: string) => fineness[reading] ?? 0;
    for (const [n, rung] of CLOCK_RUNGS.entries()) {
      const before = CLOCK_RUNGS[n - 1];
      if (!before) continue;
      const harder =
        step(rung.reading) >= step(before.reading) && rung.hintAfter >= before.hintAfter;
      expect({ n, harder }).toEqual({ n, harder: true });
    }
    expect(CLOCK_RUNGS[0]?.numerals).toBe(true);
    expect(CLOCK_RUNGS[HARDEST_CLOCK_RUNG]?.numerals).toBe(false);
  });

  test("clamps a saved rung that is nonsense", () => {
    expect(clockRungAt(-3)).toEqual(CLOCK_RUNGS[0] as never);
    expect(clockRungAt(99)).toEqual(CLOCK_RUNGS[HARDEST_CLOCK_RUNG] as never);
  });
});

describe("answering", () => {
  const problem = hourglassFor(at(4), at(9), clockRungAt(0));

  test("takes the number of hours and finishes", () => {
    const cast = submitHour(typeHourDigit(beginHourglassCast(problem), 5));
    expect({ done: cast.done, missteps: cast.missteps }).toEqual({ done: true, missteps: 0 });
  });

  test("a wrong answer clears the box and never ends the cast", () => {
    let cast = submitHour(typeHourDigit(beginHourglassCast(problem), 9));
    expect({ done: cast.done, entry: cast.entry, wrong: cast.wrong }).toEqual({
      done: false,
      entry: "",
      wrong: true,
    });
    cast = submitHour(typeHourDigit(cast, 5));
    expect(cast.done).toBe(true);
  });

  // Eleven is as far as a twelve-hour face can count.
  test("the box takes two digits and no more", () => {
    let cast = beginHourglassCast(problem);
    cast = typeHourDigit(typeHourDigit(typeHourDigit(cast, 1), 1), 1);
    expect(cast.entry).toBe("11");
  });

  test("a leading zero is dropped rather than typed", () => {
    expect(typeHourDigit(beginHourglassCast(problem), 0).entry).toBe("");
  });

  test("backspace clears the mark on a wrong box", () => {
    let cast = submitHour(typeHourDigit(beginHourglassCast(problem), 9));
    cast = backspaceHour(typeHourDigit(cast, 9));
    expect({ entry: cast.entry, wrong: cast.wrong }).toEqual({ entry: "", wrong: false });
  });

  test("nothing changes once it is solved", () => {
    const cast = submitHour(typeHourDigit(beginHourglassCast(problem), 5));
    expect(submitHour(typeHourDigit(cast, 1))).toEqual(cast);
    expect(backspaceHour(cast)).toEqual(cast);
  });
});

describe("the help a stuck child is given", () => {
  const problem = hourglassFor(at(4), at(9), clockRungAt(0));

  test("draws nothing until something is wrong", () => {
    expect(hourglassHint(beginHourglassCast(problem))).toBe(0);
  });

  test("walks the hand round one hour per wrong answer", () => {
    let cast = beginHourglassCast(problem);
    cast = submitHour(typeHourDigit(cast, 9));
    expect(hourglassHint(cast)).toBe(1);
    cast = submitHour(typeHourDigit(cast, 9));
    expect(hourglassHint(cast)).toBe(2);
  });

  test("stops one hour short, because the last step is the answer", () => {
    let cast = beginHourglassCast(problem);
    for (let n = 0; n < 10; n++) cast = submitHour(typeHourDigit(cast, 9));
    expect(hourglassHint(cast)).toBe(4);
  });

  test("has nothing to draw when a single hour is the whole of it", () => {
    let cast = beginHourglassCast(hourglassFor(at(4), at(5), clockRungAt(0)));
    for (let n = 0; n < 4; n++) cast = submitHour(typeHourDigit(cast, 9));
    expect(hourglassHint(cast)).toBe(0);
  });

  test("waits longer at the top of the ladder", () => {
    const hard = hourglassFor(at(4), at(9), clockRungAt(HARDEST_CLOCK_RUNG));
    let cast = beginHourglassCast(hard);
    cast = submitHour(typeHourDigit(cast, 9));
    expect(hourglassHint(cast)).toBe(0);
    cast = submitHour(typeHourDigit(cast, 9));
    expect(hourglassHint(cast)).toBe(1);
  });
});
