// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import Phaser from "phaser";
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
import { flagIcon, uiTextureKey } from "../ui/assets";
import { HEADER, tileGrid } from "../ui/playersLayout";
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
import { devOptions } from "./devHooks";

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
const SUMS_HEIGHT = 32;
const LANGUAGE_HEIGHT = 30;
/** Between a flag and the name of the language it stands for. */
const FLAG_GAP = 8;
const BUTTON_HEIGHT = 34;
/** Air under the last row, so nothing sits against the bottom edge. */
const FOOTER_ROOM = 64;

type Mode = "list" | "make" | "remove";

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

  private parts: Phaser.GameObjects.GameObject[] = [];
  private nameBox: HTMLInputElement | null = null;

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

    this.profiles = byRecency(readProfiles(this.store));

    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.render());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());

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
    const { width, height } = this.scale;
    this.own(this.add.rectangle(0, 0, width, height, GROUND).setOrigin(0, 0).setDepth(-1));
    if (this.mode === "make") this.renderMaking();
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

    if (this.profiles.length > 0) {
      this.button(
        this.mode === "remove" ? this.words.neverMind : this.words.deletePlayer,
        width / 2,
        height - 32,
        () => {
          this.mode = this.mode === "remove" ? "list" : "remove";
          this.render();
        },
        this.mode === "remove" ? TILE_EDGE : DANGER,
      );
    }

    if (this.removing) this.renderConfirm(this.removing);
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
    const words = this.own(
      this.text(this.words.deleteAreYouSure(profile.name), LABEL_SIZE, INK)
        .setOrigin(0.5)
        .setDepth(52)
        .setPosition(width / 2, height / 2 - 34),
    ) as Phaser.GameObjects.Text;
    words.setWordWrapWidth(box.width - 32);
    words.setPosition(width / 2, height / 2 - 30);

    this.button(
      this.words.deleteYes,
      width / 2 - 84,
      height / 2 + 48,
      () => this.remove(profile),
      DANGER,
      52,
    );
    this.button(
      this.words.deleteNo,
      width / 2 + 84,
      height / 2 + 48,
      () => {
        this.removing = null;
        this.render();
      },
      TILE_EDGE,
      52,
    );
  }

  private renderMaking(): void {
    const { width, height } = this.scale;
    const middle = width / 2;
    let y = this.heading(this.words.makePlayerTitle);

    // Everything below is laid out from the top down against the space that
    // is actually there. The preview is the one thing that can give ground —
    // a phone held upright has room for the swatches or for a big character,
    // and the swatches are what the child came here to press.
    const rows =
      AVATAR_COLOURS.length * (SWATCH + ROW_GAP) +
      (BODY_CELL + ROW_GAP) +
      (SUMS_HEIGHT + ROW_GAP) +
      (LANGUAGE_HEIGHT + ROW_GAP) +
      BUTTON_HEIGHT;
    const room = height - y - NAME_HEIGHT - rows - FOOTER_ROOM;
    const tall = this.bodySheet(this.draft.body)?.frame_height ?? 48;
    const scale = Math.max(1, Math.min(3, Math.floor(room / tall)));

    y += tall * scale;
    this.portrait(this.draft, middle, y, 0, scale);
    y += 12;
    this.showNameBox(middle, y);
    y += NAME_HEIGHT;

    for (const colour of AVATAR_COLOURS) {
      this.swatchRow(colour, middle, y);
      y += SWATCH + ROW_GAP;
    }
    this.bodyRow(middle, y);
    y += BODY_CELL + ROW_GAP;

    // Four sums rather than four ages or the words "easy" and "hard". A
    // parent can pick by looking and so can a child, and nobody is told they
    // are on the gentle one — which matters on a screen where a sibling's
    // tile sits beside theirs.
    this.sumsRow(middle, y);
    y += SUMS_HEIGHT + ROW_GAP;

    // Language sits with the avatar because it is the same kind of choice —
    // something about this child rather than about the device — and because
    // asking a German-reading child to find it in an options panel written
    // in English is asking them to read English first.
    this.languageRow(middle, y);
    y += LANGUAGE_HEIGHT + ROW_GAP;

    // Directly under the last thing chosen, not pinned to the bottom of the
    // screen. Pinned, it sat a hand's width below the language row on a
    // desktop window with a band of empty ground between them, so the button
    // that finishes the form did not look like part of the form.
    const footer = y + BUTTON_HEIGHT / 2;
    // Alone in the middle when it is the only button there. It used to sit
    // off to the right whether or not anything sat beside it, which nobody
    // saw while it was pinned to the bottom of the screen and everybody sees
    // now that it is the last thing in the form.
    const pair = this.profiles.length > 0;
    this.button(this.words.startPlaying, pair ? middle + 74 : middle, footer, () =>
      this.finishMaking(),
    );
    if (pair) {
      this.button(
        this.words.neverMind,
        middle - 74,
        footer,
        () => {
          this.mode = "list";
          this.hideNameBox();
          this.render();
        },
        TILE_EDGE,
      );
    }
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

  private sumsRow(centreX: number, y: number): void {
    this.own(
      this.text(this.words.sumsHeading, LABEL_SIZE, INK_DIM)
        .setOrigin(0.5, 1)
        .setPosition(centreX, y - 4),
    );
    const cell = 100;
    const span = BANDS.length * cell + (BANDS.length - 1) * SWATCH_GAP;
    BANDS.forEach((band, index) => {
      const x = centreX - span / 2 + index * (cell + SWATCH_GAP);
      const chosen = this.draftBand === index;
      const face = this.own(
        this.add
          .rectangle(x, y, cell, SUMS_HEIGHT, TILE_FACE)
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
      const sample = sampleProblem(band, (seed, rung) =>
        makeAdditionProblem(createRng(seed), rung),
      );
      this.own(
        this.text(`${sample.start} + ${sample.addend}`, LABEL_SIZE, chosen ? INK : INK_DIM)
          .setOrigin(0.5)
          .setPosition(x + cell / 2, y + SUMS_HEIGHT / 2),
      );
    });
  }

  private languageRow(centreX: number, y: number): void {
    // Wider than it was, because there is a flag in it now: ninety-six left
    // the flag and the longer of the two names a pixel short of touching.
    const cell = 124;
    const span = LANGUAGES.length * cell + (LANGUAGES.length - 1) * SWATCH_GAP;
    LANGUAGES.forEach((language, index) => {
      const x = centreX - span / 2 + index * (cell + SWATCH_GAP);
      const chosen = this.draftLanguage === language;
      const face = this.own(
        this.add
          .rectangle(x, y, cell, LANGUAGE_HEIGHT, TILE_FACE)
          .setOrigin(0, 0)
          .setStrokeStyle(chosen ? 3 : 1, chosen ? TILE_HOT : TILE_EDGE)
          .setInteractive({ useHandCursor: true }),
      ) as Phaser.GameObjects.Rectangle;
      face.on("pointerdown", () => {
        this.draftLanguage = language;
        this.words = phrasesFor(language);
        this.render();
      });
      // Flag and name together, centred as one block rather than each in the
      // middle of the tile — two things both centred are two things on top of
      // each other.
      //
      // The flag is for the child who cannot read either name, which on this
      // screen is more of them than anywhere else: it is where the language
      // is still whatever the last person to play chose, so a German-reading
      // child meets it in English.
      const label = this.own(
        this.text(LANGUAGE_NAMES[language], LABEL_SIZE, chosen ? INK : INK_DIM).setOrigin(0.5),
      ) as Phaser.GameObjects.Text;
      const flag = this.own(
        this.add
          .image(0, 0, uiTextureKey(flagIcon(language)))
          .setOrigin(0.5)
          .setAlpha(chosen ? 1 : 0.55),
      ) as Phaser.GameObjects.Image;
      const middle = y + LANGUAGE_HEIGHT / 2;
      const block = flag.width + FLAG_GAP + label.width;
      const left = x + cell / 2 - block / 2;
      flag.setPosition(left + flag.width / 2, middle);
      label.setPosition(left + flag.width + FLAG_GAP + label.width / 2, middle);
    });
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
      document.body.appendChild(box);
      this.nameBox = box;
      box.focus();
    }
    this.nameBox.placeholder = this.words.namePrompt;
    const boxWidth = 220;
    this.nameBox.style.width = `${boxWidth}px`;
    this.nameBox.style.left = `${bounds.left + centreX - boxWidth / 2 - 10}px`;
    this.nameBox.style.top = `${bounds.top + y}px`;
  }

  private hideNameBox(): void {
    this.nameBox?.remove();
    this.nameBox = null;
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
    this.mode = "make";
    this.removing = null;
    this.draftName = "";
    this.draftBand = SUGGESTED_BAND;
    this.draft = this.catalogue
      ? suggestedAvatar(this.catalogue, this.profiles.length)
      : DEFAULT_AVATAR;
    this.render();
  }

  private finishMaking(): void {
    if (!isUsableName(this.draftName)) {
      // Nothing scolds. The box is simply where the game is waiting, and a
      // child who taps "that's me" with an empty name gets the keyboard back
      // rather than a sentence telling them what they did wrong.
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
    writeSettings(this.store, { language: playing.language });
    this.hideNameBox();
    this.scene.start("game", { profile: playing });
  }

  private teardown(): void {
    this.hideNameBox();
    this.scale.off(Phaser.Scale.Events.RESIZE);
  }

  // --- small helpers ---------------------------------------------------------

  /**
   * The game's name, then the question. Returns where the next thing may go.
   *
   * The name goes above rather than below: it is the smaller of the two and
   * the question is what the child is being asked, so putting the question
   * first ran a dim line straight through a bright one.
   */
  private heading(words: string): number {
    const middle = this.scale.width / 2;
    this.own(this.text(GAME_NAME, LABEL_SIZE, INK_DIM).setOrigin(0.5, 0).setPosition(middle, 10));
    this.own(
      this.text(words, TITLE_SIZE, INK)
        .setOrigin(0.5, 0)
        .setPosition(middle, 10 + LABEL_SIZE + 8),
    );
    return 10 + LABEL_SIZE + 8 + TITLE_SIZE + 12;
  }

  private button(
    label: string,
    x: number,
    y: number,
    onTap: () => void,
    edge = TILE_HOT,
    depth = 0,
  ): void {
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
  }

  private text(value: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.add.text(0, 0, value, {
      fontFamily: "monospace",
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
