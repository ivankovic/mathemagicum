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

**There is no caption any more.** The screen used to carry a status line
above the message line — the key hints, "you are carrying three carrots", the
name of whichever panel was open. It was a paragraph of interface explaining
an interface that had since learned to explain itself: the trays show what
they hold, the badges count it, the panels have titles of their own, and the
postal worker walks the basics over in person. One line of HUD text is left,
and it says what just happened.

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

### What grows where

**Six crops**: carrot, sunflower, tomato, pepper, wheat and cactus. Five of
them are garden crops and go into either turned earth or grass; the cactus
wants sand.

That split is the whole of the terrain rule, and it is deliberate. The
sunflower used to want grass alone, which meant a seed in the pouch that the
beds the player starts standing in would refuse — a rule that never taught
anything, because all it ever did was fail. **One crop with a condition
teaches that ground matters better than five with fussy ones**: the cactus is
somewhere you have to go and find, and everything else grows where a garden
is.

The three new ones are also a lesson in what a sprite has to carry at this
size. Tomato and pepper are drawn from *one* body — from above they are the
same bushy green thing until they fruit — and what tells them apart is the
shape of the fruit, round against hanging pods, never the colour alone: a
colour difference is lost against turned soil, and lost entirely on a player
who cannot tell red from orange. Wheat is drawn as three stalks rather than
one, because a single stem with a head on it reads as a flower.

The icons in the pouch show the *part the player is picking* — a fruit, a
pod, an ear — rather than a shrunken copy of the plant, for the same reason
the carrot's icon has always been a root and not a spray of fronds.

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
worker's patrol is day-only, except that an undelivered welcome outranks
the clock — see "The welcome") and, since playtesting, what is lit: the
tint is no longer the whole story of night — see "Night, and what is lit" but explicitly *not* money or rewards — see
"No manipulative engagement mechanics" above. See
[`WORLD_GENERATION.md`](WORLD_GENERATION.md#day-night-cycle) for the
fuller brainstorm.

### Economy

The village store is the first half of it, and the only half that exists:
**the shopkeeper buys crops and sells things to put in the garden.** Tap
her to trade — she is the door into it, so there is no separate menu. What
happens at the counter is the second minigame: **money is counted, not
deducted.**

Villager requests, the design's intended way to *earn* money, are not
built, so selling a harvest is currently the only income. That is why the
shop buys produce at all: the loop has to close somewhere, and this is the
shortest honest path from doing the maths to seeing something for it.

**The player picks the language and the money.** The browser's language is
the first guess and nothing more: an options screen, reachable from the
corner of the HUD, offers English or Deutsch and either currency — or
"follow", which is the language's own. Keeping "follow" as a separate answer
from the currency it happens to resolve to means switching language later
switches the money with it, rather than leaving the player stuck with
whatever was chosen once. Both are saved, and both apply the moment they are
tapped: an options screen with an OK button asks a child to remember a second
step for the first one to count.

**The whole game is translated, not just the money.** Every line the player
reads comes from a phrase book (`src/i18n/`), one per language, and the
interface is what stops a half-translation shipping: a language that forgets
a phrase does not compile, and a test fails on any German line that is still
its English original. The phrases are *functions*, not templates with holes,
so German can put the verb where German puts the verb rather than following
English's word order in German words. Nouns carry their forms — "einen Zaun",
"keinen Zaun", "die Karotte", "der Kaktus" — because the article follows the
noun's gender, and a sentence that guessed would get one in three wrong.

**The money is real money.** English plays in Croatian kuna by default and
German in Swiss francs — a defunct currency and a foreign one, both
deliberately: neither is the money in the player's own pocket, so the game is
not quietly teaching that a fence costs five of what their parents earn. The
euro is the third choice, and the one most players will actually recognise.
All three use the coins that were really in circulation, which is why kuna
and francs start at 5 (Switzerland withdrew the 1-rappen piece in 2007,
Croatia stopped minting 1 and 2 lipa for circulation in 2009). Everything the
game holds is in minor units — lipa, rappen, cents — and every price is a
whole number of them, so nothing is ever a fraction of a coin.

**The euro is a different shape, and that is why it is here.** It keeps its 1
and 2 cent pieces, so its prices need not be round fives, and it stops at 2 €
because 5 € is a note. Ten crops in euros is thirteen coins on the counter,
which is bookkeeping rather than arithmetic — so the shop works out how many
of a thing it can sell rather than assuming ten always fits, and in euros it
offers fewer at a time. Same rule, different answer per currency.

**Money is a button, not a line of text.** The purse sits in the action bar
beside the things it buys, with a badge for how much is in it — whole units,
not the minor ones the purse counts in, because a badge reading "5000" for
fifty kuna would be a number nobody in the game uses. Opening it shows the
coins she is actually carrying, sorted into the three kinds, and tapping one
kind says what those come to. Sorted by kind rather than by denomination for
a practical reason as well as a pedagogical one: a kuna purse and a euro
purse hold different coins but the same three metals, so the button survives
the player changing currency.

**The coins have faces.** Three of them — copper, silver, gold — not one per
denomination, because the value is written on the button beside the picture
and one set of art has to serve all three currencies; a digit struck into the
art would be wrong in two of them. Which face a coin gets is a rule rather
than a table: gold from a whole unit up, silver from a tenth, copper below
that. The tiers differ in size as well as colour, so they stay apart for a
colour-blind player and in bright sun, and because a child sorting real
change sorts it by size long before reading the number.

**Buying is counting out.** Pick a thing, pick how many, then put the exact
sum on the counter coin by coin: tap a coin to add it, right-click to take it
back. No change is given, because giving change is a different and harder
skill than making a sum, and nothing about the screen can fail — there is no
wrong answer to be scored on, only a total that is not there yet.

**Selling is checking.** She counts the payment out herself and asks whether
it is right. One time in ten she miscounts, by one to three coins, in either
direction. The player says "that's right" or "that's wrong" — and either way
**she pays what she owes.** Being wrong about her arithmetic costs nothing
but being told so: a child who miscounts should lose a guess, not a harvest.

**At most ten of a thing per trade, and fewer when the coins are small.** A
counting limit, not a purse one. Past a handful the sum stops being
arithmetic a child does in their head and becomes bookkeeping, and her side
of the counter has to stay countable by eye — so the cap is the largest count
whose payment still fits, and it stops at the first count that does not
rather than the largest that does, because the picker steps through every
number on the way. The picker also stops at what the purse can actually
cover, so it can never offer a total the coin pad will refuse to reach.

Two rules keep the numbers from being arbitrary:

- **Every crop is worth the same.** Not because that is obviously right,
  but because nothing today makes one harder to grow than another: each
  takes one planting and two casts, and they differ only in which terrain
  accepts them. Pricing them apart would invent a difficulty the game does
  not have. When crops differ, so can their prices.
- **Stock is priced in crops, not coins.** A fence is "two harvests"; the
  coin figure falls out of that. The player can count a price in the unit
  they actually earn, and changing what a crop is worth cannot silently
  make the whole shop cheap or unaffordable. A crop is 2,50 kn — deliberately
  not a single coin, so the smallest sale is already a sum. A test holds the
  bridge between the two halves: every price, multiplied by every quantity
  the counter can ask for, has to be payable in coins that exist.

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

**She is inside the store**, not walking the square. A shop is somewhere you
go in to; a shopkeeper who wandered was somewhere you had to find first, and
the barn's interior had no reason to exist. She stands at the back of the
room, on a cell chosen from the room's own walkability so rearranging the
furniture moves her rather than leaving her inside a crate. The shop panel is
the one thing that works indoors — every gardening action is refused in
there, but refusing the shop inside the shop would refuse it everywhere.

**The doorway is wider to walk into than it is to look at.** The door is one
cell of art, but a step into the wall immediately either side of it goes
inside too. Hitting a single tile while walking is fiddly — you come along
the front of a building, have to stop on exactly the right one, and pressing
up anywhere else bumps into a wall that looks no different from the doorway.
Three cells is a target you can miss by one and still hit. It is clamped to
the building's own footprint rather than being an offset from the door, which
is the part that has to be a rule: a door in the corner of a wall has grass
beside it, and a step onto ordinary grass must not put the player indoors.

She answers a tap from one step away in any direction, diagonals included — unlike harvesting, which measures orthogonally
because it acts on the tile the player *faces* and there is no diagonal
facing to turn to. Talking needs no facing.

### The garden

**The player starts standing in their own beds.** Not at the front door: the
beds are what the game is about, and starting outside them made the first
move of every new game "walk round the house". The plot is fenced, so the
first thing on screen is a patch of ground that is plainly *theirs*.

**Every village garden is fenced, with one gate.** The fence stands on a ring
of ground one tile outside the beds rather than on the outermost row of them,
because every cell of a garden is meant to be plantable and a fence post
would quietly cost the player the row it sat on. The gate is the ring cell
nearest the square — never a corner, since a corner gate opens onto the
diagonal, which is the one direction nobody here can walk — and a short path
is carved from it towards the house so the way in is never behind a tree.

**The gate is drawn standing open, and that is the whole design.** A closed
gate on this grid would have to either block the way — a wall with a picture
of a gate on it — or let the player walk through solid timber. Open, it says
"this is the way in" and means it: it is the one cell of the ring that does
not block movement. Its posts stand taller than the fence's and sit where the
fence's posts sit, so the runs either side join onto it rather than stopping
short.

One thing this cost, and it is worth writing down: the connectivity pass
carves its routes to the story areas by *removing whatever stands in the
way*, and it used to start from the player's spawn. With the spawn moved
inside the fence, its first carve punched straight out through the wall — the
gate vanished, and the fence had a hole in it instead. It now starts from the
doorstep, which is outside; the garden hangs off it through the gate, so
anything reachable from one is reachable from the other.

### Night, and what is lit

**Night was too dark to play in**, which is what playtesting is for. The fix
is not a paler sheet of navy — a night you can read at a glance is not night
— but light in it: the tint came down a little, and what the player carries
and what is burning nearby now shows.

**The player carries a light.** A soft, pale pool, a couple of tiles across.
It moves with them, so the dark has a shape and walking through it feels like
walking through it rather than like the screen being dimmer.

**The village lights itself.** Four lamp posts stand at the corners of the
square — corners rather than edges, because the roads leave the square along
its edges and a lamp post is a solid thing that would wall a house off if it
landed on a one-tile spoke. Each throws a warm halo, bigger and more orange
than the player's, so a lamp is somewhere you can actually see by and worth
buying one of your own for.

The lights are drawn *additively over* the tint rather than erased out of it.
Erasing is what it wants to mean, and a render texture can do exactly that —
which is how it was written first, and it went wrong in a way worth
recording: with the sheet being filled and erased every frame, it came out
blank within seconds and night simply stopped happening as the player walked.
Warm light added to a cold sheet reads the same to the eye and cannot get out
of step with itself.

### The village square

**It is paved.** Cobbles, not dirt: the square is where the village gathers,
and stone is what a place lays down where it gathers, while a path is what it
wears where it walks. The roads out of it stay dirt for exactly that reason —
and the paving goes down *after* they are carved, because every spoke starts
at the middle of the square and paving first left dirt tracks scored across
it.

The stone is drawn as a Voronoi partition with every boundary cracked, which
is what the generator already uses for mountain rock. Blobs were tried first
and read as gravel: a wobbled circle cannot say "laid by hand", because the
thing that says it is the joint.

### The welcome

**The postal worker brings the tutorial to you.** At the start of a new game
he crosses the square, says hello, and walks the player through four pages:
put a seed in the ground, cast the spell to grow it, pick it, sell it. That
is the whole game as it stands, and a tutorial that covered more would be one
nobody reads to the end.

Two decisions about *how* it arrives. It is delivered by **a person who walks
over**, not a title screen: a child meets it as somebody saying hello rather
than as a wall of text between them and the game, and he is the one villager
whose round already covers the whole village. And **every page is two icons**
— the seed pouch, the spellbook, the rune, the basket, a coin — the same
images that sit in the corner of the screen, not illustrations drawn for the
telling. "Tap this pouch" is a sentence a child can act on; "tap the seed
pouch" is one they have to decode first.

**An undelivered welcome outranks his round.** He walks it over whatever the
clock says, which is the one exception to every villager going home at night
— a child who starts playing at eight in the evening needs it more than the
village needs its curfew kept, and "the postman is still out" is a smaller
oddity than "nobody ever told me what to do here". Once it is given he keeps
the same hours as everyone else.

**It is remembered once given.** A tutorial that interrupts every load is one
the player learns to dismiss without reading, which is worse than not having
one at all — so it is saved beside the language and the money. He still walks
over, and tapping him still asks for it again; what is remembered is only
whether it opens by itself. He gives up crossing the square after a while, so
a player who would rather run off and plant something is not followed forever.

**The panel is the teacher's panel.** Both explanations are the same deck of
pages with the same buttons and the same row of dots, because the second
explanation a child meets should not also have to be learned as a piece of
interface. What differs is the picture on each page: icons here, diagrams in
the school.

### The map in the tower

**There is a map of the world on the post office wall.** Tapping it opens the
world — the real one, drawn from the player's own grid rather than painted by
hand, because the world is generated per game and a coastline somebody drew
would be a picture of a world nobody is standing in. It shows the five places
world generation puts down, each named, and where the player is.

The picture *on the wall* says nothing about which world it is: a frame, a
scrap of parchment, a coast, a marked place. A painted coastline that
disagreed with the one in the popup would be a small lie in the first place a
child looks.

It is walked once, the first time it is opened, into a texture — a quarter of
a million cells is nothing to walk once and quite a lot to walk every frame —
and everything that moves is drawn over the top each time. The colours are a
diagram's rather than the terrain art's: at one pixel a tile, texture,
speckle and blended edges all average to mud, so the map has one flat colour
per terrain and a test that says no two of them are the same.

**Why the tower.** It is the post office, and the post is the one trade in a
village that has a reason to know where everywhere else is.

### The teacher

**Someone to ask about the spell.** The addition spell is the one thing in
the game a child can be genuinely stuck on, and until now the only help was
the parchment's own hints — which arrive *after* two wrong answers. Help you
have to fail into is help arriving at the worst possible moment. So the
method is also somewhere you can go and read it, from a person, before you
need it: the teacher, at the front of the schoolhouse.

**She is in the school**, for the same reasons the shopkeeper is in the
store, and she stands on a cell chosen from the room's own walkability rather
than a written-down spot. She is drawn as a schoolteacher rather than a
wizard: she used to wear a pointed hat, which was the loudest thing in her
silhouette and said "magic user" about the one person in the village whose
job is explaining that the magic is arithmetic. Her hair is in a bun instead
— the same silhouette work, from all four sides, saying schoolroom — and the
book she was already carrying now reads as hers rather than as a spellbook. Tapping her opens four screens, one idea each, with
a picture on every one:

1. **the rune** — the spellbook and the `+` icon, drawn from the same art the
   action bar uses, so the lesson names things the player can already see;
2. **the split** — 114 pulled apart into 100, 10 and 4, read out biggest
   first, which is how a person says a number;
3. **the jumps** — the same number line the spell draws, every arc already
   made and each landing labelled, in the order they are actually made:
   smallest first;
4. **the answer** — where the last jump lands, and *why* the order is that
   way round: each jump changes one part of the number, so there is never a
   carry to hold in your head.

The worked example is built by the same function that builds a real problem,
so what she teaches cannot drift from what the spell sets. That is the whole
reason it lives in `src/spells/lesson.ts` rather than in the panel that draws
it — an example with its jumps written out by hand is an example that can
quietly stop matching the thing it teaches.

## Current milestone

A player moving through a world of multiple terrain types, planting
multiple types of crop, and growing them with the first spell. Planting is
still a direct action — pick a seed from the pouch, or press a key — since
the planting spell is not speced. Both gardening actions work the tile the
player faces. Growth is real: a crop starts as a seedling and reaches
maturity in two casts of the addition spell. No harvest loop yet. Nothing
is saved between sessions except the two options — the language and the
money — which would be no use as options if they had to be set again every
time.
