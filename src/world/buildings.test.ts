// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import {
  BUILDING_FOOTPRINTS,
  BUILDING_SPRITES,
  DOOR_STATES,
  DoorState,
  ENTRANCE_REACH,
  ROLE_SPRITES,
  buildingAnimKey,
  doorStateForDistance,
  entranceFor,
  footprintFor,
  isEntrance,
} from "./buildings";

describe("doorStateForDistance", () => {
  test("is open when the player is close enough to step through it", () => {
    // The doorstep is one tile from the door, so this is exactly the range at
    // which entering becomes possible — the door must not still be shut.
    expect(doorStateForDistance(0)).toBe(DoorState.Open);
    expect(doorStateForDistance(1)).toBe(DoorState.Open);
  });

  test("is part-way at two tiles and shut beyond that", () => {
    expect(doorStateForDistance(2)).toBe(DoorState.Half);
    expect(doorStateForDistance(3)).toBe(DoorState.Closed);
    expect(doorStateForDistance(50)).toBe(DoorState.Closed);
  });

  test("never skips the middle position on the way out", () => {
    // Walking away has to pass through half, or the door snaps shut.
    const walk = [0, 1, 2, 3].map(doorStateForDistance);
    expect(walk).toEqual([DoorState.Open, DoorState.Open, DoorState.Half, DoorState.Closed]);
  });

  test("opens monotonically as the player approaches", () => {
    const rank: Record<DoorState, number> = {
      [DoorState.Closed]: 0,
      [DoorState.Half]: 1,
      [DoorState.Open]: 2,
    };
    const byDistance = [6, 5, 4, 3, 2, 1, 0].map((d) => rank[doorStateForDistance(d)]);
    expect(byDistance).toEqual([...byDistance].sort((a, b) => a - b));
  });
});

describe("buildingAnimKey", () => {
  test("names a distinct animation per sprite and door state", () => {
    const keys = new Set(
      BUILDING_SPRITES.flatMap((sprite) => DOOR_STATES.map((s) => buildingAnimKey(sprite, s))),
    );
    expect(keys.size).toBe(BUILDING_SPRITES.length * DOOR_STATES.length);
  });

  test("matches the sidecar's own animation naming", () => {
    // The generator writes `door_closed`; drift here means the animation is
    // built from a range that does not exist.
    expect(buildingAnimKey("cottage", DoorState.Closed)).toContain("door_closed");
  });
});

describe("footprints", () => {
  test("every role resolves to a sprite with a known footprint", () => {
    for (const role of Object.keys(ROLE_SPRITES) as (keyof typeof ROLE_SPRITES)[]) {
      expect(footprintFor(role)).toEqual(BUILDING_FOOTPRINTS[ROLE_SPRITES[role]]);
    }
  });
});

describe("the doorway", () => {
  // A 4-wide building at column 10, door in the middle of its front row.
  const door = { col: 12, row: 7 };
  const wide = entranceFor(door, 10, 4);

  test("a step onto the door goes in, as it always did", () => {
    expect(isEntrance(wide, door.col, door.row)).toBe(true);
  });

  // The point of the whole thing: the player walks along the front of a
  // building and should not have to stop on exactly one tile to get in.
  test("so does a step onto the wall to either side of it", () => {
    expect(isEntrance(wide, door.col - 1, door.row)).toBe(true);
    expect(isEntrance(wide, door.col + 1, door.row)).toBe(true);
  });

  test("two along is still a wall", () => {
    expect(isEntrance(wide, door.col - 2, door.row)).toBe(false);
    expect(isEntrance(wide, door.col + 2, door.row)).toBe(false);
  });

  // Otherwise walking past the corner of a building, on grass, would put the
  // player indoors — which is worse than the fiddliness this fixes.
  test("the ground beside a corner door is still the ground", () => {
    const corner = entranceFor({ col: 10, row: 7 }, 10, 3);
    expect(isEntrance(corner, 9, 7)).toBe(false);
    expect(isEntrance(corner, 11, 7)).toBe(true);
    const farCorner = entranceFor({ col: 12, row: 7 }, 10, 3);
    expect(isEntrance(farCorner, 13, 7)).toBe(false);
    expect(isEntrance(farCorner, 11, 7)).toBe(true);
  });

  // The doorway widens sideways, not upward: the row above is the building's
  // own upper row, and a step into that is a step through the roof.
  test("only the door's own row lets anyone in", () => {
    expect(isEntrance(wide, door.col, door.row - 1)).toBe(false);
    expect(isEntrance(wide, door.col, door.row + 1)).toBe(false);
  });

  test("it never reaches outside the building it belongs to", () => {
    for (const footprint of Object.values(BUILDING_FOOTPRINTS)) {
      for (let doorCol = 0; doorCol < footprint.width; doorCol++) {
        const entrance = entranceFor({ col: 40 + doorCol, row: 9 }, 40, footprint.width);
        expect(entrance.minCol).toBeGreaterThanOrEqual(40);
        expect(entrance.maxCol).toBeLessThan(40 + footprint.width);
        // And it always includes the door itself, whatever the shape.
        expect(isEntrance(entrance, 40 + doorCol, 9)).toBe(true);
        expect(entrance.maxCol - entrance.minCol).toBeLessThanOrEqual(ENTRANCE_REACH * 2);
      }
    }
  });
});
