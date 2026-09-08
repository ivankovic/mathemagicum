// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * The pinch state machine, without a browser.
 *
 * `src/input/pinch.ts` is the arithmetic and has its own tests. This is the
 * other half — which fingers are being watched, when a gesture starts, and
 * what is left behind when it ends — which is the half the class was split
 * out of `GameScene` to hold, and which had no test at all because the file
 * was never loaded by one.
 *
 * No Phaser here and none needed: `Pinch` asks for a `PinchHost` and nothing
 * else, so the host is a plain object that counts the calls. Fingers are ids
 * and coordinates, the same as the scene hands it.
 */

import { describe, expect, test } from "bun:test";
import { Pinch } from "./pinch";

/** A world drawn at two, so the steps are a half and whole: `[1, 2]`. */
const WORLD_ZOOM = 2;

function harness(worldZoom = WORLD_ZOOM) {
  const calls = { release: 0, applyZoom: 0 };
  const pinch = new Pinch(worldZoom, {
    release: () => {
      calls.release++;
    },
    applyZoom: () => {
      calls.applyZoom++;
    },
  });
  return { pinch, calls };
}

/** Two fingers on a horizontal line, `apart` pixels between them. */
function spreadTo(pinch: Pinch, apart: number): void {
  pinch.moved(1, 0, 0);
  pinch.moved(2, apart, 0);
  pinch.drag();
}

describe("Pinch", () => {
  test("rests at the world's zoom until fingers say otherwise", () => {
    const { pinch, calls } = harness();
    expect(pinch.zoom).toBe(WORLD_ZOOM);
    expect(pinch.leftOver).toBe(false);
    expect(calls.applyZoom).toBe(0);
  });

  test("will not begin on one finger, and does begin on two", () => {
    const { pinch } = harness();
    pinch.touch(1, 0, 0);
    expect(pinch.begin()).toBe(false);
    pinch.touch(2, 100, 0);
    expect(pinch.begin()).toBe(true);
  });

  test("lets the joystick go the moment it becomes a pinch, and only then", () => {
    const { pinch, calls } = harness();
    pinch.touch(1, 0, 0);
    pinch.begin();
    expect(calls.release).toBe(0);
    pinch.touch(2, 100, 0);
    pinch.begin();
    expect(calls.release).toBe(1);
    // Already running: a third finger must not release her a second time.
    pinch.touch(3, 50, 50);
    expect(pinch.begin()).toBe(true);
    expect(calls.release).toBe(1);
  });

  test("refuses a world with nowhere to zoom to", () => {
    // `zoomSteps(1)` is `[1]` — one step is not a range, so there is no
    // gesture to make and the joystick is left alone.
    const { pinch, calls } = harness(1);
    pinch.touch(1, 0, 0);
    pinch.touch(2, 100, 0);
    expect(pinch.begin()).toBe(false);
    expect(calls.release).toBe(0);
    expect(pinch.leftOver).toBe(false);
  });

  test("follows the fingers while they are down", () => {
    const { pinch, calls } = harness();
    pinch.touch(1, 0, 0);
    pinch.touch(2, 100, 0);
    pinch.begin();
    // Half as far apart, from a resting two: one.
    spreadTo(pinch, 50);
    expect(pinch.zoom).toBe(1);
    expect(calls.applyZoom).toBe(1);
    // And back out again, to the same gesture's starting width.
    spreadTo(pinch, 100);
    expect(pinch.zoom).toBe(2);
  });

  test("holds the live zoom inside the steps rather than running past them", () => {
    const { pinch } = harness();
    pinch.touch(1, 0, 0);
    pinch.touch(2, 100, 0);
    pinch.begin();
    spreadTo(pinch, 1000);
    expect(pinch.zoom).toBe(2);
    spreadTo(pinch, 1);
    expect(pinch.zoom).toBe(1);
  });

  test("settles on the nearest step when a finger lifts", () => {
    const { pinch, calls } = harness();
    pinch.touch(1, 0, 0);
    pinch.touch(2, 100, 0);
    pinch.begin();
    spreadTo(pinch, 90);
    expect(pinch.zoom).toBeCloseTo(1.8);
    const applied = calls.applyZoom;
    pinch.lifted(2);
    pinch.end(2);
    expect(pinch.zoom).toBe(2);
    expect(calls.applyZoom).toBe(applied + 1);
  });

  test("a small pinch is not a decision", () => {
    // Barely moved, then let go: the camera stays where it was rather than
    // taking the smallest movement for an answer.
    const { pinch } = harness();
    pinch.touch(1, 0, 0);
    pinch.touch(2, 100, 0);
    pinch.begin();
    spreadTo(pinch, 96);
    pinch.lifted(1);
    pinch.end(1);
    expect(pinch.zoom).toBe(2);
  });

  test("keeps the zoom a gesture chose for the next one to start from", () => {
    const { pinch } = harness();
    pinch.touch(1, 0, 0);
    pinch.touch(2, 100, 0);
    pinch.begin();
    spreadTo(pinch, 50);
    pinch.lifted(1);
    pinch.end(1);
    pinch.lifted(2);
    pinch.end(2);
    expect(pinch.zoom).toBe(1);
    // The second pinch starts from the one the first settled on, so holding
    // the fingers still leaves the camera alone.
    pinch.touch(3, 0, 0);
    pinch.touch(4, 100, 0);
    expect(pinch.begin()).toBe(true);
    pinch.moved(3, 0, 0);
    pinch.moved(4, 100, 0);
    pinch.drag();
    expect(pinch.zoom).toBe(1);
  });

  test("watches the two fingers it started with and no others", () => {
    const { pinch } = harness();
    pinch.touch(1, 0, 0);
    pinch.touch(2, 100, 0);
    pinch.begin();
    // A third finger lands and moves. A pinch that silently re-read whichever
    // fingers were down would jump; this one does not notice it at all.
    pinch.touch(3, 500, 500);
    pinch.moved(3, 900, 900);
    pinch.drag();
    expect(pinch.zoom).toBe(2);
    // And when one of the watched pair leaves, the pinch is holding a finger
    // that is no longer there rather than quietly adopting the spare. It
    // keeps swallowing the drag — the gesture is still its to close — but the
    // camera does not move again until the scene ends it.
    pinch.lifted(1);
    expect(pinch.drag()).toBe(true);
    expect(pinch.zoom).toBe(2);
  });

  test("ignores a finger it never saw land", () => {
    const { pinch } = harness();
    pinch.touch(1, 0, 0);
    pinch.touch(2, 100, 0);
    pinch.begin();
    pinch.moved(9, 400, 400);
    pinch.drag();
    expect(pinch.zoom).toBe(2);
  });

  test("stays a pinch while one finger is still down", () => {
    // The bug `pinched` exists for: the leftover finger must not become a
    // joystick and walk her across the world at the end of every zoom.
    const { pinch } = harness();
    pinch.touch(1, 0, 0);
    pinch.touch(2, 100, 0);
    pinch.begin();
    pinch.lifted(1);
    pinch.end(1);
    expect(pinch.leftOver).toBe(true);
    pinch.lifted(2);
    pinch.end(2);
    expect(pinch.leftOver).toBe(false);
  });

  test("ends on either of its two fingers, and on neither of anyone else's", () => {
    const { pinch, calls } = harness();
    pinch.touch(1, 0, 0);
    pinch.touch(2, 100, 0);
    pinch.begin();
    spreadTo(pinch, 50);
    const applied = calls.applyZoom;
    // A third finger lifting is not the end of this gesture.
    pinch.touch(3, 500, 500);
    pinch.lifted(3);
    pinch.end(3);
    expect(calls.applyZoom).toBe(applied);
    expect(pinch.drag()).toBe(true);
    pinch.lifted(2);
    pinch.end(2);
    expect(pinch.drag()).toBe(false);
  });

  test("says whether it swallowed the drag, so a pinch is never also a tap", () => {
    const { pinch, calls } = harness();
    expect(pinch.drag()).toBe(false);
    pinch.touch(1, 0, 0);
    pinch.touch(2, 100, 0);
    pinch.begin();
    expect(pinch.drag()).toBe(true);
    // Still true with a finger gone but not yet ended: the gesture is this
    // object's to close, and a drag it half-owns is not the scene's to use.
    pinch.lifted(2);
    expect(pinch.drag()).toBe(true);
    expect(calls.applyZoom).toBe(1);
  });
});
