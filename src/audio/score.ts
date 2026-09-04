// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { HOME_PLACE, PLACE_NAMES, type PlaceName } from "../world/places";

/**
 * The music, as the asset generator writes it down: notes, not sound.
 *
 * This is the one asset class the generator does not hand over finished. It
 * ships a *score* — tempo, mode, and every note's place on a tick grid, per
 * voice — and `synth.ts` plays it here. The argument is size and it is not
 * close: a minute of rendered stereo is most of a megabyte and there are ten
 * tunes, where the same minute written down is seventeen kilobytes. This
 * game is an offline PWA that precaches everything it owns, so there is no
 * "stream the rest of it" to fall back on.
 *
 * Field names are snake_case because they are the generator's, the same rule
 * every sprite sidecar follows — see `world/spriteSidecar.ts`.
 *
 * **Everything the synth needs is in here.** Waveform, duty, envelope, gain,
 * tempo. That is deliberate: the generator renders these to a WAV as well,
 * so a person can hear a tune before committing it, and the two only agree
 * because neither is allowed a musical decision of its own. A filter sweep
 * added on this side would make the audition a preview of something else.
 */

export const SCORE_FORMAT = "mathemagicum-score";
export const SCORE_VERSION = 1;

/** The three channels a NES had, which is the sound this game's pictures are drawn in. */
export type Waveform = "pulse" | "triangle" | "noise";

const WAVEFORMS: readonly Waveform[] = ["pulse", "triangle", "noise"];

export interface ScoreEnvelope {
  attack_ms: number;
  decay_ms: number;
  sustain: number;
  release_ms: number;
}

/**
 * One note, on the grid rather than in seconds.
 *
 * `midi` on a noise voice is not a pitch: it is the middle of the band the
 * hiss is filtered to, which is the difference between a leaf and a rope.
 */
export interface ScoreNote {
  tick: number;
  ticks: number;
  midi: number;
  velocity: number;
  /**
   * Semitones the pitch travels over the note.
   *
   * Absent from every note of every tune, and it is not here for the tunes:
   * a melody made of notes that slide is a melody played on a trombone. It
   * is here because the sound effects are written in this same vocabulary
   * and a coin is a rise where a door is a fall — a sweep is most of what
   * makes a short noise read as a thing happening rather than as a beep.
   */
  slide?: number;
}

/**
 * The least a thing has to be for the synth to strike it.
 *
 * A tune's note satisfies this and so does a sound effect's, which is the
 * point: `synth.ts` knows how to make one sound and does not know whether it
 * is making music. Where the note sits in *time* is the caller's business —
 * a tune's is on a tick grid and an effect's is in milliseconds from a tap,
 * and neither is any of the oscillator's concern.
 */
export interface Struck {
  readonly midi: number;
  readonly velocity: number;
  readonly slide?: number;
}

/**
 * The least a voice has to be for the synth to play one of its notes.
 *
 * A tune's voice is this and so is a sound effect's, which is the point:
 * `synth.ts` knows how to make one channel sound and does not know whether
 * it is making music. What differs between the two is only *when* the notes
 * happen — a tune's are on a tick grid, an effect's in milliseconds from a
 * tap — and that is the caller's business, not the oscillator's.
 */
export interface Sounded {
  readonly wave: Waveform;
  /** How wide a pulse's high half is. Ignored by everything else. */
  readonly duty: number;
  readonly gain: number;
  readonly envelope: ScoreEnvelope;
}

export interface ScoreVoice extends Sounded {
  readonly name: string;
  readonly notes: readonly ScoreNote[];
}

export interface Score {
  format: string;
  version: number;
  place: string;
  variant: string;
  seed: number;
  bpm: number;
  beats_per_bar: number;
  bars: number;
  ticks_per_beat: number;
  loop_seconds: number;
  key: string;
  mode: string;
  voices: readonly ScoreVoice[];
}

/** Day or night; a place after dark is the same place, slower and emptier. */
export const Variant = {
  Day: "day",
  Night: "night",
} as const;

export type Variant = (typeof Variant)[keyof typeof Variant];

/** Which tune is wanted: a place, at a time of day. */
export interface TuneKey {
  readonly place: PlaceName;
  readonly variant: Variant;
}

/**
 * The generator's file stems, which are not the game's names for the places.
 *
 * Written out rather than derived by inserting underscores before capitals.
 * The rule would work today and it is a rule about *spelling*, which is not
 * a thing either side promised the other — a sixth place named in one word
 * would break it silently, and the compiler cannot see inside a string it
 * built itself. This table it can see: leave a place out and it fails here.
 */
const FILE_STEM: Record<PlaceName, string> = {
  village: "village",
  harbour: "harbour",
  bigCity: "big_city",
  observatory: "observatory",
  enchantedForest: "enchanted_forest",
};

/**
 * Every tune there is: five places, day and night.
 *
 * Derived from `PLACE_NAMES` rather than listed, so a sixth place is a
 * missing *file* — which the loader says out loud — rather than a place
 * that silently has no music because somebody edited one list and not the
 * other.
 */
export const MUSIC_TUNES: readonly TuneKey[] = PLACE_NAMES.flatMap((place) => [
  { place, variant: Variant.Day },
  { place, variant: Variant.Night },
]);

export function scoreFile(tune: TuneKey): string {
  return `${FILE_STEM[tune.place]}_${tune.variant}`;
}

/** Phaser's cache key for one tune. */
export function scoreKey(tune: TuneKey): string {
  return `music-${scoreFile(tune)}`;
}

export function sameTune(a: TuneKey | null, b: TuneKey | null): boolean {
  return a?.place === b?.place && a?.variant === b?.variant;
}

/**
 * Which tune belongs where the player is standing.
 *
 * The wilderness between two named places keeps whatever was playing, which
 * is not laziness: a child crosses a lot of ground that is not anywhere in
 * particular, and music that stopped every time they left the village and
 * started again when they arrived somewhere would be a game that fades in
 * and out for the entire walk. The hour still applies out there — walk far
 * enough and the sun sets on you, and the tune should know.
 *
 * Indoors is the same place as outdoors, on the same argument. A cottage in
 * the village is in the village.
 */
export function tuneFor(
  place: PlaceName | null,
  daylight: boolean,
  playing: TuneKey | null,
): TuneKey {
  return {
    place: place ?? playing?.place ?? HOME_PLACE,
    variant: daylight ? Variant.Day : Variant.Night,
  };
}

/** How long one tick lasts, which is the only conversion the synth needs. */
export function secondsPerTick(score: Score): number {
  return 60 / score.bpm / score.ticks_per_beat;
}

/** The whole loop, in ticks. */
export function scoreTicks(score: Score): number {
  return score.bars * score.beats_per_bar * score.ticks_per_beat;
}

/**
 * How long one turn of the loop lasts.
 *
 * Worked out from the bars rather than read off `loop_seconds`, which the
 * generator rounds to four decimal places on the way out. A tenth of a
 * millisecond is nothing to a listener and it is not nothing to a scheduler
 * that adds it to itself once a minute for an hour — the tune would end up
 * a beat adrift of the turn it thinks it is on. The written field is kept
 * anyway and checked against this one when the file is read, because two
 * numbers that should agree are worth having when one of them is wrong.
 */
export function loopSeconds(score: Score): number {
  return scoreTicks(score) * secondsPerTick(score);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function readEnvelope(value: unknown): ScoreEnvelope | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const { attack_ms, decay_ms, sustain, release_ms } = record;
  if (!isFiniteNumber(attack_ms) || !isFiniteNumber(decay_ms)) return null;
  if (!isFiniteNumber(sustain) || !isFiniteNumber(release_ms)) return null;
  return { attack_ms, decay_ms, sustain, release_ms };
}

function readNote(value: unknown, ticks: number): ScoreNote | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const { tick, midi, velocity } = record;
  const held = record.ticks;
  if (!isFiniteNumber(tick) || !isFiniteNumber(held)) return null;
  if (!isFiniteNumber(midi) || !isFiniteNumber(velocity)) return null;
  const slide = record.slide;
  if (slide !== undefined && !isFiniteNumber(slide)) return null;
  // A note that outlives the loop is the one malformation with teeth: the
  // scheduler lays the next turn down from the top while this one is still
  // sounding, so the same note is struck twice and hangs. Refused here
  // rather than clamped, because a tune whose arithmetic does not add up is
  // not a tune that was rendered by the generator.
  if (tick < 0 || held <= 0 || tick + held > ticks) return null;
  return slide === undefined
    ? { tick, ticks: held, midi, velocity }
    : { tick, ticks: held, midi, velocity, slide };
}

function readVoice(value: unknown, ticks: number): ScoreVoice | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const { name, wave, duty, gain } = record;
  if (typeof name !== "string") return null;
  if (!WAVEFORMS.includes(wave as Waveform)) return null;
  if (!isFiniteNumber(duty) || !isFiniteNumber(gain)) return null;
  const envelope = readEnvelope(record.envelope);
  if (!envelope || !Array.isArray(record.notes)) return null;
  const notes: ScoreNote[] = [];
  for (const raw of record.notes) {
    const note = readNote(raw, ticks);
    if (!note) return null;
    notes.push(note);
  }
  return { name, wave: wave as Waveform, duty, gain, envelope, notes };
}

/**
 * A score, or nothing at all.
 *
 * Nothing at all is a real answer here and it is why this is so strict: the
 * worst thing music can do to this game is be the reason it does not start.
 * A file that is the wrong shape, the wrong version, or half-written costs
 * silence — which nobody has ever filed a bug about — where a half-read
 * score costs a note that hangs on one pitch until the tablet is closed.
 *
 * Whole-score rather than per-field, unlike `readSettings`. A setting that
 * no longer makes sense has a sensible default to fall back to; there is no
 * default for the fourth voice of a tune.
 */
export function readScore(value: unknown): Score | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (record.format !== SCORE_FORMAT || record.version !== SCORE_VERSION) return null;
  const { bpm, beats_per_bar, bars, ticks_per_beat, loop_seconds, seed } = record;
  if (!isFiniteNumber(bpm) || bpm <= 0) return null;
  if (!isFiniteNumber(beats_per_bar) || beats_per_bar <= 0) return null;
  if (!isFiniteNumber(bars) || bars <= 0) return null;
  if (!isFiniteNumber(ticks_per_beat) || ticks_per_beat <= 0) return null;
  if (!isFiniteNumber(loop_seconds) || loop_seconds <= 0) return null;
  if (!isFiniteNumber(seed)) return null;
  if (typeof record.place !== "string" || typeof record.variant !== "string") return null;
  if (typeof record.key !== "string" || typeof record.mode !== "string") return null;
  if (!Array.isArray(record.voices) || record.voices.length === 0) return null;
  const ticks = bars * beats_per_bar * ticks_per_beat;
  const voices: ScoreVoice[] = [];
  for (const raw of record.voices) {
    const voice = readVoice(raw, ticks);
    if (!voice) return null;
    voices.push(voice);
  }
  // The generator's own answer for the loop length, against the one worked
  // out from the bars. They can only disagree if the two sides have drifted
  // apart on what a bar is, which is exactly the kind of cross-repo break
  // that otherwise shows up as a tune going slowly out of step with itself.
  const turn = (bars * beats_per_bar * 60) / bpm;
  if (Math.abs(loop_seconds - turn) > 0.001) return null;
  return {
    format: SCORE_FORMAT,
    version: SCORE_VERSION,
    place: record.place,
    variant: record.variant,
    seed,
    bpm,
    beats_per_bar,
    bars,
    ticks_per_beat,
    loop_seconds,
    key: record.key,
    mode: record.mode,
    voices,
  };
}
