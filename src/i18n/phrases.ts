// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { AnimalKind } from "../world/animals";
import type { FixtureType } from "../world/fixtures";
import type { ItemType } from "../world/inventory";
import type { PlantStage, PlantType } from "../world/plants";
import type { Buyable } from "../world/shop";
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
  /**
   * The name of anything the player can hold or buy.
   *
   * `Buyable` as well as `ItemType`, because a piece of furniture is two
   * things with two names: `chair~2` is what sits in the basket and `chair`
   * is what the shop sells. Both have to be nameable, and it is the same
   * noun either way.
   */
  item: (item: ItemType | Buyable) => Noun;
  stage: (stage: PlantStage) => string;
  terrain: (terrain: TerrainType) => string;
  /** Rooms come from the asset sidecars, so this takes the generator's name. */
  room: (room: string) => string;
  /** "3 carrots", "1 cactus" — the plural the message line needs. */
  count: (item: ItemType | Buyable, count: number) => string;

  // --- gardening -----------------------------------------------------------

  // --- things she puts down ------------------------------------------------

  // --- the world -----------------------------------------------------------

  cleared: string;

  // --- the title card ------------------------------------------------------

  /** The line under the game's name. */
  titleTagline: string;
  /** What the bar is doing. */
  titleLoading: string;
  /**
   * And what it is doing *now*: how far through, and the last thing to
   * arrive.
   *
   * "loading…" on its own is fine right up until it stops, and then it is
   * the least useful line on the screen — a load that has stalled looks
   * exactly like a load that is slow. `what` is the loader's own key for a
   * file, which is not a word in any language and is not translated.
   */
  titleLoadingWhat: (done: number, total: number, what: string) => string;
  /** Something did not arrive at all. */
  titleLoadFailed: (what: string) => string;
  /** And what to do once it has finished. */
  titlePlay: string;

  // --- the map on the tower wall -------------------------------------------

  mapTitle: string;
  mapYouAreHere: string;
  /** The places marked on it, by the id world generation gives them. */
  placeName: (place: string) => string;

  // --- the geometry teacher, in the tower ----------------------------------

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

  // --- the great tree, in the enchanted forest ------------------------------

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
  groveLessonTitle: string;
  /** One idea per page, in the order the tree shows them. */
  groveRune: string;
  groveRows: (rows: number, columns: number) => string;
  groveCount: (rows: number, columns: number, total: number) => string;
  groveTurn: (rows: number, columns: number, total: number) => string;

  // --- the multiplication spell --------------------------------------------

  /** `4 x 6`, over the array. */
  arrayTitle: (rows: number, columns: number) => string;
  /** The question under it. */
  arrayAsk: string;
  /** The help that arrives after a wrong answer: count along, row by row. */
  arrayHintRows: (columns: number, counted: number) => string;

  // --- building a room -----------------------------------------------------

  /** Over the wall of bricks. */
  brickTitle: string;
  /** The rule, said once under the title. The picture says the rest. */
  brickAsk: string;
  /** What a wrong brick says. Never a scolding, and never the answer. */
  brickWrong: string;
  /** The line under a finished wall. */
  brickDone: string;
  /**
   * The help, when it comes: which way the working goes.
   *
   * Two lines rather than one, and the difference is the whole of the spell.
   * A brick with two bricks under it is added up to; a gap under a brick
   * that is already known has to be taken away from. The two lit bricks say
   * *where*; these say *what to do with them*.
   */
  brickHintAdd: string;
  brickHintTakeAway: string;

  // --- the mirror -----------------------------------------------------------

  /** Over the grid. */
  mirrorTitle: string;
  /**
   * The rule, said once under the title.
   *
   * The hardest line here to write, because the word for what is being asked
   * — "an axis of symmetry" — is one most children meeting this have not
   * been given yet, and giving it in a caption teaches nothing. So the
   * caption says what to *do*, and the name is what the astronomer supplies
   * when she teaches the spell.
   */
  mirrorAsk: string;
  /** What a square that is not part of the answer says. Never a scolding. */
  mirrorWrong: string;
  /** The line under a finished grid. */
  mirrorDone: string;
  /** The help, when it comes: one square, outlined, and named as one. */
  mirrorHint: string;

  // --- the hourglass spell -------------------------------------------------

  hourglassTitle: string;
  /** The question under the two faces. */
  hourglassAsk: string;
  /** Said while the clock has not been turned: there is no sum yet. */
  hourglassTurnIt: string;
  /** Caption under the face that shows what the clock says now. */
  hourglassNow: string;
  /** And under the one whose hands she is moving. */
  hourglassTo: string;
  /** What the two answer boxes are counting. */
  hourglassHours: string;
  hourglassMinutes: string;
  /** Which face is which: when you put it down, and now. */
  /** The help, once the sweep has been drawn: count on from here. */
  hourglassCountOn: (hours: number) => string;
  hourglassSolved: (hours: number) => string;

  // --- the purse -----------------------------------------------------------

  // --- options -------------------------------------------------------------

  optionsButton: string;
  optionsTitle: string;
  languageHeading: string;

  // --- about ---------------------------------------------------------------
  //
  // The one screen in this game that is a wall of text, and it earns it: it
  // is addressed to whoever is paying for the tablet rather than to the child
  // holding it, and what it has to say cannot be said in pictures.

  /** Opens it, from the options. */
  aboutButton: string;
  aboutTitle: string;
  /** Who wrote it, and the notice the licence asks to travel with it. */
  madeBy: string;
  copyright: string;
  licenceLine: string;
  /**
   * What is asked of anybody thinking of paying, which is mostly *do not*.
   *
   * Written by the author and reproduced as given. It is the closest thing
   * this game has to a position, and paraphrasing it — in either language —
   * would be editing somebody's ethics for them.
   */
  sponsorNote: string;
  /** The two ways out to the web. */
  sourceLink: string;
  sponsorLink: string;

  // --- who is playing ------------------------------------------------------

  /** The heading over the faces. */
  playersTitle: string;
  /** The tile that makes a new player. */
  newPlayer: string;
  /**
   * Over the flags, on the first of the three steps that make a player.
   *
   * Written in whatever language the screen is already in, which is not
   * necessarily one this child reads — so it is one word, and the flags
   * under it are what actually carries the question. It re-titles itself
   * the moment a flag is tapped, which is the fastest way to show that the
   * tap did something.
   */
  tongueTitle: string;
  /** Over the name box and the swatches, on the second step. */
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
  /**
   * Over the row of sample sums.
   *
   * A question about the sums rather than about the child: "how big are your
   * sums" can be answered by looking, and it does not rank anybody on a
   * screen they share with their siblings.
   */
  sumsHeading: string;
  /**
   * Over the sums, on the third step.
   *
   * The title says what is being chosen; the four sums under it say what
   * the choice *is*. That division is deliberate — a parent looking for
   * where the difficulty lives needs the word, and a child picking needs
   * the sums, and neither is served by making the other read the wrong one.
   */
  sumsTitle: string;
  /** Moves on to the next of the three steps. */
  nextStep: string;
  /**
   * The three notices a parent is walked through while a player is made.
   *
   * Sentences rather than headings, and the pictures under them carry as
   * much as the words do — the panels are drawn for a grown-up who may be
   * reading a language they only half have, and for a child who will
   * otherwise tap past all three before anybody sees them.
   *
   * After the flags, so they are read in a language somebody chose, and
   * before the name box, so the grown-up is still the one holding the
   * tablet. Shown every time a player is made rather than once on a fresh
   * device: it is three taps, the second person to set a child up here may
   * be a different adult, and the one about backups is the one message in
   * the game worth repeating.
   */
  parentsNotice: string;
  offlineNotice: string;
  backupNotice: string;
  /** The options row that writes every save on this device into one file. */
  exportSaves: string;
  /** Said on the button once the file has gone. */
  exportDone: string;
  /**
   * The button on the who's-playing screen that reads a backup file.
   *
   * There and not in the options, which is where its opposite lives. A
   * tablet being restored has nothing on it yet — no child to pick, no game
   * to open — so the options panel is behind a door that cannot be reached
   * from where somebody restoring a lost device is standing.
   */
  importSaves: string;
  /**
   * What agreeing to it costs, named the way removing a player is.
   *
   * Everything, is the answer, and it has to say so: a backup is a whole
   * tablet rather than one game, so restoring one puts every child and
   * every world in the file over every child and every world on the device.
   */
  importAreYouSure: string;
  importYes: string;
  importNo: string;
  /** When the file was not one of ours. */
  importNotASave: string;
  /** The options row that throws the world away. */
  /** The options row that lists the games saved on this device. */
  gamesHeading: string;
  /** When a saved game was last written down, for telling them apart. */
  gameWhen: (savedAt: number) => string;
  /** What throwing one away costs, said in words. */
  deleteGameAsk: string;

  // --- the shop ------------------------------------------------------------

  storeTitle: (money: string) => string;
  storeFooter: string;
  sheBuys: string;
  sheSells: string;
  /** A row on her side of the counter: what it is and what it costs. */
  stockRow: (thing: Buyable, price: string) => string;
  /** A row on the player's side: how many she has and what each fetches. */
  cropRow: (item: ItemType, held: number, price: string) => string;
  buyTitle: (thing: Buyable, count: number, price: string) => string;
  sellTitle: (item: ItemType, count: number, price: string) => string;
  onTheCounter: (total: string) => string;
  moreToGo: (amount: string) => string;
  tooMuch: (amount: string) => string;
  exactlyRight: string;
  tooExpensive: string;
  paidFor: (thing: Buyable, count: number) => string;
  sheCountsOut: string;
  countHerCoins: string;
  /** The same question, when her money is in piles rather than loose. */
  countHerPiles: string;
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

  introTitle: string;
  /** One page of the welcome. The beat names are IntroBeat's. */
  intro: (beat: string) => string;

  // --- the teacher's lesson ------------------------------------------------

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
