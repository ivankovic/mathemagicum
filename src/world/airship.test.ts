// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import {
  AIRSHIP_BUILD,
  AirshipStage,
  type Given,
  STAGE_COUNT,
  flies,
  stageNow,
  stagesDone,
  stillWanted,
  wholeBuild,
} from "./airship";
import { PRESSINGS } from "./machines";
import { MADE_MATERIALS, MaterialType } from "./materials";

/** Everything the whole thing takes, handed over at once. */
const EVERYTHING: Given = {
  [MaterialType.Truss]: 3,
  [MaterialType.Gondola]: 1,
  [MaterialType.Envelope]: 1,
  [MaterialType.Vane]: 2,
};

describe("building it", () => {
  test("starts on the keel and asks for what the keel wants", () => {
    expect(stagesDone({})).toBe(0);
    expect(stageNow({})?.stage).toBe(AirshipStage.Keel);
    expect(stillWanted({})).toEqual([[MaterialType.Truss, 3]]);
    expect(flies({})).toBe(false);
  });

  test("counts down what is still short rather than what is wanted", () => {
    // What a child looking at the sheet needs is what to go and make, not
    // what the stage costs in total.
    expect(stillWanted({ [MaterialType.Truss]: 1 })).toEqual([[MaterialType.Truss, 2]]);
    expect(stillWanted({ [MaterialType.Truss]: 3 })).toEqual([[MaterialType.Gondola, 1]]);
  });

  test("goes in order, and stops at the first gap", () => {
    // An envelope with no keel is not a balloon: there is nothing to hang
    // it on. So a child who has run ahead on one part has still only built
    // as far as the first thing she is short of, and the stage the sheet
    // shows as next is always one she can actually do.
    const runAhead: Given = { [MaterialType.Envelope]: 1, [MaterialType.Vane]: 2 };
    expect(stagesDone(runAhead)).toBe(0);
    expect(stageNow(runAhead)?.stage).toBe(AirshipStage.Keel);
    expect(flies(runAhead)).toBe(false);
  });

  test("finishes a stage at a time, in the order the stages are listed", () => {
    let given: Given = {};
    for (const [n, spec] of AIRSHIP_BUILD.entries()) {
      expect(stagesDone(given)).toBe(n);
      expect(stageNow(given)?.stage).toBe(spec.stage);
      given = { ...given, ...Object.fromEntries(spec.wants) };
    }
    expect(stagesDone(given)).toBe(STAGE_COUNT);
    expect(stageNow(given)).toBe(null);
    expect(stillWanted(given)).toEqual([]);
  });

  test("flies only when every stage is done", () => {
    expect(flies(EVERYTHING)).toBe(true);
    // One short of any single part and it does not.
    for (const [material] of wholeBuild()) {
      const short: Given = { ...EVERYTHING, [material]: (EVERYTHING[material] ?? 0) - 1 };
      expect({ material, flies: flies(short) }).toEqual({ material, flies: false });
    }
  });

  test("more than enough is still enough", () => {
    // Nothing is spent by being over-delivered, and nothing is refused. A
    // child who made four trusses because she lost count has not broken
    // anything.
    const plenty = Object.fromEntries(wholeBuild().map(([material, many]) => [material, many + 5]));
    expect(flies(plenty)).toBe(true);
  });
});

describe("what it is made of", () => {
  test("is only ever things a press can make", () => {
    // The join between the tier tree and the ending. If a stage ever
    // started wanting something gathered, the airship would stop being the
    // top of the tree and become an errand.
    const made = new Set<string>(MADE_MATERIALS);
    for (const [material] of wholeBuild()) expect(made.has(material)).toBe(true);
  });

  test("and every one of them is reachable by pressing", () => {
    // Guards the seam the other way round: a stage naming a material that
    // no pairing produces would be an airship nobody can finish, and it
    // would look perfectly reasonable in both files on its own.
    const madeByAPress = new Set(Object.values(PRESSINGS));
    for (const [material] of wholeBuild()) {
      expect({ material, pressable: madeByAPress.has(material) }).toEqual({
        material,
        pressable: true,
      });
    }
  });

  test("asks for no stage twice, so a part means one stage", () => {
    const stages = AIRSHIP_BUILD.map((spec) => spec.stage);
    expect([...new Set(stages)]).toHaveLength(stages.length);
    const parts = wholeBuild().map(([material]) => material);
    expect([...new Set(parts)]).toHaveLength(parts.length);
  });

  test("wants small numbers, because the depth is where the work is", () => {
    // A single envelope already has a cactus, a sunflower, some wheat, a
    // stone and a tree behind it. Asking for ten would not make the airship
    // feel bigger; it would make the last tier feel like a wall.
    for (const [, many] of wholeBuild()) {
      expect(many).toBeGreaterThan(0);
      expect(many).toBeLessThanOrEqual(3);
    }
  });
});
