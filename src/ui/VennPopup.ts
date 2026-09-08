// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import type { Phrases } from "../i18n/phrases";
import {
  Region,
  type VennRound,
  type VennRung,
  regionOf,
  vennRound,
  vennRungAt,
} from "../minigames/venn";
import type { CastResult } from "../spells/cast";
import { castResult } from "../spells/cast";
import type { Hue, Shape, Token } from "../spells/logic";
import type { Rng } from "../world/rng";
import { type CloseChip, Panel } from "./Panel";
import { PANEL_PAD as PAD } from "./ParchmentPanel";
import type { UiIndex } from "./assets";
import { INK, INK_DIM, PAPER_PALE_HEX, TYPE } from "./parchment";

/**
 * The funnel's parchment: two rings on the ground, and what goes where.
 *
 * **The diagram does its own hit-testing.** A region here is not a rectangle
 * standing in for a ring — it is the ring, and where a thing lands is worked
 * out from how far it fell from each centre. That is worth saying because
 * the obvious build draws circles and then tests boxes, and the one place
 * the two disagree is the lens, which is the only part of the diagram a
 * child is actually here to learn.
 *
 * **A wrong drop bounces back.** It goes home to the tray and is counted
 * against `clean`, and nothing else happens: no cross, no sound, no sheet
 * refusing to go on. A thing that will not stay where it was put is a child
 * being told *not there* by the diagram rather than by the game, and she can
 * try it in the lens next without anybody having explained the lens.
 *
 * **Every thing on the tray has to be placed.** The round is over when the
 * tray is empty, not when she has done enough to prove the point — because
 * the last one left is very often the one that was hard, and a parchment
 * that closes early is a parchment that lets her skip exactly the case she
 * has not understood.
 */

const PANEL_MAX_W = 520;
const PANEL_MAX_H = 520;
const PANEL_MIN_W = 320;
const PANEL_MIN_H = 400;

const TITLE_SIZE = TYPE.spellTitle;
const HINT_SIZE = TYPE.small;

/** How big a thing is drawn, and the air around one. */
const TOKEN = 26;
const TOKEN_GAP = 10;
/** How far a finger may wander and still be a tap rather than a drag. */
const TAP_SLOP = 12;

/** The three colours, as the tray already draws them. */
const HUE_HEX: Record<string, number> = {
  red: 0xc2544d,
  blue: 0x4f7fae,
  yellow: 0xd9a441,
};

/** Where the rings and the things are, so a script can aim at them. */
export interface VennBoard {
  readonly rings: readonly { readonly x: number; readonly y: number; readonly r: number }[];
  readonly tray: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  /** Where each unplaced thing is sitting, in tray order. */
  readonly waiting: readonly { readonly x: number; readonly y: number }[];
  /** Where each placed thing came to rest. */
  readonly placed: readonly { readonly x: number; readonly y: number }[];
  /**
   * A point inside each region a thing can be dropped in.
   *
   * The parchment saying where its own regions are, because it is the only
   * thing that knows: the lens is where two circles cross and nothing
   * outside this file can work that out from a bounding box. What it does
   * *not* say is which region a given thing belongs in — that is the
   * question, and a seam that answered it would leave a scenario proving
   * only that dragging works.
   */
  readonly spots: Readonly<Record<Region, { readonly x: number; readonly y: number }>>;
}

export class VennPopup extends Panel {
  private readonly ink: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly closeButton: CloseChip;

  private round: VennRound | null = null;
  private finish: ((result: CastResult) => void) | null = null;
  /** The ones still on the tray, in the order they are drawn. */
  private waiting: Token[] = [];
  /** The ones she has put down, and where. */
  private placed: { token: Token; at: { x: number; y: number } }[] = [];
  /** Every drop that went in the wrong region. See `clean`. */
  private missteps = 0;

  private carried: Token | null = null;
  private mark: Phaser.GameObjects.Graphics | null = null;
  private from: { x: number; y: number } | null = null;
  private downHandler: ((pointer: Phaser.Input.Pointer) => void) | null = null;
  private moveHandler: ((pointer: Phaser.Input.Pointer) => void) | null = null;
  private upHandler: ((pointer: Phaser.Input.Pointer) => void) | null = null;
  /** The swallow every dragging parchment needs. See `CountingPopup`. */
  private swallow = false;
  private board: VennBoard = {
    rings: [],
    tray: { x: 0, y: 0, w: 1, h: 1 },
    waiting: [],
    placed: [],
    spots: {
      left: { x: 0, y: 0 },
      both: { x: 0, y: 0 },
      right: { x: 0, y: 0 },
      outside: { x: 0, y: 0 },
    },
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
    this.hint = this.own(this.text("", HINT_SIZE, INK_DIM).setOrigin(0.5, 0));
    this.closeButton = this.closeChip(TYPE.body, () => this.dismiss(), "key");
    this.hideAll();
  }

  override get isOpen(): boolean {
    return this.round !== null;
  }

  setWords(words: Phrases): void {
    this.words = words;
    if (this.isOpen) this.render();
  }

  /** Open at a rung, on a round the generator drew. */
  open(rung: number, rng: Rng, onDone: (result: CastResult) => void): void {
    const at: VennRung = vennRungAt(rung);
    const round = vennRound(rng, at);
    this.round = round;
    this.finish = onDone;
    this.waiting = [...round.tokens];
    this.placed = [];
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

  /** What the round is and how far she has got, for a script. */
  get diagram(): {
    readonly rings: number;
    readonly waiting: number;
    readonly placed: number;
    readonly missteps: number;
    readonly left: VennRound["left"];
    readonly right: VennRound["right"];
    readonly onTray: readonly Token[];
  } | null {
    const round = this.round;
    if (!round) return null;
    return {
      rings: round.right === null ? 1 : 2,
      waiting: this.waiting.length,
      placed: this.placed.length,
      missteps: this.missteps,
      // The rings' own rules and what is still on the tray, so a scenario
      // can work out where each thing goes the way a child does — rather
      // than being handed the answer, which would test nothing.
      left: round.left,
      right: round.right,
      onTray: this.waiting.map((one) => ({ ...one })),
    };
  }

  /** Where the rings and things are drawn. See `CountingPopup.places`. */
  get places(): VennBoard {
    return this.board;
  }

  private press(pointer: Phaser.Input.Pointer): void {
    if (this.swallow || !this.round || this.carried) return;
    const at = this.board.waiting.findIndex(
      (spot) => Math.hypot(pointer.x - spot.x, pointer.y - spot.y) <= TOKEN,
    );
    const token = this.waiting[at];
    if (at < 0 || !token) return;
    this.carried = token;
    this.waiting.splice(at, 1);
    this.from = { x: pointer.x, y: pointer.y };
    this.mark = this.own(this.scene.add.graphics().setDepth(this.depth + 6));
    this.drawToken(this.mark, token, pointer.x, pointer.y);
    this.render();
  }

  private drag(pointer: Phaser.Input.Pointer): void {
    const mark = this.mark;
    const token = this.carried;
    if (!mark || !token) return;
    mark.clear();
    this.drawToken(mark, token, pointer.x, pointer.y);
  }

  private release(pointer: Phaser.Input.Pointer): void {
    this.swallow = false;
    const token = this.carried;
    const from = this.from;
    const round = this.round;
    if (!token || !from || !round) return;
    this.carried = null;
    this.from = null;
    this.mark?.destroy();
    this.mark = null;

    // A tap without a drag is not a drop anywhere: it puts the thing back
    // where it was. Unlike the counting box there is nowhere obvious for a
    // tap to *mean*, because there are four places rather than two.
    const tapped = Math.hypot(pointer.x - from.x, pointer.y - from.y) <= TAP_SLOP;
    const where = tapped ? null : this.regionAt(pointer.x, pointer.y);
    if (where !== null && where === regionOf(round, token)) {
      this.placed.push({ token, at: { x: pointer.x, y: pointer.y } });
      this.render();
      this.settleIfDone();
      return;
    }
    // Home again. A drop outside the sheet, a drop in the wrong ring and a
    // tap all land here, and only the ones that were actually *wrong* are
    // counted: putting a thing down where it started is not a mistake.
    if (where !== null) this.missteps++;
    this.waiting.push(token);
    this.render();
  }

  /**
   * Which region a point is in, or nothing if it is off the diagram.
   *
   * The rings' own geometry, for the reason in this file's opening: the
   * lens is where the two circles genuinely cross, and a child who drops a
   * thing there has aimed at something she can see.
   */
  private regionAt(x: number, y: number): Region | null {
    const [left, right] = this.board.rings;
    if (!left) return null;
    const inLeft = Math.hypot(x - left.x, y - left.y) <= left.r;
    const inRight = right !== undefined && Math.hypot(x - right.x, y - right.y) <= right.r;
    if (inLeft && inRight) return Region.Both;
    if (inLeft) return Region.Left;
    if (inRight) return Region.Right;
    // Outside the rings but still on the paper: that is the fourth region,
    // and it is a real answer. Off the paper altogether is not.
    const rect = this.board.tray;
    const onPaper = y < rect.y;
    return onPaper ? Region.Outside : null;
  }

  private settleIfDone(): void {
    if (this.waiting.length > 0) return;
    const done = this.finish;
    this.close();
    done?.(castResult({ missteps: this.missteps }, true));
  }

  private dismiss(): void {
    const done = this.finish;
    this.close();
    done?.(castResult(null, false));
  }

  override close(): void {
    this.round = null;
    this.finish = null;
    this.waiting = [];
    this.placed = [];
    this.mark?.destroy();
    this.mark = null;
    this.carried = null;
    this.from = null;
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
    this.title.setText(this.words.vennTitle).setPosition(rect.centreX, y);
    y += TITLE_SIZE + 8;

    // The tray along the bottom, and the ground above it.
    const trayH = TOKEN + TOKEN_GAP * 2;
    const tray = {
      x: rect.left + PAD,
      y: rect.top + rect.height - PAD - HINT_SIZE - 8 - trayH,
      w: rect.width - PAD * 2,
      h: trayH,
    };
    const groundH = tray.y - y - TOKEN_GAP;

    // Two rings that cross, or one in the middle. The overlap is a third of
    // a radius, which is enough lens for a finger and little enough that the
    // two rings still read as two.
    const two = round.right !== null;
    const r = Math.min(groundH / 2, two ? rect.width / 3.4 : rect.width / 3);
    const midY = y + groundH / 2;
    const rings = two
      ? [
          { x: rect.centreX - r * 0.62, y: midY, r },
          { x: rect.centreX + r * 0.62, y: midY, r },
        ]
      : [{ x: rect.centreX, y: midY, r }];
    this.ink.fillStyle(PAPER_PALE_HEX, 0.55).lineStyle(2, 0x000000, 0.28);
    for (const ring of rings) {
      this.ink.fillCircle(ring.x, ring.y, ring.r);
      this.ink.strokeCircle(ring.x, ring.y, ring.r);
    }

    // The swatch that says what each ring holds, at the top of it and clear
    // of the lens: a label in the middle of a ring is a label a child has to
    // put a thing on top of.
    const labels = [round.left, round.right];
    for (const [n, ring] of rings.entries()) {
      const rule = labels[n];
      if (rule) this.drawLabel(ring, rule);
    }

    this.ink.fillStyle(PAPER_PALE_HEX, 1).lineStyle(2, 0x000000, 0.18);
    this.ink.fillRoundedRect(tray.x, tray.y, tray.w, tray.h, 8);
    this.ink.strokeRoundedRect(tray.x, tray.y, tray.w, tray.h, 8);

    const waiting = this.lay(tray, this.waiting.length);
    for (const [n, spot] of waiting.entries()) {
      const token = this.waiting[n];
      if (token) this.drawToken(this.ink, token, spot.x, spot.y);
    }
    for (const one of this.placed) this.drawToken(this.ink, one.token, one.at.x, one.at.y);
    const [first, second] = rings;
    const mid = first ?? { x: rect.centreX, y: midY, r: 1 };
    this.board = {
      rings,
      tray,
      waiting,
      placed: this.placed.map((at) => ({ ...at.at })),
      spots: {
        // Well inside each ring and clear of where the other one reaches.
        left: { x: mid.x - (second ? mid.r * 0.5 : 0), y: mid.y },
        right: second ? { x: second.x + second.r * 0.5, y: second.y } : { x: mid.x, y: mid.y },
        // The lens: halfway between the two centres, which is inside both.
        both: second ? { x: (mid.x + second.x) / 2, y: mid.y } : { x: mid.x, y: mid.y },
        // The ground: the paper's own top corner, which no ring reaches.
        outside: { x: rect.left + PAD + TOKEN, y: y + TOKEN },
      },
    };

    this.hint.setText(this.words.vennHint).setPosition(rect.centreX, tray.y + tray.h + 8);
    this.closeButton.place(rect);
  }

  /** A ring's swatch: the colour it holds, or the shape it holds, in outline. */
  private drawLabel(ring: { x: number; y: number; r: number }, rule: VennRound["left"]): void {
    const at = { x: ring.x, y: ring.y - ring.r + TOKEN };
    if (rule.kind === "hue") {
      this.ink.fillStyle(HUE_HEX[rule.hue] ?? 0x555555, 1);
      this.ink.fillRoundedRect(at.x - TOKEN / 2, at.y - TOKEN / 2, TOKEN, TOKEN, 5);
      return;
    }
    if (rule.kind !== "shape") return;
    // A shape ring is drawn in ink rather than in a colour, because a
    // coloured shape on the label would say two things and the ring means
    // only one of them.
    this.ink.fillStyle(0x000000, 0);
    this.ink.lineStyle(3, 0x000000, 0.7);
    this.strokeShape(rule.shape, at.x, at.y);
  }

  /** One thing: its colour, in its shape. */
  private drawToken(ink: Phaser.GameObjects.Graphics, token: Token, x: number, y: number): void {
    ink.fillStyle(HUE_HEX[token.hue] ?? 0x555555, 1);
    this.fillShape(ink, token.shape, x, y);
  }

  private fillShape(ink: Phaser.GameObjects.Graphics, shape: Shape, x: number, y: number): void {
    const half = TOKEN / 2;
    if (shape === "round") ink.fillCircle(x, y, half);
    else if (shape === "square") ink.fillRect(x - half, y - half, TOKEN, TOKEN);
    else ink.fillTriangle(x, y - half, x + half, y + half, x - half, y + half);
  }

  private strokeShape(shape: Shape, x: number, y: number): void {
    const half = TOKEN / 2;
    if (shape === "round") this.ink.strokeCircle(x, y, half);
    else if (shape === "square") this.ink.strokeRect(x - half, y - half, TOKEN, TOKEN);
    else this.ink.strokeTriangle(x, y - half, x + half, y + half, x - half, y + half);
  }

  /** Where the waiting things sit along the tray, in one centred row. */
  private lay(
    at: { x: number; y: number; w: number; h: number },
    many: number,
  ): { x: number; y: number }[] {
    const step = TOKEN + TOKEN_GAP;
    const wide = Math.min(many, Math.max(1, Math.floor((at.w - TOKEN_GAP) / step)));
    const left = at.x + (at.w - wide * step + TOKEN_GAP) / 2;
    return Array.from({ length: many }, (_, n) => ({
      x: left + step * (n % wide) + TOKEN / 2,
      y: at.y + at.h / 2,
    }));
  }
}

/** Kept honest: the hues the parchment can paint are the hues a round can pick. */
export const PAINTABLE_HUES: readonly string[] = Object.keys(HUE_HEX) as readonly Hue[];
