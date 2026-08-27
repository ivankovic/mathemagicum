// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import type { Phrases } from "../i18n/phrases";
import { type CastResult, castResult } from "../spells/cast";
import {
  type ArrayCast,
  type ArrayProblem,
  arrayHint,
  backspaceArray,
  beginArrayCast,
  rowTotals,
  showsDots,
  submitArray,
  totalOf,
  typeArrayDigit,
} from "../spells/multiplication";
import { PANEL_PAD as PAD, ParchmentPanel } from "./ParchmentPanel";
import type { UiIndex } from "./assets";
import {
  ACTIVE_HEX,
  DONE_HEX,
  DONE_INK,
  INK,
  INK_DIM,
  INK_HEX,
  PAPER_HEX,
  PAPER_PALE_HEX,
  WRONG_HEX,
  WRONG_INK,
} from "./parchment";

/**
 * The parchment the multiplication spell is cast on.
 *
 * A sibling of `SpellPopup` rather than a mode of it, and the split is the
 * whole design of the spell. That parchment draws a *number line* — a
 * journey, with a box at every landing — because addition and subtraction
 * are journeys. This one draws a *rectangle*, because multiplication is a
 * shape: rows and columns, seen all at once, with one question under it.
 *
 * Bolting an array onto the number line would have meant nine boxes of skip
 * counting on a phone, which is the addition spell with a picture over it.
 *
 * **The dots are the seedlings.** The patch that gets planted is exactly the
 * rectangle drawn here, in the same orientation, growing east and south from
 * the tile the child is facing — so the picture is a plan of the garden and
 * not an illustration of one.
 *
 * Everything is drawn in real screen pixels and belongs to the UI camera, so
 * `register` is handed each object exactly as the joystick does it.
 */

const PANEL_MAX_W = 460;
const PANEL_MAX_H = 440;
const PANEL_MIN_W = 280;
const PANEL_MIN_H = 310;

// The dots. Green because they are seedlings and that is what gets planted;
// the counted rows go darker rather than a different hue, so "already
// counted" reads as emphasis and not as a second kind of thing.
const SEED_HEX = 0x5f8f3a;
const SEED_COUNTED_HEX = 0x2f5c1c;

const TITLE_SIZE = 20;
const ASK_SIZE = 12;
const LABEL_SIZE = 13;
const BOX_SIZE = 17;
const HINT_SIZE = 12;

const BOX_W = 62;
const BOX_H = 28;
const KEY_GAP = 6;
const KEY_COLS = 5;
const KEY_ROWS = 3;
const KEY_MAX = 44;
const KEY_MIN = 24;

// The biggest array a rung can set is ten by ten, so ten running totals are
// enough. Built once and hidden rather than created per cast: a parchment
// that rebuilt its labels every time would be rebuilding them in the middle
// of the animation that opens it. The dots themselves are drawn into one
// Graphics rather than pooled — a hundred circles is one draw call and no
// objects at all.
const MAX_SIDE = 10;

// How big a dot can get, and the least it may shrink to before the grid
// simply takes less room instead. Below about five pixels a row of ten stops
// reading as countable things; the ceiling is generous because a two-by-two
// drawn at a ten-by-ten's scale is four specks in the middle of a parchment,
// and the small arrays are the ones the youngest children are given.
const DOT_MAX = 22;
const DOT_MIN = 5;
const DOT_GAP = 5;
// Room to the right of the grid for the running totals beside each row.
const TOTALS_GAP = 8;
const TOTALS_W = 34;

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

export class ArrayPopup {
  private readonly parts: PanelPart[] = [];
  private readonly paper: ParchmentPanel;
  private readonly ink: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly ask: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly totals: Phaser.GameObjects.Text[] = [];
  private readonly box: Phaser.GameObjects.Rectangle;
  private readonly boxText: Phaser.GameObjects.Text;
  private readonly keys: PadKey[] = [];
  private readonly closeRect: Phaser.GameObjects.Rectangle;
  private readonly closeText: Phaser.GameObjects.Text;

  private state: ArrayCast | null = null;
  private finish: ((result: CastResult) => void) | null = null;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    index: UiIndex,
    depth: number,
    private words: Phrases,
    private readonly register: (object: Phaser.GameObjects.GameObject) => void,
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
    for (let n = 0; n < MAX_SIDE; n++) {
      this.totals.push(this.own(this.label("", LABEL_SIZE, DONE_INK).setOrigin(0, 0.5)));
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
    for (const text of [this.boxText, ...this.totals]) text.setDepth(depth + 3);
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

  /**
   * The cast in progress, or null.
   *
   * A dev seam rather than an API, exactly as `SpellPopup.cast` is: a script
   * driving the spell has to know what the spell asked, and the alternative
   * was reading the array back off the parchment by counting pixels.
   */
  get cast(): ArrayCast | null {
    return this.state;
  }

  get isOpen(): boolean {
    return this.state !== null;
  }

  /**
   * Put an array on the parchment.
   *
   * `onDone(result)` reports whether it was solved, so the caller can plant
   * the patch, and whether every answer went in first time, which is what
   * the difficulty reads. There is no third outcome: a wrong answer never
   * ends a cast.
   */
  open(problem: ArrayProblem, onDone: (result: CastResult) => void): void {
    this.state = beginArrayCast(problem);
    this.finish = onDone;
    this.paper.setVisible(true);
    for (const part of this.parts) part.setVisible(true);
    this.keyHandler = (event: KeyboardEvent) => this.onKeyDown(event);
    this.scene.input.keyboard?.on("keydown", this.keyHandler);
    this.layout();
  }

  /** Closes without reporting anything — for a scene shutting down. */
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
    // Read before closing: `close` throws the state away, and the state is
    // what says whether the answer went in first time.
    const result = castResult(this.state, solved);
    this.close();
    done?.(result);
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (!this.state) return;
    if (event.key >= "0" && event.key <= "9") {
      this.apply(typeArrayDigit(this.state, Number(event.key)));
    } else if (event.key === "Backspace") this.apply(backspaceArray(this.state));
    else if (event.key === "Enter") this.apply(submitArray(this.state));
    else if (event.key === "Escape") this.dismiss(false);
    else return;
    event.preventDefault();
  }

  private apply(next: ArrayCast): void {
    this.state = next;
    this.render();
    if (next.done) {
      // A beat on the finished parchment, with every row lit and the answer
      // in the box, before the patch appears in the world.
      this.scene.time.delayedCall(650, () => this.dismiss(true));
    }
  }

  private buildKeypad(): void {
    const press = (label: string) => () => {
      if (!this.state) return;
      if (label === "OK") this.apply(submitArray(this.state));
      else if (label === "<") this.apply(backspaceArray(this.state));
      else this.apply(typeArrayDigit(this.state, Number(label)));
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

  /** Re-place everything for the current viewport. Safe to call when shut. */
  layout(): void {
    if (!this.state) return;
    this.render();
  }

  private render(): void {
    const state = this.state;
    if (!state) return;
    const { rows, columns } = state.problem;
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

    // The keypad takes what it needs from the bottom, bounded so the array
    // and its answer box always keep a floor's worth of room above it.
    const gridBlockMin = MAX_SIDE * (DOT_MIN + DOT_GAP) + BOX_H + 20;
    const spare =
      innerH - TITLE_SIZE - ASK_SIZE - 16 - HINT_SIZE - 8 - gridBlockMin - KEY_GAP * (KEY_ROWS - 1);
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

    this.title.setText(this.words.arrayTitle(rows, columns)).setPosition(cx, top + PAD);
    this.ask.setText(this.words.arrayAsk).setPosition(cx, top + PAD + TITLE_SIZE + 4);

    this.hint
      .setText(this.hintLine(state))
      .setColor(state.wrong ? WRONG_INK : INK_DIM)
      .setPosition(cx, keypadTop - HINT_SIZE - 8);

    // --- the array ---------------------------------------------------------

    const contentTop = top + PAD + TITLE_SIZE + ASK_SIZE + 12;
    const contentBottom = keypadTop - HINT_SIZE - 14;
    // One step for both axes: the dots have to be square and evenly spread,
    // or a four-by-ten array would be drawn as a rectangle of the wrong
    // proportions and stop being a plan of the patch it plants.
    const roomW = innerW - TOTALS_GAP - TOTALS_W;
    const roomH = contentBottom - contentTop - BOX_H - 12;
    const step = Math.max(
      DOT_MIN + DOT_GAP,
      Math.min(
        DOT_MAX + DOT_GAP,
        Math.floor(roomW / columns),
        Math.floor(roomH / Math.max(1, rows)),
      ),
    );
    const dot = Math.max(DOT_MIN, step - DOT_GAP);
    const gridW = step * columns;
    const gridH = step * rows;
    // The grid is centred on the panel's own middle rather than on the space
    // left of the totals: the totals hang off its right and the array is
    // what the child is looking at, so it is the array that should sit
    // straight under the title.
    const gridLeft = Math.round(cx - gridW / 2);
    const gridTop = Math.round(contentTop + Math.max(0, (roomH - gridH) / 2));

    // How many rows arrive counted: the rung's scaffolding, plus one more
    // for every wrong answer. Never the last one — that is the answer.
    const counted = state.done ? rows : arrayHint(state);
    const running = rowTotals(state.problem);

    this.ink.clear();
    if (showsDots(state.problem)) {
      for (let row = 0; row < rows; row++) {
        const lit = row < counted || state.done;
        this.ink.fillStyle(lit ? SEED_COUNTED_HEX : SEED_HEX, 1);
        for (let col = 0; col < columns; col++) {
          this.ink.fillCircle(
            gridLeft + col * step + step / 2,
            gridTop + row * step + step / 2,
            dot / 2,
          );
        }
      }
    } else {
      // The top rung draws no dots at all: the patch is an outline with the
      // two numbers written across it, which is the times table asked as a
      // times table. A child who still needs to count has the outline to
      // count *squares* in, and the hint below will start filling rows in
      // for them — the help is withdrawn, not the way out.
      this.ink.lineStyle(1, SEED_HEX, 0.7);
      for (let row = 1; row < rows; row++) {
        const y = gridTop + row * step;
        this.ink.lineBetween(gridLeft, y, gridLeft + gridW, y);
      }
      for (let col = 1; col < columns; col++) {
        const x = gridLeft + col * step;
        this.ink.lineBetween(x, gridTop, x, gridTop + gridH);
      }
      this.ink.fillStyle(SEED_COUNTED_HEX, 1);
      for (let row = 0; row < counted; row++) {
        this.ink.fillRect(gridLeft, gridTop + row * step, gridW, step);
      }
    }
    // A hairline round the whole block, which is what makes it read as one
    // patch of ground rather than as loose dots.
    this.ink.lineStyle(1, INK_HEX, 0.5);
    this.ink.strokeRect(gridLeft - 3, gridTop - 3, gridW + 6, gridH + 6);

    for (const [row, total] of this.totals.entries()) {
      const show = row < rows && row < counted;
      total.setVisible(show);
      if (!show) continue;
      total
        .setText(String(running[row]))
        .setPosition(gridLeft + gridW + TOTALS_GAP, gridTop + row * step + step / 2);
    }

    // --- the answer --------------------------------------------------------

    const boxY = gridTop + gridH + 12 + BOX_H / 2;
    this.box.setPosition(cx, boxY);
    this.boxText.setPosition(cx, boxY);
    if (state.done) {
      this.box.setStrokeStyle(3, DONE_HEX);
      this.boxText.setText(state.entry).setColor(DONE_INK);
    } else {
      // A caret in the empty box, so it is obvious the keypad types here
      // even before a digit goes in.
      this.box.setStrokeStyle(3, state.wrong ? WRONG_HEX : ACTIVE_HEX);
      this.boxText.setText(state.entry === "" ? "_" : state.entry).setColor(INK);
    }
  }

  private hintLine(state: ArrayCast): string {
    const { rows, columns } = state.problem;
    if (state.done) return `${rows} × ${columns} = ${totalOf(state.problem)}`;
    const counted = arrayHint(state);
    if (counted === 0) return "";
    return this.words.arrayHintRows(columns, counted);
  }

  destroy(): void {
    this.close();
    this.paper.destroy();
    for (const part of this.parts) part.destroy();
  }
}
