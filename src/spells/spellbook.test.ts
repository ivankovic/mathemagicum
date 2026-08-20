// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import {
  KNOWN_FROM_THE_START,
  SPELLS,
  Spell,
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
