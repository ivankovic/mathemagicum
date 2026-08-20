// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import type { Phrases } from "../i18n/phrases";
import type { CastResult } from "../spells/cast";
import { castResult } from "../spells/cast";
import {
  type PortalCast,
  type PortalJourney,
  type PortalRung,
  type PortalStop,
  PortalTier,
  backspacePortal,
  beginPortalCast,
  canTravelTo,
  journeyBetween,
  markFraction,
  marksAcross,
  portalHint,
  stonesAlong,
  submitPortal,
  typePortalDigit,
} from "../spells/portal";
import type { AnchorPlacements } from "../world/anchors";
import type { WorldGrid } from "../world/grid";
import { minimapPoint, minimapSize } from "../world/minimap";
import type { GridPoint } from "../world/topdown";
import { PANEL_PAD as PAD, ParchmentPanel } from "./ParchmentPanel";
import { UiAsset, type UiIndex, uiTextureKey } from "./assets";
import { paintWorldMap } from "./worldMapTexture";

/**
 * The portal spell's parchment: a map with a ruler down each side.
 *
 * Two steps, and the order is the whole design. **Choose, then measure.**
 * The player is shown where they are and picks where to go; only then does
 * the spell rule the map and ask how far it is. Asking first would mean
 * measuring a journey nobody had decided to take, and the destination is
 * what makes the question worth answering.
 *
 * The rulers are ruled *from the traveller* at every rung but the last, so
 * the mark a place sits on is the distance to it and no subtraction stands
 * between a child and the number. The last rung rules them from the map's
 * western and northern edges, as a real map does, and finding the legs is
 * then the first thing to do rather than something the paper has done for
 * you.
 *
 * Everything it draws is in real screen pixels and belongs to the UI camera,
 * so `register` is handed each object exactly as the spell parchment and the
 * joystick do it.
 */

const PANEL_MAX_W = 520;
const PANEL_MAX_H = 560;
const PANEL_MIN_W = 300;
const PANEL_MIN_H = 360;

const INK = "#4a3422";
const INK_DIM = "#8a6a48";
const WRONG_INK = "#a8321e";
const DONE_INK = "#3d6b2a";

const INK_HEX = 0x4a3422;
const RULE_HEX = 0x8a6a48;
const PAPER_PALE_HEX = 0xf6e8c4;
const PAPER_HEX = 0xdec694;
const MARK_HEX = 0xa8321e;
const DIM_MARK_HEX = 0x9a8a72;
const HERE_HEX = 0xffffff;
const PATH_HEX = 0x2f6f9e;
const WRONG_HEX = 0xa8321e;
const DONE_HEX = 0x3d6b2a;

const TITLE_SIZE = 18;
const LABEL_SIZE = 11;
const ASK_SIZE = 13;
const BOX_SIZE = 20;

const MARK_SIZE = 7;
const HERE_SIZE = 7;
/**
 * How big a stepping stone is, as a share of the space between two marks.
 *
 * A share rather than a fixed radius: the coarsest ruler puts its marks four
 * times as far apart as the finest, and a stone sized for one is a speck or
 * a blot on the other. Counting them is the whole of the bottom rung, and a
 * speck cannot be counted.
 */
const STONE_SHARE = 0.24;
const STONE_MIN = 3;
const STONE_MAX = 8;
/** How much room the rulers take along the two edges they sit on. */
const RULER_BAND = 20;
const TICK = 4;
/** How many lines of help the foot reserves room for. */
const HINT_LINES = 2;

/**
 * How wide a panel has to be, against its height, before the keypad moves
 * beside the map instead of under it.
 *
 * A phone held sideways is the case this exists for: stacked, the map gets
 * whatever height the keypad leaves, which on a 390-tall viewport is a
 * hundred pixels of world with the ruler's numbers printed on top of each
 * other. Beside it, the map gets the full height and the keypad the width it
 * was going to take anyway.
 */
const WIDE_RATIO = 1.25;

/** The least room a ruler number needs before the next one is drawn. */
const TICK_LABEL_PX = 26;

const KEY_GAP = 6;
const KEY_COLS = 5;
const KEY_ROWS = 3;
const KEY_MAX = 44;
const KEY_MIN = 26;

type PanelPart = Phaser.GameObjects.GameObject &
  Phaser.GameObjects.Components.Depth &
  Phaser.GameObjects.Components.ScrollFactor &
  Phaser.GameObjects.Components.Visible;

interface Key {
  readonly label: string;
  readonly box: Phaser.GameObjects.Rectangle;
  readonly text: Phaser.GameObjects.Text;
  readonly col: number;
  readonly row: number;
  readonly span: number;
}

/** Where the map sits on screen, and how to put a world cell on it. */
interface Sheet {
  readonly left: number;
  readonly top: number;
  readonly span: number;
  readonly at: (col: number, row: number) => { x: number; y: number };
}

export class PortalPanel {
  private readonly paper: ParchmentPanel;
  private readonly parts: PanelPart[] = [];
  private readonly title: Phaser.GameObjects.Text;
  private readonly ask: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly scale: Phaser.GameObjects.Text;
  private readonly sheet: Phaser.GameObjects.Image;
  private readonly ink: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private readonly ticks: Phaser.GameObjects.Text[] = [];
  private readonly hits: Phaser.GameObjects.Rectangle[] = [];
  private readonly keys: Key[] = [];
  private readonly answerBox: Phaser.GameObjects.Rectangle;
  private readonly answerText: Phaser.GameObjects.Text;
  private readonly closeBox: Phaser.GameObjects.Rectangle;
  private readonly closeLabel: Phaser.GameObjects.Text;

  private open = false;
  private stops: readonly PortalStop[] = [];
  private cast: PortalCast | null = null;
  private rung: PortalRung | null = null;
  private at: GridPoint = { col: 0, row: 0 };
  private note = "";
  private markPoints: Record<string, { x: number; y: number }> = {};
  /**
   * Where the place names sit, so a plate can be laid under each of them
   * *after* the journey is drawn.
   *
   * The text objects are above the graphics whatever happens, so this is not
   * about the letters being covered — it is about the journey's own line
   * running between them, which is what made a name unreadable.
   */
  private readonly plates: { x: number; y: number; width: number; height: number }[] = [];
  private finish: ((result: CastResult, journey: PortalJourney | null) => void) | null = null;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    index: UiIndex,
    depth: number,
    private words: Phrases,
    /** The world's grid, not the room's — the spell is cast on the world. */
    private readonly grid: WorldGrid,
    private readonly anchors: AnchorPlacements,
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

    this.title = this.own(this.text("", TITLE_SIZE, INK).setOrigin(0.5, 0));
    this.ask = this.own(this.text("", ASK_SIZE, INK).setOrigin(0.5, 0));
    // Two lines of room and wrapped to the paper: the crow's hint names a
    // method rather than a number, and a method does not fit on one line of
    // a panel three hundred pixels wide. Unwrapped it ran off both edges.
    this.hint = this.own(this.text("", LABEL_SIZE, INK_DIM).setOrigin(0.5, 1));
    this.hint.setAlign("center");
    this.scale = this.own(this.text("", LABEL_SIZE, INK_DIM).setOrigin(1, 1));
    this.sheet = this.own(
      scene.add.image(0, 0, uiTextureKey(UiAsset.ParchmentFill)).setOrigin(0.5),
    );
    this.ink = this.own(scene.add.graphics());

    for (let n = 0; n < 5; n++) {
      this.labels.push(this.own(this.text("", LABEL_SIZE, INK).setOrigin(0.5, 1)));
      const hit = this.own(
        scene.add.rectangle(0, 0, 34, 34, 0xffffff, 0).setInteractive({ useHandCursor: true }),
      );
      hit.on("pointerdown", () => this.choose(n));
      this.hits.push(hit);
    }
    // Enough for the finest ruler the spell ever draws, made once: a text
    // object per opening would leak one per cast.
    for (let n = 0; n < MOST_TICKS * 2; n++) {
      this.ticks.push(this.own(this.text("", LABEL_SIZE - 1, INK_DIM).setOrigin(0.5)));
    }

    this.answerBox = this.own(
      scene.add.rectangle(0, 0, 76, 32, PAPER_PALE_HEX).setStrokeStyle(2, INK_HEX),
    );
    this.answerText = this.own(this.text("", BOX_SIZE, INK).setOrigin(0.5));
    this.buildKeypad();

    this.closeBox = this.own(
      scene.add
        .rectangle(0, 0, 28, 24, PAPER_PALE_HEX)
        .setStrokeStyle(2, INK_HEX)
        .setInteractive({ useHandCursor: true }),
    );
    this.closeLabel = this.own(this.text("x", LABEL_SIZE, INK).setOrigin(0.5));
    this.closeBox.on("pointerdown", () => this.dismiss(false));

    for (const part of this.parts) {
      part
        .setDepth(depth + 1)
        .setScrollFactor(0)
        .setVisible(false);
      register(part);
    }
    this.ink.setDepth(depth + 2);
    for (const label of [...this.labels, ...this.ticks, this.answerText, this.closeLabel]) {
      label.setDepth(depth + 3);
    }
    for (const hit of this.hits) hit.setDepth(depth + 4);
    for (const key of this.keys) key.text.setDepth(depth + 3);
  }

  get isOpen(): boolean {
    return this.open;
  }

  /**
   * Where each place's mark is on screen, for a script that has to tap one.
   *
   * The same reason the doors are exposed: a mark's position is decided by
   * the panel's own layout against the viewport it found, and a test that
   * hand-copied the arithmetic would be testing its copy.
   */
  marks(): Record<string, { x: number; y: number }> {
    return { ...this.markPoints };
  }

  /** What the spell is currently asking, for the dev handle and for tests. */
  get journey(): PortalJourney | null {
    return this.cast?.journey ?? null;
  }

  setPhrases(words: Phrases): void {
    this.words = words;
    if (this.open) this.render();
  }

  /**
   * Open on the choosing step.
   *
   * `stops` is every named place with what is known about it, so the map can
   * draw the ones nobody has reached as well — dimmed and unpickable. A map
   * showing only where you have been is a map that says the world is
   * finished, and this one is mostly unexplored on purpose.
   */
  openOn(
    stops: readonly PortalStop[],
    at: GridPoint,
    rung: PortalRung,
    finish: (result: CastResult, journey: PortalJourney | null) => void,
  ): void {
    const key = paintWorldMap(this.scene, this.grid);
    if (key) this.sheet.setTexture(key);
    this.stops = stops;
    this.at = at;
    this.rung = rung;
    this.cast = null;
    this.note = "";
    this.finish = finish;
    this.open = true;
    this.paper.setVisible(true);
    this.render();
    this.keyHandler = (event: KeyboardEvent) => this.onKey(event);
    this.scene.input.keyboard?.on("keydown", this.keyHandler);
  }

  layout(): void {
    if (this.open) this.render();
  }

  destroy(): void {
    this.detachKeys();
  }

  private onKey(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      this.dismiss(false);
      return;
    }
    if (!this.cast) return;
    // A physical keyboard is a convenience on top of the keypad, never the
    // only way in — the game is played on a tablet.
    if (event.key >= "0" && event.key <= "9")
      this.apply(typePortalDigit(this.cast, Number(event.key)));
    else if (event.key === "Backspace") this.apply(backspacePortal(this.cast));
    else if (event.key === "Enter") this.apply(submitPortal(this.cast));
    else return;
    event.preventDefault();
  }

  /**
   * A place was tapped.
   *
   * Refusals are said rather than swallowed: a mark that does nothing when
   * touched reads as a broken map, and "you have not been there yet" is the
   * one line that tells a child the world is bigger than their spell.
   */
  private choose(index: number): void {
    if (this.cast) return;
    const stop = this.stops[index];
    if (!stop || !this.rung) return;
    if (stop.here) {
      this.note = this.words.portalHereAlready;
      this.render();
      return;
    }
    if (!canTravelTo(stop)) {
      this.note = this.words.portalLocked;
      this.render();
      return;
    }
    this.note = "";
    // Measured to the cell the portal will actually land on, which the stop
    // carries — not to the middle of the box. They are the same everywhere
    // but the enchanted forest, whose middle is the great tree.
    this.cast = beginPortalCast(journeyBetween(stop.place, this.at, stop.landing, this.rung));
    this.render();
  }

  private apply(next: PortalCast): void {
    this.cast = next;
    if (next.done) {
      this.render();
      // A beat on the finished parchment, so the answer is readable as an
      // answer rather than as a flash before the world moves.
      this.scene.time.delayedCall(650, () => this.dismiss(true));
      return;
    }
    this.render();
  }

  private dismiss(travelled: boolean): void {
    this.detachKeys();
    this.open = false;
    this.paper.setVisible(false);
    this.ink.clear();
    for (const part of this.parts) part.setVisible(false);
    const done = this.finish;
    const journey = travelled ? (this.cast?.journey ?? null) : null;
    const result = castResult(this.cast, travelled);
    this.finish = null;
    this.cast = null;
    done?.(result, journey);
  }

  private detachKeys(): void {
    if (!this.keyHandler) return;
    this.scene.input.keyboard?.off("keydown", this.keyHandler);
    this.keyHandler = null;
  }

  // --- drawing -------------------------------------------------------------

  private render(): void {
    const { width, height } = this.scene.scale;
    const rect = this.paper.layout(width, height);
    for (const part of this.parts) part.setVisible(false);
    this.ink.clear();
    this.ink.setVisible(true);

    this.title
      .setText(this.words.portalTitle)
      .setPosition(rect.centreX, rect.top + PAD)
      .setVisible(true);
    this.closeBox
      .setPosition(rect.left + rect.width - PAD - 14, rect.top + PAD + 10)
      .setVisible(true);
    this.closeLabel.setPosition(this.closeBox.x, this.closeBox.y).setVisible(true);

    this.ask
      .setText(this.question())
      .setPosition(rect.centreX, rect.top + PAD + TITLE_SIZE + 8)
      .setVisible(true);

    // Side by side on a wide panel, stacked on a tall one. The keypad is
    // laid out first either way, because what is left over is the map's.
    const wide = this.cast !== null && rect.width > rect.height * WIDE_RATIO;
    const mapCentre = wide ? rect.left + rect.width * 0.28 : rect.centreX;
    const padCentre = wide ? rect.left + rect.width * 0.72 : rect.centreX;
    const keypad = this.cast ? this.layoutKeypad(rect, padCentre, wide) : null;
    const mapTop = this.ask.y + ASK_SIZE + 12;
    // Everything the answer box and the keypad do not want. The box sits 26
    // above the pad and is 32 tall, so 62 of clearance under the map leaves
    // it room without a gap of bare parchment. Beside the map, the keypad
    // takes none of its height at all.
    const mapBottom = wide
      ? rect.top + rect.height - PAD - 20
      : (keypad?.top ?? rect.top + rect.height - PAD) - (this.cast ? 62 : 18);
    const mapRoom = wide ? rect.width * 0.5 : rect.width;
    const sheet = this.drawSheet(rect, mapCentre, mapRoom, mapTop, mapBottom);
    this.drawPlaces(sheet);
    if (this.cast) {
      this.drawRulers(sheet, this.cast.journey);
      this.drawPath(sheet, this.cast.journey);
      this.drawAnswer(padCentre, keypad);
    }
    for (const plate of this.plates) {
      this.ink.fillStyle(PAPER_PALE_HEX, 0.85);
      this.ink.fillRect(plate.x, plate.y, plate.width, plate.height);
    }
    this.drawFoot(rect);
  }

  /** The line above the map: what to do, or what just went wrong. */
  private question(): string {
    if (this.note) return this.note;
    const journey = this.cast?.journey;
    if (!journey) return this.words.portalChoose;
    const asked = this.words.portalCompass(journey.asked.towards);
    if (journey.rung.tier === PortalTier.Count) return this.words.portalAskCount;
    if (journey.rung.tier === PortalTier.Read) return this.words.portalAskRead(asked);
    if (journey.rung.tier === PortalTier.Crow) return this.words.portalAskCrow;
    return this.words.portalAskAdd;
  }

  private drawSheet(
    rect: { left: number; top: number; width: number; height: number; centreX: number },
    centreX: number,
    available: number,
    top: number,
    bottom: number,
  ): Sheet {
    // The rulers eat into the paper on two edges, so the map itself is
    // smaller than the space it sits in whenever they are drawn.
    const band = this.cast ? RULER_BAND : 0;
    const room = Math.max(60, Math.min(available - PAD * 2 - band, bottom - top - band));
    const left = centreX - room / 2 + band / 2;
    const sheetTop = top;
    this.sheet
      .setDisplaySize(room, room)
      .setPosition(left + room / 2, sheetTop + room / 2)
      .setVisible(true);
    this.ink.lineStyle(2, INK_HEX, 1);
    this.ink.strokeRect(left, sheetTop, room, room);

    const size = minimapSize(this.grid.width, this.grid.height);
    return {
      left,
      top: sheetTop,
      span: room,
      at: (col, row) => {
        const point = minimapPoint(col, row);
        return {
          x: left + ((point.x + 0.5) / size.width) * room,
          y: sheetTop + ((point.y + 0.5) / size.height) * room,
        };
      },
    };
  }

  /**
   * The five places, and the traveller.
   *
   * Once a destination is chosen the others stop being drawn: the map is
   * then a picture of one journey, and four other names on it are four other
   * distances a child could measure by mistake.
   */
  /**
   * Where a mark sits on the page.
   *
   * Everything drawn while a journey is being measured goes through this:
   * the ticks, the two ends, the path and its stones. Drawing the traveller
   * at their true cell while the path started at their *mark* put the two up
   * to half a league apart — a picture that disagreed with the ruler it was
   * drawn on, on the one screen whose whole subject is reading a ruler.
   */
  private markPoint(sheet: Sheet, league: number, markCol: number, markRow: number) {
    return {
      x: sheet.left + markFraction(markCol, this.grid.width, league) * sheet.span,
      y: sheet.top + markFraction(markRow, this.grid.height, league) * sheet.span,
    };
  }

  private drawPlaces(sheet: Sheet): void {
    const journey = this.cast?.journey;
    this.markPoints = {};
    this.plates.length = 0;
    for (const [index, stop] of this.stops.entries()) {
      const hit = this.hits[index];
      const label = this.labels[index];
      if (!hit || !label) continue;
      if (journey && stop.place !== journey.place) continue;
      // The mark sits where the portal lands, not on the middle of the box:
      // the child measures to this mark, so arriving anywhere else would
      // make the ruler a lie about a distance they had just read off it.
      const point = journey
        ? this.markPoint(sheet, journey.league, journey.toMark.col, journey.toMark.row)
        : sheet.at(stop.landing.col, stop.landing.row);
      const colour = stop.reached ? MARK_HEX : DIM_MARK_HEX;
      this.ink.fillStyle(colour, 1);
      this.ink.fillRect(point.x - MARK_SIZE / 2, point.y - MARK_SIZE / 2, MARK_SIZE, MARK_SIZE);
      if (!stop.reached) {
        // A ring rather than a fill, so an unreached place reads as an
        // outline of somewhere rather than as a smaller version of a place
        // you know.
        this.ink.fillStyle(PAPER_HEX, 1);
        this.ink.fillRect(point.x - 1, point.y - 1, 3, 3);
      }
      label
        .setText(this.words.placeName(stop.place))
        .setColor(stop.reached ? INK : INK_DIM)
        .setVisible(true);
      // Kept on the page: a place near the eastern edge had its name running
      // off the parchment, which is the one part of a map that has to be
      // readable.
      const half = label.width / 2;
      // Above the mark, unless the journey comes down to it from the north —
      // then the name would sit squarely on the line that was drawn to be
      // read. Put it on the far side of the mark from the traveller instead.
      const below = journey !== undefined && journey.toMark.row > journey.fromMark.row;
      // Far enough out to clear a stepping stone as well as the mark. The
      // last stone of a journey sits *on* the destination, and a name laid
      // against the mark covered it — on the one rung whose whole question
      // is how many stones there are.
      const clear = journey ? MARK_SIZE + STONE_MAX + 2 : MARK_SIZE;
      label
        .setOrigin(0.5, below ? 0 : 1)
        .setPosition(
          Math.min(Math.max(point.x, sheet.left + half), sheet.left + sheet.span - half),
          point.y + (below ? clear : -clear),
        );
      this.plates.push({
        x: label.x - half - 2,
        y: (below ? label.y : label.y - LABEL_SIZE) - 3,
        width: label.width + 4,
        height: LABEL_SIZE + 5,
      });
      this.markPoints[stop.place] = { x: point.x, y: point.y };
      if (journey) continue;
      hit.setPosition(point.x, point.y).setVisible(true);
    }

    const you = journey
      ? this.markPoint(sheet, journey.league, journey.fromMark.col, journey.fromMark.row)
      : sheet.at(this.at.col, this.at.row);
    this.ink.fillStyle(INK_HEX, 1);
    this.ink.fillRect(
      you.x - HERE_SIZE / 2 - 1,
      you.y - HERE_SIZE / 2 - 1,
      HERE_SIZE + 2,
      HERE_SIZE + 2,
    );
    this.ink.fillStyle(HERE_HEX, 1);
    this.ink.fillRect(you.x - HERE_SIZE / 2, you.y - HERE_SIZE / 2, HERE_SIZE, HERE_SIZE);
  }

  /**
   * The rulers, along the bottom and the left.
   *
   * Numbered from the traveller at every rung but the last, so a place's
   * mark *is* how far away it is. Numbers only every few marks, because a
   * ruler that numbers all fifty of them at this size is a grey smear.
   */
  private drawRulers(sheet: Sheet, journey: PortalJourney): void {
    const marks = marksAcross(this.grid.width, journey.league);
    const step = sheet.span / marks;
    // By pixels rather than by a count of marks: ten numbers fit comfortably
    // on a five-hundred-pixel map and print on top of each other on a
    // hundred-pixel one, which is what a phone held sideways gives.
    const every = Math.max(1, Math.ceil(TICK_LABEL_PX / step));
    const bottom = sheet.top + sheet.span;
    // Numbered from wherever the ruler counts *from*, so zero always gets a
    // number. Counting every fifth mark from the map's edge instead left a
    // player-centred ruler reading 23, 18, 13, 8, 3, 2, 7 — a ruler with no
    // zero on it, which is the one mark the whole rung is measured from.
    const numbered = (mark: number, origin: number) =>
      Math.abs(mark - (journey.rung.origin === "corner" ? 0 : origin)) % every === 0;
    this.ink.lineStyle(1, RULE_HEX, 1);
    let slot = 0;
    for (let mark = 0; mark <= marks; mark++) {
      const tick = this.markPoint(sheet, journey.league, mark, mark);
      const x = tick.x;
      const y = tick.y;
      const long = numbered(mark, journey.fromMark.col) || numbered(mark, journey.fromMark.row);
      this.ink.lineBetween(x, bottom, x, bottom + (long ? TICK : TICK / 2));
      this.ink.lineBetween(sheet.left - (long ? TICK : TICK / 2), y, sheet.left, y);
      const across = numbered(mark, journey.fromMark.col) ? this.ticks[slot++] : undefined;
      const down = numbered(mark, journey.fromMark.row) ? this.ticks[slot++] : undefined;
      if (across) {
        across
          .setText(String(this.reading(mark, journey.fromMark.col, journey)))
          .setPosition(x, bottom + TICK + 6)
          .setVisible(true);
      }
      if (down) {
        down
          .setText(String(this.reading(mark, journey.fromMark.row, journey)))
          .setPosition(sheet.left - TICK - 8, y)
          .setVisible(true);
      }
    }
    this.scale
      .setText(this.words.portalScale(journey.league))
      .setPosition(sheet.left + sheet.span, bottom + RULER_BAND + 10)
      .setVisible(true);
  }

  /**
   * What a mark is numbered, which is the whole difference between the last
   * rung and the ones below it: counted from the traveller's own mark, or
   * from the edge of the map as a real map counts.
   */
  private reading(mark: number, origin: number, journey: PortalJourney): number {
    return journey.rung.origin === "corner" ? mark : Math.abs(mark - origin);
  }

  /**
   * The journey itself: the two legs, and — at the bottom rung — a stone on
   * every mark along them.
   *
   * The stones are the scaffolding. They are the same number as the legs
   * added, laid end to end, so the easiest rung and the middle one answer
   * one question with different amounts of help rather than being two
   * different exercises.
   */
  private drawPath(sheet: Sheet, journey: PortalJourney): void {
    const step = sheet.span / marksAcross(this.grid.width, journey.league);
    const point = (markCol: number, markRow: number) =>
      this.markPoint(sheet, journey.league, markCol, markRow);
    const start = point(journey.fromMark.col, journey.fromMark.row);
    const corner = point(journey.toMark.col, journey.fromMark.row);
    const end = point(journey.toMark.col, journey.toMark.row);

    if (journey.rung.tier === PortalTier.Crow) {
      // The straight line, because that is the distance being asked for. The
      // two legs stay, faintly, so the triangle the theorem is about is on
      // the paper rather than in the child's head.
      this.ink.lineStyle(1, RULE_HEX, 0.9);
      this.ink.lineBetween(start.x, start.y, corner.x, corner.y);
      this.ink.lineBetween(corner.x, corner.y, end.x, end.y);
      this.ink.lineStyle(3, PATH_HEX, 1);
      this.ink.lineBetween(start.x, start.y, end.x, end.y);
      return;
    }

    const counting = journey.rung.tier === PortalTier.Count;
    // Under the stones the line is a path they lie on; without them it is
    // the journey itself. Drawn thinner and paler when it is the former, so
    // the stones are what the eye counts rather than what decorates a line.
    const bold = counting ? 2 : 3;
    const solid = counting ? 0.55 : 1;
    // The reading rung asks about *one* leg, and both rulers are numbered
    // from zero — so drawing the whole path in one weight points at both
    // legs equally and lets a child read the right number off the wrong
    // axis. Only the leg being asked about is drawn bold.
    const reading = journey.rung.tier === PortalTier.Read;
    const acrossAsked = !reading || journey.asked === journey.across;
    const downAsked = !reading || journey.asked === journey.down;
    this.ink.lineStyle(acrossAsked ? bold : 1, PATH_HEX, acrossAsked ? solid : 0.35);
    this.ink.lineBetween(start.x, start.y, corner.x, corner.y);
    this.ink.lineStyle(downAsked ? bold : 1, PATH_HEX, downAsked ? solid : 0.35);
    this.ink.lineBetween(corner.x, corner.y, end.x, end.y);
    if (!counting) return;

    const radius = Math.max(STONE_MIN, Math.min(STONE_MAX, step * STONE_SHARE));
    const stones = stonesAlong(journey).map((stone) => point(stone.col, stone.row));
    // Every disc laid down before any outline, so a stone that overlaps its
    // neighbour on the finest ruler does not paint over its ring.
    this.ink.fillStyle(PAPER_PALE_HEX, 1);
    for (const spot of stones) this.ink.fillCircle(spot.x, spot.y, radius);
    this.ink.lineStyle(2, INK_HEX, 1);
    for (const spot of stones) this.ink.strokeCircle(spot.x, spot.y, radius);
  }

  private drawAnswer(centreX: number, keypad: { top: number } | null): void {
    if (!this.cast || !keypad) return;
    const y = keypad.top - 26;
    const done = this.cast.done;
    this.answerBox
      .setPosition(centreX, y)
      .setStrokeStyle(2, done ? DONE_HEX : this.cast.wrong ? WRONG_HEX : INK_HEX)
      .setVisible(true);
    this.answerText
      .setText(this.cast.entry === "" ? "?" : this.cast.entry)
      .setColor(done ? DONE_INK : this.cast.wrong ? WRONG_INK : INK)
      .setPosition(centreX, y)
      .setVisible(true);
    for (const key of this.keys) {
      key.box.setVisible(true);
      key.text.setVisible(true);
    }
  }

  /** The hint, once it has been earned, on the line under everything. */
  private drawFoot(rect: { centreX: number; top: number; height: number; width: number }): void {
    const line = this.cast ? this.helpLine() : this.words.mapYouAreHere;
    if (!line) return;
    this.hint
      .setText(line)
      .setWordWrapWidth(rect.width - PAD * 2)
      .setPosition(rect.centreX, rect.top + rect.height - PAD)
      .setVisible(true);
  }

  private helpLine(): string {
    const journey = this.cast ? portalHint(this.cast) : null;
    if (!journey) return "";
    const across = this.words.portalCompass(journey.across.towards);
    const down = this.words.portalCompass(journey.down.towards);
    if (journey.rung.tier === PortalTier.Count) return this.words.portalHintCount(journey.answer);
    if (journey.rung.tier === PortalTier.Read) {
      return this.words.portalHintRead(
        this.words.portalCompass(journey.asked.towards),
        journey.asked.marks,
      );
    }
    if (journey.rung.tier === PortalTier.Crow) {
      const squares = journey.across.marks ** 2 + journey.down.marks ** 2;
      return this.words.portalHintCrow(journey.across.marks, journey.down.marks, squares);
    }
    return this.words.portalHintLegs(across, journey.across.marks, down, journey.down.marks);
  }

  // --- the keypad ----------------------------------------------------------

  private buildKeypad(): void {
    const press = (label: string) => () => {
      if (!this.cast) return;
      if (label === "OK") this.apply(submitPortal(this.cast));
      else if (label === "<") this.apply(backspacePortal(this.cast));
      else this.apply(typePortalDigit(this.cast, Number(label)));
    };
    const rows: (readonly [string, number][])[] = [
      [
        ["1", 1],
        ["2", 1],
        ["3", 1],
        ["4", 1],
        ["5", 1],
      ],
      [
        ["6", 1],
        ["7", 1],
        ["8", 1],
        ["9", 1],
        ["0", 1],
      ],
      [
        ["<", 2],
        ["OK", 3],
      ],
    ];
    for (const [row, keys] of rows.entries()) {
      let col = 0;
      for (const [label, span] of keys) {
        const box = this.own(
          this.scene.add
            .rectangle(0, 0, 10, 10, PAPER_PALE_HEX)
            .setStrokeStyle(2, INK_HEX)
            .setInteractive({ useHandCursor: true }),
        );
        box.on("pointerdown", press(label));
        const text = this.own(this.text(label, LABEL_SIZE + 2, INK).setOrigin(0.5));
        this.keys.push({ label, box, text, col, row, span });
        col += span;
      }
    }
  }

  private layoutKeypad(
    rect: { left: number; top: number; width: number; height: number; centreX: number },
    centreX: number,
    wide: boolean,
  ): { top: number } {
    const innerW = (wide ? rect.width * 0.5 : rect.width) - PAD * 2;
    const size = Math.max(KEY_MIN, Math.min(KEY_MAX, Math.floor(innerW / KEY_COLS) - KEY_GAP));
    const padH = size * KEY_ROWS + KEY_GAP * (KEY_ROWS - 1);
    const padW = size * KEY_COLS + KEY_GAP * (KEY_COLS - 1);
    // Two lines of foot, because the help under the keypad is two lines on
    // the rung whose help is a method.
    const top = rect.top + rect.height - PAD - HINT_LINES * LABEL_SIZE - 8 - padH;
    const left = centreX - padW / 2;
    for (const key of this.keys) {
      const w = size * key.span + KEY_GAP * (key.span - 1);
      const x = left + key.col * (size + KEY_GAP) + w / 2;
      const y = top + key.row * (size + KEY_GAP) + size / 2;
      key.box.setSize(w, size).setPosition(x, y);
      key.text.setPosition(x, y);
    }
    return { top };
  }

  private text(value: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.scene.add.text(0, 0, value, {
      fontFamily: "monospace",
      fontSize: `${size}px`,
      color,
    });
  }

  private own<T extends PanelPart>(object: T): T {
    this.parts.push(object);
    return object;
  }
}

/**
 * The most marks a ruler ever carries a number on.
 *
 * The finest ruling is one mark to ten cells, which is fifty across a
 * five-hundred-cell world, and numbers go on every fifth of those. Doubled
 * for the two rulers and rounded up, because running out of text objects
 * mid-draw would silently leave a ruler with no numbers on it.
 */
const MOST_TICKS = 16;
