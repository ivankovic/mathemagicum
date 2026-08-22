// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import type { Phrases } from "../i18n/phrases";
import type { GameEntry } from "../save/games";
import { MAX_GAMES } from "../save/games";
import { LANGUAGES, LANGUAGE_NAMES, type Settings } from "../settings";
import { makeAdditionProblem } from "../spells/addition";
import { BANDS, DEFAULT_BAND, sampleProblem } from "../spells/difficulty";
import { createRng } from "../world/rng";
import { PANEL_PAD as PAD, ParchmentPanel } from "./ParchmentPanel";
import { UiAsset, type UiIndex, uiTextureKey } from "./assets";

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
 * src/shop/currency.ts for why. The line that stated what a crop sells for
 * has gone the same way: it was a fact about invented money that nobody was
 * going to have a question about, and the space is an **About** button now,
 * which answers the one an adult opening this screen actually has.
 *
 * Every change applies at once and is saved at once. There is no OK button:
 * an options screen with one asks the player to remember a second step in
 * order for the first to count.
 *
 * **Except the games row.** It lists the games saved on this device, newest
 * first, with the one being played outlined. One rule governs it: *tap
 * another game to open it, tap the one you are in to be asked whether to
 * throw it away.* Opening loses nothing and needs no confirming — you can
 * tap straight back. Throwing away cannot be undone, so it asks twice: the
 * row turns into a tick and a cross and nothing happens until one is
 * pressed.
 *
 * That is also the one place left in the game that spends a sentence — see
 * `resetHint`. This screen is aimed at an adult, and an adult shown a
 * wordless tick and cross will assume the worst about what is being deleted.
 */

const PANEL_MAX_W = 420;
const PANEL_MAX_H = 344;
const PANEL_MIN_W = 280;
const PANEL_MIN_H = 290;

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
/** How big the map and the two answers are drawn on their buttons. */
const ICON = 22;

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
  private readonly aboutButton: Choice;
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
  /** The games row: one tile per saved game, and the "+" that starts another. */
  private readonly gameChoices: Choice[] = [];
  private readonly newButton: Choice;
  private readonly yesButton: Choice;
  private readonly noButton: Choice;
  private readonly resetHint: Phaser.GameObjects.Text;
  private readonly icons: Phaser.GameObjects.Image[] = [];

  /**
   * Somebody asked for a new world, twice.
   *
   * The panel does not do it: it has no business knowing what a world is or
   * where one is kept. It knows how to ask.
   */
  /** Open a saved game, or start one when the id is null. */
  onOpenGame?: (id: string | null) => void;
  /** Throw one away, twice-asked. */
  onDeleteGame?: (id: string | null) => void;
  /**
   * Show who made this and what it costs.
   *
   * Asked for rather than done here, like everything else on this panel: it
   * has no business knowing what a sponsorship is.
   */
  onAbout?: () => void;

  private games: readonly GameEntry[] = [];
  private playing: string | null = null;

  /** Tell the row what there is to show. */
  setGames(games: readonly GameEntry[], playing: string | null): void {
    this.games = games;
    this.playing = playing;
    this.asking = false;
    if (this.open) this.render();
  }

  /**
   * One rule for the whole row: another game opens, this one asks.
   *
   * Opening loses nothing — the game being left is written down first and
   * you can tap straight back — so it needs no confirming. Throwing away
   * cannot be undone, and the only game you may throw away is the one you
   * are in, which is also the one whose loss you can see.
   */
  private tapGame(slot: number): void {
    const game = this.games[slot];
    if (!game) return;
    if (game.id !== this.playing) {
      this.onOpenGame?.(game.id);
      return;
    }
    this.asking = true;
    this.render();
  }

  private open = false;
  /** Whether the world row has been tapped once and is asking. */
  private asking = false;
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
    this.aboutButton = this.choice("", () => this.onAbout?.());

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
    for (let n = 0; n < MAX_GAMES; n++) {
      this.gameChoices.push(this.choice("", () => this.tapGame(n)));
    }
    this.newButton = this.iconChoice(UiAsset.MapWall, () => this.onOpenGame?.(null));
    this.yesButton = this.iconChoice(UiAsset.MarkYes, () => {
      this.asking = false;
      this.onDeleteGame?.(this.playing);
    });
    this.noButton = this.iconChoice(UiAsset.MarkNo, () => {
      this.asking = false;
      this.render();
    });
    this.resetHint = this.own(
      this.text("", SMALL_SIZE, INK_DIM).setOrigin(0.5, 0).setAlign("center"),
    );
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
    return [
      ...this.languageChoices,
      ...this.bandChoices,
      ...this.gameChoices,
      this.newButton,
      this.yesButton,
      this.noButton,
      this.closeButton,
    ];
  }

  /** A button with a picture on it rather than a word. */
  private iconChoice(asset: string, onTap: () => void): Choice {
    const choice = this.choice("", onTap);
    const icon = this.own(
      this.scene.add.image(0, 0, uiTextureKey(asset)).setDisplaySize(ICON, ICON),
    );
    this.icons.push(icon);
    this.iconOf.set(choice.box, icon);
    return choice;
  }

  get isOpen(): boolean {
    return this.open;
  }

  /**
   * Where the world row's buttons are, for a script to press.
   *
   * The one control in the game that cannot be undone is also the one whose
   * position moves with the panel's height — and a browser check that
   * hard-codes a coordinate for it silently stops pressing it the day the
   * layout changes, which reads exactly like a reset that quietly stopped
   * working. Asked for rather than computed, so it cannot drift.
   */
  buttonPositions(): Record<string, { x: number; y: number }> {
    const at: Record<string, { x: number; y: number }> = {
      about: { x: this.aboutButton.box.x, y: this.aboutButton.box.y },
      newGame: { x: this.newButton.box.x, y: this.newButton.box.y },
      deleteYes: { x: this.yesButton.box.x, y: this.yesButton.box.y },
      deleteNo: { x: this.noButton.box.x, y: this.noButton.box.y },
    };
    for (const [n, button] of this.gameChoices.entries()) {
      at[`game.${n}`] = { x: button.box.x, y: button.box.y };
    }
    return at;
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
    // Never still asking when it opens again. A confirm that survived being
    // dismissed would be a confirm that answered a question nobody had just
    // asked.
    this.asking = false;
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

  private band = DEFAULT_BAND;

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

    // Where the price of a crop used to be stated. That was a fact about
    // this game's own invented money and nobody was ever going to have a
    // question about it; who made the thing, and whether they want paying,
    // is the question an adult opening this screen actually has.
    this.place(
      this.aboutButton,
      rect.centreX,
      rect.top + rect.height - PAD - BUTTON_H / 2,
      Math.min(200, rect.width - PAD * 2),
      BUTTON_H,
    );
    this.aboutButton.label.setText(this.words.aboutButton);
    this.show(this.aboutButton);

    this.worldRow(rect, rect.top + PAD + TITLE_SIZE + 18 + ROW_HEIGHT * 2);
  }

  /**
   * The world, and the one button that throws it away.
   *
   * Two states in one row. Untapped it is a map, on its own, off to the left
   * like every other row's first button — a thing you have to mean to press.
   * Tapped, the map stays put and a tick and a cross appear beside it, with
   * a line under them saying what survives. Nothing happens in between.
   *
   * The map is the picture because the map is already what "the world" looks
   * like in this game: it is what hangs on the tower wall and what the portal
   * spell rules a ruler across.
   */
  private worldRow(rect: { left: number; width: number; centreX: number }, top: number): void {
    const label = this.headings[2];
    label
      ?.setText(this.words.gamesHeading)
      .setPosition(rect.left + PAD, top)
      .setVisible(true);

    const y = top + SMALL_SIZE + 8 + BUTTON_H / 2;
    // Asking, the row is a tick and a cross and nothing else: a question
    // with the answers still surrounded by the things you might tap instead
    // is a question somebody answers by accident.
    if (this.asking) {
      const half = (rect.width - PAD * 2 - BUTTON_GAP) / 2;
      this.place(this.yesButton, rect.left + PAD + half / 2, y, half, BUTTON_H);
      this.place(this.noButton, rect.left + PAD + half * 1.5 + BUTTON_GAP, y, half, BUTTON_H);
      this.show(this.yesButton);
      this.show(this.noButton);
      // The one sentence left on any screen in the game, and it is here
      // because this screen is for an adult: somebody shown a wordless tick
      // and cross will assume the worst about what is being deleted.
      this.resetHint
        .setText(this.words.deleteGameAsk)
        .setWordWrapWidth(rect.width - PAD * 2)
        .setPosition(rect.centreX, y + BUTTON_H / 2 + 6)
        .setVisible(true);
      return;
    }

    // A tile per saved game and a "+" after them, all one width so the row
    // does not reflow as games come and go.
    const slots = MAX_GAMES;
    const width = (rect.width - PAD * 2 - BUTTON_GAP * (slots - 1)) / slots;
    const at = (n: number) => rect.left + PAD + (width + BUTTON_GAP) * n + width / 2;
    for (const [n, game] of this.games.slice(0, slots).entries()) {
      const button = this.gameChoices[n];
      if (!button) continue;
      button.label.setText(this.words.gameWhen(game.savedAt));
      this.place(button, at(n), y, width, BUTTON_H);
      button.box.setStrokeStyle(2, game.id === this.playing ? CHOSEN_HEX : INK_HEX);
      this.show(button);
    }
    if (this.games.length >= slots) return;
    this.place(this.newButton, at(this.games.length), y, width, BUTTON_H);
    this.newButton.box.setStrokeStyle(2, INK_HEX);
    this.show(this.newButton);
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

  private readonly iconOf = new Map<Phaser.GameObjects.Rectangle, Phaser.GameObjects.Image>();

  private place(choice: Choice, x: number, y: number, width: number, height: number): void {
    choice.box.setSize(width, height).setPosition(x, y);
    choice.label.setPosition(x, y);
    this.iconOf.get(choice.box)?.setPosition(x, y);
  }

  private show(choice: Choice): void {
    choice.box.setVisible(true);
    choice.label.setVisible(true);
    this.iconOf.get(choice.box)?.setVisible(true);
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
