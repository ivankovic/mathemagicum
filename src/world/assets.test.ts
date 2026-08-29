// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { LANGUAGES } from "../settings";
import { UI_ASSETS, UiAsset, type UiIndex, flagIcon, uiEntry } from "../ui/assets";
import {
  BUILDING_FOOTPRINTS,
  BUILDING_SPRITES,
  BuildingSprite,
  DOOR_STATES,
  ROLE_SPRITES,
} from "./buildings";
import { ALL_CHARACTERS, CHARACTER_ANIMATIONS, Facing } from "./characters";
import { floodFillReachable, isReachable } from "./connectivity";
import { DECOR_TYPES, canTurnPiece, framesPerLook, pieceArt, turnsOfPiece } from "./decor";
import { EFFECT_TYPES, effectAnimKey, effectSidecarKey } from "./effects";
import { FIXTURE_TYPES, PLACEABLE_FIXTURES, fixtureFor, turnsOf } from "./fixtures";
import {
  FLOWER_LOOKS,
  FLOWER_TYPES,
  flowerFrames,
  wildFlowerFor,
  wildFlowerObject,
} from "./flowers";
import { buildInteriorGrid, interiorAttendantCell, interiorDoor } from "./interiors";
import { INTERIOR_ROOMS, hearthCell, interiorFor } from "./interiors";
import { GROWABLE_ROOM } from "./interiors";
import { LANDMARK_OVERHANG, LANDMARK_TYPES, landmarkFor } from "./landmarks";
import { PLANT_STAGES, PLANT_TYPES } from "./plants";
import { SCENERY_KINDS, sceneryKind } from "./scenery";
import { Canvas } from "./shipping";
import type {
  BuildingSidecar,
  CharacterSidecar,
  EffectSidecar,
  FixtureSidecar,
  GrowableSidecar,
  InteriorSidecar,
  LandmarkSidecar,
  ObjectSidecar,
  PlantSidecar,
} from "./spriteSidecar";
import { TERRAIN_TYPES } from "./terrain";
import {
  TERRAIN_ATLAS_KEY,
  buildVariationIndex,
  comboKey,
  stillCombo,
  waterFrames,
} from "./terrainAtlas";
import type { CornerTerrains } from "./terrainAtlas";
import { TILE_SIZE } from "./topdown";
import { generateWorld } from "./worldGenerator";

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

  // It fitted one page until the eighth terrain — the cobbles — went in.
  // Blending is pairwise, so each terrain costs a pair against every other
  // one, and 5328 tiles do not fit the 4096 a 2048 page holds at 32px. Two
  // pages is one extra bind and one extra request; a third would mean the
  // pairs had grown again, which is worth being told about.
  test("fits two pages, each within the 2048px mobile texture ceiling", () => {
    expect(atlas.textures.length).toBe(2);
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
  /** Every assignment of terrains to a tile's four corners, all 7^4 of them. */
  function everyCombination(): CornerTerrains[] {
    const all: CornerTerrains[] = [];
    for (const nw of TERRAIN_TYPES) {
      for (const ne of TERRAIN_TYPES) {
        for (const se of TERRAIN_TYPES) {
          for (const sw of TERRAIN_TYPES) all.push([nw, ne, se, sw] as CornerTerrains);
        }
      }
    }
    return all;
  }

  test("has art for every combination of terrains at a tile's four corners", () => {
    // The whole reason the atlas exports all 7^4 assignments rather than just
    // the two-terrain ones: a cell where three or four regions meet has no
    // bitmask representation, and the game cannot composite one at runtime.
    // If any combination were missing, frameFor would return null there and
    // the world would have an unpainted hole wherever those regions touch.
    const missing = everyCombination()
      .map(stillCombo)
      .filter((combo) => combo !== null && !variations.has(combo));
    expect(missing).toEqual([]);
  });

  /**
   * The sea is the one thing with no still half, and that has to be on
   * purpose rather than by omission.
   *
   * `stillCombo` answers null for open water because the wave sprite under
   * the chunk is the whole picture there. If the atlas were simply *missing*
   * those frames the game would behave identically — right up until somebody
   * decided open water should have a still half after all, and found the
   * frames were never exported.
   */
  test("and open sea is drawn from the waves alone", () => {
    const sea = ["water", "water", "water", "water"] as unknown as CornerTerrains;
    expect(stillCombo(sea)).toBeNull();
    expect(variations.has(comboKey(sea))).toBe(false);
  });

  test("covers exactly the combinations the game can ask for, and no others", () => {
    const wanted = new Set(
      everyCombination()
        .map(stillCombo)
        .filter((c) => c !== null),
    );
    // The waves are the exception: they are not a corner combination at all,
    // they are the one thing every water tile in the world shares.
    const shipped = new Set([...variations.keys()].filter((c) => !c.startsWith("wave")));
    expect(shipped).toEqual(wanted);
  });

  /**
   * The sea moves, and the atlas is where the two halves of that meet.
   *
   * The generator asserts the decomposition is exact — a wave frame with its
   * cutout over the top is the tile the atlas used to ship, pixel for pixel.
   * What is asserted here is that the shipped art actually has both halves in
   * it, at matching counts, since a `dry_` frame with no sea under it is a
   * hole in the world and a sea with one phase is a sea that does not move.
   */
  test("ships a sea that moves, in whole steps", () => {
    const water = waterFrames(frameNames);
    expect(water.phases).toBeGreaterThan(1);
    expect(water.variations).toBeGreaterThan(1);
    for (let variation = 0; variation < water.variations; variation++) {
      for (let phase = 0; phase < water.phases; phase++) {
        expect(frameNames).toContain(`wave_${variation}_${phase}`);
      }
    }
  });

  /**
   * And the saving that pays for it.
   *
   * Drawing a coastline once per phase would be twelve thousand frames and
   * three more atlas pages, for land that does not move. Cutting the water
   * out instead costs fifty-six frames in total. If the undivided tiles came
   * back alongside the cut ones, that saving would be quietly given back and
   * nothing would look any different.
   */
  test("without drawing any shoreline twice", () => {
    const undivided = everyCombination()
      .map(comboKey)
      .filter((combo) => combo.includes("water") && variations.has(combo));
    expect(undivided).toEqual([]);
  });

  test("gives uniform fills more variants than the rare multi-terrain cells", () => {
    // Repetition is only visible where a tile repeats, and a fill covers
    // whole fields while a four-way corner occurs a handful of times in a
    // world. If this inverted, large areas would visibly tile.
    const fill = variations.get(comboKey(["grass", "grass", "grass", "grass"] as CornerTerrains));
    const quad = variations.get(
      stillCombo(["grass", "water", "sand", "mountain"] as CornerTerrains) ?? "",
    );
    expect(fill).toBeGreaterThan(quad as number);
  });

  test("every frame name parses back into four known terrains", () => {
    const known = new Set<string>(TERRAIN_TYPES);
    for (const combo of variations.keys()) {
      // A cut-out coastline says so in front of the four terrains it is cut
      // from; the waves are not a combination at all and are checked above.
      if (combo.startsWith("wave")) continue;
      const parts = combo.replace(/^dry_/, "").split("_");
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
      // Every building has its three doors. The ship has three sail
      // positions as well, and is the only one that does — canvas is a
      // second axis on the one building that draws itself, and a facade with
      // sails would be a facade that could not be drawn.
      const wanted = new Set<string>(DOOR_STATES.map((s) => `door_${s}`));
      if (name === BuildingSprite.Ship) {
        for (const canvas of Object.values(Canvas)) wanted.add(`sail_${canvas}`);
      }
      expect({ name, named }).toEqual({ name, named: wanted });
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

  test("put each state on its own sheet row", () => {
    for (const [name, sidecar] of sidecars) {
      const sheet = sidecar.sheet;
      if (!sheet) throw new Error("no sheet");
      // One row per animation, whatever the animations are. This said
      // `DOOR_STATES.length`, which was the same number while doors were the
      // only state a building had — and stopped being the same number the
      // day the ship could set sail.
      expect({ name, rows: sheet.rows }).toEqual({
        name,
        rows: Object.keys(sidecar.animations).length,
      });
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

describe("the shipped interiors", () => {
  const rooms = new Map(
    INTERIOR_ROOMS.map((r) => [r, readJson<InteriorSidecar>("interiors", `${r}.json`)]),
  );

  test("exist for every building the village can place", () => {
    for (const sprite of Object.values(ROLE_SPRITES)) {
      expect(rooms.has(interiorFor(sprite))).toBe(true);
    }
  });

  test("ship the sheet PNG they name", () => {
    for (const [name, sidecar] of rooms) {
      const sheet = sidecar.sheet;
      if (!sheet) throw new Error(`${name} has no sheet`);
      expect(existsSync(join(ASSETS, "interiors", sheet.file))).toBe(true);
    }
  });

  test("have art exactly as large as the grid they describe, plus the wall", () => {
    // The renderer places cell (0,0) at wall_rise_px down from the image's
    // top-left. If the art and the grid disagreed, every position indoors
    // would drift by the difference.
    for (const [name, sidecar] of rooms) {
      const sheet = sidecar.sheet;
      if (!sheet) throw new Error(`${name} has no sheet`);
      expect({ name, w: sheet.frame_width, h: sheet.frame_height }).toEqual({
        name,
        w: sidecar.size_cells.cols * TILE_SIZE,
        h: sidecar.size_cells.rows * TILE_SIZE + sidecar.wall_rise_px,
      });
    }
  });

  test("use the tile size the projection is built on", () => {
    for (const sidecar of rooms.values()) expect(sidecar.tile_size).toBe(TILE_SIZE);
  });

  test("put the door on the last row and leave it unblocked", () => {
    for (const [name, sidecar] of rooms) {
      const [row, col] = sidecar.door_cell;
      expect({ name, row }).toEqual({ name, row: sidecar.size_cells.rows - 1 });
      expect(col).toBeGreaterThanOrEqual(0);
      expect(col).toBeLessThan(sidecar.size_cells.cols);
      const blocked = sidecar.blocked_cells.some(([r, c]) => r === row && c === col);
      expect({ name, doorBlocked: blocked }).toEqual({ name, doorBlocked: false });
    }
  });

  test("list only cells that exist", () => {
    for (const [name, sidecar] of rooms) {
      const { cols, rows } = sidecar.size_cells;
      for (const [r, c] of sidecar.blocked_cells) {
        expect({ name, inRange: r >= 0 && r < rows && c >= 0 && c < cols }).toEqual({
          name,
          inRange: true,
        });
      }
    }
  });

  test("leave a walkable route off the doorway, so entering is not a dead end", () => {
    for (const [name, sidecar] of rooms) {
      const [doorRow, doorCol] = sidecar.door_cell;
      const blocked = new Set(sidecar.blocked_cells.map(([r, c]) => `${c},${r}`));
      // The cell straight ahead of the door has to be free, or walking in
      // leaves the player stuck in the doorway.
      expect({ name, ahead: blocked.has(`${doorCol},${doorRow - 1}`) }).toEqual({
        name,
        ahead: false,
      });
    }
  });
});

describe("the shipped crops", () => {
  const sidecars = new Map(
    PLANT_TYPES.map((p) => [p, readJson<PlantSidecar>("plants", `${p}.json`)]),
  );

  test("exist for every plant the game offers", () => {
    for (const plant of PLANT_TYPES) {
      expect(sidecars.get(plant)?.plant).toBe(plant);
    }
  });

  test("ship the sheet PNG they name", () => {
    for (const [name, sidecar] of sidecars) {
      const sheet = sidecar.sheet;
      if (!sheet) throw new Error(`${name} has no sheet`);
      expect(existsSync(join(ASSETS, "plants", sheet.file))).toBe(true);
    }
  });

  test("are 1:1 art one cell wide, overhanging upward", () => {
    for (const sidecar of sidecars.values()) {
      expect(sidecar.tile_size).toBe(TILE_SIZE);
      expect(sidecar.footprint_tiles).toEqual({ width: 1, height: 1 });
      expect(sidecar.sprite_size_px.width).toBe(TILE_SIZE);
      const overhang = sidecar.sprite_size_px.height - TILE_SIZE;
      expect(overhang).toBeGreaterThan(0);
      expect(sidecar.sprite_offset_px).toEqual({ x: 0, y: -overhang });
    }
  });

  test("carry a frame range for every growth stage the game knows", () => {
    for (const [name, sidecar] of sidecars) {
      expect({ name, ranges: new Set(Object.keys(sidecar.animations)) }).toEqual({
        name,
        ranges: new Set(PLANT_STAGES.map((s) => `stage_${s}`)),
      });
    }
  });

  test("name ranges inside the sheet that between them cover every frame", () => {
    for (const [name, sidecar] of sidecars) {
      const claimed = new Set<number>();
      for (const range of Object.values(sidecar.animations)) {
        expect(range.end - range.start + 1).toBe(range.frame_count);
        expect(range.end).toBeLessThan(sidecar.frame_count);
        for (let i = range.start; i <= range.end; i++) claimed.add(i);
      }
      expect({ name, covered: claimed.size }).toEqual({ name, covered: sidecar.frame_count });
    }
  });

  test("put each stage on its own sheet row", () => {
    for (const sidecar of sidecars.values()) {
      const sheet = sidecar.sheet;
      if (!sheet) throw new Error("no sheet");
      expect(sheet.rows).toBe(PLANT_STAGES.length);
      for (const range of Object.values(sidecar.animations)) {
        expect(range.start % sheet.columns).toBe(0);
      }
    }
  });
});

/**
 * The three flowers, which ship beside the fixtures and are not fixtures.
 *
 * `FLOWER_LOOKS` is stated in the game as well as shipped in the sidecar,
 * because the colour chooser has to offer the colours before any art has
 * loaded. Two places that have to agree is one place that can drift, and
 * this is where they are held together.
 */
describe("the shipped flowers", () => {
  const sidecars = new Map(
    FLOWER_TYPES.map((f) => [f, readJson<FixtureSidecar>("fixtures", `${f}.json`)]),
  );

  test("ship every colour a child can plant them in", () => {
    for (const [name, sidecar] of sidecars) {
      expect({ name, looks: sidecar.looks }).toEqual({ name, looks: FLOWER_LOOKS });
      expect({ name, count: sidecar.frame_count }).toEqual({
        name,
        count: FLOWER_LOOKS * sidecar.frames_per_look,
      });
      const sheet = sidecar.sheet;
      if (!sheet) throw new Error(`${name} has no sheet`);
      expect(existsSync(join(ASSETS, "fixtures", sheet.file))).toBe(true);
    }
  });

  // A look past the end of the sheet draws nothing at all, silently.
  test("and every frame those colours use is on the sheet", () => {
    for (const [name, sidecar] of sidecars) {
      for (let look = 0; look < FLOWER_LOOKS; look++) {
        for (const frame of flowerFrames(look, sidecar.frames_per_look)) {
          expect({ name, look, inSheet: frame < sidecar.frame_count }).toEqual({
            name,
            look,
            inSheet: true,
          });
        }
      }
    }
  });

  // Drawn on the same canvas as everything else that stands on a cell, so
  // the renderer needs no special case to put one on the ground.
  test("and stand on their cell like anything else does", () => {
    for (const sidecar of sidecars.values()) {
      expect(sidecar.tile_size).toBe(TILE_SIZE);
      expect(sidecar.footprint_tiles).toEqual({ width: 1, height: 1 });
      expect(sidecar.sprite_size_px.width).toBe(TILE_SIZE);
      const overhang = sidecar.sprite_size_px.height - TILE_SIZE;
      expect(overhang).toBeGreaterThan(0);
      expect(sidecar.sprite_offset_px).toEqual({ x: 0, y: -overhang });
    }
  });
});

describe("the shipped fixtures", () => {
  const sidecars = new Map(
    FIXTURE_TYPES.map((f) => [f, readJson<FixtureSidecar>("fixtures", `${f}.json`)]),
  );

  test("ship the sheet PNG they name", () => {
    for (const [name, sidecar] of sidecars) {
      const sheet = sidecar.sheet;
      if (!sheet) throw new Error(`${name} has no sheet`);
      expect(existsSync(join(ASSETS, "fixtures", sheet.file))).toBe(true);
      expect(sheet.frame_count).toBe(sidecar.frame_count);
    }
  });

  test("are 1:1 art one cell wide, overhanging upward", () => {
    for (const sidecar of sidecars.values()) {
      expect(sidecar.tile_size).toBe(TILE_SIZE);
      expect(sidecar.footprint_tiles).toEqual({ width: 1, height: 1 });
      expect(sidecar.sprite_size_px.width).toBe(TILE_SIZE);
      const overhang = sidecar.sprite_size_px.height - TILE_SIZE;
      expect(overhang).toBeGreaterThan(0);
      expect(sidecar.sprite_offset_px).toEqual({ x: 0, y: -overhang });
    }
  });

  /**
   * Every fixture comes in one colour. The flowers are not fixtures.
   *
   * They are drawn by the same generator module and shipped into the same
   * folder, which is why this is the file that checks it — but they are
   * their own type in the game, so a flower turning up in `FIXTURE_TYPES`
   * would mean the store could sell one and the crate could hold one.
   */
  test("come in one colour each, and as many ways round as they say", () => {
    for (const [name, sidecar] of sidecars) {
      // A look is a colourway *and* a way round now. No fixture has two
      // colourways, so the looks a sidecar ships are exactly the drawings
      // the game thinks that fixture turns through — and this is the guard
      // that holds the two halves of that together across two languages,
      // the way the footprints and the landmark overhangs are held.
      expect({ name, looks: sidecar.looks }).toEqual({ name, looks: turnsOf(name) });
      expect({ name, count: sidecar.frame_count }).toEqual({
        name,
        count: sidecar.looks * sidecar.frames_per_look,
      });
    }
    // And everything a child can put down really does turn. Without this the
    // table above would be satisfied by claiming nothing turns at all.
    //
    // Every placeable rather than "at least one", because that is the rule
    // now: a thing you can set down is a thing you can face. The failure it
    // is here for is the quiet one — somebody adds a placeable, ships one
    // drawing of it, and it is the single item in the crate that ignores a
    // tap, which reads as a broken control rather than as a thing that does
    // not turn.
    const still = PLACEABLE_FIXTURES.filter((one) => turnsOf(one) <= 1);
    expect(still).toEqual([]);
    for (const flower of FLOWER_TYPES) {
      expect((FIXTURE_TYPES as readonly string[]).includes(flower)).toBe(false);
    }
  });

  test("block the cell they stand on", () => {
    for (const sidecar of sidecars.values()) {
      expect(sidecar.blocked_cells_relative_to_anchor).toEqual([[0, 0]]);
    }
  });
});

describe("every object the village places", () => {
  // GameScene throws rather than drawing a placeholder for an object type it
  // has no art for. This is what makes that throw unreachable: if a story
  // area starts placing something new, this fails before the game does.
  const world = generateWorld(120, 120, 4242);

  test("resolves to a building, a fixture, a landmark or a piece of scenery", () => {
    const placed = world.grid.listObjects();
    expect(placed.length).toBeGreaterThan(0);
    const kinds = new Set<string>();
    for (const object of placed) {
      const asBuilding = ROLE_SPRITES[object.type as keyof typeof ROLE_SPRITES];
      const asFixture = fixtureFor(object.type);
      const asScenery = sceneryKind(object.type);
      const asLandmark = landmarkFor(object.type);
      // And the fifth kind: a flower growing wild, which is drawn from a
      // fixture sheet without being a fixture.
      const asWildFlower = wildFlowerFor(object.type);
      kinds.add(object.type);
      expect({
        type: object.type,
        hasArt: Boolean(asBuilding ?? asFixture ?? asScenery ?? asLandmark ?? asWildFlower),
      }).toEqual({
        type: object.type,
        hasArt: true,
      });
    }
    // The world places all four kinds, so this is actually exercising the
    // dispatch rather than one branch of it.
    expect([...kinds].some((t) => sceneryKind(t))).toBe(true);
    expect([...kinds].some((t) => fixtureFor(t))).toBe(true);
    expect([...kinds].some((t) => landmarkFor(t))).toBe(true);
    expect([...kinds].some((t) => wildFlowerFor(t))).toBe(true);
  });

  /**
   * Every world grows all three, and grows them where they can be got to.
   *
   * The one property of this feature no unit test of `flowers.ts` can see:
   * that module chooses between cells it is handed, and whether *those* are
   * reachable is a fact about the world the generator built. A flower behind
   * water is a quest that cannot be finished, and it would only happen on
   * some seeds — which is a bug that passes every check anybody runs.
   */
  test("and grows all three flowers where a child can reach them", () => {
    for (const seed of [1, 5, 12345, 777, 2026]) {
      const world = generateWorld(220, 220, seed);
      expect({ seed, kinds: world.wildFlowers.map((one) => one.flower) }).toEqual({
        seed,
        kinds: [...FLOWER_TYPES],
      });
      const reachable = floodFillReachable(world.grid, world.village.playerDoorstep);
      for (const spot of world.wildFlowers) {
        expect({ seed, spot, reachable: isReachable(reachable, world.grid, spot) }).toEqual({
          seed,
          spot,
          reachable: true,
        });
        // And standing on the cell the world says it is on.
        const object = world.grid.getObjectAt(spot.col, spot.row);
        expect({ seed, type: object?.type ?? null }).toEqual({
          seed,
          type: wildFlowerObject(spot.flower),
        });
        // Walked into rather than round: a flower that stopped a child dead
        // in a meadow would read as a rock drawn wrong.
        expect({ seed, blocks: object?.blocksMovement }).toEqual({ seed, blocks: false });
      }
    }
  });
});

describe("the shipped landmarks", () => {
  const sidecars = new Map(
    LANDMARK_TYPES.map((k) => [k, readJson<LandmarkSidecar>("landmarks", `${k}.json`)]),
  );

  test("ships the sheet PNG it names", () => {
    for (const [name, sidecar] of sidecars) {
      const sheet = sidecar.sheet;
      if (!sheet) throw new Error(`${name} has no sheet`);
      expect(existsSync(join(ASSETS, "landmarks", sheet.file))).toBe(true);
      expect(sheet.frame_count).toBe(sidecar.frame_count);
    }
  });

  test("names itself, so the game and the generator cannot drift apart", () => {
    for (const [name, sidecar] of sidecars) expect(sidecar.landmark).toBe(name);
  });

  // The one thing about a landmark the scene depends on and cannot check for
  // itself: the tap area is the footprint's own columns centred in the
  // canvas, so an asymmetric overhang would put it over the wrong tiles.
  test("overhangs its footprint evenly on both sides, and only upward", () => {
    for (const sidecar of sidecars.values()) {
      expect(sidecar.tile_size).toBe(TILE_SIZE);
      const across = sidecar.sprite_size_px.width - sidecar.footprint_tiles.width * TILE_SIZE;
      const above = sidecar.sprite_size_px.height - sidecar.footprint_tiles.height * TILE_SIZE;
      expect(across % 2).toBe(0);
      expect(across).toBeGreaterThan(0);
      expect(above).toBeGreaterThan(0);
      expect(sidecar.sprite_offset_px).toEqual({ x: -across / 2, y: -above });
    }
  });

  /**
   * The layout has to know how much of the view a landmark takes before any
   * art is loaded, so the overhang is written down twice — here and in the
   * sidecar — and this is the guard that keeps the two the same.
   *
   * A playtest is why it exists: the city put a townhouse in the block behind
   * the clock tower, the tower is five tiles taller than the two it stands
   * on, and the townhouse was drawn over completely. Nothing was blocked;
   * something was invisible, which from the outside is the same thing.
   */
  test("says in tiles how far it rises above what it stands on", () => {
    for (const [name, sidecar] of sidecars) {
      const above = sidecar.sprite_size_px.height - sidecar.footprint_tiles.height * TILE_SIZE;
      expect({ name, tiles: LANDMARK_OVERHANG[name] }).toEqual({
        name,
        tiles: Math.ceil(above / TILE_SIZE),
      });
    }
  });

  test("blocks every cell of its footprint — you cannot walk through a tree", () => {
    for (const sidecar of sidecars.values()) {
      const { width, height } = sidecar.footprint_tiles;
      expect(sidecar.blocked_cells_relative_to_anchor.length).toBe(width * height);
    }
  });

  test("has one idle animation covering the whole sheet", () => {
    for (const [name, sidecar] of sidecars) {
      expect({ name, animations: Object.keys(sidecar.animations) }).toEqual({
        name,
        animations: ["idle"],
      });
      const idle = sidecar.animations.idle;
      expect(idle?.start).toBe(0);
      expect(idle?.end).toBe(sidecar.frame_count - 1);
    }
  });
});

describe("the shipped scenery", () => {
  const sidecars = new Map(
    SCENERY_KINDS.map((k) => [k, readJson<ObjectSidecar>("objects", `${k}.json`)]),
  );

  test("exists for every kind of ground that grows something", () => {
    for (const kind of SCENERY_KINDS) {
      expect(sidecars.get(kind)?.terrain).toBe(kind);
    }
  });

  test("ships the sheet PNG it names", () => {
    for (const [name, sidecar] of sidecars) {
      const sheet = sidecar.sheet;
      if (!sheet) throw new Error(`${name} has no sheet`);
      expect(existsSync(join(ASSETS, "objects", sheet.file))).toBe(true);
      expect(sheet.frame_count).toBe(sidecar.frame_count);
    }
  });

  test("is 1:1 art on one tile, overhanging it on three sides", () => {
    // One tile rather than four. Objects were 2x2 when a tree stood as tall
    // as a house; at a tree of one and three quarter people that would be a
    // sapling in the middle of four blocked tiles, and a wood nobody could
    // walk into. The art still overhangs — a canopy hangs over the tiles
    // around the one it grows out of, the way a roof overhangs its walls —
    // and the offsets are what put it back over its own cell.
    for (const sidecar of sidecars.values()) {
      expect(sidecar.tile_size).toBe(TILE_SIZE);
      expect(sidecar.footprint_tiles).toEqual({ width: 1, height: 1 });
      const across = sidecar.sprite_size_px.width - TILE_SIZE;
      const above = sidecar.sprite_size_px.height - TILE_SIZE;
      expect(above).toBeGreaterThan(0);
      // Symmetrical across, so half of the spare width is the x offset.
      expect(across % 2).toBe(0);
      expect(sidecar.sprite_offset_px).toEqual({ x: -across / 2, y: -above });
    }
  });

  test("blocks the one cell it grows out of", () => {
    for (const sidecar of sidecars.values()) {
      expect(sidecar.blocked_cells_relative_to_anchor).toEqual([[0, 0]]);
    }
  });

  test("ships several distinct individuals", () => {
    // One silhouette repeated along a wall hundreds long reads as wallpaper,
    // which is the whole reason the generator renders more than one.
    for (const [name, sidecar] of sidecars) {
      expect({ name, enough: sidecar.instances >= 2 }).toEqual({ name, enough: true });
    }
  });

  test("names a frame range for every individual, covering the whole sheet", () => {
    for (const [name, sidecar] of sidecars) {
      const names = Object.keys(sidecar.animations);
      expect({ name, count: names.length }).toEqual({ name, count: sidecar.instances });
      const claimed = new Set<number>();
      for (const range of Object.values(sidecar.animations)) {
        expect(range.end).toBeLessThan(sidecar.frame_count);
        for (let i = range.start; i <= range.end; i++) claimed.add(i);
      }
      expect({ name, covered: claimed.size }).toEqual({ name, covered: sidecar.frame_count });
    }
  });

  test("puts each individual on its own sheet row", () => {
    for (const sidecar of sidecars.values()) {
      const sheet = sidecar.sheet;
      if (!sheet) throw new Error("no sheet");
      expect(sheet.rows).toBe(sidecar.instances);
      for (const range of Object.values(sidecar.animations)) {
        expect(range.start % sheet.columns).toBe(0);
      }
    }
  });
});

describe("the windows the game lights after dark", () => {
  /**
   * A house lights up because there is a fire in it, so the two facts have
   * to be shipped together: window rects on the building, a fireplace in the
   * room behind its door. Either one alone is a house that cannot light —
   * panes with nothing behind them, or a hearth nobody outside can see.
   */
  test("every building the village places says where its windows are", () => {
    for (const sprite of BUILDING_SPRITES) {
      const sidecar = readJson<BuildingSidecar>("buildings", `${sprite}.json`);
      expect({ sprite, said: Array.isArray(sidecar.window_rects_px) }).toEqual({
        sprite,
        said: true,
      });
    }
  });

  test("and the houses people live in have some", () => {
    for (const sprite of BUILDING_SPRITES) {
      const room = readJson<InteriorSidecar>("interiors", `${interiorFor(sprite)}.json`);
      if (!hearthCell(room)) continue;
      const sidecar = readJson<BuildingSidecar>("buildings", `${sprite}.json`);
      expect({ sprite, windows: (sidecar.window_rects_px ?? []).length > 0 }).toEqual({
        sprite,
        windows: true,
      });
    }
  });

  // Inside the frame, which is the space they are measured in. A rect that
  // ran off the sheet would put firelight on the grass beside the house.
  test("and every one of them is inside the sprite", () => {
    for (const sprite of BUILDING_SPRITES) {
      const sidecar = readJson<BuildingSidecar>("buildings", `${sprite}.json`);
      const { width, height } = sidecar.sprite_size_px;
      for (const [x, y, w, h] of sidecar.window_rects_px ?? []) {
        expect({ sprite, fits: x >= 0 && y >= 0 && x + w <= width && y + h <= height }).toEqual({
          sprite,
          fits: true,
        });
      }
    }
  });
});

describe("the flags on the language chooser", () => {
  /**
   * The chooser is the one screen a child meets before they can read the
   * screen it is on: it is written in whatever language the last person to
   * play chose, so a German-reading child meets it in English. The flag is
   * what they can act on.
   */
  test("every language has one, and no two share it", () => {
    const flags = LANGUAGES.map(flagIcon);
    expect(new Set(flags).size).toBe(LANGUAGES.length);
    // A copied lambda in the generator's asset index would ship two buttons
    // showing one flag, and a chooser that does not choose.
    for (const flag of flags) expect(UI_ASSETS).toContain(flag);
  });

  // Every other icon here is square and drawn to a common box. A flag is a
  // rectangle, and one squashed into a square is a flag drawn wrong rather
  // than a flag drawn small.
  test("and each is a rectangle rather than a square", () => {
    const index = readJson<UiIndex>("ui", "ui.json");
    for (const flag of LANGUAGES.map(flagIcon)) {
      const entry = uiEntry(index, flag);
      expect({ flag, wide: entry.width > entry.height }).toEqual({ flag, wide: true });
    }
  });
});

describe("the shipped interface art", () => {
  const index = readJson<UiIndex>("ui", "ui.json");

  test("names every asset the game asks for", () => {
    for (const asset of UI_ASSETS) {
      expect(() => uiEntry(index, asset)).not.toThrow();
    }
  });

  /**
   * The direction the other two do not look, and the one that was missing.
   *
   * Both tests above start from `UI_ASSETS` and ask whether the art is
   * there. That can only ever catch art the generator forgot to draw — and
   * the wood and stone icons were drawn, indexed and shipped, and then not
   * loaded, because their name was defined next to what a cleared tree is
   * worth rather than next to the list of icons to load. Every basket, shop
   * row and clearing reward drew a texture that did not exist.
   *
   * So: an entry in `ui.json` that nothing asks for is a bug too, and it is
   * the same bug seen from the generator's side.
   */
  test("and asks for every asset it names", () => {
    expect([...Object.keys(index.assets)].sort()).toEqual([...UI_ASSETS].sort());
  });

  test("ships the file each entry points at", () => {
    for (const asset of UI_ASSETS) {
      expect({ asset, there: existsSync(join(ASSETS, "ui", uiEntry(index, asset).file)) }).toEqual({
        asset,
        there: true,
      });
    }
  });

  // The popup positions its whole border from these, and a frame whose
  // insets do not fit inside it does not fail to draw: it draws the corner
  // ornament stretched across the entire top edge.
  test("gives the parchment frame nine-slice insets that fit inside it", () => {
    const frame = uiEntry(index, UiAsset.ParchmentFrame);
    const insets = frame.nine_slice;
    if (!insets) throw new Error("parchment-frame has no nine_slice insets");
    expect(insets.left + insets.right).toBeLessThan(frame.width);
    expect(insets.top + insets.bottom).toBeLessThan(frame.height);
  });

  // The fill is repeated across a panel rather than scaled to it, so it has
  // to be small enough that repeating is cheap and the panel is not one
  // single copy of it.
  test("marks the fill as tiling, and keeps it smaller than a panel", () => {
    const fill = uiEntry(index, UiAsset.ParchmentFill);
    expect(fill.tiles).toBe(true);
    expect(fill.width).toBeLessThanOrEqual(256);
    expect(fill.height).toBeLessThanOrEqual(256);
  });
});

describe("the shipped spell effects", () => {
  const sidecars = new Map(
    EFFECT_TYPES.map((e) => [e, readJson<EffectSidecar>("effects", `${e}.json`)] as const),
  );

  test("each names the animation the game asks for", () => {
    for (const [effect, sidecar] of sidecars) {
      expect({ effect, key: `effect-${effect}-cast` }).toEqual({
        effect,
        key: effectAnimKey(effect),
      });
      expect(Object.keys(sidecar.animations)).toContain("cast");
    }
  });

  test("declares itself as playing once, not looping", () => {
    // The game reads this rather than deciding it. An effect left looping is
    // a sprite that never goes away, sitting on top of the crop it landed on.
    for (const [effect, sidecar] of sidecars) {
      expect({ effect, loops: sidecar.loops }).toEqual({ effect, loops: false });
    }
  });

  test("covers exactly one tile and hangs above it", () => {
    for (const [effect, sidecar] of sidecars) {
      expect({ effect, w: sidecar.footprint_tiles.width }).toEqual({ effect, w: 1 });
      expect({ effect, h: sidecar.footprint_tiles.height }).toEqual({ effect, h: 1 });
      expect(sidecar.sprite_size_px.width).toBe(TILE_SIZE);
      // Taller than its tile, and the offset that lifts it is exactly the
      // overhang — the same contract every sprite that rises above its cell
      // follows, and what puts the plus over the crop rather than beside it.
      expect(sidecar.sprite_size_px.height).toBeGreaterThan(TILE_SIZE);
      expect(sidecar.sprite_offset_px.y).toBe(TILE_SIZE - sidecar.sprite_size_px.height);
    }
  });

  test("its animation range covers the whole sheet", () => {
    for (const [effect, sidecar] of sidecars) {
      const range = sidecar.animations.cast;
      if (!range) throw new Error(`${effect} has no cast range`);
      expect({ effect, start: range.start }).toEqual({ effect, start: 0 });
      expect({ effect, end: range.end }).toEqual({ effect, end: sidecar.frame_count - 1 });
    }
  });

  test("the sheet holds as many frames as the sidecar declares", () => {
    for (const [effect, sidecar] of sidecars) {
      const sheet = sidecar.sheet;
      if (!sheet) throw new Error(`${effect} has no sheet`);
      expect({ effect, count: sheet.frame_count }).toEqual({
        effect,
        count: sidecar.frame_count,
      });
      expect(existsSync(join(ASSETS, "effects", sheet.file))).toBe(true);
    }
  });

  test("its sidecar key is distinct from every other asset's", () => {
    expect(new Set(EFFECT_TYPES.map(effectSidecarKey)).size).toBe(EFFECT_TYPES.length);
  });
});

describe("the shipped rooms have somewhere to stand behind a counter", () => {
  // The shopkeeper is spawned into her room when the player walks in, on a
  // cell chosen from the room's own walkability. A room with nowhere to put
  // her throws at that moment, which is a long way from the asset that caused
  // it.
  test("every room offers a walkable cell away from its door", () => {
    for (const room of INTERIOR_ROOMS) {
      const sidecar = readJson<InteriorSidecar>("interiors", `${room}.json`);
      const cell = interiorAttendantCell(sidecar);
      expect({ room, found: cell !== null }).toEqual({ room, found: true });
      if (!cell) continue;
      const grid = buildInteriorGrid(sidecar);
      expect({ room, walkable: grid.isPassable(cell.col, cell.row) }).toEqual({
        room,
        walkable: true,
      });
      const door = interiorDoor(sidecar);
      const depth = sidecar.size_cells.rows;
      expect({ room, far: Math.abs(cell.row - door.row) * 2 >= depth - 1 }).toEqual({
        room,
        far: true,
      });
    }
  });
});

/**
 * The room a child furnishes, and the two facts about it the game states
 * without asking the art.
 *
 * `turnsOfPiece` and the footprints are both written down in `decor.ts`,
 * because the basket and the shop have to know what a piece can do before
 * anything has loaded. This is the guard that keeps those copies honest —
 * the same one the fixtures, the building footprints and the landmark
 * overhangs have, for the same reason.
 */
describe("the shipped room a child furnishes", () => {
  const sidecar = readJson<GrowableSidecar>("interiors", `${GROWABLE_ROOM}_growable.json`);

  test("ships as many drawings of each piece as the game turns it through", () => {
    for (const piece of DECOR_TYPES) {
      const sheet = sidecar.piece_sheets[pieceArt(piece)];
      expect({ piece, has: sheet !== undefined }).toEqual({ piece, has: true });
      if (!sheet) continue;
      expect({ piece, looks: sheet.looks ?? 1 }).toEqual({ piece, looks: turnsOfPiece(piece) });
      // And the strip divides exactly: a piece's motion in each of its ways
      // round, with nothing left over. A remainder here is a sheet the game
      // would index off the end of.
      expect({ piece, count: sheet.frame_count }).toEqual({
        piece,
        count: (sheet.looks ?? 1) * framesPerLook(sheet),
      });
    }
  });

  /**
   * And the ones that do not turn are the ones that are not square.
   *
   * The rule is about the *footprint*: a quarter turn of a one-by-two bed
   * makes it two-by-one, which changes which cells it takes and whether it
   * still fits. A square piece has no such problem, so it turns. If this
   * drifted, either a child would be offered a turn that silently resized a
   * bed, or a square piece would refuse to turn for no visible reason.
   */
  test("and the ones held back are exactly the ones a turn would resize", () => {
    for (const [name, piece] of Object.entries(sidecar.pieces)) {
      const decor = DECOR_TYPES.find((one) => pieceArt(one) === name);
      if (!decor) continue;
      const [cols, rows] = (piece as { footprint: readonly [number, number] }).footprint;
      expect({ decor, turns: canTurnPiece(decor) }).toEqual({ decor, turns: cols === rows });
    }
  });
});
