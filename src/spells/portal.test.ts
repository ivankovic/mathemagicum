// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import type { AnchorPlacements, AreaPlacement } from "../world/anchors";
import { floodFillReachable, isReachable } from "../world/connectivity";
import { areaCentre, minimapPoint, minimapSize } from "../world/minimap";
import { createRng } from "../world/rng";
import type { GridPoint } from "../world/topdown";
import { generateWorld } from "../world/worldGenerator";
import { castResult } from "./cast";
import {
  HARDEST_PORTAL_RUNG,
  HINT_AFTER,
  PORTAL_RUNGS,
  PortalTier,
  answerFor,
  askedLeg,
  backspacePortal,
  beginPortalCast,
  canTravelTo,
  insideArea,
  journeyBetween,
  journeyTo,
  landingIn,
  markFraction,
  markOf,
  marksAcross,
  marksOnLegs,
  placeAt,
  portalHelp,
  portalHint,
  portalRungAt,
  portalStops,
  readingOf,
  ruleAt,
  stonesAlong,
  submitPortal,
  typePortalDigit,
  zoomsFor,
} from "./portal";

function box(col: number, row: number, size = 24): AreaPlacement {
  return { id: "somewhere", col, row, width: size, height: size };
}

const RUNG = { tier: PortalTier.Add, league: 50, origin: "player" } as const;

describe("the ruler", () => {
  test("a mark is the cell rounded to the nearest league", () => {
    expect(markOf(0, 50)).toBe(0);
    expect(markOf(24, 50)).toBe(0);
    expect(markOf(25, 50)).toBe(1);
    expect(markOf(260, 50)).toBe(5);
  });

  // The whole difficulty dial. One world, ruled three ways, is a sum within
  // ten, a sum within twenty, or a sum that carries.
  test("ruling the same world finer makes the same journey a bigger number", () => {
    const from = { col: 100, row: 100 };
    const there = box(340, 300);
    const answers = [50, 25, 10].map(
      (league) => journeyTo("harbour", from, there, { ...RUNG, league }).answer,
    );
    expect(answers).toEqual([9, 18, 46]);
    expect(marksAcross(500, 50)).toBe(10);
    expect(marksAcross(500, 10)).toBe(50);
  });
});

describe("where a mark lands on the page", () => {
  // The ruler and the journey drawn between its ticks were two definitions
  // once and disagreed by half a mark, which drew a portal ending twelve
  // pixels from the place it was going to.
  test("a place's mark lands where the place itself does", () => {
    for (const league of [50, 25, 10]) {
      for (const cell of [0, 40, 137, 250, 361, 499]) {
        const mark = markOf(cell, league);
        // Where the minimap puts the cell, as a share of the map's width.
        const onMap = (minimapPoint(cell, 0).x + 0.5) / minimapSize(500, 500).width;
        const onRuler = markFraction(mark, 500, league);
        const at = { league, cell };
        // Within half a league, which is all the rounding to a mark allows —
        // and within a pixel or two of the page at any size it is drawn.
        expect({ ...at, close: Math.abs(onMap - onRuler) < 0.5 / (500 / league) }).toEqual({
          ...at,
          close: true,
        });
      }
    }
  });

  test("the two ends of the ruler are the two edges of the map", () => {
    expect(markFraction(0, 500, 50)).toBe(0);
    expect(markFraction(marksAcross(500, 50), 500, 50)).toBe(1);
    expect(markFraction(marksAcross(500, 10), 500, 10)).toBe(1);
  });
});

describe("what each rung asks for", () => {
  const across = { towards: "east", marks: 6 } as const;
  const down = { towards: "north", marks: 3 } as const;

  test("counting the stones and adding the legs are one number", () => {
    expect(answerFor(PortalTier.Count, across, down, across)).toBe(9);
    expect(answerFor(PortalTier.Add, across, down, across)).toBe(9);
  });

  test("reading gives back the leg it asked about", () => {
    expect(answerFor(PortalTier.Read, across, down, across)).toBe(6);
    expect(answerFor(PortalTier.Read, across, down, down)).toBe(3);
  });

  // Rounded, because two places on a generated map are almost never a whole
  // number of leagues apart as the crow flies.
  test("the crow's flight is the straight line, to the nearest league", () => {
    expect(answerFor(PortalTier.Crow, across, down, across)).toBe(7); // hypot(6,3) = 6.7
    expect(
      answerFor(
        PortalTier.Crow,
        { towards: "east", marks: 3 },
        { towards: "north", marks: 4 },
        across,
      ),
    ).toBe(5);
  });

  // The crow is always shorter than the path around two sides, which is the
  // only reason the harder question is a different question at all.
  test("the crow never flies further than the portal walks", () => {
    for (let a = 1; a <= 25; a++) {
      for (let b = 1; b <= 25; b++) {
        const legA = { towards: "east", marks: a } as const;
        const legB = { towards: "north", marks: b } as const;
        const crow = answerFor(PortalTier.Crow, legA, legB, legA);
        const walk = answerFor(PortalTier.Add, legA, legB, legA);
        expect({ a, b, shorter: crow <= walk }).toEqual({ a, b, shorter: true });
      }
    }
  });

  // Never the shorter leg: the shorter one is the one that can be nothing,
  // and "how far east" answered by "not at all" teaches that the ruler does
  // not matter.
  test("reading asks about the longer leg", () => {
    expect(askedLeg({ towards: "east", marks: 2 }, { towards: "north", marks: 7 }).marks).toBe(7);
    expect(askedLeg({ towards: "east", marks: 7 }, { towards: "north", marks: 2 }).marks).toBe(7);
    // Ties go across, so one journey always asks one question.
    expect(askedLeg({ towards: "east", marks: 4 }, { towards: "north", marks: 4 }).towards).toBe(
      "east",
    );
  });
});

describe("the ladder", () => {
  test("is as long as the addition ladder, so one set of bands covers both", () => {
    expect(PORTAL_RUNGS.length).toBe(10);
    expect(HARDEST_PORTAL_RUNG).toBe(9);
  });

  test("never asks a harder question on a coarser ruler than it just used", () => {
    const order = [PortalTier.Count, PortalTier.Read, PortalTier.Add, PortalTier.Crow];
    let seen = -1;
    for (const [index, rung] of PORTAL_RUNGS.entries()) {
      const tier = order.indexOf(rung.tier);
      expect({ index, forward: tier >= seen }).toEqual({ index, forward: true });
      seen = tier;
    }
  });

  test("reading a rung off the end of the ladder gives the ends", () => {
    expect(portalRungAt(-4)).toEqual(PORTAL_RUNGS[0] as never);
    expect(portalRungAt(99)).toEqual(PORTAL_RUNGS[HARDEST_PORTAL_RUNG] as never);
  });
});

describe("measuring a journey", () => {
  test("names which way each leg runs", () => {
    const journey = journeyTo("harbour", { col: 300, row: 300 }, box(60, 60), RUNG);
    expect(journey.across.towards).toBe("west");
    expect(journey.down.towards).toBe("north");
    const other = journeyTo("harbour", { col: 60, row: 60 }, box(300, 300), RUNG);
    expect(other.across.towards).toBe("east");
    expect(other.down.towards).toBe("south");
  });

  // What the child reads off the ruler and what the spell checks have to be
  // the same arithmetic on the same numbers — there is no separate "true"
  // distance that the drawing only approximates.
  test("the marks it draws are the marks it checks", () => {
    const journey = journeyTo("bigCity", { col: 130, row: 80 }, box(330, 280), RUNG);
    expect(journey.fromMark).toEqual({ col: 3, row: 2 });
    expect(journey.toMark).toEqual({ col: 7, row: 6 });
    expect(journey.across.marks).toBe(4);
    expect(journey.down.marks).toBe(4);
    expect(journey.answer).toBe(8);
  });

  // A place that rounds onto the mark you are standing on has a distance of
  // nothing, and nothing is not a question. Rather than hide it, the spell
  // rules that journey more finely.
  test("a journey too short to measure is ruled more finely until it is not", () => {
    const near = journeyTo("village", { col: 100, row: 100 }, box(108, 100, 4), RUNG);
    expect(near.league).toBeLessThan(RUNG.league);
    expect(near.answer).toBeGreaterThan(0);
  });

  test("and a journey that measures on the rung's own ruler keeps it", () => {
    const far = journeyTo("harbour", { col: 40, row: 40 }, box(300, 300), RUNG);
    expect(far.league).toBe(RUNG.league);
  });
});

describe("where the portal may go", () => {
  const anchors = (): AnchorPlacements => ({
    village: { ...box(20, 20), id: "village" },
    harbour: { ...box(300, 40), id: "harbour" },
    bigCity: { ...box(300, 300), id: "bigCity" },
    observatory: { ...box(40, 300), id: "observatory" },
    enchantedForest: { ...box(160, 160), id: "enchantedForest" },
  });

  test("a place you have not reached is drawn but cannot be picked", () => {
    const stops = portalStops(anchors(), ["village"], { col: 25, row: 25 });
    const harbour = stops.find((s) => s.place === "harbour");
    expect(harbour?.reached).toBe(false);
    expect(canTravelTo(harbour as never)).toBe(false);
    // Still in the list, so the map can draw it dimmed rather than pretend
    // the world ends at the places you have been.
    expect(stops.length).toBe(5);
  });

  test("the place you are standing in is never a destination", () => {
    const stops = portalStops(anchors(), ["village", "harbour"], { col: 25, row: 25 });
    const village = stops.find((s) => s.place === "village");
    expect(village?.reached).toBe(true);
    expect(village?.here).toBe(true);
    expect(canTravelTo(village as never)).toBe(false);
    expect(canTravelTo(stops.find((s) => s.place === "harbour") as never)).toBe(true);
  });

  test("standing inside a place is what names it reached", () => {
    const set = anchors();
    expect(placeAt(set, { col: 305, row: 45 })).toBe("harbour");
    expect(placeAt(set, { col: 250, row: 250 })).toBeNull();
    expect(insideArea({ col: 20, row: 20 }, set.village)).toBe(true);
    expect(insideArea({ col: 44, row: 20 }, set.village)).toBe(false);
  });
});

describe("the stones the bottom rung draws", () => {
  const journey = (fromCol: number, fromRow: number, toCol: number, toRow: number) =>
    journeyTo("harbour", { col: fromCol, row: fromRow }, box(toCol, toRow), RUNG);

  // The whole reason the bottom rung and the middle one are the same
  // question: the stones *are* the legs, laid end to end.
  test("there are exactly as many stones as the answer", () => {
    for (const [a, b, c, d] of [
      [100, 100, 340, 300],
      [400, 400, 40, 40],
      [50, 300, 300, 60],
    ] as const) {
      const trip = journey(a, b, c, d);
      expect({ trip: [a, b, c, d], stones: stonesAlong(trip).length }).toEqual({
        trip: [a, b, c, d],
        stones: trip.answer,
      });
    }
  });

  // Two stones in one place made a nine-stone journey look like eight, which
  // is the one number that rung is about.
  test("no two stones sit on the same mark", () => {
    const stones = stonesAlong(journey(100, 100, 340, 300));
    const seen = new Set(stones.map((stone) => `${stone.col},${stone.row}`));
    expect(seen.size).toBe(stones.length);
  });

  test("they run along the two legs and end at the destination", () => {
    const trip = journey(100, 100, 340, 300);
    const stones = stonesAlong(trip);
    expect(stones[stones.length - 1]).toEqual(trip.toMark as never);
    // The turn happens once: every stone shares a row with the start or a
    // column with the end.
    for (const stone of stones) {
      const onLeg = stone.row === trip.fromMark.row || stone.col === trip.toMark.col;
      expect({ stone, onLeg }).toEqual({ stone, onLeg: true });
    }
  });

  /**
   * The graduations the panel rules each leg with. A leg whose ticks and
   * whose ruler number disagree by one is worse than a leg with no ticks on
   * it: the child counts, gets a different number from the one the spell
   * wants, and has no way to tell which of the two is wrong.
   */
  test("each leg carries exactly as many marks as that leg is worth", () => {
    for (const [a, b, c, d] of [
      [100, 100, 340, 300],
      [400, 400, 40, 40],
      [50, 300, 300, 60],
    ] as const) {
      const trip = journey(a, b, c, d);
      const legs = marksOnLegs(trip);
      expect({ across: legs.across.length, down: legs.down.length }).toEqual({
        across: trip.across.marks,
        down: trip.down.marks,
      });
      // And the two together are still what the bottom rung lays stones on.
      expect([...legs.across, ...legs.down]).toEqual(stonesAlong(trip) as never);
    }
  });

  test("a journey that only runs one way still lays a full row of them", () => {
    const straight = journeyTo("harbour", { col: 100, row: 100 }, box(340, 88), RUNG);
    expect(straight.down.marks).toBe(0);
    expect(stonesAlong(straight).length).toBe(straight.answer);
  });
});

describe("casting it", () => {
  const journey = () => journeyTo("harbour", { col: 100, row: 100 }, box(340, 300), RUNG);

  test("a wrong answer clears the box and counts, and never ends the cast", () => {
    let cast = beginPortalCast(journey());
    cast = submitPortal(typePortalDigit(cast, 4));
    expect(cast.done).toBe(false);
    expect(cast.wrong).toBe(true);
    expect(cast.missteps).toBe(1);
    expect(cast.entry).toBe("");
    cast = submitPortal(typePortalDigit(cast, 9));
    expect(cast.done).toBe(true);
    expect(castResult(cast, true)).toEqual({ solved: true, clean: false });
  });

  test("right first time is a clean cast", () => {
    const cast = submitPortal(typePortalDigit(beginPortalCast(journey()), 9));
    expect(castResult(cast, true)).toEqual({ solved: true, clean: true });
  });

  test("the box takes no more digits than the answer has", () => {
    let cast = beginPortalCast(journey()); // answer 9, one digit
    cast = typePortalDigit(cast, 1);
    cast = typePortalDigit(cast, 2);
    expect(cast.entry).toBe("1");
    expect(backspacePortal(cast).entry).toBe("");
  });

  test("a leading zero is dropped rather than typed", () => {
    expect(typePortalDigit(beginPortalCast(journey()), 0).entry).toBe("");
  });

  test("the mark on the box clears on the next keystroke, not on its own", () => {
    let cast = submitPortal(typePortalDigit(beginPortalCast(journey()), 4));
    expect(cast.wrong).toBe(true);
    cast = typePortalDigit(cast, 9);
    expect(cast.wrong).toBe(false);
  });

  test("help arrives after two wrong answers, and not before", () => {
    let cast = beginPortalCast(journey());
    expect(portalHint(cast)).toBeNull();
    for (let go = 0; go < HINT_AFTER; go++) cast = submitPortal(typePortalDigit(cast, 4));
    expect(portalHint(cast)).not.toBeNull();
  });

  test("an empty box submits to nothing at all", () => {
    const cast = beginPortalCast(journey());
    expect(submitPortal(cast)).toEqual(cast);
  });
});

describe("the ruler moves", () => {
  /**
   * The band, stated as a rule rather than as a list.
   *
   * A fifth either side. What this is really guarding is the ladder: the
   * rungs are ordered by how big a number they ask for, and a zoom set wide
   * enough to make one rung ask the next one's numbers would be a ladder
   * that no longer climbs.
   */
  test("every ruler a rung may be drawn with is within a fifth of its own", () => {
    for (const rung of PORTAL_RUNGS) {
      const zooms = zoomsFor(rung);
      expect(zooms).toContain(rung.league);
      for (const league of zooms) {
        expect({ league, ok: league >= rung.league * 0.8 }).toEqual({ league, ok: true });
        expect({ league, ok: league <= rung.league * 1.2 }).toEqual({ league, ok: true });
      }
    }
  });

  // And a league nobody set a band for stays where it is, rather than being
  // given a made-up one.
  test("a league with no band of its own does not move", () => {
    const odd = { ...RUNG, league: 37 };
    expect(zoomsFor(odd)).toEqual([37]);
    expect(ruleAt(odd, createRng(1)).league).toBe(37);
  });

  test("ruling a map only ever picks one of that rung's own rulers", () => {
    const rung = portalRungAt(0);
    const drawn = new Set<number>();
    const rng = createRng(7);
    for (let go = 0; go < 200; go++) drawn.add(ruleAt(rung, rng).league);
    // Every one of them is a ruler this rung owns...
    for (const league of drawn) expect(zoomsFor(rung)).toContain(league);
    // ...and over two hundred casts it has reached for all of them, which is
    // the half that a `ruleAt` returning a constant would pass without.
    expect(drawn.size).toBe(zoomsFor(rung).length);
  });

  // Everything else about the rung is left alone. The zoom is the ruler and
  // nothing but: a cast that came back on a different tier would be a
  // different question, not the same one measured differently.
  test("and changes nothing else about the rung", () => {
    const rung = portalRungAt(HARDEST_PORTAL_RUNG);
    const ruled = ruleAt(rung, createRng(3));
    expect(ruled.tier).toBe(rung.tier);
    expect(ruled.origin).toBe(rung.origin);
  });
});

describe("in a world the generator actually made", () => {
  // Every named place, at every rung and on every ruler that rung may be
  // drawn with, has a distance a child can be asked for. A rung that
  // produced a zero, or a number too big for its ruler, would be one no
  // child could ever answer.
  //
  // The zooms are walked here rather than in a test of their own because
  // generating a world is most of a second and these five are already
  // standing: a ruler that only works on the league it was named after is a
  // ruler this spell now reaches for anyway.
  test("every journey at every rung and every zoom has an answer worth asking", () => {
    // How often a journey comes out the same number whatever the map is
    // ruled at, which is the thing the zooms exist to prevent.
    let same = 0;
    let journeys = 0;
    for (const seed of [1, 2, 3, 4, 5]) {
      const { grid, anchors, playerStart } = generateWorld(500, 500, seed);
      expect(grid.width).toBe(500);
      for (const stop of portalStops(anchors, ["village"], playerStart)) {
        if (stop.here) continue;
        for (const [index, rung] of PORTAL_RUNGS.entries()) {
          const answers = zoomsFor(rung).map(
            (league) => journeyTo(stop.place, playerStart, stop.area, { ...rung, league }).answer,
          );
          for (const answer of answers) {
            const at = { seed, place: stop.place, rung: index };
            expect({ ...at, ok: answer > 0 }).toEqual({ ...at, ok: true });
            expect({ ...at, ok: answer < 1000 }).toEqual({ ...at, ok: true });
          }
          journeys++;
          if (new Set(answers).size === 1) same++;
        }
      }
    }
    // Most of them move. Not all: at the coarsest rulers the answers are
    // single digits, and a fifth either side of a ruler that reads "four"
    // sometimes still reads four. Measured at one in nine across five
    // worlds, so a quarter is a bound that says "most" without pinning the
    // generator's exact output into a test.
    expect(journeys).toBeGreaterThan(100);
    expect(same / journeys).toBeLessThan(0.25);
    // Five whole worlds, and generating one is most of a second. It sat just
    // under the default limit and tipped over it whenever the machine was
    // busy, which is a flake rather than a failure — the coverage is worth
    // more than the default.
  }, 20_000);

  // The portal has to put you where the map said it would.
  test("it sets you down in the middle of the place it named", () => {
    const { anchors, playerStart } = generateWorld(500, 500, 3);
    const journey = journeyTo("harbour", playerStart, anchors.harbour, RUNG);
    expect(journey.to).toEqual(areaCentre(anchors.harbour));
    expect(insideArea(journey.to, anchors.harbour)).toBe(true);
  });

  /**
   * The bug this whole `landingIn` business exists for.
   *
   * The portal used to aim at the middle of the box. The middle of the
   * enchanted forest is the great tree, which blocks nine cells — so a
   * correct cast set the traveller down inside a tree with no way out, and
   * nothing in the spell noticed: the animation played, the arithmetic was
   * right, and the game was over.
   *
   * Checked as *reachability from the landing cell back to where the player
   * started*, not merely as "the cell is passable". A cell against the
   * trunk with the wood closed round it passes the weaker check and is the
   * same trap.
   */
  test("it never sets you down anywhere you cannot walk out of", () => {
    // Three seeds rather than eight: each is a full 500x500 generation plus
    // a flood fill of a quarter of a million cells, and the thing being
    // guarded against is structural — the forest's middle is its tree in
    // every world there is.
    for (const seed of [1, 2, 3]) {
      const { grid, anchors, playerStart } = generateWorld(500, 500, seed);
      const standable = (cell: GridPoint) =>
        grid.isPassable(cell.col, cell.row) &&
        [
          [0, -1],
          [0, 1],
          [-1, 0],
          [1, 0],
        ].some(([dCol, dRow]) =>
          grid.isPassable(cell.col + (dCol as number), cell.row + (dRow as number)),
        );
      const reachable = floodFillReachable(grid, playerStart);
      for (const stop of portalStops(anchors, ["village"], playerStart, standable)) {
        const at = { seed, place: stop.place };
        // Inside the place it named, or the map would be pointing at
        // somewhere you did not arrive.
        expect({ ...at, inside: insideArea(stop.landing, stop.area) }).toEqual({
          ...at,
          inside: true,
        });
        expect({ ...at, standable: standable(stop.landing) }).toEqual({ ...at, standable: true });
        expect({ ...at, out: isReachable(reachable, grid, stop.landing) }).toEqual({
          ...at,
          out: true,
        });
      }
    }
  });

  // The doorstep wins when there is one, so arriving by portal and walking
  // in on foot put you on the same tile — the one the grove keeps clear in
  // front of the tree, rather than whichever shoulder the ring search
  // happens to reach first.
  test("it lands a traveller on the forest's own doorstep", () => {
    const { grid, anchors, grove } = generateWorld(500, 500, 3);
    const landing = landingIn(
      anchors.enchantedForest,
      (cell) => grid.isPassable(cell.col, cell.row),
      grove.doorstep,
    );
    expect(landing).toEqual(grove.doorstep);
  });

  // ...and a doorstep that a later change moves out of the box, or builds
  // something on, falls back to the search rather than becoming a worse
  // version of the bug it was added to fix.
  test("a doorstep that has stopped being one is ignored", () => {
    const { grid, anchors } = generateWorld(500, 500, 3);
    const standable = (cell: GridPoint) => grid.isPassable(cell.col, cell.row);
    const outside = { col: anchors.enchantedForest.col - 5, row: anchors.enchantedForest.row };
    const stranded = landingIn(anchors.enchantedForest, standable, outside);
    expect(stranded).not.toEqual(outside);
    expect(insideArea(stranded, anchors.enchantedForest)).toBe(true);
    // And one inside the box but blocked — the great tree's own middle.
    const blocked = areaCentre(anchors.enchantedForest);
    const away = landingIn(anchors.enchantedForest, standable, blocked);
    expect(away).not.toEqual(blocked);
    expect(standable(away)).toBe(true);
  });

  // And the specific cell, named: the forest's middle is the tree and the
  // landing is not it. Stated as its own case so that a future change which
  // quietly makes the forest's centre walkable again does not silently
  // remove the only place the general test above has any work to do.
  test("the forest's landing is not the great tree it grew around", () => {
    const { grid, anchors, grove } = generateWorld(500, 500, 3);
    const middle = areaCentre(anchors.enchantedForest);
    expect(grid.isPassable(middle.col, middle.row)).toBe(false);
    expect(grid.getObjectAt(middle.col, middle.row)?.type).toBe("great-tree");
    const landing = landingIn(anchors.enchantedForest, (cell) =>
      grid.isPassable(cell.col, cell.row),
    );
    expect(landing).not.toEqual(middle);
    expect(grid.isPassable(landing.col, landing.row)).toBe(true);
    // And it lands in the clearing the grove keeps, not out in the wood.
    expect(Math.abs(landing.col - grove.tree.col)).toBeLessThanOrEqual(3);
    expect(Math.abs(landing.row - grove.tree.row)).toBeLessThanOrEqual(3);
  });
});

describe("what a mark on the ruler reads as", () => {
  /**
   * Two rulers wearing the same numbers.
   *
   * On the corner rung the page is ruled from the corner, so a mark says
   * what it says. On every other rung it is ruled from where the traveller
   * is standing, so a mark says how far that is — and a panel that got it
   * the wrong way round would be a ruler that lies about a distance a child
   * had just measured off it.
   */
  test("from the corner, a mark is its own number", () => {
    const corner = PORTAL_RUNGS.find((rung) => rung.origin === "corner");
    if (!corner) throw new Error("no rung is ruled from the corner");
    expect(readingOf(7, 3, corner)).toBe(7);
    expect(readingOf(0, 9, corner)).toBe(0);
  });

  test("from where she stands, a mark is how far away it is", () => {
    const here = PORTAL_RUNGS.find((rung) => rung.origin !== "corner");
    if (!here) throw new Error("no rung is ruled from the traveller");
    expect(readingOf(7, 3, here)).toBe(4);
    // Behind her counts the same as in front: a ruler has no sign on it.
    expect(readingOf(3, 7, here)).toBe(4);
    expect(readingOf(5, 5, here)).toBe(0);
  });
});

describe("the help a journey gets", () => {
  const castAt = (rung: number, missteps: number) => {
    const journey = journeyBetween(
      "harbour",
      { col: 10, row: 10 },
      { col: 210, row: 160 },
      portalRungAt(rung),
    );
    let cast = beginPortalCast(journey);
    for (let n = 0; n < missteps; n++) cast = { ...cast, missteps: cast.missteps + 1 };
    return cast;
  };

  test("none of it until the rung's patience runs out", () => {
    for (const [index] of PORTAL_RUNGS.entries()) {
      expect({ index, help: portalHelp(castAt(index, 0)) }).toEqual({ index, help: null });
    }
  });

  // Which help, not the words for it: the tier decides what a child is stuck
  // on, and the panel decides how to say it in their language.
  test("and every rung has a kind of help when it does", () => {
    for (const [index] of PORTAL_RUNGS.entries()) {
      const help = portalHelp(castAt(index, 9));
      expect({ index, given: help !== null }).toEqual({ index, given: true });
      expect(["count", "read", "crow", "legs"]).toContain(help?.kind as string);
    }
  });

  /**
   * The crow's help carries the two squares already added, because that is
   * the step it exists for: a child who can see `4² + 3²` written out has
   * been shown the method rather than told the answer.
   */
  test("the crow's help does the squaring, and gets it right", () => {
    const crow = PORTAL_RUNGS.findIndex((rung) => rung.tier === PortalTier.Crow);
    if (crow < 0) throw new Error("no crow rung");
    const help = portalHelp(castAt(crow, 9));
    expect(help?.kind).toBe("crow");
    if (help?.kind !== "crow") return;
    expect(help.squares).toBe(help.across ** 2 + help.down ** 2);
    // And it is the hypotenuse the child is being asked for.
    expect(Math.round(Math.sqrt(help.squares))).toBeGreaterThan(0);
  });

  test("the counting rung is simply told the number", () => {
    const count = PORTAL_RUNGS.findIndex((rung) => rung.tier === PortalTier.Count);
    if (count < 0) throw new Error("no counting rung");
    const cast = castAt(count, 9);
    const help = portalHelp(cast);
    expect(help).toEqual({ kind: "count", answer: cast.journey.answer });
  });

  test("and the reading rung is pointed at the leg it was asked about", () => {
    const read = PORTAL_RUNGS.findIndex((rung) => rung.tier === PortalTier.Read);
    if (read < 0) throw new Error("no reading rung");
    const cast = castAt(read, 9);
    const help = portalHelp(cast);
    expect(help).toEqual({
      kind: "read",
      towards: cast.journey.asked.towards,
      marks: cast.journey.asked.marks,
    });
  });
});
