// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { SettingsStore } from "../settings";
import { type Profile, readProfile, replaceProfile, withoutProfile } from "./profiles";

/**
 * Where the children and their worlds are kept.
 *
 * `localStorage`, through the same little two-method interface the device
 * settings already use — which is what lets every rule above this be tested
 * without a browser, and what makes moving to IndexedDB later a change to
 * this file rather than to the game.
 *
 * One key: an index of who plays on this device. The games they play are
 * next door in `games.ts`, one key each, and the split is what lets the
 * who's-playing screen be drawn without parsing four farms.
 *
 * There used to be a world per child; then one world shared; then several
 * saved games with the children kept out of them. What survived all three
 * shapes is that a *person* and a *world* are different things — see
 * `Player` and `Progress`.
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
 * Remove a child, and leave every game exactly where it is.
 *
 * The world used to go with them, because it was theirs. A game belongs to
 * the device now, so deleting a player takes their name and their face and
 * touches nothing that is planted. Their progress stays in the games it was
 * made in, unread — which costs a few bytes and means a child re-made under
 * the same name is a new person, which is what they are.
 */
export function deleteProfile(store: SettingsStore | null, id: string): readonly Profile[] {
  const profiles = withoutProfile(readProfiles(store), id);
  writeProfiles(store, profiles);
  return profiles;
}
