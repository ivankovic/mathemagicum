// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import type { AreaPlacement } from "./anchors";
import {
  DUSK_FADE_TILES,
  GROVE_CROP,
  GroveTask,
  duskOver,
  groveProgress,
  growGrove,
} from "./enchantedForest";
import { FixtureType } from "./fixtures";
import { WorldGrid } from "./grid";
import { LandmarkType } from "./landmarks";
import { PlantStage, PlantType } from "./plants";
import { createRng } from "./rng";
import { patchCells } from "./selection";
import { TerrainType } from "./terrain";

const BOX: AreaPlacement = { id: "enchanted-forest", col: 40, row: 40, width: 24, height: 24 };

function grown() {
  const grid = WorldGrid.empty(120, 120, TerrainType.Grass);
  return { grid, grove: growGrove(grid, BOX, createRng(5)) };
}

describe("the grove", () => {
  test("stands the great tree at the heart of the box", () => {
    const { grid, grove } = grown();
    const middle = { col: BOX.col + BOX.width / 2, row: BOX.row + BOX.height / 2 };
    expect(Math.abs(grove.tree.col + 1 - middle.col)).toBeLessThanOrEqual(1);
    expect(Math.abs(grove.tree.row + 1 - middle.row)).toBeLessThanOrEqual(1);
    expect(grid.getObjectAt(grove.tree.col + 1, grove.tree.row + 1)?.type).toBe(
      LandmarkType.GreatTree,
    );
  });

  // The one thing a visitor has to be able to do. It is also the cell the
  // world's connectivity carve aims at — see worldGenerator — so a doorstep
  // that were blocked would be carved open by deleting the tree.
  test("leaves a doorstep clear, below the tree", () => {
    const { grid, grove } = grown();
    expect(grid.isPassable(grove.doorstep.col, grove.doorstep.row)).toBe(true);
    expect(grove.doorstep.row).toBeGreaterThan(grove.tree.row);
  });

  test("puts lights in it, and they are not scenery", () => {
    const { grove } = grown();
    const lights = grove.placed.filter((object) => object.type === FixtureType.Glowcap);
    expect(lights.length).toBeGreaterThan(8);
  });

  // A wood you can see straight through is a field with trees in it. The
  // scatter thickens outward, so the ring nearest the box edge has to be
  // denser than the ring nearest the tree.
  test("thickens outward from the clearing", () => {
    const { grove } = grown();
    const middle = { col: BOX.col + BOX.width / 2, row: BOX.row + BOX.height / 2 };
    const ring = (from: number, to: number) =>
      grove.placed.filter((object) => {
        const out = Math.max(Math.abs(object.col - middle.col), Math.abs(object.row - middle.row));
        return out >= from && out < to;
      }).length;
    const cells = (from: number, to: number) => (2 * to - 1) ** 2 - (2 * from - 1) ** 2;
    const near = ring(6, 8) / cells(6, 8);
    const far = ring(10, 12) / cells(10, 12);
    expect({ denser: far > near }).toEqual({ denser: true });
  });

  test("never stacks two things on one cell", () => {
    const { grove } = grown();
    const seen = new Set<string>();
    for (const object of grove.placed) {
      for (let row = object.row; row < object.row + object.height; row++) {
        for (let col = object.col; col < object.col + object.width; col++) {
          const key = `${col},${row}`;
          expect({ key, twice: seen.has(key) }).toEqual({ key, twice: false });
          seen.add(key);
        }
      }
    }
  });

  test("the same seed grows the same grove", () => {
    const a = grown();
    const b = grown();
    expect(a.grove.placed).toEqual(b.grove.placed);
  });
});

describe("what the great tree asks for", () => {
  /**
   * The whole design of it: the task keeps no state of its own. Every answer
   * is read off the world — cleared scenery and planted crops are exactly
   * what a save already records — so it survives a reload without a field
   * and cannot drift out of step with the ground it is about.
   */
  test("starts overgrown, and says how much wood is still standing", () => {
    const { grid, grove } = grown();
    const progress = groveProgress(grid, grove);
    expect(progress.task).toBe(GroveTask.Overgrown);
    expect(progress.standing).toBe(grove.thicket.length);
    expect(progress.standing).toBeGreaterThan(0);
  });

  // Marked so the world's own route-carving cannot do the player's first
  // task for them. It is the one pass that removes whatever is in its way.
  test("the thicket is not something the world may clear for you", () => {
    const { grid, grove } = grown();
    for (const at of grove.thicket) {
      const standing = grid.getObjectAt(at.col, at.row);
      expect({ at: `${at.col},${at.row}`, unbreakable: standing?.unbreakable }).toEqual({
        at: `${at.col},${at.row}`,
        unbreakable: true,
      });
    }
  });

  test("is bare ground once the wood is gone, and asks for the bed", () => {
    const { grid, grove } = grown();
    for (const at of grove.thicket) grid.removeObjectAt(at.col, at.row);
    const progress = groveProgress(grid, grove);
    expect(progress.task).toBe(GroveTask.Bare);
    // Four beds of two by two. Two by two is the array spell's own smallest
    // shape, and four of them is the shape of the spell being bargained for.
    expect({ ripe: progress.ripe, squares: progress.squares }).toEqual({ ripe: 0, squares: 16 });
    expect(grove.beds.length).toBe(4);
    for (const bed of grove.beds) expect({ w: bed.width, h: bed.height }).toEqual({ w: 2, h: 2 });
  });

  // Sixteen squares of *ripe*, not sixteen of planted. Doing it the long way
  // is the point: it is the number lines the spell will later skip, done
  // once by hand.
  test("counts ripe squares, not planted ones, and is done at the last of them", () => {
    const { grid, grove } = grown();
    for (const at of grove.thicket) grid.removeObjectAt(at.col, at.row);
    const cells = grove.beds.flatMap((bed) => patchCells(bed));
    for (const at of cells) grid.plant(at.col, at.row, GROVE_CROP);
    expect(groveProgress(grid, grove).task).toBe(GroveTask.Growing);
    expect(groveProgress(grid, grove).ripe).toBe(0);

    for (const [n, at] of cells.entries()) {
      while (grid.getCrop(at.col, at.row)?.stage !== PlantStage.Mature) {
        if (!grid.growCrop(at.col, at.row)) break;
      }
      const progress = groveProgress(grid, grove);
      expect({ n, ripe: progress.ripe }).toEqual({ n, ripe: n + 1 });
      expect({ n, done: progress.task === GroveTask.Done }).toEqual({
        n,
        done: n === cells.length - 1,
      });
    }
  });

  /**
   * It asks for sunflowers, and only sunflowers.
   *
   * A tree that would take anything ripe is a tree whose bed gets filled by
   * accident on the way past — and the errand is the whole reason the spell
   * is worth having.
   */
  test("a bed full of the wrong crop is not a bed full", () => {
    const { grid, grove } = grown();
    for (const at of grove.thicket) grid.removeObjectAt(at.col, at.row);
    const cells = grove.beds.flatMap((bed) => patchCells(bed));
    for (const at of cells) {
      grid.plant(at.col, at.row, PlantType.Carrot);
      while (grid.growCrop(at.col, at.row)) {
        if (grid.getCrop(at.col, at.row)?.stage === PlantStage.Mature) break;
      }
    }
    const progress = groveProgress(grid, grove);
    expect(progress.ripe).toBe(0);
    expect(progress.task).toBe(GroveTask.Growing);
  });

  test("the beds are grass with a trellis round them, not a hole in the clearing", () => {
    const { grid, grove } = grown();
    for (const at of grove.beds.flatMap((bed) => patchCells(bed))) {
      // Grass, because bare earth in a clearing read as a hole in it.
      expect(grid.getTerrain(at.col, at.row)).toBe(TerrainType.Grass);
      // Under the thicket for now, but the ground itself will take a crop.
      expect(grid.canPlant(at.col, at.row, GROVE_CROP)).toBe(true);
    }
    expect(grove.trellis.length).toBeGreaterThan(0);
    // Any of the four pieces: the creeper is directional, so a border is
    // runs and corners rather than one tile repeated.
    const vines: readonly string[] = [
      FixtureType.ForestVine,
      FixtureType.ForestVineSide,
      FixtureType.ForestVineCorner,
      FixtureType.ForestVineCornerUp,
    ];
    for (const at of grove.trellis) {
      const vine = grid.getObjectAt(at.col, at.row);
      expect({ at: `${at.col},${at.row}`, vine: vines.includes(vine?.type ?? "") }).toEqual({
        at: `${at.col},${at.row}`,
        vine: true,
      });
      // Walked over, not round: a border you cannot cross is a wall, and the
      // beds inside it have to be reachable.
      expect(grid.isPassable(at.col, at.row)).toBe(true);
    }
  });

  /**
   * One at each corner, with the tree in the middle of them.
   *
   * A single block of four beds was the first attempt and it sat down and to
   * the left of the trunk, which reads as a plot somebody put beside the
   * tree rather than as the tree's own.
   */
  test("there is a bed at each corner around the tree", () => {
    const { grove } = grown();
    const middle = { col: grove.tree.col + 1, row: grove.tree.row + 1 };
    const corners = new Set(
      grove.beds.map(
        (bed) => `${Math.sign(bed.col - middle.col)},${Math.sign(bed.row - middle.row)}`,
      ),
    );
    expect(corners).toEqual(new Set(["-1,-1", "1,-1", "-1,1", "1,1"]));
  });

  // The ring of lights stands between the trunk and the beds, and the way in
  // is below the trunk. A block that reached either would have `pull` take
  // it away to make room, which is a light or a doorstep quietly deleted.
  test("no bed stands on the ring of lights or on the way in", () => {
    const { grid, grove } = grown();
    const cells = new Set(
      [...grove.beds.flatMap((bed) => patchCells(bed)), ...grove.trellis].map(
        (at) => `${at.col},${at.row}`,
      ),
    );
    expect(cells.has(`${grove.doorstep.col},${grove.doorstep.row}`)).toBe(false);
    const lights = grid
      .listObjects()
      .filter((object) => object.type === FixtureType.Glowcap).length;
    // Eight round the trunk plus the ones scattered through the wood; the
    // number is not the point, that none of the eight was eaten is.
    expect(lights).toBeGreaterThanOrEqual(8);
  });

  /**
   * The picture the tree holds up has to be a picture of *this* bed.
   *
   * It was not: the panel spread the wood across the squares by an
   * arithmetic stride, so the thickets on the parchment stood nowhere near
   * the thickets on the ground. A child holding the two side by side could
   * not use one to find the other, which is the only thing it is for.
   */
  test("says which squares the wood is on, not only how many", () => {
    const { grid, grove } = grown();
    const cells = grove.beds.flatMap((bed) => patchCells(bed));
    const progress = groveProgress(grid, grove);
    expect(progress.standingAt.length).toBe(progress.standing);
    for (const index of progress.standingAt) {
      const at = cells[index];
      if (!at) throw new Error(`index ${index} is off the end of the beds`);
      expect(grid.getObjectAt(at.col, at.row)).not.toBeNull();
    }
    // And it shrinks as the wood comes away, cell by cell.
    const [first] = grove.thicket;
    if (!first) throw new Error("no thicket");
    grid.removeObjectAt(first.col, first.row);
    const after = groveProgress(grid, grove);
    expect(after.standingAt.length).toBe(progress.standing - 1);
    const gone = cells.findIndex((at) => at.col === first.col && at.row === first.row);
    expect(after.standingAt).not.toContain(gone);
  });

  test("and which squares are ripe, not only how many", () => {
    const { grid, grove } = grown();
    for (const at of grove.thicket) grid.removeObjectAt(at.col, at.row);
    const cells = grove.beds.flatMap((bed) => patchCells(bed));
    // The last square of the last bed, which a count alone would draw as the
    // first square of the first.
    const last = cells[cells.length - 1];
    if (!last) throw new Error("no cells");
    grid.plant(last.col, last.row, GROVE_CROP);
    while (grid.getCrop(last.col, last.row)?.stage !== PlantStage.Mature) {
      if (!grid.growCrop(last.col, last.row)) break;
    }
    const progress = groveProgress(grid, grove);
    expect(progress.ripe).toBe(1);
    expect(progress.ripeAt).toEqual([cells.length - 1]);
  });

  /**
   * Corners at the corners and runs along the sides.
   *
   * The creeper is directional — a stem with leaves off it has to know which
   * way it is going — so a border laid with one tile repeated is a border
   * with four broken corners, which is what the undirected one had instead
   * of corners at all.
   */
  test("each bed's border turns at its corners and runs along its sides", () => {
    const { grid, grove } = grown();
    for (const bed of grove.beds) {
      const at = (col: number, row: number) => grid.getObjectAt(col, row)?.type;
      const left = bed.col - 1;
      const right = bed.col + bed.width;
      const top = bed.row - 1;
      const bottom = bed.row + bed.height;
      expect(at(left, top)).toBe(FixtureType.ForestVineCorner);
      expect(at(right, top)).toBe(FixtureType.ForestVineCorner);
      expect(at(left, bottom)).toBe(FixtureType.ForestVineCornerUp);
      expect(at(right, bottom)).toBe(FixtureType.ForestVineCornerUp);
      for (let col = bed.col; col < right; col++) {
        expect(at(col, top)).toBe(FixtureType.ForestVine);
        expect(at(col, bottom)).toBe(FixtureType.ForestVine);
      }
      for (let row = bed.row; row < bottom; row++) {
        expect(at(left, row)).toBe(FixtureType.ForestVineSide);
        expect(at(right, row)).toBe(FixtureType.ForestVineSide);
      }
      // The drawn corner comes in from its right, so the left-hand pair are
      // the mirror. Two unmirrored corners would both turn the same way.
      expect(grid.getObjectAt(left, top)?.flip).toBe(true);
      expect(grid.getObjectAt(right, top)?.flip).toBe(false);
    }
  });

  test("the trellis runs between the beds as well as around them", () => {
    const { grove } = grown();
    const vine = new Set(grove.trellis.map((at) => `${at.col},${at.row}`));
    // Every bed is ringed on all four sides by something that is not another
    // bed — which is what makes four squares read as four rather than as one
    // block of sixteen.
    for (const bed of grove.beds) {
      for (let col = bed.col; col < bed.col + bed.width; col++) {
        expect(vine.has(`${col},${bed.row - 1}`)).toBe(true);
        expect(vine.has(`${col},${bed.row + bed.height}`)).toBe(true);
      }
      for (let row = bed.row; row < bed.row + bed.height; row++) {
        expect(vine.has(`${bed.col - 1},${row}`)).toBe(true);
        expect(vine.has(`${bed.col + bed.width},${row}`)).toBe(true);
      }
    }
  });

  // The whole point of the change: a ring of wood round a patch of grass,
  // whatever band the box was placed in.
  test("the clearing is grass and the ring round it is wood", () => {
    const { grid, grove } = grown();
    expect(grid.getTerrain(grove.tree.col, grove.tree.row)).toBe(TerrainType.Grass);
    for (const at of [
      { col: BOX.col, row: BOX.row },
      { col: BOX.col + BOX.width - 1, row: BOX.row },
      { col: BOX.col, row: BOX.row + BOX.height - 1 },
      { col: BOX.col + BOX.width - 1, row: BOX.row + BOX.height - 1 },
    ]) {
      expect(grid.getTerrain(at.col, at.row)).toBe(TerrainType.Woodland);
    }
  });

  // The way in has to stay open: a bed laid across the doorstep would be a
  // tree you could not walk up to until you had done what it asked.
  test("the beds are beside the way in, not across it", () => {
    const { grid, grove } = grown();
    const cells = grove.beds.flatMap((bed) => patchCells(bed));
    expect(cells.some((at) => at.col === grove.doorstep.col)).toBe(false);
    expect(grid.isPassable(grove.doorstep.col, grove.doorstep.row)).toBe(true);
  });
});

describe("the wood's own dusk", () => {
  test("is full anywhere inside the box", () => {
    for (const at of [
      { col: BOX.col, row: BOX.row },
      { col: BOX.col + BOX.width - 1, row: BOX.row + BOX.height - 1 },
      { col: BOX.col + 12, row: BOX.row + 12 },
    ]) {
      expect(duskOver(BOX, at)).toBe(1);
    }
  });

  test("is nothing well outside it", () => {
    expect(duskOver(BOX, { col: BOX.col - DUSK_FADE_TILES - 1, row: BOX.row })).toBe(0);
    expect(duskOver(BOX, { col: 0, row: 0 })).toBe(0);
  });

  // The reason it is a ramp at all: a hard edge would draw a straight line
  // across ground the trees say has no line on it.
  test("falls off smoothly rather than switching", () => {
    const out = Array.from({ length: DUSK_FADE_TILES + 2 }, (_, n) =>
      duskOver(BOX, { col: BOX.col - n, row: BOX.row + 12 }),
    );
    for (const [n, here] of out.entries()) {
      const before = out[n - 1];
      if (before === undefined) continue;
      expect({ n, falling: here <= before }).toEqual({ n, falling: true });
      expect({ n, gentle: before - here <= 0.2 }).toEqual({ n, gentle: true });
    }
  });

  // Measured to the box, not to its centre: a centre distance would make a
  // square wood's corners darker than the middle of its edges.
  test("treats a corner and an edge the same distance out alike", () => {
    const edge = duskOver(BOX, { col: BOX.col - 4, row: BOX.row + 12 });
    const corner = duskOver(BOX, { col: BOX.col - 4, row: BOX.row + BOX.height + 3 });
    expect(corner).toBeLessThan(edge);
    expect(duskOver(BOX, { col: BOX.col - 4, row: BOX.row - 4 })).toBeLessThan(edge);
  });
});
