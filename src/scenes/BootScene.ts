// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import Phaser from "phaser";
import {
  CANONICAL_BLOB_MASKS,
  CORNER_OFFSETS,
  EDGE_OFFSETS,
  TERRAIN_TYPES,
  TILE_VARIANTS,
  blobTileKey,
  cornerWedgeKey,
  edgeWedgeKey,
} from "../world/tileset";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload(): void {
    for (const terrain of TERRAIN_TYPES) {
      for (const mask of CANONICAL_BLOB_MASKS) {
        const variants = mask === 0 ? TILE_VARIANTS : 1;
        for (let variant = 0; variant < variants; variant++) {
          const key = blobTileKey(terrain, mask, variant);
          this.load.image(key, `${import.meta.env.BASE_URL}assets/tiles/${key}.png`);
        }
      }
      for (const { bit } of EDGE_OFFSETS) {
        const key = edgeWedgeKey(terrain, bit);
        this.load.image(key, `${import.meta.env.BASE_URL}assets/tiles/${key}.png`);
      }
      for (const { bit } of CORNER_OFFSETS) {
        const key = cornerWedgeKey(terrain, bit);
        this.load.image(key, `${import.meta.env.BASE_URL}assets/tiles/${key}.png`);
      }
    }
  }

  create(): void {
    this.scene.start("game");
  }
}
