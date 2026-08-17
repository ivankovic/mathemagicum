// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import type { Facing } from "../world/characters";
import {
  BASE_RADIUS,
  THUMB_RADIUS,
  type Vector,
  clampBase,
  joystickDirection,
  thumbOffset,
} from "./joystick";

const BASE_FILL = 0x000000;
const BASE_ALPHA = 0.28;
const RING_COLOR = 0xffffff;
const THUMB_FILL = 0xffffff;
const THUMB_ALPHA = 0.55;

/**
 * A joystick that appears wherever the screen is pressed and vanishes on
 * release.
 *
 * Floating rather than pinned to a corner because a phone is held differently
 * by everyone holding one: a fixed pad is either under the thumb or nowhere
 * near it, while one that materialises where the thumb already is fits every
 * grip and both hands. The cost is that it cannot be discovered by looking at
 * the screen, which is why the status line says to drag.
 *
 * It owns the pointer that summoned it and ignores every other one, so a
 * second finger can hit an action button without the stick jumping to it.
 */
export class VirtualJoystick {
  private readonly base: Phaser.GameObjects.Arc;
  private readonly ring: Phaser.GameObjects.Arc;
  private readonly thumb: Phaser.GameObjects.Arc;
  private center: Vector = { x: 0, y: 0 };
  private offset: Vector = { x: 0, y: 0 };
  // Which pointer is driving it, or null when the stick is down. Phaser
  // reuses pointer ids, so this is only ever compared while active.
  private pointerId: number | null = null;

  /**
   * `register` is handed every object the widget draws with, so the scene can
   * assign them to its UI camera. The joystick has to be measured in real
   * screen pixels rather than magnified with the world, and the scene owns
   * that split — see GameScene's `ui`.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    depth: number,
    register?: (object: Phaser.GameObjects.GameObject) => void,
  ) {
    const add = scene.add;
    this.base = add.circle(0, 0, BASE_RADIUS, BASE_FILL, BASE_ALPHA);
    this.ring = add.circle(0, 0, BASE_RADIUS).setStrokeStyle(2, RING_COLOR, 0.45);
    this.thumb = add.circle(0, 0, THUMB_RADIUS, THUMB_FILL, THUMB_ALPHA);
    for (const part of this.parts()) {
      part.setScrollFactor(0).setDepth(depth).setVisible(false);
      register?.(part);
    }
  }

  private parts(): Phaser.GameObjects.Arc[] {
    return [this.base, this.ring, this.thumb];
  }

  get active(): boolean {
    return this.pointerId !== null;
  }

  /** True if `pointer` is the one currently driving the stick. */
  owns(pointer: Phaser.Input.Pointer): boolean {
    return this.pointerId === pointer.id;
  }

  begin(pointer: Phaser.Input.Pointer): void {
    // Ignore a second finger while one is already steering, rather than
    // teleporting the stick to it mid-walk.
    if (this.active) return;
    this.pointerId = pointer.id;
    this.center = clampBase(
      { x: pointer.x, y: pointer.y },
      this.scene.scale.width,
      this.scene.scale.height,
    );
    this.offset = { x: 0, y: 0 };
    this.render();
    for (const part of this.parts()) part.setVisible(true);
  }

  move(pointer: Phaser.Input.Pointer): void {
    if (!this.owns(pointer)) return;
    this.offset = thumbOffset(this.center, { x: pointer.x, y: pointer.y });
    this.render();
  }

  end(pointer: Phaser.Input.Pointer): void {
    if (!this.owns(pointer)) return;
    this.pointerId = null;
    this.offset = { x: 0, y: 0 };
    for (const part of this.parts()) part.setVisible(false);
  }

  /** The held direction, or null when released or resting in the deadzone. */
  direction(): Facing | null {
    if (!this.active) return null;
    return joystickDirection(this.offset);
  }

  private render(): void {
    this.base.setPosition(this.center.x, this.center.y);
    this.ring.setPosition(this.center.x, this.center.y);
    this.thumb.setPosition(this.center.x + this.offset.x, this.center.y + this.offset.y);
  }
}
