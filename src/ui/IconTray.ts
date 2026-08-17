// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";

/**
 * A container button in the corner of the screen, and the row of things that
 * springs out of it when tapped.
 *
 * There are two of these — a spellbook holding spells and a pouch holding
 * seeds — and they exist as one widget because the player should not have to
 * learn them twice. Tapping the container shows what is inside; tapping one
 * of those does the thing. Nothing selects-then-confirms, because a two-step
 * action on a phone is two chances to lose the tray to a stray tap.
 *
 * The tray opens *upward* from its container, so the finger that opened it is
 * already next to what it opened and the items are never underneath the hand.
 *
 * On a desktop this is drawn and behaves identically. Casting and planting
 * are not things a keyboard does better, and a spell the player cannot see is
 * one they will never look for — the keyboard shortcuts are a convenience on
 * top, not the real interface.
 */

const BUTTON_FILL = 0x000000;
const BUTTON_ALPHA = 0.45;
const BUTTON_STROKE = 0xffffff;
const BUTTON_STROKE_ALPHA = 0.6;
// The open container reads as pressed, so it is obvious which tray the items
// on screen belong to once there is more than one of these.
const OPEN_STROKE = 0xffe08a;
const GAP = 8;

interface Button {
  readonly box: Phaser.GameObjects.Rectangle;
  readonly icon: Phaser.GameObjects.Image;
}

export interface TrayItem {
  /** Texture key for the icon drawn on the button. */
  readonly texture: string;
  /** What tapping it does. The tray closes itself first. */
  readonly act: () => void;
}

export interface IconTrayOptions {
  readonly texture: string;
  readonly items: readonly TrayItem[];
  readonly size: number;
  /** Distance from the right edge to the container's centre. */
  readonly right: number;
  /** Distance from the bottom edge to the container's centre. */
  readonly bottom: number;
  readonly depth: number;
  readonly register: (object: Phaser.GameObjects.GameObject) => void;
  /** Called when this tray opens, so its neighbour can close. */
  readonly onOpen?: () => void;
  /**
   * Whether opening is allowed right now.
   *
   * Asked here rather than left to the caller because the container button
   * handles its own tap: a guard that only wrapped the keyboard shortcut
   * would leave the button itself unguarded, which is the whole population of
   * touch users.
   */
  readonly canOpen?: () => boolean;
  /** Called after any change, open or closed, so a caption can follow it. */
  readonly onChange?: () => void;
}

export class IconTray {
  private readonly container: Button;
  private readonly items: Button[] = [];
  private open = false;

  constructor(
    scene: Phaser.Scene,
    private readonly options: IconTrayOptions,
  ) {
    const make = (texture: string, size: number): Button => {
      const box = scene.add
        .rectangle(0, 0, size, size, BUTTON_FILL, BUTTON_ALPHA)
        .setStrokeStyle(2, BUTTON_STROKE, BUTTON_STROKE_ALPHA)
        .setScrollFactor(0)
        .setDepth(options.depth)
        .setInteractive({ useHandCursor: true });
      const icon = scene.add
        .image(0, 0, texture)
        .setScrollFactor(0)
        .setDepth(options.depth + 1);
      options.register(box);
      options.register(icon);
      return { box, icon };
    };

    this.container = make(options.texture, options.size);
    this.container.box.on("pointerdown", () => this.setOpen(!this.open));

    for (const item of options.items) {
      const button = make(item.texture, options.size - 8);
      button.box.on("pointerdown", () => {
        // Closed before acting, not after: acting can open a popup over the
        // top, and a tray left open behind it is live the moment it closes.
        this.setOpen(false);
        item.act();
      });
      this.items.push(button);
    }
    this.setOpen(false);
  }

  get isOpen(): boolean {
    return this.open;
  }

  setOpen(open: boolean): void {
    if (open && this.options.canOpen && !this.options.canOpen()) return;
    this.open = open;
    for (const item of this.items) {
      item.box.setVisible(open);
      item.icon.setVisible(open);
    }
    this.container.box.setStrokeStyle(
      2,
      open ? OPEN_STROKE : BUTTON_STROKE,
      open ? 1 : BUTTON_STROKE_ALPHA,
    );
    if (open) this.options.onOpen?.();
    this.options.onChange?.();
  }

  toggle(): void {
    this.setOpen(!this.open);
  }

  /** Re-place for a viewport of this size. Matches GameScene's EdgeAnchored. */
  place(width: number, height: number): void {
    const { size, right, bottom } = this.options;
    const x = width - right;
    const y = height - bottom;
    this.container.box.setPosition(x, y);
    this.container.icon.setPosition(x, y);
    for (const [index, item] of this.items.entries()) {
      const itemY = y - (size + GAP) * (index + 1);
      item.box.setPosition(x, itemY);
      item.icon.setPosition(x, itemY);
    }
  }
}
