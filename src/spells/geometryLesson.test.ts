// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import {
  GEOMETRY_BEATS,
  GEOMETRY_LESSON_FROM,
  GEOMETRY_LESSON_TO,
  GeometryBeat,
  geometryBeatsFor,
  geometryLessonFor,
  isLastGeometryBeat,
  nextGeometryBeat,
  squaresOf,
} from "./geometryLesson";
import { HARDEST_PORTAL_RUNG, PORTAL_RUNGS, journeyBetween, portalRungAt } from "./portal";

describe("the journey he works through", () => {
  // The whole reason those two cells were chosen. A worked example whose
  // answer is 6.7 teaches the method and then asks the child to believe the
  // arithmetic, which is the half they cannot check.
  test("the crow's flight is a whole number at every ruling", () => {
    for (const [index, rung] of PORTAL_RUNGS.entries()) {
      const journey = geometryLessonFor(rung);
      const crow = Math.hypot(journey.across.marks, journey.down.marks);
      expect({ index, whole: Number.isInteger(crow) }).toEqual({ index, whole: true });
      expect({ index, crow }).toEqual({ index, crow: Math.round(crow) });
    }
  });

  // One triangle seen at three sizes, not three triangles. A child who moves
  // up a rung should recognise the picture they were shown before.
  test("it is the same triangle at every ruling, only bigger", () => {
    const shapes = PORTAL_RUNGS.map((rung) => {
      const journey = geometryLessonFor(rung);
      return journey.across.marks / journey.down.marks;
    });
    expect(new Set(shapes).size).toBe(1);
    expect(shapes[0]).toBeCloseTo(4 / 3, 10);
  });

  test("the numbers grow as the ruler gets finer", () => {
    const answers = [50, 25, 10].map((league) => {
      const journey = geometryLessonFor({ tier: "add", league, origin: "player" });
      return journey.across.marks + journey.down.marks;
    });
    expect(answers).toEqual([7, 14, 35]);
  });

  // Built by the spell's own code, for the reason the addition teacher's
  // example is built by `problemFor`: an example written out by hand is one
  // that can quietly stop matching the thing it is teaching.
  test("it is measured by exactly the code the spell measures with", () => {
    for (const rung of PORTAL_RUNGS) {
      expect(geometryLessonFor(rung)).toEqual(
        journeyBetween("village", GEOMETRY_LESSON_FROM, GEOMETRY_LESSON_TO, rung) as never,
      );
    }
  });

  // What the page actually prints, so a wrong sum here would be a wrong sum
  // on the parchment.
  test("the squares add up to the flight times itself", () => {
    for (const rung of PORTAL_RUNGS) {
      const journey = geometryLessonFor(rung);
      const crow = Math.round(Math.hypot(journey.across.marks, journey.down.marks));
      expect(squaresOf(journey)).toBe(crow * crow);
    }
  });

  // The legs have to run *somewhere* for the words "east" and "north" to be
  // true of the picture beside them.
  test("it runs east and north, which is what the page says", () => {
    const journey = geometryLessonFor(portalRungAt(0));
    expect(journey.across.towards).toBe("east");
    expect(journey.down.towards).toBe("north");
  });
});

describe("the beats", () => {
  test("are the four the panel knows how to draw, in order", () => {
    expect(GEOMETRY_BEATS).toEqual([
      GeometryBeat.Rune,
      GeometryBeat.Ruler,
      GeometryBeat.Legs,
      GeometryBeat.Crow,
    ]);
    expect(new Set(GEOMETRY_BEATS).size).toBe(GEOMETRY_BEATS.length);
  });

  // Every beat at every rung. A lesson is not a gate — the addition teacher
  // shows all four of hers to a child adding within ten, and hiding the
  // crow's flight would mean the one child who *would* have asked cannot.
  test("there are as many of them as the addition lesson has", () => {
    expect(GEOMETRY_BEATS.length).toBe(4);
  });

  test("stepping forward and back walks them, and stops at the ends", () => {
    expect(nextGeometryBeat(GeometryBeat.Rune, 1)).toBe(GeometryBeat.Ruler);
    expect(nextGeometryBeat(GeometryBeat.Ruler, -1)).toBe(GeometryBeat.Rune);
    // Clamped rather than wrapping: a "next" that jumped back to the start
    // reads as the panel having lost its place.
    expect(nextGeometryBeat(GeometryBeat.Rune, -1)).toBe(GeometryBeat.Rune);
    expect(nextGeometryBeat(GeometryBeat.Crow, 1)).toBe(GeometryBeat.Crow);
  });

  test("only the last beat is the last one", () => {
    expect(isLastGeometryBeat(GeometryBeat.Crow)).toBe(true);
    for (const beat of GEOMETRY_BEATS.slice(0, -1)) expect(isLastGeometryBeat(beat)).toBe(false);
  });
});

describe("how much of the lesson he gives", () => {
  /**
   * Reported from a playtest: *the portal teacher teaches the most difficult
   * version even if the player is on easy mode.*
   *
   * He worked through the crow's flight — two legs squared, added and rooted
   * — at a child whose own spell asks her to count stepping stones. That is
   * the mistake `lessonFor` was written to avoid on the addition side, in
   * its own words: a method demonstrated on a question they have not been
   * asked is a method they cannot check.
   */
  test("counting and reading get the rune and the ruler, and stop there", () => {
    for (const at of [0, 1, 2]) {
      expect(geometryBeatsFor(portalRungAt(at))).toEqual([GeometryBeat.Rune, GeometryBeat.Ruler]);
    }
  });

  test("adding legs gets the legs page as well, and still no crow", () => {
    for (const at of [3, 4, 5]) {
      const deck = geometryBeatsFor(portalRungAt(at));
      expect(deck).toContain(GeometryBeat.Legs);
      expect(deck).not.toContain(GeometryBeat.Crow);
    }
  });

  test("and only the rungs that ask for the straight line are shown it", () => {
    for (const at of [6, 7, 8, 9]) {
      expect(geometryBeatsFor(portalRungAt(at))).toEqual(GEOMETRY_BEATS);
    }
  });

  // Whatever is cut, the first two are always there: everybody has to find
  // the map and know where nought is before any of it means anything.
  test("every rung is shown the rune and the ruler", () => {
    for (let at = 0; at <= HARDEST_PORTAL_RUNG; at++) {
      const deck = geometryBeatsFor(portalRungAt(at));
      expect(deck[0]).toBe(GeometryBeat.Rune);
      expect(deck[1]).toBe(GeometryBeat.Ruler);
      // And the pages kept are always a prefix of the full lesson, so the
      // order a child meets them in never changes with the rung.
      expect(GEOMETRY_BEATS.slice(0, deck.length)).toEqual([...deck]);
    }
  });
});
