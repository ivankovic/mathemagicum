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
 * Which way the stick is pushed, as a *facing*, or null inside the deadzone.
 *
 * Four-way, because four is all the character art has. This is what the
 * player is drawn as; `joystickStep` is what they move along, and the two
 * are allowed to differ — somebody walking up and to the left is drawn
 * facing up.
 */
export function joystickDirection(offset: Vector, deadzone = DEADZONE): Facing | null {
  if (Math.hypot(offset.x, offset.y) < deadzone) return null;
  return facingForVector(offset.x, offset.y);
}

/**
 * How far along each axis the stick asks the player to move, in cells.
 *
 * Eight-way, where the facing is four-way. A playtest called four-direction
 * movement annoying and it is: walking to something up and to the left means
 * two separate pushes, and every one of the world's roads and gardens is laid
 * out on a grid a child wants to cut across.
 *
 * Snapped into eight equal octants of 45 degrees each — an axis counts once
 * the stick is more than 22.5 degrees off the other one, which is what
 * `tan(22.5°)` is. Equal octants matter more than they sound: a diagonal
 * band narrower than the cardinal ones is a stick that will not go diagonally
 * when you ask it, and a wider one is a stick that goes diagonally when you
 * did not.
 */
const OCTANT = Math.tan(Math.PI / 8);

export function joystickStep(offset: Vector, deadzone = DEADZONE): Step | null {
  if (Math.hypot(offset.x, offset.y) < deadzone) return null;
  const major = Math.max(Math.abs(offset.x), Math.abs(offset.y));
  if (major === 0) return null;
  const step = {
    dCol: Math.abs(offset.x) >= major * OCTANT ? Math.sign(offset.x) : 0,
    dRow: Math.abs(offset.y) >= major * OCTANT ? Math.sign(offset.y) : 0,
  };
  return step.dCol === 0 && step.dRow === 0 ? null : step;
}

/** One step of movement, along either axis or both at once. */
export interface Step {
  readonly dCol: number;
  readonly dRow: number;
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
