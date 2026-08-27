// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { pinchedZoom, settledZoom, spread, zoomSteps } from "./pinch";

describe("how far apart two fingers are", () => {
  test("along a line, and across a diagonal", () => {
    expect(spread({ x: 0, y: 0 }, { x: 30, y: 0 })).toBe(30);
    expect(spread({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    // Order cannot matter: there is no first finger.
    expect(spread({ x: 3, y: 4 }, { x: 0, y: 0 })).toBe(5);
  });

  test("and two fingers in one place are no distance apart", () => {
    expect(spread({ x: 7, y: 7 }, { x: 7, y: 7 })).toBe(0);
  });
});

describe("the steps it may rest on", () => {
  test("the world's zoom, and half of it", () => {
    expect(zoomSteps(2)).toEqual([1, 2]);
    expect(zoomSteps(4)).toEqual([2, 4]);
  });

  /**
   * A world already drawn at one has nowhere out to go.
   *
   * Half of one is a half, and a camera below one draws the art smaller than
   * it was made — which is not a view of the world, it is a worse copy of
   * it. One step means the pinch is arithmetic that always answers the same
   * number, which is the right way for a feature to be absent.
   */
  test("but never below the size the art was drawn at", () => {
    expect(zoomSteps(1)).toEqual([1]);
    // Three halves to two, rounded up rather than down, for the same reason.
    expect(zoomSteps(3)).toEqual([2, 3]);
  });
});

describe("following the fingers", () => {
  test("twice as far apart is twice as big", () => {
    expect(pinchedZoom(1, 100, 200, [1, 4])).toBe(2);
    expect(pinchedZoom(2, 100, 50, [1, 4])).toBe(1);
  });

  test("and fingers that have not moved leave it where it was", () => {
    expect(pinchedZoom(2, 120, 120, [1, 2])).toBe(2);
  });

  /**
   * The gesture stops where the steps stop.
   *
   * Rather than running on and springing back when the fingers lift: a pinch
   * that visibly refuses to go further has told the child where the end is,
   * and one that goes and returns has told them the game changed its mind.
   */
  test("it will not go past the ends", () => {
    expect(pinchedZoom(2, 100, 400, [1, 2])).toBe(2);
    expect(pinchedZoom(2, 100, 1, [1, 2])).toBe(1);
  });

  // Two fingers landing on the same pixel is a real event and a division by
  // nothing. The camera stays where it is rather than flying to an infinity.
  test("and fingers that landed on top of each other move nothing", () => {
    expect(pinchedZoom(2, 0, 90, [1, 2])).toBe(2);
    expect(pinchedZoom(9, 0, 90, [1, 2])).toBe(2);
  });
});

describe("where it comes to rest", () => {
  test("on whichever step is nearest", () => {
    expect(settledZoom(1.4, [1, 2])).toBe(1);
    expect(settledZoom(1.6, [1, 2])).toBe(2);
    expect(settledZoom(2, [1, 2])).toBe(2);
  });

  /**
   * Nearest, not "whichever way she was going".
   *
   * A child who pinches an inch and lets go has not asked for anything. A
   * camera that read the smallest movement as a decision would change the
   * view every time the screen was touched with two hands — which on a
   * tablet held in two hands is most of the time.
   */
  test("so a small movement is not a decision", () => {
    expect(settledZoom(1.95, [1, 2])).toBe(2);
    expect(settledZoom(1.05, [1, 2])).toBe(1);
  });

  test("and one step is where everything rests", () => {
    expect(settledZoom(1.4, [1])).toBe(1);
  });
});
