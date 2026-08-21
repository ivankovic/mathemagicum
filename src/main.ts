// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";
import { PlayersScene } from "./scenes/PlayersScene";

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
  scene: [BootScene, PlayersScene, GameScene],
});

/**
 * Drive the resize explicitly, all the way down.
 *
 * The ScaleManager is not told to notice its parent changed, because on an
 * orientation change the parent's new size is not reliably observed: the game
 * keeps its old dimensions while the browser scales the canvas element to fit,
 * which is the letterboxing that switching to RESIZE was meant to remove.
 *
 * **And the renderer is told too.** `scale.resize` sets the canvas and then
 * calls `refresh`, which in RESIZE mode overwrites the size it was just given
 * with the parent element's *last measured* bounds — and those are measured
 * afterwards, so on the turn of a phone they are the bounds from before it
 * turned. The renderer compares the size it is handed against its own, sees no
 * change, and keeps a portrait viewport on a landscape screen: the world draws
 * into the old rectangle and everything outside it is black. That is what a
 * playtest called "rotating the device breaks the game".
 */
function fitToWindow(): void {
  game.scale.resize(window.innerWidth, window.innerHeight);
  // To the canvas's own size, not to the window's. The renderer's scissor is
  // computed against `gl.drawingBufferHeight`, so handing it a height the
  // canvas has not taken yet puts the scissor off the bottom of the buffer —
  // which is a black band exactly as tall as the screen used to be.
  game.renderer.resize(game.canvas.width, game.canvas.height);
}

window.addEventListener("resize", () => {
  fitToWindow();
  // And again on the next frame. The first pass runs before the browser has
  // reflowed the canvas's parent, so the ScaleManager measures the bounds
  // from before the turn; the second finds them settled. Doing it twice is
  // cheap and does not depend on guessing when a reflow lands.
  requestAnimationFrame(fitToWindow);
});
