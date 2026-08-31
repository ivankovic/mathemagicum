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

/** A wrong answer, and a finished one. Never a scolding; see the panels. */
export const WRONG_INK = "#a8321e";
export const WRONG_HEX = 0xa8321e;
export const DONE_INK = "#3d6b2a";
export const DONE_HEX = 0x3d6b2a;

/** The paper itself: a pale fill for boxes, a darker one for buttons. */
export const PAPER_PALE_HEX = 0xf6e8c4;
export const PAPER_HEX = 0xdec694;

/** The gold a box waiting for an answer is outlined in. */
export const ACTIVE_HEX = 0xc8901c;
