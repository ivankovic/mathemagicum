// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import type { Phrases } from "../i18n/phrases";
import { isLastPage, stepPage } from "../pages";
import { PANEL_PAD as PAD, type PanelRect, ParchmentPanel } from "./ParchmentPanel";
import { type UiIndex, uiTextureKey } from "./assets";

/**
 * A short deck of parchment pages: a title, a line or two, a picture, and a
 * way forward.
 *
 * Two people in this village explain something — the postal worker on the
 * way in and the teacher in the school — and both explain it the same way,
 * because that is what makes the second one legible: a child who has been
 * through one already knows where the "next" button is and what the row of
 * dots means. The shape is deliberately small: one idea per page, a picture
 * on every one, and no scrolling.
 *
 * What a subclass supplies is the deck, the words and the picture. Everything
 * about *being* a panel — the paper, the buttons, Escape and the arrow keys,
 * resizing, which page you are on — is here, once.
 */

const INK = "#4a3422";
const INK_DIM = "#8a6a48";
const INK_HEX = 0x4a3422;
const PAPER_PALE_HEX = 0xf6e8c4;
const HERE_HEX = 0xc8901c;
const LAST_HEX = 0x3d6b2a;

const TITLE_SIZE = 17;
const BODY_SIZE = 13;
const ICON_ART = 40;
const ICON_GAP = 22;
const DOT_GAP = 14;

export interface Chip {
  readonly box: Phaser.GameObjects.Rectangle;
  readonly label: Phaser.GameObjects.Text;
}

export type PanelPart = Phaser.GameObjects.GameObject &
  Phaser.GameObjects.Components.Depth &
  Phaser.GameObjects.Components.ScrollFactor &
  Phaser.GameObjects.Components.Visible;

export interface PagedPanelOptions {
  readonly maxWidth: number;
  readonly maxHeight: number;
  readonly minWidth: number;
  readonly minHeight: number;
  /** How many pictures a page can show side by side. */
  readonly icons: number;
}

export abstract class PagedPanel<TPage> {
  protected readonly paper: ParchmentPanel;
  protected readonly parts: PanelPart[] = [];
  protected readonly ink: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private readonly icons: Phaser.GameObjects.Image[] = [];
  private readonly dots: Phaser.GameObjects.Rectangle[] = [];
  private readonly nextButton: Chip;
  private readonly backButton: Chip;
  private readonly closeButton: Chip;
  private readonly chips: Chip[] = [];

  private opened = false;
  private page: TPage;
  private onClose: (() => void) | null = null;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;

  /**
   * Depth and registration, kept so that `own` can set a part up the moment
   * it is made.
   *
   * They used to be applied in a loop at the end of this constructor, which
   * was fine while a panel was one class: everything existed by then. It
   * stopped being fine the moment a *subclass* made objects of its own —
   * those are built after this constructor returns, so the loop never saw
   * them, and a panel that had not been opened yet left its unhidden pieces
   * sitting in the top-left corner of the screen over the status line.
   */
  private readonly partDepth: number;
  private readonly registerPart: (object: Phaser.GameObjects.GameObject) => void;

  constructor(
    protected readonly scene: Phaser.Scene,
    index: UiIndex,
    depth: number,
    protected words: Phrases,
    register: (object: Phaser.GameObjects.GameObject) => void,
    options: PagedPanelOptions,
  ) {
    this.partDepth = depth;
    this.registerPart = register;
    this.paper = new ParchmentPanel(scene, index, { ...options, depth, register });
    this.ink = this.own(scene.add.graphics());
    this.title = this.own(this.text("", TITLE_SIZE, INK).setOrigin(0.5, 0));
    this.body = this.own(this.text("", BODY_SIZE, INK).setOrigin(0.5, 0).setAlign("center"));

    // Built blank and pointed at a texture per page: the pictures change from
    // page to page, and a pool costs one image each rather than one per page
    // per panel.
    for (let i = 0; i < options.icons; i++) {
      this.icons.push(this.raise(this.own(scene.add.image(0, 0, uiTextureKey("parchment-frame")))));
    }
    for (let i = 0; i < this.deck().length; i++) {
      this.dots.push(
        this.own(scene.add.rectangle(0, 0, 7, 7, PAPER_PALE_HEX).setStrokeStyle(2, INK_HEX)),
      );
    }

    this.nextButton = this.button(() => this.turn(1));
    this.backButton = this.button(() => this.turn(-1));
    this.closeButton = this.button(() => this.close());
    this.page = this.deck()[0] as TPage;
  }

  // --- what a subclass answers ----------------------------------------------

  /** Every page, in order. Called during construction, so it must be pure. */
  protected abstract deck(): readonly TPage[];
  protected abstract titleText(): string;
  protected abstract bodyText(page: TPage): string;
  /** The picture for a page, drawn between `top` and `bottom`. */
  protected abstract drawArt(rect: PanelRect, top: number, bottom: number, page: TPage): void;

  // --- being a panel --------------------------------------------------------

  get isOpen(): boolean {
    return this.opened;
  }

  /** Say everything from here on in another language. */
  setPhrases(words: Phrases): void {
    this.words = words;
    if (this.opened) this.render();
  }

  open_(onClose: () => void): void {
    this.opened = true;
    this.onClose = onClose;
    // Always from the top: one that resumed where it was left off would open
    // on page three for somebody who came back to hear it again.
    this.page = this.deck()[0] as TPage;
    this.paper.setVisible(true);
    this.render();
    this.keyHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        this.close();
      } else if (event.key === "ArrowRight" || event.key === "Enter") {
        event.preventDefault();
        this.turn(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        this.turn(-1);
      }
    };
    this.scene.input.keyboard?.on("keydown", this.keyHandler);
  }

  close(): void {
    if (this.keyHandler) {
      this.scene.input.keyboard?.off("keydown", this.keyHandler);
      this.keyHandler = null;
    }
    this.opened = false;
    this.paper.setVisible(false);
    this.ink.clear();
    for (const part of this.parts) part.setVisible(false);
    const done = this.onClose;
    this.onClose = null;
    done?.();
  }

  layout(): void {
    if (this.opened) this.render();
  }

  /** Forward off the last page closes: "next" there says something final. */
  private turn(step: number): void {
    if (step > 0 && isLastPage(this.deck(), this.page)) {
      this.close();
      return;
    }
    this.page = stepPage(this.deck(), this.page, step);
    this.render();
  }

  private render(): void {
    const { width, height } = this.scene.scale;
    const rect = this.paper.layout(width, height);
    for (const part of this.parts) part.setVisible(false);
    this.ink.clear();
    this.ink.setVisible(true);

    this.title
      .setText(this.titleText())
      .setPosition(rect.centreX, rect.top + PAD)
      .setVisible(true);
    this.place(this.closeButton, rect.left + rect.width - PAD - 14, rect.top + PAD + 10, 28, 24);
    this.closeButton.label.setText("x");
    this.show(this.closeButton);

    const bodyTop = rect.top + PAD + TITLE_SIZE + 12;
    this.body
      .setText(this.bodyText(this.page))
      .setWordWrapWidth(rect.width - PAD * 2)
      .setPosition(rect.centreX, bodyTop)
      .setVisible(true);

    this.drawArt(
      rect,
      bodyTop + this.body.height + 16,
      rect.top + rect.height - PAD - 58,
      this.page,
    );

    // Where you are in the deck, as one dot per page: four pages is few
    // enough to show rather than to count in words.
    const deck = this.deck();
    const dotsY = rect.top + rect.height - PAD - 44;
    for (const [i, dot] of this.dots.entries()) {
      const spread = (this.dots.length - 1) * DOT_GAP;
      dot
        .setPosition(rect.centreX - spread / 2 + i * DOT_GAP, dotsY)
        .setFillStyle(deck[i] === this.page ? HERE_HEX : PAPER_PALE_HEX)
        .setVisible(true);
    }

    const last = isLastPage(deck, this.page);
    const buttonY = rect.top + rect.height - PAD - 18;
    this.place(this.nextButton, rect.centreX + 66, buttonY, 120, 28);
    this.nextButton.label.setText(last ? this.words.lessonDone : this.words.lessonNext);
    this.nextButton.box.setStrokeStyle(2, last ? LAST_HEX : INK_HEX);
    this.show(this.nextButton);
    if (this.page !== deck[0]) {
      this.place(this.backButton, rect.centreX - 66, buttonY, 120, 28);
      this.backButton.label.setText(this.words.lessonBack);
      this.show(this.backButton);
    }
  }

  /**
   * A row of pictures, centred.
   *
   * The panel's stock art: everything a page might want to show that is not
   * a diagram is one, two or three icons the player has already seen in the
   * corner of the screen.
   */
  protected drawIcons(rect: PanelRect, middle: number, assets: readonly string[]): void {
    const shown = Math.min(assets.length, this.icons.length);
    const spread = (shown - 1) * (ICON_ART + ICON_GAP);
    for (let i = 0; i < shown; i++) {
      const icon = this.icons[i];
      const asset = assets[i];
      if (!icon || !asset) continue;
      icon
        .setTexture(uiTextureKey(asset))
        .setDisplaySize(ICON_ART, ICON_ART)
        .setPosition(rect.centreX - spread / 2 + i * (ICON_ART + ICON_GAP), middle)
        .setVisible(true);
    }
  }

  // --- plumbing -------------------------------------------------------------

  protected chip(width: number, height: number): Chip {
    const box = this.own(
      this.scene.add.rectangle(0, 0, width, height, PAPER_PALE_HEX).setStrokeStyle(2, INK_HEX),
    );
    const label = this.raise(this.own(this.text("", BODY_SIZE, INK).setOrigin(0.5)));
    const chip = { box, label };
    this.chips.push(chip);
    return chip;
  }

  protected button(onTap: () => void): Chip {
    const chip = this.chip(10, 10);
    chip.box.setInteractive({ useHandCursor: true }).on("pointerdown", onTap);
    return chip;
  }

  protected place(chip: Chip, x: number, y: number, width: number, height: number): void {
    chip.box.setSize(width, height).setPosition(x, y);
    chip.label.setPosition(x, y);
  }

  protected show(chip: Chip): void {
    chip.box.setVisible(true);
    chip.label.setVisible(true);
  }

  protected text(value: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.scene.add.text(0, 0, value, {
      fontFamily: "monospace",
      fontSize: `${size}px`,
      color,
      lineSpacing: 3,
    });
  }

  protected dimText(value: string, size: number): Phaser.GameObjects.Text {
    return this.text(value, size, INK_DIM);
  }

  /**
   * Adopt a part: depth, camera, hidden, registered — all of it, at once.
   *
   * Everything a panel draws goes through here, including anything a
   * subclass makes for itself, which is what keeps a half-built panel from
   * showing pieces of itself before it is ever opened.
   */
  protected own<T extends PanelPart>(object: T): T {
    object
      .setDepth(this.partDepth + 1)
      .setScrollFactor(0)
      .setVisible(false);
    this.registerPart(object);
    this.parts.push(object);
    return object;
  }

  /** A label or a picture that has to sit above the box it belongs to. */
  protected raise<T extends PanelPart>(object: T): T {
    object.setDepth(this.partDepth + 2);
    return object;
  }

  destroy(): void {
    this.close();
    this.paper.destroy();
    for (const part of this.parts) part.destroy();
  }
}
