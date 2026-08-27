// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { GridPoint } from "../world/topdown";
import { type PortalJourney, type PortalRung, PortalTier, journeyBetween } from "./portal";

/**
 * What the geometry teacher explains, and the journey she explains it on.
 *
 * The portal spell is the second thing in the game a child can be stuck on
 * with no way to ask, and the harder of the two: its top rungs want squares
 * and roots, which is years past the arithmetic the rest of the game asks
 * for. Its own parchment offers help, but only after two wrong answers —
 * help you have to fail into is help arriving at the worst moment. So the
 * method is somewhere you can go and read it, and that somewhere is the
 * tower, where the map already hangs on the wall.
 *
 * Four beats, one idea each, exactly as the addition lesson has:
 *
 * 1. **the rune** — the spellbook and the dividers, as they appear in the
 *    corner of the screen, so the lesson names things the player can see;
 * 2. **the ruler** — a mark is a fixed number of paces, and you are nought;
 * 3. **the legs** — the portal goes across, then down; add the two;
 * 4. **the crow** — the straight line is shorter, and here is how to get it.
 *
 * **Every beat is shown at every rung**, and only the *numbers* change with
 * the child — which is the addition lesson's rule, and the design's: a
 * lesson is not a gate. A five-year-old on the coarsest ruler meets the
 * crow's flight as a three-four-five triangle, which is the friendliest one
 * there is and teaches them nothing they can be hurt by. Hiding it would
 * mean the one child who *would* have asked cannot.
 */

/**
 * The two ends of her example, in world cells.
 *
 * Chosen so the triangle comes out whole at every ruling the spell uses: the
 * legs are four and three at fifty paces a mark, eight and six at
 * twenty-five, twenty and fifteen at ten. Every one of those is a
 * three-four-five triangle scaled up, so the crow's flight is a whole number
 * on the teacher's parchment however small the child's numbers are.
 *
 * The spell itself rounds, and rounds honestly — two places on a generated
 * map are almost never a whole number apart. Teaching is the one place that
 * gets the clean case, because a method is easier to see when the arithmetic
 * is not also in the way. The fourth beat says so in as many words.
 */
export const GEOMETRY_LESSON_FROM: GridPoint = { col: 100, row: 250 };
export const GEOMETRY_LESSON_TO: GridPoint = { col: 300, row: 100 };

/**
 * Her example at the ruling this child is being given.
 *
 * Built by the spell's own `journeyBetween`, so what she teaches cannot
 * drift from what the spell sets. The place name is the village, because the
 * example has to be a journey *somewhere* and home is the one place every
 * child has been.
 */
export function geometryLessonFor(rung: PortalRung): PortalJourney {
  return journeyBetween("village", GEOMETRY_LESSON_FROM, GEOMETRY_LESSON_TO, rung);
}

export const GeometryBeat = {
  /** What the spell is and where it lives: the spellbook and the dividers. */
  Rune: "rune",
  /** The ruler down the side of the map, and where nought is. */
  Ruler: "ruler",
  /** Across, then down. The distance is the two added. */
  Legs: "legs",
  /** The straight line, and how to get it from the two legs. */
  Crow: "crow",
} as const;

export type GeometryBeat = (typeof GeometryBeat)[keyof typeof GeometryBeat];

export const GEOMETRY_BEATS: readonly GeometryBeat[] = [
  GeometryBeat.Rune,
  GeometryBeat.Ruler,
  GeometryBeat.Legs,
  GeometryBeat.Crow,
];

/** The two legs squared and added: what the crow's flight times itself makes. */
export function squaresOf(journey: PortalJourney): number {
  return journey.across.marks ** 2 + journey.down.marks ** 2;
}

/** Where the player is in the lesson, and which way they can go from there. */
/**
 * The pages he actually turns, for a child on this rung.
 *
 * All four of them was the bug a playtest found: the geometer worked through
 * the crow's flight — two legs squared, added, and rooted — at a child whose
 * own spell asks them to count stepping stones. That is the mistake
 * `lessonFor` was written to avoid on the other side of the world, said in
 * its own words: a method demonstrated on a question they have not been
 * asked is a method they cannot check.
 *
 * So the deck is cut to the tier. Everybody gets the rune and the ruler,
 * because everybody has to find the map and know where nought is. The legs
 * arrive when the spell starts asking for both of them, and the straight
 * line only when the spell starts asking for it.
 */
export function geometryBeatsFor(rung: PortalRung): readonly GeometryBeat[] {
  if (rung.tier === PortalTier.Crow) return GEOMETRY_BEATS;
  if (rung.tier === PortalTier.Add) {
    return GEOMETRY_BEATS.filter((beat) => beat !== GeometryBeat.Crow);
  }
  return [GeometryBeat.Rune, GeometryBeat.Ruler];
}

export function nextGeometryBeat(beat: GeometryBeat, step: number): GeometryBeat {
  const index = GEOMETRY_BEATS.indexOf(beat);
  const wanted = Math.max(0, Math.min(GEOMETRY_BEATS.length - 1, index + step));
  return GEOMETRY_BEATS[wanted] as GeometryBeat;
}

export function isLastGeometryBeat(beat: GeometryBeat): boolean {
  return beat === GEOMETRY_BEATS[GEOMETRY_BEATS.length - 1];
}
