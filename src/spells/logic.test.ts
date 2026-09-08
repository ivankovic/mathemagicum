// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { createRng } from "../world/rng";
import {
  Form,
  HARDEST_LOGIC_RUNG,
  Hue,
  LOGIC_RUNGS,
  type Node,
  Puzzle,
  type Rule,
  Shape,
  type Token,
  beginLogicCast,
  fewestFlips,
  flipSwitch,
  lit,
  logicHint,
  logicRungAt,
  makeCircuit,
  makeRule,
  makeTray,
  nextLogicRung,
  passes,
  pickToken,
} from "./logic";

const red = (shape: Shape, n = 0): Token => ({ id: `red-${shape}-${n}`, hue: Hue.Red, shape });
const blue = (shape: Shape, n = 0): Token => ({ id: `blue-${shape}-${n}`, hue: Hue.Blue, shape });

describe("a rule about a thing", () => {
  test("reads a swatch, a bar, the press and the funnel", () => {
    const isRed: Rule = { kind: "hue", hue: Hue.Red };
    const isRound: Rule = { kind: "shape", shape: Shape.Round };
    expect(passes(isRed, red(Shape.Square))).toBe(true);
    expect(passes(isRed, blue(Shape.Round))).toBe(false);
    expect(passes({ kind: "not", of: isRed }, blue(Shape.Round))).toBe(true);
    expect(passes({ kind: "and", left: isRed, right: isRound }, red(Shape.Round))).toBe(true);
    expect(passes({ kind: "and", left: isRed, right: isRound }, red(Shape.Square))).toBe(false);
    expect(passes({ kind: "or", left: isRed, right: isRound }, blue(Shape.Round))).toBe(true);
    expect(passes({ kind: "or", left: isRed, right: isRound }, blue(Shape.Square))).toBe(false);
    // The seesaw: either, and never both.
    expect(passes({ kind: "xor", left: isRed, right: isRound }, red(Shape.Square))).toBe(true);
    expect(passes({ kind: "xor", left: isRed, right: isRound }, red(Shape.Round))).toBe(false);
  });

  test("takes the form its rung asks for", () => {
    const rng = createRng(3);
    expect(makeRule(rng, Form.Hue).kind).toBe("hue");
    expect(makeRule(rng, Form.Shape).kind).toBe("shape");
    expect(makeRule(rng, Form.Not).kind).toBe("not");
    expect(makeRule(rng, Form.And).kind).toBe("and");
    expect(makeRule(rng, Form.Or).kind).toBe("or");
    expect(makeRule(rng, Form.Xor).kind).toBe("xor");
    const andNot = makeRule(rng, Form.AndNot);
    expect(andNot.kind === "and" && andNot.right.kind === "not").toBe(true);
  });
});

describe("a lamp on a circuit", () => {
  const a: Node = { kind: "switch", index: 0 };
  const b: Node = { kind: "switch", index: 1 };

  test("lights through the press only when both are on, and through the funnel when either is", () => {
    const both: Node = { kind: "and", left: a, right: b };
    const either: Node = { kind: "or", left: a, right: b };
    expect(lit(both, [true, false])).toBe(false);
    expect(lit(both, [true, true])).toBe(true);
    expect(lit(either, [true, false])).toBe(true);
    expect(lit(either, [false, false])).toBe(false);
    expect(lit({ kind: "not", of: a }, [false])).toBe(true);
    const oneOnly: Node = { kind: "xor", left: a, right: b };
    expect(lit(oneOnly, [true, false])).toBe(true);
    expect(lit(oneOnly, [true, true])).toBe(false);
  });

  test("knows the fewest flips that light it", () => {
    const both = { switches: 2, lamp: { kind: "and", left: a, right: b } as Node };
    expect(fewestFlips(both, [false, false])).toBe(2);
    expect(fewestFlips(both, [true, false])).toBe(1);
    const never = {
      switches: 1,
      lamp: { kind: "and", left: a, right: { kind: "not", of: a } } as Node,
    };
    expect(fewestFlips(never, [false])).toBe(null);
  });
});

describe("the ladder", () => {
  test("goes from a swatch to two gates and an inverter", () => {
    expect(LOGIC_RUNGS[0]?.puzzle).toBe(Puzzle.Sort);
    expect(LOGIC_RUNGS[0]?.form).toBe(Form.Hue);
    expect(LOGIC_RUNGS[HARDEST_LOGIC_RUNG]?.puzzle).toBe(Puzzle.Circuit);
    expect(LOGIC_RUNGS[HARDEST_LOGIC_RUNG]?.switches).toBe(3);
    expect(LOGIC_RUNGS[HARDEST_LOGIC_RUNG]?.inverted).toBe(true);
    expect(LOGIC_RUNGS[HARDEST_LOGIC_RUNG]?.xor).toBe(true);
    // Clamped at both ends: a saved rung past the top is the top.
    expect(logicRungAt(-3)).toBe(LOGIC_RUNGS[0] as never);
    expect(logicRungAt(99)).toBe(LOGIC_RUNGS[HARDEST_LOGIC_RUNG] as never);
  });

  test("moves like the mirror's: up on four clean, down on two stumbles", () => {
    expect(nextLogicRung(2, [true, true, true, true])).toBe(3);
    expect(nextLogicRung(2, [true, true, true])).toBe(2);
    expect(nextLogicRung(2, [false, false])).toBe(1);
    expect(nextLogicRung(0, [false, false])).toBe(0);
    expect(nextLogicRung(HARDEST_LOGIC_RUNG, [true, true, true, true])).toBe(HARDEST_LOGIC_RUNG);
  });
});

describe("a tray", () => {
  // A tray where everything passes has nothing to decide, and one where
  // nothing passes is a puzzle whose answer is to do nothing. Neither can be
  // told from a broken parchment, so neither is ever set.
  test("always has some things that get through and some that do not", () => {
    for (let seed = 1; seed < 60; seed++) {
      const rng = createRng(seed);
      for (const rung of LOGIC_RUNGS.filter((one) => one.puzzle === Puzzle.Sort)) {
        const tray = makeTray(rng, rung);
        expect(tray.tokens.length).toBe(rung.tokens);
        expect(tray.wanted.length).toBeGreaterThan(0);
        expect(tray.wanted.length).toBeLessThan(tray.tokens.length);
        // And the wanted list is exactly what the rule says.
        for (const token of tray.tokens) {
          expect(tray.wanted.includes(token.id)).toBe(passes(tray.rule, token));
        }
      }
    }
  });

  test("is finished when every wanted thing is picked, and a wrong tap is a stumble", () => {
    const cast = beginLogicCast(createRng(5), logicRungAt(3));
    const tray = cast.tray;
    if (!tray) throw new Error("the rung sets a tray");
    const keptOut = tray.tokens.find((token) => !tray.wanted.includes(token.id));
    if (!keptOut) throw new Error("something is kept out");
    let next = pickToken(cast, keptOut.id);
    expect(next.missteps).toBe(1);
    expect(next.wrong).toBe(keptOut.id);
    expect(next.picked).toEqual([]);
    // No hint yet on a rung that helps after one... which is now.
    expect(logicHint(next)).toBe(tray.wanted[0] ?? null);
    for (const id of tray.wanted) next = pickToken(next, id);
    expect(next.done).toBe(true);
    expect(logicHint(next)).toBe(null);
    // A tap on a finished tray changes nothing.
    expect(pickToken(next, keptOut.id)).toBe(next);
  });

  test("changing your mind is not a stumble", () => {
    const cast = beginLogicCast(createRng(9), logicRungAt(0));
    const first = cast.tray?.wanted[0];
    if (!first) throw new Error("something is wanted");
    const picked = pickToken(cast, first);
    expect(picked.picked).toEqual([first]);
    const unpicked = pickToken(picked, first);
    expect(unpicked.picked).toEqual([]);
    expect(unpicked.missteps).toBe(0);
  });
});

describe("a circuit", () => {
  test("starts dark and can always be lit", () => {
    for (let seed = 1; seed < 60; seed++) {
      const rng = createRng(seed);
      for (const rung of LOGIC_RUNGS.filter((one) => one.puzzle === Puzzle.Circuit)) {
        const circuit = makeCircuit(rng, rung);
        expect(circuit.switches).toBe(rung.switches);
        const dark = Array(circuit.switches).fill(false);
        expect(lit(circuit.lamp, dark)).toBe(false);
        const least = fewestFlips(circuit, dark);
        expect(least).not.toBe(null);
        expect(least as number).toBeGreaterThan(0);
      }
    }
  });

  test("is finished when the lamp lights, and a flip beyond the fewest is a stumble", () => {
    const cast = beginLogicCast(createRng(11), logicRungAt(7));
    const circuit = cast.circuit;
    if (!circuit) throw new Error("the rung sets a circuit");
    expect(cast.done).toBe(false);
    // Follow the hint's own reasoning: flip towards the nearest lit setting.
    let next = cast;
    let guard = 0;
    while (!next.done && guard++ < 8) {
      // The hint is only offered after a stumble, so ask the arithmetic
      // directly for the switch to flip.
      const nearest = (() => {
        for (let i = 0; i < circuit.switches; i++) {
          const trial = next.on.map((was, at) => (at === i ? !was : was));
          const before = fewestFlips(circuit, next.on) ?? 0;
          const after = fewestFlips(circuit, trial) ?? 0;
          if (after < before) return i;
        }
        return 0;
      })();
      next = flipSwitch(next, nearest);
    }
    expect(next.done).toBe(true);
    expect(next.missteps).toBe(0);
    expect(next.flips).toBe(cast.least);
  });

  test("a wasted flip is a stumble, and the hint names a switch to flip", () => {
    const rung = logicRungAt(7);
    // A circuit that takes two flips, so the first flip alone does not
    // light it — a funnel lights on one, and then there is nothing to waste.
    let cast = beginLogicCast(createRng(13), rung);
    for (let seed = 14; cast.least < 2 && seed < 60; seed++) {
      cast = beginLogicCast(createRng(seed), rung);
    }
    const circuit = cast.circuit;
    if (!circuit) throw new Error("the rung sets a circuit");
    expect(cast.least).toBe(2);
    // Flip the same switch twice: back where she started, two flips in.
    cast = flipSwitch(cast, 0);
    cast = flipSwitch(cast, 0);
    expect(cast.on.every((on) => !on)).toBe(true);
    expect(cast.missteps).toBeGreaterThanOrEqual(1);
    const hint = logicHint(cast);
    expect(hint).toMatch(/^switch-\d$/);
    // Flipping the hinted switch brings the lamp nearer to lit.
    const index = Number(hint?.split("-")[1]);
    const before = fewestFlips(circuit, cast.on) ?? 0;
    const after = fewestFlips(circuit, flipSwitch(cast, index).on) ?? 0;
    expect(after).toBe(before - 1);
  });
});
