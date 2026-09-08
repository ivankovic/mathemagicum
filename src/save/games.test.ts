// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { DEFAULT_AVATAR } from "../avatar/style";
import { Language, type SettingsStore } from "../settings";
import { DEFAULT_BAND } from "../spells/difficulty";
import { Spell } from "../spells/spellbook";
import { HOME_PLACE } from "../world/places";
import {
  GAMES_KEY,
  MAX_GAMES,
  OLD_SEED_KEY,
  OLD_WORLD_KEY,
  PLAYING_KEY,
  canAddGame,
  deleteGame,
  gameKey,
  listGames,
  loadGame,
  newGame,
  openGame,
  playingId,
  profileIn,
  setPlaying,
  withProgress,
  writeGame,
} from "./games";
import { type Player, type Profile, createProfile } from "./profiles";
import { GENERATOR_VERSION, SNAPSHOT_VERSION } from "./snapshot";

const CLOCK = new Date(2026, 0, 5, 9, 0, 0, 0).getTime();

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

const world = () => ({
  snapshotVersion: SNAPSHOT_VERSION,
  generatorVersion: GENERATOR_VERSION,
  seed: 7,
  savedAt: CLOCK,
  world: { crops: [], placed: [], cleared: [] },
  player: null,
});

describe("keeping several games", () => {
  test("a new game is made, indexed, and opened", () => {
    const store = memory();
    const game = newGame(store, 0.5, CLOCK);
    expect(listGames(store).map((entry) => entry.id)).toEqual([game.id]);
    expect(playingId(store)).toBe(game.id);
    expect(loadGame(store, game.id)?.seed).toBe(game.seed);
    // Its seed is settled from the moment it exists; its ground is not,
    // because nobody has walked in it.
    expect(game.world).toBeNull();
  });

  test("two games are two worlds", () => {
    const store = memory();
    const first = newGame(store, 0.11, CLOCK);
    const second = newGame(store, 0.83, CLOCK + 1000);
    expect(second.id).not.toBe(first.id);
    expect(second.seed).not.toBe(first.seed);
    expect(listGames(store).length).toBe(2);
    // Newest first: the games screen shows the one you were most likely in.
    expect(listGames(store)[0]?.id).toBe(second.id);
  });

  /**
   * The point of the whole file. There used to be one world and a button
   * that threw it away, which is not a save system.
   */
  test("starting another game leaves the first one where it was", () => {
    const store = memory();
    const first = newGame(store, 0.11, CLOCK);
    writeGame(store, { ...first, world: world(), savedAt: CLOCK + 10 });
    newGame(store, 0.83, CLOCK + 1000);
    expect(loadGame(store, first.id)?.world).not.toBeNull();
  });

  test("a device only keeps so many", () => {
    const store = memory();
    for (let n = 0; n < MAX_GAMES + 2; n++) newGame(store, 0.1 * (n + 1), CLOCK + n * 1000);
    expect(listGames(store).length).toBe(MAX_GAMES);
    expect(canAddGame(listGames(store))).toBe(false);
  });

  test("deleting one takes its body with it and moves on", () => {
    const store = memory();
    const first = newGame(store, 0.11, CLOCK);
    const second = newGame(store, 0.83, CLOCK + 1000);
    deleteGame(store, second.id);
    expect(store.getItem(gameKey(second.id))).toBeNull();
    expect(listGames(store).map((entry) => entry.id)).toEqual([first.id]);
    // The one that was open is gone, so something else has to be.
    expect(playingId(store)).toBe(first.id);
  });

  test("deleting the last one leaves nothing open, and the next open makes one", () => {
    const store = memory();
    const only = newGame(store, 0.11, CLOCK);
    deleteGame(store, only.id);
    expect(playingId(store)).toBeNull();
    const made = openGame(store, 0.42, CLOCK + 5000);
    expect(made.id).not.toBe(only.id);
    expect(playingId(store)).toBe(made.id);
  });
});

describe("opening one", () => {
  /**
   * Never nothing. The child's route through the game is title, who is
   * playing, garden — and a screen in the middle asking which world would be
   * a question they cannot answer. Choosing is an adult's business.
   */
  test("a device that has never been played gets a game on the spot", () => {
    const store = memory();
    const game = openGame(store, 0.42, CLOCK);
    expect(game.seed).toBeGreaterThan(0);
    expect(listGames(store).length).toBe(1);
  });

  test("otherwise the one that was open", () => {
    const store = memory();
    newGame(store, 0.11, CLOCK);
    const second = newGame(store, 0.83, CLOCK + 1000);
    setPlaying(store, second.id);
    expect(openGame(store, 0.5, CLOCK + 2000).id).toBe(second.id);
  });

  // A note pointing at a game somebody deleted from another tab, or a
  // storage key mangled by hand. Falling back to the newest beats refusing
  // to start.
  test("and the newest when that one has gone", () => {
    const store = memory();
    const first = newGame(store, 0.11, CLOCK);
    setPlaying(store, "g-nothing-here");
    expect(openGame(store, 0.5, CLOCK + 2000).id).toBe(first.id);
  });

  test("a mangled index does not stop the device starting", () => {
    const store = memory({ [GAMES_KEY]: "{not json", [PLAYING_KEY]: "g-nope" });
    expect(openGame(store, 0.42, CLOCK).seed).toBeGreaterThan(0);
  });
});

describe("a child in a game", () => {
  const mia = (): Profile =>
    createProfile(
      [],
      { name: "Mia", avatar: DEFAULT_AVATAR, language: Language.English, band: DEFAULT_BAND },
      CLOCK,
    );

  /**
   * The split this file exists for. Who a child *is* belongs to the device;
   * what they have *done* belongs to the game they did it in.
   */
  test("brings their own progress and leaves their face alone", () => {
    const store = memory();
    const game = newGame(store, 0.11, CLOCK);
    const played: Profile = { ...mia(), learned: [Spell.Portal], rung: 6 };
    const saved = withProgress(game, played, CLOCK + 10);
    writeGame(store, saved);

    const back = loadGame(store, game.id);
    if (!back) throw new Error("the game did not come back");
    const there = profileIn(back, splitOff(played));
    expect(there.learned).toEqual([Spell.Portal]);
    expect(there.rung).toBe(6);
    expect(there.name).toBe("Mia");
  });

  test("and starts again in a game they have not played", () => {
    const store = memory();
    const played: Profile = { ...mia(), learned: [Spell.Portal], rung: 6 };
    const first = newGame(store, 0.11, CLOCK);
    writeGame(store, withProgress(first, played, CLOCK + 10));
    const second = newGame(store, 0.83, CLOCK + 1000);

    const there = profileIn(second, splitOff(played));
    expect(there.learned).toEqual([]);
    expect(there.name).toBe("Mia");
    // Their band is theirs and comes with them: nothing about a new village
    // makes a six-year-old ready for three-digit sums.
    expect(there.band).toBe(played.band);
  });

  /**
   * And what the browser had under their row is read, not trusted.
   *
   * The players index has always been read field by field; the game body
   * was cast straight to `Progress`, so a rung of `"lots"` walked into a
   * running game and a spell nobody has heard of was one a child "knew".
   */
  test("and a mangled row is read against their band rather than believed", () => {
    const store = memory();
    const game = newGame(store, 0.11, CLOCK);
    const player = splitOff(mia());
    store.setItem(
      gameKey(game.id),
      JSON.stringify({
        ...game,
        progress: {
          [player.id]: { rung: "lots", learned: "portal", reached: 5, introSeen: "yes" },
          other: 4,
        },
      }),
    );

    const back = loadGame(store, game.id);
    if (!back) throw new Error("the game did not come back");
    expect(Object.keys(back.progress)).toEqual([player.id]);
    const there = profileIn(back, player);
    expect(Number.isInteger(there.rung)).toBe(true);
    expect(there.learned).toEqual([]);
    expect(there.reached).toEqual([HOME_PLACE]);
    expect(there.introSeen).toBe(false);
  });

  /**
   * The one path a returning child actually takes to the postman's letter.
   *
   * `newsSeen` is an index into a list that grows (see `ui/news.ts`), and
   * every save written before a beat was appended is missing the count
   * entirely — that is not a corrupt row, it is the normal row, and reading
   * it as nought is the whole of how anybody is ever told anything. A child
   * who has had the welcome and has never had a letter is owed every letter
   * there is, and this is the field that says so.
   *
   * The browser scenarios reach the letter through `?news`, which is a seam
   * and cannot prove this: they force it rather than being owed it.
   */
  test("a save from before the letters existed is owed all of them", () => {
    const store = memory();
    const game = newGame(store, 0.11, CLOCK);
    const player = splitOff(mia());
    store.setItem(
      gameKey(game.id),
      JSON.stringify({
        ...game,
        // A child part-way through the game as it stood: welcomed, and with
        // no idea there was ever going to be a letter.
        progress: { [player.id]: { introSeen: true } },
      }),
    );

    const back = loadGame(store, game.id);
    if (!back) throw new Error("the game did not come back");
    const there = profileIn(back, player);
    expect(there.introSeen).toBe(true);
    expect(there.newsSeen).toBe(0);
  });

  // And a count that is not a number does not become one by being written
  // down: `newsSeen` gates a panel that opens by itself, and `NaN < length`
  // is false, so a mangled row would quietly mean "tell them nothing ever
  // again" rather than "tell them everything".
  test("and a mangled count of letters reads as none read", () => {
    const store = memory();
    const game = newGame(store, 0.11, CLOCK);
    const player = splitOff(mia());
    store.setItem(
      gameKey(game.id),
      JSON.stringify({
        ...game,
        progress: { [player.id]: { introSeen: true, newsSeen: "lots" } },
      }),
    );

    const back = loadGame(store, game.id);
    if (!back) throw new Error("the game did not come back");
    expect(profileIn(back, player).newsSeen).toBe(0);
  });
});

/** The identity half of a profile, which is what a game is handed. */
function splitOff(profile: Profile): Player {
  const { id, name, avatar, language, lastPlayed, band, house } = profile;
  return { id, name, avatar, language, lastPlayed, band, house };
}

describe("the one world this device used to have", () => {
  /**
   * The standing permission to lose data while playtesting runs out here:
   * this is the change that says a save is worth keeping, so it has to keep
   * the one everybody is already playing.
   */
  test("becomes the first saved game, keys and all", () => {
    const store = memory({
      [OLD_SEED_KEY]: "4242",
      [OLD_WORLD_KEY]: JSON.stringify(world()),
    });
    const game = openGame(store, 0.5, CLOCK);
    expect(game.seed).toBe(4242);
    expect(game.world).not.toBeNull();
    expect(listGames(store).length).toBe(1);
    expect(playingId(store)).toBe(game.id);
    // The old keys go, so a device cannot be carried over twice.
    expect(store.getItem(OLD_WORLD_KEY)).toBeNull();
    expect(store.getItem(OLD_SEED_KEY)).toBeNull();
  });

  test("a seed with no world still comes across, because the world grows from it", () => {
    const store = memory({ [OLD_SEED_KEY]: "77" });
    expect(openGame(store, 0.5, CLOCK).seed).toBe(77);
  });

  // It runs when there are no games, and the first thing it does is make
  // one — so a second call has nothing to carry and nothing to overwrite.
  test("never runs twice", () => {
    const store = memory({ [OLD_SEED_KEY]: "4242" });
    const first = openGame(store, 0.5, CLOCK);
    const again = openGame(store, 0.9, CLOCK + 9999);
    expect(again.id).toBe(first.id);
    expect(listGames(store).length).toBe(1);
  });

  test("a device with nothing on it is left alone", () => {
    const store = memory();
    openGame(store, 0.5, CLOCK);
    expect(listGames(store).length).toBe(1);
  });
});
