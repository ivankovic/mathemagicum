// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * The seven difficulty ladders, and the windows of recent casts that move them.
 *
 * Split out of `GameScene`, where each ladder was its own five-line method
 * over its own `recent*Casts` field: the same shape seven times, differing
 * only in which profile field it read, which dev seam could hold it still,
 * and where its top rung was. Seven copies were seven places for a rule to
 * drift — one of them had already lost the comment that explains why a dev
 * seam is exempt — so the rule lives here once, and each spell is a row in
 * a table.
 *
 * The whole of the adaptation, and deliberately silent: nothing on screen
 * says a rung changed, there is no level, no badge and no sound. A child who
 * is flying simply finds the sums getting bigger, and one who is stuck finds
 * them getting smaller — which is what a good teacher does and what a
 * progress bar does not. It cannot leave the band somebody picked, so the
 * worst it can do is nudge.
 *
 * Each spell has a ladder of its own because fluency does not carry across:
 * a run of clean sums says nothing about whether a child can read a ruler,
 * seeing that four rows of six is twenty-four is not the skill that adds
 * 347 and 265, and filling a gap in a wall — half of them run the sum
 * backwards — is a third thing again. Mixing the windows would move every
 * dial on evidence about one.
 */

import { nextVennRung } from "../../minigames/venn";
import type { Profile } from "../../save/profiles";
import { HARDEST_BRICK_RUNG } from "../../spells/bricks";
import type { CastResult } from "../../spells/cast";
import { type Recent, bandAt, nextRung, recordCast } from "../../spells/difficulty";
import { HARDEST_SHARE_RUNG } from "../../spells/division";
import { HARDEST_CLOCK_RUNG } from "../../spells/hourglass";
import { nextLogicRung } from "../../spells/logic";
import { HARDEST_ARRAY_RUNG } from "../../spells/multiplication";
import { HARDEST_PORTAL_RUNG } from "../../spells/portal";
import { nextSymmetryRung } from "../../spells/symmetry";
import type { DevOptions } from "../devHooks";

/**
 * A ladder is named by the profile field that holds the child's rung on it.
 *
 * The dev seam that can hold a ladder still (`?rung=`, `?portalRung=`, …)
 * has the same name on `DevOptions`, which is what lets one `note` serve
 * all seven without a lookup table of its own.
 */
export type LadderKey =
  | "rung"
  | "portalRung"
  | "arrayRung"
  | "shareRung"
  | "clockRung"
  | "symmetryRung"
  | "logicRung"
  | "vennRung"
  | "brickRung";

/** The rung a ladder would move to, given the child and how they have been doing. */
type Climb = (profile: Profile, recent: Recent) => number;

/**
 * One row per spell. Six of them share `nextRung`, fenced at the child's
 * band scaled onto their own length; the mirror is the one ladder with no
 * band in it. See `nextSymmetryRung`: folding is a way of looking rather
 * than a fluency, so an older child starts on the square with everybody
 * else and climbs from there.
 */
const LADDERS: Readonly<Record<LadderKey, Climb>> = {
  rung: (p, recent) => nextRung(bandAt(p.band), p.rung, recent),
  portalRung: (p, recent) => nextRung(bandAt(p.band), p.portalRung, recent, HARDEST_PORTAL_RUNG),
  arrayRung: (p, recent) => nextRung(bandAt(p.band), p.arrayRung, recent, HARDEST_ARRAY_RUNG),
  shareRung: (p, recent) => nextRung(bandAt(p.band), p.shareRung, recent, HARDEST_SHARE_RUNG),
  clockRung: (p, recent) => nextRung(bandAt(p.band), p.clockRung, recent, HARDEST_CLOCK_RUNG),
  symmetryRung: (p, recent) => nextSymmetryRung(p.symmetryRung, recent),
  logicRung: (p, recent) => nextLogicRung(p.logicRung, recent),
  vennRung: (p, recent) => nextVennRung(p.vennRung, recent),
  brickRung: (p, recent) => nextRung(bandAt(p.band), p.brickRung, recent, HARDEST_BRICK_RUNG),
};

/** What the ladders need from the scene: read as closures, because the scene replaces its profile on every save. */
export interface LadderHost {
  readonly profile: () => Profile;
  readonly dev: () => DevOptions;
  readonly save: (change: Partial<Profile>) => void;
}

export class Ladders {
  /**
   * How the last few casts went on each ladder, for the difficulty to read.
   *
   * Kept for this sitting only rather than saved with the child. A window
   * that survived a reload would have a child judged on yesterday, and
   * losing it costs at most one extra cast before the next nudge.
   */
  private readonly recent: Record<LadderKey, Recent> = {
    rung: [],
    portalRung: [],
    arrayRung: [],
    shareRung: [],
    clockRung: [],
    symmetryRung: [],
    logicRung: [],
    vennRung: [],
    brickRung: [],
  };

  constructor(private readonly host: LadderHost) {}

  /** The rung a spell is cast at: the dev seam's while one is holding it, else the child's own. */
  held(key: LadderKey): number {
    return this.host.dev()[key] ?? this.host.profile()[key];
  }

  /** How the last few casts went on one ladder, oldest first. */
  window(key: LadderKey): Recent {
    return this.recent[key];
  }

  /**
   * Let a ladder see how a cast went, and move it if it should.
   *
   * Gives back whether the child's saved rung actually moved, for the one
   * caller that has something to redraw when it does.
   */
  note(key: LadderKey, result: CastResult): boolean {
    const profile = this.host.profile();
    this.recent[key] = recordCast(this.recent[key], result);
    const moved = LADDERS[key](profile, this.recent[key]);
    if (moved === profile[key]) return false;
    // Cleared whenever it moves. Left alone, the four clean casts that earned
    // a climb would still be sitting there on the next cast and earn another
    // one straight away, walking a child from the bottom of their band to the
    // top in five casts — a ramp rather than an adaptation.
    this.recent[key] = [];
    // Not while a `?rung=`-style seam is holding the spell at one setting.
    // The adaptation is computed against the child's own saved rung rather
    // than the one being looked at, so a dev session that answered four
    // cleanly would move a real child up a rung nobody watched them earn.
    // The seam shows; it does not teach.
    if (this.host.dev()[key] !== null) return false;
    const change: { -readonly [K in LadderKey]?: number } = {};
    change[key] = moved;
    this.host.save(change);
    return true;
  }

  /** Forget the recent casts on these ladders; see `GameScene.applyBand` for which and why. */
  empty(keys: readonly LadderKey[]): void {
    for (const key of keys) this.recent[key] = [];
  }
}
