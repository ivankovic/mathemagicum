// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

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
  [FixtureType.GateSide]: noun("gate"),
  [FixtureType.Glowcap]: noun("glowcap"),
  [FixtureType.Stall]: noun("market stall", "market stalls"),
  [FixtureType.CityWall]: noun("city wall", "city walls"),
  [FixtureType.CityWallSide]: noun("city wall", "city walls"),
  [FixtureType.CityGate]: noun("city gate", "city gates"),
  [FixtureType.CityGateSide]: noun("city gate", "city gates"),
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
  townhouse: "townhouse",
  ship: "ship's hold",
  observatory: "observatory",
  barn: "barn",
  tower: "tower",
  schoolhouse: "schoolhouse",
};

const PLACES = ["ones", "tens", "hundreds"];

// The five places world generation puts down, as a player would say them.
const COMPASS_EN: Record<string, string> = {
  east: "east",
  west: "west",
  north: "north",
  south: "south",
};

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
  map: "There is a map of the whole world on the wall in the tower. Tap it any time you want to see where you are — and the geometer under it will teach you a spell for getting about.",
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

  nothingToClear: "Face something in the way first.",
  willNotClear: "That is yours. The spell only takes what the ground grew.",
  cleared: "The way is clear.",
  spellFades: "The spell fades unspoken",
  tooFarToSpeak: "Too far away — step up to her first",
  tooFarFromLandmark: "Too far away — walk right up to it first",
  cannotWalkThere: "Can't walk there",
  greatTreeGreeting: "The great tree stirs, and its lights lean towards you",
  lighthouseGreeting: "The lamp turns overhead, and the sea goes on out of sight",
  clockTowerGreeting: "The clock ticks on above you, dividing the hour up",
  entered: (room) => `Entered the ${ROOMS[room] ?? room}. Step back out through the door.`,

  titleTagline: "A garden, and the sums that grow it",
  titleLoading: "loading…",
  titlePlay: "tap anywhere to begin",

  mapTitle: "Map of the world",
  mapYouAreHere: "You are the pale mark.",
  placeName: (place) => PLACE_NAMES[place] ?? place,

  geometerGreeting: "The geometer looks up from his table.",
  portalUntaught: "You have not been taught this one. Someone in the tower knows it.",
  portalTaught: "The geometer teaches you the portal spell.",
  geometryLessonTitle: "Measuring the world",
  geometryRune:
    "The dividers in your spellbook open a map. Pick a place you have been, say how far away it is, and the portal takes you there.",
  geometryRuler: (paces) =>
    `Down each side of the map runs a ruler. One mark is ${paces} paces, and where you stand is nought — so the mark a place sits on is how far away it is.`,
  geometryLegs: (across, acrossMarks, down, downMarks, total) =>
    `The portal goes ${acrossMarks} ${across}, then ${downMarks} ${down}. That is ${acrossMarks} + ${downMarks} = ${total} marks of travelling.`,
  geometryCrow: (acrossMarks, downMarks, squares, crow) =>
    `A crow flies straight, which is shorter. Take each leg times itself and add them: ${acrossMarks}×${acrossMarks} + ${downMarks}×${downMarks} = ${squares}. The flight is the number that, times itself, makes ${squares} — ${crow}. On a real journey, give the nearest whole mark.`,

  portalTitle: "Portal",
  portalChoose: "Where shall the portal take you?",
  portalLocked: "You have not been there yet.",
  portalHereAlready: "You are already there.",
  portalScale: (paces) => `one mark = ${paces} paces`,
  portalAskCount: "How many stones is it?",
  portalAskRead: (towards) => `How far ${towards} is it?`,
  portalAskAdd: "How far is it, the way the portal goes?",
  portalAskCrow: "How far is it as the crow flies?",
  portalCompass: (towards) => COMPASS_EN[towards] ?? towards,
  portalHintCount: (stones) => `Count the stones one by one: there are ${stones}.`,
  portalHintRead: (towards, marks) => `Read the mark it sits on: ${marks} ${towards}.`,
  portalHintLegs: (across, acrossMarks, down, downMarks) =>
    `${acrossMarks} ${across}, then ${downMarks} ${down}.`,
  portalHintCrow: (acrossMarks, downMarks, squares) =>
    `${acrossMarks}×${acrossMarks} + ${downMarks}×${downMarks} = ${squares}. The crow's flight times itself makes ${squares}.`,
  portalArrived: (place) => `The portal sets you down at ${place}.`,

  arrayUntaught: "You have not earned this one yet. Something in the old wood is waiting on you.",
  arrayTaught: "Your grove is full. The great tree teaches you the array spell.",
  groveAsks: ({ task, standing, ripe, squares }) =>
    task === "overgrown"
      ? `The wood has closed over my bed. Take away the ${standing} that still stand.`
      : task === "done"
        ? "My grove is full. Go well."
        : `Fill my bed: ${ripe} of ${squares} squares are ripe.`,
  groveTaskTitle: "The tree's bed",
  groveBargain: "Do that and the six dots are yours.",
  groveLessonTitle: "Rows and columns",
  groveRune:
    "The six dots in your spellbook plant a whole patch at once. Say how many seedlings it will hold, and they all go in together.",
  groveRows: (rows, columns) =>
    `Look at the patch as rows. ${rows} rows, and ${columns} in every one — every row exactly the same, which is the whole trick.`,
  groveCount: (rows, columns, total) =>
    `So count along by rows: ${Array.from({ length: rows }, (_, at) => (at + 1) * columns).join(", ")}. That is ${rows} × ${columns} = ${total}.`,
  groveTurn: (rows, columns, total) =>
    `Now turn the patch on its side: ${columns} rows of ${rows}. Still ${total}. ${rows} × ${columns} and ${columns} × ${rows} are the same patch seen two ways, so you only ever have to learn half the table.`,

  arrayTitle: (rows, columns) => `${rows} × ${columns}`,
  arrayMarkOut: "Mark out the ground: tap one corner, then the other.",
  arrayTooSmall: "One square on its own is not a patch — tap a second corner.",
  arrayNothingToDo: "Nothing in that patch to plant, grow or clear.",
  arrayChooseAction: "Now choose what to do with it.",
  patchAction: (action) =>
    action === "plant" ? "plant it" : action === "grow" ? "grow it" : "clear it",
  patchDone: (action, count) =>
    count === 0
      ? "Nothing there to touch."
      : action === "plant"
        ? `${count} seedlings, all at once.`
        : action === "grow"
          ? `${count} of them grew at once.`
          : `${count} squares cleared at once.`,
  arrayAsk: "How many in the whole patch?",
  noRoomForArray: (rows, columns) =>
    `The spell needs clear ground ${columns} across and ${rows} down, starting where you are facing.`,
  arrayHintRows: (columns, counted) =>
    `Count along by ${columns}: ${Array.from({ length: counted }, (_, at) => (at + 1) * columns).join(", ")}…`,
  arrayPlanted: (plant, count) => `${count} ${plant} seedlings, in rows.`,

  hourglassTitle: "The hourglass",
  hourglassAsk: "How many hours were you away?",
  hourglassLeft: "you left",
  hourglassBack: "you are back",
  hourglassCountOn: (hours) => `Count round the dial: ${hours}, and keep going…`,
  hourglassSolved: (hours) => `${hours} hours. The glass turns.`,
  hourglassNoTime: "The glass reads the same hour it did. Come back later.",
  hourglassNothingGrowing: "Time passed, but nothing of yours is growing. Plant something first.",
  hourglassUntaught:
    "You have not earned this one yet. Somebody up in the mountains keeps the hours.",
  hourglassTaught: "The way is lit. The astronomer teaches you the hourglass.",
  astronomerGreeting: "The astronomer looks up from the eyepiece.",
  astronomerAsks: (dark, given) => {
    const left = dark === 1 ? "One lamp" : `${dark} lamps`;
    const posts = dark === 1 ? "the empty post" : "the empty posts";
    if (given <= 0) return `${left} still to set on the path.`;
    const here = given === 1 ? "Here is one" : `Here are ${given}`;
    return `${left} still to set on the path. ${here} — put ${given === 1 ? "it" : "them"} on ${posts}.`;
  },
  astronomerBlocked: "Something is standing where a lamp should go. Clear the posts first.",
  starChartRead: "A chart of the night, with the plough drawn out on it.",
  hourglassGrew: (count) =>
    count === 1
      ? "One thing grew while you were away."
      : `${count} things grew while you were away.`,

  purseTier: (count, amount) => (count > 0 ? `${count} coins — ${amount}` : "none of those"),
  purseEmpty: "Your purse is empty",

  optionsButton: "options",
  optionsTitle: "Options",
  languageHeading: "Language",
  cropSellsFor: (price) => `A crop sells for ${price}`,

  playersTitle: "Who is playing?",
  newPlayer: "New player",
  makePlayerTitle: "Who are you?",
  namePrompt: "Your name",
  skinHeading: "Skin",
  hairHeading: "Hair",
  shirtHeading: "Clothes",
  bodyHeading: "Look",
  startPlaying: "That's me",
  neverMind: "Back",
  deviceFull: (most) => `This tablet holds ${most} players`,
  deletePlayer: "Remove a player",
  deleteAreYouSure: (name) => `Remove ${name}, and everything ${name} has grown?`,
  deleteYes: "Yes, remove",
  deleteNo: "No, keep",
  worldRebuilt: "The world was rebuilt, but your coins and your basket are still yours.",
  sumsHeading: "Your sums",

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
