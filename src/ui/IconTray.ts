// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";

/**
 * A container button in the corner of the screen, and the row of things that
 * springs out of it when tapped.
 *
 * There are two of these — a spellbook holding spells and a pouch holding
 * seeds — and they exist as one widget because the player should not have to
 * learn them twice. Tapping the container shows what is inside; tapping one
 * of those does the thing. Nothing selects-then-confirms, because a two-step
 * action on a phone is two chances to lose the tray to a stray tap.
 *
 * The tray opens *upward* from its container, so the finger that opened it is
 * already next to what it opened and the items are never underneath the hand.
 *
 * On a desktop this is drawn and behaves identically. Casting and planting
 * are not things a keyboard does better, and a spell the player cannot see is
 * one they will never look for — the keyboard shortcuts are a convenience on
 * top, not the real interface.
 */

const BUTTON_FILL = 0x000000;
const BUTTON_ALPHA = 0.45;
const BUTTON_STROKE = 0xffffff;
const BUTTON_STROKE_ALPHA = 0.6;
// The open container reads as pressed, so it is obvious which tray the items
// on screen belong to once there is more than one of these.
const OPEN_STROKE = 0xffe08a;
const GAP = 8;

// A count sitting on the corner of a button. Ink on parchment rather than
// the white-on-red of a notification: this is how many carrots are in the
// basket, not an alert.
const BADGE_FILL = 0xf6e8c4;
const BADGE_STROKE = 0x4a3422;
const BADGE_INK = "#4a3422";
// How much of the button the badge takes, and the floor below which the
// digits stop being legible on a phone.
const BADGE_SCALE = 0.4;
const BADGE_MIN = 18;
/** Breathing room either side of the number inside its bubble. */
const BADGE_PAD = 4;
// Past this the badge would need a third digit and would stop fitting in a
// corner. A player carrying a hundred of something does not need the exact
// number; they need to know it is a lot.
const BADGE_MAX = 99;
// How faded an item the player has none of looks. Low enough to read as
// "none of these", high enough that the icon still says which one it is.
const EMPTY_ALPHA = 0.3;

/**
 * What a badge shows for a count.
 *
 * Nothing at all for zero — an empty slot should read as empty, and a "0"
 * badge is a label saying so, which is more ink for less meaning.
 */
export function badgeLabel(count: number, most: number = BADGE_MAX): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  const whole = Math.floor(count);
  if (whole <= 0) return null;
  return whole > most ? `${most}+` : String(whole);
}

export interface Slot {
  /** How many steps left of the container button this one sits. */
  readonly column: number;
  /** How many steps above it. One is the slot directly above. */
  readonly row: number;
}

/**
 * Where the things in a tray go, in steps rather than pixels.
 *
 * A tray stacks straight up from its button, which held while the fullest
 * one had seven things in it. Furniture made the crate twelve, and the top
 * two went *off the top of the screen* — buttons nobody could reach, which
 * is the same thing as buttons that do nothing, and is exactly how it was
 * reported.
 *
 * So it wraps. `room` is how many will fit in one column, and past that they
 * are shared out between columns rather than filling one and spilling into
 * the next: eleven and a lonely one reads as a mistake, six and six reads as
 * a tray. Columns go leftward, because the trays live in the bottom-right
 * corner and there is nothing that way but more screen.
 *
 * In steps because this is the part that can be wrong without a browser, and
 * it is the part that was.
 */
/**
 * The smallest a tray button is allowed to shrink to.
 *
 * A floor rather than a limit anybody expects to hit: below this a button is
 * smaller than a fingertip, and a tray a child cannot hit accurately is no
 * better than one they cannot see. If a tray ever needs more than this can
 * give, the answer is fewer things in it rather than smaller buttons.
 */
export const TRAY_LEAST = 36;

/**
 * Whether `count` buttons of this size all land on the screen.
 *
 * Rows go up from the tray's button and columns go left from it, so what
 * bounds them is the distance to the top edge and to the left edge — `y` and
 * `x` are exactly those, because the button is positioned from the bottom
 * right. A button's own half-width has to clear the edge too, or the last
 * one in each direction is half off it.
 */
function trayHolds(count: number, size: number, x: number, y: number): boolean {
  const step = size + GAP;
  const rows = Math.floor((y - size / 2) / step);
  // Column nought is the tray's own column, so there is always one more
  // column than there is room to the left of it.
  const columns = Math.floor((x - size / 2) / step) + 1;
  return rows >= 1 && columns >= 1 && rows * columns >= count;
}

/**
 * How big a tray's buttons may be and still all be on the screen.
 *
 * **Wrapping leftward has no edge to stop at, and that was the bug.** The
 * tray stacks up from its button and wraps into fresh columns to its left,
 * which was fixed when the crate held twelve things. It holds twenty now,
 * and on a phone the crate sits a hundred and twenty pixels from the left
 * edge: two columns fit, three were needed, and the third was drawn centred
 * at *minus twenty-four* — a column of buttons entirely off the side of the
 * screen, reported from a phone as exactly that.
 *
 * Capping the columns alone would only lose the items instead of misplacing
 * them, so the buttons shrink until the grid fits. Two pixels at a time,
 * biggest first, so a tray that already fits is untouched — every tray on a
 * desktop, and every tray but the crate on a phone.
 */
export function trayButtonSize(
  count: number,
  most: number,
  x: number,
  y: number,
  least: number = TRAY_LEAST,
): number {
  for (let size = most; size > least; size -= 2) {
    if (trayHolds(count, size, x, y)) return size;
  }
  return least;
}

/** How many rows of this size stand between the tray's button and the top. */
export function trayRows(size: number, y: number): number {
  return Math.max(1, Math.floor((y - size / 2) / (size + GAP)));
}

export function traySlots(count: number, room: number): Slot[] {
  if (count <= 0) return [];
  const fits = Math.max(1, Math.floor(room));
  const columns = Math.max(1, Math.ceil(count / fits));
  // Shared out a column at a time rather than poured into them. Thirteen
  // things in columns of five is five, five and a lonely three; the same
  // thirteen as five, four and four is a tray somebody arranged.
  const base = Math.floor(count / columns);
  const extra = count % columns;
  const slots: Slot[] = [];
  for (let column = 0; column < columns; column++) {
    const tall = base + (column < extra ? 1 : 0);
    for (let row = 1; row <= tall; row++) slots.push({ column, row });
  }
  return slots;
}

interface Badge {
  readonly bubble: Phaser.GameObjects.Rectangle;
  readonly text: Phaser.GameObjects.Text;
  readonly size: number;
  readonly count: () => number;
  /**
   * The corner it is pinned to, kept so the bubble can be resized later.
   *
   * A badge was a fixed square, which held while every number in it was two
   * digits. The purse counts to "999+" now and four characters ran out of
   * both sides of the square — so the bubble is measured against its label
   * when the label is set, and it grows leftward from this point so the
   * corner it is tucked into stays put.
   */
  right: number;
  middle: number;
}

interface Button {
  readonly box: Phaser.GameObjects.Rectangle;
  readonly icon: Phaser.GameObjects.Image;
  readonly badge?: Badge;
  readonly available?: () => boolean;
  readonly shown?: () => boolean;
  readonly name?: string;
}

export interface TrayItem {
  /** Texture key for the icon drawn on the button. */
  readonly texture: string;
  /**
   * What this button is called, for `uiPositions` and so for every scenario
   * that taps it.
   *
   * **A name rather than a position, and that is not a convenience.** Tray
   * buttons were published as `crate.0`, `crate.1` and so on, which is a
   * promise about *order* that nothing keeps: inserting the division rune
   * into the spellbook renumbered every button after it and five scenarios
   * carried on tapping the fourth while meaning the fifth, landing on a rune
   * nobody had been taught — and a refusal looks exactly like a spell that
   * did not open. A tray whose contents come and go, as the crate's now do,
   * would make that a certainty rather than a risk.
   *
   * Falls back to the index when absent, so the trays that have not needed
   * naming are unchanged.
   */
  readonly name?: string;
  /**
   * Whether this button is in the tray at all just now.
   *
   * Different from `available`, which dims a button that is *there* and not
   * usable. This one is about presence: the crate shows three group buttons
   * or one group's things, never both, and what is not shown takes no slot,
   * is not drawn, and — importantly — is not published as a position a
   * script could tap. The About panel had that bug the other way round and
   * it is the kind that only a scenario finds.
   */
  readonly shown?: () => boolean;
  /** What tapping it does. The tray closes itself first. */
  readonly act: () => void;
  /**
   * How many of this the player has, if that is a thing worth showing.
   *
   * A function rather than a number because the answer changes while the
   * game runs and the tray is not the thing that knows when — see `refresh`.
   * Items without one carry no badge at all: a spell is not a quantity.
   */
  readonly count?: () => number;
  /**
   * Whether the player may use this at all, if that is a thing that changes.
   *
   * A spell nobody has taught them yet is drawn dimmed rather than left out,
   * for the reason an empty basket slot is: a book with a gap in it says
   * there is something to find, and one that hides what it does not have
   * says the game is finished. Tapping it still calls `act` — what to say
   * about it belongs to whoever owns the spell, not to the tray.
   */
  readonly available?: () => boolean;
}

export interface IconTrayOptions {
  readonly texture: string;
  readonly items: readonly TrayItem[];
  readonly size: number;
  /** Distance from the right edge to the container's centre. */
  readonly right: number;
  /** Distance from the bottom edge to the container's centre. */
  readonly bottom: number;
  readonly depth: number;
  readonly register: (object: Phaser.GameObjects.GameObject) => void;
  /**
   * A count for the container itself — everything inside it, added up.
   *
   * The badge that matters most, because it is the only one visible while
   * the tray is shut: it is what tells the player they are carrying
   * something without asking them to open the basket to find out.
   */
  readonly count?: () => number;
  /**
   * The largest number the container's badge will print before it gives up
   * and says "and more".
   *
   * Two digits everywhere but the purse. A basket holding more than
   * ninety-nine carrots is a basket where the exact number has stopped
   * mattering; money is the one count where it has not, and a purse that
   * said "99+" from the third harvest onward would be hiding the thing it
   * exists to show.
   */
  readonly mostShown?: number;
  /**
   * Whether the player may use this at all, if that is a thing that changes.
   *
   * A spell nobody has taught them yet is drawn dimmed rather than left out,
   * for the reason an empty basket slot is: a book with a gap in it says
   * there is something to find, and one that hides what it does not have
   * says the game is finished. Tapping it still calls `act` — what to say
   * about it belongs to whoever owns the spell, not to the tray.
   */
  readonly available?: () => boolean;
  /** Called when this tray opens, so its neighbour can close. */
  readonly onOpen?: () => void;
  /**
   * Whether opening is allowed right now.
   *
   * Asked here rather than left to the caller because the container button
   * handles its own tap: a guard that only wrapped the keyboard shortcut
   * would leave the button itself unguarded, which is the whole population of
   * touch users.
   */
  readonly canOpen?: () => boolean;
  /**
   * A step back inside the tray, if it has levels.
   *
   * Called when the tray's own button is tapped while it is open. Returning
   * true means "handled, stay open"; false means close as usual. Only the
   * crate has anything to go back from.
   */
  readonly back?: () => boolean;
  /** Called after any change, open or closed, so a caption can follow it. */
  readonly onChange?: () => void;
}

export class IconTray {
  private readonly container: Button;
  private readonly items: Button[] = [];
  private open = false;

  constructor(
    scene: Phaser.Scene,
    private readonly options: IconTrayOptions,
  ) {
    const make = (
      texture: string,
      size: number,
      count?: () => number,
      available?: () => boolean,
      shown?: () => boolean,
      name?: string,
    ): Button => {
      const box = scene.add
        .rectangle(0, 0, size, size, BUTTON_FILL, BUTTON_ALPHA)
        .setStrokeStyle(2, BUTTON_STROKE, BUTTON_STROKE_ALPHA)
        .setScrollFactor(0)
        .setDepth(options.depth)
        .setInteractive({ useHandCursor: true });
      const icon = scene.add
        .image(0, 0, texture)
        .setScrollFactor(0)
        .setDepth(options.depth + 1);
      options.register(box);
      options.register(icon);
      if (!count) return { box, icon, available, shown, name };

      const badgeSize = Math.max(BADGE_MIN, Math.round(size * BADGE_SCALE));
      // Neither the bubble nor the number is interactive, so a tap on the
      // corner still reaches the button underneath. A badge that swallowed
      // taps would make the fullest slot the hardest one to press.
      const bubble = scene.add
        .rectangle(0, 0, badgeSize, badgeSize, BADGE_FILL)
        .setStrokeStyle(2, BADGE_STROKE)
        .setScrollFactor(0)
        .setDepth(options.depth + 2);
      const text = scene.add
        .text(0, 0, "", {
          fontFamily: "monospace",
          fontSize: `${Math.round(badgeSize * 0.62)}px`,
          color: BADGE_INK,
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(options.depth + 3);
      options.register(bubble);
      options.register(text);
      return {
        box,
        icon,
        available,
        shown,
        name,
        badge: { bubble, text, size: badgeSize, count, right: 0, middle: 0 },
      };
    };

    this.container = make(options.texture, options.size, options.count);
    // A tray with nothing in it is not a tray, it is a readout. The purse is
    // one: it holds money, and money has no slots to pick from — its four
    // coins were four buttons that did nothing when tapped, which is worse
    // than no button at all because it invites the tap.
    if (options.items.length > 0) {
      this.container.box.on("pointerdown", () => {
        // Its own button is always "back one step": out of a group first,
        // and only then shut. A tray that closed straight from inside a
        // group would make the one obvious gesture destroy the child's place
        // in it, and there is no other button here to be a back button.
        if (this.open && options.back?.()) {
          this.restack();
          return;
        }
        this.setOpen(!this.open);
      });
    } else {
      this.container.box.disableInteractive();
    }

    for (const item of options.items) {
      const button = make(
        item.texture,
        options.size - 8,
        item.count,
        item.available,
        item.shown,
        item.name,
      );
      button.box.on("pointerdown", () => {
        // Closed before acting, not after: acting can open a popup over the
        // top, and a tray left open behind it is live the moment it closes.
        this.setOpen(false);
        item.act();
      });
      this.items.push(button);
    }
    this.setOpen(false);
  }

  get isOpen(): boolean {
    return this.open;
  }

  setOpen(open: boolean): void {
    if (open && this.options.canOpen && !this.options.canOpen()) return;
    this.open = open;
    for (const item of this.items) {
      // Open *and* on the tray: a button belonging to a group nobody has
      // opened is not merely dim, it is not there.
      const here = open && (item.shown?.() ?? true);
      item.box.setVisible(here);
      item.icon.setVisible(here);
    }
    this.container.box.setStrokeStyle(
      2,
      open ? OPEN_STROKE : BUTTON_STROKE,
      open ? 1 : BUTTON_STROKE_ALPHA,
    );
    // Counts can change while the tray is shut, so they are read here rather
    // than only when something puts them out of date. Opening a tray onto a
    // stale number is the failure this makes structurally impossible; the
    // public `refresh` covers the rarer case of a change while it is open.
    this.refresh();
    if (open) this.options.onOpen?.();
    this.options.onChange?.();
  }

  /**
   * Re-read every count.
   *
   * Called on open, and by the owner when something changes while a tray is
   * showing — harvesting does not close the basket, so the number under the
   * player's thumb has to keep up.
   */
  refresh(): void {
    this.paint(this.container, true);
    for (const item of this.items) this.paint(item, this.open);
  }

  // An item the player has none of — or has not been taught — is dimmed and
  // carries no badge. Hiding it outright would reshuffle the tray as things
  // are picked and dropped, and a row of buttons that moves under a thumb is
  // worse than one with a gap in it — this way the basket also says what
  // *could* be in it, and the spellbook what could be in that.
  private paint(button: Button, visible: boolean): void {
    const badge = button.badge;
    const here = visible && (button.shown?.() ?? true);
    // Two ways to be dim and one look for both: nothing of it in the basket,
    // or nobody has taught it yet.
    const label = badge ? badgeLabel(badge.count(), this.options.mostShown) : "";
    if (badge && label) this.fitBadge(badge, label);
    const allowed = button.available ? button.available() : true;
    button.icon.setAlpha((badge ? label !== "" : true) && allowed ? 1 : EMPTY_ALPHA);
    if (!badge) return;
    badge.bubble.setVisible(here && label !== null);
    badge.text.setVisible(here && label !== null);
  }

  toggle(): void {
    if (this.options.items.length === 0) return;
    this.setOpen(!this.open);
  }

  /** Where the container button sits, for a script that needs to tap it. */
  containerPosition(): { x: number; y: number } {
    return { x: this.container.box.x, y: this.container.box.y };
  }

  /** Where each item sits, in the order they were given. */
  /**
   * Where each button in the tray is, and what it is called.
   *
   * Only the ones actually on the tray. A position published for a button
   * that is not there is a tap a scenario can make and a child cannot, which
   * is the worst kind of seam: it passes.
   */
  itemPositions(): { name: string; x: number; y: number }[] {
    return this.items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.shown?.() ?? true)
      .map(({ item, index }) => ({
        name: item.name ?? String(index),
        x: item.box.x,
        y: item.box.y,
      }));
  }

  /**
   * Lay the tray out again for whatever it is showing now.
   *
   * Wanted when a tray's *contents* change without the window doing — which
   * is a thing only the crate does, when a group is opened or stepped out
   * of. The last size is remembered rather than passed, because the thing
   * that knows the viewport is `EdgeAnchored` and the thing that knows the
   * group is a button inside this tray.
   */
  restack(): void {
    this.setOpen(this.open);
    if (this.lastSize) this.place(this.lastSize.width, this.lastSize.height);
  }

  private lastSize: { width: number; height: number } | null = null;

  /** Re-place for a viewport of this size. Matches GameScene's EdgeAnchored. */
  place(width: number, height: number): void {
    this.lastSize = { width, height };
    const { size, right, bottom } = this.options;
    const x = width - right;
    const y = height - bottom;
    this.container.box.setPosition(x, y);
    this.container.icon.setPosition(x, y);
    this.placeBadge(this.container, x, y, size);
    // Sized from the *items*, not from the container's button. Those differ
    // by eight pixels, and measuring the grid against the bigger of the two
    // cost a row — which is how twenty things came to need three columns
    // where two would have held them.
    // Only what is on the tray now takes a slot. The crate shows three group
    // buttons or one group's things, and a hidden button that still held a
    // place would leave a gap in the grid where nothing is.
    const here = this.items.filter((item) => item.shown?.() ?? true);
    const itemSize = trayButtonSize(here.length, size - 8, x, y);
    const step = itemSize + GAP;
    const slots = traySlots(here.length, trayRows(itemSize, y));
    for (const [index, item] of here.entries()) {
      const slot = slots[index] as Slot;
      const itemX = x - slot.column * step;
      const itemY = y - slot.row * step;
      item.box.setSize(itemSize, itemSize);
      item.box.setPosition(itemX, itemY);
      item.icon.setPosition(itemX, itemY);
      this.placeBadge(item, itemX, itemY, itemSize);
    }
    // Content last, and here rather than only in the constructor, so a badge
    // can never be made visible before it has been given a position. The
    // constructor refreshes too, and would leave a nonzero count sitting at
    // the origin until the first layout — which today cannot be seen, because
    // the inventory starts empty and the owner lays out in the same call.
    // That is an ordering to rely on by accident, so this removes it.
    this.refresh();
  }

  // Tucked into the button's bottom-right corner rather than overhanging it.
  // Overhanging reads better in isolation and collides in a row: the
  // containers sit ten pixels apart, and a badge hung off the basket landed
  // on the seed pouch beside it.
  private placeBadge(button: Button, x: number, y: number, size: number): void {
    const badge = button.badge;
    if (!badge) return;
    const offset = (size - badge.size) / 2 - 1;
    badge.right = x + offset + badge.size / 2;
    badge.middle = y + offset;
    badge.bubble.setPosition(x + offset, badge.middle);
    badge.text.setPosition(x + offset, badge.middle);
  }

  /**
   * Widen the bubble to hold what is written in it, and keep its corner.
   *
   * Set here rather than at build time because the label is what decides it,
   * and the label changes with every carrot picked.
   */
  private fitBadge(badge: Badge, label: string): void {
    badge.text.setText(label);
    const width = Math.max(badge.size, Math.ceil(badge.text.width) + BADGE_PAD * 2);
    badge.bubble.setSize(width, badge.size);
    const centre = badge.right - width / 2;
    badge.bubble.setPosition(centre, badge.middle);
    badge.text.setPosition(centre, badge.middle);
  }
}
