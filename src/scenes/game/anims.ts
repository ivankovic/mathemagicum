// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * Asset metadata: what the renderer needs to know about the art, read from
 * the art itself.
 *
 * Variation counts from the atlas's frame names, footprints and draw
 * offsets from each building's sidecar, and one Phaser animation per range
 * a sidecar names. Nothing about the generator's output is restated as a
 * constant here.
 *
 * Split out of `GameScene` because it is a load-time act with no state of
 * its own: it reads the caches, registers animations on the scene's
 * animation manager, and hands back the sidecars the scene will consult
 * for the rest of the session. Plain functions over the scene rather than
 * a class, since there is nothing to keep between calls — and two of them
 * are called again later, for a repainted house and a recoloured child.
 */

import type Phaser from "phaser";
import { ANIMAL_KINDS, animalSheetKey, animalSidecarKey } from "../../world/animals";
import {
  BUILDING_SPRITES,
  type BuildingSprite,
  buildingRowKey,
  spriteSheetKey,
} from "../../world/buildings";
import {
  ALL_CHARACTERS,
  CHARACTER_ANIMATIONS,
  type Facing,
  IDLE,
  IDLE_FPS,
  ONE_SHOT_ANIMATIONS,
  PLANT,
  PLANT_FPS,
  WALK,
  WALK_FPS,
  characterAnimKey,
  characterSheetKey,
  characterSidecarKey,
} from "../../world/characters";
import { CLIFF_ATLAS_KEY } from "../../world/cliffAtlas";
import { DECK_SIDECAR_KEY, type DeckSidecar } from "../../world/decking";
import { EFFECT_FPS, EFFECT_TYPES, effectSheetKey, effectSidecarKey } from "../../world/effects";
import {
  FIXTURE_TYPES,
  fixtureAnimKey,
  fixtureSheetKey,
  fixtureSidecarKey,
} from "../../world/fixtures";
import {
  FLOWER_LOOKS,
  FLOWER_TYPES,
  type FlowerType,
  flowerAnimKey,
  flowerFrames,
  flowerSheetKey,
  flowerSidecarKey,
} from "../../world/flowers";
import {
  GROWABLE_ROOM,
  INTERIOR_ROOMS,
  growableSidecarKey,
  interiorAnimKey,
  interiorSheetKey,
  interiorSidecarKey,
} from "../../world/interiors";
import {
  LANDMARK_TYPES,
  landmarkAnimKey,
  landmarkSheetKey,
  landmarkSidecarKey,
} from "../../world/landmarks";
import { PLANT_TYPES, plantSheetKey, plantSidecarKey } from "../../world/plants";
import {
  SCENERY_KINDS,
  sceneryAnimKey,
  scenerySheetKey,
  scenerySidecarKey,
} from "../../world/scenery";
import { SKY_THINGS, skyAnimKey, skySheetKey, skySidecarKey } from "../../world/skyline";
import type {
  BuildingSidecar,
  CharacterSidecar,
  EffectSidecar,
  FixtureSidecar,
  GrowableSidecar,
  InteriorSidecar,
  LandmarkSidecar,
  ObjectSidecar,
  PlantSidecar,
} from "../../world/spriteSidecar";
import {
  TERRAIN_ATLAS_KEY,
  type WaterFrames,
  buildVariationIndex,
  waterFrames,
} from "../../world/terrainAtlas";
import { sidecarKey } from "../BootScene";

// Slow idle loop: the 8 frames are drifting chimney smoke, not motion.
export const BUILDING_ANIM_FPS = 6;
// Slow enough to read as a breeze rather than a shiver.
const PLANT_SWAY_FPS = 4;
// The well bucket drifts rather than swings.
const FIXTURE_ANIM_FPS = 5;
// Trees and spires sway slowly, and there are hundreds of them.
const SCENERY_ANIM_FPS = 4;
// Slower still. A crown five people tall does not move at a sapling's rate,
// and the lights in it breathe rather than blink.
/**
 * The sway of the one big thing in a place.
 *
 * Slower than the wood around it — a crown that size does not move at a
 * sapling's rate, and matching them would make the grove read as one
 * animation played at every scale at once.
 *
 * Twice what it was, because the sheets have twice the frames. The cycle
 * stays the length it was — a couple of seconds of sway — and each step is
 * half the size, which is the whole of what "smoother" means here. Leaving
 * this at three would have doubled the cycle instead and given a tree that
 * moves like something underwater.
 */
const LANDMARK_ANIM_FPS = 6;

// How fast each character animation runs. Walk is tied to the step duration,
// idle is a slow breath, and the planting gesture sits between them: six
// frames at 12 is about half a second, long enough to read as deliberate and
// short enough that it never feels like the game stopped listening.
const FPS_FOR_ANIMATION: Record<string, number> = {
  [WALK]: WALK_FPS,
  [IDLE]: IDLE_FPS,
  [PLANT]: PLANT_FPS,
};

/** What the loaded art says about itself, for the scene to keep. */
export interface ArtMetadata {
  readonly terrainVariations: ReadonlyMap<string, number>;
  readonly cliffVariations: ReadonlyMap<string, number>;
  readonly waterFrames: WaterFrames;
  /** How many planks there are to choose between. No animation: wood. */
  readonly deckVariations: number;
  readonly buildingSidecars: Map<BuildingSprite, BuildingSidecar>;
  readonly scenerySidecars: Map<string, ObjectSidecar>;
  readonly landmarkSidecars: Map<string, LandmarkSidecar>;
  readonly flowerSidecars: Map<FlowerType, FixtureSidecar>;
  readonly fixtureSidecars: Map<string, FixtureSidecar>;
  readonly interiorSidecars: Map<string, InteriorSidecar>;
  /**
   * The parts the one growable room is assembled from, if this build
   * shipped them.
   *
   * Null in a world whose assets predate it, which is why every use of it is
   * guarded: a missing sidecar means the cottage falls back to the picture
   * every other room is, rather than the game refusing to open a door.
   */
  readonly growable: GrowableSidecar | null;
}

/** Read every atlas and sidecar the scene draws from, and register every animation they name. */
export function loadAssetMetadata(scene: Phaser.Scene): ArtMetadata {
  const texture = scene.textures.get(TERRAIN_ATLAS_KEY);
  const terrainVariations = buildVariationIndex(texture.getFrameNames());
  if (terrainVariations.size === 0) {
    throw new Error(`terrain atlas "${TERRAIN_ATLAS_KEY}" loaded no frames`);
  }
  const cliffs = scene.textures.get(CLIFF_ATLAS_KEY);
  const cliffVariations = buildVariationIndex(cliffs.getFrameNames());
  if (cliffVariations.size === 0) {
    throw new Error(`cliff atlas "${CLIFF_ATLAS_KEY}" loaded no frames`);
  }

  const buildingSidecars = new Map<BuildingSprite, BuildingSidecar>();
  for (const sprite of BUILDING_SPRITES) {
    const sidecar = scene.cache.json.get(sidecarKey(sprite)) as BuildingSidecar | undefined;
    if (!sidecar) throw new Error(`missing sidecar for building "${sprite}"`);
    buildingSidecars.set(sprite, sidecar);
    // One looping smoke animation per door position, built from the ranges
    // the sidecar names — so the door opens by switching animation, and
    // the smoke keeps drifting either way.
    registerBuildingAnimsFor(scene, sprite, sprite, sidecar);
  }

  registerCharacterAnims(scene);
  const { interiorSidecars, growable } = registerInteriorAnims(scene);
  registerPlantAnims(scene);
  const fixtureSidecars = registerFixtureAnims(scene);
  const flowerSidecars = registerFlowerAnims(scene);
  const scenerySidecars = registerSceneryAnims(scene);
  const landmarkSidecars = registerLandmarkAnims(scene);
  const deckVariations = readDecking(scene);
  registerEffectAnims(scene);
  return {
    terrainVariations,
    cliffVariations,
    waterFrames: waterFrames(texture.getFrameNames()),
    deckVariations,
    buildingSidecars,
    scenerySidecars,
    landmarkSidecars,
    flowerSidecars,
    fixtureSidecars,
    interiorSidecars,
    growable,
  };
}

// Spell effects. Unlike every other animation registered here these do not
// repeat: `loops` comes from the sidecar rather than being decided in this
// file, because whether something is a loop or a gesture is a property of
// how it was drawn.
function registerEffectAnims(scene: Phaser.Scene): void {
  for (const effect of EFFECT_TYPES) {
    const sidecar = scene.cache.json.get(effectSidecarKey(effect)) as EffectSidecar | undefined;
    if (!sidecar) throw new Error(`missing sidecar for effect "${effect}"`);
    for (const [name, range] of Object.entries(sidecar.animations)) {
      const key = `effect-${effect}-${name}`;
      if (scene.anims.exists(key)) continue;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(effectSheetKey(effect), {
          start: range.start,
          end: range.end,
        }),
        frameRate: EFFECT_FPS,
        repeat: sidecar.loops ? -1 : 0,
      });
    }
  }
}

function registerSceneryAnims(scene: Phaser.Scene): Map<string, ObjectSidecar> {
  const sidecars = new Map<string, ObjectSidecar>();
  for (const kind of SCENERY_KINDS) {
    const sidecar = scene.cache.json.get(scenerySidecarKey(kind)) as ObjectSidecar | undefined;
    if (!sidecar) throw new Error(`missing sidecar for scenery "${kind}"`);
    sidecars.set(kind, sidecar);
    // One animation per individual, from the ranges the sidecar names.
    for (const [name, range] of Object.entries(sidecar.animations)) {
      const instance = Number(name.replace(/^instance_/, ""));
      if (!Number.isInteger(instance)) continue;
      const key = sceneryAnimKey(kind, instance);
      if (scene.anims.exists(key)) continue;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(scenerySheetKey(kind), {
          start: range.start,
          end: range.end,
        }),
        frameRate: SCENERY_ANIM_FPS,
        repeat: -1,
      });
    }
  }
  return sidecars;
}

/** How many planks there are to choose between. No animation: wood. */
function readDecking(scene: Phaser.Scene): number {
  const sidecar = scene.cache.json.get(DECK_SIDECAR_KEY) as DeckSidecar | undefined;
  if (!sidecar) throw new Error("missing sidecar for the harbour's decking");
  return Math.max(1, sidecar.variations);
}

function registerLandmarkAnims(scene: Phaser.Scene): Map<string, LandmarkSidecar> {
  const sidecars = new Map<string, LandmarkSidecar>();
  for (const landmark of LANDMARK_TYPES) {
    const sidecar = scene.cache.json.get(landmarkSidecarKey(landmark)) as
      | LandmarkSidecar
      | undefined;
    if (!sidecar) throw new Error(`missing sidecar for landmark "${landmark}"`);
    sidecars.set(landmark, sidecar);
    const key = landmarkAnimKey(landmark);
    if (scene.anims.exists(key)) continue;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(landmarkSheetKey(landmark), {
        start: 0,
        end: sidecar.frame_count - 1,
      }),
      frameRate: LANDMARK_ANIM_FPS,
      repeat: -1,
    });
  }
  // And the skyline, which is drawn by the same generator module and is
  // not a landmark. Registered here rather than in a routine of its own
  // because it is the same three lines and the same sidecar shape — what
  // differs about a blimp is that nothing ever places one.
  for (const thing of SKY_THINGS) {
    const sidecar = scene.cache.json.get(skySidecarKey(thing)) as LandmarkSidecar | undefined;
    if (!sidecar) throw new Error(`missing sidecar for the skyline's "${thing}"`);
    const key = skyAnimKey(thing);
    if (scene.anims.exists(key)) continue;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(skySheetKey(thing), {
        start: 0,
        end: sidecar.frame_count - 1,
      }),
      frameRate: LANDMARK_ANIM_FPS,
      repeat: -1,
    });
  }
  return sidecars;
}

/**
 * One looping sway per flower per colour.
 *
 * Five animations each rather than one, because the sheet holds five
 * colourways end to end and a look is a *slice* of it. Registered up front
 * for every colour whether or not this child has found the flower: an
 * animation is a table entry, and building one the moment a child taps a
 * colour would be building it during the tap.
 */
function registerFlowerAnims(scene: Phaser.Scene): Map<FlowerType, FixtureSidecar> {
  const sidecars = new Map<FlowerType, FixtureSidecar>();
  for (const flower of FLOWER_TYPES) {
    const sidecar = scene.cache.json.get(flowerSidecarKey(flower)) as FixtureSidecar | undefined;
    if (!sidecar) throw new Error(`missing sidecar for flower "${flower}"`);
    sidecars.set(flower, sidecar);
    for (let look = 0; look < FLOWER_LOOKS; look++) {
      const key = flowerAnimKey(flower, look);
      if (scene.anims.exists(key)) continue;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(flowerSheetKey(flower), {
          frames: flowerFrames(look, sidecar.frames_per_look),
        }),
        frameRate: FIXTURE_ANIM_FPS,
        repeat: -1,
      });
    }
  }
  return sidecars;
}

function registerFixtureAnims(scene: Phaser.Scene): Map<string, FixtureSidecar> {
  const sidecars = new Map<string, FixtureSidecar>();
  for (const fixture of FIXTURE_TYPES) {
    const sidecar = scene.cache.json.get(fixtureSidecarKey(fixture)) as FixtureSidecar | undefined;
    if (!sidecar) throw new Error(`missing sidecar for fixture "${fixture}"`);
    sidecars.set(fixture, sidecar);
    // One animation per drawing, the way the flowers have one per colour.
    // A sheet with three ways round played end to end is a bench turning
    // itself round twice a second — which is what a single animation over
    // `frame_count` does the moment a fixture gains a second look.
    for (let look = 0; look < Math.max(1, sidecar.looks); look++) {
      const key = fixtureAnimKey(fixture, look);
      if (scene.anims.exists(key)) continue;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(fixtureSheetKey(fixture), {
          frames: flowerFrames(look, sidecar.frames_per_look),
        }),
        frameRate: FIXTURE_ANIM_FPS,
        repeat: -1,
      });
    }
  }
  return sidecars;
}

// One looping sway per growth stage, from the ranges the sidecar names.
// Only the planted stage is reachable today (see PLANTED_STAGE), but the
// others cost nothing to register and are what tending will switch to.
function registerPlantAnims(scene: Phaser.Scene): void {
  for (const plant of PLANT_TYPES) {
    const sidecar = scene.cache.json.get(plantSidecarKey(plant)) as PlantSidecar | undefined;
    if (!sidecar) throw new Error(`missing sidecar for plant "${plant}"`);
    for (const [name, range] of Object.entries(sidecar.animations)) {
      const key = `plant-${plant}-${name}`;
      if (scene.anims.exists(key)) continue;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(plantSheetKey(plant), {
          start: range.start,
          end: range.end,
        }),
        frameRate: PLANT_SWAY_FPS,
        repeat: -1,
      });
    }
  }
}

function registerInteriorAnims(scene: Phaser.Scene): {
  interiorSidecars: Map<string, InteriorSidecar>;
  growable: GrowableSidecar | null;
} {
  // The parts the cottage can be rebuilt from, if this build shipped them.
  const growable =
    (scene.cache.json.get(growableSidecarKey(GROWABLE_ROOM)) as GrowableSidecar | undefined) ??
    null;
  const interiorSidecars = new Map<string, InteriorSidecar>();
  for (const room of INTERIOR_ROOMS) {
    const sidecar = scene.cache.json.get(interiorSidecarKey(room)) as InteriorSidecar | undefined;
    if (!sidecar) throw new Error(`missing sidecar for interior "${room}"`);
    interiorSidecars.set(room, sidecar);
    const frames = sidecar.sheet?.frame_count ?? 1;
    // Most rooms are a single still frame; only the ones with something
    // moving in them (a fire) ship more, so there is nothing to loop.
    if (frames < 2) continue;
    const key = interiorAnimKey(room);
    if (scene.anims.exists(key)) continue;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(interiorSheetKey(room), {
        start: 0,
        end: frames - 1,
      }),
      frameRate: BUILDING_ANIM_FPS,
      repeat: -1,
    });
  }
  return { interiorSidecars, growable };
}

/**
 * A building's door animations, for one name against one sheet.
 *
 * The two come apart for a repainted house and only for one: its sheet is
 * a recoloured copy registered under a name of its own, and the frames
 * inside are the cottage's in the cottage's order. Repainting cannot move
 * a frame, so reading the ranges from the sidecar it was copied from is
 * not an approximation — it is the same sheet.
 */
export function registerBuildingAnimsFor(
  scene: Phaser.Scene,
  name: string,
  sprite: BuildingSprite,
  sidecar: BuildingSidecar,
): void {
  // One looping smoke animation per door position, built from the ranges
  // the sidecar names — so the door opens by switching animation, and the
  // smoke keeps drifting either way.
  // Keyed by the row's own name, whatever it is. This took the name apart
  // and put it back together — `door_half` stripped to `half` and rebuilt
  // as `door_half` — which is the same string right up until a row is not
  // a door. The ship's `sail_furled` came back as `door_sail_furled`,
  // nothing asked for that, and the harbour drew no ships.
  for (const [animation, range] of Object.entries(sidecar.animations)) {
    const key = buildingRowKey(name, animation);
    if (scene.anims.exists(key)) continue;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(spriteSheetKey(name), {
        start: range.start,
        end: range.end,
      }),
      frameRate: BUILDING_ANIM_FPS,
      repeat: -1,
    });
  }
  void sprite;
}

// One Phaser animation per (character, animation, facing), built straight
// from the frame ranges the sidecar names. Nothing here knows how many
// frames a walk cycle has or which row it sits on — that is the sheet's
// business, and reading it back is what keeps the two in step.
function registerCharacterAnims(scene: Phaser.Scene): void {
  for (const character of ALL_CHARACTERS) registerCharacterAnimsFor(scene, character, character);
  // Animals go through exactly the same machinery: their sheets are laid
  // out the way a villager's is, so nothing about walking, facing or
  // depth-sorting has to learn that a chicken is not a person.
  for (const kind of ANIMAL_KINDS) {
    registerCharacterAnimsFor(
      scene,
      animalSheetKey(kind),
      animalSidecarKey(kind),
      animalSheetKey(kind),
    );
  }
}

/**
 * Build one character's animations from one sidecar's frame ranges.
 *
 * The two names come apart for the player and only for the player: their
 * sheet is a recoloured copy registered under a name of its own (see
 * src/avatar/texture.ts), but the frames inside it are the body's, in the
 * body's order. Recolouring cannot move a frame — it repaints pixels — so
 * reading the ranges from the body it was copied from is not an
 * approximation, it is the same sheet.
 */
export function registerCharacterAnimsFor(
  scene: Phaser.Scene,
  character: string,
  sidecarFrom: string,
  sheetKey?: string,
): void {
  const sidecar = scene.cache.json.get(sheetKey ? sidecarFrom : characterSidecarKey(sidecarFrom)) as
    | CharacterSidecar
    | undefined;
  if (!sidecar) throw new Error(`missing sidecar for character "${sidecarFrom}"`);
  for (const [name, range] of Object.entries(sidecar.animations)) {
    const [animation, facing] = name.split("_");
    if (!animation || !facing) throw new Error(`${sidecarFrom}: odd animation name "${name}"`);
    if (!CHARACTER_ANIMATIONS.includes(animation)) continue;
    const key = characterAnimKey(character, animation, facing as Facing);
    if (scene.anims.exists(key)) continue;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(sheetKey ?? characterSheetKey(character), {
        start: range.start,
        end: range.end,
      }),
      frameRate: FPS_FOR_ANIMATION[animation] ?? IDLE_FPS,
      // A gesture plays once; idle and walk loop. Registering a one-shot
      // with repeat -1 does not merely make it repeat: ANIMATION_COMPLETE
      // never fires, so the flag that says "a gesture is running" is never
      // cleared and the character bows for the rest of the session,
      // walking included. Nothing on screen says so either — a plant
      // animation that loops passes through the standing pose twice a
      // cycle, so it reads as a character with a twitch rather than as a
      // stuck state.
      repeat: ONE_SHOT_ANIMATIONS.includes(animation) ? 0 : -1,
    });
  }
}
