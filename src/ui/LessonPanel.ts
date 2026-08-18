// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import type { Phrases } from "../i18n/phrases";
import { PLACES } from "../spells/addition";
import { LESSON_BEATS, LESSON_EXAMPLE, LessonBeat, partsOf } from "../spells/lesson";
import { type Chip, PagedPanel } from "./PagedPanel";
import type { PanelRect } from "./ParchmentPanel";
import { UiAsset, type UiIndex } from "./assets";

/**
 * What the teacher shows you: the addition spell, in four pictures.
 *
 * The spell was the one thing in the game a child could be stuck on with no
 * way to ask. Its own parchment offers hints, but only after two wrong
 * answers — help you have to fail into is help arriving at the worst moment.
 * So the method is somewhere you can go and read it: the school, from the
 * person sitting in it.
 *
 * One idea per screen, each with a picture:
 *
 * 1. **the rune** — the spellbook and the + icon, exactly as they appear in
 *    the corner of the screen, so the lesson names things the player can see
 *    rather than things it has invented for the telling;
 * 2. **the split** — the number pulled into hundreds, tens and ones;
 * 3. **the jumps** — the same number line the spell draws, with all three
 *    arcs already made and each landing marked;
 * 4. **the answer** — where you end up, and why smallest-first is the order.
 *
 * The example is `LESSON_EXAMPLE`, built by the same function that builds a
 * real problem, so what she teaches cannot drift from what the spell sets.
 */

const INK = "#4a3422";
const INK_HEX = 0x4a3422;
const RUNE_HEX = 0xc8901c;
const DONE_HEX = 0x3d6b2a;

const SMALL_SIZE = 12;
const CHIP_W = 74;
const CHIP_H = 34;
const ARC_HEIGHTS = [22, 34, 46];
const ARC_SEGMENTS = 24;
const STOP_BOX_W = 46;
const STOP_BOX_H = 22;

export class LessonPanel extends PagedPanel<LessonBeat> {
  private readonly caption: Phaser.GameObjects.Text;
  private readonly startLabel: Phaser.GameObjects.Text;
  /** The number pulled apart, where each jump lands, and what each jump adds. */
  private readonly splitChips: Chip[] = [];
  private readonly stopChips: Chip[] = [];
  private readonly jumpLabels: Phaser.GameObjects.Text[] = [];

  constructor(
    scene: Phaser.Scene,
    index: UiIndex,
    depth: number,
    words: Phrases,
    register: (object: Phaser.GameObjects.GameObject) => void,
  ) {
    super(scene, index, depth, words, register, {
      maxWidth: 470,
      maxHeight: 400,
      minWidth: 300,
      minHeight: 300,
      icons: 2,
    });

    this.caption = this.own(this.dimText("", SMALL_SIZE).setOrigin(0.5, 0));
    this.startLabel = this.own(this.dimText("", SMALL_SIZE).setOrigin(0.5, 0));
    for (let i = 0; i < PLACES; i++) {
      this.splitChips.push(this.chip(CHIP_W, CHIP_H));
      this.stopChips.push(this.chip(STOP_BOX_W, STOP_BOX_H));
      this.jumpLabels.push(this.raise(this.own(this.text("", SMALL_SIZE, INK).setOrigin(0.5, 1))));
    }
  }

  protected deck(): readonly LessonBeat[] {
    return LESSON_BEATS;
  }

  protected titleText(): string {
    return this.words.lessonTitle;
  }

  protected bodyText(beat: LessonBeat): string {
    const example = LESSON_EXAMPLE;
    switch (beat) {
      case LessonBeat.Rune:
        return this.words.lessonRune;
      case LessonBeat.Split:
        return this.words.lessonSplit(example.addend, partsOf(example));
      case LessonBeat.Jump:
        return this.words.lessonJump(example.start, example.jumps);
      default:
        return this.words.lessonAnswer(example.stops.at(-1) as number);
    }
  }

  protected drawArt(rect: PanelRect, top: number, bottom: number, beat: LessonBeat): void {
    const middle = (top + bottom) / 2;
    if (beat === LessonBeat.Rune) {
      this.drawIcons(rect, middle, [UiAsset.Spellbook, UiAsset.RuneAdd]);
      return;
    }
    if (beat === LessonBeat.Split) {
      this.drawSplit(rect, middle, bottom);
      return;
    }
    this.drawNumberLine(rect, middle, beat === LessonBeat.Answer);
  }

  /** The addend in pieces, biggest first — which is how a number is read out. */
  private drawSplit(rect: PanelRect, middle: number, bottom: number): void {
    const parts = partsOf(LESSON_EXAMPLE);
    const spread = (parts.length - 1) * (CHIP_W + 10);
    for (const [i, part] of parts.entries()) {
      const chip = this.splitChips[i];
      if (!chip) continue;
      this.place(chip, rect.centreX - spread / 2 + i * (CHIP_W + 10), middle, CHIP_W, CHIP_H);
      chip.label.setText(String(part));
      chip.box.setStrokeStyle(2, INK_HEX);
      this.show(chip);
    }
    this.caption
      .setText(this.words.lessonExample(LESSON_EXAMPLE.start, LESSON_EXAMPLE.addend))
      .setPosition(rect.centreX, bottom - SMALL_SIZE)
      .setVisible(true);
  }

  /**
   * The same picture the spell draws, with every jump already made.
   *
   * Drawn again here rather than shared with SpellPopup: that one is a live
   * widget with an active box, a caret and three arc states, and this is a
   * diagram. What the two must agree on is the *arithmetic*, and they do —
   * both take their numbers from one problem built by one function.
   */
  private drawNumberLine(rect: PanelRect, middle: number, answering: boolean): void {
    const problem = LESSON_EXAMPLE;
    const lineLeft = rect.left + 16 + STOP_BOX_W / 2;
    const lineRight = rect.left + rect.width - 16 - STOP_BOX_W / 2;
    const spacing = (lineRight - lineLeft) / PLACES;
    const stopX = (i: number) => lineLeft + spacing * i;
    const lineY = middle + 14;

    this.ink.lineStyle(2, INK_HEX, 1);
    this.ink.lineBetween(lineLeft - 8, lineY, lineRight + 8, lineY);
    for (let i = 0; i <= PLACES; i++) {
      this.ink.lineBetween(stopX(i), lineY - 4, stopX(i), lineY + 4);
    }

    // Curves first, then every head: consecutive jumps share a landing point,
    // so an arc drawn whole lays its rising stroke over the head before it.
    for (let i = 0; i < PLACES; i++) {
      const last = answering && i === PLACES - 1;
      this.arcCurve(
        stopX(i),
        stopX(i + 1),
        lineY,
        ARC_HEIGHTS[i] as number,
        last ? DONE_HEX : RUNE_HEX,
      );
    }
    for (let i = 0; i < PLACES; i++) {
      const last = answering && i === PLACES - 1;
      this.arcHead(stopX(i + 1), lineY, last ? DONE_HEX : RUNE_HEX);
    }

    this.startLabel
      .setText(String(problem.start))
      .setPosition(stopX(0), lineY + 8)
      .setVisible(true);

    for (let i = 0; i < PLACES; i++) {
      this.jumpLabels[i]
        ?.setText(`+${problem.jumps[i]}`)
        .setPosition((stopX(i) + stopX(i + 1)) / 2, lineY - (ARC_HEIGHTS[i] as number) - 2)
        .setVisible(true);

      const stop = this.stopChips[i];
      if (!stop) continue;
      this.place(stop, stopX(i + 1), lineY + 8 + STOP_BOX_H / 2, STOP_BOX_W, STOP_BOX_H);
      stop.label.setText(String(problem.stops[i]));
      // The last landing is the answer, and on the last beat it is the point
      // of the whole picture.
      const isAnswer = answering && i === PLACES - 1;
      stop.box.setStrokeStyle(isAnswer ? 3 : 2, isAnswer ? DONE_HEX : INK_HEX);
      this.show(stop);
    }
  }

  private arcCurve(from: number, to: number, baseY: number, rise: number, color: number): void {
    const rx = (to - from) / 2;
    const midX = (from + to) / 2;
    this.ink.lineStyle(2, color, 1);
    this.ink.beginPath();
    for (let step = 0; step <= ARC_SEGMENTS; step++) {
      const angle = Math.PI - (Math.PI * step) / ARC_SEGMENTS;
      this.ink[step === 0 ? "moveTo" : "lineTo"](
        midX + Math.cos(angle) * rx,
        baseY - Math.sin(angle) * rise,
      );
    }
    this.ink.strokePath();
  }

  private arcHead(at: number, baseY: number, color: number): void {
    this.ink.fillStyle(color, 1);
    this.ink.fillTriangle(at, baseY - 2, at - 5, baseY - 11, at + 5, baseY - 11);
  }
}
