// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { type AdditionProblem, problemFor } from "./addition";
import { BareForm, type Rung } from "./difficulty";

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

/**
 * The pair she works through, at the widest the ladder ever asks for.
 *
 * Every narrower example is the last few digits of this one, so the sum a
 * child is shown is recognisably the same sum at every size. Chosen to keep
 * the properties the three-digit pair was chosen for, all the way up: a
 * small ones digit so the first jump is the easy one, no zero digit so no
 * jump lands where it started, and a total that still fits in its width.
 */
const WIDEST_START = 342148;
const WIDEST_ADDEND = 231114;
const WIDEST_PLACES = String(WIDEST_START).length;

/**
 * The pair she works through at the sums the game shipped with.
 *
 * The last three digits of the pair above, which is checked rather than
 * asserted by comment — see the test that cuts one to the other.
 */
export const LESSON_START = 148;
export const LESSON_ADDEND = 114;

/**
 * Built by the same function the spell uses, deliberately.
 *
 * A worked example with its jumps written out by hand is an example that can
 * quietly stop matching the thing it is teaching.
 */
export const LESSON_EXAMPLE: AdditionProblem = problemFor(LESSON_START, LESSON_ADDEND);

/**
 * The example for a child whose sums are a given size.
 *
 * She teaches on the numbers they are actually being asked, because a
 * teacher who works through `148 + 114` at a child who has only ever seen
 * `5 + 2` is demonstrating a method on a problem they cannot read — and the
 * method is the whole of what she has to give.
 *
 * The pair is cut down from the one above rather than rolled, so the shape
 * is the same at every size: a small ones digit, so the first jump is the
 * easy one, and no zero digits, so no jump lands where it started.
 */
export function lessonFor(rung: Rung): AdditionProblem {
  const size = Math.max(1, Math.min(WIDEST_PLACES, Math.trunc(rung.places)));
  const cut = (value: number) => {
    const digits = String(value).slice(-size);
    // A trailing digit could be a zero, which would make a jump a `+0`. The
    // ones digit of the addend is 4 and of the start 8, so this only bites
    // when a middle digit is taken — nudge it up rather than reroll, so the
    // example stays recognisably the same sum at every size.
    return Number(digits.replace(/0/g, "1"));
  };
  const addend = cut(WIDEST_ADDEND);
  let start = cut(WIDEST_START);
  if (!rung.crossing) {
    // A worked example that carries, shown to a child whose own sums never
    // do, demonstrates a step they have not been asked for and cannot check.
    // Bringing the offending digit down keeps the example the same shape —
    // 148 + 114 becomes 145 + 114 — rather than swapping it for a different
    // sum at one size only.
    for (let at = 0; at < size; at++) {
      const startDigit = Math.floor(start / 10 ** at) % 10;
      const addendDigit = Math.floor(addend / 10 ** at) % 10;
      const over = startDigit + addendDigit - 9;
      if (over > 0) start -= over * 10 ** at;
    }
  }
  return problemFor(start, addend, size);
}

export const LessonBeat = {
  /** What the spell is and where it lives: the spellbook and the + rune. */
  Rune: "rune",
  /** Pull the number apart: 114 is 100 and 10 and 4. */
  Split: "split",
  /** Jump them along the line, smallest first. */
  Jump: "jump",
  /** Where you land is the answer, and why the order is that way round. */
  Answer: "answer",
  /**
   * And the same line walked backwards, to find a number that is missing
   * from the *front* of a sum.
   *
   * Only ever shown at the rungs that ask `? + B = C`, because until then
   * there is nothing to undo. It is the same picture as the beat before it
   * and that is the argument rather than a saving: if you know where you
   * landed and how far you jumped, walking the jumps back is where you
   * started, and a child who sees that on the line they already know can do
   * every version of it.
   */
  Undo: "undo",
} as const;

export type LessonBeat = (typeof LessonBeat)[keyof typeof LessonBeat];

export const LESSON_BEATS: readonly LessonBeat[] = [
  LessonBeat.Rune,
  LessonBeat.Split,
  LessonBeat.Jump,
  LessonBeat.Answer,
];

/**
 * The beats this child gets, which is the four above and sometimes a fifth.
 *
 * The lesson has to teach what the spell actually asks. At the top of the
 * ladder the spell hides any one of the three terms, so two casts in three
 * want a number taken *off* a total — and a teacher who only ever
 * demonstrated adding would be demonstrating the wrong operation to the
 * child who most needs the right one.
 *
 * **Takes an optional rung, and that is load-bearing rather than
 * defensive.** `PagedPanel` asks its subclass for the deck from its own
 * constructor, which runs before the subclass's fields are initialised — so
 * the panel's `rung` really is `undefined` at that moment. A version of this
 * that read `rung.bare` crashed the whole game on boot once already, passed
 * every one of sixteen hundred unit tests while doing it, and was caught
 * only by a browser.
 */
export function lessonBeatsFor(rung: Rung | undefined): readonly LessonBeat[] {
  return rung?.bare === BareForm.Any ? [...LESSON_BEATS, LessonBeat.Undo] : LESSON_BEATS;
}

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
