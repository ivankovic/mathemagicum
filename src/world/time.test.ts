// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import {
  ALL_HOURS,
  MAX_NIGHT_ALPHA,
  OPENS_AT,
  SHUTS_AT,
  STARGAZING_HOURS,
  VILLAGE_HOURS,
  clockFace,
  isDaylight,
  isOpenHours,
  nightTintAlpha,
  opensIn,
  timeOfDay,
} from "./time";

describe("timeOfDay", () => {
  test("reads local hours/minutes/seconds as a fractional hour", () => {
    expect(timeOfDay(new Date(2026, 0, 1, 12, 0, 0))).toBe(12);
    expect(timeOfDay(new Date(2026, 0, 1, 0, 0, 0))).toBe(0);
    expect(timeOfDay(new Date(2026, 0, 1, 6, 30, 0))).toBe(6.5);
  });
});

/**
 * When the village is open, which is not the same as when it is light.
 *
 * The hours people keep rather than the hours the sun keeps: six in the
 * morning until nine at night, so the village wakes with the light and sits
 * up an hour past it. The tint has its own pair and they are deliberately
 * not these — see the tests below that hold them apart.
 */
describe("the opening hours", () => {
  const cases: [number, boolean][] = [
    [0, false],
    [4, false],
    [5.99, false],
    [OPENS_AT, true],
    [12, true],
    [20.99, true],
    [SHUTS_AT, false],
    [22, false],
    [23, false],
  ];
  for (const [hour, expected] of cases) {
    test(`hour ${hour} -> ${expected}`, () => {
      expect(isOpenHours(hour)).toBe(expected);
    });
  }
});

describe("how long a shut door stays shut", () => {
  test("is nothing at all while it is open", () => {
    expect(opensIn(OPENS_AT)).toBe(0);
    expect(opensIn(12)).toBe(0);
    expect(opensIn(SHUTS_AT - 0.01)).toBe(0);
  });

  // Two ways to be shut, and the difference is midnight. Before opening it
  // is a wait until this morning; after closing it is a wait until the next
  // one, which is the longer of the two and the one a child meets.
  test("counts to this morning before dawn and to the next after dusk", () => {
    expect(opensIn(4)).toBe(2);
    expect(opensIn(0)).toBe(OPENS_AT);
    expect(opensIn(SHUTS_AT)).toBe(24 - SHUTS_AT + OPENS_AT);
    expect(opensIn(23)).toBe(24 - 23 + OPENS_AT);
  });

  // Never negative and never more than a whole day, whatever it is handed.
  test("and is a wait somebody could actually sit through", () => {
    for (let hour = 0; hour < 24; hour += 0.25) {
      expect(opensIn(hour)).toBeGreaterThanOrEqual(0);
      expect(opensIn(hour)).toBeLessThanOrEqual(24);
    }
  });
});

/**
 * The village keeps its own hours, and the sky keeps the sun's.
 *
 * Stated as a test because the two were once the same pair of numbers, and
 * the cheap way to move a curfew is to move `SUNRISE` and `SUNSET` — which
 * would drag the light along with it and make the world dark at six in the
 * evening in high summer.
 *
 * They agree far more than they did, now that the village is up from six
 * until nine: a shut door is a dark street, which is what makes the moon
 * drawn on it true. What they still are is two separate facts, and the last
 * hour of the evening is where you can see it.
 */
describe("the light and the opening hours are not the same thing", () => {
  test("the village wakes with the light", () => {
    expect(nightTintAlpha(OPENS_AT)).toBe(0);
    expect(nightTintAlpha(OPENS_AT - 1)).toBeGreaterThan(0);
  });

  // And sits up past it. The shops are still open through the last of the
  // dusk, which is the hour that keeps these two pairs of numbers apart.
  test("and stays up an hour after it has gone", () => {
    expect(isOpenHours(SHUTS_AT - 0.5)).toBe(true);
    expect(nightTintAlpha(SHUTS_AT - 0.5)).toBeGreaterThan(0);
  });

  // And a shut door is a dark one, which is the whole of what moving them
  // was for: a moon over a bright garden was what the old pair drew.
  test("and a shut village is a dark one", () => {
    for (const hour of [SHUTS_AT, 22, 23, 0, 3, 5]) {
      expect({ hour, open: isOpenHours(hour), lit: nightTintAlpha(hour) === 0 }).toEqual({
        hour,
        open: false,
        lit: false,
      });
    }
  });
});

describe("what the corner of the screen says", () => {
  /**
   * The picture beside the digits, and the whole reason there are any.
   *
   * Reported from a playtest: *it's hard for the player to know if it is day
   * or night*. It follows the light rather than the village's hours, which
   * are deliberately a different pair — a moon drawn over a bright garden
   * because the shops have shut is exactly the mistake this must not make.
   */
  test("the sun is up while the sky is light, not while the shops are open", () => {
    expect(isDaylight(12)).toBe(true);
    expect(isDaylight(3)).toBe(false);
    expect(isDaylight(23)).toBe(false);
    // The hour that tells the two apart: the village is still open and the
    // sun has gone. A picture keyed to the doors would draw a sun on it.
    expect({ open: isOpenHours(20.5), sun: isDaylight(20.5) }).toEqual({
      open: true,
      sun: false,
    });
  });

  test("and it is dark before the village opens", () => {
    expect(isDaylight(OPENS_AT - 3)).toBe(false);
  });

  /**
   * Twelve hours, because twelve is the clock this game teaches.
   *
   * The hourglass spell asks a child to read hands off a face; a corner of
   * the screen saying 14:35 would be handing them a second notation for the
   * same time before they had the first.
   */
  test("the clock reads as a face does, with midnight and noon as twelve", () => {
    expect(clockFace(0)).toBe("12:00");
    expect(clockFace(12)).toBe("12:00");
    expect(clockFace(13.5)).toBe("1:30");
    expect(clockFace(9.25)).toBe("9:15");
  });

  // Truncated rather than rounded, like `readClock` and for its reason: a
  // clock a minute ahead of itself is a clock that is wrong.
  test("it never reads a minute that has not happened", () => {
    expect(clockFace(7.9999)).toBe("7:59");
    expect(clockFace(23.9999)).toBe("11:59");
  });

  // Whatever the hourglass has done to the world's clock, this has to have
  // something to say about it — the spell winds forward without limit.
  test("it says something sensible however far the glass has wound", () => {
    for (const hour of [-0.5, 24, 25.5, 48.75]) {
      expect({ hour, reads: /^\d{1,2}:[0-5]\d$/.test(clockFace(hour)) }).toEqual({
        hour,
        reads: true,
      });
    }
  });
});

describe("nightTintAlpha", () => {
  test("is 0 for the whole daytime plateau", () => {
    for (let hour = 6; hour < 20; hour += 0.5) {
      expect(nightTintAlpha(hour)).toBe(0);
    }
  });

  test("is at its max for deep night, both before dawn and after dusk", () => {
    for (const hour of [0, 1, 2, 3, 4, 4.5, 21.5, 22, 23, 23.9]) {
      expect(nightTintAlpha(hour)).toBeCloseTo(MAX_NIGHT_ALPHA, 5);
    }
  });

  test("ramps smoothly and monotonically across the dawn transition", () => {
    let previous = nightTintAlpha(4.5);
    for (let hour = 4.5; hour <= 6; hour += 0.25) {
      const alpha = nightTintAlpha(hour);
      expect(alpha).toBeLessThanOrEqual(previous + 1e-9);
      previous = alpha;
    }
    expect(nightTintAlpha(6)).toBeCloseTo(0, 5);
  });

  test("ramps smoothly and monotonically across the dusk transition", () => {
    let previous = nightTintAlpha(20);
    for (let hour = 20; hour <= 21.5; hour += 0.25) {
      const alpha = nightTintAlpha(hour);
      expect(alpha).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = alpha;
    }
    expect(nightTintAlpha(21.5)).toBeCloseTo(MAX_NIGHT_ALPHA, 5);
  });

  test("covers every hour of the day without gaps or NaNs", () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const alpha = nightTintAlpha(hour);
      expect(Number.isNaN(alpha)).toBe(false);
      expect(alpha).toBeGreaterThanOrEqual(0);
      expect(alpha).toBeLessThanOrEqual(MAX_NIGHT_ALPHA);
    }
  });
});

/**
 * The observatory keeps the hours of the thing it looks at.
 *
 * The one door in the world that is open at midnight and locked at noon, and
 * the one window that wraps midnight — which is the whole reason the two
 * functions above take a pair rather than reading a global.
 */
describe("the observatory's hours", () => {
  const cases: [number, boolean][] = [
    [0, true],
    [3, true],
    [STARGAZING_HOURS.shutsAt - 0.01, true],
    [STARGAZING_HOURS.shutsAt, false],
    [9, false],
    [12, false],
    [STARGAZING_HOURS.opensAt - 0.01, false],
    [STARGAZING_HOURS.opensAt, true],
    [22, true],
    [23.99, true],
  ];
  for (const [hour, expected] of cases) {
    test(`hour ${hour} -> ${expected}`, () => {
      expect(isOpenHours(hour, STARGAZING_HOURS)).toBe(expected);
    });
  }

  /**
   * It is open for the whole of the night the village sleeps through.
   *
   * This used to be the village's hours exactly inverted, and the trade was
   * the point: winding the glass to get into one door turned you out of the
   * other. The village is up from six until nine now, which overlaps the
   * dome's own evening — so the two are no longer opposites, and what is
   * left of the claim is the half that matters. Every hour the village is
   * shut, the dome is open.
   */
  test("covers every hour the village is shut", () => {
    for (let hour = 0; hour < 24; hour += 0.25) {
      if (isOpenHours(hour, VILLAGE_HOURS)) continue;
      expect({ hour, dome: isOpenHours(hour, STARGAZING_HOURS) }).toEqual({ hour, dome: true });
    }
  });

  /**
   * So there is no hour of the day with nothing open in it.
   *
   * There used to be: both doors were shut through the dusk, between the
   * hours people kept and the hours the sun keeps. A child who sat down at
   * half past six found a world that had gone to bed and no way into
   * anything until she had a spell she could only learn indoors.
   */
  test("and between them they leave no hour with nothing open", () => {
    for (let hour = 0; hour < 24; hour += 0.25) {
      const open = isOpenHours(hour, VILLAGE_HOURS) || isOpenHours(hour, STARGAZING_HOURS);
      expect({ hour, open }).toEqual({ hour, open: true });
    }
  });

  // And they really do overlap now, which is a change worth pinning rather
  // than leaving somebody to discover: the astronomer is at the eyepiece
  // before the shops have shut.
  test("and there are evening hours when both are open", () => {
    expect({
      village: isOpenHours(20, VILLAGE_HOURS),
      dome: isOpenHours(20, STARGAZING_HOURS),
    }).toEqual({ village: true, dome: true });
  });

  test("says how long until it is dark", () => {
    expect(opensIn(22, STARGAZING_HOURS)).toBe(0);
    expect(opensIn(2, STARGAZING_HOURS)).toBe(0);
    // Locked at noon, and opening this evening rather than tomorrow's.
    expect(opensIn(12, STARGAZING_HOURS)).toBe(STARGAZING_HOURS.opensAt - 12);
    // Just shut at dawn: the wait is the whole day.
    expect(opensIn(STARGAZING_HOURS.shutsAt, STARGAZING_HOURS)).toBe(
      STARGAZING_HOURS.opensAt - STARGAZING_HOURS.shutsAt,
    );
  });

  test("the village's own hours are unchanged by the argument", () => {
    for (let hour = 0; hour < 24; hour += 0.25) {
      expect(isOpenHours(hour)).toBe(isOpenHours(hour, VILLAGE_HOURS));
      expect(opensIn(hour)).toBe(opensIn(hour, VILLAGE_HOURS));
    }
  });

  // The door the tower keeps until a child has the portal. Written as a pair
  // of hours like every other door rather than as a special case in the
  // caller, so it goes through the same rule — and this is what says the
  // rule reads it the way it was meant: nought to twenty-four is the whole
  // day, not the empty window a `<` at the wrong end would make of it.
  test("and a door that never shuts is open at every hour of the day", () => {
    for (let hour = 0; hour < 24; hour += 0.25) {
      expect({ hour, open: isOpenHours(hour, ALL_HOURS) }).toEqual({ hour, open: true });
      expect(opensIn(hour, ALL_HOURS)).toBe(0);
    }
  });
});
