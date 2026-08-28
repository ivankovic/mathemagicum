// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { AvatarStyle } from "../avatar/style";
import { DEFAULT_AVATAR } from "../avatar/style";
import { type Language, languageOf } from "../settings";
import { HARDEST_BRICK_RUNG } from "../spells/bricks";
import { type Band, DEFAULT_BAND, bandAt, bandOn, rungInBand } from "../spells/difficulty";
import { HARDEST_SHARE_RUNG } from "../spells/division";
import { HARDEST_CLOCK_RUNG } from "../spells/hourglass";
import { HARDEST_ARRAY_RUNG } from "../spells/multiplication";
import { readLearned } from "../spells/spellbook";
import { HARDEST_SYMMETRY_RUNG } from "../spells/symmetry";
import { readFound } from "../world/flowers";
import { HOME_PLACE, PLACE_NAMES, type PlaceName } from "../world/places";
import type { PlayerSnapshot } from "./snapshot";

/**
 * Who is playing, and which world is theirs.
 *
 * One child, one avatar — and, since playtesting, *one world between them
 * all*. The children asked to share, so the world moved off the profile and
 * onto the device: everybody gardens the same land, taking turns.
 *
 * What stays with the person is everything about the person — their name,
 * their character, their language, how hard their sums are, their purse and
 * their basket. The purse is the one that is not obvious, and it is the one
 * worth stating: a shared purse would let one child spend what another
 * earned, and on a family tablet that is a fight rather than a feature. The
 * crops in a basket are theirs for the same reason. They picked them.
 *
 * What is shared is the ground: the terrain, the seed it grew from, what is
 * planted in it and what has been put down on it. See `src/save/world.ts`.
 *
 * Everything a child chose lives here, the language included. It used to be
 * one setting for the whole device, which is wrong on the machine this is
 * built for: two siblings sharing a tablet may well not read the same
 * language, and the one who does not gets a game they cannot play.
 *
 * The world itself is a seed and a diff (see snapshot.ts). What is here is
 * the person.
 */

/**
 * Who a child is. Kept by the device, and never by a saved game.
 *
 * Their name, their face, the language they read and how hard their sums
 * are. None of that is a fact about a world, so none of it goes into one:
 * starting a new game must not mean typing four names and picking four faces
 * again, and loading an old one must not bring back a face somebody has
 * since changed.
 *
 * `band` is on this side of the line for the same reason it survives a fresh
 * start — nothing about a new village makes a six-year-old ready for
 * three-digit sums.
 */
export interface Player {
  readonly id: string;
  readonly name: string;
  readonly avatar: AvatarStyle;
  readonly language: Language;
  /** Milliseconds since the epoch, for ordering the who's-playing screen. */
  readonly lastPlayed: number;
  /**
   * How hard their sums are, as somebody picked at setup.
   *
   * Never moves on its own; it is a floor the adaptation works from rather
   * than a score. See src/spells/difficulty.ts.
   */
  readonly band: number;
  /** Which of the village's four cottages is theirs. */
  readonly house: number;
}

/**
 * What a child has done *in one game*. Kept by that game and nothing else.
 *
 * Every ladder they have climbed, every place they have walked to, every
 * spell they have earned and everything in their pockets. Loading another
 * game swaps all of it and leaves the person alone.
 */
export interface Progress {
  /**
   * Whether the postal worker has walked *this child* through the basics.
   *
   * Per child rather than per device, which is the point of the move: a
   * second player on a tablet where the first has finished the tutorial
   * would otherwise be dropped into a farm with no explanation of it. He
   * still walks over and can still be tapped for it again — what is
   * remembered is only whether it opens by itself.
   */
  readonly introSeen: boolean;
  /**
   * Whether this child's game shows the debug panel.
   *
   * Per child rather than per device, and saved like anything else about
   * them. A grown-up turning the seams on to look at something should not be
   * turning them on for the sibling who shares the tablet — and a child who
   * finds the gesture themselves has found it for their own game, which is
   * the only game it can hurt.
   *
   * The seams themselves are not gated on this: `?hour=` works for anybody
   * with an address bar, deliberately, and `devHooks.ts` says why. This is
   * only whether the *panel* is there.
   */
  readonly debug: boolean;
  /**
   * Where inside their band the game currently has them.
   *
   * `band` is what somebody picked when the player was made and is a fact
   * about the child, so it lives with them. This moves: quietly, a step at a
   * time, on how the last few casts went — and it is a fact about one game,
   * so it lives here. See src/spells/difficulty.ts.
   */
  readonly rung: number;
  /**
   * Where this child is on the *portal* spell's ladder.
   *
   * Its own number, because measuring a map and adding on a number line are
   * different skills and a child who is flying at one may be nowhere near
   * the other. Sharing `rung` between them would drop a child who is good at
   * sums straight into squaring numbers, which is not adaptation but an
   * accident of bookkeeping.
   *
   * Same band, though — the band is a statement about the child, not about
   * one spell — and it climbs and falls by exactly the same rules. See
   * src/spells/portal.ts.
   */
  readonly portalRung: number;
  /**
   * Where the multiplication spell's own ladder sits, for the same reason.
   *
   * A third number rather than a third use of `rung`: seeing that four rows
   * of six is twenty-four is not the same skill as adding 347 and 265, and a
   * child fluent at one can be nowhere near the other. Its ladder is shorter
   * than the other two — eight rungs of times table against ten of column
   * arithmetic — so it is clamped against its own end rather than theirs.
   */
  readonly arrayRung: number;
  /** And the sharing spell's, which is its own ladder for its own reason. */
  readonly shareRung: number;
  /**
   * Where the hourglass spell's own ladder sits: how hard a clock face is.
   *
   * A fourth number, and the least like the other three — it is not about
   * how big the sums are but about how much of a *picture* a child can read.
   * A nine-year-old fluent in three-digit addition may never have been shown
   * a clock without numbers on it.
   */
  readonly clockRung: number;
  /**
   * How far this child's world clock has been wound from the real one, in
   * minutes.
   *
   * The hourglass spell moves it, and it stays moved — a world that snapped
   * back to the wall clock the moment the game was put down would make the
   * spell a thing that undoes itself overnight.
   *
   * Minutes rather than hours because the spell can be cast to the quarter,
   * and always forward: winding is the only way it changes, so this only
   * grows. A save written before the glass could move anything has none, and
   * reads as nought — which is a world whose clock is the real one, which is
   * what those children have.
   */
  readonly clockOffset: number;
  /**
   * Where the mirror ladder sits: how hard a shape is to fold in half.
   *
   * A sixth number, and the one least like the others: every other ladder
   * asks a child to work something *out*, and this asks them to *see*
   * something — which is a different skill and moves at its own pace. A
   * child fluent in three-digit addition may never have been shown that a
   * shape can fold onto itself.
   */
  readonly symmetryRung: number;
  /**
   * Which flowers this child has walked into, and may now plant.
   *
   * A set of names, like `learned`, and for the same reason: what is locked
   * is behind *having been somewhere*, never behind being good at
   * arithmetic. A name that is not one of the three is dropped on the way
   * in — it can only have come from a different build.
   */
  readonly found: readonly string[];
  /**
   * Where the bricklaying ladder sits: how hard a wall is to finish.
   *
   * A fifth number, and the one that most deserves to be its own. The other
   * four all ask a child to work something *out*; this asks them what goes
   * in a gap, which for half the bricks means running the sum backwards. A
   * child who adds three-digit numbers without blinking can be nowhere near
   * `? + 6 = 14`, because nobody has ever asked them that — and the day they
   * meet it is not the day to also make the numbers bigger. See
   * src/spells/bricks.ts.
   */
  readonly brickRung: number;
  /**
   * The named places this child has stood in.
   *
   * What the portal spell may take them to. Per child rather than per
   * device, though the world is shared, for the reason the purse is: getting
   * to the Harbour on foot the first time is something a child *did*, and a
   * sibling arriving at a tablet where somebody else has been everywhere
   * would have the whole map handed to them.
   */
  readonly reached: readonly string[];
  /**
   * The spells this child has been taught.
   *
   * Only the ones that have to be learned — the growth spell is theirs by
   * rule and is never written down, so a mangled save cannot take the garden
   * away from them. See src/spells/spellbook.ts.
   */
  readonly learned: readonly string[];
  /**
   * What this child is carrying, and where they left off.
   *
   * Their coins, their basket and the tile they were standing on. Kept with
   * the person rather than with the world, now that the world is shared:
   * a purse everybody could spend from would let one child empty another's,
   * and on a family tablet that is a fight rather than a feature. Crops in
   * the basket are theirs for the same reason — they picked them.
   *
   * Null until they have played once.
   */
  readonly carried: PlayerSnapshot | null;
}

/**
 * The two halves seen as one, which is what everything above the save layer
 * wants.
 *
 * The scene holds a child and asks it for their name and their rung without
 * caring that those live in two different places on disk. Splitting them is
 * a fact about storage; joining them is a fact about there being one child.
 */
export type Profile = Player & Progress;

export function splitProfile(profile: Profile): { player: Player; progress: Progress } {
  const { id, name, avatar, language, lastPlayed, band, house, ...progress } = profile;
  return { player: { id, name, avatar, language, lastPlayed, band, house }, progress };
}

export function joinProfile(player: Player, progress: Progress): Profile {
  return { ...player, ...progress };
}

/**
 * How long a name may be.
 *
 * Short on purpose: it is written under a face on a screen full of faces,
 * and a name that has to be shrunk to fit is one a child cannot pick out at
 * a glance. Long enough for the names children actually have.
 */
export const NAME_MAX = 12;

/**
 * How many players one device holds.
 *
 * Four, and the number is now a fact about the *village* rather than about
 * the screen: four cottages stand on the ring waiting for them, and a fifth
 * child would be a child with nowhere to live. The villagers moved into one
 * longhouse between them to make the room.
 *
 * It was eight, for a reason that still holds and no longer decides: the
 * who's-playing screen shows every child at a size a finger can hit, and
 * past eight it either shrinks the faces or starts scrolling.
 */
export const MAX_PROFILES = 4;

/** Whether there is room for another child on this device. */
export function canAddProfile(existing: readonly Profile[]): boolean {
  return existing.length < MAX_PROFILES;
}

/**
 * Tidy a typed name without arguing with the child who typed it.
 *
 * Collapses runs of whitespace and trims, and cuts to length. It does not
 * reject characters: names have apostrophes and accents and hyphens in them,
 * and a game that refused a child's own name would be teaching something
 * other than arithmetic. Nothing here is ever sent anywhere — see the
 * privacy note in the README — so there is nothing to sanitise it against.
 */
export function tidyName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
}

/**
 * Whether a name can be used.
 *
 * Only emptiness is refused. Two children called Alex is a real situation
 * and not one the game gets to have an opinion about — the avatars are what
 * tell them apart, which is why no two profiles are ever suggested the same
 * face.
 */
export function isUsableName(raw: string): boolean {
  return tidyName(raw).length > 0;
}

/** A stable id that is not the name, so a child can be renamed. */
export function profileId(existing: readonly Profile[], now: number): string {
  const taken = new Set(existing.map((profile) => profile.id));
  for (let suffix = 0; ; suffix++) {
    const id = `p${now.toString(36)}${suffix === 0 ? "" : `-${suffix}`}`;
    if (!taken.has(id)) return id;
  }
}

export interface NewProfile {
  readonly name: string;
  readonly avatar: AvatarStyle;
  readonly language: Language;
  /** Which of the four sample sums was picked. */
  readonly band: number;
}

/**
 * A new child on this device.
 *
 * Refuses past `MAX_PROFILES` rather than quietly making a ninth the screen
 * cannot show — the caller hides the "+" once `canAddProfile` says no, and
 * this is what makes that a rule rather than a habit of one screen.
 */
export function createProfile(
  existing: readonly Profile[],
  wanted: NewProfile,
  now: number,
): Profile {
  if (!canAddProfile(existing)) throw new Error("this device is full of players");
  return {
    id: profileId(existing, now),
    name: tidyName(wanted.name),
    avatar: wanted.avatar,
    language: wanted.language,
    lastPlayed: now,
    introSeen: false,
    debug: false,
    band: wanted.band,
    // The first cottage nobody has taken. Houses are not handed out in the
    // order children are made, because a child removed and replaced would
    // otherwise move into somebody else's home.
    house: freeHouse(existing),
    rung: bandAt(wanted.band).from,
    portalRung: bandAt(wanted.band).from,
    arrayRung: arrayFloor(bandAt(wanted.band)),
    shareRung: shareFloor(bandAt(wanted.band)),
    clockRung: clockFloor(bandAt(wanted.band)),
    // A new world's clock is the real one until somebody moves it.
    clockOffset: 0,
    symmetryRung: 0,
    found: [],
    brickRung: brickFloor(bandAt(wanted.band)),
    // The village, because that is where they live. A portal spell whose
    // first cast has nowhere to go is a spell that looks broken.
    reached: [HOME_PLACE],
    // Nothing but the garden yet. The portal spell is up the tower.
    learned: [],
    carried: null,
  };
}

/**
 * The same child, at the start of a new world.
 *
 * Everything they *are* survives — their name, their face, the language they
 * read and the band somebody picked for them. Everything they *earned*
 * starts again: the spells, the ladders, the places they have walked to and
 * whatever was in their pockets.
 *
 * That split is the whole of it, and it is a decision rather than a
 * consequence. Keeping the spells was tried first, on the argument that
 * thirty problems for the array spell should not be taken back by an adult
 * tapping a button on the options screen. The answer is that a new world
 * with the spells already in it is not a new world: the great tree has
 * nothing left to ask, the geometer is a man in a tower, and the first
 * afternoon of the game — which is the best afternoon it has — cannot
 * happen twice on one device.
 *
 * The band stays because it is a fact about the child rather than about the
 * world. Nothing in a fresh village makes a six-year-old ready for
 * three-digit sums.
 */
export function freshStart(profile: Profile): Profile {
  return { ...profile, ...freshProgress(profile.band) };
}

/**
 * A child's progress at the start of a game they have not played.
 *
 * What a new game hands every player, and what `freshStart` hands one who is
 * beginning again. Written once because those two are the same thing said
 * from different ends.
 */
export function freshProgress(bandAt_: number): Progress {
  const band = bandAt(bandAt_);
  return {
    introSeen: false,
    debug: false,
    rung: band.from,
    portalRung: band.from,
    arrayRung: arrayFloor(band),
    shareRung: shareFloor(band),
    clockRung: clockFloor(band),
    clockOffset: 0,
    symmetryRung: 0,
    found: [],
    brickRung: brickFloor(band),
    reached: [HOME_PLACE],
    learned: [],
    carried: null,
  };
}

/**
 * A usable rung on the array ladder, which is shorter than the other two.
 *
 * Both of these are `rungInBand` told which ladder it is reading, and that
 * is the whole of them. They used to be two hand-written clamps against the
 * ends of their own ladders, which was fine while a band was only a starting
 * point; now that a band is a fence, a rung read in has to land inside the
 * *band*, and scaling a band onto a shorter ladder is a thing exactly one
 * piece of code should know how to do.
 */
function arrayRungInBand(band: Band, rung: number): number {
  return rungInBand(band, rung, HARDEST_ARRAY_RUNG);
}

function shareRungInBand(band: Band, rung: number): number {
  return rungInBand(band, rung, HARDEST_SHARE_RUNG);
}

/**
 * A wound clock, read back from a save.
 *
 * Whole minutes and never negative: the glass only ever winds forward, so a
 * negative here is a file somebody edited or a bug that has since been
 * fixed, and either way a world whose clock runs behind the real one is not
 * a world this game knows how to be in. Anything unreadable reads as nought,
 * which is the clock a child who has never cast the spell has.
 */
function readOffset(raw: unknown): number {
  const minutes = Math.trunc(Number(raw ?? 0));
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
}

/**
 * And the mirror ladder, which is the one ladder no band opens partway up.
 *
 * Every other spell scales its floor to the child's band, because a nine
 * year old handed single-digit sums has been insulted. Folding is not like
 * that: it is a way of *looking*, and the oldest child in the game has very
 * likely never been asked to do it. So everybody starts at the square, and
 * the ladder is short enough that nobody is kept there long.
 */
function readSymmetryRung(raw: unknown): number {
  const rung = Math.trunc(Number(raw ?? 0));
  return Number.isFinite(rung) ? Math.max(0, Math.min(HARDEST_SYMMETRY_RUNG, rung)) : 0;
}

/** The same again, against the clock ladder. */
function clockRungInBand(band: Band, rung: number): number {
  return rungInBand(band, rung, HARDEST_CLOCK_RUNG);
}

/** And against the bricklaying ladder, which is shorter again. */
function brickRungInBand(band: Band, rung: number): number {
  return rungInBand(band, rung, HARDEST_BRICK_RUNG);
}

/**
 * Where a child who has never cast one of the shorter spells begins.
 *
 * The floor of their band — but the floor *on that spell's ladder*, which is
 * not the number in `band.from`. Bands are counted in addition rungs, and
 * handing `band.from` to a six-rung ladder puts a child in the hardest band
 * at the top of it, with the times table waiting on their first ever cast
 * and nowhere left to climb. Scaled, the same child opens on the fourth rung
 * of six, which is what "the bottom of their band" was always supposed to
 * mean.
 */
function arrayFloor(band: Band): number {
  return bandOn(band, HARDEST_ARRAY_RUNG).from;
}

function shareFloor(band: Band): number {
  return bandOn(band, HARDEST_SHARE_RUNG).from;
}

function clockFloor(band: Band): number {
  return bandOn(band, HARDEST_CLOCK_RUNG).from;
}

function brickFloor(band: Band): number {
  return bandOn(band, HARDEST_BRICK_RUNG).from;
}

/** Newest first: the child who played last is the one most likely playing now. */
export function byRecency(profiles: readonly Profile[]): readonly Profile[] {
  return [...profiles].sort((a, b) => b.lastPlayed - a.lastPlayed);
}

export function withoutProfile(profiles: readonly Profile[], id: string): readonly Profile[] {
  return profiles.filter((profile) => profile.id !== id);
}

export function replaceProfile(profiles: readonly Profile[], updated: Profile): readonly Profile[] {
  const known = profiles.some((profile) => profile.id === updated.id);
  return known
    ? profiles.map((profile) => (profile.id === updated.id ? updated : profile))
    : [...profiles, updated];
}

export function findProfile(profiles: readonly Profile[], id: string | null): Profile | null {
  return profiles.find((profile) => profile.id === id) ?? null;
}

/**
 * A profile read back from storage, or nothing.
 *
 * Field by field, same as the device settings: a profile that lost its
 * language should still be a child with a farm, and one bad entry in the
 * list must not take the other children's saves down with it.
 */
/** The lowest-numbered cottage nobody on this device lives in. */
function freeHouse(existing: readonly Profile[]): number {
  const taken = new Set(existing.map((profile) => profile.house));
  for (let n = 0; n < MAX_PROFILES; n++) if (!taken.has(n)) return n;
  return 0;
}

export function readProfile(value: unknown): Profile | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || record.id.length === 0) return null;
  const name = typeof record.name === "string" ? tidyName(record.name) : "";
  if (!name) return null;
  const band = Number.isInteger(record.band) ? (record.band as number) : DEFAULT_BAND;
  return {
    id: record.id,
    name,
    avatar: readAvatar(record.avatar),
    language: languageOf(typeof record.language === "string" ? record.language : null),
    lastPlayed: Number.isFinite(Number(record.lastPlayed)) ? Number(record.lastPlayed) : 0,
    house: Number.isInteger(record.house)
      ? Math.max(0, Math.min(MAX_PROFILES - 1, record.house as number))
      : 0,
    introSeen: record.introSeen === true,
    // Absent in every save written before the panel existed, which is the
    // right answer for all of them: off.
    debug: record.debug === true,
    // A child saved before there was a choice was playing the hardest sums
    // the game had, because that was the only setting there was. Anything
    // else here would quietly restyle their game on the way in.
    band,
    rung: rungInBand(bandAt(band), Number(record.rung ?? bandAt(band).to)),
    // A child saved before the portal existed starts it at the bottom of
    // their own band, exactly as a new child does — they have never cast it.
    portalRung: rungInBand(bandAt(band), Number(record.portalRung ?? bandAt(band).from)),
    // A child saved before the great tree existed starts it at the bottom of
    // their own band, exactly as a new child does — they have never cast it.
    arrayRung: arrayRungInBand(bandAt(band), Number(record.arrayRung ?? arrayFloor(bandAt(band)))),
    // A child saved before the fisherman existed starts it at the bottom of
    // their own band, exactly as a new child does — they have never cast it.
    shareRung: shareRungInBand(bandAt(band), Number(record.shareRung ?? shareFloor(bandAt(band)))),
    // A child saved before the astronomer existed starts it at the bottom of
    // their own band, exactly as a new child does — they have never cast it.
    clockRung: clockRungInBand(bandAt(band), Number(record.clockRung ?? clockFloor(bandAt(band)))),
    // A child saved before the glass could wind the clock has not wound it.
    clockOffset: readOffset(record.clockOffset),
    // A child saved before the astronomer taught folding has never folded.
    symmetryRung: readSymmetryRung(record.symmetryRung),
    found: readFound(record.found),
    // A child saved before anybody could build a room has never laid a
    // brick: the bottom of their own band, exactly as a new child gets.
    brickRung: brickRungInBand(bandAt(band), Number(record.brickRung ?? brickFloor(bandAt(band)))),
    reached: readReached(record.reached),
    // A child saved before the tower taught anything has not been taught it:
    // they walk up and meet him like everybody else.
    learned: readLearned(record.learned),
    carried: readCarried(record.carried),
  };
}

/**
 * The places read back, with home always among them.
 *
 * Unknown names are dropped rather than kept: the anchors are a fixed set,
 * and a saved name that is not one of them can only be a save from a
 * different build. Home is added whatever the save said, so a corrupted
 * entry cannot leave a child with a spell that has nowhere to go.
 */
function readReached(value: unknown): readonly string[] {
  const names = Array.isArray(value)
    ? value.filter((name): name is string => typeof name === "string")
    : [];
  const known = names.filter((name): name is PlaceName =>
    (PLACE_NAMES as readonly string[]).includes(name),
  );
  return [...new Set<string>([HOME_PLACE, ...known])];
}

/**
 * A child's belongings, read back.
 *
 * Loose about the contents on purpose: everything in here is checked again
 * on the way into the session, item by item, so anything that survives this
 * and should not is dropped there rather than crashing a load. What this
 * catches is the shape being wrong entirely.
 */
function readCarried(value: unknown): PlayerSnapshot | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  return {
    col: Number(record.col) || 0,
    row: Number(record.row) || 0,
    facing: record.facing as PlayerSnapshot["facing"],
    coins: Number(record.coins) || 0,
    items: Array.isArray(record.items) ? (record.items as PlayerSnapshot["items"]) : [],
  };
}

function readAvatar(value: unknown): AvatarStyle {
  if (typeof value !== "object" || value === null) return DEFAULT_AVATAR;
  const record = value as Record<string, unknown>;
  const index = (raw: unknown, fallback: number) =>
    Number.isInteger(raw) ? (raw as number) : fallback;
  return {
    body: typeof record.body === "string" ? record.body : DEFAULT_AVATAR.body,
    skin: index(record.skin, DEFAULT_AVATAR.skin),
    hair: index(record.hair, DEFAULT_AVATAR.hair),
    shirt: index(record.shirt, DEFAULT_AVATAR.shirt),
  };
}
