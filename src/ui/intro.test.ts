// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { UI_ASSETS } from "./assets";
import { INTRO_BEATS, INTRO_ICONS, IntroBeat } from "./intro";

describe("the welcome's pictures", () => {
  // Every page shows icons the player will meet again in the corner of the
  // screen. One naming an asset the loader does not have would draw the
  // missing-texture square, in the first thing a new player ever sees.
  test("are assets the game actually loads", () => {
    for (const beat of INTRO_BEATS) {
      for (const asset of INTRO_ICONS[beat]) {
        expect({ beat, asset, loaded: UI_ASSETS.includes(asset) }).toEqual({
          beat,
          asset,
          loaded: true,
        });
      }
    }
  });

  test("every beat has some, and the panel has room for them", () => {
    for (const beat of INTRO_BEATS) {
      expect(INTRO_ICONS[beat].length).toBeGreaterThan(0);
      // IntroPanel builds two image slots; a third would be dropped silently.
      expect(INTRO_ICONS[beat].length).toBeLessThanOrEqual(2);
    }
  });

  test("the beats are the five the tour walks, without repeats", () => {
    expect(INTRO_BEATS).toEqual([
      IntroBeat.Seeds,
      IntroBeat.Spell,
      IntroBeat.Pick,
      IntroBeat.Store,
      IntroBeat.Map,
    ]);
    expect(new Set(INTRO_BEATS).size).toBe(INTRO_BEATS.length);
  });

  // The map is the one beat that names a place rather than an action, and it
  // is also the only beat with a single icon instead of two — worth pinning
  // both, since a page with one picture is an easy thing to get wrong when
  // the panel expects a pair.
  test("the map beat points at the wall map and nothing else", () => {
    expect(INTRO_ICONS[IntroBeat.Map]).toEqual(["map-wall"]);
  });
});
