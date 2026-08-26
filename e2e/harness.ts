// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { type Page, chromium } from "playwright";
// The game's own feel constant rather than a copy: a harness holding its own
// idea of how far a swipe goes is a harness that silently stops matching.
import { SWIPE_PER_TICK, TICK_MINUTES } from "../src/spells/hourglass";

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
const PORT = Number(process.env.E2E_PORT ?? 5178);

/** Where the server actually ended up, which is not always where it was asked. */
let origin: string | null = null;

/** `E2E_TRACE=1` prints every step and what it cost, for finding a stall. */
const TRACE = process.env.E2E_TRACE === "1";

/**
 * Where the dev server's own output goes, for when it is the thing at fault.
 *
 * One per process, because the port is read back out of it: two runs at once
 * sharing a path would have each reading the other's address, which is a
 * confusing way to test the wrong server — the exact mistake this whole
 * arrangement exists to make impossible.
 */
const SERVER_LOG = process.env.E2E_SERVER_LOG ?? `e2e/shots/server-${process.pid}.log`;

let serving: ReturnType<typeof Bun.spawn> | null = null;

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
 * The address Vite says it is listening on, read from its own output.
 *
 * Asked rather than assumed, and that distinction cost most of a day. The
 * suite used to name a port and take whatever answered there — so an orphan
 * left by an interrupted run went on serving every run after it, for hours,
 * and the runs got slower until one stalled outright. `--strictPort` did not
 * help: the new server exited with `Port 5178 is already in use` into a log
 * nobody was reading, and the wait loop then found the *orphan* answering
 * and called it success.
 *
 * So Vite is allowed to pick — it walks up from the asked-for port until it
 * finds a free one — and this reads back which it chose. A run can then only
 * ever be talking to the server it started.
 */
async function listeningOn(): Promise<string | null> {
  const log = Bun.file(SERVER_LOG);
  if (!(await log.exists())) return null;
  const found = /http:\/\/localhost:(\d+)/.exec(await log.text());
  return found ? `http://localhost:${found[1]}` : null;
}

/**
 * The suite's own dev server.
 *
 * Reused across the scenarios of a file, started again for the next file
 * (see below for why it has to be), and never inherited from a session
 * outside the run. See `PORT` for what inheriting cost.
 */
export async function serve(): Promise<string> {
  // A server per scenario, torn down and started again each time.
  //
  // It was one for the whole file, and the ninth scenario in a file stalled
  // — reproducibly, at the same place, on a machine with nothing else
  // running. A standalone loop of nothing but page loads had already shown
  // the same shape: eleven fine and the twelfth never finishing. Whatever
  // accumulates in a Vite that has served the same heavy page ten times, the
  // cure is not to find out but to stop asking it to. Vite is ready in about
  // three hundred milliseconds, against a scenario that takes twelve
  // seconds, so this is the cheapest hermetic thing available.
  //
  // Dead handles are cleared rather than trusted for the same reason they
  // always were: bun kills processes a test file spawned when that file
  // ends, and a handle held past that made `??=` skip the respawn.
  serving?.kill();
  serving = null;
  origin = null;

  // A clean log, because the port is read back out of it and last run's
  // address is not this run's.
  //
  // Redirected by the shell rather than handed a pair of writers: two sinks
  // on one path have two buffers and two offsets, and a sink nobody drains
  // fills its pipe and stops the child dead — which is the very failure this
  // log exists to explain, manufactured by the logging.
  await Bun.write(SERVER_LOG, "");
  // Vite's own binary, exec'd, so the handle below *is* the server.
  //
  // It was `bunx --bun vite`, which spawns node as a grandchild — so killing
  // the handle killed the launcher and left the server running, holding the
  // port, outliving the run that made it. That orphan is what later runs
  // then found answering and quietly used.
  const start = `exec ./node_modules/.bin/vite --port ${PORT} >${SERVER_LOG} 2>&1`;
  serving ??= Bun.spawn(["sh", "-c", start], { stdout: "ignore", stderr: "ignore" });

  for (let wait = 0; wait < 60; wait++) {
    const at = await listeningOn();
    if (at && (await answering(at))) {
      origin = at;
      return at;
    }
    await Bun.sleep(500);
  }
  throw new Error(`the dev server never came up — see ${SERVER_LOG}`);
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
  serving?.kill();
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
    serving?.kill();
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
 * Open the game, play, and put it away.
 *
 * The world seed is pinned by default, because a scenario that walks to a
 * building has to find the same building every time — and the seed lives in
 * storage rather than in the address bar, which is the sort of thing worth
 * knowing once here rather than discovering per test.
 */
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
  const context = await bounded(
    "a browser window",
    browser.newContext({ viewport: { ...(opening.viewport ?? { width: 1000, height: 760 }) } }),
    SETUP_MS,
  );
  await context.addInitScript(
    ([seed, players]) => {
      localStorage.setItem("mathemagicum.world.seed", String(seed));
      if (players) localStorage.setItem("mathemagicum.players", JSON.stringify(players));
    },
    [opening.seed ?? 12345, opening.players ?? null] as const,
  );
  const page = await bounded("a tab to open", context.newPage(), SETUP_MS);
  const complaints: string[] = [];
  page.on("pageerror", (error) => complaints.push(`page error: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") complaints.push(`console: ${message.text().slice(0, 200)}`);
  });

  // A browser that goes away mid-scenario, said out loud.
  //
  // It does go away: watched live, a scenario stalled with no browser
  // process left on the machine at all, the dev server answering in a
  // millisecond and memory pressure at zero. Playwright does not mind — an
  // `evaluate` against a browser that is gone simply never returns — so the
  // scenario sat there until the runner's own five-minute timeout and blamed
  // itself. This turns that into one sentence, immediately.
  const lost = new Promise<never>((_, reject) => {
    browser.on("disconnected", () =>
      reject(new Error("the browser exited in the middle of the scenario")),
    );
  });
  // Nothing ever awaits `lost` on the happy path, and an unobserved
  // rejection is a crash in bun. Every use races it against real work.
  lost.catch(() => {});

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
      page.goto(`${at}/?${opening.onboarding ? "" : "skipTitle"}${opening.seams ?? ""}`, {
        waitUntil: "domcontentloaded",
        timeout: SETUP_MS,
      }),
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
  } finally {
    // Bounded like everything else, and for the same reason: a browser that
    // will not close is indistinguishable from a scenario that will not end.
    await bounded("the window to close", context.close(), SETUP_MS).catch(() => {});
    await bounded("the browser to close", browser.close(), SETUP_MS).catch(() => {});
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
 */
const SETUP_MS = 90_000;

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
  await page.waitForFunction(() => "__mathemagicum" in globalThis, null, { timeout: SETUP_MS });
  await page.waitForFunction(
    () => {
      const handle = (globalThis as never as Record<string, Record<string, unknown>>)
        .__mathemagicum;
      const stats = handle.stats as () => { frames: number };
      return stats().frames > 20;
    },
    null,
    { timeout: SETUP_MS },
  );
}

/**
 * The screens before the game are up: a canvas, sized and painted.
 *
 * No handle to wait for — that belongs to the game scene. What can be waited
 * on is the canvas existing at a real size, which is what the loading bar and
 * the title card and the three making-a-player steps all draw onto.
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
  await page.waitForTimeout(2500);
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
        const handle = (globalThis as never as Record<string, { step: () => string } | undefined>)
          .__mathemagicum_making;
        return handle ? handle.step() : "";
      }),
    );
  }

  /** Wait until one of those screens is showing what it was asked for. */
  async waitForStep(step: string): Promise<void> {
    await this.ask(`the ${step} screen`, (page) =>
      page.waitForFunction(
        (wanted) => {
          const handle = (globalThis as never as Record<string, { step: () => string } | undefined>)
            .__mathemagicum_making;
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

  /** Whatever a dev seam reports. See `devHooks.ts` for what there is. */
  seam<T>(name: string, ...args: unknown[]): Promise<T> {
    return this.within(
      `seam ${name}`,
      this.page.evaluate(
        ([which, given]) => {
          const handle = (globalThis as never as Record<string, Record<string, unknown>>)
            .__mathemagicum;
          const found = handle[which as string];
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
        const handle = (globalThis as never as Record<string, Record<string, unknown>>)
          .__mathemagicum;
        const session = handle.session as { tile: { col: number; row: number } };
        return { col: session.tile.col, row: session.tile.row };
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
          const handle = (globalThis as never as Record<string, Record<string, unknown>>)
            .__mathemagicum;
          const screenOf = handle.screenOf as (
            col: number,
            row: number,
          ) => { x: number; y: number };
          const feet = screenOf(c as number, r as number);
          const above = screenOf(c as number, (r as number) - 1);
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
          const handle = (globalThis as never as Record<string, Record<string, unknown>>)
            .__mathemagicum;
          const me = (handle.session as { tile: { col: number; row: number } }).tile;
          const screenOf = handle.screenOf as (
            col: number,
            row: number,
          ) => { x: number; y: number };
          return screenOf(me.col + (dc as number), me.row + (dr as number));
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
  async standAt(col: number, row: number, facing: string): Promise<void> {
    await this.ask(`standing her at ${col},${row}`, (page) =>
      page.evaluate(
        ([c, r, f]) => {
          const session = (
            globalThis as never as Record<string, { session: Record<string, unknown> }>
          ).__mathemagicum.session as unknown as {
            setPosition: (col: number, row: number) => void;
            face: (which: string) => void;
          };
          session.setPosition(c as number, r as number);
          session.face(f as string);
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
          (
            globalThis as never as Record<
              string,
              { session: { inventory: { count: (item: string) => number } } }
            >
          ).__mathemagicum.session.inventory.count(which as string),
        item,
      ),
    );
  }

  /** What is in the purse, in the small coin. */
  coins(): Promise<number> {
    return this.ask("what is in her purse", (page) =>
      page.evaluate(
        () =>
          (globalThis as never as Record<string, { session: { purse: { coins: number } } }>)
            .__mathemagicum.session.purse.coins,
      ),
    );
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
    await this.settle(800);
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
    await this.settle(800);
  }

  /** Answer whatever rectangle the times spell has drawn. */
  async solveArray(): Promise<void> {
    const array = await this.seam<{ answer: number } | null>("array");
    if (!array) return;
    await this.type(array.answer);
    await this.press("Enter");
    await this.settle(900);
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
      await this.page.goto(`${url.origin}/?skipTitle${seams}`, {
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
        const handle = (globalThis as never as Record<string, Record<string, unknown>>)
          .__mathemagicum;
        return (handle.zoom as () => number)();
      }),
    );
  }

  /** A picture, for a human reading a failure. */
  async look(name: string): Promise<void> {
    await this.page.screenshot({ path: `e2e/shots/${name}.png` });
  }
}
