// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import { PANEL_PAD as PAD, type PanelRect, ParchmentPanel } from "./ParchmentPanel";
import type { UiIndex } from "./assets";
import { FACE, INK, INK_HEX, PAPER_HEX, PAPER_PALE_HEX } from "./parchment";

/**
 * What every sheet of parchment in this game has in common, once.
 *
 * Nineteen panels are written on the paper `ParchmentPanel` draws, and for a
 * long time each of them also carried its own copy of the same forty lines:
 * a list of the objects it made, a way to adopt one into that list, a text
 * helper, an Escape key that closes it, an "x" in the corner, and a `close`
 * and `destroy` that hid or threw away the lot. The copies agreed — mostly.
 * One of them forgot to detach its key listener; one set its parts' depth in
 * a loop that never saw the parts a subclass made afterwards. Thirteen files
 * was thirteen places for the next such slip.
 *
 * This is the thin part: nothing about *what* is on the sheet, only about
 * being a sheet. A subclass supplies the words, the pictures and the rules,
 * says whether it is open, and draws itself in `render`.
 */

/** Anything a panel can own: it can be hidden, given a depth and pinned. */
export type PanelPart = Phaser.GameObjects.GameObject &
  Phaser.GameObjects.Components.Depth &
  Phaser.GameObjects.Components.ScrollFactor &
  Phaser.GameObjects.Components.Visible;

/** A box with a word on it. */
export interface Chip {
  readonly box: Phaser.GameObjects.Rectangle;
  readonly label: Phaser.GameObjects.Text;
}

/** The "x" in the top corner, which also knows where that corner is. */
export interface CloseChip extends Chip {
  /** Put it in the corner of this sheet, and show it. */
  readonly place: (rect: PanelRect) => void;
}

export interface PanelOptions {
  readonly maxWidth: number;
  readonly maxHeight: number;
  readonly minWidth: number;
  readonly minHeight: number;
  /**
   * How far above the paper an owned part sits.
   *
   * One, for a sheet of prose. The spell parchments were built with their
   * parts *level* with the paper and their ink and keys stepped up from
   * there, and since everything on them is placed relative to that, they say
   * so rather than have their layers shuffled.
   */
  readonly lift?: number;
  /** How the lines of a wrapped paragraph are set. Phaser's own is nought. */
  readonly lineSpacing?: number;
}

/**
 * The two builds of the "x" in the top corner.
 *
 * A sheet of prose gets a small button drawn the way its other buttons are:
 * pale, wider than tall, tucked in from the corner. A spell's parchment gets
 * a key — square, the darker paper, hard in the corner — because it sits
 * beside a keypad, and a key that looked like a button would be the one
 * thing on the sheet that did not match.
 *
 * `above` is where the box goes: one step over the parts on a sheet, level
 * with the keys on a parchment. The label is one further up on both, so it
 * is never under the box it is written on.
 */
const CLOSE_LOOKS = {
  sheet: { width: 28, height: 24, fill: PAPER_PALE_HEX, above: 1, inX: 14, inY: 10 },
  key: { width: 26, height: 26, fill: PAPER_HEX, above: 2, inX: 2, inY: 2 },
} as const;
export type CloseLook = keyof typeof CLOSE_LOOKS;
const LABEL_ABOVE = 3;

export abstract class Panel {
  protected readonly paper: ParchmentPanel;
  protected readonly parts: PanelPart[] = [];
  /** The paper's own depth; everything on it is stepped up from here. */
  protected readonly depth: number;
  private readonly lift: number;
  private readonly lineSpacing: number;
  private readonly registerPart: (object: Phaser.GameObjects.GameObject) => void;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor(
    protected readonly scene: Phaser.Scene,
    index: UiIndex,
    depth: number,
    register: (object: Phaser.GameObjects.GameObject) => void,
    options: PanelOptions,
  ) {
    this.depth = depth;
    this.lift = options.lift ?? 1;
    this.lineSpacing = options.lineSpacing ?? 0;
    this.registerPart = register;
    this.paper = new ParchmentPanel(scene, index, { ...options, depth, register });
  }

  // --- what a subclass answers ----------------------------------------------

  abstract get isOpen(): boolean;

  /** Put everything where it goes for the viewport as it is now. */
  protected abstract render(): void;

  // --- being a panel --------------------------------------------------------

  /** Re-place everything for the current viewport. Safe to call when shut. */
  layout(): void {
    if (this.isOpen) this.render();
  }

  /**
   * Take the sheet away.
   *
   * Only the sheet: a subclass that owes somebody a callback, or has a timer
   * running, or a state to throw away, does that around a call to this.
   */
  close(): void {
    this.unwatchKeys();
    this.paper.setVisible(false);
    for (const part of this.parts) part.setVisible(false);
  }

  destroy(): void {
    // Everything, not only the keys. A panel that detached its listener and
    // left its paper behind was a leak on every scene restart.
    this.close();
    this.paper.destroy();
    for (const part of this.parts) part.destroy();
  }

  // --- the keyboard ---------------------------------------------------------

  /** Hear the keyboard while open. Replaces any handler already listening. */
  protected watchKeys(handler: (event: KeyboardEvent) => void): void {
    this.unwatchKeys();
    this.keyHandler = handler;
    this.scene.input.keyboard?.on("keydown", handler);
  }

  protected unwatchKeys(): void {
    if (!this.keyHandler) return;
    this.scene.input.keyboard?.off("keydown", this.keyHandler);
    this.keyHandler = null;
  }

  /** The commonest arrangement: Escape, and only Escape, shuts the sheet. */
  protected escapeCloses(onEscape: () => void = () => this.close()): void {
    this.watchKeys((event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onEscape();
    });
  }

  // --- plumbing -------------------------------------------------------------

  /**
   * Adopt a part: depth, camera, hidden, registered — all of it, at once.
   *
   * Everything a panel draws goes through here, including anything a
   * subclass makes for itself, which is what keeps a half-built panel from
   * showing pieces of itself before it is ever opened.
   *
   * At once rather than in a loop at the end of a constructor: the loop was
   * fine while a panel was one class, and stopped being fine the moment a
   * subclass made objects of its own — those are built after the loop has
   * run, so it never saw them, and a panel that had not been opened yet left
   * its unhidden pieces sitting in the top-left corner over the status line.
   */
  protected own<T extends PanelPart>(object: T): T {
    object
      .setDepth(this.depth + this.lift)
      .setScrollFactor(0)
      .setVisible(false);
    this.registerPart(object);
    this.parts.push(object);
    return object;
  }

  /** A label or a picture that has to sit above the box it belongs to. */
  protected raise<T extends PanelPart>(object: T, above = 2): T {
    object.setDepth(this.depth + above);
    return object;
  }

  protected text(value: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.scene.add.text(0, 0, value, {
      fontFamily: FACE,
      fontSize: `${size}px`,
      color,
      lineSpacing: this.lineSpacing,
    });
  }

  /** The "x" in the top corner, owned and wired, in one of the two looks. */
  protected closeChip(labelSize: number, onTap: () => void, look: CloseLook = "sheet"): CloseChip {
    const style = CLOSE_LOOKS[look];
    const box = this.raise(
      this.own(
        this.scene.add
          .rectangle(0, 0, style.width, style.height, style.fill)
          .setStrokeStyle(2, INK_HEX)
          .setInteractive({ useHandCursor: true }),
      ),
      style.above,
    );
    const label = this.raise(this.own(this.text("x", labelSize, INK).setOrigin(0.5)), LABEL_ABOVE);
    box.on("pointerdown", onTap);
    const place = (rect: PanelRect) => {
      box.setPosition(rect.left + rect.width - PAD - style.inX, rect.top + PAD + style.inY);
      box.setVisible(true);
      label.setPosition(box.x, box.y).setVisible(true);
    };
    return { box, label, place };
  }
}
