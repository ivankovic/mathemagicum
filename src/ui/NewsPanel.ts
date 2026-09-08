// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import type { Phrases } from "../i18n/phrases";
import { PagedPanel } from "./PagedPanel";
import type { PanelRect } from "./ParchmentPanel";
import type { UiIndex } from "./assets";
import { NEWS_BEATS, NEWS_ICONS, type NewsBeat } from "./news";

/**
 * The letter he brings: what has changed since this child last played.
 *
 * The welcome's panel with a different deck, deliberately — see `IntroPanel`
 * for why the second explanation a child meets is the same piece of
 * interface as the first, and this is the third.
 *
 * What is different is that the deck is **cut to the child**: it starts
 * where their `newsSeen` left off, so somebody who missed three releases
 * gets three pages in one visit and somebody who missed one gets one. The
 * panel is told where to start before it is opened, and `PagedPanel` is
 * built for a deck whose length is not known at construction.
 */
export class NewsPanel extends PagedPanel<NewsBeat> {
  /**
   * How many beats this child has already had.
   *
   * Undefined until it is told — `deck()` is asked once during construction,
   * before this field exists, and the whole list is the right answer there:
   * all it is used for at that point is sizing the pool of dots, which is
   * topped up at layout anyway.
   */
  private since: number | undefined;

  constructor(
    scene: Phaser.Scene,
    index: UiIndex,
    depth: number,
    words: Phrases,
    register: (object: Phaser.GameObjects.GameObject) => void,
  ) {
    super(scene, index, depth, words, register, {
      maxWidth: 450,
      maxHeight: 340,
      minWidth: 300,
      minHeight: 260,
      icons: 2,
    });
  }

  /** Say where this child's count has got to, before opening. */
  setSince(seen: number): void {
    this.since = Math.max(0, seen);
  }

  protected deck(): readonly NewsBeat[] {
    return NEWS_BEATS.slice(this.since ?? 0);
  }

  protected titleText(): string {
    return this.words.newsTitle;
  }

  protected bodyText(beat: NewsBeat): string {
    return this.words.news(beat);
  }

  protected drawArt(rect: PanelRect, top: number, bottom: number, beat: NewsBeat): void {
    this.drawIcons(rect, (top + bottom) / 2, NEWS_ICONS[beat]);
  }
}
