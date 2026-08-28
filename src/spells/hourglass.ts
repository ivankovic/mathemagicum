// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * The hourglass spell: move the world's clock, and say how far you moved it.
 *
 * The fifth spell and the first that is not about a number line, a rectangle
 * or a map. It is about **a clock**, which is arithmetic of a kind nothing
 * else here touches: twelve rather than ten, and a circle rather than a line,
 * so the answer to "four hours after ten" is two and every instinct a child
 * has built on the number line says twelve.
 *
 * **It used to be about being away.** The glass showed when the game was put
 * down and when it was picked up, asked how many hours that was, and paid a
 * crop an hour. That made the question honest — nobody chose those two times
 * — and made the spell almost uncastable: it wanted an absence long enough
 * to matter, something planted and still green, and a child who had just sat
 * down had none of it. A spell you cannot cast is a spell nobody learns.
 *
 * So it is the other way round now. Cast it whenever you like, take hold of
 * the hands, and put them where you want the world's clock to be — then say
 * how far you have just moved it. The question is the same question and the
 * arithmetic is harder rather than easier, because the child chooses the two
 * times and has to read both.
 *
 * **What it changes is the light, not the garden.** Winding the clock does
 * not ripen anything. It could: the old spell paid a crop an hour, and
 * keeping that would have meant a child could wind forward twelve hours over
 * and over until the whole garden was ripe, which makes the growth spell
 * optional. What the glass buys is power over the day — make it dusk, make
 * it noon — and that is worth having on its own.
 *
 * **The clock only ever goes forward.** A face has twelve hours on it and a
 * day has twenty-four, so hands pointing at six mean either dawn or dusk and
 * the picture cannot say which. Rather than put an am/pm switch on a clock a
 * five-year-old is learning to read, a dragged time means *the next time it
 * will be* — which is unambiguous, is what "how far did you move it" already
 * assumes, and keeps every answer inside the twelve hours the face can show.
 *
 * **The glass reads to the rung, not to the minute.** The hands snap to
 * whatever the child's rung can read — the hour at the bottom of the ladder,
 * the half and then the quarter further up — so the answer is always
 * something the picture actually shows. That is a small lie about a clock
 * and the right one: a clock face a five-year-old is reading *is* rounded to
 * the hour, and "four hours and thirty-five minutes" is not a question about
 * telling the time.
 */

/** How finely a rung's clock is read. */
export const Reading = {
  Hour: "hour",
  Half: "half",
  Quarter: "quarter",
} as const;

export type Reading = (typeof Reading)[keyof typeof Reading];

/**
 * How far apart the marks round the face are, in minutes.
 *
 * Twelve of them are drawn on every clock in this game, whatever the rung —
 * a face with no ticks is not a clock, it is a circle — so twelve is where
 * the minute hand can go. It used to be able to reach only as far as the
 * rung's own reading, which on the gentlest face meant it could not move at
 * all and on the hardest gave it four places out of twelve to stand. A hand
 * that will not go where the picture says it can is a hand that reads as
 * broken.
 *
 * The *hour* hand is unaffected: it points at an hour, and there are twelve
 * of those.
 */
export const TICK_MINUTES = 5;

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
 * The reading does one more job now that the hands are draggable: it is how
 * far they snap. At the bottom rung a child can only ever point at an hour,
 * so the answer has no minutes in it and the parchment does not ask for any.
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

/**
 * A timestamp as a clock face shows it, rounded to what the rung can read.
 *
 * Rounded *down*, not to the nearest. A clock that jumped forward past the
 * hour would show a time that has not happened yet, and a child checking it
 * against the one on the wall would find the game wrong.
 */
export function readClock(at: number, reading: Reading): ClockTime {
  const date = new Date(at);
  const step = MINUTES[reading];
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
 * Whether this move has any minutes in it to ask about.
 *
 * Asked of the *move* rather than of the rung, which is what it used to be.
 * The minute hand can reach any mark on the face now, so whether the answer
 * has a minutes half depends on where the child put it and not on how hard
 * their clock is — and a parchment that asked a five-year-old for the
 * minutes of a move they made in whole hours would be asking them to type
 * nought.
 */
export function asksMinutes(cast: HourglassCast): boolean {
  return windMinutes(cast) % 60 !== 0;
}

/**
 * A time snapped to what this rung's face can show.
 *
 * Both hands together rather than the minute alone: an hour hand halfway
 * between four and five is what half past four *looks like*, so snapping the
 * minutes without moving the hour would draw a clock that disagrees with
 * itself.
 */
export function snapTime(at: ClockTime, reading: Reading): ClockTime {
  const step = MINUTES[reading];
  const minutes = Math.round((at.hour * 60 + at.minute) / step) * step;
  const whole = ((minutes % 720) + 720) % 720;
  return { hour: Math.floor(whole / 60) % 12, minute: whole % 60 };
}

/**
 * How far a finger travels for one tick of the clock.
 *
 * A feel number, and the only one here. Ten pixels means a comfortable
 * two-inch sweep turns the clock about an hour and three quarters, and that
 * an unsteady finger resting on the glass does not walk it round on its own.
 */
export const SWIPE_PER_TICK = 10;

/**
 * How many ticks a swipe of this shape turns the clock.
 *
 * Clockwise is down and to the right; anticlockwise is up and to the left.
 * That is an approximation of going round a dial and it is the right one: a
 * true rotation has to be measured about the centre of the face, which means
 * knowing where the finger is rather than where it went, and means a swipe
 * across the middle of the clock turns it by nothing at all.
 *
 * Taking hold of a *hand* was tried first and is what this replaces. The
 * hands are two pixels wide, there are two of them, and which one a child
 * had caught depended on how far from the middle they had grabbed — three
 * ways to get it wrong before anything moves.
 *
 * The two directions are added and then flattened, so a diagonal counts once
 * rather than twice: a finger going down *and* right is going one way round,
 * not two. A swipe up and to the right is neither, and turns nothing, which
 * is honest — it is not a direction round a dial.
 */
export function swipeTicks(dx: number, dy: number): number {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return 0;
  const along = (dx + dy) / Math.SQRT2;
  return Math.trunc(along / SWIPE_PER_TICK);
}

/**
 * How far forward round the face from one time to another.
 *
 * Forward, always, and never more than the twelve hours a face can hold: the
 * clock does not go backwards, so quarter past midnight is half an hour
 * after quarter to — not eleven and a half hours before it.
 */
export function forwardMinutes(from: ClockTime, to: ClockTime): number {
  return (to.hour * 60 + to.minute - (from.hour * 60 + from.minute) + 720) % 720;
}

/** The same span, said the way the parchment asks for it. */
export function spanOf(from: ClockTime, to: ClockTime): { hours: number; minutes: number } {
  const minutes = forwardMinutes(from, to);
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}

/**
 * How far the player has got: where the hands are, and what they have said.
 *
 * Two boxes rather than one, because the answer has two parts — and only one
 * at the bottom of the ladder, where the face cannot show a time that is not
 * on the hour and asking for minutes would be asking for nought.
 */
export interface HourglassCast {
  /** What the world's clock said when the parchment opened. */
  readonly from: ClockTime;
  /** Where the hands have been put. Starts where they already were. */
  readonly to: ClockTime;
  readonly rung: ClockRung;
  readonly hours: string;
  readonly minutes: string;
  /**
   * How far the hands have been turned, in ticks, counting both ways.
   *
   * Carried because *where the hands are* cannot answer the question the
   * spell asks. A face holds twelve hours, so hands taken all the way round
   * land back where they started and read as a move of nothing — which is
   * also what untouched hands read as, and the two want opposite answers.
   * Reported from a playtest as *jumping for more than 12 hours does not
   * work*: it could not, because the clock had no way to say so.
   *
   * Net, so a child who winds forward and then winds back has not moved
   * them. See `windMinutes`.
   */
  readonly turned: number;
  /** Which box the digits are going into. */
  readonly box: "hours" | "minutes";
  readonly done: boolean;
  readonly missteps: number;
  readonly wrong: boolean;
}

export function beginHourglassCast(from: ClockTime, rung: ClockRung): HourglassCast {
  const start = snapTime(from, rung.reading);
  return {
    from: start,
    to: start,
    rung,
    hours: "",
    minutes: "",
    turned: 0,
    box: "hours",
    done: false,
    missteps: 0,
    wrong: false,
  };
}

/**
 * Turn the clock on by this many ticks, or back by them.
 *
 * Both hands together, because that is what turning a clock does — the
 * minute hand sweeps and the hour hand creeps after it. Backwards is allowed
 * and means what it says on the face: the hands go anticlockwise. What it
 * does *not* mean is that the world goes backwards. The clock only ever runs
 * forward, so hands wound back to an hour already gone are pointing at that
 * hour tomorrow — which is a long move rather than a negative one, and the
 * sand runs longest for it.
 */
export function turnBy(cast: HourglassCast, ticks: number): HourglassCast {
  if (cast.done || !Number.isFinite(ticks) || ticks === 0) return cast;
  const minutes = cast.to.hour * 60 + cast.to.minute + Math.trunc(ticks) * TICK_MINUTES;
  const whole = ((minutes % 720) + 720) % 720;
  const to = { hour: Math.floor(whole / 60) % 12, minute: whole % 60 };
  // Anything typed was about the old span, so it goes. A child who turns the
  // clock after answering has asked a different question.
  return {
    ...cast,
    to,
    turned: cast.turned + Math.trunc(ticks),
    hours: "",
    minutes: "",
    box: "hours",
    wrong: false,
  };
}

/** Twelve hours, which is as much as a face can say and the most it may ask. */
export const FULL_CIRCLE = 720;

/**
 * How far the world is to be wound, in minutes.
 *
 * The face's own arithmetic, except for the one thing a face cannot express:
 * hands taken all the way round read as nought, and they mean *twelve
 * hours*. Whether they were taken round or simply never touched is not a
 * question about where they are, so it is answered by `turned`.
 *
 * More than one circle still means twelve. The face holds twelve hours and
 * cannot show thirteen — a child who keeps dragging is asking for as far as
 * it goes, and as far as it goes is once round.
 */
export function windMinutes(cast: HourglassCast): number {
  const round = forwardMinutes(cast.from, cast.to);
  return round === 0 && cast.turned !== 0 ? FULL_CIRCLE : round;
}

/** The answer the hands are currently asking for. */
export function askedOf(cast: HourglassCast): { hours: number; minutes: number } {
  const minutes = windMinutes(cast);
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}

/** Whether the hands have been moved at all. */
export function moved(cast: HourglassCast): boolean {
  return windMinutes(cast) > 0;
}

export function typeClockDigit(cast: HourglassCast, digit: number): HourglassCast {
  if (cast.done) return cast;
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) return cast;
  const typed = cast.box === "hours" ? cast.hours : cast.minutes;
  // Nought is allowed in both boxes. It used to be refused in the hours on
  // the argument that the glass never had nothing to give — which stopped
  // being true when the minute hand could reach every mark on the face, and
  // "nought hours and twenty minutes" became an ordinary move to make.
  if (typed.length >= 2) return cast;
  const next = typed + String(digit);
  return cast.box === "hours"
    ? { ...cast, hours: next, wrong: false }
    : { ...cast, minutes: next, wrong: false };
}

export function backspaceClock(cast: HourglassCast): HourglassCast {
  if (cast.done) return cast;
  const typed = cast.box === "hours" ? cast.hours : cast.minutes;
  if (typed === "") {
    // Back off the end of the minutes and you are editing the hours again,
    // which is what a finger reaching for the wrong box means.
    return cast.box === "minutes" ? { ...cast, box: "hours", wrong: false } : cast;
  }
  const next = typed.slice(0, -1);
  return cast.box === "hours"
    ? { ...cast, hours: next, wrong: false }
    : { ...cast, minutes: next, wrong: false };
}

/** Move to the other box, where there is one. */
export function nextBox(cast: HourglassCast): HourglassCast {
  if (cast.done || !asksMinutes(cast)) return cast;
  return { ...cast, box: cast.box === "hours" ? "minutes" : "hours", wrong: false };
}

/**
 * Say that is the answer.
 *
 * On the hours box with minutes still to give, this moves along rather than
 * judging: a child pressing enter after the hours has finished a number, not
 * an answer.
 */
export function submitClock(cast: HourglassCast): HourglassCast {
  if (cast.done || !moved(cast)) return cast;
  if (cast.box === "hours" && asksMinutes(cast)) {
    return cast.hours === "" ? cast : { ...cast, box: "minutes", wrong: false };
  }
  const asked = askedOf(cast);
  const wantsMinutes = asksMinutes(cast);
  if (cast.hours === "" || (wantsMinutes && cast.minutes === "")) return cast;
  const saidHours = Number(cast.hours);
  const saidMinutes = wantsMinutes ? Number(cast.minutes) : 0;
  if (saidHours !== asked.hours || saidMinutes !== asked.minutes) {
    return {
      ...cast,
      hours: "",
      minutes: "",
      box: "hours",
      missteps: cast.missteps + 1,
      wrong: true,
    };
  }
  return { ...cast, done: true, wrong: false };
}

/** The shortest and longest the sand runs for, in milliseconds. */
export const SAND_LEAST_MS = 700;
export const SAND_MOST_MS = 3000;

/**
 * How long the sand should run for a move of this many minutes.
 *
 * The glass turning is the only thing in the game that says how *big* a
 * spell was. Every other cast lands in the same instant whatever the answer,
 * which is right for them — a sum is a sum — but this one moves the world by
 * an amount the child chose, and a five-minute nudge and a nearly-a-whole-day
 * heave should not look the same.
 *
 * Straight between the two ends rather than curved: the child picked the
 * number, so the time it takes should be readable back off it. Five minutes
 * is a flick of sand; the longest move a twelve-hour face can ask for is
 * three seconds, which is about as long as anybody will watch an animation
 * before it stops being a reward and starts being a wait.
 */
export function sandFor(minutes: number): number {
  const shortest = TICK_MINUTES;
  const longest = 720 - TICK_MINUTES;
  // Only nonsense gets the short answer. An enormous number is not nonsense
  // — it is a move bigger than a face can hold, and clamping says so.
  if (Number.isNaN(minutes)) return SAND_LEAST_MS;
  const held = Math.max(shortest, Math.min(longest, minutes));
  const along = (held - shortest) / (longest - shortest);
  return Math.round(SAND_LEAST_MS + along * (SAND_MOST_MS - SAND_LEAST_MS));
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
  const { hours } = askedOf(cast);
  const hintAfter = Math.max(1, cast.rung.hintAfter);
  if (cast.missteps < hintAfter) return 0;
  return Math.min(Math.max(0, hours - 1), cast.missteps - hintAfter + 1);
}
