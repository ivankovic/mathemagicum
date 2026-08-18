// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { type AdditionProblem, problemFor } from "./addition";

/**
 * What the teacher explains, and the example she explains it on.
 *
 * The spell is the only place in the game a child is asked to do something
 * they might not know how to do, and until now the only way to learn it was
 * to get it wrong twice and read the hints. So there is someone to ask.
 *
 * The lesson is four beats rather than a wall of text, because it is being
 * read off a screen by someone who wants to get back to the garden, and
 * because each beat has a picture to go with it: the spellbook and the rune,
 * the number pulled apart, the jumps along the line, the answer.
 *
 * Two things live here rather than in the panel that draws them. The example
 * is one, so that the numbers on the teacher's parchment and the numbers the
 * spell sets are made by the same function and cannot drift apart. The order
 * of the beats is the other: it *is* the method — ones, then tens, then
 * hundreds — and the spell enforces the same order box by box.
 */

/** The pair she works through. Small ones digit, so the first jump is easy. */
export const LESSON_START = 148;
export const LESSON_ADDEND = 114;

/**
 * Built by the same function the spell uses, deliberately.
 *
 * A worked example with its jumps written out by hand is an example that can
 * quietly stop matching the thing it is teaching.
 */
export const LESSON_EXAMPLE: AdditionProblem = problemFor(LESSON_START, LESSON_ADDEND);

export const LessonBeat = {
  /** What the spell is and where it lives: the spellbook and the + rune. */
  Rune: "rune",
  /** Pull the number apart: 114 is 100 and 10 and 4. */
  Split: "split",
  /** Jump them along the line, smallest first. */
  Jump: "jump",
  /** Where you land is the answer, and why the order is that way round. */
  Answer: "answer",
} as const;

export type LessonBeat = (typeof LessonBeat)[keyof typeof LessonBeat];

export const LESSON_BEATS: readonly LessonBeat[] = [
  LessonBeat.Rune,
  LessonBeat.Split,
  LessonBeat.Jump,
  LessonBeat.Answer,
];

/**
 * The parts of the addend, biggest first: how a person reads a number out.
 *
 * The *jumps* are the other way round, because that is the order they are
 * made in. Both orders are true and the lesson needs to show both — the
 * difference between them is precisely what beat three is about.
 */
export function partsOf(problem: AdditionProblem): readonly number[] {
  return [...problem.jumps].reverse();
}

/** Where the player is in the lesson, and which way they can go from there. */
export function nextBeat(beat: LessonBeat, step: number): LessonBeat {
  const index = LESSON_BEATS.indexOf(beat);
  const wanted = Math.max(0, Math.min(LESSON_BEATS.length - 1, index + step));
  return LESSON_BEATS[wanted] as LessonBeat;
}

export function isLastBeat(beat: LessonBeat): boolean {
  return beat === LESSON_BEATS[LESSON_BEATS.length - 1];
}
