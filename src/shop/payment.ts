// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { EN } from "../i18n/en";
import type { Phrases } from "../i18n/phrases";
import { type Rng, randInt } from "../world/rng";
import { type CurrencyDefinition, coinsFor, totalOf } from "./currency";

/**
 * Being paid, and checking it.
 *
 * The selling half of the shop. The shopkeeper counts coins onto the counter
 * and the player says whether the sum is right — which is the other half of
 * handling money, and the half that actually matters: anyone can hand over a
 * note, and it is noticing you were short-changed that takes practice.
 *
 * **She is wrong about one time in ten**, by one to three coins either way.
 * Rarely enough that checking is a habit rather than a chore, often enough
 * that not checking will eventually cost the player being right.
 *
 * She is never wrong on purpose and never gains by it: whatever the player
 * answers, she recounts and pays what is owed. Getting the check wrong costs
 * nothing but being told so. A shop that pocketed the difference would make
 * arithmetic a tax, which the design pillars rule out as firmly as they rule
 * out locking a spell behind a paywall — and a player who is unsure would
 * learn to avoid selling rather than to count.
 */

/** How often she miscounts. One in this many payments. */
export const MISTAKE_IN = 10;
/** How many coins she is out by when she does. */
export const MISTAKE_MIN_COINS = 1;
export const MISTAKE_MAX_COINS = 3;

/**
 * The most coins she will ever lay on the counter, which is what the shop
 * screen has room to show. Guaranteed by the trade limit above it: ten crops
 * is a sum greedy change makes out of few coins, and a miscount adds at most
 * MISTAKE_MAX_COINS more.
 */
export const MAX_OFFER_COINS = 12;

/**
 * How many of a thing she can buy at once and still count the money out.
 *
 * A flat limit of ten was fine while the largest coin was worth five of the
 * major unit; it stops being fine the moment the ladder changes, and the
 * ladder has changed once already. So the cap is worked out from the coins
 * rather than written down beside them.
 *
 * Stops at the first count that does not fit rather than the largest that
 * does: the quantity picker steps through every number on the way, so a
 * range with a hole in it is a range with a broken step in it.
 */
export function maxSaleCount(
  currency: CurrencyDefinition,
  unitPrice: number,
  limit: number,
): number {
  const room = MAX_OFFER_COINS - MISTAKE_MAX_COINS;
  let most = 1;
  for (let count = 1; count <= limit; count++) {
    if (coinsFor(currency, unitPrice * count).length > room) break;
    most = count;
  }
  return most;
}

export interface Offer {
  /** What the player is actually owed. */
  readonly owed: number;
  /** What she has put on the counter, largest coin first. */
  readonly coins: readonly number[];
  /** What that pile comes to. */
  readonly total: number;
  /** Whether the pile is right. The answer the player is being asked for. */
  readonly correct: boolean;
}

/**
 * Count out a payment, occasionally getting it wrong.
 *
 * Seeded rather than `Math.random`, so the one-in-ten path can be tested and
 * reproduced. It is the path that matters most: a player who trusts a wrong
 * offer is the whole reason the exercise exists.
 */
export function makeOffer(currency: CurrencyDefinition, owed: number, rng: Rng): Offer {
  const right = coinsFor(currency, owed);
  if (right.length === 0) return { owed, coins: [], total: 0, correct: true };
  if (randInt(rng, 1, MISTAKE_IN) !== 1) {
    return { owed, coins: right, total: totalOf(right), correct: true };
  }
  const wrong = miscount(currency, right, rng);
  return { owed, coins: wrong, total: totalOf(wrong), correct: totalOf(wrong) === owed };
}

/**
 * Add or drop a few coins.
 *
 * Taking away is only offered when there is enough to take from: a pile of
 * two coins cannot lose three, and a pile that lost all of them would be no
 * offer at all rather than a wrong one.
 */
function miscount(currency: CurrencyDefinition, right: readonly number[], rng: Rng): number[] {
  const most = Math.min(MISTAKE_MAX_COINS, right.length - 1);
  const canTakeAway = most >= MISTAKE_MIN_COINS;
  const takeAway = canTakeAway && randInt(rng, 0, 1) === 0;
  const coins = [...right];
  if (takeAway) {
    const count = randInt(rng, MISTAKE_MIN_COINS, most);
    for (let i = 0; i < count; i++) {
      coins.splice(randInt(rng, 0, coins.length - 1), 1);
    }
  } else {
    const count = randInt(rng, MISTAKE_MIN_COINS, MISTAKE_MAX_COINS);
    for (let i = 0; i < count; i++) {
      const value = currency.denominations[randInt(rng, 0, currency.denominations.length - 1)];
      coins.push(value as number);
    }
  }
  return coins.sort((a, b) => b - a);
}

export interface Verdict {
  /** Whether the player judged the offer correctly. */
  readonly right: boolean;
  /** What she ends up paying — always what is owed. */
  readonly paid: number;
  readonly message: string;
}

/**
 * Judge the player's answer.
 *
 * She pays what is owed either way. The only thing at stake is being told
 * whether you were right, which is the same bargain the addition spell makes.
 */
export function judgeOffer(
  currency: CurrencyDefinition,
  offer: Offer,
  playerSaysCorrect: boolean,
  words: Phrases = EN,
): Verdict {
  const right = playerSaysCorrect === offer.correct;
  const short = offer.total < offer.owed;
  if (right) {
    return {
      right: true,
      paid: offer.owed,
      message: offer.correct
        ? words.verdictExact(currency.format(offer.owed))
        : words.verdictSpotted(currency.format(offer.total), currency.format(offer.owed), short),
    };
  }
  return {
    right: false,
    paid: offer.owed,
    message: offer.correct
      ? words.verdictWasRight(currency.format(offer.owed))
      : words.verdictLookAgain(currency.format(offer.total), currency.format(offer.owed)),
  };
}
