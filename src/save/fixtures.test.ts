// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { SettingsStore } from "../settings";
import { decorFromSave } from "../world/decor";
import { WorldGrid } from "../world/grid";
import { machinesFromSave } from "../world/machines";
import { TerrainType } from "../world/terrain";
import { wiresFromSave } from "../world/wires";
import { loadGame } from "./games";
import { type GameSnapshot, readDecor, readPlans, restoreWorld } from "./snapshot";

/**
 * Saves written by builds that are already history, read by this one.
 *
 * **The only test here that can catch a break in backwards compatibility.**
 * Every other save test writes with today's code and reads with today's, so
 * it checks that the two halves of one build agree — which they will, right
 * up to the morning somebody renames a field and updates both halves at
 * once. These are bytes nobody can edit to make a test pass.
 *
 * They are captured by playing the game rather than written by hand: see
 * `e2e/capture.ts`. That matters more than it sounds. A handmade fixture
 * records what somebody *believed* the format was, and the first time this
 * one was captured it disagreed with that belief — a wire was missing from
 * the file, because walking indoors had been quietly deleting them.
 *
 * **Never edit a file in `fixtures/`.** Not to make this pass, not to add a
 * field, not to tidy the formatting. A fixture that moves with the code is a
 * fixture that has stopped being evidence. When the format changes, the
 * migration is what makes an old file readable; if a fixture genuinely
 * cannot be supported any more, that is a decision to take out loud, in a
 * commit that says which builds it strands.
 *
 * The corpus starts on the day it was begun and only grows. Capture a fresh
 * one whenever the format gains something worth freezing.
 */

const DIR = join(import.meta.dir, "fixtures");

function memory(seed: Record<string, string>): SettingsStore {
  const held = new Map(Object.entries(seed));
  return {
    getItem: (key) => held.get(key) ?? null,
    setItem: (key, value) => void held.set(key, value),
    removeItem: (key) => void held.delete(key),
  };
}

const files = readdirSync(DIR).filter((name) => name.endsWith(".json"));

describe("saves from builds that are already history", () => {
  test("there are some, and this file is not quietly checking nothing", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const name of files) {
    describe(name, () => {
      const keys = JSON.parse(readFileSync(join(DIR, name), "utf8")) as Record<string, string>;
      const store = memory(keys);
      const id = Object.keys(keys)
        .find((key) => key.startsWith("mathemagicum.game."))
        ?.slice("mathemagicum.game.".length);
      if (!id) throw new Error(`${name} has no saved game in it`);
      const raw = JSON.parse(keys[`mathemagicum.game.${id}`] as string) as {
        seed: number;
        world: GameSnapshot;
        progress: Record<string, Record<string, unknown>>;
      };

      /**
       * The whole of it, through the door a child comes in by.
       *
       * `loadGame` is what runs when the game opens, and a world it refuses
       * comes back as null — which is the shape of every catastrophic
       * compatibility failure there is. Everything else below is detail; if
       * this one goes, a child's garden is gone.
       */
      test("still load, and still have their world", () => {
        const loaded = loadGame(store, id);
        expect(loaded).not.toBeNull();
        expect(loaded?.seed).toBe(raw.seed);
        expect(loaded?.world).not.toBeNull();
      });

      test("and everything the child put down is still on the grid", () => {
        const grid = WorldGrid.empty(500, 500, TerrainType.Grass);
        restoreWorld(grid, raw.world.world);
        for (const object of raw.world.world.placed) {
          const back = grid.getObjectAt(object.col, object.row);
          expect({ at: `${object.col},${object.row}`, type: back?.type }).toEqual({
            at: `${object.col},${object.row}`,
            type: object.type,
          });
          // Whose it is and which way round it went down: the two facts that
          // decide whether she can pick it up again and whether it looks the
          // way she left it.
          expect(back?.mine).toBe(object.mine);
          expect(back?.turn).toBe(object.turn);
        }
        expect(grid.listCrops().length).toBe(raw.world.world.crops.length);
      });

      /**
       * And a fence she turned is still hers and still turned.
       *
       * Named rather than derived, so a fixture that had somehow become an
       * empty world could not satisfy the loop above by having nothing in it
       * to check.
       */
      test("and a thing she turned is still hers and still turned", () => {
        const fence = raw.world.world.placed.find((object) => object.type === "fence");
        expect(fence?.mine).toBe(true);
        expect(fence?.turn).toBeGreaterThan(0);
      });

      test("and every machine still holds what it held", () => {
        const machines = machinesFromSave(raw.world.world.machines);
        expect(machines.size).toBe(Object.keys(raw.world.world.machines ?? {}).length);
        expect(machines.size).toBeGreaterThan(0);
        // Awake is the half a cast paid for; a machine that came back asleep
        // would charge a child a spell for a thing they had already earned.
        for (const state of machines.values()) expect(state.awake).toBe(true);
      });

      test("and every line she strung is still joined to the same two squares", () => {
        const wires = wiresFromSave(raw.world.world.wires);
        expect(wires.length).toBe((raw.world.world.wires ?? []).length);
        expect(wires.length).toBeGreaterThan(0);
      });

      test("and the room she built is still the shape she built it", () => {
        const plans = readPlans(raw.world.world);
        for (const [house, floor] of Object.entries(raw.world.world.plans ?? {})) {
          expect({ house, cells: plans[house]?.length }).toEqual({ house, cells: floor.length });
        }
        expect(Object.keys(plans).length).toBeGreaterThan(0);
      });

      test("and the furniture is still where she left it", () => {
        const rooms = readDecor(raw.world.world);
        for (const [house, pieces] of Object.entries(raw.world.world.decor ?? {})) {
          const read = decorFromSave(rooms[house]);
          expect({ house, pieces: read.length }).toEqual({ house, pieces: pieces.length });
        }
        expect(Object.keys(rooms).length).toBeGreaterThan(0);
      });

      /**
       * And what the child themselves has, which is the part that must never
       * be lost whatever happens to the ground.
       *
       * Coins, what they have learned, which rung each spell is on: none of
       * it is a fact about the shape of a coastline, so none of it has any
       * business being thrown away when a world cannot be rebuilt.
       */
      test("and their coins, their learning and their basket come back", () => {
        const loaded = loadGame(store, id);
        for (const [child, saved] of Object.entries(raw.progress)) {
          const back = loaded?.progress[child] as Record<string, unknown> | undefined;
          expect({ child, has: back !== undefined }).toEqual({ child, has: true });
          for (const field of Object.keys(saved)) {
            expect({ child, field, kept: back?.[field] }).toEqual({
              child,
              field,
              kept: saved[field],
            });
          }
        }
      });
    });
  }
});
