// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * The ground under the camera: which chunks of it are baked, which trees and
 * which sea are live, and when each is thrown away.
 *
 * Split out of `GameScene` because it is a self-contained cache with its own
 * invariants — three leases of different lengths over the same keys — and
 * the one piece of the scene that runs on every frame whether or not the
 * player is doing anything. Kept apart, the steady state (no chunk boundary
 * crossed since last frame) can be made to cost nothing, which it could not
 * while the visible rectangle was recomputed into fresh arrays and sets
 * sixty times a second.
 *
 * The scene keeps what it always did — the grid, the origin, the camera and
 * the sprite factory — and hands them over through `ChunkHost`, read
 * through closures because the scene swaps its grid and origin whenever a
 * door is walked through.
 */

import type Phaser from "phaser";
import {
  CHUNK_SIZE,
  type ChunkCoord,
  chunkKey,
  chunksCoveringTileRange,
  dualChunkScreenBounds,
  dualTileRange,
  dualTileToChunk,
} from "../../world/chunks";
import { CLIFF_ATLAS_KEY, cliffFrameFor, cornerLevelsFor } from "../../world/cliffAtlas";
import { DECK_SHEET_KEY } from "../../world/decking";
import type { WorldGrid } from "../../world/grid";
import { hasStep } from "../../world/levels";
import type { PlacedObject } from "../../world/objects";
import { sceneryKind } from "../../world/scenery";
import {
  DUAL_OFFSET,
  DUAL_ORIGIN,
  TERRAIN_ATLAS_KEY,
  type WaterFrames,
  cornerTerrainsFor,
  frameFor,
  touchesWater,
  variationFor,
  waveFrameFor,
} from "../../world/terrainAtlas";
import { type ScreenPoint, TILE_SIZE, gridToScreen } from "../../world/topdown";

export const CHUNK_DEPTH = -1000;
/**
 * The sea, under the ground.
 *
 * Not a typo. A tile that touches water is baked into its chunk with the
 * open water cut out of it and left transparent, so what shows through the
 * hole is whatever is behind the chunk — and what is behind the chunk is the
 * water, moving. See `stillCombo`.
 */
const WATER_DEPTH = CHUNK_DEPTH - 1;
/**
 * How long the sea holds each step of its cycle.
 *
 * Eight steps at this rate is a two-second swell, which is about the pace of
 * water in a harbour and slow enough that a screen full of it reads as calm
 * rather than as something demanding attention. The whole point of the world
 * is the arithmetic on top of it.
 */
const WAVE_STEP_MS = 250;
/**
 * How far past the screen the *ground* is kept drawn.
 *
 * A ring of chunks in every direction, so walking to the edge of the view
 * finds terrain already there rather than a chunk being redrawn under the
 * player's feet.
 */
const CHUNK_VIEW_MARGIN = 1;
/**
 * And how far past it the *trees* are, which is not at all.
 *
 * These were one number for a long time and it was the wrong shape. A
 * chunk's ground is a single texture — cheap to hold, expensive to redraw —
 * so a ring of them is worth having. A chunk's trees are hundreds of live
 * sprites, and a ring of chunks at a desktop's screen size is several times
 * more of them than are on screen: eight and a half thousand standing in a
 * village where a couple of thousand can be seen. Nothing is gained by
 * having a tree ready off screen; a tree costs nothing to make.
 */
const SCENERY_VIEW_MARGIN = 0;
/**
 * How far outside the view a tree is still drawn, in world pixels.
 *
 * Two tiles. A conifer is drawn several tiles taller than the square it
 * stands on, and what is tested is the square — so a tree whose feet are
 * just off the top of the screen still has its head on it.
 */
const SCENERY_CULL_MARGIN = TILE_SIZE * 2;
// Generous cache so panning back and forth doesn't constantly re-render —
// well above what's ever simultaneously visible on screen.
const CHUNK_CACHE_LIMIT = 60;

/** One tile of sea, and where it is — which is what decides its ripples. */
export interface WaterTile {
  image: Phaser.GameObjects.Image;
  col: number;
  row: number;
}

interface ActiveChunk {
  texture: Phaser.GameObjects.RenderTexture;
  lastUsedAt: number;
}

export interface TileRange {
  minCol: number;
  minRow: number;
  maxCol: number;
  maxRow: number;
}

/** What the streamer needs from the scene, read fresh each time because the scene changes all of it. */
export interface ChunkHost {
  /** The grid on screen: the world's, or the room's while indoors. */
  readonly grid: () => WorldGrid;
  /** The world pixel the grid's top-left is drawn at. */
  readonly originX: () => number;
  readonly originY: () => number;
  /** Put an object on the world camera and its layer — see `GameScene.world`. */
  readonly world: <T extends Phaser.GameObjects.GameObject>(object: T) => T;
  /** A tree or rock as a live sprite, animated and depth-sorted by the scene. */
  readonly spawnScenery: (object: PlacedObject) => Phaser.GameObjects.Sprite;
  /** Where a cell's feet are in world pixels. */
  readonly toFeet: (col: number, row: number) => ScreenPoint;
}

export class ChunkStreamer {
  private readonly activeChunks = new Map<string, ActiveChunk>();
  /**
   * The scenery of each chunk, spawned when its ground is drawn and thrown
   * away with it.
   *
   * Every tree used to be a live sprite from the moment the world was made:
   * thirteen thousand of them in a five-hundred-cell world, each with a sway
   * animation running, almost none of them on screen. That was survivable
   * while an object covered four tiles; it stopped being survivable when
   * they came down to one and a wood needed three times as many of them to
   * still look like a wood — measured at half the frame rate.
   *
   * Bucketed once at load, because the answer never changes: scenery is
   * placed by world generation and nothing moves it afterwards.
   */
  private readonly sceneryByChunk = new Map<string, PlacedObject[]>();
  private readonly liveScenery = new Map<string, Phaser.GameObjects.Sprite[]>();
  /**
   * The moving water under each on-screen chunk.
   *
   * Kept on the same short lease as the scenery rather than the long one the
   * chunk textures get, and for the same reason: this is hundreds of sprites,
   * cheap to remake and expensive to hold. A chunk's ground is one texture.
   */
  private readonly liveWater = new Map<string, WaterTile[]>();
  /** Which step of the swell the whole sea is on. */
  private wavePhase = 0;
  private frameCounter = 0;

  // How many variants the atlas ships per corner combination, read from the
  // loaded texture rather than hardcoded — see terrainAtlas.ts.
  private cliffVariations: ReadonlyMap<string, number> = new Map();
  private terrainVariations: ReadonlyMap<string, number> = new Map();
  private waterFrames: WaterFrames = { variations: 0, phases: 0 };
  private deckVariations = 1;

  /**
   * The chunk rectangle the last refresh settled on, so the next one can
   * tell whether anything has changed before it allocates a thing.
   *
   * `refreshVisibleChunks` runs every frame, and on nearly every frame the
   * camera has moved a few pixels within the same chunks: the same visible
   * set, the same on-screen set, nothing to activate and nothing to evict.
   * Building four corner objects, two arrays and two sets to find that out
   * was the steadiest source of garbage in the game. The rectangle is a
   * function of the grid, the origin, the view and the margins, and the
   * first three are compared by identity — a door swaps the grid — while
   * the view is boiled down to the first and last chunk it touches.
   * Anything that changes the caches behind the scene's back — a chunk
   * thrown away for a redraw, the scenery re-bucketed — marks it stale.
   */
  private settled: {
    grid: WorldGrid;
    originX: number;
    originY: number;
    startCol: number;
    startRow: number;
    endCol: number;
    endRow: number;
    keys: ReadonlySet<string>;
  } | null = null;
  /** When the last refresh ran, which is the last frame the settled chunks were seen. */
  private lastRefreshFrame = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly host: ChunkHost,
  ) {}

  /** One more frame has gone by. Counted whether or not the ground is refreshed. */
  tick(): void {
    this.frameCounter++;
  }

  /** How many frames the scene has run. */
  get frames(): number {
    return this.frameCounter;
  }

  /** Read from the loaded atlases rather than hardcoded — see `loadAssetMetadata`. */
  learnTerrain(
    terrainVariations: ReadonlyMap<string, number>,
    cliffVariations: ReadonlyMap<string, number>,
    waterFrames: WaterFrames,
  ): void {
    this.terrainVariations = terrainVariations;
    this.cliffVariations = cliffVariations;
    this.waterFrames = waterFrames;
  }

  /** How many planks there are to choose between. */
  learnDecking(variations: number): void {
    this.deckVariations = variations;
  }

  // --- Dev seams ---------------------------------------------------------

  /** Every tile of live sea, in chunk order. A fresh array: the seam sorts it. */
  waterTiles(): WaterTile[] {
    return [...this.liveWater.values()].flat();
  }

  /** Which step of the swell the sea is on. */
  get seaPhase(): number {
    return this.wavePhase;
  }

  /** How many trees and rocks are live sprites right now. */
  sceneryCount(): number {
    return [...this.liveScenery.values()].reduce((n, list) => n + list.length, 0);
  }

  /** Every chunk's scenery, live or not. */
  sceneryBuckets(): Iterable<readonly PlacedObject[]> {
    return this.sceneryByChunk.values();
  }

  /** The scenery of each chunk whose sprites are live. */
  liveSceneryBuckets(): (readonly PlacedObject[])[] {
    const buckets: (readonly PlacedObject[])[] = [];
    for (const key of this.liveScenery.keys()) buckets.push(this.sceneryByChunk.get(key) ?? []);
    return buckets;
  }

  // --- Chunked terrain rendering ------------------------------------

  /**
   * Make sure the chunks under the camera exist.
   *
   * `around` overrides where it looks, and the portal is why: the camera
   * follows the player, so the frame in which somebody is set down two
   * hundred cells away still has the *old* view on it — and asking that view
   * for chunks paints the ground they just left while the screen shows where
   * they arrived. The one frame of black that came out of it was the most
   * expensive-looking bug in the game.
   */
  refreshVisibleChunks(around?: ScreenPoint): void {
    const camera = this.scene.cameras.main;
    const seenWidth = camera.width / camera.zoom;
    const seenHeight = camera.height / camera.zoom;
    let viewX: number;
    let viewY: number;
    let viewWidth: number;
    let viewHeight: number;
    if (around) {
      viewX = around.x - seenWidth / 2;
      viewY = around.y - seenHeight / 2;
      viewWidth = seenWidth;
      viewHeight = seenHeight;
    } else {
      const view = camera.worldView;
      viewX = view.x;
      viewY = view.y;
      viewWidth = view.width;
      viewHeight = view.height;
    }
    const grid = this.host.grid();
    const originX = this.host.originX();
    const originY = this.host.originY();
    // The four corners of the view in tiles, which for an axis-aligned grid
    // is the two opposite ones: `screenToGrid` is a floor on each axis, and
    // a floor keeps its order. Written out rather than called so that the
    // frame that finds nothing to do has made nothing.
    const tiles = {
      minCol: Math.floor((viewX - originX) / TILE_SIZE),
      maxCol: Math.floor((viewX + viewWidth - originX) / TILE_SIZE),
      minRow: Math.floor((viewY - originY) / TILE_SIZE),
      maxRow: Math.floor((viewY + viewHeight - originY) / TILE_SIZE),
    };
    // The first and last chunk the view touches before any margin or clamp,
    // which is all `chunksCoveringTileRange` needs beyond the grid: the same
    // pair means the same visible ring and the same on-screen set.
    const startCol = Math.floor((tiles.minCol - 1 - DUAL_ORIGIN) / CHUNK_SIZE);
    const startRow = Math.floor((tiles.minRow - 1 - DUAL_ORIGIN) / CHUNK_SIZE);
    const endCol = Math.floor((tiles.maxCol - DUAL_ORIGIN) / CHUNK_SIZE);
    const endRow = Math.floor((tiles.maxRow - DUAL_ORIGIN) / CHUNK_SIZE);
    const settled = this.settled;
    if (
      settled &&
      settled.grid === grid &&
      settled.originX === originX &&
      settled.originY === originY &&
      settled.startCol === startCol &&
      settled.startRow === startRow &&
      settled.endCol === endCol &&
      settled.endRow === endRow
    ) {
      this.lastRefreshFrame = this.frameCounter;
      return;
    }
    // The chunks that were on screen through the skipped frames were last
    // *seen* on the frame of the last refresh, which is what their stamp
    // would say had every frame been walked; say so before the walk below
    // restamps the ones still in view, so that the eviction order is the
    // one it always was.
    if (settled) {
      for (const key of settled.keys) {
        const entry = this.activeChunks.get(key);
        if (entry) entry.lastUsedAt = this.lastRefreshFrame;
      }
    }
    this.lastRefreshFrame = this.frameCounter;

    const visible = chunksCoveringTileRange(tiles, grid.width, grid.height, CHUNK_VIEW_MARGIN);
    const visibleKeys = new Set(visible.map(chunkKey));
    // The same sum again with no ring round it: what the screen actually
    // covers. See SCENERY_VIEW_MARGIN.
    const onScreen = new Set(
      chunksCoveringTileRange(tiles, grid.width, grid.height, SCENERY_VIEW_MARGIN).map(chunkKey),
    );

    for (const chunk of visible) {
      const key = chunkKey(chunk);
      const entry = this.activeChunks.get(key);
      if (entry) {
        entry.texture.setVisible(true);
        entry.lastUsedAt = this.frameCounter;
      } else {
        this.activateChunk(chunk);
      }
      if (onScreen.has(key)) {
        this.spawnSceneryIn(key);
        this.spawnWaterIn(key, chunk);
      }
    }

    for (const [key, entry] of this.activeChunks) {
      if (!visibleKeys.has(key)) entry.texture.setVisible(false);
    }

    // Scenery lives only while its chunk is on screen, and the terrain cache
    // outlives it by a long way. They are cached apart because they cost
    // different things: a chunk's ground is one texture, cheap to keep and
    // expensive to redraw, so sixty of them are held against panning back and
    // forth. Its trees are hundreds of animating sprites, cheap to remake and
    // expensive to keep — sixty chunks of *those* came to ten thousand
    // sprites after a few portal jumps, none of them on screen.
    for (const key of [...this.liveScenery.keys()]) {
      if (!onScreen.has(key)) this.despawnSceneryIn(key);
    }
    for (const key of [...this.liveWater.keys()]) {
      if (!onScreen.has(key)) this.despawnWaterIn(key);
    }
    this.evictColdChunks(visibleKeys);
    this.settled = {
      grid,
      originX,
      originY,
      startCol,
      startRow,
      endCol,
      endRow,
      keys: visibleKeys,
    };
  }

  private activateChunk(chunk: ChunkCoord): void {
    const bounds = dualChunkScreenBounds(chunk);
    const minX = bounds.minX;
    const minY = bounds.minY;

    const texture = this.scene.add.renderTexture(
      this.host.originX() + minX,
      this.host.originY() + minY,
      bounds.maxX - minX,
      bounds.maxY - minY,
    );
    texture.setOrigin(0, 0);
    texture.setDepth(CHUNK_DEPTH);
    this.host.world(texture);

    // Buildings are standalone animated Sprites with their own depth sort
    // (see spawnBuildings), not baked into this RenderTexture — a building
    // rises above and overhangs its own footprint, which a flat tile stamped
    // into a chunk can't express, and has to sort against the player and
    // NPCs walking around it, which a static baked texture can't either.
    //
    // Terrain is now one draw per dual tile, full stop. The atlas ships a
    // finished tile for every corner-terrain combination, so there is no
    // base layer, no priority pass and no per-terrain mask — what used to be
    // a stack of up to 8 semi-transparent draws per tile (with the
    // compositing subtleties that came with it) is a single opaque one.
    //
    // beginDraw/batchDrawFrame/endDraw wraps the whole chunk in one GPU
    // flush (not stamp(), which is draw() under the hood — a full flush per
    // call). Even at one draw per tile that is CHUNK_SIZE^2 of them, and
    // stamp()-per-tile previously measured as an effectively unrecoverable
    // hang under software-rendered WebGL; Phaser's own docs call this batch
    // API out for exactly "large numbers of objects."
    const grid = this.host.grid();
    const range = dualTileRange(chunk);
    // The dual grid is only defined from DUAL_ORIGIN to one short of the
    // data grid's extent; a chunk at the world edge covers tiles past that,
    // which would draw a duplicate of the clamped edge outside the world.
    const minCol = Math.max(range.minCol, DUAL_ORIGIN);
    const minRow = Math.max(range.minRow, DUAL_ORIGIN);
    const maxCol = Math.min(range.maxCol, grid.width - 1);
    const maxRow = Math.min(range.maxRow, grid.height - 1);

    this.paintTiles(texture, { minCol, minRow, maxCol, maxRow }, minX, minY);

    this.activeChunks.set(chunkKey(chunk), { texture, lastUsedAt: this.frameCounter });
  }

  /**
   * Stamp a range of dual tiles into a texture.
   *
   * Pulled out of the chunk renderer because the portal wants the same
   * picture: a hole that showed anything other than what the ground actually
   * looks like there would be a lie about the place it is a hole into. One
   * loop, so the two can never disagree.
   *
   * `offsetX`/`offsetY` are the world pixel the texture's top-left sits at.
   */
  paintTiles(
    texture: Phaser.GameObjects.RenderTexture,
    range: TileRange,
    offsetX: number,
    offsetY: number,
  ): void {
    const grid = this.host.grid();
    texture.beginDraw();
    for (let dualRow = range.minRow; dualRow <= range.maxRow; dualRow++) {
      for (let dualCol = range.minCol; dualCol <= range.maxCol; dualCol++) {
        const corners = cornerTerrainsFor(grid, dualCol, dualRow);
        const p = gridToScreen(dualCol, dualRow);
        // A tile with a step in it is drawn from the cliff atlas instead of
        // the terrain one — the cliff tile *is* a complete tile, ground on
        // both sides included, so this is a choice of atlas rather than a
        // second layer over the first. Asked first and answered null for
        // almost every tile, since almost every tile is flat.
        const levels = cornerLevelsFor(grid, dualCol, dualRow);
        if (hasStep(levels)) {
          const cliff = cliffFrameFor(
            grid,
            corners,
            levels,
            dualCol,
            dualRow,
            this.cliffVariations,
          );
          if (cliff) {
            texture.batchDrawFrame(
              CLIFF_ATLAS_KEY,
              cliff,
              p.x + DUAL_OFFSET - offsetX,
              p.y + DUAL_OFFSET - offsetY,
            );
            continue;
          }
        }
        const frame = frameFor(corners, dualCol, dualRow, this.terrainVariations);
        if (!frame) continue;
        texture.batchDrawFrame(
          TERRAIN_ATLAS_KEY,
          frame,
          p.x + DUAL_OFFSET - offsetX,
          p.y + DUAL_OFFSET - offsetY,
        );
      }
    }
    // The planking, over the ground rather than blended into it — see
    // decking.ts for why it is not a terrain. Drawn on the *tile* grid
    // rather than the dual grid the terrain uses, because a plank covers one
    // whole cell rather than sitting on the corner between four of them, so
    // it takes no DUAL_OFFSET.
    //
    // The whole range is walked rather than a list of the harbour's planks:
    // `isBridged` is a set lookup and false for every cell in the world but
    // a few dozen, and a per-chunk plank list would be one more thing to
    // keep in step with a grid that is regenerated from its seed anyway.
    for (let row = range.minRow; row <= range.maxRow; row++) {
      for (let col = range.minCol; col <= range.maxCol; col++) {
        if (!grid.isBridged(col, row)) continue;
        const p = gridToScreen(col, row);
        texture.batchDrawFrame(
          DECK_SHEET_KEY,
          variationFor(col, row, this.deckVariations),
          p.x - offsetX,
          p.y - offsetY,
        );
      }
    }
    texture.endDraw();
  }

  /**
   * Throw away the baked ground over a range, so it is drawn again.
   *
   * Measured against the world's grid whatever is on screen, because the
   * ground being redrawn is the world's — see `GameScene.redrawGround`.
   */
  forgetGround(range: TileRange, world: { width: number; height: number }): void {
    for (const chunk of chunksCoveringTileRange(range, world.width, world.height, 0)) {
      const key = chunkKey(chunk);
      const entry = this.activeChunks.get(key);
      if (!entry) continue;
      entry.texture.destroy();
      this.activeChunks.delete(key);
      this.despawnSceneryIn(key);
      // The sea with it. A chunk is thrown away here because the ground
      // under it has changed, and water that was laid for the old ground
      // would not be relaid — `spawnWaterIn` returns early for a key it
      // already holds — so the coast would keep its old shape while the
      // land changed underneath it.
      this.despawnWaterIn(key);
    }
    // The next refresh has ground to lay again, even if the camera has not moved.
    this.settled = null;
  }

  /** Sort the world's scenery into the chunk each piece stands in, once. */
  bucketScenery(objects: readonly PlacedObject[]): void {
    this.sceneryByChunk.clear();
    for (const object of objects) {
      if (sceneryKind(object.type) === null) continue;
      const key = chunkKey(dualTileToChunk(object.col, object.row));
      const bucket = this.sceneryByChunk.get(key);
      if (bucket) bucket.push(object);
      else this.sceneryByChunk.set(key, [object]);
    }
    // Bucketed after the first refresh has already looked: the chunks on
    // screen have their ground but no trees yet, and they are owed them.
    this.settled = null;
  }

  /**
   * Take one tree or rock out of the world for good.
   *
   * The sprite lives in its chunk's bucket, so both have to forget it —
   * the bucket is what respawns a chunk when the camera comes back, and a
   * tree left in there would grow again the moment the player walked away
   * and returned.
   */
  fellScenery(object: PlacedObject): void {
    const key = chunkKey(dualTileToChunk(object.col, object.row));
    const bucket = this.sceneryByChunk.get(key);
    if (bucket) {
      this.sceneryByChunk.set(
        key,
        bucket.filter((standing) => standing.id !== object.id),
      );
    }
    this.despawnSceneryIn(key);
    this.spawnSceneryIn(key);
  }

  /**
   * Show the trees that are on screen and hide the rest.
   *
   * Phaser does not cull a plain display list. `willRender` asks whether an
   * object is visible and whether this camera is allowed to see it, and
   * nothing asks whether it is *anywhere near* the camera — so every sprite
   * on the list is transformed and written into the vertex buffer whether it
   * lands on the screen or a chunk away from it.
   *
   * Scenery is spawned a chunk at a time and a chunk is thirty-two tiles
   * square, so a screen forty tiles wide overlaps six of them: on a desktop
   * this was submitting the better part of two thousand quads to draw a few
   * dozen trees. A comparison against the view costs a subtraction each; the
   * quad it saves costs a great deal more.
   *
   * Generous by a tile on every side, because a tree is drawn taller than
   * the square it stands on and its feet are what is being tested.
   */
  cullScenery(): void {
    const view = this.scene.cameras.main.worldView;
    const left = view.x - SCENERY_CULL_MARGIN;
    const top = view.y - SCENERY_CULL_MARGIN;
    const right = view.x + view.width + SCENERY_CULL_MARGIN;
    const bottom = view.y + view.height + SCENERY_CULL_MARGIN;
    for (const [key, sprites] of this.liveScenery) {
      const bucket = this.sceneryByChunk.get(key);
      if (!bucket) continue;
      for (let at = 0; at < sprites.length; at++) {
        const sprite = sprites[at];
        const object = bucket[at];
        if (!sprite || !object) continue;
        const feet = this.host.toFeet(object.col, object.row);
        const seen = feet.x >= left && feet.x <= right && feet.y >= top && feet.y <= bottom;
        if (seen === sprite.visible) continue;
        sprite.setVisible(seen);
        // And stop it swaying while nobody is looking. A hidden sprite is
        // still on the update list and still runs its animation forward every
        // frame; paused, that call turns round at the door. Only on the
        // change, because pausing something already paused is the same work
        // this is trying to avoid.
        if (seen) sprite.anims.resume();
        else sprite.anims.pause();
      }
    }
  }

  /** Put a chunk's trees and rocks on screen, if they are not already. */
  private spawnSceneryIn(key: string): void {
    if (this.liveScenery.has(key)) return;
    const objects = this.sceneryByChunk.get(key);
    if (!objects) return;
    this.liveScenery.set(
      key,
      objects.map((object) => this.host.spawnScenery(object)),
    );
  }

  private despawnSceneryIn(key: string): void {
    for (const sprite of this.liveScenery.get(key) ?? []) sprite.destroy();
    this.liveScenery.delete(key);
  }

  /**
   * Lay the moving sea under one chunk.
   *
   * One image per tile that touches water, which for a chunk out at sea is
   * every tile in it. Images rather than Sprites because the cycle is driven
   * from `update` for the whole sea at once: a Sprite each would put an
   * animation component on every tile of the ocean to tell them all the same
   * thing.
   */
  private spawnWaterIn(key: string, chunk: ChunkCoord): void {
    if (this.liveWater.has(key) || this.waterFrames.phases <= 0) return;
    const grid = this.host.grid();
    const range = dualTileRange(chunk);
    const minCol = Math.max(range.minCol, DUAL_ORIGIN);
    const minRow = Math.max(range.minRow, DUAL_ORIGIN);
    const maxCol = Math.min(range.maxCol, grid.width - 1);
    const maxRow = Math.min(range.maxRow, grid.height - 1);

    const tiles: WaterTile[] = [];
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        if (!touchesWater(cornerTerrainsFor(grid, col, row))) continue;
        const at = gridToScreen(col, row);
        const image = this.scene.add.image(
          this.host.originX() + at.x + DUAL_OFFSET,
          this.host.originY() + at.y + DUAL_OFFSET,
          TERRAIN_ATLAS_KEY,
          waveFrameFor(col, row, this.wavePhase, this.waterFrames),
        );
        image.setOrigin(0, 0);
        image.setDepth(WATER_DEPTH);
        this.host.world(image);
        tiles.push({ image, col, row });
      }
    }
    this.liveWater.set(key, tiles);
  }

  private despawnWaterIn(key: string): void {
    for (const tile of this.liveWater.get(key) ?? []) tile.image.destroy();
    this.liveWater.delete(key);
  }

  /**
   * Step the whole sea together.
   *
   * Together, but not in unison — each tile's phase is offset by a hash of
   * where it is, so what steps at the same moment is a set of ripples at
   * different points in the same swell. A sea that all showed the same frame
   * would read as the screen flickering rather than as water.
   */
  driftWater(time: number): void {
    if (this.waterFrames.phases <= 0) return;
    const phase = Math.floor(time / WAVE_STEP_MS) % this.waterFrames.phases;
    if (phase === this.wavePhase) return;
    this.wavePhase = phase;
    for (const tiles of this.liveWater.values()) {
      for (const tile of tiles) {
        tile.image.setFrame(waveFrameFor(tile.col, tile.row, phase, this.waterFrames));
      }
    }
  }

  private evictColdChunks(protectedKeys: ReadonlySet<string>): void {
    if (this.activeChunks.size <= CHUNK_CACHE_LIMIT) return;
    const evictable = [...this.activeChunks.entries()]
      .filter(([key]) => !protectedKeys.has(key))
      .sort((a, b) => a[1].lastUsedAt - b[1].lastUsedAt);
    const overBy = this.activeChunks.size - CHUNK_CACHE_LIMIT;
    for (let i = 0; i < overBy && i < evictable.length; i++) {
      const item = evictable[i];
      if (!item) continue;
      const [key, entry] = item;
      entry.texture.destroy();
      this.activeChunks.delete(key);
      this.despawnSceneryIn(key);
      this.despawnWaterIn(key);
    }
  }
}
