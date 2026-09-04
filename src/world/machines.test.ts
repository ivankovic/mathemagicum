// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { SPELLS, Spell } from "../spells/spellbook";
import {
  BIN_HOLDS,
  MACHINE_TYPES,
  MINUTES_PER_ROUND,
  MachineType,
  SHARES,
  SPARK,
  Verb,
  WORK,
  accepts,
  advance,
  feed,
  fullestCrate,
  machinesFromSave,
  machinesToSave,
  newMachine,
  pressable,
  pressing,
  takeShare,
  tipBin,
  wake,
  wouldTake,
} from "./machines";
import { MaterialType } from "./materials";
import { CLEARED_YIELD } from "./materials";
import { PLANT_TYPES } from "./plants";

const WOOD = "wood";
/** Every test below this is about the sorter unless it says otherwise. */
const SORTER = MachineType.Sorter;

/** A woken sorter with a heap in its mouth. */
function loaded(count: number, item = WOOD) {
  const fed = feed(wake(newMachine()), item, count, SORTER);
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
    expect(feed(asleep, WOOD, 12, SORTER)).toBeNull();
    expect(advance(asleep, 10_000, SORTER)).toEqual(asleep);
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
    expect(advance(machine, MINUTES_PER_ROUND - 1, SORTER).crates).toEqual([0, 0, 0]);
    expect(advance(machine, MINUTES_PER_ROUND, SORTER).crates).toEqual([1, 1, 1]);
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
    const done = advance(loaded(13), MINUTES_PER_ROUND * 10, SORTER);
    expect(done.crates).toEqual([4, 4, 4]);
    expect(done.heap).toBe(1);
  });

  test("and a heap smaller than the crates is all remainder", () => {
    const done = advance(loaded(2), MINUTES_PER_ROUND * 100, SORTER);
    expect(done.crates).toEqual([0, 0, 0]);
    expect(done.heap).toBe(2);
  });

  test("the three shares are always equal", () => {
    for (const heap of [3, 7, 12, 25, 100]) {
      const done = advance(loaded(heap), MINUTES_PER_ROUND * 1000, SORTER);
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
    const idle = advance(wake(newMachine()), MINUTES_PER_ROUND * 50, SORTER);
    const fed = feed(idle, WOOD, 12, SORTER);
    if (!fed) throw new Error("a woken machine refused a heap");
    expect(fed.crates).toEqual([0, 0, 0]);
    expect(advance(fed, MINUTES_PER_ROUND - 1, SORTER).crates).toEqual([0, 0, 0]);
  });

  /** Nor while it is holding a remainder it can never deal. */
  test("and nor does one holding less than it can deal", () => {
    const stuck = advance(loaded(2), MINUTES_PER_ROUND * 50, SORTER);
    const more = feed(stuck, WOOD, 1, SORTER);
    if (!more) throw new Error("the mouth refused more of what it holds");
    expect(advance(more, MINUTES_PER_ROUND - 1, SORTER).crates).toEqual([0, 0, 0]);
    expect(advance(more, MINUTES_PER_ROUND, SORTER).crates).toEqual([1, 1, 1]);
  });
});

describe("what goes in and what comes out", () => {
  test("a hopper holds one kind of thing", () => {
    const wood = loaded(6);
    expect(feed(wood, "stone", 3, SORTER)).toBeNull();
    expect(feed(wood, WOOD, 3, SORTER)?.heap).toBe(9);
  });

  test("and nonsense is refused rather than rounded", () => {
    const machine = wake(newMachine());
    for (const count of [0, -4, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect({ count, fed: feed(machine, WOOD, count, SORTER) }).toEqual({ count, fed: null });
    }
  });

  test("one tap takes one share, not the lot", () => {
    const done = advance(loaded(12), MINUTES_PER_ROUND * 4, SORTER);
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
    let done = advance(loaded(3), MINUTES_PER_ROUND, SORTER);
    for (let crate = 0; crate < SHARES; crate++) done = takeShare(done, crate).state;
    expect(done.holding).toBeNull();
    expect(feed(done, "stone", 3, SORTER)?.heap).toBe(3);
  });

  test("but one with a remainder still in its mouth does not", () => {
    let done = advance(loaded(4), MINUTES_PER_ROUND, SORTER);
    for (let crate = 0; crate < SHARES; crate++) done = takeShare(done, crate).state;
    expect(done.holding).toBe(WOOD);
    expect(feed(done, "stone", 3, SORTER)).toBeNull();
  });
});

describe("what a save remembers about a machine", () => {
  test("a garden full of them survives the round trip", () => {
    const machines = new Map([
      ["4,5", advance(loaded(13), MINUTES_PER_ROUND * 2, SORTER)],
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

/**
 * The second machine, and the half of it that is not the first.
 *
 * A sorter *deals*: it divides a heap that was already there, and nothing
 * comes out of it that did not go in. A hothouse *turns*: a crop goes in and
 * timber comes out. Everything below is about the difference, because the
 * two share every line of code that moves work along and the only thing
 * telling them apart is a table.
 */
describe("a hothouse turning one thing into another", () => {
  const HOUSE = MachineType.Hothouse;
  const CARROT = "carrot";

  /** A woken hothouse with a heap of crops in it. */
  function planted(count: number) {
    const fed = feed(wake(newMachine()), CARROT, count, HOUSE);
    if (!fed) throw new Error("a woken hothouse refused a heap");
    return fed;
  }

  test("takes one and makes three", () => {
    const done = advance(planted(1), MINUTES_PER_ROUND, HOUSE);
    expect(done.heap).toBe(0);
    expect(done.crates).toEqual([1, 1, 1]);
  });

  /**
   * And what comes out is not what went in, which is the whole point.
   *
   * The first version of `takeShare` handed back whatever was in the mouth,
   * which was right while every machine dealt and would have given a child
   * their carrots back out of a hothouse — a machine that looked like it
   * worked and quietly did nothing.
   */
  test("and what comes out is timber, not the crop that went in", () => {
    const done = advance(planted(2), MINUTES_PER_ROUND * 2, HOUSE);
    expect(done.holding).toBe(CARROT);
    expect(done.made).toBe("wood");
    const taken = takeShare(done, fullestCrate(done));
    expect({ item: taken.item, count: taken.count }).toEqual({ item: "wood", count: 2 });
  });

  /**
   * A crop grown is worth about a tree felled, and that is the balance.
   *
   * Three is what a conifer gives when it is cleared, so a growth cast and a
   * clearing cast come out level — which is what makes growing the same
   * carrot twice a way to build rather than a worse way to earn.
   */
  test("and three is what it makes, which is what a felled conifer gives", () => {
    expect(WORK[HOUSE]).toEqual({
      verb: Verb.Turn,
      takes: 1,
      puts: SHARES,
      gives: "wood",
      wants: "a crop",
    });
    expect(CLEARED_YIELD.woodland?.count).toBe(SHARES);
  });

  test("and a sorter still deals what it was given", () => {
    expect(WORK[MachineType.Sorter]).toEqual({
      verb: Verb.Deal,
      takes: SHARES,
      puts: SHARES,
      gives: null,
      wants: "anything",
    });
    const done = advance(planted(SHARES), MINUTES_PER_ROUND, MachineType.Sorter);
    expect(takeShare(done, 0).item).toBe(CARROT);
  });

  /**
   * And a machine emptied right out forgets what it was making too.
   *
   * `made` outliving the crates would leave a hothouse that had been emptied
   * insisting its next heap of anything came out as timber — which it does,
   * but by the table rather than by memory, and the two would drift the
   * moment a machine's output ever depended on its input.
   */
  test("and one emptied right out forgets what it was making", () => {
    let done = advance(planted(1), MINUTES_PER_ROUND, HOUSE);
    for (let crate = 0; crate < SHARES; crate++) done = takeShare(done, crate).state;
    expect({ holding: done.holding, made: done.made }).toEqual({ holding: null, made: null });
  });

  test("and what it is holding survives being written down", () => {
    const working = advance(planted(4), MINUTES_PER_ROUND * 2, HOUSE);
    const machines = new Map([["3,4", working]]);
    expect(machinesFromSave(machinesToSave(machines))).toEqual(machines);
  });

  /**
   * A save from before there were two kinds of machine has no sixth field.
   *
   * Everything in one of those deals, so its crates hold what its mouth
   * holds — which is exactly what an absent `made` means, and is why the
   * absence reads as null rather than being dropped as mangled.
   */
  test("and a save from before machines could turn reads as one that deals", () => {
    const old = machinesFromSave({ "1,1": "1,wood,4,2/2/2,5" });
    expect(old.get("1,1")).toEqual({
      awake: true,
      holding: "wood",
      heap: 4,
      crates: [2, 2, 2],
      made: null,
      passes: null,
      binned: null,
      bin: 0,
      mark: 0,
      // And it has no eleventh, twelfth or thirteenth either, which read as
      // a machine with one mouth — which every machine in that save had.
      other: null,
      otherHeap: 0,
      otherMark: 0,
      worked: 5,
    });
    expect(takeShare(old.get("1,1") as never, 0).item).toBe("wood");
  });

  /**
   * And it refuses what it makes, which is not a nicety.
   *
   * A hothouse that took timber would turn one wood into three wood — an
   * endless supply out of nothing, and the end of the rule the whole design
   * rests on: material in the world stays a function of spellwork. It grows
   * things, so it takes things that grow.
   */
  test("and refuses timber, which is the loop it would otherwise be", () => {
    const woken = wake(newMachine());
    expect(feed(woken, "wood", 9, HOUSE)).toBeNull();
    expect(feed(woken, "stone", 9, HOUSE)).toBeNull();
    expect(feed(woken, CARROT, 9, HOUSE)?.heap).toBe(9);
    expect(accepts(HOUSE, "wood")).toBe(false);
    for (const plant of PLANT_TYPES)
      expect({ plant, ok: accepts(HOUSE, plant) }).toEqual({ plant, ok: true });
  });

  /** Where a sorter takes anything, because dealing cannot mint. */
  test("and a sorter takes whatever it is given", () => {
    for (const item of ["wood", "stone", CARROT]) {
      expect({ item, ok: accepts(MachineType.Sorter, item) }).toEqual({ item, ok: true });
    }
  });
});

/**
 * The third machine, which decides rather than makes.
 *
 * A wire only carries — every choice belongs to a machine standing where a
 * child can see it — so this is where a line is gated. Shown one thing, it
 * passes that and drops everything else into its bin.
 */
describe("a sieve deciding which way things go", () => {
  const SIEVE = MachineType.Sieve;
  const CARROT = "carrot";

  /** A woken sieve with a heap in its mouth. */
  function sifting(item: string, count: number, from = wake(newMachine())) {
    const fed = feed(from, item, count, SIEVE);
    if (!fed) throw new Error("a woken sieve refused a heap");
    return fed;
  }

  /**
   * Shown once, and by the first thing that goes in.
   *
   * The same bargain as waking, and for the same reason: a dial would be the
   * first menu in the garden, and a sieve that had to be told in words what
   * to pass would be a sieve a six-year-old could not use.
   */
  test("learns what to pass from the first thing it is given", () => {
    const done = advance(sifting(CARROT, 4), MINUTES_PER_ROUND * 4, SIEVE);
    expect(done.passes).toBe(CARROT);
    expect(done.heap).toBe(0);
    expect(done.bin).toBe(0);
    // Four in, four out — a sieve neither makes nor loses, it only sorts.
    expect(done.crates.reduce((all, count) => all + count, 0)).toBe(4);
  });

  test("and does not learn again from the next thing", () => {
    let done = advance(sifting(CARROT, 3), MINUTES_PER_ROUND * 3, SIEVE);
    for (let crate = 0; crate < SHARES; crate++) done = takeShare(done, crate).state;
    done = advance(sifting("wood", 3, done), MINUTES_PER_ROUND * 3, SIEVE);
    // Still carrots, and the timber went in the bin. A sieve that relearned
    // every batch would pass whatever it was last handed, which is a sieve
    // that does nothing at all.
    expect(done.passes).toBe(CARROT);
    expect({ binned: done.binned, bin: done.bin }).toEqual({ binned: "wood", bin: 3 });
    expect(done.crates.reduce((all, count) => all + count, 0)).toBe(0);
  });

  /**
   * And the bin fills and jams, which is the point rather than a limit
   * somebody forgot to remove.
   *
   * A sieve quietly swallowing everything it is sent for ever would be a
   * hole in a child's garden. One that stops, backs the line up and sits
   * there with a full bin is a thing they can find and empty.
   */
  test("and its bin fills up and then jams", () => {
    let done = advance(sifting(CARROT, 1), MINUTES_PER_ROUND, SIEVE);
    done = advance(sifting("wood", BIN_HOLDS + 6, done), MINUTES_PER_ROUND * 100, SIEVE);
    expect(done.bin).toBe(BIN_HOLDS);
    // What would not fit is still in the mouth rather than gone.
    expect({ holding: done.holding, heap: done.heap }).toEqual({ holding: "wood", heap: 6 });

    // And now *nothing* goes in — not even what it passes. The mouth is
    // blocked by rejects it has nowhere to put, so the whole machine stops
    // and every wire into it backs up. That is the jam, and it is a stronger
    // thing than a full box: a sieve that went on accepting the good ones
    // while it choked on the bad would hide the problem it is having.
    expect(feed(done, "stone", 3, SIEVE)).toBeNull();
    expect(feed(done, CARROT, 3, SIEVE)).toBeNull();

    // Tipping the bin out is what frees it, and that is the whole design of
    // this: the fix is a thing a child does, in one tap, to a machine whose
    // bin they can see is full.
    // With room in the bin it works the rest of the timber off, and only
    // then is the mouth clear for anything else — which is the machine
    // finishing what it was doing rather than dropping it.
    const running = advance(tipBin(done).state, MINUTES_PER_ROUND * 10, SIEVE);
    expect({ heap: running.heap, holding: running.holding }).toEqual({ heap: 0, holding: null });
    expect(feed(running, CARROT, 3, SIEVE)?.heap).toBe(3);
  });

  /**
   * The bin is emptied by its own call, never by taking a share.
   *
   * A bin is not a share. One call for both would mean a child tipping the
   * rejects out found they had taken a third of the good ones with them.
   */
  test("and the bin is tipped out on its own", () => {
    let done = advance(sifting(CARROT, 1), MINUTES_PER_ROUND, SIEVE);
    done = advance(sifting("wood", 5, done), MINUTES_PER_ROUND * 5, SIEVE);
    expect({ bin: done.bin, crates: done.crates.reduce((a, c) => a + c, 0) }).toEqual({
      bin: 5,
      crates: 1,
    });

    const tipped = tipBin(done);
    expect({ item: tipped.item, count: tipped.count }).toEqual({ item: "wood", count: 5 });
    expect({ bin: tipped.state.bin, binned: tipped.state.binned }).toEqual({
      bin: 0,
      binned: null,
    });
    // And the carrot it passed is still in its crates, untouched.
    expect(tipped.state.crates.reduce((a, c) => a + c, 0)).toBe(1);
  });

  test("and an empty bin gives nothing rather than an empty heap of something", () => {
    const tipped = tipBin(wake(newMachine()));
    expect({ item: tipped.item, count: tipped.count }).toEqual({ item: null, count: 0 });
  });

  test("and all of it survives being written down", () => {
    let done = advance(sifting(CARROT, 2), MINUTES_PER_ROUND * 2, SIEVE);
    done = advance(sifting("wood", 4, done), MINUTES_PER_ROUND * 4, SIEVE);
    const machines = new Map([["8,9", done]]);
    expect(machinesFromSave(machinesToSave(machines))).toEqual(machines);
  });

  /** And the other two are unchanged by any of it. */
  test("and dealing still puts exactly one in each crate a round", () => {
    const fed = feed(wake(newMachine()), "wood", 9, MachineType.Sorter);
    if (!fed) throw new Error("a woken sorter refused a heap");
    expect(advance(fed, MINUTES_PER_ROUND, MachineType.Sorter).crates).toEqual([1, 1, 1]);
    expect(advance(fed, MINUTES_PER_ROUND * 3, MachineType.Sorter).crates).toEqual([3, 3, 3]);
  });
});

/**
 * The fourth machine, and the first that asks whether there is *enough*.
 *
 * Everything before it says how much of a thing there is. A tally holds what
 * it is given until the heap reaches a mark and then tips the lot — so a
 * heap sitting below that mark, going nowhere, is what `≥` looks like when
 * you can walk up to it.
 */
describe("a tally counting up to its mark", () => {
  const TALLY = MachineType.Tally;
  const WHEAT = "wheat";

  function counting(count: number, from = wake(newMachine())) {
    const fed = feed(from, WHEAT, count, TALLY);
    if (!fed) throw new Error("a woken tally refused a heap");
    return fed;
  }

  /** Shown once, by the first heap in — the same bargain the sieve makes. */
  test("learns its mark from the first heap it is shown", () => {
    const done = advance(counting(5), MINUTES_PER_ROUND, TALLY);
    expect(done.mark).toBe(5);
    expect(done.heap).toBe(0);
    expect(done.crates.reduce((all, count) => all + count, 0)).toBe(5);
  });

  /**
   * And under the mark, nothing happens — not slowly, not at all.
   *
   * That is the shape of `≥` rather than an optimisation. Nine against a
   * mark of twelve is not *almost* ready; it is not ready, and it will still
   * not be ready tomorrow. What changes that is more arriving, not more
   * time — which is the whole idea a child is meeting here.
   */
  test("and holds a heap below the mark for ever", () => {
    let done = advance(counting(4), MINUTES_PER_ROUND, TALLY);
    for (let crate = 0; crate < SHARES; crate++) done = takeShare(done, crate).state;
    done = counting(3, done);
    expect(advance(done, MINUTES_PER_ROUND * 1000, TALLY)).toMatchObject({
      heap: 3,
      crates: [0, 0, 0],
    });
    // And it tips the moment enough arrives, without needing to be told.
    const enough = advance(counting(1, done), MINUTES_PER_ROUND, TALLY);
    expect(enough.heap).toBe(0);
    expect(enough.crates.reduce((all, count) => all + count, 0)).toBe(4);
  });

  test("and tips in whole batches, leaving the remainder under the mark", () => {
    let done = advance(counting(3), MINUTES_PER_ROUND, TALLY);
    for (let crate = 0; crate < SHARES; crate++) done = takeShare(done, crate).state;
    done = advance(counting(11, done), MINUTES_PER_ROUND * 100, TALLY);
    // Eleven against a mark of three is three batches of three and two over.
    expect(done.crates.reduce((all, count) => all + count, 0)).toBe(9);
    expect(done.heap).toBe(2);
    expect(done.mark).toBe(3);
  });

  test("and a tally banks no work while it is waiting", () => {
    let done = advance(counting(6), MINUTES_PER_ROUND, TALLY);
    for (let crate = 0; crate < SHARES; crate++) done = takeShare(done, crate).state;
    // Left running under its mark for a month, then filled: it must tip
    // once, not pour out a month of batches it never had the goods for.
    const waited = advance(counting(2, done), MINUTES_PER_ROUND * 500, TALLY);
    const filled = advance(counting(10, waited), MINUTES_PER_ROUND, TALLY);
    expect(filled.crates.reduce((all, count) => all + count, 0)).toBe(6);
    expect(filled.heap).toBe(6);
  });

  test("and what comes out is what went in", () => {
    const done = advance(counting(4), MINUTES_PER_ROUND, TALLY);
    const taken = takeShare(done, fullestCrate(done));
    expect(taken.item).toBe(WHEAT);
  });

  test("and its mark survives being written down", () => {
    const done = advance(counting(7), MINUTES_PER_ROUND, TALLY);
    const machines = new Map([["2,3", done]]);
    expect(machinesFromSave(machinesToSave(machines))).toEqual(machines);
    expect(machinesFromSave(machinesToSave(machines)).get("2,3")?.mark).toBe(7);
  });

  /**
   * Every machine does a different thing, and every one is woken by the
   * spell whose arithmetic it does.
   *
   * **Those are two rules, and only the first is about uniqueness.** This
   * asked for a distinct *spell* per machine as well, which was true while
   * there were four and one operation each — and was a coincidence rather
   * than the rule. The rule is written down in `SPARK`: "the spell whose
   * arithmetic it does". A press takes so many of one for every so many of
   * the other, which is a division made permanent, so sharing is the spell
   * that wakes it and the sorter both. Asserting one-each would have made
   * the next honest machine look like a mistake.
   */
  test("every machine does its own thing, woken by the spell that does it", () => {
    expect(new Set(MACHINE_TYPES.map((machine) => WORK[machine].verb)).size).toBe(
      MACHINE_TYPES.length,
    );
    for (const machine of MACHINE_TYPES) {
      expect({ machine, spark: SPELLS.includes(SPARK[machine]) }).toEqual({ machine, spark: true });
    }
    // And between them they still cover all four operations, which is the
    // thing the old assertion was really guarding.
    expect(new Set(MACHINE_TYPES.map((machine) => SPARK[machine]))).toEqual(
      new Set([Spell.Growth, Spell.Clearing, Spell.Array, Spell.Share]),
    );
  });
});

describe("a press taking so many of one for every so many of the other", () => {
  const PRESS = MachineType.Press;
  const WOOD = "wood";
  const STONE = "stone";

  /** Two funnels, filled in the order a child would fill them. */
  function shown(wood: number, stone: number, from = wake(newMachine())) {
    const first = feed(from, WOOD, wood, PRESS);
    if (!first) throw new Error("a woken press refused wood");
    if (stone <= 0) return first;
    const second = feed(first, STONE, stone, PRESS);
    if (!second) throw new Error("a woken press refused stone");
    return second;
  }

  test("keeps its two kinds in two heaps rather than one mixture", () => {
    const ready = shown(2, 1);
    expect({ holding: ready.holding, heap: ready.heap }).toEqual({ holding: WOOD, heap: 2 });
    expect({ other: ready.other, otherHeap: ready.otherHeap }).toEqual({
      other: STONE,
      otherHeap: 1,
    });
  });

  /**
   * The proportion is learned from the first pressing, not set.
   *
   * The same bargain the sieve and the tally make, for the reason they make
   * it: a dial would be the first menu in the garden, and a number typed
   * into a machine is a number a five-year-old cannot type. Pour in two wood
   * and one stone and it works in twos and ones from then on.
   */
  test("learns its proportion from what it is first shown", () => {
    const done = advance(shown(2, 1), MINUTES_PER_ROUND, PRESS);
    expect({ mine: done.mark, theirs: done.otherMark }).toEqual({ mine: 2, theirs: 1 });
    expect({ heap: done.heap, otherHeap: done.otherHeap }).toEqual({ heap: 0, otherHeap: 0 });
    expect(done.crates.reduce((all, count) => all + count, 0)).toBe(1);
  });

  test("and keeps to it afterwards, however much arrives", () => {
    let press = advance(shown(2, 1), MINUTES_PER_ROUND, PRESS);
    press = shown(6, 3, press);
    press = advance(press, MINUTES_PER_ROUND * 3, PRESS);
    // Three more pressings, two wood and one stone each, and nothing left.
    expect({ heap: press.heap, otherHeap: press.otherHeap }).toEqual({ heap: 0, otherHeap: 0 });
    expect(press.crates.reduce((all, count) => all + count, 0)).toBe(4);
  });

  /**
   * **The stall is the lesson.**
   *
   * Ten of one thing and none of the other is not nine tenths of a pressing.
   * It is none, and it will still be none tomorrow — what changes it is the
   * other thing arriving, not more time. That refusal is `for every`,
   * standing in a garden where a child can walk up to it.
   */
  test("stalls with one funnel piled high and the other empty", () => {
    const lopsided = advance(shown(10, 0), MINUTES_PER_ROUND * 20, PRESS);
    expect(lopsided.crates.reduce((all, count) => all + count, 0)).toBe(0);
    expect(lopsided.heap).toBe(10);
    // And it banks nothing while it waits, so the moment the other arrives
    // it does not empty both funnels in one frame.
    expect(lopsided.worked).toBe(0);
  });

  test("and picks straight up when the other thing finally comes", () => {
    const waiting = advance(shown(4, 0), MINUTES_PER_ROUND * 20, PRESS);
    const fed = feed(waiting, STONE, 2, PRESS);
    if (!fed) throw new Error("a stalled press refused the thing it was waiting for");
    const done = advance(fed, MINUTES_PER_ROUND, PRESS);
    expect(done.crates.reduce((all, count) => all + count, 0)).toBe(1);
    expect({ heap: done.heap, otherHeap: done.otherHeap }).toEqual({ heap: 0, otherHeap: 0 });
  });

  /**
   * What it is shown is what it takes, and it is not reduced.
   *
   * Four and two is the same *proportion* as two and one, and a press shown
   * four and two works in fours and twos — one pressing, not two. Reducing
   * to lowest terms was tempting and is the wrong rule: it would mean the
   * first pressing did not match the ones after it, and a machine that
   * quietly halves what a child poured in is a machine that argues with
   * them. It is the tally's bargain exactly — show it five and it deals in
   * fives, not in ones.
   */
  test("what it was shown is the batch, not the proportion reduced", () => {
    const done = advance(shown(4, 2), MINUTES_PER_ROUND * 4, PRESS);
    expect({ mine: done.mark, theirs: done.otherMark }).toEqual({ mine: 4, theirs: 2 });
    expect(done.crates.reduce((all, count) => all + count, 0)).toBe(1);
  });

  /**
   * Neither funnel forgets, and that is where a press differs from a sieve.
   *
   * A sieve runs dry and takes whatever arrives next, because a sieve is a
   * thing you pour a stream through. A press that forgot would take stone
   * into the funnel that had been the wood's and quietly press two stone for
   * every wood — the wrong sum, done with the right numbers, with nothing on
   * the machine to say so.
   */
  test("neither funnel forgets what it is for, even emptied", () => {
    const done = advance(shown(2, 1), MINUTES_PER_ROUND, PRESS);
    expect({ heap: done.heap, holding: done.holding }).toEqual({ heap: 0, holding: WOOD });
    expect({ otherHeap: done.otherHeap, other: done.other }).toEqual({
      otherHeap: 0,
      other: STONE,
    });
    // So stone still goes into the second funnel, not the first.
    const fed = feed(done, STONE, 3, PRESS);
    expect({ heap: fed?.heap, otherHeap: fed?.otherHeap }).toEqual({ heap: 0, otherHeap: 3 });
  });

  test("and a third kind is refused rather than pressed into service", () => {
    expect(feed(shown(2, 1), "wheat", 1, PRESS)).toBeNull();
  });

  /**
   * And the scene asks the same question the feeding does.
   *
   * `wouldTake` exists because these were two rules in two files that said
   * the same thing for as long as there was one mouth to disagree about. The
   * scene's tip-in went on offering a child only what the *first* funnel
   * held, so a press could never be handed its second thing by hand — and a
   * press that cannot be shown its proportion cannot learn one.
   */
  test("would take either of its two kinds by hand, and nothing else", () => {
    const ready = shown(2, 1);
    expect(wouldTake(ready, WOOD, PRESS)).toBe(true);
    expect(wouldTake(ready, STONE, PRESS)).toBe(true);
    expect(wouldTake(ready, "wheat", PRESS)).toBe(false);
    // An empty one takes anything: the first thing shown claims a funnel.
    expect(wouldTake(wake(newMachine()), "wheat", PRESS)).toBe(true);
    // And a sleeping one takes nothing at all.
    expect(wouldTake(newMachine(), WOOD, PRESS)).toBe(false);
  });

  /**
   * What comes out is a fact about *both* funnels, which is what makes a
   * press different from every other machine here.
   *
   * A hothouse turns a crop into timber whatever crop it was, so its answer
   * lives in one field. A press has no single answer, and that is not an
   * inconvenience to work around — a machine whose output depends on two
   * inputs is the same sentence as a machine that teaches a proportion.
   */
  test("makes a beam out of the woodland and the hills", () => {
    const done = advance(shown(2, 1), MINUTES_PER_ROUND, PRESS);
    expect(done.made).toBe(MaterialType.Beam);
    expect(pressing(WOOD, STONE)).toBe(MaterialType.Beam);
    // Neither funnel is the special one: the same pair the other way round
    // is the same pressing, and only the numbers shown differ.
    expect(pressing(STONE, WOOD)).toBe(MaterialType.Beam);
  });

  /**
   * And cord out of the garden, which is the point of there being two.
   *
   * A beam is the woodland and the hills; cord is wheat and sunflowers. A
   * child who has only ever cleared can make one of them and not the other,
   * so the two pressings between them ask for both spells this game is
   * built on rather than only the one that pays.
   */
  test("and cord out of the garden", () => {
    const twisting = feed(
      feed(wake(newMachine()), "wheat", 4, PRESS) ?? wake(newMachine()),
      "sunflower",
      2,
      PRESS,
    );
    if (!twisting) throw new Error("a press refused the makings of cord");
    const done = advance(twisting, MINUTES_PER_ROUND, PRESS);
    expect(done.made).toBe(MaterialType.Cord);
    expect(done.crates.reduce((all, count) => all + count, 0)).toBe(1);
  });

  /**
   * A funnel filled with something no pressing wants would never empty.
   *
   * The one confusion this machine cannot afford. Stalling is what a press
   * does when it is working correctly and waiting for its other half, so a
   * press stalled because it is holding a carrot looks exactly like a press
   * doing its job — and there is nothing on it a child could read to tell
   * the two apart.
   */
  test("refuses what no pressing wants, rather than holding it for ever", () => {
    expect(feed(wake(newMachine()), "carrot", 3, PRESS)).toBeNull();
    expect(pressable("carrot")).toBe(false);
    expect(pressable(WOOD)).toBe(true);
  });

  test("and refuses a second kind that does not pair with the first", () => {
    // Wheat is pressable — with sunflowers. It is not pressable with wood,
    // and a press holding wood must say so now rather than after the heap
    // has gone in.
    const holding = feed(wake(newMachine()), WOOD, 4, PRESS);
    if (!holding) throw new Error("a press refused wood");
    expect(feed(holding, "wheat", 2, PRESS)).toBeNull();
    expect(feed(holding, STONE, 2, PRESS)).not.toBeNull();
  });

  test("its two funnels survive being written down", () => {
    const done = advance(shown(4, 2), MINUTES_PER_ROUND, PRESS);
    const machines = new Map([["3,4", done]]);
    expect(machinesFromSave(machinesToSave(machines))).toEqual(machines);
  });

  /** A press asleep is a sculpture, the same as every other machine. */
  test("takes nothing at all before it has been woken", () => {
    expect(feed(newMachine(), WOOD, 2, PRESS)).toBeNull();
  });
});
