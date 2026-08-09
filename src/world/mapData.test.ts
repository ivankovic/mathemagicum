// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { PLAYER_START, STARTER_MAP } from "./mapData";
import { isPassable } from "./terrain";

describe("STARTER_MAP", () => {
  test("every row has the same width", () => {
    const width = STARTER_MAP[0]?.length ?? 0;
    expect(width).toBeGreaterThan(0);
    for (const row of STARTER_MAP) {
      expect(row.length).toBe(width);
    }
  });

  test("contains more than one terrain type", () => {
    const seen = new Set(STARTER_MAP.flat());
    expect(seen.size).toBeGreaterThan(1);
  });

  test("player start tile is passable", () => {
    const terrain = STARTER_MAP[PLAYER_START.row]?.[PLAYER_START.col];
    if (!terrain) throw new Error("player start is out of map bounds");
    expect(isPassable(terrain)).toBe(true);
  });
});
