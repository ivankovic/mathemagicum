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
const MAX_NIGHT_ALPHA = 0.55;
export const NIGHT_TINT_COLOR = 0x0a1a3a;

// Whether NPCs should be out and about (see docs/WORLD_GENERATION.md's
// "Day-night cycle" — this gates NPC presence, nothing else). Matches the
// tint's fully-day plateau, not its transition edges: an NPC either is or
// isn't home, there's no "half retreated".
export function isDaytime(hour: number): boolean {
  return hour >= SUNRISE && hour < SUNSET;
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
