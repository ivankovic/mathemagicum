# Mathemagicum — Game Design

## Concept

A cozy, player-vs-environment farming/gardening game. "PvE" here means the
environment (terrain, timing, growth), not hostile creatures — **there are
no enemies and no combat.**

The educational core: every gardening action — planting, tending, growing,
harvesting — is performed by casting a **gardening spell**, and each spell
is a math minigame. The math isn't a quiz bolted onto a farming game; the
math *is* the gardening mechanic. Minigames are designed and added one at a
time, each tied to a specific gardening action and a specific math skill.

## Pillars

- **No conflict.** Challenge comes from terrain, timing, and math mastery —
  never from an opponent.
- **Math as magic.** Casting a spell (solving a minigame) is how you
  interact with the garden. No separate "quiz mode" bolted on the side.
- **Isometric pixel-art world.** Explored on foot, tile by tile.
- **Learning over gating.** Every spell is available from the start — the
  goal is to encourage learning, not to reward progression with content.
  NPC teachers explain a spell and train it with partially solved
  problems (worked examples), but nothing is ever locked behind them.

## Core loop

1. Explore the world; note what terrain is where.
2. Pick a plant suited to that terrain.
3. Cast the planting spell to plant it.
4. Tend it with further spells (watering, growth, ...) — minigames TBD.
5. Harvest, expand, repeat.

## Systems

### Terrain

Multiple terrain types exist in the world simultaneously. Terrain governs
both where the player can walk and what can be planted where — it's a
constraint the player has to read the map for, not just decoration.

### Plants

Multiple plant types exist, each restricted to specific terrain types.
Which plant fits which terrain is part of the puzzle, independent of any
minigame.

### Gardening spells (math minigames)

Not designed yet beyond the concept above — to be specified one at a time,
each mapped to one gardening action (plant / tend / harvest / ...) and one
math skill. Nothing here should be assumed until a minigame is actually
speced.

What is settled: spells are grouped by mathematical theme, and a spell's
in-game effect mirrors that theme rather than being an arbitrary skin —
e.g. a multiplication spell makes copies of an object, because that's
what multiplication is. All spells are available from the start (see
"Learning over gating" above); NPC teachers found around the world teach
and drill a spell's theme, they don't gate access to it. See
[`WORLD_GENERATION.md`](WORLD_GENERATION.md) for how teachers and spell
themes map onto specific areas.

## Current milestone

Get a player moving through a world that has multiple terrain types and can
plant multiple types of plants. No minigames yet: planting is a direct
action (stand on a valid tile, press a key) as a placeholder for where the
first spell will go. No growth or harvest loop yet.
