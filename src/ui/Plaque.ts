// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import Phaser from "phaser";
import { UiAsset, type UiIndex, uiEntry, uiTextureKey } from "./assets";

/**
 * A small square of the same parchment the panels are written on, for the
 * things that live in the corners of the screen.
 *
 * The clock and the options button used to be flat dark rectangles with a
 * hairline round them — the look a debug overlay has, in a game of runes and
 * spellbooks and hand-drawn crops. Nothing about it was chosen; it was what a
 * rectangle looks like when nobody has said otherwise. This is the game's own
 * paper instead, and the same paper as the spell parchment, so the corner of
 * the screen belongs to the same world as the middle of it.
 *
 * `ParchmentPanel` is the same two pieces of art and deliberately not reused
 * here. That one owns a dimming backdrop and centres itself in the viewport,
 * because it is a *modal*: the whole of its job is that nothing behind it can
 * be touched. A plaque is furniture. It sits where it is put, takes no taps
 * it is not given, and never darkens anything.
 *
 * **The fill is tiled and never stretched**, which is the one rule these two
 * share and the reason the fill ships as a seamless tile: stretching mottled
 * paper smears its grain into streaks, and that is the artefact that makes
 * pixel art look like a photograph of itself.
 */
export interface PlaqueOptions {
  readonly depth: number;
  readonly register: (object: Phaser.GameObjects.GameObject) => void;
}

export class Plaque {
  private readonly fill: Phaser.GameObjects.TileSprite;
  private readonly frame: Phaser.GameObjects.NineSlice;

  constructor(scene: Phaser.Scene, index: UiIndex, options: PlaqueOptions) {
    const fillEntry = uiEntry(index, UiAsset.ParchmentFill);
    this.fill = scene.add.tileSprite(
      0,
      0,
      fillEntry.width,
      fillEntry.height,
      uiTextureKey(UiAsset.ParchmentFill),
    );

    const frameEntry = uiEntry(index, UiAsset.ParchmentFrame);
    const insets = frameEntry.nine_slice;
    if (!insets) throw new Error("ui.json's parchment-frame has no nine_slice insets");
    this.frame = scene.add.nineslice(
      0,
      0,
      uiTextureKey(UiAsset.ParchmentFrame),
      undefined,
      frameEntry.width,
      frameEntry.height,
      insets.left,
      insets.right,
      insets.top,
      insets.bottom,
    );

    for (const part of this.parts()) {
      part.setOrigin(0, 0).setDepth(options.depth).setScrollFactor(0);
      options.register(part);
    }
  }

  parts(): readonly (Phaser.GameObjects.TileSprite | Phaser.GameObjects.NineSlice)[] {
    return [this.fill, this.frame];
  }

  /**
   * Put the paper here, at this size.
   *
   * Both pieces get the same rectangle: the frame is a nine-slice, so its
   * corners keep their own size and only the edges between them stretch —
   * which is what lets one thirty-two-pixel drawing border a plaque of any
   * shape without the border thickening.
   */
  layout(left: number, top: number, width: number, height: number): void {
    for (const part of this.parts()) part.setPosition(left, top).setSize(width, height);
  }

  setVisible(visible: boolean): void {
    for (const part of this.parts()) part.setVisible(visible);
  }

  /**
   * Take taps on the paper itself.
   *
   * The area is handed in rather than left to Phaser to work out, and has to
   * be: a nine-slice is sized after it is made, and an area derived at
   * construction would stay the size it was made at for ever.
   */
  takeTaps(width: number, height: number, tapped: () => void): void {
    this.frame
      .setInteractive(
        new Phaser.Geom.Rectangle(0, 0, width, height),
        Phaser.Geom.Rectangle.Contains,
      )
      .on("pointerdown", tapped);
  }

  destroy(): void {
    for (const part of this.parts()) part.destroy();
  }
}
