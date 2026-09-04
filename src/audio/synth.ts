// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { createRng } from "../world/rng";
import { frequencyOf } from "./schedule";
import type { Sounded, Struck } from "./score";

/**
 * The four channels a NES had, built out of Web Audio nodes.
 *
 * Two pulses, a triangle, and noise through a bandpass — and nothing else,
 * on purpose. The generator renders the same scores to a WAV so a person can
 * hear a tune before it is committed, and that audition is only worth
 * something while both synths are dumb interpreters of the same numbers. A
 * reverb added here would sound lovely and would quietly make the preview a
 * preview of a different game.
 *
 * So there is no taste in this file. Every number it uses comes out of the
 * score: waveform, duty, envelope, gain, velocity.
 */

/**
 * How loud the music is when it is on.
 *
 * The mix leaves the generator peaking at about three quarters of full
 * scale, so this is not headroom — it is that background music sits *behind*
 * a game, and a tune mixed to the level of the thing it is under is a tune
 * that gets switched off.
 *
 * A half was the first guess and a playtest called it slightly too loud, so
 * it came down about two and a half decibels. Not further: the complaint was
 * *slightly*, and a tune nobody can hear has the same effect on a child as
 * no tune, without the honesty of admitting it.
 *
 * **The music only.** The one-shot effects do not pass through this — they
 * are struck straight at the destination — which is why turning the tune
 * down here does not also take the coins with it. That is the right shape
 * for the two: the music is a bed and the effects are the game answering a
 * child, and the second should sit on top of the first rather than beside
 * it. It is also why this is not called a master gain: it is not one.
 */
export const MUSIC_GAIN = 0.38;

/**
 * Harmonics per waveform.
 *
 * The same ceiling the generator's renderer uses, so the two agree about
 * how bright a note is. Web Audio band-limits a `PeriodicWave` to whatever
 * the note's own frequency allows, so asking for more than this costs
 * nothing and buys nothing: a triangle's harmonics fall away as one over n
 * squared and the hundred-and-twenty-eighth is a hundred-thousandth of the
 * note.
 */
const HARMONICS = 128;

/** Seconds of white noise, looped. Long enough not to hear it come round. */
const NOISE_SECONDS = 2;

/**
 * How sharply the noise is filtered. `Q = 1` is a wide band that still has
 * an obvious pitch to it — narrower and a leaf starts to whistle, wider and
 * it is the sound of a radio between stations.
 */
const NOISE_Q = 1;

export class ChiptuneSynth {
  /** One wave per duty, and there are two. Built once, played thousands of times. */
  private readonly waves = new Map<string, PeriodicWave>();
  private noise: AudioBuffer | null = null;

  constructor(private readonly ctx: BaseAudioContext) {}

  /**
   * A pulse of a given duty, or a triangle, as harmonic amplitudes.
   *
   * A pulse's nth harmonic is `2/(nπ)·sin(nπd)`, which is why an eighth-duty
   * pulse is thin and bright — it keeps nearly everything — and a half-duty
   * one is a hollow square, every even harmonic having cancelled. A triangle
   * keeps the odd harmonics only and falls away as one over n squared, which
   * is what makes it soft enough to carry the bass without muddying the two
   * pulses sitting above it.
   *
   * `disableNormalization` because the score already says how loud each
   * voice is. Left on, Web Audio would scale every wave to the same peak and
   * the balance between the four channels would become its decision.
   */
  private waveFor(wave: "pulse" | "triangle", duty: number): PeriodicWave {
    const id = wave === "triangle" ? "triangle" : `pulse-${duty}`;
    const made = this.waves.get(id);
    if (made) return made;
    const real = new Float32Array(HARMONICS + 1);
    const imag = new Float32Array(HARMONICS + 1);
    if (wave === "triangle") {
      // Odd harmonics only, alternating in sign, as sines.
      for (let n = 1; n <= HARMONICS; n += 2) {
        imag[n] = ((8 / Math.PI ** 2) * (((n - 1) / 2) % 2 === 0 ? 1 : -1)) / (n * n);
      }
    } else {
      // Every harmonic, as cosines, scaled by where the duty puts its zeros.
      for (let n = 1; n <= HARMONICS; n++) {
        real[n] = (2 / (Math.PI * n)) * Math.sin(Math.PI * n * duty);
      }
    }
    const built = this.ctx.createPeriodicWave(real, imag, { disableNormalization: true });
    this.waves.set(id, built);
    return built;
  }

  /**
   * Two seconds of white noise, made once and looped from a moving offset.
   *
   * Seeded rather than `Math.random`, which costs nothing and keeps the one
   * rule this repository has about randomness: a run is reproducible or it
   * is not, and "except the hiss" is the sort of exception that is fine
   * until something else starts depending on it.
   */
  private noiseBuffer(): AudioBuffer {
    if (this.noise) return this.noise;
    const samples = Math.floor(this.ctx.sampleRate * NOISE_SECONDS);
    const buffer = this.ctx.createBuffer(1, samples, this.ctx.sampleRate);
    const channel = buffer.getChannelData(0);
    const rng = createRng(0x1eaf);
    for (let i = 0; i < samples; i++) channel[i] = rng() * 2 - 1;
    this.noise = buffer;
    return buffer;
  }

  /**
   * Strike one note at `at`, on the context's own clock.
   *
   * Everything is scheduled ahead rather than played now: `at` is a moment
   * in `AudioContext.currentTime`, which runs on the sound card rather than
   * on the main thread, and is the only clock in the browser that does not
   * stutter when a scene is doing something expensive. Nothing in here reads
   * the wall clock, for the same reason nothing else in this game does.
   */
  strike(voice: Sounded, note: Struck, at: number, held: number, into: AudioNode): void {
    const envelope = voice.envelope;
    const release = envelope.release_ms / 1000;
    const ends = at + held + release;
    const gain = this.ctx.createGain();
    gain.connect(into);

    let source: AudioScheduledSourceNode;
    if (voice.wave === "noise") {
      // `createBufferSource` rather than `new AudioBufferSourceNode`: the
      // constructor form arrived in Safari 14.1 and this game is meant to
      // run on whatever tablet a household already owns. The factory has
      // been in every implementation since the beginning.
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer();
      noise.loop = true;
      const band = this.ctx.createBiquadFilter();
      band.type = "bandpass";
      const nyquist = this.ctx.sampleRate / 2 - 1;
      band.frequency.setValueAtTime(Math.min(frequencyOf(note.midi), nyquist), at);
      if (note.slide) {
        const to = Math.min(frequencyOf(note.midi + note.slide), nyquist);
        band.frequency.linearRampToValueAtTime(to, at + held);
      }
      band.Q.value = NOISE_Q;
      noise.connect(band).connect(gain);
      source = noise;
    } else {
      const osc = this.ctx.createOscillator();
      osc.setPeriodicWave(this.waveFor(voice.wave, voice.duty));
      osc.frequency.setValueAtTime(frequencyOf(note.midi), at);
      // Two things have to match the generator's own renderer for the
      // audition to be worth anything, and both are asserted over there
      // (`test_a_slide_finishes_with_the_note_and_not_with_its_tail`).
      //
      // A ramp in *hertz* rather than in semitones, because that is what it
      // integrates. And over the *held* part of the note rather than over
      // held-plus-release, so the release rings on at the pitch the note
      // arrived at. Sweeping over the tail as well would be slower by the
      // ratio between them — half again, on the portal.
      if (note.slide) {
        osc.frequency.linearRampToValueAtTime(frequencyOf(note.midi + note.slide), at + held);
      }
      osc.connect(gain);
      source = osc;
    }

    // Attack, then decay to the sustain level, held, then released. Clamped
    // the same way the generator's renderer clamps it: a note shorter than
    // its own attack does not get to finish rising, and one that never
    // reaches its decay is released from wherever it had got to. Both are
    // ordinary here — the noise channel's notes are a sixteenth long.
    const peak = voice.gain * note.velocity;
    const attack = Math.min(envelope.attack_ms / 1000, held);
    const decay = Math.min(envelope.decay_ms / 1000, Math.max(held - attack, 0));
    const level = attack < held ? peak * envelope.sustain : peak;
    gain.gain.setValueAtTime(0, at);
    if (attack > 0) gain.gain.linearRampToValueAtTime(peak, at + attack);
    else gain.gain.setValueAtTime(peak, at);
    if (decay > 0) gain.gain.linearRampToValueAtTime(level, at + attack + decay);
    else if (attack < held) gain.gain.setValueAtTime(level, at + attack);
    gain.gain.setValueAtTime(level, at + held);
    gain.gain.linearRampToValueAtTime(0, ends);

    source.start(at);
    source.stop(ends);
    // Nodes are per note and there are a hundred and fifty of them a minute.
    // Left connected they are kept alive by the graph rather than collected,
    // which over an hour of play is the sort of leak that shows up as a game
    // that gets slower the longer a child enjoys it.
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };
  }
}
