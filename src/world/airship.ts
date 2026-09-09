// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { MaterialType } from "./materials";

/**
 * The airship: the one thing in this game that is finished.
 *
 * **Why there is an end at all.** Everything else here is a loop — a garden
 * is tended and tended again, a machine runs for ever once it is woken —
 * and a loop is the right shape for practice. But a child who has spent
 * forty afternoons pressing timber deserves to have been building
 * *towards* something, and the airships have been floating over the city
 * since her first walk into it. Building one is the game saying that the
 * thing she has been watching was always available to her.
 *
 * **It does not take the game away.** Flying is an ending and not a
 * deletion: she goes up, the city goes under her, and she comes back down
 * in her own garden — and from then on the airship is the quickest way
 * between the places she has walked to. Winning hands her something. A
 * five-year-old who "won" and could not get back to her carrots would have
 * been punished for finishing.
 *
 * **It is not a machine.** It does no arithmetic, it is never woken, and it
 * is not in the crate. It is assembled, a stage at a time, out of the three
 * parts at the top of the pressing tree — which is why this file holds
 * nothing but the order of the stages and what each one wants.
 *
 * **What it costs is having done, never having been right.** A stated
 * pillar of this game is that nothing is locked behind being good at
 * arithmetic, and an end goal is exactly where that rule would be easiest
 * to break. So no stage asks a question, no stage checks a rung, and a
 * child who has never once been quick at sums but has kept her garden
 * running will finish this. What it asks for is the parts.
 */

/** The stages, in the order they are built. */
export const AirshipStage = {
  /** The spine: trusses laid end to end, which is what everything hangs off. */
  Keel: "keel",
  /** The basket she stands in. */
  Basket: "basket",
  /** The gasbag over it, which is when it stops looking like a boat. */
  Balloon: "balloon",
  /** The fins that make it steerable rather than merely afloat. */
  Rudder: "rudder",
} as const;

export type AirshipStage = (typeof AirshipStage)[keyof typeof AirshipStage];

export interface StageSpec {
  readonly stage: AirshipStage;
  /** What this stage wants, and how much of it. */
  readonly wants: readonly (readonly [MaterialType, number])[];
}

/**
 * What each stage takes.
 *
 * Small numbers on purpose. Every one of these parts is already five
 * pressings deep — a single envelope has a cactus, a sunflower, some wheat,
 * a stone and a tree behind it — so asking for ten would not make the
 * airship feel bigger, it would make the last tier feel like a wall. The
 * depth is where the work is; this is where the shape is.
 *
 * The keel wants the most, and wants the *cheapest* of the three parts,
 * because it is the stage a child does first and the one that has to feel
 * like it started rather than like it refused.
 */
export const AIRSHIP_BUILD: readonly StageSpec[] = [
  { stage: AirshipStage.Keel, wants: [[MaterialType.Truss, 3]] },
  { stage: AirshipStage.Basket, wants: [[MaterialType.Gondola, 1]] },
  { stage: AirshipStage.Balloon, wants: [[MaterialType.Envelope, 1]] },
  { stage: AirshipStage.Rudder, wants: [[MaterialType.Vane, 2]] },
];

export const STAGE_COUNT = AIRSHIP_BUILD.length;

/** What has been carried up to it so far, by kind. */
export type Given = Readonly<Partial<Record<MaterialType, number>>>;

const held = (given: Given, material: MaterialType): number => given[material] ?? 0;

/** Whether everything this stage wants has been handed over. */
export function stageMet(given: Given, spec: StageSpec): boolean {
  return spec.wants.every(([material, many]) => held(given, material) >= many);
}

/**
 * How many stages are finished.
 *
 * **In order, and it stops at the first gap.** A child who somehow had an
 * envelope before a keel has not built a balloon — there is nothing to hang
 * it on — so the count is how far the build has got and not how many
 * stages happen to be satisfied. That also makes the sheet honest: the
 * stage it draws as *next* is always the one she can do.
 */
export function stagesDone(given: Given): number {
  let done = 0;
  for (const spec of AIRSHIP_BUILD) {
    if (!stageMet(given, spec)) break;
    done++;
  }
  return done;
}

/** The stage being built now, or nothing when it is finished. */
export function stageNow(given: Given): StageSpec | null {
  return AIRSHIP_BUILD[stagesDone(given)] ?? null;
}

/**
 * What the current stage is still short of.
 *
 * Empty when the airship is done. Written as what is *missing* rather than
 * what is wanted, because that is what the sheet beside it has to draw: a
 * child looking at it wants to know what to go and make next.
 */
export function stillWanted(given: Given): readonly (readonly [MaterialType, number])[] {
  const spec = stageNow(given);
  if (!spec) return [];
  return spec.wants
    .map(([material, many]) => [material, many - held(given, material)] as const)
    .filter(([, short]) => short > 0);
}

/** Whether it will fly. */
export function flies(given: Given): boolean {
  return stagesDone(given) === STAGE_COUNT;
}

/** Everything the whole airship takes, for the sheet that shows the plan. */
export function wholeBuild(): readonly (readonly [MaterialType, number])[] {
  return AIRSHIP_BUILD.flatMap((spec) => spec.wants);
}
