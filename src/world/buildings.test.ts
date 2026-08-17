// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import {
  BUILDING_FOOTPRINTS,
  BUILDING_SPRITES,
  DOOR_STATES,
  DoorState,
  ROLE_SPRITES,
  buildingAnimKey,
  doorStateForDistance,
  footprintFor,
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
