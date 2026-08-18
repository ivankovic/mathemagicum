// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import Phaser from "phaser";
import { UI_ASSETS, UI_SIDECAR_KEY, type UiIndex, uiEntry, uiTextureKey } from "../ui/assets";
import { BUILDING_SPRITES, type BuildingSprite, spriteSheetKey } from "../world/buildings";
import { ALL_CHARACTERS, characterSheetKey, characterSidecarKey } from "../world/characters";
import { EFFECT_TYPES, effectSheetKey, effectSidecarKey } from "../world/effects";
import { FIXTURE_TYPES, fixtureSheetKey, fixtureSidecarKey } from "../world/fixtures";
import { INTERIOR_ROOMS, interiorSheetKey, interiorSidecarKey } from "../world/interiors";
import { PLANT_TYPES, plantSheetKey, plantSidecarKey } from "../world/plants";
import { SCENERY_KINDS, scenerySheetKey, scenerySidecarKey } from "../world/scenery";
import type {
  BuildingSidecar,
  CharacterSidecar,
  EffectSidecar,
  FixtureSidecar,
  InteriorSidecar,
  ObjectSidecar,
  PlantSidecar,
  SheetLayout,
} from "../world/spriteSidecar";
import { TERRAIN_ATLAS_KEY } from "../world/terrainAtlas";

export function sidecarKey(sprite: BuildingSprite): string {
  return `sidecar-${sprite}`;
}

// Loading happens in two passes, because a spritesheet's frame size is not
// something this repo knows: it lives in the sidecar the asset generator
// ships next to the sheet. Pass one fetches the sidecars, pass two uses them
// to slice the sheets. The alternative — hardcoding frame sizes here — is
// exactly the kind of silent cross-repo contract that breaks the next time
// a building grows a taller roof.
export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  private base(): string {
    return import.meta.env.BASE_URL;
  }

  preload(): void {
    // Every terrain tile the world can need, including every 3- and
    // 4-terrain corner cell: ~5300 of them, over two pages since the village
    // square was paved. A multiatlas is one request either way. The second
    // argument is the directory the atlas's own page filenames resolve
    // against.
    this.load.multiatlas(
      TERRAIN_ATLAS_KEY,
      `${this.base()}assets/terrain/terrain.json`,
      `${this.base()}assets/terrain`,
    );
    for (const sprite of BUILDING_SPRITES) {
      this.load.json(sidecarKey(sprite), `${this.base()}assets/buildings/${sprite}.json`);
    }
    for (const character of ALL_CHARACTERS) {
      this.load.json(
        characterSidecarKey(character),
        `${this.base()}assets/characters/${character}.json`,
      );
    }
    for (const room of INTERIOR_ROOMS) {
      this.load.json(interiorSidecarKey(room), `${this.base()}assets/interiors/${room}.json`);
    }
    for (const plant of PLANT_TYPES) {
      this.load.json(plantSidecarKey(plant), `${this.base()}assets/plants/${plant}.json`);
    }
    for (const fixture of FIXTURE_TYPES) {
      this.load.json(fixtureSidecarKey(fixture), `${this.base()}assets/fixtures/${fixture}.json`);
    }
    for (const kind of SCENERY_KINDS) {
      this.load.json(scenerySidecarKey(kind), `${this.base()}assets/objects/${kind}.json`);
    }
    for (const effect of EFFECT_TYPES) {
      this.load.json(effectSidecarKey(effect), `${this.base()}assets/effects/${effect}.json`);
    }
    // One index for the whole interface set rather than one per file — the
    // generator writes it that way because a panel has no frames to describe.
    this.load.json(UI_SIDECAR_KEY, `${this.base()}assets/ui/ui.json`);
  }

  create(): void {
    for (const sprite of BUILDING_SPRITES) {
      const sidecar = this.cache.json.get(sidecarKey(sprite)) as BuildingSidecar | undefined;
      this.queueSheet(spriteSheetKey(sprite), "buildings", sprite, sidecar?.sheet);
    }
    for (const character of ALL_CHARACTERS) {
      const sidecar = this.cache.json.get(characterSidecarKey(character)) as
        | CharacterSidecar
        | undefined;
      this.queueSheet(characterSheetKey(character), "characters", character, sidecar?.sheet);
    }
    for (const room of INTERIOR_ROOMS) {
      const sidecar = this.cache.json.get(interiorSidecarKey(room)) as InteriorSidecar | undefined;
      this.queueSheet(interiorSheetKey(room), "interiors", room, sidecar?.sheet);
    }
    for (const plant of PLANT_TYPES) {
      const sidecar = this.cache.json.get(plantSidecarKey(plant)) as PlantSidecar | undefined;
      this.queueSheet(plantSheetKey(plant), "plants", plant, sidecar?.sheet);
    }
    for (const fixture of FIXTURE_TYPES) {
      const sidecar = this.cache.json.get(fixtureSidecarKey(fixture)) as FixtureSidecar | undefined;
      this.queueSheet(fixtureSheetKey(fixture), "fixtures", fixture, sidecar?.sheet);
    }
    for (const kind of SCENERY_KINDS) {
      const sidecar = this.cache.json.get(scenerySidecarKey(kind)) as ObjectSidecar | undefined;
      this.queueSheet(scenerySheetKey(kind), "objects", kind, sidecar?.sheet);
    }
    for (const effect of EFFECT_TYPES) {
      const sidecar = this.cache.json.get(effectSidecarKey(effect)) as EffectSidecar | undefined;
      this.queueSheet(effectSheetKey(effect), "effects", effect, sidecar?.sheet);
    }
    // Plain images, not spritesheets: the parchment and the icons are single
    // frames, and the index says how big each one is so nothing here has to.
    const uiIndex = this.cache.json.get(UI_SIDECAR_KEY) as UiIndex | undefined;
    for (const asset of UI_ASSETS) {
      const entry = uiEntry(uiIndex, asset);
      this.load.image(uiTextureKey(asset), `${this.base()}assets/ui/${entry.file}`);
    }
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.verifyFrameCounts();
      this.verifyUiSizes(uiIndex);
      this.scene.start("game");
    });
    this.load.start();
  }

  private queueSheet(
    key: string,
    directory: string,
    name: string,
    sheet: SheetLayout | null | undefined,
  ): void {
    if (!sheet) throw new Error(`${name}.json has no "sheet" — regenerate it with --sheets`);
    this.load.spritesheet(key, `${this.base()}assets/${directory}/${sheet.file}`, {
      frameWidth: sheet.frame_width,
      frameHeight: sheet.frame_height,
      margin: sheet.margin,
      spacing: sheet.spacing,
    });
  }

  /**
   * Check every sheet sliced into as many frames as its sidecar promised.
   *
   * A character sheet is the only asset here laid out as a 2D grid, and both
   * of its axes are an exact multiple of the frame pitch with no slack. A
   * loader that miscounts a row loses it *silently*: the animations whose
   * frame range falls in the missing row simply have no frames, while every
   * other facing still plays. That surfaces in game as one direction where
   * the character freezes — a long way from the cause. One assertion here
   * turns it into a load-time error naming the sheet.
   */
  private verifyFrameCounts(): void {
    const expected: [string, string, number][] = [];
    for (const sprite of BUILDING_SPRITES) {
      const sidecar = this.cache.json.get(sidecarKey(sprite)) as BuildingSidecar;
      expected.push([sprite, spriteSheetKey(sprite), sidecar.frame_count]);
    }
    for (const character of ALL_CHARACTERS) {
      const sidecar = this.cache.json.get(characterSidecarKey(character)) as CharacterSidecar;
      expected.push([character, characterSheetKey(character), sidecar.frame_count]);
    }
    for (const room of INTERIOR_ROOMS) {
      const sheet = (this.cache.json.get(interiorSidecarKey(room)) as InteriorSidecar).sheet;
      if (sheet) expected.push([room, interiorSheetKey(room), sheet.frame_count]);
    }
    for (const plant of PLANT_TYPES) {
      const sidecar = this.cache.json.get(plantSidecarKey(plant)) as PlantSidecar;
      expected.push([plant, plantSheetKey(plant), sidecar.frame_count]);
    }
    for (const fixture of FIXTURE_TYPES) {
      const sidecar = this.cache.json.get(fixtureSidecarKey(fixture)) as FixtureSidecar;
      expected.push([fixture, fixtureSheetKey(fixture), sidecar.frame_count]);
    }
    for (const kind of SCENERY_KINDS) {
      const sidecar = this.cache.json.get(scenerySidecarKey(kind)) as ObjectSidecar;
      expected.push([kind, scenerySheetKey(kind), sidecar.frame_count]);
    }
    for (const effect of EFFECT_TYPES) {
      const sidecar = this.cache.json.get(effectSidecarKey(effect)) as EffectSidecar;
      expected.push([effect, effectSheetKey(effect), sidecar.frame_count]);
    }
    for (const [name, key, count] of expected) {
      // Phaser counts its own __BASE frame alongside the sliced ones.
      const actual = this.textures.get(key).frameTotal - 1;
      if (actual !== count) {
        throw new Error(`${name} sliced into ${actual} frames, sidecar declares ${count}`);
      }
    }
  }

  /**
   * Check the interface art is the size its index claims.
   *
   * The popup positions everything from these numbers — the nine-slice
   * insets especially — and a frame that is not the size the insets were
   * measured against does not fail to draw, it draws subtly wrong: a border
   * with its corner ornament stretched across the whole top edge. Cheaper to
   * catch here, naming the file.
   */
  private verifyUiSizes(index: UiIndex | undefined): void {
    for (const asset of UI_ASSETS) {
      const entry = uiEntry(index, asset);
      const source = this.textures.get(uiTextureKey(asset)).getSourceImage();
      if (source.width !== entry.width || source.height !== entry.height) {
        throw new Error(
          `${entry.file} is ${source.width}x${source.height}, ui.json declares ${entry.width}x${entry.height}`,
        );
      }
      const insets = entry.nine_slice;
      if (
        insets &&
        (insets.left + insets.right > entry.width || insets.top + insets.bottom > entry.height)
      ) {
        throw new Error(`${entry.file}'s nine-slice insets overlap`);
      }
    }
  }
}
