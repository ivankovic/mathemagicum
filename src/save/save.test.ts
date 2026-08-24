// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";

/** A fixed wall-clock stamp, so a save is the same however long a test takes. */
const CLOCK = new Date(2026, 0, 5, 9, 0, 0, 0).getTime();
import { DEFAULT_AVATAR } from "../avatar/style";
import { Language, type SettingsStore } from "../settings";
import { BANDS, DEFAULT_BAND, HARDEST_RUNG, bandAt, bandOn } from "../spells/difficulty";
import { HARDEST_ARRAY_RUNG } from "../spells/multiplication";
import { Spell, knowsSpell } from "../spells/spellbook";
import { Facing } from "../world/characters";
import { WorldGrid } from "../world/grid";
import { PlantStage, PlantType } from "../world/plants";
import { createRng } from "../world/rng";
import { GameSession } from "../world/session";
import { TerrainType } from "../world/terrain";
import { loadGame, newGame, writeGame } from "./games";
import {
  MAX_PROFILES,
  NAME_MAX,
  type Profile,
  byRecency,
  canAddProfile,
  createProfile,
  findProfile,
  freshStart,
  isUsableName,
  readProfile,
  replaceProfile,
  tidyName,
  withoutProfile,
} from "./profiles";
import {
  GENERATOR_VERSION,
  readPlans,
  restorePlayer,
  restoreWorld,
  snapshotGame,
  snapshotPlayer,
  worldBaseline,
} from "./snapshot";
import { deleteProfile, readProfiles, saveProfile } from "./store";

function memory(seed: Record<string, string> = {}): SettingsStore {
  const held = new Map(Object.entries(seed));
  return {
    getItem: (key) => held.get(key) ?? null,
    setItem: (key, value) => void held.set(key, value),
    removeItem: (key) => void held.delete(key),
  };
}

function world(): WorldGrid {
  return WorldGrid.empty(12, 12, TerrainType.Grass);
}

function sessionOn(grid: WorldGrid): GameSession {
  return new GameSession({ grid, start: { col: 3, row: 3 } });
}

function fence(col: number, row: number) {
  return {
    id: `fence-${col}-${row}`,
    type: "fence",
    col,
    row,
    width: 1,
    height: 1,
    blocksMovement: true,
    anchorCol: col,
    anchorRow: row,
  };
}

describe("naming a player", () => {
  test("a typed name is tidied, not argued with", () => {
    expect(tidyName("  Mia   Rose ")).toBe("Mia Rose");
    expect(tidyName("Ana-Marija")).toBe("Ana-Marija");
    expect(tidyName("Jörg")).toBe("Jörg");
  });

  test("a name too long for the face it sits under is cut to fit", () => {
    expect(tidyName("x".repeat(40)).length).toBe(NAME_MAX);
  });

  test("only an empty name is refused", () => {
    expect(isUsableName("   ")).toBe(false);
    expect(isUsableName("A")).toBe(true);
    // Two children called Alex is a real situation, not an error.
    expect(isUsableName("Alex")).toBe(true);
  });
});

describe("creating a player", () => {
  const wanted = {
    name: "Mia",
    avatar: DEFAULT_AVATAR,
    language: Language.German,
    band: DEFAULT_BAND,
  };

  test("gets an id, a language and the time they were made", () => {
    const mia = createProfile([], wanted, 1000);
    expect(mia.name).toBe("Mia");
    expect(mia.language).toBe(Language.German);
    expect(mia.lastPlayed).toBe(1000);
    expect(mia.carried).toBeNull();
  });

  // The children asked to share, so two profiles made at the same moment are
  // two people — not two worlds.
  test("two children made at the same moment are still two people", () => {
    const first = createProfile([], wanted, 1000);
    const second = createProfile([first], wanted, 1000);
    expect(second.id).not.toBe(first.id);
  });

  test("a device only holds so many children", () => {
    let profiles: readonly Profile[] = [];
    for (let i = 0; i < MAX_PROFILES; i++) {
      expect(canAddProfile(profiles)).toBe(true);
      profiles = [...profiles, createProfile(profiles, wanted, 1000 + i)];
    }
    // Past the screen's capacity is a refusal, not a ninth face nobody can
    // reach.
    expect(canAddProfile(profiles)).toBe(false);
    expect(() => createProfile(profiles, wanted, 9999)).toThrow();
  });

  test("ids stay unique even when the clock does not move", () => {
    let profiles: readonly Profile[] = [];
    for (let i = 0; i < MAX_PROFILES; i++) {
      profiles = [...profiles, createProfile(profiles, wanted, 1000 + i)];
    }
    expect(new Set(profiles.map((p) => p.id)).size).toBe(MAX_PROFILES);
  });
});

describe("the list of players", () => {
  const make = (id: string, lastPlayed: number): Profile => ({
    id,
    name: id,
    avatar: DEFAULT_AVATAR,
    language: Language.English,
    lastPlayed,
    house: 0,
    introSeen: false,
    band: DEFAULT_BAND,
    rung: HARDEST_RUNG,
    portalRung: 0,
    arrayRung: 0,
    clockRung: 0,
    clockOffset: 0,
    symmetryRung: 0,
    brickRung: 0,
    reached: ["village"],
    learned: [],
    carried: null,
  });

  test("the child who played last is offered first", () => {
    const sorted = byRecency([make("a", 10), make("b", 50), make("c", 30)]);
    expect(sorted.map((p) => p.id)).toEqual(["b", "c", "a"]);
  });

  test("replacing keeps position rather than shuffling the screen", () => {
    const list = [make("a", 1), make("b", 2), make("c", 3)];
    const updated = replaceProfile(list, { ...make("b", 99) });
    expect(updated.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(updated[1]?.lastPlayed).toBe(99);
  });

  test("replacing someone unknown adds them", () => {
    expect(replaceProfile([make("a", 1)], make("z", 1)).length).toBe(2);
  });

  test("removing and finding", () => {
    const list = [make("a", 1), make("b", 2)];
    expect(withoutProfile(list, "a").map((p) => p.id)).toEqual(["b"]);
    expect(findProfile(list, "b")?.id).toBe("b");
    expect(findProfile(list, "nobody")).toBeNull();
    expect(findProfile(list, null)).toBeNull();
  });
});

describe("what the portal spell remembers about a child", () => {
  const made = () =>
    createProfile(
      [],
      { name: "Mia", avatar: DEFAULT_AVATAR, language: Language.English, band: 1 },
      1000,
    );

  // A spell whose first cast has nowhere to go is a spell that looks broken.
  test("a new player has been home and nowhere else", () => {
    expect(made().reached).toEqual(["village"]);
  });

  // Its own number: measuring a map and adding on a number line are
  // different skills, and one rung between them would drop a child who is
  // good at sums straight into squaring numbers.
  test("the portal starts at the bottom of the band, apart from the sums", () => {
    const mia = made();
    expect(mia.portalRung).toBe(bandAt(1).from);
    expect(mia.portalRung).toBe(mia.rung);
    // And they move independently from there.
    const later = { ...mia, rung: 9 };
    expect(readProfile(JSON.parse(JSON.stringify(later)))?.portalRung).toBe(mia.portalRung);
  });

  test("both survive a round trip through storage", () => {
    const store = memory();
    const mia = { ...made(), portalRung: 6, reached: ["village", "harbour"] };
    saveProfile(store, mia);
    expect(readProfiles(store)).toEqual([mia]);
  });

  // The array ladder is four rungs shorter than the sums', and the bands are
  // counted in addition rungs — so a band has to be *scaled* onto it rather
  // than truncated against its end. A saved number past its end still comes
  // back as its end, whatever the addition ladder would have allowed.
  test("the array rung is scaled onto its own ladder, not the sums'", () => {
    const top = { ...made(), band: 3, arrayRung: 9 };
    expect(readProfile(JSON.parse(JSON.stringify(top)))?.arrayRung).toBe(HARDEST_ARRAY_RUNG);
  });

  // Truncation used to open the hardest band on the last rung of this ladder,
  // so a nine-year-old's first ever cast was the bare times table and there
  // was nothing above it to climb to. Scaled, they open partway up with room
  // in both directions — which is what "the bottom of their band" meant all
  // along.
  test("and a new child opens partway up it, with somewhere left to climb", () => {
    const hardest = createProfile(
      [],
      { name: "Ada", avatar: DEFAULT_AVATAR, language: Language.English, band: 3 },
      1,
    );
    const fence = bandOn(bandAt(3), HARDEST_ARRAY_RUNG);
    expect(hardest.arrayRung).toBe(fence.from);
    expect(hardest.arrayRung).toBeLessThan(HARDEST_ARRAY_RUNG);
  });

  // A corrupt number reads as "we do not know where this child was", which
  // is their band's floor — not as "start them on doubles". The same
  // fallback the other two ladders use, and it has to be, or a mangled save
  // would quietly drop a nine-year-old to two times two.
  test("a corrupt array rung falls back to the band's floor", () => {
    const mangled = { ...made(), arrayRung: "banana" };
    const floor = bandOn(bandAt(1), HARDEST_ARRAY_RUNG).from;
    expect(readProfile(JSON.parse(JSON.stringify(mangled)))?.arrayRung).toBe(floor);
  });

  // A child saved before the portal existed has never cast it.
  test("a save from before the spell starts it at the band's floor", () => {
    const { portalRung, reached, ...older } = made();
    const read = readProfile(JSON.parse(JSON.stringify(older)));
    expect(read?.portalRung).toBe(bandAt(1).from);
    expect(read?.reached).toEqual(["village"]);
  });

  // The anchors are a fixed set, so a name that is not one of them can only
  // come from a different build — and home is added whatever the save said,
  // so a mangled entry cannot leave a child with a spell that has nowhere
  // to go.
  test("an unknown place is dropped and home is always there", () => {
    const mangled = { ...made(), reached: ["atlantis", "harbour", 7] };
    const read = readProfile(JSON.parse(JSON.stringify(mangled)));
    expect(read?.reached).toEqual(["village", "harbour"]);
    expect(
      readProfile(JSON.parse(JSON.stringify({ ...made(), reached: "nowhere" })))?.reached,
    ).toEqual(["village"]);
  });
});

describe("reading a player back", () => {
  test("what was written comes back", () => {
    const store = memory();
    const mia = createProfile(
      [],
      { name: "Mia", avatar: DEFAULT_AVATAR, language: Language.German, band: DEFAULT_BAND },
      5,
    );
    saveProfile(store, mia);
    expect(readProfiles(store)).toEqual([mia]);
  });

  // One bad entry must not cost the other children their farms.
  test("a broken entry is dropped and the rest survive", () => {
    const good = createProfile(
      [],
      { name: "Ana", avatar: DEFAULT_AVATAR, language: Language.English, band: DEFAULT_BAND },
      5,
    );
    const store = memory({
      "mathemagicum.players": JSON.stringify([{ id: "", name: "x" }, good, null, 7]),
    });
    expect(readProfiles(store).map((p) => p.name)).toEqual(["Ana"]);
  });

  // Two faces sharing one world means whichever is tapped second overwrites
  // the first, silently.
  test("a duplicated id keeps only the first", () => {
    const one = createProfile(
      [],
      { name: "Ana", avatar: DEFAULT_AVATAR, language: Language.English, band: DEFAULT_BAND },
      5,
    );
    const store = memory({
      "mathemagicum.players": JSON.stringify([one, { ...one, name: "Bo" }]),
    });
    expect(readProfiles(store).map((p) => p.name)).toEqual(["Ana"]);
  });

  test("a profile that lost a field is still a child with a farm", () => {
    const read = readProfile({ id: "p1", name: "Bo" });
    expect(read?.language).toBe(Language.English);
    expect(read?.avatar).toEqual(DEFAULT_AVATAR);
  });

  test("a profile with no name at all is not a player", () => {
    expect(readProfile({ id: "p1", name: "   " })).toBeNull();
    expect(readProfile({ name: "Bo" })).toBeNull();
    expect(readProfile("Bo")).toBeNull();
  });

  test("no storage means no players rather than a crash", () => {
    expect(readProfiles(null)).toEqual([]);
    expect(readProfiles(memory({ "mathemagicum.players": "{not json" }))).toEqual([]);
  });
});

describe("deleting a player", () => {
  // It used to take their world with them, because the world was theirs.
  // The children asked to share, so a garden outlives the child who planted
  // it — and the last player leaving does not take the village too.
  test("leaves the world exactly where it is", () => {
    const store = memory();
    const mia = createProfile(
      [],
      { name: "Mia", avatar: DEFAULT_AVATAR, language: Language.English, band: DEFAULT_BAND },
      5,
    );
    saveProfile(store, mia);
    const grid = world();
    grid.plant(2, 2, PlantType.Carrot);
    const game = newGame(store, 0.25, CLOCK);
    writeGame(store, { ...game, world: snapshotGame(grid, new Map(), 99, CLOCK) });

    deleteProfile(store, mia.id);
    expect(readProfiles(store)).toEqual([]);
    // The garden is the game's, not hers. The last child leaving does not
    // take the village with them.
    expect(loadGame(store, game.id)?.world?.world.crops.length).toBe(1);
  });

  test("a store that cannot forget still loses the player from the list", () => {
    const held = new Map<string, string>();
    const forgetful: SettingsStore = {
      getItem: (key) => held.get(key) ?? null,
      setItem: (key, value) => void held.set(key, value),
    };
    const mia = createProfile(
      [],
      { name: "Mia", avatar: DEFAULT_AVATAR, language: Language.English, band: DEFAULT_BAND },
      5,
    );
    saveProfile(forgetful, mia);
    expect(deleteProfile(forgetful, mia.id)).toEqual([]);
  });
});

describe("a world written down and put back", () => {
  test("crops come back where they were and as grown as they were", () => {
    const grid = world();
    const session = sessionOn(grid);
    const baseline = worldBaseline(grid);
    grid.plant(4, 4, PlantType.Carrot);
    grid.growCrop(4, 4);
    grid.plant(5, 4, PlantType.Wheat);

    const saved = snapshotGame(grid, baseline, 99, CLOCK);
    const fresh = world();
    restoreWorld(fresh, saved.world);
    expect(fresh.getCrop(4, 4)).toEqual(grid.getCrop(4, 4));
    expect(fresh.getCrop(5, 4)).toEqual(grid.getCrop(5, 4));
    expect(fresh.getCrop(0, 0)).toBeNull();
  });

  // What the player put down is theirs; what the generator put down comes
  // back from the seed and must not be written twice.
  test("only what the player added is saved", () => {
    const grid = world();
    grid.placeObject(fence(1, 1)); // generated
    const baseline = worldBaseline(grid);
    grid.placeObject(fence(6, 6)); // bought and placed

    const saved = snapshotGame(grid, baseline, 99, CLOCK);
    expect(saved.world.placed.map((o) => o.id)).toEqual(["fence-6-6"]);
    expect(saved.world.cleared).toEqual([]);
  });

  // Occupied before and occupied after, but not by the same thing. A check
  // for whether a tile has something on it records no change here at all,
  // and the world reloads with the generator's fence back and the bought one
  // gone.
  test("swapping a generated thing for a bought one is a change", () => {
    const grid = world();
    grid.placeObject({ ...fence(1, 1), type: "well" });
    const baseline = worldBaseline(grid);
    grid.removeObjectAt(1, 1);
    grid.placeObject(fence(1, 1));

    const saved = snapshotGame(grid, baseline, 99, CLOCK);
    expect(saved.world.cleared).toEqual([[1, 1]]);
    expect(saved.world.placed.map((o) => o.type)).toEqual(["fence"]);

    const fresh = world();
    fresh.placeObject({ ...fence(1, 1), type: "well" });
    restoreWorld(fresh, saved.world);
    expect(fresh.getObjectAt(1, 1)?.type).toBe("fence");
  });

  test("a generated thing the player took away stays away", () => {
    const grid = world();
    grid.placeObject(fence(1, 1));
    const baseline = worldBaseline(grid);
    grid.removeObjectAt(1, 1);

    const saved = snapshotGame(grid, baseline, 99, CLOCK);
    expect(saved.world.cleared).toEqual([[1, 1]]);

    const fresh = world();
    fresh.placeObject(fence(1, 1));
    restoreWorld(fresh, saved.world);
    expect(fresh.getObjectAt(1, 1)).toBeNull();
  });

  test("the purse, the basket and where she was standing all come back", () => {
    const grid = world();
    const session = sessionOn(grid);
    session.purse.earn(1234);
    session.inventory.add(PlantType.Carrot, 5);
    session.inventory.add(PlantType.Tomato, 2);
    session.setPosition(7, 8);
    session.face(Facing.Left);

    const carried = snapshotPlayer(session, session.tile);
    const revived = sessionOn(world());
    restorePlayer(revived, carried);

    expect(revived.tile).toEqual({ col: 7, row: 8 });
    expect(revived.facing).toBe(Facing.Left);
    expect(revived.purse.coins).toBe(1234);
    expect(revived.inventory.count(PlantType.Carrot)).toBe(5);
    expect(revived.inventory.count(PlantType.Tomato)).toBe(2);
  });

  // The property everything else rests on: play a world, save it, put it
  // back, and be unable to tell the difference.
  test("a played world survives the round trip whole", () => {
    const grid = world();
    const session = sessionOn(grid);
    // Some of the world is the generator's, so the walk below has generated
    // things to take away as well as bought things to put down — without
    // these the `cleared` half of a snapshot never runs.
    for (let row = 0; row < grid.height; row += 2) {
      for (let col = 0; col < grid.width; col += 3) grid.placeObject(fence(col, row));
    }
    const baseline = worldBaseline(grid);
    const rng = createRng(11);
    const plants = [PlantType.Carrot, PlantType.Wheat, PlantType.Pepper, PlantType.Tomato];

    for (let step = 0; step < 200; step++) {
      const col = Math.floor(rng() * grid.width);
      const row = Math.floor(rng() * grid.height);
      const roll = rng();
      if (roll < 0.5) grid.plant(col, row, plants[step % plants.length] as PlantType);
      else if (roll < 0.7) grid.growCrop(col, row);
      else if (roll < 0.8) grid.harvestCrop(col, row);
      else if (roll < 0.9) grid.placeObject(fence(col, row));
      else grid.removeObjectAt(col, row);
    }
    session.purse.earn(4321);
    session.inventory.add(PlantType.Sunflower, 3);
    session.setPosition(2, 9);

    const saved = snapshotGame(grid, baseline, 99, CLOCK);
    expect(saved.world.crops.length).toBeGreaterThan(10);
    expect(saved.world.placed.length).toBeGreaterThan(3);
    expect(saved.world.cleared.length).toBeGreaterThan(0);

    // A fresh world is the generator's output, not a blank one: restoring is
    // laying a diff over a world that already has things in it.
    const fresh = world();
    for (let row = 0; row < fresh.height; row += 2) {
      for (let col = 0; col < fresh.width; col += 3) fresh.placeObject(fence(col, row));
    }
    const revived = sessionOn(fresh);
    restoreWorld(fresh, saved.world);
    restorePlayer(revived, snapshotPlayer(session, session.tile));

    for (let row = 0; row < grid.height; row++) {
      for (let col = 0; col < grid.width; col++) {
        expect({ col, row, crop: fresh.getCrop(col, row) }).toEqual({
          col,
          row,
          crop: grid.getCrop(col, row),
        });
        expect({ col, row, object: fresh.getObjectAt(col, row)?.id ?? null }).toEqual({
          col,
          row,
          object: grid.getObjectAt(col, row)?.id ?? null,
        });
      }
    }
    expect(revived.tile).toEqual(session.tile);
    expect(revived.purse.coins).toBe(session.purse.coins);
    expect(revived.inventory.entries()).toEqual(session.inventory.entries());
  });

  // A room cell is a perfectly plausible world tile, so this one cannot be
  // caught by a bounds check — only by never reading the indoor position.
  test("saving while she is inside a building records the tile outside it", () => {
    const grid = world();
    const session = sessionOn(grid);
    session.indoors = true;
    session.setPosition(2, 1); // a cell of the shop, not of the world
    const doorstep = { col: 9, row: 10 };

    const carried = snapshotPlayer(session, doorstep);
    expect(carried.col).toBe(9);
    expect(carried.row).toBe(10);

    const revived = sessionOn(world());
    restorePlayer(revived, carried);
    expect(revived.tile).toEqual(doorstep);
  });

  test("saving twice in a row writes the same thing", () => {
    const grid = world();
    const session = sessionOn(grid);
    const baseline = worldBaseline(grid);
    grid.plant(2, 2, PlantType.Carrot);
    const once = snapshotGame(grid, baseline, 99, CLOCK);
    expect(snapshotGame(grid, baseline, 99, CLOCK)).toEqual(once);
  });
});

describe("a save that no longer fits its world", () => {
  const grid = () => WorldGrid.empty(6, 6, TerrainType.Grass);

  test("rubbish in a save costs the tile, not the load", () => {
    const fresh = grid();
    expect(() =>
      restoreWorld(fresh, {
        crops: [
          [99, 99, PlantType.Carrot, PlantStage.Seedling],
          [1, 1, "banana" as PlantType, PlantStage.Seedling],
          [2, 2, PlantType.Carrot, "enormous" as PlantStage],
        ],
        placed: [{ id: "x" } as never, fence(3, 3)],
        cleared: [[999, 999]],
      }),
    ).not.toThrow();
    expect(fresh.getCrop(1, 1)).toBeNull();
    expect(fresh.getCrop(2, 2)).toBeNull();
    expect(fresh.getObjectAt(3, 3)?.id).toBe("fence-3-3");
  });

  test("a half-written save restores nothing rather than throwing", () => {
    const fresh = grid();
    expect(() => restoreWorld(fresh, {} as never)).not.toThrow();
    expect(() => restorePlayer(sessionOn(fresh), undefined)).not.toThrow();
  });

  test("a player from off the map is left where the game put them", () => {
    const session = sessionOn(grid());
    restorePlayer(session, { col: 500, row: 500, facing: Facing.Up, coins: 0, items: [] });
    expect(session.tile).toEqual({ col: 3, row: 3 });
  });

  test("negative coins and impossible items are not restored", () => {
    const session = sessionOn(grid());
    restorePlayer(session, {
      col: 1,
      row: 1,
      facing: "sideways" as never,
      coins: -50,
      items: [
        [PlantType.Carrot, -2],
        ["gold-bar" as never, 5],
        [PlantType.Wheat, 1.5],
      ],
    });
    expect(session.purse.coins).toBe(0);
    expect(session.inventory.total).toBe(0);
    expect(session.facing).toBe(Facing.Down);
  });
});

describe("what a house somebody built out remembers", () => {
  const store = memory();

  // The plan lives with the *world* rather than with the child, and this is
  // why: two siblings on one tablet own different cottages in one village,
  // and a plan kept on the player would put sister's extension in brother's
  // house the moment he walked into his own.
  test("a plan survives a round trip through storage", () => {
    const grid = WorldGrid.empty(8, 8, TerrainType.Grass);
    const plans = { "player-house": ["1,1", "2,1", "3,0"] };
    const snapshot = snapshotGame(grid, new Map(), 7, 1000, plans);
    expect(snapshot.world.plans).toEqual(plans);
    const read = JSON.parse(JSON.stringify(snapshot)) as typeof snapshot;
    expect(readPlans(read.world)).toEqual(plans);
  });

  // A cottage nobody has touched is the cottage the generator shipped.
  // Writing that down every autosave would be storing the absence of news.
  test("a house nobody has changed writes nothing at all", () => {
    const snapshot = snapshotGame(WorldGrid.empty(4, 4, TerrainType.Grass), new Map(), 7, 1);
    expect(snapshot.world.plans).toBeUndefined();
    expect(readPlans(snapshot.world)).toEqual({});
  });

  // One mangled house must not take the other three with it. What a child
  // loses is an extension; what they keep is a cottage they can build again.
  test("a mangled plan is dropped, and the houses beside it are not", () => {
    const world = {
      crops: [],
      placed: [],
      cleared: [],
      plans: {
        good: ["1,1", "-2,-3"],
        rubbish: ["not a cell", ""],
        empty: [],
        wrong: "1,1",
      },
    } as unknown as Parameters<typeof readPlans>[0];
    expect(readPlans(world)).toEqual({ good: ["1,1", "-2,-3"] });
  });

  // Every save written before anybody could build has no plans in it, and
  // has to go on loading rather than opening on a house with no walls.
  test("a save from before any of this reads as nobody having built", () => {
    expect(readPlans(undefined)).toEqual({});
    expect(readPlans({ crops: [], placed: [], cleared: [] })).toEqual({});
  });
});
