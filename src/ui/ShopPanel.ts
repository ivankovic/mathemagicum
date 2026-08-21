// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import type { Phrases } from "../i18n/phrases";
import {
  CURRENCY,
  CoinTier,
  MOST_DENOMINATIONS,
  coinTier,
  totalOf as coinTotal,
  coinsFor,
} from "../shop/currency";
import { MAX_OFFER_COINS, type Offer, judgeOffer, makeOffer, maxSaleCount } from "../shop/payment";
import {
  type Tender,
  addCoin,
  beginTender,
  clearTender,
  coinCount,
  difference,
  isExact,
  removeCoin,
  tenderTotal,
} from "../shop/tender";
import { type FixtureType, PLACEABLE_FIXTURES } from "../world/fixtures";
import type { Inventory, ItemType } from "../world/inventory";
import { MATERIAL_TYPES, materialIcon } from "../world/materials";
import { PLANT_TYPES } from "../world/plants";

/**
 * Everything the store buys, in the order it is listed.
 *
 * Crops first because they are what a garden makes; the cleared materials
 * after, because they are what the world gives up and a child meets them
 * second.
 */
const SOLD: readonly { item: ItemType; icon: string }[] = [
  ...PLANT_TYPES.map((plant) => ({ item: plant as ItemType, icon: cropIcon(plant) })),
  ...MATERIAL_TYPES.map((material) => ({
    item: material as ItemType,
    icon: materialIcon(material),
  })),
];
import type { Rng } from "../world/rng";
import { CROP_PRICE, MAX_TRADE, type Purse, priceOf, sellPriceOf } from "../world/shop";
import { PANEL_PAD as PAD, ParchmentPanel } from "./ParchmentPanel";
import { type UiIndex, coinIcon, cropIcon, itemIcon, uiTextureKey } from "./assets";

/**
 * The village store, and the two things it teaches.
 *
 * Buying is counting money out: pick a thing and how many, then put the exact
 * sum on the counter coin by coin. Selling is checking money: the shopkeeper
 * counts a payment out and the player says whether it is right — she is wrong
 * about one time in ten.
 *
 * Both are one screen deep. A shop is not a menu system, and every extra
 * level between "I want three fences" and the arithmetic is a level a child
 * has to hold in their head instead of the sum.
 *
 * The panel is a small state machine because the two games ask for different
 * things at different moments; the rules of each live in src/shop/, which has
 * no Phaser in it and is tested without a browser.
 */

const PANEL_MAX_W = 470;
const PANEL_MAX_H = 470;
const PANEL_MIN_W = 280;
const PANEL_MIN_H = 320;

const INK = "#4a3422";
const INK_DIM = "#8a6a48";
const INK_GOOD = "#3d6b2a";
const INK_BAD = "#a8321e";
const INK_HEX = 0x4a3422;
const PAPER_PALE_HEX = 0xf6e8c4;
const PAPER_HEX = 0xdec694;
const GOOD_HEX = 0x3d6b2a;
const ACTIVE_HEX = 0xc8901c;

const TITLE_SIZE = 17;
const ROW_SIZE = 13;
const SMALL_SIZE = 12;

const ROW_H = 38;
const ROW_GAP = 4;
const COIN_H = 34;
/** How big a coin face is drawn: the art is 32px, the button is 34 high. */
const COIN_ART = 22;
const COIN_GAP = 5;

type Mode = "menu" | "buy" | "sell";

interface Button {
  readonly box: Phaser.GameObjects.Rectangle;
  readonly label: Phaser.GameObjects.Text;
  readonly icon?: Phaser.GameObjects.Image;
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
  private readonly closeButton: Button;

  // Menu: one row per crop she will buy, one per thing she sells.
  private readonly sellRows: Button[] = [];
  private readonly buyRows: Button[] = [];
  private readonly headings: Phaser.GameObjects.Text[] = [];

  // Counter: the quantity picker and the coin pad, shared by both games.
  private readonly fewer: Button;
  private readonly more: Button;
  private readonly quantityLabel: Phaser.GameObjects.Text;
  private readonly runningTotal: Phaser.GameObjects.Text;
  private readonly coinButtons: Button[] = [];
  /**
   * Her coins, laid on the counter. Separate from the pad because there is one
   * pad button per denomination but she can put the same coin down twice, and
   * because hers are to be counted, not tapped.
   */
  private readonly offerChips: Button[] = [];
  private readonly confirm: Button;
  private readonly deny: Button;
  private readonly back: Button;

  private open = false;
  private mode: Mode = "menu";
  private chosenFixture: FixtureType | null = null;
  private chosenCrop: ItemType | null = null;
  private quantity = 1;
  private tender: Tender | null = null;
  private offer: Offer | null = null;
  private settled = false;
  private onClose: (() => void) | null = null;
  private onTrade: (() => void) | null = null;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    index: UiIndex,
    depth: number,
    private readonly inventory: Inventory,
    private readonly purse: Purse,
    private words: Phrases,
    private readonly rng: Rng,
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
    this.hint = this.own(this.text("", SMALL_SIZE, INK_DIM).setOrigin(0.5, 1).setAlign("center"));
    for (let i = 0; i < 2; i++) {
      this.headings.push(this.own(this.text("", SMALL_SIZE, INK_DIM).setOrigin(0, 0)));
    }

    // Everything she comes back with, crops and cleared materials alike:
    // both are hers, both are the store's price, and a wood pile she could
    // not sell would be a thing the world gave her for nothing.
    for (const { item, icon } of SOLD) {
      this.sellRows.push(this.button(uiTextureKey(icon), () => this.startSell(item)));
    }
    for (const fixture of PLACEABLE_FIXTURES) {
      this.buyRows.push(this.button(uiTextureKey(itemIcon(fixture)), () => this.startBuy(fixture)));
    }

    this.fewer = this.button(null, () => this.setQuantity(this.quantity - 1));
    this.more = this.button(null, () => this.setQuantity(this.quantity + 1));
    this.quantityLabel = this.own(this.text("", ROW_SIZE, INK).setOrigin(0.5));
    this.runningTotal = this.own(this.text("", ROW_SIZE, INK).setOrigin(0.5));
    // One button per denomination the widest currency has, so a change of
    // currency re-labels them rather than needing more of them.
    for (let i = 0; i < MOST_DENOMINATIONS; i++) {
      this.coinButtons.push(
        this.button(
          uiTextureKey(coinIcon(CoinTier.Copper)),
          () => this.putDown(this.denomination(i)),
          () => this.takeBack(this.denomination(i)),
        ),
      );
    }
    for (let i = 0; i < MAX_OFFER_COINS; i++) {
      this.offerChips.push(this.chip(uiTextureKey(coinIcon(CoinTier.Copper))));
    }
    this.confirm = this.button(null, () => this.onConfirm());
    this.deny = this.button(null, () => this.onDeny());
    this.back = this.button(null, () => this.toMenu());
    this.closeButton = this.button(null, () => this.close());

    for (const part of this.parts) {
      part
        .setDepth(depth + 1)
        .setScrollFactor(0)
        .setVisible(false);
      register(part);
    }
    for (const button of this.allButtons()) {
      button.icon?.setDepth(depth + 2);
      button.label.setDepth(depth + 2);
    }
  }

  private allButtons(): Button[] {
    return [
      ...this.sellRows,
      ...this.buyRows,
      ...this.coinButtons,
      ...this.offerChips,
      this.fewer,
      this.more,
      this.confirm,
      this.deny,
      this.back,
      this.closeButton,
    ];
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** Say everything from here on in another language. */
  /**
   * What a crop fetches for the child at the counter.
   *
   * Asked of the session rather than fixed here: a younger player's crop is
   * quoted at a whole sun so the counting is money rather than a second
   * puzzle, and everything in this panel — the price list, the coin pad, how
   * many can be sold at once — has to agree about it.
   */
  private askCropPrice: () => number = () => CROP_PRICE;

  private get cropPrice(): number {
    return this.askCropPrice();
  }

  /**
   * Where to ask what a crop is worth — the session, in practice.
   *
   * A question rather than a copy, deliberately. This panel does the money
   * arithmetic: the price list, the coin pad, how many can be sold at once
   * and what the shopkeeper counts out all come from this number, and the
   * session charges the purse from its own. Two copies of it is two things
   * that can disagree, and the way that shows up is a child counting out
   * exactly what the counter asked for and being told it is wrong.
   */
  bindCropPrice(ask: () => number): void {
    this.askCropPrice = ask;
    if (this.isOpen) this.render();
  }

  setPhrases(words: Phrases): void {
    this.words = words;
    if (this.open) this.render();
  }

  // --- opening and closing -------------------------------------------------

  open_(onClose: () => void, onTrade?: () => void): void {
    this.open = true;
    this.onClose = onClose;
    this.onTrade = onTrade ?? null;
    this.paper.setVisible(true);
    this.toMenu();
    this.keyHandler = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (this.mode === "menu") this.close();
      else this.toMenu();
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
    for (const part of this.parts) part.setVisible(false);
    const done = this.onClose;
    this.onClose = null;
    this.onTrade = null;
    done?.();
  }

  layout(): void {
    if (this.open) this.render();
  }

  // --- what the player is doing --------------------------------------------

  private toMenu(): void {
    this.mode = "menu";
    this.chosenFixture = null;
    this.chosenCrop = null;
    this.tender = null;
    this.offer = null;
    this.settled = false;
    this.render();
  }

  private startBuy(fixture: FixtureType): void {
    this.mode = "buy";
    this.chosenFixture = fixture;
    this.quantity = 1;
    this.settled = false;
    this.tender = beginTender(priceOf(fixture, this.cropPrice), this.purse.coins);
    this.render();
  }

  private startSell(plant: ItemType): void {
    if (this.inventory.count(plant) <= 0) return;
    this.mode = "sell";
    this.chosenCrop = plant;
    this.quantity = 1;
    this.settled = false;
    this.offer = makeOffer(CURRENCY, sellPriceOf(plant, this.cropPrice), this.rng);
    this.render();
  }

  /**
   * Change how many are being traded.
   *
   * Recounts from scratch: the coins already on the counter were for the old
   * total, and leaving them there would mean the player thinking they had
   * paid when they had paid for two of three.
   */
  private setQuantity(next: number): void {
    if (this.settled) return;
    this.quantity = Math.max(1, Math.min(this.mostTradeable(), next));
    if (this.mode === "buy" && this.chosenFixture) {
      this.tender = beginTender(
        priceOf(this.chosenFixture, this.cropPrice) * this.quantity,
        this.purse.coins,
      );
    }
    if (this.mode === "sell" && this.chosenCrop) {
      this.offer = makeOffer(
        CURRENCY,
        sellPriceOf(this.chosenCrop, this.cropPrice) * this.quantity,
        this.rng,
      );
    }
    this.render();
  }

  /**
   * The largest number the picker will go to: what there is to sell, or what
   * there is money for. Offering a quantity the player cannot pay for would
   * leave them on a screen where the coin pad refuses every coin.
   */
  private mostTradeable(): number {
    if (this.mode === "sell" && this.chosenCrop) {
      const stock = Math.max(1, Math.min(MAX_TRADE, this.inventory.count(this.chosenCrop)));
      return maxSaleCount(CURRENCY, sellPriceOf(this.chosenCrop, this.cropPrice), stock);
    }
    if (this.mode === "buy" && this.chosenFixture) {
      const affordable = Math.floor(this.purse.coins / priceOf(this.chosenFixture, this.cropPrice));
      return Math.max(1, Math.min(MAX_TRADE, affordable));
    }
    return 1;
  }

  private putDown(value: number): void {
    if (this.mode !== "buy" || !this.tender || this.settled) return;
    this.tender = addCoin(this.tender, value);
    this.render();
  }

  private takeBack(value: number): void {
    if (this.mode !== "buy" || !this.tender || this.settled) return;
    this.tender = removeCoin(this.tender, value);
    this.render();
  }

  private onConfirm(): void {
    // Once a trade is settled the button says "done", and a button that says
    // done has to do something: back to the counter for the next one.
    if (this.settled) {
      this.toMenu();
      return;
    }
    if (this.mode === "buy") this.payUp();
    else if (this.mode === "sell") this.answer(true);
  }

  private onDeny(): void {
    if (this.mode === "buy" && this.tender && !this.settled) {
      this.tender = clearTender(this.tender);
      this.render();
      return;
    }
    if (this.mode === "sell") this.answer(false);
  }

  private payUp(): void {
    const fixture = this.chosenFixture;
    if (!fixture || !this.tender || this.settled) return;
    if (!isExact(this.tender)) {
      this.render();
      return;
    }
    this.settled = true;
    this.onBuy?.(fixture, this.quantity, tenderTotal(this.tender));
    this.onTrade?.();
    this.render();
  }

  private answer(saysCorrect: boolean): void {
    const offer = this.offer;
    const plant = this.chosenCrop;
    if (!offer || !plant || this.settled) return;
    this.settled = true;
    this.verdict = judgeOffer(CURRENCY, offer, saysCorrect, this.words);
    this.onSell?.(plant, this.quantity, this.verdict.paid);
    this.onTrade?.();
    this.render();
  }

  private verdict: ReturnType<typeof judgeOffer> | null = null;

  /** Set by the scene: what to do once a trade has actually been agreed. */
  onBuy: ((fixture: FixtureType, count: number, paid: number) => void) | null = null;
  onSell: ((item: ItemType, count: number, earned: number) => void) | null = null;

  // --- drawing --------------------------------------------------------------

  private render(): void {
    const { width, height } = this.scene.scale;
    const rect = this.paper.layout(width, height);
    for (const part of this.parts) part.setVisible(false);
    this.title.setVisible(true).setPosition(rect.centreX, rect.top + PAD);
    this.hint.setVisible(true).setPosition(rect.centreX, rect.top + rect.height - PAD);
    this.hint.setWordWrapWidth(rect.width - PAD * 2);
    this.place(this.closeButton, rect.left + rect.width - PAD - 13, rect.top + PAD + 13, 26, 26);
    this.closeButton.label.setText("x");
    this.show(this.closeButton);

    if (this.mode === "menu") this.renderMenu(rect);
    else this.renderCounter(rect);
  }

  private renderMenu(rect: { left: number; top: number; width: number; centreX: number }): void {
    this.title.setText(this.words.storeTitle(CURRENCY.format(this.purse.coins)));
    this.fitTitle(rect.width - PAD * 2 - 34);
    this.hint.setText(this.words.storeFooter).setColor(INK_DIM);

    const columnW = (rect.width - PAD * 3) / 2;
    const leftX = rect.left + PAD;
    const rightX = leftX + columnW + PAD;
    const headingY = rect.top + PAD + TITLE_SIZE + 12;
    const firstY = headingY + SMALL_SIZE + 8;

    const [sellHeading, buyHeading] = this.headings as [
      Phaser.GameObjects.Text,
      Phaser.GameObjects.Text,
    ];
    sellHeading.setText(this.words.sheBuys).setVisible(true).setPosition(leftX, headingY);
    buyHeading.setText(this.words.sheSells).setVisible(true).setPosition(rightX, headingY);

    for (const [index, { item }] of SOLD.entries()) {
      const row = this.sellRows[index];
      if (!row) continue;
      const held = this.inventory.count(item);
      this.place(
        row,
        leftX + columnW / 2,
        firstY + (ROW_H + ROW_GAP) * index + ROW_H / 2,
        columnW,
        ROW_H,
      );
      row.label.setText(
        this.words.cropRow(item, held, CURRENCY.format(sellPriceOf(item, this.cropPrice))),
      );
      row.label.setColor(held > 0 ? INK : INK_DIM);
      row.icon?.setAlpha(held > 0 ? 1 : 0.35);
      this.show(row);
    }
    for (const [index, fixture] of PLACEABLE_FIXTURES.entries()) {
      const row = this.buyRows[index];
      if (!row) continue;
      const affordable = this.purse.coins >= priceOf(fixture, this.cropPrice);
      this.place(
        row,
        rightX + columnW / 2,
        firstY + (ROW_H + ROW_GAP) * index + ROW_H / 2,
        columnW,
        ROW_H,
      );
      row.label.setText(
        this.words.stockRow(fixture, CURRENCY.format(priceOf(fixture, this.cropPrice))),
      );
      row.label.setColor(affordable ? INK : INK_DIM);
      row.icon?.setAlpha(affordable ? 1 : 0.35);
      this.show(row);
    }
  }

  private renderCounter(rect: {
    left: number;
    top: number;
    width: number;
    height: number;
    centreX: number;
  }): void {
    const buying = this.mode === "buy";
    const owed = buying
      ? priceOf(this.chosenFixture as FixtureType) * this.quantity
      : (this.offer?.owed ?? 0);
    const money = CURRENCY.format(owed);
    this.title.setText(
      buying
        ? this.words.buyTitle(this.chosenFixture as FixtureType, this.quantity, money)
        : this.words.sellTitle(this.chosenCrop as ItemType, this.quantity, money),
    );
    // German says the same thing in more letters, and the close button is in
    // the top right: a title sized for English ran underneath it.
    this.fitTitle(rect.width - PAD * 2 - 34);

    // Quantity picker.
    const pickerY = rect.top + PAD + TITLE_SIZE + 20;
    this.place(this.fewer, rect.centreX - 62, pickerY, 34, 28);
    this.fewer.label.setText("-");
    this.show(this.fewer);
    this.quantityLabel
      .setVisible(true)
      .setPosition(rect.centreX, pickerY)
      .setText(`${this.quantity}`);
    this.place(this.more, rect.centreX + 62, pickerY, 34, 28);
    this.more.label.setText("+");
    this.show(this.more);

    if (buying) this.renderTender(rect, pickerY);
    else this.renderOffer(rect, pickerY);

    this.place(this.back, rect.left + PAD + 30, rect.top + rect.height - PAD - 34, 60, 26);
    this.back.label.setText(this.words.back);
    this.show(this.back);
  }

  private renderTender(
    rect: { left: number; top: number; width: number; height: number; centreX: number },
    pickerY: number,
  ): void {
    const tender = this.tender;
    if (!tender) return;
    const off = difference(tender);
    this.runningTotal
      .setVisible(true)
      .setPosition(rect.centreX, pickerY + 34)
      .setText(this.words.onTheCounter(CURRENCY.format(tenderTotal(tender))))
      .setColor(off === 0 ? INK_GOOD : INK);

    // One button per coin: tap to add, right-click or long-press to take back.
    const columns = 4;
    const width = (rect.width - PAD * 2 - COIN_GAP * (columns - 1)) / columns;
    const top = pickerY + 58;
    for (const [index, value] of CURRENCY.denominations.entries()) {
      const button = this.coinButtons[index];
      if (!button) continue;
      const x = rect.left + PAD + (width + COIN_GAP) * (index % columns) + width / 2;
      const y = top + Math.floor(index / columns) * (COIN_H + COIN_GAP) + COIN_H / 2;
      this.placeCoin(button, x, y, width, value);
      const held = coinCount(tender, value);
      button.label.setText(
        held > 0 ? `${CURRENCY.coinLabel(value)} x${held}` : CURRENCY.coinLabel(value),
      );
      button.box.setStrokeStyle(2, held > 0 ? ACTIVE_HEX : INK_HEX);
      this.show(button);
    }

    const rows = Math.ceil(CURRENCY.denominations.length / columns);
    const actionY = top + rows * (COIN_H + COIN_GAP) + 16;
    this.place(this.confirm, rect.centreX + 60, actionY, 110, 30);
    this.confirm.label.setText(this.settled ? this.words.done : this.words.pay);
    this.confirm.box.setStrokeStyle(2, isExact(tender) ? GOOD_HEX : INK_HEX);
    this.show(this.confirm);
    if (!this.settled) {
      this.place(this.deny, rect.centreX - 60, actionY, 110, 30);
      this.deny.label.setText(this.words.clear);
      this.show(this.deny);
    }

    if (this.settled) {
      this.hint
        .setText(this.words.paidFor(this.chosenFixture as FixtureType, this.quantity))
        .setColor(INK_GOOD);
    } else if (tender.owed > tender.purse) {
      this.hint.setText(this.words.tooExpensive).setColor(INK_BAD);
    } else if (off === 0) {
      this.hint.setText(this.words.exactlyRight).setColor(INK_GOOD);
    } else if (off < 0) {
      this.hint.setText(this.words.moreToGo(CURRENCY.format(-off))).setColor(INK);
    } else {
      this.hint.setText(this.words.tooMuch(CURRENCY.format(off))).setColor(INK_BAD);
    }
  }

  private renderOffer(
    rect: { left: number; top: number; width: number; height: number; centreX: number },
    pickerY: number,
  ): void {
    const offer = this.offer;
    if (!offer) return;
    this.runningTotal
      .setVisible(true)
      .setPosition(rect.centreX, pickerY + 34)
      .setText(this.words.sheCountsOut)
      .setColor(INK_DIM);

    // Her coins, laid out the same way the pad is, so the two read alike.
    const columns = 4;
    const width = (rect.width - PAD * 2 - COIN_GAP * (columns - 1)) / columns;
    const top = pickerY + 58;
    const shown = Math.min(offer.coins.length, this.offerChips.length);
    for (let index = 0; index < shown; index++) {
      const chip = this.offerChips[index];
      const value = offer.coins[index];
      if (!chip || value === undefined) continue;
      const x = rect.left + PAD + (width + COIN_GAP) * (index % columns) + width / 2;
      const y = top + Math.floor(index / columns) * (COIN_H + COIN_GAP) + COIN_H / 2;
      this.placeCoin(chip, x, y, width, value);
      chip.label.setText(CURRENCY.coinLabel(value));
      this.show(chip);
    }

    const rows = Math.ceil(shown / columns);
    const actionY = top + Math.max(1, rows) * (COIN_H + COIN_GAP) + 16;
    this.place(this.confirm, rect.centreX + 60, actionY, 110, 30);
    this.confirm.label.setText(this.settled ? this.words.done : this.words.thatsRight);
    this.show(this.confirm);
    if (!this.settled) {
      this.place(this.deny, rect.centreX - 60, actionY, 110, 30);
      this.deny.label.setText(this.words.thatsWrong);
      this.show(this.deny);
    }

    if (this.settled && this.verdict) {
      this.hint.setText(this.verdict.message).setColor(this.verdict.right ? INK_GOOD : INK_BAD);
    } else {
      this.hint.setText(this.words.countHerCoins).setColor(INK_DIM);
    }
  }

  // --- plumbing -------------------------------------------------------------

  /** Shrink the title until it fits the paper, rather than off the edge of it. */
  private fitTitle(room: number): void {
    for (let size = TITLE_SIZE; size >= 11; size--) {
      this.title.setFontSize(size);
      if (this.title.width <= room) return;
    }
  }

  private button(texture: string | null, onTap: () => void, onAlt?: () => void): Button {
    const box = this.own(
      this.scene.add
        .rectangle(0, 0, 10, 10, PAPER_PALE_HEX)
        .setStrokeStyle(2, INK_HEX)
        .setInteractive({ useHandCursor: true }),
    );
    const label = this.own(this.text("", ROW_SIZE, INK).setOrigin(0.5).setAlign("center"));
    const icon = texture ? this.own(this.scene.add.image(0, 0, texture)) : undefined;
    box.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      // Right-click takes a coin back, which is what "put one down, no, take
      // it off again" needs and what a second button per coin would cost four
      // rows of panel to provide.
      if (onAlt && pointer.rightButtonDown()) onAlt();
      else onTap();
    });
    return { box, label, icon };
  }

  /** A coin on the counter: it looks like the pad's coins but does nothing. */
  private chip(texture: string): Button {
    const box = this.own(
      this.scene.add.rectangle(0, 0, 10, 10, PAPER_PALE_HEX).setStrokeStyle(2, INK_HEX),
    );
    const label = this.own(this.text("", ROW_SIZE, INK).setOrigin(0.5).setAlign("center"));
    const icon = this.own(this.scene.add.image(0, 0, texture).setDisplaySize(COIN_ART, COIN_ART));
    return { box, label, icon };
  }

  /** The value of the nth pad button in the currency now in the purse. */
  private denomination(index: number): number {
    return CURRENCY.denominations[index] ?? 0;
  }

  /**
   * A coin button: face on the left, value beside it.
   *
   * Its own placement rather than the row one, because a coin button is a
   * third the width of a shop row — the row's inset would push "50 Rp." off
   * the end of it.
   */
  private placeCoin(button: Button, x: number, y: number, width: number, value: number): void {
    button.box.setSize(width, COIN_H).setPosition(x, y);
    button.icon?.setPosition(x - width / 2 + 15, y);
    button.label.setPosition(x - width / 2 + 29, y).setOrigin(0, 0.5);
    this.faceCoin(button, value);
  }

  /** Point a coin button at the right face for what it is worth. */
  private faceCoin(button: Button, value: number): void {
    button.icon?.setTexture(uiTextureKey(coinIcon(coinTier(CURRENCY, value))));
    button.icon?.setDisplaySize(COIN_ART, COIN_ART);
  }

  private place(button: Button, x: number, y: number, width: number, height: number): void {
    button.box.setSize(width, height).setPosition(x, y);
    if (button.icon) {
      button.icon.setPosition(x - width / 2 + 20, y);
      button.label.setPosition(x - width / 2 + 40, y).setOrigin(0, 0.5);
    } else {
      button.label.setPosition(x, y).setOrigin(0.5);
    }
  }

  private show(button: Button): void {
    button.box.setVisible(true);
    button.label.setVisible(true);
    button.icon?.setVisible(true);
  }

  private text(value: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.scene.add.text(0, 0, value, {
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

export { coinsFor, coinTotal };
