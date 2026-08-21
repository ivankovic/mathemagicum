// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import { PANEL_PAD as PAD, ParchmentPanel } from "./ParchmentPanel";
import { UiAsset, type UiIndex, uiTextureKey } from "./assets";

/**
 * Somebody's errand, drawn: a row of things to do, and what you get for it.
 *
 * Wordless on purpose. The astronomer used to say *"5 lamps still to set on
 * the path"* along the top of the screen, which fails twice over — a line of
 * small type is unreadable at arm's length, and the youngest children this
 * game is for cannot read it at all. What she is asking for is a countable
 * row of identical things, and a countable row of identical things is a
 * picture.
 *
 * Three parts, top to bottom:
 *
 * - **the row** — one token per thing to do, the finished ones in full
 *   colour and the rest dimmed over an empty socket. Counting the dim ones
 *   is the number the sentence used to give;
 * - **the arrow** — which way the bargain runs;
 * - **the reward** — the rune she will teach, dim until it is earned and lit
 *   the moment it is. That is the only difference between "here is what I
 *   want" and "here is what you have", and it needs no word either.
 */

const PANEL_MAX_W = 420;
const PANEL_MAX_H = 236;
const PANEL_MIN_W = 280;
const PANEL_MIN_H = 200;

const INK_HEX = 0x4a3422;
const PAPER_PALE_HEX = 0xf6e8c4;
const SOCKET_HEX = 0x2b2620;
const RULE_HEX = 0x8a6a48;
const CLOSE_SIZE = 13;

/** How big a token in the row is drawn. */
const TOKEN = 34;
const TOKEN_GAP = 10;
/** And the reward, which is the one thing on the sheet worth being bigger. */
const REWARD = 52;
/**
 * How faint a thing still to do is drawn.
 *
 * Faint enough to read as *not yet* beside a lit one, and no fainter: at a
 * third it was a smudge, and a child cannot count what they cannot make out.
 */
const DIM = 0.45;

type PanelPart = Phaser.GameObjects.GameObject &
  Phaser.GameObjects.Components.Depth &
  Phaser.GameObjects.Components.ScrollFactor &
  Phaser.GameObjects.Components.Visible;

export interface Task {
  /** The picture of one thing to do — a lamp, a crop, a stone. */
  readonly token: string;
  /** How many there are, and how many are done. */
  readonly needed: number;
  readonly done: number;
  /** What it is for. */
  readonly reward: string;
}

export class TaskPanel {
  private readonly paper: ParchmentPanel;
  private readonly parts: PanelPart[] = [];
  private readonly ink: Phaser.GameObjects.Graphics;
  private readonly tokens: Phaser.GameObjects.Image[] = [];
  private readonly reward: Phaser.GameObjects.Image;
  private readonly closeBox: Phaser.GameObjects.Rectangle;
  private readonly closeLabel: Phaser.GameObjects.Text;

  private open = false;
  private task: Task | null = null;
  private onClose: (() => void) | null = null;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    index: UiIndex,
    depth: number,
    register: (object: Phaser.GameObjects.GameObject) => void,
    /** The most tokens any task will ever show, so the pool is made once. */
    most: number,
  ) {
    this.paper = new ParchmentPanel(scene, index, {
      maxWidth: PANEL_MAX_W,
      maxHeight: PANEL_MAX_H,
      minWidth: PANEL_MIN_W,
      minHeight: PANEL_MIN_H,
      depth,
      register,
    });
    this.ink = this.own(scene.add.graphics());
    for (let n = 0; n < most; n++) {
      this.tokens.push(this.own(scene.add.image(0, 0, uiTextureKey(UiAsset.Spellbook))));
    }
    this.reward = this.own(scene.add.image(0, 0, uiTextureKey(UiAsset.Spellbook)));
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
    this.ink.setDepth(depth + 2);
    this.closeLabel.setDepth(depth + 3);
  }

  get isOpen(): boolean {
    return this.open;
  }

  show(task: Task, onClose: () => void): void {
    this.task = task;
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
    this.ink.clear();
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
    const task = this.task;
    if (!task) return;
    const { width, height } = this.scene.scale;
    const rect = this.paper.layout(width, height);
    this.ink.clear();
    for (const part of this.parts) part.setVisible(true);
    for (const token of this.tokens) token.setVisible(false);

    // --- the row ------------------------------------------------------------
    const shown = Math.min(task.needed, this.tokens.length);
    const span = shown * TOKEN + (shown - 1) * TOKEN_GAP;
    const left = rect.centreX - span / 2;
    // The whole block centred in the sheet rather than hung from the top: it
    // is one picture and the paper is sized to it, so there is nothing for a
    // band of blank parchment underneath to be.
    const block = TOKEN + 30 + 26 + REWARD;
    const rowY = rect.centreY - block / 2 + TOKEN / 2;
    for (let n = 0; n < shown; n++) {
      const x = left + n * (TOKEN + TOKEN_GAP) + TOKEN / 2;
      const done = n < task.done;
      // A socket under every one that is still to do — the same hole the
      // climb itself draws under an empty post, so the picture on the
      // parchment and the picture on the ground are one thing.
      if (!done) {
        this.ink.fillStyle(SOCKET_HEX, 0.85);
        this.ink.fillEllipse(x, rowY + TOKEN / 2 + 4, TOKEN * 0.6, TOKEN * 0.2);
      }
      const token = this.tokens[n];
      if (!token) continue;
      token
        .setTexture(uiTextureKey(task.token))
        .setDisplaySize(TOKEN, TOKEN)
        .setPosition(x, rowY)
        .setAlpha(done ? 1 : DIM)
        .setVisible(true);
    }

    // --- the arrow ----------------------------------------------------------
    const arrowY = rowY + TOKEN / 2 + 30;
    this.ink.lineStyle(3, RULE_HEX, 1);
    this.ink.lineBetween(rect.centreX, arrowY - 12, rect.centreX, arrowY + 10);
    this.ink.lineBetween(rect.centreX, arrowY + 10, rect.centreX - 7, arrowY + 2);
    this.ink.lineBetween(rect.centreX, arrowY + 10, rect.centreX + 7, arrowY + 2);

    // --- what it is for -----------------------------------------------------
    const earned = task.done >= task.needed;
    this.reward
      .setTexture(uiTextureKey(task.reward))
      .setDisplaySize(REWARD, REWARD)
      .setPosition(rect.centreX, arrowY + 26 + REWARD / 2)
      .setAlpha(earned ? 1 : DIM)
      .setVisible(true);

    this.closeBox.setPosition(rect.left + rect.width - PAD - 14, rect.top + PAD + 10);
    this.closeLabel.setPosition(this.closeBox.x, this.closeBox.y);
  }

  private own<T extends PanelPart>(object: T): T {
    this.parts.push(object);
    return object;
  }
}
