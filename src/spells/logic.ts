// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { type Rng, randInt } from "../world/rng";
import { CLEAN_TO_CLIMB, type Recent, STUMBLES_TO_EASE } from "./difficulty";

/**
 * The logic spell: which things get through, and whether the lamp lights.
 *
 * The machines that *decide* — the press that waits for both, the funnel
 * that takes either, the sieve that bins what does not belong — do Boolean
 * logic where a child can watch it, and this is the spell that wakes them.
 * It is the first minigame in the game that is not arithmetic, and it asks
 * the two questions logic gates are made of, in pictures:
 *
 * **What gets through?** A rule, drawn as swatches and the machines' own
 * icons — a red swatch and the press's picture and a round swatch is *red
 * and round*; the funnel's picture between them is *red or round*; a red
 * swatch with a bar across it is *not red*, in the mark the game already
 * uses for "none of this". Under it a tray of things, and she taps the ones
 * the rule lets through. That is the sieve's question and the press's and
 * the funnel's, asked before she has built any of them.
 *
 * **Does the lamp light?** Switches on the left, a lamp on the right, and
 * between them the same machines as gates. She flips switches until the
 * lamp lights. That is a circuit, and a child who has lit a lamp through a
 * press and a funnel has read a truth table without being shown one.
 *
 * The ladder goes from one swatch to two gates and an inverter, and like
 * every ladder here it moves on clean casts and eases on stumbles. A
 * stumble on the tray is a tap on a thing the rule does not let through. A
 * stumble on a circuit is a flip that was not needed — counted against the
 * fewest flips that would have lit the lamp, so that exploring a circuit is
 * not punished and thrashing one is.
 *
 * No fail state, no numerals: a shape is red or it is not, and that is the
 * whole of what a five-year-old has to read.
 */

export const Hue = {
  Red: "red",
  Blue: "blue",
  Yellow: "yellow",
} as const;

export type Hue = (typeof Hue)[keyof typeof Hue];

export const HUES: readonly Hue[] = Object.values(Hue);

export const Shape = {
  Round: "round",
  Square: "square",
  Pointed: "pointed",
} as const;

export type Shape = (typeof Shape)[keyof typeof Shape];

export const SHAPES: readonly Shape[] = Object.values(Shape);

/** One thing on the tray: a coloured shape. */
export interface Token {
  readonly id: string;
  readonly hue: Hue;
  readonly shape: Shape;
}

/**
 * A rule about a token.
 *
 * Small on purpose: two attributes, three connectives. Everything a rung
 * asks is one of these, and the parchment draws one by walking it.
 */
export type Rule =
  | { readonly kind: "hue"; readonly hue: Hue }
  | { readonly kind: "shape"; readonly shape: Shape }
  | { readonly kind: "not"; readonly of: Rule }
  | { readonly kind: "and"; readonly left: Rule; readonly right: Rule }
  | { readonly kind: "or"; readonly left: Rule; readonly right: Rule }
  | { readonly kind: "xor"; readonly left: Rule; readonly right: Rule };

/** Whether the rule lets this token through. */
export function passes(rule: Rule, token: Token): boolean {
  switch (rule.kind) {
    case "hue":
      return token.hue === rule.hue;
    case "shape":
      return token.shape === rule.shape;
    case "not":
      return !passes(rule.of, token);
    case "and":
      return passes(rule.left, token) && passes(rule.right, token);
    case "or":
      return passes(rule.left, token) || passes(rule.right, token);
    case "xor":
      return passes(rule.left, token) !== passes(rule.right, token);
  }
}

/**
 * A circuit: switches feeding gates feeding one lamp.
 *
 * A tree, because every gate here has one output and the lamp is the root.
 * `switch` names one of the switches by index; `not` is an inverter on a
 * wire; `and` and `or` are the press and the funnel.
 */
export type Node =
  | { readonly kind: "switch"; readonly index: number }
  | { readonly kind: "not"; readonly of: Node }
  | { readonly kind: "and"; readonly left: Node; readonly right: Node }
  | { readonly kind: "or"; readonly left: Node; readonly right: Node }
  | { readonly kind: "xor"; readonly left: Node; readonly right: Node };

/** Whether the lamp lights with the switches set this way. */
export function lit(node: Node, on: readonly boolean[]): boolean {
  switch (node.kind) {
    case "switch":
      return on[node.index] === true;
    case "not":
      return !lit(node.of, on);
    case "and":
      return lit(node.left, on) && lit(node.right, on);
    case "or":
      return lit(node.left, on) || lit(node.right, on);
    case "xor":
      return lit(node.left, on) !== lit(node.right, on);
  }
}

/** The two shapes a rung can take. */
export const Puzzle = {
  Sort: "sort",
  Circuit: "circuit",
} as const;

export type Puzzle = (typeof Puzzle)[keyof typeof Puzzle];

/** The forms a sorting rule can take, by rung. */
export const Form = {
  Hue: "hue",
  Shape: "shape",
  Not: "not",
  And: "and",
  Or: "or",
  /** Either but not both: the seesaw. */
  Xor: "xor",
  AndNot: "and-not",
} as const;

export type Form = (typeof Form)[keyof typeof Form];

export interface LogicRung {
  readonly puzzle: Puzzle;
  /** For a tray: the rule's form. */
  readonly form: Form;
  /** For a tray: how many things are on it. */
  readonly tokens: number;
  /** For a circuit: how many switches and gates, and whether one wire is inverted. */
  readonly switches: number;
  readonly gates: number;
  readonly inverted: boolean;
  /** For a circuit: whether the seesaw is among the gates it may draw. */
  readonly xor: boolean;
  /** How many stumbles before the parchment starts helping. */
  readonly hintAfter: number;
}

const tray = (form: Form, tokens: number, hintAfter = 1): LogicRung => ({
  puzzle: Puzzle.Sort,
  form,
  tokens,
  switches: 0,
  gates: 0,
  inverted: false,
  xor: false,
  hintAfter,
});

const circuit = (
  switches: number,
  gates: number,
  inverted: boolean,
  xor = false,
  hintAfter = 1,
): LogicRung => ({
  puzzle: Puzzle.Circuit,
  form: Form.And,
  tokens: 0,
  switches,
  gates,
  inverted,
  xor,
  hintAfter,
});

/**
 * The ladder: from one swatch to two gates and an inverter.
 *
 * The tray comes first because a swatch is a thing a five-year-old reads,
 * and it introduces the three machines as pictures before a circuit asks
 * what they do to a wire. Six rungs of tray, four of circuit; the last of
 * each asks for a hint later, because by then she has seen the shape.
 */
export const LOGIC_RUNGS: readonly LogicRung[] = [
  tray(Form.Hue, 6),
  tray(Form.Shape, 6),
  tray(Form.Not, 6),
  tray(Form.And, 8),
  tray(Form.Or, 8),
  tray(Form.Xor, 8),
  tray(Form.AndNot, 9, 2),
  circuit(2, 1, false),
  circuit(2, 1, true),
  circuit(3, 2, false),
  circuit(3, 2, true),
  circuit(3, 2, false, true),
  circuit(3, 2, true, true, 2),
];

export const HARDEST_LOGIC_RUNG = LOGIC_RUNGS.length - 1;

export function logicRungAt(index: number): LogicRung {
  const at = Math.max(0, Math.min(HARDEST_LOGIC_RUNG, Math.trunc(index)));
  return LOGIC_RUNGS[at] as LogicRung;
}

// --- the tray ----------------------------------------------------------------

function pick<T>(rng: Rng, from: readonly T[]): T {
  return from[randInt(rng, 0, from.length - 1)] as T;
}

function hueRule(rng: Rng): Rule {
  return { kind: "hue", hue: pick(rng, HUES) };
}

function shapeRule(rng: Rng): Rule {
  return { kind: "shape", shape: pick(rng, SHAPES) };
}

/** A rule of the form the rung asks for. */
export function makeRule(rng: Rng, form: Form): Rule {
  switch (form) {
    case Form.Hue:
      return hueRule(rng);
    case Form.Shape:
      return shapeRule(rng);
    case Form.Not:
      return { kind: "not", of: randInt(rng, 0, 1) === 0 ? hueRule(rng) : shapeRule(rng) };
    case Form.And:
      return { kind: "and", left: hueRule(rng), right: shapeRule(rng) };
    case Form.Or:
      return { kind: "or", left: hueRule(rng), right: shapeRule(rng) };
    case Form.Xor:
      return { kind: "xor", left: hueRule(rng), right: shapeRule(rng) };
    case Form.AndNot:
      return { kind: "and", left: hueRule(rng), right: { kind: "not", of: shapeRule(rng) } };
  }
}

export interface Tray {
  readonly tokens: readonly Token[];
  readonly rule: Rule;
  /** The ids the rule lets through. */
  readonly wanted: readonly string[];
}

function oneTray(rng: Rng, rung: LogicRung): Tray {
  const rule = makeRule(rng, rung.form);
  const tokens: Token[] = [];
  for (let n = 0; n < rung.tokens; n++) {
    const hue = pick(rng, HUES);
    const shape = pick(rng, SHAPES);
    tokens.push({ id: `${hue}-${shape}-${n}`, hue, shape });
  }
  return { tokens, rule, wanted: tokens.filter((token) => passes(rule, token)).map((t) => t.id) };
}

/**
 * A tray worth asking about: some things get through and some do not.
 *
 * A tray where everything passes is a rule with nothing to decide, and one
 * where nothing passes is a puzzle whose answer is to do nothing — which a
 * child cannot tell from a parchment that is broken. Drawn again until it
 * is neither, a few times, and then whatever came last.
 */
export function makeTray(rng: Rng, rung: LogicRung): Tray {
  let best = oneTray(rng, rung);
  for (let again = 0; again < 12; again++) {
    const some = best.wanted.length > 0 && best.wanted.length < best.tokens.length;
    if (some) break;
    best = oneTray(rng, rung);
  }
  return best;
}

// --- the circuit -------------------------------------------------------------

export interface Circuit {
  readonly switches: number;
  readonly lamp: Node;
}

function gate(rng: Rng, left: Node, right: Node, xor: boolean): Node {
  const kinds: ("and" | "or" | "xor")[] = xor ? ["and", "or", "xor"] : ["and", "or"];
  return { kind: pick(rng, kinds), left, right };
}

function oneCircuit(rng: Rng, rung: LogicRung): Circuit {
  const leaf = (index: number): Node => ({ kind: "switch", index });
  let lamp: Node;
  if (rung.gates <= 1 || rung.switches < 3) {
    lamp = gate(rng, leaf(0), leaf(1), rung.xor);
  } else {
    // Two gates over three switches: one gate takes two of them and the
    // other takes that and the third, which is the only shape two gates
    // and three wires can make.
    lamp = gate(rng, gate(rng, leaf(0), leaf(1), rung.xor), leaf(2), rung.xor);
  }
  if (rung.inverted) {
    // One switch's wire inverted, chosen at random, so a child cannot learn
    // that it is always the first.
    const which = randInt(rng, 0, rung.switches - 1);
    lamp = invert(lamp, which);
  }
  return { switches: rung.switches, lamp };
}

function invert(node: Node, which: number): Node {
  switch (node.kind) {
    case "switch":
      return node.index === which ? { kind: "not", of: node } : node;
    case "not":
      return { kind: "not", of: invert(node.of, which) };
    case "and":
    case "or":
    case "xor":
      return { kind: node.kind, left: invert(node.left, which), right: invert(node.right, which) };
  }
}

/** Every way the switches can be set. */
function settings(switches: number): boolean[][] {
  const all: boolean[][] = [];
  for (let bits = 0; bits < 1 << switches; bits++) {
    all.push(Array.from({ length: switches }, (_, i) => ((bits >> i) & 1) === 1));
  }
  return all;
}

/** How many switches differ between two settings. */
function apart(a: readonly boolean[], b: readonly boolean[]): number {
  let n = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    if ((a[i] ?? false) !== (b[i] ?? false)) n++;
  return n;
}

/**
 * The fewest flips from here that light the lamp, or null if nothing does.
 *
 * Brute force over every setting, which is at most eight: this is the
 * arithmetic the whole circuit rung rests on, and it has to be exact.
 */
export function fewestFlips(circuit: Circuit, from: readonly boolean[]): number | null {
  let best: number | null = null;
  for (const setting of settings(circuit.switches)) {
    if (!lit(circuit.lamp, setting)) continue;
    const flips = apart(from, setting);
    if (best === null || flips < best) best = flips;
  }
  return best;
}

/**
 * A circuit worth asking about: dark to begin with, and possible to light.
 *
 * A lamp already lit is a puzzle solved by looking at it, and one no
 * setting lights is a puzzle with no answer, which nobody could tell from a
 * broken parchment. Drawn again until it is neither.
 */
export function makeCircuit(rng: Rng, rung: LogicRung): Circuit {
  let best = oneCircuit(rng, rung);
  for (let again = 0; again < 16; again++) {
    const dark = Array(best.switches).fill(false);
    const least = fewestFlips(best, dark);
    if (least !== null && least > 0) break;
    best = oneCircuit(rng, rung);
  }
  return best;
}

// --- the cast ----------------------------------------------------------------

export interface LogicCast {
  readonly rung: LogicRung;
  readonly tray: Tray | null;
  /** The ids she has tapped as getting through. */
  readonly picked: readonly string[];
  readonly circuit: Circuit | null;
  /** Which switches are on. */
  readonly on: readonly boolean[];
  /** How many flips she has made. */
  readonly flips: number;
  /** The fewest flips that would have lit the lamp from the start. */
  readonly least: number;
  readonly done: boolean;
  readonly missteps: number;
  /** The last thing tapped that was not part of the answer, for a beat. */
  readonly wrong: string | null;
}

export function beginLogicCast(rng: Rng, rung: LogicRung): LogicCast {
  if (rung.puzzle === Puzzle.Sort) {
    const tray = makeTray(rng, rung);
    return {
      rung,
      tray,
      picked: [],
      circuit: null,
      on: [],
      flips: 0,
      least: 0,
      done: tray.wanted.length === 0,
      missteps: 0,
      wrong: null,
    };
  }
  const circuit = makeCircuit(rng, rung);
  const on = Array(circuit.switches).fill(false) as boolean[];
  return {
    rung,
    tray: null,
    picked: [],
    circuit,
    on,
    flips: 0,
    least: fewestFlips(circuit, on) ?? 0,
    done: lit(circuit.lamp, on),
    missteps: 0,
    wrong: null,
  };
}

/**
 * A tap on a thing on the tray.
 *
 * Tapping a thing already picked puts it back, without a mark against
 * her: changing your mind is not a mistake. Tapping one the rule keeps out
 * is, and it stays out.
 */
export function pickToken(cast: LogicCast, id: string): LogicCast {
  const tray = cast.tray;
  if (!tray || cast.done) return cast;
  if (cast.picked.includes(id)) {
    return { ...cast, picked: cast.picked.filter((one) => one !== id), wrong: null };
  }
  if (!tray.wanted.includes(id)) {
    return { ...cast, missteps: cast.missteps + 1, wrong: id };
  }
  const picked = [...cast.picked, id];
  const done = tray.wanted.every((one) => picked.includes(one));
  return { ...cast, picked, done, wrong: null };
}

/**
 * A flip of one switch.
 *
 * Counted against the fewest flips that would have done it: a flip beyond
 * that is a stumble. Exploring a two-switch circuit costs at most a flip or
 * two over the least, which a hint threshold of one forgives on every
 * circuit rung but the last.
 */
export function flipSwitch(cast: LogicCast, index: number): LogicCast {
  const circuit = cast.circuit;
  if (!circuit || cast.done) return cast;
  if (index < 0 || index >= circuit.switches) return cast;
  const on = cast.on.map((was, i) => (i === index ? !was : was));
  const flips = cast.flips + 1;
  const done = lit(circuit.lamp, on);
  // What the flips have bought: how much nearer the lamp is than at the
  // start. Every flip beyond that is one that did not help.
  const remaining = fewestFlips(circuit, on) ?? cast.least;
  const bought = Math.max(0, cast.least - remaining);
  const wasted = (fewestFlips(circuit, cast.on) ?? cast.least) <= remaining;
  return {
    ...cast,
    on,
    flips,
    done,
    missteps: Math.max(0, flips - bought),
    wrong: wasted && !done ? `switch-${index}` : null,
  };
}

/**
 * The help, when it is due: on the tray, one thing that gets through and
 * is not yet picked; on a circuit, one switch to flip.
 *
 * The switch is the one that brings her nearest to the closest lit setting
 * from where the switches are *now*, not from where they started — a hint
 * that pointed at the first flip of a plan she has half done would send
 * her back.
 */
export function logicHint(cast: LogicCast): string | null {
  if (cast.done) return null;
  if (cast.missteps < Math.max(1, cast.rung.hintAfter)) return null;
  if (cast.tray) return cast.tray.wanted.find((one) => !cast.picked.includes(one)) ?? null;
  const circuit = cast.circuit;
  if (!circuit) return null;
  let nearest: readonly boolean[] | null = null;
  for (const setting of settings(circuit.switches)) {
    if (!lit(circuit.lamp, setting)) continue;
    if (nearest === null || apart(cast.on, setting) < apart(cast.on, nearest)) nearest = setting;
  }
  if (!nearest) return null;
  for (let i = 0; i < circuit.switches; i++) {
    if ((cast.on[i] ?? false) !== nearest[i]) return `switch-${i}`;
  }
  return null;
}

/**
 * The ladder moves like the mirror's: up on the clean casts in a row every
 * ladder asks for, down on the stumbles, and nowhere otherwise. No band
 * touches it — where a child starts is the bottom, and the shapes are not
 * about how big the numbers are.
 */
export function nextLogicRung(rung: number, recent: Recent): number {
  const here = Math.max(0, Math.min(HARDEST_LOGIC_RUNG, Math.trunc(rung)));
  const clean = recent.slice(-CLEAN_TO_CLIMB);
  if (clean.length >= CLEAN_TO_CLIMB && clean.every(Boolean)) {
    return Math.min(HARDEST_LOGIC_RUNG, here + 1);
  }
  const stumbles = recent.slice(-STUMBLES_TO_EASE);
  if (stumbles.length >= STUMBLES_TO_EASE && stumbles.every((was) => !was)) {
    return Math.max(0, here - 1);
  }
  return here;
}
