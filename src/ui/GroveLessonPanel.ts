// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import type { Phrases } from "../i18n/phrases";
import { GROVE_BEATS, GroveBeat, groveLessonFor } from "../spells/groveLesson";
import {
  type ArrayProblem,
  type ArrayRung,
  arrayRungAt,
  rowTotals,
} from "../spells/multiplication";
import { type GroveProgress, GroveTask } from "../world/enchantedForest";
import { PagedPanel } from "./PagedPanel";
import type { PanelRect } from "./ParchmentPanel";
import { UiAsset, type UiIndex } from "./assets";

/**
 * What the great tree shows you: the array spell, in four pictures.
 *
 * The sibling of `LessonPanel` and `GeometryLessonPanel`, and deliberately
 * built the same way — one idea per screen, a diagram on each, and the
 * numbers taken from the spell's own code so what the tree teaches cannot
 * drift from what the spell sets.
 *
 * The diagram is the *same patch* on all three of the last pages, seen
 * differently each time: rows picked out, then counted, then turned on its
 * side. Drawing three unrelated pictures would make three ideas out of what
 * is one patch looked at three ways — which is the whole lesson.
 */

const INK = "#4a3422";
const RULE_HEX = 0x8a6a48;
const SEED_HEX = 0x5f8f3a;
const SEED_COUNTED_HEX = 0x2f5c1c;
const ROW_HEX = 0x2f6f9e;
/** The task page: bare earth, a ripe square, and the wood still on it. */
const EARTH_HEX = 0x7a5433;
const RIPE_HEX = 0xd2611b;
const THICKET_HEX = 0x2f5c1c;
const BED_CELL = 26;
const BED_GAP = 3;
/** Coprime with the twelve squares of the bed, so the wood does not clump. */
const THICKET_STRIDE = 5;

const SMALL_SIZE = 12;
// The biggest patch the ladder can set is ten rows deep, so ten labels are
// enough for the running totals down the side.
const ROW_LABELS = 10;
const DOT_MAX = 14;
const DOT_MIN = 6;
const DOT_GAP = 6;
const TOTALS_GAP = 8;
const TOTALS_W = 34;

export class GroveLessonPanel extends PagedPanel<GroveBeat> {
  /**
   * Which patch this child is being shown, so the tree teaches on it.
   *
   * The same reason the other two lessons take a rung: a method worked
   * through on a nine-by-eight, at a child whose spell sets two-by-fours, is
   * a method demonstrated on a picture they have never seen.
   */
  private rung: ArrayRung = arrayRungAt(0);

  /**
   * How far the tree's own task has got, so the first page can say it.
   *
   * Null until the scene has read it off the world, which it does every time
   * this opens — the task keeps no state anywhere else, and a panel holding
   * its own copy would be a second place for it to be wrong.
   */
  private progress: GroveProgress | null = null;
  /** The shape of the bed, so the picture is the bed and not a grid. */
  private bed = { rows: 3, columns: 4 };

  /** The running total beside each row, and the label under the patch. */
  private readonly totals: Phaser.GameObjects.Text[] = [];
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
    for (let n = 0; n < ROW_LABELS; n++) {
      this.totals.push(this.own(this.dimText("", SMALL_SIZE - 1).setOrigin(0, 0.5)));
    }
    this.caption = this.own(this.text("", SMALL_SIZE, INK).setOrigin(0.5, 0));
  }

  setRung(rung: ArrayRung): void {
    this.rung = rung;
    if (this.isOpen) this.layout();
  }

  setTask(progress: GroveProgress, bed: { rows: number; columns: number }): void {
    this.progress = progress;
    this.bed = bed;
    if (this.isOpen) this.layout();
  }

  private example(): ArrayProblem {
    return groveLessonFor(this.rung);
  }

  protected deck(): readonly GroveBeat[] {
    return GROVE_BEATS;
  }

  protected titleText(beat: GroveBeat): string {
    return beat === GroveBeat.Task ? this.words.groveTaskTitle : this.words.groveLessonTitle;
  }

  protected bodyText(beat: GroveBeat): string {
    const { rows, columns } = this.example();
    switch (beat) {
      case GroveBeat.Task: {
        const progress = this.progress;
        if (!progress) return this.words.groveLessonTitle;
        const asked = this.words.groveAsks(progress);
        // The bargain only while there is still something to do. Offered to
        // a child who has already finished, it would read as a second task.
        return progress.task === GroveTask.Done ? asked : `${asked}\n\n${this.words.groveBargain}`;
      }
      case GroveBeat.Rune:
        return this.words.groveRune;
      case GroveBeat.Rows:
        return this.words.groveRows(rows, columns);
      case GroveBeat.Count:
        return this.words.groveCount(rows, columns, rows * columns);
      default:
        return this.words.groveTurn(rows, columns, rows * columns);
    }
  }

  protected drawArt(rect: PanelRect, top: number, bottom: number, beat: GroveBeat): void {
    for (const total of this.totals) total.setVisible(false);
    this.caption.setVisible(false);
    if (beat === GroveBeat.Task) {
      this.drawBed(rect, top, bottom);
      return;
    }
    if (beat === GroveBeat.Rune) {
      this.drawIcons(rect, (top + bottom) / 2, [UiAsset.Spellbook, UiAsset.RuneTimes]);
      return;
    }
    this.drawPatch(rect, top, bottom, beat);
  }

  /**
   * The bed as it actually stands, which is the task in one picture.
   *
   * The same rectangle the lesson goes on to teach about — twelve squares,
   * four by three — so the thing the child is being asked to fill and the
   * thing the parchment later draws are visibly one object. Ripe squares are
   * filled; the rest are bare earth; and while the wood is still standing it
   * is drawn over the top, because that is the order the work has to be done
   * in and a picture that showed the bed clear would be a picture of a job
   * already half finished.
   */
  private drawBed(rect: PanelRect, top: number, bottom: number): void {
    const progress = this.progress;
    if (!progress) return;
    const { rows, columns } = this.bed;
    const step = BED_CELL + BED_GAP;
    const gridW = step * columns - BED_GAP;
    const gridH = step * rows - BED_GAP;
    const left = Math.round(rect.centreX - gridW / 2);
    const gridTop = Math.round(top + Math.max(0, (bottom - top - gridH) / 2) - 6);

    for (let n = 0; n < rows * columns; n++) {
      const x = left + (n % columns) * step;
      const y = gridTop + Math.floor(n / columns) * step;
      this.ink.fillStyle(EARTH_HEX, 1);
      this.ink.fillRect(x, y, BED_CELL, BED_CELL);
      if (n < progress.ripe) {
        this.ink.fillStyle(RIPE_HEX, 1);
        this.ink.fillCircle(x + BED_CELL / 2, y + BED_CELL / 2, BED_CELL / 2 - 5);
      }
    }
    this.ink.lineStyle(1, RULE_HEX, 1);
    this.ink.strokeRect(left - 4, gridTop - 4, gridW + 8, gridH + 8);

    // The wood, laid across the bed rather than beside it, one thicket to a
    // square. Stepped by five rather than by one: five and twelve share no
    // factor, so six thickets land on six squares spread over the bed
    // instead of filling the first six in a block — which would read as a
    // bed half planted rather than as a bed with wood standing on it.
    if (progress.task === GroveTask.Overgrown) {
      const cells = Math.max(1, rows * columns);
      this.ink.fillStyle(THICKET_HEX, 0.92);
      for (let n = 0; n < progress.standing; n++) {
        const cell = (n * THICKET_STRIDE) % cells;
        const x = left + (cell % columns) * step + BED_CELL / 2;
        const y = gridTop + Math.floor(cell / columns) * step + BED_CELL / 2;
        this.ink.fillCircle(x, y, BED_CELL / 2 - 3);
      }
    }

    this.caption
      .setText(
        progress.task === GroveTask.Overgrown
          ? String(progress.standing)
          : `${progress.ripe} / ${progress.squares}`,
      )
      .setPosition(rect.centreX, gridTop + gridH + 10)
      .setVisible(true);
  }

  /**
   * The patch, as dots.
   *
   * One step for both axes, always: the point of the last page is that the
   * *same* patch turned round holds the same number, and a picture that
   * stretched to fill the panel would draw the turned patch at a different
   * scale and quietly undo the argument.
   */
  private drawPatch(rect: PanelRect, top: number, bottom: number, beat: GroveBeat): void {
    const patch = this.example();
    // The last page turns it: columns become rows. Same dots, same order,
    // read the other way — which is what the page says in words.
    const turned = beat === GroveBeat.Turn;
    const rows = turned ? patch.columns : patch.rows;
    const columns = turned ? patch.rows : patch.columns;

    const room = {
      width: Math.min(rect.width - 96, 260) - TOTALS_GAP - TOTALS_W,
      height: Math.max(40, bottom - top - 24),
    };
    const step = Math.max(
      DOT_MIN + DOT_GAP,
      Math.min(DOT_MAX + DOT_GAP, Math.floor(room.width / columns), Math.floor(room.height / rows)),
    );
    const dot = Math.max(DOT_MIN, step - DOT_GAP);
    const gridW = step * columns;
    const gridH = step * rows;
    const left = Math.round(rect.centreX - gridW / 2);
    const gridTop = Math.round(top + Math.max(0, (bottom - top - gridH) / 2) - 6);

    // On the counting page every row is counted; on the rows page none are,
    // because that page is about seeing the rows and a running total on it
    // is a second thing to look at.
    const counted = beat === GroveBeat.Rows ? 0 : rows;

    for (let row = 0; row < rows; row++) {
      this.ink.fillStyle(row < counted ? SEED_COUNTED_HEX : SEED_HEX, 1);
      for (let col = 0; col < columns; col++) {
        this.ink.fillCircle(left + col * step + step / 2, gridTop + row * step + step / 2, dot / 2);
      }
    }

    // A rule under each row, which is what picks the rows out as rows rather
    // than leaving a field of dots. Drawn on every page but the first,
    // because every page after that is about the rows.
    this.ink.lineStyle(1, ROW_HEX, 0.8);
    for (let row = 0; row < rows; row++) {
      const y = gridTop + row * step + step - 1;
      this.ink.lineBetween(left - 2, y, left + gridW + 2, y);
    }

    this.ink.lineStyle(1, RULE_HEX, 1);
    this.ink.strokeRect(left - 4, gridTop - 4, gridW + 8, gridH + 8);

    // The turned patch is a problem of its own for the sake of its running
    // totals: seven rows of six count up differently from six rows of seven,
    // which is the last page's whole argument.
    const running = rowTotals({ ...patch, rows, columns, given: 0 });
    for (const [row, label] of this.totals.entries()) {
      const show = row < counted;
      label.setVisible(show);
      if (!show) continue;
      label
        .setText(String(running[row]))
        .setPosition(left + gridW + TOTALS_GAP, gridTop + row * step + step / 2);
    }

    // The sum under the patch, in the orientation the page is drawing it —
    // which on the last page is the whole argument, printed twice over.
    if (beat !== GroveBeat.Rows) {
      this.caption
        .setText(`${rows} × ${columns} = ${rows * columns}`)
        .setPosition(rect.centreX, gridTop + gridH + 8)
        .setVisible(true);
    }
  }
}
