// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// Deliberately Phaser-free: this module exists to prove `bun test` runs
// without touching the DOM. Anything importing Phaser transitively touches
// window/document/HTMLCanvasElement, which bun:test's runtime does not
// provide — keep engine-boundary logic like this on the Phaser-free side.
export function projectName(): string {
  return "mathemagicum";
}
