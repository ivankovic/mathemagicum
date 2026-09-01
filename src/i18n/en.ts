// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { AnimalKind } from "../world/animals";
import { DecorType } from "../world/decor";
import { FixtureType } from "../world/fixtures";
import type { ItemType } from "../world/inventory";
import { MaterialType } from "../world/materials";
import { NAMED_PEOPLE } from "../world/names";
import { PlantStage, PlantType } from "../world/plants";
import type { Buyable } from "../world/shop";
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

const ANIMALS: Record<AnimalKind, Noun> = {
  [AnimalKind.Chicken]: noun("chicken"),
  [AnimalKind.Duck]: noun("duck"),
  [AnimalKind.Cat]: noun("cat"),
  [AnimalKind.Rabbit]: noun("rabbit"),
};

const FIXTURES: Record<FixtureType, Noun> = {
  [FixtureType.Well]: noun("well"),
  [FixtureType.Fence]: noun("fence"),
  [FixtureType.Table]: noun("garden table", "garden tables"),
  [FixtureType.Lamp]: noun("lamp"),
  [FixtureType.Bench]: noun("bench", "benches"),
  [FixtureType.Scarecrow]: noun("scarecrow"),
  [FixtureType.Flowerpot]: noun("flowerpot"),
  // The first machine. Named for what it does rather than for what it is
  // made of, which is how a child will point at it.
  [FixtureType.Sorter]: noun("sorter"),
  // The second. Named for the glass rather than for the growing, because a
  // child points at the box and not at what is happening inside it.
  [FixtureType.Hothouse]: noun("hothouse"),
  // Named for the mesh, which is the part that does the work and the part
  // a child will point at.
  [FixtureType.Sieve]: noun("sieve"),
  // Named for what it keeps rather than for the bucket it keeps it in.
  [FixtureType.Tally]: noun("tally"),
  [FixtureType.Windpump]: noun("wind pump"),
  [FixtureType.Planter]: noun("planter"),
  [FixtureType.Gate]: noun("gate"),
  [FixtureType.FenceSide]: noun("fence"),
  // Still a fence. What a corner is, is a fact about the picture.
  [FixtureType.FenceCorner]: noun("fence"),
  [FixtureType.GateSide]: noun("gate"),
  // Both ends of one way in. Still a gate; which end it is, is a fact
  // about the picture.
  [FixtureType.GateSideLower]: noun("gate"),
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
  seeds: `I am ${NAMED_PEOPLE["postal-worker"]}, the postman. That is your garden. Take a seed from the pouch, then tap the square you want it in.`,
  spell: `Seeds do not grow on their own here. Open the spellbook, cast the + rune on one, and answer the sum. Two casts and it is ripe. ${NAMED_PEOPLE.teacher} in the school will show you how, if you ask her.`,
  pick: "Tap a ripe crop to pick it. It goes in your basket and the ground is bare again, ready for another seed.",
  store: `${NAMED_PEOPLE.shopkeeper} in the barn buys what you pick, and sells fences, tables and lamps for the garden. You count the coins out yourself — she is not always right, mind.`,
  map: `There is a map of the whole world on the wall in the tower. Tap it any time you want to see where you are — and ${NAMED_PEOPLE.geometer} under it will teach you a spell for getting about.`,
};

const MATERIALS: Record<MaterialType, Noun> = {
  // Mass nouns, both of them: you come back with wood, not with a wood.
  [MaterialType.Wood]: {
    bare: "wood",
    indefinite: "wood",
    definite: "the wood",
    none: "no wood",
    plural: "wood",
  },
  [MaterialType.Stone]: {
    bare: "stone",
    indefinite: "stone",
    definite: "the stone",
    none: "no stone",
    plural: "stone",
  },
};

const FURNITURE: Record<DecorType, Noun> = {
  [DecorType.Bed]: noun("bed"),
  // The store already sells a garden table, which is a different thing at a
  // different size. Same word, two objects — see `PIECE_ART`.
  [DecorType.Table]: noun("table"),
  [DecorType.Chair]: noun("chair"),
  [DecorType.Rug]: noun("rug"),
  [DecorType.Bookshelf]: noun("bookshelf", "bookshelves"),
  [DecorType.Stove]: noun("stove"),
  [DecorType.Sink]: noun("sink"),
  [DecorType.Dresser]: noun("dresser"),
  [DecorType.Kettle]: noun("kettle"),
  [DecorType.Bath]: noun("bath"),
  [DecorType.Washstand]: noun("washstand"),
  [DecorType.Privy]: noun("privy"),
};

function item(item: ItemType | Buyable): Noun {
  return (
    PLANTS[item as PlantType] ??
    // Before the fixtures, because the store sells a garden table *and* an
    // indoor one and they are two different objects sharing a word.
    FURNITURE[item as DecorType] ??
    FIXTURES[item as FixtureType] ??
    MATERIALS[item as MaterialType] ??
    noun(item)
  );
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

  cleared: "The way is clear.",

  titleTagline: "A garden, and the sums that grow it",
  titleLoading: "loading…",
  titleLoadingWhat: (done, total, what) => `loading ${done}/${total} — ${what}`,
  titleLoadFailed: (what) => `could not load: ${what}`,
  titlePlay: "tap anywhere to begin",

  mapTitle: "Map of the world",
  mapYouAreHere: "You are the pale mark.",
  placeName: (place) => PLACE_NAMES[place] ?? place,

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

  groveAsks: ({ task, standing, ripe, squares }) =>
    task === "overgrown"
      ? `The wood has closed over my beds. Take away the ${standing} that still stand.`
      : task === "done"
        ? "My grove is full. Go well."
        : `Now use what you have earned: take a sunflower from your pouch and cast the six dots over a whole bed at once. ${ripe} of ${squares} squares are ripe.`,
  groveTaskTitle: "The tree's beds",
  groveBargain: "Do that and the six dots are yours.",
  groveLessonTitle: "Rows and columns",
  groveRune:
    "The six dots in your spellbook cast on a whole patch at once. Say how many squares are in it, and every one of them grows together.",
  groveRows: (rows, columns) =>
    `Look at the patch as rows. ${rows} rows, and ${columns} in every one — every row exactly the same, which is the whole trick.`,
  groveCount: (rows, columns, total) =>
    `So count along by rows: ${Array.from({ length: rows }, (_, at) => (at + 1) * columns).join(", ")}. That is ${rows} × ${columns} = ${total}.`,
  groveTurn: (rows, columns, total) =>
    `Now turn the patch on its side: ${columns} rows of ${rows}. Still ${total}. ${rows} × ${columns} and ${columns} × ${rows} are the same patch seen two ways, so you only ever have to learn half the table.`,

  arrayTitle: (rows, columns) => `${rows} × ${columns}`,
  arrayAsk: "How many in the whole patch?",
  arrayHintRows: (columns, counted) =>
    `Count along by ${columns}: ${Array.from({ length: counted }, (_, at) => (at + 1) * columns).join(", ")}…`,

  debugTitle: "Debug options",
  debugHint: "Tap the heading again to put these away.",
  debugFrozen: "Hold the village still",
  debugHungry: "Every animal hungry",
  debugHour: (hour) => `The hour: ${String(hour).padStart(2, "0")}:00`,
  debugRung: (rung, of) => `The sums: rung ${rung} of ${of}`,
  debugPurse: "Fill the purse",
  debugBasket: "Fill the basket",
  debugLearn: "Learn everything, go everywhere",
  debugOn: "on",
  debugOff: "off",
  debugDone: "done",

  shareLessonTitle: "Sharing it out",
  shareRune: `The bar with two dots in your spellbook picks a whole patch at once — and asks how the catch divides up. ${NAMED_PEOPLE.fisher} does it every morning.`,
  shareHeap: (total, parts) =>
    `Here is the whole heap: ${total}. And here are ${parts} baskets to put it in, with the same in each.`,
  shareDeal: (total, parts, each) =>
    `Go round the baskets one at a time until the heap runs out. ${total} shared ${parts} ways puts ${each} in every one.`,
  shareOver: (left, parts) =>
    `And these ${left} will not go: any more and one basket would have more than the rest. ${left} left over is always fewer than ${parts}.`,
  shareTitle: (total, parts) => `${total} ÷ ${parts}`,
  shareAsk: "How many does each basket get?",
  shareAskLeft: "And how many are left over?",
  shareHintDeal: (filled, sharedOut) =>
    `${filled} filled, ${sharedOut} shared out. Keep going round.`,
  shareHintCount: (parts) => `Count up in ${parts}s until you reach the heap.`,
  shareDone: (total, parts, each, left) =>
    left > 0
      ? `${total} shared ${parts} ways is ${each} each, and ${left} over.`
      : `${total} shared ${parts} ways is ${each} each, exactly.`,

  brickTitle: "The wall",
  brickAsk: "Every brick is the two under it, added up.",
  brickWrong: "Not that one. Have another look.",
  brickDone: "That is a wall. Your room is built.",
  brickHintAdd: "Add the two bricks under it.",
  brickHintTakeAway: "Take the brick beside it away from the one above.",

  lampsTaskTitle: `${NAMED_PEOPLE.astronomer}'s climb`,
  lampsAsk: (left) =>
    left > 0
      ? `The path to my door is dark. Set a lamp on every post — ${left} still to light.`
      : "Every post is lit. Come up after dark and I will show you the sky.",
  lampsBargain: "Do that and the mirror is yours.",
  lampsEarned: "The mirror is yours.",

  starChartTitle: "The night over the valley",
  starChartCaption: "The stars as they stand at midnight, drawn by hand.",

  mirrorTitle: "The mirror",
  mirrorAsk: "Colour the squares that make both sides of the line match.",
  mirrorWrong: "Not that one. Look across the line.",
  mirrorDone: "Both sides match. That is a mirror.",
  mirrorHint: "This square is one of them.",

  hourglassTitle: "The hourglass",
  hourglassAsk: "How far are you moving the clock?",
  hourglassTurnIt: "Swipe round to turn the clock.",
  hourglassMinutes: "minutes",
  hourglassHours: "hours",
  hourglassTo: "move it to",
  hourglassNow: "it is now",
  hourglassCountOn: (hours) => `Count round the dial: ${hours}, and keep going…`,
  hourglassSolved: (hours) => `${hours} hours. The glass turns.`,

  optionsButton: "options",
  optionsTitle: "Options",
  languageHeading: "Language",

  aboutButton: "About",
  aboutTitle: "About",
  madeBy: "Made by Marko Ivankovic",
  copyright: "\u00a9 2026 Marko Ivankovic",
  licenceLine: "Code: PolyForm Noncommercial 1.0.0\nArt: CC BY-NC-ND 4.0",
  sponsorNote:
    "This game is completely free. It will always remain free. If you would like to support the development, you can do so using GitHub Sponsorships. If you are a student, single parent or not in a good financial situation, please do NOT spend any money on this game. Only support the game if you are using your school or other organizations money, or are financially comfortable.",
  sourceLink: "Source on GitHub",
  sponsorLink: "GitHub Sponsors",

  playersTitle: "Who is playing?",
  newPlayer: "New player",
  tongueTitle: "Language",
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
  sumsHeading: "Your sums",
  sumsTitle: "How big are your sums?",
  nextStep: "Next",
  parentsNotice: "Important information for parents",
  offlineNotice: "This game is not played online.",
  backupNotice:
    "If you lose your device, your game world is lost. Back up your save file regularly.",
  exportSaves: "Export saves",
  exportDone: "Saved",
  importSaves: "Restore a backup",
  importAreYouSure:
    "Everything on this tablet is replaced by the file: every player, and every game they have played.",
  importYes: "Yes, restore",
  importNo: "No, keep this",
  importNotASave: "That file is not a Mathemagicum backup.",
  gamesHeading: "Games on this device",
  gameWhen: (savedAt) =>
    new Date(savedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
  deleteGameAsk: "Throw this game away? Its world and everything done in it are gone for good.",

  // Not "Village Store" any more: there are shops in the city and on the
  // quay, and a counter in a harbour warehouse announcing a village is a
  // sign for the wrong building.
  storeTitle: (money) => `Shop — ${money}`,
  storeFooter: (keeper) => `${keeper} buys crops, and sells things for your garden and your house.`,
  keeperBuys: (keeper) => `${keeper} buys`,
  keeperSells: (keeper) => `${keeper} sells`,
  stockRow: (thing, price) => `${EN.item(thing).bare}\n${price}`,
  cropRow: (item, held, price) => `${held} x ${EN.item(item).bare}\n${price} each`,
  buyTitle: (thing, count, price) => `${count} x ${EN.item(thing).bare} — pay ${price}`,
  sellTitle: (item, count, price) => `${count} x ${EN.item(item).bare} — she owes ${price}`,
  onTheCounter: (total) => `on the counter: ${total}`,
  moreToGo: (amount) => `${amount} more to go.`,
  tooMuch: (amount) => `${amount} too much.`,
  exactlyRight: "That is exactly right — tap pay.",
  tooExpensive: "That is more money than you have.",
  paidFor: (fixture, count) => `Paid. ${EN.count(fixture, count)} in your crate.`,
  sheCountsOut: "she counts out:",
  countHerCoins: "Count her coins. Is that the right money?",
  countHerPiles: "Work out her piles. Is that the right money?",
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

  introTitle: "Welcome to the village",
  intro: (beat) => INTRO_EN[beat] ?? "",

  lessonTitle: "The addition spell",
  lessonRune:
    "Open your spellbook and tap the + rune. Whatever you are facing grows one step — but only if you can do the sum it asks you.",
  lessonSplit: (addend, parts) =>
    parts.length === 1
      ? `${addend} is already one piece, so there is one jump to make.`
      : `Pull the number apart. ${addend} is ${parts.join(" and ")}. Every number is made of ${
          parts.length === 2 ? "tens and ones" : "hundreds, tens and ones"
        }, and those are the ${parts.length === 2 ? "two" : "three"} jumps.`,
  lessonJump: (start, jumps) =>
    `Start at ${start} and jump the small part first: ${jumps.map((jump) => `+${jump}`).join(", then ")}. Type the number you land on into each box.`,
  lessonAnswer: (answer) =>
    `The last box is the answer: ${answer}. Small jumps first means only one part of the number changes each time, so there is nothing to carry and nothing to hold in your head.`,
  lessonUndo: (total, addend, start) =>
    `Sometimes the missing number is at the front: ? + ${addend} = ${total}. Walk the same jumps backwards from ${total} instead of forwards, and you land on where it must have started: ${start}.`,
  lessonNext: "next",
  lessonBack: "back",
  lessonDone: "off you go",
  lessonExample: (start, addend) => `${start} + ${addend}`,

  place: (index) => PLACES[index] ?? "",
  jumpPrompt: (index) => `Jump the ${PLACES[index] ?? ""}. Where do you land?`,
  addPlace: (index, from) => `Add the ${PLACES[index] ?? ""} to ${from}.`,
  sumQuestion: (from, jump) => `${from} + ${jump} = ?`,
  takeQuestion: (total, known) => `${total} − ${known} = ?`,
};
