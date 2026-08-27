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
 * **The band is a fence, and the adaptation works inside it.** The game
 * moves a child up and down within the band somebody chose for them, and it
 * never moves them out of it. It was open at both ends for a while, on the
 * theory that a child who tops out and then sees nothing change is looking
 * at something indistinguishable from a fixed difficulty. What that theory
 * missed is who the adaptation is answerable to. A run of lucky guesses
 * could carry a six-year-old into three-digit sums, and the first anybody
 * heard of it was a child in tears over sums nobody chose for them.
 *
 * So the rule is the simple one. Inside the band the game is quiet and
 * quick — four clean casts up, two stumbles down, nothing announced. At the
 * edges of the band it stops. Moving *between* bands is a person's decision,
 * made in the options panel by somebody who has watched this child play, and
 * the band a person chose is the one they find there when they look.
 *
 * The cost is real and worth stating: a child at the top of their band sees
 * the sums stop growing, and only an adult can start them growing again.
 * That is the trade, taken deliberately. How hard a child's sums should be
 * is a judgement about that child, and a rule counting the last four casts
 * is not entitled to make it on their behalf.
 *
 * **A band is indexed against the addition ladder**, which is the longest
 * one. The other spells have their own, shorter, ladders, and a band is
 * scaled onto whichever ladder is asking — see `bandOn`.
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
  // Past three places the ladder changes shape, and deliberately.
  //
  // Below here every new size arrives in four rungs: without carries and
  // with, each of those scaffolded and then not. That is right while the
  // carry is still being learned — a child meeting two places for the first
  // time needs somewhere to add 34 and 25 before they are asked for 27 and
  // 45.
  //
  // It is wrong up here. A child who can do `347 + 265` has the method, and
  // a four-place sum that does not carry is not a step up from a three-place
  // one that does — it is an easier sum drawn on a longer line, and a rung
  // that goes backwards is a rung that teaches a child the game is random.
  // So each new size is two rungs: the same carrying sum with its ones done
  // for you, and then without.
  { places: 4, crossing: true, given: 1 }, //  3471 + 2653, ones done
  { places: 4, crossing: true, given: 0 }, //  3471 + 2653
  { places: 5, crossing: true, given: 1 }, //  34715 + 26538, ones done
  { places: 5, crossing: true, given: 0 }, //  34715 + 26538
  { places: 6, crossing: true, given: 1 }, //  347156 + 265382, ones done
  { places: 6, crossing: true, given: 0 }, //  347156 + 265382
];

/** The hardest rung there is. */
export const HARDEST_RUNG = RUNGS.length - 1;

/**
 * The hardest rung the other spells' ladders have anything to answer to.
 *
 * Three places, carrying, with nothing done for you — which is where the
 * addition ladder used to end, and it is not a coincidence that it is also
 * where the *other* ladders end. There is no six-digit way to read a clock
 * and no six-digit times table; the clock's hardest reading is the quarter
 * hour whatever a child's sums look like. So the ladder above this point is
 * addition getting longer, and nothing else in the game has a matching
 * step. See `bandOn`, which is where that fact is spent.
 */
export const SHARED_TOP_RUNG = RUNGS.reduce((last, rung, at) => (rung.places <= 3 ? at : last), 0);

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
  /**
   * Whether the portal will carry her anywhere, walked to or not.
   *
   * The gentlest band only, and it is a playtest's answer to a real dead
   * end. Every other place in this world is reached by walking to it once,
   * which is a long walk and the right price for a child who can take it.
   * For the youngest — the band that opens on `3 + 4` — it is a fence in
   * front of the one spell that is pure fun, and the thing behind the fence
   * is not the arithmetic, it is an afternoon of holding an arrow key.
   *
   * A property of the band rather than a switch of its own, for the reason
   * `cropPrice` is: this is what "the gentlest setting" *means*, and a
   * second place to say so is a second place for it to disagree.
   */
  readonly opensEveryPlace: boolean;
}

/**
 * The three a parent or a child picks between.
 *
 * Overlapping on purpose. A child at the top of one band and one at the
 * bottom of the next are doing the same sums, which is what makes the choice
 * forgiving: picking the neighbouring band is off by a nudge, not by a year.
 *
 * **Three rather than four**, from a playtest. Four rows of sums is a row
 * too many to compare at a glance, and the two in the middle were the two
 * hardest to tell apart — both two-place, differing only in whether the ones
 * were done for you. They are one band now, and deliberately the widest: it
 * is where most children live, and the band is a starting point rather than
 * a fence, so width costs nothing.
 *
 * The outer two are unchanged, which matters more than it looks: the gentlest
 * band still opens on `3 + 4`, and the band a child is put in by default
 * still starts them on exactly the sum it used to.
 *
 * **The prices climb now**, and they climb off the round ducat. They ran
 * 1,00 → 1,50 → 2,50, and the gentlest of those was the problem: everything
 * in the shop is priced in *crops*, so quoting a crop at a whole ducat made
 * every price in the game a whole number of ducats. The fifty-piece could
 * not come up at all, and four of the eight prices were payable with a
 * single coin — which is the one thing a paying screen must not be, because
 * putting one coin down teaches nothing.
 *
 * So 1,50 → 2,50 → 3,50. Counted rather than chosen: at 1,50 not one price
 * in the shop is a single coin and half of them need the fifty, at 3,50 a
 * purchase runs to three and a half coins on average. Nothing gets easier —
 * the middle band is what the hardest one used to be.
 *
 * The gentlest band is no longer the round one, and that is the deliberate
 * part. A crop at a whole ducat made money a non-puzzle for a six-year-old,
 * which was the argument for it; it also made money a non-*thing*, and a
 * shop where every price is one coin is a shop with no counting in it.
 * One-fifty is two coins, which is where counting starts.
 */
export const BANDS: readonly Band[] = [
  { from: 0, to: 2, cropPrice: 150, opensEveryPlace: true },
  { from: 2, to: 6, cropPrice: 250, opensEveryPlace: false },
  { from: 6, to: SHARED_TOP_RUNG, cropPrice: 350, opensEveryPlace: false },
  // Up to six digits, which is as far as this goes.
  //
  // The one band that is not about a new *kind* of sum. Everything below it
  // is a step in method — bridging ten, then two places, then carrying —
  // and this is the same carrying method run out to numbers a child can
  // recognise from a price tag or an odometer rather than only from a
  // worksheet. What it is for is the child who has finished the game's
  // arithmetic and wants the sums to keep getting bigger; the alternative is
  // topping out at `347 + 265` and watching nothing change, which is the
  // thing this whole module was written to avoid.
  //
  // Wide, and overlapping the band below it by a rung, for the reason every
  // band overlaps: picking the neighbouring one is off by a nudge.
  { from: SHARED_TOP_RUNG, to: HARDEST_RUNG, cropPrice: 450, opensEveryPlace: false },
];

/**
 * The band a child who was playing before any of this existed is on.
 *
 * The band that ends on `347 + 265`, because that is what the game was: it
 * had one difficulty and it was this one.
 *
 * **Not the last band, and it must never go back to being written that
 * way.** It was `BANDS.length - 1`, which was the same number for as long as
 * the hardest band was the one the game shipped at. The moment a harder band
 * was added above it that expression silently moved every child already
 * playing to six-digit sums on their next load — a save nobody touched,
 * restyled by a constant that looked like it meant "the hardest" and
 * actually meant "the last one in the list".
 */
export const DEFAULT_BAND = BANDS.findIndex((band) => band.to === SHARED_TOP_RUNG);

/**
 * Where the tiles start for somebody making a *new* player.
 *
 * Not the hardest. A parent who does not notice this row at all should land
 * their child somewhere survivable, and the two failures are not equal: a
 * child given sums that are too easy climbs out within a few casts, while a
 * six-year-old handed `504 + 274` cannot play at all and has no way to say
 * so. So it opens one band up from the gentlest — close enough to the bottom
 * that nobody is stranded, and one tap from its easier neighbour. It has
 * been the second band in the list through every change to how many there
 * are, and it opens on the same sum it always did.
 */
export const SUGGESTED_BAND = 1;

export function bandAt(index: number): Band {
  return BANDS[Math.max(0, Math.min(BANDS.length - 1, Math.trunc(index)))] as Band;
}

export function rungAt(index: number): Rung {
  return RUNGS[Math.max(0, Math.min(RUNGS.length - 1, Math.trunc(index)))] as Rung;
}

/**
 * A band, scaled onto one spell's own ladder.
 *
 * Bands are indexed against the addition ladder, which has ten rungs. The
 * clock and the great tree have six each. Truncating a band against a
 * shorter ladder — the obvious thing, and what this code used to do on the
 * way in from a save — puts the hardest band at `[5, 5]` on both of them: a
 * window one rung wide, inside which nothing can move in either direction. A
 * child drowning in the bare times table would have no way down, which is
 * not "kept inside the range an adult chose", it is the adaptation switched
 * off and dressed up as a fence.
 *
 * So it scales instead, and every band keeps its share of every ladder: the
 * gentlest band on the clock is the two easiest readings rather than only
 * the one. On a ladder as long as the addition one — the portal's — it is
 * the identity, and the fence sits on exactly the rungs a person picked.
 *
 * **Scaled against `SHARED_TOP_RUNG`, not against `HARDEST_RUNG`.** Those
 * were the same number until the six-digit band was added, and the
 * difference between them is a whole class of bug. The other ladders did not
 * get longer when the addition ladder did — there is no six-digit way to
 * read a clock — so measuring against the new top would have squeezed every
 * existing band down the short ladders to make room for a band those ladders
 * have nothing to put in it. A child on the default band would have come
 * back to find the hardest clock readings had quietly gone out of reach,
 * which is precisely what the header of this file promises never happens.
 *
 * A band that runs *past* the shared top stands in for the hardest one that
 * does not. Scaled honestly it would come out as a single rung at the very
 * top — the degenerate window this function exists to prevent — and the
 * truthful thing to say about a six-digit child's clock is not "one reading
 * only" but "the same readings as the band below", because that is where
 * the clock ladder ends for everybody.
 */
export function bandOn(band: Band, hardest: number = HARDEST_RUNG): Band {
  if (hardest === HARDEST_RUNG) return band;
  const stands = band.from >= SHARED_TOP_RUNG ? (BANDS[DEFAULT_BAND] as Band) : band;
  const onto = (rung: number) => Math.round((rung * hardest) / SHARED_TOP_RUNG);
  return { ...band, from: onto(stands.from), to: onto(stands.to) };
}

/**
 * A usable rung for a saved number that may be neither a number nor sensible.
 *
 * Clamped to the *band*, which is now the whole of the rule: a child is
 * where an adult put them, give or take whatever the adaptation has done
 * inside that window.
 *
 * A save written while the ladder was open at both ends can name a rung
 * outside the band, and it reads back as the nearest rung inside it. That is
 * a real change to a real save, and it is the intended one — that child is
 * being put back where somebody chose to put them, on the way in rather than
 * mid-session, so the sums a child is looking at do not change under them.
 *
 * Falls back to the band's floor for a number that is not one. A mangled
 * save should read as "we do not know where this child was", not as "start
 * them on doubles".
 */
export function rungInBand(band: Band, rung: number, hardest: number = HARDEST_RUNG): number {
  const fence = bandOn(band, hardest);
  const wanted = Number.isFinite(rung) ? Math.trunc(rung) : fence.from;
  return Math.max(fence.from, Math.min(fence.to, wanted));
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
 * How many recent casts are looked at.
 *
 * Derived rather than chosen, because the two are not independent: a window
 * shorter than the longest run the game has to recognise means that run can
 * never be seen, and the rule that depends on it silently never fires. That
 * happened, back when there was a third and longer run for climbing out of a
 * band: it needed eight and the window held six, so no child could ever have
 * climbed out of one.
 *
 * Long enough for the longest run, and no longer: a window that remembered
 * more would let a mistake from the start of a session hold a child back at
 * the end of it.
 */
export const RECENT_CASTS = Math.max(CLEAN_TO_CLIMB, STUMBLES_TO_EASE);

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
 * A sum that stands for a band, for the tiles somebody picks from.
 *
 * Generated by the spell rather than typed out, for the same reason the
 * teacher's worked example is: a sample written by hand is one that can
 * quietly stop matching what the band actually sets, and this one is the
 * whole basis on which somebody chooses.
 *
 * Not simply the first problem a seed gives, though. That produced `1 + 4`
 * for the gentlest band — a true example and a useless one, because nobody
 * picking between the tiles can tell whether that means sums to nine or
 * sums to five. So several are drawn and the most typical is kept: the one
 * whose starting number sits nearest the middle of the range that band
 * works in.
 *
 * **Drawn from where the band starts, unless that is where the band below
 * starts.** A tile says what a child will meet, and what they meet first is
 * the floor. The six-digit band broke that: it opens on the same rung the
 * band below tops out at, so both tiles read as three-digit sums and the
 * choice between them could not be made by looking — which is the one thing
 * these tiles have to be good for. A band whose floor is no wider than its
 * neighbour's shows what it *reaches* instead.
 */
export function sampleProblem(
  band: Band,
  make: (seed: number, rung: Rung) => Sample,
  below?: Band,
): Sample {
  const floor = rungAt(band.from);
  const rung = below && rungAt(below.from).places === floor.places ? rungAt(band.to) : floor;
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
 * Where the difficulty should sit after a cast.
 *
 * Never outside the band. A run of clean casts at the top of the band leaves
 * the rung exactly where it is, and so does a run of stumbles at the bottom
 * — the caller sees no move, clears nothing, and writes nothing. Whoever
 * chose the band is the only one who can widen it.
 *
 * **The caller empties its window whenever the rung moves.** Without that,
 * the four clean casts that earned a climb are still sitting there on the
 * next cast and earn another one immediately, and a child is walked from the
 * bottom of their band to the top in five casts — which is not adaptation,
 * it is a ramp. Nothing is cleared when the rung holds at an edge, which is
 * right: a child pressed against the top of their band should not have to
 * start their run again every time they finish one.
 *
 * `hardest` is a parameter because there is more than one ladder. The portal
 * spell has ten rungs of its own — counting stones up to squaring numbers —
 * and the clock and the great tree have six each, and all of them climb and
 * fall by exactly these rules, which are about how a child is doing rather
 * than about what they are being asked. A second copy of this for the second
 * spell would be a second thing to keep true. The band is scaled onto
 * whichever ladder is asking, so the fence means the same thing on all four.
 */
export function nextRung(
  band: Band,
  rung: number,
  recent: Recent,
  hardest: number = HARDEST_RUNG,
): number {
  const fence = bandOn(band, hardest);
  const here = rungInBand(band, rung, hardest);
  const clean = recent.slice(-CLEAN_TO_CLIMB);
  if (clean.length >= CLEAN_TO_CLIMB && clean.every(Boolean)) {
    return Math.min(fence.to, here + 1);
  }
  const stumbles = recent.slice(-STUMBLES_TO_EASE);
  if (stumbles.length >= STUMBLES_TO_EASE && stumbles.every((was) => !was)) {
    return Math.max(fence.from, here - 1);
  }
  return here;
}
