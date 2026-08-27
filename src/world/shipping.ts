// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * The harbour's traffic: which berths have a ship in, and where she is.
 *
 * The arithmetic only. Where a ship *can* go is the harbour layout's — see
 * `Berth`, whose lanes are walked over the grid once, when the world is
 * made, so that nothing here has to know what water is. This turns a clock
 * into a position along one of those lanes, and that is all it does.
 *
 * **They are weather, not furniture.** A visiting ship blocks nothing, is
 * not written into any save, and cannot be boarded. That is a deliberate
 * line and it is worth knowing why it is drawn there. A ship that blocked
 * would have to rewrite the grid while a child was standing on it; a ship
 * that could be boarded would one day sail away with somebody aboard, and
 * there is no good answer to that question. The great ship stays where she
 * is, moored and enterable, and everything that moves is scenery.
 *
 * The one thing they are *for* is that the sea stops being a flat blue
 * field. A harbour with four piers and nothing ever at them is four
 * walkways to nowhere.
 */

import type { GridPoint } from "./topdown";

/**
 * How long a visit takes, in minutes of world time.
 *
 * Chosen against a child standing on the quay rather than against a shipping
 * timetable. Half a minute to come in means a ship crosses the whole bay
 * while somebody watches — at a real sailing speed she would move a few
 * pixels a minute, which is indistinguishable from a ship that is moored.
 *
 * And she is away for longer than she is here, on purpose. Four berths that
 * were occupied most of the time would be a car park: what makes a harbour
 * look like it is working is water that is sometimes empty and a hull that
 * is sometimes crossing it.
 *
 * Four minutes end to end is not how long a ship takes to turn round, and
 * that is deliberate too. A child walks down to the quay, stands there for a
 * minute and walks off again; on a real timetable they would see one hull,
 * motionless, and conclude the harbour is a picture. At four minutes across
 * four berths something is arriving or leaving about every half minute,
 * which is what the place looks like from the outside. A day here takes
 * twenty minutes and a carrot ripens when it is cast on; the harbour keeps
 * the same kind of time as everything else.
 */
const AWAY = 2;
const SAILING_IN = 0.4;
const MOORED = 1.2;
const SAILING_OUT = 0.4;
export const VISIT = AWAY + SAILING_IN + MOORED + SAILING_OUT;

export interface Sailing {
  /** Which berth, by index into the harbour's own list. */
  readonly berth: number;
  /**
   * How far along the lane she is: 0 tied up, 1 out where the lane ends.
   *
   * A fraction rather than a cell, because a ship that moved a whole cell at
   * a time would not be sailing, she would be being dealt out like a card.
   */
  readonly along: number;
  /** Whether she is on her way out, so she can be drawn facing her travel. */
  readonly leaving: boolean;
}

/**
 * When each berth's ship is due, so four harbours do not keep one timetable.
 *
 * Spread evenly round the cycle first — that is what keeps two ships from
 * arriving abreast, which reads as a fleet manoeuvre rather than as traffic
 * — and then nudged by a few minutes drawn from the world's own seed, so
 * that two children comparing harbours are not looking at the same clock.
 */
function dueAt(berth: number, berths: number, seed: number): number {
  const spread = (VISIT * berth) / Math.max(1, berths);
  const jitter = ((seed >>> (berth * 3)) & 7) * (VISIT / 32);
  return spread + jitter;
}

/** Positive remainder, because a wound-back clock is still a clock. */
function wrap(value: number, by: number): number {
  return ((value % by) + by) % by;
}

/**
 * Every ship in the harbour at this minute.
 *
 * Berths with nobody in are simply absent from the list rather than present
 * and hidden: "which ships are there" is the question, and a caller that had
 * to filter would be a caller that could forget to.
 */
export function shipsAt(minutes: number, berths: number, seed: number): Sailing[] {
  const sailing: Sailing[] = [];
  for (let berth = 0; berth < berths; berth++) {
    const since = wrap(minutes + dueAt(berth, berths, seed), VISIT) - AWAY;
    if (since < 0) continue;
    if (since < SAILING_IN) {
      sailing.push({ berth, along: 1 - since / SAILING_IN, leaving: false });
    } else if (since < SAILING_IN + MOORED) {
      sailing.push({ berth, along: 0, leaving: false });
    } else {
      sailing.push({ berth, along: (since - SAILING_IN - MOORED) / SAILING_OUT, leaving: true });
    }
  }
  return sailing;
}

/**
 * Where along a lane that puts her, in cells.
 *
 * Between the two ends rather than between neighbouring cells: a lane is
 * straight by construction — `berthAt` walks one axis — so the two are the
 * same line, and the ends are the only two points worth reading.
 */
export function alongLane(lane: readonly GridPoint[], along: number): GridPoint {
  const moored = lane[0];
  const sea = lane.at(-1);
  if (!moored || !sea) return { col: 0, row: 0 };
  return {
    col: moored.col + (sea.col - moored.col) * along,
    row: moored.row + (sea.row - moored.row) * along,
  };
}
