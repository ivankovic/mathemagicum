// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import type { Phrases } from "../i18n/phrases";
import { type CastResult, castResult } from "../spells/cast";
import {
  type ShareBox,
  type ShareCast,
  type ShareProblem,
  backspaceShare,
  beginShareCast,
  boxesOf,
  focusShareBox,
  heapLeft,
  shareHint,
  showsRings,
  submitShare,
  typeShareDigit,
} from "../spells/division";
import { PANEL_PAD as PAD, ParchmentPanel } from "./ParchmentPanel";
import type { UiIndex } from "./assets";
import {
  ACTIVE_HEX,
  DONE_HEX,
  DONE_INK,
  FACE,
  INK,
  INK_DIM,
  INK_HEX,
  PAPER_HEX,
  PAPER_PALE_HEX,
  RULE_HEX,
  WRONG_HEX,
  WRONG_INK,
} from "./parchment";

/**
 * The parchment the division spell is cast on.
 *
 * The third of these — a number line for the journeys, a rectangle for the
 * shape, and now a row of baskets for the share — and the split is the same
 * one every time: the picture is the method, not an illustration of it.
 *
 * **The picture is dealing.** A heap at the top, baskets under it, and the
 * crop going round the baskets one at a time. That is what a child does with
 * a pile of apples and four friends, and it is the only picture of division
 * in which a remainder is obvious rather than mysterious: the leftovers are
 * the ones still in the heap when no basket can take another.
 *
 * **Help arrives as dealing, never as the answer.** A wrong answer fills one
 * more basket, and the last basket is never filled — that one is the answer
 * laid out in apples. Exactly the ladder `ArrayPopup` climbs by counting
 * rows, and it stops one short for the same reason.
 *
 * **Two boxes only where there is no picture.** Once the baskets are drawn
 * the leftovers are lying on the parchment, so asking for them would be
 * asking a child to read rather than to divide. At the top rung nothing is
 * drawn and both are asked — and the leftover box is there whether or not
 * there is a leftover, because a box that appeared only when the answer was
 * not nought would answer the question by appearing.
 *
 * Everything is drawn in real screen pixels and belongs to the UI camera, so
 * `register` is handed each object exactly as the joystick does it.
 */

const PANEL_MAX_W = 460;
const PANEL_MAX_H = 440;
const PANEL_MIN_W = 280;
const PANEL_MIN_H = 310;
/** And how tall it is when there is nothing to draw. See `render`. */
const BARE_MAX_H = 330;

/** The crop, in the heap and in the baskets. The array spell's own green. */
const CROP_HEX = 0x5f8f3a;
const CROP_DEALT_HEX = 0x2f5c1c;

const TITLE_SIZE = 20;
const ASK_SIZE = 12;
const BOX_SIZE = 17;
const HINT_SIZE = 12;

const BOX_W = 62;
const BOX_H = 28;
const BOX_GAP = 14;
const KEY_GAP = 6;
const KEY_COLS = 5;
const KEY_ROWS = 3;
const KEY_MAX = 44;
const KEY_MIN = 24;

/** The most baskets any rung sets, so the pool is made once. See SHARE_RUNGS. */
const MOST_PARTS = 10;
/** And the biggest heap those rungs can make, for the same reason. */
const MOST_CROP = 40;

const CROP_MAX = 11;
const CROP_MIN = 4;
const CROP_GAP = 3;

type PanelPart = Phaser.GameObjects.GameObject &
  Phaser.GameObjects.Components.Depth &
  Phaser.GameObjects.Components.ScrollFactor &
  Phaser.GameObjects.Components.Visible;

interface PadKey {
  readonly rect: Phaser.GameObjects.Rectangle;
  readonly text: Phaser.GameObjects.Text;
  readonly col: number;
  readonly row: number;
  readonly span: number;
}

interface Slot {
  readonly rect: Phaser.GameObjects.Rectangle;
  readonly text: Phaser.GameObjects.Text;
}

export class SharePopup {
  private readonly parts: PanelPart[] = [];
  private readonly paper: ParchmentPanel;
  private readonly ink: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly ask: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly slots = new Map<ShareBox, Slot>();
  private readonly keys: PadKey[] = [];
  private readonly closeRect: Phaser.GameObjects.Rectangle;
  private readonly closeText: Phaser.GameObjects.Text;

  private state: ShareCast | null = null;
  private finish: ((result: CastResult) => void) | null = null;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    index: UiIndex,
    depth: number,
    private words: Phrases,
    register: (object: Phaser.GameObjects.GameObject) => void,
  ) {
    const add = scene.add;
    this.paper = new ParchmentPanel(scene, index, {
      maxWidth: PANEL_MAX_W,
      maxHeight: PANEL_MAX_H,
      minWidth: PANEL_MIN_W,
      minHeight: PANEL_MIN_H,
      depth,
      register,
    });

    this.ink = this.own(add.graphics());
    this.title = this.own(this.label("", TITLE_SIZE, INK).setOrigin(0.5, 0));
    this.ask = this.own(this.label("", ASK_SIZE, INK_DIM).setOrigin(0.5, 0));
    this.hint = this.own(this.label("", HINT_SIZE, INK_DIM).setOrigin(0.5, 0));

    for (const which of ["each", "left"] as const) {
      const rect = this.own(
        add
          .rectangle(0, 0, BOX_W, BOX_H, PAPER_PALE_HEX)
          .setStrokeStyle(3, ACTIVE_HEX)
          .setInteractive({ useHandCursor: true }),
      );
      // Tappable, so a child who has answered the share and wants to change
      // it can go back to it. The keypad alone would make the two boxes a
      // one-way street.
      rect.on("pointerdown", () => {
        if (this.state) this.apply(focusShareBox(this.state, which));
      });
      this.slots.set(which, { rect, text: this.own(this.label("", BOX_SIZE, INK).setOrigin(0.5)) });
    }

    this.buildKeypad();

    this.closeRect = this.own(
      add
        .rectangle(0, 0, 26, 26, PAPER_HEX)
        .setStrokeStyle(2, INK_HEX)
        .setInteractive({ useHandCursor: true }),
    );
    this.closeText = this.own(this.label("x", BOX_SIZE - 4, INK).setOrigin(0.5));
    this.closeRect.on("pointerdown", () => this.dismiss(false));

    for (const part of this.parts) {
      part.setDepth(depth).setScrollFactor(0).setVisible(false);
      register(part);
    }
    this.ink.setDepth(depth + 1);
    for (const slot of this.slots.values()) {
      slot.rect.setDepth(depth + 2);
      slot.text.setDepth(depth + 3);
    }
    for (const key of this.keys) {
      key.rect.setDepth(depth + 2);
      key.text.setDepth(depth + 3);
    }
    this.closeRect.setDepth(depth + 2);
    this.closeText.setDepth(depth + 3);
  }

  setPhrases(words: Phrases): void {
    this.words = words;
    if (this.isOpen) this.layout();
  }

  /** The cast in progress, or null. A dev seam, as `ArrayPopup.cast` is. */
  get cast(): ShareCast | null {
    return this.state;
  }

  get isOpen(): boolean {
    return this.state !== null;
  }

  open(problem: ShareProblem, onDone: (result: CastResult) => void): void {
    this.state = beginShareCast(problem);
    this.finish = onDone;
    this.paper.setVisible(true);
    for (const part of this.parts) part.setVisible(true);
    this.keyHandler = (event: KeyboardEvent) => this.onKeyDown(event);
    this.scene.input.keyboard?.on("keydown", this.keyHandler);
    this.layout();
  }

  close(): void {
    if (this.keyHandler) {
      this.scene.input.keyboard?.off("keydown", this.keyHandler);
      this.keyHandler = null;
    }
    this.state = null;
    this.finish = null;
    this.paper.setVisible(false);
    this.ink.clear();
    for (const part of this.parts) part.setVisible(false);
  }

  layout(): void {
    if (this.state) this.render();
  }

  destroy(): void {
    this.close();
    this.paper.destroy();
    for (const part of this.parts) part.destroy();
  }

  private dismiss(solved: boolean): void {
    const done = this.finish;
    const result = castResult(this.state, solved);
    this.close();
    done?.(result);
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (!this.state) return;
    if (event.key >= "0" && event.key <= "9") {
      this.apply(typeShareDigit(this.state, Number(event.key)));
    } else if (event.key === "Backspace") this.apply(backspaceShare(this.state));
    else if (event.key === "Enter") this.apply(submitShare(this.state));
    else if (event.key === "Escape") this.dismiss(false);
    else return;
    event.preventDefault();
  }

  private apply(next: ShareCast): void {
    this.state = next;
    this.render();
    // A beat on the finished parchment, with every basket filled and the
    // answer in the box, before the harvest happens in the world.
    if (next.done) this.scene.time.delayedCall(650, () => this.dismiss(true));
  }

  private buildKeypad(): void {
    const press = (label: string) => () => {
      if (!this.state) return;
      if (label === "OK") this.apply(submitShare(this.state));
      else if (label === "<") this.apply(backspaceShare(this.state));
      else this.apply(typeShareDigit(this.state, Number(label)));
    };
    const rows: (readonly [string, number][])[] = [
      [
        ["1", 1],
        ["2", 1],
        ["3", 1],
        ["4", 1],
        ["5", 1],
      ],
      [
        ["6", 1],
        ["7", 1],
        ["8", 1],
        ["9", 1],
        ["0", 1],
      ],
      [
        ["<", 2],
        ["OK", 3],
      ],
    ];
    for (const [row, entries] of rows.entries()) {
      let col = 0;
      for (const [label, span] of entries) {
        const rect = this.own(
          this.scene.add
            .rectangle(0, 0, 1, 1, PAPER_HEX)
            .setStrokeStyle(2, INK_HEX)
            .setInteractive({ useHandCursor: true }),
        );
        const text = this.own(this.label(label, BOX_SIZE, INK).setOrigin(0.5));
        rect.on("pointerdown", press(label));
        this.keys.push({ rect, text, col, row, span });
        col += span;
      }
    }
  }

  private label(text: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.scene.add.text(0, 0, text, {
      fontFamily: FACE,
      fontSize: `${size}px`,
      color,
    });
  }

  private own<T extends PanelPart>(object: T): T {
    this.parts.push(object);
    return object;
  }

  private render(): void {
    const state = this.state;
    if (!state) return;
    const problem = state.problem;
    const { width, height } = this.scene.scale;
    // A shorter sheet where there is no picture on it. The parchment is
    // sized for a heap and a row of baskets; the top rung has neither, and a
    // full-height sheet with two boxes floating in the middle of it reads as
    // a panel that failed to draw rather than as a question without a
    // picture.
    const rect = this.paper.layout(width, height, showsRings(problem) ? undefined : BARE_MAX_H);
    const cx = rect.centreX;
    const innerW = rect.width - PAD * 2;
    const innerH = rect.height - PAD * 2;

    this.closeRect.setPosition(rect.left + rect.width - PAD - 2, rect.top + PAD + 2);
    this.closeText.setPosition(this.closeRect.x, this.closeRect.y);

    // --- the keypad, off the bottom -----------------------------------------
    const spare = innerH - TITLE_SIZE - ASK_SIZE - 16 - HINT_SIZE - 8 - BOX_H - 90;
    const keySize = Math.max(
      KEY_MIN,
      Math.min(KEY_MAX, Math.floor(spare / KEY_ROWS), Math.floor(innerW / KEY_COLS) - KEY_GAP),
    );
    const keypadH = keySize * KEY_ROWS + KEY_GAP * (KEY_ROWS - 1);
    const keypadW = keySize * KEY_COLS + KEY_GAP * (KEY_COLS - 1);
    const keypadTop = rect.top + rect.height - PAD - keypadH;
    const keypadLeft = cx - keypadW / 2;
    for (const key of this.keys) {
      const w = keySize * key.span + KEY_GAP * (key.span - 1);
      const x = keypadLeft + key.col * (keySize + KEY_GAP) + w / 2;
      const y = keypadTop + key.row * (keySize + KEY_GAP) + keySize / 2;
      key.rect.setSize(w, keySize).setPosition(x, y);
      key.text.setPosition(x, y);
    }

    // --- what is being asked -------------------------------------------------
    this.title
      .setText(this.words.shareTitle(problem.total, problem.parts))
      .setPosition(cx, rect.top + PAD);
    this.ask
      .setText(state.box === "left" ? this.words.shareAskLeft : this.words.shareAsk)
      .setPosition(cx, rect.top + PAD + TITLE_SIZE + 4);
    this.hint
      .setText(this.hintLine(state))
      .setColor(state.wrong ? WRONG_INK : INK_DIM)
      .setPosition(cx, keypadTop - HINT_SIZE - 8);

    // --- the boxes ------------------------------------------------------------
    const boxes = boxesOf(problem);
    const boxRow = boxes.length * BOX_W + (boxes.length - 1) * BOX_GAP;
    const contentTop = rect.top + PAD + TITLE_SIZE + ASK_SIZE + 12;
    const contentBottom = keypadTop - HINT_SIZE - 16;
    // Under the picture where there is one, and in the middle of the sheet
    // where there is not. The top rung draws nothing at all, and boxes
    // pinned above the hint left a hand's breadth of blank parchment over
    // them — which reads as a panel that failed to draw rather than as a
    // question with no picture.
    const boxY = showsRings(problem)
      ? contentBottom - BOX_H / 2
      : Math.round((contentTop + contentBottom) / 2);
    for (const [which, slot] of this.slots) {
      const at = boxes.indexOf(which);
      slot.rect.setVisible(at >= 0);
      slot.text.setVisible(at >= 0);
      if (at < 0) continue;
      const x = cx - boxRow / 2 + at * (BOX_W + BOX_GAP) + BOX_W / 2;
      slot.rect.setPosition(x, boxY);
      slot.text.setPosition(x, boxY);
      const typed = which === "each" ? state.each : state.left;
      if (state.done) {
        slot.rect.setStrokeStyle(3, DONE_HEX);
        slot.text.setText(typed).setColor(DONE_INK);
        continue;
      }
      const here = state.box === which;
      slot.rect.setStrokeStyle(
        here ? 3 : 2,
        state.wrong ? WRONG_HEX : here ? ACTIVE_HEX : RULE_HEX,
      );
      // The caret only in the box the keypad is filling, so which one is
      // listening is visible without reading the line above.
      slot.text.setText(typed === "" ? (here ? "_" : "") : typed).setColor(INK);
    }

    // --- the heap and the baskets --------------------------------------------
    this.ink.clear();
    if (showsRings(problem)) {
      this.drawDealing(state, cx, innerW, contentTop, boxY - BOX_H / 2 - 10);
    }
    // What each box is for, drawn rather than written: a basket over the one
    // that asks what a basket gets, and loose crop over the one that asks
    // what would not go in. Two identical boxes side by side is a question a
    // child has to be told the answer to before they can answer it.
    //
    // Only when there are two. One box standing under a row of baskets is
    // already labelled by the row — and a second basket drawn over it landed
    // inside the picture, on top of whichever basket it happened to line up
    // with.
    if (boxes.length > 1) {
      for (const [which, slot] of this.slots) {
        if (!slot.rect.visible) continue;
        this.drawTag(which, slot.rect.x, boxY - BOX_H / 2 - 12, state.box === which);
      }
    }
  }

  /**
   * The heap, and the baskets it is going into.
   *
   * Both drawn from one number — how many baskets have been dealt — so the
   * picture cannot disagree with itself: what is in the baskets and what is
   * left in the heap are two views of the same count. See `heapLeft`.
   */
  private drawDealing(
    state: ShareCast,
    cx: number,
    innerW: number,
    top: number,
    bottom: number,
  ): void {
    const problem = state.problem;
    const dealt = state.done ? problem.parts : shareHint(state);
    const inHeap = heapLeft(problem, dealt);

    // The baskets take the bottom half and the heap what is left, because a
    // heap that grew downward would push the baskets about as it emptied —
    // and a picture that moves while a child is counting it is a picture
    // they have to start again.
    const basketTop = Math.round((top + bottom) / 2);
    const room = { width: innerW, top, bottom: basketTop - 8 };

    // --- the heap ------------------------------------------------------------
    const heapWide = Math.min(8, Math.max(1, inHeap));
    const heapStep = this.cropStep(room.width, heapWide, room.bottom - room.top, MOST_CROP / 8);
    const heapRows = Math.max(1, Math.ceil(inHeap / heapWide));
    const heapLeftX = cx - (heapWide * heapStep) / 2;
    const heapTopY = room.bottom - heapRows * heapStep;
    this.ink.fillStyle(CROP_HEX, 1);
    for (let n = 0; n < inHeap; n++) {
      this.ink.fillCircle(
        heapLeftX + (n % heapWide) * heapStep + heapStep / 2,
        heapTopY + Math.floor(n / heapWide) * heapStep + heapStep / 2,
        Math.max(CROP_MIN, heapStep - CROP_GAP) / 2,
      );
    }

    // --- the baskets ---------------------------------------------------------
    const count = Math.min(MOST_PARTS, problem.parts);
    const basketW = Math.min(74, Math.floor((innerW - (count - 1) * 6) / count));
    const basketH = Math.max(22, Math.min(74, bottom - basketTop));
    const rowLeft = cx - (count * basketW + (count - 1) * 6) / 2;
    for (let n = 0; n < count; n++) {
      const x = rowLeft + n * (basketW + 6);
      const full = n < dealt;
      this.ink.lineStyle(2, full ? CROP_DEALT_HEX : RULE_HEX, 1);
      // A basket rather than a ring: open at the top, because things are
      // going into it. A closed circle reads as a full stop.
      this.ink.beginPath();
      this.ink.moveTo(x, basketTop);
      this.ink.lineTo(x + basketW * 0.12, basketTop + basketH);
      this.ink.lineTo(x + basketW * 0.88, basketTop + basketH);
      this.ink.lineTo(x + basketW, basketTop);
      this.ink.strokePath();
      if (!full) continue;
      const wide = Math.min(3, Math.max(1, problem.each));
      const step = this.cropStep(basketW - 10, wide, basketH - 8, 4);
      const rows = Math.ceil(problem.each / wide);
      const inLeft = x + basketW / 2 - (wide * step) / 2;
      const inTop = basketTop + basketH - 5 - rows * step;
      this.ink.fillStyle(CROP_DEALT_HEX, 1);
      for (let crop = 0; crop < problem.each; crop++) {
        this.ink.fillCircle(
          inLeft + (crop % wide) * step + step / 2,
          inTop + Math.floor(crop / wide) * step + step / 2,
          Math.max(CROP_MIN, step - CROP_GAP) / 2,
        );
      }
    }
  }

  /** The little picture over a box that says what the box is for. */
  private drawTag(which: ShareBox, x: number, bottom: number, lit: boolean): void {
    const ink = lit ? CROP_DEALT_HEX : RULE_HEX;
    if (which === "each") {
      const w = 20;
      const h = 13;
      this.ink.lineStyle(2, ink, 1);
      this.ink.beginPath();
      this.ink.moveTo(x - w / 2, bottom - h);
      this.ink.lineTo(x - w / 2 + 2, bottom);
      this.ink.lineTo(x + w / 2 - 2, bottom);
      this.ink.lineTo(x + w / 2, bottom - h);
      this.ink.strokePath();
      return;
    }
    // Loose, and outside anything: that is the whole of what a leftover is.
    this.ink.fillStyle(ink, 1);
    for (const at of [-8, 0, 8]) this.ink.fillCircle(x + at, bottom - 5, 3.5);
  }

  /** How big one crop is drawn, so a heap of forty still fits the sheet. */
  private cropStep(width: number, across: number, height: number, down: number): number {
    return Math.max(
      CROP_MIN + CROP_GAP,
      Math.min(
        CROP_MAX + CROP_GAP,
        Math.floor(width / Math.max(1, across)),
        Math.floor(height / Math.max(1, down)),
      ),
    );
  }

  private hintLine(state: ShareCast): string {
    const { each, left, parts, total } = state.problem;
    if (state.done) return this.words.shareDone(total, parts, each, left);
    if (!showsRings(state.problem)) {
      // Counting up in *baskets*, not in shares. Counting in fours when the
      // answer is four is not a hint, it is the answer with a comma in it.
      return state.missteps >= state.problem.hintAfter ? this.words.shareHintCount(parts) : "";
    }
    const dealt = shareHint(state);
    return dealt === 0 ? "" : this.words.shareHintDeal(dealt, dealt * each);
  }
}
