// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  pixelArt: true,
  backgroundColor: "#000000",
  // RESIZE, not FIT. FIT letterboxed a fixed 800x600 into whatever the screen
  // was, which cost 60% of a portrait phone to black bars that no touch can
  // reach, and scaled the whole UI by a fractional factor — 0.49 on a Pixel 5,
  // so nothing was pixel-aligned and every touch target came out half the size
  // it was drawn. Filling the viewport instead makes the game's coordinate
  // space real CSS pixels: a 64px button is a 64px button, and the world is
  // magnified by an integer camera zoom (see GameScene) so the art stays
  // exactly pixel-aligned.
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: "100%",
    height: "100%",
  },
  // >1 so steering with the joystick and tapping an action button at the same
  // time both register (default of 1 only tracks a single pointer).
  input: {
    activePointers: 3,
  },
  scene: [BootScene, GameScene],
});

// Drive the resize explicitly rather than relying on the ScaleManager
// noticing its parent changed: on an orientation change the parent's new size
// is not reliably observed, and the game keeps its old dimensions while the
// browser scales the canvas element to fit — which is the letterboxing that
// switching to RESIZE was meant to remove.
window.addEventListener("resize", () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
});
