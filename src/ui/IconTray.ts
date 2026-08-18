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

// A count sitting on the corner of a button. Ink on parchment rather than
// the white-on-red of a notification: this is how many carrots are in the
// basket, not an alert.
const BADGE_FILL = 0xf6e8c4;
const BADGE_STROKE = 0x4a3422;
const BADGE_INK = "#4a3422";
// How much of the button the badge takes, and the floor below which the
// digits stop being legible on a phone.
const BADGE_SCALE = 0.4;
const BADGE_MIN = 18;
// Past this the badge would need a third digit and would stop fitting in a
// corner. A player carrying a hundred of something does not need the exact
// number; they need to know it is a lot.
const BADGE_MAX = 99;
// How faded an item the player has none of looks. Low enough to read as
// "none of these", high enough that the icon still says which one it is.
const EMPTY_ALPHA = 0.3;

/**
 * What a badge shows for a count.
 *
 * Nothing at all for zero — an empty slot should read as empty, and a "0"
 * badge is a label saying so, which is more ink for less meaning.
 */
export function badgeLabel(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  const whole = Math.floor(count);
  if (whole <= 0) return null;
  return whole > BADGE_MAX ? `${BADGE_MAX}+` : String(whole);
}

interface Badge {
  readonly bubble: Phaser.GameObjects.Rectangle;
  readonly text: Phaser.GameObjects.Text;
  readonly size: number;
  readonly count: () => number;
}

interface Button {
  readonly box: Phaser.GameObjects.Rectangle;
  readonly icon: Phaser.GameObjects.Image;
  readonly badge?: Badge;
}

export interface TrayItem {
  /** Texture key for the icon drawn on the button. */
  readonly texture: string;
  /** What tapping it does. The tray closes itself first. */
  readonly act: () => void;
  /**
   * How many of this the player has, if that is a thing worth showing.
   *
   * A function rather than a number because the answer changes while the
   * game runs and the tray is not the thing that knows when — see `refresh`.
   * Items without one carry no badge at all: a spell is not a quantity.
   */
  readonly count?: () => number;
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
  /**
   * A count for the container itself — everything inside it, added up.
   *
   * The badge that matters most, because it is the only one visible while
   * the tray is shut: it is what tells the player they are carrying
   * something without asking them to open the basket to find out.
   */
  readonly count?: () => number;
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
    const make = (texture: string, size: number, count?: () => number): Button => {
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
      if (!count) return { box, icon };

      const badgeSize = Math.max(BADGE_MIN, Math.round(size * BADGE_SCALE));
      // Neither the bubble nor the number is interactive, so a tap on the
      // corner still reaches the button underneath. A badge that swallowed
      // taps would make the fullest slot the hardest one to press.
      const bubble = scene.add
        .rectangle(0, 0, badgeSize, badgeSize, BADGE_FILL)
        .setStrokeStyle(2, BADGE_STROKE)
        .setScrollFactor(0)
        .setDepth(options.depth + 2);
      const text = scene.add
        .text(0, 0, "", {
          fontFamily: "monospace",
          fontSize: `${Math.round(badgeSize * 0.62)}px`,
          color: BADGE_INK,
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(options.depth + 3);
      options.register(bubble);
      options.register(text);
      return { box, icon, badge: { bubble, text, size: badgeSize, count } };
    };

    this.container = make(options.texture, options.size, options.count);
    this.container.box.on("pointerdown", () => this.setOpen(!this.open));

    for (const item of options.items) {
      const button = make(item.texture, options.size - 8, item.count);
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
    // Counts can change while the tray is shut, so they are read here rather
    // than only when something puts them out of date. Opening a tray onto a
    // stale number is the failure this makes structurally impossible; the
    // public `refresh` covers the rarer case of a change while it is open.
    this.refresh();
    if (open) this.options.onOpen?.();
    this.options.onChange?.();
  }

  /**
   * Re-read every count.
   *
   * Called on open, and by the owner when something changes while a tray is
   * showing — harvesting does not close the basket, so the number under the
   * player's thumb has to keep up.
   */
  refresh(): void {
    this.paint(this.container, true);
    for (const item of this.items) this.paint(item, this.open);
  }

  // An item the player has none of is dimmed and carries no badge. Hiding it
  // outright would reshuffle the tray as things are picked and dropped, and a
  // row of buttons that moves under a thumb is worse than one with a gap in
  // it — this way the basket also says what *could* be in it.
  private paint(button: Button, visible: boolean): void {
    const badge = button.badge;
    if (!badge) return;
    const label = badgeLabel(badge.count());
    button.icon.setAlpha(label ? 1 : EMPTY_ALPHA);
    badge.bubble.setVisible(visible && label !== null);
    badge.text.setVisible(visible && label !== null);
    if (label) badge.text.setText(label);
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
    this.placeBadge(this.container, x, y, size);
    for (const [index, item] of this.items.entries()) {
      const itemY = y - (size + GAP) * (index + 1);
      item.box.setPosition(x, itemY);
      item.icon.setPosition(x, itemY);
      this.placeBadge(item, x, itemY, size - 8);
    }
    // Content last, and here rather than only in the constructor, so a badge
    // can never be made visible before it has been given a position. The
    // constructor refreshes too, and would leave a nonzero count sitting at
    // the origin until the first layout — which today cannot be seen, because
    // the inventory starts empty and the owner lays out in the same call.
    // That is an ordering to rely on by accident, so this removes it.
    this.refresh();
  }

  // Tucked into the button's bottom-right corner rather than overhanging it.
  // Overhanging reads better in isolation and collides in a row: the
  // containers sit ten pixels apart, and a badge hung off the basket landed
  // on the seed pouch beside it.
  private placeBadge(button: Button, x: number, y: number, size: number): void {
    const badge = button.badge;
    if (!badge) return;
    const offset = (size - badge.size) / 2 - 1;
    badge.bubble.setPosition(x + offset, y + offset);
    badge.text.setPosition(x + offset, y + offset);
  }
}
