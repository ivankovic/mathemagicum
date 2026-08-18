// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import Phaser from "phaser";
import { VirtualJoystick } from "../input/VirtualJoystick";
import { makeAdditionProblem } from "../spells/addition";
import { IconTray } from "../ui/IconTray";
import { ShopPanel } from "../ui/ShopPanel";
import { SpellPopup } from "../ui/SpellPopup";
import {
  UI_SIDECAR_KEY,
  UiAsset,
  type UiIndex,
  cropIcon,
  itemIcon,
  uiTextureKey,
} from "../ui/assets";
import type { AreaPlacement } from "../world/anchors";
import {
  BUILDING_SPRITES,
  type BuildingRole,
  type BuildingSprite,
  DoorState,
  ROLE_SPRITES,
  buildingAnimKey,
  doorStateForDistance,
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
  PLAYER_CHARACTER,
  WALK,
  WALK_FPS,
  characterAnimKey,
  characterFor,
  characterSheetKey,
  characterSidecarKey,
  facingFor,
  stepForFacing,
} from "../world/characters";
import {
  type ChunkCoord,
  chunkKey,
  chunksCoveringTileRange,
  dualChunkScreenBounds,
  dualTileRange,
} from "../world/chunks";
import {
  EFFECT_FPS,
  EFFECT_TYPES,
  EffectType,
  effectAnimKey,
  effectSheetKey,
  effectSidecarKey,
} from "../world/effects";
import {
  FIXTURE_TYPES,
  type FixtureType,
  PLACEABLE_FIXTURES,
  fixtureAnimKey,
  fixtureFor,
  fixtureSheetKey,
  fixtureSidecarKey,
  isPlaceable,
} from "../world/fixtures";
import type { WorldGrid } from "../world/grid";
import {
  INTERIOR_ROOMS,
  buildInteriorGrid,
  interiorAnimKey,
  interiorAttendantCell,
  interiorDoor,
  interiorFor,
  interiorOriginY,
  interiorSheetKey,
  interiorSidecarKey,
} from "../world/interiors";
import { type Inventory, describeItem } from "../world/inventory";
import type { PlacedObject } from "../world/objects";
import { findPath } from "../world/pathfinding";
import {
  HARVEST_YIELD,
  PLANTED_STAGE,
  PLANT_TYPES,
  PlantStage,
  PlantType,
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
import { GameSession, stepsToSpeak } from "../world/session";
import type { Purse } from "../world/shop";
import {
  type BuildingSidecar,
  type CharacterSidecar,
  type EffectSidecar,
  type FixtureSidecar,
  type InteriorSidecar,
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
import { NIGHT_TINT_COLOR, isDaytime, nightTintAlpha, timeOfDay } from "../world/time";
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
const WORLD_SEED = 12345;
const MOVE_DURATION_MS = 160;
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
const MODAL_DEPTH = WORLD_DEPTH_CEILING + 4000;
const CHUNK_DEPTH = -1000;
// Integer, so every world pixel lands on a whole number of screen pixels —
// the point of filling the viewport rather than scaling a fixed canvas into
// it. 2 keeps roughly the framing the old 800x600 canvas gave on a desktop
// while doubling how big a character reads on a phone.
const CAMERA_ZOOM = 2;
const HUD_MARGIN = 8;
const HUD_LINE_GAP = 4;
const CHUNK_VIEW_MARGIN = 1;
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
// How many distinct starting points an idle animation can be scattered
// across. Enough that a stand of trees looks unsynchronised, few enough
// that it stays a cheap integer hash of the tile.
const PHASE_STEPS = 16;

const NPC_MOVE_DURATION_MS = 500;
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
  // The placed object's id, so a room can be matched back to the building it
  // is behind. Two of the village's buildings share a sprite, so the sprite
  // alone cannot answer "whose room is this".
  id: string;
  sprite: BuildingSprite;
  image: Phaser.GameObjects.Sprite;
  doorCol: number;
  doorRow: number;
  door: DoorState;
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
  private statusText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;

  // One sprite per planted tile, so a crop that grows can be re-animated
  // rather than found again by hunting the display list.
  private cropSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private spellPopup!: SpellPopup;
  private seedTray?: IconTray;
  private spellTray?: IconTray;
  private basketTray?: IconTray;
  private crateTray?: IconTray;
  private shopPanel!: ShopPanel;
  private coinsText!: Phaser.GameObjects.Text;
  // Sprites for fixtures the *player* put down, so one can be picked back
  // up. Deliberately not the village well: it was placed by generation and
  // is not hers to take.
  private placedFixtures = new Map<string, Phaser.GameObjects.Sprite>();
  // Problems vary from cast to cast, so this is seeded from the clock rather
  // than from WORLD_SEED: a world is meant to be reproducible, a lesson is
  // meant not to be. A driving script can pin it with `?seed=`, which is the
  // honest version of what tests used to do by monkeypatching Date.now — and
  // which does not also stall every tween in the game. See devHooks.
  private dev: DevOptions = devOptions();
  private spellRng: Rng = createRng(0);

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Wasd;
  private plantKeys: Phaser.Input.Keyboard.Key[] = [];
  private plantActionKey!: Phaser.Input.Keyboard.Key;
  private spellbookKey!: Phaser.Input.Keyboard.Key;
  private seedPouchKey!: Phaser.Input.Keyboard.Key;
  private harvestKey!: Phaser.Input.Keyboard.Key;

  private mobileControls = false;
  private joystick?: VirtualJoystick;
  private path: GridPoint[] = [];

  private activeChunks = new Map<string, ActiveChunk>();
  private frameCounter = 0;

  // How many variants the atlas ships per corner combination, read from the
  // loaded texture rather than hardcoded — see terrainAtlas.ts.
  private terrainVariations = new Map<string, number>();
  private buildingSidecars = new Map<BuildingSprite, BuildingSidecar>();
  private fixtureSidecars = new Map<string, FixtureSidecar>();
  private scenerySidecars = new Map<string, ObjectSidecar>();
  private buildings: BuildingRuntime[] = [];
  private interiorSidecars = new Map<string, InteriorSidecar>();
  private interior: InteriorRuntime | null = null;
  // The outdoor grid and its camera bounds, kept so stepping back outside
  // restores exactly what was there rather than regenerating it.
  private worldGrid!: WorldGrid;
  private worldPixelWidth = 0;
  private worldPixelHeight = 0;
  // Everything drawn outdoors and everything drawn indoors, so entering a
  // building is one setVisible on each rather than hunting down every sprite
  // and chunk texture that happens to exist.
  private worldLayer!: Phaser.GameObjects.Layer;
  private interiorLayer!: Phaser.GameObjects.Layer;

  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private npcs: NpcRuntime[] = [];
  // Who the village put where, kept because an indoor NPC is not spawned
  // until the player walks into their building.
  private villageNpcs: readonly VillageNpcSpec[] = [];
  private attendant: Phaser.GameObjects.Sprite | null = null;
  private attendantCell: GridPoint | null = null;
  // A second camera at zoom 1 for anything measured in screen pixels. Camera
  // zoom scales scrollFactor(0) objects too, so without this the HUD and the
  // joystick would be magnified along with the world and a "64px" button
  // would not be 64px on screen.
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;
  private edgeAnchored: EdgeAnchored[] = [];

  constructor() {
    super("game");
  }

  create(): void {
    this.mobileControls = !this.sys.game.device.os.desktop;
    this.worldLayer = this.add.layer();
    this.interiorLayer = this.add.layer().setVisible(false);
    this.loadAssetMetadata();

    const world = generateWorld(WORLD_SIZE, WORLD_SIZE, WORLD_SEED);
    this.grid = world.grid;
    this.worldGrid = world.grid;
    this.session = new GameSession({ grid: world.grid, start: world.playerStart });
    this.spellRng = createRng(this.dev.seed ?? Date.now() & 0x7fffffff);
    if (this.dev.coins > 0) this.session.purse.earn(this.dev.coins);

    const bounds = computeMapScreenBounds(this.grid.width, this.grid.height);
    this.originX = -bounds.minX;
    this.originY = -bounds.minY;
    const mapPixelWidth = bounds.maxX - bounds.minX;
    const mapPixelHeight = bounds.maxY - bounds.minY;
    this.worldPixelWidth = mapPixelWidth;
    this.worldPixelHeight = mapPixelHeight;

    const start = this.toFeet(this.playerCol, this.playerRow);
    this.player = this.add
      .sprite(start.x, start.y, characterSheetKey(PLAYER_CHARACTER))
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
    this.spawnPlacedObjects(this.grid.listObjects());
    this.villageNpcs = world.village.npcs;
    this.spawnNpcs(world.village.npcs, world.anchors.village);

    this.statusText = this.ui(
      this.add
        .text(HUD_MARGIN, HUD_MARGIN, "", {
          fontFamily: "monospace",
          fontSize: "13px",
          color: "#ffffff",
        })
        .setScrollFactor(0)
        .setDepth(HUD_DEPTH),
    );
    this.messageText = this.ui(
      this.add
        .text(HUD_MARGIN, 0, "", {
          fontFamily: "monospace",
          fontSize: "13px",
          color: "#ffeb3b",
        })
        .setScrollFactor(0)
        .setDepth(HUD_DEPTH),
    );
    this.coinsText = this.ui(
      this.add
        .text(HUD_MARGIN, 0, "", {
          fontFamily: "monospace",
          fontSize: "13px",
          color: "#ffd873",
        })
        .setScrollFactor(0)
        .setDepth(HUD_DEPTH),
    );
    this.updateStatusText();

    this.nightOverlay = this.ui(
      this.add
        .rectangle(0, 0, this.scale.width, this.scale.height, NIGHT_TINT_COLOR, 0)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(NIGHT_TINT_DEPTH),
    );

    const uiIndex = this.cache.json.get(UI_SIDECAR_KEY) as UiIndex | undefined;
    if (!uiIndex) throw new Error("ui.json did not load — the spell parchment has no art");
    this.spellPopup = new SpellPopup(this, uiIndex, MODAL_DEPTH, (object) => this.ui(object));
    this.shopPanel = new ShopPanel(
      this,
      uiIndex,
      MODAL_DEPTH,
      this.inventory,
      this.purse,
      (object) => this.ui(object),
    );

    this.setupInput();
    this.createActionBar();
    exposeForTests({
      session: this.session,
      ui: () => this.uiPositions(),
      doors: () =>
        Object.fromEntries(this.buildings.map((b) => [b.id, { col: b.doorCol, row: b.doorRow }])),
      screenOf: (col, row) => this.screenOf(col, row),
      npcs: () => {
        const where: Record<string, { col: number; row: number }> = {};
        for (const npc of this.npcs) where[npc.id] = { col: npc.col, row: npc.row };
        if (this.attendantCell) where[SHOPKEEPER_ID] = { ...this.attendantCell };
        return where;
      },
    });
    if (this.mobileControls) this.createTouchControls();
    this.layoutForViewport();

    // The viewport changes on rotation and on any desktop window resize, and
    // every screen-space thing here is positioned from its size.
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layoutForViewport, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layoutForViewport, this);
      // The popup listens on the keyboard while it is open, and a listener
      // outliving its scene fires into a destroyed display list.
      this.spellPopup.destroy();
      this.shopPanel.destroy();
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer, over: unknown[]) => {
      // The popup's backdrop covers the screen and is interactive, so `over`
      // is already non-empty while it is open. Checking anyway: a modal that
      // is only modal because of depth ordering stops being one the first
      // time something is drawn above it.
      if (this.modalOpen) return;
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

  override update(): void {
    this.frameCounter++;
    const hour = timeOfDay(new Date());
    if (!this.interior) {
      this.refreshVisibleChunks();
      this.updateNpcs(isDaytime(hour));
    }
    // The tint still applies indoors: it is the time of day, not the weather
    // outside a window.
    this.nightOverlay.setFillStyle(NIGHT_TINT_COLOR, nightTintAlpha(hour));

    // Depth follows the sprite's own y, which is its feet — so it stays
    // correct part-way through a step rather than only at whole tiles.
    this.player.setDepth(this.player.y);
    this.playCharacterAnim(
      this.player,
      PLAYER_CHARACTER,
      this.playerFacing,
      this.isMoving,
      this.playerGesture,
    );
    for (const npc of this.npcs) {
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
        this.tryMove(dir.dCol, dir.dRow);
      } else if (this.path.length > 0) {
        const next = this.path.shift();
        if (next) this.tryMove(next.col - this.playerCol, next.row - this.playerRow);
      }
    }

    for (const [index, key] of this.plantKeys.entries()) {
      if (Phaser.Input.Keyboard.JustDown(key)) {
        this.selectedPlantIndex = index;
        this.updateStatusText();
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
    return object;
  }

  // Everything anchored to a screen edge, re-placed whenever the viewport
  // changes. Called once at setup and again on every resize.
  private layoutForViewport(): void {
    const { width, height } = this.scale;
    this.uiCamera?.setSize(width, height);
    this.nightOverlay?.setSize(width, height);
    for (const button of this.edgeAnchored) button.place(width, height);
    // The popup can be open across a phone rotation, and every one of its
    // pieces is placed from the viewport's size.
    this.spellPopup?.layout();
    this.shopPanel?.layout();
    this.layoutHud();
  }

  // The HUD is a single run of text that has to fit a phone held upright as
  // well as a desktop window, so it wraps rather than running off the edge,
  // and the message line follows whatever height the status line wrapped to.
  private layoutHud(): void {
    if (!this.statusText || !this.messageText) return;
    const wrap = Math.max(120, this.scale.width - HUD_MARGIN * 2);
    this.statusText.setWordWrapWidth(wrap);
    this.messageText.setWordWrapWidth(wrap);
    this.messageText.setY(this.statusText.y + this.statusText.height + HUD_LINE_GAP);
    // Under the message rather than beside the status line: that line
    // already wraps to two on a phone, and money is the one number the
    // player wants to find without reading a sentence.
    this.coinsText?.setY(this.messageText.y + this.messageText.height + HUD_LINE_GAP);
  }

  // Hidden until she has been paid something. A "0 coins" line on every new
  // game is a permanent reminder of a currency she has no use for yet.
  private updateCoins(): void {
    if (!this.coinsText) return;
    this.coinsText.setText(this.purse.coins > 0 ? `${this.purse.coins} coins` : "");
    this.layoutHud();
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

    for (const sprite of BUILDING_SPRITES) {
      const sidecar = this.cache.json.get(sidecarKey(sprite)) as BuildingSidecar | undefined;
      if (!sidecar) throw new Error(`missing sidecar for building "${sprite}"`);
      this.buildingSidecars.set(sprite, sidecar);
      // One looping smoke animation per door position, built from the ranges
      // the sidecar names — so the door opens by switching animation, and
      // the smoke keeps drifting either way.
      for (const [name, range] of Object.entries(sidecar.animations)) {
        const state = name.replace(/^door_/, "") as DoorState;
        const key = buildingAnimKey(sprite, state);
        if (this.anims.exists(key)) continue;
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(spriteSheetKey(sprite), {
            start: range.start,
            end: range.end,
          }),
          frameRate: BUILDING_ANIM_FPS,
          repeat: -1,
        });
      }
    }

    this.registerCharacterAnims();
    this.registerInteriorAnims();
    this.registerPlantAnims();
    this.registerFixtureAnims();
    this.registerSceneryAnims();
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

  // One Phaser animation per (character, animation, facing), built straight
  // from the frame ranges the sidecar names. Nothing here knows how many
  // frames a walk cycle has or which row it sits on — that is the sheet's
  // business, and reading it back is what keeps the two in step.
  private registerCharacterAnims(): void {
    for (const character of ALL_CHARACTERS) {
      const sidecar = this.cache.json.get(characterSidecarKey(character)) as
        | CharacterSidecar
        | undefined;
      if (!sidecar) throw new Error(`missing sidecar for character "${character}"`);
      for (const [name, range] of Object.entries(sidecar.animations)) {
        const [animation, facing] = name.split("_");
        if (!animation || !facing) throw new Error(`${character}: odd animation name "${name}"`);
        if (!CHARACTER_ANIMATIONS.includes(animation)) continue;
        const key = characterAnimKey(character, animation, facing as Facing);
        if (this.anims.exists(key)) continue;
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(characterSheetKey(character), {
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
    this.player.play(characterAnimKey(PLAYER_CHARACTER, animation, this.playerFacing));
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

  private refreshVisibleChunks(): void {
    const view = this.cameras.main.worldView;
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
    const visible = chunksCoveringTileRange(
      {
        minCol: Math.min(...cols),
        maxCol: Math.max(...cols),
        minRow: Math.min(...rows),
        maxRow: Math.max(...rows),
      },
      this.grid.width,
      this.grid.height,
      CHUNK_VIEW_MARGIN,
    );
    const visibleKeys = new Set(visible.map(chunkKey));

    for (const chunk of visible) {
      const key = chunkKey(chunk);
      const entry = this.activeChunks.get(key);
      if (entry) {
        entry.texture.setVisible(true);
        entry.lastUsedAt = this.frameCounter;
      } else {
        this.activateChunk(chunk);
      }
    }

    for (const [key, entry] of this.activeChunks) {
      if (!visibleKeys.has(key)) entry.texture.setVisible(false);
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

    texture.beginDraw();
    for (let dualRow = minRow; dualRow <= maxRow; dualRow++) {
      for (let dualCol = minCol; dualCol <= maxCol; dualCol++) {
        const corners = cornerTerrainsFor(this.grid, dualCol, dualRow);
        const frame = frameFor(corners, dualCol, dualRow, this.terrainVariations);
        if (!frame) continue;
        const p = gridToScreen(dualCol, dualRow);
        texture.batchDrawFrame(
          TERRAIN_ATLAS_KEY,
          frame,
          p.x + DUAL_OFFSET - minX,
          p.y + DUAL_OFFSET - minY,
        );
      }
    }
    texture.endDraw();

    this.activeChunks.set(chunkKey(chunk), { texture, lastUsedAt: this.frameCounter });
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
      building.image.play(buildingAnimKey(building.sprite, state), true);
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
    this.plantKeys = [KeyCodes.ONE, KeyCodes.TWO, KeyCodes.THREE]
      .slice(0, PLANT_TYPES.length)
      .map((code) => keyboard.addKey(code));
    this.plantActionKey = keyboard.addKey(KeyCodes.SPACE);
    this.spellbookKey = keyboard.addKey(KeyCodes.B);
    this.seedPouchKey = keyboard.addKey(KeyCodes.P);
    this.harvestKey = keyboard.addKey(KeyCodes.H);
  }

  private pressedDirection(): Direction | null {
    if (this.cursors.up.isDown || this.wasd.up.isDown) return { dCol: 0, dRow: -1 };
    if (this.cursors.down.isDown || this.wasd.down.isDown) return { dCol: 0, dRow: 1 };
    if (this.cursors.left.isDown || this.wasd.left.isDown) return { dCol: -1, dRow: 0 };
    if (this.cursors.right.isDown || this.wasd.right.isDown) return { dCol: 1, dRow: 0 };
    // Keyboard first so an attached keyboard still wins on a touch device.
    const held = this.joystick?.direction();
    return held ? stepForFacing(held) : null;
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
      // Pressing into a door enters, rather than bumping off it. The door
      // cell is part of the footprint and so already impassable, which is
      // what makes this unambiguous: nothing else wants that step.
      const building = this.buildingWithDoorAt(targetCol, targetRow);
      if (building) {
        this.enterInterior(building);
        return;
      }
    }

    if (!this.grid.isPassable(targetCol, targetRow)) return;

    this.isMoving = true;
    this.session.setPosition(targetCol, targetRow);

    const target = this.toFeet(targetCol, targetRow);
    this.tweens.add({
      targets: this.player,
      x: target.x,
      y: target.y,
      duration: MOVE_DURATION_MS,
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
          // Picking a seed here is also what the number keys pick, so the two
          // routes never disagree about which crop Space would plant. The
          // caption is refreshed after, not by the tray closing before it:
          // the tray's own onChange fires while this is still the old crop.
          this.selectedPlantIndex = index;
          this.tryPlant();
          this.updateStatusText();
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
      },
      canOpen: () => !this.modalOpen,
      onChange: () => this.updateStatusText(),
    });

    this.spellTray = new IconTray(this, {
      texture: uiTextureKey(UiAsset.Spellbook),
      items: [{ texture: uiTextureKey(UiAsset.RuneAdd), act: () => this.castGrowthSpell() }],
      size,
      right: edge,
      bottom,
      depth: TOUCH_UI_DEPTH,
      register: (object) => this.ui(object),
      onOpen: () => {
        this.seedTray?.setOpen(false);
        this.basketTray?.setOpen(false);
        this.crateTray?.setOpen(false);
      },
      canOpen: () => !this.modalOpen,
      onChange: () => this.updateStatusText(),
    });

    // What she is carrying, in the same shape as the two containers beside
    // it. Tapping an item states how many of it she has rather than doing
    // anything: there is nothing to spend produce on yet, and a button that
    // silently did nothing would be worse than one that answers.
    this.basketTray = new IconTray(this, {
      texture: uiTextureKey(UiAsset.Basket),
      items: PLANT_TYPES.map((plant) => ({
        texture: uiTextureKey(cropIcon(plant)),
        count: () => this.inventory.count(plant),
        act: () => this.setMessage(describeItem(plant, this.inventory.count(plant))),
      })),
      // Crops only, not `inventory.total`: the bag holds bought fixtures too
      // now, and a basket badge that counted those would say she is carrying
      // three carrots when she is carrying a carrot and two fence panels.
      count: () => PLANT_TYPES.reduce((sum, plant) => sum + this.inventory.count(plant), 0),
      size,
      right: edge + (size + 10) * 2,
      bottom,
      depth: TOUCH_UI_DEPTH,
      register: (object) => this.ui(object),
      onOpen: () => {
        this.seedTray?.setOpen(false);
        this.spellTray?.setOpen(false);
        this.crateTray?.setOpen(false);
      },
      canOpen: () => !this.modalOpen,
      onChange: () => this.updateStatusText(),
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
      },
      canOpen: () => !this.modalOpen,
      onChange: () => this.updateStatusText(),
    });

    this.edgeAnchored.push(this.seedTray, this.spellTray, this.basketTray, this.crateTray);
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
    // The one guard here that is not merely defensive: the spellbook button
    // sits inside the popup's own rectangle on a phone, and a rune tapped
    // through it would restart the cast half way through the problem.
    if (this.modalOpen) return;
    this.spellTray?.setOpen(false);

    const target = this.session.checkGrowth();
    if (!target.ok || !target.tile) {
      this.setMessage(target.message);
      return;
    }
    const { col, row } = target.tile;
    // A stick still held when the parchment opens never sends its release,
    // and the player walks off the moment the popup closes.
    this.joystick?.release();
    this.setMessage("");
    this.spellPopup.open(makeAdditionProblem(this.spellRng), (solved) => {
      if (solved) this.growCropAt(col, row);
      else this.setMessage("The spell fades unspoken");
    });
  }

  private growCropAt(col: number, row: number): void {
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
    this.setMessage(result.message);
  }

  // --- The store ----------------------------------------------------------
  //
  // Sell what you pick, buy something to put down with the proceeds. The
  // shopkeeper is the door into it: she is tapped like a crop, because she
  // is a thing in the world with something to say, and a keyboard shortcut
  // for a person standing in one place would be a shortcut to walking there.

  /**
   * Make the shopkeeper tappable.
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
  private watchShopkeeper(sprite: Phaser.GameObjects.Sprite, at: () => GridPoint): void {
    const frame = sprite.frame;
    sprite.setInteractive(
      new Phaser.Geom.Rectangle(0, frame.realHeight - TILE_SIZE, TILE_SIZE, TILE_SIZE),
      Phaser.Geom.Rectangle.Contains,
    );
    sprite.on("pointerdown", () => {
      // Within one step in *any* direction, diagonals included — unlike
      // harvesting, which measures orthogonally because it acts on the tile
      // the player faces and there is no diagonal facing to turn to. Talking
      // to someone needs no facing, so standing at her corner is standing
      // next to her, and refusing that would be a rule with no reason behind
      // it that the player could see.
      if (stepsToSpeak(this.session.tile, at()) > 1) {
        this.setMessage("Too far away — step up to her first");
        return;
      }
      this.openShop();
    });
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
        this.setMessage("");
      },
      // The bar stays on screen beside the panel, so a sale has to reach it
      // as it happens rather than when the shop closes — otherwise the
      // basket sits there claiming to hold what was just sold.
      () => this.refreshCarried(),
    );
    this.updateStatusText();
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
    for (const [name, tray] of Object.entries(this.trays())) {
      if (!tray) continue;
      positions[name] = tray.containerPosition();
      for (const [index, item] of tray.itemPositions().entries()) {
        positions[`${name}.${index}`] = item;
      }
    }
    return positions;
  }

  private trays(): Record<string, IconTray | undefined> {
    return {
      spellbook: this.spellTray,
      seeds: this.seedTray,
      basket: this.basketTray,
      crate: this.crateTray,
    };
  }

  private closeTrays(): void {
    for (const tray of Object.values(this.trays())) tray?.setOpen(false);
  }

  /** Both badges that count what she is holding, after anything moves it. */
  private refreshCarried(): void {
    this.basketTray?.refresh();
    this.crateTray?.refresh();
    this.updateCoins();
    this.updateStatusText();
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
    this.setMessage(result.message);
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
    this.playGesture(PLANT); // she bends to set it down, same as planting
    this.refreshCarried();
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
    sprite.on("pointerdown", () => this.takeFixture(fixture, col, row));
  }

  private takeFixture(fixture: FixtureType, col: number, row: number): void {
    if (this.modalOpen) return;
    const result = this.session.takeBack(fixture, col, row);
    this.setMessage(result.message);
    if (!result.ok) return;
    const key = tileKey(col, row);
    this.placedFixtures.get(key)?.destroy();
    this.placedFixtures.delete(key);
    this.refreshCarried();
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
    this.setMessage(result.message);
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
      this.setMessage("Too far away — step up to it first");
      return;
    }
    if (steps === 1) this.session.turnToward(dCol, dRow);
    this.tryHarvest();
  }

  private tryPlant(): void {
    if (this.modalOpen) return;
    const plant = PLANT_TYPES[this.selectedPlantIndex];
    if (!plant) return;

    const result = this.session.plant(plant);
    this.setMessage(result.message);
    if (!result.ok || !result.tile) return;

    const { col, row } = result.tile;
    const feet = this.toFeet(col, row);
    const sprite = this.world(
      this.add
        .sprite(feet.x, feet.y, plantSheetKey(plant))
        .setOrigin(0.5, 1)
        // Half a pixel behind whatever stands on the same tile, so the
        // player walking over their own crop is in front of it rather than
        // flickering against it on a depth tie.
        .setDepth(feet.y - 0.5)
        .play(plantAnimKey(plant, PLANTED_STAGE)),
    );
    this.watchCrop(sprite, col, row);
    this.cropSprites.set(tileKey(col, row), sprite);
    this.playGesture(PLANT);
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
    sprite.on("pointerdown", () => this.handleCropTap(col, row));
  }

  private handleTileClick(screenX: number, screenY: number): void {
    const target = this.toGrid(screenX, screenY);
    if (!this.grid.isPassable(target.col, target.row)) {
      this.setMessage("Can't walk there");
      return;
    }
    const path = findPath(this.grid, { col: this.playerCol, row: this.playerRow }, target);
    if (!path) {
      this.setMessage("Can't walk there");
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
  private spawnPlacedObjects(objects: readonly PlacedObject[]): void {
    for (const object of objects) {
      const sprite = ROLE_SPRITES[object.type as BuildingRole];
      const sidecar = sprite ? this.buildingSidecars.get(sprite) : undefined;
      if (!sprite || !sidecar) {
        this.spawnNonBuilding(object);
        continue;
      }
      const origin = spriteOrigin(sidecar, object.col, object.row);
      const image = this.world(
        this.add
          .sprite(this.originX + origin.x, this.originY + origin.y, spriteSheetKey(sprite))
          .setOrigin(0, 0)
          .setDepth(depthFor(footprintBottomY(sidecar, object.row)))
          .play(buildingAnimKey(sprite, DoorState.Closed)),
      );
      const door = doorCell(sidecar, object.col, object.row);
      this.buildings.push({
        id: object.id,
        sprite,
        image,
        doorCol: door.col,
        doorRow: door.row,
        door: DoorState.Closed,
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
      return;
    }
    const kind = sceneryKind(object.type);
    if (kind) {
      const sidecar = this.scenerySidecars.get(kind);
      if (!sidecar) throw new Error(`no art loaded for scenery "${kind}"`);
      // Which individual this tile gets, and whether it faces the other
      // way. Four shapes times a mirror is eight silhouettes, which is
      // enough that a wall hundreds long stops reading as a repeat.
      const instance = variationFor(object.col, object.row, Math.max(1, sidecar.instances));
      this.spawnFootprintSprite(
        object,
        sidecar,
        scenerySheetKey(kind),
        sceneryAnimKey(kind, instance),
        true,
      );
      return;
    }
    throw new Error(`placed object "${object.type}" has no art`);
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
    if (mirror && variationFor(object.col, object.row, 2) === 1) {
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
    const spec = this.villageNpcs.find((npc) => npc.indoors && npc.homeBuildingId === buildingId);
    if (!spec) return;
    const cell = interiorAttendantCell(sidecar);
    if (!cell) throw new Error(`${sidecar.room} has nowhere for ${spec.id} to stand`);

    const feet = this.toFeet(cell.col, cell.row);
    const sprite = this.world(
      this.add
        .sprite(feet.x, feet.y, characterSheetKey(characterFor(spec.id, 0)))
        .setOrigin(0.5, 1)
        .setDepth(feet.y)
        .play(characterAnimKey(characterFor(spec.id, 0), IDLE, Facing.Down)),
    );
    if (spec.id === SHOPKEEPER_ID) this.watchShopkeeper(sprite, () => cell);
    this.attendant = sprite;
    this.attendantCell = cell;
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
    return interior;
  }

  private buildingWithDoorAt(col: number, row: number): BuildingRuntime | undefined {
    return this.buildings.find((b) => b.doorCol === col && b.doorRow === row);
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
  private enterInterior(building: BuildingRuntime): void {
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

    const image = this.world(
      this.add.sprite(0, 0, interiorSheetKey(room)).setOrigin(0, 0).setDepth(CHUNK_DEPTH),
    );
    if ((sidecar.sheet?.frame_count ?? 1) > 1) image.play(interiorAnimKey(room));
    entered.image = image;

    this.grid = entered.grid;
    this.originX = 0;
    this.originY = entered.originY;
    // After the origin moves, not before: `toFeet` measures from it, and a
    // shopkeeper placed while it still pointed at the outdoor world would be
    // drawn several hundred tiles from the room she is standing in.
    this.spawnAttendant(building.id, sidecar);
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
    this.setMessage(`Entered the ${room}. Step back out through the door.`);
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
  private frameRoom(width: number, height: number): void {
    const camera = this.cameras.main;
    const visible = { width: camera.width / camera.zoom, height: camera.height / camera.zoom };
    if (width > visible.width || height > visible.height) {
      camera.setBounds(0, 0, width, height);
      camera.startFollow(this.player);
      return;
    }
    // `removeBounds` first: with bounds set, the scroll this asks for is
    // clamped straight back to the corner it is trying to move away from.
    camera.removeBounds();
    camera.stopFollow();
    camera.centerOn(width / 2, height / 2);
  }

  private leaveInterior(): void {
    const interior = this.interior;
    if (!interior) return;
    interior.image.destroy();
    this.interiorLayer.setVisible(false);
    this.worldLayer.setVisible(true);
    this.attendant?.destroy();
    this.attendant = null;
    this.attendantCell = null;
    this.setInterior(null);
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
    this.setMessage("");
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
        const character = characterFor(spec.id, genericIndex);
        if (character.startsWith("villager-")) genericIndex++;
        const feet = this.toFeet(spec.home.col, spec.home.row);
        const sprite = this.world(
          this.add
            .sprite(feet.x, feet.y, characterSheetKey(character))
            .setOrigin(0.5, 1)
            .setDepth(feet.y),
        );
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
      for (const npc of this.npcs) if (!npc.isMoving) this.npcRetreatStep(npc);
      return;
    }
    const now = this.time.now;
    for (const npc of this.npcs) {
      if (npc.isMoving || now < npc.nextStepAt) continue;
      npc.nextStepAt = now + Phaser.Math.Between(NPC_STEP_MIN_MS, NPC_STEP_MAX_MS);
      if (daytime) this.npcWanderStep(npc);
      else this.npcRetreatStep(npc);
    }
  }

  // A bounded random walk, not a route to a chosen destination — simple,
  // and "wanders near home" doesn't need anything stronger.
  private npcWanderStep(npc: NpcRuntime): void {
    const direction = STEP_DIRECTIONS[Phaser.Math.Between(0, STEP_DIRECTIONS.length - 1)];
    if (!direction) return;
    const col = npc.col + direction.dCol;
    const row = npc.row + direction.dRow;
    if (!this.grid.isPassable(col, row)) return;
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
    if (npc.col === npc.homeCol && npc.row === npc.homeRow) return;
    const dCol = Math.sign(npc.homeCol - npc.col);
    const dRow = Math.sign(npc.homeRow - npc.row);
    const attempts: Direction[] = [];
    if (Math.abs(npc.homeCol - npc.col) >= Math.abs(npc.homeRow - npc.row)) {
      if (dCol !== 0) attempts.push({ dCol, dRow: 0 });
      if (dRow !== 0) attempts.push({ dCol: 0, dRow });
    } else {
      if (dRow !== 0) attempts.push({ dCol: 0, dRow });
      if (dCol !== 0) attempts.push({ dCol, dRow: 0 });
    }
    for (const attempt of attempts) {
      const col = npc.col + attempt.dCol;
      const row = npc.row + attempt.dRow;
      if (this.grid.isPassable(col, row)) {
        this.moveNpcTo(npc, col, row);
        return;
      }
    }
  }

  private moveNpcTo(npc: NpcRuntime, col: number, row: number): void {
    npc.facing = facingFor(col - npc.col, row - npc.row, npc.facing);
    npc.isMoving = true;
    npc.col = col;
    npc.row = row;
    const target = this.toFeet(col, row);
    this.tweens.add({
      targets: npc.sprite,
      x: target.x,
      y: target.y,
      duration: NPC_MOVE_DURATION_MS,
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
    const camera = this.cameras.main;
    const feet = this.toFeet(col, row);
    // Through `worldView` rather than `scrollX` and the zoom: the view is
    // what the camera actually settled on after its bounds were applied, and
    // indoors those bounds are a room smaller than the viewport, so the
    // arithmetic that holds outdoors does not hold in here.
    const view = camera.worldView;
    return {
      x: (feet.x - view.x) * camera.zoom,
      y: (feet.y - view.y) * camera.zoom,
    };
  }

  private toGrid(screenX: number, screenY: number): GridPoint {
    return screenToGrid(screenX - this.originX, screenY - this.originY);
  }

  private updateStatusText(): void {
    this.statusText.setText(this.statusLine);
    // Wrapping changes the status line's height, which the message line sits
    // under — so re-place it whenever the text changes, not only on resize.
    this.layoutHud();
  }

  private setMessage(text: string): void {
    this.messageText.setText(text);
    this.layoutHud();
  }

  // Kept to two lines on a phone held upright, which is what it wraps to at
  // this length. It ran to three while it explained the spellbook in full,
  // and a third of a portrait screen is too much to spend on a caption.
  //
  // With an open tray the line says what the icons on screen will do, since
  // that is the one moment the player is looking at something they have not
  // seen before. Closed, it names the buttons instead.
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
    return this.spellPopup.isOpen || this.shopPanel?.isOpen === true;
  }

  private get statusLine(): string {
    if (this.shopPanel?.isOpen) return "The village store";
    if (this.seedTray?.isOpen) return "Pick a seed to plant it on the tile ahead";
    if (this.spellTray?.isOpen) return "Cast + to grow the crop on the tile ahead";
    if (this.crateTray?.isOpen) {
      return this.crateIsEmpty
        ? "Nothing to put down — the shopkeeper sells fences and lamps"
        : "Pick something to set it on the tile ahead";
    }
    if (this.basketTray?.isOpen) {
      return this.inventory.isEmpty
        ? "Your basket is empty — tap a ripe crop to pick it"
        : `Carrying ${this.inventory.total} in ${this.inventory.kinds} kind(s)`;
    }
    const plant = PLANT_TYPES[this.selectedPlantIndex];
    // The basket's own badge carries the count now, so the caption no longer
    // repeats it — two places showing the same number is one place too many
    // on a line that has to fit a phone held upright.
    return this.mobileControls
      ? "Drag to walk  Tap a ripe crop to pick it  The shop is inside the barn"
      : `Arrows/WASD  P: seeds  B: spells  Space: plant ${plant}  H: pick  Shop: inside the barn`;
  }

  private get crateIsEmpty(): boolean {
    return PLACEABLE_FIXTURES.every((fixture) => this.inventory.count(fixture) === 0);
  }
}
