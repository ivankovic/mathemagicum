// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import Phaser from "phaser";
import { WorldGrid } from "../world/grid";
import { type ScreenPoint, TILE_HEIGHT, TILE_WIDTH, gridToScreen, isoDepth } from "../world/iso";
import { PLAYER_START, STARTER_MAP } from "../world/mapData";
import { PLANT_COLORS, TERRAIN_COLORS } from "../world/palette";
import { PlantType } from "../world/plants";

const MOVE_DURATION_MS = 160;
const PLANT_TYPES = Object.values(PlantType);
const TOUCH_UI_DEPTH = 2000;

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

// Renders the world and lets the player walk it and plant on it. No
// gameplay/entity/isometric-projection design lives here beyond that — the
// actual gardening spells (math minigames) come later, one at a time.
export class GameScene extends Phaser.Scene {
  private grid!: WorldGrid;
  private originX = 0;
  private originY = 0;

  private player!: Phaser.GameObjects.Arc;
  private playerCol = PLAYER_START.col;
  private playerRow = PLAYER_START.row;
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

  constructor() {
    super("game");
  }

  create(): void {
    this.mobileControls = !this.sys.game.device.os.desktop;

    this.grid = new WorldGrid(STARTER_MAP);

    const mapScreenHeight = (this.grid.width + this.grid.height) * (TILE_HEIGHT / 2);
    this.originX = this.scale.width / 2;
    this.originY = (this.scale.height - mapScreenHeight) / 2 + TILE_HEIGHT / 2;

    this.drawTerrain();

    const start = this.toScreen(this.playerCol, this.playerRow);
    this.player = this.add.circle(start.x, start.y, 10, 0xff5252).setStrokeStyle(2, 0xffffff);
    this.player.setDepth(isoDepth(this.playerCol, this.playerRow) + 0.5);

    this.statusText = this.add
      .text(8, 8, "", { fontFamily: "monospace", fontSize: "13px", color: "#ffffff" })
      .setDepth(1000);
    this.messageText = this.add
      .text(8, 26, "", { fontFamily: "monospace", fontSize: "13px", color: "#ffeb3b" })
      .setDepth(1000);
    this.updateStatusText();

    this.setupInput();
    if (this.mobileControls) this.createTouchControls();
  }

  override update(): void {
    if (!this.isMoving) {
      const dir = this.pressedDirection();
      if (dir) this.tryMove(dir.dCol, dir.dRow);
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
      .setDepth(TOUCH_UI_DEPTH)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(x, y, label, { fontFamily: "monospace", fontSize: `${fontSize}px`, color: "#ffffff" })
      .setOrigin(0.5)
      .setDepth(TOUCH_UI_DEPTH + 1);
    return button;
  }

  private drawTerrain(): void {
    const graphics = this.add.graphics().setDepth(-1);
    for (let row = 0; row < this.grid.height; row++) {
      for (let col = 0; col < this.grid.width; col++) {
        const { x, y } = this.toScreen(col, row);
        graphics.fillStyle(TERRAIN_COLORS[this.grid.getTerrain(col, row)], 1);
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
    }
  }

  private toScreen(col: number, row: number): ScreenPoint {
    const p = gridToScreen(col, row);
    return { x: p.x + this.originX, y: p.y + this.originY };
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
