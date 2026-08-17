// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BUILDING_FOOTPRINTS, BUILDING_SPRITES, ROLE_SPRITES } from "./buildings";
import type { BuildingSidecar } from "./spriteSidecar";
import { TERRAIN_TYPES } from "./terrain";
import { TERRAIN_ATLAS_KEY, buildVariationIndex, comboKey } from "./terrainAtlas";
import type { CornerTerrains } from "./terrainAtlas";
import { TILE_SIZE } from "./topdown";

// These assets are produced by a separate repo (~/src/asset-generator) and
// committed here, so nothing in this repo's build can catch them drifting
// out of sync with the code that reads them. That is exactly what these
// tests are for: they read the shipped files and check the assumptions the
// renderer makes about them, so a bad or stale asset sync fails the suite
// rather than showing up as a hole in the world.
const ASSETS = join(import.meta.dir, "..", "..", "public", "assets");

function readJson<T>(...parts: string[]): T {
  return JSON.parse(readFileSync(join(ASSETS, ...parts), "utf8")) as T;
}

interface MultiAtlas {
  textures: { image: string; size: { w: number; h: number }; frames: { filename: string }[] }[];
}

describe("the shipped terrain atlas", () => {
  const atlas = readJson<MultiAtlas>("terrain", `${TERRAIN_ATLAS_KEY}.json`);
  const frameNames = atlas.textures.flatMap((t) => t.frames.map((f) => f.filename));
  const variations = buildVariationIndex(frameNames);

  test("every page image it references exists", () => {
    for (const texture of atlas.textures) {
      expect(existsSync(join(ASSETS, "terrain", texture.image))).toBe(true);
    }
  });

  test("fits in one page, within the 2048px mobile texture ceiling", () => {
    expect(atlas.textures.length).toBe(1);
    for (const texture of atlas.textures) {
      expect(texture.size.w).toBeLessThanOrEqual(2048);
      expect(texture.size.h).toBeLessThanOrEqual(2048);
    }
  });

  // The whole reason the atlas exports all 7^4 assignments rather than just
  // the two-terrain ones: a cell where three or four regions meet has no
  // bitmask representation, and the game cannot composite one at runtime.
  // If any combination were missing, frameFor would return null there and
  // the world would have an unpainted hole wherever those regions touch.
  test("has art for every combination of terrains at a tile's four corners", () => {
    const missing: string[] = [];
    for (const nw of TERRAIN_TYPES) {
      for (const ne of TERRAIN_TYPES) {
        for (const se of TERRAIN_TYPES) {
          for (const sw of TERRAIN_TYPES) {
            const key = comboKey([nw, ne, se, sw] as CornerTerrains);
            if (!variations.has(key)) missing.push(key);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });

  test("covers exactly the combinations the game can ask for, and no others", () => {
    expect(variations.size).toBe(TERRAIN_TYPES.length ** 4);
  });

  test("gives uniform fills more variants than the rare multi-terrain cells", () => {
    // Repetition is only visible where a tile repeats, and a fill covers
    // whole fields while a four-way corner occurs a handful of times in a
    // world. If this inverted, large areas would visibly tile.
    const fill = variations.get(comboKey(["grass", "grass", "grass", "grass"] as CornerTerrains));
    const quad = variations.get(comboKey(["grass", "water", "sand", "mountain"] as CornerTerrains));
    expect(fill).toBeGreaterThan(quad as number);
  });

  test("every frame name parses back into four known terrains", () => {
    const known = new Set<string>(TERRAIN_TYPES);
    for (const combo of variations.keys()) {
      const parts = combo.split("_");
      expect(parts.length).toBe(4);
      for (const part of parts) expect(known.has(part)).toBe(true);
    }
  });
});

describe("the shipped building sidecars", () => {
  const sidecars = new Map(
    BUILDING_SPRITES.map((sprite) => [
      sprite,
      readJson<BuildingSidecar>("buildings", `${sprite}.json`),
    ]),
  );

  test("agree with the footprints world generation lays out from", () => {
    // BUILDING_FOOTPRINTS is duplicated from these files because generation
    // runs before any asset loads. This is the check that keeps the copy
    // honest — drift here means buildings collide differently than they look.
    for (const [sprite, sidecar] of sidecars) {
      expect({ sprite, ...sidecar.footprint_tiles }).toEqual({
        sprite,
        ...BUILDING_FOOTPRINTS[sprite],
      });
    }
  });

  test("use the tile size the projection is built on", () => {
    for (const sidecar of sidecars.values()) expect(sidecar.tile_size).toBe(TILE_SIZE);
  });

  test("were exported with --sheets, and the sheet PNG is present", () => {
    for (const [sprite, sidecar] of sidecars) {
      expect(sidecar.sheet).not.toBeNull();
      const sheet = sidecar.sheet;
      if (!sheet) throw new Error(`${sprite} has no sheet`);
      expect(existsSync(join(ASSETS, "buildings", sheet.file))).toBe(true);
      expect(sheet.frame_count).toBe(sidecar.frame_count);
      expect(sheet.frame_width).toBe(sidecar.sprite_size_px.width);
      expect(sheet.frame_height).toBe(sidecar.sprite_size_px.height);
    }
  });

  test("are 1:1 art, not an upscaled QA render", () => {
    // The sprite is exactly as wide as its footprint; only its height
    // overhangs. A sheet exported at --scale would be a multiple of this and
    // would draw several times too large.
    for (const sidecar of sidecars.values()) {
      expect(sidecar.sprite_size_px.width).toBe(sidecar.footprint_tiles.width * TILE_SIZE);
    }
  });

  test("overhang upward by exactly the offset they declare", () => {
    for (const sidecar of sidecars.values()) {
      const footprintHeightPx = sidecar.footprint_tiles.height * TILE_SIZE;
      const overhang = sidecar.sprite_size_px.height - footprintHeightPx;
      expect(sidecar.sprite_offset_px.y).toBe(-overhang);
      expect(sidecar.sprite_offset_px.x).toBe(0);
    }
  });

  test("put the door on the front row, where the player can reach it", () => {
    for (const sidecar of sidecars.values()) {
      const [doorRow, doorCol] = sidecar.door_cell_relative_to_anchor;
      expect(doorRow).toBe(sidecar.footprint_tiles.height - 1);
      expect(doorCol).toBeGreaterThanOrEqual(0);
      expect(doorCol).toBeLessThan(sidecar.footprint_tiles.width);
    }
  });

  test("block every cell of their own footprint", () => {
    for (const sidecar of sidecars.values()) {
      const { width, height } = sidecar.footprint_tiles;
      expect(sidecar.blocked_cells_relative_to_anchor.length).toBe(width * height);
    }
  });

  test("exist for every role the village places", () => {
    for (const sprite of Object.values(ROLE_SPRITES)) {
      expect(sidecars.has(sprite)).toBe(true);
    }
  });
});
