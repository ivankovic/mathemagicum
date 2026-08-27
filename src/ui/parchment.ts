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
