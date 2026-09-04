// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { type Score, type ScoreNote, type ScoreVoice, loopSeconds, secondsPerTick } from "./score";

/**
 * Which notes are due to be struck in the next slice of time.
 *
 * Kept apart from the synth, and with no Web Audio in it at all, because
 * this is the half that can be wrong quietly. A note played with the wrong
 * envelope sounds wrong the first time somebody listens; a note played on
 * the wrong *turn* of the loop sounds fine for fifty-three seconds and then
 * doubles, or drops out, or drifts a beat an hour. So the arithmetic lives
 * here where a test can ask it questions, and `synth.ts` only makes sounds.
 *
 * The tune is treated as going on for ever rather than as a buffer being
 * looped: the scheduler is handed a window and answers with everything that
 * begins inside it, turn number and all. That is what lets a note's release
 * ring over the seam — the next turn's downbeat is simply the next thing in
 * the list — and it is what makes changing tune on the way out of a wood
 * possible at all.
 */

export interface DueNote {
  /** Which voice of the score it belongs to, by index. */
  readonly voice: ScoreVoice;
  readonly note: ScoreNote;
  /** Seconds since the tune started playing. */
  readonly at: number;
  /** How long it is held for, in seconds. */
  readonly held: number;
}

/**
 * Everything beginning in `[from, to)`, in seconds since the tune began.
 *
 * Half-open on purpose. The window this is called with moves along by
 * touching ends, and a note on the boundary would otherwise be scheduled
 * twice — which on a bass note is not a doubled note but a note struck
 * again while it is still sounding, and those add up rather than replacing
 * each other.
 */
export function notesDue(score: Score, from: number, to: number): DueNote[] {
  if (!(to > from)) return [];
  const loop = loopSeconds(score);
  const perTick = secondsPerTick(score);
  const due: DueNote[] = [];
  const firstTurn = Math.floor(Math.max(from, 0) / loop);
  const lastTurn = Math.floor(Math.max(to, 0) / loop);
  for (let turn = firstTurn; turn <= lastTurn; turn++) {
    const offset = turn * loop;
    for (const voice of score.voices) {
      for (const note of voice.notes) {
        const at = offset + note.tick * perTick;
        if (at < from || at >= to) continue;
        due.push({ voice, note, at, held: note.ticks * perTick });
      }
    }
  }
  return due.sort((a, b) => a.at - b.at);
}

/**
 * The frequency of a MIDI note. A minor thing to give a name to, except
 * that both sides of the repo boundary have to agree on it exactly, and
 * `440 * 2 ** ((n - 69) / 12)` written out twice is written out twice.
 */
export function frequencyOf(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}
