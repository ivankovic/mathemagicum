// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { AnimalKind } from "../world/animals";
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
  /** A chicken, a duck, a cat or a rabbit, in the forms a sentence needs. */
  animal: (kind: AnimalKind) => Noun;
  fixture: (fixture: FixtureType) => Noun;
  item: (item: ItemType) => Noun;
  stage: (stage: PlantStage) => string;
  terrain: (terrain: TerrainType) => string;
  /** Rooms come from the asset sidecars, so this takes the generator's name. */
  room: (room: string) => string;
  /** "3 carrots", "1 cactus" — the plural the message line needs. */
  count: (item: ItemType, count: number) => string;

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
  /** Nothing in front of you for the clearing spell to take. */
  nothingToClear: string;
  /** Something there, but not something the spell will unmake. */
  willNotClear: string;
  cleared: string;
  tooFarToSpeak: string;
  /**
   * The same, for something rooted to the spot rather than somebody standing.
   *
   * One line for every landmark rather than one each. It said "walk up to
   * the tree first" while there was only a tree, and went on saying it at
   * the town clock — a message naming the wrong object is worse than a
   * general one, because a child reads it and looks for a tree.
   */
  tooFarFromLandmark: string;
  cannotWalkThere: string;
  /** What the great tree says when it is touched. */
  greatTreeGreeting: string;
  /** The other two landmarks, which teach nothing yet but are not silent. */
  lighthouseGreeting: string;
  clockTowerGreeting: string;
  entered: (room: string) => string;

  // --- the title card ------------------------------------------------------

  /** The line under the game's name. */
  titleTagline: string;
  /** What the bar is doing. */
  titleLoading: string;
  /** And what to do once it has finished. */
  titlePlay: string;

  // --- the map on the tower wall -------------------------------------------

  mapTitle: string;
  mapYouAreHere: string;
  /** The places marked on it, by the id world generation gives them. */
  placeName: (place: string) => string;

  // --- the geometry teacher, in the tower ----------------------------------

  /** Said when he is tapped, before the parchment opens. */
  geometerGreeting: string;
  /** Tapping the portal rune before anybody has taught it. */
  portalUntaught: string;
  /** Said once, the first time the geometer explains it. */
  portalTaught: string;
  geometryLessonTitle: string;
  geometryRune: string;
  /** One mark is this many paces, and you are nought. */
  geometryRuler: (paces: number) => string;
  geometryLegs: (
    across: string,
    acrossMarks: number,
    down: string,
    downMarks: number,
    total: number,
  ) => string;
  geometryCrow: (acrossMarks: number, downMarks: number, squares: number, crow: number) => string;

  // --- the portal spell ----------------------------------------------------

  portalTitle: string;
  /** Above the map, while a destination is still being chosen. */
  portalChoose: string;
  /** Tapped a place nobody has walked to yet. */
  portalLocked: string;
  /** Tapped the place you are standing in. */
  portalHereAlready: string;
  /** What one mark on the ruler is worth, in paces. */
  portalScale: (paces: number) => string;
  /** The question, one per rung of the spell's own ladder. */
  portalAskCount: string;
  portalAskRead: (towards: string) => string;
  portalAskAdd: string;
  portalAskCrow: string;
  /** A direction, for the question and for the legs. */
  portalCompass: (towards: string) => string;
  /** The help that arrives after two wrong answers. */
  portalHintCount: (stones: number) => string;
  portalHintRead: (towards: string, marks: number) => string;
  portalHintLegs: (across: string, acrossMarks: number, down: string, downMarks: number) => string;
  /**
   * The crow's flight needs its own, and this is why.
   *
   * Every other rung's help is one rung's worth: whatever the tier above
   * would have had drawn for it. At the crow rung the legs are *not* that —
   * a child there can already read them off the ruler, and being handed them
   * twice leaves them exactly where they were with nowhere to go but out of
   * the spell. So this names the method instead, and stops one step short of
   * the answer.
   */
  portalHintCrow: (acrossMarks: number, downMarks: number, squares: number) => string;
  /** Said on the other side. */
  portalArrived: (place: string) => string;

  // --- the great tree, in the enchanted forest ------------------------------

  /** Tapping the array rune before the tree has taught it. */
  arrayUntaught: string;
  /** Said once, when the tree's grove is finally full. */
  arrayTaught: string;
  /**
   * What the tree is waiting for, as it stands.
   *
   * One phrase for the whole task rather than one per step, because the
   * steps are a sentence about the same thing: the ground, then the bed,
   * then how much of it is ripe.
   */
  groveAsks: (progress: {
    task: string;
    standing: number;
    ripe: number;
    squares: number;
  }) => string;
  /** The heading over the task page, which is not the lesson's heading. */
  groveTaskTitle: string;
  /**
   * The bargain, under the task. The task says what is left to do; this says
   * what it is for, which is the half a child cannot work out for themselves.
   */
  groveBargain: string;
  /** What an animal is hoping for, when you have not got it. */
  animalAsks: (kind: AnimalKind, wants: PlantType) => string;
  /** Handing it over. */
  animalFed: (kind: AnimalKind, wants: PlantType) => string;
  /**
   * It has had something already.
   *
   * Says that it will be hungry again, because being fed is not written down
   * anywhere — a child who fed four chickens and came back to four bubbles
   * would otherwise read it as the game having lost their afternoon.
   */
  animalFull: (kind: AnimalKind) => string;
  /** It is not asking, and it has not just been fed either. */
  animalNotHungry: (kind: AnimalKind) => string;
  animalTooFar: (kind: AnimalKind) => string;
  groveLessonTitle: string;
  /** One idea per page, in the order the tree shows them. */
  groveRune: string;
  groveRows: (rows: number, columns: number) => string;
  groveCount: (rows: number, columns: number, total: number) => string;
  groveTurn: (rows: number, columns: number, total: number) => string;

  // --- the multiplication spell --------------------------------------------

  /** `4 x 6`, over the array. */
  arrayTitle: (rows: number, columns: number) => string;
  /** Said when the rune is tapped: mark out the ground you mean. */
  arrayMarkOut: string;
  /** Both corners on one square. One square is not a multiplication. */
  arrayTooSmall: string;
  /** A patch with nothing in it any of the three actions could touch. */
  arrayNothingToDo: string;
  /** Both corners set: now pick what to do with what you marked. */
  arrayChooseAction: string;
  /** A button on the little menu over a marked patch, and its tally. */
  patchAction: (action: string, count: number) => string;
  /** What happened, once the patch has been cast on. */
  patchDone: (action: string, count: number) => string;
  /** The question under it. */
  arrayAsk: string;
  /** No patch of clear ground that shape, from the tile she is facing. */
  noRoomForArray: (rows: number, columns: number) => string;
  /** The help that arrives after a wrong answer: count along, row by row. */
  arrayHintRows: (columns: number, counted: number) => string;
  /** What was planted, once the spell lands. */
  arrayPlanted: (plant: string, count: number) => string;

  // --- the hourglass spell -------------------------------------------------

  hourglassTitle: string;
  /** The question under the two faces. */
  hourglassAsk: string;
  /** Which face is which: when you put it down, and now. */
  hourglassLeft: string;
  hourglassBack: string;
  /** The help, once the sweep has been drawn: count on from here. */
  hourglassCountOn: (hours: number) => string;
  hourglassSolved: (hours: number) => string;
  /** Nothing to claim: the glass reads the same hour it did. */
  hourglassNoTime: string;
  /** Hours passed, but there is nothing in the ground for them to fall on. */
  hourglassNothingGrowing: string;
  /** Tapping the rune before the astronomer has taught it. */
  hourglassUntaught: string;
  /** Said once, when the last lamp on the climb is lit. */
  hourglassTaught: string;
  /** What she says when the way is already lit and the spell already given. */
  astronomerGreeting: string;
  /** How many posts are still dark, and how many lamps she has just handed over. */
  astronomerAsks: (dark: number, given: number) => string;
  /** Every remaining post has something standing on it. */
  astronomerBlocked: string;
  /** The chart of the night on the dome's wall, when it is tapped. */
  starChartRead: string;
  /** What grew while they were away. */
  hourglassGrew: (count: number) => string;

  // --- the purse -----------------------------------------------------------

  /** What one kind of coin in the purse comes to, when its button is tapped. */
  purseTier: (count: number, amount: string) => string;
  /** Nothing in it at all. */
  purseEmpty: string;

  // --- options -------------------------------------------------------------

  optionsButton: string;
  optionsTitle: string;
  languageHeading: string;
  cropSellsFor: (price: string) => string;

  // --- who is playing ------------------------------------------------------

  /** The heading over the faces. */
  playersTitle: string;
  /** The tile that makes a new player. */
  newPlayer: string;
  /** Over the name box and the swatches, when a player is being made. */
  makePlayerTitle: string;
  namePrompt: string;
  /** The three rows of swatches, and the row of bodies. */
  skinHeading: string;
  hairHeading: string;
  shirtHeading: string;
  bodyHeading: string;
  /** Commits the new player. */
  startPlaying: string;
  /** Goes back to the faces without making anybody. */
  neverMind: string;
  /** Shown instead of the "+" tile once the device is full. */
  deviceFull: (most: number) => string;
  /** The button that opens the are-you-sure. */
  deletePlayer: string;
  /** Named, and unmistakable about what goes with them. */
  deleteAreYouSure: (name: string) => string;
  deleteYes: string;
  deleteNo: string;
  /** Said once, on the first frame, when a world had to be rebuilt. */
  worldRebuilt: string;
  /**
   * Over the row of sample sums.
   *
   * A question about the sums rather than about the child: "how big are your
   * sums" can be answered by looking, and it does not rank anybody on a
   * screen they share with their siblings.
   */
  sumsHeading: string;

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
