// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { chance, createRng, pick, randInt } from "./rng";

describe("createRng", () => {
  test("the same seed produces the exact same sequence", () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  test("different seeds produce different sequences", () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  test("values stay within [0, 1)", () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("randInt", () => {
  test("stays within the inclusive range across many draws", () => {
    const rng = createRng(123);
    for (let i = 0; i < 500; i++) {
      const v = randInt(rng, 3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
  });

  test("a single-value range always returns that value", () => {
    const rng = createRng(1);
    expect(randInt(rng, 5, 5)).toBe(5);
  });
});

describe("pick", () => {
  test("only returns items from the given array", () => {
    const rng = createRng(5);
    const items = ["a", "b", "c"];
    for (let i = 0; i < 50; i++) {
      expect(items).toContain(pick(rng, items));
    }
  });

  test("throws on an empty array", () => {
    const rng = createRng(5);
    expect(() => pick(rng, [])).toThrow();
  });
});

describe("chance", () => {
  test("probability 0 never succeeds, probability 1 always succeeds", () => {
    const rng = createRng(9);
    for (let i = 0; i < 50; i++) {
      expect(chance(rng, 0)).toBe(false);
    }
    for (let i = 0; i < 50; i++) {
      expect(chance(rng, 1)).toBe(true);
    }
  });
});
