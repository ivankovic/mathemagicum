// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import {
  FLOWER_LOOKS,
  FLOWER_TYPES,
  FlowerType,
  WILD_APART,
  findFlower,
  flowerFrames,
  flowerObject,
  flowerParts,
  hasFound,
  readFound,
  wildFlowerFor,
  wildFlowerObject,
  wildLook,
  wildSpots,
} from "./flowers";
import { createRng } from "./rng";

describe("naming a planted flower", () => {
  test("carries its colour in its name, which is what saves it", () => {
    expect(flowerObject(FlowerType.Tulip, 3)).toBe("tulip~3");
    expect(flowerParts("tulip~3")).toEqual({ flower: FlowerType.Tulip, look: 3 });
  });

  test("and reads back nothing from anything else", () => {
    for (const nonsense of ["tulip", "tulip~", "~2", "tulip~2~3", "rose~1", "", "tulip~x"]) {
      expect({ nonsense, parts: flowerParts(nonsense) }).toEqual({ nonsense, parts: null });
    }
  });

  // A colour the art does not have would be a flower drawn from a frame that
  // is not there, which Phaser answers with a blank sprite.
  test("and refuses a colour that was never drawn", () => {
    expect(flowerParts(`tulip~${FLOWER_LOOKS}`)).toBeNull();
    expect(flowerParts(flowerObject(FlowerType.Tulip, FLOWER_LOOKS - 1))).not.toBeNull();
  });
});

describe("the wild ones", () => {
  // Same flower, different answer to a tap: one is found and one is dug up.
  test("are named apart from the planted ones", () => {
    for (const flower of FLOWER_TYPES) {
      expect(wildFlowerFor(wildFlowerObject(flower))).toBe(flower);
      expect(flowerParts(wildFlowerObject(flower))).toBeNull();
      expect(wildFlowerFor(flowerObject(flower, 0))).toBeNull();
    }
  });

  test("and are drawn in a colour the art has", () => {
    for (const flower of FLOWER_TYPES) {
      expect(wildLook(flower)).toBeGreaterThanOrEqual(0);
      expect(wildLook(flower)).toBeLessThan(FLOWER_LOOKS);
    }
    // Not all the same, or the three patches would read as one plant.
    expect(new Set(FLOWER_TYPES.map(wildLook)).size).toBeGreaterThan(1);
  });
});

describe("finding them", () => {
  test("one kind at a time, and never twice", () => {
    let found: readonly string[] = [];
    expect(hasFound(found, FlowerType.Daisy)).toBe(false);
    found = findFlower(found, FlowerType.Daisy);
    expect(hasFound(found, FlowerType.Daisy)).toBe(true);
    // The same list back when it is already there, so a caller can compare by
    // identity to decide whether anything happened — which is what stops the
    // game announcing a discovery every time she walks past.
    expect(findFlower(found, FlowerType.Daisy)).toBe(found);
  });

  test("and a save from another build is read for what it has", () => {
    expect(readFound(["tulip", "rose", "daisy", 7, null])).toEqual(["tulip", "daisy"]);
    expect(readFound(["tulip", "tulip"])).toEqual(["tulip"]);
    for (const nonsense of [null, undefined, "tulip", 3, {}]) {
      expect(readFound(nonsense)).toEqual([]);
    }
  });
});

describe("where the wild ones grow", () => {
  const open = Array.from({ length: 400 }, (_, i) => ({
    col: (i * 37) % 300,
    row: (i * 53) % 300,
  }));

  test("one of each kind, on cells the caller said were open", () => {
    const spots = wildSpots(createRng(3), open);
    expect(spots.map((one) => one.flower)).toEqual([...FLOWER_TYPES]);
    for (const spot of spots) {
      expect(open.some((at) => at.col === spot.col && at.row === spot.row)).toBe(true);
    }
  });

  // A patch that moved between runs is a patch no scenario could be pointed
  // at, and two children comparing worlds would be comparing nothing.
  test("in the same places for the same world", () => {
    expect(wildSpots(createRng(9), open)).toEqual(wildSpots(createRng(9), open));
  });

  // Three flowers found in one meadow is not three journeys.
  test("and far enough apart to be worth walking to", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const spots = wildSpots(createRng(seed), open);
      for (let i = 0; i < spots.length; i++) {
        for (let j = i + 1; j < spots.length; j++) {
          const a = spots[i] as { col: number; row: number };
          const b = spots[j] as { col: number; row: number };
          const gap = Math.hypot(a.col - b.col, a.row - b.row);
          expect({ seed, apart: gap >= WILD_APART }).toEqual({ seed, apart: true });
        }
      }
    }
  });

  /**
   * A world too small or too wet to hold them apart still gets all three.
   *
   * Two thirds of a quest is worse than three flowers standing closer
   * together than they were meant to — and the second is something a child
   * might not even notice.
   */
  test("and a cramped world gets three anyway", () => {
    const cramped = Array.from({ length: 12 }, (_, i) => ({ col: i % 4, row: Math.floor(i / 4) }));
    expect(wildSpots(createRng(1), cramped)).toHaveLength(FLOWER_TYPES.length);
    expect(wildSpots(createRng(1), [])).toEqual([]);
  });
});

describe("the frames one colour uses", () => {
  test("are a run, not every fifth one", () => {
    expect(flowerFrames(0, 8)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(flowerFrames(2, 8)).toEqual([16, 17, 18, 19, 20, 21, 22, 23]);
  });
});
