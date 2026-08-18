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
- **Pixel-art world in a 3/4 top-down view.** Explored on foot, tile by
  tile. The ground is seen from directly above; buildings and objects are
  drawn from the front and stand up out of the tiles they occupy.
- **Learning over gating.** Every spell is available from the start — the
  goal is to encourage learning, not to reward progression with content.
  NPC teachers explain a spell and train it with partially solved
  problems (worked examples), but nothing is ever locked behind them.
- **No manipulative engagement mechanics.** This is a single-player
  educational game, not a live-service one — no artificial scarcity, no
  daily-login hooks, no grind economy engineered to maximize retention.
  If a player can earn effectively unlimited money by genuinely enjoying
  the loop of helping villagers (each time still requires actually
  solving a minigame — the friction is real engagement, not a timer),
  that's fine. Nothing here is trying to control how often someone plays.

## Core loop

1. Explore the world; note what terrain is where.
2. Pick a plant suited to that terrain.
3. Plant it (a direct action for now — the planting spell is not speced).
4. Tend it with further spells. The **addition spell** grows it one stage
   per cast, seedling → growing → mature; watering and the rest are TBD.
5. Pick it when it is ripe — a direct action, like planting, since the
   harvest spell is not speced. What is picked goes in the basket.
6. Expand, repeat.

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

Specified one at a time, each mapped to one gardening action (plant / tend
/ harvest / ...) and one math skill. Nothing beyond what is written below
should be assumed until a minigame is actually speced.

What is settled: spells are grouped by mathematical theme, and a spell's
in-game effect mirrors that theme rather than being an arbitrary skin —
e.g. a multiplication spell makes copies of an object, because that's
what multiplication is. All spells are available from the start (see
"Learning over gating" above); NPC teachers found around the world teach
and drill a spell's theme, they don't gate access to it. See
[`WORLD_GENERATION.md`](WORLD_GENERATION.md) for how teachers and spell
themes map onto specific areas.

Spells are reached through a **spellbook** button, which opens a tray of
runes; seeds through a **seed pouch** button beside it, which opens a tray
of crops. Both are the same widget and behave identically: tap the
container to see what is inside, tap one of those to plant or cast it
straight away, on the tile the player is facing. Neither container is
marked with any one of its contents — a plus on the book or a carrot on
the pouch would be wrong the moment there are two of either.

Nothing selects-then-confirms. A two-step action on a phone is two chances
to lose the tray to a stray tap, and it asks the player to read a caption
to find out what they are about to do.

#### The addition spell — growth (implemented)

**Action:** face a crop you have planted and cast it. One successful
cast moves the crop one growth stage: seedling → growing → mature. That
mapping is the theme rule above applied literally — the spell that adds is
the one that makes things grow, so planting drops a *seedling* and growth
is something the player does rather than something a timer does.

**Icon:** a plus, on the rune in the spellbook.

**Effect:** the same plus appears in the world, high over the tile being
added to, and sinks *into* it with a burst of sparks where it lands. The
direction is the point: a symbol that rose would read as something being
taken away. Planting has its own gesture — the character bends, holds the
low pose while the seed goes in, and straightens up.

**The minigame:** two randomly chosen three-digit numbers whose sum is
still under 1000, laid out on a number line. Three semicircular arrows jump
from the first number by the second number's ones, then its tens, then its
hundreds; under each arrow's landing point is a box the player fills in with
the running total. The order is fixed and enforced — answering the hundreds
first would mean adding the two numbers in your head and typing the answer,
which is the thing the number line exists to replace.

The line is drawn **schematically**, not to scale: the four points are
spaced evenly and each arrow's *height* carries how big its jump is. To
scale, a ones jump of at most 9 against a span of several hundred would be
invisible, and the first of the three arrows would not exist.

**No fail state.** A wrong answer marks the box, offers a hint that
escalates but never states the answer, and lets the player try again. A
spell is how the player gardens, and locking them out of gardening for
arithmetic would make the math a gate — see "Learning over gating" and "No
manipulative engagement mechanics" above.

Problem generation is uniform over the pairs that actually exist, not over
the addend with a start fitted around it; the addend's digits are all
non-zero so that none of the three arrows is a `+0` jump landing where it
started. `src/spells/addition.ts` is the whole of the rule, with no Phaser
in it, and `addition.test.ts` pins both the arithmetic and the
distribution.

### Inventory

A count per item and nothing else: no slots, no stack size, no weight, no
capacity. Those are scarcity mechanics, and a basket that filled up would
turn "go help a villager" into "walk home first" — friction that pads a
session rather than teaching anything. See "No manipulative engagement
mechanics" above.

The only things in it are crops, because harvesting is the only thing that
puts anything there yet. It is reached from a **basket** button beside the
seed pouch and the spellbook, and behaves the same way they do.

Counts are shown as badges: one per item inside the basket, and one on the
basket itself for the total. The total is the one that matters, because it
is the only one visible while the tray is shut — it tells the player they
are carrying something without asking them to open anything to find out. An
item she has none of is dimmed and carries no badge at all; hiding it
outright would reshuffle the tray as things are picked, and a row of buttons
that moves under a thumb is worse than one with a gap in it. Keeping the
empty slots also lets the basket say what *could* be in it.

### Harvesting

Picking a ripe crop is a direct action rather than a minigame — the harvest
spell is not speced, and this stands in for it the way pressing a key stood
in for planting.

One rule, whichever way the player asks for it: **she can pick a crop she
is facing, or one she is standing on.** Tapping a crop beside her turns her
toward it first and then applies that same rule, so the tap and the key
cannot drift into meaning different things. A crop further than one step
away is not reached for; tapping the world to walk is what the joystick
replaced on touch.

Crops that are not ready are tappable too, and say so. If only ripe ones
responded, a tap on a seedling would fall through and walk the player,
which reads as the game ignoring them.

### Day-night cycle

Reflects the player's actual real-world time of day (local clock), not a
simulated in-game clock — no time state to save, nothing to drift. Gates
NPC presence (every villager retreats indoors at night; the postal
worker's patrol is day-only) but explicitly *not* money or rewards — see
"No manipulative engagement mechanics" above. See
[`WORLD_GENERATION.md`](WORLD_GENERATION.md#day-night-cycle) for the
fuller brainstorm.

### Economy

The village store is the first half of it, and the only half that exists:
**the shopkeeper buys crops and sells things to put in the garden.** Tap
her to trade — she is the door into it, so there is no separate menu — and
one tap moves one unit either way.

Villager requests, the design's intended way to *earn* money, are not
built, so selling a harvest is currently the only income. That is why the
shop buys produce at all: the loop has to close somewhere, and this is the
shortest honest path from doing the maths to seeing something for it.

Two rules keep the numbers from being arbitrary:

- **Every crop is worth the same.** Not because that is obviously right,
  but because nothing today makes one harder to grow than another: each
  takes one planting and two casts, and they differ only in which terrain
  accepts them. Pricing them apart would invent a difficulty the game does
  not have. When crops differ, so can their prices.
- **Stock is priced in crops, not coins.** A fence is "two harvests"; the
  coin figure falls out of that. The player can count a price in the unit
  they actually earn, and changing what a crop is worth cannot silently
  make the whole shop cheap or unaffordable.

Nothing here is scarcity. Seeds stay free and unlimited, crops regrow,
there is no cap on coins or stock, and nothing the store sells is needed
to plant, grow or harvest anything — see the pillars. It is somewhere for
the work to go, not a gate.

**What it sells: things to put down.** Fences, tables and lamp posts,
bought into a crate and set on the tile the player faces. They block the
way, which is a state she can corner herself with — so rather than
checking connectivity before every placement, **anything she puts down she
can pick back up** by tapping it. A fence that boxed her in is adjacent by
definition, so it is always within reach. Tables are stocked as outdoor
furniture, which is a stretch; interior furniture is a separate thing that
`interiors.py` draws and the player does not place.

The shopkeeper answers a tap from one step away in any direction,
diagonals included — unlike harvesting, which measures orthogonally
because it acts on the tile the player *faces* and there is no diagonal
facing to turn to. Talking needs no facing.

## Current milestone

A player moving through a world of multiple terrain types, planting
multiple types of crop, and growing them with the first spell. Planting is
still a direct action — pick a seed from the pouch, or press a key — since
the planting spell is not speced. Both gardening actions work the tile the
player faces. Growth is real: a crop starts as a seedling and reaches
maturity in two casts of the addition spell. No harvest loop yet, and
nothing is saved between sessions.
