// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import { PLACEABLE_FIXTURES } from "../world/fixtures";
import type { Inventory } from "../world/inventory";
import { PLANT_TYPES } from "../world/plants";
import { CROP_PRICE, type Purse, type Trade, buyOne, priceOf, sellOne } from "../world/shop";
import { PANEL_PAD as PAD, ParchmentPanel } from "./ParchmentPanel";
import { type UiIndex, cropIcon, itemIcon, uiTextureKey } from "./assets";

/**
 * The village store, written out on the shopkeeper's counter book.
 *
 * Two columns, because the shop does two opposite things and a player
 * should not have to change mode to do the other one: what she is carrying
 * on the left with what it fetches, what is for sale on the right with what
 * it costs. One tap trades one unit either way — a sell-everything button
 * next to a buy-one button would be two interaction models on one page.
 *
 * Crops she has none of are still listed, greyed. A list that only showed
 * what she happens to be holding would change shape as she sold, moving the
 * next row under her thumb between taps.
 */

const PANEL_MAX_W = 460;
const PANEL_MAX_H = 430;
const PANEL_MIN_W = 280;
const PANEL_MIN_H = 300;

const INK = "#4a3422";
const INK_DIM = "#8a6a48";
const INK_HEX = 0x4a3422;
const PAPER_PALE_HEX = 0xf6e8c4;
const PAPER_HEX = 0xdec694;

const TITLE_SIZE = 18;
const HEADING_SIZE = 12;
const ROW_SIZE = 13;
const HINT_SIZE = 12;

const ROW_H = 40;
const ROW_GAP = 4;
const ICON_INSET = 22;

interface Row {
  readonly box: Phaser.GameObjects.Rectangle;
  readonly icon: Phaser.GameObjects.Image;
  readonly label: Phaser.GameObjects.Text;
}

type PanelPart = Phaser.GameObjects.GameObject &
  Phaser.GameObjects.Components.Depth &
  Phaser.GameObjects.Components.ScrollFactor &
  Phaser.GameObjects.Components.Visible;

export class ShopPanel {
  private readonly parts: PanelPart[] = [];
  private readonly paper: ParchmentPanel;
  private readonly title: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly sellHeading: Phaser.GameObjects.Text;
  private readonly buyHeading: Phaser.GameObjects.Text;
  private readonly sellRows: Row[] = [];
  private readonly buyRows: Row[] = [];
  private readonly closeRect: Phaser.GameObjects.Rectangle;
  private readonly closeText: Phaser.GameObjects.Text;

  private open = false;
  private onClose: (() => void) | null = null;
  private onTrade: (() => void) | null = null;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    index: UiIndex,
    depth: number,
    private readonly inventory: Inventory,
    private readonly purse: Purse,
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

    this.title = this.own(this.label("", TITLE_SIZE, INK).setOrigin(0.5, 0));
    this.hint = this.own(this.label("", HINT_SIZE, INK_DIM).setOrigin(0.5, 1));
    this.sellHeading = this.own(this.label("You have", HEADING_SIZE, INK_DIM).setOrigin(0, 0));
    this.buyHeading = this.own(this.label("For sale", HEADING_SIZE, INK_DIM).setOrigin(0, 0));

    for (const plant of PLANT_TYPES) {
      this.sellRows.push(
        this.makeRow(uiTextureKey(cropIcon(plant)), () =>
          this.trade(sellOne(this.inventory, this.purse, plant)),
        ),
      );
    }
    for (const fixture of PLACEABLE_FIXTURES) {
      this.buyRows.push(
        this.makeRow(uiTextureKey(itemIcon(fixture)), () =>
          this.trade(buyOne(this.inventory, this.purse, fixture)),
        ),
      );
    }

    this.closeRect = this.own(
      this.scene.add
        .rectangle(0, 0, 26, 26, PAPER_HEX)
        .setStrokeStyle(2, INK_HEX)
        .setInteractive({ useHandCursor: true }),
    );
    this.closeText = this.own(this.label("x", ROW_SIZE, INK).setOrigin(0.5));
    this.closeRect.on("pointerdown", () => this.close());

    for (const part of this.parts) {
      part
        .setDepth(depth + 1)
        .setScrollFactor(0)
        .setVisible(false);
      register(part);
    }
    for (const row of [...this.sellRows, ...this.buyRows]) {
      row.icon.setDepth(depth + 2);
      row.label.setDepth(depth + 2);
    }
    this.closeText.setDepth(depth + 2);
  }

  get isOpen(): boolean {
    return this.open;
  }

  private makeRow(texture: string, act: () => void): Row {
    const box = this.own(
      this.scene.add
        .rectangle(0, 0, 10, ROW_H, PAPER_PALE_HEX)
        .setStrokeStyle(2, INK_HEX)
        .setInteractive({ useHandCursor: true }),
    );
    const icon = this.own(this.scene.add.image(0, 0, texture));
    const label = this.own(this.label("", ROW_SIZE, INK).setOrigin(0, 0.5));
    box.on("pointerdown", act);
    return { box, icon, label };
  }

  private trade(result: Trade): void {
    this.hint.setText(result.message).setColor(result.ok ? INK : INK_DIM);
    this.render();
    if (result.ok) this.onTrade?.();
  }

  open_(onClose: () => void, onTrade?: () => void): void {
    this.open = true;
    this.onClose = onClose;
    this.onTrade = onTrade ?? null;
    this.paper.setVisible(true);
    for (const part of this.parts) part.setVisible(true);
    this.hint.setText("Tap something to trade one of it");
    this.keyHandler = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      this.close();
    };
    this.scene.input.keyboard?.on("keydown", this.keyHandler);
    this.render();
  }

  close(): void {
    if (this.keyHandler) {
      this.scene.input.keyboard?.off("keydown", this.keyHandler);
      this.keyHandler = null;
    }
    this.open = false;
    this.paper.setVisible(false);
    for (const part of this.parts) part.setVisible(false);
    const done = this.onClose;
    this.onClose = null;
    this.onTrade = null;
    done?.();
  }

  /** Re-place for the current viewport. Safe to call while shut. */
  layout(): void {
    if (this.open) this.render();
  }

  private render(): void {
    const { width, height } = this.scene.scale;
    const rect = this.paper.layout(width, height);
    const { left, top } = rect;

    this.title
      .setText(`Village Store — ${this.purse.coins} coins`)
      .setPosition(rect.centreX, top + PAD);
    this.closeRect.setPosition(left + rect.width - PAD - 2, top + PAD + 2);
    this.closeText.setPosition(this.closeRect.x, this.closeRect.y);
    this.hint.setPosition(rect.centreX, top + rect.height - PAD);

    // Two columns of equal width, with the gutter between them coming out of
    // the padding rather than out of the rows: a narrow phone shrinks the
    // rows, and rows that shrank unevenly would read as two different lists.
    const columnW = (rect.width - PAD * 2 - PAD) / 2;
    const leftX = left + PAD;
    const rightX = leftX + columnW + PAD;
    const headingY = top + PAD + TITLE_SIZE + 12;
    const firstRowY = headingY + HEADING_SIZE + 8;

    this.sellHeading.setPosition(leftX, headingY);
    this.buyHeading.setPosition(rightX, headingY);

    for (const [index, plant] of PLANT_TYPES.entries()) {
      const row = this.sellRows[index];
      if (!row) continue;
      const held = this.inventory.count(plant);
      this.placeRow(row, leftX, firstRowY + (ROW_H + ROW_GAP) * index, columnW);
      row.label.setText(`${held} x ${plant}\n+${CROP_PRICE} each`);
      row.label.setColor(held > 0 ? INK : INK_DIM);
      row.icon.setAlpha(held > 0 ? 1 : 0.35);
    }
    for (const [index, fixture] of PLACEABLE_FIXTURES.entries()) {
      const row = this.buyRows[index];
      if (!row) continue;
      const price = priceOf(fixture);
      const affordable = this.purse.coins >= price;
      this.placeRow(row, rightX, firstRowY + (ROW_H + ROW_GAP) * index, columnW);
      row.label.setText(`${fixture}\n${price} coins`);
      row.label.setColor(affordable ? INK : INK_DIM);
      row.icon.setAlpha(affordable ? 1 : 0.35);
    }
  }

  private placeRow(row: Row, x: number, y: number, width: number): void {
    row.box.setSize(width, ROW_H).setPosition(x + width / 2, y + ROW_H / 2);
    // A Rectangle's hit area is its own geometry and follows `setSize`; that
    // is checked rather than assumed, and is why these are Shapes and the
    // icons on them are not interactive.
    row.icon.setPosition(x + ICON_INSET, y + ROW_H / 2);
    row.label.setPosition(x + ICON_INSET + 20, y + ROW_H / 2);
  }

  private label(text: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.scene.add.text(0, 0, text, {
      fontFamily: "monospace",
      fontSize: `${size}px`,
      color,
      lineSpacing: 2,
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
