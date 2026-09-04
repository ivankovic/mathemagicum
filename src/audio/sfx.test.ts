// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SFX_FILE, SFX_NAMES, Sfx, readSfx } from "./sfx";

const COMMITTED = JSON.parse(readFileSync(join("public", SFX_FILE), "utf8"));

function spoiled(change: Record<string, unknown>): unknown {
  return { ...COMMITTED, ...change };
}

describe("the sounds the generator committed", () => {
  /**
   * The cross-repo check, and the reason this reads from `public/` rather
   * than from a fixture written by hand.
   *
   * The effects are made by a program in another repository, and nothing
   * here can stop that program changing. What it can do is fail the moment
   * what it wrote stops being something this one understands — a build that
   * goes red rather than a world that is quietly silent.
   */
  test("read, all of them", () => {
    const bundle = readSfx(COMMITTED);
    expect(bundle).not.toBeNull();
    expect(Object.keys(bundle ?? {}).sort()).toEqual([...SFX_NAMES].sort());
  });

  test("and every one of them has something to play", () => {
    const bundle = readSfx(COMMITTED);
    for (const name of SFX_NAMES) {
      const effect = bundle?.[name];
      expect({ name, has: (effect?.voices.length ?? 0) > 0 }).toEqual({ name, has: true });
      for (const voice of effect?.voices ?? []) {
        expect({ name, notes: voice.notes.length > 0 }).toEqual({ name, notes: true });
      }
    }
  });

  /**
   * Nothing outstays the gesture that caused it.
   *
   * These play over the music and over each other, and a child taps quickly.
   * An effect longer than the action it belongs to stops being feedback and
   * becomes a queue — four taps in a second, and the fourth sound arrives
   * after the child has moved on to something else.
   */
  test("nothing lasts longer than the moment it belongs to", () => {
    const bundle = readSfx(COMMITTED);
    for (const name of SFX_NAMES) {
      expect({ name, ms: (bundle?.[name]?.ms ?? 0) <= 900 }).toEqual({ name, ms: true });
    }
  });

  test("the whole set is small enough to fetch in one go", () => {
    // It is fetched at the first touch of the page so the first coin a child
    // earns is not the silent one, which is only reasonable while it stays
    // this size.
    expect(JSON.stringify(COMMITTED).length).toBeLessThan(32_000);
  });
});

describe("what the game will not play", () => {
  /**
   * The one test here that is about the game rather than about the audio.
   *
   * `spells/cast.ts` says there is no fail state: a cast that took nine goes
   * still does what it was cast for. The note on the difficulty in
   * `GameScene` says the adaptation has "no level, no badge and no sound". A
   * right-answer chime and a wrong-answer buzz would invent the scoring this
   * game has spent its design avoiding, in the one channel a child cannot
   * look away from — so the absence is asserted rather than left to be
   * noticed by whoever adds the thirteenth sound.
   *
   * `Refuse` is here and is allowed to be: it is a knock, the sound of a
   * thing not going where it was put. It says *not there*, not *wrong*.
   */
  test("there is no sound in this game for a child being wrong", () => {
    const forbidden = ["correct", "wrong", "right", "fail", "success", "error", "win", "lose"];
    for (const name of SFX_NAMES) {
      expect({ name, judges: forbidden.some((word) => name.includes(word)) }).toEqual({
        name,
        judges: false,
      });
    }
    const knock = readSfx(COMMITTED)?.[Sfx.Refuse];
    // Low and falling. A refusal that swept upward would be a raspberry
    // however it was named in the table.
    for (const voice of knock?.voices ?? []) {
      for (const blip of voice.notes) {
        expect(blip.slide ?? 0).toBeLessThanOrEqual(0);
        expect(blip.midi).toBeLessThan(60);
      }
    }
  });
});

describe("reading the set", () => {
  test("a file from a format this game does not speak is refused", () => {
    expect(readSfx(spoiled({ format: "something-else" }))).toBeNull();
    expect(readSfx(spoiled({ version: 2 }))).toBeNull();
  });

  test("so is nothing at all", () => {
    for (const rubbish of [null, undefined, 7, "sfx", [], {}]) {
      expect(readSfx(rubbish)).toBeNull();
    }
  });

  /**
   * All or nothing, which is the opposite of what reading each effect on its
   * own would give.
   *
   * A half-loaded set is a game where the coin has a sound and the door does
   * not, and that reads as a bug in the door rather than as a bad file.
   */
  test("one missing effect costs the whole set, not just itself", () => {
    const effects = { ...(COMMITTED.effects as Record<string, unknown>) };
    delete effects[Sfx.Door];
    expect(readSfx(spoiled({ effects }))).toBeNull();
  });

  test("and so does one malformed note", () => {
    const effects = structuredClone(COMMITTED.effects) as Record<
      string,
      { voices: { notes: Record<string, unknown>[] }[] }
    >;
    const note = effects[Sfx.Coin]?.voices[0]?.notes[0];
    if (!note) throw new Error("the coin has no notes to spoil");
    note.ms = -1;
    expect(readSfx(spoiled({ effects }))).toBeNull();
  });

  test("an instrument the synth has not got is refused", () => {
    const effects = structuredClone(COMMITTED.effects) as Record<
      string,
      { voices: { wave: string }[] }
    >;
    const voice = effects[Sfx.Coin]?.voices[0];
    if (!voice) throw new Error("the coin has no voices to spoil");
    voice.wave = "sawtooth";
    expect(readSfx(spoiled({ effects }))).toBeNull();
  });
});
