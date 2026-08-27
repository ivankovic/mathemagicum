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

// Three timbers rather than one. A post drawn in a single brown is a stick;
// a dark edge, a face and a lit side is a turned piece of wood, and that is
// the whole difference between a diagram of an hourglass and an object.
const WOOD_DARK_HEX = 0x4a2f16;
const WOOD_HEX = 0x6b4a24;
const WOOD_LIGHT_HEX = 0x93683a;
// The bands. Brass because it is the one metal in this game's palette that
// is not a coin, and because a wooden hourglass with no metal on it has
// nothing holding it together.
const BRASS_HEX = 0xc8901c;
const BRASS_LIGHT_HEX = 0xeec469;
// Cool and thin, not cream: the parchment behind this is warm and pale, and
// glass drawn in the same family disappeared into it — what a child saw was
// the sand floating with nothing round it.
const GLASS_HEX = 0xdfe9f0;
const GLASS_EDGE_HEX = 0x3b2c1a;
const GLINT_HEX = 0xffffff;
const SAND_HEX = 0xd9a441;
const SAND_LIGHT_HEX = 0xf2c86f;
const SAND_DARK_HEX = 0xa87826;
const SHADE_HEX = 0x120d08;

/** How many steps the curve of a bulb is drawn in. */
const CURVE_STEPS = 18;
/**
 * How the side of a bulb bends between the neck and the cap.
 *
 * Below one, so it flares fast off the neck and then straightens as it
 * climbs — which is the shape a blown glass bulb actually has. Drawn with
 * straight sides it was a bow tie, which is the *symbol* for an hourglass
 * rather than a picture of one.
 */
const BULGE = 0.62;
/** How many grains are in the air at once. */
const GRAINS = 7;

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
function sandLevels(along: number): SandLevels {
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

  /**
   * Half the width of a bulb, `along` of the way from the neck to its cap.
   *
   * The one piece of shape in here, and everything is built from it: the
   * glass, the sand resting in the top, the heap in the bottom. Drawn from
   * one profile they cannot disagree, which is what stops sand sitting
   * outside its own glass on the frame after the frame the level changes.
   */
  private halfAt(along: number, wide: number): number {
    const t = Math.max(0, Math.min(1, along));
    return NECK / 2 + (wide / 2 - NECK / 2) * t ** BULGE;
  }

  /** One bulb's outline, from the neck out to its cap and back. */
  private bulb(
    cx: number,
    waist: number,
    reach: number,
    wide: number,
  ): Phaser.Types.Math.Vector2Like[] {
    const points: Phaser.Types.Math.Vector2Like[] = [];
    for (let step = 0; step <= CURVE_STEPS; step++) {
      const t = step / CURVE_STEPS;
      points.push({ x: cx - this.halfAt(t, wide), y: waist + reach * t });
    }
    for (let step = CURVE_STEPS; step >= 0; step--) {
      const t = step / CURVE_STEPS;
      points.push({ x: cx + this.halfAt(t, wide), y: waist + reach * t });
    }
    return points;
  }

  /**
   * The band of a bulb between two heights, which is what sand fills.
   *
   * `from` and `to` are fractions of the way from the neck outward, so the
   * sand resting in the top bulb is `[0, level.top]` and the heap in the
   * bottom one is `[1 - level.bottom, 1]`.
   */
  private band(
    cx: number,
    waist: number,
    reach: number,
    wide: number,
    from: number,
    to: number,
  ): Phaser.Types.Math.Vector2Like[] {
    const points: Phaser.Types.Math.Vector2Like[] = [];
    const steps = Math.max(2, Math.round(CURVE_STEPS * Math.abs(to - from)));
    for (let step = 0; step <= steps; step++) {
      const t = from + ((to - from) * step) / steps;
      points.push({ x: cx - this.halfAt(t, wide), y: waist + reach * t });
    }
    for (let step = steps; step >= 0; step--) {
      const t = from + ((to - from) * step) / steps;
      points.push({ x: cx + this.halfAt(t, wide), y: waist + reach * t });
    }
    return points;
  }

  /** A cap: a turned disc of wood with a brass ring round it. */
  private cap(cx: number, y: number, wide: number, downward: boolean): void {
    const g = this.ink;
    // Narrower than the stand, so the knobs on the posts stand proud of it.
    const half = wide / 2 + 2;
    const lip = downward ? 1 : -1;
    g.fillStyle(WOOD_DARK_HEX, 1);
    g.fillRoundedRect(cx - half, y - CAP_H / 2, half * 2, CAP_H, 3);
    g.fillStyle(WOOD_HEX, 1);
    g.fillRoundedRect(cx - half + 1, y - CAP_H / 2 + 1, half * 2 - 2, CAP_H - 3, 3);
    // A lit edge on the side the light falls on, which is the top of the
    // upper cap and the top of the lower one — one light, not two.
    g.fillStyle(WOOD_LIGHT_HEX, 1);
    g.fillRect(cx - half + 3, y - CAP_H / 2 + 1, half * 2 - 6, 1);
    g.fillStyle(BRASS_HEX, 1);
    g.fillRect(cx - half + 2, y + (lip * CAP_H) / 2 - (downward ? 2 : 0), half * 2 - 4, 2);
  }

  private draw(): void {
    const { width, height } = this.scene.scale;
    this.shade.setSize(width, height);
    // Shrunk to fit a small screen rather than drawn off the edges of one.
    const wide = Math.min(GLASS_W, Math.max(48, width * 0.4));
    const tall = Math.min(GLASS_H, Math.max(76, height * 0.42));
    const cx = Math.round(width / 2);
    const cy = Math.round(height / 2);
    const top = cy - tall / 2;
    const bottom = cy + tall / 2;
    const waist = cy;
    const reach = tall / 2;
    const level = sandLevels(this.along);

    const g = this.ink;
    g.clear();

    // --- the stand, behind the glass ---------------------------------------

    const postX = wide / 2 + 5;
    for (const side of [-1, 1]) {
      const x = cx + side * postX;
      g.fillStyle(WOOD_DARK_HEX, 1);
      g.fillRect(x - 3, top - CAP_H / 2, 6, tall + CAP_H);
      g.fillStyle(WOOD_HEX, 1);
      g.fillRect(x - 2, top - CAP_H / 2, 4, tall + CAP_H);
      g.fillStyle(WOOD_LIGHT_HEX, 1);
      g.fillRect(x - 2, top - CAP_H / 2, 1, tall + CAP_H);
    }

    // --- the glass ---------------------------------------------------------

    g.fillStyle(GLASS_HEX, 0.55);
    g.lineStyle(2, GLASS_EDGE_HEX, 0.85);
    for (const way of [-1, 1]) {
      const outline = this.bulb(cx, waist, way * reach, wide);
      g.fillPoints(outline, true);
      // Outlined as well as filled. Over a parchment the fill alone had no
      // edge at all, and the glass was wherever the sand happened to stop.
      g.strokePoints(outline, true);
    }

    // --- what is in it -----------------------------------------------------

    if (level.top > 0) {
      g.fillStyle(SAND_HEX, 1);
      g.fillPoints(this.band(cx, waist, -reach, wide, 0, level.top), true);
      // The surface catches the light, and it is the one edge of the sand a
      // child is actually watching: it is the thing that goes down.
      const surface = waist - reach * level.top;
      const half = this.halfAt(level.top, wide);
      g.fillStyle(SAND_LIGHT_HEX, 1);
      g.fillRect(cx - half, surface, half * 2, 2);
    }

    if (level.bottom > 0) {
      // Filled from the base up, with a cone under the neck: a poured heap
      // has a peak, and a flat top would read as a liquid.
      const from = Math.max(0, 1 - level.bottom);
      g.fillStyle(SAND_HEX, 1);
      g.fillPoints(this.band(cx, waist, reach, wide, from, 1), true);
      const surface = waist + reach * from;
      const half = this.halfAt(from, wide);
      const peak = Math.min(reach * 0.22, reach * from);
      g.fillPoints(
        [
          { x: cx - half, y: surface },
          { x: cx + half, y: surface },
          { x: cx, y: surface - peak },
        ],
        true,
      );
      g.fillStyle(SAND_DARK_HEX, 1);
      g.fillRect(cx - half, surface + 1, half * 2, 1);
    }

    // The stream, and grains loose in it. A bare column read as a wire; a
    // few grains falling at different heights is what says it is running.
    if (level.falling) {
      const landing = waist + reach * Math.max(0, 1 - level.bottom);
      g.fillStyle(SAND_HEX, 1);
      g.fillRect(cx - 1, waist, 2, Math.max(0, landing - waist));
      g.fillStyle(SAND_LIGHT_HEX, 1);
      for (let grain = 0; grain < GRAINS; grain++) {
        // Derived from how far through it is rather than rolled, so the
        // grains fall rather than flicker: each one repeats down the stream
        // at its own offset.
        const at = (this.along * 9 + grain / GRAINS) % 1;
        const y = waist + (landing - waist) * at;
        if (y >= landing) continue;
        g.fillRect(cx - 2 + (grain % 3), y, 1, 2);
      }
    }

    // A glint down the left of each bulb, over the sand: glass in front of
    // what it holds, which is the one thing that says it is glass at all.
    g.fillStyle(GLINT_HEX, 0.5);
    for (const way of [-1, 1]) {
      for (let step = 2; step <= CURVE_STEPS - 3; step++) {
        const t = step / CURVE_STEPS;
        const x = cx - this.halfAt(t, wide) + 2;
        g.fillRect(x, waist + way * reach * t, 2, 2);
      }
    }

    // --- and the frame, last, over everything ------------------------------

    this.cap(cx, top - CAP_H / 2, wide, false);
    this.cap(cx, bottom + CAP_H / 2, wide, true);
    // The knobs go on after the caps, not with the posts. Drawn with them
    // they were underneath: a cap is wider than the stand it holds, so it
    // covered both ends of both posts and the stand read as two bare bars.
    for (const side of [-1, 1]) {
      for (const end of [top - CAP_H / 2, bottom + CAP_H / 2]) {
        g.fillStyle(BRASS_HEX, 1);
        g.fillCircle(cx + side * postX, end, 4);
        g.fillStyle(BRASS_LIGHT_HEX, 1);
        g.fillCircle(cx + side * postX - 1, end - 1, 2);
      }
    }
    // The collar at the waist, where a real one is joined.
    //
    // Edged in the dark timber, because brass laid straight onto sand is
    // gold on gold: the collar was there and could not be seen, and the
    // waist read as the two bulbs simply meeting.
    const collar = NECK + 3;
    g.fillStyle(WOOD_DARK_HEX, 1);
    g.fillRect(cx - collar, waist - 5, collar * 2, 10);
    g.fillStyle(BRASS_HEX, 1);
    g.fillRect(cx - collar + 1, waist - 4, collar * 2 - 2, 8);
    g.fillStyle(BRASS_LIGHT_HEX, 1);
    g.fillRect(cx - collar + 1, waist - 4, collar * 2 - 2, 1);
    g.fillRect(cx - collar + 1, waist + 1, collar * 2 - 2, 1);
  }

  destroy(): void {
    this.stop();
    this.shade.destroy();
    this.ink.destroy();
  }
}
