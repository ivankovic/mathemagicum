// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { readPainted } from "./paintedGround";
import { TerrainType } from "./terrain";

describe("reading painted ground back from a save", () => {
  test("keeps what makes sense", () => {
    expect(readPainted([[1, 2, "sand"]])).toEqual([[1, 2, TerrainType.Sand]]);
  });

  // A save is data from outside the program however it got there, and a
  // crash on load is a farm a child can never reach again. That the spell
  // which wrote these has gone changes nothing here: the saves it wrote are
  // still out there.
  test("and drops what does not", () => {
    expect(readPainted([[1, 2, "lava"]])).toEqual([]);
    expect(readPainted([[1.5, 2, "sand"]])).toEqual([]);
    expect(readPainted([[1, 2]])).toEqual([]);
    expect(readPainted(["sand"])).toEqual([]);
    for (const junk of [null, undefined, 7, {}, "sand"]) {
      expect(readPainted(junk)).toEqual([]);
    }
  });
});
