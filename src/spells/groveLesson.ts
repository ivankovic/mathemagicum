// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { type ArrayProblem, type ArrayRung, arrayProblemFor } from "./multiplication";

/**
 * What the great tree explains, and the patch it explains it on.
 *
 * The third lesson in the game, after the schoolteacher's number line and
 * the geometer's triangle, and built exactly as those two are: one idea per
 * page, a picture on every page, and the numbers taken from the spell's own
 * code so that what the tree teaches cannot drift from what the spell sets.
 *
 * Five beats, and the first of them is not a lesson at all:
 *
 * 0. **the task** — what the tree is asking for and how far along it is.
 *    This used to be written to the one-line message at the top of the
 *    screen, in the same breath as opening this panel over it — so the game
 *    stated its only quest once per visit, in the smallest type it has, at
 *    the moment the child's eyes were somewhere else. From the outside that
 *    is a tree that teaches rows and columns and asks for nothing. It is
 *    first because it is the answer to *why am I here*, and the lesson is
 *    the answer to *what am I working toward*;
 * 1. **the rune** — the spellbook and the six dots, as they appear in the
 *    corner of the screen, so the lesson names things the player can see;
 * 2. **the rows** — the patch is rows, and every row holds the same number;
 * 3. **the count** — so count along by rows, and the last count is the
 *    answer;
 * 4. **the turn** — the same patch on its side is the same number, which is
 *    why half the times table is the whole of it.
 *
 * That fourth beat is the one worth having a lesson for at all. A child can
 * arrive at `4 × 6` by counting; nothing in the spell itself ever tells them
 * that `6 × 4` is the same patch turned round, and it is the single fact
 * that halves how much of the table they have to hold.
 *
 * **Every beat is shown at every rung**, and the task page is shown whether
 * the task is done or not — finished, it says so. A deck that grew a page
 * would be a deck whose page dots moved under a child who had just learned
 * where "next" was.
 *
 * Only the numbers change with the child, which is the rule both other
 * lessons follow and the design's: a lesson is not a gate.
 */

export const GroveBeat = {
  /** What the tree wants, and how much of it is done. Not part of the lesson. */
  Task: "task",
  /** What the spell is and where it lives: the spellbook and the six dots. */
  Rune: "rune",
  /** The patch as rows, all of them the same. */
  Rows: "rows",
  /** Counting along by rows, and landing on the answer. */
  Count: "count",
  /** The same patch turned on its side, and why that halves the table. */
  Turn: "turn",
} as const;

export type GroveBeat = (typeof GroveBeat)[keyof typeof GroveBeat];

export const GROVE_BEATS: readonly GroveBeat[] = [
  GroveBeat.Task,
  GroveBeat.Rune,
  GroveBeat.Rows,
  GroveBeat.Count,
  GroveBeat.Turn,
];

/**
 * The patch the tree teaches on.
 *
 * Fixed, the way the geometer's two endpoints are, and for the same reason:
 * a worked example that changed every time it was opened is one a child
 * cannot go back and re-read. Six by seven because it is a rectangle rather
 * than a square — the last page turns the patch on its side, and a square
 * turned round is indistinguishable from a square — and because forty-two is
 * a number a child meets in the times tables rather than one they can count
 * on their fingers.
 *
 * The *rung* still comes in, because the tree shows the patch the way this
 * child's own parchment would show it: counted for them, or bare dots, or
 * nothing but the two numbers.
 */
export const GROVE_LESSON_ROWS = 6;
export const GROVE_LESSON_COLUMNS = 7;

export function groveLessonFor(rung: ArrayRung): ArrayProblem {
  return arrayProblemFor(GROVE_LESSON_ROWS, GROVE_LESSON_COLUMNS, rung);
}

/** Where the player is in the lesson, and which way they can go from there. */
export function nextGroveBeat(beat: GroveBeat, step: number): GroveBeat {
  const index = GROVE_BEATS.indexOf(beat);
  const wanted = Math.max(0, Math.min(GROVE_BEATS.length - 1, index + step));
  return GROVE_BEATS[wanted] as GroveBeat;
}

export function isLastGroveBeat(beat: GroveBeat): boolean {
  return beat === GROVE_BEATS[GROVE_BEATS.length - 1];
}
