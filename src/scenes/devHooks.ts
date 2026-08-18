// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { GameSession } from "../world/session";

/**
 * Deliberate seams for driving the game from a script, and nothing else.
 *
 * These exist because the alternative was worse. Browser tests were reaching
 * in from outside and monkeypatching whatever they could get at: `Date.now`
 * was pinned to make the spell's problems predictable, which also stalled the
 * walk tween, so sprites drew a tile from where the camera said the player
 * was and three separate "the tap is broken" conclusions turned out to be the
 * test's own doing. Coordinates for buttons were copied into scripts by hand
 * and silently pointed at the wrong one the moment the action bar grew a
 * fourth slot. And nothing could be *read back*, so every assertion was a
 * human looking at a screenshot.
 *
 * So the game offers the seams instead: a seed, a way to hold the villagers
 * still, and a handle to read state and button positions from. Each is a
 * thing a test legitimately needs and cannot get any other way.
 *
 * All of it is gated on `import.meta.env.DEV`, so a production build has no
 * hook and ignores every parameter. That is the whole safety argument — a
 * `?coins=` that survived into a release would be a cheat code.
 */

export interface DevOptions {
  /** Fixes the spell RNG, so a script knows which sums it will be asked. */
  readonly seed: number | null;
  /** Holds the villagers on their home tiles, so their positions are knowable. */
  readonly freezeNpcs: boolean;
  /** Coins to start with, so a test of the shop need not first farm for them. */
  readonly coins: number;
  /**
   * Which language the game is being read in, overriding the browser's.
   *
   * The currency follows the language — kuna for English, francs for German
   * — so this is the single biggest branch in the game, and without a way to
   * ask for it a script would have to launch a second browser context with a
   * different locale to check any of the arithmetic.
   */
  readonly language: string | null;
  /**
   * Which coins to count in, overriding both the language and what is saved.
   *
   * The euro is the currency that behaves differently — small coins, so the
   * shop sells fewer at a time — and without this a script could only reach
   * it by writing the saved settings itself, which is exactly the reaching-in
   * these seams exist to replace.
   */
  readonly money: string | null;
}

const NONE: DevOptions = {
  seed: null,
  freezeNpcs: false,
  coins: 0,
  language: null,
  money: null,
};

export function devOptions(search = globalThis.location?.search ?? ""): DevOptions {
  if (!import.meta.env.DEV) return NONE;
  return parseDevOptions(search);
}

/** Split out from the environment check so it can be tested on its own. */
export function parseDevOptions(search: string): DevOptions {
  const params = new URLSearchParams(search);
  const number = (name: string): number | null => {
    const raw = params.get(name);
    // Empty counts as absent. `Number("")` is 0, which is finite, so a bare
    // `?seed=` would otherwise hand a script seed 0 — a different set of
    // problems than the one it computed, failing as wrong answers.
    if (raw === null || raw.trim() === "") return null;
    const value = Number(raw);
    return Number.isFinite(value) ? Math.trunc(value) : null;
  };
  return {
    seed: number("seed"),
    // Present at all means on: `?freezeNpcs` reads better than
    // `?freezeNpcs=true`, and a script that writes `=0` meaning off would be
    // wrong in a way nothing tells it about.
    freezeNpcs: params.has("freezeNpcs"),
    coins: Math.max(0, number("coins") ?? 0),
    language: params.get("lang")?.trim() || null,
    money: params.get("money")?.trim() || null,
  };
}

/** What a driving script can see. Read-only by intent, not by enforcement. */
export interface DevHandle {
  readonly session: GameSession;
  /** Screen positions of the named buttons, so scripts stop guessing them. */
  readonly ui: () => Record<string, { x: number; y: number }>;
  /**
   * The door tile of each building, by id.
   *
   * The world half of the same problem `ui` solves. Walking to a building
   * meant guessing a direction from the village layout constants and
   * stepping until something happened; the shop is behind one of these doors
   * now, so a script that cannot find it cannot test the shop at all.
   */
  readonly doors: () => Record<string, { col: number; row: number }>;
  /**
   * Where every person a script can interact with is standing, by id.
   *
   * The shopkeeper is inside her room and only exists while the player is in
   * there, so there is no layout constant to compute her from — and the one
   * villager who answers a tap is exactly the one a test needs to find.
   */
  readonly npcs: () => Record<string, { col: number; row: number }>;
  /**
   * Where a tile is on screen right now.
   *
   * Scripts were computing this from the camera centre and the player's tile,
   * which holds outdoors and quietly stops holding indoors: a room is smaller
   * than the viewport, so the camera clamps and the player is nowhere near
   * the middle. Every tap aimed at the shopkeeper landed on the floor beside
   * her, and the game answered "Can't walk there".
   */
  readonly screenOf: (col: number, row: number) => { x: number; y: number };
}

const HANDLE_KEY = "__mathemagicum";

export function exposeForTests(handle: DevHandle): void {
  if (!import.meta.env.DEV) return;
  (globalThis as unknown as Record<string, unknown>)[HANDLE_KEY] = handle;
}
