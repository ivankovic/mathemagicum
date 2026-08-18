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
}

const NONE: DevOptions = { seed: null, freezeNpcs: false, coins: 0 };

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
  };
}

/** What a driving script can see. Read-only by intent, not by enforcement. */
export interface DevHandle {
  readonly session: GameSession;
  /** Screen positions of the named buttons, so scripts stop guessing them. */
  readonly ui: () => Record<string, { x: number; y: number }>;
}

const HANDLE_KEY = "__mathemagicum";

export function exposeForTests(handle: DevHandle): void {
  if (!import.meta.env.DEV) return;
  (globalThis as unknown as Record<string, unknown>)[HANDLE_KEY] = handle;
}
