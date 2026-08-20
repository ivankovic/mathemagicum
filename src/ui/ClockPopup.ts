// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import type { Phrases } from "../i18n/phrases";
import { type CastResult, castResult } from "../spells/cast";
import {
  type ClockTime,
  type HourglassCast,
  type HourglassProblem,
  backspaceHour,
  beginHourglassCast,
  handAngles,
  hourglassHint,
  submitHour,
  typeHourDigit,
} from "../spells/hourglass";
import { PANEL_PAD as PAD, ParchmentPanel } from "./ParchmentPanel";
import type { UiIndex } from "./assets";

/**
 * The parchment the hourglass spell is cast on: two clock faces and a box.
 *
 * The third shape of parchment in the game, after the number line and the
 * array, and it earns its own for the same reason those two do — what it
 * draws *is* the question. A duration is the sweep between two hands, and no
 * number line or rectangle shows that.
 *
 * The two faces are drawn the same size, side by side, left first: the one
 * on the left is when the child put the game down and the one on the right
 * is now. Reading order is the order of time, which is one fewer thing to
 * explain.
 *
 * **The help draws the sweep**, hour by hour, from the first hand toward the
 * second — so a stuck child watches the hand walk round, which is how
 * counting on a clock is taught and not something a line of text can do.
 */

const PANEL_MAX_W = 470;
const PANEL_MAX_H = 430;
const PANEL_MIN_W = 300;
const PANEL_MIN_H = 320;

const INK = "#4a3422";
const INK_DIM = "#8a6a48";
const WRONG_INK = "#a8321e";
const DONE_INK = "#3d6b2a";

const INK_HEX = 0x4a3422;
const PAPER_PALE_HEX = 0xf6e8c4;
const PAPER_HEX = 0xdec694;
const ACTIVE_HEX = 0xc8901c;
const WRONG_HEX = 0xa8321e;
const DONE_HEX = 0x3d6b2a;
const FACE_HEX = 0xf6e8c4;
const RIM_HEX = 0x8a6a48;
const HOUR_HAND_HEX = 0x4a3422;
const MINUTE_HAND_HEX = 0x8a6a48;
/** The sweep the help draws between the two times. */
const SWEEP_HEX = 0xc8901c;

const TITLE_SIZE = 18;
const ASK_SIZE = 12;
const LABEL_SIZE = 12;
const BOX_SIZE = 17;
const HINT_SIZE = 12;

const BOX_W = 62;
const BOX_H = 28;
const KEY_GAP = 6;
const KEY_COLS = 5;
const KEY_ROWS = 3;
const KEY_MAX = 44;
const KEY_MIN = 24;

const FACE_MAX = 62;
const FACE_MIN = 34;
const FACE_GAP = 30;
/** Twelve numerals a face, two faces. */
const NUMERALS = 24;

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

export class ClockPopup {
  private readonly parts: PanelPart[] = [];
  private readonly paper: ParchmentPanel;
  private readonly ink: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly ask: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly captions: Phaser.GameObjects.Text[] = [];
  private readonly numerals: Phaser.GameObjects.Text[] = [];
  private readonly box: Phaser.GameObjects.Rectangle;
  private readonly boxText: Phaser.GameObjects.Text;
  private readonly keys: PadKey[] = [];
  private readonly closeRect: Phaser.GameObjects.Rectangle;
  private readonly closeText: Phaser.GameObjects.Text;

  private state: HourglassCast | null = null;
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
    for (let n = 0; n < 2; n++) {
      this.captions.push(this.own(this.label("", LABEL_SIZE, INK).setOrigin(0.5, 0)));
    }
    for (let n = 0; n < NUMERALS; n++) {
      this.numerals.push(this.own(this.label("", LABEL_SIZE - 2, INK_DIM).setOrigin(0.5)));
    }
    this.box = this.own(
      add.rectangle(0, 0, BOX_W, BOX_H, PAPER_PALE_HEX).setStrokeStyle(3, ACTIVE_HEX),
    );
    this.boxText = this.own(this.label("", BOX_SIZE, INK).setOrigin(0.5));

    this.buildKeypad();

    this.closeRect = this.own(
      add
        .rectangle(0, 0, 26, 26, PAPER_HEX)
        .setStrokeStyle(2, INK_HEX)
        .setInteractive({ useHandCursor: true }),
    );
    this.closeText = this.own(this.label("x", LABEL_SIZE, INK).setOrigin(0.5));
    this.closeRect.on("pointerdown", () => this.dismiss(false));

    for (const part of this.parts) {
      part.setDepth(depth).setScrollFactor(0).setVisible(false);
      register(part);
    }
    this.ink.setDepth(depth + 1);
    this.box.setDepth(depth + 2);
    for (const text of [this.boxText, ...this.numerals, ...this.captions]) {
      text.setDepth(depth + 3);
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

  /** The cast in progress, or null. A dev seam, as `SpellPopup.cast` is. */
  get cast(): HourglassCast | null {
    return this.state;
  }

  get isOpen(): boolean {
    return this.state !== null;
  }

  open(problem: HourglassProblem, onDone: (result: CastResult) => void): void {
    this.state = beginHourglassCast(problem);
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

  private dismiss(solved: boolean): void {
    const done = this.finish;
    const result = castResult(this.state, solved);
    this.close();
    done?.(result);
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (!this.state) return;
    if (event.key >= "0" && event.key <= "9") {
      this.apply(typeHourDigit(this.state, Number(event.key)));
    } else if (event.key === "Backspace") this.apply(backspaceHour(this.state));
    else if (event.key === "Enter") this.apply(submitHour(this.state));
    else if (event.key === "Escape") this.dismiss(false);
    else return;
    event.preventDefault();
  }

  private apply(next: HourglassCast): void {
    this.state = next;
    this.render();
    if (next.done) this.scene.time.delayedCall(650, () => this.dismiss(true));
  }

  private buildKeypad(): void {
    const press = (label: string) => () => {
      if (!this.state) return;
      if (label === "OK") this.apply(submitHour(this.state));
      else if (label === "<") this.apply(backspaceHour(this.state));
      else this.apply(typeHourDigit(this.state, Number(label)));
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
      fontFamily: "monospace",
      fontSize: `${size}px`,
      color,
    });
  }

  private own<T extends PanelPart>(object: T): T {
    this.parts.push(object);
    return object;
  }

  layout(): void {
    if (!this.state) return;
    this.render();
  }

  private render(): void {
    const state = this.state;
    if (!state) return;
    const problem = state.problem;
    const { width, height } = this.scene.scale;
    const rect = this.paper.layout(width, height);
    const { left, top } = rect;
    const panelW = rect.width;
    const panelH = rect.height;
    const cx = rect.centreX;

    this.closeRect.setPosition(left + panelW - PAD - 2, top + PAD + 2);
    this.closeText.setPosition(this.closeRect.x, this.closeRect.y);

    const innerW = panelW - PAD * 2;
    const innerH = panelH - PAD * 2;

    const faceBlockMin = FACE_MIN * 2 + BOX_H + 40;
    const spare =
      innerH - TITLE_SIZE - ASK_SIZE - 16 - HINT_SIZE - 8 - faceBlockMin - KEY_GAP * (KEY_ROWS - 1);
    const keySize = Math.max(
      KEY_MIN,
      Math.min(KEY_MAX, Math.floor(spare / KEY_ROWS), Math.floor(innerW / KEY_COLS) - KEY_GAP),
    );
    const keypadH = keySize * KEY_ROWS + KEY_GAP * (KEY_ROWS - 1);
    const keypadW = keySize * KEY_COLS + KEY_GAP * (KEY_COLS - 1);
    const keypadTop = top + panelH - PAD - keypadH;
    const keypadLeft = cx - keypadW / 2;

    for (const key of this.keys) {
      const w = keySize * key.span + KEY_GAP * (key.span - 1);
      const x = keypadLeft + key.col * (keySize + KEY_GAP) + w / 2;
      const y = keypadTop + key.row * (keySize + KEY_GAP) + keySize / 2;
      key.rect.setSize(w, keySize).setPosition(x, y);
      key.text.setPosition(x, y);
    }

    this.title.setText(this.words.hourglassTitle).setPosition(cx, top + PAD);
    this.ask.setText(this.words.hourglassAsk).setPosition(cx, top + PAD + TITLE_SIZE + 4);

    this.hint
      .setText(this.hintLine(state))
      .setColor(state.wrong ? WRONG_INK : INK_DIM)
      .setPosition(cx, keypadTop - HINT_SIZE - 8);

    // --- the two faces ------------------------------------------------------

    const contentTop = top + PAD + TITLE_SIZE + ASK_SIZE + 14;
    const contentBottom = keypadTop - HINT_SIZE - 14;
    const roomH = contentBottom - contentTop - BOX_H - LABEL_SIZE - 16;
    const radius = Math.max(
      FACE_MIN,
      Math.min(FACE_MAX, Math.floor((innerW - FACE_GAP) / 4), Math.floor(roomH / 2)),
    );
    const faceY = contentTop + radius + LABEL_SIZE + 4;
    const centres = [cx - radius - FACE_GAP / 2, cx + radius + FACE_GAP / 2];

    this.ink.clear();
    for (const numeral of this.numerals) numeral.setVisible(false);

    const shown = state.done ? problem.hours : hourglassHint(state);
    for (const [side, at] of [problem.left, problem.back].entries()) {
      const faceX = centres[side] as number;
      this.drawFace(faceX, faceY, radius, at, problem.numerals, side);
      this.captions[side]
        ?.setText(side === 0 ? this.words.hourglassLeft : this.words.hourglassBack)
        .setPosition(faceX, contentTop)
        .setVisible(true);
    }
    // The sweep, over the left-hand face: how far round the hand has been
    // walked so far. Drawn only when the child has asked for it by getting
    // one wrong, and never all the way — the last step is the answer.
    if (shown > 0) {
      this.drawSweep(centres[0] as number, faceY, radius, problem.left, shown, state.done);
    }

    // --- the answer ---------------------------------------------------------

    const boxY = faceY + radius + 16 + BOX_H / 2;
    this.box.setPosition(cx, boxY);
    this.boxText.setPosition(cx, boxY);
    if (state.done) {
      this.box.setStrokeStyle(3, DONE_HEX);
      this.boxText.setText(state.entry).setColor(DONE_INK);
    } else {
      this.box.setStrokeStyle(3, state.wrong ? WRONG_HEX : ACTIVE_HEX);
      this.boxText.setText(state.entry === "" ? "_" : state.entry).setColor(INK);
    }
  }

  /** One clock: rim, marks or numerals, and two hands. */
  private drawFace(
    cx: number,
    cy: number,
    radius: number,
    at: ClockTime,
    numerals: boolean,
    side: number,
  ): void {
    this.ink.fillStyle(RIM_HEX, 1);
    this.ink.fillCircle(cx, cy, radius);
    this.ink.fillStyle(FACE_HEX, 1);
    this.ink.fillCircle(cx, cy, radius - 3);

    // Twelve ticks always, and the numerals only at the rungs that print
    // them: a face with neither is not a clock, and taking the *ticks* away
    // would make it unreadable rather than harder.
    this.ink.lineStyle(1, RIM_HEX, 1);
    for (let n = 0; n < 12; n++) {
      const angle = ((n * 30 - 90) * Math.PI) / 180;
      const long = n % 3 === 0 ? 7 : 4;
      this.ink.lineBetween(
        cx + Math.cos(angle) * (radius - 5 - long),
        cy + Math.sin(angle) * (radius - 5 - long),
        cx + Math.cos(angle) * (radius - 5),
        cy + Math.sin(angle) * (radius - 5),
      );
      if (!numerals) continue;
      const numeral = this.numerals[side * 12 + n];
      numeral
        ?.setText(String(n === 0 ? 12 : n))
        .setPosition(cx + Math.cos(angle) * (radius - 15), cy + Math.sin(angle) * (radius - 15))
        .setVisible(true);
    }

    const angles = handAngles(at);
    const hand = (degrees: number, length: number, colour: number, thickness: number) => {
      const angle = ((degrees - 90) * Math.PI) / 180;
      this.ink.lineStyle(thickness, colour, 1);
      this.ink.lineBetween(cx, cy, cx + Math.cos(angle) * length, cy + Math.sin(angle) * length);
    };
    hand(angles.minute, radius - 10, MINUTE_HAND_HEX, 2);
    hand(angles.hour, radius * 0.55, HOUR_HAND_HEX, 4);
    this.ink.fillStyle(HOUR_HAND_HEX, 1);
    this.ink.fillCircle(cx, cy, 3);
  }

  /**
   * The sweep: `hours` of the way round, from where the first hand stands.
   *
   * Drawn as a fan of hour-wide wedges rather than as one arc, because what
   * a child is counting is *hours* — one, two, three — and a smooth arc has
   * no ones in it.
   */
  private drawSweep(
    cx: number,
    cy: number,
    radius: number,
    from: ClockTime,
    hours: number,
    done: boolean,
  ): void {
    const start = handAngles(from).hour;
    this.ink.lineStyle(3, SWEEP_HEX, done ? 1 : 0.85);
    for (let n = 0; n < hours; n++) {
      const a0 = ((start + n * 30 - 90) * Math.PI) / 180;
      const a1 = ((start + (n + 1) * 30 - 90) * Math.PI) / 180;
      const r = radius + 6;
      this.ink.beginPath();
      for (let step = 0; step <= 8; step++) {
        const angle = a0 + ((a1 - a0) * step) / 8;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (step === 0) this.ink.moveTo(x, y);
        else this.ink.lineTo(x, y);
      }
      this.ink.strokePath();
      // A tick between each hour and the next, so the fan reads as a count
      // rather than as one long stroke.
      this.ink.lineBetween(
        cx + Math.cos(a1) * (r - 4),
        cy + Math.sin(a1) * (r - 4),
        cx + Math.cos(a1) * (r + 4),
        cy + Math.sin(a1) * (r + 4),
      );
    }
  }

  private hintLine(state: HourglassCast): string {
    if (state.done) return this.words.hourglassSolved(state.problem.hours);
    const shown = hourglassHint(state);
    return shown > 0 ? this.words.hourglassCountOn(shown) : "";
  }

  destroy(): void {
    this.close();
    this.paper.destroy();
    for (const part of this.parts) part.destroy();
  }
}
