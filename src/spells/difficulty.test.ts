// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { createRng } from "../world/rng";
import { makeAdditionProblem, problemFor } from "./addition";
import {
  BANDS,
  CLEAN_TO_CLIMB,
  CLEAN_TO_LEAVE_BAND,
  DEFAULT_BAND,
  HARDEST_RUNG,
  RECENT_CASTS,
  RUNGS,
  STUMBLES_TO_EASE,
  SUGGESTED_BAND,
  bandAt,
  nextRung,
  recordCast,
  rungAt,
  rungInBand,
  sampleProblem,
} from "./difficulty";

describe("the ladder", () => {
  test("every rung asks for at least one jump the child has to make", () => {
    for (const [index, rung] of RUNGS.entries()) {
      expect({ index, ok: rung.given < rung.places }).toEqual({ index, ok: true });
      expect({ index, ok: rung.places >= 1 && rung.places <= 3 }).toEqual({ index, ok: true });
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
  test("the top of the ladder is the game as it shipped", () => {
    expect(rungAt(HARDEST_RUNG)).toEqual({ places: 3, crossing: true, given: 0 });
    expect(bandAt(DEFAULT_BAND).to).toBe(HARDEST_RUNG);
  });

  test("a rung index from anywhere is clamped rather than trusted", () => {
    expect(rungAt(-5)).toEqual(RUNGS[0] as never);
    expect(rungAt(999)).toEqual(RUNGS[HARDEST_RUNG] as never);
    expect(rungAt(2.7)).toEqual(RUNGS[2] as never);
  });
});

describe("the three bands", () => {
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
    // The band the game shipped at keeps the price the game shipped with.
    expect(bandAt(DEFAULT_BAND).cropPrice).toBe(250);
  });

  /**
   * Three, and a crop is worth more the harder the sums are.
   *
   * The count is what a playtest asked for: four rows of sums is a row too
   * many to compare at a glance. The order is the part that was not asked
   * for and is worth keeping true — the prices used to dip in the middle
   * (1,00 → 0,50 → …), so the second-easiest band paid least of all, which
   * is a rule nobody could learn and everybody would notice.
   */
  test("there are three of them, and a crop is worth more the harder it gets", () => {
    expect(BANDS.length).toBe(3);
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

  test("it never leaves the ladder, however the casts go", () => {
    let rung = band.from;
    for (let cast = 0; cast < 400; cast++) {
      rung = nextRung(band, rung, clean(RECENT_CASTS));
      expect(rung).toBeLessThanOrEqual(HARDEST_RUNG);
    }
    expect(rung).toBe(HARDEST_RUNG);
    for (let cast = 0; cast < 400; cast++) {
      rung = nextRung(band, rung, Array(RECENT_CASTS).fill(false));
      expect(rung).toBeGreaterThanOrEqual(0);
    }
    expect(rung).toBe(0);
  });

  // The rule that could never fire. The window was six casts and leaving a
  // band needed a run of eight, so no child could ever have left one — the
  // condition was simply unreachable, and nothing said so.
  test("the window can hold the longest run any rule asks about", () => {
    expect(RECENT_CASTS).toBeGreaterThanOrEqual(CLEAN_TO_LEAVE_BAND);
    expect(RECENT_CASTS).toBeGreaterThanOrEqual(CLEAN_TO_CLIMB);
    expect(RECENT_CASTS).toBeGreaterThanOrEqual(STUMBLES_TO_EASE);
    let recent: readonly boolean[] = [];
    for (let at = 0; at < CLEAN_TO_LEAVE_BAND; at++) {
      recent = recordCast(recent, { solved: true, clean: true });
    }
    expect(recent.length).toBe(CLEAN_TO_LEAVE_BAND);
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

  // The band decides where a child *starts* and what the money looks like.
  // It no longer decides where they may be, so reading a save must not drag
  // a child the game has carried onward back into the box they began in.
  test("a saved rung is clamped to the ladder, not to the band", () => {
    expect(rungInBand(band, 0)).toBe(0);
    expect(rungInBand(band, HARDEST_RUNG)).toBe(HARDEST_RUNG);
    expect(rungInBand(band, 99)).toBe(HARDEST_RUNG);
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
    expect(bandAt(DEFAULT_BAND).to).toBe(HARDEST_RUNG);
    expect(rungInBand(bandAt(DEFAULT_BAND), HARDEST_RUNG)).toBe(HARDEST_RUNG);
  });
});

describe("leaving the band you started in", () => {
  const band = bandAt(0);
  const clean = (count: number) => Array.from({ length: count }, () => true);

  // Playtesting said the adaptation looked broken: a child tops out in a
  // dozen casts and then nothing ever changes again, which from the outside
  // is indistinguishable from a fixed difficulty.
  test("a child who keeps playing well goes past what was picked for them", () => {
    expect(nextRung(band, band.to, clean(CLEAN_TO_LEAVE_BAND))).toBe(band.to + 1);
  });

  // What is left of the fence. A good afternoon should move a child along; it
  // should not move them up a year before an adult notices.
  test("but it takes a longer run than moving inside the band", () => {
    expect(CLEAN_TO_LEAVE_BAND).toBeGreaterThan(CLEAN_TO_CLIMB);
    expect(nextRung(band, band.to, clean(CLEAN_TO_CLIMB))).toBe(band.to);
    expect(nextRung(band, band.from, clean(CLEAN_TO_CLIMB))).toBe(band.from + 1);
  });

  // A child carried up by a lucky run has to be able to fall back, and a
  // boundary is no reason to make them prove it for longer.
  test("coming back down needs no extra patience, boundary or not", () => {
    const stumbles = Array(STUMBLES_TO_EASE).fill(false);
    expect(nextRung(band, band.to + 1, stumbles)).toBe(band.to);
    expect(nextRung(band, band.to, stumbles)).toBe(band.to - 1);
    const higher = bandAt(2);
    expect(nextRung(higher, higher.from, stumbles)).toBe(higher.from - 1);
  });

  test("and down is still quicker than up, everywhere", () => {
    expect(STUMBLES_TO_EASE).toBeLessThan(CLEAN_TO_CLIMB);
    expect(STUMBLES_TO_EASE).toBeLessThan(CLEAN_TO_LEAVE_BAND);
  });

  // The long way up, counted: a child starting at the gentlest sums and
  // never making a mistake still takes this many casts to reach the hardest.
  // It is a number worth being able to see rather than reason about.
  test("the whole ladder is a long climb, not an afternoon", () => {
    let rung = bandAt(0).from;
    let recent: readonly boolean[] = [];
    let casts = 0;
    while (rung < HARDEST_RUNG && casts < 500) {
      recent = recordCast(recent, { solved: true, clean: true });
      const moved = nextRung(bandAt(0), rung, recent);
      if (moved !== rung) recent = [];
      rung = moved;
      casts++;
    }
    expect(rung).toBe(HARDEST_RUNG);
    expect(casts).toBeGreaterThan(CLEAN_TO_LEAVE_BAND * 4);
  });

  test("a child at the very top stays there rather than falling off it", () => {
    expect(nextRung(bandAt(DEFAULT_BAND), HARDEST_RUNG, clean(CLEAN_TO_LEAVE_BAND))).toBe(
      HARDEST_RUNG,
    );
  });
});
