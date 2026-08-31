// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import type { Phrases } from "../i18n/phrases";
import {
  BRICK_PARENTS,
  BRICK_ROWS,
  type BrickCast,
  type BrickProblem,
  type BrickRung,
  backspaceBrick,
  beginBrickCast,
  brickBeingAsked,
  brickFace,
  brickHintShowing,
  brickWorkingFrom,
  submitBrick,
  typeBrickDigit,
} from "../spells/bricks";
import { type CastResult, castResult } from "../spells/cast";
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
 * The parchment a room is built on.
 *
 * The third of the spell parchments, and a third shape again. The number
 * line draws a *journey* because addition is one; the array draws a
 * *rectangle* because multiplication is a shape; this draws a *wall*,
 * because that is what is being built and because the arithmetic has the
 * same shape as the thing.
 *
 * **The picture is the rule.** Nothing on this parchment says "each brick is
 * the sum of the two below it" in words — a brick physically rests on two
 * bricks, and the numbers do what the bricks do. A child who has understood
 * the picture has understood the rule, in whatever language they read.
 *
 * **One gap at a time, in the order they can be got.** The wall lights the
 * brick it wants and leaves the others blank. That is not a simplification
 * of a free-form puzzle, it is the puzzle: the chain from what is showing to
 * what is wanted is the thing being taught, and a child allowed to tap a gap
 * nothing yet determines would be told "not that one" for a reason that is
 * about bookkeeping rather than about arithmetic. See `bricks.ts`.
 *
 * Drawn in real screen pixels and owned by the UI camera, so `register` gets
 * every object exactly as the other two parchments do it.
 */

const PANEL_MAX_W = 460;
const PANEL_MAX_H = 440;
const PANEL_MIN_W = 280;
const PANEL_MIN_H = 320;

const BRICK_INK = "#3a2415";

// The wall. Two clays rather than one: a brick that is *showing* is a brick
// that was already there, and a brick the child has put in is one they laid.
// The difference has to be visible at a glance or the finished wall says
// nothing about what they did.
const BRICK_HEX = 0xa8663c;
const BRICK_EDGE_HEX = 0x7a4526;
const LAID_HEX = 0xc98c4e;
// A gap: mortar-coloured, so an empty space reads as somewhere a brick goes
// rather than as a hole in the parchment.
const GAP_HEX = 0xe7d3ab;

const TITLE_SIZE = 20;
const ASK_SIZE = 12;
const HINT_SIZE = 12;
const FACE_SIZE = 16;

const BRICK_MAX_W = 96;
const BRICK_MIN_W = 44;
const BRICK_GAP = 6;
// Bricks are wider than they are tall, the way bricks are. Derived from the
// width rather than set on its own so a narrow screen shrinks the wall
// without turning it into a pile of cubes.
const BRICK_ASPECT = 0.46;

const KEY_GAP = 6;
const KEY_COLS = 5;
const KEY_ROWS = 3;
const KEY_MAX = 44;
const KEY_MIN = 24;

/** Three rows, and the bottom one is the widest: what the wall costs in width. */
const WIDEST_ROW = 3;

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

export class BrickPopup {
  private readonly parts: PanelPart[] = [];
  private readonly paper: ParchmentPanel;
  private readonly ink: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly ask: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  /** One label per brick, laid out with the wall. */
  private readonly faces: Phaser.GameObjects.Text[] = [];
  private readonly keys: PadKey[] = [];
  private readonly closeRect: Phaser.GameObjects.Rectangle;
  private readonly closeText: Phaser.GameObjects.Text;

  private state: BrickCast | null = null;
  private rung: BrickRung | null = null;
  private finish: ((result: CastResult) => void) | null = null;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    index: UiIndex,
    depth: number,
    private words: Phrases,
    register: (object: Phaser.GameObjects.GameObject) => void,
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
    this.title = this.own(this.label("", TITLE_SIZE, INK).setOrigin(0.5, 0));
    this.ask = this.own(this.label("", ASK_SIZE, INK_DIM).setOrigin(0.5, 0));
    this.hint = this.own(this.label("", HINT_SIZE, INK_DIM).setOrigin(0.5, 0));
    for (const brick of BRICK_ROWS.flat()) {
      this.faces[brick] = this.own(this.label("", FACE_SIZE, BRICK_INK).setOrigin(0.5));
    }

    this.buildKeypad();

    this.closeRect = this.own(
      scene.add
        .rectangle(0, 0, 26, 26, PAPER_HEX)
        .setStrokeStyle(2, INK_HEX)
        .setInteractive({ useHandCursor: true }),
    );
    this.closeText = this.own(this.label("x", HINT_SIZE, INK).setOrigin(0.5));
    this.closeRect.on("pointerdown", () => this.dismiss(false));

    for (const part of this.parts) {
      part.setDepth(depth).setScrollFactor(0).setVisible(false);
      register(part);
    }
    // The wall is drawn into one Graphics under everything, and the numbers
    // sit on top of it: six rectangles is one draw call and no objects.
    this.ink.setDepth(depth + 1);
    for (const face of this.faces) face.setDepth(depth + 3);
    for (const key of this.keys) {
      key.rect.setDepth(depth + 2);
      key.text.setDepth(depth + 3);
    }
    this.closeRect.setDepth(depth + 2);
    this.closeText.setDepth(depth + 3);
  }

  setPhrases(words: Phrases): void {
    this.words = words;
    if (this.isOpen) this.render();
  }

  /**
   * The cast in progress, or null.
   *
   * A dev seam rather than an API, exactly as the other two parchments have:
   * a script driving this spell has to know which brick was asked for and
   * what the answer is, and the alternative is reading numbers off a canvas.
   */
  get cast(): BrickCast | null {
    return this.state;
  }

  get isOpen(): boolean {
    return this.state !== null;
  }

  /**
   * Put a wall on the parchment.
   *
   * `onDone(result)` says whether it was finished, so the caller can lay the
   * floor, and whether every brick went in first time, which is what the
   * difficulty reads. A wrong answer never ends a cast.
   */
  open(problem: BrickProblem, rung: BrickRung, onDone: (result: CastResult) => void): void {
    this.state = beginBrickCast(problem);
    this.rung = rung;
    this.finish = onDone;
    this.paper.setVisible(true);
    for (const part of this.parts) part.setVisible(true);
    this.keyHandler = (event: KeyboardEvent) => this.onKeyDown(event);
    this.scene.input.keyboard?.on("keydown", this.keyHandler);
    this.render();
  }

  /** Closes without reporting anything — for a scene shutting down. */
  close(): void {
    if (this.keyHandler) {
      this.scene.input.keyboard?.off("keydown", this.keyHandler);
      this.keyHandler = null;
    }
    this.state = null;
    this.rung = null;
    this.finish = null;
    this.paper.setVisible(false);
    this.ink.clear();
    for (const part of this.parts) part.setVisible(false);
  }

  layout(): void {
    if (this.isOpen) this.render();
  }

  destroy(): void {
    this.close();
    this.paper.destroy();
    for (const part of this.parts) part.destroy();
  }

  private dismiss(solved: boolean): void {
    const done = this.finish;
    // Read before closing: `close` throws the state away, and the state is
    // what says whether every brick went in first time.
    const result = castResult(this.state, solved);
    this.close();
    done?.(result);
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (!this.state) return;
    if (event.key >= "0" && event.key <= "9") {
      this.apply(typeBrickDigit(this.state, Number(event.key)));
    } else if (event.key === "Backspace") this.apply(backspaceBrick(this.state));
    else if (event.key === "Enter") this.apply(submitBrick(this.state));
    else if (event.key === "Escape") this.dismiss(false);
    else return;
    event.preventDefault();
  }

  private apply(next: BrickCast): void {
    this.state = next;
    this.render();
    if (next.done) {
      // A beat on the finished wall, every brick laid, before the floor
      // appears under her feet.
      this.scene.time.delayedCall(650, () => this.dismiss(true));
    }
  }

  private buildKeypad(): void {
    const press = (key: string) => () => {
      if (!this.state) return;
      if (key === "OK") this.apply(submitBrick(this.state));
      else if (key === "<") this.apply(backspaceBrick(this.state));
      else this.apply(typeBrickDigit(this.state, Number(key)));
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
      for (const [key, span] of entries) {
        const rect = this.own(
          this.scene.add
            .rectangle(0, 0, 1, 1, PAPER_HEX)
            .setStrokeStyle(2, INK_HEX)
            .setInteractive({ useHandCursor: true }),
        );
        const text = this.own(this.label(key, HINT_SIZE + 2, INK).setOrigin(0.5));
        rect.on("pointerdown", press(key));
        this.keys.push({ rect, text, col, row, span });
        col += span;
      }
    }
  }

  private render(): void {
    const state = this.state;
    const rung = this.rung;
    if (!state || !rung) return;
    const { width, height } = this.scene.scale;
    const rect = this.paper.layout(width, height);
    const { left, top } = rect;
    const cx = rect.centreX;
    const innerW = rect.width - PAD * 2;
    const innerH = rect.height - PAD * 2;

    this.closeRect.setPosition(left + rect.width - PAD - 2, top + PAD + 2);
    this.closeText.setPosition(this.closeRect.x, this.closeRect.y);

    // --- the keypad, off the bottom ----------------------------------------

    const wallBlockMin = 3 * (BRICK_MIN_W * BRICK_ASPECT + BRICK_GAP);
    const spare =
      innerH - TITLE_SIZE - ASK_SIZE - 16 - HINT_SIZE - 8 - wallBlockMin - KEY_GAP * (KEY_ROWS - 1);
    const keySize = Math.max(
      KEY_MIN,
      Math.min(KEY_MAX, Math.floor(spare / KEY_ROWS), Math.floor(innerW / KEY_COLS) - KEY_GAP),
    );
    const keypadH = keySize * KEY_ROWS + KEY_GAP * (KEY_ROWS - 1);
    const keypadW = keySize * KEY_COLS + KEY_GAP * (KEY_COLS - 1);
    const keypadTop = top + rect.height - PAD - keypadH;
    const keypadLeft = cx - keypadW / 2;
    for (const key of this.keys) {
      const w = keySize * key.span + KEY_GAP * (key.span - 1);
      const x = keypadLeft + key.col * (keySize + KEY_GAP) + w / 2;
      const y = keypadTop + key.row * (keySize + KEY_GAP) + keySize / 2;
      key.rect.setSize(w, keySize).setPosition(x, y);
      key.text.setPosition(x, y);
    }

    this.title.setText(this.words.brickTitle).setPosition(cx, top + PAD);
    this.ask.setText(this.words.brickAsk).setPosition(cx, top + PAD + TITLE_SIZE + 4);
    this.hint
      .setText(this.hintLine(state))
      .setColor(state.wrong ? WRONG_INK : INK_DIM)
      .setPosition(cx, keypadTop - HINT_SIZE - 8);

    // --- the wall ----------------------------------------------------------

    const contentTop = top + PAD + TITLE_SIZE + ASK_SIZE + 14;
    const contentBottom = keypadTop - HINT_SIZE - 14;
    const roomH = contentBottom - contentTop;
    const brickW = Math.max(
      BRICK_MIN_W,
      Math.min(
        BRICK_MAX_W,
        Math.floor((innerW - BRICK_GAP * (WIDEST_ROW - 1)) / WIDEST_ROW),
        Math.floor((roomH - BRICK_GAP * 2) / 3 / BRICK_ASPECT),
      ),
    );
    const brickH = Math.round(brickW * BRICK_ASPECT);
    const wallW = brickW * WIDEST_ROW + BRICK_GAP * (WIDEST_ROW - 1);
    const wallH = brickH * 3 + BRICK_GAP * 2;
    const wallLeft = Math.round(cx - wallW / 2);
    const wallTop = Math.round(contentTop + Math.max(0, (roomH - wallH) / 2));

    const asked = brickBeingAsked(state);
    const lit = brickHintShowing(state, rung) ? brickWorkingFrom(state) : [];

    this.ink.clear();
    for (const [row, bricks] of BRICK_ROWS.entries()) {
      // Row 0 is the bottom row of the wall, so it is drawn lowest. A wall
      // indexed from the ground up and drawn from the ground up is one fewer
      // thing to keep the right way round.
      const y = wallTop + (2 - row) * (brickH + BRICK_GAP);
      // Each row is half a brick narrower on each side than the one under
      // it, which is what puts every brick over the join of the two below.
      const rowLeft = wallLeft + (row * (brickW + BRICK_GAP)) / 2;
      for (const [at, brick] of bricks.entries()) {
        const x = rowLeft + at * (brickW + BRICK_GAP);
        this.paintBrick(state, brick, x, y, brickW, brickH, asked, lit);
      }
    }
  }

  /** One brick: its clay, its edge, and whatever is written on its face. */
  private paintBrick(
    state: BrickCast,
    brick: number,
    x: number,
    y: number,
    w: number,
    h: number,
    asked: number | null,
    lit: readonly number[],
  ): void {
    const face = brickFace(state, brick);
    const laid = face !== null && state.problem.hidden.includes(brick);
    const isAsked = brick === asked;

    this.ink.fillStyle(face === null ? GAP_HEX : laid ? LAID_HEX : BRICK_HEX, 1);
    this.ink.fillRect(x, y, w, h);

    // The edge carries the state, because the fill is carrying what kind of
    // brick it is. Gold is the gap being asked for, red one just got wrong,
    // and the hint's two bricks are the only other thing ever outlined.
    if (isAsked) this.ink.lineStyle(3, state.wrong ? WRONG_HEX : ACTIVE_HEX, 1);
    else if (lit.includes(brick)) this.ink.lineStyle(3, DONE_HEX, 1);
    else this.ink.lineStyle(2, face === null ? INK_HEX : BRICK_EDGE_HEX, face === null ? 0.4 : 1);
    this.ink.strokeRect(x, y, w, h);

    const label = this.faces[brick];
    if (!label) return;
    label.setPosition(x + w / 2, y + h / 2);
    if (isAsked) {
      // A caret in the brick being asked for, so it is obvious the keypad
      // types *here* even before a digit goes in.
      label.setText(state.entry === "" ? "_" : state.entry).setColor(INK);
      return;
    }
    label.setText(face === null ? "" : String(face)).setColor(laid ? DONE_INK : BRICK_INK);
  }

  /**
   * The line under the wall.
   *
   * Empty until a child has been wrong as often as their rung allows, and
   * then it names the working rather than the answer: the two bricks it
   * comes from are already lit, and this says what to do with them. Telling
   * them the number would end the question rather than help with it.
   */
  private hintLine(state: BrickCast): string {
    if (state.done) return this.words.brickDone;
    const rung = this.rung;
    const asked = brickBeingAsked(state);
    // The method beats the correction once there is one to give. "Not that
    // one" is already said by the red edge and the cleared entry, and a
    // child who has been wrong often enough to have earned the hint is owed
    // something more useful than being told again.
    if (!rung || asked === null || !brickHintShowing(state, rung)) {
      return state.wrong ? this.words.brickWrong : "";
    }
    // Which way the working goes is the whole of what the hint has to say. A
    // brick with two bricks under it is added up to; anything else is a gap
    // under a brick that is already known, and has to be come back to.
    return BRICK_PARENTS[asked] ? this.words.brickHintAdd : this.words.brickHintTakeAway;
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
}
