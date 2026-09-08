// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { UI_ASSETS } from "./assets";
import { NEWS_BEATS, NEWS_ICONS } from "./news";

describe("the letter's pictures", () => {
  // The welcome's test, for the same reason and one that is sharper here:
  // this list grows a beat at a time, long after anybody remembers what the
  // panel can draw, and an asset the loader does not have would put the
  // missing-texture square on a page a child is shown unprompted.
  test("are assets the game actually loads", () => {
    for (const beat of NEWS_BEATS) {
      for (const asset of NEWS_ICONS[beat]) {
        expect({ beat, asset, loaded: UI_ASSETS.includes(asset) }).toEqual({
          beat,
          asset,
          loaded: true,
        });
      }
    }
  });

  test("every beat has some, and the panel has room for them", () => {
    for (const beat of NEWS_BEATS) {
      expect(NEWS_ICONS[beat].length).toBeGreaterThan(0);
      // NewsPanel builds two image slots; a third would be dropped silently.
      expect(NEWS_ICONS[beat].length).toBeLessThanOrEqual(2);
    }
  });

  // The count is what every save's `newsSeen` is an index into, so the list
  // is append-only: a beat inserted or dropped in the middle silently
  // re-reads every child's count as pointing at a different letter. Nothing
  // can test "was this appended", but a repeat is the one shape of that
  // mistake which is checkable, and it is the likely one — a beat added
  // twice while rebasing two branches that each shipped something.
  test("the beats are distinct", () => {
    expect(new Set(NEWS_BEATS).size).toBe(NEWS_BEATS.length);
  });
});
