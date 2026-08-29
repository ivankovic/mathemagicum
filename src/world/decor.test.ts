// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import {
  DECOR_ITEMS,
  DECOR_LOOKS,
  DECOR_TYPES,
  DecorType,
  type Placed,
  ROOM_COST,
  anchorFor,
  arrangementIn,
  blockersFor,
  canTurnPiece,
  cellsUnder,
  colourPlanFor,
  decorFor,
  decorFromSave,
  decorItem,
  decorToSave,
  fireCells,
  fits,
  hearthRestored,
  inTheWayOf,
  itemParts,
  occupiedCells,
  pieceArt,
  pieceBlocks,
  pieceOn,
  protectedCells,
  roomsAfforded,
  same,
  sizeOf,
  takesAColour,
  turnsOfPiece,
  without,
} from "./decor";
import { TURNS, TURNS_DRAWN, Turn } from "./facing";
import { MaterialType } from "./materials";
import type { GrowableSidecar } from "./spriteSidecar";

const SIZES = {
  [DecorType.Bed]: { cols: 1, rows: 2 },
  [DecorType.Table]: { cols: 2, rows: 1 },
  [DecorType.Chair]: { cols: 1, rows: 1 },
  [DecorType.Rug]: { cols: 2, rows: 2 },
  [DecorType.Bookshelf]: { cols: 1, rows: 1 },
};
const anywhere = () => true;

describe("what a room is furnished with", () => {
  // The store already sells a `table`, which is a one-cell garden table
  // against a two-cell one indoors. Two pieces of furniture that happen to
  // share an English word, and an item type is a key rather than a label.
  test("the indoor table does not collide with the one in the garden", () => {
    expect(DecorType.Table).not.toBe("table");
    expect(pieceArt(DecorType.Table)).toBe("table");
    expect(decorFor("table")).toBe(DecorType.Table);
    expect(new Set(DECOR_TYPES).size).toBe(DECOR_TYPES.length);
  });

  /**
   * The hearth is not furniture.
   *
   * It is the eight animated frames the room ships for, and it is what
   * lights the house's windows from the road at dusk — `hearthCell` coming
   * back empty is what makes `windowsOf` skip a building. A child who could
   * carry the fire out would put the lights out in their own house, at
   * night, with nothing on screen to say why.
   */
  test("and the fireplace is not one of the things you can carry", () => {
    expect(decorFor("fireplace")).toBeNull();
    expect(DECOR_TYPES).not.toContain("fireplace" as never);
  });

  test("a piece covers every cell of its own footprint", () => {
    const bed: Placed = { piece: DecorType.Bed, col: 1, row: 2, look: 0 };
    expect(cellsUnder(bed, SIZES).map((c) => `${c.col},${c.row}`)).toEqual(["1,2", "1,3"]);
    const rug: Placed = { piece: DecorType.Rug, col: 3, row: 3, look: 0 };
    expect(cellsUnder(rug, SIZES).length).toBe(4);
  });
});

describe("what is standing where", () => {
  const room: Placed[] = [
    { piece: DecorType.Bed, col: 1, row: 2, look: 0 },
    { piece: DecorType.Table, col: 5, row: 2, look: 0 },
  ];

  /**
   * The rule the minus spell reads before it takes a floor square up.
   *
   * Worked out from *this* arrangement rather than from the sidecar: a bed
   * that has been moved protects the cells it is on now, and a sidecar
   * reading would go on protecting the corner it used to be in — which is
   * the one rule about all this that was asked for explicitly.
   */
  test("every cell under every piece is spoken for", () => {
    const taken = occupiedCells(room, SIZES);
    expect([...taken].sort()).toEqual(["1,2", "1,3", "5,2", "6,2"]);
  });

  test("and it follows a piece when it moves", () => {
    const moved = [
      ...without(room, room[0] as Placed),
      { piece: DecorType.Bed, col: 4, row: 4, look: 0 },
    ];
    const taken = occupiedCells(moved, SIZES);
    expect(taken.has("1,2")).toBe(false);
    expect(taken.has("4,4")).toBe(true);
    expect(taken.has("4,5")).toBe(true);
  });

  test("tapping any cell of a piece finds the piece", () => {
    expect(pieceOn(room, { col: 1, row: 3 }, SIZES)?.piece).toBe(DecorType.Bed);
    expect(pieceOn(room, { col: 6, row: 2 }, SIZES)?.piece).toBe(DecorType.Table);
    expect(pieceOn(room, { col: 9, row: 9 }, SIZES)).toBeNull();
  });
});

describe("putting something down", () => {
  const room: Placed[] = [{ piece: DecorType.Bed, col: 1, row: 2, look: 0 }];

  test("it goes on empty floor", () => {
    const chair: Placed = { piece: DecorType.Chair, col: 3, row: 3, look: 0 };
    expect(fits(chair, room, SIZES, anywhere)).toBe(true);
  });

  test("not on top of something else, at any cell of it", () => {
    for (const row of [2, 3]) {
      const chair: Placed = { piece: DecorType.Chair, col: 1, row, look: 0 };
      expect({ row, fits: fits(chair, room, SIZES, anywhere) }).toEqual({ row, fits: false });
    }
  });

  // Every cell of the footprint, not only its corner: a two-by-two rug whose
  // top-left is clear can still have its far side over the bed.
  test("and every cell of its own footprint has to be clear", () => {
    const rug: Placed = { piece: DecorType.Rug, col: 0, row: 1, look: 0 };
    expect(fits(rug, room, SIZES, anywhere)).toBe(false);
  });

  test("and all of it has to be on floor", () => {
    const floor = (col: number, row: number) => col >= 0 && col < 3 && row >= 0 && row < 3;
    expect(fits({ piece: DecorType.Chair, col: 2, row: 2, look: 0 }, [], SIZES, floor)).toBe(true);
    expect(fits({ piece: DecorType.Chair, col: 3, row: 2, look: 0 }, [], SIZES, floor)).toBe(false);
    // The rug's corner is on floor and its far side is not.
    expect(fits({ piece: DecorType.Rug, col: 2, row: 2, look: 0 }, [], SIZES, floor)).toBe(false);
  });

  // Moving a thing is picking it up and putting it down, so a piece must not
  // be blocked by where it already is.
  test("a piece does not block itself", () => {
    const bed = room[0] as Placed;
    expect(fits(bed, room, SIZES, anywhere)).toBe(true);
  });

  /**
   * Matched by what and where, never by identity.
   *
   * A room nobody has rearranged has no stored arrangement, so it is rebuilt
   * from the sidecar every time it is asked for — and a chair a sprite
   * captured a moment ago is a different object from the chair that comes
   * back this time. Compared by reference, picking a chair up put one in the
   * basket and left the chair standing, and putting it back gave the room
   * two chairs.
   */
  test("and an equal copy is the same piece, not a second one", () => {
    const bed = room[0] as Placed;
    const copy: Placed = { piece: bed.piece, col: bed.col, row: bed.row, look: bed.look };
    expect(copy).not.toBe(bed);
    expect(same(copy, bed)).toBe(true);
    expect(without(room, copy)).toEqual([]);
    expect(fits(copy, room, SIZES, anywhere)).toBe(true);
  });
});

describe("what a save remembers", () => {
  test("an arrangement survives the round trip", () => {
    const room: Placed[] = [
      { piece: DecorType.Bed, col: 1, row: 2, look: 0, turn: Turn.Toward },
      { piece: DecorType.Rug, col: -3, row: -4, look: 0, turn: Turn.Toward },
    ];
    expect(decorFromSave(JSON.parse(JSON.stringify(decorToSave(room))))).toEqual(room);
  });

  /**
   * And which way round it was standing.
   *
   * This is the half a save is most likely to drop, because it is the half
   * that is easy to forget: everything about a chair that a room *draws*
   * comes back without it, so a turn that went missing looks like a chair
   * that quietly untwisted itself overnight rather than like a broken save.
   */
  test("and so does which way round each thing was", () => {
    const room: Placed[] = TURNS.map((turn) => ({
      piece: DecorType.Chair,
      col: turn,
      row: 0,
      look: 1,
      turn,
    }));
    expect(decorFromSave(decorToSave(room))).toEqual(room);
  });

  /**
   * A turn is *part of* what makes two entries the same thing.
   *
   * Not a nicety: a room nobody has rearranged has no stored arrangement and
   * is rebuilt from the sidecar, so a change only counts as a change if
   * `same` can see it. A chair turned and put back in the spot it came from
   * would otherwise compare equal to the chair that was there, register as
   * no difference at all, and never be written down.
   */
  test("and a chair turned round is not the chair that was there", () => {
    const facing: Placed = { piece: DecorType.Chair, col: 2, row: 2, look: 0, turn: Turn.Toward };
    const turned: Placed = { ...facing, turn: Turn.Side };
    expect(same(facing, turned)).toBe(false);
    expect(without([facing], turned)).toEqual([facing]);
    // But a save from before any of this compares equal to one facing the
    // way everything used to, or every old room would rewrite itself.
    const { turn: _dropped, ...old } = facing;
    expect(same(old as Placed, facing)).toBe(true);
  });

  // One mangled chair must not cost a child the room it stands in.
  test("and anything mangled is dropped rather than repaired", () => {
    expect(decorFromSave(["bed,1,2,0", "nonsense", "chair,x,4", "rug,1", 7, null])).toEqual([
      { piece: DecorType.Bed, col: 1, row: 2, look: 0, turn: Turn.Toward },
    ]);
    expect(decorFromSave(undefined)).toEqual([]);
    expect(decorFromSave("bed,1,2")).toEqual([]);
  });
});

describe("a piece in a colour", () => {
  /**
   * The colour belongs to the *item*, not to where it was put down.
   *
   * That falls out of the shop being two taps — pick a chair, pick a colour
   * — because a child who has bought a green chair owns a green chair, and a
   * basket that only knew "three chairs" would have to ask again every time
   * one went down.
   */
  test("a basket entry names the piece and the colour", () => {
    expect(decorItem(DecorType.Chair, 3)).toBe("chair~3");
    expect(itemParts("chair~3")).toEqual({ piece: DecorType.Chair, look: 3 });
    // The indoor table keeps its suffix and still round-trips.
    expect(itemParts(decorItem(DecorType.Table, 0))).toEqual({
      piece: DecorType.Table,
      look: 0,
    });
  });

  test("and nothing else does", () => {
    for (const junk of ["chair", "chair~", "chair~x", "~2", "fence~1", "chair~2~3", ""]) {
      expect({ junk, parts: itemParts(junk) }).toEqual({ junk, parts: null });
    }
  });

  test("a colour is never negative and never a fraction", () => {
    expect(decorItem(DecorType.Rug, -4)).toBe("rug~0");
    expect(decorItem(DecorType.Rug, 2.7)).toBe("rug~2");
  });

  // The basket has to enumerate every kind of thing it can hold in a stable
  // order, and cannot ask an asset that has not loaded yet.
  test("every piece in every colour is a thing a basket can hold", () => {
    expect(DECOR_ITEMS.length).toBe(DECOR_TYPES.length * DECOR_LOOKS);
    expect(new Set(DECOR_ITEMS).size).toBe(DECOR_ITEMS.length);
    for (const item of DECOR_ITEMS) expect(itemParts(item)).not.toBeNull();
  });

  // Nought is the room as it shipped. A house nobody has redecorated has to
  // look exactly as it always has, and that is the whole of why.
  test("the same piece in two colours is two different things", () => {
    const red: Placed = { piece: DecorType.Rug, col: 1, row: 1, look: 0 };
    const blue: Placed = { piece: DecorType.Rug, col: 1, row: 1, look: 3 };
    expect(same(red, blue)).toBe(false);
    expect(without([red, blue], red)).toEqual([blue]);
  });

  test("and the colour survives a save", () => {
    const room: Placed[] = [{ piece: DecorType.Chair, col: 2, row: 4, look: 3, turn: Turn.Toward }];
    expect(decorFromSave(decorToSave(room))).toEqual(room);
  });

  /**
   * A save from before anything could be repainted has no colour on it, and
   * everything in it is the colour the room shipped in.
   */
  test("and a save from before colours reads as the room's own", () => {
    expect(decorFromSave(["bed,1,2"])).toEqual([
      { piece: DecorType.Bed, col: 1, row: 2, look: 0, turn: Turn.Toward },
    ]);
  });
});

describe("what a room protects and what it blocks", () => {
  // A stand-in for the shipped sidecar: the pieces, their sizes, whether they
  // block, and the one that is a fire.
  const sidecar = {
    furniture: [
      {
        name: "stove",
        cell: [1, 1],
        footprint: [1, 1],
        blocks: true,
        animated: true,
        light: "fire",
      },
      {
        name: "bookshelf",
        cell: [1, 6],
        footprint: [1, 1],
        blocks: true,
        animated: false,
        light: null,
      },
      { name: "bed", cell: [2, 1], footprint: [1, 2], blocks: true, animated: false, light: null },
      { name: "rug", cell: [3, 3], footprint: [2, 2], blocks: false, animated: false, light: null },
    ],
    // What there is art for, which is where sizes are read from. The same
    // four here, because this room's shop sells nothing it does not already
    // contain — the shipped one sells six more.
    pieces: {
      stove: { footprint: [1, 1], blocks: true, animated: true, light: "fire" },
      bookshelf: { footprint: [1, 1], blocks: true, animated: false, light: null },
      bed: { footprint: [1, 2], blocks: true, animated: false, light: null },
      rug: { footprint: [2, 2], blocks: false, animated: false, light: null },
      // In the table and not in the arrangement, which is the shape every
      // piece the shop added has: a cottage does not ship with a bath.
      bath: { footprint: [2, 1], blocks: true, animated: false, light: null },
    },
  } as unknown as GrowableSidecar;

  // The fire used to be a fact about the *sidecar*: a fireplace was built
  // into the wall, so where it stood was settled for ever. A stove is
  // furniture, so the fire is wherever it has been put — and there may be no
  // fire at all, which a room with a fireplace could never manage.
  test("the fire is wherever the stove has been put down", () => {
    const stove: Placed = { piece: DecorType.Stove, col: 4, row: 2, look: 0 };
    const sizes = { [DecorType.Stove]: { cols: 1, rows: 1 } };
    expect([...fireCells([stove], sizes)].sort()).toEqual(["4,2"]);
  });

  test("and a room with no stove in it has no fire", () => {
    const chair: Placed = { piece: DecorType.Chair, col: 4, row: 2, look: 0 };
    expect([...fireCells([chair], { [DecorType.Chair]: { cols: 1, rows: 1 } })]).toEqual([]);
    expect([...fireCells([], {})]).toEqual([]);
  });

  /**
   * Two different questions about one square.
   *
   * "May I stand here" and "may I take this up" differ for exactly one piece
   * — a rug is walked over and still keeps its floor — and the two answers
   * live in two functions so that neither can quietly start answering the
   * other.
   */
  test("a rug is protected from the minus spell and does not block the way", () => {
    const rug: Placed = { piece: DecorType.Rug, col: 3, row: 3, look: 0 };
    expect(protectedCells(sidecar, [rug]).has("3,3")).toBe(true);
    const rugBlocker = blockersFor(sidecar, [rug]).find((b) => b.cell[0] === 3);
    expect(rugBlocker?.blocks).toBe(false);
  });

  test("and a bed is protected and does block", () => {
    const bed: Placed = { piece: DecorType.Bed, col: 1, row: 2, look: 0 };
    const guarded = protectedCells(sidecar, [bed]);
    expect(guarded.has("1,2")).toBe(true);
    expect(guarded.has("1,3")).toBe(true);
    expect(blockersFor(sidecar, [bed])[0]?.blocks).toBe(true);
  });

  // The rule that was asked for out loud, and the one that breaks silently:
  // a moved bed protects where it is now, not where the sidecar left it.
  test("what is protected follows a piece when it is moved", () => {
    const moved: Placed = { piece: DecorType.Bed, col: 5, row: 4, look: 0 };
    const guarded = protectedCells(sidecar, [moved]);
    expect(guarded.has("5,4")).toBe(true);
    expect(guarded.has("5,5")).toBe(true);
    // The corner the sidecar put it in is free again.
    expect(guarded.has("1,2")).toBe(false);
  });

  // The fire is furniture now, so it guards and blocks the square it is
  // standing on — not the one it was built into, which is what a fireplace
  // did and could never stop doing.
  test("the stove protects and blocks wherever it has been carried to", () => {
    const stove: Placed = { piece: DecorType.Stove, col: 4, row: 4, look: 0 };
    const guarded = protectedCells(sidecar, [stove]);
    expect(guarded.has("4,4")).toBe(true);
    const fire = blockersFor(sidecar, [stove]).find((b) => b.cell[0] === 4 && b.cell[1] === 4);
    expect(fire?.blocks).toBe(true);
  });

  test("and a room it has been carried out of guards nothing for it", () => {
    const guarded = protectedCells(sidecar, []);
    expect(guarded.has("1,1")).toBe(false);
    expect(blockersFor(sidecar, [])).toEqual([]);
  });

  test("and whoever is standing in the room keeps the floor under her feet", () => {
    const guarded = protectedCells(sidecar, [], { col: 4, row: 2 });
    expect(guarded.has("4,2")).toBe(true);
    expect(protectedCells(sidecar, []).has("4,2")).toBe(false);
  });

  /**
   * A thing the room does not ship with still blocks.
   *
   * Whether a piece stands in the way used to be read off the arrangement,
   * which held for exactly as long as the shop sold nothing new. It sells a
   * kitchen and a washroom now, and none of that is in any cottage's opening
   * furniture — so every one of them was walked straight through.
   */
  test("a piece the room never shipped with blocks the way all the same", () => {
    const bath: Placed = { piece: DecorType.Bath, col: 2, row: 5, look: 0 };
    expect(sidecar.furniture.some((piece) => piece.name === "bath")).toBe(false);
    expect(blockersFor(sidecar, [bath])[0]?.blocks).toBe(true);
    expect(pieceBlocks(sidecar, DecorType.Bath)).toBe(true);
    expect(pieceBlocks(sidecar, DecorType.Rug)).toBe(false);
  });

  /**
   * And the other half of the same fact: what may go under her feet.
   *
   * A child asking for a carpet on the square she is standing on is asking
   * for it to go *under* her, which is what a carpet is for. A bath on that
   * square would be a bath she is standing in.
   */
  test("a rug goes under her feet and a bath does not", () => {
    const her = { col: 4, row: 2 };
    expect(inTheWayOf(sidecar, DecorType.Rug, [], her).has("4,2")).toBe(false);
    expect(inTheWayOf(sidecar, DecorType.Bath, [], her).has("4,2")).toBe(true);
  });

  // Whichever she is holding, the furniture is still in the way of it.
  test("but neither goes on top of the bed", () => {
    const bed: Placed = { piece: DecorType.Bed, col: 1, row: 2, look: 0 };
    for (const piece of [DecorType.Rug, DecorType.Bath]) {
      const taken = inTheWayOf(sidecar, piece, [bed], { col: 4, row: 2 });
      expect(taken.has("1,2")).toBe(true);
      expect(taken.has("1,3")).toBe(true);
    }
  });

  /**
   * A room nobody has rearranged is rebuilt from the sidecar every read.
   *
   * That fallback is the reason `same` compares by value: the chair a caller
   * is holding is never the chair that comes back.
   */
  test("an untouched room is the room the generator drew, freshly each time", () => {
    const once = arrangementIn(undefined, sidecar);
    const twice = arrangementIn(undefined, sidecar);
    expect(once).toEqual(twice);
    expect(once[0]).not.toBe(twice[0]);
    // The fire *is* in it now: a stove is furniture, so it is arranged with
    // everything else rather than built into the wall behind it.
    expect(once.some((p) => p.piece === DecorType.Stove)).toBe(true);
  });

  test("and a room somebody arranged is theirs, sidecar or no sidecar", () => {
    const mine: Placed[] = [
      { piece: DecorType.Chair, col: 9, row: 9, look: 4 },
      { piece: DecorType.Stove, col: 8, row: 8, look: 0 },
    ];
    expect(arrangementIn(mine, sidecar)).toEqual(mine);
    expect(arrangementIn(undefined, null)).toEqual([]);
  });

  /**
   * The bug this pair of functions exists to keep apart, said as a test.
   *
   * Reading a room used to put a stove back into any arrangement that had
   * none. That is right for a save written before the fire was furniture and
   * ruinous everywhere else, because "an arrangement with no stove in it" is
   * also exactly what picking the oven up produces — and reading happens on
   * every repaint. The oven went into the basket, a new one grew in the
   * corner it shipped in, and a child could tap out as many as she liked.
   *
   * So reading repairs nothing, ever. If this assertion is ever softened,
   * the stove duplicates again.
   */
  test("reading a room back never conjures a stove into it", () => {
    const carriedOff: Placed[] = [{ piece: DecorType.Chair, col: 4, row: 4, look: 0 }];
    expect(arrangementIn(carriedOff, sidecar)).toEqual(carriedOff);
    // Twice, because the fault was that every read added one: a repair that
    // ran on the way in and nowhere else would pass a single call.
    const read = arrangementIn(arrangementIn(carriedOff, sidecar), sidecar);
    expect(read.filter((piece) => piece.piece === DecorType.Stove)).toEqual([]);
    // And an empty room stays empty rather than lighting itself.
    expect(arrangementIn([], sidecar)).toEqual([]);
  });

  /**
   * The repair itself, which now happens once, where a save is read.
   *
   * A room saved before the fire was furniture has no stove written in it,
   * and left alone a child coming back to a house they had already
   * rearranged would find it dark for ever with nothing on screen to say
   * why.
   */
  test("but a room saved before there was a stove gets its fire back", () => {
    const old: Placed[] = [{ piece: DecorType.Chair, col: 4, row: 4, look: 0 }];
    const mended = hearthRestored(old, sidecar);
    expect(mended.filter((p) => p.piece === DecorType.Stove)).toEqual([
      { piece: DecorType.Stove, col: 1, row: 1, look: 0, turn: Turn.Toward },
    ]);
    // And what she had arranged is untouched.
    expect(mended).toEqual(expect.arrayContaining(old));
  });

  test("never on top of something she has since put there", () => {
    const old: Placed[] = [{ piece: DecorType.Bed, col: 1, row: 1, look: 0 }];
    expect(hearthRestored(old, sidecar).some((p) => p.piece === DecorType.Stove)).toBe(false);
  });

  test("and a room that already has one is left exactly as it is", () => {
    const mine: Placed[] = [{ piece: DecorType.Stove, col: 5, row: 5, look: 2 }];
    expect(hearthRestored(mine, sidecar)).toEqual(mine);
  });

  // Even the repair only ever adds one. Run twice — which is what a reload
  // of a reload is — it must not stack fires in the corner.
  test("and repairing a room twice does not give it two fires", () => {
    const old: Placed[] = [{ piece: DecorType.Chair, col: 4, row: 4, look: 0 }];
    const twice = hearthRestored(hearthRestored(old, sidecar), sidecar);
    expect(twice.filter((piece) => piece.piece === DecorType.Stove)).toHaveLength(1);
  });
});

describe("what a room costs", () => {
  /**
   * One list for the price and the refund.
   *
   * Taking a square back up hands back exactly what it took to lay, and a
   * refund that did not match the cost would make the minus spell either a
   * penalty or a way of printing planks. Stated as one constant so the two
   * cannot drift apart.
   */
  test("a square is a plank and a stone, and both come from the minus spell", () => {
    expect(ROOM_COST.map(([item]) => item).sort()).toEqual(["stone", "wood"]);
    for (const [, each] of ROOM_COST) expect(each).toBeGreaterThan(0);
  });

  /**
   * The fewest any one material allows, not the total.
   *
   * A child with ten planks and one stone can build one room. Adding the two
   * up would offer eleven and charge for a stone they have not got.
   */
  test("a basket pays for as many as its scarcest material allows", () => {
    const held = (wood: number, stone: number) => (item: MaterialType) =>
      item === MaterialType.Wood ? wood : stone;
    expect(roomsAfforded(held(10, 1))).toBe(1);
    expect(roomsAfforded(held(1, 10))).toBe(1);
    expect(roomsAfforded(held(4, 4))).toBe(4);
    expect(roomsAfforded(held(0, 9))).toBe(0);
    expect(roomsAfforded(held(0, 0))).toBe(0);
  });

  test("and never a fraction of one", () => {
    const held = () => 3;
    expect(Number.isInteger(roomsAfforded(held))).toBe(true);
  });
});

describe("painting a piece of furniture", () => {
  const palette = {
    wood_dark: [110, 72, 40],
    wood: [156, 106, 58],
    wood_light: [196, 146, 92],
    fabric_dark: [150, 66, 78],
    fabric: [196, 96, 108],
    fabric_light: [232, 148, 156],
  } as Readonly<Record<string, readonly [number, number, number]>>;
  const green = {
    wood: [
      [52, 88, 58],
      [82, 128, 86],
      [124, 172, 124],
    ] as readonly (readonly [number, number, number])[],
    fabric: [
      [112, 78, 130],
      [152, 112, 176],
      [196, 160, 214],
    ] as readonly (readonly [number, number, number])[],
  };

  /**
   * Wood and cloth in one plan, because a colourway paints both together —
   * a green chair has a green blanket on it, not green legs and a red seat.
   */
  test("a colourway maps every tone of both ramps", () => {
    const plan = colourPlanFor(palette, green);
    expect(plan.size).toBe(6);
  });

  /**
   * Colourway nought is free, and that is what makes an untouched house cost
   * nothing: `repaintedSheet` hands the original straight back for an empty
   * plan rather than copying a sheet to change nothing.
   */
  test("and nothing to do comes back as nothing to do", () => {
    expect(colourPlanFor(undefined, green).size).toBe(0);
    expect(colourPlanFor(palette, undefined).size).toBe(0);
    // A palette missing its ramps maps nothing rather than mapping wrongly.
    expect(colourPlanFor({}, green).size).toBe(0);
  });

  test("a piece painted its own colour is a piece nothing happens to", () => {
    const same = {
      wood: [palette.wood_dark, palette.wood, palette.wood_light] as never,
      fabric: [palette.fabric_dark, palette.fabric, palette.fabric_light] as never,
    };
    const plan = colourPlanFor(palette, same);
    // Every entry maps a colour onto itself, so repainting changes no pixel.
    for (const [from, to] of plan) expect(from).toBe(to);
  });
});

/**
 * Where a thing lands when she puts it down.
 *
 * Reported as "I can't put the carpet above or to the left of me", and that
 * is exactly what it was: a piece is drawn from its top-left corner and
 * grows right and down, so anything bigger than one cell, anchored on the
 * tile she faces, grew back over the square she was standing on. She cannot
 * stand on her own rug, so it was refused — silently, in two directions out
 * of four.
 */
describe("putting a piece down in front of you", () => {
  const sizes = {
    rug: { cols: 2, rows: 2 },
    bed: { cols: 1, rows: 2 },
    chair: { cols: 1, rows: 1 },
  };
  const ahead = { col: 5, row: 5 };

  // The whole rule in one sentence: whatever its size, it lies in front of
  // you — starting at the square you are facing, going away from you.
  test("never covers the square she is standing on", () => {
    for (const [piece, standing] of [
      ["up", { col: 5, row: 6 }],
      ["down", { col: 5, row: 4 }],
      ["left", { col: 6, row: 5 }],
      ["right", { col: 4, row: 5 }],
    ] as const) {
      for (const thing of ["rug", "bed", "chair"] as const) {
        const corner = anchorFor(thing, ahead, piece, sizes);
        const covered = cellsUnder({ piece: thing, look: 0, ...corner }, sizes);
        expect({
          facing: piece,
          thing,
          onHer: covered.some((c) => c.col === standing.col && c.row === standing.row),
        }).toEqual({ facing: piece, thing, onHer: false });
      }
    }
  });

  // And it does cover the square she was pointing at, in every direction —
  // otherwise it would be "in front of her" by dodging the question.
  test("but always covers the square she is facing", () => {
    for (const facing of ["up", "down", "left", "right"] as const) {
      for (const thing of ["rug", "bed", "chair"] as const) {
        const corner = anchorFor(thing, ahead, facing, sizes);
        const covered = cellsUnder({ piece: thing, look: 0, ...corner }, sizes);
        expect({
          facing,
          thing,
          onIt: covered.some((c) => c.col === ahead.col && c.row === ahead.row),
        }).toEqual({ facing, thing, onIt: true });
      }
    }
  });

  test("a one-cell thing lands exactly where she pointed, whichever way she faces", () => {
    for (const facing of ["up", "down", "left", "right"] as const) {
      expect(anchorFor("chair", ahead, facing, sizes)).toEqual(ahead);
    }
  });

  // The two directions that were broken, stated as the numbers they produce.
  test("a two-by-two shifts back when she faces up or left", () => {
    expect(anchorFor("rug", ahead, "up", sizes)).toEqual({ col: 5, row: 4 });
    expect(anchorFor("rug", ahead, "left", sizes)).toEqual({ col: 4, row: 5 });
    expect(anchorFor("rug", ahead, "down", sizes)).toEqual({ col: 5, row: 5 });
    expect(anchorFor("rug", ahead, "right", sizes)).toEqual({ col: 5, row: 5 });
  });

  // A bed is one wide and two tall, so only facing up moves it.
  test("and a tall thing shifts only for the direction it is tall in", () => {
    expect(anchorFor("bed", ahead, "up", sizes)).toEqual({ col: 5, row: 4 });
    expect(anchorFor("bed", ahead, "left", sizes)).toEqual({ col: 5, row: 5 });
  });
});

/**
 * Which pieces a colour means anything to.
 *
 * A colourway swaps the room's wood and cloth ramps; a piece with neither in
 * it is the same picture five times. The shop offered exactly that under the
 * bath and the kettle before this existed.
 */
describe("what can be painted", () => {
  test("the wooden things can", () => {
    for (const piece of [
      DecorType.Bed,
      DecorType.Table,
      DecorType.Chair,
      DecorType.Rug,
      DecorType.Bookshelf,
      DecorType.Sink,
      DecorType.Dresser,
      DecorType.Washstand,
      DecorType.Privy,
    ]) {
      expect({ piece, painted: takesAColour(piece) }).toEqual({ piece, painted: true });
    }
  });

  test("and the ones made of metal cannot", () => {
    for (const piece of [DecorType.Kettle, DecorType.Bath]) {
      expect({ piece, painted: takesAColour(piece) }).toEqual({ piece, painted: false });
    }
  });

  test("every piece the game has is one or the other, and none is missed", () => {
    // The check that keeps the list honest as furniture is added: a new
    // piece is painted unless it says otherwise, which is the safe default
    // and the one worth being explicit about.
    for (const piece of DECOR_TYPES) {
      expect(typeof takesAColour(piece)).toBe("boolean");
    }
  });
});

/**
 * Turning, and what a quarter turn does to the room.
 *
 * Every piece turns. The interesting half is what happens to the cells: a
 * bed is one by two facing either way up the room and two by one lying
 * across it, and everything that asks what a piece covers has to get the
 * turned answer or a piece draws over one square and blocks another.
 */
describe("what can be turned", () => {
  test("everything in the house can", () => {
    for (const piece of DECOR_TYPES) {
      expect({ piece, turns: canTurnPiece(piece) }).toEqual({ piece, turns: true });
      expect({ piece, drawings: turnsOfPiece(piece) }).toEqual({ piece, drawings: TURNS_DRAWN });
    }
  });

  test("a quarter turn swaps a long piece and leaves a square one alone", () => {
    for (const [piece, drawn] of Object.entries(SIZES) as [DecorType, typeof SIZES.bed][]) {
      for (const turn of [Turn.Toward, Turn.Away]) {
        expect({ piece, turn, ...sizeOf(piece, turn, SIZES) }).toEqual({ piece, turn, ...drawn });
      }
      for (const turn of [Turn.Side, Turn.SideOther]) {
        expect({ piece, turn, ...sizeOf(piece, turn, SIZES) }).toEqual({
          piece,
          turn,
          cols: drawn.rows,
          rows: drawn.cols,
        });
      }
    }
  });

  /**
   * And the squares it stands on follow, which is the whole point.
   *
   * `cellsUnder` is the one place a thing standing in a room becomes a list
   * of squares, and everything else — what is occupied, whether a piece
   * fits, what the walkability grid says, which row a sprite sorts on — goes
   * through it. Turning the bed and getting the same two cells back would be
   * a bed that looked as though it had turned and behaved as though it had
   * not.
   */
  test("and so do the squares it stands on", () => {
    const bed: Placed = { piece: DecorType.Bed, col: 4, row: 4, look: 0, turn: Turn.Toward };
    expect(cellsUnder(bed, SIZES)).toEqual([
      { col: 4, row: 4 },
      { col: 4, row: 5 },
    ]);
    expect(cellsUnder({ ...bed, turn: Turn.Side }, SIZES)).toEqual([
      { col: 4, row: 4 },
      { col: 5, row: 4 },
    ]);
  });

  /**
   * The fits check, which is what makes turning a long piece safe.
   *
   * A bed standing against the east wall has the room it needs going down
   * and none going across, so turning it there has to be *refused* rather
   * than nudged or silently overlapped. Refusal is free once `cellsUnder`
   * tells the truth — `fits` was already asking the right question — and
   * this is the test that says so.
   */
  test("and a bed that would not fit turned is refused", () => {
    const room = (col: number, row: number) => col >= 0 && col <= 4 && row >= 0 && row <= 4;
    const corner: Placed = { piece: DecorType.Bed, col: 4, row: 0, look: 0, turn: Turn.Toward };
    // Standing up against the east wall it fits: two cells down, both floor.
    expect(fits(corner, [], SIZES, room)).toBe(true);
    // Turned across it wants the square outside the wall, and there is none.
    expect(fits({ ...corner, turn: Turn.Side }, [], SIZES, room)).toBe(false);
    // And it is the *room* refusing rather than the piece: a bed one square
    // in has space either way round.
    const inside: Placed = { ...corner, col: 3 };
    expect(fits(inside, [], SIZES, room)).toBe(true);
    expect(fits({ ...inside, turn: Turn.Side }, [], SIZES, room)).toBe(true);
  });

  test("and one that would land on something else is refused too", () => {
    const anywhereInside = () => true;
    const chair: Placed = { piece: DecorType.Chair, col: 6, row: 5, look: 0, turn: Turn.Toward };
    const bed: Placed = { piece: DecorType.Bed, col: 5, row: 5, look: 0, turn: Turn.Toward };
    // Head to head down the room, the bed misses the chair beside it.
    expect(fits(bed, [chair], SIZES, anywhereInside)).toBe(true);
    // Lying across, it reaches the square the chair is on.
    expect(fits({ ...bed, turn: Turn.Side }, [chair], SIZES, anywhereInside)).toBe(false);
  });
});
