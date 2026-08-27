// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * Two fingers, moved apart or together, and where they leave the camera.
 *
 * The arithmetic only. Which pointers are down and what the camera does
 * about it is the scene's, the same way `VirtualJoystick` owns a stick and
 * not a walk — and this half is the half worth testing, because a pinch is
 * three numbers that have to agree and none of them can be seen in a
 * screenshot.
 *
 * **It rests on whole numbers and moves between them.** The world is drawn
 * at an integer zoom so that one world pixel is a whole number of screen
 * pixels; a camera left at 1.37 draws pixel art with every third row a pixel
 * taller than its neighbours, which on a hand-drawn tile reads as a printing
 * fault. But a pinch that jumped from one step to the next would not feel
 * like a pinch at all — the whole gesture is the picture following your
 * fingers. So it follows them exactly while they are down, and lands on a
 * step when they lift. Shimmer under a moving finger is invisible; shimmer
 * in a picture nobody is touching is a bug.
 */

/** How far apart two fingers are, in screen pixels. */
export function spread(
  one: { readonly x: number; readonly y: number },
  other: { readonly x: number; readonly y: number },
): number {
  return Math.hypot(one.x - other.x, one.y - other.y);
}

/**
 * The steps the camera may come to rest on.
 *
 * The world's own zoom, and half of it — which is what "zoom out to a half"
 * means when the thing being halved is how big everything is drawn. Halving
 * an integer zoom of two lands on one, so both steps are whole numbers and
 * the rule above costs nothing here; a world drawn at three would round, and
 * round *up*, because a step below one is a world drawn smaller than its own
 * art and there is nothing to be gained by looking at that.
 */
export function zoomSteps(normal: number): readonly number[] {
  const out = Math.max(1, Math.round(normal / 2));
  return out < normal ? [out, normal] : [normal];
}

/**
 * Where a pinch has the camera while the fingers are still down.
 *
 * Scaled by how much wider the fingers are than when they landed, which is
 * the one definition that makes the picture stay under them: fingers twice
 * as far apart, everything twice as big.
 *
 * Held inside the steps rather than allowed past them. A pinch that could
 * run to any zoom would need a rule about where it stops anyway, and a
 * gesture that visibly refuses to go further is a clearer answer than one
 * that goes and springs back.
 */
export function pinchedZoom(
  held: number,
  from: number,
  to: number,
  steps: readonly number[],
): number {
  const first = steps[0];
  const last = steps[steps.length - 1];
  if (first === undefined || last === undefined) return held;
  if (from <= 0) return Math.min(last, Math.max(first, held));
  return Math.min(last, Math.max(first, (held * to) / from));
}

/**
 * And where it settles when they lift: the nearest step.
 *
 * Nearest rather than whichever way the fingers were travelling. A child who
 * pinches a little way and lets go has not asked for anything, and a camera
 * that took the smallest movement as a decision would be a camera that
 * changed every time the screen was touched with two hands.
 */
export function settledZoom(live: number, steps: readonly number[]): number {
  let best = steps[0];
  if (best === undefined) return live;
  for (const step of steps) {
    if (Math.abs(step - live) < Math.abs(best - live)) best = step;
  }
  return best;
}
