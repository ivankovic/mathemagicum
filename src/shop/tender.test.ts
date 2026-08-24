// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { CURRENCY, coinsFor, smallestCoin } from "./currency";
import {
  addCoin,
  beginTender,
  canTender,
  clearTender,
  coinCount,
  difference,
  isExact,
  removeCoin,
  tenderOf,
  tenderTotal,
  tenderedCoins,
} from "./tender";

describe("putting coins on the counter", () => {
  test("starts empty and owing", () => {
    const tender = beginTender(250, 1000);
    expect(tenderTotal(tender)).toBe(0);
    expect(isExact(tender)).toBe(false);
    expect(difference(tender)).toBe(-250);
    expect(tenderedCoins(tender)).toEqual([]);
  });

  test("coins add up, and stack by value", () => {
    const tender = tenderOf(250, 1000, [100, 100, 50]);
    expect(tenderTotal(tender)).toBe(250);
    expect(coinCount(tender, 100)).toBe(2);
    expect(coinCount(tender, 50)).toBe(1);
    expect(coinCount(tender, 20)).toBe(0);
  });

  test("an exact sum is accepted, whichever coins make it", () => {
    expect(isExact(tenderOf(250, 1000, [100, 100, 50]))).toBe(true);
    expect(isExact(tenderOf(250, 1000, [200, 50]))).toBe(true);
    expect(isExact(tenderOf(250, 1000, [50, 50, 50, 50, 50]))).toBe(true);
  });

  // Being over is as wrong as being under, and is reported the same way:
  // this is exact payment, and change is a different exercise.
  test("too much is not exact", () => {
    const tender = tenderOf(250, 1000, [200, 100]);
    expect(isExact(tender)).toBe(false);
    expect(difference(tender)).toBe(50);
  });

  test("coins come off again", () => {
    let tender = tenderOf(250, 1000, [100, 100, 50]);
    tender = removeCoin(tender, 100);
    expect(tenderTotal(tender)).toBe(150);
    expect(coinCount(tender, 100)).toBe(1);
  });

  test("taking a coin that is not there does nothing", () => {
    const tender = tenderOf(250, 1000, [100]);
    expect(removeCoin(tender, 500)).toEqual(tender);
  });

  test("the last of a coin leaves no trace of it", () => {
    let tender = tenderOf(250, 1000, [100]);
    tender = removeCoin(tender, 100);
    expect(coinCount(tender, 100)).toBe(0);
    expect(tenderedCoins(tender)).toEqual([]);
  });

  test("clearing sweeps the counter but keeps what is owed", () => {
    const tender = clearTender(tenderOf(250, 1000, [100, 100, 50]));
    expect(tenderTotal(tender)).toBe(0);
    expect(tender.owed).toBe(250);
  });

  test("the counter is read largest coin first", () => {
    expect(tenderedCoins(tenderOf(500, 1000, [50, 500, 20, 100]))).toEqual([500, 100, 50, 20]);
  });

  // Letting the player build a pile they cannot afford and only saying so at
  // the end would waste the whole count.
  test("she cannot put down money she has not got", () => {
    let tender = beginTender(500, 250);
    tender = addCoin(tender, 200);
    tender = addCoin(tender, 100); // would be 300, purse is 250
    expect(tenderTotal(tender)).toBe(200);
    tender = addCoin(tender, 50);
    expect(tenderTotal(tender)).toBe(250);
  });

  test("nothing about it fails, however long it takes", () => {
    let tender = beginTender(250, 1000);
    for (let i = 0; i < 50; i++) tender = addCoin(tender, 5);
    expect(isExact(tender)).toBe(true);
    expect(tenderTotal(tender)).toBe(250);
  });
});

describe("whether a purchase can be attempted", () => {
  test("affordable when the price is payable and the purse covers it", () => {
    expect(canTender(CURRENCY, 250, 250)).toEqual({ ok: true, reason: "affordable" });
  });

  test("too expensive is not the same as impossible", () => {
    expect(canTender(CURRENCY, 500, 250)).toEqual({ ok: false, reason: "too-expensive" });
  });

  // A price no coins can make would leave the player counting for ever. The
  // smallest coin is one mite, so what cannot be expressed is a fraction of
  // one — which is exactly what a price should never be.
  test("a price the coins cannot express is refused before counting starts", () => {
    expect(canTender(CURRENCY, 2.5, 1000)).toEqual({ ok: false, reason: "unpayable" });
    expect(canTender(CURRENCY, 0, 1000)).toEqual({ ok: false, reason: "unpayable" });
  });
});

describe("every price can actually be counted out", () => {
  // The invariant the whole minigame rests on: an amount with no coin
  // decomposition is an unwinnable puzzle.
  test("greedy makes every payable amount, up to fifty ducat", () => {
    for (let owed = smallestCoin(CURRENCY); owed <= 5000; owed += smallestCoin(CURRENCY)) {
      const tender = tenderOf(owed, owed, coinsFor(CURRENCY, owed));
      expect({ owed, exact: isExact(tender) }).toEqual({ owed, exact: true });
    }
  });
});
