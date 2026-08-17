// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import Phaser from "phaser";
import { BUILDING_TYPES, BUILDING_VARIANTS, buildingSpriteKey } from "../world/buildingSprites";
import { DRAWABLE_MASKS, TERRAIN_TYPES, TILE_VARIANTS, dualTileKey } from "../world/tileset";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload(): void {
    for (const terrain of TERRAIN_TYPES) {
      for (const mask of DRAWABLE_MASKS) {
        for (let variant = 0; variant < TILE_VARIANTS; variant++) {
          const key = dualTileKey(terrain, mask, variant);
          this.load.image(key, `${import.meta.env.BASE_URL}assets/tiles/${key}.png`);
        }
      }
    }
    for (const type of BUILDING_TYPES) {
      for (let variant = 0; variant < BUILDING_VARIANTS; variant++) {
        const key = buildingSpriteKey(type, variant);
        this.load.image(key, `${import.meta.env.BASE_URL}assets/buildings/${key}.png`);
      }
    }
  }

  create(): void {
    this.scene.start("game");
  }
}
