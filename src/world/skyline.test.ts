// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { CITY_HOUSE_ID, HOUSES_PER_BLIMP, mooredHouses } from "./skyline";

/** A city's worth of house ids, in the order world generation happens to make them. */
function houses(count: number): string[] {
  return Array.from({ length: count }, (_, at) => `${CITY_HOUSE_ID}-${at}`);
}

describe("which houses have an airship over them", () => {
  test("none at all when the city has no houses", () => {
    expect(mooredHouses([])).toEqual([]);
  });

  /**
   * One for every five, counted from the middle of the first group.
   *
   * Which means a city of one or two houses gets none at all, and that is
   * the right answer rather than an edge case to paper over: the offset is
   * there so the first airship is not always over the house nearest a corner
   * of the map, and a hamlet with two roofs on it does not need an airship.
   * Written as the formula rather than a table so it stays true if the
   * spacing changes.
   */
  test("one for every five houses, counted from the middle of the first group", () => {
    const offset = Math.floor(HOUSES_PER_BLIMP / 2);
    for (const count of [0, 1, 2, 3, 5, 9, 10, 24, 40]) {
      const moored = mooredHouses(houses(count));
      expect({ count, moored: moored.length }).toEqual({
        count,
        moored: Math.max(0, Math.ceil((count - offset) / HOUSES_PER_BLIMP)),
      });
    }
  });

  test("a hamlet with two roofs has no airship over it", () => {
    expect(mooredHouses(houses(2))).toEqual([]);
  });

  test("and every one of them is a house that was offered", () => {
    const all = houses(24);
    for (const id of mooredHouses(all)) expect(all).toContain(id);
    expect(new Set(mooredHouses(all)).size).toBe(mooredHouses(all).length);
  });

  /**
   * The one that would only ever show up as a complaint.
   *
   * `this.buildings` comes back in whatever order world generation made it,
   * and that order is its business rather than a promise. If this picked
   * positionally off the list as handed to it, the same seed could moor a
   * different set of roofs from one launch to the next — a child's city
   * rearranging itself overhead every time they open the game, with nothing
   * in a save file to blame.
   */
  test("the same city moors the same roofs however the houses arrive", () => {
    const all = houses(23);
    const shuffled = [...all].reverse();
    const jumbled = [all[7], all[0], all[19], ...all.filter((_, at) => ![0, 7, 19].includes(at))];
    expect(mooredHouses(shuffled)).toEqual(mooredHouses(all));
    expect(mooredHouses(jumbled as string[])).toEqual(mooredHouses(all));
  });

  /**
   * Spaced rather than drawn, which is the difference between a sky and a
   * traffic jam.
   *
   * Three airships over neighbouring roofs and none for the rest of a city
   * reads as a mistake rather than as chance, so no two moorings may be
   * adjacent in the sorted order they are picked from.
   */
  test("no two are neighbours", () => {
    const all = [...houses(40)].sort();
    const at = mooredHouses(all).map((id) => all.indexOf(id));
    for (let n = 1; n < at.length; n++) {
      expect((at[n] ?? 0) - (at[n - 1] ?? 0)).toBe(HOUSES_PER_BLIMP);
    }
  });

  test("and the first is not the house at the very edge of the list", () => {
    const all = [...houses(20)].sort();
    expect(mooredHouses(all)[0]).not.toBe(all[0]);
  });
});
