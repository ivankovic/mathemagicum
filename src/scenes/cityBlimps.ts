// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import {
  SkyThing as Sky,
  type SkyThing,
  mooredHouses,
  skyAnimKey,
  skySheetKey,
} from "../world/skyline";

/**
 * The airships moored over the city's rooftops.
 *
 * A sprite pool the scene owns, in the same shape as `HarbourTraffic`: it is
 * handed the houses, it makes a sprite over some of them, and it is told
 * nothing else. Nothing here touches the grid, the save or the world — a
 * blimp is not a thing the game *puts down*, which is the whole of why this
 * is a hundred lines rather than a fixture with a price, a name in three
 * languages and a cell that a route could carve away.
 *
 * **They are made once and never moved.** There is no bob and no drift, and
 * that is a decision rather than something unfinished: the mooring wire is
 * drawn into the sprite, rigid with the hull, so lifting the envelope two
 * pixels lifts the tether two pixels clear of the roof it is tied to. At
 * this tile size two pixels is plenty to see, and a wire that unsticks
 * itself once a second is worse than one that never moves. The turbine
 * spins, which is enough — a thing with a turning rotor on it does not read
 * as frozen however still its hull is.
 */

/**
 * How the sprite is lined up with the house it is tied to.
 *
 * By their **bottoms**. The blimp's canvas is the townhouse's made taller —
 * 96x224 against 64x160 — so laying the two feet together puts the roof
 * ridge at a row the generator has already worked out, and the wire drawn
 * down to that row lands on the ridge. That is what makes a rigid tether
 * possible at all; the alternative is a line redrawn every frame from a
 * gondola to a roof anchor, which is a great deal of machinery for something
 * that never moves.
 *
 * Both sprites are drawn with a top-left origin, so lining up the feet means
 * lifting the blimp by the difference in their heights.
 */
function alignedTo(house: Phaser.GameObjects.Sprite, blimp: Phaser.GameObjects.Sprite): void {
  blimp.setPosition(
    house.x - (blimp.displayWidth - house.displayWidth) / 2,
    house.y - (blimp.displayHeight - house.displayHeight),
  );
}

/**
 * How far above its house a blimp is drawn.
 *
 * One, so it is over the roof it is tied to and nothing of its own house can
 * cover the wire. Deliberately *not* a large number: depth in this world is
 * how far down the screen a thing's feet are, and a blimp that put itself
 * above everything would hang in front of the buildings in the street below
 * it rather than behind them.
 */
const OVER_ITS_HOUSE = 1;

export interface Moorable {
  readonly id: string;
  readonly image: Phaser.GameObjects.Sprite;
}

export class CityBlimps {
  private readonly blimps: Phaser.GameObjects.Sprite[] = [];

  /**
   * One over every fifth city house, and none anywhere else.
   *
   * Which houses is `mooredHouses`, in `skyline.ts`, because it is the one
   * decision here worth being able to reason about without a browser. What
   * this class does with the answer is arithmetic on two sprite rectangles.
   */
  constructor(
    scene: Phaser.Scene,
    houses: readonly Moorable[],
    place: <T extends Phaser.GameObjects.GameObject>(object: T) => T,
    thing: SkyThing = Sky.Blimp,
  ) {
    if (!scene.anims.exists(skyAnimKey(thing))) return;
    const byId = new Map(houses.map((house) => [house.id, house]));
    for (const id of mooredHouses([...byId.keys()])) {
      const house = byId.get(id);
      if (!house) continue;
      const blimp = place(
        scene.add
          .sprite(0, 0, skySheetKey(thing))
          .setOrigin(0, 0)
          .setDepth(house.image.depth + OVER_ITS_HOUSE)
          .play(skyAnimKey(thing)),
      );
      alignedTo(house.image, blimp);
      this.blimps.push(blimp);
    }
  }

  /** Where each one is, in world pixels. A dev seam: a sprite in the sky is
   * the one thing a screenshot cannot tell from a sprite in the wrong sky. */
  positions(): { x: number; y: number }[] {
    return this.blimps.map((blimp) => ({ x: blimp.x, y: blimp.y }));
  }
}
