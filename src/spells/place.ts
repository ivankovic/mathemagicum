// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { type Rng, randInt } from "../world/rng";
import { type NumberLine, bareLine } from "./addition";
import type { Rung } from "./difficulty";

/**
 * What a digit is worth: the question underneath every sum in this game.
 *
 * A number is shown whole and one of its digits is lit. She types what that
 * digit *is worth* — the three in `4372` is not three, it is three hundred.
 * That is the fact every carrying sum on the ladder has been leaning on
 * without ever asking about it, and it is the difference between a child
 * who can add and a child who knows why adding works.
 *
 * **Only near the top, and that is not caution.** Place value cannot be
 * asked of a number that has one place — "what is the four in 4 worth" is
 * not a question — and it is barely a question at two. It wants three
 * digits before it means anything, which is where the two hardest bands
 * live. See `PLACE_FROM`.
 *
 * **The answer is the digit followed by its zeros.** Highlight the tens of
 * `472` and the answer is seventy; highlight the thousands of `5138` and it
 * is five thousand. Written that way round on purpose: what she types is
 * the digit she can see and then the zeros she has to count, which is the
 * skill, rather than a multiplication she could do without looking.
 */

/** One round: a number, and which of its digits is lit. */
export interface PlaceRound {
  /** The number as it is written on the parchment. */
  readonly number: number;
  /**
   * Which digit is lit, counted from the left and starting at nought.
   *
   * From the left because that is how it is read and drawn. The *value* it
   * carries counts from the right — see `zeros` — and keeping the two
   * apart is what stops the drawing and the arithmetic disagreeing.
   */
  readonly at: number;
  /** The digit itself, nought to nine. */
  readonly digit: number;
  /** How many zeros follow it: nought for units, one for tens, and so on. */
  readonly zeros: number;
}

/** The digits of a number, left to right. */
export function digitsOfNumber(value: number): readonly number[] {
  return String(Math.abs(Math.trunc(value)))
    .split("")
    .map((one) => Number(one));
}

/** What the lit digit is worth. */
export function placeValue(round: PlaceRound): number {
  return round.digit * 10 ** round.zeros;
}

/**
 * Whether what she typed is right.
 *
 * **Read as a number, which is the whole of the nought rule.** A nought in
 * the hundreds is worth nothing, and a child who writes that as `0` and a
 * child who writes it as `000` have both said the same true thing — one
 * has answered the value and the other has written the digit out with its
 * zeros, which is exactly what she was asked to do. Comparing numbers
 * accepts both without either being a special case, and it goes on
 * accepting `70` and refusing `7` for the tens, which is the point.
 */
export function placeIsRight(round: PlaceRound, typed: string): boolean {
  if (typed.trim() === "") return false;
  const said = Number(typed);
  return Number.isFinite(said) && said === placeValue(round);
}

/**
 * The one-box cast this is answered through.
 *
 * The same degenerate line a bare sum runs on, and for the same reason —
 * see `bareLine`. Everything that types digits, submits them and counts
 * missteps works by comparing what was typed against a stop, so a one-jump
 * line whose only stop is the value gets all of it for nothing, and what
 * is new about this question stays in what gets *drawn*.
 */
export function placeLine(round: PlaceRound): NumberLine {
  return bareLine({
    start: 0,
    addend: placeValue(round),
    total: placeValue(round),
    unknown: "total",
  });
}

/**
 * How many digits a number needs before this is worth asking, and where on
 * the ladder that puts it.
 *
 * Rung seven and up, which is the lowest rung the second band cannot reach:
 * `BANDS` overlap by one, and the gentler band's top rung is six. So this
 * is the exact index that means "the two hardest difficulties and nobody
 * else" — stated as a number here rather than left as a comment on a table,
 * because it is a fact about the bands and it will move when they do.
 */
export const PLACE_FROM = 7;

/** Whether this rung asks it at all. */
export function asksPlace(rung: Rung, at: number): boolean {
  return at >= PLACE_FROM && rung.places >= 3;
}

/**
 * A round drawn at this rung.
 *
 * The number is as wide as the rung's sums are, so what she is asked to
 * read is the size of number she is already adding. Its first digit is
 * never nought — a number does not start with one — and every other digit
 * may be, because a nought in the middle is the case worth meeting.
 *
 * The lit digit is drawn uniformly over the whole number rather than
 * favouring the big end. The units are the easy one and the child should
 * still meet them: getting `the 2 in 472 is worth two` is how she finds out
 * that the question is about position at all.
 */
export function placeRound(rng: Rng, rung: Rung): PlaceRound {
  const width = Math.max(3, rung.places);
  const digits = Array.from({ length: width }, (_, at) => randInt(rng, at === 0 ? 1 : 0, 9));
  const at = randInt(rng, 0, width - 1);
  const digit = digits[at] ?? 0;
  return {
    number: Number(digits.join("")),
    at,
    digit,
    zeros: width - 1 - at,
  };
}
