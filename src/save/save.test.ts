// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";

/** A fixed wall-clock stamp, so a save is the same however long a test takes. */
const CLOCK = new Date(2026, 0, 5, 9, 0, 0, 0).getTime();
import { DEFAULT_AVATAR } from "../avatar/style";
import { Language, type SettingsStore } from "../settings";
import { BANDS, DEFAULT_BAND, HARDEST_RUNG, bandAt } from "../spells/difficulty";
import { HARDEST_ARRAY_RUNG } from "../spells/multiplication";
import { Spell, knowsSpell } from "../spells/spellbook";
import { Facing } from "../world/characters";
import { WorldGrid } from "../world/grid";
import { PlantStage, PlantType } from "../world/plants";
import { createRng } from "../world/rng";
import { GameSession } from "../world/session";
import { TerrainType } from "../world/terrain";
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
  restorePlayer,
  restoreWorld,
  snapshotGame,
  snapshotPlayer,
  worldBaseline,
} from "./snapshot";
import {
  LoadOutcome,
  deleteProfile,
  loadWorld,
  readProfiles,
  saveProfile,
  writeWorld,
} from "./store";
import { WORLD_KEY, WORLD_SEED_KEY, deviceSeed, forgetWorld, worldSeed } from "./world";

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
    introSeen: false,
    band: DEFAULT_BAND,
    rung: HARDEST_RUNG,
    portalRung: 0,
    arrayRung: 0,
    clockRung: 0,
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

  // The array ladder is two rungs shorter than the other two, and the bands
  // are indexed against the longer one — so the hardest band's floor sits at
  // the top of this ladder and a saved number past its end has to come back
  // as its end rather than as whatever the addition ladder would allow.
  test("the array rung is clamped against its own ladder, not the sums'", () => {
    const top = { ...made(), band: 3, arrayRung: 9 };
    expect(readProfile(JSON.parse(JSON.stringify(top)))?.arrayRung).toBe(HARDEST_ARRAY_RUNG);
    const hardest = createProfile(
      [],
      { name: "Ada", avatar: DEFAULT_AVATAR, language: Language.English, band: 3 },
      1,
    );
    expect(hardest.arrayRung).toBe(HARDEST_ARRAY_RUNG);
  });

  // A corrupt number reads as "we do not know where this child was", which
  // is their band's floor — not as "start them on doubles". The same
  // fallback the other two ladders use, and it has to be, or a mangled save
  // would quietly drop a nine-year-old to two times two.
  test("a corrupt array rung falls back to the band's floor", () => {
    const mangled = { ...made(), arrayRung: "banana" };
    expect(readProfile(JSON.parse(JSON.stringify(mangled)))?.arrayRung).toBe(bandAt(1).from);
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
    writeWorld(store, snapshotGame(grid, new Map(), 99, CLOCK));
    expect(store.getItem(WORLD_KEY)).not.toBeNull();

    deleteProfile(store, mia.id);
    expect(readProfiles(store)).toEqual([]);
    expect(loadWorld(store).snapshot?.world.crops.length).toBe(1);
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

describe("loading a world the generator has moved on from", () => {
  test("nothing saved yet is a fresh world, not an error", () => {
    expect(loadWorld(memory()).outcome).toBe(LoadOutcome.Fresh);
    expect(loadWorld(null).outcome).toBe(LoadOutcome.Fresh);
  });

  test("a save from this generator is restored", () => {
    const store = memory();
    writeWorld(store, snapshotGame(world(), new Map(), 99, CLOCK));
    const loaded = loadWorld(store);
    expect(loaded.outcome).toBe(LoadOutcome.Restored);
    expect(loaded.snapshot?.generatorVersion).toBe(GENERATOR_VERSION);
  });

  // A fence saved against a coastline that has since moved comes back inside
  // a rock, so the ground is rebuilt. Nothing about any child is at risk —
  // their purses and baskets live on their profiles and were never in here.
  test("a save from an older generator drops the farm and nothing else", () => {
    const grid = world();
    grid.plant(2, 2, PlantType.Carrot);
    const stale = {
      ...snapshotGame(grid, new Map(), 99, CLOCK),
      generatorVersion: GENERATOR_VERSION - 1,
    };
    const store = memory({ [WORLD_KEY]: JSON.stringify(stale) });

    const loaded = loadWorld(store);
    expect(loaded.outcome).toBe(LoadOutcome.Rebuilt);
    expect(loaded.snapshot).toBeNull();
    // Nothing in a world file describes a person any more, so there is
    // nothing here that a rebuild could take away from one.
    expect(Object.keys(loaded).sort()).toEqual(["outcome", "snapshot"]);
  });
});

describe("one world, shared", () => {
  const child = (name: string, at: number) =>
    createProfile(
      [],
      { name, avatar: DEFAULT_AVATAR, language: Language.English, band: DEFAULT_BAND },
      at,
    );

  // The point of the whole change: a crop one child plants is a crop the
  // other can pick, because they are standing in the same field.
  test("what one child plants, the next child finds", () => {
    const store = memory();
    const ana = child("Ana", 1);
    const bo = child("Bo", 2);

    // Ana plays: plants two carrots and puts a fence down.
    const grid = world();
    const baseline = worldBaseline(grid);
    grid.plant(3, 3, PlantType.Carrot);
    grid.plant(4, 3, PlantType.Carrot);
    grid.placeObject(fence(5, 5));
    writeWorld(store, snapshotGame(grid, baseline, 99, CLOCK));

    // Bo plays: the same ground, generated from the same seed.
    const bosGrid = world();
    restoreWorld(bosGrid, loadWorld(store).snapshot?.world);
    expect(bosGrid.getCrop(3, 3)?.plant).toBe(PlantType.Carrot);
    expect(bosGrid.getObjectAt(5, 5)?.type).toBe("fence");
    expect(ana.id).not.toBe(bo.id);
  });

  // The half that is *not* shared, and the reason it is not: a shared purse
  // would let one child spend what another earned.
  test("but not what one child is carrying", () => {
    const grid = world();
    const ana = sessionOn(grid);
    ana.purse.earn(500);
    ana.inventory.add(PlantType.Carrot, 3);

    const anas = snapshotPlayer(ana, ana.tile);
    const bo = sessionOn(grid);
    restorePlayer(bo, null);

    expect(anas.coins).toBe(500);
    expect(bo.purse.coins).toBe(0);
    expect(bo.inventory.total).toBe(0);
  });

  test("a world file describes ground, and nothing about anybody", () => {
    const grid = world();
    grid.plant(1, 1, PlantType.Carrot);
    const saved = snapshotGame(grid, worldBaseline(grid), 99, CLOCK);
    // `savedAt` is *when the ground was written*, not a fact about a child —
    // which is exactly why it belongs here rather than on the profile, where
    // "when did they stop" is not something `lastPlayed` can answer.
    expect(Object.keys(saved).sort()).toEqual([
      "generatorVersion",
      "savedAt",
      "seed",
      "snapshotVersion",
      "world",
    ]);
    expect(saved.savedAt).toBe(CLOCK);
  });
});

describe("the device's world number", () => {
  test("is minted once and then never reissued", () => {
    const store = memory();
    const first = deviceSeed(store, 0.3);
    expect(first).toBeGreaterThan(0);
    // A game that minted one per session would give each child a different
    // village and call it shared.
    for (const draw of [0.9, 0.1, 0.5]) expect(deviceSeed(store, draw)).toBe(first);
    expect(store.getItem(WORLD_SEED_KEY)).toBe(String(first));
  });

  test("is always a usable positive number", () => {
    const rng = createRng(7);
    for (let i = 0; i < 200; i++) {
      const seed = worldSeed(rng());
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThan(0);
    }
    expect(worldSeed(0)).toBeGreaterThan(0);
  });

  test("with no storage, the game still gets a world", () => {
    expect(deviceSeed(null, 0.42)).toBeGreaterThan(0);
  });

  test("rubbish in storage is replaced rather than played", () => {
    const store = memory({ [WORLD_SEED_KEY]: "not a number" });
    expect(deviceSeed(store, 0.42)).toBeGreaterThan(0);
  });

  /**
   * A new world starts everybody from scratch.
   *
   * Keeping the spells was tried and reversed: a new world with the array
   * spell already in it is not a new world — the great tree has nothing left
   * to ask, and the first afternoon of the game cannot happen twice on one
   * device.
   *
   * What survives is who the child *is*, not what they did. The band is on
   * that side of the line: nothing about a fresh village makes a six-year-old
   * ready for three-digit sums.
   */
  test("a new world starts everybody again, but nobody has to be made twice", () => {
    const played = {
      ...createProfile(
        [],
        { name: "Mia", avatar: DEFAULT_AVATAR, language: Language.German, band: 0 },
        1000,
      ),
      introSeen: true,
      rung: HARDEST_RUNG,
      portalRung: 7,
      arrayRung: HARDEST_ARRAY_RUNG,
      clockRung: 4,
      reached: ["village", "harbour", "observatory"],
      learned: [Spell.Portal, Spell.Array, Spell.Hourglass],
      carried: null,
    };
    const again = freshStart(played);

    // Who they are.
    expect({ id: again.id, name: again.name, language: again.language, band: again.band }).toEqual({
      id: played.id,
      name: played.name,
      language: played.language,
      band: played.band,
    });
    expect(again.avatar).toEqual(played.avatar);

    // What they did.
    expect(knowsSpell(again.learned, Spell.Portal)).toBe(false);
    expect(knowsSpell(again.learned, Spell.Array)).toBe(false);
    expect(again.reached).toEqual(["village"]);
    expect(again.rung).toBe(bandAt(played.band).from);
    expect(again.portalRung).toBe(bandAt(played.band).from);
    expect(again.carried).toBeNull();
    // And the postman walks them through it again, because it is again.
    expect(again.introSeen).toBe(false);
  });

  // Throwing the seed away without the difference beside it would lay one
  // child's fences over a coastline that has moved.
  test("forgetting a world forgets both halves of it", () => {
    const store = memory();
    deviceSeed(store, 0.3);
    writeWorld(store, snapshotGame(world(), new Map(), 99, CLOCK));
    forgetWorld(store);
    expect(store.getItem(WORLD_SEED_KEY)).toBeNull();
    expect(loadWorld(store).outcome).toBe(LoadOutcome.Fresh);
  });
});
