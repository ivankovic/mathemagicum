// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * Which way round a thing has been put down.
 *
 * Reported from a playtest: there is no way to rotate objects when placing
 * them. There is now, and this is the arithmetic of it — kept apart from the
 * scene because *which way round* is a fact about a placed thing and the
 * scene's business is only drawing it.
 *
 * **Four ways round, three drawings.** A thing seen from the west is the
 * same picture as one seen from the east, mirrored, and every placed object
 * already carries a `flip` for exactly that reason — the fence's side run
 * uses it. So the generator draws toward, away and side-on, and the fourth
 * way costs nothing but a boolean.
 *
 * Deliberately *not* the `Facing` a character has. That one is up, down,
 * left and right, it is about walking, and it is stored on the session; this
 * is about a bench and it is stored on the bench. Two things called facing
 * that meant different things would be worse than two names.
 */

export const Turn = {
  /** Its front toward the camera, which is how everything is drawn today. */
  Toward: 0,
  /** Turned round: its back is nearest. */
  Away: 1,
  /** Side-on, facing right across the picture. */
  Side: 2,
  /** Side-on the other way, which is the same drawing mirrored. */
  SideOther: 3,
} as const;

export type Turn = (typeof Turn)[keyof typeof Turn];

export const TURNS: readonly Turn[] = [Turn.Toward, Turn.Away, Turn.Side, Turn.SideOther];

/**
 * How many drawings the generator ships for a thing that turns.
 *
 * Three, and it has to agree with the generator's own `FACINGS_DRAWN`.
 * `assets.test.ts` reads the shipped sidecars and holds the two together —
 * the same guard the footprints and the landmark overhangs have, and for the
 * same reason: world generation runs long before any art is loaded.
 */
export const TURNS_DRAWN = 3;

/**
 * How many ways round a thing with this many drawings can go.
 *
 * One or four, never anything between. A thing with one drawing cannot turn
 * at all; a thing with three turns four ways, because the fourth is the
 * third mirrored. There is no sensible two.
 */
export function waysRound(drawings: number): number {
  return drawings >= TURNS_DRAWN ? TURNS.length : 1;
}

/**
 * The next way round, wrapping.
 *
 * Wrapping rather than stopping, because turning is how a child *looks* at
 * the four choices — a control that stopped at the last one would make going
 * back mean tapping a different thing, and there is no different thing.
 */
export function nextTurn(turn: number, drawings: number): Turn {
  const ways = waysRound(drawings);
  if (ways <= 1) return Turn.Toward;
  return (((Math.trunc(turn) % ways) + ways + 1) % ways) as Turn;
}

/** Which of the three drawings this way round is drawn from. */
export function drawnLook(turn: number): number {
  return turn === Turn.SideOther ? Turn.Side : Math.max(0, Math.trunc(turn)) % TURNS.length;
}

/** And whether that drawing is mirrored to get there. */
export function drawnFlip(turn: number): boolean {
  return turn === Turn.SideOther;
}

/**
 * A turn read back from a save, or from anywhere else that might be wrong.
 *
 * Clamped rather than trusted, and clamped to *toward* rather than to the
 * nearest: a bench that came back from an old save facing nowhere in
 * particular should face the way every bench used to, which is the way the
 * one drawing there used to be faces.
 */
export function turnFrom(value: unknown): Turn {
  if (typeof value !== "number" || !Number.isInteger(value)) return Turn.Toward;
  return value >= 0 && value < TURNS.length ? (value as Turn) : Turn.Toward;
}
