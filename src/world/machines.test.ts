// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { Spell } from "../spells/spellbook";
import {
  MACHINE_TYPES,
  MINUTES_PER_ROUND,
  MachineType,
  SHARES,
  SPARK,
  advance,
  feed,
  fullestCrate,
  machinesFromSave,
  machinesToSave,
  newMachine,
  takeShare,
  wake,
} from "./machines";

const WOOD = "wood";

/** A woken sorter with a heap in its mouth. */
function loaded(count: number, item = WOOD) {
  const fed = feed(wake(newMachine()), item, count);
  if (!fed) throw new Error("a woken machine refused a heap");
  return fed;
}

describe("a machine that has not been woken", () => {
  /**
   * The spell on the way in, and the only one there is.
   *
   * A machine embodies arithmetic where a spell tests it, so this is the one
   * moment a sum stands between a child and the thing: once, to be shown the
   * operation it is about to spend its life doing. If this stopped being
   * true — if waking were free — the machine would be a source of dealt
   * heaps that no cast ever paid for.
   */
  test("does nothing at all, however long it is left", () => {
    const asleep = newMachine();
    expect(feed(asleep, WOOD, 12)).toBeNull();
    expect(advance(asleep, 10_000)).toEqual(asleep);
  });

  test("and every machine names the spell that wakes it", () => {
    for (const machine of MACHINE_TYPES) {
      expect({ machine, spell: SPARK[machine] }).toEqual({ machine, spell: expect.any(String) });
    }
    // The sorter divides, so division is what wakes it. A machine woken by
    // some *other* spell would be a toll rather than a demonstration.
    expect(SPARK[MachineType.Sorter]).toBe(Spell.Share);
  });
});

describe("a sorter dealing a heap", () => {
  test("deals nothing until a whole round's work is done", () => {
    const machine = loaded(12);
    expect(advance(machine, MINUTES_PER_ROUND - 1).crates).toEqual([0, 0, 0]);
    expect(advance(machine, MINUTES_PER_ROUND).crates).toEqual([1, 1, 1]);
  });

  /**
   * Whole rounds only, which is the whole of the arithmetic.
   *
   * Thirteen dealt three ways is four each with one over, and the one over
   * stays in the mouth where a child can see it. Dealing a partial round
   * would empty the mouth into unequal piles — a sorter that did not sort,
   * which is the single thing this machine must never look like.
   */
  test("and leaves the remainder in its mouth, in plain sight", () => {
    const done = advance(loaded(13), MINUTES_PER_ROUND * 10);
    expect(done.crates).toEqual([4, 4, 4]);
    expect(done.heap).toBe(1);
  });

  test("and a heap smaller than the crates is all remainder", () => {
    const done = advance(loaded(2), MINUTES_PER_ROUND * 100);
    expect(done.crates).toEqual([0, 0, 0]);
    expect(done.heap).toBe(2);
  });

  test("the three shares are always equal", () => {
    for (const heap of [3, 7, 12, 25, 100]) {
      const done = advance(loaded(heap), MINUTES_PER_ROUND * 1000);
      expect({ heap, crates: new Set(done.crates).size }).toEqual({ heap, crates: 1 });
      expect({ heap, over: done.heap }).toEqual({ heap, over: heap % SHARES });
    }
  });

  /**
   * And it does not store up work it had nothing to do.
   *
   * A machine standing empty for a month and then dealing a whole heap the
   * instant something was tipped in would be an accrual mechanic wearing a
   * sorter's hat: the reward would be for having left, not for having cast.
   */
  test("and an empty machine banks no work against the next heap", () => {
    const idle = advance(wake(newMachine()), MINUTES_PER_ROUND * 50);
    const fed = feed(idle, WOOD, 12);
    if (!fed) throw new Error("a woken machine refused a heap");
    expect(fed.crates).toEqual([0, 0, 0]);
    expect(advance(fed, MINUTES_PER_ROUND - 1).crates).toEqual([0, 0, 0]);
  });

  /** Nor while it is holding a remainder it can never deal. */
  test("and nor does one holding less than it can deal", () => {
    const stuck = advance(loaded(2), MINUTES_PER_ROUND * 50);
    const more = feed(stuck, WOOD, 1);
    if (!more) throw new Error("the mouth refused more of what it holds");
    expect(advance(more, MINUTES_PER_ROUND - 1).crates).toEqual([0, 0, 0]);
    expect(advance(more, MINUTES_PER_ROUND).crates).toEqual([1, 1, 1]);
  });
});

describe("what goes in and what comes out", () => {
  test("a hopper holds one kind of thing", () => {
    const wood = loaded(6);
    expect(feed(wood, "stone", 3)).toBeNull();
    expect(feed(wood, WOOD, 3)?.heap).toBe(9);
  });

  test("and nonsense is refused rather than rounded", () => {
    const machine = wake(newMachine());
    for (const count of [0, -4, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect({ count, fed: feed(machine, WOOD, count) }).toEqual({ count, fed: null });
    }
  });

  test("one tap takes one share, not the lot", () => {
    const done = advance(loaded(12), MINUTES_PER_ROUND * 4);
    expect(done.crates).toEqual([4, 4, 4]);
    const taken = takeShare(done, fullestCrate(done));
    expect({ item: taken.item, count: taken.count }).toEqual({ item: WOOD, count: 4 });
    expect(taken.state.crates).toEqual([0, 4, 4]);
  });

  test("and an empty crate gives nothing rather than an empty heap of something", () => {
    const taken = takeShare(loaded(12), 0);
    expect({ item: taken.item, count: taken.count }).toEqual({ item: null, count: 0 });
  });

  /**
   * And a machine emptied out forgets what it held.
   *
   * Otherwise a sorter that once held wood would go on refusing stone for
   * ever, and a child would have to remember the history of every machine in
   * the garden to know what it would accept.
   */
  test("and a machine emptied right out will take anything next", () => {
    let done = advance(loaded(3), MINUTES_PER_ROUND);
    for (let crate = 0; crate < SHARES; crate++) done = takeShare(done, crate).state;
    expect(done.holding).toBeNull();
    expect(feed(done, "stone", 3)?.heap).toBe(3);
  });

  test("but one with a remainder still in its mouth does not", () => {
    let done = advance(loaded(4), MINUTES_PER_ROUND);
    for (let crate = 0; crate < SHARES; crate++) done = takeShare(done, crate).state;
    expect(done.holding).toBe(WOOD);
    expect(feed(done, "stone", 3)).toBeNull();
  });
});

describe("what a save remembers about a machine", () => {
  test("a garden full of them survives the round trip", () => {
    const machines = new Map([
      ["4,5", advance(loaded(13), MINUTES_PER_ROUND * 2)],
      ["-2,7", newMachine()],
      ["0,0", wake(newMachine())],
    ]);
    expect(machinesFromSave(JSON.parse(JSON.stringify(machinesToSave(machines))))).toEqual(
      machines,
    );
  });

  /**
   * Whether it is awake is the half worth naming.
   *
   * It is the only part a cast paid for. Everything else in a machine can be
   * put back by tipping another heap in; a machine that came back asleep
   * would charge a child the spell a second time for a thing they had
   * already earned.
   */
  test("and a woken machine is still awake tomorrow", () => {
    const saved = machinesToSave(new Map([["1,1", wake(newMachine())]]));
    expect(machinesFromSave(saved).get("1,1")?.awake).toBe(true);
    const asleep = machinesToSave(new Map([["1,1", newMachine()]]));
    expect(machinesFromSave(asleep).get("1,1")?.awake).toBe(false);
  });

  test("and anything mangled is dropped rather than repaired", () => {
    const junk = {
      "1,1": "nonsense",
      "not a square": "1,wood,3,1/1/1,0",
      "2,2": "1,wood,3,1/1,0",
      "3,3": "1,wood,-3,1/1/1,0",
      "4,4": "1,,5,0/0/0,0",
      "5,5": 7,
      "6,6": "1,wood,3,1/1/1,0",
    };
    expect([...machinesFromSave(junk).keys()]).toEqual(["6,6"]);
    expect(machinesFromSave(undefined).size).toBe(0);
    expect(machinesFromSave("nope").size).toBe(0);
  });
});
