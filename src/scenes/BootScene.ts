// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import Phaser from "phaser";
import { BUILDING_SPRITES, type BuildingSprite, spriteSheetKey } from "../world/buildings";
import { ALL_CHARACTERS, characterSheetKey, characterSidecarKey } from "../world/characters";
import { INTERIOR_ROOMS, interiorSheetKey, interiorSidecarKey } from "../world/interiors";
import { PLANT_TYPES, plantSheetKey, plantSidecarKey } from "../world/plants";
import type {
  BuildingSidecar,
  CharacterSidecar,
  InteriorSidecar,
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
    // One request and one texture for all ~3300 terrain tiles, including
    // every 3- and 4-terrain corner cell. The second argument is the
    // directory the atlas's own page filenames resolve against.
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
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.verifyFrameCounts();
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
    for (const [name, key, count] of expected) {
      // Phaser counts its own __BASE frame alongside the sliced ones.
      const actual = this.textures.get(key).frameTotal - 1;
      if (actual !== count) {
        throw new Error(`${name} sliced into ${actual} frames, sidecar declares ${count}`);
      }
    }
  }
}
