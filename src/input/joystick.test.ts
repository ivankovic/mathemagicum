// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { Facing } from "../world/characters";
import { BASE_RADIUS, DEADZONE, clampBase, joystickDirection, thumbOffset } from "./joystick";

describe("thumbOffset", () => {
  test("tracks the finger exactly while inside the base", () => {
    expect(thumbOffset({ x: 100, y: 100 }, { x: 110, y: 90 })).toEqual({ x: 10, y: -10 });
  });

  test("is zero when the finger has not moved", () => {
    expect(thumbOffset({ x: 100, y: 100 }, { x: 100, y: 100 })).toEqual({ x: 0, y: 0 });
  });

  test("clamps to the base radius once the finger goes past it", () => {
    const offset = thumbOffset({ x: 0, y: 0 }, { x: 500, y: 0 });
    expect(offset).toEqual({ x: BASE_RADIUS, y: 0 });
  });

  test("clamping keeps the direction, only shortening the reach", () => {
    const offset = thumbOffset({ x: 0, y: 0 }, { x: 300, y: 400 });
    expect(Math.hypot(offset.x, offset.y)).toBeCloseTo(BASE_RADIUS, 6);
    // 3:4 in, 3:4 out — a clamp that distorted the angle would steer wrong.
    expect(offset.y / offset.x).toBeCloseTo(400 / 300, 6);
  });

  test("a drag exactly on the rim is not rescaled", () => {
    expect(thumbOffset({ x: 0, y: 0 }, { x: 0, y: BASE_RADIUS })).toEqual({ x: 0, y: BASE_RADIUS });
  });
});

describe("joystickDirection", () => {
  test("reads each push as the matching facing", () => {
    const push = BASE_RADIUS;
    expect(joystickDirection({ x: 0, y: push })).toBe(Facing.Down);
    expect(joystickDirection({ x: 0, y: -push })).toBe(Facing.Up);
    expect(joystickDirection({ x: push, y: 0 })).toBe(Facing.Right);
    expect(joystickDirection({ x: -push, y: 0 })).toBe(Facing.Left);
  });

  test("screen y is down, so pushing down walks down", () => {
    // Pointer coordinates grow downward; getting this inverted would move the
    // character opposite the thumb while looking entirely plausible in code.
    expect(joystickDirection({ x: 0, y: 40 })).toBe(Facing.Down);
  });

  test("is null inside the deadzone, so a resting finger stops the walk", () => {
    expect(joystickDirection({ x: 0, y: 0 })).toBeNull();
    expect(joystickDirection({ x: DEADZONE - 1, y: 0 })).toBeNull();
  });

  test("engages as soon as the deadzone is cleared", () => {
    expect(joystickDirection({ x: DEADZONE, y: 0 })).toBe(Facing.Right);
  });

  test("the deadzone is radial, not per-axis", () => {
    // Just inside the ring diagonally: both axes exceed nothing on their own,
    // and a per-axis test would fire here when the stick is barely moved.
    const diagonal = (DEADZONE - 2) / Math.SQRT2;
    expect(joystickDirection({ x: diagonal, y: diagonal })).toBeNull();
  });

  test("snaps a diagonal push to one of four directions", () => {
    // The world is walked along the cardinals, so a diagonal has to resolve to
    // one of them rather than being reported as something unwalkable.
    const all = new Set([joystickDirection({ x: 40, y: 41 }), joystickDirection({ x: 41, y: 40 })]);
    expect(all).toEqual(new Set([Facing.Down, Facing.Right]));
  });

  test("a dead-even diagonal resolves vertically", () => {
    expect(joystickDirection({ x: 40, y: 40 })).toBe(Facing.Down);
    expect(joystickDirection({ x: -40, y: -40 })).toBe(Facing.Up);
  });
});

describe("clampBase", () => {
  test("leaves a press in open space where it landed", () => {
    expect(clampBase({ x: 400, y: 300 }, 800, 600)).toEqual({ x: 400, y: 300 });
  });

  test("pushes the widget inward so it stays fully on screen", () => {
    // Thumbs land near the bottom edge constantly, so this is the common case.
    const base = clampBase({ x: 10, y: 590 }, 800, 600);
    expect(base.x).toBe(BASE_RADIUS);
    expect(base.y).toBe(600 - BASE_RADIUS);
  });

  test("gives equal travel in both directions after clamping", () => {
    const width = 800;
    const height = 600;
    const base = clampBase({ x: 0, y: height }, width, height);
    // Unequal travel would quietly make one direction harder to reach than
    // its opposite, which reads as the controls being sticky.
    expect(base.x).toBeGreaterThanOrEqual(BASE_RADIUS);
    expect(base.y).toBeGreaterThanOrEqual(BASE_RADIUS);
    expect(width - base.x).toBeGreaterThanOrEqual(BASE_RADIUS);
    expect(height - base.y).toBeGreaterThanOrEqual(BASE_RADIUS);
  });

  test("centres on an axis too small to hold the widget at all", () => {
    expect(clampBase({ x: 5, y: 300 }, 60, 600)).toEqual({ x: 30, y: 300 });
  });
});
