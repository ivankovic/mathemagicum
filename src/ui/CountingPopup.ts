// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import type { Phrases } from "../i18n/phrases";
import type { NumberLine } from "../spells/addition";
import type { CastResult } from "../spells/cast";
import { castResult } from "../spells/cast";
import { type CountingRound, boxIsRight, countingRound, trayFor } from "../spells/counting";
import type { Rng } from "../world/rng";
import { type CloseChip, Panel } from "./Panel";
import { PANEL_PAD as PAD } from "./ParchmentPanel";
import type { UiIndex } from "./assets";
import { INK, INK_DIM, PAPER_PALE_HEX, TYPE } from "./parchment";

/**
 * The easiest sum in the game, counted out by hand.
 *
 * Under the number line rather than beside it. The line is already the
 * scaffold under a bare sum — it breaks `3 + 4` into a start and a jump and
 * asks where the jump lands — and this is the scaffold under *that*, for a
 * child who cannot read a line yet: the start is a box with that many things
 * already in it, and the jump is things going in or coming out, one at a
 * time, moved with a finger.
 *
 * **The box is pre-filled, and which way it is wrong is the question.** Too
 * few and she is adding; too many and she is taking away. Nothing on the
 * parchment says which — no plus, no minus, no words she would have to read
 * — because how full the box is against the number written over it *is* the
 * question, and answering it is the arithmetic. That is the whole design:
 * the sum is a picture of itself.
 *
 * **A tap is a drop.** Copied from the shop counter, and for the reason
 * stated there: a finger that means to drag and only presses is a finger
 * belonging to somebody five years old. Picking a counter up and putting it
 * down without moving it puts it in the box, so the game can be played
 * entirely by tapping and entirely by dragging and a child need never find
 * out which one she is doing.
 *
 * **Nothing is refused and nothing is marked wrong.** She can put in six and
 * take one out again; the box is judged by how many things are in it, never
 * by how they got there. The parchment closes when the count is right, and
 * `clean` — what the difficulty ladder reads — is whether she got there
 * without ever overshooting, which is a thing this can see and a number line
 * cannot.
 */

const PANEL_MAX_W = 470;
const PANEL_MAX_H = 430;
const PANEL_MIN_W = 300;
const PANEL_MIN_H = 320;

const TITLE_SIZE = TYPE.spellTitle;
/** The number she is counting to, which is the biggest thing on the sheet. */
const TARGET_SIZE = 44;
const HINT_SIZE = TYPE.small;

/** How wide a counter is drawn, and the air around one. */
const DOT = 26;
const DOT_GAP = 8;
/** How far a finger may wander and still be a tap rather than a drag. */
const TAP_SLOP = 12;

/** The colours a round may come in. They mean nothing — see `counting.ts`. */
const DOT_HEX: Record<string, number> = {
  blue: 0x4f7fae,
  red: 0xc2544d,
  green: 0x63a95c,
  yellow: 0xd9a441,
  purple: 0x8d6bab,
};

/** The box she is filling, so a script can aim at it. */
export interface CountingBoard {
  readonly box: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly tray: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  /** Where each counter is: those in the box first, then those in the tray. */
  readonly inBox: readonly { readonly x: number; readonly y: number }[];
  readonly inTray: readonly { readonly x: number; readonly y: number }[];
}

/** Where a counter is, and where a dragged one came from. */
type Home = "box" | "tray";

export class CountingPopup extends Panel {
  private readonly ink: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly target: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly closeButton: CloseChip;

  private round: CountingRound | null = null;
  private finish: ((result: CastResult) => void) | null = null;
  /** How many are in the box now, and how many are left in the tray. */
  private held = 0;
  private spare = 0;
  /** Every time the box has held more than it should. See `clean`. */
  private missteps = 0;

  private carried: Phaser.GameObjects.Arc | null = null;
  private carriedFrom: { x: number; y: number; home: Home } | null = null;
  private downHandler: ((pointer: Phaser.Input.Pointer) => void) | null = null;
  private moveHandler: ((pointer: Phaser.Input.Pointer) => void) | null = null;
  private upHandler: ((pointer: Phaser.Input.Pointer) => void) | null = null;
  /**
   * Whether a press was already down when this parchment opened.
   *
   * The same swallow `SymmetryPopup` needs and for the same reason: Phaser
   * gives the tray button its `pointerdown` first and the scene-wide one
   * after, so the very tap that cast the spell arrives here a moment later
   * and would pick up a counter she never reached for.
   */
  private swallow = false;
  private board: CountingBoard = {
    box: { x: 0, y: 0, w: 1, h: 1 },
    tray: { x: 0, y: 0, w: 1, h: 1 },
    inBox: [],
    inTray: [],
  };

  constructor(
    scene: Phaser.Scene,
    index: UiIndex,
    depth: number,
    private words: Phrases,
    register: (object: Phaser.GameObjects.GameObject) => void,
  ) {
    super(scene, index, depth, register, {
      maxWidth: PANEL_MAX_W,
      maxHeight: PANEL_MAX_H,
      minWidth: PANEL_MIN_W,
      minHeight: PANEL_MIN_H,
      lift: 2,
    });
    this.ink = this.own(scene.add.graphics());
    this.title = this.own(this.text("", TITLE_SIZE, INK).setOrigin(0.5, 0));
    this.target = this.own(this.text("", TARGET_SIZE, INK).setOrigin(0.5, 0));
    this.hint = this.own(this.text("", HINT_SIZE, INK_DIM).setOrigin(0.5, 0));
    this.closeButton = this.closeChip(TYPE.body, () => this.dismiss(), "key");
    this.hideAll();
  }

  override get isOpen(): boolean {
    return this.round !== null;
  }

  /** Say everything from here on in another language. */
  setWords(words: Phrases): void {
    this.words = words;
    if (this.isOpen) this.render();
  }

  /**
   * Open on a line the ordinary generator made.
   *
   * The problem is not this panel's to invent — see `counting.ts`. What
   * arrives is the same `NumberLine` the parchment would have drawn, and
   * the only difference is that it is counted instead of walked.
   */
  open(problem: NumberLine, rng: Rng, onDone: (result: CastResult) => void): void {
    const round = countingRound(problem, rng);
    this.round = round;
    this.finish = onDone;
    this.held = round.from;
    this.spare = trayFor(round);
    this.missteps = 0;

    this.paper.setVisible(true);
    for (const part of this.parts) part.setVisible(true);
    this.escapeCloses(() => this.dismiss());

    this.swallow = this.scene.input.activePointer.isDown;
    this.downHandler = (pointer) => this.press(pointer);
    this.moveHandler = (pointer) => this.drag(pointer);
    this.upHandler = (pointer) => this.release(pointer);
    this.scene.input.on("pointerdown", this.downHandler);
    this.scene.input.on("pointermove", this.moveHandler);
    this.scene.input.on("pointerup", this.upHandler);
    this.scene.input.on("pointerupoutside", this.upHandler);

    this.render();
  }

  /** What the box holds and what the round is, for a script. */
  get counter(): {
    readonly target: number;
    readonly held: number;
    readonly tray: number;
    readonly takingAway: boolean;
    readonly colour: string;
  } | null {
    const round = this.round;
    if (!round) return null;
    return {
      target: round.to,
      held: this.held,
      tray: this.spare,
      takingAway: round.takingAway,
      colour: round.colour,
    };
  }

  /**
   * Where the box, the tray and every counter are.
   *
   * Published for the same reason the shop publishes its counter: the thing
   * a finger has to reach is a *region* and a scatter of circles rather than
   * a button with a name, and there is nothing on screen for a scenario to
   * find otherwise.
   */
  get places(): CountingBoard {
    return this.board;
  }

  private press(pointer: Phaser.Input.Pointer): void {
    if (this.swallow || !this.round || this.carried) return;
    const from = this.pick(pointer.x, pointer.y);
    if (!from) return;
    this.carriedFrom = { x: pointer.x, y: pointer.y, home: from };
    // Off the count the moment it is lifted, so the box under her finger
    // shows what it would hold if she let go here.
    if (from === "box") this.held--;
    else this.spare--;
    this.carried = this.scene.add
      .circle(pointer.x, pointer.y, DOT / 2, this.hex())
      .setDepth(this.depth + 6);
    this.own(this.carried);
    this.render();
  }

  private drag(pointer: Phaser.Input.Pointer): void {
    this.carried?.setPosition(pointer.x, pointer.y);
  }

  private release(pointer: Phaser.Input.Pointer): void {
    this.swallow = false;
    const carried = this.carried;
    const from = this.carriedFrom;
    if (!carried || !from) return;
    this.carried = null;
    this.carriedFrom = null;
    carried.destroy();

    // A tap counts as a move to the other side, which is what makes this
    // playable with one finger and no dragging at all.
    const tapped = Math.hypot(pointer.x - from.x, pointer.y - from.y) <= TAP_SLOP;
    const over = this.regionAt(pointer.x, pointer.y);
    const to: Home = tapped ? (from.home === "box" ? "tray" : "box") : (over ?? from.home);
    if (to === "box") this.held++;
    else this.spare++;
    // Counted before the check, so a child who reaches the answer by going
    // past it and coming back has still been past it. Nothing is said about
    // it and nothing is refused — it is only what `clean` is made of.
    if (this.held > (this.round?.to ?? 0)) this.missteps++;
    this.render();
    this.settleIfRight();
  }

  /** Which side a point is on, or nothing if it is neither. */
  private regionAt(x: number, y: number): Home | null {
    const { box, tray } = this.board;
    if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) return "box";
    if (x >= tray.x && x <= tray.x + tray.w && y >= tray.y && y <= tray.y + tray.h) return "tray";
    return null;
  }

  /** Which counter a press landed on, if it landed on one. */
  private pick(x: number, y: number): Home | null {
    const near = (at: { x: number; y: number }) => Math.hypot(x - at.x, y - at.y) <= DOT;
    if (this.board.inBox.some(near)) return "box";
    if (this.board.inTray.some(near)) return "tray";
    // A press on the empty half of the tray is not a counter; a press on the
    // box with nothing to take is not one either.
    return null;
  }

  private settleIfRight(): void {
    const round = this.round;
    if (!round || !boxIsRight(round, this.held)) return;
    const done = this.finish;
    this.close();
    done?.(castResult({ missteps: this.missteps }, true));
  }

  /** Shut without an answer: the cast does not happen. */
  private dismiss(): void {
    const done = this.finish;
    this.close();
    done?.(castResult(null, false));
  }

  override close(): void {
    this.round = null;
    this.finish = null;
    this.carried?.destroy();
    this.carried = null;
    this.carriedFrom = null;
    if (this.downHandler) this.scene.input.off("pointerdown", this.downHandler);
    if (this.moveHandler) this.scene.input.off("pointermove", this.moveHandler);
    if (this.upHandler) {
      this.scene.input.off("pointerup", this.upHandler);
      this.scene.input.off("pointerupoutside", this.upHandler);
    }
    this.downHandler = null;
    this.moveHandler = null;
    this.upHandler = null;
    super.close();
  }

  private hex(): number {
    return DOT_HEX[this.round?.colour ?? "blue"] ?? DOT_HEX.blue ?? 0x4f7fae;
  }

  private hideAll(): void {
    this.paper.setVisible(false);
    for (const part of this.parts) part.setVisible(false);
  }

  protected override render(): void {
    const round = this.round;
    if (!round) return;
    const { width, height } = this.scene.scale;
    const rect = this.paper.layout(width, height);
    this.ink.clear();

    let y = rect.top + PAD;
    this.title.setText(this.words.countingTitle).setPosition(rect.centreX, y);
    y += TITLE_SIZE + 6;
    // The number, big. It is the only thing on the sheet she has to read,
    // and she is five.
    this.target.setText(String(round.to)).setPosition(rect.centreX, y);
    y += TARGET_SIZE + 10;

    // Two halves: the box she is filling, and the tray beside it.
    const halfW = (rect.width - PAD * 3) / 2;
    const boxH = rect.height - (y - rect.top) - PAD * 2 - HINT_SIZE - 8;
    const box = { x: rect.left + PAD, y, w: halfW, h: boxH };
    const tray = { x: rect.left + PAD * 2 + halfW, y, w: halfW, h: boxH };
    this.ink.fillStyle(PAPER_PALE_HEX, 1).lineStyle(2, 0x000000, 0.18);
    for (const at of [box, tray]) {
      this.ink.fillRoundedRect(at.x, at.y, at.w, at.h, 8);
      this.ink.strokeRoundedRect(at.x, at.y, at.w, at.h, 8);
    }

    const inBox = this.lay(box, this.held);
    const inTray = this.lay(tray, this.spare);
    this.ink.fillStyle(this.hex(), 1);
    for (const at of [...inBox, ...inTray]) this.ink.fillCircle(at.x, at.y, DOT / 2);
    this.board = { box, tray, inBox, inTray };

    this.hint
      .setText(round.takingAway ? this.words.countingTakeOut : this.words.countingPutIn)
      .setPosition(rect.centreX, box.y + boxH + 8);
    this.closeButton.place(rect);
  }

  /**
   * Where a given number of counters sit inside a box.
   *
   * Wrapped in rows that fill from the top left, which is how a child would
   * lay them out and how she will count them back. Not a ring, not a dice
   * face: a pattern that says *six* without counting is a pattern doing the
   * work the round is asking her to do.
   */
  private lay(
    at: { x: number; y: number; w: number; h: number },
    many: number,
  ): { x: number; y: number }[] {
    const step = DOT + DOT_GAP;
    const perRow = Math.max(1, Math.floor((at.w - DOT_GAP) / step));
    const rows = Math.max(1, Math.ceil(many / perRow));
    // Centred in the box rather than stacked in its corner. A box is drawn
    // big enough for the most a round could want, so a round wanting three
    // left them in a heap at the top of a mostly empty rectangle — which
    // reads as a thing half loaded rather than as a thing holding three.
    const top = at.y + Math.max(DOT_GAP, (at.h - rows * step + DOT_GAP) / 2);
    const out: { x: number; y: number }[] = [];
    for (let i = 0; i < many; i++) {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const wide = Math.min(many - row * perRow, perRow);
      const left = at.x + (at.w - wide * step + DOT_GAP) / 2;
      out.push({ x: left + step * col + DOT / 2, y: top + step * row + DOT / 2 });
    }
    return out;
  }
}
