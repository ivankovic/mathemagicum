// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { ROLE_SPRITES } from "../world/buildings";
import { LANDMARK_TYPES } from "../world/landmarks";
import {
  KNOWN_FROM_THE_START,
  SPELLS,
  Spell,
  TAUGHT_BESIDE,
  TAUGHT_BY,
  knowsSpell,
  learnSpell,
  readLearned,
} from "./spellbook";

describe("what a child knows", () => {
  // The one rule that survives from "learning over gating": a child who
  // cannot do the sums must never be shut out of the garden.
  test("the growth spell is theirs from the first minute", () => {
    expect(knowsSpell([], Spell.Growth)).toBe(true);
    expect(KNOWN_FROM_THE_START).toContain(Spell.Growth);
  });

  test("the portal spell is not, until somebody teaches it", () => {
    expect(knowsSpell([], Spell.Portal)).toBe(false);
    expect(knowsSpell(learnSpell([], Spell.Portal), Spell.Portal)).toBe(true);
  });

  test("every spell that has to be learned says who teaches it", () => {
    for (const spell of SPELLS) {
      if (KNOWN_FROM_THE_START.includes(spell)) continue;
      // Named rather than checked for truthiness: a spell whose teacher is
      // the empty string would pass that, and the whole value of this
      // record is that somewhere in the world can be walked to.
      expect({ spell, named: (TAUGHT_BY[spell] ?? "").length > 0 }).toEqual({ spell, named: true });
    }
  });

  // What stops the geometer announcing he has taught you the spell every
  // single time you say hello to him.
  test("learning one twice gives back the very same list", () => {
    const once = learnSpell([], Spell.Portal);
    expect(learnSpell(once, Spell.Portal)).toBe(once);
  });

  test("learning does not disturb what was already there", () => {
    expect(learnSpell(["portal"], Spell.Portal)).toEqual(["portal"]);
  });
});

describe("reading it back from a save", () => {
  test("a child who has never played knows nothing extra", () => {
    expect(readLearned(undefined)).toEqual([]);
    expect(readLearned(null)).toEqual([]);
    expect(readLearned("portal")).toEqual([]);
  });

  test("a name from another build is dropped", () => {
    expect(readLearned(["portal", "necromancy", 7])).toEqual(["portal"]);
  });

  // Known by rule rather than by record, so a save can never contradict the
  // rule — a corrupted list cannot take the garden away from a child.
  test("the ones known from the start are never stored", () => {
    expect(readLearned(["growth", "portal"])).toEqual(["portal"]);
    expect(knowsSpell(readLearned(["growth"]), Spell.Growth)).toBe(true);
  });

  test("the same spell twice comes back once", () => {
    expect(readLearned(["portal", "portal"])).toEqual(["portal"]);
  });
});

describe("what to look for", () => {
  /**
   * Every spell that has to be learned says where, and nothing else does.
   *
   * Held to `TAUGHT_BY` rather than written out, because the failure is
   * silent: a spell that gained a teacher and no landmark would be a rune
   * that refuses with nothing to say, and refusing is exactly what a rune
   * does when it has not been taught — so it would look like the feature
   * working.
   */
  test("is named for every spell that is taught, and only those", () => {
    expect(Object.keys(TAUGHT_BESIDE).sort()).toEqual(Object.keys(TAUGHT_BY).sort());
  });

  test("and the two known from the start have nowhere to be found", () => {
    for (const spell of KNOWN_FROM_THE_START) {
      expect({ spell, sight: TAUGHT_BESIDE[spell] }).toEqual({ spell, sight: undefined });
    }
  });

  /**
   * And each names something the game can actually draw: a landmark or a
   * building role. Checked against those two lists rather than against a
   * copy of them, so a typo is a failure here and not a missing texture in
   * a browser.
   */
  test("each names a landmark or a building the game has art for", () => {
    for (const [spell, sight] of Object.entries(TAUGHT_BESIDE)) {
      const known = (LANDMARK_TYPES as readonly string[]).includes(sight) || sight in ROLE_SPRITES;
      expect({ spell, sight, known }).toEqual({ spell, sight, known: true });
    }
  });
});
