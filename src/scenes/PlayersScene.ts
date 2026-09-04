// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import Phaser from "phaser";
import { sound } from "../audio/sound";
import {
  AVATAR_COLOURS,
  type AvatarCatalogue,
  type AvatarColour,
  type AvatarStyle,
  DEFAULT_AVATAR,
  suggestedAvatar,
  tonesFor,
  usableAvatar,
  withTone,
} from "../avatar/style";
import { avatarCatalogue, avatarTexture } from "../avatar/texture";
import { phrasesFor } from "../i18n";
import type { Phrases } from "../i18n/phrases";
import type { Backup } from "../save/backup";
import { ImportResult, canTakeBackup, readBackupFile, takeBackup } from "../save/backupFile";
import {
  MAX_PROFILES,
  type Profile,
  byRecency,
  canAddProfile,
  createProfile,
  isUsableName,
  tidyName,
} from "../save/profiles";
import { deleteProfile, readProfiles, saveProfile } from "../save/store";
import {
  LANGUAGES,
  LANGUAGE_NAMES,
  type Language,
  browserStore,
  readSettings,
  settingsWithOverrides,
  writeSettings,
} from "../settings";
import { makeAdditionProblem } from "../spells/addition";
import { BANDS, DEFAULT_BAND, SUGGESTED_BAND, sampleProblem } from "../spells/difficulty";
import { GAME_NAME } from "../ui/TitleCard";
import { UiAsset, flagIcon, uiTextureKey } from "../ui/assets";
import { FACE } from "../ui/parchment";
import {
  HEADER,
  MAKING_STEPS,
  type MakingStep,
  boxTopWithin,
  stepFrom,
  tileGrid,
} from "../ui/playersLayout";
import {
  ALL_CHARACTERS,
  DEFAULT_FACING,
  IDLE,
  characterAnimKey,
  characterSheetKey,
  characterSidecarKey,
} from "../world/characters";
import { createRng } from "../world/rng";
import type { CharacterSidecar, SheetLayout } from "../world/spriteSidecar";
import { devOptions, exposeMakingForTests, forgetMakingForTests } from "./devHooks";

/**
 * Who is playing.
 *
 * Between the loading and the game, every time, on purpose. The obvious
 * shortcut — one player on the device, so go straight in — was rejected: a
 * child seeing their own name and their own face before they start is a
 * small ritual worth two seconds, and the second child on a tablet should
 * never have to be shown where the switcher lives.
 *
 * There are no locks and no passwords. This is a shared family device and
 * the failure mode of a forgotten code is a child locked out of a farm they
 * spent a week on, which is far worse than a sibling opening the wrong game
 * and closing it again. Deleting is the one thing that asks twice.
 *
 * The name box is a real HTML input rather than something drawn here. A
 * child typing their own name needs their tablet's own keyboard, with its
 * own autocorrect and its own accented characters, and reimplementing that
 * on a canvas would be worse in every way that matters.
 */

const GROUND = 0x12100f;
const INK = "#f6e8c4";
const INK_DIM = "#a8916a";
const TILE_FACE = 0x241f1a;
const TILE_EDGE = 0x6a5334;
const TILE_HOT = 0xc8901c;
const DANGER = 0x8a2f24;

const TITLE_SIZE = 26;
const NAME_SIZE = 14;
const LABEL_SIZE = 13;
const BUTTON_SIZE = 15;
const SWATCH = 30;
const SWATCH_GAP = 8;
/** Room for a row's label above it and a little air below. */
const ROW_GAP = 26;
const BODY_CELL = 46;
const NAME_HEIGHT = 62;
/**
 * Air under the character, before the first row of swatches.
 *
 * Twelve, until the name box moved off the bottom of the portrait and up
 * under the heading: the box was the clearance, and without it the word
 * "Skin" sat on the character's feet.
 */
const PORTRAIT_GAP = 24;
/** The shortest a sum's box may get, whatever the screen leaves for it. */
const SUMS_HEIGHT = 32;
/** Air either side of a full-width row, so nothing touches the screen edge. */
const ROW_MARGIN = 12;
const BUTTON_HEIGHT = 34;
/** Air under the last row, so nothing sits against the bottom edge. */
const FOOTER_ROOM = 64;
/**
 * Between two pictures standing side by side on a notice, in *their* pixels.
 *
 * Four rather than a comfortable-looking ten, because the middle panel is a
 * tablet, a cross and a world and has to fit three of them across a phone.
 */
const PICTURE_GAP = 4;
/**
 * The size the notices are written at.
 *
 * Between the title and the labels. They are sentences a grown-up reads
 * once, so they do not want a title's weight — but small print is exactly
 * what a parent skips, and the one about backups is the one sentence in
 * this game that costs a year of somebody's farm if it is skipped.
 */
const NOTICE_SIZE = 18;
/**
 * And the biggest a sign may be drawn.
 *
 * A ceiling as well as the room's share, because the room's share is a
 * fraction of a screen and a screen can be very tall: a phone in landscape
 * and a desktop browser at full height are the same panel with five times
 * the space between the words and the buttons.
 */
const PICTURE_SCALE_MAX = 5;

/**
 * Which screen is up.
 *
 * Making a player is three of these rather than one form, in the order a
 * child can actually answer them: the language first, because everything
 * after it is written in whatever they pick; then who they are; then how
 * big their sums are. It used to be one page with all of it stacked down
 * it, which fitted on a tablet and did not fit on a phone — and worse than
 * the fitting, it asked a child to read an English form in order to find
 * the button that would stop it being in English.
 */
type Mode = "list" | MakingStep | "remove";

export class PlayersScene extends Phaser.Scene {
  private words!: Phrases;
  private store = browserStore();
  private profiles: readonly Profile[] = [];
  private catalogue: AvatarCatalogue | null = null;

  private mode: Mode = "list";
  private draft: AvatarStyle = DEFAULT_AVATAR;
  private draftName = "";
  private draftLanguage: Language = "en";
  private draftBand = SUGGESTED_BAND;
  private removing: Profile | null = null;
  /**
   * A backup that has been read off a file and is waiting to be agreed to.
   *
   * Read first and asked about second, so that a file which turns out not
   * to be one of ours is refused *before* anybody has been asked to agree
   * to their tablet being emptied.
   */
  private offering: Backup | null = null;
  /** What went wrong with the last file, until the screen is touched again. */
  private importTrouble = "";

  private parts: Phaser.GameObjects.GameObject[] = [];
  private nameBox: HTMLInputElement | null = null;
  /** Where the layout wanted the box, before any keyboard had an opinion. */
  private nameBoxTop = 0;
  /** The listener that follows the visible band, while there is a box. */
  private followBand: (() => void) | null = null;
  private importBox: HTMLInputElement | null = null;

  constructor() {
    super("players");
  }

  create(): void {
    // The same parser the game scene uses, not a second one reading the same
    // parameters: two readers of `?lang=` drift apart the first time one is
    // renamed, and the one that drifts is the one nobody has a test for.
    const dev = devOptions();
    const settings = settingsWithOverrides(readSettings(this.store, navigator.language), {
      language: dev.language,
    });
    this.words = phrasesFor(settings.language);
    this.draftLanguage = settings.language;
    this.catalogue = avatarCatalogue(this);

    // Whether the game makes any sound. The device's choice, not this child's —
    // it is read here because this screen runs before anybody has been
    // chosen, which is the same reason the device remembers a language.
    //
    // The gesture that lets the audio *start* is caught in `main.ts`, on the
    // window rather than through Phaser: a Phaser input handler runs a frame
    // later than the touch that caused it, and WebKit only counts a gesture
    // inside its own call stack. See `listenForTheFirstTouch`.
    sound().setEnabled(settings.sound);

    this.profiles = byRecency(readProfiles(this.store));

    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.render());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
    // Which of these screens is up, for a scenario that has to drive them.
    // Nothing here has a name a script can tap, so without this one it is
    // reduced to clicking at a fraction of the viewport and hoping.
    exposeMakingForTests({ step: () => this.mode });

    // Scripts have no thumbs. `?skipTitle` already means "do not wait at the
    // title card"; it means the same thing here, because a script that got
    // past the card only to stop dead at a grid of faces has had the same
    // wait moved one screen later.
    if (dev.skipTitle) {
      this.play(this.profiles[0] ?? this.mintScriptPlayer());
      return;
    }

    // A device with nobody on it has nothing to choose between, so it opens
    // on the one thing there is to do.
    if (this.profiles.length === 0) this.beginMaking();
    else this.render();
  }

  /**
   * How one body's sheet is cut, from the sidecar.
   *
   * The whole layout rather than a frame size: the recoloured copy carries
   * the shipped sheet's padding, and slicing it without that draws a sliver
   * of the neighbouring frame into every one.
   */
  private bodySheet(body: string): SheetLayout | null {
    const sidecar = this.cache.json.get(characterSidecarKey(body)) as CharacterSidecar | undefined;
    return sidecar?.sheet ?? null;
  }

  // --- drawing ---------------------------------------------------------------

  private render(): void {
    for (const part of this.parts) part.destroy();
    this.parts = [];
    // Put away on every pass and put back by whichever screen wants it, the
    // same as the name box: a real element over the canvas outlives the
    // picture under it unless something takes it down.
    this.hideImportBox();
    const { width, height } = this.scale;
    this.own(this.add.rectangle(0, 0, width, height, GROUND).setOrigin(0, 0).setDepth(-1));
    if (this.mode === "tongue") this.renderTongue();
    else if (this.mode === "parents")
      this.renderNotice(this.words.parentsNotice, [UiAsset.SignParents]);
    else if (this.mode === "offline")
      this.renderNotice(this.words.offlineNotice, [
        UiAsset.SignDevice,
        UiAsset.MarkNo,
        UiAsset.SignGlobe,
      ]);
    else if (this.mode === "backup")
      this.renderNotice(this.words.backupNotice, [UiAsset.SignBackup]);
    else if (this.mode === "who") this.renderWho();
    else if (this.mode === "sums") this.renderSums();
    else this.renderList();
  }

  private renderList(): void {
    const { width, height } = this.scale;
    this.heading(this.mode === "remove" ? this.words.deletePlayer : this.words.playersTitle);

    // No "+" while removing: a screen where one tile makes a player and the
    // next one destroys one is a screen a child taps wrong exactly once.
    const offerNew = this.mode !== "remove" && canAddProfile(this.profiles);
    const count = this.profiles.length + (offerNew ? 1 : 0);
    const grid = tileGrid(width, height, count);

    this.profiles.forEach((profile, index) => {
      const at = grid.at(index);
      this.playerTile(profile, at.x, at.y, grid.tile);
    });

    if (offerNew) {
      const at = grid.at(this.profiles.length);
      this.newTile(at.x, at.y, grid.tile);
    } else if (this.mode !== "remove" && !canAddProfile(this.profiles)) {
      this.own(
        this.text(this.words.deviceFull(MAX_PROFILES), LABEL_SIZE, INK_DIM)
          .setOrigin(0.5, 0)
          .setPosition(width / 2, HEADER - 24),
      );
    }

    // Two things at the foot, and which two depends on what is on the
    // device. Removing a player needs a player to remove; restoring a
    // backup is *most* wanted on a tablet with nothing on it at all, which
    // is the one state where the other button is not there.
    const removes = this.profiles.length > 0;
    const middle = width / 2;
    if (removes) {
      this.button(
        this.mode === "remove" ? this.words.neverMind : this.words.deletePlayer,
        this.mode === "remove" ? middle : middle - 92,
        height - 32,
        () => {
          this.mode = this.mode === "remove" ? "list" : "remove";
          this.render();
        },
        this.mode === "remove" ? TILE_EDGE : DANGER,
      );
    }
    // Not while removing: that screen is one question, and a second button
    // beside it that empties the whole tablet is the worst possible thing
    // to put next to a row of faces somebody is deleting from.
    if (this.mode !== "remove" && canTakeBackup()) {
      const over = this.button(
        this.words.importSaves,
        removes ? middle + 92 : middle,
        height - 32,
        () => {},
      );
      // Not while a question is up: the input is a real element over the
      // canvas and would sit on top of the dark screen catching taps meant
      // for yes and no.
      if (!this.removing && !this.offering) this.showImportBox(over);
    }
    if (this.importTrouble) {
      this.own(
        this.text(this.importTrouble, LABEL_SIZE, INK_DIM)
          .setOrigin(0.5, 1)
          .setPosition(middle, height - 58),
      );
    }

    if (this.removing) this.renderConfirm(this.removing);
    else if (this.offering) {
      this.renderAsking(this.words.importAreYouSure, this.words.importYes, () => this.takeItOn());
    }
  }

  /**
   * A file has been chosen: read it, and only then ask whether to use it.
   *
   * Nothing is touched until both have happened, and that order is the
   * whole of it. A parent who agrees to their tablet being emptied and is
   * then told the file was no good has been asked to authorise something
   * that never happened; asked the other way round, a bad file costs them a
   * line of text and nothing else.
   */
  private offerFile(file: File): void {
    void readBackupFile(file).then(({ result, backup }) => {
      if (result === ImportResult.NotASave) {
        this.importTrouble = this.words.importNotASave;
        this.render();
        return;
      }
      if (result !== ImportResult.Done || !backup) return;
      this.importTrouble = "";
      this.offering = backup;
      this.render();
    });
  }

  /**
   * Put it on, and become that device.
   *
   * Read back rather than reloaded. Nothing else is running yet — this
   * screen is in front of the game, not over it — so the whole of "the
   * device is now the one in the file" is this scene's own two facts: who
   * plays here, and in what language. A reload would do the same thing and
   * would also throw away a title card somebody has already tapped past.
   */
  private takeItOn(): void {
    const backup = this.offering;
    this.offering = null;
    if (!backup || !takeBackup(backup)) {
      this.importTrouble = this.words.importNotASave;
      this.render();
      return;
    }
    const settings = readSettings(this.store, navigator.language);
    this.words = phrasesFor(settings.language);
    this.draftLanguage = settings.language;
    this.profiles = byRecency(readProfiles(this.store));
    // Back to the faces whichever screen this was asked from. Restoring on
    // the flags — which is where a new tablet starts — has just put
    // somebody on the device, and leaving a parent on step one of making
    // *another* child would be the game ignoring what it had just done.
    this.mode = "list";
    this.importTrouble = "";
    this.render();
  }

  private playerTile(profile: Profile, x: number, y: number, size: number): void {
    const face = this.own(
      this.add
        .rectangle(x, y, size, size, TILE_FACE)
        .setOrigin(0, 0)
        .setStrokeStyle(2, this.mode === "remove" ? DANGER : TILE_EDGE)
        .setInteractive({ useHandCursor: true }),
    ) as Phaser.GameObjects.Rectangle;
    face.on("pointerover", () => face.setStrokeStyle(2, TILE_HOT));
    face.on("pointerout", () =>
      face.setStrokeStyle(2, this.mode === "remove" ? DANGER : TILE_EDGE),
    );
    face.on("pointerdown", () => {
      if (this.mode === "remove") {
        this.removing = profile;
        this.render();
      } else {
        this.play(profile);
      }
    });

    this.portrait(profile.avatar, x + size / 2, y + size * 0.62, size);
    this.own(
      this.text(profile.name, NAME_SIZE, INK)
        .setOrigin(0.5, 1)
        .setPosition(x + size / 2, y + size - 8),
    );
  }

  private newTile(x: number, y: number, size: number): void {
    const face = this.own(
      this.add
        .rectangle(x, y, size, size, TILE_FACE)
        .setOrigin(0, 0)
        .setStrokeStyle(2, TILE_EDGE)
        .setInteractive({ useHandCursor: true }),
    ) as Phaser.GameObjects.Rectangle;
    face.on("pointerover", () => face.setStrokeStyle(2, TILE_HOT));
    face.on("pointerout", () => face.setStrokeStyle(2, TILE_EDGE));
    face.on("pointerdown", () => this.beginMaking());
    this.own(
      this.text("+", Math.round(size * 0.4), INK_DIM)
        .setOrigin(0.5)
        .setPosition(x + size / 2, y + size * 0.42),
    );
    this.own(
      this.text(this.words.newPlayer, NAME_SIZE, INK_DIM)
        .setOrigin(0.5, 1)
        .setPosition(x + size / 2, y + size - 8),
    );
  }

  private renderConfirm(profile: Profile): void {
    this.renderAsking(this.words.deleteAreYouSure(profile.name), this.words.deleteYes, () =>
      this.remove(profile),
    );
  }

  /**
   * The one shape both of this screen's dangerous questions are asked in.
   *
   * Removing a child and restoring a backup are the same interaction — a
   * dark screen, a sentence naming what goes, and a red button against a
   * plain one — and they were the same code copied twice for about an hour.
   * A parent who has learned what this box looks like once should not have
   * to read the second one as though it were new.
   */
  private renderAsking(words: string, yes: string, act: () => void): void {
    const { width, height } = this.scale;
    this.own(
      this.add
        .rectangle(0, 0, width, height, 0x000000, 0.72)
        .setOrigin(0, 0)
        .setDepth(50)
        .setInteractive(),
    );
    const box = this.own(
      this.add
        .rectangle(width / 2, height / 2, Math.min(420, width - 40), 190, TILE_FACE)
        .setStrokeStyle(2, DANGER)
        .setDepth(51),
    ) as Phaser.GameObjects.Rectangle;
    const said = this.own(
      this.text(words, LABEL_SIZE, INK)
        .setOrigin(0.5)
        .setDepth(52)
        .setPosition(width / 2, height / 2 - 34),
    ) as Phaser.GameObjects.Text;
    said.setWordWrapWidth(box.width - 32);
    said.setPosition(width / 2, height / 2 - 30);

    this.button(yes, width / 2 - 84, height / 2 + 48, act, DANGER, 52);
    this.button(
      this.words.deleteNo,
      width / 2 + 84,
      height / 2 + 48,
      () => {
        this.removing = null;
        this.offering = null;
        this.render();
      },
      TILE_EDGE,
      52,
    );
  }

  // --- making a player, in three steps ---------------------------------------

  /**
   * Step one: which language.
   *
   * Flags, big, and the name of each language written the way that language
   * writes it — "Deutsch", not "German". This is the one screen in the game
   * that cannot assume its reader can read it: it opens in whatever the last
   * person to play chose, so a German-reading child meets it in English or
   * in Croatian, and a row of words would be a row of words they have to get
   * past before they can ask for their own.
   *
   * It is first for the same reason. Everything after this — the name box's
   * prompt, the swatch headings, the sums — is written in what is picked
   * here, so picking it here means nothing later has to be guessed at.
   */
  private renderTongue(): void {
    const { width, height } = this.scale;
    const top = this.heading(this.words.tongueTitle);
    // The same fitting the faces use: as many across as the width allows at
    // a size a finger can hit, and taller rows rather than smaller tiles on
    // a narrow screen.
    const grid = tileGrid(width, height - top + HEADER, LANGUAGES.length);
    LANGUAGES.forEach((language, index) => {
      const at = grid.at(index);
      this.tongueTile(language, at.x, at.y + top - HEADER, grid.tile);
    });
    this.stepButtons(
      this.words.nextStep,
      () => this.step(1),
      () => this.step(-1),
    );
  }

  /** One flag, its own name under it, and the whole tile is the target. */
  private tongueTile(language: Language, x: number, y: number, size: number): void {
    const chosen = this.draftLanguage === language;
    const face = this.own(
      this.add
        .rectangle(x, y, size, size, TILE_FACE)
        .setOrigin(0, 0)
        .setStrokeStyle(chosen ? 3 : 1, chosen ? TILE_HOT : TILE_EDGE)
        .setInteractive({ useHandCursor: true }),
    ) as Phaser.GameObjects.Rectangle;
    face.on("pointerdown", () => {
      this.draftLanguage = language;
      // Re-titled on the spot, in the language just chosen. The fastest way
      // to show a tap did something is for the words above it to change.
      this.words = phrasesFor(language);
      this.render();
    });

    const flag = this.own(
      this.add
        .image(x + size / 2, y + size / 2 - LABEL_SIZE, uiTextureKey(flagIcon(language)))
        .setOrigin(0.5)
        .setAlpha(chosen ? 1 : 0.6),
    ) as Phaser.GameObjects.Image;
    // Grown to the tile rather than drawn at its shipped size, and by a
    // whole number so the pixels stay square.
    const room = size - LABEL_SIZE * 2 - 20;
    flag.setScale(Math.max(1, Math.floor(room / Math.max(flag.width, flag.height))));
    this.own(
      this.text(LANGUAGE_NAMES[language], LABEL_SIZE, chosen ? INK : INK_DIM)
        .setOrigin(0.5, 1)
        .setPosition(x + size / 2, y + size - 10),
    );
  }

  /**
   * The three panels a parent is walked through, all drawn by one routine.
   *
   * Words above pictures, which is the way round it has to be: the panel is
   * a *sentence*, and the picture is what makes somebody stop long enough
   * to read it. Reversed — picture first — the third panel becomes a nice
   * drawing of a filing tray with some type under it, and the sentence
   * about losing everything is the part that gets tapped past.
   *
   * One routine and a list of pictures rather than three renderers, because
   * the three panels differ in exactly two things and a shared one is what
   * keeps them looking like a set. The middle panel's list is three: a
   * tablet, the cross the whole game already uses for *no*, and the world.
   * That reads as "no internet" to somebody who cannot read the sentence
   * above it, which is most of why the pictures are there.
   */
  private renderNotice(words: string, pictures: readonly string[]): void {
    const { width, height } = this.scale;
    const top = this.notice(words);
    const room = height - top - FOOTER_ROOM;
    // Well short of the room there is. Grown to fill it, a single sign came
    // out nine times its own size on a tablet — a picture that fills the
    // screen and a sentence above it in small type, which is the wrong way
    // round for a panel whose whole job is the sentence.
    // The pictures get the full width; the words above them get a narrower
    // measure. Given the same room, three pictures on a phone came out at
    // twice their size where they had space for three times it, and a
    // sentence at that width is a sentence read by sliding your eye.
    this.pictureRow(pictures, width / 2, top + room / 2, width - ROW_MARGIN * 2, room * 0.6);
    this.stepButtons(
      this.words.nextStep,
      () => this.step(1),
      () => this.step(-1),
    );
  }

  /**
   * A row of pictures, centred, all grown by the same whole number.
   *
   * The same number for all of them: they are drawn at the sizes they mean
   * to be seen at relative to one another — the cross between the tablet
   * and the world is a third of their height because it is an operator
   * between two things rather than a third thing — and scaling each to fit
   * its own share would throw exactly that away.
   */
  private pictureRow(
    assets: readonly string[],
    centreX: number,
    middleY: number,
    room: number,
    tall: number,
  ): void {
    const images = assets.map(
      (asset) =>
        this.own(
          this.add.image(0, 0, uiTextureKey(asset)).setOrigin(0.5),
        ) as Phaser.GameObjects.Image,
    );
    const widest = images.reduce((sum, image) => sum + image.width, 0);
    const highest = Math.max(...images.map((image) => image.height));
    // The gap is in the pictures' own pixels and grows with them. Fixed in
    // screen pixels it is a third of the row on a phone and a hairline on a
    // tablet, which is the one measurement here that has to stay in
    // proportion to what it separates.
    const wide = widest + PICTURE_GAP * Math.max(0, images.length - 1);
    // Whole numbers only. This is pixel art, and a sign drawn at two and a
    // half has some rows twice as tall as others.
    const scale = Math.max(
      1,
      Math.min(
        PICTURE_SCALE_MAX,
        Math.floor(Math.min(room / Math.max(1, wide), tall / Math.max(1, highest))),
      ),
    );
    let x = centreX - (wide * scale) / 2;
    for (const image of images) {
      image.setScale(scale);
      image.setPosition(x + (image.width * scale) / 2, middleY);
      x += (image.width + PICTURE_GAP) * scale;
    }
  }

  /**
   * The game's name, and then a sentence rather than a title.
   *
   * Its own thing beside `heading`, which shrinks a title until it fits on
   * one line — right for one word over a row of flags, and wrong for two
   * sentences about backups, which would come out at the size of the small
   * print it is trying not to be. This wraps instead and keeps the size.
   */
  private notice(words: string): number {
    const { width } = this.scale;
    const middle = width / 2;
    this.own(this.text(GAME_NAME, LABEL_SIZE, INK_DIM).setOrigin(0.5, 0).setPosition(middle, 10));
    const top = 10 + LABEL_SIZE + 8;
    const room = width - ROW_MARGIN * 4;
    const said = this.own(
      this.text(words, NOTICE_SIZE, INK).setOrigin(0.5, 0).setPosition(middle, top),
    ) as Phaser.GameObjects.Text;
    said.setWordWrapWidth(room, true);
    said.setAlign("center");
    // Re-centred after wrapping: the origin is applied to the box, and the
    // box only knows how tall it is once the words have been broken.
    said.setPosition(middle, top);
    return top + said.height + 16;
  }

  /**
   * Step two: who are you.
   *
   * The name box, the portrait and the colours — everything that is about
   * this child rather than about their arithmetic. The preview is the one
   * thing that gives ground when the screen is short: a phone held upright
   * has room for the swatches or for a big character, and the swatches are
   * what the child came here to press.
   */
  private renderWho(): void {
    const { width, height } = this.scale;
    const middle = width / 2;
    let y = this.heading(this.words.makePlayerTitle);

    // The name box first, directly under the heading, and that placement is
    // load-bearing rather than a matter of taste.
    //
    // It is the one HTML input in this game, and on an iPad the software
    // keyboard takes about half the screen. Under the portrait it sat in the
    // half the keyboard covers — so Safari scrolled the page up to reveal it
    // and took the whole game with it, off the top of the screen and with no
    // way to scroll back. `index.html` stops the scrolling; this stops there
    // being anything to scroll *for*.
    //
    // It reads better this way round too, which is the part that would have
    // been an argument on its own: a form asks who you are and then what you
    // look like.
    this.showNameBox(middle, y);
    y += NAME_HEIGHT;

    const rows = AVATAR_COLOURS.length * (SWATCH + ROW_GAP) + (BODY_CELL + ROW_GAP) + BUTTON_HEIGHT;
    const room = height - y - rows - PORTRAIT_GAP - FOOTER_ROOM;
    const tall = this.bodySheet(this.draft.body)?.frame_height ?? 48;
    const scale = Math.max(1, Math.min(3, Math.floor(room / tall)));

    y += tall * scale;
    this.portrait(this.draft, middle, y, 0, scale);
    y += PORTRAIT_GAP;

    for (const colour of AVATAR_COLOURS) {
      this.swatchRow(colour, middle, y);
      y += SWATCH + ROW_GAP;
    }
    this.bodyRow(middle, y);

    this.stepButtons(
      this.words.nextStep,
      () => {
        if (!isUsableName(this.draftName)) {
          // Nothing scolds. The box is simply where the game is waiting,
          // and a child who taps on with an empty name gets the keyboard
          // back rather than a sentence telling them what they did wrong.
          this.nameBox?.focus();
          return;
        }
        this.step(1);
      },
      () => this.step(-1),
    );
  }

  /**
   * Step three: how big the sums are.
   *
   * Sums rather than ages or the words "easy" and "hard". A parent can pick
   * by looking and so can a child, and nobody is told they are on the gentle
   * one — which matters on a screen whose result sits beside a sibling's
   * tile for the rest of the game.
   */
  private renderSums(): void {
    const { width, height } = this.scale;
    const middle = width / 2;
    const top = this.heading(this.words.sumsTitle);
    const footer = height - FOOTER_ROOM;
    this.sumsColumn(middle, top, footer - top);
    this.stepButtons(
      this.words.startPlaying,
      () => this.finishMaking(),
      () => this.step(-1),
    );
  }

  private swatchRow(colour: AvatarColour, centreX: number, y: number): void {
    const heading =
      colour === "skin"
        ? this.words.skinHeading
        : colour === "hair"
          ? this.words.hairHeading
          : this.words.shirtHeading;
    this.own(
      this.text(heading, LABEL_SIZE, INK_DIM)
        .setOrigin(0.5, 1)
        .setPosition(centreX, y - 4),
    );
    const tones = this.catalogue ? tonesFor(this.catalogue, colour) : [];
    const span = tones.length * SWATCH + (tones.length - 1) * SWATCH_GAP;
    tones.forEach((tone, index) => {
      const x = centreX - span / 2 + index * (SWATCH + SWATCH_GAP);
      const chosen = this.draft[colour] === index;
      const swatch = this.own(
        this.add
          .rectangle(x, y, SWATCH, SWATCH, rgbInt(tone[0]))
          .setOrigin(0, 0)
          .setStrokeStyle(chosen ? 3 : 1, chosen ? TILE_HOT : TILE_EDGE)
          .setInteractive({ useHandCursor: true }),
      ) as Phaser.GameObjects.Rectangle;
      swatch.on("pointerdown", () => {
        this.draft = withTone(this.draft, colour, index);
        this.render();
      });
    });
  }

  private bodyRow(centreX: number, y: number): void {
    this.own(
      this.text(this.words.bodyHeading, LABEL_SIZE, INK_DIM)
        .setOrigin(0.5, 1)
        .setPosition(centreX, y - 4),
    );
    const bodies = this.catalogue?.bodies ?? [DEFAULT_AVATAR.body];
    const cell = BODY_CELL;
    const span = bodies.length * cell + (bodies.length - 1) * SWATCH_GAP;
    bodies.forEach((body, index) => {
      const x = centreX - span / 2 + index * (cell + SWATCH_GAP);
      const chosen = this.draft.body === body;
      const face = this.own(
        this.add
          .rectangle(x, y, cell, cell, TILE_FACE)
          .setOrigin(0, 0)
          .setStrokeStyle(chosen ? 3 : 1, chosen ? TILE_HOT : TILE_EDGE)
          .setInteractive({ useHandCursor: true }),
      ) as Phaser.GameObjects.Rectangle;
      face.on("pointerdown", () => {
        this.draft = { ...this.draft, body };
        this.render();
      });
      this.portrait({ ...this.draft, body }, x + cell / 2, y + cell - 4, cell);
    });
  }

  /**
   * The four sums, filling what the step gives them.
   *
   * A column rather than a row now that the choice has a screen to itself:
   * four boxes side by side had to be a hundred pixels each to hold
   * `347 + 265`, which is four hundred pixels of width a phone held upright
   * does not have. Stacked, every one of them is as wide as the screen and
   * as tall as a finger.
   */
  private sumsColumn(centreX: number, top: number, room: number): void {
    const cell = Math.max(
      SUMS_HEIGHT,
      Math.min(64, (room - SWATCH_GAP * BANDS.length) / BANDS.length),
    );
    const width = Math.min(320, this.scale.width - ROW_MARGIN * 2);
    const span = BANDS.length * cell + (BANDS.length - 1) * SWATCH_GAP;
    const first = top + Math.max(0, (room - span) / 2);
    BANDS.forEach((band, index) => {
      const y = first + index * (cell + SWATCH_GAP);
      const chosen = this.draftBand === index;
      const face = this.own(
        this.add
          .rectangle(centreX - width / 2, y, width, cell, TILE_FACE)
          .setOrigin(0, 0)
          .setStrokeStyle(chosen ? 3 : 1, chosen ? TILE_HOT : TILE_EDGE)
          .setInteractive({ useHandCursor: true }),
      ) as Phaser.GameObjects.Rectangle;
      face.on("pointerdown", () => {
        this.draftBand = index;
        this.render();
      });
      // Built by the spell, never typed out: a sample written by hand is one
      // that can quietly stop matching what that band actually sets, which is
      // the whole basis on which somebody is choosing.
      const sample = sampleProblem(
        band,
        (seed, rung) => makeAdditionProblem(createRng(seed), rung),
        BANDS[index - 1],
      );
      this.own(
        this.text(`${sample.start} + ${sample.addend}`, TITLE_SIZE - 6, chosen ? INK : INK_DIM)
          .setOrigin(0.5)
          .setPosition(centreX, y + cell / 2),
      );
    });
  }

  // --- moving between the steps ----------------------------------------------

  /**
   * Forward or back one step.
   *
   * Back off the front of the three is back to the faces, which is what
   * "never mind" used to be — and it is only ever offered when there are
   * faces to go back to. On a device with nobody on it, the first step is
   * where the game starts and there is nothing behind it.
   *
   * The name box goes on every move without exception. It is a real HTML
   * input positioned over the canvas rather than something drawn here, so
   * nothing about changing what the canvas shows removes it: left behind,
   * it floats over the flags with the child's half-typed name in it.
   */
  private step(by: number): void {
    if (this.mode === "list" || this.mode === "remove") return;
    this.hideNameBox();
    // Off the front is back to the faces, which is what "never mind" used to
    // be. Off the back cannot happen: the last step's button finishes rather
    // than steps.
    this.mode = stepFrom(this.mode, by) ?? "list";
    this.render();
  }

  /**
   * The pair at the foot of every step: on, and back.
   *
   * One place rather than three, and pinned to the foot of the screen on all
   * three. The single form these came from put its buttons directly under
   * the last row instead, on the argument that a button a hand's width below
   * the thing it finishes does not look like part of it — which was right
   * about that form and is wrong about these. Three steps make a *sequence*,
   * and a "next" that moves up and down the screen between them is a "next"
   * a child has to find again every time.
   */
  private stepButtons(onward: string, go: () => void, back: () => void): void {
    const { width, height } = this.scale;
    const middle = width / 2;
    const y = height - 32;
    // Nothing behind the first step on a device with nobody on it, so it is
    // the only screen here that shows one button and centres it.
    const first = this.mode === MAKING_STEPS[0];
    const alone = first && this.profiles.length === 0;
    if (!alone) {
      this.button(onward, middle + 74, y, go);
      this.button(this.words.neverMind, middle - 74, y, back, TILE_EDGE);
      return;
    }
    // **And restoring a backup lives here too, not only on the faces.**
    //
    // A tablet with nobody on it never shows the faces at all: with no
    // child to pick there is nothing to pick from, so the game opens
    // straight onto the flags. Which means the one device that most needs
    // to be told "you can put your old game back" — a new one, or one being
    // set up after the old one was lost — is exactly the device that could
    // not be told, when this button was only on the screen behind.
    //
    // So on that screen the question is a pair: make somebody new, or bring
    // a game back. The space is there — it is where "back" would be, and
    // there is nothing behind this screen to go back to.
    if (!canTakeBackup()) {
      this.button(onward, middle, y, go);
      return;
    }
    this.button(onward, middle + 92, y, go);
    const over = this.button(this.words.importSaves, middle - 92, y, () => {}, TILE_EDGE);
    if (!this.offering) this.showImportBox(over);
    if (this.importTrouble) {
      this.own(
        this.text(this.importTrouble, LABEL_SIZE, INK_DIM)
          .setOrigin(0.5, 1)
          .setPosition(middle, y - 26),
      );
    }
    if (this.offering) {
      this.renderAsking(this.words.importAreYouSure, this.words.importYes, () => this.takeItOn());
    }
  }

  /**
   * One character, standing still and facing the player.
   *
   * Recoloured on the spot, which is cheap enough to do while a child taps
   * through swatches: a texture per look is built once and kept, so going
   * back to a colour already tried costs a map lookup.
   */
  private portrait(
    style: AvatarStyle,
    x: number,
    bottom: number,
    box: number,
    fixedScale = 0,
  ): void {
    const usable = this.catalogue ? usableAvatar(this.catalogue, style) : style;
    const sheet = this.bodySheet(usable.body);
    if (!sheet) return;
    const character = avatarTexture(this, this.catalogue, usable, sheet);
    if (!this.textures.exists(characterSheetKey(character))) return;
    this.ensureAnims(character, usable.body);
    // Whole-number scales only: this is pixel art, and a face drawn at one
    // and a half is a face with some rows twice as tall as others. The 34 is
    // the name underneath, which the character must not stand on.
    const scale = fixedScale || Math.max(1, Math.floor((box - 34) / sheet.frame_height));
    const sprite = this.own(
      this.add.sprite(x, bottom, characterSheetKey(character)).setOrigin(0.5, 1).setScale(scale),
    ) as Phaser.GameObjects.Sprite;
    sprite.play(characterAnimKey(character, IDLE, DEFAULT_FACING));
  }

  private ensureAnims(character: string, body: string): void {
    const sidecar = this.cache.json.get(characterSidecarKey(body)) as CharacterSidecar | undefined;
    if (!sidecar) return;
    for (const [name, range] of Object.entries(sidecar.animations)) {
      const [animation, facing] = name.split("_");
      if (animation !== IDLE || !facing) continue;
      const key = characterAnimKey(character, animation, facing as never);
      if (this.anims.exists(key)) continue;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(characterSheetKey(character), {
          start: range.start,
          end: range.end,
        }),
        frameRate: 4,
        repeat: -1,
      });
    }
  }

  // --- the name box ----------------------------------------------------------

  private showNameBox(centreX: number, y: number): void {
    const canvas = this.game.canvas;
    const bounds = canvas.getBoundingClientRect();
    const fresh = !this.nameBox;
    if (!this.nameBox) {
      const box = document.createElement("input");
      box.type = "text";
      box.maxLength = 24;
      box.autocapitalize = "words";
      box.spellcheck = false;
      box.placeholder = this.words.namePrompt;
      box.value = this.draftName;
      box.style.position = "fixed";
      box.style.zIndex = "40";
      box.style.font = "16px monospace";
      box.style.textAlign = "center";
      box.style.color = INK;
      box.style.background = "#241f1a";
      box.style.border = "2px solid #6a5334";
      box.style.borderRadius = "4px";
      box.style.padding = "6px 8px";
      box.addEventListener("input", () => {
        this.draftName = box.value;
      });
      box.addEventListener("keydown", (event) => {
        if (event.key === "Enter") this.finishMaking();
      });
      // And put the page back if the browser moves it anyway.
      //
      // `index.html` pins the body so that iOS has no layout scrolling to
      // do, which is the fix; this is the belt to its braces, because the
      // failure it guards against is the game disappearing off the top of an
      // iPad and there is no way to test the real thing from here. Costs two
      // listeners and a number comparison.
      box.addEventListener("focus", () => this.pinPage());
      box.addEventListener("blur", () => this.pinPage());
      // The keyboard coming up, going down, and the page being scrolled
      // under it are three separate events and all three move the band.
      // Listened for once and taken off again with the box: a listener that
      // outlived the input would be reaching for an element that is gone.
      this.followBand = () => this.placeNameBox();
      window.visualViewport?.addEventListener("resize", this.followBand);
      window.visualViewport?.addEventListener("scroll", this.followBand);
      document.body.appendChild(box);
      this.nameBox = box;
    }
    this.nameBox.placeholder = this.words.namePrompt;
    const boxWidth = 220;
    this.nameBox.style.width = `${boxWidth}px`;
    this.nameBox.style.left = `${bounds.left + centreX - boxWidth / 2 - 10}px`;
    // Kept, because the keyboard can come and go many times over one name
    // and every one of those needs this number again.
    this.nameBoxTop = bounds.top + y;
    this.placeNameBox();
    // Focused last, and that is the whole of the second iPad report.
    //
    // A `position: fixed` box with no `top` yet sits at its *static*
    // position, and this one is appended to a body whose only child is a
    // canvas exactly one screen tall — so until the two lines above have run
    // it is standing on the bottom edge of the screen, out of sight.
    // Focusing it there is what set the phone off: a browser raises the
    // keyboard for whatever has focus and scrolls to reveal it, there is
    // nothing below the fold to scroll to, and so the page went up as far as
    // it could and took the heading with it — and then the box was moved to
    // where it belongs, which by that point was above what was still
    // visible. The heading gone and the box gone, from the order of two
    // lines.
    //
    // Only on the way in. A child stepping back to the colours and forward
    // again keeps the box they already have, and re-focusing it there would
    // call the keyboard up over a screen they did not ask it for.
    if (fresh) this.nameBox.focus();
  }

  /**
   * Put the box where the visible page actually is.
   *
   * Called on every change to `window.visualViewport`, which is what a
   * software keyboard moves — the layout viewport, which is what
   * `position: fixed` is anchored to, does not budge. See `boxTopWithin` for
   * what that costs and why this follows the band instead.
   */
  private placeNameBox(): void {
    const box = this.nameBox;
    if (!box) return;
    const band = window.visualViewport;
    box.style.top = `${boxTopWithin(
      { offsetTop: band?.offsetTop ?? 0, height: band?.height ?? window.innerHeight },
      this.nameBoxTop,
      box.getBoundingClientRect().height || NAME_HEIGHT,
    )}px`;
  }

  /**
   * A real file input, laid exactly over the button that says restore.
   *
   * **Not a Phaser button that opens a picker.** That was the first
   * version, and it does nothing at all: a browser will only open a file
   * picker while a user's tap is still live, and Phaser reads its input
   * during the game's own frame rather than in the DOM event — so by the
   * time the handler runs, the tap is over as far as the browser is
   * concerned and the picker is silently refused. Nothing is logged that
   * anybody would go looking for.
   *
   * So the tap has to land on the input itself. It is invisible and sits on
   * top of the drawn button, which is the same trick the name box already
   * plays one screen along — a real HTML control over the canvas, moved to
   * wherever the canvas has drawn its picture of it.
   */
  private showImportBox(over: Phaser.GameObjects.Rectangle): void {
    const bounds = this.game.canvas.getBoundingClientRect();
    if (!this.importBox) {
      const box = document.createElement("input");
      box.type = "file";
      // Named rather than left to `*/*`: on a tablet this is the difference
      // between a folder of documents and a photo library.
      box.accept = "application/json,.json";
      box.style.position = "fixed";
      box.style.zIndex = "40";
      // Invisible, and still a target. `display: none` and `visibility:
      // hidden` both stop it taking the tap; zero opacity does not.
      box.style.opacity = "0";
      box.style.cursor = "pointer";
      box.addEventListener("change", () => {
        const file = box.files?.[0];
        box.value = "";
        if (file) this.offerFile(file);
      });
      document.body.appendChild(box);
      this.importBox = box;
    }
    this.importBox.style.left = `${bounds.left + over.x - over.width / 2}px`;
    this.importBox.style.top = `${bounds.top + over.y - over.height / 2}px`;
    this.importBox.style.width = `${over.width}px`;
    this.importBox.style.height = `${over.height}px`;
  }

  private hideImportBox(): void {
    this.importBox?.remove();
    this.importBox = null;
  }

  private hideNameBox(): void {
    if (this.followBand) {
      window.visualViewport?.removeEventListener("resize", this.followBand);
      window.visualViewport?.removeEventListener("scroll", this.followBand);
      this.followBand = null;
    }
    this.nameBox?.remove();
    this.nameBox = null;
    // A stranded offset outlives the input that caused it, so the page is
    // put back on the way out as well as on the way in.
    this.pinPage();
  }

  /**
   * Undo a scroll the browser did on its own.
   *
   * There is nothing on this page to scroll to — the canvas is exactly the
   * size of the viewport — so any offset at all is the browser having moved
   * the page to reveal a focused input, and every pixel of it is the game
   * gone off the top of the screen.
   */
  private pinPage(): void {
    if (typeof window === "undefined") return;
    const scrolled = window.scrollY !== 0 || window.scrollX !== 0;
    if (scrolled) window.scrollTo(0, 0);
    const root = document.scrollingElement;
    if (root && root.scrollTop !== 0) root.scrollTop = 0;
  }

  // --- doing things ----------------------------------------------------------

  /**
   * A player for a script that asked to skip this screen and found nobody.
   *
   * Saved like any other, deliberately: a test that plants a field and
   * reloads has to find the same child and the same world, and a player that
   * existed only in memory would give it a fresh one every time.
   */
  private mintScriptPlayer(): Profile {
    const made = createProfile(
      this.profiles,
      {
        name: "Player",
        avatar: this.catalogue ? suggestedAvatar(this.catalogue, 0) : DEFAULT_AVATAR,
        language: this.draftLanguage,
        band: DEFAULT_BAND,
      },
      Date.now(),
    );
    this.profiles = saveProfile(this.store, made);
    return made;
  }

  private beginMaking(): void {
    // At the front of the three. The language is asked first because
    // everything after it is written in the answer.
    this.mode = "tongue";
    this.removing = null;
    this.draftName = "";
    this.draftBand = SUGGESTED_BAND;
    this.draft = this.catalogue
      ? suggestedAvatar(this.catalogue, this.profiles.length)
      : DEFAULT_AVATAR;
    this.render();
  }

  private finishMaking(): void {
    // The name is gated on the way out of the step that asks for it, not
    // here — a child sent back two screens to fill in a box would have to
    // find out for themselves which box. This stays as the last word on it
    // because nothing else guarantees the step was walked through rather
    // than jumped over.
    if (!isUsableName(this.draftName)) {
      this.mode = "who";
      this.render();
      this.nameBox?.focus();
      return;
    }
    if (!canAddProfile(this.profiles)) {
      this.mode = "list";
      this.render();
      return;
    }
    const profile = createProfile(
      this.profiles,
      {
        name: tidyName(this.draftName),
        avatar: this.catalogue ? usableAvatar(this.catalogue, this.draft) : this.draft,
        language: this.draftLanguage,
        band: this.draftBand,
      },
      Date.now(),
    );
    this.profiles = saveProfile(this.store, profile);
    this.play(profile);
  }

  private remove(profile: Profile): void {
    this.profiles = byRecency(deleteProfile(this.store, profile.id));
    this.removing = null;
    if (this.profiles.length === 0) this.beginMaking();
    else {
      this.mode = "list";
      this.render();
    }
  }

  private play(profile: Profile): void {
    const playing = { ...profile, lastPlayed: Date.now() };
    saveProfile(this.store, playing);
    // The device follows whoever played last, so the next morning's
    // who's-playing screen is written in the language of this house rather
    // than of this browser.
    // Spread rather than built fresh: this is a write of the *whole* device
    // settings file, and a field left out of it is a field deleted. It said
    // `{ language }` while language was the only one, and the day a second
    // arrived that line would have quietly switched the music back on every
    // time a child started playing.
    writeSettings(this.store, { ...readSettings(this.store), language: playing.language });
    this.hideNameBox();
    this.scene.start("game", { profile: playing });
  }

  private teardown(): void {
    this.hideNameBox();
    this.hideImportBox();
    this.scale.off(Phaser.Scale.Events.RESIZE);
    // Taken down with the scene, so a scenario cannot read a step off a
    // screen that is no longer there and conclude the game never started.
    forgetMakingForTests();
  }

  // --- small helpers ---------------------------------------------------------

  /**
   * The game's name, then the question. Returns where the next thing may go.
   *
   * The name goes above rather than below: it is the smaller of the two and
   * the question is what the child is being asked, so putting the question
   * first ran a dim line straight through a bright one.
   */
  /**
   * The game's name, and what this screen is asking.
   *
   * The title shrinks to whatever the screen has. It used to be set at one
   * size and centred, which held for as long as every title was two short
   * words — and stopped the moment one of them was a question with a German
   * translation, which ran off both edges of a phone with its first and last
   * letters missing. Shrinking rather than wrapping keeps the heading one
   * line tall, which is what everything below it is measured from.
   */
  private heading(words: string): number {
    const middle = this.scale.width / 2;
    this.own(this.text(GAME_NAME, LABEL_SIZE, INK_DIM).setOrigin(0.5, 0).setPosition(middle, 10));
    const title = this.own(
      this.text(words, TITLE_SIZE, INK)
        .setOrigin(0.5, 0)
        .setPosition(middle, 10 + LABEL_SIZE + 8),
    ) as Phaser.GameObjects.Text;
    const room = this.scale.width - ROW_MARGIN * 2;
    if (title.width > room) {
      const smaller = Math.max(LABEL_SIZE, Math.floor((TITLE_SIZE * room) / title.width));
      title.setFontSize(smaller);
      title.setPosition(middle, 10 + LABEL_SIZE + 8 + (TITLE_SIZE - smaller) / 2);
    }
    return 10 + LABEL_SIZE + 8 + TITLE_SIZE + 12;
  }

  private button(
    label: string,
    x: number,
    y: number,
    onTap: () => void,
    edge = TILE_HOT,
    depth = 0,
  ): Phaser.GameObjects.Rectangle {
    const text = this.text(label, BUTTON_SIZE, INK)
      .setOrigin(0.5)
      .setDepth(depth + 1);
    // Sized to its words rather than to a number typed here: "Das bin ich"
    // and "That's me" are not the same width, and a box that fits one crops
    // the other.
    const box = this.own(
      this.add
        .rectangle(x, y, text.width + 28, BUTTON_HEIGHT, TILE_FACE)
        .setStrokeStyle(2, edge)
        .setDepth(depth)
        .setInteractive({ useHandCursor: true }),
    ) as Phaser.GameObjects.Rectangle;
    text.setPosition(x, y);
    this.own(text);
    box.on("pointerdown", onTap);
    return box;
  }

  private text(value: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.add.text(0, 0, value, {
      fontFamily: FACE,
      fontSize: `${size}px`,
      color,
      align: "center",
    });
  }

  private own<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.parts.push(object);
    return object;
  }
}

function rgbInt(rgb: readonly number[]): number {
  return ((rgb[0] ?? 0) << 16) | ((rgb[1] ?? 0) << 8) | (rgb[2] ?? 0);
}
