// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { type CurrencyDefinition, isPayable, totalOf } from "./currency";

/**
 * Paying for something by counting the coins out yourself.
 *
 * The buying half of the shop. The player picks what and how many, and then
 * has to put the exact sum on the counter rather than the game deducting it
 * — which is the whole exercise: decomposing a number into the parts you
 * actually have, and noticing when you are over.
 *
 * Exact payment, no change given. Change is a different and harder skill
 * (subtraction, and knowing which coin to break) and it belongs to its own
 * minigame rather than being smuggled into this one.
 *
 * Nothing here can fail. A player may put down too little or too much for as
 * long as they like; only an exact sum is accepted, and being over is
 * reported as plainly as being under. See GAME_DESIGN.md's pillars — the
 * shop is not a place to lose money by being slow.
 */

/**
 * The most coins a payment may take to count out.
 *
 * Past a handful, counting stops being arithmetic and becomes bookkeeping.
 * Buying was capped only by what the purse held, which was survivable while
 * paying was a keypad and forty coins was forty taps. They are forty *drags*
 * now, across a table, and nobody is learning anything by the tenth one.
 *
 * Selling has no matching number, and the difference is the point: a sale is
 * counted out by the shopkeeper rather than by the child, and past this many
 * coins she gathers them into piles — which is also the line this constant
 * draws for her. What a child does by hand is bounded; what they are asked
 * to check is not, because checking piles is multiplication.
 */
export const MOST_COUNTER_COINS = 10;

export interface Tender {
  /** What is owed, in minor units. */
  readonly owed: number;
  /** How many of each coin are on the counter, keyed by the coin's value. */
  readonly coins: Readonly<Record<number, number>>;
  /** What the player can afford to put down in total. */
  readonly purse: number;
}

export function beginTender(owed: number, purse: number): Tender {
  return { owed, coins: {}, purse };
}

export function tenderTotal(tender: Tender): number {
  let sum = 0;
  for (const [value, count] of Object.entries(tender.coins)) sum += Number(value) * count;
  return sum;
}

export function coinCount(tender: Tender, value: number): number {
  return tender.coins[value] ?? 0;
}

/** Every coin on the counter, largest first — what the player sees. */
export function tenderedCoins(tender: Tender): number[] {
  const coins: number[] = [];
  for (const [value, count] of Object.entries(tender.coins)) {
    for (let i = 0; i < count; i++) coins.push(Number(value));
  }
  return coins.sort((a, b) => b - a);
}

/**
 * Put one more coin down.
 *
 * Refused once the counter holds more than the purse does: a player cannot
 * offer money they have not got, and letting them build an impossible pile
 * and only finding out at the end would waste the count.
 */
export function addCoin(tender: Tender, value: number): Tender {
  if (tenderTotal(tender) + value > tender.purse) return tender;
  return { ...tender, coins: { ...tender.coins, [value]: coinCount(tender, value) + 1 } };
}

export function removeCoin(tender: Tender, value: number): Tender {
  const held = coinCount(tender, value);
  if (held <= 0) return tender;
  const coins = { ...tender.coins };
  // Deleted at zero rather than left there, so `tenderedCoins` and the count
  // of *kinds* on the counter mean what they say.
  if (held === 1) delete coins[value];
  else coins[value] = held - 1;
  return { ...tender, coins };
}

export function clearTender(tender: Tender): Tender {
  return { ...tender, coins: {} };
}

export function isExact(tender: Tender): boolean {
  return tenderTotal(tender) === tender.owed;
}

/** How far off the counter is: negative short, positive over, zero right. */
export function difference(tender: Tender): number {
  return tenderTotal(tender) - tender.owed;
}

/**
 * Whether this purchase is possible at all.
 *
 * Two ways it is not: the price is not a whole number of the smallest coin,
 * or the player has not got enough. Both are worth knowing *before* the
 * counting starts rather than after.
 */
export function canTender(
  currency: CurrencyDefinition,
  owed: number,
  purse: number,
): { ok: boolean; reason: "affordable" | "too-expensive" | "unpayable" } {
  if (!isPayable(currency, owed)) return { ok: false, reason: "unpayable" };
  if (owed > purse) return { ok: false, reason: "too-expensive" };
  return { ok: true, reason: "affordable" };
}

/** Convenience for tests and for a caller holding a plain list of coins. */
export function tenderOf(owed: number, purse: number, coins: readonly number[]): Tender {
  return coins.reduce<Tender>((state, coin) => addCoin(state, coin), beginTender(owed, purse));
}

export { totalOf };
