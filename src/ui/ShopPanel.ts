// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import type { Phrases } from "../i18n/phrases";
import {
  CURRENCY,
  MOST_DENOMINATIONS,
  type Stack,
  totalOf as coinTotal,
  coinsFor,
  smallestCoin,
  stacksOf,
} from "../shop/currency";
import { MISTAKE_MAX_COINS, type Offer, judgeOffer, makeOffer } from "../shop/payment";
import { type Spot, type TableArea, counterSpots, pileSpots, within } from "../shop/table";
import {
  MOST_COUNTER_COINS,
  type Tender,
  addCoin,
  beginTender,
  clearTender,
  difference,
  isExact,
  removeCoin,
  tenderTotal,
  tenderedCoins,
} from "../shop/tender";
import { DECOR_LOOKS, DecorType, pieceArt, takesAColour } from "../world/decor";
import { type FixtureType, PLACEABLE_FIXTURES } from "../world/fixtures";
import { GROWABLE_ROOM, growablePieceKey } from "../world/interiors";
import type { Inventory, ItemType } from "../world/inventory";
import { MATERIAL_TYPES } from "../world/materials";
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
import {
  type Buyable,
  CROP_PRICE,
  FURNITURE_STOCK,
  MOST_PER_SHELF,
  type Purse,
  SHELVES,
  SHOP_STOCK,
  isFurniture,
  mostBuyable,
  mostSellable,
  priceOf,
  sellPriceOf,
} from "../world/shop";
import { PANEL_PAD as PAD, ParchmentPanel } from "./ParchmentPanel";
import { type UiIndex, coinIcon, cropIcon, itemIcon, materialIcon, uiTextureKey } from "./assets";
import { INK, INK_DIM, INK_HEX, PAPER_HEX, PAPER_PALE_HEX } from "./parchment";

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

const INK_GOOD = "#3d6b2a";
const INK_BAD = "#a8321e";
const GOOD_HEX = 0x3d6b2a;

const TITLE_SIZE = 17;
const ROW_SIZE = 13;
const SMALL_SIZE = 12;

const ROW_H = 38;
/** And the shortest, before an icon and two lines stop being readable. */
const ROW_MIN_H = 26;
/** How big one colourway is drawn on the counter. */
const SWATCH = 34;
const ROW_GAP = 4;
/**
 * The shelf tabs: as wide as they are tall, and no bigger than this.
 *
 * A cap rather than a share of the column, because four square buttons that
 * grew with a wide parchment would be four very large pictures of a fence.
 * The gap is the rows' own, so the tabs sit in the same rhythm as what is
 * under them.
 */
// Tight around the art rather than generous: a piece is drawn on a 32-pixel
// cell and is drawn here at 1:1, because pixel art at nine tenths of its own
// size is pixel art with some rows thinner than others. A bigger button would
// only be more empty parchment around the same picture.
const TAB_MAX_W = 38;
const TAB_GAP = ROW_GAP;
/** The table's own surface: a shade darker than the parchment it sits on. */
const TABLE_HEX = 0xcbb083;
/** How many coins are drawn in a pile. A picture of a pile, not a count. */
const PILE_DEPTH = 4;
/** The name written under a pile. Smaller than a row: four must fit across. */
const PILE_NAME_SIZE = 11;
/** How far each coin in a pile sits above the one under it. */
const PILE_RISE = 5;
/** How big a coin is on the table — near enough its own size to stay crisp. */
const TABLE_COIN = 34;
/** The value struck on a coin's face, and the ink it is struck in. */
const COIN_FACE_SIZE = 13;
const FACE_INK = "#2b1d0d";
/** How far a finger may wander and still count as a tap rather than a drag. */
const TAP_SLOP = 6;

type Mode = "menu" | "buy" | "sell";

/**
 * Everything the store sells, in the order it is listed.
 *
 * The garden's things first, because they are what a child meets first and
 * what the game asks them to build with; the house's after, because a room
 * to furnish is something you have before you have anything to put in it.
 *
 * Kept, though nothing draws it as one column any more — it is what the
 * shelves are checked against, so that a thing which exists, has a price and
 * has a noun in three languages cannot end up on no shelf at all.
 */
const STOCK: readonly Buyable[] = [...SHOP_STOCK, ...FURNITURE_STOCK];

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
  private readonly lookRows: Button[] = [];
  /**
   * The shelf tabs, and which of them is out.
   *
   * The stock outgrew a single column — see `SHELVES`. The rows below are
   * built once, to the length of the longest shelf, and re-pointed at
   * whichever shelf is showing; a set of buttons per shelf would be four
   * times the objects for a panel that only ever draws one of them.
   */
  private readonly tabs: Button[] = [];
  private shelf = 0;
  private readonly headings: Phaser.GameObjects.Text[] = [];

  // Counter: the quantity picker and the coin pad, shared by both games.
  private readonly fewer: Button;
  private readonly more: Button;
  private readonly quantityLabel: Phaser.GameObjects.Text;
  private readonly runningTotal: Phaser.GameObjects.Text;
  /**
   * The table she pays on: piles to the left, the counter to the right.
   *
   * `pileFaces` is a short stack of coins per denomination — a picture of a
   * pile rather than a count of one, because the piles are a supply she
   * draws from and not her own hoard. The purse is a single number and
   * always was; what stops her overpaying is the purse, not the pile
   * running dry. A pile that emptied would be lying about which.
   */
  private readonly tableTop: Phaser.GameObjects.Rectangle;
  private readonly tableSplit: Phaser.GameObjects.Rectangle;
  /** Her side of it, drawn paler: the place the coins are meant to end up. */
  private readonly tableCounter: Phaser.GameObjects.Rectangle;
  private readonly pileFaces: Phaser.GameObjects.Image[][] = [];
  private readonly pileLabels: Phaser.GameObjects.Text[] = [];
  private readonly pileValues: Phaser.GameObjects.Text[] = [];
  private readonly pileHits: Phaser.GameObjects.Rectangle[] = [];
  /** The coins she has put down, and the number struck on each. */
  private readonly counterFaces: {
    image: Phaser.GameObjects.Image;
    label: Phaser.GameObjects.Text;
  }[] = [];
  /** The one coin in her hand, mid-drag, or nothing. */
  private carried: {
    value: number;
    image: Phaser.GameObjects.Image;
    label: Phaser.GameObjects.Text;
  } | null = null;
  /** Where the carried coin was lifted from, to tell a tap from a drag. */
  private carriedFrom: Spot | null = null;
  /** Where the counter half is, so a dropped coin knows whether it landed. */
  private counterAt: { origin: Spot; area: TableArea } | null = null;
  private readonly confirm: Button;
  private readonly deny: Button;
  private readonly back: Button;

  private open = false;
  private mode: Mode = "menu";
  private chosenBuy: Buyable | null = null;
  /**
   * Which colourway of a piece of furniture is being bought.
   *
   * Only furniture has one. A fence is a fence; a chair is a chair in a
   * colour, and the colour is part of what she ends up owning rather than a
   * label on it — see `buyStock`.
   */
  private chosenLook = 0;
  private chosenCrop: ItemType | null = null;
  private quantity = 1;
  private tender: Tender | null = null;
  private offer: Offer | null = null;
  private settled = false;
  /** Whose counter this is. Set as it opens; see `open_`. */
  private keeper = "";
  private onClose: (() => void) | null = null;
  private onTrade: (() => void) | null = null;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    index: UiIndex,
    private readonly depth: number,
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
    // Everything she sells, a shelf at a time. It was one column, on the
    // argument that a child looking for a chair should not have to know
    // which half of the shop it lives in — which held at seven things and
    // does not at eighteen, because the eighteenth is drawn underneath the
    // footer. See `SHELVES`.
    //
    // One row per position rather than one per thing: the row is re-pointed
    // at whatever stands there on the shelf that is out, which is why the
    // handler asks at the time of the tap rather than closing over a thing.
    for (let at = 0; at < MOST_PER_SHELF; at++) {
      // Built with a picture on it, and repainted at every render. A button
      // made with no texture has no icon *object*, and `setTexture` on a
      // thing that does not exist is not an error — it is a shelf of rows
      // with the prices right and nothing to look at.
      const placeholder = SHELVES[0]?.stock[0];
      this.buyRows.push(
        this.button(placeholder === undefined ? null : this.iconFor(placeholder), () => {
          const thing = this.onShelf()[at];
          if (thing !== undefined) this.startBuy(thing);
        }),
      );
    }
    // And the tabs. Each carries one of its own things as its picture — much
    // of the audience cannot read, and four words would be the one place in
    // the game where finding what you want required it.
    for (const [at, shelf] of SHELVES.entries()) {
      this.tabs.push(this.button(this.iconFor(shelf.icon), () => this.showShelf(at)));
    }
    // One swatch per colourway, shown while a piece of furniture is being
    // bought. Every colour is offered, which is the opposite of the crate's
    // chooser — that one offers only what she owns, because offering five
    // when one is owned would be four taps that do nothing. Here she owns
    // none of them, so filtering by ownership would sell nothing at all.
    for (let look = 0; look < DECOR_LOOKS; look++) {
      this.lookRows.push(
        this.button(growablePieceKey(GROWABLE_ROOM, pieceArt(DecorType.Chair)), () =>
          this.chooseLook(look),
        ),
      );
    }

    this.fewer = this.button(null, () => this.setQuantity(this.quantity - 1));
    this.more = this.button(null, () => this.setQuantity(this.quantity + 1));
    this.quantityLabel = this.own(this.text("", ROW_SIZE, INK).setOrigin(0.5));
    this.runningTotal = this.own(this.text("", ROW_SIZE, INK).setOrigin(0.5));
    // The table, and the line down it. Drawn rather than left implicit: the
    // whole instruction is "bring coins across to this side", and a side
    // nobody drew is a side nobody aims at.
    this.tableTop = this.own(
      this.scene.add.rectangle(0, 0, 10, 10, TABLE_HEX).setStrokeStyle(2, INK_HEX),
    );
    this.tableSplit = this.own(this.scene.add.rectangle(0, 0, 2, 10, INK_HEX, 0.35));
    this.tableCounter = this.own(
      this.scene.add.rectangle(0, 0, 10, 10, PAPER_PALE_HEX, 0.55).setStrokeStyle(1, INK_HEX, 0.4),
    );

    // One pile per denomination the widest currency has, so a change of
    // currency re-labels them rather than needing more of them.
    for (let i = 0; i < MOST_DENOMINATIONS; i++) {
      const stack: Phaser.GameObjects.Image[] = [];
      for (let layer = 0; layer < PILE_DEPTH; layer++) {
        stack.push(
          this.own(this.scene.add.image(0, 0, uiTextureKey(coinIcon(smallestCoin(CURRENCY))))),
        );
      }
      this.pileFaces.push(stack);
      // The number on the top coin of the pile, for the same reason the
      // coins on the counter carry one: two of the four are gold and the
      // same size, and a colour cannot tell a two from a five.
      this.pileValues.push(this.own(this.text("", COIN_FACE_SIZE, FACE_INK).setOrigin(0.5)));
      // Small, because four names have to sit side by side under four piles
      // without touching: "1 ducat" beside "2 ducat" at row size ran them
      // into one word.
      this.pileLabels.push(this.own(this.text("", PILE_NAME_SIZE, INK).setOrigin(0.5, 0)));
      const hit = this.own(
        this.scene.add
          .rectangle(0, 0, 10, 10, 0xffffff, 0)
          .setInteractive({ useHandCursor: true, draggable: true }),
      );
      hit.on("pointerdown", (pointer: Phaser.Input.Pointer) =>
        this.takeFromPile(this.denomination(i), pointer),
      );
      this.pileHits.push(hit);
    }
    // As many loose coins as are ever laid out singly, made once. Beyond
    // that they are gathered into piles, and a pile is drawn by the same
    // widgets the buying side takes its coins from — so this pool is sized
    // by what a *payment* holds, plus room for a miscount on top.
    for (let i = 0; i < MOST_COUNTER_COINS + MISTAKE_MAX_COINS; i++) {
      const image = this.own(
        this.scene.add
          .image(0, 0, uiTextureKey(coinIcon(smallestCoin(CURRENCY))))
          .setInteractive({ useHandCursor: true }),
      );
      const label = this.own(this.text("", COIN_FACE_SIZE, FACE_INK).setOrigin(0.5));
      image.on("pointerdown", () => this.takeBack(this.counterValueAt(i)));
      this.counterFaces.push({ image, label });
    }
    this.carried = null;
    // The coin in her hand follows the pointer, and lands when she lets go.
    // On the scene rather than on the coin because a finger that slides off
    // the coin it picked up is still carrying it.
    this.scene.input.on("pointermove", this.onPointerMove, this);
    this.scene.input.on("pointerup", this.onPointerUp, this);
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

  /**
   * Where every button on the counter is, so a script can press one.
   *
   * The same seam the other panels carry, and this one went without it for
   * a long while: the shop is the only screen in the game with arithmetic a
   * child can get *wrong on the coins* rather than on the sum, and nothing
   * could drive it to find out. Named by what they do rather than by index,
   * because a row's position moves with the stock list and a test pinned to
   * `buy.3` is a test that quietly starts checking a different fence.
   */
  buttonPositions(): Record<string, { x: number; y: number }> {
    if (!this.open) return {};
    const at: Record<string, { x: number; y: number }> = {
      "shop.close": { x: this.closeButton.box.x, y: this.closeButton.box.y },
    };
    if (this.mode === "menu") {
      // Only what is on the shelf that is out. A script that wants a bath
      // has to turn to the washroom first, exactly as a child does — and a
      // position reported for something not on screen would be a tap that
      // silently bought whatever was there instead.
      for (const [index, item] of this.onShelf().entries()) {
        const row = this.buyRows[index];
        if (row) at[`shop.buy.${item}`] = { x: row.box.x, y: row.box.y };
      }
      for (const [index, tab] of this.tabs.entries()) {
        at[`shop.shelf.${index}`] = { x: tab.box.x, y: tab.box.y };
      }
      for (const [index, plant] of PLANT_TYPES.entries()) {
        const row = this.sellRows[index];
        if (row) at[`shop.sell.${plant}`] = { x: row.box.x, y: row.box.y };
      }
      return at;
    }
    at["shop.fewer"] = { x: this.fewer.box.x, y: this.fewer.box.y };
    at["shop.more"] = { x: this.more.box.x, y: this.more.box.y };
    at["shop.back"] = { x: this.back.box.x, y: this.back.box.y };
    if (this.mode === "buy") {
      for (const [look, row] of this.lookRows.entries()) {
        if (row.box.visible) at[`shop.look.${look}`] = { x: row.box.x, y: row.box.y };
      }
      for (const [index, value] of CURRENCY.denominations.entries()) {
        const pile = this.pileHits[index];
        if (pile) at[`shop.pile.${value}`] = { x: pile.x, y: pile.y };
      }
      // The half of the table she drags coins onto. A script needs somewhere
      // to let go as much as somewhere to pick up, and the drop being a
      // region rather than a button is exactly why it has to be published:
      // there is nothing on screen for a test to find by name otherwise.
      if (this.counterAt) {
        at["shop.counter"] = {
          x: this.counterAt.origin.x + this.counterAt.area.width / 2,
          y: this.counterAt.origin.y + this.counterAt.area.height / 2,
        };
      }
      at["shop.clear"] = { x: this.deny.box.x, y: this.deny.box.y };
      at["shop.pay"] = { x: this.confirm.box.x, y: this.confirm.box.y };
    } else {
      at["shop.yes"] = { x: this.confirm.box.x, y: this.confirm.box.y };
      at["shop.no"] = { x: this.deny.box.x, y: this.deny.box.y };
    }
    return at;
  }

  /**
   * What the counter says right now, for a script that cannot read a
   * parchment: the mode, what is being traded, how many, and what is owed.
   */
  get counter(): {
    mode: Mode;
    item: string | null;
    quantity: number;
    most: number;
    owed: number;
    onCounter: number;
    look: number;
    /**
     * How many piles her money is in, or nought when it is loose coins.
     *
     * Which of the two she is showing is a rule — loose while they can be
     * counted, piles when they cannot — and it is a rule about a drawing,
     * so there is nothing for a script to read but this.
     */
    piles: number;
    /** What the heading over the counter says, word for word. */
    title: string;
  } | null {
    if (!this.open) return null;
    return {
      mode: this.mode,
      item: this.chosenBuy ?? this.chosenCrop ?? null,
      quantity: this.quantity,
      most: this.mostTradeable(),
      owed:
        this.mode === "buy" && this.chosenBuy
          ? priceOf(this.chosenBuy, this.cropPrice) * this.quantity
          : (this.offer?.owed ?? 0),
      onCounter: this.tender ? tenderTotal(this.tender) : 0,
      /** Which colourway is chosen, for a thing that comes in colours. */
      look: this.chosenLook,
      piles:
        this.mode === "sell" && this.offer && this.offer.coins.length > MOST_COUNTER_COINS
          ? stacksOf(this.offer.coins).length
          : 0,
      // Read back rather than recomputed, so a scenario can catch the
      // heading disagreeing with the sum underneath it. Nothing could see
      // this, and it spent a while saying the wrong price.
      title: this.title.text,
    };
  }

  private allButtons(): Button[] {
    return [
      ...this.sellRows,
      ...this.buyRows,
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

  /**
   * Opened behind a particular counter.
   *
   * One panel serves every shop in the world — there are seven of them and
   * they are all the same shop with a different woman in it — so who is
   * standing there is told to it as it opens rather than built into it. It
   * is also the only thing that differs: the stock, the prices and the
   * arithmetic are the same wherever you buy.
   */
  open_(keeper: string, onClose: () => void, onTrade?: () => void): void {
    this.open = true;
    this.keeper = keeper;
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
    this.chosenBuy = null;
    this.chosenCrop = null;
    this.tender = null;
    this.offer = null;
    this.settled = false;
    this.render();
  }

  private startBuy(thing: Buyable): void {
    this.mode = "buy";
    this.chosenBuy = thing;
    // Whatever colour she was last shown, so a second chair matches the
    // first without her having to choose again.
    this.quantity = 1;
    this.settled = false;
    this.tender = beginTender(priceOf(thing, this.cropPrice), this.purse.coins);
    this.render();
  }

  /** Which colourway to buy this piece in: the second of the two taps. */
  private chooseLook(look: number): void {
    if (this.settled || this.chosenLook === look) return;
    this.chosenLook = look;
    this.render();
  }

  private startSell(plant: ItemType): void {
    if (this.inventory.count(plant) <= 0) return;
    this.mode = "sell";
    this.chosenCrop = plant;
    // The whole basket, rather than one of them. Selling has no flat limit
    // any more, so the picker's range is however many she picked — and
    // stepping from one up to forty is forty taps to reach the thing
    // everybody wanted. Coming down from all of them is the rarer wish, and
    // it is the same two buttons either way.
    this.quantity = Math.max(1, this.mostTradeable());
    this.settled = false;
    // For the whole quantity, not for one. It counted out a single crop's
    // worth while the picker above it said nine, which was fine only while
    // the picker always opened at one.
    this.offer = makeOffer(CURRENCY, sellPriceOf(plant, this.cropPrice) * this.quantity, this.rng);
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
    if (this.mode === "buy" && this.chosenBuy) {
      this.tender = beginTender(
        priceOf(this.chosenBuy, this.cropPrice) * this.quantity,
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
      return mostSellable(this.chosenCrop, this.inventory.count(this.chosenCrop), this.cropPrice);
    }
    if (this.mode === "buy" && this.chosenBuy) {
      return mostBuyable(this.chosenBuy, this.purse.coins, this.cropPrice);
    }
    return 1;
  }

  /**
   * Pick a coin off a pile and start carrying it.
   *
   * A copy off the top rather than the pile itself: the piles are a supply,
   * so what she lifts is another one of these, and the pile it came from
   * looks exactly as it did. Refused when there is no room in the purse for
   * it, and refused silently — a coin that will not lift says what a coin
   * that lifts and bounces back would say, without the bounce.
   */
  private takeFromPile(value: number, pointer: Phaser.Input.Pointer): void {
    if (this.mode !== "buy" || !this.tender || this.settled || this.carried) return;
    if (tenderTotal(this.tender) + value > this.tender.purse) return;
    const image = this.own(
      this.scene.add.image(pointer.x, pointer.y, uiTextureKey(coinIcon(value))),
    );
    const label = this.own(this.text(this.faceOf(value), COIN_FACE_SIZE, FACE_INK).setOrigin(0.5));
    // Above everything, including the parchment it is being carried across.
    image
      .setDisplaySize(TABLE_COIN, TABLE_COIN)
      .setDepth(this.depth + 4)
      .setScrollFactor(0)
      .setVisible(true);
    label
      .setPosition(pointer.x, pointer.y)
      .setDepth(this.depth + 5)
      .setScrollFactor(0);
    label.setVisible(true);
    this.carried = { value, image, label };
    this.carriedFrom = { x: pointer.x, y: pointer.y };
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    const carried = this.carried;
    if (!carried) return;
    carried.image.setPosition(pointer.x, pointer.y);
    carried.label.setPosition(pointer.x, pointer.y);
  }

  /**
   * Let go of the coin.
   *
   * It counts if it landed on the counter — and it counts if she never
   * really moved it at all, because a tap on a pile is a child saying "one
   * of those" and refusing that would be refusing the easiest way to ask.
   * Anywhere else and the coin goes back where it came from, which is what
   * "no, not that one" has to look like.
   */
  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    const carried = this.carried;
    if (!carried) return;
    this.carried = null;
    carried.image.destroy();
    carried.label.destroy();
    const from = this.carriedFrom;
    const tapped = from !== null && Math.hypot(pointer.x - from.x, pointer.y - from.y) <= TAP_SLOP;
    this.carriedFrom = null;
    const landed =
      this.counterAt !== null &&
      within({ x: pointer.x, y: pointer.y }, this.counterAt.origin, this.counterAt.area);
    if (landed || tapped) this.putDown(carried.value);
  }

  /**
   * Lay a row of coins out on a patch of table.
   *
   * The one drawing both halves of the shop use. They were two — a pad of
   * labelled buttons for her offer, coins on a table for the payment — and
   * two drawings of the same thing drift apart by the week: the sell screen
   * was still the old keypad's look a change later, side by side with the
   * table it was supposed to match.
   */
  private layCoins(values: readonly number[], origin: Spot, area: TableArea): void {
    const { size, spots } = counterSpots(values.length, area, TABLE_COIN);
    for (const [index, face] of this.counterFaces.entries()) {
      const value = values[index];
      const spot = spots[index];
      if (value === undefined || !spot) continue;
      const x = origin.x + spot.x;
      const y = origin.y + spot.y;
      face.image
        .setTexture(uiTextureKey(coinIcon(value)))
        .setDisplaySize(size, size)
        .setPosition(x, y)
        .setVisible(true);
      this.strike(face.label, value, x, y, size);
    }
  }

  /**
   * Lay her money out as piles, one per kind of coin, each saying how many.
   *
   * Drawn with the very widgets the buying side takes coins *from*, which is
   * the point rather than a saving: a pile of five-ducat pieces should look
   * the same whoever it belongs to, and two drawings of a pile would be two
   * things to keep in step.
   */
  private layStacks(stacks: readonly Stack[], origin: Spot, area: TableArea): void {
    const spots = pileSpots(stacks.length, area);
    for (const [index, stack] of stacks.entries()) {
      const spot = spots[index];
      const faces = this.pileFaces[index];
      const label = this.pileLabels[index];
      if (!spot || !faces || !label) continue;
      const x = origin.x + spot.x;
      // Her piles sit a little high, because the count goes underneath them.
      const base = origin.y + spot.y + 6;
      // A taller stack for more coins, up to what the widget has: a pile of
      // twelve that looked like a pile of two would be saying the wrong
      // thing before the number under it got a chance to say the right one.
      const drawn = Math.max(2, Math.min(faces.length, stack.count));
      for (const [layer, face] of faces.entries()) {
        if (layer >= drawn) continue;
        face
          .setTexture(uiTextureKey(coinIcon(stack.value)))
          .setDisplaySize(TABLE_COIN, TABLE_COIN)
          .setPosition(x + layer, base - layer * PILE_RISE)
          .setVisible(true);
      }
      const struck = this.pileValues[index];
      if (struck) this.strike(struck, stack.value, x + (drawn - 1), base - (drawn - 1) * PILE_RISE);
      // "6 x 5 ducat" — the multiplication written out, because that is the
      // sum being asked for and a bare "x6" leaves a child to remember what
      // the coin under it was worth.
      label
        .setText(`${stack.count} x ${CURRENCY.coinLabel(stack.value)}`)
        .setPosition(x, base + TABLE_COIN / 2 - 2)
        .setVisible(true);
    }
  }

  /** What is struck on the nth coin lying on the counter. */
  private counterValueAt(index: number): number {
    return this.tender ? (tenderedCoins(this.tender)[index] ?? 0) : 0;
  }

  /**
   * The number struck on a coin's face.
   *
   * The numeral only, without the unit — a 50-mite piece says "50" and a
   * two-ducat piece says "2", which is the same restart every mixed-unit
   * money has and the same one every real coin lives with. What keeps it
   * honest is that the *size* never restarts: the fifty is the smallest disc
   * on the table and the five-ducat the largest, so a bigger coin is always
   * worth more even where its number is smaller.
   */
  private faceOf(value: number): string {
    const label = CURRENCY.coinLabel(value);
    return label.split(" ")[0] ?? String(value);
  }

  /**
   * Strike a value onto a coin.
   *
   * Two digits on the smallest disc need smaller type than one digit on the
   * largest: "50" set at the size "5" is set at overhangs the copper it is
   * struck on, and a number sitting half on the table is a number a child
   * reads as belonging to nothing.
   */
  private strike(
    label: Phaser.GameObjects.Text,
    value: number,
    x: number,
    y: number,
    size = TABLE_COIN,
  ): void {
    const face = this.faceOf(value);
    // Scaled with the coin, because a sale can shrink the coins to fit and a
    // number that did not shrink with them would sit across two of them.
    const room = (COIN_FACE_SIZE * size) / TABLE_COIN;
    label
      .setText(face)
      .setFontSize(Math.max(8, Math.round(face.length > 1 ? room - 3 : room)))
      .setPosition(x, y)
      .setVisible(true);
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
    const thing = this.chosenBuy;
    if (!thing || !this.tender || this.settled) return;
    if (!isExact(this.tender)) {
      this.render();
      return;
    }
    this.settled = true;
    this.onBuy?.(thing, this.quantity, tenderTotal(this.tender), this.chosenLook);
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
  onBuy: ((thing: Buyable, count: number, paid: number, look: number) => void) | null = null;
  /**
   * The picture of one piece in one colourway.
   *
   * Asked of the scene rather than worked out here: recolouring a sheet
   * means a palette, a plan and a cache, all of which the scene already has
   * for the furniture standing in the room — and two of them would be two
   * caches of the same pictures under two keys.
   */
  lookTexture: ((piece: DecorType, look: number) => string) | null = null;
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

  private renderMenu(rect: {
    left: number;
    top: number;
    width: number;
    height: number;
    centreX: number;
  }): void {
    this.title.setText(this.words.storeTitle(CURRENCY.format(this.purse.coins)));
    this.fitTitle(rect.width - PAD * 2 - 34);
    this.hint.setText(this.words.storeFooter(this.keeper)).setColor(INK_DIM);

    const columnW = (rect.width - PAD * 3) / 2;
    const leftX = rect.left + PAD;
    const rightX = leftX + columnW + PAD;
    const headingY = rect.top + PAD + TITLE_SIZE + 12;
    const firstY = headingY + SMALL_SIZE + 8;
    // How tall a row can be and still fit the longest of the two columns.
    //
    // Worked out rather than written down: the list grew from seven things
    // to twelve when the shop started selling furniture, and twelve rows at
    // the old height ran off the bottom of the parchment. A number here
    // would have to be found again the next time something is added — and
    // would still be wrong on a short screen, which this now also handles.
    // The taller of the two columns, and her side now carries a row of tabs
    // above its stock — so the budget is the shelf, plus the tabs, against
    // the basket's list.
    const rows = Math.max(SOLD.length, MOST_PER_SHELF + 1);
    const room = rect.top + rect.height - PAD - SMALL_SIZE - 12 - firstY;
    const rowH = Math.max(ROW_MIN_H, Math.min(ROW_H, Math.floor(room / rows) - ROW_GAP));
    // Two lines of type in a shorter row need shorter type, or the price
    // sits on the border of the row beneath it.
    const rowSize = rowH < ROW_H - 4 ? ROW_SIZE - 2 : ROW_SIZE;

    const [sellHeading, buyHeading] = this.headings as [
      Phaser.GameObjects.Text,
      Phaser.GameObjects.Text,
    ];
    sellHeading
      .setText(this.words.keeperBuys(this.keeper))
      .setVisible(true)
      .setPosition(leftX, headingY);
    buyHeading
      .setText(this.words.keeperSells(this.keeper))
      .setVisible(true)
      .setPosition(rightX, headingY);

    for (const [index, { item }] of SOLD.entries()) {
      const row = this.sellRows[index];
      if (!row) continue;
      const held = this.inventory.count(item);
      this.place(
        row,
        leftX + columnW / 2,
        firstY + (rowH + ROW_GAP) * index + rowH / 2,
        columnW,
        rowH,
      );
      row.label.setFontSize(rowSize);
      row.label.setText(
        this.words.cropRow(item, held, CURRENCY.format(sellPriceOf(item, this.cropPrice))),
      );
      row.label.setColor(held > 0 ? INK : INK_DIM);
      row.icon?.setAlpha(held > 0 ? 1 : 0.35);
      this.show(row);
    }
    // The tabs, in a row across the top of her side of the counter. Square,
    // and sized off the column rather than off a constant, so four of them
    // divide the width they have instead of running past it.
    const tabW = Math.min(
      TAB_MAX_W,
      Math.floor((columnW - TAB_GAP * (SHELVES.length - 1)) / SHELVES.length),
    );
    const tabY = firstY + tabW / 2 - TAB_GAP;
    for (const [at, tab] of this.tabs.entries()) {
      this.placeTab(tab, rightX + tabW / 2 + at * (tabW + TAB_GAP), tabY, tabW);
      // The one that is out is the one drawn in full. Dimming the others is
      // the whole of "you are here" — a highlight box would be a second
      // thing on a button that already has a picture on it.
      tab.box.setStrokeStyle(2, INK_HEX, at === this.shelf ? 1 : 0.35);
      tab.icon?.setAlpha(at === this.shelf ? 1 : 0.4);
      this.show(tab);
    }

    const shelfTop = tabY + tabW / 2 + TAB_GAP * 2;
    const stock = this.onShelf();
    for (const [index, row] of this.buyRows.entries()) {
      const fixture = stock[index];
      // A shelf shorter than the longest leaves rows over. They are hidden
      // rather than drawn empty: an outlined box with nothing in it reads as
      // a thing that failed to load.
      if (!fixture) {
        this.hide(row);
        continue;
      }
      const affordable = this.purse.coins >= priceOf(fixture, this.cropPrice);
      // The picture *before* the placing, and the order is load-bearing:
      // `place` scales the icon to the row out of the texture's own size, so
      // a texture swapped afterwards is drawn at whatever scale the last one
      // wanted. On a phone that put a two-cell bed over the row beneath it.
      row.icon?.setTexture(this.iconFor(fixture)).setAlpha(affordable ? 1 : 0.35);
      this.place(
        row,
        rightX + columnW / 2,
        shelfTop + (rowH + ROW_GAP) * index + rowH / 2,
        columnW,
        rowH,
      );
      row.label.setFontSize(rowSize);
      row.label.setText(
        this.words.stockRow(fixture, CURRENCY.format(priceOf(fixture, this.cropPrice))),
      );
      row.label.setColor(affordable ? INK : INK_DIM);
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
    // `this.cropPrice`, not the module default. This asked `priceOf` for the
    // price without saying whose, so it got the default — and the default is
    // one band's price out of three. The heading said 12,50 over a counter
    // that wanted 17,50, and it had been saying the wrong thing to every
    // child not on the band whose price happens to match the constant.
    //
    // It was invisible for as long as that band was the *hardest* one, which
    // is where a save from before the bands existed lands: the one setting
    // most likely to be looked at was the one setting that was right.
    const owed = buying
      ? priceOf(this.chosenBuy as Buyable, this.cropPrice) * this.quantity
      : (this.offer?.owed ?? 0);
    const money = CURRENCY.format(owed);
    this.title.setText(
      buying
        ? this.words.buyTitle(this.chosenBuy as Buyable, this.quantity, money)
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
    // The colour row, when there is one, sits between the quantity and the
    // total — so everything below it shifts down by the height of it.
    // Furniture that can be painted. A bath is tin and a kettle is copper —
    // there is no wood and no cloth in either, so a colourway swaps nothing
    // and five swatches under one is five taps that all do the same thing.
    const swatches =
      this.chosenBuy !== null &&
      isFurniture(this.chosenBuy) &&
      takesAColour(this.chosenBuy as DecorType) &&
      !this.settled;
    const shift = swatches ? SWATCH + 22 : 0;
    this.runningTotal
      .setVisible(true)
      .setPosition(rect.centreX, pickerY + 34 + shift)
      .setText(this.words.onTheCounter(CURRENCY.format(tenderTotal(tender))))
      .setColor(off === 0 ? INK_GOOD : INK);

    // Which colour, when what she is buying comes in colours. Above the
    // table, because it is part of choosing the thing rather than part of
    // paying for it — and because the counter below has to stay where it is
    // whether or not this row is there.
    const buying = this.chosenBuy;
    const colours = buying !== null && isFurniture(buying) && takesAColour(buying as DecorType);
    for (const [look, row] of this.lookRows.entries()) {
      if (!colours || this.settled) {
        row.box.setVisible(false);
        row.label.setVisible(false);
        row.icon?.setVisible(false);
        continue;
      }
      const spread = SWATCH + 8;
      const x = rect.centreX - ((this.lookRows.length - 1) * spread) / 2 + look * spread;
      // Clear of the quantity picker, which is twenty-eight tall and
      // centred on `pickerY`.
      const y = pickerY + 20 + SWATCH / 2;
      row.box.setSize(SWATCH, SWATCH).setPosition(x, y);
      row.box.setStrokeStyle(3, look === this.chosenLook ? GOOD_HEX : INK_HEX);
      row.label.setText("").setPosition(x, y);
      row.icon
        ?.setTexture(
          this.lookTexture?.(buying as DecorType, look) ??
            growablePieceKey(GROWABLE_ROOM, pieceArt(buying as DecorType)),
        )
        .setDisplaySize(SWATCH - 8, SWATCH - 8)
        .setPosition(x, y);
      this.show(row);
    }

    // The table: piles on the left, an empty half on the right to build the
    // payment in. Both halves are drawn, because the whole instruction is
    // "bring some of those over here" and neither noun should be implied.
    const top = pickerY + 52 + shift;
    const width = rect.width - PAD * 2;
    // Tall enough for a pile and its name, and for the coins she can lay
    // down in rows beside them — and no taller. A table stretched to
    // whatever room the panel had left put a band of empty wood between the
    // piles and the coins, which reads as somewhere a coin ought to go.
    const rows = Math.ceil(MOST_COUNTER_COINS / 4);
    const height = Math.max(104, rows * (TABLE_COIN + 6) + 20);
    const left = rect.left + PAD;
    this.tableTop
      .setSize(width, height)
      .setPosition(left + width / 2, top + height / 2)
      .setVisible(true);
    // A little over half, because four names have to fit across this side
    // and the coins she has laid down only need room to be counted.
    const pilesWidth = Math.round(width * 0.55);
    this.tableSplit
      .setSize(2, height - 12)
      .setPosition(left + pilesWidth, top + height / 2)
      .setVisible(true);

    const pileArea = { width: pilesWidth, height };
    for (const [index, value] of CURRENCY.denominations.entries()) {
      const spot = pileSpots(CURRENCY.denominations.length, pileArea)[index];
      const stack = this.pileFaces[index];
      const label = this.pileLabels[index];
      const hit = this.pileHits[index];
      if (!spot || !stack || !label || !hit) continue;
      const x = left + spot.x;
      // The pile grows upward from its base, so the bottom coin of every
      // pile sits on one line and the names underneath line up with it.
      // Centred on the table rather than resting at the foot of it: the
      // stack rises about as far above this line as the name drops below,
      // and a base set from the bottom edge printed the names on it.
      const base = top + height / 2;
      for (const [layer, face] of stack.entries()) {
        // Offset up and across, far enough that a stack reads as a stack
        // rather than as one coin drawn four times.
        face
          .setTexture(uiTextureKey(coinIcon(value)))
          .setDisplaySize(TABLE_COIN, TABLE_COIN)
          .setPosition(x + layer, base - layer * PILE_RISE)
          .setVisible(true);
      }
      const struck = this.pileValues[index];
      if (struck) {
        this.strike(struck, value, x + (PILE_DEPTH - 1), base - (PILE_DEPTH - 1) * PILE_RISE);
      }
      label
        .setText(CURRENCY.coinLabel(value))
        .setPosition(x, base + TABLE_COIN / 2 - 2)
        .setVisible(true);
      hit
        .setSize(Math.min(pilesWidth / CURRENCY.denominations.length, 64), height - 8)
        .setPosition(x, top + height / 2)
        .setVisible(true);
    }

    // Her side of the table, and where a dropped coin has to land.
    const counterArea = { width: width - pilesWidth - 14, height: height - 12 };
    const counterOrigin = { x: left + pilesWidth + 8, y: top + 6 };
    this.counterAt = { origin: counterOrigin, area: counterArea };
    this.tableCounter
      .setSize(counterArea.width, counterArea.height)
      .setPosition(
        counterOrigin.x + counterArea.width / 2,
        counterOrigin.y + counterArea.height / 2,
      )
      .setVisible(true);
    this.layCoins(tenderedCoins(tender), counterOrigin, counterArea);

    const actionY = top + height + 20;
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
        .setText(this.words.paidFor(this.chosenBuy as Buyable, this.quantity))
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

    // Her money on the same table the player pays on, and for the same
    // reason: the thing being asked about is a pile of coins, so a pile of
    // coins is what should be on screen. No piles down the side of it —
    // there is nothing here for her to take, only something to check.
    const top = pickerY + 52;
    const width = rect.width - PAD * 2;
    const left = rect.left + PAD;
    const rows = Math.ceil(MOST_COUNTER_COINS / 4);
    const height = Math.max(104, rows * (TABLE_COIN + 6) + 20);
    this.tableTop
      .setSize(width, height)
      .setPosition(left + width / 2, top + height / 2)
      .setVisible(true);
    const area = { width: width - 16, height: height - 16 };
    // Loose while there are few enough to count, gathered into piles when
    // there are not. The line is the same number of coins a payment may
    // hold: past it, counting stops being the thing being practised — one
    // coin missing from forty is invisible, and she is a coin or two out one
    // time in ten. Six piles of five ducats is checked by multiplying, and a
    // multiplication does not get harder as the pile grows.
    if (offer.coins.length > MOST_COUNTER_COINS) {
      this.layStacks(stacksOf(offer.coins), { x: left + 8, y: top + 8 }, area);
    } else {
      this.layCoins(offer.coins, { x: left + 8, y: top + 8 }, area);
    }

    const actionY = top + height + 20;
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
      const piles = offer.coins.length > MOST_COUNTER_COINS;
      this.hint
        .setText(piles ? this.words.countHerPiles : this.words.countHerCoins)
        .setColor(INK_DIM);
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

  /** What stands on the shelf that is out. */
  private onShelf(): readonly Buyable[] {
    return SHELVES[this.shelf]?.stock ?? [];
  }

  /** The picture of a thing, wherever its art happens to live. */
  private iconFor(thing: Buyable): string {
    return isFurniture(thing)
      ? growablePieceKey(GROWABLE_ROOM, pieceArt(thing))
      : uiTextureKey(itemIcon(thing));
  }

  /**
   * Turn to another shelf.
   *
   * Nothing else changes: the same purse, the same basket, the same half of
   * the counter on the left. A shelf is where a thing is kept, not a mode
   * the shop is in — which is why this does not leave the menu.
   */
  private showShelf(at: number): void {
    if (at === this.shelf || !SHELVES[at]) return;
    this.shelf = at;
    this.render();
  }

  /** The value of the nth pad button in the currency now in the purse. */
  private denomination(index: number): number {
    return CURRENCY.denominations[index] ?? 0;
  }

  private place(button: Button, x: number, y: number, width: number, height: number): void {
    button.box.setSize(width, height).setPosition(x, y);
    if (button.icon) {
      // Scaled to the row rather than drawn at its own size. The garden's
      // things are 32-pixel icons and happened to fit; a bed is a piece of
      // room furniture two tiles tall, and drawn at its own size it covered
      // the three rows under it.
      const box = height - 6;
      const source = button.icon.texture.getSourceImage() as { width: number; height: number };
      const fit = Math.min(box / (source.width || box), box / (source.height || box), 1);
      button.icon.setScale(fit);
      button.icon.setPosition(x - width / 2 + 20, y);
      button.label.setPosition(x - width / 2 + 40, y).setOrigin(0, 0.5);
    } else {
      button.label.setPosition(x, y).setOrigin(0.5);
    }
  }

  /**
   * A tab: square, and its picture in the middle of it.
   *
   * Not `place`, which lays a row out — icon to the left, price to the right
   * of it. A tab has no words on it at all, so an icon set twenty pixels in
   * from the left edge of a forty-pixel button sits against the border.
   */
  private placeTab(button: Button, x: number, y: number, size: number): void {
    button.box.setSize(size, size).setPosition(x, y);
    const icon = button.icon;
    if (!icon) return;
    const box = size - 8;
    const source = icon.texture.getSourceImage() as { width: number; height: number };
    // **Fitted by width and stood on the floor of the button.** Fitting by
    // both was the obvious thing and it drew a kettle four pixels across: a
    // piece of furniture is drawn on a canvas half again as tall as its own
    // cell, so that it has somewhere to reach into, and most of that canvas
    // is empty air above it. Fitting the air is fitting the wrong thing.
    const fit = Math.min(box / (source.width || box), 1);
    icon.setScale(fit);
    icon.setPosition(x, y + size / 2 - 4 - (source.height * fit) / 2);
  }

  private show(button: Button): void {
    button.box.setVisible(true);
    button.label.setVisible(true);
    button.icon?.setVisible(true);
  }

  /** The other way round, for a shelf shorter than the longest. */
  private hide(button: Button): void {
    button.box.setVisible(false);
    button.label.setVisible(false);
    button.icon?.setVisible(false);
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
