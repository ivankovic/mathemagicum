// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { Spell } from "../spells/spellbook";
import { FixtureType } from "./fixtures";
import type { Inventory } from "./inventory";
import { MaterialType } from "./materials";
import { PLANT_TYPES } from "./plants";

/**
 * The things a player builds rather than buys.
 *
 * The playtesters asked for machines and for the ability to build things
 * that do something, and the second half of that is the half with a design
 * decision in it. Everything a child can put down today came off a shelf:
 * they earned coins, the shopkeeper took them, a fence came back. A machine
 * built the same way would be one more line on that shelf.
 *
 * So a machine is made out of **what the world gave up** — the wood and
 * stone the clearing spell pays. That is not decoration on the economy. The
 * design doc says in as many words that subtraction is *"the spell this game
 * under-uses"*, and the only thing wood and stone could be used for until
 * now was to be sold, which makes them coins with an extra step. Giving them
 * somewhere else to go is what turns clearing a wood into building
 * something, and it is the cheapest honest reason to cast the spell.
 *
 * **The recipe is the whole of the mechanic here, and it is deliberately
 * not a puzzle.** No assembly minigame, no parts to fabricate, no stages.
 * A child who has the materials walks to a square and the machine is there.
 * A sum standing between a child and the machine that teaches the sum would
 * be a lock on the door of the classroom.
 *
 * **A machine embodies arithmetic; a spell tests it.** That is the rule the
 * rest of this file follows, and it is worth stating because the obvious
 * design breaks it. A machine that asked a question every time it ran would
 * be a second spell with a worse interface — and then there is no reason to
 * have machines at all, because everything they offer a child already has.
 * So the sorter *does* division where it can be watched: one heap in at the
 * top, equal shares out at the bottom, the remainder left visibly in the
 * mouth. Nobody is quizzed. A child who learned `÷` by casting it has built
 * a thing that divides for them from now on, which is the reward for having
 * understood it.
 *
 * **What gates a machine is the spell on the way in.** Twice over: it has to
 * be woken once, by the spell whose arithmetic it does — see `SPARK` — and
 * after that it can only ever chew through what casting put in front of it,
 * because wood comes from clearing and crops come from growing. Total
 * material in the world stays a function of spellwork. A machine changes
 * things and moves things; it never conjures them.
 */

/** Which fixtures are machines. Every one of these is built, never sold. */
export const MachineType = {
  /**
   * A hopper, a wheel and three crates.
   *
   * The first, and chosen first because it is a picture of its own
   * arithmetic: one heap in at the top, equal shares out at the bottom. It
   * also had the least new machinery behind it — the share spell's parchment
   * already existed and needed a reason to be opened, and waking a sorter is
   * that reason.
   */
  Sorter: FixtureType.Sorter,
  /**
   * A glass frame with three shoots coming up in it.
   *
   * The second, and the pair to the sorter. A sorter *deals* — it divides a
   * heap you already had into equal parts, and nothing leaves it that did
   * not go in. This one *turns*: a crop goes in and timber comes out, which
   * is the difference between the two verbs and the reason there are two
   * machines rather than one with a setting.
   *
   * It is also the answer to a question the garden did not have one for.
   * Growing was a thing a child did once per square and then sold the
   * result of; now a crop is worth as much standing as a tree is worth
   * felled, so growing the same carrot again is a way to build.
   */
  Hothouse: FixtureType.Hothouse,
} as const;

export type MachineType = (typeof MachineType)[keyof typeof MachineType];

export const MACHINE_TYPES: readonly MachineType[] = Object.values(MachineType);

/** Whether a fixture is one of them. */
export function isMachine(fixture: FixtureType): fixture is MachineType {
  return (MACHINE_TYPES as readonly FixtureType[]).includes(fixture);
}

/** What one machine is made of, as a count per material. */
export type Recipe = Readonly<Partial<Record<MaterialType, number>>>;

/**
 * What each costs, in what the world gives up.
 *
 * **Sized against a walk, not against a wallet.** A conifer is three wood
 * and a boulder is two stone, so a sorter is about five trees and three
 * rocks — an afternoon in a wood, which a five-hundred-cell world has
 * thirteen thousand scattered objects to supply. Small enough that a child
 * who wants one can have one; large enough that they will have cast the
 * clearing spell a dozen times on the way, which is the point.
 *
 * **Both materials, on purpose.** A recipe in one material is a number; a
 * recipe in two is a *plan*, because the wood and the stone are in different
 * places — the trees are in the woodland and the boulders are up the hills.
 * That is the first time this game has asked a child to go to two places for
 * one thing, and it is the cheapest way to make the world's terrain matter
 * to something other than what will grow on it.
 */
export const RECIPES: Readonly<Record<MachineType, Recipe>> = {
  [MachineType.Sorter]: { [MaterialType.Wood]: 15, [MaterialType.Stone]: 6 },
  // More stone and less wood than the sorter, and the shape of that is the
  // point rather than the size: this one is mostly glass and a glasshouse is
  // sand and fire, so it is the machine that sends a child up the hills.
  // Two machines with the same shopping list would be two machines that were
  // the same errand.
  [MachineType.Hothouse]: { [MaterialType.Wood]: 8, [MaterialType.Stone]: 12 },
};

/** What a machine is made of, as pairs, in a stable order. */
export function recipeFor(machine: MachineType): readonly (readonly [MaterialType, number])[] {
  const recipe = RECIPES[machine];
  return Object.entries(recipe)
    .filter((entry): entry is [MaterialType, number] => typeof entry[1] === "number")
    .sort(([left], [right]) => left.localeCompare(right));
}

/**
 * Whether everything the recipe asks for is in the basket.
 *
 * The question the crate asks to decide whether to draw the slot lit or
 * dimmed — the spellbook's dimmed rune, one tray along. A machine a child
 * cannot build yet is still *shown*, because a crate with a gap in it says
 * there is something to go and fetch.
 */
export function canBuild(held: Inventory, machine: MachineType): boolean {
  return recipeFor(machine).every(([material, count]) => held.count(material) >= count);
}

/**
 * Take the materials out, and say whether it happened.
 *
 * **All or nothing across every material**, which `Inventory.remove` cannot
 * promise on its own: it is all-or-nothing per item, so a build that spent
 * the wood and then found there was not enough stone would have eaten the
 * wood. Checked first, then spent — the two-line version of a transaction,
 * and enough of one when nothing else is writing to the basket in between.
 */
export function build(held: Inventory, machine: MachineType): boolean {
  if (!canBuild(held, machine)) return false;
  for (const [material, count] of recipeFor(machine)) held.remove(material, count);
  return true;
}

// --- what a machine is doing ------------------------------------------------

/**
 * How many ways a sorter deals.
 *
 * Three, because the drawing has three crates under it and the drawing is
 * the promise. A child can count the boxes before they ever tip anything in,
 * and a machine that dealt four ways would be lying in the one place this
 * game cannot afford to: the picture *is* the explanation of the arithmetic.
 */
export const SHARES = 3;

/**
 * How long one round of dealing takes, in minutes of work.
 *
 * A round is one thing into every crate — see `advance`. Twenty minutes is
 * slow enough that standing over it is not the way to use it and fast enough
 * that a single cast of the hourglass, which winds at most twelve hours,
 * clears a heap of thirty-odd. That ratio is the design: the clock spell is
 * how a child hurries a machine, and hurrying it is worth doing.
 */
export const MINUTES_PER_ROUND = 20;

/**
 * Which spell wakes each machine: the one whose arithmetic it does.
 *
 * Casting `÷` on the thing that divides, once, and then it divides for ever.
 * The spell is not a toll — it is the machine asking to be shown the sum it
 * is about to spend its life doing, and it asks exactly once. Every batch
 * after that is silent, which is the whole difference between a machine and
 * a spell.
 */
export const SPARK: Readonly<Record<MachineType, Spell>> = {
  [MachineType.Sorter]: Spell.Share,
  // Rows and columns, for the machine that turns one into three.
  [MachineType.Hothouse]: Spell.Array,
};

/**
 * What each machine does with a round's work, and to what.
 *
 * Two verbs, and the difference between them is the whole reason there are
 * two machines. **Dealing** divides a heap that is already there into the
 * crates, and nothing leaves a sorter that did not go into it. **Turning**
 * changes what a thing is: one crop out of the mouth, three of something
 * else into the crates.
 *
 * The `gives` is a content decision sitting in one line on purpose. What a
 * hothouse pays and how much of it is a number to argue about over a
 * playtest, not a shape to rewrite: three matches what a felled conifer
 * gives, so a crop grown is worth about a tree cleared, and a growth cast
 * and a clearing cast come out level.
 */
export const Verb = { Deal: "deal", Turn: "turn" } as const;
export type Verb = (typeof Verb)[keyof typeof Verb];

export interface Work {
  readonly verb: Verb;
  /** How many go into the mouth for one round. */
  readonly takes: number;
  /** What comes out, for a machine that turns. Null for one that deals. */
  readonly gives: string | null;
  /**
   * What it will take in, and this one is not decoration.
   *
   * A machine that turns one thing into three of another must not accept the
   * thing it makes. A hothouse that took timber would turn one wood into
   * three wood — an endless supply out of nothing, which would undo the rule
   * the whole design rests on: material in the world stays a function of
   * spellwork. It grows things, so it takes things that grow.
   *
   * A sorter takes anything, because dealing cannot mint: what comes out of
   * it is what went in, counted into three piles.
   */
  readonly wants: "anything" | "a crop";
}

export const WORK: Readonly<Record<MachineType, Work>> = {
  [MachineType.Sorter]: { verb: Verb.Deal, takes: SHARES, gives: null, wants: "anything" },
  [MachineType.Hothouse]: {
    verb: Verb.Turn,
    takes: 1,
    gives: MaterialType.Wood,
    wants: "a crop",
  },
};

/** Whether this machine will take this in. See `Work.wants`. */
export function accepts(machine: MachineType, item: string): boolean {
  return WORK[machine].wants === "anything" || (PLANT_TYPES as readonly string[]).includes(item);
}

/** What a machine is holding, and how far into the round it has got. */
export interface MachineState {
  /**
   * Whether it has been woken. A machine that has not is a sculpture: it
   * takes nothing in and does nothing, however long it is left.
   */
  readonly awake: boolean;
  /**
   * What is in the mouth, and how much of it.
   *
   * One kind at a time, which is what a hopper is — you tip a heap of wood
   * in, not an assortment. It is also what keeps the arithmetic legible: a
   * heap of one thing dealt into three piles is a division a child can see,
   * and a mixture dealt into three piles is a mess.
   */
  readonly holding: string | null;
  readonly heap: number;
  /** What has been dealt, one count per crate. Always `SHARES` long. */
  readonly crates: readonly number[];
  /**
   * What is in the crates, when that is not what is in the mouth.
   *
   * Null for a machine that deals, where the crates hold what was tipped in.
   * A machine that *turns* fills them with something else — a hothouse
   * holding carrots has timber in its crates — and the answer has to be
   * remembered rather than worked out at the moment of taking, because the
   * mouth can run empty while the crates are still full.
   */
  readonly made: string | null;
  /** Minutes of work into the round in progress. */
  readonly worked: number;
}

/** A machine as it comes: asleep, empty, and waiting to be shown a sum. */
export function newMachine(): MachineState {
  return {
    awake: false,
    holding: null,
    heap: 0,
    crates: Array(SHARES).fill(0),
    made: null,
    worked: 0,
  };
}

/** The same machine, woken. */
export function wake(state: MachineState): MachineState {
  return { ...state, awake: true };
}

/**
 * Tip a heap in.
 *
 * Refused if it is asleep, if the count is nonsense, or if it is already
 * holding something else — a hopper with wood in it does not take stone on
 * top. Refused rather than mixed, and refused rather than swapped: what is
 * in there is a child's, and a machine that quietly dropped it to make room
 * would be a machine that stole.
 */
export function feed(
  state: MachineState,
  item: string,
  count: number,
  machine: MachineType,
): MachineState | null {
  if (!state.awake || !Number.isFinite(count) || Math.trunc(count) <= 0) return null;
  if (!accepts(machine, item)) return null;
  if (state.holding !== null && state.holding !== item) return null;
  return { ...state, holding: item, heap: state.heap + Math.trunc(count) };
}

/**
 * Work for this many minutes, and deal what that comes to.
 *
 * **Whole rounds only, and that is the arithmetic.** A round puts one thing
 * into every crate, so a heap of thirteen dealt three ways is four rounds
 * and one left in the mouth — division with its remainder sitting where
 * anybody can see it, rather than division with the remainder explained.
 * Dealing a partial round would empty the mouth and put unequal piles in the
 * crates, which is the one thing a machine called a sorter must not do.
 *
 * The minutes are minutes the child was *there* for; see the scene. This
 * function does not know what a clock is, which is the point of it being
 * here rather than there.
 */
export function advance(state: MachineState, minutes: number, machine: MachineType): MachineState {
  if (!state.awake || !Number.isFinite(minutes) || minutes <= 0) return state;
  const work = WORK[machine];
  const worked = state.worked + minutes;
  const rounds = Math.min(
    Math.floor(worked / MINUTES_PER_ROUND),
    Math.floor(state.heap / work.takes),
  );
  if (rounds <= 0) {
    // Only bank the work if there is something to work on. A machine left
    // running on an empty mouth would otherwise store up months of it and
    // deal a whole heap the instant anything was tipped in.
    return state.heap >= work.takes ? { ...state, worked } : { ...state, worked: 0 };
  }
  return {
    ...state,
    heap: state.heap - rounds * work.takes,
    // A round fills every crate, whichever verb it is. Dealing puts one of
    // what went in into each; turning puts one of something else — and it is
    // the same three crates either way, so a child reads the two machines
    // the same way and so does everything downstream of here.
    crates: state.crates.map((count) => count + rounds),
    // What the crates hold is not always what the mouth holds. See `made`.
    made: work.gives,
    worked: worked - rounds * MINUTES_PER_ROUND,
  };
}

/**
 * Take one crate, and say what was in it.
 *
 * One crate rather than all three, because taking one share is the whole use
 * of the thing: a child who tips twelve in and takes one out has four, which
 * is an exact third they did not have to count out by hand.
 */
export function takeShare(
  state: MachineState,
  crate: number,
): { state: MachineState; item: string | null; count: number } {
  const index = Math.trunc(crate);
  const count = state.crates[index] ?? 0;
  // What comes out is what the machine *made*, and only a machine that deals
  // makes what it was given. Asking `holding` here was right while there was
  // one machine, and would have handed back carrots out of a hothouse.
  const made = state.made ?? state.holding;
  if (count <= 0 || made === null) return { state, item: null, count: 0 };
  const crates = state.crates.map((held, at) => (at === index ? 0 : held));
  // The mouth forgets what it was holding once the machine is empty, so the
  // next thing tipped in can be anything. A sorter that only ever accepted
  // wood again because it once held wood would be a sorter a child had to
  // remember the history of.
  const empty = crates.every((held) => held <= 0) && state.heap <= 0;
  return {
    state: {
      ...state,
      crates,
      holding: empty ? null : state.holding,
      made: empty ? null : state.made,
    },
    item: made,
    count,
  };
}

/**
 * Draw a few off the crates, for something that is not a child's hand.
 *
 * `takeShare` empties one crate because that is what a tap means — an exact
 * third, counted out by something that cannot miscount. A wire is not
 * taking a share; it is carrying, a little at a time, and it does not care
 * which crate a thing came out of. So this takes from the fullest first and
 * keeps going until it has what it was asked for or the crates are empty.
 */
export function drawOff(
  state: MachineState,
  many: number,
): { state: MachineState; item: string | null; count: number } {
  const item = state.made ?? state.holding;
  const wanted = Math.max(0, Math.trunc(many));
  if (item === null || wanted <= 0) return { state, item: null, count: 0 };
  const crates = [...state.crates];
  let taken = 0;
  while (taken < wanted) {
    const at = crates.reduce((best, count, i) => (count > (crates[best] ?? 0) ? i : best), 0);
    if ((crates[at] ?? 0) <= 0) break;
    crates[at] = (crates[at] ?? 0) - 1;
    taken++;
  }
  if (taken <= 0) return { state, item: null, count: 0 };
  const empty = crates.every((held) => held <= 0) && state.heap <= 0;
  return {
    state: {
      ...state,
      crates,
      holding: empty ? null : state.holding,
      made: empty ? null : state.made,
    },
    item,
    count: taken,
  };
}

/** Which crate to take from: the fullest, and the leftmost of a tie. */
export function fullestCrate(state: MachineState): number {
  let best = 0;
  for (let at = 1; at < state.crates.length; at++) {
    if ((state.crates[at] ?? 0) > (state.crates[best] ?? 0)) best = at;
  }
  return best;
}

// --- what a save remembers ---------------------------------------------------
//
// Its own map, keyed by the square the machine stands on, rather than a field
// on the `PlacedObject`. Two reasons, and the second is the one that matters:
// a placed object is a fact about how the world was *generated* and is
// compared against the generator's own baseline by a signature, and mutable
// state has no business in that comparison. And `isPlacedObject` waves unknown
// fields through unchecked, so a hand-edited save could put anything at all in
// there. This follows what the furniture does instead — encode, decode, and
// drop anything mangled rather than repair it.

/** One machine, written down: where it stands and what it is holding. */
export function machinesToSave(
  machines: ReadonlyMap<string, MachineState>,
): Readonly<Record<string, string>> {
  const saved: Record<string, string> = {};
  for (const [where, state] of machines) {
    saved[where] =
      `${state.awake ? 1 : 0},${state.holding ?? ""},${state.heap},${state.crates.join("/")},${Math.round(state.worked)},${state.made ?? ""}`;
  }
  return saved;
}

/**
 * Read them back, dropping anything that does not make sense.
 *
 * A bad entry costs a child one machine's contents and leaves them the
 * machine; a repaired one would leave them a machine holding something
 * nobody put in it.
 */
export function machinesFromSave(saved: unknown): Map<string, MachineState> {
  const machines = new Map<string, MachineState>();
  if (typeof saved !== "object" || saved === null) return machines;
  for (const [where, entry] of Object.entries(saved as Record<string, unknown>)) {
    if (typeof entry !== "string" || !/^-?\d+,-?\d+$/.test(where)) continue;
    const [awake, holding, heap, crates, worked, made] = entry.split(",");
    if (awake === undefined || heap === undefined || crates === undefined) continue;
    if (!/^\d+$/.test(heap) || !/^\d+$/.test(worked ?? "")) continue;
    const dealt = crates.split("/").map(Number);
    if (dealt.length !== SHARES || dealt.some((count) => !Number.isInteger(count) || count < 0)) {
      continue;
    }
    // A heap with nothing in the mouth is not a heap, and nor are full
    // crates with nothing named in them. Dropped rather than kept as an
    // anonymous pile, which nothing could ever be taken out of.
    const item = holding ? holding : null;
    // A save from before there was a machine that turns has no sixth field,
    // and everything in one of those deals — so its crates hold what its
    // mouth holds, which is what `made` being absent means.
    const gives = made ? made : null;
    if (item === null && Number(heap) > 0) continue;
    if (gives === null && item === null && dealt.some((count) => count > 0)) continue;
    machines.set(where, {
      awake: awake === "1",
      holding: item,
      heap: Number(heap),
      crates: dealt,
      made: gives,
      worked: Number(worked),
    });
  }
  return machines;
}
