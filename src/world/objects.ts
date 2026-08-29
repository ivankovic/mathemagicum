// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// A structure placed on the grid at world-generation time — a building, the
// village well, etc. Distinct from a plant (player-placed, single tile,
// lives in WorldGrid.plants) and from an NPC (runtime-only, moves every
// frame in GameScene, never touches the grid at all).
export interface PlacedObject {
  id: string;
  type: string;
  col: number;
  row: number;
  width: number;
  height: number;
  blocksMovement: boolean;
  // The single footprint cell a standalone sprite (see
  // src/world/buildingSprites.ts) is planted on — its bottom-center point
  // lines up with this cell's, same anchoring convention plants use. For
  // a multi-cell object this is normally its front-facing cell (nearest
  // its "audience", e.g. the village well for a building), not its
  // top-left corner or centre, so the sprite doesn't look like it's
  // floating over empty footprint or embedded behind its own front wall.
  // Equal to (col, row) for a 1x1 object.
  anchorCol: number;
  anchorRow: number;
  /**
   * Not something the connectivity carve may knock down.
   *
   * That pass gets where it is going by *removing whatever is in the way*,
   * and for the ground it cuts through that is right — a route has to be
   * able to open a wood or a rock field. For architecture it is not. The
   * city wall is the case that made this necessary: a route to somewhere
   * beyond the city ran in at one side and out at the other, because two
   * wall cells were a cheaper crossing than a long detour round a wood, and
   * nothing noticed — a hole in a wall is a perfectly good way into a city,
   * so every check that asked whether the city could be walked into passed.
   *
   * Marked cells are *routed around* rather than cut: a marked cell that is
   * passable anyway — a gate — may still be walked over, and is then left
   * standing. Anything enclosed entirely by marked cells is unreachable and
   * the carve says so out loud rather than making a door.
   */
  unbreakable?: boolean;
  /**
   * Drawn mirrored about its own centre.
   *
   * For the fence's side run, whose rails sit on the left of its cell so
   * they line up with the corner panel's left post: the right-hand side of
   * an enclosure is the same sprite flipped, which lands them on the other
   * post. The footprint does not move, only the picture.
   */
  flip?: boolean;
  /**
   * Which way round it was put down, for the things that can be turned.
   *
   * Absent on everything the world generates and on everything that has one
   * drawing, which is nearly all of it — so a save written before any of
   * this reads back exactly as it did.
   *
   * The *turn*, not the drawing and the mirror it works out to. Those two
   * are derived at the moment of drawing, and storing them instead would
   * mean a bench picked up and put down again could not remember which of
   * the two side-on ways it had been.
   */
  turn?: number;
}
