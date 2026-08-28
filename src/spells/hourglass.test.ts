// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import {
  CLOCK_RUNGS,
  type ClockTime,
  FULL_CIRCLE,
  HARDEST_CLOCK_RUNG,
  Reading,
  SAND_LEAST_MS,
  SAND_MOST_MS,
  SWIPE_PER_TICK,
  TICK_MINUTES,
  askedOf,
  asksMinutes,
  backspaceClock,
  beginHourglassCast,
  clockRungAt,
  forwardMinutes,
  handAngles,
  hourglassHint,
  moved,
  nextBox,
  readClock,
  sandFor,
  snapTime,
  spanOf,
  submitClock,
  swipeTicks,
  turnBy,
  typeClockDigit,
  windMinutes,
} from "./hourglass";

const HOUR_RUNG = clockRungAt(0);
const QUARTER_RUNG = clockRungAt(CLOCK_RUNGS.length - 1);
const at = (hour: number, minute = 0): ClockTime => ({ hour, minute });

/** Every time a face can show, at a given reading. */
function everyTime(reading: Reading): ClockTime[] {
  const step = reading === Reading.Hour ? 60 : reading === Reading.Half ? 30 : 15;
  const times: ClockTime[] = [];
  for (let minutes = 0; minutes < 720; minutes += step) {
    times.push({ hour: Math.floor(minutes / 60), minute: minutes % 60 });
  }
  return times;
}

describe("how far the clock is being moved", () => {
  test("forward, and never round more than the face can hold", () => {
    expect(spanOf(at(3), at(7))).toEqual({ hours: 4, minutes: 0 });
    expect(spanOf(at(9, 30), at(11, 45))).toEqual({ hours: 2, minutes: 15 });
  });

  /**
   * The case a plain subtraction gets wrong, and the reason the spell says
   * "the next time it will be" rather than putting am and pm on the face.
   */
  test("quarter to twelve to quarter past is half an hour, not eleven and a half", () => {
    expect(spanOf(at(11, 45), at(0, 15))).toEqual({ hours: 0, minutes: 30 });
  });

  test("standing still is no move at all", () => {
    for (const time of everyTime(Reading.Quarter)) {
      expect({ time, span: spanOf(time, time) }).toEqual({ time, span: { hours: 0, minutes: 0 } });
    }
  });

  // Whatever the pair, the answer is something a twelve-hour face can show.
  test("every pair of times asks for less than twelve hours", () => {
    for (const from of everyTime(Reading.Quarter)) {
      for (const to of everyTime(Reading.Quarter)) {
        const span = spanOf(from, to);
        expect({
          ok: span.hours >= 0 && span.hours < 12 && span.minutes >= 0 && span.minutes < 60,
        }).toEqual({ ok: true });
      }
    }
  });

  // The span and the clock have to agree: winding the world on by what the
  // child said must land the world on the face they pointed at.
  test("the span is exactly what gets the clock from one face to the other", () => {
    for (const from of everyTime(Reading.Quarter)) {
      for (const to of everyTime(Reading.Quarter)) {
        const span = spanOf(from, to);
        const landed = (from.hour * 60 + from.minute + span.hours * 60 + span.minutes) % 720;
        expect({ from, to, landed }).toEqual({ from, to, landed: to.hour * 60 + to.minute });
      }
    }
  });
});

describe("snapping to what the face can show", () => {
  test("the hour rung can only ever point at an hour", () => {
    expect(snapTime(at(4, 20), Reading.Hour)).toEqual(at(4));
    expect(snapTime(at(4, 40), Reading.Hour)).toEqual(at(5));
  });

  test("and the quarter rung at a quarter", () => {
    expect(snapTime(at(4, 20), Reading.Quarter)).toEqual(at(4, 15));
    expect(snapTime(at(4, 38), Reading.Quarter)).toEqual(at(4, 45));
  });

  // Round the top of the dial rather than off the end of it.
  test("a time that rounds past twelve comes back to the top", () => {
    expect(snapTime(at(11, 50), Reading.Hour)).toEqual(at(0));
  });

  test("whatever it is handed, it hands back a time a clock could show", () => {
    for (const reading of [Reading.Hour, Reading.Half, Reading.Quarter]) {
      for (let hour = 0; hour < 12; hour++) {
        for (let minute = 0; minute < 60; minute++) {
          const snapped = snapTime({ hour, minute }, reading);
          expect({
            reading,
            ok:
              snapped.hour >= 0 && snapped.hour < 12 && snapped.minute >= 0 && snapped.minute < 60,
          }).toEqual({ reading, ok: true });
        }
      }
    }
  });
});

describe("swiping the clock round", () => {
  // Clockwise is down and to the right. An approximation of going round a
  // dial, and the right one: a true rotation has to be measured about the
  // centre of the face, which means a swipe straight across the middle turns
  // the clock by nothing at all.
  test("down and to the right turns it forward", () => {
    expect(swipeTicks(0, 100)).toBeGreaterThan(0);
    expect(swipeTicks(100, 0)).toBeGreaterThan(0);
    expect(swipeTicks(70, 70)).toBeGreaterThan(0);
  });

  test("and up and to the left turns it back", () => {
    expect(swipeTicks(0, -100)).toBeLessThan(0);
    expect(swipeTicks(-100, 0)).toBeLessThan(0);
    expect(swipeTicks(-70, -70)).toBeLessThan(0);
  });

  // Neither way round the dial, so it turns nothing. Honest rather than
  // guessing: a finger going up and to the right is not winding anything.
  test("and a swipe that is neither turns nothing", () => {
    expect(swipeTicks(100, -100)).toBe(0);
    expect(swipeTicks(-100, 100)).toBe(0);
    expect(swipeTicks(0, 0)).toBe(0);
  });

  // A diagonal is one direction round the dial, not two: added and then
  // flattened, so it counts about the same as a straight swipe of the same
  // length rather than half as much again.
  // A swipe that is *purely* round the dial counts for all of its length; a
  // straight one down or across is only partly in that direction, and counts
  // for the part that is. Which is what projecting onto a direction means,
  // and is why a diagonal of the same length turns the clock further.
  test("and a diagonal counts for more than a straight swipe as long", () => {
    expect(swipeTicks(70, 70)).toBeGreaterThan(swipeTicks(0, 99));
  });

  test("a finger that has barely moved turns nothing at all", () => {
    for (let pixels = 0; pixels < SWIPE_PER_TICK; pixels++) {
      expect({ pixels, ticks: swipeTicks(pixels, 0) }).toEqual({ pixels, ticks: 0 });
    }
  });

  test("survives nonsense rather than winding the clock off its face", () => {
    expect(swipeTicks(Number.NaN, 10)).toBe(0);
    expect(swipeTicks(10, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("turning it by ticks", () => {
  test("forward, five minutes at a time", () => {
    let cast = beginHourglassCast(at(3), QUARTER_RUNG);
    cast = turnBy(cast, 1);
    expect(cast.to).toEqual(at(3, 5));
    cast = turnBy(cast, 3);
    expect(cast.to).toEqual(at(3, 20));
  });

  test("and backwards, which walks the hands anticlockwise", () => {
    let cast = beginHourglassCast(at(3), QUARTER_RUNG);
    cast = turnBy(cast, -2);
    expect(cast.to).toEqual(at(2, 50));
  });

  /**
   * Backwards on the face is not backwards in the world. The clock only ever
   * runs forward, so hands wound back to an hour already gone point at that
   * hour tomorrow — a long move rather than a negative one.
   */
  test("winding back one tick asks for nearly a whole face", () => {
    let cast = beginHourglassCast(at(3), QUARTER_RUNG);
    cast = turnBy(cast, -1);
    expect(askedOf(cast)).toEqual({ hours: 11, minutes: 55 });
  });

  test("round the top of the dial and out the other side", () => {
    let cast = beginHourglassCast(at(11, 45), QUARTER_RUNG);
    cast = turnBy(cast, 3);
    expect(cast.to).toEqual(at(0));
  });

  test("however far it is turned, it still reads as a time", () => {
    for (const ticks of [-500, -143, -1, 0, 1, 143, 500]) {
      let cast = beginHourglassCast(at(7, 30), QUARTER_RUNG);
      cast = turnBy(cast, ticks);
      expect({
        ticks,
        ok: cast.to.hour >= 0 && cast.to.hour < 12 && cast.to.minute % 5 === 0,
      }).toEqual({ ticks, ok: true });
    }
  });

  test("turning it again clears what was typed", () => {
    let cast = beginHourglassCast(at(3), QUARTER_RUNG);
    cast = turnBy(cast, 12);
    cast = typeClockDigit(cast, 1);
    cast = turnBy(cast, 1);
    expect(cast.hours).toBe("");
  });
});

describe("casting it", () => {
  // Three hours is thirty-six ticks of five minutes.
  const THREE_HOURS = 36;

  test("opens with the hands where the world's clock has them", () => {
    const cast = beginHourglassCast(at(7, 20), QUARTER_RUNG);
    expect(cast.from).toEqual(at(7, 15));
    expect(cast.to).toEqual(at(7, 15));
    expect(moved(cast)).toBe(false);
  });

  // Nothing to answer until the clock has been turned, and nothing to give:
  // a cast that wound it by nought is a cast that did nothing.
  test("and will not be finished until it has been turned", () => {
    let cast = beginHourglassCast(at(7), HOUR_RUNG);
    cast = typeClockDigit(cast, 0);
    cast = submitClock(cast);
    expect(cast.done).toBe(false);
  });

  test("turned, the span is what it asks for", () => {
    let cast = beginHourglassCast(at(7), HOUR_RUNG);
    cast = turnBy(cast, THREE_HOURS);
    expect(cast.to).toEqual(at(10));
    expect(askedOf(cast)).toEqual({ hours: 3, minutes: 0 });
  });

  test("the right answer finishes it", () => {
    let cast = beginHourglassCast(at(7), HOUR_RUNG);
    cast = turnBy(cast, THREE_HOURS);
    cast = typeClockDigit(cast, 3);
    cast = submitClock(cast);
    expect(cast.done).toBe(true);
    expect(cast.missteps).toBe(0);
  });

  test("a wrong one clears the boxes and is counted", () => {
    let cast = beginHourglassCast(at(7), HOUR_RUNG);
    cast = turnBy(cast, THREE_HOURS);
    cast = typeClockDigit(cast, 5);
    cast = submitClock(cast);
    expect(cast.done).toBe(false);
    expect(cast.wrong).toBe(true);
    expect(cast.missteps).toBe(1);
    expect(cast.hours).toBe("");
  });
});

describe("the two boxes", () => {
  const TWO_HOURS = 24;

  // Asked of the move, not of the rung: the clock turns five minutes at a
  // time at every rung now, so what decides whether the answer has a minutes
  // half is how far the child turned it.
  test("a move in whole hours is not asked about its minutes", () => {
    let cast = beginHourglassCast(at(7), HOUR_RUNG);
    cast = turnBy(cast, TWO_HOURS);
    expect(asksMinutes(cast)).toBe(false);
    cast = turnBy(cast, 3);
    expect(asksMinutes(cast)).toBe(true);
  });

  test("and a whole-hour answer needs no minutes to be right", () => {
    let cast = beginHourglassCast(at(7), HOUR_RUNG);
    cast = turnBy(cast, TWO_HOURS);
    cast = typeClockDigit(cast, 2);
    cast = submitClock(cast);
    expect(cast.done).toBe(true);
  });

  test("where minutes are asked for, both have to be right", () => {
    let cast = beginHourglassCast(at(7), QUARTER_RUNG);
    cast = turnBy(cast, TWO_HOURS + 3);
    expect(askedOf(cast)).toEqual({ hours: 2, minutes: 15 });
    cast = typeClockDigit(cast, 2);
    cast = nextBox(cast);
    cast = typeClockDigit(cast, 1);
    cast = typeClockDigit(cast, 5);
    cast = submitClock(cast);
    expect(cast.done).toBe(true);
  });

  // Both boxes take a nought. The hours box used to refuse one, on the
  // argument that the glass never had nothing to give — which stopped being
  // true when a move of twenty minutes became an ordinary thing to make.
  test("nought is an answer in either box", () => {
    let cast = beginHourglassCast(at(7), HOUR_RUNG);
    cast = turnBy(cast, 4);
    expect(askedOf(cast)).toEqual({ hours: 0, minutes: 20 });
    cast = typeClockDigit(cast, 0);
    expect(cast.hours).toBe("0");
    cast = nextBox(cast);
    cast = typeClockDigit(cast, 2);
    cast = typeClockDigit(cast, 0);
    cast = submitClock(cast);
    expect(cast.done).toBe(true);
  });

  test("enter moves along from the hours rather than judging early", () => {
    let cast = beginHourglassCast(at(7), QUARTER_RUNG);
    cast = turnBy(cast, TWO_HOURS + 3);
    cast = typeClockDigit(cast, 2);
    cast = submitClock(cast);
    expect(cast.done).toBe(false);
    expect(cast.wrong).toBe(false);
    expect(cast.box).toBe("minutes");
  });

  test("backspacing off the front of the minutes goes back to the hours", () => {
    let cast = beginHourglassCast(at(7), QUARTER_RUNG);
    cast = turnBy(cast, TWO_HOURS + 3);
    cast = nextBox(cast);
    cast = backspaceClock(cast);
    expect(cast.box).toBe("hours");
  });
});

describe("helping a stuck child", () => {
  const THREE_HOURS = 36;

  test("says nothing until one has been got wrong", () => {
    let cast = beginHourglassCast(at(7), HOUR_RUNG);
    cast = turnBy(cast, THREE_HOURS);
    expect(hourglassHint(cast)).toBe(0);
  });

  test("then counts one hour of the sweep for each miss", () => {
    let cast = beginHourglassCast(at(7), HOUR_RUNG);
    cast = turnBy(cast, THREE_HOURS);
    cast = typeClockDigit(cast, 9);
    cast = submitClock(cast);
    expect(hourglassHint(cast)).toBe(1);
  });

  // It stops one short, because the last step is the answer.
  test("and never counts the whole way round", () => {
    let cast = beginHourglassCast(at(7), HOUR_RUNG);
    cast = turnBy(cast, THREE_HOURS);
    for (let miss = 0; miss < 8; miss++) {
      cast = typeClockDigit(cast, 9);
      cast = submitClock(cast);
    }
    expect(hourglassHint(cast)).toBe(askedOf(cast).hours - 1);
  });
});

describe("reading the world's clock", () => {
  test("rounds down, so the game never shows a time that has not happened", () => {
    const noon = new Date(2026, 0, 1, 12, 55).getTime();
    expect(readClock(noon, Reading.Hour)).toEqual(at(0));
    expect(readClock(noon, Reading.Quarter)).toEqual(at(0, 45));
  });

  test("and gives a face, so the afternoon reads like the morning", () => {
    const evening = new Date(2026, 0, 1, 19, 0).getTime();
    expect(readClock(evening, Reading.Hour)).toEqual(at(7));
  });
});

describe("what the hands point at", () => {
  test("twelve is straight up and the hour hand creeps round", () => {
    expect(handAngles(at(0))).toEqual({ hour: 0, minute: 0 });
    expect(handAngles(at(3))).toEqual({ hour: 90, minute: 0 });
    expect(handAngles(at(3, 30)).hour).toBe(105);
    expect(handAngles(at(0, 15)).minute).toBe(90);
  });
});

describe("forwardMinutes", () => {
  test("is what everything else is built on", () => {
    expect(forwardMinutes(at(1), at(2))).toBe(60);
    expect(forwardMinutes(at(2), at(1))).toBe(660);
    expect(forwardMinutes(at(6), at(6))).toBe(0);
  });
});

describe("how long the sand runs", () => {
  test("a flick for the smallest move the face allows", () => {
    expect(sandFor(5)).toBe(SAND_LEAST_MS);
  });

  test("and three seconds for the biggest", () => {
    expect(sandFor(11 * 60 + 55)).toBe(SAND_MOST_MS);
  });

  // Straight between the two ends: the child picked the number, so the time
  // it takes should be readable back off it.
  test("and in between, in proportion", () => {
    const middle = sandFor((5 + 715) / 2);
    expect(middle).toBe(Math.round((SAND_LEAST_MS + SAND_MOST_MS) / 2));
  });

  test("never shorter than a flick nor longer than three seconds", () => {
    for (const minutes of [0, 1, 4, 5, 360, 715, 719, 1000, -20]) {
      const ran = sandFor(minutes);
      expect({ minutes, ok: ran >= SAND_LEAST_MS && ran <= SAND_MOST_MS }).toEqual({
        minutes,
        ok: true,
      });
    }
  });

  // A bigger move never runs for less time than a smaller one.
  test("and longer for a longer move, without exception", () => {
    let last = 0;
    for (let minutes = 5; minutes <= 715; minutes += 5) {
      const ran = sandFor(minutes);
      expect({ minutes, rising: ran >= last }).toEqual({ minutes, rising: true });
      last = ran;
    }
  });

  test("survives nonsense rather than running forever", () => {
    expect(sandFor(Number.NaN)).toBe(SAND_LEAST_MS);
    expect(sandFor(Number.POSITIVE_INFINITY)).toBe(SAND_MOST_MS);
  });
});

describe("all the way round the face", () => {
  const RUNG = clockRungAt(HARDEST_CLOCK_RUNG);
  const NOON: ClockTime = { hour: 0, minute: 0 };

  /**
   * Reported from a playtest: *jumping for more than 12 hours doesn't work.*
   *
   * It could not. A face holds twelve hours, so hands taken all the way
   * round land back where they started — and `forwardMinutes` quite
   * correctly calls that nought. The spell then refused to cast, because a
   * move of nothing is not a move.
   *
   * What the face cannot say, the *turning* can: hands that have been taken
   * round are not hands nobody touched, and that difference is the whole
   * fix.
   */
  test("hands taken right round ask for twelve hours, not none", () => {
    const untouched = beginHourglassCast(NOON, RUNG);
    expect(askedOf(untouched)).toEqual({ hours: 0, minutes: 0 });
    expect(moved(untouched)).toBe(false);

    const round = turnBy(untouched, FULL_CIRCLE / TICK_MINUTES);
    // Back where they started, and that is the point.
    expect(round.to).toEqual(untouched.to);
    expect(askedOf(round)).toEqual({ hours: 12, minutes: 0 });
    expect(moved(round)).toBe(true);
    expect(windMinutes(round)).toBe(FULL_CIRCLE);
  });

  test("and it is answered as twelve, with no minutes asked for", () => {
    let cast = turnBy(beginHourglassCast(NOON, RUNG), FULL_CIRCLE / TICK_MINUTES);
    expect(asksMinutes(cast)).toBe(false);
    cast = submitClock({ ...cast, hours: "12" });
    expect({ done: cast.done, missteps: cast.missteps }).toEqual({ done: true, missteps: 0 });
  });

  test("but nought is still refused, because nought is what it was", () => {
    const cast = submitClock({ ...beginHourglassCast(NOON, RUNG), hours: "0" });
    expect(cast.done).toBe(false);
  });

  /**
   * Turned out and back again is not a move.
   *
   * The counter is *net*, so a child who winds the hands forward and then
   * changes her mind has not asked for twelve hours — she has asked for
   * nothing, which is what the face says too.
   */
  test("turned out and back again is not a move at all", () => {
    let cast = turnBy(beginHourglassCast(NOON, RUNG), 36);
    cast = turnBy(cast, -36);
    expect(cast.turned).toBe(0);
    expect(moved(cast)).toBe(false);
    expect(askedOf(cast)).toEqual({ hours: 0, minutes: 0 });
  });

  /**
   * More than one circle is still twelve hours.
   *
   * A face holds twelve and cannot show thirteen. A child who keeps dragging
   * is asking for as far as it goes, and as far as it goes is once round —
   * which is also the plainest thing to answer.
   */
  test("two circles is still twelve hours", () => {
    const cast = turnBy(beginHourglassCast(NOON, RUNG), (2 * FULL_CIRCLE) / TICK_MINUTES);
    expect(askedOf(cast)).toEqual({ hours: 12, minutes: 0 });
  });

  test("and a circle and a bit is the bit", () => {
    const cast = turnBy(beginHourglassCast(NOON, RUNG), FULL_CIRCLE / TICK_MINUTES + 6);
    expect(askedOf(cast)).toEqual({ hours: 0, minutes: 30 });
    expect(asksMinutes(cast)).toBe(true);
  });

  test("the longest move the sand runs for is a whole circle", () => {
    expect(sandFor(FULL_CIRCLE)).toBe(SAND_MOST_MS);
  });
});
