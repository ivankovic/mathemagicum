// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * Two fingers on the glass, and the zoom they are asking for.
 *
 * Split out of `GameScene` because it is a small state machine with four
 * pieces of state that only make sense together, and the scene's pointer
 * handlers were the only thing that knew the order they had to be read in.
 * The scene still owns the camera: this says what zoom the child wants,
 * and `GameScene.zoomWanted` is the one place that answer meets the spell
 * that can override it. See `src/input/pinch.ts` for the arithmetic.
 */

import { pinchedZoom, settledZoom, spread, zoomSteps } from "../../input/pinch";

/** What a pinch needs from the scene. */
export interface PinchHost {
  /** Let go of the joystick: a stick that stayed on would walk her across the world for as long as the zoom took. */
  readonly release: () => void;
  /** Put the camera where the zoom now says. */
  readonly applyZoom: () => void;
}

export class Pinch {
  /**
   * How far out the child has pulled the camera, and the pinch doing it now.
   *
   * Two fields because they are two different facts. `restingZoom` is a
   * *choice* — it outlives the fingers that made it and is what the camera
   * goes back to when a spell that pulled the view out is done with it.
   * `pinching` exists only between the second finger landing and the first
   * one lifting, and while it does, the live value it carries is what the
   * camera shows. See `zoomWanted`, which is the one place they meet.
   *
   * Not written down anywhere. A view is where you are looking rather than
   * something you own, and a game that reopened zoomed out because of a
   * pinch three days ago would be a game that had rearranged itself.
   */
  private restingZoom: number;
  private pinching: { a: number; b: number; from: number; held: number; live: number } | null =
    null;
  /**
   * Every finger currently on the glass, by pointer id.
   *
   * Phaser hands out one pointer per touch and reuses the ids, and the
   * scene's own handlers see them one at a time — so "are two fingers down"
   * is a question nothing else here could answer.
   */
  private readonly touching = new Map<number, { x: number; y: number }>();
  /**
   * Whether this touch has been a pinch, until the last finger lifts.
   *
   * A pinch ends when one of the two fingers goes, and the other is usually
   * still down. Without this, that leftover finger becomes a joystick the
   * moment its partner leaves and the child walks off across the world at
   * the end of every zoom.
   */
  private pinched = false;

  constructor(
    /** The world's own zoom, where the camera rests until a pinch says otherwise. */
    private readonly worldZoom: number,
    private readonly host: PinchHost,
  ) {
    this.restingZoom = worldZoom;
  }

  /**
   * What the child has asked for, or what her fingers are asking for right
   * now. The live value wins while a pinch is running and is gone the
   * moment it ends, which is the whole difference between the two.
   */
  get zoom(): number {
    return this.pinching?.live ?? this.restingZoom;
  }

  /** Whether the finger still down is the one left over from a pinch. */
  get leftOver(): boolean {
    return this.pinched;
  }

  /** A finger landed. */
  touch(id: number, x: number, y: number): void {
    this.touching.set(id, { x, y });
  }

  /** A finger moved, if it is one this is watching. */
  moved(id: number, x: number, y: number): void {
    if (this.touching.has(id)) this.touching.set(id, { x, y });
  }

  /** A finger lifted, or left the glass still held. */
  lifted(id: number): void {
    this.touching.delete(id);
  }

  /**
   * A second finger has landed: start following the two of them.
   *
   * Answered true when this press belongs to a pinch, which is what keeps it
   * from also being a tap. The joystick is let go rather than left holding
   * the first finger — a stick that stayed on would walk her across the
   * world for as long as the zoom took.
   *
   * The two ids are remembered rather than re-read every frame. A third
   * finger on a tablet held in two hands is common, and a pinch that
   * silently changed which fingers it was watching would jump.
   */
  begin(): boolean {
    if (this.pinching) return true;
    if (this.touching.size < 2) return false;
    const [first, second] = [...this.touching.entries()];
    if (!first || !second) return false;
    const steps = zoomSteps(this.worldZoom);
    if (steps.length < 2) return false;
    this.host.release();
    this.pinched = true;
    this.pinching = {
      a: first[0],
      b: second[0],
      from: spread(first[1], second[1]),
      held: this.restingZoom,
      live: this.restingZoom,
    };
    return true;
  }

  /** The fingers moved: put the camera where they are holding it. */
  drag(): boolean {
    const pinch = this.pinching;
    if (!pinch) return false;
    const one = this.touching.get(pinch.a);
    const other = this.touching.get(pinch.b);
    if (!one || !other) return true;
    pinch.live = pinchedZoom(pinch.held, pinch.from, spread(one, other), zoomSteps(this.worldZoom));
    this.host.applyZoom();
    return true;
  }

  /**
   * One of the two lifted: let it come to rest on a step.
   *
   * On the *nearest* step rather than wherever the fingers left it, so the
   * world is never drawn at a fraction of a pixel while nobody is touching
   * it — see `pinch.ts`. Nothing happens for the other fingers on the glass:
   * the gesture is over the moment it is no longer two.
   */
  end(pointerId: number): void {
    const pinch = this.pinching;
    if (pinch && (pointerId === pinch.a || pointerId === pinch.b)) {
      this.restingZoom = settledZoom(pinch.live, zoomSteps(this.worldZoom));
      this.pinching = null;
      this.host.applyZoom();
    }
    if (this.touching.size === 0) this.pinched = false;
  }
}
