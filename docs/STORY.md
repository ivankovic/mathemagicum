# Mathemagicum — the story, and the order it is told in

## What this document is for, and what it refuses to do

`GAME_DESIGN.md` is three and a half thousand lines of decisions, each with
the playtest or the argument that forced it. It says what everything *is*.
What it has never said is what any of it is *for* — in what order a child
meets it, who hands them the next thing, and where the whole of it is going.
The systems were designed one at a time and they are good one at a time; laid
end to end they are a village, a wood, a hill, a city and a tech tree, with
nothing saying which of those a child is supposed to be standing in.

That gap has been reported from the floor rather than inferred. The clearest
statement of it is a playtest note about the great tree — *the old tree
teaches you the spell, but doesn't tell you the quest to get the spell* — and
the finding underneath it is worth quoting, because it is this document's
whole subject: **the order the children need is task first (*why am I here*),
lesson second.** The game has been very good at the lesson and has never had
a considered answer to *why am I here*.

**This document does not invent a premise.** There is no curse to lift, no
villain, no lost heirloom, and nothing here adds one. The pillars forbid it
outright — *no conflict, no enemies, no combat* — and a plot bolted onto a
cozy farming game is the narrative version of the quiz bolted onto the
gardening, which is the thing this project has refused from its first page.
What follows is the arc that is **already in the built game**, named, put in
order, and checked for the places where it breaks. Where connective tissue is
genuinely missing it is proposed in its own section at the end, marked as a
proposal, so it can be cut without unpicking anything above it.

## The story cannot be told in prose, so it has to be told in places

One rule governs everything here, and it is not a stylistic one. **Nothing is
said in words.** The status line was deleted after a playtest killed it in a
sentence — *the status update text is unreadable, and our youngest audience
can't read anyway* — and sixty-odd phrases went with it. Half this game's
audience cannot read a word of either language it speaks.

So there is no narrator, no cutscene, no journal, and there never will be.
A story told here is told with the only four things the game has:

- **Places**, which are entered and are visibly different from each other.
- **People**, who are found, who are tapped, and who ask for something.
- **Errands**, which are a row of pictures on a parchment and a thing that
  changes in the world when you have done them.
- **Things you can now do that you could not do before.**

That is a real constraint and it is also a gift, because it rules out every
cheap way of having a story and leaves only the honest one: the arc has to be
made of what the child actually does. **The plot is the order of the errands.**
If the order is right, the game is structured; if a story document has to
explain the order in sentences, the order is wrong.

Numerals are the exception the design already carves out, and they stay:
`347 + 265` and a clock face's `12` are the subject, not prose about it.

## The arc is widening competence and a widening world, with nobody to beat

Strip the systems back and the same shape appears twice over, once in what a
child can do and once in how far they can go. They start in a garden they can
cross in ten steps, holding one spell, able to make a carrot bigger. They end
— as far as the game is built — in a city garage, wiring machines into a line
that decides things, holding every operation there is.

Nothing was taken from them on the way and nothing was locked behind being
good at arithmetic. **Every gate in this game is either meeting somebody or
doing a piece of work**, and that is a design rule with teeth: the pillars
allow a spell to be gated on *finding a person* and forbid gating it on
*answering correctly*. The arc is therefore not a difficulty curve. It is a
sequence of introductions.

That also settles what the ending has to be, whenever one is built. It cannot
be a victory, because there is nobody to defeat. It has to be the last thing
a child learns to make.

## The acts are built on the five places, and where they are not is where it breaks

This is the load-bearing discovery of this document, and it was not invented
here: `WORLD_GENERATION.md` has carried it since the first draft. The world
is built out of **five anchor areas** — Starting Village, Enchanted Forest,
Big City, Harbour, Mountain Star Observatory — placed in that order, each
constrained relative to the ones before it, and each given *"one NPC-shaped
story object as the reason to go there"*.

Five places, each with a reason to be visited and somebody in it who knows
something. That is an act structure, and it has been sitting in the generator
this whole time being treated as a layout problem.

It is not a tidy one-to-one, and the three places it does not fit are the
three most useful things in this document:

- **The village carries two acts**, because the garden and the tower are two
  moments in one place rather than two places. That is fine and it is what a
  first act and a second act look like when a child has not yet gone anywhere.
- **The airship is an act with no place**, because the ending is something
  she builds rather than somewhere she goes. Also fine, and the reason the
  ending works.
- **The observatory is a place with no act**, and that one is not fine. It is
  the anchor area with no spell, no guide and nothing pointing at it, and it
  turns out to be a hard prerequisite for finishing the game. The geography
  predicted the gap before anybody looked for it.

Two things about it have moved since it was written, and the document has
not caught up with either:

- **The city's theme drifted from trade to machinery.** The generator's table
  still guesses *percentages/discounts, market economics* for the Big City.
  What actually got built there is the garage, the mechanic, and the whole
  Boolean-logic half of the game. That is a better city and a bigger one, and
  it is the single largest thing this document has to re-place.
- **"No gating" is no longer true, on purpose, and the pillars say so.** The
  generator insists *all spells are available from the start... it's a tutor,
  not a gatekeeper*. The pillar was since narrowed: the portal spell is the
  geometer's to give, the array spell is the tree's to pay with, and *meeting
  somebody* is now a legitimate gate where *answering correctly* still is not.
  Every act below therefore has a real door, and the door is always a person
  or a piece of work.

The acts are numbered here for reference only. **A child is not told a number
and cannot see one.** Nothing in the game announces an act, and nothing
should: the boundary between two of them is a walk to somewhere new.

## The cast, as the code already assigns it

`spellbook.ts` holds two tables — `TAUGHT_BY` and `TAUGHT_BESIDE` — and
between them they are the story's cast list and its map. Every spell that has
to be learned names the person who gives it and the landmark you can see from
outside and walk at. Nothing in this section is proposed; it is read off those
two tables and the anchor areas.

| Act | Place | Who is there | What they give | The sight to walk at |
|---|---|---|---|---|
| I | The garden and the square | **Bruno** the postman, **Lena** the schoolteacher, **Mira** the shopkeeper | the welcome, the first lesson, the only income there is | — |
| II | The village tower | **Anton** the geometer | the portal spell, measuring | the post office |
| III | The old forest | the great tree, which is not a person | the array spell, multiplication | the great tree |
| IV | The harbour | **Tomo** the fisherman, at the foot of a pier | the sharing spell, division | the lighthouse |
| V | The city | **Emil** the clockmaker under the clock, then **Frida** the mechanic in her garage | the hourglass, then logic, then six jobs and the machines they pay | the clock tower, then the garage |
| — | The observatory | **Vera** the astronomer | the blueprint, which is a machine and not a spell | the dome |
| VI | Frida's bench, and the sky | Frida again | the airship, which asks nothing | the airships over the rooftops |

Eight people have names of their own, and they are the same in all three
languages because a name is a proper noun. Everybody else — townsfolk,
quayside folk, the other shopkeepers — is drawn from a pool and says nothing,
deliberately: *a person who answers a tap with silence is worse than one who
does not answer at all*, so only the people with something to give can be
talked to at all. That is a casting decision as much as a technical one. **In
this world, being able to speak to somebody means they have something for
you.**

Addition and subtraction are in `KNOWN_FROM_THE_START` and have no teacher in
this table, which is right: they are what a child begins holding. The
schoolteacher explains the growth spell rather than granting it, and that
distinction is the difference between a lesson and a gate.

**The observatory is the odd one and it is the interesting one.** Every other
anchor pays in a spell; the astronomer's climb pays in a *machine*. It is the
one place where the reward crosses from the arithmetic half of the game into
the building half, and it is currently the only bridge between them.

## Act I — The garden, and one spell that makes things bigger

A child wakes up somewhere they can cross in ten steps, holding addition and
subtraction, and the first person they meet walks over to them rather than
waiting to be found. **The postal worker crosses the square and gives the
welcome** — four pages, two icons each: put a seed in the ground, grow it,
pick it, sell it. It is delivered by somebody rather than by a title screen
because *a child meets it as somebody saying hello rather than as a wall of
text between them and the game*.

The act's whole content is the core loop and the shop. Mira buys crops and
sells things to put in the garden, and the counter is the second minigame
before the child has gone anywhere at all. Selling a harvest is still the
only income in the game.

**What ends the act is the first errand that is not about her own garden.**
The guide order says so outright: the spellbook's guides run plant, grow,
pick, sell, and then `Learn` — *the first errand a child is given that is not
about her own garden is the one that pays for it, and the spell at the top of
the tower is what the next errand needs*. The door out of the garden is the
tower door.

## Act II — The village, and the first walk to somewhere on purpose

The geometer is up the post office tower, beside the map on the wall, and he
gives the portal spell. This is the act where the world stops being a garden
and becomes a place with distances in it, and the two halves of that arrive
together: **the map on the wall shows the five anchor areas, each named, and
where the player is standing** — and the spell he teaches is the one that
measures between them.

That pairing is the best piece of wordless storytelling the game currently
has, and it was arrived at by accident rather than by plan. *The post is the
one trade in a village that has a reason to know where everywhere else is.*
A child climbs a tower for a spell, and comes down knowing there are four
other places and roughly how far away they are. Nothing said it.

**The tower is also where the pillar bent.** The portal spell is the first
that has to be learned from somebody, and the design says why in as many
words: it *makes him someone you find rather than someone you could play the
whole game without noticing*. Act II exists because of that decision.

## Act III — The wood, where work is paid in a spell

The great tree is the third teacher and the first that is not a person. Its
errand is the clearest piece of structure in the built game, and the one the
rest should be measured against: **it asks for something, the asking is
visible from outside, and finishing it changes the world.**

- It asks for the wood to be taken off its beds — twelve squares, cleared one
  cast at a time with the subtraction spell.
- **It breathes while the errand is open**, a slow wide light over the crown,
  four seconds to a breath, and *it goes out the moment the last bed is
  filled*. A child can see from across the clearing whether the tree is still
  asking.
- It pays in the array spell, and then asks for the beds to be filled — which
  the spell it just handed over does in a single cast.

That last beat is the argument the whole act is built to make: twelve
subtractions one square at a time, then sixteen squares on one answer, ten
seconds apart. **The tree pays for the clearing and asks for the beds
afterwards**, and it is that way round because the first version rewarded the
child *after* the work the reward would have saved.

This act is also where the economy stops being only coins. Wood and stone are
what the clearing spell pays, and they are what machines are built from, so
the wood is quietly the first half of Act V.

## Act IV — The harbour, where a catch is dealt into equal baskets

Tomo stands at the foot of the first pier and teaches the sharing spell. The
act is the thinnest of the five and the reasoning behind it is the strongest:
*dealing a catch out into equal baskets is what a quay does all morning, and
the harbour was the one place in the world with people in it and nothing to
learn from any of them.*

Note what the sharing spell *does* once she has it. The array spell ripens a
patch in a cast; the sharing spell picks one in a cast. **They are the two
ends of the same gesture**, and a child who has done Act III arrives here
already holding half of it. That is the only place in the game where two acts
are joined by the mathematics rather than by a road.

The harbour also carries the lighthouse, which is the sight a refused sharing
rune points at. There is no separate beacon, and the ship moored at the quay
is a walk-in building rather than a destination.

## Act V — The city, where the arithmetic becomes machinery

This is the largest act by a wide margin, and it is really two.

**Emil stands under the clock tower** and teaches the hourglass. He has it
because the spell belongs with the thing that tells the time to everybody at
once, and because *the child who wants to know what o'clock it is is standing
in the plaza* rather than up a mountain. That is Act V's front door and it is
a low one.

**Frida is in the garage**, and everything after her is a different game
politely wearing the same coat. She teaches the logic spell — the first that
is not arithmetic at all — and then sets **six jobs**, each of which is a line
of machines that has to be built, wired and made to work. Finishing one lets
the crate offer the next machine. The machines are the operations: the sorter
divides, the hothouse multiplies, the sieve takes away, the tally counts to a
mark, the press waits for both, the funnel takes either, the bell says so, and
the trapdoor, the seesaw and the strongbox are NOT, XOR and memory.

**This is where the game stops being about arithmetic and starts being about
programming**, and nothing in the world marks the transition. A child walks
into a garage for a spell and walks out building state machines. It is the
single best thing in the game and the single worst-signposted.

Two structural facts about this act are worth stating plainly:

- **The materials come from Act III.** Machines are built out of wood and
  stone, which is what the clearing spell pays, so the wood a child cleared
  for the tree is what the city is made of. That is a genuine through-line and
  it is invisible: nothing ever says so.
- **The observatory hangs off this act rather than the harbour.** Vera's five
  lamp posts earn the blueprint, which is a *machine*, and the blueprint is
  the one that records a line and stamps it out again. So the mountain is not
  a sixth place on a ring — it is a side door into the garage.

## Act VI — The airship, which is the only ending the game has

It already exists, and it is better than anything this document could have
proposed. Frida's bench builds an airship in four stages — keel, basket,
balloon, rudder — out of pressed materials. **It asks no questions and checks
no answers.** The child climbs in, the ship rises, the city goes under her,
and she comes down in her own garden with everything where she left it.

The reasoning is already written down in `world/airship.ts`, and it is the
closest thing this project has to a statement of what the whole game is for:

> But a child who has spent forty afternoons pressing timber deserves to
> have been building *towards* something, and the airships have been
> floating over the city since her first walk into it. Building one is the
> game saying that the thing she has been watching was always available to
> her.

That is the arc's real shape, stated better than the section above states it.
**The scenery of Act V is the goal of Act VI**, and it has been on screen
since the child's first walk into the city. Nothing had to be explained
because the thing was already in the sky.

Three properties make it the right ending for a game with no enemies:

- **It is not a test.** Every other milestone is paid for with an answer. The
  last one is paid for with having done the work, which is the only ending
  consistent with *nothing is locked behind being good at arithmetic*.
- **It ends at home.** The flight puts her back in the garden she started in,
  with the garden intact. Flying is *an ending and not a deletion*.
- **It stays.** The ship is hers afterwards and becomes the quickest way
  between places she has been. The reward for finishing is a better version
  of the thing the game is, not a credits roll.

**The flight is built, and its own docblock says it is not.** `flyAway`
raises a ship sprite, hands the camera to it, pulls back, holds, and brings
her down at home, all in under six seconds with a failsafe in case a cheap
tablet runs long. The comment directly above it says *what is here is the
fact of the flight and not yet the sight of it... the spectacle is owed*.
One of the two is out of date, and from reading the code beneath it the
comment is. What is genuinely missing is narrower than the comment claims:
she rises and the camera pulls back, but the city does not travel under her.
Whoever picks this up should settle which sentence is true before building
anything.

## The order a child actually meets it, which is not the order above

The acts are the *geography*. What a child walks through is the **guide
order**, and the two do not agree. Read off `GUIDES` and the errands, the real
sequence is:

> plant → grow → pick → sell → **the tower, the geometer, the portal** →
> place a fence → clear a tree → up the hills for stone → **build a machine,
> wake it, feed it, take from it, wire it** → the forest → **the tree's
> errand, the array spell** → the harbour → **the fisher, the sharing spell**
> → the city → **the clockmaker, the hourglass; the mechanic, logic** → her
> six jobs → the mountain → **the astronomer's lamps, the blueprint** → the
> pressing tree → **the airship**.

**The machines arrive fourth, and two of them cannot be woken until the
sixth and seventh.** Nothing here is a bug; every piece behaves as designed.
The machine guides start *when she can afford a machine*, which is shortly
after the hills, and the cheapest of the five is the sieve at six wood and
four stone. The sieve wakes on clearing and the tally on growth, so a child
who builds the cheapest thing first gets a working tutorial on the two spells
she has held since minute one.

The trap is the order the crate itself keeps. `MACHINE_TYPES` runs sorter,
hothouse, sieve, tally, press, and the guide points at the *first affordable*
one in that order rather than the cheapest. **The sorter wants the sharing
spell and the hothouse wants the array spell**, and those are the harbour and
the forest, two acts further on. So the child who saves up instead of
spending early is the one the guide walks into a machine she cannot wake —
and saving up is what a careful child does.

The game already handles this gracefully at the level of a single tap: a
machine she cannot wake answers with the lighthouse or the great tree rather
than with a sum. What it does not do is *mean* anything. A child is walked
through building a machine, and the reward for finishing the tutorial is
being told to go somewhere else.

Two readings are available and the project should pick one deliberately:

- **It is a lure.** The machine tutorial exists to put an unwakeable thing in
  her garden, and the thing is the reason she walks to the harbour. On this
  reading the order is correct and only the signposting is missing.
- **It is out of order.** The machine tutorial belongs after the harbour, and
  starting it on affordability is the wrong trigger; it should start when she
  can afford a machine *she can also wake*.

This document does not decide that. It says it has never been decided.

## Where the structure breaks

Each of these is a place where the told order and the built order disagree.
They are listed with evidence and without a recommendation, because every one
of them is a design call rather than a repair.

**The chain's promise breaks exactly where the game leaves the city.** The
mechanic's six jobs are built on one rule a child learns in four consecutive
repetitions — finish a job, the crate offers the next machine — and the last
two both hand over nothing. Neither is an oversight; `jobs.ts` says why in as
many words, and the reason is the interesting part: *the machine the next job
needs is the blueprint, and that is the astronomer's to give.* The chain does
not fizzle out. It hands off, silently, to a person on a mountain.

**So the observatory is not optional, and the hand-off to it is still
silent.** `Twice` needs a blueprint stamped, the blueprint is
`EARNED_BY_ERRAND`, and the errand is Vera's five lamps, so the mountain is a
hard prerequisite for finishing the game. It used to be the only anchor area
with no spell, no guide and no mark of any kind naming it; the map on the
tower wall now marks it, which is described below. What that does not fix is
the moment it matters. A child reaches the fifth job, the rule she has been
taught four times stops working, and **the job sheet in front of her says
nothing about a mountain** — she has to think to go and consult a map in
another building. `Hold`'s bargain line does point at the observatory, one
line, on the job before the one that needs it.

**The press is a hidden hinge.** The funnel, bell, inverter, seesaw and latch
all want beam or cord, and only a press makes either. So the press gates the
entire logic half of the game through the materials rather than through a
job, and nothing anywhere says so. A child who has not built one is not
refused; she simply cannot proceed, for a reason with no picture.

**The harbour is one conversation.** Every other act asks for work: the tree
wants twelve squares cleared, the astronomer wants five lamps lit, the
mechanic wants six lines built. Tomo wants nothing. He is the thinnest act in
the game and he carries division.

**Lena teaches a spell the child already has, and is the only teacher who is
not a door.** That is defensible — a lesson is not a gate — but it means the
village's schoolhouse is structurally inert. It is the one building a child
can walk into, get something, and have nothing change.

**The proto-algebra has no act at all.** The brick pyramid, where half the
gaps must be solved backwards, is the most mathematically advanced thing in
the game. It is attached to building a wall in a room and to nobody. No
teacher explains it, no errand asks for it, and it appears in no act above.

**The materials through-line is invisible.** Machines are made of wood and
stone, which is what the clearing spell pays, which is what the tree's errand
had her cast a dozen times. The forest is literally what the city is built
out of. Nothing in the game connects the two, and a single line of machinery
in the garage made of visibly forest timber would.

**The ending has no scene.** The airship's state is built; the take-off, the
city going under her, and the descent into her own garden are not. The whole
of this game's ending is one wordless minute, and that minute does not exist.

## Documents that have drifted, which is how the structure got lost

The structural problems above are hard. These are not, and they are listed
because a story that contradicts its own design documents is a story nobody
can hold in their head.

- **`GAME_DESIGN.md`'s "Current milestone" describes a different game.** It
  has no machines, no city and no logic in it, and it states that *villager
  requests, the design's intended way to earn, are not built* — a plan that
  the same document elsewhere records as *abandoned outright*.
- **`WORLD_GENERATION.md` still guesses the city's subject** as percentages
  and market economics. The city teaches time and Boolean logic.
- **`WORLD_GENERATION.md` still states there is no gating.** The pillar was
  narrowed deliberately; five spells now have teachers.
- **`README.md` lists the mirror spell**, which has been deleted. Seven
  spells are named there and seven exist, but they are not the same seven.
- **Nobody agrees how many teachers there are.** `TAUGHT_BY`, which is the
  mechanism of record, holds five. The comment directly above `spellTaughtBy`
  in the same file says *there are six of them*, and `teacherMarks.ts` says
  six as well, while `GameScene.ts` and `characters.ts` both call the mechanic
  *the seventh teacher* and the design document's section is titled *Three
  teachers*. Five, six, seven and three, in four places, one of which
  contradicts its own table eighty lines further up. The disagreement turns on
  whether Lena counts, since she explains a spell rather than granting one,
  and whether Vera does, since she pays in a machine — which is exactly the
  question this document has had to answer twice.

## Two of these are now built: how the world says there is somewhere to go

The problem this document exposed is that the world is open, so a child meets
the five places in whatever order she wanders into them, and nothing in the
game ever says that somewhere else has something for her. Two mechanisms now
do, and both work by **pulling rather than pushing**. Neither closes a door,
neither adds a word, and neither changes the order anything may be done in.

**A machine waiting on a spell wears the rune that would wake it.** The crate
offers a sorter from the first minute and the sorter is woken by the sharing
spell, which is taught on a quay most children will not see for several
afternoons. Now that sorter stands in her own garden wearing the divide rune,
breathing, exactly as the great tree's wood wears the minus rune and for the
identical reason: a thing in the world that is *about* a rune, which cannot be
asked because it is not somebody. The worst-timed thing in the game becomes
the reason to walk to the harbour, because she is carrying the question home
with her. Only the nearest one asks, and only one she can walk up to. A garden
where every waiting machine pleaded would be a chore list rather than an
invitation. See `machinesAwaitingTheirSpell`.

**The map on the tower wall says which places still have something for her.**
It drew where everywhere was and never whether any of it was worth the walk.
Each of the five now wears the pictures it still owes, in the guide's own
cyan, which is the colour a child has already met over a teacher's head
meaning *this one still has something for you*. They go out as they are given,
so a map where nothing glows is a map that has genuinely been finished. The
city wears two, because it holds two teachers. See `owedAt` in
`placeMarks.ts`.

**The dome wears the blueprint's own picture rather than a rune**, and that
was a decision rather than a fallback. The astronomer is the one teacher in
the game who pays in a machine instead of a spell, so what she owes has no
rune to draw. The picture is the one the crate shows, which means a child sees
the thing she was promised in the place she will later take it from. It also
means **the observatory is now marked at all**, which was the point: it was
the one anchor area with nothing pointing at it while holding a hard
prerequisite for finishing the game.

Two of the four ideas that were considered are not built, and both remain
open. Every place could advertise itself on the horizon in motion, the way the
airships over the city already do and the lighthouse's optic already does;
that one is a rendering problem rather than a design one. And a teacher could
want one thing that only exists somewhere else, which would create traffic
between places on purpose, but it is a fetch errand and survives only at
exactly one item, given once.

**None of this decides the ordering question.** Whether the machine guides
should start later is still open, and the first mechanism above is deliberately
the version that is right either way: a machine waiting on a spell is worth
marking whenever it happens.

## Proposals, which are the only invented things in this document

Everything above is read off the built game. What follows is not, and it is
kept here so it can be cut in one piece. Each is the smallest thing that
would close a gap named above, and each obeys the rule that nothing is said
in words.

**Give the observatory a rune-shaped reason to exist.** It is the only anchor
with nothing pointing at it and it is a hard prerequisite for the last job.
The cheapest fix uses machinery that already exists: the mechanic's job sheet
already carries a bargain line that points at a place, and `Hold`'s already
points at the observatory. Pointing `Twice`'s at it as well, before the
blueprint is earned, would put the mountain in the one place a child is
already looking when she needs it.

**Let the hand-off to the mountain be a hand-off a child can see.** `Hold`
pays no machine because the next one is Vera's, and that is the right design
badly served: the sheet draws a glad mark where a machine would go, which
reads as *finished* rather than as *go and see her*. A picture of the dome
where the machine picture would have been says the true thing in the place
the child is already looking.

**Let the airship appear on the sheet before the last job, not after it.**
The two jobs nearest the ending are the two that hand over nothing, so the
goal becomes visible at the exact moment the chain stops rewarding. Showing
the ship earlier costs nothing and is the same trick the city already plays
by having them in the sky from the first walk in.

**Make the forest's timber visibly the city's.** A single line in the garage —
a press fed by a hopper of the same logs the tree's thicket drops — would say
the through-line without a word. This is scenery, not a system.

**Settle what the ending still owes, then build only that.** The flight
exists. Its docblock disagrees with it, and the disagreement is the reason
nobody knows whether this is finished. Reconcile the two, and if anything is
still wanted it is the middle beat — the city travelling under her — rather
than the flight.

**Do not give the child a reason.** There is no premise to add. She has a
garden, there are people who know things, and the airships have been in the
sky since her first walk into the city. That is enough, and it is more honest
than a plot would be — the game's own title card has said so from the
beginning: *a garden, and the sums that grow it.*
