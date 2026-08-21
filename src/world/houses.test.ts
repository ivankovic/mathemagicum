// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import cottageSprite from "../../public/assets/buildings/cottage.json";
import cottageRoom from "../../public/assets/interiors/cottage.json";
import { packRgb } from "../render/recolour";
import type { Rgb } from "../render/recolour";
import {
  FABRIC_SLOTS,
  LIGHTING_SPREAD,
  PLAYER_HOUSE_ID,
  ROOF_SLOTS,
  VARYING_SPRITES,
  houseLook,
  lightingDelay,
  rampOf,
  varies,
  windowBrightness,
} from "./houses";

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
  // The generator's own note: roofs carry the saturation and are what
  // identifies a building type at a glance. Repainting the store's would not
  // be variety, it would be deleting the thing that says which one is the
  // shop.
  test("only houses, never the store or the school or the post office", () => {
    expect(varies("cottage")).toBe(true);
    expect(varies("townhouse")).toBe(true);
    for (const sprite of ["barn", "tower", "schoolhouse"]) {
      expect({ sprite, varies: varies(sprite) }).toEqual({ sprite, varies: false });
    }
  });

  // There is one school and one store. Nothing about them needs telling
  // apart, because there is nothing to tell them apart from. The two that do
  // vary are the two there are many of — four cottages in the village and
  // twenty townhouses in the city.
  test("the shapes that vary are the ones there are many of", () => {
    expect([...VARYING_SPRITES].sort()).toEqual(["cottage", "townhouse"]);
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
