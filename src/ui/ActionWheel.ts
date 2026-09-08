// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import { ACTIVE_HEX, INK_HEX, PAPER_PALE_HEX } from "./parchment";

/**
 * The ring of choices that opens over a thing when it is tapped: what shall
 * I do with it?
 *
 * A tap on a bench used to *be* the answer — it went into the basket — and
 * that made every piece of furniture a thing to carry rather than a thing to
 * have. Now the tap asks. Two round buttons appear over the bench, one for
 * using it and one for taking it, and the next tap says which.
 *
 * **Round, and in a ring, on purpose.** The patch menu is a row of square
 * boards, and it is a row because it is a list of spells. This is not a
 * list; it is the thing's own little halo of things that can be done to it,
 * and a ring round the thing says *about this one* in a way a row hanging
 * above it does not. The buttons are round so they cannot be mistaken for
 * the tray's, which are square and live in a corner.
 *
 * **Pictures, never words.** The basket is what a taken thing goes into, so
 * the basket is the picture for taking; the glad face is the one this game
 * already uses for *that went well*, so it is the picture for using. Both
 * are pictures a child has met before this menu opens.
 *
 * Not modal. A tap anywhere else closes it and does nothing more, and she
 * cannot walk with it open — walking is a different thing to want. It is
 * built fresh every time it opens, like the patch menu and for the same
 * reason: a menu whose contents depend on what was tapped is one where a
 * pooled button is a button left over from last time.
 */

const FILL = INK_HEX;
const FILL_ALPHA = 0.85;
const STROKE = PAPER_PALE_HEX;
const STROKE_ALPHA = 0.85;
/** The one that was just pressed, for the frame or two before it all goes. */
const PRESSED_STROKE = ACTIVE_HEX;

/** How big a picture is drawn on a button, and the button round it. */
const ICON = 24;
const RADIUS = 22;
/** How far from the thing's own point the buttons stand. */
const RING = 40;
/** How long the ring takes to bloom open. */
const BLOOM_MS = 110;

export interface WheelChoice<TAction extends string> {
  readonly action: TAction;
  /** The texture key of the picture on the button. */
  readonly icon: string;
}

interface Spoke {
  readonly disc: Phaser.GameObjects.Arc;
  readonly icon: Phaser.GameObjects.Image;
  readonly action: string;
  /** Where the button comes to rest once it has bloomed out. */
  readonly rest: { x: number; y: number };
}

export class ActionWheel<TAction extends string> {
  private spokes: Spoke[] = [];
  private choose: ((action: TAction) => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depth: number,
    private readonly register: (object: Phaser.GameObjects.GameObject) => void,
  ) {}

  get isOpen(): boolean {
    return this.spokes.length > 0;
  }

  /**
   * Open the ring round a point on screen.
   *
   * The choices are spread over the *upper* half of a circle round the
   * point, left to right. Upper, because the finger that tapped the thing
   * is still over it and the thing is what the buttons are about: a button
   * under the finger would be pressed by the tap that opened it, and a
   * button over the thing would hide it.
   */
  openAt(
    at: { x: number; y: number },
    choices: readonly WheelChoice<TAction>[],
    onChoose: (action: TAction) => void,
  ): void {
    this.close();
    this.choose = onChoose;
    const add = this.scene.add;
    const count = choices.length;
    for (const [index, choice] of choices.entries()) {
      // Evenly round the top half: one choice sits straight up, two sit at
      // ten and two o'clock, three at nine, twelve and three.
      const angle = count === 1 ? -Math.PI / 2 : -Math.PI + (Math.PI * index) / (count - 1);
      const x = at.x + Math.cos(angle) * RING;
      const y = at.y + Math.sin(angle) * RING;
      const disc = add
        .circle(x, y, RADIUS, FILL, FILL_ALPHA)
        .setStrokeStyle(2, STROKE, STROKE_ALPHA)
        .setInteractive({ useHandCursor: true });
      const icon = add.image(x, y, choice.icon).setDisplaySize(ICON, ICON);
      disc.on("pointerdown", () => {
        disc.setStrokeStyle(2, PRESSED_STROKE, 1);
        const chosen = this.choose;
        this.close();
        chosen?.(choice.action);
      });
      for (const part of [disc, icon]) {
        part.setScrollFactor(0).setDepth(this.depth + (part === disc ? 0 : 1));
        this.register(part);
      }
      // Blooms out from the thing rather than appearing, so the eye is led
      // from what was tapped to what can be done with it.
      disc.setPosition(at.x, at.y).setScale(0.4);
      icon.setPosition(at.x, at.y).setScale(0.4);
      this.scene.tweens.add({
        targets: [disc, icon],
        x,
        y,
        scale: 1,
        duration: BLOOM_MS,
        ease: "Back.easeOut",
      });
      this.spokes.push({ disc, icon, action: choice.action, rest: { x, y } });
    }
  }

  /** Where each button will come to rest, by action, so a script can press one. */
  buttonPositions(): Record<string, { x: number; y: number }> {
    const positions: Record<string, { x: number; y: number }> = {};
    // Where it is going rather than where it is this frame: a script that
    // read positions during the bloom would be handed a button halfway to
    // where it will be by the time the tap lands.
    for (const spoke of this.spokes) positions[spoke.action] = spoke.rest;
    return positions;
  }

  close(): void {
    for (const spoke of this.spokes) {
      this.scene.tweens.killTweensOf([spoke.disc, spoke.icon]);
      spoke.disc.destroy();
      spoke.icon.destroy();
    }
    this.spokes = [];
    this.choose = null;
  }

  destroy(): void {
    this.close();
  }
}
