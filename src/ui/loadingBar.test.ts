// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { barFraction } from "./loadingBar";

const FIRST = { base: 0, span: 0.15 };
const SECOND = { base: 0.15, span: 0.85 };

describe("the loading bar", () => {
  test("an empty pass sits at its own start, a full one at its own end", () => {
    expect(barFraction(FIRST, { complete: 0, total: 30 }, 0)).toBe(0);
    expect(barFraction(FIRST, { complete: 30, total: 30 }, 0)).toBeCloseTo(0.15, 5);
    expect(barFraction(SECOND, { complete: 40, total: 40 }, 0.15)).toBeCloseTo(1, 5);
  });

  // Two passes on one loader: the second has to pick up the bar where the
  // first put it down, or the bar empties itself halfway through loading.
  test("the second pass starts where the first finished", () => {
    const end = barFraction(FIRST, { complete: 30, total: 30 }, 0);
    expect(barFraction(SECOND, { complete: 0, total: 40 }, end)).toBeCloseTo(end, 5);
  });

  // The failure this exists for: a multiatlas adds its pages to the queue
  // after its index lands, so the denominator grows while the bar is up.
  test("it never goes backwards when the file count grows", () => {
    let high = 0.15;
    const seen: number[] = [];
    for (const load of [
      { complete: 30, total: 33 },
      { complete: 33, total: 36 },
      { complete: 34, total: 60 }, // the atlas's pages join the queue
      { complete: 40, total: 60 },
      { complete: 60, total: 60 },
    ]) {
      high = barFraction(SECOND, load, high);
      seen.push(high);
    }
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(seen.at(-1)).toBeCloseTo(1, 5);
  });

  test("it never overshoots its pass, whatever the loader claims", () => {
    expect(barFraction(FIRST, { complete: 99, total: 30 }, 0)).toBeCloseTo(0.15, 5);
    expect(barFraction(SECOND, { complete: 99, total: 40 }, 0)).toBeCloseTo(1, 5);
  });

  // A loader asked before it has been given anything reports nothing to do.
  test("an empty queue is not a division by zero", () => {
    expect(barFraction(FIRST, { complete: 0, total: 0 }, 0)).toBe(0);
    expect(Number.isFinite(barFraction(SECOND, { complete: 0, total: 0 }, 0.15))).toBe(true);
  });
});
