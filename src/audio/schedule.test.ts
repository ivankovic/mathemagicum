// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { frequencyOf, notesDue } from "./schedule";
import { type Score, loopSeconds, readScore, secondsPerTick } from "./score";

const GROVE = readScore(
  JSON.parse(readFileSync(join("public", "assets", "music", "enchanted_forest_day.json"), "utf8")),
) as Score;

const LOOP = loopSeconds(GROVE);

function struck(from: number, to: number): string[] {
  return notesDue(GROVE, from, to).map((due) => `${due.at.toFixed(6)}@${due.note.midi}`);
}

describe("what is due to be played", () => {
  test("everything in the first turn is somewhere in the first turn", () => {
    const due = notesDue(GROVE, 0, LOOP);
    const notes = GROVE.voices.reduce((count, voice) => count + voice.notes.length, 0);
    expect(due).toHaveLength(notes);
    for (const one of due) expect(one.at).toBeGreaterThanOrEqual(0);
    for (const one of due) expect(one.at).toBeLessThan(LOOP);
  });

  test("and comes back in the order it is played", () => {
    const due = notesDue(GROVE, 0, LOOP);
    for (let i = 1; i < due.length; i++) {
      expect(due[i]?.at).toBeGreaterThanOrEqual(due[i - 1]?.at ?? 0);
    }
  });

  test("a note is held for as long as its own ticks say", () => {
    const perTick = secondsPerTick(GROVE);
    for (const due of notesDue(GROVE, 0, LOOP)) {
      expect(due.held).toBeCloseTo(due.note.ticks * perTick, 9);
    }
  });

  /**
   * The window is half-open, and everything depends on it.
   *
   * The scheduler is called over and over with windows that touch: what one
   * ends at, the next begins at. A note on that boundary belonging to both
   * is not a note played twice — it is a second note struck underneath the
   * first while it is still sounding, and two of those add up rather than
   * replacing each other. On the bass, which holds for two beats at a time,
   * it is audible as the tune getting steadily louder.
   */
  test("a note on the seam between two windows is played by exactly one of them", () => {
    const first = notesDue(GROVE, 0, LOOP);
    // A moment that is exactly a note's own start, which is the only place
    // the question can be asked.
    const boundary = first[10]?.at ?? 0;
    const before = struck(0, boundary);
    const after = struck(boundary, LOOP);
    expect(before.length + after.length).toBe(first.length);
    expect(before.some((one) => one.startsWith(boundary.toFixed(6)))).toBe(false);
    expect(after.some((one) => one.startsWith(boundary.toFixed(6)))).toBe(true);
  });

  test("tiling the whole tune with windows plays every note once", () => {
    const step = 0.37; // deliberately not a whole number of beats
    const played: string[] = [];
    // The windows are compared against exactly the span they cover, ending
    // where the last one ends rather than at two turns: a tiling that runs
    // three notes past the mark it is measured against is a failing test
    // with nothing wrong underneath it.
    let at = 0;
    while (at < LOOP * 2) {
      played.push(...struck(at, at + step));
      at += step;
    }
    expect(played).toHaveLength(notesDue(GROVE, 0, at).length);
    expect(new Set(played).size).toBe(played.length);
  });

  /**
   * The loop is not a buffer being restarted, it is a tune that goes on.
   *
   * That is what lets a note's release ring over the seam — the next turn's
   * downbeat is simply the next thing in the list — and it is why a window
   * that straddles the join has to answer with the tail of one turn and the
   * head of the next, rather than with the tail and then nothing.
   */
  test("a window across the join gets the end of one turn and the start of the next", () => {
    const due = notesDue(GROVE, LOOP - 1, LOOP + 1);
    expect(due.some((one) => one.at < LOOP)).toBe(true);
    expect(due.some((one) => one.at >= LOOP)).toBe(true);
  });

  test("the second turn is the first turn, one loop later", () => {
    const first = notesDue(GROVE, 0, LOOP);
    const second = notesDue(GROVE, LOOP, LOOP * 2);
    expect(second).toHaveLength(first.length);
    for (const [index, one] of second.entries()) {
      expect(one.at).toBeCloseTo((first[index]?.at ?? 0) + LOOP, 6);
      expect(one.note.midi).toBe(first[index]?.note.midi ?? -1);
    }
  });

  test("a window that goes backwards asks for nothing", () => {
    expect(notesDue(GROVE, 5, 5)).toEqual([]);
    expect(notesDue(GROVE, 5, 4)).toEqual([]);
  });
});

describe("pitch", () => {
  test("concert A is where everyone else keeps it", () => {
    expect(frequencyOf(69)).toBeCloseTo(440, 9);
    expect(frequencyOf(81)).toBeCloseTo(880, 9);
    expect(frequencyOf(57)).toBeCloseTo(220, 9);
  });
});
