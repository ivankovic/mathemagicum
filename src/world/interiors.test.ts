// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BUILDING_SPRITES, ROLE_SPRITES } from "./buildings";
import {
  INTERIOR_ROOMS,
  buildInteriorGrid,
  hearthCell,
  interiorAttendantCell,
  interiorDoor,
  interiorFor,
  interiorOriginY,
  roomCameraBounds,
  wallHangingCell,
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

describe("where someone who works in a room stands", () => {
  test("at the back of the room, not beside the door", () => {
    // A shopkeeper standing at the door the player just came through reads as
    // someone on their way out rather than as someone serving.
    // An empty room, so this is about the rule and not about where the
    // helper's default furniture happens to sit.
    const cell = interiorAttendantCell(
      room({ size_cells: { cols: 5, rows: 4 }, door_cell: [3, 2], blocked_cells: [] }),
    );
    expect(cell?.row).toBe(0);
  });

  test("as near the middle as it can, once it has picked a row", () => {
    const cell = interiorAttendantCell(
      room({ size_cells: { cols: 5, rows: 4 }, door_cell: [3, 0], blocked_cells: [] }),
    );
    expect(cell).toEqual({ col: 2, row: 0 });
  });

  // Chosen from the room's own walkability rather than written down per room,
  // so rearranging the furniture moves them instead of leaving them inside a
  // cupboard.
  test("never on a blocked cell", () => {
    const blocked = room({
      size_cells: { cols: 3, rows: 3 },
      door_cell: [2, 1],
      blocked_cells: [
        [0, 0],
        [0, 1],
        [0, 2],
      ],
    });
    const cell = interiorAttendantCell(blocked);
    expect(cell?.row).not.toBe(0);
    expect(buildInteriorGrid(blocked).isPassable(cell?.col ?? -1, cell?.row ?? -1)).toBe(true);
  });

  test("nowhere to stand is nowhere, not a guess", () => {
    const full = room({
      size_cells: { cols: 2, rows: 1 },
      door_cell: [0, 0],
      blocked_cells: [
        [0, 0],
        [0, 1],
      ],
    });
    expect(interiorAttendantCell(full)).toBe(null);
  });

  test("the same room always puts them in the same place", () => {
    const spec = room();
    expect(interiorAttendantCell(spec)).toEqual(interiorAttendantCell(spec));
  });
});

describe("where a map hangs", () => {
  const room = (cols: number, furniture: { cell: [number, number] }[]) =>
    ({
      room: "test",
      size_cells: { cols, rows: 4 },
      tile_size: 32,
      wall_rise_px: 18,
      door_cell: [3, 1],
      blocked_cells: [],
      furniture: furniture.map((piece) => ({ name: "thing", blocks: true, ...piece })),
    }) as unknown as InteriorSidecar;

  test("on the back wall, near the middle", () => {
    // An even-width room has no middle cell, so either side of the centre
    // line will do; an odd one has exactly one.
    const even = wallHangingCell(room(6, []));
    expect(even.row).toBe(0);
    expect([2, 3]).toContain(even.col);
    expect(wallHangingCell(room(5, []))).toEqual({ col: 2, row: 0 });
  });

  // Furniture against the wall is the thing this has to dodge: a map hung on
  // top of a bookshelf is a map nobody can see, and rooms are drawn by the
  // generator rather than by hand here.
  test("steps aside for anything already against it", () => {
    const crowded = room(6, [{ cell: [0, 3] }, { cell: [0, 2] }]);
    const at = wallHangingCell(crowded);
    expect(at.row).toBe(0);
    expect([at.col]).not.toContain(3);
    expect([at.col]).not.toContain(2);
  });

  test("stays inside the room even with a wall full of furniture", () => {
    const packed = room(
      4,
      [0, 1, 2, 3].map((col) => ({ cell: [0, col] as [number, number] })),
    );
    const at = wallHangingCell(packed);
    expect(at.col).toBeGreaterThanOrEqual(0);
    expect(at.col).toBeLessThan(4);
  });
});

function readJson<T>(room: string): T {
  return JSON.parse(
    readFileSync(
      join(import.meta.dir, "..", "..", "public", "assets", "interiors", `${room}.json`),
      "utf8",
    ),
  ) as T;
}

describe("the shipped rooms have somewhere to hang a map", () => {
  // The one that matters today is the tower, whose map is a thing the player
  // taps — but any room may grow one, and the rule has to hold for all of
  // them or it is a coordinate wearing a function's clothes.
  test("the cell is on the back wall, clear of furniture and windows", () => {
    for (const room of INTERIOR_ROOMS) {
      const sidecar = readJson<InteriorSidecar>(room);
      const at = wallHangingCell(sidecar);
      expect({ room, row: at.row }).toEqual({ room, row: 0 });
      expect(at.col).toBeGreaterThanOrEqual(0);
      expect(at.col).toBeLessThan(sidecar.size_cells.cols);
      const onFurniture = (sidecar.furniture ?? []).some(
        (piece) => piece.cell[0] === 0 && piece.cell[1] === at.col,
      );
      expect({ room, onFurniture }).toEqual({ room, onFurniture: false });
      const onWindow = (sidecar.window_columns ?? []).includes(at.col);
      expect({ room, onWindow }).toEqual({ room, onWindow: false });
    }
  });
});

describe("framing a room", () => {
  // The tower is the case that showed this: it grew wide enough to need
  // scrolling on a phone while staying shorter than the screen, and an
  // all-or-nothing rule pinned it to the top with a band of black under it.
  test("a room bigger than the view on one axis still centres on the other", () => {
    const bounds = roomCameraBounds({ width: 288, height: 242 }, { width: 195, height: 390 });
    expect(bounds.width).toBe(288);
    expect(bounds.height).toBe(390);
    // The band is centred on the room, so the camera cannot move vertically.
    expect(bounds.y).toBe((242 - 390) / 2);
    expect(bounds.x).toBe(0);
  });

  test("a room that fits entirely is centred on both axes", () => {
    const bounds = roomCameraBounds({ width: 192, height: 178 }, { width: 400, height: 300 });
    expect(bounds.width).toBe(400);
    expect(bounds.height).toBe(300);
    expect(bounds.x).toBe((192 - 400) / 2);
    expect(bounds.y).toBe((178 - 300) / 2);
  });

  test("a room bigger than the view on both axes is the room itself", () => {
    expect(roomCameraBounds({ width: 800, height: 600 }, { width: 400, height: 300 })).toEqual({
      x: 0,
      y: 0,
      width: 800,
      height: 600,
    });
  });

  // The centred band always holds the room, whatever the sizes: a band that
  // did not would let the camera sit somewhere the room is not.
  test("the bounds always contain the room", () => {
    for (const room of [40, 195, 288, 900]) {
      for (const view of [195, 390, 800]) {
        const bounds = roomCameraBounds(
          { width: room, height: room },
          { width: view, height: view },
        );
        const at = { room, view };
        expect({ ...at, holds: bounds.x <= 0 && bounds.x + bounds.width >= room }).toEqual({
          ...at,
          holds: true,
        });
      }
    }
  });
});

describe("the fire in a room that has one", () => {
  /**
   * The two lists that have to agree, checked from both ends.
   *
   * A fireplace is a piece of furniture in the sidecar and a fire is extra
   * frames in the sheet, and they are written by different parts of the
   * generator. A room with a fireplace and one frame is a fire that does not
   * burn; a room with eight frames and no fireplace is a room with something
   * moving in it that the game cannot find to light. Neither shows up as an
   * error anywhere — the wood and stone icons were exactly this shape of
   * bug, shipped and never loaded.
   */
  test("is in the sheet if and only if it is in the furniture", () => {
    const withFire: string[] = [];
    const animated: string[] = [];
    for (const name of INTERIOR_ROOMS) {
      const sidecar = readJson<InteriorSidecar>(name);
      if (hearthCell(sidecar)) withFire.push(name);
      if ((sidecar.sheet?.frame_count ?? 1) > 1) animated.push(name);
    }
    expect(withFire.sort()).toEqual(animated.sort());
    // And there is at least one, or this test passes by having nothing to say.
    expect(withFire.length).toBeGreaterThan(0);
  });

  // The places people live, and nowhere else. A barn does not need a hearth
  // and the observatory would be a fire hazard under a telescope.
  test("burns in the cottage and the townhouse", () => {
    expect(hearthCell(readJson<InteriorSidecar>("cottage"))).not.toBeNull();
    expect(hearthCell(readJson<InteriorSidecar>("townhouse"))).not.toBeNull();
    expect(hearthCell(readJson<InteriorSidecar>("barn"))).toBeNull();
    expect(hearthCell(readJson<InteriorSidecar>("schoolhouse"))).toBeNull();
  });

  /**
   * `[row, col]`, which is the sidecar's order everywhere and the wrong way
   * round from every function that takes one. Read off the blocked cells,
   * which cover the same two squares from the other side: the cottage blocks
   * row 1 at columns 0, 1 and 2, and the fireplace is the middle pair of
   * those. A hearth read as `[col, row]` would land on the doorway wall.
   */
  test("is read out of the sidecar the way the sidecar writes it", () => {
    const sidecar = readJson<InteriorSidecar>("cottage");
    const at = hearthCell(sidecar);
    if (!at) throw new Error("the cottage lost its fireplace");
    const blocked = sidecar.blocked_cells.some(([row, col]) => row === at.row && col === at.col);
    expect({ ...at, blocked }).toEqual({ ...at, blocked: true });
    // Not on the north wall itself, which is where a swapped pair would put it.
    expect(at.row).toBeGreaterThan(0);
  });

  test("every room the village can place is asked, and none of them throws", () => {
    for (const name of INTERIOR_ROOMS) {
      expect(() => hearthCell(readJson<InteriorSidecar>(name))).not.toThrow();
    }
  });
});
