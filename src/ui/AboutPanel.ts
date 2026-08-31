// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import type { Phrases } from "../i18n/phrases";
import { PANEL_PAD as PAD, ParchmentPanel } from "./ParchmentPanel";
import type { UiIndex } from "./assets";
import { FACE, INK, INK_DIM, INK_HEX, PAPER_PALE_HEX } from "./parchment";

/**
 * Who made this, what it costs, and what is asked of anybody minded to pay —
 * and, for whoever finds it, the seams.
 *
 * **Tapping the heading turns the debug panel on, for this child.** The sheet
 * then draws rows instead of paragraphs: hold the village still, make every
 * animal hungry, wind the hour, move the sums up or down, fill a purse, learn
 * everything. Tapping the heading again puts them away.
 *
 * A hidden gesture on a heading, which is a shape borrowed from every phone
 * that has ever had a build number tapped seven times, and for the same
 * reason: the people who need it will be told, and nobody else will find it
 * by pressing things at random. Per child, so a grown-up who turns it on to
 * look at something has not turned it on for the sibling sharing the tablet.
 *
 * The URL seams are not gated on this and never were — `?hour=` works for
 * anybody with an address bar, deliberately; see `devHooks.ts`. This is only
 * whether the panel is there.
 */

/**
 * What the debug rows reach for.
 *
 * Handed in rather than reached for, exactly as `openLink` is: this panel
 * knows how to draw a row that is on or off and what happens when a thumb
 * lands on it, and knows nothing about villages, purses or ladders.
 */
export interface DebugControls {
  readonly frozen: () => boolean;
  readonly setFrozen: (still: boolean) => void;
  readonly hungry: () => boolean;
  readonly setHungry: (hungry: boolean) => void;
  readonly hour: () => number;
  readonly setHour: (hour: number) => void;
  readonly rung: () => number;
  readonly rungs: () => number;
  readonly setRung: (rung: number) => void;
  readonly fillPurse: () => void;
  readonly fillBasket: () => void;
  readonly learnEverything: () => void;
}

/**
 * Who made this, what it costs, and what is asked of anybody minded to pay.
 *
 * The one screen in the game that is a wall of text, and it earns it twice
 * over. It is addressed to whoever is paying for the tablet rather than to
 * the child holding it, and what it has to say — a licence, a name, and a
 * request not to spend money — cannot be said in pictures. Everywhere else
 * the rule is that no sentence goes unaccompanied; here the sentences are
 * the whole point.
 *
 * It replaced a line in the options saying what a crop sells for. That was a
 * fact about the game's own invented money and nobody was ever going to have
 * a question about it; this is the question an adult actually has.
 *
 * **The two links leave the game.** They are the only thing in it that does,
 * which is why they are drawn as buttons on this screen and nowhere near a
 * screen a child plays on.
 */

const PANEL_MAX_W = 560;
const PANEL_MAX_H = 620;
const PANEL_MIN_W = 300;
// Low, because the height that matters is the one `render` computes from the
// paragraph. A floor of a few hundred pixels would simply win on a desktop,
// where the text is five lines, and put the buttons a hand's width below it.
const PANEL_MIN_H = 200;

const TITLE_SIZE = 17;
const BODY_SIZE = 13;
const SMALL_SIZE = 11;
const BUTTON_H = 34;
const BUTTON_GAP = 10;
/** How many rows the debug face draws. See renderDebug. */
const DEBUG_ROWS = 7;

/** Where the two buttons go. Stated here so a script need not guess. */
export const SOURCE_URL = "https://github.com/ivankovic/mathemagicum";
export const SPONSOR_URL = "https://github.com/sponsors/ivankovic";

type PanelPart = Phaser.GameObjects.GameObject &
  Phaser.GameObjects.Components.Depth &
  Phaser.GameObjects.Components.ScrollFactor &
  Phaser.GameObjects.Components.Visible;

interface Button {
  readonly box: Phaser.GameObjects.Rectangle;
  readonly label: Phaser.GameObjects.Text;
}

export class AboutPanel {
  private readonly paper: ParchmentPanel;
  private readonly parts: PanelPart[] = [];
  private readonly title: Phaser.GameObjects.Text;
  private readonly madeBy: Phaser.GameObjects.Text;
  private readonly copyright: Phaser.GameObjects.Text;
  private readonly licence: Phaser.GameObjects.Text;
  private readonly note: Phaser.GameObjects.Text;
  private readonly sourceButton: Button;
  private readonly sponsorButton: Button;
  private readonly closeButton: Button;

  private open = false;
  /** Whether the sheet is showing its debug face. Owned by the caller. */
  private debug = false;
  private readonly rows: Button[] = [];
  private readonly hint: Phaser.GameObjects.Text;
  private onClose: (() => void) | null = null;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;

  /**
   * How a link is followed.
   *
   * Injected rather than reaching for `window` here, so a test can watch what
   * this panel would have opened without a browser opening it.
   */
  openLink: (url: string) => void = (url) => {
    globalThis.open?.(url, "_blank", "noopener,noreferrer");
  };

  /**
   * What the heading's own tap does, and what the rows reach for.
   *
   * Both are the scene's: whether this child's game is in debug is saved with
   * everything else about them, and every row changes something the scene
   * owns. Set once, after construction, the way `openLink` is.
   */
  onToggleDebug: (on: boolean) => void = () => {};
  controls: DebugControls | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    index: UiIndex,
    depth: number,
    private words: Phrases,
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
    this.madeBy = this.own(this.text("", BODY_SIZE, INK).setOrigin(0.5, 0));
    this.copyright = this.own(this.text("", SMALL_SIZE, INK_DIM).setOrigin(0.5, 0));
    this.licence = this.own(
      this.text("", SMALL_SIZE, INK_DIM).setOrigin(0.5, 0).setAlign("center"),
    );
    this.note = this.own(this.text("", BODY_SIZE, INK).setOrigin(0.5, 0).setAlign("left"));

    this.hint = this.own(this.text("", SMALL_SIZE, INK_DIM).setOrigin(0.5, 0));
    // Seven, which is what `debugRows` draws. Made once here rather than as
    // the sheet is drawn: a row built during a render is a row that flickers
    // the first time the panel is opened.
    for (let n = 0; n < DEBUG_ROWS; n++) this.rows.push(this.button(() => {}));

    // The heading is a button, and the only one in this game that does not
    // look like one. That is the whole of the gesture.
    this.title.setInteractive({ useHandCursor: true });
    this.title.on("pointerdown", () => {
      this.debug = !this.debug;
      this.onToggleDebug(this.debug);
      this.render();
    });

    this.sourceButton = this.button(() => this.openLink(SOURCE_URL));
    this.sponsorButton = this.button(() => this.openLink(SPONSOR_URL));
    this.closeButton = this.button(() => this.close(), "x");

    for (const part of this.parts) {
      part
        .setDepth(depth + 1)
        .setScrollFactor(0)
        .setVisible(false);
      register(part);
    }
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** Open it, on whichever face this child's save asks for. */
  show(onClose: () => void, debug = false): void {
    this.debug = debug;
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
    for (const part of this.parts) part.setVisible(false);
    const done = this.onClose;
    this.onClose = null;
    done?.();
  }

  setPhrases(words: Phrases): void {
    this.words = words;
    if (this.open) this.render();
  }

  layout(): void {
    if (this.open) this.render();
  }

  /** Where the buttons are, so a script need not guess at them. */
  buttonPositions(): Record<string, { x: number; y: number }> {
    // Only what is actually on the sheet. This one has two faces now, and a
    // position handed out for a button the other face is drawing is a
    // position a script can tap and get nothing from — which reads as the
    // tap having missed rather than as the button not being there.
    const named: Record<string, { x: number; y: number }> = {
      // The heading, because it is a button now and the one gesture in this
      // game a script could not otherwise find.
      "about.title": { x: this.title.x, y: this.title.y + TITLE_SIZE / 2 },
      close: { x: this.closeButton.box.x, y: this.closeButton.box.y },
    };
    for (const [name, button] of [
      ["source", this.sourceButton],
      ["sponsor", this.sponsorButton],
    ] as const) {
      if (button.box.visible) named[name] = { x: button.box.x, y: button.box.y };
    }
    for (const [n, row] of this.rows.entries()) {
      if (row.box.visible) named[`debug.${n}`] = { x: row.box.x, y: row.box.y };
    }
    return named;
  }

  destroy(): void {
    this.close();
    this.paper.destroy();
    for (const part of this.parts) part.destroy();
  }

  private render(): void {
    const { width, height } = this.scene.scale;
    for (const part of this.parts) part.setVisible(true);
    for (const row of this.rows) this.hide(row);
    if (this.debug) {
      this.renderDebug(width, height);
      return;
    }
    this.hint.setVisible(false);

    // Laid out twice, and it has to be. The paragraph is the only thing on
    // this sheet whose height is not known in advance — it wraps to whatever
    // width the screen allows and runs to five lines on a desktop and nearly
    // twelve on a phone — so the first pass asks how wide the paper is, the
    // text is set and measured at that width, and the second pass caps the
    // paper to what the text turned out to need.
    //
    // Without it the sheet is its maximum height whatever it holds, which on
    // a wide screen is a paragraph at the top, two buttons at the bottom and
    // a hand's width of blank parchment between them.
    const inner = this.paper.layout(width, height).width - PAD * 2;
    this.note.setWordWrapWidth(inner).setFixedSize(inner, 0).setText(this.words.sponsorNote);

    // The licence runs to two lines, and to three if somebody's translation
    // is long, so it is measured rather than counted.
    this.licence.setText(this.words.licenceLine);
    const above = PAD + TITLE_SIZE + 16 + BODY_SIZE + 8 + SMALL_SIZE + 4 + this.licence.height + 18;
    const below = 20 + BUTTON_H + PAD;
    const rect = this.paper.layout(width, height, above + this.note.height + below);

    let y = rect.top + PAD;
    this.title.setText(this.words.aboutTitle).setPosition(rect.centreX, y);
    y += TITLE_SIZE + 16;
    this.madeBy.setText(this.words.madeBy).setPosition(rect.centreX, y);
    y += BODY_SIZE + 8;
    this.copyright.setText(this.words.copyright).setPosition(rect.centreX, y);
    y += SMALL_SIZE + 4;
    this.licence.setPosition(rect.centreX, y);
    y += this.licence.height + 18;

    this.note.setPosition(rect.centreX, y);

    // The buttons sit on the bottom edge whatever the paragraph did, so a
    // long translation pushes text against them rather than off the sheet.
    const buttonY = rect.top + rect.height - PAD - BUTTON_H / 2;
    const buttonW = Math.min(220, (inner - BUTTON_GAP) / 2);
    this.place(
      this.sourceButton,
      rect.centreX - buttonW / 2 - BUTTON_GAP / 2,
      buttonY,
      buttonW,
      BUTTON_H,
      this.words.sourceLink,
    );
    this.place(
      this.sponsorButton,
      rect.centreX + buttonW / 2 + BUTTON_GAP / 2,
      buttonY,
      buttonW,
      BUTTON_H,
      this.words.sponsorLink,
    );
    this.place(
      this.closeButton,
      rect.left + rect.width - PAD - 14,
      rect.top + PAD + 10,
      28,
      24,
      "x",
    );
  }

  /**
   * The seams, as a row apiece.
   *
   * Two kinds and they read differently on purpose. A *state* says what it
   * is — on or off, the hour, the rung — and tapping it changes that;
   * something *handed over* says what it will do and says `done` once it has,
   * because a button that gives you a purse of coins and then looks exactly
   * as it did is a button you press again to check.
   */
  private renderDebug(width: number, height: number): void {
    const at = this.controls;
    const rows: { label: string; value: string; act: () => void }[] = at
      ? [
          {
            label: this.words.debugFrozen,
            value: at.frozen() ? this.words.debugOn : this.words.debugOff,
            act: () => at.setFrozen(!at.frozen()),
          },
          {
            label: this.words.debugHungry,
            value: at.hungry() ? this.words.debugOn : this.words.debugOff,
            act: () => at.setHungry(!at.hungry()),
          },
          {
            label: this.words.debugHour(at.hour()),
            value: "+1",
            act: () => at.setHour((at.hour() + 1) % 24),
          },
          {
            label: this.words.debugRung(at.rung(), at.rungs()),
            value: "+1",
            // Round rather than clamped: a ladder you can only walk up is a
            // ladder that needs the game reopening to walk back down.
            act: () => at.setRung((at.rung() + 1) % (at.rungs() + 1)),
          },
          { label: this.words.debugPurse, value: this.given.purse, act: () => this.give("purse") },
          {
            label: this.words.debugBasket,
            value: this.given.basket,
            act: () => this.give("basket"),
          },
          { label: this.words.debugLearn, value: this.given.learn, act: () => this.give("learn") },
        ]
      : [];

    const above = PAD + TITLE_SIZE + 12 + SMALL_SIZE + 14;
    const tall = above + rows.length * (BUTTON_H + 8) + PAD;
    const rect = this.paper.layout(width, height, tall);
    const inner = rect.width - PAD * 2;

    let y = rect.top + PAD;
    this.title.setText(this.words.debugTitle).setPosition(rect.centreX, y);
    y += TITLE_SIZE + 12;
    this.hint.setText(this.words.debugHint).setPosition(rect.centreX, y).setVisible(true);
    y += SMALL_SIZE + 14;

    this.madeBy.setVisible(false);
    this.copyright.setVisible(false);
    this.licence.setVisible(false);
    this.note.setVisible(false);
    this.hide(this.sourceButton);
    this.hide(this.sponsorButton);

    for (const [n, row] of rows.entries()) {
      const button = this.rows[n];
      if (!button) continue;
      this.place(
        button,
        rect.centreX,
        y + BUTTON_H / 2,
        inner,
        BUTTON_H,
        `${row.label}   ${row.value}`,
      );
      button.box.removeAllListeners("pointerdown");
      button.box.on("pointerdown", () => {
        row.act();
        this.render();
      });
      y += BUTTON_H + 8;
    }

    this.place(
      this.closeButton,
      rect.left + rect.width - PAD - 14,
      rect.top + PAD + 10,
      28,
      24,
      "x",
    );
  }

  /** What each hand-over row says: its own name, until it has been used. */
  private given = { purse: "", basket: "", learn: "" };

  private give(which: "purse" | "basket" | "learn"): void {
    const at = this.controls;
    if (!at) return;
    if (which === "purse") at.fillPurse();
    if (which === "basket") at.fillBasket();
    if (which === "learn") at.learnEverything();
    this.given = { ...this.given, [which]: this.words.debugDone };
  }

  private hide(button: Button): void {
    button.box.setVisible(false);
    button.label.setVisible(false);
  }

  private place(
    button: Button,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
  ): void {
    // Shown as well as placed. Every part of this sheet is made visible at
    // the top of a render and the rows are hidden again straight after,
    // because only some of them are used — so a row that is placed and not
    // re-shown is a row that is drawn nowhere, which is exactly how the
    // debug face first came up as a heading over an empty sheet.
    button.box.setSize(width, height).setPosition(x, y).setVisible(true);
    button.label.setText(label).setPosition(x, y).setVisible(true);
  }

  private button(onTap: () => void, label = ""): Button {
    const box = this.own(
      this.scene.add
        .rectangle(0, 0, 10, 10, PAPER_PALE_HEX)
        .setStrokeStyle(2, INK_HEX)
        .setInteractive({ useHandCursor: true }),
    );
    const text = this.own(this.text(label, BODY_SIZE, INK).setOrigin(0.5).setAlign("center"));
    box.on("pointerdown", onTap);
    return { box, label: text };
  }

  private text(value: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.scene.add.text(0, 0, value, {
      fontFamily: FACE,
      fontSize: `${size}px`,
      color,
    });
  }

  private own<T extends PanelPart>(object: T): T {
    this.parts.push(object);
    return object;
  }
}
