// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * How hard the sums are, for a child of whatever age is holding the tablet.
 *
 * The game was built at one difficulty and it is an eight-year-old's: always
 * three digits plus three digits, always with carries, always 2,50 for a
 * crop. A six-year-old cannot play it at all. Everything here exists to move
 * that dial without moving anything else.
 *
 * **What difficulty may change, and what it must not.** It changes the
 * *numbers* — how many places a sum has, whether its jumps cross a ten, how
 * much of it comes already worked out, and how round the money is. It does
 * not change what the game gives you. Nothing is locked behind it, no crop
 * is unavailable, no place is closed. That is the design's "learning over
 * gating", and it is why this is a property of the arithmetic rather than a
 * progression.
 *
 * **And it never changes the payout.** A crop is one crop whoever grew it,
 * and still takes two casts. The money settings below change what a crop is
 * *quoted at* — a whole sun, or half of one, or two and a half — but every
 * price in the store is quoted in crops, so a fence costs two harvests at
 * every setting. The moment easier sums earned less, the game would be
 * telling a struggling child they are worth less, and it would start
 * pressuring children upward for money rather than because they are ready.
 *
 * **Rungs and bands.** A rung is one exact setting. A band is a window of
 * three rungs, and it is what somebody picks when a player is made — from
 * four sample sums rather than from ages or from the words "easy" and
 * "hard", because those sit on a screen a child shares with their siblings.
 *
 * **The band is where a child starts, not where they are kept.** It used to
 * be a fence the game could not cross, and playtesting said the adaptation
 * looked like it was not working: a child reaches the top of their band in a
 * dozen casts and then nothing ever changes again, which from the outside is
 * indistinguishable from a fixed difficulty. So the ladder is open at both
 * ends now.
 *
 * The fence was protecting something real, though, and deleting it without
 * replacing it would be a mistake. It stopped a wrong answer at setup
 * pitching the game at somebody else, and it stopped a run of lucky guesses
 * walking a six-year-old up to three-digit sums with only an adult likely to
 * notice. Three things replace it:
 *
 * - **Leaving a band is slower than moving inside one.** Climbing within the
 *   band takes a run of clean casts; climbing *out* of it takes a longer
 *   one. A good afternoon moves a child along; it does not move them up a
 *   year.
 * - **Coming down works across a boundary exactly as it works inside one**,
 *   and it is quicker than going up in both cases. A child carried up by a
 *   lucky run falls back on the first two casts that show it.
 * - **The options panel still names the band**, so an adult can always put a
 *   child back where they belong in one tap. The band a *person* chose is
 *   still recorded, and it still decides what the money looks like.
 */

export interface Rung {
  /** How many jumps the number line is broken into: ones, tens, hundreds. */
  readonly places: number;
  /** Whether a jump may cross a ten — which is what a carry looks like here. */
  readonly crossing: boolean;
  /**
   * How many jumps arrive already answered.
   *
   * The design has teachers "train a spell with partially solved problems";
   * this is that, as a setting rather than as a lesson. Always less than
   * `places`, or there would be nothing to do.
   */
  readonly given: number;
}

/**
 * Every setting, easiest first.
 *
 * The order is the curriculum: sums within ten, then bridging ten, then two
 * places, then two places that carry, then three. Scaffolding comes in one
 * rung *before* each new size, so a child meets a longer number line with
 * its first jump already made rather than all at once.
 */
export const RUNGS: readonly Rung[] = [
  { places: 1, crossing: false, given: 0 }, //  3 + 4
  { places: 1, crossing: true, given: 0 }, //   7 + 5
  { places: 2, crossing: false, given: 1 }, // 34 + 25, ones done
  { places: 2, crossing: false, given: 0 }, // 34 + 25
  { places: 2, crossing: true, given: 1 }, //  27 + 45, ones done
  { places: 2, crossing: true, given: 0 }, //  27 + 45
  { places: 3, crossing: false, given: 1 }, // 142 + 236, ones done
  { places: 3, crossing: false, given: 0 }, // 142 + 236
  { places: 3, crossing: true, given: 1 }, //  347 + 265, ones done
  { places: 3, crossing: true, given: 0 }, //  347 + 265 — the game as it was
];

/** The hardest rung: what every player had before there was a choice. */
export const HARDEST_RUNG = RUNGS.length - 1;

export interface Band {
  /** The rung a child starts on, and the easiest the game may drop them to. */
  readonly from: number;
  /** The hardest it may take them, without somebody choosing a wider band. */
  readonly to: number;
  /**
   * What one crop fetches, in rays.
   *
   * A property of the band rather than of the rung, so it does not move
   * under a child mid-session: a shop whose prices changed while they were
   * standing in it would be a shop they had to re-learn. The ladder is
   * 1,00 → 0,50 → 1,50 → 2,50: a whole coin, then a half, then a sum that
   * needs two coins, then the one the game shipped with.
   */
  readonly cropPrice: number;
}

/**
 * The four a parent or a child picks between.
 *
 * Overlapping on purpose. A child at the top of one band and one at the
 * bottom of the next are doing the same sums, which is what makes the choice
 * forgiving: picking the neighbouring band is off by a nudge, not by a year.
 */
export const BANDS: readonly Band[] = [
  { from: 0, to: 2, cropPrice: 100 },
  { from: 2, to: 5, cropPrice: 50 },
  { from: 5, to: 7, cropPrice: 150 },
  { from: 7, to: HARDEST_RUNG, cropPrice: 250 },
];

/**
 * The band a child who was playing before any of this existed is on.
 *
 * The hardest, because that is what the game was: it had one difficulty and
 * it was this one. Anything else here would quietly restyle the sums of
 * every child already playing.
 */
export const DEFAULT_BAND = BANDS.length - 1;

/**
 * Where the tiles start for somebody making a *new* player.
 *
 * Not the hardest. A parent who does not notice this row at all should land
 * their child somewhere survivable, and the two failures are not equal: a
 * child given sums that are too easy climbs out within a few casts, while a
 * six-year-old handed `504 + 274` cannot play at all and has no way to say
 * so. So it opens one band up from the gentlest — close enough to the bottom
 * that nobody is stranded, and one tap from either neighbour.
 */
export const SUGGESTED_BAND = 1;

export function bandAt(index: number): Band {
  return BANDS[Math.max(0, Math.min(BANDS.length - 1, Math.trunc(index)))] as Band;
}

export function rungAt(index: number): Rung {
  return RUNGS[Math.max(0, Math.min(RUNGS.length - 1, Math.trunc(index)))] as Rung;
}

/**
 * A usable rung for a saved number that may be neither a number nor sensible.
 *
 * Clamped to the *ladder*, not to the band — the game may have carried this
 * child out of the band they started in, and reading their save must not
 * quietly drag them back. The band still decides where somebody *starts*
 * (`band.from`) and what the money looks like; it no longer decides where
 * they may be.
 */
export function rungInBand(band: Band, rung: number): number {
  const wanted = Number.isFinite(rung) ? Math.trunc(rung) : band.from;
  return Math.max(0, Math.min(HARDEST_RUNG, wanted));
}

/**
 * How many casts in a row it takes to move, up and down.
 *
 * Both are *runs*, and deliberately different lengths. Going up takes four,
 * because a child who guesses right twice has not learned anything and being
 * moved up for it is a punishment dressed as praise. Coming down takes two,
 * because a child who is stuck should not have to prove it as many times
 * over as a child who is flying has to prove that.
 *
 * A run rather than a count out of the last several. Two stumbles in a row
 * says the sums are too hard right now; two spread across six says a child
 * got one wrong, then three right, then got one wrong — which is what
 * learning looks like, and moving them down for it would be reading normal
 * variation as a verdict.
 */
export const CLEAN_TO_CLIMB = 4;
export const STUMBLES_TO_EASE = 2;

/**
 * How long a run it takes to climb out of the band somebody chose.
 *
 * Longer than climbing inside it, which is what is left of the fence. A
 * child who has topped out has to keep doing it for a good while before the
 * game decides the choice made at setup was too low — a run of lucky guesses
 * should not be able to carry a six-year-old into three-digit sums before an
 * adult has a chance to notice.
 *
 * Falling *out* of the bottom of a band needs no extra patience: a child who
 * is struggling has already told you, and making them prove it for longer
 * because their band happens to end here would be a rule with nothing behind
 * it.
 */
export const CLEAN_TO_LEAVE_BAND = 8;

/**
 * How many recent casts are looked at.
 *
 * Derived rather than chosen, because the two are not independent: a window
 * shorter than the longest run the game has to recognise means that run can
 * never be seen, and the rule that depends on it silently never fires. That
 * happened — the window was six and leaving a band needed eight, so no child
 * could ever have left one.
 *
 * Long enough for the longest run, and no longer: a window that remembered
 * more would let a mistake from the start of a session hold a child back at
 * the end of it.
 */
export const RECENT_CASTS = Math.max(CLEAN_TO_LEAVE_BAND, CLEAN_TO_CLIMB, STUMBLES_TO_EASE);

/** The last few casts, newest last, `true` for every box right first time. */
export type Recent = readonly boolean[];

/**
 * Note how a cast went — but only a cast that finished.
 *
 * An abandoned one is not a stumble. Opening the spellbook and thinking
 * better of it is a thing children do, and counting the dismissal as a wrong
 * answer would mean two changes of mind in a row quietly made a child's sums
 * easier — with nothing they answered having been wrong, and nothing on
 * screen to say why. There is no fail state here; closing a panel is not one
 * either.
 */
export function recordCast(recent: Recent, result: { solved: boolean; clean: boolean }): Recent {
  if (!result.solved) return recent;
  return [...recent, result.clean].slice(-RECENT_CASTS);
}

/**
 * Where the difficulty should sit after a cast, and whether the window
 * should be cleared.
 *
 * The window is emptied whenever the rung moves. Without that, the four
 * clean casts that earned a climb are still sitting there on the next cast
 * and earn another one immediately — a child would be walked from the bottom
 * of their band to the top in five casts, which is not adaptation, it is a
 * ramp.
 */
/**
 * A sum that stands for a band, for the tiles somebody picks from.
 *
 * Generated by the spell rather than typed out, for the same reason the
 * teacher's worked example is: a sample written by hand is one that can
 * quietly stop matching what the band actually sets, and this one is the
 * whole basis on which somebody chooses.
 *
 * Not simply the first problem a seed gives, though. That produced `1 + 4`
 * for the gentlest band — a true example and a useless one, because nobody
 * picking between four tiles can tell whether that means sums to nine or
 * sums to five. So several are drawn and the most typical is kept: the one
 * whose starting number sits nearest the middle of the range that band
 * works in.
 */
export function sampleProblem(band: Band, make: (seed: number, rung: Rung) => Sample): Sample {
  const rung = rungAt(band.from);
  const low = rung.places === 1 ? 1 : 10 ** (rung.places - 1);
  const middle = (low + 10 ** rung.places - 1) / 2;
  let best = make(1, rung);
  for (let seed = 2; seed <= SAMPLE_DRAWS; seed++) {
    const drawn = make(seed, rung);
    if (Math.abs(drawn.start - middle) < Math.abs(best.start - middle)) best = drawn;
  }
  return best;
}

export interface Sample {
  readonly start: number;
  readonly addend: number;
}

/** How many are drawn before the most typical is kept. */
const SAMPLE_DRAWS = 24;

/**
 * `hardest` is a parameter because there is more than one ladder now. The
 * portal spell has ten rungs of its own — counting stones up to squaring
 * numbers — and it climbs and falls by exactly these rules, which are about
 * how a child is doing rather than about what they are being asked. A second
 * copy of this for the second spell would be a second thing to keep true.
 */
export function nextRung(
  band: Band,
  rung: number,
  recent: Recent,
  hardest: number = HARDEST_RUNG,
): number {
  const here = Math.max(0, Math.min(hardest, Math.trunc(rung)));
  // Leaving the band the child was put in takes a longer run than moving
  // within it. That difference is the whole of what replaces the fence.
  const needed = here >= band.to ? CLEAN_TO_LEAVE_BAND : CLEAN_TO_CLIMB;
  const clean = recent.slice(-needed);
  if (clean.length >= needed && clean.every(Boolean)) {
    return Math.min(hardest, here + 1);
  }
  const stumbles = recent.slice(-STUMBLES_TO_EASE);
  if (stumbles.length >= STUMBLES_TO_EASE && stumbles.every((was) => !was)) {
    return Math.max(0, here - 1);
  }
  return here;
}
