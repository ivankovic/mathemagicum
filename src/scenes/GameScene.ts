// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import Phaser from "phaser";
import { VirtualJoystick } from "../input/VirtualJoystick";
import { makeAdditionProblem } from "../spells/addition";
import { SpellPopup } from "../ui/SpellPopup";
import { UI_SIDECAR_KEY, UiAsset, type UiIndex, uiTextureKey } from "../ui/assets";
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
  FIXTURE_TYPES,
  fixtureAnimKey,
  fixtureFor,
  fixtureSheetKey,
  fixtureSidecarKey,
} from "../world/fixtures";
import type { WorldGrid } from "../world/grid";
import {
  INTERIOR_ROOMS,
  buildInteriorGrid,
  interiorAnimKey,
  interiorDoor,
  interiorFor,
  interiorOriginY,
  interiorSheetKey,
  interiorSidecarKey,
} from "../world/interiors";
import type { PlacedObject } from "../world/objects";
import { findPath } from "../world/pathfinding";
import {
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
import {
  type BuildingSidecar,
  type CharacterSidecar,
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
const LOCAL_WANDER_RADIUS = 5;
const PATROL_WANDER_RADIUS = 16;

interface Direction {
  dCol: number;
  dRow: number;
}

// Crops are sparse and looked up by tile, so they are keyed by position
// rather than held in a grid-sized array.
function cropKey(col: number, row: number): string {
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
  private playerCol = 0;
  private playerRow = 0;
  private playerFacing: Facing = DEFAULT_FACING;
  private isMoving = false;

  private selectedPlantIndex = 0;
  private statusText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;

  // One sprite per planted tile, so a crop that grows can be re-animated
  // rather than found again by hunting the display list.
  private cropSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private spellPopup!: SpellPopup;
  private spellTray: EdgeAnchored[] = [];
  private spellTrayParts: (Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image)[] = [];
  private spellTrayOpen = false;
  // Problems vary from cast to cast, so this is seeded from the clock rather
  // than from WORLD_SEED: a world is meant to be reproducible, a lesson is
  // meant not to be.
  private spellRng: Rng = createRng(Date.now() & 0x7fffffff);

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Wasd;
  private plantKeys: Phaser.Input.Keyboard.Key[] = [];
  private plantActionKey!: Phaser.Input.Keyboard.Key;
  private spellbookKey!: Phaser.Input.Keyboard.Key;

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
    this.playerCol = world.playerStart.col;
    this.playerRow = world.playerStart.row;

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

    this.setupInput();
    this.createSpellbook();
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
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer, over: unknown[]) => {
      // The popup's backdrop covers the screen and is interactive, so `over`
      // is already non-empty while it is open. Checking anyway: a modal that
      // is only modal because of depth ordering stops being one the first
      // time something is drawn above it.
      if (this.spellPopup?.isOpen) return;
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
    this.playCharacterAnim(this.player, PLAYER_CHARACTER, this.playerFacing, this.isMoving);
    for (const npc of this.npcs) {
      npc.sprite.setDepth(npc.sprite.y);
      this.playCharacterAnim(npc.sprite, npc.character, npc.facing, npc.isMoving);
    }
    if (!this.interior) this.updateDoors();

    // The world keeps running behind the parchment — smoke drifts, villagers
    // wander — but nothing the player presses reaches it. Every key below is
    // one the popup wants for itself (digits, Enter, Escape) or one that
    // would walk the player out from under an open spell.
    if (this.spellPopup.isOpen) return;

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

    if (Phaser.Input.Keyboard.JustDown(this.spellbookKey)) {
      this.setSpellTrayOpen(!this.spellTrayOpen);
    }
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
    for (const item of this.spellTray) item.place(width, height);
    // The popup can be open across a phone rotation, and every one of its
    // pieces is placed from the viewport's size.
    this.spellPopup?.layout();
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
          frameRate: animation === WALK ? WALK_FPS : IDLE_FPS,
          repeat: -1,
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
  ): void {
    sprite.play(characterAnimKey(character, moving ? WALK : IDLE, facing), true);
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
    this.playerFacing = facingFor(dCol, dRow, this.playerFacing);

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
    this.playerCol = targetCol;
    this.playerRow = targetRow;

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

  // --- Spells ------------------------------------------------------------
  //
  // The spellbook is a button that opens a tray of runes; a rune is a spell.
  // Two levels rather than one because the tray is where the second spell
  // goes, and a lone button labelled with a plus would have to be renamed the
  // moment there is more than one.
  //
  // It exists on desktop as well as on touch. Unlike the joystick, casting is
  // not something a keyboard does better — and a spell the player cannot see
  // is one they will never look for.

  private createSpellbook(): void {
    // On touch it joins the column the Plant and Next buttons already form,
    // above them; on a desktop that column does not exist and the corner is
    // free. Sharing one position would have put the book on top of Plant.
    const size = this.mobileControls ? 64 : 56;
    const column = this.mobileControls ? 70 : 44;
    const bookY = this.mobileControls ? 214 : 44;
    const book = this.addIconButton(uiTextureKey(UiAsset.Spellbook), size, (w, h) => ({
      x: w - column,
      y: h - bookY,
    }));
    book.on("pointerdown", () => this.setSpellTrayOpen(!this.spellTrayOpen));

    // The tray opens directly above the book it comes out of, so the finger
    // that opened it is already next to what it opened.
    const rune = this.addIconButton(uiTextureKey(UiAsset.RuneAdd), size - 8, (w, h) => ({
      x: w - column,
      y: h - bookY - size - 8,
    }));
    rune.on("pointerdown", () => this.castGrowthSpell());
    for (const part of this.spellTrayParts) part.setVisible(false);
  }

  private addIconButton(
    texture: string,
    size: number,
    at: (width: number, height: number) => { x: number; y: number },
  ): Phaser.GameObjects.Rectangle {
    const box = this.ui(
      this.add
        .rectangle(0, 0, size, size, 0x000000, 0.45)
        .setStrokeStyle(2, 0xffffff, 0.6)
        .setScrollFactor(0)
        .setDepth(TOUCH_UI_DEPTH)
        .setInteractive({ useHandCursor: true }),
    );
    const icon = this.ui(
      this.add
        .image(0, 0, texture)
        .setScrollFactor(0)
        .setDepth(TOUCH_UI_DEPTH + 1),
    );
    const anchor: EdgeAnchored = {
      place: (width, height) => {
        const { x, y } = at(width, height);
        box.setPosition(x, y);
        icon.setPosition(x, y);
      },
    };
    this.edgeAnchored.push(anchor);
    if (texture === uiTextureKey(UiAsset.RuneAdd)) {
      this.spellTrayParts.push(box, icon);
    }
    return box;
  }

  // Every button this scene owns keeps working while a spell is on screen
  // unless it is told not to. The spellbook is the one that matters most: on
  // a phone it sits *inside* the popup's own rectangle, so without this a tap
  // meant for the parchment would reopen the tray and the rune above it would
  // restart the cast half way through the problem.
  private setSpellTrayOpen(open: boolean): void {
    if (open && this.spellPopup.isOpen) return;
    this.spellTrayOpen = open;
    for (const part of this.spellTrayParts) part.setVisible(open);
    this.updateStatusText();
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
    if (this.spellPopup.isOpen) return;
    this.setSpellTrayOpen(false);
    if (this.interior) {
      this.setMessage("Nothing grows indoors");
      return;
    }
    const { col, row } = this.facingTile();
    if (!this.grid.inBounds(col, row)) {
      this.setMessage("Face something you planted to grow it");
      return;
    }
    const crop = this.grid.getCrop(col, row);
    if (!crop) {
      this.setMessage("Face something you planted to grow it");
      return;
    }
    if (crop.stage === PlantStage.Mature) {
      this.setMessage(`This ${crop.plant} is already fully grown`);
      return;
    }
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
    const grown = this.grid.growCrop(col, row);
    if (!grown) return;
    // Growth is a change of animation, not of sprite: the generator ships one
    // sheet per crop with a row per stage, so the same object keeps playing
    // further along its own reel.
    this.cropSprites.get(cropKey(col, row))?.play(plantAnimKey(grown.plant, grown.stage));
    this.setMessage(`Your ${grown.plant} is now ${grown.stage}`);
  }

  /**
   * The tile the player is facing — the one every gardening action works on.
   *
   * Gardening used to happen on the tile the player was *standing* on, which
   * has two problems the moment a crop is something you come back to. A
   * seedling under the player's own feet is drawn behind them and invisible,
   * so planting appeared to do nothing; and standing on a tile is the one
   * position from which you cannot see what is on it. Working the tile in
   * front puts the crop where the player is looking, and makes which tile is
   * about to be worked something they can already read off the character's
   * facing.
   */
  private facingTile(): GridPoint {
    const step = stepForFacing(this.playerFacing);
    return { col: this.playerCol + step.dCol, row: this.playerRow + step.dRow };
  }

  private tryPlant(): void {
    if (this.spellPopup.isOpen) return;
    const plant = PLANT_TYPES[this.selectedPlantIndex];
    if (!plant) return;

    if (this.interior) {
      this.setMessage("Nothing grows indoors");
      return;
    }

    const { col, row } = this.facingTile();
    // The tile underfoot was passable by definition; the one ahead is not.
    // Checked before anything reads the terrain there, because both the
    // world's edge and a tile occupied by a tree are now reachable states
    // and `getTerrain` throws off the edge of the grid.
    if (!this.grid.isPassable(col, row)) {
      this.setMessage("There's no room to plant there");
      return;
    }
    if (this.grid.getPlant(col, row) !== null) {
      this.setMessage("Something is already planted there");
      return;
    }
    if (!this.grid.plant(col, row, plant)) {
      this.setMessage(`${plant} can't grow on ${this.grid.getTerrain(col, row)}`);
      return;
    }

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
    this.cropSprites.set(cropKey(col, row), sprite);
    this.setMessage(`Planted a ${plant} seedling — cast the plus rune to grow it`);
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
  ): void {
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
  }

  // --- Interiors ---------------------------------------------------------

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
    this.interior = {
      room,
      grid: buildInteriorGrid(sidecar),
      // Placed below, once `world` will file it under the interior layer.
      image: undefined as unknown as Phaser.GameObjects.Sprite,
      exit: door,
      // Back onto the doorstep: the door cell itself is part of the
      // building's footprint and so is never stood on.
      returnTo: { col: building.doorCol, row: building.doorRow + 1 },
      originY: interiorOriginY(sidecar),
    };

    const image = this.world(
      this.add.sprite(0, 0, interiorSheetKey(room)).setOrigin(0, 0).setDepth(CHUNK_DEPTH),
    );
    if ((sidecar.sheet?.frame_count ?? 1) > 1) image.play(interiorAnimKey(room));
    this.interior.image = image;

    this.grid = this.interior.grid;
    this.originX = 0;
    this.originY = this.interior.originY;
    this.worldLayer.setVisible(false);
    this.interiorLayer.setVisible(true);
    this.movePlayerToLayer();

    const { cols, rows } = sidecar.size_cells;
    this.cameras.main.setBounds(0, 0, cols * TILE_SIZE, this.originY + rows * TILE_SIZE);
    // Facing up: they just walked in through the wall behind them.
    this.placePlayer(door.col, door.row, Facing.Up);
    this.setMessage(`Entered the ${room}. Step back out through the door.`);
  }

  private leaveInterior(): void {
    const interior = this.interior;
    if (!interior) return;
    interior.image.destroy();
    this.interiorLayer.setVisible(false);
    this.worldLayer.setVisible(true);
    this.interior = null;
    this.movePlayerToLayer();

    this.grid = this.worldGrid;
    this.originX = 0;
    this.originY = 0;
    this.cameras.main.setBounds(0, 0, this.worldPixelWidth, this.worldPixelHeight);
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
    this.playerCol = col;
    this.playerRow = row;
    this.playerFacing = facing;
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
    this.npcs = specs.map((spec) => {
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

  private selectNextPlant(): void {
    if (this.spellPopup.isOpen) return;
    this.selectedPlantIndex = (this.selectedPlantIndex + 1) % PLANT_TYPES.length;
    this.updateStatusText();
  }

  // Action buttons plus the floating joystick, set up only when Phaser
  // detects a non-desktop OS (this.mobileControls). Keyboard input stays live
  // underneath regardless, so a mobile browser with an attached keyboard
  // still works too.
  //
  // The joystick replaced a fixed d-pad in the bottom-left corner. A pad
  // pinned to a corner assumes how the device is held; one that appears under
  // the thumb that summoned it does not, and it costs no permanent screen
  // space on the display where space is tightest.
  private createTouchControls(): void {
    this.joystick = new VirtualJoystick(this, TOUCH_UI_DEPTH, (object) => this.ui(object));
    // Sizes are in real screen pixels now that the UI camera draws at 1:1, so
    // 64 here is 64 device-independent pixels — comfortably past the ~9mm a
    // fingertip needs, which the old fractionally-scaled canvas was not.
    this.addTapButton(
      64,
      "Plant",
      (w, h) => ({ x: w - 70, y: h - 70 }),
      () => this.tryPlant(),
    );
    this.addTapButton(
      48,
      "Next",
      (w, h) => ({ x: w - 70, y: h - 142 }),
      () => this.selectNextPlant(),
    );
  }

  private addTapButton(
    size: number,
    label: string,
    at: (width: number, height: number) => { x: number; y: number },
    onTap: () => void,
  ): void {
    const box = this.ui(
      this.add
        .rectangle(0, 0, size, size, 0x000000, 0.45)
        .setStrokeStyle(2, 0xffffff, 0.6)
        .setScrollFactor(0)
        .setDepth(TOUCH_UI_DEPTH)
        .setInteractive({ useHandCursor: true }),
    );
    const text = this.ui(
      this.add
        .text(0, 0, label, { fontFamily: "monospace", fontSize: "15px", color: "#ffffff" })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(TOUCH_UI_DEPTH + 1),
    );
    box.on("pointerdown", onTap);
    this.edgeAnchored.push({
      place: (width, height) => {
        const { x, y } = at(width, height);
        box.setPosition(x, y);
        text.setPosition(x, y);
      },
    });
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
  }

  // Kept to two lines on a phone held upright, which is what it wraps to at
  // this length. It ran to three while it explained the spellbook in full,
  // and a third of a portrait screen is too much to spend on a caption.
  private get statusLine(): string {
    const plant = PLANT_TYPES[this.selectedPlantIndex];
    const spell = this.spellTrayOpen ? "tap + to grow the tile ahead" : "spellbook";
    return this.mobileControls
      ? `Drag to walk  Plant ahead: ${plant}  Book: ${spell}`
      : `Arrows/WASD  Plant ahead: ${plant} (1-${PLANT_TYPES.length})  Space: plant  B: ${spell}`;
  }
}
