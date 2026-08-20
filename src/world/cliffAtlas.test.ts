// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import cliffAtlas from "../../public/assets/cliffs/cliffs.json";
import {
  cliffComboKey,
  cliffFrameFor,
  cornerLevelsFor,
  isRampTile,
  rampSides,
  rockFor,
} from "./cliffAtlas";
import { WorldGrid } from "./grid";
import { isStraightStep, stepOf } from "./levels";
import { TerrainType } from "./terrain";
import { buildVariationIndex } from "./terrainAtlas";

const NAMES: string[] = (
  cliffAtlas as unknown as { textures: { frames: { filename: string }[] }[] }
).textures.flatMap((page) => page.frames.map((frame) => frame.filename));
const VARIATIONS = buildVariationIndex(NAMES);

/** A field with a step: the northern half a level above the southern. */
function terraced(): WorldGrid {
  const grid = WorldGrid.empty(12, 12, TerrainType.Grass);
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 12; col++) {
      grid.setTerrain(col, row, TerrainType.Hilly);
      grid.setLevel(col, row, 1);
    }
  }
  return grid;
}

describe("which rock a step wears", () => {
  // Grey where there is rock about, brown lower down — a grey face in a
  // meadow reads as somebody having built a wall rather than as the ground
  // stepping up.
  test("grey up in the hills and brown down on the flat", () => {
    expect(rockFor(1)).toBe("grey");
    expect(rockFor(2)).toBe("grey");
    expect(rockFor(0)).toBe("brown");
  });
});

describe("finding the frame for a step", () => {
  test("a flat tile has no cliff frame at all", () => {
    const grid = WorldGrid.empty(8, 8, TerrainType.Grass);
    const corners = [
      TerrainType.Grass,
      TerrainType.Grass,
      TerrainType.Grass,
      TerrainType.Grass,
    ] as const;
    expect(cliffFrameFor(grid, corners, [0, 0, 0, 0], 2, 2, VARIATIONS)).toBeNull();
  });

  test("a step names a frame the atlas actually ships", () => {
    const grid = terraced();
    for (let row = 0; row < 11; row++) {
      for (let col = 0; col < 11; col++) {
        const levels = cornerLevelsFor(grid, col, row);
        if (levels.every((level) => level === levels[0])) continue;
        const corners = [
          grid.getTerrain(col, row),
          grid.getTerrain(col + 1, row),
          grid.getTerrain(col + 1, row + 1),
          grid.getTerrain(col, row + 1),
        ] as const;
        const frame = cliffFrameFor(grid, corners, levels, col, row, VARIATIONS);
        expect({ col, row, frame: frame !== null }).toEqual({ col, row, frame: true });
        expect(NAMES).toContain(frame as string);
      }
    }
  });

  // Both sides of the step are drawn, so the frame has to be told which
  // terrain is above it and which below — the mask is what knows.
  test("the terrain above the step and the terrain below both reach the name", () => {
    const grid = terraced();
    const levels = cornerLevelsFor(grid, 4, 5);
    const corners = [
      grid.getTerrain(4, 5),
      grid.getTerrain(5, 5),
      grid.getTerrain(5, 6),
      grid.getTerrain(4, 6),
    ] as const;
    const frame = cliffFrameFor(grid, corners, levels, 4, 5, VARIATIONS);
    expect(frame).toContain("hilly");
    expect(frame).toContain("grass");
    expect(frame?.startsWith("cliff_hilly_grass_")).toBe(true);
  });

  test("a ramp corner turns the tile into a ramp frame", () => {
    const grid = terraced();
    grid.setRamp(4, 5, true);
    grid.setRamp(4, 6, true);
    const levels = cornerLevelsFor(grid, 4, 5);
    const corners = [
      grid.getTerrain(4, 5),
      grid.getTerrain(5, 5),
      grid.getTerrain(5, 6),
      grid.getTerrain(4, 6),
    ] as const;
    expect(isRampTile(grid, 4, 5)).toBe(true);
    expect(cliffFrameFor(grid, corners, levels, 4, 5, VARIATIONS)?.startsWith("ramp_")).toBe(true);
  });

  // The one thing this must never do. A tile inside a way up whose step
  // turns a corner has no ramp frame; falling back to the full cliff would
  // stand rock in the middle of the gap, and the gap is where the child
  // walks up. Null instead, which sends it to the ordinary terrain frame —
  // open ground, exactly what a ramp with all its rock tapered away is.
  test("a ramp tile whose step turns a corner draws no rock at all", () => {
    const grid = terraced();
    // Push one cell of the lower ground up, so the step turns inside the
    // tile at (4, 5) rather than running straight across it.
    grid.setTerrain(5, 6, TerrainType.Hilly);
    grid.setLevel(5, 6, 1);
    grid.setRamp(4, 5, true);
    grid.setRamp(4, 6, true);
    const levels = cornerLevelsFor(grid, 4, 5);
    const corners = [
      grid.getTerrain(4, 5),
      grid.getTerrain(5, 5),
      grid.getTerrain(5, 6),
      grid.getTerrain(4, 6),
    ] as const;
    expect(isStraightStep(stepOf(levels)?.mask ?? [])).toBe(false);
    expect(isRampTile(grid, 4, 5)).toBe(true);
    expect(cliffFrameFor(grid, corners, levels, 4, 5, VARIATIONS)).toBeNull();
  });

  // And the same corner *outside* a way up is still a cliff, so the line is
  // unbroken everywhere a child is not meant to climb.
  test("the same corner off a ramp still wears its rock", () => {
    const grid = terraced();
    grid.setTerrain(5, 6, TerrainType.Hilly);
    grid.setLevel(5, 6, 1);
    const levels = cornerLevelsFor(grid, 4, 5);
    const corners = [
      grid.getTerrain(4, 5),
      grid.getTerrain(5, 5),
      grid.getTerrain(5, 6),
      grid.getTerrain(4, 6),
    ] as const;
    expect(cliffFrameFor(grid, corners, levels, 4, 5, VARIATIONS)?.startsWith("cliff_")).toBe(true);
  });
});

describe("which ends a ramp tile tapers from", () => {
  // Asking about the wrong pair would cut a hole across the ramp rather than
  // a way through it.
  test("an east-west step is cut by its east and west neighbours", () => {
    const grid = terraced();
    const northMask = [true, true, false, false] as const;
    expect(rampSides(grid, 4, 5, northMask)).toBe("ew");
    grid.setRamp(3, 5, true);
    expect(rampSides(grid, 4, 5, northMask)).toBe("e");
    grid.setRamp(6, 5, true);
    expect(rampSides(grid, 4, 5, northMask)).toBe("none");
  });

  test("a north-south step is cut by its north and south neighbours", () => {
    const grid = terraced();
    const westMask = [true, false, false, true] as const;
    expect(rampSides(grid, 4, 5, westMask)).toBe("ns");
    grid.setRamp(4, 4, true);
    expect(rampSides(grid, 4, 5, westMask)).toBe("s");
  });

  // The ends have to lie *along* the border, not across it, so the atlas ships
  // each run only with the ramp ends that could cut it. A tile asking for the
  // wrong pair would find no frame and the step would draw nothing at all.
  test("every side set a tile can ask for is one the atlas ships for that run", () => {
    const eastWest = [true, true, false, false] as const;
    const northSouth = [true, false, false, true] as const;
    const shipped = (mask: readonly boolean[], sides: string) =>
      (VARIATIONS.get(cliffComboKey(TerrainType.Hilly, TerrainType.Grass, mask, "grey", sides)) ??
        0) > 0;
    for (const sides of ["ew", "w", "e", "none"]) {
      expect({ sides, shipped: shipped(eastWest, sides) }).toEqual({ sides, shipped: true });
    }
    for (const sides of ["ns", "n", "s", "none"]) {
      expect({ sides, shipped: shipped(northSouth, sides) }).toEqual({ sides, shipped: true });
    }
  });

  // And the renderer's own pairing agrees with the one the atlas exported: no
  // arrangement of ramp neighbours makes it ask for a set its run has not got.
  test("the renderer never asks for a set its run has not got", () => {
    for (const mask of [
      [true, true, false, false],
      [false, false, true, true],
      [false, true, true, false],
      [true, false, false, true],
    ] as const) {
      for (const around of [
        [],
        [[-1, 0]],
        [[1, 0]],
        [[0, -1]],
        [[0, 1]],
        [
          [-1, 0],
          [1, 0],
        ],
        [
          [0, -1],
          [0, 1],
        ],
      ] as const) {
        const grid = terraced();
        for (const [dc, dr] of around) grid.setRamp(4 + dc, 5 + dr, true);
        const sides = rampSides(grid, 4, 5, mask);
        const combo = cliffComboKey(TerrainType.Hilly, TerrainType.Grass, mask, "grey", sides);
        const at = { mask: mask.join(""), sides };
        expect({ ...at, shipped: (VARIATIONS.get(combo) ?? 0) > 0 }).toEqual({
          ...at,
          shipped: true,
        });
      }
    }
  });
});
