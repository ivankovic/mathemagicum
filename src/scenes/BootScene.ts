// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import Phaser from "phaser";
import { BUILDING_SPRITES, type BuildingSprite, spriteSheetKey } from "../world/buildings";
import type { BuildingSidecar } from "../world/spriteSidecar";
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
  }

  create(): void {
    for (const sprite of BUILDING_SPRITES) {
      const sidecar = this.cache.json.get(sidecarKey(sprite)) as BuildingSidecar | undefined;
      const sheet = sidecar?.sheet;
      if (!sheet) throw new Error(`${sprite}.json has no "sheet" — regenerate it with --sheets`);
      this.load.spritesheet(
        spriteSheetKey(sprite),
        `${this.base()}assets/buildings/${sheet.file}`,
        {
          frameWidth: sheet.frame_width,
          frameHeight: sheet.frame_height,
          margin: sheet.margin,
          spacing: sheet.spacing,
        },
      );
    }
    this.load.once(Phaser.Loader.Events.COMPLETE, () => this.scene.start("game"));
    this.load.start();
  }
}
