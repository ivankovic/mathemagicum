// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import type { Phrases } from "../i18n/phrases";
import type { AnchorPlacements } from "../world/anchors";
import type { WorldGrid } from "../world/grid";
import {
  MINIMAP_COLORS,
  MINIMAP_STEP,
  areaCentre,
  markedPlaces,
  minimapPoint,
  minimapSize,
} from "../world/minimap";
import { PANEL_PAD as PAD, ParchmentPanel } from "./ParchmentPanel";
import { UiAsset, type UiIndex, uiTextureKey } from "./assets";

/**
 * The map on the tower wall, opened.
 *
 * Drawn from the player's own grid rather than painted as art: the world is
 * generated per game, so a coastline somebody drew would be a picture of a
 * world nobody is standing in. It is painted once, the first time the map is
 * opened — a quarter of a million cells is nothing to walk once and quite a
 * lot to walk every frame — into a canvas texture that is then just an image.
 *
 * What moves is drawn over the top each time it opens: the five places worth
 * knowing about, and the player. Their positions come from `minimap.ts`,
 * which has no Phaser in it and is tested without a browser.
 */

const PANEL_MAX_W = 470;
const PANEL_MAX_H = 470;
const PANEL_MIN_W = 300;
const PANEL_MIN_H = 320;

const INK = "#4a3422";
const INK_DIM = "#8a6a48";
const INK_HEX = 0x4a3422;
const PAPER_PALE_HEX = 0xf6e8c4;
const MARK_HEX = 0xa8321e;
// White rather than parchment: at the start of a game the player is standing
// in the village, so their mark lands on top of the village's own — and two
// marks of similar weight in one place read as one odd symbol.
const HERE_HEX = 0xffffff;

const TITLE_SIZE = 17;
const LABEL_SIZE = 11;
const MARK_SIZE = 5;
const HERE_SIZE = 7;

const MAP_TEXTURE = "world-map";

type PanelPart = Phaser.GameObjects.GameObject &
  Phaser.GameObjects.Components.Depth &
  Phaser.GameObjects.Components.ScrollFactor &
  Phaser.GameObjects.Components.Visible;

export class MapPanel {
  private readonly paper: ParchmentPanel;
  private readonly parts: PanelPart[] = [];
  private readonly title: Phaser.GameObjects.Text;
  private readonly caption: Phaser.GameObjects.Text;
  private readonly sheet: Phaser.GameObjects.Image;
  private readonly ink: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private readonly closeBox: Phaser.GameObjects.Rectangle;
  private readonly closeLabel: Phaser.GameObjects.Text;

  private open = false;
  private painted = false;
  private onClose: (() => void) | null = null;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    index: UiIndex,
    depth: number,
    private words: Phrases,
    /**
     * The world's grid, not the scene's.
     *
     * The scene swaps `grid` for the room's when the player steps inside, and
     * this map is only ever opened indoors — handed the live one, it would
     * draw a six-by-five tower instead of the world.
     */
    private readonly grid: WorldGrid,
    private readonly anchors: AnchorPlacements,
    /** Where the player is, asked for at the moment the map is opened. */
    private readonly playerCell: () => { col: number; row: number },
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
    this.caption = this.own(this.text("", LABEL_SIZE, INK_DIM).setOrigin(0.5, 1));
    // Built against a texture that exists, then pointed at the world's own
    // once it has been painted: an image made against a key that is not there
    // yet gets Phaser's missing-texture placeholder, which is how a lime
    // green box ended up several tiles across on the night the lamps went in.
    this.sheet = this.own(
      scene.add.image(0, 0, uiTextureKey(UiAsset.ParchmentFill)).setOrigin(0.5),
    );
    this.ink = this.own(scene.add.graphics());
    for (const _place of markedPlaces(anchors)) {
      this.labels.push(this.own(this.text("", LABEL_SIZE, INK).setOrigin(0.5, 1)));
    }
    this.closeBox = this.own(
      scene.add
        .rectangle(0, 0, 28, 24, PAPER_PALE_HEX)
        .setStrokeStyle(2, INK_HEX)
        .setInteractive({ useHandCursor: true }),
    );
    this.closeLabel = this.own(this.text("x", LABEL_SIZE, INK).setOrigin(0.5));
    this.closeBox.on("pointerdown", () => this.close());

    for (const part of this.parts) {
      part
        .setDepth(depth + 1)
        .setScrollFactor(0)
        .setVisible(false);
      register(part);
    }
    this.ink.setDepth(depth + 2);
    for (const label of this.labels) label.setDepth(depth + 3);
    this.closeLabel.setDepth(depth + 3);
  }

  get isOpen(): boolean {
    return this.open;
  }

  setPhrases(words: Phrases): void {
    this.words = words;
    if (this.open) this.render();
  }

  open_(onClose: () => void): void {
    this.paintWorld();
    this.open = true;
    this.onClose = onClose;
    this.paper.setVisible(true);
    this.render();
    this.keyHandler = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      this.close();
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

  /**
   * Walk the world once and write it into a texture.
   *
   * Once per game rather than per opening: the ground does not move, and the
   * things that do — the player, and one day whatever they have found — are
   * drawn over the top afterwards.
   */
  private paintWorld(): void {
    if (this.painted) return;
    this.painted = true;
    // A texture outlives the panel that made it — a scene restarted on a
    // resize would otherwise ask for a key already in use and get nothing.
    if (this.scene.textures.exists(MAP_TEXTURE)) {
      this.sheet.setTexture(MAP_TEXTURE);
      return;
    }
    const size = minimapSize(this.grid.width, this.grid.height);
    const canvas = this.scene.textures.createCanvas(MAP_TEXTURE, size.width, size.height);
    const context = canvas?.context;
    if (!canvas || !context) return;
    const image = context.createImageData(size.width, size.height);
    for (let row = 0; row < this.grid.height; row += MINIMAP_STEP) {
      for (let col = 0; col < this.grid.width; col += MINIMAP_STEP) {
        const colour = MINIMAP_COLORS[this.grid.getTerrain(col, row)];
        const at = minimapPoint(col, row);
        const offset = (at.y * size.width + at.x) * 4;
        image.data[offset] = (colour >> 16) & 0xff;
        image.data[offset + 1] = (colour >> 8) & 0xff;
        image.data[offset + 2] = colour & 0xff;
        image.data[offset + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
    canvas.refresh();
    this.sheet.setTexture(MAP_TEXTURE);
  }

  private render(): void {
    const { width, height } = this.scene.scale;
    const rect = this.paper.layout(width, height);
    for (const part of this.parts) part.setVisible(false);
    this.ink.clear();
    this.ink.setVisible(true);

    this.title
      .setText(this.words.mapTitle)
      .setPosition(rect.centreX, rect.top + PAD)
      .setVisible(true);
    this.closeBox
      .setPosition(rect.left + rect.width - PAD - 14, rect.top + PAD + 10)
      .setVisible(true);
    this.closeLabel.setPosition(this.closeBox.x, this.closeBox.y).setVisible(true);

    // The sheet, as big as the paper will take it and square, because the
    // world is.
    const top = rect.top + PAD + TITLE_SIZE + 14;
    const bottom = rect.top + rect.height - PAD - LABEL_SIZE - 10;
    const span = Math.max(40, Math.min(rect.width - PAD * 2, bottom - top));
    const left = rect.centreX - span / 2;
    const sheetTop = top + (bottom - top - span) / 2;
    this.sheet
      .setDisplaySize(span, span)
      .setPosition(rect.centreX, sheetTop + span / 2)
      .setVisible(true);
    this.ink.lineStyle(2, INK_HEX, 1);
    this.ink.strokeRect(left, sheetTop, span, span);

    const size = minimapSize(this.grid.width, this.grid.height);
    const onSheet = (col: number, row: number) => {
      const at = minimapPoint(col, row);
      return {
        x: left + ((at.x + 0.5) / size.width) * span,
        y: sheetTop + ((at.y + 0.5) / size.height) * span,
      };
    };

    for (const [index, place] of markedPlaces(this.anchors).entries()) {
      const centre = areaCentre(place.area);
      const at = onSheet(centre.col, centre.row);
      this.ink.fillStyle(MARK_HEX, 1);
      this.ink.fillRect(at.x - MARK_SIZE / 2, at.y - MARK_SIZE / 2, MARK_SIZE, MARK_SIZE);
      const label = this.labels[index];
      if (!label) continue;
      label.setText(this.words.placeName(place.id)).setVisible(true);
      // Kept on the page: a place near the eastern edge had its name running
      // off the parchment, which is the one part of a map that has to be
      // readable.
      const half = label.width / 2;
      label.setPosition(
        Math.min(Math.max(at.x, left + half), left + span - half),
        at.y - MARK_SIZE,
      );
    }

    // The player last, over everything: it is the one mark they are looking
    // for, and the village's own mark sits under it at the start of a game.
    const here = this.playerCell();
    const you = onSheet(here.col, here.row);
    this.ink.fillStyle(INK_HEX, 1);
    this.ink.fillRect(
      you.x - HERE_SIZE / 2 - 1,
      you.y - HERE_SIZE / 2 - 1,
      HERE_SIZE + 2,
      HERE_SIZE + 2,
    );
    this.ink.fillStyle(HERE_HEX, 1);
    this.ink.fillRect(you.x - HERE_SIZE / 2, you.y - HERE_SIZE / 2, HERE_SIZE, HERE_SIZE);

    this.caption
      .setText(this.words.mapYouAreHere)
      .setPosition(rect.centreX, rect.top + rect.height - PAD)
      .setVisible(true);
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

  destroy(): void {
    this.close();
    this.paper.destroy();
    for (const part of this.parts) part.destroy();
  }
}
