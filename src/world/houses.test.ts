// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import cottageSprite from "../../public/assets/buildings/cottage.json";
import cottageRoom from "../../public/assets/interiors/cottage.json";
import { packRgb } from "../render/recolour";
import type { Rgb } from "../render/recolour";
import { MAX_PROFILES } from "../save/profiles";
import {
  FABRIC_SLOTS,
  LIGHTING_SPREAD,
  PLAYER_HOUSE_ID,
  ROOF_SLOTS,
  VARYING_SPRITES,
  WALL_SLOTS,
  houseLook,
  lightingDelay,
  rampOf,
  roomSlotsFor,
  slotsFor,
  varies,
  windowBrightness,
} from "./houses";
import { whoLivesIn } from "./houses";
import { HOUSE_IDS, houseIdFor, isHouseId } from "./villageLayout";

const SPRITE = cottageSprite as unknown as {
  palette: Record<string, Rgb>;
  roof_options: Rgb[][];
};
const ROOM = cottageRoom as unknown as {
  palette: Record<string, Rgb>;
  fabric_options: Rgb[][];
};

const VILLAGER_HOUSES = ["villager-house-1", "villager-house-2", "villager-house-3"];

describe("the art the repaint needs", () => {
  test("the cottage ships a palette naming its roof, and roofs to swap in", () => {
    expect(rampOf(SPRITE.palette, ROOF_SLOTS)).not.toBeNull();
    expect(SPRITE.roof_options.length).toBeGreaterThan(VILLAGER_HOUSES.length);
  });

  test("its room ships a palette naming its bedding, and bedding to swap in", () => {
    expect(rampOf(ROOM.palette, FABRIC_SLOTS)).not.toBeNull();
    expect(ROOM.fabric_options.length).toBeGreaterThan(VILLAGER_HOUSES.length);
  });

  // A repaint is a lookup by exact pixel value, so a slot sharing a colour
  // with another would mean moving one moves the other.
  test("no two slots of either palette share a colour", () => {
    for (const palette of [SPRITE.palette, ROOM.palette]) {
      const packed = Object.values(palette).map(packRgb);
      expect(new Set(packed).size).toBe(packed.length);
    }
  });

  // A roof tone that happened to equal the doorway would repaint the hole in
  // the wall along with the tiles.
  test("nothing a house may be repainted with collides with the rest of it", () => {
    const check = (palette: Record<string, Rgb>, slots: readonly string[], ramps: Rgb[][]) => {
      const others = new Set(
        Object.entries(palette)
          .filter(([slot]) => !slots.includes(slot))
          .map(([, colour]) => packRgb(colour)),
      );
      for (const ramp of ramps) {
        for (const tone of ramp) expect(others.has(packRgb(tone))).toBe(false);
      }
    };
    check(SPRITE.palette, ROOF_SLOTS, SPRITE.roof_options);
    check(ROOM.palette, FABRIC_SLOTS, ROOM.fabric_options);
  });

  // So a house that takes option zero is pixel for pixel the house the game
  // has always drawn.
  test("the first option of each is what the cottage already wears", () => {
    expect(SPRITE.roof_options[0]?.map(packRgb)).toEqual(
      (rampOf(SPRITE.palette, ROOF_SLOTS) ?? []).map(packRgb),
    );
    expect(ROOM.fabric_options[0]?.map(packRgb)).toEqual(
      (rampOf(ROOM.palette, FABRIC_SLOTS) ?? []).map(packRgb),
    );
  });

  test("a palette missing the slots asked for is refused rather than half-read", () => {
    expect(rampOf({}, ROOF_SLOTS)).toBeNull();
    expect(rampOf({ roof: [1, 2, 3] } as never, ROOF_SLOTS)).toBeNull();
  });
});

describe("which house wears which look", () => {
  const options = SPRITE.roof_options.length;

  // "Meet me at the green one" has to be reliable.
  test("a house keeps its look across every load of the same world", () => {
    for (const id of VILLAGER_HOUSES) {
      expect(houseLook(id, 4242, options)).toBe(houseLook(id, 4242, options));
    }
  });

  // The whole point: a village where two of the four are the same house is
  // the village this was meant to fix.
  test("no two houses in one village look alike", () => {
    for (const seed of [1, 7, 99, 123456, 2 ** 30]) {
      const looks = [PLAYER_HOUSE_ID, ...VILLAGER_HOUSES].map((id) => houseLook(id, seed, options));
      expect({ seed, distinct: new Set(looks).size }).toEqual({ seed, distinct: looks.length });
    }
  });

  // Their home is the one building they need to find from a distance without
  // thinking, and a house that changed colour between worlds would be a
  // landmark that is not one.
  test("the player's own house is always the same one", () => {
    for (const seed of [1, 7, 99, 123456]) {
      expect(houseLook(PLAYER_HOUSE_ID, seed, options)).toBe(0);
    }
  });

  test("and nobody else ever takes it", () => {
    for (let seed = 0; seed < 400; seed++) {
      for (const id of VILLAGER_HOUSES) {
        expect({ seed, id, look: houseLook(id, seed, options) > 0 }).toEqual({
          seed,
          id,
          look: true,
        });
      }
    }
  });

  // Two villages that happen to have the same house names — which is every
  // pair of villages, since the names come from the layout rather than the
  // seed — should still not be the same street twice.
  test("two worlds paint their houses differently", () => {
    const village = (seed: number) => VILLAGER_HOUSES.map((id) => houseLook(id, seed, options));
    const seen = new Set(
      Array.from({ length: 60 }, (_, seed) => JSON.stringify(village(seed * 7919 + 1))),
    );
    expect(seen.size).toBeGreaterThan(1);
  });

  test("a look is always one the art can actually draw", () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const id of [PLAYER_HOUSE_ID, ...VILLAGER_HOUSES]) {
        const look = houseLook(id, seed, options);
        expect(Number.isInteger(look)).toBe(true);
        expect(look).toBeGreaterThanOrEqual(0);
        expect(look).toBeLessThan(options);
      }
    }
  });

  test("art with nothing to choose between is not a crash", () => {
    expect(houseLook("villager-house-1", 5, 0)).toBe(0);
    expect(houseLook("villager-house-1", 5, 1)).toBe(0);
  });
});

describe("which buildings vary at all", () => {
  // The ones there are many of, and only those. Four cottages in the
  // village, twenty townhouses in the city, a hull at every pier of the
  // harbour, and — since a playtest counted them — eight shops between the
  // city and the quay. There is still one school and one post office, and
  // nothing about either needs telling apart because there is nothing to
  // tell it apart from.
  test("only the shapes there are many of", () => {
    expect(varies("cottage")).toBe(true);
    expect(varies("townhouse")).toBe(true);
    expect(varies("ship")).toBe(true);
    expect(varies("barn")).toBe(true);
    for (const sprite of ["tower", "schoolhouse", "observatory"]) {
      expect({ sprite, varies: varies(sprite) }).toEqual({ sprite, varies: false });
    }
  });

  test("the shapes that vary are the ones there are many of", () => {
    expect([...VARYING_SPRITES].sort()).toEqual(["barn", "cottage", "ship", "townhouse"]);
  });

  /**
   * And the store varies its walls where a house varies its roof.
   *
   * The generator's own note is that roofs carry the saturation and are what
   * identifies a building type at a glance — the barn is blue, the tower
   * purple, the school teal. Repainting a shop's roof would not be variety,
   * it would be deleting the thing that says *shop* to a child crossing a
   * city. Walls carry none of that meaning and are most of the front, so
   * that is what moves.
   *
   * Held here rather than left to a comment because it is the sort of thing
   * a later hand tidies into "everything varies its roof".
   */
  test("and the store varies its walls, so a shop still looks like a shop", () => {
    expect(slotsFor("barn")).toEqual([...WALL_SLOTS]);
    for (const sprite of ["cottage", "townhouse", "ship"]) {
      expect({ sprite, slots: slotsFor(sprite) }).toEqual({ sprite, slots: [...ROOF_SLOTS] });
    }
    // And the ramps they are repainted with really are in the art, whichever
    // slot they land in: a shape that varies a ramp the sheet never shipped
    // is a shape that silently does not vary.
    expect(WALL_SLOTS.length).toBe(ROOF_SLOTS.length);
  });

  /**
   * And the same again for the room behind the door.
   *
   * A house varies its bedding and its rug; a shop varies its walls, because
   * a warehouse has no soft furnishings at all. Its room is barrels, crates
   * and a counter, so a fabric ramp would be a recolour of pixels that are
   * not there — which would answer *the shops look exactly the same once you
   * go in* on paper and not on screen.
   */
  test("and a shop repaints the walls of its room, where a house repaints its bedding", () => {
    expect(roomSlotsFor("barn")).toEqual([...WALL_SLOTS]);
    for (const room of ["cottage", "townhouse", "ship"]) {
      expect({ room, slots: roomSlotsFor(room) }).toEqual({ room, slots: [...FABRIC_SLOTS] });
    }
  });

  /**
   * The ship changed sides, so it is worth saying why out loud.
   *
   * She was one of a kind while the world held one moored hull, and the rule
   * above is exactly the argument for leaving her alone then. The harbour
   * has traffic now — see `shipping.ts` — and four identical hulls at four
   * piers read as one hull drawn four times, which is the failure the rule
   * exists to prevent rather than an exception to it.
   */
  test("and the ship is one of them, now that there is more than one", () => {
    expect(varies("ship")).toBe(true);
  });
});

describe("lighting up at dusk", () => {
  /**
   * The guarantee that keeps a late house from reading as a broken one.
   * Whoever lights last, everybody is lit by the time it is properly dark.
   */
  test("every house is burning once the night is fully down", () => {
    for (const id of ["player-house", "villager-house-1", "city-townhouse-17", "x"]) {
      expect(windowBrightness(1, lightingDelay(id, 4242))).toBe(1);
    }
  });

  test("and none of them before the light starts going", () => {
    expect(windowBrightness(0, 0)).toBe(0);
    expect(windowBrightness(0, 0.3)).toBe(0);
  });

  // The whole point: not all at once. A square of windows coming on together
  // reads as a switch being thrown rather than as evening.
  test("they do not all light at the same moment", () => {
    const ids = Array.from({ length: 20 }, (_, n) => `city-townhouse-${n}`);
    const delays = new Set(ids.map((id) => lightingDelay(id, 4242)));
    expect(delays.size).toBeGreaterThan(5);
  });

  test("nobody waits longer than the spread", () => {
    for (let n = 0; n < 200; n++) {
      const delay = lightingDelay(`house-${n}`, 7);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThan(LIGHTING_SPREAD);
    }
  });

  // Same house, same world, same evening — every time it is loaded.
  test("a house lights at the same moment every time the world is opened", () => {
    expect(lightingDelay("villager-house-2", 99)).toBe(lightingDelay("villager-house-2", 99));
    expect(lightingDelay("villager-house-2", 99)).not.toBe(lightingDelay("villager-house-2", 100));
  });
});

describe("who lives where", () => {
  /**
   * The check that keeps the nameplates honest.
   *
   * `freeHouse` hands a new child the lowest number nobody has, and
   * `readProfile` clamps a saved one to `MAX_PROFILES - 1`. If there were
   * ever more profiles than houses, a real saved child would have a house
   * number pointing at nothing — and the failure would be a blank plate on a
   * house that is somebody's, which reads as the feature not working rather
   * than as a village one cottage short.
   */
  test("there is a house for every child a device can hold", () => {
    expect(HOUSE_IDS.length).toBe(MAX_PROFILES);
    for (let house = 0; house < MAX_PROFILES; house++) {
      expect({ house, id: houseIdFor(house) !== null }).toEqual({ house, id: true });
    }
  });

  test("and nothing past the end", () => {
    expect(houseIdFor(MAX_PROFILES)).toBeNull();
    expect(houseIdFor(-1)).toBeNull();
  });

  // The first house is the one the game has always treated as the player's:
  // the big garden, the spawn point, and the roof colour `houseLook` keeps
  // back. That is a fact about the order of `BUILDINGS`, so it is worth
  // saying out loud rather than leaving to whoever edits the array next.
  test("house zero is the one with the garden and the spawn", () => {
    expect(HOUSE_IDS[0]).toBe("player-house");
  });

  test("every house is a real building, and no two children share one", () => {
    expect(new Set(HOUSE_IDS).size).toBe(HOUSE_IDS.length);
    for (const id of HOUSE_IDS) expect(isHouseId(id)).toBe(true);
    for (const other of ["school", "store", "post-office"]) {
      expect({ other, house: isHouseId(other) }).toEqual({ other, house: false });
    }
  });
});

describe("who lives behind a door", () => {
  const villagers = [
    { homeBuildingId: "villager-home-2", character: "villager-1" },
    { homeBuildingId: "post-office", character: "postal-worker" },
  ];
  const household = [
    { house: 0, name: "Ada" },
    { house: 2, name: "Bo" },
  ];

  /**
   * Three answers, and they are not interchangeable.
   *
   * "Vacant" and "no plate at all" look the same from the outside and mean
   * opposite things: one is a house waiting for somebody and gets a question
   * mark, the other is a school and gets nothing. Collapsing them to null is
   * what put a question mark on every villager's cottage the first time.
   */
  test("a villager's cottage shows the villager", () => {
    expect(whoLivesIn("villager-home-2", villagers, household)).toEqual({
      kind: "villager",
      character: "villager-1",
    });
  });

  test("a child's house shows the child", () => {
    expect(whoLivesIn(HOUSE_IDS[0] as string, villagers, household)).toEqual({
      kind: "child",
      owner: { house: 0, name: "Ada" },
    });
    expect(whoLivesIn(HOUSE_IDS[2] as string, villagers, household)).toEqual({
      kind: "child",
      owner: { house: 2, name: "Bo" },
    });
  });

  test("a house nobody has moved into is vacant, which is not the same as nothing", () => {
    expect(whoLivesIn(HOUSE_IDS[1] as string, villagers, household)).toEqual({ kind: "vacant" });
    expect(whoLivesIn(HOUSE_IDS[3] as string, villagers, household)).toEqual({ kind: "vacant" });
  });

  test("and a building nobody could ever live in has no answer at all", () => {
    for (const other of ["school", "store", "post-office-nope", "well"]) {
      expect({ other, lives: whoLivesIn(other, [], household) }).toEqual({ other, lives: null });
    }
  });

  // The villager wins: a villager standing at the door of one of the four is
  // a state that should not arise, and if it ever does the picture should
  // agree with the person standing there rather than with a house number.
  test("somebody actually living there beats a house number", () => {
    const squatter = [{ homeBuildingId: HOUSE_IDS[0] as string, character: "villager-0" }];
    expect(whoLivesIn(HOUSE_IDS[0] as string, squatter, household)).toEqual({
      kind: "villager",
      character: "villager-0",
    });
  });

  test("an empty village houses nobody without falling over", () => {
    expect(whoLivesIn(HOUSE_IDS[0] as string, [], [])).toEqual({ kind: "vacant" });
    expect(whoLivesIn("anything", [], [])).toBeNull();
  });
});
