// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import { UiAsset, type UiIndex, uiEntry, uiTextureKey } from "./assets";

/**
 * The sheet of paper a popup is written on: a dimmed backdrop, a tiled
 * parchment fill, and a nine-sliced border, sized to whatever viewport it
 * finds itself in.
 *
 * Two popups now want this — a spell and a shop — and the two decisions in
 * it are subtle enough that a second copy would drift from the first:
 *
 * - **The fill is tiled, never stretched.** Stretching mottled paper smears
 *   its grain into streaks, which is the artefact that makes pixel art look
 *   like a JPEG. The generator ships the fill as a seamless tile precisely
 *   so it can be repeated at any size instead.
 * - **The backdrop is interactive.** Dimming is the visible half; the useful
 *   half is that a hit area covering the screen means the owning scene's own
 *   pointer handler sees something under the cursor and never starts a walk
 *   or a joystick underneath the popup.
 *
 * Everything is measured in real screen pixels and belongs to a UI camera,
 * so `register` is handed each object exactly as the joystick and the icon
 * trays do it.
 */

export const PANEL_MARGIN = 12;
export const PANEL_PAD = 16;

const BACKDROP_COLOR = 0x101018;
const BACKDROP_ALPHA = 0.55;

export interface PanelRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly centreX: number;
  readonly centreY: number;
}

export interface ParchmentPanelOptions {
  readonly maxWidth: number;
  readonly maxHeight: number;
  readonly minWidth: number;
  readonly minHeight: number;
  readonly depth: number;
  readonly register: (object: Phaser.GameObjects.GameObject) => void;
}

export class ParchmentPanel {
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private readonly fill: Phaser.GameObjects.TileSprite;
  private readonly frame: Phaser.GameObjects.NineSlice;

  constructor(
    scene: Phaser.Scene,
    index: UiIndex,
    private readonly options: ParchmentPanelOptions,
  ) {
    const add = scene.add;
    // Built at 1x1 and resized in `layout`, which is safe *because it is a
    // Shape*: a Shape's hit area is its own `geom`, and `setSize` updates
    // that, so the area follows the rectangle. Checked rather than assumed.
    // Anything here that stops being a Shape loses that and would need its
    // hit area set explicitly on every resize.
    this.backdrop = add
      .rectangle(0, 0, 1, 1, BACKDROP_COLOR, BACKDROP_ALPHA)
      .setOrigin(0, 0)
      .setInteractive();

    const fillEntry = uiEntry(index, UiAsset.ParchmentFill);
    this.fill = add.tileSprite(
      0,
      0,
      fillEntry.width,
      fillEntry.height,
      uiTextureKey(UiAsset.ParchmentFill),
    );

    const frameEntry = uiEntry(index, UiAsset.ParchmentFrame);
    const insets = frameEntry.nine_slice;
    if (!insets) throw new Error("ui.json's parchment-frame has no nine_slice insets");
    this.frame = add.nineslice(
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
      part.setDepth(options.depth).setScrollFactor(0).setVisible(false);
      options.register(part);
    }
  }

  parts(): readonly (
    | Phaser.GameObjects.Rectangle
    | Phaser.GameObjects.TileSprite
    | Phaser.GameObjects.NineSlice
  )[] {
    return [this.backdrop, this.fill, this.frame];
  }

  setVisible(visible: boolean): void {
    for (const part of this.parts()) part.setVisible(visible);
  }

  /** Size the paper to this viewport and report where it landed. */
  layout(viewWidth: number, viewHeight: number): PanelRect {
    const { maxWidth, maxHeight, minWidth, minHeight } = this.options;
    this.backdrop.setSize(viewWidth, viewHeight).setPosition(0, 0);

    const width = Math.max(minWidth, Math.min(maxWidth, viewWidth - PANEL_MARGIN * 2));
    const height = Math.max(minHeight, Math.min(maxHeight, viewHeight - PANEL_MARGIN * 2));
    const centreX = Math.round(viewWidth / 2);
    const centreY = Math.round(viewHeight / 2);

    this.fill.setPosition(centreX, centreY).setSize(width, height);
    this.frame.setPosition(centreX, centreY).setSize(width, height);
    return {
      left: centreX - width / 2,
      top: centreY - height / 2,
      width,
      height,
      centreX,
      centreY,
    };
  }

  destroy(): void {
    for (const part of this.parts()) part.destroy();
  }
}
