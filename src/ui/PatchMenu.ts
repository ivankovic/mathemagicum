// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";

/**
 * The little menu that opens over a marked-out patch: what shall I do to it?
 *
 * The array spell marks an area and then asks what to do with it, which is a
 * question this game has never had to ask before — everything else acts on
 * the tile in front of you and needs no choosing. So this is a small,
 * short-lived thing rather than a panel: two or three buttons in a column,
 * stacked over the patch they belong to, gone the moment one is pressed or
 * anything else happens.
 *
 * It is not modal. A player who has changed their mind taps the rune again
 * or walks away, and the whole thing goes; a menu that had to be dismissed
 * before the game would listen again is a menu a child gets stuck in.
 *
 * **Runes, not words.** It carried the words for a while — "grow it", "clear
 * it" — and words are the one thing this game will not put in front of a
 * child on its own. The rune is what they already tap to cast the spell; the
 * same picture asking which spell to multiply is a question they can answer
 * without reading anything, in any language.
 *
 * Deliberately *not* an `IconTray`. A tray is a container in a fixed corner
 * that springs open in place; this follows the player, is built fresh every
 * time, and closes itself. The two share nothing but being buttons.
 */

const FILL = 0x000000;
const FILL_ALPHA = 0.72;
const STROKE = 0xffe08a;

/** How big a rune is drawn on a button, and the button around it. */
const RUNE = 28;
const PAD = 7;
const GAP = 5;
/** How far above the patch's top edge the first button floats. */
const RISE = 10;

export interface PatchChoice<TAction extends string> {
  readonly action: TAction;
  /** The texture of the rune this choice casts. */
  readonly rune: string;
  /**
   * Which frame of it, for a texture that holds more than one picture.
   *
   * The flowers need it: their five colours are five runs of frames on one
   * sheet, so the five buttons are five frames of a single texture rather
   * than five textures. Everything else here is its own picture and leaves
   * this alone.
   */
  readonly frame?: number;
}

interface Row {
  readonly box: Phaser.GameObjects.Rectangle;
  readonly rune: Phaser.GameObjects.Image;
}

export class PatchMenu<TAction extends string> {
  private readonly rows: Row[] = [];
  private choose: ((action: TAction) => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depth: number,
    private readonly register: (object: Phaser.GameObjects.GameObject) => void,
  ) {}

  get isOpen(): boolean {
    return this.rows.length > 0;
  }

  /**
   * Show the choices at a point on screen.
   *
   * Rebuilt each time rather than pooled. A menu whose contents change with
   * where it is opened — three choices out of doors, one indoors — is one
   * where a pool would mean hiding and re-labelling rows, and a row left
   * over from last time is exactly the bug this avoids by construction.
   *
   * **No tally.** Each row used to carry `x12` — how many squares the action
   * would land on — and that is the answer to the multiplication the spell
   * is about to ask. It was there when the menu came *after* the rectangle
   * was drawn; the menu comes first now, and the count is neither knowable
   * nor wanted.
   */
  openAt(
    at: { x: number; y: number },
    choices: readonly PatchChoice<TAction>[],
    onChoose: (action: TAction) => void,
  ): void {
    this.close();
    this.choose = onChoose;

    const add = this.scene.add;
    const size = RUNE + PAD * 2;
    const built: { row: Row; action: TAction }[] = [];
    for (const choice of choices) {
      const rune = add.image(0, 0, choice.rune, choice.frame).setDisplaySize(RUNE, RUNE);
      const box = add
        .rectangle(0, 0, size, size, FILL, FILL_ALPHA)
        .setStrokeStyle(2, STROKE, 0.9)
        .setInteractive({ useHandCursor: true });
      box.on("pointerdown", () => this.choose?.(choice.action));
      built.push({ row: { box, rune }, action: choice.action });
    }

    // Side by side rather than stacked. Two runes read as a pair of things
    // to pick between; the same two in a column read as a list, and a list
    // of two is a shape nothing else in this game uses.
    const total = built.length * size + (built.length - 1) * GAP;
    const left = at.x - total / 2 + size / 2;
    for (const [index, { row }] of built.entries()) {
      // Lifted clear of the patch, so the finger that marked it is not over
      // the buttons it just produced.
      const y = at.y - RISE - size / 2;
      row.box.setPosition(left + index * (size + GAP), y);
      row.rune.setPosition(row.box.x, y);
      for (const part of [row.box, row.rune]) {
        part.setScrollFactor(0).setDepth(this.depth + (part === row.box ? 0 : 1));
        this.register(part);
      }
      this.rows.push(row);
    }
  }

  /** Where each button sits, in order, so a script can press one. */
  buttonPositions(): { x: number; y: number }[] {
    return this.rows.map((row) => ({ x: row.box.x, y: row.box.y }));
  }

  close(): void {
    for (const row of this.rows) {
      row.box.destroy();
      row.rune.destroy();
    }
    this.rows.length = 0;
    this.choose = null;
  }

  destroy(): void {
    this.close();
  }
}
