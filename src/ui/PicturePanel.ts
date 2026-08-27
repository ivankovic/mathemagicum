// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import { PANEL_PAD as PAD, ParchmentPanel } from "./ParchmentPanel";
import { type UiIndex, uiTextureKey } from "./assets";
import { INK, INK_DIM, INK_HEX, PAPER_PALE_HEX } from "./parchment";

/**
 * One picture, held up close, named and captioned.
 *
 * For the things in the world that a child taps because they are *pictures* —
 * a chart on a wall, a sign, a drawing. The picture is the answer and it is
 * given the room to be one: it takes the middle of the sheet, at whatever
 * size it will go, and the words are two short lines round it.
 *
 * It carried no words at all for a while, on the grounds that a sentence
 * describing a picture is wasted on somebody who is looking at the picture.
 * That is true of the *description* and false of the rest: a chart of the
 * night with nothing written on it does not say that it is this valley's
 * sky, or that those are the stars at midnight, and neither of those is
 * anywhere in the drawing to be looked at. So the caption says the things
 * the picture cannot, and never what it plainly can.
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

const CLOSE_SIZE = 13;

const TITLE_SIZE = 17;
const BODY_SIZE = 13;
/** Under the heading, and over the caption. */
const TITLE_GAP = 10;
const CAPTION_GAP = 12;
/**
 * How much of each side the heading gives up to the close box in the corner.
 *
 * Off both sides rather than one, so the line is still centred on the sheet
 * — and so a long title in any language wraps rather than running under the
 * button.
 */
const CORNER_ROOM = 36;

type PanelPart = Phaser.GameObjects.GameObject &
  Phaser.GameObjects.Components.Depth &
  Phaser.GameObjects.Components.ScrollFactor &
  Phaser.GameObjects.Components.Visible;

export class PicturePanel {
  private readonly paper: ParchmentPanel;
  private readonly parts: PanelPart[] = [];
  private readonly sheet: Phaser.GameObjects.Image;
  private readonly heading: Phaser.GameObjects.Text;
  private readonly caption: Phaser.GameObjects.Text;
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
    this.heading = this.own(this.text(TITLE_SIZE, INK).setOrigin(0.5, 0));
    this.caption = this.own(this.text(BODY_SIZE, INK_DIM).setOrigin(0.5, 1).setAlign("center"));
    this.closeBox = this.own(
      scene.add
        .rectangle(0, 0, 28, 24, PAPER_PALE_HEX)
        .setStrokeStyle(2, INK_HEX)
        .setInteractive({ useHandCursor: true }),
    );
    this.closeLabel = this.own(
      scene.add
        .text(0, 0, "x", { fontFamily: "monospace", fontSize: `${CLOSE_SIZE}px`, color: INK })
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

  /** Hold up the picture under this texture key, under its own two lines. */
  show(asset: string, title: string, caption: string, onClose: () => void): void {
    this.sheet.setTexture(uiTextureKey(asset));
    this.heading.setText(title);
    this.caption.setText(caption);
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

    // The words first, because what is left after them is what the picture
    // has to fit into — and a picture sized against the whole sheet would be
    // a picture with a caption printed across its bottom edge.
    const wrap = rect.width - PAD * 2;
    this.heading.setWordWrapWidth(wrap - CORNER_ROOM * 2).setPosition(rect.centreX, rect.top + PAD);
    this.caption.setWordWrapWidth(wrap).setPosition(rect.centreX, rect.top + rect.height - PAD);

    const top = rect.top + PAD + this.heading.height + TITLE_GAP;
    const bottom = rect.top + rect.height - PAD - this.caption.height - CAPTION_GAP;
    const room = Math.min(rect.width - PAD * 4, bottom - top);
    const source = Math.max(this.sheet.frame.realWidth, this.sheet.frame.realHeight);
    // Whole multiples only, and at least one: a fractional scale on pixel art
    // makes some rows a pixel taller than their neighbours.
    const times = Math.max(1, Math.floor(room / source));
    this.sheet.setScale(times).setPosition(rect.centreX, (top + bottom) / 2);

    this.closeBox.setPosition(rect.left + rect.width - PAD - 14, rect.top + PAD + 10);
    this.closeLabel.setPosition(this.closeBox.x, this.closeBox.y);
  }

  private text(size: number, color: string): Phaser.GameObjects.Text {
    return this.scene.add.text(0, 0, "", {
      fontFamily: "monospace",
      fontSize: `${size}px`,
      color,
      lineSpacing: 3,
    });
  }

  private own<T extends PanelPart>(object: T): T {
    this.parts.push(object);
    return object;
  }
}
