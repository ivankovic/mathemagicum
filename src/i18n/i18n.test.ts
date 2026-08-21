// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { LANGUAGES, Language } from "../settings";
import { INTRO_BEATS, IntroBeat } from "../ui/intro";
import { AnimalKind } from "../world/animals";
import { FixtureType, PLACEABLE_FIXTURES } from "../world/fixtures";
import { INTERIOR_ROOMS } from "../world/interiors";
import { PLANT_STAGES, PLANT_TYPES, PlantStage, PlantType } from "../world/plants";
import { TERRAIN_TYPES } from "../world/terrain";
import { DE } from "./de";
import { EN } from "./en";
import { phrasesFor } from "./index";
import type { Phrases } from "./phrases";

/**
 * One line of text out of every phrase there is.
 *
 * Written by hand rather than reflected over, because a phrase takes the
 * arguments it takes — and the key-coverage test below then insists this
 * list stays complete, so a phrase added without a sample fails rather than
 * quietly going unchecked in every language.
 */
function sample(p: Phrases): Record<string, string> {
  const carrot = PlantType.Carrot;
  const fence = FixtureType.Fence;
  return {
    plant: p.plant(carrot).bare,
    fixture: p.fixture(fence).bare,
    item: p.item(carrot).plural,
    stage: p.stage(PlantStage.Mature),
    terrain: p.terrain("grass"),
    room: p.room("barn"),
    animal: p.animal(AnimalKind.Chicken).bare,
    count: p.count(carrot, 3),

    nothingGrowsIndoors: p.nothingGrowsIndoors,
    noRoomToPlant: p.noRoomToPlant,
    alreadyPlanted: p.alreadyPlanted,
    wrongGround: p.wrongGround(carrot, "sand"),
    planted: p.planted(carrot),
    faceToGrow: p.faceToGrow,
    alreadyGrown: p.alreadyGrown(carrot),
    grownTo: p.grownTo(carrot, PlantStage.Mature),
    picked: p.picked(carrot, 3),
    notRipe: p.notRipe(carrot),
    faceToPick: p.faceToPick,

    notInHere: p.notInHere,
    notYours: p.notYours(FixtureType.Well),
    noneLeft: p.noneLeft(fence),
    noRoomThere: p.noRoomThere,
    somethingGrowing: p.somethingGrowing,
    putDown: p.putDown(fence),
    tooFarToReach: p.tooFarToReach,
    pickedUp: p.pickedUp(fence, 2),

    spellFades: p.spellFades,
    nothingToClear: p.nothingToClear,
    willNotClear: p.willNotClear,
    cleared: p.cleared,
    tooFarToSpeak: p.tooFarToSpeak,
    tooFarFromLandmark: p.tooFarFromLandmark,
    cannotWalkThere: p.cannotWalkThere,
    greatTreeGreeting: p.greatTreeGreeting,
    lighthouseGreeting: p.lighthouseGreeting,
    clockTowerGreeting: p.clockTowerGreeting,
    arrayUntaught: p.arrayUntaught,
    arrayTaught: p.arrayTaught,
    groveAsks: p.groveAsks({ task: "growing", standing: 0, ripe: 4, squares: 12 }),
    groveTaskTitle: p.groveTaskTitle,
    groveBargain: p.groveBargain,
    animalAsks: p.animalAsks(AnimalKind.Chicken, carrot),
    animalFed: p.animalFed(AnimalKind.Rabbit, carrot),
    animalFull: p.animalFull(AnimalKind.Duck),
    animalNotHungry: p.animalNotHungry(AnimalKind.Rabbit),
    animalTooFar: p.animalTooFar(AnimalKind.Cat),
    groveLessonTitle: p.groveLessonTitle,
    groveRune: p.groveRune,
    groveRows: p.groveRows(4, 6),
    groveCount: p.groveCount(4, 6, 24),
    groveTurn: p.groveTurn(4, 6, 24),
    arrayTitle: p.arrayTitle(4, 6),
    arrayMarkOut: p.arrayMarkOut,
    arrayTooSmall: p.arrayTooSmall,
    arrayNothingToDo: p.arrayNothingToDo,
    arrayChooseAction: p.arrayChooseAction,
    patchAction: p.patchAction("plant", 6),
    patchDone: p.patchDone("grow", 6),
    arrayAsk: p.arrayAsk,
    noRoomForArray: p.noRoomForArray(4, 6),
    arrayHintRows: p.arrayHintRows(6, 2),
    arrayPlanted: p.arrayPlanted("carrot", 24),
    entered: p.entered("barn"),

    titleTagline: p.titleTagline,
    titleLoading: p.titleLoading,
    titlePlay: p.titlePlay,

    mapTitle: p.mapTitle,
    mapYouAreHere: p.mapYouAreHere,
    placeName: p.placeName("harbour"),

    hourglassTitle: p.hourglassTitle,
    hourglassAsk: p.hourglassAsk,
    hourglassLeft: p.hourglassLeft,
    hourglassBack: p.hourglassBack,
    hourglassCountOn: p.hourglassCountOn(3),
    hourglassSolved: p.hourglassSolved(5),
    hourglassNoTime: p.hourglassNoTime,
    hourglassNothingGrowing: p.hourglassNothingGrowing,
    hourglassUntaught: p.hourglassUntaught,
    hourglassTaught: p.hourglassTaught,
    astronomerGreeting: p.astronomerGreeting,
    astronomerAsks: p.astronomerAsks(3, 3),
    astronomerBlocked: p.astronomerBlocked,
    starChartRead: p.starChartRead,
    hourglassGrew: p.hourglassGrew(5),
    purseTier: p.purseTier(3, "7,50 kn"),
    purseEmpty: p.purseEmpty,

    optionsButton: p.optionsButton,
    optionsTitle: p.optionsTitle,
    languageHeading: p.languageHeading,
    cropSellsFor: p.cropSellsFor("2,50 kn"),

    storeTitle: p.storeTitle("50,00 kn"),
    storeFooter: p.storeFooter,
    sheBuys: p.sheBuys,
    sheSells: p.sheSells,
    stockRow: p.stockRow(fence, "5,00 kn"),
    cropRow: p.cropRow(carrot, 3, "2,50 kn"),
    buyTitle: p.buyTitle(fence, 3, "15,00 kn"),
    sellTitle: p.sellTitle(carrot, 3, "7,50 kn"),
    onTheCounter: p.onTheCounter("5,00 kn"),
    moreToGo: p.moreToGo("5,00 kn"),
    tooMuch: p.tooMuch("5,00 kn"),
    exactlyRight: p.exactlyRight,
    tooExpensive: p.tooExpensive,
    paidFor: p.paidFor(fence, 3),
    sheCountsOut: p.sheCountsOut,
    countHerCoins: p.countHerCoins,
    back: p.back,
    pay: p.pay,
    done: p.done,
    clear: p.clear,
    thatsRight: p.thatsRight,
    thatsWrong: p.thatsWrong,

    verdictExact: p.verdictExact("7,50 kn"),
    verdictSpotted: p.verdictSpotted("7,00 kn", "7,50 kn", true),
    verdictWasRight: p.verdictWasRight("7,50 kn"),
    verdictLookAgain: p.verdictLookAgain("7,00 kn", "7,50 kn"),

    postmanGreeting: p.postmanGreeting,
    introTitle: p.introTitle,
    intro: p.intro(IntroBeat.Seeds),
    teacherGreeting: p.teacherGreeting,
    lessonTitle: p.lessonTitle,
    lessonRune: p.lessonRune,
    lessonSplit: p.lessonSplit(114, [100, 10, 4]),
    lessonJump: p.lessonJump(148, [4, 10, 100]),
    lessonAnswer: p.lessonAnswer(262),
    lessonNext: p.lessonNext,
    lessonBack: p.lessonBack,
    lessonDone: p.lessonDone,
    lessonExample: p.lessonExample(148, 114),

    playersTitle: p.playersTitle,
    newPlayer: p.newPlayer,
    makePlayerTitle: p.makePlayerTitle,
    namePrompt: p.namePrompt,
    skinHeading: p.skinHeading,
    hairHeading: p.hairHeading,
    shirtHeading: p.shirtHeading,
    bodyHeading: p.bodyHeading,
    startPlaying: p.startPlaying,
    neverMind: p.neverMind,
    deviceFull: p.deviceFull(8),
    deletePlayer: p.deletePlayer,
    deleteAreYouSure: p.deleteAreYouSure("Mia"),
    deleteYes: p.deleteYes,
    deleteNo: p.deleteNo,
    worldRebuilt: p.worldRebuilt,
    sumsHeading: p.sumsHeading,

    geometerGreeting: p.geometerGreeting,
    portalUntaught: p.portalUntaught,
    portalTaught: p.portalTaught,
    geometryLessonTitle: p.geometryLessonTitle,
    geometryRune: p.geometryRune,
    geometryRuler: p.geometryRuler(50),
    geometryLegs: p.geometryLegs(p.portalCompass("east"), 4, p.portalCompass("north"), 3, 7),
    geometryCrow: p.geometryCrow(4, 3, 25, 5),

    portalTitle: p.portalTitle,
    portalChoose: p.portalChoose,
    portalLocked: p.portalLocked,
    portalHereAlready: p.portalHereAlready,
    portalScale: p.portalScale(50),
    portalAskCount: p.portalAskCount,
    portalAskRead: p.portalAskRead(p.portalCompass("east")),
    portalAskAdd: p.portalAskAdd,
    portalAskCrow: p.portalAskCrow,
    portalCompass: p.portalCompass("north"),
    portalHintCount: p.portalHintCount(9),
    portalHintRead: p.portalHintRead(p.portalCompass("west"), 6),
    portalHintLegs: p.portalHintLegs(p.portalCompass("east"), 6, p.portalCompass("north"), 3),
    portalHintCrow: p.portalHintCrow(6, 3, 45),
    portalArrived: p.portalArrived(p.placeName("harbour")),

    place: p.place(0),
    jumpPrompt: p.jumpPrompt(0),
    addPlace: p.addPlace(1, 234),
    sumQuestion: p.sumQuestion(234, 5),
  };
}

const BOOKS: [string, Phrases][] = [
  ["English", EN],
  ["German", DE],
];

describe("every room the game can put you in has a name in every language", () => {
  // Not part of the phrase sample above, because a room name is a lookup
  // rather than a phrase — which is exactly why it needs its own check: the
  // lookups fall back to the English key, so a room added without a German
  // name says "Stadthaus" in English and "townhouse" in German, and nothing
  // anywhere fails.
  for (const language of LANGUAGES) {
    const words = phrasesFor(language);
    for (const room of INTERIOR_ROOMS) {
      test(`${language} names the ${room}`, () => {
        const name = words.room(room);
        expect({ room, named: name.length > 0 }).toEqual({ room, named: true });
        if (language !== Language.English) {
          expect({ room, translated: name !== EN.room(room) }).toEqual({ room, translated: true });
        }
      });
      test(`${language} can say you walked into the ${room}`, () => {
        expect(words.entered(room)).toContain(words.room(room));
      });
    }
  }
});

describe("every language says everything", () => {
  // The sample list is what the rest of these tests run over, so it has to
  // cover the interface; a phrase added without one would be checked nowhere.
  test("the sample covers every phrase there is", () => {
    expect(Object.keys(sample(EN)).sort()).toEqual(Object.keys(EN).sort());
  });

  for (const [name, book] of BOOKS) {
    test(`${name} has real text everywhere`, () => {
      for (const [key, line] of Object.entries(sample(book))) {
        expect(`${key}: ${line}`).not.toContain("undefined");
        expect(line.trim().length).toBeGreaterThan(0);
      }
    });

    test(`${name} names every plant, fixture, terrain and stage`, () => {
      for (const plant of PLANT_TYPES) expect(book.plant(plant).plural.length).toBeGreaterThan(0);
      for (const fixture of Object.values(FixtureType)) {
        expect(book.fixture(fixture).indefinite.length).toBeGreaterThan(0);
      }
      for (const terrain of TERRAIN_TYPES) expect(book.terrain(terrain).length).toBeGreaterThan(0);
      for (const stage of PLANT_STAGES) expect(book.stage(stage).length).toBeGreaterThan(0);
    });
  }

  // What a half-finished translation looks like: a German build with English
  // sentences in it. Only the sum question is legitimately identical — it is
  // digits and a plus sign, which every language here writes the same way.
  test("German is actually German", () => {
    const en = sample(EN);
    const de = sample(DE);
    // Both are numbers and a plus sign, which every language here writes the
    // same way — and "Portal" is the same word in both, the way a currency's
    // name is.
    // `arrayTitle` is `4 × 6` in both, because a multiplication sign is not
    // a word in either language.
    const shared = ["sumQuestion", "lessonExample", "portalTitle", "arrayTitle"];
    for (const [key, line] of Object.entries(de)) {
      if (shared.includes(key)) continue;
      expect(`${key}: ${line}`).not.toBe(`${key}: ${en[key]}`);
    }
  });
});

describe("the welcome", () => {
  // The tour is keyed by beat, so a beat added without words would show an
  // empty page — in one language, quite possibly not the one being tested.
  test("every language has a page for every beat of it", () => {
    for (const [name, book] of BOOKS) {
      for (const beat of INTRO_BEATS) {
        expect({ name, beat, said: book.intro(beat).length > 0 }).toEqual({
          name,
          beat,
          said: true,
        });
      }
    }
  });

  test("the two languages say different things on every page", () => {
    for (const beat of INTRO_BEATS) {
      expect(DE.intro(beat)).not.toBe(EN.intro(beat));
    }
  });
});

describe("counting things", () => {
  test("English pluralises, including the awkward one", () => {
    expect(EN.count(PlantType.Carrot, 1)).toBe("1 carrot");
    expect(EN.count(PlantType.Carrot, 3)).toBe("3 carrots");
    expect(EN.count(PlantType.Cactus, 1)).toBe("1 cactus");
    expect(EN.count(PlantType.Cactus, 2)).toBe("2 cactuses");
    expect(EN.count(FixtureType.Fence, 3)).toBe("3 fences");
    expect(EN.count(PlantType.Carrot, 0)).toBe("0 carrots");
  });

  // German plurals are not a suffix rule, which is why they are written out.
  test("German pluralises by hand", () => {
    expect(DE.count(PlantType.Carrot, 3)).toBe("3 Karotten");
    expect(DE.count(PlantType.Cactus, 2)).toBe("2 Kakteen");
    expect(DE.count(FixtureType.Fence, 2)).toBe("2 Zäune");
    expect(DE.count(FixtureType.Lamp, 1)).toBe("1 Laterne");
  });

  // The astronomer counts down to one, and one is the line a child sees at
  // the end of her task — the one place a stray plural would land.
  test("the astronomer's last lamp is singular in both languages", () => {
    expect(EN.astronomerAsks(1, 1)).toBe(
      "One lamp still to set on the path. Here is one — put it on the empty post.",
    );
    expect(EN.astronomerAsks(2, 0)).toBe("2 lamps still to set on the path.");
    expect(DE.astronomerAsks(1, 1)).toContain("Eine Laterne fehlt");
    expect(DE.astronomerAsks(1, 1)).not.toContain("Laternen");
  });
});

describe("German grammar", () => {
  // The whole reason nouns carry their forms: the article follows the noun's
  // gender, and a sentence that guessed would get one in three wrong.
  test("articles follow the noun's gender", () => {
    expect(DE.plant(PlantType.Carrot).definite).toBe("die Karotte");
    expect(DE.plant(PlantType.Cactus).definite).toBe("der Kaktus");
    expect(DE.fixture(FixtureType.Fence).indefinite).toBe("einen Zaun");
    expect(DE.fixture(FixtureType.Lamp).indefinite).toBe("eine Laterne");
    expect(DE.fixture(FixtureType.Fence).none).toBe("keinen Zaun");
    expect(DE.plant(PlantType.Carrot).none).toBe("keine Karotte");
  });

  // German capitalises the first word of a sentence like every language, and
  // the noun forms are stored lowercase for the middle of one.
  test("a sentence that opens with a noun opens with a capital", () => {
    for (const line of [
      DE.planted(PlantType.Carrot),
      DE.picked(PlantType.Carrot, 1),
      DE.putDown(FixtureType.Fence),
      DE.pickedUp(FixtureType.Fence, 1),
      DE.notRipe(PlantType.Carrot),
    ]) {
      expect(line[0]).toBe(line[0]?.toUpperCase() as string);
    }
  });

  test("sentences read as German, not as English word order", () => {
    expect(DE.planted(PlantType.Cactus)).toContain("Einen Kaktus gepflanzt");
    expect(DE.noneLeft(FixtureType.Fence)).toContain("keinen Zaun");
    expect(DE.entered("barn")).toContain("in der Scheune");
  });

  // Every placeable thing turns up in "put down a …" and "you have no …".
  test("everything the shop sells has both forms", () => {
    for (const fixture of PLACEABLE_FIXTURES) {
      expect(DE.putDown(fixture)).not.toContain("undefined");
      expect(DE.noneLeft(fixture)).not.toContain("undefined");
    }
  });
});

describe("picking a book", () => {
  test("each language gets its own", () => {
    expect(phrasesFor(Language.English)).toBe(EN);
    expect(phrasesFor(Language.German)).toBe(DE);
  });

  test("an unknown language falls back to English rather than to nothing", () => {
    expect(phrasesFor("kl" as Language)).toBe(EN);
  });
});
