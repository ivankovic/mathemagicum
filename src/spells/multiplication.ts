// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * The multiplication spell: an array, and how many things are in it.
 *
 * The third of the arithmetic spells and the first that is not a number
 * line. Addition walks the line up, subtraction walks it down, and both are
 * about *a journey*. Multiplication is not a journey — it is a shape. Rows
 * and columns, counted once rather than travelled along, which is the thing
 * a child has to see before `6 x 4` means anything at all.
 *
 * So the parchment is a rectangle of dots and there is one box to fill in.
 * Not nine boxes of skip counting: a child who can only get there by
 * counting 6, 12, 18, 24 is welcome to, and the hints below say so in those
 * words — but the *question* is how many are in the picture, because that is
 * the question the picture asks.
 *
 * **The child draws the rectangle.** They mark out a patch of ground, choose
 * what to do to it — plant it, grow it, clear it — and the spell asks how
 * many squares they have marked. One multiplication buys that many of
 * whatever the action was, which is what multiplication is *for*: doing the
 * same thing many times without doing it many times.
 *
 * The numbers in the question are therefore the numbers they made with their
 * own hands, which is a better teacher than any number a generator could
 * have picked for them.
 *
 * **What it does is what it is.** The design rule for every spell here is
 * that its effect mirrors its mathematics: the spell that adds makes things
 * grow, the spell that takes away removes what is in the way, and the spell
 * that arranges things in rows and columns plants a garden in rows and
 * columns. One cast, `rows x columns` seedlings, laid out exactly as the
 * parchment drew them.
 *
 * That is labour saved and nothing else. Seeds cost nothing in this game and
 * every one of those seedlings still needs its two growth casts before it
 * can be picked, so an array of twenty-four is twenty-four crops' worth of
 * addition either way. The spell is a child noticing that planting a patch
 * one tile at a time is the slow way round — which is what multiplication is
 * *for*.
 */

export const ArrayTier = {
  /** The dots are drawn and the first rows arrive counted for you. */
  Count: "count",
  /** The dots are drawn and nothing is counted. */
  Array: "array",
  /** No dots. The patch is an outline with `6 x 7` written over it. */
  Times: "times",
} as const;

export type ArrayTier = (typeof ArrayTier)[keyof typeof ArrayTier];

export interface ArrayRung {
  readonly tier: ArrayTier;
  /**
   * How many rows arrive with their running total already written beside
   * them, at the tiers that draw rows at all.
   *
   * The array's own scaffolding, and the same idea as the number line's
   * pre-solved jumps: a child shown `6` beside the first row and `12` beside
   * the second has been handed the method rather than the answer.
   */
  readonly given: number;
  /** How many wrong answers before the parchment starts counting for them. */
  readonly hintAfter: number;
}

/**
 * Every setting, easiest first.
 *
 * **The ladder no longer decides how big the patch is — the child does.**
 * They draw the rectangle, so the numbers in the question are the numbers
 * they just made with their hands, and what a rung changes is how much of
 * the answer is already on the parchment. A reach that grew with the rung
 * would lock a *tool* behind arithmetic, which is the one thing
 * `difficulty.ts` rules out.
 *
 * So the progression is help being taken away: rows counted for you, then
 * dots to count yourself, then nothing but the two numbers. A child who
 * draws two-by-two forever still climbs — they end up doing `2 x 2` from
 * memory instead of by counting four dots, which is exactly the thing the
 * times tables are.
 */
export const ARRAY_RUNGS: readonly ArrayRung[] = [
  { tier: ArrayTier.Count, given: 3, hintAfter: 1 }, // three rows counted
  { tier: ArrayTier.Count, given: 2, hintAfter: 1 },
  { tier: ArrayTier.Count, given: 1, hintAfter: 1 }, // one row counted
  { tier: ArrayTier.Array, given: 0, hintAfter: 1 }, // dots, nothing counted
  { tier: ArrayTier.Array, given: 0, hintAfter: 2 }, // and help comes later
  { tier: ArrayTier.Times, given: 0, hintAfter: 2 }, // the bare times table
];

export const HARDEST_ARRAY_RUNG = ARRAY_RUNGS.length - 1;

export function arrayRungAt(index: number): ArrayRung {
  const at = Math.max(0, Math.min(HARDEST_ARRAY_RUNG, Math.trunc(index)));
  return ARRAY_RUNGS[at] as ArrayRung;
}

export interface ArrayProblem {
  readonly rows: number;
  readonly columns: number;
  /** How many rows arrive already counted. Never all of them. */
  readonly given: number;
  readonly tier: ArrayTier;
  readonly hintAfter: number;
}

/**
 * The question a patch asks at this rung.
 *
 * The shape comes from the player and the help comes from the ladder, which
 * is the whole of the design. `given` is clamped against the rows there
 * actually are: the last running total *is* the answer, so a rung that
 * scaffolds three rows must hand back nothing at all on a patch two deep.
 */
export function arrayProblemFor(rows: number, columns: number, rung: ArrayRung): ArrayProblem {
  return {
    rows,
    columns,
    given: Math.max(0, Math.min(rung.given, rows - 1)),
    tier: rung.tier,
    hintAfter: Math.max(1, rung.hintAfter),
  };
}

export function totalOf(problem: ArrayProblem): number {
  return problem.rows * problem.columns;
}

/** The running total beside each row, top to bottom. The last is the answer. */
export function rowTotals(problem: ArrayProblem): number[] {
  return Array.from({ length: problem.rows }, (_, at) => (at + 1) * problem.columns);
}

/** Whether this rung draws the patch as dots at all. */
export function showsDots(problem: ArrayProblem): boolean {
  return problem.tier !== ArrayTier.Times;
}

/**
 * How far the player has got.
 *
 * One box, unlike the number line's three: the array is a single question
 * and breaking it into a box per row would turn it back into the addition
 * spell with a picture over it. `missteps` is what the difficulty reads and,
 * as everywhere else here, is never used to punish — a wrong answer clears
 * the box and offers more help, and nothing about a cast fails.
 */
export interface ArrayCast {
  readonly problem: ArrayProblem;
  readonly entry: string;
  readonly done: boolean;
  readonly missteps: number;
  /** Set when the last submission was wrong, so the box can be marked. */
  readonly wrong: boolean;
}

export function beginArrayCast(problem: ArrayProblem): ArrayCast {
  return { problem, entry: "", done: false, missteps: 0, wrong: false };
}

function maxDigits(cast: ArrayCast): number {
  return String(totalOf(cast.problem)).length;
}

export function typeArrayDigit(cast: ArrayCast, digit: number): ArrayCast {
  if (cast.done) return cast;
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) return cast;
  // A leading zero is dropped rather than rejected: no array holds nothing,
  // so a zero here can only be a slip, and swallowing the keystroke silently
  // reads as a broken button.
  if (cast.entry === "" && digit === 0) return cast;
  if (cast.entry.length >= maxDigits(cast)) return cast;
  return { ...cast, entry: cast.entry + String(digit), wrong: false };
}

export function backspaceArray(cast: ArrayCast): ArrayCast {
  if (cast.done || cast.entry === "") return cast;
  return { ...cast, entry: cast.entry.slice(0, -1), wrong: false };
}

export function submitArray(cast: ArrayCast): ArrayCast {
  if (cast.done || cast.entry === "") return cast;
  if (Number(cast.entry) !== totalOf(cast.problem)) {
    return { ...cast, entry: "", missteps: cast.missteps + 1, wrong: true };
  }
  return { ...cast, done: true, wrong: false };
}

/**
 * How much of the array is counted out for a stuck child.
 *
 * Rows, not the answer. The first wrong answer lights the rows the rung
 * already gave plus one more; every wrong answer after that lights another,
 * and the last row is never lit — that one is the answer, and a hint that
 * says it outright turns the spell into a button.
 *
 * Counted from `given` rather than from zero, so a rung that already
 * scaffolds two rows does not spend its first hint re-showing them — and it
 * waits `hintAfter` wrong answers before starting, which is the last thing
 * the ladder takes away.
 *
 * **On the smallest arrays there is nothing left to escalate to**, and that
 * is correct rather than a gap: a two-row patch with its first row already
 * given has one row left and that row is the answer. What the child gets is
 * the row they were given, restated as a count — which, in front of four
 * dots they can see all of, is the whole of the help that exists.
 */
export function arrayHint(cast: ArrayCast): number {
  const { rows, given, hintAfter } = cast.problem;
  if (cast.missteps < hintAfter) return given;
  return Math.min(rows - 1, given + (cast.missteps - hintAfter) + 1);
}
