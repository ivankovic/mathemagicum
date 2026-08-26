// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { SETTINGS_KEY, type SettingsStore } from "../settings";
import { GAMES_KEY, OLD_SEED_KEY, OLD_WORLD_KEY, PLAYING_KEY, gameKey, listGames } from "./games";
import { PROFILES_KEY } from "./store";

/**
 * Every save on this device, in one file a parent can put somewhere safe.
 *
 * The game keeps everything in `localStorage`, which is a browser's to
 * delete: cleared history, a reinstall, a tablet that goes in a puddle, and
 * a year of somebody's farm is gone with no copy anywhere. Nothing about
 * that is fixable inside the game — this game has no server and is not
 * going to grow one — so the honest answer is to say so plainly on the way
 * in and hand over a file on the way out. See `parentsNotice`.
 *
 * **Named keys rather than everything that starts with the right word.**
 * The store is the two-method interface the settings use, and it cannot be
 * walked; but even against a real `localStorage` this is the better shape,
 * because the list is then a *statement* of what a save consists of and a
 * key that stopped being written shows up here as a line to delete rather
 * than as a mystery in somebody's backup file.
 */

/** What a backup file looks like, once. */
export const BACKUP_KIND = "mathemagicum.backup";
export const BACKUP_VERSION = 1;

export interface Backup {
  readonly kind: typeof BACKUP_KIND;
  readonly version: number;
  /** When it was taken, so two files can be told apart. */
  readonly savedAt: number;
  /** Every key that was set, exactly as it is stored. */
  readonly items: Readonly<Record<string, string>>;
}

/**
 * The keys a whole save is made of.
 *
 * The per-game ones come from the index rather than from a pattern, which
 * is the one part of this that has to read the store before it can know
 * what to ask for. A game the index has forgotten is a game the game itself
 * cannot open either, so leaving it out of the file loses nothing.
 *
 * The two `OLD_` keys are the pre-migration world. They are copied when
 * they are there and expected not to be: a device that has been played
 * since the migration has none, and one that has *not* has its only farm in
 * them — which is exactly the save a backup must not quietly drop.
 */
export function backupKeys(store: SettingsStore | null): readonly string[] {
  return [
    SETTINGS_KEY,
    PROFILES_KEY,
    GAMES_KEY,
    PLAYING_KEY,
    OLD_WORLD_KEY,
    OLD_SEED_KEY,
    ...listGames(store).map((game) => gameKey(game.id)),
  ];
}

/**
 * Read them all.
 *
 * Keys that are not set are left out rather than written as null, so a file
 * from a device with one child on it is small and readable — somebody
 * opening it in a text editor should be able to see what they have.
 */
export function collectBackup(store: SettingsStore | null, savedAt: number): Backup {
  const items: Record<string, string> = {};
  for (const key of backupKeys(store)) {
    const value = store?.getItem(key) ?? null;
    if (value !== null) items[key] = value;
  }
  return { kind: BACKUP_KIND, version: BACKUP_VERSION, savedAt, items };
}

/**
 * What the file is called.
 *
 * Dated, because the whole point is to take another one next month and a
 * folder of files all called the same thing is a folder with one file in
 * it. The date is the local one: a parent looking for last week's backup is
 * looking for the day it was their week.
 */
export function backupFileName(when: Date): string {
  const pad = (part: number) => String(part).padStart(2, "0");
  const day = `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`;
  return `mathemagicum-${day}.json`;
}

/** The file's contents, laid out so a person can read it. */
export function backupText(backup: Backup): string {
  return JSON.stringify(backup, null, 2);
}

/**
 * Read a file back, and say no to anything that is not one of ours.
 *
 * Every field is checked, because a file chosen from a picker is data from
 * outside the program in the strongest sense: it is whatever a parent
 * tapped in a folder full of things that are not this. What comes back is
 * either a whole backup or nothing at all — no partial reads, because the
 * caller is about to empty the device with it and half a file is worse than
 * no file.
 */
export function readBackup(value: unknown): Backup | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (record.kind !== BACKUP_KIND) return null;
  const version = Number(record.version);
  // A file from a *later* version is refused rather than half-read. It may
  // hold keys this build has never heard of, and writing them would leave a
  // device in a state only the newer game can open.
  if (!Number.isInteger(version) || version < 1 || version > BACKUP_VERSION) return null;
  const items = record.items;
  if (typeof items !== "object" || items === null || Array.isArray(items)) return null;
  const kept: Record<string, string> = {};
  for (const [key, held] of Object.entries(items as Record<string, unknown>)) {
    // Only the keys this game writes. A backup is not a way to put arbitrary
    // things into a browser's storage under this origin's name.
    if (typeof held !== "string") return null;
    if (!key.startsWith(KEY_PREFIX)) return null;
    kept[key] = held;
  }
  const savedAt = Number(record.savedAt);
  return {
    kind: BACKUP_KIND,
    version,
    savedAt: Number.isFinite(savedAt) && savedAt > 0 ? savedAt : 0,
    items: kept,
  };
}

/** Everything this game keeps is named like this, and nothing else is. */
const KEY_PREFIX = "mathemagicum.";

/**
 * Whether a device can be imported onto at all.
 *
 * A store that cannot forget can still be *written*, and that is exactly
 * the trap: the file's list of games would go in over the device's own
 * while the worlds behind the old list stayed where they were, unreachable
 * and taking up the quota. Nothing about that is visible afterwards, so it
 * is refused up front instead — see `restoreBackup`.
 */
export function canRestore(store: SettingsStore | null): boolean {
  return typeof store?.removeItem === "function";
}

/**
 * Put a file back onto this device, in place of what is on it.
 *
 * Replace rather than merge, and the reason is that a backup is a whole
 * *device* rather than a game: two devices' games would collide by id, two
 * children could arrive with the same name and different faces, and the
 * only honest answer to either is one somebody has to be asked. Told
 * plainly and confirmed beforehand, replacing is the thing a parent
 * restoring a lost tablet actually wants.
 *
 * What is cleared is worked out *before* anything is written, because the
 * list of games to clear is read out of the device's own index — and the
 * first thing written is the file's index over the top of it.
 */
export function restoreBackup(store: SettingsStore | null, backup: Backup): boolean {
  if (!store || !canRestore(store)) return false;
  const going = backupKeys(store);
  for (const key of going) store.removeItem?.(key);
  for (const [key, value] of Object.entries(backup.items)) store.setItem(key, value);
  return true;
}
