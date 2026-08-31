// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// Pure function of a Date, not a read of Date.now() — same discipline as
// the seeded PRNG in rng.ts. Keeps this testable without flakiness and
// lets GameScene force a specific time of day for verification (a real
// screenshot of "night" needs a way to make it be night on demand).
// Local time deliberately, not UTC — see docs/GAME_DESIGN.md's
// "Day-night cycle": this reflects the player's own clock, not a
// simulated one, so there's no time zone conversion to get right or wrong.
export function timeOfDay(date: Date): number {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

const SUNRISE = 6;
const SUNSET = 20;
// How many hours either side of sunrise/sunset the tint fades over, rather
// than cutting instantly from day to night.
const TRANSITION_HOURS = 1.5;
// Was 0.55, which playtested as "I cannot see anything". Night should read
// as night — you want a lamp — but the garden you are standing in has to
// stay legible, and the lights the scene now carves out of this tint do the
// rest of the work of making the dark feel dark.
export const MAX_NIGHT_ALPHA = 0.42;
export const NIGHT_TINT_COLOR = 0x0a1a3a;

/**
 * When the village is open: doors unlocked, and people out in the street.
 *
 * **Six in the morning until nine at night**, which is a long day and meant
 * to be. It was eight until six, on the argument that those are the hours
 * people keep and the light is a different fact from what people do — and
 * both halves of that argument were sound and the numbers were still wrong.
 *
 * Two things were wrong with them. The village shut two hours before sunset,
 * so a door tried at seven said *they have gone to bed* under a bright sky,
 * with a moon drawn over her head to say so — reported from a playtest as a
 * picture that made no sense. And the hours a five-year-old actually plays
 * in are the ones on either side of the school day, most of which fell
 * outside them: the world was asleep whenever she was free.
 *
 * So the village now wakes with the sun and stays up an hour past it. It is
 * still not the same pair as `SUNRISE` and `SUNSET` and must not become it —
 * moving the light is how the world ends up dark at six in the evening in
 * high summer — but the two now agree about the thing a child reads off
 * them: a shut door is a dark street, and the moon on it is the truth.
 */
export const OPENS_AT = 6;
export const SHUTS_AT = 21;

/**
 * The hours a door keeps: open at `opensAt`, shut again at `shutsAt`.
 *
 * A pair rather than two loose numbers because there is more than one set of
 * them now — see `STARGAZING_HOURS` — and a function that took two numbers
 * would let a caller hand it one building's opening and another's closing.
 */
export interface OpeningHours {
  readonly opensAt: number;
  readonly shutsAt: number;
}

/** What the village keeps. Shops, school, post office, every front door. */
export const VILLAGE_HOURS: OpeningHours = { opensAt: OPENS_AT, shutsAt: SHUTS_AT };

/**
 * And what the observatory keeps, which is the other way round.
 *
 * An astronomer works when there is something to look at. A dome that was
 * open all afternoon and locked at dusk had the one building in the world
 * whose whole purpose is the night sky keeping a greengrocer's hours — and
 * it made a nonsense of what is inside it, which is somebody at a spyglass.
 *
 * **It opens at dusk and shuts after dawn**, an hour either side of the
 * light rather than on it, for the same reason the village opens after
 * sunrise: these are the hours a *person* keeps, and somebody who watches
 * the sky is at the eyepiece before the last of the light has gone and still
 * there when the first of it comes back.
 *
 * This is the pair that wraps midnight, and the reason `isOpenHours` is
 * written the way it is.
 */
export const STARGAZING_HOURS: OpeningHours = { opensAt: SUNSET - 1, shutsAt: SUNRISE + 1 };

/**
 * A door that is never shut.
 *
 * Opens at midnight and shuts at midnight, which by the rule below is open
 * for all twenty-four hours: `opensAt <= shutsAt`, so the window is between
 * the two, and between nought and twenty-four is the whole day.
 */
export const ALL_HOURS: OpeningHours = { opensAt: 0, shutsAt: 24 };

/**
 * Whether a door is open at this hour.
 *
 * Handles a window that wraps midnight, which the observatory's does and the
 * village's does not: when `shutsAt` is the smaller of the two, the open
 * hours are the ones *outside* the pair rather than between them.
 */
export function isOpenHours(hour: number, hours: OpeningHours = VILLAGE_HOURS): boolean {
  const { opensAt, shutsAt } = hours;
  if (opensAt <= shutsAt) return hour >= opensAt && hour < shutsAt;
  return hour >= opensAt || hour < shutsAt;
}

/**
 * How long until the doors open again, in hours.
 *
 * For a shut door to say *when*, rather than only *no*. A child who taps the
 * shop at seven in the evening and is told nothing has met a bug; one who is
 * told it opens in thirteen hours has met a village.
 */
export function opensIn(hour: number, hours: OpeningHours = VILLAGE_HOURS): number {
  if (isOpenHours(hour, hours)) return 0;
  const wait = hours.opensAt - hour;
  return wait >= 0 ? wait : wait + 24;
}

/**
 * Whether the sun is up.
 *
 * The one question the interface's clock exists to answer. Reported from a
 * playtest: *the UI is missing a clock and date. It's hard for the player to
 * know if it is day or night.* The tint says it, and the tint is a slow ramp
 * a child who has been indoors for ten minutes has no baseline for — so the
 * corner of the screen says it in a picture as well.
 *
 * The light rather than the village's hours, which are still a different
 * pair on purpose (see `OPENS_AT`). They agree more than they used to and
 * they do not agree exactly: the shops are open for the last hour of the
 * dusk, so at half past eight the sky says night and the door says come in.
 * A sun drawn over a dark street is the mistake this must not make.
 */
export function isDaylight(hour: number): boolean {
  return hour >= SUNRISE && hour < SUNSET;
}

/**
 * The hour as a clock face shows it: twelve hours, and the minutes past.
 *
 * Twelve rather than twenty-four, because twelve is the clock this game
 * teaches — the hourglass spell asks a child to read hands off a face, and a
 * corner of the screen saying `14:35` would be teaching them a second
 * notation for the same time before they have the first. Which half of the
 * day it is comes from the sun or moon beside it, which is a better answer
 * for a five-year-old than `pm` anyway.
 *
 * Truncated rather than rounded, like `readClock` and for its reason: a
 * clock that reads a minute ahead of itself is a clock that is wrong.
 */
export function clockFace(hour: number): string {
  const wrapped = ((hour % 24) + 24) % 24;
  const minutes = Math.floor(wrapped * 60);
  const face = Math.floor(minutes / 60) % 12;
  return `${face === 0 ? 12 : face}:${String(minutes % 60).padStart(2, "0")}`;
}

// 0 (no tint, full day) to MAX_NIGHT_ALPHA (full night), ramping linearly
// across TRANSITION_HOURS on each side of sunrise/sunset.
export function nightTintAlpha(hour: number): number {
  if (hour <= SUNRISE - TRANSITION_HOURS || hour >= SUNSET + TRANSITION_HOURS) {
    return MAX_NIGHT_ALPHA;
  }
  if (hour < SUNRISE) {
    const t = (hour - (SUNRISE - TRANSITION_HOURS)) / TRANSITION_HOURS;
    return MAX_NIGHT_ALPHA * (1 - t);
  }
  if (hour < SUNSET) return 0;
  const t = (hour - SUNSET) / TRANSITION_HOURS;
  return MAX_NIGHT_ALPHA * t;
}
