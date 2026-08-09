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

The ground type of a tile — Grass / Dirt / Sand / Water / Rock. Controls
base passability and what can be planted where. Nothing about this
changes.

### Habitat (new)

A named bundle used during generation that describes a *region*, not a
single tile:
- a **terrain-weight distribution** — which terrain types appear in this
  region and how often (e.g. Meadow: 100% Grass; Coastal: mostly Sand,
  some Water)
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
  //   (a dock on Water, a bridge over Water/Rock)
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
arcs, assign each arc Coastal (water) or Highland/mountainous (rock) —
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

**5. Per-tile terrain + decoration.** For each tile, sample its terrain
type from its habitat's weight distribution, then roll decoration objects
from the habitat's density table.

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
| Harbour | Algorithmic, constrained to touch a Coastal **outer-edge** border arc | Settlement (+ dock exception) |
| Big City | Algorithmic, constrained to be near the placed Harbour (port-city) | Settlement |
| Mountain Star Observatory | Algorithmic, constrained to touch a Highland **outer-edge** border arc | Natural (+ one large "Observatory" building object) |
| Enchanted Forest | Algorithmic (spacing only); seeds a Woodland habitat blob in step 4 | Natural |

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

Illustrative only — none of the math topics below are decided, they're
here to show the pattern holds up across all five areas:

| Area | Thematic hook | Illustrative spell topic |
|---|---|---|
| Starting Village | mentor/family, the first lesson | basic arithmetic |
| Enchanted Forest | growth, the forest's own magic | multiplication (repeated growth) |
| Big City | trade, market economics | percentages/discounts |
| Harbour | tides, cargo, proportion | ratios |
| Mountain Star Observatory | night sky, orbits, distance | geometry/angles |

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
