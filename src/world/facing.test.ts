// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import {
  TURNS,
  TURNS_DRAWN,
  Turn,
  drawnFlip,
  drawnLook,
  nextTurn,
  turnFrom,
  waysRound,
} from "./facing";

describe("which way round a thing is", () => {
  test("a thing with one drawing cannot turn at all", () => {
    expect(waysRound(1)).toBe(1);
    for (const turn of TURNS) expect(nextTurn(turn, 1)).toBe(Turn.Toward);
  });

  test("and a thing with three drawings goes four ways", () => {
    expect(waysRound(TURNS_DRAWN)).toBe(4);
  });

  /**
   * Turning goes round rather than stopping.
   *
   * A control that stopped at the last way round would make going back mean
   * tapping something else, and there is nothing else to tap — the gesture
   * is a tap on the thing itself.
   */
  test("turning four times comes back to where it started", () => {
    let turn: number = Turn.Toward;
    const seen: number[] = [];
    for (let n = 0; n < TURNS.length; n++) {
      turn = nextTurn(turn, TURNS_DRAWN);
      seen.push(turn);
    }
    expect(seen.slice(0, -1).sort()).toEqual([Turn.Away, Turn.Side, Turn.SideOther]);
    expect(turn).toBe(Turn.Toward);
  });

  /**
   * Three drawings and four ways, which is the whole economy of this.
   *
   * The two side-on ways share a drawing and differ by a mirror. Asserted
   * because it is what saves eighteen drawings across the set, and because a
   * fourth drawing added later would silently make this false.
   */
  test("the two side-on ways are one drawing, mirrored", () => {
    expect(drawnLook(Turn.Side)).toBe(drawnLook(Turn.SideOther));
    expect(drawnFlip(Turn.Side)).toBe(false);
    expect(drawnFlip(Turn.SideOther)).toBe(true);
  });

  test("and the other two are their own drawings, unmirrored", () => {
    expect(drawnLook(Turn.Toward)).toBe(0);
    expect(drawnLook(Turn.Away)).toBe(1);
    for (const turn of [Turn.Toward, Turn.Away]) expect(drawnFlip(turn)).toBe(false);
  });

  test("every way round is drawn by one of the drawings there are", () => {
    for (const turn of TURNS) {
      expect(drawnLook(turn)).toBeLessThan(TURNS_DRAWN);
      expect(drawnLook(turn)).toBeGreaterThanOrEqual(0);
    }
  });

  /**
   * A save written before any of this existed has no turn on it at all, and
   * everything in it should come back facing the way it was drawn — which is
   * the way the single drawing faced.
   */
  test("anything that is not a way round reads as facing the camera", () => {
    for (const nonsense of [undefined, null, "2", 1.5, -1, 4, 99, Number.NaN]) {
      expect(turnFrom(nonsense)).toBe(Turn.Toward);
    }
    for (const turn of TURNS) expect(turnFrom(turn)).toBe(turn);
  });

  test("nonsense handed to nextTurn still comes back a real way round", () => {
    for (const nonsense of [-5, 9, 2.7]) {
      expect(TURNS).toContain(nextTurn(nonsense, TURNS_DRAWN));
    }
  });
});
