// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { createRng } from "../world/rng";
import { makeAdditionProblem, problemFor } from "./addition";
import {
  BANDS,
  CLEAN_TO_CLIMB,
  DEFAULT_BAND,
  HARDEST_RUNG,
  RECENT_CASTS,
  RUNGS,
  SHARED_TOP_RUNG,
  STUMBLES_TO_EASE,
  SUGGESTED_BAND,
  bandAt,
  bandOn,
  nextRung,
  recordCast,
  rungAt,
  rungInBand,
  sampleProblem,
} from "./difficulty";
import { HARDEST_CLOCK_RUNG } from "./hourglass";
import { HARDEST_ARRAY_RUNG } from "./multiplication";
import { HARDEST_PORTAL_RUNG } from "./portal";

/** Every ladder `nextRung` is asked to walk, and what each one is called. */
const LADDERS = [
  { name: "addition", hardest: HARDEST_RUNG },
  { name: "portal", hardest: HARDEST_PORTAL_RUNG },
  { name: "array", hardest: HARDEST_ARRAY_RUNG },
  { name: "clock", hardest: HARDEST_CLOCK_RUNG },
] as const;

describe("the ladder", () => {
  test("every rung asks for at least one jump the child has to make", () => {
    for (const [index, rung] of RUNGS.entries()) {
      expect({ index, ok: rung.given < rung.places }).toEqual({ index, ok: true });
      expect({ index, ok: rung.places >= 1 && rung.places <= 6 }).toEqual({ index, ok: true });
    }
  });

  // The order is the curriculum. A rung that made the sums smaller *and*
  // added a carry would be two changes at once, and neither would be
  // teachable.
  test("nothing ever gets easier as you go up", () => {
    for (let at = 1; at < RUNGS.length; at++) {
      const under = RUNGS[at - 1];
      const over = RUNGS[at];
      if (!under || !over) throw new Error("no rung");
      expect({ at, ok: over.places >= under.places }).toEqual({ at, ok: true });
      if (over.places === under.places) {
        const harder =
          (over.crossing && !under.crossing) ||
          (over.crossing === under.crossing && over.given < under.given);
        expect({ at, harder }).toEqual({ at, harder: true });
      }
    }
  });

  // What every player had before any of this existed, and what a saved
  // profile from before it must come back to.
  //
  // No longer the top of the ladder, and that is the point of checking it
  // here rather than trusting `BANDS.length - 1`: the six-digit band sits
  // above this one, and a default that followed the end of the list would
  // have moved every child already playing onto sums nobody chose for them.
  test("the band a player from before this had still ends where it did", () => {
    expect(rungAt(SHARED_TOP_RUNG)).toEqual({ places: 3, crossing: true, given: 0 });
    expect(bandAt(DEFAULT_BAND).to).toBe(SHARED_TOP_RUNG);
    expect(DEFAULT_BAND).toBeLessThan(BANDS.length - 1);
  });

  // The ladder above three places is addition getting longer, and nothing
  // else. Every rung up there carries, because a longer sum that does not
  // carry is an easier sum than the one below it.
  test("and the ladder above it grows by places alone", () => {
    for (const rung of RUNGS.filter((one) => one.places > 3)) {
      expect({ places: rung.places, crossing: rung.crossing }).toEqual({
        places: rung.places,
        crossing: true,
      });
    }
    expect(rungAt(HARDEST_RUNG)).toEqual({ places: 6, crossing: true, given: 0 });
  });

  test("a rung index from anywhere is clamped rather than trusted", () => {
    expect(rungAt(-5)).toEqual(RUNGS[0] as never);
    expect(rungAt(999)).toEqual(RUNGS[HARDEST_RUNG] as never);
    expect(rungAt(2.7)).toEqual(RUNGS[2] as never);
  });
});

describe("the bands", () => {
  test("cover the whole ladder between them", () => {
    expect(BANDS[0]?.from).toBe(0);
    expect(BANDS[BANDS.length - 1]?.to).toBe(HARDEST_RUNG);
    for (let rung = 0; rung <= HARDEST_RUNG; rung++) {
      expect({ rung, covered: BANDS.some((b) => rung >= b.from && rung <= b.to) }).toEqual({
        rung,
        covered: true,
      });
    }
  });

  // Picking the neighbouring band should be off by a nudge, not by a year.
  test("neighbours overlap, so a wrong choice at setup is forgiving", () => {
    for (let at = 1; at < BANDS.length; at++) {
      const under = BANDS[at - 1];
      const over = BANDS[at];
      if (!under || !over) throw new Error("no band");
      expect({ at, overlap: over.from <= under.to }).toEqual({ at, overlap: true });
      expect({ at, rising: over.from > under.from && over.to > under.to }).toEqual({
        at,
        rising: true,
      });
    }
  });

  test("every band is wide enough for the game to move inside it", () => {
    for (const [at, band] of BANDS.entries()) {
      expect({ at, room: band.to - band.from }).toEqual({ at, room: band.to - band.from });
      expect(band.to).toBeGreaterThan(band.from);
    }
  });

  // A crop is a crop whoever grew it. What changes is what it is *quoted* at
  // — and every price in the store is quoted in crops, so the economy is the
  // same at every band.
  test("each band quotes a crop differently, and all of them in whole rays", () => {
    const prices = BANDS.map((band) => band.cropPrice);
    expect(new Set(prices).size).toBe(prices.length);
    for (const price of prices) {
      expect(Number.isInteger(price)).toBe(true);
      expect(price).toBeGreaterThan(0);
    }
    // The band a save from before any of this lands on. It used to keep the
    // exact price the game shipped with; the prices have since moved off the
    // round ducat so that the shop has counting in it, so what it keeps is
    // its *place* — the hardest band, which is what that game was.
    //
    // A crop is worth more there than it was, and so is everything it buys:
    // the store prices in crops, so both sides rescale together and a purse
    // saved under the old prices buys a little less. That is safe here for a
    // reason the design states out loud — crops regrow and seeds are free,
    // so the shop is somewhere for the work to go rather than a gate.
    expect(bandAt(DEFAULT_BAND).cropPrice).toBe(350);
  });

  /**
   * A crop is worth more the harder the sums are.
   *
   * The order is the part worth keeping true — the prices used to dip in the
   * middle (1,00 → 0,50 → …), so the second-easiest band paid least of all,
   * which is a rule nobody could learn and everybody would notice.
   *
   * The count is no longer asserted. It was three, from a playtest that
   * found four rows of sums a row too many to compare at a glance — and that
   * finding was about four rows *side by side* on a page shared with the
   * name box and the swatches. The choice has a screen of its own now and
   * the rows are stacked, so the argument that fixed it at three no longer
   * applies to the screen it was made about.
   */
  test("a crop is worth more the harder it gets", () => {
    for (let at = 1; at < BANDS.length; at++) {
      const under = BANDS[at - 1];
      const over = BANDS[at];
      if (!under || !over) throw new Error("no band");
      expect({ at, rising: over.cropPrice > under.cropPrice }).toEqual({ at, rising: true });
    }
    // Whole coins and halves only: a price with a five-ray tail would need a
    // coin the purse does not have.
    for (const band of BANDS) expect(band.cropPrice % 50).toBe(0);
  });
});

describe("moving inside a band", () => {
  const band = bandAt(1);
  const clean = (count: number) => Array.from({ length: count }, () => true);

  test("a run of clean casts earns a harder rung", () => {
    expect(nextRung(band, band.from, clean(CLEAN_TO_CLIMB))).toBe(band.from + 1);
  });

  // A child who guesses right twice has not learned anything, and being moved
  // up for it is a punishment dressed as praise.
  test("one short of the run is not enough", () => {
    expect(nextRung(band, band.from, clean(CLEAN_TO_CLIMB - 1))).toBe(band.from);
  });

  test("stumbles ease it back", () => {
    const recent = [
      ...clean(RECENT_CASTS - STUMBLES_TO_EASE),
      ...Array(STUMBLES_TO_EASE).fill(false),
    ];
    expect(nextRung(band, band.to, recent)).toBe(band.to - 1);
  });

  // A child who is stuck should not have to prove it as many times as a
  // child who is flying has to prove that.
  test("coming down is quicker than going up", () => {
    expect(STUMBLES_TO_EASE).toBeLessThan(CLEAN_TO_CLIMB);
  });

  test("it walks the whole band and stops at both ends", () => {
    let rung = band.from;
    for (let cast = 0; cast < 400; cast++) {
      rung = nextRung(band, rung, clean(RECENT_CASTS));
      expect(rung).toBeLessThanOrEqual(band.to);
    }
    expect(rung).toBe(band.to);
    for (let cast = 0; cast < 400; cast++) {
      rung = nextRung(band, rung, Array(RECENT_CASTS).fill(false));
      expect(rung).toBeGreaterThanOrEqual(band.from);
    }
    expect(rung).toBe(band.from);
  });

  // The rule that could never fire. The window was six casts and leaving a
  // band needed a run of eight, so no child could ever have left one — the
  // condition was simply unreachable, and nothing said so. There is no
  // leaving a band any more, but the window is still derived from the runs
  // rather than picked, which is what stopped it happening again.
  test("the window can hold the longest run any rule asks about", () => {
    expect(RECENT_CASTS).toBeGreaterThanOrEqual(CLEAN_TO_CLIMB);
    expect(RECENT_CASTS).toBeGreaterThanOrEqual(STUMBLES_TO_EASE);
    let recent: readonly boolean[] = [];
    for (let at = 0; at < RECENT_CASTS; at++) {
      recent = recordCast(recent, { solved: true, clean: true });
    }
    expect(recent.length).toBe(RECENT_CASTS);
  });

  // Opening the spellbook and thinking better of it is a thing children do.
  // Counting the dismissal as a wrong answer would mean two changes of mind
  // quietly made their sums easier, with nothing they answered wrong and
  // nothing on screen to say why.
  test("an abandoned cast is not a stumble, and not anything else either", () => {
    let recent: readonly boolean[] = [];
    for (let at = 0; at < 5; at++) {
      recent = recordCast(recent, { solved: false, clean: false });
    }
    expect(recent).toEqual([]);
    expect(nextRung(band, band.to, recent)).toBe(band.to);
  });

  test("abandoning does not break a run of clean casts either", () => {
    let recent: readonly boolean[] = [];
    for (let at = 0; at < CLEAN_TO_CLIMB; at++) {
      recent = recordCast(recent, { solved: true, clean: true });
      recent = recordCast(recent, { solved: false, clean: false });
    }
    expect(nextRung(band, band.from, recent)).toBe(band.from + 1);
  });

  // A save written while the ladder was open at both ends can name a rung
  // outside the band. It reads back as the nearest rung inside it: that child
  // is being put back where a person chose to put them, and it happens on the
  // way in rather than mid-session so the sums never change under them.
  test("a saved rung is clamped to the band", () => {
    expect(rungInBand(band, 0)).toBe(band.from);
    expect(rungInBand(band, HARDEST_RUNG)).toBe(band.to);
    expect(rungInBand(band, 99)).toBe(band.to);
    expect(rungInBand(band, band.from + 1)).toBe(band.from + 1);
    expect(rungInBand(band, Number.NaN)).toBe(band.from);
  });

  // The window is emptied whenever the rung moves. Without that, the four
  // clean casts that earned a climb are still there on the next cast and earn
  // another one — which is a ramp, not adaptation.
  test("a child playing well climbs a rung at a time, not a band at a time", () => {
    let rung = band.from;
    let recent: readonly boolean[] = [];
    let casts = 0;
    while (rung < band.to && casts < 100) {
      recent = recordCast(recent, { solved: true, clean: true });
      const moved = nextRung(band, rung, recent);
      if (moved !== rung) recent = [];
      rung = moved;
      casts++;
    }
    expect(rung).toBe(band.to);
    expect(casts).toBeGreaterThanOrEqual(CLEAN_TO_CLIMB * (band.to - band.from));
  });

  test("the window remembers only the recent past", () => {
    let recent: readonly boolean[] = [];
    for (let at = 0; at < RECENT_CASTS * 3; at++) {
      recent = recordCast(recent, { solved: true, clean: at % 2 === 0 });
    }
    expect(recent.length).toBe(RECENT_CASTS);
  });
});

describe("the sums each band actually sets", () => {
  // Generated from the band's own starting rung, never typed out: a sample
  // written by hand is one that can quietly stop matching what the band does,
  // which is the same reason the teacher's example is built by the spell.
  const draw = (seed: number, rung: ReturnType<typeof rungAt>) =>
    makeAdditionProblem(createRng(seed), rung);

  test("a band's sample is a problem that band would really set", () => {
    for (const [at, band] of BANDS.entries()) {
      const rung = rungAt(band.from);
      const sample = sampleProblem(band, draw);
      const rebuilt = problemFor(sample.start, sample.addend, rung.places);
      expect({ at, places: rebuilt.jumps.length }).toEqual({ at, places: rung.places });
      expect({ at, digits: String(sample.start).length }).toEqual({ at, digits: rung.places });
    }
  });

  test("the four samples are visibly different sums", () => {
    const samples = BANDS.map((band) => {
      const sample = sampleProblem(band, draw);
      return `${sample.start} + ${sample.addend}`;
    });
    expect(new Set(samples).size).toBe(samples.length);
  });

  // `1 + 4` is a true example of the gentlest band and a useless one: nobody
  // picking between four tiles can tell from it whether that band means sums
  // to nine or sums to five.
  test("a sample is a typical problem, not the smallest one going", () => {
    for (const [at, band] of BANDS.entries()) {
      const rung = rungAt(band.from);
      const low = rung.places === 1 ? 1 : 10 ** (rung.places - 1);
      const high = 10 ** rung.places - 1;
      const sample = sampleProblem(band, draw);
      expect({ at, ok: sample.start > low + (high - low) * 0.2 }).toEqual({ at, ok: true });
      expect({ at, ok: sample.addend > 1 }).toEqual({ at, ok: true });
    }
  });

  test("the same band always shows the same sample", () => {
    for (const band of BANDS) {
      expect(sampleProblem(band, draw)).toEqual(sampleProblem(band, draw));
    }
  });
});

describe("where a new player starts", () => {
  // The two failures are not equal. A child given sums that are too easy
  // climbs out within a few casts; a six-year-old handed 504 + 274 cannot
  // play at all and has no way to say so.
  test("a new player does not start on the hardest sums", () => {
    expect(SUGGESTED_BAND).toBeLessThan(DEFAULT_BAND);
    expect(bandAt(SUGGESTED_BAND).from).toBeLessThan(bandAt(DEFAULT_BAND).from);
  });

  test("but it is not the very gentlest either, and neighbours are one tap away", () => {
    expect(SUGGESTED_BAND).toBeGreaterThan(0);
    expect(SUGGESTED_BAND).toBeLessThan(BANDS.length - 1);
  });

  // A child who was already playing had one difficulty and it was the
  // hardest. Anything else would restyle their game on the way in.
  test("a player from before any of this keeps the sums they had", () => {
    expect(bandAt(DEFAULT_BAND).to).toBe(SHARED_TOP_RUNG);
    expect(rungInBand(bandAt(DEFAULT_BAND), SHARED_TOP_RUNG)).toBe(SHARED_TOP_RUNG);
    // And is *not* carried up by the six-digit band being added above them.
    // A save nobody touched must come back to the sums it left.
    expect(rungInBand(bandAt(DEFAULT_BAND), HARDEST_RUNG)).toBe(SHARED_TOP_RUNG);
  });
});

describe("the fence at the edges of the band", () => {
  const band = bandAt(0);
  const clean = (count: number) => Array.from({ length: count }, () => true);

  // The rule, in one line. A child at the top of the gentlest band who
  // answers perfectly for as long as they like is still doing sums within
  // ten, because that is what somebody chose for them.
  test("no run of clean casts, however long, takes a child past the top", () => {
    for (const length of [CLEAN_TO_CLIMB, CLEAN_TO_CLIMB * 4, 200]) {
      expect(nextRung(band, band.to, clean(length))).toBe(band.to);
    }
  });

  test("and no run of stumbles takes them below the bottom", () => {
    for (const length of [STUMBLES_TO_EASE, STUMBLES_TO_EASE * 4, 200]) {
      expect(nextRung(band, band.from, Array(length).fill(false))).toBe(band.from);
    }
  });

  // Inside the band nothing changed: the whole point is that the adaptation
  // still works, it simply works within what a person chose.
  test("but inside the band it still moves, both ways", () => {
    expect(nextRung(band, band.from, clean(CLEAN_TO_CLIMB))).toBe(band.from + 1);
    expect(nextRung(band, band.to, Array(STUMBLES_TO_EASE).fill(false))).toBe(band.to - 1);
  });

  /**
   * The invariant, checked rather than argued: no sequence of results puts
   * any rung outside the band, on any ladder.
   *
   * Exhaustive over the bands and the four ladders, and over runs long
   * enough to reach either edge several times over, with the results driven
   * by a fixed seed so a failure is a failure somebody can reproduce.
   */
  test("no sequence of casts on any ladder ever leaves the band", () => {
    for (const { name, hardest } of LADDERS) {
      for (const [at, chosen] of BANDS.entries()) {
        const fence = bandOn(chosen, hardest);
        const rng = createRng(at * 31 + hardest);
        // Start outside it on purpose: an old save may name such a rung, and
        // the first thing that happens must be a step back inside.
        for (const opening of [-3, 0, hardest, hardest + 5, Number.NaN]) {
          let rung = rungInBand(chosen, opening, hardest);
          let recent: readonly boolean[] = [];
          for (let cast = 0; cast < 300; cast++) {
            recent = recordCast(recent, { solved: true, clean: rng() < 0.7 });
            const moved = nextRung(chosen, rung, recent, hardest);
            if (moved !== rung) recent = [];
            rung = moved;
            expect({ name, at, opening, inside: rung >= fence.from && rung <= fence.to }).toEqual({
              name,
              at,
              opening,
              inside: true,
            });
          }
        }
      }
    }
  });

  /**
   * A band has to be worth having on every ladder.
   *
   * Bands are indexed against the addition ladder and two of the others are
   * four rungs shorter, so truncating rather than scaling puts the hardest
   * band at `[5, 5]` on both — one rung wide, nothing able to move in either
   * direction. Fencing a child into a window with no way *down* is not the
   * thing that was asked for; it is the adaptation switched off.
   */
  test("every band leaves room to move on every ladder", () => {
    for (const { name, hardest } of LADDERS) {
      for (const [at, chosen] of BANDS.entries()) {
        const fence = bandOn(chosen, hardest);
        expect({ name, at, wide: fence.to > fence.from }).toEqual({ name, at, wide: true });
        expect({ name, at, low: fence.from >= 0 }).toEqual({ name, at, low: true });
        expect({ name, at, high: fence.to <= hardest }).toEqual({ name, at, high: true });
      }
    }
  });

  /**
   * On a ladder that reaches as far as the bands do, the fence is the band.
   *
   * No rounding and no drift: those are the rungs a person picked. True of
   * the addition ladder by definition, and of the portal's — which is
   * exactly as long as the addition ladder used to be, and is the ladder
   * `SHARED_TOP_RUNG` is really describing.
   *
   * The six-digit band is the exception, and the only one. Nothing on the
   * portal's map is a six-digit measurement, so that band stands in for the
   * hardest one that the shorter ladder can express — see `bandOn`.
   */
  test("on a ladder that reaches as far as the bands, the fence is the band", () => {
    for (const chosen of BANDS) {
      expect(bandOn(chosen, HARDEST_RUNG)).toEqual(chosen);
      if (chosen.from >= SHARED_TOP_RUNG) continue;
      expect(bandOn(chosen, HARDEST_PORTAL_RUNG)).toEqual(chosen);
    }
    // The window, not the whole band: what a crop is quoted at belongs to
    // the band a person picked and travels with the child, not with the
    // ladder being scaled onto.
    const top = bandOn(bandAt(BANDS.length - 1), HARDEST_PORTAL_RUNG);
    const stood = bandOn(bandAt(DEFAULT_BAND), HARDEST_PORTAL_RUNG);
    expect({ from: top.from, to: top.to }).toEqual({ from: stood.from, to: stood.to });
    expect(top.cropPrice).toBe(bandAt(BANDS.length - 1).cropPrice);
  });

  /**
   * Scaling must not reorder anything.
   *
   * A gentler band stays gentler on every ladder, or an adult moving a child
   * down would be moving them up.
   *
   * Not *strictly* gentler at the top, and that is the six-digit band again:
   * on the clock it is the same window as the band below, because the clock
   * ladder ends at the quarter hour for everybody. Equal is the honest
   * answer there. Inverted would not be.
   */
  test("and a gentler band never becomes harsher, whichever ladder is asking", () => {
    for (const { name, hardest } of LADDERS) {
      for (let at = 1; at < BANDS.length; at++) {
        const under = bandOn(bandAt(at - 1), hardest);
        const over = bandOn(bandAt(at), hardest);
        expect({ name, at, rising: over.from >= under.from && over.to >= under.to }).toEqual({
          name,
          at,
          rising: true,
        });
      }
    }
    // And below the six-digit band it does still climb strictly, which is
    // what stops the check above being satisfied by everything collapsing
    // onto one window.
    for (const { name, hardest } of LADDERS) {
      for (let at = 1; at < DEFAULT_BAND + 1; at++) {
        const under = bandOn(bandAt(at - 1), hardest);
        const over = bandOn(bandAt(at), hardest);
        expect({ name, at, climbing: over.to > under.to }).toEqual({ name, at, climbing: true });
      }
    }
  });

  // The climb a child can still make on their own, counted. It is a number
  // worth being able to see rather than reason about: the widest band is four
  // rungs across, so a perfect run moves them that far and then stops.
  test("the climb inside the widest band is a real one, and it is finite", () => {
    const widest = BANDS.reduce((a, b) => (b.to - b.from > a.to - a.from ? b : a));
    let rung = widest.from;
    let recent: readonly boolean[] = [];
    let casts = 0;
    while (rung < widest.to && casts < 500) {
      recent = recordCast(recent, { solved: true, clean: true });
      const moved = nextRung(widest, rung, recent);
      if (moved !== rung) recent = [];
      rung = moved;
      casts++;
    }
    expect(rung).toBe(widest.to);
    expect(casts).toBeGreaterThanOrEqual(CLEAN_TO_CLIMB * (widest.to - widest.from));
    // And then it stops, however well they keep playing.
    for (let more = 0; more < 100; more++) {
      recent = recordCast(recent, { solved: true, clean: true });
      rung = nextRung(widest, rung, recent);
    }
    expect(rung).toBe(widest.to);
  });

  // A child who was already playing had the hardest sums the game had, and
  // the hardest band tops out exactly there. Fencing them in must not be a
  // way of quietly moving them down.
  test("a child at the very top of the hardest band stays there", () => {
    const hardest = bandAt(BANDS.length - 1);
    expect(nextRung(hardest, HARDEST_RUNG, clean(200))).toBe(HARDEST_RUNG);
  });

  // And a child on the band the game shipped at stops where that band stops,
  // however well they do — the six-digit rungs are above their fence, and
  // reaching them is somebody's decision rather than a run of clean casts.
  test("and one on the band the game shipped at stops at three places", () => {
    expect(nextRung(bandAt(DEFAULT_BAND), SHARED_TOP_RUNG, clean(200))).toBe(SHARED_TOP_RUNG);
  });
});

describe("which band opens the whole world", () => {
  /**
   * Reported from a playtest: *if the difficulty is lowest, enable all
   * portal destinations even if the player didn't walk there yet.*
   *
   * Every other place in this world is earned by walking to it once, which
   * is a long walk and the right price for a child who can take it. For the
   * band that opens on `3 + 4` it is a fence in front of the one spell that
   * is pure fun — and what is behind the fence is not arithmetic, it is an
   * afternoon of holding an arrow key.
   */
  test("the gentlest one, and only the gentlest one", () => {
    expect(BANDS[0]?.opensEveryPlace).toBe(true);
    for (const band of BANDS.slice(1)) expect(band.opensEveryPlace).toBe(false);
  });

  // Read through `bandAt` as the game reads it, including from off the ends:
  // a saved band from a build with more of them must not open the world by
  // accident, and one from a build with fewer must not close it.
  test("read the way the game reads it, from either end", () => {
    expect(bandAt(0).opensEveryPlace).toBe(true);
    expect(bandAt(-3).opensEveryPlace).toBe(true);
    expect(bandAt(BANDS.length + 5).opensEveryPlace).toBe(false);
  });
});
