// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import Phaser from "phaser";
import {
  CHUNK_SIZE,
  type ChunkCoord,
  chunkKey,
  chunkScreenBounds,
  chunksCoveringTileRange,
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
import { PLANT_COLORS, TERRAIN_COLORS } from "../world/palette";
import { findPath } from "../world/pathfinding";
import { PlantType } from "../world/plants";
import { generateStubWorld } from "../world/stubWorld";
import type { TerrainType } from "../world/terrain";

const WORLD_SIZE = 500;
const MOVE_DURATION_MS = 160;
const PLANT_TYPES = Object.values(PlantType);
const TOUCH_UI_DEPTH = 2000;
const CHUNK_DEPTH = -1000;
const CHUNK_VIEW_MARGIN = 1;
// Generous cache so panning back and forth doesn't constantly re-render —
// well above what's ever simultaneously visible on screen.
const CHUNK_CACHE_LIMIT = 60;

type DirectionTag = "up" | "down" | "left" | "right";

interface Direction {
  dCol: number;
  dRow: number;
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
// World terrain (src/world/stubWorld.ts) is a temporary stand-in for the
// real generator (docs/WORLD_GENERATION.md) while rendering/camera/chunking
// gets built and proven out — see docs task tracking for the swap-over.
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
  private chunkScratch!: Phaser.GameObjects.Graphics;
  private frameCounter = 0;

  constructor() {
    super("game");
  }

  create(): void {
    this.mobileControls = !this.sys.game.device.os.desktop;

    const world = generateStubWorld(WORLD_SIZE);
    this.grid = world.grid;
    this.playerCol = world.playerStart.col;
    this.playerRow = world.playerStart.row;

    const bounds = computeMapScreenBounds(this.grid.width, this.grid.height);
    this.originX = -bounds.minX;
    this.originY = -bounds.minY;
    const mapPixelWidth = bounds.maxX - bounds.minX;
    const mapPixelHeight = bounds.maxY - bounds.minY;

    this.chunkScratch = this.add.graphics().setVisible(false);

    const start = this.toScreen(this.playerCol, this.playerRow);
    this.player = this.add.circle(start.x, start.y, 10, 0xff5252).setStrokeStyle(2, 0xffffff);
    this.player.setDepth(isoDepth(this.playerCol, this.playerRow) + 0.5);

    this.cameras.main.setBounds(0, 0, mapPixelWidth, mapPixelHeight);
    this.cameras.main.startFollow(this.player);
    this.refreshVisibleChunks();

    this.statusText = this.add
      .text(8, 8, "", { fontFamily: "monospace", fontSize: "13px", color: "#ffffff" })
      .setScrollFactor(0)
      .setDepth(1000);
    this.messageText = this.add
      .text(8, 26, "", { fontFamily: "monospace", fontSize: "13px", color: "#ffeb3b" })
      .setScrollFactor(0)
      .setDepth(1000);
    this.updateStatusText();

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
    const raw = chunkScreenBounds(chunk, TILE_WIDTH, TILE_HEIGHT);
    const minX = Math.floor(raw.minX);
    const minY = Math.floor(raw.minY);
    const width = Math.ceil(raw.maxX) - minX;
    const height = Math.ceil(raw.maxY) - minY;

    const colStart = chunk.chunkCol * CHUNK_SIZE;
    const rowStart = chunk.chunkRow * CHUNK_SIZE;
    const colEnd = Math.min(colStart + CHUNK_SIZE, this.grid.width);
    const rowEnd = Math.min(rowStart + CHUNK_SIZE, this.grid.height);

    this.chunkScratch.clear();
    for (let row = rowStart; row < rowEnd; row++) {
      for (let col = colStart; col < colEnd; col++) {
        const p = gridToScreen(col, row);
        this.drawDiamond(this.chunkScratch, p.x - minX, p.y - minY, this.grid.getTerrain(col, row));
      }
    }

    const texture = this.add.renderTexture(this.originX + minX, this.originY + minY, width, height);
    texture.setOrigin(0, 0);
    texture.setDepth(CHUNK_DEPTH);
    texture.draw(this.chunkScratch, 0, 0);

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

  private drawDiamond(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    terrain: TerrainType,
  ): void {
    graphics.fillStyle(TERRAIN_COLORS[terrain], 1);
    graphics.beginPath();
    graphics.moveTo(x, y - TILE_HEIGHT / 2);
    graphics.lineTo(x + TILE_WIDTH / 2, y);
    graphics.lineTo(x, y + TILE_HEIGHT / 2);
    graphics.lineTo(x - TILE_WIDTH / 2, y);
    graphics.closePath();
    graphics.fillPath();
    graphics.lineStyle(1, 0x000000, 0.15);
    graphics.strokePath();
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
