// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import Phaser from "phaser";
import type { AreaPlacement } from "../world/anchors";
import { buildingSpriteKey, buildingVariantFor } from "../world/buildingSprites";
import {
  CHUNK_SIZE,
  type ChunkCoord,
  chunkKey,
  chunksCoveringTileRange,
  dualChunkScreenBounds,
} from "../world/chunks";
import type { WorldGrid } from "../world/grid";
import {
  type GridPoint,
  type ScreenPoint,
  TILE_HEIGHT,
  TILE_WIDTH,
  computeMapScreenBounds,
  gridToScreen,
  isoDepth,
  screenToGrid,
} from "../world/iso";
import type { PlacedObject } from "../world/objects";
import { PLANT_COLORS } from "../world/palette";
import { findPath } from "../world/pathfinding";
import { PlantType } from "../world/plants";
import { TerrainType } from "../world/terrain";
import {
  FULL_MASK,
  TERRAIN_PRIORITY,
  baseTerrainFor,
  cornerMaskFor,
  dualTileKey,
  tileVariantFor,
} from "../world/tileset";
import { NIGHT_TINT_COLOR, isDaytime, nightTintAlpha, timeOfDay } from "../world/time";
import type { VillageNpcSpec } from "../world/villageLayout";
import { generateWorld } from "../world/worldGenerator";

const WORLD_SIZE = 500;
// Fixed for now so the world is reproducible during development; will
// likely become player-chosen (or randomized per new game) once there's a
// save/new-game flow to hang that choice off of.
const WORLD_SEED = 12345;
const MOVE_DURATION_MS = 160;
const PLANT_TYPES = Object.values(PlantType);
const TOUCH_UI_DEPTH = 2000;
const NIGHT_TINT_DEPTH = 500;
const CHUNK_DEPTH = -1000;
const CHUNK_VIEW_MARGIN = 1;
// Generous cache so panning back and forth doesn't constantly re-render —
// well above what's ever simultaneously visible on screen.
const CHUNK_CACHE_LIMIT = 60;

const NPC_COLOR = 0x8e24aa;
const NPC_MOVE_DURATION_MS = 500;
const NPC_STEP_MIN_MS = 1500;
const NPC_STEP_MAX_MS = 4000;
// Villagers/teacher/shopkeeper wander near their own building; the postal
// worker patrols the whole village (see docs/WORLD_GENERATION.md's "Village
// NPC roles" — only the postal worker's movement covers the full square).
const LOCAL_WANDER_RADIUS = 5;
const PATROL_WANDER_RADIUS = 16;

type DirectionTag = "up" | "down" | "left" | "right";

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
  homeCol: number;
  homeRow: number;
  wanderCenterCol: number;
  wanderCenterRow: number;
  wanderRadius: number;
  col: number;
  row: number;
  sprite: Phaser.GameObjects.Arc;
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

  private player!: Phaser.GameObjects.Arc;
  private playerCol = 0;
  private playerRow = 0;
  private isMoving = false;

  private selectedPlantIndex = 0;
  private statusText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Wasd;
  private plantKeys: Phaser.Input.Keyboard.Key[] = [];
  private plantActionKey!: Phaser.Input.Keyboard.Key;

  private mobileControls = false;
  private touchDirection: DirectionTag | null = null;
  private path: GridPoint[] = [];

  private activeChunks = new Map<string, ActiveChunk>();
  private frameCounter = 0;

  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private npcs: NpcRuntime[] = [];

  constructor() {
    super("game");
  }

  create(): void {
    this.mobileControls = !this.sys.game.device.os.desktop;

    const world = generateWorld(WORLD_SIZE, WORLD_SIZE, WORLD_SEED);
    this.grid = world.grid;
    this.playerCol = world.playerStart.col;
    this.playerRow = world.playerStart.row;

    const bounds = computeMapScreenBounds(this.grid.width, this.grid.height);
    this.originX = -bounds.minX;
    this.originY = -bounds.minY;
    const mapPixelWidth = bounds.maxX - bounds.minX;
    const mapPixelHeight = bounds.maxY - bounds.minY;

    const start = this.toScreen(this.playerCol, this.playerRow);
    this.player = this.add.circle(start.x, start.y, 10, 0xff5252).setStrokeStyle(2, 0xffffff);
    this.player.setDepth(isoDepth(this.playerCol, this.playerRow) + 0.5);

    this.cameras.main.setBounds(0, 0, mapPixelWidth, mapPixelHeight);
    this.cameras.main.startFollow(this.player);
    this.refreshVisibleChunks();

    this.spawnBuildings([world.village.well, ...world.village.buildings]);
    this.spawnNpcs(world.village.npcs, world.anchors.village);

    this.statusText = this.add
      .text(8, 8, "", { fontFamily: "monospace", fontSize: "13px", color: "#ffffff" })
      .setScrollFactor(0)
      .setDepth(1000);
    this.messageText = this.add
      .text(8, 26, "", { fontFamily: "monospace", fontSize: "13px", color: "#ffeb3b" })
      .setScrollFactor(0)
      .setDepth(1000);
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
      this.handleTileClick(pointer.worldX, pointer.worldY);
    });
  }

  override update(): void {
    this.frameCounter++;
    this.refreshVisibleChunks();

    const hour = timeOfDay(new Date());
    this.nightOverlay.setFillStyle(NIGHT_TINT_COLOR, nightTintAlpha(hour));
    this.updateNpcs(isDaytime(hour));

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
    const raw = dualChunkScreenBounds(chunk, TILE_WIDTH, TILE_HEIGHT);
    const minX = Math.floor(raw.minX);
    const minY = Math.floor(raw.minY);
    const width = Math.ceil(raw.maxX) - minX;
    const height = Math.ceil(raw.maxY) - minY;

    const colStart = chunk.chunkCol * CHUNK_SIZE;
    const rowStart = chunk.chunkRow * CHUNK_SIZE;
    const colEnd = Math.min(colStart + CHUNK_SIZE, this.grid.width);
    const rowEnd = Math.min(rowStart + CHUNK_SIZE, this.grid.height);

    const texture = this.add.renderTexture(this.originX + minX, this.originY + minY, width, height);
    texture.setOrigin(0, 0);
    texture.setDepth(CHUNK_DEPTH);

    // Objects (buildings, the well) are standalone Image sprites with
    // their own isoDepth-based sort (see spawnBuildings), not baked into
    // this RenderTexture — a building needs to rise above and often
    // overhang its own footprint, which a flat tile stamped into a chunk
    // can't express, and needs to depth-sort against the player/NPCs
    // walking around it, which a static baked texture can't either.
    //
    // Terrain rendering: one pass over the DUAL grid (see tileset.ts's
    // module docstring) — one extra row/column of tiles beyond this
    // chunk's own data-tile range on every side, since each dual tile's 4
    // vertices reach one data cell outside a naive col/row-aligned range.
    // Per dual tile:
    //  1. Its base terrain (baseTerrainFor — the lowest-priority terrain
    //     actually present among its 4 corners), drawn SOLID underneath
    //     everything else. Not just a defensive backstop: standard
    //     source-over compositing of several semi-transparent layers
    //     doesn't reconstruct their analytic sum for anything below the
    //     topmost one, so the base has to be a terrain the tile actually
    //     touches or an unrelated color visibly bleeds through — see
    //     baseTerrainFor's own docstring for the algebra.
    //  2. Per TERRAIN_PRIORITY entry (lowest first): cornerMaskFor tells
    //     us which of the tile's 4 corners are this terrain; mask 0 means
    //     none of them are, so there's nothing to draw for this terrain
    //     here. No separate "own cut" vs "neighbour's wedge" case split
    //     like the old 47-tile blob scheme needed — the same mask
    //     computation and the same texture key format apply to every
    //     terrain uniformly (including the base terrain's own layer,
    //     which just redraws its own solid color over itself — a no-op).
    //
    // Dual tile "(dualCol, dualRow)" is centered at data-grid position
    // (dualCol + 0.5, dualRow + 0.5) — since gridToScreen is linear, that
    // center is gridToScreen(dualCol, dualRow) shifted by (0, TILE_HEIGHT
    // / 2) (see tileset.ts), so its top-left draw position is just
    // gridToScreen(dualCol, dualRow) shifted left by TILE_WIDTH / 2 (same
    // as a data tile's own x) and NOT shifted up by TILE_HEIGHT / 2 (unlike
    // a data tile's own y) — the two half-tile shifts cancel.
    //
    // beginDraw/batchDrawFrame/endDraw wraps ALL of this in one GPU flush
    // (not stamp(), which is draw() under the hood — a full flush per
    // call) — a chunk can need several times CHUNK_SIZE^2 individual tile
    // draws here, and stamp()-per-tile measured as an effectively
    // unrecoverable hang under software-rendered WebGL (confirmed via a
    // real headless-browser run, not just a guess) — Phaser's own docs
    // call this batch API out for exactly "large numbers of objects."
    texture.beginDraw();
    for (let dualRow = rowStart - 1; dualRow < rowEnd; dualRow++) {
      for (let dualCol = colStart - 1; dualCol < colEnd; dualCol++) {
        const p = gridToScreen(dualCol, dualRow);
        const x = p.x - minX - TILE_WIDTH / 2;
        const y = p.y - minY;

        const variant = tileVariantFor(dualCol, dualRow);

        const baseTerrain = baseTerrainFor(this.grid, dualCol, dualRow);
        const baseKey = dualTileKey(baseTerrain, FULL_MASK, variant);
        texture.batchDrawFrame(baseKey, undefined, x, y);

        for (const terrain of TERRAIN_PRIORITY) {
          const mask = cornerMaskFor(this.grid, dualCol, dualRow, terrain);
          if (mask === 0) continue;
          const key = dualTileKey(terrain, mask, variant);
          texture.batchDrawFrame(key, undefined, x, y);
        }
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
    if (this.cursors.up.isDown || this.wasd.up.isDown || this.touchDirection === "up") {
      return { dCol: 0, dRow: -1 };
    }
    if (this.cursors.down.isDown || this.wasd.down.isDown || this.touchDirection === "down") {
      return { dCol: 0, dRow: 1 };
    }
    if (this.cursors.left.isDown || this.wasd.left.isDown || this.touchDirection === "left") {
      return { dCol: -1, dRow: 0 };
    }
    if (this.cursors.right.isDown || this.wasd.right.isDown || this.touchDirection === "right") {
      return { dCol: 1, dRow: 0 };
    }
    return null;
  }

  private tryMove(dCol: number, dRow: number): void {
    const targetCol = this.playerCol + dCol;
    const targetRow = this.playerRow + dRow;
    if (!this.grid.isPassable(targetCol, targetRow)) return;

    this.isMoving = true;
    this.playerCol = targetCol;
    this.playerRow = targetRow;
    this.player.setDepth(isoDepth(targetCol, targetRow) + 0.5);

    const target = this.toScreen(targetCol, targetRow);
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
    this.add
      .circle(x, y, 6, PLANT_COLORS[plant])
      .setDepth(isoDepth(this.playerCol, this.playerRow));
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
  // One standalone Image per placed object (well + every village building),
  // anchored bottom-centre at its own anchorCol/anchorRow (see objects.ts's
  // PlacedObject docstring — normally the footprint's front-facing cell,
  // not its top-left corner or centre) and depth-sorted the same way
  // NPCs/the player are, so the player walking near a tall building's base
  // occludes/is occluded correctly instead of always drawing on top of or
  // under it. Static once placed — no per-frame update needed.
  private spawnBuildings(objects: readonly PlacedObject[]): void {
    for (const object of objects) {
      const { x, y } = this.toScreen(object.anchorCol, object.anchorRow);
      const variant = buildingVariantFor(object.col, object.row);
      const key = buildingSpriteKey(object.type, variant);
      this.add
        .image(x, y, key)
        .setOrigin(0.5, 1)
        .setDepth(isoDepth(object.anchorCol, object.anchorRow));
    }
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
    this.npcs = specs.map((spec) => {
      const isPostalWorker = spec.id === "postal-worker";
      const wanderCenter = isPostalWorker ? villageCenter : spec.home;
      const screen = this.toScreen(spec.home.col, spec.home.row);
      const sprite = this.add.circle(screen.x, screen.y, 8, NPC_COLOR).setStrokeStyle(2, 0xffffff);
      sprite.setDepth(isoDepth(spec.home.col, spec.home.row) + 0.4);
      return {
        id: spec.id,
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
    npc.isMoving = true;
    npc.col = col;
    npc.row = row;
    npc.sprite.setDepth(isoDepth(col, row) + 0.4);
    const target = this.toScreen(col, row);
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

  // On-screen d-pad + action buttons, shown only when Phaser detects a
  // non-desktop OS (this.mobileControls). Keyboard input stays live
  // underneath regardless, so a mobile browser with an attached keyboard
  // still works too.
  private createTouchControls(): void {
    const dpadX = 70;
    const dpadY = this.scale.height - 70;
    const gap = 54;
    this.addHoldButton(dpadX, dpadY - gap, "▲", "up");
    this.addHoldButton(dpadX, dpadY + gap, "▼", "down");
    this.addHoldButton(dpadX - gap, dpadY, "◀", "left");
    this.addHoldButton(dpadX + gap, dpadY, "▶", "right");

    const actionX = this.scale.width - 70;
    this.addTapButton(actionX, this.scale.height - 70, 64, "Plant", () => this.tryPlant());
    this.addTapButton(actionX, this.scale.height - 142, 48, "Next", () => this.selectNextPlant());
  }

  private addHoldButton(x: number, y: number, label: string, dir: DirectionTag): void {
    const button = this.addButtonBase(x, y, 48, label, 20);
    const clear = () => {
      if (this.touchDirection === dir) this.touchDirection = null;
    };
    button.on("pointerdown", () => {
      this.touchDirection = dir;
    });
    button.on("pointerup", clear);
    button.on("pointerout", clear);
    button.on("pointerupoutside", clear);
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

  private toScreen(col: number, row: number): ScreenPoint {
    const p = gridToScreen(col, row);
    return { x: p.x + this.originX, y: p.y + this.originY };
  }

  private toGrid(screenX: number, screenY: number): GridPoint {
    return screenToGrid(screenX - this.originX, screenY - this.originY);
  }

  private updateStatusText(): void {
    const plant = PLANT_TYPES[this.selectedPlantIndex];
    this.statusText.setText(
      this.mobileControls
        ? `Plant: ${plant}  (tap Next to change, Plant to plant)`
        : `Move: arrows/WASD  Plant: ${plant}  (keys 1-${PLANT_TYPES.length} to choose)  Space: plant here`,
    );
  }

  private setMessage(text: string): void {
    this.messageText.setText(text);
  }
}
