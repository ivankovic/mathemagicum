// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import type { Phrases } from "../i18n/phrases";
import { type CastResult, castResult } from "../spells/cast";
import {
  type Axis,
  type Point,
  type SymmetryCast,
  type SymmetryRung,
  beginSymmetryCast,
  dragLine,
  middleOf,
  reachOf,
  releaseLine,
  startLine,
  symmetryHint,
} from "../spells/symmetry";
import type { Rng } from "../world/rng";
import { PANEL_PAD as PAD, ParchmentPanel } from "./ParchmentPanel";
import type { UiIndex } from "./assets";

/**
 * The parchment a shape is folded on.
 *
 * The fourth spell parchment and the first with no keypad on it. Every other
 * spell here ends in a number typed into a box; this one ends in a *line*,
 * and there is nothing to type because the answer is not a quantity. A child
 * who has found the fold has found it by looking at the shape, and the only
 * honest way to say so is to draw it.
 *
 * **One space, not two.** `symmetry.ts` works in a unit square about the
 * origin and states every tolerance as a share of the shape's own size, so
 * it is perfectly happy to be handed a shape in one scale and a line in
 * another — and gives nonsense when it is. Everything crossing this boundary
 * goes through `toScreen` and `toShape`, for drawing *and* for the pointer,
 * so the rules only ever see the space they were written in.
 *
 * **The line is drawn where she drew it.** Not snapped to the nearest axis
 * while her finger is down: a line that jumped onto the answer as it got
 * close would be answering for her, and the tolerance in `foldsAlong` is
 * what forgives an unsteady hand — silently, while she is drawing. Only
 * once it *has* folded does the parchment draw the true fold in its place,
 * which is not a correction but the thing she found, said exactly.
 */

const PANEL_MAX_W = 460;
const PANEL_MAX_H = 460;
const PANEL_MIN_W = 280;
const PANEL_MIN_H = 320;

const INK = "#4a3422";
const INK_DIM = "#8a6a48";
const WRONG_INK = "#a8321e";
const DONE_INK = "#3d6b2a";

const INK_HEX = 0x4a3422;
const PAPER_HEX = 0xdec694;
const WRONG_HEX = 0xa8321e;
const DONE_HEX = 0x3d6b2a;

// The shape: a solid figure rather than an outline, because a fold is about
// the whole of it and an outline invites looking only at the edges.
const SHAPE_HEX = 0x7fa4c8;
const SHAPE_EDGE_HEX = 0x3f5f80;
// The line under her finger, before it is judged.
const DRAWN_HEX = 0x4a3422;

const TITLE_SIZE = 20;
const ASK_SIZE = 12;
const HINT_SIZE = 12;

/**
 * How much of the drawing square the shape fills.
 *
 * Short of the edge on purpose: a fold has to be drawn *through* the shape
 * and off both ends of it, and a shape drawn to the edge of its box would
 * leave nowhere to start the line but on top of itself.
 */
const SHAPE_FILL = 0.72;

/** How long the finished fold and the hint run, as a share of the shape. */
const AXIS_OVERHANG = 1.35;

/**
 * How long the folded shape is left on the parchment.
 *
 * Longer than the wall's beat, because there is more to look at: the answer
 * to this spell is a *picture* of the shape with its fold drawn on it, and a
 * child who found it deserves a moment with the thing they found rather than
 * a parchment that vanishes the instant they let go.
 */
const FOLDED_BEAT_MS = 1100;

type PanelPart = Phaser.GameObjects.GameObject &
  Phaser.GameObjects.Components.Depth &
  Phaser.GameObjects.Components.ScrollFactor &
  Phaser.GameObjects.Components.Visible;

/** Where the shape is on the screen, so a script can aim at it. */
export interface Board {
  readonly centreX: number;
  readonly centreY: number;
  /** One unit of shape space, in screen pixels. */
  readonly reach: number;
  /** The shape's corners, in screen pixels and in order round the outline. */
  readonly corners: readonly Point[];
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
  private moveHandler: ((pointer: Phaser.Input.Pointer) => void) | null = null;
  private upHandler: ((pointer: Phaser.Input.Pointer) => void) | null = null;

  /** Where the drawing square is, worked out afresh on every render. */
  private centre: Point = { x: 0, y: 0 };
  private scale = 1;
  private drawing = false;
  /**
   * Whether a press was already down when this parchment opened.
   *
   * Phaser hands the tray button its `pointerdown` first and *then* emits
   * the scene-wide one, so the very tap that casts the spell arrives at the
   * stroke handler a moment after it registers — and its `pointerup`
   * completed a line of no length, which is not a fold. A child who cast the
   * spell was told they had got it wrong before the shape had finished being
   * drawn, and at every rung whose `hintAfter` is one, was handed the answer
   * with it. So that press is swallowed whole, down and up.
   *
   * Asked of the pointer rather than assumed: a cast that did not come from
   * a tap — a key, or a teacher's line of dialogue — leaves nothing to
   * swallow, and swallowing anyway would eat the child's first real stroke.
   */
  private swallow = false;

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
   * Where the shape sits on the screen.
   *
   * Published for the same reason the clock's face is: a script driving this
   * spell has to drag a line across a *picture*, and there is no button on
   * it to press. Handed the corners in screen pixels, a scenario can work
   * out the fold with the game's own `axesOf` and draw it — which is the
   * same discipline as reading a price off the counter rather than knowing
   * it.
   */
  get board(): Board | null {
    if (!this.state) return null;
    return {
      centreX: this.centre.x,
      centreY: this.centre.y,
      reach: this.scale,
      corners: this.state.shape.corners.map((corner) => this.toScreen(corner)),
    };
  }

  get isOpen(): boolean {
    return this.state !== null;
  }

  /** Put a shape on the parchment. */
  open(rng: Rng, rung: SymmetryRung, onDone: (result: CastResult) => void): void {
    this.state = beginSymmetryCast(rng, rung);
    this.finish = onDone;
    this.drawing = false;
    this.swallow = this.scene.input.activePointer.isDown;
    this.paper.setVisible(true);
    for (const part of this.parts) part.setVisible(true);

    this.keyHandler = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      this.dismiss(false);
    };
    this.scene.input.keyboard?.on("keydown", this.keyHandler);

    // On the scene rather than on a hit area: the line is drawn freehand
    // over a picture, and a zone big enough to catch every stroke would
    // swallow the close button sitting on top of it.
    this.downHandler = (pointer) => this.begin(pointer);
    this.moveHandler = (pointer) => this.extend(pointer);
    this.upHandler = () => this.finishLine();
    this.scene.input.on("pointerdown", this.downHandler);
    this.scene.input.on("pointermove", this.moveHandler);
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
    if (this.moveHandler) this.scene.input.off("pointermove", this.moveHandler);
    if (this.upHandler) {
      this.scene.input.off("pointerup", this.upHandler);
      this.scene.input.off("pointerupoutside", this.upHandler);
    }
    this.downHandler = null;
    this.moveHandler = null;
    this.upHandler = null;
    this.drawing = false;
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

  // --- the gesture ---------------------------------------------------------

  private begin(pointer: Phaser.Input.Pointer): void {
    if (this.swallow) return;
    if (!this.state || this.state.done) return;
    // The close button is a button; a stroke starting on it is a tap on it.
    if (this.overClose(pointer)) return;
    this.drawing = true;
    this.state = startLine(this.state, this.toShape(pointer.x, pointer.y));
    this.render();
  }

  private extend(pointer: Phaser.Input.Pointer): void {
    if (!this.drawing || !this.state) return;
    this.state = dragLine(this.state, this.toShape(pointer.x, pointer.y));
    this.render();
  }

  /**
   * Let go, and see whether it folds.
   *
   * Not called `release`: that is what the rules call the step, and a method
   * of that name here would read as releasing the popup.
   */
  private finishLine(): void {
    if (this.swallow) {
      this.swallow = false;
      return;
    }
    if (!this.drawing || !this.state) return;
    this.drawing = false;
    const next = releaseLine(this.state);
    this.state = next;
    this.render();
    if (!next.done) return;
    // A beat on the folded shape, its two halves shown landing on each
    // other, before the parchment goes.
    this.scene.time.delayedCall(FOLDED_BEAT_MS, () => this.dismiss(true));
  }

  private overClose(pointer: Phaser.Input.Pointer): boolean {
    const half = this.closeRect.width / 2 + 4;
    return (
      Math.abs(pointer.x - this.closeRect.x) <= half &&
      Math.abs(pointer.y - this.closeRect.y) <= half
    );
  }

  // --- the one boundary between the two spaces -----------------------------

  private toScreen(point: Point): Point {
    return { x: this.centre.x + point.x * this.scale, y: this.centre.y + point.y * this.scale };
  }

  private toShape(x: number, y: number): Point {
    return { x: (x - this.centre.x) / this.scale, y: (y - this.centre.y) / this.scale };
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

    // The drawing square: whatever is left between the caption and the line
    // under it, squared off so a shape is never drawn oval.
    const boardTop = this.ask.y + this.ask.height + 10;
    const boardBottom = hintTop - 10;
    const side = Math.max(40, Math.min(innerW, boardBottom - boardTop));
    this.centre = { x: cx, y: Math.round((boardTop + boardBottom) / 2) };
    // `makeShape` builds within one unit of the origin, but a lopsided shape
    // is not centred on that origin — so the scale is taken from the shape's
    // own reach about its own middle, and the drawing is nudged so that
    // middle lands in the middle of the square. Without this a shape with a
    // long spike sits off to one side of its box.
    const middle = middleOf(state.shape);
    this.scale = ((side / 2) * SHAPE_FILL) / reachOf(state.shape);
    this.centre = {
      x: this.centre.x - middle.x * this.scale,
      y: this.centre.y - middle.y * this.scale,
    };

    this.ink.clear();
    this.paintShape(state);
    this.paintFold(state);
    this.paintDrawn(state);
  }

  private paintShape(state: SymmetryCast): void {
    const corners = state.shape.corners.map((corner) => this.toScreen(corner));
    const first = corners[0];
    if (!first) return;
    this.ink.fillStyle(SHAPE_HEX, 1);
    this.ink.lineStyle(3, SHAPE_EDGE_HEX, 1);
    this.ink.beginPath();
    this.ink.moveTo(first.x, first.y);
    for (const corner of corners.slice(1)) this.ink.lineTo(corner.x, corner.y);
    this.ink.closePath();
    this.ink.fillPath();
    this.ink.strokePath();
  }

  /** The fold, once it is found or once the parchment gives it away. */
  private paintFold(state: SymmetryCast): void {
    const axis = symmetryHint(state);
    if (!axis) return;
    const [from, to] = this.axisEnds(state, axis);
    if (state.done) {
      this.ink.lineStyle(4, DONE_HEX, 1);
      this.ink.lineBetween(from.x, from.y, to.x, to.y);
      return;
    }
    // The hint is dashed, so a line the parchment drew never looks like one
    // she drew. A child who has been shown the fold still has to draw it.
    this.dash(from, to, DONE_HEX);
  }

  /** The line under her finger, while it is being drawn. */
  private paintDrawn(state: SymmetryCast): void {
    if (state.done || !state.from || !state.to) return;
    const from = this.toScreen(state.from);
    const to = this.toScreen(state.to);
    this.ink.lineStyle(3, DRAWN_HEX, 0.85);
    this.ink.lineBetween(from.x, from.y, to.x, to.y);
  }

  /** Where a fold enters and leaves the drawing square. */
  private axisEnds(state: SymmetryCast, axis: Axis): [Point, Point] {
    const middle = this.toScreen(middleOf(state.shape));
    // The same convention as `reflect`: the angle is measured from straight
    // up and turns clockwise, and screen y grows downwards.
    const dx = Math.sin(axis.angle);
    const dy = -Math.cos(axis.angle);
    const run = this.scale * reachOf(state.shape) * AXIS_OVERHANG;
    return [
      { x: middle.x - dx * run, y: middle.y - dy * run },
      { x: middle.x + dx * run, y: middle.y + dy * run },
    ];
  }

  private dash(from: Point, to: Point, colour: number): void {
    const span = Math.hypot(to.x - from.x, to.y - from.y);
    if (span < 1) return;
    const step = 10;
    this.ink.lineStyle(3, colour, 1);
    for (let at = 0; at < span; at += step * 2) {
      const a = at / span;
      const b = Math.min(1, (at + step) / span);
      this.ink.lineBetween(
        from.x + (to.x - from.x) * a,
        from.y + (to.y - from.y) * a,
        from.x + (to.x - from.x) * b,
        from.y + (to.y - from.y) * b,
      );
    }
  }

  /**
   * The line under the shape.
   *
   * Silent until something has happened. The caption above already says what
   * to do, and a running commentary under a shape nobody has touched yet
   * would be the parchment talking to itself.
   */
  private hintLine(state: SymmetryCast): string {
    if (state.done) return this.words.mirrorDone;
    if (symmetryHint(state)) return this.words.mirrorHint;
    return state.wrong ? this.words.mirrorWrong : "";
  }

  /**
   * What colour the line under the shape is written in.
   *
   * Red only while it is saying "not that one". Once the parchment has given
   * the fold away the line is help rather than a verdict, and help in the
   * wrong-answer colour reads as a second telling-off.
   */
  private hintColour(state: SymmetryCast): string {
    if (state.done || symmetryHint(state)) return DONE_INK;
    return state.wrong ? WRONG_INK : INK_DIM;
  }

  private label(text: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.scene.add.text(0, 0, text, {
      fontFamily: "monospace",
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
