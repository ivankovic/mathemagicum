// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { createRng } from "../world/rng";
import {
  AXIS_TOLERANCE,
  HARDEST_SYMMETRY_RUNG,
  type Point,
  SYMMETRY_RUNGS,
  type Shape,
  axesOf,
  beginSymmetryCast,
  dragLine,
  foldsAlong,
  makeShape,
  middleOf,
  nextSymmetryRung,
  reachOf,
  reflect,
  releaseLine,
  startLine,
  symmetryHint,
  symmetryRungAt,
} from "./symmetry";

const SEEDS = Array.from({ length: 120 }, (_, i) => i * 7919 + 11);

/** Every shape a rung can produce, for the seeds above. */
function shapesAt(rung: number): Shape[] {
  return SEEDS.map((seed) => makeShape(createRng(seed), symmetryRungAt(rung)));
}

/** A line drawn right along an axis, from one side of the shape to the other. */
function alongAxis(shape: Shape, angle: number): { from: Point; to: Point } {
  const middle = middleOf(shape);
  const reach = reachOf(shape) * 1.2;
  const dx = Math.sin(angle) * reach;
  const dy = -Math.cos(angle) * reach;
  return {
    from: { x: middle.x - dx, y: middle.y - dy },
    to: { x: middle.x + dx, y: middle.y + dy },
  };
}

describe("the shapes the spell makes", () => {
  /**
   * The one thing that must never fail. A shape with no fold is not a hard
   * puzzle, it is a broken one — and it cannot be noticed from the picture,
   * because a lopsided seven-cornered thing looks much the same either way.
   */
  test("every shape at every rung folds at least one way", () => {
    for (let rung = 0; rung <= HARDEST_SYMMETRY_RUNG; rung++) {
      for (const shape of shapesAt(rung)) {
        expect({ rung, axes: axesOf(shape).length > 0 }).toEqual({ rung, axes: true });
      }
    }
  });

  test("and has one of the corner counts its rung allows", () => {
    for (let rung = 0; rung <= HARDEST_SYMMETRY_RUNG; rung++) {
      const wanted = symmetryRungAt(rung).corners;
      for (const shape of shapesAt(rung)) {
        expect({ rung, allowed: wanted.includes(shape.corners.length) }).toEqual({
          rung,
          allowed: true,
        });
      }
    }
  });

  /**
   * And it is not the same shape every time.
   *
   * The bug a playtest reported in one line: "the folding spell is always a
   * square." A regular shape has nothing to vary — no lean, no nudged
   * corners, every radius one — so a rung that named a single corner count
   * drew the identical picture on every cast, for ever. The lopsided rungs
   * were fine and hid it.
   */
  test("and is not the same shape on every cast", () => {
    for (let rung = 0; rung <= HARDEST_SYMMETRY_RUNG; rung++) {
      const drawings = new Set(
        shapesAt(rung).map((shape) =>
          shape.corners.map((c) => `${c.x.toFixed(3)},${c.y.toFixed(3)}`).join(" "),
        ),
      );
      expect({ rung, many: drawings.size > 1 }).toEqual({ rung, many: true });
    }
  });

  // Which is not the same as saying every rung is *unpredictable*: the
  // gentle ones keep their fold upright, and that is a property of the rung
  // rather than of the drawing.
  test("and an upright rung stays upright however it is turned", () => {
    for (const rung of [0, 1, 2, 3]) {
      for (const shape of shapesAt(rung)) {
        const upright = axesOf(shape).some((axis) => Math.abs(axis.angle) < 1e-6);
        expect({ rung, upright }).toEqual({ rung, upright: true });
      }
    }
  });

  // A polygon cannot have more axes than it has corners. Getting more back
  // means the fold test is waving near-misses through, which it did: a
  // four-cornered shape came back claiming three and five.
  test("and never more folds than it has corners", () => {
    for (let rung = 0; rung <= HARDEST_SYMMETRY_RUNG; rung++) {
      for (const shape of shapesAt(rung)) {
        expect(axesOf(shape).length).toBeLessThanOrEqual(shape.corners.length);
      }
    }
  });

  // The shapes a child meets first are the ones with several right answers,
  // so a line drawn roughly down the middle is likely to be one of them.
  test("a shape with equal corners folds every way it should", () => {
    // A regular polygon has as many folds as it has corners, whichever of
    // its rung's counts it happened to be drawn with.
    for (const rung of [0, 1, 3]) {
      for (const shape of shapesAt(rung)) {
        expect({ rung, axes: axesOf(shape).length }).toEqual({
          rung,
          axes: shape.corners.length,
        });
      }
    }
  });

  // And the ones at the top have exactly one, which is the whole difficulty:
  // there is no drawing a line near the middle and hoping.
  test("a lopsided shape folds exactly one way", () => {
    for (const rung of [2, 4, HARDEST_SYMMETRY_RUNG]) {
      for (const shape of shapesAt(rung)) {
        expect({ rung, axes: axesOf(shape).length }).toEqual({ rung, axes: 1 });
      }
    }
  });

  test("the hardest shapes lean rather than standing upright", () => {
    const upright = shapesAt(HARDEST_SYMMETRY_RUNG).filter((shape) => {
      const angle = axesOf(shape)[0]?.angle ?? 0;
      return angle < 0.05 || Math.abs(angle - Math.PI / 2) < 0.05;
    });
    // A few may land upright by chance; most must not.
    expect(upright.length).toBeLessThan(SEEDS.length / 3);
  });

  // A corner pulled in towards the middle is what makes an arrowhead rather
  // than a lopsided pentagon, and it is the last thing the ladder adds.
  test("the hardest shapes turn back on themselves", () => {
    const concave = shapesAt(HARDEST_SYMMETRY_RUNG).filter((shape) => {
      const middle = middleOf(shape);
      const reach = reachOf(shape);
      return shape.corners.some((c) => Math.hypot(c.x - middle.x, c.y - middle.y) < reach * 0.6);
    });
    expect(concave.length).toBe(SEEDS.length);
  });
});

describe("folding a shape", () => {
  test("a line drawn along a fold is right", () => {
    for (let rung = 0; rung <= HARDEST_SYMMETRY_RUNG; rung++) {
      for (const shape of shapesAt(rung)) {
        for (const axis of axesOf(shape)) {
          const drawn = alongAxis(shape, axis.angle);
          expect({ rung, ok: foldsAlong(shape, drawn.from, drawn.to) !== null }).toEqual({
            rung,
            ok: true,
          });
        }
      }
    }
  });

  // Drawn the other way round is the same line. A child who starts at the
  // bottom has not drawn a different fold.
  test("and drawing it backwards is the same line", () => {
    for (const shape of shapesAt(4)) {
      const axis = axesOf(shape)[0];
      if (!axis) continue;
      const drawn = alongAxis(shape, axis.angle);
      expect(foldsAlong(shape, drawn.to, drawn.from)).not.toBeNull();
    }
  });

  /**
   * The right slope in the wrong place is not a fold.
   *
   * Checking only the angle would accept a line drawn parallel to the fold
   * out at the edge of the shape — which is the mistake a child actually
   * makes, and the one worth catching.
   */
  test("but the same slope drawn off to the side is not", () => {
    for (const shape of shapesAt(4)) {
      const axis = axesOf(shape)[0];
      if (!axis) continue;
      const drawn = alongAxis(shape, axis.angle);
      // Sideways, at right angles to the fold — shifting *along* it would
      // move the line nowhere at all, which is what this test first did.
      const off = reachOf(shape) * 0.6;
      const sideways = { x: Math.cos(axis.angle) * off, y: Math.sin(axis.angle) * off };
      const shifted = {
        from: { x: drawn.from.x + sideways.x, y: drawn.from.y + sideways.y },
        to: { x: drawn.to.x + sideways.x, y: drawn.to.y + sideways.y },
      };
      expect(foldsAlong(shape, shifted.from, shifted.to)).toBeNull();
    }
  });

  test("and a line through the middle at the wrong angle is not", () => {
    for (const shape of shapesAt(4)) {
      const axis = axesOf(shape)[0];
      if (!axis) continue;
      const wrong = alongAxis(shape, axis.angle + AXIS_TOLERANCE * 3);
      expect(foldsAlong(shape, wrong.from, wrong.to)).toBeNull();
    }
  });

  // A tap is not a line: two points a hair apart have no direction to speak
  // of, and would match whichever fold the rounding happened to favour.
  test("and a tap is not a line at all", () => {
    const shape = makeShape(createRng(3), symmetryRungAt(0));
    const middle = middleOf(shape);
    expect(foldsAlong(shape, middle, { x: middle.x + 0.01, y: middle.y })).toBeNull();
  });
});

describe("reflecting a point", () => {
  test("twice puts it back where it started", () => {
    const shape = makeShape(createRng(5), symmetryRungAt(4));
    const middle = middleOf(shape);
    const axis = axesOf(shape)[0];
    if (!axis) throw new Error("a shape with no fold");
    for (const corner of shape.corners) {
      const there = reflect(corner, axis, middle);
      const back = reflect(there, axis, middle);
      expect(Math.hypot(back.x - corner.x, back.y - corner.y)).toBeLessThan(1e-9);
    }
  });

  test("and a point on the line does not move", () => {
    const middle = { x: 0, y: 0 };
    const axis = { angle: 0 };
    const on = { x: 0, y: -0.5 };
    const there = reflect(on, axis, middle);
    expect(Math.hypot(there.x - on.x, there.y - on.y)).toBeLessThan(1e-9);
  });
});

describe("casting it", () => {
  const rung = symmetryRungAt(4);

  test("opens with a shape and no line on it", () => {
    const cast = beginSymmetryCast(createRng(7), rung);
    expect(cast.from).toBeNull();
    expect(cast.done).toBe(false);
    expect(axesOf(cast.shape).length).toBeGreaterThan(0);
  });

  test("a line along a fold finishes it", () => {
    let cast = beginSymmetryCast(createRng(7), rung);
    const axis = axesOf(cast.shape)[0];
    if (!axis) throw new Error("a shape with no fold");
    const drawn = alongAxis(cast.shape, axis.angle);
    cast = startLine(cast, drawn.from);
    cast = dragLine(cast, drawn.to);
    cast = releaseLine(cast);
    expect(cast.done).toBe(true);
    expect(cast.missteps).toBe(0);
  });

  test("and a wrong one is counted and wiped off", () => {
    let cast = beginSymmetryCast(createRng(7), rung);
    const axis = axesOf(cast.shape)[0];
    if (!axis) throw new Error("a shape with no fold");
    const wrong = alongAxis(cast.shape, axis.angle + 0.9);
    cast = startLine(cast, wrong.from);
    cast = dragLine(cast, wrong.to);
    cast = releaseLine(cast);
    expect(cast.done).toBe(false);
    expect(cast.wrong).toBe(true);
    expect(cast.missteps).toBe(1);
    expect(cast.from).toBeNull();
  });

  test("nothing happens until a line has been drawn", () => {
    const cast = beginSymmetryCast(createRng(7), rung);
    expect(releaseLine(cast)).toEqual(cast);
  });
});

describe("helping a stuck child", () => {
  test("says nothing until the rung says so", () => {
    const cast = beginSymmetryCast(createRng(9), symmetryRungAt(0));
    expect(symmetryHint(cast)).toBeNull();
  });

  test("then shows one whole fold, never half of one", () => {
    let cast = beginSymmetryCast(createRng(9), symmetryRungAt(0));
    const axis = axesOf(cast.shape)[0];
    if (!axis) throw new Error("a shape with no fold");
    const wrong = alongAxis(cast.shape, axis.angle + 0.9);
    cast = releaseLine(dragLine(startLine(cast, wrong.from), wrong.to));
    const shown = symmetryHint(cast);
    expect(shown).not.toBeNull();
    expect(axesOf(cast.shape).some((a) => a.angle === shown?.angle)).toBe(true);
  });

  // Being told a square folds four ways is a different lesson from being
  // shown that it folds at all.
  test("and only ever one of them, however many the shape has", () => {
    let cast = beginSymmetryCast(createRng(9), symmetryRungAt(0));
    expect(axesOf(cast.shape).length).toBe(4);
    const wrong = alongAxis(cast.shape, 0.4);
    for (let miss = 0; miss < 4; miss++) {
      cast = releaseLine(dragLine(startLine(cast, wrong.from), wrong.to));
    }
    expect(symmetryHint(cast)).toEqual(axesOf(cast.shape)[0] as never);
  });
});

describe("the ladder", () => {
  test("climbs by corners and by what the corners are like", () => {
    expect(SYMMETRY_RUNGS[0]?.regular).toBe(true);
    expect(SYMMETRY_RUNGS[HARDEST_SYMMETRY_RUNG]?.regular).toBe(false);
    expect(SYMMETRY_RUNGS[HARDEST_SYMMETRY_RUNG]?.oblique).toBe(true);
    expect(SYMMETRY_RUNGS[HARDEST_SYMMETRY_RUNG]?.reflex).toBe(true);
  });

  test("and asking past either end gives the end", () => {
    expect(symmetryRungAt(-5)).toEqual(SYMMETRY_RUNGS[0] as never);
    expect(symmetryRungAt(99)).toEqual(SYMMETRY_RUNGS[HARDEST_SYMMETRY_RUNG] as never);
  });
});

describe("climbing the mirror ladder", () => {
  const clean = [true, true, true, true];

  test("four folds found first time moves a child up", () => {
    expect(nextSymmetryRung(0, clean)).toBe(1);
  });

  test("and two in a row that took several goes moves them back down", () => {
    expect(nextSymmetryRung(3, [false, false])).toBe(2);
  });

  test("but one of each leaves them where they are", () => {
    expect(nextSymmetryRung(2, [true, false, true])).toBe(2);
  });

  // The whole reason this is not `nextRung`. Bands are counted in addition
  // rungs, and every other ladder fences a child inside theirs — which on
  // this ladder would put a nine year old on the arrowhead before they had
  // ever been shown that a square folds. Folding is a way of looking, not a
  // fluency, so everybody starts at the square.
  test("and no band ever lifts anybody off the bottom of it", () => {
    expect(nextSymmetryRung(0, [])).toBe(0);
    expect(nextSymmetryRung(0, [true, false])).toBe(0);
    expect(nextSymmetryRung(0, [false, false])).toBe(0);
  });

  test("and neither end of the ladder can be walked off", () => {
    expect(nextSymmetryRung(HARDEST_SYMMETRY_RUNG, clean)).toBe(HARDEST_SYMMETRY_RUNG);
    expect(nextSymmetryRung(99, clean)).toBe(HARDEST_SYMMETRY_RUNG);
    expect(nextSymmetryRung(-4, [false, false])).toBe(0);
  });
});
