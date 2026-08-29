// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { Canvas, VISIT, alongLane, canvasAt, shipsAt } from "./shipping";

const SEED = 12345;

/** One berth, so the timetable is the whole cycle and nothing else. */
function one(minutes: number) {
  return shipsAt(minutes, 1, 0)[0] ?? null;
}

describe("a visit, from empty water to empty water", () => {
  /**
   * The shape of it, walked minute by minute.
   *
   * Asserted as a *sequence* rather than at four chosen instants, because
   * what makes this a visit rather than four states is that they happen in
   * that order and once each.
   */
  test("away, in, tied up, out, away again", () => {
    const seen: string[] = [];
    for (let minute = 0; minute < VISIT; minute += 0.25) {
      const ship = one(minute);
      const now = !ship
        ? "away"
        : ship.along === 0
          ? "moored"
          : ship.leaving
            ? "leaving"
            : "arriving";
      if (seen.at(-1) !== now) seen.push(now);
    }
    expect(seen).toEqual(["away", "arriving", "moored", "leaving"]);
  });

  /**
   * Found by walking the cycle rather than named as three clock readings.
   *
   * The timings are tuning — they were retuned once already, when half a
   * minute turned out to be the difference between a ship sailing and a ship
   * that looked moored — and a test written as "at 5.1 minutes she is nearly
   * out" is a test that fails the next time somebody makes her a little
   * quicker. What is *not* tuning is that she comes in from the sea end and
   * leaves by it, so that is what this says.
   */
  test("she comes in from the sea end and goes back out to it", () => {
    let first: number | null = null;
    let last: number | null = null;
    let tiedUp = false;
    for (let minute = 0; minute < VISIT; minute += 0.05) {
      const ship = one(minute);
      if (!ship) continue;
      if (first === null && !ship.leaving) first = ship.along;
      if (ship.along === 0) tiedUp = true;
      if (ship.leaving) last = ship.along;
    }
    expect(first).toBeGreaterThan(0.8);
    expect(tiedUp).toBe(true);
    expect(last).toBeGreaterThan(0.8);
  });

  test("and she is never off her own lane", () => {
    for (let minute = 0; minute < VISIT * 3; minute += 0.1) {
      const ship = one(minute);
      if (!ship) continue;
      expect(ship.along).toBeGreaterThanOrEqual(0);
      expect(ship.along).toBeLessThanOrEqual(1);
    }
  });
});

describe("the timetable", () => {
  /**
   * The same harbour four cycles later, to within a rounding error.
   *
   * Not to the bit: `along` is arithmetic on a minute that has had forty
   * added to it, and the last place or two of a double does not survive
   * that. A test that demanded exactness here would be a test about IEEE
   *754 wearing a harbour's clothes.
   */
  test("it repeats, so a harbour is never done", () => {
    for (const minute of [0, 3.5, 8, 13.25]) {
      const now = shipsAt(minute, 3, SEED);
      const later = shipsAt(minute + VISIT * 4, 3, SEED);
      expect(later.map((ship) => ship.berth)).toEqual(now.map((ship) => ship.berth));
      expect(later.map((ship) => ship.leaving)).toEqual(now.map((ship) => ship.leaving));
      for (const [n, ship] of now.entries()) {
        expect(later[n]?.along).toBeCloseTo(ship.along, 6);
      }
    }
  });

  /**
   * A clock wound backwards is still a clock.
   *
   * Nothing in the game winds it back today — the hourglass only ever goes
   * forward — but a modulus that answered a negative minute with a negative
   * position would put a ship inland, which is a poor way to find out.
   */
  test("and a negative minute is a minute like any other", () => {
    for (const minute of [-1, -13, -400.5]) {
      for (const ship of shipsAt(minute, 3, SEED)) {
        expect(ship.along).toBeGreaterThanOrEqual(0);
        expect(ship.along).toBeLessThanOrEqual(1);
      }
    }
  });

  /**
   * Two ships arriving abreast read as a fleet, not as traffic.
   *
   * The berths are spread round the cycle for exactly this, and the check is
   * that over a whole visit the harbour is *sometimes* busy and *sometimes*
   * empty — a timetable that kept every berth full would be as still as one
   * that kept them all empty.
   */
  test("berths do not keep the same hours", () => {
    const counts = new Set<number>();
    for (let minute = 0; minute < VISIT; minute += 0.25) {
      counts.add(shipsAt(minute, 4, SEED).length);
    }
    expect(counts.size).toBeGreaterThan(1);
    // Never permanently full, which is the half that matters: a harbour with
    // a ship at every pier all day is as still as one with none.
    expect(Math.min(...counts)).toBeLessThan(4);
  });

  test("and a harbour with no berths has no ships", () => {
    expect(shipsAt(7, 0, SEED)).toEqual([]);
  });

  // Two worlds, two timetables. Not a nicety: the seed is what keeps every
  // harbour in every save from running the same clock.
  test("two worlds do not sail to the same clock", () => {
    const here = shipsAt(3, 4, 1);
    const there = shipsAt(3, 4, 999_983);
    expect(here).not.toEqual(there);
  });
});

describe("where along the lane that is", () => {
  const lane = [
    { col: 10, row: 20 },
    { col: 10, row: 21 },
    { col: 10, row: 22 },
    { col: 10, row: 23 },
  ];

  test("nought is the mooring and one is the open sea", () => {
    expect(alongLane(lane, 0)).toEqual({ col: 10, row: 20 });
    expect(alongLane(lane, 1)).toEqual({ col: 10, row: 23 });
  });

  test("and between them she is between them, to the fraction", () => {
    expect(alongLane(lane, 0.5)).toEqual({ col: 10, row: 21.5 });
  });

  test("an empty lane puts nobody anywhere rather than throwing", () => {
    expect(alongLane([], 0.5)).toEqual({ col: 0, row: 0 });
  });
});

describe("how much canvas a ship is showing", () => {
  test("furled alongside, set out in the bay", () => {
    expect(canvasAt(0)).toBe(Canvas.Furled);
    expect(canvasAt(1)).toBe(Canvas.Set);
  });

  /**
   * The same rule read twice, which is the point of taking it off `along`.
   *
   * A ship comes in with `along` falling from one to nought and goes out
   * with it rising the other way, so furling on the way in and setting on
   * the way out are one rule rather than two — and there is no way for the
   * two to disagree, which is what a `leaving` flag here would have invited.
   */
  test("every position is reached both coming in and going out", () => {
    // The function cannot see which way she is going, so "the same answer
    // both ways" is true by construction and worth nothing to assert. What
    // is worth asserting is that the *timetable* hands it the numbers for
    // all three, in both directions — a visit that only ever showed full
    // sail on the way out would satisfy a weaker test and look wrong.
    const bands = new Set<string>();
    for (let minute = 0; minute < VISIT; minute += VISIT / 400) {
      for (const ship of shipsAt(minute, 1, 0))
        bands.add(`${ship.leaving}:${canvasAt(ship.along)}`);
    }
    for (const leaving of [true, false]) {
      for (const canvas of Object.values(Canvas)) {
        expect({ leaving, canvas, seen: bands.has(`${leaving}:${canvas}`) }).toEqual({
          leaving,
          canvas,
          seen: true,
        });
      }
    }
  });

  /**
   * The middle one has to actually happen, and for long enough to see.
   *
   * It is the state that says the canvas is *moving*; a ship that passed
   * through it in a frame would appear to teleport between bare yards and
   * full sail. Counted over a whole visit at a fine step.
   */
  test("half-set canvas is on screen for a decent part of every arrival", () => {
    let half = 0;
    let sailing = 0;
    const step = VISIT / 2000;
    for (let minute = 0; minute < VISIT; minute += step) {
      for (const ship of shipsAt(minute, 1, 0)) {
        if (ship.along <= 0) continue;
        sailing++;
        if (canvasAt(ship.along) === Canvas.Half) half++;
      }
    }
    expect(sailing).toBeGreaterThan(0);
    expect(half / sailing).toBeGreaterThan(0.3);
  });

  test("nonsense is furled, which is what a ship sitting still shows", () => {
    for (const along of [Number.NaN, Number.POSITIVE_INFINITY * 0, -1]) {
      expect(canvasAt(along)).toBe(Canvas.Furled);
    }
  });
});
