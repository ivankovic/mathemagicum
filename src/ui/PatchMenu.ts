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
 * Deliberately *not* an `IconTray`. A tray is a container in a fixed corner
 * that springs open in place; this follows a patch of ground, carries words
 * rather than runes, and closes itself. The two look nothing alike on screen
 * and share nothing but being buttons.
 */

const FILL = 0x000000;
const FILL_ALPHA = 0.72;
const STROKE = 0xffe08a;
const INK = "#f6e8c4";
const COUNT_INK = "#c8901c";

const TEXT_SIZE = 13;
const COUNT_SIZE = 11;
const PAD_X = 10;
const PAD_Y = 6;
const GAP = 4;
const MIN_WIDTH = 96;
/** How far above the patch's top edge the first button floats. */
const RISE = 10;

export interface PatchChoice<TAction extends string> {
  readonly action: TAction;
  readonly label: string;
  /** How many squares this would actually touch. */
  readonly count: number;
}

interface Row {
  readonly box: Phaser.GameObjects.Rectangle;
  readonly text: Phaser.GameObjects.Text;
  readonly tally: Phaser.GameObjects.Text;
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
   * every patch — three buttons here, one there — is one where a pool would
   * mean hiding and re-labelling rows, and a row left over from last time
   * showing the wrong count is exactly the bug this avoids by construction.
   */
  openAt(
    at: { x: number; y: number },
    choices: readonly PatchChoice<TAction>[],
    onChoose: (action: TAction) => void,
  ): void {
    this.close();
    this.choose = onChoose;

    const add = this.scene.add;
    let width = MIN_WIDTH;
    const built: { row: Row; action: TAction }[] = [];
    for (const choice of choices) {
      const text = add
        .text(0, 0, choice.label, {
          fontFamily: "monospace",
          fontSize: `${TEXT_SIZE}px`,
          color: INK,
        })
        .setOrigin(0, 0.5);
      const tally = add
        .text(0, 0, `x${choice.count}`, {
          fontFamily: "monospace",
          fontSize: `${COUNT_SIZE}px`,
          color: COUNT_INK,
        })
        .setOrigin(1, 0.5);
      width = Math.max(width, text.width + tally.width + PAD_X * 3);
      const box = add
        .rectangle(0, 0, width, TEXT_SIZE + PAD_Y * 2, FILL, FILL_ALPHA)
        .setStrokeStyle(2, STROKE, 0.9)
        .setInteractive({ useHandCursor: true });
      box.on("pointerdown", () => this.choose?.(choice.action));
      built.push({ row: { box, text, tally }, action: choice.action });
    }

    const height = TEXT_SIZE + PAD_Y * 2;
    const total = built.length * height + (built.length - 1) * GAP;
    for (const [index, { row }] of built.entries()) {
      // Stacked *upward* from the patch, so the finger that marked it is not
      // over the buttons it just produced — the same reason the icon trays
      // open upward out of their corner.
      const y = at.y - RISE - total + index * (height + GAP) + height / 2;
      row.box.setSize(width, height).setPosition(at.x, y);
      row.text.setPosition(at.x - width / 2 + PAD_X, y);
      row.tally.setPosition(at.x + width / 2 - PAD_X, y);
      for (const part of [row.box, row.text, row.tally]) {
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
      row.text.destroy();
      row.tally.destroy();
    }
    this.rows.length = 0;
    this.choose = null;
  }

  destroy(): void {
    this.close();
  }
}
