// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import {
  Deed,
  GUIDES,
  GUIDE_SPECS,
  Guide,
  GuideRun,
  type GuideView,
  type GuideWorld,
  readGuided,
} from "./guide";

const QUIET: GuideView = { trayOpen: null, crateGroupOpen: false, armed: null, indoors: null };

const GARDEN: GuideWorld = {
  outdoors: true,
  unripeCrops: 0,
  ripeCrops: 0,
  cropsInBasket: 0,
  thingsInCrate: 0,
  sleepingMachines: 0,
  spellToLearn: false,
  woodStanding: 0,
};

function run(finished: readonly string[] = []): { run: GuideRun; done: string[] } {
  const done: string[] = [];
  return { run: new GuideRun(finished, (guide) => done.push(guide)), done };
}

describe("the list of guides", () => {
  test("names every guide once, and every guide has steps", () => {
    expect([...GUIDES].sort()).toEqual([...Object.values(Guide)].sort());
    expect(new Set(GUIDES).size).toBe(GUIDES.length);
    for (const guide of GUIDES) expect(GUIDE_SPECS[guide].steps.length).toBeGreaterThan(0);
  });

  // The last step of every guide is a deed she has to do, never one that
  // could count as already done: a guide whose every step was skipped would
  // finish without her having been shown anything.
  test("no guide ends on a step that can be skipped", () => {
    for (const guide of GUIDES) {
      const steps = GUIDE_SPECS[guide].steps;
      expect({ guide, skippable: steps[steps.length - 1]?.already !== undefined }).toEqual({
        guide,
        skippable: false,
      });
    }
  });
});

describe("planting, the first guide", () => {
  test("starts out of doors and walks the pouch, a seed and the square", () => {
    const { run: guide, done } = run();
    guide.tick(GARDEN, QUIET);
    expect(guide.current).toEqual({ guide: Guide.Plant, step: 0 });
    expect(guide.cue()).toEqual({ kind: "button", name: "seeds" });

    guide.note(Deed.OpenedSeeds);
    expect(guide.cue()).toEqual({ kind: "seed" });
    guide.note(Deed.ArmedSeed);
    expect(guide.cue()).toEqual({ kind: "ahead" });
    // A deed that is not the step's does nothing.
    guide.note(Deed.OpenedSpellbook);
    expect(guide.cue()).toEqual({ kind: "ahead" });

    guide.note(Deed.Planted);
    expect(guide.current).toBe(null);
    expect(done).toEqual([Guide.Plant]);
    expect(guide.finished).toEqual([Guide.Plant]);
  });

  test("does not start indoors, and is not given twice", () => {
    const { run: guide } = run([Guide.Plant]);
    guide.tick({ ...GARDEN, outdoors: false }, QUIET);
    expect(guide.current).toBe(null);
    guide.tick(GARDEN, QUIET);
    // Plant is finished; nothing else is worth starting in an empty garden.
    expect(guide.current).toBe(null);
  });

  // A light on a button that is already pressed is a light that lies.
  test("skips the pouch when it is already open, and the seed when one is lit", () => {
    const { run: guide } = run();
    guide.tick(GARDEN, { ...QUIET, trayOpen: "seeds" });
    expect(guide.cue()).toEqual({ kind: "seed" });
    guide.tick(GARDEN, { ...QUIET, armed: "seed" });
    expect(guide.cue()).toEqual({ kind: "ahead" });
  });
});

describe("growing, the guide that goes round twice", () => {
  test("repeats the spellbook, the rune and the crop until something ripens", () => {
    const { run: guide, done } = run([Guide.Plant]);
    guide.tick({ ...GARDEN, unripeCrops: 1 }, QUIET);
    expect(guide.current).toEqual({ guide: Guide.Grow, step: 0 });
    guide.note(Deed.OpenedSpellbook);
    guide.note(Deed.ArmedGrowth);
    expect(guide.cue()).toEqual({ kind: "crop", ripe: false });
    guide.note(Deed.Grew);
    // Round again, from the spellbook.
    expect(guide.current).toEqual({ guide: Guide.Grow, step: 0 });
    guide.note(Deed.OpenedSpellbook);
    guide.note(Deed.ArmedGrowth);
    guide.note(Deed.Grew);
    guide.note(Deed.Ripened);
    expect(guide.current).toBe(null);
    expect(done).toEqual([Guide.Grow]);
  });

  test("and finishes on ripening whatever step it is at", () => {
    const { run: guide, done } = run([Guide.Plant]);
    guide.tick({ ...GARDEN, unripeCrops: 1 }, QUIET);
    guide.note(Deed.Ripened);
    expect(done).toEqual([Guide.Grow]);
  });
});

describe("the rest, in the order the loop goes", () => {
  test("picking waits for something ripe, selling for something in the basket", () => {
    const { run: guide } = run([Guide.Plant, Guide.Grow]);
    guide.tick({ ...GARDEN, ripeCrops: 1 }, QUIET);
    expect(guide.current).toEqual({ guide: Guide.Pick, step: 0 });
    guide.note(Deed.Picked);
    expect(guide.current).toBe(null);
    guide.tick({ ...GARDEN, cropsInBasket: 3 }, QUIET);
    expect(guide.cue()).toEqual({ kind: "door", building: "store" });
    // Already inside: straight to the counter.
    guide.tick({ ...GARDEN, outdoors: false, cropsInBasket: 3 }, { ...QUIET, indoors: "store" });
    expect(guide.cue()).toEqual({ kind: "attendant" });
    guide.note(Deed.OpenedShop);
    // The counter is open, and the guide goes on through the sale: her own
    // crop's line on it, and then the yes that agrees the trade.
    expect(guide.cue()).toEqual({ kind: "sell-row" });
    guide.note(Deed.ChoseCrop);
    expect(guide.cue()).toEqual({ kind: "button", name: "shop.yes" });
    expect(guide.finished).not.toContain(Guide.Sell);
    guide.note(Deed.Sold);
    expect(guide.finished).toContain(Guide.Sell);
  });

  test("placing waits for the crate to have something in it, waking for a sleeping machine", () => {
    const { run: guide } = run([Guide.Plant, Guide.Grow, Guide.Pick, Guide.Sell]);
    guide.tick(GARDEN, QUIET);
    expect(guide.current).toBe(null);
    guide.tick({ ...GARDEN, thingsInCrate: 1 }, QUIET);
    expect(guide.cue()).toEqual({ kind: "button", name: "crate" });
    guide.note(Deed.OpenedCrate);
    expect(guide.cue()).toEqual({ kind: "crate-group" });
    guide.note(Deed.OpenedGroup);
    expect(guide.cue()).toEqual({ kind: "crate-thing" });
    guide.note(Deed.ArmedThing);
    expect(guide.cue()).toEqual({ kind: "ahead" });
    guide.note(Deed.Placed);
    guide.tick({ ...GARDEN, sleepingMachines: 1 }, QUIET);
    expect(guide.cue()).toEqual({ kind: "sleeping-machine" });
    guide.note(Deed.Woke);
    expect(guide.finished).toContain(Guide.Wake);
  });

  test("one at a time: a running guide is not pushed aside by a readier one", () => {
    const { run: guide } = run([Guide.Plant, Guide.Grow]);
    guide.tick({ ...GARDEN, cropsInBasket: 3 }, QUIET);
    expect(guide.current?.guide).toBe(Guide.Sell);
    guide.tick({ ...GARDEN, cropsInBasket: 3, ripeCrops: 2 }, QUIET);
    expect(guide.current?.guide).toBe(Guide.Sell);
  });

  test("forgetting gives every guide again", () => {
    const { run: guide } = run(GUIDES);
    guide.tick(GARDEN, QUIET);
    expect(guide.current).toBe(null);
    guide.forgetAll();
    guide.tick(GARDEN, QUIET);
    expect(guide.current?.guide).toBe(Guide.Plant);
  });
});

describe("what a child has been shown", () => {
  // A save is a thing somebody else's build wrote. A name that is not a
  // guide is dropped, a shape that is not a list is no guides, and neither
  // is a crash on the way into a game.
  test("reads back from a save, dropping what it does not know", () => {
    expect(readGuided(["plant", "grow", "plant", "trebuchet", 7])).toEqual(["plant", "grow"]);
    expect(readGuided(undefined)).toEqual([]);
    expect(readGuided("plant")).toEqual([]);
    expect(readGuided(null)).toEqual([]);
  });
});

describe("the tower, and the man at the top of it", () => {
  test("is not offered before the shop, however long a spell has been owed", () => {
    // The gap that caught this: the world is re-read twice a second, so for
    // half a second after her first seed goes in nothing is growing yet —
    // and the tower was the first guide whose `when` was true.
    const { run: guide } = run([Guide.Plant]);
    guide.tick({ ...GARDEN, spellToLearn: true }, QUIET);
    expect(guide.current).toBe(null);
    guide.tick({ ...GARDEN, spellToLearn: true, unripeCrops: 1 }, QUIET);
    expect(guide.current?.guide).toBe(Guide.Grow);
  });

  test("waits for a spell still owed, and ends when he gives it", () => {
    const { run: guide } = run([Guide.Plant, Guide.Grow, Guide.Pick, Guide.Sell]);
    guide.tick(GARDEN, QUIET);
    expect(guide.current).toBe(null);
    guide.tick({ ...GARDEN, spellToLearn: true }, QUIET);
    expect(guide.cue()).toEqual({ kind: "door", building: "post-office" });
    guide.note(Deed.ClimbedTower);
    expect(guide.cue()).toEqual({ kind: "attendant" });
    guide.note(Deed.LearnedSpell);
    expect(guide.finished).toContain(Guide.Learn);
  });

  test("skips the climb for a child already up there", () => {
    const { run: guide } = run([Guide.Plant, Guide.Grow, Guide.Pick, Guide.Sell]);
    guide.tick(
      { ...GARDEN, outdoors: false, spellToLearn: true },
      { ...QUIET, indoors: "post-office" },
    );
    expect(guide.cue()).toEqual({ kind: "attendant" });
  });
});

describe("the great tree's errand", () => {
  const WOOD = { ...GARDEN, woodStanding: 12 };
  const before = [
    Guide.Plant,
    Guide.Grow,
    Guide.Pick,
    Guide.Sell,
    Guide.Learn,
    Guide.Place,
    Guide.Wake,
  ];

  test("shows three squares of wood and then lets her get on with it", () => {
    const { run: guide } = run(before);
    guide.tick(WOOD, QUIET);
    for (let square = 0; square < 3; square++) {
      expect(guide.cue()).toEqual({ kind: "wood" });
      guide.note(Deed.ClearedWood);
    }
    // The fourth is the tree, which draws nothing until the wood is down —
    // that part is the scene's, and is why the quiet stretch is quiet.
    expect(guide.cue()).toEqual({ kind: "great-tree" });
    expect(guide.finished).not.toContain(Guide.Grove);
  });

  test("and then the spell the tree pays with, on the beds it wants filled", () => {
    const { run: guide } = run(before);
    guide.tick(WOOD, QUIET);
    for (let square = 0; square < 3; square++) guide.note(Deed.ClearedWood);
    guide.note(Deed.LearnedArray);
    expect(guide.cue()).toEqual({ kind: "button", name: "spellbook" });
    guide.note(Deed.OpenedSpellbook);
    expect(guide.cue()).toEqual({ kind: "array-rune" });
    guide.note(Deed.ArmedArray);
    expect(guide.cue()).toEqual({ kind: "grove-bed" });
    guide.note(Deed.CastArray);
    expect(guide.finished).toContain(Guide.Grove);
  });

  test("the spellbook already open is a step already taken", () => {
    const { run: guide } = run(before);
    guide.tick(WOOD, QUIET);
    for (let square = 0; square < 3; square++) guide.note(Deed.ClearedWood);
    guide.note(Deed.LearnedArray);
    guide.tick(WOOD, { ...QUIET, trayOpen: "spellbook" });
    expect(guide.cue()).toEqual({ kind: "array-rune" });
  });

  test("is not offered away from the wood", () => {
    const { run: guide } = run(before);
    guide.tick(GARDEN, QUIET);
    expect(guide.current).toBe(null);
  });
});
