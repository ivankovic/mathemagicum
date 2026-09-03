// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { AreaPlacement } from "./anchors";
import { type BuildingRole, footprintFor } from "./buildings";
import { FixtureType } from "./fixtures";
import type { WorldGrid } from "./grid";
import { LANDMARK_FOOTPRINT, LANDMARK_OVERHANG, LandmarkType } from "./landmarks";
import type { PlacedObject } from "./objects";
import { type Rng, randInt } from "./rng";
import { TerrainType } from "./terrain";
import type { GridPoint } from "./topdown";
import type { VillageNpcSpec } from "./villageLayout";

/**
 * The big city: streets and blocks, laid out on a grid.
 *
 * The third layout grammar, and the one that has to work hardest, because a
 * city is built from the same kit of buildings as the village and must not
 * read as a bigger village. The village is **round** — a ring about a well,
 * with everything placed by the direction it lies in from the middle. The
 * harbour is **linear** — a working front, with everything placed by how far
 * along it sits. This is **gridded**: streets at regular intervals, blocks
 * between them, and everything placed by which block it is in.
 *
 * That difference is doing the work a new building sprite would otherwise
 * have to do. A ring says village however many houses are in it; a grid says
 * town at four buildings.
 *
 * **Paved, not worn.** The village's paths are dirt because a village wears
 * its routes into the ground; a city lays its streets, so they are cobble —
 * the same stone the village square is, which is the one piece of built
 * ground the world already has.
 */

/**
 * How many people are out on the streets.
 *
 * Eight, against the village's four and its twenty-four buildings. Not one
 * per house: a city where everybody is outdoors at once is a parade, and the
 * point of the number is that a child turning a corner meets somebody rather
 * than that the census adds up.
 */
const TOWNSFOLK = 8;
/**
 * How many shops a city has, whatever the dice say.
 *
 * A playtest asked for shops in the city and the harbour, and "one block in
 * five, at random" answers that on most seeds and on some seeds not at all.
 * Five is enough that a child walking a lap meets one and few enough that
 * the place is still somewhere people live.
 */
const CITY_SHOPS = 5;
/** What the person behind a city counter is, whatever their id says. */
const SHOPKEEPER_ROLE = "shopkeeper";
/**
 * And the one person in the city who is not behind a counter.
 *
 * He teaches the hourglass, and he stands under the tower because that is
 * where a spell about telling the time belongs: the clock on the wall is
 * the only place in the world where the hour is written down for everybody
 * at once. Out in the square rather than in a room, since a clock tower is
 * a thing a child walks up to, and a teacher tucked into a building beside
 * it is a teacher nobody finds.
 */
const CLOCKMAKER_ROLE = "clockmaker";

/** How far inside the box the ring road runs, and how wide it is. */
const RING_INSET = 1;
const RING_WIDTH = 2;
/**
 * How square the town's outline is, and how far its edge wanders.
 *
 * A playtest looked at the map and said the city and the village *look very
 * artificial — the pure square looks too planned*, which was exactly right:
 * the pave loop laid cobble over every cell of the box, so the city was a
 * thirty-three by thirty-three rectangle of one colour on a map drawn at one
 * pixel to two tiles. Nothing on the ground read as wrong; the silhouette
 * did, and a silhouette is all a map has.
 *
 * The outline is a **squircle** — the p-norm ball at power three — rather
 * than a circle, because a town is not round either. A circle inscribed in
 * the box would throw away a fifth of it and read as a bullseye; at power
 * three the corners are rounded off and the sides stay flat, which is what
 * a town that grew inside a boundary actually looks like from above.
 *
 * And the edge wanders, by the same sum the enchanted forest's does and for
 * the same reason: a rounded rectangle drawn exactly is still a drawn shape.
 * The wander is deterministic in the box's own position, not drawn from the
 * rng — a draw here would shift every later draw and rebuild every world in
 * the game to no purpose.
 */
const OUTLINE_POWER = 3;
const EDGE_WANDER = 0.13;
/**
 * How wide a gateway is, in cells.
 *
 * Three, asked for by name: *the city wall gates are way too small and hard
 * to go through — three characters, three tiles at least.* One cell is a
 * target a child walking a wall has to hit exactly, and every miss looks the
 * same as walking into stone.
 *
 * It is three copies of the one gate piece the art ships rather than a wide
 * gateway drawn as one thing, so a gate reads as three arches in a row. That
 * is a real shape for a town gate and it is also simply what there is: the
 * sheet has one tile in it.
 */
export const GATE_WIDTH = 3;
/**
 * The repeating street-and-block rhythm across the city, in cells.
 *
 * A street one cell wide and blocks of five. Two-wide streets were tried and
 * cost a whole rank of blocks each way for something no player can tell
 * apart at this scale — a city reads as a city from how *many* blocks it
 * has, not from how wide the gaps between them are.
 */
const STREET_WIDTH = 1;
const BLOCK_SIZE = 5;
/**
 * One rhythm for both axes, so the streets cross at right angles and the
 * blocks come out rectangular.
 *
 * Read as a stride rather than baked into a list of coordinates, because the
 * box's size is the generator's to choose and a table would go on being
 * right until somebody changed it. Nothing draws a street any more — the
 * whole enclosure is one paved surface — so the rhythm's only job now is to
 * say where the blocks start.
 */
const RHYTHM = STREET_WIDTH + BLOCK_SIZE;

export interface CityBlock {
  readonly col: number;
  readonly row: number;
  readonly width: number;
  readonly height: number;
}

export interface CityLayout {
  /** Every block between the streets, in reading order. */
  readonly blocks: readonly CityBlock[];
  readonly buildings: readonly PlacedObject[];
  /**
   * The people: townsfolk on the streets, and a shopkeeper in every shop.
   *
   * A playtest put it plainly — *the city has no people*. Twenty-four
   * buildings and nobody on the street is a model of a city rather than one,
   * and four shops nobody is standing in are four rooms with a door.
   *
   * The same shape as the village's, because they are the same problem: a
   * person who walks a short circuit near where they belong, or one who
   * waits inside a room to be spoken to.
   */
  readonly npcs: readonly VillageNpcSpec[];
  readonly placed: readonly PlacedObject[];
  /** The paved square at the middle, and the tower that stands on it. */
  readonly plaza: CityBlock;
  /**
   * The town clock, standing on the plaza.
   *
   * Null if the plaza could not take it, which on a city small enough to
   * have no block wide enough is possible and not worth throwing over.
   */
  readonly clockTower: PlacedObject | null;
  /** A clear cell of the plaza, for anything that needs to stand on it. */
  readonly plazaCell: GridPoint;
  /** Every piece of the ring wall, the gates among them. */
  readonly wall: readonly PlacedObject[];
  /**
   * Every way through it: one to each side of the compass that has one.
   *
   * A city with a single gate is a city with a back. Walk round it from the
   * north and the wall runs on and on, and the way in is wherever you did
   * not start — which is a long walk to learn a fact the place could simply
   * have told you.
   *
   * A side is skipped where the cell outside it is water, or is the world's
   * own rim — which stands a step above everything and cannot be walked on.
   * Both are gates onto nothing, and a gate that cannot be walked through is
   * a door that lies about being one.
   *
   * They are not all *routed* to. `doorstep` is still one cell and the
   * connectivity pass still carves to that one; the others open onto
   * whatever the world put there, which may be sand or a lake. That is what
   * a city gate is — a way through the wall, not a promise about the country
   * outside it.
   */
  readonly gates: readonly GridPoint[];
  /**
   * The cell in front of the gate, and the world generator's route anchor.
   *
   * Not the middle of the box, which is where the clock tower is about to
   * stand: the connectivity pass carves by removing whatever is in the way,
   * and aimed at a landmark it removes the landmark. That has now happened
   * once, to the great tree, and it was silent — a route to a square with
   * nothing on it is still a route.
   *
   * A gate is also the right answer for its own sake. A city you arrive at
   * by appearing in the middle of has no outside.
   */
  readonly doorstep: GridPoint;
}

function pave(grid: WorldGrid, col: number, row: number, terrain: TerrainType): void {
  if (grid.inBounds(col, row)) grid.setTerrain(col, row, terrain);
}

/** The exact middle of a box, which is a half-cell for an even width. */
function middleOf(box: AreaPlacement): { col: number; row: number } {
  return { col: box.col + (box.width - 1) / 2, row: box.row + (box.height - 1) / 2 };
}

/**
 * How far out of true the edge runs in one direction, from 0 to 1.
 *
 * Two sine waves at three and five turns, out of phase by the box's own
 * position — the enchanted forest's sum, moved here rather than shared,
 * because what the two places want from it is the same idea at different
 * amplitudes and a common helper would be a knob with two owners.
 */
function wanderAt(box: AreaPlacement, angle: number): number {
  const phase = (((box.col * 11 + box.row * 5) % 360) * Math.PI) / 180;
  const wave = 0.6 * Math.sin(3 * angle + phase) + 0.4 * Math.sin(5 * angle - 2 * phase);
  return (wave + 1) / 2;
}

/** Whether a cell is inside the town's paved outline. See `OUTLINE_POWER`. */
function withinTheTown(box: AreaPlacement, col: number, row: number): boolean {
  const middle = middleOf(box);
  const dCol = col - middle.col;
  const dRow = row - middle.row;
  const out =
    (Math.abs(dCol) ** OUTLINE_POWER + Math.abs(dRow) ** OUTLINE_POWER) ** (1 / OUTLINE_POWER);
  const half = Math.min(box.width, box.height) / 2;
  const reach = half * (1 - EDGE_WANDER * wanderAt(box, Math.atan2(dRow, dCol)));
  return out <= reach;
}

/**
 * Where the gate goes, and where somebody stands to walk through it.
 *
 * The south side by preference: every door in the city faces that way, so
 * arriving there is arriving at the fronts of things rather than at the
 * backs of them.
 *
 * But the doorstep is **outside** the gate, and a city box can sit against
 * the edge of the world — where the south side has no outside at all. So the
 * sides are tried in turn and the first with room in front of it wins.
 *
 * Outside rather than inside is the load-bearing half. The connectivity pass
 * carves by removing whatever is in the way, so a target within the walls is
 * a target it will happily reach by knocking a hole in them: the garden
 * gate's disappearing act again, at the scale of a city. Aimed in front of
 * the gate, the carve stops at the threshold, and the gate itself — the one
 * piece of the ring that does not block — carries the route the rest of the
 * way in.
 */
function chooseDoorstep(grid: WorldGrid, box: AreaPlacement): GridPoint {
  const midCol = box.col + Math.floor(box.width / 2);
  const midRow = box.row + Math.floor(box.height / 2);
  const left = box.col + RING_INSET - 1;
  const right = box.col + box.width - RING_INSET;
  const top = box.row + RING_INSET - 1;
  const bottom = box.row + box.height - RING_INSET;
  const sides: GridPoint[] = [
    { col: midCol, row: bottom + 1 },
    { col: midCol, row: top - 1 },
    { col: right + 1, row: midRow },
    { col: left - 1, row: midRow },
  ];
  // Two things make a side worth arriving on, and both are about the cell
  // itself.
  //
  // It must be one cell in from the world's own rim, not merely in bounds:
  // that ring stands a step above everything inside it so it cannot be
  // walked onto, and no route may run along it — a doorstep laid there is a
  // doorstep nothing can reach, and world generation says so by failing to
  // find any route at all.
  //
  // And it must be dry. The first city this was tried on sits with its back
  // to the sea, and the west side opened straight onto deep water. Trees are
  // allowed — they can be cleared, and a wood outside a city is a wood
  // outside a city.
  const clear = ({ col, row }: GridPoint) =>
    col > 0 &&
    row > 0 &&
    col < grid.width - 1 &&
    row < grid.height - 1 &&
    grid.getTerrain(col, row) !== TerrainType.Water;
  return sides.find(clear) ?? (sides[0] as GridPoint);
}

/**
 * The rectangle the wall is laid on: the plaza and the ring of blocks round
 * it, with the streets between them as the rampart.
 *
 * Tried at one ring of blocks and then at none. A small world builds a small
 * city and its plaza can sit two blocks from the edge of the town, where a
 * nineteen-cell citadel would run off the cobble and stand in a field. What
 * matters is that the wall is *inside* the town and that everything under it
 * is paved, and both of those are asked rather than assumed.
 *
 * Null when neither fits, which is a real answer for a world small enough to
 * have no room for a citadel. The town is then simply unwalled — which reads
 * as a town, and is a great deal better than a wall with the sea in it.
 */
function citadel(
  plaza: CityBlock,
  inner: { col: number; row: number; width: number; height: number },
  paved: (at: { col: number; row: number; width: number; height: number }) => boolean,
): AreaPlacement | null {
  for (let rings = 1; rings >= 1; rings--) {
    const left = plaza.col - rings * RHYTHM - 1;
    const top = plaza.row - rings * RHYTHM - 1;
    const right = plaza.col + plaza.width + rings * RHYTHM;
    const bottom = plaza.row + plaza.height + rings * RHYTHM;
    const core: AreaPlacement = {
      id: "citadel",
      col: left,
      row: top,
      width: right - left + 1,
      height: bottom - top + 1,
    };
    const held =
      left >= inner.col &&
      top >= inner.row &&
      right < inner.col + inner.width &&
      bottom < inner.row + inner.height;
    if (held && core.width > GATE_WIDTH + 2 && paved(core)) return core;
  }
  return null;
}

/**
 * The three cells of each gateway, on all four sides of the citadel.
 *
 * All four, unconditionally, which is the one thing the move inward
 * simplifies: the wall no longer touches the outside world, so every side of
 * it opens onto the town's own streets and there is no longer such a thing
 * as a side with nothing behind it. That question has moved to
 * `chooseDoorstep`, which is the only place it was ever really about — where
 * the road arrives from.
 */
function gatesRound(core: AreaPlacement): GridPoint[] {
  const left = core.col;
  const right = core.col + core.width - 1;
  const top = core.row;
  const bottom = core.row + core.height - 1;
  const middleCol = left + crossingNearestTheMiddle(core.width);
  const middleRow = top + crossingNearestTheMiddle(core.height);
  const gates: GridPoint[] = [];
  for (let n = -1; n <= 1; n++) {
    gates.push({ col: middleCol + n, row: top });
    gates.push({ col: middleCol + n, row: bottom });
    gates.push({ col: left, row: middleRow + n });
    gates.push({ col: right, row: middleRow + n });
  }
  return gates;
}

/**
 * How far along a wall its gateway is centred: the street crossing nearest
 * the middle of that side.
 *
 * Not the middle itself, and this is the whole reason a gate is reachable at
 * all. Every building in a block is pushed to the *bottom* of it so its door
 * opens onto the street below, which means the cell immediately outside a
 * north gate is a building's front wall unless something stops it being one.
 * A gate centred on a crossing has the street that runs through the crossing
 * on both sides of it, so the middle of the gateway always opens onto
 * pavement — which is a property of the street grid rather than of what
 * happened to get built, and therefore holds on every seed.
 *
 * The two cells either side of the middle are looked after separately: see
 * where buildings are placed, which keeps them off a gate's approach.
 *
 * A city was sealed by this on three of twenty seeds before it was here, and
 * sealed *silently* — a walled place with an unreachable gate still has
 * three other gates, so nothing but a sweep over every cell says so.
 */
function crossingNearestTheMiddle(span: number): number {
  const middle = (span - 1) / 2;
  let best = RHYTHM;
  for (let at = RHYTHM; at < span - 1; at += RHYTHM) {
    if (Math.abs(at - middle) < Math.abs(best - middle)) best = at;
  }
  return best;
}

/**
 * The wall round the citadel, with a three-cell gateway on each side.
 *
 * **It goes round the core, not round the city.** It used to be laid on the
 * outermost ring of the box, which put every building in the world inside it
 * and made the wall the town's own silhouette — a thirty-three-cell square
 * of stone, which is the shape a playtest called *too planned*. A wall round
 * the middle says something different and truer: the citadel was built, and
 * the town grew round it. It is also what was asked for — *have the walls be
 * only around the inner core of the city*.
 *
 * Laid down a street rather than through a block, so nothing has to be
 * demolished to make room for it and the streets it closes are streets that
 * end at a gate.
 *
 * Four pieces, chosen by which side of the ring a cell is on: the runs that
 * cross the camera get the panel, the runs that go away from it get the
 * side view, and the corners take the panel because that is what the garden
 * fence does and for the same reason — a corner drawn as a side run leaves
 * the horizontal stopping in mid-air.
 *
 * **The gate cells are the only ones here that do not block.** A closed gate
 * on this grid either walls the city off or lets the player walk through
 * solid stone; drawn open and left passable, it says "this is the way in"
 * and means it. Exactly what the village garden's gate does, one scale up.
 */
function buildWall(
  grid: WorldGrid,
  core: AreaPlacement,
  gates: readonly GridPoint[],
): PlacedObject[] {
  const built: PlacedObject[] = [];
  const ways = new Set(gates.map(({ col, row }) => `${col},${row}`));
  const left = core.col;
  const right = core.col + core.width - 1;
  const top = core.row;
  const bottom = core.row + core.height - 1;
  for (let row = top; row <= bottom; row++) {
    for (let col = left; col <= right; col++) {
      const onEdge = row === top || row === bottom || col === left || col === right;
      if (!onEdge) continue;
      if (!grid.inBounds(col, row) || grid.getObjectAt(col, row)) continue;
      // The gateway is one named cell of the ring, and which piece it is
      // drawn as follows from which run it lands in — so a gate in the east
      // wall gets the side view without anything having to be told.
      const isGate = ways.has(`${col},${row}`);
      const acrossCamera = row === top || row === bottom;
      const type = isGate
        ? acrossCamera
          ? FixtureType.CityGate
          : FixtureType.CityGateSide
        : acrossCamera
          ? FixtureType.CityWall
          : FixtureType.CityWallSide;
      const piece: PlacedObject = {
        id: `city-wall-${col}-${row}`,
        type,
        col,
        row,
        width: 1,
        height: 1,
        blocksMovement: !isGate,
        unbreakable: true,
        anchorCol: col,
        anchorRow: row,
      };
      grid.placeObject(piece);
      built.push(piece);
    }
  }
  return built;
}

/**
 * The cells immediately outside and inside every gateway.
 *
 * Nothing may be built on one. Which side is which is not worked out — both
 * are, because a gate blocked from within is as sealed as one blocked from
 * without and the wall does not say which way it faces.
 */
function gateApproaches(core: AreaPlacement, gates: readonly GridPoint[]): Set<string> {
  const approaches = new Set<string>();
  const left = core.col;
  const right = core.col + core.width - 1;
  const top = core.row;
  const bottom = core.row + core.height - 1;
  for (const gate of gates) {
    const across = gate.row === top || gate.row === bottom;
    const step = across ? { col: 0, row: 1 } : { col: 1, row: 0 };
    approaches.add(`${gate.col - step.col},${gate.row - step.row}`);
    approaches.add(`${gate.col + step.col},${gate.row + step.row}`);
  }
  return approaches;
}

/** Whether a footprint would stand on any of them. */
function onAGateApproach(
  approaches: ReadonlySet<string>,
  col: number,
  row: number,
  width: number,
  height: number,
): boolean {
  for (let r = row; r < row + height; r++) {
    for (let c = col; c < col + width; c++) {
      if (approaches.has(`${c},${r}`)) return true;
    }
  }
  return false;
}

/** Stand a landmark on a square, anchored at the given top-left, or refuse. */
function raise(grid: WorldGrid, id: string, type: string, at: GridPoint): PlacedObject | null {
  const size = LANDMARK_FOOTPRINT;
  for (let row = at.row; row < at.row + size; row++) {
    for (let col = at.col; col < at.col + size; col++) {
      if (!grid.inBounds(col, row) || grid.getObjectAt(col, row)) return null;
    }
  }
  const object: PlacedObject = {
    id,
    type,
    col: at.col,
    row: at.row,
    width: size,
    height: size,
    blocksMovement: true,
    anchorCol: at.col,
    anchorRow: at.row,
  };
  grid.placeObject(object);
  return object;
}

/**
 * Lay the city out.
 *
 * Streets first, then what stands in the blocks between them — the same
 * order the village carves its square before its ring, and for the same
 * reason: the ground has to be settled before anything is put on it, or
 * every later step has to know what the earlier ones were going to do.
 */
export function layoutCity(grid: WorldGrid, box: AreaPlacement, rng: Rng): CityLayout {
  const inner = {
    col: box.col + RING_INSET + RING_WIDTH,
    row: box.row + RING_INSET + RING_WIDTH,
    width: box.width - (RING_INSET + RING_WIDTH) * 2,
    height: box.height - (RING_INSET + RING_WIDTH) * 2,
  };
  /** Whether every cell of a rectangle falls inside the town's outline. */
  const paved = (at: { col: number; row: number; width: number; height: number }) => {
    for (let row = at.row; row < at.row + at.height; row++) {
      for (let col = at.col; col < at.col + at.width; col++) {
        if (!withinTheTown(box, col, row)) return false;
      }
    }
    return true;
  };

  // --- the ground ---------------------------------------------------------

  // The whole enclosure, in one pass, before anything is put on it.
  //
  // It was the streets and the ring road only, with each block left as
  // whatever had grown there and a patch of dirt under each building. That
  // reads as houses standing in a field: the wall and the street grid were
  // doing all the work of saying *city* and the ground was arguing with
  // them. Paving the blocks in *dirt* was tried before that and was worse —
  // bare orange between grey streets, a building site.
  //
  // Cobble everywhere is the third answer and the one a city actually looks
  // like. It also settles what a block is for: nothing here is plantable,
  // because laid stone is not soil, and a city you could farm would be a
  // village with more houses in it. The garden is at home.
  //
  // Everywhere *inside the outline*, which is not the box. See
  // `withinTheTown`: the box's corners are left as whatever grew there, and
  // the edge between the two wanders, so the town has a silhouette instead
  // of a rectangle.
  for (let row = box.row; row < box.row + box.height; row++) {
    for (let col = box.col; col < box.col + box.width; col++) {
      if (!withinTheTown(box, col, row)) continue;
      pave(grid, col, row, TerrainType.Cobble);
    }
  }

  // --- the streets --------------------------------------------------------

  // The streets are no longer paved *here* — everything is paved. What this
  // walk still does is say where the blocks are, and a block is a rectangle
  // with a size rather than a bag of cells that happened not to be paved.
  const blocks: CityBlock[] = [];
  for (let row = STREET_WIDTH; row < inner.height; row += RHYTHM) {
    for (let col = STREET_WIDTH; col < inner.width; col += RHYTHM) {
      const width = Math.min(BLOCK_SIZE, inner.width - col);
      const height = Math.min(BLOCK_SIZE, inner.height - row);
      // A sliver left over at the far edge is not a block: there is nowhere
      // in it to stand a building. It is simply street now, which it looks
      // like, because the whole enclosure is one surface.
      if (width < 3 || height < 3) continue;
      const block = { col: inner.col + col, row: inner.row + row, width, height };
      // And a block the outline does not cover whole is not a block either.
      // Half a terrace standing on grass with its other half missing is a
      // worse edge than no terrace: what the rough outline is for is a town
      // that stops, not one that frays.
      if (!paved(block)) continue;
      blocks.push(block);
    }
  }

  // --- the plaza ----------------------------------------------------------

  const middle = { col: box.col + box.width / 2, row: box.row + box.height / 2 };
  const plaza = blocks.reduce((best, block) => {
    const distance = (b: CityBlock) =>
      Math.hypot(b.col + b.width / 2 - middle.col, b.row + b.height / 2 - middle.row);
    return distance(block) < distance(best) ? block : best;
  }, blocks[0] as CityBlock);
  // Anchored so the tower sits in the middle of the square with its feet on
  // the lower half of it — a two-by-two block centred exactly would leave
  // the square's own middle cell blocked and the approach from the south
  // running into its wall.
  const towerAt = {
    col: plaza.col + Math.floor((plaza.width - LANDMARK_FOOTPRINT) / 2),
    row: plaza.row + Math.floor((plaza.height - LANDMARK_FOOTPRINT) / 2),
  };
  const clockTower = raise(grid, "city-clock-tower", LandmarkType.ClockTower, towerAt);
  // A corner of the square that the tower is not standing on, which is what
  // anything checking "can you get to the middle of the city" has to aim at
  // now that the middle of the city is a building.
  const plazaCell = { col: plaza.col, row: plaza.row };

  // --- the citadel wall ---------------------------------------------------

  // Before the buildings and before the street furniture, which is a change
  // of order and the load-bearing part of moving the wall inward. Built
  // last, it skipped every cell something was already standing on — which
  // was harmless while it ran round the empty rim of the box and would now
  // leave a lamp-shaped hole in the middle of a rampart.
  //
  // The ring encloses the plaza and the eight blocks round it, laid down the
  // streets between them so nothing has to be demolished to make room. One
  // ring of blocks if there is room for it and none if there is not: a small
  // world builds a small city, and a wall that ran off the end of the town
  // would be a wall standing in a field.
  const core = citadel(plaza, inner, paved);
  const gates = core ? gatesRound(core) : [];
  const wall = core ? buildWall(grid, core, gates) : [];
  const approaches = core ? gateApproaches(core, gates) : new Set<string>();

  // --- what stands in the blocks -----------------------------------------

  const buildings: PlacedObject[] = [];
  const placed: PlacedObject[] = [...wall];
  // What the clock tower's art covers, which is more than what it stands on:
  // five tiles above the two, so the block behind it is drawn over entirely.
  // A playtest called that "buildings behind the clocktower are blocked".
  // Nothing was blocked — every door was reachable and every cell inside the
  // walls could be walked to — but a building nobody can see is a building
  // that is not there, and a square in front of a town clock is a better
  // answer than a townhouse hidden behind it.
  const shadow = clockTower
    ? {
        col: clockTower.col,
        row: clockTower.row - LANDMARK_OVERHANG[LandmarkType.ClockTower],
        width: clockTower.width,
        height: clockTower.height + LANDMARK_OVERHANG[LandmarkType.ClockTower],
      }
    : null;
  const hidden = (block: CityBlock) =>
    shadow !== null &&
    block.col < shadow.col + shadow.width &&
    shadow.col < block.col + block.width &&
    block.row < shadow.row + shadow.height &&
    shadow.row < block.row + block.height;

  // Which blocks get a shop, drawn without replacement.
  //
  // It used to be a die roll per block — a one-in-five chance of a store —
  // which mostly came out at five or six shops and sometimes came out at
  // *none*. A city with no shop in it fails the thing the shops were asked
  // for, and it fails it on a seed nobody can predict, which is the worst
  // way for something to be missing.
  //
  // Drawn rather than dealt round in order, though, because that was the
  // other failure: a fixed cycle over a grid of blocks lands the same role
  // on the same relative position in every rank, and the first pass came
  // out as a column of warehouses down the middle of the city.
  //
  // Everything else is a townhouse. A city is people living in it, and a row
  // of nothing but warehouses reads as a depot. The cottage is deliberately
  // absent — it is the village's house, and a city that borrowed it would be
  // a village with more of them. So is the post office: there is one of
  // those in the world, it is where the map on the wall hangs, and a city
  // with four would be three more reasons not to climb the village's tower.
  const shopBlocks = new Set<number>();
  const buildable = blocks.filter((block) => block !== plaza && !hidden(block));
  while (shopBlocks.size < Math.min(CITY_SHOPS, buildable.length)) {
    shopBlocks.add(randInt(rng, 0, buildable.length - 1));
  }
  let n = 0;
  for (const [at, block] of buildable.entries()) {
    const role: BuildingRole = shopBlocks.has(at) ? "store" : "townhouse";
    const { width, height } = footprintFor(role);
    if (width > block.width || height > block.height) {
      n++;
      continue;
    }
    // Pushed to the *bottom* of its block, so its door opens straight onto
    // the street below rather than into the yard behind it. Every building
    // sprite in the game has its door in the south wall, which is a fact
    // about the art and therefore a fact the layout has to build around.
    // Nudged along the street rather than centred to the pixel. Twenty-five
    // buildings all sitting dead centre in their block is a spreadsheet, not
    // a town, and one cell either way is enough to break it.
    const slack = block.width - width;
    const along = slack > 0 ? randInt(rng, 0, slack) : 0;
    const row = block.row + block.height - height;
    // ...and never across the way out of a gateway.
    //
    // A gate is three cells wide and its middle one is safe by construction
    // — see `crossingNearestTheMiddle` — but the two either side open onto
    // the corners of the blocks that flank the crossing, and a building
    // standing there turns two thirds of a gateway into a wall. Slid along
    // the street until it is clear, and dropped if no offset is: an empty
    // block beside a gate is a small yard, and half a blocked gate is the
    // thing a child walks into.
    const offsets = [along, ...Array.from({ length: slack + 1 }, (_, at) => at)];
    const at0 = offsets.find(
      (offset) => !onAGateApproach(approaches, block.col + offset, row, width, height),
    );
    if (at0 === undefined) {
      n++;
      continue;
    }
    const topLeft = { col: block.col + at0, row };
    const building: PlacedObject = {
      id: `city-${role}-${n}`,
      type: role,
      ...topLeft,
      width,
      height,
      blocksMovement: true,
      anchorCol: topLeft.col,
      anchorRow: topLeft.row,
    };
    grid.placeObject(building);
    buildings.push(building);
    placed.push(building);
    n++;
  }

  // What the crossings get, which is where a city puts its street furniture
  // and also the only cells the grid guarantees are clear.
  //
  // It was a lamp at every one of them. A playtest asked for somewhere with
  // a bit more solarpunk about it, so every third crossing is greenery
  // instead: in rotation rather than at random, because a child walking a
  // street should be able to see the pattern, which is also what stops one
  // crossing looking like a mistake.
  //
  // **The lamp keeps two of every three**, because it is the one of the pair
  // that does something — it lights the ground, and a city that swapped half
  // its lamps for scenery would be a city that got darker to look nicer.
  //
  // A sun panel was in this rotation and is not any more. The same playtest
  // said panels scattered about the place did not look good, and they were
  // right — a panel belongs on a roof, so it is drawn into the townhouse
  // itself and this list is back to things that stand on the ground.
  const CROSSING_CYCLE: readonly FixtureType[] = [
    FixtureType.Lamp,
    FixtureType.Lamp,
    FixtureType.Planter,
  ];
  let crossing = 0;
  for (let row = 0; row < inner.height; row += RHYTHM) {
    for (let col = 0; col < inner.width; col += RHYTHM) {
      const at = { col: inner.col + col, row: inner.row + row };
      if (!grid.inBounds(at.col, at.row) || grid.getObjectAt(at.col, at.row)) continue;
      // Only on the town's own ground. A crossing near the corner of the box
      // is now open country — see `withinTheTown` — and a lamp post standing
      // in a field is a lamp post somebody forgot to take away.
      if (!withinTheTown(box, at.col, at.row)) continue;
      // Counted per *placed* thing rather than per crossing considered, so a
      // run of blocked cells does not silently skip the panel's turn.
      const type = CROSSING_CYCLE[crossing % CROSSING_CYCLE.length] ?? FixtureType.Lamp;
      crossing++;
      const dressing: PlacedObject = {
        id: `city-${type}-${at.col}-${at.row}`,
        type,
        col: at.col,
        row: at.row,
        width: 1,
        height: 1,
        blocksMovement: true,
        anchorCol: at.col,
        anchorRow: at.row,
      };
      grid.placeObject(dressing);
      placed.push(dressing);
    }
  }

  // --- the way in ---------------------------------------------------------

  // The one cell the world's road is carved to. It is outside the box
  // entirely and always has been: the connectivity pass carves by removing
  // whatever is in the way, so a target within the town is a target it will
  // reach by knocking a hole in something. Aimed in front of the town, the
  // carve stops at the edge of the cobble and the streets carry it the rest
  // of the way.
  const doorstep = chooseDoorstep(grid, box);
  grid.removeObjectAt(doorstep.col, doorstep.row);
  pave(grid, doorstep.col, doorstep.row, TerrainType.Cobble);

  if (clockTower) placed.push(clockTower);

  // --- the people ---------------------------------------------------------

  const npcs: VillageNpcSpec[] = [];
  // One behind every counter. The city builds shops already; what it has
  // never had is anybody in them, so walking into one got a room and a
  // silence.
  for (const shop of buildings.filter((building) => building.type === "store")) {
    npcs.push({
      id: `${shop.id}-keeper`,
      role: SHOPKEEPER_ROLE,
      homeBuildingId: shop.id,
      home: { col: shop.col + Math.floor(shop.width / 2), row: shop.row + shop.height },
      indoors: true,
    });
  }
  // The clockmaker, at the tower's foot. Below it rather than beside it:
  // the tower's art overhangs five tiles *upwards*, so a person standing to
  // the north of it is a person drawn behind a wall — and the approach to
  // the square comes from the south anyway.
  //
  // The first clear cell of a short list, worked outwards: the plaza is a
  // block of open ground but the tower does not always sit the same way in
  // it, and a person placed on a cell nothing checked would be a person
  // standing inside a building.
  if (clockTower) {
    const beside = [
      { col: clockTower.col, row: clockTower.row + clockTower.height },
      { col: clockTower.col + 1, row: clockTower.row + clockTower.height },
      { col: clockTower.col - 1, row: clockTower.row + clockTower.height - 1 },
      { col: clockTower.col + clockTower.width, row: clockTower.row + clockTower.height - 1 },
      { col: clockTower.col - 1, row: clockTower.row + clockTower.height },
      { col: clockTower.col + clockTower.width, row: clockTower.row + clockTower.height },
    ];
    const stands = beside.find((at) => grid.isPassable(at.col, at.row));
    if (stands) {
      npcs.push({
        id: "city-clockmaker",
        role: CLOCKMAKER_ROLE,
        homeBuildingId: "",
        home: stands,
        indoors: false,
      });
    }
  }

  // And some out on the streets. Spread along the ring road rather than
  // scattered at random: the ring is the one run of ground the layout knows
  // is walkable end to end, and people you meet while walking round a city
  // are people on a street rather than people standing in a yard.
  // Spaced along the cells of the ring that are clear, rather than along the
  // ring and then dropped where they are not — the lamps stand on it, and
  // sampling first put a person on a lamp post and then dropped them.
  // Paved as well as walkable. The ring runs one cell inside the box and the
  // town no longer fills the box, so parts of it are grass now — and people
  // spread along the *road* is the whole reason the ring was chosen over a
  // scatter.
  const ring = ringWalk(box).filter(
    (at) =>
      grid.isPassable(at.col, at.row) && grid.getTerrain(at.col, at.row) === TerrainType.Cobble,
  );
  for (let n = 0; n < TOWNSFOLK && ring.length > 0; n++) {
    const at = ring[Math.floor((n * ring.length) / TOWNSFOLK)] as GridPoint;
    npcs.push({
      id: `city-townsfolk-${n}`,
      homeBuildingId: "",
      home: { col: at.col, row: at.row },
      indoors: false,
    });
  }

  return {
    blocks,
    buildings,
    placed,
    plaza,
    clockTower,
    plazaCell,
    doorstep,
    wall,
    gates,
    npcs,
  };
}

/**
 * The ring road, as a loop of cells.
 *
 * Walked once round rather than sampled, so the people spaced along it are
 * spaced along the *road* — a city's crowd belongs on its streets, and a
 * random cell inside the walls is as likely to be somebody's doorstep.
 */
function ringWalk(box: AreaPlacement): GridPoint[] {
  const left = box.col + RING_INSET;
  const right = box.col + box.width - RING_INSET - 1;
  const top = box.row + RING_INSET;
  const bottom = box.row + box.height - RING_INSET - 1;
  const loop: GridPoint[] = [];
  for (let col = left; col <= right; col++) loop.push({ col, row: top });
  for (let row = top + 1; row <= bottom; row++) loop.push({ col: right, row });
  for (let col = right - 1; col >= left; col--) loop.push({ col, row: bottom });
  for (let row = bottom - 1; row > top; row--) loop.push({ col: left, row });
  return loop;
}
