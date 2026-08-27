// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import { BuildingSprite, DoorState, buildingAnimKey, spriteSheetKey } from "../world/buildings";
import type { Berth } from "../world/harbour";
import { VISIT, alongLane, shipsAt } from "../world/shipping";
import { type SpriteSidecar, footprintBottomY, spriteOrigin } from "../world/spriteSidecar";
import { depthFor } from "../world/topdown";

/**
 * The hulls that come and go at the harbour's piers.
 *
 * A thing that owns some sprites and moves them, taken out of `GameScene` —
 * which is ten thousand lines and holds the world, every spell, the interface
 * and the dev seams. This is the shape the pieces come out in: `shipping.ts`
 * already owns the arithmetic and `harbour.ts` the water, so what was left in
 * the scene was a sprite pool and two calls. It is a class rather than a pair
 * of functions for the same reason `VirtualJoystick` is: it has state, the
 * state is a handful of sprites, and the scene should not be holding them.
 *
 * **What it is not told is as deliberate as what it is.** No clock, no dev
 * seams, no profile: `sail` takes the minute it is to draw. Whether that
 * minute comes from the world's clock or is pinned so a screenshot can be
 * taken is the scene's business, and a class that reached for `?freezeNpcs`
 * itself would be a class that could not be reasoned about without it.
 */
export class HarbourTraffic {
  private readonly ships: Phaser.GameObjects.Sprite[] = [];

  /**
   * One hull per berth, made once and moved for the rest of the game.
   *
   * They are drawn from the great ship's own sheet, playing her closed-door
   * bob, and each painted from her own name so that four hulls at four piers
   * are four ships rather than one drawn four times — the argument the
   * village cottages are repainted on.
   *
   * `paint` is handed in rather than reached for: repainting a sheet is the
   * scene's own machinery, and it falls back to the shipped colours when a
   * repaint is not possible, so this cannot fail into a missing texture.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly berths: readonly Berth[],
    private readonly sidecar: SpriteSidecar,
    private readonly origin: { readonly x: number; readonly y: number },
    private readonly seed: number,
    paint: (name: string, sprite: BuildingSprite) => string,
    place: <T extends Phaser.GameObjects.GameObject>(object: T) => T,
  ) {
    if (!scene.anims.exists(buildingAnimKey(BuildingSprite.Ship, DoorState.Closed))) return;
    for (const [n] of berths.entries()) {
      const painted = paint(`harbour-visitor-${n}`, BuildingSprite.Ship);
      this.ships.push(
        place(
          scene.add
            .sprite(0, 0, spriteSheetKey(painted))
            .setOrigin(0, 0)
            .setVisible(false)
            .play(buildingAnimKey(painted, DoorState.Closed)),
        ),
      );
    }
  }

  /**
   * Move them along their lanes, and hide the berths nobody is at.
   *
   * Hidden is how a berth stands empty: there are at most a handful of these
   * and a harbour that built and threw away a hull every few minutes would
   * stutter every few minutes.
   */
  sail(minutes: number): void {
    if (this.ships.length === 0) return;
    for (const ship of this.ships) ship.setVisible(false);
    for (const sailing of shipsAt(minutes, this.berths.length, this.seed)) {
      const lane = this.berths[sailing.berth]?.lane;
      const ship = this.ships[sailing.berth];
      if (!lane || !ship) continue;
      const at = alongLane(lane, sailing.along);
      const where = spriteOrigin(this.sidecar, at.col, at.row);
      ship
        .setPosition(this.origin.x + where.x, this.origin.y + where.y)
        .setDepth(depthFor(footprintBottomY(this.sidecar, at.row)))
        .setVisible(true);
    }
    void this.scene;
  }

  /** Where every hull currently in port is, in world pixels. A dev seam. */
  positions(): { x: number; y: number }[] {
    return this.ships.filter((ship) => ship.visible).map((ship) => ({ x: ship.x, y: ship.y }));
  }
}

/**
 * Where the tide stands in a frozen world.
 *
 * `?freezeNpcs` holds the villagers still so a script knows where they are,
 * and a ship sailing through that would be the one thing on screen it could
 * not pin. Halfway through a visit, so the harbour a screenshot catches has
 * ships *in* it rather than an empty bay — a frozen world should look like
 * the world, not like a Sunday.
 */
export const FROZEN_TIDE = VISIT * 0.6;
