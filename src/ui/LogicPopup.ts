// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import type { Phrases } from "../i18n/phrases";
import { type CastResult, castResult } from "../spells/cast";
import {
  Hue,
  type LogicCast,
  type LogicRung,
  type Node,
  type Rule,
  Shape,
  beginLogicCast,
  flipSwitch,
  lit,
  logicHint,
  pickToken,
} from "../spells/logic";
import { FixtureType } from "../world/fixtures";
import type { Rng } from "../world/rng";
import { type CloseChip, Panel } from "./Panel";
import { PANEL_PAD as PAD } from "./ParchmentPanel";
import { type UiIndex, itemIcon, uiTextureKey } from "./assets";
import {
  ACTIVE_HEX,
  DONE_HEX,
  DONE_INK,
  FACE,
  INK,
  INK_DIM,
  INK_HEX,
  PAPER_PALE_HEX,
  TYPE,
  WRONG_HEX,
  WRONG_INK,
} from "./parchment";

/**
 * The logic spell's parchment: a tray and a rule, or switches and a lamp.
 *
 * Two pictures under one title, and neither has a box to type into. On a
 * tray she taps the things the rule lets through; on a circuit she flips
 * switches until the lamp lights. Both are answered by tapping a picture,
 * the way the mirror's grid is, and for the same reason: a five-year-old
 * cannot read "red and round" and does not have to.
 *
 * **The rule is drawn with the machines.** A red swatch, the press's own
 * icon, and a round swatch is *red and round*; the funnel's icon between
 * them is *red or round*; a bar across a swatch is *not* — the mark the
 * game already uses for "none of this" over her head. So the parchment
 * teaches the three gates as pictures before she has built one, and the
 * icons are the crate's, so the machine she builds afterwards is the one
 * she has already met.
 *
 * **The circuit is the same machines on wires.** Switches down the left,
 * the lamp on the right, and between them the press and the funnel as
 * gates, with a bar on a wire for an inverter. A lit wire is gold and a
 * dark one is ink, so what each gate does to what it is given can be
 * watched, which is what a truth table is when it is not a table.
 *
 * One tap handler on the scene rather than a hit area per thing, as the
 * mirror does it: the arithmetic that turns a point into a token or a
 * switch is a few lines, and it is published for the browser suite the way
 * the mirror publishes its grid.
 */

const PANEL_MAX_W = 470;
const PANEL_MAX_H = 470;
const PANEL_MIN_W = 300;
const PANEL_MIN_H = 340;
const TITLE_SIZE = TYPE.spellTitle;
const ASK_SIZE = TYPE.small;
const HINT_SIZE = TYPE.small;
const WRONG_MS = 450;
const DONE_BEAT_MS = 900;

/** The three hues, in the game's own bright pastel range. */
const HUE_HEX: Record<Hue, number> = {
  [Hue.Red]: 0xd9524e,
  [Hue.Blue]: 0x4a78c8,
  [Hue.Yellow]: 0xe8c245,
};
/** How big a thing on the tray is, and a swatch in the rule. */
const TOKEN_R = 22;
const TOKEN_GAP = 18;
const SWATCH = 22;
const RULE_ICON = 30;
const RULE_GAP = 8;
/** A switch's plate and lever, and the lamp. */
const SWITCH_W = 46;
const SWITCH_H = 34;
const LAMP_R = 18;
const GATE_ICON = 36;
/** A wire and its lit glow. */
const WIRE = 3;

/** Where the things on the parchment are, for a script. */
export interface LogicBoard {
  readonly tokens: readonly { id: string; x: number; y: number; r: number }[];
  readonly switches: readonly { index: number; x: number; y: number }[];
  readonly lamp: { x: number; y: number } | null;
}

interface Laid {
  readonly x: number;
  readonly y: number;
  readonly node: Node;
  readonly on: boolean;
  readonly children: readonly Laid[];
}

export class LogicPopup extends Panel {
  private readonly ink: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly ask: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly closeButton: CloseChip;
  /** Machine icons in the rule and on the wires, pooled and pointed at a texture. */
  private readonly icons: Phaser.GameObjects.Image[] = [];

  private state: LogicCast | null = null;
  private finish: ((result: CastResult) => void) | null = null;
  private downHandler: ((pointer: Phaser.Input.Pointer) => void) | null = null;
  private upHandler: (() => void) | null = null;
  private swallow = false;
  private forget: Phaser.Time.TimerEvent | null = null;
  private beat: Phaser.Time.TimerEvent | null = null;
  private board: LogicBoard = { tokens: [], switches: [], lamp: null };

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
      lift: 0,
    });
    this.ink = this.own(scene.add.graphics());
    this.title = this.own(this.label("", TITLE_SIZE, INK).setOrigin(0.5, 0));
    this.ask = this.own(this.label("", ASK_SIZE, INK_DIM).setOrigin(0.5, 0));
    this.hint = this.own(this.label("", HINT_SIZE, INK_DIM).setOrigin(0.5, 0));
    this.closeButton = this.closeChip(HINT_SIZE, () => this.dismiss(false), "key");
    this.ink.setDepth(depth + 1);
    // Three is the most any rule or circuit here draws: two gates and an
    // inverter's bar is drawn in ink, not from a texture.
    for (let i = 0; i < 3; i++) {
      this.icons.push(
        this.raise(this.own(scene.add.image(0, 0, uiTextureKey(itemIcon(FixtureType.Press))))),
      );
    }
  }

  setPhrases(words: Phrases): void {
    this.words = words;
    if (this.isOpen) this.render();
  }

  get cast(): LogicCast | null {
    return this.state;
  }

  /** Where things are, so a script can tap one. */
  get where(): LogicBoard | null {
    return this.state ? this.board : null;
  }

  override get isOpen(): boolean {
    return this.state !== null;
  }

  open(rng: Rng, rung: LogicRung, onDone: (result: CastResult) => void): void {
    this.state = beginLogicCast(rng, rung);
    this.finish = onDone;
    this.paper.setVisible(true);
    for (const part of this.parts) part.setVisible(true);
    this.escapeCloses(() => this.dismiss(false));
    this.swallow = this.scene.input.activePointer.isDown;
    this.downHandler = (pointer) => this.press(pointer);
    this.upHandler = () => {
      this.swallow = false;
    };
    this.scene.input.on("pointerdown", this.downHandler);
    this.scene.input.on("pointerup", this.upHandler);
    this.scene.input.on("pointerupoutside", this.upHandler);
    this.render();
    // A parchment that opened already finished — which the rules never
    // set, but a hand-edited save could — closes itself with a beat.
    if (this.state.done) this.settle();
  }

  override close(): void {
    super.close();
    if (this.downHandler) this.scene.input.off("pointerdown", this.downHandler);
    if (this.upHandler) {
      this.scene.input.off("pointerup", this.upHandler);
      this.scene.input.off("pointerupoutside", this.upHandler);
    }
    this.downHandler = null;
    this.upHandler = null;
    this.forget?.remove();
    this.forget = null;
    this.beat?.remove();
    this.beat = null;
    this.swallow = false;
    this.state = null;
    this.finish = null;
    this.ink.clear();
    for (const icon of this.icons) icon.setVisible(false);
  }

  private dismiss(solved: boolean): void {
    const done = this.finish;
    const result = castResult(this.state, solved);
    this.close();
    done?.(result);
  }

  // --- the tap -------------------------------------------------------------

  private press(pointer: Phaser.Input.Pointer): void {
    if (this.swallow) return;
    const state = this.state;
    if (!state || state.done) return;
    if (this.overClose(pointer)) return;
    const next = state.tray
      ? this.pressTray(state, pointer.x, pointer.y)
      : this.pressCircuit(state, pointer.x, pointer.y);
    if (!next || next === state) return;
    this.state = next;
    this.render();
    if (next.wrong) {
      this.forget?.remove();
      this.forget = this.scene.time.delayedCall(WRONG_MS, () => {
        if (!this.state?.wrong) return;
        this.state = { ...this.state, wrong: null };
        this.render();
      });
      return;
    }
    if (next.done) this.settle();
  }

  /** A beat on the finished picture before it goes. */
  private settle(): void {
    this.beat?.remove();
    this.beat = this.scene.time.delayedCall(DONE_BEAT_MS, () => this.dismiss(true));
  }

  private pressTray(state: LogicCast, x: number, y: number): LogicCast | null {
    const hit = this.board.tokens.find(
      (token) => Math.hypot(token.x - x, token.y - y) <= token.r + 4,
    );
    return hit ? pickToken(state, hit.id) : null;
  }

  private pressCircuit(state: LogicCast, x: number, y: number): LogicCast | null {
    const hit = this.board.switches.find(
      (at) => Math.abs(at.x - x) <= SWITCH_W / 2 + 6 && Math.abs(at.y - y) <= SWITCH_H / 2 + 8,
    );
    return hit ? flipSwitch(state, hit.index) : null;
  }

  private overClose(pointer: Phaser.Input.Pointer): boolean {
    const { box } = this.closeButton;
    const half = box.width / 2 + 4;
    return Math.abs(pointer.x - box.x) <= half && Math.abs(pointer.y - box.y) <= half;
  }

  // --- drawing -------------------------------------------------------------

  protected render(): void {
    const state = this.state;
    if (!state) return;
    const { width, height } = this.scene.scale;
    const rect = this.paper.layout(width, height);
    const { top } = rect;
    const cx = rect.centreX;
    const innerW = rect.width - PAD * 2;
    this.closeButton.place(rect);
    this.title.setText(this.words.logicTitle).setPosition(cx, top + PAD);
    this.ask
      .setText(state.tray ? this.words.logicAskTray : this.words.logicAskCircuit)
      .setWordWrapWidth(innerW)
      .setPosition(cx, top + PAD + TITLE_SIZE + 4);
    const hintTop = top + rect.height - PAD - HINT_SIZE;
    this.hint
      .setText(this.hintLine(state))
      .setColor(this.hintColour(state))
      .setWordWrapWidth(innerW)
      .setPosition(cx, hintTop);
    const artTop = this.ask.y + this.ask.height + 14;
    const artBottom = hintTop - 14;
    this.ink.clear();
    for (const icon of this.icons) icon.setVisible(false);
    if (state.tray) this.paintTray(state, rect.left + PAD, artTop, innerW, artBottom);
    else this.paintCircuit(state, rect.left + PAD, artTop, innerW, artBottom);
  }

  // --- the tray --------------------------------------------------------------

  private paintTray(
    state: LogicCast,
    left: number,
    top: number,
    width: number,
    bottom: number,
  ): void {
    const tray = state.tray;
    if (!tray) return;
    const g = this.ink;
    const cx = left + width / 2;
    // The things go in one row or two balanced ones — never a full row and
    // a stub — and the whole picture, rule and tray, is centred on the
    // paper rather than hung from its top: a parchment that is mostly empty
    // under a row of shapes reads as one that has not finished drawing.
    const cell = TOKEN_R * 2 + TOKEN_GAP;
    const rows = tray.tokens.length > 5 ? 2 : 1;
    const perRow = Math.max(1, Math.ceil(tray.tokens.length / rows));
    const rowStep = cell;
    const blockH = RULE_ICON + 22 + rows * rowStep;
    const blockTop = top + Math.max(0, (bottom - top - blockH) / 2);
    // The rule, along the top of the block, centred. Measured first so it
    // can be.
    const parts = ruleParts(tray.rule);
    const span =
      parts.reduce((sum, part) => sum + partWidth(part), 0) + RULE_GAP * (parts.length - 1);
    let x = cx - span / 2;
    let icon = 0;
    const ruleY = blockTop + RULE_ICON / 2;
    for (const part of parts) {
      const w = partWidth(part);
      const middle = x + w / 2;
      if (part.kind === "gate") {
        const image = this.icons[icon++];
        if (image) {
          image
            .setTexture(uiTextureKey(gateIcon(part.gate)))
            .setDisplaySize(RULE_ICON, RULE_ICON)
            .setPosition(middle, ruleY)
            .setVisible(true);
        }
      } else {
        this.paintSwatch(part, middle, ruleY);
      }
      x += w + RULE_GAP;
    }
    // A rule under the rule: a line, so the tray reads as what the rule is
    // about rather than as more of it.
    g.lineStyle(1, INK_HEX, 0.3);
    g.lineBetween(
      left + 10,
      blockTop + RULE_ICON + 10,
      left + width - 10,
      blockTop + RULE_ICON + 10,
    );

    const gridTop = blockTop + RULE_ICON + 22;
    const shown = logicHint(state);
    const tokens: { id: string; x: number; y: number; r: number }[] = [];
    for (const [i, token] of tray.tokens.entries()) {
      const row = Math.floor(i / perRow);
      const inRow = Math.min(perRow, tray.tokens.length - row * perRow);
      const rowLeft = cx - (inRow * cell) / 2 + cell / 2;
      const tx = rowLeft + (i % perRow) * cell;
      const ty = gridTop + rowStep / 2 + row * rowStep;
      tokens.push({ id: token.id, x: tx, y: ty, r: TOKEN_R });
      const picked = state.picked.includes(token.id);
      const wrong = state.wrong === token.id;
      // The ring first, under the thing: green for picked, red for the
      // beat after a wrong tap, and the hint's thicker green for the one
      // being given away.
      if (picked || wrong || shown === token.id) {
        g.lineStyle(shown === token.id && !picked ? 4 : 3, wrong ? WRONG_HEX : DONE_HEX, 1);
        g.strokeCircle(tx, ty, TOKEN_R + 5);
      }
      this.paintShape(token.shape, token.hue, tx, ty, TOKEN_R);
    }
    this.board = { tokens, switches: [], lamp: null };
  }

  /** One coloured shape, the size asked for. */
  private paintShape(shape: Shape, hue: Hue, x: number, y: number, r: number): void {
    const g = this.ink;
    g.fillStyle(HUE_HEX[hue], 1);
    g.lineStyle(2, INK_HEX, 0.8);
    if (shape === Shape.Round) {
      g.fillCircle(x, y, r);
      g.strokeCircle(x, y, r);
    } else if (shape === Shape.Square) {
      g.fillRect(x - r, y - r, r * 2, r * 2);
      g.strokeRect(x - r, y - r, r * 2, r * 2);
    } else {
      const points = [
        { x, y: y - r - 2 },
        { x: x + r + 2, y: y + r - 2 },
        { x: x - r - 2, y: y + r - 2 },
      ];
      g.fillPoints(points, true);
      g.strokePoints(points, true);
    }
  }

  /** A swatch in the rule: a hue as a blob of colour, a shape in ink, either barred for not. */
  private paintSwatch(part: RulePart, x: number, y: number): void {
    const g = this.ink;
    if (part.kind === "hue") {
      g.fillStyle(HUE_HEX[part.hue], 1);
      g.lineStyle(2, INK_HEX, 0.8);
      g.fillRoundedRect(x - SWATCH / 2, y - SWATCH / 2, SWATCH, SWATCH, 6);
      g.strokeRoundedRect(x - SWATCH / 2, y - SWATCH / 2, SWATCH, SWATCH, 6);
    } else if (part.kind === "shape") {
      // In paper, outlined: the shape without a colour, which is what a
      // rule about shape is.
      this.paintShapeOutline(part.shape, x, y, SWATCH / 2);
    }
    if (part.kind !== "gate" && part.not) {
      // The bar across: the mark that already means "none of this".
      g.lineStyle(4, WRONG_HEX, 1);
      g.lineBetween(x - SWATCH / 2 - 4, y + SWATCH / 2 + 4, x + SWATCH / 2 + 4, y - SWATCH / 2 - 4);
    }
  }

  private paintShapeOutline(shape: Shape, x: number, y: number, r: number): void {
    const g = this.ink;
    g.fillStyle(PAPER_PALE_HEX, 1);
    g.lineStyle(2, INK_HEX, 0.9);
    if (shape === Shape.Round) {
      g.fillCircle(x, y, r);
      g.strokeCircle(x, y, r);
    } else if (shape === Shape.Square) {
      g.fillRect(x - r, y - r, r * 2, r * 2);
      g.strokeRect(x - r, y - r, r * 2, r * 2);
    } else {
      const points = [
        { x, y: y - r - 2 },
        { x: x + r + 2, y: y + r - 2 },
        { x: x - r - 2, y: y + r - 2 },
      ];
      g.fillPoints(points, true);
      g.strokePoints(points, true);
    }
  }

  // --- the circuit -------------------------------------------------------------

  private paintCircuit(
    state: LogicCast,
    left: number,
    top: number,
    width: number,
    bottom: number,
  ): void {
    const circuit = state.circuit;
    if (!circuit) return;
    const g = this.ink;
    const height = bottom - top;
    // Switches down the left, the lamp on the right, and the gates spread
    // between them by depth: a switch is depth nought and the lamp's gate
    // is the deepest.
    const depth = nodeDepth(circuit.lamp);
    const columns = depth + 2;
    const colStep = width / (columns - 1);
    const switchStep = height / (circuit.switches + 1);
    const switchAt = (index: number) => ({
      x: left + SWITCH_W / 2,
      y: top + switchStep * (index + 1),
    });
    const laid = this.lay(circuit.lamp, state.on, switchAt, left, colStep, top, height);
    // The lamp, at the far right, on the root's row.
    const lamp = { x: left + width - LAMP_R - 2, y: laid.y };
    const glowing = state.done;

    // Wires first, under everything: from each child to its gate, and from
    // the root to the lamp. Gold when live, ink when dark.
    let icon = 0;
    const drawWires = (node: Laid) => {
      for (const child of node.children) {
        this.paintWire(child.x, child.y, node.x, node.y, child.on);
        drawWires(child);
      }
    };
    drawWires(laid);
    this.paintWire(laid.x, laid.y, lamp.x, lamp.y, laid.on);

    // Then the gates and inverters over the wires.
    const drawNodes = (node: Laid) => {
      for (const child of node.children) drawNodes(child);
      if (node.node.kind === "and" || node.node.kind === "or" || node.node.kind === "xor") {
        const image = this.icons[icon++];
        if (image) {
          image
            .setTexture(uiTextureKey(gateIcon(node.node.kind)))
            .setDisplaySize(GATE_ICON, GATE_ICON)
            .setPosition(node.x, node.y)
            .setVisible(true);
        }
      } else if (node.node.kind === "not") {
        // A bar across the wire, in the refusal's red: what goes in is
        // turned round.
        g.fillStyle(PAPER_PALE_HEX, 1);
        g.fillCircle(node.x, node.y, 9);
        g.lineStyle(2, INK_HEX, 0.8);
        g.strokeCircle(node.x, node.y, 9);
        g.lineStyle(4, WRONG_HEX, 1);
        g.lineBetween(node.x - 7, node.y + 7, node.x + 7, node.y - 7);
      }
    };
    drawNodes(laid);

    // The switches, each a plate with a lever thrown up when it is on.
    const shown = logicHint(state);
    const switches: { index: number; x: number; y: number }[] = [];
    for (let index = 0; index < circuit.switches; index++) {
      const at = switchAt(index);
      switches.push({ index, ...at });
      const on = state.on[index] === true;
      const hinted = shown === `switch-${index}`;
      const wrong = state.wrong === `switch-${index}`;
      g.fillStyle(INK_HEX, 0.85);
      g.fillRoundedRect(at.x - SWITCH_W / 2, at.y - SWITCH_H / 2, SWITCH_W, SWITCH_H, 5);
      g.lineStyle(
        hinted || wrong ? 3 : 2,
        wrong ? WRONG_HEX : hinted ? DONE_HEX : PAPER_PALE_HEX,
        1,
      );
      g.strokeRoundedRect(at.x - SWITCH_W / 2, at.y - SWITCH_H / 2, SWITCH_W, SWITCH_H, 5);
      // The hinge on the left, and the lever: up to the right when on,
      // resting down when off.
      g.fillStyle(on ? ACTIVE_HEX : PAPER_PALE_HEX, 1);
      g.fillCircle(at.x - SWITCH_W / 2 + 8, at.y + 5, 3);
      g.lineStyle(4, on ? ACTIVE_HEX : PAPER_PALE_HEX, 1);
      if (on) g.lineBetween(at.x - SWITCH_W / 2 + 8, at.y + 5, at.x + SWITCH_W / 2 - 6, at.y - 6);
      else g.lineBetween(at.x - SWITCH_W / 2 + 8, at.y + 5, at.x + SWITCH_W / 2 - 8, at.y + 7);
    }

    // And the lamp: a bulb, dark in ink or lit in gold with a glow round it.
    if (glowing) {
      g.fillStyle(ACTIVE_HEX, 0.25);
      g.fillCircle(lamp.x, lamp.y, LAMP_R + 12);
      g.fillStyle(ACTIVE_HEX, 0.45);
      g.fillCircle(lamp.x, lamp.y, LAMP_R + 6);
    }
    g.fillStyle(glowing ? ACTIVE_HEX : PAPER_PALE_HEX, 1);
    g.lineStyle(2, INK_HEX, 0.9);
    g.fillCircle(lamp.x, lamp.y, LAMP_R);
    g.strokeCircle(lamp.x, lamp.y, LAMP_R);
    // The filament, and the cap under the bulb.
    g.lineStyle(2, glowing ? PAPER_PALE_HEX : INK_HEX, 0.8);
    g.lineBetween(lamp.x - 5, lamp.y + 4, lamp.x, lamp.y - 4);
    g.lineBetween(lamp.x, lamp.y - 4, lamp.x + 5, lamp.y + 4);
    g.fillStyle(INK_HEX, 0.9);
    g.fillRect(lamp.x - 7, lamp.y + LAMP_R - 2, 14, 6);

    this.board = { tokens: [], switches, lamp };
  }

  /**
   * Where each node sits: switches in their column, gates one column per
   * depth, each on the average row of what feeds it.
   */
  private lay(
    node: Node,
    on: readonly boolean[],
    switchAt: (index: number) => { x: number; y: number },
    left: number,
    colStep: number,
    top: number,
    height: number,
  ): Laid {
    if (node.kind === "switch") {
      const at = switchAt(node.index);
      return { ...at, node, on: lit(node, on), children: [] };
    }
    if (node.kind === "not") {
      const child = this.lay(node.of, on, switchAt, left, colStep, top, height);
      // Half a column along the wire from what it inverts.
      return {
        x: child.x + colStep * 0.45,
        y: child.y,
        node,
        on: lit(node, on),
        children: [child],
      };
    }
    const children = [node.left, node.right].map((one) =>
      this.lay(one, on, switchAt, left, colStep, top, height),
    );
    const deepest = Math.max(...children.map((child) => nodeDepth(child.node)));
    const x = left + colStep * (deepest + 1) + SWITCH_W / 2;
    const y = children.reduce((sum, child) => sum + child.y, 0) / children.length;
    return { x, y, node, on: lit(node, on), children };
  }

  private paintWire(x0: number, y0: number, x1: number, y1: number, live: boolean): void {
    const g = this.ink;
    if (live) {
      g.lineStyle(WIRE + 4, ACTIVE_HEX, 0.3);
      g.lineBetween(x0, y0, x1, y1);
    }
    g.lineStyle(WIRE, live ? ACTIVE_HEX : INK_HEX, live ? 1 : 0.7);
    g.lineBetween(x0, y0, x1, y1);
  }

  // --- words -------------------------------------------------------------------

  private hintLine(state: LogicCast): string {
    if (state.done) return state.tray ? this.words.logicDoneTray : this.words.logicDoneCircuit;
    if (logicHint(state))
      return state.tray ? this.words.logicHintTray : this.words.logicHintCircuit;
    if (state.wrong) return state.tray ? this.words.logicWrong : this.words.logicWasted;
    return "";
  }

  private hintColour(state: LogicCast): string {
    if (state.done || logicHint(state)) return DONE_INK;
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
}

// --- reading a rule as pictures ------------------------------------------------

type RulePart =
  | { readonly kind: "hue"; readonly hue: Hue; readonly not: boolean }
  | { readonly kind: "shape"; readonly shape: Shape; readonly not: boolean }
  | { readonly kind: "gate"; readonly gate: "and" | "or" | "xor" };

/**
 * A rule as a row of pictures: swatches, and the machines between them.
 *
 * Flat, because every rule here is at most two swatches and one machine,
 * with a bar on a swatch for *not* — which is the whole of what the ladder
 * asks, and a row a child reads left to right.
 */
export function ruleParts(rule: Rule, not = false): RulePart[] {
  switch (rule.kind) {
    case "hue":
      return [{ kind: "hue", hue: rule.hue, not }];
    case "shape":
      return [{ kind: "shape", shape: rule.shape, not }];
    case "not":
      return ruleParts(rule.of, !not);
    case "and":
    case "or":
    case "xor":
      return [...ruleParts(rule.left), { kind: "gate", gate: rule.kind }, ...ruleParts(rule.right)];
  }
}

/** The machine that is each gate: the press waits for both, the funnel takes either, the seesaw takes either but never both. */
function gateIcon(gate: "and" | "or" | "xor"): string {
  return itemIcon(
    gate === "and" ? FixtureType.Press : gate === "or" ? FixtureType.Funnel : FixtureType.Seesaw,
  );
}

function partWidth(part: RulePart): number {
  return part.kind === "gate" ? RULE_ICON : SWATCH + 8;
}

/** How many gates deep a node is: a switch is nought. */
export function nodeDepth(node: Node): number {
  switch (node.kind) {
    case "switch":
      return 0;
    case "not":
      return nodeDepth(node.of);
    case "and":
    case "or":
    case "xor":
      return 1 + Math.max(nodeDepth(node.left), nodeDepth(node.right));
  }
}
