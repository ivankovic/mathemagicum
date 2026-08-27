// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import { type Spell, spellTaughtBy } from "../spells/spellbook";
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

/** Somebody on screen who might have something to teach. */
export interface Standing {
  /** The part they play — `role ?? id`, which is what `TAUGHT_BY` names. */
  readonly part: string;
  /** Where their feet are, in world pixels. */
  readonly feet: GridPoint & { readonly x: number; readonly y: number };
}

export class TeacherMarks {
  private readonly marks = new Map<string, Phaser.GameObjects.Image>();

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
      const spell = spellTaughtBy(who.part);
      if (!spell || !owed(spell)) continue;
      const rune = RUNE_OF[spell];
      shown.add(who.part);
      let mark = this.marks.get(who.part);
      if (!mark) {
        mark = this.place(
          this.scene.add
            .image(0, 0, uiTextureKey(rune))
            .setOrigin(0.5, 1)
            .setDisplaySize(MARK, MARK),
        );
        this.marks.set(who.part, mark);
      }
      mark
        .setPosition(who.feet.x, who.feet.y - LIFT)
        .setDepth(depthFor(who.feet.y) + 1)
        .setAlpha(beat)
        .setVisible(true);
    }
    for (const [part, mark] of this.marks) {
      if (!shown.has(part)) mark.setVisible(false);
    }
  }

  /** Who currently has one up. A dev seam: a faint mark that breathes is the
   * one thing on screen a screenshot cannot settle. */
  showing(): string[] {
    return [...this.marks.entries()].filter(([, mark]) => mark.visible).map(([part]) => part);
  }

  /** A nought-to-one that goes up and comes back, on a period in ms. */
  private pulse(): number {
    return 0.5 + 0.5 * Math.sin((this.scene.time.now / BEAT_MS) * Math.PI * 2);
  }
}
