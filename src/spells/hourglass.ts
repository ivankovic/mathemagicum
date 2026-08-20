// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * The hourglass spell: how long were you gone, and what grew while you were.
 *
 * The fifth spell and the first that is not about a number line, a rectangle
 * or a map. It is about **a clock**, which is arithmetic of a kind nothing
 * else here touches: twelve rather than ten, and a circle rather than a line,
 * so the answer to "four hours after ten" is two and every instinct a child
 * has built on the number line says twelve.
 *
 * **It is the one spell that pays for time actually passing.** Crops in this
 * game grow only by being cast on; nothing happens while nobody is playing,
 * which is a real absence in a game about a garden. The astronomer's gift is
 * that the world's clock starts counting for you — come back after five
 * hours and five things have moved on, once you can say that it was five.
 *
 * Which makes the question honest in a way a generated sum cannot be: the two
 * times on the parchment are when this child put the game down and when they
 * picked it up. Nobody chose them.
 *
 * **The glass reads the hour, not the minute.** Both faces are rounded to
 * whatever the child's rung can read — the hour at the bottom of the ladder,
 * the half and then the quarter further up — and the span is measured
 * between the rounded times. That is a small lie about the clock and the
 * right one: a clock face a five-year-old is reading *is* rounded to the
 * hour, and a question whose answer is "four hours and thirty-five minutes"
 * is not a question about telling the time.
 *
 * A twelve-hour face cannot tell twelve hours from none, and this does not
 * pretend otherwise: come back exactly half a day later and the glass has
 * nothing to give. Saying so is better than inventing a number the picture
 * does not support.
 */

/** How finely a rung's clock is read. */
export const Reading = {
  Hour: "hour",
  Half: "half",
  Quarter: "quarter",
} as const;

export type Reading = (typeof Reading)[keyof typeof Reading];

/** How many minutes each reading rounds to. */
const MINUTES: Record<Reading, number> = {
  [Reading.Hour]: 60,
  [Reading.Half]: 30,
  [Reading.Quarter]: 15,
};

export interface ClockRung {
  readonly reading: Reading;
  /** Whether the numerals are printed round the face. */
  readonly numerals: boolean;
  /** How many wrong answers before the parchment starts helping. */
  readonly hintAfter: number;
}

/**
 * Every setting, easiest first.
 *
 * The order is how a clock is actually learned: first with the numbers
 * written on it and the hands on the hour, then without the numbers, then
 * with the hands off the numbers altogether. What never changes is the
 * question — how long between these two — so a child climbing this ladder is
 * being asked the same thing about a harder picture, which is the shape
 * every other ladder here has.
 *
 * There is no rung for a bigger span, and deliberately: the span is however
 * long this child happened to be away, and the ladder has no business
 * reaching into that.
 */
export const CLOCK_RUNGS: readonly ClockRung[] = [
  { reading: Reading.Hour, numerals: true, hintAfter: 1 },
  { reading: Reading.Hour, numerals: false, hintAfter: 1 },
  { reading: Reading.Half, numerals: true, hintAfter: 1 },
  { reading: Reading.Half, numerals: false, hintAfter: 1 },
  { reading: Reading.Quarter, numerals: false, hintAfter: 1 },
  { reading: Reading.Quarter, numerals: false, hintAfter: 2 },
];

export const HARDEST_CLOCK_RUNG = CLOCK_RUNGS.length - 1;

export function clockRungAt(index: number): ClockRung {
  const at = Math.max(0, Math.min(HARDEST_CLOCK_RUNG, Math.trunc(index)));
  return CLOCK_RUNGS[at] as ClockRung;
}

/** A time as a clock shows it: hours 0-11 on the face, and minutes past. */
export interface ClockTime {
  readonly hour: number;
  readonly minute: number;
}

export interface HourglassProblem {
  /** When the game was put down, as the glass reads it. */
  readonly left: ClockTime;
  /** When it was picked up again. */
  readonly back: ClockTime;
  /** Whole hours between the two, which is also what the spell pays. */
  readonly hours: number;
  readonly numerals: boolean;
  readonly hintAfter: number;
}

/** A timestamp as a clock face shows it, rounded to what the rung can read. */
export function readClock(at: number, reading: Reading): ClockTime {
  const date = new Date(at);
  const step = MINUTES[reading];
  // Rounded *down*, not to the nearest. A clock that jumped forward past the
  // hour would show a time that has not happened yet, and a child checking it
  // against the one on the wall would find the game wrong.
  const minutes = Math.floor((date.getHours() * 60 + date.getMinutes()) / step) * step;
  return { hour: Math.floor(minutes / 60) % 12, minute: minutes % 60 };
}

/** Where the two hands point, in degrees clockwise from twelve. */
export function handAngles(at: ClockTime): { hour: number; minute: number } {
  return {
    hour: ((at.hour % 12) + at.minute / 60) * 30,
    minute: at.minute * 6,
  };
}

/**
 * The question, from two real timestamps.
 *
 * `hours` is the span *between the rounded faces*, so it is always exactly
 * what the picture shows — a child who counts round the dial and a child who
 * subtracts arrive at the same number, and both agree with what the spell
 * then pays out.
 */
export function hourglassFor(leftAt: number, backAt: number, rung: ClockRung): HourglassProblem {
  const left = readClock(leftAt, rung.reading);
  const back = readClock(backAt, rung.reading);
  const minutes = (back.hour * 60 + back.minute - (left.hour * 60 + left.minute) + 720) % 720;
  return {
    left,
    back,
    hours: Math.floor(minutes / 60),
    numerals: rung.numerals,
    hintAfter: Math.max(1, rung.hintAfter),
  };
}

/** Whether there is anything to claim at all. */
export function worthCasting(problem: HourglassProblem): boolean {
  return problem.hours > 0;
}

/**
 * How far the player has got.
 *
 * One box, like the array spell's and the portal spell's. This is the third
 * of that shape and the duplication is now worth naming: what all three want
 * is "a number to reach, digits typed toward it, and a count of wrong
 * answers", and only the *drawing* differs. Left as three because pulling it
 * apart means touching two spells that work, their panels and their tests
 * for no change a player could see — but it is the next tidy-up due here,
 * and the fourth copy should not be written.
 */
export interface HourglassCast {
  readonly problem: HourglassProblem;
  readonly entry: string;
  readonly done: boolean;
  readonly missteps: number;
  readonly wrong: boolean;
}

export function beginHourglassCast(problem: HourglassProblem): HourglassCast {
  return { problem, entry: "", done: false, missteps: 0, wrong: false };
}

export function typeHourDigit(cast: HourglassCast, digit: number): HourglassCast {
  if (cast.done) return cast;
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) return cast;
  // A leading zero is dropped: the glass never has nothing to give by the
  // time this parchment is open, so a zero here can only be a slip.
  if (cast.entry === "" && digit === 0) return cast;
  // Two digits, because eleven is as far as a twelve-hour face can count.
  if (cast.entry.length >= 2) return cast;
  return { ...cast, entry: cast.entry + String(digit), wrong: false };
}

export function backspaceHour(cast: HourglassCast): HourglassCast {
  if (cast.done || cast.entry === "") return cast;
  return { ...cast, entry: cast.entry.slice(0, -1), wrong: false };
}

export function submitHour(cast: HourglassCast): HourglassCast {
  if (cast.done || cast.entry === "") return cast;
  if (Number(cast.entry) !== cast.problem.hours) {
    return { ...cast, entry: "", missteps: cast.missteps + 1, wrong: true };
  }
  return { ...cast, done: true, wrong: false };
}

/**
 * How much of the way round the parchment counts out for a stuck child.
 *
 * Hours, not the answer: the first help draws one hour of the sweep from the
 * first hand toward the second, and every wrong answer after that draws
 * another — so the child watches the hand walk round, which is how counting
 * on a clock is taught. It stops one short, because the last step is the
 * answer.
 */
export function hourglassHint(cast: HourglassCast): number {
  const { hours, hintAfter } = cast.problem;
  if (cast.missteps < hintAfter) return 0;
  return Math.min(Math.max(0, hours - 1), cast.missteps - hintAfter + 1);
}
