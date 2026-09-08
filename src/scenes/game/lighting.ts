// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * Night, and the holes in it.
 *
 * Night used to be one flat sheet of navy over everything, and playtesting
 * said the obvious: you cannot see. The fix is not a paler sheet — a night
 * you can read at a glance is not night — but holes in it. What the player
 * carries, and what is burning nearby, is cut back out of the dark.
 *
 * Split out of `GameScene` because it is one subject with its own state —
 * the tint, the dusk it eases toward, and a halo per thing that burns —
 * and because it repaints every frame, which is where a habit of doing
 * the same sums for the same answer costs the most. The scene keeps what
 * only it knows (where she is, whether she is indoors, what the room's
 * flame is doing, which houses have windows) and hands it over through
 * `LightHost`, as closures, because every one of those answers changes.
 *
 * The mask is built here rather than drawn by the asset generator, and that
 * is deliberate: a soft radial falloff is not pixel art and cannot be, since
 * the generator's canvas is indexed and has no partial alpha. It is the same
 * kind of thing as the tint itself — a colour with an alpha ramp — so it is
 * made the same way, in code.
 */

import Phaser from "phaser";
import { windowBrightness } from "../../world/houses";
import { LightKind, type RoomLight, lightBreath, roomLights } from "../../world/interiors";
import type { InteriorSidecar } from "../../world/spriteSidecar";
import { MAX_NIGHT_ALPHA, NIGHT_TINT_COLOR } from "../../world/time";
import { type GridPoint, type ScreenPoint, TILE_SIZE } from "../../world/topdown";

const LIGHT_TEXTURE = "light-mask";
const LIGHT_TEXTURE_RADIUS = 128;
const LIGHT_RINGS = 32;
/** How far each kind of light reaches, in screen pixels at the world zoom. */
const PLAYER_LIGHT_RADIUS = 120;
const LAMP_LIGHT_RADIUS = 150;
/** The warm halo a flame throws. */
const LAMP_GLOW_COLOR = 0xffb347;
const LAMP_GLOW_ALPHA = 0.62;
/**
 * The fire in a cottage, once it is dark enough to matter.
 *
 * Smaller than a lamp and redder. A lamp is hung to light a path and throws
 * its light evenly for some way; a fire is in a box against a wall, so it
 * reaches the hearthrug and not the far corner.
 */
const HEARTH_LIGHT_RADIUS = 118;
const HEARTH_GLOW_COLOR = 0xff8a3c;
const HEARTH_GLOW_ALPHA = 0.72;
/**
 * How much the light moves as the flame does.
 *
 * Taken from the room's own animation frame rather than from the clock. The
 * fire is eight frames at `BUILDING_ANIM_FPS`, and a glow pulsing at any
 * other rate beats against it — two flickers out of step, which reads as a
 * fault rather than as firelight.
 */
const HEARTH_FLICKER = 0.18;
/**
 * The great tree, while it is still asking for something.
 *
 * Wide and faint: it is a canopy catching light rather than a lamp under
 * one, so it is nearly the size of the crown and never bright enough to
 * flatten the leaves under it. Four seconds to a breath, slower than
 * anything else here — a fire flickers and an orb breathes, and this is a
 * tree, and it is asking rather than burning.
 */
const TREE_LIGHT_RADIUS = 92;
const TREE_GLOW_COLOR = 0xbfffdd;
const TREE_GLOW_ALPHA = 0.34;
const TREE_BREATH_MS = 4000;
const TREE_BREATH = 0.55;
/** How far above the anchor the crown is, in screen pixels. */
const TREE_GLOW_RISE = 96;
/**
 * The other three lights a room can have, and how each behaves.
 *
 * Radius, colour and how much it moves. A shop's lantern is a flame behind
 * glass, so it is warm and it wavers a little; the school's tube is cold and
 * does not move at all, because nothing electric does; the tower's orbs are
 * the coldest thing in the game and breathe slowly, which is the only thing
 * here that says *magic* without a word.
 */
const ROOM_LIGHTS: Record<
  string,
  { radius: number; color: number; alpha: number; move: number; period: number }
> = {
  [LightKind.Lamp]: { radius: 96, color: 0xffb257, alpha: 0.66, move: 0.08, period: 900 },
  [LightKind.Electric]: { radius: 132, color: 0xdfe8ff, alpha: 0.6, move: 0, period: 0 },
  [LightKind.Orb]: { radius: 104, color: 0x9fd0ff, alpha: 0.7, move: 0.3, period: 2600 },
};
/** What the player carries: paler and smaller, so a lamp is still worth having. */
const PLAYER_GLOW_COLOR = 0xffe6b0;
const PLAYER_GLOW_ALPHA = 0.5;
/**
 * A lit window, seen from the road.
 *
 * Sized off the pane rather than picked: a window is nine pixels square, and
 * this is a halo about as wide again around it. The first try was half again
 * as big, which is fine on a cottage — two windows either side of a door,
 * far apart — and wrong on a townhouse, where four of them go up the front
 * fifteen pixels apart and the glows ran together into one white column. A
 * house should read as *windows*, not as a lit shaft.
 *
 * The colour is the hearth's, because it is the same fire: a house lights up
 * from the inside, which is why only the houses with a fireplace light at
 * all.
 */
const WINDOW_PANE_PX = 9;
export const WINDOW_GLOW_COLOR = 0xffb257;
const WINDOW_GLOW_ALPHA = 0.78;
/**
 * How dark the enchanted forest is at its darkest hour of the day: noon.
 *
 * Below the night's own maximum, so night in the wood is still visibly
 * darker than day in it — a place with no day and no night would read as a
 * rendering fault rather than as somewhere strange.
 */
const GROVE_DUSK_ALPHA = 0.3;
/** The tint the wood's own shade leans toward: a deep, cold green. */
const GROVE_TINT_COLOR = 0x0d2418;
/**
 * How long the dusk takes to settle when it changes, in milliseconds.
 *
 * A real duration, because the step below is linear and signed. It was an
 * exponential approach first — `dusk += (wanted - dusk) * delta / MS` — which
 * is the shape a tween usually wants and the wrong one for a constant with
 * this name: it reaches 95% at about three times the number written here, so
 * the comment would have been out by a factor of three and the crossfade a
 * slow creep rather than a transition.
 */
const DUSK_FADE_MS = 900;

/** The tint colour at a given depth of grove-dusk: night, leaning green. */
function mixTint(dusk: number): number {
  const t = Math.max(0, Math.min(1, dusk));
  const lerp = (from: number, to: number, shift: number) =>
    Math.round(((from >> shift) & 0xff) * (1 - t) + ((to >> shift) & 0xff) * t);
  return (
    (lerp(NIGHT_TINT_COLOR, GROVE_TINT_COLOR, 16) << 16) |
    (lerp(NIGHT_TINT_COLOR, GROVE_TINT_COLOR, 8) << 8) |
    lerp(NIGHT_TINT_COLOR, GROVE_TINT_COLOR, 0)
  );
}

/** The middle of a window in world pixels, and the halo over it. */
export interface LitWindow {
  readonly at: { x: number; y: number };
  readonly glow: Phaser.GameObjects.Image;
}

/** What the lights need from the scene, read fresh each frame. */
export interface LightHost {
  /** Part of the interface: drawn at 1:1 by the UI camera only — see `GameScene.ui`. */
  readonly ui: <T extends Phaser.GameObjects.GameObject>(object: T) => T;
  /** Where a tile's feet land on screen, through whatever the camera is doing. */
  readonly screenOf: (col: number, row: number) => ScreenPoint;
  /** A point in the world, in screen pixels. */
  readonly screenOfPoint: (worldX: number, worldY: number) => ScreenPoint;
  /** The world pixel the grid's top-left is drawn at: part of what `screenOf` answers. */
  readonly originX: () => number;
  readonly originY: () => number;
  /** The player's sprite, in world pixels. */
  readonly player: () => { x: number; y: number };
  /** Whether she is in a room. The tint still applies indoors; the tree and the windows do not. */
  readonly indoors: () => boolean;
  /** The flame whose animation frame the hearths flicker to, if the room has one. */
  readonly flame: () => Phaser.GameObjects.Sprite | null | undefined;
  /** How deep the old wood's dusk should be where she stands. */
  readonly duskWanted: () => number;
  /** The great tree's cell while it is still asking for something, else null. */
  readonly tree: () => GridPoint | null;
  /** Every building, for its windows and its moment in the dusk. */
  readonly buildings: () => readonly { windows: readonly LitWindow[]; lightsAt: number }[];
}

export class Lighting {
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private playerGlow!: Phaser.GameObjects.Image;
  /** Every lamp burning in the world, so the dark can be cut back around them. */
  private readonly lamps = new Map<string, GridPoint>();
  /**
   * A halo per lamp, keyed by its tile.
   *
   * Keyed rather than kept in a list beside `lamps`: the first version pushed
   * and popped, so picking up one lamp of two put out the *last* one placed
   * instead of the one in your hand.
   */
  private readonly lampGlows = new Map<string, Phaser.GameObjects.Image>();
  /**
   * A halo over every fireplace in the room she is standing in.
   *
   * Kept apart from `lampGlows` rather than filed as a lamp at a tile. The
   * lamps are a fact about the world — the astronomer counts them, the
   * player carries them about — and a hearth is a fact about a picture that
   * is on screen for as long as somebody is standing in it.
   *
   * **A list, because a stove is furniture and a child may own several.**
   * It was one cell and one halo, which was right while a fireplace was
   * built into the wall and there was exactly one. Reported from a
   * playtest: only one stove per house lights up. Only one could — the
   * routine that lit a stove put out the last one first, so a room with
   * three of them drew three stoves and one fire.
   */
  private hearths: { cell: GridPoint; glow: Phaser.GameObjects.Image }[] = [];
  /**
   * The lamps, tubes and orbs in whatever room is on screen.
   *
   * Beside the hearth rather than in with it, because the hearth's flicker
   * comes from the room's own animation frame and these have no frames to
   * read — the generator draws them still and the movement is here. Made
   * with the room and destroyed with it, like the hearth.
   */
  private roomGlows: { light: RoomLight; glow: Phaser.GameObjects.Image }[] = [];
  /**
   * The great tree's halo, while it still wants something.
   *
   * Additive over everything, unlike the night lights, because a tree that
   * only glowed after dark would be a tree that asked for nothing all
   * morning.
   */
  private treeGlow?: Phaser.GameObjects.Image;
  /** How deep the old wood's dusk is right now, eased toward where she is. */
  private duskNow = 0;
  /** The timestamp the dusk was last stepped at, for a real-time crossfade. */
  private duskAt: number | null = null;
  /**
   * What the lamp halos were last placed from, so the next frame can tell
   * whether they would land anywhere different.
   *
   * A lamp is a fact about the world and does not move, so where its halo
   * goes is a function of the camera's settled view and zoom, the origin
   * the grid is drawn from, and how dark it is — and on nearly every frame
   * all of those are what they were. The village is the one place with
   * lamps and the one place with the most on screen, which made
   * repositioning every halo every frame the steadiest of the small costs
   * in a scene that is paid for by the frame. Lighting a lamp counts as a
   * change, because its halo is born hidden and has to be placed once.
   */
  private lampsPlaced: {
    strength: number;
    viewX: number;
    viewY: number;
    zoom: number;
    originX: number;
    originY: number;
    lit: number;
  } | null = null;
  /** How many lamps have ever been lit; part of what `lampsPlaced` is keyed on. */
  private lampsLit = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    /** Where the tint sits in the scene's depth order, and the zoom every radius is quoted at. */
    private readonly at: { readonly tintDepth: number; readonly worldZoom: number },
    private readonly host: LightHost,
  ) {}

  // --- Dev seams ---------------------------------------------------------

  /** How deep the old wood's dusk is right now. */
  get dusk(): number {
    return this.duskNow;
  }

  /** How dark the tint over the world is right now. */
  get tintAlpha(): number {
    return this.nightOverlay?.fillAlpha ?? 0;
  }

  /** Every fire alight in the room she is in, and how brightly. */
  litHearths(): { col: number; row: number; alpha: number }[] {
    return this.hearths
      .filter(({ glow }) => glow.visible)
      .map(({ cell, glow }) => ({ col: cell.col, row: cell.row, alpha: glow.alpha }));
  }

  // --- Making ------------------------------------------------------------

  /**
   * A soft disc, built once and used as the shape of every light.
   *
   * Concentric circles rather than a gradient fill, because Phaser's shapes
   * have no radial gradient and this is the cheapest thing that reads as
   * one: thirty-two rings is smooth enough that nothing bands at this size.
   */
  makeLightMask(): void {
    if (this.scene.textures.exists(LIGHT_TEXTURE)) return;
    const size = LIGHT_TEXTURE_RADIUS * 2;
    const paint = this.scene.make.graphics({ x: 0, y: 0 }, false);
    for (let ring = LIGHT_RINGS; ring > 0; ring--) {
      const t = ring / LIGHT_RINGS;
      // Squared falloff: light thins out fast at the edge, which is what
      // stops the hole reading as a spotlight with a hard rim.
      paint.fillStyle(0xffffff, (1 - t) ** 2 * 0.14 + 0.02);
      paint.fillCircle(LIGHT_TEXTURE_RADIUS, LIGHT_TEXTURE_RADIUS, LIGHT_TEXTURE_RADIUS * t);
    }
    paint.generateTexture(LIGHT_TEXTURE, size, size);
    paint.destroy();
  }

  /** The sheet of night over the screen, and the light the player carries over it. */
  layNight(): void {
    this.nightOverlay = this.host.ui(
      this.scene.add
        .rectangle(0, 0, this.scene.scale.width, this.scene.scale.height, NIGHT_TINT_COLOR, 0)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(this.at.tintDepth),
    );
    // The light the player carries, over the tint rather than cut out of it.
    this.playerGlow = this.host.ui(
      this.scene.add
        .image(0, 0, LIGHT_TEXTURE)
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(this.at.tintDepth + 1)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(PLAYER_GLOW_COLOR)
        .setVisible(false),
    );
  }

  /** The great tree's halo, made once the world is up. */
  lightTree(): void {
    this.treeGlow = this.newGlow(TREE_GLOW_COLOR);
  }

  /** The sheet is the size of the screen, whatever that is now. */
  resize(width: number, height: number): void {
    this.nightOverlay?.setSize(width, height);
  }

  /** One halo, additive over the night tint and hidden until there is one. */
  newGlow(color: number): Phaser.GameObjects.Image {
    return this.host.ui(
      this.scene.add
        .image(0, 0, LIGHT_TEXTURE)
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(this.at.tintDepth + 1)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(color)
        .setVisible(false),
    );
  }

  // --- Painting ----------------------------------------------------------

  /**
   * How much of the old wood's own dusk is over the player, eased.
   *
   * The wood is never fully light. `duskOver` already softens the boundary
   * across the ground, and this softens it across *time* — which is the one
   * case the spatial ramp cannot cover, because a portal sets you down in
   * the middle of the wood with no walk in. Without it, arriving would snap
   * the whole screen a third darker in a single frame.
   */
  settleDusk(time: number): number {
    // Measured off the frame's own timestamp rather than off Phaser's
    // `delta`, which is smoothed toward the target frame time and clamped:
    // in the wood, where the frame rate is a third of the target, `delta`
    // still reports about sixteen milliseconds, and the crossfade took the
    // best part of three seconds instead of the nine-tenths written above.
    // Measured in the browser: 2,888 ms before, 880 ms after.
    const since = this.duskAt === null ? 0 : Math.min(200, time - this.duskAt);
    this.duskAt = time;
    const wanted = this.host.duskWanted();
    const step = since / DUSK_FADE_MS;
    // Signed and clamped to the target rather than eased toward it: a linear
    // step takes exactly DUSK_FADE_MS to cross the whole range whatever the
    // frame rate, which is what the constant claims and what a crossfade
    // has to be to be worth writing down.
    if (wanted > this.duskNow) this.duskNow = Math.min(wanted, this.duskNow + step);
    else this.duskNow = Math.max(wanted, this.duskNow - step);
    return this.duskNow;
  }

  /**
   * How much of a light's reach to draw, given where the camera is.
   *
   * Every radius in this file is quoted "in screen pixels at the world
   * zoom", and until the array spell started pulling the camera out that was
   * a distinction without a difference — the zoom never moved. It moves now,
   * and a radius left in raw screen pixels would light twice the floor at
   * half the zoom: a lamp in a cottage at night would visibly swell the
   * moment a child armed the times rune.
   *
   * So the radii mean what they always said they meant, and this is the
   * factor that keeps them meaning it: a light covers the same *ground*
   * whatever the camera is doing.
   */
  private get lightScale(): number {
    return this.scene.cameras.main.zoom / this.at.worldZoom;
  }

  /**
   * Lay the night over the world, and the lights over the night.
   *
   * The lights are drawn *additively on top of* the tint rather than erased
   * out of it. Erasing is what this wants to mean — a lamp should take the
   * dark away — and a render texture can do exactly that, which is how it
   * was written first. That also went wrong in a way worth recording: with
   * `fill` and `erase` both running every frame, the sheet came out blank
   * within a few seconds and night simply stopped happening as the player
   * walked. Adding warm light to a cold sheet reads the same to the eye,
   * costs one sprite per source, and cannot get out of step with itself.
   *
   * The time of day over the world, and the old wood's dusk under it: a
   * floor rather than a second overlay. Two tinted rectangles multiply into
   * a colour neither of them is, and at noon in the grove that came out as
   * a blue wash rather than as shade. One tint, taking whichever of the two
   * is deeper, and its *colour* leaning green as the dusk rises — night in
   * a wood is not the same colour as night over a field.
   *
   * Everything that glows reads its strength off the result, so the grove's
   * mushrooms are lit at noon. That is the whole point of them.
   */
  paintNight(nightAlpha: number, dusk: number): void {
    const alpha = Math.max(nightAlpha, GROVE_DUSK_ALPHA * dusk);
    // Hidden rather than merely transparent. A rectangle at alpha zero is
    // still a screen-sized quad handed to the renderer every frame, and by
    // day there are two thirds of a day's worth of them.
    this.nightOverlay?.setFillStyle(mixTint(dusk), alpha).setVisible(alpha > 0);
    const strength = alpha / MAX_NIGHT_ALPHA;
    const player = this.playerGlow;
    player?.setVisible(alpha > 0);
    if (player && alpha > 0) {
      // From the sprite, not from the tile she is booked as standing on. A
      // step takes a couple of hundred milliseconds and the light was being
      // placed on whole tiles, so it jumped a tile at a time while she walked
      // smoothly underneath it. Same reasoning as the depth sort just below
      // the clock: follow the sprite's own position and it stays right
      // part-way through a step.
      const her = this.host.player();
      const at = this.host.screenOfPoint(her.x, her.y - TILE_SIZE / 2);
      player
        .setPosition(at.x, at.y)
        .setDisplaySize(
          PLAYER_LIGHT_RADIUS * 2 * this.lightScale,
          PLAYER_LIGHT_RADIUS * 2 * this.lightScale,
        )
        .setAlpha(strength * PLAYER_GLOW_ALPHA);
    }
    this.paintLamps(alpha, strength);
    this.paintTree();
    this.paintHearth(strength);
    this.paintRoomLights(strength);
    this.paintWindows(strength);
  }

  /** The lamp posts' halos — placed again only when something they are placed from has moved. */
  private paintLamps(alpha: number, strength: number): void {
    const camera = this.scene.cameras.main;
    const view = camera.worldView;
    const placed = this.lampsPlaced;
    const originX = this.host.originX();
    const originY = this.host.originY();
    if (
      placed &&
      placed.strength === strength &&
      placed.viewX === view.x &&
      placed.viewY === view.y &&
      placed.zoom === camera.zoom &&
      placed.originX === originX &&
      placed.originY === originY &&
      placed.lit === this.lampsLit
    ) {
      return;
    }
    for (const [key, glow] of this.lampGlows) {
      const cell = this.lamps.get(key);
      glow.setVisible(cell !== undefined && alpha > 0);
      if (!cell || alpha <= 0) continue;
      const at = this.host.screenOf(cell.col, cell.row);
      glow
        .setPosition(at.x, at.y - TILE_SIZE)
        .setDisplaySize(
          LAMP_LIGHT_RADIUS * 2 * this.lightScale,
          LAMP_LIGHT_RADIUS * 2 * this.lightScale,
        )
        .setAlpha(strength * LAMP_GLOW_ALPHA);
    }
    this.lampsPlaced = {
      strength,
      viewX: view.x,
      viewY: view.y,
      zoom: camera.zoom,
      originX,
      originY,
      lit: this.lampsLit,
    };
  }

  /**
   * The great tree, breathing while it still wants something.
   *
   * Slower than anything else that pulses here — a fire flickers, an orb
   * breathes at two and a half seconds, and this takes four. It is a tree,
   * and it is asking rather than burning.
   *
   * Drawn over the crown rather than the trunk: the crown is the part of it
   * anybody looks at, and a glow at the foot would light the grass instead
   * of the tree.
   */
  private paintTree(): void {
    const glow = this.treeGlow;
    if (!glow) return;
    const tree = this.host.tree();
    if (!tree) {
      glow.setVisible(false);
      return;
    }
    const at = this.host.screenOf(tree.col + 1, tree.row);
    glow
      .setVisible(true)
      .setPosition(at.x, at.y - TREE_GLOW_RISE)
      .setDisplaySize(
        TREE_LIGHT_RADIUS * 2 * this.lightScale,
        TREE_LIGHT_RADIUS * 2 * this.lightScale,
      )
      .setAlpha(TREE_GLOW_ALPHA * lightBreath(this.scene.time.now, TREE_BREATH_MS, TREE_BREATH));
  }

  /**
   * The fire in a cottage, throwing light once the room goes dark.
   *
   * The room already had a fire — eight frames of it, burning at every hour
   * of the day — and at night it was the darkest thing in the room, while a
   * lamp on the plaza outside lit the ground round it. A fire that gives no
   * light is a picture of a fire.
   *
   * Half a tile up from the cell's feet, which puts it on the flame: the
   * hearth is set into the north wall, so the fire sits above the floor line
   * rather than on it. Measured off the room on screen rather than reasoned
   * about — it is the one number in here no test can check.
   *
   * The flicker comes from the room sprite's own frame, so the light moves
   * when the flame does. See `HEARTH_FLICKER`.
   */
  private paintHearth(strength: number): void {
    // The flame that drives the flicker. In a room that is one animated
    // picture it is the picture; in a room assembled from parts it is the
    // fireplace, which is the only piece that moves — and a RenderTexture
    // has no `anims` at all, which is what asking the wrong one cost.
    const flame = this.host.flame();
    const frames = flame?.anims?.currentAnim?.frames.length ?? 1;
    const index = flame?.anims?.currentFrame?.index ?? 1;
    const phase = frames > 1 ? ((index - 1) % frames) / frames : 0;
    for (const [at, { cell, glow }] of this.hearths.entries()) {
      glow.setVisible(strength > 0);
      if (strength <= 0) continue;
      const where = this.host.screenOf(cell.col, cell.row);
      // Each fire a third of a beat behind the one before it. They are all
      // driven by the same animation, so left alone a room of stoves would
      // pulse in unison — which reads as the *room* dimming rather than as
      // several fires burning.
      const own = phase + (at % 3) / 3;
      const flicker = 1 - (HEARTH_FLICKER * (1 - Math.cos(own * Math.PI * 2))) / 2;
      glow
        .setPosition(where.x, where.y - TILE_SIZE)
        .setDisplaySize(
          HEARTH_LIGHT_RADIUS * 2 * this.lightScale,
          HEARTH_LIGHT_RADIUS * 2 * this.lightScale,
        )
        .setAlpha(strength * HEARTH_GLOW_ALPHA * flicker);
    }
  }

  /**
   * Light the village's windows as the evening comes on.
   *
   * Not all at once. Each house has its own moment in the dusk, stable per
   * world — a square of windows coming on together reads as a switch being
   * thrown rather than as evening — and every one of them is burning by the
   * time the night is fully down.
   *
   * Off-screen ones are hidden rather than placed: the glow does not scroll,
   * so a house behind the camera would otherwise put its light wherever its
   * world position happened to project to.
   */
  private paintWindows(darkness: number): void {
    const { width, height } = this.scene.scale;
    const indoors = this.host.indoors();
    const radius = WINDOW_PANE_PX * this.at.worldZoom;
    for (const building of this.host.buildings()) {
      if (building.windows.length === 0) continue;
      const lit = indoors ? 0 : windowBrightness(darkness, building.lightsAt);
      for (const { at, glow } of building.windows) {
        if (lit <= 0) {
          glow.setVisible(false);
          continue;
        }
        const on = this.host.screenOfPoint(at.x, at.y);
        const near =
          on.x > -radius && on.y > -radius && on.x < width + radius && on.y < height + radius;
        glow.setVisible(near);
        if (!near) continue;
        glow
          .setPosition(on.x, on.y)
          .setDisplaySize(radius * 2 * this.lightScale, radius * 2 * this.lightScale)
          .setAlpha(lit * WINDOW_GLOW_ALPHA);
      }
    }
  }

  /**
   * The lamps, tubes and orbs, once it is dark enough for them to matter.
   *
   * Same machinery as the hearth and the lamp posts — an additive halo over
   * the tint, growing with the darkness — and the differences between them
   * are the whole point: how big, how cold, and how much they move.
   *
   * The movement runs off the clock rather than off an animation frame,
   * because the generator draws all three still. That is deliberate: a lamp
   * that is on is a lamp that is on, and moving the *light* over an orb
   * instead of the orb costs nothing and keeps three of the seven rooms at a
   * single frame rather than eight nearly identical ones.
   *
   * Half a tile up from the cell's feet, as the hearth is: a lantern and a
   * tube are mounted on the north wall, and an orb floats.
   */
  private paintRoomLights(strength: number): void {
    if (this.roomGlows.length === 0) return;
    const now = this.scene.time.now;
    for (const { light, glow } of this.roomGlows) {
      glow.setVisible(strength > 0);
      if (strength <= 0) continue;
      const how = ROOM_LIGHTS[light.kind];
      if (!how) continue;
      const breath = lightBreath(now, how.period, how.move);
      const at = this.host.screenOf(light.cell.col, light.cell.row);
      glow
        .setPosition(at.x, at.y - TILE_SIZE)
        .setDisplaySize(how.radius * 2, how.radius * 2)
        .setAlpha(strength * how.alpha * breath);
    }
  }

  // --- Lighting and snuffing --------------------------------------------

  /**
   * One more fire, at a cell the caller has worked out.
   *
   * **Adds rather than replaces**, which is the whole of the stove fix. It
   * used to snuff the room first, on the argument that `paintPlan` runs once
   * per square built and nine squares would otherwise leave nine orphaned
   * glows. That argument is sound and the snuff was in the wrong place for
   * it: the routine that redraws the furniture already clears the room once
   * before its loop, so putting the last fire out on the way to lighting the
   * next only ever meant a room could have one.
   */
  lightHearthAt(cell: GridPoint): void {
    this.hearths.push({ cell, glow: this.newGlow(HEARTH_GLOW_COLOR) });
  }

  /**
   * Light whatever the room is lit by: a fire, lanterns, tubes, or orbs.
   *
   * Read off the room's furniture, so a room the generator relights needs
   * nothing here — and a kind this game has not learned yet is dropped by
   * `roomLights` rather than drawn in some default colour.
   */
  lightHearth(sidecar: InteriorSidecar): void {
    this.snuffHearth();
    for (const light of roomLights(sidecar)) {
      if (light.kind === LightKind.Fire) {
        this.lightHearthAt(light.cell);
        continue;
      }
      const how = ROOM_LIGHTS[light.kind];
      if (!how) continue;
      this.roomGlows.push({ light, glow: this.newGlow(how.color) });
    }
  }

  /**
   * And put it out on the way out of the door.
   *
   * Called wherever the room sprite is torn down rather than from a handler
   * of its own: the glow does not scroll and is placed from `screenOf`, so
   * one left behind would be a patch of firelight hanging in the middle of
   * the screen over open country.
   */
  snuffHearth(): void {
    for (const { glow } of this.hearths) glow.destroy();
    this.hearths = [];
    for (const { glow } of this.roomGlows) glow.destroy();
    this.roomGlows = [];
  }

  /** Remember a lamp, and give it the halo that says it is lit. */
  lightLamp(col: number, row: number): void {
    const key = `${col},${row}`;
    if (this.lampGlows.has(key)) return;
    this.lamps.set(key, { col, row });
    this.lampGlows.set(key, this.newGlow(LAMP_GLOW_COLOR));
    this.lampsLit++;
  }

  /** A lamp picked back up stops burning, and its halo goes with it. */
  snuffLamp(col: number, row: number): void {
    const key = `${col},${row}`;
    if (!this.lamps.delete(key)) return;
    this.lampGlows.get(key)?.destroy();
    this.lampGlows.delete(key);
  }
}
