// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { Sounded, Struck } from "./score";

/**
 * The one-shot sounds: what the world does when something happens in it.
 *
 * Written down the way the music is — notes, envelopes, waveforms — and
 * played by the same synth, which is why the whole set is twelve kilobytes
 * of JSON rather than a folder of audio.
 *
 * **What is in here, and what is deliberately not.** Every one of these is
 * something in the world making a noise: a coin lands, a door gives, a seed
 * goes into the earth. None of them is the game telling a child how they
 * did. That is not squeamishness — it is this game's own rule, written in
 * sound. `spells/cast.ts` says there is no fail state, because a cast that
 * took nine goes still does what it was cast for, and the note on the
 * difficulty in `GameScene` says the adaptation has "no level, no badge and
 * no sound". A right-answer chime and a wrong-answer buzz would invent the
 * scoring this game has spent its design avoiding, and would do it in the
 * one channel a child cannot look away from.
 *
 * `Refuse` is the nearest thing here to a no, and it is a knock: the sound
 * of a thing not going where it was put. It says *not there*. It does not
 * say *wrong*.
 */

export const SFX_FORMAT = "mathemagicum-sfx";
export const SFX_VERSION = 1;

export const Sfx = {
  /** A coin changing hands, one per coin. */
  Coin: "coin",
  /** Something going into the ground. */
  Seed: "seed",
  /** And something coming out of it. */
  Harvest: "harvest",
  /** The addition spell landing, drawn as a plus sinking into the tile. */
  SpellAdd: "spell_add",
  /** The subtraction spell, which rises where the other sinks. */
  SpellTake: "spell_take",
  /** A door, on the way in or out. */
  Door: "door",
  /** The one long sound in the set, for the one thing that takes a moment. */
  Portal: "portal",
  /** A mechanism doing its work: two ticks, unequal. */
  Machine: "machine",
  PickUp: "pick_up",
  PutDown: "put_down",
  /** Parchment. Everything written in this game is written on it. */
  Page: "page",
  /** A knock. *Not there* — never *wrong*. */
  Refuse: "refuse",
} as const;

export type Sfx = (typeof Sfx)[keyof typeof Sfx];

export const SFX_NAMES: readonly Sfx[] = Object.values(Sfx);

/**
 * One note of an effect, in milliseconds from the start of it.
 *
 * Milliseconds rather than the music's tick grid, because an effect has no
 * tempo to be measured against: forty milliseconds is forty milliseconds
 * whether the village is playing at ninety-six or the wood at sixty.
 */
export interface Blip extends Struck {
  readonly at_ms: number;
  readonly ms: number;
  readonly midi: number;
  readonly velocity: number;
  readonly slide?: number;
}

export interface SfxVoice extends Sounded {
  readonly name: string;
  readonly notes: readonly Blip[];
}

export interface Effect {
  readonly name: string;
  /** How long it lasts, release included. */
  readonly ms: number;
  readonly voices: readonly SfxVoice[];
}

export type SfxBundle = Readonly<Record<string, Effect>>;

/** Where the generator puts the set. One file: they are wanted all at once. */
export const SFX_FILE = "assets/sfx/sfx.json";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function readBlip(value: unknown): Blip | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const { at_ms, ms, midi, velocity, slide } = record;
  if (!isFiniteNumber(at_ms) || !isFiniteNumber(ms) || ms <= 0 || at_ms < 0) return null;
  if (!isFiniteNumber(midi) || !isFiniteNumber(velocity)) return null;
  if (slide !== undefined && !isFiniteNumber(slide)) return null;
  return slide === undefined ? { at_ms, ms, midi, velocity } : { at_ms, ms, midi, velocity, slide };
}

function readVoice(value: unknown): SfxVoice | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const { name, wave, duty, gain, envelope } = record;
  if (typeof name !== "string") return null;
  if (wave !== "pulse" && wave !== "triangle" && wave !== "noise") return null;
  if (!isFiniteNumber(duty) || !isFiniteNumber(gain)) return null;
  if (typeof envelope !== "object" || envelope === null) return null;
  const shape = envelope as Record<string, unknown>;
  const { attack_ms, decay_ms, sustain, release_ms } = shape;
  if (!isFiniteNumber(attack_ms) || !isFiniteNumber(decay_ms)) return null;
  if (!isFiniteNumber(sustain) || !isFiniteNumber(release_ms)) return null;
  if (!Array.isArray(record.notes) || record.notes.length === 0) return null;
  const notes: Blip[] = [];
  for (const raw of record.notes) {
    const blip = readBlip(raw);
    if (!blip) return null;
    notes.push(blip);
  }
  return {
    name,
    wave,
    duty,
    gain,
    envelope: { attack_ms, decay_ms, sustain, release_ms },
    notes,
  };
}

/**
 * The whole set, or nothing at all.
 *
 * All-or-nothing on purpose, and it is the opposite of what a per-effect
 * read would give: a half-loaded set is a game where the coin has a sound
 * and the door does not, which reads as a bug in the door rather than as a
 * bad file. Either the sounds are the ones the generator wrote or there are
 * none, and a game with none is a game.
 */
export function readSfx(value: unknown): SfxBundle | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (record.format !== SFX_FORMAT || record.version !== SFX_VERSION) return null;
  const written = record.effects;
  if (typeof written !== "object" || written === null) return null;
  const effects = written as Record<string, unknown>;
  const bundle: Record<string, Effect> = {};
  for (const name of SFX_NAMES) {
    const one = effects[name];
    if (typeof one !== "object" || one === null) return null;
    const shape = one as Record<string, unknown>;
    if (!isFiniteNumber(shape.ms) || shape.ms <= 0) return null;
    if (!Array.isArray(shape.voices) || shape.voices.length === 0) return null;
    const voices: SfxVoice[] = [];
    for (const raw of shape.voices) {
      const voice = readVoice(raw);
      if (!voice) return null;
      voices.push(voice);
    }
    bundle[name] = { name, ms: shape.ms, voices };
  }
  return bundle;
}
