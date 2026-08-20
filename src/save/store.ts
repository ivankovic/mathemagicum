// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { SettingsStore } from "../settings";
import { type Profile, readProfile, replaceProfile, withoutProfile } from "./profiles";
import { GENERATOR_VERSION, type GameSnapshot } from "./snapshot";
import { WORLD_KEY } from "./world";

/**
 * Where the children and their worlds are kept.
 *
 * `localStorage`, through the same little two-method interface the device
 * settings already use — which is what lets every rule above this be tested
 * without a browser, and what makes moving to IndexedDB later a change to
 * this file rather than to the game.
 *
 * Two keys: one index listing who plays on this device, and one world they
 * all share (`src/save/world.ts`). Split rather than kept as a single blob
 * so that reading the who's-playing screen does not have to parse the farm.
 *
 * There used to be a world per child. The children asked to share, so there
 * is one — which also means removing a player no longer removes a garden.
 */

export const PROFILES_KEY = "mathemagicum.players";

function readJson(store: SettingsStore | null, key: string): unknown {
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJson(store: SettingsStore | null, key: string, value: unknown): void {
  if (!store) return;
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing, a full quota, storage switched off. Losing the save
    // is bad; taking the game down mid-play over it is worse, and a child
    // who cannot save can still play.
  }
}

export function readProfiles(store: SettingsStore | null): readonly Profile[] {
  const saved = readJson(store, PROFILES_KEY);
  if (!Array.isArray(saved)) return [];
  const profiles: Profile[] = [];
  const seen = new Set<string>();
  for (const entry of saved) {
    const profile = readProfile(entry);
    // A duplicated id would give two faces on screen one world between them,
    // and whichever was tapped second would silently overwrite the first.
    if (!profile || seen.has(profile.id)) continue;
    seen.add(profile.id);
    profiles.push(profile);
  }
  return profiles;
}

export function writeProfiles(store: SettingsStore | null, profiles: readonly Profile[]): void {
  writeJson(store, PROFILES_KEY, profiles);
}

export function saveProfile(store: SettingsStore | null, profile: Profile): readonly Profile[] {
  const profiles = replaceProfile(readProfiles(store), profile);
  writeProfiles(store, profiles);
  return profiles;
}

/**
 * Remove a child, and leave the world exactly where it is.
 *
 * The world used to go with them, because it was theirs. It is the device's
 * now and everybody is gardening it, so deleting a player must take their
 * name, their face and their purse and touch nothing that is planted. The
 * last child leaving does not take the village with them either.
 */
export function deleteProfile(store: SettingsStore | null, id: string): readonly Profile[] {
  const profiles = withoutProfile(readProfiles(store), id);
  writeProfiles(store, profiles);
  return profiles;
}

export function writeWorld(store: SettingsStore | null, snapshot: GameSnapshot): void {
  writeJson(store, WORLD_KEY, snapshot);
}

export const LoadOutcome = {
  /** Nothing saved yet: a new world, which is also what a new player gets. */
  Fresh: "fresh",
  /** The save fits the world this game generates, and was restored. */
  Restored: "restored",
  /**
   * The save is from a world this game no longer builds the same way.
   *
   * The farm goes and everything about every child stays — their names,
   * their faces, their purses and their baskets all live on their profiles
   * and were never in this file. Only the ground is rebuilt, because a fence
   * saved against a coastline that has since moved can come back inside a
   * rock. Told to the player rather than done quietly: a farm that vanishes
   * without explanation reads as the game having lost it, which is a
   * different and worse thing than being told the world was rebuilt.
   */
  Rebuilt: "rebuilt",
} as const;

export type LoadOutcome = (typeof LoadOutcome)[keyof typeof LoadOutcome];

export interface LoadedWorld {
  readonly outcome: LoadOutcome;
  /** Present only when the outcome is `Restored`. */
  readonly snapshot: GameSnapshot | null;
}

export function loadWorld(store: SettingsStore | null): LoadedWorld {
  const saved = readJson(store, WORLD_KEY);
  if (typeof saved !== "object" || saved === null) {
    return { outcome: LoadOutcome.Fresh, snapshot: null };
  }
  const snapshot = saved as GameSnapshot;
  if (snapshot.generatorVersion !== GENERATOR_VERSION) {
    return { outcome: LoadOutcome.Rebuilt, snapshot: null };
  }
  return { outcome: LoadOutcome.Restored, snapshot };
}
