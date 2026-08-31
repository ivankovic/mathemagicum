// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import type { Phrases } from "../i18n/phrases";
import { type CastResult, castResult } from "../spells/cast";
import {
  type Cell,
  MirrorAxis,
  type SymmetryCast,
  type SymmetryRung,
  beginSymmetryCast,
  cellKey,
  fillCell,
  symmetryHint,
} from "../spells/symmetry";
import type { Rng } from "../world/rng";
import { PANEL_PAD as PAD, ParchmentPanel } from "./ParchmentPanel";
import type { UiIndex } from "./assets";
import {
  DONE_HEX,
  DONE_INK,
  FACE,
  INK,
  INK_DIM,
  INK_HEX,
  PAPER_HEX,
  WRONG_HEX,
  WRONG_INK,
} from "./parchment";

/**
 * The parchment the mirror spell is worked on.
 *
 * A grid, a line ruled through the middle of it, and some squares already
 * coloured. Tapping a square colours it; the cast finishes when the picture
 * is the same on both sides of the line.
 *
 * **A tap is on a square or it is on another square.** That is the whole
 * reason this is a grid and not the drawing it replaced. Judging a dragged
 * line needs a tolerance, and a tolerance is either tight enough to tell a
 * child with an unsteady finger they are wrong when they are right, or loose
 * enough to accept a line vaguely down the middle. There is nothing here to
 * forgive, so nothing has to be.
 *
 * **The working stays on the page.** A wrong square is refused rather than
 * coloured, so everything showing is either the picture she was given or an
 * answer she got right — and a half-finished grid is a half-finished
 * thought, which is what she should be looking at.
 */

const PANEL_MAX_W = 460;
const PANEL_MAX_H = 470;
const PANEL_MIN_W = 280;
const PANEL_MIN_H = 330;

/** An empty square: paler than the parchment, so the grid reads as a grid. */
const EMPTY_HEX = 0xf2e6c8;
/** The picture she was handed. */
const GIVEN_HEX = 0x4f7fae;
/** And the squares she has put in, told apart from it by colour. */
const FILLED_HEX = 0x63a95c;
/** The line, which is the thing the whole puzzle is about. */
const AXIS_HEX = 0xc8901c;

const TITLE_SIZE = 20;
const ASK_SIZE = 12;
const HINT_SIZE = 12;

/** Air between two squares, so a run of them is countable. */
const CELL_GAP = 2;
/** How long a wrong square stays lit before the grid forgets it. */
const WRONG_MS = 450;
/** A beat on the finished picture before the parchment goes. */
const DONE_BEAT_MS = 900;

type PanelPart = Phaser.GameObjects.GameObject &
  Phaser.GameObjects.Components.Depth &
  Phaser.GameObjects.Components.ScrollFactor &
  Phaser.GameObjects.Components.Visible;

/** Where the grid is on the screen, so a script can aim at a square. */
export interface Board {
  readonly left: number;
  readonly top: number;
  /** One square, including the gap that follows it. */
  readonly step: number;
  readonly cell: number;
  readonly size: number;
}

export class SymmetryPopup {
  private readonly parts: PanelPart[] = [];
  private readonly paper: ParchmentPanel;
  private readonly ink: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly ask: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly closeRect: Phaser.GameObjects.Rectangle;
  private readonly closeText: Phaser.GameObjects.Text;

  private state: SymmetryCast | null = null;
  private finish: ((result: CastResult) => void) | null = null;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;
  private downHandler: ((pointer: Phaser.Input.Pointer) => void) | null = null;
  private upHandler: (() => void) | null = null;
  /**
   * Whether a press was already down when this parchment opened.
   *
   * Phaser hands the tray button its `pointerdown` first and *then* emits
   * the scene-wide one, so the very tap that casts the spell arrives here a
   * moment after this handler registers — and would colour a square she
   * never chose. Asked of the pointer rather than assumed, so a cast that
   * did not come from a tap leaves nothing to swallow.
   *
   * Cleared when that press *lifts*, not by the next one. Clearing it on the
   * next `pointerdown` swallowed the child's own first square every single
   * time: the press that opened the parchment never came back here, so the
   * flag was still up when she reached for the grid.
   */
  private swallow = false;
  private forget: Phaser.Time.TimerEvent | null = null;

  private board: Board = { left: 0, top: 0, step: 1, cell: 1, size: 1 };

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
    this.ink.setDepth(depth + 1);
    this.closeRect.setDepth(depth + 2);
    this.closeText.setDepth(depth + 3);
  }

  setPhrases(words: Phrases): void {
    this.words = words;
    if (this.isOpen) this.render();
  }

  /** The cast in progress, or null. A dev seam, as the other parchments have. */
  get cast(): SymmetryCast | null {
    return this.state;
  }

  /**
   * Where the grid sits on the screen.
   *
   * Published for the same reason the clock's face is: the answer to this
   * spell is a tap on a *picture*, and there is no button on it with a name.
   * Handed the grid's corner and the size of a square, a scenario can reach
   * any square — and *which* squares to tap comes out of the cast, which the
   * game worked out rather than the script guessing.
   */
  get where(): Board | null {
    return this.state ? this.board : null;
  }

  get isOpen(): boolean {
    return this.state !== null;
  }

  /** Put a grid on the parchment. */
  open(rng: Rng, rung: SymmetryRung, onDone: (result: CastResult) => void): void {
    this.state = beginSymmetryCast(rng, rung);
    this.finish = onDone;
    this.paper.setVisible(true);
    for (const part of this.parts) part.setVisible(true);

    this.keyHandler = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      this.dismiss(false);
    };
    this.scene.input.keyboard?.on("keydown", this.keyHandler);

    // One handler on the scene rather than a hit area per square: a grid of
    // forty-nine interactive rectangles is forty-nine objects to build,
    // place and tear down every cast, and the arithmetic that turns a point
    // into a square is three lines.
    this.swallow = this.scene.input.activePointer.isDown;
    this.downHandler = (pointer) => this.press(pointer);
    this.upHandler = () => {
      this.swallow = false;
    };
    this.scene.input.on("pointerdown", this.downHandler);
    this.scene.input.on("pointerup", this.upHandler);
    this.scene.input.on("pointerupoutside", this.upHandler);

    this.render();
  }

  /** Closes without reporting anything — for a scene shutting down. */
  close(): void {
    if (this.keyHandler) {
      this.scene.input.keyboard?.off("keydown", this.keyHandler);
      this.keyHandler = null;
    }
    if (this.downHandler) this.scene.input.off("pointerdown", this.downHandler);
    if (this.upHandler) {
      this.scene.input.off("pointerup", this.upHandler);
      this.scene.input.off("pointerupoutside", this.upHandler);
    }
    this.downHandler = null;
    this.upHandler = null;
    this.forget?.remove();
    this.forget = null;
    this.swallow = false;
    this.state = null;
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
    const result = castResult(this.state, solved);
    this.close();
    done?.(result);
  }

  // --- the tap -------------------------------------------------------------

  private press(pointer: Phaser.Input.Pointer): void {
    // Left alone rather than cleared: the press that opened this is still
    // down, and it is its *lift* that ends the swallowing.
    if (this.swallow) return;
    const state = this.state;
    if (!state || state.done) return;
    // The close button is a button; a press on it is a tap on it.
    if (this.overClose(pointer)) return;
    const cell = this.cellAt(pointer.x, pointer.y);
    if (!cell) return;
    const next = fillCell(state, cell);
    this.state = next;
    this.render();
    if (next.wrong) {
      // Lit for a moment and then forgotten, so the grid goes back to
      // showing only the picture and her own working.
      this.forget?.remove();
      this.forget = this.scene.time.delayedCall(WRONG_MS, () => {
        if (!this.state?.wrong) return;
        this.state = { ...this.state, wrong: null };
        this.render();
      });
      return;
    }
    if (!next.done) return;
    // A beat on the finished picture, both halves matching, before it goes.
    this.scene.time.delayedCall(DONE_BEAT_MS, () => this.dismiss(true));
  }

  private overClose(pointer: Phaser.Input.Pointer): boolean {
    const half = this.closeRect.width / 2 + 4;
    return (
      Math.abs(pointer.x - this.closeRect.x) <= half &&
      Math.abs(pointer.y - this.closeRect.y) <= half
    );
  }

  /** Which square a point is on, or nothing if it is off the grid. */
  private cellAt(x: number, y: number): Cell | null {
    const { left, top, step, size } = this.board;
    const col = Math.floor((x - left) / step);
    const row = Math.floor((y - top) / step);
    if (col < 0 || row < 0 || col >= size || row >= size) return null;
    return { col, row };
  }

  // --- drawing -------------------------------------------------------------

  private render(): void {
    const state = this.state;
    if (!state) return;
    const { width, height } = this.scene.scale;
    const rect = this.paper.layout(width, height);
    const { left, top } = rect;
    const cx = rect.centreX;
    const innerW = rect.width - PAD * 2;

    this.closeRect.setPosition(left + rect.width - PAD - 2, top + PAD + 2);
    this.closeText.setPosition(this.closeRect.x, this.closeRect.y);

    this.title.setText(this.words.mirrorTitle).setPosition(cx, top + PAD);
    this.ask
      .setText(this.words.mirrorAsk)
      .setWordWrapWidth(innerW)
      .setPosition(cx, top + PAD + TITLE_SIZE + 4);

    const hintTop = top + rect.height - PAD - HINT_SIZE;
    this.hint
      .setText(this.hintLine(state))
      .setColor(this.hintColour(state))
      .setWordWrapWidth(innerW)
      .setPosition(cx, hintTop);

    // The grid takes whatever the caption and the line under it leave, and
    // it is square: an oblong grid would put the corner mirror at an angle
    // the arithmetic does not have.
    const boardTop = this.ask.y + this.ask.height + 12;
    const boardBottom = hintTop - 12;
    const room = Math.max(60, Math.min(innerW, boardBottom - boardTop));
    const step = Math.max(8, Math.floor(room / state.size));
    const span = step * state.size;
    this.board = {
      left: Math.round(cx - span / 2),
      top: Math.round(boardTop + (boardBottom - boardTop - span) / 2),
      step,
      cell: step - CELL_GAP,
      size: state.size,
    };

    this.paintGrid(state, span);
  }

  private paintGrid(state: SymmetryCast, span: number): void {
    const g = this.ink;
    const { left, top, step, cell, size } = this.board;
    g.clear();

    const given = new Set(state.given);
    const filled = new Set(state.filled);
    const shown = symmetryHint(state);

    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const key = cellKey({ col, row });
        const x = left + col * step;
        const y = top + row * step;
        const colour = given.has(key)
          ? GIVEN_HEX
          : filled.has(key)
            ? FILLED_HEX
            : state.wrong === key
              ? WRONG_HEX
              : EMPTY_HEX;
        g.fillStyle(colour, 1);
        g.fillRect(x, y, cell, cell);
        g.lineStyle(1, INK_HEX, 0.35);
        g.strokeRect(x, y, cell, cell);
        // The one square the grid is giving away, outlined rather than
        // coloured: she still puts it in herself.
        if (shown === key) {
          g.lineStyle(3, DONE_HEX, 1);
          g.strokeRect(x + 1, y + 1, cell - 2, cell - 2);
        }
      }
    }

    this.paintAxis(state, span);
  }

  /**
   * The line, drawn over the squares.
   *
   * Over rather than between them, because it is not a gap in the picture —
   * it is the thing the picture has to match across, and it runs *through*
   * squares whenever the grid has an odd number of them.
   */
  private paintAxis(state: SymmetryCast, span: number): void {
    const g = this.ink;
    const { left, top } = this.board;
    const middle = span / 2;
    g.lineStyle(3, AXIS_HEX, 1);
    if (state.axis === MirrorAxis.Down) {
      g.lineBetween(left + middle, top - 6, left + middle, top + span + 6);
      return;
    }
    if (state.axis === MirrorAxis.Across) {
      g.lineBetween(left - 6, top + middle, left + span + 6, top + middle);
      return;
    }
    g.lineBetween(left - 6, top - 6, left + span + 6, top + span + 6);
  }

  /**
   * The line under the grid.
   *
   * Silent until something has happened. The caption above says what to do,
   * and a running commentary under a grid nobody has touched yet would be
   * the parchment talking to itself.
   */
  private hintLine(state: SymmetryCast): string {
    if (state.done) return this.words.mirrorDone;
    if (symmetryHint(state)) return this.words.mirrorHint;
    return state.wrong ? this.words.mirrorWrong : "";
  }

  /**
   * What colour that line is written in.
   *
   * Red only while it is saying "not that one". Once the grid has given a
   * square away the line is help rather than a verdict, and help in the
   * wrong-answer colour reads as a second telling-off.
   */
  private hintColour(state: SymmetryCast): string {
    if (state.done || symmetryHint(state)) return DONE_INK;
    return state.wrong ? WRONG_INK : INK_DIM;
  }

  private label(text: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.scene.add.text(0, 0, text, {
      fontFamily: FACE,
      fontSize: `${size}px`,
      color,
      align: "center",
    });
  }

  private own<T extends PanelPart>(object: T): T {
    this.parts.push(object);
    return object;
  }
}
