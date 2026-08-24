// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { type Rng, randInt } from "../world/rng";
import { CLEAN_TO_CLIMB, type Recent, STUMBLES_TO_EASE } from "./difficulty";

/**
 * The mirror spell: fold a shape in half.
 *
 * A shape is drawn on the parchment and the child draws one line through it.
 * The line is right if the shape would land on itself when folded along it —
 * an axis of symmetry, which is the first piece of geometry that is about a
 * whole figure rather than about a length or a count.
 *
 * **The shapes are made rather than listed.** A dozen written down by hand
 * would be a dozen a child learns the answers to, and the ladder would be
 * whatever order somebody happened to type them in. Generated, the ladder
 * can be stated as what actually makes one harder than another: how many
 * corners it has, whether they are all alike, whether the fold runs straight
 * up the page or leans, and whether any corner turns back on itself.
 *
 * **Every shape is built symmetric.** Half the outline is generated and the
 * other half is its mirror, so there is always at least one right answer —
 * a puzzle with no solution is not a hard puzzle, it is a broken one. What
 * cannot be assumed is that there is only *one*: a square built about its
 * vertical is symmetric about three more lines nobody chose, and a child who
 * draws one of those is right. So the answer is checked against every axis
 * the shape actually has, worked out from the shape rather than remembered
 * from how it was made.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A shape: its corners, in order round the outline. */
export interface Shape {
  readonly corners: readonly Point[];
}

/**
 * A fold: a line through the middle of the shape at this angle.
 *
 * Angles are radians measured from straight up, turning clockwise, which is
 * how the parchment draws them. An axis and the same axis turned half a turn
 * are one line, so everything here works modulo π.
 */
export interface Axis {
  readonly angle: number;
}

/** How hard a shape is to fold, and what makes it so. */
export interface SymmetryRung {
  /**
   * How many corners the shape may have — one of these, drawn per cast.
   *
   * A list rather than a number, and that is a bug fix rather than a
   * flourish. A *regular* shape has nothing else left to vary: no lean, no
   * nudged corners, every radius one. So a rung that named a single count
   * produced the same drawing on every cast for ever — a child at the first
   * rung folded the identical square every time they cast the spell, which
   * is what a playtest reported in those words.
   *
   * What each rung holds together is its *property* — all corners alike, or
   * an odd count, or lopsided — because that is the lesson. The count is
   * free to move inside it.
   */
  readonly corners: readonly number[];
  /** Whether every corner is alike, which gives a shape many folds. */
  readonly regular: boolean;
  /** Whether the fold leans rather than running straight up the page. */
  readonly oblique: boolean;
  /** Whether a corner may turn back on itself, making the shape concave. */
  readonly reflex: boolean;
  /** How many wrong lines before the parchment starts helping. */
  readonly hintAfter: number;
}

/**
 * Every setting, easiest first.
 *
 * The order is what makes a fold hard to find, taken one thing at a time. A
 * square is first because it has four right answers and a child who draws
 * any line near the middle is likely to be right about one of them; a
 * lopsided seven-cornered shape leaning off the vertical has exactly one,
 * and finding it means looking at the shape rather than at the page.
 *
 * Corners go up and down rather than only up: a triangle after a square is
 * fewer corners and harder, because three is odd and the fold runs through a
 * corner rather than between two of them.
 */
export const SYMMETRY_RUNGS: readonly SymmetryRung[] = [
  // All corners alike, an even count: many folds, and one of them upright
  // through two opposite corners. The gentlest thing this spell can ask.
  { corners: [4, 6], regular: true, oblique: false, reflex: false, hintAfter: 1 },
  // Alike, but an odd count — so the fold runs through a corner at one end
  // and the middle of an edge at the other, which is the thing being taught.
  { corners: [3, 5], regular: true, oblique: false, reflex: false, hintAfter: 1 },
  // Lopsided: exactly one fold, still upright.
  { corners: [4, 5], regular: false, oblique: false, reflex: false, hintAfter: 1 },
  // Alike again and more of them. Overlapping the first rung at six, which
  // is deliberate and is how every ladder in this game overlaps: the step
  // between two rungs should be a nudge.
  { corners: [6, 8], regular: true, oblique: false, reflex: false, hintAfter: 1 },
  // Lopsided *and* leaning: one fold, and not up the page.
  { corners: [5, 6], regular: false, oblique: true, reflex: false, hintAfter: 2 },
  // And one corner turned back on itself, which is the hardest to see.
  { corners: [6, 7], regular: false, oblique: true, reflex: true, hintAfter: 2 },
];

export const HARDEST_SYMMETRY_RUNG = SYMMETRY_RUNGS.length - 1;

export function symmetryRungAt(index: number): SymmetryRung {
  const at = Math.max(0, Math.min(HARDEST_SYMMETRY_RUNG, Math.trunc(index)));
  return SYMMETRY_RUNGS[at] as SymmetryRung;
}

/** How close two lines have to be to count as the same fold. */
export const AXIS_TOLERANCE = 0.16;
/** And how far from the middle a fold may pass, as a share of the shape. */
export const CENTRE_TOLERANCE = 0.14;

/** The middle of a shape: the average of its corners. */
export function middleOf(shape: Shape): Point {
  const n = shape.corners.length;
  if (n === 0) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const corner of shape.corners) {
    x += corner.x;
    y += corner.y;
  }
  return { x: x / n, y: y / n };
}

/** How big the shape is, so tolerances can be stated as a share of it. */
export function reachOf(shape: Shape): number {
  const middle = middleOf(shape);
  return Math.max(...shape.corners.map((c) => Math.hypot(c.x - middle.x, c.y - middle.y)), 1e-6);
}

/**
 * Every line the shape would fold onto itself along.
 *
 * Worked out rather than remembered. A shape built symmetric about one line
 * is often symmetric about others nobody chose — a square about four, a
 * hexagon about six — and a child who draws one of those is right.
 *
 * Any axis of a polygon passes through its middle, so the candidates are the
 * lines from the middle through each corner and through each edge's midpoint.
 * Each is tried by reflecting every corner and asking whether the shape that
 * comes back is the same set of points.
 */
export function axesOf(shape: Shape): Axis[] {
  const corners = shape.corners;
  if (corners.length < 3) return [];
  const middle = middleOf(shape);
  const reach = reachOf(shape);
  const candidates: number[] = [];
  for (const [index, corner] of corners.entries()) {
    const next = corners[(index + 1) % corners.length] as Point;
    candidates.push(Math.atan2(corner.x - middle.x, -(corner.y - middle.y)));
    candidates.push(
      Math.atan2((corner.x + next.x) / 2 - middle.x, -((corner.y + next.y) / 2 - middle.y)),
    );
  }
  const found: Axis[] = [];
  for (const angle of candidates) {
    const settled = ((angle % Math.PI) + Math.PI) % Math.PI;
    if (found.some((axis) => nearAngle(axis.angle, settled))) continue;
    if (foldsOnto(shape, { angle: settled }, middle, reach)) found.push({ angle: settled });
  }
  return found.sort((a, b) => a.angle - b.angle);
}

/**
 * Whether folding along this line lands every corner on a corner.
 *
 * Tight on purpose. A shape is built exactly symmetric, so a true fold lands
 * its corners on top of each other to within rounding — and a loose test
 * finds folds that are not there: a four-cornered shape came back claiming
 * three and five axes, which no quadrilateral has, because a near-miss on a
 * nearly-square kite was being waved through.
 */
function foldsOnto(shape: Shape, axis: Axis, middle: Point, reach: number): boolean {
  const close = reach * 1e-6;
  for (const corner of shape.corners) {
    const mirrored = reflect(corner, axis, middle);
    const landed = shape.corners.some(
      (other) => Math.hypot(other.x - mirrored.x, other.y - mirrored.y) <= close,
    );
    if (!landed) return false;
  }
  return true;
}

/** A point reflected in a line through `middle` at this angle. */
export function reflect(point: Point, axis: Axis, middle: Point): Point {
  // The line's direction, with the angle measured from straight up.
  const dx = Math.sin(axis.angle);
  const dy = -Math.cos(axis.angle);
  const px = point.x - middle.x;
  const py = point.y - middle.y;
  const along = px * dx + py * dy;
  return {
    x: middle.x + 2 * along * dx - px,
    y: middle.y + 2 * along * dy - py,
  };
}

/** Whether two angles are the same line, allowing for a half turn. */
function nearAngle(one: number, other: number): boolean {
  const gap = Math.abs(one - other) % Math.PI;
  return Math.min(gap, Math.PI - gap) <= 1e-6;
}

/**
 * Whether a line drawn from here to there folds the shape in half.
 *
 * Two things have to hold: the line has to lean the way an axis leans, and
 * it has to pass through the middle. Checking only the angle would accept a
 * line parallel to the fold drawn off at the edge of the shape, which is not
 * a fold at all — it is the right slope in the wrong place.
 */
export function foldsAlong(shape: Shape, from: Point, to: Point): Axis | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const reach = reachOf(shape);
  // A line has to be drawn, not tapped: two points a hair apart have no
  // direction to speak of and would match whichever axis rounding favoured.
  if (length < reach * 0.4) return null;
  const drawn = ((Math.atan2(dx, -dy) % Math.PI) + Math.PI) % Math.PI;
  const middle = middleOf(shape);
  // How far the middle of the shape sits from the line she drew.
  const away = Math.abs((middle.x - from.x) * dy - (middle.y - from.y) * dx) / length;
  if (away > reach * CENTRE_TOLERANCE) return null;
  for (const axis of axesOf(shape)) {
    const gap = Math.abs(drawn - axis.angle) % Math.PI;
    if (Math.min(gap, Math.PI - gap) <= AXIS_TOLERANCE) return axis;
  }
  return null;
}

/**
 * A shape to fold, built about a fold it is guaranteed to have.
 *
 * Half the outline is drawn and the other half is its mirror, so a right
 * answer always exists. What the rung decides is how hard that answer is to
 * see: how many corners, whether they are all alike, whether the fold leans,
 * and whether one corner turns back on itself.
 */
export function makeShape(rng: Rng, rung: SymmetryRung): Shape {
  // A lopsided shape is drawn again if it came out symmetric by accident.
  //
  // The rung means "exactly one fold", and that is the whole of its
  // difficulty — there is no drawing a line near the middle and hoping. But
  // the corners are nudged and the radii drawn at random, and about one
  // shape in a hundred lands on a rhombus or a kite: a second fold nobody
  // asked for, on the rung whose point is that there is only one.
  //
  // Checked rather than argued away, because the argument is a probability
  // and the check is `axesOf`. Bounded, and it keeps the last one either
  // way: a shape with two folds is an easy puzzle, not a broken one, and
  // looping for ever to avoid it would be the worse failure.
  if (!rung.regular) {
    let shape = oneShape(rng, rung);
    for (let again = 0; again < 8 && axesOf(shape).length > 1; again++) {
      shape = oneShape(rng, rung);
    }
    return shape;
  }
  return oneShape(rng, rung);
}

function oneShape(rng: Rng, rung: SymmetryRung): Shape {
  const choices = rung.corners.length > 0 ? rung.corners : [4];
  const corners = Math.max(3, choices[randInt(rng, 0, choices.length - 1)] as number);
  // How far the whole shape is turned.
  //
  // A leaning rung turns it by an arbitrary twelfth, which is the point of
  // that rung: the fold no longer runs up the page. An upright one turns it
  // by a multiple of π/n, which is the one step that maps a regular shape's
  // folds onto themselves — so a square may be drawn as a square or as a
  // diamond, and either way one of its folds is still vertical.
  //
  // Without this a regular shape had no variation left in it at all. Two
  // orientations is not many; it is two more than one, and the corner count
  // above is where the rest of the variety comes from.
  //
  // And only a *regular* shape may be turned. A lopsided one has exactly one
  // fold, put at nought by the way it is built, and turning it by a twelfth
  // or an nth moves that fold off the vertical just as surely as leaning it
  // would — which is the difference between this rung and the one above it.
  const lean = rung.oblique
    ? (randInt(rng, 1, 5) * Math.PI) / 12
    : rung.regular
      ? (randInt(rng, 0, 1) * Math.PI) / corners
      : 0;
  const odd = corners % 2 === 1;
  // Corners are placed by angle round the middle, measured from straight up.
  // A shape symmetric about that line has either one corner on it — the top,
  // for an odd count — or two, the top and the bottom. Everything else comes
  // in pairs, one each side, which is what makes the fold work.
  const pairs = odd ? (corners - 1) / 2 : (corners - 2) / 2;
  const step = (2 * Math.PI) / corners;
  const angles: number[] = [];
  for (let i = 1; i <= pairs; i++) {
    // Evenly spaced makes a regular shape; nudged makes a lopsided one, and
    // the nudge is small enough that the corners keep their order.
    const nudge = rung.regular ? 0 : (randInt(rng, -22, 22) / 100) * step;
    angles.push(step * i + nudge);
  }
  const radius = (i: number): number => {
    if (rung.regular) return 1;
    // One corner pulled in towards the middle turns the outline back on
    // itself, which is the difference between a lopsided pentagon and an
    // arrowhead. Pulled in on *both* sides, or the shape stops folding.
    if (rung.reflex && i === Math.floor(pairs / 2)) return randInt(rng, 30, 44) / 100;
    return randInt(rng, 74, 100) / 100;
  };
  const radii = angles.map((_, i) => radius(i));
  const top = rung.regular ? 1 : randInt(rng, 74, 100) / 100;
  const bottom = rung.regular ? 1 : randInt(rng, 74, 100) / 100;

  // Round the outline: the top, down the right-hand side, the bottom where
  // there is one, and back up the left.
  const polar: { angle: number; radius: number }[] = [{ angle: 0, radius: top }];
  for (const [i, angle] of angles.entries()) {
    polar.push({ angle, radius: radii[i] as number });
  }
  if (!odd) polar.push({ angle: Math.PI, radius: bottom });
  for (let i = angles.length - 1; i >= 0; i--) {
    polar.push({ angle: -(angles[i] as number), radius: radii[i] as number });
  }
  return {
    corners: polar.map(({ angle, radius: r }) =>
      turn({ x: Math.sin(angle) * r, y: -Math.cos(angle) * r }, lean),
    ),
  };
}

/** One point, turned about the origin. */
function turn(point: Point, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos };
}

/**
 * How far the player has got: the shape, and the line she is drawing on it.
 *
 * A line rather than a number, which is what makes this spell unlike every
 * other one here. The answer to an addition is typed and can be compared;
 * the answer to this is a gesture, and what it is compared against is every
 * fold the shape actually has.
 */
export interface SymmetryCast {
  readonly shape: Shape;
  readonly rung: SymmetryRung;
  /** Where the line starts and ends, while one is being drawn or after. */
  readonly from: Point | null;
  readonly to: Point | null;
  /** The fold she found, once she has found one. */
  readonly folded: Axis | null;
  readonly done: boolean;
  readonly missteps: number;
  readonly wrong: boolean;
}

export function beginSymmetryCast(rng: Rng, rung: SymmetryRung): SymmetryCast {
  return {
    shape: makeShape(rng, rung),
    rung,
    from: null,
    to: null,
    folded: null,
    done: false,
    missteps: 0,
    wrong: false,
  };
}

/** Put a finger down: the line starts here. */
export function startLine(cast: SymmetryCast, at: Point): SymmetryCast {
  if (cast.done) return cast;
  return { ...cast, from: at, to: at, folded: null, wrong: false };
}

/** Drag: the line runs to here now. */
export function dragLine(cast: SymmetryCast, at: Point): SymmetryCast {
  if (cast.done || !cast.from) return cast;
  return { ...cast, to: at };
}

/**
 * Let go, and see whether the shape folds along it.
 *
 * A wrong line is cleared rather than left on the parchment. Leaving it
 * would read as the game still thinking about it, and the next thing a child
 * does is draw another one anyway.
 */
export function releaseLine(cast: SymmetryCast): SymmetryCast {
  if (cast.done || !cast.from || !cast.to) return cast;
  const folded = foldsAlong(cast.shape, cast.from, cast.to);
  if (folded) return { ...cast, folded, done: true, wrong: false };
  return { ...cast, from: null, to: null, missteps: cast.missteps + 1, wrong: true };
}

/**
 * A fold shown to a child who cannot find one.
 *
 * The whole line, not a nudge towards it: half a fold is not a fold, and a
 * child who has drawn three wrong lines is not being helped by a fourth
 * hint. Shown only after the rung says so, and only ever one of them even
 * where the shape has six — being told a square folds four ways is a
 * different lesson from being shown that it folds at all.
 */
export function symmetryHint(cast: SymmetryCast): Axis | null {
  if (cast.done) return cast.folded;
  if (cast.missteps < Math.max(1, cast.rung.hintAfter)) return null;
  return axesOf(cast.shape)[0] ?? null;
}

/**
 * Where the mirror ladder goes next, on the same rules as every other one.
 *
 * Written here rather than reusing `nextRung` because that one keeps a child
 * inside their band, and this ladder has no bands. Every other spell scales
 * its floor to how old and able a child is; folding does not, because it is
 * a way of *looking* rather than a fluency, and the oldest child in the game
 * has very likely never been asked to do it. So this ladder runs from the
 * square to the arrowhead for everybody, and `nextRung`'s fence — which
 * would snap a nine year old off the square on their very first cast — is
 * exactly what has to be left out.
 *
 * The runs themselves are the shared ones: four clean to climb, two stumbles
 * to ease. A second opinion about how fast a child moves would be a second
 * thing to keep in step.
 */
export function nextSymmetryRung(rung: number, recent: Recent): number {
  const here = Math.max(0, Math.min(HARDEST_SYMMETRY_RUNG, Math.trunc(rung)));
  const clean = recent.slice(-CLEAN_TO_CLIMB);
  if (clean.length >= CLEAN_TO_CLIMB && clean.every(Boolean)) {
    return Math.min(HARDEST_SYMMETRY_RUNG, here + 1);
  }
  const stumbles = recent.slice(-STUMBLES_TO_EASE);
  if (stumbles.length >= STUMBLES_TO_EASE && stumbles.every((was) => !was)) {
    return Math.max(0, here - 1);
  }
  return here;
}
