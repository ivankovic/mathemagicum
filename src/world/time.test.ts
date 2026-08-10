// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { isDaytime, nightTintAlpha, timeOfDay } from "./time";

describe("timeOfDay", () => {
  test("reads local hours/minutes/seconds as a fractional hour", () => {
    expect(timeOfDay(new Date(2026, 0, 1, 12, 0, 0))).toBe(12);
    expect(timeOfDay(new Date(2026, 0, 1, 0, 0, 0))).toBe(0);
    expect(timeOfDay(new Date(2026, 0, 1, 6, 30, 0))).toBe(6.5);
  });
});

describe("isDaytime", () => {
  const cases: [number, boolean][] = [
    [0, false],
    [5, false],
    [6, true],
    [12, true],
    [19.9, true],
    [20, false],
    [23, false],
  ];
  for (const [hour, expected] of cases) {
    test(`hour ${hour} -> ${expected}`, () => {
      expect(isDaytime(hour)).toBe(expected);
    });
  }
});

describe("nightTintAlpha", () => {
  test("is 0 for the whole daytime plateau", () => {
    for (let hour = 6; hour < 20; hour += 0.5) {
      expect(nightTintAlpha(hour)).toBe(0);
    }
  });

  test("is at its max for deep night, both before dawn and after dusk", () => {
    for (const hour of [0, 1, 2, 3, 4, 4.5, 21.5, 22, 23, 23.9]) {
      expect(nightTintAlpha(hour)).toBeCloseTo(0.55, 5);
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
    expect(nightTintAlpha(21.5)).toBeCloseTo(0.55, 5);
  });

  test("covers every hour of the day without gaps or NaNs", () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const alpha = nightTintAlpha(hour);
      expect(Number.isNaN(alpha)).toBe(false);
      expect(alpha).toBeGreaterThanOrEqual(0);
      expect(alpha).toBeLessThanOrEqual(0.55);
    }
  });
});
