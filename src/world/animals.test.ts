// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import catSidecar from "../../public/assets/animals/cat.json";
import chickenSidecar from "../../public/assets/animals/chicken.json";
import duckSidecar from "../../public/assets/animals/duck.json";
import rabbitSidecar from "../../public/assets/animals/rabbit.json";
import {
  ANIMAL_ASK_MAX_MS,
  ANIMAL_ASK_MIN_MS,
  ANIMAL_FED_QUIET_MS,
  ANIMAL_GLAD_MS,
  ANIMAL_KINDS,
  ANIMAL_MENU,
  ANIMAL_QUIET_MAX_MS,
  ANIMAL_QUIET_MIN_MS,
  ANIMAL_RANGE,
  AnimalKind,
  AnimalMood,
  AnimalThought,
  animalSheetKey,
  animalSidecarKey,
  animalSpots,
  firstMood,
  moodAfter,
  thoughtFor,
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

describe("when they ask", () => {
  const average = (low: number, high: number) => (low + high) / 2;
  const asking = average(ANIMAL_ASK_MIN_MS, ANIMAL_ASK_MAX_MS);
  const quiet = average(ANIMAL_QUIET_MIN_MS, ANIMAL_QUIET_MAX_MS);

  /**
   * The one number the whole cycle exists to set.
   *
   * Every animal asking at once is a checklist: a child walks one lap, clears
   * every bubble and is finished with the village. Nobody asking is eleven
   * animals with nothing to say. The ratio of asking to quiet is what puts it
   * between the two, and it is worth a test rather than a comment because it
   * is the sort of thing that gets nudged and never re-checked.
   */
  test("about three in ten of them are asking at any moment", () => {
    const share = asking / (asking + quiet);
    expect({ low: share > 0.2, high: share < 0.45 }).toEqual({ low: true, high: true });
  });

  test("each window is a range, so they never fall into step", () => {
    expect(ANIMAL_ASK_MAX_MS).toBeGreaterThan(ANIMAL_ASK_MIN_MS);
    expect(ANIMAL_QUIET_MAX_MS).toBeGreaterThan(ANIMAL_QUIET_MIN_MS);
  });

  // Ten minutes: long enough that a child cannot farm one chicken, short
  // enough that one fed at the start of an afternoon is asking by the end.
  test("a fed animal says nothing for ten minutes", () => {
    expect(ANIMAL_FED_QUIET_MS).toBe(10 * 60_000);
    expect(ANIMAL_FED_QUIET_MS).toBeGreaterThan(ANIMAL_QUIET_MAX_MS);
  });

  // The smile is a beat, not a state. Long enough to see from across the
  // square, short enough that it is over before you have walked away.
  test("the smile is brief", () => {
    expect(ANIMAL_GLAD_MS).toBeGreaterThan(800);
    expect(ANIMAL_GLAD_MS).toBeLessThan(ANIMAL_ASK_MIN_MS);
  });
});

describe("what is in the cloud over its head", () => {
  /**
   * The report this was written for: *tapping the rabbit didn't bring up any
   * food, just an empty rabbit*.
   *
   * A tap on an animal that is not asking used to put up a cloud with
   * nothing in it. Five of a village's seven animals are quiet at any
   * moment, so a child who taps two or three meets empty cloud after empty
   * cloud and files the creatures under scenery. The crop it craves says
   * what the animal is about without asking for anything.
   */
  test("a tap on a quiet one says what it likes", () => {
    expect(thoughtFor(AnimalMood.Quiet, true)).toEqual([AnimalThought.Food]);
  });

  // And untapped it says nothing at all, which is what keeps a village from
  // being a checklist a child clears in one lap.
  test("but it wears nothing while nobody is asking it", () => {
    expect(thoughtFor(AnimalMood.Quiet, false)).toEqual([]);
  });

  /**
   * The question mark is the ask, and only the ask can be fed.
   *
   * Which is why saying what it likes gives nothing away: knowing that a
   * rabbit is about carrots does not let a child hand it one, and the ten
   * quiet minutes after a meal are still ten quiet minutes.
   */
  test("the one that is asking wears the crop and the question", () => {
    expect(thoughtFor(AnimalMood.Asking, false)).toEqual([
      AnimalThought.Food,
      AnimalThought.Question,
    ]);
    // A tap on it feeds it rather than puffing a cloud, so the tapped
    // reading is the same picture either way.
    expect(thoughtFor(AnimalMood.Asking, true)).toEqual(thoughtFor(AnimalMood.Asking, false));
  });

  // The smile is the whole of what a fed animal says, tapped or not.
  test("and a fed one smiles and says nothing else", () => {
    expect(thoughtFor(AnimalMood.Glad, false)).toEqual([AnimalThought.Smile]);
    expect(thoughtFor(AnimalMood.Glad, true)).toEqual([AnimalThought.Smile]);
  });

  // Two slots, because the cloud has room for two. A third picture would be
  // drawn off the edge of the art.
  test("no cloud holds more than the two the art has room for", () => {
    for (const mood of [AnimalMood.Quiet, AnimalMood.Asking, AnimalMood.Glad]) {
      for (const tapped of [false, true]) {
        expect({ mood, tapped, fits: thoughtFor(mood, tapped).length <= 2 }).toEqual({
          mood,
          tapped,
          fits: true,
        });
      }
    }
  });
});

describe("the hunger clock", () => {
  /** A roll that always takes the middle, so a timing can be asserted. */
  const middle = (min: number, max: number) => (min + max) / 2;

  test("it goes round: asking, quiet, asking again", () => {
    const seen: string[] = [];
    let mood: AnimalMood = AnimalMood.Quiet;
    for (let turn = 0; turn < 4; turn++) {
      mood = moodAfter(mood, 0, middle, false).mood;
      seen.push(mood);
    }
    expect(seen).toEqual(["asking", "quiet", "asking", "quiet"]);
  });

  /**
   * A fed animal is quiet for a good while, and it is a *different* while.
   *
   * One that wanted a second carrot straight away would be a well, not a
   * chicken — so being glad leads somewhere other than being ignored does.
   */
  test("and a fed one is quiet for longer than an ignored one", () => {
    const fed = moodAfter(AnimalMood.Glad, 0, middle, false);
    const ignored = moodAfter(AnimalMood.Asking, 0, middle, false);
    expect(fed.mood).toBe(AnimalMood.Quiet);
    expect(ignored.mood).toBe(AnimalMood.Quiet);
    expect(fed.moodUntil).toBeGreaterThan(ignored.moodUntil);
  });

  // `?hungry` holds one asking for ever. They ask on their own clocks, which
  // is the one thing a script cannot wait out.
  test("held hungry, it never stops asking", () => {
    const asking = moodAfter(AnimalMood.Quiet, 0, middle, true);
    expect(asking).toEqual({ mood: AnimalMood.Asking, moodUntil: Number.POSITIVE_INFINITY });
    expect(firstMood(0, middle, true).moodUntil).toBe(Number.POSITIVE_INFINITY);
  });

  /**
   * Every animal starts part way through a round, not at the beginning of
   * one.
   *
   * Started at the beginning they are all quiet when the player arrives and
   * then, a minute later, all asking together — the very thing the separate
   * clocks exist to avoid.
   */
  test("they start scattered through the round, not all at its start", () => {
    const moods = new Set<string>();
    const untils = new Set<number>();
    for (let at = 0; at <= 20; at++) {
      const start = firstMood(0, (min, max) => min + ((max - min) * at) / 20, false);
      moods.add(start.mood);
      untils.add(start.moodUntil);
    }
    expect(moods).toEqual(new Set(["asking", "quiet"]));
    expect(untils.size).toBeGreaterThan(10);
  });

  test("and none of them starts already over", () => {
    for (let at = 0; at <= 20; at++) {
      const start = firstMood(1_000, (min, max) => min + ((max - min) * at) / 20, false);
      expect(start.moodUntil).toBeGreaterThanOrEqual(1_000);
    }
  });
});
