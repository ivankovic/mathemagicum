// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import {
  EARNED_BY_ERRAND,
  JOBS,
  JOB_SPECS,
  Job,
  LINES_WANTED,
  type LineView,
  RINGS_WANTED,
  SHELVED,
  nextJob,
  offered,
  readJobs,
} from "./jobs";
import { MACHINE_TYPES, MachineType, newMachine, wake } from "./machines";

const at = (key: string, type: MachineType, state = wake(newMachine())) => ({ key, type, state });

describe("the list of jobs", () => {
  test("names each one once, and every job needs machines", () => {
    expect([...new Set(JOBS)]).toEqual([...JOBS]);
    for (const job of JOBS) expect(JOB_SPECS[job].needs.length).toBeGreaterThan(0);
  });

  test("asks for no machine that is shelved", () => {
    // The rule that keeps a shelf honest. A job wanting a machine nobody
    // can get hold of is a job that can never be finished, and the child it
    // happens to would simply run out of jobs with the sheet still open.
    for (const job of JOBS) {
      for (const machine of JOB_SPECS[job].needs) {
        expect(SHELVED).not.toContain(machine);
      }
    }
  });

  test("are given in order, and run out", () => {
    expect(nextJob([])).toBe(Job.Either);
    expect(nextJob([Job.Either])).toBe(Job.Ring);
    expect(nextJob([Job.Either, Job.Ring])).toBe(Job.Else);
    expect(nextJob([...JOBS])).toBe(null);
  });
});

describe("two lines into one funnel", () => {
  const funnel = at("5,5", MachineType.Funnel);
  const sorter = at("2,5", MachineType.Sorter);
  const hothouse = at("8,5", MachineType.Hothouse);
  const tipped = at("5,8", MachineType.Tally, {
    ...wake(newMachine()),
    crates: [3, 3, 3],
    made: "wood",
  });
  const waiting = at("5,8", MachineType.Tally);

  test("counts the lines strung into it, and finishes once the tally has tipped", () => {
    const progress = JOB_SPECS[Job.Either].progress;
    expect(progress({ machines: [funnel], wires: [] })).toBe(0);
    // One line in, nothing out: one of two.
    expect(progress({ machines: [funnel, sorter], wires: [{ from: "2,5", to: "5,5" }] })).toBe(1);
    // Two lines in but nothing tipped yet: still one short, because a funnel
    // that goes nowhere is not a line.
    const twoIn: LineView = {
      machines: [funnel, sorter, hothouse, waiting],
      wires: [
        { from: "2,5", to: "5,5" },
        { from: "8,5", to: "5,5" },
        { from: "5,5", to: "5,8" },
      ],
    };
    expect(progress(twoIn)).toBe(LINES_WANTED - 1);
    expect(progress({ ...twoIn, machines: [funnel, sorter, hothouse, tipped] })).toBe(LINES_WANTED);
  });

  test("the same machine wired twice is one line", () => {
    const progress = JOB_SPECS[Job.Either].progress;
    expect(
      progress({
        machines: [funnel, sorter, tipped],
        wires: [
          { from: "2,5", to: "5,5" },
          { from: "2,5", to: "5,5" },
          { from: "5,5", to: "5,8" },
        ],
      }),
    ).toBe(1);
  });
});

describe("a bell rung ten times", () => {
  test("counts its rings, and no further than asked", () => {
    const progress = JOB_SPECS[Job.Ring].progress;
    const bell = (rung: number) => at("1,1", MachineType.Bell, { ...wake(newMachine()), rung });
    expect(progress({ machines: [], wires: [] })).toBe(0);
    expect(progress({ machines: [bell(4)], wires: [] })).toBe(4);
    expect(progress({ machines: [bell(40)], wires: [] })).toBe(RINGS_WANTED);
  });
});

describe("the jobs after the bell", () => {
  const stateWith = (extra: Partial<ReturnType<typeof newMachine>>) => ({
    ...wake(newMachine()),
    ...extra,
  });

  test("a trapdoor counts what it passed, a seesaw what it dealt each way, a strongbox what it let out", () => {
    const inverter = at("1,1", MachineType.Inverter, stateWith({ crates: [2, 2, 1], bin: 5 }));
    expect(JOB_SPECS[Job.Else].progress({ machines: [inverter], wires: [] })).toBe(5);
    // Three each way and no more: a seesaw that dealt six down one end
    // scores three.
    const lopsided = at("1,1", MachineType.Seesaw, stateWith({ crates: [2, 2, 2], bin: 0 }));
    const even = at("1,1", MachineType.Seesaw, stateWith({ crates: [1, 1, 1], bin: 3 }));
    expect(JOB_SPECS[Job.Parity].progress({ machines: [lopsided], wires: [] })).toBe(3);
    expect(JOB_SPECS[Job.Parity].progress({ machines: [even], wires: [] })).toBe(6);
    const latch = at("1,1", MachineType.Latch, stateWith({ crates: [3, 3, 3] }));
    expect(JOB_SPECS[Job.Hold].progress({ machines: [latch], wires: [] })).toBe(6);
    // The blueprint's own job, which kept working while the machine was shelved:
    // what was switched off was getting hold of one, not the code that
    // counts its stampings — which is why putting it back was one line.
    const drawn = at("1,1", MachineType.Blueprint, stateWith({ rung: 2 }));
    expect(JOB_SPECS[Job.Twice].progress({ machines: [drawn], wires: [] })).toBe(1);
  });
});

describe("what the crate offers", () => {
  test("holds the bell back until the funnel has been made to work", () => {
    expect(offered([])).not.toContain(MachineType.Bell);
    expect(offered([])).toContain(MachineType.Funnel);
    expect(offered([Job.Either])).toContain(MachineType.Bell);
    // And each machine after it waits for the job before it, in order.
    expect(offered([Job.Either])).not.toContain(MachineType.Inverter);
    expect(offered([Job.Either, Job.Ring])).toContain(MachineType.Inverter);
    expect(offered([Job.Either, Job.Ring])).not.toContain(MachineType.Seesaw);
    expect(offered([Job.Either, Job.Ring, Job.Else, Job.Parity])).toContain(MachineType.Latch);
    // The blueprint is not hers to give, however many jobs are done: it is
    // earned up the mountain, and the crate offers it only once the scene
    // says the climb is lit. Named, it is offered whatever the jobs say.
    expect(offered([...JOBS])).not.toContain(MachineType.Blueprint);
    expect(offered([], [MachineType.Blueprint])).toContain(MachineType.Blueprint);
    expect([...offered([...JOBS], [...EARNED_BY_ERRAND])].sort()).toEqual(
      [...MACHINE_TYPES].filter((one) => !SHELVED.includes(one)).sort(),
    );
  });

  test("a machine an errand earns is one no job unlocks, and is not shelved", () => {
    for (const machine of EARNED_BY_ERRAND) {
      expect(SHELVED).not.toContain(machine);
      for (const job of JOBS) expect(JOB_SPECS[job].unlocks).not.toBe(machine);
    }
  });

  test("reads the jobs done back from a save, dropping what it does not know", () => {
    expect(readJobs(["either", "either", "trebuchet", 3])).toEqual(["either"]);
    expect(readJobs(undefined)).toEqual([]);
  });
});
