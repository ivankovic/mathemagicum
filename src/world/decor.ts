// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { type Rgb, rampPlan } from "../render/recolour";
import type { Facing } from "./characters";
import { TURNS_DRAWN, Turn, turnFrom } from "./facing";
import { FABRIC_SLOTS } from "./houses";
import type { RoomBlocker } from "./interiors";
import { MaterialType } from "./materials";
import type { GrowableSidecar, SheetLayout } from "./spriteSidecar";
import type { GridPoint } from "./topdown";

/**
 * The things standing in a room, and where they stand.
 *
 * Furniture used to be a fact about the *picture*: the generator said a bed
 * was at cell (1, 2) and the game drew one there, for ever, in every house.
 * That was fine while a room was a picture. It stopped being fine the moment
 * a child could build the room out — a house twice the size with its bed
 * still in the original corner is a house nobody arranged.
 *
 * So the shipped placements are a *starting* arrangement now, and everything
 * in a room is an ordinary thing that can be picked up and put down again.
 * What the generator ships is the room somebody left; what a child does with
 * it is theirs.
 *
 * **The fire is in here too now**, and it was the one thing that was not.
 * A fireplace is architecture: set into the wall, with a chimney breast
 * drawn above its own cell, it was the single object in a room a child was
 * otherwise free to arrange that could only ever be where it was built —
 * which reads as a bug rather than as a rule.
 *
 * So it is a *stove*: the same fire in a thing that stands on the floor, one
 * cell rather than two, and ordinary furniture in every other way. It keeps
 * the eight animated frames, because a fire that did not move would not be
 * one; what it no longer keeps is the exemption.
 */

export const DecorType = {
  Bed: "bed",
  Table: "table-indoor",
  Chair: "chair",
  Rug: "rug",
  Bookshelf: "bookshelf",
  Stove: "stove",
  // The kitchen and the washroom, which a playtest asked for by name: the
  // children wanted things to buy for the *house* rather than for the
  // garden, and named the two rooms every cottage has and this one had not.
  // The stove was already here; what was missing was anywhere to wash a
  // plate or a child.
  Sink: "sink",
  Dresser: "dresser",
  Kettle: "kettle",
  Bath: "bath",
  Washstand: "washstand",
  Privy: "privy",
} as const;

export type DecorType = (typeof DecorType)[keyof typeof DecorType];

export const DECOR_TYPES: readonly DecorType[] = Object.values(DecorType);

/**
 * The name the *art* uses, which is not always the name the game does.
 *
 * One of them collides: the store already sells a `table`, which is a
 * different drawing at a different size — a one-cell garden table against a
 * two-cell one indoors. They are two pieces of furniture that happen to
 * share an English word, and an item type is a key rather than a label, so
 * the indoor one carries a suffix and the pictures stay apart.
 */
const PIECE_ART: Record<DecorType, string> = {
  [DecorType.Bed]: "bed",
  [DecorType.Table]: "table",
  [DecorType.Chair]: "chair",
  [DecorType.Rug]: "rug",
  [DecorType.Bookshelf]: "bookshelf",
  [DecorType.Stove]: "stove",
  [DecorType.Sink]: "sink",
  [DecorType.Dresser]: "dresser",
  [DecorType.Kettle]: "kettle",
  [DecorType.Bath]: "bath",
  [DecorType.Washstand]: "washstand",
  [DecorType.Privy]: "privy",
};

export function pieceArt(decor: DecorType): string {
  return PIECE_ART[decor];
}

export function decorFor(art: string): DecorType | null {
  for (const decor of DECOR_TYPES) {
    if (PIECE_ART[decor] === art) return decor;
  }
  return null;
}

/**
 * One kind of thing in one colour: what a basket counts and a shop sells.
 *
 * The colour is part of the *item*, not of where it was put down. That falls
 * out of the shop being two taps — pick a chair, pick a colour — because a
 * child who has bought a green chair owns a green chair, and a basket that
 * only knew "three chairs" would have to ask again every time one went down.
 */
export type DecorItem = `${DecorType}~${number}`;

export function decorItem(piece: DecorType, look: number): DecorItem {
  return `${piece}~${Math.max(0, Math.trunc(look))}` as DecorItem;
}

/**
 * How many colours a piece can be painted.
 *
 * Stated here as well as shipped in the sidecar, because the *basket* has to
 * enumerate every kind of thing it can hold in a stable order and cannot ask
 * an asset that has not loaded yet. Kept honest by a test against what the
 * generator actually ships.
 */
export const DECOR_LOOKS = 5;

/**
 * Which pieces can actually be painted, and which are one colour only.
 *
 * A colourway swaps the room's *wood* and *cloth* ramps for another pair —
 * see the generator's note on `PIECE_COLOURWAYS`. So a piece drawn out of
 * those two ramps has five looks, and a piece drawn out of tin has one: the
 * kettle and the bath came into the shop with five swatches under them, all
 * five of which were the same picture.
 *
 * Listed by exception rather than derived from the art, because "does this
 * sprite contain a wood pixel" is a question about a texture that may not
 * have loaded, and `DECOR_ITEMS` has to enumerate the basket's contents
 * before anything is on screen. `decor.test.ts` checks the list against what
 * the generator ships.
 */
const ONE_COLOUR: readonly string[] = [DecorType.Kettle, DecorType.Bath];

/** Whether a swatch under this piece would mean anything. */
export function takesAColour(piece: DecorType): boolean {
  return !ONE_COLOUR.includes(piece);
}

/**
 * How many drawings a piece has. Everything in the house turns.
 *
 * There is no exception any more and that is worth saying out loud, because
 * there was one: the bed, the kitchen table and the bath were held back for
 * a while, on the grounds that a quarter turn of a one-by-two piece makes it
 * two-by-one — a change to what the *room* is rather than to how the piece
 * is drawn. It is, and `sizeOf` is where that change lives.
 */
export function turnsOfPiece(piece: DecorType): number {
  return DECOR_TYPES.includes(piece) ? TURNS_DRAWN : 1;
}

/** Whether a child may turn this one round while they are holding it. */
export function canTurnPiece(piece: DecorType): boolean {
  return turnsOfPiece(piece) > 1;
}

/**
 * How many cells a piece covers, this way round.
 *
 * The whole of what a quarter turn does to the room, in one place. A bed is
 * one cell by two facing either way up the room and two by one lying across
 * it; a chair is one by one however it is turned. Everything downstream —
 * which cells are taken, whether it fits, what the walkability grid says,
 * where the sprite sorts — goes through `cellsUnder`, which goes through
 * here, so the swap is stated once rather than remembered in six places.
 *
 * It has to agree exactly with the generator's `footprint_at`, which decides
 * what is *drawn*. `assets.test.ts` holds the two together: a piece the two
 * disagree about is a piece that draws over one square and blocks another.
 */
export function sizeOf(
  piece: DecorType,
  turn: number,
  footprints: Footprints,
): { cols: number; rows: number } {
  const size = footprints[piece] ?? { cols: 1, rows: 1 };
  const across = turnFrom(turn);
  return across === Turn.Side || across === Turn.SideOther
    ? { cols: size.rows, rows: size.cols }
    : size;
}

/**
 * How many frames of a piece's strip belong to one way round.
 *
 * Read off the sheet rather than worked out here, because the strip holds a
 * piece's motion *and* its ways round on one line — a stove has eight frames
 * in each of three, and everything else has one in each. A sheet from before
 * any of this says neither, and one frame per look is what it had.
 */
export function framesPerLook(sheet: SheetLayout | undefined): number {
  return Math.max(1, sheet?.frames_per_look ?? 1);
}

/** Every kind of thing a basket can hold: each piece in each colour. */
export const DECOR_ITEMS: readonly DecorItem[] = DECOR_TYPES.flatMap((piece) =>
  Array.from({ length: DECOR_LOOKS }, (_, look) => decorItem(piece, look)),
);

/** The piece and the colour a basket entry stands for, or nothing. */
export function itemParts(item: string): { piece: DecorType; look: number } | null {
  // Exactly two parts. `chair~2~3` splits into three and would otherwise
  // read as a chair in colour two with a stray tail nobody notices.
  const parts = item.split("~");
  if (parts.length !== 2) return null;
  const [piece, look] = parts;
  const known = DECOR_TYPES.find((one) => one === piece);
  if (!known || look === undefined || !/^\d+$/.test(look)) return null;
  return { piece: known, look: Number(look) };
}

/** One thing standing in a room, in the plan's own coordinates. */
export interface Placed {
  readonly piece: DecorType;
  readonly col: number;
  readonly row: number;
  /** Which colourway it is painted. Nought is the one the room shipped in. */
  readonly look: number;
  /**
   * Which way round it was put down. Absent means facing the camera, which
   * is the way every piece was drawn before any of them could turn.
   *
   * A separate fact from `look`, and it has to be: a colour belongs to the
   * *item* — a child who bought a green chair owns a green chair, and the
   * basket counts them apart — where a way round belongs to the placing. A
   * basket that told a chair turned left from a chair turned right would
   * make a child hunt through four entries for the one they wanted.
   */
  readonly turn?: number;
}

/** How many cells a piece covers, from the art it is drawn as. */
export type Footprints = Readonly<Record<string, { cols: number; rows: number }>>;

export function footprintsOf(sidecar: GrowableSidecar): Footprints {
  const sizes: Record<string, { cols: number; rows: number }> = {};
  // Read off `pieces` rather than off the shipped arrangement. A bath is a
  // thing the shop sells and the room does not start with, so a size taken
  // from what is standing in the room would be no size at all — and a piece
  // with no footprint is a piece that cannot be put down.
  for (const [name, piece] of Object.entries(sidecar.pieces)) {
    const decor = decorFor(name);
    if (!decor) continue;
    sizes[decor] = { cols: piece.footprint[0], rows: piece.footprint[1] };
  }
  return sizes;
}

/**
 * The arrangement a house starts with: the one the generator drew.
 *
 * Everything in it but the hearth, which is structural — see the note at the
 * top. Its cells are the sidecar's own, so a house nobody has rearranged
 * looks exactly as it always has.
 */
export function startingDecor(sidecar: GrowableSidecar): Placed[] {
  const placed: Placed[] = [];
  for (const piece of sidecar.furniture) {
    const decor = decorFor(piece.name);
    if (!decor) continue;
    const [row, col] = piece.cell;
    // Facing the camera, said out loud rather than left off. Everything in
    // a shipped room was drawn one way round, and a `Placed` that came from
    // the sidecar should have the same shape as one that came back from a
    // save — two shapes for the same thing is how a round-trip test starts
    // comparing a chair against itself and failing.
    placed.push({ piece: decor, col, row, look: 0, turn: Turn.Toward });
  }
  return placed;
}

export function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

/** Every cell one piece covers, top-left first, whichever way it is round. */
export function cellsUnder(placed: Placed, footprints: Footprints): GridPoint[] {
  const size = sizeOf(placed.piece, turnOf(placed), footprints);
  const cells: GridPoint[] = [];
  for (let dr = 0; dr < size.rows; dr++) {
    for (let dc = 0; dc < size.cols; dc++) {
      cells.push({ col: placed.col + dc, row: placed.row + dr });
    }
  }
  return cells;
}

/**
 * Every cell in the room that something is standing on.
 *
 * The rule the minus spell reads before it takes a floor square up, and the
 * reason it has to be worked out from *this* arrangement rather than from
 * the sidecar: a bed that has been moved protects the cells it is on now,
 * and a sidecar reading would protect the corner it used to be in.
 */
export function occupiedCells(decor: readonly Placed[], footprints: Footprints): Set<string> {
  const taken = new Set<string>();
  for (const placed of decor) {
    for (const at of cellsUnder(placed, footprints)) taken.add(cellKey(at.col, at.row));
  }
  return taken;
}

/** Whatever is standing on this cell, or nothing. */
export function pieceOn(
  decor: readonly Placed[],
  at: GridPoint,
  footprints: Footprints,
): Placed | null {
  for (const placed of decor) {
    for (const cell of cellsUnder(placed, footprints)) {
      if (cell.col === at.col && cell.row === at.row) return placed;
    }
  }
  return null;
}

/**
 * Where a piece goes when somebody standing here puts it down.
 *
 * Not simply the tile she is facing, which is what this used to be and is
 * only right for the things that are one cell big. A piece is drawn from its
 * top-left corner and grows right and down, so a rug two cells square,
 * anchored on the tile in front of her, covers the tile in front *and the
 * one she is standing on* — every time she faces up or left. She cannot
 * stand on her own rug, so it was refused, and the report was exactly that:
 * the carpet will not go above or to the left of me.
 *
 * So the anchor is shifted back by the piece's own size on the two sides
 * where it would otherwise grow towards her. The rule underneath is the one
 * a person would say out loud: whatever its size, a thing put down lies in
 * front of you, starting at the square you are facing and going away.
 */
export function anchorFor(
  piece: DecorType,
  ahead: GridPoint,
  facing: Facing,
  footprints: Footprints,
  turn: number = Turn.Toward,
): GridPoint {
  // The way round it is being put down, not the way it was drawn. A bed
  // turned to lie across the room grows two cells to the *right* of the
  // square she is facing rather than two below it, and anchoring it by the
  // untuned footprint put it a square out — which reads as the game deciding
  // where the furniture goes, the one thing this feature takes back from it.
  const size = sizeOf(piece, turn, footprints);
  return {
    col: facing === "left" ? ahead.col - (size.cols - 1) : ahead.col,
    row: facing === "up" ? ahead.row - (size.rows - 1) : ahead.row,
  };
}

/**
 * Whether a piece would stand here: on floor, on nothing else, inside the room.
 *
 * `floor` is asked rather than handed a plan, because the caller has one and
 * this module deliberately does not — where the floor is is the room's
 * business and what is standing on it is this one's.
 */
export function fits(
  placed: Placed,
  decor: readonly Placed[],
  footprints: Footprints,
  floor: (col: number, row: number) => boolean,
): boolean {
  // Everything but this piece itself: moving a thing is picking it up and
  // putting it down, so it must not be blocked by where it already is.
  const taken = occupiedCells(
    decor.filter((other) => !same(other, placed)),
    footprints,
  );
  for (const at of cellsUnder(placed, footprints)) {
    if (!floor(at.col, at.row)) return false;
    if (taken.has(cellKey(at.col, at.row))) return false;
  }
  return true;
}

/** Whether two entries describe the same thing standing in the same spot. */
export function same(one: Placed, other: Placed): boolean {
  return (
    one.piece === other.piece &&
    one.col === other.col &&
    one.row === other.row &&
    one.look === other.look &&
    turnOf(one) === turnOf(other)
  );
}

/**
 * Which way round a piece is standing, however it was written down.
 *
 * Every save written before furniture could turn has no turn on it, and
 * everything in one of those is facing the way it was drawn — which is the
 * way the single drawing there used to be faced.
 */
export function turnOf(placed: Placed): number {
  return turnFrom(placed.turn);
}

/**
 * The arrangement with one thing taken out of it.
 *
 * Matched by *what and where* rather than by identity, and that is not a
 * nicety. A room nobody has rearranged has no stored arrangement, so it is
 * rebuilt from the sidecar every time it is asked for — and a chair a sprite
 * captured a moment ago is a different object from the chair in the array
 * that came back this time. Compared by reference, picking a chair up put
 * one in the basket and left the chair standing, and putting it down again
 * gave the room two.
 */
export function without(decor: readonly Placed[], taken: Placed): Placed[] {
  return decor.filter((one) => !same(one, taken));
}

/** What a save writes down, and what it reads back. */
export function decorToSave(decor: readonly Placed[]): string[] {
  return decor.map(
    (placed) => `${placed.piece},${placed.col},${placed.row},${placed.look},${turnOf(placed)}`,
  );
}

/**
 * Read an arrangement back, dropping anything mangled.
 *
 * A bad entry is dropped rather than repaired: what a child loses is one
 * chair, and what they keep is a room. A chair repaired into something
 * plausible would be a chair standing where nobody put it.
 */
export function decorFromSave(saved: unknown): Placed[] {
  if (!Array.isArray(saved)) return [];
  const placed: Placed[] = [];
  for (const entry of saved) {
    if (typeof entry !== "string") continue;
    const [piece, col, row, look, turn] = entry.split(",");
    const known = DECOR_TYPES.find((one) => one === piece);
    if (!known || col === undefined || row === undefined) continue;
    if (!/^-?\d+$/.test(col) || !/^-?\d+$/.test(row)) continue;
    // A save from before anything could be repainted has no colour on it,
    // and everything in it is the colour the room shipped in. A save from
    // before anything could be turned has no turn on it, and the same
    // applies: it faces the way it was drawn.
    placed.push({
      piece: known,
      col: Number(col),
      row: Number(row),
      look: look !== undefined && /^\d+$/.test(look) ? Number(look) : 0,
      turn: turn !== undefined && /^\d+$/.test(turn) ? turnFrom(Number(turn)) : Turn.Toward,
    });
  }
  return placed;
}

/**
 * Where the fire is in this room, or nothing if nobody has put one down.
 *
 * Read off the arrangement, which it did not used to be: a fireplace was
 * built into the wall, so the sidecar's own placement was the answer for
 * ever. A stove is furniture — it can be carried across the room, or out of
 * it — so the fire is wherever the stove is standing now, and there may not
 * be one at all.
 */
export function fireCells(decor: readonly Placed[], footprints: Footprints): Set<string> {
  return occupiedCells(
    decor.filter((piece) => piece.piece === DecorType.Stove),
    footprints,
  );
}

/**
 * Every cell the minus spell must not take the floor from under.
 *
 * The arrangement as it stands, never the sidecar's: a bed that has been
 * moved protects the cells it is on *now*, and reading the shipped
 * placements would go on protecting the corner it used to be in while the
 * floor under the bed came up.
 *
 * The stove needs no special mention any more: it is in the arrangement like
 * everything else. What is still not is whoever is standing in the room,
 * because a child who pulled the floor out from under herself would be
 * standing in a wall.
 */
export function protectedCells(
  sidecar: GrowableSidecar,
  decor: readonly Placed[],
  standing?: GridPoint,
): Set<string> {
  const taken = occupiedCells(decor, footprintsOf(sidecar));
  if (standing) taken.add(cellKey(standing.col, standing.row));
  return taken;
}

/**
 * Whether a piece stands in the way, or is walked over.
 *
 * Read off `pieces` rather than off `furniture`, and the difference is a bug
 * that shipped. `furniture` is only the arrangement the room *starts* with,
 * so asking it whether a thing blocks answered "no" for everything the room
 * does not already contain — which, since the shop started selling a kitchen
 * and a washroom, meant a child could walk through her own bath.
 *
 * A piece nobody has heard of blocks. Drawn as a wall it is a bug somebody
 * trips over on the first tap; drawn as a hole in the furniture it is the
 * one that had to be found by hand.
 */
export function pieceBlocks(sidecar: GrowableSidecar, piece: DecorType): boolean {
  return sidecar.pieces[pieceArt(piece)]?.blocks ?? true;
}

/**
 * The cells a thing being put down has to keep off.
 *
 * Everything already standing in the room, always — and the child herself
 * only when what she is holding would stand in her way. A rug is walked
 * over, so it goes *under her feet* and she is no obstacle to it; a bath is
 * not, so putting one down on her own square would be standing in it.
 *
 * The distinction is the piece's own, not the placer's: `protectedCells`
 * answers a different question — what the minus spell must not take the
 * floor from under — and there she counts whatever she is carrying, because
 * a child who pulled the boards out from beneath herself would be standing
 * in a wall.
 */
export function inTheWayOf(
  sidecar: GrowableSidecar,
  piece: DecorType,
  decor: readonly Placed[],
  standing: GridPoint,
): Set<string> {
  return protectedCells(sidecar, decor, pieceBlocks(sidecar, piece) ? standing : undefined);
}

/**
 * What stands in the *way*, which is a different question.
 *
 * A rug is walked over and still keeps its floor from the minus spell — see
 * `protectedCells` for the other half. Whether a piece blocks is a fact
 * about the art, so it is read from the sidecar rather than decided here.
 *
 * Built from the arrangement rather than the sidecar's placements because
 * the grid is made afresh every time a square of floor is laid or taken up:
 * furniture the grid was never told about is furniture the next cast wipes.
 */
export function blockersFor(sidecar: GrowableSidecar, decor: readonly Placed[]): RoomBlocker[] {
  const sizes = footprintsOf(sidecar);
  const standing = decor.map((placed) => {
    const size = sizes[placed.piece] ?? { cols: 1, rows: 1 };
    return {
      cell: [placed.row, placed.col] as const,
      footprint: [size.cols, size.rows] as const,
      blocks: pieceBlocks(sidecar, placed.piece),
    };
  });
  // No separate list for the fire any more. A fireplace was built into the
  // wall, so it blocked a cell the arrangement never mentioned; a stove is
  // in the arrangement like the bed and the chair, and blocks where it
  // stands rather than where it was first put.
  return standing;
}

/**
 * How a house is furnished: what somebody arranged, or what it shipped as.
 *
 * The fallback is the reason `same` compares by value rather than by
 * identity — a room nobody has rearranged is rebuilt here on every read, so
 * the chair a caller is holding is never the chair that comes back.
 *
 * **Nothing is repaired here.** It used to put a stove back into any
 * arrangement that had none, which is right for a room saved before the fire
 * was furniture and catastrophic on every other read: this is called on
 * every repaint, and picking the oven up is precisely an arrangement with no
 * stove in it. So the oven went into the basket, a new one appeared in the
 * corner it shipped in, and a child could tap out as many stoves as she
 * liked. A repair belongs where a save is read, once — see `hearthRestored`.
 */
export function arrangementIn(
  stored: readonly Placed[] | undefined,
  sidecar: GrowableSidecar | null,
): Placed[] {
  if (!stored) return sidecar ? startingDecor(sidecar) : [];
  return [...stored];
}

/**
 * A room out of a save too old to know where its fire is, with one put back.
 *
 * For exactly one moment: the save being read off the disk, and only when it
 * was written before `HEARTH_IS_FURNITURE`. Back then a fireplace was part of
 * the wall, so a room from then has no stove written in it and would come
 * back dark for ever with nothing on screen to say why.
 *
 * It goes where the room shipped it — unless something has since been stood
 * there, in which case it is left out, because a stove standing in the bed
 * would be a worse repair than the fault.
 */
export function hearthRestored(
  stored: readonly Placed[],
  sidecar: GrowableSidecar | null,
): Placed[] {
  const arranged = [...stored];
  if (arranged.some((piece) => piece.piece === DecorType.Stove)) return arranged;
  const fire = sidecar
    ? startingDecor(sidecar).find((p) => p.piece === DecorType.Stove)
    : undefined;
  if (!fire) return arranged;
  const sizes = sidecar ? footprintsOf(sidecar) : {};
  if (fits(fire, arranged, sizes, () => true)) arranged.push(fire);
  return arranged;
}

/**
 * What one square of house costs, and what it hands back.
 *
 * A plank and a stone, and the point of it is that both come from the
 * *clearing* spell: subtraction is the spell this game under-uses, and a
 * child who wants a bigger house now has a reason to go and take a tree out
 * of the ground.
 *
 * One list for the price and the refund, and that is the whole of why it is
 * a constant rather than two: taking a square back up hands back exactly
 * what it took to lay, and a refund that did not match the cost would make
 * the minus spell either a penalty or a way of printing planks.
 */
export const ROOM_COST: readonly (readonly [MaterialType, number])[] = [
  [MaterialType.Wood, 1],
  [MaterialType.Stone, 1],
];

/**
 * How many squares of floor a basket will pay for.
 *
 * The *fewest* any one material allows, not the total: a child with ten
 * planks and one stone can build one room, and adding the two up would offer
 * them eleven and charge for a stone they have not got.
 */
export function roomsAfforded(held: (item: MaterialType) => number): number {
  return ROOM_COST.reduce(
    (fewest, [item, each]) => Math.min(fewest, Math.floor(held(item) / each)),
    Number.POSITIVE_INFINITY,
  );
}

/**
 * The recolour plan that paints a piece of furniture a colourway.
 *
 * Wood and cloth in one plan, because a colourway paints both together — a
 * green chair has a green blanket on it. Empty when there is nothing to do,
 * which is what makes colourway nought free: it is the paint already on the
 * art, and `repaintedSheet` hands the original straight back for an empty
 * plan rather than copying a sheet to change nothing.
 */
export function colourPlanFor(
  palette: Readonly<Record<string, readonly [number, number, number]>> | undefined,
  colourway:
    | {
        wood: readonly (readonly [number, number, number])[];
        fabric: readonly (readonly [number, number, number])[];
      }
    | undefined,
): Map<number, number> {
  const plan = new Map<number, number>();
  if (!palette || !colourway) return plan;
  const ramp = (slots: readonly string[]) =>
    slots.map((slot) => palette[slot]).filter((tone): tone is Rgb => tone !== undefined);
  rampPlan(ramp(WOOD_SLOTS), colourway.wood as Rgb[], plan);
  rampPlan(ramp(FABRIC_SLOTS), colourway.fabric as Rgb[], plan);
  return plan;
}

/** The three tones a piece's timber is drawn in, and its cloth. */
const WOOD_SLOTS = ["wood_dark", "wood", "wood_light"] as const;
