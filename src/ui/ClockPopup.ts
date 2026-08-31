// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import type { Phrases } from "../i18n/phrases";
import { type CastResult, castResult } from "../spells/cast";
import {
  type ClockRung,
  type ClockTime,
  type HourglassCast,
  SWIPE_PER_TICK,
  askedOf,
  asksMinutes,
  backspaceClock,
  beginHourglassCast,
  forwardMinutes,
  handAngles,
  hourglassHint,
  moved,
  nextBox,
  submitClock,
  turnBy,
  typeClockDigit,
  windMinutes,
} from "../spells/hourglass";
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
  WRONG_HEX,
  WRONG_INK,
} from "./parchment";

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
  /** The second answer, where the rung's face can show minutes at all. */
  private readonly minuteBox: Phaser.GameObjects.Rectangle;
  private readonly minuteText: Phaser.GameObjects.Text;
  private readonly units: Phaser.GameObjects.Text[] = [];
  /**
   * The stretch of parchment a swipe counts on, and where the finger was.
   *
   * Everything above the answer boxes, which is most of the panel — the two
   * faces and the space round them. Generous on purpose: this replaces
   * taking hold of a *hand*, which meant catching one of two two-pixel lines
   * and having the right one chosen by how far from the middle you grabbed.
   *
   * `travel` is how far the finger has gone since the last tick was counted,
   * kept so that a slow drag adds up instead of being rounded away a pixel
   * at a time.
   */
  private swipeArea: { left: number; top: number; right: number; bottom: number } | null = null;
  private lastAt: { x: number; y: number } | null = null;
  private travel = 0;
  private readonly keys: PadKey[] = [];
  private readonly closeRect: Phaser.GameObjects.Rectangle;
  private readonly closeText: Phaser.GameObjects.Text;

  private state: HourglassCast | null = null;
  private moveHandler: ((pointer: Phaser.Input.Pointer) => void) | null = null;
  private downHandler: ((pointer: Phaser.Input.Pointer) => void) | null = null;
  private finish: ((result: CastResult, to: ClockTime | null, minutes: number) => void) | null =
    null;
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
    this.minuteBox = this.own(
      add.rectangle(0, 0, BOX_W, BOX_H, PAPER_PALE_HEX).setStrokeStyle(3, INK_HEX),
    );
    this.minuteText = this.own(this.label("", BOX_SIZE, INK).setOrigin(0.5));
    for (let which = 0; which < 2; which++) {
      this.units.push(this.own(this.label("", LABEL_SIZE, INK_DIM).setOrigin(0, 0.5)));
    }

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

  /**
   * Where the face she can move is, and how big.
   *
   * The one control in this game that is a *picture* rather than a button:
   * there is nothing in `ui()` for a script to press, and the hand it has to
   * take hold of is two pixels wide. Same argument as the shop's counter —
   * a drop area nobody can name is a drop area nobody can test.
   */
  get face(): { left: number; top: number; right: number; bottom: number } | null {
    return this.swipeArea;
  }

  get isOpen(): boolean {
    return this.state !== null;
  }

  open(
    from: ClockTime,
    rung: ClockRung,
    onDone: (result: CastResult, to: ClockTime | null, minutes: number) => void,
  ): void {
    this.state = beginHourglassCast(from, rung);
    this.finish = onDone;
    this.paper.setVisible(true);
    for (const part of this.parts) part.setVisible(true);
    this.keyHandler = (event: KeyboardEvent) => this.onKeyDown(event);
    this.scene.input.keyboard?.on("keydown", this.keyHandler);
    // On the scene, not on the face: a finger that slides off the clock is
    // still holding the hand it grabbed, and letting go anywhere lets go.
    this.moveHandler = (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) this.swing(pointer);
      else this.lastAt = null;
    };
    this.downHandler = (pointer: Phaser.Input.Pointer) => this.grab(pointer);
    this.scene.input.on("pointerdown", this.downHandler);
    this.scene.input.on("pointermove", this.moveHandler);
    this.scene.input.on("pointerup", this.moveHandler);
    this.layout();
  }

  close(): void {
    if (this.keyHandler) {
      this.scene.input.keyboard?.off("keydown", this.keyHandler);
      this.keyHandler = null;
    }
    if (this.moveHandler) {
      this.scene.input.off("pointermove", this.moveHandler);
      this.scene.input.off("pointerup", this.moveHandler);
      this.moveHandler = null;
    }
    if (this.downHandler) {
      this.scene.input.off("pointerdown", this.downHandler);
      this.downHandler = null;
    }
    this.lastAt = null;
    this.travel = 0;
    this.swipeArea = null;
    this.state = null;
    this.finish = null;
    this.paper.setVisible(false);
    this.ink.clear();
    for (const part of this.parts) part.setVisible(false);
  }

  private dismiss(solved: boolean): void {
    const done = this.finish;
    const result = castResult(this.state, solved);
    // Where she put the hands, read before the state is thrown away. Null
    // unless the answer was right: a spell that wound the clock for a child
    // who could not say how far would be a spell with no question in it, and
    // closing the parchment is not casting it.
    //
    // The time itself rather than the span, because the span is measured
    // between two *rounded* faces and the world is not rounded. Winding by
    // it would leave the world a few minutes off the time she pointed at —
    // which nobody would see at the gentlest rung and everybody would at the
    // hardest.
    const to = solved && this.state ? this.state.to : null;
    // And how far she said, which the face alone cannot carry: hands taken
    // all the way round point at the time they started from, so "land on
    // that face" is a move of nothing and she asked for twelve hours. See
    // `windMinutes`.
    const minutes = solved && this.state ? windMinutes(this.state) : 0;
    this.close();
    done?.(result, to, minutes);
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (!this.state) return;
    if (event.key >= "0" && event.key <= "9") {
      this.apply(typeClockDigit(this.state, Number(event.key)));
    } else if (event.key === "Backspace") this.apply(backspaceClock(this.state));
    else if (event.key === "Enter") this.apply(submitClock(this.state));
    else if (event.key === "Tab") this.apply(nextBox(this.state));
    else if (event.key === "Escape") this.dismiss(false);
    else return;
    event.preventDefault();
  }

  private apply(next: HourglassCast): void {
    this.state = next;
    this.render();
    if (next.done) this.scene.time.delayedCall(650, () => this.dismiss(true));
  }

  /**
   * Take hold of a hand, and swing it.
   *
   * The angle is where the finger is rather than where the hand was, so the
   * hand comes to the finger — a hand that moved by the same amount the
   * finger did would drift away from it over a long drag.
   */
  private grab(pointer: Phaser.Input.Pointer): void {
    const area = this.swipeArea;
    if (!area || !this.state) return;
    if (pointer.x < area.left || pointer.x > area.right) return;
    if (pointer.y < area.top || pointer.y > area.bottom) return;
    this.lastAt = { x: pointer.x, y: pointer.y };
    this.travel = 0;
  }

  /**
   * Follow the finger, counting out ticks as it goes.
   *
   * Measured as *movement* rather than as position, so the clock turns by
   * however far the swipe went and keeps turning if it goes round again —
   * which is what winding something feels like, and what a position-based
   * reading could not do without knowing where the middle was.
   */
  private swing(pointer: Phaser.Input.Pointer): void {
    const last = this.lastAt;
    if (!last || !this.state) return;
    this.travel += (pointer.x - last.x + (pointer.y - last.y)) / Math.SQRT2;
    this.lastAt = { x: pointer.x, y: pointer.y };
    const ticks = Math.trunc(this.travel / SWIPE_PER_TICK);
    if (ticks === 0) return;
    // What was counted is taken off, so the rest carries into the next move
    // rather than being thrown away a pixel at a time.
    this.travel -= ticks * SWIPE_PER_TICK;
    this.apply(turnBy(this.state, ticks));
  }

  private buildKeypad(): void {
    const press = (label: string) => () => {
      if (!this.state) return;
      if (label === "OK") this.apply(submitClock(this.state));
      else if (label === "<") this.apply(backspaceClock(this.state));
      else this.apply(typeClockDigit(this.state, Number(label)));
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

  layout(): void {
    if (!this.state) return;
    this.render();
  }

  private render(): void {
    const state = this.state;
    if (!state) return;
    const asked = askedOf(state);
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

    const shown = state.done ? asked.hours : hourglassHint(state);
    for (const [side, at] of [state.from, state.to].entries()) {
      const faceX = centres[side] as number;
      this.drawFace(faceX, faceY, radius, at, state.rung.numerals, side);
      this.captions[side]
        ?.setText(side === 0 ? this.words.hourglassNow : this.words.hourglassTo)
        .setPosition(faceX, contentTop)
        .setVisible(true);
    }
    // The right-hand face is the one she takes hold of, so its hit area
    // follows it. Invisible: the picture under it is the control.
    // Everything above the answer boxes is swipeable.
    this.swipeArea = {
      left: left,
      top: contentTop - LABEL_SIZE,
      right: left + innerW,
      bottom: faceY + radius + 12,
    };
    // The sweep, over the left-hand face: how far round the hand has been
    // walked so far. Drawn only when the child has asked for it by getting
    // one wrong, and never all the way — the last step is the answer.
    if (shown > 0) {
      this.drawSweep(centres[0] as number, faceY, radius, state.from, shown, state.done);
    }

    // --- the answer ---------------------------------------------------------

    const boxY = faceY + radius + 16 + BOX_H / 2;
    const twoBoxes = asksMinutes(state);
    // One box for the hours, and a second for the minutes where the face can
    // show any. At the bottom rung the hands only ever point at an hour, so
    // asking for minutes would be asking a five-year-old to type nought.
    const boxes: { box: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }[] = [
      { box: this.box, text: this.boxText },
      { box: this.minuteBox, text: this.minuteText },
    ];
    const unit = [this.words.hourglassHours, this.words.hourglassMinutes];
    const spread = twoBoxes ? BOX_W + 46 : 0;
    for (const [which, pair] of boxes.entries()) {
      const showing = which === 0 || twoBoxes;
      pair.box.setVisible(showing);
      pair.text.setVisible(showing);
      this.units[which]?.setVisible(showing);
      if (!showing) continue;
      const bx = twoBoxes ? cx - spread / 2 + which * spread : cx;
      pair.box.setPosition(bx, boxY);
      pair.text.setPosition(bx, boxY);
      this.units[which]
        ?.setText(unit[which] as string)
        .setPosition(bx + BOX_W / 2 + 6, boxY)
        .setVisible(true);
      const typed = which === 0 ? state.hours : state.minutes;
      const here = state.box === (which === 0 ? "hours" : "minutes");
      if (state.done) {
        pair.box.setStrokeStyle(3, DONE_HEX);
        pair.text.setText(typed === "" ? "0" : typed).setColor(DONE_INK);
      } else {
        pair.box.setStrokeStyle(3, state.wrong ? WRONG_HEX : here ? ACTIVE_HEX : INK_HEX);
        pair.text.setText(typed === "" ? (here ? "_" : "") : typed).setColor(INK);
      }
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
    if (state.done) return this.words.hourglassSolved(askedOf(state).hours);
    // Nothing to answer until she has moved the hands, so say so rather than
    // leaving a parchment that looks like it is waiting for a number.
    if (!moved(state)) return this.words.hourglassTurnIt;
    const shown = hourglassHint(state);
    return shown > 0 ? this.words.hourglassCountOn(shown) : "";
  }

  destroy(): void {
    this.close();
    this.paper.destroy();
    for (const part of this.parts) part.destroy();
  }
}
