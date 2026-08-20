// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { floodFillReachable, isReachable } from "./connectivity";
import { WorldGrid } from "./grid";
import {
  type CornerLevels,
  LEVEL_FOR_TERRAIN,
  canStepBetween,
  hasStep,
  isStraightStep,
  levelForTerrain,
  smoothLevels,
  stepOf,
} from "./levels";
import { RAMP_PERIOD, RAMP_WIDTH, assignLevels, cutRamps, isRampLane } from "./terraces";
import { TERRAIN_TYPES, TerrainType } from "./terrain";
import { generateWorld } from "./worldGenerator";

describe("what sits at what height", () => {
  test("every terrain has a level, and the coast and meadows share the lowest", () => {
    for (const terrain of TERRAIN_TYPES) {
      expect(LEVEL_FOR_TERRAIN[terrain]).toBeGreaterThanOrEqual(0);
    }
    for (const low of [
      TerrainType.Water,
      TerrainType.Sand,
      TerrainType.Grass,
      TerrainType.Woodland,
    ]) {
      expect(levelForTerrain(low)).toBe(0);
    }
  });

  // The two steps the design asks for, and no others: sand gives way to
  // meadow and meadow to wood by growing different things, which is how
  // those read in the world.
  test("the hills stand a step above the wood and the peaks a step above the hills", () => {
    expect(levelForTerrain(TerrainType.Hilly)).toBe(levelForTerrain(TerrainType.Woodland) + 1);
    expect(levelForTerrain(TerrainType.Mountain)).toBe(levelForTerrain(TerrainType.Hilly) + 1);
  });
});

describe("reading a tile's corners", () => {
  test("four corners the same is no step at all", () => {
    expect(hasStep([1, 1, 1, 1])).toBe(false);
    expect(stepOf([1, 1, 1, 1])).toBeNull();
  });

  test("a step names its two levels and which corners are on top", () => {
    const step = stepOf([1, 1, 0, 0] as CornerLevels);
    expect(step).toEqual({ upper: 1, lower: 0, mask: [true, true, false, false] });
  });

  // The art has one cliff — a step of one. A two-level jump would have
  // nothing to draw and would read as the ground teleporting.
  test("a jump of more than one step has nothing to draw, and says so", () => {
    expect(stepOf([2, 2, 0, 0] as CornerLevels)).toBeNull();
    expect(hasStep([2, 2, 0, 0])).toBe(true);
  });

  test("three levels at one tile has nothing to draw either", () => {
    expect(stepOf([2, 1, 0, 1] as CornerLevels)).toBeNull();
  });
});

describe("flattening the jumps", () => {
  const field = (rows: number[][]): { data: Uint8Array; w: number; h: number } => ({
    data: Uint8Array.from(rows.flat()),
    w: rows[0]?.length ?? 0,
    h: rows.length,
  });

  test("a cell more than one above its neighbour is brought down", () => {
    const { data, w, h } = field([
      [0, 0, 0],
      [0, 3, 0],
      [0, 0, 0],
    ]);
    expect([...smoothLevels(data, w, h)]).toEqual([0, 0, 0, 0, 1, 0, 0, 0, 0]);
  });

  // Lowering one cell can leave it too far above one of its *other*
  // neighbours, so a single pass is not enough.
  test("it keeps going until nothing moves", () => {
    const { data, w, h } = field([[0, 9, 9, 9, 9]]);
    expect([...smoothLevels(data, w, h)]).toEqual([0, 1, 2, 3, 4]);
  });

  // Raising ground would grow the highlands outward on every pass and could
  // swallow the village; lowering only ever shaves the peaks, and the peaks
  // are where nothing lives.
  test("it lowers the high ground rather than raising the low", () => {
    const { data, w, h } = field([[0, 5]]);
    const out = smoothLevels(data, w, h);
    expect(out[0]).toBe(0);
    expect(out[1]).toBe(1);
  });

  // Diagonals, though nothing walks along one. A tile is drawn from the four
  // levels at its corners, and those corners are a 2x2 block — so a tile
  // whose block spans two levels is one `stepOf` cannot name and the atlas
  // has no frame for. Smoothing all eight neighbours is exactly the
  // condition that no such tile exists.
  test("no 2x2 block spans more than one level, so every step tile is drawable", () => {
    const w = 24;
    const h = 24;
    const data = new Uint8Array(w * h);
    for (let i = 0; i < data.length; i++) data[i] = (i * 7919) % 5;
    const out = smoothLevels(data, w, h);
    for (let row = 0; row < h - 1; row++) {
      for (let col = 0; col < w - 1; col++) {
        const block = [
          out[row * w + col] as number,
          out[row * w + col + 1] as number,
          out[(row + 1) * w + col + 1] as number,
          out[(row + 1) * w + col] as number,
        ] as const;
        const span = Math.max(...block) - Math.min(...block);
        expect({ col, row, span }).toEqual({ col, row, span: Math.min(span, 1) });
        if (span === 1) expect(stepOf(block)).not.toBeNull();
      }
    }
  });

  // The shape a four-neighbour smoothing left legal, and the one that cost
  // the cliff line a hole: nw and se are diagonal to each other, so nothing
  // ever compared them.
  test("a diagonal jump is flattened too", () => {
    const { data, w, h } = field([
      [0, 1],
      [1, 2],
    ]);
    expect([...smoothLevels(data, w, h)]).toEqual([0, 1, 1, 1]);
  });

  test("no neighbour is left more than one step away, on any field", () => {
    const w = 24;
    const h = 24;
    const data = new Uint8Array(w * h);
    for (let i = 0; i < data.length; i++) data[i] = (i * 7919) % 5;
    const out = smoothLevels(data, w, h);
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const here = out[row * w + col] as number;
        for (const [dc, dr] of [
          [1, 0],
          [0, 1],
        ] as const) {
          const c = col + dc;
          const r = row + dr;
          if (c >= w || r >= h) continue;
          expect(Math.abs(here - (out[r * w + c] as number))).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

describe("which steps run straight across a tile", () => {
  // The line between the two kinds of cliff tile the atlas ships. Only a
  // straight run can be a ramp: a ramp tapers from the ends of the gap it
  // cuts, and the ends have to lie along the border, which needs the border
  // to have a direction.
  test("two adjacent corners high is a straight run", () => {
    for (const mask of [
      [true, true, false, false],
      [false, false, true, true],
      [false, true, true, false],
      [true, false, false, true],
    ]) {
      expect({ mask: mask.map(Number).join(""), straight: isStraightStep(mask) }).toEqual({
        mask: mask.map(Number).join(""),
        straight: true,
      });
    }
  });

  test("one corner, three corners, and the two diagonals are not", () => {
    const straight = new Set(["1100", "0011", "0110", "1001"]);
    for (let bits = 0; bits < 16; bits++) {
      const mask = [3, 2, 1, 0].map((shift) => ((bits >> shift) & 1) === 1);
      const name = mask.map(Number).join("");
      if (straight.has(name)) continue;
      expect({ name, straight: isStraightStep(mask) }).toEqual({ name, straight: false });
    }
  });

  // A flat tile has no step to run in any direction, and calling it straight
  // would offer it a ramp frame it must never take.
  test("no step at all is not a straight one", () => {
    expect(isStraightStep([true, true, true, true])).toBe(false);
    expect(isStraightStep([false, false, false, false])).toBe(false);
  });
});

describe("what a step means to walking", () => {
  // The whole of it: both sides of a cliff are perfectly good ground, and
  // what is not allowed is getting from one to the other.
  test("you may walk on your own level and may not change level", () => {
    expect(canStepBetween(1, 1)).toBe(true);
    expect(canStepBetween(0, 1)).toBe(false);
    expect(canStepBetween(1, 0)).toBe(false);
  });

  test("the grid refuses a step up and allows one along", () => {
    const grid = WorldGrid.empty(4, 4, TerrainType.Grass);
    grid.setLevel(2, 1, 1);
    expect(grid.canStep({ col: 1, row: 1 }, { col: 2, row: 1 })).toBe(false);
    expect(grid.canStep({ col: 1, row: 1 }, { col: 1, row: 2 })).toBe(true);
  });

  // A cliff is not a hole: the ground on top of it is real, and a thing
  // standing there is standing on something.
  test("ground above a step is still ground", () => {
    const grid = WorldGrid.empty(4, 4, TerrainType.Grass);
    grid.setLevel(2, 1, 1);
    expect(grid.isPassable(2, 1)).toBe(true);
    expect(grid.canStep({ col: 2, row: 1 }, { col: 3, row: 1 })).toBe(false);
  });
});

describe("the ways up", () => {
  test("there is one every period, and it is wide enough to find", () => {
    for (const seed of [1, 7, 42, 999]) {
      let longestWall = 0;
      let run = 0;
      for (let at = 0; at < RAMP_PERIOD * 8; at++) {
        run = isRampLane(at, seed) ? 0 : run + 1;
        longestWall = Math.max(longestWall, run);
      }
      // One lane per period means the wall can run at most from one period's
      // lane to the next one's, never further.
      expect({ seed, ok: longestWall <= (RAMP_PERIOD - RAMP_WIDTH) * 2 }).toEqual({
        seed,
        ok: true,
      });
    }
  });

  test("a lane is a run of tiles rather than a single one", () => {
    let longest = 0;
    let run = 0;
    for (let at = 0; at < RAMP_PERIOD * 4; at++) {
      run = isRampLane(at, 3) ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
    expect(longest).toBe(RAMP_WIDTH);
  });

  test("cutting one makes the step crossable without moving it", () => {
    const grid = WorldGrid.empty(60, 8, TerrainType.Grass);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 60; col++) grid.setTerrain(col, row, TerrainType.Hilly);
    }
    assignLevels(grid, []);
    // Well inside, away from the rim — the outermost ring is raised a step
    // to seal the map, so it is never the level its terrain would suggest.
    expect(grid.getLevel(30, 2)).toBe(1);
    expect(cutRamps(grid, [], 5)).toBeGreaterThan(0);

    let crossings = 0;
    for (let col = 2; col < 58; col++) {
      if (grid.canStep({ col, row: 4 }, { col, row: 3 })) crossings++;
    }
    expect(crossings).toBeGreaterThan(0);
    // And the step is still where it was: a ramp is a permission, not a
    // trench. Lowering the ground would have moved the cliff rather than
    // removing it, leaving a lane you can walk into and not out of.
    for (let col = 2; col < 58; col++) {
      expect({ col, high: grid.getLevel(col, 3) }).toEqual({ col, high: 1 });
      expect({ col, low: grid.getLevel(col, 4) }).toEqual({ col, low: 0 });
    }
  });

  // A slope has a top and a bottom. Marking only the upper side would leave
  // the tile below it drawing a cliff across the foot of its own ramp.
  test("a ramp is marked on both sides of the step it cuts", () => {
    const grid = WorldGrid.empty(60, 8, TerrainType.Grass);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 60; col++) grid.setTerrain(col, row, TerrainType.Hilly);
    }
    assignLevels(grid, []);
    cutRamps(grid, [], 5);
    for (let col = 2; col < 58; col++) {
      if (!grid.isRamp(col, 3)) continue;
      expect({ col, below: grid.isRamp(col, 4) }).toEqual({ col, below: true });
    }
  });

  test("a story area is never cut in half by a step through the middle of it", () => {
    const grid = WorldGrid.empty(40, 40, TerrainType.Grass);
    for (let row = 0; row < 20; row++) {
      for (let col = 0; col < 40; col++) grid.setTerrain(col, row, TerrainType.Hilly);
    }
    const box = { id: "harbour", col: 10, row: 14, width: 12, height: 12 };
    assignLevels(grid, [box]);
    const levels = new Set<number>();
    for (let row = box.row; row < box.row + box.height; row++) {
      for (let col = box.col; col < box.col + box.width; col++) levels.add(grid.getLevel(col, row));
    }
    expect(levels.size).toBe(1);
  });
});

// The thing that would ruin the game: a step is not terrain, so the
// connectivity pass cannot carve its way through one. If the ramps are
// wrong, the highlands are sealed and nothing downstream notices.
describe("the highlands stay reachable in a real world", () => {
  test("most of the high ground can be walked to from the village", () => {
    for (const seed of [1, 2, 3, 12345]) {
      const world = generateWorld(200, 200, seed);
      const visited = floodFillReachable(world.grid, world.village.playerDoorstep);
      let high = 0;
      let reached = 0;
      for (let row = 0; row < world.grid.height; row++) {
        for (let col = 0; col < world.grid.width; col++) {
          if (world.grid.getLevel(col, row) === 0) continue;
          if (!world.grid.isPassable(col, row)) continue;
          high++;
          if (isReachable(visited, world.grid, { col, row })) reached++;
        }
      }
      expect({ seed, any: high > 0 }).toEqual({ seed, any: true });
      expect({ seed, share: reached / high > 0.5 }).toEqual({ seed, share: true });
    }
  });

  test("and no tile in a generated world is more than one step from its neighbour", () => {
    const world = generateWorld(200, 200, 7);
    for (let row = 0; row < world.grid.height; row++) {
      for (let col = 0; col < world.grid.width - 1; col++) {
        const gap = Math.abs(world.grid.getLevel(col, row) - world.grid.getLevel(col + 1, row));
        expect({ col, row, gap: gap <= 1 }).toEqual({ col, row, gap: true });
      }
    }
  });
});

// What stops the player walking off the edge of the world. It used to be a
// wall of objects — trees, then boulders, then a standing cliff sprite —
// that had to be placed, kept off the story areas and excused to the
// connectivity pass. A rim that is simply higher needs none of that.
describe("the edge of the world", () => {
  test("the outermost ring stands a step above the ground inside it", () => {
    const world = generateWorld(120, 120, 3);
    const grid = world.grid;
    for (const [col, row, inCol, inRow] of [
      [40, 0, 40, 1],
      [40, grid.height - 1, 40, grid.height - 2],
      [0, 40, 1, 40],
      [grid.width - 1, 40, grid.width - 2, 40],
    ] as const) {
      expect({ col, row, step: grid.getLevel(col, row) - grid.getLevel(inCol, inRow) }).toEqual({
        col,
        row,
        step: 1,
      });
    }
  });

  /**
   * The whole ring, on every side, across a sweep of worlds — not four
   * sampled cells on one.
   *
   * Four cells is what this used to check, and it passed while a dozen cells
   * of every world were walkable: the rim leaks in two ways that a sample
   * will not find. The level is pulled back down by the smoothing pass,
   * which looks at all eight neighbours, so a rim cell one above its own
   * inside neighbour can be two above the cell diagonally in and gets
   * levelled with the ground it is meant to wall off. And a step is
   * crossable if *either* of its cells is a ramp, so a way up cut on the
   * ground just inside the rim opens the rim without a ramp ever being
   * marked on it.
   */
  test("and so cannot be stepped onto from inside, anywhere, in any world", () => {
    for (const seed of [0, 1, 3, 7, 42]) {
      const grid = generateWorld(140, 140, seed).grid;
      const leaks: string[] = [];
      const check = (from: { col: number; row: number }, to: { col: number; row: number }) => {
        if (grid.canStep(from, to)) leaks.push(`${from.col},${from.row}->${to.col},${to.row}`);
      };
      for (let col = 1; col < grid.width - 1; col++) {
        check({ col, row: 1 }, { col, row: 0 });
        check({ col, row: grid.height - 2 }, { col, row: grid.height - 1 });
      }
      for (let row = 1; row < grid.height - 1; row++) {
        check({ col: 1, row }, { col: 0, row });
        check({ col: grid.width - 2, row }, { col: grid.width - 1, row });
      }
      expect({ seed, leaks: leaks.slice(0, 4) }).toEqual({ seed, leaks: [] });
    }
  });

  // One step above whatever it borders, rather than a fixed height: a rim
  // pinned to the top level would be a sheer drop wherever it met the coast,
  // and there is no art for that.
  test("the rim never leaves a jump bigger than one step", () => {
    const world = generateWorld(120, 120, 3);
    const grid = world.grid;
    for (let col = 0; col < grid.width - 1; col++) {
      const gap = Math.abs(grid.getLevel(col, 0) - grid.getLevel(col + 1, 0));
      expect({ col, gap: gap <= 1 }).toEqual({ col, gap: true });
    }
  });
});
