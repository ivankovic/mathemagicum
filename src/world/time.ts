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
 * Its own pair of hours, deliberately not `SUNRISE` and `SUNSET`. Those two
 * are the *light*, and the light is a fact about the sky; this is a fact
 * about what people do, and the two disagree on purpose. Villagers start for
 * home at six with the sun still up, the way people do, and the shops are
 * shut a good while before it is dark.
 *
 * It used to be the same pair, on the argument that an NPC either is or is
 * not at home and there is no half-retreated. That argument was about the
 * *edges* of the tint's ramp and it still holds — what changed is which hour
 * they keep, not that they keep one.
 */
export const OPENS_AT = 8;
export const SHUTS_AT = 18;

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
