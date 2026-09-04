// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HOME_PLACE, PLACE_NAMES } from "../world/places";
import {
  MUSIC_TUNES,
  SCORE_FORMAT,
  type Score,
  Variant,
  loopSeconds,
  readScore,
  sameTune,
  scoreFile,
  scoreKey,
  secondsPerTick,
  tuneFor,
} from "./score";

const MUSIC_DIR = join("public", "assets", "music");

function committed(stem: string): unknown {
  return JSON.parse(readFileSync(join(MUSIC_DIR, `${stem}.json`), "utf8"));
}

const GROVE = readScore(committed("enchanted_forest_day")) as Score;

/**
 * A score, minus one field, as an object a test can spoil.
 *
 * Built from a real one rather than typed out: a handwritten score would go
 * on parsing long after the generator had stopped writing that shape, which
 * is the one thing these tests exist to notice.
 */
function spoiled(change: Record<string, unknown>): unknown {
  return { ...(committed("enchanted_forest_day") as object), ...change };
}

describe("the scores the generator committed", () => {
  /**
   * The cross-repo check, and the reason this file reads from `public/`
   * rather than from a handwritten fixture.
   *
   * The music is written by a program in another repository. Nothing here
   * can stop that program changing; what it can do is fail the moment what
   * it wrote stops being something this one understands — which is a build
   * that goes red, rather than five places that are quietly silent.
   */
  test.each(MUSIC_TUNES.map((tune) => scoreFile(tune)))("%s reads", (stem) => {
    const score = readScore(committed(stem));
    expect(score).not.toBeNull();
    expect(score?.format).toBe(SCORE_FORMAT);
    expect(score?.voices.length).toBeGreaterThan(0);
  });

  test("there is one for every place, morning and night", () => {
    expect(MUSIC_TUNES).toHaveLength(PLACE_NAMES.length * 2);
    for (const place of PLACE_NAMES) {
      expect(MUSIC_TUNES.some((tune) => tune.place === place && tune.variant === Variant.Day));
      expect(MUSIC_TUNES.some((tune) => tune.place === place && tune.variant === Variant.Night));
    }
  });

  test("and the file names do not collide with each other", () => {
    expect(new Set(MUSIC_TUNES.map(scoreFile)).size).toBe(MUSIC_TUNES.length);
    expect(new Set(MUSIC_TUNES.map(scoreKey)).size).toBe(MUSIC_TUNES.length);
  });

  test("nothing is still sounding when the loop comes round", () => {
    for (const tune of MUSIC_TUNES) {
      const score = readScore(committed(scoreFile(tune))) as Score;
      const ticks = score.bars * score.beats_per_bar * score.ticks_per_beat;
      for (const voice of score.voices) {
        for (const note of voice.notes) expect(note.tick + note.ticks).toBeLessThanOrEqual(ticks);
      }
    }
  });

  test("the loop is as long as its own bars say", () => {
    expect(loopSeconds(GROVE)).toBeCloseTo(GROVE.loop_seconds, 3);
    expect(secondsPerTick(GROVE)).toBeCloseTo(60 / GROVE.bpm / GROVE.ticks_per_beat, 9);
  });
});

describe("reading one", () => {
  test("a file from a format this game does not speak is refused", () => {
    expect(readScore(spoiled({ format: "something-else" }))).toBeNull();
    expect(readScore(spoiled({ version: 2 }))).toBeNull();
  });

  test("so is nothing at all", () => {
    for (const rubbish of [null, undefined, 7, "score", [], {}]) {
      expect(readScore(rubbish)).toBeNull();
    }
  });

  /**
   * The one malformation with teeth.
   *
   * A note that outlives its own loop is not a wrong note, it is a note
   * struck a second time while the first is still sounding — the scheduler
   * lays the next turn down from the top and has no way to know. Refused on
   * the way in rather than clamped: a tune whose arithmetic does not add up
   * was not written by the generator, and guessing at what it meant is how
   * a hanging bass note gets into a game about arithmetic.
   */
  test("a note that runs past the end of the loop is refused", () => {
    const score = committed("enchanted_forest_day") as Score;
    const ticks = score.bars * score.beats_per_bar * score.ticks_per_beat;
    const voices = score.voices.map((voice, index) =>
      index === 0
        ? { ...voice, notes: [{ tick: ticks - 1, ticks: 8, midi: 72, velocity: 1 }] }
        : voice,
    );
    expect(readScore({ ...score, voices })).toBeNull();
  });

  /**
   * Two numbers that should agree, checked against each other.
   *
   * `loop_seconds` is the generator's own answer and the bars are the game's
   * way of working it out. They can only differ if the two repositories have
   * drifted apart about what a bar is — which otherwise shows up as a tune
   * that goes gradually out of step with itself over an hour of play, and
   * as nothing at all before that.
   */
  test("a loop length that disagrees with the bars is refused", () => {
    expect(readScore(spoiled({ loop_seconds: 53.5 }))).toBeNull();
    expect(readScore(spoiled({ bpm: 71 }))).toBeNull();
  });

  test("a voice on an instrument the synth has not got is refused", () => {
    const score = committed("enchanted_forest_day") as Score;
    const voices = score.voices.map((voice, index) =>
      index === 0 ? { ...voice, wave: "sawtooth" } : voice,
    );
    expect(readScore({ ...score, voices })).toBeNull();
  });
});

describe("which tune belongs where", () => {
  const grove = { place: "enchantedForest", variant: Variant.Day } as const;

  test("a named place gets its own, at the hour it is", () => {
    expect(tuneFor("enchantedForest", true, null)).toEqual(grove);
    expect(tuneFor("enchantedForest", false, null)).toEqual({
      place: "enchantedForest",
      variant: Variant.Night,
    });
  });

  /**
   * The ground between two places keeps whatever was playing.
   *
   * A child crosses a great deal of country that is not anywhere in
   * particular. Music that stopped on the way out of the village and started
   * again on arrival at the wood would be a game that fades in and out for
   * the whole of the walk between them.
   */
  test("the wilderness keeps what was already playing", () => {
    expect(tuneFor(null, true, grove)).toEqual(grove);
  });

  test("but the sun still sets on it", () => {
    expect(tuneFor(null, false, grove)).toEqual({
      place: "enchantedForest",
      variant: Variant.Night,
    });
  });

  test("and before anything has played, it is home", () => {
    expect(tuneFor(null, true, null).place).toBe(HOME_PLACE);
  });

  test("two tunes are the same tune only if both halves agree", () => {
    expect(sameTune(grove, { ...grove })).toBe(true);
    expect(sameTune(grove, { ...grove, variant: Variant.Night })).toBe(false);
    expect(sameTune(grove, { ...grove, place: "village" })).toBe(false);
    expect(sameTune(null, null)).toBe(true);
    expect(sameTune(grove, null)).toBe(false);
  });
});
