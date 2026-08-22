// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import Phaser from "phaser";
import {
  type AvatarCatalogue,
  type AvatarStyle,
  DEFAULT_AVATAR,
  usableAvatar,
} from "../avatar/style";
import { avatarCatalogue, avatarTexture } from "../avatar/texture";
import { phrasesFor } from "../i18n";
import { EN } from "../i18n/en";
import type { Phrases } from "../i18n/phrases";
import { VirtualJoystick } from "../input/VirtualJoystick";
import { type Rgb, rampPlan } from "../render/recolour";
import { repaintedSheet } from "../render/sheetTexture";
import {
  type SavedGame,
  deleteGame,
  listGames,
  newGame,
  openGame,
  playingId,
  profileIn,
  setPlaying,
  withProgress,
  writeGame,
} from "../save/games";
import { type Profile, createProfile, freshStart } from "../save/profiles";
import {
  type WorldBaseline,
  restorePlayer,
  restoreWorld,
  savedAtOf,
  snapshotGame,
  snapshotPlayer,
  worldBaseline,
} from "../save/snapshot";
import { saveProfile } from "../save/store";
import {
  Language,
  type Settings,
  browserStore,
  readSettings,
  settingsWithOverrides,
  writeSettings,
} from "../settings";
import {
  COIN_TIERS,
  CURRENCY,
  CoinTier,
  coinTier,
  totalOf as coinTotal,
  coinsFor,
  smallestCoin,
} from "../shop/currency";
import { makeAdditionProblem, movedBy } from "../spells/addition";
import type { CastResult } from "../spells/cast";
import {
  DEFAULT_BAND,
  type Recent,
  bandAt,
  nextRung,
  recordCast,
  rungAt,
} from "../spells/difficulty";
import { HARDEST_CLOCK_RUNG, clockRungAt, hourglassFor, worthCasting } from "../spells/hourglass";
import { HARDEST_ARRAY_RUNG, arrayProblemFor, arrayRungAt } from "../spells/multiplication";
import {
  HARDEST_PORTAL_RUNG,
  type PortalJourney,
  placeAt,
  portalRungAt,
  portalStops,
} from "../spells/portal";
import {
  PORTAL_CLOSE_MS,
  PORTAL_ENTER_MS,
  PORTAL_EXIT_MS,
  PORTAL_HOLD_MS,
  PORTAL_OPEN_MS,
  PORTAL_TILES_ACROSS,
  PORTAL_TILES_DOWN,
  portalCell,
  portalOpenness,
  portalTravelMs,
  portalView,
} from "../spells/portalTravel";
import { Spell, knowsSpell, learnSpell } from "../spells/spellbook";
import { makeSubtractionProblem } from "../spells/subtraction";
import { AboutPanel } from "../ui/AboutPanel";
import { ArrayPopup } from "../ui/ArrayPopup";
import { ClockPopup } from "../ui/ClockPopup";
import { GeometryLessonPanel } from "../ui/GeometryLessonPanel";
import { GroveLessonPanel } from "../ui/GroveLessonPanel";
import { IconTray } from "../ui/IconTray";
import { IntroPanel } from "../ui/IntroPanel";
import { LessonPanel } from "../ui/LessonPanel";
import { MapPanel } from "../ui/MapPanel";
import { OptionsPanel } from "../ui/OptionsPanel";
import { PatchMenu } from "../ui/PatchMenu";
import { PicturePanel } from "../ui/PicturePanel";
import { PortalPanel } from "../ui/PortalPanel";
import { ShopPanel } from "../ui/ShopPanel";
import { SpellPopup } from "../ui/SpellPopup";
import { TaskPanel } from "../ui/TaskPanel";
import {
  UI_SIDECAR_KEY,
  UiAsset,
  type UiIndex,
  coinIcon,
  cropIcon,
  itemIcon,
  materialIcon,
  uiTextureKey,
} from "../ui/assets";
import type { AreaPlacement } from "../world/anchors";
import type { AnchorPlacements } from "../world/anchors";
import {
  ANIMAL_ASK_MAX_MS,
  ANIMAL_ASK_MIN_MS,
  ANIMAL_FED_QUIET_MS,
  ANIMAL_GLAD_MS,
  ANIMAL_KINDS,
  ANIMAL_QUIET_MAX_MS,
  ANIMAL_QUIET_MIN_MS,
  ANIMAL_RANGE,
  type AnimalKind,
  animalSheetKey,
  animalSidecarKey,
  animalSpots,
} from "../world/animals";
import {
  BUILDING_SPRITES,
  type BuildingRole,
  type BuildingSprite,
  DoorState,
  type Entrance,
  ROLE_SPRITES,
  buildingAnimKey,
  doorStateForDistance,
  entranceFor,
  isEntrance,
  spriteSheetKey,
} from "../world/buildings";
import {
  ALL_CHARACTERS,
  CHARACTER_ANIMATIONS,
  DEFAULT_FACING,
  Facing,
  IDLE,
  IDLE_FPS,
  ONE_SHOT_ANIMATIONS,
  PLANT,
  PLANT_FPS,
  WALK,
  WALK_FPS,
  characterAnimKey,
  characterFor,
  characterSheetKey,
  characterSidecarKey,
  facingFor,
  oppositeFacing,
} from "../world/characters";
import {
  type ChunkCoord,
  chunkKey,
  chunksCoveringTileRange,
  dualChunkScreenBounds,
  dualTileRange,
  dualTileToChunk,
} from "../world/chunks";
import type { CityLayout } from "../world/city";
import { CLIFF_ATLAS_KEY, cliffFrameFor, cornerLevelsFor } from "../world/cliffAtlas";
import { DECK_SHEET_KEY, DECK_SIDECAR_KEY, type DeckSidecar } from "../world/decking";
import {
  EFFECT_FPS,
  EFFECT_TYPES,
  EffectType,
  effectAnimKey,
  effectSheetKey,
  effectSidecarKey,
} from "../world/effects";
import { type Grove, GroveTask, duskOver, groveProgress } from "../world/enchantedForest";
import {
  FIXTURE_TYPES,
  FixtureType,
  PLACEABLE_FIXTURES,
  fixtureAnimKey,
  fixtureFor,
  fixtureSheetKey,
  fixtureSidecarKey,
  isPlaceable,
} from "../world/fixtures";
import type { WorldGrid } from "../world/grid";
import type { HarbourLayout } from "../world/harbour";
import {
  FABRIC_SLOTS,
  ROOF_SLOTS,
  type Ramp,
  houseLook,
  lightingDelay,
  rampOf,
  varies,
  windowBrightness,
} from "../world/houses";
import {
  INTERIOR_ROOMS,
  LightKind,
  type RoomLight,
  buildInteriorGrid,
  hearthCell,
  interiorAnimKey,
  interiorAttendantCell,
  interiorDoor,
  interiorFor,
  interiorOriginY,
  interiorSheetKey,
  interiorSidecarKey,
  lightBreath,
  roomCameraBounds,
  roomLights,
  wallHangingCell,
} from "../world/interiors";
import type { Inventory, ItemType } from "../world/inventory";
import {
  LANDMARK_TYPES,
  LandmarkType,
  landmarkAnimKey,
  landmarkFor,
  landmarkSheetKey,
  landmarkSidecarKey,
} from "../world/landmarks";
import { hasStep } from "../world/levels";
import { MATERIAL_TYPES, yieldOf } from "../world/materials";
import type { PlacedObject } from "../world/objects";
import { LAMP_POSTS, type Observatory, lampsLit, postsFree } from "../world/observatory";
import { findPath } from "../world/pathfinding";
import {
  type Crop,
  HARVEST_YIELD,
  PLANTED_STAGE,
  PLANT_TYPES,
  PlantStage,
  type PlantType,
  plantAnimKey,
  plantSheetKey,
  plantSidecarKey,
} from "../world/plants";
import { type Rng, createRng } from "../world/rng";
import {
  SCENERY_KINDS,
  sceneryAnimKey,
  sceneryKind,
  scenerySheetKey,
  scenerySidecarKey,
} from "../world/scenery";
import { type Patch, patchBetween, patchCells, patchIsCastable } from "../world/selection";
import {
  AIM_REACH,
  type ActionResult,
  GameSession,
  Outcome,
  stepsToSpeak,
  withinReach,
} from "../world/session";
import type { Purse } from "../world/shop";
import {
  type BuildingSidecar,
  type CharacterSidecar,
  type EffectSidecar,
  type FixtureSidecar,
  type InteriorSidecar,
  type LandmarkSidecar,
  type ObjectSidecar,
  type PlantSidecar,
  type SpriteSidecar,
  doorCell,
  footprintBottomY,
  spriteOrigin,
} from "../world/spriteSidecar";
import {
  DUAL_OFFSET,
  DUAL_ORIGIN,
  TERRAIN_ATLAS_KEY,
  buildVariationIndex,
  cornerTerrainsFor,
  frameFor,
  variationFor,
} from "../world/terrainAtlas";
import {
  MAX_NIGHT_ALPHA,
  NIGHT_TINT_COLOR,
  isDaytime,
  nightTintAlpha,
  timeOfDay,
} from "../world/time";
import {
  type GridPoint,
  type ScreenPoint,
  TILE_SIZE,
  computeMapScreenBounds,
  depthFor,
  gridToScreen,
  screenToGrid,
} from "../world/topdown";
import type { VillageNpcSpec } from "../world/villageLayout";
import { generateWorld } from "../world/worldGenerator";
import { sidecarKey } from "./BootScene";
import { type DevOptions, devOptions, exposeForTests } from "./devHooks";

const WORLD_SIZE = 500;
// Fixed for now so the world is reproducible during development; will
// likely become player-chosen (or randomized per new game) once there's a
// save/new-game flow to hang that choice off of.
/**
 * How often the world is written down.
 *
 * Often enough that a lid closed without warning costs a few seconds of
 * planting, rarely enough that it is never the reason a frame is late.
 */
const AUTOSAVE_MS = 4000;

/**
 * The mark that means "not there".
 *
 * Red, and the only red in the world: the terrain palette is pastel
 * throughout and nothing else the player can see is this colour, so it reads
 * as a message rather than as scenery.
 */
const REFUSAL_COLOR = 0xd8342a;
/** Long enough to be seen by somebody looking a beat late, short enough not to linger. */
const REFUSAL_MS = 420;
/**
 * How a result is shown: the thing that changed, rising off its square.
 *
 * Sixteen pixels because it is a picture of a thing rather than a button —
 * the same size the animals think in, so a child meets one size of "here is
 * a thing" and not two.
 */
const RESULT_ICON = 22;
const RESULT_RISE = 22;
const RESULT_MS = 700;
/** The trail that says *too far*: this many dots between her and the square. */
const TOO_FAR_STEPS = 4;
const TOO_FAR_DOT = 2.5;
/**
 * How far apart the logs come up out of a cleared tree.
 *
 * One after another rather than all at once: three icons on top of each
 * other is one icon, and the count is the thing worth seeing — it is the
 * first time in this game that *which* thing you cleared has mattered.
 */
const MATERIAL_STAGGER_MS = 130;
/** How slowly the armed rune breathes. */
const ARMED_PULSE_MS = 520;
/** How long a newly earned rune hangs in the air. Longer: it is a moment. */
const EARNED_MS = 1400;
const MOVE_DURATION_MS = 160;
// Depth is a pixel y now (see topdown.ts's depthFor), not the tile-unit
// col + row the isometric projection sorted on — so it runs to the world's
// pixel height rather than topping out around 1000. Anything that has to
// float above the world has to clear that, and deriving these from
// WORLD_SIZE keeps them right if the world grows.
const WORLD_DEPTH_CEILING = WORLD_SIZE * TILE_SIZE;
const NIGHT_TINT_DEPTH = WORLD_DEPTH_CEILING + 1000;

// --- lights --------------------------------------------------------------
//
// Night used to be one flat sheet of navy over everything, and playtesting
// said the obvious: you cannot see. The fix is not a paler sheet — a night
// you can read at a glance is not night — but holes in it. What the player
// carries, and what is burning nearby, is cut back out of the dark.
//
// The mask is built here rather than drawn by the asset generator, and that
// is deliberate: a soft radial falloff is not pixel art and cannot be, since
// the generator's canvas is indexed and has no partial alpha. It is the same
// kind of thing as the tint itself — a colour with an alpha ramp — so it is
// made the same way, in code.
const LIGHT_TEXTURE = "light-mask";
const LIGHT_TEXTURE_RADIUS = 128;
const LIGHT_RINGS = 32;
/** How far each kind of light reaches, in screen pixels at the world zoom. */
const PLAYER_LIGHT_RADIUS = 120;
const LAMP_LIGHT_RADIUS = 150;
/** The warm halo a flame throws. */
const LAMP_GLOW_COLOR = 0xffb347;
const LAMP_GLOW_ALPHA = 0.62;
/**
 * The fire in a cottage, once it is dark enough to matter.
 *
 * Smaller than a lamp and redder. A lamp is hung to light a path and throws
 * its light evenly for some way; a fire is in a box against a wall, so it
 * reaches the hearthrug and not the far corner.
 */
const HEARTH_LIGHT_RADIUS = 118;
const HEARTH_GLOW_COLOR = 0xff8a3c;
const HEARTH_GLOW_ALPHA = 0.72;
/**
 * How much the light moves as the flame does.
 *
 * Taken from the room's own animation frame rather than from the clock. The
 * fire is eight frames at `BUILDING_ANIM_FPS`, and a glow pulsing at any
 * other rate beats against it — two flickers out of step, which reads as a
 * fault rather than as firelight.
 */
const HEARTH_FLICKER = 0.18;
/**
 * The great tree, while it is still asking for something.
 *
 * Wide and faint: it is a canopy catching light rather than a lamp under
 * one, so it is nearly the size of the crown and never bright enough to
 * flatten the leaves under it. Four seconds to a breath, slower than
 * anything else here — a fire flickers and an orb breathes, and this is a
 * tree, and it is asking rather than burning.
 */
const TREE_LIGHT_RADIUS = 92;
const TREE_GLOW_COLOR = 0xbfffdd;
const TREE_GLOW_ALPHA = 0.34;
const TREE_BREATH_MS = 4000;
const TREE_BREATH = 0.55;
/** How far above the anchor the crown is, in screen pixels. */
const TREE_GLOW_RISE = 96;
/**
 * The other three lights a room can have, and how each behaves.
 *
 * Radius, colour and how much it moves. A shop's lantern is a flame behind
 * glass, so it is warm and it wavers a little; the school's tube is cold and
 * does not move at all, because nothing electric does; the tower's orbs are
 * the coldest thing in the game and breathe slowly, which is the only thing
 * here that says *magic* without a word.
 */
const ROOM_LIGHTS: Record<
  string,
  { radius: number; color: number; alpha: number; move: number; period: number }
> = {
  [LightKind.Lamp]: { radius: 96, color: 0xffb257, alpha: 0.66, move: 0.08, period: 900 },
  [LightKind.Electric]: { radius: 132, color: 0xdfe8ff, alpha: 0.6, move: 0, period: 0 },
  [LightKind.Orb]: { radius: 104, color: 0x9fd0ff, alpha: 0.7, move: 0.3, period: 2600 },
};
/** What the player carries: paler and smaller, so a lamp is still worth having. */
const PLAYER_GLOW_COLOR = 0xffe6b0;
const PLAYER_GLOW_ALPHA = 0.5;
const HUD_DEPTH = WORLD_DEPTH_CEILING + 2000;
const TOUCH_UI_DEPTH = WORLD_DEPTH_CEILING + 3000;
// Above the touch controls: a spell popup covers everything, including the
// buttons that opened it.
const MODAL_DEPTH = WORLD_DEPTH_CEILING + 4000;
const CHUNK_DEPTH = -1000;

// The portal's gold: the rune's own, so the doorway and the icon that opened
// it are plainly the same magic.
const PORTAL_RIM_HEX = 0xc8901c;
const PORTAL_GLOW_HEX = 0xffe28c;
const PORTAL_SPARKS = 6;
// Integer, so every world pixel lands on a whole number of screen pixels —
// the point of filling the viewport rather than scaling a fixed canvas into
// it. 2 keeps roughly the framing the old 800x600 canvas gave on a desktop
// while doubling how big a character reads on a phone.
const CAMERA_ZOOM = 2;

/**
 * A lit window, seen from the road.
 *
 * Sized off the pane rather than picked: a window is nine pixels square, and
 * this is a halo about as wide again around it. The first try was half again
 * as big, which is fine on a cottage — two windows either side of a door,
 * far apart — and wrong on a townhouse, where four of them go up the front
 * fifteen pixels apart and the glows ran together into one white column. A
 * house should read as *windows*, not as a lit shaft.
 *
 * The colour is the hearth's, because it is the same fire: a house lights up
 * from the inside, which is why only the houses with a fireplace light at
 * all.
 */
const WINDOW_PANE_PX = 9;
const WINDOW_LIGHT_RADIUS = WINDOW_PANE_PX * CAMERA_ZOOM;
const WINDOW_GLOW_COLOR = 0xffb257;
const WINDOW_GLOW_ALPHA = 0.78;
const HUD_MARGIN = 8;
/**
 * How far past the screen the *ground* is kept drawn.
 *
 * A ring of chunks in every direction, so walking to the edge of the view
 * finds terrain already there rather than a chunk being redrawn under the
 * player's feet.
 */
const CHUNK_VIEW_MARGIN = 1;
/**
 * And how far past it the *trees* are, which is not at all.
 *
 * These were one number for a long time and it was the wrong shape. A
 * chunk's ground is a single texture — cheap to hold, expensive to redraw —
 * so a ring of them is worth having. A chunk's trees are hundreds of live
 * sprites, and a ring of chunks at a desktop's screen size is several times
 * more of them than are on screen: eight and a half thousand standing in a
 * village where a couple of thousand can be seen. Nothing is gained by
 * having a tree ready off screen; a tree costs nothing to make.
 */
const SCENERY_VIEW_MARGIN = 0;
/**
 * How far outside the view a tree is still drawn, in world pixels.
 *
 * Two tiles. A conifer is drawn several tiles taller than the square it
 * stands on, and what is tested is the square — so a tree whose feet are
 * just off the top of the screen still has its head on it.
 */
const SCENERY_CULL_MARGIN = TILE_SIZE * 2;
// Generous cache so panning back and forth doesn't constantly re-render —
// well above what's ever simultaneously visible on screen.
const CHUNK_CACHE_LIMIT = 60;

// Slow idle loop: the 8 frames are drifting chimney smoke, not motion.
const BUILDING_ANIM_FPS = 6;
// Slow enough to read as a breeze rather than a shiver.
const PLANT_SWAY_FPS = 4;
// The well bucket drifts rather than swings.
const FIXTURE_ANIM_FPS = 5;
// Trees and spires sway slowly, and there are hundreds of them.
const SCENERY_ANIM_FPS = 4;
// Slower still. A crown five people tall does not move at a sapling's rate,
// and the lights in it breathe rather than blink.
/**
 * Twice what it was, because the sheets have twice the frames.
 *
 * The cycle stays the length it was — a couple of seconds of sway — and each
 * step is half the size, which is the whole of what "smoother" means here.
 * Leaving this at three would have doubled the cycle instead and given a
 * tree that moves like something underwater.
 */
const LANDMARK_ANIM_FPS = 6;

/**
 * How dark the enchanted forest is at its darkest hour of the day: noon.
 *
 * Below the night's own maximum, so night in the wood is still visibly
 * darker than day in it — a place with no day and no night would read as a
 * rendering fault rather than as somewhere strange.
 */
const GROVE_DUSK_ALPHA = 0.3;
/**
 * What the array spell can do to a patch it has been drawn round.
 *
 * The three things this game does to ground, and the point of the spell is
 * that it does any of them many times over. Naming them here rather than
 * reusing the spell names — "grow" is the addition spell and "clear" is the
 * subtraction spell — because from the player's side these are *choices
 * about a patch*, not spells being cast inside a spell.
 */
export const PatchAction = {
  Plant: "plant",
  Grow: "grow",
  Clear: "clear",
} as const;

export type PatchAction = (typeof PatchAction)[keyof typeof PatchAction];

/** The marker drawn over ground the player has marked out. */
const PATCH_FILL = 0xffe08a;
const PATCH_FILL_ALPHA = 0.22;
const PATCH_EDGE = 0xffe08a;
/** Squares inside the patch that nothing could happen to. */
const PATCH_DEAD = 0x201810;
const PATCH_DEAD_ALPHA = 0.35;

/**
 * The socket cut in the ground where a lamp post goes.
 *
 * Drawn rather than placed, because a lamp needs the cell to be empty and a
 * marker that was an object would be a marker standing in its own way. It
 * reads as a hole waiting for a post — dark stone with a lit rim — and it
 * fills in the moment a lamp stands on it, so the climb keeps its own tally
 * of how far the astronomer's task has got.
 */
const SOCKET_HOLE = 0x2b2620;
const SOCKET_RIM = 0xd8c48a;
const SOCKET_WIDE = 13;
const SOCKET_TALL = 6;

/** The four steps off a landing cell, for the check that it is not a trap. */
const AROUND_LANDING: readonly (readonly [number, number])[] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

/** The tint the wood's own shade leans toward: a deep, cold green. */
const GROVE_TINT_COLOR = 0x0d2418;
/**
 * How long the dusk takes to settle when it changes, in milliseconds.
 *
 * A real duration, because the step below is linear and signed. It was an
 * exponential approach first — `dusk += (wanted - dusk) * delta / MS` — which
 * is the shape a tween usually wants and the wrong one for a constant with
 * this name: it reaches 95% at about three times the number written here, so
 * the comment would have been out by a factor of three and the crossfade a
 * slow creep rather than a transition.
 */
const DUSK_FADE_MS = 900;

/** The tint colour at a given depth of grove-dusk: night, leaning green. */
function mixTint(dusk: number): number {
  const t = Math.max(0, Math.min(1, dusk));
  const lerp = (from: number, to: number, shift: number) =>
    Math.round(((from >> shift) & 0xff) * (1 - t) + ((to >> shift) & 0xff) * t);
  return (
    (lerp(NIGHT_TINT_COLOR, GROVE_TINT_COLOR, 16) << 16) |
    (lerp(NIGHT_TINT_COLOR, GROVE_TINT_COLOR, 8) << 8) |
    lerp(NIGHT_TINT_COLOR, GROVE_TINT_COLOR, 0)
  );
}
// How many distinct starting points an idle animation can be scattered
// across. Enough that a stand of trees looks unsynchronised, few enough
// that it stays a cheap integer hash of the tile.
const PHASE_STEPS = 16;

const NPC_MOVE_DURATION_MS = 500;

/**
 * The cloud an animal thinks in, and where the food goes in it.
 *
 * The same numbers the generator drew it to, and they have to agree: the
 * bubble ships with a hole left in it for a crop, and an icon laid anywhere
 * else is an icon overlapping the question mark. See `render_thought_bubble`
 * in the generator's `ui.py`.
 */
const BUBBLE_W = 46;
const BUBBLE_H = 38;
const BUBBLE_SLOT = 16;
const BUBBLE_SLOT_GAP = 3;
const BUBBLE_INNER_X = 4;
const BUBBLE_INNER_Y = 8;
const BUBBLE_INNER_W = 38;
const BUBBLE_INNER_H = 17;
/** How far above the animal's head the tail's last puff floats. */
const BUBBLE_LIFT = 2;
/**
 * How often an animal takes a step, and how long the step takes.
 *
 * Quicker and twitchier than a person's amble throughout: a chicken that
 * moved at a villager's pace read as a very small villager rather than as a
 * bird, and the difference in *rhythm* does more to sell it than the drawing
 * does.
 */
const ANIMAL_STEP_MIN_MS = 600;
const ANIMAL_STEP_MAX_MS = 2600;
const NPC_STEP_MIN_MS = 1500;
const NPC_STEP_MAX_MS = 4000;
// Villagers/teacher/shopkeeper wander near their own building; the postal
// worker patrols the whole village (see docs/WORLD_GENERATION.md's "Village
// NPC roles" — only the postal worker's movement covers the full square).
// The one villager with something to do: tapping her opens the store. She is
// found *inside* the store rather than around the square — a shop is
// somewhere you go in to, and a shopkeeper who wandered was somewhere you had
// to find first. The others have no content behind them yet, so nothing is
// attached to them: a person who answers a tap with silence is worse than one
// who does not answer at all.
const SHOPKEEPER_ID = "shopkeeper";
// The other villager with something to say: she explains the addition spell,
// and she is in the school for the same reason the shopkeeper is in the
// store — a teacher you have to find in the square is one you meet by
// accident, and the spell is the thing a child is most likely to be stuck on.
const TEACHER_ID = "teacher";
// The other teacher: up the tower, beside the map, with the portal spell.
const GEOMETER_ID = "geometer";
/**
 * The astronomer, and the building she keeps.
 *
 * Not in `villageNpcs`, because she is not in the village — that list is what
 * the village layout produced, and the dome is four hundred tiles away up a
 * mountain. So the scene carries the one pairing here: a building id, and who
 * is inside it. The village's own three still come from the layout; this is
 * for the places that have exactly one person in them and no layout of NPCs
 * at all.
 */
const ASTRONOMER_ID = "astronomer";
const LONE_ATTENDANTS: Record<string, string> = {
  "observatory-dome": ASTRONOMER_ID,
};
// The post office's room, and the one building with a reason to have a map of
// the world on its wall.
/**
 * The building with the world map on its wall.
 *
 * The *building*, not the room type. It was the room type, which was true
 * while there was one tower in the world — and the moment the city started
 * building with towers of its own, every one of them had a map of the world
 * hanging in it. The map is the post office's one distinguishing feature and
 * the reason to climb its stairs; four more of it would have cost that
 * nothing less than everything.
 */
/**
 * What hangs on which building's wall, and it is one thing each.
 *
 * Keyed by *building*, not by room type. It was by room type, which was true
 * while there was one tower in the world — and the moment the city started
 * building towers of its own, every one of them had a map of everywhere
 * hanging in it. The map is the post office's one distinguishing feature and
 * the reason to climb its stairs.
 */
const WALL_HANGINGS: Record<string, string> = {
  "post-office": UiAsset.MapWall,
  "observatory-dome": UiAsset.StarChart,
};
// How far up the wall it hangs, from the floor cell it is measured against.
const WALL_MAP_RISE = 10;
// The one who comes to *you*. He patrols the whole village anyway, so a round
// that starts at the player's gate is in character — and a tutorial that
// walks over and introduces itself is one a child meets as a person rather
// than as a wall of text on a title screen.
const POSTAL_WORKER_ID = "postal-worker";
// He crosses the square to deliver it, so he moves at a walk rather than at
// the villagers' amble; the wander timings would have him arrive a minute in.
const INTRO_STEP_MS = 230;
// And he covers ground faster than a villager ambling: the walk from the post
// office round the house and in through the garden gate is two dozen tiles,
// which at the wander's pace is a quarter of a minute of watching somebody
// approach before the game says anything at all.
const INTRO_MOVE_MS = 220;
// If the player is running circles round him, he gives up and gets on with
// his round. Tapping him still asks for the welcome.
const INTRO_PATIENCE_STEPS = 60;
const LOCAL_WANDER_RADIUS = 5;
const PATROL_WANDER_RADIUS = 16;

interface Direction {
  dCol: number;
  dRow: number;
}

// How fast each character animation runs. Walk is tied to the step duration,
// idle is a slow breath, and the planting gesture sits between them: six
// frames at 12 is about half a second, long enough to read as deliberate and
// short enough that it never feels like the game stopped listening.
const FPS_FOR_ANIMATION: Record<string, number> = {
  [WALK]: WALK_FPS,
  [IDLE]: IDLE_FPS,
  [PLANT]: PLANT_FPS,
};

// Crops and placed fixtures are sparse and looked up by tile, so their
// sprites are keyed by position rather than held in a grid-sized array.
function tileKey(col: number, row: number): string {
  return `${col},${row}`;
}

const STEP_DIRECTIONS: readonly Direction[] = [
  { dCol: 0, dRow: -1 },
  { dCol: 0, dRow: 1 },
  { dCol: -1, dRow: 0 },
  { dCol: 1, dRow: 0 },
];

/** What an animal is thinking about, if anything. */
const AnimalMood = {
  /** Nothing. No bubble. */
  Quiet: "quiet",
  /** A crop and a question mark. */
  Asking: "asking",
  /** A smile, for a moment after being fed. */
  Glad: "glad",
} as const;

type AnimalMood = (typeof AnimalMood)[keyof typeof AnimalMood];

/**
 * A chicken, and what it is hoping somebody brings it.
 *
 * An NPC with a hunger clock. `craves` never changes — it comes out of the
 * world seed — and `mood` is whether it is saying so right now. Every animal
 * asking at once is a checklist a child clears in one lap; on separate
 * clocks, a quarter of them are asking at any moment and the village keeps
 * having something in it.
 */
interface AnimalRuntime extends NpcRuntime {
  kind: AnimalKind;
  craves: PlantType;
  mood: AnimalMood;
  /** When the current mood runs out. */
  moodUntil: number;
  /** When it was last fed, or 0. Only used to tell two silences apart. */
  fedAt: number;
  bubble?: Phaser.GameObjects.Container;
}

interface NpcRuntime {
  id: string;
  character: string;
  facing: Facing;
  homeCol: number;
  homeRow: number;
  wanderCenterCol: number;
  wanderCenterRow: number;
  wanderRadius: number;
  col: number;
  row: number;
  sprite: Phaser.GameObjects.Sprite;
  isMoving: boolean;
  nextStepAt: number;
}

interface Wasd {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
}

// Something pinned to a screen edge, which has to move when the viewport
// does — rotation on a phone, a window drag on a desktop.
interface EdgeAnchored {
  place(width: number, height: number): void;
}

// A placed building and the door the player can walk up to. Kept per
// instance rather than per type: the village has three cottages, and each
// has to open its own door.
interface BuildingRuntime {
  /**
   * The sheet this one is actually drawn from.
   *
   * The same as `sprite` for everything but a repainted house, whose roof is
   * its own. Held because the door animation is keyed on whichever it is,
   * and swinging a blue-roofed door open with the red cottage's animation
   * would change its colour every time the player walked past.
   */
  painted: string;
  // The placed object's id, so a room can be matched back to the building it
  // is behind. Two of the village's buildings share a sprite, so the sprite
  // alone cannot answer "whose room is this".
  id: string;
  sprite: BuildingSprite;
  image: Phaser.GameObjects.Sprite;
  doorCol: number;
  doorRow: number;
  // The cells a step into which goes inside: the door and the wall to either
  // side of it. See ENTRANCE_REACH — the doorway is wider to walk into than
  // it is to look at.
  entrance: Entrance;
  door: DoorState;
  /**
   * The middle of each window in world pixels, and the halo over it.
   *
   * Empty for everything that is not somebody's home. A window is only lit
   * because there is a fire behind it, so what decides this is whether the
   * room on the other side has a hearth — which keeps the barn dark and the
   * observatory darker, and needs no second list to fall out of step.
   */
  windows: readonly { at: { x: number; y: number }; glow: Phaser.GameObjects.Image }[];
  /** How late in the dusk this house lights up. See `lightingDelay`. */
  lightsAt: number;
}

// The room the player is currently standing in, or null outdoors. Interiors
// are a mode of this scene rather than a scene of their own: the player,
// camera, input, joystick and HUD are all the same ones, and only the grid
// under them and the layer being drawn change.
interface InteriorRuntime {
  room: string;
  grid: WorldGrid;
  image: Phaser.GameObjects.Sprite;
  exit: GridPoint;
  returnTo: GridPoint;
  originY: number;
}

interface ActiveChunk {
  texture: Phaser.GameObjects.RenderTexture;
  lastUsedAt: number;
}

// Renders the world and lets the player walk it and plant on it. No
// gameplay/entity/isometric-projection design lives here beyond that — the
// actual gardening spells (math minigames) come later, one at a time.
//
// World terrain comes from src/world/worldGenerator.ts (steps 0-6 of
// docs/WORLD_GENERATION.md — story area interiors and stitching, steps
// 7-8, aren't built yet, so anchor areas are just plain passable ground
// for now).
export class GameScene extends Phaser.Scene {
  private grid!: WorldGrid;
  private originX = 0;
  private originY = 0;

  private player!: Phaser.GameObjects.Sprite;
  // The rules — where she is, what she is facing, what she is carrying, and
  // every action she can take — live in a headless GameSession. This scene is
  // the renderer and the input adapter over it, which is what lets the whole
  // plant-grow-pick-sell-buy loop be tested without a browser at all. See
  // src/world/session.ts.
  private session!: GameSession;
  private isMoving = false;
  // A gesture the player is part-way through, or null. While it is set the
  // per-frame idle/walk assertion leaves the sprite alone — see
  // playCharacterAnim, which is called every frame precisely so that no state
  // change can forget to update the sprite, and which would therefore
  // overwrite a one-shot on the very next frame.
  //
  // The player only. Every character's sheet carries the planting frames
  // because the generator draws one cast the same way, but nothing an NPC
  // does is a gardening action, so there is no per-NPC equivalent of this.
  private playerGesture: string | null = null;

  private selectedPlantIndex = 0;

  // One sprite per planted tile, so a crop that grows can be re-animated
  // rather than found again by hunting the display list.
  private cropSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private spellPopup!: SpellPopup;
  private seedTray?: IconTray;
  private spellTray?: IconTray;
  private basketTray?: IconTray;
  private crateTray?: IconTray;
  private purseTray?: IconTray;
  private shopPanel!: ShopPanel;
  /**
   * What the player chose: the language, and which coins they count in.
   *
   * Held here rather than read where it is needed, so that changing it is one
   * assignment followed by one refresh, and no part of the screen can be left
   * showing the old answer.
   */
  private settings!: Settings;
  /** Whose game this is: their world, their language, their face. */
  private profile!: Profile;
  /** True when a script jumped straight here, so nothing is written back. */
  private anonymous = false;
  private catalogue: AvatarCatalogue | null = null;
  /** The world as the generator made it, for working out what the child changed. */
  private baseline: WorldBaseline = new Map();
  /** The last thing written to storage, so an idle game rewrites nothing. */
  private lastSaved = "";
  /** The device's world number — everybody's, not this child's. */
  private seed = 0;
  /** The game that is open: a seed, a world, and everybody's progress in it. */
  private savedGame!: SavedGame;
  /**
   * Whether the page is on its way out to open another game.
   *
   * Read by `autosave`, which is the one thing that could write this game
   * back over the top of the switch.
   */
  private leavingGame = false;
  /**
   * How the last few casts went, for the difficulty to read.
   *
   * Kept for this sitting only rather than saved with the child. A window
   * that survived a reload would have a child judged on yesterday, and
   * losing it costs at most one extra cast before the next nudge.
   */
  private recentCasts: Recent = [];
  /**
   * The character name the player's sprite is drawn and animated under.
   *
   * Their body's name when nothing was recoloured, and a per-style name when
   * it was. Held rather than recomputed because every frame plays an
   * animation keyed on it.
   */
  private playerCharacter = DEFAULT_AVATAR.body;
  /**
   * Everything the player reads, in the language they chose.
   *
   * English until the settings are read, a few lines into `create`: the
   * status line is written once while the scene is still assembling itself,
   * and a phrase book that did not exist yet took the whole scene down.
   */
  private words: Phrases = EN;
  private optionsPanel?: OptionsPanel;
  /**
   * Who made this and what it costs, opened from the options.
   *
   * Its own panel rather than a row in that one: what it has to say is a
   * paragraph, and the options screen is a grid of buttons.
   */
  private aboutPanel?: AboutPanel;
  private lessonPanel?: LessonPanel;
  private introPanel?: IntroPanel;
  private mapPanel?: MapPanel;
  /** One picture, held up close, for the things that are only pictures. */
  private picturePanel?: PicturePanel;
  /** Somebody's errand, drawn as a row of things to do and what it earns. */
  private taskPanel?: TaskPanel;
  private geometryPanel?: GeometryLessonPanel;
  private grovePanel?: GroveLessonPanel;
  private arrayPopup?: ArrayPopup;
  private clockPopup?: ClockPopup;
  private patchMenu?: PatchMenu<PatchAction>;
  /**
   * The array spell, part way through being aimed.
   *
   * Null when the spell is not armed at all; `from` null when it is armed
   * and waiting for its first corner. Three states rather than two booleans,
   * so "armed but no corner yet" cannot be confused with "not armed".
   */
  private marking: { from: GridPoint | null; patch: Patch | null } | null = null;
  private patchInk?: Phaser.GameObjects.Graphics;
  private socketInk?: Phaser.GameObjects.Graphics;
  /**
   * The spell whose rune is lit and waiting to be told where to land.
   *
   * A spell is a question in two parts — *which spell* and *on what* — and
   * the rune is only the first half. Tapping it arms; the next tap on the
   * ground answers the second half and the parchment opens. Null means no
   * spell is waiting, which is most of the time.
   *
   * Only the two spells that land on a square are ever held here. The
   * portal and the hourglass do not take one, and the array spell has three
   * states of its own and keeps them in `marking`.
   */
  private armed: Spell | null = null;
  /** The rune hanging over her head while a spell waits for a tap. */
  private armedRune?: Phaser.GameObjects.Image;
  /** The square she is pointing at, and the ground an armed spell may reach. */
  private aimInk?: Phaser.GameObjects.Graphics;
  /** Everything `ui()` has claimed, so a tap can be told from a world tap. */
  private readonly uiObjects = new WeakSet<Phaser.GameObjects.GameObject>();
  private portalPanel?: PortalPanel;
  /**
   * The last few *portal* casts, kept apart from the growth spell's.
   *
   * Two ladders means two windows: a run of clean sums says nothing about
   * whether a child can read a ruler, and mixing them would move both dials
   * on evidence about one.
   */
  private recentPortalCasts: Recent = [];
  private recentArrayCasts: Recent = [];
  private recentClockCasts: Recent = [];
  /**
   * When the world was last written down before this session started.
   *
   * Read once, at load, and then held: the save is rewritten every few
   * seconds while somebody plays, so a spell that asked the store would find
   * the answer creeping up to now and pay nothing. Set to null once claimed,
   * because one absence is worth one casting of it.
   */
  private awayFrom: number | null = null;
  /** How deep the old wood's dusk is right now, eased toward where she is. */
  private dusk = 0;
  /** The timestamp the dusk was last stepped at, for a real-time crossfade. */
  private duskAt: number | null = null;
  /**
   * The doorway, while somebody is going through it.
   *
   * Four pieces: the far end's ground painted into a texture, an ellipse
   * that cuts the hole, the gold rim around it, and the sparks riding it.
   * All four live and die together — see `closePortal`.
   */
  private portalGround: Phaser.GameObjects.RenderTexture | null = null;
  private portalHole: Phaser.GameObjects.Graphics | null = null;
  private portalRim: Phaser.GameObjects.Graphics | null = null;
  private portalMiddle: ScreenPoint = { x: 0, y: 0 };
  /** What the doorway sorts at, so the traveller can be put just in front. */
  private portalDepth = 0;
  /**
   * Set while the crossing is playing.
   *
   * Folded into `modalOpen`, which is what already stops the world reaching
   * the player's hands: a step taken half way through a portal would be a
   * step from a tile they are no longer standing on.
   */
  private travelling = false;
  /** The failsafe's timer, cancelled the moment a crossing lands properly. */
  private portalGuard: Phaser.Time.TimerEvent | null = null;
  /** Whether the postal worker still has the welcome to deliver, and his patience. */
  private introToGive = false;
  private introStepsLeft = INTRO_PATIENCE_STEPS;
  /**
   * His route to the player, and who it was computed for.
   *
   * He used to step greedily, which was fine while the player started on
   * an open doorstep. They now start inside a fenced garden, and a greedy
   * stepper walks into the fence and stands there until it runs out of
   * patience — so he takes the same pathfinder the click-to-walk uses, and
   * comes in through the gate like anybody else.
   */
  private introPath: GridPoint[] = [];
  private introPathFor: GridPoint | null = null;
  private optionsButton?: { box: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text };
  // Sprites for fixtures the *player* put down, so one can be picked back
  // up. Deliberately not the village well: it was placed by generation and
  // is not hers to take.
  private placedFixtures = new Map<string, Phaser.GameObjects.Sprite>();
  // Problems vary from cast to cast, so this is seeded from the clock rather
  // than from the world's seed: a world is meant to be reproducible, a lesson is
  // meant not to be. A driving script can pin it with `?seed=`, which is the
  // honest version of what tests used to do by monkeypatching Date.now — and
  // which does not also stall every tween in the game. See devHooks.
  private dev: DevOptions = devOptions();
  private spellRng: Rng = createRng(0);
  /**
   * The shop draws from its own stream. Sharing the spell's would mean a
   * trip to the counter shifted every sum the spellbook went on to set —
   * and ?seed= promises a script the sums it is about to be asked.
   */
  private shopRng: Rng = createRng(0);

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Wasd;
  private plantKeys: Phaser.Input.Keyboard.Key[] = [];
  private plantActionKey!: Phaser.Input.Keyboard.Key;
  private spellbookKey!: Phaser.Input.Keyboard.Key;
  private seedPouchKey!: Phaser.Input.Keyboard.Key;
  private harvestKey!: Phaser.Input.Keyboard.Key;

  /**
   * Whether the world has been thrown away and the page is on its way out.
   *
   * Read by `autosave`, which is the one thing that could undo a reset.
   */
  private worldForgotten = false;
  /** The room the camera is framing, in pixels, so a rotation can re-frame it. */
  private framedRoom: { width: number; height: number } | null = null;

  private mobileControls = false;
  private joystick?: VirtualJoystick;
  private path: GridPoint[] = [];

  private activeChunks = new Map<string, ActiveChunk>();
  /**
   * The scenery of each chunk, spawned when its ground is drawn and thrown
   * away with it.
   *
   * Every tree used to be a live sprite from the moment the world was made:
   * thirteen thousand of them in a five-hundred-cell world, each with a sway
   * animation running, almost none of them on screen. That was survivable
   * while an object covered four tiles; it stopped being survivable when
   * they came down to one and a wood needed three times as many of them to
   * still look like a wood — measured at half the frame rate.
   *
   * Bucketed once at load, because the answer never changes: scenery is
   * placed by world generation and nothing moves it afterwards.
   */
  private readonly sceneryByChunk = new Map<string, PlacedObject[]>();
  private readonly liveScenery = new Map<string, Phaser.GameObjects.Sprite[]>();
  private frameCounter = 0;

  // How many variants the atlas ships per corner combination, read from the
  // loaded texture rather than hardcoded — see terrainAtlas.ts.
  private cliffVariations: ReadonlyMap<string, number> = new Map();
  private terrainVariations = new Map<string, number>();
  private buildingSidecars = new Map<BuildingSprite, BuildingSidecar>();
  private fixtureSidecars = new Map<string, FixtureSidecar>();
  private scenerySidecars = new Map<string, ObjectSidecar>();
  private landmarkSidecars = new Map<string, LandmarkSidecar>();
  /**
   * How many distinct planks the decking sheet ships.
   *
   * Read from the sidecar rather than written down here, for the reason
   * every other count is: the generator is the only thing that knows how
   * many it drew, and a number typed in on this side goes on being right
   * only until somebody adds a fifth.
   */
  private deckVariations = 1;
  private buildings: BuildingRuntime[] = [];
  private interiorSidecars = new Map<string, InteriorSidecar>();
  private interior: InteriorRuntime | null = null;
  // The outdoor grid and its camera bounds, kept so stepping back outside
  // restores exactly what was there rather than regenerating it.
  private worldGrid!: WorldGrid;
  private anchors!: AnchorPlacements;
  private grove!: Grove;
  /**
   * The light over the great tree while it is still asking for something.
   *
   * The one thing in the world that says a quest is open, and it says it
   * without a word or a mark — the tree simply breathes. It goes out the
   * moment the last bed is filled, which is the only announcement the game
   * makes about having finished it besides the rune.
   *
   * Additive over everything, unlike the night lights, because a tree that
   * only glowed after dark would be a tree that asked for nothing all
   * morning.
   */
  private treeGlow?: Phaser.GameObjects.Image;
  private city!: CityLayout;
  private observatory: Observatory | null = null;
  private harbourFront: HarbourLayout | null = null;
  private worldPixelWidth = 0;
  private worldPixelHeight = 0;
  // Everything drawn outdoors and everything drawn indoors, so entering a
  // building is one setVisible on each rather than hunting down every sprite
  // and chunk texture that happens to exist.
  private worldLayer!: Phaser.GameObjects.Layer;
  private interiorLayer!: Phaser.GameObjects.Layer;

  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private playerGlow!: Phaser.GameObjects.Image;
  /** Every lamp burning in the world, so the dark can be cut back around them. */
  private readonly lamps = new Map<string, GridPoint>();
  /**
   * A halo per lamp, keyed by its tile.
   *
   * Keyed rather than kept in a list beside `lamps`: the first version pushed
   * and popped, so picking up one lamp of two put out the *last* one placed
   * instead of the one in your hand.
   */
  private readonly lampGlows = new Map<string, Phaser.GameObjects.Image>();
  /**
   * The halo over a fireplace, while the player is in a room that has one.
   *
   * Kept apart from `lampGlows` rather than filed as a lamp at a tile. The
   * lamps are a fact about the world — the astronomer counts them, the
   * player carries them about — and a hearth is a fact about a picture that
   * is on screen for as long as somebody is standing in it.
   */
  private hearthGlow?: Phaser.GameObjects.Image;
  /** Which cell it is over, or null in a room with no fire. */
  private hearth: GridPoint | null = null;
  /**
   * The lamps, tubes and orbs in whatever room is on screen.
   *
   * Beside the hearth rather than in with it, because the hearth's flicker
   * comes from the room's own animation frame and these have no frames to
   * read — the generator draws them still and the movement is here. Made
   * with the room and destroyed with it, like the hearth.
   */
  private roomGlows: { light: RoomLight; glow: Phaser.GameObjects.Image }[] = [];
  private npcs: NpcRuntime[] = [];
  /**
   * The village's chickens, ducks, cats and rabbits.
   *
   * A list of their own rather than more entries in `npcs`, because the two
   * differ in what a tap on them means: a person talks, and an animal is
   * hungry. Keeping them apart means every "who is near the player" check
   * does not have to remember to skip the poultry, and the thought bubble
   * has one list to follow.
   */
  private animals: AnimalRuntime[] = [];
  // Who the village put where, kept because an indoor NPC is not spawned
  // until the player walks into their building.
  private villageNpcs: readonly VillageNpcSpec[] = [];
  private attendant: Phaser.GameObjects.Sprite | null = null;
  /** The tower's wall map, while the player is in the tower. */
  private wallMap: Phaser.GameObjects.Image | null = null;
  private attendantCell: GridPoint | null = null;
  // Whose room this is: the dev hook reports them by name, and a hard-coded
  // "shopkeeper" answered for the teacher the day there were two of them.
  private attendantId: string | null = null;
  // A second camera at zoom 1 for anything measured in screen pixels. Camera
  // zoom scales scrollFactor(0) objects too, so without this the HUD and the
  // joystick would be magnified along with the world and a "64px" button
  // would not be 64px on screen.
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;
  private edgeAnchored: EdgeAnchored[] = [];

  constructor() {
    super("game");
  }

  /**
   * Which child is playing, handed over by the who's-playing screen.
   *
   * A fallback profile is minted when there is none, which happens only when
   * a script jumps straight to this scene. It is deliberately not saved: an
   * anonymous player who appeared on the who's-playing screen the next
   * morning would be a child nobody made.
   */
  init(data: { profile?: Profile } | undefined): void {
    this.profile =
      data?.profile ??
      createProfile(
        [],
        { name: "…", avatar: DEFAULT_AVATAR, language: Language.English, band: DEFAULT_BAND },
        0,
      );
    this.anonymous = !data?.profile;
  }

  create(): void {
    this.mobileControls = !this.sys.game.device.os.desktop;
    this.worldLayer = this.add.layer();
    this.interiorLayer = this.add.layer().setVisible(false);
    this.loadAssetMetadata();

    // The game that is open, which is a seed and a difference and everybody's
    // progress in it. One of several kept side by side — see save/games.ts.
    // Never nothing: a device that has never been played gets one made on
    // the spot, so a child's route through the game is title, who is
    // playing, garden, with nothing in the middle to choose.
    this.savedGame = openGame(browserStore(), Math.random(), Date.now());
    this.seed = this.savedGame.seed;
    // Their progress belongs to this game, and their name and face do not.
    // A child who has not opened this one before starts it from scratch
    // without losing who they are.
    if (!this.anonymous) this.profile = profileIn(this.savedGame, this.profile);
    const world = generateWorld(WORLD_SIZE, WORLD_SIZE, this.seed);
    this.grid = world.grid;
    this.worldGrid = world.grid;
    this.anchors = world.anchors;
    this.grove = world.grove;
    this.city = world.city;
    this.observatory = world.observatory;
    this.harbourFront = world.harbour;
    this.session = new GameSession({ grid: world.grid, start: world.playerStart });
    // What the generator made, remembered before the child's own world is
    // laid over it — the diff that gets saved is the difference between the
    // two, and after this line there is no other way to tell them apart.
    // What a crop is quoted at for this child. Set before anything reads a
    // price, because the shop's list, its coin pad and how many can be sold
    // at once all have to agree about it.
    this.session.cropPrice = bandAt(this.profile.band).cropPrice;
    this.baseline = worldBaseline(world.grid);
    this.restoreSavedWorld();
    const seed = this.dev.seed ?? Date.now() & 0x7fffffff;
    this.spellRng = createRng(seed);
    this.shopRng = createRng(seed ^ 0x5f37_1e2b);
    if (this.dev.coins > 0) this.session.purse.earn(this.dev.coins);
    if (this.dev.crops > 0) {
      for (const plant of PLANT_TYPES) this.inventory.add(plant, this.dev.crops);
    }

    const bounds = computeMapScreenBounds(this.grid.width, this.grid.height);
    this.originX = -bounds.minX;
    this.originY = -bounds.minY;
    const mapPixelWidth = bounds.maxX - bounds.minX;
    const mapPixelHeight = bounds.maxY - bounds.minY;
    this.worldPixelWidth = mapPixelWidth;
    this.worldPixelHeight = mapPixelHeight;

    // The child's own face: their body sheet, recoloured into a texture of
    // its own and registered under a character name like any of the cast, so
    // everything below here — walking, facing, gesturing — is the same code
    // that moves the shopkeeper.
    this.catalogue = avatarCatalogue(this);
    this.playerCharacter = this.useAvatar(
      this.catalogue ? usableAvatar(this.catalogue, this.profile.avatar) : this.profile.avatar,
    );

    // Before the sprite is built, so the camera starts where the player is
    // rather than gliding across half a world to catch up.
    if (this.dev.at && this.grid.inBounds(this.dev.at.col, this.dev.at.row)) {
      this.session.setPosition(this.dev.at.col, this.dev.at.row);
    }

    const start = this.toFeet(this.playerCol, this.playerRow);
    this.player = this.add
      .sprite(start.x, start.y, characterSheetKey(this.playerCharacter))
      // Anchored at the feet: that point is both where the character stands
      // and what they depth-sort on, so there is only one number to keep
      // right as they walk.
      .setOrigin(0.5, 1)
      .setDepth(start.y);

    this.cameras.main.setBounds(0, 0, mapPixelWidth, mapPixelHeight);
    this.cameras.main.setZoom(CAMERA_ZOOM);
    this.cameras.main.startFollow(this.player);
    this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    // Added after the world camera, so it draws over it; depth still orders
    // things within it.
    this.uiCamera.setScroll(0, 0);
    this.world(this.player);
    this.refreshVisibleChunks();

    // Every static thing the generator placed: the village's buildings and
    // well, and the hundreds of trees and boulders walling the world's two
    // high edges.
    // Before anything is spawned: the village's own lamp posts ask for their
    // halo as they appear, and an image made against a texture that does not
    // exist yet gets Phaser's missing-texture placeholder — a lime green box,
    // drawn additively, several tiles across.
    this.makeLightMask();
    // Everything except the scenery, which comes and goes with the chunk it
    // stands on — see `sceneryByChunk`.
    this.bucketScenery(this.grid.listObjects());
    this.spawnPlacedObjects(
      this.grid.listObjects().filter((object) => sceneryKind(object.type) === null),
    );
    // Anything this child had already planted. Their fences came back with
    // the line above — objects are spawned from the grid — but a crop is
    // drawn as a sprite of its own, and one that exists only in the grid is
    // a carrot every rule agrees is there and nobody can see.
    for (const [col, row, crop] of this.grid.listCrops()) this.spawnCropSprite(col, row, crop);
    // Everybody in the world, not only the village's. The city and the
    // harbour keep their own lists and this is where the three meet: the
    // spawner sorts the indoor ones from the outdoor ones by itself, and
    // `homeBuildingId` is what puts a shopkeeper behind the right counter.
    this.villageNpcs = [...world.village.npcs, ...world.city.npcs, ...(world.harbour?.npcs ?? [])];
    this.spawnAnimals(
      world.village.well,
      world.village.buildings,
      createRng(this.seed ^ 0x0a11_4a15),
    );
    this.spawnNpcs(this.villageNpcs, world.anchors.village);

    // The marker the array spell draws on the ground. In the world rather
    // than on the screen — it is over a patch of earth, and it has to slide
    // with it when the camera moves — and under everything that stands on
    // that earth, so a marked crop is still a crop you can see.
    this.patchInk = this.world(this.add.graphics().setDepth(0).setVisible(false));
    // The square she is pointing at. In the world layer with the patch
    // marker and for the same reason: it is over a piece of ground and has
    // to slide with it.
    this.aimInk = this.world(this.add.graphics().setDepth(0));

    // The empty lamp posts on the climb, for the same reason and in the same
    // layer: a socket a lamp is standing in must be drawn under the lamp.
    this.socketInk = this.world(this.add.graphics().setDepth(0));
    this.paintSockets();

    this.nightOverlay = this.ui(
      this.add
        .rectangle(0, 0, this.scale.width, this.scale.height, NIGHT_TINT_COLOR, 0)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(NIGHT_TINT_DEPTH),
    );
    // The light the player carries, over the tint rather than cut out of it.
    this.playerGlow = this.ui(
      this.add
        .image(0, 0, LIGHT_TEXTURE)
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(NIGHT_TINT_DEPTH + 1)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(PLAYER_GLOW_COLOR)
        .setVisible(false),
    );

    const uiIndex = this.cache.json.get(UI_SIDECAR_KEY) as UiIndex | undefined;
    if (!uiIndex) throw new Error("ui.json did not load — the spell parchment has no art");
    // ?lang= is for scripts: it overrides the language for this run without
    // touching what the player saved.
    this.settings = settingsWithOverrides(
      { language: this.profile.language },
      {
        language: this.dev.language,
      },
    );
    this.words = phrasesFor(this.settings.language);
    // Written once already, before there was a language to write it in.

    this.spellPopup = new SpellPopup(this, uiIndex, MODAL_DEPTH, this.words, (object) =>
      this.ui(object),
    );
    this.shopPanel = new ShopPanel(
      this,
      uiIndex,
      MODAL_DEPTH,
      this.inventory,
      this.purse,
      this.words,
      this.shopRng,
      (object) => this.ui(object),
    );
    // The panel runs the counting; the ledger is still the session's.
    this.shopPanel.onBuy = (fixture, count) => {
      this.session.buy(fixture, count);
      this.refreshCarried();
    };
    this.shopPanel.onSell = (plant, count) => {
      this.session.sell(plant, count);
      this.refreshCarried();
    };

    this.lessonPanel = new LessonPanel(this, uiIndex, MODAL_DEPTH, this.words, (object) =>
      this.ui(object),
    );
    this.mapPanel = new MapPanel(
      this,
      uiIndex,
      MODAL_DEPTH,
      this.words,
      world.grid,
      world.anchors,
      () => this.session.tile,
      (object) => this.ui(object),
    );
    this.picturePanel = new PicturePanel(this, uiIndex, MODAL_DEPTH, (object) => this.ui(object));
    this.taskPanel = new TaskPanel(
      this,
      uiIndex,
      MODAL_DEPTH,
      (object) => this.ui(object),
      LAMP_POSTS,
    );
    this.geometryPanel = new GeometryLessonPanel(this, uiIndex, MODAL_DEPTH, this.words, (object) =>
      this.ui(object),
    );
    this.grovePanel = new GroveLessonPanel(this, uiIndex, MODAL_DEPTH, this.words, (object) =>
      this.ui(object),
    );
    this.arrayPopup = new ArrayPopup(this, uiIndex, MODAL_DEPTH, this.words, (object) =>
      this.ui(object),
    );
    this.clockPopup = new ClockPopup(this, uiIndex, MODAL_DEPTH, this.words, (object) =>
      this.ui(object),
    );
    this.patchMenu = new PatchMenu<PatchAction>(this, TOUCH_UI_DEPTH, (object) => this.ui(object));
    this.portalPanel = new PortalPanel(
      this,
      uiIndex,
      MODAL_DEPTH,
      this.words,
      world.grid,
      world.anchors,
      (object) => this.ui(object),
    );
    this.introPanel = new IntroPanel(this, uiIndex, MODAL_DEPTH, this.words, (object) =>
      this.ui(object),
    );
    // He walks it over the first time, and after that only if asked. ?intro
    // asks for it again without clearing the saved settings.
    this.introToGive = !this.profile.introSeen || this.dev.intro;
    this.optionsPanel = new OptionsPanel(
      this,
      uiIndex,
      MODAL_DEPTH,
      this.settings,
      this.words,
      (object) => this.ui(object),
    );
    this.optionsPanel.onChange = (next) => this.applySettings(next);
    this.optionsPanel.onOpenGame = (id) => this.openAnotherGame(id);
    this.optionsPanel.onDeleteGame = (id) => this.throwGameAway(id);
    this.treeGlow = this.newGlow(TREE_GLOW_COLOR);
    this.checkGrove();
    this.aboutPanel = new AboutPanel(this, uiIndex, MODAL_DEPTH + 2, this.words, (object) =>
      this.ui(object),
    );
    // Over the options rather than instead of them: it was opened from there
    // and closing it should put you back where you were.
    this.optionsPanel.onAbout = () => this.aboutPanel?.show(() => {});
    this.optionsPanel.onBandChange = (band) => this.applyBand(band);
    this.optionsPanel.setBand(this.profile.band);
    this.optionsPanel.setGames(listGames(browserStore()), playingId(browserStore()));
    this.applyCropPrice();
    this.applyRung();
    this.createOptionsButton();
    // The coin line is written whenever money moves, and money starting in
    // the purse is not money moving: ?coins= showed nothing until the first
    // trade, and a saved purse would have done the same.

    this.setupInput();
    this.createActionBar();
    exposeForTests({
      session: this.session,
      ui: () => this.uiPositions(),
      armed: () => this.armed,
      grove: () => ({ col: this.grove.doorstep.col, row: this.grove.doorstep.row }),
      stats: () => ({
        fps: Math.round(this.game.loop.actualFps),
        frames: this.frameCounter,
        renderer: this.game.renderer.type === Phaser.WEBGL ? "webgl" : "canvas",
        objects: this.children.list.length,
        // Everything Phaser calls preUpdate on every frame, which is where a
        // wood of animating trees is actually paid for.
        updating: this.sys.updateList.length,
        view: { width: this.scale.width, height: this.scale.height },
      }),
      hearth: () => {
        const glow = this.hearthGlow;
        const at = this.hearth;
        if (!glow || !at || !glow.visible) return null;
        return { col: at.col, row: at.row, alpha: glow.alpha };
      },
      doors: () =>
        Object.fromEntries(this.buildings.map((b) => [b.id, { col: b.doorCol, row: b.doorRow }])),
      screenOf: (col, row) => this.screenOf(col, row),
      spell: () => {
        const cast = this.spellPopup?.cast;
        if (!cast) return null;
        return {
          start: cast.problem.start,
          addend: movedBy(cast.problem),
          stops: cast.problem.stops,
          index: cast.index,
        };
      },
      scenery: () => [...this.liveScenery.values()].reduce((n, list) => n + list.length, 0),
      sceneryOnScreen: () => {
        const view = this.cameras.main.worldView;
        const inside = (object: PlacedObject) => {
          const feet = this.toFeet(object.col, object.row);
          return (
            feet.x >= view.x &&
            feet.x <= view.x + view.width &&
            feet.y >= view.y &&
            feet.y <= view.y + view.height
          );
        };
        let inView = 0;
        for (const bucket of this.sceneryByChunk.values()) {
          for (const object of bucket) if (inside(object)) inView++;
        }
        let live = 0;
        for (const [key, sprites] of this.liveScenery) {
          const bucket = this.sceneryByChunk.get(key) ?? [];
          void sprites;
          for (const object of bucket) if (inside(object)) live++;
        }
        return { inView, live };
      },
      array: () => {
        const cast = this.arrayPopup?.cast;
        if (!cast) return null;
        return {
          rows: cast.problem.rows,
          columns: cast.problem.columns,
          answer: cast.problem.rows * cast.problem.columns,
          entry: cast.entry,
          done: cast.done,
        };
      },
      /**
       * The tint over the world right now: the time of day, the wood's own
       * dusk, and what the two come to.
       *
       * A seam rather than an API, and the one the dusk needs: the only
       * other way to check it is to sample a screenshot, and every glow in
       * the grove lightens the very pixels a sample would land on.
       */
      shade: () => ({
        dusk: this.dusk,
        night: nightTintAlpha(this.dev.hour ?? timeOfDay(new Date())),
        alpha: this.nightOverlay?.fillAlpha ?? 0,
      }),
      clock: () => {
        const cast = this.clockPopup?.cast;
        if (!cast) return null;
        return {
          left: cast.problem.left,
          back: cast.problem.back,
          hours: cast.problem.hours,
          entry: cast.entry,
          done: cast.done,
        };
      },
      lamps: () => {
        const observatory = this.observatory;
        if (!observatory) return null;
        return {
          posts: observatory.posts.map((at) => ({ col: at.col, row: at.row })),
          lit: lampsLit(this.worldGrid, observatory),
        };
      },
      animals: () =>
        this.animals.map((animal) => ({
          id: animal.id,
          kind: animal.kind,
          col: animal.col,
          row: animal.row,
          craves: animal.craves,
          mood: animal.mood,
          bubble: animal.bubble !== undefined,
        })),
      portalMarks: () => this.portalPanel?.marks() ?? {},
      portal: () => {
        const journey = this.portalPanel?.journey;
        if (!journey) return null;
        return {
          place: journey.place,
          league: journey.league,
          tier: journey.rung.tier,
          across: journey.across.marks,
          down: journey.down.marks,
          answer: journey.answer,
          reached: this.profile.reached,
        };
      },
      npcs: () => {
        const where: Record<string, { col: number; row: number }> = {};
        for (const npc of this.npcs) where[npc.id] = { col: npc.col, row: npc.row };
        if (this.attendantCell && this.attendantId) {
          where[this.attendantId] = { ...this.attendantCell };
        }
        return where;
      },
    });
    if (this.mobileControls) this.createTouchControls();
    this.layoutForViewport();

    // The viewport changes on rotation and on any desktop window resize, and
    // every screen-space thing here is positioned from its size.
    // Every few seconds, and again the moment the tab goes away. Children
    // do not close a game, they close a lid or swap to something else — so
    // the save that matters most is the one taken when the page is hidden,
    // and the timer is what covers a browser that never gets to fire it.
    this.time.addEvent({ delay: AUTOSAVE_MS, loop: true, callback: () => this.autosave() });
    const flush = () => this.autosave();
    document.addEventListener("visibilitychange", flush);
    globalThis.addEventListener("pagehide", flush);

    // A rebuilt world used to announce itself along the top of the screen.
    // Nothing draws it now and nothing should: it is a sentence about a save
    // file, addressed to somebody who can read, about a thing a child cannot
    // act on. The world being different is the whole of what they can see,
    // and it is also the whole of what happened.

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layoutForViewport, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      // One last write on the way out, before the listeners that would have
      // taken it are removed.
      this.autosave();
      document.removeEventListener("visibilitychange", flush);
      globalThis.removeEventListener("pagehide", flush);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layoutForViewport, this);
      // The popup listens on the keyboard while it is open, and a listener
      // outliving its scene fires into a destroyed display list.
      this.spellPopup.destroy();
      this.portalPanel?.destroy();
      this.shopPanel.destroy();
      this.optionsPanel?.destroy();
      this.aboutPanel?.destroy();
      this.lessonPanel?.destroy();
      this.introPanel?.destroy();
      this.mapPanel?.destroy();
    });

    // The shop's coin pad takes a coin back on right-click, so the browser's
    // own menu must not open over the parchment when it is used.
    this.input.mouse?.disableContextMenu();

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer, over: unknown[]) => {
      // The popup's backdrop covers the screen and is interactive, so `over`
      // is already non-empty while it is open. Checking anyway: a modal that
      // is only modal because of depth ordering stops being one the first
      // time something is drawn above it.
      if (this.modalOpen) return;
      // The array spell owns the pointer while it is armed: a tap marks a
      // corner instead of steering, walking, or being answered by whatever
      // happens to be standing on the tile.
      //
      // Checked before the *world* under the pointer and after the
      // *interface* over it, and that split is the whole of it. A crop, a
      // fence or a villager makes `over` non-empty, so a plain `over.length`
      // check meant the marker never saw a tap on any square with something
      // on it — which is most of the squares anybody wants to mark out. The
      // spell's own menu is interface, and has to keep its taps.
      if (this.marking && !this.tappedTheInterface(over)) {
        this.markPatchAt(pointer.worldX, pointer.worldY);
        return;
      }
      // A lit rune owns the pointer for exactly the same reasons, and this
      // is the branch that makes the whole thing work on a tablet: below,
      // touch gives every press to the joystick and never reaches
      // `handleTileClick` at all. Checked before the world under the pointer
      // so a crop or a tree — which is to say, the only squares either of
      // these two spells is ever aimed at — cannot swallow the answer.
      if (this.armed && !this.tappedTheInterface(over)) {
        this.castArmedAt(pointer.worldX, pointer.worldY);
        return;
      }
      if (over.length > 0) return; // a UI button handles its own pointerdown
      // Touch steers with the floating joystick; a mouse walks to the tile it
      // clicked. Deliberately not both on touch: a press cannot be a stick
      // and a destination at once, and the stick is the one you can hold.
      if (this.joystick) this.joystick.begin(pointer);
      else this.handleTileClick(pointer.worldX, pointer.worldY);
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      this.joystick?.move(pointer);
    });
    // pointerupoutside fires when the finger leaves the canvas still held —
    // without it the stick would stay stuck on and the player walk forever.
    for (const event of ["pointerup", "pointerupoutside"]) {
      this.input.on(event, (pointer: Phaser.Input.Pointer) => {
        this.joystick?.end(pointer);
      });
    }
  }

  override update(time: number): void {
    this.frameCounter++;
    const hour = this.dev.hour ?? timeOfDay(new Date());
    if (!this.interior) {
      this.refreshVisibleChunks();
      this.updateNpcs(isDaytime(hour));
      // Called from here rather than from inside `updateNpcs`, which returns
      // early on `?freezeNpcs` — and did so before it ever reached the
      // animals, so with that seam set their hunger clocks stopped as well as
      // their feet. Freezing a village for a screenshot should not stop time.
      this.updateAnimals(this.time.now);
      this.cullScenery();
      this.placeArmedRune();
      // The reach is drawn round wherever she is standing now, so it follows
      // her while she walks about choosing — the same reason the rune does.
      if (this.armed) this.paintAim();
      this.checkAim();
    }
    // The tint still applies indoors: it is the time of day, not the weather
    // outside a window.
    this.paintNight(nightTintAlpha(hour), this.settleDusk(time));
    // Every frame, now that there is no status line whose repaint used to
    // carry it: two setVisible calls, and it cannot fall out of step with
    // whether a panel is open.
    this.refreshOptionsButton();

    // Depth follows the sprite's own y, which is its feet — so it stays
    // correct part-way through a step rather than only at whole tiles.
    // Not while going through a portal: the traveller is held just in front
    // of the doorway's mouth for the crossing, and recomputing it from their
    // y would drop them behind it the moment they were lifted into it.
    if (!this.travelling) this.player.setDepth(this.player.y);
    this.playCharacterAnim(
      this.player,
      this.playerCharacter,
      this.playerFacing,
      this.isMoving,
      this.playerGesture,
    );
    for (const npc of [...this.npcs, ...this.animals]) {
      npc.sprite.setDepth(npc.sprite.y);
      this.playCharacterAnim(npc.sprite, npc.character, npc.facing, npc.isMoving);
    }
    if (!this.interior) this.updateDoors();

    // The world keeps running behind the parchment — smoke drifts, villagers
    // wander — but nothing the player presses reaches it. Every key below is
    // one the popup wants for itself (digits, Enter, Escape) or one that
    // would walk the player out from under an open spell.
    if (this.modalOpen) return;

    if (!this.isMoving) {
      const dir = this.pressedDirection();
      if (dir) {
        this.path = []; // manual input overrides an in-progress click path
        this.walk(dir.dCol, dir.dRow);
      } else if (this.path.length > 0) {
        const next = this.path.shift();
        if (next) this.tryMove(next.col - this.playerCol, next.row - this.playerRow);
      }
    }

    for (const [index, key] of this.plantKeys.entries()) {
      if (Phaser.Input.Keyboard.JustDown(key)) {
        this.selectedPlantIndex = index;
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.plantActionKey)) {
      this.tryPlant();
    }

    if (Phaser.Input.Keyboard.JustDown(this.spellbookKey)) this.toggleTray(this.spellTray);
    if (Phaser.Input.Keyboard.JustDown(this.seedPouchKey)) this.toggleTray(this.seedTray);
    if (Phaser.Input.Keyboard.JustDown(this.harvestKey)) this.tryHarvest();
  }

  // --- Cameras -----------------------------------------------------------
  //
  // `ignore` sets a filter flag on the object itself rather than adding it to
  // a list on the camera, so there is no bookkeeping to keep in sync and a
  // destroyed object needs no cleanup. Every object this scene creates has to
  // go through one of these two, or it renders twice — once magnified by the
  // world camera and once at 1:1 by the UI camera.

  /** Part of the world: drawn by the zoomed camera only. */
  private world<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.uiCamera.ignore(object);
    this.sceneryLayer().add(object);
    return object;
  }

  // Whichever layer is currently on screen. Entering a building hides one and
  // shows the other, so anything created after that point belongs to the new
  // one.
  private sceneryLayer(): Phaser.GameObjects.Layer {
    return this.interior ? this.interiorLayer : this.worldLayer;
  }

  // The player exists in both modes, so they move between the layers rather
  // than living in one. They cannot simply sit outside both: a Layer renders
  // as a unit at its own depth, so a player left on the scene's display list
  // would always draw over the buildings instead of sorting against them.
  private movePlayerToLayer(): void {
    this.worldLayer.remove(this.player);
    this.interiorLayer.remove(this.player);
    this.sceneryLayer().add(this.player);
  }

  /** Part of the interface: drawn at 1:1 by the UI camera only. */
  private ui<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.cameras.main.ignore(object);
    this.uiObjects.add(object);
    return object;
  }

  /**
   * Whether a tap landed on the interface rather than on the world.
   *
   * Needed because the array spell's marker has to take taps on ground that
   * has things standing on it — a crop, a fence, a villager — while still
   * letting the buttons of its own menu be pressed. Phaser hands the
   * handler everything under the pointer; this is what tells the two apart.
   *
   * A `WeakSet` filled by `ui()` rather than a flag on the object, because
   * `ui()` is already the one place every interface object goes through and
   * a second way of saying which is which would be a second thing to keep
   * true.
   */
  /**
   * Whether a spell is already waiting for the next tap on the world.
   *
   * Every sprite that answers a tap has to stand aside while one is: a crop
   * is the square the growth spell wants, a tree is the square the clearing
   * spell wants, and a sprite that harvested or was fed instead would be the
   * spell silently not firing. Named once rather than repeated, because it
   * was repeated at five call sites and the animals were missed.
   */
  private get pointerIsSpokenFor(): boolean {
    return this.marking !== null || this.armed !== null;
  }

  private tappedTheInterface(over: readonly unknown[]): boolean {
    return over.some((object) => this.uiObjects.has(object as Phaser.GameObjects.GameObject));
  }

  // Everything anchored to a screen edge, re-placed whenever the viewport
  // changes. Called once at setup and again on every resize.
  private layoutForViewport(): void {
    const { width, height } = this.scale;
    /**
     * The world camera has to be told, exactly like the interface one.
     *
     * Phaser resizes only those cameras whose size still matches the game's
     * *previous* size, and the manual `game.scale.resize` this game does on
     * an orientation change (see main.ts) does not reliably leave it looking
     * like one. So a phone turned sideways kept a portrait camera on a
     * landscape screen: the world drew into the old rectangle, everything
     * outside it was black, and the chunk spawner — which asks the camera
     * what it can see — never filled the rest in.
     */
    this.cameras.main.setSize(width, height);
    // The room's bounds are computed from the camera's own size, so a room
    // framed for a portrait screen is framed wrong the moment it is not one.
    if (this.interior) this.reframeInterior();
    this.uiCamera?.setSize(width, height);
    this.nightOverlay?.setSize(width, height);
    for (const button of this.edgeAnchored) button.place(width, height);
    // The popup can be open across a phone rotation, and every one of its
    // pieces is placed from the viewport's size.
    this.spellPopup?.layout();
    this.portalPanel?.layout();
    this.geometryPanel?.layout();
    this.shopPanel?.layout();
    this.optionsPanel?.layout();
    this.aboutPanel?.layout();
    this.lessonPanel?.layout();
    this.introPanel?.layout();
    this.mapPanel?.layout();
    this.picturePanel?.layout();
    this.taskPanel?.layout();
    this.layoutHud();
  }

  /**
   * A soft disc, built once and used as the shape of every light.
   *
   * Concentric circles rather than a gradient fill, because Phaser's shapes
   * have no radial gradient and this is the cheapest thing that reads as
   * one: thirty-two rings is smooth enough that nothing bands at this size.
   */
  private makeLightMask(): void {
    if (this.textures.exists(LIGHT_TEXTURE)) return;
    const size = LIGHT_TEXTURE_RADIUS * 2;
    const paint = this.make.graphics({ x: 0, y: 0 }, false);
    for (let ring = LIGHT_RINGS; ring > 0; ring--) {
      const t = ring / LIGHT_RINGS;
      // Squared falloff: light thins out fast at the edge, which is what
      // stops the hole reading as a spotlight with a hard rim.
      paint.fillStyle(0xffffff, (1 - t) ** 2 * 0.14 + 0.02);
      paint.fillCircle(LIGHT_TEXTURE_RADIUS, LIGHT_TEXTURE_RADIUS, LIGHT_TEXTURE_RADIUS * t);
    }
    paint.generateTexture(LIGHT_TEXTURE, size, size);
    paint.destroy();
  }

  /**
   * Lay the night over the world, and the lights over the night.
   *
   * The lights are drawn *additively on top of* the tint rather than erased
   * out of it. Erasing is what this wants to mean — a lamp should take the
   * dark away — and a render texture can do exactly that, which is how it
   * was written first. That also went wrong in a way worth recording: with
   * `fill` and `erase` both running every frame, the sheet came out blank
   * within a few seconds and night simply stopped happening as the player
   * walked. Adding warm light to a cold sheet reads the same to the eye,
   * costs one sprite per source, and cannot get out of step with itself.
   */
  /**
   * How much of the old wood's own dusk is over the player, eased.
   *
   * The wood is never fully light. `duskOver` already softens the boundary
   * across the ground, and this softens it across *time* — which is the one
   * case the spatial ramp cannot cover, because a portal sets you down in
   * the middle of the wood with no walk in. Without it, arriving would snap
   * the whole screen a third darker in a single frame.
   */
  private settleDusk(time: number): number {
    // Measured off the frame's own timestamp rather than off Phaser's
    // `delta`, which is smoothed toward the target frame time and clamped:
    // in the wood, where the frame rate is a third of the target, `delta`
    // still reports about sixteen milliseconds, and the crossfade took the
    // best part of three seconds instead of the nine-tenths written above.
    // Measured in the browser: 2,888 ms before, 880 ms after.
    const since = this.duskAt === null ? 0 : Math.min(200, time - this.duskAt);
    this.duskAt = time;
    const wanted = this.interior ? 0 : duskOver(this.anchors.enchantedForest, this.session.tile);
    const step = since / DUSK_FADE_MS;
    // Signed and clamped to the target rather than eased toward it: a linear
    // step takes exactly DUSK_FADE_MS to cross the whole range whatever the
    // frame rate, which is what the constant claims and what a crossfade
    // has to be to be worth writing down.
    if (wanted > this.dusk) this.dusk = Math.min(wanted, this.dusk + step);
    else this.dusk = Math.max(wanted, this.dusk - step);
    return this.dusk;
  }

  /**
   * Lay the time of day over the world, and the old wood's dusk under it.
   *
   * A floor rather than a second overlay: two tinted rectangles multiply
   * into a colour neither of them is, and at noon in the grove that came out
   * as a blue wash rather than as shade. One tint, taking whichever of the
   * two is deeper, and its *colour* leaning green as the dusk rises — night
   * in a wood is not the same colour as night over a field.
   *
   * Everything that glows reads its strength off the result, so the grove's
   * mushrooms are lit at noon. That is the whole point of them.
   */
  private paintNight(nightAlpha: number, dusk: number): void {
    const alpha = Math.max(nightAlpha, GROVE_DUSK_ALPHA * dusk);
    // Hidden rather than merely transparent. A rectangle at alpha zero is
    // still a screen-sized quad handed to the renderer every frame, and by
    // day there are two thirds of a day's worth of them.
    this.nightOverlay?.setFillStyle(mixTint(dusk), alpha).setVisible(alpha > 0);
    const strength = alpha / MAX_NIGHT_ALPHA;
    const player = this.playerGlow;
    player?.setVisible(alpha > 0);
    if (player && alpha > 0) {
      // From the sprite, not from the tile she is booked as standing on. A
      // step takes a couple of hundred milliseconds and the light was being
      // placed on whole tiles, so it jumped a tile at a time while she walked
      // smoothly underneath it. Same reasoning as the depth sort just below
      // the clock: follow the sprite's own position and it stays right
      // part-way through a step.
      const at = this.screenOfPoint(this.player.x, this.player.y - TILE_SIZE / 2);
      player
        .setPosition(at.x, at.y)
        .setDisplaySize(PLAYER_LIGHT_RADIUS * 2, PLAYER_LIGHT_RADIUS * 2)
        .setAlpha(strength * PLAYER_GLOW_ALPHA);
    }
    for (const [key, glow] of this.lampGlows) {
      const cell = this.lamps.get(key);
      glow.setVisible(cell !== undefined && alpha > 0);
      if (!cell || alpha <= 0) continue;
      const at = this.screenOf(cell.col, cell.row);
      glow
        .setPosition(at.x, at.y - TILE_SIZE)
        .setDisplaySize(LAMP_LIGHT_RADIUS * 2, LAMP_LIGHT_RADIUS * 2)
        .setAlpha(strength * LAMP_GLOW_ALPHA);
    }
    this.paintTree();
    this.paintHearth(strength);
    this.paintRoomLights(strength);
    this.paintWindows(strength);
  }

  /**
   * The great tree, breathing while it still wants something.
   *
   * Slower than anything else that pulses here — a fire flickers, an orb
   * breathes at two and a half seconds, and this takes four. It is a tree,
   * and it is asking rather than burning.
   *
   * Drawn over the crown rather than the trunk: the crown is the part of it
   * anybody looks at, and a glow at the foot would light the grass instead
   * of the tree.
   */
  private paintTree(): void {
    const glow = this.treeGlow;
    if (!glow) return;
    if (this.interior || this.groveDone) {
      glow.setVisible(false);
      return;
    }
    const at = this.screenOf(this.grove.tree.col + 1, this.grove.tree.row);
    glow
      .setVisible(true)
      .setPosition(at.x, at.y - TREE_GLOW_RISE)
      .setDisplaySize(TREE_LIGHT_RADIUS * 2, TREE_LIGHT_RADIUS * 2)
      .setAlpha(TREE_GLOW_ALPHA * lightBreath(this.time.now, TREE_BREATH_MS, TREE_BREATH));
  }

  /**
   * Whether the tree has what it asked for, cached between frames.
   *
   * `groveProgress` walks the thicket and every square of four beds, which
   * is nothing at all once and something to think about sixty times a
   * second. It changes only when the player clears wood or ripens a crop, so
   * it is recomputed when the world is touched rather than when it is drawn.
   */
  private groveDone = false;

  private checkGrove(): void {
    this.groveDone = groveProgress(this.worldGrid, this.grove).task === GroveTask.Done;
  }

  /**
   * The fire in a cottage, throwing light once the room goes dark.
   *
   * The room already had a fire — eight frames of it, burning at every hour
   * of the day — and at night it was the darkest thing in the room, while a
   * lamp on the plaza outside lit the ground round it. A fire that gives no
   * light is a picture of a fire.
   *
   * Half a tile up from the cell's feet, which puts it on the flame: the
   * hearth is set into the north wall, so the fire sits above the floor line
   * rather than on it. Measured off the room on screen rather than reasoned
   * about — it is the one number in here no test can check.
   *
   * The flicker comes from the room sprite's own frame, so the light moves
   * when the flame does. See `HEARTH_FLICKER`.
   */
  private paintHearth(strength: number): void {
    const glow = this.hearthGlow;
    if (!glow) return;
    const cell = this.hearth;
    glow.setVisible(cell !== null && strength > 0);
    if (!cell || strength <= 0) return;
    const at = this.screenOf(cell.col, cell.row);
    const frames = this.interior?.image.anims.currentAnim?.frames.length ?? 1;
    const index = this.interior?.image.anims.currentFrame?.index ?? 1;
    const phase = frames > 1 ? ((index - 1) % frames) / frames : 0;
    const flicker = 1 - (HEARTH_FLICKER * (1 - Math.cos(phase * Math.PI * 2))) / 2;
    glow
      .setPosition(at.x, at.y - TILE_SIZE)
      .setDisplaySize(HEARTH_LIGHT_RADIUS * 2, HEARTH_LIGHT_RADIUS * 2)
      .setAlpha(strength * HEARTH_GLOW_ALPHA * flicker);
  }

  /**
   * The lights in a house's windows, made once and kept.
   *
   * Buildings are spawned when the world is and never taken down again —
   * they are not chunked the way the scenery is — so these are made here and
   * there is nothing to tear down. The pane positions come out of the
   * sidecar: the generator drew the windows and is the only thing that knows
   * where they went, and a light nearly on a pane reads as a lamp shining at
   * a wall.
   *
   * **Only where somebody lives.** What decides it is whether the room
   * behind the door has a fireplace, which is the same question `lightHearth`
   * asks and therefore cannot fall out of step with it. That is also the
   * better reason: a window is lit because there is a fire behind it. The
   * barn stays dark, and so does the observatory, which would be a poor
   * place to have the lights on.
   */
  private windowsOf(
    sprite: BuildingSprite,
    sidecar: BuildingSidecar,
    origin: { x: number; y: number },
  ): BuildingRuntime["windows"] {
    const rects = sidecar.window_rects_px ?? [];
    if (rects.length === 0) return [];
    const room = this.interiorSidecars.get(interiorFor(sprite));
    if (!room || !hearthCell(room)) return [];
    return rects.map(([x, y, width, height]) => ({
      at: {
        x: this.originX + origin.x + x + width / 2,
        y: this.originY + origin.y + y + height / 2,
      },
      glow: this.ui(
        this.add
          .image(0, 0, LIGHT_TEXTURE)
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(NIGHT_TINT_DEPTH + 1)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(WINDOW_GLOW_COLOR)
          .setVisible(false),
      ),
    }));
  }

  /**
   * Light the village's windows as the evening comes on.
   *
   * Not all at once. Each house has its own moment in the dusk, stable per
   * world — a square of windows coming on together reads as a switch being
   * thrown rather than as evening — and every one of them is burning by the
   * time the night is fully down.
   *
   * Off-screen ones are hidden rather than placed: the glow does not scroll,
   * so a house behind the camera would otherwise put its light wherever its
   * world position happened to project to.
   */
  private paintWindows(darkness: number): void {
    const { width, height } = this.scale;
    const indoors = this.interior !== null;
    for (const building of this.buildings) {
      if (building.windows.length === 0) continue;
      const lit = indoors ? 0 : windowBrightness(darkness, building.lightsAt);
      for (const { at, glow } of building.windows) {
        if (lit <= 0) {
          glow.setVisible(false);
          continue;
        }
        const on = this.screenOfPoint(at.x, at.y);
        const near =
          on.x > -WINDOW_LIGHT_RADIUS &&
          on.y > -WINDOW_LIGHT_RADIUS &&
          on.x < width + WINDOW_LIGHT_RADIUS &&
          on.y < height + WINDOW_LIGHT_RADIUS;
        glow.setVisible(near);
        if (!near) continue;
        glow
          .setPosition(on.x, on.y)
          .setDisplaySize(WINDOW_LIGHT_RADIUS * 2, WINDOW_LIGHT_RADIUS * 2)
          .setAlpha(lit * WINDOW_GLOW_ALPHA);
      }
    }
  }

  /**
   * The lamps, tubes and orbs, once it is dark enough for them to matter.
   *
   * Same machinery as the hearth and the lamp posts — an additive halo over
   * the tint, growing with the darkness — and the differences between them
   * are the whole point: how big, how cold, and how much they move.
   *
   * The movement runs off the clock rather than off an animation frame,
   * because the generator draws all three still. That is deliberate: a lamp
   * that is on is a lamp that is on, and moving the *light* over an orb
   * instead of the orb costs nothing and keeps three of the seven rooms at a
   * single frame rather than eight nearly identical ones.
   *
   * Half a tile up from the cell's feet, as the hearth is: a lantern and a
   * tube are mounted on the north wall, and an orb floats.
   */
  private paintRoomLights(strength: number): void {
    if (this.roomGlows.length === 0) return;
    const now = this.time.now;
    for (const { light, glow } of this.roomGlows) {
      glow.setVisible(strength > 0);
      if (strength <= 0) continue;
      const how = ROOM_LIGHTS[light.kind];
      if (!how) continue;
      const breath = lightBreath(now, how.period, how.move);
      const at = this.screenOf(light.cell.col, light.cell.row);
      glow
        .setPosition(at.x, at.y - TILE_SIZE)
        .setDisplaySize(how.radius * 2, how.radius * 2)
        .setAlpha(strength * how.alpha * breath);
    }
  }

  /**
   * Light whatever the room is lit by: a fire, lanterns, tubes, or orbs.
   *
   * Read off the room's furniture, so a room the generator relights needs
   * nothing here — and a kind this game has not learned yet is dropped by
   * `roomLights` rather than drawn in some default colour.
   */
  private lightHearth(sidecar: InteriorSidecar): void {
    this.snuffHearth();
    for (const light of roomLights(sidecar)) {
      if (light.kind === LightKind.Fire) {
        this.hearth = light.cell;
        this.hearthGlow = this.newGlow(HEARTH_GLOW_COLOR);
        continue;
      }
      const how = ROOM_LIGHTS[light.kind];
      if (!how) continue;
      this.roomGlows.push({ light, glow: this.newGlow(how.color) });
    }
  }

  /** One halo, additive over the night tint and hidden until there is one. */
  private newGlow(color: number): Phaser.GameObjects.Image {
    return this.ui(
      this.add
        .image(0, 0, LIGHT_TEXTURE)
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(NIGHT_TINT_DEPTH + 1)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(color)
        .setVisible(false),
    );
  }

  /**
   * And put it out on the way out of the door.
   *
   * Called wherever the room sprite is torn down rather than from a handler
   * of its own: the glow does not scroll and is placed from `screenOf`, so
   * one left behind would be a patch of firelight hanging in the middle of
   * the screen over open country.
   */
  private snuffHearth(): void {
    this.hearthGlow?.destroy();
    this.hearthGlow = undefined;
    this.hearth = null;
    for (const { glow } of this.roomGlows) glow.destroy();
    this.roomGlows = [];
  }

  /** Remember a lamp, and give it the halo that says it is lit. */
  private lightLamp(col: number, row: number): void {
    const key = tileKey(col, row);
    if (this.lampGlows.has(key)) return;
    this.lamps.set(key, { col, row });
    this.lampGlows.set(
      key,
      this.ui(
        this.add
          .image(0, 0, LIGHT_TEXTURE)
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(NIGHT_TINT_DEPTH + 1)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(LAMP_GLOW_COLOR)
          .setVisible(false),
      ),
    );
  }

  /** A lamp picked back up stops burning, and its halo goes with it. */
  private snuffLamp(col: number, row: number): void {
    const key = tileKey(col, row);
    if (!this.lamps.delete(key)) return;
    this.lampGlows.get(key)?.destroy();
    this.lampGlows.delete(key);
  }

  /**
   * Place what is left of the HUD, which is one button.
   *
   * There was a caption once — key hints, "you are carrying three carrots",
   * the name of the panel you had open — and then there was one line saying
   * whatever had just happened. Both are gone, and the second went for the
   * reason the first did, only more so: it was an interface explaining an
   * interface, in a typeface too small to read at arm's length, to children
   * the youngest of whom cannot read at all.
   *
   * Nothing replaced it in this corner. What it used to say is said on the
   * square it is about, over the head of whoever is asking, or on a sheet of
   * parchment held up close — see `report`.
   */
  private layoutHud(): void {
    this.placeOptionsButton();
  }

  // --- Asset metadata ----------------------------------------------------

  // Everything the renderer needs to know about the art is read from the art
  // itself: variation counts from the atlas's frame names, footprints and
  // draw offsets from each building's sidecar. Nothing about the generator's
  // output is restated as a constant here.
  private loadAssetMetadata(): void {
    const texture = this.textures.get(TERRAIN_ATLAS_KEY);
    this.terrainVariations = buildVariationIndex(texture.getFrameNames());
    if (this.terrainVariations.size === 0) {
      throw new Error(`terrain atlas "${TERRAIN_ATLAS_KEY}" loaded no frames`);
    }
    const cliffs = this.textures.get(CLIFF_ATLAS_KEY);
    this.cliffVariations = buildVariationIndex(cliffs.getFrameNames());
    if (this.cliffVariations.size === 0) {
      throw new Error(`cliff atlas "${CLIFF_ATLAS_KEY}" loaded no frames`);
    }

    for (const sprite of BUILDING_SPRITES) {
      const sidecar = this.cache.json.get(sidecarKey(sprite)) as BuildingSidecar | undefined;
      if (!sidecar) throw new Error(`missing sidecar for building "${sprite}"`);
      this.buildingSidecars.set(sprite, sidecar);
      // One looping smoke animation per door position, built from the ranges
      // the sidecar names — so the door opens by switching animation, and
      // the smoke keeps drifting either way.
      this.registerBuildingAnimsFor(sprite, sprite, sidecar);
    }

    this.registerCharacterAnims();
    this.registerInteriorAnims();
    this.registerPlantAnims();
    this.registerFixtureAnims();
    this.registerSceneryAnims();
    this.registerLandmarkAnims();
    this.readDecking();
    this.registerEffectAnims();
  }

  // Spell effects. Unlike every other animation registered here these do not
  // repeat: `loops` comes from the sidecar rather than being decided in this
  // file, because whether something is a loop or a gesture is a property of
  // how it was drawn.
  private registerEffectAnims(): void {
    for (const effect of EFFECT_TYPES) {
      const sidecar = this.cache.json.get(effectSidecarKey(effect)) as EffectSidecar | undefined;
      if (!sidecar) throw new Error(`missing sidecar for effect "${effect}"`);
      for (const [name, range] of Object.entries(sidecar.animations)) {
        const key = `effect-${effect}-${name}`;
        if (this.anims.exists(key)) continue;
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(effectSheetKey(effect), {
            start: range.start,
            end: range.end,
          }),
          frameRate: EFFECT_FPS,
          repeat: sidecar.loops ? -1 : 0,
        });
      }
    }
  }

  private registerSceneryAnims(): void {
    for (const kind of SCENERY_KINDS) {
      const sidecar = this.cache.json.get(scenerySidecarKey(kind)) as ObjectSidecar | undefined;
      if (!sidecar) throw new Error(`missing sidecar for scenery "${kind}"`);
      this.scenerySidecars.set(kind, sidecar);
      // One animation per individual, from the ranges the sidecar names.
      for (const [name, range] of Object.entries(sidecar.animations)) {
        const instance = Number(name.replace(/^instance_/, ""));
        if (!Number.isInteger(instance)) continue;
        const key = sceneryAnimKey(kind, instance);
        if (this.anims.exists(key)) continue;
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(scenerySheetKey(kind), {
            start: range.start,
            end: range.end,
          }),
          frameRate: SCENERY_ANIM_FPS,
          repeat: -1,
        });
      }
    }
  }

  /**
   * The sway of the one big thing in a place.
   *
   * Slower than the wood around it — a crown that size does not move at a
   * sapling's rate, and matching them would make the grove read as one
   * animation played at every scale at once.
   */
  /** How many planks there are to choose between. No animation: wood. */
  private readDecking(): void {
    const sidecar = this.cache.json.get(DECK_SIDECAR_KEY) as DeckSidecar | undefined;
    if (!sidecar) throw new Error("missing sidecar for the harbour's decking");
    this.deckVariations = Math.max(1, sidecar.variations);
  }

  private registerLandmarkAnims(): void {
    for (const landmark of LANDMARK_TYPES) {
      const sidecar = this.cache.json.get(landmarkSidecarKey(landmark)) as
        | LandmarkSidecar
        | undefined;
      if (!sidecar) throw new Error(`missing sidecar for landmark "${landmark}"`);
      this.landmarkSidecars.set(landmark, sidecar);
      const key = landmarkAnimKey(landmark);
      if (this.anims.exists(key)) continue;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(landmarkSheetKey(landmark), {
          start: 0,
          end: sidecar.frame_count - 1,
        }),
        frameRate: LANDMARK_ANIM_FPS,
        repeat: -1,
      });
    }
  }

  private registerFixtureAnims(): void {
    for (const fixture of FIXTURE_TYPES) {
      const sidecar = this.cache.json.get(fixtureSidecarKey(fixture)) as FixtureSidecar | undefined;
      if (!sidecar) throw new Error(`missing sidecar for fixture "${fixture}"`);
      this.fixtureSidecars.set(fixture, sidecar);
      const key = fixtureAnimKey(fixture);
      if (this.anims.exists(key)) continue;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(fixtureSheetKey(fixture), {
          start: 0,
          end: sidecar.frame_count - 1,
        }),
        frameRate: FIXTURE_ANIM_FPS,
        repeat: -1,
      });
    }
  }

  // One looping sway per growth stage, from the ranges the sidecar names.
  // Only the planted stage is reachable today (see PLANTED_STAGE), but the
  // others cost nothing to register and are what tending will switch to.
  private registerPlantAnims(): void {
    for (const plant of PLANT_TYPES) {
      const sidecar = this.cache.json.get(plantSidecarKey(plant)) as PlantSidecar | undefined;
      if (!sidecar) throw new Error(`missing sidecar for plant "${plant}"`);
      for (const [name, range] of Object.entries(sidecar.animations)) {
        const key = `plant-${plant}-${name}`;
        if (this.anims.exists(key)) continue;
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(plantSheetKey(plant), {
            start: range.start,
            end: range.end,
          }),
          frameRate: PLANT_SWAY_FPS,
          repeat: -1,
        });
      }
    }
  }

  private registerInteriorAnims(): void {
    for (const room of INTERIOR_ROOMS) {
      const sidecar = this.cache.json.get(interiorSidecarKey(room)) as InteriorSidecar | undefined;
      if (!sidecar) throw new Error(`missing sidecar for interior "${room}"`);
      this.interiorSidecars.set(room, sidecar);
      const frames = sidecar.sheet?.frame_count ?? 1;
      // Most rooms are a single still frame; only the ones with something
      // moving in them (a fire) ship more, so there is nothing to loop.
      if (frames < 2) continue;
      const key = interiorAnimKey(room);
      if (this.anims.exists(key)) continue;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(interiorSheetKey(room), {
          start: 0,
          end: frames - 1,
        }),
        frameRate: BUILDING_ANIM_FPS,
        repeat: -1,
      });
    }
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
  private registerBuildingAnimsFor(
    name: string,
    sprite: BuildingSprite,
    sidecar: BuildingSidecar,
  ): void {
    // One looping smoke animation per door position, built from the ranges
    // the sidecar names — so the door opens by switching animation, and the
    // smoke keeps drifting either way.
    for (const [animation, range] of Object.entries(sidecar.animations)) {
      const state = animation.replace(/^door_/, "") as DoorState;
      const key = buildingAnimKey(name, state);
      if (this.anims.exists(key)) continue;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(spriteSheetKey(name), {
          start: range.start,
          end: range.end,
        }),
        frameRate: BUILDING_ANIM_FPS,
        repeat: -1,
      });
    }
    void sprite;
  }

  /**
   * The sheet one particular house is drawn from.
   *
   * Four cottages stood in the square and all four were the same house. Each
   * now takes a roof from the set the art ships, chosen from its own id and
   * the world's seed — so the house with the blue roof is the house with the
   * blue roof on every load, which is what makes "meet me at the green one"
   * mean anything. See src/world/houses.ts.
   *
   * Falls back to the plain sheet whenever anything is missing, because a
   * village of identical houses is a far smaller failure than a village of
   * missing ones.
   */
  private houseSheetFor(object: PlacedObject, sprite: BuildingSprite): string {
    const sidecar = this.buildingSidecars.get(sprite);
    if (!varies(sprite)) return sprite;
    const options = (sidecar?.roof_options ?? []) as Ramp[];
    const shipped = rampOf((sidecar?.palette ?? {}) as Record<string, Rgb>, ROOF_SLOTS);
    const look = houseLook(object.id, this.seed, options.length);
    const wanted = options[look];
    if (look === 0 || !shipped || !wanted || !sidecar?.sheet) return sprite;

    const name = `${sprite}~${look}`;
    if (this.anims.exists(buildingAnimKey(name, DoorState.Closed))) return name;
    const painted = repaintedSheet(
      this,
      spriteSheetKey(sprite),
      spriteSheetKey(name),
      rampPlan(shipped, wanted),
      sidecar.sheet,
    );
    if (painted !== spriteSheetKey(name)) return sprite;
    this.registerBuildingAnimsFor(name, sprite, sidecar);
    return name;
  }

  // One Phaser animation per (character, animation, facing), built straight
  // from the frame ranges the sidecar names. Nothing here knows how many
  // frames a walk cycle has or which row it sits on — that is the sheet's
  // business, and reading it back is what keeps the two in step.
  private registerCharacterAnims(): void {
    for (const character of ALL_CHARACTERS) this.registerAnimsFor(character, character);
    // Animals go through exactly the same machinery: their sheets are laid
    // out the way a villager's is, so nothing about walking, facing or
    // depth-sorting has to learn that a chicken is not a person.
    for (const kind of ANIMAL_KINDS) {
      this.registerAnimsFor(animalSheetKey(kind), animalSidecarKey(kind), animalSheetKey(kind));
    }
  }

  /**
   * Make this child's sheet and give it its animations, in one act.
   *
   * The two used to be separate and it broke: the animations were registered
   * from `loadAssetMetadata`, forty lines before the recoloured character
   * had a name, so the guard that was meant to catch it compared against the
   * default and skipped. The recoloured sheet ended up with no animations at
   * all — every `play` named a key that did not exist, Phaser did nothing,
   * and the player stood on frame zero facing the camera however they
   * walked. Making the texture and registering its animations in one place
   * is what stops that being possible to get wrong again.
   */
  private useAvatar(avatar: AvatarStyle): string {
    const sidecar = this.cache.json.get(characterSidecarKey(avatar.body)) as
      | CharacterSidecar
      | undefined;
    if (!sidecar?.sheet) return avatar.body;
    const character = avatarTexture(this, this.catalogue, avatar, sidecar.sheet);
    // Skipped when the recolour fell back to the plain body sheet, whose
    // animations the cast loop has already built.
    if (!ALL_CHARACTERS.includes(character)) this.registerAnimsFor(character, avatar.body);
    return character;
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
  private registerAnimsFor(character: string, sidecarFrom: string, sheetKey?: string): void {
    const sidecar = this.cache.json.get(
      sheetKey ? sidecarFrom : characterSidecarKey(sidecarFrom),
    ) as CharacterSidecar | undefined;
    if (!sidecar) throw new Error(`missing sidecar for character "${sidecarFrom}"`);
    for (const [name, range] of Object.entries(sidecar.animations)) {
      const [animation, facing] = name.split("_");
      if (!animation || !facing) throw new Error(`${sidecarFrom}: odd animation name "${name}"`);
      if (!CHARACTER_ANIMATIONS.includes(animation)) continue;
      const key = characterAnimKey(character, animation, facing as Facing);
      if (this.anims.exists(key)) continue;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(sheetKey ?? characterSheetKey(character), {
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

  // Idle or walk, in whichever direction they last moved. Called every frame
  // rather than at each transition: `play` with ignoreIfPlaying means
  // re-asserting the current animation costs nothing, and it removes the
  // class of bug where a state change forgets to update the sprite.
  private playCharacterAnim(
    sprite: Phaser.GameObjects.Sprite,
    character: string,
    facing: Facing,
    moving: boolean,
    gesture: string | null = null,
  ): void {
    if (gesture) return; // a one-shot is playing; leave it to finish
    sprite.play(characterAnimKey(character, moving ? WALK : IDLE, facing), true);
  }

  /**
   * Play a one-shot gesture on the player, then hand the sprite back.
   *
   * Every frame `playCharacterAnim` re-asserts idle or walk, which is what
   * makes it impossible for a state change to forget the sprite — and what
   * makes a one-shot impossible without somewhere to record that one is
   * running. `playerGesture` is that record, and it is cleared on completion
   * rather than on a timer so it cannot drift out of step with the animation.
   */
  private playGesture(animation: string): void {
    this.playerGesture = animation;
    this.player.play(characterAnimKey(this.playerCharacter, animation, this.playerFacing));
    this.player.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.playerGesture = null;
    });
  }

  /**
   * Show a spell landing on a tile.
   *
   * Drawn a hair in front of whatever is on the tile — the crop it is being
   * added to — rather than behind it, and destroyed when the animation ends.
   * Nothing else in the scene creates sprites at runtime that are meant to go
   * away, so the cleanup is here rather than in a general sweep.
   */
  private playEffect(effect: EffectType, col: number, row: number): void {
    const feet = this.toFeet(col, row);
    const sprite = this.world(
      this.add
        .sprite(feet.x, feet.y, effectSheetKey(effect))
        .setOrigin(0.5, 1)
        .setDepth(feet.y + 0.5)
        .play(effectAnimKey(effect)),
    );
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite.destroy());
  }

  // --- Chunked terrain rendering ------------------------------------

  /**
   * Make sure the chunks under the camera exist.
   *
   * `around` overrides where it looks, and the portal is why: the camera
   * follows the player, so the frame in which somebody is set down two
   * hundred cells away still has the *old* view on it — and asking that view
   * for chunks paints the ground they just left while the screen shows where
   * they arrived. The one frame of black that came out of it was the most
   * expensive-looking bug in the game.
   */
  private refreshVisibleChunks(around?: ScreenPoint): void {
    const camera = this.cameras.main;
    const seen = { width: camera.width / camera.zoom, height: camera.height / camera.zoom };
    const view = around
      ? {
          x: around.x - seen.width / 2,
          y: around.y - seen.height / 2,
          width: seen.width,
          height: seen.height,
        }
      : camera.worldView;
    const minLocal = { x: view.x - this.originX, y: view.y - this.originY };
    const maxLocal = {
      x: view.x + view.width - this.originX,
      y: view.y + view.height - this.originY,
    };
    const corners = [
      screenToGrid(minLocal.x, minLocal.y),
      screenToGrid(maxLocal.x, minLocal.y),
      screenToGrid(minLocal.x, maxLocal.y),
      screenToGrid(maxLocal.x, maxLocal.y),
    ];
    const cols = corners.map((c) => c.col);
    const rows = corners.map((c) => c.row);
    const tiles = {
      minCol: Math.min(...cols),
      maxCol: Math.max(...cols),
      minRow: Math.min(...rows),
      maxRow: Math.max(...rows),
    };
    const visible = chunksCoveringTileRange(
      tiles,
      this.grid.width,
      this.grid.height,
      CHUNK_VIEW_MARGIN,
    );
    const visibleKeys = new Set(visible.map(chunkKey));
    // The same sum again with no ring round it: what the screen actually
    // covers. See SCENERY_VIEW_MARGIN.
    const onScreen = new Set(
      chunksCoveringTileRange(tiles, this.grid.width, this.grid.height, SCENERY_VIEW_MARGIN).map(
        chunkKey,
      ),
    );

    for (const chunk of visible) {
      const key = chunkKey(chunk);
      const entry = this.activeChunks.get(key);
      if (entry) {
        entry.texture.setVisible(true);
        entry.lastUsedAt = this.frameCounter;
      } else {
        this.activateChunk(chunk);
      }
      if (onScreen.has(key)) this.spawnSceneryIn(key);
    }

    for (const [key, entry] of this.activeChunks) {
      if (!visibleKeys.has(key)) entry.texture.setVisible(false);
    }

    // Scenery lives only while its chunk is on screen, and the terrain cache
    // outlives it by a long way. They are cached apart because they cost
    // different things: a chunk's ground is one texture, cheap to keep and
    // expensive to redraw, so sixty of them are held against panning back and
    // forth. Its trees are hundreds of animating sprites, cheap to remake and
    // expensive to keep — sixty chunks of *those* came to ten thousand
    // sprites after a few portal jumps, none of them on screen.
    for (const key of [...this.liveScenery.keys()]) {
      if (!onScreen.has(key)) this.despawnSceneryIn(key);
    }
    this.evictColdChunks(visibleKeys);
  }

  private activateChunk(chunk: ChunkCoord): void {
    const bounds = dualChunkScreenBounds(chunk);
    const minX = bounds.minX;
    const minY = bounds.minY;

    const texture = this.add.renderTexture(
      this.originX + minX,
      this.originY + minY,
      bounds.maxX - minX,
      bounds.maxY - minY,
    );
    texture.setOrigin(0, 0);
    texture.setDepth(CHUNK_DEPTH);
    this.world(texture);

    // Buildings are standalone animated Sprites with their own depth sort
    // (see spawnBuildings), not baked into this RenderTexture — a building
    // rises above and overhangs its own footprint, which a flat tile stamped
    // into a chunk can't express, and has to sort against the player and
    // NPCs walking around it, which a static baked texture can't either.
    //
    // Terrain is now one draw per dual tile, full stop. The atlas ships a
    // finished tile for every corner-terrain combination, so there is no
    // base layer, no priority pass and no per-terrain mask — what used to be
    // a stack of up to 8 semi-transparent draws per tile (with the
    // compositing subtleties that came with it) is a single opaque one.
    //
    // beginDraw/batchDrawFrame/endDraw wraps the whole chunk in one GPU
    // flush (not stamp(), which is draw() under the hood — a full flush per
    // call). Even at one draw per tile that is CHUNK_SIZE^2 of them, and
    // stamp()-per-tile previously measured as an effectively unrecoverable
    // hang under software-rendered WebGL; Phaser's own docs call this batch
    // API out for exactly "large numbers of objects."
    const range = dualTileRange(chunk);
    // The dual grid is only defined from DUAL_ORIGIN to one short of the
    // data grid's extent; a chunk at the world edge covers tiles past that,
    // which would draw a duplicate of the clamped edge outside the world.
    const minCol = Math.max(range.minCol, DUAL_ORIGIN);
    const minRow = Math.max(range.minRow, DUAL_ORIGIN);
    const maxCol = Math.min(range.maxCol, this.grid.width - 1);
    const maxRow = Math.min(range.maxRow, this.grid.height - 1);

    this.paintTiles(texture, { minCol, minRow, maxCol, maxRow }, minX, minY);

    this.activeChunks.set(chunkKey(chunk), { texture, lastUsedAt: this.frameCounter });
  }

  /**
   * Stamp a range of dual tiles into a texture.
   *
   * Pulled out of the chunk renderer because the portal wants the same
   * picture: a hole that showed anything other than what the ground actually
   * looks like there would be a lie about the place it is a hole into. One
   * loop, so the two can never disagree.
   *
   * `offsetX`/`offsetY` are the world pixel the texture's top-left sits at.
   */
  private paintTiles(
    texture: Phaser.GameObjects.RenderTexture,
    range: { minCol: number; minRow: number; maxCol: number; maxRow: number },
    offsetX: number,
    offsetY: number,
  ): void {
    texture.beginDraw();
    for (let dualRow = range.minRow; dualRow <= range.maxRow; dualRow++) {
      for (let dualCol = range.minCol; dualCol <= range.maxCol; dualCol++) {
        const corners = cornerTerrainsFor(this.grid, dualCol, dualRow);
        const p = gridToScreen(dualCol, dualRow);
        // A tile with a step in it is drawn from the cliff atlas instead of
        // the terrain one — the cliff tile *is* a complete tile, ground on
        // both sides included, so this is a choice of atlas rather than a
        // second layer over the first. Asked first and answered null for
        // almost every tile, since almost every tile is flat.
        const levels = cornerLevelsFor(this.grid, dualCol, dualRow);
        if (hasStep(levels)) {
          const cliff = cliffFrameFor(
            this.grid,
            corners,
            levels,
            dualCol,
            dualRow,
            this.cliffVariations,
          );
          if (cliff) {
            texture.batchDrawFrame(
              CLIFF_ATLAS_KEY,
              cliff,
              p.x + DUAL_OFFSET - offsetX,
              p.y + DUAL_OFFSET - offsetY,
            );
            continue;
          }
        }
        const frame = frameFor(corners, dualCol, dualRow, this.terrainVariations);
        if (!frame) continue;
        texture.batchDrawFrame(
          TERRAIN_ATLAS_KEY,
          frame,
          p.x + DUAL_OFFSET - offsetX,
          p.y + DUAL_OFFSET - offsetY,
        );
      }
    }
    // The planking, over the ground rather than blended into it — see
    // decking.ts for why it is not a terrain. Drawn on the *tile* grid
    // rather than the dual grid the terrain uses, because a plank covers one
    // whole cell rather than sitting on the corner between four of them, so
    // it takes no DUAL_OFFSET.
    //
    // The whole range is walked rather than a list of the harbour's planks:
    // `isBridged` is a set lookup and false for every cell in the world but
    // a few dozen, and a per-chunk plank list would be one more thing to
    // keep in step with a grid that is regenerated from its seed anyway.
    for (let row = range.minRow; row <= range.maxRow; row++) {
      for (let col = range.minCol; col <= range.maxCol; col++) {
        if (!this.grid.isBridged(col, row)) continue;
        const p = gridToScreen(col, row);
        texture.batchDrawFrame(
          DECK_SHEET_KEY,
          variationFor(col, row, this.deckVariations),
          p.x - offsetX,
          p.y - offsetY,
        );
      }
    }
    texture.endDraw();
  }

  /** Sort the world's scenery into the chunk each piece stands in, once. */
  private bucketScenery(objects: readonly PlacedObject[]): void {
    this.sceneryByChunk.clear();
    for (const object of objects) {
      if (sceneryKind(object.type) === null) continue;
      const key = chunkKey(dualTileToChunk(object.col, object.row));
      const bucket = this.sceneryByChunk.get(key);
      if (bucket) bucket.push(object);
      else this.sceneryByChunk.set(key, [object]);
    }
  }

  /** Put a chunk's trees and rocks on screen, if they are not already. */
  /**
   * Show the trees that are on screen and hide the rest.
   *
   * Phaser does not cull a plain display list. `willRender` asks whether an
   * object is visible and whether this camera is allowed to see it, and
   * nothing asks whether it is *anywhere near* the camera — so every sprite
   * on the list is transformed and written into the vertex buffer whether it
   * lands on the screen or a chunk away from it.
   *
   * Scenery is spawned a chunk at a time and a chunk is thirty-two tiles
   * square, so a screen forty tiles wide overlaps six of them: on a desktop
   * this was submitting the better part of two thousand quads to draw a few
   * dozen trees. A comparison against the view costs a subtraction each; the
   * quad it saves costs a great deal more.
   *
   * Generous by a tile on every side, because a tree is drawn taller than
   * the square it stands on and its feet are what is being tested.
   */
  private cullScenery(): void {
    const view = this.cameras.main.worldView;
    const left = view.x - SCENERY_CULL_MARGIN;
    const top = view.y - SCENERY_CULL_MARGIN;
    const right = view.x + view.width + SCENERY_CULL_MARGIN;
    const bottom = view.y + view.height + SCENERY_CULL_MARGIN;
    for (const [key, sprites] of this.liveScenery) {
      const bucket = this.sceneryByChunk.get(key);
      if (!bucket) continue;
      for (let at = 0; at < sprites.length; at++) {
        const sprite = sprites[at];
        const object = bucket[at];
        if (!sprite || !object) continue;
        const feet = this.toFeet(object.col, object.row);
        const seen = feet.x >= left && feet.x <= right && feet.y >= top && feet.y <= bottom;
        if (seen === sprite.visible) continue;
        sprite.setVisible(seen);
        // And stop it swaying while nobody is looking. A hidden sprite is
        // still on the update list and still runs its animation forward every
        // frame; paused, that call turns round at the door. Only on the
        // change, because pausing something already paused is the same work
        // this is trying to avoid.
        if (seen) sprite.anims.resume();
        else sprite.anims.pause();
      }
    }
  }

  private spawnSceneryIn(key: string): void {
    if (this.liveScenery.has(key)) return;
    const objects = this.sceneryByChunk.get(key);
    if (!objects) return;
    this.liveScenery.set(
      key,
      objects.map((object) => this.spawnScenery(object)),
    );
  }

  private despawnSceneryIn(key: string): void {
    for (const sprite of this.liveScenery.get(key) ?? []) sprite.destroy();
    this.liveScenery.delete(key);
  }

  private evictColdChunks(protectedKeys: ReadonlySet<string>): void {
    if (this.activeChunks.size <= CHUNK_CACHE_LIMIT) return;
    const evictable = [...this.activeChunks.entries()]
      .filter(([key]) => !protectedKeys.has(key))
      .sort((a, b) => a[1].lastUsedAt - b[1].lastUsedAt);
    const overBy = this.activeChunks.size - CHUNK_CACHE_LIMIT;
    for (let i = 0; i < overBy && i < evictable.length; i++) {
      const item = evictable[i];
      if (!item) continue;
      const [key, entry] = item;
      entry.texture.destroy();
      this.activeChunks.delete(key);
      this.despawnSceneryIn(key);
    }
  }

  // Swing each door according to how close the player is. Chebyshev
  // distance, so approaching a door diagonally opens it at the same range as
  // walking straight at it. Only re-plays the animation when the state
  // actually changes, or the smoke would restart every frame.
  private updateDoors(): void {
    for (const building of this.buildings) {
      const distance = Math.max(
        Math.abs(this.playerCol - building.doorCol),
        Math.abs(this.playerRow - building.doorRow),
      );
      const state = doorStateForDistance(distance);
      if (state === building.door) continue;
      building.door = state;
      building.image.play(buildingAnimKey(building.painted, state), true);
    }
  }

  // --- Input -----------------------------------------------------------

  private setupInput(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error("keyboard input plugin is not available");

    const { KeyCodes } = Phaser.Input.Keyboard;
    this.cursors = keyboard.createCursorKeys();
    this.wasd = {
      up: keyboard.addKey(KeyCodes.W),
      down: keyboard.addKey(KeyCodes.S),
      left: keyboard.addKey(KeyCodes.A),
      right: keyboard.addKey(KeyCodes.D),
    };
    // One number key per crop, in the pouch's own order. The list runs to
    // nine rather than to however many crops there are today: it was three,
    // and the day three became six the last three seeds had no key at all
    // while the pouch showed them perfectly happily.
    this.plantKeys = [
      KeyCodes.ONE,
      KeyCodes.TWO,
      KeyCodes.THREE,
      KeyCodes.FOUR,
      KeyCodes.FIVE,
      KeyCodes.SIX,
      KeyCodes.SEVEN,
      KeyCodes.EIGHT,
      KeyCodes.NINE,
    ]
      .slice(0, PLANT_TYPES.length)
      .map((code) => keyboard.addKey(code));
    this.plantActionKey = keyboard.addKey(KeyCodes.SPACE);
    this.spellbookKey = keyboard.addKey(KeyCodes.B);
    this.seedPouchKey = keyboard.addKey(KeyCodes.P);
    this.harvestKey = keyboard.addKey(KeyCodes.H);
  }

  /**
   * Where the player is being asked to walk, along both axes at once.
   *
   * Two keys held together make a diagonal, rather than the first one found
   * winning. That was the old rule and a playtest called it annoying: the
   * world is a grid of roads and gardens laid out to be cut across, and
   * getting to something up and to the left took two separate pushes.
   *
   * Opposite keys cancel, which is what a hand rolling from one arrow to the
   * next actually does for a few frames.
   */
  private pressedDirection(): Direction | null {
    const held = (a: Phaser.Input.Keyboard.Key, b: Phaser.Input.Keyboard.Key) =>
      a.isDown || b.isDown ? 1 : 0;
    const dCol =
      held(this.cursors.right, this.wasd.right) - held(this.cursors.left, this.wasd.left);
    const dRow = held(this.cursors.down, this.wasd.down) - held(this.cursors.up, this.wasd.up);
    if (dCol !== 0 || dRow !== 0) return { dCol, dRow };
    // Keyboard first so an attached keyboard still wins on a touch device.
    return this.joystick?.step() ?? null;
  }

  /**
   * Take a step, sliding along whatever is in the way rather than stopping.
   *
   * A diagonal needs **both** of its orthogonal neighbours open, or the
   * player would walk through the corner of a building — the one place a
   * grid of solid squares has a hole in it that is not a doorway.
   *
   * When the diagonal is refused, the step falls back to whichever single
   * axis is still open. That is what makes a diagonal push against a wall
   * slide along it instead of stopping dead, and it is most of why eight-way
   * movement feels better than four. It also means a door is never entered
   * on a diagonal: pushing into the corner beside one slides past it, and
   * walking in still takes a straight step at it.
   */
  private walk(dCol: number, dRow: number): void {
    if (dCol === 0 || dRow === 0) {
      this.tryMove(dCol, dRow);
      return;
    }
    if (this.stepIsOpen(dCol, dRow) && this.stepIsOpen(dCol, 0) && this.stepIsOpen(0, dRow)) {
      this.tryMove(dCol, dRow);
      return;
    }
    if (this.stepIsOpen(dCol, 0)) {
      this.tryMove(dCol, 0);
      return;
    }
    if (this.stepIsOpen(0, dRow)) {
      this.tryMove(0, dRow);
      return;
    }
    // Nothing is open. Still turn, because pressing into a wall should look
    // like it was heard.
    this.session.turnToward(dCol, dRow);
  }

  /** Whether one step from where the player stands would be taken. */
  private stepIsOpen(dCol: number, dRow: number): boolean {
    return this.grid.canStep(this.session.tile, {
      col: this.playerCol + dCol,
      row: this.playerRow + dRow,
    });
  }

  private tryMove(dCol: number, dRow: number): void {
    const targetCol = this.playerCol + dCol;
    const targetRow = this.playerRow + dRow;
    // Turn to face a blocked direction even though the step fails: pressing
    // into a wall should still turn the character, which is what makes the
    // controls feel like they are being listened to.
    this.session.turnToward(dCol, dRow);

    if (this.interior) {
      // Walking off the room's edge means nothing except at the door, which
      // is the one cell in the wall that is not blocked.
      if (
        !this.grid.inBounds(targetCol, targetRow) &&
        this.playerCol === this.interior.exit.col &&
        this.playerRow === this.interior.exit.row
      ) {
        this.leaveInterior();
        return;
      }
    } else {
      // Pressing into a doorway enters, rather than bumping off it. Every
      // cell of it is part of the footprint and so already impassable, which
      // is what makes this unambiguous: nothing else wants that step.
      const building = this.buildingEntranceAt(targetCol, targetRow, { dCol, dRow });
      if (building) {
        this.enterInterior(building);
        return;
      }
    }

    // `canStep` rather than `isPassable`: the ground on top of a cliff is
    // perfectly good ground, and what is not allowed is climbing it. Indoors
    // the whole room is one level, so this costs nothing there.
    if (!this.grid.canStep(this.session.tile, { col: targetCol, row: targetRow })) return;

    this.isMoving = true;
    this.session.setPosition(targetCol, targetRow);
    // Walking in is what unlocks a place for the portal. Checked on the step
    // rather than on a timer, so the first foot inside is the one that counts.
    this.markPlaceReached();

    const target = this.toFeet(targetCol, targetRow);
    this.tweens.add({
      targets: this.player,
      x: target.x,
      y: target.y,
      // A diagonal covers a longer distance, so it takes longer. Without
      // this, cutting across is forty per cent faster than walking round —
      // which turns a convenience into the only sensible way to travel.
      duration:
        dCol !== 0 && dRow !== 0 ? Math.round(MOVE_DURATION_MS * Math.SQRT2) : MOVE_DURATION_MS,
      onComplete: () => {
        this.isMoving = false;
      },
    });
  }

  // --- The action bar ----------------------------------------------------
  //
  // Two containers in the bottom-right corner: a pouch holding seeds and a
  // book holding spells. Tapping one shows what is inside; tapping one of
  // those plants or casts straight away. See IconTray for why they are the
  // same widget and why nothing selects-then-confirms.
  //
  // This replaced a pair of text buttons reading "Plant" and "Next", where
  // "Next" cycled the crop and "Plant" used whichever was current. That works
  // with three crops and stops working at six, and it asked the player to
  // read the status line to find out what they were about to plant.

  private createActionBar(): void {
    const size = this.mobileControls ? 64 : 56;
    const bottom = this.mobileControls ? 76 : 48;
    const edge = size / 2 + (this.mobileControls ? 16 : 12);

    this.seedTray = new IconTray(this, {
      texture: uiTextureKey(UiAsset.SeedPouch),
      // One button per crop, in the order the keyboard's number keys pick
      // them, so the two ways in agree about which is the first seed.
      items: PLANT_TYPES.map((plant, index) => ({
        texture: uiTextureKey(cropIcon(plant)),
        act: () => {
          // Picking a seed here is also what the number keys pick, so the
          // two routes never disagree about which crop Space would plant.
          this.selectedPlantIndex = index;
          this.tryPlant();
        },
      })),
      size,
      right: edge + size + 10,
      bottom,
      depth: TOUCH_UI_DEPTH,
      register: (object) => this.ui(object),
      onOpen: () => {
        this.spellTray?.setOpen(false);
        this.basketTray?.setOpen(false);
        this.crateTray?.setOpen(false);
        this.purseTray?.setOpen(false);
      },
      canOpen: () => !this.modalOpen,
    });

    this.spellTray = new IconTray(this, {
      texture: uiTextureKey(UiAsset.Spellbook),
      items: [
        { texture: uiTextureKey(UiAsset.RuneAdd), act: () => this.castGrowthSpell() },
        { texture: uiTextureKey(UiAsset.RuneMinus), act: () => this.castClearingSpell() },
        {
          texture: uiTextureKey(UiAsset.RunePortal),
          act: () => this.castPortalSpell(),
          // Drawn dimmed until somebody has taught it, rather than left out:
          // a book with a gap in it says there is something to find.
          available: () => this.knowsPortal,
        },
        {
          texture: uiTextureKey(UiAsset.RuneTimes),
          act: () => this.castArraySpell(),
          available: () => this.knowsArray,
        },
        {
          texture: uiTextureKey(UiAsset.RuneHourglass),
          act: () => this.castHourglass(),
          available: () => this.knowsHourglass,
        },
      ],
      size,
      right: edge,
      bottom,
      depth: TOUCH_UI_DEPTH,
      register: (object) => this.ui(object),
      onOpen: () => {
        this.seedTray?.setOpen(false);
        this.basketTray?.setOpen(false);
        this.crateTray?.setOpen(false);
        this.purseTray?.setOpen(false);
      },
      canOpen: () => !this.modalOpen,
    });

    // What she is carrying, in the same shape as the two containers beside
    // it. Tapping an item states how many of it she has rather than doing
    // anything: there is nothing to spend produce on yet, and a button that
    // silently did nothing would be worse than one that answers.
    // Crops and what the world gave up: both are things she comes back with
    // and both are things the store buys, which is the whole of what the
    // basket is for.
    const gathered: readonly { item: ItemType; icon: string }[] = [
      ...PLANT_TYPES.map((plant) => ({ item: plant as ItemType, icon: cropIcon(plant) })),
      ...MATERIAL_TYPES.map((material) => ({
        item: material as ItemType,
        icon: materialIcon(material),
      })),
    ];
    this.basketTray = new IconTray(this, {
      texture: uiTextureKey(UiAsset.Basket),
      items: gathered.map(({ item, icon }) => ({
        texture: uiTextureKey(icon),
        count: () => this.inventory.count(item),
        // Nothing. The count badge on the button *is* the answer, and it is
        // already on screen — a tap that repeated it in a line of small type
        // was answering a question the picture had answered first.
        act: () => {},
      })),
      // What she gathered, not `inventory.total`: the bag holds bought
      // fixtures too, and a basket badge that counted those would say she is
      // carrying three carrots when she is carrying a carrot and two fences.
      count: () => gathered.reduce((sum, { item }) => sum + this.inventory.count(item), 0),
      size,
      right: edge + (size + 10) * 2,
      bottom,
      depth: TOUCH_UI_DEPTH,
      register: (object) => this.ui(object),
      onOpen: () => {
        this.seedTray?.setOpen(false);
        this.spellTray?.setOpen(false);
        this.crateTray?.setOpen(false);
        this.purseTray?.setOpen(false);
      },
      canOpen: () => !this.modalOpen,
    });

    // What she has bought and can put down. A fourth container rather than
    // more rows in the basket: six items stacked upward from the corner
    // overflow a phone held sideways, and a tray whose top row is off screen
    // is worse than one more button.
    this.crateTray = new IconTray(this, {
      texture: uiTextureKey(UiAsset.Crate),
      items: PLACEABLE_FIXTURES.map((fixture) => ({
        texture: uiTextureKey(itemIcon(fixture)),
        count: () => this.inventory.count(fixture),
        act: () => this.placeFixture(fixture),
      })),
      count: () => PLACEABLE_FIXTURES.reduce((sum, f) => sum + this.inventory.count(f), 0),
      size,
      right: edge + (size + 10) * 3,
      bottom,
      depth: TOUCH_UI_DEPTH,
      register: (object) => this.ui(object),
      // Every tray closes the other three. Notably not itself: a blanket
      // "close the rest" that included the crate made it shut on the same
      // click that opened it, which reads exactly like a button that does
      // nothing.
      onOpen: () => {
        this.seedTray?.setOpen(false);
        this.spellTray?.setOpen(false);
        this.basketTray?.setOpen(false);
        this.purseTray?.setOpen(false);
      },
      canOpen: () => !this.modalOpen,
    });

    // Money, as a button with a badge rather than a line of text in the
    // corner: the coin count belongs beside the things it buys, and the badge
    // says how much without spending a line of the screen on saying it.
    // Its items are the three kinds of coin rather than the nine
    // denominations: sorting change by metal is what a child does with a
    // handful of it before reading the number on any of it, and nine slots
    // stacked up the side of the screen is a list rather than a purse.
    this.purseTray = new IconTray(this, {
      texture: uiTextureKey(coinIcon(CoinTier.Gold)),
      items: COIN_TIERS.map((tier) => ({
        texture: uiTextureKey(coinIcon(tier)),
        count: () => this.coinsOfTier(tier).length,
        // Nothing, like the basket's. The badge on the button already says
        // how many of this coin she has, and the shop counts the purse out
        // in front of her when there is something to pay for.
        act: () => {},
      })),
      // Whole units, not the minor ones the purse counts in: a badge reading
      // "5000" for fifty sun would be a number nobody in the game uses.
      count: () => Math.floor(this.purse.coins / CURRENCY.minorPerMajor),
      size,
      right: edge + (size + 10) * 4,
      bottom,
      depth: TOUCH_UI_DEPTH,
      register: (object) => this.ui(object),
      onOpen: () => {
        this.seedTray?.setOpen(false);
        this.spellTray?.setOpen(false);
        this.basketTray?.setOpen(false);
        this.crateTray?.setOpen(false);
      },
      canOpen: () => !this.modalOpen,
    });

    this.edgeAnchored.push(
      this.seedTray,
      this.spellTray,
      this.basketTray,
      this.crateTray,
      this.purseTray,
    );
  }

  // The keyboard route into a tray. Whether it may open is the tray's own
  // `canOpen` — see IconTray, and see why the guard cannot live only here.
  private toggleTray(tray: IconTray | undefined): void {
    tray?.toggle();
  }

  /**
   * Cast the addition spell on the tile the player is facing.
   *
   * The spell adds, and adding to a plant is what makes it grow — one cast,
   * one stage. Refusals are stated rather than silent: the player has to be
   * told the tile is bare or the crop is finished, or a spell that declines
   * to open reads as a broken button.
   *
   * The same tile planting works, and deliberately so: two gardening actions
   * that target different tiles would mean planting a crop and then having to
   * step onto it to tend it.
   */
  private castGrowthSpell(): void {
    this.armSpell(Spell.Growth, UiAsset.RuneAdd);
  }

  /**
   * And the cast itself, once the ground has been named.
   *
   * `at` is the square she tapped. It is passed down rather than left in
   * `aim`, because this answer is about this cast: an aim that outlived the
   * parchment would send the next seed she plants to the tile she last cast
   * on.
   */
  private growthCastAt(at: GridPoint): void {
    // The one guard here that is not merely defensive: the spellbook button
    // sits inside the popup's own rectangle on a phone, and a rune tapped
    // through it would restart the cast half way through the problem.
    if (this.modalOpen) return;

    const target = this.session.checkGrowth(at);
    if (!target.ok || !target.tile) {
      this.report(target);
      return;
    }
    const { col, row } = target.tile;
    // A stick still held when the parchment opens never sends its release,
    // and the player walks off the moment the popup closes.
    this.joystick?.release();
    const rung = rungAt(this.profile.rung);
    this.spellPopup.open(makeAdditionProblem(this.spellRng, rung), rung.given, (result) => {
      if (result.solved) this.growCropAt(col, row);
      this.noteCast(result);
    });
  }

  /**
   * The array spell: mark out a patch, choose what to do to it, and say how
   * many squares you marked.
   *
   * It began as a spell that chose its own rectangle and planted it. This is
   * the same arithmetic doing a much better job: the child draws the patch,
   * so the numbers in the question are numbers they made with their own
   * hands, and what happens to it is theirs to pick too. One multiplication
   * buys that many plantings, or that many growth casts, or that many
   * clearings — which is what multiplication is *for*, doing the same thing
   * many times without doing it many times.
   *
   * Tapping the rune only *arms* it. Nothing is cast until a patch has been
   * drawn and an action chosen, and either can be walked away from.
   */
  private castArraySpell(): void {
    if (this.modalOpen) return;
    this.spellTray?.setOpen(false);
    if (!this.knowsArray) {
      this.showRefusalOnPlayer(UiAsset.RuneTimes);
      return;
    }
    if (this.interior) {
      this.showRefusalOnPlayer();
      return;
    }
    if (this.marking) {
      this.stopMarking();
      return;
    }
    this.joystick?.release();
    // The square she is pointing at is the patch's first corner, if she is
    // pointing at one. That is what the pointing is *for* — she has already
    // said where, and asking again would be asking twice.
    const aimed = this.session.aimed;
    this.marking = aimed
      ? { from: aimed, patch: patchBetween(aimed, aimed, this.worldGrid) }
      : { from: null, patch: null };
    // The rune hangs over her head for as long as the spell is armed. It is
    // the whole of "mark out the ground": a spell that is waiting for a tap
    // and says nothing is a spell that looks like it did not fire.
    this.raiseArmedRune(UiAsset.RuneTimes);
    this.paintPatch();
  }

  /**
   * Light a rune and wait to be told where it lands.
   *
   * A spell is a question in two parts — *which spell*, and *on what* — and
   * for a long time this game only ever asked the first. The second was
   * answered for the child by whichever square she happened to be facing,
   * which is a thing an adult lines up without noticing and a playtest put
   * as *spell targeting is hard*.
   *
   * The first attempt at that had it backwards: tap a square to point at it,
   * then tap a rune. Wrong way round twice over. It asks the child to say
   * where before she has decided what, and — because a tap is the joystick
   * on a phone, and because a crop swallows the taps aimed at it — it was
   * unreachable on a tablet and unreachable on any crop, which is every
   * square the growth spell has ever cared about.
   *
   * So the rune goes first and the ground second, which is the order the
   * question is actually asked in. The array spell has worked this way from
   * the day it was written; this is that pattern for the other two.
   *
   * Tapping the lit rune again puts it out. Nothing is drawn when it does —
   * a rune moving over the player is what *earning* one looks like.
   */
  private armSpell(spell: Spell, rune: string): void {
    if (this.modalOpen) return;
    this.spellTray?.setOpen(false);
    // One spell waiting at a time. Arming the minus while the array is out
    // for a corner would leave two things wanting the same tap.
    this.stopMarking();
    const same = this.armed === spell;
    this.disarm();
    if (same) return;
    this.armed = spell;
    // A stick still held when the rune lights never sends its release, and
    // she walks on while the ground she is choosing from slides away.
    this.joystick?.release();
    this.raiseArmedRune(rune);
    this.paintAim();
  }

  /** Put the rune out, whether it was cast or given up on. */
  private disarm(): void {
    if (!this.armed) return;
    this.armed = null;
    this.armedRune?.destroy();
    this.armedRune = undefined;
    this.paintAim();
  }

  /**
   * A tap on the world while a rune is lit: this square, this cast.
   *
   * Out of reach leaves the rune lit rather than spending it. A finger that
   * lands a square wide of the ring has not chosen anything, and a spell
   * that gave up at the first near miss would be a spell a child had to aim
   * twice.
   */
  private castArmedAt(worldX: number, worldY: number): void {
    const spell = this.armed;
    if (!spell) return;
    const at = this.toGrid(worldX, worldY);
    if (!withinReach(this.session.tile, at)) {
      this.markTooFar(at.col, at.row);
      return;
    }
    this.disarm();
    if (spell === Spell.Growth) this.growthCastAt(at);
    else this.clearingCastAt(at);
  }

  /** Put the marker away, whatever state it was in. */
  private stopMarking(): void {
    if (!this.marking) return;
    this.marking = null;
    this.patchMenu?.close();
    this.paintPatch();
    this.armedRune?.destroy();
    this.armedRune = undefined;
  }

  /**
   * A tap while the spell is armed: the first sets a corner, the second the
   * other one.
   *
   * Two taps rather than a drag, and that is the whole reason it is not a
   * drag: on a phone a press is already the joystick, and a gesture that had
   * to be told apart from steering would be a gesture that sometimes steers.
   * Two taps behave identically under a finger and a mouse.
   */
  private markPatchAt(worldX: number, worldY: number): void {
    const marking = this.marking;
    if (!marking) return;
    const at = this.tileAtWorld(worldX, worldY);
    if (!at) return;
    if (!marking.from) {
      this.marking = { from: at, patch: patchBetween(at, at, this.worldGrid) };
      this.paintPatch();
      return;
    }
    const patch = patchBetween(marking.from, at, this.worldGrid);
    if (!patchIsCastable(patch)) {
      // A single square is not a multiplication. Rather than refuse the tap,
      // the corner moves — which is what a child who tapped the same cell
      // twice almost certainly meant.
      this.marking = { from: at, patch: patchBetween(at, at, this.worldGrid) };
      this.paintPatch();
      // One square is not a rectangle. The corner has already moved to where
      // she tapped, so the only thing left to say is *not that one* — on the
      // square, where she is looking.
      this.markRefusal(at.col, at.row);
      return;
    }
    this.marking = { from: marking.from, patch };
    this.paintPatch();
    this.openPatchMenu(patch);
  }

  /** Draw the marker over the ground it covers, or take it away. */
  /**
   * The empty lamp posts, drawn on the ground.
   *
   * Without this the astronomer says "put them on the empty posts" and the
   * posts are five cells of bare dirt in a path of bare dirt — a child could
   * set all five lamps down a step from where they count and get no word
   * either way. The sockets are the whole of the task's instructions, and
   * they are also its progress bar: five holes, then four, then none.
   */
  private paintSockets(): void {
    const ink = this.socketInk;
    if (!ink) return;
    ink.clear();
    const observatory = this.observatory;
    // Indoors the world layer is a room, and a socket drawn at the climb's
    // coordinates would land on somebody's floor.
    if (!observatory || this.session.indoors) return;
    for (const at of observatory.posts) {
      if (this.worldGrid.getObjectAt(at.col, at.row)) continue;
      const feet = this.toFeet(at.col, at.row);
      ink.fillStyle(SOCKET_HOLE, 0.85);
      ink.fillEllipse(feet.x, feet.y - TILE_SIZE / 3, SOCKET_WIDE, SOCKET_TALL);
      ink.lineStyle(1, SOCKET_RIM, 0.9);
      ink.strokeEllipse(feet.x, feet.y - TILE_SIZE / 3, SOCKET_WIDE, SOCKET_TALL);
    }
  }

  /**
   * The square she is pointing at, outlined on the ground.
   *
   * A ring rather than a fill: what is on the square is the thing she is
   * about to act on, and a wash over it would be a wash over the crop she is
   * aiming at. The same yellow the array spell's rectangle uses, because it
   * means the same thing — *this ground, and what happens next happens here*.
   */
  private paintAim(): void {
    const ink = this.aimInk;
    if (!ink) return;
    ink.clear();
    if (this.armed) this.paintReach(ink);
    const at = this.session.aimed;
    if (!at) return;
    const corner = this.toFeet(at.col, at.row);
    ink.lineStyle(2, PATCH_EDGE, 1);
    ink.strokeRect(corner.x - TILE_SIZE / 2, corner.y - TILE_SIZE, TILE_SIZE, TILE_SIZE);
  }

  /**
   * The ground a lit rune can be sent to, ruled off on the grass.
   *
   * A rune that waits and shows nothing is a rune that looks like it did not
   * fire, and one that shows only itself asks a question without saying what
   * the answers are. This is the answer sheet: a square of squares round
   * her, and every one of them is a tap she may make.
   *
   * `withinReach` measures the longest side rather than the sum of both, so
   * the shape is a square and not a diamond — the corners are as close as
   * the edges, and drawing a diamond would rule out taps the spell accepts.
   *
   * Faint, and under everything. It is the floor of the picture, not part of
   * it: what she is looking at is the tree or the crop standing on it.
   */
  private paintReach(ink: Phaser.GameObjects.Graphics): void {
    const here = this.session.tile;
    const corner = this.toFeet(here.col - AIM_REACH, here.row - AIM_REACH);
    const side = (AIM_REACH * 2 + 1) * TILE_SIZE;
    ink.fillStyle(PATCH_EDGE, 0.12);
    ink.fillRect(corner.x - TILE_SIZE / 2, corner.y - TILE_SIZE, side, side);
    ink.lineStyle(2, PATCH_EDGE, 0.7);
    ink.strokeRect(corner.x - TILE_SIZE / 2, corner.y - TILE_SIZE, side, side);
  }

  /**
   * Let a square go when she has walked out of pointing range of it.
   *
   * Otherwise the aim is a thing that follows her about invisibly: she walks
   * off, presses a seed, and a carrot appears somewhere behind her.
   */
  private checkAim(): void {
    const at = this.session.aimed;
    if (!at) return;
    if (withinReach(this.session.tile, at)) return;
    this.session.aimAt(null);
    this.paintAim();
  }

  private paintPatch(): void {
    const ink = this.patchInk;
    if (!ink) return;
    ink.clear();
    const patch = this.marking?.patch;
    ink.setVisible(patch !== undefined && patch !== null);
    if (!patch) return;
    const corner = this.toFeet(patch.col, patch.row);
    const left = corner.x - TILE_SIZE / 2;
    const top = corner.y - TILE_SIZE;
    const width = patch.width * TILE_SIZE;
    const height = patch.height * TILE_SIZE;
    ink.fillStyle(PATCH_FILL, PATCH_FILL_ALPHA);
    ink.fillRect(left, top, width, height);
    ink.lineStyle(2, PATCH_EDGE, 1);
    ink.strokeRect(left, top, width, height);
    // The squares nothing could happen to are dimmed back out.
    //
    // The question is about the whole rectangle — that is the point of the
    // spell, and it is what the child drew — but a rectangle mostly hanging
    // over a roof is a rectangle they meant to draw somewhere else, and they
    // should be able to see that before they answer rather than after. The
    // menu says how many; this says *which*.
    const live = new Set<string>();
    for (const { cells } of this.patchOffers(patch)) {
      for (const at of cells) live.add(`${at.col},${at.row}`);
    }
    if (live.size < patch.width * patch.height) {
      ink.fillStyle(PATCH_DEAD, PATCH_DEAD_ALPHA);
      for (const at of patchCells(patch)) {
        if (live.has(`${at.col},${at.row}`)) continue;
        const cell = this.toFeet(at.col, at.row);
        ink.fillRect(cell.x - TILE_SIZE / 2, cell.y - TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
    // The squares inside it, so the patch reads as *this many* rather than
    // as a highlighted region — it is the same picture the parchment is
    // about to draw, on the ground it is about to happen to.
    ink.lineStyle(1, PATCH_EDGE, 0.5);
    for (let col = 1; col < patch.width; col++) {
      ink.lineBetween(left + col * TILE_SIZE, top, left + col * TILE_SIZE, top + height);
    }
    for (let row = 1; row < patch.height; row++) {
      ink.lineBetween(left, top + row * TILE_SIZE, left + width, top + row * TILE_SIZE);
    }
  }

  /** Which cells of the patch each action could touch. */
  private patchOffers(patch: Patch): { action: PatchAction; cells: GridPoint[] }[] {
    const plant = PLANT_TYPES[this.selectedPlantIndex] ?? PLANT_TYPES[0];
    return [
      { action: PatchAction.Plant, cells: plant ? this.session.plantableIn(plant, patch) : [] },
      { action: PatchAction.Grow, cells: this.session.growableIn(patch) },
      { action: PatchAction.Clear, cells: this.session.clearableIn(patch) },
    ];
  }

  /**
   * The choice: plant it, grow it, or clear it.
   *
   * Only the ones that would actually do something are offered. An action
   * greyed out on every patch a child ever draws is a button they learn to
   * ignore; an action that is simply not there when there is nothing for it
   * to do is a menu that answers the question "what can I do here".
   */
  private openPatchMenu(patch: Patch): void {
    const offers = this.patchOffers(patch).filter(({ cells }) => cells.length > 0);
    if (offers.length === 0) {
      // Every square in it is already dimmed by `paintPatch`; the cross says
      // that the dimming is the whole patch rather than part of it.
      this.markRefusal(
        patch.col + Math.floor(patch.width / 2),
        patch.row + Math.floor(patch.height / 2),
      );
      return;
    }
    const at = this.toFeet(patch.col + patch.width / 2, patch.row);
    this.patchMenu?.openAt(
      this.screenOfPoint(at.x, at.y - TILE_SIZE),
      offers.map(({ action, cells }) => ({
        action,
        count: cells.length,
        label: this.words.patchAction(action, cells.length),
      })),
      (action) => this.beginPatchCast(patch, action),
    );
  }

  /**
   * Ask the multiplication, then do the thing to every square of the patch.
   *
   * The question is about the patch, not about the cells the action will
   * land on: a child who marked out six by seven answers six by seven, even
   * if four of those squares already hold a grown carrot. The rectangle is
   * what they drew and what they are being asked about; what it lands on is
   * the world's business.
   */
  private beginPatchCast(patch: Patch, action: PatchAction): void {
    this.patchMenu?.close();
    const rung = arrayRungAt(this.dev.arrayRung ?? this.profile.arrayRung);
    const problem = arrayProblemFor(patch.height, patch.width, rung);
    this.joystick?.release();
    this.arrayPopup?.open(problem, (result) => {
      // The marker goes away *first*: it clears the message line on its way
      // out, so putting it after the cast wiped the one line saying what the
      // cast had just done.
      this.stopMarking();
      if (result.solved) this.applyToPatch(patch, action);
      this.noteArrayCast(result);
    });
  }

  /**
   * Do it, to every square of the patch that will take it.
   *
   * Each square that took it says so on itself — a crop rising off the ones
   * that were planted, the plus and minus effects on the ones that grew or
   * were cleared. That is the count, drawn: a child who wants to know how
   * many squares the spell reached can see them all move at once, which is
   * the whole reason to cast it on a patch rather than one at a time.
   */
  private applyToPatch(patch: Patch, action: PatchAction): void {
    const plant = PLANT_TYPES[this.selectedPlantIndex] ?? PLANT_TYPES[0];
    let done = 0;
    if (action === PatchAction.Plant && plant) {
      for (const at of this.session.plantableIn(plant, patch)) {
        if (!this.grid.plant(at.col, at.row, plant)) continue;
        this.spawnCropSprite(at.col, at.row, { plant, stage: PLANTED_STAGE });
        this.showResult(cropIcon(plant), at.col, at.row);
        done++;
      }
      this.playGesture(PLANT);
    } else if (action === PatchAction.Grow) {
      for (const at of this.session.growableIn(patch)) {
        this.growCropAt(at.col, at.row);
        done++;
      }
    } else if (action === PatchAction.Clear) {
      for (const at of this.session.clearableIn(patch)) {
        this.clearAt(at.col, at.row);
        done++;
      }
    }
    void done;
  }

  /**
   * Cast the portal spell: choose a place on the map, then say how far it is.  /**
   * Cast the portal spell: choose a place on the map, then say how far it is.
   *
   * Cast from anywhere out of doors, and from nowhere indoors — the map on
   * the parchment is the world's, and a spell that opened a hole in the
   * floor of the schoolhouse would be measuring a journey from a room the
   * map does not show. Indoors it says so rather than doing nothing, for the
   * same reason planting on stone does.
   *
   * Nothing is spent and nothing is lost by getting it wrong. A wrong answer
   * clears the box; closing the parchment walks away. The one thing a cast
   * can do is move you.
   */
  private castPortalSpell(): void {
    if (this.modalOpen) return;
    this.spellTray?.setOpen(false);
    // Refused with a reason, and the reason says where to go. A rune that
    // did nothing when tapped would read as a broken button.
    if (!this.knowsPortal) {
      this.showRefusalOnPlayer(UiAsset.RunePortal);
      return;
    }
    if (this.interior) {
      this.showRefusalOnPlayer();
      return;
    }
    this.joystick?.release();
    const at = this.session.tile;
    // `?reached=` is a dev seam, and it adds rather than replaces: a script
    // asking for the harbour should still be able to go home.
    const reached = [...this.profile.reached, ...this.dev.reached];
    const stops = portalStops(
      this.anchors,
      reached,
      at,
      (cell) => this.canBeSetDownOn(cell),
      // Every place that knows where a visitor stands hands it over. The
      // forest's is in front of the great tree; the city's is its gate,
      // because a city you arrive at by appearing in the middle of has no
      // outside; the harbour's is on the quay and never on a plank.
      //
      // The harbour's is also the one that would otherwise be a bug rather
      // than an inelegance: the middle of that box is frequently open sea,
      // and the ring search would land the traveller on whichever scrap of
      // beach it reached first.
      {
        enchantedForest: this.grove.doorstep,
        bigCity: this.city.doorstep,
        ...(this.harbourFront ? { harbour: this.harbourFront.doorstep } : {}),
      },
    );
    this.portalPanel?.openOn(
      stops,
      at,
      portalRungAt(this.dev.portalRung ?? this.profile.portalRung),
      (result, journey) => {
        if (journey) this.travelThrough(journey);
        this.notePortalCast(result);
      },
    );
  }

  /**
   * Whether the portal may set somebody down on this cell.
   *
   * Passable, and with somewhere to step from there. The second half is what
   * separates a landing from a trap: the middle of the enchanted forest is
   * the great tree, and the cells against its trunk are passable — landing
   * on one with the wood closed round it would be a correct cast that ended
   * the game just as thoroughly as landing inside the tree did.
   *
   * It does not prove the landing connects to anywhere in particular; that
   * is a flood fill over a quarter of a million cells and not something to
   * do while a parchment is open. `portal.test.ts` does prove it, over
   * generated worlds, which is where a claim that size belongs.
   */
  private canBeSetDownOn(cell: GridPoint): boolean {
    if (!this.worldGrid.isPassable(cell.col, cell.row)) return false;
    return AROUND_LANDING.some(([dCol, dRow]) =>
      this.worldGrid.isPassable(cell.col + dCol, cell.row + dRow),
    );
  }

  /**
   * Go through the portal.
   *
   * The whole point of a spell about distance is that the distance is
   * crossed, and an instant jump says nothing about that — the screen simply
   * shows somewhere else, which is what a bug looks like. So a doorway opens
   * on the tile the traveller is facing, the far end shows through it, they
   * walk in, and it closes behind them at the other end.
   *
   * **The far end is drawn from the world's own grid**, by the same loop the
   * terrain chunks are drawn by, so what is seen through the hole is what is
   * actually there. Painting anything else would be a lie about the place
   * the hole is a hole into, and the one thing this animation has to sell.
   *
   * The camera is never told to move: it follows the player, and the player
   * is what moves. That is also why the arrival needs no `centerOn` — the
   * follow has no lerp, so setting the sprite down at the far end puts the
   * camera there in the same frame.
   */
  private travelThrough(journey: PortalJourney): void {
    this.stopMarking();
    const facing = this.session.facing;
    const world = { width: this.grid.width, height: this.grid.height };
    const doorway = portalCell(this.session.tile, facing, world);
    this.travelling = true;
    this.joystick?.release();
    // A crossing that never finished would leave the game deaf: `travelling`
    // is what stops input reaching the player, and nothing else clears it.
    // Twice the length of the whole thing, so it can only fire after a real
    // failure — and when it does, it puts the traveller down somewhere
    // rather than leaving them inside a hole.
    //
    // Cancelled on success rather than guarded on a flag. Guarding was the
    // first version and it is not enough: a beat that merely *ran long* — a
    // cheap tablet part-way through painting a chunk — would fire it in the
    // middle of the crossing, land the traveller, and leave the tween it
    // interrupted to finish into destroyed graphics.
    this.portalGuard = this.time.delayedCall(portalTravelMs() * 2, () => {
      this.portalGuard = null;
      this.tweens.killTweensOf(this.player);
      this.closePortal();
      this.landAt(journey);
      this.travelling = false;
    });
    // The far end, seen from here.
    this.openPortal(doorway, journey.to);
    this.player.setDepth(this.portalDepth + 0.2);
    this.swingPortal(0, 1, PORTAL_OPEN_MS, () => {
      this.time.delayedCall(PORTAL_HOLD_MS, () => this.stepInto(journey, facing));
    });
  }

  /** Set down at the far end, upright and whole. Also the failsafe's answer. */
  private landAt(journey: PortalJourney): void {
    this.session.setPosition(journey.to.col, journey.to.row);
    const feet = this.toFeet(journey.to.col, journey.to.row);
    this.refreshVisibleChunks(feet);
    this.player.setPosition(feet.x, feet.y).setScale(1).setAlpha(1);
    this.markPlaceReached();
    // Arriving somewhere else is what arriving somewhere else looks like.
  }

  /** Pulled off their feet and into the hole, shrinking as they go. */
  private stepInto(journey: PortalJourney, facing: Facing): void {
    this.tweens.add({
      targets: this.player,
      x: this.portalMiddle.x,
      y: this.portalMiddle.y,
      scale: 0.12,
      alpha: 0.15,
      duration: PORTAL_ENTER_MS,
      ease: "Cubic.easeIn",
      onComplete: () => this.stepOut(journey, facing),
    });
  }

  /**
   * Out the other side, with their back to it.
   *
   * The far end stands on the cell *behind* them and looks back the way they
   * came — so for a moment the village is visible through a hole in the
   * harbour, which is the same effect read from the other end and costs
   * nothing but the facing.
   */
  private stepOut(journey: PortalJourney, facing: Facing): void {
    const world = { width: this.grid.width, height: this.grid.height };
    const from = this.session.tile;
    this.session.setPosition(journey.to.col, journey.to.row);
    this.markPlaceReached();

    const behind = portalCell(journey.to, oppositeFacing(facing), world);
    this.openPortal(behind, from, 1);
    this.player.setDepth(this.portalDepth + 0.2);
    const feet = this.toFeet(journey.to.col, journey.to.row);
    // The far end's ground first, then the traveller. The other way round is
    // one frame of black — see `refreshVisibleChunks`.
    this.refreshVisibleChunks(feet);
    this.player.setPosition(this.portalMiddle.x, this.portalMiddle.y);
    this.tweens.add({
      targets: this.player,
      x: feet.x,
      y: feet.y,
      scale: 1,
      alpha: 1,
      duration: PORTAL_EXIT_MS,
      ease: "Cubic.easeOut",
      onUpdate: () => this.refreshVisibleChunks(),
      onComplete: () => {
        this.swingPortal(1, 0, PORTAL_CLOSE_MS, () => {
          this.portalGuard?.remove();
          this.portalGuard = null;
          this.closePortal();
          this.travelling = false;
        });
      },
    });
  }

  /**
   * Build the doorway on `cell`, looking at the ground around `looksAt`.
   *
   * `openAt` is how open it starts: nought at the near end, where it tears
   * itself open, and one at the far end, where the traveller is already
   * coming through it.
   */
  private openPortal(cell: GridPoint, looksAt: GridPoint, openAt = 0): void {
    this.closePortal();
    const world = { width: this.grid.width, height: this.grid.height };
    const view = portalView(looksAt, world);
    const width = (view.maxCol - view.minCol + 1) * TILE_SIZE;
    const height = (view.maxRow - view.minRow + 1) * TILE_SIZE;

    const ground = this.add.renderTexture(0, 0, width, height).setOrigin(0.5, 0.5);
    // One dual tile back on each axis: a dual tile is centred on a cell's
    // corner, so the one that covers the first cell's left half starts
    // outside the patch. The texture clips it, which is what is wanted.
    this.paintTiles(
      ground,
      {
        minCol: Math.max(DUAL_ORIGIN, view.minCol - 1),
        minRow: Math.max(DUAL_ORIGIN, view.minRow - 1),
        maxCol: view.maxCol,
        maxRow: view.maxRow,
      },
      view.minCol * TILE_SIZE,
      view.minRow * TILE_SIZE,
    );

    const feet = this.toFeet(cell.col, cell.row);
    // Standing on the tile and rising off it, like everything else that is
    // taller than the ground it is on.
    this.portalMiddle = { x: feet.x, y: feet.y - (PORTAL_TILES_DOWN * TILE_SIZE) / 2 + 6 };
    // Sorted on the tile it stands on, like every other thing in the world
    // that is taller than the ground — so a tree between the camera and the
    // hole covers it, and one behind does not.
    //
    // Keeping the traveller in front of the mouth is done by lifting *them*
    // instead (see `travelThrough`). Pushing the hole down was the first
    // answer and it put the whole wood in front of it: depth is the y a
    // thing stands on, and a hole sorted behind its own top is behind
    // everything that stands anywhere near it.
    const standing = depthFor(feet.y);
    ground.setPosition(this.portalMiddle.x, this.portalMiddle.y).setDepth(standing);
    this.world(ground);

    // `make` rather than `add`: a geometry mask is drawn into the stencil
    // buffer, and one on the display list would also be drawn into the
    // picture — a white ellipse over the hole it is cutting.
    const hole = this.make.graphics({}, false);
    ground.setMask(hole.createGeometryMask());

    const rim = this.world(this.add.graphics().setDepth(standing + 0.1));
    this.portalDepth = standing;

    this.portalGround = ground;
    this.portalHole = hole;
    this.portalRim = rim;
    this.drawPortal(openAt);
  }

  /** Tween how open it is, redrawing the hole and the rim as it goes. */
  private swingPortal(from: number, to: number, duration: number, done: () => void): void {
    const swing = { t: from };
    this.tweens.add({
      targets: swing,
      t: to,
      duration,
      onUpdate: () => this.drawPortal(portalOpenness(swing.t, 1)),
      onComplete: () => {
        this.drawPortal(to);
        done();
      },
    });
  }

  /**
   * The hole and its rim at one moment of the swing.
   *
   * It opens as a slit and widens, which is why only the width is scaled:
   * a hole that grew from a dot reads as a bubble, and a portal is a tear.
   */
  private drawPortal(open: number): void {
    const hole = this.portalHole;
    const rim = this.portalRim;
    if (!hole || !rim) return;
    const { x, y } = this.portalMiddle;
    const rx = ((PORTAL_TILES_ACROSS * TILE_SIZE) / 2) * Math.max(0.02, open);
    const ry = (PORTAL_TILES_DOWN * TILE_SIZE) / 2;

    hole.clear();
    hole.fillStyle(0xffffff, 1);
    hole.fillEllipse(x, y, rx * 2, ry * 2);

    rim.clear();
    rim.lineStyle(3, PORTAL_RIM_HEX, 1);
    rim.strokeEllipse(x, y, rx * 2, ry * 2);
    rim.lineStyle(1, PORTAL_GLOW_HEX, 0.9);
    rim.strokeEllipse(x, y, rx * 2 - 4, ry * 2 - 4);
    // Sparks riding the rim. Six of them, turning with how open it is, so
    // the thing looks alive while it tears and settles when it is done.
    rim.fillStyle(PORTAL_GLOW_HEX, 1);
    for (let n = 0; n < PORTAL_SPARKS; n++) {
      const angle = open * Math.PI * 2 + (n * Math.PI * 2) / PORTAL_SPARKS;
      rim.fillRect(x + Math.cos(angle) * rx - 1.5, y + Math.sin(angle) * ry - 1.5, 3, 3);
    }
  }

  private closePortal(): void {
    this.portalGround?.clearMask(true);
    this.portalGround?.destroy();
    this.portalRim?.destroy();
    this.portalGround = null;
    this.portalHole = null;
    this.portalRim = null;
  }

  /**
   * Remember a named place the moment it is stood in.
   *
   * Called on arrival and on every step, because both are ways of getting
   * somewhere and the portal has no business knowing which one a child used.
   * Home is already in the list when a player is made — see profiles.ts.
   */
  private markPlaceReached(): void {
    const place = placeAt(this.anchors, this.session.tile);
    if (!place || this.profile.reached.includes(place)) return;
    this.saveProfileChange({ reached: [...this.profile.reached, place] });
  }

  /**
   * Let the portal's own ladder see how a cast went.
   *
   * Its own window and its own rung, and the same rules over both: measuring
   * a map and adding on a number line are different skills, and a child
   * flying at one may be nowhere near the other.
   */
  /** Whether this child has been up the tower and met the geometer. */
  private get knowsPortal(): boolean {
    return knowsSpell([...this.profile.learned, ...this.dev.learned], Spell.Portal);
  }

  /**
   * Cast the hourglass: say how long you were away, and take what grew.
   *
   * The only spell that pays for time actually passing. Crops here grow only
   * by being cast on, so nothing happens while nobody is playing — this is
   * the astronomer's answer to that, and the price is being able to read the
   * two clock faces that say when the game was put down and when it was
   * picked up.
   *
   * **Once per return.** The time claimed is the time between this session's
   * start and the save before it, and that gap does not grow while the child
   * plays; casting it twice would pay twice for one absence. So the moment
   * it lands, the away-time is spent, and the rune says so until there is
   * another absence to claim.
   */
  private castHourglass(): void {
    if (this.modalOpen) return;
    this.spellTray?.setOpen(false);
    if (!this.knowsHourglass) {
      this.showRefusalOnPlayer(UiAsset.RuneHourglass);
      return;
    }
    const away = this.awayFrom;
    if (away === null) {
      this.showRefusalOnPlayer(UiAsset.RuneHourglass);
      return;
    }
    const rung = clockRungAt(this.dev.clockRung ?? this.profile.clockRung);
    const problem = hourglassFor(away, Date.now(), rung);
    if (!worthCasting(problem)) {
      this.showRefusalOnPlayer(UiAsset.RuneHourglass);
      return;
    }
    // Nothing planted is not a question worth asking. The child would read
    // the clocks, get the answer right, and be told that nothing grew — and
    // the hours would be spent, because a cast that landed is a cast. Better
    // to keep them and say what is missing.
    if (!this.anythingWaiting) {
      this.showRefusalOnPlayer(UiAsset.SeedPouch);
      return;
    }
    this.joystick?.release();
    this.clockPopup?.open(problem, (result) => {
      if (result.solved) {
        this.awayFrom = null;
        this.ripenNearest(problem.hours);
      }
      this.noteClockCast(result);
    });
  }

  /**
   * Move on the crops nearest the player, one stage each.
   *
   * Nearest, not first-found. Scan order would be invisible and arbitrary,
   * and a child watching five crops grow with no way to tell why *those*
   * five is the same complaint as a spell quietly choosing her seed for
   * her — she can stand where she wants this to land.
   */
  /** Whether anything of hers is in the ground and not yet ripe. */
  private get anythingWaiting(): boolean {
    return this.grid.listCrops().some(([, , crop]) => crop.stage !== PlantStage.Mature);
  }

  private ripenNearest(count: number): void {
    const here = this.session.tile;
    const waiting = this.grid
      .listCrops()
      .filter(([, , crop]) => crop.stage !== PlantStage.Mature)
      .map(([col, row]) => ({ col, row, far: Math.hypot(col - here.col, row - here.row) }))
      .sort((a, b) => a.far - b.far)
      .slice(0, count);
    for (const at of waiting) this.growCropAt(at.col, at.row);
    // No count. Every one of them plays its growing animation, which is the
    // same number said in the only place a child is looking.
  }

  /** Let the clock spell's own ladder see how a cast went. */
  private noteClockCast(result: CastResult): void {
    this.recentClockCasts = recordCast(this.recentClockCasts, result);
    const band = bandAt(this.profile.band);
    const moved = nextRung(band, this.profile.clockRung, this.recentClockCasts, HARDEST_CLOCK_RUNG);
    if (moved === this.profile.clockRung) return;
    this.recentClockCasts = [];
    if (this.dev.clockRung !== null) return;
    this.saveProfileChange({ clockRung: moved });
  }

  /** Whether this child has climbed to the dome and been taught. */
  private get knowsHourglass(): boolean {
    return knowsSpell([...this.profile.learned, ...this.dev.learned], Spell.Hourglass);
  }

  /** Whether this child has been into the old wood and touched the tree. */
  private get knowsArray(): boolean {
    return knowsSpell([...this.profile.learned, ...this.dev.learned], Spell.Array);
  }

  /**
   * Let the array spell's own ladder see how a cast went.
   *
   * A third window and a third rung, on the same rules as the other two:
   * seeing that four rows of six is twenty-four is not the skill that adds
   * 347 and 265, and a child fluent at one can be nowhere near the other.
   */
  private noteArrayCast(result: CastResult): void {
    this.recentArrayCasts = recordCast(this.recentArrayCasts, result);
    const band = bandAt(this.profile.band);
    const moved = nextRung(band, this.profile.arrayRung, this.recentArrayCasts, HARDEST_ARRAY_RUNG);
    if (moved === this.profile.arrayRung) return;
    this.recentArrayCasts = [];
    // Not while `?arrayRung=` is holding the spell at one rung: the
    // adaptation is computed against the child's own saved rung, so a dev
    // session that answers four cleanly would move a child who never played.
    if (this.dev.arrayRung !== null) return;
    this.saveProfileChange({ arrayRung: moved });
  }

  private notePortalCast(result: CastResult): void {
    this.recentPortalCasts = recordCast(this.recentPortalCasts, result);
    const band = bandAt(this.profile.band);
    const moved = nextRung(
      band,
      this.profile.portalRung,
      this.recentPortalCasts,
      HARDEST_PORTAL_RUNG,
    );
    if (moved === this.profile.portalRung) return;
    this.recentPortalCasts = [];
    // Not while `?portalRung=` is holding the spell at one rung. The
    // adaptation is computed against the child's own saved rung, not the one
    // being looked at, so a dev session that answers four cleanly would move
    // a child who never played. The seam shows; it does not teach.
    if (this.dev.portalRung !== null) return;
    this.saveProfileChange({ portalRung: moved });
  }

  /**
   * Cast the clearing spell on the tile the player is facing.
   *
   * The growth spell adds and makes a crop grow; this one takes away and
   * what it takes is whatever is in the way. Same tile, same parchment, same
   * number line — walked the other way, which the parchment works out from
   * the stops rather than being told.
   *
   * It clears the ground the *ground* grew and nothing else: a fence you
   * bought is yours, and a spell that unmade it would undo an afternoon's
   * shopping from one mis-aimed cast. `checkClearing` says so in words.
   */
  private castClearingSpell(): void {
    this.armSpell(Spell.Clearing, UiAsset.RuneMinus);
  }

  /** And the cast, on the square the tap named. See `growthCastAt`. */
  private clearingCastAt(at: GridPoint): void {
    if (this.modalOpen) return;

    const target = this.session.checkClearing(at);
    if (!target.ok || !target.tile) {
      this.report(target);
      return;
    }
    const { col, row } = target.tile;
    this.joystick?.release();
    const rung = rungAt(this.profile.rung);
    this.spellPopup.open(makeSubtractionProblem(this.spellRng, rung), rung.given, (result) => {
      if (result.solved) this.clearAt(col, row);
      this.noteCast(result);
    });
  }

  /** Lift what stood there out of the world, sprite and all. */
  private clearAt(col: number, row: number): void {
    // The tree's light goes out when the last bed is filled, and clearing
    // wood is one of the two things that can get there. Asked here rather
    // than every frame: `groveProgress` walks the thicket and sixteen
    // squares, which is nothing once and something sixty times a second.
    this.time.delayedCall(0, () => this.checkGrove());
    const object = this.session.clearAt(col, row);
    if (!object) return;
    // The sprite lives in its chunk's bucket, so both have to forget it —
    // the bucket is what respawns a chunk when the camera comes back, and a
    // tree left in there would grow again the moment the player walked away
    // and returned.
    const key = chunkKey(dualTileToChunk(object.col, object.row));
    const bucket = this.sceneryByChunk.get(key);
    if (bucket) {
      this.sceneryByChunk.set(
        key,
        bucket.filter((standing) => standing.id !== object.id),
      );
    }
    this.despawnSceneryIn(key);
    this.spawnSceneryIn(key);
    this.playEffect(EffectType.Minus, col, row);
    // What it was made of, into the basket. The spell used to give nothing,
    // which made it the one loop in the game with no reward at the end.
    const paid = yieldOf(sceneryKind(object.type));
    if (paid) {
      this.inventory.add(paid.material, paid.count);
      this.refreshCarried();
      // One icon per thing gained, rising off the square it came from, so a
      // child can *count* what a conifer was worth rather than be told.
      for (let n = 0; n < paid.count; n++) {
        this.time.delayedCall(n * MATERIAL_STAGGER_MS, () =>
          this.showResult(materialIcon(paid.material), col, row),
        );
      }
    }
    // The minus effect has already played on the square, and what stood
    // there is gone from it. Both say "cleared" better than the word does.
  }

  /**
   * Let the difficulty see how a cast went, and move it if it should.
   *
   * The whole of the adaptation, and deliberately silent: nothing on screen
   * says a rung changed, there is no level, no badge and no sound. A child
   * who is flying simply finds the sums getting bigger, and one who is stuck
   * finds them getting smaller — which is what a good teacher does and what
   * a progress bar does not. It cannot leave the band somebody picked, so
   * the worst it can do is nudge.
   */
  private noteCast(result: CastResult): void {
    this.recentCasts = recordCast(this.recentCasts, result);
    const band = bandAt(this.profile.band);
    const moved = nextRung(band, this.profile.rung, this.recentCasts);
    if (moved === this.profile.rung) return;
    // Cleared whenever it moves. Left alone, the four clean casts that earned
    // a climb would still be sitting there on the next cast and earn another
    // one straight away, walking a child from the bottom of their band to the
    // top in five casts — a ramp rather than an adaptation.
    this.recentCasts = [];
    this.saveProfileChange({ rung: moved });
    this.applyRung();
  }

  /**
   * Say what happened — on the tile it happened on, not only in words.
   *
   * A refusal used to be one line of small type along the top of the screen,
   * and playtesting said what that is worth: the child's eyes are on the
   * square they just tried to plant, several hundred pixels away, and the
   * youngest of them cannot read it at all. So a refusal that is *about a
   * square* now marks that square, and the words stay as a supplement for
   * whoever does read them.
   *
   * Every action goes through here rather than each one calling `setMessage`
   * itself, because the next rule that refuses should not have to remember
   * to do this — the one that forgets is the one a child stands in front of,
   * pressing a button that appears to do nothing.
   */
  /**
   * Show what an action did, or why it did not, without a word.
   *
   * **The mark goes where the child has to act.** That is the whole rule,
   * and it decides between the three places anything can be drawn:
   *
   * - a square is in the way, taken, bare or not yours → on that square;
   * - the basket is empty, or she is standing in the wrong kind of place →
   *   over her own head, because moving her is what fixes it;
   * - something happened → over the square it happened to.
   *
   * A refusal about a square is a cross on the square. A refusal about what
   * she is carrying is the thing she has none of, crossed out, over her. A
   * result is the thing that changed, rising off its square.
   *
   * `icon` is what the action was about — a crop or a fixture — and is the
   * caller's to supply, because only the caller knows whether `place` was
   * asked for a fence or a lamp.
   */
  private report(result: ActionResult, icon?: string): void {
    if (result.ok) {
      if (icon && result.tile) this.showResult(icon, result.tile.col, result.tile.row);
      return;
    }
    if (result.outcome === Outcome.NoneLeft || result.outcome === Outcome.Indoors) {
      this.showRefusalOnPlayer(result.outcome === Outcome.NoneLeft ? icon : undefined);
      return;
    }
    const tile = result.tile;
    if (!tile) return;
    this.markRefusal(tile.col, tile.row);
    // Out of reach is the one refusal that is not about the square itself:
    // the square is fine and she is not near it. So the cross is joined by a
    // trail of chevrons back to her feet, which says *this far* in the one
    // direction a child can act on.
    if (result.outcome === Outcome.TooFar) this.markTooFar(tile.col, tile.row);
  }

  /**
   * The thing that just changed, rising off the square it changed on.
   *
   * Rising rather than sitting still, and fading as it goes: a picture that
   * stayed would be a thing on the ground, and there is already a crop
   * there. A picture that moves is an event.
   */
  private showResult(icon: string, col: number, row: number): void {
    const feet = this.toFeet(col, row);
    const mark = this.world(
      this.add
        .image(feet.x, feet.y - TILE_SIZE / 2, uiTextureKey(icon))
        .setDisplaySize(RESULT_ICON, RESULT_ICON)
        .setDepth(feet.y + 1),
    );
    this.tweens.add({
      targets: mark,
      y: mark.y - RESULT_RISE,
      alpha: 0,
      duration: RESULT_MS,
      ease: "Quad.easeIn",
      onComplete: () => mark.destroy(),
    });
  }

  /**
   * A refusal that is about her rather than about a square.
   *
   * Over her own head, because that is where the thing she is short of is —
   * in her hands. With an icon it says *you have none of these*; without one
   * it says *not here*, which is what standing indoors with a trowel means.
   */
  private showRefusalOnPlayer(icon?: string): void {
    const x = this.player.x;
    // Just clear of her hat rather than as high as the sprite is tall: a mark
    // floating a body's length above her head reads as belonging to the sky.
    const y = this.player.y - TILE_SIZE - RESULT_ICON / 2;
    const parts: Phaser.GameObjects.GameObject[] = [];
    const mark = this.add.graphics();
    const half = RESULT_ICON * 0.5;
    if (icon) {
      parts.push(this.add.image(0, 0, uiTextureKey(icon)).setDisplaySize(RESULT_ICON, RESULT_ICON));
      // One bar, not a cross. A cross over a picture hides the picture, and
      // the picture is the half that says *which* thing she has none of.
      mark.lineStyle(3, REFUSAL_COLOR, 1);
      mark.lineBetween(-half, half, half, -half);
    } else {
      mark.lineStyle(3, REFUSAL_COLOR, 1);
      mark.lineBetween(-half, -half, half, half);
      mark.lineBetween(half, -half, -half, half);
    }
    parts.push(mark);
    const shown = this.world(this.add.container(x, y, parts).setDepth(this.player.depth + 1));
    this.tweens.add({
      targets: shown,
      y: y - RESULT_RISE / 2,
      alpha: 0,
      duration: REFUSAL_MS,
      ease: "Quad.easeIn",
      onComplete: () => shown.destroy(),
    });
  }

  /**
   * The rune that says a spell is armed and waiting.
   *
   * Over her head and pulsing, for as long as a spell is expecting a square.
   * It follows her, because she can walk about while she decides —
   * and a mark that stayed where the spell was cast would be a mark about a
   * square she is no longer near.
   */
  private raiseArmedRune(rune_: string): void {
    this.armedRune?.destroy();
    const rune = this.world(
      this.add.image(0, 0, uiTextureKey(rune_)).setDisplaySize(RESULT_ICON, RESULT_ICON),
    );
    this.armedRune = rune;
    this.tweens.add({
      targets: rune,
      alpha: { from: 1, to: 0.4 },
      duration: ARMED_PULSE_MS,
      yoyo: true,
      repeat: -1,
    });
  }

  /** Keep it over her head, wherever she has walked to. */
  private placeArmedRune(): void {
    const rune = this.armedRune;
    if (!rune) return;
    rune.setPosition(this.player.x, this.player.y - TILE_SIZE - RESULT_ICON / 2);
    rune.setDepth(this.player.depth + 1);
  }

  /**
   * Nothing is drawn when a cast is abandoned, and that is deliberate.
   *
   * The spell's rune used to fade out where the cast was aimed. It read as a
   * *result*: a rune over the player, moving, is what earning one looks like
   * and close enough to what casting one looks like that a playtest could
   * not tell a closed parchment from a finished spell. Closing a parchment
   * is not an event and does not need announcing — the parchment closing is
   * the whole of it.
   */

  /**
   * A spell just earned: its rune, rising bright over her head.
   *
   * The same picture the spellbook has been showing dimmed since the day she
   * started, arriving. Nothing else in the game needs saying at that moment
   * — she taps the book and the rune she has been looking at is lit.
   */
  private showEarned(rune: string): void {
    const mark = this.world(
      this.add
        .image(this.player.x, this.player.y - TILE_SIZE, uiTextureKey(rune))
        .setDisplaySize(RESULT_ICON, RESULT_ICON)
        .setDepth(this.player.depth + 1),
    );
    this.tweens.add({
      targets: mark,
      y: mark.y - RESULT_RISE * 1.5,
      scale: mark.scale * 1.6,
      alpha: 0,
      duration: EARNED_MS,
      ease: "Quad.easeOut",
      onComplete: () => mark.destroy(),
    });
  }

  /**
   * Chevrons from her feet to the square she could not reach.
   *
   * Every other refusal is answered by doing something different; this one is
   * answered by *walking*, and a cross alone does not say that. A short trail
   * pointing the way does, in the one language a child who cannot read still
   * has.
   */
  private markTooFar(col: number, row: number): void {
    const to = this.toFeet(col, row);
    const from = { x: this.player.x, y: this.player.y };
    const trail = this.world(this.add.graphics().setDepth(to.y + 1));
    trail.fillStyle(REFUSAL_COLOR, 1);
    for (let step = 1; step <= TOO_FAR_STEPS; step++) {
      const along = step / (TOO_FAR_STEPS + 1);
      trail.fillCircle(
        from.x + (to.x - from.x) * along,
        from.y - TILE_SIZE / 2 + (to.y - from.y) * along,
        TOO_FAR_DOT,
      );
    }
    this.tweens.add({
      targets: trail,
      alpha: 0,
      duration: REFUSAL_MS,
      ease: "Quad.easeIn",
      onComplete: () => trail.destroy(),
    });
  }

  /**
   * A short red mark over one tile, and then gone.
   *
   * Drawn rather than an effect sprite: it belongs to the interface, not to
   * the world, and it has to appear on any tile at all — including the ones
   * off the edge of the map that a refusal can name.
   *
   * A cross rather than an outline or a tint. An outline reads as *selected*
   * and a tint reads as terrain, and both are things the game already says
   * elsewhere; a cross is the one mark that means no and nothing else. It
   * fades rather than blinking, so a child looking a beat late still sees
   * it.
   */
  private markRefusal(col: number, row: number): void {
    const feet = this.toFeet(col, row);
    const mark = this.world(this.add.graphics());
    const half = TILE_SIZE * 0.3;
    // Drawn about its own origin and then *moved* to the tile, rather than
    // drawn at the tile's world coordinates. A Graphics scales about (0, 0),
    // so geometry plotted four thousand pixels out flies off the camera the
    // instant the tween touches its scale — which is exactly what it did.
    mark.lineStyle(3, REFUSAL_COLOR, 1);
    mark.lineBetween(-half, -half, half, half);
    mark.lineBetween(half, -half, -half, half);
    mark.setPosition(feet.x, feet.y - TILE_SIZE / 2);
    // Above whatever it is refusing about — a crop already on the tile draws
    // at the tile's own depth, and a cross behind a sunflower is no answer.
    mark.setDepth(feet.y + 1);
    this.tweens.add({
      targets: mark,
      alpha: 0,
      scale: 1.25,
      duration: REFUSAL_MS,
      ease: "Quad.easeIn",
      onComplete: () => mark.destroy(),
    });
  }

  private growCropAt(col: number, row: number): void {
    // And ripening a crop is the other. See `clearAt`.
    this.time.delayedCall(0, () => this.checkGrove());
    const result = this.session.growAt(col, row);
    if (!result.ok || !result.crop) return;
    // The plus lands on the tile it is being added to, which is the whole of
    // what the effect has to say.
    this.playEffect(EffectType.Plus, col, row);
    // Growth is a change of animation, not of sprite: the generator ships one
    // sheet per crop with a row per stage, so the same object keeps playing
    // further along its own reel.
    this.cropSprites
      .get(tileKey(col, row))
      ?.play(plantAnimKey(result.crop.plant, result.crop.stage));
  }

  // --- The store ----------------------------------------------------------
  //
  // Sell what you pick, buy something to put down with the proceeds. The
  // shopkeeper is the door into it: she is tapped like a crop, because she
  // is a thing in the world with something to say, and a keyboard shortcut
  // for a person standing in one place would be a shortcut to walking there.

  /**
   * Make whoever works in this room tappable.
   *
   * Same tile-sized hit area as a crop, and for the same reason: a character
   * frame is a tile wide and half a tile taller, so the default area would
   * reach into the tile above and answer for taps aimed at whatever is
   * standing there. She wanders, but the area is in the sprite's own space
   * and moves with her.
   *
   * The consequence worth stating: if she wanders onto a tile with a crop on
   * it, a tap there talks to her rather than picking it. That is the right
   * way round — you tapped a person.
   */
  private watchAttendant(
    sprite: Phaser.GameObjects.Sprite,
    at: () => GridPoint,
    talk: () => void,
  ): void {
    const frame = sprite.frame;
    sprite.setInteractive(
      new Phaser.Geom.Rectangle(0, frame.realHeight - TILE_SIZE, TILE_SIZE, TILE_SIZE),
      Phaser.Geom.Rectangle.Contains,
    );
    sprite.on("pointerdown", () => {
      if (this.pointerIsSpokenFor) return;
      // Within one step in *any* direction, diagonals included — unlike
      // harvesting, which measures orthogonally because it acts on the tile
      // the player faces and there is no diagonal facing to turn to. Talking
      // to someone needs no facing, so standing at her corner is standing
      // next to her, and refusing that would be a rule with no reason behind
      // it that the player could see.
      if (stepsToSpeak(this.session.tile, at()) > 1) {
        const there = at();
        this.markRefusal(there.col, there.row);
        this.markTooFar(there.col, there.row);
        return;
      }
      talk();
    });
  }

  /**
   * Make the one big thing in a place tappable.
   *
   * Not `watchAttendant`: that reserves the sprite's bottom-left tile, which
   * on a landmark is the left overhang and therefore empty air. The area
   * here is the footprint's own columns over the sprite's full height — the
   * trunk and the crown above it — and deliberately not the overhang, so a
   * tap on the ground beside the tree is still a tap on the ground.
   *
   * The reach is measured to the nearest cell it stands on rather than to
   * one named cell. A thing three tiles wide has no single position to be
   * next to, and picking one would make two of its three sides refuse a
   * player who is plainly standing against it.
   */
  private watchLandmark(
    sprite: Phaser.GameObjects.Sprite,
    object: PlacedObject,
    sidecar: LandmarkSidecar,
    talk: () => void,
  ): void {
    const width = sidecar.footprint_tiles.width * TILE_SIZE;
    const inset = (sprite.frame.realWidth - width) / 2;
    sprite.setInteractive(
      new Phaser.Geom.Rectangle(inset, 0, width, sprite.frame.realHeight),
      Phaser.Geom.Rectangle.Contains,
    );
    sprite.on("pointerdown", () => {
      if (this.pointerIsSpokenFor) return;
      const near = sidecar.blocked_cells_relative_to_anchor.reduce(
        (best, [row, col]) =>
          Math.min(
            best,
            stepsToSpeak(this.session.tile, { col: object.col + col, row: object.row + row }),
          ),
        Number.POSITIVE_INFINITY,
      );
      if (near > 1) {
        this.markRefusal(object.col, object.row);
        this.markTooFar(object.col, object.row);
        return;
      }
      talk();
    });
  }

  /**
   * The teacher's lesson.
   *
   * Same shape as the shop and for the same reason: she is a person standing
   * in a room, so the way in is tapping her rather than a key that would be
   * a shortcut to walking over.
   */
  /**
   * The welcome, from whoever is giving it.
   *
   * Opened by him arriving the first time and by a tap after that. Marked as
   * seen on the way *in* rather than on the way out: a player who shuts it
   * halfway has still been offered it, and re-opening it on their next visit
   * would read as the game not having noticed they closed it.
   */
  private openIntro(): void {
    if (this.modalOpen) return;
    this.introToGive = false;
    this.joystick?.release();
    this.closeTrays();
    this.rememberIntroSeen();
    // No greeting. The panel he opens is the greeting.
    this.introPanel?.open_(() => {});
  }

  /**
   * Note that the welcome has been given — to *this child*.
   *
   * Its own method rather than a trip through `applySettings`: nothing about
   * this changes the language, and going through the general path once
   * cleared the message line — swallowing the very greeting it was about to
   * show — which is the kind of thing that comes back the next time that
   * method learns to do something else.
   */
  private rememberIntroSeen(): void {
    if (this.profile.introSeen) return;
    this.saveProfileChange({ introSeen: true });
  }

  /**
   * Write a change to the child, keeping the copy this scene holds in step.
   *
   * Nothing is written for an anonymous run: a script that jumped straight
   * into the game would otherwise leave a player on the who's-playing screen
   * the next morning that nobody made.
   */
  private saveProfileChange(change: Partial<Profile>): void {
    this.profile = { ...this.profile, ...change, lastPlayed: Date.now() };
    if (this.anonymous) return;
    saveProfile(browserStore(), this.profile);
  }

  /**
   * The geometer's lesson.
   *
   * The portal spell's own parchment offers help only after two wrong
   * answers, and its top rungs want squares and roots — which is the one
   * thing in this game a child could be stuck on with no way to ask and no
   * chance of guessing. He is the way to ask.
   */
  private openGeometryLesson(): void {
    if (this.modalOpen) return;
    this.joystick?.release();
    this.closeTrays();
    // Meeting him is what teaches it. Said once — `learnSpell` gives back the
    // same list when it already knows, so the announcement cannot repeat
    // every time a child says hello to him.
    const learned = learnSpell(this.profile.learned, Spell.Portal);
    const first = learned !== this.profile.learned;
    if (first) {
      this.saveProfileChange({ learned });
      this.spellTray?.refresh();
    }
    if (first) this.showEarned(UiAsset.RunePortal);
    this.geometryPanel?.setRung(portalRungAt(this.dev.portalRung ?? this.profile.portalRung));
    this.geometryPanel?.open_(() => {});
  }

  /**
   * What a landmark says when it is touched.
   *
   * Only the great tree teaches anything yet. The beacon and the town clock
   * answer with a line about the place they stand in rather than staying
   * silent: a thing that size which you walk up to and which does nothing
   * reads as broken, and one line each is cheaper than the alternative of
   * making them untouchable. When the harbour and the city have spells to
   * teach, this is where those lessons hang.
   */
  private touchLandmark(landmark: LandmarkType): void {
    if (landmark === LandmarkType.GreatTree) {
      this.openGroveLesson();
      return;
    }
    // Nothing to say and nothing to do. A lighthouse and a clock tower are
    // there to be seen from across the world, and touching one is how a
    // child finds out that they are the sort of thing you cannot go inside.
    this.markRefusal(this.session.tile.col, this.session.tile.row);
  }

  /**
   * The astronomer, and the climb she asks to have lit.
   *
   * The fourth teacher and the second to set a task. Hers is the smallest of
   * the two: five lamps up the path to her door, so that the way to the one
   * place in the world that cares about the hour can be walked after dark.
   *
   * **She supplies the lamps.** They are eight crops each in the store —
   * forty harvests for five, which is eighty number lines and a quest about
   * money rather than about time. So she tops the child up to however many
   * posts are still dark, which needs no record of what she has given: the
   * unlit posts *are* the record, and nobody can come away with more lamps
   * than there are places to put them.
   */
  private meetAstronomer(): void {
    if (this.modalOpen) return;
    this.joystick?.release();
    this.closeTrays();
    const observatory = this.observatory;
    if (!observatory) return;
    const lit = lampsLit(this.worldGrid, observatory);
    if (lit >= observatory.posts.length) {
      const learned = learnSpell(this.profile.learned, Spell.Hourglass);
      if (learned !== this.profile.learned) {
        this.saveProfileChange({ learned });
        this.spellTray?.refresh();
        this.showEarned(UiAsset.RuneHourglass);
      }
    } else {
      // Topped up to the posts a lamp could go on, never beyond them.
      // Against the dark ones instead, a post with a fence on it would be a
      // post she could never light and a lamp handed over on every visit for
      // ever. A post that is blocked simply is not offered, and the row on
      // the parchment says so by staying dim.
      const free = postsFree(this.worldGrid, observatory);
      const short = Math.max(0, free - this.inventory.count(FixtureType.Lamp));
      if (short > 0) {
        this.inventory.add(FixtureType.Lamp, short);
        this.refreshCarried();
      }
    }
    // The errand itself, drawn: five posts with the lit ones lit, and the
    // rune underneath, dim until it is hers. What she used to say in a line
    // of small type is a row a child can count.
    this.taskPanel?.show(
      {
        token: itemIcon(FixtureType.Lamp),
        needed: observatory.posts.length,
        done: lit,
        reward: UiAsset.RuneHourglass,
      },
      () => {},
    );
  }

  /**
   * The great tree's lesson, and the task that earns the spell.
   *
   * It used to teach the spell for being touched, the way the geometer
   * teaches the portal spell for being spoken to. That was too cheap for
   * this one: two array casts take twelve crops from seed to ripe where the
   * one-at-a-time route is twenty-four number lines, so a spell handed over
   * on a tap is a spell that quietly removes most of the arithmetic in the
   * game. It is earned by doing the long way once — clear the ground, fill
   * the bed, ripen every square — which is not a gate bolted on but the
   * lesson itself: a child who has filled twelve squares by hand knows in
   * their hands why `4 x 3` is worth having.
   *
   * **Nothing is hidden while they work.** The lesson opens on the first
   * visit and every visit after, so the picture they are working toward and
   * the spell they will get are both in front of them from the start.
   *
   * `learnSpell` gives back the same list when it already knows, so the
   * announcement lands exactly once however many times they come back.
   */
  private openGroveLesson(): void {
    if (this.modalOpen) return;
    this.joystick?.release();
    this.closeTrays();
    const progress = groveProgress(this.worldGrid, this.grove);
    const learned =
      progress.task === GroveTask.Done
        ? learnSpell(this.profile.learned, Spell.Array)
        : this.profile.learned;
    const first = learned !== this.profile.learned;
    if (first) {
      this.saveProfileChange({ learned });
      this.spellTray?.refresh();
    }
    // Only the moment of learning goes to the message line. What the tree is
    // still asking for used to go there too — behind the panel this call then
    // opened over it, in the smallest type the game has — and is now the
    // panel's own first page, where it is read rather than missed.
    if (first) this.showEarned(UiAsset.RuneTimes);
    this.grovePanel?.setRung(arrayRungAt(this.dev.arrayRung ?? this.profile.arrayRung));
    // The shape of one bed and how many there are, which is what the panel
    // draws: four squares of two by two rather than one block of twelve.
    this.grovePanel?.setTask(progress, {
      rows: this.grove.beds[0]?.height ?? 2,
      columns: this.grove.beds[0]?.width ?? 2,
      beds: this.grove.beds.length,
    });
    this.grovePanel?.open_(() => {});
  }

  private openLesson(): void {
    if (this.modalOpen) return;
    this.joystick?.release();
    this.closeTrays();
    // No greeting: her lesson opens over the top of it.
    this.lessonPanel?.open_(() => {});
  }

  private openShop(): void {
    // Deliberately no indoor check, unlike every gardening action: the shop
    // is *inside* the store, so refusing it in there would refuse it
    // everywhere. The only way to reach this is tapping the shopkeeper, and
    // she is only ever in the one room.
    if (this.modalOpen) return;
    // A stick still held when a panel opens never sends its release, and the
    // player walks off the moment it closes.
    this.joystick?.release();
    this.closeTrays();
    this.shopPanel.open_(
      () => {
        this.refreshCarried();
      },
      // The bar stays on screen beside the panel, so a sale has to reach it
      // as it happens rather than when the shop closes — otherwise the
      // basket sits there claiming to hold what was just sold.
      () => this.refreshCarried(),
    );
  }

  /**
   * Where each named button is on screen right now.
   *
   * Scripts used to copy these out of the layout code by hand, and the day
   * the action bar grew a fourth slot every one of them silently pointed at
   * its neighbour — a test that meant to cast a spell planted a seed instead,
   * and the symptom surfaced three steps later as a tray that would not open.
   */
  private uiPositions(): Record<string, { x: number; y: number }> {
    const positions: Record<string, { x: number; y: number }> = {};
    if (this.optionsButton) {
      const { x, y } = this.optionsButton.box;
      positions.options = { x: x - 37, y: y + 12 };
    }
    for (const [name, tray] of Object.entries(this.trays())) {
      if (!tray) continue;
      positions[name] = tray.containerPosition();
      for (const [index, item] of tray.itemPositions().entries()) {
        positions[`${name}.${index}`] = item;
      }
    }
    for (const [index, at] of (this.patchMenu?.buttonPositions() ?? []).entries()) {
      positions[`patch.${index}`] = at;
    }
    if (this.optionsPanel?.isOpen) Object.assign(positions, this.optionsPanel.buttonPositions());
    return positions;
  }

  /**
   * The options button: a corner of the screen, out of the action bar.
   *
   * Not a fifth tray. The trays are things she does to the world and this is
   * a thing she does to the game, and the day the bar grew a fourth slot
   * every hand-copied coordinate in the test scripts pointed at its
   * neighbour — a settings button among them would be one more to shift.
   */
  private createOptionsButton(): void {
    const box = this.ui(
      this.add
        .rectangle(0, 0, 74, 24, 0x1b1710, 0.65)
        .setOrigin(1, 0)
        .setStrokeStyle(1, 0xd8c08a, 0.8)
        .setScrollFactor(0)
        .setDepth(HUD_DEPTH)
        .setInteractive({ useHandCursor: true }),
    );
    const label = this.ui(
      this.add
        .text(0, 0, "", { fontFamily: "monospace", fontSize: "12px", color: "#f0e0b8" })
        .setOrigin(1, 0)
        .setScrollFactor(0)
        .setDepth(HUD_DEPTH),
    );
    box.on("pointerdown", () => this.openOptions());
    this.optionsButton = { box, label };
    this.placeOptionsButton();
  }

  private placeOptionsButton(): void {
    if (!this.optionsButton) return;
    const right = this.scale.width - HUD_MARGIN;
    this.optionsButton.box.setPosition(right, HUD_MARGIN);
    this.optionsButton.label.setPosition(right - 8, HUD_MARGIN + 5);
  }

  /**
   * Out of sight while a popup is up.
   *
   * `openOptions` refuses anyway, but a button that looks the same and does
   * nothing reads as broken — this game has already lost several debugging
   * passes to exactly that.
   */
  private refreshOptionsButton(): void {
    this.optionsButton?.label.setText(this.words.optionsButton);
    const shown = !this.modalOpen;
    this.optionsButton?.box.setVisible(shown);
    this.optionsButton?.label.setVisible(shown);
  }

  private openOptions(): void {
    if (this.modalOpen) return;
    this.closeTrays();
    this.optionsPanel?.open_(() => this.refreshOptionsButton());
  }

  /**
   * A choice was made: apply it everywhere it shows, then remember it.
   *
   * One place, because the words are read by every panel on screen and a
   * change that reached half of them would leave the game speaking two
   * languages at once.
   */
  /**
   * Put this child's world back, or explain why it could not be.
   *
   * Runs before anything is drawn or spawned, so a restored fence is spawned
   * by the same pass that spawns the village's own and nothing has to be
   * added to a scene already running.
   */
  private restoreSavedWorld(): void {
    const saved = this.savedGame.world;
    // When the ground was last written down, read *before* the autosave
    // timer starts moving it. The hourglass reads this as "when you put the
    // game down"; asked later it would find the answer creeping up to now
    // and pay nothing. `?away=` fakes it, because the alternative way to see
    // this spell is to close the game and come back in an hour.
    this.awayFrom =
      this.dev.away === null ? savedAtOf(saved) : Date.now() - this.dev.away * 60 * 60 * 1000;
    if (saved) restoreWorld(this.grid, saved.world);
    // The child's own things come from their progress in this game, never
    // from the ground — which is why a world the generator can no longer
    // rebuild cannot cost them a coin. `loadGame` drops such a world and
    // keeps everything else, so what is missing here is only the tile they
    // were standing on.
    restorePlayer(this.session, this.profile.carried, saved !== null);
  }

  /**
   * Write the world down, if it has changed since the last time.
   *
   * On a timer rather than at every action. Hanging a save off each of
   * planting, picking, buying and placing means the next thing that changes
   * the world has to remember to do it too, and the one that forgets is
   * found by a child losing an afternoon. A snapshot walks two sparse maps
   * and an object list, which is cheap enough to simply do.
   *
   * The comparison is against what was last *written*, so an idle game does
   * not rewrite the same bytes into storage every few seconds.
   */
  private autosave(): void {
    // A game that is being left for another must not be written back. Three
    // things call this besides the timer — `visibilitychange`, `pagehide`
    // and the scene's own shutdown — and the reload that follows switching
    // games fires at least two of them, so the guard belongs here rather
    // than at any of the call sites.
    if (this.leavingGame) return;
    const store = browserStore();
    const now = Date.now();
    // The ground, which everybody in this game shares.
    const snapshot = snapshotGame(this.worldGrid, this.baseline, this.seed, now);
    // And this child's own things, which nobody else's game may touch. Kept
    // separate all the way down: a shared purse would let one child spend
    // what another earned, and the crops in a basket belong to whoever
    // picked them.
    const outdoorAt = this.interior ? this.interior.returnTo : this.session.tile;
    if (!this.anonymous) {
      this.profile = { ...this.profile, carried: snapshotPlayer(this.session, outdoorAt) };
    }
    // Compared without its timestamp: the stamp changes every tick, so a
    // game nobody has touched would be rewritten every few seconds and the
    // "nothing changed, do not write" check would never fire again.
    const next: SavedGame = this.anonymous
      ? { ...this.savedGame, world: snapshot, savedAt: now }
      : withProgress({ ...this.savedGame, world: snapshot }, this.profile, now);
    const written = JSON.stringify({ ...next, savedAt: 0 });
    if (written === this.lastSaved) return;
    this.lastSaved = written;
    this.savedGame = next;
    writeGame(store, next);
    if (!this.anonymous) saveProfile(store, this.profile);
  }

  /**
   * Open another game, or a new one.
   *
   * Reloading rather than rebuilding the scene in place. Switching games is
   * rare, it is asked for by an adult, and a page that starts again from
   * nothing cannot leave a stale sprite or a dangling timer behind — which a
   * scene restart, with this many pools and panels, very well might.
   *
   * Nothing is thrown away. The game being left is written down first and
   * stays exactly where it is; that is the whole difference between this and
   * the button it replaced, which had one outcome and it was *lose
   * everything*.
   */
  /**
   * Throw the game she is in away, and open whatever is left.
   *
   * Only the open one may be thrown away — see `OptionsPanel` — so there is
   * nothing to identify beyond "this one", and the id is passed only so the
   * panel does not have to know which that is.
   */
  private throwGameAway(id: string | null): void {
    if (!id) return;
    this.leavingGame = true;
    deleteGame(browserStore(), id);
    globalThis.location.reload();
  }

  private openAnotherGame(id: string | null): void {
    this.autosave();
    // From here on nothing may write this game back: the reload fires
    // `pagehide` and `visibilitychange` on its way out.
    this.leavingGame = true;
    const store = browserStore();
    if (id) setPlaying(store, id);
    else newGame(store, Math.random(), Date.now());
    globalThis.location.reload();
  }

  /**
   * Somebody changed which sums this child gets.
   *
   * Only ever from the options panel: the band is a choice a person makes,
   * never one the game makes. It moves the child to the bottom of the new
   * band rather than to a proportional place in it, because a band is picked
   * when the last one turned out to be wrong and starting gently is the
   * kinder half of being wrong in either direction.
   */
  private applyBand(band: number): void {
    if (band === this.profile.band) return;
    this.recentCasts = [];
    this.saveProfileChange({ band, rung: bandAt(band).from });
    this.applyCropPrice();
    this.applyRung();
  }

  private applyCropPrice(): void {
    const price = bandAt(this.profile.band).cropPrice;
    this.session.cropPrice = price;
    // The store asks the session rather than being handed a copy: it works
    // out what the counter shows and the session charges the purse, and two
    // copies of one price is two things that can disagree.
    this.shopPanel?.bindCropPrice(() => this.session.cropPrice);
  }

  /**
   * Tell the teacher which sums this child is getting.
   *
   * Called whenever the rung moves as well as at the start, so a child who
   * climbs a rung and then goes to ask does not get a lesson on the sums
   * they were doing yesterday.
   */
  private applyRung(): void {
    this.lessonPanel?.setRung(rungAt(this.profile.rung));
  }

  private applySettings(next: Settings): void {
    this.settings = next;
    // The language belongs to the child, not to the device — two siblings on
    // one tablet do not have to read the same one. The device copy follows
    // along so that tomorrow's who's-playing screen is written in the
    // language of whoever last played.
    this.saveProfileChange({ language: next.language });
    writeSettings(browserStore(), next);
    this.words = phrasesFor(next.language);
    this.spellPopup?.setPhrases(this.words);
    this.optionsPanel?.setPhrases(this.words);
    this.aboutPanel?.setPhrases(this.words);
    this.lessonPanel?.setPhrases(this.words);
    this.introPanel?.setPhrases(this.words);
    this.mapPanel?.setPhrases(this.words);
    this.portalPanel?.setPhrases(this.words);
    this.geometryPanel?.setPhrases(this.words);
    this.shopPanel?.setPhrases(this.words);
    // The line on screen was written in the old language by whatever the
    // player last did; it would otherwise sit there until they did something
    // else. Clearing it is honest — re-translating a past event is not.
  }

  private trays(): Record<string, IconTray | undefined> {
    return {
      spellbook: this.spellTray,
      seeds: this.seedTray,
      basket: this.basketTray,
      crate: this.crateTray,
      purse: this.purseTray,
    };
  }

  /**
   * The coins of one kind the purse holds.
   *
   * Counted out the way the shopkeeper counts, largest first, so what the
   * button says matches what the counter would put in front of the player.
   */
  private coinsOfTier(tier: CoinTier): number[] {
    // Rounded down to something the coins can actually express. The smallest
    // coin is one ray and every price is a whole number of them, so this only
    // ever bites on a purse handed in from outside — and the alternative is a
    // breakdown that says the purse is empty while the badge says 52.
    const smallest = smallestCoin(CURRENCY);
    const payable = this.purse.coins - (this.purse.coins % smallest);
    return coinsFor(CURRENCY, payable).filter((coin) => coinTier(CURRENCY, coin) === tier);
  }

  private closeTrays(): void {
    for (const tray of Object.values(this.trays())) tray?.setOpen(false);
    // And the array spell's marker, if one is half drawn. State surviving a
    // transition is this codebase's recurring bug — scenery across a portal,
    // a tray behind a popup, the great tree's own cell — and a rectangle
    // still glowing on ground the player has left is the same thing again.
    this.stopMarking();
  }

  /** Both badges that count what she is holding, after anything moves it. */
  private refreshCarried(): void {
    this.purseTray?.refresh();
    this.basketTray?.refresh();
    this.crateTray?.refresh();
  }

  /**
   * Put one bought fixture on the tile ahead.
   *
   * Same tile every gardening action works on, for the same reason. Placed
   * things block the way, which is a state the player can walk herself into
   * a corner with — so the answer is not a connectivity check before every
   * placement but that **anything she put down, she can pick back up**: tap
   * it and it returns to the crate. A fence that boxed her in is adjacent by
   * definition, so it is always within reach.
   */
  private placeFixture(fixture: FixtureType): void {
    if (this.modalOpen) return;
    const result = this.session.place(fixture);
    this.report(result, itemIcon(fixture));
    if (!result.ok || !result.tile || !result.object) return;

    const { col, row } = result.tile;
    const sidecar = this.fixtureSidecars.get(fixture);
    if (!sidecar) throw new Error(`no art loaded for fixture "${fixture}"`);
    const sprite = this.spawnFootprintSprite(
      result.object,
      sidecar,
      fixtureSheetKey(fixture),
      fixtureAnimKey(fixture),
    );
    this.watchPlacedFixture(sprite, fixture, col, row);
    this.placedFixtures.set(tileKey(col, row), sprite);
    if (fixture === FixtureType.Lamp) this.lightLamp(col, row);
    this.playGesture(PLANT); // she bends to set it down, same as planting
    this.refreshCarried();
    this.paintSockets();
  }

  /**
   * Make a placed fixture tappable, so it can be taken back.
   *
   * Only ones the player put down: the village well goes through the same
   * spawner and is deliberately left alone, because it is not hers.
   */
  private watchPlacedFixture(
    sprite: Phaser.GameObjects.Sprite,
    fixture: FixtureType,
    col: number,
    row: number,
  ): void {
    const frame = sprite.frame;
    sprite.setInteractive(
      new Phaser.Geom.Rectangle(0, frame.realHeight - TILE_SIZE, TILE_SIZE, TILE_SIZE),
      Phaser.Geom.Rectangle.Contains,
    );
    sprite.on("pointerdown", () => {
      if (this.pointerIsSpokenFor) return;
      this.takeFixture(fixture, col, row);
    });
  }

  private takeFixture(fixture: FixtureType, col: number, row: number): void {
    if (this.modalOpen) return;
    const result = this.session.takeBack(fixture, col, row);
    this.report(result, itemIcon(fixture));
    if (!result.ok) return;
    const key = tileKey(col, row);
    this.placedFixtures.get(key)?.destroy();
    this.placedFixtures.delete(key);
    this.snuffLamp(col, row);
    this.refreshCarried();
    this.paintSockets();
  }

  // --- Harvesting ---------------------------------------------------------
  //
  // One rule, whichever way the player asks: **she can pick a crop she is
  // facing, or one she is standing on.** The H key applies it where she is;
  // a tap on a crop beside her turns her toward it first and then applies the
  // same rule, which is both the better feel and the reason the two routes
  // cannot drift into meaning different things.
  //
  // Harvesting is a direct action rather than a spell, in the same way
  // planting is, and for the same reason: the harvest spell is not speced.

  private tryHarvest(): void {
    if (this.modalOpen) return;
    const result = this.session.harvest();
    this.report(result, result.crop ? cropIcon(result.crop.plant) : undefined);
    if (!result.ok || !result.tile) return;

    // The sprite has to go *and* leave the registry: a stale entry would have
    // the growth spell re-animating a destroyed object the next time this
    // tile was planted and cast on.
    const key = tileKey(result.tile.col, result.tile.row);
    this.cropSprites.get(key)?.destroy();
    this.cropSprites.delete(key);

    // The basket can be open while this happens — picking a crop does not
    // close it — so the numbers on screen have to be told, not just the ones
    // that will be read the next time it opens.
    this.refreshCarried();
    this.playGesture(PLANT); // the same bend; she is reaching for the ground either way
  }

  /**
   * A tap on a crop, from the sprite's own hit area.
   *
   * Turning to face it is what lets one rule serve both routes: after this,
   * the crop is the faced tile and `tryHarvest` is the same code the H key
   * runs. A crop further off than one step is not reached for — walking there
   * on a tap would be a second kind of tap-to-move, and tapping the world to
   * walk is exactly what the joystick replaced on touch.
   */
  private handleCropTap(col: number, row: number): void {
    if (this.modalOpen || this.interior) return;
    const dCol = col - this.playerCol;
    const dRow = row - this.playerRow;
    const steps = Math.abs(dCol) + Math.abs(dRow);
    if (steps > 1) {
      this.markRefusal(col, row);
      this.markTooFar(col, row);
      return;
    }
    if (steps === 1) this.session.turnToward(dCol, dRow);
    this.tryHarvest();
  }

  private tryPlant(): void {
    if (this.modalOpen) return;
    const plant = PLANT_TYPES[this.selectedPlantIndex] ?? PLANT_TYPES[0];
    if (!plant) return;

    const result = this.session.plant(plant);
    this.report(result, cropIcon(plant));
    if (!result.ok || !result.tile) return;

    const { col, row } = result.tile;
    this.spawnCropSprite(col, row, { plant, stage: PLANTED_STAGE });
    this.playGesture(PLANT);
  }

  /**
   * Put a crop on screen, at whatever stage it has reached.
   *
   * Shared by planting and by loading, which is the point of it being its
   * own method: a saved garden used to come back in the grid and nowhere
   * else — every rule agreed the carrots were there, and the ground the
   * child was looking at was bare.
   */
  private spawnCropSprite(col: number, row: number, crop: Crop): void {
    const feet = this.toFeet(col, row);
    const sprite = this.world(
      this.add
        .sprite(feet.x, feet.y, plantSheetKey(crop.plant))
        .setOrigin(0.5, 1)
        // Half a pixel behind whatever stands on the same tile, so the
        // player walking over their own crop is in front of it rather than
        // flickering against it on a depth tie.
        .setDepth(feet.y - 0.5)
        .play(plantAnimKey(crop.plant, crop.stage)),
    );
    this.watchCrop(sprite, col, row);
    this.cropSprites.set(tileKey(col, row), sprite);
  }

  /**
   * Make a crop tappable, over its own tile and no more.
   *
   * A crop's frame is a tile wide and half a tile taller — the headroom a
   * sunflower grows into — so the default hit area, which is the whole frame,
   * would reach into the tile above and overlap the crop planted there. Two
   * neighbours would then be resolved by depth rather than by which one was
   * aimed at. The area is cut back to the cell the crop actually occupies,
   * derived from the frame rather than restated: the soil patch is drawn
   * there, so there is always something visible to aim at.
   *
   * Crops that are not ready are tappable too. If only ripe ones were, a tap
   * on a seedling would fall through to the scene and walk the player, which
   * reads as the game ignoring them.
   */
  private watchCrop(sprite: Phaser.GameObjects.Sprite, col: number, row: number): void {
    const frame = sprite.frame;
    sprite.setInteractive(
      new Phaser.Geom.Rectangle(0, frame.realHeight - TILE_SIZE, TILE_SIZE, TILE_SIZE),
      Phaser.Geom.Rectangle.Contains,
    );
    sprite.on("pointerdown", () => {
      if (this.pointerIsSpokenFor) return;
      this.handleCropTap(col, row);
    });
  }

  /**
   * A tap on bare ground: point at it if it is close, walk to it if it is not.
   *
   * Pointing is what a child does. Lining a character up with the square in
   * front of them is a thing an adult does without noticing, and a playtest
   * put it as *spell targeting is hard* — so a tap within three squares aims
   * everything at that square instead: planting, growing, clearing, picking
   * and putting down. Tapping the aimed square again lets it go.
   *
   * Beyond that ring the tap still means walk, because it always has and
   * because a child who taps somewhere far away means *go there*.
   */
  private handleTileClick(screenX: number, screenY: number): void {
    const target = this.toGrid(screenX, screenY);
    if (withinReach(this.session.tile, target)) {
      const held = this.session.aimed;
      const same = held?.col === target.col && held?.row === target.row;
      this.session.aimAt(same ? null : target);
      this.paintAim();
      return;
    }
    if (!this.grid.isPassable(target.col, target.row)) {
      this.markRefusal(target.col, target.row);
      return;
    }
    const path = findPath(this.grid, { col: this.playerCol, row: this.playerRow }, target);
    if (!path) {
      // Walkable ground with no way to it. The cross goes on the square she
      // pointed at, which is the one she is looking at.
      this.markRefusal(target.col, target.row);
      return;
    }
    this.path = path;
  }

  // --- Buildings -----------------------------------------------------------
  //
  // One animated Sprite per placed building, positioned from its sidecar
  // rather than from any convention of ours: the generator states where to
  // draw the art relative to the footprint's top-left cell, and the art
  // overhangs upward by exactly the amount that offset encodes.
  //
  // Depth is the bottom of the footprint, so the player walking in front of
  // a building occludes it and walking behind it is occluded — the whole
  // reason a 3/4 view needs a depth sort at all.
  /**
   * Put the village's animals down, and drop the ones with nowhere to stand.
   *
   * `animalSpots` suggests positions from the layout and a seed; whether a
   * given tile is standable is the grid's business, which is why the two are
   * split. A suggestion that lands in a wall is simply one fewer chicken —
   * better than shoving it to the nearest free tile, which is how four
   * chickens end up in a row against a fence.
   */
  private spawnAnimals(well: PlacedObject, buildings: readonly PlacedObject[], rng: Rng): void {
    const taken = new Set<string>();
    for (const spot of animalSpots(well, buildings, rng)) {
      const { col, row } = spot.at;
      if (!this.grid.inBounds(col, row) || !this.grid.isPassable(col, row)) continue;
      // One to a tile. Two suggestions can land on the same cell, and two
      // animals standing in the same place used to be a curiosity nobody
      // noticed — it is two thought bubbles drawn exactly on top of each
      // other now, and only one of them can be tapped.
      if (taken.has(tileKey(col, row))) continue;
      taken.add(tileKey(col, row));
      const feet = this.toFeet(col, row);
      const sprite = this.world(
        this.add
          .sprite(feet.x, feet.y, animalSheetKey(spot.kind))
          .setOrigin(0.5, 1)
          .setDepth(feet.y),
      );
      const animal: AnimalRuntime = {
        id: `${spot.kind}-${this.animals.length}`,
        kind: spot.kind,
        character: animalSheetKey(spot.kind),
        facing: Facing.Down,
        homeCol: col,
        homeRow: row,
        wanderCenterCol: col,
        wanderCenterRow: row,
        wanderRadius: ANIMAL_RANGE[spot.kind as AnimalKind],
        col,
        row,
        sprite,
        isMoving: false,
        nextStepAt: 0,
        craves: spot.wants,
        ...this.firstMood(),
        fedAt: 0,
      };
      sprite.setInteractive({ useHandCursor: true });
      sprite.on("pointerdown", () => {
        if (this.pointerIsSpokenFor) return;
        this.feedAnimal(animal);
      });
      this.animals.push(animal);
      this.showThought(animal);
    }
  }

  /**
   * Where in its own cycle an animal starts.
   *
   * Dropped into the middle of one rather than started at the beginning.
   * Started at the beginning they are all quiet when the player arrives and
   * then, a minute later, all asking together — which is the very thing the
   * separate clocks exist to avoid. Picking a random point in the whole
   * ask-then-quiet round puts the village in its steady state from the first
   * frame.
   */
  private firstMood(): { mood: AnimalMood; moodUntil: number } {
    const now = this.time.now;
    if (this.dev.hungry) return { mood: AnimalMood.Asking, moodUntil: Number.POSITIVE_INFINITY };
    const round = ANIMAL_ASK_MAX_MS + ANIMAL_QUIET_MAX_MS;
    const at = Phaser.Math.Between(0, round);
    return at < ANIMAL_ASK_MAX_MS
      ? { mood: AnimalMood.Asking, moodUntil: now + at }
      : { mood: AnimalMood.Quiet, moodUntil: now + at - ANIMAL_ASK_MAX_MS };
  }

  /**
   * A cloud with nothing in it, for a beat, over an animal that was tapped
   * while it had nothing to ask for.
   *
   * Built by hand rather than through `showThought`, because that one owns
   * the animal's own bubble and this is a moment rather than a mood: it must
   * not survive the tap, and it must not overwrite what the animal is
   * actually thinking if it starts thinking something.
   */
  private puffEmptyThought(animal: AnimalRuntime): void {
    if (animal.bubble) return;
    const cloud = this.world(
      this.add
        .image(
          animal.sprite.x - BUBBLE_W / 2,
          animal.sprite.y - animal.sprite.displayHeight - BUBBLE_LIFT,
          uiTextureKey(UiAsset.ThoughtBubble),
        )
        .setOrigin(0, 1)
        .setDepth(animal.sprite.depth + 0.5),
    );
    this.tweens.add({
      targets: cloud,
      alpha: 0,
      duration: RESULT_MS,
      ease: "Quad.easeIn",
      onComplete: () => cloud.destroy(),
    });
  }

  /**
   * Move an animal on to what it is thinking about next.
   *
   * Asking runs out into silence and silence runs out into asking, on rolls
   * of their own; being glad runs out into the ten minutes a fed animal says
   * nothing for.
   */
  private turnMood(animal: AnimalRuntime, now: number): void {
    if (animal.mood === AnimalMood.Asking) {
      animal.mood = AnimalMood.Quiet;
      animal.moodUntil = now + Phaser.Math.Between(ANIMAL_QUIET_MIN_MS, ANIMAL_QUIET_MAX_MS);
    } else if (animal.mood === AnimalMood.Glad) {
      animal.mood = AnimalMood.Quiet;
      animal.moodUntil = now + ANIMAL_FED_QUIET_MS;
    } else {
      animal.mood = AnimalMood.Asking;
      animal.moodUntil = this.dev.hungry
        ? Number.POSITIVE_INFINITY
        : now + Phaser.Math.Between(ANIMAL_ASK_MIN_MS, ANIMAL_ASK_MAX_MS);
    }
    this.showThought(animal);
  }

  /**
   * The cloud over an animal's head, and what is in it.
   *
   * Rebuilt when the mood turns rather than kept and hidden: it is a handful
   * of objects a few times a minute, and the alternative is two sprites that
   * both have to be told which of them is showing.
   *
   * The crop icon is drawn at thirty-two everywhere else, because everywhere
   * else it is a button under a thumb; in here it is scaled to the slot,
   * because a chicken is eighteen pixels tall and the food has to fit in what
   * it is thinking.
   */
  private showThought(animal: AnimalRuntime): void {
    animal.bubble?.destroy();
    animal.bubble = undefined;
    if (animal.mood === AnimalMood.Quiet) return;
    const asking = animal.mood === AnimalMood.Asking;
    const marks = asking ? [cropIcon(animal.craves), UiAsset.MarkQuestion] : [UiAsset.MarkGlad];
    const span = marks.length * BUBBLE_SLOT + (marks.length - 1) * BUBBLE_SLOT_GAP;
    const left = BUBBLE_INNER_X + (BUBBLE_INNER_W - span) / 2;
    const middle = -BUBBLE_H + BUBBLE_INNER_Y + BUBBLE_INNER_H / 2;
    const cloud = this.add.image(0, 0, uiTextureKey(UiAsset.ThoughtBubble)).setOrigin(0, 1);
    const drawn = marks.map((mark, at) =>
      this.add
        .image(
          left + at * (BUBBLE_SLOT + BUBBLE_SLOT_GAP) + BUBBLE_SLOT / 2,
          middle,
          uiTextureKey(mark),
        )
        .setDisplaySize(BUBBLE_SLOT, BUBBLE_SLOT),
    );
    animal.bubble = this.world(this.add.container(0, 0, [cloud, ...drawn]));
    this.placeBubble(animal);
  }

  /**
   * Put the cloud where its animal is, this frame.
   *
   * Every frame rather than on each completed step: an animal spends most of
   * its time part-way between two cells, and a bubble that only moved when
   * the step finished would slide up behind its owner and then jump.
   *
   * Depth is the animal's own plus a hair, so the cloud is over the chicken
   * it belongs to and still behind anything standing in front of it.
   */
  private placeBubble(animal: AnimalRuntime): void {
    const bubble = animal.bubble;
    if (!bubble) return;
    bubble.setPosition(
      animal.sprite.x - BUBBLE_W / 2,
      animal.sprite.y - animal.sprite.displayHeight - BUBBLE_LIFT,
    );
    bubble.setDepth(animal.sprite.depth + 0.5);
  }

  /**
   * A tap on an animal: hand over what it is asking for, if you have it.
   *
   * The reach is `stepsToSpeak`, the same one a person answers on, diagonals
   * included — a chicken standing at your corner is a chicken you can hand a
   * carrot to, and refusing it would be a rule with no reason a child could
   * see.
   *
   * **Only an animal that is asking can be fed.** One thinking about nothing
   * says so and keeps its crop: a bubble that could be pre-empted would be a
   * bubble that meant nothing, and the ten quiet minutes after a meal would
   * be ten minutes a child could simply talk over.
   *
   * **Being fed is not written down anywhere.** The ten minutes are a timer
   * in memory, and what an animal craves comes back out of the world seed on
   * every load — so a chicken fed just before a reload is asking again after
   * it. The message says as much when a full one is tapped, because a child
   * who fed four of them and came back to four bubbles would otherwise read
   * it as the game having lost their afternoon.
   */
  private feedAnimal(animal: AnimalRuntime): void {
    if (this.modalOpen || this.marking) return;
    // Indoors the whole world layer is hidden, but a hidden sprite can still
    // be under a pointer as far as Phaser is concerned — and a chicken four
    // hundred tiles away answering a tap on somebody's floor would be a
    // puzzle with no visible cause.
    if (this.session.indoors) return;
    if (stepsToSpeak(this.session.tile, { col: animal.col, row: animal.row }) > 1) {
      this.markRefusal(animal.col, animal.row);
      this.markTooFar(animal.col, animal.row);
      return;
    }
    if (animal.mood !== AnimalMood.Asking) {
      // An empty cloud: it is thinking about nothing, which is exactly why
      // there was no bubble over it to begin with. Silence on a tap reads as
      // the game having missed the tap; an empty thought reads as an animal
      // with nothing on its mind, which is the true answer either way — a
      // full one and a not-hungry one both come to *not now*.
      this.puffEmptyThought(animal);
      return;
    }
    const wants = animal.craves;
    if (this.inventory.count(wants) <= 0) {
      // What she has none of, over her head. The bubble over the animal is
      // already saying which crop; this says the basket is empty of it.
      this.showRefusalOnPlayer(cropIcon(wants));
      return;
    }
    this.inventory.remove(wants, 1);
    animal.fedAt = this.time.now;
    animal.mood = AnimalMood.Glad;
    animal.moodUntil = this.time.now + ANIMAL_GLAD_MS;
    this.showThought(animal);
    this.refreshCarried();
    this.playGesture(PLANT); // she bends to hand it over, same as planting
    // The smile in its bubble says the rest.
  }

  private spawnPlacedObjects(objects: readonly PlacedObject[]): void {
    for (const object of objects) {
      const sprite = ROLE_SPRITES[object.type as BuildingRole];
      const sidecar = sprite ? this.buildingSidecars.get(sprite) : undefined;
      if (!sprite || !sidecar) {
        this.spawnNonBuilding(object);
        continue;
      }
      const origin = spriteOrigin(sidecar, object.col, object.row);
      const painted = this.houseSheetFor(object, sprite);
      const image = this.world(
        this.add
          .sprite(this.originX + origin.x, this.originY + origin.y, spriteSheetKey(painted))
          .setOrigin(0, 0)
          .setDepth(depthFor(footprintBottomY(sidecar, object.row)))
          .play(buildingAnimKey(painted, DoorState.Closed)),
      );
      const door = doorCell(sidecar, object.col, object.row);
      this.buildings.push({
        id: object.id,
        sprite,
        painted,
        image,
        doorCol: door.col,
        doorRow: door.row,
        entrance: entranceFor(door, object.col, sidecar.footprint_tiles.width),
        door: DoorState.Closed,
        windows: this.windowsOf(sprite, sidecar, origin),
        lightsAt: lightingDelay(object.id, this.seed),
      });
    }
  }

  // Anything placed that is not a building: today the village well. Throws
  // rather than drawing a placeholder, because a silent grey disc is how a
  // missing sprite survives to a release — and assets.test.ts checks every
  // type the village places resolves here, so this is unreachable in
  // practice and provably so.
  private spawnNonBuilding(object: PlacedObject): void {
    const fixture = fixtureFor(object.type);
    if (fixture) {
      const sidecar = this.fixtureSidecars.get(fixture);
      if (!sidecar) throw new Error(`no art loaded for fixture "${fixture}"`);
      this.spawnFootprintSprite(object, sidecar, fixtureSheetKey(fixture), fixtureAnimKey(fixture));
      // A lamp has a flame in it and a glowcap glows: both light the ground
      // around them. Noted here rather than by walking the grid every frame:
      // the scene already sees every one of them exactly once, as it puts it
      // on screen.
      if (fixture === FixtureType.Lamp || fixture === FixtureType.Glowcap) {
        this.lightLamp(object.col, object.row);
      }
      return;
    }
    const landmark = landmarkFor(object.type);
    if (landmark) {
      const sidecar = this.landmarkSidecars.get(landmark);
      if (!sidecar) throw new Error(`no art loaded for landmark "${landmark}"`);
      const sprite = this.spawnFootprintSprite(
        object,
        sidecar,
        landmarkSheetKey(landmark),
        landmarkAnimKey(landmark),
      );
      // A lighthouse is a light, so it lights the ground round its foot —
      // the same path a lamp and a glowcap take, and the reason the harbour
      // is worth walking to after dark.
      if (landmark === LandmarkType.Lighthouse) {
        this.lightLamp(object.col, object.row + sidecar.footprint_tiles.height - 1);
      }
      this.watchLandmark(sprite, object, sidecar, () => this.touchLandmark(landmark));
      return;
    }
    if (sceneryKind(object.type) !== null) {
      this.spawnScenery(object);
      return;
    }
    throw new Error(`placed object "${object.type}" has no art`);
  }

  private spawnScenery(object: PlacedObject): Phaser.GameObjects.Sprite {
    const kind = sceneryKind(object.type);
    if (!kind) throw new Error(`"${object.type}" is not scenery`);
    const sidecar = this.scenerySidecars.get(kind);
    if (!sidecar) throw new Error(`no art loaded for scenery "${kind}"`);
    // Which individual this tile gets, and whether it faces the other way.
    // Four shapes times a mirror is eight silhouettes, which is enough that
    // a wood of thousands stops reading as a repeat.
    const instance = variationFor(object.col, object.row, Math.max(1, sidecar.instances));
    return this.spawnFootprintSprite(
      object,
      sidecar,
      scenerySheetKey(kind),
      sceneryAnimKey(kind, instance),
      true,
    );
  }

  /**
   * Draws anything that stands on a footprint: a fixture, a tree, a boulder.
   *
   * Placed from the sidecar's own offset, like a building, and started at a
   * scattered point in its animation — a wood where every tree sways in
   * unison reads as a screensaver, and there are hundreds of them along each
   * walled edge.
   */
  private spawnFootprintSprite(
    object: PlacedObject,
    sidecar: SpriteSidecar,
    sheetKey: string,
    animKey: string,
    mirror = false,
  ): Phaser.GameObjects.Sprite {
    const origin = spriteOrigin(sidecar, object.col, object.row);
    const sprite = this.world(
      this.add
        .sprite(this.originX + origin.x, this.originY + origin.y, sheetKey)
        .setOrigin(0, 0)
        .setDepth(depthFor(footprintBottomY(sidecar, object.row))),
    );
    // Either the object says so — the fence's side run, whose right-hand
    // half is the left-hand sprite reversed — or the caller asked for the
    // scenery's own by-the-tile variation.
    if (object.flip) sprite.setFlipX(true);
    else if (mirror && variationFor(object.col, object.row, 2) === 1) {
      // Flipped about the sprite's own centre, so the footprint it covers
      // does not move.
      sprite.setFlipX(true);
    }
    sprite.play(animKey);
    sprite.anims.setProgress(variationFor(object.col, object.row, PHASE_STEPS) / PHASE_STEPS);
    return sprite;
  }

  // --- Interiors ---------------------------------------------------------

  /**
   * Put whoever works in this room into it.
   *
   * The shopkeeper is the only one so far, and she is here rather than
   * outside because a shop is somewhere you go in to. Spawned on entry and
   * destroyed on the way out rather than kept alive off screen: a room is
   * built when it is walked into and thrown away when it is left, and an NPC
   * that outlived their room would be a sprite on a layer nobody draws.
   */
  private spawnAttendant(buildingId: string, sidecar: InteriorSidecar): void {
    const lone = LONE_ATTENDANTS[buildingId];
    const spec = lone
      ? { id: lone, role: undefined }
      : this.villageNpcs.find((npc) => npc.indoors && npc.homeBuildingId === buildingId);
    if (!spec) return;
    // What they *are*, which their id may not be: the city's four shops each
    // hold a shopkeeper, and every id in the world has to be its own.
    const part = spec.role ?? spec.id;
    const cell = interiorAttendantCell(sidecar);
    if (!cell) throw new Error(`${sidecar.room} has nowhere for ${spec.id} to stand`);

    const feet = this.toFeet(cell.col, cell.row);
    const sprite = this.world(
      this.add
        .sprite(feet.x, feet.y, characterSheetKey(characterFor(part, 0)))
        .setOrigin(0.5, 1)
        .setDepth(feet.y)
        .play(characterAnimKey(characterFor(part, 0), IDLE, Facing.Down)),
    );
    if (part === SHOPKEEPER_ID)
      this.watchAttendant(
        sprite,
        () => cell,
        () => this.openShop(),
      );
    if (part === TEACHER_ID)
      this.watchAttendant(
        sprite,
        () => cell,
        () => this.openLesson(),
      );
    if (part === GEOMETER_ID)
      this.watchAttendant(
        sprite,
        () => cell,
        () => this.openGeometryLesson(),
      );
    if (part === ASTRONOMER_ID)
      this.watchAttendant(
        sprite,
        () => cell,
        () => this.meetAstronomer(),
      );
    this.attendant = sprite;
    this.attendantCell = cell;
    this.attendantId = spec.id;
  }

  /**
   * The map on the tower's wall.
   *
   * Hung rather than furnished: the room's own art is one sprite with its
   * furniture baked in, so anything that has to answer a tap has to be a
   * sprite of its own — the same reason the shopkeeper is spawned into her
   * room rather than painted into it.
   *
   * There are two: the post office's map of the world and the dome's chart
   * of the night. Same frame, same proportions, same gesture — a child who
   * has learned that a framed thing on a wall can be tapped should not have
   * to learn it twice.
   */
  private hangWallMap(buildingId: string, sidecar: InteriorSidecar): void {
    const hanging = WALL_HANGINGS[buildingId];
    if (!hanging) return;
    const cell = wallHangingCell(sidecar);
    const feet = this.toFeet(cell.col, cell.row);
    const sprite = this.world(
      this.add
        .image(feet.x, feet.y - WALL_MAP_RISE, uiTextureKey(hanging))
        .setOrigin(0.5, 1)
        .setDepth(feet.y),
    );
    // A tile-sized hit area, like the crops and the shopkeeper: the art is a
    // tile square, and the default area of an image this size is the same
    // thing — stated anyway so it cannot drift if the picture is redrawn.
    sprite.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, TILE_SIZE, TILE_SIZE),
      Phaser.Geom.Rectangle.Contains,
    );
    sprite.on("pointerdown", () => {
      if (this.pointerIsSpokenFor) return;
      // The map opens the map; the chart says what it is. A chart of the
      // night that opened a chart would want a second panel to put in it,
      // and what the dome has to say fits in a line.
      // The map opens the map. The chart is a picture and nothing else, so
      // tapping it holds the picture up — which is the whole of what a
      // sentence describing it was ever for.
      if (hanging === UiAsset.MapWall) this.openMap();
      else this.showPicture(UiAsset.StarChart);
    });
    this.wallMap = sprite;
  }

  /** A picture on a wall, held up close. */
  private showPicture(asset: string): void {
    if (this.modalOpen) return;
    this.joystick?.release();
    this.closeTrays();
    this.picturePanel?.show(asset, () => {});
  }

  /** The map, opened. Nothing is refused indoors here — it is on a wall. */
  private openMap(): void {
    if (this.modalOpen) return;
    this.joystick?.release();
    this.closeTrays();
    this.mapPanel?.open_(() => {});
  }

  /**
   * The one place the indoor mode is set.
   *
   * The scene owns the mode — grids, layers, the camera — but the *rule* that
   * nothing may be gardened in there lives with the other rules, in the
   * session. Two facts in two files is a fact that can disagree with itself:
   * an entry that set the flag and an exit that forgot would strand the
   * player unable to plant anything ever again, after one visit to a cottage,
   * with nothing on screen to say why. Derived from the same assignment
   * instead, so there is no second place to forget.
   */
  private setInterior<T extends InteriorRuntime | null>(interior: T): T {
    this.interior = interior;
    this.session.indoors = interior !== null;
    // The sockets belong to the climb, not to whatever room this is.
    this.paintSockets();
    return interior;
  }

  private buildingEntranceAt(
    col: number,
    row: number,
    step?: { dCol: number; dRow: number },
  ): BuildingRuntime | undefined {
    return this.buildings.find((b) => isEntrance(b.entrance, col, row, step));
  }

  /**
   * Step inside.
   *
   * Swaps the grid the player walks on, the origin their tiles are measured
   * from and the layer being drawn. Everything else — the camera, the
   * joystick, the depth sort, the animation state — carries on untouched,
   * which is the whole reason interiors are a mode here rather than a scene
   * of their own.
   */
  /**
   * Which copy of a room a particular building has behind its door.
   *
   * The mirror of `houseSheetFor`, and it takes its look from the same
   * number — so the house with the heather roof is the house with the plum
   * bedding, every time. Outside says roof and inside says soft furnishings,
   * because from the door of a small room the soft things are what you
   * notice, and repainting the plaster would change the light in the room
   * rather than its character.
   *
   * Rooms other than the cottage get exactly one copy, because there is
   * exactly one school and one store.
   */
  private roomSheetFor(buildingId: string, room: string, sidecar: InteriorSidecar): string {
    if (!varies(room)) return room;
    const options = (sidecar.fabric_options ?? []) as Ramp[];
    const shipped = rampOf((sidecar.palette ?? {}) as Record<string, Rgb>, FABRIC_SLOTS);
    const look = houseLook(buildingId, this.seed, options.length);
    const wanted = options[look];
    if (look === 0 || !shipped || !wanted || !sidecar.sheet) return room;

    const name = `${room}~${look}`;
    const painted = repaintedSheet(
      this,
      interiorSheetKey(room),
      interiorSheetKey(name),
      rampPlan(shipped, wanted),
      sidecar.sheet,
    );
    if (painted !== interiorSheetKey(name)) return room;
    const frames = sidecar.sheet.frame_count;
    if (frames > 1 && !this.anims.exists(interiorAnimKey(name))) {
      this.anims.create({
        key: interiorAnimKey(name),
        frames: this.anims.generateFrameNumbers(interiorSheetKey(name), {
          start: 0,
          end: frames - 1,
        }),
        frameRate: BUILDING_ANIM_FPS,
        repeat: -1,
      });
    }
    return name;
  }

  private enterInterior(building: BuildingRuntime): void {
    // Nothing marked out survives a doorway. The marker lives in the world
    // layer, which is hidden while a room is on screen, and the patch it
    // referred to is a hundred tiles away.
    this.stopMarking();
    const room = interiorFor(building.sprite);
    const sidecar = this.interiorSidecars.get(room);
    if (!sidecar) throw new Error(`no interior for "${room}"`);

    const door = interiorDoor(sidecar);
    const entered = this.setInterior({
      room,
      grid: buildInteriorGrid(sidecar),
      // Placed below, once `world` will file it under the interior layer.
      image: undefined as unknown as Phaser.GameObjects.Sprite,
      exit: door,
      // Back onto the doorstep: the door cell itself is part of the
      // building's footprint and so is never stood on.
      returnTo: { col: building.doorCol, row: building.doorRow + 1 },
      originY: interiorOriginY(sidecar),
    });

    // The same house, indoors. Four cottages had one room between them, and
    // walking into a neighbour's felt like walking back into your own.
    const painted = this.roomSheetFor(building.id, room, sidecar);
    const image = this.world(
      this.add.sprite(0, 0, interiorSheetKey(painted)).setOrigin(0, 0).setDepth(CHUNK_DEPTH),
    );
    if ((sidecar.sheet?.frame_count ?? 1) > 1) image.play(interiorAnimKey(painted));
    entered.image = image;
    this.lightHearth(sidecar);

    this.grid = entered.grid;
    this.originX = 0;
    this.originY = entered.originY;
    // After the origin moves, not before: `toFeet` measures from it, and a
    // shopkeeper placed while it still pointed at the outdoor world would be
    // drawn several hundred tiles from the room she is standing in.
    this.spawnAttendant(building.id, sidecar);
    this.hangWallMap(building.id, sidecar);
    this.worldLayer.setVisible(false);
    this.interiorLayer.setVisible(true);
    this.movePlayerToLayer();

    // Facing up: they just walked in through the wall behind them.
    this.placePlayer(door.col, door.row, Facing.Up);
    // After the player has been moved, so that the branch which does follow
    // them — a room too big for the screen, which a phone held upright makes
    // of the schoolhouse — starts from where they now are rather than from
    // where they were standing outside.
    const { cols, rows } = sidecar.size_cells;
    this.frameRoom(cols * TILE_SIZE, this.originY + rows * TILE_SIZE);
  }

  /**
   * Point the camera at a whole room rather than at the player inside it.
   *
   * Outdoors the camera follows, because the world is far larger than the
   * screen. A room is not: every one of them fits in the viewport at once,
   * so following is pointless and *bounding* is actively wrong — bounds are
   * clamped so that the world never shows past its own edge, which for a
   * world smaller than the view pins it to the top-left corner and leaves
   * black down two sides. The room is framed in the middle instead.
   *
   * A room bigger than the viewport would still want the old behaviour, so
   * that case keeps it. None of the shipped rooms is, but the rule reads
   * better than the coincidence.
   */
  /**
   * Frame the room again, at whatever size the screen is now.
   *
   * The size is kept rather than recomputed from the sidecar every time: the
   * interior's own dimensions are the one thing about this that does *not*
   * change when a phone is turned.
   */
  private reframeInterior(): void {
    const framed = this.framedRoom;
    if (framed) this.frameRoom(framed.width, framed.height);
  }

  private frameRoom(width: number, height: number): void {
    this.framedRoom = { width, height };
    const camera = this.cameras.main;
    const bounds = roomCameraBounds(
      { width, height },
      { width: camera.width / camera.zoom, height: camera.height / camera.zoom },
    );
    camera.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
    camera.startFollow(this.player);
  }

  private leaveInterior(): void {
    const interior = this.interior;
    if (!interior) return;
    interior.image.destroy();
    this.snuffHearth();
    this.interiorLayer.setVisible(false);
    this.worldLayer.setVisible(true);
    this.wallMap?.destroy();
    this.wallMap = null;
    this.attendant?.destroy();
    this.attendant = null;
    this.attendantCell = null;
    this.attendantId = null;
    this.setInterior(null);
    this.framedRoom = null;
    this.movePlayerToLayer();

    this.grid = this.worldGrid;
    this.originX = 0;
    this.originY = 0;
    this.cameras.main.setBounds(0, 0, this.worldPixelWidth, this.worldPixelHeight);
    // Following has to be turned back on: a room small enough to frame turned
    // it off, and a player who walked out into a world the camera was no
    // longer tracking would walk off the edge of the screen.
    this.cameras.main.startFollow(this.player);
    this.placePlayer(interior.returnTo.col, interior.returnTo.row, Facing.Down);
    this.refreshVisibleChunks();
  }

  // Teleport rather than walk: used at both ends of a doorway, where the two
  // positions are in different coordinate spaces and tweening between them
  // would send the player across the room.
  private placePlayer(col: number, row: number, facing: Facing): void {
    this.tweens.killTweensOf(this.player);
    this.isMoving = false;
    this.path = [];
    this.session.setPosition(col, row);
    this.session.face(facing);
    const feet = this.toFeet(col, row);
    this.player.setPosition(feet.x, feet.y).setDepth(feet.y);
  }

  // --- NPCs --------------------------------------------------------------
  //
  // Visual/positional only — no dialogue, requests, or shop exist yet (see
  // docs/WORLD_GENERATION.md's "Village NPC roles"). Every NPC wanders near
  // its home building by day (the postal worker patrols the whole village
  // instead) and greedily steps home at night, but nothing here restricts
  // interacting with them — there's no interaction system at all yet for
  // that restriction to apply to.

  private spawnNpcs(specs: readonly VillageNpcSpec[], village: AreaPlacement): void {
    const villageCenter = {
      col: village.col + Math.floor(village.width / 2),
      row: village.row + Math.floor(village.height / 2),
    };
    // Counts only the NPCs without art of their own, so the generic
    // villagers are handed out in order and a given NPC keeps the same face
    // every time the world is regenerated from the same seed.
    let genericIndex = 0;
    // Indoor NPCs are not part of the outdoor cast at all: they have no
    // wander and no retreat, and are spawned into their room when the player
    // walks in. Counting them here anyway would hand a generic villager's
    // face to someone who is never seen out here.
    this.npcs = specs
      .filter((spec) => !spec.indoors)
      .map((spec) => {
        const isPostalWorker = spec.id === "postal-worker";
        const wanderCenter = isPostalWorker ? villageCenter : spec.home;
        const character = characterFor(spec.role ?? spec.id, genericIndex);
        if (character.startsWith("villager-")) genericIndex++;
        const feet = this.toFeet(spec.home.col, spec.home.row);
        const sprite = this.world(
          this.add
            .sprite(feet.x, feet.y, characterSheetKey(character))
            .setOrigin(0.5, 1)
            .setDepth(feet.y),
        );
        if (spec.id === POSTAL_WORKER_ID) {
          // He wanders, so the tap asks him where he is now rather than
          // where he was when the world was built.
          this.watchAttendant(
            sprite,
            () => {
              const npc = this.npcs.find((one) => one.id === POSTAL_WORKER_ID);
              return { col: npc?.col ?? spec.home.col, row: npc?.row ?? spec.home.row };
            },
            () => this.openIntro(),
          );
        }
        return {
          id: spec.id,
          character,
          facing: DEFAULT_FACING,
          homeCol: spec.home.col,
          homeRow: spec.home.row,
          wanderCenterCol: wanderCenter.col,
          wanderCenterRow: wanderCenter.row,
          wanderRadius: isPostalWorker ? PATROL_WANDER_RADIUS : LOCAL_WANDER_RADIUS,
          col: spec.home.col,
          row: spec.home.row,
          sprite,
          isMoving: false,
          nextStepAt: this.time.now + Phaser.Math.Between(NPC_STEP_MIN_MS, NPC_STEP_MAX_MS),
        };
      });
  }

  private updateNpcs(daytime: boolean): void {
    // `?freezeNpcs` holds everyone on their home tile. A wandering villager
    // is a position no script can know: a test that read where the shopkeeper
    // was and then tapped her found she had moved in between, and retrying
    // only widened the window. See devHooks.
    if (this.dev.freezeNpcs) {
      for (const npc of this.npcs) {
        if (npc.isMoving) continue;
        // ?intro asks for the welcome, and the welcome is a walk across the
        // square: the one NPC movement a frozen world is still allowed, or
        // the two seams would cancel each other and the tutorial could not
        // be tested from a script at all.
        if (this.dev.intro && this.deliveringIntro(npc)) this.npcDeliverIntroStep(npc);
        else this.npcRetreatStep(npc);
      }
      return;
    }
    const now = this.time.now;
    for (const npc of this.npcs) {
      if (npc.isMoving || now < npc.nextStepAt) continue;
      if (this.deliveringIntro(npc)) {
        npc.nextStepAt = now + INTRO_STEP_MS;
        this.npcDeliverIntroStep(npc);
        continue;
      }
      npc.nextStepAt = now + Phaser.Math.Between(NPC_STEP_MIN_MS, NPC_STEP_MAX_MS);
      if (daytime) this.npcWanderStep(npc);
      else this.npcRetreatStep(npc);
    }
  }

  /**
   * The animals, on the same wander as the villagers and none of the rest.
   *
   * They keep no curfew: a cat is out at night and so is a rabbit, and a
   * village that emptied of chickens at sunset would look like a village
   * where something had happened to the chickens. They also never deliver
   * anything, never retreat indoors and never answer a tap — which is the
   * whole of why they are a separate list rather than more villagers.
   */
  private updateAnimals(now: number): void {
    // The clouds follow their owners whatever else is happening, including
    // while the animals are frozen for a test and while one is part-way
    // through a step.
    for (const animal of this.animals) {
      this.placeBubble(animal);
      // The hunger clock runs whether or not the animals are held still for
      // a test: it is about time passing, not about walking about.
      if (now >= animal.moodUntil) this.turnMood(animal, now);
    }
    if (this.dev.freezeNpcs) return;
    for (const animal of this.animals) {
      if (animal.isMoving || now < animal.nextStepAt) continue;
      // Quicker and twitchier than a person's amble. A chicken that moved at
      // a villager's pace read as a very small villager.
      animal.nextStepAt = now + Phaser.Math.Between(ANIMAL_STEP_MIN_MS, ANIMAL_STEP_MAX_MS);
      this.npcWanderStep(animal);
    }
  }

  /**
   * Whether this NPC is currently crossing the square to say hello.
   *
   * Deliberately not gated on daylight, unlike everything else he does. A
   * child who starts playing at eight in the evening needs the welcome more
   * than the village needs its curfew kept, and "the postman is still out"
   * is a smaller oddity than "nobody ever told me what to do here".
   */
  private deliveringIntro(npc: NpcRuntime): boolean {
    return (
      this.introToGive &&
      npc.id === POSTAL_WORKER_ID &&
      this.introStepsLeft > 0 &&
      !this.session.indoors &&
      !this.modalOpen
    );
  }

  /**
   * One step of his walk over, and the hello when he arrives.
   *
   * He aims at the player rather than at a fixed tile, so following them
   * across the square is the same code as standing still while they come to
   * him. The greeting fires from *speaking* distance — one step in any
   * direction, diagonals included, the same reach the shopkeeper answers a
   * tap from — because a delivery that required him to be orthogonally
   * adjacent would have him shuffling round the player's corner.
   */
  private npcDeliverIntroStep(npc: NpcRuntime): void {
    if (stepsToSpeak({ col: npc.col, row: npc.row }, this.session.tile) <= 1) {
      npc.facing = facingFor(this.session.col - npc.col, this.session.row - npc.row, npc.facing);
      this.openIntro();
      return;
    }
    this.introStepsLeft--;
    const goal = this.session.tile;
    // Only re-routed when it is worth re-routing: a breadth-first search of
    // the world is cheap once and wasteful five times a second.
    if (
      this.introPath.length === 0 ||
      this.introPathFor?.col !== goal.col ||
      this.introPathFor?.row !== goal.row
    ) {
      this.introPath = findPath(this.grid, { col: npc.col, row: npc.row }, goal) ?? [];
      this.introPathFor = goal;
    }
    const next = this.introPath.shift();
    // No way through at all — a garden with its gate walled up, say. Fall
    // back to walking at them, which at least ends up somewhere visible.
    if (!next) {
      this.npcStepToward(npc, goal.col, goal.row);
      return;
    }
    this.moveNpcTo(npc, next.col, next.row, INTRO_MOVE_MS);
  }

  // A bounded random walk, not a route to a chosen destination — simple,
  // and "wanders near home" doesn't need anything stronger.
  private npcWanderStep(npc: NpcRuntime): void {
    const direction = STEP_DIRECTIONS[Phaser.Math.Between(0, STEP_DIRECTIONS.length - 1)];
    if (!direction) return;
    const col = npc.col + direction.dCol;
    const row = npc.row + direction.dRow;
    // Villagers and chickens keep to their own level too — one wandering up
    // a cliff would be the clearest possible statement that the cliff is
    // only a picture.
    if (!this.grid.canStep({ col: npc.col, row: npc.row }, { col, row })) return;
    const withinRadius =
      Math.max(Math.abs(col - npc.wanderCenterCol), Math.abs(row - npc.wanderCenterRow)) <=
      npc.wanderRadius;
    if (!withinRadius) return;
    this.moveNpcTo(npc, col, row);
  }

  // Greedy step toward home, preferring whichever axis is further off —
  // not a real path, but the village's open square-and-spokes layout means
  // a straight-ish line home rarely needs to route around anything.
  private npcRetreatStep(npc: NpcRuntime): void {
    this.npcStepToward(npc, npc.homeCol, npc.homeRow);
  }

  private npcStepToward(npc: NpcRuntime, toCol: number, toRow: number): void {
    if (npc.col === toCol && npc.row === toRow) return;
    const dCol = Math.sign(toCol - npc.col);
    const dRow = Math.sign(toRow - npc.row);
    const attempts: Direction[] = [];
    if (Math.abs(toCol - npc.col) >= Math.abs(toRow - npc.row)) {
      if (dCol !== 0) attempts.push({ dCol, dRow: 0 });
      if (dRow !== 0) attempts.push({ dCol: 0, dRow });
    } else {
      if (dRow !== 0) attempts.push({ dCol: 0, dRow });
      if (dCol !== 0) attempts.push({ dCol, dRow: 0 });
    }
    // Greedy on the longer axis first, which is enough for the village's
    // open square-and-spokes layout; a real path would be a lot of machinery
    // for a walk across a plaza.
    for (const attempt of attempts) {
      const col = npc.col + attempt.dCol;
      const row = npc.row + attempt.dRow;
      if (this.grid.canStep({ col: npc.col, row: npc.row }, { col, row })) {
        this.moveNpcTo(npc, col, row);
        return;
      }
    }
  }

  private moveNpcTo(
    npc: NpcRuntime,
    col: number,
    row: number,
    duration = NPC_MOVE_DURATION_MS,
  ): void {
    npc.facing = facingFor(col - npc.col, row - npc.row, npc.facing);
    npc.isMoving = true;
    npc.col = col;
    npc.row = row;
    const target = this.toFeet(col, row);
    this.tweens.add({
      targets: npc.sprite,
      x: target.x,
      y: target.y,
      duration,
      onComplete: () => {
        npc.isMoving = false;
      },
    });
  }

  // The floating joystick, set up only when Phaser detects a non-desktop OS
  // (this.mobileControls). Keyboard input stays live underneath regardless,
  // so a mobile browser with an attached keyboard still works too.
  //
  // It replaced a fixed d-pad in the bottom-left corner. A pad pinned to a
  // corner assumes how the device is held; one that appears under the thumb
  // that summoned it does not, and it costs no permanent screen space on the
  // display where space is tightest.
  //
  // The action buttons that used to be set up here are gone: the seed pouch
  // and the spellbook are drawn on every platform, so they live in
  // createActionBar rather than behind this check.
  private createTouchControls(): void {
    this.joystick = new VirtualJoystick(this, TOUCH_UI_DEPTH, (object) => this.ui(object));
  }

  // --- Coordinates -------------------------------------------------------

  // Entities (player, NPCs, plants) sit at the CENTRE of their tile, while
  // gridToScreen names its top-left corner — on the isometric grid this
  // replaced those were the same point, and they are not here.
  private toScreen(col: number, row: number): ScreenPoint {
    const p = gridToScreen(col, row);
    return { x: p.x + this.originX + TILE_SIZE / 2, y: p.y + this.originY + TILE_SIZE / 2 };
  }

  // Where a character's feet go: the bottom-centre of their tile. Sprites
  // are anchored here rather than at their own centre, because it is the
  // point that both places them on the ground and sorts them against
  // everything else standing on it.
  private toFeet(col: number, row: number): ScreenPoint {
    const p = gridToScreen(col, row);
    return { x: p.x + this.originX + TILE_SIZE / 2, y: p.y + this.originY + TILE_SIZE };
  }

  // Depth for something standing on a tile: the y of its feet, which is the
  // tile's bottom edge, not its centre or origin.
  private entityDepth(row: number): number {
    return depthFor((row + 1) * TILE_SIZE);
  }

  /**
   * Where a tile's feet land on screen, through whatever the camera is doing.
   *
   * The camera is bounded to the world, and indoors that world is a single
   * room smaller than the viewport — so it clamps, and the player stops being
   * at the centre. Anything that needs a screen position has to ask rather
   * than assume.
   */
  private screenOf(col: number, row: number): ScreenPoint {
    const feet = this.toFeet(col, row);
    return this.screenOfPoint(feet.x, feet.y);
  }

  /**
   * A point in the world, in screen pixels.
   *
   * Split out from `screenOf` for the things that are not on a tile boundary
   * — a sprite half way through its step is the whole reason this exists.
   *
   * Through `worldView` rather than `scrollX` and the zoom: the view is what
   * the camera actually settled on after its bounds were applied, and indoors
   * those bounds are a room smaller than the viewport, so the arithmetic that
   * holds outdoors does not hold in here.
   */
  private screenOfPoint(worldX: number, worldY: number): ScreenPoint {
    const camera = this.cameras.main;
    const view = camera.worldView;
    return {
      x: (worldX - view.x) * camera.zoom,
      y: (worldY - view.y) * camera.zoom,
    };
  }

  private toGrid(screenX: number, screenY: number): GridPoint {
    return screenToGrid(screenX - this.originX, screenY - this.originY);
  }

  /** The tile under a world point, or null if it is off the map. */
  private tileAtWorld(worldX: number, worldY: number): GridPoint | null {
    const at = this.toGrid(worldX, worldY);
    return this.grid.inBounds(at.col, at.row) ? at : null;
  }

  /** The one line of HUD text left: whatever just happened. */

  /**
   * Whether anything is covering the world.
   *
   * Two popups now, and every guard wants both. Asking about one by name was
   * fine while there was one; the second would have meant finding every site
   * that asked and remembering to widen it.
   */
  private get playerCol(): number {
    return this.session.col;
  }

  private get playerRow(): number {
    return this.session.row;
  }

  private get playerFacing(): Facing {
    return this.session.facing;
  }

  private get inventory(): Inventory {
    return this.session.inventory;
  }

  private get purse(): Purse {
    return this.session.purse;
  }

  private get modalOpen(): boolean {
    return (
      // Optional throughout: the status line is written once while the scene
      // is still assembling itself, before any of these exist.
      this.spellPopup?.isOpen === true ||
      this.shopPanel?.isOpen === true ||
      this.optionsPanel?.isOpen === true ||
      this.aboutPanel?.isOpen === true ||
      this.lessonPanel?.isOpen === true ||
      this.introPanel?.isOpen === true ||
      this.mapPanel?.isOpen === true ||
      this.picturePanel?.isOpen === true ||
      this.taskPanel?.isOpen === true ||
      this.portalPanel?.isOpen === true ||
      this.geometryPanel?.isOpen === true ||
      // Mid-crossing: a step from a tile they are no longer standing on.
      this.travelling
    );
  }

  private get crateIsEmpty(): boolean {
    return PLACEABLE_FIXTURES.every((fixture) => this.inventory.count(fixture) === 0);
  }
}
