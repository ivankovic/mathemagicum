// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import { PANEL_PAD as PAD, ParchmentPanel } from "./ParchmentPanel";
import { UiAsset, type UiIndex, uiTextureKey } from "./assets";
import { FACE, INK, INK_DIM, INK_HEX, PAPER_PALE_HEX, RULE_HEX } from "./parchment";

/**
 * Somebody's errand: a row of things to do, what you get for it, and both
 * halves said in words as well.
 *
 * It was wordless for a while, and the argument for that was half right. The
 * half that holds: what the astronomer is asking for is a countable row of
 * identical things, a countable row of identical things is a picture, and
 * the youngest children this game is for cannot read a sentence at all — so
 * the row has to carry the number on its own, and it does.
 *
 * The half that does not: a picture of five lamps and a rune says *how many*
 * and says nothing else. It cannot say whose path they are for, or where
 * they go, or that the rune underneath is a spell rather than a decoration.
 * A child who can read was being given a puzzle instead of an errand, and
 * the older sibling reading it out to the younger one had nothing to read.
 *
 * So both, always, each beside the picture it belongs to:
 *
 * - **the heading** — whose errand this is;
 * - **the asking** — what the row of tokens is a row of, and what to do with
 *   them. The number is still the row's to give;
 * - **the row** — one token per thing to do, the finished ones in full
 *   colour and the rest dimmed over an empty socket;
 * - **the arrow** — which way the bargain runs;
 * - **the reward** — the rune she will teach, dim until it is earned and lit
 *   the moment it is;
 * - **the bargain** — what the rune is, under it, and what it takes. This
 *   line is the one thing on the sheet a picture genuinely cannot give.
 */

const PANEL_MAX_W = 440;
const PANEL_MAX_H = 360;
const PANEL_MIN_W = 280;
const PANEL_MIN_H = 300;

const SOCKET_HEX = 0x2b2620;
const CLOSE_SIZE = 13;

const TITLE_SIZE = 17;
const BODY_SIZE = 13;

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

/** The gaps down the sheet: under the heading, round the arrow, under the rune. */
const TITLE_GAP = 10;
/**
 * How much of each side the heading gives up.
 *
 * The close box sits in the top right corner, so a heading wrapped to the
 * full width would run under it — and being centred, it would do that in
 * whichever language happened to have the longest word for the errand.
 * Taken off both sides so the line stays centred on the sheet.
 */
const CORNER_ROOM = 36;
const ASK_GAP = 14;
const ARROW_GAP = 26;
const REWARD_GAP = 12;

type PanelPart = Phaser.GameObjects.GameObject &
  Phaser.GameObjects.Components.Depth &
  Phaser.GameObjects.Components.ScrollFactor &
  Phaser.GameObjects.Components.Visible;

export interface Task {
  /** Whose errand it is. */
  readonly title: string;
  /** What is being asked for, in words. The row says how many. */
  readonly line: string;
  /** What it is for — or, once it is earned, what it was. */
  readonly bargain: string;
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
  private readonly heading: Phaser.GameObjects.Text;
  private readonly ask: Phaser.GameObjects.Text;
  private readonly bargain: Phaser.GameObjects.Text;
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
    this.heading = this.own(this.text(TITLE_SIZE, INK).setOrigin(0.5, 0));
    this.ask = this.own(this.text(BODY_SIZE, INK).setOrigin(0.5, 0).setAlign("center"));
    this.bargain = this.own(this.text(BODY_SIZE, INK_DIM).setOrigin(0.5, 0).setAlign("center"));
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
        .text(0, 0, "x", { fontFamily: FACE, fontSize: `${CLOSE_SIZE}px`, color: INK })
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

    // Written before it is placed. Both lines wrap, so how tall the sheet's
    // contents are is not known until the words have been set into the width
    // they have — and everything below them hangs off that.
    const room = rect.width - PAD * 2;
    this.heading.setText(task.title).setWordWrapWidth(room - CORNER_ROOM * 2);
    this.ask.setText(task.line).setWordWrapWidth(room);
    this.bargain.setText(task.bargain).setWordWrapWidth(room);

    const tall =
      this.heading.height +
      TITLE_GAP +
      this.ask.height +
      ASK_GAP +
      TOKEN +
      ARROW_GAP +
      22 +
      REWARD +
      REWARD_GAP +
      this.bargain.height;
    // Centred in whatever paper there is, never above the top pad: on a short
    // screen the sheet is smaller than its contents and the heading has to
    // stay on the page even if the bargain runs off the bottom of it.
    let y = Math.max(rect.top + PAD, rect.top + (rect.height - tall) / 2);

    this.heading.setPosition(rect.centreX, y).setVisible(true);
    y += this.heading.height + TITLE_GAP;
    this.ask.setPosition(rect.centreX, y).setVisible(true);
    y += this.ask.height + ASK_GAP;

    // --- the row ------------------------------------------------------------
    const shown = Math.min(task.needed, this.tokens.length);
    const span = shown * TOKEN + (shown - 1) * TOKEN_GAP;
    const left = rect.centreX - span / 2;
    const rowY = y + TOKEN / 2;
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
    y += TOKEN;

    // --- the arrow ----------------------------------------------------------
    const arrowY = y + ARROW_GAP;
    this.ink.lineStyle(3, RULE_HEX, 1);
    this.ink.lineBetween(rect.centreX, arrowY - 12, rect.centreX, arrowY + 10);
    this.ink.lineBetween(rect.centreX, arrowY + 10, rect.centreX - 7, arrowY + 2);
    this.ink.lineBetween(rect.centreX, arrowY + 10, rect.centreX + 7, arrowY + 2);
    y = arrowY + 22;

    // --- what it is for -----------------------------------------------------
    const earned = task.done >= task.needed;
    this.reward
      .setTexture(uiTextureKey(task.reward))
      .setDisplaySize(REWARD, REWARD)
      .setPosition(rect.centreX, y + REWARD / 2)
      .setAlpha(earned ? 1 : DIM)
      .setVisible(true);
    y += REWARD + REWARD_GAP;

    this.bargain.setPosition(rect.centreX, y).setVisible(true);

    this.closeBox.setPosition(rect.left + rect.width - PAD - 14, rect.top + PAD + 10);
    this.closeLabel.setPosition(this.closeBox.x, this.closeBox.y);
  }

  private text(size: number, color: string): Phaser.GameObjects.Text {
    return this.scene.add.text(0, 0, "", {
      fontFamily: FACE,
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
