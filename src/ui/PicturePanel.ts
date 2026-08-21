// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import { PANEL_PAD as PAD, ParchmentPanel } from "./ParchmentPanel";
import { type UiIndex, uiTextureKey } from "./assets";

/**
 * One picture, held up close, with nothing written on it.
 *
 * For the things in the world that a child taps because they are *pictures* —
 * a chart on a wall, a sign, a drawing. Tapping one used to put a sentence
 * describing it along the top of the screen, which is the exact shape of
 * answer this game is getting rid of: a description of a picture, in words,
 * for somebody who is looking at the picture.
 *
 * So it holds the picture up instead, big enough to see what is in it. There
 * is no title and no caption, and there is nothing to read: the panel *is*
 * the answer, and a caption under it would be a caption under a thing that
 * needs none.
 *
 * The picture is drawn at whole multiples of its own size wherever it fits.
 * Pixel art scaled by a fraction is pixel art with some rows one pixel taller
 * than their neighbours, and on a hand-drawn chart of the night that reads as
 * a printing fault rather than as a big version.
 */

const PANEL_MAX_W = 460;
const PANEL_MAX_H = 460;
const PANEL_MIN_W = 260;
const PANEL_MIN_H = 260;

const INK_HEX = 0x4a3422;
const PAPER_PALE_HEX = 0xf6e8c4;
const CLOSE_SIZE = 13;

type PanelPart = Phaser.GameObjects.GameObject &
  Phaser.GameObjects.Components.Depth &
  Phaser.GameObjects.Components.ScrollFactor &
  Phaser.GameObjects.Components.Visible;

export class PicturePanel {
  private readonly paper: ParchmentPanel;
  private readonly parts: PanelPart[] = [];
  private readonly sheet: Phaser.GameObjects.Image;
  private readonly closeBox: Phaser.GameObjects.Rectangle;
  private readonly closeLabel: Phaser.GameObjects.Text;

  private open = false;
  private onClose: (() => void) | null = null;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    index: UiIndex,
    depth: number,
    register: (object: Phaser.GameObjects.GameObject) => void,
  ) {
    this.paper = new ParchmentPanel(scene, index, {
      maxWidth: PANEL_MAX_W,
      maxHeight: PANEL_MAX_H,
      minWidth: PANEL_MIN_W,
      minHeight: PANEL_MIN_H,
      depth,
      register,
    });
    // Pointed at a real texture from the start rather than at nothing: an
    // image made against a texture that does not exist yet gets Phaser's
    // missing-texture placeholder, and this one is the size of a panel.
    this.sheet = this.own(scene.add.image(0, 0, uiTextureKey("parchment-fill")).setOrigin(0.5));
    this.closeBox = this.own(
      scene.add
        .rectangle(0, 0, 28, 24, PAPER_PALE_HEX)
        .setStrokeStyle(2, INK_HEX)
        .setInteractive({ useHandCursor: true }),
    );
    this.closeLabel = this.own(
      scene.add
        .text(0, 0, "x", { fontFamily: "monospace", fontSize: `${CLOSE_SIZE}px`, color: "#4a3422" })
        .setOrigin(0.5),
    );
    this.closeBox.on("pointerdown", () => this.close());

    for (const part of this.parts) {
      part
        .setDepth(depth + 1)
        .setScrollFactor(0)
        .setVisible(false);
      register(part);
    }
    this.closeLabel.setDepth(depth + 3);
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** Hold up the picture under this texture key. */
  show(asset: string, onClose: () => void): void {
    this.sheet.setTexture(uiTextureKey(asset));
    this.open = true;
    this.onClose = onClose;
    this.paper.setVisible(true);
    this.render();
    this.keyHandler = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      this.close();
    };
    this.scene.input.keyboard?.on("keydown", this.keyHandler);
  }

  close(): void {
    if (this.keyHandler) {
      this.scene.input.keyboard?.off("keydown", this.keyHandler);
      this.keyHandler = null;
    }
    this.open = false;
    this.paper.setVisible(false);
    for (const part of this.parts) part.setVisible(false);
    const done = this.onClose;
    this.onClose = null;
    done?.();
  }

  layout(): void {
    if (this.open) this.render();
  }

  destroy(): void {
    this.close();
    this.paper.destroy();
    for (const part of this.parts) part.destroy();
  }

  private render(): void {
    const { width, height } = this.scene.scale;
    const rect = this.paper.layout(width, height);
    for (const part of this.parts) part.setVisible(true);

    const room = Math.min(rect.width, rect.height) - PAD * 4;
    const source = Math.max(this.sheet.frame.realWidth, this.sheet.frame.realHeight);
    // Whole multiples only, and at least one: a fractional scale on pixel art
    // makes some rows a pixel taller than their neighbours.
    const times = Math.max(1, Math.floor(room / source));
    this.sheet.setScale(times).setPosition(rect.centreX, rect.centreY);

    this.closeBox.setPosition(rect.left + rect.width - PAD - 14, rect.top + PAD + 10);
    this.closeLabel.setPosition(this.closeBox.x, this.closeBox.y);
  }

  private own<T extends PanelPart>(object: T): T {
    this.parts.push(object);
    return object;
  }
}
