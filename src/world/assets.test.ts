// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BUILDING_FOOTPRINTS, BUILDING_SPRITES, DOOR_STATES, ROLE_SPRITES } from "./buildings";
import { ALL_CHARACTERS, CHARACTER_ANIMATIONS, Facing } from "./characters";
import type { BuildingSidecar, CharacterSidecar } from "./spriteSidecar";
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

const FACINGS = Object.values(Facing);

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

describe("the shipped character sheets", () => {
  const sidecars = new Map(
    ALL_CHARACTERS.map((c) => [c, readJson<CharacterSidecar>("characters", `${c}.json`)]),
  );

  test("exist for the player and every NPC the village places", () => {
    for (const character of ALL_CHARACTERS) {
      expect(sidecars.get(character)?.character).toBe(character);
    }
  });

  test("ship the sheet PNG they name", () => {
    for (const [name, sidecar] of sidecars) {
      const sheet = sidecar.sheet;
      if (!sheet) throw new Error(`${name} has no sheet`);
      expect(existsSync(join(ASSETS, "characters", sheet.file))).toBe(true);
    }
  });

  test("are 1:1 art one cell wide, overhanging upward", () => {
    for (const sidecar of sidecars.values()) {
      expect(sidecar.tile_size).toBe(TILE_SIZE);
      expect(sidecar.footprint_tiles).toEqual({ width: 1, height: 1 });
      expect(sidecar.sprite_size_px.width).toBe(TILE_SIZE);
      // The head rises into the cell above; the offset is exactly that rise.
      const overhang = sidecar.sprite_size_px.height - TILE_SIZE;
      expect(overhang).toBeGreaterThan(0);
      expect(sidecar.sprite_offset_px).toEqual({ x: 0, y: -overhang });
    }
  });

  test("carry an idle and a walk animation for all four facings", () => {
    const expected = new Set(CHARACTER_ANIMATIONS.flatMap((a) => FACINGS.map((f) => `${a}_${f}`)));
    for (const [name, sidecar] of sidecars) {
      expect({ name, keys: new Set(Object.keys(sidecar.animations)) }).toEqual({
        name,
        keys: expected,
      });
    }
  });

  test("name frame ranges that are inside the sheet and do not overlap", () => {
    for (const [name, sidecar] of sidecars) {
      const claimed = new Set<number>();
      for (const [anim, range] of Object.entries(sidecar.animations)) {
        expect(range.end - range.start + 1).toBe(range.frame_count);
        expect(range.start).toBeGreaterThanOrEqual(0);
        // Out of range is the dangerous one: Phaser yields missing frames
        // rather than erroring, so that facing would silently freeze.
        expect(range.end).toBeLessThan(sidecar.frame_count);
        for (let i = range.start; i <= range.end; i++) {
          expect({ name, anim, i, seen: claimed.has(i) }).toEqual({ name, anim, i, seen: false });
          claimed.add(i);
        }
      }
    }
  });

  test("lay each animation out on its own sheet row", () => {
    for (const sidecar of sidecars.values()) {
      const sheet = sidecar.sheet;
      if (!sheet) throw new Error("no sheet");
      for (const range of Object.values(sidecar.animations)) {
        expect(range.start % sheet.columns).toBe(0);
        expect(range.frame_count).toBeLessThanOrEqual(sheet.columns);
      }
    }
  });

  test("declare a grid whose cells account for every frame", () => {
    // If columns x rows were smaller than frame_count the last animations
    // would have no frames at all — the silent failure this guards.
    for (const [name, sidecar] of sidecars) {
      const sheet = sidecar.sheet;
      if (!sheet) throw new Error(`${name} has no sheet`);
      expect(sheet.columns * sheet.rows).toBeGreaterThanOrEqual(sidecar.frame_count);
      expect(sheet.frame_count).toBe(sidecar.frame_count);
    }
  });
});

describe("the shipped building doors", () => {
  const sidecars = new Map(
    BUILDING_SPRITES.map((sprite) => [
      sprite,
      readJson<BuildingSidecar>("buildings", `${sprite}.json`),
    ]),
  );

  test("ship a frame range for every door state the game asks for", () => {
    for (const [name, sidecar] of sidecars) {
      const named = new Set(Object.keys(sidecar.animations));
      expect({ name, named }).toEqual({
        name,
        named: new Set(DOOR_STATES.map((s) => `door_${s}`)),
      });
    }
  });

  test("name ranges that are inside the sheet and do not overlap", () => {
    for (const [name, sidecar] of sidecars) {
      const claimed = new Set<number>();
      for (const range of Object.values(sidecar.animations)) {
        expect(range.end - range.start + 1).toBe(range.frame_count);
        expect(range.end).toBeLessThan(sidecar.frame_count);
        for (let i = range.start; i <= range.end; i++) {
          expect({ name, i, seen: claimed.has(i) }).toEqual({ name, i, seen: false });
          claimed.add(i);
        }
      }
      // Every frame in the sheet belongs to some door state.
      expect(claimed.size).toBe(sidecar.frame_count);
    }
  });

  test("put each door state on its own sheet row", () => {
    for (const sidecar of sidecars.values()) {
      const sheet = sidecar.sheet;
      if (!sheet) throw new Error("no sheet");
      expect(sheet.rows).toBe(DOOR_STATES.length);
      for (const range of Object.values(sidecar.animations)) {
        expect(range.start % sheet.columns).toBe(0);
        expect(range.frame_count).toBe(sheet.columns);
      }
    }
  });

  test("put the door on the footprint's front row, reachable from outside", () => {
    for (const sidecar of sidecars.values()) {
      const [doorRow] = sidecar.door_cell_relative_to_anchor;
      // The tile the player stands on to enter is one past the footprint, so
      // the door has to be on its last row or that tile is inside the
      // building.
      expect(doorRow).toBe(sidecar.footprint_tiles.height - 1);
    }
  });
});
