// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import { FACE } from "./parchment";

/**
 * The question a machine asks when she taps it with a heap in her basket:
 * how many of these?
 *
 * A tap used to tip the whole heap in — the biggest one she carried, all of
 * it — on the argument that choosing is a menu and a menu was the thing the
 * interaction was trying not to be. A playtest overturned that: a child who
 * had just cleared eighty trees walked up to a sorter with two hundred and
 * forty timber and lost the lot into one hopper. The heap is hers, and how
 * much of it goes in is a decision the machine has no business making.
 *
 * So the tap asks, in one row over the machine's mouth: fewer, the thing
 * and how many, more, and the tick. It opens at *all of it*, because the
 * child who wants everything in is still the common case and for her the
 * answer is one more tap; the child who wants nine of two hundred holds the
 * minus down and watches the number run.
 *
 * Numerals rather than a picture of the heap, and that is allowed: the
 * design's rule is that nothing is said in *prose*, and a count is the
 * subject, not a sentence about it. A five-year-old who cannot read "nine"
 * can read 9 — it is the same figure the sums are written in.
 *
 * Not modal, like the ring of choices over a bench: a tap anywhere else
 * closes it and does nothing more, and a step away is a change of mind.
 * Built fresh each time it opens, for the reason the patch menu is.
 */

const FILL = 0x000000;
const FILL_ALPHA = 0.72;
const STROKE = 0xffe08a;
const INK = "#ffe08a";
/** The one that was just pressed, for the frame or two before it all goes. */
const PRESSED_STROKE = 0xffffff;

const ICON = 28;
const PAD = 7;
const GAP = 5;
/** How far above the machine's own point the row hangs. */
const RISE = 10;
/** How wide the box with the thing and its count is. */
const COUNT_WIDTH = 84;

/**
 * Holding a button down runs the number.
 *
 * The first repeat waits long enough that a tap is a tap, and the rest
 * come fast enough that two hundred is a few seconds of holding rather
 * than a minute of tapping. After a while the steps get bigger, so a big
 * heap comes down in tens — a number a child can still watch change.
 */
const HOLD_BEFORE_MS = 380;
const HOLD_EVERY_MS = 70;
const STEPS_BEFORE_FIVES = 12;
const STEPS_BEFORE_TENS = 30;

export const HeapButton = {
  Fewer: "fewer",
  More: "more",
  Yes: "yes",
} as const;
export type HeapButton = (typeof HeapButton)[keyof typeof HeapButton];

type Part = Phaser.GameObjects.Image | Phaser.GameObjects.Text;

interface Box {
  readonly rect: Phaser.GameObjects.Rectangle;
  readonly parts: Part[];
  readonly name: string;
}

export class HeapPicker {
  private boxes: Box[] = [];
  private label: Phaser.GameObjects.Text | null = null;
  private choose: ((count: number) => void) | null = null;
  private most = 0;
  private chosen = 0;
  private holding: Phaser.Time.TimerEvent | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depth: number,
    private readonly register: (object: Phaser.GameObjects.GameObject) => void,
    /** The texture the tick is drawn from. */
    private readonly yesTexture: string,
  ) {}

  get isOpen(): boolean {
    return this.boxes.length > 0;
  }

  /** How many the row says right now, for a script that cannot read it. */
  get count(): number {
    return this.chosen;
  }

  /** The most it will offer, which is the whole heap. */
  get limit(): number {
    return this.most;
  }

  /**
   * Ask over a point on screen, for a heap of this many, drawn as this.
   *
   * The row is centred over the point and lifted clear of it, so the
   * finger that tapped the machine is not over the buttons it produced.
   */
  openAt(
    at: { x: number; y: number },
    icon: string,
    most: number,
    onChoose: (count: number) => void,
  ): void {
    this.close();
    this.most = Math.max(1, Math.trunc(most));
    this.chosen = this.most;
    this.choose = onChoose;
    const add = this.scene.add;
    const size = ICON + PAD * 2;

    const fewer = this.box(HeapButton.Fewer, size, size, [
      add.text(0, 0, "−", { fontFamily: FACE, fontSize: `${ICON}px`, color: INK }).setOrigin(0.5),
    ]);
    const label = add
      .text(0, 0, "", { fontFamily: FACE, fontSize: `${ICON * 0.7}px`, color: INK })
      .setOrigin(0, 0.5);
    this.label = label;
    const count = this.box(null, COUNT_WIDTH, size, [
      add.image(0, 0, icon).setDisplaySize(ICON, ICON),
      label,
    ]);
    const more = this.box(HeapButton.More, size, size, [
      add.text(0, 0, "+", { fontFamily: FACE, fontSize: `${ICON}px`, color: INK }).setOrigin(0.5),
    ]);
    const yes = this.box(HeapButton.Yes, size, size, [
      add.image(0, 0, this.yesTexture).setDisplaySize(ICON, ICON),
    ]);

    const widths = [size, COUNT_WIDTH, size, size];
    const total = widths.reduce((sum, width) => sum + width, 0) + GAP * (widths.length - 1);
    let left = at.x - total / 2;
    const y = at.y - RISE - size / 2;
    for (const [index, box] of [fewer, count, more, yes].entries()) {
      const width = widths[index] ?? size;
      const x = left + width / 2;
      box.rect.setPosition(x, y);
      if (box === count) {
        // The thing to the left of its number, both inside the one box.
        const [picture, text] = box.parts;
        picture?.setPosition(x - COUNT_WIDTH / 2 + PAD + ICON / 2, y);
        text?.setPosition(x - COUNT_WIDTH / 2 + PAD + ICON + PAD, y);
      } else {
        for (const part of box.parts) part.setPosition(x, y);
      }
      left += width + GAP;
    }

    this.wire(fewer, -1);
    this.wire(more, 1);
    yes.rect.on("pointerdown", () => {
      yes.rect.setStrokeStyle(2, PRESSED_STROKE, 1);
      const chosen = this.choose;
      const count = this.chosen;
      this.close();
      chosen?.(count);
    });
    this.show();
  }

  /** Where each button is, by name, so a script can press one. */
  buttonPositions(): Record<string, { x: number; y: number }> {
    const positions: Record<string, { x: number; y: number }> = {};
    for (const box of this.boxes) {
      if (box.name) positions[box.name] = { x: box.rect.x, y: box.rect.y };
    }
    return positions;
  }

  close(): void {
    this.stopHolding();
    for (const box of this.boxes) {
      box.rect.destroy();
      for (const part of box.parts) part.destroy();
    }
    this.boxes = [];
    this.label = null;
    this.choose = null;
  }

  destroy(): void {
    this.close();
  }

  private box(name: string | null, width: number, height: number, parts: Part[]): Box {
    const rect = this.scene.add
      .rectangle(0, 0, width, height, FILL, FILL_ALPHA)
      .setStrokeStyle(2, STROKE, 0.9);
    if (name) rect.setInteractive({ useHandCursor: true });
    for (const part of [rect, ...parts]) {
      part.setScrollFactor(0).setDepth(this.depth + (part === rect ? 0 : 1));
      this.register(part);
    }
    const box = { rect, parts, name: name ?? "" };
    this.boxes.push(box);
    return box;
  }

  /** A button that steps the number once on a tap, and keeps stepping while held. */
  private wire(box: Box, direction: 1 | -1): void {
    box.rect.on("pointerdown", () => {
      this.step(direction, 0);
      this.stopHolding();
      let repeats = 0;
      const again = () => {
        repeats++;
        this.step(direction, repeats);
      };
      // One wait, then the run: a tap that lifts before the wait is over
      // has stepped exactly once.
      this.holding = this.scene.time.addEvent({
        delay: HOLD_BEFORE_MS,
        callback: () => {
          again();
          this.holding = this.scene.time.addEvent({
            delay: HOLD_EVERY_MS,
            loop: true,
            callback: again,
          });
        },
      });
    });
    for (const event of ["pointerup", "pointerout", "pointerupoutside"]) {
      box.rect.on(event, () => this.stopHolding());
    }
  }

  private step(direction: 1 | -1, repeats: number): void {
    const by = repeats >= STEPS_BEFORE_TENS ? 10 : repeats >= STEPS_BEFORE_FIVES ? 5 : 1;
    this.chosen = Math.max(1, Math.min(this.most, this.chosen + direction * by));
    this.show();
  }

  private stopHolding(): void {
    this.holding?.remove(false);
    this.holding = null;
  }

  private show(): void {
    this.label?.setText(String(this.chosen));
  }
}
