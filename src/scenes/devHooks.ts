// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { SPELLS } from "../spells/spellbook";
import { FLOWER_TYPES } from "../world/flowers";
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
 * **All of it ships.** It used to be gated on `import.meta.env.DEV`, on the
 * argument that a `?coins=` surviving into a release would be a cheat code.
 * That argument was given up deliberately, and it is worth writing down why
 * rather than leaving the next reader to assume it was an oversight.
 *
 * Nothing here is a security boundary and it never was. There is no server,
 * no account and no money in this game; a world is a few keys in
 * `localStorage` on one tablet. Anybody who can open a console could already
 * write a purse straight into the save. These seams make that *convenient*;
 * they do not make it possible.
 *
 * And what they make convenient is cheating at arithmetic a child is doing
 * for their own sake. The one who works out that `?learned=all` skips the
 * geometer has demonstrated something this game would rather reward than
 * prevent — as the owner put it, a child who can hack the URL does not need
 * simple arithmetic lessons.
 *
 * What it buys is the browser suite: every scenario in `e2e/` is written
 * against these seams, so with them stripped from a build the suite can only
 * ever be run against a dev server — which is slower, is not what ships, and
 * degrades under repeated page loads until whole files fail. See `serve`.
 *
 * The one cost worth naming, because it is not the cheating one: `session`
 * is the live object and the game autosaves. A poke through it can persist a
 * world the restore path never expected, and the child at the other end has
 * no way to know what happened.
 */

export interface DevOptions {
  /** Fixes the spell RNG, so a script knows which sums it will be asked. */
  readonly seed: number | null;
  /** Holds the villagers on their home tiles, so their positions are knowable. */
  readonly freezeNpcs: boolean;
  /** Coins to start with, so a test of the shop need not first farm for them. */
  readonly coins: number;
  /**
   * Put this many of every crop in the basket.
   *
   * For the things a full basket is a precondition of rather than the
   * subject: feeding an animal what it asked for otherwise means planting
   * one, growing it through three stages and harvesting it before the test
   * can begin, which is a test of the garden wearing a test of a chicken.
   */
  readonly crops: number;
  /**
   * Make every animal ask, and keep it asking.
   *
   * They ask on random clocks of their own, which is the point of them and
   * the one thing a script cannot wait out: a test that stood in the village
   * hoping a chicken would get hungry would be a test that passes at three
   * in the afternoon.
   */
  readonly hungry: boolean;
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
   * Put a wall on the parchment as soon as the world is up.
   *
   * The bricklaying spell is cast on a square of a house that is not built
   * yet, so playtesting one rung of it otherwise means walking indoors and
   * finding an edge — several minutes of the wrong thing before the thing
   * being looked at. With `?wall&brickRung=6` it is the first thing on
   * screen. It builds nothing: the floor tile is laid by whatever asked for
   * the wall, and nothing asked.
   */
  readonly wall: boolean;
  /**
   * Start with this many of every material in the basket.
   *
   * Wood and stone come from the clearing spell, so playtesting anything
   * that *spends* them otherwise begins with several minutes of taking
   * trees out of the ground — which is the loop, and not the loop being
   * looked at. `?materials=6` is three rooms' worth.
   */
  readonly materials: number;
  /**
   * How many of every piece of furniture, in every colour, to start with.
   *
   * The counterpart of `materials` for the things a room is furnished with.
   * Added because a scenario about *several* stoves could not get a second
   * one: furniture is bought, and walking a child to the shop and counting
   * out coins is a different scenario wearing this one's clothes.
   */
  readonly furniture: number;
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
  /** And the sharing spell's, held at one rung for a script. */
  readonly shareRung: number | null;
  readonly brickRung: number | null;
  /** Hold the hourglass at one rung of the clock ladder. */
  /**
   * `?rung=` — which rung of the *addition* ladder the sums come from.
   *
   * The one ladder that had no seam, which was an oversight rather than a
   * decision: every other spell has one, and this is the ladder the other
   * five are scaled against. It is also the only way to see a six-digit sum
   * without climbing sixteen rungs to reach it.
   */
  readonly rung: number | null;
  readonly clockRung: number | null;
  /**
   * `?symmetryRung=` — which shape the mirror spell puts on the parchment.
   *
   * The one ladder no band touches, so this is the only way to reach the
   * arrowhead without folding twenty shapes to climb to it.
   */
  readonly symmetryRung: number | null;
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
   * `?flowers=all`, or a comma-separated list of them.
   *
   * The only way a script reaches the planting side of this at all: the
   * flowers grow wild somewhere on a five-hundred-square world, and walking
   * to one is minutes of pathfinding to prove something the world generator
   * already has its own tests for.
   */
  readonly flowers: readonly string[];
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
   * Turn one square to water after the world is grown: `?drown=col,row`.
   *
   * The ground moving under a save is the thing the whole compatibility
   * story is about, and it is otherwise unreachable from a test — it happens
   * when somebody changes a habitat rule, which is not something a scenario
   * can do and should not be something it pins. This makes the *consequence*
   * reachable: a square that was grass when she built on it and is sea when
   * she comes back.
   */
  readonly drown: { col: number; row: number } | null;
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
  /**
   * Open the division spell's parchment on this rung, at once.
   *
   * The spell has a minigame and no world half yet — no rune, no harvest,
   * nobody who teaches it — so there is nothing in the game that opens this
   * parchment and no way to look at it. `?share=2` is that way, and it is
   * the same shape as every other seam here: a thing the game will do on its
   * own later, made reachable now.
   *
   * Null when it was not asked for, so a plain load is a plain load.
   */
  readonly share: number | null;
}

export function devOptions(search = globalThis.location?.search ?? ""): DevOptions {
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

/** And what `?flowers=all` expands to: every one there is to find. */
export const ALL_FLOWERS: readonly string[] = FLOWER_TYPES;

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
    crops: Math.max(0, number("crops") ?? 0),
    hungry: params.has("hungry"),
    language: params.get("lang")?.trim() || null,
    intro: params.has("intro"),
    wall: params.has("wall"),
    materials: Math.max(0, number("materials") ?? 0),
    furniture: Math.max(0, number("furniture") ?? 0),
    reached: places(params.get("reached")),
    portalRung: number("portalRung"),
    arrayRung: number("arrayRung"),
    shareRung: number("shareRung"),
    brickRung: number("brickRung"),
    rung: number("rung"),
    clockRung: number("clockRung"),
    symmetryRung: number("symmetryRung"),
    learned: names(params.get("learned"), ALL_SPELLS),
    flowers: names(params.get("flowers"), FLOWER_TYPES),
    hour: number("hour", false),
    drown: tile(params.get("drown")),
    skipTitle: params.has("skipTitle"),
    at: tile(params.get("at")),
    share: number("share"),
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
   * Whether the world map is up.
   *
   * The map is opened by tapping the picture on the post office wall and by
   * nothing else, and a panel that failed to open leaves the screen looking
   * exactly as it did — so the door being open is not the same fact as the
   * map being reachable, and a scenario about the second needs to be able to
   * ask. See `hoursFor`: the tower keeps no hours until a child has the
   * portal, precisely so that this can be true at two in the morning.
   */
  readonly mapOpen: () => boolean;
  /**
   * The wall of bricks on the parchment, or null when none is open.
   *
   * Hands over the answer as well as the question, which the other spells'
   * seams do not have to: an array's answer is its two sides multiplied and
   * a script can work that out, but a wall's gaps are recovered by a solver,
   * and a script that reimplemented it would be testing its own copy.
   */
  /**
   * The floor plan of the room she is standing in, or null.
   *
   * The one thing about a growable room a script cannot see: the picture is
   * a texture, and counting plaster pixels to work out where the walls are
   * is not a test, it is a second implementation of the mask rule.
   */
  readonly house: () => {
    room: string;
    /** The house this room belongs to, so a plan can be found in a save. */
    id: string | null;
    /** Floor squares, in the plan's own coordinates — which may be negative. */
    floor: string[];
    /** The offset between those and the grid she walks on. */
    origin: { col: number; row: number };
    /** Where she could build next, in *grid* coordinates, as she taps them. */
    buildable: { col: number; row: number }[];
  } | null;
  /**
   * What is standing in the room she is in, and where.
   *
   * The furniture is sprites now rather than paint, so a script *could* find
   * it by hunting the display list — which is a second implementation of
   * "which of these is a bed" and would pass while the real one was wrong.
   */
  /**
   * What the shop counter says, or null when nobody is at it.
   *
   * The one screen in the game where a child can be wrong about the *coins*
   * rather than about the sum, and until now nothing could drive it — the
   * panel had no seam at all, which is a large part of why it had no tests.
   */
  readonly shop: () => {
    mode: string;
    item: string | null;
    quantity: number;
    most: number;
    owed: number;
    onCounter: number;
    /** Which colourway is chosen, for a thing that comes in colours. */
    look: number;
  } | null;
  readonly decor: () =>
    | { piece: string; col: number; row: number; look: number; turn: number }[]
    | null;
  readonly bricks: () => {
    values: number[];
    hidden: number[];
    asked: number | null;
    answer: number | null;
    entry: string;
    missteps: number;
    done: boolean;
  } | null;
  /**
   * The spell whose rune is lit and waiting for a square, or null.
   *
   * A rune that is waiting looks like a rune that is pulsing, and a script
   * cannot see a tween. Without this the only way to ask whether arming
   * worked is to tap the ground and see whether a parchment opens — which
   * cannot tell "the rune went out" from "the tap missed".
   */
  readonly armed: () => string | null;
  /**
   * The square she is pointing at, or null when she is not pointing at one.
   *
   * A ring drawn on the grass, which a script cannot see — and everything
   * she does lands on it rather than on the square she is facing, so an aim
   * that outlives what set it is a spell going somewhere she is not looking.
   * That is not visible from anything else here: `where` says where she is
   * standing, and a cast that landed on the wrong square looks exactly like
   * a cast that did nothing.
   */
  readonly aimed: () => { col: number; row: number } | null;
  /**
   * Which way round the thing she is holding will go down: nought facing the
   * camera, then away, then the two side-on ways.
   *
   * A seam because turning is the one thing here a picture cannot settle at
   * a glance — the two side-on ways are the same drawing mirrored, and at
   * this size telling a mirrored bench from an unmirrored one by eye is a
   * game of spot-the-difference.
   */
  readonly armedTurn: () => number;
  /**
   * The great tree's doorstep, so a script can go and look at the grove.
   *
   * It is the one place in the world that is neither a building's door nor a
   * village anchor, and a script that wanted to see it was reduced to
   * guessing at the map.
   */
  /**
   * The tree's doorstep, the tree itself, and the wood closed over its beds.
   *
   * Where a scenario has to stand to speak to it, and which squares its
   * errand is about — neither of which a script can work out, because both
   * come out of the world's seed.
   */
  readonly grove: () => {
    col: number;
    row: number;
    tree: { col: number; row: number };
    thicket: { col: number; row: number }[];
  };
  /** Which spells this child has been taught, as the profile has them. */
  readonly spells: () => string[];
  /**
   * Every fire alight in the room she is standing in: where each is and how
   * brightly it is throwing light. Empty if there is no room, no fireplace,
   * or no night to see one against.
   *
   * A glow is an additive sprite over a tint, so a screenshot can say the
   * room looks warm but not why. This says which fires did it — and it is a
   * *list* because it was one, which is the shape the stove bug had: a
   * scenario could not have told a room with three stoves from a room with
   * one, and neither could a picture, because they were the same picture.
   */
  readonly hearths: () => { col: number; row: number; alpha: number }[];
  /**
   * What the scene is costing right now.
   *
   * A frame rate a script can read, and the two numbers that explain it: how
   * many objects are on the display list, and how many of those are alive
   * only because a chunk of woodland is on screen. "It felt laggy" is not
   * something anybody can act on; "seven thousand sprites" is.
   */
  /**
   * The moving sea, which is drawn by nothing else on screen.
   *
   * Water is the one thing in the world that is a sprite *under* the ground
   * — see `WATER_DEPTH` — and nothing else can see it. It is not an object
   * on the grid, not in the save, and not in the scenery buckets, which is
   * exactly what would let it quietly stop being laid down while every test
   * in the suite went on passing. `terrainAtlas.test.ts` proves the frame
   * names and the generator proves the two halves compose; what is left, and
   * what only a browser can say, is that there are tiles of sea on screen and
   * that they are not all showing the same picture for ever.
   */
  /** Every machine in the world and what it is holding. See `machines.ts`. */
  readonly machines: () => {
    where: string;
    awake: boolean;
    holding: string | null;
    heap: number;
    crates: number[];
    made: string | null;
    passes: string | null;
    binned: string | null;
    bin: number;
    mark: number;
  }[];
  /** Every length of wire, and whether it is carrying. See `wires.ts`. */
  readonly wires: () => { from: string; to: string; moved: number }[];
  /** Which end of a wire she has hold of, or null. */
  readonly wiring: () => { col: number; row: number } | null;
  readonly sea: () => {
    /** How many tiles of water are laid under the chunks on screen. */
    tiles: number;
    /** Which step of the swell the sea is on. */
    phase: number;
    /** The distinct frames those tiles are showing between them. */
    showing: readonly string[];
    /** A few of them by name and frame, so a script can watch one move. */
    sample: readonly string[];
  };
  readonly stats: () => {
    fps: number;
    /** Frames this scene has drawn, so a script can divide by it exactly. */
    frames: number;
    renderer: string;
    objects: number;
    updating: number;
    view: { width: number; height: number };
  };
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
    readonly bare: {
      readonly start: number;
      readonly addend: number;
      readonly total: number;
      readonly unknown: string;
    } | null;
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
  /**
   * Where the harbour's traffic is, in world pixels, or nothing if she has
   * none.
   *
   * A visiting ship is in no list a script can read: she is not an object on
   * the grid, not a villager, not in the save — deliberately, because she is
   * weather. That leaves nothing to assert about her without this, and "the
   * harbour has ships in it" is precisely the sort of claim that would go on
   * being made after the sprites stopped being drawn.
   *
   * Pixels rather than cells, and one entry per ship *currently in port*, so
   * a script can watch one move without having to know the timetable.
   */
  readonly ships: () => { x: number; y: number; canvas: string }[];
  /**
   * Where the city's airships are, in world pixels.
   *
   * A seam because a blimp is the one thing in this world a screenshot
   * genuinely cannot settle: it is drawn in the sky over a roof, and a sky
   * is the same colour as a sky whether the sprite is over the right house,
   * the wrong house, or nothing at all.
   */
  readonly blimps: () => { x: number; y: number }[];
  /**
   * The cell the world map puts its you-are-here mark on.
   *
   * Not the same question as "where is she standing", which is the whole
   * reason it is worth asking. Indoors her tile is a *room* coordinate, and
   * the map drew that as a world cell — a mark in the far north-west corner
   * of the world, from inside the one building the map hangs in.
   */
  readonly mapMark: () => { col: number; row: number };
  /**
   * Which patch spell is waiting for ground, or null.
   *
   * `armed` answers about the spells that land on one square. A patch spell
   * is a different state — the rune is lit and a rectangle is being drawn —
   * and until now the only way to see it from a script was to notice that
   * the camera had moved.
   */
  readonly marking: () => string | null;
  /**
   * Who currently has a rune hanging over them, waiting to be asked.
   *
   * A pulsing half-transparent mark is the one thing on screen a screenshot
   * cannot be trusted about: it is faint by design and it breathes, so a
   * picture taken at the wrong instant looks the same as one taken of a
   * mark that is not there.
   */
  readonly teaching: () => string[];
  /**
   * What the division parchment is asking, and what has been typed into it.
   *
   * The same reason `spell` and `array` exist: answering a cast means
   * knowing what it asked, and the only other way to find out is to count
   * apples in a screenshot.
   */
  /** The help line under the addition parchment, if one is open. */
  readonly spellHint: () => string;
  /**
   * The last thing thought over her head: which pictures, and whether they
   * were crossed out.
   *
   * A cloud lasts four hundred milliseconds and every tap in the harness
   * waits five hundred before it looks, so this is the one piece of feedback
   * in the game a screenshot genuinely cannot catch.
   */
  readonly thought: () => { icons: string[]; crossed: boolean } | null;
  readonly share: () => {
    total: number;
    parts: number;
    each: number;
    left: number;
    tier: string;
    box: string;
    boxes: string[];
    typed: { each: string; left: string };
    done: boolean;
    missteps: number;
  } | null;
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
    /** What the world's clock said when the parchment opened. */
    from: { hour: number; minute: number };
    /** Where the hands have been dragged to. */
    to: { hour: number; minute: number };
    /** The answer those two ask for. */
    hours: number;
    minutes: number;
    entry: string;
    entryMinutes: string;
    box: string;
    asksMinutes: boolean;
    done: boolean;
    /** The stretch of parchment a swipe turns the clock on, on screen. */
    grip: { left: number; top: number; right: number; bottom: number } | null;
  } | null;
  /**
   * The world's clock: what hour it is, and how far the glass has wound it.
   *
   * The hourglass spell's whole effect is the light, and light is the one
   * thing a script cannot read — so the number behind it is stated here.
   */
  readonly worldClock: () => { hour: number; offset: number };
  /**
   * Whether the village is up: doors unlocked, people in the street.
   *
   * Its own seam rather than something a script infers from a door that
   * refused it. A scenario that read "I could not get in" and called that
   * closed would pass just as well if the door had moved.
   */
  /** Where the camera is pulled to. See `markingZoom`. */
  readonly zoom: () => number;
  readonly openHours: () => { open: boolean; hour: number; opensIn: number };
  /**
   * How many refusal pictures — a moon, a sun — are on screen at once.
   *
   * There should never be more than one. Walking into a shut door is a held
   * key rather than a single press, and every step used to put up another.
   */
  readonly floatingMarks: () => number;
  /**
   * What the clock in the corner of the screen is showing.
   *
   * The hour on a twelve-hour face, the date in the words this language
   * writes one in, and which picture is beside them — `ui-mark-day` for the
   * sun, `ui-mark-night` for the moon.
   */
  readonly hudClock: () => { time: string; date: string; sky: string; shown: boolean };
  /**
   * Which building she is standing inside, or null for out of doors.
   *
   * `house` answers this for her *own* house and only for that, because it
   * carries the room's plan and only a growable room has one. A scenario
   * about a shut shop needs the plain question, and reading a null plan as
   * "she is outside" would have passed whether or not she got in.
   */
  readonly inside: () => { room: string; building: string | null } | null;
  /**
   * The three wild flowers, what this child has found, and what she planted.
   *
   * Where they grow is drawn from the world's seed out of every cell the
   * connectivity pass proved walkable, so it is a different answer in every
   * world and there is nothing a script could hard-code. This is how a
   * scenario walks to one.
   */
  readonly flowers: () => {
    readonly wild: readonly { flower: string; col: number; row: number }[];
    readonly found: readonly string[];
    readonly planted: readonly { flower: string; look: number; col: number; row: number }[];
  };
  /**
   * The grid on the mirror parchment.
   *
   * The only spell whose answer is a tap on a *picture*: no box to type into
   * and no button with a name. `given` is the picture she was handed and
   * `wanted` the squares still missing, both as `"col,row"`; `board` says
   * where the grid is drawn, which is what turns one of those into a tap.
   */
  readonly symmetry: () => {
    readonly size: number;
    readonly axis: string;
    readonly given: readonly string[];
    readonly wanted: readonly string[];
    readonly filled: readonly string[];
    readonly board: { left: number; top: number; step: number; cell: number; size: number } | null;
    readonly done: boolean;
    readonly missteps: number;
    readonly wrong: string | null;
    /** Whether the grid has started giving a square away. */
    readonly hinting: boolean;
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
  /**
   * Every animal, where it is, and what it is hungry for.
   *
   * Which crop a given chicken wants comes out of the world seed, so a
   * script cannot know it without either generating the world itself or
   * reading the icon out of a screenshot — and reading the icon is the one
   * thing a test of the bubble should not depend on.
   */
  readonly animals: () => {
    id: string;
    kind: string;
    col: number;
    row: number;
    craves: string;
    mood: string;
    bubble: boolean;
    /**
     * What is in the cloud over it: `food`, `question`, `smile`, or nothing.
     *
     * Not the same question as `bubble`. A tap on an animal that is not
     * asking puts up a cloud for a beat which is nobody's bubble, and what
     * is *in* it is the whole of what that tap says.
     */
    thinking: string[];
  }[];
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
  (globalThis as unknown as Record<string, unknown>)[HANDLE_KEY] = handle;
}

/** What the screens before the game will say about themselves. */
export interface MakingHandle {
  /** Which screen is up: the faces, one of the three steps, or the card. */
  readonly step: () => string;
}

const MAKING_KEY = "__mathemagicum_making";

/**
 * The same seam, for the screens *before* the game.
 *
 * Its own handle rather than a corner of `DevHandle`, because the two are
 * never up at the same time and nothing on this one is about a world. What
 * it is for is the same thing: these screens are drawn on a canvas and have
 * nothing a script can name, so a scenario driving them was reduced to
 * clicking at a fraction of the viewport and hoping the last one landed.
 * That is how the making-a-player screens ended up with no coverage at all,
 * and how a keyboard could carry the whole game off the top of an iPad
 * without anything noticing.
 */
export function exposeMakingForTests(handle: MakingHandle): void {
  (globalThis as unknown as Record<string, unknown>)[MAKING_KEY] = handle;
}

export function forgetMakingForTests(): void {
  (globalThis as unknown as Record<string, unknown>)[MAKING_KEY] = undefined;
}
