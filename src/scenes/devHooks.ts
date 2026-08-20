// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { SPELLS } from "../spells/spellbook";
import type { GameSession } from "../world/session";

/**
 * Deliberate seams for driving the game from a script, and nothing else.
 *
 * These exist because the alternative was worse. Browser tests were reaching
 * in from outside and monkeypatching whatever they could get at: `Date.now`
 * was pinned to make the spell's problems predictable, which also stalled the
 * walk tween, so sprites drew a tile from where the camera said the player
 * was and three separate "the tap is broken" conclusions turned out to be the
 * test's own doing. Coordinates for buttons were copied into scripts by hand
 * and silently pointed at the wrong one the moment the action bar grew a
 * fourth slot. And nothing could be *read back*, so every assertion was a
 * human looking at a screenshot.
 *
 * So the game offers the seams instead: a seed, a way to hold the villagers
 * still, and a handle to read state and button positions from. Each is a
 * thing a test legitimately needs and cannot get any other way.
 *
 * All of it is gated on `import.meta.env.DEV`, so a production build has no
 * hook and ignores every parameter. That is the whole safety argument — a
 * `?coins=` that survived into a release would be a cheat code.
 */

export interface DevOptions {
  /** Fixes the spell RNG, so a script knows which sums it will be asked. */
  readonly seed: number | null;
  /** Holds the villagers on their home tiles, so their positions are knowable. */
  readonly freezeNpcs: boolean;
  /** Coins to start with, so a test of the shop need not first farm for them. */
  readonly coins: number;
  /**
   * Which language the game is being read in, overriding the browser's.
   *
   * Without it a script checking the German half of the game would have to
   * launch a second browser context with a different locale.
   */
  readonly language: string | null;
  /**
   * Ask for the welcome again.
   *
   * The postal worker walks it over once and it is then remembered as seen,
   * which is right for a player and useless for a script: without this the
   * only way to test the tutorial twice would be to clear the saved settings
   * from outside, which is exactly the reaching-in these seams replace.
   */
  readonly intro: boolean;
  /**
   * Places to count as already walked into, for the portal spell.
   *
   * `?reached=all`, or a comma-separated list of anchor ids. Without it a
   * script checking the measuring half of the portal would first have to
   * walk a character two hundred cells across a generated world — which is
   * the journey the spell exists to save, and a slow way to find out whether
   * a ruler is drawn correctly.
   */
  readonly reached: readonly string[];
  /**
   * Which rung of the portal spell to cast at.
   *
   * The one spell with four visibly different parchments — counting stones,
   * reading a mark, adding the legs, the crow's flight — and which one a
   * child sees comes from a saved profile that `?skipTitle` deliberately
   * does not make. Without this the other three could only be looked at by
   * playing a child up to them.
   *
   * It moves the *geometer's lesson* too, which is drawn at the same rung —
   * so one setting shows both the parchment a child is given and the
   * explanation they can go and ask for.
   */
  readonly portalRung: number | null;
  /** Hold the array spell at one rung of its own ladder. */
  readonly arrayRung: number | null;
  /** Hold the hourglass at one rung of the clock ladder. */
  readonly clockRung: number | null;
  /**
   * How long ago the world was last put down, in hours.
   *
   * The one dev seam that fakes something the *store* would normally say.
   * Without it the hourglass can only be seen by closing the game, waiting
   * an hour and opening it again, which is not a thing a screenshot can do.
   */
  readonly away: number | null;
  /**
   * Spells to count as already taught.
   *
   * `?learned=all`, or a comma-separated list. The portal spell is learned
   * from the geometer now, so without this every script that wants it has to
   * walk into the tower and tap him first — which is a test of the gate, not
   * of the thing being tested.
   */
  readonly learned: readonly string[];
  /**
   * Pin the clock, in hours.
   *
   * The day-night cycle follows the player's own wall clock, which is right
   * for a player and useless for looking at: verifying that night is lit
   * meant either waiting for evening or trusting a screenshot taken at some
   * unrepeatable hour. Pinning `Date` from outside was tried once and stalled
   * every tween in the scene, so the game states the seam instead.
   */
  readonly hour: number | null;
  /**
   * Start the game without waiting at the title card or at who's playing.
   *
   * The card holds until it is tapped and the players screen holds until a
   * face is picked, both of which are right for a player and a standing
   * obstacle for a script: every browser test here begins by waiting for the
   * world to exist, and the world does not exist until somebody has said go
   * and said who they are. With this, the most recent player is played — and
   * one is made and saved if the device has none, so a script that plants a
   * field and reloads finds the same child and the same world.
   */
  readonly skipTitle: boolean;
  /**
   * Stand somewhere in particular, as `?at=col,row`.
   *
   * The world is five hundred tiles across and most of what is worth looking
   * at is nowhere near where the player starts. Walking a script to the far
   * rim takes minutes and gets stuck on the first thing it cannot path
   * around; moving the session alone leaves the sprite and the camera behind,
   * because the scene owns where the player is *drawn*. So the scene states
   * the seam instead, and sets the position before it builds the sprite.
   */
  readonly at: { col: number; row: number } | null;
}

const NONE: DevOptions = {
  seed: null,
  freezeNpcs: false,
  coins: 0,
  language: null,
  intro: false,
  reached: [],
  portalRung: null,
  arrayRung: null,
  clockRung: null,
  away: null,
  learned: [],
  hour: null,
  skipTitle: false,
  at: null,
};

export function devOptions(search = globalThis.location?.search ?? ""): DevOptions {
  if (!import.meta.env.DEV) return NONE;
  return parseDevOptions(search);
}

/**
 * `all`, a list, or nothing.
 *
 * Unknown names are kept rather than dropped: the profile checks them
 * against the anchors it knows, and swallowing a typo here would leave a
 * script wondering why its destination was still locked.
 */
export function places(raw: string | null): readonly string[] {
  return names(raw, ALL_PLACES);
}

/** `all`, a comma-separated list, or nothing. */
export function names(raw: string | null, everything: readonly string[]): readonly string[] {
  const value = raw?.trim();
  if (!value) return [];
  if (value === "all") return everything;
  return value
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

/**
 * The sentinel `?learned=all` expands to.
 *
 * Derived rather than listed. It was a list, and the list was two spells
 * behind the spellbook — so `?learned=all` quietly meant "all the ones that
 * existed when this line was written", and the two newest spells were the
 * ones a script could not reach.
 */
export const ALL_SPELLS: readonly string[] = SPELLS;

/** The sentinel `?reached=all` expands to, kept out of `places` for testing. */
export const ALL_PLACES: readonly string[] = [
  "village",
  "harbour",
  "bigCity",
  "observatory",
  "enchantedForest",
];

/** Split out from the environment check so it can be tested on its own. */
export function parseDevOptions(search: string): DevOptions {
  const params = new URLSearchParams(search);
  const number = (name: string, whole = true): number | null => {
    const raw = params.get(name);
    // Empty counts as absent. `Number("")` is 0, which is finite, so a bare
    // `?seed=` would otherwise hand a script seed 0 — a different set of
    // problems than the one it computed, failing as wrong answers.
    if (raw === null || raw.trim() === "") return null;
    const value = Number(raw);
    if (!Number.isFinite(value)) return null;
    // Seeds and coins are counts; the clock is not — half past nine is 9.5.
    return whole ? Math.trunc(value) : value;
  };
  return {
    seed: number("seed"),
    // Present at all means on: `?freezeNpcs` reads better than
    // `?freezeNpcs=true`, and a script that writes `=0` meaning off would be
    // wrong in a way nothing tells it about.
    freezeNpcs: params.has("freezeNpcs"),
    coins: Math.max(0, number("coins") ?? 0),
    language: params.get("lang")?.trim() || null,
    intro: params.has("intro"),
    reached: places(params.get("reached")),
    portalRung: number("portalRung"),
    arrayRung: number("arrayRung"),
    clockRung: number("clockRung"),
    away: number("away"),
    learned: names(params.get("learned"), ALL_SPELLS),
    hour: number("hour", false),
    skipTitle: params.has("skipTitle"),
    at: tile(params.get("at")),
  };
}

/** `col,row`, or nothing if it is not a pair of whole numbers. */
function tile(raw: string | null): { col: number; row: number } | null {
  const parts = (raw ?? "").split(",");
  if (parts.length !== 2) return null;
  // Empty is absent, not zero — the same trap `number` above guards against,
  // and here `?at=12,` would otherwise mean the top edge of the map rather
  // than a typo.
  if (parts.some((part) => part.trim() === "")) return null;
  const col = Number(parts[0]);
  const row = Number(parts[1]);
  if (!Number.isInteger(col) || !Number.isInteger(row)) return null;
  if (col < 0 || row < 0) return null;
  return { col, row };
}

/** What a driving script can see. Read-only by intent, not by enforcement. */
export interface DevHandle {
  readonly session: GameSession;
  /** Screen positions of the named buttons, so scripts stop guessing them. */
  readonly ui: () => Record<string, { x: number; y: number }>;
  /**
   * The door tile of each building, by id.
   *
   * The world half of the same problem `ui` solves. Walking to a building
   * meant guessing a direction from the village layout constants and
   * stepping until something happened; the shop is behind one of these doors
   * now, so a script that cannot find it cannot test the shop at all.
   */
  readonly doors: () => Record<string, { col: number; row: number }>;
  /**
   * Where every person a script can interact with is standing, by id.
   *
   * The shopkeeper is inside her room and only exists while the player is in
   * there, so there is no layout constant to compute her from — and the one
   * villager who answers a tap is exactly the one a test needs to find.
   */
  readonly npcs: () => Record<string, { col: number; row: number }>;
  /**
   * Where a tile is on screen right now.
   *
   * Scripts were computing this from the camera centre and the player's tile,
   * which holds outdoors and quietly stops holding indoors: a room is smaller
   * than the viewport, so the camera clamps and the player is nowhere near
   * the middle. Every tap aimed at the shopkeeper landed on the floor beside
   * her, and the game answered "Can't walk there".
   */
  readonly screenOf: (col: number, row: number) => { x: number; y: number };
  /**
   * The cast on the parchment right now, or null if none is open.
   *
   * The same problem `ui` solves, for the one panel a script cannot drive by
   * tapping: answering the spell means knowing what it asked, and the only
   * other way to find out is to read the sum back off the picture. `stops`
   * is every landing and `index` is the box waiting — so the answer a script
   * should type is `stops[index]`.
   */
  readonly spell: () => {
    start: number;
    addend: number;
    stops: readonly number[];
    index: number;
  } | null;
  /**
   * What the portal spell is asking, once a destination has been picked.
   *
   * Same reason as `spell`: answering it means knowing the answer, and the
   * answer is a fact about a world the script did not generate. `place` and
   * `reached` are here so a script can check what the map is offering
   * without reading the profile out of storage.
   */
  /**
   * How many scenery sprites are alive right now.
   *
   * The trees come and go with the chunk they stand on, and the failure that
   * arrangement invites is a leak: a chunk evicted without its scenery
   * destroyed leaves sprites nobody will ever see again, and the only symptom
   * is the game getting slower the further you walk.
   */
  readonly scenery: () => number;
  /**
   * How much of the scenery the camera can see, and how much of it exists.
   *
   * The one thing the per-chunk spawning can get wrong that no count catches:
   * a tree inside the viewport whose chunk was not spawned is a hole in the
   * wood, and it would blink in as the player walked toward it. `live` must
   * never be less than `inView`.
   */
  readonly sceneryOnScreen: () => { inView: number; live: number };
  /**
   * What the array spell is asking, or null if its parchment is shut.
   *
   * Same reason as `spell`: answering it means knowing what it asked, and
   * the only other way to find out is to count the dots in a screenshot.
   */
  readonly array: () => {
    rows: number;
    columns: number;
    answer: number;
    entry: string;
    done: boolean;
  } | null;
  /** The tint over the world: time of day, the wood's dusk, and the result. */
  readonly shade: () => { dusk: number; night: number; alpha: number };
  /**
   * What the hourglass is asking, or null if its parchment is shut.
   *
   * The same reason as `spell`: answering it means knowing the answer, and
   * the answer is a fact about two clock faces that a script would otherwise
   * have to read out of a screenshot.
   */
  readonly clock: () => {
    left: { hour: number; minute: number };
    back: { hour: number; minute: number };
    hours: number;
    entry: string;
    done: boolean;
  } | null;
  /**
   * The astronomer's lamp posts, and how many are lit.
   *
   * Where they are depends on how big a shelf the mountain left, so a script
   * driving her quest cannot compute them — and the only other way to find a
   * post is to look for a cell that is bare dirt among a path of bare dirt.
   */
  readonly lamps: () => {
    posts: readonly { col: number; row: number }[];
    lit: number;
  } | null;
  /** Where each place's mark sits on screen, so a script can tap one. */
  readonly portalMarks: () => Record<string, { x: number; y: number }>;
  readonly portal: () => {
    place: string;
    league: number;
    tier: string;
    across: number;
    down: number;
    answer: number;
    reached: readonly string[];
  } | null;
}

const HANDLE_KEY = "__mathemagicum";

export function exposeForTests(handle: DevHandle): void {
  if (!import.meta.env.DEV) return;
  (globalThis as unknown as Record<string, unknown>)[HANDLE_KEY] = handle;
}
