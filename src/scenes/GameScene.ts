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
import { pinchedZoom, settledZoom, spread, zoomSteps } from "../input/pinch";
import { type Rgb, rampPlan } from "../render/recolour";
import { repaintedSheet } from "../render/sheetTexture";
import { exportSaves } from "../save/backupFile";
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
  HEARTH_IS_FURNITURE,
  type WorldBaseline,
  readDecor,
  readPlans,
  restorePlayer,
  restoreWorld,
  snapshotGame,
  snapshotPlayer,
  worldBaseline,
} from "../save/snapshot";
import { readProfiles, saveProfile } from "../save/store";
import {
  Language,
  type Settings,
  browserStore,
  readSettings,
  settingsWithOverrides,
  writeSettings,
} from "../settings";
import { CURRENCY, totalOf as coinTotal, largestCoin } from "../shop/currency";
import { makeAdditionProblem, movedBy } from "../spells/addition";
import {
  HARDEST_BRICK_RUNG,
  brickBeingAsked,
  brickRungAt,
  makeBrickProblem,
} from "../spells/bricks";
import type { CastResult } from "../spells/cast";
import {
  DEFAULT_BAND,
  type Recent,
  bandAt,
  bandOn,
  nextRung,
  recordCast,
  rungAt,
} from "../spells/difficulty";
import {
  type ClockTime,
  HARDEST_CLOCK_RUNG,
  askedOf,
  asksMinutes,
  clockRungAt,
  forwardMinutes,
  readClock,
  sandFor,
} from "../spells/hourglass";
import { HARDEST_ARRAY_RUNG, arrayProblemFor, arrayRungAt } from "../spells/multiplication";
import {
  HARDEST_PORTAL_RUNG,
  type PortalJourney,
  placeAt,
  portalRungAt,
  portalStops,
  ruleAt,
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
import { nextSymmetryRung, symmetryHint, symmetryRungAt } from "../spells/symmetry";
import { AboutPanel } from "../ui/AboutPanel";
import { ArrayPopup } from "../ui/ArrayPopup";
import { BrickPopup } from "../ui/BrickPopup";
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
import { SandGlass } from "../ui/SandGlass";
import { ShopPanel } from "../ui/ShopPanel";
import { SpellPopup } from "../ui/SpellPopup";
import { SymmetryPopup } from "../ui/SymmetryPopup";
import { TaskPanel } from "../ui/TaskPanel";
import {
  UI_SIDECAR_KEY,
  UiAsset,
  type UiIndex,
  coinIcon,
  cropIcon,
  flowerIcon,
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
  DECOR_LOOKS,
  DECOR_TYPES,
  type DecorItem,
  type DecorType,
  type Footprints,
  type Placed,
  ROOM_COST,
  anchorFor,
  arrangementIn,
  blockersFor,
  cellsUnder,
  colourPlanFor,
  fits as decorFits,
  decorFromSave,
  decorItem,
  decorToSave,
  without as decorWithout,
  footprintsOf,
  hearthRestored,
  inTheWayOf,
  itemParts,
  occupiedCells,
  pieceArt,
  pieceOn,
  protectedCells,
  roomsAfforded,
  startingDecor,
} from "../world/decor";
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
import {
  FLOWER_LOOKS,
  FLOWER_TYPES,
  type FlowerType,
  type PlantedFlower,
  type WildSpot,
  findFlower,
  flowerAnimKey,
  flowerFrames,
  flowerObject,
  flowerParts,
  flowerSheetKey,
  flowerSidecarKey,
  hasFound,
  wildFlowerFor,
  wildLook,
} from "../world/flowers";
import type { WorldGrid } from "../world/grid";
import {
  type PlanPatch,
  type RoomPlan,
  buildOn,
  buildableCells,
  buildableIn,
  canBuild,
  canUnbuild,
  cellKey,
  isFloor,
  planBounds,
  planFromKeys,
  planOf,
  removableIn,
  unbuildFrom,
  wallMasks,
  whyNotBuild,
  windowCells,
} from "../world/growableRoom";
import type { HarbourLayout } from "../world/harbour";
import {
  FABRIC_SLOTS,
  ROOF_SLOTS,
  type Ramp,
  houseLook,
  lightingDelay,
  rampOf,
  varies,
  whoLivesIn,
  windowBrightness,
} from "../world/houses";
import {
  GROWABLE_ROOM,
  INTERIOR_ROOMS,
  LightKind,
  type RoomBlocker,
  type RoomLight,
  buildInteriorGrid,
  buildPlanGrid,
  growableDoor,
  growablePieceAnimKey,
  growablePieceKey,
  growableSheetKey,
  growableSidecarKey,
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
  startingPlan,
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
import { MATERIAL_TYPES, MaterialType, yieldOf } from "../world/materials";
import { NAMED_PEOPLE, nameCast } from "../world/names";
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
import {
  type Patch,
  markingZoom,
  patchBetween,
  patchCells,
  patchIsCastable,
} from "../world/selection";
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
  type GrowableSidecar,
  type InteriorSidecar,
  type LandmarkSidecar,
  type ObjectSidecar,
  type PlantSidecar,
  type SpriteSidecar,
  doorCell,
  footprintBottomY,
  spriteOrigin,
} from "../world/spriteSidecar";
import type { TerrainType } from "../world/terrain";
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
  CopyRefusal,
  type PaintedTiles,
  type Painting,
  planCopy,
  readPainted,
} from "../world/terrainCopy";
import {
  MAX_NIGHT_ALPHA,
  NIGHT_TINT_COLOR,
  type OpeningHours,
  STARGAZING_HOURS,
  VILLAGE_HOURS,
  isOpenHours,
  nightTintAlpha,
  opensIn,
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
import { type VillageNpcSpec, houseIdFor } from "../world/villageLayout";
import { type GeneratedWorld, generateWorld } from "../world/worldGenerator";
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
 * How long the finished rectangle is left alone before the sum opens over it.
 *
 * The second corner used to land and the parchment arrive in the same frame,
 * so the only thing a child ever saw of what they had drawn was the *first*
 * corner. The rectangle is the whole of what the times spell is about — the
 * numbers in the question are numbers they made with their own hands — and
 * it was on screen for no time at all.
 *
 * The same length as a refusal mark, and for the same reason: long enough to
 * take in, short enough not to be waiting. This happens on every cast, so a
 * beat that felt generous once would be dead time by the tenth.
 */
const PATCH_BEAT_MS = REFUSAL_MS;
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
 * The most ducats the purse badge prints before it says "and more".
 *
 * Three digits rather than the two every other badge stops at. A child with
 * a thousand ducats has more money than anything in the shop costs, so the
 * exact figure has stopped being a number they act on — but ninety-nine is
 * reached in an afternoon's harvesting, and a purse that read "99+" from
 * then on would be hiding the one count it exists to show.
 */
const MOST_DUCATS_SHOWN = 999;
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
 * that it does any of them many times over.
 *
 * **Every one of them is a spell, and always will be.** Planting used to be
 * on this list, and it was the one thing here with no arithmetic behind it:
 * a child could mark out six by seven, answer one multiplication, and fill
 * forty-two squares having cast nothing. That made planting the obvious
 * choice every time and the times spell a way of *avoiding* sums. The times
 * spell multiplies spells; a seed still goes in the ground one at a time,
 * which is what putting a seed in the ground is.
 */
export const PatchAction = {
  Grow: "grow",
  Clear: "clear",
  /**
   * Build every square of it, indoors.
   *
   * The one action that is not about the garden, and it is here rather than
   * as a spell of its own for the reason the others are: from the child's
   * side this is a *choice about a patch*. Multiplication is doing the same
   * thing many times without doing it many times, and laying nine squares of
   * floor is as good an example of that as planting nine carrots.
   */
  Build: "build",
  /**
   * Copy the whole block somewhere else, ground and all.
   *
   * The mirror spell's effect, taken from one square to a rectangle of them.
   * It is here rather than being a mode of the mirror spell for the reason
   * building is here: from the child's side this is a *choice about a
   * patch*, and what the times spell contributes is the block — doing a
   * thing to many squares without doing it many times, which is the whole
   * of what multiplication is for.
   */
  Copy: "copy",
} as const;

export type PatchAction = (typeof PatchAction)[keyof typeof PatchAction];

/**
 * The rune each of them casts — which is the whole of what the menu shows.
 *
 * Building is the plus rune too, and deliberately: indoors the addition
 * spell puts a square of floor down instead of a crop up, and a child who
 * has learned what plus does should not have to learn a second picture for
 * the same spell doing the same arithmetic in a different room.
 */
const SPELL_RUNES: Record<PatchAction, string> = {
  [PatchAction.Grow]: UiAsset.RuneAdd,
  [PatchAction.Clear]: UiAsset.RuneMinus,
  [PatchAction.Build]: UiAsset.RuneAdd,
  [PatchAction.Copy]: UiAsset.RuneMirror,
};

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
/**
 * The clockmaker, in the plaza under the city's tower.
 *
 * The fifth teacher and the only one who is not in a room. That is the
 * point of him: a clock tower is the one landmark in the world that a child
 * walks up to expecting it to tell them something, and it stands in an open
 * square. Putting the man who explains the hour inside a building beside it
 * would be putting him where nobody looks.
 *
 * He is placed by the city rather than listed here, because where he can
 * stand depends on where the tower landed — see `city.ts`.
 */
const CLOCKMAKER_ID = "clockmaker";
/** His id in the world, which the city gives him. See `keepsNoCurfew`. */
const CITY_CLOCKMAKER_ID = "city-clockmaker";
/**
 * The dome on the mountain — the one building that keeps the night's hours.
 *
 * Named because two things now ask for it by id: who is found inside, and
 * when the door opens. See `hoursFor`.
 */
const OBSERVATORY_DOME_ID = "observatory-dome";
const LONE_ATTENDANTS: Record<string, string> = {
  [OBSERVATORY_DOME_ID]: ASTRONOMER_ID,
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

/**
 * The part of a character's idle frame that goes on a nameplate.
 *
 * Head and shoulders, which is where every colour a child picked lives:
 * their hair, their face and their shirt. Measured off the art — the figure
 * is sixteen pixels across, starting eight in, and its head runs from row
 * fifteen — and cropped rather than scaled, because a face squeezed to fit a
 * plate is a face with some rows twice as tall as others.
 */
const DECOR_LOOKS_RANGE = Array.from({ length: DECOR_LOOKS }, (_, at) => at);

const FACE_CROP = { x: 8, y: 15, width: 16, height: 18 } as const;
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
  /**
   * The building they live behind, so their cottage can say whose it is.
   *
   * Optional because the animals share this shape and a chicken lives in no
   * building — it has a patch of grass it keeps near, and no door.
   */
  homeBuildingId?: string;
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
  /**
   * The plate beside the door, in world pixels, or null.
   *
   * Only the cottages have one, and the sidecar says so — the game cannot
   * see the picture. Worked out when the building is placed and filled once
   * the cast is known, because a plate says who lives behind that door.
   */
  nameplate: { x: number; y: number; width: number; height: number } | null;
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
  /**
   * The floor plan, for the one room that has one.
   *
   * Null for the six rooms that are a picture. When it is set the room is
   * drawn from parts instead — see `paintPlan` — and `origin` is the offset
   * between the plan's own coordinates, which may be negative, and the grid
   * the player actually walks on, which may not.
   */
  plan?: RoomPlan;
  origin: GridPoint;
  /** Which house this is, so a plan is saved against the right one. */
  house?: string;
  /**
   * The room's own box, in grid cells — which is not the whole grid.
   *
   * A growable room's grid runs a margin of open ground past its walls so a
   * child can aim a rectangle into it, and *stepping off the grid* is how
   * the game used to know somebody had walked out of a door. With a margin
   * that never happens: the cell past the doorway is still on the grid, so a
   * child would be shut in their own house. Walking out is leaving the
   * *room*, and this is where the room ends.
   */
  bounds: { col: number; row: number; cols: number; rows: number };
  /** What the room is drawn into, and the fire that will not sit still in it. */
  canvas?: Phaser.GameObjects.RenderTexture;
  fires: Phaser.GameObjects.Sprite[];
  /** The furniture, as things rather than as paint. See `spawnDecor`. */
  decor: Phaser.GameObjects.Image[];
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
/**
 * What is lit over her head, waiting for a square.
 *
 * A spell or a thing to put down, in one type, because they are one
 * question: *what, and then where*. The colour is part of a decor piece and
 * of a flower because a chair is a green chair before it is anywhere — the
 * chooser runs before the arming, so what waits over her head is the thing
 * she will actually see on the floor.
 */
type Armed =
  | { kind: "spell"; spell: Spell }
  | { kind: "seed"; plant: PlantType }
  | { kind: "fixture"; fixture: FixtureType }
  | { kind: "decor"; piece: DecorType; look: number }
  | { kind: "flower"; flower: FlowerType; look: number };

/**
 * One name for whatever is lit, for comparing and for a script to read.
 *
 * A spell answers with its own name and nothing else, which is what keeps
 * `armed` the seam it has always been: the scenarios that assert `"growth"`
 * were written before any of this and are not about it.
 */
function armedTag(what: Armed | null): string | null {
  if (!what) return null;
  switch (what.kind) {
    case "spell":
      return what.spell;
    case "seed":
      return what.plant;
    case "fixture":
      return what.fixture;
    case "decor":
      return decorItem(what.piece, what.look);
    default:
      return flowerObject(what.flower, what.look);
  }
}

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
  private brickPopup?: BrickPopup;
  private clockPopup?: ClockPopup;
  private readonly flowerSidecars = new Map<FlowerType, FixtureSidecar>();
  /** Every flower on screen, by the cell it stands on. */
  private readonly flowerSprites = new Map<string, Phaser.GameObjects.Sprite>();
  /**
   * Ground the mirror spell has moved, by the tile it moved it onto.
   *
   * Kept here rather than diffed out of the grid on every save: terrain is a
   * quarter of a million tiles and this spell is the only thing that paints,
   * so it can say what it did instead of the save working it out.
   */
  private readonly painted = new Map<string, TerrainType>();
  /**
   * The source square the mirror spell is waiting to copy, if she has picked
   * one. The spell wants two taps — from here, to there — and this is the
   * half-way point between them.
   */
  private mirrorFrom: readonly GridPoint[] | null = null;
  /**
   * The rectangle the times spell drew, when the copy is a block.
   *
   * Null for a single square. What it decides is whether a multiplication is
   * asked after the mirror's own puzzle: the times spell always asks the
   * spell it is multiplying first and its own sum second, and this is how
   * the copy knows it is being multiplied at all.
   */
  private mirrorPatch: Patch | null = null;
  /** The copy the mirror's puzzle is standing in front of, once planned. */
  private mirrorPaint: readonly Painting[] | null = null;
  /** Which colour the seed pouch will plant next, per flower. */
  private flowerLook: Partial<Record<FlowerType, number>> = {};
  private symmetryPopup?: SymmetryPopup;
  private patchMenu?: PatchMenu<PatchAction>;
  /** The second of the two taps: which colour of a thing to put down. */
  private decorMenu?: PatchMenu<DecorItem>;
  private flowerMenu?: PatchMenu<PlantedFlower>;
  /**
   * The array spell, part way through being aimed.
   *
   * Null when the spell is not armed at all; `from` null when it is armed
   * and waiting for its first corner. Three states rather than two booleans,
   * so "armed but no corner yet" cannot be confused with "not armed".
   */
  private marking: {
    from: GridPoint | null;
    patch: Patch | null;
    /** Chosen before any ground is marked — see `castArraySpell`. */
    action: PatchAction;
  } | null = null;
  /**
   * How far out the child has pulled the camera, and the pinch doing it now.
   *
   * Two fields because they are two different facts. `restingZoom` is a
   * *choice* — it outlives the fingers that made it and is what the camera
   * goes back to when a spell that pulled the view out is done with it.
   * `pinching` exists only between the second finger landing and the first
   * one lifting, and while it does, the live value it carries is what the
   * camera shows. See `zoomWanted`, which is the one place they meet.
   *
   * Not written down anywhere. A view is where you are looking rather than
   * something you own, and a game that reopened zoomed out because of a
   * pinch three days ago would be a game that had rearranged itself.
   */
  private restingZoom = CAMERA_ZOOM;
  private pinching: { a: number; b: number; from: number; held: number; live: number } | null =
    null;
  /**
   * Every finger currently on the glass, by pointer id.
   *
   * Phaser hands out one pointer per touch and reuses the ids, and the
   * scene's own handlers see them one at a time — so "are two fingers down"
   * is a question nothing else here could answer.
   */
  private readonly touching = new Map<number, { x: number; y: number }>();
  /**
   * Whether this touch has been a pinch, until the last finger lifts.
   *
   * A pinch ends when one of the two fingers goes, and the other is usually
   * still down. Without this, that leftover finger becomes a joystick the
   * moment its partner leaves and the child walks off across the world at
   * the end of every zoom.
   */
  private pinched = false;
  /**
   * Whether a finished rectangle is being looked at before its sum opens.
   *
   * Taps do nothing while it is set. See `PATCH_BEAT_MS`.
   */
  private settling = false;
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
  private armed: Armed | null = null;
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
  private recentBrickCasts: Recent = [];
  private recentClockCasts: Recent = [];
  private recentSymmetryCasts: Recent = [];
  /**
   * When the world was last written down before this session started.
   *
   * Read once, at load, and then held: the save is rewritten every few
   * seconds while somebody plays, so a spell that asked the store would find
   * the answer creeping up to now and pay nothing. Set to null once claimed,
   * because one absence is worth one casting of it.
   */
  /**
   * How far this world's clock has been wound from the real one, in minutes.
   *
   * Kept beside the scene rather than read out of the profile each time
   * because everything that draws — the tint, the windows, the hearth —
   * asks for the hour every frame. Written back to the profile whenever the
   * glass moves it; see `worldNow`, which is the only thing that should ever
   * read it.
   */
  private clockOffset = 0;
  /**
   * How far the glass has poured *so far*, while the sand is running.
   *
   * Kept apart from `clockOffset` so that what is written down is only ever
   * a settled clock: a page closed halfway through the sand should reopen on
   * the hour it was wound to, not on the hour it was passing through.
   */
  private pouring = 0;
  private sandGlass?: SandGlass;
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
  private framedRoom: {
    width: number;
    height: number;
    at: { x: number; y: number };
  } | null = null;

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
  /**
   * Every child on this device, for the nameplates on the four houses.
   *
   * All of them rather than the one playing: the plates say who lives in the
   * village, and a sibling's house is theirs whether or not they are the one
   * holding the tablet. Read once when the scene starts, because profiles
   * are made on the screen before this one.
   */
  private household: readonly Profile[] = [];
  private interiorSidecars = new Map<string, InteriorSidecar>();
  /**
   * The parts the one growable room is assembled from, once loaded.
   *
   * Null in a world whose assets predate it, which is why every use of it is
   * guarded: a missing sidecar means the cottage falls back to the picture
   * every other room is, rather than the game refusing to open a door.
   */
  private growable: GrowableSidecar | null = null;
  /**
   * The floor plan of every house somebody has added a room to, by building.
   *
   * Only the houses that have been *changed*: a cottage nobody has touched
   * is the cottage the generator shipped, and `planFor` says so. Keyed by
   * building rather than by child, because a house is a fact about the world
   * and two siblings on one tablet live in different ones.
   */
  private plans = new Map<string, RoomPlan>();
  /**
   * How each house is furnished, by building.
   *
   * The shipped placements are a *starting* arrangement, not a fact about
   * the picture: everything in a room but the hearth is an ordinary thing
   * that can be picked up and put down again. Only houses somebody has
   * rearranged are in here; `decorFor` fills in the rest from the sidecar.
   */
  private decor = new Map<string, Placed[]>();
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
  /** Where the three wild flowers grew, for a script that has to walk to one. */
  private wildFlowers: readonly WildSpot[] = [];
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
  /**
   * What each of them is called, by id.
   *
   * Settled once, when the cast is assembled, because names are handed out
   * in cast order and a second reckoning somewhere else would hand out a
   * different set. Empty until then, and `nameCast` puts the named roles in
   * whatever the world holds, so a lookup before the world is built gets the
   * teacher rather than nothing.
   */
  private npcNames: ReadonlyMap<string, string> = nameCast([]);
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
    // How far this child's glass has already wound the world. Read once,
    // here, because everything that draws asks for the hour every frame —
    // and read at all because a clock that snapped back to the wall clock on
    // the way in would be a spell that undoes itself overnight.
    this.clockOffset = Math.max(0, this.profile.clockOffset);
    // Everybody on the device, for the nameplates. The child playing is
    // included by way of the store rather than by being appended: a script
    // that jumped straight here has an anonymous profile that was never
    // saved, and a village where the only plate is a stranger's would be
    // worse than a village of question marks.
    this.household = readProfiles(browserStore());
    const world = generateWorld(WORLD_SIZE, WORLD_SIZE, this.seed);
    this.grid = world.grid;
    this.worldGrid = world.grid;
    this.anchors = world.anchors;
    this.grove = world.grove;
    this.city = world.city;
    this.observatory = world.observatory;
    this.harbourFront = world.harbour;
    this.wildFlowers = world.wildFlowers;
    this.session = new GameSession({ grid: world.grid, start: this.startFor(world) });
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
    if (this.dev.materials > 0) {
      for (const material of MATERIAL_TYPES) this.inventory.add(material, this.dev.materials);
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
    this.npcNames = nameCast(this.villageNpcs);
    this.spawnAnimals(
      world.village.well,
      world.village.buildings,
      createRng(this.seed ^ 0x0a11_4a15),
    );
    this.spawnNpcs(this.villageNpcs, world.anchors.village);
    // After the cast, because a plate says who lives behind that door and
    // which villager wears which face is settled while they are spawned.
    this.hangNameplates();

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
    this.shopPanel.onBuy = (thing, count, _paid, look) => {
      this.session.buy(thing, count, look);
      this.refreshCarried();
    };
    // The shop draws its swatches with the same recolouring the room's own
    // furniture uses, so a chair on the shelf is the chair she will get.
    this.shopPanel.lookTexture = (piece, look) => this.decorTexture(piece, look);
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
    this.brickPopup = new BrickPopup(this, uiIndex, MODAL_DEPTH, this.words, (object) =>
      this.ui(object),
    );
    this.clockPopup = new ClockPopup(this, uiIndex, MODAL_DEPTH, this.words, (object) =>
      this.ui(object),
    );
    this.symmetryPopup = new SymmetryPopup(this, uiIndex, MODAL_DEPTH, this.words, (object) =>
      this.ui(object),
    );
    // Above the parchment, because the parchment has closed by the time the
    // sand runs and what is underneath is the world changing colour.
    this.sandGlass = new SandGlass(this, MODAL_DEPTH + 10, (object) => this.ui(object));
    this.patchMenu = new PatchMenu<PatchAction>(this, TOUCH_UI_DEPTH, (object) => this.ui(object));
    this.decorMenu = new PatchMenu<DecorItem>(this, TOUCH_UI_DEPTH, (object) => this.ui(object));
    this.flowerMenu = new PatchMenu<PlantedFlower>(this, TOUCH_UI_DEPTH, (object) =>
      this.ui(object),
    );
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
    // `?wall`: the bricklaying parchment, on its own, before anything else.
    // A beat first, so it opens over a world that has finished drawing
    // itself rather than over a grey screen.
    if (this.dev.wall) this.time.delayedCall(50, () => this.openBrickWall(() => {}));
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
    // The other half of the notice a parent read while the game was being
    // set up: the world lives on this device, so here is how to take it off.
    this.optionsPanel.onExport = () => exportSaves();
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
      armed: () => armedTag(this.armed),
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
      /**
       * The wall on the parchment: which brick is being asked for, what the
       * answer to it is, and what has been typed.
       *
       * The answer is handed over deliberately. A script cannot work a wall
       * out for itself without reimplementing the solver, and a test that
       * reimplements the thing it is testing checks nothing.
       */
      house: () => {
        const inside = this.interior;
        const parts = this.growable;
        if (!inside?.plan || !parts) return null;
        const door = growableDoor(parts);
        return {
          room: inside.room,
          id: inside.house ?? null,
          floor: [...inside.plan.floor],
          origin: { ...inside.origin },
          buildable: buildableCells(inside.plan, door).map(({ col, row }) => ({
            col: col - inside.origin.col,
            row: row - inside.origin.row,
          })),
        };
      },
      shop: () => this.shopPanel?.counter ?? null,
      decor: () => {
        const inside = this.interior;
        if (!inside?.plan || !inside.house) return null;
        return this.decorIn(inside.house).map(({ piece, col, row, look }) => ({
          piece,
          col,
          row,
          look,
        }));
      },
      bricks: () => {
        const cast = this.brickPopup?.cast;
        if (!cast) return null;
        const asked = brickBeingAsked(cast);
        return {
          values: [...cast.problem.values],
          hidden: [...cast.problem.hidden],
          asked,
          answer: asked === null ? null : (cast.problem.values[asked] ?? null),
          entry: cast.entry,
          missteps: cast.missteps,
          done: cast.done,
        };
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
        night: nightTintAlpha(this.hourNow()),
        alpha: this.nightOverlay?.fillAlpha ?? 0,
      }),
      clock: () => {
        const cast = this.clockPopup?.cast;
        if (!cast) return null;
        const asked = askedOf(cast);
        return {
          from: cast.from,
          to: cast.to,
          hours: asked.hours,
          minutes: asked.minutes,
          entry: cast.hours,
          entryMinutes: cast.minutes,
          box: cast.box,
          asksMinutes: asksMinutes(cast),
          done: cast.done,
          // Where the face she drags is, so a script can take hold of a hand.
          grip: this.clockPopup?.face ?? null,
        };
      },
      /**
       * The grid on the mirror parchment, and where it is on the screen.
       *
       * The only spell whose answer is a *tap on a picture*: there is no box
       * to type into and no button with a name. So the grid is published —
       * where it is drawn, which squares came with it, and which ones are
       * still wanted — and a script taps the squares the game itself worked
       * out rather than ones it guessed.
       */
      symmetry: () => {
        const cast = this.symmetryPopup?.cast;
        if (!cast) return null;
        return {
          size: cast.size,
          axis: cast.axis,
          given: [...cast.given],
          wanted: [...cast.wanted],
          filled: [...cast.filled],
          board: this.symmetryPopup?.where ?? null,
          done: cast.done,
          missteps: cast.missteps,
          wrong: cast.wrong,
          hinting: symmetryHint(cast) !== null,
        };
      },
      /**
       * The three wild flowers, and which of them this child has found.
       *
       * Where they grow is chosen from the world's seed out of every cell
       * the connectivity pass proved walkable, so it is a different answer
       * in every world and there is nothing a script could hard-code. This
       * is how a scenario walks to one.
       */
      flowers: () => ({
        wild: this.wildFlowers,
        found: [...this.foundFlowers],
        planted: this.worldGrid.listObjects().flatMap((object) => {
          const parts = flowerParts(object.type);
          return parts ? [{ ...parts, col: object.col, row: object.row }] : [];
        }),
      }),
      inside: () => {
        const room = this.interior;
        return room ? { room: room.room, building: room.house ?? null } : null;
      },
      /**
       * Where the camera is pulled to.
       *
       * The one number in the game that depends on how big the screen is, so
       * it is also the one a scenario cannot work out for itself — see
       * `markingZoom`. Reported live rather than as the constant, because
       * what is worth checking is that it *moved* and came back.
       */
      zoom: () => this.cameras.main.zoom,
      openHours: () => ({
        open: this.villageIsOpen,
        hour: this.hourNow(),
        opensIn: opensIn(this.hourNow()),
      }),
      // Where the world's clock stands, and how far it has been wound from
      // the real one. The spell's whole effect, and nothing on screen states
      // it as a number — the light does, which a script cannot read.
      worldClock: () => ({
        hour: this.hourNow(),
        offset: this.clockOffset,
      }),
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
      this.touching.set(pointer.id, { x: pointer.x, y: pointer.y });
      // A second finger is a pinch, and a pinch is not a tap. Checked before
      // everything below it, because everything below it would answer this
      // finger with the thing it was aimed at — and a second finger landing
      // on a tree while the times rune is lit would cast the spell there.
      if (this.beginPinch()) return;
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
      // Nor does the finger left over from a pinch: it is halfway through a
      // gesture that was never about walking anywhere.
      if (this.pinched) return;
      // Touch steers with the floating joystick; a mouse walks to the tile it
      // clicked. Deliberately not both on touch: a press cannot be a stick
      // and a destination at once, and the stick is the one you can hold.
      if (this.joystick) this.joystick.begin(pointer);
      else this.handleTileClick(pointer.worldX, pointer.worldY);
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.touching.has(pointer.id)) {
        this.touching.set(pointer.id, { x: pointer.x, y: pointer.y });
      }
      if (this.dragPinch()) return;
      this.joystick?.move(pointer);
    });
    // pointerupoutside fires when the finger leaves the canvas still held —
    // without it the stick would stay stuck on and the player walk forever.
    for (const event of ["pointerup", "pointerupoutside"]) {
      this.input.on(event, (pointer: Phaser.Input.Pointer) => {
        this.touching.delete(pointer.id);
        this.endPinch(pointer.id);
        this.joystick?.end(pointer);
      });
    }
  }

  override update(time: number): void {
    this.frameCounter++;
    const hour = this.hourNow();
    if (!this.interior) {
      this.refreshVisibleChunks();
      this.updateNpcs(isOpenHours(hour));
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
  /**
   * Move everything that lives in both modes to whichever layer is showing.
   *
   * The player is the obvious one and was the only one for a long time. The
   * three sheets of ink are the same case and were not: they are made once
   * in `create`, when there is no interior, so they were filed under the
   * world layer for good — and the world layer is *hidden* while a room is
   * on screen. The marker the times spell draws over the ground it is about
   * to act on was therefore invisible in a house, which is where a child now
   * marks out the room they are building.
   *
   * Not a depth problem: they sit at zero and the room's own picture is at
   * `CHUNK_DEPTH`, a thousand below. A hidden layer draws nothing whatever
   * its contents are sorted to.
   */
  private movePlayerToLayer(): void {
    const showing = this.sceneryLayer();
    for (const object of [this.player, this.patchInk, this.aimInk, this.socketInk]) {
      if (!object) continue;
      this.worldLayer.remove(object);
      this.interiorLayer.remove(object);
      showing.add(object);
    }
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
    // How far out the camera belongs depends on how wide the screen is, so a
    // phone turned sideways while a patch is half drawn wants asking again.
    // Before the reframe, because the framing is worked out from the zoom.
    this.applyZoom();
    // The room's bounds are computed from the camera's own size, so a room
    // framed for a portrait screen is framed wrong the moment it is not one.
    if (this.interior) this.reframeInterior();
    this.uiCamera?.setSize(width, height);
    this.nightOverlay?.setSize(width, height);
    for (const button of this.edgeAnchored) button.place(width, height);
    // The popup can be open across a phone rotation, and every one of its
    // pieces is placed from the viewport's size.
    this.spellPopup?.layout();
    this.brickPopup?.layout();
    this.symmetryPopup?.layout();
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
  /**
   * How much of a light's reach to draw, given where the camera is.
   *
   * Every radius in this file is quoted "in screen pixels at the world
   * zoom", and until the array spell started pulling the camera out that was
   * a distinction without a difference — the zoom never moved. It moves now,
   * and a radius left in raw screen pixels would light twice the floor at
   * half the zoom: a lamp in a cottage at night would visibly swell the
   * moment a child armed the times rune.
   *
   * So the radii mean what they always said they meant, and this is the
   * factor that keeps them meaning it: a light covers the same *ground*
   * whatever the camera is doing.
   */
  private get lightScale(): number {
    return this.cameras.main.zoom / CAMERA_ZOOM;
  }

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
        .setDisplaySize(
          PLAYER_LIGHT_RADIUS * 2 * this.lightScale,
          PLAYER_LIGHT_RADIUS * 2 * this.lightScale,
        )
        .setAlpha(strength * PLAYER_GLOW_ALPHA);
    }
    for (const [key, glow] of this.lampGlows) {
      const cell = this.lamps.get(key);
      glow.setVisible(cell !== undefined && alpha > 0);
      if (!cell || alpha <= 0) continue;
      const at = this.screenOf(cell.col, cell.row);
      glow
        .setPosition(at.x, at.y - TILE_SIZE)
        .setDisplaySize(
          LAMP_LIGHT_RADIUS * 2 * this.lightScale,
          LAMP_LIGHT_RADIUS * 2 * this.lightScale,
        )
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
      .setDisplaySize(
        TREE_LIGHT_RADIUS * 2 * this.lightScale,
        TREE_LIGHT_RADIUS * 2 * this.lightScale,
      )
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
    // The flame that drives the flicker. In a room that is one animated
    // picture it is the picture; in a room assembled from parts it is the
    // fireplace, which is the only piece that moves — and a RenderTexture
    // has no `anims` at all, which is what asking the wrong one cost.
    const flame = this.interior?.fires[0] ?? (this.interior?.canvas ? null : this.interior?.image);
    const frames = flame?.anims?.currentAnim?.frames.length ?? 1;
    const index = flame?.anims?.currentFrame?.index ?? 1;
    const phase = frames > 1 ? ((index - 1) % frames) / frames : 0;
    const flicker = 1 - (HEARTH_FLICKER * (1 - Math.cos(phase * Math.PI * 2))) / 2;
    glow
      .setPosition(at.x, at.y - TILE_SIZE)
      .setDisplaySize(
        HEARTH_LIGHT_RADIUS * 2 * this.lightScale,
        HEARTH_LIGHT_RADIUS * 2 * this.lightScale,
      )
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
          .setDisplaySize(
            WINDOW_LIGHT_RADIUS * 2 * this.lightScale,
            WINDOW_LIGHT_RADIUS * 2 * this.lightScale,
          )
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
  /** The fire in a room that has one, at a cell the caller has worked out. */
  private lightHearthAt(cell: GridPoint): void {
    // Snuffed first, exactly as `lightHearth` does. `paintPlan` runs on every
    // square built, so without this a child who adds nine squares in one
    // multiplication cast leaves nine orphaned glows behind — hidden, so
    // nothing on screen would ever have shown it.
    this.snuffHearth();
    this.hearth = cell;
    this.hearthGlow = this.newGlow(HEARTH_GLOW_COLOR);
  }

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
    this.registerFlowerAnims();
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

  /**
   * One looping sway per flower per colour.
   *
   * Five animations each rather than one, because the sheet holds five
   * colourways end to end and a look is a *slice* of it. Registered up front
   * for every colour whether or not this child has found the flower: an
   * animation is a table entry, and building one the moment a child taps a
   * colour would be building it during the tap.
   */
  private registerFlowerAnims(): void {
    for (const flower of FLOWER_TYPES) {
      const sidecar = this.cache.json.get(flowerSidecarKey(flower)) as FixtureSidecar | undefined;
      if (!sidecar) throw new Error(`missing sidecar for flower "${flower}"`);
      this.flowerSidecars.set(flower, sidecar);
      for (let look = 0; look < FLOWER_LOOKS; look++) {
        const key = flowerAnimKey(flower, look);
        if (this.anims.exists(key)) continue;
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(flowerSheetKey(flower), {
            frames: flowerFrames(look, sidecar.frames_per_look),
          }),
          frameRate: FIXTURE_ANIM_FPS,
          repeat: -1,
        });
      }
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
    // The parts the cottage can be rebuilt from, if this build shipped them.
    this.growable =
      (this.cache.json.get(growableSidecarKey(GROWABLE_ROOM)) as GrowableSidecar | undefined) ??
      null;
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
      const box = this.interior.bounds;
      const outsideTheRoom =
        targetCol < box.col ||
        targetRow < box.row ||
        targetCol >= box.col + box.cols ||
        targetRow >= box.row + box.rows;
      if (
        outsideTheRoom &&
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
      items: [
        ...PLANT_TYPES.map((plant, index) => ({
          texture: uiTextureKey(cropIcon(plant)),
          act: () => {
            // Picking a seed here is also what the number keys pick, so the
            // two routes never disagree about which crop Space would plant.
            // The keyboard still plants where she stands; a tap arms the
            // seed and waits for a square.
            this.selectedPlantIndex = index;
            this.arm({ kind: "seed", plant }, uiTextureKey(cropIcon(plant)));
          },
        })),
        // And the flowers, after the crops so no crop's position moves.
        //
        // Drawn dimmed until this child has walked into the wild one, rather
        // than left out — the same offer the spellbook makes with its
        // unlearned runes, and for the same reason: a pouch with a gap in it
        // says there is something to find.
        ...FLOWER_TYPES.map((flower) => ({
          texture: uiTextureKey(flowerIcon(flower)),
          act: () => this.plantFlower(flower),
          available: () => this.hasFoundFlower(flower),
        })),
      ],
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
        {
          texture: uiTextureKey(UiAsset.RuneMirror),
          act: () => this.castMirrorSpell(),
          available: () => this.knowsMirror,
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
        act: () => this.armFixture(fixture),
      })).concat(
        // Furniture goes in the crate with everything else a player puts
        // down: it is the same verb and it should live in the same place.
        // Its own picture is its icon — a bed at tray size reads as a bed,
        // and drawing a second one for the button would be two drawings to
        // keep in step.
        DECOR_TYPES.map((piece) => ({
          texture: growablePieceKey(GROWABLE_ROOM, pieceArt(piece)),
          count: () => this.decorHeld(piece),
          act: () => this.chooseDecorColour(piece),
        })),
      ),
      count: () =>
        PLACEABLE_FIXTURES.reduce((sum, f) => sum + this.inventory.count(f), 0) +
        DECOR_TYPES.reduce((sum, piece) => sum + this.decorHeld(piece), 0),
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
    // Not a tray at all: a gold coin and how many she has.
    //
    // It had slots — one per metal once, then one per coin — and every one
    // of them did nothing when tapped, because there is nothing to *do* with
    // a coin from out here. A button that opens a drawer of buttons that do
    // nothing is worse than no button, since it is the opening that invites
    // the tap. What a child wants from the corner of the screen is how much
    // money they have, and that is what the badge already said.
    //
    // The breakdown is not lost, it has moved to where it means something:
    // the shop lays her coins out on the table when there is a price to pay.
    this.purseTray = new IconTray(this, {
      texture: uiTextureKey(coinIcon(largestCoin(CURRENCY))),
      items: [],
      // Whole units, not the minor ones the purse counts in: a badge reading
      // "5000" for fifty ducat would be a number nobody in the game uses.
      count: () => Math.floor(this.purse.coins / CURRENCY.minorPerMajor),
      // Three digits here where everything else stops at two. A basket past
      // ninety-nine carrots is a basket where the number has stopped
      // mattering; a purse is the one count where it has not.
      mostShown: MOST_DUCATS_SHOWN,
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

    // Indoors, the same rune builds. A square of a house that is not there
    // yet is a square you can put there — one wall of bricks and a stone and
    // a plank, and the room is that much bigger. It is deliberately the
    // *addition* spell rather than a fourth rune: adding a square to a room
    // is adding, and a child who has learned what the plus rune does should
    // find it does that everywhere.
    if (this.buildCastAt(at)) return;

    const target = this.session.checkGrowth(at);
    if (!target.ok || !target.tile) {
      this.report(target);
      return;
    }
    const { col, row } = target.tile;
    // A stick still held when the parchment opens never sends its release,
    // and the player walks off the moment the popup closes.
    this.joystick?.release();
    const rung = rungAt(this.dev.rung ?? this.profile.rung);
    this.spellPopup.open(makeAdditionProblem(this.spellRng, rung), rung.given, (result) => {
      if (result.solved) this.growCropAt(col, row);
      this.noteCast(result);
    });
  }

  /**
   * What one square of house costs.
   *
   * A stone and a plank, and the point of it is that both come from the
   * *clearing* spell. Subtraction is the spell this game under-uses, and a
   * child who wants a bigger house now has a reason to go and take a tree
   * out of the ground — which is a better answer to "why would anybody cast
   * minus" than anything a shop could sell.
   */

  /**
   * Build a square of house, if that is what this tap was.
   *
   * Returns whether it took the tap. False means the square was not a
   * buildable one and the growth spell should go on to do what it does
   * outdoors — so a child casting plus on the floor they are standing on
   * still gets told about the crop that is not there rather than about
   * bricks.
   */
  private buildCastAt(at: GridPoint): boolean {
    const inside = this.interior;
    const parts = this.growable;
    if (!inside?.plan || !parts) return false;
    // Grid space to plan space. Everything below is in the plan's own
    // coordinates, which may be negative.
    const cell = { col: at.col + inside.origin.col, row: at.row + inside.origin.row };
    if (!canBuild(inside.plan, cell, growableDoor(parts))) return false;

    const short = ROOM_COST.filter(([item, n]) => this.inventory.count(item) < n);
    if (short.length > 0) {
      // The refusal says what is missing rather than that something is: a
      // cross on its own is the game saying no with no way to find out why.
      this.showCostOnPlayer(ROOM_COST.map(([item]) => materialIcon(item)));
      return true;
    }

    this.joystick?.release();
    this.openBrickWall(() => this.layFloorAt(cell));
    return true;
  }

  /**
   * Take a square of house back up, if that is what this tap was.
   *
   * Returns whether it took the tap, the same way `buildCastAt` does — false
   * means the square was not one that could come up, and the clearing spell
   * carries on to say what it normally would.
   *
   * **A square only comes up if the room survives it.** Somebody standing on
   * it, a bed on it, the floor behind the front door, or a cut that would
   * leave the room in two halves: all refused, and refused before the sum is
   * asked, so a wrong tap costs a tap. The last of those is the one a child
   * cannot see coming, which is why it is worked out rather than guessed at
   * — see `whyNotUnbuild`.
   */
  private unbuildCastAt(at: GridPoint): boolean {
    const inside = this.interior;
    const parts = this.growable;
    if (!inside?.plan || !parts) return false;
    const cell = { col: at.col + inside.origin.col, row: at.row + inside.origin.row };
    if (!canUnbuild(inside.plan, cell, growableDoor(parts), this.spokenFor())) return false;

    this.joystick?.release();
    const rung = rungAt(this.dev.rung ?? this.profile.rung);
    this.spellPopup.open(makeSubtractionProblem(this.spellRng, rung), rung.given, (result) => {
      if (result.solved) this.takeFloorUp([cell]);
      this.noteCast(result);
    });
    return true;
  }

  /**
   * Every square of the room that something is already on.
   *
   * The furniture, and the child herself. Both in the plan's own
   * coordinates, because that is what the rules are written in.
   */
  private spokenFor(): Set<string> {
    const inside = this.interior;
    const parts = this.growable;
    if (!inside?.plan || !parts || !inside.house) return new Set<string>();
    const her = this.session.tile;
    return protectedCells(parts, this.decorIn(inside.house), {
      col: her.col + inside.origin.col,
      row: her.row + inside.origin.row,
    });
  }

  /**
   * Take squares of floor up, and hand back what they cost.
   *
   * A plank and a stone each, the same as they took to lay. Building a room
   * the wrong shape is a mistake a child should be able to undo for the
   * price of a sum, not for the price of going back to the woods — and a
   * refund that did not match the cost would make the minus spell either a
   * penalty or a way of printing planks.
   *
   * Everything downstream happens once, whatever the count: one grid, one
   * repaint, one reframe, one save. See `layFloor`, which this mirrors.
   */
  private takeFloorUp(cells: readonly GridPoint[]): void {
    const inside = this.interior;
    const parts = this.growable;
    if (!inside?.plan || !inside.house || !parts || cells.length === 0) return;

    const wasCol = this.session.tile.col + inside.origin.col;
    const wasRow = this.session.tile.row + inside.origin.row;

    let smaller = inside.plan;
    for (const cell of cells) {
      for (const [item, count] of ROOM_COST) this.inventory.add(item, count);
      smaller = unbuildFrom(smaller, cell);
      this.playEffect(EffectType.Minus, cell.col - inside.origin.col, cell.row - inside.origin.row);
    }
    inside.plan = smaller;
    this.plans.set(inside.house, smaller);

    const door = growableDoor(parts);
    const { grid, origin, extent } = buildPlanGrid(smaller, door, this.blockers(inside.house));
    inside.grid = grid;
    inside.origin = origin;
    inside.bounds = {
      col: extent.minCol - origin.col,
      row: extent.minRow - origin.row,
      cols: extent.cols,
      rows: extent.rows,
    };
    inside.exit = { col: door.col - origin.col, row: door.row - origin.row };
    this.grid = grid;
    this.paintPlan();
    this.placePlayer(wasCol - origin.col, wasRow - origin.row, this.session.facing);
    this.frameGrownRoom();
    this.refreshCarried();
    this.autosave();
  }

  /**
   * Put the square down, and pay for it.
   *
   * Paid here rather than before the wall goes up, so a child who closes the
   * parchment half way through has spent nothing. There is no fail state
   * anywhere in this game and abandoning a cast is not one either.
   */
  private layFloorAt(cell: GridPoint): void {
    this.layFloor([cell]);
  }

  /**
   * Put squares of floor down, and pay for them.
   *
   * Takes a list rather than a square because the multiplication spell lays
   * a whole patch at once, and everything after the plan itself is *per
   * room* rather than per square: one grid, one repaint, one reframe, one
   * save. Nine squares laid one at a time was nine RenderTexture rebuilds
   * and nine writes to storage inside a single cast, all but the last of
   * them describing a room that existed for a frame.
   *
   * The cells arrive in an order that works — each one buildable given only
   * the ones before it — because `buildableIn` walked a plan forward to find
   * them. Applied in that order they stay valid.
   *
   * Paid here rather than before the wall goes up, so a child who closes the
   * parchment half way through has spent nothing. There is no fail state
   * anywhere in this game and abandoning a cast is not one either.
   */
  private layFloor(cells: readonly GridPoint[]): void {
    const inside = this.interior;
    const parts = this.growable;
    if (!inside?.plan || !inside.house || !parts || cells.length === 0) return;

    // Where she is standing, in the plan's own coordinates. Read before
    // anything moves: a room that grows west shifts every grid cell one to
    // the right, and a player left at her old numbers would be standing a
    // square from where she was.
    const wasCol = this.session.tile.col + inside.origin.col;
    const wasRow = this.session.tile.row + inside.origin.row;

    let grown = inside.plan;
    for (const cell of cells) {
      for (const [item, count] of ROOM_COST) this.inventory.remove(item, count);
      grown = buildOn(grown, cell);
    }
    inside.plan = grown;
    this.plans.set(inside.house, grown);

    // The room is a different shape now, so everything measured from it is
    // rebuilt: the grid she walks on, the picture, and the camera framing.
    const door = growableDoor(parts);
    const { grid, origin, extent } = buildPlanGrid(grown, door, this.blockers(inside.house));
    inside.grid = grid;
    inside.origin = origin;
    inside.bounds = {
      col: extent.minCol - origin.col,
      row: extent.minRow - origin.row,
      cols: extent.cols,
      rows: extent.rows,
    };
    inside.exit = { col: door.col - origin.col, row: door.row - origin.row };
    this.grid = grid;
    this.paintPlan();
    this.placePlayer(wasCol - origin.col, wasRow - origin.row, this.session.facing);
    this.frameGrownRoom();
    this.autosave();
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
    // Indoors it marks out floor to build rather than ground to plant, and
    // only in a room that can be added to: a patch drawn on the schoolhouse
    // is a rectangle nothing could happen to.
    if (this.interior && !this.interior.plan) {
      this.showRefusalOnPlayer();
      return;
    }
    if (this.marking) {
      this.stopMarking();
      return;
    }
    this.joystick?.release();
    // **What, before where.** The choice used to come after the ground was
    // marked, off a menu that also said how many squares were in it — which
    // is the answer to the multiplication about to be asked. Asking first
    // takes the answer off the screen, and it reads better besides: a child
    // decides what they are doing and then goes and does it, rather than
    // drawing a rectangle and being asked what it was for.
    this.openSpellChoice();
  }

  /**
   * Which spell is being multiplied: the plus one or the minus one.
   *
   * Over her head rather than over the ground, because there is no ground
   * yet — this is the first thing that happens when the times rune is
   * tapped. Everything offered here is offered *unconditionally*, since
   * whether a patch has anything to grow in it cannot be known before the
   * patch exists; a choice that turns out to land on nothing is refused when
   * the rectangle is drawn, which is before any sum has been asked.
   */
  private openSpellChoice(): void {
    // Copying is offered outdoors and only to a child who has been taught
    // the mirror spell: it is that spell's effect, and the times spell is
    // what makes it a block rather than a square. Indoors there is no ground
    // to move — a floor is a floor — so it is not on the menu there.
    const outdoors = this.interior?.plan
      ? [PatchAction.Build, PatchAction.Clear]
      : this.knowsMirror
        ? [PatchAction.Grow, PatchAction.Clear, PatchAction.Copy]
        : [PatchAction.Grow, PatchAction.Clear];
    const choices = outdoors.map((action) => ({
      action,
      rune: uiTextureKey(SPELL_RUNES[action]),
    }));
    // A menu of one is not a choice. Indoors there is only the plus rune to
    // pick, so picking it is a tap that asks a child to confirm a decision
    // the game already made for them.
    const only = choices[0];
    if (choices.length === 1 && only) {
      this.beginMarking(only.action);
      return;
    }
    const above = this.screenOfPoint(this.player.x, this.player.y - TILE_SIZE);
    this.patchMenu?.openAt(above, choices, (action) => this.beginMarking(action));
  }

  private beginMarking(action: PatchAction): void {
    this.patchMenu?.close();
    // The square she is pointing at is the patch's first corner, if she is
    // pointing at one. That is what the pointing is *for* — she has already
    // said where, and asking again would be asking twice.
    const aimed = this.session.aimed;
    this.marking = aimed
      ? { from: aimed, patch: patchBetween(aimed, aimed, this.worldGrid), action }
      : { from: null, patch: null, action };
    // The rune hangs over her head for as long as the spell is armed. It is
    // the whole of "mark out the ground": a spell that is waiting for a tap
    // and says nothing is a spell that looks like it did not fire.
    this.raiseArmedRune(uiTextureKey(UiAsset.RuneTimes));
    // Out, so the whole reach is on screen. On anything desktop-shaped this
    // does nothing at all; on a phone it is the difference between drawing a
    // rectangle and drawing a line — see `markingZoom`.
    this.applyZoom();
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
    this.arm({ kind: "spell", spell }, uiTextureKey(rune));
  }

  /**
   * Light something over her head and rule off the ground it can go on.
   *
   * One path for a spell and for a thing to put down, which is the whole of
   * this change: they were two interfaces for one question. A spell asked
   * *what, then where*; a seed and a fence and a chair asked *stand in the
   * right place, then what* — which is the ordering a playtest had already
   * rejected once for the spells, for the reason it fails here too. Lining a
   * character up with a square is a thing an adult does without noticing and
   * a six-year-old cannot do at all.
   *
   * Tapping the same thing again puts it out.
   */
  private arm(what: Armed, texture: string, frame?: number): void {
    if (this.modalOpen) return;
    this.closeTrays();
    // One thing waiting at a time. Arming a seed while the array spell is
    // out for a corner would leave two things wanting the same tap.
    this.stopMarking();
    const same = armedTag(this.armed) === armedTag(what);
    this.disarm();
    if (same) return;
    this.armed = what;
    // A stick still held when the rune lights never sends its release, and
    // she walks on while the ground she is choosing from slides away.
    this.joystick?.release();
    this.raiseArmedRune(texture, frame);
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
    const held = this.armed;
    if (!held) return;
    const at = this.toGrid(worldX, worldY);
    if (!withinReach(this.session.tile, at)) {
      this.markTooFar(at.col, at.row);
      return;
    }
    this.disarm();
    if (held.kind === "spell") {
      if (held.spell === Spell.Growth) this.growthCastAt(at);
      else if (held.spell === Spell.Mirror) this.mirrorTapAt(at);
      else this.clearingCastAt(at);
      return;
    }
    // Everything else goes in the ground, and everything that goes in the
    // ground already works on `targetTile` — the square she has pointed at,
    // or the one she is facing if she has not. So putting a thing down on a
    // tapped square is *pointing at it first*, and none of the four routes
    // below has to know this happened.
    this.session.aimAt(at);
    this.paintAim();
    if (held.kind === "seed") this.plantSeed(held.plant);
    else if (held.kind === "fixture") this.placeFixture(held.fixture);
    else if (held.kind === "decor") this.putDecorDown(held.piece, held.look);
    else this.putFlowerDown(held.flower, held.look);
  }

  /** Put the marker away, whatever state it was in. */
  private stopMarking(): void {
    if (!this.marking) return;
    this.marking = null;
    this.settling = false;
    // Back in, and from here rather than from each of the ways marking ends.
    // There are five — cast, the rune tapped again, a cancel, a panel
    // opening over it, and walking out of the room — and every one of them
    // already comes through here.
    this.applyZoom();
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
    if (!marking || this.settling) return;
    const at = this.tileAtWorld(worldX, worldY);
    if (!at) return;
    if (!marking.from) {
      this.marking = { ...marking, from: at, patch: patchBetween(at, at, this.worldGrid) };
      this.paintPatch();
      return;
    }
    const patch = patchBetween(marking.from, at, this.worldGrid);
    if (!patchIsCastable(patch)) {
      // A single square is not a multiplication. Rather than refuse the tap,
      // the corner moves — which is what a child who tapped the same cell
      // twice almost certainly meant.
      this.marking = { ...marking, from: at, patch: patchBetween(at, at, this.worldGrid) };
      this.paintPatch();
      // One square is not a rectangle. The corner has already moved to where
      // she tapped, so the only thing left to say is *not that one* — on the
      // square, where she is looking.
      this.markRefusal(at.col, at.row);
      return;
    }
    this.marking = { ...marking, from: marking.from, patch };
    this.paintPatch();
    // A beat on the finished rectangle before the sum covers it up. Taps are
    // ignored while it runs: without that, a child tapping quickly would
    // re-anchor a corner on a rectangle the game had already accepted, and
    // get a second sum for it.
    this.settling = true;
    this.time.delayedCall(PATCH_BEAT_MS, () => {
      this.settling = false;
      // Unless they changed their mind in the meantime — tapping the rune
      // again cancels, and a cancelled marking must not still go off.
      if (this.marking?.patch !== patch) return;
      this.beginPatchCast(patch, marking.action);
    });
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
    if (this.interior?.plan) {
      return [
        { action: PatchAction.Build, cells: this.buildableIn(patch) },
        { action: PatchAction.Clear, cells: this.removableIn(patch) },
      ];
    }
    return [
      { action: PatchAction.Grow, cells: this.session.growableIn(patch) },
      { action: PatchAction.Clear, cells: this.session.clearableIn(patch) },
    ];
  }

  /**
   * Which squares of a marked patch could be built on, and how many are paid for.
   *
   * Capped by the basket. A patch of nine squares with wood for four in it
   * builds four, and the four it builds are the ones nearest the front of
   * the list — which beats refusing the whole cast, because the child has
   * answered the sum either way and a cast that does nothing looks broken.
   */
  private buildableIn(patch: Patch, afford = true): GridPoint[] {
    const inside = this.interior;
    const parts = this.growable;
    if (!inside?.plan || !parts) return [];
    const most = afford ? this.roomsAfforded() : Number.POSITIVE_INFINITY;
    return buildableIn(inside.plan, this.planPatch(patch), growableDoor(parts), most).map((at) =>
      this.toGridCell(at),
    );
  }

  /**
   * Which squares of a marked patch could be taken up, in the order they may
   * go.
   */
  private removableIn(patch: Patch): GridPoint[] {
    const inside = this.interior;
    const parts = this.growable;
    if (!inside?.plan || !parts) return [];
    return removableIn(
      inside.plan,
      this.planPatch(patch),
      growableDoor(parts),
      this.spokenFor(),
    ).map((at) => this.toGridCell(at));
  }

  /** A marked rectangle, carried across into the plan's own coordinates. */
  private planPatch(patch: Patch): PlanPatch {
    const origin = this.interior?.origin ?? { col: 0, row: 0 };
    return {
      col: patch.col + origin.col,
      row: patch.row + origin.row,
      width: patch.width,
      height: patch.height,
    };
  }

  /** And back again, for anything the scene has to draw or tap. */
  private toGridCell(at: GridPoint): GridPoint {
    const origin = this.interior?.origin ?? { col: 0, row: 0 };
    return { col: at.col - origin.col, row: at.row - origin.row };
  }

  /** How many squares of floor the basket will pay for. See `roomsAfforded`. */
  private roomsAfforded(): number {
    return roomsAfforded((item) => this.inventory.count(item));
  }

  /**
   * The choice: plant it, grow it, or clear it.
   *
   * Only the ones that would actually do something are offered. An action
   * greyed out on every patch a child ever draws is a button they learn to
   * ignore; an action that is simply not there when there is nothing for it
   * to do is a menu that answers the question "what can I do here".
   */
  /**
   * Whether this patch has anything in it for the spell that was chosen.
   *
   * Asked when the rectangle is finished and *before* any sum, so a choice
   * that turns out to land on nothing costs a child a tap rather than two
   * minigames. It is the one thing the old order got for free: the menu was
   * built from the patch, so an action with nothing to do was never offered.
   */
  private patchIsWorthCasting(patch: Patch, action: PatchAction): boolean {
    // Every square of ground can be copied, so there is nothing here to
    // find nothing in. Whether it will *go* where she puts it is a question
    // about the far end, and it is asked there.
    if (action === PatchAction.Copy) return true;
    const offer = this.patchOffers(patch).find((each) => each.action === action);
    if (offer && offer.cells.length > 0) return true;
    // Indoors there are two ways to have nothing to do, and they want
    // different answers. Nowhere to build is the cross; somewhere to build
    // and no wood behind it is the price, said the same way one square says
    // it. A cross for the second is the game refusing over something the
    // child can go and fix, and not saying so.
    if (action === PatchAction.Build && this.buildableIn(patch, false).length > 0) {
      this.stopMarking();
      this.showCostOnPlayer(ROOM_COST.map(([item]) => materialIcon(item)));
      return false;
    }
    // Every square in it is already dimmed by `paintPatch`; the cross says
    // that the dimming is the whole patch rather than part of it.
    this.markRefusal(
      patch.col + Math.floor(patch.width / 2),
      patch.row + Math.floor(patch.height / 2),
    );
    return false;
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
    if (!this.patchIsWorthCasting(patch, action)) return;
    this.joystick?.release();
    // Copying needs one thing none of the others do: somewhere to put it.
    // So it steps out here to ask, and comes back in at `castOnce` with the
    // far corner chosen — after which it is an ordinary patch cast, the
    // mirror's puzzle first and the multiplication second, like every other
    // action on this menu.
    if (action === PatchAction.Copy) {
      this.mirrorFrom = patchCells(patch);
      this.mirrorPatch = patch;
      this.stopMarking();
      // Lit and waiting for the far corner, exactly as a single square is.
      this.armSpell(Spell.Mirror, UiAsset.RuneMirror);
      return;
    }
    // **The spell once, then the multiplication.** A child casts the thing
    // they are about to do many times over, once, by hand — and only then is
    // asked how many times. That order is the spell's whole argument:
    // multiplication is doing the same thing many times without doing it
    // many times, and a child who has not done it once has not been shown
    // what is being multiplied.
    //
    this.castOnce(action, (worked) => {
      if (!worked) {
        this.stopMarking();
        return;
      }
      this.askTheMultiplication(patch, action);
    });
  }

  /**
   * The one cast that stands for all of them: plus, minus, or a wall.
   *
   * `done(false)` for a parchment closed part way through, which ends the
   * whole cast — nothing is marked out any more and nothing happens. There
   * is no fail state here: a wrong answer costs the cast its cleanness and
   * nothing else, and closing a panel was never one either.
   */
  private castOnce(action: PatchAction, done: (worked: boolean) => void): void {
    if (action === PatchAction.Copy) {
      this.openMirrorPuzzle(done);
      return;
    }
    if (action === PatchAction.Build) {
      // The brick wall, which is the addition spell indoors. One wall for
      // the whole room, not one per square — that is what the times spell
      // is *for*.
      this.openBrickWall(() => done(true));
      return;
    }
    const rung = rungAt(this.dev.rung ?? this.profile.rung);
    const problem =
      action === PatchAction.Grow
        ? makeAdditionProblem(this.spellRng, rung)
        : makeSubtractionProblem(this.spellRng, rung);
    this.spellPopup.open(problem, rung.given, (result) => {
      this.noteCast(result);
      done(result.solved);
    });
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
  private askTheMultiplication(patch: Patch, action: PatchAction): void {
    const rung = arrayRungAt(this.dev.arrayRung ?? this.profile.arrayRung);
    const problem = arrayProblemFor(patch.height, patch.width, rung);
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
    let done = 0;
    // Indoors first: the minus rune means "take the floor up" in here and
    // "clear the ground" out there, and the indoor reading has to be tried
    // before the outdoor one or it is never reached.
    if (action === PatchAction.Clear && this.interior?.plan) {
      // Worked out once and applied together, because the origin can move
      // underneath a patch and a list recomputed mid-way would be a list in
      // the wrong coordinates.
      const before = { ...this.interior.origin };
      const cells = this.removableIn(patch).map((at) => ({
        col: at.col + before.col,
        row: at.row + before.row,
      }));
      this.takeFloorUp(cells);
      done += cells.length;
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
    } else if (action === PatchAction.Copy) {
      // Planned before either parchment opened, and held since: the ground
      // it was measured against has not moved, and re-planning here would
      // be measuring a second time and hoping for the same answer.
      const paint = this.mirrorPaint ?? [];
      this.paintGround(paint);
      done += paint.length;
      this.mirrorPaint = null;
    } else if (action === PatchAction.Build) {
      // Worked out once, in the coordinates that hold now, and laid in one
      // go. Laying them one at a time would move the origin under the patch
      // and leave the rest of the list pointing at the wrong squares.
      const inside = this.interior;
      const at = inside ? { ...inside.origin } : { col: 0, row: 0 };
      const cells = this.buildableIn(patch).map((cell) => ({
        col: cell.col + at.col,
        row: cell.row + at.row,
      }));
      this.layFloor(cells);
      done += cells.length;
    }
    void done;
  }

  /**
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
      // Ruled afresh each time the map is opened. The places do not move and
      // the ruler used not to either, which made the distance to the harbour
      // a thing to remember rather than a thing to measure. See `ruleAt`.
      ruleAt(portalRungAt(this.dev.portalRung ?? this.profile.portalRung), this.spellRng),
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
  /**
   * What time it is in this child's world, as a timestamp.
   *
   * The real clock plus however far the glass has wound it. Everything that
   * asks the time goes through here — the tint, the villagers' bedtimes, the
   * lit windows — so that winding the clock moves the whole world and not
   * just the number on a parchment.
   *
   * What deliberately does *not* go through here is how long a child has
   * been away: an absence is real time, and a world clock wound six hours
   * forward has not made anybody's evening six hours longer.
   */
  private worldNow(): number {
    return Date.now() + (this.clockOffset + this.pouring) * 60_000;
  }

  /** The hour the world is at, with the dev seam's override on top. */
  private hourNow(): number {
    return this.dev.hour ?? timeOfDay(new Date(this.worldNow()));
  }

  /**
   * Wind the world's clock on, and remember that it moved.
   *
   * Forward only, which is the spell's own rule rather than a guard: a face
   * shows twelve hours, so "put the hands there" always means the next time
   * it will be.
   */
  private windClockTo(face: ClockTime, over: number): void {
    const now = new Date(this.worldNow());
    // Where the world stands on a twelve-hour face, to the minute — not to
    // whatever the rung rounds to. The child answered about two rounded
    // faces; the world lands exactly on the one she pointed at, which is the
    // difference between "the clock says twenty past" and "the clock says
    // twenty past, give or take the rounding nobody told her about".
    const standing = (now.getHours() * 60 + now.getMinutes()) % 720;
    const forward = (face.hour * 60 + face.minute - standing + 720) % 720;
    if (forward <= 0) return;
    // Poured rather than set. The world's light is drawn from the hour every
    // frame, so running the offset up over the same seconds the sand takes
    // makes the sky move while she watches — which is the whole reward for
    // winding it: a child who sets the clock to dusk sees dusk arrive.
    this.sandGlass?.run(
      over,
      (along) => {
        this.pouring = forward * along;
      },
      () => {
        this.pouring = 0;
        this.clockOffset += forward;
        this.saveProfileChange({ clockOffset: this.clockOffset });
      },
    );
    // Nothing to repaint: the sky, the windows and the hearth all ask the
    // hour every frame, so the world catches up on its own within one.
  }

  /**
   * The clockmaker, under the tower.
   *
   * Taught for being spoken to, the way the geometer teaches the portal
   * spell — not earned by an errand, the way the astronomer's is. The two
   * are different on purpose: an errand is worth setting where the reward
   * would otherwise remove most of the work from the game, which is true of
   * the array spell and was true of the lamps, and is not true here. What
   * the hourglass costs a child is the walk to the city, and the city is a
   * long way.
   *
   * And then he opens the parchment, because a person standing beside a
   * clock tower who says hello and nothing else is a person who reads as
   * broken. Talking to him *is* casting it, at the one place in the world
   * where the hour is written on a wall.
   */
  private meetClockmaker(): void {
    if (this.modalOpen) return;
    this.joystick?.release();
    this.closeTrays();
    const learned = learnSpell(this.profile.learned, Spell.Hourglass);
    if (learned === this.profile.learned) {
      this.castHourglass();
      return;
    }
    this.saveProfileChange({ learned });
    this.spellTray?.refresh();
    this.showEarned(UiAsset.RuneHourglass);
    // The rune rises over her head, and *then* the parchment. Opening it at
    // once would draw a full-screen page over the one moment that says she
    // has been given something.
    this.time.delayedCall(EARNED_MS, () => this.castHourglass());
  }

  private castHourglass(): void {
    if (this.modalOpen) return;
    this.spellTray?.setOpen(false);
    if (!this.knowsHourglass) {
      this.showRefusalOnPlayer(UiAsset.RuneHourglass);
      return;
    }
    // No other gate, and there used to be three: something must have been
    // planted, the child must have been away, and long enough for the glass
    // to have anything to give. All three served a payout that is gone, and
    // between them they made the spell almost uncastable — a child who had
    // just sat down could never see it work.
    const rung = clockRungAt(this.dev.clockRung ?? this.profile.clockRung);
    this.joystick?.release();
    const from = readClock(this.worldNow(), rung.reading);
    this.clockPopup?.open(from, rung, (result, to) => {
      if (result.solved && to) this.windClockTo(to, sandFor(forwardMinutes(from, to)));
      this.noteClockCast(result);
    });
  }

  /**
   * The mirror spell: take the ground from there and put it here.
   *
   * The same verb as the puzzle it asks. A child who has just made one half
   * of a picture match the other makes one half of the *world* match
   * another, which is the design's rule that a spell's effect mirrors its
   * mathematics — kept for the fifth spell as it was for the first four.
   *
   * Two taps, and this is the only spell that wants two: *from* and *to*.
   * Everything else in the game acts on one square, so there is no existing
   * shape to borrow; what there is instead is the arming, which already
   * means "lit and waiting for a tap", and it simply waits twice.
   */
  private castMirrorSpell(): void {
    if (this.modalOpen) return;
    if (!this.knowsMirror) {
      this.spellTray?.setOpen(false);
      this.showRefusalOnPlayer(UiAsset.RuneMirror);
      return;
    }
    // Both, and the second one matters: a child who chose *copy* off the
    // times menu, marked out a block and then thought better of it and
    // reached for the mirror rune itself would otherwise still be carrying
    // the block — and would be asked a multiplication about a rectangle she
    // had walked away from, for a copy of one square.
    this.mirrorFrom = null;
    this.mirrorPatch = null;
    this.armSpell(Spell.Mirror, UiAsset.RuneMirror);
  }

  /**
   * One tap of the mirror spell: the first says from, the second says to.
   *
   * The rune stays lit between them, which is what says the spell is still
   * asking. A child who taps once and wanders off has changed nothing.
   */
  private mirrorTapAt(at: GridPoint): void {
    if (!this.mirrorFrom) {
      // The ground she is copying. Refused here rather than at the far end,
      // so a child pointing at the sea is told so before she has chosen
      // anywhere to put it.
      if (!this.worldGrid.inBounds(at.col, at.row)) return;
      const check = planCopy(this.worldGrid, [at], { col: at.col + 1, row: at.row });
      if (!check.ok && check.why === CopyRefusal.NotGround) {
        this.markRefusal(at.col, at.row);
        return;
      }
      this.mirrorFrom = [at];
      // Lit again, because the spell has not been spent — it has been half
      // answered, and the ring round her has to stay up for the second half.
      this.armSpell(Spell.Mirror, UiAsset.RuneMirror);
      this.markSource(at);
      return;
    }
    this.openMirrorFor(this.mirrorFrom, at);
  }

  /**
   * The puzzle, and the copy that follows it if she gets it right.
   *
   * Planned before the parchment opens rather than after it closes: a child
   * who has just coloured in a whole grid and is then told the ground would
   * not go there has been made to work for nothing.
   */
  private openMirrorFor(source: readonly GridPoint[], anchor: GridPoint): void {
    const plan = planCopy(this.worldGrid, source, anchor);
    if (!plan.ok) {
      this.markRefusal(plan.at.col, plan.at.row);
      // The source stays chosen, so a near miss costs one more tap rather
      // than the whole spell.
      return;
    }
    const patch = this.mirrorPatch;
    this.mirrorFrom = null;
    this.mirrorPatch = null;
    this.mirrorPaint = plan.paint;
    this.disarm();
    this.joystick?.release();
    if (!patch) {
      // One square: the mirror's own puzzle and nothing else.
      this.openMirrorPuzzle((worked) => {
        if (worked) this.paintGround(plan.paint);
        this.mirrorPaint = null;
      });
      return;
    }
    // A block: the spell once, and then how many times — which is the order
    // every other action on the times menu is asked in, and the whole of
    // what that spell is for.
    this.castOnce(PatchAction.Copy, (worked) => {
      if (!worked) {
        this.mirrorPaint = null;
        return;
      }
      this.askTheMultiplication(patch, PatchAction.Copy);
    });
  }

  /** The mirror's grid, and whether she finished it. */
  private openMirrorPuzzle(done: (worked: boolean) => void): void {
    const rung = symmetryRungAt(this.dev.symmetryRung ?? this.profile.symmetryRung);
    this.symmetryPopup?.open(this.spellRng, rung, (result) => {
      this.noteMirrorCast(result);
      done(result.solved);
    });
  }

  /** A ring round the square she is copying, while the spell waits. */
  private markSource(at: GridPoint): void {
    const feet = this.toFeet(at.col, at.row);
    const ring = this.world(
      this.add
        .rectangle(feet.x, feet.y - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE)
        .setStrokeStyle(3, PATCH_EDGE, 1)
        .setFillStyle(PATCH_EDGE, 0.15)
        .setDepth(feet.y),
    );
    this.tweens.add({
      targets: ring,
      alpha: 0,
      duration: ARMED_PULSE_MS * 4,
      onComplete: () => ring.destroy(),
    });
  }

  /** What the mirror spell has moved, for the save. */
  private paintedTiles(): PaintedTiles {
    return [...this.painted].flatMap((entry) => {
      const [col, row] = entry[0].split(",").map(Number);
      if (col === undefined || row === undefined) return [];
      return [[col, row, entry[1]] as const];
    });
  }

  /**
   * Put the ground down, and make the world show it.
   *
   * Two halves, and the second is the one that is not obvious. Terrain is
   * baked into chunk-sized textures, and the atlas ships a finished tile for
   * every way four *corners* can meet — so changing one square changes the
   * picture of the squares around it too. Dropping the textures that cover
   * them is what redraws it: they are rebuilt from the grid on the next
   * frame, which is the same path a chunk walked into from off screen takes.
   */
  private paintGround(paint: readonly { at: GridPoint; terrain: TerrainType }[]): void {
    if (paint.length === 0) return;
    for (const { at, terrain } of paint) {
      this.worldGrid.setTerrain(at.col, at.row, terrain);
      this.painted.set(tileKey(at.col, at.row), terrain);
    }
    // One square wider on every side, because a corner is shared with the
    // neighbours: a tile whose own terrain did not change is still drawn
    // differently once the ground beside it has.
    const cols = paint.map((one) => one.at.col);
    const rows = paint.map((one) => one.at.row);
    this.redrawGround({
      minCol: Math.min(...cols) - 1,
      minRow: Math.min(...rows) - 1,
      maxCol: Math.max(...cols) + 1,
      maxRow: Math.max(...rows) + 1,
    });
    this.autosave();
  }

  /** Throw away the baked ground over a range, so it is drawn again. */
  private redrawGround(range: {
    minCol: number;
    minRow: number;
    maxCol: number;
    maxRow: number;
  }): void {
    for (const chunk of chunksCoveringTileRange(
      range,
      this.worldGrid.width,
      this.worldGrid.height,
      0,
    )) {
      const key = chunkKey(chunk);
      const entry = this.activeChunks.get(key);
      if (!entry) continue;
      entry.texture.destroy();
      this.activeChunks.delete(key);
      this.despawnSceneryIn(key);
    }
  }

  /**
   * Let the mirror ladder see how a cast went.
   *
   * The one ladder with no band in it. See `nextSymmetryRung`: folding is a
   * way of looking rather than a fluency, so an older child starts on the
   * square with everybody else and climbs from there.
   */
  private noteMirrorCast(result: CastResult): void {
    this.recentSymmetryCasts = recordCast(this.recentSymmetryCasts, result);
    const moved = nextSymmetryRung(this.profile.symmetryRung, this.recentSymmetryCasts);
    if (moved === this.profile.symmetryRung) return;
    this.recentSymmetryCasts = [];
    if (this.dev.symmetryRung !== null) return;
    this.saveProfileChange({ symmetryRung: moved });
  }

  /** Whether this child has climbed to the dome and been taught. */
  private get knowsMirror(): boolean {
    return knowsSpell([...this.profile.learned, ...this.dev.learned], Spell.Mirror);
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

  /**
   * Let the bricklaying ladder see how a wall went.
   *
   * A fifth window and a fifth rung, on the same rules as the other four.
   * Filling a gap in a wall is not the skill that adds 347 and 265 — half
   * the gaps run the sum backwards — and a child fluent at one can be
   * nowhere near the other.
   */
  private noteBrickCast(result: CastResult): void {
    this.recentBrickCasts = recordCast(this.recentBrickCasts, result);
    const band = bandAt(this.profile.band);
    const moved = nextRung(band, this.profile.brickRung, this.recentBrickCasts, HARDEST_BRICK_RUNG);
    if (moved === this.profile.brickRung) return;
    this.recentBrickCasts = [];
    // Not while `?brickRung=` is holding the spell at one rung: the
    // adaptation is computed against the child's own saved rung, so a dev
    // session that answers four cleanly would move a child who never played.
    if (this.dev.brickRung !== null) return;
    this.saveProfileChange({ brickRung: moved });
  }

  /**
   * Put a wall up, and do the thing on the other side of it if it is built.
   *
   * The one way into the bricklaying spell. `onBuilt` is what the wall was
   * for — laying a floor tile — and it runs only when every gap is filled;
   * a parchment closed part way through has cost nothing and built nothing.
   */
  private openBrickWall(onBuilt: () => void): void {
    // The same guard every other cast opens with. A wall is asked for by
    // tapping a square, and on a phone a square can be under a parchment
    // that is already up — a second one over the top of it would be two
    // questions at once and a keypad that types into whichever was newer.
    if (this.modalOpen) return;
    const rung = brickRungAt(this.dev.brickRung ?? this.profile.brickRung);
    this.joystick?.release();
    this.brickPopup?.open(makeBrickProblem(this.spellRng, rung), rung, (result) => {
      if (result.solved) onBuilt();
      this.noteBrickCast(result);
    });
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

    // Indoors, the same rune takes the floor back up. The mirror of what
    // plus does in here, and a child who has built a room the wrong shape
    // has no other way to unmake it.
    if (this.unbuildCastAt(at)) return;

    const target = this.session.checkClearing(at);
    if (!target.ok || !target.tile) {
      this.report(target);
      return;
    }
    const { col, row } = target.tile;
    this.joystick?.release();
    const rung = rungAt(this.dev.rung ?? this.profile.rung);
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
    const cleared = this.session.clearAt(col, row);
    if (!cleared) return;
    if (cleared.kind === "crop") {
      // Pulled up, not picked: nothing goes in the basket. The sprite has to
      // go *and* leave the registry, or the growth spell would re-animate a
      // destroyed object the next time this tile was planted and cast on.
      const key = tileKey(col, row);
      this.cropSprites.get(key)?.destroy();
      this.cropSprites.delete(key);
      this.playEffect(EffectType.Minus, col, row);
      this.playGesture(PLANT); // the same bend; she is reaching for the ground
      return;
    }
    const object = cleared.object;
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
    // Not while `?rung=` is holding the sums at one setting, for the reason
    // every other ladder's seam is exempt: the adaptation is computed
    // against the child's own saved rung rather than the one being looked
    // at, so a dev session that answered four cleanly would move a real
    // child up a rung nobody watched them earn.
    if (this.dev.rung !== null) return;
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
  /**
   * What a thing costs, said over her head in pictures.
   *
   * A cross on its own is the game saying no with no way to find out why,
   * which for a child who cannot read the word "stone" is the same as the
   * game being broken. So the refusal carries the price: the same thought
   * cloud the animals use, with one icon per thing needed, and the cross
   * beside it rather than over it — a cross drawn on top of the picture
   * hides the half that says *which* thing they have none of.
   */
  private showCostOnPlayer(icons: readonly string[]): void {
    const x = this.player.x;
    const y = this.player.y - TILE_SIZE - BUBBLE_H / 2;
    const span = icons.length * BUBBLE_SLOT + (icons.length - 1) * BUBBLE_SLOT_GAP;
    const left = BUBBLE_INNER_X + (BUBBLE_INNER_W - span) / 2;
    const middle = -BUBBLE_H + BUBBLE_INNER_Y + BUBBLE_INNER_H / 2;
    const cloud = this.add.image(0, 0, uiTextureKey(UiAsset.ThoughtBubble)).setOrigin(0, 1);
    const drawn = icons.map((icon, at) =>
      this.add
        .image(
          left + at * (BUBBLE_SLOT + BUBBLE_SLOT_GAP) + BUBBLE_SLOT / 2,
          middle,
          uiTextureKey(icon),
        )
        .setDisplaySize(BUBBLE_SLOT, BUBBLE_SLOT),
    );
    // And the cross, beside the cloud rather than over it. Over the top it
    // would hide the half that says *which* things are wanted, which is the
    // only part a child who cannot read the word "stone" can use.
    const half = RESULT_ICON * 0.4;
    const mark = this.add.graphics().setPosition(-half * 1.6, -BUBBLE_H / 2);
    mark.lineStyle(3, REFUSAL_COLOR, 1);
    mark.lineBetween(-half, -half, half, half);
    mark.lineBetween(half, -half, -half, half);

    const shown = this.world(
      this.add.container(x, y, [mark, cloud, ...drawn]).setDepth(this.player.depth + 1),
    );
    this.tweens.add({
      targets: shown,
      y: y - RESULT_RISE / 2,
      alpha: 0,
      duration: REFUSAL_MS * 2,
      ease: "Quad.easeIn",
      onComplete: () => shown.destroy(),
    });
  }

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
  /**
   * The thing that is lit, over her head, breathing.
   *
   * Takes a *texture key* rather than a UI asset's name, because what is
   * lit is no longer always a rune out of the interface atlas: a chair is a
   * repainted furniture sheet and a flower is one frame of a fixture sheet.
   * It used to wrap its argument in `uiTextureKey`, which is right for four
   * callers and silently wrong for the two that hand it a sheet.
   */
  private raiseArmedRune(texture: string, frame?: number): void {
    this.armedRune?.destroy();
    const rune = this.world(
      this.add.image(0, 0, texture, frame).setDisplaySize(RESULT_ICON, RESULT_ICON),
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
  /**
   * An icon that rises over her head and fades.
   *
   * Says *why*, and nothing about yes or no. `showEarned` is this with a
   * meaning attached — a spell handed over — and the curfew needed the
   * picture without the meaning: a moon over a shut door is the reason, and
   * the cross on the door itself is the refusal. Calling `showEarned` for it
   * worked and read, in the code, as the village awarding a child the night.
   */
  private floatMark(icon: string): void {
    const mark = this.world(
      this.add
        .image(this.player.x, this.player.y - TILE_SIZE, uiTextureKey(icon))
        .setDisplaySize(RESULT_ICON, RESULT_ICON)
        .setDepth(this.player.depth + 1),
    );
    this.tweens.add({
      targets: mark,
      y: mark.y - RESULT_RISE,
      alpha: 0,
      duration: EARNED_MS,
      ease: "Quad.easeOut",
      onComplete: () => mark.destroy(),
    });
  }

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
   * building in the world that is pointed at the sky can be walked after
   * dark — which is when there is anything up there to point at.
   *
   * She used to teach the hourglass, and the errand was argued for on those
   * grounds: light the path so the place that cares about the hour can be
   * reached. That spell has gone to the clockmaker in the city, where the
   * thing that tells everybody the time actually stands. What she teaches
   * now is the fold, which suits her better — an observatory is where you
   * are shown that a shape has an order to it, and hers is the only lesson
   * in the game that is about a figure rather than a quantity.
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
      const learned = learnSpell(this.profile.learned, Spell.Mirror);
      if (learned !== this.profile.learned) {
        this.saveProfileChange({ learned });
        this.spellTray?.refresh();
        this.showEarned(UiAsset.RuneMirror);
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
    // The errand, drawn and said: five posts with the lit ones lit and the
    // rune underneath, dim until it is hers — and her own two lines beside
    // them, because the row can be counted by a child who cannot read and
    // the sentence tells a child who can what the row is a row of.
    //
    // The number is in both, on purpose. The row is the number for anybody
    // who cannot read it, and a reader who has just been told "three still
    // to light" should not then have to count the dim ones to check.
    const left = observatory.posts.length - lit;
    this.taskPanel?.show(
      {
        title: this.words.lampsTaskTitle,
        line: this.words.lampsAsk(left),
        bargain: left > 0 ? this.words.lampsBargain : this.words.lampsEarned,
        token: itemIcon(FixtureType.Lamp),
        needed: observatory.posts.length,
        done: lit,
        reward: UiAsset.RuneMirror,
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
      // Whoever is behind *this* counter. `attendantId` is the person the
      // room was built with, which is the only thing that tells the city's
      // five shops apart — they share a sheet, a stock and a room.
      //
      // Neither fallback is reachable, and both are written down rather than
      // left to a crash: the tap that opens this is registered while the
      // attendant is spawned, so there is always one, and the names are
      // reckoned from the very list the attendant was found in. If one ever
      // did fire the shop would say Mira, which is a wrong name rather than
      // a child staring at a dead panel.
      this.npcNames.get(this.attendantId ?? SHOPKEEPER_ID) ?? NAMED_PEOPLE.shopkeeper,
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
    for (const [index, at] of (this.decorMenu?.buttonPositions() ?? []).entries()) {
      positions[`colour.${index}`] = at;
    }
    // Its own prefix, not `colour`: the two choosers are never open at once,
    // but a script that tapped `colour.3` and got whichever one happened to
    // be up would be a script that passed for the wrong reason.
    for (const [index, at] of (this.flowerMenu?.buttonPositions() ?? []).entries()) {
      positions[`bloom.${index}`] = at;
    }
    for (const [index, at] of (this.patchMenu?.buttonPositions() ?? []).entries()) {
      positions[`patch.${index}`] = at;
    }
    if (this.optionsPanel?.isOpen) Object.assign(positions, this.optionsPanel.buttonPositions());
    Object.assign(positions, this.shopPanel?.buttonPositions() ?? {});
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
    if (saved) restoreWorld(this.grid, saved.world);
    // And what the mirror spell moved, *kept* as well as put back.
    //
    // Restoring it onto the grid is not enough, and the way that fails is
    // quiet: the save is written from this map whole, so a world that came
    // back with the ground moved but with nothing remembering that it had
    // been would write itself down again four seconds later with the moving
    // forgotten. The copy is there all afternoon and gone in the morning,
    // which is the worst shape a save bug has.
    this.painted.clear();
    for (const [col, row, terrain] of readPainted(saved?.world?.painted)) {
      this.painted.set(tileKey(col, row), terrain);
    }
    // What anybody has added to their house. Read after the world rather
    // than with it: a plan is not a thing standing on a tile, it is the
    // shape of a room behind a door.
    this.plans.clear();
    for (const [house, floor] of Object.entries(readPlans(saved?.world))) {
      this.plans.set(house, planFromKeys(floor));
    }
    this.decor.clear();
    // The one moment a room is repaired, and the reason it is only this one:
    // a save older than `HEARTH_IS_FURNITURE` has no stove written in it
    // because back then there was nothing to write, and a save newer than it
    // has none written when the child is *carrying* it. Done on every read
    // instead, the two were the same thing — and the oven grew back in its
    // corner the instant it was picked up.
    const beforeTheStove = (saved?.snapshotVersion ?? 0) < HEARTH_IS_FURNITURE;
    for (const [house, pieces] of Object.entries(readDecor(saved?.world))) {
      const stored = decorFromSave(pieces);
      this.decor.set(house, beforeTheStove ? hearthRestored(stored, this.growable) : stored);
    }
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
    const snapshot = snapshotGame(
      this.worldGrid,
      this.baseline,
      this.seed,
      now,
      this.savedPlans(),
      this.savedDecor(),
      this.paintedTiles(),
    );
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
   *
   * **All five ladders move, not just the sums'.** The band is a statement
   * about the child rather than about one spell, and it is a fence now — a
   * band changed while the clock and the great tree stayed where they were
   * would leave two spells handing out problems from outside the range an
   * adult just chose. They would be dragged back on their next cast, which
   * is a cast too late: the point of the fence is that a child is never
   * *shown* a problem nobody chose for them.
   *
   * Each ladder gets the floor of the new band scaled onto its own length,
   * which for the two short ones is not `band.from` — see `bandOn`.
   *
   * Every window is emptied too. A run of clean casts earned at one
   * difficulty says nothing about another, and leaving them would move a
   * child up a rung on their first cast in the new band.
   */
  private applyBand(band: number): void {
    if (band === this.profile.band) return;
    this.recentCasts = [];
    this.recentPortalCasts = [];
    this.recentArrayCasts = [];
    this.recentClockCasts = [];
    this.recentBrickCasts = [];
    // Not the mirror window. Every other ladder is scaled to the band, so a
    // run earned in one says nothing in the next; the folding ladder is the
    // same six shapes for everybody, and a child who has just found four
    // folds in a row has found them whatever band they are put in.
    const chosen = bandAt(band);
    this.saveProfileChange({
      band,
      rung: chosen.from,
      portalRung: bandOn(chosen, HARDEST_PORTAL_RUNG).from,
      arrayRung: bandOn(chosen, HARDEST_ARRAY_RUNG).from,
      clockRung: bandOn(chosen, HARDEST_CLOCK_RUNG).from,
      brickRung: bandOn(chosen, HARDEST_BRICK_RUNG).from,
    });
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
    this.lessonPanel?.setRung(rungAt(this.dev.rung ?? this.profile.rung));
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
    this.brickPopup?.setPhrases(this.words);
    this.symmetryPopup?.setPhrases(this.words);
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

  private closeTrays(): void {
    for (const tray of Object.values(this.trays())) tray?.setOpen(false);
    this.flowerMenu?.close();
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
    const plant = PLANT_TYPES[this.selectedPlantIndex] ?? PLANT_TYPES[0];
    if (plant) this.plantSeed(plant);
  }

  /** One seed, into whichever square `targetTile` says. */
  private plantSeed(plant: PlantType): void {
    if (this.modalOpen) return;

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
        nameplate: sidecar.sign_rect_px
          ? {
              x: this.originX + origin.x + sidecar.sign_rect_px[0] + sidecar.sign_rect_px[2] / 2,
              y: this.originY + origin.y + sidecar.sign_rect_px[1] + sidecar.sign_rect_px[3] / 2,
              width: sidecar.sign_rect_px[2],
              height: sidecar.sign_rect_px[3],
            }
          : null,
      });
    }
  }

  /**
   * Put whoever lives here on the plate beside their door.
   *
   * Every cottage in the village carries one — the four round the square
   * that belong to the children, and the four out on the green that belong
   * to the villagers. They are the same picture, so without this a child has
   * to count doors round a green to find their own house.
   *
   * **A face, or a question mark.** A child's house with nobody in it yet
   * gets the same mark the animals use when they want something: it is the
   * game's own way of saying *nobody has answered this*, so an empty plate
   * reads as a house waiting for somebody rather than as a plate that failed
   * to load. A villager's cottage is never empty, so it never shows one.
   *
   * Run after the villagers are spawned, because which of them wears which
   * face is decided there, and a second copy of that reckoning here would be
   * a second thing to keep in step.
   */
  private hangNameplates(): void {
    for (const building of this.buildings) {
      const plate = building.nameplate;
      if (!plate) continue;
      const face = this.faceFor(building.id);
      if (!face) {
        // Only a house somebody could move into says so — `whoLivesIn`
        // answers "vacant" for those and null for a building nobody could
        // ever live in, which is the difference between a question mark and
        // no plate at all.
        if (whoLivesIn(building.id, this.npcs, this.household)?.kind !== "vacant") continue;
        this.world(
          this.add
            .image(plate.x, plate.y, uiTextureKey(UiAsset.MarkQuestion))
            .setDisplaySize(plate.width - 2, plate.height - 2)
            .setDepth(building.image.depth + 0.1),
        );
        continue;
      }
      // The head and shoulders of the idle frame, which is where all three of
      // the colours a child picked live: their hair, their face and their
      // shirt. Cropped rather than scaled — this is pixel art, and a face
      // squeezed to fit is a face with some rows twice as tall as others.
      const portrait = this.world(
        this.add
          .image(plate.x, plate.y, characterSheetKey(face), 0)
          .setDepth(building.image.depth + 0.1)
          .setCrop(FACE_CROP.x, FACE_CROP.y, FACE_CROP.width, FACE_CROP.height),
      );
      // A cropped image still reports its whole frame's size, so the offset
      // that centres the crop has to be applied by hand.
      portrait.setPosition(
        plate.x - (FACE_CROP.x + FACE_CROP.width / 2 - portrait.width / 2),
        plate.y - (FACE_CROP.y + FACE_CROP.height / 2 - portrait.height / 2),
      );
    }
  }

  /**
   * Whose face belongs on this building's plate, or null.
   *
   * Three answers. A child's house shows its owner, recoloured to whatever
   * they picked — every avatar *body* is loaded whatever this child chose, so
   * a sibling who picked a different one still gets their own face rather
   * than quietly borrowing somebody else's. A villager's cottage shows the
   * villager standing outside it. Anything else has no plate to fill.
   */
  private faceFor(buildingId: string): string | null {
    const lives = whoLivesIn(buildingId, this.npcs, this.household);
    if (!lives || lives.kind === "vacant") return null;
    if (lives.kind === "villager") return lives.character;
    const catalogue = avatarCatalogue(this);
    const style = catalogue ? usableAvatar(catalogue, lives.owner.avatar) : lives.owner.avatar;
    const sheet = (this.cache.json.get(characterSidecarKey(style.body)) as CharacterSidecar)?.sheet;
    if (!sheet) return null;
    const character = avatarTexture(this, catalogue, style, sheet);
    return this.textures.exists(characterSheetKey(character)) ? character : null;
  }

  // Anything placed that is not a building: today the village well. Throws
  // rather than drawing a placeholder, because a silent grey disc is how a
  // missing sprite survives to a release — and assets.test.ts checks every
  // type the village places resolves here, so this is unreachable in
  // practice and provably so.
  private spawnNonBuilding(object: PlacedObject): void {
    // Flowers first, and both kinds of them: a wild one is picked and a
    // planted one is dug up, which is two different taps on two objects
    // drawn from the same sheet.
    const wild = wildFlowerFor(object.type);
    if (wild) {
      this.spawnFlower(object, wild, wildLook(wild), () => this.pickWildFlower(object, wild));
      return;
    }
    const planted = flowerParts(object.type);
    if (planted) {
      this.spawnFlower(object, planted.flower, planted.look, () =>
        this.digUpFlower(object.col, object.row),
      );
      return;
    }
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
    //
    // Twelve of them now, and the count is read off the sidecar rather than
    // written here — the art decides how many there are of anything. It was
    // four, with a note claiming that four shapes and a mirror were enough
    // that a wood of thousands stopped reading as a repeat. They were not:
    // the world puts down forty thousand conifers and a screenshot of that
    // wood was one tree tiled across the screen. What fixed it was mostly
    // not the count — see the design doc, "A wood is not one tree".
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
      // The map opens the map. The chart is a picture, so tapping it holds
      // the picture up — with the two things the drawing cannot say about
      // itself written round it: whose sky it is, and when.
      if (hanging === UiAsset.MapWall) this.openMap();
      else
        this.showPicture(UiAsset.StarChart, this.words.starChartTitle, this.words.starChartCaption);
    });
    this.wallMap = sprite;
  }

  /** A picture on a wall, held up close. */
  private showPicture(asset: string, title: string, caption: string): void {
    if (this.modalOpen) return;
    this.joystick?.release();
    this.closeTrays();
    this.picturePanel?.show(asset, title, caption, () => {});
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

  /**
   * Step into a house that can be added to.
   *
   * The same shape as `enterInterior` and deliberately beside it, but the
   * room is assembled from parts rather than shown as a picture: floor,
   * walls, windows and the doorway drawn into one texture, the fire on top
   * of it because a fire is the one thing in a room that moves.
   *
   * `origin` is what makes the rest of the scene able to ignore all of this.
   * A plan may name negative cells — building on the west side takes it there
   * on the first square — and a grid may not, so the grid is laid over the
   * plan's bounding box and everything crossing between them goes through
   * one offset.
   */
  private enterGrowableRoom(building: BuildingRuntime): void {
    const parts = this.growable;
    if (!parts) throw new Error("no growable room to enter");
    const plan = this.planFor(building.id);
    const door = growableDoor(parts);
    const { grid, origin, extent } = buildPlanGrid(plan, door, this.blockers(building.id));
    const entered = this.setInterior({
      room: GROWABLE_ROOM,
      grid,
      image: undefined as unknown as Phaser.GameObjects.Sprite,
      plan,
      origin,
      bounds: {
        col: extent.minCol - origin.col,
        row: extent.minRow - origin.row,
        cols: extent.cols,
        rows: extent.rows,
      },
      house: building.id,
      fires: [],
      decor: [],
      exit: { col: door.col - origin.col, row: door.row - origin.row },
      returnTo: { col: building.doorCol, row: building.doorRow + 1 },
      originY: parts.wall_rise_px,
    });

    this.grid = entered.grid;
    this.originX = 0;
    this.originY = entered.originY;
    this.paintPlan();
    // No wall hanging: only the post office and the dome have one, and
    // `wallHangingCell` reads a *shipped* room's size and furniture, which
    // is not this room's. Passing it the cottage's would be a coordinate
    // that means nothing the moment somebody builds north.
    this.worldLayer.setVisible(false);
    this.interiorLayer.setVisible(true);
    this.movePlayerToLayer();
    this.placePlayer(entered.exit.col, entered.exit.row, Facing.Up);
    this.frameGrownRoom();
  }

  /**
   * Where this child starts: in their own garden, outside their own door.
   *
   * There are four houses round the square and four children on a device,
   * and `Profile.house` says which is whose — but nothing read it until the
   * nameplates went up and made it obvious that everybody was being put down
   * at house zero's gate, including the three children who do not live
   * there.
   *
   * Falls back to the generator's own answer, which is house zero's garden.
   * That is right for the one case it covers: a session with no child in it,
   * which is a script jumping straight to this scene.
   */
  private startFor(world: GeneratedWorld): GridPoint {
    const id = houseIdFor(this.profile.house);
    const home = id ? world.village.homes[id] : undefined;
    return home?.inside ?? world.playerStart;
  }

  /** The house's plan, or the room as it shipped if nobody has touched it. */
  private planFor(house: string): RoomPlan {
    const saved = this.plans.get(house);
    if (saved) return saved;
    const parts = this.growable;
    return parts ? startingPlan(parts) : planOf([]);
  }

  /**
   * Draw the room the plan describes.
   *
   * One texture for everything that holds still, in row order — which is the
   * whole of what makes an arbitrary outline drawable. A wall tile is a tile
   * wide and a tile *and a rise* tall, so a wall painted after the floor
   * behind it correctly hides that floor's far edge, exactly as a wall in
   * front of you hides the floor behind it. See `growableRoom.ts`.
   *
   * The fire is the exception, because it is the one thing in a room that
   * moves, and a texture that had to be repainted eight times a second would
   * be a texture repainted eight times a second.
   */
  private paintPlan(): void {
    const inside = this.interior;
    const parts = this.growable;
    if (!inside?.plan || !parts) return;
    const plan = inside.plan;
    const tile = TILE_SIZE;
    const rise = parts.wall_rise_px;
    const bounds = planBounds(plan);
    const width = bounds.cols * tile;
    const height = bounds.rows * tile + rise;
    // The room is drawn where the *grid* says it is. Those used to be the
    // same number; they stopped being one the moment the grid grew a margin
    // of open ground round the walls, and a picture a margin adrift from the
    // squares under it is a room whose floor is not where you walk.
    const offsetX = (bounds.minCol - inside.origin.col) * tile;
    const offsetY = (bounds.minRow - inside.origin.row) * tile;

    inside.canvas?.destroy();
    for (const fire of inside.fires) fire.destroy();
    inside.fires = [];
    for (const standing of inside.decor) standing.destroy();
    inside.decor = [];

    const canvas = this.world(
      this.add.renderTexture(offsetX, offsetY, width, height).setOrigin(0, 0).setDepth(CHUNK_DEPTH),
    );
    inside.canvas = canvas;
    inside.image = canvas as unknown as Phaser.GameObjects.Sprite;

    const walls = growableSheetKey(GROWABLE_ROOM, "walls");
    const floors = growableSheetKey(GROWABLE_ROOM, "floor");
    const masks = wallMasks(plan);
    const windows = new Set(windowCells(plan).map(({ col, row }) => cellKey(col, row)));
    const door = growableDoor(parts);
    // Where a cell's own tile goes: the grid origin plus the rise, since
    // every wall tile is drawn from a rise above its own cell.
    const px = (col: number, row: number) => ({
      x: (col - bounds.minCol) * tile,
      y: rise + (row - bounds.minRow) * tile,
    });

    canvas.beginDraw();
    for (let row = bounds.minRow; row <= bounds.maxRow; row++) {
      for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
        if (!isFloor(plan, col, row)) continue;
        const at = px(col, row);
        // `row %` the atlas: a plank's seams are seeded by the row so that a
        // board runs the width of a room unbroken, and a room that can grow
        // has no greatest row.
        const layout = ((row % parts.floor_rows) + parts.floor_rows) % parts.floor_rows;
        const variation =
          (((row + col) % parts.floor_variations) + parts.floor_variations) %
          parts.floor_variations;
        canvas.batchDrawFrame(floors, layout * parts.floor_variations + variation, at.x, at.y);
      }
      for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
        const mask = masks.get(cellKey(col, row));
        if (mask === undefined) continue;
        const at = px(col, row);
        canvas.batchDrawFrame(walls, mask, at.x, at.y - rise);
        if (windows.has(cellKey(col, row))) {
          canvas.batchDrawFrame(growableSheetKey(GROWABLE_ROOM, "window"), 0, at.x, at.y - rise);
        }
        if (col === door.col && row === door.row) {
          canvas.batchDrawFrame(growableSheetKey(GROWABLE_ROOM, "door"), 0, at.x, at.y - rise);
        }
      }
    }
    canvas.endDraw();

    // The furniture is *sprites* now, not paint. It used to be baked into
    // the texture with the floor, which was right while a bed was a fact
    // about the picture; a thing a child can pick up has to be a thing they
    // can tap, and a texture cannot be tapped.
    this.spawnDecor(px, offsetX, offsetY);
  }

  /**
   * Put the furniture in the room, as things rather than as paint.
   *
   * Each piece is its own sprite so it can be tapped and carried off, and
   * each is depth-sorted on the row its *feet* are on rather than the row it
   * is anchored at — a bed is two rows deep, and sorting it by its anchor
   * puts the floor of the row below in front of its own foot.
   */
  /**
   * One animated piece of furniture, playing.
   *
   * Its own method because building the animation is a five-line ceremony —
   * the frame count comes out of the sidecar — and because it used to be
   * done in a loop over the *sidecar's* placements, which is the one place
   * it cannot be done now that the thing can be carried.
   */
  private playPiece(
    piece: DecorType,
    x: number,
    y: number,
    depth: number,
  ): Phaser.GameObjects.Sprite {
    const art = pieceArt(piece);
    const key = growablePieceKey(GROWABLE_ROOM, art);
    const animKey = growablePieceAnimKey(GROWABLE_ROOM, art);
    if (!this.anims.exists(animKey)) {
      this.anims.create({
        key: animKey,
        frames: this.anims.generateFrameNumbers(key, {
          start: 0,
          end: (this.growable?.piece_sheets[art]?.frame_count ?? 1) - 1,
        }),
        frameRate: BUILDING_ANIM_FPS,
        repeat: -1,
      });
    }
    const sprite = this.add.sprite(x, y, key).setOrigin(0, 0).setDepth(depth);
    sprite.play(animKey);
    this.interior?.fires.push(sprite);
    return sprite;
  }

  private spawnDecor(
    px: (col: number, row: number) => { x: number; y: number },
    offsetX: number,
    offsetY: number,
  ): void {
    const inside = this.interior;
    const parts = this.growable;
    if (!inside?.plan || !parts || !inside.house) return;
    for (const standing of inside.decor) standing.destroy();
    inside.decor = [];

    const sizes = this.pieceSizes();
    this.snuffHearth();
    for (const placed of this.decorIn(inside.house)) {
      const size = sizes[placed.piece] ?? { cols: 1, rows: 1 };
      const at = px(placed.col, placed.row);
      const art = parts.furniture.find((piece) => piece.name === pieceArt(placed.piece));
      const x = offsetX + at.x;
      const y = offsetY + at.y - parts.piece_rise_px;
      const depth = depthFor((placed.row - inside.origin.row + size.rows) * TILE_SIZE);
      // A piece that moves is drawn as a sprite and played; everything else
      // is one picture. Only the stove moves — a fire that stood still would
      // not read as a fire — and it is drawn *here*, from the arrangement,
      // because it can be carried and a second pass over the sidecar's own
      // placements would draw it a second time in the corner it started in.
      const sprite = this.world(
        art?.animated
          ? this.playPiece(placed.piece, x, y, depth)
          : this.add
              .image(x, y, this.decorTexture(placed.piece, placed.look))
              .setOrigin(0, 0)
              .setDepth(depth),
      );
      if (art?.light === LightKind.Fire) {
        this.lightHearthAt({
          col: placed.col - inside.origin.col,
          row: placed.row - inside.origin.row,
        });
      }
      // A tile-sized hit area at its foot, the same as a placed fence has:
      // the art of a bed is eighty pixels tall and a tap anywhere on the
      // bedding should reach it, but a tap on the wall behind it should not.
      sprite.setInteractive(
        new Phaser.Geom.Rectangle(
          0,
          sprite.height - size.rows * TILE_SIZE,
          size.cols * TILE_SIZE,
          size.rows * TILE_SIZE,
        ),
        Phaser.Geom.Rectangle.Contains,
      );
      sprite.on("pointerdown", () => {
        if (this.pointerIsSpokenFor) return;
        this.takeDecor(placed);
      });
      inside.decor.push(sprite);
    }
  }

  /** How many of a piece are in the basket, in every colour together. */
  private decorHeld(piece: DecorType): number {
    return DECOR_LOOKS_RANGE.reduce(
      (sum, look) => sum + this.inventory.count(decorItem(piece, look)),
      0,
    );
  }

  /**
   * The sheet for one piece in one colour, made once and kept.
   *
   * The same route the avatars and the house roofs take: a recolour plan
   * mapping the ramps the art was drawn in onto the ones somebody picked,
   * and `repaintedSheet` caching it under a derived key. Nought is the room
   * as it shipped and is handed straight back unrepainted, so a house nobody
   * has redecorated costs nothing and looks untouched.
   */
  private decorTexture(piece: DecorType, look: number): string {
    const parts = this.growable;
    const source = growablePieceKey(GROWABLE_ROOM, pieceArt(piece));
    const wanted = parts?.piece_colourways?.[look];
    const sheet = parts?.piece_sheets[pieceArt(piece)];
    if (!parts || !wanted || !sheet || look === 0) return source;
    const plan = colourPlanFor(parts.palette, wanted);
    return repaintedSheet(this, source, `${source}~${look}`, plan, sheet);
  }

  /**
   * One flower on the ground, wild or planted.
   *
   * The same sprite either way — it is the same flower — and what differs is
   * only what a tap on it does. Drawn *behind* everything else that stands
   * on a cell, because a flower is ankle-high and a fence is not: a bloom
   * painted over a fence post would look like it was growing out of it.
   */
  private spawnFlower(
    object: PlacedObject,
    flower: FlowerType,
    look: number,
    onTap: () => void,
  ): Phaser.GameObjects.Sprite {
    const sidecar = this.flowerSidecars.get(flower);
    if (!sidecar) throw new Error(`no art loaded for flower "${flower}"`);
    const sprite = this.spawnFootprintSprite(
      object,
      sidecar,
      flowerSheetKey(flower),
      flowerAnimKey(flower, look),
    );
    const frame = sprite.frame;
    sprite.setInteractive(
      new Phaser.Geom.Rectangle(0, frame.realHeight - TILE_SIZE, TILE_SIZE, TILE_SIZE),
      Phaser.Geom.Rectangle.Contains,
    );
    sprite.on("pointerdown", () => {
      if (this.pointerIsSpokenFor) return;
      onTap();
    });
    this.flowerSprites.set(tileKey(object.col, object.row), sprite);
    return sprite;
  }

  /**
   * Walk into a wild one and it is yours — the kind of it, for ever.
   *
   * The one reward in this game for having *gone somewhere*. No sum, no
   * money, no errand: three plants grow wild on a five-hundred-square world
   * and a child has to find them.
   *
   * The wild plant stays where it is. Picking it would make the world a
   * little emptier every time somebody explored it, and would mean a second
   * child on the same tablet could never find that one at all.
   */
  private pickWildFlower(object: PlacedObject, flower: FlowerType): void {
    if (this.modalOpen) return;
    if (stepsToSpeak(this.session.tile, { col: object.col, row: object.row }) > 1) {
      this.markRefusal(object.col, object.row);
      this.markTooFar(object.col, object.row);
      return;
    }
    const found = findFlower(this.profile.found, flower);
    if (found === this.profile.found) {
      // Already hers. Say what it is rather than nothing, which is what
      // every other thing in the world does when it is tapped.
      this.showEarned(flowerIcon(flower));
      return;
    }
    this.saveProfileChange({ found });
    this.seedTray?.refresh();
    this.showEarned(flowerIcon(flower));
    this.playGesture(PLANT);
  }

  /** Take a planted one back out of the ground. */
  private digUpFlower(col: number, row: number): void {
    if (this.modalOpen) return;
    if (stepsToSpeak(this.session.tile, { col, row }) > 1) {
      this.markRefusal(col, row);
      this.markTooFar(col, row);
      return;
    }
    this.worldGrid.removeObjectAt(col, row);
    const key = tileKey(col, row);
    this.flowerSprites.get(key)?.destroy();
    this.flowerSprites.delete(key);
    this.playGesture(PLANT);
    this.paintSockets();
  }

  private get foundFlowers(): readonly string[] {
    return [...this.profile.found, ...this.dev.flowers];
  }

  private hasFoundFlower(flower: FlowerType): boolean {
    return hasFound(this.foundFlowers, flower);
  }

  /**
   * Plant one, in a colour she picks.
   *
   * Two taps, like putting furniture down: what, and then which colour. The
   * order is the same one the store settled on — a child decides what they
   * are doing and then goes and does it — and it means the five colours are
   * offered as five pictures of the flower rather than as a colour chart.
   *
   * Unlike furniture there is nothing to own. Finding the wild one earns the
   * *kind*, so every colour is always on offer and a bed can be as long as
   * she likes: a child who walked to the far side of the world for a tulip
   * has earned tulips.
   */
  private plantFlower(flower: FlowerType): void {
    if (this.modalOpen) return;
    this.seedTray?.setOpen(false);
    if (!this.hasFoundFlower(flower)) {
      this.showRefusalOnPlayer(flowerIcon(flower));
      return;
    }
    const above = this.screenOfPoint(this.player.x, this.player.y - TILE_SIZE);
    this.decorMenu?.close();
    this.flowerMenu?.openAt(
      above,
      Array.from({ length: FLOWER_LOOKS }, (_, look) => ({
        action: flowerObject(flower, look),
        rune: flowerSheetKey(flower),
        frame: look * (this.flowerSidecars.get(flower)?.frames_per_look ?? 1),
      })),
      (item) => {
        this.flowerMenu?.close();
        const parts = flowerParts(item);
        if (parts) this.armFlower(parts.flower, parts.look);
      },
    );
  }

  /**
   * Into the ground in front of her, where a seed would go.
   *
   * The same square planting uses, so "where does it go" is one answer for
   * everything a child puts in the earth. Refused on anything already
   * occupied — including by another flower, because two on one cell would be
   * one drawn over the other and only the top one tappable.
   */
  private putFlowerDown(flower: FlowerType, look: number): void {
    // `targetTile`, not `facingTile`: the square she pointed at, falling
    // back to the one she faces. Every other thing that goes in the ground
    // already worked that way, and this one did not — so an armed flower
    // would have been planted in front of her wherever she tapped.
    const ahead = this.session.targetTile();
    if (!this.worldGrid.inBounds(ahead.col, ahead.row)) {
      this.showRefusalOnPlayer(flowerIcon(flower));
      return;
    }
    const free =
      this.worldGrid.isPassable(ahead.col, ahead.row) &&
      !this.worldGrid.getObjectAt(ahead.col, ahead.row) &&
      !this.worldGrid.getPlant(ahead.col, ahead.row);
    if (!free) {
      this.markRefusal(ahead.col, ahead.row);
      return;
    }
    const object: PlacedObject = {
      id: `flower-${ahead.col}-${ahead.row}`,
      type: flowerObject(flower, look),
      col: ahead.col,
      row: ahead.row,
      width: 1,
      height: 1,
      // Walked among, not walked around. A bed of flowers a child could not
      // cross would be a wall they planted themselves.
      blocksMovement: false,
      anchorCol: ahead.col,
      anchorRow: ahead.row,
    };
    this.worldGrid.placeObject(object);
    this.spawnFlower(object, flower, look, () => this.digUpFlower(ahead.col, ahead.row));
    this.playGesture(PLANT);
    this.paintSockets();
  }

  /**
   * Which colour of a thing to put down: the second of the two taps.
   *
   * The choices are the piece itself, painted. A row of five chairs is a
   * question a four-year-old can answer without reading anything, where five
   * swatches would be a colour chart — and the same picture that ends up on
   * the floor is the one they picked from.
   *
   * Only the colours actually in the basket. A chooser offering five when
   * one is owned would be four taps that do nothing.
   */
  private chooseDecorColour(piece: DecorType): void {
    const parts = this.growable;
    if (!parts) return;
    const owned = (parts.piece_colourways ?? []).flatMap((_, look) =>
      this.inventory.count(decorItem(piece, look)) > 0 ? [look] : [],
    );
    const only = owned[0];
    if (only === undefined) {
      this.showRefusalOnPlayer();
      return;
    }
    // A chooser of one is not a choice — the same rule the spell menu keeps.
    if (owned.length === 1) {
      this.armDecor(piece, only);
      return;
    }
    const above = this.screenOfPoint(this.player.x, this.player.y - TILE_SIZE);
    this.decorMenu?.openAt(
      above,
      owned.map((look) => ({
        action: decorItem(piece, look),
        rune: this.decorTexture(piece, look),
      })),
      (item) => {
        this.decorMenu?.close();
        const parts = itemParts(item);
        // The colour is chosen *before* the square, so what waits over her
        // head is the chair she will actually see on the floor rather than
        // a chair-shaped promise.
        if (parts) this.armDecor(parts.piece, parts.look);
      },
    );
  }

  /** A fixture, lit and waiting for a square. */
  private armFixture(fixture: FixtureType): void {
    if (this.inventory.count(fixture) <= 0) {
      this.showRefusalOnPlayer(itemIcon(fixture));
      return;
    }
    this.arm({ kind: "fixture", fixture }, uiTextureKey(itemIcon(fixture)));
  }

  /** A piece of furniture, in the colour she picked, waiting for a square. */
  private armDecor(piece: DecorType, look: number): void {
    this.arm({ kind: "decor", piece, look }, this.decorTexture(piece, look));
  }

  /**
   * A flower, in the colour she picked, waiting for a square.
   *
   * Lit as the *sheet's* frame for that colour rather than as the pouch
   * button, so the thing over her head is the flower she is about to plant
   * and not a picture of the kind of flower it is.
   */
  private armFlower(flower: FlowerType, look: number): void {
    const per = this.flowerSidecars.get(flower)?.frames_per_look ?? 1;
    this.arm({ kind: "flower", flower, look }, flowerSheetKey(flower), look * per);
  }

  /**
   * Pick a thing up off the floor and carry it away.
   *
   * Into the basket, exactly as a fence taken back out of the garden goes —
   * it is the same verb and it should feel like it. Nothing is checked
   * beyond it being there: a thing you put down is a thing you can pick up
   * again, and the room is the child's own.
   */
  private takeDecor(placed: Placed): void {
    if (this.modalOpen) return;
    const inside = this.interior;
    if (!inside?.house) return;
    this.decor.set(inside.house, decorWithout(this.decorIn(inside.house), placed));
    this.inventory.add(decorItem(placed.piece, placed.look), 1);
    // No mark over the square: the thing lifting off it *is* the feedback,
    // and `showResult` wants a UI asset, which a bed is not.
    this.playGesture(PLANT);
    this.refreshRoom();
  }

  /**
   * Put a thing down on the square she is facing, if it will stand there.
   *
   * On floor, clear of everything else, and clear of the hearth. Refused
   * rather than nudged: a chair that slid to the next square along would be
   * the game deciding where the furniture goes, which is the whole of what
   * this feature takes back from it.
   */
  private putDecorDown(piece: DecorType, look: number): void {
    if (this.modalOpen) return;
    const inside = this.interior;
    const parts = this.growable;
    const item = decorItem(piece, look);
    if (!inside?.plan || !inside.house || this.inventory.count(item) <= 0) {
      this.showRefusalOnPlayer();
      return;
    }
    const ahead = this.session.targetTile();
    // Where a piece of its size goes when she is facing this way — which is
    // not the tile in front of her unless it is one cell big. See
    // `anchorFor`: a rug anchored on the facing tile grows back over the
    // square she is standing on, so it could never be put down above or to
    // the left of her.
    const corner = anchorFor(
      piece,
      { col: ahead.col + inside.origin.col, row: ahead.row + inside.origin.row },
      this.session.facing,
      this.pieceSizes(),
    );
    const at: Placed = { piece, look, col: corner.col, row: corner.row };
    const room = this.decorIn(inside.house);
    // Her own square counts against a bath and not against a rug. Tapping
    // the floor she is standing on is how a child asks for a carpet to go
    // *under* her, and a walkable thing has no reason to refuse — see
    // `inTheWayOf`. Not `spokenFor`, which is the minus spell's question and
    // has to keep counting her whatever she is holding.
    const her = this.session.tile;
    const taken = parts
      ? inTheWayOf(parts, piece, room, {
          col: her.col + inside.origin.col,
          row: her.row + inside.origin.row,
        })
      : this.spokenFor();
    const standable = (col: number, row: number) =>
      isFloor(inside.plan as RoomPlan, col, row) && !taken.has(cellKey(col, row));
    if (!decorFits(at, room, this.pieceSizes(), standable)) {
      this.markRefusal(ahead.col, ahead.row);
      return;
    }
    this.inventory.remove(item, 1);
    this.decor.set(inside.house, [...room, at]);
    this.playGesture(PLANT);
    this.refreshRoom();
  }

  /** Redraw the room and write it down: what every rearrangement ends with. */
  private refreshRoom(): void {
    const inside = this.interior;
    if (!inside?.plan || !inside.house) return;
    const parts = this.growable;
    if (!parts) return;
    // The grid too: what blocks the way changed, and a chair that had been
    // moved would go on blocking the square it left.
    const door = growableDoor(parts);
    const { grid, origin } = buildPlanGrid(inside.plan, door, this.blockers(inside.house));
    inside.grid = grid;
    inside.origin = origin;
    this.grid = grid;
    this.paintPlan();
    this.refreshCarried();
    this.autosave();
  }

  /**
   * Point the camera at the room, not at the margin around it.
   *
   * The margin is ground a child can *aim* at, not ground there is anything
   * to look at — and a room framed to include it is a room bigger than the
   * screen, which turns the still, centred framing every interior has into a
   * camera that follows. `roomCameraBounds` already leaves a room smaller
   * than the viewport sitting in the middle with the rest of the screen
   * around it, and that is where the margin is: reachable by a finger,
   * without the camera pretending the house is twice its size.
   */
  private frameGrownRoom(): void {
    const inside = this.interior;
    if (!inside?.plan) return;
    const extent = planBounds(inside.plan);
    this.frameRoom(extent.cols * TILE_SIZE, this.originY + extent.rows * TILE_SIZE, {
      x: (extent.minCol - inside.origin.col) * TILE_SIZE,
      y: (extent.minRow - inside.origin.row) * TILE_SIZE,
    });
  }

  /**
   * Whether the village is up: doors unlocked, people in the street.
   *
   * Read off the world's clock rather than the wall clock, which is the
   * whole reason this is worth having at all. A child who finds the shop
   * shut can wind the glass forward to morning and walk back in — the
   * hourglass stops being a spell about arithmetic and becomes the way you
   * get into a building.
   */
  private get villageIsOpen(): boolean {
    return isOpenHours(this.hourNow());
  }

  /**
   * The hours *this* door keeps.
   *
   * Nearly everything keeps the village's, because nearly everything is a
   * shop or a school or somebody's house and those are open when people are
   * about. The dome is the exception and it is the interesting one: an
   * astronomer works when there is something to look at, so it is locked all
   * afternoon and lit at midnight — see `STARGAZING_HOURS`.
   *
   * By building id rather than by room, because the room is a picture and
   * the hours are a fact about the person in it.
   */
  private hoursFor(buildingId: string): OpeningHours {
    return buildingId === OBSERVATORY_DOME_ID ? STARGAZING_HOURS : VILLAGE_HOURS;
  }

  private isOpenNow(buildingId: string): boolean {
    return isOpenHours(this.hourNow(), this.hoursFor(buildingId));
  }

  /**
   * A shut door, said in a picture.
   *
   * A cross on the door, which is what every other refusal in this game
   * looks like, and a moon over her head, which is the part that says
   * *why*. A door that only said no would be a door a child taps again.
   */
  private refuseForTheNight(building: BuildingRuntime): void {
    this.markRefusal(building.doorCol, building.doorRow);
    // Which way round it is shut. A moon on nearly everything, and a sun on
    // the dome — the two refusals mean opposite things and a child has to be
    // able to tell "they have gone to bed" from "come back when it is dark".
    // Read off the hours the door keeps rather than off a second list, so a
    // building that changed its hours cannot keep the wrong picture.
    const opensAtNight = this.hoursFor(building.id).opensAt > this.hoursFor(building.id).shutsAt;
    this.floatMark(opensAtNight ? UiAsset.MarkDay : UiAsset.MarkNight);
  }

  private enterInterior(building: BuildingRuntime): void {
    // Nothing marked out survives a doorway. The marker lives in the world
    // layer, which is hidden while a room is on screen, and the patch it
    // referred to is a hundred tiles away.
    this.stopMarking();
    const room = interiorFor(building.sprite);
    if (room === GROWABLE_ROOM && this.growable) {
      this.enterGrowableRoom(building);
      return;
    }
    // After her own house, never before it.
    //
    // The growable room is the one a child lives in, and it is reached
    // through this very function — so a curfew checked at the top of it
    // would lock her out of her own front door at seven in the evening.
    // Everything past this line is somebody else's building.
    if (!this.isOpenNow(building.id)) {
      this.refuseForTheNight(building);
      return;
    }
    const sidecar = this.interiorSidecars.get(room);
    if (!sidecar) throw new Error(`no interior for "${room}"`);

    const door = interiorDoor(sidecar);
    const entered = this.setInterior({
      room,
      grid: buildInteriorGrid(sidecar),
      // Placed below, once `world` will file it under the interior layer.
      image: undefined as unknown as Phaser.GameObjects.Sprite,
      origin: { col: 0, row: 0 },
      bounds: {
        col: 0,
        row: 0,
        cols: sidecar.size_cells.cols,
        rows: sidecar.size_cells.rows,
      },
      fires: [],
      decor: [],
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
    if (framed) this.frameRoom(framed.width, framed.height, framed.at);
  }

  /**
   * How far out the camera should be right now.
   *
   * The world's own zoom, except while a patch is being drawn — see
   * `markingZoom`. Asked rather than remembered, so the one answer serves
   * the moment marking starts, the moment it ends, and a phone turned
   * sideways in between.
   */
  private zoomWanted(): number {
    // What the child has asked for, or what her fingers are asking for right
    // now. The live value wins while a pinch is running and is gone the
    // moment it ends, which is the whole difference between the two.
    const chosen = this.pinching?.live ?? this.restingZoom;
    if (!this.marking) return chosen;
    const camera = this.cameras.main;
    // Her choice is the ceiling, not `CAMERA_ZOOM`. The spell pulls the view
    // out far enough to draw ten squares; a child who has already pulled it
    // further out than that did not ask to be zoomed back in by arming a
    // rune.
    return markingZoom({ width: camera.width, height: camera.height }, TILE_SIZE, chosen);
  }

  /**
   * A second finger has landed: start following the two of them.
   *
   * Answered true when this press belongs to a pinch, which is what keeps it
   * from also being a tap. The joystick is let go rather than left holding
   * the first finger — a stick that stayed on would walk her across the
   * world for as long as the zoom took.
   *
   * The two ids are remembered rather than re-read every frame. A third
   * finger on a tablet held in two hands is common, and a pinch that
   * silently changed which fingers it was watching would jump.
   */
  private beginPinch(): boolean {
    if (this.pinching) return true;
    if (this.touching.size < 2) return false;
    const [first, second] = [...this.touching.entries()];
    if (!first || !second) return false;
    const steps = zoomSteps(CAMERA_ZOOM);
    if (steps.length < 2) return false;
    this.joystick?.release();
    this.pinched = true;
    this.pinching = {
      a: first[0],
      b: second[0],
      from: spread(first[1], second[1]),
      held: this.restingZoom,
      live: this.restingZoom,
    };
    return true;
  }

  /** The fingers moved: put the camera where they are holding it. */
  private dragPinch(): boolean {
    const pinch = this.pinching;
    if (!pinch) return false;
    const one = this.touching.get(pinch.a);
    const other = this.touching.get(pinch.b);
    if (!one || !other) return true;
    pinch.live = pinchedZoom(pinch.held, pinch.from, spread(one, other), zoomSteps(CAMERA_ZOOM));
    this.applyZoom();
    return true;
  }

  /**
   * One of the two lifted: let it come to rest on a step.
   *
   * On the *nearest* step rather than wherever the fingers left it, so the
   * world is never drawn at a fraction of a pixel while nobody is touching
   * it — see `pinch.ts`. Nothing happens for the other fingers on the glass:
   * the gesture is over the moment it is no longer two.
   */
  private endPinch(pointerId: number): void {
    const pinch = this.pinching;
    if (pinch && (pointerId === pinch.a || pointerId === pinch.b)) {
      this.restingZoom = settledZoom(pinch.live, zoomSteps(CAMERA_ZOOM));
      this.pinching = null;
      this.applyZoom();
    }
    if (this.touching.size === 0) this.pinched = false;
  }

  /**
   * Put the camera where `zoomWanted` says, and tidy up after it.
   *
   * Two things follow a zoom and neither follows it by itself. A room's
   * camera bounds are worked out from the view in *world* pixels, which is
   * the viewport divided by the zoom — so a room framed at one zoom and
   * shown at another is framed wrong, which indoors is precisely where this
   * fires. And the lights are drawn in screen pixels, so without repainting
   * them a lamp's pool covers twice the floor it did a moment ago.
   */
  private applyZoom(): void {
    const camera = this.cameras.main;
    const wanted = this.zoomWanted();
    if (camera.zoom === wanted) return;
    camera.setZoom(wanted);
    if (this.interior) this.reframeInterior();
    // The lights repaint themselves every frame off `lightScale`, so there
    // is nothing to do for them here beyond having changed the zoom.
  }

  /**
   * `at` is where the room's top-left corner is in world pixels.
   *
   * Zero for the six rooms that are a picture — they are drawn from the
   * origin, because the grid under them starts there. A growable room does
   * not: its grid begins a margin of open ground outside its own walls, so
   * the room itself sits that far in, and a camera framed from zero would
   * frame the margin and leave the house off to one side of it.
   */
  private frameRoom(width: number, height: number, at = { x: 0, y: 0 }): void {
    this.framedRoom = { width, height, at };
    const camera = this.cameras.main;
    const bounds = roomCameraBounds(
      { width, height },
      { width: camera.width / camera.zoom, height: camera.height / camera.zoom },
    );
    camera.setBounds(bounds.x + at.x, bounds.y + at.y, bounds.width, bounds.height);
    camera.startFollow(this.player);
  }

  /** Every plan that differs from the room as it shipped, ready to write. */
  private savedPlans(): Record<string, readonly string[]> {
    const plans: Record<string, readonly string[]> = {};
    for (const [house, plan] of this.plans) plans[house] = [...plan.floor];
    return plans;
  }

  /** And every room somebody has rearranged. */
  private savedDecor(): Record<string, readonly string[]> {
    const rooms: Record<string, readonly string[]> = {};
    for (const [house, pieces] of this.decor) rooms[house] = decorToSave(pieces);
    return rooms;
  }

  /** How a house is furnished: what somebody arranged, or what it shipped as. */
  private decorIn(house: string): Placed[] {
    return arrangementIn(this.decor.get(house), this.growable);
  }

  /** How big each kind of thing is, from the art it is drawn as. */
  private pieceSizes(): Footprints {
    return this.growable ? footprintsOf(this.growable) : {};
  }

  /** What stands in the way in this house. See `blockersFor`. */
  private blockers(house: string): RoomBlocker[] {
    const parts = this.growable;
    return parts ? blockersFor(parts, this.decorIn(house)) : [];
  }

  private leaveInterior(): void {
    const interior = this.interior;
    if (!interior) return;
    interior.canvas?.destroy();
    for (const fire of interior.fires) fire.destroy();
    for (const standing of interior.decor) standing.destroy();
    if (!interior.canvas) interior.image.destroy();
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
        // The one outdoor NPC with a lesson. He drifts about the square the
        // way everybody out here does, so the tap asks where he is now
        // rather than where the city put him — the same argument as the
        // postal worker's, and the same mistake if it is not made.
        if ((spec.role ?? spec.id) === CLOCKMAKER_ID) {
          this.watchAttendant(
            sprite,
            () => {
              const npc = this.npcs.find((one) => one.id === spec.id);
              return { col: npc?.col ?? spec.home.col, row: npc?.row ?? spec.home.row };
            },
            () => this.meetClockmaker(),
          );
        }
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
          homeBuildingId: spec.homeBuildingId,
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

  /**
   * Who is still out after the village has shut.
   *
   * The clockmaker, and only him. It reads as a character note — the one
   * person in the city who is always up, because the clock is — and it is
   * load-bearing for a reason that has nothing to do with charm.
   *
   * He teaches the hourglass, and the hourglass is what a child uses to get
   * past a shut door: wind the glass to morning and the village opens. A
   * teacher of that spell who himself went home at six would be a lock whose
   * key was on the other side of it.
   *
   * It does not undo the whole knot — the geometer is indoors and teaches
   * the portal spell, so an evening-only player still has a long walk to
   * this man rather than a short cast. See the note on `villageIsOpen`.
   */
  private keepsNoCurfew(npc: NpcRuntime): boolean {
    return npc.id === CITY_CLOCKMAKER_ID;
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
      if (daytime || this.keepsNoCurfew(npc)) this.npcWanderStep(npc);
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
      // The array and clock parchments are not on this list. Whether that is
      // deliberate has not been established here, so it is left alone — but
      // a new parchment goes on it, because everything that reads this asks
      // "is a question already on screen", and a wall is one.
      this.brickPopup?.isOpen === true ||
      this.symmetryPopup?.isOpen === true ||
      // Mid-crossing: a step from a tile they are no longer standing on.
      this.travelling
    );
  }

  private get crateIsEmpty(): boolean {
    return PLACEABLE_FIXTURES.every((fixture) => this.inventory.count(fixture) === 0);
  }
}
