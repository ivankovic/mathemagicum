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
  /** The crate, the makers, a machine she can afford, the square in front of her. */
  Build: "build",
  /** A machine that is asleep. */
  Wake: "wake",
  /** An awake machine with an empty mouth, while she carries something it takes. */
  Feed: "feed",
  /** A machine with something in a crate, which is the thing it made. */
  Take: "take",
  /** The crate, the makers, the coil, one machine, then another. */
  Wire: "wire",
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
  // The machines, in the order a line is made: build one, wake it, feed it,
  // take what it made; and join two, once there are two. Each starts when
  // its moment comes and not before, so a child who has built one machine
  // is not pointed at the coil until a second is standing.
  Guide.Build,
  Guide.Wake,
  Guide.Feed,
  Guide.Take,
  Guide.Wire,
  // Last, because it is the only one that is not offered in the village: it
  // starts when she is standing in the wood, whenever that turns out to be.
  Guide.Grove,
];

/**
 * The guides that make up the machine tutorial, for showing again on their
 * own.
 *
 * The sheet's row for the whole tutorial forgets every guide, and a parent
 * who wants to show a child the machines a second time does not want to
 * walk them through the pouch again to get there.
 */
export const MACHINE_GUIDES: readonly Guide[] = [
  Guide.Build,
  Guide.Wake,
  Guide.Feed,
  Guide.Take,
  Guide.Wire,
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
  /** A machine was made out of what the world gave up, and is in her hands. */
  BuiltMachine: "built-machine",
  /** A machine was woken with a sum. */
  Woke: "woke",
  /** A heap she was carrying went into a machine's mouth. */
  Fed: "fed",
  /** Something a machine made, or binned, came out into her basket. */
  Took: "took",
  /** The coil is lit over her head, with neither end named. */
  ArmedWire: "armed-wire",
  /** The first tap of a wire: the machine it comes off. */
  WiredFrom: "wired-from",
  /** The second tap: the wire is strung. */
  Wired: "wired",
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
  /** The makers' group in the crate, or the crate itself while it is shut. */
  | { readonly kind: "crate-makers" }
  /** The first machine in the crate she can afford, once the makers are open. */
  | { readonly kind: "crate-machine" }
  /** The coil, once the makers are open. */
  | { readonly kind: "crate-coil" }
  /** The nearest awake machine with an empty mouth that would take what she carries. */
  | { readonly kind: "hungry-machine" }
  /** The nearest machine with something in a crate or its bin. */
  | { readonly kind: "full-machine" }
  /** The machine a wire should come off, or the coil while she has not got it. */
  | { readonly kind: "wire-from" }
  /** The machine the wire in her hands should feed, or the coil if she put it down. */
  | { readonly kind: "wire-to" }
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
  /**
   * What is lit over her head.
   *
   * A machine is told from a thing because building one is its own errand,
   * and a coil from everything else because it is the one armed thing that
   * takes two taps: `wireFrom` says whether the first has landed.
   */
  readonly armed: "seed" | "growth" | "array" | "thing" | "machine" | "wire" | "other" | null;
  /** Whether the coil over her head already has hold of one end. */
  readonly wireFrom: boolean;
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
  /**
   * Machines the crate offers that her basket could pay for right now, while
   * she is holding none. Nought until she has been up the hills for the
   * stone, which is what makes this a guide that starts when it is worth it
   * rather than one pointing at a slot that would only refuse her.
   */
  readonly machinesToBuild: number;
  /** Awake machines near her with an empty mouth, that would take something she carries. */
  readonly hungryMachines: number;
  /** Machines near her with something in a crate or a bin, waiting to be taken out. */
  readonly fullMachines: number;
  /** Pairs of awake machines near her within a wire's reach of each other, not yet joined. */
  readonly wirePairs: number;
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
        already: (view) => view.armed === "thing" || view.armed === "machine",
      },
      { cue: { kind: "ahead" }, until: Deed.Placed },
    ],
  },
  // The machines. Watched: a child with a garden full of carrots and a
  // basket full of timber had no idea what she was supposed to do, and it
  // was not that the machines were hard — it was that nothing anywhere
  // pointed at them. The crate showed a picture of a sorter in a group she
  // had never opened, and everything after it — the sum, the mouth, the
  // crates underneath — was a tap on a thing that looked like scenery.
  //
  // So the errand is the whole line, in the order a line is made, one guide
  // to a step so that each starts at its own moment: the machine when she
  // can pay for one, the waking when it stands there asleep, the feeding
  // when she has something in her basket it eats, the taking when it has
  // made something — which is where a child ends up with a thing a machine
  // made, and the whole reason for the rest. The wire is last and needs two
  // machines standing, because that is what a wire is for.
  [Guide.Build]: {
    when: (world) => world.outdoors && world.machinesToBuild > 0,
    steps: [
      {
        cue: { kind: "button", name: "crate" },
        until: Deed.OpenedCrate,
        already: (view) => view.trayOpen === "crate",
      },
      {
        cue: { kind: "crate-makers" },
        until: Deed.OpenedGroup,
        already: (view) => view.trayOpen === "crate" && view.crateGroupOpen,
      },
      // Tapping the picture is what builds it: there is no workshop. The
      // deed is the build rather than the arming, so a fence taken out of
      // the crate instead does not count as a machine made.
      {
        cue: { kind: "crate-machine" },
        until: Deed.BuiltMachine,
        already: (view) => view.armed === "machine",
      },
      { cue: { kind: "ahead" }, until: Deed.Placed },
    ],
  },
  [Guide.Wake]: {
    when: (world) => world.outdoors && world.sleepingMachines > 0,
    steps: [{ cue: { kind: "sleeping-machine" }, until: Deed.Woke }],
  },
  [Guide.Feed]: {
    when: (world) => world.outdoors && world.hungryMachines > 0,
    steps: [{ cue: { kind: "hungry-machine" }, until: Deed.Fed }],
  },
  [Guide.Take]: {
    when: (world) => world.outdoors && world.fullMachines > 0,
    steps: [{ cue: { kind: "full-machine" }, until: Deed.Took }],
  },
  [Guide.Wire]: {
    when: (world) => world.outdoors && world.wirePairs > 0,
    steps: [
      {
        cue: { kind: "button", name: "crate" },
        until: Deed.OpenedCrate,
        already: (view) => view.trayOpen === "crate",
      },
      {
        cue: { kind: "crate-makers" },
        until: Deed.OpenedGroup,
        already: (view) => view.trayOpen === "crate" && view.crateGroupOpen,
      },
      {
        cue: { kind: "crate-coil" },
        until: Deed.ArmedWire,
        already: (view) => view.armed === "wire",
      },
      // Two taps, and an arrow for each: the machine the wire comes off,
      // then the one it feeds. A coil put down part way is pointed back at
      // by the scene — see `wire-to` — rather than by a step going back.
      {
        cue: { kind: "wire-from" },
        until: Deed.WiredFrom,
        already: (view) => view.armed === "wire" && view.wireFrom,
      },
      { cue: { kind: "wire-to" }, until: Deed.Wired },
    ],
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

  /**
   * Forget some of them, and put down whichever is running: a guide that
   * was half way through when it was forgotten would otherwise carry on and
   * be marked finished a second time.
   */
  forget(guides: readonly Guide[]): void {
    for (const guide of guides) this.finishedGuides.delete(guide);
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
