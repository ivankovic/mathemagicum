// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import Phaser from "phaser";

// Placeholder scene proving the Bun + Vite + Phaser toolchain boots and
// renders. No gameplay, entity, or isometric-projection code lives here on
// purpose — that design is reserved for a later, deliberate pass.
export class GameScene extends Phaser.Scene {
  constructor() {
    super("game");
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, 64, 64, 0x22cc88).setStrokeStyle(2, 0xffffff);
    this.add
      .text(width / 2, height / 2 + 56, "mathemagicum: toolchain OK", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#ffffff",
      })
      .setOrigin(0.5, 0);
  }
}
