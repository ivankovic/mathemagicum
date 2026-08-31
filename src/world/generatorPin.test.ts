// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { GENERATOR_VERSION } from "../save/snapshot";
import { generateWorld } from "./worldGenerator";

/**
 * A tripwire on what a seed grows, and the one thing that makes
 * `GENERATOR_VERSION` mean anything.
 *
 * That number is bumped **by hand**, deliberately — `snapshot.ts` argues for
 * it and the argument is sound: deriving it by hashing the generator's source
 * would invalidate every save on a comment, and a scheme that cries wolf gets
 * routed around. But a hand-bumped number is a *remembered* number, and the
 * failure it guards against is silent: change a habitat rule without bumping,
 * and the same seed grows a different coastline while every save goes on
 * claiming to fit the old one. A child walks back into their garden and finds
 * a fence in the sea.
 *
 * So the bump stops being remembered and starts being *forced*. These
 * fingerprints fail the moment a seed grows something different, and the only
 * way past them is to write down the new ones — at which point bumping the
 * version is a thing somebody is looking straight at rather than a thing they
 * might think of.
 *
 * **When this fails, that is the tripwire working.** The fix is two lines:
 * bump `GENERATOR_VERSION`, then update the fingerprints below. What it must
 * never be is quietly reconciled without the bump, because the bump is what
 * tells every save in the world that the ground has moved under it.
 */

/**
 * The size the generator's own sweep tests use.
 *
 * Not the five hundred a real game is played on, which takes the best part of
 * a second each and would put three of them in a suite that runs in sixteen.
 * Not smaller either: the anchors need room, and a box too small to lay the
 * village out in throws rather than growing a different world.
 */
const SIZE = 150;

/**
 * Three seeds rather than one.
 *
 * A generator change that moved one coastline and left another alone is a
 * real shape of change — habitats are chosen per region — and one seed can
 * sit on the wrong side of that and say nothing.
 */
const SEEDS = [1, 12345, 99991] as const;

/**
 * What a world comes to, in one number.
 *
 * Terrain *and* elevation *and* what is standing on it, because those are the
 * three things a saved tile can be wrong about: a fence in the sea, a fence
 * up a cliff, and a fence inside a boulder. Folded together rather than
 * compared cell by cell — a quarter of a million cells written out is a test
 * nobody reads and a diff nobody can act on, where a number that changed is a
 * question with one answer: what did you just do to the generator?
 */
function fingerprint(seed: number): number {
  const world = generateWorld(SIZE, SIZE, seed);
  let hash = 0x811c9dc5;
  const eat = (value: number) => {
    hash ^= value & 0xff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  };
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      for (const char of world.grid.getTerrain(col, row)) eat(char.charCodeAt(0));
      eat(world.grid.getLevel(col, row));
    }
  }
  for (const object of world.grid.listObjects()) {
    for (const char of `${object.type}${object.col},${object.row}`) eat(char.charCodeAt(0));
  }
  return hash;
}

describe("what a seed grows", () => {
  /**
   * The fingerprints. **Only ever changed alongside a bump.**
   *
   * If you are here because this failed: that is the point. Bump
   * `GENERATOR_VERSION` in `snapshot.ts` and then write the new numbers down,
   * in that order and never one without the other.
   */
  const PINNED: Readonly<Record<number, number>> = {
    1: 1614362770,
    12345: 2514093258,
    99991: 3058553396,
  };

  for (const seed of SEEDS) {
    test(`seed ${seed} grows the same world it always has`, () => {
      expect({ seed, world: fingerprint(seed) }).toEqual({ seed, world: PINNED[seed] ?? -1 });
    });
  }

  // That the same seed twice in one run is the same world is asserted in
  // `worldGenerator.test.ts` and not again here. This file is about the world
  // being the same *between runs of different builds*, which is a different
  // question and the one a save cares about.

  /**
   * The version is a number somebody bumps, so it is worth one line of
   * defence against it being edited to something that is not one.
   */
  test("and the version it is pinned against is a whole number", () => {
    expect(Number.isInteger(GENERATOR_VERSION)).toBe(true);
    expect(GENERATOR_VERSION).toBeGreaterThan(0);
  });
});
