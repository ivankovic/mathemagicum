// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { type AreaPlacement, placeAnchors } from "./anchors";
import { HighCorner, bandFloor, elevationAt } from "./elevation";
import { createRng } from "./rng";
import { TerrainType } from "./terrain";

const SIZE = 500;

function place(seed: number, corner: HighCorner = HighCorner.NorthWest) {
  const elevation = (col: number, row: number) =>
    elevationAt(col, row, SIZE, SIZE, corner, seed * 31 + 7);
  return { anchors: placeAnchors(SIZE, SIZE, elevation, createRng(seed)), elevation };
}

function all(anchors: ReturnType<typeof place>["anchors"]): AreaPlacement[] {
  return [
    anchors.village,
    anchors.harbour,
    anchors.bigCity,
    anchors.observatory,
    anchors.enchantedForest,
  ];
}

function overlap(a: AreaPlacement, b: AreaPlacement): boolean {
  return !(
    a.col + a.width <= b.col ||
    b.col + b.width <= a.col ||
    a.row + a.height <= b.row ||
    b.row + b.height <= a.row
  );
}

function centreHeight(box: AreaPlacement, elevation: (c: number, r: number) => number): number {
  return elevation(box.col + Math.floor(box.width / 2), box.row + Math.floor(box.height / 2));
}

describe("placeAnchors", () => {
  test("puts every area fully inside the world", () => {
    for (let seed = 1; seed <= 8; seed++) {
      for (const box of all(place(seed).anchors)) {
        expect(box.col).toBeGreaterThanOrEqual(0);
        expect(box.row).toBeGreaterThanOrEqual(0);
        expect(box.col + box.width).toBeLessThanOrEqual(SIZE);
        expect(box.row + box.height).toBeLessThanOrEqual(SIZE);
      }
    }
  });

  test("never overlaps two areas", () => {
    for (let seed = 1; seed <= 8; seed++) {
      const boxes = all(place(seed).anchors);
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          expect({
            i,
            j,
            hit: overlap(boxes[i] as AreaPlacement, boxes[j] as AreaPlacement),
          }).toEqual({ i, j, hit: false });
        }
      }
    }
  });

  test("centres the village, whatever the seed", () => {
    for (let seed = 1; seed <= 5; seed++) {
      const { village } = place(seed).anchors;
      expect(village.col + Math.floor(village.width / 2)).toBe(Math.floor(SIZE / 2));
    }
  });

  test("puts the observatory up in the rock", () => {
    // The one placement the design names explicitly: an observatory belongs
    // on the mountain, and the mountain is always the high corner.
    for (let seed = 1; seed <= 8; seed++) {
      const { anchors, elevation } = place(seed);
      expect(centreHeight(anchors.observatory, elevation)).toBeGreaterThan(
        bandFloor(TerrainType.Hilly),
      );
    }
  });

  test("puts the harbour lower than the forest, and the forest lower than the observatory", () => {
    // Each area asks for its own band, so their heights have to come out in
    // this order — that ordering is what makes the world legible.
    for (let seed = 1; seed <= 8; seed++) {
      const { anchors, elevation } = place(seed);
      const harbour = centreHeight(anchors.harbour, elevation);
      const forest = centreHeight(anchors.enchantedForest, elevation);
      const observatory = centreHeight(anchors.observatory, elevation);
      expect(harbour).toBeLessThan(forest);
      expect(forest).toBeLessThan(observatory);
    }
  });

  test("puts the harbour down by the water", () => {
    for (let seed = 1; seed <= 8; seed++) {
      const { anchors, elevation } = place(seed);
      expect(centreHeight(anchors.harbour, elevation)).toBeLessThan(bandFloor(TerrainType.Grass));
    }
  });

  test("keeps the big city within reach of the harbour", () => {
    for (let seed = 1; seed <= 8; seed++) {
      const { harbour, bigCity } = place(seed).anchors;
      const distance = Math.hypot(harbour.col - bigCity.col, harbour.row - bigCity.row);
      expect(distance).toBeLessThan(120);
    }
  });

  test("is deterministic for a seed", () => {
    expect(place(4242).anchors).toEqual(place(4242).anchors);
  });

  test("follows the high corner around the map", () => {
    // The observatory tracks the mountain, so choosing a different corner
    // has to move it — otherwise the corner is decorative.
    const centres = new Set(
      Object.values(HighCorner).map((corner) => {
        const { observatory } = place(9, corner).anchors;
        return `${observatory.col},${observatory.row}`;
      }),
    );
    expect(centres.size).toBe(4);
  });
});
