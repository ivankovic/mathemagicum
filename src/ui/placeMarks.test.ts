// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { KNOWN_FROM_THE_START, type Spell, TAUGHT_AT, TAUGHT_BY } from "../spells/spellbook";
import { PLACE_NAMES } from "../world/places";
import { itemIcon } from "./assets";
import { DOME_OWES, owedAt } from "./placeMarks";
import { RUNE_OF } from "./runes";

/** A child who has been taught nothing beyond what she starts with. */
const newcomer = (spell: Spell) => (KNOWN_FROM_THE_START as readonly string[]).includes(spell);
/** And one who has been everywhere. */
const veteran = () => true;

describe("what a place still owes", () => {
  test("every spell with a teacher is taught somewhere", () => {
    // The pairing this table exists to keep honest. A spell that gained a
    // teacher and no place would be a dot on the map that had quietly
    // stopped saying it had something to give — invisible, because the map
    // would go on drawing the dot.
    for (const spell of Object.keys(TAUGHT_BY)) {
      expect(TAUGHT_AT[spell as Spell]).toBeDefined();
    }
  });

  test("and every place it names is one of the five", () => {
    for (const place of Object.values(TAUGHT_AT)) {
      expect(PLACE_NAMES).toContain(place as (typeof PLACE_NAMES)[number]);
    }
  });

  test("a newcomer is owed something everywhere", () => {
    // Including the observatory, which is the whole reason for this module:
    // it is the one place with no spell to give and it must still be able to
    // say that it wants her.
    for (const place of PLACE_NAMES) {
      expect(owedAt(place, newcomer, false).length).toBeGreaterThan(0);
    }
  });

  test("the city owes two, in the order her own spell tray shows them", () => {
    expect(owedAt("bigCity", newcomer, false)).toEqual([RUNE_OF.hourglass, RUNE_OF.logic]);
  });

  test("the dome owes the blueprint's own picture, not a rune", () => {
    expect(owedAt("observatory", newcomer, false)).toEqual([itemIcon(DOME_OWES)]);
  });

  test("and owes nothing once the lamps are lit", () => {
    expect(owedAt("observatory", newcomer, true)).toEqual([]);
  });

  test("a child who has been everywhere is owed nothing anywhere", () => {
    // What makes the mark mean anything: a map where every dot always glowed
    // would say only that there are five places, which she can already see.
    for (const place of PLACE_NAMES) {
      expect(owedAt(place, veteran, true)).toEqual([]);
    }
  });

  test("a spell already known is dropped while its neighbours stay", () => {
    const knowsTheHourglass = (spell: Spell) => newcomer(spell) || spell === "hourglass";
    expect(owedAt("bigCity", knowsTheHourglass, false)).toEqual([RUNE_OF.logic]);
  });
});
