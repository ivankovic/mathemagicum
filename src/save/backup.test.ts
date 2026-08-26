// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { SETTINGS_KEY, type SettingsStore } from "../settings";
import {
  BACKUP_KIND,
  BACKUP_VERSION,
  backupFileName,
  backupKeys,
  backupText,
  canRestore,
  collectBackup,
  readBackup,
  restoreBackup,
} from "./backup";
import { GAMES_KEY, OLD_SEED_KEY, OLD_WORLD_KEY, PLAYING_KEY, gameKey } from "./games";
import { PROFILES_KEY } from "./store";

const WHEN = new Date(2026, 7, 26, 14, 30, 0, 0).getTime();

function memory(seed: Record<string, string> = {}): SettingsStore {
  const held = new Map(Object.entries(seed));
  return {
    getItem: (key) => held.get(key) ?? null,
    setItem: (key, value) => {
      held.set(key, value);
    },
    removeItem: (key) => {
      held.delete(key);
    },
  };
}

function index(...ids: string[]): string {
  return JSON.stringify(ids.map((id, at) => ({ id, seed: 100 + at, savedAt: WHEN - at })));
}

describe("what goes into a backup", () => {
  /**
   * Every game the device has, not just the one being played.
   *
   * The per-game keys are the part that cannot be written down in advance,
   * and they are also the part that holds the farms — a file with the index
   * in it and none of the worlds it names would restore a list of games
   * that all open empty.
   */
  test("the world of every game the index names", () => {
    const store = memory({ [GAMES_KEY]: index("aaa", "bbb", "ccc") });
    const keys = backupKeys(store);
    expect(keys).toContain(gameKey("aaa"));
    expect(keys).toContain(gameKey("bbb"));
    expect(keys).toContain(gameKey("ccc"));
  });

  test("and the children, the settings, and which game was open", () => {
    const keys = backupKeys(memory());
    expect(keys).toContain(PROFILES_KEY);
    expect(keys).toContain(SETTINGS_KEY);
    expect(keys).toContain(GAMES_KEY);
    expect(keys).toContain(PLAYING_KEY);
  });

  /**
   * And the world from before the saved-games migration.
   *
   * A device that has not been opened since the change keeps its only farm
   * under the old keys. That is precisely the save a backup exists for, and
   * precisely the one a list written from what the game reads *today* would
   * miss.
   */
  test("including a world that predates saved games", () => {
    const keys = backupKeys(memory());
    expect(keys).toContain(OLD_WORLD_KEY);
    expect(keys).toContain(OLD_SEED_KEY);
  });

  test("nothing is asked for twice", () => {
    const keys = backupKeys(memory({ [GAMES_KEY]: index("aaa", "bbb") }));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("the file itself", () => {
  test("holds every key that was set, exactly as it was stored", () => {
    const store = memory({
      [GAMES_KEY]: index("aaa"),
      [gameKey("aaa")]: '{"seed":100,"world":{"crops":[]}}',
      [PROFILES_KEY]: '[{"id":"kid"}]',
      [SETTINGS_KEY]: '{"language":"hr"}',
    });
    const backup = collectBackup(store, WHEN);
    expect(backup.kind).toBe(BACKUP_KIND);
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(backup.savedAt).toBe(WHEN);
    expect(backup.items[gameKey("aaa")]).toBe('{"seed":100,"world":{"crops":[]}}');
    expect(backup.items[PROFILES_KEY]).toBe('[{"id":"kid"}]');
    expect(backup.items[SETTINGS_KEY]).toBe('{"language":"hr"}');
  });

  /**
   * Keys that were never set are left out rather than written as null.
   *
   * A file from a tablet with one child on it should be short enough that
   * somebody who opens it in a text editor can see what they have — which
   * is half of what makes a backup something a parent trusts.
   */
  test("and leaves out the ones that were not", () => {
    const backup = collectBackup(memory({ [PROFILES_KEY]: "[]" }), WHEN);
    expect(Object.keys(backup.items)).toEqual([PROFILES_KEY]);
    expect(PLAYING_KEY in backup.items).toBe(false);
  });

  test("a device with nothing on it still makes a readable file", () => {
    const backup = collectBackup(memory(), WHEN);
    expect(backup.items).toEqual({});
    expect(JSON.parse(backupText(backup))).toEqual({ ...backup });
  });

  test("and no store at all is not a crash", () => {
    expect(collectBackup(null, WHEN).items).toEqual({});
  });

  /**
   * Dated, and by the local day.
   *
   * The point of a backup is to take another one next month, and a folder
   * of files all called the same thing is a folder with one file in it.
   */
  test("the name says which day it was taken", () => {
    expect(backupFileName(new Date(2026, 7, 26, 14, 30))).toBe("mathemagicum-2026-08-26.json");
    expect(backupFileName(new Date(2026, 0, 5, 0, 1))).toBe("mathemagicum-2026-01-05.json");
  });
});

describe("reading a file back", () => {
  const good = {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    savedAt: WHEN,
    items: { [PROFILES_KEY]: "[]" },
  };

  test("a file this game wrote comes back whole", () => {
    const read = readBackup(JSON.parse(JSON.stringify(good)));
    expect(read?.items[PROFILES_KEY]).toBe("[]");
    expect(read?.savedAt).toBe(WHEN);
  });

  /**
   * And anything else is refused outright rather than half-read.
   *
   * The caller is about to empty a tablet with whatever comes back, so
   * there is no such thing as a partial answer here: a file with one key it
   * cannot make sense of is a file nobody should be asked to agree to.
   */
  test("and anything else is nothing at all", () => {
    expect(readBackup(null)).toBeNull();
    expect(readBackup("mathemagicum")).toBeNull();
    expect(readBackup([])).toBeNull();
    expect(readBackup({ ...good, kind: "something.else" })).toBeNull();
    expect(readBackup({ ...good, items: [] })).toBeNull();
    expect(readBackup({ ...good, items: { [PROFILES_KEY]: 7 } })).toBeNull();
  });

  /**
   * Including keys that are not this game's.
   *
   * A backup is a way of moving *this* game between devices, not a way of
   * putting arbitrary things into a browser's storage under its name.
   */
  test("a file carrying somebody else's keys is not a backup", () => {
    expect(readBackup({ ...good, items: { "somebody.else": "{}" } })).toBeNull();
  });

  /**
   * And a file from a newer game is refused rather than half-understood.
   *
   * It may hold keys this build has never heard of. Writing them puts the
   * device into a state only the newer game can open, which is a worse
   * outcome than being told to update.
   */
  test("a file from a later version is refused", () => {
    expect(readBackup({ ...good, version: BACKUP_VERSION + 1 })).toBeNull();
    expect(readBackup({ ...good, version: 0 })).toBeNull();
  });
});

describe("putting one back", () => {
  test("what was on the device goes, and what is in the file arrives", () => {
    const store = memory({
      [GAMES_KEY]: index("mine"),
      [gameKey("mine")]: '{"seed":1}',
      [PROFILES_KEY]: '[{"id":"here"}]',
    });
    const backup = readBackup({
      kind: BACKUP_KIND,
      version: BACKUP_VERSION,
      savedAt: WHEN,
      items: { [GAMES_KEY]: index("theirs"), [gameKey("theirs")]: '{"seed":2}' },
    });
    if (!backup) throw new Error("that was a backup");
    expect(restoreBackup(store, backup)).toBe(true);

    // The file's games are here...
    expect(store.getItem(gameKey("theirs"))).toBe('{"seed":2}');
    // ...and the device's own are gone rather than left behind unreachable:
    // the file's index does not name them, so anything kept would be a farm
    // nothing could ever open and nothing could ever delete.
    expect(store.getItem(gameKey("mine"))).toBeNull();
    expect(store.getItem(PROFILES_KEY)).toBeNull();
  });

  /**
   * A store that cannot forget cannot be imported onto, and says so.
   *
   * This is the one failure that would otherwise be invisible: the file's
   * list of games written over the device's own, with the worlds behind the
   * old list still sitting in the quota and no way to reach them.
   */
  test("a store that cannot forget is refused rather than half-written", () => {
    const held = new Map<string, string>([[PROFILES_KEY, '[{"id":"here"}]']]);
    const forgetful = {
      getItem: (key: string) => held.get(key) ?? null,
      setItem: (key: string, value: string) => {
        held.set(key, value);
      },
    };
    expect(canRestore(forgetful)).toBe(false);
    const backup = readBackup({
      kind: BACKUP_KIND,
      version: BACKUP_VERSION,
      savedAt: WHEN,
      items: { [PROFILES_KEY]: "[]" },
    });
    if (!backup) throw new Error("that was a backup");
    expect(restoreBackup(forgetful, backup)).toBe(false);
    // Untouched, which is the point.
    expect(held.get(PROFILES_KEY)).toBe('[{"id":"here"}]');
  });

  test("and no store at all is refused too", () => {
    expect(canRestore(null)).toBe(false);
  });

  /**
   * A backup taken and put straight back leaves the device as it was.
   *
   * The one property that covers both halves at once, and the only one that
   * would catch a key `collectBackup` reads and `restoreBackup` cannot
   * write, or the other way about.
   */
  test("taken and put back, a device is itself again", () => {
    const before: Record<string, string> = {
      [SETTINGS_KEY]: '{"language":"de"}',
      [PROFILES_KEY]: '[{"id":"kid"}]',
      [GAMES_KEY]: index("aaa", "bbb"),
      [PLAYING_KEY]: "aaa",
      [gameKey("aaa")]: '{"seed":1}',
      [gameKey("bbb")]: '{"seed":2}',
    };
    const taken = collectBackup(memory(before), WHEN);
    const onto = memory({ [PROFILES_KEY]: '[{"id":"somebody-else"}]' });
    const read = readBackup(JSON.parse(backupText(taken)));
    if (!read) throw new Error("that was a backup");
    expect(restoreBackup(onto, read)).toBe(true);
    for (const [key, value] of Object.entries(before)) {
      expect({ key, value: onto.getItem(key) }).toEqual({ key, value });
    }
  });
});
