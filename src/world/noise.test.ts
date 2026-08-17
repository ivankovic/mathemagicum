// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { fieldAt, uniform } from "./noise";

const SIZE = 200;

function sample(seed: number, fn: (c: number, r: number, s: number) => number): number[] {
  const out: number[] = [];
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) out.push(fn(col, row, seed));
  }
  return out;
}

describe("fieldAt", () => {
  test("stays within [0, 1]", () => {
    for (const value of sample(7, fieldAt)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  test("is the same every time for the same seed", () => {
    expect(fieldAt(31, 47, 12345)).toBe(fieldAt(31, 47, 12345));
  });

  test("a different seed gives a different field", () => {
    const a = sample(1, fieldAt);
    const b = sample(2, fieldAt);
    expect(a).not.toEqual(b);
  });

  test("neighbouring tiles are close together — this is the whole point", () => {
    // Coherent terrain depends on adjacent tiles landing in the same band.
    // If the field were as jumpy as a per-tile roll, nothing downstream
    // would clump.
    let worst = 0;
    for (let row = 0; row < SIZE; row++) {
      for (let col = 1; col < SIZE; col++) {
        worst = Math.max(worst, Math.abs(fieldAt(col, row, 3) - fieldAt(col - 1, row, 3)));
      }
    }
    expect(worst).toBeLessThan(0.1);
  });

  test("varies over distance rather than being flat", () => {
    const values = sample(5, fieldAt);
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.3);
  });
});

describe("uniform", () => {
  test("stays within [0, 1]", () => {
    for (const value of sample(9, uniform)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  test("spreads the field evenly, which is what makes habitat weights honest", () => {
    // The raw field clusters around its mean, so cutting it at 0.3 would not
    // put 30% of tiles below. The baked CDF corrects that; if the octave
    // constants change without remeasuring, this is what fails.
    //
    // Sampled sparsely over a wide extent rather than densely over a small
    // one: the field's period is ~96 tiles, so a 200-tile square is two
    // lattice cells and says nothing about the distribution.
    const EXTENT = 1200;
    const STRIDE = 4;
    const buckets = new Array(10).fill(0);
    let total = 0;
    for (const seed of [11, 2222, 333333, 44]) {
      for (let row = 0; row < EXTENT; row += STRIDE) {
        for (let col = 0; col < EXTENT; col += STRIDE) {
          buckets[Math.min(9, Math.floor(uniform(col, row, seed) * 10))]++;
          total++;
        }
      }
    }
    for (const count of buckets) {
      expect(Math.abs(count / total - 0.1)).toBeLessThan(0.03);
    }
  });

  test("preserves order — remapping must not reshuffle the landscape", () => {
    const points: [number, number][] = [
      [0, 0],
      [10, 40],
      [77, 13],
      [199, 199],
      [55, 120],
    ];
    const pairs = points.map(([c, r]) => [fieldAt(c, r, 8), uniform(c, r, 8)] as const);
    const byRaw = [...pairs].sort((a, b) => a[0] - b[0]);
    const byUniform = [...pairs].sort((a, b) => a[1] - b[1]);
    expect(byRaw).toEqual(byUniform);
  });

  test("is deterministic", () => {
    expect(uniform(64, 128, 4242)).toBe(uniform(64, 128, 4242));
  });
});
