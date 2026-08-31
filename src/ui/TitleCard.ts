// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import type { Phrases } from "../i18n/phrases";
import { FACE } from "./parchment";

/**
 * The first thing on screen: the game's name, and how far the loading has
 * got.
 *
 * Drawn with nothing but rectangles and text, deliberately. This is the one
 * screen that cannot use the art set — it is what the player looks at *while*
 * that art is being fetched, and a title card built from the parchment would
 * be a title card that only appears once it is no longer needed.
 *
 * Two states. While the loader runs there is a bar; when it finishes the bar
 * is replaced by a prompt and the card waits to be dismissed. It waits rather
 * than starting by itself because a game that begins the instant the last
 * file lands begins at a moment the player did not choose — on a fast
 * connection that is before they have read the name of it.
 */

const GROUND = 0x12100f;
const INK = "#f6e8c4";
const INK_DIM = "#a8916a";
/** The one red in the game, and the same one a refused action is marked in. */
const FAILED = "#d8342a";
const BAR_TRACK = 0x3a2f22;
const BAR_FILL = 0xc8901c;
const BAR_EDGE = 0x6a5334;

const TITLE_SIZE = 44;
const TITLE_MIN_SIZE = 22;
const TAGLINE_SIZE = 14;
const PROMPT_SIZE = 15;
const BAR_WIDTH = 0.6;
const BAR_MAX_WIDTH = 420;
const BAR_HEIGHT = 14;
const BAR_GAP = 46;

/** The name of the game, which is a proper noun and the same in every language. */
export const GAME_NAME = "Mathemagicum";

export class TitleCard {
  private readonly ground: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly tagline: Phaser.GameObjects.Text;
  private readonly prompt: Phaser.GameObjects.Text;
  /** Set once something has failed to load, and never unset. */
  private failed = false;
  private readonly bar: Phaser.GameObjects.Graphics;

  private progress = 0;
  private done = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly words: Phrases,
  ) {
    const depth = 10_000;
    this.ground = scene.add
      .rectangle(0, 0, scene.scale.width, scene.scale.height, GROUND)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(depth);
    this.title = this.text(GAME_NAME, TITLE_SIZE, INK).setDepth(depth + 1);
    this.tagline = this.text(words.titleTagline, TAGLINE_SIZE, INK_DIM).setDepth(depth + 1);
    this.prompt = this.text(words.titleLoading, PROMPT_SIZE, INK_DIM).setDepth(depth + 1);
    this.bar = scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(depth + 1);
    this.layout();
  }

  /** How much of the load is done, from 0 to 1. */
  setProgress(fraction: number): void {
    this.progress = Math.max(0, Math.min(1, fraction));
    this.drawBar();
  }

  /**
   * What the loader is doing, under the bar.
   *
   * It said only "loading…" for a long time, which is fine right up until it
   * stops — and then it is the least useful line on the screen. A load that
   * has stalled looks exactly like a load that is slow, and neither the
   * player nor anybody they report it to can tell which.
   *
   * Ignored once the card is ready: the prompt is the invitation to begin by
   * then, and a late loader event overwriting it would leave the game asking
   * to be tapped without saying so.
   */
  setStatus(text: string): void {
    if (this.done) return;
    this.prompt.setText(text);
  }

  /** Something did not arrive. Named, and in the colour of a refusal. */
  setFailure(text: string): void {
    this.failed = true;
    this.prompt.setText(text).setColor(FAILED);
  }

  /** Everything is loaded: swap the bar for the prompt to begin. */
  ready(): void {
    this.done = true;
    this.progress = 1;
    // Not over a failure: if something did not arrive, saying "tap to
    // begin" is an invitation into a game that is missing a piece.
    if (!this.failed) this.prompt.setText(this.words.titlePlay).setColor(INK);
    this.drawBar();
  }

  layout(): void {
    const { width, height } = this.scene.scale;
    this.ground.setSize(width, height);
    // The name shrinks to fit a narrow screen rather than running off it: a
    // phone held upright is 360 CSS pixels and the word is twelve letters.
    this.title.setFontSize(TITLE_SIZE);
    for (let size = TITLE_SIZE; size > TITLE_MIN_SIZE && this.title.width > width - 40; size -= 2) {
      this.title.setFontSize(size - 2);
    }
    const middle = height / 2;
    this.title.setPosition(width / 2, middle - 60);
    this.tagline.setPosition(width / 2, middle - 10);
    this.prompt.setPosition(width / 2, middle + BAR_GAP + 30);
    this.drawBar();
  }

  private drawBar(): void {
    const { width, height } = this.scene.scale;
    const barWidth = Math.min(BAR_MAX_WIDTH, width * BAR_WIDTH);
    const left = (width - barWidth) / 2;
    const top = height / 2 + BAR_GAP;
    this.bar.clear();
    // Once the loading is done the bar has nothing left to say, and a full
    // bar sitting under a "tap to play" reads as something still to wait for.
    if (this.done) return;
    this.bar.fillStyle(BAR_TRACK, 1);
    this.bar.fillRect(left, top, barWidth, BAR_HEIGHT);
    this.bar.fillStyle(BAR_FILL, 1);
    this.bar.fillRect(left, top, barWidth * this.progress, BAR_HEIGHT);
    this.bar.lineStyle(2, BAR_EDGE, 1);
    this.bar.strokeRect(left, top, barWidth, BAR_HEIGHT);
  }

  private text(value: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.scene.add
      .text(0, 0, value, {
        fontFamily: FACE,
        fontSize: `${size}px`,
        color,
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
  }

  destroy(): void {
    this.ground.destroy();
    this.title.destroy();
    this.tagline.destroy();
    this.prompt.destroy();
    this.bar.destroy();
  }
}
