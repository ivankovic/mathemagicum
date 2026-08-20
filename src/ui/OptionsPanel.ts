// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import type { Phrases } from "../i18n/phrases";
import { LANGUAGES, LANGUAGE_NAMES, type Settings } from "../settings";
import { CURRENCY } from "../shop/currency";
import { makeAdditionProblem } from "../spells/addition";
import { BANDS, DEFAULT_BAND, sampleProblem } from "../spells/difficulty";
import { createRng } from "../world/rng";
import { CROP_PRICE } from "../world/shop";
import { PANEL_PAD as PAD, ParchmentPanel } from "./ParchmentPanel";
import type { UiIndex } from "./assets";

/**
 * The options: which language the game is read in.
 *
 * A row of buttons rather than a dropdown or a cycling label, because the
 * whole set of choices is small enough to show at once and a child should be
 * able to see what the alternatives are before picking one. The chosen one
 * is outlined, so the screen also answers "what is it set to now?".
 *
 * There was a money row here too, while the game offered real currencies. It
 * offers one invented money now and there is nothing left to choose — see
 * src/shop/currency.ts for why.
 *
 * Every change applies at once and is saved at once. There is no OK button:
 * an options screen with one asks the player to remember a second step in
 * order for the first to count.
 */

const PANEL_MAX_W = 420;
const PANEL_MAX_H = 300;
const PANEL_MIN_W = 280;
const PANEL_MIN_H = 220;

const INK = "#4a3422";
const INK_DIM = "#8a6a48";
const INK_HEX = 0x4a3422;
const PAPER_PALE_HEX = 0xf6e8c4;
const CHOSEN_HEX = 0xc8901c;

const TITLE_SIZE = 17;
const ROW_SIZE = 13;
const SMALL_SIZE = 12;

const BUTTON_H = 32;
const BUTTON_GAP = 6;
/** A heading and the row of buttons under it, plus air before the next one. */
const ROW_HEIGHT = SMALL_SIZE + 8 + BUTTON_H + 18;

interface Choice {
  readonly box: Phaser.GameObjects.Rectangle;
  readonly label: Phaser.GameObjects.Text;
}

type PanelPart = Phaser.GameObjects.GameObject &
  Phaser.GameObjects.Components.Depth &
  Phaser.GameObjects.Components.ScrollFactor &
  Phaser.GameObjects.Components.Visible;

export class OptionsPanel {
  private readonly paper: ParchmentPanel;
  private readonly parts: PanelPart[] = [];
  private readonly title: Phaser.GameObjects.Text;
  private readonly headings: Phaser.GameObjects.Text[] = [];
  private readonly example: Phaser.GameObjects.Text;
  private readonly languageChoices: Choice[] = [];
  /**
   * Which sums this child gets, shown as four sample sums.
   *
   * Here as well as on the screen that makes a player, because a setup
   * choice made once by a parent is a choice made before they had seen the
   * child play — and an adaptive system that has quietly settled on the
   * wrong band with no way to overrule it is worse than no adaptation at
   * all. The game moves *inside* a band; only a person moves between them.
   */
  private readonly bandChoices: Choice[] = [];
  private readonly closeButton: Choice;

  private open = false;
  private onClose: (() => void) | null = null;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;

  /** Set by the scene: a choice was made, apply it and remember it. */
  onChange: ((settings: Settings) => void) | null = null;
  onBandChange: ((band: number) => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    index: UiIndex,
    depth: number,
    private settings: Settings,
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
    for (let i = 0; i < 3; i++) {
      this.headings.push(this.own(this.text("", SMALL_SIZE, INK_DIM).setOrigin(0, 0)));
    }
    this.example = this.own(this.text("", SMALL_SIZE, INK_DIM).setOrigin(0.5, 1));

    for (const language of LANGUAGES) {
      this.languageChoices.push(
        this.choice(LANGUAGE_NAMES[language], () => this.choose({ language })),
      );
    }
    for (const [index, band] of BANDS.entries()) {
      // Built by the spell, so a label here cannot drift from what the band
      // sets — the same discipline as the teacher's worked example.
      const sample = sampleProblem(band, (seed, rung) =>
        makeAdditionProblem(createRng(seed), rung),
      );
      this.bandChoices.push(
        this.choice(`${sample.start} + ${sample.addend}`, () => this.chooseBand(index)),
      );
    }
    this.closeButton = this.choice("x", () => this.close());

    for (const part of this.parts) {
      part
        .setDepth(depth + 1)
        .setScrollFactor(0)
        .setVisible(false);
      register(part);
    }
    for (const choice of this.allChoices()) choice.label.setDepth(depth + 2);
  }

  private allChoices(): Choice[] {
    return [...this.languageChoices, ...this.bandChoices, this.closeButton];
  }

  get isOpen(): boolean {
    return this.open;
  }

  open_(onClose: () => void): void {
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

  layout(): void {
    if (this.open) this.render();
  }

  /** The settings the panel is showing, for a scene that changed them elsewhere. */
  setSettings(settings: Settings): void {
    this.settings = settings;
    if (this.open) this.render();
  }

  /** Say everything from here on in another language. */
  /** What a crop fetches for this child — see src/spells/difficulty.ts. */
  private cropPrice = CROP_PRICE;
  private band = DEFAULT_BAND;

  setCropPrice(price: number): void {
    this.cropPrice = price;
    if (this.isOpen) this.render();
  }

  setPhrases(words: Phrases): void {
    this.words = words;
    if (this.open) this.render();
  }

  private chooseBand(band: number): void {
    if (band === this.band) return;
    this.band = band;
    this.onBandChange?.(band);
    this.render();
  }

  setBand(band: number): void {
    this.band = band;
    if (this.open) this.render();
  }

  private choose(change: Partial<Settings>): void {
    const next: Settings = { ...this.settings, ...change };
    if (next.language === this.settings.language) return;
    this.settings = next;
    this.onChange?.(next);
    this.render();
  }

  private render(): void {
    const { width, height } = this.scene.scale;
    const rect = this.paper.layout(width, height);
    for (const part of this.parts) part.setVisible(false);

    this.title
      .setText(this.words.optionsTitle)
      .setPosition(rect.centreX, rect.top + PAD)
      .setVisible(true);
    this.place(this.closeButton, rect.left + rect.width - PAD - 14, rect.top + PAD + 10, 28, 24);
    this.show(this.closeButton);

    this.row(
      rect,
      rect.top + PAD + TITLE_SIZE + 18,
      0,
      this.words.languageHeading,
      this.languageChoices,
      LANGUAGES,
      this.settings.language,
    );

    this.row(
      rect,
      rect.top + PAD + TITLE_SIZE + 18 + ROW_HEIGHT,
      1,
      this.words.sumsHeading,
      this.bandChoices,
      BANDS.map((_, index) => index),
      this.band,
    );

    // The money, stated rather than chosen: it follows the sums above, and
    // it is the one number on this screen a player might have a question
    // about — a price answers it better than a name would.
    this.example
      .setText(this.words.cropSellsFor(CURRENCY.format(this.cropPrice)))
      .setPosition(rect.centreX, rect.top + rect.height - PAD)
      .setVisible(true);
  }

  private row<T>(
    rect: { left: number; width: number },
    top: number,
    slot: number,
    heading: string,
    buttons: Choice[],
    values: readonly T[],
    chosen: T,
  ): number {
    const label = this.headings[slot];
    label
      ?.setText(heading)
      .setPosition(rect.left + PAD, top)
      .setVisible(true);

    const y = top + SMALL_SIZE + 8;
    const count = Math.max(1, values.length);
    const width = (rect.width - PAD * 2 - BUTTON_GAP * (count - 1)) / count;
    for (const [i, value] of values.entries()) {
      const button = buttons[i];
      if (!button) continue;
      const x = rect.left + PAD + (width + BUTTON_GAP) * i + width / 2;
      this.place(button, x, y + BUTTON_H / 2, width, BUTTON_H);
      button.box.setStrokeStyle(2, value === chosen ? CHOSEN_HEX : INK_HEX);
      this.show(button);
    }
    return y + BUTTON_H;
  }

  private choice(text: string, onTap: () => void): Choice {
    const box = this.own(
      this.scene.add
        .rectangle(0, 0, 10, 10, PAPER_PALE_HEX)
        .setStrokeStyle(2, INK_HEX)
        .setInteractive({ useHandCursor: true }),
    );
    const label = this.own(this.text(text, ROW_SIZE, INK).setOrigin(0.5).setAlign("center"));
    box.on("pointerdown", onTap);
    return { box, label };
  }

  private place(choice: Choice, x: number, y: number, width: number, height: number): void {
    choice.box.setSize(width, height).setPosition(x, y);
    choice.label.setPosition(x, y);
  }

  private show(choice: Choice): void {
    choice.box.setVisible(true);
    choice.label.setVisible(true);
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
