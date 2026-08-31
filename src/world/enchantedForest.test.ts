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

/**
 * The size the generator actually builds, which is not what this used to be.
 *
 * Twenty-four while the clearing was a square measured in Chebyshev steps.
 * A round clearing has to hold the four beds in *every* direction rather
 * than only along the diagonals, which takes eleven tiles — and eleven of a
 * twelve-tile half leaves a hedge where the wood goes. See `ANCHOR_SIZES`.
 */
const BOX: AreaPlacement = { id: "enchanted-forest", col: 40, row: 40, width: 36, height: 36 };

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

  /**
   * A wood you can see straight through is a field with trees in it.
   *
   * Measured as the crow flies now, in rings rather than in squares, which
   * is the whole of the change: the ring just outside the clearing has to be
   * thicker than the ground the clearing itself covers, and the middle of
   * the band thicker again. Rings by area, so a wider ring is not counted as
   * a denser one.
   */
  test("thickens outward from the clearing", () => {
    const { grid } = grown();
    const middle = { col: BOX.col + BOX.width / 2, row: BOX.row + BOX.height / 2 };
    const ring = (from: number, to: number) => {
      let cells = 0;
      let standing = 0;
      for (let row = BOX.row; row < BOX.row + BOX.height; row++) {
        for (let col = BOX.col; col < BOX.col + BOX.width; col++) {
          const out = Math.hypot(col - middle.col, row - middle.row);
          if (out < from || out >= to) continue;
          cells++;
          if (grid.getObjectAt(col, row)) standing++;
        }
      }
      return cells === 0 ? 0 : standing / cells;
    };
    const inside = ring(4, 9);
    const band = ring(13, 16);
    expect({ thicker: band > inside + 0.25 }).toEqual({ thicker: true });
  });

  /**
   * And the corners of the box are country, not a bald patch.
   *
   * The world's scatter skips reserved areas altogether, so every tile
   * inside this box is the grove's to fill or to leave empty. The wood is
   * round and the box is square, which leaves four corners the wood does not
   * reach — and if the grove left them alone they would be a square hole cut
   * out of the countryside, which is the same complaint the round clearing
   * was for.
   */
  test("scatters the corners the wood does not reach", () => {
    const { grid } = grown();
    const corner = { col: BOX.col + 2, row: BOX.row + 2 };
    let cells = 0;
    let standing = 0;
    for (let row = corner.row; row < corner.row + 4; row++) {
      for (let col = corner.col; col < corner.col + 4; col++) {
        cells++;
        if (grid.getObjectAt(col, row)) standing++;
      }
    }
    expect({ cells, bald: standing === 0 }).toEqual({ cells: 16, bald: false });
  });

  /**
   * The shape itself: round, and not the same circle twice.
   *
   * Sampled by walking out from the middle along a spread of angles and
   * noting where the grass gives way. A square measured in Chebyshev steps —
   * which is what this was — reads √2 times further out at its corners than
   * at the middle of its sides; a plain circle reads exactly the same in
   * every direction, which is a shape nothing grew either.
   */
  test("the clearing is a circle with a wander in it", () => {
    const { grid } = grown();
    const middle = { col: BOX.col + BOX.width / 2, row: BOX.row + BOX.height / 2 };
    const edges: number[] = [];
    for (let step = 0; step < 24; step++) {
      const angle = (step / 24) * 2 * Math.PI;
      let out = 0;
      while (out < BOX.width) {
        const col = Math.round(middle.col + Math.cos(angle) * (out + 1));
        const row = Math.round(middle.row + Math.sin(angle) * (out + 1));
        if (!grid.inBounds(col, row) || grid.getTerrain(col, row) !== TerrainType.Grass) break;
        out++;
      }
      edges.push(out);
    }
    const near = Math.min(...edges);
    const far = Math.max(...edges);
    // Every sixth sample is an axis and the ones between them the diagonals.
    // This is what tells a wandering circle from a square: a square measured
    // in Chebyshev steps reaches √2 further along its diagonals than along
    // its sides, every time, and that is a ratio no wander produces.
    const mean = (steps: readonly number[]) =>
      steps.reduce((sum, step) => sum + (edges[step] ?? 0), 0) / steps.length;
    const axes = mean([0, 6, 12, 18]);
    const diagonals = mean([3, 9, 15, 21]);
    expect({
      // It wanders: a plain circle comes back the same number every time.
      wanders: far > near,
      // And its corners are not further out than its sides, which is the
      // whole of what "too square" meant.
      notASquare: diagonals / axes < 1.15,
      // And it is big enough to hold the beds, whose far corners stand ten
      // tiles out — which is why the radius is eleven and not nine.
      holdsTheBeds: near >= 10,
    }).toEqual({ wanders: true, notASquare: true, holdsTheBeds: true });
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

  test("the beds are grass with their corners marked, not a hole in the clearing", () => {
    const { grid, grove } = grown();
    for (const at of grove.beds.flatMap((bed) => patchCells(bed))) {
      // Grass, because bare earth in a clearing read as a hole in it.
      expect(grid.getTerrain(at.col, at.row)).toBe(TerrainType.Grass);
      // Under the thicket for now, but the ground itself will take a crop.
      expect(grid.canPlant(at.col, at.row, GROVE_CROP)).toBe(true);
    }
    expect(grove.markers.length).toBe(grove.beds.length * 4);
    for (const at of grove.markers) {
      expect(grid.getObjectAt(at.col, at.row)?.type).toBe(FixtureType.Glowcap);
      // Walked past, not walked round: a marker you cannot cross would be a
      // fence post, and the bed inside four of them has to be reachable.
      expect(grid.isPassable(at.col, at.row)).toBe(true);
    }
  });

  /**
   * Four points at the corners of a small square say *square* with no line
   * at all, which is the geometry doing the work instead of the art.
   *
   * Three attempts at a border came off badly — a lattice of diamonds, a
   * ring of stars, a thin dark frame with specks on it — and the fault was
   * never the drawing: a border on grass has to be a line, and a line at
   * this scale is either loud enough to read as a fence or quiet enough to
   * read as wire, with very little in between.
   */
  test("every bed is marked at each of its four corners", () => {
    const { grove } = grown();
    const marked = new Set(grove.markers.map((at) => `${at.col},${at.row}`));
    for (const bed of grove.beds) {
      for (const at of [
        { col: bed.col - 1, row: bed.row - 1 },
        { col: bed.col + bed.width, row: bed.row - 1 },
        { col: bed.col - 1, row: bed.row + bed.height },
        { col: bed.col + bed.width, row: bed.row + bed.height },
      ]) {
        expect({ at: `${at.col},${at.row}`, marked: marked.has(`${at.col},${at.row}`) }).toEqual({
          at: `${at.col},${at.row}`,
          marked: true,
        });
      }
    }
    // And nowhere along the sides: a marker between two corners is a border
    // again, which is the thing that did not work.
    for (const bed of grove.beds) {
      for (let col = bed.col; col < bed.col + bed.width; col++) {
        expect(marked.has(`${col},${bed.row - 1}`)).toBe(false);
      }
    }
  });

  /**
   * A ring of wood round a patch of grass, whatever band the box landed in.
   *
   * The grove makes its own ground rather than inheriting what it was
   * dropped on — a hilly band used to put the great tree in a field of
   * scrub. What it does *not* make any more is the corners of its box: the
   * wood is round, and painting the rectangle woodland drew a square of
   * trees across the hillside wherever the box straddled a band. This grid
   * starts as grass everywhere, so a corner that is still grass is a corner
   * the grove left alone.
   */
  test("the clearing is grass, the ring round it is wood, and the corners are the world's", () => {
    const { grid, grove } = grown();
    const middle = { col: BOX.col + BOX.width / 2, row: BOX.row + BOX.height / 2 };
    expect(grid.getTerrain(grove.tree.col, grove.tree.row)).toBe(TerrainType.Grass);
    // Fourteen tiles out along each axis is inside the wood in every
    // direction: the wood reaches at least fifteen after its wander.
    for (const [dCol, dRow] of [
      [14, 0],
      [-14, 0],
      [0, 14],
      [0, -14],
    ] as const) {
      const at = { col: middle.col + dCol, row: middle.row + dRow };
      expect({ at, terrain: grid.getTerrain(at.col, at.row) }).toEqual({
        at,
        terrain: TerrainType.Woodland,
      });
    }
    for (const at of [
      { col: BOX.col, row: BOX.row },
      { col: BOX.col + BOX.width - 1, row: BOX.row },
      { col: BOX.col, row: BOX.row + BOX.height - 1 },
      { col: BOX.col + BOX.width - 1, row: BOX.row + BOX.height - 1 },
    ]) {
      expect({ at, terrain: grid.getTerrain(at.col, at.row) }).toEqual({
        at,
        terrain: TerrainType.Grass,
      });
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
  /**
   * Full anywhere inside the wood — which is no longer the same thing as
   * anywhere inside the box.
   *
   * The tint follows the trees. It used to be measured to the box, corners
   * and all, which was right while the wood was a rectangle: a square of
   * dusk round a round wood would be the same report over again, drawn in
   * shade rather than in trees.
   */
  test("is full anywhere inside the wood", () => {
    const middle = { col: BOX.col + BOX.width / 2, row: BOX.row + BOX.height / 2 };
    for (const [dCol, dRow] of [
      [0, 0],
      [14, 0],
      [0, -14],
      [-9, 9],
    ] as const) {
      const at = { col: middle.col + dCol, row: middle.row + dRow };
      expect({ at, dusk: duskOver(BOX, at) }).toEqual({ at, dusk: 1 });
    }
  });

  // And thinner out in the corners of the box, which the wood does not
  // reach. Half a dozen tiles past the trees is half a dozen tiles of
  // daylight, whether it is inside the anchor's rectangle or not.
  test("has already begun to lift in the corners of the box", () => {
    const corner = duskOver(BOX, { col: BOX.col, row: BOX.row });
    expect({ lifting: corner < 1, dark: corner > 0 }).toEqual({ lifting: true, dark: true });
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

  /**
   * And it is measured from the middle, which it was not.
   *
   * While the wood was a rectangle this had to measure to the *box* — a
   * centre distance would have made a square wood's corners darker than the
   * middles of its sides, for no reason anybody standing there could see.
   * The wood is round now and a centre distance is exactly right: out past
   * the corner of the box is further from the trees than out past the middle
   * of its side, and it should be lighter for it.
   */
  test("lifts sooner out past a corner than out past a side", () => {
    const middle = { col: BOX.col + BOX.width / 2, row: BOX.row + BOX.height / 2 };
    const side = duskOver(BOX, { col: middle.col - 22, row: middle.row });
    const corner = duskOver(BOX, { col: middle.col - 22, row: middle.row - 22 });
    expect({ dimmer: side > corner, lit: corner }).toEqual({ dimmer: true, lit: 0 });
  });
});
