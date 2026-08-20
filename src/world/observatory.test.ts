// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { floodFillReachable, isReachable } from "./connectivity";
import { FixtureType } from "./fixtures";
import { LAMP_POSTS, lampsLit, postsFree } from "./observatory";
import { TerrainType } from "./terrain";
import { generateWorld } from "./worldGenerator";

const SEEDS = [1, 3, 7];

describe("the observatory", () => {
  test("stands on the shelf the mountain leaves, in every world", () => {
    for (const seed of SEEDS) {
      const world = generateWorld(200, 200, seed);
      const observatory = world.observatory;
      expect({ seed, built: observatory !== null }).toEqual({ seed, built: true });
      if (!observatory) continue;
      // Never on the rock. The flatten pass leaves a walkable shelf in the
      // middle of the box and the dome belongs on it; a dome placed on the
      // mountain around it would be a building nobody can stand beside.
      for (
        let row = observatory.dome.row;
        row < observatory.dome.row + observatory.dome.height;
        row++
      ) {
        for (
          let col = observatory.dome.col;
          col < observatory.dome.col + observatory.dome.width;
          col++
        ) {
          expect(world.grid.getTerrain(col, row)).not.toBe(TerrainType.Mountain);
        }
      }
    }
  });

  test("the path runs from its door to the foot of the shelf, unbroken", () => {
    for (const seed of SEEDS) {
      const { grid, observatory } = generateWorld(200, 200, seed);
      if (!observatory) continue;
      expect(observatory.path.length).toBeGreaterThan(LAMP_POSTS);
      let previous = observatory.path[0];
      for (const at of observatory.path) {
        expect(grid.isPassable(at.col, at.row)).toBe(true);
        // One step at a time, so it is a path rather than a list of cells
        // that happen to be walkable.
        if (previous) {
          const step = Math.abs(at.col - previous.col) + Math.abs(at.row - previous.row);
          expect({ seed, step: step <= 1 }).toEqual({ seed, step: true });
        }
        previous = at;
      }
    }
  });

  // The doorstep is what the world's connectivity aims at, so it has to be
  // land you can stand on *and* reach — the rule every settlement here now
  // states for itself.
  test("its doorstep can be walked to from where the player starts", () => {
    for (const seed of SEEDS) {
      const world = generateWorld(200, 200, seed);
      if (!world.observatory) continue;
      const reachable = floodFillReachable(world.grid, world.playerStart);
      expect({ seed, ok: isReachable(reachable, world.grid, world.observatory.doorstep) }).toEqual({
        seed,
        ok: true,
      });
    }
  });

  test("marks a post for every lamp the astronomer asks for, all on clear ground", () => {
    for (const seed of SEEDS) {
      const { grid, observatory } = generateWorld(200, 200, seed);
      if (!observatory) continue;
      expect(observatory.posts.length).toBe(LAMP_POSTS);
      const seen = new Set<string>();
      for (const at of observatory.posts) {
        expect(grid.getObjectAt(at.col, at.row)).toBeNull();
        expect(grid.isPassable(at.col, at.row)).toBe(true);
        const key = `${at.col},${at.row}`;
        expect({ key, twice: seen.has(key) }).toEqual({ key, twice: false });
        seen.add(key);
      }
    }
  });

  // The task keeps no state of its own: a lamp standing on a post is a thing
  // the save already records, which is the same trick the great tree's bed
  // uses and the reason neither needs a field on the player.
  test("counts the lamps standing on them, and starts at none", () => {
    const world = generateWorld(200, 200, 3);
    const observatory = world.observatory;
    if (!observatory) throw new Error("no observatory to test");
    expect(lampsLit(world.grid, observatory)).toBe(0);
    for (const [n, at] of observatory.posts.entries()) {
      world.grid.placeObject({
        id: `lamp-${n}`,
        type: FixtureType.Lamp,
        col: at.col,
        row: at.row,
        width: 1,
        height: 1,
        blocksMovement: true,
        anchorCol: at.col,
        anchorRow: at.row,
      });
      expect(lampsLit(world.grid, observatory)).toBe(n + 1);
    }
  });

  /**
   * A post is chosen from a cell that was clear when the world was made, and
   * nothing stops the player fencing one afterwards. The astronomer tops the
   * child up to however many posts are free — so a post with a fence on it
   * has to stop counting as somewhere she can send them, or she hands over a
   * lamp on every visit for a post that will never take one.
   */
  test("stops counting a post something else is standing on", () => {
    const world = generateWorld(200, 200, 7);
    const observatory = world.observatory;
    if (!observatory) throw new Error("no observatory to test");
    expect(postsFree(world.grid, observatory)).toBe(LAMP_POSTS);

    const [first, second] = observatory.posts;
    if (!first || !second) throw new Error("too few posts");
    const stand = (type: string, at: { col: number; row: number }) =>
      world.grid.placeObject({
        id: `${type}-${at.col}-${at.row}`,
        type,
        col: at.col,
        row: at.row,
        width: 1,
        height: 1,
        blocksMovement: true,
        anchorCol: at.col,
        anchorRow: at.row,
      });

    stand(FixtureType.Fence, first);
    // Dark, but not somewhere a lamp can go: four free, none lit.
    expect({ free: postsFree(world.grid, observatory), lit: lampsLit(world.grid, observatory) }) //
      .toEqual({ free: LAMP_POSTS - 1, lit: 0 });

    stand(FixtureType.Lamp, second);
    // A lamp fills its post too — it is no longer free and it is now lit.
    expect({ free: postsFree(world.grid, observatory), lit: lampsLit(world.grid, observatory) }) //
      .toEqual({ free: LAMP_POSTS - 2, lit: 1 });
  });
});
