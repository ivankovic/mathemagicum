// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { PRESSINGS, pressable, pressing } from "./machines";
import { GATHERED_MATERIALS, MADE_MATERIALS, MaterialType } from "./materials";
import { PLANT_TYPES } from "./plants";

/**
 * The tree from what the world hands over to what flies.
 *
 * Every one of these is about *reachability* rather than about any single
 * recipe, because that is the way a tier tree goes wrong: not by a pairing
 * being mistyped — that shows up the first time somebody plays — but by a
 * material being made of something nobody can get, which looks perfectly
 * fine in the table and is only found by a child who runs out of tree.
 */

/** Everything a child can get without pressing anything: gathered and grown. */
const FROM_THE_WORLD: readonly string[] = [...GATHERED_MATERIALS, ...PLANT_TYPES];

/**
 * Everything reachable, by pressing what she has until nothing new appears.
 *
 * The same closure a child walks: start with what the world gives, and add
 * whatever can be made out of two things already in hand.
 */
function reachable(): Set<string> {
  const have = new Set<string>(FROM_THE_WORLD);
  for (let pass = 0; pass < 20; pass++) {
    const before = have.size;
    for (const [pair, made] of Object.entries(PRESSINGS)) {
      if (pair.split("+").every((one) => have.has(one))) have.add(made);
    }
    if (have.size === before) break;
  }
  return have;
}

describe("the tree to the airship", () => {
  test("every made material can actually be made", () => {
    // The one that matters. A tier whose ingredients are not reachable is a
    // dead end nobody finds until they are standing in front of a press
    // with the wrong things in their basket.
    const have = reachable();
    for (const material of MADE_MATERIALS) {
      expect({ material, reachable: have.has(material) }).toEqual({ material, reachable: true });
    }
  });

  test("and the three the airship is made of are among them", () => {
    const have = reachable();
    for (const part of [MaterialType.Envelope, MaterialType.Gondola, MaterialType.Vane]) {
      expect(have.has(part)).toBe(true);
    }
  });

  test("nothing is made out of itself, however far round the loop", () => {
    // A pressing whose output is one of its own inputs would be a machine
    // that eats a thing to make the same thing, and the closure above would
    // happily report it reachable because it was already there.
    for (const [pair, made] of Object.entries(PRESSINGS)) {
      expect(pair.split("+")).not.toContain(made as string);
    }
  });

  test("each pressing takes two different things a press will accept", () => {
    for (const [pair, made] of Object.entries(PRESSINGS)) {
      const parts = pair.split("+");
      expect({ pair, two: parts.length }).toEqual({ pair, two: 2 });
      const [one, two] = parts as [string, string];
      expect(one).not.toBe(two);
      // `pressable` is derived from these keys, so this is really asking
      // that the derivation still holds — the thing that lets a new tier be
      // one line rather than three.
      expect(pressable(one as never)).toBe(true);
      expect(pressable(two as never)).toBe(true);
      expect(pressing(one as never, two as never)).toBe(made);
      // And in either order: neither funnel of a press is the special one.
      expect(pressing(two as never, one as never)).toBe(made);
    }
  });

  test("no material is made two different ways", () => {
    // Not a law of nature, but it is the design: one recipe per thing keeps
    // the sheet that says what a thing costs readable, and two ways to a
    // material would make the tree a graph nobody could draw for a child.
    const made = Object.values(PRESSINGS);
    expect([...new Set(made)]).toHaveLength(made.length);
  });

  test("the chain is deep enough that carrying by hand is the problem", () => {
    // The point of the whole tree, stated as a number. Wiring presses
    // together is the reward, and a reward needs something to be a reward
    // *for* — a tree a child could hand-carry in two trips would leave the
    // machines as scenery. If this ever drops, the airship got cheap.
    const depth = (of: string, seen = new Set<string>()): number => {
      if (FROM_THE_WORLD.includes(of)) return 0;
      if (seen.has(of)) return Number.POSITIVE_INFINITY;
      const pair = Object.entries(PRESSINGS).find(([, made]) => made === of)?.[0];
      if (!pair) return Number.POSITIVE_INFINITY;
      const next = new Set([...seen, of]);
      return 1 + Math.max(...pair.split("+").map((one) => depth(one, next)));
    };
    // Five: cord, canvas, panel, truss, envelope. Five walks with a basket
    // if she does it by hand, and one line of machines if she does not.
    expect(depth(MaterialType.Envelope)).toBe(5);
    expect(depth(MaterialType.Gondola)).toBe(5);
    expect(depth(MaterialType.Vane)).toBe(5);
    // And finite, which is the same check as "no loops" from the other end.
    for (const material of MADE_MATERIALS) expect(depth(material)).toBeLessThan(20);
  });

  test("the cactus finally feeds something", () => {
    // Four of the six crops fed nothing before the airship. This is the one
    // that wants sand, so the tier that starts the airship is also what
    // sends a child somewhere she had no reason to walk to.
    expect(pressable("cactus" as never)).toBe(true);
  });
});
