// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import type { Phrases } from "../i18n/phrases";
import {
  GeometryBeat,
  geometryBeatsFor,
  geometryLessonFor,
  squaresOf,
} from "../spells/geometryLesson";
import { type PortalJourney, type PortalRung, portalRungAt } from "../spells/portal";
import { PagedPanel } from "./PagedPanel";
import type { PanelRect } from "./ParchmentPanel";
import { UiAsset, type UiIndex } from "./assets";
import { INK, INK_HEX, RULE_HEX } from "./parchment";

/**
 * What the geometer shows you: the portal spell, in four pictures.
 *
 * The sibling of `LessonPanel`, and deliberately built the same way — one
 * idea per screen, each with a diagram, and the numbers taken from a journey
 * built by the spell's own code so that what he teaches cannot drift from
 * what the spell sets.
 *
 * The diagram is the *same triangle* on all three of the last pages, gaining
 * one thing each time: the ruler, then the two legs measured along it, then
 * the straight line across. Redrawing a different picture per page would
 * make three ideas out of what is one idea seen three times.
 */

const PATH_HEX = 0x2f6f9e;
const CROW_HEX = 0xa8321e;
const MARK_HEX = 0xa8321e;
const HERE_HEX = 0xffffff;

const SMALL_SIZE = 12;
const TICK = 4;
const MARK_SIZE = 7;
/** How big a stepping stone is drawn, in radius. See `drawStones`. */
const STONE_SIZE = 5;

export class GeometryLessonPanel extends PagedPanel<GeometryBeat> {
  /**
   * Which ruling this child is being given, so he teaches on it.
   *
   * The same reason the addition teacher takes a rung: a lesson worked
   * through in twenty-mark numbers, at a child whose map is ten marks
   * across, is a method demonstrated on a picture they have never seen.
   */
  private rung: PortalRung = portalRungAt(0);

  private readonly caption: Phaser.GameObjects.Text;
  /** Numbers along the two rulers, and on the three sides of the triangle. */
  private readonly ticks: Phaser.GameObjects.Text[] = [];
  private readonly sides: Phaser.GameObjects.Text[] = [];

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
    this.caption = this.own(this.dimText("", SMALL_SIZE).setOrigin(0.5, 1));
    for (let n = 0; n < TICK_LABELS; n++) {
      this.ticks.push(this.own(this.dimText("", SMALL_SIZE - 1).setOrigin(0.5)));
    }
    for (let n = 0; n < 3; n++) {
      this.sides.push(this.own(this.text("", SMALL_SIZE, INK).setOrigin(0.5)));
    }
  }

  setRung(rung: PortalRung): void {
    this.rung = rung;
    if (this.isOpen) this.layout();
  }

  private example(): PortalJourney {
    return geometryLessonFor(this.rung);
  }

  /**
   * Only the pages this child's own spell asks for. See `geometryBeatsFor`.
   *
   * A playtest found him working through the crow's flight at a child whose
   * spell asks her to count stepping stones.
   */
  protected deck(): readonly GeometryBeat[] {
    // `?? portalRungAt(0)` is not belt and braces. The base class asks for
    // the deck from inside its own constructor, which runs *before* this
    // subclass's fields are initialised — so `this.rung` is genuinely
    // undefined for that one call, whatever its type says. Without this the
    // whole game failed to boot on `undefined.tier`, and the class field
    // above reads as if it could not possibly.
    return geometryBeatsFor(this.rung ?? portalRungAt(0));
  }

  protected titleText(): string {
    return this.words.geometryLessonTitle;
  }

  protected bodyText(beat: GeometryBeat): string {
    const journey = this.example();
    const across = this.words.portalCompass(journey.across.towards);
    const down = this.words.portalCompass(journey.down.towards);
    switch (beat) {
      case GeometryBeat.Rune:
        return this.words.geometryRune;
      case GeometryBeat.Stones:
        return this.words.geometryStones(journey.across.marks + journey.down.marks);
      case GeometryBeat.Ruler:
        return this.words.geometryRuler(journey.league);
      case GeometryBeat.Legs:
        return this.words.geometryLegs(
          across,
          journey.across.marks,
          down,
          journey.down.marks,
          journey.across.marks + journey.down.marks,
        );
      default:
        return this.words.geometryCrow(
          journey.across.marks,
          journey.down.marks,
          squaresOf(journey),
          Math.round(Math.hypot(journey.across.marks, journey.down.marks)),
        );
    }
  }

  protected drawArt(rect: PanelRect, top: number, bottom: number, beat: GeometryBeat): void {
    if (beat === GeometryBeat.Rune) {
      this.drawIcons(rect, (top + bottom) / 2, [UiAsset.Spellbook, UiAsset.RunePortal]);
      return;
    }
    if (beat === GeometryBeat.Stones) {
      this.drawStones(rect, top, bottom);
      return;
    }
    this.drawTriangle(rect, top, bottom, beat);
  }

  /**
   * The way as the bottom rung's own map draws it: two legs, and a stone on
   * every league of them.
   *
   * Deliberately *not* the ruled corner the other three pages share. This is
   * the whole point of the page: a child who is asked how many stones there
   * are has no ruler on their map and no numeral to read off one, and
   * drawing them a graduated axis is showing them the instrument belonging
   * to the rung above. Nothing here is numbered — the counting is the answer
   * and printing it would be doing it for them.
   *
   * The stones are laid the way `stonesAlong` lays them, corner counted
   * once, so a child holding the page beside their own map counts the same
   * number twice. That is the only property of this drawing worth having.
   */
  private drawStones(rect: PanelRect, top: number, bottom: number): void {
    const journey = this.example();
    const across = journey.across.marks;
    const down = journey.down.marks;
    const room = {
      width: Math.min(rect.width - 96, 260),
      height: Math.max(40, bottom - top - 30),
    };
    const step = Math.min(room.width / Math.max(1, across), room.height / Math.max(1, down));
    const width = step * across;
    const height = step * down;
    const left = rect.centreX - width / 2 + 10;
    const foot = top + (bottom - top + height) / 2 - 12;
    const head = foot - height;

    // The path itself, faint: the stones are the subject and the line is
    // only there to say which order they come in.
    this.ink.lineStyle(2, RULE_HEX, 1);
    this.ink.lineBetween(left, foot, left + width, foot);
    this.ink.lineBetween(left + width, foot, left + width, head);

    for (let mark = 1; mark <= across; mark++) {
      this.stone(left + mark * step, foot);
    }
    for (let mark = 1; mark <= down; mark++) {
      this.stone(left + width, foot - mark * step);
    }

    // Where she is standing, which is not a stone: the corner is nought and
    // counting starts at the one after it.
    this.ink.fillStyle(INK_HEX, 1);
    this.ink.fillRect(
      left - MARK_SIZE / 2 - 1,
      foot - MARK_SIZE / 2 - 1,
      MARK_SIZE + 2,
      MARK_SIZE + 2,
    );
    this.ink.fillStyle(HERE_HEX, 1);
    this.ink.fillRect(left - MARK_SIZE / 2, foot - MARK_SIZE / 2, MARK_SIZE, MARK_SIZE);

    this.caption.setVisible(false);
  }

  /** One stepping stone: a filled circle with a rim, so it reads as laid. */
  private stone(x: number, y: number): void {
    this.ink.fillStyle(PATH_HEX, 1);
    this.ink.fillCircle(x, y, STONE_SIZE);
    this.ink.lineStyle(1, INK_HEX, 1);
    this.ink.strokeCircle(x, y, STONE_SIZE);
  }

  /**
   * The journey as a right triangle, on a ruled corner.
   *
   * Laid out from the *marks* rather than from the pixels available, so the
   * picture is to scale: a three-four-five triangle drawn with equal legs
   * would be a diagram of a different theorem. The longer leg takes the
   * width and the shorter one is drawn at the same marks-per-pixel, which is
   * what makes the crow's flight visibly shorter than going round — the one
   * thing the last page is about.
   */
  private drawTriangle(rect: PanelRect, top: number, bottom: number, beat: GeometryBeat): void {
    const journey = this.example();
    const across = journey.across.marks;
    const down = journey.down.marks;
    const room = {
      width: Math.min(rect.width - 96, 260),
      height: Math.max(40, bottom - top - 30),
    };
    // One scale for both axes. Two would draw a right triangle that is not
    // the child's right triangle.
    const step = Math.min(room.width / Math.max(1, across), room.height / Math.max(1, down));
    const width = step * across;
    const height = step * down;
    const left = rect.centreX - width / 2 + 10;
    const foot = top + (bottom - top + height) / 2 - 12;
    const head = foot - height;

    // The rulers: the corner the traveller stands in, counting outward.
    this.ink.lineStyle(1, RULE_HEX, 1);
    this.ink.lineBetween(left, foot + TICK + 2, left + width, foot + TICK + 2);
    this.ink.lineBetween(left - TICK - 2, foot, left - TICK - 2, head);
    let slot = 0;
    const every = (count: number) => Math.max(1, Math.ceil(count / 5));
    for (let mark = 0; mark <= across; mark += every(across)) {
      const x = left + mark * step;
      this.ink.lineBetween(x, foot + 2, x, foot + TICK + 2);
      this.ticks[slot++]
        ?.setText(String(mark))
        .setPosition(x, foot + TICK + 11)
        .setVisible(true);
    }
    for (let mark = 0; mark <= down; mark += every(down)) {
      const y = foot - mark * step;
      this.ink.lineBetween(left - TICK - 2, y, left - 2, y);
      this.ticks[slot++]
        ?.setText(String(mark))
        .setPosition(left - TICK - 12, y)
        .setVisible(true);
    }

    // The two legs, from the third page onward. On the ruler page the corner
    // is bare on purpose: that page is about the instrument, and a journey
    // drawn across it is a second thing to look at.
    if (beat !== GeometryBeat.Ruler) {
      this.ink.lineStyle(3, PATH_HEX, 1);
      this.ink.lineBetween(left, foot, left + width, foot);
      this.ink.lineBetween(left + width, foot, left + width, head);
      this.sides[0]
        ?.setText(String(across))
        .setPosition(left + width / 2, foot - 12)
        .setVisible(true);
      this.sides[1]
        ?.setText(String(down))
        .setPosition(left + width + 12, foot - height / 2)
        .setVisible(true);
    }

    // And the crow's flight on the last page, drawn over them.
    if (beat === GeometryBeat.Crow) {
      this.ink.lineStyle(3, CROW_HEX, 1);
      this.ink.lineBetween(left, foot, left + width, head);
      this.sides[2]
        ?.setText(String(Math.round(Math.hypot(across, down))))
        .setPosition(left + width / 2 - 16, foot - height / 2 - 12)
        .setVisible(true);
    }

    // The two ends: you, and where you are going. Drawn last so neither line
    // runs over them.
    this.ink.fillStyle(INK_HEX, 1);
    this.ink.fillRect(
      left - MARK_SIZE / 2 - 1,
      foot - MARK_SIZE / 2 - 1,
      MARK_SIZE + 2,
      MARK_SIZE + 2,
    );
    this.ink.fillStyle(HERE_HEX, 1);
    this.ink.fillRect(left - MARK_SIZE / 2, foot - MARK_SIZE / 2, MARK_SIZE, MARK_SIZE);
    this.ink.fillStyle(MARK_HEX, 1);
    this.ink.fillRect(left + width - MARK_SIZE / 2, head - MARK_SIZE / 2, MARK_SIZE, MARK_SIZE);

    // No scale caption under the drawing: the ruler page says what a mark is
    // worth in words, and printing it again here laid a second row of small
    // text across the ruler's own numbers.
    this.caption.setVisible(false);
  }
}

/**
 * How many ruler numbers the panel makes room for.
 *
 * Six a side at most — the drawing numbers every mark on the coarsest ruler
 * and every fifth on the finest — plus slack, because running out mid-draw
 * would leave a ruler with no numbers on it and nothing to say why.
 */
const TICK_LABELS = 16;
