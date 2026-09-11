// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { type Page, chromium } from "playwright";
import { type Region, regionOf } from "../src/minigames/venn";
import { GAMES_KEY, PLAYING_KEY, gameKey } from "../src/save/games";
// The seams as the game *declares* them, not as a scenario remembers them.
// Type-only, so nothing of the game is loaded into the test process — what
// crosses is the shape, and the shape is the contract. See `Handles`.
import type { DevHandle, MakingHandle } from "../src/scenes/devHooks";
// The game's own feel constant rather than a copy: a harness holding its own
// idea of how far a swipe goes is a harness that silently stops matching.
import { SAND_MOST_MS, SWIPE_PER_TICK, TICK_MINUTES } from "../src/spells/hourglass";
import { SPELLS, Spell } from "../src/spells/spellbook";
import type { Facing } from "../src/world/characters";
import { type CrateWire, groupOf } from "../src/world/crate";
import type { DecorType } from "../src/world/decor";
import type { FixtureType } from "../src/world/fixtures";
import { FLOWER_TYPES, type FlowerType } from "../src/world/flowers";
import type { ItemType } from "../src/world/inventory";
import { PLANT_TYPES, type PlantType } from "../src/world/plants";
import type { PatchAction } from "../src/world/selection";

/**
 * What the game hangs on the window for a script, with its real types.
 *
 * Every `page.evaluate` in this suite begins the same way: reach for
 * `globalThis.__mathemagicum` and cast it to something. For a long time that
 * something was `Record<string, Record<string, unknown>>` — a shape that
 * says nothing — followed by a second cast to whichever three fields the
 * caller wanted, written out by hand. Forty-one copies of that, and not one
 * of them could tell the compiler anything: a seam renamed in `devHooks.ts`
 * was a scenario that typechecked, built, opened a browser, and failed thirty
 * seconds later with "not a function" from inside the page.
 *
 * This is the same cast with the game's own interface behind it. A seam that
 * moves now fails `tsc`, before anything is run. The cast itself cannot be
 * shared — a function handed to `evaluate` is serialised and runs in the
 * page, where nothing from this file exists — so the one line every body
 * still needs is:
 *
 *     const handle = (globalThis as never as Handles).__mathemagicum;
 *
 * Prefer a method on `Game` where one exists; add one where a scenario finds
 * itself writing the same body twice.
 */
export interface Handles {
  readonly __mathemagicum?: DevHandle;
  readonly __mathemagicum_making?: MakingHandle;
}

/** The room she is in, as the `house` seam describes it. */
export type House = NonNullable<ReturnType<DevHandle["house"]>>;

/**
 * Playing the real game, in a real browser, as a test.
 *
 * The rest of the suite runs against the pure modules and runs in eleven
 * seconds. It cannot reach the half of this game that only exists once
 * Phaser is up: the scene, the parchments, the trays. That half is eleven
 * thousand lines, and two of the three bugs written while the house was
 * built lived in it.
 *
 * So these are the loops that *cross* that line — sell a crop and count out
 * the change, build a room and come back to it tomorrow — driven through the
 * same dev seams a person would use, and asserted on what the game says
 * about itself rather than on pixels. A screenshot test would fail on every
 * change to a colour ramp; these fail when the game stops working.
 *
 * **Not part of `bun test`.** They need a browser and a build, and they take
 * seconds rather than milliseconds — a pre-commit hook that had to start
 * Vite is a hook people learn to skip. `bun run e2e` runs them.
 */

/**
 * A port of the suite's own, deliberately not 5173.
 *
 * It used to reuse whatever was already answering there, on the reasonable-
 * sounding argument that a person running these has a dev server open
 * already. Two things are wrong with that. The suite's teardown was then
 * killing a server it did not start, out from under whoever was using it;
 * and a run that inherits a Vite which has been up for hours is a run whose
 * results depend on what that session did.
 *
 * It is *not* what makes a long run stall — measured, because it looked like
 * the answer: a fresh server of this suite's own still had one load in
 * twelve blow past forty-five seconds. See the note on `ANSWER_MS` for where
 * that actually comes from.
 */
const PORT = Number(process.env.E2E_PORT ?? 0);

/** Where the server actually ended up, which is not always where it was asked. */
let origin: string | null = null;

/** `E2E_TRACE=1` prints every step and what it cost, for finding a stall. */
const TRACE = process.env.E2E_TRACE === "1";

let serving: ReturnType<typeof Bun.serve> | null = null;

/**
 * Anything that must not be allowed to wait forever, and what to call it.
 *
 * Playwright bounds clicking and waiting; it does not bound `evaluate`,
 * launching a browser, or closing one. Those are exactly where a scenario on
 * a loaded machine stalls, and an unbounded stall is not a test failure —
 * it is five minutes of silence and then the runner's own timeout, which
 * names the scenario and says nothing about which step it died on.
 *
 * Every one of them is named here so that the failure reads as a sentence.
 */
export async function bounded<T>(what: string, work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const giveUp = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`gave up waiting for ${what} after ${ms}ms`)), ms);
  });
  const started = TRACE ? Bun.nanoseconds() : 0;
  try {
    return await Promise.race([work, giveUp]);
  } finally {
    clearTimeout(timer);
    // Every step, in order, with what it cost. Off by default and worth
    // having: a stall that no bound catches is a stall in a step nobody
    // thought to bound, and the only way to find which is to watch them all.
    if (TRACE) {
      const took = Math.round((Bun.nanoseconds() - started) / 1e6);
      process.stderr.write(`    · ${what} ${took}ms\n`);
    }
  }
}

async function answering(at: string): Promise<boolean> {
  try {
    const reply = await fetch(at, { signal: AbortSignal.timeout(700) });
    return reply.ok;
  } catch {
    return false;
  }
}

/**
 * The suite's own dev server.
 *
 * Reused across the scenarios of a file, started again for the next file
 * (see below for why it has to be), and never inherited from a session
 * outside the run. See `PORT` for what inheriting cost.
 */
export async function serve(): Promise<string> {
  // **The built site, served as files. Not Vite.**
  //
  // Vite is what accumulates, and the comment that used to be here said so —
  // "whatever accumulates in a Vite that has served the same heavy page ten
  // times, the cure is not to find out but to stop asking it to" — and then
  // went on asking it to, once per scenario instead of once per file. That
  // moved the wall rather than removing it: a scenario that *reloads* boots
  // the game two or three times over, and a reload is not a reload. It is
  // the whole game again — a world generated, several sheets recoloured, and
  // several hundred separate module requests. Measured: opening the game
  // takes seven to ten seconds, opening it and reloading twice takes forty,
  // and two of eight went past a ninety-second budget.
  //
  // A directory of files has nothing to accumulate. It is about twice as
  // fast, and it is the artefact that actually ships.
  //
  // This was tried once before and reverted, because every seam in
  // `devHooks.ts` was gated on `import.meta.env.DEV` and a production build
  // therefore had none of them — `__mathemagicum` was never put out and
  // every scenario timed out waiting for a handle, on a game that had booted
  // perfectly well. The seams ship now, deliberately; see that file for the
  // argument. This works because of that decision and not otherwise.
  //
  // Started once per process and left up. There is nothing to restart.
  if (origin) return origin;
  await built();

  const root = `${process.cwd()}/dist`;
  serving = Bun.serve({
    // Any free port, not a fixed one. Vite was *asked* for 5178 and quietly
    // moved along when it was taken, which is why the port used to be read
    // back out of its log. `Bun.serve` does not move along, it throws — and
    // twenty files each starting a server on the same number find it still
    // held by the file before often enough to fail most of them. Nothing
    // needs the number to be memorable: the origin is read off the server.
    port: PORT,
    development: false,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      // Everything is a real file except the entry, and the entry is asked
      // for under a query string on every load — see the dev seams.
      const file = Bun.file(`${root}${path === "/" ? "/index.html" : path}`);
      if (await file.exists()) return new Response(file);
      return new Response("not found", { status: 404 });
    },
  });
  origin = `http://localhost:${serving.port}`;
  if (!(await answering(origin))) throw new Error("the built site would not answer");
  return origin;
}

/**
 * Build the site, unless the run has already done it.
 *
 * Once per *run* rather than once per file: twenty files each spending ten
 * seconds on the same build is three minutes of a suite that is slow enough
 * already, so `run.ts` builds first and says so. A single file run on its
 * own builds for itself, because the alternative is a scenario passing
 * against yesterday's code — which has happened here, cost an afternoon, and
 * is the one failure this suite must never have.
 */
async function built(): Promise<void> {
  if (process.env.E2E_PREBUILT === "1") return;
  const build = Bun.spawn(["bun", "run", "build"], { stdout: "ignore", stderr: "inherit" });
  // Bounded, like every other process this file starts, and it was the one
  // that was not: a Vite that hangs — a stuck plugin, a disk that has filled
  // — hung this `await` and the scenario with it, until the runner's own
  // five-minute timeout named the scenario and said nothing about the build.
  // Killed on the way out, so a run that gave up on it does not leave it
  // behind writing into `dist/` under the next run.
  try {
    const code = await bounded("the build to finish", build.exited, BUILD_MS);
    if (code !== 0) throw new Error("the build failed, so there is nothing to serve");
  } catch (whyNot) {
    build.kill();
    throw whyNot;
  }
}

/**
 * Put the dev server away.
 *
 * Nothing calls this per file, and that is the whole design: a scenario file
 * that tore the server down in its own `afterAll` was tearing it out from
 * under the file that ran next. It goes at exit, once, below — and this stays
 * exported for a script that wants to be explicit about it.
 */
export async function shutDown(): Promise<void> {
  serving?.stop(true);
  serving = null;
  origin = null;
}

// On the way out under a keystroke, which is the case `afterAll` cannot
// cover. A suite this long is one people interrupt, and a Vite left holding
// the port is not merely untidy — it is a server a later run could find and
// use, from a session that is over.
//
// There is deliberately no `exit` handler beside these. There was, and it
// never fired: a `bun test` that finishes does not run them, so every run
// left its server behind while a confident comment said otherwise. The
// teardown that does the work is `afterAll(shutDown)` in each scenario
// file, which is only safe because `run.ts` gives each file its own process.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    serving?.stop(true);
    process.exit(130);
  });
}

export interface Opening {
  /** Dev seams, as they would be typed into the address bar. */
  readonly seams?: string;
  /** Children on the device, if the scenario needs more than the default. */
  readonly players?: readonly Record<string, unknown>[];
  /** The world to open. Pinned so a scenario means the same thing twice. */
  readonly seed?: number;
  /**
   * Stop at the screens *before* the game, rather than skipping past them.
   *
   * `?skipTitle` exists because a script has no thumbs and a grid of faces
   * is a wait moved one screen later — which is right for every scenario
   * about playing, and useless for the three screens that make a player.
   * Those had no browser coverage at all, which is how a keyboard could
   * carry the whole game off the top of an iPad without anything noticing.
   *
   * A scenario opened this way gets no `__mathemagicum`: the handle belongs
   * to the game scene and the game scene has not started. What it gets is a
   * canvas and the DOM, which is what these screens are made of.
   */
  readonly onboarding?: boolean;
  /**
   * Meet the game as a child does, with every guide still to come.
   *
   * A guide lights the next button and hangs an arrow over the next square
   * from the moment its action is worth doing (see `ui/guide.ts`). It gets
   * in the way of no tap, but by default the harness opens with
   * `?guided=all` all the same: a glow on the pouch is a difference in every
   * screenshot, and the guide writes to the child's progress, which is a
   * save changing under a scenario about saves. The scenario about the
   * guides is the one that sets this.
   */
  readonly firstTime?: boolean;
  /**
   * How big the screen is, when the scenario is *about* how big the screen
   * is.
   *
   * Everything else opens at 1000x760, which is a desktop and is what the
   * suite has always assumed. That assumption is exactly why a phone-shaped
   * bug could not be seen from here: the array spell asks a child to draw a
   * rectangle up to ten squares across, and at the world's zoom ten squares
   * are wider than an iPhone. Nothing in this file could show that.
   */
  readonly viewport?: { readonly width: number; readonly height: number };
  /**
   * Whether the browser has a touchscreen, for the scenarios that need two
   * fingers.
   *
   * Off everywhere else, and that is not laziness: a context with touch
   * makes Phaser take the touch route through its input manager, which is a
   * different code path from the mouse one every other scenario drives. A
   * suite that quietly ran half on each would be a suite where a mouse-only
   * break hid behind a touch-only pass.
   */
  readonly touch?: boolean;
}

/**
 * The narrowest screen the game is meant to work on.
 *
 * An iPhone in portrait, in CSS pixels. Not the very smallest phone ever
 * made — the point is a real device a child is handed, and this is the one
 * the playtest that asked for the zoom was run on.
 */
export const PHONE = { width: 390, height: 844 } as const;

/**
 * The name of a rune's button in the spellbook, by the spell it casts.
 *
 * Not `spellbook.4`. The tray is built from `SPELLS`, so a rune inserted
 * anywhere in that list renumbers every button after it — which happened
 * when the division rune went in between the times and the hourglass. Five
 * scenarios went on tapping the fourth button while meaning the hourglass,
 * and nothing failed loudly: the tap landed, the rune it hit was one nobody
 * had been taught, and a refusal looks exactly like a spell that did not
 * open.
 */
export function runeButton(spell: Spell): string {
  return `spellbook.${SPELLS.indexOf(spell)}`;
}

/**
 * The seed pouch's button for a crop, and the crate's for a thing to put
 * down, by what it is rather than by where it sits.
 *
 * The same argument as `runeButton`, and the same list the game itself is
 * built from: the pouch is the crops in `PLANT_TYPES` and then the flowers,
 * and the crate is `PLACEABLE_FIXTURES` and then `DECOR_TYPES`. A crop or a
 * piece of furniture added anywhere but the end used to shift every button
 * after it, and a scenario reading `crate.9` would go on tapping the tenth
 * thing in the box while meaning a chair.
 */
export function seedButton(seed: PlantType | FlowerType): string {
  const crop = PLANT_TYPES.indexOf(seed as PlantType);
  const at = crop >= 0 ? crop : PLANT_TYPES.length + FLOWER_TYPES.indexOf(seed as FlowerType);
  return `seeds.${at}`;
}

/**
 * And the patch menu's, by what the button does.
 *
 * The one menu whose *contents* change: indoors it is build-or-clear,
 * outdoors plant, grow or clear. `patch.2` named a different button in
 * each, which is why they are named for what they do.
 *
 * A crop is a legal answer here because the menu asks twice — the spell,
 * and then, if it was planting, which seed. Same menu, same names.
 */
export function patchButton(action: PatchAction | PlantType): string {
  return `patch.${action}`;
}

/**
 * The name of a thing's button in the crate.
 *
 * **By name, not by position, and that is the whole of the change.** This
 * counted along `PLACEABLE_FIXTURES` and then `DECOR_TYPES`, which is a
 * promise about order that nothing keeps: adding the sorter moved every
 * furniture slot by one, and adding a rune to the spellbook once had five
 * scenarios tapping the wrong button while looking like they passed. The
 * crate now shows one group at a time, so a position is not even stable
 * within a single run.
 *
 * The button only exists while its own group is open — see `crateGroup`.
 */
export function crateButton(thing: FixtureType | DecorType | CrateWire): string {
  return `crate.${thing}`;
}

/** The name of the group button a thing lives behind. */
export function crateGroup(thing: FixtureType | DecorType | CrateWire): string {
  return `crate.${groupOf(thing)}`;
}

/**
 * Open the crate at the group holding this thing, and tap it.
 *
 * Two taps rather than one, which is what the crate now costs: a group, then
 * the thing. Here rather than in each scenario so that a third level, or a
 * regrouping, is one edit — the crate has been rearranged twice already and
 * both times the scenarios found out by tapping something else.
 */
export async function takeFromCrate(
  game: Game,
  thing: FixtureType | DecorType | CrateWire,
): Promise<boolean> {
  await game.tap("crate");
  // The group button is only on the tray while no group is open, and the
  // crate remembers which one it was in — so a crate opened for the second
  // time in a scenario comes back showing that group's things and has no
  // group button to tap. Its absence is that, not a failure: what matters
  // is whether the thing itself can be tapped afterwards.
  if (await game.tap(crateGroup(thing))) await game.settle(200);
  return game.tap(crateButton(thing));
}

/**
 * Open the game, play, and put it away.
 *
 * The world seed is pinned by default, because a scenario that walks to a
 * building has to find the same building every time — and the seed lives in
 * a saved game in storage rather than in the address bar (`?seed=` is the
 * spells' seed, not the world's), which is the sort of thing worth knowing
 * once here rather than discovering per test.
 */
/** The logic parchment's circuit, as the seam publishes it. */
type LogicNode =
  | { kind: "switch"; index: number }
  | { kind: "not"; of: LogicNode }
  | { kind: "and"; left: LogicNode; right: LogicNode }
  | { kind: "or"; left: LogicNode; right: LogicNode }
  | { kind: "xor"; left: LogicNode; right: LogicNode };

/** Whether the lamp lights, evaluated the way the spell evaluates it. */
function lightsLamp(node: LogicNode, on: readonly boolean[]): boolean {
  switch (node.kind) {
    case "switch":
      return on[node.index] === true;
    case "not":
      return !lightsLamp(node.of, on);
    case "and":
      return lightsLamp(node.left, on) && lightsLamp(node.right, on);
    case "or":
      return lightsLamp(node.left, on) || lightsLamp(node.right, on);
    case "xor":
      return lightsLamp(node.left, on) !== lightsLamp(node.right, on);
  }
}

/**
 * `&guided=all`, unless the scenario wants to meet the guides.
 *
 * On the opening URL and on every `reload` with seams, because a reload
 * with seams is a fresh URL: a scenario that reloaded "somewhere else" and
 * lost the seam would meet the guides from its second half onwards.
 */
function guidedSeam(opening: Pick<Opening, "firstTime">): string {
  return opening.firstTime ? "" : "&guided=all";
}

export async function play(opening: Opening, act: (game: Game) => Promise<void>): Promise<void> {
  if (TRACE) process.stderr.write(`  ▸ opening ${opening.seams ?? ""}\n`);
  const at = await bounded("a dev server", serve(), SETUP_MS);
  // A browser of its own, per scenario, and closed again at the end.
  //
  // One shared between them was two seconds cheaper and cost an afternoon:
  // every scenario stands up a Phaser game, which is a WebGL context, and by
  // the ninth in one browser the renderer stopped answering — `page.evaluate`
  // never returned, and the scenario that happened to be running when it
  // gave out timed out after five minutes with nothing wrong in it. It
  // passed on its own, it passed with its own file, and it failed only after
  // another file had run first, which is the worst shape a test failure has.
  const browser = await bounded("a browser to start", chromium.launch(), SETUP_MS);
  // A browser that goes away mid-scenario, said out loud.
  //
  // It does go away: watched live, a scenario stalled with no browser
  // process left on the machine at all, the dev server answering in a
  // millisecond and memory pressure at zero. Playwright does not mind — an
  // `evaluate` against a browser that is gone simply never returns — so the
  // scenario sat there until the runner's own five-minute timeout and blamed
  // itself. This turns that into one sentence, immediately.
  //
  // Listened for on the line after the browser starts, and not four awaits
  // later where it used to be, because a browser can die while its own
  // window is being made: an event with nobody listening is an event that
  // did not happen, and the whole point of this is that it is heard.
  const lost = new Promise<never>((_, reject) => {
    browser.on("disconnected", () =>
      reject(new Error("the browser exited in the middle of the scenario")),
    );
  });
  // Nothing ever awaits `lost` on the happy path, and an unobserved
  // rejection is a crash in bun. Every use races it against real work.
  lost.catch(() => {});
  const context = await bounded(
    "a browser window",
    browser.newContext({
      viewport: { ...(opening.viewport ?? { width: 1000, height: 760 }) },
      ...(opening.touch ? { hasTouch: true } : {}),
      // The built site registers a service worker and precaches two hundred
      // and twenty files. That is right for a child on a tablet and wrong
      // here: a scenario would be reading whatever the worker had cached
      // rather than what the build just produced, which is the exact shape
      // of the stale-code failure this suite exists to catch.
      serviceWorkers: "block",
    }),
    SETUP_MS,
  );
  // A saved game with the seed in it, written the way the game writes one.
  //
  // This used to set the one key a single-world build kept its seed under,
  // and lean on the game carrying that old world over into a saved game on
  // first open. It worked, and it would have stopped working — silently,
  // with every scenario growing a random world — the day that carry-over
  // was deleted as the dead code it is meant to become.
  const id = "e2e";
  const seed = opening.seed ?? 12345;
  const records: readonly (readonly [string, string])[] = [
    [GAMES_KEY, JSON.stringify([{ id, seed, savedAt: 0 }])],
    [gameKey(id), JSON.stringify({ id, seed, savedAt: 0, world: null, progress: {} })],
    [PLAYING_KEY, id],
  ];
  // Only where nothing is written yet. An init script runs on *every*
  // navigation, and `reload` is a navigation: written unconditionally, this
  // put the empty saved game back over the one the game had been writing —
  // `world: null`, on a world with two machines and a wire in it — and every
  // scenario that reloaded to ask "is it still there tomorrow" found it was
  // not. The legacy seed key this replaced was harmless to rewrite, because
  // the game never wrote it; a saved game is the game's to keep.
  await context.addInitScript(
    ([records, players]) => {
      for (const [key, value] of records) {
        if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
      }
      if (players) localStorage.setItem("mathemagicum.players", JSON.stringify(players));
    },
    [records, opening.players ?? null] as const,
  );
  const page = await bounded("a tab to open", context.newPage(), SETUP_MS);
  const complaints: string[] = [];
  COMPLAINTS.set(page, complaints);
  // A file the page asked for and did not get, which is the other way a game
  // ends up with no canvas: nothing threw, because the script that would
  // have thrown never arrived.
  page.on("requestfailed", (request) => {
    complaints.push(`could not fetch ${request.url()}: ${request.failure()?.errorText ?? "?"}`);
  });
  page.on("pageerror", (error) => complaints.push(`page error: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") complaints.push(`console: ${message.text().slice(0, 200)}`);
  });

  const game = new Game(page);
  try {
    // `domcontentloaded`, not `load`. This game's `load` event waits for
    // every asset on the page — hundreds of sprite sheets and tiles — which
    // is both the most expensive part of opening it and not the thing worth
    // waiting for. Under load that took longer than Playwright's thirty
    // second navigation budget and failed a scenario that was fine. What
    // readiness actually means is the line below: the game has run far
    // enough to put its handle out, which it cannot do until its assets are
    // in, so this is the stricter signal as well as the more patient one.
    await Promise.race([
      page.goto(
        `${at}/?${opening.onboarding ? "" : "skipTitle"}${opening.seams ?? ""}${guidedSeam(opening)}`,
        {
          waitUntil: "domcontentloaded",
          timeout: SETUP_MS,
        },
      ),
      lost,
    ]);
    // Generous, because booting this game is the most expensive thing in a
    // scenario by a wide margin — a world is generated, several sheets are
    // recoloured, and on a machine with other work on it that has been
    // measured at forty-five seconds. Everything after this point is cheap,
    // and is held to `ANSWER_MS` instead.
    await Promise.race([
      bounded(
        "the scene to start running",
        // The onboarding screens never put the handle out — see `onboarding`
        // — so what readiness means there is a canvas with something drawn
        // on it.
        opening.onboarding ? drawn(page) : running(page),
        SETUP_MS,
      ),
      lost,
    ]);
    await Promise.race([act(game), lost]);
    // Nothing throws on the way past. A scenario that passes while the
    // console fills with errors is a scenario that will pass through the
    // bug it was written for.
    if (complaints.length > 0) throw new Error(complaints.join("\n"));
  } catch (whyNot) {
    throw await pictured(page, opening, whyNot);
  } finally {
    // Bounded like everything else, and for the same reason: a browser that
    // will not close is indistinguishable from a scenario that will not end.
    //
    // Waited on and not killed, because there is nothing here to kill with:
    // Playwright hands the process out on a `BrowserServer` and this is a
    // `Browser`. What that leaves is a browser that could in principle be
    // abandoned still running — so the bound is short rather than long for
    // two reasons and not one. A leak of five seconds’ patience is bounded
    // by the driver, which reaps every browser it launched when this process
    // exits, and `run.ts` gives every file its own process; a leak of three
    // minutes’ patience would have been the whole file.
    await bounded("the window to close", context.close(), CLOSE_MS).catch(() => {});
    await bounded("the browser to close", browser.close(), CLOSE_MS).catch(() => {});
  }
}

/**
 * How long any single question to the page may take before it is a failure.
 *
 * Playwright puts a timeout on clicking and on waiting, but not on
 * `evaluate` — and `evaluate` is how every one of these scenarios reads the
 * game. A page whose script loop has stopped answering therefore hangs a
 * scenario until the *test runner's* timeout fires, which was five minutes
 * of nothing followed by a message that named the scenario and not the
 * cause. Thirty seconds is far longer than the slowest seam and short enough
 * that the failure arrives while it still means something.
 *
 * It does stall sometimes, and the cause is the machine rather than any of
 * this. Booting the game is by far the most expensive thing a scenario does
 * — a world generated, several sheets recoloured, all of it through a
 * software renderer — and it was measured at five seconds on an idle box and
 * forty-five on the same box under a load average above its core count.
 * Browser launches on their own stay flat, and free memory does not move, so
 * it is contention for CPU and nothing that can be fixed in here. A run of a
 * dozen scenarios in one process is near the edge on four busy cores; one
 * file at a time is not. Deliberately no retry: a suite that quietly plays a
 * scenario twice is a suite that hides the failures it exists to find.
 */
const ANSWER_MS = 30_000;

/**
 * How long standing a browser up or putting it away may take.
 *
 * Longer than `ANSWER_MS` because it is process work rather than a question
 * to a page already running, and on a machine with more load than cores that
 * has been measured in tens of seconds.
 *
 * **Ninety seconds was not enough, and here is the measurement.** A scenario
 * that only opens the game takes seven to ten seconds. One that opens it and
 * *reloads twice* — which is how a scenario gets across the world, since
 * `?at=` is the only way — takes forty, because a reload is not a reload: it
 * is the whole game booted again, a world generated and several sheets
 * recoloured. Eight of those in one file, on a machine already running one,
 * and two of the eight went past ninety seconds and were failed for it.
 *
 * That is what turned the browser suite red on its first run in CI, on a
 * runner with two cores. It is not a hung page and there is nothing to fix
 * in the game: it is a budget set against the cost of *opening* rather than
 * the cost of opening three times over.
 */
const SETUP_MS = 180_000;
/**
 * How long a browser gets to shut, which is nothing like how long it gets to
 * start.
 *
 * These were both `SETUP_MS`, and that is how a scenario came to fail with
 * nothing said about it. The harness works the failure out correctly — the
 * scene never starts, and the bound on that fires at a hundred and eighty
 * seconds with the right words in it — and then spends thirty more
 * photographing a page that is gone and the rest of the budget waiting on a
 * dead browser to close, so bun's own five-minute timeout arrives first and
 * reports nothing. Three minutes to shut and thirty seconds for a picture is
 * five hundred and seventy in the worst case against a three hundred second
 * test: the diagnosis could never fit inside the time it had to escape in.
 *
 * A browser that has not closed in a few seconds is not closing. Whatever it
 * was, the answer is already known by then and the only thing left to do is
 * say it.
 */
const CLOSE_MS = 5_000;

/**
 * How long the build may take before it is the thing that has failed.
 *
 * Ten seconds on an idle machine, and short of the five minutes a scenario
 * is allowed — deliberately, because a bound that is not shorter than the
 * runner's own says nothing: the runner would fire first and blame the
 * scenario. See `built`.
 */
const BUILD_MS = 240_000;

/** How many scenarios this process has failed so far, for naming their pictures. */
let failed = 0;

/**
 * A picture of the page as the scenario failed, and the failure with the
 * picture's name on it.
 *
 * The suite asserts on what the game *says* about itself, which is right
 * for deciding pass or fail and useless for working out what actually
 * happened: "expected 3, got 0" from a machine that should have woken tells
 * nobody whether the parchment never opened, opened and was mis-answered, or
 * closed on a rectangle drawn one square short. Every one of those was
 * diagnosed, at some point, by adding a `look()` and running it again — on
 * a failure that had taken a two-minute scenario to reach, and that did not
 * always come back.
 *
 * So the picture is taken here, once, before the window closes and the
 * evidence goes with it, and the error carries the path so it is beside the
 * assertion in the runner's output. Named by a count and the clock rather
 * than by the test — bun does not say which test is running from inside a
 * helper — with the seams the scenario opened with for a hint. `look()`
 * stays for a picture of a moment that is not a failure.
 *
 * Best effort, and swallowed if it cannot be had: a page that has stopped
 * answering will not answer a screenshot either, and the failure worth
 * reporting is the one that was already in hand.
 */
async function pictured(page: Page, opening: Opening, whyNot: unknown): Promise<unknown> {
  // Nothing to photograph, and thirty seconds not spent finding that out.
  //
  // A screenshot of a page whose browser has gone never returns — Playwright
  // does not mind, it simply waits — so this cost the failure its own bound
  // and then its message. The commonest reason a scenario fails at all is
  // that the browser went away, which is exactly when this was most
  // expensive and least use.
  if (page.isClosed() || !page.context().browser()?.isConnected()) return whyNot;
  failed += 1;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const hint = (opening.seams ?? "plain")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  const path = `e2e/shots/failed-${failed}-${hint}-${stamp}.png`;
  const taken = await bounded("a picture of the failure", page.screenshot({ path }), ANSWER_MS)
    .then(() => true)
    .catch(() => false);
  if (!taken) return whyNot;
  const note = `\n  (a picture of the page at that moment: ${path})`;
  if (whyNot instanceof Error) {
    whyNot.message += note;
    return whyNot;
  }
  return new Error(`${String(whyNot)}${note}`, { cause: whyNot });
}

/**
 * What each page has complained about, reachable from anywhere that has one.
 *
 * These are gathered as they happen and checked at the *end* of a scenario,
 * which is right for a run that gets that far and useless for one that does
 * not. A boot that fails leaves the game with no canvas and the reason
 * sitting in this list, thrown away when the wait times out instead — which
 * is exactly what happened on a run whose whole evidence was "the document
 * is complete and has no canvas".
 *
 * A `WeakMap` rather than a parameter, because `reload` is a method on
 * `Game` and has a page and nothing else; threading the array to it would
 * mean threading it through everything that can reload.
 */
const COMPLAINTS = new WeakMap<Page, string[]>();

/** Whatever this page has complained about so far, as one line. */
function saidSoFar(page: Page): string {
  const said = COMPLAINTS.get(page) ?? [];
  return said.length > 0 ? ` It complained: ${said.join(" / ")}` : " It said nothing at all.";
}

/**
 * Wait until the game is not merely loaded but *running*.
 *
 * The handle appearing says the scene reached the line that puts it there,
 * which is not the same as the scene being ready to be played: the world is
 * still being restored and the player still being placed. A scenario that
 * moved her in that window found itself outdoors afterwards, having walked
 * at a door that was not there yet.
 *
 * Frames drawn is the signal, because it is the one thing that cannot be
 * true early. Twenty of them is a third of a second on an idle machine and
 * as long as it takes on a busy one, which is the right shape for a wait —
 * a fixed sleep is either too short there or wasted here.
 */
async function running(page: Page): Promise<void> {
  try {
    await page.waitForFunction(() => "__mathemagicum" in globalThis, null, { timeout: SETUP_MS });
  } catch (whyNot) {
    // The *first* of the two waits, and it had no story either until a
    // suite run spent three minutes here and reported a bare Playwright
    // timeout pointing at a line of this file.
    //
    // Nothing has put a handle out, so there is nothing to ask about
    // frames. What there is: whether the document finished loading at all,
    // and whether the game got as far as making a canvas. A page still
    // fetching is a slow machine or a slow server; a loaded page with no
    // canvas is a script that threw before Phaser started, which is a bug
    // in this repository and looks identical from the outside.
    const state = await page
      .evaluate(() => ({
        ready: document.readyState,
        canvas: Boolean(document.querySelector("canvas")),
        url: location.href,
      }))
      .catch(() => null);
    const how = state
      ? `the document is "${state.ready}" and ${state.canvas ? "has" : "has no"} canvas (${state.url})`
      : "the page would not answer at all";
    throw new Error(`no game handle after ${SETUP_MS}ms: ${how}.${saidSoFar(page)}`, {
      cause: whyNot,
    });
  }
  try {
    await page.waitForFunction(
      () => {
        const handle = (globalThis as never as Handles).__mathemagicum;
        if (!handle) throw new Error("the game has not put its handle out");
        return handle.stats().frames > 20;
      },
      null,
      { timeout: SETUP_MS },
    );
  } catch (whyNot) {
    // Say how far it actually got, because the two failures behind this
    // wait need telling apart and the timeout alone cannot do it.
    //
    // A scene that never started — a sheet that failed to load, a throw in
    // `create` — sits at nought frames forever. A machine simply too busy
    // gets there slowly and would have arrived. One is a bug in this
    // repository and the other is somebody's build hogging the box, and
    // `parents.e2e.ts` failed this way once in a suite run with two JVMs on
    // the machine, leaving nothing behind to say which it had been.
    const reached = await page
      .evaluate(() => {
        const handle = (globalThis as never as Handles).__mathemagicum;
        return handle ? handle.stats().frames : -1;
      })
      .catch(() => -1);
    const why =
      reached === 0 ? "it never started" : reached < 0 ? "the handle went away" : "it is only slow";
    throw new Error(
      `the scene drew ${reached} frames in ${SETUP_MS}ms, wanted more than 20 (${why}).${saidSoFar(page)}`,
      { cause: whyNot },
    );
  }
}

/**
 * The screens before the game are up: a canvas, sized and painted.
 *
 * No handle to wait for — that belongs to the game scene. What can be waited
 * on is the canvas existing at a real size, which is what the loading bar and
 * the title card and the three making-a-player steps all draw onto.
 *
 * And then for the loading to be *over*, which is the part that used to be
 * a fixed two and a half seconds. A canvas with a size is a canvas with a
 * loading bar on it; the title card does not listen for a tap until every
 * asset is in (`BootScene.begin` is where the listener goes on), so a
 * scenario that taps before that taps at nothing. Two hundred sprite sheets
 * take as long as they take, and the loader keeps the wire busy the whole
 * way through — so the wire going quiet is the loader finishing, and it is
 * a condition rather than a guess about how long a busy machine needs.
 */
async function drawn(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector("canvas");
      return Boolean(canvas && canvas.width > 0 && canvas.height > 0);
    },
    null,
    { timeout: SETUP_MS },
  );
  await page.waitForLoadState("networkidle", { timeout: SETUP_MS });
}

interface VennSeam {
  waiting: number;
  left: unknown;
  right: unknown;
  onTray: { id: string; hue: string; shape: string }[];
  board: {
    waiting: { x: number; y: number }[];
    spots: Record<Region, { x: number; y: number }>;
  } | null;
}

/** A child playing, as a scenario can drive her. */
export class Game {
  constructor(private readonly page: Page) {}

  /**
   * The tab itself, for the one thing that is not the game.
   *
   * The name box is a real HTML input over the canvas — deliberately, so a
   * child gets their own tablet's keyboard — and where it lands is a fact
   * about the *page* that no dev seam can state. Everything else should go
   * through the methods below.
   */
  get tab(): Page {
    return this.page;
  }

  /**
   * Which of the screens before the game is up, once one of them is.
   *
   * The title card puts nothing out, so this waits for the players scene and
   * then answers `list`, `tongue`, `who`, `sums` or `remove` — which is what
   * lets a scenario drive those screens by *what they are showing* rather
   * than by clicking at a fraction of the viewport and hoping.
   */
  async making(): Promise<string> {
    return this.ask("which making screen is up", (page) =>
      page.evaluate(() => {
        const handle = (globalThis as never as Handles).__mathemagicum_making;
        return handle ? handle.step() : "";
      }),
    );
  }

  /** Wait until one of those screens is showing what it was asked for. */
  async waitForStep(step: string): Promise<void> {
    await this.ask(`the ${step} screen`, (page) =>
      page.waitForFunction(
        (wanted) => {
          const handle = (globalThis as never as Handles).__mathemagicum_making;
          return handle?.step() === wanted;
        },
        step,
        { timeout: ANSWER_MS },
      ),
    );
  }

  /**
   * Anything asked of the page, held to `ANSWER_MS`.
   *
   * Everything that touches the browser goes through here, and that *every*
   * is the point: the bound was put on reading a seam first, which left the
   * taps, the keys and the position reads unguarded — so the next stall was
   * still five minutes of nothing, in a scenario whose only sin was going
   * ninth.
   */
  private ask<T>(what: string, work: (page: Page) => Promise<T>): Promise<T> {
    return this.within(what, work(this.page));
  }

  /** A tap at a place on the screen, and time for the game to answer it. */
  private async click(x: number, y: number): Promise<void> {
    await this.ask(`a tap at ${Math.round(x)},${Math.round(y)}`, (page) => page.mouse.click(x, y));
    await this.settle();
  }

  /** Whatever this is, or a failure that says the page stopped answering. */
  private within<T>(what: string, work: Promise<T>): Promise<T> {
    return bounded(`the page to answer: ${what}`, work, ANSWER_MS);
  }

  /**
   * Whatever a dev seam reports. See `devHooks.ts` for what there is.
   *
   * The name is a key of `DevHandle` and not a string, so a seam that is
   * renamed or removed fails every scenario that asks for it at `tsc` rather
   * than thirty seconds into a browser. The *answer* is still whatever the
   * caller says it is — the seams return shapes a scenario reads two fields
   * of, and forty files declaring the full shape would be forty copies of
   * `devHooks.ts` to keep in step.
   */
  seam<T>(name: keyof DevHandle, ...args: unknown[]): Promise<T> {
    return this.within(
      `seam ${name}`,
      this.page.evaluate(
        ([which, given]) => {
          const handle = (globalThis as never as Handles).__mathemagicum;
          if (!handle) throw new Error("the game has not put its handle out");
          const found: unknown = handle[which];
          // `session` is the object itself rather than a getter, so a script
          // asking for it by name should get it rather than a type error.
          if (typeof found !== "function") return found as T;
          return (found as (...rest: unknown[]) => unknown).apply(handle, given as unknown[]) as T;
        },
        [name, args] as const,
      ) as Promise<T>,
    );
  }

  /** Where the buttons are, by name. */
  ui(): Promise<Record<string, { x: number; y: number }>> {
    return this.seam("ui");
  }

  /**
   * Which square she is standing on.
   *
   * Read *inside* the page, which is the whole reason this exists rather
   * than `seam("session")`: the session is a class instance and `tile` is a
   * getter on its prototype, so what comes back across the wire is an object
   * with the fields but not the accessor — `undefined`, silently, in a
   * scenario that looked like it was asking the right question.
   */
  where(): Promise<{ col: number; row: number }> {
    return this.ask("where she is standing", (page) =>
      page.evaluate(() => {
        const handle = (globalThis as never as Handles).__mathemagicum;
        if (!handle) throw new Error("the game has not put its handle out");
        const { col, row } = handle.session.tile;
        return { col, row };
      }),
    );
  }

  /** Press a button. False if it is not on screen, which a caller may want. */
  async tap(name: string): Promise<boolean> {
    const at = (await this.ui())[name];
    if (!at) return false;
    await this.click(at.x, at.y);
    return true;
  }

  /**
   * Tap a square of ground.
   *
   * Aimed at its *middle*. `screenOf` gives a tile's feet — its bottom edge —
   * which falls into the next row down, so a tap placed there lands one
   * square past where it was meant to. Learned the hard way; encoded here so
   * nobody learns it twice.
   */
  async tapCell(col: number, row: number): Promise<void> {
    const at = await this.ask(`where ${col},${row} is on screen`, (page) =>
      page.evaluate(
        ([c, r]) => {
          const handle = (globalThis as never as Handles).__mathemagicum;
          if (!handle) throw new Error("the game has not put its handle out");
          const feet = handle.screenOf(c, r);
          const above = handle.screenOf(c, r - 1);
          return { x: feet.x, y: (feet.y + above.y) / 2 };
        },
        [col, row] as const,
      ),
    );
    await this.click(at.x, at.y);
  }

  /**
   * Drag a coin from a pile onto the counter.
   *
   * The shop's paying half is the one thing in this game that is not a tap:
   * a child takes a coin off a pile and carries it across the table, and
   * where they let go is the whole of the interaction. A scenario that only
   * ever tapped would leave the carrying untested, which is most of it.
   *
   * Moved in steps rather than teleported, because a pointer that arrives
   * without travelling is a pointer that never moved — and "did it move" is
   * exactly what tells a drag from a tap.
   */
  async dragCoin(value: number, onto = "shop.counter"): Promise<void> {
    const ui = await this.ui();
    const from = ui[`shop.pile.${value}`];
    const to = ui[onto];
    if (!from || !to) throw new Error(`no pile ${value} or no ${onto} to drop it on`);
    await this.drag(from, to);
  }

  /** Take something from one place on the screen to another, and let go. */
  async drag(from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
    await this.ask("reaching for it", (page) => page.mouse.move(from.x, from.y));
    await this.ask("picking it up", (page) => page.mouse.down());
    for (let step = 1; step <= 4; step++) {
      const x = from.x + ((to.x - from.x) * step) / 4;
      const y = from.y + ((to.y - from.y) * step) / 4;
      await this.ask("carrying it", (page) => page.mouse.move(x, y));
    }
    await this.ask("letting go", (page) => page.mouse.up());
    await this.settle();
  }

  /**
   * Tap a square relative to where she is standing.
   *
   * What talking to somebody is: they stand on a square beside her, and the
   * tap has to land on *them* rather than on the wall behind them, which is
   * why it aims a little above the square's middle.
   */
  async tapNear(dCol: number, dRow: number): Promise<void> {
    const at = await this.ask(`where the square ${dCol},${dRow} away is`, (page) =>
      page.evaluate(
        ([dc, dr]) => {
          const handle = (globalThis as never as Handles).__mathemagicum;
          if (!handle) throw new Error("the game has not put its handle out");
          const me = handle.session.tile;
          return handle.screenOf(me.col + dc, me.row + dr);
        },
        [dCol, dRow] as const,
      ),
    );
    await this.click(at.x, at.y - 16);
  }

  async press(key: string): Promise<void> {
    await this.ask(`the ${key} key`, (page) => page.keyboard.press(key));
    await this.settle(120);
  }

  /** Type a number into whatever parchment is asking for one. */
  async type(value: number): Promise<void> {
    for (const digit of String(value)) {
      await this.ask(`typing ${digit}`, (page) => page.keyboard.press(digit));
    }
  }

  /** Hold a direction. Walking is the only thing here measured in time. */
  async walk(key: string, ms = 400): Promise<void> {
    await this.ask(`holding ${key}`, (page) => page.keyboard.down(key));
    await this.page.waitForTimeout(ms);
    await this.ask(`letting ${key} go`, (page) => page.keyboard.up(key));
    await this.settle(350);
  }

  /**
   * Wait until she has stopped moving, so whatever is read next is settled.
   *
   * **Why this exists, and why it is not "wait until she is indoors".** Five
   * scenarios walk her at a door and then read whether she got in, and each
   * used a fixed `settle(800)` or `settle(900)` to cover the last step and
   * the threshold. That budget held on an idle machine and did not on a busy
   * one: `curfew.e2e.ts` failed a full suite run at two in the morning, on a
   * door it had already opened twice in the same run at other hours. The
   * same geometry, the same code path, a different clock reading — which is
   * how a fixed wait fails and nothing else does.
   *
   * The obvious repair is to wait for the thing being asked about. It does
   * not work here, because *not getting in is a real answer*: the school is
   * shut in the evening and the scenario that proves it would hang until its
   * ceiling. What is always eventually true is that she stops moving, so
   * that is what is waited on.
   *
   * Two readings that agree, not one. A single reading can catch her between
   * two tiles at the moment the key went up and before the last step began.
   *
   * The tail is what is left of the old fixed wait and it stays small: once
   * she is standing still, crossing a threshold is the next thing the scene
   * does rather than something it gets round to.
   */
  async stopped(tail = 150): Promise<void> {
    const deadline = Date.now() + ANSWER_MS;
    let last: { col: number; row: number } | null = null;
    for (;;) {
      const at = await this.where();
      if (last && last.col === at.col && last.row === at.row) break;
      last = at;
      if (Date.now() > deadline) {
        throw new Error(`gave up waiting for her to stand still after ${ANSWER_MS}ms`);
      }
      await this.page.waitForTimeout(80);
    }
    await this.settle(tail);
  }

  /**
   * Wait long enough for the game to have done what it was told.
   *
   * The default clears the beat the times spell leaves on a finished
   * rectangle, which is the longest thing in the game that happens *before*
   * a panel opens — so a scenario that waits this long never reads a state
   * the game is still on its way to.
   */
  settle(ms = 500): Promise<void> {
    return this.page.waitForTimeout(ms);
  }

  /** Put her somewhere, facing something, without walking her there. */
  async standAt(col: number, row: number, facing: Facing): Promise<void> {
    await this.ask(`standing her at ${col},${row}`, (page) =>
      page.evaluate(
        ([c, r, f]) => {
          const handle = (globalThis as never as Handles).__mathemagicum;
          if (!handle) throw new Error("the game has not put its handle out");
          handle.session.setPosition(c, r);
          handle.session.face(f);
        },
        [col, row, facing] as const,
      ),
    );
    await this.settle(150);
  }

  /** How many of a thing is in the basket. */
  held(item: string): Promise<number> {
    return this.ask(`how many ${item} she holds`, (page) =>
      page.evaluate(
        (which) =>
          (globalThis as never as Handles).__mathemagicum?.session.inventory.count(
            which as ItemType,
          ) ?? 0,
        item,
      ),
    );
  }

  /**
   * Put some of a thing in her basket, without walking her to a shop for it.
   *
   * For the scenarios where a full basket is the precondition and not the
   * subject — a fence to put down, carrots to feed a machine. `?crops=` and
   * `?materials=` cover the common cases from the address bar; this is for
   * a particular thing in a particular amount, and for the *relative* sizes
   * of heaps, which the machines care about: one that takes the biggest heap
   * she is carrying has to be given more of the right thing than of anything
   * else. Six scenarios had written this body out for themselves.
   *
   * A string rather than an `ItemType`, because what a scenario hands over
   * is a `FixtureType`, a `decorItem(...)`, or a crop's name, and the game's
   * union of those is its business to keep.
   */
  async give(item: string, count: number): Promise<void> {
    await this.ask(`giving her ${count} ${item}`, (page) =>
      page.evaluate(
        ([of, many]) => {
          const handle = (globalThis as never as Handles).__mathemagicum;
          if (!handle) throw new Error("the game has not put its handle out");
          handle.session.inventory.add(of as ItemType, many);
        },
        [item, count] as const,
      ),
    );
  }

  /** What is in the purse, in the small coin. */
  coins(): Promise<number> {
    return this.ask("what is in her purse", (page) =>
      page.evaluate(
        () => (globalThis as never as Handles).__mathemagicum?.session.purse.coins ?? 0,
      ),
    );
  }

  /** What is standing on a square, by the world's own name for it. */
  objectOn(col: number, row: number): Promise<string | null> {
    return this.ask(`what stands on ${col},${row}`, (page) =>
      page.evaluate(
        ([c, r]) => {
          const handle = (globalThis as never as Handles).__mathemagicum;
          if (!handle) throw new Error("the game has not put its handle out");
          return handle.session.grid.getObjectAt(c, r)?.type ?? null;
        },
        [col, row] as const,
      ),
    );
  }

  /**
   * A square beside her with nothing standing on it.
   *
   * Where a machine goes when a scenario builds one: the four squares round
   * her, in a fixed order so the same world gives the same square twice, and
   * the first that is empty. Four files had this, each with its own copy of
   * the grid read, and each would have gone on finding the same square until
   * the day one of them was fixed and the other three were not.
   *
   * Empty of *objects*, not necessarily buildable — a crop or water is not an
   * object — which is what the machine scenarios have always asked and what
   * their gardens have always answered. `crate.e2e.ts` asks a stricter
   * question of its own.
   */
  async squareBeside(): Promise<{ col: number; row: number }> {
    const here = await this.where();
    for (const [dCol, dRow] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const at = { col: here.col + dCol, row: here.row + dRow };
      if ((await this.objectOn(at.col, at.row)) === null) return at;
    }
    throw new Error("she is boxed in on all four sides");
  }

  /**
   * In through her own front door, and say what room she is in.
   *
   * Put down on the doorstep rather than walked there from the spawn: a child
   * starts in the middle of their own garden beds, eight rows off, and walking
   * that on a held arrow key is eight seconds of nothing being tested that
   * gets stuck the first time a fence moves.
   *
   * Walked until she is *in*, rather than walked once and hoped. `stopped()`
   * waits for her to stop moving, which she also does when she has stopped
   * short of the door — and `hearth.e2e.ts` failed exactly that way on a
   * loaded machine, reporting a room with no fire in it when the truth was a
   * child standing on the doorstep. Two more goes cost nothing on the runs
   * where the first was enough. Ten files had walked her home, five with
   * their own copy of this and one of them with the repair.
   */
  async goHome(): Promise<House> {
    const doors = await this.seam<Record<string, { col: number; row: number }>>("doors");
    const door = doors["player-house"];
    if (!door) throw new Error("the village has no house for the player");
    await this.standAt(door.col, door.row + 2, "up");
    for (let go = 0; go < 3; go++) {
      await this.walk("ArrowUp", 900);
      await this.stopped();
      const house = await this.seam<House | null>("house");
      if (house) return house;
    }
    throw new Error("walking through the front door did not go indoors");
  }

  /**
   * Swipe the clock round, forward or back, by this many five-minute ticks.
   *
   * The hourglass is the one spell whose control is a *gesture*: there is no
   * button to press, and taking hold of a hand was what this replaced. So
   * the seam gives the stretch of parchment a swipe counts on, and the rest
   * is arithmetic — how far a finger has to travel for that many ticks.
   *
   * Split into as many passes as it takes, because eleven hours is a great
   * deal of swiping and the panel is only so wide. A child does the same.
   */
  async swipeClock(ticks: number): Promise<void> {
    if (ticks === 0) return;
    // Swiped, then checked, then swiped again for whatever is left over.
    //
    // The pointer moves in whole pixels and a long turn takes several passes
    // across the parchment, so a fraction of a tick is lost each time and a
    // hundred-tick turn came up short. A child would simply keep swiping;
    // this does the same, rather than the scenario carrying a fudge factor.
    let left = ticks;
    for (let go = 0; go < 6 && left !== 0; go++) {
      const before = await this.clockHands();
      await this.swipeOnce(left);
      const after = await this.clockHands();
      const moved = (after - before + 720) % 720;
      // Turned back, so what looks like a long way forward is a short way
      // back — whichever is nearer is what the swipe actually did.
      const signed = ticks > 0 ? moved : moved - 720;
      // In minutes, so it converts by minutes-per-tick — not by the pixel
      // constant, which is a different five entirely.
      left -= Math.round(signed / TICK_MINUTES);
    }
  }

  /** Where the hands stand now, in minutes round the face. */
  private async clockHands(): Promise<number> {
    const cast = await this.seam<{ to: { hour: number; minute: number } } | null>("clock");
    if (!cast) throw new Error("no clock to read");
    return cast.to.hour * 60 + cast.to.minute;
  }

  /** One sweep across the parchment, as far as it will go. */
  private async swipeOnce(ticks: number): Promise<void> {
    const cast = await this.seam<{
      grip: { left: number; top: number; right: number; bottom: number } | null;
    } | null>("clock");
    const area = cast?.grip;
    if (!area) throw new Error("no clock to swipe");
    // Down and to the right is clockwise, so a swipe along the diagonal is
    // the purest direction there is — and the shortest for a given turn.
    // Which also means it needs no correction for the angle: the game counts
    // a diagonal for its whole length.
    //
    // Half a tick further than the turn needs, so it lands in the middle of
    // the band rather than on its edge — the same reason `tapCell` aims at
    // the middle of a tile rather than its corner.
    const room = Math.min(area.right - area.left, area.bottom - area.top) - 8;
    const reach = (Math.abs(ticks) + 0.5) * SWIPE_PER_TICK;
    const passes = Math.max(1, Math.ceil(reach / room));
    const step = (reach / passes / Math.SQRT2) * (ticks > 0 ? 1 : -1);
    const middle = { x: (area.left + area.right) / 2, y: (area.top + area.bottom) / 2 };
    for (let pass = 0; pass < passes; pass++) {
      const from = { x: middle.x - step / 2, y: middle.y - step / 2 };
      await this.drag(from, { x: from.x + step, y: from.y + step });
    }
  }

  /**
   * Answer the wall of bricks, one gap at a time.
   *
   * The seam hands over the answer as well as the question, and deliberately:
   * a script that worked a wall out for itself would be a second copy of the
   * solver, and a test that reimplements the thing it tests checks nothing.
   */
  async solveWall(): Promise<void> {
    for (let gap = 0; gap < 4; gap++) {
      const wall = await this.seam<{ answer: number | null; done: boolean } | null>("bricks");
      if (!wall || wall.done || wall.answer === null) break;
      await this.type(wall.answer);
      await this.press("Enter");
    }
    await this.closed("bricks");
  }

  /**
   * Wait for a parchment to be put away, which is when its spell has landed.
   *
   * Every parchment holds a finished sum on screen for a beat — six hundred
   * and fifty milliseconds, in the popups — and only then dismisses itself
   * and tells the scene. The solvers below used to cover that with a fixed
   * `settle(800)` or `settle(900)`: the beat plus a margin, sized on an idle
   * machine. That is the shape of wait `stopped()` was written to replace,
   * and for the same reason — a margin that holds at noon and not at two in
   * the morning under somebody else's build.
   *
   * The seam answers `null` once the parchment is gone, so that is what is
   * waited on, bounded like any other question to the page. A parchment that
   * *stays* — a wrong answer, a box left unfilled — fails here with its name
   * on it, instead of thirty lines later in an assertion about a machine
   * that never woke.
   *
   * The tail is what is left of the old fixed wait and it stays small, as in
   * `stopped()`: once the parchment is down, the scene has already been told.
   */
  private async closed(
    parchment: "bricks" | "spell" | "array" | "share" | "logic" | "venn" | "symmetry",
    tail = 150,
  ): Promise<void> {
    await this.ask(`the ${parchment} parchment to close`, (page) =>
      page.waitForFunction(
        (which) => {
          const handle = (globalThis as never as Handles).__mathemagicum;
          if (!handle) throw new Error("the game has not put its handle out");
          return handle[which]() === null;
        },
        parchment,
        { timeout: ANSWER_MS },
      ),
    );
    await this.settle(tail);
  }

  /**
   * Walk the number line, landing on each stop in turn.
   *
   * The addition and subtraction spells are the same instrument used two
   * ways, so one helper drives both: the answer is always the stop the line
   * is currently pointing at.
   */
  async solveNumberLine(): Promise<void> {
    for (let jump = 0; jump < 6; jump++) {
      const line = await this.seam<{ stops: number[]; index: number } | null>("spell");
      const wanted = line?.stops[line.index];
      if (wanted === undefined) break;
      await this.type(wanted);
      await this.press("Enter");
    }
    await this.closed("spell");
  }

  /** Answer whatever rectangle the times spell has drawn. */
  async solveArray(): Promise<void> {
    const array = await this.seam<{ answer: number } | null>("array");
    if (!array) return;
    await this.type(array.answer);
    await this.press("Enter");
    await this.closed("array");
  }

  /**
   * Answer whatever heap the division parchment is asking about.
   *
   * Both boxes when it draws both: the harder rungs ask for the leftovers as
   * well as the share, and typing only the first leaves a parchment sitting
   * open with a cursor in it — which reads, from the outside, exactly like a
   * spell that refused.
   */
  async solveShare(): Promise<void> {
    const asked = await this.seam<{
      each: number;
      left: number;
      boxes: string[];
    } | null>("share");
    if (!asked) return;
    for (const box of asked.boxes) {
      await this.type(box === "left" ? asked.left : asked.each);
      await this.press("Enter");
    }
    await this.closed("share");
  }

  /**
   * Answer the fold: colour every square the grid still wants.
   *
   * The one parchment with nothing to type. Every other one ends in a
   * number going into a box; this one ends in taps on a picture, and what
   * makes it drivable is that the picture is published — the squares it was
   * given, the squares it still wants and where it is drawn — so this taps
   * the squares the *game* worked out rather than ones it guessed. The
   * blueprint's question; see `world/machines.ts`.
   */
  async solveSymmetry(): Promise<void> {
    interface Grid {
      wanted: string[];
      board: { left: number; top: number; step: number; cell: number } | null;
    }
    const grid = await this.seam<Grid | null>("symmetry");
    if (!grid?.board) return;
    const board = grid.board;
    for (const key of grid.wanted) {
      const [col, row] = key.split(",").map(Number);
      if (col === undefined || row === undefined) continue;
      await this.tab.mouse.click(
        board.left + col * board.step + board.cell / 2,
        board.top + row * board.step + board.cell / 2,
      );
      await this.settle(200);
    }
    await this.closed("symmetry");
  }

  /**
   * Answer whatever the logic parchment is asking.
   *
   * A tray is answered by tapping every thing the rule lets through — the
   * seam says which, and where each is drawn. A circuit is answered by
   * flipping switches: the seam publishes the lamp's own tree and which
   * switches are on, so this evaluates it the way the spell does and flips
   * towards the nearest setting that lights it, one switch at a time.
   */
  async solveLogic(): Promise<void> {
    interface Seen {
      puzzle: string;
      wanted: string[];
      picked: string[];
      switches: number;
      lamp: LogicNode;
      on: boolean[];
      board: {
        tokens: { id: string; x: number; y: number }[];
        switches: { index: number; x: number; y: number }[];
      } | null;
      done: boolean;
    }
    const seen = await this.seam<Seen | null>("logic");
    if (!seen || !seen.board) return;
    if (seen.puzzle === "sort") {
      for (const id of seen.wanted) {
        if (seen.picked.includes(id)) continue;
        const at = seen.board.tokens.find((token) => token.id === id);
        if (!at) throw new Error(`the tray has no ${id} on it`);
        await this.tab.mouse.click(at.x, at.y);
        await this.settle(120);
      }
    } else {
      // Every setting of at most three switches, nearest first.
      const settings: boolean[][] = [];
      for (let bits = 0; bits < 1 << seen.switches; bits++) {
        settings.push(Array.from({ length: seen.switches }, (_, i) => ((bits >> i) & 1) === 1));
      }
      const apart = (a: boolean[], b: boolean[]) => a.filter((x, i) => x !== b[i]).length;
      const lit = settings
        .filter((setting) => lightsLamp(seen.lamp, setting))
        .sort((a, b) => apart(a, seen.on) - apart(b, seen.on))[0];
      if (!lit) throw new Error("no setting of the switches lights this lamp");
      for (let i = 0; i < seen.switches; i++) {
        if (seen.on[i] === lit[i]) continue;
        const at = seen.board.switches.find((one) => one.index === i);
        if (!at) throw new Error(`the circuit has no switch ${i}`);
        await this.tab.mouse.click(at.x, at.y);
        await this.settle(120);
      }
    }
    await this.closed("logic");
  }

  /**
   * Answer the funnel's set diagram: every thing on the tray into its ring.
   *
   * Where each one belongs is worked out here, with the game's own
   * `regionOf` against the rules the seam publishes — the same trick
   * `solveLogic` uses on a circuit, and for the same reason. The parchment
   * says where its regions *are*, because the lens is where two circles
   * cross and nothing out here could find it; it does not say what goes in
   * them, so a scenario that dropped things in the wrong rings would fail.
   */
  async solveVenn(): Promise<void> {
    // Bounded rather than `while`, because a parchment that stopped
    // accepting drops would otherwise hang here until the scenario's own
    // timeout and say nothing about why.
    for (let left = 40; left > 0; left--) {
      if (!(await this.solveVennOnce())) break;
    }
    await this.closed("venn");
  }

  /**
   * Put one thing where it belongs, and say whether there was one to put.
   *
   * Separate from `solveVenn` so a scenario can stop one short of the end:
   * that the parchment is *still open* with one thing left on the tray is
   * the whole of "every thing has to go somewhere", and it cannot be
   * checked by something that only knows how to finish.
   */
  async solveVennOnce(): Promise<boolean> {
    const seen = await this.seam<VennSeam | null>("venn");
    if (!seen?.board) return false;
    const one = seen.onTray[0];
    const from = seen.board.waiting[0];
    if (!one || !from) return false;
    const region = regionOf(
      { left: seen.left as never, right: seen.right as never, tokens: [] },
      one as never,
    );
    const to = seen.board.spots[region];
    if (!to) throw new Error(`the diagram has nowhere to put a ${region} thing`);
    await this.drag(from, to);
    await this.settle(140);
    return true;
  }

  /**
   * Cast the hourglass and wind the world on by this many hours.
   *
   * The spell's own control is a swipe — see `swipeClock` — so this is the
   * whole cast: open it, turn the hands that far, and answer. Twelve is the
   * most a face can say, and the most one cast can buy.
   */
  async windClock(hours: number): Promise<void> {
    await this.tap("spellbook");
    await this.tap(runeButton(Spell.Hourglass));
    await this.settle(500);
    if (!(await this.seam<unknown>("clock"))) throw new Error("the hourglass did not open");
    await this.swipeClock(Math.round((hours * 60) / TICK_MINUTES));
    // The hands are the question and the number is the answer: the child
    // says how far they turned them. Read back rather than assumed, because
    // a swipe lands where it lands and the parchment is asking about where
    // the hands *are*.
    const asked = await this.seam<{ hours: number }>("clock");
    await this.type(asked.hours);
    await this.press("Enter");
    // Long enough for the sand to finish pouring, which is when the wind is
    // banked — see `windClockTo`.
    await this.settle(SAND_MOST_MS + 900);
  }

  /**
   * Close the game and open it again.
   *
   * What "tomorrow" is, and the only way to ask whether something was really
   * written down: everything a scenario has done up to here is also sitting
   * in the scene's own fields, and a room that survives a reload is a room
   * that reached the store.
   */
  async reload(seams?: string): Promise<void> {
    if (seams === undefined) {
      await this.page.reload({ waitUntil: "domcontentloaded", timeout: SETUP_MS });
    } else {
      // Opened again *somewhere else*. `?at=` is the only way across the
      // world: `standAt` writes a tile into the session and the world does
      // not stream to meet it, so a jump of four hundred tiles leaves her
      // standing in her own garden with the number changed. What survives
      // this is what was written down, which is the same thing `reload`
      // with no argument is for.
      const url = new URL(this.page.url());
      // The guides stay where the opening put them: a scenario that met
      // them goes on meeting them, and one spared them is spared again.
      const first = !new URLSearchParams(url.search).has("guided");
      await this.page.goto(`${url.origin}/?skipTitle${seams}${guidedSeam({ firstTime: first })}`, {
        waitUntil: "domcontentloaded",
        timeout: SETUP_MS,
      });
    }
    await running(this.page);
    await this.settle(800);
  }

  /**
   * Into the barn, and up to the shopkeeper.
   *
   * Here rather than in a scenario file because both halves of the shop need
   * it — buying and selling are two files now, and a walk into a building
   * copied into each is a walk that gets fixed in one of them.
   *
   * She stands at the back of the room and the room is not always laid out
   * the same way round, so this tries the squares beside the player rather
   * than assuming one: a tap on the wall behind her opens nothing, which is
   * a refusal and not a failure.
   */
  async goShopping(): Promise<void> {
    await this.walk("ArrowUp", 1000);
    await this.walk("ArrowUp", 450);
    for (const [dCol, dRow] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [-1, -1],
      [1, -1],
    ] as const) {
      await this.tapNear(dCol, dRow);
      if (await this.seam("shop")) return;
    }
    throw new Error("could not find the shopkeeper");
  }

  /**
   * Find a thing in the shop and tap it, turning shelves until it is there.
   *
   * The stock is on four shelves now, so `tap("shop.buy.chair")` only lands
   * while the shelf holding chairs is out — which is right for a child and
   * an ambush for a scenario that has always been able to reach the whole
   * list at once.
   *
   * Turned to rather than looked up: the mapping from thing to shelf is the
   * game's business and a scenario that copied it here would be a scenario
   * that quietly stopped meaning anything the day a bath moved rooms.
   * Answers false if it is nowhere, which is what a thing off every shelf
   * would look like.
   */
  async shopFor(thing: string): Promise<boolean> {
    if (await this.tap(`shop.buy.${thing}`)) return true;
    for (let shelf = 0; ; shelf++) {
      if (!(await this.tap(`shop.shelf.${shelf}`))) return false;
      await this.settle(150);
      if (await this.tap(`shop.buy.${thing}`)) return true;
    }
  }

  /**
   * Where the camera is pulled to.
   *
   * The array spell moves it on a small screen, and nothing else in the game
   * ever has — so this exists for the scenarios about that, and reads it off
   * the live camera rather than off a constant a test could get wrong.
   */
  zoomNow(): Promise<number> {
    return this.ask("the camera's zoom", (page) =>
      page.evaluate(() => {
        const handle = (globalThis as never as Handles).__mathemagicum;
        if (!handle) throw new Error("the game has not put its handle out");
        return handle.zoom();
      }),
    );
  }

  /**
   * Two fingers, moved from one spread to another about the same centre.
   *
   * Through the debugger rather than through Playwright's own touchscreen,
   * which taps and nothing else — a pinch is by definition two points at
   * once and there is no other way to say that to a page.
   *
   * Moved in steps, like a coin being dragged and for the same reason: a
   * gesture that arrives without travelling is a gesture the page never saw
   * move, and following the fingers is the whole of what a pinch does.
   */
  async pinch(centre: { x: number; y: number }, from: number, to: number): Promise<void> {
    const session = await this.ask("a line to the debugger", (page) =>
      page.context().newCDPSession(page),
    );
    const fingers = (apart: number) => [
      { x: centre.x - apart / 2, y: centre.y, id: 1 },
      { x: centre.x + apart / 2, y: centre.y, id: 2 },
    ];
    // Detached whatever happens in between. A session left open on a
    // gesture that threw halfway is a session the browser keeps until the
    // context closes, and a context that has several of those to unwind is
    // one that takes its time about closing — which reads, from out here, as
    // "the window to close" giving up.
    try {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: fingers(from),
      });
      const STEPS = 8;
      for (let step = 1; step <= STEPS; step++) {
        await session.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: fingers(from + ((to - from) * step) / STEPS),
        });
      }
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } finally {
      await session.detach().catch(() => {});
    }
    await this.settle(300);
  }

  /** A picture, for a human reading a failure. */
  async look(name: string): Promise<void> {
    await this.page.screenshot({ path: `e2e/shots/${name}.png` });
  }
}
