// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { MAX_PROFILES } from "../save/profiles";
import {
  FOOTER,
  HEADER,
  MAKING_STEPS,
  TILE_GAP,
  TILE_MAX,
  TILE_MIN,
  boxTopWithin,
  stepFrom,
  tileGrid,
} from "./playersLayout";

// The screens this is actually played on: a phone upright, a phone on its
// side, a small tablet, a laptop.
const SCREENS: readonly (readonly [string, number, number])[] = [
  ["phone upright", 360, 640],
  ["phone sideways", 640, 360],
  ["small tablet", 768, 1024],
  ["laptop", 1280, 800],
  ["very narrow", 280, 560],
];

describe("fitting the faces on the screen", () => {
  // The whole point of the screen. A face a child cannot hit, or one below
  // the fold, is a child who cannot get into their own game.
  test("every face is on screen and big enough to hit, everywhere", () => {
    for (const [name, width, height] of SCREENS) {
      for (let count = 1; count <= MAX_PROFILES + 1; count++) {
        const grid = tileGrid(width, height, count);
        expect({ name, count, tile: grid.tile >= TILE_MIN }).toEqual({
          name,
          count,
          tile: true,
        });
        for (let index = 0; index < count; index++) {
          const at = grid.at(index);
          expect({ name, count, index, ok: at.x >= 0 && at.x + grid.tile <= width }).toEqual({
            name,
            count,
            index,
            ok: true,
          });
          expect({ name, count, index, ok: at.y >= HEADER && at.y + grid.tile <= height }).toEqual({
            name,
            count,
            index,
            ok: true,
          });
        }
      }
    }
  });

  test("nothing overlaps anything else", () => {
    for (const [, width, height] of SCREENS) {
      const grid = tileGrid(width, height, MAX_PROFILES);
      const seen: { x: number; y: number }[] = [];
      for (let index = 0; index < MAX_PROFILES; index++) {
        const at = grid.at(index);
        for (const other of seen) {
          const apart =
            Math.abs(at.x - other.x) >= grid.tile || Math.abs(at.y - other.y) >= grid.tile;
          expect(apart).toBe(true);
        }
        seen.push(at);
      }
    }
  });

  test("the room under the faces is kept for the remove button", () => {
    const grid = tileGrid(360, 640, MAX_PROFILES);
    const last = grid.at(MAX_PROFILES - 1);
    expect(last.y + grid.tile).toBeLessThanOrEqual(640 - FOOTER + grid.tile);
  });

  // One child on a tablet should not get a single enormous face.
  test("a lone player gets a tile, not the whole screen", () => {
    expect(tileGrid(1280, 800, 1).tile).toBeLessThanOrEqual(TILE_MAX);
  });

  test("a narrow screen goes taller rather than making faces too small", () => {
    const narrow = tileGrid(280, 560, 4);
    const wide = tileGrid(1280, 800, 4);
    expect(narrow.columns).toBeLessThan(wide.columns);
    expect(narrow.rows).toBeGreaterThan(wide.rows);
    expect(narrow.tile).toBeGreaterThanOrEqual(TILE_MIN);
  });

  test("the faces are centred rather than left-heavy", () => {
    const grid = tileGrid(1280, 800, 3);
    const first = grid.at(0);
    const last = grid.at(2);
    expect(Math.round(first.x)).toBe(Math.round(1280 - (last.x + grid.tile)));
  });

  test("no players at all is still a usable layout", () => {
    const grid = tileGrid(360, 640, 0);
    expect(grid.tile).toBeGreaterThanOrEqual(TILE_MIN);
    expect(grid.columns).toBeGreaterThan(0);
    expect(TILE_GAP).toBeGreaterThan(0);
  });
});

describe("the steps that make a player", () => {
  /**
   * Language, then the grown-up's three panels, then the child's two.
   *
   * Written out rather than counted, because the *order* is the design: the
   * flags have to come before anything with words on it, and the notices
   * for a parent have to come before the tablet is handed over.
   */
  test("go language, then the parent's notices, then who and sums", () => {
    expect(MAKING_STEPS).toEqual(["tongue", "parents", "offline", "backup", "who", "sums"]);
  });

  test("next walks forward and back walks back", () => {
    expect(stepFrom("tongue", 1)).toBe("parents");
    expect(stepFrom("parents", 1)).toBe("offline");
    expect(stepFrom("offline", 1)).toBe("backup");
    expect(stepFrom("backup", 1)).toBe("who");
    expect(stepFrom("who", 1)).toBe("sums");
    expect(stepFrom("sums", -1)).toBe("who");
    expect(stepFrom("who", -1)).toBe("backup");
    expect(stepFrom("parents", -1)).toBe("tongue");
  });

  // Both ends are the caller's to act on: forward off the last is finishing,
  // and back off the first is leaving without making anybody.
  test("and walking off either end says so rather than wrapping", () => {
    expect(stepFrom("sums", 1)).toBeNull();
    expect(stepFrom("tongue", -1)).toBeNull();
  });
});

describe("keeping the name box on screen", () => {
  const BOX = 34;

  /**
   * With no keyboard up the band is the whole page, and nothing moves.
   *
   * The check that matters most: every desktop and every tablet before the
   * first tap goes through this, so a fix for iOS that nudged the box on
   * every other device would be a worse bug than the one it fixed.
   */
  test("a full-page band gives back the y that was asked for", () => {
    expect(boxTopWithin({ offsetTop: 0, height: 900 }, 120, BOX)).toBe(120);
  });

  /**
   * A keyboard takes about half a tablet. The box was asked for at 120 and
   * the band is 360 tall, so it still fits and still does not move — this is
   * the case the old fix solved by moving the box up the page.
   */
  test("and a shorter one leaves a box that still fits where it is", () => {
    expect(boxTopWithin({ offsetTop: 0, height: 360 }, 120, BOX)).toBe(120);
  });

  // The failure itself: iOS scrolls the visual viewport to reveal the input,
  // and a fixed box goes with the page. Following the offset is what puts it
  // back on screen.
  test("a band scrolled down the page carries the box with it", () => {
    expect(boxTopWithin({ offsetTop: 200, height: 360 }, 120, BOX)).toBe(320);
  });

  test("a box the keyboard would cover is lifted above it", () => {
    // Asked for 300, but only 200 of the page is visible: it goes as low as
    // it can and no lower.
    expect(boxTopWithin({ offsetTop: 0, height: 200 }, 300, BOX)).toBe(200 - BOX - 8);
  });

  test("and one asked for above the band is brought down into it", () => {
    expect(boxTopWithin({ offsetTop: 240, height: 300 }, 0, BOX)).toBe(248);
  });

  // A band with no room in it at all — a landscape phone with a keyboard up
  // is very nearly this. Pinned to the top, so the first line of what is
  // being typed is readable; held to the bottom it would be under the keys.
  test("a band shorter than the box pins it to the top", () => {
    expect(boxTopWithin({ offsetTop: 100, height: 20 }, 300, BOX)).toBe(108);
  });
});
