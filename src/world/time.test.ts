// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import {
  MAX_NIGHT_ALPHA,
  OPENS_AT,
  SHUTS_AT,
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
 * The hours people keep rather than the hours the sun keeps: villagers start
 * for home at six with the sun still up, and the shops are shut well before
 * dark. The tint has its own pair of hours and they are deliberately not
 * these — see the test below that holds them apart.
 */
describe("the opening hours", () => {
  const cases: [number, boolean][] = [
    [0, false],
    [5, false],
    [7.99, false],
    [OPENS_AT, true],
    [12, true],
    [17.99, true],
    [SHUTS_AT, false],
    [19.9, false],
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
    expect(opensIn(6)).toBe(2);
    expect(opensIn(0)).toBe(OPENS_AT);
    expect(opensIn(SHUTS_AT)).toBe(24 - SHUTS_AT + OPENS_AT);
    expect(opensIn(23)).toBe(9);
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
 * Stated as a test because the two were the same pair of numbers, and the
 * cheap way to move the curfew would have been to move `SUNRISE` and
 * `SUNSET` — which would have quietly dragged the light with it and made
 * the world dark at six in the evening in high summer.
 */
describe("the light and the opening hours are not the same thing", () => {
  test("it is broad daylight when the shops shut", () => {
    expect(nightTintAlpha(SHUTS_AT)).toBe(0);
  });

  test("and still dark when they open", () => {
    expect(nightTintAlpha(OPENS_AT)).toBe(0);
    expect(nightTintAlpha(5)).toBeGreaterThan(0);
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
