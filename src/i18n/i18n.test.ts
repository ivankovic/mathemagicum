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
    count: p.count(carrot, 3),

    cleared: p.cleared,
    groveAsks: p.groveAsks({ task: "growing", standing: 0, ripe: 4, squares: 12 }),
    groveTaskTitle: p.groveTaskTitle,
    groveBargain: p.groveBargain,
    groveLessonTitle: p.groveLessonTitle,
    groveRune: p.groveRune,
    groveRows: p.groveRows(4, 6),
    groveCount: p.groveCount(4, 6, 24),
    groveTurn: p.groveTurn(4, 6, 24),
    arrayTitle: p.arrayTitle(4, 6),
    patchAction: p.patchAction("plant", 6),
    arrayAsk: p.arrayAsk,
    arrayHintRows: p.arrayHintRows(6, 2),

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

    introTitle: p.introTitle,
    intro: p.intro(IntroBeat.Seeds),
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
    sumsHeading: p.sumsHeading,

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

  // The astronomer used to have a line here, counting her lamps down to one,
  // and it needed a singular case in two languages to say "one lamp" rather
  // than "1 lamps". She draws the lamps now — five tokens on a sheet, the
  // lit ones lit — so there is no sentence to get wrong and no plural to
  // agree with. Left as a note rather than as a test, because the thing the
  // test guarded no longer exists.
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
  //
  // There are fewer of these to check than there were, and that is the point
  // of the change that removed them: the game no longer *says* that a carrot
  // was planted, it draws a carrot rising off the square it was planted on.
  // What is left is what a picture cannot carry.
  // Only the shop writes sentences about things now, so it is the shop that
  // has to decline them. Everything else that used to — planted a carrot,
  // put down a fence, you have no fence — is a picture.
  test("a sentence that opens with a noun opens with a capital", () => {
    for (const line of [
      DE.buyTitle(FixtureType.Fence, 2, "2,00"),
      DE.sellTitle(PlantType.Carrot, 3, "1,50"),
    ]) {
      expect(line[0]).toBe(line[0]?.toUpperCase() as string);
    }
  });

  test("the noun forms decline, which is why they are stored and not built", () => {
    expect(DE.fixture(FixtureType.Fence).none).toBe("keinen Zaun");
    expect(DE.plant(PlantType.Carrot).none).toBe("keine Karotte");
    expect(DE.fixture(FixtureType.Gate).none).toBe("kein Tor");
  });

  // Every placeable thing has a name the shop can put in a row and a form
  // for "you have none of them", whether or not a sentence uses it today.
  test("everything the shop sells has both forms", () => {
    for (const fixture of PLACEABLE_FIXTURES) {
      expect(DE.fixture(fixture).bare).not.toContain("undefined");
      expect(DE.fixture(fixture).none).not.toContain("undefined");
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
