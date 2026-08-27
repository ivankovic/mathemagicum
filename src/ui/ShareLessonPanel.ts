// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import type { Phrases } from "../i18n/phrases";
import {
  ShareBeat as Beat,
  type ShareBeat,
  type ShareProblem,
  type ShareRung,
  shareBeatsFor,
  shareLessonFor,
  shareRungAt,
} from "../spells/division";
import { PagedPanel } from "./PagedPanel";
import type { PanelRect } from "./ParchmentPanel";
import { UiAsset, type UiIndex } from "./assets";
import { INK, RULE_HEX } from "./parchment";

/**
 * What the fisherman shows you: the sharing spell, in pictures.
 *
 * The fourth of these and built the same way as the other three — one idea
 * per screen, a drawing on each, and the numbers taken from the spell's own
 * generator so what he teaches cannot drift from what the spell sets.
 *
 * The drawing is the *same heap* on all three of the last pages, doing one
 * more thing each time: the pile whole, the pile going round the baskets,
 * and the pile with what would not go still sitting in it. Three unrelated
 * pictures would make three ideas out of what is one heap seen three times,
 * which is the argument the grove's panel is built on.
 */

const CROP_HEX = 0x5f8f3a;
const CROP_DEALT_HEX = 0x2f5c1c;
const OVER_HEX = 0xa8321e;

const SMALL_SIZE = 12;
const CROP = 11;
const CROP_GAP = 4;
/** How wide a heap is laid out before it starts a second row. */
const HEAP_WIDE = 6;

export class ShareLessonPanel extends PagedPanel<ShareBeat> {
  /**
   * Which share this child is being shown, so he teaches on it.
   *
   * The same reason the other three lessons take a rung: a method worked
   * through on twenty-three shared five ways, at a child whose own spell
   * deals six into two, is a method demonstrated on a question they have
   * never seen.
   */
  private rung: ShareRung = shareRungAt(0);

  private readonly caption: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    index: UiIndex,
    depth: number,
    words: Phrases,
    register: (object: Phaser.GameObjects.GameObject) => void,
  ) {
    super(scene, index, depth, words, register, {
      maxWidth: 470,
      maxHeight: 420,
      minWidth: 300,
      minHeight: 310,
      icons: 2,
    });
    this.caption = this.own(this.text("", SMALL_SIZE, INK).setOrigin(0.5, 0));
  }

  setRung(rung: ShareRung): void {
    this.rung = rung;
    if (this.isOpen) this.layout();
  }

  /**
   * The share he works through: chosen, not rolled. See `shareLessonFor`.
   *
   * All three drawings are the same heap, so they have to *be* the same
   * heap — and a rolled one would deal a different pile every time the panel
   * laid itself out, which on a phone being turned round is twice a second.
   */
  private example(): ShareProblem {
    return shareLessonFor(this.rung ?? shareRungAt(0));
  }

  protected deck(): readonly ShareBeat[] {
    return shareBeatsFor(this.rung ?? shareRungAt(0));
  }

  protected titleText(): string {
    return this.words.shareLessonTitle;
  }

  protected bodyText(beat: ShareBeat): string {
    const { total, parts, each, left } = this.example();
    switch (beat) {
      case Beat.Rune:
        return this.words.shareRune;
      case Beat.Heap:
        return this.words.shareHeap(total, parts);
      case Beat.Deal:
        return this.words.shareDeal(total, parts, each);
      default:
        return this.words.shareOver(left, parts);
    }
  }

  protected drawArt(rect: PanelRect, top: number, bottom: number, beat: ShareBeat): void {
    this.caption.setVisible(false);
    if (beat === Beat.Rune) {
      this.drawIcons(rect, (top + bottom) / 2, [UiAsset.Spellbook, UiAsset.RuneDivide]);
      return;
    }
    this.drawHeap(rect, top, bottom, beat);
  }

  /**
   * The heap, and how much of it has gone into the baskets.
   *
   * One drawing with a page number in it rather than three drawings. On the
   * heap page nothing is dealt and the baskets stand empty; on the dealing
   * page they are full and the heap holds only what would not go; on the
   * leftovers page the same picture again with those few picked out in red,
   * because *that* is the page's whole idea and it is already on the sheet.
   */
  private drawHeap(rect: PanelRect, top: number, bottom: number, beat: ShareBeat): void {
    const { total, parts, each, left } = this.example();
    const dealt = beat === Beat.Heap ? 0 : parts;
    const inHeap = total - dealt * each;
    const step = CROP + CROP_GAP;

    // The heap on top and the baskets under it, and the baskets always in
    // the same place: a row that moved as it filled would be a picture a
    // child had to find again on every page.
    const basketTop = Math.round((top + bottom) / 2) + 6;
    const rows = Math.max(1, Math.ceil(inHeap / HEAP_WIDE));
    const wide = Math.min(HEAP_WIDE, Math.max(1, inHeap));
    const heapLeft = rect.centreX - (wide * step) / 2;
    const heapTop = basketTop - 14 - rows * step;
    for (let n = 0; n < inHeap; n++) {
      // The ones that would not go are the point of the last page, so they
      // are the one thing on it drawn in another colour.
      this.ink.fillStyle(beat === Beat.Over ? OVER_HEX : CROP_HEX, 1);
      this.ink.fillCircle(
        heapLeft + (n % wide) * step + step / 2,
        heapTop + Math.floor(n / wide) * step + step / 2,
        CROP / 2,
      );
    }

    const count = Math.max(1, parts);
    const basketW = Math.min(66, Math.floor((rect.width - 60 - (count - 1) * 6) / count));
    const basketH = Math.max(24, Math.min(60, bottom - basketTop - 8));
    const rowLeft = rect.centreX - (count * basketW + (count - 1) * 6) / 2;
    for (let n = 0; n < count; n++) {
      const x = rowLeft + n * (basketW + 6);
      const full = n < dealt;
      this.ink.lineStyle(2, full ? CROP_DEALT_HEX : RULE_HEX, 1);
      this.ink.beginPath();
      this.ink.moveTo(x, basketTop);
      this.ink.lineTo(x + basketW * 0.12, basketTop + basketH);
      this.ink.lineTo(x + basketW * 0.88, basketTop + basketH);
      this.ink.lineTo(x + basketW, basketTop);
      this.ink.strokePath();
      if (!full) continue;
      const across = Math.min(3, Math.max(1, each));
      const inStep = Math.max(7, Math.min(step, Math.floor((basketW - 10) / across)));
      const inLeft = x + basketW / 2 - (across * inStep) / 2;
      const inTop = basketTop + basketH - 5 - Math.ceil(each / across) * inStep;
      this.ink.fillStyle(CROP_DEALT_HEX, 1);
      for (let crop = 0; crop < each; crop++) {
        this.ink.fillCircle(
          inLeft + (crop % across) * inStep + inStep / 2,
          inTop + Math.floor(crop / across) * inStep + inStep / 2,
          Math.max(3, inStep - CROP_GAP) / 2,
        );
      }
    }

    // No caption under it. The body text above says the numbers, and a
    // second row of small type saying them again is a second thing to read.
    this.caption.setVisible(false);
  }
}
