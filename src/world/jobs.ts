// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { type MachineState, MachineType } from "./machines";
import type { Wire } from "./wires";

/**
 * The mechanic's jobs: the lines she asks a child to build, and what each
 * one earns.
 *
 * A machine on its own is a thing; two machines wired together are a
 * *program*, and this is where the game says so. Each job is a small line
 * — these machines, wired this way, doing this — and it is checked by the
 * garden rather than by a parchment: the tally tips, the bell rings, and
 * the sheet on her bench fills in. Nothing is typed and nothing is marked;
 * the line either works or it does not, which is what a program is.
 *
 * **Each job is a programming idea with a machine at the end of it.** Two
 * lines into one funnel is *merging*; a bell that has rung ten times is
 * *output*, and the first thing a child has built that tells them
 * something. The jobs after these — everything but wood to the bin, odd
 * and even dealt apart, timber kept until night, the same line built twice
 * — are the rest of the tree, and each will come with the machine that
 * makes it possible.
 *
 * **A job earns the next machine.** Not by handing it over: by letting the
 * crate offer it. The bell's recipe is beams and stone whether or not the
 * first job is done, but the crate does not show a bell to a child
 * who has not yet made a funnel work, because a line with a bell on the
 * end is the second thing to build and not the first. This is the whole
 * of the gating, and it gates on *having done*, never on arithmetic.
 *
 * **Progress is read off the garden every tick**, and remembered per child
 * once the job is finished, like a spell learned. What is *counted* is
 * chosen so a child can see it in the world: two wires into the funnel,
 * ten rings of the bell.
 */

export const Job = {
  /** Two lines into one funnel, and the funnel into a tally that tips. */
  Either: "either",
  /** A bell that has rung ten times. */
  Ring: "ring",
  /** An inverter shown one thing, that has passed six of everything else. */
  Else: "else",
  /** A seesaw that has dealt three things each way. */
  Parity: "parity",
  /** A latch that has let six things out at night. */
  Hold: "hold",
  /** A blueprint stamped down once: the same line built twice. */
  Twice: "twice",
} as const;

export type Job = (typeof Job)[keyof typeof Job];

/** Every job, in the order she gives them. */
export const JOBS: readonly Job[] = [
  Job.Either,
  Job.Ring,
  Job.Else,
  Job.Parity,
  Job.Hold,
  Job.Twice,
];

/** What the scene can see of the garden's lines. */
export interface LineView {
  readonly machines: readonly {
    readonly key: string;
    readonly type: MachineType;
    readonly state: MachineState;
  }[];
  readonly wires: readonly Wire[];
}

export interface JobSpec {
  /** The machines the line is made of, for the sheet's pictures. */
  readonly needs: readonly MachineType[];
  /** What one token in the row stands for, and how many the job wants. */
  readonly token: MachineType | "wire";
  readonly wanted: number;
  /** How far along the garden is: nought to `wanted`. */
  readonly progress: (line: LineView) => number;
  /** The machine the crate offers once this is done, if any. */
  readonly unlocks: MachineType | null;
}

/** How many times the bell has to ring. */
export const RINGS_WANTED = 10;
/** How many lines the funnel has to be fed by. */
export const LINES_WANTED = 2;
/** How many things an inverter has to pass, and a latch let out. */
export const PASSED_WANTED = 6;
/** How many things a seesaw has to deal each way. */
export const EACH_WAY_WANTED = 3;

export const JOB_SPECS: Readonly<Record<Job, JobSpec>> = {
  [Job.Either]: {
    needs: [MachineType.Funnel, MachineType.Tally],
    token: "wire",
    wanted: LINES_WANTED,
    // The best funnel in the garden: the one with the most lines into it
    // that also feeds a tally which has tipped at least once. A funnel fed
    // by two lines that goes nowhere is a funnel, not a line; a tally that
    // has tipped is the proof something came through.
    progress: (line) => {
      let best = 0;
      for (const funnel of line.machines.filter((one) => one.type === MachineType.Funnel)) {
        const into = new Set(
          line.wires.filter((wire) => wire.to === funnel.key).map((w) => w.from),
        );
        const out = line.wires
          .filter((wire) => wire.from === funnel.key)
          .map((wire) => line.machines.find((one) => one.key === wire.to))
          .some((sink) => sink?.type === MachineType.Tally && tipped(sink.state));
        // Lines count as soon as they are strung — that is the row filling
        // in as she works — but only all the way once the tally has tipped.
        const lines = Math.min(LINES_WANTED, into.size);
        best = Math.max(best, out ? lines : Math.min(lines, LINES_WANTED - 1));
      }
      return best;
    },
    unlocks: MachineType.Bell,
  },
  [Job.Ring]: {
    needs: [MachineType.Bell],
    token: MachineType.Bell,
    wanted: RINGS_WANTED,
    progress: (line) =>
      Math.min(
        RINGS_WANTED,
        Math.max(
          0,
          ...line.machines.filter((one) => one.type === MachineType.Bell).map((b) => b.state.rung),
        ),
      ),
    unlocks: MachineType.Inverter,
  },
  [Job.Else]: {
    needs: [MachineType.Inverter],
    token: MachineType.Inverter,
    wanted: PASSED_WANTED,
    // What an inverter has *passed*: everything but the thing it was shown.
    // Its bin filling is the sieve's lesson again; what is new here is the
    // else, and the else is what comes out of the spout.
    progress: (line) =>
      Math.min(
        PASSED_WANTED,
        Math.max(0, ...line.machines.filter((one) => one.type === MachineType.Inverter).map(held)),
      ),
    unlocks: MachineType.Seesaw,
  },
  [Job.Parity]: {
    needs: [MachineType.Seesaw],
    token: MachineType.Seesaw,
    wanted: EACH_WAY_WANTED * 2,
    // Three each way: a seesaw that had dealt six down one end would be a
    // seesaw that never tipped, and tipping is the whole of the lesson.
    progress: (line) =>
      Math.max(
        0,
        ...line.machines
          .filter((one) => one.type === MachineType.Seesaw)
          .map(
            (one) =>
              Math.min(EACH_WAY_WANTED, held(one)) + Math.min(EACH_WAY_WANTED, one.state.bin),
          ),
      ),
    unlocks: MachineType.Latch,
  },
  [Job.Hold]: {
    needs: [MachineType.Latch],
    token: MachineType.Latch,
    wanted: PASSED_WANTED,
    // What a latch has let out, which it only ever does at night: the
    // crates are the proof it held until then.
    progress: (line) =>
      Math.min(
        PASSED_WANTED,
        Math.max(0, ...line.machines.filter((one) => one.type === MachineType.Latch).map(held)),
      ),
    unlocks: MachineType.Blueprint,
  },
  [Job.Twice]: {
    needs: [MachineType.Blueprint],
    token: MachineType.Blueprint,
    wanted: 1,
    // Stamped down once. A blueprint counts its stampings where a bell
    // counts its rings — see `MachineState.rung`.
    progress: (line) =>
      Math.min(
        1,
        Math.max(
          0,
          ...line.machines
            .filter((one) => one.type === MachineType.Blueprint)
            .map((b) => b.state.rung),
        ),
      ),
    unlocks: null,
  },
};

/** What a machine has put in its crates altogether, which is what it passed on. */
function held(one: { readonly state: MachineState }): number {
  return one.state.crates.reduce((sum, count) => sum + count, 0);
}

/** Whether a tally has ever gone over: its crates hold what it tipped. */
function tipped(state: MachineState): boolean {
  return state.crates.some((count) => count > 0) || state.made !== null;
}

/** The first job not yet done, in her order, or none. */
export function nextJob(done: readonly string[]): Job | null {
  return JOBS.find((job) => !done.includes(job)) ?? null;
}

/**
 * Which machines the crate may offer, given the jobs done.
 *
 * Every machine no job unlocks is offered from the start; a machine some
 * job unlocks waits for it. Read from the specs rather than listed, so a
 * job added with an `unlocks` gates its machine without a second edit.
 */
export function offered(done: readonly string[]): readonly MachineType[] {
  const gated = new Map<MachineType, Job>();
  for (const job of JOBS) {
    const spec = JOB_SPECS[job];
    if (spec.unlocks) gated.set(spec.unlocks, job);
  }
  return Object.values(MachineType).filter((machine) => {
    const by = gated.get(machine);
    return by === undefined || done.includes(by);
  });
}

/**
 * The jobs read back from a save: names only, unknown ones dropped.
 */
export function readJobs(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  const known = value.filter(
    (name): name is Job => typeof name === "string" && (JOBS as readonly string[]).includes(name),
  );
  return [...new Set(known)];
}
