// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import type { Phrases } from "../i18n/phrases";
import { PANEL_PAD as PAD, ParchmentPanel } from "./ParchmentPanel";
import type { UiIndex } from "./assets";

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

const INK = "#4a3422";
const INK_DIM = "#8a6a48";
const INK_HEX = 0x4a3422;
const PAPER_PALE_HEX = 0xf6e8c4;

const TITLE_SIZE = 17;
const BODY_SIZE = 13;
const SMALL_SIZE = 11;
const BUTTON_H = 34;
const BUTTON_GAP = 10;

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

  show(onClose: () => void): void {
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
    return {
      source: { x: this.sourceButton.box.x, y: this.sourceButton.box.y },
      sponsor: { x: this.sponsorButton.box.x, y: this.sponsorButton.box.y },
      close: { x: this.closeButton.box.x, y: this.closeButton.box.y },
    };
  }

  destroy(): void {
    this.close();
    this.paper.destroy();
    for (const part of this.parts) part.destroy();
  }

  private render(): void {
    const { width, height } = this.scene.scale;
    for (const part of this.parts) part.setVisible(true);

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

  private place(
    button: Button,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
  ): void {
    button.box.setSize(width, height).setPosition(x, y);
    button.label.setText(label).setPosition(x, y);
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
