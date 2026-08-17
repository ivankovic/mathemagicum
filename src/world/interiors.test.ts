// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { BUILDING_SPRITES, ROLE_SPRITES } from "./buildings";
import {
  INTERIOR_ROOMS,
  buildInteriorGrid,
  interiorDoor,
  interiorFor,
  interiorOriginY,
} from "./interiors";
import type { InteriorSidecar } from "./spriteSidecar";

function room(overrides: Partial<InteriorSidecar> = {}): InteriorSidecar {
  return {
    sheet: null,
    room: "test-room",
    size_cells: { cols: 4, rows: 3 },
    tile_size: 32,
    wall_rise_px: 18,
    // [row, col] throughout, matching the generator.
    door_cell: [2, 1],
    blocked_cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 0],
      [1, 3],
      [2, 0],
      [2, 2],
      [2, 3],
    ],
    furniture: [],
    ...overrides,
  };
}

describe("buildInteriorGrid", () => {
  test("is exactly the size the room declares", () => {
    const grid = buildInteriorGrid(room());
    expect({ width: grid.width, height: grid.height }).toEqual({ width: 4, height: 3 });
  });

  test("blocks every cell the sidecar lists, reading them as [row, col]", () => {
    // The axis order is the one thing here that fails silently: swapped, the
    // walls land in the middle of the floor and the room still "works".
    const grid = buildInteriorGrid(room());
    for (const [r, c] of room().blocked_cells) {
      expect({ c, r, passable: grid.isPassable(c, r) }).toEqual({ c, r, passable: false });
    }
  });

  test("leaves the rest of the floor walkable", () => {
    const grid = buildInteriorGrid(room());
    const blocked = new Set(room().blocked_cells.map(([r, c]) => `${c},${r}`));
    for (let r = 0; r < grid.height; r++) {
      for (let c = 0; c < grid.width; c++) {
        if (blocked.has(`${c},${r}`)) continue;
        expect({ c, r, passable: grid.isPassable(c, r) }).toEqual({ c, r, passable: true });
      }
    }
  });

  test("leaves the doorway open — it is the one gap in the wall", () => {
    const grid = buildInteriorGrid(room());
    const door = interiorDoor(room());
    expect(grid.isPassable(door.col, door.row)).toBe(true);
  });

  test("treats outside the room as impassable, which is what makes leaving detectable", () => {
    const grid = buildInteriorGrid(room());
    const door = interiorDoor(room());
    expect(grid.inBounds(door.col, door.row + 1)).toBe(false);
  });
});

describe("interiorDoor", () => {
  test("reads the sidecar's [row, col] into (col, row)", () => {
    expect(interiorDoor(room({ door_cell: [2, 1] }))).toEqual({ col: 1, row: 2 });
  });

  test("sits on the room's last row, so stepping off it leaves", () => {
    const spec = room();
    expect(interiorDoor(spec).row).toBe(spec.size_cells.rows - 1);
  });
});

describe("interiorOriginY", () => {
  test("is the wall rise — cell (0,0) starts below the north wall", () => {
    // Get this wrong and every position indoors is off by the wall's height,
    // which reads as the player standing inside the furniture.
    expect(interiorOriginY(room())).toBe(18);
  });
});

describe("interiorFor", () => {
  test("gives every building sprite a room", () => {
    for (const sprite of BUILDING_SPRITES) {
      expect(INTERIOR_ROOMS).toContain(interiorFor(sprite));
    }
  });

  test("covers every role the village places", () => {
    for (const sprite of Object.values(ROLE_SPRITES)) {
      expect(INTERIOR_ROOMS).toContain(interiorFor(sprite));
    }
  });
});
