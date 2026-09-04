// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { notesDue } from "./schedule";
import type { Score, TuneKey } from "./score";
import { loopSeconds, readScore, sameTune, scoreFile } from "./score";
import { SFX_FILE, type Sfx, type SfxBundle, readSfx } from "./sfx";
import { ChiptuneSynth, MUSIC_GAIN } from "./synth";

/**
 * Everything the game makes a noise with: the tune, and the one-shot effects.
 *
 * One of these for the whole game. It owns the `AudioContext`, fetches a
 * score the first time a place is walked into, and lays notes down a little
 * ahead of the sound card for as long as the sound is on.
 *
 * The two halves want opposite things, which is why neither is written the
 * way the other is. Music is scheduled a second and a half ahead, because
 * nothing is waiting on it and a starved frame must not put a hole in the
 * bar. An effect is struck at `currentTime` the moment it is asked for,
 * because a coin heard a second and a half after it lands is not a coin, it
 * is an echo. And a tune may arrive late, under a fade nobody can hear; the
 * effects may not, so they come in one small file at the first touch.
 *
 * **Fetched here rather than loaded by the boot scene, which is where they
 * started.** Ten scores is two hundred kilobytes and the boot loader is the
 * thing the loading bar is measuring, so putting them there put music in
 * front of the game — and measurably so: the ten extra files cost the house
 * scenarios two hundred and seventy seconds across their eleven boots, which
 * is more than the bytes can account for and is a queue rather than a
 * download. Music is the one asset in this game nobody is waiting for. It
 * arrives a second or two into play, under a fade that is a second and a
 * half long, and nothing can tell.
 *
 * The service worker precaches `assets/music/*.json` by glob either way, so
 * this is still a game that plays its music on a train.
 *
 * **Nothing here is built until somebody taps something.** A browser will
 * not start audio before a gesture — it will hand back a context that is
 * suspended and complain in the console about it — so the context is made
 * inside the first tap on the who's-playing screen and not a moment before.
 * That screen is also the earliest gesture there is: it happens before a
 * world exists, let alone a place to have a tune for.
 *
 * Everything in here that can fail is allowed to, quietly. A tablet whose
 * audio will not start still plays the game, exactly as a device with
 * storage switched off still plays it — see `writeSettings`. Music is not
 * worth a blank screen, and it is certainly not worth an exception on the
 * way to the title.
 */

/** How often notes are laid down, and how far ahead of the clock. */
const PUMP_MS = 200;

/**
 * The least time between two strikes of the *same* effect.
 *
 * A spell cast on a patch does its work square by square — sixteen crops
 * grown, sixteen plusses drawn — and every one of those goes through the
 * same funnel. `GameScene` already knows this about the animation and says
 * so: "one bend of the back for the lot of them, where a single seed gets
 * one for itself. Sixteen gestures in a frame is a seizure." Sixteen copies
 * of one sound inside a frame is worse than a seizure, it is a crunch: they
 * are in phase, so they add rather than layer.
 *
 * Guarded here rather than at each caller because the next thing that acts
 * on a rectangle should not have to remember. Fifty milliseconds is far
 * below anything a hand can do twice — a child tapping coins as fast as
 * they can manage is nearer two hundred — so nothing anybody *means* is
 * ever swallowed.
 */
const SAME_SOUND_GAP = 0.05;
/**
 * A generous lookahead, because the thing it is buying is not latency.
 *
 * Nothing here reacts to a keypress: the earliest a tune ever needs to
 * change is when a child walks over the edge of a wood, and that is answered
 * by a crossfade rather than by the next note. So the window is set long
 * enough that an ordinary busy frame cannot starve it. When something much
 * worse than a busy frame happens — a world being generated, which holds the
 * main thread for seconds — the notes that were missed are dropped rather
 * than caught up on. See `tick`.
 */
const LOOKAHEAD = 1.5;

/**
 * How long one tune takes to become another.
 *
 * Long enough to be a change of light rather than a cut. A child crossing
 * from the village into the wood is not crossing a line — the wood starts
 * being the wood over about a second and a half of walking, and the music
 * should take about as long to agree.
 */
const FADE = 1.6;

export class Sound {
  private ctx: AudioContext | null = null;
  private synth: ChiptuneSynth | null = null;
  /** The gain the tune currently being scheduled is played through. */
  private bus: GainNode | null = null;
  private readonly scores = new Map<string, Score>();
  /** Stems that would not read, so a broken file is fetched once and not again. */
  private readonly unreadable = new Set<string>();
  /** The one-shot effects, once they have arrived. */
  private effects: SfxBundle | null = null;
  /** How many have been struck, for a scenario to read. */
  private struck = 0;
  /** When each effect last sounded, on the audio clock. See SAME_SOUND_GAP. */
  private readonly lastStruck = new Map<string, number>();
  /** The stem being fetched, so walking about does not ask for it ten times. */
  private fetching: string | null = null;
  private playing: TuneKey | null = null;
  private score: Score | null = null;
  /** The moment on the audio clock the current tune began. */
  private startedAt = 0;
  /** How far into the tune notes have already been laid down. */
  private scheduledTo = 0;
  private pump: ReturnType<typeof setInterval> | null = null;
  /** What the scene last asked for, remembered across a mute and an unmute. */
  private wanted: TuneKey | null = null;
  /** How many notes have been handed to the sound card, for a scenario to read. */
  private notes = 0;

  constructor(private on: boolean) {}

  /** Whether anything is being scheduled, which is what a test can see. */
  get sounding(): boolean {
    return this.score !== null;
  }

  get tune(): TuneKey | null {
    return this.playing;
  }

  /**
   * What a scenario can see of all this.
   *
   * There is no other way to know. Everything in here ends up as a number on
   * a sound card, and a browser test cannot listen — so what it is offered
   * instead is the count of notes actually handed over, which is the one
   * fact that separates a tune playing from a tune that read, loaded,
   * chose itself correctly and made no sound at all.
   */
  report(): {
    tune: string | null;
    notes: number;
    effects: number;
    knows: number;
    enabled: boolean;
    state: string;
  } {
    return {
      tune: this.playing ? scoreFile(this.playing) : null,
      notes: this.notes,
      effects: this.struck,
      knows: this.effects ? Object.keys(this.effects).length : 0,
      enabled: this.on,
      state: this.ctx?.state ?? "none",
    };
  }

  /**
   * Make one of the world's noises, now.
   *
   * Straight onto the clock rather than through the scheduler the music
   * uses: this is called at the moment the thing happened, and a coin heard
   * a beat later is not a coin.
   *
   * Every way this can decline is ordinary and silent. The sound may be off,
   * the page may not have been touched, the file may not have arrived, the
   * browser may have suspended the context — and in each case the game
   * carries on, because it is a game about arithmetic and not about audio.
   */
  effect(name: Sfx): void {
    const ctx = this.ctx;
    const synth = this.synth;
    const effect = this.effects?.[name];
    if (!ctx || !synth || !effect || !this.on) return;
    if (ctx.state !== "running") return;
    const at = ctx.currentTime;
    // On the audio clock, not the wall clock — the same rule the rest of
    // this file follows, and here it is also the only clock that agrees with
    // the times the notes are actually scheduled at.
    if (at - (this.lastStruck.get(name) ?? Number.NEGATIVE_INFINITY) < SAME_SOUND_GAP) return;
    this.lastStruck.set(name, at);
    try {
      for (const voice of effect.voices) {
        for (const blip of voice.notes) {
          synth.strike(voice, blip, at + blip.at_ms / 1000, blip.ms / 1000, ctx.destination);
        }
      }
      this.struck++;
    } catch (wrong) {
      console.warn("a sound would not play", wrong);
      this.effects = null;
    }
  }

  /**
   * The first real gesture of the session: make the context, if the browser
   * will give us one.
   *
   * **This has to be called from inside a genuine DOM event handler, and
   * that is the whole difficulty.** Every browser refuses to start audio
   * before somebody has touched the page, and they disagree about how long
   * the permission lasts. Chrome remembers that the page has been interacted
   * with and will start a context some time afterwards; WebKit — which is
   * every browser on an iPhone, Firefox and Chrome included, because iOS
   * permits no other engine — only honours it inside the synchronous call
   * stack of the event itself.
   *
   * Phaser does not give you that stack. It listens to the DOM, queues what
   * it hears, and dispatches its own `pointerdown` during the next step of
   * the game loop — a `requestAnimationFrame` tick, which is a fresh stack
   * with no gesture attached to it. So a context made from a Phaser input
   * handler starts on a desktop and stays suspended on an iPhone, silently
   * and only there. It is called from a native listener in `main.ts`
   * instead. See the comment on `listenForTheFirstTouch`.
   *
   * Safe to call again, and called on every touch on purpose: a tab left
   * open overnight comes back with its audio suspended — or `interrupted`,
   * which is WebKit's own third state after a phone call — and the touch
   * that returns to it is the one that should bring the sound back.
   */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume().catch(() => {});
      return;
    }
    // `webkitAudioContext` because an iPhone that has not been updated in a
    // while has only the prefixed one, and a game that is silent on old
    // hardware is silent on exactly the hardware a household hands to a
    // child.
    const Ctor =
      globalThis.AudioContext ??
      (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      const ctx = new Ctor();
      // The empty note. One sample of silence, started inside the gesture:
      // this is the old iOS handshake and it is still the thing that works.
      // Constructing a context is not what WebKit counts as using audio —
      // *playing* something is — so a context made and left alone can sit in
      // `suspended` for ever with `resume()` quietly refusing.
      const prime = ctx.createBufferSource();
      prime.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      prime.connect(ctx.destination);
      prime.start(0);
      void ctx.resume().catch(() => {});
      this.ctx = ctx;
      this.synth = new ChiptuneSynth(ctx);
    } catch {
      // No audio on this device, or none this browser will give us. The
      // game is the same game without it.
      this.ctx = null;
      this.synth = null;
      return;
    }
    void this.fetchEffects();
    if (this.wanted) this.reach(this.wanted);
  }

  /**
   * The one-shot sounds, all of them, as early as they can be had.
   *
   * Not lazily, the way a tune is, and the reason is the difference between
   * the two kinds of sound. A tune arriving a second late hides under its
   * own fade; an effect arriving a second late is the first thing a child
   * does being the silent one.
   *
   * So the whole set — under ten kilobytes for the lot — is asked for the
   * moment the game knows the sound is on, which is the who's-playing
   * screen. Not in the boot loader, which is measured by the loading bar and
   * where ten small files once cost a browser scenario two hundred and
   * seventy seconds; and not at the unlock either, which was the first
   * attempt and was still a beat too late.
   */
  private async fetchEffects(): Promise<void> {
    if (this.effects) return;
    try {
      const response = await globalThis.fetch(`${import.meta.env.BASE_URL}${SFX_FILE}`);
      if (!response.ok) throw new Error(String(response.status));
      const bundle = readSfx(await response.json());
      if (!bundle) throw new Error("not a sound set this game reads");
      this.effects = bundle;
    } catch (wrong) {
      console.warn("the sound effects did not read; the world will be quiet", wrong);
    }
  }

  /**
   * Ask for a tune. Called on every step, and answers on the ones that matter.
   *
   * The scene has no idea what is playing and should not have to: it says
   * where the child is standing and what hour it is, and the same answer
   * twice in a row costs nothing.
   */
  wants(tune: TuneKey): void {
    this.wanted = tune;
    if (!this.on || !this.ctx) return;
    if (sameTune(tune, this.playing)) return;
    this.reach(tune);
  }

  /** Switched on or off, and remembered by whoever asked. */
  setEnabled(on: boolean): void {
    // Before the early return, and that is the whole point of it being here.
    //
    // Fetching does not need a gesture; only *playing* does. Asked for at
    // the unlock instead, the set was still in flight when the tap that
    // caused the unlock reached the thing it was a tap on — so the first
    // action of every session was silent, which is the one action a child is
    // paying most attention to. This is called from the who's-playing screen,
    // which is after the boot loader has finished and a good few seconds
    // before anything in the world can happen.
    if (on) void this.fetchEffects();
    if (on === this.on) return;
    this.on = on;
    if (!on) {
      this.silence();
      return;
    }
    if (this.wanted) this.reach(this.wanted);
  }

  get enabled(): boolean {
    return this.on;
  }

  /**
   * Get hold of a tune and start it, fetching the score if this is the first
   * time this place has been walked into.
   *
   * The fetch can finish long after the child has walked on — which is why
   * what it checks on the way back is `wanted` and not the tune it was asked
   * for. A score that arrives for a wood she has already left is put in the
   * drawer and not played; the next time she goes back it is there.
   */
  private reach(tune: TuneKey): void {
    const stem = scoreFile(tune);
    const known = this.scores.get(stem);
    if (known) {
      this.play(tune, known);
      return;
    }
    if (this.unreadable.has(stem) || this.fetching === stem) return;
    this.fetching = stem;
    void (async () => {
      const score = await this.fetch(stem);
      this.fetching = null;
      if (!score || !this.on || !this.ctx) return;
      if (!sameTune(tune, this.wanted)) return;
      this.play(tune, score);
    })();
  }

  /**
   * One score, off the disk, or nothing.
   *
   * Nothing is a real answer and everything here is written for it. A file
   * that is missing, unreachable, the wrong version or half-written costs
   * the music of one place — which nobody has ever filed a bug about — and
   * is remembered as unreadable so a game does not spend the rest of the
   * afternoon asking for it again every time she walks past.
   */
  private async fetch(stem: string): Promise<Score | null> {
    try {
      const response = await globalThis.fetch(
        `${import.meta.env.BASE_URL}assets/music/${stem}.json`,
      );
      if (!response.ok) throw new Error(String(response.status));
      const score = readScore(await response.json());
      if (!score) throw new Error("not a score this game reads");
      this.scores.set(stem, score);
      return score;
    } catch (wrong) {
      this.unreadable.add(stem);
      console.warn(`the ${stem} music did not read; that place will be quiet`, wrong);
      return null;
    }
  }

  /**
   * Start a tune, fading out whatever was there.
   *
   * The outgoing tune keeps its notes — they are already on the sound card's
   * clock and cannot be taken back — and simply has its gain taken away
   * under them. Only the *scheduling* stops. Trying to stop the notes
   * themselves would mean tracking every node struck in the last second and
   * a half to cut it short, which is a great deal of bookkeeping to make a
   * crossfade sound worse.
   */
  private play(tune: TuneKey, score: Score): void {
    const ctx = this.ctx;
    if (!ctx || !this.on) return;
    this.fadeOut();
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0, ctx.currentTime);
    bus.gain.linearRampToValueAtTime(MUSIC_GAIN, ctx.currentTime + FADE);
    bus.connect(ctx.destination);
    this.bus = bus;
    this.score = score;
    this.playing = tune;
    // Not from the top. A child who walks out of a wood and back into it
    // twice in a minute should not hear the same eight bars three times —
    // the tune has been going the whole while and they have been out of
    // earshot of it, which is what a place having its own music means.
    this.startedAt = ctx.currentTime - (ctx.currentTime % loopSeconds(score));
    this.scheduledTo = ctx.currentTime - this.startedAt;
    this.start();
  }

  private fadeOut(): void {
    const ctx = this.ctx;
    const bus = this.bus;
    if (!ctx || !bus) return;
    bus.gain.cancelScheduledValues(ctx.currentTime);
    bus.gain.setValueAtTime(bus.gain.value, ctx.currentTime);
    bus.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE);
    // Let go of it: the notes already scheduled play out through a node
    // nothing points at any more, and it goes when they do.
    window.setTimeout(() => bus.disconnect(), (FADE + LOOKAHEAD) * 1000);
    this.bus = null;
    this.score = null;
    this.playing = null;
  }

  /** Stop scheduling and fade what is sounding. Everything is still known. */
  private silence(): void {
    this.fadeOut();
    this.stopPump();
  }

  private start(): void {
    this.tick();
    if (this.pump !== null) return;
    this.pump = setInterval(() => this.tick(), PUMP_MS);
  }

  private stopPump(): void {
    if (this.pump === null) return;
    clearInterval(this.pump);
    this.pump = null;
  }

  /**
   * Lay down everything due before the clock gets there.
   *
   * The window is half-open and moves by its own end, so no note is ever
   * scheduled twice — which on a held bass note is not a doubled note but a
   * second one struck underneath the first, and those add up rather than
   * replacing each other.
   */
  private tick(): void {
    const ctx = this.ctx;
    const score = this.score;
    const bus = this.bus;
    if (!ctx || !score || !bus || !this.synth) return;
    // A context the browser has suspended — a backgrounded tab, usually.
    // Its clock is stopped too, so there is nothing to catch up on: the tune
    // carries on from where it was when the tab comes back.
    if (ctx.state !== "running") return;
    const elapsed = ctx.currentTime - this.startedAt;
    // What was missed while the main thread was busy is *dropped*, not
    // caught up on.
    //
    // In the ordinary case this does nothing: the cursor sits a lookahead
    // ahead of the clock, which is the whole point of it. It matters when
    // the pump does not get to run — a world being generated holds the main
    // thread for seconds at a time, and every timer with it — because the
    // audio clock keeps going regardless. Come back from that and the window
    // is seconds wide, every note in it has a start time in the past, and
    // Web Audio reads a start time in the past as *now*: several hundred
    // oscillators struck simultaneously, one chord made of the whole tune,
    // and an audio thread that then has to render all of it.
    //
    // Measured, that was a browser scenario file going from a hundred and
    // sixty seconds to four hundred and thirty and one test timing out.
    // Dropping them is also what the tune should do: a scheduler that misses
    // its slot leaves a hole in the bar and carries on in time, rather than
    // playing catch-up a second late for ever.
    if (this.scheduledTo < elapsed) this.scheduledTo = elapsed;
    const until = elapsed + LOOKAHEAD;
    try {
      for (const due of notesDue(score, this.scheduledTo, until)) {
        this.synth.strike(due.voice, due.note, this.startedAt + due.at, due.held, bus);
        this.notes++;
      }
    } catch (wrong) {
      // Something in this browser's Web Audio is not what the spec says it
      // is — an old WebKit without the options form of `createPeriodicWave`
      // is the one that prompted this. Give up on the music for the session
      // rather than throwing sixty times a second into a game that is
      // otherwise working perfectly.
      console.warn("the music stopped: this browser's audio would not play it", wrong);
      this.silence();
      return;
    }
    this.scheduledTo = until;
  }

  /** Give everything back. The scene that made this is going away. */
  destroy(): void {
    this.stopPump();
    this.bus?.disconnect();
    this.bus = null;
    this.score = null;
    this.playing = null;
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.synth = null;
  }
}

/**
 * The one of these, made the first time anybody asks for it.
 *
 * A singleton because the music is the one thing in this game that is meant
 * to outlive a scene. The boot scene teaches it the tunes, the who's-playing
 * screen unlocks it, and the game scene tells it where the child is standing
 * — and between those, scenes are started and stopped and restarted every
 * time somebody opens another world. A tune that stopped and started again
 * with them would announce every one of those, including the ones that are
 * not supposed to be visible at all.
 *
 * On until told otherwise, which is what `DEFAULT_SETTINGS` says. Whoever
 * reads the settings tells it — see PlayersScene.
 */
let shared: Sound | null = null;

export function sound(): Sound {
  shared ??= new Sound(true);
  return shared;
}

/** For tests, which must not inherit the last one's context. */
export function forgetSound(): void {
  shared?.destroy();
  shared = null;
}
