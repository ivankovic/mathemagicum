// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { CURRENCY, coinsFor } from "../shop/currency";
import { MOST_COUNTER_COINS } from "../shop/tender";
import { DECOR_TYPES, DecorType, decorItem } from "./decor";
import { FixtureType, PLACEABLE_FIXTURES } from "./fixtures";
import type { Inventory, ItemType } from "./inventory";
import { isMachine } from "./machines";
import { MATERIAL_TYPES, type MaterialType } from "./materials";
import { PLANT_TYPES, type PlantType } from "./plants";

/**
 * What the village store pays and charges.
 *
 * The design doc's economy is one sentence long — money exists, villagers
 * pay it, the shopkeeper takes it — so this is the first place any number
 * has had to be chosen. Two rules keep those numbers from being arbitrary:
 *
 * **Every crop is worth the same.** Not because that is obviously right,
 * but because nothing today makes one crop harder to grow than another:
 * each takes one planting and two casts, and they differ only in which
 * terrain accepts them. Pricing them apart would be inventing a difficulty
 * that the game does not have. When crops differ, so can their prices.
 *
 * **Everything for sale is priced in crops, not in coins.** `2` below means
 * "two harvests", and the coin figure falls out of that. A player who wants
 * a lamp can count what it costs in the units they actually earn, and a
 * later change to what a crop is worth cannot silently make the whole shop
 * cheap or unaffordable.
 *
 * Nothing here is scarcity: crops regrow, seeds stay free, and there is no
 * cap on either coins or stock. The store is somewhere for the work to go,
 * not a gate — see GAME_DESIGN.md's pillars.
 */

/**
 * What one harvested crop fetches, in rays — the money's minor unit, and
 * what everything else here is quoted in.
 *
 * 2.50 rather than a round 1.00 or 5.00 on purpose: a price that is a whole
 * number of the largest coin can be paid with one coin and teaches nothing.
 * This one takes three, and two of them are not the same.
 */
export const CROP_PRICE = 250;

/**
 * What a crop fetches for the child currently playing.
 *
 * A parameter now rather than the constant above, because a six-year-old
 * counting out 2,50 is counting the wrong thing: the gentlest setting quotes
 * a crop at a whole sun so the money is money rather than a second puzzle
 * (see src/spells/difficulty.ts).
 *
 * What it emphatically does *not* do is change what anything is worth.
 * Everything the store sells is priced in *crops* — a fence is two harvests
 * at every setting — so quoting a crop differently rescales both sides of
 * every trade at once and the economy is identical. That is deliberate: the
 * moment easier sums earned less, the game would be telling a struggling
 * child they are worth less.
 */
export type CropPrice = number;

/**
 * The most of one thing that changes hands in a single trade.
 *
 * A counting limit, not a purse one: past a handful of items the sum stops
 * being arithmetic a child does in their head and becomes bookkeeping, and
 * the shopkeeper's payment has to stay countable on the counter.
 */
export const MAX_TRADE = 10;

/** What the store stocks, priced in crops. */
const COST_IN_CROPS: Record<FixtureType, number> = {
  well: Number.POSITIVE_INFINITY, // not for sale; the village has the one
  // The gate used to be world generation's alone. It is a player's now: a
  // child who can fence a plot needs the way in, and a fenced garden with no
  // gate is a child walled out of their own carrots.
  gate: 3,
  "fence-side": Number.POSITIVE_INFINITY, // the same fence, the world's copy
  "fence-corner": Number.POSITIVE_INFINITY, // and its corner
  "gate-side": Number.POSITIVE_INFINITY, // and the gate that stands in it
  "gate-side-lower": Number.POSITIVE_INFINITY, // and its other end
  glowcap: Number.POSITIVE_INFINITY, // the forest's, and it would not glow anywhere else
  stall: Number.POSITIVE_INFINITY, // the market's, and it belongs to the market
  // The city's ring wall and the way through it. Not for sale for the reason
  // the well is not: it is a piece of a place rather than a thing somebody
  // owns, and a child who could buy a length of city wall could wall their
  // own garden in with it.
  "city-wall": Number.POSITIVE_INFINITY,
  "city-wall-side": Number.POSITIVE_INFINITY,
  "city-gate": Number.POSITIVE_INFINITY,
  "city-gate-side": Number.POSITIVE_INFINITY,
  // Not for sale, and the first thing in this table that is priced out
  // because of *how it is come by* rather than because it belongs to a
  // place. A sorter is built out of fifteen wood and six stone — see
  // `machines.ts` — and `SHOP_STOCK` below keeps it off the shelf, so this
  // infinity is the belt to that braces: whatever route reaches `priceOf`,
  // there is no coin figure for a machine.
  sorter: Number.POSITIVE_INFINITY,
  // And the same for the second machine, for the same reason.
  hothouse: Number.POSITIVE_INFINITY,
  // The quay's and the city's dressing, not for sale for the reason the
  // market stall is not: it is a piece of a place rather than a thing
  // somebody owns.
  windpump: Number.POSITIVE_INFINITY,
  planter: Number.POSITIVE_INFINITY,
  fence: 2,
  table: 5,
  lamp: 8,
  // The three that do nothing. Priced under the lamp, because what they buy
  // is a garden that looks like somebody's rather than a light to work by —
  // and a child should be able to have one before they have saved for weeks.
  bench: 4,
  scarecrow: 3,
  flowerpot: 2,
};

/**
 * What the house is furnished with, priced in crops like everything else.
 *
 * The furniture was in the game before it was in the shop: a child could
 * pick up the bed they were given, carry it and put it down again, but there
 * was no way to come by a second one. So a room could be rearranged and
 * never added to, which is half a feature.
 *
 * Priced against the garden's: a chair costs what a fence does and a bed
 * costs what a bench and a scarecrow do together. Nothing here is more than
 * the lamp, because the lamp is the thing worth saving for.
 */
const FURNITURE_COST_IN_CROPS: Record<DecorType, number> = {
  [DecorType.Chair]: 2,
  [DecorType.Rug]: 3,
  [DecorType.Table]: 4,
  [DecorType.Bookshelf]: 5,
  [DecorType.Bed]: 6,
  // The fire costs most, which is the one price here that is about what a
  // thing *does* rather than how big it is: a room without a stove is a room
  // with no light in it after dark.
  [DecorType.Stove]: 8,

  // --- the kitchen and the washroom ---------------------------------------
  //
  // Priced on the same ladder rather than on a new one: the small things a
  // room is dressed with sit with the chair and the rug, and the two a child
  // will save for — the dresser and the bath — sit with the bed. Nothing
  // here passes the stove, which stays the most expensive thing in the house
  // because it is the one that lights it.
  [DecorType.Kettle]: 2,
  [DecorType.Washstand]: 3,
  [DecorType.Privy]: 3,
  [DecorType.Sink]: 5,
  [DecorType.Dresser]: 6,
  // The bath is two cells wide, and the only piece here that is. It is also
  // the one a child asked for first, so it is worth saving for and not worth
  // saving for a fortnight.
  [DecorType.Bath]: 7,
};

/**
 * What is actually on the shelf.
 *
 * Was `PLACEABLE_FIXTURES` outright, which held while every placeable thing
 * was something the store sold. A machine is placeable and is *not* for
 * sale — it is built out of what the clearing spell paid, see
 * `src/world/machines.ts` — so the two lists have come apart, and this is
 * the one the shop reads. Left as `PLACEABLE_FIXTURES` it would have put a
 * sorter on the shelf priced at infinity, which is a button that can only
 * refuse.
 */
export const SHOP_STOCK: readonly FixtureType[] = PLACEABLE_FIXTURES.filter(
  (fixture) => !isMachine(fixture),
);
export const FURNITURE_STOCK: readonly DecorType[] = DECOR_TYPES;

/**
 * The shop's shelves, and what stands on each.
 *
 * **One list stopped working.** The counter showed everything the shop sold
 * in a single column, which was seven things, then twelve, and then — when a
 * playtest asked for a kitchen and a washroom — eighteen. The rows shrink to
 * fit until they hit a floor and after that they simply run off the bottom
 * of the parchment; the footer was already underneath the last of them
 * before any of this was added.
 *
 * So the stock is sorted onto shelves and one shelf is shown at a time.
 * Four of them, none longer than seven, which is what the parchment holds
 * comfortably at a readable row height.
 *
 * **The shelves are named by a picture**, not by a word — the tabs carry one
 * of their own things as an icon. Much of the audience cannot read, and a
 * row of four labels would be the one place in the game where finding what
 * you want required it. That also means the order matters: the garden is
 * first because it is what a child meets first, and the rooms follow in the
 * order a house is furnished.
 */
export interface Shelf {
  /** Which of its own things stands on the tab. */
  readonly icon: Buyable;
  readonly stock: readonly Buyable[];
}

export const SHELVES: readonly Shelf[] = [
  {
    icon: FixtureType.Fence,
    stock: SHOP_STOCK,
  },
  {
    // The chair rather than the bed, and the reason is the tab rather than
    // the room: a tab is a square, and a bed is drawn two cells tall — shrunk
    // to fit a square it is a stripe. Every icon here is a piece that stands
    // in one cell, so it is drawn as itself.
    icon: DecorType.Chair,
    stock: [DecorType.Bed, DecorType.Table, DecorType.Chair, DecorType.Rug, DecorType.Bookshelf],
  },
  {
    // The stove, which was in the house shelf's territory and belongs here:
    // it is the thing you cook on, and it is the piece the kettle sits on.
    icon: DecorType.Stove,
    stock: [DecorType.Stove, DecorType.Sink, DecorType.Dresser, DecorType.Kettle],
  },
  {
    // And the washstand rather than the bath, for the same reason: the bath
    // is the one piece in the house two cells wide.
    icon: DecorType.Washstand,
    stock: [DecorType.Bath, DecorType.Washstand, DecorType.Privy],
  },
];

/** The longest a shelf may be, which is what the parchment can draw. */
export const MOST_PER_SHELF = 7;

/** Whether a piece stands in a single cell — see the notes on the icons. */
export function isOneCell(thing: Buyable): boolean {
  return (
    thing !== DecorType.Bed &&
    thing !== DecorType.Table &&
    thing !== DecorType.Rug &&
    thing !== DecorType.Bath
  );
}

/**
 * Anything the store sells.
 *
 * One type rather than two because everything downstream of the price — how
 * many are affordable, what the counter says, what the heading reads — asks
 * the same question of both, and a parallel set of functions for furniture
 * would be the same code with a different word in it.
 */
export type Buyable = FixtureType | DecorType;

/** Whether this is a piece of furniture rather than a thing for the garden. */
export function isFurniture(thing: Buyable): thing is DecorType {
  return (DECOR_TYPES as readonly string[]).includes(thing);
}

export function priceOf(thing: Buyable, cropPrice: CropPrice = CROP_PRICE): number {
  const crops = isFurniture(thing)
    ? FURNITURE_COST_IN_CROPS[thing]
    : COST_IN_CROPS[thing as FixtureType];
  if (!Number.isFinite(crops)) throw new Error(`${thing} is not for sale`);
  return crops * cropPrice;
}

/**
 * What the store pays for one of an item, or 0 if it does not want it.
 *
 * Not `valueOf`, which every object already has: a free function with that
 * name is one import away from being mistaken for the built-in.
 */
export function sellPriceOf(item: ItemType, cropPrice: CropPrice = CROP_PRICE): number {
  const sold =
    (PLANT_TYPES as readonly string[]).includes(item) ||
    (MATERIAL_TYPES as readonly string[]).includes(item);
  return sold ? cropPrice : 0;
}

/**
 * Whether the store wants it.
 *
 * Crops and materials, at the same price. Wood being worth what a carrot is
 * looks generous beside the work — three actions for a crop against one cast
 * for two logs — and it is generous on purpose: subtraction is the spell this
 * game under-uses, and paying for it is the plainest way to have it
 * practised. It cannot be farmed either. Nothing regrows, so a child who
 * clears everything within reach is a child back in the garden.
 */
export function isSellable(item: ItemType): item is PlantType | MaterialType {
  return sellPriceOf(item) > 0;
}

/**
 * The player's coins.
 *
 * Its own small class rather than a number on the scene, so that "you cannot
 * spend what you do not have" is stated once and cannot be forgotten by the
 * second thing that spends.
 */
export class Purse {
  private amount = 0;

  get coins(): number {
    return this.amount;
  }

  earn(amount: number): number {
    if (!Number.isInteger(amount) || amount <= 0) return this.amount;
    this.amount += amount;
    return this.amount;
  }

  canAfford(amount: number): boolean {
    return Number.isInteger(amount) && amount >= 0 && this.amount >= amount;
  }

  /** All or nothing, so nothing can be half-paid-for. */
  spend(amount: number): boolean {
    if (!this.canAfford(amount)) return false;
    this.amount -= amount;
    return true;
  }
}

export interface Trade {
  readonly ok: boolean;
  /** What changed hands, in minor units. */
  readonly amount: number;
}

/**
 * Sell some crops.
 *
 * No message: what the shopkeeper says about a sale now depends on whether
 * she counted it out correctly and on what the player answered, which is the
 * minigame's business rather than the ledger's. See src/shop/payment.ts.
 */
export function sellCrops(
  inventory: Inventory,
  purse: Purse,
  item: ItemType,
  count: number,
  cropPrice: CropPrice = CROP_PRICE,
): Trade {
  const unit = sellPriceOf(item, cropPrice);
  if (unit <= 0 || !Number.isInteger(count) || count <= 0) return { ok: false, amount: 0 };
  if (!inventory.remove(item, count)) return { ok: false, amount: 0 };
  const earned = unit * count;
  purse.earn(earned);
  return { ok: true, amount: earned };
}

/**
 * Buy some stock, having already counted the money out.
 *
 * The caller is the tender minigame, which only lets this be reached once
 * the coins on the counter come to exactly `priceOf(fixture) * count` — so
 * the purse check here is a backstop rather than the gate.
 */
export function buyStock(
  inventory: Inventory,
  purse: Purse,
  thing: Buyable,
  count: number,
  cropPrice: CropPrice = CROP_PRICE,
  look = 0,
): Trade {
  if (!Number.isInteger(count) || count <= 0) return { ok: false, amount: 0 };
  const price = priceOf(thing, cropPrice) * count;
  if (!purse.spend(price)) return { ok: false, amount: 0 };
  // What is paid for and what goes in the basket are the same thing for a
  // fence and are not for a chair: furniture is bought in a colour, and the
  // colour is part of what she owns rather than a label on it.
  inventory.add(isFurniture(thing) ? decorItem(thing, look) : thing, count);
  return { ok: true, amount: price };
}

/**
 * The largest number the quantity picker will go to.
 *
 * Not a tidiness rule. Offering a quantity somebody cannot pay for leaves a
 * child on a screen where the coin pad refuses every coin they own, with
 * nothing saying why — so the cap is what they can *afford*, and it is never
 * below one, because a picker that starts at nought is a picker with nothing
 * to press.
 *
 * `MAX_TRADE` on top of that, which is about the counter rather than the
 * purse: a hundred carrots is a hundred coins to count out.
 */
export function mostBuyable(
  thing: Buyable,
  coins: number,
  cropPrice: CropPrice = CROP_PRICE,
): number {
  const each = priceOf(thing, cropPrice);
  const affordable = each > 0 ? Math.floor(coins / each) : MAX_TRADE;
  const room = Math.max(1, Math.min(MAX_TRADE, affordable));
  // And capped again by what the counter can hold, the same way a sale is
  // capped by what the shopkeeper can count out of her drawer. Ten lamps is
  // a sum a purse can afford and forty coins to lay down one at a time.
  //
  // Stops at the first count that does not fit rather than the largest that
  // does, because the quantity picker steps through every number on the way
  // and a range with a hole in it has a broken step in it.
  let most = 1;
  for (let count = 1; count <= room; count++) {
    if (coinsFor(CURRENCY, each * count).length > MOST_COUNTER_COINS) break;
    most = count;
  }
  return most;
}

/**
 * And the largest she can sell: what is in the basket, and nothing else.
 *
 * There were two limits on top of that and both are gone. A flat ten was
 * the buying limit wearing the wrong hat — a purchase is coins the *child*
 * lays down one at a time, a sale is counted out by the shopkeeper — and
 * after that, a limit on how many coins would fit on the table.
 *
 * The second one went when large payments started being counted out in
 * piles rather than coin by coin. Four denominations make at most four
 * piles however much money there is, so there is no size of sale the table
 * cannot show and no size a child cannot check: six piles of five ducats is
 * a multiplication, and a multiplication does not get harder as the number
 * grows the way counting forty discs does.
 */
export function mostSellable(
  item: ItemType,
  held: number,
  cropPrice: CropPrice = CROP_PRICE,
): number {
  return Math.max(1, held);
}
