// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { Currency } from "../shop/currency";
import { FixtureType } from "../world/fixtures";
import type { ItemType } from "../world/inventory";
import { PlantStage, PlantType } from "../world/plants";
import { TerrainType } from "../world/terrain";
import type { Noun, Phrases } from "./phrases";

/**
 * The game in German.
 *
 * Written as German rather than as English with German words in it. Two
 * things that means in practice:
 *
 * **Gender is carried by the noun, not guessed by the sentence.** `definite`
 * is the nominative ("die Karotte", "der Kaktus"), `indefinite` and `none`
 * are the accusative ("einen Zaun", "keinen Zaun"), because every sentence
 * that introduces a thing has it as the object. A single "the" would produce
 * "der Karotte" somewhere within a week.
 *
 * **No pronouns.** German would need er/sie/es agreeing with the noun, which
 * is a second table of forms to keep in step. Every sentence here is written
 * so it does not need one — "zum Aufheben antippen" rather than "tipp darauf,
 * um ihn aufzuheben" — which is also how a sign in a shop would put it.
 *
 * The interface is a rich German would use for a child: du, imperatives, and
 * no compound nouns longer than a line.
 */

interface DeNoun {
  readonly bare: string;
  readonly gender: "m" | "f" | "n";
  readonly plural: string;
}

function noun({ bare, gender, plural }: DeNoun): Noun {
  const definite = { m: "der", f: "die", n: "das" }[gender];
  // Accusative, which is the case every sentence in this file needs.
  const indefinite = { m: "einen", f: "eine", n: "ein" }[gender];
  const none = { m: "keinen", f: "keine", n: "kein" }[gender];
  return {
    bare,
    definite: `${definite} ${bare}`,
    indefinite: `${indefinite} ${bare}`,
    none: `${none} ${bare}`,
    plural,
  };
}

const PLANTS: Record<PlantType, Noun> = {
  [PlantType.Carrot]: noun({ bare: "Karotte", gender: "f", plural: "Karotten" }),
  [PlantType.Sunflower]: noun({ bare: "Sonnenblume", gender: "f", plural: "Sonnenblumen" }),
  [PlantType.Cactus]: noun({ bare: "Kaktus", gender: "m", plural: "Kakteen" }),
};

const FIXTURES: Record<FixtureType, Noun> = {
  [FixtureType.Well]: noun({ bare: "Brunnen", gender: "m", plural: "Brunnen" }),
  [FixtureType.Fence]: noun({ bare: "Zaun", gender: "m", plural: "Zäune" }),
  [FixtureType.Table]: noun({ bare: "Tisch", gender: "m", plural: "Tische" }),
  [FixtureType.Lamp]: noun({ bare: "Laterne", gender: "f", plural: "Laternen" }),
  [FixtureType.Gate]: noun({ bare: "Tor", gender: "n", plural: "Tore" }),
  [FixtureType.FenceSide]: noun({ bare: "Zaun", gender: "m", plural: "Zäune" }),
};

const STAGES: Record<PlantStage, string> = {
  [PlantStage.Seedling]: "ein Keimling",
  [PlantStage.Growing]: "am Wachsen",
  [PlantStage.Mature]: "reif",
};

const TERRAIN: Record<TerrainType, string> = {
  [TerrainType.Water]: "Wasser",
  [TerrainType.Sand]: "Sand",
  [TerrainType.Dirt]: "Erde",
  [TerrainType.Grass]: "Gras",
  [TerrainType.Woodland]: "Waldboden",
  [TerrainType.Hilly]: "Hügeln",
  [TerrainType.Mountain]: "Fels",
  [TerrainType.Cobble]: "Pflaster",
};

const ROOMS: Record<string, string> = {
  cottage: "Hütte",
  barn: "Scheune",
  tower: "Turm",
  schoolhouse: "Schulhaus",
};

// "In der Scheune", "im Turm": the room names again, in the one case the
// entering message needs them in.
const IN_ROOM: Record<string, string> = {
  cottage: "in der Hütte",
  barn: "in der Scheune",
  tower: "im Turm",
  schoolhouse: "im Schulhaus",
};

const CURRENCIES: Record<Currency, string> = {
  [Currency.Kuna]: "Kuna",
  [Currency.Franc]: "Franken",
  [Currency.Euro]: "Euro",
};

const PLACES = ["Einer", "Zehner", "Hunderter"];

// Der Rundgang, Seite für Seite. Nach IntroBeat geschlüsselt, damit eine neue
// Seite in jeder Sprache auffällt und nicht leer bleibt.
const INTRO_DE: Record<string, string> = {
  seeds:
    "Das da ist dein Garten. Nimm ein Saatkorn aus dem Beutel — es kommt auf das Feld, vor dem du stehst.",
  spell:
    "Von allein wächst hier nichts. Öffne das Zauberbuch, sprich die +-Rune darauf und löse die Aufgabe. Zweimal, dann ist die Pflanze reif. Die Lehrerin in der Schule zeigt dir, wie es geht.",
  pick: "Tipp auf eine reife Pflanze, um sie zu pflücken. Sie wandert in deinen Korb und wächst nach.",
  store:
    "Die Händlerin in der Scheune kauft deine Ernte und verkauft Zäune, Tische und Laternen für den Garten. Das Geld zählst du selbst ab — und sie verzählt sich auch mal.",
};

/**
 * A sentence that starts with a noun form starts with a capital.
 *
 * The forms are stored lowercase because most of them appear mid-sentence
 * ("du hast keinen Zaun"); the handful that open a line are capitalised here
 * rather than stored twice.
 */
function cap(line: string): string {
  return line.charAt(0).toUpperCase() + line.slice(1);
}

const FALLBACK = { gender: "f", plural: "" } as const;

function item(item: ItemType): Noun {
  return (
    PLANTS[item as PlantType] ??
    FIXTURES[item as FixtureType] ??
    noun({ bare: item, ...FALLBACK, plural: item })
  );
}

export const DE: Phrases = {
  plant: (plant) => PLANTS[plant] ?? item(plant),
  fixture: (fixture) => FIXTURES[fixture] ?? item(fixture),
  item,
  stage: (stage) => STAGES[stage] ?? stage,
  terrain: (terrain) => TERRAIN[terrain] ?? terrain,
  room: (room) => ROOMS[room] ?? room,
  count: (thing, count) => {
    const name = item(thing);
    return `${count} ${count === 1 ? name.bare : name.plural}`;
  },
  currencyName: (currency) => CURRENCIES[currency] ?? currency,

  nothingGrowsIndoors: "Drinnen wächst nichts",
  noRoomToPlant: "Da ist kein Platz zum Pflanzen",
  alreadyPlanted: "Da wächst schon etwas",
  wrongGround: (plant, terrain) =>
    cap(`${PLANTS[plant]?.definite} wächst nicht auf ${TERRAIN[terrain]}`),
  planted: (plant) =>
    cap(`${PLANTS[plant]?.indefinite} gepflanzt — sprich die Plus-Rune zum Wachsen`),
  faceToGrow: "Stell dich vor etwas Gepflanztes, um es wachsen zu lassen",
  alreadyGrown: (plant) => cap(`${PLANTS[plant]?.definite} ist schon voll gewachsen`),
  grownTo: (plant, stage) => cap(`${PLANTS[plant]?.definite} ist jetzt ${STAGES[stage]}`),
  picked: (plant, held) =>
    cap(`${PLANTS[plant]?.indefinite} gepflückt — du hast ${DE.count(plant, held)}`),
  notRipe: (plant) => cap(`${PLANTS[plant]?.definite} ist noch nicht reif — nutze die Plus-Rune`),
  faceToPick: "Stell dich vor etwas Gepflanztes, um es zu pflücken",

  notInHere: "Hier drinnen nicht",
  notYours: (fixture) => cap(`${FIXTURES[fixture]?.indefinite} kannst du nicht mitnehmen`),
  noneLeft: (fixture) => `Du hast ${FIXTURES[fixture]?.none} — kauf einen im Laden`,
  noRoomThere: "Da ist kein Platz",
  somethingGrowing: "Da wächst etwas",
  putDown: (fixture) => cap(`${FIXTURES[fixture]?.indefinite} hingestellt — zum Aufheben antippen`),
  tooFarToReach: "Zu weit weg — geh erst hin",
  pickedUp: (fixture, held) =>
    cap(`${FIXTURES[fixture]?.indefinite} aufgehoben — du hast ${DE.count(fixture, held)}`),

  spellFades: "Der Zauber verklingt ungesprochen",
  tooFarToSpeak: "Zu weit weg — geh erst zu ihr",
  cannotWalkThere: "Da geht es nicht weiter",
  entered: (room) => `Du bist ${IN_ROOM[room] ?? room}. Durch die Tür geht es wieder hinaus.`,

  statusOptions: "Optionen",
  statusStore: "Der Dorfladen",
  statusSeeds: "Wähle ein Saatkorn für das Feld vor dir",
  statusSpells: "Sprich +, damit die Pflanze vor dir wächst",
  statusCrateEmpty: "Nichts zum Hinstellen — die Händlerin verkauft Zäune und Laternen",
  statusCrate: "Wähle etwas für das Feld vor dir",
  statusBasketEmpty: "Dein Korb ist leer — tipp auf eine reife Pflanze",
  statusCarrying: (total, kinds) => `Du trägst ${total} in ${kinds} Sorte(n)`,
  hintTouch: "Ziehen zum Gehen  Reife Pflanze antippen  Der Laden ist in der Scheune",
  hintKeys: (plant) =>
    `Pfeile/WASD  P: Saat  B: Zauber  Leertaste: ${PLANTS[plant]?.bare} pflanzen  H: pflücken  Laden: in der Scheune`,

  optionsButton: "Optionen",
  optionsTitle: "Optionen",
  languageHeading: "Sprache",
  moneyHeading: "Geld",
  followLanguage: "folgt",
  cropSellsFor: (price) => `Eine Ernte bringt ${price}`,

  storeTitle: (money) => `Dorfladen — ${money}`,
  storeFooter: "Sie kauft deine Ernte und verkauft Sachen für den Garten.",
  sheBuys: "Sie kauft",
  sheSells: "Sie verkauft",
  stockRow: (fixture, price) => `${FIXTURES[fixture]?.bare}\n${price}`,
  cropRow: (plant, held, price) => `${held} x ${PLANTS[plant]?.bare}\n${price} je`,
  buyTitle: (fixture, count, price) => `${count} x ${FIXTURES[fixture]?.bare} — zahle ${price}`,
  sellTitle: (plant, count, price) => `${count} x ${PLANTS[plant]?.bare} — sie zahlt ${price}`,
  onTheCounter: (total) => `auf dem Tresen: ${total}`,
  moreToGo: (amount) => `Es fehlen noch ${amount}.`,
  tooMuch: (amount) => `${amount} zu viel.`,
  exactlyRight: "Genau richtig — tipp auf „zahlen“.",
  tooExpensive: "Das ist mehr Geld, als du hast.",
  paidFor: (fixture, count) => `Bezahlt. ${DE.count(fixture, count)} im Kasten.`,
  sheCountsOut: "sie zählt ab:",
  countHerCoins: "Zähl ihre Münzen. Stimmt das Geld?",
  back: "zurück",
  pay: "zahlen",
  done: "fertig",
  clear: "leeren",
  thatsRight: "stimmt",
  thatsWrong: "stimmt nicht",

  verdictExact: (owed) => `Richtig — genau ${owed}.`,
  verdictSpotted: (paid, owed, short) =>
    `Gut aufgepasst. Das waren ${paid} statt ${owed} — ${short ? "zu wenig" : "zu viel"}. Sie gleicht es aus.`,
  verdictWasRight: (owed) => `Es stimmte doch: ${owed}. Sie zählt es noch einmal vor.`,
  verdictLookAgain: (paid, owed) => `Schau noch einmal — das waren ${paid}, nicht ${owed}.`,

  postmanGreeting: "Der Postbote kommt herüber — er hat etwas für dich.",
  introTitle: "Willkommen im Dorf",
  intro: (beat) => INTRO_DE[beat] ?? "",

  teacherGreeting: "Die Lehrerin schaut von ihrem Pult auf.",
  lessonTitle: "Der Additionszauber",
  lessonRune:
    "Öffne dein Zauberbuch und tipp auf die +-Rune. Was vor dir steht, wächst einen Schritt — aber nur, wenn du die Aufgabe lösen kannst.",
  lessonSplit: (addend, parts) =>
    `Zerleg die Zahl. ${addend} ist ${parts.join(" und ")}. Jede Zahl besteht aus Hundertern, Zehnern und Einern — und das sind die drei Sprünge.`,
  lessonJump: (start, jumps) =>
    `Fang bei ${start} an und spring zuerst den kleinen Teil: ${jumps.map((jump) => `+${jump}`).join(", dann ")}. Schreib in jedes Kästchen die Zahl, auf der du landest.`,
  lessonAnswer: (answer) =>
    `Im letzten Kästchen steht die Lösung: ${answer}. Weil du klein anfängst, ändert sich jedes Mal nur ein Teil der Zahl — nichts zu übertragen, nichts im Kopf zu behalten.`,
  lessonNext: "weiter",
  lessonBack: "zurück",
  lessonDone: "ab in den Garten",
  lessonExample: (start, addend) => `${start} + ${addend}`,

  place: (index) => PLACES[index] ?? "",
  jumpPrompt: (index) => `Spring die ${PLACES[index] ?? ""}. Wo landest du?`,
  addPlace: (index, from) => `Addiere die ${PLACES[index] ?? ""} zu ${from}.`,
  sumQuestion: (from, jump) => `${from} + ${jump} = ?`,
};
