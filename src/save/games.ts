// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { SettingsStore } from "../settings";
import {
  type Player,
  type Profile,
  type Progress,
  freshProgress,
  joinProfile,
  splitProfile,
} from "./profiles";
import { GENERATOR_VERSION, type GameSnapshot } from "./snapshot";

/**
 * The games saved on this device, and which one is being played.
 *
 * There used to be one world and a button that threw it away. That was
 * honest while a world was an afternoon's garden; it stops being honest the
 * moment a child has a house they have spent three weeks on, and a button
 * whose only outcome is *lose everything* is not a save system, it is a
 * confession that there isn't one.
 *
 * So: several games, kept side by side. Start another without losing this
 * one, go back to the one from last month, throw away the one nobody plays.
 *
 * **The children are not in them.** Who a child is — their name, their face,
 * the language they read, how hard their sums are — belongs to the device,
 * because none of it is a fact about a world. What they have *done* belongs
 * to the game they did it in. Starting a new game therefore does not mean
 * typing four names again, and loading an old one does not bring back a face
 * somebody has since changed. See `Player` and `Progress`.
 *
 * **Three keys, not one blob.** An index of what games exist, a body per
 * game, and a note of which is open. The index is what the games screen
 * reads, and it must not have to parse four farms to draw four buttons —
 * the same reason the player list has never been kept inside the world.
 */

export const GAMES_KEY = "mathemagicum.games";
export const PLAYING_KEY = "mathemagicum.playing";
export const GAME_KEY = "mathemagicum.game";

/** How many games one device keeps. */
export const MAX_GAMES = 4;

export function gameKey(id: string): string {
  return `${GAME_KEY}.${id}`;
}

/** What the games screen needs, and nothing more. */
export interface GameEntry {
  readonly id: string;
  readonly seed: number;
  /** Milliseconds since the epoch, for ordering and for saying when. */
  readonly savedAt: number;
}

/** A whole game: the ground, and what everybody has done to it. */
export interface SavedGame extends GameEntry {
  /**
   * The world, or null for one nobody has walked in yet.
   *
   * A game is its seed from the moment it is made; the snapshot is the
   * difference somebody has made to it, and there is none until they play.
   */
  readonly world: GameSnapshot | null;
  /** What each child has done here, by their id. */
  readonly progress: Readonly<Record<string, Progress>>;
  /**
   * Whether the generator has changed since this was written.
   *
   * Not a reason to refuse the save — see `loadGame` — but a reason to put it
   * back carefully: the same seed may grow a different coastline now, so a
   * fence saved on grass could be standing in the sea. Everything indoors is
   * keyed by house rather than by tile and is safe either way.
   */
  readonly groundMoved: boolean;
}

/** Whether a snapshot was written against a world the generator no longer builds. */
function movedSince(world: GameSnapshot | null): boolean {
  return world !== null && world.generatorVersion !== GENERATOR_VERSION;
}

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
    // Private browsing, a full quota, storage switched off. Losing a save is
    // bad; taking the game down mid-play over it is worse.
  }
}

/** A game number, from a random draw. The world is grown from it. */
export function gameSeed(random: number): number {
  return Math.floor(Math.abs(random) * 0x7fff_ffff) % 0x7fff_ffff || 1;
}

/**
 * Every game on the device, newest first.
 *
 * Bad entries are dropped rather than taking the list down with them: one
 * game somebody's browser mangled must not hide the other three.
 */
export function listGames(store: SettingsStore | null): readonly GameEntry[] {
  const saved = readJson(store, GAMES_KEY);
  if (!Array.isArray(saved)) return [];
  const games: GameEntry[] = [];
  const seen = new Set<string>();
  for (const entry of saved) {
    const game = readEntry(entry);
    if (!game || seen.has(game.id)) continue;
    seen.add(game.id);
    games.push(game);
  }
  return [...games].sort((a, b) => b.savedAt - a.savedAt);
}

function readEntry(value: unknown): GameEntry | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || record.id.length === 0) return null;
  const seed = Number(record.seed);
  if (!Number.isFinite(seed) || seed <= 0) return null;
  const savedAt = Number(record.savedAt);
  return { id: record.id, seed: Math.floor(seed), savedAt: Number.isFinite(savedAt) ? savedAt : 0 };
}

export function writeIndex(store: SettingsStore | null, games: readonly GameEntry[]): void {
  writeJson(
    store,
    GAMES_KEY,
    games.map(({ id, seed, savedAt }) => ({ id, seed, savedAt })),
  );
}

/** Whether there is room for another. */
export function canAddGame(games: readonly GameEntry[]): boolean {
  return games.length < MAX_GAMES;
}

/**
 * Start a game, and open it.
 *
 * An id from the clock rather than a counter: two games made in the same
 * millisecond is not a case, and a counter has to be stored somewhere and
 * kept in step with a list it can already read.
 */
export function newGame(store: SettingsStore | null, random: number, now: number): SavedGame {
  const games = listGames(store);
  const id = `g${now.toString(36)}${Math.floor(Math.abs(random) * 1e6).toString(36)}`;
  const game: SavedGame = {
    id,
    seed: gameSeed(random),
    savedAt: now,
    world: null,
    progress: {},
    // A world nobody has walked in yet has no ground to have moved.
    groundMoved: false,
  };
  writeGame(store, game);
  writeIndex(store, [game, ...games].slice(0, MAX_GAMES));
  setPlaying(store, id);
  return game;
}

export function writeGame(store: SettingsStore | null, game: SavedGame): void {
  writeJson(store, gameKey(game.id), game);
  const rest = listGames(store).filter((entry) => entry.id !== game.id);
  writeIndex(store, [{ id: game.id, seed: game.seed, savedAt: game.savedAt }, ...rest]);
}

/**
 * A game by id, or nothing.
 *
 * A world saved by a generator that no longer builds the same way comes back
 * without its ground: a fence saved against a coastline that has since moved
 * can come back inside a rock. The seed and everybody's progress survive,
 * because neither of those is a fact about the shape of the coast.
 */
export function loadGame(store: SettingsStore | null, id: string): SavedGame | null {
  const saved = readJson(store, gameKey(id));
  if (typeof saved !== "object" || saved === null) return null;
  const record = saved as Record<string, unknown>;
  const entry = readEntry(record);
  if (!entry) return null;
  const world = record.world as GameSnapshot | null | undefined;
  // **Kept, whatever version built it.** This used to hand back nothing when
  // the generator had moved on, which threw away every room, every machine
  // and every line along with the outdoor squares that were actually at
  // risk — and rooms are keyed by house rather than by tile, so they were
  // never in danger at all.
  //
  // What the mismatch means now is *the ground may have moved*, which is a
  // thing to check a square at a time as the world is put back. See
  // `restoreWorld`, and `SavedGame.groundMoved`.
  const usable = world ?? null;
  const progress =
    typeof record.progress === "object" && record.progress !== null
      ? (record.progress as Record<string, Progress>)
      : {};
  return { ...entry, world: usable, progress, groundMoved: movedSince(usable) };
}

export function deleteGame(store: SettingsStore | null, id: string): readonly GameEntry[] {
  const left = listGames(store).filter((entry) => entry.id !== id);
  writeIndex(store, left);
  try {
    store?.removeItem?.(gameKey(id));
  } catch {
    // An undeletable body is a leak, not a failure worth reporting to
    // somebody who has just asked to be rid of it.
  }
  if (playingId(store) === id) setPlaying(store, left[0]?.id ?? null);
  return left;
}

export function playingId(store: SettingsStore | null): string | null {
  const saved = store?.getItem(PLAYING_KEY) ?? null;
  return saved && saved.length > 0 ? saved : null;
}

export function setPlaying(store: SettingsStore | null, id: string | null): void {
  try {
    if (id) store?.setItem(PLAYING_KEY, id);
    else store?.removeItem?.(PLAYING_KEY);
  } catch {
    // As above: unable to remember which game is open is a game that opens
    // the newest one instead, which is very nearly the right answer anyway.
  }
}

/**
 * The game to open now: the one that was open, or the newest, or a new one.
 *
 * Never nothing. A device that has never been played gets a game made for it
 * on the spot, which is what makes the child's route through the game
 * unchanged — title, who is playing, garden. Choosing between games is an
 * adult's business and lives in the options.
 */
export function openGame(store: SettingsStore | null, random: number, now: number): SavedGame {
  carryOverTheOldWorld(store, now);
  const wanted = playingId(store);
  const loaded = wanted ? loadGame(store, wanted) : null;
  if (loaded) return loaded;
  const newest = listGames(store)[0];
  const fallback = newest ? loadGame(store, newest.id) : null;
  if (fallback) {
    setPlaying(store, fallback.id);
    return fallback;
  }
  return newGame(store, random, now);
}

export const OLD_WORLD_KEY = "mathemagicum.world";
export const OLD_SEED_KEY = "mathemagicum.world.seed";

/**
 * Turn the one world this device used to have into the first saved game.
 *
 * There was a single world under one key and a button that threw it away.
 * Everybody playing when this shipped has a garden under that key, and the
 * standing permission to lose data while playtesting runs out exactly here:
 * this is the change that says a save is worth keeping.
 *
 * Only ever runs once, because it only runs when there are no games — and
 * the first thing it does is make one. The old keys go with it, so a device
 * cannot be carried over twice.
 *
 * The children need no carrying: their records already hold both halves, so
 * `readProfile` reads a Player and a Progress out of the same old row.
 */
function carryOverTheOldWorld(store: SettingsStore | null, now: number): void {
  if (!store || listGames(store).length > 0) return;
  const world = readJson(store, OLD_WORLD_KEY) as GameSnapshot | null;
  const seed = Number(store.getItem(OLD_SEED_KEY) ?? Number.NaN);
  if (!world && !Number.isFinite(seed)) return;
  const id = `g${now.toString(36)}old`;
  const game: SavedGame = {
    id,
    seed: Number.isFinite(seed) && seed > 0 ? Math.floor(seed) : (world?.seed ?? 1),
    savedAt: world?.savedAt ?? now,
    // Kept whatever built it, the same as `loadGame` now does: a save from
    // an older generator is a save to put back carefully, not one to throw.
    world: world ?? null,
    progress: {},
    groundMoved: movedSince(world ?? null),
  };
  writeGame(store, game);
  setPlaying(store, id);
  try {
    store.removeItem?.(OLD_WORLD_KEY);
    store.removeItem?.(OLD_SEED_KEY);
  } catch {
    // An old key that will not go is a few unread bytes, not a failure.
  }
}

/**
 * This child, in this game — the two halves seen as one.
 *
 * A player who has never opened this game gets a fresh start in it, which is
 * exactly what a new game means: the same four children, none of whom has
 * been anywhere yet.
 */
export function profileIn(game: SavedGame, player: Player): Profile {
  return joinProfile(player, game.progress[player.id] ?? freshProgress(player.band));
}

/** And back apart again, for saving. */
export function withProgress(game: SavedGame, profile: Profile, savedAt: number): SavedGame {
  const { player, progress } = splitProfile(profile);
  return { ...game, savedAt, progress: { ...game.progress, [player.id]: progress } };
}
