// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { Currency } from "../shop/currency";
import type { FixtureType } from "../world/fixtures";
import type { ItemType } from "../world/inventory";
import type { PlantStage, PlantType } from "../world/plants";
import type { TerrainType } from "../world/terrain";

/**
 * Every word the player reads, in one shape per language.
 *
 * Two decisions hold this together, and both exist because the alternative
 * was already visible in the code this replaced:
 *
 * **Phrases are functions, not templates with holes.** A message is written
 * out by the language that owns it, so German can put the verb where German
 * puts the verb instead of following English's word order with German words
 * dropped into it. `${plant} is now ${stage}` is an English sentence wearing
 * a translation.
 *
 * **Nouns carry their forms.** German needs the accusative and a negative to
 * say "put down a fence" and "you have no fence", and it needs them per noun
 * because the article depends on gender. Every language therefore supplies a
 * `Noun` per thing rather than a bare string, and the sentences ask for the
 * form they need. English fills all four fields from the same word, which
 * costs a few lines and means no sentence is written twice.
 *
 * The interface is the contract: a language that forgets a phrase does not
 * compile, so nothing can fall back to English at runtime without saying so.
 */

/**
 * A thing the player can hold or stand in front of, in the forms a sentence
 * needs it in.
 *
 * `bare` names it, `indefinite` is "a fence" for a sentence that introduces
 * one, `definite` is "the fence" for one already on screen, `none` is "no
 * fence", and `plural` is what a count is followed by.
 */
export interface Noun {
  readonly bare: string;
  readonly indefinite: string;
  readonly definite: string;
  readonly none: string;
  readonly plural: string;
}

export interface Phrases {
  // --- names ---------------------------------------------------------------

  plant: (plant: PlantType) => Noun;
  fixture: (fixture: FixtureType) => Noun;
  item: (item: ItemType) => Noun;
  stage: (stage: PlantStage) => string;
  terrain: (terrain: TerrainType) => string;
  /** Rooms come from the asset sidecars, so this takes the generator's name. */
  room: (room: string) => string;
  /** "3 carrots", "1 cactus" — the plural the message line needs. */
  count: (item: ItemType, count: number) => string;
  currencyName: (currency: Currency) => string;

  // --- gardening -----------------------------------------------------------

  nothingGrowsIndoors: string;
  noRoomToPlant: string;
  alreadyPlanted: string;
  wrongGround: (plant: PlantType, terrain: TerrainType) => string;
  planted: (plant: PlantType) => string;
  faceToGrow: string;
  alreadyGrown: (plant: PlantType) => string;
  grownTo: (plant: PlantType, stage: PlantStage) => string;
  picked: (plant: PlantType, held: number) => string;
  notRipe: (plant: PlantType) => string;
  faceToPick: string;

  // --- things she puts down ------------------------------------------------

  notInHere: string;
  notYours: (fixture: FixtureType) => string;
  noneLeft: (fixture: FixtureType) => string;
  noRoomThere: string;
  somethingGrowing: string;
  putDown: (fixture: FixtureType) => string;
  tooFarToReach: string;
  pickedUp: (fixture: FixtureType, held: number) => string;

  // --- the world -----------------------------------------------------------

  spellFades: string;
  tooFarToSpeak: string;
  cannotWalkThere: string;
  entered: (room: string) => string;

  // --- the status line -----------------------------------------------------

  statusOptions: string;
  statusStore: string;
  statusSeeds: string;
  statusSpells: string;
  statusCrateEmpty: string;
  statusCrate: string;
  statusBasketEmpty: string;
  statusCarrying: (total: number, kinds: number) => string;
  hintTouch: string;
  hintKeys: (plant: PlantType) => string;

  // --- options -------------------------------------------------------------

  optionsButton: string;
  optionsTitle: string;
  languageHeading: string;
  moneyHeading: string;
  followLanguage: string;
  cropSellsFor: (price: string) => string;

  // --- the shop ------------------------------------------------------------

  storeTitle: (money: string) => string;
  storeFooter: string;
  sheBuys: string;
  sheSells: string;
  /** A row on her side of the counter: what it is and what it costs. */
  stockRow: (fixture: FixtureType, price: string) => string;
  /** A row on the player's side: how many she has and what each fetches. */
  cropRow: (plant: PlantType, held: number, price: string) => string;
  buyTitle: (fixture: FixtureType, count: number, price: string) => string;
  sellTitle: (plant: PlantType, count: number, price: string) => string;
  onTheCounter: (total: string) => string;
  moreToGo: (amount: string) => string;
  tooMuch: (amount: string) => string;
  exactlyRight: string;
  tooExpensive: string;
  paidFor: (fixture: FixtureType, count: number) => string;
  sheCountsOut: string;
  countHerCoins: string;
  back: string;
  pay: string;
  done: string;
  clear: string;
  thatsRight: string;
  thatsWrong: string;

  // --- her arithmetic ------------------------------------------------------

  verdictExact: (owed: string) => string;
  verdictSpotted: (paid: string, owed: string, short: boolean) => string;
  verdictWasRight: (owed: string) => string;
  verdictLookAgain: (paid: string, owed: string) => string;

  // --- the postal worker's welcome ------------------------------------------

  /** What he says as he walks up, before the parchment opens. */
  postmanGreeting: string;
  introTitle: string;
  /** One page of the welcome. The beat names are IntroBeat's. */
  intro: (beat: string) => string;

  // --- the teacher's lesson ------------------------------------------------

  /** What she says when tapped, before the parchment opens. */
  teacherGreeting: string;
  lessonTitle: string;
  /** Beat one: the spellbook and the rune, which are drawn beside this. */
  lessonRune: string;
  /** Beat two: the number pulled apart into hundreds, tens and ones. */
  lessonSplit: (addend: number, parts: readonly number[]) => string;
  /** Beat three: the jumps along the line, smallest first. */
  lessonJump: (start: number, jumps: readonly number[]) => string;
  /** Beat four: where you land, and why the order is that way round. */
  lessonAnswer: (answer: number) => string;
  lessonNext: string;
  lessonBack: string;
  lessonDone: string;
  /** The caption under the worked example on every beat that shows numbers. */
  lessonExample: (start: number, addend: number) => string;

  // --- the addition spell --------------------------------------------------

  /** "ones", "tens", "hundreds" — index 0 is the ones. */
  place: (index: number) => string;
  jumpPrompt: (index: number) => string;
  addPlace: (index: number, from: number) => string;
  sumQuestion: (from: number, jump: number) => string;
}
