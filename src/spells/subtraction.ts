// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { type Rng, randInt } from "../world/rng";
import { type NumberLine, PLACES } from "./addition";
import { HARDEST_RUNG, type Rung, rungAt } from "./difficulty";

/**
 * The subtraction spell: the same number line, walked the other way.
 *
 * The growth spell adds and makes things grow. This one takes away, and what
 * it takes away is whatever is in the way — a tree, a boulder, an outcrop of
 * rock. That is the theme rule the design applies to every spell, read
 * backwards: the spell that subtracts is the one that removes.
 *
 * The method is deliberately identical. Break the number being taken into
 * its ones, tens and hundreds, jump *back* along the line by each in turn,
 * and read off where you land. A child who can do one can do the other, and
 * the parchment they do it on is the same parchment — it reads the direction
 * off the stops rather than being told, so the sign over the line can never
 * disagree with the arithmetic underneath it.
 *
 * **Borrowing is what crossing means here.** On a number line, addition's
 * carry is "the jump crossed a ten going up"; subtraction's borrow is the
 * same crossing coming down. It is the same dial and the same rung, so a
 * child who is not being given carries is not given borrows either.
 */

export interface SubtractionProblem extends NumberLine {
  /** The number taken away from the start. */
  readonly taken: number;
}

interface Pairs {
  readonly taken: readonly number[];
  readonly starts: readonly (readonly number[])[];
  readonly weights: readonly number[];
  readonly total: number;
}

const PAIRS = new Map<string, Pairs>();

function digitsOf(value: number, places: number): number[] {
  const out: number[] = [];
  for (let at = 0; at < places; at++) out.push(Math.floor(value / 10 ** at) % 10);
  return out;
}

/**
 * How high the number being taken *from* may go.
 *
 * The mirror of addition's `sumCeiling`, and it exists for the same one
 * case. At a single place, "crossing" has nothing to cross: 7 − 5 borrows
 * from nowhere, so the rung would be identical to the one below it. What
 * bridging ten actually looks like coming down is a start above ten — 12 − 5
 * — which is exactly the reflection of addition's 7 + 5 = 12.
 */
function startCeiling(places: number, crossing: boolean): number {
  const most = 10 ** places - 1;
  return crossing && places === 1 ? most * 2 : most;
}

/**
 * Whether every jump lands without borrowing.
 *
 * Digit by digit: you can take this place's digit away without reaching into
 * the one above it. Far more restrictive than addition's rule, which only
 * asks that two digits not overflow — so the pair counts are checked in the
 * tests rather than assumed.
 */
function noJumpBorrows(startDigits: readonly number[], takenDigits: readonly number[]): boolean {
  return takenDigits.every((digit, at) => digit <= (startDigits[at] ?? 0));
}

function pairsFor(places: number, crossing: boolean): Pairs {
  const key = `${places}:${crossing}`;
  const cached = PAIRS.get(key);
  if (cached) return cached;

  const low = places === 1 ? 1 : 10 ** (places - 1);
  const high = 10 ** places - 1;
  const ceiling = startCeiling(places, crossing);
  const taken: number[] = [];
  const starts: number[][] = [];
  const weights: number[] = [];

  for (let amount = low; amount <= high; amount++) {
    // No zero digit in what is taken, for the reason the addend has none: a
    // `−0` jump lands where it started, and an arrow pointing back at the
    // number it came from reads as a piece missing rather than as an easy one.
    const takenDigits = digitsOf(amount, places);
    if (takenDigits.some((digit) => digit === 0)) continue;

    const valid: number[] = [];
    for (let start = low; start <= ceiling; start++) {
      // Never below one. Nought is a fine answer arithmetically and a poor
      // one here — the line would end where it has no room to draw a stop,
      // and "how many are left" is a question about something rather than
      // nothing.
      if (start - amount < 1) continue;
      if (crossing || noJumpBorrows(digitsOf(start, places), takenDigits)) valid.push(start);
    }
    if (valid.length === 0) continue;
    taken.push(amount);
    starts.push(valid);
    weights.push(valid.length);
  }

  const pairs: Pairs = {
    taken,
    starts,
    weights,
    total: weights.reduce((sum, weight) => sum + weight, 0),
  };
  PAIRS.set(key, pairs);
  return pairs;
}

/** How many pairs a rung can draw from. Used by the tests, and worth asking. */
export function pairCountFor(places: number, crossing: boolean): number {
  return pairsFor(places, crossing).total;
}

/**
 * A problem at one difficulty.
 *
 * Drawn uniformly over the pairs that actually exist rather than over the
 * amounts that happen to be legal — the same correction addition needed, and
 * it matters more here: no-borrow leaves a large subtrahend almost nowhere to
 * start from, so weighting by amount would push every problem into the high
 * end of the range.
 */
export function makeSubtractionProblem(
  rng: Rng,
  rung: Rung = rungAt(HARDEST_RUNG),
): SubtractionProblem {
  const pairs = pairsFor(rung.places, rung.crossing);
  let ticket = randInt(rng, 1, pairs.total);
  let index = pairs.taken.length - 1;
  for (const [at, weight] of pairs.weights.entries()) {
    ticket -= weight;
    if (ticket <= 0) {
      index = at;
      break;
    }
  }
  const amount = pairs.taken[index] as number;
  const valid = pairs.starts[index] as readonly number[];
  const start = valid[randInt(rng, 0, valid.length - 1)] as number;
  return subtractionFor(start, amount, rung.places);
}

/** The same problem from a chosen pair — used by tests and worked examples. */
export function subtractionFor(start: number, taken: number, places = PLACES): SubtractionProblem {
  const jumps = Array.from(
    { length: places },
    (_, at) => (Math.floor(taken / 10 ** at) % 10) * 10 ** at,
  );
  const stops: number[] = [];
  let at = start;
  for (const jump of jumps) {
    at -= jump;
    stops.push(at);
  }
  return { start, taken, jumps, stops };
}
