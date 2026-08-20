// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { SettingsStore } from "../settings";

/**
 * The world everybody on this device gardens.
 *
 * It used to belong to a child: a profile owned a seed, and the save was
 * what that child had done to it. The children asked to share, so it moved
 * here — one world for the tablet, played in turns.
 *
 * That is a smaller change than it sounds and a sharper one than it looks.
 * Smaller, because a world was always a seed plus a difference and neither
 * of those cared whose it was. Sharper, because the world now outlives every
 * player: removing a child must not remove the garden, and the last child
 * leaving must not take the village with them.
 *
 * The seed is minted once, the first time anybody plays, and then never
 * reissued. Everything else about a world — what is planted, what has been
 * put down, what has been taken away — is the snapshot beside it.
 */

export const WORLD_SEED_KEY = "mathemagicum.world.seed";
/** One world, one key. Not per profile any more — that was the whole change. */
export const WORLD_KEY = "mathemagicum.world";

/**
 * A world number, from a random draw.
 *
 * The game shipped with one hardcoded seed, so every player who ever started
 * it stood in the same village. Now every *device* gets its own — which is
 * the shared-world version of the same idea, and still not the same village
 * as the tablet next door.
 */
export function worldSeed(random: number): number {
  return Math.floor(Math.abs(random) * 0x7fffffff) % 0x7fffffff || 1;
}

/**
 * The device's world number, minting one if this is the first time.
 *
 * Read-and-write rather than read: the seed has to be stable from the first
 * moment anybody plays, and a game that generated one per session would give
 * each child a different village and call it shared.
 */
export function deviceSeed(store: SettingsStore | null, random: number): number {
  const saved = Number(store?.getItem(WORLD_SEED_KEY) ?? Number.NaN);
  if (Number.isFinite(saved) && saved > 0) return Math.floor(saved);
  const minted = worldSeed(random);
  try {
    store?.setItem(WORLD_SEED_KEY, String(minted));
  } catch {
    // Storage off. The world is still playable; it is simply a different one
    // next time, which is the same deal every other save makes here.
  }
  return minted;
}

/**
 * Throw the world away and start another.
 *
 * Nothing calls this yet. It exists because the moment sharing landed, "we
 * want a new world" became a thing somebody will ask for — and because
 * deleting the seed without deleting the difference beside it would lay one
 * child's fences over a coastline that has moved.
 */
export function forgetWorld(store: SettingsStore | null): void {
  try {
    store?.removeItem?.(WORLD_SEED_KEY);
    store?.removeItem?.(WORLD_KEY);
  } catch {
    // Same as above: an undeletable world is a leak, not a failure worth
    // reporting to somebody who has just asked for a fresh one.
  }
}
