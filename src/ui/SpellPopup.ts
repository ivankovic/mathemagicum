// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import type { Phrases } from "../i18n/phrases";
import {
  type BareSum,
  type CastResult,
  type CastState,
  type NumberLine,
  PLACES,
  backspace,
  bareHintFor,
  bareSumText,
  beginCast,
  castResult,
  hintFor,
  isSolved,
  movedBy,
  runsDown,
  submit,
  typeDigit,
} from "../spells/addition";
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
 * The parchment a spell is cast on.
 *
 * A mode of the game scene rather than a scene of its own, the same call
 * made for building interiors and for the same reason: launching a second
 * scene means duplicating the camera split and the input plumbing, and
 * pausing this one while the joystick is held leaves the player walking
 * forever when it resumes.
 *
 * Everything it draws is in real screen pixels and belongs to the UI camera,
 * so `register` is handed each object exactly as the joystick does it.
 *
 * The number line is deliberately **schematic**, not to scale. Drawn to
 * scale, the ones jump — at most 9 — would be a fraction of a pixel against
 * a span of several hundred, and the first of the three arrows would be
 * invisible. So the four points are spaced evenly and the arcs carry their
 * size in their height instead, which is how an empty number line is taught
 * anyway.
 */

const PANEL_MAX_W = 460;
const PANEL_MAX_H = 430;
const PANEL_MIN_W = 280;
const PANEL_MIN_H = 300;

const TITLE_SIZE = 20;
const LABEL_SIZE = 13;
const BOX_SIZE = 17;
const HINT_SIZE = 12;

// How tall each arc rises, by place. The line is schematic, so this is the
// only thing left that can say a hundreds jump is bigger than a ones jump —
// and saying it is the point of drawing them separately at all.
//
// The steps get smaller as they go, which they did not have to while there
// were three of them. Kept at fourteen apiece a sixth arc would rise a
// hundred and ten pixels, which is a third of the parchment spent on the
// gap above one arrow. What has to survive is the *order* — each arc taller
// than the last, so the jumps read as growing — and that survives a step of
// four as well as a step of fourteen.
const ARC_HEIGHTS = [26, 40, 54, 64, 71, 76];
const ARC_SEGMENTS = 28;
const ARC_TOP = ARC_HEIGHTS[ARC_HEIGHTS.length - 1] as number;

// Clear of the line and its tick marks, with room for a label under the
// start point that is not a box.
const LINE_GAP = 9;

const BOX_W = 52;
const BOX_H = 26;
/** The narrowest a box may get before a six-digit number stops being legible. */
const BOX_MIN_W = 40;
/** How wide one character of the monospace face is, as a share of its size. */
const CHAR_W = 0.62;
/** Air between two boxes, so six of them do not read as one long strip. */
const BOX_GAP = 3;
const KEY_GAP = 6;
const KEY_COLS = 5;
const KEY_ROWS = 3;
const KEY_MAX = 46;
const KEY_MIN = 26;

// Everything the panel draws with, and the three things it does to all of
// them regardless of what they are. Naming the components rather than the
// classes keeps `own` honest: an object that cannot be hidden or pinned to
// the screen has no business in a popup.
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

export class SpellPopup {
  /**
   * The sum being asked, when the rung asks for one without a number line.
   *
   * Held beside `state` rather than folded into it, because the cast
   * machinery is deliberately blind to what a line *means* — it compares
   * typed digits against a stop and nothing else. This is the panel's
   * business: the three numbers it needs to write the equation and to hint
   * about it, which the degenerate one-box line it is cast through cannot
   * carry.
   */
  private bare: BareSum | null = null;

  /** The bare sum being asked, or null on a number line. A dev seam. */
  get bareSum(): BareSum | null {
    return this.bare;
  }

  /**
   * The line of help currently under the sum. A dev seam.
   *
   * Worth exposing because it is the one thing on this parchment that can be
   * *wrong in the child's favour*: a hint that contains the answer would
   * look like a working game to every other check there is, since it only
   * appears after a wrong answer and the next one would then be right.
   */
  get hintText(): string {
    return this.hint.text;
  }

  private readonly parts: PanelPart[] = [];
  private readonly paper: ParchmentPanel;
  private readonly ink: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly startLabel: Phaser.GameObjects.Text;
  private readonly jumpLabels: Phaser.GameObjects.Text[] = [];
  private readonly boxes: Phaser.GameObjects.Rectangle[] = [];
  private readonly boxTexts: Phaser.GameObjects.Text[] = [];
  private readonly keys: PadKey[] = [];
  private readonly closeRect: Phaser.GameObjects.Rectangle;
  private readonly closeText: Phaser.GameObjects.Text;

  private state: CastState | null = null;
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
    this.hint = this.own(this.label("", HINT_SIZE, INK_DIM).setOrigin(0.5, 0));
    this.startLabel = this.own(this.label("", LABEL_SIZE, INK).setOrigin(0.5, 0));

    for (let i = 0; i < PLACES; i++) {
      this.jumpLabels.push(this.own(this.label("", LABEL_SIZE, INK).setOrigin(0.5, 1)));
      this.boxes.push(
        this.own(add.rectangle(0, 0, BOX_W, BOX_H, PAPER_PALE_HEX).setStrokeStyle(2, INK_HEX)),
      );
      this.boxTexts.push(this.own(this.label("", BOX_SIZE, INK).setOrigin(0.5)));
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
    // The ink sits above the paper but below the boxes and the keypad, which
    // are drawn on top of the lines they mark.
    this.ink.setDepth(depth + 1);
    for (const box of this.boxes) box.setDepth(depth + 2);
    for (const text of [...this.boxTexts, ...this.jumpLabels, this.startLabel]) {
      text.setDepth(depth + 3);
    }
    for (const key of this.keys) {
      key.rect.setDepth(depth + 2);
      key.text.setDepth(depth + 3);
    }
    this.closeRect.setDepth(depth + 2);
    this.closeText.setDepth(depth + 3);
  }

  /** Say everything from here on in another language. */
  setPhrases(words: Phrases): void {
    this.words = words;
    if (this.isOpen) this.layout();
  }

  /**
   * The cast in progress, or null.
   *
   * A dev seam rather than an API: a script driving the spell has to know
   * what the spell asked, and the alternative was reading the sum back off
   * the parchment. See `window.__mathemagicum.spell` in devHooks.ts.
   */
  get cast(): CastState | null {
    return this.state;
  }

  get isOpen(): boolean {
    return this.state !== null;
  }

  /**
   * Put a problem on the parchment.
   *
   * `onDone(true)` means it was solved and the caller should apply the
   * spell; `onDone(false)` means the player backed out. There is no third
   * outcome — a wrong answer never ends a cast, because the spell is how the
   * player gardens and locking them out of gardening for arithmetic is the
   * one thing the design pillars rule out.
   */
  /**
   * Start a cast.
   *
   * `given` is how many jumps arrive already worked out — the gentlest
   * settings hand a child the ones and ask for the rest, which is the
   * design's "train it with partially solved problems" as a dial rather than
   * as a lesson.
   *
   * Any number line, not the growth spell's in particular: this parchment
   * serves both spells, and it works out which way the line runs from the
   * stops rather than being told. A flag could be set wrong and would then
   * draw a subtraction under a plus sign; the stops cannot, because they are
   * the same numbers the boxes are checked against.
   */
  open(
    problem: NumberLine,
    given: number,
    onDone: (result: CastResult) => void,
    bare: BareSum | null = null,
  ): void {
    this.bare = bare;
    this.state = beginCast(problem, given);
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
    this.bare = null;
    this.finish = null;
    this.paper.setVisible(false);
    for (const part of this.parts) part.setVisible(false);
  }

  private dismiss(solved: boolean): void {
    const done = this.finish;
    // Read before closing: the state is what says whether every box went in
    // first time, and `close` throws it away.
    const result = castResult(this.state, solved);
    this.close();
    done?.(result);
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (!this.state) return;
    // A physical keyboard is a convenience on top of the keypad, never the
    // only way in: the game is played on a phone as often as not.
    if (event.key >= "0" && event.key <= "9") this.apply(typeDigit(this.state, Number(event.key)));
    else if (event.key === "Backspace") this.apply(backspace(this.state));
    else if (event.key === "Enter") this.apply(submit(this.state));
    else if (event.key === "Escape") this.dismiss(false);
    else return;
    event.preventDefault();
  }

  private apply(next: CastState): void {
    this.state = next;
    if (isSolved(next)) {
      this.render();
      // A beat on the finished parchment before it clears, so the last
      // answer is readable as an answer rather than as a flash.
      this.scene.time.delayedCall(650, () => this.dismiss(true));
      return;
    }
    this.render();
  }

  private buildKeypad(): void {
    const press = (label: string) => () => {
      if (!this.state) return;
      if (label === "OK") this.apply(submit(this.state));
      else if (label === "<") this.apply(backspace(this.state));
      else this.apply(typeDigit(this.state, Number(label)));
    };
    // Two rows of digits and a wide row of actions. Wider than it is tall,
    // which suits a panel that has to be at least 280 across anyway, and
    // gives the two buttons that are easy to hit by accident the most room.
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
    const { width, height } = this.scene.scale;
    const rect = this.paper.layout(width, height);
    const panelW = rect.width;
    const panelH = rect.height;
    const cx = rect.centreX;
    const cy = rect.centreY;
    const left = rect.left;
    const top = rect.top;

    this.closeRect.setPosition(left + panelW - PAD - 2, top + PAD + 2);
    this.closeText.setPosition(this.closeRect.x, this.closeRect.y);

    const innerW = panelW - PAD * 2;
    const innerH = panelH - PAD * 2;

    // The keypad takes what it needs from the bottom, bounded so the number
    // line always keeps enough room to draw its tallest arc plus its boxes.
    //
    // This problem's tallest arc, not the tallest there is. Reserving for
    // six arcs on a one-jump sum would take sixty pixels off the keypad of
    // every child in the gentlest band to make room for a picture nobody in
    // it will ever be shown.
    const arcCeiling = (ARC_HEIGHTS[state.problem.jumps.length - 1] ?? ARC_TOP) as number;
    const lineBlockMin = arcCeiling + BOX_H + LINE_GAP + 20;
    const spare =
      innerH - TITLE_SIZE - 10 - HINT_SIZE - 8 - lineBlockMin - KEY_GAP * (KEY_ROWS - 1);
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

    const problem = state.problem;
    const sign = runsDown(problem) ? "−" : "+";
    // A bare sum writes the whole equation across the top with a blank where
    // the answer goes; a number line writes only the sum being worked,
    // because the line underneath is already showing where it is going.
    this.title
      .setText(
        this.bare ? bareSumText(this.bare, "?") : `${problem.start} ${sign} ${movedBy(problem)}`,
      )
      .setPosition(cx, top + PAD);

    this.hint
      .setText(this.hintLine(state))
      .setColor(state.wrong ? WRONG_INK : INK_DIM)
      .setPosition(cx, keypadTop - HINT_SIZE - 8);

    // --- the number line ---------------------------------------------------

    // Centred in whatever the title and the keypad leave. Anchoring it under
    // the title instead left the panel's middle empty on a desktop window and
    // the line crammed against the keys on a phone.
    const contentTop = top + PAD + TITLE_SIZE + 10;
    const contentBottom = keypadTop - HINT_SIZE - 14;
    // As many jumps as this problem has, which the difficulty sets — one at
    // the gentlest setting, three at the one the game shipped with. The
    // furniture for the rest is built once and simply hidden, because a
    // parchment that destroyed and rebuilt its boxes every cast would be
    // rebuilding them mid-animation.
    const places = problem.jumps.length;
    // How wide a box can be and still leave room for the next one. At three
    // jumps this is `BOX_W` and nothing below changes; at six it is not, and
    // the difference is the whole of what makes a six-digit sum drawable on
    // a phone.
    const boxW = Math.max(
      BOX_MIN_W,
      Math.min(BOX_W, Math.floor((panelW - PAD * 2) / places) - BOX_GAP),
    );
    // And how big the digits in it can be. The widest thing a box ever holds
    // is the last stop, which is as many digits as the sum has places — so
    // the type is sized against the number rather than against the box, and
    // a six-digit answer is the case that decides it.
    const boxSize = Math.min(
      BOX_SIZE,
      Math.floor((boxW - 6) / (String(problem.stops.at(-1) ?? 0).length * CHAR_W)),
    );
    // The jump labels sit between two stops, so what they have is the gap
    // rather than the box: `+100000` is seven characters and the gap at six
    // places is not seven characters wide at full size.
    const labelSize = Math.min(LABEL_SIZE, BOX_SIZE);
    // The arcs get taller as they go, so a short line uses the low ones and
    // reserves the height it actually needs. Measuring from ARC_TOP instead
    // left about thirty pixels of empty parchment above a single small arc.
    const arcTop = (ARC_HEIGHTS[places - 1] ?? ARC_TOP) as number;
    const blockH = arcTop + LINE_GAP + BOX_H;
    const blockTop = contentTop + Math.max(0, (contentBottom - contentTop - blockH) / 2);
    const lineY = Math.round(blockTop + arcTop);
    const lineLeft = left + PAD + boxW / 2;
    const lineRight = left + panelW - PAD - boxW / 2;
    const spacing = (lineRight - lineLeft) / places;
    // Subtraction runs the other way along the page, and it has to: a number
    // line has smaller numbers to the left, so drawing 988 at the left edge
    // and 734 at the right would contradict every number line a child has
    // ever seen. The start sits on the right and each jump goes left, which
    // is also the direction the arrowheads then point.
    const backwards = runsDown(problem);
    const stopX = (i: number) => (backwards ? lineRight - spacing * i : lineLeft + spacing * i);

    this.ink.clear();

    // --- and the same panel with no line on it at all ----------------------
    //
    // The top of the ladder asks a sum the way anybody writes one, so there
    // is nothing to draw: no line, no ticks, no arcs, no start label, and
    // one box under the equation rather than one per place.
    //
    // A branch here rather than a second panel. Everything above this point
    // — the parchment, the keypad, the entry, the close button, the sizing
    // against a phone — is shared, and what differs is one picture. The
    // division spell got a panel of its own because it is a different
    // *spell*; this is the same spell with its scaffold taken away.
    if (this.bare) {
      this.startLabel.setVisible(false);
      for (let i = 0; i < PLACES; i++) {
        this.jumpLabels[i]?.setVisible(false);
        const inUse = i === 0;
        this.boxes[i]?.setVisible(inUse);
        this.boxTexts[i]?.setVisible(inUse);
      }
      const box = this.boxes[0];
      const text = this.boxTexts[0];
      const wide = Math.min(panelW - PAD * 2, BOX_W * 3);
      const middle = contentTop + (contentBottom - contentTop) / 2;
      box?.setSize(wide, BOX_H)?.setPosition(cx, middle);
      box?.setStrokeStyle(3, state.wrong ? WRONG_HEX : ACTIVE_HEX);
      text
        ?.setFontSize(
          Math.min(BOX_SIZE, Math.floor((wide - 8) / (Math.max(1, state.entry.length) * CHAR_W))),
        )
        .setPosition(cx, middle)
        .setText(state.entry === "" ? "_" : state.entry)
        .setColor(INK);
      return;
    }

    this.startLabel.setVisible(true);
    this.ink.lineStyle(2, INK_HEX, 1);
    this.ink.lineBetween(lineLeft - 10, lineY, lineRight + 10, lineY);
    // Ticks, so the points read as places on a line rather than as free
    // floating labels.
    for (let i = 0; i <= places; i++) {
      this.ink.lineBetween(stopX(i), lineY - 4, stopX(i), lineY + 4);
    }

    this.startLabel
      .setText(String(problem.start))
      .setFontSize(boxSize)
      .setPosition(stopX(0), lineY + LINE_GAP);

    // Curves first, then every head — not one arc at a time. Consecutive
    // jumps share a landing point, so an arc drawn whole would have the next
    // one's rising stroke laid straight over the head it just finished with.
    // That is not a subtle artefact: the first arrow simply had no head.
    for (let i = 0; i < places; i++) {
      this.drawArcCurve(
        stopX(i),
        stopX(i + 1),
        lineY,
        ARC_HEIGHTS[i] as number,
        this.arcColor(state, i),
        i === state.index ? 3 : 2,
      );
    }
    for (let i = 0; i < places; i++) {
      this.drawArcHead(stopX(i + 1), lineY, this.arcColor(state, i));
    }

    for (let i = 0; i < PLACES; i++) {
      // Boxes past this problem's last jump belong to a harder setting; they
      // are hidden rather than left showing an empty "?" the child cannot
      // reach.
      const inUse = i < places;
      this.jumpLabels[i]?.setVisible(inUse);
      this.boxes[i]?.setVisible(inUse);
      this.boxTexts[i]?.setVisible(inUse);
      if (!inUse) continue;

      const from = stopX(i);
      const to = stopX(i + 1);
      const rise = ARC_HEIGHTS[i] as number;
      const solved = i < state.index;
      const active = i === state.index;

      const jumpLabel = this.jumpLabels[i];
      const written = `${runsDown(problem) ? "−" : "+"}${problem.jumps[i]}`;
      jumpLabel?.setText(written);
      // Shrunk to the space between the two stops it belongs to, so a
      // `+100000` over a narrow arc does not run into its neighbours.
      jumpLabel?.setFontSize(
        Math.max(9, Math.min(labelSize, Math.floor((spacing - 4) / (written.length * CHAR_W)))),
      );
      jumpLabel?.setPosition((from + to) / 2, lineY - rise - 3);
      jumpLabel?.setColor(solved ? DONE_INK : INK);

      const box = this.boxes[i];
      const text = this.boxTexts[i];
      box?.setSize(boxW, BOX_H);
      box?.setPosition(to, lineY + LINE_GAP + BOX_H / 2);
      text?.setFontSize(boxSize);
      text?.setPosition(to, lineY + LINE_GAP + BOX_H / 2);
      if (solved) {
        box?.setStrokeStyle(2, DONE_HEX);
        text?.setText(String(state.solved[i])).setColor(DONE_INK);
      } else if (active) {
        // A caret in the empty active box, so it is obvious which one the
        // keypad is typing into even before a digit goes in.
        box?.setStrokeStyle(3, state.wrong ? WRONG_HEX : ACTIVE_HEX);
        text?.setText(state.entry === "" ? "_" : state.entry).setColor(INK);
      } else {
        box?.setStrokeStyle(2, INK_HEX);
        text?.setText("?").setColor(INK_DIM);
      }
    }
  }

  private hintLine(state: CastState): string {
    const bare = this.bare;
    if (bare) {
      // Solved, the equation is written out whole with the answer in the gap
      // it was asking about — which is the point of the line being read back
      // rather than a tick: the child sees the thing they made true.
      if (isSolved(state)) return bareSumText(bare, String(state.solved.at(-1)));
      return bareHintFor(bare, state.attempts, this.words) ?? bareSumText(bare, "?");
    }
    if (isSolved(state)) {
      const sign = runsDown(state.problem) ? "−" : "+";
      return `${state.problem.start} ${sign} ${movedBy(state.problem)} = ${state.solved.at(-1)}`;
    }
    const hint = hintFor(state, this.words);
    if (hint) return hint;
    return this.words.jumpPrompt(state.index);
  }

  /** Which of the three states an arc is in: done, being answered, or ahead. */
  private arcColor(state: CastState, index: number): number {
    if (index < state.index) return DONE_HEX;
    return index === state.index ? ACTIVE_HEX : INK_HEX;
  }

  /**
   * One jump, as a half-ellipse.
   *
   * Sampled rather than drawn with `arc`, which is circular only: the arcs
   * have to be wider than they are tall, both because three of them share
   * the width of a phone and because their differing heights are the only
   * thing left saying which jump is the big one.
   */
  private drawArcCurve(
    from: number,
    to: number,
    baseY: number,
    rise: number,
    color: number,
    thickness: number,
  ): void {
    const rx = (to - from) / 2;
    const midX = (from + to) / 2;
    this.ink.lineStyle(thickness, color, 1);
    this.ink.beginPath();
    for (let step = 0; step <= ARC_SEGMENTS; step++) {
      const angle = Math.PI - (Math.PI * step) / ARC_SEGMENTS;
      const x = midX + Math.cos(angle) * rx;
      const y = baseY - Math.sin(angle) * rise;
      if (step === 0) this.ink.moveTo(x, y);
      else this.ink.lineTo(x, y);
    }
    this.ink.strokePath();
  }

  /**
   * The head of one jump, pointing down at the tick it lands on.
   *
   * Sits just clear of the line rather than on it: with its apex on the line
   * the head was half swallowed by the line's own stroke, and what survived
   * read as a blot where the curve met the axis.
   */
  private drawArcHead(at: number, baseY: number, color: number): void {
    this.ink.fillStyle(color, 1);
    this.ink.fillTriangle(at, baseY - 2, at - 6, baseY - 13, at + 6, baseY - 13);
  }

  destroy(): void {
    this.close();
    this.paper.destroy();
    for (const part of this.parts) part.destroy();
  }
}
