// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * The ink and the paper every parchment in this game is drawn with.
 *
 * It was written out in nineteen files. Not copied *badly* — the values
 * agreed — but the names had already come apart: `INK` is brown ink on
 * eighteen sheets and pale letters on the title card, and `INK_DIM` the
 * same. Two names, four meanings, and nothing anywhere to say which was
 * which. A re-skin was a nineteen-file change and a nineteen-file chance to
 * miss one.
 *
 * Only the ones that genuinely agreed are here. The title card keeps its own
 * pair under its own names, because a dark card with pale writing on it is a
 * different thing from a sheet of parchment and calling both of them `INK`
 * is how this started.
 *
 * Two spellings of each, and that is Phaser's doing rather than a choice:
 * text takes a CSS string and shapes take a number, and every file needed
 * both.
 */

/**
 * The face everything in this game is written in.
 *
 * Andika, by SIL International, under the Open Font License, declared in
 * `index.html` and served from the device. It is drawn for people who are
 * still learning to read — which is who this is for — so its letters are
 * chosen to be unmistakable to somebody who does not yet know them well,
 * and its nought is a plain round one rather than a slashed one. A game
 * that teaches a child what a nought looks like must not then show them a
 * second kind of nought in the corner of the screen.
 *
 * It replaced `monospace`, which was the browser's own choice of typewriter
 * in seventeen places: the same face a terminal uses, on a sheet of
 * parchment, in a village of runes. Nothing about it was chosen.
 *
 * A fallback after it because a font can fail to arrive and letters in the
 * wrong face beat no letters — though `main.ts` waits for this one before
 * anything is drawn, so the fallback should never be seen.
 */
export const FACE = "Andika, sans-serif";

/**
 * What was cut out of it, as ranges of characters.
 *
 * The whole face is two-thirds of a megabyte and the game speaks three
 * languages, so what ships is a subset: everything a keyboard in English,
 * German or Croatian produces, the punctuation the phrase books use, and the
 * mathematical signs. Twenty-two kilobytes rather than six hundred and
 * fifty.
 *
 * Written down here because a subset is a promise that can be broken from a
 * long way away: a sentence added to `src/i18n` with a character outside
 * these ranges renders as an empty box, in a language whoever added it may
 * not read. `face.test.ts` holds the phrase books to this list.
 */
export const FACE_RANGES: readonly (readonly [number, number])[] = [
  [0x0020, 0x007e], // the plain Latin alphabet, digits, punctuation
  [0x00a0, 0x00ff], // Latin-1: ä ö ü ß × ÷ ©
  [0x0100, 0x017f], // Latin Extended-A: č ć š ž đ
  [0x2000, 0x206f], // the dashes, the quotes of all three languages, …
  [0x2190, 0x2193], // arrows
  [0x2212, 0x2212], // the minus sign, which is not the hyphen
];

/** Brown ink, for anything written on parchment. */
export const INK = "#4a3422";
export const INK_HEX = 0x4a3422;

/** The same hand, lighter: captions, hints, and anything not yet answered. */
export const INK_DIM = "#8a6a48";
/** And ruled lines, which are that colour drawn rather than written. */
export const RULE_HEX = 0x8a6a48;

/**
 * A wrong answer, and a finished one. Never a scolding; see the panels.
 *
 * The red is also the mark on a map and the crow in a lesson: the one
 * colour on a sheet that says *look here*, whatever it is pointing at.
 */
export const WRONG_INK = "#a8321e";
export const WRONG_HEX = 0xa8321e;
export const DONE_INK = "#3d6b2a";
export const DONE_HEX = 0x3d6b2a;

/** The paper itself: a pale fill for boxes, a darker one for buttons. */
export const PAPER_PALE_HEX = 0xf6e8c4;
export const PAPER_HEX = 0xdec694;

/**
 * The gold anything in play is marked in: the box waiting for an answer,
 * the page you are on, the choice that is chosen, the axis of a symmetry,
 * the sweep of a clock's hand — and, the same pigment, the brass of the
 * sandglass and the bar of the loading card.
 *
 * It was written out under eight names before it was one: `HERE`, `SWEEP`,
 * `CHOSEN`, `AXIS`, `RUNE`, `BRASS`, `BAR_FILL` — each right about what it
 * was for and none of them saying it was the same gold as the others.
 */
export const ACTIVE_HEX = 0xc8901c;

/**
 * The sizes writing on parchment comes in.
 *
 * Five, from what the sheets were already using: every panel had declared
 * its own `TITLE_SIZE` and `BODY_SIZE`, and they agreed — seventeen and
 * thirteen, in every file — without anything saying they had to. Now they
 * have to. A sheet still names its own roles (`HINT_SIZE`, `ROW_SIZE`) and
 * says which of these it means, so what changes together changes here.
 */
export const TYPE = {
  /** The heading of a sheet. */
  title: 17,
  /** The heading of a spell's parchment: one short line over a keypad. */
  spellTitle: 20,
  /** Prose, the words on buttons, and the digits on a keypad. */
  body: 13,
  /** Captions, hints, and the heading over a row of choices. */
  small: 12,
  /** A place name on a map, a line of copyright. */
  tiny: 11,
} as const;
