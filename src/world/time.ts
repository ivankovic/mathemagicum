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

export function isOpenHours(hour: number): boolean {
  return hour >= OPENS_AT && hour < SHUTS_AT;
}

/**
 * How long until the doors open again, in hours.
 *
 * For a shut door to say *when*, rather than only *no*. A child who taps the
 * shop at seven in the evening and is told nothing has met a bug; one who is
 * told it opens in thirteen hours has met a village.
 */
export function opensIn(hour: number): number {
  if (isOpenHours(hour)) return 0;
  return hour < OPENS_AT ? OPENS_AT - hour : 24 - hour + OPENS_AT;
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
