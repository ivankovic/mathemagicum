// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { type Facing, facingForVector } from "../world/characters";

// A floating joystick's geometry, with no drawing in it — this is the part
// worth testing, and it holds none of the Phaser objects that make the rest
// of the widget awkward to reason about.

// How far the thumb can travel from the base's centre. Roughly a thumb's
// comfortable reach without shifting grip.
export const BASE_RADIUS = 56;
export const THUMB_RADIUS = 22;

// Dead centre. Below this the joystick reads as "held but not pushed", which
// has to be a real state: a finger resting still after a press should stop
// the character rather than drift them in whichever direction it last
// wobbled toward.
export const DEADZONE = 14;

export interface Vector {
  x: number;
  y: number;
}

/**
 * The thumb's offset from the base, clamped to the base's radius.
 *
 * Clamped rather than free so that dragging further does not keep moving the
 * thumb off the widget — past the edge the direction still tracks the finger
 * but the thumb stays on its ring, which is what makes the control feel like
 * a stick rather than a dot chasing the touch.
 */
export function thumbOffset(from: Vector, to: Vector, radius = BASE_RADIUS): Vector {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= radius || distance === 0) return { x: dx, y: dy };
  const scale = radius / distance;
  return { x: dx * scale, y: dy * scale };
}

/**
 * Which way the stick is pushed, or null if it is inside the deadzone.
 *
 * Deliberately the same four-way snap the character art and the grid step
 * both use (see facingForVector), rather than an analog angle: the world is
 * walked one cell at a time along the cardinals, so an eight-way or analog
 * stick would report directions the game cannot act on.
 */
export function joystickDirection(offset: Vector, deadzone = DEADZONE): Facing | null {
  if (Math.hypot(offset.x, offset.y) < deadzone) return null;
  return facingForVector(offset.x, offset.y);
}

/**
 * Where to actually put the base when the screen is pressed at `press`.
 *
 * Nudged inward so the whole widget stays on screen. A joystick half off the
 * bottom edge is the normal case, not an edge case — the bottom of the screen
 * is exactly where thumbs land — and one clipped to the viewport would give
 * less travel in one direction than the other, quietly biasing movement.
 */
export function clampBase(
  press: Vector,
  width: number,
  height: number,
  radius = BASE_RADIUS,
): Vector {
  // A viewport smaller than the widget can't satisfy both edges; centring is
  // the least-bad answer and keeps the travel symmetric.
  const clamp = (value: number, extent: number) =>
    extent < radius * 2 ? extent / 2 : Math.min(Math.max(value, radius), extent - radius);
  return { x: clamp(press.x, width), y: clamp(press.y, height) };
}
