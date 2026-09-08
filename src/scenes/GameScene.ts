// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import Phaser from "phaser";
import { tuneFor } from "../audio/score";
import { Sfx } from "../audio/sfx";
import { sound } from "../audio/sound";
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
import { type Profile, createProfile } from "../save/profiles";
import {
  HEARTH_IS_FURNITURE,
  type WorldBaseline,
  type WorldSnapshot,
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
import { CURRENCY, largestCoin } from "../shop/currency";
import {
  type AdditionCast,
  type BareSum,
  type NumberLine,
  additionCastFor,
  movedBy,
} from "../spells/addition";
import {
  HARDEST_BRICK_RUNG,
  brickBeingAsked,
  brickRungAt,
  makeBrickProblem,
} from "../spells/bricks";
import type { CastResult } from "../spells/cast";
import {
  DEFAULT_BAND,
  HARDEST_RUNG,
  type Rung,
  bandAt,
  bandOn,
  rungAt,
  rungInBand,
} from "../spells/difficulty";
import { boxesOf, shareProblemFor, shareRungAt } from "../spells/division";
import {
  type ClockTime,
  FULL_CIRCLE,
  HARDEST_CLOCK_RUNG,
  askedOf,
  asksMinutes,
  clockRungAt,
  readClock,
  sandFor,
} from "../spells/hourglass";
import { logicHint, logicRungAt } from "../spells/logic";
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
import {
  KNOWN_FROM_THE_START,
  SPELLS,
  Spell,
  TAUGHT_BESIDE,
  knowsSpell,
  learnSpell,
} from "../spells/spellbook";
import { makeSubtractionProblem } from "../spells/subtraction";
import { symmetryHint, symmetryRungAt } from "../spells/symmetry";
import { AboutPanel, type DebugControls } from "../ui/AboutPanel";
import { ActionWheel } from "../ui/ActionWheel";
import { ArrayPopup } from "../ui/ArrayPopup";
import { BrickPopup } from "../ui/BrickPopup";
import { ClockPopup } from "../ui/ClockPopup";
import { CountingPopup } from "../ui/CountingPopup";
import { GeometryLessonPanel } from "../ui/GeometryLessonPanel";
import { GroveLessonPanel } from "../ui/GroveLessonPanel";
import { GuideMarks } from "../ui/GuideMarks";
import { IconTray, type IconTrayOptions } from "../ui/IconTray";
import { IntroPanel } from "../ui/IntroPanel";
import { LessonPanel } from "../ui/LessonPanel";
import { LogicPopup } from "../ui/LogicPopup";
import { MapPanel } from "../ui/MapPanel";
import { NewsPanel } from "../ui/NewsPanel";
import { OptionsPanel } from "../ui/OptionsPanel";
import { PatchMenu } from "../ui/PatchMenu";
import { PicturePanel } from "../ui/PicturePanel";
import { Plaque } from "../ui/Plaque";
import { PortalPanel } from "../ui/PortalPanel";
import { SandGlass } from "../ui/SandGlass";
import { ShareLessonPanel } from "../ui/ShareLessonPanel";
import { SharePopup } from "../ui/SharePopup";
import { ShopPanel } from "../ui/ShopPanel";
import { SpellPopup } from "../ui/SpellPopup";
import { SymmetryPopup } from "../ui/SymmetryPopup";
import { TaskPanel } from "../ui/TaskPanel";
import { ThingPanel } from "../ui/ThingPanel";
import {
  UI_SIDECAR_KEY,
  UiAsset,
  type UiIndex,
  coinIcon,
  cropIcon,
  flowerIcon,
  iconForItem,
  itemIcon,
  materialIcon,
  uiTextureKey,
} from "../ui/assets";
import { type Cue, Deed, type Guide, GuideRun, type GuideView, type GuideWorld } from "../ui/guide";
import { NEWS_BEATS } from "../ui/news";
import { FACE, INK, INK_DIM } from "../ui/parchment";
import { RUNE_OF } from "../ui/runes";
import type { AreaPlacement } from "../world/anchors";
import type { AnchorPlacements } from "../world/anchors";
import {
  ANIMAL_GLAD_MS,
  ANIMAL_RANGE,
  type AnimalKind,
  AnimalMood,
  AnimalThought,
  type Mood,
  animalSheetKey,
  animalSpots,
  firstMood,
  moodAfter,
  thoughtFor,
} from "../world/animals";
import {
  type Plan,
  canStamp,
  drawPlan,
  payForStamp,
  plansFromSave,
  plansToSave,
  shortFor,
  stampedAt,
  stampedWires,
} from "../world/blueprint";
import {
  type BuildingRole,
  BuildingSprite,
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
  DEFAULT_FACING,
  Facing,
  IDLE,
  PLANT,
  WALK,
  characterAnimKey,
  characterFor,
  characterSheetKey,
  characterSidecarKey,
  facingFor,
  facingForVector,
  oppositeFacing,
  stepForFacing,
} from "../world/characters";
import type { CityLayout } from "../world/city";
import {
  CRATE_GROUPS,
  CRATE_WIRE,
  type CrateGroup,
  type CrateThing,
  faceOf,
  groupOf,
  thingsIn,
} from "../world/crate";
import {
  DECOR_ITEMS,
  DECOR_LOOKS,
  DECOR_TYPES,
  type DecorItem,
  DecorType,
  type Footprints,
  type Placed,
  ROOM_COST,
  anchorFor,
  arrangementIn,
  blockersFor,
  colourPlanFor,
  fits as decorFits,
  decorFromSave,
  decorItem,
  decorToSave,
  turnOf as decorTurnOf,
  without as decorWithout,
  footprintsOf,
  framesPerLook,
  hearthRestored,
  inTheWayOf,
  itemParts,
  pieceArt,
  protectedCells,
  roomsAfforded,
  sizeOf,
  turnsOfPiece,
} from "../world/decor";
import { EffectType, effectAnimKey, effectSheetKey } from "../world/effects";
import { type Grove, GroveTask, duskOver, groveProgress } from "../world/enchantedForest";
import { Turn, drawnFlip, drawnLook, nextTurn, turnFrom } from "../world/facing";
import {
  FixtureType,
  PLACEABLE_FIXTURES,
  fixtureAnimKey,
  fixtureFor,
  fixtureSheetKey,
  turnsOf,
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
  windowCells,
} from "../world/growableRoom";
import type { HarbourLayout } from "../world/harbour";
import {
  type Ramp,
  houseLook,
  lightingDelay,
  rampOf,
  roomSlotsFor,
  slotsFor,
  varies,
  whoLivesIn,
} from "../world/houses";
import {
  GROWABLE_ROOM,
  LightKind,
  type RoomBlocker,
  buildInteriorGrid,
  buildPlanGrid,
  growableDoor,
  growablePieceAnimKey,
  growablePieceKey,
  growableSheetKey,
  hearthCell,
  interiorAnimKey,
  interiorAttendantCell,
  interiorDoor,
  interiorFor,
  interiorOriginY,
  interiorSheetKey,
  roomCameraBounds,
  startingPlan,
  wallHangingCell,
} from "../world/interiors";
import type { Inventory, ItemType } from "../world/inventory";
import { JOB_SPECS, type LineView, RINGS_WANTED, nextJob, offered } from "../world/jobs";
import { LandmarkType, landmarkAnimKey, landmarkFor, landmarkSheetKey } from "../world/landmarks";
import {
  MINUTES_PER_ROUND,
  type MachineState,
  type MachineType,
  SHARES,
  SPARK,
  advance as advanceMachine,
  build,
  feed,
  fullestCrate,
  isMachine,
  machinesFromSave,
  machinesToSave,
  newMachine,
  recipeFor,
  takeShare,
  tipBin,
  wake,
  wouldTake,
} from "../world/machines";
import { GATHERED_MATERIALS, MADE_MATERIALS, MATERIAL_TYPES, yieldOf } from "../world/materials";
import { markedPlaces } from "../world/minimap";
import { NAMED_PEOPLE, nameCast } from "../world/names";
import type { PlacedObject } from "../world/objects";
import { LAMP_POSTS, type Observatory, lampsLit, postsFree } from "../world/observatory";
import { findPath } from "../world/pathfinding";
import {
  type Crop,
  HARVEST_STAGE,
  PLANTED_STAGE,
  PLANT_TYPES,
  type PlantType,
  groundFor,
  plantAnimKey,
  plantSheetKey,
} from "../world/plants";
import { type Rng, createRng } from "../world/rng";
import { sceneryAnimKey, sceneryKind, scenerySheetKey } from "../world/scenery";
import {
  type Patch,
  PatchAction,
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
  SPEAK_REACH,
  anywhereInThePatch,
  stepsToSpeak,
  withinReach,
  withinSpeaking,
} from "../world/session";
import type { Purse } from "../world/shop";
import { CITY_HOUSE_ID } from "../world/skyline";
import {
  type BuildingSidecar,
  type CharacterSidecar,
  type FixtureSidecar,
  type GrowableSidecar,
  type InteriorSidecar,
  type LandmarkSidecar,
  type ObjectSidecar,
  type SheetSprite,
  type SpriteSidecar,
  doorCell,
  footprintBottomY,
  spriteOrigin,
} from "../world/spriteSidecar";
import { TerrainType } from "../world/terrain";
import { DUAL_ORIGIN, TERRAIN_ATLAS_KEY, frameName, variationFor } from "../world/terrainAtlas";
import {
  CopyRefusal,
  type PaintedTiles,
  type Painting,
  planCopy,
  readPainted,
} from "../world/terrainCopy";
import {
  ALL_HOURS,
  type OpeningHours,
  STARGAZING_HOURS,
  VILLAGE_HOURS,
  clockFace,
  isDaylight,
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
import {
  USE_MS,
  type UsableThing,
  Use,
  isLasting,
  isOnTheThing,
  pillowOf,
  useOf,
} from "../world/uses";
import { type VillageNpcSpec, houseIdFor } from "../world/villageLayout";
import { type Direction, STEP_DIRECTIONS, insideWander, stepsToward } from "../world/wander";
import {
  CARRIES_PER_ROUND,
  type Wire,
  canString,
  carry,
  tileOf,
  wireKey,
  wiresFromSave,
  wiresToSave,
} from "../world/wires";
import { type GeneratedWorld, generateWorld } from "../world/worldGenerator";
import { CityBlimps } from "./cityBlimps";
import { type DevHandle, type DevOptions, devOptions, exposeForTests } from "./devHooks";
import {
  BUILDING_ANIM_FPS,
  loadAssetMetadata,
  registerBuildingAnimsFor,
  registerCharacterAnimsFor,
} from "./game/anims";
import { CHUNK_DEPTH, ChunkStreamer } from "./game/chunkStreamer";
import { Ladders } from "./game/ladders";
import { Lighting, WINDOW_GLOW_COLOR } from "./game/lighting";
import { Pinch } from "./game/pinch";
import { FROZEN_TIDE, HarbourTraffic } from "./harbourTraffic";
import { type Standing, TeacherMarks } from "./teacherMarks";

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
/**
 * And how long the cloud a tap puts over an animal stays up.
 *
 * Twice as long, because there is now something in it worth looking at. It
 * was `RESULT_MS` while the cloud was empty, and seven tenths of a second is
 * plenty of time to show somebody nothing — a child who has to find the
 * animal, read a small carrot and understand that the two go together needs
 * longer than a result flashing off a square she was already watching.
 */
const TAPPED_THOUGHT_MS = 1400;
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
/**
 * A hop onto or off a thing she is using, and how high it goes.
 *
 * Longer than a step, because it is not a step: she is not going anywhere,
 * she is getting up onto something, and a jump that took a step's time
 * would read as a glitch in the walk rather than as a jump.
 */
const HOP_MS = 260;
const HOP_RISE = 14;
/**
 * How far past a thing's near edge she lands on it.
 *
 * Depth is her feet, and a thing's depth is its foot, so landing exactly on
 * the edge is a tie — and a tie is drawn in whichever order the two were
 * made, which put her behind the bench she was sitting on. Two pixels in
 * front is invisible as a position and decisive as a depth.
 */
const ON_THING_NUDGE = 2;
/** Sitting down, and lying down, are shorter than standing. */
const SETTLE_MS = 140;
const SIT_SQUASH = 0.86;
const NAP_SQUASH = 0.84;
/** How often a moon drifts up off a sleeper. */
const NAP_MOON_MS = 1500;
/** One facing of a twirl. Eight of these is two full turns. */
const TWIRL_STEP_MS = 110;
/** How far she tilts toward a thing she leans on, and how she leans over one. */
const LEAN_DEGREES = 12;
const LEAN_FORWARD = 0.94;
// Depth is a pixel y now (see topdown.ts's depthFor), not the tile-unit
// col + row the isometric projection sorted on — so it runs to the world's
// pixel height rather than topping out around 1000. Anything that has to
// float above the world has to clear that, and deriving these from
// WORLD_SIZE keeps them right if the world grows.
const WORLD_DEPTH_CEILING = WORLD_SIZE * TILE_SIZE;
const NIGHT_TINT_DEPTH = WORLD_DEPTH_CEILING + 1000;

const HUD_DEPTH = WORLD_DEPTH_CEILING + 2000;
const TOUCH_UI_DEPTH = WORLD_DEPTH_CEILING + 3000;
// Above the touch controls: a spell popup covers everything, including the
// buttons that opened it.
/**
 * What "fill it" hands over.
 *
 * Generous, because counting money out is the point of the game everywhere
 * else and this is the button for when it is not.
 */
const DEBUG_COINS = 5_000;
const DEBUG_EACH = 20;

const MODAL_DEPTH = WORLD_DEPTH_CEILING + 4000;
/**
 * How long after the world is drawn before it says what came back.
 *
 * Long enough that the garden is on screen first: a cloud that arrives while
 * the world is still being built is a cloud about nothing, and she has not
 * yet had a chance to notice the gap it is explaining.
 */
const RETURNED_SAYS_MS = 900;
/**
 * The two colours a length of wire is drawn in.
 *
 * The same pair the coil's own icon uses, so the thing in the crate and the
 * thing in the garden are plainly one thing. Two lines rather than one — a
 * dark one and a lit one a pixel above it — because a single stroke at this
 * zoom is a hair and reads as a scratch on the screen rather than as
 * something hanging in the world.
 */
const WIRE_DARK = 0x60543f;
const WIRE_LIT = 0xc6ba98;
/** How many named tiles of sea the dev seam hands back. See `sea`. */
const SEA_SAMPLE = 8;

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

const HUD_MARGIN = 8;
/**
 * The clock's box, and the sun or moon in it.
 *
 * Wide enough for `12:00` at fifteen pixels beside the picture, with a
 * little air after it — `10:00` sat hard against the right-hand stroke at
 * eighty-four. The longest date the three languages write is `31 pros`,
 * which is shorter than the time above it, so the time sets the width.
 */
const CLOCK_HUD_W = 104;
const CLOCK_HUD_H = 42;
const CLOCK_HUD_ICON = 18;
/**
 * How far inside a plaque's own edge anything written on it starts.
 *
 * The frame is drawn several pixels thick, and writing that begins at the
 * corner begins on the border rather than on the paper.
 */
const PLAQUE_PAD = 9;
/** The options button, which is a plaque with one word on it. */
const OPTIONS_W = 78;
const OPTIONS_H = 28;

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

/**
 * The rune each of them casts — which is the whole of what the menu shows.
 *
 * Building is the plus rune too, and deliberately: indoors the addition
 * spell puts a square of floor down instead of a crop up, and a child who
 * has learned what plus does should not have to learn a second picture for
 * the same spell doing the same arithmetic in a different room.
 */
const SPELL_RUNES: Record<PatchAction, string> = {
  // Planting is the exception and shows the *seed* instead — see
  // `patchMenuIcon`. This entry is what the map needs to be complete and is
  // never the picture on the button.
  [PatchAction.Plant]: UiAsset.SeedPouch,
  [PatchAction.Grow]: UiAsset.RuneAdd,
  [PatchAction.Clear]: UiAsset.RuneMinus,
  [PatchAction.Build]: UiAsset.RuneAdd,
  [PatchAction.Pick]: UiAsset.RuneDivide,
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

// How many distinct starting points an idle animation can be scattered
// across. Enough that a stand of trees looks unsynchronised, few enough
// that it stays a cheap integer hash of the tile.
const PHASE_STEPS = 16;

/**
 * How far a thing's art must rise above its own footprint before walking
 * behind it counts as being hidden, in tiles.
 *
 * Three, which takes in the townhouse, the tower, the observatory and all
 * three landmarks, and leaves out every tree and every fence. A conifer is
 * two tiles of art over one of ground: standing behind one covers a child's
 * head and nothing else, and fading half a wood as she walks through it
 * would be a worse picture than the one it fixed.
 *
 * The case this exists for is the lighthouse. Its art is seven and a half
 * tiles tall over a footprint of two, so the six cells behind it are drawn
 * over completely — a playtest reported walking in there and being unable to
 * move, and she was moving the whole time. `LANDMARK_OVERHANG` already knew
 * this number and was only ever consulted to keep *buildings* out of the
 * shadow; nothing kept the player out of it, and nothing can, because she
 * walks where she likes.
 */
const TALL_ENOUGH_TO_HIDE = 3;
/** What is left of one while she is behind it: enough to see her through. */
const HIDDEN_BEHIND_ALPHA = 0.35;
/**
 * How fast it gets out of the way, per frame at sixty of them a second.
 *
 * A fifth of a second either way. Snapping was tried and reads as the
 * building flickering rather than as it giving way, which is the whole
 * difference between an effect and a glitch.
 */
const HIDING_FADE_STEP = 0.08;

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
/** The village store, as the layout names it: where the guide sends a full basket. */
const STORE_ID = "store";
/** How far in from the screen's edge the guide's trail stops, so its arrow is whole. */
const GUIDE_TRAIL_INSET = 60;
/**
 * How far off a sleeping machine may be for the guide to point at it.
 *
 * The machine the guide means is the one she has just put down beside
 * her. Without a limit it found a sieve at the far end of the world — in
 * a saved game, where it had been left — and sent a child who had just
 * picked her first carrot on a walk across the map to it.
 */
const GUIDE_MACHINE_REACH = 10;
/**
 * And how near the great tree's wood has to be before the guide means it.
 *
 * The same rule as the machine above, learned the same way and one guide
 * later. The wood stands in the enchanted forest from the moment the world
 * is made, so "is there wood standing" is true in the village, in the city
 * and on the quay — and the grove guide, offered anywhere, took the first
 * gap the loop left it: a child planted her first seed and was pointed at a
 * forest she had never been to.
 *
 * Wider than the machine's, because a grove is a place rather than a thing
 * she put down: standing at the doorstep with the beds spread out in front
 * of her, the far corner is further off than ten.
 */
const GUIDE_GROVE_REACH = 20;
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
/** The mechanic, behind her bench in the garage: the seventh teacher. */
const MECHANIC_ID = "mechanic";
/** The fisherman on the quay, who teaches the sharing spell. */
const FISHER_ID = "fisher";
/** The one teacher who is a thing rather than a person. See `TAUGHT_BY`. */
const GREAT_TREE_ID = "great-tree";
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
/**
 * The village tower, which is a post office downstairs and a study up.
 *
 * Named here because two separate things about it hang off the id: the map
 * on its wall, and the hours it keeps while a child has no other way of
 * finding anything. See `WALL_HANGINGS` and `hoursFor`.
 */
const TOWER_ID = "post-office";
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
// How long after the world is up before a door may open in front of a child
// who is nowhere near the village. Long enough that the game has settled and
// they have had a moment to see where they are — a portal that tore itself
// open in the first frame would read as part of the loading.
const POST_ARRIVAL_MS = 2500;
// How long he takes to come out of it and to go back in. The player's own
// crossing is a different pair of numbers because it is a different thing:
// theirs is being pulled through, his is stepping out of a doorway.
const POST_STEP_MS = 320;

/**
 * What the postal worker still has for this child, if anything.
 *
 * Two things and one man, which is the whole point of it — see `ui/news.ts`.
 * The welcome says what the game is, once; the news says what has changed in
 * it since they last played. They are never both owed: a child who has not
 * had the welcome is caught up on the news by being given it.
 */
const Delivery = {
  Welcome: "welcome",
  News: "news",
} as const;

type Delivery = (typeof Delivery)[keyof typeof Delivery];
const LOCAL_WANDER_RADIUS = 5;
const PATROL_WANDER_RADIUS = 16;

// Crops and placed fixtures are sparse and looked up by tile, so their
// sprites are keyed by position rather than held in a grid-sized array.
function tileKey(col: number, row: number): string {
  return `${col},${row}`;
}

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
  /**
   * What is in the cloud over its head at this moment, by name.
   *
   * Its own field rather than read back off the container, because a cloud
   * is a handful of images and "which pictures are in it" is the question a
   * script asks — and because the momentary one a tap puts up is not the
   * animal's own bubble and has nowhere else to be recorded.
   */
  thinking: readonly AnimalThought[];
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
  | { kind: "fixture"; fixture: FixtureType; turn: number }
  | { kind: "decor"; piece: DecorType; look: number; turn: number }
  /**
   * A coil, part way through being strung.
   *
   * `from` is the machine the first tap landed on, or null before it has. It
   * is the one armed thing that takes *two* taps, which is why it carries
   * state at all — everything else in this union is answered by one square.
   */
  | { kind: "wire"; from: GridPoint | null }
  /** A blueprint's drawing, picked up to be stamped down: `from` is the blueprint's square. */
  | { kind: "plan"; from: string }
  | { kind: "flower"; flower: FlowerType; look: number };

/**
 * One name for whatever is lit, for comparing and for a script to read.
 *
 * A spell answers with its own name and nothing else, which is what keeps
 * `armed` the seam it has always been: the scenarios that assert `"growth"`
 * were written before any of this and are not about it.
 */
/**
 * One picture in a thought cloud: something from the interface, or a square
 * of actual ground.
 *
 * Two kinds because they come from two atlases and there is no honest way to
 * flatten them into one string — a crop icon is drawn *for* the interface
 * and a square of sand is the terrain itself, borrowed. Keeping them apart
 * here is what lets the drawing pick the right texture without a naming
 * convention nobody would remember.
 */
type Thought =
  | { readonly ui: string }
  | { readonly ground: TerrainType }
  | { readonly sheet: string; readonly frame?: number; readonly tag: string };

/** What a cloud's contents are called, for the seam and for tests. */
function thoughtTag(thought: Thought): string {
  if ("ground" in thought) return thought.ground;
  return "sheet" in thought ? thought.tag : thought.ui;
}

/**
 * The atlas frame for a square that is all one terrain.
 *
 * The atlas is built for *corners* — every cell is drawn from the four
 * terrains meeting at it — so a plain square of sand is the combination
 * where all four corners are sand. Variation nought, because a bubble wants
 * the same picture every time and the variations exist to stop a field
 * looking tiled.
 */
function plainTerrainFrame(ground: TerrainType): string {
  return frameName([ground, ground, ground, ground], 0);
}

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
    case "wire":
      // Named by what it is rather than by where it is going. A scenario
      // asking what is in her hands wants "a coil", and the end it has hold
      // of so far is its own question — see the `wiring` seam.
      return CRATE_WIRE;
    case "plan":
      return FixtureType.Blueprint;
    default:
      return flowerObject(what.flower, what.look);
  }
}

/**
 * The two answers to a tap on a thing she put down. See `offerActions`.
 */
type ThingAction = "use" | "take";

/** Whether a cue points at something on the shop's own counter. */
function insideShop(cue: Cue): boolean {
  return cue.kind === "sell-row" || (cue.kind === "button" && cue.name.startsWith("shop."));
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
  private countingPopup!: CountingPopup;
  private seedTray?: IconTray;
  private spellTray?: IconTray;
  private basketTray?: IconTray;
  private crateTray?: IconTray;
  /** What a thing is and what it costs, opened from a button's own cloud. */
  private thingPanel?: ThingPanel;
  /**
   * Which group of the crate is open, or null for the groups themselves.
   *
   * The scene's rather than the tray's, because what the groups *are* is a
   * fact about the things in them and `IconTray` knows nothing about
   * fixtures or furniture. The tray is told only which of its buttons are on
   * it just now.
   */
  private crateGroup: CrateGroup | null = null;
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
  /**
   * The guide: which action is being pointed at, and the marks that point.
   *
   * See `ui/guide.ts`. The run is the child's — it starts from what their
   * progress says they have been walked through — and the marks are the
   * scene's, drawn every frame from whatever the run asks for.
   */
  private guide?: GuideRun;
  private guideMarks?: GuideMarks;
  /** What the guide last saw of the world, and when; it is not cheap to look. */
  private guideWorldSeen: { at: number; world: GuideWorld } | null = null;
  /** How much of the tree's wood was standing last time it was counted. */
  private woodStandingSeen: number | null = null;
  /**
   * The last square she sowed, so the guide can point back at it.
   *
   * The growing guide asks for "a crop that is not ripe" and the scene
   * answered with the *nearest* one, which is right in an empty garden and
   * wrong in every other: a bed with seedlings already in it, one seed just
   * put down at the far end, and the arrow went to somebody else's row. What
   * she is being walked through is the seed she just planted.
   */
  private justPlanted: GridPoint | null = null;
  /** The building she walked into, for the guide that points at a door. */
  private enteredBuilding: string | null = null;
  /**
   * The way from where she stood to where the guide is sending her, found
   * once per square she moves rather than once per frame.
   *
   * A breadth-first search over the village is cheap; sixty of them a
   * second is not. Keyed by both ends so a target that changes finds a new
   * way, and a way that could not be found is remembered as none, or the
   * search for it would run every frame for as long as she stood still.
   */
  private guideRoute: { from: string; to: string; path: GridPoint[] | null } | null = null;
  private newsPanel?: NewsPanel;
  private mapPanel?: MapPanel;
  /** One picture, held up close, for the things that are only pictures. */
  private picturePanel?: PicturePanel;
  /** Somebody's errand, drawn as a row of things to do and what it earns. */
  private taskPanel?: TaskPanel;
  private geometryPanel?: GeometryLessonPanel;
  private grovePanel?: GroveLessonPanel;
  private arrayPopup?: ArrayPopup;
  /**
   * The division spell's parchment.
   *
   * Built and reachable, and not yet cast by anything: the spell's world
   * half — the rune, the harvest, whoever teaches it — is not written. What
   * opens it today is `?share=`, which is what lets the parchment be driven
   * and looked at before there is a garden behind it. See `division.ts`.
   */
  private sharePopup?: SharePopup;
  /** And the lesson the fisherman gives beside it. */
  private sharePanel?: ShareLessonPanel;
  private brickPopup?: BrickPopup;
  private clockPopup?: ClockPopup;
  private flowerSidecars = new Map<FlowerType, FixtureSidecar>();
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
  /** The logic spell's: a tray and a rule, or switches and a lamp. */
  private logicPopup?: LogicPopup;
  /**
   * The little menu over her head, which asks two questions in turn.
   *
   * `PatchAction | PlantType` rather than the action alone: after *plant* it
   * opens again with the crops on it. Two menus would be two things to
   * position, close and name for a script, and the second question is the
   * same question in the same place.
   */
  private patchMenu?: PatchMenu<PatchAction | PlantType>;
  /** The second of the two taps: which colour of a thing to put down. */
  private decorMenu?: PatchMenu<DecorItem>;
  private flowerMenu?: PatchMenu<PlantedFlower>;
  /**
   * The ring of choices over a thing she has tapped: use it, or take it.
   *
   * A tap on a bench used to put it straight in the basket. See
   * `offerActions` for why it asks now, and `ActionWheel` for the asking.
   */
  private wheel?: ActionWheel<ThingAction>;
  /**
   * Set by the tap that opened the ring, and cleared by the scene's own
   * handler for that same tap.
   *
   * Phaser runs a sprite's handlers before the scene's, so the tap that
   * opens the ring arrives at the handler that closes rings a moment later
   * — and without this it closed the one it had just opened.
   */
  private wheelFresh = false;
  /** Where she stood when the ring opened. A step off it is a change of mind. */
  private wheelOpenedAt: GridPoint | null = null;
  /**
   * The move she is in the middle of, or null.
   *
   * Folded into `modalOpen`, like a portal crossing: nothing she presses
   * reaches the world while she is halfway onto a bench.
   */
  private using: Use | null = null;
  /**
   * Where to get back to, once she is settled on something and staying.
   *
   * Set only for a lasting use and only once the hop is over: while it is
   * set, the next tap anywhere — or a direction key — gets her up. See
   * `standUp`.
   */
  private rest: { home: ScreenPoint; toward: Facing } | null = null;
  /** The moon now and then while she naps; anything on a clock while she rests. */
  private restLoop: Phaser.Time.TimerEvent | null = null;
  /**
   * Her depth while she is on something, instead of her feet.
   *
   * Her feet are her depth, and that is right everywhere but here: a bed
   * facing the camera has its pillow at the far end, and feet on the far
   * square sort *behind* the bed, which draws the blanket over the whole of
   * her. So while she is on a thing she is drawn just in front of it,
   * wherever on it she is.
   */
  private perchDepth: number | null = null;
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
  /** Two fingers on the glass and the zoom they ask for — see `Pinch`. */
  private readonly pinch = new Pinch(CAMERA_ZOOM, {
    release: () => this.joystick?.release(),
    applyZoom: () => this.applyZoom(),
  });
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
  /**
   * What was last thought over her head, and whether it was crossed out.
   *
   * A dev seam, and one that earned itself. These clouds live for four
   * hundred milliseconds and every tap in the browser harness waits five
   * hundred before it looks — so a screenshot taken the obvious way catches
   * an empty field and says the feature is broken. It is not a thing a
   * picture can settle, which is exactly what a seam is for.
   */
  private lastThought: { icons: string[]; crossed: boolean } | null = null;
  /** The rune hanging over her head while a spell waits for a tap. */
  private armedRune?: Phaser.GameObjects.Image;
  /** The square she is pointing at, and the ground an armed spell may reach. */
  private aimInk?: Phaser.GameObjects.Graphics;
  /** Everything `ui()` has claimed, so a tap can be told from a world tap. */
  private readonly uiObjects = new WeakSet<Phaser.GameObjects.GameObject>();
  private portalPanel?: PortalPanel;
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
  /** What the postal worker still has to deliver, and his patience. */
  private delivery: Delivery | null = null;
  private introStepsLeft = INTRO_PATIENCE_STEPS;
  /**
   * Set while a door is open in front of the player and he is coming out of
   * it or going back into it.
   *
   * Folded into `modalOpen` for the reason `travelling` is: the player must
   * not walk off the tile a portal is standing on the far side of. It is
   * *cleared* for the moment the panel is up — the panel is modal itself,
   * and leaving both set would have `openDelivery` refuse to open the very
   * sheet the arrival exists to show.
   */
  private postArriving = false;
  /** His sprite, while he is out here. Not one of `npcs`: see `postmanIn`. */
  private postman: Phaser.GameObjects.Sprite | null = null;
  /**
   * Whether the world has been up long enough for a door to open in it.
   *
   * A timer rather than a timestamp compared against `time.now`. That was
   * the first version and it did not hold: `this.time.now` read inside
   * `create` is not the clock `update` goes on to read, so the pause came
   * out a fraction of its length and the doorway tore itself open while the
   * first chunks were still being painted — which is the one thing
   * `POST_ARRIVAL_MS` exists to prevent, and it read as part of the loading.
   */
  private postReady = false;
  /** The arrival's failsafe, cancelled the moment he is away again. */
  private postGuard: Phaser.Time.TimerEvent | null = null;
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
  private optionsButton?: { plaque: Plaque; label: Phaser.GameObjects.Text };
  /**
   * The picture rising over her head, while there is one.
   *
   * One at a time, and this is what enforces it. See `floatMark`.
   */
  private floatingMark?: Phaser.GameObjects.Image;
  /**
   * The clock in the corner: the hour, the day, and which half of the day.
   *
   * See `createClockHud`. Kept as one object because the four pieces are
   * laid out against each other and are shown and hidden together.
   */
  private clockHud?: {
    plaque: Plaque;
    sky: Phaser.GameObjects.Image;
    time: Phaser.GameObjects.Text;
    date: Phaser.GameObjects.Text;
  };
  /** What the clock last wrote, so it is only rewritten when it changes. */
  private clockShowing = "";
  // Sprites for fixtures the *player* put down, so one can be picked back
  // up. Deliberately not the village well: it was placed by generation and
  // is not hers to take.
  private placedFixtures = new Map<string, Phaser.GameObjects.Sprite>();
  /**
   * What every machine in the world is holding, by the square it stands on.
   *
   * Its own map rather than a field on the placed object, for the reason
   * `machinesToSave` gives: a placed object is a fact about how the world was
   * generated and is diffed against the generator's own baseline, and what a
   * sorter happens to have in its mouth this minute has no business in that
   * comparison.
   */
  private machines = new Map<string, MachineState>();
  /**
   * Everything standing in the world that could hide the player behind it.
   *
   * Collected as each one is drawn rather than searched for every frame:
   * `spawnFootprintSprite` is the one place any of them is made, and it has
   * the sidecar in its hand at the time. Ids come along so a test can ask
   * *which* thing is giving way — a sprite has no name a script can read.
   *
   * Dead entries are dropped on the pass that finds them: a tree cast away
   * by the minus spell leaves its sprite destroyed and nothing else knows to
   * come here and say so.
   */
  private tallThings: { id: string; at: GridPoint; sprite: Phaser.GameObjects.Sprite }[] = [];
  /**
   * The world's clock, last time a machine was told about it.
   *
   * Null until the first frame with a machine in the world. See `workMachines`
   * for why this is sampled rather than accumulated.
   */
  private machinesTold: number | null = null;
  /** Every length of wire in the world. See `wires.ts`. */
  private wires: Wire[] = [];
  /**
   * Every blueprint's drawing, by the square it stands on.
   *
   * Made when a blueprint is woken and kept until it is taken up — see
   * `world/blueprint.ts` — and saved with the machines and the wires, for
   * the reason they are: a drawing on an easel in a shared garden is there
   * for whichever child walks up to it.
   */
  private drawings = new Map<string, Plan>();
  /**
   * How much each wire has carried altogether, by its own key.
   *
   * Nothing else can see this, and it is a running total rather than a rate
   * on purpose. A wire that is backed up, a wire that has finished its work
   * and a wire that was never joined to anything all carry nothing this
   * second — from outside they are the same picture. What tells them apart
   * is whether this line has *ever* worked.
   */
  private readonly wireCarried = new Map<string, number>();
  /** Minutes of work banked against each wire's next round. */
  private readonly wireWork = new Map<string, number>();
  /** The lines themselves, drawn as ink the way the spells' marks are. */
  private wireInk?: Phaser.GameObjects.Graphics;
  /** Things a rebuilt world had nowhere to put, until her basket is back. */
  private refused: readonly PlacedObject[] = [];
  // Problems vary from cast to cast, so this is seeded from the clock rather
  // than from the world's seed: a world is meant to be reproducible, a lesson is
  // meant not to be. A driving script can pin it with `?seed=`, which is the
  // honest version of what tests used to do by monkeypatching Date.now — and
  // which does not also stall every tween in the game. See devHooks.
  private dev: DevOptions = devOptions();
  /**
   * The difficulty ladders and their windows of recent casts. Read the
   * profile and seams through closures: `saveProfileChange` replaces the
   * profile object, so a captured one would judge the child on stale rungs.
   */
  private readonly ladders = new Ladders({
    profile: () => this.profile,
    dev: () => this.dev,
    save: (change) => this.saveProfileChange(change),
  });
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

  /** The room the camera is framing, in pixels, so a rotation can re-frame it. */
  private framedRoom: {
    width: number;
    height: number;
    at: { x: number; y: number };
  } | null = null;

  private mobileControls = false;
  private joystick?: VirtualJoystick;
  private path: GridPoint[] = [];

  /**
   * The ground, its trees and its sea, streamed in under the camera and
   * thrown away behind it — see `ChunkStreamer`. Reads the grid and origin
   * through closures because both are swapped at every door.
   */
  private readonly chunks = new ChunkStreamer(this, {
    grid: () => this.grid,
    originX: () => this.originX,
    originY: () => this.originY,
    world: (object) => this.world(object),
    spawnScenery: (object) => this.spawnScenery(object),
    toFeet: (col, row) => this.toFeet(col, row),
  });
  private buildingSidecars = new Map<BuildingSprite, BuildingSidecar>();
  private fixtureSidecars = new Map<string, FixtureSidecar>();
  private scenerySidecars = new Map<string, ObjectSidecar>();
  private landmarkSidecars = new Map<string, LandmarkSidecar>();
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
  private city!: CityLayout;
  private observatory: Observatory | null = null;
  private harbourFront: HarbourLayout | null = null;
  /** The hulls that come and go at the harbour's piers. */
  private traffic?: HarbourTraffic;
  private blimps?: CityBlimps;
  /** A rune over each teacher who still has one to give. */
  private teacherMarks?: TeacherMarks;
  /**
   * What the debug panel has been asked for, over and above the address bar.
   *
   * Three of the seams are *states* rather than one-off grants — a frozen
   * village, hungry animals, an hour — so a panel that sets them needs
   * somewhere to put the answer. The rest of what it offers changes the
   * child's own things instead: coins into the purse, a rung on the profile,
   * spells into the book. Those are real and saved, and no override is
   * wanted or kept.
   *
   * `?freezeNpcs` and the rest still work and still win: a script that asked
   * for a still village gets one whatever a panel says.
   */
  private debugFreeze = false;
  private debugHungry = false;
  private debugHour: number | null = null;
  /**
   * What the patch menu is currently offering, in the order it drew them.
   *
   * Strings rather than `PatchAction`, because the menu is opened twice: once
   * to pick the spell and once — after *plant* — to pick the seed, whose
   * choices are crops. Both name their buttons out of this list.
   */
  private patchChoices: readonly string[] = [];
  /**
   * Which seed the patch being cast on will be sown with.
   *
   * Fixed when the action is chosen rather than read when it lands. See
   * `beginMarking`.
   */
  private patchSeed: PlantType = PLANT_TYPES[0] as PlantType;
  /** What part each npc plays, for the marks — `spec.role ?? spec.id`. */
  private readonly npcRoles = new Map<string, string>();
  /** Where the three wild flowers grew, for a script that has to walk to one. */
  private wildFlowers: readonly WildSpot[] = [];
  private worldPixelWidth = 0;
  private worldPixelHeight = 0;
  // Everything drawn outdoors and everything drawn indoors, so entering a
  // building is one setVisible on each rather than hunting down every sprite
  // and chunk texture that happens to exist.
  private worldLayer!: Phaser.GameObjects.Layer;
  private interiorLayer!: Phaser.GameObjects.Layer;

  /**
   * The night and every hole in it — see `Lighting`. The scene answers its
   * questions through closures because all of them change: where she is,
   * whether she is indoors, which flame the hearths flicker to.
   */
  private readonly lighting = new Lighting(
    this,
    { tintDepth: NIGHT_TINT_DEPTH, worldZoom: CAMERA_ZOOM },
    {
      ui: (object) => this.ui(object),
      screenOf: (col, row) => this.screenOf(col, row),
      screenOfPoint: (x, y) => this.screenOfPoint(x, y),
      originX: () => this.originX,
      originY: () => this.originY,
      player: () => this.player,
      indoors: () => this.interior !== null,
      flame: () => this.interior?.fires[0] ?? (this.interior?.canvas ? null : this.interior?.image),
      duskWanted: () =>
        this.interior ? 0 : duskOver(this.anchors.enchantedForest, this.session.tile),
      tree: () => (this.interior || this.groveDone ? null : this.grove.tree),
      buildings: () => this.buildings,
    },
  );
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
    const art = loadAssetMetadata(this);
    this.chunks.learnTerrain(art.terrainVariations, art.cliffVariations, art.waterFrames);
    this.chunks.learnDecking(art.deckVariations);
    this.buildingSidecars = art.buildingSidecars;
    this.scenerySidecars = art.scenerySidecars;
    this.landmarkSidecars = art.landmarkSidecars;
    this.flowerSidecars = art.flowerSidecars;
    this.fixtureSidecars = art.fixtureSidecars;
    this.interiorSidecars = art.interiorSidecars;
    this.growable = art.growable;

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
    // The ground moving under a save, on purpose. See `DevSeams.drown`: this
    // is the consequence of a habitat rule changing, made reachable without a
    // scenario having to pin a habitat rule.
    const drown = this.dev.drown;
    if (drown && world.grid.inBounds(drown.col, drown.row)) {
      world.grid.setTerrain(drown.col, drown.row, TerrainType.Water);
    }
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
      // Gathered only. Beams and cord are *made*, and a seam that handed
      // them out would be conjuring the one class of thing in this game
      // that never appears without a machine having produced it.
      for (const material of GATHERED_MATERIALS) {
        this.inventory.add(material, this.dev.materials);
      }
    }
    if (this.dev.made > 0) {
      for (const material of MADE_MATERIALS) this.inventory.add(material, this.dev.made);
    }
    if (this.dev.furniture > 0) {
      for (const item of DECOR_ITEMS) this.inventory.add(item, this.dev.furniture);
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
    this.chunks.refreshVisibleChunks();

    // Every static thing the generator placed: the village's buildings and
    // well, and the hundreds of trees and boulders walling the world's two
    // high edges.
    // Before anything is spawned: the village's own lamp posts ask for their
    // halo as they appear, and an image made against a texture that does not
    // exist yet gets Phaser's missing-texture placeholder — a lime green box,
    // drawn additively, several tiles across.
    this.lighting.makeLightMask();
    // Everything except the scenery, which comes and goes with the chunk it
    // stands on — see `sceneryByChunk`.
    this.chunks.bucketScenery(this.grid.listObjects());
    this.spawnPlacedObjects(
      this.grid.listObjects().filter((object) => sceneryKind(object.type) === null),
    );
    // The harbour's traffic, if this world has a harbour with berths in it.
    const berths = world.harbour?.berths ?? [];
    const hull = this.buildingSidecars.get(BuildingSprite.Ship);
    if (berths.length > 0 && hull) {
      this.traffic = new HarbourTraffic(
        this,
        berths,
        hull,
        { x: this.originX, y: this.originY },
        this.seed,
        (name, sprite) => this.houseSheetFor(name, sprite),
        (object) => this.world(object),
      );
    }
    // The airships over the city, which are sprites over rooftops in exactly
    // the way the harbour's hulls are sprites over berths — no cell, no save,
    // nothing to carve away. Made here rather than in `spawnPlacedObjects`
    // because they are hung on the *sprites* of the city's houses, so every
    // one of those has to exist first.
    this.blimps = new CityBlimps(
      this,
      this.buildings.filter((building) => building.id.startsWith(CITY_HOUSE_ID)),
      (object) => this.world(object),
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
    // Above the ground and below everything standing on it, so a wire runs
    // *behind* the machines it joins rather than across their faces.
    this.wireInk = this.world(this.add.graphics().setDepth(CHUNK_DEPTH + 1));

    // The empty lamp posts on the climb, for the same reason and in the same
    // layer: a socket a lamp is standing in must be drawn under the lamp.
    this.socketInk = this.world(this.add.graphics().setDepth(0));
    this.paintSockets();

    this.lighting.layNight();
    const uiIndex = this.cache.json.get(UI_SIDECAR_KEY) as UiIndex | undefined;
    if (!uiIndex) throw new Error("ui.json did not load — the spell parchment has no art");
    // ?lang= is for scripts: it overrides the language for this run without
    // touching what the player saved.
    this.settings = settingsWithOverrides(
      // Two owners, one object. The language is this child's and comes off
      // their profile; whether there is music is the room's and comes off
      // the device, which is where the who's-playing screen already read it
      // from before any child had been chosen.
      { language: this.profile.language, sound: readSettings(browserStore()).sound },
      {
        language: this.dev.language,
      },
    );
    this.words = phrasesFor(this.settings.language);
    // Written once already, before there was a language to write it in.

    this.spellPopup = new SpellPopup(this, uiIndex, MODAL_DEPTH, this.words, (object) =>
      this.ui(object),
    );
    this.countingPopup = new CountingPopup(this, uiIndex, MODAL_DEPTH, this.words, (object) =>
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
    this.shopPanel.onChooseCrop = () => this.noteDeed(Deed.ChoseCrop);
    this.shopPanel.onSell = (plant, count) => {
      this.noteDeed(Deed.Sold);
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
      () => this.whereOnTheMap(),
      (object) => this.ui(object),
    );
    this.picturePanel = new PicturePanel(this, uiIndex, MODAL_DEPTH, (object) => this.ui(object));
    this.taskPanel = new TaskPanel(
      this,
      uiIndex,
      MODAL_DEPTH,
      (object) => this.ui(object),
      // As many tokens as the longest row any sheet shows: the observatory's
      // posts, or the bell's rings.
      Math.max(LAMP_POSTS, RINGS_WANTED),
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
    this.sharePopup = new SharePopup(this, uiIndex, MODAL_DEPTH, this.words, (object) =>
      this.ui(object),
    );
    this.sharePanel = new ShareLessonPanel(this, uiIndex, MODAL_DEPTH, this.words, (object) =>
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
    this.logicPopup = new LogicPopup(this, uiIndex, MODAL_DEPTH, this.words, (object) =>
      this.ui(object),
    );
    // Above the parchment, because the parchment has closed by the time the
    // sand runs and what is underneath is the world changing colour.
    this.sandGlass = new SandGlass(this, MODAL_DEPTH + 10, (object) => this.ui(object));
    this.patchMenu = new PatchMenu<PatchAction | PlantType>(this, TOUCH_UI_DEPTH, (object) =>
      this.ui(object),
    );
    this.decorMenu = new PatchMenu<DecorItem>(this, TOUCH_UI_DEPTH, (object) => this.ui(object));
    this.wheel = new ActionWheel<ThingAction>(this, TOUCH_UI_DEPTH, (object) => this.ui(object));
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
    this.newsPanel = new NewsPanel(this, uiIndex, MODAL_DEPTH, this.words, (object) =>
      this.ui(object),
    );
    // Over the trays and under the parchments: the marks point at buttons
    // and squares, and a panel over the top of them is a moment they are
    // not pointing at anything.
    this.guideMarks?.destroy();
    // Over the panels, not under them. The counter's rows are on a sheet of
    // parchment at MODAL_DEPTH, and a ring below that is a ring nobody sees.
    this.guideMarks = new GuideMarks(this, MODAL_DEPTH + 100, (object) => this.ui(object));
    this.guideWorldSeen = null;
    this.guide = new GuideRun([...this.profile.guided, ...this.dev.guided], (guide) =>
      this.rememberGuided(guide),
    );
    // He walks it over the first time, and after that only if asked. ?intro
    // asks for it again without clearing the saved settings.
    //
    // The welcome outranks the news, and a child owed the welcome is never
    // also owed the news: giving it catches them up on the list — see
    // `rememberIntroSeen`. Somebody being told what the game *is* does not
    // also need to be told what changed in it.
    this.delivery = this.deliveryOwed();
    this.armPostArrival();
    // Cleared rather than assumed. Phaser reuses the scene *instance* across
    // a `scene.start`, so these fields survive a child being swapped for
    // their sibling on the players screen — and `postArriving` surviving is
    // a game that comes back up permanently modal.
    this.postman = null;
    this.postGuard = null;
    this.postArriving = false;
    // `?wall`: the bricklaying parchment, on its own, before anything else.
    // A beat first, so it opens over a world that has finished drawing
    // itself rather than over a grey screen.
    if (this.dev.wall) this.time.delayedCall(50, () => this.openBrickWall(() => {}));
    // `?share=`: the division parchment on that rung, for the same reason and
    // with the same beat. Nothing else opens it yet — see `sharePopup`.
    if (this.dev.share !== null) {
      const rung = shareRungAt(this.dev.share);
      this.time.delayedCall(50, () =>
        this.sharePopup?.open(shareProblemFor(this.spellRng, rung), () => {}),
      );
    }
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
    this.lighting.lightTree();
    this.checkGrove();
    // Over the crate rather than beside it: the cloud is tapped while the
    // tray is open, and the tray closes itself before acting.
    this.thingPanel = new ThingPanel(this, uiIndex, MODAL_DEPTH + 2, this.words, (object) =>
      this.ui(object),
    );
    this.aboutPanel = new AboutPanel(this, uiIndex, MODAL_DEPTH + 2, this.words, (object) =>
      this.ui(object),
    );
    // Over the options rather than instead of them: it was opened from there
    // and closing it should put you back where you were.
    // Which face it opens on is this child's own, saved with everything else
    // about them; the heading turns it over and says so.
    this.aboutPanel.onToggleDebug = (on) => this.saveProfileChange({ debug: on });
    this.aboutPanel.controls = this.debugControls();
    this.optionsPanel.onAbout = () => this.aboutPanel?.show(() => {}, this.profile.debug);
    // The other half of the notice a parent read while the game was being
    // set up: the world lives on this device, so here is how to take it off.
    this.optionsPanel.onExport = () => exportSaves();
    this.optionsPanel.onBandChange = (band) => this.applyBand(band);
    this.optionsPanel.setBand(this.profile.band);
    this.optionsPanel.setGames(listGames(browserStore()), playingId(browserStore()));
    this.applyCropPrice();
    this.applyRung();
    this.createOptionsButton(uiIndex);
    this.createClockHud(uiIndex);
    // The coin line is written whenever money moves, and money starting in
    // the purse is not money moving: ?coins= showed nothing until the first
    // trade, and a saved purse would have done the same.

    this.setupInput();
    this.createActionBar();
    this.teacherMarks = new TeacherMarks(this, (object) => this.world(object));
    exposeForTests(this.devHandle());
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
      // Every panel and popup, not the eight that happened to be listed. A
      // popup listens on the keyboard while it is open, and a listener
      // outliving its scene fires into a destroyed display list — and the
      // list of things that listen grows with every panel added, so it is
      // built once here from everything that can be destroyed.
      for (const panel of this.panels()) panel?.destroy();
      // And him, if the world is going down while a door is open. His sprite
      // and the doorway are the scene's and go with it either way; what does
      // not is `postArriving`, which is a field on an instance that gets
      // used again.
      this.postmanAway();
    });

    // The shop's coin pad takes a coin back on right-click, so the browser's
    // own menu must not open over the parchment when it is used.
    this.input.mouse?.disableContextMenu();

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer, over: unknown[]) => {
      // The popup's backdrop covers the screen and is interactive, so `over`
      // is already non-empty while it is open. Checking anyway: a modal that
      // is only modal because of depth ordering stops being one the first
      // time something is drawn above it.
      // Sitting, lying or bathing, and a tap anywhere is how she gets up.
      // Before the modal check, because a lasting use is one — nothing else
      // may happen while she is on the chair — and this is the one tap it
      // takes. The tap is only that: whatever it landed on is not walked
      // to, planted or picked, because a child getting her off a chair has
      // not asked for anything else yet.
      if (this.rest) {
        this.standUp();
        return;
      }
      if (this.modalOpen) return;
      this.pinch.touch(pointer.id, pointer.x, pointer.y);
      // A second finger is a pinch, and a pinch is not a tap. Checked before
      // everything below it, because everything below it would answer this
      // finger with the thing it was aimed at — and a second finger landing
      // on a tree while the times rune is lit would cast the spell there.
      if (this.pinch.begin()) return;
      // A ring of choices is open over something. This very tap may be the
      // one that opened it — the thing's own handler runs before this one —
      // and that tap is let through once. Any later tap that is not on one
      // of the ring's buttons closes it and does nothing else, deliberately:
      // a child who tapped away from a question has answered *neither*, and
      // a step taken on the same tap would be an answer.
      if (this.wheel?.isOpen) {
        if (this.wheelFresh) {
          this.wheelFresh = false;
          return;
        }
        if (!this.tappedTheInterface(over)) {
          this.closeWheel();
          return;
        }
      }
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
      // The picture of what she is holding is a control, not ground: tapping
      // it turns the thing round. It is drawn in the world rather than on
      // the interface camera — it has to follow her — so it is not in
      // `uiObjects` and has to be named here. Without this the tap fell
      // straight through to the placement below and put the bench down,
      // which is a control that does the opposite of what it says.
      if (this.armed && !this.tappedTheInterface(over) && !this.tappedTheArmedThing(over)) {
        this.castArmedAt(pointer.worldX, pointer.worldY);
        return;
      }
      if (over.length > 0) return; // a UI button handles its own pointerdown
      // Nor does the finger left over from a pinch: it is halfway through a
      // gesture that was never about walking anywhere.
      if (this.pinch.leftOver) return;
      // Touch steers with the floating joystick; a mouse walks to the tile it
      // clicked. Deliberately not both on touch: a press cannot be a stick
      // and a destination at once, and the stick is the one you can hold.
      if (this.joystick) this.joystick.begin(pointer);
      else this.handleTileClick(pointer.worldX, pointer.worldY);
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      this.pinch.moved(pointer.id, pointer.x, pointer.y);
      if (this.pinch.drag()) return;
      this.joystick?.move(pointer);
    });
    // pointerupoutside fires when the finger leaves the canvas still held —
    // without it the stick would stay stuck on and the player walk forever.
    for (const event of ["pointerup", "pointerupoutside"]) {
      this.input.on(event, (pointer: Phaser.Input.Pointer) => {
        this.pinch.lifted(pointer.id);
        // However the press that opened a ring ended, it has ended: a
        // second finger that turned it into a pinch never reached the
        // handler above, and the flag must not outlive the tap it is about.
        this.wheelFresh = false;
        this.pinch.end(pointer.id);
        this.joystick?.end(pointer);
      });
    }
  }

  override update(time: number): void {
    this.chunks.tick();
    const hour = this.hourNow();
    if (!this.interior) {
      this.chunks.refreshVisibleChunks();
      this.chunks.driftWater(time);
      this.updateNpcs(isOpenHours(hour));
      // The other half of the postman's round: `updateNpcs` walks him over
      // when the player is in the village, and this opens a door when they
      // are not. See `updatePost`.
      this.updatePost();
      // Called from here rather than from inside `updateNpcs`, which returns
      // early on `?freezeNpcs` — and did so before it ever reached the
      // animals, so with that seam set their hunger clocks stopped as well as
      // their feet. Freezing a village for a screenshot should not stop time.
      this.updateAnimals(this.time.now);
      // The minute to draw is the scene's to decide, not the harbour's: it
      // is the world's clock, unless a script has asked for everything to
      // hold still. See `FROZEN_TIDE`.
      this.traffic?.sail(this.frozen ? FROZEN_TIDE : this.worldNow() / 60_000);
      this.teacherMarks?.show(
        [...this.teachersOnScreen(), ...this.woodToClear()],
        (spell) => !this.knows(spell),
      );
      this.chunks.cullScenery();
    }
    // Indoors as well as out: she is present either way, and a sorter in the
    // garden goes on dealing while she is upstairs.
    this.workMachines();
    // Indoors as well as out, which it was not.
    //
    // The rune lived inside the outdoor branch above, so a chair armed in a
    // room was never positioned at all and sat at the room's own origin,
    // over in the corner, while she walked about with nothing over her head.
    // That was survivable while it was only a *sign* — the thing it stands
    // for is in her hands either way — and stopped being survivable when it
    // became the control that turns furniture round.
    this.placeArmedRune();
    // Indoors as well as out, and for the same reason the rune above it is.
    //
    // The reach is drawn round wherever she is standing now, so it follows
    // her while she walks about choosing; and a square she has walked away
    // from is let go of, wherever she walked away from it. Both of those
    // used to sit in the outdoor branch above, which left a room the one
    // place in the game where the ring stayed on the square it was put on
    // however far she went — and where everything she did went on landing
    // there.
    if (this.armed) this.paintAim();
    this.checkAim();
    // The tint still applies indoors: it is the time of day, not the weather
    // outside a window.
    this.lighting.paintNight(nightTintAlpha(hour), this.lighting.settleDusk(time));
    // Every frame, now that there is no status line whose repaint used to
    // carry it: two setVisible calls, and it cannot fall out of step with
    // whether a panel is open.
    this.refreshOptionsButton();
    // And the clock beside it, for the same reason: it is two hands of the
    // world's own state and nothing else repaints it.
    this.refreshClockHud();
    // And the music, which is the same two facts a third time: where the
    // child is, and what hour it is. Asked every frame and answers on the
    // few where it changed — a tune is not something to work out on arrival
    // at a place, because there is no arrival, only a step that happened to
    // be over a line.
    this.followTheMusic();

    // Depth follows the sprite's own y, which is its feet — so it stays
    // correct part-way through a step rather than only at whole tiles.
    // Not while going through a portal: the traveller is held just in front
    // of the doorway's mouth for the crossing, and recomputing it from their
    // y would drop them behind it the moment they were lifted into it.
    if (!this.travelling) this.player.setDepth(this.perchDepth ?? this.player.y);
    this.showThroughWhatHidesHer();
    this.playCharacterAnim(
      this.player,
      this.playerCharacter,
      this.playerFacing,
      this.isMoving,
      this.playerGesture,
    );
    // Two loops rather than one over a spread of both: this runs every
    // frame, and the array it made to walk was thrown away every frame.
    for (const npc of this.npcs) this.animateWalker(npc);
    for (const animal of this.animals) this.animateWalker(animal);
    if (!this.interior) this.updateDoors();

    // The world keeps running behind the parchment — smoke drifts, villagers
    // wander — but nothing the player presses reaches it. Every key below is
    // one the popup wants for itself (digits, Enter, Escape) or one that
    // would walk the player out from under an open spell.
    // A direction key gets her up from a chair the way a tap does, and for
    // the same reason a tap does: pressing to walk is asking to be
    // somewhere else. She stands first; the step is hers to press again.
    if (this.rest && this.pressedDirection()) this.standUp();
    // Before the modal return, because a parchment over the screen is a
    // moment the marks have to be *put away*, not merely left where they
    // were: a glow under a sheet is a glow on the sheet.
    this.driveGuide();
    if (this.modalOpen) return;

    // The ring over a thing was opened from where she was standing, and a
    // step away from it is a change of mind.
    const opened = this.wheelOpenedAt;
    if (opened && (opened.col !== this.playerCol || opened.row !== this.playerRow)) {
      this.closeWheel();
    }

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
   *
   * And the rune over her head is a fourth of the same case. It is filed
   * under whichever layer was showing when it was raised, so a fence armed
   * in the garden and carried in through the front door had its picture left
   * outside on the hidden layer. That was a missing *sign* while the rune
   * only said something was armed; it is a missing *control* now, and a
   * child who walked indoors holding a chair would find that tapping it did
   * nothing, in the one room where turning furniture is the whole point.
   */
  private movePlayerToLayer(): void {
    const showing = this.sceneryLayer();
    for (const object of [
      this.player,
      this.patchInk,
      this.aimInk,
      this.socketInk,
      this.armedRune,
    ]) {
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

  /**
   * Answer a tap on a sprite — unless a spell is waiting for the next tap
   * on the world, in which case the sprite stands aside. One place rather
   * than nine, for the reason `pointerIsSpokenFor` is one place.
   */
  private onTap(
    sprite: Phaser.GameObjects.GameObject,
    handler: (pointer: Phaser.Input.Pointer) => void,
  ): void {
    sprite.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.pointerIsSpokenFor) return;
      handler(pointer);
    });
  }

  private tappedTheInterface(over: readonly unknown[]): boolean {
    return over.some((object) => this.uiObjects.has(object as Phaser.GameObjects.GameObject));
  }

  /**
   * Whether the tap landed on the picture of what she is holding.
   *
   * Its own question rather than a second entry in `uiObjects`: that set is
   * what the interface camera draws, and this one has to be in the world so
   * it can hang over her head as she walks.
   */
  private tappedTheArmedThing(over: readonly unknown[]): boolean {
    const rune = this.armedRune;
    return rune !== undefined && over.includes(rune);
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
    this.lighting.resize(width, height);
    for (const button of this.edgeAnchored) button.place(width, height);
    // The popup can be open across a phone rotation, and every one of its
    // pieces is placed from the viewport's size.
    this.spellPopup?.layout();
    this.countingPopup?.layout();
    this.brickPopup?.layout();
    this.sharePopup?.layout();
    this.symmetryPopup?.layout();
    this.logicPopup?.layout();
    this.portalPanel?.layout();
    this.geometryPanel?.layout();
    this.shopPanel?.layout();
    this.optionsPanel?.layout();
    this.aboutPanel?.layout();
    this.lessonPanel?.layout();
    this.introPanel?.layout();
    this.newsPanel?.layout();
    this.mapPanel?.layout();
    this.picturePanel?.layout();
    this.taskPanel?.layout();
    this.layoutHud();
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
    const progress = groveProgress(this.worldGrid, this.grove);
    this.groveDone = progress.task === GroveTask.Done;
    // Counted here rather than in the clearing spell, because the wood comes
    // down by more than one route — a square cleared, a save reloaded — and
    // this is the one place that re-reads the grove whatever did it.
    const before = this.woodStandingSeen;
    this.woodStandingSeen = progress.standing;
    if (before !== null && progress.standing < before) {
      this.noteDeed(Deed.ClearedWood);
      if (progress.standing === 0) this.noteDeed(Deed.WoodAllDown);
    }
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
      glow: this.lighting.newGlow(WINDOW_GLOW_COLOR),
    }));
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
    this.placeClockHud();
  }

  // --- Asset metadata ----------------------------------------------------

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
  private houseSheetFor(id: string, sprite: BuildingSprite): string {
    const sidecar = this.buildingSidecars.get(sprite);
    if (!varies(sprite)) return sprite;
    const options = (sidecar?.roof_options ?? []) as Ramp[];
    // Which ramp this shape repaints, which is not always the roof: the
    // store varies its *walls*, so that eight shops in one world are plainly
    // all shops and plainly not the same building. See `VARYING_SLOTS`.
    const shipped = rampOf((sidecar?.palette ?? {}) as Record<string, Rgb>, slotsFor(sprite));
    const look = houseLook(id, this.seed, options.length);
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
    registerBuildingAnimsFor(this, name, sprite, sidecar);
    return name;
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
    if (!ALL_CHARACTERS.includes(character))
      registerCharacterAnimsFor(this, character, avatar.body);
    return character;
  }

  /** Sort a villager or animal by its feet and keep its animation in step with its state. */
  private animateWalker(npc: NpcRuntime): void {
    npc.sprite.setDepth(npc.sprite.y);
    this.playCharacterAnim(npc.sprite, npc.character, npc.facing, npc.isMoving);
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
    // The sound of the spell taking hold, at the moment its picture does.
    // Here rather than at the seven places a cast is recorded, because this
    // is already the funnel for "magic landed on a square" — and the two
    // spells differ in the ear the same way they differ on screen: the plus
    // rises and the minus falls. See `world/effects.ts` on why that is not
    // arbitrary.
    sound().effect(effect === EffectType.Minus ? Sfx.SpellTake : Sfx.SpellAdd);
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
      ...this.trayShelf("seeds", 1),
    });

    this.spellTray = new IconTray(this, {
      texture: uiTextureKey(UiAsset.Spellbook),
      // Built from `SPELLS` rather than written out, so the book's order and
      // the game's cannot come apart. They did: the division rune went in
      // between the times and the hourglass, every button after it moved up
      // one, and four scenarios that tap `spellbook.4` carried on tapping the
      // fourth button while meaning the hourglass. The tap landed, the rune
      // it hit was one nobody had been taught, and a refusal looks exactly
      // like a spell that did not open.
      items: SPELLS.map((spell) => ({
        texture: uiTextureKey(RUNE_OF[spell]),
        act: () => this.cast(spell),
        // The two everybody has from their first minute are always lit; the
        // rest are drawn dimmed until somebody has taught them, rather than
        // left out — a book with a gap in it says there is something to find.
        available: () => KNOWN_FROM_THE_START.includes(spell) || this.knows(spell),
      })),
      ...this.trayShelf("spellbook", 0),
    });

    // What she is carrying, in the same shape as the two containers beside
    // it. Tapping an item states how many of it she has rather than doing
    // anything: there is nothing to spend produce on yet, and a button that
    // silently did nothing would be worse than one that answers.
    // Crops, what the world gave up, and what a press made of it: everything
    // she comes back carrying. Not everything the store buys — a beam is in
    // here and is not for sale, because the basket is what she *has* rather
    // than what she can sell, and a part she could not see would be a part
    // she could not count before walking to the coast with it.
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
      ...this.trayShelf("basket", 2),
    });

    // What she has bought and can put down. A fourth container rather than
    // more rows in the basket: six items stacked upward from the corner
    // overflow a phone held sideways, and a tray whose top row is off screen
    // is worse than one more button.
    //
    // **In two levels, because twenty buttons is a wall.** A playtest called
    // it clunky and it was: a child looking for a chair had to read past a
    // scarecrow. Tapping the crate offers three groups; tapping a group
    // shows what is in it and nothing else. See `world/crate.ts` for the
    // split, which is one the game already drew — things that go on the
    // ground outdoors and things that go on a floor indoors.
    //
    // Every button exists all the time and `shown` decides which are on the
    // tray, rather than the tray being rebuilt. A button carries a closure
    // over the thing it puts down, and rebuilding them per group would mean
    // rebuilding those on every tap.
    this.crateTray = new IconTray(this, {
      texture: uiTextureKey(UiAsset.Crate),
      cloud: uiTextureKey(UiAsset.ThoughtBubble),
      items: [
        ...CRATE_GROUPS.map((group) => ({
          texture: this.crateFace(group),
          name: group,
          shown: () => this.crateGroup === null,
          // How many things are in this group, so a group with nothing in it
          // says so before it is opened rather than after.
          count: () => thingsIn(group).reduce((sum, thing) => sum + this.crateHeld(thing), 0),
          act: () => this.openCrateGroup(group),
        })),
        ...PLACEABLE_FIXTURES.map((fixture) => ({
          texture: uiTextureKey(itemIcon(fixture)),
          name: fixture,
          // In its group, and — for a machine — only once the mechanic's
          // job before it is done. See `world/jobs.ts`.
          shown: () => this.crateGroup === groupOf(fixture) && this.crateOffers(fixture),
          count: () => this.inventory.count(fixture),
          act: () => this.armFixture(fixture),
          // A cloud on the machines, and only on the machines. They are the
          // things in here a child cannot guess by looking — a fence is a
          // fence, and a bench is for sitting on — and they are the only
          // ones with a price, since everything else in this crate was
          // bought and is simply *had*. See `TrayItem.tell`.
          tell: isMachine(fixture) ? () => this.tellAbout(fixture) : undefined,
        })),
        // Furniture goes in the crate with everything else a player puts
        // down: it is the same verb and it should live in the same place.
        // Its own picture is its icon — a bed at tray size reads as a bed,
        // and drawing a second one for the button would be two drawings to
        // keep in step.
        ...DECOR_TYPES.map((piece) => ({
          texture: growablePieceKey(GROWABLE_ROOM, pieceArt(piece)),
          name: piece,
          shown: () => this.crateGroup === groupOf(piece),
          count: () => this.decorHeld(piece),
          act: () => this.chooseDecorColour(piece),
        })),
        // And the coil, which is the one button here that is not a picture
        // of a thing she owns. There is no count on it because there is
        // nothing to count: wire costs nothing and a garden may have as much
        // of it as it has machines to join. See `CRATE_WIRE`.
        {
          texture: uiTextureKey(itemIcon(CRATE_WIRE as unknown as FixtureType)),
          name: CRATE_WIRE,
          shown: () => this.crateGroup === groupOf(CRATE_WIRE),
          count: () => 0,
          act: () => this.armWire(),
        },
      ],
      count: () =>
        PLACEABLE_FIXTURES.reduce((sum, f) => sum + this.inventory.count(f), 0) +
        DECOR_TYPES.reduce((sum, piece) => sum + this.decorHeld(piece), 0),
      // Out of a group before out of the crate. See `IconTrayOptions.back`.
      back: () => {
        if (this.crateGroup === null) return false;
        this.crateGroup = null;
        return true;
      },
      ...this.trayShelf("crate", 3),
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
      ...this.trayShelf("purse", 4),
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
    const rung = this.additionRung;
    const cast = additionCastFor(this.spellRng, rung);
    this.askSum(
      cast.problem,
      cast.given,
      (result) => {
        if (result.solved) this.growCropAt(col, row);
        this.noteCast(result);
      },
      cast.bare,
      rung,
    );
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
    const rung = this.additionRung;
    this.askSum(
      makeSubtractionProblem(this.spellRng, rung),
      rung.given,
      (result) => {
        if (result.solved) this.takeFloorUp([cell]);
        this.noteCast(result);
      },
      null,
      rung,
    );
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
  /**
   * The gate every rune opens with: nothing while a parchment is up, the
   * tray put away, and a spell she has not been taught answered with where
   * to learn it rather than cast.
   *
   * Refused with a reason, and the reason really does say where to go now
   * — it used to cross the rune out, which says no and stops. A rune that
   * did nothing at all would read as a broken button.
   */
  private spellRefused(spell: Spell, known: boolean): boolean {
    if (this.modalOpen) return true;
    this.spellTray?.setOpen(false);
    if (known) return false;
    this.showWhereToLearn(spell);
    return true;
  }

  private castArraySpell(): void {
    if (this.spellRefused(Spell.Array, this.knowsArray)) return;
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
   * Cast the sharing spell: mark a ripe patch, and pick all of it at once.
   *
   * The array spell's other end. That one ripens a patch in a cast and this
   * one picks it in a cast, and between them the only thing left to do by
   * hand in a garden is put the seed in — which is the one gesture worth
   * keeping in a child's hands.
   *
   * No menu. The times rune asks what is being multiplied because it has
   * three or four answers; this rune does one thing, and a menu of one is a
   * tap that asks a child to confirm a decision the game has already made.
   *
   * Out of doors only. A room has nothing ripe in it, and a spell that
   * opened a parchment about an empty floor would be a spell that had not
   * looked.
   */
  private castShareSpell(): void {
    if (this.spellRefused(Spell.Share, this.knowsShare)) return;
    if (this.interior) {
      this.showRefusalOnPlayer(UiAsset.RuneDivide);
      return;
    }
    if (this.marking) {
      this.stopMarking();
      return;
    }
    this.joystick?.release();
    this.beginMarking(PatchAction.Pick);
  }

  private get knowsShare(): boolean {
    return knowsSpell([...this.profile.learned, ...this.dev.learned], Spell.Share);
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
        ? [PatchAction.Plant, PatchAction.Grow, PatchAction.Clear, PatchAction.Copy]
        : [PatchAction.Plant, PatchAction.Grow, PatchAction.Clear];
    // Kept so the menu's buttons can be named for what they do. See
    // `uiPositions`.
    this.patchChoices = outdoors;
    const choices = outdoors.map((action) => ({
      action,
      rune: uiTextureKey(this.patchMenuIcon(action)),
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
    this.patchMenu?.openAt(above, choices, (action) => this.chosePatchSpell(action));
  }

  /**
   * A choice off that menu, which for one of them is not the last question.
   *
   * Everything but planting is a spell, and a spell knows what it does. What
   * *plant* does depends on a seed, and a playtest found the seed being
   * chosen behind the child's back: *the multiplication planting has no way
   * to choose the plant. It defaults to carrot — or rather to the last thing
   * you used, and if you didn't use anything it defaults to carrot, which is
   * going to be confusing.* It was, and it was worse than confusing: sixteen
   * squares of the wrong crop is the largest single mistake this game lets
   * anybody make, and nothing asked first.
   */
  private chosePatchSpell(action: string): void {
    if (action === PatchAction.Plant) {
      this.choosePatchSeed();
      return;
    }
    this.beginMarking(action as PatchAction);
  }

  /**
   * And which seed, asked in the same place with the same shape.
   *
   * The pouch is the obvious answer and is the wrong one: its buttons *arm a
   * seed for one square*, and re-teaching them a second meaning for the
   * minute the times rune is lit is how a tap comes to do two things. This
   * is the menu that was already open, asked again — the child taps the
   * spell, then taps the crop, and both questions are one row of pictures
   * over her head.
   *
   * Every crop is offered, including ones that will not grow on the ground
   * she is about to mark out. That is deliberate and it is the rule the
   * menu above already follows: the rectangle does not exist yet, so what
   * will fit in it cannot be known, and a choice that lands on nothing is
   * refused when the corners are drawn — before any sum has been asked.
   */
  private choosePatchSeed(): void {
    this.patchChoices = PLANT_TYPES;
    const choices = PLANT_TYPES.map((plant) => ({
      action: plant,
      rune: uiTextureKey(cropIcon(plant)),
    }));
    const above = this.screenOfPoint(this.player.x, this.player.y - TILE_SIZE);
    this.patchMenu?.openAt(above, choices, (chosen) => {
      // Remembered as *the* seed, the way the pouch and the number keys
      // remember it: a child who picks tomatoes here and then plants one by
      // hand should not find a carrot in her fingers.
      this.selectedPlantIndex = PLANT_TYPES.indexOf(chosen as PlantType);
      this.seedTray?.refresh();
      this.beginMarking(PatchAction.Plant);
    });
  }

  /**
   * What a choice looks like on the little menu.
   *
   * Runes, everywhere but one. The rune is the picture a child already taps
   * to cast that spell, and the same picture asking *which spell to
   * multiply* is a question they can answer without reading a word.
   *
   * Planting has no rune, because planting is not a spell — it is a tap, and
   * it costs no arithmetic at all. So its button carries the **pouch**,
   * which is the other picture a child already knows and the one they tap to
   * get at seeds.
   *
   * It carried a *crop* for a while — whichever one was last picked — and
   * that was a promise the button had no business making. A playtest read it
   * exactly as written: the seed was already decided, by the game, out of
   * whatever had last been in her hand. Now the button says only *sow
   * something*, and `choosePatchSeed` asks what.
   */
  private patchMenuIcon(action: PatchAction): string {
    if (action === PatchAction.Plant) return UiAsset.SeedPouch;
    return SPELL_RUNES[action];
  }

  private beginMarking(action: PatchAction): void {
    this.patchMenu?.close();
    // The seed, taken now and held for the whole cast.
    //
    // Not read again when the spell lands, and this is not tidiness: the
    // number keys are seed shortcuts, and answering a multiplication means
    // *typing digits*. A four-square bed asks four, so a child who typed the
    // right answer chose the fourth seed with the same keystroke and planted
    // tomatoes in the tree's beds. Found by the scenario that was written to
    // check the sunflowers went in.
    this.patchSeed = this.selectedPlant();
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
  private arm(what: Armed, texture: string, frame?: number, mirrored = false): void {
    if (this.modalOpen) return;
    this.closeTrays();
    // One thing waiting at a time. Arming a seed while the array spell is
    // out for a corner would leave two things wanting the same tap.
    this.stopMarking();
    const same = armedTag(this.armed) === armedTag(what);
    this.disarm();
    if (same) return;
    this.armed = what;
    this.noteArmed(what);
    // Lifted. Its answer is in `placeFixture`, and the two sounds are each
    // other reversed for the same reason planting and picking are.
    sound().effect(Sfx.PickUp);
    // A stick still held when the rune lights never sends its release, and
    // she walks on while the ground she is choosing from slides away.
    this.joystick?.release();
    this.raiseArmedRune(texture, frame, mirrored);
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
      else if (held.spell === Spell.Logic) this.logicCastAt(at);
      else this.clearingCastAt(at);
      return;
    }
    // Everything else goes in the ground, and everything that goes in the
    // ground already works on `targetTile` — the square she has pointed at,
    // or the one she is facing if she has not. So putting a thing down on a
    // tapped square is *pointing at it first*, and none of the four routes
    // below has to know this happened.
    //
    // And pointed at it for the placement only: whatever she was pointing at
    // before is put back afterwards. Left on the square she has just built
    // on, it is the aim the *next* thing she does lands on — which is the
    // thing `checkGrowth` refuses to do to a spell, in the same words: a
    // spell asks where once, and leaving the answer in `aim` would send the
    // next seed she plants to the tile she last cast on.
    //
    // On a phone what is put back is nothing at all, and that is the half of
    // this that a playtest found. `handleTileClick` is the only thing that
    // ever sets an aim on purpose and touch never reaches it — a press there
    // is the joystick — so the ring left behind by a fence was a ring a
    // child had no way to put out except by walking four squares away from
    // it. *The targeting tile got stuck.*
    const pointing = this.session.aimed;
    this.session.aimAt(at);
    if (held.kind === "wire") this.stringWireAt(held, at);
    else if (held.kind === "plan") this.stampPlanAt(held.from, at);
    else if (held.kind === "seed") this.plantSeed(held.plant);
    // The turn is handed over rather than read back off `this.armed`: the
    // rune is put out a few lines above this, so by the time anything is
    // placed there is nothing in her hands to ask.
    else if (held.kind === "fixture") this.placeFixture(held.fixture, turnFrom(held.turn));
    else if (held.kind === "decor") this.putDecorDown(held.piece, held.look, held.turn);
    else if (held.kind === "flower") this.putFlowerDown(held.flower, held.look);
    this.session.aimAt(pointing);
    this.paintAim();
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
      { action: PatchAction.Plant, cells: this.session.plantableIn(this.patchSeed, patch) },
      { action: PatchAction.Grow, cells: this.session.growableIn(patch) },
      {
        action: PatchAction.Clear,
        // The ground's things and the machines standing on it, which are two
        // lists because they are taken back two different ways — see
        // `machinesIn`. A rectangle holding nothing but machines used to
        // count as an empty one, so the rune was refused before it was cast.
        cells: [
          ...this.session.clearableIn(patch),
          ...this.machinesIn(patch).map((standing) => standing.at),
        ],
      },
      { action: PatchAction.Pick, cells: this.session.pickableIn(patch) },
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

  /**
   * The machines standing in a marked patch.
   *
   * Reported from a playtest: *why wasn't I able to use multiplication with
   * minus to pick up three machines?* Because the patch's minus knew about
   * trees and crops and nothing else — `clearableIn` asks the grid for
   * scenery or a crop and a sorter is neither — while a *tap* with the same
   * rune has taken a machine back since the day machines were placeable.
   * One rune, one garden, two answers, and which one you got depended on
   * whether the times spell had drawn a box first.
   *
   * Kept in the scene rather than beside `clearableIn` in the session,
   * because taking a machine back is not a thing the grid can do on its own:
   * what is inside it goes to the basket, its sprite has to go, and the
   * sockets have to be repainted. The session owns the ground; this owns
   * everything standing on it that is more than a picture.
   */
  private machinesIn(patch: Patch): { at: GridPoint; fixture: FixtureType }[] {
    if (this.interior) return [];
    const standing: { at: GridPoint; fixture: FixtureType }[] = [];
    for (const at of patchCells(patch)) {
      const object = this.grid.getObjectAt(at.col, at.row);
      const fixture = object ? fixtureFor(object.type) : null;
      // Its own square only. A machine is one tile, but a *footprint* that
      // straddled the edge of the patch would otherwise be lifted by a
      // rectangle that only covers half of it.
      if (!fixture || !isMachine(fixture)) continue;
      if (object && (object.col !== at.col || object.row !== at.row)) continue;
      standing.push({ at, fixture });
    }
    return standing;
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
    // The sharing spell asks its own question about the patch rather than a
    // multiplication, so it does not go round this loop at all: there is no
    // "do it once by hand and then say how many times" to do, because
    // picking a heap *is* the one thing, and what division asks is how it
    // divides up.
    if (action === PatchAction.Pick) {
      this.askTheShare(patch);
      return;
    }
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
    // Planting is not a spell and has no sum in it — by hand it is a tap on
    // a square. So there is nothing to do once by hand before doing it many
    // times, and the whole price of a planted rectangle is the
    // multiplication that follows. That is the argument for multiplication
    // as plainly as this game can make it: sixteen squares for one answer.
    if (action === PatchAction.Plant) {
      done(true);
      return;
    }
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
    const rung = this.additionRung;
    // The clearing spell keeps its number line at every rung. It shares this
    // ladder — the same instrument walked the other way — but taking the
    // line off a subtraction is a separate decision about a separate spell,
    // and nobody has asked for it.
    const cast: AdditionCast =
      action === PatchAction.Grow
        ? additionCastFor(this.spellRng, rung)
        : { problem: makeSubtractionProblem(this.spellRng, rung), given: rung.given, bare: null };
    this.askSum(
      cast.problem,
      cast.given,
      (result) => {
        this.noteCast(result);
        done(result.solved);
      },
      cast.bare,
      rung,
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
  private askTheMultiplication(patch: Patch, action: PatchAction): void {
    const rung = arrayRungAt(this.ladders.held("arrayRung"));
    const problem = arrayProblemFor(patch.height, patch.width, rung);
    this.arrayPopup?.open(problem, (result) => {
      // The marker goes away *first*: it clears the message line on its way
      // out, so putting it after the cast wiped the one line saying what the
      // cast had just done.
      this.stopMarking();
      if (result.solved) this.applyToPatch(patch, action);
      this.ladders.note("arrayRung", result);
    });
  }

  /**
   * The share the marked patch asks, and what picking it does.
   *
   * The numbers are the ladder's rather than the patch's, and that is the
   * one place this parts company with the multiplication above. A rectangle
   * *is* the shape multiplication draws, so the array spell takes its
   * numbers from the ground; a share is not a shape, and there is nothing on
   * the ground that says "into five". See `division.ts`.
   */
  private askTheShare(patch: Patch): void {
    const rung = shareRungAt(this.ladders.held("shareRung"));
    this.sharePopup?.open(shareProblemFor(this.spellRng, rung), (result) => {
      // The marker first, for the reason the array's goes first.
      this.stopMarking();
      if (result.solved) this.applyToPatch(patch, PatchAction.Pick);
      this.ladders.note("shareRung", result);
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
    } else if (action === PatchAction.Plant) {
      // The seed she chose when she chose the spell, not the one selected
      // now — answering the multiplication types digits, and digits are seed
      // shortcuts. See `beginMarking`.
      const seed = this.patchSeed;
      for (const at of this.session.plantableIn(seed, patch)) {
        this.plantCropAt(seed, at.col, at.row);
        done++;
      }
      if (done > 0) {
        // One bend of the back for the lot of them, where a single seed gets
        // one for itself. Sixteen gestures in a frame is a seizure.
        this.playGesture(PLANT);
        // And one sound, on the same argument.
        sound().effect(Sfx.Seed);
        this.autosave();
      }
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
      // And the machines, at the patch's own reach rather than a pointing
      // one: she drew the rectangle round them, and the rectangle is how far
      // this spell asks. The trees beside them are cleared on the same
      // terms.
      const machines = this.machinesIn(patch);
      for (const { at, fixture } of machines) {
        this.takeMachineBack(fixture, at.col, at.row, anywhereInThePatch, false);
        done++;
      }
      // Once for the lot of them. See `takeMachineBack`'s last argument.
      if (machines.length > 0) this.autosave();
    } else if (action === PatchAction.Pick) {
      for (const at of this.session.pickableIn(patch)) {
        this.pickCropAt(at.col, at.row);
        done++;
      }
      // One for the lot, as with the seeds above.
      if (done > 0) sound().effect(Sfx.Harvest);
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
    // Planting a whole patch at once is the times spell doing the thing it
    // was given for. Only planting: the same marking is used to clear, to
    // grow and to build, and none of those is the sum the tree paid for.
    if (action === PatchAction.Plant && done > 0) this.noteDeed(Deed.CastArray);
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
    if (this.spellRefused(Spell.Portal, this.knowsPortal)) return;
    if (this.interior) {
      this.showRefusalOnPlayer();
      return;
    }
    this.joystick?.release();
    const at = this.session.tile;
    // `?reached=` is a dev seam, and it adds rather than replaces: a script
    // asking for the harbour should still be able to go home.
    //
    // And on the gentlest band, everywhere is open whether she has walked
    // there or not — see `opensEveryPlace`. The walk is the right price for a
    // child who can take it and a dead end for the one who cannot, and what
    // is behind it is not arithmetic, it is an afternoon on an arrow key.
    const reached = bandAt(this.profile.band).opensEveryPlace
      ? markedPlaces(this.anchors).map(({ id }) => id)
      : [...this.profile.reached, ...this.dev.reached];
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
      ruleAt(portalRungAt(this.ladders.held("portalRung")), this.spellRng),
      (result, journey) => {
        if (journey) this.travelThrough(journey);
        this.ladders.note("portalRung", result);
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
    sound().effect(Sfx.Portal);
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
    this.chunks.refreshVisibleChunks(feet);
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
    this.chunks.refreshVisibleChunks(feet);
    this.player.setPosition(this.portalMiddle.x, this.portalMiddle.y);
    this.tweens.add({
      targets: this.player,
      x: feet.x,
      y: feet.y,
      scale: 1,
      alpha: 1,
      duration: PORTAL_EXIT_MS,
      ease: "Cubic.easeOut",
      onUpdate: () => this.chunks.refreshVisibleChunks(),
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
    this.chunks.paintTiles(
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
    return this.debugHour ?? this.dev.hour ?? timeOfDay(new Date(this.worldNow()));
  }

  /**
   * Wind the world's clock on, and remember that it moved.
   *
   * Forward only, which is the spell's own rule rather than a guard: a face
   * shows twelve hours, so "put the hands there" always means the next time
   * it will be.
   */
  private windClockTo(face: ClockTime, over: number, asked: number): void {
    sound().effect(Sfx.Machine);
    const now = new Date(this.worldNow());
    // Where the world stands on a twelve-hour face, to the minute — not to
    // whatever the rung rounds to. The child answered about two rounded
    // faces; the world lands exactly on the one she pointed at, which is the
    // difference between "the clock says twenty past" and "the clock says
    // twenty past, give or take the rounding nobody told her about".
    const standing = (now.getHours() * 60 + now.getMinutes()) % 720;
    const round = (face.hour * 60 + face.minute - standing + 720) % 720;
    // A face cannot say twelve hours: hands taken all the way round point at
    // the time they started from, so landing on them is a move of nothing.
    // `asked` is what the child actually answered, and it is the only thing
    // that can tell that apart from hands nobody touched.
    const forward = round === 0 && asked >= FULL_CIRCLE ? FULL_CIRCLE : round;
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
    if (this.spellRefused(Spell.Hourglass, this.knowsHourglass)) return;
    // No other gate, and there used to be three: something must have been
    // planted, the child must have been away, and long enough for the glass
    // to have anything to give. All three served a payout that is gone, and
    // between them they made the spell almost uncastable — a child who had
    // just sat down could never see it work.
    const rung = clockRungAt(this.ladders.held("clockRung"));
    this.joystick?.release();
    const from = readClock(this.worldNow(), rung.reading);
    this.clockPopup?.open(from, rung, (result, to, minutes) => {
      if (result.solved && to) this.windClockTo(to, sandFor(minutes), minutes);
      this.ladders.note("clockRung", result);
    });
  }

  private get knowsLogic(): boolean {
    return knowsSpell([...this.profile.learned, ...this.dev.learned], Spell.Logic);
  }

  /**
   * The logic spell: lit over her head, and cast at a machine that decides.
   *
   * Its job in the world is waking the gates — the press, the funnel and
   * the bell — so the rune arms like every other and the next tap says
   * which machine. Cast at anything else it is refused on the square, the
   * way a seed is refused on stone: there is nothing there for it to do.
   * Tapping a sleeping gate directly asks the same parchment, so the rune
   * is the long way round on purpose; it is there so the spellbook says
   * the spell exists, and so a child who learned it in the garage can find
   * it again without first finding a machine.
   */
  private castLogicSpell(): void {
    if (this.spellRefused(Spell.Logic, this.knowsLogic)) return;
    this.armSpell(Spell.Logic, UiAsset.RuneLogic);
  }

  private logicCastAt(at: GridPoint): void {
    if (this.modalOpen) return;
    const key = tileKey(at.col, at.row);
    const machine = this.machineAt(key);
    if (!machine || SPARK[machine] !== Spell.Logic) {
      this.markRefusal(at.col, at.row);
      return;
    }
    const state = this.machines.get(key) ?? newMachine();
    if (state.awake) {
      // Already awake: nothing to do, and a rune that did nothing would
      // read as broken. The machine's own tap is what empties or fills it.
      this.showResult(UiAsset.MarkYes, at.col, at.row);
      return;
    }
    this.showTheSum(key, state, machine);
  }

  /**
   * The mechanic, behind her bench, and the spell she hands over.
   *
   * Taught for being spoken to, like the clockmaker's and the fisherman's:
   * what the logic spell costs a child is the walk to the city and finding
   * the one building in it with a cog on the wall. And then the parchment
   * opens, because somebody who says hello and nothing else reads as
   * broken — talking to her *is* casting it, on nothing, which is the one
   * cast of this spell that wakes no machine and is the lesson.
   */
  private meetMechanic(): void {
    if (this.modalOpen) return;
    this.joystick?.release();
    this.closeTrays();
    const learned = learnSpell(this.profile.learned, Spell.Logic);
    if (learned === this.profile.learned) {
      // Taught already: what she has is a job. The lesson is still there,
      // under the rune in the spellbook.
      this.showJobs();
      return;
    }
    this.saveProfileChange({ learned });
    this.spellTray?.refresh();
    this.showEarned(UiAsset.RuneLogic);
    this.time.delayedCall(EARNED_MS, () => this.openLogicLesson());
  }

  /** The parchment on its own, as a lesson: nothing is woken by it. */
  private openLogicLesson(): void {
    if (this.modalOpen) return;
    const rung = logicRungAt(this.ladders.held("logicRung"));
    this.logicPopup?.open(this.spellRng, rung, (result) => {
      this.ladders.note("logicRung", result);
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
      this.showWhereToLearn(Spell.Mirror);
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
    const rung = symmetryRungAt(this.ladders.held("symmetryRung"));
    this.symmetryPopup?.open(this.spellRng, rung, (result) => {
      this.ladders.note("symmetryRung", result);
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
    this.chunks.forgetGround(range, this.worldGrid);
  }

  /** Whether this child has climbed to the dome and been taught. */
  private get knowsMirror(): boolean {
    return knowsSpell([...this.profile.learned, ...this.dev.learned], Spell.Mirror);
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
    const rung = brickRungAt(this.ladders.held("brickRung"));
    this.joystick?.release();
    this.brickPopup?.open(makeBrickProblem(this.spellRng, rung), rung, (result) => {
      if (result.solved) onBuilt();
      this.ladders.note("brickRung", result);
    });
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

    // And out of doors it takes a machine back, for exactly the same reason.
    // Tapping a machine is how it is *used* — woken, filled, emptied — so a
    // machine cannot also be picked up by tapping it, and putting one down
    // had no undo at all. This is the rune that undoes things, and it is
    // already how a crop comes back out of the ground it was dropped on.
    if (this.unmakeMachineAt(at)) return;

    const target = this.session.checkClearing(at);
    if (!target.ok || !target.tile) {
      this.report(target);
      return;
    }
    const { col, row } = target.tile;
    this.joystick?.release();
    const rung = this.additionRung;
    this.askSum(
      makeSubtractionProblem(this.spellRng, rung),
      rung.given,
      (result) => {
        if (result.solved) this.clearAt(col, row);
        this.noteCast(result);
      },
      null,
      rung,
    );
  }

  /**
   * Take a machine back, and everything that was inside it.
   *
   * Costs the same subtraction the rune always costs — a machine is not
   * exempt from the spell that unmakes things, and a free undo would be the
   * one action in the garden that asked nothing.
   *
   * **Nothing in it is destroyed.** The heap in the mouth and every crate
   * come back to the basket along with the machine, because everything in
   * there was put there by casting: a sorter that ate a child's wood when it
   * was moved would be punishing them for changing their mind about where a
   * thing stands.
   */
  private unmakeMachineAt(at: GridPoint): boolean {
    const object = this.grid.getObjectAt(at.col, at.row);
    const fixture = object ? fixtureFor(object.type) : null;
    if (!fixture || !isMachine(fixture)) return false;
    if (!withinReach(this.session.tile, at)) {
      this.markTooFar(at.col, at.row);
      return true;
    }
    this.joystick?.release();
    const rung = this.additionRung;
    this.askSum(
      makeSubtractionProblem(this.spellRng, rung),
      rung.given,
      (result) => {
        if (result.solved) this.takeMachineBack(fixture, at.col, at.row);
        this.noteCast(result);
      },
      null,
      rung,
    );
    return true;
  }

  private takeMachineBack(
    fixture: FixtureType,
    col: number,
    row: number,
    near: (from: GridPoint, at: GridPoint) => boolean = withinReach,
    /**
     * Whether to write the world down afterwards.
     *
     * A tap takes one machine and should be saved the moment it is taken. A
     * patch can hold a hundred squares, and a hundred autosaves in one frame
     * is a hundred walks of the whole world diff to record one cast — so the
     * loop saves once, at the end, when it knows what it took.
     */
    save = true,
  ): void {
    const key = tileKey(col, row);
    const state = this.machines.get(key);
    // Emptied before it is lifted, so that a `takeBack` which refuses — she
    // stepped away while the parchment was open — leaves the machine
    // standing there with its contents still in it.
    // Taken back at the reach of whatever asked for it, and there are two
    // askers. A tap on it is a spell's reach — the rune was lit and the
    // square was tapped, and the tap was accepted anywhere inside the ring
    // drawn on the grass, so anything narrower here is a sum answered for
    // nothing. A patch is the patch's own, which is further; see
    // `anywhereInThePatch`.
    const result = this.session.takeBack(fixture, col, row, near);
    this.report(result, itemIcon(fixture));
    if (!result.ok) return;
    if (state?.holding) {
      const back = state.heap + state.crates.reduce((all, count) => all + count, 0);
      if (back > 0) this.inventory.add(state.holding, back);
    }
    this.machines.delete(key);
    this.drawings.delete(key);
    this.placedFixtures.get(key)?.destroy();
    this.placedFixtures.delete(key);
    this.refreshCarried();
    this.paintSockets();
    if (save) this.autosave();
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
    // Its chunk's bucket has to forget it too, or it would grow again the
    // moment the player walked away and returned — see `fellScenery`.
    this.chunks.fellScenery(object);
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
   * Let the addition ladder see how a cast went — see `Ladders`, which is
   * the whole of the adaptation. The one ladder with something to redraw
   * when it moves: the lesson's number line is cut to this rung.
   */
  private noteCast(result: CastResult): void {
    if (this.ladders.note("rung", result)) this.applyRung();
  }

  /** The addition rung the sums come from: the dev seam's while `?rung=` holds one, else the child's. */
  private get additionRung(): Rung {
    return rungAt(this.ladders.held("rung"));
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
   *
   * `plant` is supplied only by planting, and only so that ground it will
   * not take can be answered with the ground it *will*. The icon cannot
   * stand in for it: a picture of a carrot says which seed was refused, and
   * the question a refused seed raises is where to take it instead.
   */
  private report(result: ActionResult, icon?: string, plant?: PlantType): void {
    // A knock, and only a knock. This is the funnel every refusal in the
    // game arrives at, which makes it the one place a "wrong!" buzzer would
    // ever have been wired — so it is worth saying here that it is not one
    // on purpose. The sound says *not there*: the square is taken, the
    // basket is empty, she is too far away. None of those is a child being
    // wrong at arithmetic, and this game has no sound for that at all.
    if (!result.ok) sound().effect(Sfx.Refuse);
    if (result.ok) {
      if (icon && result.tile) this.showResult(icon, result.tile.col, result.tile.row);
      return;
    }
    if (result.outcome === Outcome.NoneLeft || result.outcome === Outcome.Indoors) {
      this.showRefusalOnPlayer(result.outcome === Outcome.NoneLeft ? icon : undefined);
      return;
    }
    // The ground will not take this crop, which is the one refusal that is
    // about *where she is standing* rather than about the square. A cactus
    // wants sand; the answer is a walk, not a different tap. So it is asked
    // as a question over her head rather than crossed out on the square.
    if (result.outcome === Outcome.WrongGround && plant) {
      this.showWonderOnPlayer(plant);
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
    this.showThoughtOnPlayer(
      icons.map((ui) => ({ ui })),
      true,
    );
  }

  /**
   * And the same cloud without a cross, for a refusal that is a *question*.
   *
   * The two are not the same message and should not look the same. A cross
   * means no: you have not got the stone, and no amount of trying here will
   * change that. A crop the ground will not take is a different thing —
   * carrots are fine, this ground is not, and somewhere a few steps away is.
   * So the cloud holds the seed and a question mark, which is exactly the
   * sentence the animals already use to ask for something, and a child who
   * has fed a chicken has read it before.
   *
   * Reported over her head rather than as a cross on the square, which is
   * where it used to go. `report`'s own rule decides that: a refusal she
   * fixes by *moving* belongs over her, and this is the one refusal in the
   * game whose answer is "try it somewhere else".
   */
  /**
   * Where to go and find a spell nobody has taught her yet.
   *
   * A crossed-out rune says no and stops, which for a child who cannot read
   * is a button that does not work. This says where instead: the tower, the
   * great tree, the beacon, the town clock, the dome — whichever is the
   * thing you can see from outside and walk at. See `TAUGHT_BESIDE`, and see
   * there why it is a building rather than a region.
   *
   * Falls back to the crossed-out rune when a spell has no sight named for
   * it. A unit test says that cannot happen; a refusal that silently drew
   * nothing would be worse than the one this replaces.
   */
  private showWhereToLearn(spell: Spell): void {
    const sight = TAUGHT_BESIDE[spell];
    const seen = sight ? this.sightOf(sight) : null;
    if (!seen) {
      this.showRefusalOnPlayer(RUNE_OF[spell]);
      return;
    }
    this.showThoughtOnPlayer([seen, { ui: UiAsset.MarkQuestion }], false);
  }

  /** The sheet a named building or landmark is drawn from, if it is loaded. */
  private sightOf(sight: string): Thought | null {
    const landmark = landmarkFor(sight);
    const sheet = landmark
      ? landmarkSheetKey(landmark)
      : ROLE_SPRITES[sight as BuildingRole]
        ? spriteSheetKey(ROLE_SPRITES[sight as BuildingRole])
        : null;
    if (!sheet || !this.textures.exists(sheet)) return null;
    return { sheet, tag: sight };
  }

  /**
   * And what a flower she has not found yet looks like where it grows.
   *
   * The pouch button is a picture drawn *for* the pouch; this is a frame of
   * the flower's own sheet, which is what she will walk past in the grass. A
   * refusal that showed the button again would be showing her the thing she
   * had just tapped.
   */
  private showWhereToFind(flower: FlowerType): void {
    const sheet = flowerSheetKey(flower);
    if (!this.textures.exists(sheet)) {
      this.showRefusalOnPlayer(flowerIcon(flower));
      return;
    }
    this.showThoughtOnPlayer(
      [{ sheet, frame: 0, tag: flower }, { ui: UiAsset.MarkQuestion }],
      false,
    );
  }

  private showWonderOnPlayer(plant: PlantType): void {
    this.showThoughtOnPlayer(
      [...groundFor(plant).map((ground) => ({ ground })), { ui: UiAsset.MarkQuestion }],
      false,
    );
  }

  private showThoughtOnPlayer(icons: readonly Thought[], crossed: boolean): void {
    this.lastThought = { icons: icons.map(thoughtTag), crossed };
    // Centred over her, the way an animal's cloud is centred over the animal.
    // The cloud is drawn from its bottom-left, so without the half-width it
    // hangs off her right shoulder — which nobody had noticed because it is
    // gone again in under a second.
    const x = this.player.x - BUBBLE_W / 2;
    const y = this.player.y - TILE_SIZE - BUBBLE_H / 2;
    // Shrunk to fit rather than fixed at `BUBBLE_SLOT`.
    //
    // Two full-size slots are all the cloud's interior holds, which was
    // enough while everything shown in one was a pair. A crop that grows on
    // two kinds of ground wants three — both grounds and the question — and
    // a third slot at full size runs out through the side of the cloud.
    const gaps = Math.max(0, icons.length - 1) * BUBBLE_SLOT_GAP;
    const slot = Math.min(BUBBLE_SLOT, Math.floor((BUBBLE_INNER_W - gaps) / icons.length));
    const span = icons.length * slot + gaps;
    const left = BUBBLE_INNER_X + (BUBBLE_INNER_W - span) / 2;
    const middle = -BUBBLE_H + BUBBLE_INNER_Y + BUBBLE_INNER_H / 2;
    const cloud = this.add.image(0, 0, uiTextureKey(UiAsset.ThoughtBubble)).setOrigin(0, 1);
    const drawn = icons.map((icon, at) => {
      const cx = left + at * (slot + BUBBLE_SLOT_GAP) + slot / 2;
      // A square of ground is a frame of the terrain atlas rather than a
      // picture drawn for the interface: there is no icon of "sand" and
      // there should not be one, because the thing a child has to go and
      // find is the ground itself and a stylised version of it would be a
      // second drawing to keep in step with the first.
      const image =
        "ground" in icon
          ? this.add.image(cx, middle, TERRAIN_ATLAS_KEY, plainTerrainFrame(icon.ground))
          : "sheet" in icon
            ? this.add.image(cx, middle, icon.sheet, icon.frame ?? 0)
            : this.add.image(cx, middle, uiTextureKey(icon.ui));
      // Kept in proportion rather than squashed into a square. A tower is
      // four times taller than it is wide and a lighthouse more, and forced
      // to a square slot the two become grey blocks a child cannot tell
      // apart — what identifies a building at this size is its outline.
      const wide = image.width >= image.height;
      return image.setDisplaySize(
        wide ? slot : (slot * image.width) / image.height,
        wide ? (slot * image.height) / image.width : slot,
      );
    });
    // And the cross, beside the cloud rather than over it. Over the top it
    // would hide the half that says *which* things are wanted, which is the
    // only part a child who cannot read the word "stone" can use.
    const parts: Phaser.GameObjects.GameObject[] = [];
    if (crossed) {
      const half = RESULT_ICON * 0.4;
      const mark = this.add.graphics().setPosition(-half * 1.6, -BUBBLE_H / 2);
      mark.lineStyle(3, REFUSAL_COLOR, 1);
      mark.lineBetween(-half, -half, half, half);
      mark.lineBetween(half, -half, -half, half);
      parts.push(mark);
    }

    const shown = this.world(
      this.add.container(x, y, [...parts, cloud, ...drawn]).setDepth(this.player.depth + 1),
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
  private raiseArmedRune(texture: string, frame?: number, mirrored = false): void {
    this.armedRune?.destroy();
    const rune = this.world(
      this.add.image(0, 0, texture, frame).setDisplaySize(RESULT_ICON, RESULT_ICON),
    );
    rune.setFlipX(mirrored);
    // Tap it to turn what it is a picture of. Interactive whatever is held,
    // because a tap that did nothing on a fence and something on a bench
    // would be a control a child could only find by accident on one of them
    // — `turnArmed` refuses the ones that cannot turn.
    rune.setInteractive({ useHandCursor: true });
    rune.on("pointerdown", () => this.turnArmed());
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
    // Over her head, but never off the top of the screen.
    //
    // It hung a tile and a half above her and that was fine while it was
    // only a *sign* that something was armed — a sign you cannot see is a
    // sign you do not need, because the thing it stands for is still in your
    // hands. It is a control now: tapping it turns what she is holding. A
    // control that leaves the screen when she stands against the far wall is
    // a control a child cannot use in half the room, and indoors, where the
    // camera frames the room exactly, standing against the far wall is where
    // furniture goes.
    const view = this.cameras.main.worldView;
    const above = this.player.y - TILE_SIZE - RESULT_ICON / 2;
    const lowest = view.y + RESULT_ICON;
    rune.setPosition(this.player.x, Math.max(above, lowest));
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
  private floatMark(icon: string): boolean {
    // One at a time, and the second one is refused rather than replaced.
    //
    // Reported from a playtest as *the moon comes up many times*. Leaning on
    // a key at a shut door is not one refusal: `tryMove` runs once per step
    // for as long as the key is held, and each one used to put another moon
    // over her head — half a dozen of them rising in a column, which reads
    // as something having gone wrong rather than as the reason the door will
    // not open.
    //
    // Refused rather than restarted, because a mark whose tween is reset
    // every step never rises and never fades: it hangs over her head for as
    // long as she leans on the door, which is a worse picture than the stack
    // it would be fixing.
    if (this.floatingMark) return false;
    const mark = this.world(
      this.add
        .image(this.player.x, this.player.y - TILE_SIZE, uiTextureKey(icon))
        .setDisplaySize(RESULT_ICON, RESULT_ICON)
        .setDepth(this.player.depth + 1),
    );
    this.floatingMark = mark;
    this.tweens.add({
      targets: mark,
      y: mark.y - RESULT_RISE,
      alpha: 0,
      duration: EARNED_MS,
      ease: "Quad.easeOut",
      onComplete: () => {
        mark.destroy();
        if (this.floatingMark === mark) this.floatingMark = undefined;
      },
    });
    return true;
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
    this.noteDeed(result.crop.stage === HARVEST_STAGE ? Deed.Ripened : Deed.Grew);
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
    this.onTap(sprite, () => {
      // In any direction, diagonals included — unlike harvesting, which
      // measures orthogonally because it acts on the tile the player faces
      // and there is no diagonal facing to turn to. Talking to someone needs
      // no facing, so standing at her corner is standing next to her. How
      // far is `SPEAK_REACH`, and why it is two rather than one is written
      // there: everybody worth talking to is walking about while you aim.
      if (!withinSpeaking(this.session.tile, at())) {
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
   *
   * Only wired up for the thing that answers. See where this is called from.
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
    this.onTap(sprite, (pointer) => {
      const near = sidecar.blocked_cells_relative_to_anchor.reduce(
        (best, [row, col]) =>
          Math.min(
            best,
            stepsToSpeak(this.session.tile, { col: object.col + col, row: object.row + row }),
          ),
        Number.POSITIVE_INFINITY,
      );
      if (near > SPEAK_REACH) {
        // Out of reach, so this was not a tap on the tree at all — the crown
        // covers four tiles of ground above the trunk, and a click up there
        // is a click on the clearing behind it. Handed on rather than
        // refused, because the scene's own handler gives up the moment
        // anything interactive is under the pointer, and a red cross where a
        // child meant to walk is the beacon's bug in another wood.
        this.handleTileClick(pointer.worldX, pointer.worldY);
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
  private openIntro(onClose: () => void = () => {}): void {
    if (this.modalOpen) return;
    this.delivery = null;
    this.joystick?.release();
    this.closeTrays();
    // **And that is all it does.** Asking him again used to forget every
    // guide, so the whole tutorial came round with the welcome — which reads
    // well as "show me again" and reads terribly as what actually happened:
    // he stands in the village on the way to the shop, a child walking past
    // taps him because he is there, and an errand she was halfway through
    // started over. A tutorial anyone can restart by accident is worse than
    // one nobody can restart at all.
    this.rememberIntroSeen();
    // No greeting. The panel he opens is the greeting.
    this.introPanel?.open_(onClose);
  }

  /**
   * What he still owes this child, asked once at load.
   *
   * `?intro` and `?news` ask for one again without clearing the save, which
   * is the same seam-rather-than-reaching-in argument every other dev hook
   * makes: the alternative is editing local storage from outside to see the
   * thing twice.
   */
  private deliveryOwed(): Delivery | null {
    // The seams first, and each meaning only itself. Asked the other way
    // round — what is owed, then what was typed — `?news` was answered with
    // the *welcome* on any save that had not had one yet, which is every
    // save a script starts from: the letter could not be reached from a
    // script at all, and the scenario that thought it was testing one
    // passed on the other.
    if (this.dev.intro) return Delivery.Welcome;
    if (this.dev.news) return Delivery.News;
    // And then what he actually owes. The welcome outranks the letter, and
    // giving it settles both — see `rememberIntroSeen`.
    if (!this.profile.introSeen) return Delivery.Welcome;
    if (this.profile.newsSeen < NEWS_BEATS.length) return Delivery.News;
    return null;
  }

  /**
   * Whichever of the two he has, and the welcome if he has neither.
   *
   * The fallback is what a tap on him does once everything is delivered: he
   * is the man who explained the game, so asking him again gets the
   * explanation. Asking him again for *news* he has already given would be a
   * blank sheet.
   */
  private openDelivery(onClose: () => void = () => {}): void {
    if (this.delivery === Delivery.News) this.openNews(onClose);
    else this.openIntro(onClose);
  }

  /**
   * The letter: what has changed since this child last played.
   *
   * Cut to them before it is opened rather than after — `setSince` decides
   * which pages there are, and `rememberNewsSeen` moves the count past them,
   * so the order of these two lines is the whole difference between a child
   * seeing the beats they are owed and seeing none.
   */
  private openNews(onClose: () => void = () => {}): void {
    if (this.modalOpen) return;
    this.delivery = null;
    this.joystick?.release();
    this.closeTrays();
    // `?news` shows the whole list. Cutting it to the count would hand a
    // developer who has already read everything a sheet with no pages on it
    // — `deck()` returns nothing, `open_` takes its first entry, and what
    // renders is a blank piece of parchment — which is a seam that answers
    // "show me the letter" with silence.
    this.newsPanel?.setSince(this.dev.news ? 0 : this.profile.newsSeen);
    this.rememberNewsSeen();
    this.newsPanel?.open_(onClose);
  }

  /**
   * Note that the news has been read, to the end of the list as it stands.
   *
   * Marked on the way *in*, for the reason the welcome is: a child who shuts
   * it halfway has still been handed it, and bringing the same letter back
   * next time would read as the game not having noticed.
   */
  private rememberNewsSeen(): void {
    if (this.profile.newsSeen >= NEWS_BEATS.length) return;
    this.saveProfileChange({ newsSeen: NEWS_BEATS.length });
  }

  /**
   * One frame of the guide: start or advance it, and draw what it points at.
   *
   * Every frame, because both halves move every frame — the arrow bobs, the
   * ring breathes, and the thing under the arrow may be walking. The world
   * is looked at less often than that; see `guideWorld`.
   */
  private driveGuide(): void {
    const guide = this.guide;
    const marks = this.guideMarks;
    if (!guide || !marks) return;
    guide.tick(this.guideWorld(), this.guideView());
    const cue = guide.cue();
    // A panel over the world hides almost everything a guide points at, so
    // for a long time it switched the guide off outright. That is right for
    // an arrow over a square nobody can see and wrong for the counter: the
    // sale happens *inside* a panel, and a child in front of a page of
    // prices she cannot read is exactly who the guide is for.
    //
    // So the rule is narrower than "no modals". While one is open the only
    // cues drawn are the ones the open panel itself publishes positions
    // for — see `ShopPanel.buttonPositions` — which keeps a stale glow off
    // a lesson that happens to open over a half-finished errand.
    if (this.modalOpen && !(cue && this.shopPanel?.isOpen && insideShop(cue))) {
      marks.hide();
      return;
    }
    const drawn = cue ? this.drawCue(cue, marks) : false;
    if (!drawn) marks.hide();
  }

  /**
   * What the guide can see of the world, looked at twice a second.
   *
   * Counting crops and machines means walking every sprite she has put
   * down, which is nothing on a new farm and something on an old one; and a
   * guide that starts half a second after something ripens is a guide that
   * started when it ripened, as far as anybody watching can tell.
   */
  private guideWorld(): GuideWorld {
    const now = this.time.now;
    const seen = this.guideWorldSeen;
    if (seen && now - seen.at < 500) return seen.world;
    let unripe = 0;
    let ripe = 0;
    for (const at of this.cropsOfStage(null)) {
      if (at.ripe) ripe++;
      else unripe++;
    }
    const world: GuideWorld = {
      outdoors: !this.interior,
      unripeCrops: unripe,
      ripeCrops: ripe,
      cropsInBasket: PLANT_TYPES.reduce((sum, plant) => sum + this.inventory.count(plant), 0),
      // Only the portal, which is the one a guide walks her to. The other
      // four teachers are found the way they always were.
      spellToLearn: !knowsSpell([...this.profile.learned, ...this.dev.learned], Spell.Portal),
      woodStanding: this.woodStillStanding().length,
      thingsInCrate: CRATE_GROUPS.reduce(
        (sum, group) =>
          sum + thingsIn(group).reduce((held, thing) => held + this.crateHeld(thing), 0),
        0,
      ),
      sleepingMachines: this.sleepingMachines().length,
    };
    this.guideWorldSeen = { at: now, world };
    return world;
  }

  /** What the guide can see of the interface, which is cheap and asked every frame. */
  private guideView(): GuideView {
    const trayOpen = Object.entries(this.trays()).find(([, tray]) => tray?.isOpen)?.[0] ?? null;
    const held = this.armed;
    const armed: GuideView["armed"] =
      held === null
        ? null
        : held.kind === "seed"
          ? "seed"
          : held.kind === "spell" && held.spell === Spell.Growth
            ? "growth"
            : held.kind === "spell" && held.spell === Spell.Array
              ? "array"
              : held.kind === "fixture" || held.kind === "decor"
                ? "thing"
                : "other";
    return {
      trayOpen,
      crateGroupOpen: this.crateGroup !== null,
      armed,
      indoors: this.interior ? this.enteredBuilding : null,
    };
  }

  /**
   * Draw one cue, and say whether there was anything to draw it on.
   *
   * A button is glowed where the scene says the button is — by the same
   * name a script taps it by, so the guide and the browser suite cannot
   * disagree about which button is the pouch. A tray's own button stands in
   * for a thing inside it while the tray is shut: pointing at a seed nobody
   * can see is pointing at nothing, and the pouch is how to see it.
   */
  private drawCue(cue: Cue, marks: GuideMarks): boolean {
    const glow = (name: string, fallback?: string): boolean => {
      const positions = this.uiPositions();
      const at = positions[name] ?? (fallback ? positions[fallback] : undefined);
      if (!at) return false;
      marks.glowButton(at, (this.mobileControls ? 64 : 56) / 2 + 6);
      return true;
    };
    const point = (cell: GridPoint | null): boolean => {
      if (!cell) return false;
      marks.clearTrail();
      marks.pointAt(this.screenOf(cell.col, cell.row));
      return true;
    };
    switch (cue.kind) {
      case "button":
        return glow(cue.name);
      case "seed":
        return this.seedTray?.isOpen ? glow("seeds.0", "seeds") : glow("seeds");
      case "growth-rune":
        return this.spellTray?.isOpen
          ? glow(`spellbook.${SPELLS.indexOf(Spell.Growth)}`, "spellbook")
          : glow("spellbook");
      case "crate-group": {
        const thing = this.firstThingInCrate();
        return thing && this.crateTray?.isOpen
          ? glow(`crate.${groupOf(thing)}`, "crate")
          : glow("crate");
      }
      case "crate-thing": {
        const thing = this.firstThingInCrate();
        return thing && this.crateTray?.isOpen ? glow(`crate.${thing}`, "crate") : glow("crate");
      }
      case "ahead":
        return point(this.squareToUse());
      case "crop": {
        const growing = this.cropsOfStage(cue.ripe);
        const hers = this.justPlanted;
        const own =
          hers && growing.some((at) => at.col === hers.col && at.row === hers.row) ? hers : null;
        return point(own ?? this.nearest(growing));
      }
      case "door": {
        const building = this.buildings.find((one) => one.id === cue.building);
        if (!building) return false;
        return this.pointTheWay(marks, { col: building.doorCol, row: building.doorRow });
      }
      case "attendant":
        return point(this.attendantCell);
      case "sell-row": {
        // Hers, not the first on the shelf: the counter lists every crop it
        // buys and only one of them is in her basket.
        const carrying = PLANT_TYPES.find((plant) => this.inventory.count(plant) > 0);
        return carrying ? glow(`shop.sell.${carrying}`) : false;
      }
      case "sleeping-machine":
        return point(this.nearest(this.sleepingMachines()));
      case "wood":
        return point(this.nearest(this.woodStillStanding()));
      case "great-tree":
        // Nothing at all while the wood is up: the tree has nothing to give
        // until it is down, and an arrow over it then would be sending her
        // away from the errand she is in the middle of.
        return this.woodStillStanding().length > 0 ? false : point(this.grove.tree);
      case "array-rune":
        return this.spellTray?.isOpen
          ? glow(`spellbook.${SPELLS.indexOf(Spell.Array)}`, "spellbook")
          : glow("spellbook");
      case "grove-bed":
        return point(this.firstEmptyGroveSquare());
    }
  }

  /**
   * Point at a square she has to walk to — over it if it is on the screen,
   * and along the way to it if not.
   *
   * The way rather than the bearing. An arrow at the edge of the screen
   * turned towards a door fifty squares off is a line, and a line goes on
   * past the door to whatever lies beyond it; from the garden the store and
   * the enchanted forest were in the same direction, and the arrow was read
   * as the forest. So the guide walks the path it wants her to walk — the
   * one the postman walks, found the same way — and hangs the arrow over
   * the last square of it still on the screen, with the trail of dots the
   * game already draws for *too far* laid from her feet to it. It turns
   * where the path turns, and it moves as she moves.
   *
   * The bearing is kept for the one case the way cannot be found, which is
   * a door nothing can walk to. An arrow that says roughly where is better
   * than none.
   */
  private pointTheWay(marks: GuideMarks, target: GridPoint): boolean {
    const { width, height } = this.scale;
    const inside = (at: ScreenPoint, inset: number) =>
      at.x >= inset && at.x <= width - inset && at.y >= inset && at.y <= height - inset;
    const there = this.screenOf(target.col, target.row);
    const path = this.wayTo(target);
    const trail: ScreenPoint[] = [];
    let end: ScreenPoint | null = null;
    for (const cell of path ?? []) {
      const at = this.screenOf(cell.col, cell.row);
      if (!inside(at, GUIDE_TRAIL_INSET)) break;
      trail.push(at);
      end = at;
    }
    // The door in view is not the end of the errand — she still has to walk
    // there. The trail used to stop the moment it came on screen and leave
    // only the arrow, which is the frame a child is *most* likely to be
    // looking at: the shop appears, and the way to it goes away. So the way
    // stays drawn, all the way in, and the arrow sits over the door itself
    // rather than over the last dot short of it.
    if (inside(there, 0)) {
      if (trail.length > 0) marks.pointAlong(trail, there);
      else {
        marks.clearTrail();
        marks.pointAt(there);
      }
      return true;
    }
    if (!end) {
      marks.clearTrail();
      marks.pointAt(there);
      return true;
    }
    marks.pointAlong(trail, end);
    return true;
  }

  /**
   * The way from where she stands to a square, remembered until she moves.
   *
   * A door is walked into, so the door's own square is the goal when it can
   * be stood on, and the square in front of it otherwise.
   */
  private wayTo(target: GridPoint): GridPoint[] | null {
    if (this.interior) return null;
    const from = tileKey(this.playerCol, this.playerRow);
    const to = tileKey(target.col, target.row);
    const known = this.guideRoute;
    if (known && known.from === from && known.to === to) return known.path;
    const here = { col: this.playerCol, row: this.playerRow };
    const goal = this.grid.isPassable(target.col, target.row)
      ? target
      : { col: target.col, row: target.row + 1 };
    const path = findPath(this.grid, here, goal);
    this.guideRoute = { from, to, path };
    return path;
  }

  /**
   * The square the arrow says to put a thing on: the one she faces, if it
   * will take it, else the first beside her that will.
   *
   * A seed or a thing in her hands goes on any square in reach, so the
   * arrow is a suggestion and not a rule — but a suggestion of a square
   * that refuses the seed would be an arrow at a red cross. What "will take
   * it" means is the grid's own rule for a seed and the plain one — free
   * ground with nothing growing on it — for anything else.
   */
  private squareToUse(): GridPoint | null {
    const held = this.armed;
    const ahead = stepForFacing(this.session.facing);
    const steps = [
      ahead,
      { dCol: 1, dRow: 0 },
      { dCol: -1, dRow: 0 },
      { dCol: 0, dRow: 1 },
      { dCol: 0, dRow: -1 },
    ];
    for (const step of steps) {
      const col = this.playerCol + step.dCol;
      const row = this.playerRow + step.dRow;
      if (!this.grid.isPassable(col, row) || this.grid.getCrop(col, row)) continue;
      if (held?.kind === "seed" && !this.grid.canPlant(col, row, held.plant)) continue;
      return { col, row };
    }
    return null;
  }

  /** Every crop she has, or only the ripe or unripe ones. */
  private cropsOfStage(ripe: boolean | null): (GridPoint & { ripe: boolean })[] {
    if (this.interior) return [];
    const found: (GridPoint & { ripe: boolean })[] = [];
    for (const key of this.cropSprites.keys()) {
      const [col, row] = key.split(",").map(Number);
      if (col === undefined || row === undefined) continue;
      const crop = this.grid.getCrop(col, row);
      if (!crop) continue;
      const isRipe = crop.stage === HARVEST_STAGE;
      if (ripe === null || ripe === isRipe) found.push({ col, row, ripe: isRipe });
    }
    return found;
  }

  /** The machines near her that nobody has woken. */
  private sleepingMachines(): GridPoint[] {
    if (this.interior) return [];
    const found: GridPoint[] = [];
    for (const key of this.placedFixtures.keys()) {
      if (!this.machineAt(key)) continue;
      if (this.machines.get(key)?.awake) continue;
      const [col, row] = key.split(",").map(Number);
      if (col === undefined || row === undefined) continue;
      const off = Math.max(Math.abs(col - this.playerCol), Math.abs(row - this.playerRow));
      if (off <= GUIDE_MACHINE_REACH) found.push({ col, row });
    }
    return found;
  }

  /** The first thing in the crate she has one of, in the crate's own order. */
  private firstThingInCrate(): CrateThing | null {
    for (const group of CRATE_GROUPS) {
      for (const thing of thingsIn(group)) {
        if (this.crateHeld(thing) > 0) return thing;
      }
    }
    return null;
  }

  /** Whichever of these is fewest steps from her, or nothing. */
  private nearest<T extends GridPoint>(cells: readonly T[]): T | null {
    let best: T | null = null;
    let bestSteps = Number.POSITIVE_INFINITY;
    for (const cell of cells) {
      const steps = Math.abs(cell.col - this.playerCol) + Math.abs(cell.row - this.playerRow);
      if (steps < bestSteps) {
        best = cell;
        bestSteps = steps;
      }
    }
    return best;
  }

  /** Tell the guide what she did. */
  private noteDeed(deed: Deed): void {
    this.guide?.note(deed);
  }

  /** A tray opened, which for three of them is a deed the guide waits for. */
  private noteTray(name: string): void {
    if (name === "seeds") this.noteDeed(Deed.OpenedSeeds);
    else if (name === "spellbook") this.noteDeed(Deed.OpenedSpellbook);
    else if (name === "crate") this.noteDeed(Deed.OpenedCrate);
  }

  /** Something was lit over her head, which for three kinds is a deed. */
  private noteArmed(what: Armed): void {
    if (what.kind === "seed") this.noteDeed(Deed.ArmedSeed);
    else if (what.kind === "spell" && what.spell === Spell.Growth) this.noteDeed(Deed.ArmedGrowth);
    else if (what.kind === "spell" && what.spell === Spell.Array) this.noteDeed(Deed.ArmedArray);
    else if (what.kind === "fixture" || what.kind === "decor") this.noteDeed(Deed.ArmedThing);
  }

  /** Note that a guide has been walked through — by *this child*. */
  private rememberGuided(guide: Guide): void {
    if (this.profile.guided.includes(guide)) return;
    this.saveProfileChange({ guided: [...this.profile.guided, guide] });
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
    // Caught up on the news in the same write. Everything on that list is
    // already true of the game this child is being shown for the first
    // time, so it is not news to them — and a letter about what changed,
    // delivered to somebody who has seen none of what came before, is a
    // sentence with nothing behind it.
    this.saveProfileChange({ introSeen: true, newsSeen: NEWS_BEATS.length });
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
   * Ask a sum, on whichever parchment this rung wants.
   *
   * One place decides, rather than seven. The counting box is the easiest
   * rungs' form of the number line — see `Rung.counted` — and every cast in
   * the game that puts a line in front of a child comes through here, so a
   * child at the bottom of the ladder meets counters wherever the sum came
   * from: a crop, a floor, a tree, a machine.
   *
   * A bare sum never goes to the counters. `bare` is set at the very top of
   * the ladder and `counted` at the very bottom, so the two cannot both be
   * true of one rung — but saying so here means a table edited badly fails
   * towards the parchment that can draw anything rather than towards a box
   * of counters asked to hold six hundred.
   */
  private askSum(
    problem: NumberLine,
    given: number,
    onDone: (result: CastResult) => void,
    bare: BareSum | null,
    rung: Rung,
  ): void {
    if (rung.counted && bare === null) {
      this.countingPopup.open(problem, this.spellRng, onDone);
      return;
    }
    this.spellPopup.open(problem, given, onDone, bare);
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
    this.noteDeed(Deed.LearnedSpell);
    this.geometryPanel?.setRung(portalRungAt(this.ladders.held("portalRung")));
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
    // Nothing else is wired up to be touched at all: a lighthouse and a
    // clock tower are there to be seen from across the world, and a thing
    // that only ever refuses is better off letting the tap through to the
    // ground it is standing in front of.
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
   * The fisherman on the quay, and the spell he hands over.
   *
   * Taught for being spoken to, the way the geometer and the clockmaker
   * teach theirs, and not earned by an errand the way the astronomer's and
   * the tree's are. The rule the two errands were set under is that an
   * errand is worth it *where the reward would otherwise remove most of the
   * work from the game* — which is true of the array spell, because it
   * removes the arithmetic. This one removes tapping: every crop it picks
   * still cost its growth casts, one sum at a time, on the way to being
   * ripe. What it costs a child is the walk to the harbour, and the harbour
   * is a long way.
   *
   * And then his lesson opens, because a man who says hello and nothing else
   * is a man who reads as broken — the clockmaker's note, one quay along.
   */
  private meetFisher(): void {
    if (this.modalOpen) return;
    this.joystick?.release();
    this.closeTrays();
    const learned = learnSpell(this.profile.learned, Spell.Share);
    const first = learned !== this.profile.learned;
    if (first) {
      this.saveProfileChange({ learned });
      this.spellTray?.refresh();
      this.showEarned(UiAsset.RuneDivide);
    }
    this.sharePanel?.setRung(shareRungAt(this.ladders.held("shareRung")));
    this.sharePanel?.open_(() => {});
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
    // **Paid when the wood is gone, not when the beds are full.**
    //
    // It used to be the other way round, and the other way round taught
    // nothing: a child cleared the wood, filled sixteen squares by hand, and
    // was then given the spell that would have filled them in one cast — a
    // reward handed over after the work it saves, for a lesson nobody had
    // been shown. Now the tree pays for the clearing, which is twelve
    // subtractions one square at a time, and then asks for the beds. She
    // does those sixteen with a single answer. The whole argument for
    // multiplication is those two things happening ten seconds apart.
    const learned =
      progress.task === GroveTask.Overgrown
        ? this.profile.learned
        : learnSpell(this.profile.learned, Spell.Array);
    const first = learned !== this.profile.learned;
    if (first) {
      this.saveProfileChange({ learned });
      this.spellTray?.refresh();
      this.noteDeed(Deed.LearnedArray);
    }
    // Only the moment of learning goes to the message line. What the tree is
    // still asking for used to go there too — behind the panel this call then
    // opened over it, in the smallest type the game has — and is now the
    // panel's own first page, where it is read rather than missed.
    if (first) this.showEarned(UiAsset.RuneTimes);
    this.grovePanel?.setRung(arrayRungAt(this.ladders.held("arrayRung")));
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
    this.noteDeed(Deed.OpenedShop);
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
      // The word itself, which is centred on the plaque it is written on —
      // so this is the middle of the button without measuring it. It used to
      // be the box's own corner plus half its size, written out by hand.
      const { x, y } = this.optionsButton.label;
      positions.options = { x, y };
    }
    // The picture of what she is holding, which is also the control that
    // turns it. In world pixels turned into screen ones: it hangs over her
    // head and moves with her, so it is not on the interface camera and
    // cannot simply be read off like a tray button.
    const rune = this.armedRune;
    if (rune) positions.armed = this.screenOfPoint(rune.x, rune.y);
    // The map hanging on the post office wall, on the same terms as the rune
    // and for the same reason: it is a picture in a room rather than a button
    // on a tray, so a script had no way to reach the one control that opens
    // the world map. `getCenter` rather than the sprite's own point, which is
    // the bottom of it — the picture hangs from its foot.
    const hanging = this.wallMap?.getCenter();
    if (hanging) positions.wallMap = this.screenOfPoint(hanging.x, hanging.y);
    for (const [name, tray] of Object.entries(this.trays())) {
      if (!tray) continue;
      positions[name] = tray.containerPosition();
      // Named by the tray, which names its buttons for what they are rather
      // than for where they sit. See `TrayItem.name`: a position is a promise
      // about order that inserting anything breaks, and it has broken twice.
      for (const item of tray.itemPositions()) {
        positions[`${name}.${item.name}`] = { x: item.x, y: item.y };
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
    // Named for the action rather than numbered, because what is on this
    // menu depends on where she is standing and what she has been taught:
    // indoors it is build-or-clear, outdoors it is grow-or-clear, and the
    // mirror adds a third. `patch.2` meant copying only for a child who had
    // met the astronomer.
    for (const [index, at] of (this.patchMenu?.buttonPositions() ?? []).entries()) {
      positions[`patch.${this.patchChoices[index] ?? index}`] = at;
    }
    // Named by what pressing one does, because that is the whole of what
    // the ring is: the question *use it or take it*, asked in two pictures.
    for (const [action, at] of Object.entries(this.wheel?.buttonPositions() ?? {})) {
      positions[`wheel.${action}`] = at;
    }
    if (this.optionsPanel?.isOpen) Object.assign(positions, this.optionsPanel.buttonPositions());
    // The about sheet's, which nothing could reach until its heading became
    // a button — and a hidden gesture nothing can drive is a hidden gesture
    // nothing can check.
    if (this.aboutPanel?.isOpen) Object.assign(positions, this.aboutPanel.buttonPositions());
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
  private createOptionsButton(index: UiIndex): void {
    const plaque = new Plaque(this, index, {
      depth: HUD_DEPTH,
      register: (object) => this.ui(object),
    });
    plaque.takeTaps(OPTIONS_W, OPTIONS_H, () => this.openOptions());
    const label = this.ui(
      this.add
        .text(0, 0, "", { fontFamily: FACE, fontSize: "12px", color: INK })
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(HUD_DEPTH + 1),
    );
    this.optionsButton = { plaque, label };
    this.placeOptionsButton();
  }

  /**
   * The clock in the opposite corner from the options button.
   *
   * Reported from a playtest: *the UI is missing a clock and date. It's hard
   * for the player to know if it is day or night.* Everything in this game
   * that turns on the hour — the doors, the villagers going home, the
   * astronomer, the light itself — had no face anywhere on the screen, so a
   * child met a locked door with nothing to check it against.
   *
   * Three things, in the order they matter. **A sun or a moon**, which is
   * the part a five-year-old reads without being taught and the part the
   * report was actually about; the digits beside it are for whoever can
   * already read a clock. **The hour on a twelve-hour face**, because twelve
   * is the clock the hourglass spell teaches — see `clockFace`. And **the
   * date**, in the words the game already writes a date in: `gameWhen` puts
   * the day and the short month on the save list, in all three languages.
   *
   * It reads `worldNow`, not the wall clock, so winding the glass moves this
   * with everything else. A clock that went on showing the real time while
   * the sky went dark would be the one thing on screen contradicting the
   * spell.
   */
  private createClockHud(index: UiIndex): void {
    const plaque = new Plaque(this, index, {
      depth: HUD_DEPTH,
      register: (object) => this.ui(object),
    });
    const sky = this.ui(
      this.add
        .image(0, 0, uiTextureKey(UiAsset.MarkDay))
        .setOrigin(0, 0.5)
        .setDisplaySize(CLOCK_HUD_ICON, CLOCK_HUD_ICON)
        .setScrollFactor(0)
        .setDepth(HUD_DEPTH + 1),
    );
    // Written in ink on the paper, like everything else in this game that is
    // written down. It was pale letters on a dark box, which is the palette
    // of a heads-up display in a flight simulator.
    const time = this.ui(
      this.add
        .text(0, 0, "", { fontFamily: FACE, fontSize: "15px", color: INK })
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(HUD_DEPTH + 1),
    );
    const date = this.ui(
      this.add
        .text(0, 0, "", { fontFamily: FACE, fontSize: "10px", color: INK_DIM })
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(HUD_DEPTH + 1),
    );
    this.clockHud = { plaque, sky, time, date };
    this.placeClockHud();
    this.refreshClockHud();
  }

  /**
   * Top left, which is the one corner of this screen with nothing in it.
   *
   * The options button has the top right, the trays the bottom right, and
   * the joystick comes up wherever a thumb lands on the bottom left.
   */
  private placeClockHud(): void {
    const hud = this.clockHud;
    if (!hud) return;
    hud.plaque.layout(HUD_MARGIN, HUD_MARGIN, CLOCK_HUD_W, CLOCK_HUD_H);
    // Inset from the paper's own edge rather than from the screen's: the
    // frame is drawn a few pixels thick and writing that starts at the
    // corner starts on the border.
    const left = HUD_MARGIN + PLAQUE_PAD;
    hud.sky.setPosition(left, HUD_MARGIN + CLOCK_HUD_H / 2);
    hud.time.setPosition(left + CLOCK_HUD_ICON + 5, HUD_MARGIN + 5);
    hud.date.setPosition(left + CLOCK_HUD_ICON + 5, HUD_MARGIN + 23);
  }

  /**
   * Wind it on, once a minute's worth of world has passed.
   *
   * Called every frame and writes almost never: the digits are compared
   * against what is already up, because setting the same string on a Phaser
   * text object rebuilds its texture, and doing that sixty times a second
   * for a number that changes once a minute is a whole frame's budget spent
   * on nothing.
   */
  /**
   * Tell the music where it is.
   *
   * The player is a place and an hour and nothing else — it does not know
   * what a wood is, and this does not know what a crossfade is.
   *
   * `whereOnTheMap` and not `session.tile`, which is the same trap the map
   * on the post office wall fell into: indoors her tile is a **room**
   * coordinate, three across and four down a floor, and asking `placeAt`
   * about that asks which named place cell 3,4 is in — a cell up in the
   * far north-west corner of the world. It would have answered "nowhere" for
   * every interior in this village and quietly answered *something* for a
   * child who lived near the top-left of the map.
   *
   * What it should answer is where the building stands, which is what going
   * through the returnTo door gives. A cottage in the village is in the
   * village, and a child who steps inside for a basket should not be handed
   * a change of scene for it.
   */
  private followTheMusic(): void {
    // Guarded against the two facts rather than run every frame, the same
    // way the clock beside it is: `placeAt` walks the five named areas and
    // builds a list to do it, which is nothing at all once and sixty times
    // nothing a second for a question whose answer changes when somebody
    // walks over a line.
    const daylight = isDaylight(this.hourNow());
    const where = this.whereOnTheMap();
    const standing = `${where.col},${where.row},${daylight}`;
    if (standing === this.musicStanding) return;
    this.musicStanding = standing;
    const player = sound();
    // What is playing is handed back in, because the ground between two
    // named places is not nowhere — it is still whatever the child last
    // walked out of, and the tune should stay put rather than go home.
    player.wants(tuneFor(placeAt(this.anchors, where), daylight, player.tune));
  }

  /** Where the child was standing when the music was last asked about. */
  private musicStanding = "";

  private refreshClockHud(): void {
    const hud = this.clockHud;
    if (!hud) return;
    const shown = !this.modalOpen;
    hud.plaque.setVisible(shown);
    for (const piece of [hud.sky, hud.time, hud.date]) piece.setVisible(shown);
    if (!shown) return;
    const hour = this.hourNow();
    const face = `${clockFace(hour)}|${this.words.gameWhen(this.worldNow())}|${isDaylight(hour)}`;
    if (face === this.clockShowing) return;
    this.clockShowing = face;
    hud.time.setText(clockFace(hour));
    hud.date.setText(this.words.gameWhen(this.worldNow()));
    hud.sky.setTexture(uiTextureKey(isDaylight(hour) ? UiAsset.MarkDay : UiAsset.MarkNight));
  }

  private placeOptionsButton(): void {
    const button = this.optionsButton;
    if (!button) return;
    // Measured back from the right edge rather than anchored to it: a plaque
    // is laid out from its top-left corner, because a nine-slice is.
    const left = this.scale.width - HUD_MARGIN - OPTIONS_W;
    button.plaque.layout(left, HUD_MARGIN, OPTIONS_W, OPTIONS_H);
    button.label.setPosition(left + OPTIONS_W / 2, HUD_MARGIN + OPTIONS_H / 2);
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
    this.optionsButton?.plaque.setVisible(shown);
    this.optionsButton?.label.setVisible(shown);
  }

  /**
   * Say what a thing is, and what it costs.
   *
   * Opened from the little cloud on its own button rather than from a help
   * screen somewhere, which is the whole idea: a child wondering about a
   * picture taps that picture's cloud, and never has to have discovered that
   * help exists.
   */
  private tellAbout(thing: FixtureType): void {
    sound().effect(Sfx.Page);
    this.thingPanel?.openFor(thing, () => {});
  }

  private openOptions(): void {
    sound().effect(Sfx.Page);
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
  /**
   * Lay a saved world back over a freshly grown one, and give back whatever
   * no longer has anywhere to stand.
   *
   * **Nothing is thrown away for being old.** A save whose generator has
   * moved on used to be discarded whole — every room, every machine, every
   * line — for a hazard that only ever applied to the outdoor half of it.
   * Rooms and their furniture are keyed by *house* rather than by tile and
   * were never at risk at all.
   *
   * So the ground is checked a square at a time, and a thing that cannot go
   * back goes into her basket instead. She loses a layout, which is a morning
   * of rearranging; she does not lose the things, which were paid for with
   * spells. That is the same bargain the minus rune already strikes when it
   * takes a machine back with its heap still in it.
   */
  private putTheWorldBack(world: WorldSnapshot | undefined): void {
    const moved = this.savedGame.groundMoved;
    // Only remembered here. What is owed for them is worked out at the end of
    // the restore, once her basket and her machines are both back — see
    // `giveBackWhatDidNotFit`.
    this.refused = restoreWorld(this.grid, world, moved).refused;
  }

  /** Put what could not stand into her basket, and say that it is there. */
  private giveBackWhatDidNotFit(): void {
    const refused = this.refused;
    this.refused = [];
    if (refused.length === 0) return;

    for (const object of refused) {
      const fixture = fixtureFor(object.type);
      // Only hers. A tree the generator used to put there and no longer does
      // is not a thing anybody owns, and handing a child a conifer because a
      // coastline moved would be inventing timber out of a version number.
      if (!fixture || !object.mine) continue;
      this.inventory.add(fixture, 1);
      if (!isMachine(fixture)) continue;
      // And everything that was inside it. A machine's contents are held
      // beside the grid rather than on it, so nothing else would have
      // noticed them going.
      const key = tileKey(object.col, object.row);
      const state = this.machines.get(key);
      this.machines.delete(key);
      this.drawings.delete(key);
      const item = state?.made ?? state?.holding;
      if (!state || !item) continue;
      const inside = state.heap + state.crates.reduce((all, count) => all + count, 0);
      if (inside > 0) this.inventory.add(item, inside);
      if (state.binned && state.bin > 0) this.inventory.add(state.binned, state.bin);
    }
    // Any line whose machine is now in her basket is a line to nowhere.
    this.wires = this.wires.filter(
      (wire) => this.machineAt(wire.from) !== null && this.machineAt(wire.to) !== null,
    );
    this.refreshCarried();
    this.sayWhatCameBack(refused);
  }

  /**
   * Say that her things are in the basket, without a word of it.
   *
   * **Silent recovery and silent loss look the same from where she is
   * sitting.** She left a sorter by the gate and it is not there; whether it
   * is safe in her basket or gone for ever is the whole question, and a
   * garden that answers neither is a garden she has to guess about.
   *
   * A cloud over her head with the things in it, which is the sentence this
   * game already has for *here is a thing* — the same one the animals use and
   * the same one a crop that will not grow here uses. No words, because there
   * is no wording of "the coastline moved" that a five-year-old reads in
   * three languages, and because the useful half is not why it happened. The
   * useful half is **where your sorter went**, and a picture of the sorter
   * over her head with the basket's number going up says exactly that.
   *
   * Held back a moment so it lands after the world is drawn rather than
   * during the frame that builds it: a cloud that appears before the garden
   * does is a cloud about nothing.
   */
  private sayWhatCameBack(refused: readonly PlacedObject[]): void {
    const kinds: FixtureType[] = [];
    for (const object of refused) {
      const fixture = fixtureFor(object.type);
      if (fixture && object.mine && !kinds.includes(fixture)) kinds.push(fixture);
    }
    if (kinds.length === 0) return;
    // Three at most, which is what the cloud holds without spilling out of
    // its own sides. A child who has had six kinds of thing handed back does
    // not need all six named; they need to know to look in the basket.
    const shown = kinds.slice(0, 3).map((fixture) => ({ ui: itemIcon(fixture) }));
    this.time.delayedCall(RETURNED_SAYS_MS, () => this.showThoughtOnPlayer(shown, false));
  }

  private restoreSavedWorld(): void {
    const saved = this.savedGame.world;
    // When the ground was last written down, read *before* the autosave
    // timer starts moving it. The hourglass reads this as "when you put the
    // game down"; asked later it would find the answer creeping up to now
    // and pay nothing. `?away=` fakes it, because the alternative way to see
    // this spell is to close the game and come back in an hour.
    if (saved) this.putTheWorldBack(saved.world);
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
    // And what every machine was holding. Not repaired and not defaulted: a
    // square with no entry is a machine nobody has woken, which is what a
    // machine built and never tapped actually is.
    this.machines = machinesFromSave(saved?.world?.machines);
    this.wires = wiresFromSave(saved?.world?.wires);
    this.drawings = plansFromSave(saved?.world?.blueprints);
    this.wireCarried.clear();
    this.wireWork.clear();
    // The child's own things come from their progress in this game, never
    // from the ground — which is why a world the generator can no longer
    // rebuild cannot cost them a coin. `loadGame` drops such a world and
    // keeps everything else, so what is missing here is only the tile they
    // were standing on.
    restorePlayer(this.session, this.profile.carried, saved !== null);

    // **Last of all**, and the ordering is the whole of why it is here.
    //
    // Handing things back the moment they were refused put them in a basket
    // that `restorePlayer` then replaced with the saved one, so every one of
    // them vanished again — and it read the machine states before
    // `machinesFromSave` had filled them, so a sorter came back with nothing
    // in it. Both were silent. What she is owed can only be worked out once
    // her basket and her machines are both the ones she left.
    this.giveBackWhatDidNotFit();
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
      machinesToSave(this.machines),
      wiresToSave(this.wires),
      plansToSave(this.drawings),
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
    this.ladders.empty(["rung", "portalRung", "arrayRung", "clockRung", "brickRung"]);
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
    this.lessonPanel?.setRung(this.additionRung);
  }

  private applySettings(next: Settings): void {
    this.settings = next;
    // Before the rest of it. Turning the sound off is the one change on that
    // panel whose whole point is to take effect *now* — a parent who has
    // just asked for quiet should get it while their finger is still on the
    // button, not after the language has been reset in nine other panels.
    sound().setEnabled(next.sound);
    // The language belongs to the child, not to the device — two siblings on
    // one tablet do not have to read the same one. The device copy follows
    // along so that tomorrow's who's-playing screen is written in the
    // language of whoever last played.
    this.saveProfileChange({ language: next.language });
    writeSettings(browserStore(), next);
    this.words = phrasesFor(next.language);
    this.spellPopup?.setPhrases(this.words);
    this.countingPopup?.setWords(this.words);
    this.optionsPanel?.setPhrases(this.words);
    this.aboutPanel?.setPhrases(this.words);
    this.thingPanel?.setPhrases(this.words);
    this.lessonPanel?.setPhrases(this.words);
    this.introPanel?.setPhrases(this.words);
    this.newsPanel?.setPhrases(this.words);
    this.mapPanel?.setPhrases(this.words);
    this.portalPanel?.setPhrases(this.words);
    this.geometryPanel?.setPhrases(this.words);
    this.brickPopup?.setPhrases(this.words);
    this.sharePopup?.setPhrases(this.words);
    this.symmetryPopup?.setPhrases(this.words);
    this.logicPopup?.setPhrases(this.words);
    this.shopPanel?.setPhrases(this.words);
    // The line on screen was written in the old language by whatever the
    // player last did; it would otherwise sit there until they did something
    // else. Clearing it is honest — re-translating a past event is not.
  }

  /**
   * Everything five trays agree about: where they sit and how they behave.
   *
   * It was written out five times, and the four lines that matter were the
   * worst of it — each tray closed the other four *by name*, so a sixth
   * would have meant editing five blocks and leaving two trays open at once
   * if any of them were missed.
   *
   * **Notably it does not close itself.** A blanket "shut the rest" that
   * included the tray being opened made it shut on the same click that
   * opened it, which reads exactly like a button that does nothing.
   *
   * The slot is how far along the bar it sits, counted from the spellbook.
   */
  private trayShelf(
    name: string,
    slot: number,
  ): Pick<
    IconTrayOptions,
    "size" | "right" | "bottom" | "depth" | "register" | "onOpen" | "canOpen"
  > {
    const size = this.mobileControls ? 64 : 56;
    return {
      size,
      right: size / 2 + (this.mobileControls ? 16 : 12) + (size + 10) * slot,
      bottom: this.mobileControls ? 76 : 48,
      depth: TOUCH_UI_DEPTH,
      register: (object) => this.ui(object),
      onOpen: () => {
        for (const [which, tray] of Object.entries(this.trays())) {
          if (which !== name) tray?.setOpen(false);
        }
        this.noteTray(name);
      },
      canOpen: () => !this.modalOpen,
    };
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
    // Whatever the crate was showing, it opens on the groups next time. A
    // tray that remembered would open onto furniture for a child who had
    // walked outside and wanted a fence.
    this.crateGroup = null;
    for (const tray of Object.values(this.trays())) tray?.setOpen(false);
    this.flowerMenu?.close();
    this.closeWheel();
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
  private placeFixture(fixture: FixtureType, turn: Turn = Turn.Toward): void {
    if (this.modalOpen) return;
    const result = this.session.place(fixture);
    this.report(result, itemIcon(fixture));
    if (!result.ok || !result.tile || !result.object) return;

    const { col, row } = result.tile;
    const sidecar = this.fixtureSidecars.get(fixture);
    if (!sidecar) throw new Error(`no art loaded for fixture "${fixture}"`);
    // Written onto the object itself, so the grid — and through it the save
    // — carries which way round it went down. Only when it is turned at all,
    // so nothing that cannot turn gains a field, and a save from before this
    // reads back byte for byte.
    if (turn !== Turn.Toward) result.object.turn = turn;
    sound().effect(Sfx.PutDown);
    this.noteDeed(Deed.Placed);
    const sprite = this.spawnFootprintSprite(
      result.object,
      sidecar,
      fixtureSheetKey(fixture),
      fixtureAnimKey(fixture, drawnLook(turn)),
      false,
      drawnFlip(turn),
    );
    // A machine is tapped for what it *does*, so it gets that handler instead
    // of the take-it-back one — not as well as. Phaser runs every handler on
    // a sprite, so registering both meant one tap picked the sorter up into
    // the basket and then woke a machine that was no longer standing there.
    if (isMachine(fixture)) this.watchMachine(sprite, col, row);
    else this.watchPlacedFixture(sprite, fixture, col, row);
    this.placedFixtures.set(tileKey(col, row), sprite);
    if (fixture === FixtureType.Lamp) this.lighting.lightLamp(col, row);
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
    this.onTap(sprite, () => {
      this.offerActions(fixture, [{ col, row }], () => this.takeFixture(fixture, col, row));
    });
  }

  // --- Machines -----------------------------------------------------------
  //
  // A machine embodies arithmetic where a spell tests it — see `machines.ts`.
  // So there is no parchment in any of this but one: the sorter is shown the
  // sum it is about to spend its life doing, once, and after that it deals in
  // silence for ever.

  /**
   * Make a machine tappable, which every one of them is.
   *
   * Unlike `watchPlacedFixture`, this is safe to do on the way back from a
   * save as well as on the way down, because the generator never puts a
   * machine anywhere: every sorter in the world is one a child built, so
   * there is no village property to protect from a tap.
   *
   * **Instead of that one, never as well as it.** Phaser calls every handler
   * a sprite has, so a machine carrying both had its first tap pick it up
   * into the basket and then wake a machine that was no longer standing
   * there. Which means a machine cannot yet be taken back once it is down —
   * a real gap, and the next thing this wants.
   */
  /**
   * Which machine stands on a square, if one does.
   *
   * Asked of the grid rather than remembered beside the state, because the
   * grid is where a machine *is* — a state entry for a square nothing stands
   * on is a machine that was taken back while its heap was still in it, and
   * this is the one place that would notice.
   */
  private machineAt(key: string): MachineType | null {
    const [col, row] = key.split(",").map(Number);
    if (col === undefined || row === undefined) return null;
    // `worldGrid`, never `grid`. Indoors `grid` is the *room's* grid, where a
    // machine's outdoor square is either out of bounds or some square of
    // somebody's floor — so this answered "no machine here" for every machine
    // in the world the moment she stepped through a door.
    //
    // That was quiet and it was expensive: `runWires` drops a wire whose ends
    // are no longer machines, so walking into her own house deleted every
    // length of wire she had strung, and then autosaved. Machines are outdoor
    // things and this is the grid they stand on.
    const object = this.worldGrid.getObjectAt(col, row);
    const fixture = object ? fixtureFor(object.type) : null;
    return fixture && isMachine(fixture) ? fixture : null;
  }

  private watchMachine(sprite: Phaser.GameObjects.Sprite, col: number, row: number): void {
    const frame = sprite.frame;
    sprite.setInteractive(
      new Phaser.Geom.Rectangle(0, frame.realHeight - TILE_SIZE, TILE_SIZE, TILE_SIZE),
      Phaser.Geom.Rectangle.Contains,
    );
    this.onTap(sprite, () => {
      this.tapMachine(col, row);
    });
  }

  /**
   * One tap on a machine, and what it means depends on what the machine has.
   *
   * Three answers, in the order a child meets them: wake it, empty it, fill
   * it. No menu and no panel — a machine that opened a window to be operated
   * would put an interface between a child and a thing standing in their own
   * garden, and the whole appeal of the thing is that it is standing there.
   */
  private tapMachine(col: number, row: number): void {
    if (this.modalOpen) return;
    const key = tileKey(col, row);
    const state = this.machines.get(key) ?? newMachine();
    const machine = this.machineAt(key);
    if (!machine) return;
    if (!state.awake) {
      this.showTheSum(key, state, machine);
      return;
    }
    // A woken blueprint is picked up, not emptied: what it holds is a
    // drawing, and the tap that would empty any other machine lifts the
    // drawing into her hands to be stamped down somewhere else.
    if (machine === FixtureType.Blueprint) {
      this.armPlan(key);
      return;
    }
    // Three answers in the order a child meets them: wake it, empty it,
    // fill it — and for a sieve there are two things to empty, so the good
    // ones come out before the rejects. A tap that handed back the bin while
    // there were shares waiting would be a machine offering the wrong half.
    const crate = fullestCrate(state);
    if ((state.crates[crate] ?? 0) > 0) {
      const taken = takeShare(state, crate);
      const item = taken.item;
      if (item) {
        this.machines.set(key, taken.state);
        this.inventory.add(item, taken.count);
        this.showResult(iconForItem(item), col, row);
        this.refreshCarried();
        this.autosave();
      }
      return;
    }
    // Then the bin, which is its own thing rather than a fourth crate: what
    // is in there is what the machine would *not* have, and taking it must
    // not cost her a share of what it kept.
    const tipped = tipBin(state);
    const rejects = tipped.item;
    if (rejects) {
      this.machines.set(key, tipped.state);
      this.inventory.add(rejects, tipped.count);
      this.showResult(iconForItem(rejects), col, row);
      this.refreshCarried();
      this.autosave();
      return;
    }
    this.tipIn(key, state, machine);
  }

  /**
   * The one sum a machine ever asks for: the one it does.
   *
   * Casting `÷` on the thing that divides, to wake it. It is not a toll on
   * the machine — it is the machine asking to be shown its own arithmetic,
   * and it asks exactly once in its life. A wrong answer costs nothing but
   * the tap: the machine is still there and still asleep, which is where it
   * started.
   */
  private showTheSum(key: string, state: MachineState, machine: MachineType): void {
    const spell: Spell = SPARK[machine];
    if (!knowsSpell([...this.profile.learned, ...this.dev.learned], spell)) {
      this.showWhereToLearn(spell);
      return;
    }
    const woken = (result: { solved: boolean }) => {
      if (!result.solved) return;
      this.machines.set(key, wake(state));
      this.noteDeed(Deed.Woke);
      // A blueprint draws the moment it wakes: the line as it stands now,
      // which is the one she was looking at when she woke it.
      if (machine === FixtureType.Blueprint) this.recordPlan(key);
      this.showEarned(RUNE_OF[spell]);
      this.autosave();
    };
    // Each machine is shown *its own* arithmetic, which is the whole of why
    // this branches: a hothouse woken by a division would be a toll, where
    // one woken by the rows and columns it is about to do three at a time is
    // the machine asking to be understood before it starts.
    if (spell === Spell.Logic) {
      // Which things get through, or whether the lamp lights: the question
      // a gate is, asked on paper before it is asked of carrots.
      const rung = logicRungAt(this.ladders.held("logicRung"));
      this.logicPopup?.open(this.spellRng, rung, (result) => {
        this.ladders.note("logicRung", result);
        woken(result);
      });
      return;
    }
    if (spell === Spell.Growth) {
      // Counting up to a number on a line, which is what the growth spell
      // walks and what a tally does to a heap.
      const rung = this.additionRung;
      const cast = additionCastFor(this.spellRng, rung);
      this.askSum(cast.problem, cast.given, woken, cast.bare, rung);
      return;
    }
    if (spell === Spell.Clearing) {
      // The number line walked backwards, which is what a sieve does to a
      // heap: take out what does not belong. The same parchment the rune
      // opens on a tree, because it is the same sum.
      const rung = this.additionRung;
      this.askSum(makeSubtractionProblem(this.spellRng, rung), rung.given, woken, null, rung);
      return;
    }
    if (spell === Spell.Array) {
      const rung = arrayRungAt(this.ladders.held("arrayRung"));
      // The machine's own rectangle: three shoots, three times over. Chosen
      // rather than rolled, and chosen to be the smallest square that is
      // genuinely a multiplication — because this is a demonstration and not
      // a test. The three is the three a child can already count through the
      // glass, so the sum on the parchment is a sum about the thing they are
      // standing in front of.
      this.arrayPopup?.open(arrayProblemFor(SHARES, SHARES, rung), woken);
      return;
    }
    const rung = shareRungAt(this.ladders.held("shareRung"));
    this.sharePopup?.open(shareProblemFor(this.spellRng, rung), woken);
  }

  /**
   * Tip the biggest heap of one thing she is carrying into the mouth.
   *
   * The biggest rather than a chosen one, because choosing is a menu and a
   * menu is the thing this interaction is trying not to be. A child with
   * twelve wood and three stone taps a sorter and the wood goes in, which is
   * what they meant: the reason to walk to a machine is the heap you are
   * carrying, and it is nearly always the big one.
   */
  private tipIn(key: string, state: MachineState, machine: MachineType): void {
    let best: { item: ItemType; count: number } | null = null;
    for (const [item, count] of this.inventory.entries()) {
      if (count <= 0) continue;
      // Only what this machine will take, so the biggest heap she is
      // carrying is the biggest heap *it wants* — a hothouse beside a child
      // with fifty wood and six carrots is asking for the carrots.
      // One question, asked of the machine rather than worked out here. This
      // was two lines that between them said "what it accepts, and what is
      // already in its mouth" — true of a machine with one mouth, and quietly
      // wrong for a press, which has two and would only ever have been
      // offered the first.
      if (!wouldTake(state, item, machine)) continue;
      if (!best || count > best.count) best = { item, count };
    }
    if (!best) {
      this.showRefusalOnPlayer(UiAsset.RuneDivide);
      return;
    }
    const fed = feed(state, best.item, best.count, machine);
    if (!fed) {
      this.showRefusalOnPlayer(UiAsset.RuneDivide);
      return;
    }
    this.inventory.remove(best.item, best.count);
    this.machines.set(key, fed);
    this.playGesture(PLANT); // she bends to tip it in, same as planting
    this.refreshCarried();
    this.autosave();
  }

  /**
   * Give every machine the minutes that have passed, and only those.
   *
   * **Sampled, never accumulated, and that is the whole design of it.** The
   * world's clock is `Date.now()` plus whatever the hourglass has wound, so a
   * machine paid by elapsed time would be a machine that paid a child for
   * having the tab shut — which is the accrual mechanic this game does not
   * have and does not want. Reading the clock every frame and taking the
   * *difference since the last frame* gives minutes she was there for, and
   * nothing else: the gap while the page was closed is never sampled across,
   * because there was no frame in it.
   *
   * The hourglass falls out of this for free, and that is the pleasure of it.
   * Winding the clock forward moves `worldNow` while she watches the sand
   * pour, so the difference is large for a few seconds and every machine in
   * the world deals a heap. Speeding a machine up is casting a spell.
   */
  private workMachines(): void {
    if (this.machines.size === 0) {
      this.machinesTold = null;
      return;
    }
    const now = this.worldNow();
    const told = this.machinesTold;
    this.machinesTold = now;
    if (told === null) return;
    const minutes = (now - told) / 60_000;
    // Backwards is impossible — the hourglass only winds forward — but a
    // clock nobody controls is worth not trusting: a machine that dealt a
    // heap because a device's own clock was corrected would be a bug nobody
    // could reproduce.
    if (minutes <= 0) return;
    // The wires first, so what a machine is handed this tick is worked on
    // this tick rather than sitting in its mouth until the next one. The
    // other order made a line of three machines take three ticks to move
    // anything from end to end, which is a garden that looks asleep.
    this.runWires(minutes);
    let dealt = false;
    // A strongbox's lid is open at night and shut by day: the hour the
    // village keeps, because a child who has watched the shops shut has
    // already met the signal.
    const open = !isOpenHours(this.hourNow());
    for (const [key, state] of this.machines) {
      const machine = this.machineAt(key);
      if (!machine) continue;
      const worked = advanceMachine(state, minutes, machine, open);
      if (worked === state) continue;
      this.machines.set(key, worked);
      if (worked.crates.some((count, at) => count !== (state.crates[at] ?? 0))) dealt = true;
      // The bell rings where it stands: its own picture rising off it, and
      // the machine's own noise. A bell that counted in silence would be a
      // tally with a different shape.
      if (machine === FixtureType.Bell && worked.rung > state.rung) {
        const [col, row] = key.split(",").map(Number);
        if (col !== undefined && row !== undefined) {
          this.showResult(itemIcon(FixtureType.Bell), col, row);
          sound().effect(Sfx.Machine);
        }
      }
    }
    if (dealt) {
      this.autosave();
      this.checkJobs();
    }
  }

  // --- Blueprints -------------------------------------------------------------
  //
  // A drawing of a line, to build again somewhere else. The one machine that
  // is not a machine; see `world/blueprint.ts` for what it draws and what a
  // stamping costs.

  /** Draw what stands round a blueprint, the moment it is woken. */
  private recordPlan(key: string): void {
    const origin = tileOf(key);
    if (!origin) return;
    const standing: { key: string; type: MachineType }[] = [];
    for (const where of this.placedFixtures.keys()) {
      const type = this.machineAt(where);
      if (type) standing.push({ key: where, type });
    }
    this.drawings.set(key, drawPlan(origin, standing, this.wires));
  }

  /**
   * Pick a drawing up, to be stamped down.
   *
   * Lit over her head as the blueprint's own picture, the way a coil is,
   * and put down the way a coil is: a tap on a square. An empty drawing —
   * a blueprint woken with nothing near it — is refused here rather than
   * at the stamping, so she is not handed a thing that cannot be used.
   */
  private armPlan(key: string): void {
    const plan = this.drawings.get(key);
    if (!plan || plan.machines.length === 0) {
      this.showRefusalOnPlayer(itemIcon(FixtureType.Blueprint));
      return;
    }
    this.arm({ kind: "plan", from: key }, uiTextureKey(itemIcon(FixtureType.Blueprint)));
  }

  /**
   * Build the drawing here: every machine at its offset, every wire between
   * them, paid for out of the basket.
   *
   * Refused whole or done whole. A square of the drawing that is taken, or
   * a material the basket is short of, is a cross on the square or the
   * material over her head and nothing built — a line half stamped would
   * be a line that does something other than the drawing, and the whole
   * point of a drawing is that it does the same thing every time.
   */
  private stampPlanAt(from: string, at: GridPoint): void {
    const plan = this.drawings.get(from);
    if (!plan || this.interior) {
      this.markRefusal(at.col, at.row);
      return;
    }
    const cells = stampedAt(plan, at);
    for (const cell of cells) {
      const free =
        this.grid.inBounds(cell.col, cell.row) &&
        this.grid.isPassable(cell.col, cell.row) &&
        !this.grid.getCrop(cell.col, cell.row) &&
        !this.grid.getObjectAt(cell.col, cell.row);
      if (!free) {
        this.markRefusal(cell.col, cell.row);
        // Kept in her hands, like a refused fence: a fat finger is not a
        // change of mind.
        this.arm({ kind: "plan", from }, uiTextureKey(itemIcon(FixtureType.Blueprint)));
        return;
      }
    }
    const short = shortFor(this.inventory, plan);
    if (short !== null || !canStamp(this.inventory, plan)) {
      this.showRefusalOnPlayer(short ? iconForItem(short) : itemIcon(FixtureType.Blueprint));
      this.arm({ kind: "plan", from }, uiTextureKey(itemIcon(FixtureType.Blueprint)));
      return;
    }
    if (!payForStamp(this.inventory, plan)) return;
    for (const cell of cells) this.putMachineAt(cell.type, cell);
    for (const wire of stampedWires(plan, at)) {
      if (!this.wires.some((one) => one.from === wire.from && one.to === wire.to)) {
        this.wires.push(wire);
      }
    }
    this.drawWires();
    // The blueprint counts its stampings, which is what the mechanic's last
    // job reads.
    const state = this.machines.get(from) ?? newMachine();
    this.machines.set(from, { ...state, rung: state.rung + 1 });
    sound().effect(Sfx.PutDown);
    this.showResult(itemIcon(FixtureType.Blueprint), at.col, at.row);
    this.playGesture(PLANT);
    this.refreshCarried();
    this.paintSockets();
    this.checkJobs();
    this.autosave();
  }

  /**
   * A machine on a square she named, asleep, hers.
   *
   * What `placeFixture` does after the session has said yes, without the
   * session: a stamping has already checked the square and paid, and the
   * session's `place` puts things on the square she is *facing*, which is
   * not where a drawing's machines go.
   */
  private putMachineAt(fixture: MachineType, cell: GridPoint): void {
    const object: PlacedObject = {
      id: `${fixture}-${cell.col}-${cell.row}`,
      type: fixture,
      col: cell.col,
      row: cell.row,
      width: 1,
      height: 1,
      blocksMovement: true,
      anchorCol: cell.col,
      anchorRow: cell.row,
      mine: true,
    };
    this.grid.placeObject(object);
    const sidecar = this.fixtureSidecars.get(fixture);
    if (!sidecar) throw new Error(`no art loaded for fixture "${fixture}"`);
    const sprite = this.spawnFootprintSprite(
      object,
      sidecar,
      fixtureSheetKey(fixture),
      fixtureAnimKey(fixture, drawnLook(Turn.Toward)),
      false,
      drawnFlip(Turn.Toward),
    );
    this.watchMachine(sprite, cell.col, cell.row);
    this.placedFixtures.set(tileKey(cell.col, cell.row), sprite);
  }

  // --- The mechanic's jobs ----------------------------------------------------

  /** The jobs this child has done, and the ones `?jobs=` says to count. */
  private get jobsDone(): readonly string[] {
    return [...this.profile.jobs, ...this.dev.jobs];
  }

  /** Whether the crate shows this: everything but a machine a job has not yet earned. */
  private crateOffers(fixture: FixtureType): boolean {
    return !isMachine(fixture) || offered(this.jobsDone).includes(fixture);
  }

  /** The garden's lines, as a job reads them: every machine and every wire. */
  private lineView(): LineView {
    const machines: { key: string; type: MachineType; state: MachineState }[] = [];
    for (const key of this.placedFixtures.keys()) {
      const type = this.machineAt(key);
      if (type) machines.push({ key, type, state: this.machines.get(key) ?? newMachine() });
    }
    return { machines, wires: this.wires };
  }

  /**
   * Whether the garden has done the job she set, and if so, remember it.
   *
   * Asked whenever a line changes — a wire strung, a machine dealt — rather
   * than every frame, because it walks every machine in the garden. The
   * reward is the crate offering the next machine, and the picture rising
   * over her head is that machine's, so the child knows what to go and
   * look for.
   */
  private checkJobs(): void {
    const job = nextJob(this.jobsDone);
    if (!job) return;
    const spec = JOB_SPECS[job];
    if (spec.progress(this.lineView()) < spec.wanted) return;
    this.saveProfileChange({ jobs: [...this.profile.jobs, job] });
    this.crateTray?.refresh();
    if (spec.unlocks) this.showEarned(itemIcon(spec.unlocks));
  }

  /**
   * The sheet on her bench: the job, how far along it is, and what it earns.
   *
   * The astronomer's errand panel, with a line of machines on it: the row is
   * the number for a child who cannot read, and the sentence is for the one
   * who can. What is *counted* is what she can see in the garden — wires
   * into the funnel, rings of the bell.
   */
  private showJobs(): void {
    const job = nextJob(this.jobsDone);
    const spec = job ? JOB_SPECS[job] : null;
    const progress = spec ? Math.min(spec.wanted, spec.progress(this.lineView())) : 0;
    this.taskPanel?.show(
      {
        title: this.words.jobsTitle,
        line: job
          ? this.words.jobAsk(job, Math.max(0, (spec?.wanted ?? 0) - progress))
          : this.words.jobsAllDone,
        bargain: job ? this.words.jobBargain(job) : this.words.jobEarned,
        token: spec
          ? spec.token === "wire"
            ? itemIcon(CRATE_WIRE as never)
            : itemIcon(spec.token)
          : itemIcon(FixtureType.Bell),
        needed: spec?.wanted ?? 0,
        done: progress,
        reward: spec?.unlocks ? itemIcon(spec.unlocks) : UiAsset.MarkGlad,
      },
      () => {},
    );
  }

  // --- Wire ---------------------------------------------------------------
  //
  // It only carries. Every decision belongs to a machine standing where a
  // child can see it, and none of them belong to the line between two of
  // them — see `wires.ts`.

  /** Take up a coil. Nothing is spent: what a wire costs is the machines. */
  private armWire(): void {
    this.arm({ kind: "wire", from: null }, uiTextureKey(itemIcon(CRATE_WIRE as never)));
  }

  /**
   * One tap of the two a wire takes.
   *
   * The first names the machine it comes off; the second names the one it
   * feeds. In between, the coil stays lit and she can walk — which is the
   * whole reason this is two taps rather than a drag: a wire reaches six
   * squares and a six-year-old dragging across six squares of world while
   * the camera follows is a gesture nobody lands.
   *
   * `castArmedAt` puts the rune out before it dispatches, so the first tap
   * has to light it again with the end it now has hold of. Same trick as a
   * refused piece of furniture staying in her hands.
   */
  private stringWireAt(held: { from: GridPoint | null }, at: GridPoint): void {
    const machine = this.machineAt(tileKey(at.col, at.row));
    if (!machine) {
      // A tap on bare ground is a miss rather than a cancel: she keeps the
      // coil and whichever end she had, exactly as a spell aimed wide stays
      // lit. Giving it up would punish a fat finger with two taps.
      this.showRefusalOnPlayer(itemIcon(CRATE_WIRE as never));
      this.arm({ kind: "wire", from: held.from }, uiTextureKey(itemIcon(CRATE_WIRE as never)));
      return;
    }
    if (!held.from) {
      this.showResult(UiAsset.MarkYes, at.col, at.row);
      this.arm({ kind: "wire", from: at }, uiTextureKey(itemIcon(CRATE_WIRE as never)));
      return;
    }
    if (!canString(held.from, at)) {
      this.markTooFar(at.col, at.row);
      this.arm({ kind: "wire", from: held.from }, uiTextureKey(itemIcon(CRATE_WIRE as never)));
      return;
    }
    const wire = { from: tileKey(held.from.col, held.from.row), to: tileKey(at.col, at.row) };
    // Strung twice is strung once. Two wires the same way between the same
    // two machines would carry twice as fast for no reason a child could
    // see, which is the sort of thing somebody finds and nobody understands.
    if (!this.wires.some((one) => one.from === wire.from && one.to === wire.to)) {
      this.wires.push(wire);
    }
    this.showResult(UiAsset.MarkYes, at.col, at.row);
    this.drawWires();
    this.autosave();
    this.checkJobs();
  }

  /**
   * Give every wire the minutes that have passed.
   *
   * The same clock the machines run on and for the same reason — see
   * `workMachines`. A wire that carried by elapsed time would fill a garden
   * overnight while nobody was there.
   *
   * A wire whose ends are no longer machines is dropped here rather than
   * refused on the way in: one of them may have been taken back since, and a
   * save that would not load because something had been moved would be worse
   * than a length of wire quietly coming down.
   */
  private runWires(minutes: number): void {
    if (this.wires.length === 0) return;
    let carried = false;
    const standing: Wire[] = [];
    for (const wire of this.wires) {
      const key = wireKey(wire.from, wire.to);
      const sinkMachine = this.machineAt(wire.to);
      if (!this.machineAt(wire.from) || !sinkMachine) continue;
      standing.push(wire);

      // Banked by the round, exactly as a machine's work is. Carrying a
      // little on every frame instead made a wire sixty times faster than
      // the machine feeding it — a line that emptied a sorter's crates in
      // under two seconds, which is not a wire, it is a drain.
      const worked = (this.wireWork.get(key) ?? 0) + minutes;
      const rounds = Math.floor(worked / MINUTES_PER_ROUND);
      if (rounds <= 0) {
        this.wireWork.set(key, worked);
        continue;
      }
      const source = this.machines.get(wire.from);
      const sink = this.machines.get(wire.to);
      if (!source || !sink) {
        this.wireWork.set(key, 0);
        continue;
      }
      const done = carry(source, sink, sinkMachine, rounds * CARRIES_PER_ROUND);
      if (done.moved <= 0) {
        // Backed up, or nothing to carry. One round's work is kept and no
        // more: a line that banked a month of it while the far end was full
        // would empty a garden into one machine the moment it cleared.
        this.wireWork.set(key, MINUTES_PER_ROUND);
        continue;
      }
      this.wireWork.set(key, worked - rounds * MINUTES_PER_ROUND);
      // How much it has carried *altogether*, not on the last tick. A wire
      // that has finished its work and one that never started both carry
      // nothing this second, and from outside they are the same picture —
      // so what a scenario needs to know is whether this line has ever
      // worked, which is a running total and not a rate.
      this.wireCarried.set(key, (this.wireCarried.get(key) ?? 0) + done.moved);
      this.machines.set(wire.from, done.source);
      this.machines.set(wire.to, done.sink);
      carried = true;
    }
    if (standing.length !== this.wires.length) {
      this.wires = standing;
      this.drawWires();
    }
    if (carried) this.autosave();
  }

  /**
   * Draw every length of it, and the pail on each.
   *
   * Ink rather than sprites, the way the spells' marks are: a wire is a line
   * and a line is what `Graphics` is for. The sag is the whole of what makes
   * it read as hanging rather than as a ruler laid across the garden.
   */
  private drawWires(): void {
    const ink = this.wireInk;
    if (!ink) return;
    ink.clear();
    for (const wire of this.wires) {
      const at = tileOf(wire.from);
      const to = tileOf(wire.to);
      if (!at || !to) continue;
      const start = this.toFeet(at.col, at.row);
      const end = this.toFeet(to.col, to.row);
      const hang = Math.max(6, Math.hypot(end.x - start.x, end.y - start.y) / 6);
      ink.lineStyle(2, WIRE_DARK, 1);
      this.sagFrom(ink, start, end, hang);
      ink.lineStyle(1, WIRE_LIT, 1);
      this.sagFrom(ink, { x: start.x, y: start.y - 1 }, { x: end.x, y: end.y - 1 }, hang);
    }
  }

  /** One hanging line, as a handful of straight ones. */
  private sagFrom(
    ink: Phaser.GameObjects.Graphics,
    start: { x: number; y: number },
    end: { x: number; y: number },
    hang: number,
  ): void {
    const steps = 10;
    ink.beginPath();
    for (let step = 0; step <= steps; step++) {
      const along = step / steps;
      const x = start.x + (end.x - start.x) * along;
      // A parabola through both ends, deepest in the middle: four times the
      // sag at the halfway point and nothing at either end.
      const y = start.y + (end.y - start.y) * along + hang * 4 * along * (1 - along);
      if (step === 0) ink.moveTo(x, y);
      else ink.lineTo(x, y);
    }
    ink.strokePath();
  }

  // --- Using things -------------------------------------------------------
  //
  // A tap on a thing she put down asks what to do with it, and one of the
  // two answers is a small gesture that changes nothing. `world/uses.ts`
  // says which thing gets which; `ActionWheel` does the asking; this is the
  // doing.

  /**
   * Ask what to do with a thing: use it, or take it.
   *
   * It used to go straight into the basket, which made every piece of
   * furniture a kind of luggage — a bench was a thing to have and never a
   * thing to sit on. Now the tap asks, in two pictures: the glad face for
   * using it and the basket for taking it. The design's rule that nothing
   * selects-then-confirms is kept, because this is not a confirmation: it
   * is a question with two different answers, and only the child knows
   * which she meant.
   *
   * Opened over the thing rather than over her, because the question is
   * about the thing. The tap that opened it is still on its way to the
   * scene's own handler, which is what `wheelFresh` is for.
   *
   * A thing with no use skips the question — a chooser of one is not a
   * choice. Nothing hers has no use; the rule is kept for the day something
   * does.
   */
  private offerActions(
    thing: UsableThing,
    cells: readonly GridPoint[],
    take: () => void,
    /** Where on the thing she lies, if not its near edge. The bed's pillow. */
    head?: GridPoint,
  ): void {
    if (this.modalOpen || cells.length === 0) return;
    const use = useOf(thing);
    if (!use) {
      take();
      return;
    }
    const feet = cells.map((cell) => this.toFeet(cell.col, cell.row));
    const x = feet.reduce((sum, at) => sum + at.x, 0) / feet.length;
    const y = feet.reduce((sum, at) => sum + at.y, 0) / feet.length;
    const middle = this.screenOfPoint(x, y - TILE_SIZE / 2);
    this.wheel?.openAt(
      middle,
      [
        { action: "use", icon: uiTextureKey(UiAsset.MarkGlad) },
        { action: "take", icon: uiTextureKey(UiAsset.Basket) },
      ],
      (action) => {
        this.wheelOpenedAt = null;
        if (action === "take") take();
        else this.useThing(use, cells, head);
      },
    );
    this.wheelFresh = true;
    this.wheelOpenedAt = { col: this.playerCol, row: this.playerRow };
  }

  private closeWheel(): void {
    this.wheel?.close();
    this.wheelFresh = false;
    this.wheelOpenedAt = null;
  }

  /**
   * Do the small thing she does with it.
   *
   * From one step away, diagonals included, like talking to somebody: a
   * bench three squares off is a bench to walk to first, and the same trail
   * of dots that says so for a villager says so here. Nothing in the world
   * changes. The sprite hops, tilts, wriggles or sinks, and after a second
   * or two she is standing where she was, facing what she used.
   *
   * Taps and keys do nothing while it plays — `using` is folded into
   * `modalOpen` — which is why every move is short. The one timer at the
   * end is what puts her back, whatever the move did: every move is built
   * to finish inside its `USE_MS`, and the timer does not care whether it
   * did. A move that left her lying on the bed for ever would be a game
   * that had stopped listening.
   *
   * Except that some of them are *meant* to leave her there. A lasting use
   * — see `LASTING` — ends its timer settled rather than stood up: from
   * then on she stays, and the next tap anywhere is what gets her off. That
   * is not the game not listening; it is the game having been asked to sit
   * her down, and waiting to be asked the next thing.
   */
  private useThing(use: Use, cells: readonly GridPoint[], head?: GridPoint): void {
    // Not mid-step: a hop kills the tweens on her, and the walking tween is
    // what clears `isMoving` — killed, it would leave her unable to walk
    // ever again. The ring closes on the step anyway; this is the frame in
    // between.
    if (this.modalOpen || this.isMoving || cells.length === 0) return;
    const her = this.session.tile;
    const nearest = cells.reduce((best, cell) =>
      stepsToSpeak(her, cell) < stepsToSpeak(her, best) ? cell : best,
    );
    if (stepsToSpeak(her, nearest) > 1) {
      this.markRefusal(nearest.col, nearest.row);
      this.markTooFar(nearest.col, nearest.row);
      return;
    }
    const toward =
      facingForVector(nearest.col - her.col, nearest.row - her.row) ?? this.playerFacing;
    this.session.face(toward);
    this.joystick?.release();
    this.path = [];
    this.playerGesture = null;
    this.using = use;
    const home = this.toFeet(her.col, her.row);
    // The near edge of the thing, a hair in front of it: her feet are her
    // depth, so landing there draws her on the bench rather than behind it.
    // The middle of that edge, for a thing wider than a square.
    const bottom = Math.max(...cells.map((cell) => cell.row));
    const edge = cells
      .filter((cell) => cell.row === bottom)
      .map((cell) => this.toFeet(cell.col, cell.row));
    const there: ScreenPoint = {
      x: edge.reduce((sum, at) => sum + at.x, 0) / edge.length,
      y: (edge[0]?.y ?? home.y) + ON_THING_NUDGE,
    };
    // Sleeping is done with her head on the pillow, which may be the far
    // end; she is still sorted in front of the whole bed from there.
    const pillow = head ? this.toFeet(head.col, head.row) : null;
    const lying: ScreenPoint =
      use === Use.Nap && pillow ? { x: pillow.x, y: pillow.y + ON_THING_NUDGE } : there;
    if (isOnTheThing(use)) this.perchDepth = there.y;
    this.performUse(use, toward, home, isOnTheThing(use) ? lying : home);
    this.time.delayedCall(USE_MS[use], () => {
      // The moon rises off her, and she is at the pillow end.
      if (isLasting(use)) this.stay(use, home, toward, use === Use.Nap && head ? head : nearest);
      else this.standBack(home, toward);
    });
  }

  /** Where she was, as she was: the end of every use. */
  private standBack(home: ScreenPoint, toward: Facing): void {
    this.perchDepth = null;
    this.tweens.killTweensOf(this.player);
    this.player.setPosition(home.x, home.y).setAngle(0).setScale(1).setDepth(home.y);
    this.session.face(toward);
    this.playerGesture = null;
    this.using = null;
  }

  /**
   * Settled on something, and staying.
   *
   * What runs from here is what she does while she waits — a breath, a
   * bob, a moon — and all of it is on a loop, because there is no knowing
   * how long she will be left there. Every loop is killed by `standUp`.
   */
  private stay(use: Use, home: ScreenPoint, toward: Facing, cell: GridPoint): void {
    this.rest = { home, toward };
    const breathe = (from: number, ms: number) =>
      this.tweens.add({
        targets: this.player,
        scaleY: from + 0.02,
        duration: ms,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    switch (use) {
      case Use.Sit:
        breathe(SIT_SQUASH, 900);
        return;
      case Use.Nap:
        breathe(NAP_SQUASH - 0.02, 700);
        this.restLoop = this.time.addEvent({
          delay: NAP_MOON_MS,
          loop: true,
          callback: () => this.showResult(UiAsset.MarkNight, cell.col, cell.row),
        });
        return;
      case Use.Splash:
        this.tweens.add({
          targets: this.player,
          y: this.player.y + 3,
          scaleX: 1.08,
          scaleY: 0.92,
          duration: 180,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
        return;
      default:
        return;
    }
  }

  /**
   * Up off the chair, the bed or the bath, and back to where she was.
   *
   * A hop rather than a cut, because getting on was one. Taps go on doing
   * nothing until she lands — `using` is still set — so a child who taps
   * twice gets one hop, not one hop and a walk.
   */
  private standUp(): void {
    const rest = this.rest;
    if (!rest) return;
    this.rest = null;
    this.restLoop?.remove();
    this.restLoop = null;
    this.hop(rest.home, () => this.standBack(rest.home, rest.toward));
  }

  /**
   * The moves themselves: a few tweens on her sprite, and the odd mark.
   *
   * Built out of what the art already has. The sheet holds idle, walk and
   * one bend, so sitting is a hop and a sink, sleeping is a slower sink with
   * a moon or two, washing is the bend twice, and a twirl is the four
   * facings in a ring. None of it is a new drawing, and all of it reads,
   * which is the argument for doing it this way rather than waiting for a
   * sitting frame that would have to be drawn for six bodies.
   */
  private performUse(use: Use, toward: Facing, home: ScreenPoint, there: ScreenPoint): void {
    const her = this.session.tile;
    const at = (ms: number, act: () => void) => this.time.delayedCall(ms, act);
    switch (use) {
      // The three that last only get her on and settled here. What she does
      // once she is there is `stay`'s, because it has to go on for as long
      // as she is left, and getting off is `standUp`'s.
      case Use.Sit:
        this.hop(there, () => {
          this.session.face(Facing.Down);
          this.settle(SIT_SQUASH);
        });
        return;
      case Use.Nap:
        this.hop(there, () => {
          this.session.face(Facing.Down);
          this.settle(NAP_SQUASH);
        });
        return;
      case Use.Splash:
        this.hop(there, () => this.session.face(Facing.Down));
        return;
      case Use.Swing:
        // Through and straight back: a gate is for going through.
        this.hop(there, () => at(60, () => this.hop(home)));
        return;
      case Use.Wash:
        this.playGesture(PLANT);
        at(650, () => this.playGesture(PLANT));
        return;
      case Use.Peek:
        this.playGesture(PLANT);
        at(600, () => this.showResult(UiAsset.MarkGlad, her.col, her.row));
        return;
      case Use.Warm:
        this.wriggle(3, 5, 80);
        at(300, () => this.showResult(UiAsset.MarkGlad, her.col, her.row));
        return;
      case Use.Twirl: {
        const round: readonly Facing[] = [Facing.Left, Facing.Up, Facing.Right, Facing.Down];
        for (let turn = 0; turn < 8; turn++) {
          at(TWIRL_STEP_MS * (turn + 1), () => this.session.face(round[turn % 4] ?? toward));
        }
        at(TWIRL_STEP_MS * 9, () =>
          this.tweens.add({
            targets: this.player,
            y: home.y - 10,
            duration: 140,
            yoyo: true,
            ease: "Quad.easeOut",
          }),
        );
        return;
      }
      case Use.Lean: {
        // Sideways she tilts toward it; front-on she leans over it, which
        // from above is being a little shorter.
        const tilt =
          toward === Facing.Left ? -LEAN_DEGREES : toward === Facing.Right ? LEAN_DEGREES : 0;
        this.tweens.add({
          targets: this.player,
          angle: tilt,
          scaleY: tilt === 0 ? LEAN_FORWARD : 1,
          duration: 220,
          hold: 600,
          yoyo: true,
          ease: "Quad.easeOut",
        });
        return;
      }
    }
  }

  /** A little jump from where she is to a point, landing with the callback. */
  private hop(to: ScreenPoint, onLand?: () => void): void {
    const from = { x: this.player.x, y: this.player.y };
    this.tweens.killTweensOf(this.player);
    this.player.setAngle(0).setScale(1);
    this.tweens.add({ targets: this.player, x: to.x, duration: HOP_MS, ease: "Linear" });
    this.tweens.add({
      targets: this.player,
      y: Math.min(from.y, to.y) - HOP_RISE,
      duration: HOP_MS / 2,
      ease: "Quad.easeOut",
      onComplete: () =>
        this.tweens.add({
          targets: this.player,
          y: to.y,
          duration: HOP_MS / 2,
          ease: "Quad.easeIn",
          onComplete: onLand,
        }),
    });
  }

  /** Sink a little, the way sitting down is shorter than standing. */
  private settle(squash: number): void {
    this.tweens.add({
      targets: this.player,
      scaleY: squash,
      duration: SETTLE_MS,
      ease: "Quad.easeOut",
    });
  }

  /** Shiver side to side about where she stands. */
  private wriggle(px: number, times: number, ms: number): void {
    const x = this.player.x;
    this.tweens.add({
      targets: this.player,
      x: x + px,
      duration: ms,
      yoyo: true,
      repeat: times,
      ease: "Sine.easeInOut",
      onComplete: () => this.player.setX(x),
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
    this.lighting.snuffLamp(col, row);
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

  /**
   * Pick one square of a patch the sharing spell has just been cast on.
   *
   * `tryHarvest` without the aiming or the message: the spell says which
   * squares, and every one of them says so on itself the way a grown crop
   * does. The basket is told once at the end rather than per square — see
   * `applyToPatch`.
   */
  private pickCropAt(col: number, row: number): void {
    if (!this.session.harvestAt(col, row).ok) return;
    const key = tileKey(col, row);
    this.cropSprites.get(key)?.destroy();
    this.cropSprites.delete(key);
  }

  private tryHarvest(): void {
    if (this.modalOpen) return;
    const result = this.session.harvest();
    this.report(result, result.crop ? cropIcon(result.crop.plant) : undefined);
    if (!result.ok || !result.tile) return;
    sound().effect(Sfx.Harvest);
    this.noteDeed(Deed.Picked);

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

  /**
   * The seed the pouch was last asked for.
   *
   * One answer for three routes: the number keys, the pouch's own buttons,
   * and now the patch that plants a whole rectangle of it. A patch action
   * that chose its own crop would be a second way of picking a seed, and a
   * child would have no way to tell which of the two the game was using.
   */
  private selectedPlant(): PlantType {
    return PLANT_TYPES[this.selectedPlantIndex] ?? (PLANT_TYPES[0] as PlantType);
  }

  private tryPlant(): void {
    this.plantSeed(this.selectedPlant());
  }

  /** One seed, into whichever square `targetTile` says. */
  private plantSeed(plant: PlantType): void {
    if (this.modalOpen) return;

    const result = this.session.plant(plant);
    this.report(result, cropIcon(plant), plant);
    if (!result.ok || !result.tile) return;
    // On the route a person takes, not on `plantCropAt` — that one is the
    // patch putting sixteen seeds down at once and is nobody's single
    // action. The patch gets one sound of its own, the same way it gets one
    // bend of the back rather than sixteen.
    sound().effect(Sfx.Seed);
    this.noteDeed(Deed.Planted);

    const { col, row } = result.tile;
    this.spawnCropSprite(col, row, { plant, stage: PLANTED_STAGE });
    this.playGesture(PLANT);
  }

  /**
   * One seed into one named square.
   *
   * For the patch, which plants a rectangle of them and has already asked
   * the session which squares will take one. It must not go back through
   * `plant`, which asks about the square she is *facing* — sixteen times
   * over, and every one of them the same square.
   *
   * No effect drawn on it, and none needed: sixteen seedlings coming up
   * together is the picture. The plus belongs to the spell that grows them,
   * and drawing it here would say a thing had grown that has only been
   * sown.
   */
  private plantCropAt(plant: PlantType, col: number, row: number): void {
    if (!this.grid.plant(col, row, plant)) return;
    this.spawnCropSprite(col, row, { plant, stage: PLANTED_STAGE });
    this.justPlanted = { col, row };
    this.noteDeed(Deed.Planted);
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
    this.onTap(sprite, () => {
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
        // Filled in by `showThought` below, which every mood change goes
        // through as well.
        thinking: [],
      };
      sprite.setInteractive({ useHandCursor: true });
      this.onTap(sprite, () => {
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
  private firstMood(): Mood {
    return firstMood(this.time.now, (min, max) => Phaser.Math.Between(min, max), this.alwaysHungry);
  }

  /**
   * What it likes, for a beat, over an animal tapped while it is not asking.
   *
   * Reported from a playtest: *tapping the rabbit didn't bring up any food,
   * just an empty rabbit*. This used to be a cloud with nothing in it, and
   * five of a village's seven animals are quiet at any moment — so a child
   * who taps two or three of them meets empty cloud after empty cloud and
   * puts the creatures down as scenery. The crop it craves says what a
   * rabbit is *for* without asking for anything; see `thoughtFor`.
   *
   * Kept apart from `showThought`, which owns the animal's own bubble,
   * because this is a moment rather than a mood: it must not survive the
   * tap, and it must not overwrite what the animal is thinking if it starts
   * thinking something. `thinking` is put back to what the mood says the
   * instant the cloud goes, for the same reason.
   */
  private puffThought(animal: AnimalRuntime): void {
    if (animal.bubble) return;
    const thinking = thoughtFor(animal.mood, true);
    if (thinking.length === 0) return;
    animal.thinking = thinking;
    const cloud = this.world(this.cloudOf(animal, thinking));
    cloud.setPosition(
      animal.sprite.x - BUBBLE_W / 2,
      animal.sprite.y - animal.sprite.displayHeight - BUBBLE_LIFT,
    );
    cloud.setDepth(animal.sprite.depth + 0.5);
    this.tweens.add({
      targets: cloud,
      alpha: 0,
      duration: TAPPED_THOUGHT_MS,
      ease: "Quad.easeIn",
      onComplete: () => {
        cloud.destroy();
        animal.thinking = thoughtFor(animal.mood, false);
      },
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
    const next = moodAfter(
      animal.mood,
      now,
      (min, max) => Phaser.Math.Between(min, max),
      this.alwaysHungry,
    );
    animal.mood = next.mood;
    animal.moodUntil = next.moodUntil;
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
    const thinking = thoughtFor(animal.mood, false);
    animal.thinking = thinking;
    if (thinking.length === 0) return;
    animal.bubble = this.world(this.cloudOf(animal, thinking));
    this.placeBubble(animal);
  }

  /**
   * A cloud with those pictures laid out along its inner slot.
   *
   * Shared by the bubble an animal wears and the one a tap puts up for a
   * moment, which is the whole reason it is its own method: the two used to
   * be built by different code, and the momentary one was built with no
   * slots at all — an empty cloud, because that was all it ever had to say.
   *
   * The food is whichever crop *this* animal craves. `AnimalThought` names the
   * three pictures and knows nothing about textures; this is where they
   * become art.
   */
  private cloudOf(
    animal: AnimalRuntime,
    thinking: readonly AnimalThought[],
  ): Phaser.GameObjects.Container {
    const marks = thinking.map((mark) =>
      mark === AnimalThought.Food
        ? cropIcon(animal.craves)
        : mark === AnimalThought.Question
          ? UiAsset.MarkQuestion
          : UiAsset.MarkGlad,
    );
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
    return this.add.container(0, 0, [cloud, ...drawn]);
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
   * The reach is `SPEAK_REACH`, the same one a person answers on, diagonals
   * included — a chicken standing at your corner is a chicken you can hand a
   * carrot to, and refusing it would be a rule with no reason a child could
   * see. Two squares rather than one, because a chicken is the fastest
   * moving thing in the village and aiming at one is aiming at where it was.
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
    if (!withinSpeaking(this.session.tile, { col: animal.col, row: animal.row })) {
      this.markRefusal(animal.col, animal.row);
      this.markTooFar(animal.col, animal.row);
      return;
    }
    if (animal.mood !== AnimalMood.Asking) {
      // What it likes, for a beat. Silence on a tap reads as the game having
      // missed the tap, and an empty cloud — which is what stood here — read
      // as an animal that has nothing to do with anything. The crop says
      // *this one is about carrots, only not now*, which is both true and
      // worth knowing later.
      this.puffThought(animal);
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

  /** Whether this child has been taught a spell — the marks' one question. */
  private knows(spell: Spell): boolean {
    return knowsSpell([...this.profile.learned, ...this.dev.learned], spell);
  }

  /**
   * Everybody on screen who might have something to teach, and where they
   * stand.
   *
   * Three sources and one answer. Whoever is behind the counter or the desk
   * of the room she is in — one at a time, because a room has one. Everybody
   * out of doors, which is where the clockmaker and the fisherman are. And
   * the great tree, which is a teacher that is a thing rather than a person
   * and simply stands still.
   *
   * Every one of them placed through `toFeet`, because that is how anything
   * standing on ground is placed here. See `LIFT`.
   */
  /**
   * A minus rune over every square of the tree's wood still standing.
   *
   * The errand is twelve subtractions and the game never said so anywhere a
   * child could see it: the tree asks in a parchment she has to walk up to
   * and read, and then she is standing in a wood with no sign of what to do
   * to it. The rune is the sign, on each square that still wants it, and it
   * goes out square by square as she clears them — so the wood also counts
   * down how much of the errand is left.
   *
   * Only while the wood is what is wanted. Once it is down the beds want
   * planting, and a minus over a bed would be the wrong spell entirely.
   */
  private woodToClear(): Standing[] {
    const marks: Standing[] = [];
    for (const at of this.woodStillStanding()) {
      const feet = this.toFeet(at.col, at.row);
      marks.push({
        part: `wood:${at.col},${at.row}`,
        feet: { ...at, x: feet.x, y: feet.y },
        rune: RUNE_OF[Spell.Clearing],
      });
    }
    return marks;
  }

  /** Every square of the tree's wood still up, in world order. */
  private woodStillStanding(): GridPoint[] {
    if (this.interior || this.groveDone) return [];
    return this.grove.thicket
      .filter((at) => this.worldGrid.getObjectAt(at.col, at.row) !== null)
      .filter(
        (at) =>
          Math.max(Math.abs(at.col - this.playerCol), Math.abs(at.row - this.playerRow)) <=
          GUIDE_GROVE_REACH,
      )
      .map((at) => ({ col: at.col, row: at.row }));
  }

  /** The first square of the beds with nothing growing in it, or null. */
  private firstEmptyGroveSquare(): GridPoint | null {
    if (this.interior) return null;
    for (const bed of this.grove.beds) {
      for (const at of patchCells(bed)) {
        if (this.worldGrid.getCrop(at.col, at.row) === null) return { col: at.col, row: at.row };
      }
    }
    return null;
  }

  private teachersOnScreen(): Standing[] {
    const here: Standing[] = [];
    const at = (part: string, cell: GridPoint) => {
      const feet = this.toFeet(cell.col, cell.row);
      here.push({ part, feet: { ...cell, x: feet.x, y: feet.y } });
    };
    const attendant = this.attendantCell;
    if (attendant && this.attendantId) at(this.attendantId, attendant);
    if (!this.interior) {
      for (const npc of this.npcs) {
        at(this.npcRoles.get(npc.id) ?? npc.id, { col: npc.col, row: npc.row });
      }
      at(GREAT_TREE_ID, this.grove.tree);
    }
    return here;
  }

  /**
   * What tapping each rune does.
   *
   * A record rather than a switch, and exhaustive by its own type: a spell
   * added to `SPELLS` with nothing to cast will not compile, which is the
   * whole reason the tray is built from that list rather than written out.
   */
  private cast(spell: Spell): void {
    const casts: Record<Spell, () => void> = {
      growth: () => this.castGrowthSpell(),
      clearing: () => this.castClearingSpell(),
      portal: () => this.castPortalSpell(),
      array: () => this.castArraySpell(),
      share: () => this.castShareSpell(),
      hourglass: () => this.castHourglass(),
      mirror: () => this.castMirrorSpell(),
      logic: () => this.castLogicSpell(),
    };
    casts[spell]();
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
      const painted = this.houseSheetFor(object.id, sprite);
      const image = this.world(
        this.add
          .sprite(this.originX + origin.x, this.originY + origin.y, spriteSheetKey(painted))
          .setOrigin(0, 0)
          .setDepth(depthFor(footprintBottomY(sidecar, object.row)))
          .play(buildingAnimKey(painted, DoorState.Closed)),
      );
      // A townhouse is five tiles of art over two of ground, so the three
      // cells behind one are painted over exactly the way the beacon paints
      // over the quay — the same bug at a smaller scale and in every street
      // of the city.
      this.noteIfItCouldHideHer(object, sidecar, image);
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
      // Which of its drawings, and whether that drawing is mirrored to get
      // the way round it was put down. Both fall out of the turn; nothing
      // below this line has to know what a turn is.
      const turn = turnFrom(object.turn);
      const sprite = this.spawnFootprintSprite(
        object,
        sidecar,
        fixtureSheetKey(fixture),
        fixtureAnimKey(fixture, drawnLook(turn)),
        false,
        drawnFlip(turn),
      );
      // Machines only. Everything else that comes through here might be the
      // village's own — the well, the fences round somebody else's garden —
      // and there is no telling a child's fence from the generator's once
      // both are standing on the grid. Nothing generates a machine, so every
      // one of these is hers. See `watchMachine`.
      if (isMachine(fixture)) {
        this.watchMachine(sprite, object.col, object.row);
      } else if (object.mine) {
        // Hers, so it can be picked up again — which it could not be, for as
        // long as this only happened at the moment of placing. A fence put
        // down yesterday came back through here and was never made tappable,
        // so it stood in the garden for good. See `PlacedObject.mine` for why
        // the answer is a field rather than a guess.
        this.watchPlacedFixture(sprite, fixture, object.col, object.row);
      }
      // Into the map whatever it is, because both routes out of the world —
      // a tap for a fence, the minus rune for a machine — destroy the sprite
      // through it.
      if (isMachine(fixture) || object.mine) {
        this.placedFixtures.set(tileKey(object.col, object.row), sprite);
      }
      // A lamp has a flame in it and a glowcap glows: both light the ground
      // around them. Noted here rather than by walking the grid every frame:
      // the scene already sees every one of them exactly once, as it puts it
      // on screen.
      if (fixture === FixtureType.Lamp || fixture === FixtureType.Glowcap) {
        this.lighting.lightLamp(object.col, object.row);
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
        this.lighting.lightLamp(object.col, object.row + sidecar.footprint_tiles.height - 1);
      }
      // Only the one that has something to say answers a tap. The other two
      // used to, with a refusal, and it cost more than it looked: a game
      // object under the pointer stops the tap ever reaching the ground (see
      // the `over.length` branch in the input wiring), and this one's hit
      // area is its whole seven and a half tiles of art. So the beacon
      // swallowed every click in a tall column of the quay and answered each
      // with a red cross — which is how a playtest came to report needing to
      // *tap way outside the lighthouse* to get moving again. Left alone, a
      // tap there is a tap on the ground behind it and walks her out.
      if (landmark === LandmarkType.GreatTree) {
        this.watchLandmark(sprite, object, sidecar, () => this.touchLandmark(landmark));
      }
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
  /**
   * Fade whatever the player is standing behind, and bring back what she is
   * not.
   *
   * Reported from a playtest as a big bug: *I got stuck behind the
   * lighthouse. I wandered in and stopped moving.* She was not stuck. The
   * beacon's art is seven and a half tiles tall over the two it stands on,
   * so six cells of quay behind it are painted over — she was walking about
   * under a picture of a tower with nothing on screen to say so, and a
   * character who does not move when you press a key is a character who
   * cannot move.
   *
   * The test is simply whether her feet are inside the art's own rectangle.
   * That is exactly the condition under which it is drawn over her: depth is
   * the y a thing stands on, so anything whose footprint bottom is below her
   * feet sorts in front, and its rectangle ends at that bottom edge. No
   * separate notion of "behind" is needed and none would agree with the
   * picture as reliably as the picture's own arithmetic does.
   *
   * Eased rather than switched, and both ways, so a building gives way as
   * she walks into its shadow and closes again behind her.
   */
  private showThroughWhatHidesHer(): void {
    const x = this.player.x;
    const y = this.player.y;
    let live = 0;
    for (const thing of this.tallThings) {
      const { sprite } = thing;
      // Destroyed since the last pass — a tree taken by the minus spell, or
      // a whole world thrown away and built again.
      if (!sprite.active) continue;
      this.tallThings[live++] = thing;
      // Indoors, nothing out here is on screen and the player's position is
      // a room's, not the world's: every comparison would be nonsense. They
      // are left at whatever they were, which is what they will be found at
      // when she comes back out of the door she went in.
      if (this.interior) continue;
      const hides =
        x >= sprite.x &&
        x < sprite.x + sprite.displayWidth &&
        y > sprite.y &&
        y < sprite.y + sprite.displayHeight;
      const wanted = hides ? HIDDEN_BEHIND_ALPHA : 1;
      if (sprite.alpha === wanted) continue;
      const step = Math.sign(wanted - sprite.alpha) * HIDING_FADE_STEP;
      sprite.setAlpha(
        step > 0 ? Math.min(wanted, sprite.alpha + step) : Math.max(wanted, sprite.alpha + step),
      );
    }
    this.tallThings.length = live;
  }

  /**
   * Put a thing on the list of what has to get out of her way, if it is tall
   * enough to need to be on it.
   *
   * Called from both places a sidecar is turned into a sprite — the
   * footprint path below, which draws fixtures, landmarks, scenery and
   * flowers, and `spawnPlacedObjects`, which draws buildings. Two call sites
   * rather than one because the two paths do not share a function and never
   * have; what they share is this question, so it is asked in one place and
   * answered the same way for a conifer and a clock tower.
   *
   * How tall is "tall enough" is `TALL_ENOUGH_TO_HIDE`, and it is measured
   * off the art rather than listed here: a sheet that grows a taller spire
   * should join this list by being taller, not by somebody remembering.
   */
  private noteIfItCouldHideHer(
    object: PlacedObject,
    sidecar: SheetSprite,
    sprite: Phaser.GameObjects.Sprite,
  ): void {
    const rise =
      (sidecar.sprite_size_px.height - sidecar.footprint_tiles.height * sidecar.tile_size) /
      sidecar.tile_size;
    if (rise < TALL_ENOUGH_TO_HIDE) return;
    this.tallThings.push({ id: object.id, at: { col: object.col, row: object.row }, sprite });
  }

  private spawnFootprintSprite(
    object: PlacedObject,
    sidecar: SpriteSidecar,
    sheetKey: string,
    animKey: string,
    mirror = false,
    turned = false,
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
    // Or the way round it was put down asked for it: the two side-on ways
    // are one drawing and its mirror.
    if (object.flip || turned) sprite.setFlipX(true);
    else if (mirror && variationFor(object.col, object.row, 2) === 1) {
      // Flipped about the sprite's own centre, so the footprint it covers
      // does not move.
      sprite.setFlipX(true);
    }
    sprite.play(animKey);
    sprite.anims.setProgress(variationFor(object.col, object.row, PHASE_STEPS) / PHASE_STEPS);
    this.noteIfItCouldHideHer(object, sidecar, sprite);
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
        .play(
          // The mechanic is at work: the bend the player makes to plant,
          // over and over at her bench, with the sparks the room draws
          // flying off it. Everybody else stands and waits to be spoken to.
          part === MECHANIC_ID
            ? { key: characterAnimKey(characterFor(part, 0), PLANT, Facing.Down), repeat: -1 }
            : characterAnimKey(characterFor(part, 0), IDLE, Facing.Down),
        ),
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
    if (part === FISHER_ID)
      this.watchAttendant(
        sprite,
        () => cell,
        () => this.meetFisher(),
      );
    if (part === ASTRONOMER_ID)
      this.watchAttendant(
        sprite,
        () => cell,
        () => this.meetAstronomer(),
      );
    if (part === MECHANIC_ID)
      this.watchAttendant(
        sprite,
        () => cell,
        () => this.meetMechanic(),
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
    this.onTap(sprite, () => {
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
  /**
   * Where the map marks her, which is not always where she is standing.
   *
   * Indoors her tile is a *room* coordinate — a handful of cells across a
   * cottage floor — and the world map drew that as a mark in the far
   * north-west corner of the world, because column three row four is a
   * perfectly good world cell and happens to be up there. The one map a
   * child can reach is the one on the post office wall, so this was true of
   * the only time it was ever looked at.
   *
   * A room is *at* somewhere, and `returnTo` is where: the cell she walked in
   * from, remembered so she can be put back on it. That is the mark a map of
   * the world should carry — the building she is standing in.
   */
  private whereOnTheMap(): GridPoint {
    return this.interior?.returnTo ?? this.session.tile;
  }

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
    // Only when it actually changes hands. This is called on the way in and
    // on the way out, and also by `leaveInterior` on its way to putting the
    // origin back — a door that sounded on all three would give a child two
    // doors for one step through it.
    if ((this.interior === null) !== (interior === null)) sound().effect(Sfx.Door);
    this.interior = interior;
    this.session.indoors = interior !== null;
    // Nothing pointed at survives a doorway either — `enterInterior` says
    // the same of the marked-out patch, and this is the other half of it.
    //
    // The square she picked is a fact about the grid she was standing on,
    // and this line is what changes the grid. Left alone it went on
    // answering `targetTile` with a coordinate out in the village, so the
    // first chair she put down in a room was placed several hundred tiles
    // away in the garden; and the ring round it came in through the door on
    // the layer that follows her, drawn at pixels that mean nothing in here.
    // A stuck target and a stuck ring, from one square nobody dropped.
    //
    // Wiped rather than repainted: `leaveInterior` calls this before it puts
    // the origin back, and `paintAim` measures from the origin.
    this.session.aimAt(null);
    this.aimInk?.clear();
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
   * The shop is the exception to the *soft furnishings* half, and it is the
   * exception for a plain reason: a warehouse has none. Its room is barrels,
   * crates and a counter, so it repaints its walls — see `roomSlotsFor`. A
   * fabric ramp the art never draws is a recolour nobody can see, and the
   * complaint being answered here is that the shops *look exactly the same
   * once you go in*.
   *
   * The school and the post office get exactly one copy each, because there
   * is one of each.
   */
  private roomSheetFor(buildingId: string, room: string, sidecar: InteriorSidecar): string {
    if (!varies(room)) return room;
    const options = (sidecar.fabric_options ?? []) as Ramp[];
    const shipped = rampOf((sidecar.palette ?? {}) as Record<string, Rgb>, roomSlotsFor(room));
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
    turn: number,
    x: number,
    y: number,
    depth: number,
  ): Phaser.GameObjects.Sprite {
    const art = pieceArt(piece);
    const key = growablePieceKey(GROWABLE_ROOM, art);
    // One animation per way round, the way a fixture has one per drawing.
    // A strip with three ways round played end to end is a stove spinning
    // on the spot — which is what a single animation over `frame_count`
    // does the moment a piece gains a second look.
    const look = drawnLook(turn);
    const animKey = `${growablePieceAnimKey(GROWABLE_ROOM, art)}-${look}`;
    if (!this.anims.exists(animKey)) {
      this.anims.create({
        key: animKey,
        frames: this.anims.generateFrameNumbers(key, {
          frames: flowerFrames(look, framesPerLook(this.growable?.piece_sheets[art])),
        }),
        frameRate: BUILDING_ANIM_FPS,
        repeat: -1,
      });
    }
    const sprite = this.add.sprite(x, y, key).setOrigin(0, 0).setDepth(depth);
    sprite.setFlipX(drawnFlip(turn));
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
    this.lighting.snuffHearth();
    for (const placed of this.decorIn(inside.house)) {
      // The size it is *lying* at, not the size it was drawn: a bed turned
      // across the room is two cells wide and one deep, and its depth and
      // the square a tap on it reaches both follow from that.
      const size = sizeOf(placed.piece, decorTurnOf(placed), sizes);
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
      const turn = decorTurnOf(placed);
      const sprite = this.world(
        art?.animated
          ? this.playPiece(placed.piece, turn, x, y, depth)
          : this.add
              .image(
                x,
                y,
                this.decorTexture(placed.piece, placed.look),
                drawnLook(turn) *
                  framesPerLook(this.growable?.piece_sheets[pieceArt(placed.piece)]),
              )
              .setOrigin(0, 0)
              .setFlipX(drawnFlip(turn))
              .setDepth(depth),
      );
      if (art?.light === LightKind.Fire) {
        this.lighting.lightHearthAt({
          col: placed.col - inside.origin.col,
          row: placed.row - inside.origin.row,
        });
      }
      // A tile-sized hit area at its foot, the same as a placed fence has:
      // the art of a bed is eighty pixels tall and a tap anywhere on the
      // bedding should reach it, but a tap on the wall behind it should not.
      //
      // Measured *down from the rise* rather than up from the bottom of the
      // frame, which is the same thing for a piece that fills its frame and
      // not for one that no longer does. A sheet now holds every way round
      // of a piece on one frame size — big enough for the widest and the
      // tallest — so a bed turned across the room leaves a cell of
      // transparency below it, and a hit area anchored to the frame's foot
      // landed in that empty strip. The piece was there on screen and could
      // not be picked up.
      sprite.setInteractive(
        new Phaser.Geom.Rectangle(
          0,
          parts.piece_rise_px,
          size.cols * TILE_SIZE,
          size.rows * TILE_SIZE,
        ),
        Phaser.Geom.Rectangle.Contains,
      );
      // Every square it stands on, in grid coordinates, so the question can
      // be asked over the middle of a bed rather than its corner and the
      // answer measured to whichever end of it she is nearest.
      const cells: GridPoint[] = [];
      for (let dRow = 0; dRow < size.rows; dRow++) {
        for (let dCol = 0; dCol < size.cols; dCol++) {
          cells.push({
            col: placed.col - inside.origin.col + dCol,
            row: placed.row - inside.origin.row + dRow,
          });
        }
      }
      // The pillow end of a bed, where she sleeps. The bed's corner in grid
      // coordinates is the first cell listed.
      const corner = cells[0];
      const head =
        placed.piece === DecorType.Bed && corner
          ? pillowOf(decorTurnOf(placed), corner)
          : undefined;
      this.onTap(sprite, () => {
        this.offerActions(placed.piece, cells, () => this.takeDecor(placed), head);
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
    this.onTap(sprite, () => {
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
    sound().effect(Sfx.Harvest);
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
      this.showWhereToFind(flower);
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
  /**
   * Open one group of the crate, without shutting the crate.
   *
   * The tray is re-stacked rather than closed and reopened: reopening would
   * run `onOpen`, which shuts every other tray, and shutting things that
   * are already shut is how a tray ends up flickering.
   */
  private openCrateGroup(group: CrateGroup): void {
    this.crateGroup = group;
    this.noteDeed(Deed.OpenedGroup);
    this.crateTray?.setOpen(true);
    this.crateTray?.restack();
  }

  /** The picture on a group's button: the first thing in it, as the crate draws it. */
  private crateFace(group: CrateGroup): string {
    const face = faceOf(group);
    if (face === null) return uiTextureKey(UiAsset.Crate);
    return (DECOR_TYPES as readonly string[]).includes(face)
      ? growablePieceKey(GROWABLE_ROOM, pieceArt(face as DecorType))
      : uiTextureKey(itemIcon(face as FixtureType));
  }

  /** How many of one crate thing she has, whichever kind of thing it is. */
  private crateHeld(thing: CrateThing): number {
    return (DECOR_TYPES as readonly string[]).includes(thing)
      ? this.decorHeld(thing as DecorType)
      : this.inventory.count(thing as FixtureType);
  }

  /** Which way round the thing in her hands is, or facing us if it is not one that turns. */
  private get armedTurn(): Turn {
    const held = this.armed;
    if (held?.kind === "fixture" || held?.kind === "decor") return turnFrom(held.turn);
    return Turn.Toward;
  }

  /**
   * Turn the thing she is holding, by tapping the picture of it.
   *
   * **The picture over her head is the control**, which is why there is no
   * new button anywhere. It is already on screen for exactly as long as the
   * gesture is available, it is already the thing being talked about, and
   * tapping it shows the answer rather than describing it — the bench above
   * her turns, and that *is* the preview. A rotate button beside the aim
   * square would need an icon nobody has drawn and a corner of a phone that
   * is already full.
   *
   * It also cannot be confused with putting the thing away, which is the
   * other gesture in reach: that is a second tap on its button in the crate,
   * and this is a tap on her own hands.
   */
  private turnArmed(): void {
    const held = this.armed;
    // Two kinds of thing turn, and turning them is the same gesture: a tap
    // on the picture of what she is holding. A chair indoors and a bench
    // outdoors are the same verb and should feel like it, which is why this
    // is one method rather than a second control that happens to look the
    // same — and why the drawing and the sheet are worked out here, once,
    // rather than in two places that agree until they do not.
    const drawn =
      held?.kind === "fixture"
        ? {
            drawings: turnsOf(held.fixture),
            sheet: fixtureSheetKey(held.fixture),
            per: this.fixtureSidecars.get(held.fixture)?.frames_per_look ?? 1,
          }
        : held?.kind === "decor"
          ? {
              drawings: turnsOfPiece(held.piece),
              sheet: this.decorTexture(held.piece, held.look),
              per: framesPerLook(this.growable?.piece_sheets[pieceArt(held.piece)]),
            }
          : null;
    if (!held || !drawn || drawn.drawings <= 1) return;
    if (held.kind !== "fixture" && held.kind !== "decor") return;
    const turn = nextTurn(turnFrom(held.turn), drawn.drawings);
    this.armed = { ...held, turn };
    // The same picture repainted, *not* a new one.
    //
    // Destroying it and raising another looked identical and was not: this
    // runs from the rune's own tap handler, which fires before the scene's,
    // and the scene then asks whether the tap landed on `this.armedRune` —
    // by then a different object from the one the pointer actually hit. The
    // check missed, the tap fell through to the placement, and turning a
    // bench put it on the ground instead.
    const rune = this.armedRune;
    if (!rune) return;
    rune.setTexture(drawn.sheet, drawnLook(turn) * drawn.per);
    rune.setDisplaySize(RESULT_ICON, RESULT_ICON);
    rune.setFlipX(drawnFlip(turn));
    this.placeArmedRune();
  }

  private armFixture(fixture: FixtureType): void {
    if (this.inventory.count(fixture) <= 0 && !this.buildMachine(fixture)) {
      this.showRefusalOnPlayer(itemIcon(fixture));
      return;
    }
    this.arm({ kind: "fixture", fixture, turn: Turn.Toward }, uiTextureKey(itemIcon(fixture)));
  }

  /**
   * Make one, out of what the world gave up, and put it in her hands.
   *
   * The slot for a machine is in the crate whether she has one or not — the
   * spellbook's dimmed rune, in the tray next door — so tapping it is what
   * *builds* one, and the same tap then arms it. There is no workshop to
   * walk to and no second panel: a child with fifteen wood and six stone
   * taps the picture of the thing and is holding one.
   *
   * What it refuses with is the same thought bubble a room she cannot afford
   * to grow into puts over her head: the materials wanted, and a cross
   * beside them rather than over them. That is the difference between "you
   * cannot have this" and "this is made of wood and stone" in a game that
   * says nothing in words, and it is already the answer everywhere else
   * something costs materials.
   */
  private buildMachine(fixture: FixtureType): boolean {
    if (!isMachine(fixture)) return false;
    if (!build(this.inventory, fixture)) {
      this.showCostOnPlayer(recipeFor(fixture).map(([material]) => materialIcon(material)));
      // Handled either way: the bubble has already said what is wanted, and
      // falling through would cross out the machine on top of it.
      return false;
    }
    this.inventory.add(fixture, 1);
    this.refreshCarried();
    return true;
  }

  /** A piece of furniture, in the colour she picked, waiting for a square. */
  private armDecor(piece: DecorType, look: number): void {
    this.arm(
      { kind: "decor", piece, look, turn: Turn.Toward },
      this.decorTexture(piece, look),
      drawnLook(Turn.Toward) * framesPerLook(this.growable?.piece_sheets[pieceArt(piece)]),
    );
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
  private putDecorDown(piece: DecorType, look: number, turn: number): void {
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
      turn,
    );
    const at: Placed = { piece, look, turn, col: corner.col, row: corner.row };
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
      // And she is still holding it, the way a spell aimed out of reach
      // stays lit — see `castArmedAt`, which makes exactly this argument
      // about a finger that lands a square wide. It matters more here than
      // it did: a piece that has been turned is a piece a child has already
      // spent taps on, and turning is *when* a refusal happens, because
      // turning is what makes a bed ask for a square it was not asking for
      // before. Losing the turn on every near miss would make the two-cell
      // furniture the most annoying thing in the room.
      this.arm(
        { kind: "decor", piece, look, turn },
        this.decorTexture(piece, look),
        drawnLook(turn) * framesPerLook(parts?.piece_sheets[pieceArt(piece)]),
        drawnFlip(turn),
      );
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
    // The thing the ring was about is about to be redrawn, or is gone.
    this.closeWheel();
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
    if (buildingId === OBSERVATORY_DOME_ID) return STARGAZING_HOURS;
    // The tower never shuts on a child who cannot yet cross the world.
    //
    // Reported from a playtest: start the game after the village has shut
    // and the map is unreachable. The map hangs in the tower, the tower
    // keeps the village's hours, and a five-year-old sat down at bedtime is
    // a five-year-old who cannot see where anything is — which is not a
    // locked door, it is the game refusing to explain itself. (The hours
    // have moved out to nine in the evening since, which shrinks the window
    // this is about without closing it: bedtime is still bedtime.)
    //
    // The hourglass is the answer the game would like to give, and it is a
    // circular one: winding the clock is a spell, spells are learned in
    // buildings, and finding a building is what the map is for. So the door
    // that holds the map is open until she has the spell that makes doors
    // stop mattering — the portal crosses the world, and a child who can
    // cross it can reach the tower at any hour by other means.
    //
    // Not open for ever, because a village where one door never shuts is a
    // village with a rule that has an exception nobody can see the shape of.
    // This one has a shape: *until you can find your own way*.
    if (buildingId === TOWER_ID && !this.knowsPortal) return ALL_HOURS;
    return VILLAGE_HOURS;
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
    // Which way round it is shut. A moon on nearly everything, and a sun on
    // the dome — the two refusals mean opposite things and a child has to be
    // able to tell "they have gone to bed" from "come back when it is dark".
    // Read off the hours the door keeps rather than off a second list, so a
    // building that changed its hours cannot keep the wrong picture.
    const opensAtNight = this.hoursFor(building.id).opensAt > this.hoursFor(building.id).shutsAt;
    // The reason first and the cross second, because the reason is the one
    // that can be refused — one is already up — and a cross drawn beside a
    // moon that is not there says no without saying why. Held against a
    // door, this is now one refusal for as long as the key is down.
    if (!this.floatMark(opensAtNight ? UiAsset.MarkDay : UiAsset.MarkNight)) return;
    this.markRefusal(building.doorCol, building.doorRow);
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
    this.enteredBuilding = building.id;
    if (building.id === STORE_ID) this.noteDeed(Deed.EnteredStore);
    if (building.id === TOWER_ID) this.noteDeed(Deed.ClimbedTower);

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
    this.lighting.lightHearth(sidecar);

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
    const chosen = this.pinch.zoom;
    if (!this.marking) return chosen;
    const camera = this.cameras.main;
    // Her choice is the ceiling, not `CAMERA_ZOOM`. The spell pulls the view
    // out far enough to draw ten squares; a child who has already pulled it
    // further out than that did not ask to be zoomed back in by arming a
    // rune.
    return markingZoom({ width: camera.width, height: camera.height }, TILE_SIZE, chosen);
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
    this.closeWheel();
    interior.canvas?.destroy();
    for (const fire of interior.fires) fire.destroy();
    for (const standing of interior.decor) standing.destroy();
    if (!interior.canvas) interior.image.destroy();
    this.lighting.snuffHearth();
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
    this.chunks.refreshVisibleChunks();
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
        this.npcRoles.set(spec.id, spec.role ?? spec.id);
        // The second outdoor teacher, on the quay, and tapped the same way
        // for the same reason: he keeps a short circuit round the foot of
        // his pier, so where he *is* is not where the harbour put him.
        if ((spec.role ?? spec.id) === FISHER_ID) {
          this.watchAttendant(
            sprite,
            () => {
              const npc = this.npcs.find((one) => one.id === spec.id);
              return { col: npc?.col ?? spec.home.col, row: npc?.row ?? spec.home.row };
            },
            () => this.meetFisher(),
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
            () => this.openDelivery(),
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
   * teacher of that spell who himself went home at nine would be a lock
   * whose key was on the other side of it.
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
    if (this.frozen) {
      for (const npc of this.npcs) {
        if (npc.isMoving) continue;
        // ?intro asks for the welcome and ?news asks for the letter, and
        // both are a walk across the square: the one NPC movement a frozen
        // world is still allowed, or the two seams would cancel each other
        // and neither could be tested from a script at all.
        if ((this.dev.intro || this.dev.news) && this.deliveringIntro(npc)) {
          this.npcDeliverIntroStep(npc);
        } else this.npcRetreatStep(npc);
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
    if (this.frozen) return;
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
      this.delivery !== null &&
      npc.id === POSTAL_WORKER_ID &&
      this.introStepsLeft > 0 &&
      this.playerInVillage &&
      !this.session.indoors &&
      !this.modalOpen
    );
  }

  /**
   * Whether the player is somewhere he could plausibly walk to.
   *
   * **The village box, and no path test.** Asking "can he get there" means
   * running `findPath`, and `findPath` is a breadth-first search of the
   * whole grid — the very cost this gate exists to avoid. A cheap containment
   * test is the only kind that can be asked every frame, and the box is not
   * an arbitrary radius: his round *is* the village, which is the rule
   * `spawnNpcs` already gives him (`PATROL_WANDER_RADIUS`, centred on the
   * square) and the one the design doc states.
   *
   * Without this he would set off for the harbour. That is not hypothetical
   * and it did not need the news to happen: a child who skipped the welcome,
   * walked across the world and closed the tab comes back with their saved
   * position in `col`/`row` and `introSeen` still false, and he would start
   * routing at them from the post office — sixty steps of whole-grid search,
   * one every 230ms. Worse when there is no route at all, because a failed
   * search leaves `introPath` empty, which is exactly the condition that
   * asks for another one: that case re-searches whether or not they move.
   *
   * Outside the box a door opens instead. See `postmanIn`.
   */
  private get playerInVillage(): boolean {
    const box = this.anchors.village;
    const { col, row } = this.session.tile;
    return (
      col >= box.col && row >= box.row && col < box.col + box.width && row < box.row + box.height
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
      this.openDelivery();
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

  /**
   * The other arrival: a door, for a child he cannot walk to.
   *
   * The walk above is the right shape while the player is somewhere his
   * round covers, and it is the *only* shape the game had. That was fine
   * while the only thing he ever delivered was the welcome, which is given
   * in the first minute in a garden twenty tiles from his own door. A letter
   * about what has changed is owed to a child who may be anywhere in a
   * five-hundred-cell world — up the tower, out on the quay — and "he sets
   * off and arrives in four minutes" is not a delivery, it is a rumour.
   *
   * So: inside the village he walks, and outside it the post office opens a
   * door. Which is not him learning the geometer's spell — the spell is
   * something a child earns, and a postman who could cast it would be
   * teaching them otherwise. It is how the post gets about, and he is the
   * man who steps out of it with the letter.
   *
   * Asked every frame and answers on almost none of them, like everything
   * else in `update`: the four conditions are a flag, two integers and a
   * containment test.
   */
  private updatePost(): void {
    if (this.delivery === null || this.postArriving) return;
    // **The door is the letter's, not the welcome's.** A new game starts in
    // the garden, so the welcome is always given inside his round — the only
    // way to be owed one anywhere else is to have skipped it and walked off,
    // and a portal tearing open in front of a child who has been avoiding
    // him is the game insisting. She can tap him, or come home. It also
    // keeps a door out of every scenario that puts a fresh save down on the
    // quay, which is most of them.
    if (this.delivery !== Delivery.News) return;
    // Inside his round he walks, and `updateNpcs` has him. Outside it, this.
    //
    // **Including when he has run out of patience.** A child who spends the
    // whole of `INTRO_PATIENCE_STEPS` running rings round him in the village
    // gets no letter that session — not a door, which would be the loud
    // arrival used as a consolation for the quiet one having failed, in the
    // one place the quiet one is right. She gets it by tapping him, the way
    // the welcome has always worked, or on her next load: the budget is a
    // field initialiser and comes back with the scene, while the letter
    // stays owed in the save until it is actually read.
    if (this.playerInVillage) return;
    if (!this.postReady) return;
    // Not into a room: an interior is its own coordinate space, and a hole
    // cut in a schoolroom floor has no post office on the other side of it.
    // Not over an open sheet. And not under a child mid-step — a door opens
    // in front of somebody who is standing still, or it opens in front of
    // where they were a moment ago.
    if (this.session.indoors || this.modalOpen || this.isMoving) return;
    this.postmanIn();
  }

  /**
   * The door tears open on the tile they are facing, and he comes out of it.
   *
   * The same doorway the player's own crossing builds, and the far end is
   * the post office — painted from the world's own grid by the loop that
   * paints the terrain, so what shows through the hole is the place he is
   * coming from. `travelThrough` makes that rule about the player and it is
   * the whole of what sells the effect; a hole showing anywhere else would
   * be a lie in the one frame the child is looking straight at.
   *
   * What is *not* reused is `travelThrough` itself. That method is about the
   * player: it sets `travelling`, moves `session`, refreshes the chunks
   * round the far end and lands somebody there. None of that is true here —
   * nobody is going anywhere, and the camera does not move at all.
   */
  private postmanIn(): void {
    const him = this.npcs.find((one) => one.id === POSTAL_WORKER_ID);
    // No postman in this world, somehow. Better a letter that never comes
    // than a stranger stepping out of a hole.
    if (!him) return;
    const world = { width: this.grid.width, height: this.grid.height };
    const cell = portalCell(this.session.tile, this.session.facing, world);
    this.postArriving = true;
    this.joystick?.release();
    sound().effect(Sfx.Portal);
    this.openPortal(cell, { col: him.homeCol, row: him.homeRow });

    const feet = this.toFeet(cell.col, cell.row);
    const sprite = this.world(
      this.add
        .sprite(this.portalMiddle.x, this.portalMiddle.y, characterSheetKey(him.character))
        .setOrigin(0.5, 1)
        .setDepth(this.portalDepth + 0.2)
        .setScale(0.12)
        .setAlpha(0.15),
    );
    // Facing back the way he came out, which is at the player: the doorway
    // stands on the tile they are looking at.
    this.playCharacterAnim(sprite, him.character, oppositeFacing(this.session.facing), false);
    this.postman = sprite;

    // Cancelled on success rather than guarded on a flag, for the reason
    // `portalGuard` is: a beat that merely ran long on a cheap tablet would
    // otherwise fire in the middle of the arrival and tear down graphics a
    // tween was still writing to. It covers the arrival only — the sheet
    // after it is open for as long as a child wants to read it, which is not
    // a duration anything can fail to finish within.
    this.postGuard = this.time.delayedCall((PORTAL_OPEN_MS + POST_STEP_MS) * 2, () => {
      this.postGuard = null;
      // Not "open the sheet anyway": a parchment with nobody standing in
      // front of it is the failure this is meant to avoid, said differently.
      // The letter is what the visit was for, so it is left owed and tried
      // again — losing it to one dropped frame is the thing worth avoiding.
      this.abandonArrival();
    });

    this.swingPortal(0, 1, PORTAL_OPEN_MS, () => {
      this.tweens.add({
        targets: sprite,
        x: feet.x,
        y: feet.y,
        scale: 1,
        alpha: 1,
        duration: POST_STEP_MS,
        ease: "Cubic.easeOut",
        onComplete: () => {
          this.postGuard?.remove();
          this.postGuard = null;
          // The sheet is modal in its own right from here, and `openDelivery`
          // refuses to open over anything that already is.
          this.postArriving = false;
          // Which is a refusal that has to be *handled* rather than
          // ignored, even though nothing in the game is currently known to
          // cause it: the arrival is itself modal, so a child cannot open a
          // tray or sit on a chair while he is coming out. That is what
          // makes this defensive rather than live — and it is exactly why it
          // is written down, because the day something else learns to put a
          // sheet up on a timer, `openNews` returning early would leave him
          // standing on the quay forever with nothing in his hands and
          // nothing to send him home. The visit is abandoned instead and the
          // letter left *owed*: `updatePost` brings him back.
          //
          // Untested for the same reason it is unreachable. See `postGuard`,
          // which is the other half of this and just as defensive.
          if (this.modalOpen) {
            this.abandonArrival();
            return;
          }
          this.openDelivery(() => this.postmanOut());
        },
      });
    });
  }

  /**
   * Give up on this visit, keeping the letter.
   *
   * `delivery` is deliberately untouched: whatever went wrong here, he still
   * has something for this child, and the next quiet moment is another
   * chance at it rather than a letter nobody ever gets.
   */
  private abandonArrival(): void {
    this.postmanAway();
    this.armPostArrival();
  }

  /** Hold the door shut for a beat, from now. See `postReady`. */
  private armPostArrival(): void {
    this.postReady = false;
    this.time.delayedCall(POST_ARRIVAL_MS, () => {
      this.postReady = true;
    });
  }

  /** Read, folded away: he steps back through and the door shuts after him. */
  private postmanOut(): void {
    const sprite = this.postman;
    if (!sprite) return;
    this.postArriving = true;
    sound().effect(Sfx.Portal);
    this.postGuard = this.time.delayedCall((POST_STEP_MS + PORTAL_CLOSE_MS) * 2, () => {
      this.postGuard = null;
      this.postmanAway();
    });
    this.tweens.add({
      targets: sprite,
      x: this.portalMiddle.x,
      y: this.portalMiddle.y,
      scale: 0.12,
      alpha: 0.15,
      duration: POST_STEP_MS,
      ease: "Cubic.easeIn",
      onComplete: () => {
        this.swingPortal(1, 0, PORTAL_CLOSE_MS, () => this.postmanAway());
      },
    });
  }

  /**
   * Him gone, the door shut, the failsafe stood down.
   *
   * Both ends call it and so does the failsafe, so it has to survive being
   * called twice — which is why every line of it is idempotent.
   */
  private postmanAway(): void {
    this.postGuard?.remove();
    this.postGuard = null;
    if (this.postman) this.tweens.killTweensOf(this.postman);
    this.postman?.destroy();
    this.postman = null;
    this.closePortal();
    this.postArriving = false;
  }

  // A bounded random walk, not a route to a chosen destination — simple,
  // and "wanders near home" doesn't need anything stronger.
  private npcWanderStep(npc: NpcRuntime): void {
    const direction = STEP_DIRECTIONS[Phaser.Math.Between(0, STEP_DIRECTIONS.length - 1)];
    if (!direction) return;
    const at = { col: npc.col + direction.dCol, row: npc.row + direction.dRow };
    // Villagers and chickens keep to their own level too — one wandering up
    // a cliff would be the clearest possible statement that the cliff is
    // only a picture.
    if (!this.grid.canStep({ col: npc.col, row: npc.row }, at)) return;
    const home = { col: npc.wanderCenterCol, row: npc.wanderCenterRow };
    if (!insideWander(home, npc.wanderRadius, at)) return;
    this.moveNpcTo(npc, at.col, at.row);
  }

  // Greedy step toward home, preferring whichever axis is further off —
  // not a real path, but the village's open square-and-spokes layout means
  // a straight-ish line home rarely needs to route around anything.
  private npcRetreatStep(npc: NpcRuntime): void {
    this.npcStepToward(npc, npc.homeCol, npc.homeRow);
  }

  private npcStepToward(npc: NpcRuntime, toCol: number, toRow: number): void {
    const from = { col: npc.col, row: npc.row };
    // Which squares to try and in which order is `stepsToward`'s, and
    // whether they can be stepped on is the grid's. Neither of those is a
    // fact about sprites, which is why only the moving is left here.
    for (const attempt of stepsToward(from, { col: toCol, row: toRow })) {
      const at = { col: npc.col + attempt.dCol, row: npc.row + attempt.dRow };
      if (this.grid.canStep(from, at)) {
        this.moveNpcTo(npc, at.col, at.row);
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

  /**
   * The two seams that are read every frame, from either source.
   *
   * The address bar wins where it is used at all: a script that asked for a
   * still village gets one whatever a child has since tapped.
   */
  private get frozen(): boolean {
    return this.dev.freezeNpcs || this.debugFreeze;
  }

  private get alwaysHungry(): boolean {
    return this.dev.hungry || this.debugHungry;
  }

  // --- What the scenarios can see -----------------------------------------

  /**
   * Everything a driving script is allowed to ask the running game.
   *
   * It lived inline in `create()` and was half of it — four hundred and
   * ninety-odd lines of getters wedged between setting the input up and
   * laying the HUD out, so that the one method a reader opens first to
   * find out what a scene *is* answered mostly with what a test can see.
   * Nothing about it changed on the way out here; it is the same object,
   * built at the same moment, by a method whose name says what it is for.
   *
   * Not a function in devHooks.ts, where `exposeForTests` itself lives.
   * The literal reads sixty-seven of this class's private members, and a
   * free function could only be given them by making them public — which
   * would open the whole scene to the world in order to tidy one method.
   *
   * Every entry but the first is lazy on purpose: a scenario reads these
   * long after `create()` has returned, so they have to be questions asked
   * of the scene now rather than answers copied out of it then. `session`
   * is the exception because the session object itself never changes.
   */
  private devHandle(): DevHandle {
    return {
      session: this.session,
      ui: () => this.uiPositions(),
      // Whether the world map is up. There is exactly one way to open it —
      // tapping the picture on the post office wall — and no other sign on
      // screen that it worked: the panel is a picture of a world that is
      // also on screen behind it.
      mapOpen: () => this.mapPanel?.isOpen === true,
      armed: () => armedTag(this.armed),
      // And the square it will land on, which is not the same question: the
      // rune says a spell is waiting, this says where it is pointed.
      aimed: () => this.session.aimed,
      // Which way round the thing in her hands is. Its own seam rather than
      // part of `armed`, which is a name several scenarios compare against
      // and which should go on meaning what it has always meant.
      armedTurn: () => this.armedTurn,
      telling: () => this.thingPanel?.telling ?? null,
      // The move she is making at a thing, while she makes it. Nothing else
      // can see one: it changes nothing in the world, which is the point of
      // it and also what makes a use that never played look exactly like
      // one that did.
      using: () => this.using,
      /** Whether she is settled on something and waiting to be got up. */
      resting: () => this.rest !== null,
      marking: () => this.marking?.action ?? null,
      teaching: () => this.teacherMarks?.showing() ?? [],
      grove: () => ({
        col: this.grove.doorstep.col,
        row: this.grove.doorstep.row,
        tree: { col: this.grove.tree.col, row: this.grove.tree.row },
        thicket: this.grove.thicket.map((at) => ({ col: at.col, row: at.row })),
      }),
      /**
       * Which spells this child has been taught.
       *
       * The profile's own list rather than the seam that seeds it, so a
       * scenario can watch one being *earned* — which is the only way to
       * check that a teacher pays at the moment it is supposed to.
       */
      spells: () => [...this.profile.learned],
      /**
       * Every machine in the world and what it is holding.
       *
       * Nothing else can see this. A machine's state is not an object on the
       * grid, not in the basket and not on screen beyond three little heaps
       * of pixels in three crates — so a sorter that had quietly stopped
       * dealing, or one that dealt without ever being woken, would look
       * exactly like one that was working.
       */
      machines: () =>
        [...this.machines].map(([where, state]) => ({
          where,
          awake: state.awake,
          holding: state.holding,
          heap: state.heap,
          crates: [...state.crates],
          // How often a bell has rung, which is the one thing a bell does.
          rung: state.rung,
          // What a sieve lets through and what it has caught. Nothing else
          // can see either: a jammed sieve and an idle one look the same
          // from outside, which is exactly the failure worth catching.
          passes: state.passes,
          binned: state.binned,
          bin: state.bin,
          /** What a tally waits for. Nought until it has been shown. */
          mark: state.mark,
          // What the crates hold, which for a machine that turns is not what
          // the mouth holds — and is the difference a scenario cannot see any
          // other way. See `MachineState.made`.
          made: state.made,
          // A press's second funnel and the proportion it was shown. Both
          // are invisible from outside — a press waiting for its other half
          // and a press that has been fed the wrong pair look identical on
          // the ground, and the proportion is a number nothing draws.
          other: state.other,
          otherHeap: state.otherHeap,
          otherMark: state.otherMark,
        })),
      /**
       * Every length of wire, and whether it is actually carrying.
       *
       * The `moved` is the half nothing else can see. A wire that is backed
       * up — the machine at the far end is full of something else — and a
       * wire that was never joined to anything both sit there carrying
       * nothing, and from outside they are the same picture. Without this a
       * scenario cannot tell a line that is correctly stopped from one that
       * never worked at all.
       */
      wires: () =>
        this.wires.map((wire) => ({
          from: wire.from,
          to: wire.to,
          moved: this.wireCarried.get(wireKey(wire.from, wire.to)) ?? 0,
        })),
      /** Which end of a wire she has hold of, part way through stringing one. */
      wiring: () => {
        const held = this.armed;
        if (held?.kind !== "wire" || !held.from) return null;
        return { col: held.from.col, row: held.from.row };
      },
      sea: () => {
        const tiles = this.chunks.waterTiles();
        return {
          tiles: tiles.length,
          phase: this.chunks.seaPhase,
          showing: [...new Set(tiles.map((tile) => tile.image.frame.name))],
          // A handful of named tiles rather than a count, because with sixty
          // frames of sea on screen the *set* of them saturates: every frame
          // there is is showing somewhere, before and after, and a sea that
          // had frozen solid would look identical by that measure. What moves
          // is which tile shows which.
          //
          // Sorted before it is cut down, so the same tiles come back each
          // time. Unsorted this is Map insertion order — which chunk came on
          // screen first — and a script comparing two readings would see the
          // names change whenever a chunk did, which is a green test on a
          // frozen sea.
          sample: tiles
            .sort((a, b) => a.col - b.col || a.row - b.row)
            .slice(0, SEA_SAMPLE)
            .map((tile) => `${tile.col},${tile.row}=${tile.image.frame.name}`),
        };
      },
      stats: () => ({
        fps: Math.round(this.game.loop.actualFps),
        frames: this.chunks.frames,
        renderer: this.game.renderer.type === Phaser.WEBGL ? "webgl" : "canvas",
        objects: this.children.list.length,
        // Everything Phaser calls preUpdate on every frame, which is where a
        // wood of animating trees is actually paid for.
        updating: this.sys.updateList.length,
        view: { width: this.scale.width, height: this.scale.height },
      }),
      // Every fire alight in the room she is in. Was one or none, which is
      // the shape the bug had: a scenario could not have told a room with
      // three stoves from a room with one.
      hearths: () => this.lighting.litHearths(),
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
          // The three numbers and which of them is the box, when the rung
          // asks for a sum with no line under it. Null otherwise, so a
          // scenario can tell the two forms apart — which it otherwise
          // could not: a bare cast runs on a one-jump line, and a one-jump
          // line is also what the gentlest rung in the game sets.
          bare: this.spellPopup?.bareSum ?? null,
        };
      },
      spellHint: () => this.spellPopup?.hintText ?? "",
      thought: () => this.lastThought,
      share: () => {
        const cast = this.sharePopup?.cast;
        if (!cast) return null;
        const { problem } = cast;
        return {
          total: problem.total,
          parts: problem.parts,
          each: problem.each,
          left: problem.left,
          tier: problem.tier,
          box: cast.box,
          boxes: [...boxesOf(problem)],
          typed: { each: cast.each, left: cast.left },
          done: cast.done,
          missteps: cast.missteps,
        };
      },
      mapMark: () => this.whereOnTheMap(),
      sound: () => sound().report(),
      ships: () => this.traffic?.positions() ?? [],
      blimps: () => this.blimps?.positions() ?? [],
      scenery: () => this.chunks.sceneryCount(),
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
        for (const bucket of this.chunks.sceneryBuckets()) {
          for (const object of bucket) if (inside(object)) inView++;
        }
        let live = 0;
        for (const bucket of this.chunks.liveSceneryBuckets()) {
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
        return this.decorIn(inside.house).map((placed) => ({
          piece: placed.piece,
          col: placed.col,
          row: placed.row,
          look: placed.look,
          // Normalised rather than passed through, so a script reads the
          // same number for a chair from an old save as for one just put
          // down. See `turnOf`.
          turn: decorTurnOf(placed),
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
        dusk: this.lighting.dusk,
        night: nightTintAlpha(this.hourNow()),
        alpha: this.lighting.tintAlpha,
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
      logic: () => {
        const cast = this.logicPopup?.cast;
        if (!cast) return null;
        return {
          puzzle: cast.rung.puzzle,
          tokens: cast.tray?.tokens.map((t) => ({ id: t.id, hue: t.hue, shape: t.shape })) ?? [],
          rule: cast.tray?.rule ?? null,
          wanted: [...(cast.tray?.wanted ?? [])],
          picked: [...cast.picked],
          switches: cast.circuit?.switches ?? 0,
          lamp: cast.circuit?.lamp ?? null,
          on: [...cast.on],
          board: this.logicPopup?.where ?? null,
          done: cast.done,
          missteps: cast.missteps,
          wrong: cast.wrong,
          hinting: logicHint(cast) !== null,
        };
      },
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
      /**
       * How many pictures are rising over her head at this moment.
       *
       * Counted off the layer rather than reported from the field that holds
       * the one, so it is a count of what is on screen and not of what the
       * scene believes it put there. A moon and a sun are the only two
       * drawn this way — the runes a spell is earned with are their own
       * picture, and an animal's cloud is a container rather than an image.
       */
      floatingMarks: () =>
        this.sceneryLayer()
          .getChildren()
          .filter(
            (object) =>
              object instanceof Phaser.GameObjects.Image &&
              (object.texture.key === uiTextureKey(UiAsset.MarkNight) ||
                object.texture.key === uiTextureKey(UiAsset.MarkDay)),
          ).length,
      /**
       * What the clock in the corner is showing, as a child sees it.
       *
       * Read off the text objects rather than worked out again, which is the
       * point: `worldClock` already says what hour the world is at, and this
       * says what the screen is telling somebody about it.
       */
      hudClock: () => ({
        time: this.clockHud?.time.text ?? "",
        date: this.clockHud?.date.text ?? "",
        sky: this.clockHud?.sky.texture.key ?? "",
        shown: this.clockHud?.time.visible ?? false,
      }),
      geometry: () => (this.geometryPanel?.isOpen ? (this.geometryPanel.readout() ?? null) : null),
      post: () => ({
        owed: this.delivery,
        arriving: this.postArriving,
        here: this.postman !== null,
        sheet: this.newsPanel?.isOpen
          ? this.newsPanel.readout()
          : this.introPanel?.isOpen
            ? this.introPanel.readout()
            : null,
      }),
      blueprints: () => Object.fromEntries([...this.drawings]),
      jobs: () => {
        const job = nextJob(this.jobsDone);
        const spec = job ? JOB_SPECS[job] : null;
        return {
          next: job,
          progress: spec ? Math.min(spec.wanted, spec.progress(this.lineView())) : 0,
          wanted: spec?.wanted ?? 0,
          done: this.profile.jobs,
        };
      },
      guide: () => ({
        running: this.guide?.current?.guide ?? null,
        step: this.guide?.current?.step ?? null,
        cue: this.guide?.cue() ?? null,
        marks: this.guideMarks?.showing() ?? { ring: null, arrow: null, trail: 0 },
        done: this.profile.guided,
      }),
      counting: () => {
        const counter = this.countingPopup?.counter;
        if (!counter) return null;
        const at = this.countingPopup.places;
        return {
          ...counter,
          box: at.box,
          inBox: at.inBox.map((one) => ({ ...one })),
          inTray: at.inTray.map((one) => ({ ...one })),
        };
      },
      city: () => ({
        gates: this.city.gates.map(({ col, row }) => ({ col, row })),
        wall: this.city.wall.length,
      }),
      hiding: () =>
        this.tallThings
          .filter(({ sprite }) => sprite.active)
          .map(({ id, at, sprite }) => ({ id, col: at.col, row: at.row, alpha: sprite.alpha })),
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
          // What is in the cloud over it, which is not the same question as
          // whether it has one: a tap on a quiet animal puts up a cloud that
          // is nobody's bubble and lasts a beat.
          thinking: [...animal.thinking],
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
    };
  }

  /**
   * What the debug panel reaches for.
   *
   * Three of these are held here because they are *states* the game reads
   * every frame. The rest are not overrides at all — they put coins in the
   * purse, a rung on the profile and spells in the book, which is what those
   * things are, and they are saved like any other change to them.
   */
  private debugControls(): DebugControls {
    return {
      frozen: () => this.frozen,
      setFrozen: (still) => {
        this.debugFreeze = still;
      },
      hungry: () => this.alwaysHungry,
      setHungry: (hungry) => {
        this.debugHungry = hungry;
      },
      hour: () => this.hourNow(),
      setHour: (hour) => {
        this.debugHour = hour;
      },
      rung: () => this.profile.rung,
      rungs: () => HARDEST_RUNG,
      setRung: (rung) => {
        this.saveProfileChange({ rung: rungInBand(bandAt(this.profile.band), rung) });
        this.applyRung();
      },
      fillPurse: () => {
        this.purse.earn(DEBUG_COINS);
        this.refreshCarried();
      },
      fillBasket: () => {
        for (const plant of PLANT_TYPES) this.inventory.add(plant, DEBUG_EACH);
        for (const material of GATHERED_MATERIALS) this.inventory.add(material, DEBUG_EACH);
        for (const fixture of PLACEABLE_FIXTURES) this.inventory.add(fixture, DEBUG_EACH);
        // And the furniture, which this did not give and should have: a
        // basket that fills with everything except the things a room is
        // furnished with is a basket that is nearly full. It is the same
        // inventory — a piece in a colour is one item — so this is the same
        // line as the fixtures above.
        for (const item of DECOR_ITEMS) this.inventory.add(item, DEBUG_EACH);
        this.refreshCarried();
      },
      learnEverything: () => {
        this.saveProfileChange({
          learned: [...SPELLS],
          reached: markedPlaces(this.anchors).map(({ id }) => id),
          found: [...FLOWER_TYPES],
        });
        this.spellTray?.refresh();
        this.seedTray?.refresh();
      },
    };
  }

  /**
   * Everything that draws a parchment or a menu and must be torn down with
   * the scene. One list, so shutdown cannot forget a panel that `modalOpen`
   * remembers — the two used to be maintained by hand and disagreed.
   */
  private panels(): readonly ({ destroy(): void } | undefined)[] {
    return [
      this.spellPopup,
      this.countingPopup,
      this.portalPanel,
      this.shopPanel,
      this.optionsPanel,
      this.aboutPanel,
      this.lessonPanel,
      this.introPanel,
      this.newsPanel,
      this.mapPanel,
      this.picturePanel,
      this.taskPanel,
      this.geometryPanel,
      this.grovePanel,
      this.sharePanel,
      this.thingPanel,
      this.arrayPopup,
      this.sharePopup,
      this.brickPopup,
      this.clockPopup,
      this.symmetryPopup,
      this.logicPopup,
      this.patchMenu,
      this.decorMenu,
      this.flowerMenu,
      this.wheel,
      this.sandGlass,
    ];
  }

  private get modalOpen(): boolean {
    return (
      // Optional throughout: the status line is written once while the scene
      // is still assembling itself, before any of these exist.
      this.spellPopup?.isOpen === true ||
      this.countingPopup?.isOpen === true ||
      this.shopPanel?.isOpen === true ||
      this.optionsPanel?.isOpen === true ||
      this.aboutPanel?.isOpen === true ||
      // Counted, like every other sheet. A panel left out of here is a panel
      // a child can walk out from underneath: the world goes on taking taps
      // behind it, and a tap that lands on a square while a page is up is a
      // seed planted somewhere nobody was looking.
      this.thingPanel?.isOpen === true ||
      this.lessonPanel?.isOpen === true ||
      this.introPanel?.isOpen === true ||
      this.newsPanel?.isOpen === true ||
      this.mapPanel?.isOpen === true ||
      this.picturePanel?.isOpen === true ||
      this.taskPanel?.isOpen === true ||
      this.portalPanel?.isOpen === true ||
      this.geometryPanel?.isOpen === true ||
      this.sharePanel?.isOpen === true ||
      // The array and clock parchments are not on this list. Whether that is
      // deliberate has not been established here, so it is left alone — but
      // a new parchment goes on it, because everything that reads this asks
      // "is a question already on screen", and a wall is one.
      this.brickPopup?.isOpen === true ||
      this.sharePopup?.isOpen === true ||
      this.symmetryPopup?.isOpen === true ||
      this.logicPopup?.isOpen === true ||
      // Mid-move: halfway onto a bench, or sitting on one. Brief moves are
      // short — see `USE_MS` — and for the same reason a crossing is: a
      // step taken from the middle of it lands nowhere. A lasting one is
      // modal until the tap that gets her up, which the pointer handler
      // takes *before* asking this.
      this.using !== null ||
      // Mid-crossing: a step from a tile they are no longer standing on.
      this.travelling ||
      // And mid-*arrival*: a door is open on the tile in front of them and
      // somebody is coming out of it. Same argument, other direction.
      this.postArriving
    );
  }

  private get crateIsEmpty(): boolean {
    return PLACEABLE_FIXTURES.every((fixture) => this.inventory.count(fixture) === 0);
  }
}
