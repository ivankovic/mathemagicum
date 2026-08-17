// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import Phaser from "phaser";
import { VirtualJoystick } from "../input/VirtualJoystick";
import type { AreaPlacement } from "../world/anchors";
import {
  BUILDING_SPRITES,
  type BuildingRole,
  type BuildingSprite,
  ROLE_SPRITES,
  buildingAnimKey,
  spriteSheetKey,
} from "../world/buildings";
import {
  ALL_CHARACTERS,
  CHARACTER_ANIMATIONS,
  DEFAULT_FACING,
  type Facing,
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
import type { WorldGrid } from "../world/grid";
import type { PlacedObject } from "../world/objects";
import { DEFAULT_OBJECT_COLOR, OBJECT_COLORS, PLANT_COLORS } from "../world/palette";
import { findPath } from "../world/pathfinding";
import { PlantType } from "../world/plants";
import {
  type BuildingSidecar,
  type CharacterSidecar,
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
const PLANT_TYPES = Object.values(PlantType);
// Depth is a pixel y now (see topdown.ts's depthFor), not the tile-unit
// col + row the isometric projection sorted on — so it runs to the world's
// pixel height rather than topping out around 1000. Anything that has to
// float above the world has to clear that, and deriving these from
// WORLD_SIZE keeps them right if the world grows.
const WORLD_DEPTH_CEILING = WORLD_SIZE * TILE_SIZE;
const NIGHT_TINT_DEPTH = WORLD_DEPTH_CEILING + 1000;
const HUD_DEPTH = WORLD_DEPTH_CEILING + 2000;
const TOUCH_UI_DEPTH = WORLD_DEPTH_CEILING + 3000;
const CHUNK_DEPTH = -1000;
const CHUNK_VIEW_MARGIN = 1;
// Generous cache so panning back and forth doesn't constantly re-render —
// well above what's ever simultaneously visible on screen.
const CHUNK_CACHE_LIMIT = 60;

// Slow idle loop: the 8 frames are drifting chimney smoke, not motion.
const BUILDING_ANIM_FPS = 6;
const WELL_RADIUS = 9;

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

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Wasd;
  private plantKeys: Phaser.Input.Keyboard.Key[] = [];
  private plantActionKey!: Phaser.Input.Keyboard.Key;

  private mobileControls = false;
  private joystick?: VirtualJoystick;
  private path: GridPoint[] = [];

  private activeChunks = new Map<string, ActiveChunk>();
  private frameCounter = 0;

  // How many variants the atlas ships per corner combination, read from the
  // loaded texture rather than hardcoded — see terrainAtlas.ts.
  private terrainVariations = new Map<string, number>();
  private buildingSidecars = new Map<BuildingSprite, BuildingSidecar>();

  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private npcs: NpcRuntime[] = [];

  constructor() {
    super("game");
  }

  create(): void {
    this.mobileControls = !this.sys.game.device.os.desktop;
    this.loadAssetMetadata();

    const world = generateWorld(WORLD_SIZE, WORLD_SIZE, WORLD_SEED);
    this.grid = world.grid;
    this.playerCol = world.playerStart.col;
    this.playerRow = world.playerStart.row;

    const bounds = computeMapScreenBounds(this.grid.width, this.grid.height);
    this.originX = -bounds.minX;
    this.originY = -bounds.minY;
    const mapPixelWidth = bounds.maxX - bounds.minX;
    const mapPixelHeight = bounds.maxY - bounds.minY;

    const start = this.toFeet(this.playerCol, this.playerRow);
    this.player = this.add
      .sprite(start.x, start.y, characterSheetKey(PLAYER_CHARACTER))
      // Anchored at the feet: that point is both where the character stands
      // and what they depth-sort on, so there is only one number to keep
      // right as they walk.
      .setOrigin(0.5, 1)
      .setDepth(start.y);

    this.cameras.main.setBounds(0, 0, mapPixelWidth, mapPixelHeight);
    this.cameras.main.startFollow(this.player);
    this.refreshVisibleChunks();

    this.spawnBuildings([world.village.well, ...world.village.buildings]);
    this.spawnNpcs(world.village.npcs, world.anchors.village);

    this.statusText = this.add
      .text(8, 8, "", { fontFamily: "monospace", fontSize: "13px", color: "#ffffff" })
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);
    this.messageText = this.add
      .text(8, 26, "", { fontFamily: "monospace", fontSize: "13px", color: "#ffeb3b" })
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);
    this.updateStatusText();

    this.nightOverlay = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, NIGHT_TINT_COLOR, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(NIGHT_TINT_DEPTH);

    this.setupInput();
    if (this.mobileControls) this.createTouchControls();

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer, over: unknown[]) => {
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
    this.refreshVisibleChunks();

    const hour = timeOfDay(new Date());
    this.nightOverlay.setFillStyle(NIGHT_TINT_COLOR, nightTintAlpha(hour));
    this.updateNpcs(isDaytime(hour));

    // Depth follows the sprite's own y, which is its feet — so it stays
    // correct part-way through a step rather than only at whole tiles.
    this.player.setDepth(this.player.y);
    this.playCharacterAnim(this.player, PLAYER_CHARACTER, this.playerFacing, this.isMoving);
    for (const npc of this.npcs) {
      npc.sprite.setDepth(npc.sprite.y);
      this.playCharacterAnim(npc.sprite, npc.character, npc.facing, npc.isMoving);
    }

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
      const animKey = buildingAnimKey(sprite);
      if (this.anims.exists(animKey)) continue;
      this.anims.create({
        key: animKey,
        frames: this.anims.generateFrameNumbers(spriteSheetKey(sprite), {
          start: 0,
          end: sidecar.frame_count - 1,
        }),
        frameRate: BUILDING_ANIM_FPS,
        repeat: -1,
      });
    }

    this.registerCharacterAnims();
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

  private tryPlant(): void {
    const plant = PLANT_TYPES[this.selectedPlantIndex];
    if (!plant) return;

    if (this.grid.getPlant(this.playerCol, this.playerRow) !== null) {
      this.setMessage("Something is already planted here");
      return;
    }
    if (!this.grid.plant(this.playerCol, this.playerRow, plant)) {
      const terrain = this.grid.getTerrain(this.playerCol, this.playerRow);
      this.setMessage(`${plant} can't grow on ${terrain}`);
      return;
    }

    const { x, y } = this.toScreen(this.playerCol, this.playerRow);
    this.add.circle(x, y, 6, PLANT_COLORS[plant]).setDepth(this.entityDepth(this.playerRow));
    this.setMessage(`Planted ${plant}`);
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
  private spawnBuildings(objects: readonly PlacedObject[]): void {
    for (const object of objects) {
      const sprite = ROLE_SPRITES[object.type as BuildingRole];
      const sidecar = sprite ? this.buildingSidecars.get(sprite) : undefined;
      if (!sprite || !sidecar) {
        this.spawnUnartedObject(object);
        continue;
      }
      const origin = spriteOrigin(sidecar, object.col, object.row);
      this.add
        .sprite(this.originX + origin.x, this.originY + origin.y, spriteSheetKey(sprite))
        .setOrigin(0, 0)
        .setDepth(depthFor(footprintBottomY(sidecar, object.row)))
        .play(buildingAnimKey(sprite));
    }
  }

  // The village well has no generated art yet — the asset generator ships
  // buildings and terrain objects, and a well is neither. Drawn as the flat
  // placeholder disc it was before, so the square still reads as a square.
  private spawnUnartedObject(object: PlacedObject): void {
    const { x, y } = this.toScreen(object.anchorCol, object.anchorRow);
    this.add
      .circle(x, y, WELL_RADIUS, OBJECT_COLORS[object.type] ?? DEFAULT_OBJECT_COLOR)
      .setStrokeStyle(2, 0x37474f)
      .setDepth(this.entityDepth(object.row));
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
      const sprite = this.add
        .sprite(feet.x, feet.y, characterSheetKey(character))
        .setOrigin(0.5, 1)
        .setDepth(feet.y);
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
    this.joystick = new VirtualJoystick(this, TOUCH_UI_DEPTH);
    const actionX = this.scale.width - 70;
    this.addTapButton(actionX, this.scale.height - 70, 64, "Plant", () => this.tryPlant());
    this.addTapButton(actionX, this.scale.height - 142, 48, "Next", () => this.selectNextPlant());
  }

  private addTapButton(x: number, y: number, size: number, label: string, onTap: () => void): void {
    const button = this.addButtonBase(x, y, size, label, 15);
    button.on("pointerdown", onTap);
  }

  private addButtonBase(
    x: number,
    y: number,
    size: number,
    label: string,
    fontSize: number,
  ): Phaser.GameObjects.Rectangle {
    const button = this.add
      .rectangle(x, y, size, size, 0x000000, 0.45)
      .setStrokeStyle(2, 0xffffff, 0.6)
      .setScrollFactor(0)
      .setDepth(TOUCH_UI_DEPTH)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(x, y, label, { fontFamily: "monospace", fontSize: `${fontSize}px`, color: "#ffffff" })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(TOUCH_UI_DEPTH + 1);
    return button;
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
    const plant = PLANT_TYPES[this.selectedPlantIndex];
    this.statusText.setText(
      this.mobileControls
        ? `Drag anywhere to walk  Plant: ${plant}  (tap Next to change, Plant to plant)`
        : `Move: arrows/WASD  Plant: ${plant}  (keys 1-${PLANT_TYPES.length} to choose)  Space: plant here`,
    );
  }

  private setMessage(text: string): void {
    this.messageText.setText(text);
  }
}
