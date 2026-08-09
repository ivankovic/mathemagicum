// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: 800,
  height: 600,
  pixelArt: true,
  backgroundColor: "#000000",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // >1 so holding a d-pad touch button and tapping the plant button at the
  // same time both register (default of 1 only tracks a single pointer).
  input: {
    activePointers: 3,
  },
  scene: [BootScene, GameScene],
});
