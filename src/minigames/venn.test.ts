// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { CLEAN_TO_CLIMB, STUMBLES_TO_EASE } from "../spells/difficulty";
import type { Token } from "../spells/logic";
import { createRng } from "../world/rng";
import {
  HARDEST_VENN_RUNG,
  Region,
  VENN_RUNGS,
  type VennRound,
  goesThrough,
  nextVennRung,
  placedRight,
  regionOf,
  regionsOf,
  vennRound,
  vennRungAt,
} from "./venn";

const token = (hue: string, shape: string): Token =>
  ({ id: `${hue}-${shape}`, hue, shape }) as Token;

const twoRings: VennRound = {
  left: { kind: "hue", hue: "red" },
  right: { kind: "shape", shape: "round" },
  tokens: [],
};

describe("where a thing belongs", () => {
  test("is the lens when both rings describe it", () => {
    expect(regionOf(twoRings, token("red", "round"))).toBe(Region.Both);
  });

  test("and one ring or the other when only one does", () => {
    expect(regionOf(twoRings, token("red", "square"))).toBe(Region.Left);
    expect(regionOf(twoRings, token("blue", "round"))).toBe(Region.Right);
  });

  test("and outside when neither does, which is a place and not a failure", () => {
    expect(regionOf(twoRings, token("blue", "square"))).toBe(Region.Outside);
  });

  test("is never the right ring while there is only one ring", () => {
    // The one-ring rungs ask "in or out" and nothing else, so a thing the
    // ring does not describe is *outside* rather than in a ring that is not
    // drawn. A version that answered Right here would have the parchment
    // drawing a drop target nobody can see.
    const oneRing: VennRound = { left: { kind: "hue", hue: "red" }, right: null, tokens: [] };
    expect(regionOf(oneRing, token("blue", "round"))).toBe(Region.Outside);
    expect(regionOf(oneRing, token("red", "round"))).toBe(Region.Left);
    expect(regionsOf(oneRing)).toEqual([Region.Left, Region.Outside]);
    expect(regionsOf(twoRings)).toHaveLength(4);
  });
});

describe("what goes down the spout", () => {
  test("is everything in either ring, which is what a funnel does", () => {
    // The union, including the lens: a thing in both rings goes down once,
    // not twice. This is the machine's own operation and the reason the
    // funnel's category is sets at all.
    expect(goesThrough(twoRings, token("red", "square"))).toBe(true);
    expect(goesThrough(twoRings, token("blue", "round"))).toBe(true);
    expect(goesThrough(twoRings, token("red", "round"))).toBe(true);
    expect(goesThrough(twoRings, token("blue", "square"))).toBe(false);
  });
});

describe("a round", () => {
  test("always leaves something outside, over every seed and rung", () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const [at] of VENN_RUNGS.entries()) {
        const round = vennRound(createRng(seed), vennRungAt(at));
        const seen = round.tokens.map((one) => regionOf(round, one));
        expect(seen).toContain(Region.Outside);
      }
    }
  });

  test("always has something to put in a ring", () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const [at] of VENN_RUNGS.entries()) {
        const round = vennRound(createRng(seed), vennRungAt(at));
        const seen = new Set(round.tokens.map((one) => regionOf(round, one)));
        expect(seen.has(Region.Left) || seen.has(Region.Both)).toBe(true);
      }
    }
  });

  test("uses its lens whenever it has drawn one", () => {
    // The rung whose whole point is the overlap must actually overlap. A
    // random handful very often has nothing in both rings, and a lens that
    // stays empty teaches the opposite of the lesson: that things never go
    // there.
    for (let seed = 0; seed < 200; seed++) {
      for (const [at, rung] of VENN_RUNGS.entries()) {
        if (!rung.overlaps) continue;
        const round = vennRound(createRng(seed), vennRungAt(at));
        const seen = round.tokens.map((one) => regionOf(round, one));
        expect(seen).toContain(Region.Both);
      }
    }
  });

  test("draws no lens at all where the rung says there is none", () => {
    // Two colours cannot both describe one thing, so the lens is empty
    // *because nothing belongs in it* — which is the honest way to show a
    // second ring for the first time. If this ever drew a shape here, a
    // child would meet the overlap a rung early and unannounced.
    for (let seed = 0; seed < 200; seed++) {
      for (const [at, rung] of VENN_RUNGS.entries()) {
        if (rung.rings !== 2 || rung.overlaps) continue;
        const round = vennRound(createRng(seed), vennRungAt(at));
        const seen = round.tokens.map((one) => regionOf(round, one));
        expect(seen).not.toContain(Region.Both);
      }
    }
  });

  test("has the number of things the rung asked for, and one ring or two", () => {
    for (let seed = 0; seed < 50; seed++) {
      for (const [at, rung] of VENN_RUNGS.entries()) {
        const round = vennRound(createRng(seed), vennRungAt(at));
        expect(round.tokens).toHaveLength(rung.tokens);
        expect(round.right === null).toBe(rung.rings === 1);
      }
    }
  });

  test("is not the same round every time", () => {
    const seen = new Set(
      Array.from({ length: 100 }, (_, seed) => {
        const round = vennRound(createRng(seed), vennRungAt(HARDEST_VENN_RUNG));
        return JSON.stringify([round.left, round.right, round.tokens]);
      }),
    );
    expect(seen.size).toBeGreaterThan(50);
  });
});

describe("putting one somewhere", () => {
  test("is right only where it belongs", () => {
    const one = token("red", "round");
    expect(placedRight(twoRings, one, Region.Both)).toBe(true);
    for (const region of [Region.Left, Region.Right, Region.Outside]) {
      expect(placedRight(twoRings, one, region)).toBe(false);
    }
  });
});

describe("the ladder", () => {
  test("climbs on a clean run and eases on stumbles", () => {
    expect(nextVennRung(0, Array(CLEAN_TO_CLIMB).fill(true))).toBe(1);
    expect(nextVennRung(3, Array(STUMBLES_TO_EASE).fill(false))).toBe(2);
    expect(nextVennRung(3, [])).toBe(3);
  });

  test("and stops at both ends rather than running off them", () => {
    expect(nextVennRung(0, Array(STUMBLES_TO_EASE).fill(false))).toBe(0);
    expect(nextVennRung(HARDEST_VENN_RUNG, Array(CLEAN_TO_CLIMB).fill(true))).toBe(
      HARDEST_VENN_RUNG,
    );
    expect(vennRungAt(-5)).toBe(VENN_RUNGS[0] as never);
    expect(vennRungAt(99)).toBe(VENN_RUNGS[HARDEST_VENN_RUNG] as never);
  });

  test("starts on one ring and ends on two that cross", () => {
    // The shape of the climb, stated so that reordering the rungs has to be
    // deliberate: a child meets belonging, then a second ring that cannot
    // overlap, then the lens.
    expect(vennRungAt(0).rings).toBe(1);
    expect(vennRungAt(HARDEST_VENN_RUNG).rings).toBe(2);
    expect(vennRungAt(HARDEST_VENN_RUNG).overlaps).toBe(true);
    const firstTwo = VENN_RUNGS.findIndex((rung) => rung.rings === 2);
    const firstLens = VENN_RUNGS.findIndex((rung) => rung.overlaps);
    expect(firstTwo).toBeGreaterThan(0);
    expect(firstLens).toBeGreaterThan(firstTwo);
  });
});
