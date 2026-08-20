# World Generation — working draft

Status: brainstorm, not implemented. The pipeline, anchor placement, and
fill strategies below are settled enough to build against. Remaining open
items are either deferred content design (what an NPC actually does) or
implementation-time tuning — neither blocks starting on the mechanical
parts (border generation, anchor placement, connectivity).

## Goal

A bigger explorable world than the current hand-placed 10×10 map. A number
of **story areas** — curated, content-bearing locations — sit on the map.
The space between them is procedurally generated wilderness. Each story
area is itself procedurally generated: story objects placed at "sensible"
spots, the rest filled in from habitat parameters.

This is two different generators doing two different jobs:
- a **world generator** that lays out story areas and fills the gaps
  between them
- an **area generator** that fills in one story area's interior

## Decisions so far

- **World is fixed-size**, generated once — not chunked/streamed.
- **World edges are a hard natural border**: water and impassable
  mountains, not an arbitrary generation cutoff. Mixed around the
  perimeter (not symmetric edge-pairs) — some stretches coastal, some
  mountainous, varying per-segment.
- **Story area placement is hybrid**: some areas sit at fixed, hand-chosen
  coordinates (anchors — e.g. a starting village); others get placed
  algorithmically subject to spacing constraints.
- **Habitat and terrain are separate concepts** (see next section) — this
  also replaces the vaguer "biome parameters" language from the first
  draft.
- **Habitat is stored per-tile at runtime**, not discarded after
  generation — future systems (spells, quests, flavor) can key off "this
  tile is Woodland" directly instead of inferring it from terrain +
  decoration.

## Core concepts

### Terrain (exists today)

The ground type of a tile — Water / Sand / Dirt / Grass / Woodland /
Hilly / Mountain. This vocabulary is the asset generator's (see
`src/world/terrain.ts`), since those names are what the tile atlas's frames
are keyed by. Controls
base passability and what can be planted where. Nothing about this
changes.

### Habitat (new)

A named bundle used during generation that describes a *region*, not a
single tile:
- a **terrain-weight distribution** — which terrain types appear in this
  region and how much of it each covers (e.g. Meadow: 100% Grass; Coastal:
  mostly Sand, some Water). These are proportions of *area*, not per-tile
  odds; the order they are listed in is significant — see
  [Terrain from elevation](#terrain-from-elevation)
- a **decoration-object palette + density** — what gets scattered on top
  (e.g. Woodland: dense Trees; Meadow: none)

Critically, a Woodland habitat tile is still literally **Grass terrain**
underneath — walkable, plantable by Grass rules — it just also has a Tree
object sitting on it. This directly answers the original "grass area /
wooded area" framing: those are habitats, not terrain types.

Example habitats: Meadow, Woodland, Wetland, Coastal, Highland.

### Objects: decoration vs. story

Two kinds of things placed on top of terrain, sharing one placement
mechanism (rejection-sampling a tile, validating spacing/terrain
affinity) but different in purpose:
- **Decoration objects** (Tree, ...) — scattered by a habitat's density
  rules, no identity, purely environmental. Can still block movement (a
  tree blocks a tile even though Grass under it is walkable).
- **Story objects** — hand-defined per story area, content-bearing,
  placed by the area generator with its own placement rules.

Consequence: a tile's effective passability becomes **terrain passable
AND no blocking object on it** — not just terrain alone, like today. (This
gets one more twist once docks enter the picture — see "Fill strategies"
below.)

### Story objects, concretely

We haven't designed NPCs/dialogue/quests/shops yet, and this generator
shouldn't have to wait for that — same move as planting existing before
any gardening spell does. So a story object is split into a **placement
contract** (what the generator needs) and a **content hook** (deliberately
left as an opaque, pluggable "whatever gets designed later"):

```
interface StoryObjectDefinition {
  id: string;                  // e.g. "forest-witch-npc"
  footprint: { width: number; height: number }; // usually 1x1, buildings bigger
  blocksMovement: boolean;
  placement: {
    terrainAffinity?: TerrainType[];   // e.g. must sit on Grass
    minSpacingFromObjects?: number;    // tiles, from other objects
    minDistanceFromEntrance?: number;
    maxDistanceFromEntrance?: number;
  };
  // content hook intentionally unspecified here — dialogue, shop,
  // minigame trigger, whatever. The generator only needs the placement
  // contract above to do its job.
}
```

Each story area gets a small hand-authored list of these (a "manifest") —
e.g. Enchanted Forest: one NPC near-center on Grass, one prop object
nearby. The generator's job is purely mechanical: for each definition,
rejection-sample a valid local tile satisfying `placement`, record
`{ objectId, col, row }`.

This also resolves the terrain-vs-objects sequencing question from the
first draft: since `terrainAffinity` is a real field on the contract,
terrain (and decoration) must always be generated before story objects
are placed, never the reverse. Pipeline step 7 below reflects that now.

### Fill strategies (resolves Big City)

Big City clearly isn't a natural habitat — paved terrain, buildings
covering most of the footprint, not grass/trees. Rather than a bespoke
system just for it, generalize: every story area gets one of two **fill
strategies**, and Big City just isn't alone in needing the second one.

- **Natural** — what's already described: habitat-driven per-tile terrain
  + decoration, then story objects placed on top. Used by Enchanted
  Forest, and Mountain Star Observatory (whose single "Observatory"
  building is just a story object with a large footprint — no different
  mechanically from an NPC, just bigger).
- **Settlement** — runs one extra pass *before* the natural fill: lay a
  path network (Dirt terrain, via the same connectivity/path-carving
  machinery already used at world scale, just applied locally) and place
  building footprints as story objects snapped near the paths. Whatever's
  left over then gets the normal per-tile fill, using a "Settlement"
  habitat (mostly Dirt/packed paths, sparse Grass, no dense decoration).
  Used by Starting Village, Big City, and Harbour.

So the two strategies aren't really separate systems — Settlement is
Natural fill with an extra reserved-tiles pass bolted on the front, which
is also why "Settlement" can just be a habitat like any other rather than
a new mechanism.

One nuance this surfaces: **Harbour's dock**, now resolved. A dock isn't
just "allowed to sit on Water despite it being impassable" — it needs to
make that tile *walkable*, since the player has to stand on the dock. So
the real fix generalizes past docks: objects don't only ever add
blocking, they can also override passability the other way.

```
placement: {
  ...
  passabilityOverride?: "blocking" | "passable";
  // "blocking": object makes an otherwise-passable tile impassable
  //   (default behavior — a tree on Grass)
  // "passable": object makes an otherwise-impassable tile passable
  //   (a dock on Water, a bridge over Water/Mountain)
}
```

Dock's definition sets `terrainAffinity: [Water]` (or "must be adjacent to
Water") plus `passabilityOverride: "passable"`. No special-case rule
needed elsewhere — the general "terrain passable AND no blocking object"
formula becomes "terrain passable, possibly overridden by an object either
direction," which also quietly gives us bridges for free later.

## Proposed pipeline

The anchor set (below) forces a stricter ordering than the first draft
had: Harbour/Observatory can't be placed until the border exists, and
interior habitat growth can't run until Enchanted Forest has staked its
Woodland seed. Revised order:

**0. Seed.** One seeded PRNG (small hand-rolled generator, e.g.
mulberry32 — no dependency needed) drives everything below, so a given
seed reproduces the same world. Also makes the pipeline unit-testable
without flakiness, same as the current world model.

**1. Generate the border.** Walk the world's perimeter, split it into
arcs, assign each arc Coastal (water) or Highland/mountainous (mountain) —
mixed, not symmetric edge-pairs. Pure edge-terrain, independent of
everything else; this alone produces the "hard natural border."

**2. Place anchor areas, in dependency order:**
   - **Starting Village** — fixed at world center.
   - **Harbour** — algorithmically placed, constrained to touch a
     Coastal border arc (outer edge only, not an interior lake).
   - **Big City** — algorithmically placed, constrained to be near the
     now-placed Harbour (port-city relationship).
   - **Mountain Star Observatory** — algorithmically placed, constrained
     to touch a Highland/mountainous border arc (outer edge only).
   - **Enchanted Forest** — algorithmically placed (spacing-constrained
     like Big City), and becomes a *seed* for a Woodland habitat blob in
     step 3, rather than searching for a pre-existing one.

   All placements reject on overlap with already-placed areas plus a
   padding buffer; retry up to N times; fail loudly rather than silently
   overlap.

**3. Place any remaining (non-anchor) story areas** via plain
spacing-based rejection sampling — same mechanism, no extra constraints.

**4. Grow habitat regions across the wilderness.** Cellular automata:
grow blobs from seeds — the border arcs from step 1, Enchanted Forest's
Woodland seed from step 2, and enough additional random seeds to cover
the rest of the map — until every non-reserved tile belongs to a habitat
region.

Growth is cheapest-first over a *cost* that varies smoothly across the
map, not uniform flood fill. Uniform expansion advances every region at
the same rate, so the boundary between two of them is the straight line
equidistant from both — the whole map came out as Voronoi cells with
45-degree diagonals, which stayed invisible only while the terrain on top
of it was per-tile noise. Making regions advance quickly through cheap
ground and slowly through costly ground bends those boundaries into
curves. A tile is claimed when it is *reached* rather than when it is
queued, which is what lets the varying cost decide who gets it.

### Story areas are cut from the ground they sit in

Reserved anchor boxes used to be skipped by the fill and left at the grid's
default Grass, so that connectivity had something passable to reach. The
result was a green rectangle in whatever the area had been placed in — a lawn
in the mountains for the Observatory, a lawn on the beach for the Harbour.

They are painted from the slope like everywhere else now, and made usable
afterwards by converting only the *impassable* tiles inside them: rock
becomes the slope below it, sea becomes the shore above it. So the
Observatory reads as a shelf cut into the mountain and the Harbour as a
beach, and both are still walkable end to end.

The one thing that outranks a story area is the world's own water edge: the
flattening runs before the far edges are sealed, so a Harbour that reaches
the map's boundary keeps sea in it, which is what a harbour wants anyway.

**5. Terrain + decoration.** Terrain comes from cutting a smooth,
seeded elevation field at each habitat's weights — see
[Terrain from elevation](#terrain-from-elevation). Decoration objects are
still rolled from the habitat's density table (not built yet).

### The world is one slope

Superseded: habitats no longer grow as scattered blobs, and terrain is no
longer sampled from their weights. Both produced a map with no shape — some
of everything, everywhere, in no relation to anything else.

The world is now a single slope running down from one randomly chosen
**high corner**:

- that corner is **mountain**, which is where the **Observatory** always sits
- it falls away through **hilly**, then **woodland**
- the middle of the map is **grass**, which is where the Village sits
- the two edges *furthest* from the corner are **water**, with **sand**
  inland of them
- **dirt** is not natural ground at all: it is what the village carves for
  paths and gardens, so bare earth always means somebody worked it

Height is `1 - max(dx, dy)` from the high corner, warped by a smooth noise
field so the bands read as coastline and treeline rather than as contours.
Chebyshev distance rather than Euclidean is load-bearing: `max` is exactly 1
along the *whole* of both far edges, which is what puts water along all of
them. A Euclidean distance reaches 1 only at their midpoints and would leave
the ends nearest the high corner dry.

Two consequences worth stating plainly:

- **Every world has the same structure**; only its orientation and detail
  vary. That is the point — a player who has learned that water is downhill
  and rock is uphill knows which way to walk in a world they have never seen.
- **The two edges at the high corner descend to meet the water edges.** They
  cannot stay high along their whole length: their far ends *are* the water
  edges' ends. So they read as a ridge running down to the sea, and are meant
  to be walled by tight formations of boulders and tall trees rather than by
  terrain.

### The steps between the levels

The slope runs down from a high corner through mountain, hills, wood, meadow
and sand to the sea. That reads as a *gradient*, and it always did — what it
did not read as was **levels**, because nothing marked where one gave way to
the next.

Every cell now carries a **level**: 0 for the coast, meadows and wood, 1 for
the hills, 2 for the peaks. It is stored rather than derived from terrain,
because two patches of the same terrain can be at different heights — a step
up in a meadow is grass above and grass below, and the art ships a
grass-grass cliff precisely so that case is drawable. Levels are then
smoothed so no neighbour is more than one step away, because the art has one
cliff: a step of one, and a two-level jump would have nothing to draw.

The smoothing counts **diagonals**, though nothing walks along one. A tile is
drawn from the four levels at its corners, and those corners are a 2x2 block
of cells — so a tile's north-west and south-east corners are diagonal to each
other, and smoothing only the four cells you can walk to left blocks like
`0 1 / 1 2` perfectly legal. A tile spanning two levels is one the atlas has
no frame for: it fell through to plain ground, a hole in the cliff line.
Taking all eight neighbours makes every 2x2 block span at most one level,
which is exactly the condition that every step tile is drawable. It costs
nothing inland — measured on five worlds, not one cell of mountain moves,
because the fill never sets a peak diagonally against the lowlands. What it
does fix is the **rim**, which stands one step above whatever it borders and
so can meet the ground diagonally two levels below it. Every undrawable tile
in a measured world was on the rim.

**The cliff is a tile, not an object.** A tile whose four corners are not all
the same level is drawn from the cliff atlas instead of the terrain one — a
complete tile, ground on both sides included, with a band of rock along the
seam. It is the same border every pair tile already draws, so it follows the
contour organically and tiles by exactly the machinery the terrain does.

**A ramp is a permission, not a trench.** The first attempt cut ramps by
*lowering* a lane of the upper level to meet the lower one, on the reasoning
that two cells at the same level are walkable between. That cannot work:
lowering a cell moves the step rather than removing it, so the lane became
something you could walk into and not out of. With a rule that forbids every
level change, no arrangement of levels is ever walkable between two of them.
So a ramp is a flag on a cell — one on either side of a step makes that step
crossable — and it is also what tells the renderer to draw the ramp tile
instead of the cliff one.

**The ramp tile tapers, it does not stop.** The first one kept the rock near
the tile's edges and cut it off at a ruled line, and that line read as the
tile's own edge showing through — which is the one thing a seam must never
do. The rock is now laid at a *thickness* that falls from full depth at the
end where the ramp meets the cliff to nothing across the gap, so the face
descends into the way up and rises out of it again. It has to reach zero and
stay there for a stretch: a band one pixel deep is still a band, and a
hairline of rock through the gap reads as a wall you are not allowed
through.

A taper needs ends, and the ends have to lie **along** the border — so only a
step running straight across a tile can be a ramp. Where a contour turns a
corner inside a tile there is no ramp frame, and that tile is drawn as plain
ground, which is exactly what a ramp with all its rock tapered away would be.
That is fine in the middle of a way up and wrong at its edge, where the full
cliff beside it would stop dead in mid-air — the sharp edge again, one tile
over. So a second pass **widens each way up until its edges land on a
straight run**: mark the neighbouring step tile as part of the way up too and
look again. Most of any contour is straight, so it settles in two or three
rounds. It runs *after* the connectivity pass, not before, because that pass
marks ways up of its own where a carved route has to climb — a cell or two at
a time, which is exactly the shape that leaves an untaperable edge. Running
it in both places was tried and dropped: it produced worlds identical to the
byte, because the seal settles on the same answer whenever it is asked. The
cost is a way up a tile or two wider than the lane asked for, which nobody
can see.
Story areas are left alone, so a handful of tiles in a world may keep the old
blemish rather than have a cliff opened through the middle of the harbour.

Cutting them is not optional. Every level above the first would otherwise be
sealed, and nothing downstream could rescue it: the connectivity pass carves
*terrain*, and a step is not terrain. The ways up run in lanes on both axes,
one per period at a hashed offset inside it, which *guarantees* the spacing
rather than leaving it to a distribution nobody has looked at.

**And the edge of the world is the same thing.** The outermost ring stands
one step above the ground just inside it, so the map seals itself: the cliff
draws itself out of the same tiles as every other step, and the rule that
stops you climbing a cliff inland stops you climbing out. It replaces a wall
of objects — trees and boulders at first, then a standing cliff sprite —
that had to be placed, kept off the story areas and excused to the
connectivity pass. One step above whatever it borders rather than a fixed
height, so the smoothing rule holds by construction: a rim pinned to the top
level would be a sheer drop wherever it met the coast, and there is no art
for that.

### Trees, boulders and spires

Scattered across the ground that grows them: thick through the woodland, thin
on the meadows, occasional boulders up in the rock. Density is a property of
the terrain and so is *which* object appears — conifers in the wood, spires
in the mountains — so a boulder never turns up in the middle of a wood.

They clump rather than sprinkling evenly. A wood with its trees at a uniform
spacing reads as an orchard; what makes it a wood is thickets with clearings
between them, so two noise fields are multiplied — one that wanders slowly to
make the thickets, one per position to decide within them.

Nothing stands on the lip of a step. A cliff is drawn from the levels at a
tile's four *corners*, so a tree beside a step has the cliff line drawn
across its trunk even though the tree itself is on flat ground — the ring
around a candidate cell has to be one level, not just the cell.

**One tile each, on a one-tile lattice.** Both were two, and both were the
same constant because they happened to be the same number. They answer
different questions: how much ground a tree takes, and how finely the world
is sampled for places to put one. Scenery now blocks the single tile it grows
out of — a wood is something to walk *through* rather than a lattice of
four-tile walls — and the lattice went the other way, to one, because a
lattice as wide as the object is a grid you can see. Trees may stand next to
each other now, which is what a thicket is.

**And they come and go with the ground they stand on.** Every tree used to be
a live sprite from the moment the world was made — thirteen thousand of them,
each with a sway animation running, almost none on screen. They are spawned
with their chunk and destroyed with it, and cached far more tightly than the
ground is: a chunk's terrain is one texture, cheap to keep and expensive to
redraw, so sixty are held against panning; its trees are hundreds of sprites,
cheap to remake and expensive to keep, so only what is on screen exists. That
one change bought back more than the finer lattice cost — the village went
from fifteen frames a second to thirty, and a wood from eight to fifteen.

These used to exist only as the *wall* along the map's two land edges, and
when the rim became a cliff that wall went — taking every tree in the world
with it, because the wall was the only thing that had ever placed one.

Reserved story areas are left clear — but that is
belt and braces rather than the guarantee. The guarantee is that
`ensureConnectivity` can now clear a blocking object as well as rewrite
terrain, and verifies afterwards. It could not before: a carve that only
rewrote terrain left the boulder standing in the gap, so an Observatory
walled into the mountain stayed sealed while generation reported success.

Because the area below a height is quadratic in it, band thresholds cannot be
read as area shares: measured over eight seeds the world comes out roughly
13-22% water, 11-18% sand, 23-30% grass, 26-29% woodland, 8-9% hilly and 4-8%
mountain.

**Habitat** survives as a per-tile tag derived from the band, for systems that
want to key off "this is woodland" directly.

**Wetland** is the one habitat that is not a band, because a marsh is not a
height: it is ground at a height that happens to hold water. So it is a
second smooth field laid over the seam where the meadow gives way to the
trees — where that field runs high the ground becomes marsh, and where it
runs highest, open water. That gives ponds with boggy margins in patches
rather than a ring at one elevation.

**6. Guarantee connectivity.** Flood-fill from Starting Village; check
every other story area has a reachable tile (terrain passable *and*
unblocked by an object). If not, carve a path: search from the
unreachable area allowing impassable tiles/blocking objects at a cost,
minimizing how much needs converting, then clear just that minimal set.
Reuses/extends the BFS already built for click-to-move.

**7. Generate each story area's interior**, in the area's own local
coordinate space, order fixed by the dependencies above:
   - **7a. Layout pre-pass** (Settlement areas only): lay a Dirt path
     network, place building story objects snapped near it. Reserves
     those tiles before anything else touches them.
   - **7b. Terrain + decoration fill**: remaining tiles filled from the
     area's habitat (Settlement or Natural).
   - **7c. Story object placement** (non-building objects — NPCs, props):
     rejection-sample among tiles not already claimed by 7a, now that
     terrain from 7b is known, so `terrainAffinity` rules have something
     to check against.

**8. Stitch.** Paste each area's generated tiles into the world grid at
its reserved offset. Mark entrance tile(s) per area for step 6's
connectivity check.

## Data model implications

Not fully speced yet, but a world tile likely needs more than today's
`{ terrain, plant }`: something like `{ terrain, habitat, decoration?,
plant, storyObjectId? }` — habitat is always present (assigned by
generation, persisted), decoration/storyObjectId are optional occupants.
Passability becomes terrain-passable, then flipped either direction by an
occupant's `passabilityOverride` if present — not terrain alone.

## Testability

Every stage is a pure data transformation given a seed — same Phaser-free
pattern as the current world model, runnable under `bun:test`, including
property-style checks across many seeds ("every story area is reachable",
"no two areas overlap", "the world border has no gaps"). Procedural
generation's classic failure mode is passing on the one seed tried by hand
and breaking on another, so seed-sweep tests matter more here than
elsewhere in the codebase.

## Open questions

1. **The actual content behind story objects** — dialogue, quests, shops,
   whatever an NPC/building does when interacted with. Deliberately out
   of scope for the generator itself (see "Story objects, concretely").
   The "Spell teacher" pattern below is a structural proposal, not content
   design — the math topics in it are illustrative, not decided.
2. **Tuning only, not a design fork**: habitat blob-growth seed
   count/size and smoothing parameters (step 4); how many
   buildings/plots per settlement and how dense their path network is
   (step 7a).

## Anchor areas

Five: **Starting Village**, **Enchanted Forest**, **Big City**,
**Harbour**, **Mountain Star Observatory**. Resolved placement rules:

| Area | Placement mode | Fill strategy |
|---|---|---|
| Starting Village | Fixed at world center (player spawn point) | Settlement |
| Harbour | Algorithmic, constrained to **straddle the waterline** — see below | Settlement (quay, piers, fish market, lighthouse, the great ship) |
| Big City | Algorithmic, constrained to be near the placed Harbour (port-city) | Settlement (streets, blocks, a plaza) |
| Mountain Star Observatory | Algorithmic, constrained to touch a Highland **outer-edge** border arc | The dome on its shelf, and the lit path up to it |
| Enchanted Forest | Algorithmic (spacing only); seeds a Woodland habitat blob in step 4 | Natural (+ the great tree, a grove and its glowing mushrooms — see below) |

Placement order matters and is now baked into the pipeline (step 2):
Village → Harbour → Big City → Observatory → Enchanted Forest. Each later
area can be constrained relative to an earlier one, but not the reverse.

## The "spell teacher" pattern

**Correction: no unlocking.** All spells are available from the start —
the goal is to encourage learning, not gate content behind progression.
So a teacher's role isn't "unlock spell X," it's **explain + train**: they
introduce a spell's theme and give practice using *partially solved
problems* (a worked-example — some steps done, learner completes the
rest), then the player can already go use that spell anywhere, on day one,
with no prerequisite. Every anchor area still gets one NPC-shaped story
object as the reason to go there; it's a tutor, not a gatekeeper.

Spells are grouped by mathematical theme, and the theme informs what the
spell *does* — e.g. a multiplication spell makes copies of an object,
because that's what multiplication is. Exact themes and minigames are
still a deliberate draft/placeholder, same as before — only the "no
gating, teach via worked examples" part is now settled.

Two of these are now settled rather than illustrative — the village teaches
addition and the forest teaches multiplication, and in both cases the spell's
*effect* follows the mathematics as the pattern predicted. The forest's
teacher is also the first that is not a person: the great tree itself, because
nobody lives in the old wood and a teacher who was somebody standing in a room
would have needed a house built round them.

The rest are illustrative only — those math topics are not decided, and are
here to show the pattern holds up across all five areas:

| Area | Thematic hook | Illustrative spell topic |
|---|---|---|
| Starting Village | mentor/family, the first lesson | basic arithmetic |
| Enchanted Forest | growth, the forest's own magic | **multiplication — mark out a patch (implemented)** |
| Big City | trade, market economics | percentages/discounts |
| Harbour | tides, cargo, proportion | ratios |
| Mountain Star Observatory | night sky, the turning day | **time — telling the clock (designed)** |

Since nothing is gated, the Observatory being the most secluded anchor
(by construction — border-constrained, placed last) doesn't pace
"advanced content" behind difficulty of access — a player could walk
there first and the spell still teaches from scratch. It just naturally
tends to be *discovered* later, which is a softer, non-blocking version
of the same pacing idea.

"Spell teacher" is one story-object archetype, with its own placement
defaults (small `minDistanceFromEntrance` — a tutor should be easy to
find, not hidden). See below for a second archetype that wants the
opposite.

## Collectible items and seeds

New content category, alongside spell teachers: each area has its own
collectible **items and seeds** for the player to gather — probably
usable back at the player's own farm plot, and probably exclusive to (or
much more common in) their home area, giving a concrete reason to visit
each one beyond "go learn a spell once." E.g. an Enchanted-Forest-only
seed, a Harbour-only seed suited to Coastal terrain, etc. — exact items
still undecided, same "draft for now" status as spell themes.

Mechanically, these fit the existing story-object model but differ from
teachers in every placement default:
- **Multiple instances per area**, not one unique NPC — the object
  manifest needs a `count` (or min/max range) per definition, not just a
  single placement.
- **`blocksMovement: false`** — you walk over/into a collectible to pick
  it up, it shouldn't obstruct.
- **Placement prefers scattered/hidden** over easy-to-find — the opposite
  default from spell teachers (larger `minDistanceFromEntrance`, maybe
  biased toward habitat-appropriate but out-of-the-way tiles), since
  finding them is the point.

So the story-object manifest per area now has (at least) three
archetypes with distinct placement-default profiles: spell teacher
(unique, easy to find), collectible (many, scattered/hidden), and plain
decoration/props (no count semantics, purely environmental).

## Starting Village interior — first concrete story area design

Step 7 (story area interiors) has been "deliberately not built yet" up to
now. This is the first real instance of it, for the Village specifically
— and it establishes patterns the other four anchors will likely reuse.

### Layout: a ring around a square

- A central open square/plaza, with a **well** at its exact center — a
  story object, blocks movement, small (1x1 or 2x2) footprint.
- Buildings arranged in a ring around the square's perimeter, entrances
  facing inward, roughly evenly spaced around it.
- Dirt paths connect the square (hub) to each building (spokes) — this is
  the "layout pre-pass" the Settlement fill strategy already called for,
  now concretely hub-and-spoke rather than an unspecified path network.
- Gardens sit on each building's *outward* side (away from the square),
  so the square stays open and gardens read as back-yards, not
  front-yards.

### Buildings and their NPCs

Seven buildings, six NPCs (the player's own house has no NPC — it's the
player's):

| Building | NPC | Garden |
|---|---|---|
| Player's house | — | **Big** garden — the player's main farm plot |
| School | Teacher | none |
| Villager house 1 | Villager | small garden |
| Villager house 2 | Villager | small garden |
| Villager house 3 | Villager | small garden |
| Post office | Postal worker | none |
| Village store | Shopkeeper | none |

### A building is two linked story objects, not one

A building (footprint, blocks movement, has an entrance-facing tile) and
its NPC (usually 1x1, standing just outside the entrance, facing the
square) are placed together but stay separate story objects — not merged
into one. The player needs to be able to walk up and talk to the NPC
independently of the building itself blocking that tile.

### A garden is terrain, not an object

A garden isn't a story object with a footprint — it's a designated
rectangle of Dirt terrain (pre-tilled, plantable, non-blocking) that the
layout pre-pass carves directly, the same mechanism as the paths. This is
the line between "things you interact with" (story objects) and "ground
you plant in" (terrain) — worth keeping consistent for every future area.

### Village NPC roles

**Teacher** — the spell-teacher pattern already established: explains +
trains arithmetic via worked examples (per the Village's spot in the
illustrative theme table), doesn't gate anything.

**Postal worker — patrols, and heralds the wider world.** Two things
resolved here, one of them structural:
- They *move* — patrolling the village (naturally the ring-and-spoke path
  network already laid out) rather than standing still, but only during
  the day. At night they retreat to their building (the post office),
  same as every other villager — see "Day-night cycle" below. Every story
  object so far has been a fixed placement; this is the first one that
  isn't, so the story-object model needs a real schedule, not just a
  `behavior: "static" | "patrol"` flag — something like a home building
  plus a day-behavior and a night-behavior. Not implemented yet, but a
  design object property, not "content."
- Talking to them is how the player learns Harbour/Big City/Observatory/
  Enchanted Forest exist. Since only the Village's position is fixed —
  the other four are procedurally placed — this dialogue is naturally
  partly *data-driven off the generated world*, not fully authored text:
  something like a compass direction/rough distance from Village to each
  anchor, turned into a hint. Real architectural consequence: whatever
  eventually implements "content hooks" needs read access to the
  generated world's anchor placements, not just static per-object text.
  Whether all four are revealed at once or progressively is undecided.

**Villagers — always have a request available or active.** Superseded:
not "occasionally" anymore — each villager's request slot is never empty.
A request lifecycle: **available** (offered, not yet accepted) →
**active** (accepted, in progress) → completed → immediately becomes
available again. No random trigger needed at all, which resolves last
round's open question about what triggers a request. No reward cooldown
either — see "No manipulative engagement mechanics" (`GAME_DESIGN.md`):
this is a single-player educational game, not something designed around
retention mechanics, and each completion still requires genuinely solving
a minigame, so the "cost" is real engagement, not an artificial timer.
Villagers do retreat indoors at night (see "Day-night cycle"), but stay
reachable there — requests can still be offered/turned in at night, same
as during the day.
- Requests are naturally spell-themed — a villager's struggling plant is
  a reason to go cast a gardening spell, giving practice a purpose beyond
  the player's own farm. Still nothing gated (see "Learning over
  gating") — just an optional reason to use what's already available.
- Reward is money + items — **the first real mention of a currency**.
  Worth a short note in `GAME_DESIGN.md` once this is closer to real, not
  just here.
- Loose idea, not decided: if the 3 villagers' gardens each grow a
  different existing plant type (Carrot/Sunflower/Cactus), their requests
  naturally vary. Convenient that there are exactly 3 of each right now —
  probably coincidence, not something to lock in, since more plant types
  will likely exist eventually.

**Shopkeeper — sells basic seeds and supplies.** Confirms the earlier
guess. "Supplies" beyond seeds is undefined (tools? fertilizer?). Needs
the same currency the villagers pay out: shopkeeper and villagers are two
ends of one small loop — earn money helping villagers, spend it at the
store on seeds/supplies, which is what lets the player grow what the
villagers' requests and the teacher's lessons need.

**Player's house** — likely the save/home-base point, and where the
player's own primary garden lives. No save system exists yet, so this
isn't designed either.

### Money, as a resource (new, first mention)

Nothing about an economy is designed — no prices, no balance, no earning
curve. Just noting it now exists as a concept (villager rewards, shop
purchases) so it doesn't get lost, and flagging that once it's closer to
real it deserves a short mention in `GAME_DESIGN.md`'s systems list
alongside Terrain/Plants/Spells, the same way "Learning over gating"
graduated from a passing mention here into an actual pillar there.

## The enchanted forest — second concrete story area

The second anchor with anything in it, and the first that is not a
settlement. Where the village is *laid out* — a square, a ring of buildings,
gardens with fences — this is **grown**: everything in the reserved box is
placed rather than avoided, because the scatter skips reserved areas, so the
box arrives flat and empty and the generator fills it.

**One great tree at the heart.** Three tiles by three, blocking every one of
them, with its crown reaching four tiles above the footprint. It is the only
thing in the world allowed to stand taller than a building — the scale ladder
in `GAME_DESIGN.md` puts everything that scatters under the roofline so the
village reads as the landmark of the map, and one thing at the heart of one
place is the exception that makes that rule worth having.

Landmarks are their own kind, neither scenery nor a building: scenery is one
thing per terrain on a single tile, scattered in its thousands, and a building
has a door you walk through and a room behind it. A landmark is one of a kind,
covers several tiles, has no inside, and is the reason to walk somewhere.

**A ring of glowing mushrooms about it**, then woodland thickening outward
from the clearing to the box edge, then more mushrooms scattered through it.
The clearing is kept clear to five tiles; past that the density ramps, so the
grove reads as somewhere the wood opens up rather than as a gap in it.

**The doorstep is a generated fact, not a convention.** `growGrove` returns
the tile a visitor stands on to touch the tree, and the world's connectivity
carve aims at *that* rather than at the box's centre. It used to aim at the
centre, and connectivity gets where it is going by removing whatever is in
the way — so the great tree was carved out of the world every single time and
the enchanted forest was an empty wood. The same class of bug as the player's
garden gate disappearing when the spawn moved inside the fence:
`ensureConnectivity` will delete a story object to reach a cell, so no story
object may stand on a cell it is aimed at. `worldGenerator.test.ts` pins both
halves — the doorstep is reachable *and* the tree is still standing on its
nine cells — because either alone is satisfied by deleting the tree.

**It is never fully light.** A tint keyed to the anchor box would draw a
straight line across ground the trees say has no line on it, so the dusk
ramps: full inside the box, falling to nothing ten tiles outside it, measured
to the box rather than to its centre (a centre distance would make a square
wood's corners darker than the middle of its edges). The scene eases the
value over about a second as well, which covers the one case a spatial ramp
cannot — arriving by portal, with no walk in.

It is a *floor* under the time of day rather than a second overlay: two
tinted rectangles multiply into a colour neither of them is, and at noon in
the grove that came out as a blue wash rather than as shade. One tint, taking
whichever of the two is deeper, with its colour leaning green as the dusk
rises — night in a wood is not the same colour as night over a field. And
because everything that glows reads its strength off the resulting alpha, the
mushrooms are lit at noon, which is the whole point of them.

## The harbour and the big city — three settlements, three grammars

The village, the harbour and the city are built from the same kit of
buildings, and if they were laid out the same way they would read as the same
settlement three times. So each one has its own **layout grammar**, and that
difference is doing the work a new building sprite would otherwise have to:

- **The village is round.** A ring of buildings about a well, everything
  placed by the *direction* it lies in from the middle.
- **The harbour is linear.** A working front with the sea on one side and the
  town on the other, everything placed by *how far along* it sits.
- **The city is gridded.** Streets at regular intervals with blocks between
  them, everything placed by *which block* it is in.

A ring says village however many houses are in it; a grid says town at four
buildings.

### The observatory is a dome at the top of a climb

The fourth layout grammar, and the simplest, because the mountain has already
done the work. The generator puts this box in the highest band there is and
then flattens it, which leaves exactly the shape an observatory wants: a
**shelf** of walkable hill in the middle with rock all round it, at the top of
a climb the world's own connectivity has already cut in ramps.

So the layout places one building and one path. The village is round, the
harbour is linear, the city is a grid — this is a **single approach**, and
everything is arranged along that one line. Arriving should feel like the end
of a walk rather than like entering a place.

**The shelf is found, not assumed.** How big it is depends on how high the
mountain was before the flatten pass shifted it, so a layout that guessed
would be right in the seeds it was written against and nowhere else. It is
measured as the box's non-mountain extent, and the whole thing refuses —
returning null, as the harbour does — if what it finds is too small to stand
a dome on.

**The path is inside the box.** The route *to* the mountain is the world's to
carve and it does; what this owns is the last stretch, from the rim of the
shelf to the door. That stretch is what the astronomer asks to have lit: five
posts up one side of it, empty to start with, and a lamp standing on a post
is a thing the save already records — so the task needs no field of its own,
the same trick the great tree's bed uses.

**One side, not both.** Five lamps in a row up the left of a path reads as a
lit way; five pairs reads as an avenue, and this is a mountain track rather
than an approach to a palace.

**The spacing is a ceiling, not a spacing.** Five posts three cells apart want
thirteen cells of path, and how long the path is depends on how big a shelf
the mountain left. Where there is less, they close up — which is what a lit
path does on a short climb, and better than a layout that quietly ships four
lamps and an astronomer who asks for five.

**The empty posts are drawn, not placed.** A lamp needs the cell to be empty,
so a marker that was an object would be a marker standing in its own way.
Each unlit post is a socket painted on the ground under the sprite layer, and
it fills as soon as a lamp stands there. It is the whole of the task's
instructions and also its progress bar — without it the astronomer says "put
them on the empty posts" and the posts are five cells of bare dirt in a path
of bare dirt.

| Area | Grammar | Arranged by |
|---|---|---|
| Starting Village | round | the direction it lies in from the well |
| Harbour | linear | how far along the working front it sits |
| Big City | gridded | which block it is in |
| Observatory | a single approach | how far up the path it is |

#### What is inside the dome

**The dome itself** is a 3 × 3 building of 3.69 people: a drum of pale dressed
stone with its masonry joints offset course by course, and on top a lead
cupola drawn row by row from a hemisphere rather than as a stack of
rectangles, so it reads as round from directly above. A shutter is cut down
the cupola and a brass telescope sweeps across it over the eight frames.

The shutter is drawn in a deep slate of its own and **not** in the doorway
colour, which is a rule the whole tileset keeps: no building may emit the
doorway colour with its door shut, or the game will find a second door in it.

**The astronomer** keeps it. She is the fourth teacher and the second to set a
task. Tall and long-haired, with a spyglass held horizontally at eye height —
a silhouette that cannot be confused with the geometer's square or the
schoolteacher's upright book at 32 px.

She is a **lone attendant**: not one of the village's people, because the dome
is four hundred tiles from the village and an NPC who walks home at dusk would
walk for a day and a half. She exists while the player is in the room, the way
the shopkeeper does.

**The star chart** hangs on the wall — the same frame and proportions as the
post office's map, one storey up: a night sky with the plough joined out on
it. Wall hangings are keyed to the *building*, not to the room type, for the
reason the map already learned the hard way.

**The room** is cold dark stone rather than plaster, with the telescope
standing on a 1 × 2 footprint in the middle under the shutter, and shelves and
a globe round the walls.

### The grove has a bed in it, and something growing over it

The enchanted forest is the only place that asks the player for anything. The
great tree's clearing carries two things beyond the tree itself:

- a **bed** of bare earth, four squares by three, beside the doorstep rather
  than across it — a bed laid over the way in would be a tree you could not
  walk up to until you had done what it asked;
- a **thicket** of six saplings scattered over that bed and the ground round
  it, which is what the tree asks to have taken away first.

The thicket cells are **unbreakable**, which is the flag the city wall
introduced, used for its second purpose: the connectivity carve removes
whatever is in its way, and a route that happened to run through the clearing
would have done the player's first task for them, silently, before they
arrived. They are scattered rather than ringed for the same reason a wall
needs a gate — a closed ring inside the clearing is a wall, and the one pass
that could open a wall is the pass that is now hidden from it.

**The task keeps no state.** How much wood is standing and how much of the bed
is ripe are read off the grid, and cleared scenery and planted crops are both
already in a save. See `groveProgress`.

### Every world faces the same way

The corner the world is high in used to be drawn per seed, and the argument
for that was variety: four worlds instead of one. What it actually bought was
four worlds a player cannot carry between them. The whole point of "water is
downhill and rock is uphill" is that a child who has learned it knows which
way to walk in a world they have never seen — and if the sea is south in one
and west in the next, the only thing they have learned is that it depends.

It is the **north-west** now, in every world. The mountains are north, the sea
is south, and every direction means something: north and west go uphill
toward rock, south and east go downhill toward water. Which is more than a
pure north-south slope would say, and it is the arrangement of every map a
child has already seen.

The four-corner machinery stays and the unit tests still exercise all of it.
What changed is which one the world generator asks for.

**And the harbour's water is south of its town.** A box that straddles the
waterline can find its water on its eastern side as easily as its southern —
both are coasts, but only one is the coast this game is built around. Every
door in the game is in the south wall, so a quay along an eastern shore puts
the warehouses' fronts to the sea and their backs to the town, and the great
ship moors with her entry port facing open water. Placement scores the side
the water is on, not just how much of it there is.

**Which broke the ship, and then fixed her properly.** With the sea to the
south, her door faces out to sea and the beach is *behind* her: the jetty
that used to run straight in from the shore now sails away from the land.
So the gangway is walked instead — breadth-first from her boarding cell, over
water, to whatever is nearest that a person can already stand on. Round her
hull and back to a pier, which is what a jetty to a moored ship actually
looks like, and it works on a coast facing any direction. She moors in eleven
worlds in twelve now, against eight.

### The rim leaks, and here is how it was closed

Pinning the orientation changed which seeds do what, and that surfaced a
standing bug: the outermost ring is supposed to stand a step above the ground
inside it — that step being the whole of what stops a child walking to the
edge of the map — and it did not, in a dozen cells of every world. The test
that should have caught it sampled four cells on one seed.

Two leaks, and neither is visible from the code that creates the rim:

1. **Smoothing pulls it back down.** The pass that keeps every level within
   one step of its neighbours looks at all eight, so a rim cell one above its
   own inside neighbour is often two above the cell diagonally in — and gets
   levelled with the ground it is meant to wall off. Raising it by two first
   was tried and leaks the same way one step further along. It is now
   repaired *after* smoothing, and only where it actually leaked.
2. **A ramp just inside it opens it.** A step is crossable if *either* of its
   two cells is a ramp, so a way up cut on the ground beside the rim opens
   the rim without a ramp ever being marked on the rim itself. No way up may
   now be cut within two cells of the edge — by the terracing passes or by
   the connectivity carve, which marks ramps of its own.

The repair can leave a two-step along the rim where a repaired cell meets an
unrepaired one, and a two-step inside a tile's own corners has no frame in
the cliff atlas — so a handful of boundary tiles draw plain ground where a
cliff belongs. That is the trade, taken deliberately: a seam a player can
only see by standing at the edge of the map, against a way out of the map.
The abrupt-cut sweep skips that border for the same reason — the rim is a
wall, not a way up, and a wall stopping dead at the edge of the world is a
wall that has run out of world.

### The harbour had no sea in it

The docs above say the harbour is "constrained to touch a Coastal outer-edge
border arc". It was not. Placement asked only that the box's **mean**
elevation sit in the sand-to-grass band — which a box entirely above the
waterline satisfies comfortably — and then `flattenReservedAreas` turned
whatever sea was left into sand, for being ground the player could not stand
on. Most seeds put the docks in a field, and nothing said so, because a field
is a perfectly valid piece of world.

Two changes fix it, and both are about the same mistake: a mean says nothing
about a spread.

- The harbour is placed by what its box **contains** — a fraction of it under
  water, between a fifth and a half — rather than by where its average height
  falls. Scored rather than accepted outright, so a world whose coast is all
  cliff still gets a harbour rather than an exception.
- The harbour is the one story area exempt from the "make the middle
  walkable" rule. It is the one place whose whole point is a piece of ground
  you *cannot* stand on. Mountains still soften: rock in the middle of a
  place is an obstacle, not the reason for it.

`worldGenerator.test.ts` checks the water fraction across the seed sweep,
because "at least one water tile" is a check a puddle in the corner passes.

### Planks are not a terrain

The harbour gets over its water by pier. A pier needs a cell that is walkable
over water, and the obvious way to give it one — a ninth terrain — is the
wrong way: the dual-grid blend enumerates every four-corner combination of
every material against every other, so a ninth material costs the shipped
atlas **2,465 frames**, for something that appears in one place on the map,
always in a straight line, and never blending with anything.

So decking is a sparse flag on the grid, like a crop, and a tile drawn *over*
the ground into the same chunk texture the terrain goes into — no sprite per
plank, no depth to sort, nothing to spawn or despawn as the camera moves.
The one thing its art has to do is tile seamlessly against itself in both
directions, and the generator's tests check exactly that.

**Piers run straight, along one axis.** Laid along the true seaward vector
they go diagonal the moment the coast does, and a diagonal run of planks is a
run nobody can walk — the game moves in four directions, so each plank is a
corner touching the last. Every pier in the world was a jetty standing alone
in the bay, each plank of it decked, passable, and connected to nothing. It
took a reachability check to see it.

**A pier's landward end is part of the pier.** Left out of it, that cell
looked like any other stretch of working front and the fish market put a
stall on it, sealing the pier off from the land — the same failure by a
different route, and equally invisible to a per-cell check.

### One landmark each, and two kinds of landmark

The forest has its great tree; the harbour has a **lighthouse** on its
headland and the city a **clock tower** on its square. All three are
landmarks — one of a kind, several tiles across, no door, and the reason to
walk somewhere — but they divide into two kinds, and the division decides how
tall each may be:

- A **grown** landmark may stand *with* the tallest building and not over it.
  A wood that towered over a village would take the village's job of being
  the landmark of the map.
- A **built** landmark may be the tallest thing there is. Being seen from
  outside the place is the entire reason somebody put it up — a lighthouse a
  post office looks down on is not a lighthouse. Capped at twice the tallest
  house, because this world has no skyscrapers.

Each carries its own footprint and canvas in its sidecar rather than sharing a
set of constants: a wide crown and a narrow tower are the same *kind* of
thing without being the same shape.

Both new ones **move**, and neither moves decoratively. The lighthouse's
optic turns — brightest facing the viewer, sliding across the lamp room in
between, which is also what gives it eight distinct frames where a simple
brighten-and-dim gave four, cosine being symmetric. The clock's minute hand
walks a full circle over the loop and the hour hand creeps an eighth of the
way behind it: the one thing in the world that shows a fraction of a turn,
in the city where fractions are taught.

The lighthouse also **lights the ground**, by the same path a lamp and a
glowcap take, which is what makes the harbour worth walking to after dark.

**The beacon is raised before the market.** The headland is a shoreline cell
like any other and the stalls are laid along the whole front — placed last,
the lighthouse found its own point already occupied and quietly gave up.
That is the third time a one-of-a-kind thing has been quietly displaced by a
later pass, after the great tree and the piers' landward ends, and the rule
that comes out of it is: **the one-of-a-kind thing gets first refusal on
where it stands.**

### The city builds with its own house

The city was laid out with cottages first, and a city of cottages is a large
village. It builds with **townhouses** now — two tiles of frontage, half again
the height, windows stacked up the front rather than set either side of the
door — and the room behind the door is narrow and deep where a cottage's is
wide and shallow, which is what makes walking into one feel unlike walking
into the other.

Two things fell out of it, both of which were bugs waiting rather than
choices:

- **Roof variation now covers townhouses too.** It covered cottages, on the
  argument that there are four of them and they are the same shape by design.
  There are twenty townhouses in a city, and twenty of anything identical
  reads as wallpaper rather than as a street.
- **The map on the wall belongs to a building, not to a room type.** It was
  hung in any room named "tower", which was true while there was one tower in
  the world — and the moment the city started building with towers of its own,
  every one of them had a map of everywhere hanging in it. The map is the post
  office's one distinguishing feature and the reason to climb its stairs. The
  city does not build post offices at all now, and the map is keyed to the
  building either way.

A third came out of testing rather than the code: **a room name is a lookup,
not a phrase**, so it falls back to its English key and a room added without a
German name says "townhouse" in both languages with nothing anywhere failing.
There is a test per room per language now.

### The great ship is a building

To this game a building is three things: a footprint it blocks, a door with
three states, and a room behind the door. A ship is all three — so it is one,
and adding it needed no new rule about walking into things anywhere in the
game. It only *looks* nothing like the others, and that is the generator's
business: the building spec grew a renderer hook, and the ship swaps the
picture while keeping the whole contract, sidecar and door frames and palette
by slot name included.

The slot names turn out to fit rather than strain. A ship really does have
timber, canvas, glazed windows in its stern and a dark opening you go down
through, so the hull borrows the "wall" ramp, the sails the "roof", the masts
the "trim", the great cabin's lights the "glass", and the pennant the two
smoke tones. The pennant is what moves, which broke a rule nobody had thought
to state: the tests knew a building animates *if it has a chimney*, which was
true while drifting smoke was the only motion in the village and stopped
being true the moment something flew a flag. A building now declares what
moves aboard it.

**She floats, and you can board her.** Her footprint is open water, every
cell of it, or she is a ship aground — which nothing else would notice,
because a building on a beach is a perfectly ordinary building. And her door
is in the middle of her southern row, because every door here is, so the cell
a player stands on to board is the one directly below it. That cell is
planked, by the same bridge flag the piers use.

The first gangway was laid back along the line the mooring search walked out
on, which moors her beautifully and leaves her **unboardable on any coast
that does not happen to face north** — the run arrives at her door from the
seaward side, and the cell below the door is still open water. The gangway
runs south from her door now, whatever direction the search came from.

**She does not moor everywhere**, and that is stated rather than faked: about
two coasts in three. A berth needs open water with something walkable to the
*south* of it, and a coast that faces south has nothing there but more sea.
The harbour is a harbour either way; it simply has no ship in today.

### The city has a wall, and one way through it

Four pieces, in the same shapes the garden fence comes in: a run across the
camera, a run away from it, and a gateway in each. It sits on the outermost
ring of cells so the ring road runs *inside* it, the way a city's does — a
wall standing in the middle of its own street would be a fence.

The gate is the one piece that does not block. A closed gate on this grid
either walls the city off or lets the player walk through solid stone; drawn
open and left passable, it says "this is the way in" and means it. Exactly
what the village garden's gate does, one scale up.

**Fixtures now carry their own headroom.** Sixteen pixels is the right
overhang for something you step over and half the height of something built
to keep people out, so the wall rises forty. Everything drawn before that was
true still uses the module's own number and is unchanged to the byte.

### The carve may cut through ground, not through architecture

`ensureConnectivity` gets where it is going by removing whatever is in the
way. For ground that is right — a route has to be able to open a wood or a
rock field. For a city wall it is not, and the failure was invisible in the
usual way: a route to somewhere *beyond* the city ran in at one side and out
at the other, because two wall cells are a cheaper crossing than a long
detour round a wood, and **a hole in a wall is a perfectly good way into a
city** — so every check that asked whether the city could be walked into
passed.

Two attempts before the one that worked, both worth recording because both
are plausible and both are wrong:

1. **Charge for crossing a story area.** Expressible in a 0-1 breadth-first
   search, but the *start* is inside the village, so every route paid to get
   out of its own home and the relative costs stopped meaning anything.
2. **Charge for cells with something standing on them.** Nearly a no-op:
   scenery already blocks, so it only repriced gates — and the scattered
   woods a detour crosses are objects too, so cutting through a city stayed
   cheaper than going round.

What works is a flag on the object rather than a price: `unbreakable`. The
carve routes *around* those cells instead of pricing them, so a wall cannot
be holed at any cost; a marked cell that is passable anyway — a gate — is
still walked over and left standing. Anything sealed entirely by marked cells
is then genuinely unreachable, and the carve says so out loud rather than
making a door.

The test that holds it is not "can you get into the city". It counts the
wall: one gap, at the gate, passable; every other piece still standing where
the layout put it; and the total equal to the perimeter of the box it was
laid on, so a ring with three stones missing cannot pass by being sampled
somewhere else.

### Every place says where it is entered

`ensureConnectivity` carves its routes by **removing whatever is in the
way**, so a target with something on it is a target the pass deletes. That
has now happened once for real, to the great tree, and it was silent: a route
to an empty clearing is still a route.

Every settlement therefore returns a **doorstep**, and that is what
connectivity aims at and what the portal spell lands on:

| Place | Doorstep | Why not the middle |
|---|---|---|
| Village | the player's own front door | the spawn is inside a fenced garden |
| Enchanted Forest | the clear tile before the tree | the middle *is* the tree |
| Harbour | a cell of quay, never a plank | the middle is often open sea, and a carve to a pier bulldozes its approach |
| Big City | the cell *outside* the gate | the middle is the clock tower itself; and a doorstep inside the walls is one the carve reaches by holing them |

## Day-night cycle

Reflects the player's *actual, real-world* time of day — not a simulated
in-game clock that ticks at some scaled rate. If it's 3pm for the player,
it's afternoon in-game; 11pm, it's night. This is a cross-cutting game
system, not really a world-generation concern, but it's captured here
because it came up in this conversation and immediately resolves an open
question from the Village NPC brainstorm above.

**Technical shape**: a pure function of `Date` (local time — using the
player's system clock as-is is obviously correct here; UTC would feel
wrong to almost everyone), independent of Phaser, same "Phaser-free
logic" pattern as the rest of `src/world/`. Deriving time live from the
system clock rather than simulating and persisting an in-game clock is a
genuine simplification: no time state to save, no drift to correct for
after time away from the game.

**Rendering**: a global tint (dark blue at night, warm at dawn/dusk,
plain at midday) makes far more sense as a screen-space overlay —
`setScrollFactor(0)`, sits above the chunk layer, updated as time
changes — than baking time-of-day into chunk textures, which would mean
re-rendering every active chunk's `RenderTexture` continuously just for
lighting.

**Correction: does not gate reward money.** Money being effectively
unlimited if a player enjoys the villager-request loop is explicitly
fine — see "No manipulative engagement mechanics" in `GAME_DESIGN.md`.
This is a single-player educational game; nothing here is meant to
engineer retention the way a live-service game's daily-cooldown economy
would. Each completion still requires genuinely solving a minigame, so
the real limiter is the player's own engagement, not an artificial timer.

**What it does gate: NPC presence, not access.** At night, every NPC in
the village — postal worker, the 3 villagers, the teacher, and the
shopkeeper alike — retreats indoors to their home building (school and
store count as "home" for the teacher and shopkeeper the same way a
house does for a villager). During the day, villagers actively move
around too, not just the postal worker's village-wide patrol — presumably
a smaller area local to their house/garden rather than the whole village,
though the exact range is unspecified. Every NPC needs a home building
plus a day-behavior and a night-behavior in the story-object model, not
just the postal worker.

Despite retreating, **every NPC is always reachable** — walking up to
their building at night still lets the player interact with them, same
as during the day. Retreat is purely positional/atmospheric (where they
are, whether they're visibly out and about), never a lock on
interaction. This is consistent with — really required by — "No
manipulative engagement mechanics": restricting *access* to certain
hours would itself be exactly the kind of artificial friction that
pillar rules out. The day/night cycle affects what the village looks and
feels like, never what the player can do.

**Thematic aside, not a commitment**: telling time is a natural math
topic this maps onto unusually well for an educational game, given the
cycle is already tied to a real clock — worth keeping in mind whenever
spell themes actually get designed, not a sixth theme being added now.

### Open questions (day-night cycle)

1. **Exact wander range for villagers** — local to their house/garden,
   presumably, versus the postal worker's village-wide patrol. Tuning,
   not a fork: the rule (everyone moves by day, retreats by night, always
   reachable) is settled regardless of exact range.
2. **Seasons/calendar are out of scope** — real-time games like this
   often pair a day cycle with a real-calendar season/weather system;
   nothing said about that here, not assuming it's wanted.

### Open questions

1. **Village's anchor size.** A square plus seven building-and-garden
   clusters likely doesn't comfortably fit the uniform `ANCHOR_SIZE = 24`
   every anchor currently uses (src/world/anchors.ts). Anchors probably
   need per-anchor sizes rather than one shared constant — a real
   implementation-affecting discovery from this design pass, not just
   tuning.
2. **Path shape.** Going with hub-and-spoke (a direct line from the
   square to each building) as the simplest match for "arranged around
   the square" — flag if a more organic path network was intended
   instead.
3. **NPC behavior model.** Every NPC (not just the postal worker) needs a
   day-behavior, a night-behavior, and a home building it retreats to —
   resolved as a rule, not yet as an implementation. See "Day-night
   cycle" below.
4. **Content hooks need generated-world data.** At minimum the postal
   worker's dialogue needs the actual anchor placements (for direction
   hints) — whatever ends up implementing "content hooks" can't be fully
   isolated from generation output.
5. **Tuning only**: ring radius, building spacing, garden sizes, villager
   wander range.
