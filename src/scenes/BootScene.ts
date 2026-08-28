// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import Phaser from "phaser";
import { AVATAR_CATALOGUE_KEY } from "../avatar/texture";
import { phrasesFor } from "../i18n";
import { DEFAULT_SETTINGS, browserStore, readSettings, settingsWithOverrides } from "../settings";
import { TitleCard } from "../ui/TitleCard";
import { UI_ASSETS, UI_SIDECAR_KEY, type UiIndex, uiEntry, uiTextureKey } from "../ui/assets";
import { barFraction } from "../ui/loadingBar";
import { ANIMAL_KINDS, animalSheetKey, animalSidecarKey } from "../world/animals";
import { BUILDING_SPRITES, type BuildingSprite, spriteSheetKey } from "../world/buildings";
import { ALL_CHARACTERS, characterSheetKey, characterSidecarKey } from "../world/characters";
import { CLIFF_ATLAS_KEY } from "../world/cliffAtlas";
import { DECK_SHEET_KEY, DECK_SIDECAR_KEY, type DeckSidecar } from "../world/decking";
import { EFFECT_TYPES, effectSheetKey, effectSidecarKey } from "../world/effects";
import { FIXTURE_TYPES, fixtureSheetKey, fixtureSidecarKey } from "../world/fixtures";
import { FLOWER_TYPES, flowerSheetKey, flowerSidecarKey } from "../world/flowers";
import { WALL_MASKS } from "../world/growableRoom";
import {
  GROWABLE_ROOM,
  INTERIOR_ROOMS,
  growablePieceKey,
  growableSheetKey,
  growableSidecarKey,
  interiorSheetKey,
  interiorSidecarKey,
} from "../world/interiors";
import { LANDMARK_TYPES, landmarkSheetKey, landmarkSidecarKey } from "../world/landmarks";
import { PLANT_TYPES, plantSheetKey, plantSidecarKey } from "../world/plants";
import { SCENERY_KINDS, scenerySheetKey, scenerySidecarKey } from "../world/scenery";
import { SKY_THINGS, skySheetKey, skySidecarKey } from "../world/skyline";
import type {
  BuildingSidecar,
  CharacterSidecar,
  EffectSidecar,
  FixtureSidecar,
  GrowableSidecar,
  InteriorSidecar,
  ObjectSidecar,
  PlantSidecar,
  SheetLayout,
} from "../world/spriteSidecar";
import { spriteSheetConfig } from "../world/spriteSidecar";
import { TERRAIN_ATLAS_KEY } from "../world/terrainAtlas";
import { devOptions } from "./devHooks";

export function sidecarKey(sprite: BuildingSprite): string {
  return `sidecar-${sprite}`;
}

// Loading happens in two passes, because a spritesheet's frame size is not
// something this repo knows: it lives in the sidecar the asset generator
// ships next to the sheet. Pass one fetches the sidecars, pass two uses them
// to slice the sheets. The alternative — hardcoding frame sizes here — is
// exactly the kind of silent cross-repo contract that breaks the next time
// a building grows a taller roof.
export class BootScene extends Phaser.Scene {
  private card?: TitleCard;
  /** The book the card is written in, kept so the loader can talk too. */
  private words = phrasesFor(DEFAULT_SETTINGS.language);
  /** The key of the last thing to arrive, for the line under the bar. */
  private lastFile = "";
  /**
   * How much of the bar the first pass is worth.
   *
   * Phaser's loader reports progress per batch and this scene runs two of
   * them, so one `progress` handler would fill the bar, empty it and fill it
   * again. The first pass is thirty small sidecars and nothing else — the
   * terrain atlas is deliberately loaded with the sheets — so it is over in
   * moments and owns a sixth of the bar; everything with any weight to it is
   * in the second pass, where there is room to watch it arrive.
   */
  private static readonly SIDECAR_SHARE = 0.15;

  constructor() {
    super("boot");
  }

  private base(): string {
    return import.meta.env.BASE_URL;
  }

  preload(): void {
    // The same language the game will start in, ?lang= and all: a title card
    // that greeted a German player in English and then handed over to a
    // German game would be the one screen that had not been told.
    const dev = devOptions();
    const settings = settingsWithOverrides(readSettings(browserStore(), navigator.language), {
      language: dev.language,
    });
    this.words = phrasesFor(settings.language);
    this.card = new TitleCard(this, this.words);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.relayout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.relayout, this);
      this.card?.destroy();
      this.card = undefined;
    });
    // Six at a time, not Phaser's default of thirty-two. On a slow link the
    // default has every file in flight at once, so the bar sits at nothing
    // for the whole download and then fills in a fifth of a second — the
    // pipe is the same width either way, but a queue that finishes files one
    // after another is a queue a bar can report on.
    this.load.maxParallelDownloads = 6;
    this.watchTheLoader();
    this.trackProgress(0, BootScene.SIDECAR_SHARE);

    for (const sprite of BUILDING_SPRITES) {
      this.load.json(sidecarKey(sprite), `${this.base()}assets/buildings/${sprite}.json`);
    }
    for (const character of ALL_CHARACTERS) {
      this.load.json(
        characterSidecarKey(character),
        `${this.base()}assets/characters/${character}.json`,
      );
    }
    for (const kind of ANIMAL_KINDS) {
      this.load.json(animalSidecarKey(kind), `${this.base()}assets/animals/${kind}.json`);
    }
    for (const room of INTERIOR_ROOMS) {
      this.load.json(interiorSidecarKey(room), `${this.base()}assets/interiors/${room}.json`);
    }
    // The cottage a second time, as the parts a room that grows is built
    // from. See growableRoom.ts — a room somebody can add a square to cannot
    // be one picture, because the wall it grows through has to come down.
    this.load.json(
      growableSidecarKey(GROWABLE_ROOM),
      `${this.base()}assets/interiors/${GROWABLE_ROOM}_growable.json`,
    );
    for (const plant of PLANT_TYPES) {
      this.load.json(plantSidecarKey(plant), `${this.base()}assets/plants/${plant}.json`);
    }
    for (const fixture of FIXTURE_TYPES) {
      this.load.json(fixtureSidecarKey(fixture), `${this.base()}assets/fixtures/${fixture}.json`);
    }
    // Beside the fixtures, because that is the folder the generator draws
    // them into — and not among them, because a flower is not a fixture:
    // nothing buys one, nothing carries one in a crate, and they are the
    // only art in there that comes in five colours.
    for (const flower of FLOWER_TYPES) {
      this.load.json(flowerSidecarKey(flower), `${this.base()}assets/fixtures/${flower}.json`);
    }
    for (const landmark of LANDMARK_TYPES) {
      this.load.json(
        landmarkSidecarKey(landmark),
        `${this.base()}assets/landmarks/${landmark}.json`,
      );
    }
    // The skyline: drawn by the generator's landmark module, shipped under
    // its own name because it is not one. See `src/world/skyline.ts`.
    for (const thing of SKY_THINGS) {
      this.load.json(skySidecarKey(thing), `${this.base()}assets/skyline/${thing}.json`);
    }
    for (const kind of SCENERY_KINDS) {
      this.load.json(scenerySidecarKey(kind), `${this.base()}assets/objects/${kind}.json`);
    }
    this.load.json(DECK_SIDECAR_KEY, `${this.base()}assets/decking/deck.json`);
    for (const effect of EFFECT_TYPES) {
      this.load.json(effectSidecarKey(effect), `${this.base()}assets/effects/${effect}.json`);
    }
    // One index for the whole interface set rather than one per file — the
    // generator writes it that way because a panel has no frames to describe.
    this.load.json(UI_SIDECAR_KEY, `${this.base()}assets/ui/ui.json`);
    // Which bodies a child may pick and the exact colours the sheets were
    // drawn to be recoloured with. Shipped beside the art rather than typed
    // into the game, because a tone that exists in one and not the other is
    // a swatch that paints on somebody else's skin.
    this.load.json(AVATAR_CATALOGUE_KEY, `${this.base()}assets/characters/avatar.json`);
  }

  create(): void {
    this.trackProgress(BootScene.SIDECAR_SHARE, 1 - BootScene.SIDECAR_SHARE);
    // Every terrain tile the world can need, including every 3- and
    // 4-terrain corner cell: ~5300 of them, over two pages since the village
    // square was paved. A multiatlas is one request either way. The second
    // argument is the directory the atlas's own page filenames resolve
    // against.
    //
    // Loaded here with the sheets rather than with the sidecars, though it
    // needs neither: it is far the biggest thing this game fetches, and the
    // first pass is worth a sixth of the loading bar. Downloading two
    // megabytes under a bar that cannot move is the definition of a bar not
    // worth having.
    this.load.multiatlas(
      TERRAIN_ATLAS_KEY,
      `${this.base()}assets/terrain/terrain.json`,
      `${this.base()}assets/terrain`,
    );
    // The steps between the world's levels. A second atlas rather than more
    // frames in the first: a cliff is not a terrain, it is a step between
    // two of them, and folding these in would multiply the terrain atlas by
    // every rock and every ramp for the benefit of the few tiles that have a
    // step in them.
    this.load.multiatlas(
      CLIFF_ATLAS_KEY,
      `${this.base()}assets/cliffs/cliffs.json`,
      `${this.base()}assets/cliffs`,
    );
    for (const sprite of BUILDING_SPRITES) {
      const sidecar = this.cache.json.get(sidecarKey(sprite)) as BuildingSidecar | undefined;
      this.queueSheet(spriteSheetKey(sprite), "buildings", sprite, sidecar?.sheet);
    }
    for (const character of ALL_CHARACTERS) {
      const sidecar = this.cache.json.get(characterSidecarKey(character)) as
        | CharacterSidecar
        | undefined;
      this.queueSheet(characterSheetKey(character), "characters", character, sidecar?.sheet);
    }
    for (const kind of ANIMAL_KINDS) {
      const sidecar = this.cache.json.get(animalSidecarKey(kind)) as CharacterSidecar | undefined;
      this.queueSheet(animalSheetKey(kind), "animals", kind, sidecar?.sheet);
    }
    for (const room of INTERIOR_ROOMS) {
      const sidecar = this.cache.json.get(interiorSidecarKey(room)) as InteriorSidecar | undefined;
      this.queueSheet(interiorSheetKey(room), "interiors", room, sidecar?.sheet);
    }
    const grown = this.cache.json.get(growableSidecarKey(GROWABLE_ROOM)) as
      | GrowableSidecar
      | undefined;
    for (const name of Object.keys(grown?.sheets ?? {})) {
      this.queueSheet(
        growableSheetKey(GROWABLE_ROOM, name),
        "interiors",
        name,
        grown?.sheets[name],
      );
    }
    for (const piece of Object.keys(grown?.piece_sheets ?? {})) {
      this.queueSheet(
        growablePieceKey(GROWABLE_ROOM, piece),
        "interiors",
        piece,
        grown?.piece_sheets[piece],
      );
    }
    for (const plant of PLANT_TYPES) {
      const sidecar = this.cache.json.get(plantSidecarKey(plant)) as PlantSidecar | undefined;
      this.queueSheet(plantSheetKey(plant), "plants", plant, sidecar?.sheet);
    }
    for (const fixture of FIXTURE_TYPES) {
      const sidecar = this.cache.json.get(fixtureSidecarKey(fixture)) as FixtureSidecar | undefined;
      this.queueSheet(fixtureSheetKey(fixture), "fixtures", fixture, sidecar?.sheet);
    }
    for (const flower of FLOWER_TYPES) {
      const sidecar = this.cache.json.get(flowerSidecarKey(flower)) as FixtureSidecar | undefined;
      this.queueSheet(flowerSheetKey(flower), "fixtures", flower, sidecar?.sheet);
    }
    for (const kind of SCENERY_KINDS) {
      const sidecar = this.cache.json.get(scenerySidecarKey(kind)) as ObjectSidecar | undefined;
      this.queueSheet(scenerySheetKey(kind), "objects", kind, sidecar?.sheet);
    }
    for (const landmark of LANDMARK_TYPES) {
      const sidecar = this.cache.json.get(landmarkSidecarKey(landmark)) as
        | ObjectSidecar
        | undefined;
      this.queueSheet(landmarkSheetKey(landmark), "landmarks", landmark, sidecar?.sheet);
    }
    for (const thing of SKY_THINGS) {
      const sidecar = this.cache.json.get(skySidecarKey(thing)) as ObjectSidecar | undefined;
      this.queueSheet(skySheetKey(thing), "skyline", thing, sidecar?.sheet);
    }
    {
      const sidecar = this.cache.json.get(DECK_SIDECAR_KEY) as DeckSidecar | undefined;
      this.queueSheet(DECK_SHEET_KEY, "decking", "deck", sidecar?.sheet);
    }
    for (const effect of EFFECT_TYPES) {
      const sidecar = this.cache.json.get(effectSidecarKey(effect)) as EffectSidecar | undefined;
      this.queueSheet(effectSheetKey(effect), "effects", effect, sidecar?.sheet);
    }
    // Plain images, not spritesheets: the parchment and the icons are single
    // frames, and the index says how big each one is so nothing here has to.
    const uiIndex = this.cache.json.get(UI_SIDECAR_KEY) as UiIndex | undefined;
    for (const asset of UI_ASSETS) {
      const entry = uiEntry(uiIndex, asset);
      this.load.image(uiTextureKey(asset), `${this.base()}assets/ui/${entry.file}`);
    }
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      // Inside the guard, because both of these throw by design when the art
      // and the code disagree — and a throw here left the card sitting at
      // "loading…" for ever, which is the same symptom as a file that never
      // arrived and an entirely different fault.
      try {
        this.verifyFrameCounts();
        this.verifyUiSizes(uiIndex);
      } catch (wrong) {
        this.card?.setFailure(
          this.words.titleLoadFailed(wrong instanceof Error ? wrong.message : String(wrong)),
        );
        throw wrong;
      }
      this.begin();
    });
    this.load.start();
  }

  /**
   * Point the bar at this pass of the loader.
   *
   * Counted in files, because that is all Phaser will say: it has an event
   * for per-file byte progress and does not fire it for the kinds of file
   * this game loads, which was checked rather than assumed. Files are enough
   * once the downloads are queued a few at a time — see maxParallelDownloads
   * — and the atlas is loaded with the sheets so the long download falls in
   * the pass that owns most of the bar.
   */
  private trackProgress(base: number, span: number): void {
    const loader = this.load;
    let high = base;
    const paint = () => {
      high = barFraction(
        { base, span },
        { complete: loader.totalComplete, total: loader.totalToLoad },
        high,
      );
      this.card?.setProgress(high);
      // What it is doing, under the bar. "loading…" on its own is fine right
      // up until it stops, and then it is the least useful line on the
      // screen: a load stuck at a hundred and twelve of a hundred and
      // fourteen looks exactly like a load that is slow. The count is how
      // many requests are outstanding and the name is the last thing that
      // arrived, and between them they say where it stopped.
      this.card?.setStatus(
        this.words.titleLoadingWhat(loader.totalComplete, loader.totalToLoad, this.lastFile),
      );
    };
    // Off first: this runs once per pass, on the same loader, and a listener
    // left over from the previous pass repaints the bar with the previous
    // pass's arithmetic — which is exactly what it did, flickering between a
    // full bar and a sixth of one.
    loader.off(Phaser.Loader.Events.PROGRESS);
    loader.on(Phaser.Loader.Events.PROGRESS, paint);
  }

  /**
   * Name what arrives, and name what does not.
   *
   * Set up once on the loader rather than per pass, because the question a
   * stuck load raises — *what was it waiting for?* — does not care which
   * pass it stuck in.
   */
  private watchTheLoader(): void {
    const loader = this.load;
    loader.on(Phaser.Loader.Events.FILE_COMPLETE, (key: string) => {
      this.lastFile = key;
    });
    loader.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: { key?: string; url?: string }) => {
      // The URL rather than the key: a key says which texture is missing and
      // a URL says which file to go and look for, and the second is what
      // anybody debugging this from a screenshot actually needs.
      this.card?.setFailure(this.words.titleLoadFailed(file.url ?? file.key ?? "?"));
    });
  }

  /**
   * Hold the title card until the player says go.
   *
   * Any tap and any key, because there is nothing else on this screen to hit
   * and a child should not have to find a button. `?skipTitle` is for the
   * scripts, which have no opinion about titles and every reason to want the
   * world without one.
   */
  private begin(): void {
    if (devOptions().skipTitle) {
      this.scene.start("players");
      return;
    }
    this.card?.ready();
    const go = () => this.scene.start("players");
    this.input.once("pointerdown", go);
    this.input.keyboard?.once("keydown", go);
  }

  private relayout(): void {
    this.card?.layout();
  }

  private queueSheet(
    key: string,
    directory: string,
    name: string,
    sheet: SheetLayout | null | undefined,
  ): void {
    if (!sheet) throw new Error(`${name}.json has no "sheet" — regenerate it with --sheets`);
    this.load.spritesheet(
      key,
      `${this.base()}assets/${directory}/${sheet.file}`,
      spriteSheetConfig(sheet),
    );
  }

  /**
   * Check every sheet sliced into as many frames as its sidecar promised.
   *
   * A character sheet is the only asset here laid out as a 2D grid, and both
   * of its axes are an exact multiple of the frame pitch with no slack. A
   * loader that miscounts a row loses it *silently*: the animations whose
   * frame range falls in the missing row simply have no frames, while every
   * other facing still plays. That surfaces in game as one direction where
   * the character freezes — a long way from the cause. One assertion here
   * turns it into a load-time error naming the sheet.
   */
  private verifyFrameCounts(): void {
    const expected: [string, string, number][] = [];
    for (const sprite of BUILDING_SPRITES) {
      const sidecar = this.cache.json.get(sidecarKey(sprite)) as BuildingSidecar;
      expected.push([sprite, spriteSheetKey(sprite), sidecar.frame_count]);
    }
    for (const character of ALL_CHARACTERS) {
      const sidecar = this.cache.json.get(characterSidecarKey(character)) as CharacterSidecar;
      expected.push([character, characterSheetKey(character), sidecar.frame_count]);
    }
    for (const kind of ANIMAL_KINDS) {
      const sidecar = this.cache.json.get(animalSidecarKey(kind)) as CharacterSidecar;
      expected.push([kind, animalSheetKey(kind), sidecar.frame_count]);
    }
    for (const room of INTERIOR_ROOMS) {
      const sheet = (this.cache.json.get(interiorSidecarKey(room)) as InteriorSidecar).sheet;
      if (sheet) expected.push([room, interiorSheetKey(room), sheet.frame_count]);
    }
    // The growable room's parts, and the wall atlas above all. It is indexed
    // straight by the mask a cell computes — `batchDrawFrame(walls, mask)` —
    // so a strip that sliced into thirty-one frames instead of thirty-two
    // draws the wrong wall for some corners and nothing for others, with
    // nothing anywhere saying why.
    const grown = this.cache.json.get(growableSidecarKey(GROWABLE_ROOM)) as
      | GrowableSidecar
      | undefined;
    for (const [name, sheet] of Object.entries(grown?.sheets ?? {})) {
      expected.push([
        `${GROWABLE_ROOM} ${name}`,
        growableSheetKey(GROWABLE_ROOM, name),
        sheet.frame_count,
      ]);
    }
    for (const [piece, sheet] of Object.entries(grown?.piece_sheets ?? {})) {
      expected.push([
        `${GROWABLE_ROOM} ${piece}`,
        growablePieceKey(GROWABLE_ROOM, piece),
        sheet.frame_count,
      ]);
    }
    // And the atlas has to hold a tile for every mask the game can compute,
    // which is a fact about the *rule* rather than about the file: a sheet
    // sliced correctly into too few frames passes the count check above and
    // still has no tile for the corner somebody is about to build.
    const atlas = grown?.sheets.walls?.frame_count;
    if (atlas !== undefined && atlas < WALL_MASKS) {
      throw new Error(
        `the ${GROWABLE_ROOM} wall atlas has ${atlas} tiles, ` +
          `and a wall can be any of ${WALL_MASKS} shapes`,
      );
    }
    for (const plant of PLANT_TYPES) {
      const sidecar = this.cache.json.get(plantSidecarKey(plant)) as PlantSidecar;
      expected.push([plant, plantSheetKey(plant), sidecar.frame_count]);
    }
    for (const fixture of FIXTURE_TYPES) {
      const sidecar = this.cache.json.get(fixtureSidecarKey(fixture)) as FixtureSidecar;
      expected.push([fixture, fixtureSheetKey(fixture), sidecar.frame_count]);
    }
    for (const flower of FLOWER_TYPES) {
      const sidecar = this.cache.json.get(flowerSidecarKey(flower)) as FixtureSidecar;
      expected.push([flower, flowerSheetKey(flower), sidecar.frame_count]);
    }
    for (const kind of SCENERY_KINDS) {
      const sidecar = this.cache.json.get(scenerySidecarKey(kind)) as ObjectSidecar;
      expected.push([kind, scenerySheetKey(kind), sidecar.frame_count]);
    }
    for (const landmark of LANDMARK_TYPES) {
      const sidecar = this.cache.json.get(landmarkSidecarKey(landmark)) as ObjectSidecar;
      expected.push([landmark, landmarkSheetKey(landmark), sidecar.frame_count]);
    }
    for (const thing of SKY_THINGS) {
      const sidecar = this.cache.json.get(skySidecarKey(thing)) as ObjectSidecar;
      expected.push([thing, skySheetKey(thing), sidecar.frame_count]);
    }
    {
      const sidecar = this.cache.json.get(DECK_SIDECAR_KEY) as DeckSidecar;
      expected.push(["deck", DECK_SHEET_KEY, sidecar.frame_count]);
    }
    for (const effect of EFFECT_TYPES) {
      const sidecar = this.cache.json.get(effectSidecarKey(effect)) as EffectSidecar;
      expected.push([effect, effectSheetKey(effect), sidecar.frame_count]);
    }
    for (const [name, key, count] of expected) {
      // Phaser counts its own __BASE frame alongside the sliced ones.
      const actual = this.textures.get(key).frameTotal - 1;
      if (actual !== count) {
        throw new Error(`${name} sliced into ${actual} frames, sidecar declares ${count}`);
      }
    }
  }

  /**
   * Check the interface art is the size its index claims.
   *
   * The popup positions everything from these numbers — the nine-slice
   * insets especially — and a frame that is not the size the insets were
   * measured against does not fail to draw, it draws subtly wrong: a border
   * with its corner ornament stretched across the whole top edge. Cheaper to
   * catch here, naming the file.
   */
  private verifyUiSizes(index: UiIndex | undefined): void {
    for (const asset of UI_ASSETS) {
      const entry = uiEntry(index, asset);
      const source = this.textures.get(uiTextureKey(asset)).getSourceImage();
      if (source.width !== entry.width || source.height !== entry.height) {
        throw new Error(
          `${entry.file} is ${source.width}x${source.height}, ui.json declares ${entry.width}x${entry.height}`,
        );
      }
      const insets = entry.nine_slice;
      if (
        insets &&
        (insets.left + insets.right > entry.width || insets.top + insets.bottom > entry.height)
      ) {
        throw new Error(`${entry.file}'s nine-slice insets overlap`);
      }
    }
  }
}
