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
import { UiAsset, type UiIndex, flagIcon, uiTextureKey } from "./assets";
import { INK, INK_DIM, INK_HEX, PAPER_PALE_HEX } from "./parchment";

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
/**
 * Tall enough for a row that has taken a second line.
 *
 * Three hundred and forty-four was right while every row was one line of
 * three or fewer. A fourth band made the sums row wrap on a phone held
 * upright — and at that height it missed the room to do so by six pixels, so
 * it stayed on one line and the six-digit sum ran out of its own button
 * instead. The panel is not padding: what it holds grew.
 */
const PANEL_MAX_H = 400;
const PANEL_MIN_W = 280;
const PANEL_MIN_H = 290;

const CHOSEN_HEX = 0xc8901c;

const TITLE_SIZE = 17;
const ROW_SIZE = 13;
/** The smallest a row's words may be set before they stop being words. */
const ROW_SIZE_MIN = 8;
/**
 * How far a row's words may be shrunk before it wraps instead.
 *
 * Below about three quarters, a sum stops being something a parent can read
 * across a kitchen table — and reading it is the entire job of these
 * buttons. Past that the row takes another line rather than another point
 * off the type.
 */
const NARROWEST = 0.75;
const SMALL_SIZE = 12;

const BUTTON_H = 32;
const BUTTON_GAP = 6;
/** How long the export button says "saved" before going back to what it does. */
const EXPORT_SAID_MS = 2200;
/** A heading and the row of buttons under it, plus air before the next one. */
/** How big the map and the two answers are drawn on their buttons. */
const ICON = 22;
/** Between a flag and the name of the language it stands for. */
const LABEL_GAP = 8;

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
  private readonly exportButton: Choice;
  /** Set while the button is saying "saved" rather than what it does. */
  private exported = false;
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

  /**
   * Write every save on this device into a file.
   *
   * Asked for rather than done here, for the reason `onAbout` is: making a
   * file and handing it to whatever the device does with files is the one
   * job on this screen that is entirely about the browser, and this panel
   * draws buttons.
   *
   * It answers, though — the button says so afterwards. A control that
   * silently hands a file to a share sheet a parent then cancels needs to
   * be able to say that nothing was saved, and the only thing that knows is
   * whatever does the work.
   */
  onExport?: () => Promise<boolean>;

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
    this.exportButton = this.pictureChoice(UiAsset.SignBackup, "", () => this.exportNow());

    for (const language of LANGUAGES) {
      // Flag *and* name. The flag is for the child who cannot read either
      // name; the name is for everybody else, and for anyone who reads a
      // flag as a country rather than as a language.
      this.languageChoices.push(
        this.pictureChoice(flagIcon(language), LANGUAGE_NAMES[language], () =>
          this.choose({ language }),
        ),
      );
    }
    for (const [index, band] of BANDS.entries()) {
      // Built by the spell, so a label here cannot drift from what the band
      // sets — the same discipline as the teacher's worked example.
      const sample = sampleProblem(
        band,
        (seed, rung) => makeAdditionProblem(createRng(seed), rung),
        BANDS[index - 1],
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
      this.exportButton,
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
    this.iconOf.set(choice.box, { image: icon, width: ICON, beside: false });
    return choice;
  }

  /**
   * A button with a picture on it and a word beside the picture.
   *
   * At the picture's own size rather than squared into the icon box every
   * other one here uses: a flag is a rectangle and a flag squashed to a
   * square is a flag drawn wrong rather than a flag drawn small. The same
   * is true of the backup sign, which is why the two share this.
   */
  private pictureChoice(asset: string, text: string, onTap: () => void): Choice {
    const choice = this.choice(text, onTap);
    const icon = this.own(this.scene.add.image(0, 0, uiTextureKey(asset)).setOrigin(0.5));
    this.icons.push(icon);
    // Brought down to about the icon box when it is bigger than one, and by
    // a whole number: this is pixel art, and forty-eight resampled to
    // twenty-two is a picture with some rows dropped and others doubled.
    // Halved it is twenty-four, which is two pixels over the box and well
    // inside the button, and it is still the drawing.
    //
    // The flags are smaller than the box already and divide by one, which
    // is the same as being left alone.
    const part = Math.max(1, Math.round(icon.height / ICON));
    icon.setDisplaySize(icon.width / part, icon.height / part);
    this.iconOf.set(choice.box, { image: icon, width: icon.displayWidth, beside: true });
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
      exportSaves: { x: this.exportButton.box.x, y: this.exportButton.box.y },
      newGame: { x: this.newButton.box.x, y: this.newButton.box.y },
      deleteYes: { x: this.yesButton.box.x, y: this.yesButton.box.y },
      deleteNo: { x: this.noButton.box.x, y: this.noButton.box.y },
    };
    for (const [n, button] of this.gameChoices.entries()) {
      at[`game.${n}`] = { x: button.box.x, y: button.box.y };
    }
    // The band picker is the only way difficulty moves between bands now —
    // the adaptation stops at the edges of whichever one is chosen here — so
    // it is the control a script has to be able to reach to check that it
    // does. Same for the language row, which was in the same position.
    for (const [n, button] of this.bandChoices.entries()) {
      at[`band.${n}`] = { x: button.box.x, y: button.box.y };
    }
    for (const [n, button] of this.languageChoices.entries()) {
      at[`language.${n}`] = { x: button.box.x, y: button.box.y };
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

    // Each row starts where the last one ended rather than at a multiple of
    // one height: a row that wraps onto two lines is taller than a row that
    // does not, and the rows below it have to come down with it. Stacked by
    // multiplication instead, the sums landed on top of the languages the
    // moment either of them needed a second line.
    const AFTER_ROW = 18;
    let below = this.row(
      rect,
      rect.top + PAD + TITLE_SIZE + 18,
      0,
      this.words.languageHeading,
      this.languageChoices,
      LANGUAGES,
      this.settings.language,
    );

    // The lowest the sums may reach: what the world row and the button
    // under it need, measured back from the foot of the panel rather than
    // guessed.
    const aboutTop = rect.top + rect.height - PAD - BUTTON_H;
    const worldNeeds = AFTER_ROW + SMALL_SIZE + 8 + BUTTON_H;
    below = this.row(
      rect,
      below + AFTER_ROW,
      1,
      this.words.sumsHeading,
      this.bandChoices,
      BANDS.map((_, index) => index),
      this.band,
      aboutTop - AFTER_ROW - worldNeeds,
    );

    // Where the price of a crop used to be stated. That was a fact about
    // this game's own invented money and nobody was ever going to have a
    // question about it; who made the thing, and whether they want paying,
    // is the question an adult opening this screen actually has.
    //
    // Two buttons wide now, and the second one is the answer to the notice
    // a parent was shown while the game was being set up: the world lives
    // on this device and nowhere else, so here is how to take a copy of it.
    // At the foot beside "about" rather than up in the games row, because
    // it is a thing done *to* the device rather than to any one game.
    const footer = Math.min(200, (rect.width - PAD * 2 - BUTTON_GAP) / 2);
    const footerY = rect.top + rect.height - PAD - BUTTON_H / 2;
    // The word first, then the placing. `place` centres a picture and its
    // word together as one block and measures the word to do it, so a
    // button placed while its label is still empty gets a block the width
    // of the picture alone — and the picture ends up in the middle of the
    // button with the word laid across it.
    this.exportButton.label.setText(this.exported ? this.words.exportDone : this.words.exportSaves);
    // And the word goes if it will not fit, which on this button is a
    // smaller loss than anywhere else on the panel: what is left is the
    // same picture the third notice showed while the game was being set up,
    // which is what a parent is looking for. `Izvezi spremljene igre` is
    // twice the length of `Export saves` and a phone's footer is half a
    // tablet's, so this is reached by an ordinary player rather than by a
    // contrived one — it is the same overflow the sums row grew its own
    // answer to.
    this.place(
      this.exportButton,
      rect.centreX - footer / 2 - BUTTON_GAP / 2,
      footerY,
      footer,
      BUTTON_H,
      this.blockWidth(this.exportButton) > footer - LABEL_GAP,
    );
    this.show(this.exportButton);
    this.place(
      this.aboutButton,
      rect.centreX + footer / 2 + BUTTON_GAP / 2,
      footerY,
      footer,
      BUTTON_H,
    );
    this.aboutButton.label.setText(this.words.aboutButton);
    this.show(this.aboutButton);

    this.worldRow(rect, below + AFTER_ROW);
  }

  /**
   * Take the backup, and say so on the button.
   *
   * Saying so matters more here than anywhere else on this screen. On a
   * tablet the file goes to the share sheet, which is the operating
   * system's window and not this game's — so from in here a backup that
   * worked and a backup a parent dismissed look identical, and a button
   * that answered either way with nothing at all would leave somebody
   * tapping it again wondering whether it does anything.
   *
   * The word goes back after a beat rather than staying. "Saved" left on
   * the button for ever is a button that has stopped being an instruction.
   */
  private exportNow(): void {
    if (!this.onExport) return;
    void this.onExport().then((saved) => {
      if (!saved || !this.open) return;
      this.exported = true;
      this.render();
      this.scene.time.delayedCall(EXPORT_SAID_MS, () => {
        this.exported = false;
        if (this.open) this.render();
      });
    });
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
    floor = Number.POSITIVE_INFINITY,
  ): number {
    const label = this.headings[slot];
    label
      ?.setText(heading)
      .setPosition(rect.left + PAD, top)
      .setVisible(true);

    const y = top + SMALL_SIZE + 8;
    const count = Math.max(1, values.length);
    // How many fit on a line, and how many lines that takes.
    //
    // Four sums side by side on a phone gave each of them sixty-five pixels
    // to hold `557269 + 168594`, which is fifteen characters — so the
    // six-digit band ran out of both ends of its own button. Type alone
    // could not save it: shrunk to fit, that label would be five pixels
    // tall and the row would be four illegible smudges.
    //
    // So a row that cannot hold its widest label at a readable size goes
    // onto two lines instead. Two lines of two is the same four choices with
    // twice the width each, which is enough at every size this runs at.
    const room = rect.width - PAD * 2;
    const widest = Math.max(0, ...buttons.slice(0, count).map((one) => one.label.width));
    const abreast = (many: number) => (room - BUTTON_GAP * (many - 1)) / many;
    const tooTight = widest > 0 && abreast(count) < widest * NARROWEST + LABEL_GAP * 2;
    // And only if there is room for the second line. A phone held sideways
    // gives this panel three hundred pixels of height for a title, three
    // rows and a button, and a row that took an extra line there pushed the
    // last row straight through the button underneath it. Where it will not
    // fit, the words are shrunk as they were before — smaller than is ideal,
    // but on screen and inside their own box.
    const wrapped = y + BUTTON_H * 2 + BUTTON_GAP <= floor;
    const perLine = tooTight && wrapped ? Math.max(1, Math.ceil(count / 2)) : count;
    const lines = Math.ceil(count / perLine);
    const width = abreast(perLine);
    // One decision for the whole row, not one per button. A third language
    // makes every button a third narrower, and the three names are not the
    // same length — asked one at a time, the short ones keep their word and
    // the long one loses it, which reads as a button that failed rather than
    // as a row that chose. The flag is what works for a child who cannot
    // read any of the names, so when the words do not all fit, none of them
    // is shown.
    const tight = buttons.slice(0, count).some((button) => {
      const icon = this.iconOf.get(button.box);
      return Boolean(icon?.beside) && this.blockWidth(button) > width - LABEL_GAP;
    });
    // And one type size for the whole row, on the same argument. A wordless
    // button is only an option where a picture says the same thing, which is
    // true of the flags and is not true of a row of sums — so a row whose
    // longest word will not fit is set smaller rather than emptied.
    //
    // It is the six-digit band that asks for this: `557269 + 168594` is
    // twice the width of `5 + 2`, and set at one size the two of them either
    // overflow the panel or waste three quarters of it.
    const shown = buttons.slice(0, count).filter((button) => !this.iconOf.get(button.box)?.beside);
    const longest = Math.max(0, ...shown.map((button) => button.label.width));
    const fits = width - LABEL_GAP * 2;
    const size =
      longest > fits ? Math.max(ROW_SIZE_MIN, Math.floor((ROW_SIZE * fits) / longest)) : ROW_SIZE;
    for (const [i, value] of values.entries()) {
      const button = buttons[i];
      if (!button) continue;
      if (!this.iconOf.get(button.box)?.beside) button.label.setFontSize(size);
      const line = Math.floor(i / perLine);
      const at = i % perLine;
      // Each line is centred rather than left-aligned, so an odd count over
      // two lines does not leave the last button hanging off one side.
      const onThisLine = Math.min(perLine, count - line * perLine);
      const span = onThisLine * width + BUTTON_GAP * (onThisLine - 1);
      const left = rect.left + PAD + (room - span) / 2;
      const x = left + (width + BUTTON_GAP) * at + width / 2;
      const middle = y + line * (BUTTON_H + BUTTON_GAP) + BUTTON_H / 2;
      this.place(button, x, middle, width, BUTTON_H, tight);
      button.box.setStrokeStyle(2, value === chosen ? CHOSEN_HEX : INK_HEX);
      this.show(button);
    }
    return y + lines * BUTTON_H + (lines - 1) * BUTTON_GAP;
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

  /** Buttons too narrow to hold their word beside their picture. */
  private readonly wordless = new Set<Phaser.GameObjects.Rectangle>();

  private readonly iconOf = new Map<
    Phaser.GameObjects.Rectangle,
    { image: Phaser.GameObjects.Image; width: number; beside: boolean }
  >();

  /** How wide a picture-and-word button wants to be. */
  private blockWidth(choice: Choice): number {
    const icon = this.iconOf.get(choice.box);
    return icon ? icon.width + LABEL_GAP + choice.label.width : choice.label.width;
  }

  private place(
    choice: Choice,
    x: number,
    y: number,
    width: number,
    height: number,
    wordless = false,
  ): void {
    choice.box.setSize(width, height).setPosition(x, y);
    const icon = this.iconOf.get(choice.box);
    if (!icon?.beside) {
      choice.label.setPosition(x, y);
      icon?.image.setPosition(x, y);
      return;
    }
    if (wordless) {
      this.wordless.add(choice.box);
      icon.image.setPosition(x, y);
      return;
    }
    this.wordless.delete(choice.box);
    // Picture and word together, centred as one block rather than each in
    // the middle of the button — two things both centred are two things on
    // top of each other.
    const left = x - this.blockWidth(choice) / 2;
    icon.image.setPosition(left + icon.width / 2, y);
    choice.label.setPosition(left + icon.width + LABEL_GAP + choice.label.width / 2, y);
  }

  private show(choice: Choice): void {
    choice.box.setVisible(true);
    // Except a word `place` has just decided there is no room for. `render`
    // hides every part before laying anything out, so this cannot simply
    // read the label's own visibility — it would be false for all of them.
    choice.label.setVisible(!this.wordless.has(choice.box));
    this.iconOf.get(choice.box)?.image.setVisible(true);
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
