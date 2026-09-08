// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * The guide: a glowing button and a bobbing arrow, pointing at the next
 * thing to do, until she has done it.
 *
 * This is how the game teaches every action, and it teaches by pointing.
 * The alternative — a page of words about the pouch, given at the pouch —
 * was built and thrown away in an afternoon: half of this game's players
 * cannot read a word of either language it speaks, and the other half do
 * not want to. What they can all follow is a light on the button to press
 * and an arrow over the square to press it on. So a guide is a list of
 * **steps**, each a *cue* (what to light up) and a *deed* (what she does
 * that finishes it), and the game walks her through the steps one at a
 * time, in the world, with nothing said.
 *
 * **A guide is the action itself, done once with help.** Planting is the
 * pouch, then a seed, then the square in front of her — so the guide for
 * planting lights the pouch until it opens, lights a seed until one is in
 * her hand, and points at the square until a seed is in it. Nothing is
 * described that is not also, at that moment, the thing to press.
 *
 * **It starts when the action is worth doing, and only then.** Growing is
 * pointed out when there is something planted to grow; picking when
 * something is ripe; selling when the basket has something in it; placing
 * when the crate does. A guide for selling given to a child with an empty
 * basket would be an arrow to a shop with nothing to sell there. `when`
 * reads the world for that.
 *
 * **A step she has already done is skipped.** The pouch may be open when the
 * planting guide begins; a light on a button that is already pressed is a
 * light that lies. `already` reads the interface for that.
 *
 * **Each guide is given once, and remembered per child.** The set of guides
 * finished lives in the child's progress, like the spells they have been
 * taught. A guide that came back every time would be a game that never
 * stops pointing; a sibling on the same tablet has not been shown any of
 * it. The names are saved, so a guide's name is part of the save format:
 * renaming one gives it again to every child.
 *
 * **What has no guide, and what gained one.** The spells with a teacher were
 * all shown by the person who gives them, in their own lesson, and the rune
 * over that person's head was the whole of how a child was meant to find
 * them. Watched, that is not enough for the *first* of them: she has been
 * as far as the shop and no further, the tower is a building she has never
 * had a reason to open, and a rune she can only see once she is standing
 * under it cannot be what sends her there. So the portal has a guide — the
 * way to the tower, and then the man at the top of it — and the rune stays
 * where it is, doing the job it does well, which is saying *this one, still*
 * once she has arrived. The other four are still their teachers' own.
 *
 * The wheel over a bench has two
 * pictures on it and nothing else, and an arrow at one of them would be the
 * game choosing. Walking through a door needs no arrow; she can see the
 * door. The one arrow for a place is the shop's, because it is the first
 * time the game asks her to go somewhere she has not been.
 *
 * Nothing here knows Phaser. The scene answers `when` and `already`, emits
 * deeds, and draws whatever `cue()` says; this decides which.
 */

export const Guide = {
  /** The pouch, a seed, the square in front of her. */
  Plant: "plant",
  /** The spellbook, the + rune, a planted square — twice, until it is ripe. */
  Grow: "grow",
  /** The ripe crop. */
  Pick: "pick",
  /** The store's door, then the person behind the counter. */
  Sell: "sell",
  /** The crate, a group, a thing, the square in front of her. */
  Place: "place",
  /** A machine that is asleep. */
  Wake: "wake",
  /** The tower over the post office, and the man at the top of it. */
  Learn: "learn",
  /** The great tree's errand: the wood, the tree, and the spell it pays with. */
  Grove: "grove",
} as const;

export type Guide = (typeof Guide)[keyof typeof Guide];

/** Every guide, in the order they are offered: the core loop, then the rest. */
export const GUIDES: readonly Guide[] = [
  Guide.Plant,
  Guide.Grow,
  Guide.Pick,
  Guide.Sell,
  // After the shop, because the first errand a child is given that is not
  // about her own garden is the one that pays for it — and the spell at the
  // top of the tower is what the next errand needs.
  Guide.Learn,
  Guide.Place,
  Guide.Wake,
  // Last, because it is the only one that is not offered in the village: it
  // starts when she is standing in the wood, whenever that turns out to be.
  Guide.Grove,
];

/**
 * Something she did, as the scene reports it.
 *
 * Named for what happened rather than for which guide wants to know, so a
 * new guide can be written out of deeds the scene already reports.
 */
export const Deed = {
  OpenedSeeds: "opened-seeds",
  OpenedSpellbook: "opened-spellbook",
  OpenedCrate: "opened-crate",
  /** A group in the crate was opened, showing its things. */
  OpenedGroup: "opened-group",
  /** A seed is lit over her head, waiting for a square. */
  ArmedSeed: "armed-seed",
  /** The + rune is lit over her head. */
  ArmedGrowth: "armed-growth",
  /** A thing from the crate is in her hands. */
  ArmedThing: "armed-thing",
  Planted: "planted",
  /** A crop went up one stage. */
  Grew: "grew",
  /** A crop reached the stage it is picked at. */
  Ripened: "ripened",
  Picked: "picked",
  EnteredStore: "entered-store",
  OpenedShop: "opened-shop",
  /** A crop on the counter was chosen, so the shop is counting it out. */
  ChoseCrop: "chose-crop",
  /** The trade was agreed and paid for. */
  Sold: "sold",
  Placed: "placed",
  /** A machine was woken with a sum. */
  Woke: "woke",
  /** She climbed the tower over the post office. */
  ClimbedTower: "climbed-tower",
  /** A teacher gave her a spell she did not have. */
  LearnedSpell: "learned-spell",
  /** One square of the great tree's wood came down. */
  ClearedWood: "cleared-wood",
  /** Every square of it is down. */
  WoodAllDown: "wood-all-down",
  /** The tree gave her the times spell. */
  LearnedArray: "learned-array",
  /** The times rune is lit over her head. */
  ArmedArray: "armed-array",
  /** A patch was marked out and answered with a times sum. */
  CastArray: "cast-array",
} as const;

export type Deed = (typeof Deed)[keyof typeof Deed];

/**
 * What to light up, for the scene to find on the screen.
 *
 * A button is named as the scene names its buttons for scripts, so the
 * guide and the browser suite point at the same thing by the same name. The
 * rest are things in the world that only the scene can find: the square she
 * faces, the nearest crop, a door, a person, a sleeping machine.
 */
export type Cue =
  | { readonly kind: "button"; readonly name: string }
  /** The first seed in the pouch. */
  | { readonly kind: "seed" }
  /** The + rune in the spellbook. */
  | { readonly kind: "growth-rune" }
  /** The crate's group holding the first thing she has, or the thing itself once the group is open. */
  | { readonly kind: "crate-group" }
  | { readonly kind: "crate-thing" }
  /** The square in front of her, where a seed or a thing goes. */
  | { readonly kind: "ahead" }
  /** The nearest crop that is, or is not yet, ripe. */
  | { readonly kind: "crop"; readonly ripe: boolean }
  /** A building's door. */
  | { readonly kind: "door"; readonly building: string }
  /** Whoever is behind the counter of the room she is in. */
  | { readonly kind: "attendant" }
  /** The counter's row for the first crop in her basket. */
  | { readonly kind: "sell-row" }
  /** The nearest machine that is asleep. */
  | { readonly kind: "sleeping-machine" }
  /** The nearest square of the great tree's wood still standing. */
  | { readonly kind: "wood" }
  /** The great tree, once its wood is down and it has something to give. */
  | { readonly kind: "great-tree" }
  /** The times rune in the spellbook. */
  | { readonly kind: "array-rune" }
  /** The first empty square of the tree's beds. */
  | { readonly kind: "grove-bed" };

/**
 * What the scene can see of the interface, for `already`.
 *
 * Small on purpose: everything a step could have found already done.
 */
export interface GuideView {
  /** Which tray is open, by the name the scene gives it, or none. */
  readonly trayOpen: string | null;
  /** Whether the crate is showing one group's things rather than the groups. */
  readonly crateGroupOpen: boolean;
  /** What is lit over her head. */
  readonly armed: "seed" | "growth" | "array" | "thing" | "other" | null;
  /** The building she is in, or null out of doors. */
  readonly indoors: string | null;
}

/**
 * What the scene can see of the world, for `when`.
 *
 * Counts rather than lists: a guide only asks whether there is anything to
 * point at, and the scene finds *which* when it draws the cue.
 */
export interface GuideWorld {
  readonly outdoors: boolean;
  readonly unripeCrops: number;
  readonly ripeCrops: number;
  readonly cropsInBasket: number;
  readonly thingsInCrate: number;
  readonly sleepingMachines: number;
  /** Whether there is still a spell waiting to be given to her. */
  readonly spellToLearn: boolean;
  /** Squares of the great tree's wood still standing, nought away from it. */
  readonly woodStanding: number;
}

export interface Step {
  readonly cue: Cue;
  /** What finishes the step. */
  readonly until: Deed;
  /** Whether it is finished before it starts, which skips it. */
  readonly already?: (view: GuideView) => boolean;
}

export interface GuideSpec {
  readonly steps: readonly Step[];
  /** Whether the guide is worth starting now. */
  readonly when: (world: GuideWorld) => boolean;
  /**
   * Guides that have to be finished before this one may start.
   *
   * `when` alone cannot say this, and one guide needed it: the tower is
   * offered whenever the portal spell is still owed, which is true from the
   * first minute of the game. The world is re-read twice a second rather
   * than every frame, so in the half-second after she plants her first seed
   * the counts still say nothing is growing — and in that gap the tower was
   * the first guide whose `when` was true, so a child who had just put a
   * seed in the ground was sent to the post office.
   */
  readonly after?: readonly Guide[];
  /**
   * The deed that finishes the whole guide, for one whose steps go round
   * more than once. Growing is the spellbook, the rune and the crop *twice*
   * — once per stage — so its steps repeat until something ripens. A guide
   * without one finishes with its last step.
   */
  readonly done?: Deed;
}

const STORE = "store";
const TOWER = "post-office";

export const GUIDE_SPECS: Record<Guide, GuideSpec> = {
  [Guide.Plant]: {
    when: (world) => world.outdoors,
    steps: [
      {
        cue: { kind: "button", name: "seeds" },
        until: Deed.OpenedSeeds,
        already: (view) => view.trayOpen === "seeds",
      },
      { cue: { kind: "seed" }, until: Deed.ArmedSeed, already: (view) => view.armed === "seed" },
      { cue: { kind: "ahead" }, until: Deed.Planted },
    ],
  },
  [Guide.Grow]: {
    when: (world) => world.outdoors && world.unripeCrops > 0,
    done: Deed.Ripened,
    steps: [
      {
        cue: { kind: "button", name: "spellbook" },
        until: Deed.OpenedSpellbook,
        already: (view) => view.trayOpen === "spellbook",
      },
      {
        cue: { kind: "growth-rune" },
        until: Deed.ArmedGrowth,
        already: (view) => view.armed === "growth",
      },
      { cue: { kind: "crop", ripe: false }, until: Deed.Grew },
    ],
  },
  [Guide.Pick]: {
    when: (world) => world.outdoors && world.ripeCrops > 0,
    steps: [{ cue: { kind: "crop", ripe: true }, until: Deed.Picked }],
  },
  [Guide.Sell]: {
    when: (world) => world.cropsInBasket > 0,
    steps: [
      {
        cue: { kind: "door", building: STORE },
        until: Deed.EnteredStore,
        already: (view) => view.indoors === STORE,
      },
      { cue: { kind: "attendant" }, until: Deed.OpenedShop },
      // And then through the sale itself. Opening the counter used to be
      // where this stopped, on the argument that a shop is a shop and she
      // could see it — but what she is looking at is a page of prices with
      // her own carrot somewhere on it, and "sell" is not a word she can
      // read. Watched: a child reached the shopkeeper, opened the counter,
      // and had no idea which line was hers.
      { cue: { kind: "sell-row" }, until: Deed.ChoseCrop },
      { cue: { kind: "button", name: "shop.yes" }, until: Deed.Sold },
    ],
  },
  [Guide.Place]: {
    when: (world) => world.outdoors && world.thingsInCrate > 0,
    steps: [
      {
        cue: { kind: "button", name: "crate" },
        until: Deed.OpenedCrate,
        already: (view) => view.trayOpen === "crate",
      },
      {
        cue: { kind: "crate-group" },
        until: Deed.OpenedGroup,
        already: (view) => view.trayOpen === "crate" && view.crateGroupOpen,
      },
      {
        cue: { kind: "crate-thing" },
        until: Deed.ArmedThing,
        already: (view) => view.armed === "thing",
      },
      { cue: { kind: "ahead" }, until: Deed.Placed },
    ],
  },
  [Guide.Wake]: {
    when: (world) => world.outdoors && world.sleepingMachines > 0,
    steps: [{ cue: { kind: "sleeping-machine" }, until: Deed.Woke }],
  },
  [Guide.Grove]: {
    when: (world) => world.woodStanding > 0,
    steps: [
      // Three, and then it lets go. The wood is twelve squares and a child
      // who has taken three down knows how; a ring on each of the remaining
      // nine would be the game doing the errand with her. What carries the
      // other nine is the minus rune standing on each of them — see
      // `woodToClear` — which is a sign rather than an instruction.
      { cue: { kind: "wood" }, until: Deed.ClearedWood },
      { cue: { kind: "wood" }, until: Deed.ClearedWood },
      { cue: { kind: "wood" }, until: Deed.ClearedWood },
      // Drawn only once the wood is gone: until then this points at nothing
      // and the marks are put away, which is the quiet stretch above.
      { cue: { kind: "great-tree" }, until: Deed.LearnedArray },
      // And then the spell it just paid her with, on the beds it wants
      // filled. The whole argument for multiplication is those two things
      // happening ten seconds apart — see `openGroveLesson`.
      {
        cue: { kind: "button", name: "spellbook" },
        until: Deed.OpenedSpellbook,
        already: (view) => view.trayOpen === "spellbook",
      },
      {
        cue: { kind: "array-rune" },
        until: Deed.ArmedArray,
        already: (view) => view.armed === "array",
      },
      { cue: { kind: "grove-bed" }, until: Deed.CastArray },
    ],
  },
  [Guide.Learn]: {
    when: (world) => world.spellToLearn,
    // After the shop, which is also where it belongs in the telling: the
    // first errand that is not about her own garden is the one that pays
    // for it, and the spell at the top of the tower is what the next needs.
    after: [Guide.Sell],
    steps: [
      {
        cue: { kind: "door", building: TOWER },
        until: Deed.ClimbedTower,
        already: (view) => view.indoors === TOWER,
      },
      { cue: { kind: "attendant" }, until: Deed.LearnedSpell },
    ],
  },
};

/** Where a guide has got to. */
export interface Running {
  readonly guide: Guide;
  readonly step: number;
}

/**
 * The guides, one at a time, for one child.
 *
 * Holds which are finished and which is running, and nothing about the
 * screen. `tick` is asked every frame with what the scene can see and
 * starts or advances; `note` is told what she did; `cue` says what to
 * light. When a guide finishes, `finished` is told so the child's progress
 * can be written.
 */
export class GuideRun {
  private running: Running | null = null;
  private finishedGuides: Set<string>;

  constructor(
    finished: readonly string[],
    private readonly onFinished: (guide: Guide) => void,
  ) {
    this.finishedGuides = new Set(finished);
  }

  get current(): Running | null {
    return this.running;
  }

  /** The guides this child has been walked through. */
  get finished(): readonly string[] {
    return [...this.finishedGuides];
  }

  /**
   * Start a guide if none is running and one is worth it, and skip past
   * any step that is already done.
   *
   * The skip is checked every tick rather than only when a step begins,
   * because a step can be done by something other than its deed: the pouch
   * opened by the keyboard shortcut reports the same deed, but a seed put
   * back and taken out again is a step done twice with the light in the
   * wrong place in between.
   */
  tick(world: GuideWorld, view: GuideView): void {
    if (!this.running) {
      const next = GUIDES.find(
        (guide) =>
          !this.finishedGuides.has(guide) &&
          (GUIDE_SPECS[guide].after ?? []).every((need) => this.finishedGuides.has(need)) &&
          GUIDE_SPECS[guide].when(world),
      );
      if (!next) return;
      this.running = { guide: next, step: 0 };
    }
    // Skip what is already done, one step at a time and never past the
    // last: the last step of a guide is a deed she has to do.
    for (;;) {
      const run: Running | null = this.running;
      if (!run) return;
      const spec = GUIDE_SPECS[run.guide];
      const step = spec.steps[run.step];
      if (!step || run.step >= spec.steps.length - 1 || !step.already?.(view)) return;
      this.running = { guide: run.guide, step: run.step + 1 };
    }
  }

  /**
   * She did something. Advance the step it finishes, and finish the guide if
   * it was the last one, or the one the guide was waiting for.
   *
   * Only the *current* step's deed counts. A guide is a sequence, and a
   * child who plants before the pouch has been pointed at — from the keys,
   * say — has skipped a step the arrow will now point at anyway; that is
   * `already`'s job to notice, on the next tick.
   */
  note(deed: Deed): void {
    const run = this.running;
    if (!run) return;
    const spec = GUIDE_SPECS[run.guide];
    if (spec.done === deed) {
      this.finish(run.guide);
      return;
    }
    const step = spec.steps[run.step];
    if (!step || step.until !== deed) return;
    const next = run.step + 1;
    if (next < spec.steps.length) {
      this.running = { guide: run.guide, step: next };
    } else if (spec.done) {
      // Round again: the last step is done and the guide is not.
      this.running = { guide: run.guide, step: 0 };
    } else {
      this.finish(run.guide);
    }
  }

  /** What to light up right now, or nothing. */
  cue(): Cue | null {
    const run = this.running;
    if (!run) return null;
    return GUIDE_SPECS[run.guide].steps[run.step]?.cue ?? null;
  }

  /** Forget every guide, so each is given again when its moment comes. */
  forgetAll(): void {
    this.finishedGuides.clear();
    this.running = null;
  }

  private finish(guide: Guide): void {
    this.finishedGuides.add(guide);
    this.running = null;
    this.onFinished(guide);
  }
}

/**
 * A child's finished guides, read back from a save.
 *
 * Unknown names are dropped rather than kept: a name that is not a guide can
 * only have come from a different build. Absent in every save written before
 * there were guides, which reads as none finished — right for all of them,
 * since a child who has been playing for a month will be pointed at the
 * pouch once and press it, which is a small price for the child who never
 * found the crate.
 */
export function readGuided(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  const known = value.filter(
    (name): name is Guide =>
      typeof name === "string" && (GUIDES as readonly string[]).includes(name),
  );
  return [...new Set(known)];
}
