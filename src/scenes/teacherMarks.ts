// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import { type Spell, spellTaughtBy } from "../spells/spellbook";
import { GUIDE_GLOW_HEX, GUIDE_HEX } from "../ui/GuideMarks";
import { uiTextureKey } from "../ui/assets";
import { RUNE_OF } from "../ui/runes";
import type { GridPoint } from "../world/topdown";
import { depthFor } from "../world/topdown";

/**
 * The rune over a teacher's head, until it has been given.
 *
 * The second thing lifted out of `GameScene`, and the same shape as the
 * first: it owns some sprites, it is told where to put them, and it is told
 * nothing else. `where` hands it whoever is on screen and where their feet
 * are; whether that came from an npc walking a circuit, a shopkeeper standing
 * in a room or a tree that has never moved is the scene's business.
 *
 * **What it is not told.** Not the profile, not the dev seams — `owed` is a
 * question the caller answers. This class knows that a teacher with
 * something to give has a rune over them and how that rune breathes, and
 * that is all it knows.
 */

/** How big the mark is drawn, and how far over the feet it floats. */
const MARK = 22;
/**
 * Measured up from the *feet*, not down from the top of the sprite.
 *
 * A character's canvas is a good deal taller than the character and its
 * origin is its top left, so neither `y` nor `y - displayHeight` nor the
 * bottom edge is where a person stands — each of those put the rune a body's
 * length into the sky before this was worked out. `toFeet` is how everything
 * else in this game finds the ground.
 */
const LIFT = 28;
/** How faint it goes and how bright it comes back, and how long that takes. */
const DIM = 0.38;
const BRIGHT = 0.8;
const BEAT_MS = 900;
/**
 * How much bigger the pale copy behind the rune is drawn.
 *
 * The glow is a second copy of the same picture, filled pale and scaled up a
 * fraction, so what shows past the edges of the front one is an outline
 * that follows the shape exactly — a halo drawn for the rune it is under,
 * for free, without a second drawing to keep in step.
 */
const HALO = 1.14;

/**
 * Why the rune is *filled* cyan rather than tinted it.
 *
 * A playtest asked for these to match the tutorial's marks — "make the spell
 * runes blue on top of the teacher, same as the tutorial arrows" — and the
 * obvious way to do that is a tint. A tint multiplies, and the rune art is
 * gold: gold times cyan is a dark olive, which is neither the gold it was
 * nor the cyan it was asked to be. `setTintFill` replaces the colour outright
 * and keeps only the shape, which is what an arrow drawn in cyan already is.
 *
 * The runes survive being reduced to a silhouette because every one of them
 * is made of separated shapes — six dots, a bar between two dots, a cross —
 * rather than of shading. See `GuideMarks` for the two colours and for why
 * the pale one is what makes it read as lit rather than merely different.
 */

/** Somebody on screen who might have something to teach. */
export interface Standing {
  /** The part they play — `role ?? id`, which is what `TAUGHT_BY` names. */
  readonly part: string;
  /** Where their feet are, in world pixels. */
  readonly feet: GridPoint & { readonly x: number; readonly y: number };
  /**
   * A rune to draw whatever `part` teaches, for a mark that is not a person.
   *
   * The wood in the enchanted forest wears one: a child standing in front of
   * twelve squares of thicket has to be told the minus spell is what takes
   * them down, and a square is not somebody who can be asked. Given here, the
   * `owed` question is not asked at all — a square owes nothing and teaches
   * nothing, it is simply marked while it stands.
   */
  readonly rune?: string;
}

/** A rune and the pale copy behind it that makes it glow. */
interface Mark {
  readonly halo: Phaser.GameObjects.Image;
  readonly rune: Phaser.GameObjects.Image;
}

export class TeacherMarks {
  private readonly marks = new Map<string, Mark>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly place: <T extends Phaser.GameObjects.GameObject>(object: T) => T,
  ) {}

  /**
   * Draw a rune over everybody here who still owes one.
   *
   * Made once per teacher and moved, like the harbour's hulls: there are six
   * of them in a world and at most a couple on screen, and a mark built and
   * thrown away as a child walks past would be a stutter every time.
   */
  show(here: readonly Standing[], owed: (spell: Spell) => boolean): void {
    const shown = new Set<string>();
    const beat = DIM + (BRIGHT - DIM) * this.pulse();
    for (const who of here) {
      let rune = who.rune;
      if (!rune) {
        const spell = spellTaughtBy(who.part);
        if (!spell || !owed(spell)) continue;
        rune = RUNE_OF[spell];
      }
      shown.add(who.part);
      let mark = this.marks.get(who.part);
      if (!mark) {
        const draw = (size: number, hex: number) => {
          const image = this.place(
            this.scene.add
              .image(0, 0, uiTextureKey(rune as string))
              .setOrigin(0.5, 1)
              .setDisplaySize(size, size),
          );
          image.setTintFill(hex);
          return image;
        };
        // The halo first, so it is behind: two images at one depth are drawn
        // in the order they were made.
        mark = { halo: draw(MARK * HALO, GUIDE_GLOW_HEX), rune: draw(MARK, GUIDE_HEX) };
        this.marks.set(who.part, mark);
      }
      const depth = depthFor(who.feet.y) + 1;
      // The halo hangs a little lower so its foot lines up with the rune's:
      // both are drawn from the bottom edge, and the taller one would
      // otherwise stand on the rune's head rather than behind it.
      mark.halo
        .setPosition(who.feet.x, who.feet.y - LIFT + (MARK * (HALO - 1)) / 2)
        .setDepth(depth)
        .setAlpha(beat * 0.55)
        .setVisible(true);
      mark.rune
        .setPosition(who.feet.x, who.feet.y - LIFT)
        .setDepth(depth)
        .setAlpha(beat)
        .setVisible(true);
    }
    for (const [part, mark] of this.marks) {
      if (shown.has(part)) continue;
      mark.halo.setVisible(false);
      mark.rune.setVisible(false);
    }
  }

  /** Who currently has one up. A dev seam: a faint mark that breathes is the
   * one thing on screen a screenshot cannot settle. */
  showing(): string[] {
    return [...this.marks.entries()].filter(([, mark]) => mark.rune.visible).map(([part]) => part);
  }

  /** A nought-to-one that goes up and comes back, on a period in ms. */
  private pulse(): number {
    return 0.5 + 0.5 * Math.sin((this.scene.time.now / BEAT_MS) * Math.PI * 2);
  }
}
