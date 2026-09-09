// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";

/**
 * What the guide is drawn in, and why it is not the game's gold.
 *
 * Everything the parchments mark in play — the box waiting for an answer,
 * the page you are on, the clock's sweep — is `ACTIVE_HEX`, a warm gold
 * that sits on paper. These marks are not on paper. They are laid over
 * grass, turned earth, a wooden shop counter and a stone street, and a
 * playtest on a tablet said what that means: gold on gold is a ring nobody
 * can find, and the whole job of this ring is being findable by somebody
 * who does not yet know what she is looking for.
 *
 * Cyan is the one hue the world does not already own. There is no cyan
 * ground, no cyan building and no cyan crop, so it can never be mistaken
 * for a thing in the garden — and against every one of those browns and
 * greens it is the furthest apart a colour can be. The pale companion is
 * what makes it *glow* rather than merely differ: a light core inside a
 * saturated edge reads as lit from within, which is what a magic thing
 * pointing somewhere should look like.
 */
/**
 * Exported, because a second mark now wears them: the rune over a teacher's
 * head. A playtest asked for the two to match in as many words, and two
 * spellings of `0x18c8e0` in two files is how they stop matching.
 */
export const GUIDE_HEX = 0x18c8e0;
export const GUIDE_GLOW_HEX = 0xb4f4ff;

/**
 * The guide's two marks: a glow round a button, and an arrow over a thing.
 *
 * Both drawn on the interface layer in screen pixels, whatever they point
 * at. A world target — a square, a crop, a person — is turned into a screen
 * point by the scene before it gets here, which is what lets one arrow serve
 * a bench in the garden and a shopkeeper in her room: the two live on
 * different layers and only one of them is on screen at a time, and an
 * arrow that lived on either would vanish with it.
 *
 * **The glow breathes; the arrow bobs.** A still ring round a button reads
 * as part of the button, and a still arrow as part of the scenery. Both
 * marks are in the gold the game already uses for *this one is active* —
 * the lit rune, the aimed square — so a child who has seen a rune lit
 * knows what colour means *press here*.
 *
 * **An arrow at the edge for a thing off the screen.** The store is fifty
 * squares away, and an arrow over its door would be an arrow over nothing.
 * When the target is off screen the arrow sits just inside the nearest
 * edge, turned to point at it, and walks in to hang over the door once the
 * door is in view.
 *
 * Made once and moved, like the runes over the teachers: it is on screen
 * for whole minutes at a time, and a mark built fresh every frame would be
 * the most expensive thing on the screen.
 */

/** The ring's line, and how much it grows and fades over a breath. */
const RING_STROKE = 4;
const RING_GROW = 0.22;
const BREATH_MS = 900;
/** The arrow: a chevron this tall, bobbing this far, this far above the target. */
const ARROW = 22;
const BOB = 6;
const LIFT = 46;
/** How far inside the screen's edge an arrow for something off screen sits. */
const INSET = 34;
/** The dots along a route: how big, and how far above the ground they sit. */
const DOT = 5;
const DOT_LIFT = 10;

/** A point on the screen. */
export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

export class GuideMarks {
  private readonly ring: Phaser.GameObjects.Arc;
  private readonly arrow: Phaser.GameObjects.Graphics;
  private readonly dots: Phaser.GameObjects.Graphics;
  /** How many dots the last `pointAlong` laid down. */
  private trailLength = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    depth: number,
    register: (object: Phaser.GameObjects.GameObject) => void,
  ) {
    this.ring = scene.add
      .circle(0, 0, 10)
      .setStrokeStyle(RING_STROKE, GUIDE_HEX, 1)
      .setScrollFactor(0)
      .setDepth(depth)
      .setVisible(false);
    this.arrow = scene.add.graphics().setScrollFactor(0).setDepth(depth).setVisible(false);
    // Drawn once, pointing down; turned and moved from then on.
    this.arrow.fillStyle(GUIDE_HEX, 1);
    // Outlined in its own pale glow rather than in ink. An ink line round a
    // cyan arrow is a cyan arrow with a dark edge, which reads as a hole;
    // the light edge is what makes it read as lit.
    this.arrow.lineStyle(2, GUIDE_GLOW_HEX, 0.9);
    this.arrow.beginPath();
    this.arrow.moveTo(-ARROW * 0.6, -ARROW);
    this.arrow.lineTo(ARROW * 0.6, -ARROW);
    this.arrow.lineTo(0, 0);
    this.arrow.closePath();
    this.arrow.fillPath();
    this.arrow.strokePath();
    // A shaft above the head, so it reads as an arrow and not a triangle.
    this.arrow.fillRect(-ARROW * 0.18, -ARROW * 2, ARROW * 0.36, ARROW * 1.05);
    this.dots = scene.add.graphics().setScrollFactor(0).setDepth(depth).setVisible(false);
    register(this.ring);
    register(this.arrow);
    register(this.dots);
  }

  /** Glow round a button at a screen point, this big. */
  glowButton(at: ScreenPoint, radius: number): void {
    const breath = this.breath();
    this.ring
      .setPosition(at.x, at.y)
      .setRadius(radius)
      .setScale(1 + RING_GROW * breath)
      .setAlpha(0.55 + 0.45 * (1 - breath))
      .setVisible(true);
    this.arrow.setVisible(false);
    this.dots.setVisible(false);
  }

  /**
   * Point along a route: dots from her feet along the way, and the arrow at
   * the last square of it still on the screen.
   *
   * For a thing too far off to point at. A bearing from the middle of the
   * screen to a door fifty squares away is a line, and a line goes on past
   * the door to whatever is behind it — from the garden it pointed at the
   * store and at the enchanted forest beyond it equally, and a child who
   * knew the forest was that way read it as the forest. A trail is the
   * *way*, which is what she has to walk, and it turns with the path: down
   * the garden, out of the gate, round the square. The dots are the trail
   * the game already draws for "too far", in the guide's own colour.
   */
  pointAlong(trail: readonly ScreenPoint[], end: ScreenPoint): void {
    this.trailLength = trail.length;
    this.dots.clear();
    this.dots.fillStyle(GUIDE_HEX, 0.9);
    this.dots.lineStyle(1, GUIDE_GLOW_HEX, 0.6);
    for (const at of trail) {
      this.dots.fillCircle(at.x, at.y - DOT_LIFT, DOT);
      this.dots.strokeCircle(at.x, at.y - DOT_LIFT, DOT);
    }
    this.dots.setVisible(true);
    this.pointAt(end);
  }

  /**
   * Point at a thing on screen — or, if it is off it, at where it is.
   *
   * `at` is where the thing stands: its feet, or the middle of a square.
   * The arrow hangs over it, tip down, and bobs.
   */
  pointAt(at: ScreenPoint): void {
    const { width, height } = this.scene.scale;
    const onScreen = at.x >= 0 && at.x <= width && at.y >= 0 && at.y <= height;
    if (onScreen) {
      this.arrow
        .setPosition(at.x, at.y - LIFT + BOB * this.breath())
        .setRotation(0)
        .setVisible(true);
    } else {
      // From the middle of the screen towards the thing, stopped just inside
      // the edge it would leave by. The tip leads.
      const cx = width / 2;
      const cy = height / 2;
      const dx = at.x - cx;
      const dy = at.y - cy;
      const scale = Math.min(
        (width / 2 - INSET) / Math.max(Math.abs(dx), 1),
        (height / 2 - INSET) / Math.max(Math.abs(dy), 1),
      );
      const angle = Math.atan2(dy, dx);
      const reach = BOB * this.breath();
      this.arrow
        .setPosition(
          cx + dx * scale + Math.cos(angle) * reach,
          cy + dy * scale + Math.sin(angle) * reach,
        )
        // The shape points down (+y); turn it to point along the angle.
        .setRotation(angle - Math.PI / 2)
        .setVisible(true);
    }
    this.ring.setVisible(false);
  }

  hide(): void {
    this.ring.setVisible(false);
    this.arrow.setVisible(false);
    this.dots.setVisible(false);
  }

  /** Where the marks are, for a script: a mark that breathes is the one thing a screenshot cannot settle. */
  showing(): { ring: ScreenPoint | null; arrow: ScreenPoint | null; trail: number } {
    return {
      ring: this.ring.visible ? { x: this.ring.x, y: this.ring.y } : null,
      arrow: this.arrow.visible ? { x: this.arrow.x, y: this.arrow.y } : null,
      // How many dots are down. A count rather than the points: what a
      // scenario asks is whether the way is still being shown, and the
      // dots move with the camera on every frame she walks.
      trail: this.dots.visible ? this.trailLength : 0,
    };
  }

  /** Take the dots away, for an arrow that is not at the end of a trail. */
  clearTrail(): void {
    this.dots.setVisible(false);
  }

  destroy(): void {
    this.ring.destroy();
    this.arrow.destroy();
    this.dots.destroy();
  }

  /** A nought-to-one that goes up and comes back. */
  private breath(): number {
    return 0.5 + 0.5 * Math.sin((this.scene.time.now / BREATH_MS) * Math.PI * 2);
  }
}
