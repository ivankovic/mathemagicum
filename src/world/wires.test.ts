// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import {
  MINUTES_PER_ROUND,
  MachineType,
  SHARES,
  advance,
  feed,
  newMachine,
  wake,
} from "./machines";
import {
  CARRIES_PER_ROUND,
  WIRE_REACH,
  canString,
  carry,
  wiresFromSave,
  wiresToSave,
} from "./wires";

const SORTER = MachineType.Sorter;
const HOUSE = MachineType.Hothouse;

/** A sorter with its crates full of something. */
function fullOf(item: string, heap: number) {
  const fed = feed(wake(newMachine()), item, heap, SORTER);
  if (!fed) throw new Error("a woken sorter refused a heap");
  return advance(fed, MINUTES_PER_ROUND * 100, SORTER);
}

describe("stringing a wire", () => {
  test("reaches a machine a few squares off", () => {
    expect(canString({ col: 4, row: 4 }, { col: 4 + WIRE_REACH, row: 4 })).toBe(true);
    // Corner to corner is the same one wire as straight across: a child
    // laying them out is thinking about where things are, not about how far
    // a line travels.
    expect(canString({ col: 0, row: 0 }, { col: WIRE_REACH, row: WIRE_REACH })).toBe(true);
  });

  test("but not across a garden, and not to itself", () => {
    expect(canString({ col: 0, row: 0 }, { col: WIRE_REACH + 1, row: 0 })).toBe(false);
    expect(canString({ col: 3, row: 3 }, { col: 3, row: 3 })).toBe(false);
  });
});

describe("what a wire carries", () => {
  test("takes a little off the crates and puts it in the mouth", () => {
    const source = fullOf("carrot", 9);
    const sink = wake(newMachine());
    const done = carry(source, sink, HOUSE);

    expect(done.moved).toBe(CARRIES_PER_ROUND);
    expect(done.sink.heap).toBe(CARRIES_PER_ROUND);
    expect(done.sink.holding).toBe("carrot");
    // And it came off the source rather than being copied: a wire carries.
    const before = source.crates.reduce((all, count) => all + count, 0);
    const after = done.source.crates.reduce((all, count) => all + count, 0);
    expect(before - after).toBe(CARRIES_PER_ROUND);
  });

  /**
   * A refusal backs the source up. It never drops and it never swaps.
   *
   * The mouth holds one kind at a time, so a machine full of carrots being
   * sent timber has nowhere to put it. Dropping would quietly destroy a
   * child's material; swapping would make the machine eat what was already
   * in there. Leaving it where it is stops the line — which is visible, and
   * is the whole reason a sieve is worth building.
   */
  test("and backs up rather than dropping what will not go", () => {
    const source = fullOf("wood", 9);
    const busy = feed(wake(newMachine()), "carrot", 4, HOUSE);
    if (!busy) throw new Error("a woken hothouse refused a crop");

    const done = carry(source, busy, HOUSE);
    expect(done.moved).toBe(0);
    // Every one of them still in the source's crates, and the destination
    // untouched — the same two objects that went in.
    expect(done.source).toEqual(source);
    expect(done.sink).toEqual(busy);
  });

  test("and carries nothing into a machine that is still asleep", () => {
    const done = carry(fullOf("carrot", 9), newMachine(), HOUSE);
    expect(done.moved).toBe(0);
    expect(done.source.crates).toEqual(fullOf("carrot", 9).crates);
  });

  test("and carries nothing off a machine with empty crates", () => {
    const empty = wake(newMachine());
    expect(carry(empty, wake(newMachine()), HOUSE).moved).toBe(0);
  });

  /**
   * And it will not carry what the far machine is not for.
   *
   * A hothouse takes crops, because one that took timber would turn one wood
   * into three and never stop. A wire is not a way round that: it hands what
   * it has to `feed`, which refuses for the same reason it refuses a hand.
   */
  test("and will not carry timber into a thing that only takes crops", () => {
    const done = carry(fullOf("wood", 9), wake(newMachine()), HOUSE);
    expect(done.moved).toBe(0);
  });

  test("and takes what is there when that is less than a round's worth", () => {
    const source = fullOf("carrot", SHARES);
    expect(source.crates).toEqual([1, 1, 1]);
    const done = carry(source, wake(newMachine()), HOUSE, 99);
    expect(done.moved).toBe(SHARES);
    expect(done.source.crates).toEqual([0, 0, 0]);
    // Emptied right out, so the mouth forgets what it held and the next
    // thing tipped in can be anything.
    expect(done.source.holding).toBeNull();
  });
});

describe("what a save remembers about wire", () => {
  test("a garden full of it survives the round trip", () => {
    const wires = [
      { from: "4,5", to: "6,5" },
      { from: "6,5", to: "6,9" },
    ];
    expect(wiresFromSave(JSON.parse(JSON.stringify(wiresToSave(wires))))).toEqual(wires);
  });

  test("and anything mangled is dropped rather than repaired", () => {
    const junk = [
      "nonsense",
      "1,1>1,1", // to itself
      `0,0>${WIRE_REACH + 1},0`, // further than it reaches
      "x,1>2,2",
      7,
      "4,5>6,5",
      "4,5>6,5", // and the same one twice
    ];
    expect(wiresFromSave(junk)).toEqual([{ from: "4,5", to: "6,5" }]);
    expect(wiresFromSave(undefined)).toEqual([]);
  });

  /**
   * A wire whose machine has been taken back is kept, not dropped.
   *
   * Nothing here asks whether anything still stands at either end. One might
   * have been picked up since — the scene tidies those away when it notices
   * — and refusing to load a wire because something had been moved would be
   * refusing to load the garden.
   */
  test("and one whose ends are bare squares still loads", () => {
    expect(wiresFromSave(["100,100>103,100"])).toEqual([{ from: "100,100", to: "103,100" }]);
  });
});
