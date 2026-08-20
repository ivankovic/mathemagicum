// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import cliffAtlas from "../../public/assets/cliffs/cliffs.json";
import type { AreaPlacement } from "./anchors";
import { cliffFrameFor, cornerLevelsFor } from "./cliffAtlas";
import { WorldGrid } from "./grid";
import { hasStep } from "./levels";
import { assignLevels, cutRamps, nearTheRim, sealRampEdges } from "./terraces";
import { TerrainType } from "./terrain";
import { buildVariationIndex, cornerTerrainsFor } from "./terrainAtlas";
import { generateWorld } from "./worldGenerator";

const NAMES = new Set(
  (cliffAtlas as unknown as { textures: { frames: { filename: string }[] }[] }).textures.flatMap(
    (page) => page.frames.map((frame) => frame.filename),
  ),
);
const VARIATIONS = buildVariationIndex([...NAMES]);

/** What the renderer would draw at one dual tile: a frame, flat ground, or nothing. */
function frameAt(grid: WorldGrid, col: number, row: number): string | null | "flat" {
  const levels = cornerLevelsFor(grid, col, row);
  if (!hasStep(levels)) return "flat";
  const frame = cliffFrameFor(
    grid,
    cornerTerrainsFor(grid, col, row),
    levels,
    col,
    row,
    VARIATIONS,
  );
  return frame !== null && NAMES.has(frame) ? frame : null;
}

/**
 * Tiles where the rock stops dead: open ground with a full, un-tapered cliff
 * standing right beside it. This is the blemish the seal exists to remove,
 * and counting it is the only honest test of whether it did.
 */
function abruptCuts(grid: WorldGrid): { col: number; row: number }[] {
  const found: { col: number; row: number }[] = [];
  for (let row = 1; row < grid.height - 1; row++) {
    for (let col = 1; col < grid.width - 1; col++) {
      // The border where no way up may be cut is skipped, and it has to be:
      // the rim is a *wall*, not a step somebody climbs, so the taper that
      // softens every other cliff is deliberately not applied there. A wall
      // stopping dead at the edge of the world is a wall that has run out of
      // world, which is the one place that reads correctly.
      if (nearTheRim(grid.width, grid.height, col, row)) continue;
      if (frameAt(grid, col, row) !== null) continue;
      const beside = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dCol, dRow]) => {
        const frame = frameAt(grid, col + (dCol as number), row + (dRow as number));
        return typeof frame === "string" && frame.startsWith("cliff_");
      });
      if (beside) found.push({ col, row });
    }
  }
  return found;
}

function boxesOf(anchors: {
  village: AreaPlacement;
  harbour: AreaPlacement;
  bigCity: AreaPlacement;
  observatory: AreaPlacement;
  enchantedForest: AreaPlacement;
}): AreaPlacement[] {
  return [
    anchors.village,
    anchors.harbour,
    anchors.bigCity,
    anchors.observatory,
    anchors.enchantedForest,
  ];
}

describe("the rock never stops dead", () => {
  // The whole point. A tile whose step turns a corner has no ramp frame and
  // is drawn as open ground; if it lands at the *edge* of a way up, the full
  // cliff beside it ends in mid-air at a tile boundary — which is the sharp
  // edge the taper was written to get rid of, reappearing one tile over.
  test("no world in a sweep leaves a cliff ending in mid-air", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { grid } = generateWorld(140, 140, seed);
      const cuts = abruptCuts(grid);
      expect({ seed, cuts: cuts.slice(0, 3) }).toEqual({ seed, cuts: [] });
    }
  });

  // Not a claim that the world has no steps to draw. A sweep that found
  // nothing because there was nothing to find would pass the test above
  // while proving nothing at all.
  test("and the sweep is looking at worlds that do have cliffs", () => {
    const { grid } = generateWorld(140, 140, 1);
    let steps = 0;
    let drawn = 0;
    for (let row = 1; row < grid.height - 1; row++) {
      for (let col = 1; col < grid.width - 1; col++) {
        const frame = frameAt(grid, col, row);
        if (frame === "flat") continue;
        steps++;
        if (typeof frame === "string") drawn++;
      }
    }
    expect(steps).toBeGreaterThan(200);
    expect(drawn).toBeGreaterThan(steps / 2);
  });

  // Guarding the guard: the same sweep over a world that was cut but never
  // sealed does find the blemish. A test that would pass whether or not the
  // code under it ran is not a test.
  test("a world cut but not sealed does show them", () => {
    const world = generateWorld(140, 140, 4);
    const boxes = boxesOf(world.anchors);
    const unsealed = WorldGrid.empty(world.grid.width, world.grid.height, TerrainType.Grass);
    for (let row = 0; row < world.grid.height; row++) {
      for (let col = 0; col < world.grid.width; col++) {
        unsealed.setTerrain(col, row, world.grid.getTerrain(col, row));
      }
    }
    assignLevels(unsealed, boxes);
    let found = 0;
    for (const rampSeed of [1, 2, 3, 4, 5, 6]) {
      const cut = WorldGrid.empty(unsealed.width, unsealed.height, TerrainType.Grass);
      for (let row = 0; row < unsealed.height; row++) {
        for (let col = 0; col < unsealed.width; col++) {
          cut.setTerrain(col, row, unsealed.getTerrain(col, row));
          cut.setLevel(col, row, unsealed.getLevel(col, row));
        }
      }
      cutRamps(cut, boxes, rampSeed);
      found += abruptCuts(cut).length;
    }
    expect(found).toBeGreaterThan(0);
  });
});

/**
 * A field whose northern half stands a step above its southern half, with
 * the boundary jogging one cell south across the middle ten columns — so the
 * step runs straight almost everywhere and turns a corner in two known
 * places.
 */
function notched(): WorldGrid {
  const grid = WorldGrid.empty(20, 20, TerrainType.Grass);
  for (let row = 0; row < 20; row++) {
    for (let col = 0; col < 20; col++) {
      const high = row < 10 || (row === 10 && col >= 5 && col < 15);
      grid.setTerrain(col, row, high ? TerrainType.Hilly : TerrainType.Grass);
      grid.setLevel(col, row, high ? 1 : 0);
    }
  }
  return grid;
}

describe("what the seal is allowed to touch", () => {
  test("it only ever adds ways up, never takes one away", () => {
    const world = generateWorld(140, 140, 5);
    const before: boolean[] = [];
    for (let row = 0; row < world.grid.height; row++) {
      for (let col = 0; col < world.grid.width; col++) before.push(world.grid.isRamp(col, row));
    }
    sealRampEdges(world.grid, boxesOf(world.anchors));
    let at = 0;
    for (let row = 0; row < world.grid.height; row++) {
      for (let col = 0; col < world.grid.width; col++) {
        if (before[at++])
          expect({ col, row, kept: world.grid.isRamp(col, row) }).toEqual({
            col,
            row,
            kept: true,
          });
      }
    }
  });

  // A way up opened through the middle of the harbour would put a gap in a
  // story area's own ground, which is the one thing `cutRamps` is careful
  // about and the seal has no licence to undo. Shown on a field where the
  // seal has work to do and a box sitting on top of it.
  test("it leaves the story areas alone", () => {
    const grid = notched();
    for (let col = 0; col <= 4; col++) {
      for (let row = 9; row <= 11; row++) grid.setRamp(col, row, true);
    }
    const box: AreaPlacement = { id: "harbour", col: 3, row: 8, width: 6, height: 6 };
    sealRampEdges(grid, [box]);
    for (let row = box.row; row < box.row + box.height; row++) {
      for (let col = box.col; col < box.col + box.width; col++) {
        const wasCut = col <= 4 && row >= 9 && row <= 11;
        expect({ col, row, ramp: grid.isRamp(col, row) }).toEqual({ col, row, ramp: wasCut });
      }
    }
  });

  test("running it again on a sealed world changes nothing", () => {
    const world = generateWorld(140, 140, 3);
    expect(sealRampEdges(world.grid, boxesOf(world.anchors))).toBe(0);
  });
});

describe("the seal on a field built by hand", () => {
  test("a way up ending on a corner is widened until it ends on a straight run", () => {
    const grid = notched();
    for (let col = 0; col <= 4; col++) {
      for (let row = 9; row <= 11; row++) grid.setRamp(col, row, true);
    }
    // The lane's eastern edge lands exactly where the step jogs, so the tile
    // there turns a corner and has no ramp frame — with the full cliff
    // standing next to it.
    expect(abruptCuts(grid)).toEqual([{ col: 4, row: 10 }]);
    sealRampEdges(grid, []);
    expect(abruptCuts(grid)).toEqual([]);
  });

  test("it stops as soon as the edges are straight, rather than eating the cliff", () => {
    const grid = notched();
    for (let col = 0; col <= 4; col++) {
      for (let row = 9; row <= 11; row++) grid.setRamp(col, row, true);
    }
    sealRampEdges(grid, []);
    let ramps = 0;
    for (let row = 0; row < grid.height; row++) {
      for (let col = 0; col < grid.width; col++) if (grid.isRamp(col, row)) ramps++;
    }
    // Fifteen to start with. A seal that had run away would have opened the
    // whole contour, which is a great deal more than a handful.
    expect(ramps).toBeLessThan(25);
  });
});
