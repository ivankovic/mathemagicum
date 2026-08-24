// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * The glass turning: sand running from the top bulb into the bottom one.
 *
 * The only thing in this game that says how *big* a spell was. Every other
 * cast lands in the same instant whatever the answer, which is right for
 * them — a sum is a sum — but the hourglass moves the world by an amount the
 * child chose, and a five-minute nudge should not look like heaving the day
 * round to the same hour tomorrow. So the sand runs for as long as the move
 * was worth: see `sandFor`.
 *
 * Drawn rather than animated from a sheet, and deliberately. The frames
 * would be a sprite that has to be redrawn every time the shape changes, and
 * what is actually moving here is one number — how much sand is left up top —
 * from which the two heaps and the stream between them all follow. The
 * clock faces on the parchment beside it are drawn the same way.
 *
 * While it runs the world's light moves with it, which is the point of
 * watching: a child who winds the clock to dusk sees dusk arrive rather than
 * being handed it. That easing lives in the scene, because the clock does.
 */

/** How wide and tall the glass is drawn, before the screen is measured. */
const GLASS_W = 96;
const GLASS_H = 148;
/** The waist: how wide the neck the sand runs through is. */
const NECK = 7;
/** The wooden caps top and bottom. */
const CAP_H = 9;

const FRAME_HEX = 0x6b4a24;
const GLASS_HEX = 0xf3e7c8;
const SAND_HEX = 0xd9a441;
const SHADE_HEX = 0x120d08;

export interface SandLevels {
  /** How much of the top bulb still holds sand, 0 to 1. */
  readonly top: number;
  /** How much of the bottom bulb has filled, 0 to 1. */
  readonly bottom: number;
  /** Whether sand is still falling through the neck. */
  readonly falling: boolean;
}

/**
 * Where the sand is, a fraction of the way through.
 *
 * Its own function because it is the whole of what moves, and because the
 * one thing that would look wrong — sand in neither bulb, or in both to the
 * full — is a rule about two numbers rather than about a drawing.
 */
export function sandLevels(along: number): SandLevels {
  const through = Math.max(0, Math.min(1, along));
  return { top: 1 - through, bottom: through, falling: through > 0 && through < 1 };
}

export class SandGlass {
  private readonly shade: Phaser.GameObjects.Rectangle;
  private readonly ink: Phaser.GameObjects.Graphics;
  private running: Phaser.Tweens.Tween | null = null;
  private along = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    depth: number,
    register: (object: Phaser.GameObjects.GameObject) => void,
  ) {
    // A wash over the world rather than a black-out: the whole point is
    // watching the light change behind it.
    this.shade = scene.add
      .rectangle(0, 0, 10, 10, SHADE_HEX, 0.28)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(depth)
      .setVisible(false);
    this.ink = scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(depth + 1)
      .setVisible(false);
    register(this.shade);
    register(this.ink);
  }

  get isRunning(): boolean {
    return this.running !== null;
  }

  /**
   * Turn the glass over.
   *
   * `onPour` is handed how far through the sand is, every frame, because the
   * world's clock has to move with it — and by one tween rather than two.
   * Two of the same length looked identical and were not: the second one's
   * last update landed after the first had already settled the clock, and
   * the world wound on twice.
   */
  run(ms: number, onPour: (along: number) => void, onDone: () => void): void {
    this.stop();
    this.along = 0;
    this.shade.setVisible(true);
    this.ink.setVisible(true);
    this.draw();
    this.running = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: Math.max(1, ms),
      onUpdate: (tween) => {
        this.along = tween.getValue() ?? 0;
        this.draw();
        onPour(this.along);
      },
      onComplete: () => {
        this.running = null;
        this.hide();
        onDone();
      },
    });
  }

  private stop(): void {
    this.running?.remove();
    this.running = null;
  }

  private hide(): void {
    this.shade.setVisible(false);
    this.ink.setVisible(false).clear();
  }

  /** Re-place for a viewport of this size. */
  layout(width: number, height: number): void {
    this.shade.setSize(width, height);
    if (this.running) this.draw();
  }

  private draw(): void {
    const { width, height } = this.scene.scale;
    this.shade.setSize(width, height);
    const cx = Math.round(width / 2);
    const cy = Math.round(height / 2);
    const w = GLASS_W;
    const h = GLASS_H;
    const top = cy - h / 2;
    const bottom = cy + h / 2;
    const waist = cy;
    const level = sandLevels(this.along);

    const g = this.ink;
    g.clear();

    // The two bulbs, as a bow tie: a triangle down to the neck and another
    // out from it. Drawn before the sand so the sand sits inside them.
    g.fillStyle(GLASS_HEX, 0.92);
    g.fillPoints(
      [
        { x: cx - w / 2, y: top },
        { x: cx + w / 2, y: top },
        { x: cx + NECK / 2, y: waist },
        { x: cx - NECK / 2, y: waist },
      ],
      true,
    );
    g.fillPoints(
      [
        { x: cx - NECK / 2, y: waist },
        { x: cx + NECK / 2, y: waist },
        { x: cx + w / 2, y: bottom },
        { x: cx - w / 2, y: bottom },
      ],
      true,
    );

    // The sand still up top: a triangle that keeps its point at the neck and
    // whose surface falls, which is what draining actually looks like.
    if (level.top > 0) {
      const surface = waist - (waist - top) * level.top;
      const half = NECK / 2 + (w / 2 - NECK / 2) * level.top;
      g.fillStyle(SAND_HEX, 1);
      g.fillPoints(
        [
          { x: cx - half, y: surface },
          { x: cx + half, y: surface },
          { x: cx + NECK / 2, y: waist },
          { x: cx - NECK / 2, y: waist },
        ],
        true,
      );
    }

    // And the heap below, which grows from the point outward — a cone, the
    // way a poured heap really piles up.
    if (level.bottom > 0) {
      const rise = (bottom - waist) * level.bottom;
      const half = (w / 2) * level.bottom;
      g.fillStyle(SAND_HEX, 1);
      g.fillPoints(
        [
          { x: cx - half, y: bottom },
          { x: cx + half, y: bottom },
          { x: cx, y: bottom - rise },
        ],
        true,
      );
    }

    // The stream, while there is anything left to fall.
    if (level.falling) {
      g.fillStyle(SAND_HEX, 1);
      g.fillRect(cx - 1, waist, 2, bottom - waist - (bottom - waist) * level.bottom);
    }

    // The frame last, over the glass, so the caps read as holding it.
    g.fillStyle(FRAME_HEX, 1);
    g.fillRect(cx - w / 2 - 6, top - CAP_H, w + 12, CAP_H);
    g.fillRect(cx - w / 2 - 6, bottom, w + 12, CAP_H);
    g.fillRect(cx - w / 2 - 5, top, 3, h);
    g.fillRect(cx + w / 2 + 2, top, 3, h);
  }

  destroy(): void {
    this.stop();
    this.shade.destroy();
    this.ink.destroy();
  }
}
