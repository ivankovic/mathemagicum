// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import catSidecar from "../../public/assets/animals/cat.json";
import chickenSidecar from "../../public/assets/animals/chicken.json";
import duckSidecar from "../../public/assets/animals/duck.json";
import rabbitSidecar from "../../public/assets/animals/rabbit.json";
import {
  ANIMAL_KINDS,
  ANIMAL_MENU,
  ANIMAL_RANGE,
  AnimalKind,
  animalSheetKey,
  animalSidecarKey,
  animalSpots,
} from "./animals";
import type { PlacedObject } from "./objects";
import { PLANT_DEFINITIONS, PlantType } from "./plants";
import { createRng } from "./rng";
import type { CharacterSidecar } from "./spriteSidecar";

const SHIPPED: Record<string, CharacterSidecar> = {
  chicken: chickenSidecar as unknown as CharacterSidecar,
  duck: duckSidecar as unknown as CharacterSidecar,
  cat: catSidecar as unknown as CharacterSidecar,
  rabbit: rabbitSidecar as unknown as CharacterSidecar,
};

const at = (id: string, col: number, row: number): PlacedObject => ({
  id,
  type: "cottage",
  col,
  row,
  width: 3,
  height: 3,
  blocksMovement: true,
  anchorCol: col,
  anchorRow: row,
});

const WELL = at("well", 100, 100);
const HOUSES = [at("a", 92, 96), at("b", 108, 96), at("c", 92, 108), at("d", 108, 108)];

describe("the art the game asks for", () => {
  // A kind the loader knows and the art does not is a lime-green box where a
  // chicken should be.
  test("every kind the game names has a sheet shipped for it", () => {
    for (const kind of ANIMAL_KINDS) {
      expect(SHIPPED[kind]).toBeDefined();
      expect(SHIPPED[kind]?.sheet?.file).toBe(`${kind}_sheet.png`);
    }
    expect(Object.keys(SHIPPED).sort()).toEqual([...ANIMAL_KINDS].sort());
  });

  // They are loaded and animated by the code that loads and animates people,
  // so they have to name their animations the way people do.
  test("their sheets name idle and walk in all four facings, like a villager's", () => {
    for (const kind of ANIMAL_KINDS) {
      const animations = SHIPPED[kind]?.animations ?? {};
      for (const facing of ["down", "up", "left", "right"]) {
        expect({ kind, facing, idle: `idle_${facing}` in animations }).toEqual({
          kind,
          facing,
          idle: true,
        });
        expect({ kind, facing, walk: `walk_${facing}` in animations }).toEqual({
          kind,
          facing,
          walk: true,
        });
      }
    }
  });

  // An animal stands on four legs and fits its own cell; a person's head
  // rises into the one above, which is why theirs carries an offset.
  test("an animal fits its own tile, with no overhang to draw above it", () => {
    for (const kind of ANIMAL_KINDS) {
      expect({ kind, y: SHIPPED[kind]?.sprite_offset_px?.y }).toEqual({ kind, y: 0 });
    }
  });

  test("keys are namespaced away from the cast's", () => {
    for (const kind of ANIMAL_KINDS) {
      expect(animalSheetKey(kind)).toContain(kind);
      expect(animalSheetKey(kind)).not.toBe(animalSidecarKey(kind));
      expect(animalSheetKey(kind)).not.toContain("character");
    }
  });
});

describe("where a village's animals start", () => {
  const spots = (seed = 1) => animalSpots(WELL, HOUSES, createRng(seed));

  test("a village gets several of each kind", () => {
    const kinds = new Set(spots().map((spot) => spot.kind));
    expect(kinds.size).toBe(ANIMAL_KINDS.length);
    expect(spots().length).toBeGreaterThan(ANIMAL_KINDS.length);
  });

  // Same village, same animals. A chicken that moved house every time the
  // world was generated would not be that house's chicken.
  test("the same seed grows the same animals in the same places", () => {
    expect(spots(7)).toEqual(spots(7));
    expect(spots(7)).not.toEqual(spots(8));
  });

  // What makes a chicken near a house read as that house's chicken.
  test("birds and cats start near the buildings", () => {
    const near = (point: { col: number; row: number }) =>
      Math.min(
        ...HOUSES.map((house) =>
          Math.max(Math.abs(house.col - point.col), Math.abs(house.row - point.row)),
        ),
      );
    for (const spot of spots()) {
      if (spot.kind === AnimalKind.Rabbit) continue;
      expect({ kind: spot.kind, near: near(spot.at) <= 8 }).toEqual({
        kind: spot.kind,
        near: true,
      });
    }
  });

  // A rabbit sitting on somebody's doorstep is a pet, and these are not pets.
  test("rabbits keep further out than the rest", () => {
    const spread = (kind: AnimalKind) => {
      const own = spots(3).filter((spot) => spot.kind === kind);
      return Math.max(
        ...own.map((spot) =>
          Math.max(Math.abs(spot.at.col - WELL.col), Math.abs(spot.at.row - WELL.row)),
        ),
      );
    };
    expect(spread(AnimalKind.Rabbit)).toBeGreaterThan(spread(AnimalKind.Chicken));
  });

  test("they are spread out rather than piled on one tile", () => {
    const seen = new Set(spots().map((spot) => `${spot.at.col},${spot.at.row}`));
    expect(seen.size).toBeGreaterThan(spots().length / 2);
  });

  // Every one of these positions is a suggestion the scene may drop, so a
  // village with nothing in it must still answer rather than throw.
  test("a village with only a well still gets animals", () => {
    expect(animalSpots(WELL, [], createRng(2)).length).toBeGreaterThan(0);
  });
});

describe("how far they stray", () => {
  // A villager's circuit is five tiles. An animal that ranged as far as a
  // person would stop reading as belonging anywhere.
  test("every kind keeps a short circuit", () => {
    for (const kind of ANIMAL_KINDS) {
      expect(ANIMAL_RANGE[kind]).toBeGreaterThan(0);
      expect(ANIMAL_RANGE[kind]).toBeLessThanOrEqual(6);
    }
  });

  test("cats go further than birds, because cats go further than birds", () => {
    expect(ANIMAL_RANGE[AnimalKind.Cat]).toBeGreaterThan(ANIMAL_RANGE[AnimalKind.Chicken]);
  });
});

describe("what they are hungry for", () => {
  /**
   * A cactus only grows on sand, the village has none, and an animal asking
   * for one is a bubble that never clears. Every other crop is on somebody's
   * menu, or it is a crop a child can grow and never be asked for.
   */
  test("nobody asks for a cactus, and everything else is asked for", () => {
    const asked = new Set(Object.values(ANIMAL_MENU).flat());
    expect(asked.has(PlantType.Cactus)).toBe(false);
    for (const plant of Object.keys(PLANT_DEFINITIONS) as PlantType[]) {
      if (plant === PlantType.Cactus) continue;
      expect({ plant, asked: asked.has(plant) }).toEqual({ plant, asked: true });
    }
  });

  // More than one, so two chickens in the same village are not the same
  // errand — and a rabbit's list opens with the one pairing every picture
  // book has already taught a child.
  test("every kind has a menu, and a rabbit's starts with a carrot", () => {
    for (const kind of ANIMAL_KINDS) {
      expect({ kind, choices: ANIMAL_MENU[kind].length > 1 }).toEqual({ kind, choices: true });
      expect(new Set(ANIMAL_MENU[kind]).size).toBe(ANIMAL_MENU[kind].length);
    }
    expect(ANIMAL_MENU[AnimalKind.Rabbit][0]).toBe(PlantType.Carrot);
  });

  /**
   * Drawn from the seed with the position, so the game records nothing and a
   * reload brings back the same village wanting the same things. A craving
   * picked in the scene would be a new one every time the page was opened.
   */
  test("what each one wants comes out of the seed, from its own kind's menu", () => {
    const spots = animalSpots(WELL, HOUSES, createRng(9));
    const again = animalSpots(WELL, HOUSES, createRng(9));
    expect(spots.map((spot) => spot.wants)).toEqual(again.map((spot) => spot.wants));
    for (const spot of spots) {
      expect({ kind: spot.kind, onMenu: ANIMAL_MENU[spot.kind].includes(spot.wants) }).toEqual({
        kind: spot.kind,
        onMenu: true,
      });
    }
    // And they are not all the same, or the village is one errand repeated.
    expect(new Set(spots.map((spot) => spot.wants)).size).toBeGreaterThan(1);
  });
});
