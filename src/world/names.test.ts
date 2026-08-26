// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { FOLK_NAMES, KEEPER_NAMES, NAMED_PEOPLE, nameCast } from "./names";
import { generateWorld } from "./worldGenerator";

// The same size and sweep the world generator's own tests use: big enough to
// hold a city and a harbour, small enough that twenty of them are quick.
const SIZE = 150;
const SEEDS = Array.from({ length: 20 }, (_, at) => at);

/** Everybody a world puts down, in the order the scene assembles them. */
function castOf(seed: number) {
  const world = generateWorld(SIZE, SIZE, seed);
  return [...world.village.npcs, ...world.city.npcs, ...(world.harbour?.npcs ?? [])];
}

describe("everybody in the world is somebody", () => {
  for (const seed of SEEDS) {
    test(`seed ${seed} leaves nobody nameless`, () => {
      const cast = castOf(seed);
      const names = nameCast(cast);
      const nameless = cast.filter((person) => !names.get(person.id));
      expect(nameless.map((person) => person.id)).toEqual([]);
    });
  }

  // The point of the whole exercise. Five shops in the city, two on the quay
  // and one in the village, all drawn with the same apron: if two of those
  // women share a name there is nothing left that tells them apart.
  for (const seed of SEEDS) {
    test(`seed ${seed} gives no two people the same name`, () => {
      const cast = castOf(seed);
      const names = nameCast(cast);
      const said = cast.map((person) => names.get(person.id) as string);
      expect(said.length - new Set(said).size).toBe(0);
    });
  }

  test("the pools are bigger than any world the generator makes", () => {
    // Read off the real worlds rather than written down, so the day the city
    // grows a sixth shop this says so instead of quietly wrapping round and
    // putting two Anas in it. The check above would catch it too; this one
    // says *why*.
    const most = { keepers: 0, folk: 0 };
    for (const seed of SEEDS) {
      const cast = castOf(seed);
      const keepers = cast.filter((person) => (person.role ?? person.id) === "shopkeeper");
      most.keepers = Math.max(most.keepers, keepers.length);
      most.folk = Math.max(most.folk, cast.length - keepers.length);
    }
    // Minus one keeper: the village's is named by hand and never takes a
    // name out of the pool.
    expect(most.keepers - 1).toBeLessThanOrEqual(KEEPER_NAMES.length);
    expect(most.folk).toBeLessThanOrEqual(FOLK_NAMES.length);
  });
});

describe("who is named by hand", () => {
  test("the roles the game writes sentences about", () => {
    // Not a spelling test. These six are the people the phrase books name in
    // so many words — a rename here is a rename in three languages, and this
    // is where that gets noticed.
    expect(Object.keys(NAMED_PEOPLE).sort()).toEqual([
      "astronomer",
      "clockmaker",
      "geometer",
      "postal-worker",
      "shopkeeper",
      "teacher",
    ]);
  });

  test("they are named whether or not a world holds them", () => {
    // The astronomer is spawned from the scene's own list of lone attendants
    // rather than from any layout's cast, so she is in no cast at all — and
    // she is the one who would go nameless if this map were built only from
    // the people handed to it.
    const names = nameCast([]);
    expect(names.get("astronomer")).toBe(NAMED_PEOPLE.astronomer);
    expect(names.get("clockmaker")).toBe(NAMED_PEOPLE.clockmaker);
  });

  test("a part with one player keeps their name under any id", () => {
    // The city calls its clockmaker `city-clockmaker`, because every id in
    // the world has to be its own — so the table, which is keyed by the part
    // somebody plays, has to be read through `role` as well as through the
    // id. He came out of the folk pool as Ivan until it was.
    const names = nameCast([{ id: "city-clockmaker", role: "clockmaker" }]);
    expect(names.get("city-clockmaker")).toBe(NAMED_PEOPLE.clockmaker);
  });

  test("but a part seven people play does not", () => {
    // The opposite case, and the reason the rule above is not simply "read
    // the role": the city's shops all say `shopkeeper`, and the village's
    // Mira is not standing behind any of them.
    const names = nameCast([
      { id: "city-store-0-keeper", role: "shopkeeper" },
      { id: "city-store-1-keeper", role: "shopkeeper" },
    ]);
    const said = [names.get("city-store-0-keeper"), names.get("city-store-1-keeper")];
    expect(said).not.toContain(NAMED_PEOPLE.shopkeeper);
    expect(new Set(said).size).toBe(2);
  });

  test("nobody hand-named is in a pool as well", () => {
    const byHand = new Set<string>(Object.values(NAMED_PEOPLE));
    expect([...KEEPER_NAMES, ...FOLK_NAMES].filter((name) => byHand.has(name))).toEqual([]);
  });

  test("a person keeps their name when their world is built again", () => {
    const once = nameCast(castOf(7));
    const again = nameCast(castOf(7));
    expect([...again.entries()].sort()).toEqual([...once.entries()].sort());
  });
});

describe("the pools themselves", () => {
  test("hold no repeats", () => {
    expect(new Set(KEEPER_NAMES).size).toBe(KEEPER_NAMES.length);
    expect(new Set(FOLK_NAMES).size).toBe(FOLK_NAMES.length);
  });

  // The names are the same in every language, so every one of them has to be
  // a word all three can print and a child can read. Anything outside plain
  // ASCII letters is a name somebody's keyboard, font or reading age is going
  // to trip over — see the note at the top of names.ts.
  test("are spelled in letters every language shares", () => {
    const all = [...Object.values(NAMED_PEOPLE), ...KEEPER_NAMES, ...FOLK_NAMES];
    expect(all.filter((name) => !/^[A-Z][a-z]+$/.test(name))).toEqual([]);
  });
});
