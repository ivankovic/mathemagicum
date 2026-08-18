// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import type { Phrases } from "../i18n/phrases";
import { PagedPanel } from "./PagedPanel";
import type { PanelRect } from "./ParchmentPanel";
import type { UiIndex } from "./assets";
import { INTRO_BEATS, INTRO_ICONS, type IntroBeat } from "./intro";

/**
 * The postal worker's round: four pages of what to do here.
 *
 * Same deck, buttons and dots as the teacher's lesson, deliberately — the
 * second explanation a child meets should not have to be learned as a piece
 * of interface. What differs is that every page here is two icons rather than
 * a diagram, because this is "which buttons are these" rather than "how does
 * the arithmetic work".
 */
export class IntroPanel extends PagedPanel<IntroBeat> {
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

  protected deck(): readonly IntroBeat[] {
    return INTRO_BEATS;
  }

  protected titleText(): string {
    return this.words.introTitle;
  }

  protected bodyText(beat: IntroBeat): string {
    return this.words.intro(beat);
  }

  protected drawArt(rect: PanelRect, top: number, bottom: number, beat: IntroBeat): void {
    this.drawIcons(rect, (top + bottom) / 2, INTRO_ICONS[beat]);
  }
}
