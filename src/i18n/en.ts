// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { Currency } from "../shop/currency";
import { FixtureType } from "../world/fixtures";
import type { ItemType } from "../world/inventory";
import { PlantStage, PlantType } from "../world/plants";
import { TerrainType } from "../world/terrain";
import type { Noun, Phrases } from "./phrases";

/**
 * The game in English, and the reference wording for every other language.
 *
 * English needs none of the machinery the interface offers — one word, an
 * "a", a "the" and an "s" — so `noun` builds all five forms from the word
 * itself and the irregular ones say so on the spot.
 */

function noun(bare: string, plural = `${bare}s`): Noun {
  const article = /^[aeiou]/.test(bare) ? "an" : "a";
  return {
    bare,
    indefinite: `${article} ${bare}`,
    definite: `the ${bare}`,
    none: `no ${bare}`,
    plural,
  };
}

const PLANTS: Record<PlantType, Noun> = {
  [PlantType.Carrot]: noun("carrot"),
  [PlantType.Sunflower]: noun("sunflower"),
  [PlantType.Cactus]: noun("cactus", "cactuses"),
  [PlantType.Tomato]: noun("tomato", "tomatoes"),
  [PlantType.Pepper]: noun("pepper"),
  // A mass noun: you grow wheat, not wheats, and "3 wheat" is what a person
  // says. The plural field carries the same word rather than an invented one.
  [PlantType.Wheat]: noun("wheat", "wheat"),
};

const FIXTURES: Record<FixtureType, Noun> = {
  [FixtureType.Well]: noun("well"),
  [FixtureType.Fence]: noun("fence"),
  [FixtureType.Table]: noun("table"),
  [FixtureType.Lamp]: noun("lamp"),
  [FixtureType.Gate]: noun("gate"),
  [FixtureType.FenceSide]: noun("fence"),
};

const STAGES: Record<PlantStage, string> = {
  [PlantStage.Seedling]: "a seedling",
  [PlantStage.Growing]: "growing",
  [PlantStage.Mature]: "ripe",
};

const TERRAIN: Record<TerrainType, string> = {
  [TerrainType.Water]: "water",
  [TerrainType.Sand]: "sand",
  [TerrainType.Dirt]: "dirt",
  [TerrainType.Grass]: "grass",
  [TerrainType.Woodland]: "woodland",
  [TerrainType.Hilly]: "hills",
  [TerrainType.Mountain]: "mountain",
  [TerrainType.Cobble]: "cobbles",
};

const ROOMS: Record<string, string> = {
  cottage: "cottage",
  barn: "barn",
  tower: "tower",
  schoolhouse: "schoolhouse",
};

const CURRENCIES: Record<Currency, string> = {
  [Currency.Kuna]: "kuna",
  [Currency.Franc]: "francs",
  [Currency.Euro]: "euros",
};

const PLACES = ["ones", "tens", "hundreds"];

// The five places world generation puts down, as a player would say them.
const PLACE_NAMES: Record<string, string> = {
  village: "the village",
  harbour: "the harbour",
  bigCity: "the city",
  observatory: "the observatory",
  enchantedForest: "the old forest",
};

// The welcome, a page at a time. Keyed by IntroBeat rather than written as
// four fields, so a beat added to the tour fails the coverage test in every
// language instead of silently showing an empty page in one of them.
const INTRO_EN: Record<string, string> = {
  seeds:
    "That is your garden. Take a seed from the pouch and it goes into the ground on the tile you are facing.",
  spell:
    "Seeds do not grow on their own here. Open the spellbook, cast the + rune on one, and answer the sum. Two casts and it is ripe. The teacher in the school will show you how, if you ask her.",
  pick: "Tap a ripe crop to pick it. It goes in your basket, and it grows back.",
  store:
    "The shopkeeper in the barn buys what you pick, and sells fences, tables and lamps for the garden. You count the coins out yourself — she is not always right, mind.",
  map: "There is a map of the whole world on the wall in the tower. Tap it any time you want to see where you are.",
};

function item(item: ItemType): Noun {
  return PLANTS[item as PlantType] ?? FIXTURES[item as FixtureType] ?? noun(item);
}

export const EN: Phrases = {
  plant: (plant) => PLANTS[plant] ?? noun(plant),
  fixture: (fixture) => FIXTURES[fixture] ?? noun(fixture),
  item,
  stage: (stage) => STAGES[stage] ?? stage,
  terrain: (terrain) => TERRAIN[terrain] ?? terrain,
  room: (room) => ROOMS[room] ?? room,
  count: (thing, count) => {
    const name = item(thing);
    return `${count} ${count === 1 ? name.bare : name.plural}`;
  },
  currencyName: (currency) => CURRENCIES[currency] ?? currency,

  nothingGrowsIndoors: "Nothing grows indoors",
  noRoomToPlant: "There's no room to plant there",
  alreadyPlanted: "Something is already planted there",
  wrongGround: (plant, terrain) => `${PLANTS[plant]?.bare} can't grow on ${TERRAIN[terrain]}`,
  planted: (plant) =>
    `Planted ${PLANTS[plant]?.indefinite} seedling — cast the plus rune to grow it`,
  faceToGrow: "Face something you planted to grow it",
  alreadyGrown: (plant) => `This ${PLANTS[plant]?.bare} is already fully grown`,
  grownTo: (plant, stage) => `Your ${PLANTS[plant]?.bare} is now ${STAGES[stage]}`,
  picked: (plant, held) =>
    `Picked ${PLANTS[plant]?.indefinite} — you have ${EN.count(plant, held)}`,
  notRipe: (plant) => `This ${PLANTS[plant]?.bare} is not ready — grow it with the plus rune`,
  faceToPick: "Face something you planted to pick it",

  notInHere: "Not in here",
  notYours: (fixture) => `A ${FIXTURES[fixture]?.bare} is not yours to move`,
  noneLeft: (fixture) => `You have ${FIXTURES[fixture]?.none} — buy one at the store`,
  noRoomThere: "There's no room there",
  somethingGrowing: "Something is growing there",
  putDown: (fixture) => `Put down ${FIXTURES[fixture]?.indefinite} — tap it to pick it up again`,
  tooFarToReach: "Too far away — step up to it first",
  pickedUp: (fixture, held) =>
    `Picked up ${FIXTURES[fixture]?.indefinite} — you have ${EN.count(fixture, held)}`,

  spellFades: "The spell fades unspoken",
  tooFarToSpeak: "Too far away — step up to her first",
  cannotWalkThere: "Can't walk there",
  entered: (room) => `Entered the ${ROOMS[room] ?? room}. Step back out through the door.`,

  mapTitle: "Map of the world",
  mapYouAreHere: "You are the pale mark.",
  placeName: (place) => PLACE_NAMES[place] ?? place,

  purseTier: (count, amount) => (count > 0 ? `${count} coins — ${amount}` : "none of those"),
  purseEmpty: "Your purse is empty",

  optionsButton: "options",
  optionsTitle: "Options",
  languageHeading: "Language",
  moneyHeading: "Money",
  followLanguage: "follow",
  cropSellsFor: (price) => `A crop sells for ${price}`,

  storeTitle: (money) => `Village Store — ${money}`,
  storeFooter: "She buys crops, and sells things to put in your garden.",
  sheBuys: "She buys",
  sheSells: "She sells",
  stockRow: (fixture, price) => `${FIXTURES[fixture]?.bare}\n${price}`,
  cropRow: (plant, held, price) => `${held} x ${PLANTS[plant]?.bare}\n${price} each`,
  buyTitle: (fixture, count, price) => `${count} x ${FIXTURES[fixture]?.bare} — pay ${price}`,
  sellTitle: (plant, count, price) => `${count} x ${PLANTS[plant]?.bare} — she owes ${price}`,
  onTheCounter: (total) => `on the counter: ${total}`,
  moreToGo: (amount) => `${amount} more to go.`,
  tooMuch: (amount) => `${amount} too much.`,
  exactlyRight: "That is exactly right — tap pay.",
  tooExpensive: "That is more money than you have.",
  paidFor: (fixture, count) => `Paid. ${EN.count(fixture, count)} in your crate.`,
  sheCountsOut: "she counts out:",
  countHerCoins: "Count her coins. Is that the right money?",
  back: "back",
  pay: "pay",
  done: "done",
  clear: "clear",
  thatsRight: "that's right",
  thatsWrong: "that's wrong",

  verdictExact: (owed) => `Right — ${owed} exactly.`,
  verdictSpotted: (paid, owed, short) =>
    `Well spotted. That was ${paid}, ${short ? "short of" : "over"} ${owed}. She makes it up.`,
  verdictWasRight: (owed) => `It was right, in fact: ${owed}. She counts it again for you.`,
  verdictLookAgain: (paid, owed) => `Have another look — that was ${paid}, not ${owed}.`,

  postmanGreeting: "The postal worker jogs over with something for you.",
  introTitle: "Welcome to the village",
  intro: (beat) => INTRO_EN[beat] ?? "",

  teacherGreeting: "The teacher looks up from her desk.",
  lessonTitle: "The addition spell",
  lessonRune:
    "Open your spellbook and tap the + rune. Whatever you are facing grows one step — but only if you can do the sum it asks you.",
  lessonSplit: (addend, parts) =>
    `Pull the number apart. ${addend} is ${parts.join(" and ")}. Every number is made of hundreds, tens and ones, and those are the three jumps.`,
  lessonJump: (start, jumps) =>
    `Start at ${start} and jump the small part first: ${jumps.map((jump) => `+${jump}`).join(", then ")}. Type the number you land on into each box.`,
  lessonAnswer: (answer) =>
    `The last box is the answer: ${answer}. Small jumps first means only one part of the number changes each time, so there is nothing to carry and nothing to hold in your head.`,
  lessonNext: "next",
  lessonBack: "back",
  lessonDone: "off you go",
  lessonExample: (start, addend) => `${start} + ${addend}`,

  place: (index) => PLACES[index] ?? "",
  jumpPrompt: (index) => `Jump the ${PLACES[index] ?? ""}. Where do you land?`,
  addPlace: (index, from) => `Add the ${PLACES[index] ?? ""} to ${from}.`,
  sumQuestion: (from, jump) => `${from} + ${jump} = ?`,
};
