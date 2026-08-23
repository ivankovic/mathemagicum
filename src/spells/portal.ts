// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { AnchorPlacements, AreaPlacement } from "../world/anchors";
import { areaCentre, markedPlaces } from "../world/minimap";
import type { GridPoint } from "../world/topdown";

/**
 * The portal spell: measuring, on a ruled map.
 *
 * The spell moves you, and what it asks for is *how far* — which is the
 * theme rule applied as literally as the addition spell applies it. A spell
 * about distance is the one that crosses distance, and the number the child
 * states is the number the portal then travels.
 *
 * The instrument is a map with a ruler down each side. Every rung reads the
 * same instrument and answers the same question; what changes is how much of
 * the answer is already drawn. That is deliberately the shape the addition
 * spell's `given` has: scaffolding is taken away one piece at a time, and
 * the question never changes underneath the child.
 *
 * - **Count the stones.** The path arrives drawn as stepping stones, one per
 *   league. Count them. No numeral is read and nothing is added.
 * - **Read one leg.** The stones are gone and the rulers are ruled *from
 *   where you stand*, so the mark the place sits on is the distance to it.
 *   One number, read rather than worked out.
 * - **Add the legs.** Read both, add them. This is the portal's own path:
 *   it goes east, then north, and the sum is how far it travels.
 * - **As the crow flies.** The straight line, which is shorter. Squares,
 *   added, rooted — and rounded to the nearest league, because two places on
 *   a real map are almost never a whole number apart and a spell that only
 *   worked on Pythagorean triples would have to bend the world to fit.
 *
 * **Why the ruler is the difficulty dial.** The world is five hundred cells
 * across, and five hundred is a three-digit sum before anything else has
 * happened. Ruled in fifty-cell leagues the same world is ten marks across
 * and every distance is a sum within ten; ruled in tens it is fifty marks
 * and the sums carry. So one instrument covers a five-year-old counting
 * stones and a nine-year-old squaring numbers, and nothing about the map or
 * the journey has to change to move between them.
 */

/** What the child is asked to do. */
export const PortalTier = {
  /** Count the stepping stones the spell has already drawn. */
  Count: "count",
  /** Read one leg straight off a ruler that starts at your feet. */
  Read: "read",
  /** Read both legs and add them: the path the portal actually takes. */
  Add: "add",
  /** The straight line, to the nearest league. */
  Crow: "crow",
} as const;

export type PortalTier = (typeof PortalTier)[keyof typeof PortalTier];

/** Where the rulers start counting from. */
export type RulerOrigin = "player" | "corner";

export interface PortalRung {
  readonly tier: PortalTier;
  /** How many world cells one mark on the ruler is worth. */
  readonly league: number;
  readonly origin: RulerOrigin;
}

/**
 * Every setting, easiest first.
 *
 * Ordered by *what you must do*, with the ruler as the fine adjustment
 * inside each tier — a finer ruler asks the same question about bigger
 * numbers, which is a smaller step than being asked a new question.
 *
 * Ten of them, exactly as many as the addition ladder has, so the bands a
 * parent picks from cover this one without a second table of windows.
 */
export const PORTAL_RUNGS: readonly PortalRung[] = [
  { tier: PortalTier.Count, league: 50, origin: "player" }, // count to ten
  { tier: PortalTier.Read, league: 50, origin: "player" }, //  a mark within five
  { tier: PortalTier.Read, league: 25, origin: "player" }, //  a mark within ten
  { tier: PortalTier.Add, league: 50, origin: "player" }, //   sums within ten
  { tier: PortalTier.Add, league: 25, origin: "player" }, //   sums within twenty
  { tier: PortalTier.Add, league: 10, origin: "player" }, //   sums that carry
  { tier: PortalTier.Crow, league: 50, origin: "player" }, //  legs to five
  { tier: PortalTier.Crow, league: 25, origin: "player" }, //  legs to ten
  { tier: PortalTier.Crow, league: 10, origin: "player" }, //  legs to twenty-five
  // The capstone: the ruler starts at the map's edge as a real map's does,
  // so the legs have to be found by subtracting before anything else.
  { tier: PortalTier.Crow, league: 10, origin: "corner" },
];

export const HARDEST_PORTAL_RUNG = PORTAL_RUNGS.length - 1;

export function portalRungAt(index: number): PortalRung {
  const at = Math.max(0, Math.min(HARDEST_PORTAL_RUNG, Math.trunc(index)));
  return PORTAL_RUNGS[at] as PortalRung;
}

/**
 * The finer rulers, in order, for a journey too short to measure.
 *
 * A place that rounds to the same mark you are standing on has a distance of
 * nothing, and "nothing" is not a question. Rather than hide the place —
 * which would mean a destination greying out for reasons no child could see
 * — the spell rules *that journey* more finely until there is something to
 * measure. See `journeyTo`.
 */
const FINER_LEAGUES: readonly number[] = [50, 25, 10, 5, 1];

/** Which way a leg runs. Columns grow eastward and rows grow southward. */
export type Compass = "east" | "west" | "north" | "south";

export interface PortalLeg {
  readonly towards: Compass;
  /** How many marks, always positive. */
  readonly marks: number;
}

export interface PortalJourney {
  /** The anchor being travelled to, by its own id. */
  readonly place: keyof AnchorPlacements;
  readonly from: GridPoint;
  readonly to: GridPoint;
  readonly rung: PortalRung;
  /** The ruler this journey is measured on, which may be finer than the rung's. */
  readonly league: number;
  /** Where the two ends sit on the rulers, in marks. */
  readonly fromMark: GridPoint;
  readonly toMark: GridPoint;
  readonly across: PortalLeg;
  readonly down: PortalLeg;
  /** For the reading tier: which of the two legs is being asked about. */
  readonly asked: PortalLeg;
  /** The number the child has to say. */
  readonly answer: number;
}

/** How many marks a cell sits at, on a ruler of this graduation. */
export function markOf(cell: number, league: number): number {
  return Math.round(cell / league);
}

/** How wide the map is, in marks. */
export function marksAcross(cells: number, league: number): number {
  return Math.ceil(cells / league);
}

/**
 * Where a mark sits along the ruler, as a share of the map's width.
 *
 * One definition, used by the ticks *and* by the journey drawn between them,
 * because they were two definitions once and disagreed by half a mark: the
 * path treated a mark as a cell and put its centre half a step along, while
 * the ruler treated it as a point on a scale. The result was a portal drawn
 * ending twelve pixels away from the place it was going to — which is a
 * measuring spell contradicting its own instrument.
 */
export function markFraction(mark: number, cells: number, league: number): number {
  return mark / marksAcross(cells, league);
}

function legBetween(from: number, to: number, negative: Compass, positive: Compass): PortalLeg {
  const marks = Math.abs(to - from);
  return { towards: to >= from ? positive : negative, marks };
}

/**
 * What the child must say, for one tier of one journey.
 *
 * The crow's flight is rounded rather than exact. Two places on a generated
 * map are almost never a whole number of leagues apart as the crow flies,
 * and the alternatives were both worse: bending where the portal sets you
 * down until the triangle came out whole (which works for under half of
 * journeys on a fixed ruler), or re-ruling the map per destination (which
 * takes the ruler out from under the child between one cast and the next).
 */
export function answerFor(
  tier: PortalTier,
  across: PortalLeg,
  down: PortalLeg,
  asked: PortalLeg,
): number {
  if (tier === PortalTier.Read) return asked.marks;
  if (tier === PortalTier.Crow) return Math.round(Math.hypot(across.marks, down.marks));
  // Counting the stones and adding the legs are the same number: the stones
  // *are* the legs, laid end to end. Which is the point — the easiest rung
  // and the middle one answer one question with different amounts of help.
  return across.marks + down.marks;
}

/**
 * Which leg the reading tier asks about: the longer one.
 *
 * Never the shorter, because the shorter is the one that can be nothing, and
 * "how far east is it" answered by "not at all" teaches the child that the
 * ruler does not matter. Ties go to the one across, so the question is
 * stable for a journey rather than depending on which way a rounding went.
 */
export function askedLeg(across: PortalLeg, down: PortalLeg): PortalLeg {
  return down.marks > across.marks ? down : across;
}

/**
 * Where the portal sets a traveller down in a place.
 *
 * **Not simply the middle of the box.** The middle of the enchanted forest
 * is the great tree, which blocks nine cells — and a portal aimed at it put
 * the traveller inside a tree with no way out. Nothing about the spell
 * noticed: the cast was correct, the animation played, and the game was
 * over.
 *
 * That is the same class of mistake as the connectivity carve aiming at the
 * forest's centre, and it will recur every time a place grows something at
 * its heart. So the rule is stated once, here: the portal lands on the
 * nearest cell to the middle that a traveller can stand on, searched in
 * rings outward, and it never leaves the box — a landing outside the place
 * would arrive somewhere the map does not say you went, and would not count
 * as having reached it.
 *
 * `standable` is a predicate rather than a grid because this module has no
 * world in it and is the better for it; the scene passes the grid's own
 * check. Without one this is the plain centre, which is what it always was —
 * so every worked example and every test that has no world still measures
 * from the middle.
 *
 * A place that already knows where a visitor stands says so with
 * `doorstep`, and then that is the landing. The enchanted forest has one —
 * the tile the grove keeps clear in front of the great tree — and using it
 * here is the same fact serving twice rather than a special case: the
 * world's connectivity carve aims at that cell too, so "where you walk in"
 * and "where the portal puts you" cannot drift apart. Without it the ring
 * search below arrives at whichever shoulder of the tree it reaches first,
 * which is under the canopy and facing away from the thing you came to see.
 *
 * If nothing in the box will do, the centre comes back anyway. A destination
 * that vanished from the map because its middle is full would be a worse
 * failure than an awkward arrival, and it would be invisible.
 */
export function landingIn(
  area: AreaPlacement,
  standable?: (at: GridPoint) => boolean,
  doorstep?: GridPoint,
): GridPoint {
  const centre = areaCentre(area);
  // Checked against the same two rules as any other candidate, so a doorstep
  // that a later change blocks or moves out of the box falls back to the
  // search rather than becoming a worse version of the bug this fixes.
  if (doorstep && insideArea(doorstep, area) && (!standable || standable(doorstep))) {
    return doorstep;
  }
  if (!standable || standable(centre)) return centre;
  const reach = Math.max(area.width, area.height);
  for (let ring = 1; ring <= reach; ring++) {
    for (let row = centre.row - ring; row <= centre.row + ring; row++) {
      for (let col = centre.col - ring; col <= centre.col + ring; col++) {
        // The ring, not the block: everything inside it was tried on an
        // earlier pass, and re-testing it would make this quadratic in the
        // ring for no new cells.
        if (Math.max(Math.abs(col - centre.col), Math.abs(row - centre.row)) !== ring) continue;
        const at = { col, row };
        if (!insideArea(at, area)) continue;
        if (standable(at)) return at;
      }
    }
  }
  return centre;
}

/**
 * Work out one journey, on the finest ruler it needs.
 *
 * `to` is where the portal will set the traveller down and the marks are
 * computed from that cell, so what the child reads off the ruler and what
 * the spell checks are the same arithmetic on the same numbers. There is no
 * separate "true" distance that the drawing only approximates — which is
 * also why the landing cell has to be decided *before* the measuring rather
 * than nudged afterwards.
 */
export function journeyTo(
  place: keyof AnchorPlacements,
  from: GridPoint,
  area: AreaPlacement,
  rung: PortalRung,
  standable?: (at: GridPoint) => boolean,
  doorstep?: GridPoint,
): PortalJourney {
  return journeyBetween(place, from, landingIn(area, standable, doorstep), rung);
}

/**
 * The same, between two cells.
 *
 * Split out for the teacher, who works through a journey of her own rather
 * than one of the world's — and has to build it with exactly this code, for
 * the reason the addition teacher builds her example with `problemFor`: a
 * worked example written out by hand is one that can quietly stop matching
 * the thing it is teaching.
 */
export function journeyBetween(
  place: keyof AnchorPlacements,
  from: GridPoint,
  to: GridPoint,
  rung: PortalRung,
): PortalJourney {
  const options = [rung.league, ...FINER_LEAGUES.filter((l) => l < rung.league)];
  let built = measure(place, from, to, rung, rung.league);
  for (const league of options) {
    built = measure(place, from, to, rung, league);
    if (built.answer > 0) break;
  }
  return built;
}

function measure(
  place: keyof AnchorPlacements,
  from: GridPoint,
  to: GridPoint,
  rung: PortalRung,
  league: number,
): PortalJourney {
  const fromMark = { col: markOf(from.col, league), row: markOf(from.row, league) };
  const toMark = { col: markOf(to.col, league), row: markOf(to.row, league) };
  const across = legBetween(fromMark.col, toMark.col, "west", "east");
  const down = legBetween(fromMark.row, toMark.row, "north", "south");
  const asked = askedLeg(across, down);
  return {
    place,
    from,
    to,
    rung,
    league,
    fromMark,
    toMark,
    across,
    down,
    asked,
    answer: answerFor(rung.tier, across, down, asked),
  };
}

/**
 * Where the portal may take somebody, and what is merely visible.
 *
 * A place becomes a destination the first time the traveller stands inside
 * it. The ones they have not reached are still drawn — dimmed, and not
 * pickable — because a map with nothing on it is a map that says the world
 * is finished, and this one is mostly unexplored on purpose.
 *
 * The place being stood in is never a destination. A portal to where you
 * already are is not a spell, and its distance would be nothing, which is
 * not a question.
 */
export interface PortalStop {
  readonly place: keyof AnchorPlacements;
  readonly area: AreaPlacement;
  readonly reached: boolean;
  /** True when the traveller is standing in it right now. */
  readonly here: boolean;
  /**
   * The cell the portal will set the traveller down on.
   *
   * Carried on the stop rather than worked out when the journey is built,
   * because the mark drawn on the parchment's map has to sit on it too: the
   * child measures to a mark, and arriving anywhere else would make the
   * ruler a lie about a distance they had just read off it.
   */
  readonly landing: GridPoint;
}

export function insideArea(point: GridPoint, area: AreaPlacement): boolean {
  return (
    point.col >= area.col &&
    point.col < area.col + area.width &&
    point.row >= area.row &&
    point.row < area.row + area.height
  );
}

export function portalStops(
  anchors: AnchorPlacements,
  reached: Iterable<string>,
  at: GridPoint,
  standable?: (at: GridPoint) => boolean,
  doorsteps?: Partial<Record<keyof AnchorPlacements, GridPoint>>,
): readonly PortalStop[] {
  const been = new Set(reached);
  return markedPlaces(anchors).map(({ id, area }) => ({
    place: id,
    area,
    reached: been.has(id),
    here: insideArea(at, area),
    landing: landingIn(area, standable, doorsteps?.[id]),
  }));
}

/** Whether a stop can actually be travelled to. */
export function canTravelTo(stop: PortalStop): boolean {
  return stop.reached && !stop.here;
}

/**
 * Which named place the traveller is standing in, if any.
 *
 * What the game calls to mark a place reached. Kept here rather than in the
 * scene so the rule that unlocks a destination and the rule that refuses to
 * offer it are one piece of code with one definition of "inside".
 */
export function placeAt(anchors: AnchorPlacements, at: GridPoint): keyof AnchorPlacements | null {
  for (const { id, area } of markedPlaces(anchors)) {
    if (insideArea(at, area)) return id;
  }
  return null;
}

/**
 * A cast in progress.
 *
 * One box rather than the growth spell's three, because there is one
 * question: how far. Everything else about it is deliberately the same —
 * a wrong answer clears the box and counts a misstep, it never ends the
 * cast, and nothing about the spell can fail. The player who cannot work
 * out the distance closes the parchment and walks.
 */
export interface PortalCast {
  readonly journey: PortalJourney;
  readonly entry: string;
  readonly done: boolean;
  /** Wrong answers submitted, which is what the difficulty reads. */
  readonly missteps: number;
  /** Set when the last submission was wrong, so the box can be marked. */
  readonly wrong: boolean;
}

export function beginPortalCast(journey: PortalJourney): PortalCast {
  return { journey, entry: "", done: false, missteps: 0, wrong: false };
}

/**
 * How many digits the box will take.
 *
 * Measured from the answer, as the growth spell's boxes are: at the coarsest
 * ruler no distance reaches ten, and a box that accepted three digits there
 * would let a child type a number the map has no room for.
 */
function maxDigits(cast: PortalCast): number {
  return String(Math.max(1, cast.journey.answer)).length;
}

export function typePortalDigit(cast: PortalCast, digit: number): PortalCast {
  if (cast.done) return cast;
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) return cast;
  // A leading zero is dropped rather than rejected. No distance the spell
  // offers is zero — `journeyTo` rules the map finer until there is
  // something to measure — so a zero can only ever be a slip.
  if (cast.entry === "" && digit === 0) return cast;
  if (cast.entry.length >= maxDigits(cast)) return cast;
  return { ...cast, entry: cast.entry + String(digit), wrong: false };
}

export function backspacePortal(cast: PortalCast): PortalCast {
  if (cast.done || cast.entry === "") return cast;
  return { ...cast, entry: cast.entry.slice(0, -1), wrong: false };
}

export function submitPortal(cast: PortalCast): PortalCast {
  if (cast.done || cast.entry === "") return cast;
  if (Number(cast.entry) !== cast.journey.answer) {
    return { ...cast, entry: "", missteps: cast.missteps + 1, wrong: true };
  }
  return { ...cast, done: true, wrong: false };
}

/**
 * What the parchment says when the child is stuck, and only then.
 *
 * One rung's worth of help: whatever the tier above would have had drawn for
 * it. Counting is already the bottom, so it says the number of stones out
 * loud; reading points at the mark; adding names the two legs; the crow's
 * flight names the two legs as well, because the legs are what the theorem
 * is applied to and a child who has them has the hard part in front of them.
 *
 * Only after two wrong answers. Offered sooner it is a hint nobody asked
 * for; never offered at all and a child who cannot see it has nowhere to go
 * but out of the spell.
 */
export const HINT_AFTER = 2;

export function portalHint(cast: PortalCast): PortalJourney | null {
  return cast.missteps >= HINT_AFTER ? cast.journey : null;
}

/**
 * Every mark the portal steps on, in order: east or west first, then north
 * or south.
 *
 * What the bottom rung draws a stone on, and the reason that rung and the
 * middle one are the same question: the stones *are* the two legs, laid end
 * to end, so counting them and adding them come to the same number.
 *
 * The corner counts once. It was in both legs on the first attempt, which
 * put two stones in the same place and made a nine-stone journey look like
 * eight — the one number the whole rung is about.
 */
export function stonesAlong(journey: PortalJourney): readonly GridPoint[] {
  const { across, down } = marksOnLegs(journey);
  return [...across, ...down];
}

/**
 * The same marks, kept apart by which leg they belong to.
 *
 * The bottom rung lays a stone on every one of them and asks how many there
 * are. Every rung above it draws the legs as bare lines and asks the child
 * to *read* a number of marks off them — which, until this existed, meant
 * counting graduations that were drawn only along the outside edges of the
 * map, on a different axis from the line being read. The panel rules each
 * leg with these.
 *
 * Split rather than concatenated because the reading tier asks about one leg
 * and the drawing has to be able to tell them apart. The count on each side
 * is that leg's own `marks`, which is what the child must end up saying, so
 * a leg whose ticks and whose ruler number disagree is a bug this shape can
 * be tested for.
 */
export function marksOnLegs(journey: PortalJourney): {
  readonly across: readonly GridPoint[];
  readonly down: readonly GridPoint[];
} {
  const stepCol = Math.sign(journey.toMark.col - journey.fromMark.col);
  const stepRow = Math.sign(journey.toMark.row - journey.fromMark.row);
  const across: GridPoint[] = [];
  const down: GridPoint[] = [];
  for (let n = 1; n <= journey.across.marks; n++) {
    across.push({ col: journey.fromMark.col + n * stepCol, row: journey.fromMark.row });
  }
  for (let n = 1; n <= journey.down.marks; n++) {
    down.push({ col: journey.toMark.col, row: journey.fromMark.row + n * stepRow });
  }
  return { across, down };
}

/**
 * What a mark on the ruler reads as.
 *
 * Two different rulers wearing the same numbers. On the corner rung the page
 * is ruled from the *corner*, so a mark says what it says; on every other
 * rung it is ruled from where the traveller is standing, so a mark says how
 * far that is. The distinction lives here rather than in the panel because
 * it is a fact about the rung, and a panel that got it wrong would be a
 * ruler that lies about a distance a child has just measured.
 */
export function readingOf(mark: number, origin: number, rung: PortalRung): number {
  return rung.origin === "corner" ? mark : Math.abs(mark - origin);
}

/**
 * The help a journey gets, once a child has earned it.
 *
 * Which help, not the words for it: the tier decides what a child is stuck
 * on, and the panel decides how to say it in their language. Null until the
 * rung's patience runs out — see `portalHint`.
 *
 * The crow's tier carries the two squares already added, because that is the
 * step the help exists for: a child who can see `3² + 4²` written out has
 * been shown the method rather than told the answer.
 */
export type PortalHelp =
  | { readonly kind: "count"; readonly answer: number }
  | { readonly kind: "read"; readonly towards: string; readonly marks: number }
  | {
      readonly kind: "crow";
      readonly across: number;
      readonly down: number;
      readonly squares: number;
    }
  | {
      readonly kind: "legs";
      readonly across: PortalLeg;
      readonly down: PortalLeg;
    }
  | null;

export function portalHelp(cast: PortalCast): PortalHelp {
  const journey = portalHint(cast);
  if (!journey) return null;
  switch (journey.rung.tier) {
    case PortalTier.Count:
      return { kind: "count", answer: journey.answer };
    case PortalTier.Read:
      return { kind: "read", towards: journey.asked.towards, marks: journey.asked.marks };
    case PortalTier.Crow:
      return {
        kind: "crow",
        across: journey.across.marks,
        down: journey.down.marks,
        squares: journey.across.marks ** 2 + journey.down.marks ** 2,
      };
    default:
      return { kind: "legs", across: journey.across, down: journey.down };
  }
}
