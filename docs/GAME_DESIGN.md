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
- **Nothing is locked behind being good at arithmetic.** This began as
  "learning over gating — every spell is available from the start", and the
  half of it that matters is unchanged: no spell is ever taken away for a
  wrong answer, difficulty only ever changes the *numbers*, and the growth
  spell — which is how the garden is tended — is a child's from their first
  minute. What has been narrowed is the other half. The portal spell is
  learned from the geometer in the tower, so *meeting somebody* can gate a
  spell where *answering correctly* never may. That is the reason to walk up
  the tower, and it makes him someone you find rather than someone you could
  play the whole game without noticing. An unlearned rune is still drawn in
  the spellbook, dimmed, and says where to go when it is tapped.
- **No manipulative engagement mechanics.** This is a single-player
  educational game, not a live-service one — no artificial scarcity, no
  daily-login hooks, no grind economy engineered to maximize retention.
  If a player can earn effectively unlimited money by genuinely enjoying
  a loop that still requires actually solving a minigame every time — the
  friction is real engagement, not a timer — that's fine. Nothing here is
  trying to control how often someone plays. (This used to be illustrated
  with "helping villagers", which was a request loop that got designed and
  never built, and has since been abandoned outright. The principle stands;
  the example was the only thing that leaned on it.)

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

### Spells (math minigames)

Specified one at a time, each mapped to one action the player takes in the
world — planting, tending, travelling — and one math skill. Most are
gardening; the portal spell is the first that is not, and it is what settled
that the rule is "a spell's effect mirrors its mathematics", not "a spell
tends a crop". Nothing beyond what is written below
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
of crops. Both are the same widget: tap the container to see what is
inside, tap one of the things inside to use it. Neither container is marked
with any one of its contents — a plus on the book or a carrot on the pouch
would be wrong the moment there are two of either.

**A seed goes down where she stands. A spell asks where it lands.** That is
the one place the two trays part company, and it is the difference between
a hand and a spell. Pressing a seed plants it on the square she is pointing
at, or the one she faces — near enough that she could have reached down and
done it. Tapping a rune only *arms* it: the rune rises over her head and
pulses, the ground it can be sent to is ruled off round her seven squares by
seven, and the next tap on the world says where. Tapping the lit rune again
puts it out.

A spell is a question in two parts — *which spell*, and *on what* — and for
a long time the game only asked the first, answering the second with
whichever square she happened to be facing. Lining a character up with a
square is a thing an adult does without noticing and a six-year-old cannot
do at all. It was tried the other way round first, tapping the ground to
point and then the rune, and that is the same two parts asked in the order
where the child has to commit to a place before she has chosen a thing.

**Nothing else selects-then-confirms.** A two-step action on a phone is two
chances to lose the tray to a stray tap, and it asks the player to read a
caption to find out what they are about to do. The spells earn their second
step by having something to ask that only the child can answer, and they ask
it in pictures: a lit rune and a ruled square, no words at all.

**There is no caption any more.** The screen used to carry a status line
above the message line — the key hints, "you are carrying three carrots", the
name of whichever panel was open. It was a paragraph of interface explaining
an interface that had since learned to explain itself: the trays show what
they hold, the badges count it, the panels have titles of their own, and the
postal worker walks the basics over in person. One line of HUD text is left,
and it says what just happened.

#### The addition spell — growth (implemented)

**Action:** tap the rune, then tap a crop you have planted. One successful
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

#### The subtraction spell — clearing (implemented)

**Action:** tap the rune, then tap something in the way. One successful cast takes
it out of the world. That is the theme rule read backwards — the spell that
subtracts is the one that removes — and it is the same rule the growth spell
follows in being the one that adds.

**Floor, indoors.** In a house the minus rune takes a square of floor back up
rather than clearing ground — see "The house grows". Same rune, same number
line, and the same idea: the spell that subtracts is the one that removes.

**Crops as well as trees.** Planting had no undo: a carrot dropped on the
wrong square stayed there until it was ripe enough to pick, which for a child
who has just worked out what the seed pouch does is a mistake the game gives
them no way to take back. The minus rune pulls it up, at any stage, ripe or
not — a seedling and a full-grown carrot are the same act.

**And nothing goes in the basket for it.** Clearing a tree pays wood, because
taking a tree out of the ground is work somebody did. Pulling up your own
carrot is undoing something, and paying for it would make the minus spell a
second way to harvest — one that works *before* the crop is ripe, which would
quietly make the ripening stages pointless.

**Icon:** a minus, on the second rune in the spellbook. Built from the plus's
own arm and half-width, with the same sparks at the same four corners, so the
two sit in the book as one pair rather than as two drawings. What separates
them at this size is the count of bars, which is all a glance can carry.

**Effect:** the same symbol appears over the tile — and goes the *other way*.
The plus sinks into the crop because it is being added to what is down there;
the minus takes hold at the ground, bursts, and lifts what was there up and
out. Reversed it would say the spell puts something down, and it would still
animate perfectly well, which is why the generator has a test for the
direction rather than a comment about it.

**The minigame is the growth spell's, walked backwards.** The same number
line, the same three boxes, the same order — break what is being taken into
its ones, tens and hundreds, jump back by each in turn, read off where you
land. A borrow is a carry coming down, so it is the same `crossing` dial on
the same rung: a child who is not being given carries is not given borrows.

The parchment serves both spells and is told nothing. It works out which way
the line runs from the stops, so the sign over it can never disagree with the
arithmetic under it — and when the line runs down, **the start moves to the
right of the page** and the jumps go left, because a number line has smaller
numbers to the left and 988 drawn at the left edge would contradict every
number line a child has ever seen.

**It clears what the ground grew, and nothing else.** Trees, boulders,
outcrops. A fence or a lamp is *yours* — you bought it and set it down, and a
spell that unmade it would undo an afternoon's shopping from one mis-aimed
cast. The refusal says so in those terms rather than just declining.

Known from the first minute, like the growth spell. Not because nothing may
be taught — the portal spell is — but because this is the same instrument as
the growth spell, and a teacher who had explained one would have nothing left
to say about the other.

#### The portal spell — travel (implemented)

**Action:** cast it out of doors and a map opens. Pick a place; say how far
it is; the portal takes you there. Indoors it declines, and says so: the map
on the parchment is the world's, and a hole opened in the schoolhouse floor
would be measuring a journey from a room the map does not show.

**Going through it is shown, not skipped.** A spell about distance whose
distance is not crossed says nothing about what it did — the screen simply
shows somewhere else, which is what a bug looks like. So a doorway tears open
on the tile the traveller is facing, they are pulled into it, and it closes
behind them at the far end. Under two seconds altogether, because it plays
*every* time a child travels and an animation that delights on the first go
is a toll by the tenth.

**And the far end shows through it.** The ground inside the opening is
painted from the world's own grid, by the same loop that paints the terrain
chunks — so a hole in the village really is a window onto the harbour's sand,
and a moment later a hole in the harbour is a window back onto the village's
dirt. Anything else would be a lie about the place the hole is a hole into,
and that picture is the whole of what sells the crossing. Only the *ground*
comes through: trees and buildings at the far end are separate sprites and
are not drawn into it.

**Icon:** a pair of dividers, on the second rune in the spellbook. The
instrument rather than a picture of the effect — an arch or a swirling ring
would say "you go somewhere", which is true and says nothing about what the
child does. The same choice the addition rune makes in being a plus.

**The minigame:** the world's own map with a **ruler down each side**. The
traveller is the pale mark; the five named places are the red ones. Choosing
comes first and measuring second, because a distance to somewhere nobody has
decided to go is not worth working out.

**Every rung asks the same question — how far — and differs only in how much
of the answer is already drawn.** That is deliberately the shape the
addition spell's scaffolding has: pieces are taken away one at a time and
the question never changes underneath the child.

1. **Count the stones.** The path arrives drawn as stepping stones, one per
   mark. Count them. No numeral is read and nothing is added.
2. **Read one leg.** The stones go; the rulers are ruled *from where you
   stand*, so the mark a place sits on is the distance to it. One number,
   read rather than worked out.
3. **Add the legs.** Read both and add them — which is the path the portal
   actually takes: east, then north.
4. **As the crow flies.** The straight line, which is shorter. Squares,
   added, rooted, and **rounded to the nearest mark** — two places on a
   generated map are almost never a whole number of leagues apart, and a
   spell that only worked on Pythagorean triples would have to bend the
   world to fit. Bending it was measured: with a fixed ruler, fewer than half
   of all journeys can be made to come out whole even by choosing where in
   the destination to set the traveller down.

The capstone rules the two rulers from the map's western and northern edges
instead, as a real map does, so the legs have to be found by subtracting
before anything else happens.

**The ruler's graduation is the difficulty dial.** The world is five hundred
cells across, and five hundred is a three-digit sum before anything else has
happened. Ruled in fifty-cell leagues the same world is ten marks across and
every distance is a sum within ten; ruled in tens it is fifty marks and the
sums carry. One instrument covers a five-year-old counting stones and a
nine-year-old squaring numbers, and neither the map nor the journey changes
to move between them.

**Its own rung, and the same band.** Measuring a map and adding on a number
line are different skills, and a child flying at one may be nowhere near the
other — sharing one rung between them would drop a child who is good at sums
straight into squaring numbers. The band is a statement about the child
rather than about one spell, so that is shared, and both ladders climb and
fall by the same rules.

**Where it may take you.** A place becomes a destination the first time the
traveller stands inside it; the village is theirs from the start, because
they live there. The ones nobody has reached are still drawn — dimmed, and
not pickable — because a map showing only where you have been is a map that
says the world is finished, and this one is mostly unexplored on purpose.
The place you are standing in is never a destination: a portal to where you
already are is not a spell, and its distance would be nothing, which is not
a question.

**Where it sets you down is not simply the middle of the box.** It was, and
the moment the enchanted forest grew a great tree at its heart a correct cast
put the traveller inside a trunk with no way out — the animation played, the
arithmetic was right, and the game was over. Nothing in the spell noticed,
because nothing in the spell had ever had to.

So the landing is decided *before* the measuring rather than nudged after it,
which is what keeps the mark the child measured to and the cell they arrive
on the same cell. A place that already knows where a visitor stands says so —
the forest's grove keeps a doorstep clear in front of the tree, the same cell
the world's connectivity carve aims at, so walking in and arriving by portal
put you on the same tile. Anywhere else, the landing is the nearest cell to
the middle that a traveller can stand on *and step off*, searched in rings and
never leaving the box: a landing outside the place would arrive somewhere the
map does not say you went.

`portal.test.ts` proves it over generated worlds by flood-filling from the
landing cell back to where the player started — "the cell is passable" is the
weaker check, and a cell against the trunk with the wood closed round it
passes it and is the same trap.

Reached places are per child rather than per device, though the world is
shared, for the same reason the purse is: walking to the Harbour the first
time is something a child *did*.

**No fail state**, exactly as the growth spell has none. A wrong answer
clears the box and offers help after the second one; closing the parchment
walks away. `src/spells/portal.ts` is the whole of the rule, with no Phaser
in it, and `portal.test.ts` pins the measuring, the ladder and the stones.

**It has to be learned first.** The rune is in the spellbook from the start
but dimmed, and tapping it says someone in the tower knows this one. Speaking
to the geometer is what teaches it — meeting him, not finishing his lesson,
because a child who closes the parchment early has still met him and should
not be punished for it. Said once: `learnSpell` gives back the same list when
it already knows, so he cannot announce it every time you say hello.

**And there is somebody to ask.** The crow's flight wants squares and roots,
which is years past the arithmetic the rest of the game asks for, and for a
while nothing in the world taught it — a child could be carried up to that
rung by the adaptation with no lesson, no hint that named the operation, and
nothing to do but fall back out. The geometer in the tower is the answer;
see "Three teachers" below.

#### The array spell — multiplication (implemented)

**Action:** tap the rune and choose which spell you are multiplying — the
plus rune or the minus rune, drawn as themselves. Then mark two corners on
the ground, **cast that spell once** by hand, and only then is the rectangle
of dots put on the parchment with its one question under it: how many squares
is that? Answer it and the thing happens to every square of the patch that
can take it.

**The choice is two runes, not two words.** It carried the words for a while —
"grow it", "clear it" — and words are the one thing this game will not put in
front of a child on its own. The rune is what they already tap to cast the
spell; the same picture asking which spell to multiply is a question they can
answer without reading anything, in any language. Indoors the answer is
always the plus rune, so nothing is asked at all: a menu of one is not a
choice, it is a tap that asks a child to confirm a decision the game already
made.

**And it multiplies spells, only ever spells.** Planting was on the list once,
and it was the one thing here with no arithmetic behind it: mark out six by
seven, answer one multiplication, and forty-two squares are planted having
cast nothing. That made planting the obvious pick every time and turned the
times spell into a way of *avoiding* sums. A seed goes in the ground one at a
time now, which is what putting a seed in the ground is.

**What, then where, then once, then how many.** The choice used to come after
the rectangle was drawn, off a menu that also said how many squares each
action would land on — which is the answer to the multiplication about to be
asked, sitting on screen a second before the question. Asking first takes it
away, and it reads better besides: a child decides what they are doing and
then goes and does it, rather than drawing a rectangle and being asked what
it was for.

**And the spell is cast once before it is multiplied.** One addition, or one
subtraction, or one wall of bricks — by hand, on the parchment it normally
uses — and then the question of how many times. That order is the spell's
whole argument. Multiplication is doing the same thing many times without
doing it many times, and a child who has not done it once has not been shown
what is being multiplied. Planting is the exception, because putting a seed
in the ground has no sum anywhere in this game; there is nothing to
demonstrate.

The patch is checked for whether the chosen spell has anything to do in it
*before* any sum is asked, so a choice that turns out to land on nothing
costs a tap rather than two minigames. And walking away from the first
parchment ends the whole cast: nothing is marked out any more and nothing
happens, which is the same rule every other spell follows — there is no fail
state here, and closing a panel was never one.

**And the rectangle gets a beat to itself.** The second corner used to land
and the parchment arrive in the same frame, so the only thing a child ever
saw of what they had drawn was the *first* corner. Four hundred and twenty
milliseconds — the same as a refusal mark, and for the same reason: long
enough to take in, short enough not to be waiting, on something that happens
on every cast. Taps do nothing while it runs, or a child tapping quickly
would re-anchor a corner on a rectangle the game had already accepted and be
asked a second sum for it.

**The child draws the rectangle**, and that is the whole design. It began as
a spell that chose its own patch and planted it, which worked and taught
much less: the numbers in the question are now numbers the player made with
their own hands, on ground they were looking at. A spell about area whose
area somebody else picked is a worksheet with a garden behind it.

**One multiplication buys many of something**, which is what multiplication
is *for* — doing the same thing many times without doing it many times. The
thing itself is one of the game's own spells, so the array spell is not
another kind of action but a *way of casting one of them many times over*:
twenty crops grown, or twenty thickets cleared, or twenty squares of house
built, for one `4 × 5`.

**It is not a number line, and that is the point.** Addition walks the line
up and subtraction walks it down; both are journeys, and one parchment serves
them because they are the same instrument used two ways. Multiplication is a
*shape*. Bolting it onto the number line would have meant nine boxes of skip
counting on a phone.

**Icon:** six gold dots, two rows of three. Not a saltire — a cross is the
plus rotated forty-five degrees, and at thirty-two pixels on a phone that is
the addition rune drawn twice.

**The ladder changes the help, never the size.** The child sets the numbers by
drawing; a rung that also set the size would be locking a *tool* behind
arithmetic, which the difficulty rules explicitly forbid. So the progression
is scaffolding being withdrawn:

1. the dots are drawn and the first three rows arrive counted for you;
2. two rows counted, then one;
3. the dots are drawn and nothing is counted;
4. the same, and the parchment waits a wrong answer longer before it starts
   counting for you;
5. **no dots at all** — an empty grid with `6 × 7` written over it, which is
   the times table asked as a times table.

A child who draws two-by-two forever still climbs that ladder, and ends up
doing `2 × 2` from memory instead of by counting four dots. That is exactly
what the times tables are.

**Which squares are live is shown before the question, not after.** The
question is about the whole rectangle — that is what they drew — but a
rectangle mostly hanging over a roof is one they meant to draw somewhere
else. So squares nothing could happen to are dimmed on the ground, and the
menu says how many each action would touch. The tally is the honest number;
the question is the drawn one.

**A patch of one square is refused**, gently: the corner simply moves there
instead, which is what a child who tapped the same cell twice almost
certainly meant. A single *row* is fine — five in a line is a good first
times table.

**No fail state.** A wrong answer clears the box and lights one more row of
the array with its running total beside it; the last row is never lit,
because that one is the answer.

**It is earned, not given**, and it is the only spell in the game that is.

The tree used to teach it for being touched, the way the geometer teaches the
portal spell for being spoken to. That was too cheap for this one: it takes
twelve crops from seed to ripe in two casts where the one-at-a-time route is
twenty-four number lines, so a spell handed over on a tap quietly removes
most of the arithmetic in the game.

So the great tree sets a task, and the task is **doing the long way once**:

1. **Clear the wood that has closed over its beds** — six thickets, six
   subtraction problems, and the one spell the game otherwise under-uses.
2. **Fill four beds of two by two with sunflowers and ripen them** — sixteen
   squares, planted one at a time and grown to ripeness. Thirty-two number
   lines: precisely what one array cast will later replace.

Two by two because that is the array spell's own smallest shape, and four of
them because four is the shape of the spell itself — the child lays out by
hand exactly the thing they are about to be given. And **sunflowers**, not
anything ripe: a tree that would take whatever was to hand is a tree whose
beds get filled by accident on the way past, and the errand is the whole
reason the spell is worth having.

That is not a gate bolted onto a spell, it *is* the lesson. A child who has
filled four two-by-two beds by hand knows in their hands why `2 × 2` four
times over is worth one cast.

**The beds are grass with their corners marked**, not bare earth and not
bordered. Earth in a clearing read as a hole in the grass rather than as
somebody's plot — and three attempts at a border round each bed came off
badly, a lattice of diamonds, a ring of stars, a thin dark frame with specks
on it. The fault was never the drawing. A border on grass has to be a *line*,
and a line at this scale is either loud enough to read as a fence or quiet
enough to read as wire, with very little in between.

Four points at the corners of a small square say *square* with no line at
all, which is the geometry doing the work instead of the art. The glowcap was
already there to do it: it is the forest's own signal, it lights the ground it
stands on after dark, and it needed no new pixel drawn.

The ring of eight lights that used to stand round the trunk went with the
change. Its job was to make the clearing read as *kept* rather than as a gap
in the trees, and sixteen lights at the corners of four beds do that better —
they say kept *and* say what for. Two rings of lights round one tree said
neither: the beds' corners were lost among lights that meant nothing.

**One at each corner around the tree**, each a two-by-two inside its own ring
of vine. The first attempt was a single seven-by-seven block holding all four,
and it sat down and to the left of the trunk — which reads as a plot somebody
put beside the tree rather than as the tree's own. Four corners puts the tree
in the middle of what it asked for. They sit outside the ring of glowcaps, so
neither those nor the doorstep below the trunk is ever underneath one.

The vine is walked over, not walked round: a border you cannot cross is a
wall, and the bed inside it has to be reachable.

**And the clearing is always the same picture**: a ring of woodland round a
patch of grass, made rather than inherited. It used to take the terrain of
whatever band the box landed in, which put the great tree in a field of scrub
as often as not.

**Round, and not quite round.** The picture is the same one; the shape it is
drawn in is not. The clearing used to be measured in Chebyshev steps, which
draws a square — a nineteen-tile lawn in the middle of a wood, reported from
a playtest as *the enchanted forest is too square, it looks unnatural*. It is
a distance now, with a boundary that wanders: two waves of different
frequency, phased off where the box landed, so the edge is different in every
world and never repeats itself round the circle. The wood outside it thins
back to the density the world scatters woodland at, rather than thickening to
the edge of the anchor box and stopping dead, and the corners of the box the
wood does not reach are scattered at the country's own rate — because the
world's scatter skips reserved areas, and anything the grove does not put
there is a square hole cut out of the countryside.

The box grew from twenty-four tiles to thirty-six to pay for it. A round
clearing has to hold the four beds in every direction rather than only along
the diagonals, and their far corners stand ten tiles out; at twenty-four that
left a ring of wood a tile or two thick, which is a hedge round a lawn.

It also does not break "learning over gating", and the line is worth being
exact about. Nothing here is locked behind **being good at arithmetic** — a
child who answers every one of those thirty problems wrongly still finishes
the task, because a wrong answer costs nothing and the spell fades rather
than failing. What is locked is behind **having done something**, which is
the same kind of thing as having climbed the tower to meet the geometer.

**The lesson comes first and the task second.** The tree explains the spell on
the very first visit and on every visit after, so the picture they are working
toward and the spell they will get are in front of them from the start. What
changes with each return is one line: how much wood is still standing, then
how many of the twelve squares are ripe.

**The task keeps no state of its own.** Whether the wood is gone and whether
the bed is ripe are read off the world, and both are things a save already
records — cleared scenery and planted crops. So it survives a reload without
a single new field on the player, and it cannot drift out of step with the
ground it is about.

##### The camera pulls out while a patch is being drawn

**A reach you cannot see is not a reach.** The spell lets a child draw ten
squares across. At the world's own zoom ten squares are 640 screen pixels and
an iPhone is 390 of them, so the far corner of anything but a small rectangle
was simply not on the screen — and a playtest came back with children who
could only ever mark one row or one column.

It bites hardest **indoors**, which is where it was reported. A cottage fills
a phone from wall to wall, and the squares this spell *builds* on are the ones
beyond those walls: the ground a child was being asked to draw round was the
one part of the room they could not see at all.

So while a patch is being drawn the camera pulls out far enough to hold the
whole reach, and goes back the moment it is not. **On a desktop nothing
happens** — the reach already fits at the world's own zoom — which is the
half of it worth stating, because a fix for phones that quietly halved every
other screen would be a worse bug than the one it fixed.

**Whole zooms only.** The renderer is built on every world pixel landing on a
whole number of screen ones; a fractional zoom shimmers. So it picks the
largest whole zoom that fits rather than the exact one that would, and never
goes below 1 — under that a tile is sixteen pixels and a finger is not. On a
phone that lands on 1, which is half of the world's usual 2. The playtest
asked for "25%"; that is a solution rather than a requirement, and taken
literally it is eight-pixel tiles, which is unreadable pixel art in a game
for children who cannot yet read words either. The requirement in the report
is *let them pick more than one row*, and the number that satisfies it is the
one the reach asks for.

**It is the same fix outdoors**, and it is applied there too. The report said
"in the house" because that is where the children hit it, but a ten-square
patch does not fit on a phone in a garden either, and gating the fix to
interiors would leave the same child stuck at the same wall one wall further
out.

Two things follow a zoom and neither follows it by itself. A room's camera
bounds are worked out from the view in *world* pixels — the viewport divided
by the zoom — so a room framed at one zoom and shown at another is framed
wrong, which indoors is precisely where this fires. And the lights are drawn
in screen pixels "at the world zoom", which was a distinction without a
difference until the zoom moved: left alone, a lamp in a cottage at night
would visibly swell the moment a child armed the times rune. Both are handled
where the zoom is changed rather than at either call site.

##### And a child can pull it out herself, with two fingers

The spell moving the camera is the game deciding when a wider view is wanted.
A playtest asked for the other half: **pinch to zoom, out to a half.** Two
fingers on the glass, and the world follows them.

**It rests on whole zooms and moves between them.** Same rule as above and
for the same reason — a camera left at 1.37 draws every third row a pixel
taller than its neighbours, which on hand-drawn tiles reads as a printing
fault. But a gesture that jumped from one whole number to the next would not
feel like a pinch at all; the whole of a pinch is the picture staying under
your fingers. So it follows them exactly while they are down and lands on a
step when they lift. Shimmer under a moving finger is invisible; shimmer in a
picture nobody is touching is a bug.

**Two steps, because there are two.** The world's zoom and half of it — which
is what "out to a half" means when what is being halved is how big everything
is drawn. Halving the world's 2 lands on 1, so both are whole numbers and the
rule above costs nothing. There is no third step in: bigger than the art was
drawn is not a view of the world, it is a worse copy of it.

**Her choice outranks the spell's.** The camera is asked how far out it
should be at every viewport change and at both ends of the array spell, and
that question used to be answered with the world's constant. It is answered
with *her* zoom now, and the spell's reach is a ceiling on top of it — so a
child who has already pulled the view out is not zoomed back in by arming a
rune, and putting the rune out leaves her where she was rather than where the
game started.

**A pinch is not a tap, and the finger it leaves behind is not a joystick.**
A second finger landing while a rune is lit would otherwise cast the spell at
whatever it touched, and a pinch ends with one finger usually still down —
which would become a steering stick the instant its partner left, sending the
child walking at the end of every zoom. Both are refused for as long as the
hand is on the glass.

**The view is not written down.** Where you are looking is not something you
own, and a game that reopened zoomed out because of a pinch three days ago
would be a game that had rearranged itself while nobody was there.

#### The hourglass spell — telling the time (implemented)

**Action:** two clock faces on the parchment — when you put the game down and
when you picked it up — and one box. Say how many hours you were away, and
that many crops move on a stage.

**It is the only spell that pays for time actually passing.** Crops here grow
only by being cast on, so nothing happens while nobody is playing, which is a
real absence in a game about a garden. This is the astronomer's answer, and
the price of it is being able to read a clock.

**The arithmetic is unlike everything else in the game.** Twelve rather than
ten, and a circle rather than a line — so "four hours after ten" is two, and
every instinct a child has built on the number line says twelve. That is the
whole reason it is worth a spell.

**The question is not invented.** The two times are when this child actually
put the game down and when they actually came back; nobody chose them. The
world's own timestamp already exists on the save, written by the autosave
timer rather than on the way out, so it survives a killed tab and is never
more than one autosave behind.

**The glass reads the hour, not the minute.** Both faces are rounded to what
this child's rung can read — the hour at the bottom of the ladder, then the
half, then the quarter — and the span is measured between the *rounded*
faces. A small lie about the clock and the right one: the face a five-year-old
is reading is rounded to the hour, and "four hours and thirty-five minutes"
is not a question about telling the time. A twelve-hour face cannot tell half
a day from none, and the spell says so rather than inventing a number the
picture will not support.

**The ladder is how a clock is learned**, and never how long you were away —
that is the child's own business. Numerals printed round the face, then taken
away, then the hands moved off the marks altogether.

**Which crops grow is visible.** The ones *nearest the player*, not the first
found in scan order: a child watching four crops move on with no way to tell
why those four is the same complaint as a spell quietly choosing her seed for
her. She can stand where she wants it to land.

**Once per return.** The absence is spent the moment it is claimed, and the
rune says so until there is another one.

**And not at all with an empty garden.** With nothing in the ground the child
would read the two clocks, get the answer right, and be told that nothing
grew — while the hours were spent, because a cast that landed is a cast. So
the spell refuses before the parchment opens and says what is missing. A
question whose correct answer pays nothing is worse than no question.

**It is earned**, from the astronomer in the dome, by lighting the path up the
mountain.

##### The astronomer's task — light the way up

The second earned spell, and deliberately the *smaller* of the two tasks. The
great tree asks for thirty problems because the array spell would otherwise
remove most of the arithmetic in the game; the hourglass removes none — it
pays out for time that passed while nobody was playing, which no amount of
casting anything else can produce. So its task is not a toll. It is a reason
to have walked up there.

The climb to the dome has **five lamp posts** up its left-hand side, and they
start dark. Speak to the astronomer and she asks for them to be lit; put a
lamp on each; speak to her again and she teaches the hourglass.

**She supplies the lamps.** They are eight crops each in the store — forty
harvests for five, which is eighty number lines and a quest about *money*
rather than about time. So she tops the child up to however many posts are
**free**, which needs no record of what she has given: the empty posts are the
record, and nobody can come away with more lamps than there are places to put
them.

Free rather than dark, and the difference matters: a post is a cell that was
clear when the world was made, and nothing stops a child fencing one
afterwards. Counted against the dark posts, that fence would be a post she
could never light and a lamp handed over on every visit for ever.

**The posts are drawn, not placed.** A lamp needs the cell to be empty, so a
marker that was an object would be a marker standing in its own way. Each
empty post is a socket painted on the ground — dark stone with a lit rim —
that fills the moment a lamp stands on it. Without them the astronomer says
"put them on the empty posts" and the posts are five cells of bare dirt in a
path of bare dirt; with them the climb carries its own instructions and its
own progress bar: five holes, then four, then none.

**Like the great tree's, the task keeps no state of its own.** Whether a lamp
is standing on a post is a thing the save already records, so there is no
field on the player and nothing that can drift out of step with the ground.

**Why *this* task and not a sum.** Lighting a path is the one chore in the
game that is legibly about coming back after dark, and the dome is the one
place in the world that cares what hour it is. The child does the thing the
spell is about before the spell exists.

##### The parchment says it as well as draws it

The errand opened as a picture and nothing else: five lamps, an arrow, a
rune. That is the right picture — a countable row of identical things is
exactly what she is asking for, and a child too young to read a sentence can
still watch five holes go to four. What a picture cannot do is say whose path
the lamps are for, or that the shape under the arrow is a spell rather than a
decoration. A reader was being handed a rebus instead of an errand, and the
older sibling reading it out to the younger one had nothing to read.

**So both, every time, each beside the thing it belongs to.** Her name and
what she wants sit over the row; what the rune is worth sits under the rune.
The number is in both — the row for anybody who cannot read it, the sentence
so that a child who has just been told "five still to light" is not then made
to count the dim ones to check. Nothing was taken out of the picture to make
room for the words.

The same rule closed the other wordless thing in the dome. The chart of the
night on the wall held itself up with nothing written on it, on the grounds
that describing a picture to somebody who is looking at the picture is wasted
breath. That is true of the description and false of everything else: the
drawing does not say that it is *this valley's* sky, or that those are the
stars at midnight, and neither of those is anywhere in it to be looked at.

##### And the dome is open at night

Every door in the world used to keep the same hours: unlocked at eight,
locked at six. On the village that was nearly right — those are the hours
*people* keep, which is why they are deliberately not the hours the sun keeps
— and the village has since moved out to six until nine, for reasons of its
own (see "The village's hours" below). On the observatory it was absurd. The one building in the world whose entire purpose
is the night sky was open all afternoon and locked at dusk, and the woman
inside it was at a spyglass in broad daylight.

**So it keeps the hours of the thing it looks at**: open at dusk, shut after
dawn. An hour either side of the light rather than on it, for exactly the
reason the village opens after sunrise — these are a person's hours, and
somebody who watches the sky is at the eyepiece before the last of the light
has gone and still there when the first of it comes back.

It makes the errand above mean what it always said it meant. "Lighting a path
is the one chore in the game that is legibly about coming back after dark"
was written of a dome you could walk into at noon. Now the lamps are lit for
a climb that has to be made in the dark, and the reward for making it is a
spell about the hour.

**And it gives the hourglass a second direction to turn.** Winding the glass
forward to morning is how a child gets past a shut village; winding it on to
midnight is how she gets into the dome.

They were exact opposites when the village shut at six, and the glass was
then the *choice* of which door rather than the key to one. Moving the
village out to nine has taken that trade away and left the half of it that
matters: every hour the village is shut, the dome is open, and there is now
no hour of the day with nothing open in it at all. Where it used to be that
both doors were locked through the dusk — a child sitting down at half past
six found a world that had gone to bed — the two ranges now overlap in the
evening instead, and the astronomer is at her eyepiece while the shops are
still trading.

##### The village's hours

**Six in the morning until nine at night.** They were eight until six, and
the argument for those was sound — the hours *people* keep are not the hours
the sun keeps, and moving the light instead is how a world ends up dark at
six in the evening in high summer. The numbers were still wrong, in two ways
a playtest found.

The village shut two hours before sunset. So a door tried at seven answered
*they have gone to bed*, with a moon over her head to say why, under a bright
sky — a picture with nothing behind it. And the hours a five-year-old is
actually free are the ones on either side of a school day, most of which fell
outside them: the world was asleep whenever she could play.

Waking with the sun and staying up an hour past it fixes both. The two pairs
are still two facts and must stay so — the last hour of trading is dusk, and
that hour is where you can see the difference — but they now agree about the
one thing a child reads off them, which is that a shut door means a dark
street.

**A shut door says which way it is shut.** Every refusal in this game is a
cross on the door and a picture saying why, and the picture was a crescent
moon. A moon on the dome at noon would be telling a child *come back when it
is dark* in the same picture the village uses to say *everybody is asleep*.
So there is a sun as well, and the door shows whichever of the two is the
reason. It is read off the hours the door keeps rather than from a list of
which buildings are odd, so a building that changed its hours cannot end up
with the wrong picture on it.

### How big everything is

Measured in **people**: a character is 32 px of drawn ink, which is exactly
one tile, and that is the ruler the whole world is read against.

| | | | |
|---|---|---|---|
| chicken | 0.56 | broadleaf tree | 1.28–1.97 |
| sunflower | 0.31 | conifer | 1.41–1.88 |
| beach rock | 0.31–0.69 | mountain spire | 1.25–1.88 |
| boulder | 0.41–0.88 | schoolhouse | 3.28 |
| fence | 0.50 | cottage | 3.62 |
| | | townhouse | 4.88 |
| | | the great ship | 5.66 |
| **player** | **1.00** | barn | 3.50 |
| well | 1.06 | observatory dome | 3.69 |
| | | tower | 6.22 |

**The built things are single numbers and the grown things are ranges**, which
is the difference between a thing there is one of and a thing there are forty
thousand of. A cottage is 3.62 people because there are seven cottages and
they are the same cottage; a conifer is anything from 1.41 to 1.88 because a
wood has saplings in it and it has old growth. See "A wood is not one tree"
below — the ranges are new, and they are new for a reason worth reading.

It had drifted, and the drift was invisible because every asset class has its
own tests and each was internally consistent. A boulder stood one and a half
people tall — a menhir, not something you could sit on — and a conifer two
thirds the height of a cottage, so a wood and a village carried the same
visual weight and neither read as what it was.

**Built things are the tall ones and nature sits under the roofline.** That is
a storybook scale rather than a truthful one: a real conifer towers over a
real cottage. It is chosen because the village has to be the landmark of a map
a six-year-old is navigating, and a child has to tell a building from a wood
at a glance from across the screen.

The built props were always right and are what the rest was measured against —
a well you draw from is 1.06 people, a fence you step over is 0.50. The
animals are deliberately chunky at 0.56, because a child has to spot and tap
them, but never as tall as the child.

**The city's house is its own shape.** A townhouse is two tiles of frontage
against the cottage's three and half again as tall — 4.88 people. What says
*city* at a glance is not how many houses there are but that they are narrow
and tall and stand shoulder to shoulder, because land in a city is worth
something and a house grows upward instead of outward. It stops well under the
tower: a street of houses that stood as tall would leave the tower with
nothing to be.

**The tower is the exception that proves the rule.** At 4 people it was a
two-storey shed; it is 6.22 now, tall enough to be seen from across the
village — which is the point of it, since it is where the map on the wall and
the geometry teacher are. It carries a telescope on its peak, which is the one
silhouette cue that says somebody up there looks at things.

`tests/test_scale.py` in the generator pins the whole ladder, including the
relation that started it: every tree is shorter than every house.

### A wood is not one tree

World generation puts down about **forty thousand conifers** on a 500×500 map
and a couple of thousand of everything else, so nine impassable objects in ten
in the whole world are the same sprite. The generator had always known this —
it renders several distinct individuals per terrain precisely because "one
silhouette repeated that often reads as wallpaper" — and it shipped a wood
that was, in a screenshot, one tree tiled across the entire screen.

Three things were wrong, and the obvious one was the least of them.

**More individuals did not help.** Going from four to twelve produced twelve
trees that were, side by side on a strip, indistinguishable. At this size a
conifer is a stack of triangles, and a stack of triangles two pixels wider is
the same stack of triangles — so no amount of widening the shape ranges was
ever going to break up a formation. This is the part that had to be seen
rather than reasoned about: the strip of twelve is what settled it.

**Every tree was the same colour.** Woodland ground is emerald and the fir
above it was the same hue a few steps down, so tree and ground shared a
colour and a wood came out as one green field with a texture on it. Each
species now carries several complete colourways — four conifers, four
broadleaves, three shades of dead wood, three stones — and an individual wears
one of them, cycled on the instance index. Twelve is a whole multiple of every
one of those counts, which is what makes the cycle hand each colour out the
same number of times rather than rolling five trees the same green.

*Complete* ramps rather than per-channel jitter, because a palette here is the
dark, the lit face and the highlight of one material, and moving those apart
unshades an object instead of recolouring it.

They are chosen the way the original ramps were: against the ground the thing
stands on. A conifer that drifted toward the emerald under it would not read
as a different tree, it would read as a tree that vanished. So the four are
spread across hue *and* value — the original deep teal fir, a blue spruce, a
warm pine that separates from the emerald by leaning the other way rather than
by going darker, and a near-black old fir that gives a flat green field the
one thing it had none of, which is depth.

The broadleaves include a **copper beech**, and it is the one worth arguing
for. A deep russet on yellow-green grass separates further than any of the
greens do — the opposite side of the wheel rather than a few steps down it —
and a copper beech is that colour in June. It is read as a species and not as
weather on purpose: this world has a day and a night in it but no seasons, and
a field of half-autumn trees would be saying something the rest of the game
never says. A brighter autumn yellow was tried first and read as a tree that
was dying.

**And the size band was a band on the species.** Every conifer in the world
stood 1.75 people give or take a hat, so a wood had a level rather than a
skyline. It is a band on the *individual* now. The ceiling has not moved — it
is the roofline, and nothing the ground grows may come near a house — but the
floor came down to just over the player's own height, which is the least that
can be called a tree rather than a bush. That is the whole reason the table
above has ranges in it.

**Rock gets less of this than wood, deliberately.** A wood is many trees of
many kinds; a hillside is one rock broken up, so stone has three shades of
itself rather than four species, and they are spread on value rather than hue
— all three have to keep working on slate mountain, lime hilly and golden sand
at once, and hue is already doing that job. A field of harlequin boulders
would read as a bug.

**A big boulder is a small boulder drawn larger.** Widening each mass in a
rock cluster independently was the obvious way to get both sizes and it was
wrong: the masses stopped overlapping, so a boulder came out as two rocks with
a notch between them instead of as one lump, and a hillside of those read as
litter. The roll is on the cluster as a whole and the arrangement inside it is
left exactly as it was.

None of this cost the game anything to draw. The sprite count is unchanged —
the same trees stand on the same tiles — and what changed is which frame of a
sheet each one shows. The six sheets together grew from 35KB to 101KB.

**What variety cannot fix is density.** The densest wood in the default world
is 391 trees in a 24×18 window — about nine tiles in ten — and at that packing
it still reads as texture rather than as individual trees, whatever colour
they are. That is world generation's business and not the art's.

### Nothing casts a shadow

Every sprite in the game used to be given one: an ellipse of dark indigo
stamped as a dot screen, a quarter of the pixels taken, because "40% black"
would have been off-palette blending in art that has no blending anywhere.
It was the textbook pixel-art answer and it was the wrong answer here. At
this scale the dots do not read as shade, they read as speckle on the ground
— and the ground is already speckled, so a character walked around with a
patch of grit following them.

They were also frequently *wrong*, which is the part that settled it: a flat
ellipse under a tree whose canopy is nowhere near it, one under a fence post
one pixel wide, one under a bird. And they hid a real fault — one boulder in
four was scattered so that it floated a third of a tile above its own ground
line, and nobody noticed for as long as there was a shadow stamped at that
line whatever the rock did. Taking the shadows away is what showed it.

What seats a sprite on the terrain now is the terrain: an object is drawn
standing at the bottom of its own cell, and that is the line it sorts on.

### Three teachers

The schoolteacher explains the growth spell, the geometer explains the portal
spell, and the great tree explains the array spell — three rather than one
for the reason the three spells have separate rungs: measuring a map, adding
on a number line and seeing a rectangle as rows are different skills, and a
child flying at one may be nowhere near the others.

**He is in the tower**, which is the post office — the first building in the
village with two people in it. The postal worker walks the square and the
geometer is upstairs, beside the map on the wall, which is the one thing in
the village that was already about distances. The tower's room was grown from
six cells by five to nine by seven to hold all three of them: a map on the
wall, somebody standing at the back, and a child walking in.

**You have to know which teacher you walked in on**, so they are told apart
by silhouette rather than by colour — sixteen pixels across is not enough for
anything else. She has a bun, a skirt and a book; he has a floor-length robe
with no legs under it and a set square, which is the one instrument that *is*
the lesson. Deliberately no pointed hat: she gave hers up because in a game
whose magic is the mathematics, "magic user" is the wrong thing to say about
the person who explains it, and a second teacher under a wizard's hat would
say it twice as loudly.

**His lesson is four pictures**, exactly as hers is: the rune, the ruler, the
two legs, the crow's flight. The last three are *the same triangle*, gaining
one thing each time — redrawing a different picture per page would make three
ideas out of what is one idea seen three times. It is drawn to scale from the
marks, so a three-four-five triangle looks like one and the straight line is
visibly shorter than going round, which is the whole of what the last page
says.

**Every beat is shown at every rung**, and only the numbers change with the
child — the same rule the addition lesson follows, and the design's: a lesson
is not a gate. His example is pitched so the triangle comes out whole at
every ruling — four and three at fifty paces a mark, eight and six at
twenty-five, twenty and fifteen at ten — so a five-year-old on the coarsest
ruler meets the crow's flight as a three-four-five triangle, which is the
friendliest one there is. The spell itself rounds, and says so on that page;
teaching gets the clean case, because a method is easier to see when the
arithmetic is not also in the way.

**The third teacher is not a person.** The great tree in the enchanted forest
teaches the array spell, and it being a *thing* is the point: nobody lives in
the old wood, so a teacher who was somebody standing in a room would have
needed a house built round them and the forest would have become a second
village. You walk up to it and touch it, the way the map on the tower wall is
tapped rather than talked to — and unlike the map it has a reach, because a
tree you could tap from across the clearing would be a tree that answers the
whole wood.

**Its lesson is four pictures** like the other two: the rune, the patch as
rows, counting along by rows, and then the patch turned on its side. That
last page is the one worth having a lesson for at all. A child can arrive at
`6 × 7` by counting; nothing in the spell itself ever tells them that `7 × 6`
is the same patch turned round, and it is the single fact that halves how
much of the table they have to hold. The three patch pages are drawn at *one
scale on both axes* — a picture that stretched to fill the panel would draw
the turned patch at a different size and quietly undo the argument.

Its worked example is the middle rectangle its rung can set, never a square:
a square turned round is indistinguishable from a square, and the last page
would have nothing to show.

### Everybody has a name

The people in the world used to be their jobs. The welcome said *the
shopkeeper*, *the teacher*, *the geometer*; the shop panel said *she buys*.
That reads as a village of functions rather than of people, and in one place
it had stopped working altogether: there are **seven shops** in the world now
— the village's, five in the city, two on the quay — and they share one
apron, one room, one stock and one set of sentences. Walking into any of them
got a panel headed "She buys". Nothing anywhere told a child which shop they
were standing in.

So everyone is somebody. Six parts are named by hand — Bruno the postman,
Lena the schoolteacher, Anton the geometer, Mira the village shopkeeper, Vera
the astronomer, Emil the clockmaker — and everybody else is handed a name
from a list: the women behind the other counters from one, the villagers,
townsfolk and quayside folk from another.

**The names are the same in every language**, which is the argument the coins
already make: a name is a proper noun, and two siblings on one tablet playing
in two languages should not be calling the same person different things. It
also means one table rather than three, and no way for somebody to lose their
name in a translation.

That has a cost in Croatian, where names decline, and the cost is paid in the
*sentences* rather than in the names. Every line that uses one is written to
want the nominative — "Mira buys", not "sell to Mira" — which is why the shop
panel names her over her two columns rather than in its title. A title reading
*Mira's shop* would need a possessive built from an arbitrary name in three
grammars; a heading reading *Mira buys* needs none in any of them.

**They are handed out in cast order, not hashed from an id.** The same
reasoning that decides which villager wears which face: a world always
produces its people in the same order from the same seed, so walking the list
gives somebody the same name every time their world is rebuilt — and, unlike
a hash, it cannot give two of them the same one. That is not a theoretical
worry. A city shop's id carries the number of the *block* it landed on, which
is drawn at random and sparse, so anything modular over it would put two
Klaras in one city on some seeds and leave nothing to tell them apart.

**Every shopkeeper is a woman**, and that is a decision rather than an
accident. The shop's sentences say *she* — she owes you this, she counts it
out, she is wrong one time in ten — and they are one set of sentences shared
by every counter in the world. One sheet, one pronoun, one list of names that
agrees with it. A shopkeeper who read as a man would need those lines written
twice in three languages to buy nothing a player can see.

**The names stay off the nameplates.** A cottage's plate shows a face, or the
question mark that means *nobody has answered this* — and it shows a face
because much of the audience cannot read. Sixteen pixels of somebody's name
beside their door would help nobody who needed the plate in the first place.
Names belong where the game was already writing a sentence: the welcome, and
the shop.

Two of the six are named and not yet spoken of. The astronomer and the
clockmaker have their lessons but no line that says who they are, so Vera and
Emil are in the table waiting for one. That is the right way round — a name
added with the sentence that needs it is a name chosen to fit the sentence.

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
turn "go and do the thing" into "walk home first" — friction that pads a
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

It also gates **doors**, and not every door the same way. The village keeps
one pair of hours and the observatory keeps the other — see "And the dome is
open at night".

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

### Shelves, and the things a child asked for

**The children asked for a kitchen and a bathroom.** A playtest came back
wanting things to buy for the *house* rather than for the garden, and named
the two rooms every cottage has and this one did not. The room already had a
stove in it; what it had not got was anywhere to wash a plate or a child.

So there are six more pieces of furniture: a sink, a dresser and a kettle for
the kitchen, and a bath, a washstand and a privy for the washroom. All drawn
out of the same nineteen palette slots as everything else in a room, which is
the constraint that keeps them part of the set rather than a bolt-on — a tin
bath is the metal ramp, a dresser is the wood ramp, and the crockery and the
linen are the paper and the cloth the shelves and the beds already use.
Nothing here needed a colour the room did not have, and a piece that had
would have been the wrong piece.

**The bath is empty**, and that is a decision rather than an omission. There
is no blue in a room's palette, so water would have to be drawn in the metal
ramp — which is a bath with a lighter bottom, and reads as a clean bath
rather than a full one. An empty tub is a thing a child fills in their own
head.

**And the privy is a wooden box with the lid up.** Drawn as the thing it was
in a cottage, closer to a chest than to porcelain, because that is both what
belongs in this room's vocabulary and what keeps it from being the only piece
of furniture in the game a table of six-year-olds cannot look past.

#### The shop grew shelves

One column stopped working. The counter listed everything the shop sold in a
single run — seven things, then twelve, and eighteen with the kitchen and the
washroom in it. The rows shrink to fit until they hit a floor, and after that
they simply run off the bottom of the parchment; the footer was already
underneath the last of them before any of this was added.

So the stock is sorted onto **four shelves** — the garden, the room, the
kitchen, the washroom — and one is shown at a time. None is longer than
seven, which is what the parchment holds at a row height a child can read.

**The shelves are named by a picture.** Each tab carries one of its own
things as its icon: a fence, a chair, a stove, a washstand. Much of the
audience cannot read, and a row of four words would be the one place in the
game where finding what you want required it — the same argument the flags on
the language chooser make, and the marks on a shut door.

The tab that is out is the one drawn in full and the others are dimmed. That
is the whole of *you are here*: a highlight box would be a second thing on a
button that already has a picture on it.

**Each tab's picture is a piece that stands in one cell.** A tab is a square;
a bed is drawn two cells tall and a bath two cells wide, and either of them
shrunk into a square is a stripe rather than a picture of anything. So the
room's tab is a chair and the washroom's is a washstand, and a test says so —
it is exactly the sort of thing that would be quietly broken by somebody
choosing a nicer-looking icon later.

**Turning to another shelf is not a mode.** The same purse, the same basket,
the same half of the counter on the left. A shelf is where a thing is kept.

### Several children, one device

**A player is a person. The world belongs to the tablet.** It was one world
per child at first, deliberately — and the children who played it asked to
share. So the ground moved off the profile and onto the device: everybody
gardens the same land, taking turns, and a crop one child plants is one the
other can pick.

**What stays with the person is everything about the person:** their name,
their character, their language, how hard their sums are, their purse and
their basket. The purse is the one that is not obvious and the one worth
stating — a shared purse would let one child spend what another earned, and
on a family tablet that is a fight rather than a feature. The crops in a
basket are theirs for the same reason. They picked them.

**What is shared is the ground:** the seed it grew from, what is planted in
it, what has been put down and what has been taken away. That split is what
sharing actually cost, and it paid for itself immediately: a child's
belongings are now nowhere near the world file, so rebuilding the world after
a generator change cannot take a single coin off anybody. There is no "what
does the child keep" question left to answer.

It also means **a garden outlives the child who planted it**. Removing a
player takes their name, their face and their purse and touches nothing that
is growing; the last child leaving does not take the village with them.

**The game asks who is playing every time it starts.** The obvious shortcut
was considered and rejected: with one player on the device, go straight in.
But a child seeing their own name and their own face before they start is a
small ritual worth two seconds, and it means the second child on a tablet
never has to be shown where the switcher lives — it is the screen they have
both been using all along.

**Nothing is locked.** No passwords, no codes, no per-child PIN. The failure
mode of a forgotten code is a child locked out of a farm they spent a week
on; the failure mode of no code is a sibling opening the wrong game and
closing it again. Deleting is the one action that asks twice, by name, and
says what goes with the player.

**A world is a seed and a difference.** Terrain, elevation, habitats, the
village and everyone in it come back from one number — minted the first time
anybody plays and never reissued — so the world file holds only what has been
changed: what is planted and how grown it is, what has been put down, what
has been taken away. A thoroughly farmed world is a few kilobytes. Where each
child was standing, and what they were carrying, sits on their own profile.

That trade has a price worth naming. The difference is anchored to a world
the generator produces, and the generator is still being worked on — change
a habitat rule and the same seed grows a different coastline, at which point
a saved fence can come back inside a rock. So every save carries the version
of the generator that made it. On a mismatch the child is kept and the farm
is not: name, face, language, purse and basket all survive, the world is
rebuilt, and the game *says so*. A farm that vanishes without explanation
reads as the game having lost it, which is worse than being told the world
was rebuilt. The alternatives were both worse: accepting the drift silently
means nobody finds out until a child walks into an unreachable fence, and
keeping every old generator runnable forever means never deleting a line of
world generation again.

**Saving is automatic and unannounced.** Every few seconds, and again the
moment the tab is hidden — children do not close a game, they close a lid.
There is no save button, because a save button is friction that teaches
something about computers rather than about arithmetic. It is a timer rather
than a hook on each action, deliberately: hanging a save off planting and
picking and buying means the next thing that changes the world has to
remember to do it too, and the one that forgets is found by a child losing an
afternoon.

**A child makes their own character.** Skin, hair and clothes from the tones
the art was drawn with, and one of six bodies. The colours cost nothing to
offer because they are swapped into the sheet at load time: every character
sprite is either fully transparent or one of eleven exact colours, with no
antialiasing and no blending anywhere, so recolouring is a lookup rather than
a filter and the result is a sheet the generator could have produced. Which
pixel value is skin and which is cloth comes from the art as data — the
closest two tones in the sheet are thirty-one units apart, and nothing in the
game is allowed to tell them apart by eye.

The bodies are separate sheets because a silhouette cannot be recoloured into
existence, and silhouette is the only thing that survives sixteen pixels
across. All six keep the wide-brimmed hat: it is what makes the player
findable in a street of villagers drawn from the same palette, so it is not
among the things a child can turn off.

**Two of the six read as a boy**, and they were added because the first four
did not. Three were a girl in a hat and the fourth was one with the hair not
showing, which is not an option so much as the absence of the other three.
The two new ones differ by *build* — the one axis the first four do not use
and the only one left, because everything a person would name below the
shoulders is under the resolution. A wider, squarer torso, and a crop that
shows below the brim rather than a fall to the shoulders.

Short hair is its own thing rather than the lack of long hair: a head with no
hair drawn below the hat from any side is not a haircut, and an absence reads
as the default rather than as a choice. And neither of them gets a cap, which
is the obvious way to say boy at this size — the cap in this set is the
postal worker's, so a capped player would be a player mistaken for him. Nor is it a coincidence that the
default look is exactly the character the game had before anybody could
choose — a default that was some neutral index instead would have quietly
restyled the game's own protagonist on the way in.

### High ground you can stand on

**Mountain is walkable ground.** It was impassable terrain, and playtesting
killed that: a whole terrain nobody can set foot on is a third of the map
behind glass. Only the sea blocks now. What makes high ground hard going is
the rock standing *on* it — spires and boulders with their own footprints —
so the mountains are somewhere to climb to and walk about in, with the going
awkward in places, rather than a painted backdrop.

That leaves one question the old arrangement answered by accident: what stops
the player walking off the edge of the map. The answer is the cliff, and it
is a better answer, because a wall of scenery said "the scenery got thicker
here" while a cliff says "the world stops here".

Every cell carries a **level** — coast and meadows, hills, peaks — and a tile
whose corners are not all at the same level is drawn as a cliff: a band of
rock along the terrain seam, part of the ground rather than an object
standing on it. So the world visibly climbs in three tiers rather than
shading from green to grey, and the same tile marks the edge of the map,
which now simply stands a step higher than the land inside it.

A cliff cannot be climbed. A **ramp** can, and is a permission rather than a
slope: a flag on the cells either side of a step, which both makes that step
crossable and tells the renderer to draw a tile whose rock *tapers* into the
gap — full depth where the ramp meets the cliff, nothing across the way up,
so the face descends into it and rises out again rather than stopping at the
tile's own edge. They are cut in lanes at a guaranteed spacing, because every
level above the first would otherwise be sealed, and each lane is then
widened until its edges land where that taper can be drawn. See
WORLD_GENERATION.md.

### Telling the buildings apart

**A shop announces itself with what is outside it.** The store is drawn with
the barn sprite: a good big building, and not obviously a place that sells
anything. So two market stalls stand in front of it — striped awnings, a
counter, produce — which is how a village shop announces itself in the world
too. They are world generation's, like the well; nothing sells you one.

They go at either end of the row in front, never in the middle, because the
door is in the middle and a stall in front of it would be a shop you cannot
walk into. And they are only placed where the ground is already clear: a
stall blocks its cell, and one dropped onto the path the square carves to
that door would wall the shop off. One stall instead of two is a much smaller
loss than a shop nobody can reach.

**The school is a Central European village school**, because that is where
this village is. Habsburg ochre render — the one wall colour in the village
that belongs to no other building, so the school is identifiable even where
its roof is behind trees — under terracotta pantiles, browner and less
saturated than the cottage's pink-red so the two stay apart on a roofscape
seen from above. A bell cote astride the ridge, and a clock on the front wall.

The clock is worth a note, because the art's own rule says detail on a wall
turns to mush at this size and identity has to be carried by silhouette and
roof colour. That rule is right, and shutters, mullions and coursing all
prove it. A clock survives where they do not, because it is a *disc* — one
shape, read whole rather than as detail — and with the bell above it, it is
what turns a big house with a tall front into a civic building. Two hands and
no numerals: a numeral at this size is a smudge.

### Four houses, not one house four times

**A village you can give directions in.** Four cottages stood around the
square and all four were pixel for pixel identical, inside and out — "the one
with the red roof" only works if there is one. So each house wears a
different roof, and behind each door a different room.

**A repaint, not more art.** A cottage is drawn from a fourteen-colour
palette of which three are its roof, and its room from a twenty-colour one of
which three are the soft furnishings. Swapping one ramp at load time turns a
house into another house, from a sheet that was already downloaded — four
homes for the cost of one. It is the same trick the children's characters use
and the same code doing it, which is why that code lives on its own rather
than beside either.

**What varies is deliberately small.** The roof outside, because a village
seen from above is mostly roofs and it is the one ramp visible from across
the square. The bedding and the rug inside, because from the door of a small
room the soft things are what you notice — repainting the plaster would
change the *light* in a room rather than its character. Walls, trim, windows,
wood and firelight stay put everywhere, and that is what keeps four different
houses reading as four houses in one village rather than as four different
games.

**Only houses vary.** The barn is blue-roofed, the tower purple, the school
teal — in this art a roof is what identifies a building *type* at a glance,
so repainting those would not be variety, it would be deleting the thing that
tells a child which building is the shop. There is one school and one store;
nothing about them needs telling apart, because there is nothing to tell them
apart from. Houses are the opposite case and the reason this exists.

**A house keeps its look.** Which roof it wears comes from its own name and
the world's seed, so the house with the heather roof is the house with the
heather roof on every load — and it is the house with the plum bedding, since
inside and out read the same number. "Meet me at the green one" has to mean
something.

**The player's own house is always the same one.** It takes the look the game
has always had, and no villager is ever given it. Their home is the one
building they need to find from a distance without thinking, and a house that
changed colour between worlds would be a landmark that is not one.

**And the same plot for all four.** House zero had a seven-by-five "per the
original design request (a big garden)" and the other three a four-by-four,
which was fine while a world belonged to one child and is one child getting
half their sibling's garden the moment four of them share a tablet. Every
plot is thirty-five squares now.

**Turned to face the square rather than always lying the same way.** The long
side runs *across* the way out of the village, so a plot to the north is
seven wide and five deep and one to the east is five wide and seven deep.
Rotated rather than reshaped: every child gets the same ground, and they all
meet it the same way round — walking in at the middle of a seven-tile
frontage. All four houses sit on cardinal directions, which is what makes
"across" a single axis rather than a diagonal to round off.

**Four houses round the square, one per child.** A device holds four players
and the ring has four cottages, and `Profile.house` has always said which was
whose — it simply went unread, so every child was put down at house zero's
gate, including the three who do not live there. They start in their own beds
inside their own fence now, which is where the game has always started; it is
just four gardens rather than one.

**And the villagers moved out.** Three of those four cottages used to have a
villager standing at the gate, which was fine when a world belonged to one
child and read as a stranger loitering outside somebody's home the moment the
nameplates went up. They have four cottages of their own now, strewn over the
village's own green — a cottage in a clearing off the road, which says
*somebody lives near the village* rather than adding an eighth spoke to a
wheel that already has seven.

**Placed on ground the village has not carved.** Everything the layout builds
— the square, every path, every plot and the ring its fence stands on — is
set to dirt, and nothing else in the box is. So one condition excludes the
plaza, the roads, the gardens and the seven buildings without the scatter
having to know what any of them are, and the paths it carves as it goes
become dirt too, so no cottage lands on the way to another. Each keeps two
tiles of clear ground on every side, which is both "they do not touch" and
"there is somewhere to walk between them", stated once where it can be
checked a cell at a time.

A candidate is refused if the straight walk to it crosses anything standing.
The path carver draws a line and sets dirt under whatever it passes, which is
harmless running radially out of a square and is not harmless at all running
diagonally through somebody's fence.

**And it throws rather than settling for three.** A village one cottage short
is a generator bug, not a world worth shipping, and a villager whose home is
nowhere is a villager every later pass has to special-case. Checked over a
hundred and twenty seeds.

**The villagers' request loop is abandoned.** Their gardens existed to hold
the struggling plants a request would have been about; nothing of it was ever
built, and the four cottages have no gardens. See `WORLD_GENERATION.md`.

**And every house says who lives in it.** The paragraph above was written when
a world belonged to one child, and for children two, three and four it was
quietly false: their house was one of the ones that looks like a villager's,
and a reserved roof colour does nothing for them. So each of the four
cottages carries a small plate beside its door with the face of whoever lives
there — their own avatar, their own hair and shirt, drawn from the same sheet
their character walks around in.

**A villager's cottage carries one too**, with the villager who lives there on
it. Every cottage in the village is the same picture, so a plate on four of
them and an empty recess on the other four would read as art that failed to
load. It also makes the plate mean one thing everywhere: *this is whose door
this is*.

**A child's house nobody has moved into gets a question mark**, which is the
same mark the animals use when they want something. A villager's never does —
a villager's cottage is never empty. It is the game's own way of saying
*nobody has answered this*, so an empty plate reads as a house waiting for
somebody rather than as a plate that failed to load. A device with one child
on it has one face and three question marks, which is a true picture of the
village and an invitation besides.

**The plate is the picture's, the face is the game's.** The board is drawn
into the cottage sprite and ships blank, because which face belongs to which
house is a fact about who is playing on this device — something the generator
cannot know and a PNG cannot carry. `sign_rect_px` in the sidecar says where
the recess is, on the same contract `window_rects_px` uses and for the same
reason: the game cannot see the picture, and a coordinate typed into the game
by hand goes on being right only until somebody moves the door.

It hangs on the **right** of the door, which is where the wall is widest. The
facade lights its left edge across sixteen per cent of its span and shades
its right across eleven, so the plain render either side of a cottage door is
not symmetric: 20.9 pixels to the left and 25.0 to the right, for a board
twenty wide. On the left it pressed against the edge of the lit band; on the
right it has five pixels in hand.

The crop is head and shoulders rather than the whole figure — that is where
all three colours a child picked live — and it is cropped rather than scaled,
because a face squeezed to fit a plate is a face with some rows twice as tall
as others.

### The house grows

**A child builds their own room out, a square at a time.** Cast the addition
spell on a square of house that is not there yet and it becomes floor — for a
plank and a stone, and a wall of bricks answered correctly. It is deliberately
the *addition* rune rather than a fourth spell: adding a square to a room is
adding, and a child who has learned what the plus rune does should find it
does that everywhere.

**The wall is a new minigame, and a new kind of question.** Six bricks in a
triangle, three along the bottom, and every brick is the sum of the two it
rests on. Three are rubbed out and have to be put back. The garden's spell
hands a child two numbers and asks for the total; this asks *what goes here*,
and a gap in the bottom row cannot be filled by adding — they have the total
and one of the parts, and the only way to the answer is backwards. That is
the same arithmetic seen from the other end, it is what becomes algebra
later, and it is a different enough skill to get its own ladder.

The ladder climbs on *how much of the working runs backwards* rather than on
how big the numbers are: nought is a wall built upwards by adding, three is a
wall where every gap is a subtraction a child has to find for themselves.
Sixteen of the twenty ways to rub out three bricks leave exactly one wall
standing; the other four take half the wall with them and are never set. The
gaps are asked in the order they can be got, because a child allowed to tap a
gap nothing yet determines would be told "not that one" for a reason about
plumbing rather than about arithmetic.

**The furniture is things, not paint.** A bed used to be a fact about the
picture: the generator said one stood at cell (1, 2) and the game drew it
there, for ever, in every house. That was fine while a room *was* a picture.
It stopped being fine the moment a child could build the room out — a house
twice the size with its bed still in the original corner is a house nobody
arranged.

So the shipped placements are a *starting* arrangement. Tap a thing to pick
it up and it goes in the basket; put it back down from the crate, the same
verb and the same place as a fence taken out of the garden. What the
generator ships is the room somebody left; what a child does with it is
theirs, and it is written down per house alongside the floor plan.

**And they come in five colours.** Wood and cloth together, so somebody
picking green gets a green chair *and* a green blanket rather than a table
whose legs are one colour and whose cloth is another. Colourway nought is the
paint already on the room, which is load-bearing rather than a coincidence: a
house nobody has redecorated has to look exactly as it always has.

Painted woods rather than a run of real timbers — oak, walnut and ash are
three browns, and three browns at thirty-two pixels is one brown, where a
green chair and a blue chair are two chairs a four-year-old tells apart
across a room.

**The colour belongs to the thing, not to the square it stands on.** A child
who has bought a green chair owns a green chair; a basket that only knew
"three chairs" would have to ask again every time one went down. So the
basket counts `chair~3`, and the sheet for it is made once and kept — the
same route the avatars and the house roofs take, a ramp mapped onto a ramp
and cached under a derived key.

**Two taps, not a list.** Tap the piece, then tap the colour, and the colours
offered are the piece itself painted — a row of five chairs is a question a
four-year-old can answer without reading anything, where five swatches would
be a colour chart. Five pieces times five colours as one flat list would be
twenty-five rows to scroll past. A chooser of one is not a choice and skips
itself, the same rule the spell menu keeps.

**The hearth is the exception.** A fireplace is structural: it is the eight
animated frames the room ships for, and it is what lights the house's windows
from the road at dusk — `hearthCell` coming back empty is what makes
`windowsOf` skip a building entirely. A child who could carry the fire out of
their own house would put the lights out in it, at night, with nothing on
screen to say why.

**Every occupied square is safe from the minus spell**, whether the thing on
it blocks the way or not. A rug is walked over and still keeps its floor: the
two questions are different, and the answer to "may I take this floor up" is
"not if something is standing on it". That rule reads the arrangement *as it
stands* rather than the sidecar — a bed that has been moved protects the
squares it is on now, and reading the shipped placements would go on
protecting the corner it used to be in.

**And the minus rune takes a square back up.** The mirror of the plus rune in
here, and the only way to unmake a room built the wrong shape — the sums are
the same number line walked backwards, so it is the subtraction spell doing
outdoors what it does indoors rather than a fifth thing to learn. A plank and
a stone come back, exactly what the square took to lay: undoing a mistake
should cost a sum, not a walk back to the woods, and a refund that did not
match the cost would make the minus spell either a penalty or a way of
printing planks.

**Four squares it will not take.** One somebody is standing on, because a
child who pulled the floor out from under themselves would be standing in a
wall. One with furniture on it, because the bed does not move out of the way
to be helpful. The square behind the front door, because the way in is a hole
in the south wall with floor behind it and that is the floor — the one
mistake in here that would need an adult and a save file to undo. And any
square whose going would leave the room in two halves.

**That last one is the one a child cannot see coming**, which is why it is
worked out rather than guessed at: a flood fill from behind the front door
after the square is notionally gone, checking everything left is still walked
to. The cheap tests are the ones that are wrong — counting neighbours says a
corridor one tile wide is fine to cut, and looking only at the cells round
the hole cannot see that the two halves it separates rejoin the long way
round. A room is a few hundred squares and this runs once per tap.

A hole in the *middle* of a room is fine and reads as a pillar. Only a hole
that severs is refused.

**The times spell takes up a patch of it**, the same way it lays one, and the
list is walked forward for the sharper version of the same reason: four
squares that could each come up on their own can cut the room in half if all
four go, and a list checked against the room as it stands would offer exactly
that.

**A plank and a stone per square, and both come from the clearing spell.**
Subtraction is the spell this game under-uses. A child who wants a bigger
house now has a reason to go and take a tree out of the ground, which is a
better answer to "why would anybody cast minus" than anything a shop could
sell. Short of either, the refusal is a thought cloud with the two things in
it — a cross on its own is the game saying no with no way to find out why,
which for a child who cannot read the word "stone" is the same as the game
being broken.

**The multiplication spell builds a patch of it**, exactly as it plants one
outdoors: mark out the floor, say how many squares that is, and every square
of it goes down. Capped by the basket — a patch of nine with wood for four in
it builds four, because the child has answered the sum either way and a cast
that does nothing looks broken.

**The grid runs past the walls, and that is what makes building out
possible.** It used to stop at them, so the outermost square anybody could
*tap* was the wall itself — a tap past the grid's edge lands on nothing and
does nothing — and one cast could add a strip a single square deep. From
inside that reads as not being able to see out of your own house. There is
four squares of open ground round the room now: aimable, never standable,
nothing drawn on it. A four-by-four wing in one cast is a proper room.

The camera still frames the *room* rather than the margin. A room framed to
include it is a room bigger than the screen, which turns the still, centred
framing every interior has into a camera that follows a child about their own
sitting room; the margin is where the screen already had nothing on it.

It also cost one rule its meaning. Walking out of a door was detected as
*stepping off the grid*, which is true of every room that is a picture,
because theirs ends at the wall. The cell past this doorway is still on the
grid, so that rule shut a child inside their own house. Leaving is stepping
out of the *room* now, and the two are no longer the same thing.

**Only the cottage grows, and only away from the front door.** A shop does
not grow, and a schoolhouse a child could add a wing to is a schoolhouse they
could wall the teacher into. The door is a hole in the south wall lined up
with the door of the building outside, and the building does not move — so
the front of the house stays where it is and the room grows the other three
ways, which is also the rule that stops a child walling in their own way out.

**What this cost the art.** Six of the seven rooms are one drawn picture and
stay one. The cottage cannot be: the wall it grows through is a wall that has
to come down, and you cannot take a wall out of a PNG. So it ships a second
time as *parts* — a wall tile for every shape a corner can be, the floor, the
window, the doorway, and its furniture loose.

The thing that made this tractable is that **a wall was always a cell, not an
edge**. The shipped cottage is eight by six with a one-cell wall ring round a
six-by-four floor, and its `blocked_cells` has always said so. The eighteen
pixels a north wall rises are extra height on a cell the wall already owns —
the same trick the fences use — so a renderer that sorts on a sprite's feet
draws an arbitrary outline correctly with nothing new taught to it. A wall
standing in front of floor hides that floor's far edge, which is not an
artefact but the three-quarter view working.

A wall tile is chosen by five facts: which of its four sides have floor
against them, and whether the cell to its north is outside the room — which
is what makes a wall one you look at rather than one seen from above. Thirty
two tiles, six hundred and forty-five bytes for all of them.

**The plan is its floor and nothing else.** Walls, wall shapes, where the
room begins and ends, what may be built next: all worked out from the floor
every time. A save with both in it is a save whose two halves can disagree,
and a room with a wall through the middle of it is what that looks like. The
plan lives with the *world* rather than with the child, because a house is a
fact about the world and two siblings on one tablet own different cottages in
one village.

### Saved games

**There are several, kept side by side.** There used to be one world and a
button that threw it away, which is honest while a world is an afternoon's
garden and stops being honest the moment a child has a house they have spent
three weeks on. A button whose only outcome is *lose everything* is not a
save system; it is a confession that there isn't one.

**The children are not in them.** Who a child is — their name, their face,
the language they read, how hard their sums are — belongs to the device,
because none of it is a fact about a world. What they have *done* belongs to
the game they did it in. So starting a new game does not mean typing four
names again, and loading an old one does not bring back a face somebody has
since changed. The code says the same thing in two types, `Player` and
`Progress`, joined into a `Profile` for everything above the save layer:
splitting them is a fact about storage, joining them is a fact about there
being one child.

**Three keys, not one blob.** An index of what games exist, a body per game,
and a note of which is open. The index is what the games row reads, and it
must not have to parse four farms to draw four buttons — the same reason the
player list has never been kept inside the world.

**The child's route through the game is unchanged**: title, who is playing,
garden. A device that has never been played gets a game made on the spot, and
a screen in the middle asking which world would be a question a six-year-old
cannot answer. Choosing is an adult's business and lives in the options.

**One rule governs the games row.** *Tap another game to open it; tap the one
you are in to be asked whether to throw it away.* Opening loses nothing — the
game being left is written down first and you can tap straight back — so it
needs no confirming. Throwing away cannot be undone, so it asks twice, and
the only game that may be thrown away is the one you are looking at.

**The old world is carried over.** Everybody playing when this shipped has a
garden under the single-world key; it becomes their first saved game, and the
old keys go with it so a device cannot be carried over twice. This is also
where the standing permission to lose data while playtesting runs out — it is
the change that says a save is worth keeping.

### Nothing is said in words

**The status line is gone.** There was one line of small type along the top of
the screen, and everything the game had to say went into it: a refusal, a
result, a greeting, an errand. A playtest killed it in one sentence — *the
status update text is unreadable, and our youngest audience can't read
anyway.* Both halves are true and the second is the one that matters. This is
a game for a six-year-old and a nine-year-old sharing a device, and half of
that audience cannot read a word of either language it speaks.

So nothing is written there any more, and nothing replaced it in that corner.
What the line used to say is drawn.

**The mark goes where the child has to act.** That is the whole rule, and it
is what decides between the three places anything can appear:

| what is wrong | where it shows | what it is |
|---|---|---|
| the square is taken, bare, or not yours | on that square | a red cross |
| she is carrying none of the thing | over her own head | the thing, with one red bar across it |
| she is somewhere nothing grows | over her own head | a red cross alone |
| it is out of reach | on the square, and between | the cross, and a trail of dots back to her feet |
| something happened | on the square it happened to | the thing that changed, rising and fading |
| a cast was abandoned | where it was aimed | the spell's own rune, shrinking out |
| a spell was earned | over her head | its rune, rising and growing |
| somebody is asking | over them | a thought bubble with the thing in it |
| somebody's errand | on a sheet of parchment | a row of things to do, and what it earns |

A few of those choices are worth the sentence they cost:

- **A bar, not a cross, for "you have none of these."** A cross over a picture
  hides the picture, and the picture is the half that says *which* thing she
  is short of.
- **A trail for "too far".** Every other refusal is answered by doing
  something else; that one is answered by *walking*, and a cross alone does
  not say so.
- **A rune dimming out, not a cross, for an abandoned cast.** Nothing was
  refused — she opened the parchment and closed it, and a cross would say the
  game had stopped her.
- **Results rise.** A picture that stayed put would be a thing on the ground,
  and there is already a thing on the ground. A picture that moves is an
  event.

**Some lines were deleted rather than drawn.** Walking into a building used to
announce the room — she can see the room. Tapping a crop in the basket used to
count it — the badge on the button had already counted it. Arriving through
the portal used to say where you had arrived; you have arrived. A rebuilt save
used to explain itself, in a sentence addressed to somebody who can read,
about a thing a child cannot act on.

**The rules stopped writing sentences.** `ActionResult` carries an `Outcome`
now — one name per condition — and `GameSession` no longer holds a `Phrases`
at all. It never had any business knowing what language the game was in; it
knew because it was the thing doing the talking. Sixty-odd phrases went with
the line, and that deletion is the proof: nothing can still be writing to a
line that no longer has the words to write.

**Numerals are not words.** `347 + 265`, a clock face's `12`, `4 × 6` — those
stay, and no amount of drawing replaces them. They are the subject. What the
rule is about is *prose*: the sentences that told a child what had happened
and what to do next.

### What the world gives up

**The clearing spell used to give nothing.** A child solved a subtraction
problem, a tree came out of the ground, and that was the whole of it — which
made it the one loop in the game with no reward at the end, and the reason
this document kept having to explain why anybody would cast it.

A tree is **wood** now and a rock is **stone**, and both are worth what a
crop is at the store.

**That is generous, and it is pedagogy rather than economy.** A crop takes
three actions — plant, grow, grow — for one crop; clearing takes one cast for
two or three logs. Subtraction is the spell this game under-uses, and paying
for it is the plainest way to have it practised. It cannot be farmed either:
nothing regrows, so a child who clears everything within reach is a child
back in the garden. The resource limits itself.

**How much depends on what.** A conifer is three, a deciduous tree two, a
dead tree one; a rock spire three, a boulder two, an outcrop one. That is the
first time in this game that *which* thing you clear has mattered — a small
table a child can learn and then plan around, which is the whole of what a
resource is for. Things that grew give wood; things that did not give stone,
because a boulder paying in logs is a rule a child could only learn by being
surprised by it.

**Each one comes up out of the ground separately**, a beat apart, so the
count is something to watch rather than something to be told. Three icons on
top of each other is one icon.

### Things to buy

**Seven, where there were three.** The fence, the table and the lamp are
joined by a gate, a bench, a scarecrow and a flowerpot.

**The gate was world generation's** — a gate in a crate is a gateway to
nowhere standing in a field. That held while a fence was the only thing a
garden could be built out of; the moment a child can fence a plot, the way in
is the piece they are missing.

**The other three do nothing, and that is what they are for.** The children
asked to be able to add to the place they live, and a garden somebody has put
a bench in is theirs in a way a garden with a fence round it is not. They are
priced under the lamp for the same reason: what they buy is a place that
looks like somebody's, and a child should be able to have one before they
have saved for a fortnight.

Each is told from the others by shape before colour, which is the rule the
whole art follows. The bench is the table's parallelogram with a back. The
scarecrow is the only *cross* in the set and the only one that sways. The
flowerpot is the only round thing and the only one in its own palette — in
the timber browns it is a small barrel.

### The animals

**Creatures to see, and now to feed.** Chickens, ducks, cats and rabbits,
asked for by the children who play it. Each one is hungry for one crop: a
thought bubble over its head with that crop in it and a question mark, and a
tap hands it over if you are carrying it. Feed one and the bubble turns to a
smile for a moment before it goes.

**They ask on their own clocks, not all together.** Every animal asking at
once is a *checklist*: a child walks one lap, clears every bubble and is
finished with the village. Each one instead spends twenty to forty seconds
asking and forty to a hundred saying nothing, rolled separately, which leaves
about three in ten asking at any moment — usually something to do, never a
list to work through. The ratio between those two windows is the only number
that sets it, so it has a test rather than a comment.

They start in the *middle* of a cycle rather than at the beginning of one.
Started at the beginning they would all be quiet when the player arrives and
then, a minute later, all asking together — which is the very thing separate
clocks exist to avoid.

**A fed animal says nothing for ten minutes.** Long enough that a child cannot
farm one chicken; short enough that one fed at the start of an afternoon is
asking again by the end of it. And an animal that is not asking cannot be fed
— a bubble you could pre-empt would be a bubble that meant nothing, and the
quiet ten minutes would be ten minutes anybody could talk over.

**Nothing is counted and no arithmetic is asked**, which is deliberate.
Animals to look after is a whole system — a pen, feed that has to be grown to
a schedule, something countable they produce — and what a child gets out of
this is smaller and enough: a reason to walk over, and a reason to have grown
a second kind of crop. The bigger system is still not built, and this does not
prejudge it.

**The bubble is why the tap is offered rather than guessed at.** They used to
do nothing at all, on the argument that a creature which answers a tap with
silence is worse than one that plainly is not for tapping. That argument was
right and the fix was not to remove the tap but to say, on screen and without
words, that there is one — which is what a cloud with a carrot in it does.

**Each kind has a menu and draws from it**, so two chickens in the same
village are not the same errand. A rabbit's opens with a carrot, because that
is the one pairing every picture book has already taught. Nobody asks for a
cactus: it only grows on sand, the village has none, and an animal asking for
something you cannot grow within a day's walk is a bubble that never clears.

**What an animal wants comes out of the world seed**, with where it stands, so
the game records nothing and the same village comes back wanting the same
things. **Being fed is not recorded** — the ten minutes are a timer in memory
— so a chicken fed just before a reload is asking again after it. The message
says as much when a full one is tapped, because a child who fed four chickens
and came back to four bubbles would otherwise read it as the game having lost
their afternoon.

**Nothing is given back**, and that is an open question rather than a
decision. A crop already has a price in the store, so anything an animal
handed over would have to be priced against that, and there is no reason yet
to think a child wants paying for this.

**They are the same problem as a villager at a different size**, so they use
the same machinery: four facings drawn rather than rotated, right mirrored
from left, a bounded random walk near where they belong. What differs is
proportion and rhythm. An animal stands on four legs and fits its own tile,
where a person's head rises into the cell above; and an animal steps quicker
and more often, because a chicken moving at a villager's amble read as a very
small villager rather than as a bird. The rhythm does more to sell it than
the drawing does.

**Silhouette first, colour second**, as everywhere in this art. A cat is its
ears and its tail; a rabbit is its ears and its puff. The chicken and the
duck were the same bird with different coloured beaks at first, which at
twelve pixels is not a difference at all — one has a comb now and the other a
broad flat bill, and those are shapes.

**They keep no curfew.** The villagers retreat indoors at dusk; a cat is out
at night and so is a rabbit, and a village that emptied of chickens at sunset
would look like a village where something had happened to the chickens.

### How hard the sums are

**The game had one difficulty and it was an eight-year-old's.** Always three
digits plus three digits, always with carries, always 2,50 for a crop. A
six-year-old could not play it. Everything about difficulty exists to move
that dial without moving anything else.

**It changes the numbers and nothing else.** How many places a sum has,
whether its jumps cross a ten, how much of it arrives already worked out, and
how round the money is. Nothing is locked behind it, no crop is unavailable,
no place is closed — that is "learning over gating", and it is why this is a
property of the arithmetic rather than a progression.

**And it never changes the payout.** A crop is one crop whoever grew it, and
still takes two casts. What changes is what a crop is *quoted* at — a whole
ducat, or half of one, or two and a half — and since every price in the store
is quoted in crops, a fence costs two harvests at every setting. The moment
easier sums earned less, the game would be telling a struggling child they
are worth less, and it would start pressuring children upward for money
rather than because they are ready.

**The number line is the dial, and it is visible.** The spell teaches partial
sums smallest-place-first: jump by the ones, then the tens, then the
hundreds. At two places it is the same method on a shorter line — two jumps,
two landings, a line spanning a hundred instead of a thousand. At one it is a
single jump to twenty. A child can see the size of what they are being asked.

**Crossing is a dial of its own.** `23 + 45` and `27 + 45` are both two-place
sums and only the second carries; on a number line a carry is visible as "the
jump crossed a ten", which is the whole reason to teach it this way round.
That is a real step between two children of the same age, and folding it into
how big the numbers are would waste it. One place is the exception: crossing
a ten with single digits *is* `7 + 5 = 12`, so that is the one size where the
answer is allowed to be wider than the numbers.

**Scaffolding is the third.** At the gentler settings a cast arrives with its
first jump already made, in the same ink as the ones the child solved —
because a partly solved problem should look like a problem you are part-way
through, not like one with pieces missing. The design already asked for this:
teachers "train a spell with partially solved problems."

**Four sample sums, not four ages.** Somebody picks a band when a player is
made, and the tiles show `5 + 2`, `50 + 27`, `56 + 16`, `504 + 274` rather
than ages or the words "easy" and "hard". A parent can pick by looking and so
can a child, and nobody is told they are on the gentle one — which matters,
because the tile sits on a screen beside a sibling's. The samples are
generated by the spell rather than typed out, for the same reason the
teacher's worked example is.

A new player does not start on the hardest tile, and a child who was playing
before any of this existed does. The two failures are not equal: a child
given sums that are too easy climbs out within a few casts, while a
six-year-old handed `504 + 274` cannot play at all and has no way to say so.

**The game moves quietly, and it is not fenced in.** Four clean casts in a
row — every box right the first time — and the sums get a little bigger; two
stumbles in a row and they get a little smaller. It is deliberately not
symmetric: a child who guesses right twice has not learned anything and being
moved up for it is a punishment dressed as praise, while a child who is stuck
should not have to prove it four times over. Nothing announces it. There is
no level, no badge, no sound — a child who is flying simply finds the sums
getting bigger, which is what a good teacher does and a progress bar does
not.

**And it stops at the edges of the band.** The band was opened at both ends
for a while, on a playtest reading that a child who tops out and then sees
nothing change is looking at something indistinguishable from a fixed
difficulty. That was true and it was the wrong fix. Once the ladder was open,
a run of lucky guesses could carry a six-year-old into three-digit sums, and
the first anybody heard of it was a child in tears over sums nobody chose for
them. The band is a fence again, and moving between bands is a person's
decision — made in the options panel by somebody who has watched this child
play, not by a rule counting the last four casts.

The cost is real and stated rather than discovered: a child at the top of
their band sees the sums stop growing, and only an adult can start them
growing again. That is the trade, taken deliberately. How hard a child's sums
should be is a judgement about that child, and an adaptation that quietly
overrules the person who made that judgement is not adapting to the child,
it is disagreeing with their parent.

So the options panel naming the band is not a safety net any more, it is the
control. It is one tap, it shows the sums each band actually sets, and it is
where a child's difficulty changes when they have grown into the next one.

**A band is scaled onto each spell's own ladder.** Bands are counted in
addition rungs, and the addition ladder is the longest — the clock and the
great tree have six rungs each. Truncating a band against a shorter ladder
puts the hardest band on its last rung with nothing above *or below* it,
which is not a fence, it is the adaptation switched off. Scaled, every band
keeps its share of every ladder: the gentlest band on the clock is the two
easiest readings rather than only the one, and a child in the hardest band
opens the times-table spell partway up it with somewhere left to climb.

What the band decides, then, is where a child begins, what the money looks
like, and where they may be.

**The teacher follows.** She works through `148 + 114` at three places and
`8 + 4` at one — the same sum cut down, so its shape never changes — and she
never demonstrates a carry to a child whose own sums never carry. A worked
example is worth nothing if it is a problem they cannot read.

**What is deliberately not a dial.** No timers, no scores, no streaks: the
pillars rule them out and they would turn a garden into a test. Nothing is
locked. And how many casts a crop takes is the same at every setting, for the
payout reason above. The one thing genuinely outside all of this is
*reading* — for the youngest band the tutorial text and the shop's rows are a
barrier that has nothing to do with arithmetic, and fixing it means bigger
icons and fewer words rather than smaller numbers. That is a redesign of the
text, not a parameter, and it is not built.

**The language belongs to the child, not to the device.** It used to be one
setting for the whole machine, which is the wrong shape here: two siblings
sharing a tablet may not read the same language, and the one who does not
gets a game they cannot play. It is picked when a player is made, alongside
their face, because it is the same kind of choice — something about this
child — and because asking a German-reading child to find it in an options
panel written in English is asking them to read English first. It can still
be changed from the options panel mid-game, and it applies the moment it is
tapped: an options screen with an OK button asks a child to remember a second
step for the first one to count. The device remembers only which language the
last player used, so tomorrow's who's-playing screen is written in the
language of this house rather than of this browser.

### About, and the one thing it asks for

The options carry an **About** button. It opens the only screen in the game
that is a wall of text, and it earns it: the audience is whoever is paying
for the tablet rather than the child holding it, and what it has to say — a
name, a licence, and a request *not* to spend money — cannot be said in
pictures. Everywhere else the rule is that no sentence goes unaccompanied;
here the sentences are the point.

It stands where a line saying what a crop sells for used to. That was a fact
about this game's own invented money that nobody was ever going to have a
question about; who made the thing, and whether they want paying, is the
question an adult opening that screen actually has.

**What it asks for is mostly that you do not.** The paragraph says the game
is free and always will be, points at GitHub Sponsors, and then asks
students, single parents and anybody not comfortably off to spend nothing on
it — support it only out of a school's or an organisation's money, or from
comfort. That order is the argument: it is free, and *then* here is how to
give. Reversed, the first thing a parent reads is a request. There is a test
on the order, on the capitals in *do NOT*, and on the two links belonging to
the same account — a typo in one of those would send somebody's money to a
stranger with a similar name.

The two buttons are the only thing in the game that leaves it, which is why
they live here and nowhere near a screen a child plays on.

**The chooser has flags on it.** It is the one screen a child is asked to use
before they can read the screen it is on — it is written in whatever language
the last person to play chose, so a German-reading child meets it in English —
and "English" and "Deutsch" are two words in two alphabets a five-year-old may
know neither of. A flag is the one picture that means a language to somebody
who cannot read its name. The name stays beside it, for everybody else and for
anyone who reads a flag as a country rather than as a language.

Both flags are drawn on the same rectangle, and the Union Flag is squared up
to get there: a row of flags at their own true proportions is a row of
different-shaped buttons, and a chooser wants its two choices to look like two
of a kind. They are the only icons in the game drawn to their own edges — a
flag with air round it is a picture of a flag lying on something.

**Croatian counts in three, and that is the one thing the phrase book was
not built for.** One carrot is *mrkva*, two are *mrkve*, five are *mrkava* —
and the rule is on the last **two** digits, so eleven through fourteen take
the many-form despite ending in one through four. The `Noun` interface has a
single plural slot, so the three forms live in a private table inside the
Croatian book and its `count` reads that table directly rather than trying to
smuggle a third form through a field meant for one. There is a test over every
number under a thousand, and another on the teens specifically, because that
line is what Slavic pluralisation is usually shipped without.

Two smaller things Croatian forced. It has no articles, so `bare` and
`definite` are the same word; and a gate in a fence is a *vratnica* rather
than *vrata*, because *vrata* is plural-only and "1 vrata" is not a thing
anybody says — a test says no placeable thing is a plural-only noun in the
singular.

**The whole game is translated, not just the menus.** Every line the player
reads comes from a phrase book (`src/i18n/`), one per language, and the
interface is what stops a half-translation shipping: a language that forgets
a phrase does not compile, and a test fails on any German line that is still
its English original. The phrases are *functions*, not templates with holes,
so German can put the verb where German puts the verb rather than following
English's word order in German words. Nouns carry their forms — "einen Zaun",
"keinen Zaun", "die Karotte", "der Kaktus" — because the article follows the
noun's gender, and a sentence that guessed would get one in three wrong.

**The money is not real money, and that is deliberate.** It was, once:
Croatian kuna, Swiss francs and euros, on the argument that practice with
actual coins beats practice with invented ones. That argument loses to a
simpler one. A game for children that shows a euro price and asks them to put
euros on a counter can be *read* as asking for money — by a child, or by an
adult glancing over their shoulder — and nothing inside the game undoes that
reading. So the coins are **ducats and mites**, which are nobody's money: a
hundred mites to the ducat.

They were suns and rays first, and playtesting said the children found that
confusing. The fault was picking *nature* words rather than *money* words:
"ray" does not read as a coin, so nothing about the pair said which of the
two was the small one, or that either was money at all. A ducat and a mite
both read as coins on sight — which is the job the name has to do before a
child can start counting with it — and both are long dead everywhere, so
neither is anybody's pocket money. The names are the same in both languages,
because a currency's name is a proper noun and two siblings on one tablet
should not be calling the same coin different things.

What is kept is the *shape* of real money, because that is the part being
taught: a hundred minor units to the major one, so the decimal point behaves
the way it does on a price tag; a 1-2-5 ladder of coins, which every real
system uses and which is what makes counting out greedily give the fewest
coins; and amounts always in the minor unit, never in fractions of the major
one — a price is `250`, not `2.5`, because floating point has no business
near a total a child is being asked to check.

Being invented, the ladder is also *complete*: 1, 2, 5, 10, 20, 50 mites and
1, 2, 5 ducats. Real sets have gaps — a country drops its smallest coins to
inflation, or stops at two of the major unit because the next one up is a
note — and those gaps were worth honouring while the money was real. Nine
coins, three of each metal, and every price expressible down to the last mite.

**Money is a button, not a line of text.** The purse sits in the action bar
beside the things it buys, with a badge for how much is in it — whole ducats,
not the mites the purse counts in, because a badge reading "5000" for fifty
ducats would be a number nobody in the game uses. Opening it shows the coins she
is actually carrying, sorted into the three kinds, and tapping one kind says
what those come to. Sorted by kind rather than by denomination because that
is the sorting a child does with a handful of change before reading the
number on any of it — and because nine slots stacked up the side of the
screen is a list rather than a purse.

**The coins have faces.** Three of them — copper, silver, gold — not one per
denomination, because the value is written on the button beside the picture
and one set of art has to serve all nine coins; a digit struck into the art
would be a ninth of an atlas spent saying what the label already says. Which
face a coin gets is a rule rather than a table: gold from a whole ducat up,
silver from a tenth of one, copper below that — so the rule survives the
ladder changing under it. The tiers differ in size as well as colour, so they stay apart for a
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

**And there are two of it**, because there are two of the fence. A ring has
sides that run across the camera and sides that run away from it, which are
two different pictures of the same fence — and the gate goes on whichever
side is nearest the square, so **half of them land on a side run**. For a
while only the across-the-camera gate existed: half the gardens in every
village had rails and a stile sticking sideways into them, with the run
stopping above and starting again below. It read as a broken hurdle rather
than as a way in.

The side gate is built from the *side fence's* geometry rather than the
gate's, because what it has to join is above and below it. Its posts are
plainly heavier than the rails they end — the run below overhangs half a
tile up into the gate's own cell, so a post no wider than a rail left the
column looking unbroken — and its leaf swings into the garden, which means
the right-hand side is the left-hand sprite mirrored, exactly as the fence
beside it is.

One thing this cost, and it is worth writing down: the connectivity pass
carves its routes to the story areas by *removing whatever stands in the
way*, and it used to start from the player's spawn. With the spawn moved
inside the fence, its first carve punched straight out through the wall — the
gate vanished, and the fence had a hole in it instead. It now starts from the
doorstep, which is outside; the garden hangs off it through the gate, so
anything reachable from one is reachable from the other.

### The title card

**The first thing on screen is the game's name and a loading bar**, drawn
with nothing but rectangles and text. That is not a shortcut: this is the one
screen that cannot use the art set, because it is what the player looks at
*while* that art is being fetched, and a title card built from the parchment
would only appear once it was no longer needed.

**It waits to be dismissed.** A game that begins the instant the last file
lands begins at a moment the player did not choose — on a fast connection,
before they have read the name of it. Any tap and any key will do; there is
nothing else on the screen to hit, and a child should not have to find a
button.

The bar counts *files*, because that is all Phaser will report — it has an
event for per-file byte progress and does not fire it for the kinds of file
this game loads, which was checked rather than assumed. Two things make a
file count honest enough to show: the loader is capped at six downloads at a
time, since the default of thirty-two has everything in flight at once and
the bar then sits at nothing for the whole download and fills in a fifth of a
second; and the terrain atlas is loaded with the sheets rather than with the
sidecars, because it is by far the biggest thing here and the first pass is
worth a sixth of the bar. The bar also never goes backwards: the atlas is a
multiatlas whose pages join the queue only after its index arrives, so an
honest fraction drops from 92% to 73% partway through, and a bar that goes
backwards says the thing you were waiting for got further away.

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

**And a house lights itself from the inside.** The cottage and the townhouse
have a fireplace, and it is the one thing in a room that moves — eight frames
of it, burning at every hour. It threw no light at all, which meant that at
night the fire was the darkest thing in the room while a lamp on the plaza
outside lit the ground round it. A fire that gives no light is a picture of a
fire. Now it has a halo of its own: smaller than a lamp's and redder, because
a lamp is hung to light a path and a fire is in a box against a wall.

It flickers, and the flicker comes from the room's own animation frame rather
than from the clock. A glow pulsing at any other rate beats against the flame
it is supposed to belong to, which reads as a fault rather than as firelight.

Where the fire is is read off the room's furniture, like everything else
about these rooms: a hearth is a fact about the picture, and a coordinate
written down here would go on being right only until somebody rearranged the
furniture. The rooms with a fireplace and the rooms with more than one frame
are two lists written by different halves of the generator, so a test holds
them against each other in both directions — a fireplace with one frame is a
fire that does not burn, and eight frames with no fireplace is something
moving that the game cannot find to light.

**And every room is lit the way that room is lit.** A house has a fire. The
store has warm lamplight along the wall between the stock; the school is lit
cold and even, because it is the one room here lit to be *worked* in; the
tower has two pools of something blue on the flagstones. The ship's hold and
the observatory's dome stay dark, and that is a decision rather than an
omission — a hold has no business being lit, and the dome is the one room in
the game meant to be dim, because it is where somebody looks at the sky from.

Every store in the game is the barn's room, so that is the harbour's and the
city's lighting as well as the village's.

**Nothing is drawn for most of it.** The first attempt painted the fixtures:
bracket lanterns, a tube in a metal fitting, floating orbs. At nine pixels
they were fiddly little objects that read worse than the light did on its
own, so they came out again and what is shipped is *where the light is*. A
warm pool on a shop floor says "lamp" better than nine pixels of lamp do. The
hearth is the exception, because a fire is a thing you can see, and its light
is taken off the fireplace rather than written down beside it.

The differences are colour and movement: the fire moves with its own flame,
the shop's lamplight wavers a little, the tower's breathes slowly, and the
school's does not move at all, because nothing electric does.

The generator says where a light is and what *kind* it is; this side decides
what a kind looks like after dark. So a room somebody relights needs nothing
changed here — and a kind the game has not learned is drawn as nothing at all
rather than guessed at in some default colour.

**And the village lights up from the inside.** A house with a fire in it has
lit windows after dark — the same warm colour as the hearth, because it is
the same fire. What decides whether a building lights is whether the room
behind its door has **a fire** specifically — not merely some light. That
keeps the shops and the school dark from the road, which is right: a lit shop
is a shop somebody is standing in, not a lit street.

Not all at once. Each house has its own moment in the dusk, stable per world
from a hash of its name — a square of windows coming on together reads as a
switch being thrown rather than as evening. Bounded, though: everybody is
burning by the time the night is at its darkest, because a house still dark
at midnight reads as the lighting being broken rather than as an early night.

Where the panes are is shipped by the generator, like everything else about
this art. The halo is sized off the pane rather than picked: the first one
was half again as wide, which looks right on a cottage with two windows
either side of a door and wrong on a townhouse, where four go up the front
fifteen pixels apart and the glows ran together into a single white shaft. A
house should read as *windows*.

The lights are drawn *additively over* the tint rather than erased out of it.
Erasing is what it wants to mean, and a render texture can do exactly that —
which is how it was written first, and it went wrong in a way worth
recording: with the sheet being filled and erased every frame, it came out
blank within seconds and night simply stopped happening as the player walked.
Warm light added to a cold sheet reads the same to the eye and cannot get out
of step with itself.

### Drawing a wood without drawing every tree

**A desktop at full screen was slow, and it was not the pixels.** Measured
rather than guessed at, on the same village at the same size: the frame was
being handed **seven thousand quads** to draw a few dozen visible trees.

Two things were wrong, and neither was the art.

**The terrain and the trees shared a margin.** Chunks were kept a ring deep
in every direction, which is right for ground — one texture per chunk, cheap
to hold and expensive to redraw — and wrong for trees, which are hundreds of
live sprites per chunk and cost nothing to make. The ring is now the ground's
alone.

**And nothing culled them.** Phaser does not cull a plain display list:
`willRender` asks whether an object is visible and whether the camera is
allowed to see it, and never whether it is anywhere near the screen. So every
tree in every spawned chunk was transformed and written into the vertex
buffer each frame, on screen or a chunk away. A chunk is thirty-two tiles and
a desktop screen is forty across, so six chunks overlap the view to show one
screenful.

Both together: **7,081 quads a frame down to 764**, and the live sprite count
from 6,405 to 1,862. The picture is unchanged — checked by rendering the
densest wood in the world twice, with the culling on and off, and diffing:
zero differing pixels.

**On the machine it was reported from**, which is a 3840×2160 display at
scale one driven by an Intel UHD 630: Firefox at full screen went from 41–45
fps to 52–55, day and night, in the village and in the wood. At 1920×1080 it
sits at 55–59.

That measurement took a headed browser on the real X display. A headless one
has no graphics card, rasterises in software, and that cost swamps everything
else — which is why 300 trees and 8,500 trees came out at the same frame rate
there, a result that cannot be true and was the clue that the harness was
measuring itself. The portable number is the quad count, which does not
depend on having a GPU at all.

**And the card matters.** The reporting machine has a GTX 1060 in it that
Firefox is not using: `about:support` lists it as GPU #2, `Active: No`, with
WebGL bound to the integrated Intel. Firefox is installed as a snap, which
generally cannot reach the NVIDIA driver. Worth knowing before optimising:
the game is being drawn by an integrated chip pushing eight megapixels.

Hidden trees also stop swaying, which takes them out of the animation work
without taking them off the list. Only on the change, because pausing
something already paused is the work this is avoiding.

The night sheet is hidden rather than left at alpha zero, for the same
reason: a transparent screen-sized rectangle is still a screen-sized
rectangle to a renderer, and two thirds of every day is daytime.

### The tree that is still asking

**It breathes while the errand is open.** A wide, faint light over the crown,
four seconds to a breath — slower than anything else that pulses in this game,
because a fire flickers and an orb breathes and this is a tree, and it is
asking rather than burning. It goes out the moment the last bed is filled,
which is the only announcement the game makes about having finished besides
the rune itself.

Additive over everything rather than over the night tint, unlike the lamps and
the hearths: a tree that only glowed after dark would be a tree that asked for
nothing all morning.

Whether it is still asking is worked out when the world is *touched* — when
wood is cleared or a crop ripens — rather than when it is drawn. Reading the
answer walks the thicket and sixteen squares, which is nothing at all once and
something to think about sixty times a second.

**And the sway is sixteen frames now, not eight.** A landmark's cycle is a
couple of seconds long, and eight frames over that is three or four distinct
positions a second, which a tree the height of a house does not get away with —
it read as a stutter rather than as wind. Everything here sways off a
continuous curve, so more frames is a finer sample of the same motion: the same
distance in the same time, in twice as many steps.

### The way into a garden

**Three cells wide, and made of two gates with a gap between them.** It was
one cell, and one cell is a target a six-year-old has to aim at: they walk
along the fence, arrive *beside* the way through rather than at it, and press
into a panel that looks no different from the gap.

This is the same complaint the buildings' doorways answered, and nearly the
same answer — except that a doorway can be three cells wide to walk into
while staying one cell wide to look at, and a hole in a fence cannot. So the
hole is really three wide, and all three are walked through. Two gateposts
round a one-tile gap would be the old target with more timber round it.

The middle cell carries nothing at all, and neither does anything else in the
opening: **the gates have no posts.** They had two each, which was right
while a way in was one cell wide — the eye read the two uprights before it
read the absence of rails between them. Across three cells it came to four
uprights round the opening with two of them standing *in* it, and those two
were the first thing anybody noticed. What says gateway now is the pair of
leaves, still fluttering; the run either side ends on its own post, as it
always did.

The far gate is mirrored, so the pair fold away from each other — the leaf is
hinged on the left of its cell, and two unmirrored gates read as one gate
drawn twice rather than as a gap with a gate at each side.

**A run going away from the camera needs two different gates**, not one
mirrored. The leaf hangs off the run it belongs to, and on a column that run
is above one gate and below the other — while mirroring on this grid is left
to right. So there is an upper gate whose leaf sits at the top of its cell,
hard against the run coming down into it, and a lower one whose leaf sits at
the bottom, hard against the run going on below. They are one drawing with
the hinge row as its only argument, so the two ends of a way in cannot drift
apart by being maintained separately.

It is centred on the cell the single gate used to be — the ring cell nearest
the square — and shifted along if that would put an end of it on a corner.

**One consequence worth naming.** A bottom corner only gets the corner piece
when something is actually standing above it, which is no longer every bottom
corner: the gap in a way in can fall directly above one, and a post carried
up to meet nothing is worse than the join it was drawn to close.

### The corner a fence turns

A garden's fence is two pictures of one fence: a run across the camera and a
run away from it. Where they meet is a corner, and a corner joins in one
direction and not the other.

**Above** a corner, the side run overhangs its own cell by half a tile and
lands on the panel's post, so it continues straight down out of it and the
join is invisible. **Below** one there is nothing to overhang with: the side
run stops at its cell's edge and the panel's post does not begin until a
third of the way into the next cell. Every garden had a clean break at each
of its two bottom corners, rails and post not meeting, with dirt between.

So there is a fourth piece — the same panel with its near post carried up to
meet the run above, mirrored for the right-hand corner exactly as the side
run is. Only the near post, and only in that piece: carrying both up on every
panel closes the corner too, and gives a row of tall stakes over the rails
the length of every fence in the game. That was drawn and looked at before it
was rejected.

Which cells are corners is a fact about an enclosure rather than about a
fence, which is why this is world generation's and not something the player
can buy. A tap cannot carry that decision.

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
one at all — so it is remembered per child. A second player on a tablet
where the first has finished the tutorial would otherwise be dropped into a
farm with no explanation of it. He still walks
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

### Machines, and the difference between built and bought

**Reported from a playtest:** the whimsical fairytale look is good, but the
players would like a bit more solarpunk about it, some machines, and the
ability to build things that *do* something. Three asks in one sentence, and
they cost wildly different amounts. This is the first of them to ship.

**A machine changes what one cast does. It never removes the cast.** That is
the rule everything here is filtered through, and it is derived from the
pillars rather than invented beside them: the doc blesses unlimited earning
only with the clause *"requires actually solving a minigame every time — the
friction is real engagement, not a timer"*, and bans daily-login hooks
outright. Most machine designs default to accrual — a thing that produces
while you are away — and that is the banned shape, not a variant of it.

**The world clock makes that non-negotiable.** `timeOfDay` reads the
player's own wall clock, local time, deliberately not simulated. A game day
is a real day. So a greenhouse that advances crops each dawn is not merely
accrual-shaped, it is literally a daily-login hook, and "set the machine to
water at six" is an errand at real-life six in the morning. Every design
keyed to the world clock was dropped on that.

**A machine is built out of what the world gave up, not bought off a shelf.**
Everything a child could put down until now came from the store: they earned
coins, the shopkeeper took them, a fence came back. A machine built that way
would be one more line on that shelf. So the recipe is wood and stone — the
things the *clearing spell* pays — and that is not decoration on the economy.
Subtraction is the spell this game under-uses, and the only thing wood and
stone could do until now was be sold, which makes them coins with an extra
step. Giving them somewhere else to go is the cheapest honest reason to cast
the spell.

**Fifteen wood and six stone, which is about five trees and three rocks.**
Sized against a walk rather than a wallet: a five-hundred-cell world carries
thirteen thousand scattered objects, so there is no wall to hit, and the
child will have cast the clearing spell a dozen times getting there. It asks
for *two* materials on purpose. A recipe in one material is a number; a
recipe in two is a plan, because the trees are in the woodland and the
boulders are up the hills — the first time this game has asked a child to go
to two places for one thing, and the cheapest way to make terrain matter to
something other than what will grow on it.

**There is no assembly puzzle, and that is deliberate.** No parts to
fabricate, no stages, no sum standing between a child and the machine. The
arithmetic in a machine belongs to what it *does* — a sorter deals a heap
into equal shares, which is the share spell — and a lock on the door of the
classroom is not a lesson.

**Where the solarpunk went, second time round.** The first pass put sun
panels on city crossings and wind pumps on the quay, and a playtest called
both: panels scattered about the place do not look good, and a pump makes no
sense beside the sea. Both notes were right, and neither wanted a better
scatter.

The panel then went **on a roof**, which was a better place for the same
object and still did not look good — and that was the useful signal. A third
attempt at placing it would have been the wrong move: what was wanted was
*whimsy*, not tidier hardware. So the city makes its power **overhead**.
Small airships ride at anchor above the rooftops, each with a wind turbine on
its back and a wire down to a house. Same idea, told as something a child
would point at.

**A blimp is never placed**, and that is what makes it cheap. It is not a
`PlacedObject`, not in the grid, not in a save; it blocks nothing and no
route can carve it away. Everything that made the panels awkward — a cell, a
price, a name in three languages, a connectivity pass that could delete them
— follows from being a thing the game *puts down*, and none of it applies.
The sprites are a pool the scene owns, in the same shape as the harbour's
ships over their berths. See `src/world/skyline.ts`, which is its own module
for the reason the generator keeps its own `SKYLINE` dict: two tests state
what a landmark is, and a blimp fails both, correctly.

**Nothing about it drifts.** The mooring wire is drawn into the sprite,
rigid with the hull, so bobbing the envelope two pixels lifts the tether two
pixels clear of the roof — a wire visibly unsticking itself once a second, at
a tile size where two pixels is plenty to see. The turbine spins instead. One
moving element is enough to stop a thing reading as frozen, which is the same
lesson the generator's still-props rule already carried.

That rigid tether is only possible because the blimp's canvas is the
townhouse's made taller and the two are lined up by their **bottoms**, which
puts the roof ridge at a row the generator has worked out —
`BLIMP_MOORING_ABOVE_FOOT`, asserted against the house's own geometry rather
than trusted, since the ridge moves if anybody changes a wall height in a
file that knows nothing about airships.

One to every five houses, spaced rather than drawn at random, and picked off
a *sorted* list: the order buildings come back in is world generation's
business, and a positional pick would rearrange a child's sky every time they
opened the game.

A **pump lifts water for something to grow**, and what is beside a quay is
the sea. The gardens are the one place in this world that actually wants
water lifted, so each village garden has one at the far corner of its fence
— outside it, so every bed inside stays plantable, and diagonally opposite
the way in, which is the one cell around a fence nobody walks through to get
anywhere.

What is left on the ground is greenery: planters between the fish stalls and
at every third city crossing. The lamp keeps the other two of every three,
because it is the one that does something, and a city that swapped half its
lamps for scenery would be a city that got darker to look nicer.

**The first machine is a sorter**: a hopper, a wheel that turns, and three crates
under it. Its silhouette is its arithmetic — one mouth at the top, three
boxes at the bottom, the wheel between them doing the dividing — and a child
who has never tapped it should be able to guess what it is for. It is the
first brass in a world dressed entirely in timber, because a machine has to
be told from a bench across a garden, and it has a vine growing up it, which
is the difference between a machine in this world and a machine in a factory.
It also inverts the art rule that placeable props stand still: that rule is
about props with nothing that could move, and a wheel standing still is what
would read as broken.

**How a child gets one.** The slot is in the crate whether they own one or
not — the spellbook's dimmed rune, one tray along, on the same argument that
a container with a gap in it says there is something to go and fetch.
Tapping it builds one and arms it in the same tap; there is no workshop to
walk to and no second panel. Tapping it without the materials puts the same
thought bubble over her head that a room she cannot afford to grow into
does: the materials wanted, with a cross beside them rather than over them.

**What it does not do yet is deal anything.** This is the built-placed-and-
still-there-tomorrow half; the share cast that gives it a job is next.
Sequencing it that way was the point — the unknowns were the sibling
repository's art pipeline and the save path, and the arithmetic was the part
that already existed.

**The one integration that had to change.** `SHOP_STOCK` was
`PLACEABLE_FIXTURES` itself, which held while everything placeable came off
a shelf. A machine is placeable and is not for sale, so the two lists have
come apart — left alone, the first machine landed on the village shelf
priced at infinity, which is a button that can only refuse.

### The top of the addition ladder, where the line comes off

**Asked for in a playtest:** at the highest setting, addition should be just
`A + B = ?`, and maybe every version of `? + B = C` as well.

The number line *is* the scaffold. It breaks a sum into one jump per place
and asks for each landing in turn, which is the method drawn — so taking it
away is what this ladder had left to do at the top, and it is the only thing
left that is not "the same sum with more digits in it".

**Two rungs, added above the existing ones rather than replacing them.** The
six-jump number line is still reachable and still the thing the parchment's
furniture was built for; `LONGEST_LINE_RUNG` names it, because a scenario
that wanted to exercise it used to be able to say `HARDEST_RUNG` and cannot
any more. Extending upward is safe by construction: `bandOn` scales the other
spells' ladders against `SHARED_TOP_RUNG`, never against the top, precisely
so that addition can grow without a clock having to grow with it.

**The numbers stop growing at the top, and that is the discipline rather than
a shortage of ideas.** Two things climb and they climb alternately; a rung
that took the scaffold away *and* changed the size would be the
two-things-at-once this table is arranged to avoid. So both bare rungs are
the same six-digit carrying sum as the rung below.

The scaffolded-then-not pairing survives in the only currency left once the
line has gone. `Total` asks `A + B = ?` — the answer where the answer has
always been. `Any` hides one of the three terms, so two casts in three ask
the child to *undo* an addition, which is what subtraction does and the first
time this game asks for it from the addition side.

**The hint for a missing addend is a subtraction, and showing it is the
lesson.** `? + 265382 = 612538` is undone by taking the term you have off the
total, and that is the one place in this spell that draws a minus sign.

**A bare sum is cast through a degenerate number line** — one jump, whose
only stop is whatever term was hidden. That is not a trick: the cast
machinery never asks what a line *means*, only whether the typed digits match
the stop, so the whole of typing, submitting, counting missteps and knowing
when a cast is done comes for free, and what is genuinely new stays where it
belongs, which is in what gets drawn.

It also nearly shipped a bug. The number line's own second hint prints
`from + jump = ?`, which on that degenerate line reads `0 + 612538 = ?` and
hands the answer over. It appears only after a wrong answer, so the next
answer would have been right every time and nothing would have looked broken.
`hintFor` now refuses to speak about a bare line at all, and a test asserts
that no bare hint ever contains the answer.

**What this does not yet cover:** the teacher still teaches the number line
at every rung, which is right for `A + B = ?` and says nothing about finding
a missing addend.

## Current milestone

Several children on one device, each with a name, a character they made, a
language and a world of their own — picked from a grid of faces every time
the game starts. A player moves through a world of multiple terrain types,
plants several kinds of crop, grows them with the first spell, picks them,
and sells them in the village store by checking the money the shopkeeper
counts back. Planting is still a direct action — pick a seed from the pouch,
or press a key — since the planting spell is not speced. Both gardening
actions work the tile the player faces. Growth is real: a crop starts as a
seedling and reaches maturity in two casts of the addition spell.

Worlds save themselves as they are played, and come back from a seed plus
the difference the child made to it. Villager requests, the design's intended
way to earn, are not built, so selling a harvest is still the only income.
