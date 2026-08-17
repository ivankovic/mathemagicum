// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import {
  ALL_CHARACTERS,
  DEFAULT_FACING,
  Facing,
  PLAYER_CHARACTER,
  VILLAGER_CHARACTERS,
  characterAnimKey,
  characterFor,
  facingFor,
  facingForVector,
  stepForFacing,
} from "./characters";

describe("facingFor", () => {
  test("maps each cardinal step to the matching facing", () => {
    expect(facingFor(0, 1, DEFAULT_FACING)).toBe(Facing.Down);
    expect(facingFor(0, -1, DEFAULT_FACING)).toBe(Facing.Up);
    expect(facingFor(1, 0, DEFAULT_FACING)).toBe(Facing.Right);
    expect(facingFor(-1, 0, DEFAULT_FACING)).toBe(Facing.Left);
  });

  test("row is positive downward, matching the grid", () => {
    // Getting this backwards would face every character the wrong way while
    // still animating perfectly, which is easy to miss and easy to assert.
    expect(facingFor(0, 1, Facing.Up)).toBe(Facing.Down);
  });

  test("keeps the current facing when there is no movement", () => {
    expect(facingFor(0, 0, Facing.Left)).toBe(Facing.Left);
  });

  test("prefers the vertical facing on a diagonal", () => {
    // The up/down poses show a whole body and the side poses a profile, so a
    // diagonal reads better face-on. Unreachable today — steps are cardinal —
    // but the function is total and this pins which way it resolves.
    expect(facingFor(1, 1, Facing.Left)).toBe(Facing.Down);
    expect(facingFor(-1, -1, Facing.Left)).toBe(Facing.Up);
  });

  test("falls back to horizontal when the vertical component is smaller", () => {
    expect(facingFor(2, 1, Facing.Up)).toBe(Facing.Right);
  });
});

describe("facingForVector", () => {
  test("is null only for a zero vector", () => {
    expect(facingForVector(0, 0)).toBeNull();
    expect(facingForVector(0, 1)).not.toBeNull();
  });

  test("reads a long vector the same way as a unit step", () => {
    // The joystick feeds this pixel offsets and the grid feeds it single
    // steps; if magnitude mattered the two would disagree about "up".
    expect(facingForVector(0, 50)).toBe(facingForVector(0, 1));
    expect(facingForVector(-90, 0)).toBe(facingForVector(-1, 0));
  });
});

describe("stepForFacing", () => {
  test("round-trips through facingForVector for all four facings", () => {
    for (const facing of Object.values(Facing)) {
      const step = stepForFacing(facing);
      expect(facingForVector(step.dCol, step.dRow)).toBe(facing);
    }
  });

  test("every step is a single cardinal cell", () => {
    for (const facing of Object.values(Facing)) {
      const { dCol, dRow } = stepForFacing(facing);
      expect(Math.abs(dCol) + Math.abs(dRow)).toBe(1);
    }
  });

  test("down is +row, matching the grid's orientation", () => {
    expect(stepForFacing(Facing.Down)).toEqual({ dCol: 0, dRow: 1 });
    expect(stepForFacing(Facing.Up)).toEqual({ dCol: 0, dRow: -1 });
  });
});

describe("characterFor", () => {
  test("gives each named role its own art", () => {
    expect(characterFor("teacher", 0)).toBe("teacher");
    expect(characterFor("postal-worker", 0)).toBe("postal-worker");
    expect(characterFor("shopkeeper", 0)).toBe("shopkeeper");
  });

  test("a named role ignores the villager index entirely", () => {
    expect(characterFor("teacher", 0)).toBe(characterFor("teacher", 5));
  });

  test("hands generic villagers out in order, not at random", () => {
    // An NPC has to keep the same face every time the world is regenerated
    // from the same seed, so this is positional rather than hashed.
    expect([characterFor("villager-1", 0), characterFor("villager-2", 1)]).toEqual([
      VILLAGER_CHARACTERS[0] as string,
      VILLAGER_CHARACTERS[1] as string,
    ]);
  });

  test("wraps rather than running out if the village grows", () => {
    const wrapped = characterFor("villager-9", VILLAGER_CHARACTERS.length);
    expect(VILLAGER_CHARACTERS).toContain(wrapped);
  });

  test("is stable for the same id and index", () => {
    expect(characterFor("villager-1", 0)).toBe(characterFor("villager-1", 0));
  });
});

describe("ALL_CHARACTERS", () => {
  test("covers the player, every named role and every villager", () => {
    expect(ALL_CHARACTERS).toContain(PLAYER_CHARACTER);
    for (const villager of VILLAGER_CHARACTERS) expect(ALL_CHARACTERS).toContain(villager);
    for (const role of ["teacher", "postal-worker", "shopkeeper"]) {
      expect(ALL_CHARACTERS).toContain(role);
    }
  });

  test("has no duplicates — each one is loaded exactly once", () => {
    expect(new Set(ALL_CHARACTERS).size).toBe(ALL_CHARACTERS.length);
  });
});

describe("characterAnimKey", () => {
  test("distinguishes character, animation and facing", () => {
    const keys = new Set([
      characterAnimKey("player", "walk", Facing.Down),
      characterAnimKey("player", "idle", Facing.Down),
      characterAnimKey("player", "walk", Facing.Up),
      characterAnimKey("teacher", "walk", Facing.Down),
    ]);
    expect(keys.size).toBe(4);
  });
});
