// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { Inventory } from "./inventory";
import {
  CLEARED_YIELD,
  GATHERED_MATERIALS,
  MADE_MATERIALS,
  MATERIAL_TYPES,
  MaterialType,
  everyKindPays,
  yieldOf,
} from "./materials";
import { SCENERY_FOR_TERRAIN } from "./scenery";
import { CROP_PRICE, Purse, isSellable, sellCrops, sellPriceOf } from "./shop";

describe("what the world gives up", () => {
  /**
   * The clearing spell used to give nothing: a child solved a subtraction
   * problem, a tree came out of the ground, and that was the whole of it.
   * A kind of scenery added without a yield would put that back for one
   * terrain and nobody would notice which.
   */
  test("every kind of scenery pays something", () => {
    expect(everyKindPays()).toBe(true);
    for (const kind of Object.values(SCENERY_FOR_TERRAIN)) {
      const paid = yieldOf(kind ?? null);
      expect({ kind, paid: paid !== null }).toEqual({ kind, paid: true });
      expect(paid?.count).toBeGreaterThan(0);
    }
  });

  test("a fixture or a crop is not scenery and pays nothing", () => {
    expect(yieldOf(null)).toBeNull();
    expect(yieldOf("fence")).toBeNull();
  });

  /**
   * The bigger the thing, the more of it — the first time in this game that
   * *which* thing you clear has mattered, and a small table a child can
   * learn and then plan around.
   */
  test("the bigger the thing, the more it is worth", () => {
    expect(CLEARED_YIELD.woodland?.count).toBeGreaterThan(CLEARED_YIELD.grass?.count ?? 0);
    expect(CLEARED_YIELD.grass?.count).toBeGreaterThan(CLEARED_YIELD.dirt?.count ?? 0);
    expect(CLEARED_YIELD.mountain?.count).toBeGreaterThan(CLEARED_YIELD.hilly?.count ?? 0);
    expect(CLEARED_YIELD.hilly?.count).toBeGreaterThan(CLEARED_YIELD.sand?.count ?? 0);
  });

  // Things that grew give wood; things that did not give stone. Nothing in
  // the game says so in words, so a boulder that paid in logs would be a
  // rule a child could only learn by being surprised by it.
  test("what grew gives wood and what did not gives stone", () => {
    for (const kind of ["woodland", "grass", "dirt"]) {
      expect(CLEARED_YIELD[kind]?.material).toBe(MaterialType.Wood);
    }
    for (const kind of ["mountain", "hilly", "sand"]) {
      expect(CLEARED_YIELD[kind]?.material).toBe(MaterialType.Stone);
    }
  });
});

describe("selling what you gathered", () => {
  test("the store buys what was gathered, at what a crop fetches", () => {
    for (const material of GATHERED_MATERIALS) {
      expect(isSellable(material)).toBe(true);
      expect(sellPriceOf(material)).toBe(CROP_PRICE);
    }
  });

  /**
   * And not what a press made of it.
   *
   * This asked about `MATERIAL_TYPES`, which was every material while every
   * material was something the world gave up. The made ones are deliberately
   * unsellable: a part whose only destination is the shopkeeper is exactly
   * the problem the machines were built to solve — materials that are "coins
   * with an extra step" — arriving one tier later and harder to see.
   *
   * It would not even pay. A beam costs two wood and a stone, which is three
   * crops' worth, and would fetch one. The rule is written down so it is a
   * decision rather than an accident of the numbers.
   */
  test("and does not buy what a press made of it", () => {
    for (const part of MADE_MATERIALS) {
      expect({ part, sellable: isSellable(part) }).toEqual({ part, sellable: false });
      expect(sellPriceOf(part)).toBe(0);
    }
    // Between them they are still every material — a third kind added to
    // neither list would be a thing the store had no opinion about.
    expect([...GATHERED_MATERIALS, ...MADE_MATERIALS].sort()).toEqual([...MATERIAL_TYPES].sort());
  });

  test("and pays for them out of the same counter", () => {
    const inventory = new Inventory();
    const purse = new Purse();
    inventory.add(MaterialType.Wood, 3);
    const trade = sellCrops(inventory, purse, MaterialType.Wood, 3);
    expect({ ok: trade.ok, amount: trade.amount }).toEqual({ ok: true, amount: CROP_PRICE * 3 });
    expect(inventory.count(MaterialType.Wood)).toBe(0);
  });

  test("a fixture she bought is not something she can sell back", () => {
    expect(isSellable("fence")).toBe(false);
  });
});
