// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { type Rng, randInt } from "../world/rng";

/**
 * The addition spell: column addition, worked on a number line.
 *
 * The spell adds, and what it adds to is a plant — one cast moves a crop one
 * stage further along. That mapping is the point rather than a skin: the
 * design doc's rule is that a spell's effect mirrors its mathematics, so the
 * spell that adds is the one that makes things grow.
 *
 * The method being taught is *partial sums, smallest place first*: to work
 * out 347 + 265, jump along the line by the ones (+5), then the tens (+60),
 * then the hundreds (+200), and read off where you land. Three jumps, three
 * landings, and each landing is a number the player has to state. That is
 * what the three arrows on the parchment are.
 *
 * Deliberately no carrying step and no vertical layout. A number line makes
 * a carry visible as "the jump crossed a hundred" rather than as a small
 * digit written above a column, which is the whole reason to teach it this
 * way round first.
 */

/** How many jumps a problem is broken into: ones, tens, hundreds. */
export const PLACES = 3;

export const PLACE_NAMES: readonly string[] = ["ones", "tens", "hundreds"];

export interface AdditionProblem {
  /** The number the line starts at, and the number jumped along it. */
  readonly start: number;
  readonly addend: number;
  /** What each jump adds: the addend's ones, tens and hundreds, in order. */
  readonly jumps: readonly number[];
  /** Where each jump lands. The last is the answer. */
  readonly stops: readonly number[];
}

const MIN_THREE_DIGIT = 100;
const MAX_THREE_DIGIT = 999;

/**
 * Every addend the spell will ever use: three digits, none of them zero.
 *
 * The zero is what this list exists to exclude. A zero digit makes one of
 * the three jumps a `+0` that lands where it started, and an arrow pointing
 * back at the number it came from reads as a piece missing from the puzzle
 * rather than as an easy one. Nine hundred-somethings drop out on their own,
 * since nothing three-digit can be added to them.
 */
const ADDENDS: readonly number[] = (() => {
  const out: number[] = [];
  for (let hundreds = 1; hundreds <= 9; hundreds++) {
    for (let tens = 1; tens <= 9; tens++) {
      for (let ones = 1; ones <= 9; ones++) {
        const addend = hundreds * 100 + tens * 10 + ones;
        if (addend <= MAX_THREE_DIGIT - MIN_THREE_DIGIT) out.push(addend);
      }
    }
  }
  return out;
})();

/**
 * How many valid starts each addend leaves room for — and therefore how
 * often it should be drawn.
 *
 * Weighting by this is what makes the pair uniform over the problems that
 * actually exist. Drawing the addend evenly instead skews the *start*: an
 * addend near 900 leaves a start no bigger than 99 places wide, so an evenly
 * drawn addend averages about 500 and squeezes every start into the low
 * hundreds. That passed every correctness check and still meant the player
 * never saw a large first number.
 */
const ADDEND_WEIGHTS: readonly number[] = ADDENDS.map(
  (addend) => MAX_THREE_DIGIT - addend - MIN_THREE_DIGIT + 1,
);
const TOTAL_WEIGHT = ADDEND_WEIGHTS.reduce((sum, weight) => sum + weight, 0);

/** A problem: two three-digit numbers whose sum is still three digits. */
export function makeAdditionProblem(rng: Rng): AdditionProblem {
  let ticket = randInt(rng, 1, TOTAL_WEIGHT);
  let addend = ADDENDS[ADDENDS.length - 1] as number;
  for (const [index, weight] of ADDEND_WEIGHTS.entries()) {
    ticket -= weight;
    if (ticket <= 0) {
      addend = ADDENDS[index] as number;
      break;
    }
  }
  const start = randInt(rng, MIN_THREE_DIGIT, MAX_THREE_DIGIT - addend);
  return problemFor(start, addend);
}

/** The same problem from a chosen pair — used by tests and worked examples. */
export function problemFor(start: number, addend: number): AdditionProblem {
  const jumps = [addend % 10, (Math.floor(addend / 10) % 10) * 10, Math.floor(addend / 100) * 100];
  const stops: number[] = [];
  let at = start;
  for (const jump of jumps) {
    at += jump;
    stops.push(at);
  }
  return { start, addend, jumps, stops };
}

/**
 * How far the player has got, and what they have typed into the box they are
 * on.
 *
 * One box is live at a time and the entry only advances on a correct answer,
 * which is what enforces "ones first, then tens, then hundreds" — the order
 * is the lesson, so being able to fill in the hundreds box first would skip
 * it. `attempts` is counted per box and never used to punish: it exists so
 * the parchment can offer the next hint, in the spirit of the design doc's
 * "learning over gating".
 */
export interface CastState {
  readonly problem: AdditionProblem;
  /** Which jump is being answered, 0..PLACES. Equal to PLACES when solved. */
  readonly index: number;
  /** The digits typed into the live box, as typed. */
  readonly entry: string;
  /** Answers already accepted, one per solved jump. */
  readonly solved: readonly number[];
  /** Wrong answers submitted for the live box. Reset when it is solved. */
  readonly attempts: number;
  /** Set when the last submission was wrong, so the box can be marked. */
  readonly wrong: boolean;
}

export function beginCast(problem: AdditionProblem): CastState {
  return { problem, index: 0, entry: "", solved: [], attempts: 0, wrong: false };
}

export function isSolved(state: CastState): boolean {
  return state.index >= PLACES;
}

// A stop is at most three digits, so a fourth keystroke can only be a typo.
// Capping is friendlier than accepting it and failing: the player sees the
// box stop taking digits while the number they meant is still readable.
const MAX_DIGITS = 3;

export function typeDigit(state: CastState, digit: number): CastState {
  if (isSolved(state)) return state;
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) return state;
  // A leading zero is dropped rather than rejected: no stop on this line
  // starts with one, and silently swallowing the keystroke reads as a broken
  // button.
  if (state.entry === "" && digit === 0) return state;
  if (state.entry.length >= MAX_DIGITS) return state;
  // Clearing `wrong` on the next keystroke is what makes the mark on the box
  // read as "that answer was wrong" rather than as a permanent state.
  return { ...state, entry: state.entry + String(digit), wrong: false };
}

export function backspace(state: CastState): CastState {
  if (isSolved(state) || state.entry === "") return state;
  return { ...state, entry: state.entry.slice(0, -1), wrong: false };
}

/**
 * Check the live box.
 *
 * A wrong answer clears the box and counts an attempt; it never ends the
 * cast. There is no fail state here on purpose — the spell is how the player
 * gardens, and a garden that locks you out for arithmetic would make the
 * math a gate, which is the one thing the design pillars rule out.
 */
export function submit(state: CastState): CastState {
  if (isSolved(state) || state.entry === "") return state;
  const expected = state.problem.stops[state.index];
  if (expected === undefined) return state;
  if (Number(state.entry) !== expected) {
    return { ...state, entry: "", attempts: state.attempts + 1, wrong: true };
  }
  return {
    ...state,
    index: state.index + 1,
    entry: "",
    solved: [...state.solved, expected],
    attempts: 0,
    wrong: false,
  };
}

/**
 * A nudge for the box the player is stuck on, or null while they are doing
 * fine.
 *
 * Escalates with attempts and stops short of the answer: the second hint
 * names the two numbers being added, which is the whole of the method, and
 * saying the result outright would turn the spell into a button.
 */
export function hintFor(state: CastState): string | null {
  if (isSolved(state) || state.attempts === 0) return null;
  const from = state.index === 0 ? state.problem.start : state.problem.stops[state.index - 1];
  const jump = state.problem.jumps[state.index];
  if (from === undefined || jump === undefined) return null;
  const place = PLACE_NAMES[state.index] ?? "";
  if (state.attempts === 1) return `Add the ${place} to ${from}.`;
  return `${from} + ${jump} = ?`;
}
