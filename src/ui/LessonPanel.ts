// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import type { Phrases } from "../i18n/phrases";
import { PLACES } from "../spells/addition";
import {
  LESSON_BEATS,
  LESSON_EXAMPLE,
  LessonBeat,
  isLastBeat,
  nextBeat,
  partsOf,
} from "../spells/lesson";
import { PANEL_PAD as PAD, ParchmentPanel } from "./ParchmentPanel";
import { UiAsset, type UiIndex, uiTextureKey } from "./assets";

/**
 * What the teacher shows you: the addition spell, in four pictures.
 *
 * The spell was the one thing in the game a child could be stuck on with no
 * way to ask. Its own parchment offers hints, but only after two wrong
 * answers — help you have to fail into is help arriving at the worst moment.
 * So the method is somewhere you can go and read it: the school, from the
 * person sitting in it.
 *
 * One idea per screen, each with a picture, because it is a lesson being read
 * by somebody who wants to get back to their garden:
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

const PANEL_MAX_W = 470;
const PANEL_MAX_H = 400;
const PANEL_MIN_W = 300;
const PANEL_MIN_H = 300;

const INK = "#4a3422";
const INK_DIM = "#8a6a48";
const INK_HEX = 0x4a3422;
const PAPER_PALE_HEX = 0xf6e8c4;
const RUNE_HEX = 0xc8901c;
const DONE_HEX = 0x3d6b2a;

const TITLE_SIZE = 17;
const BODY_SIZE = 13;
const SMALL_SIZE = 12;

const ICON_ART = 40;
const CHIP_W = 74;
const CHIP_H = 34;
const ARC_HEIGHTS = [22, 34, 46];
const ARC_SEGMENTS = 24;
const STOP_BOX_W = 46;
const STOP_BOX_H = 22;

interface Chip {
  readonly box: Phaser.GameObjects.Rectangle;
  readonly label: Phaser.GameObjects.Text;
}

type PanelPart = Phaser.GameObjects.GameObject &
  Phaser.GameObjects.Components.Depth &
  Phaser.GameObjects.Components.ScrollFactor &
  Phaser.GameObjects.Components.Visible;

export class LessonPanel {
  private readonly paper: ParchmentPanel;
  private readonly parts: PanelPart[] = [];
  private readonly ink: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private readonly caption: Phaser.GameObjects.Text;
  private readonly spellbook: Phaser.GameObjects.Image;
  private readonly rune: Phaser.GameObjects.Image;
  private readonly plus: Phaser.GameObjects.Text;
  /** The number pulled apart, and the same three numbers as jump labels. */
  private readonly chips: Chip[] = [];
  private readonly stops: Chip[] = [];
  private readonly jumpLabels: Phaser.GameObjects.Text[] = [];
  private readonly startLabel: Phaser.GameObjects.Text;
  private readonly dots: Phaser.GameObjects.Rectangle[] = [];
  private readonly nextButton: Chip;
  private readonly backButton: Chip;
  private readonly closeButton: Chip;

  private open = false;
  private beat: LessonBeat = LessonBeat.Rune;
  private onClose: (() => void) | null = null;
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
    this.title = this.own(this.text("", TITLE_SIZE, INK).setOrigin(0.5, 0));
    this.body = this.own(this.text("", BODY_SIZE, INK).setOrigin(0.5, 0).setAlign("center"));
    this.caption = this.own(this.text("", SMALL_SIZE, INK_DIM).setOrigin(0.5, 0));

    this.spellbook = this.own(
      scene.add.image(0, 0, uiTextureKey(UiAsset.Spellbook)).setDisplaySize(ICON_ART, ICON_ART),
    );
    this.rune = this.own(
      scene.add.image(0, 0, uiTextureKey(UiAsset.RuneAdd)).setDisplaySize(ICON_ART, ICON_ART),
    );
    // Between the two icons, reading "the book, then the rune inside it".
    this.plus = this.own(this.text("", TITLE_SIZE, INK_DIM).setOrigin(0.5));

    for (let i = 0; i < PLACES; i++) {
      this.chips.push(this.chip(CHIP_W, CHIP_H));
      this.stops.push(this.chip(STOP_BOX_W, STOP_BOX_H));
      this.jumpLabels.push(this.own(this.text("", SMALL_SIZE, INK).setOrigin(0.5, 1)));
    }
    this.startLabel = this.own(this.text("", SMALL_SIZE, INK_DIM).setOrigin(0.5, 0));

    for (let i = 0; i < LESSON_BEATS.length; i++) {
      this.dots.push(
        this.own(scene.add.rectangle(0, 0, 7, 7, PAPER_PALE_HEX).setStrokeStyle(2, INK_HEX)),
      );
    }

    this.nextButton = this.button(() => this.turn(1));
    this.backButton = this.button(() => this.turn(-1));
    this.closeButton = this.button(() => this.close());

    for (const part of this.parts) {
      part
        .setDepth(depth + 1)
        .setScrollFactor(0)
        .setVisible(false);
      register(part);
    }
    this.ink.setDepth(depth + 1);
    for (const chip of this.allChips()) chip.label.setDepth(depth + 2);
    this.spellbook.setDepth(depth + 2);
    this.rune.setDepth(depth + 2);
  }

  private allChips(): Chip[] {
    return [...this.chips, ...this.stops, this.nextButton, this.backButton, this.closeButton];
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** Say everything from here on in another language. */
  setPhrases(words: Phrases): void {
    this.words = words;
    if (this.open) this.render();
  }

  open_(onClose: () => void): void {
    this.open = true;
    this.onClose = onClose;
    // Always from the top. A lesson that resumed where it was left off would
    // open on beat three for someone who came back to hear it again.
    this.beat = LESSON_BEATS[0] as LessonBeat;
    this.paper.setVisible(true);
    this.render();
    this.keyHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        this.close();
      } else if (event.key === "ArrowRight" || event.key === "Enter") {
        event.preventDefault();
        this.turn(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        this.turn(-1);
      }
    };
    this.scene.input.keyboard?.on("keydown", this.keyHandler);
  }

  close(): void {
    if (this.keyHandler) {
      this.scene.input.keyboard?.off("keydown", this.keyHandler);
      this.keyHandler = null;
    }
    this.open = false;
    this.paper.setVisible(false);
    this.ink.clear();
    for (const part of this.parts) part.setVisible(false);
    const done = this.onClose;
    this.onClose = null;
    done?.();
  }

  layout(): void {
    if (this.open) this.render();
  }

  /** Forward off the last page closes: "next" there says "off you go". */
  private turn(step: number): void {
    if (step > 0 && isLastBeat(this.beat)) {
      this.close();
      return;
    }
    this.beat = nextBeat(this.beat, step);
    this.render();
  }

  // --- drawing --------------------------------------------------------------

  private render(): void {
    const { width, height } = this.scene.scale;
    const rect = this.paper.layout(width, height);
    for (const part of this.parts) part.setVisible(false);
    this.ink.clear();
    this.ink.setVisible(true);

    this.title
      .setText(this.words.lessonTitle)
      .setPosition(rect.centreX, rect.top + PAD)
      .setVisible(true);
    this.place(this.closeButton, rect.left + rect.width - PAD - 14, rect.top + PAD + 10, 28, 24);
    this.closeButton.label.setText("x");
    this.show(this.closeButton);

    const bodyTop = rect.top + PAD + TITLE_SIZE + 12;
    this.body
      .setText(this.textFor(this.beat))
      .setWordWrapWidth(rect.width - PAD * 2)
      .setPosition(rect.centreX, bodyTop)
      .setVisible(true);

    const artTop = bodyTop + this.body.height + 16;
    const artBottom = rect.top + rect.height - PAD - 58;
    this.drawArt(rect, artTop, artBottom);

    // Where you are in the lesson, as one dot per beat: four pages is few
    // enough to show rather than to count in words.
    const dotsY = rect.top + rect.height - PAD - 44;
    for (const [i, dot] of this.dots.entries()) {
      const spread = (this.dots.length - 1) * 14;
      dot
        .setPosition(rect.centreX - spread / 2 + i * 14, dotsY)
        .setFillStyle(LESSON_BEATS[i] === this.beat ? RUNE_HEX : PAPER_PALE_HEX)
        .setVisible(true);
    }

    const buttonY = rect.top + rect.height - PAD - 18;
    this.place(this.nextButton, rect.centreX + 66, buttonY, 120, 28);
    this.nextButton.label.setText(
      isLastBeat(this.beat) ? this.words.lessonDone : this.words.lessonNext,
    );
    this.nextButton.box.setStrokeStyle(2, isLastBeat(this.beat) ? DONE_HEX : INK_HEX);
    this.show(this.nextButton);
    if (this.beat !== LESSON_BEATS[0]) {
      this.place(this.backButton, rect.centreX - 66, buttonY, 120, 28);
      this.backButton.label.setText(this.words.lessonBack);
      this.show(this.backButton);
    }
  }

  private textFor(beat: LessonBeat): string {
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

  private drawArt(
    rect: { left: number; width: number; centreX: number },
    top: number,
    bottom: number,
  ): void {
    const middle = (top + bottom) / 2;
    if (this.beat === LessonBeat.Rune) {
      this.spellbook.setPosition(rect.centreX - 46, middle).setVisible(true);
      this.plus.setText("+").setPosition(rect.centreX, middle).setVisible(true);
      this.rune.setPosition(rect.centreX + 46, middle).setVisible(true);
      return;
    }
    if (this.beat === LessonBeat.Split) {
      // Biggest part first, which is how the number is read aloud — the
      // jumps go the other way, and that contrast is the next beat.
      const parts = partsOf(LESSON_EXAMPLE);
      const spread = (parts.length - 1) * (CHIP_W + 10);
      for (const [i, part] of parts.entries()) {
        const chip = this.chips[i];
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
      return;
    }
    this.drawNumberLine(rect, middle);
  }

  /**
   * The same picture the spell draws, with every jump already made.
   *
   * Drawn again here rather than shared with SpellPopup: that one is a live
   * widget with an active box, a caret and three arc states, and this is a
   * diagram. What the two must agree on is the *arithmetic*, and they do —
   * both take their numbers from one problem built by one function.
   */
  private drawNumberLine(
    rect: { left: number; width: number; centreX: number },
    middle: number,
  ): void {
    const problem = LESSON_EXAMPLE;
    const answering = this.beat === LessonBeat.Answer;
    const lineLeft = rect.left + PAD + STOP_BOX_W / 2;
    const lineRight = rect.left + rect.width - PAD - STOP_BOX_W / 2;
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
      const label = this.jumpLabels[i];
      label
        ?.setText(`+${problem.jumps[i]}`)
        .setPosition((stopX(i) + stopX(i + 1)) / 2, lineY - (ARC_HEIGHTS[i] as number) - 2)
        .setVisible(true);

      const stop = this.stops[i];
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

  // --- plumbing -------------------------------------------------------------

  private chip(width: number, height: number): Chip {
    const box = this.own(
      this.scene.add.rectangle(0, 0, width, height, PAPER_PALE_HEX).setStrokeStyle(2, INK_HEX),
    );
    const label = this.own(this.text("", BODY_SIZE, INK).setOrigin(0.5));
    return { box, label };
  }

  private button(onTap: () => void): Chip {
    const chip = this.chip(10, 10);
    chip.box.setInteractive({ useHandCursor: true }).on("pointerdown", onTap);
    return chip;
  }

  private place(chip: Chip, x: number, y: number, width: number, height: number): void {
    chip.box.setSize(width, height).setPosition(x, y);
    chip.label.setPosition(x, y);
  }

  private show(chip: Chip): void {
    chip.box.setVisible(true);
    chip.label.setVisible(true);
  }

  private text(value: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.scene.add.text(0, 0, value, {
      fontFamily: "monospace",
      fontSize: `${size}px`,
      color,
      lineSpacing: 3,
    });
  }

  private own<T extends PanelPart>(object: T): T {
    this.parts.push(object);
    return object;
  }

  destroy(): void {
    this.close();
    this.paper.destroy();
    for (const part of this.parts) part.destroy();
  }
}
