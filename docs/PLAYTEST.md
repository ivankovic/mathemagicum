# Playtest — children, 2026-08-19

Eight things came back from playing the game with the children it is for.
Written down before anything is changed, because the useful part of a
playtest is what was *observed*, and that gets rewritten in memory the moment
somebody starts fixing it.

All eight are now done. Four were defects and four were decisions, and the
decisions were taken with the children's answers rather than guessed at.
Where a cause was found it is written down, because the cause is the part
worth keeping — two of the defects were introduced by the avatar work in this
same session, and both were the kind of mistake that repeats.

Ordered as reported, not by priority. What is done and what is still open is
at the bottom.

**A second round is at the foot of this file** — 2026-08-20, the first
session with the world outside the village in it. Rounds are appended rather
than replacing each other, so a report that comes back twice is visible as
having come back twice.

---

## 1. The children want to share a world — **built**

**Reported:** they want to play in the same world as each other.

This reverses the constraint the profiles work was built to: *"for now not
the same world"*. It is not a small setting — one world per child is baked
into the shape of a save. A profile currently *is* a world: it owns a seed,
and the save is the difference between what that seed generated and what
that child did to it.

Sharing raises questions no part of the game answers yet:

- **Whose world is it?** If two children share, the world has to belong to
  the device rather than to a player, and a child who is removed must not
  take the shared world with them.
- **What is still per child?** Their character, their name, their language
  and their difficulty clearly stay theirs. Their purse and basket almost
  certainly stay theirs too — one shared purse means one child can spend
  another's money. But the *garden* is the thing they want to share, and a
  crop planted by one and picked by the other is the whole point.
- **Do they see each other?** Almost certainly not — they are taking turns
  on one tablet, not playing at once. But then: what does a child see of
  what their sibling did? Just the changed world when they next play, or
  something that says so?
- **What happens to the worlds they already have?** Two children with two
  farms cannot be merged into one. Either sharing is a new world nobody has
  played, or one child's world becomes the shared one and the other's is
  kept aside.

**Decided: one world for the device.** Everyone gardens the same land,
taking turns. What stays per child is the *person* — their name, their
character, their language, their difficulty, their purse and their basket.
What is shared is the ground: the terrain, the seed it came from, what is
planted in it and what has been put down on it.

A purse per child rather than one between them is the part worth stating,
because it is the one place the split is not obvious. A shared purse means
one child can spend what the other earned, and on a shared tablet that is a
fight rather than a feature. Crops in the basket are theirs for the same
reason — they picked them.

Consequences that follow and are not yet answered:

- **The seed moves off the profile and onto the device.** A world is no
  longer something a child owns, so removing a child must not remove it.
- **Two existing farms cannot be merged, and they are allowed to be lost.**
  Decided during playtesting: losing saves is acceptable for now. So a shared
  world simply starts fresh, and no migration is written for any of the save
  changes below — the same permission covers the difficulty and money work.
  This has an expiry date on it: the first time a child plays a farm worth
  keeping, it stops being true.
- **What a child sees of what their sibling did** is unanswered. They will
  simply find the world changed; whether anything should say so is a design
  question, not a technical one.

## 2. They want animals — **built**

**Reported:** they want animals.

Entirely new. Nothing in the design doc covers livestock or pets, and it
touches most systems at once: art (a generator job of its own, with the same
four-facing walk cycle characters have), a rule for what an animal *does*,
and — if animals are to be more than scenery — some maths they are the
subject of.

Worth noting that the design's own pillars point at an answer: a spell's
effect should mirror its mathematics, and the only spell so far makes things
grow. Animals that need feeding, or that produce something countable, would
give the arithmetic somewhere else to land. Animals that merely wander are
cheaper and would probably satisfy the request as stated.

**Decided: creatures that live in the world.** Chickens, cats, birds,
rabbits — wandering the village and the fields, there to be looked at and
followed. Not owned, not fed, nothing to solve.

That is the cheap half and it is the right half to do first. It is mostly a
generator job (the same four-facing walk cycle characters already have, on
smaller bodies) plus wandering, which the villagers already do. Animals to
*keep* — a pen, feed that comes from crops, something countable they produce
— is a whole system and can be designed later, once there is something to
watch children do with the animals that merely exist.

## 3. The new avatars never turn — they always face forward — **fixed**

**Reported:** the characters made in the chooser do not turn left or right.

**Defect, cause known, mine.** `registerCharacterAnims()` runs from
`loadAssetMetadata()` at `GameScene.ts:627`, and the player's recoloured
character name is not assigned until `GameScene.ts:669` — forty lines later.
So at the moment the animations are registered, `this.playerCharacter` is
still its initial value `"player"`, which *is* in `ALL_CHARACTERS`, so the
guard that was meant to register the avatar's own animations skips them:

```ts
if (!ALL_CHARACTERS.includes(this.playerCharacter)) {
  this.registerAnimsFor(this.playerCharacter, this.profile.avatar.body);
}
```

The recoloured sheet therefore has **no animations at all**. Every
`sprite.play(...)` on it names a key that does not exist, Phaser does
nothing, and the sprite stays on the frame it was created with — frame 0,
which is idle facing down. Hence "always face forward", and it would also
mean the character never animates while walking.

It only affects a *recoloured* player. A child whose colours happen to match
the shipped sheet exactly falls back to the plain body and turns normally,
which is probably why it survived my own checks.

**Fixed** by making the texture and its animations one act — `useAvatar()`
does both, so there is no window in which a recoloured sheet exists without
the animations that drive it, and nothing to keep in the right order.
Confirmed in the browser on a recoloured avatar: all four facings are now
distinct, with a face when walking down, a profile each way, and the back of
the head when walking up.

## 4. "You cannot plant there" is unreadable — **fixed**

**Reported:** when planting somewhere that will not take a seed, the small
text is not readable. They want a visual cue instead.

Not a defect — the refusal messages work as designed — but the design is
wrong for the audience. The message line is one line of small type along the
top of the screen, and the child's eyes are on the tile they just tried to
plant, several hundred pixels away. A six-year-old also may not read it at
all, which is the same barrier already noted as out of scope in the
difficulty work ("the youngest band needs less reading, not just smaller
numbers").

This is the first concrete case of that barrier, and it suggests the general
rule rather than a one-off fix: **a refusal should be shown where the refusal
happened.** Something on the tile itself — a mark, a shake, a colour — with
the words as a supplement rather than as the whole message.

Worth deciding at the level of "how does this game say no", not just for
planting: the same problem applies to placing a fence, casting on bare
ground, and selling something the shop does not want.

**Fixed at that level.** A refusal that is *about a square* now marks that
square: a red cross, drawn over the tile, fading in under half a second. Red
is the only red in the world — the terrain palette is pastel throughout — so
it reads as a message rather than as scenery, and a cross is the one mark
that means no and nothing else. An outline would read as *selected* and a
tint as terrain, both of which the game already says elsewhere.

The words stay, as a supplement for whoever reads them, rather than being
removed — an older child gets told *why*, and the younger one no longer has
to read to find out *where*.

Two things make it general rather than a patch on planting. Every refusal
that concerns a tile now names it, so the rule that refused is what decides
where the mark goes; and every action reports through one method, so the next
rule that refuses does not have to remember to do this. Refusals that are not
about a square — no seeds left, nothing in the basket — carry no tile and
mark nothing, which is right: there is nowhere to point.

## 5. Buildings are entered by walking into their sides — **fixed**

**Reported:** entering from left and right is wrong — it is entering from the
left and right *side of the building*, rather than the door being three tiles
wide.

**Defect, cause known.** The widened entrance is doing what it says but not
what was meant. `entranceFor` in `src/world/buildings.ts` widens the doorway
by one cell each way and clamps it to the footprint, which is correct as far
as it goes:

```ts
minCol: Math.max(anchorCol, door.col - ENTRANCE_REACH),
maxCol: Math.min(anchorCol + width - 1, door.col + ENTRANCE_REACH),
```

The miss is that `isEntrance` tests only *which cell is being stepped into*,
not **which direction the step came from**. So a child walking along the
front of a building sideways, bumping into the wall a cell to the side of the
door, is put indoors — they entered through a wall. On a building where the
door sits near a corner, the entrance cell *is* the corner, so the wall they
walk into is the building's own side.

The original problem this solved was real: a one-cell doorway is hard for a
child to hit. The fix has to keep the forgiving width for somebody
approaching the door and stop it applying to somebody scraping along the
wall.

**Fixed** by giving `isEntrance` the step being taken, not only the cell
being stepped into: a doorway is approached from in front of it, so only a
step into the wall counts. Sideways along the wall is a wall. Confirmed in
the browser — walking up into the door and one cell either side of it all go
inside, and walking sideways into the wall from either side now bumps.

## 6. A shadow artifact sits on top of the player — **fixed**

**Reported:** a random shadow artifact appears on the player.

**Defect, cause known, mine.** `avatarTexture` in `src/avatar/texture.ts`
registers the recoloured canvas as a spritesheet with only a frame size:

```ts
scene.textures.addSpriteSheet(key, canvas, {
  frameWidth: frame.width,
  frameHeight: frame.height,
});
```

But the shipped sheets are packed with padding — `player.json` declares
`"margin": 1, "spacing": 2` — and `BootScene.queueSheet` passes both. Slicing
the same image on a bare 32×48 grid from (0,0) puts every frame one pixel up
and left of where it belongs, drifting further with each column and row. What
lands in the frame is a sliver of its neighbours, and on a character sheet
the neighbour above is the next frame's **shadow ellipse** — which is exactly
the artifact described, appearing over the character rather than under it.

**Confirmed against the sheet itself**, rather than against the game: cutting
`player_sheet.png` both ways and comparing frames shows the naive slice
pulling the previous row's boots in above the character's hat on **16 of the
72 frames** — the ones in rows below the first, where the frame above has
something at its bottom edge. Sixteen frames out of seventy-two is exactly
why it read as "random": it flickers in and out as the walk cycle plays.

**Fixed** by making the slicing one function, `spriteSheetConfig`, used by
the loader and by the recolour alike — there is no longer a second place that
could describe the same sheet differently. Tests assert it carries the
padding, and that the shipped sheets really are padded, so the shortcut
cannot become harmless by accident.

**Why my verification missed it, which is the more useful part.** I proved
the recolour was byte-exact by comparing the recoloured texture against a
source texture that my probe had loaded *with the same wrong slicing*. Both
were mis-cut identically, so they matched perfectly and the screenshot looked
right. A comparison against a copy of my own mistake is not a check. The
frame *count* also happened to come out the same (204/32 → 6 columns,
600/48 → 12 rows, 72 frames either way), so the one number I did compare
could not have caught it either.

## 7. The difficulty should adjust itself — **built**

**Reported:** the difficulty level should auto-adjust.

It does — but only within the band somebody picked at setup, one rung per
four clean casts, and the bands are three rungs wide. Two readings, and they
want different things:

- **They did not notice it working.** Four consecutive clean casts is a long
  time in a garden where each crop takes two, and a band ceiling is reached
  and then never moves again. From the outside that is indistinguishable
  from a fixed difficulty.
- **They want it to cross bands.** That is, they want the setup question to
  stop mattering, or to disappear.

The band bounds exist for a reason worth re-reading before loosening them:
they are what stops a wrong answer at setup pitching the game at somebody
else, and what stops a run of lucky guesses walking a six-year-old up to
three-digit sums. But "picked once, never moves" was explicitly rejected as
an option, and if the adaptation is invisible in practice then the thing that
was chosen is not what shipped.

Also relevant: **the adaptation was measuring the wrong thing until this
session's last fix**, counting an abandoned cast as a stumble. Any impression
formed before that fix is an impression of a different system.

**Decided: the band becomes a starting point, not a fence.** Keep playing
well and the sums keep growing past what was picked at setup; the choice
becomes where a child *begins* rather than where they are held.

This is a real reversal of the reasoning the bands were built on, so what
that reasoning was protecting has to be protected some other way. The fence
existed to stop a wrong answer at setup pitching the game at somebody else,
and to stop a run of lucky guesses walking a six-year-old up to three-digit
sums with only an adult likely to notice. Leaving the band open means:

- **Crossing should be slower than climbing within a band**, or the fence has
  simply been deleted rather than replaced.
- **Coming back down must work as well as going up**, and across a band
  boundary too — a child carried up by a good afternoon has to be able to
  come back.
- **The options panel becomes the safety net**, which is another reason it
  shows the band and lets an adult put it back.

## 8. The currency names are confusing — **built**

**Reported:** the currency names are confusing.

The money is invented — "suns" and "rays", a hundred rays to a sun — and it
was invented deliberately, because a children's game that shows a euro price
and asks for euros on a counter can be read as asking for real money. That
reason has not changed and the names should not go back to being real
currencies.

But the names are doing two jobs badly:

- **They are not obviously money.** "Ray" does not read as a coin, and
  nothing about the word says it is the small one. A child has to be told the
  relationship rather than guessing it.
- **`1,00 ducat` reads oddly.** A decimal amount followed by a singular noun is
  not how any real price is written, and the format was inherited from the
  currencies this replaced.

The shape must survive whatever replaces them — a hundred minor units to the
major one, a 1-2-5 coin ladder, amounts stored in whole minor units — because
that shape is the part being taught. What can change is what they are called
and how an amount is written.

**Decided: the names, not the format.** The structure stays exactly as it is
— a hundred small to one big, a 1-2-5 coin ladder, amounts stored in whole
minor units — and so does how an amount is written. What changes is what the
two coins are called.

What the new names have to do, which is what "sun" and "ray" fail at:

- **Both have to read as money.** "Ray" does not read as a coin at all.
- **The small one has to sound like it belongs to the big one**, so a child
  can guess the relationship instead of being told it.
- **Neither may be a real currency**, for the reason that has not changed: a
  children's game that asks for euros on a counter can be read as asking for
  money.

---

## Where this stands

**Fixed:** 3, 4, 5 and 6 — the three defects and the refusal cue. All four
are verified in a browser rather than only by tests, and each carries a test
for the property it broke.

**Built:** all eight, in the order money → difficulty → shared world →
animals, cheapest and least entangled first.

What is worth carrying forward from this round rather than from the list:

- **Two of the four defects were mine, from the session before**, and both
  were the same kind of mistake — a thing described in two places that then
  drifted. The fixes were structural rather than local: one function that
  says how a sheet is sliced, and one act that makes a texture and gives it
  its animations. Neither can now be got wrong in one place only.
- **A comparison against a copy of your own mistake is not a check.** The
  shadow artifact survived a byte-exact verification because the reference
  had been loaded with the same wrong slicing. When something is verified,
  the reference has to come from outside the thing being tested — the sheet
  on disk, not the game's own reading of it.
- **The permission to lose data has an expiry.** It is what let the world
  move off the profile without a migration, and it stops being true the first
  time a child plays a farm worth keeping.

---

# Playtest — 2026-08-20

Five things came back from the second session, the first with the world
outside the village in it. Written down before anything is changed, for the
same reason as the round above: the useful part of a playtest is what was
*observed*, and that gets rewritten in memory the moment somebody starts
fixing it.

Ordered as reported. Where I went and looked at the thing before writing it
down, what I found is under *Found*, and it is separated from *Reported* on
purpose — the report is evidence and the rest is a guess until it is built.

All five are now done. Three of the five came back worse than reported once
looked at, which is the argument for looking: the tree's quest text existed
and was being written somewhere nobody could read it, the portal's rulers had
no marks on them at all rather than small ones, and the city's ground was
arguing with its own walls.

---

## 1. The great tree teaches the spell but never sets the quest — **fixed**

**Reported:** the old tree teaches you the spell, but doesn't tell you the
quest to get the spell. Before you complete the quest, tapping the tree
should give you the quest.

**Found:** the quest text exists and is being written to the wrong surface.
`openGroveLesson` does two things in the same breath: it puts
`words.groveAsks(progress)` into the one-line HUD message at the top of the
screen — *"The wood has closed over my bed. Take away the 6 that still
stand."* — and then immediately opens the grove lesson panel over the whole
screen. The panel is what the child reads. The message is behind it, in small
type, at the top edge, and by the time the panel is closed it has usually
timed out.

So the game says the quest exactly once per visit, in the least visible place
it has, at the moment the child's attention is somewhere else. From the
outside that is indistinguishable from a tree that teaches rows and columns
and asks for nothing.

Worth separating two things that are currently one call:

- **The lesson** — what multiplication *is*, four pages of rows and columns.
  This should keep coming on every visit; it is the thing the tree is for.
- **The task** — what is still standing and what is still to ripen. This is
  the part that changes between visits, and it is the part that is invisible.

The order the children need is task first (*why am I here*), lesson second
(*and here is what you are working toward*). The current order is the reverse
and the task is a footnote.

Note also that the spell is only *taught* at `GroveTask.Done`, so before the
quest is finished the tree opens a panel explaining a spell the child cannot
have, with no visible statement of how to get it. That is the whole
complaint.

**Fixed: the task is a page, and it is the page the deck opens on.** A fifth
beat, `GroveBeat.Task`, ahead of the four that teach — headed *The tree's
bed*, with what is still to do, the bargain under it (*"Do that and the six
dots are yours"*), and a picture of the bed as it actually stands: twelve
squares, ripe ones filled, and the wood drawn over the top while it is still
standing. The wood is stepped five squares at a time so six thickets scatter
over the bed rather than filling the first six in a block, which would read
as a bed half planted.

The page is in the deck whether the task is done or not — finished, it says
so. A deck that grew a page would move the page dots under a child who had
just learned where "next" was.

`titleText` now takes the page it is heading, because this deck has two
subjects on one sheaf of paper. Nothing else about the lesson changed: all
four teaching beats are still shown at every rung, because a lesson is not a
gate.

## 2. Four-direction movement is annoying — **fixed**

**Reported:** add diagonal movement, 4 directions only is annoying.

**Found:** this is smaller than it looks, because the facing and the movement
are already separate. `Facing` has four values because that is all the
character art has, and `facingFor` already snaps *any* vector to those four —
"the same rule reads a joystick's offset as reads a grid step". So a player
can move diagonally and still face one of four ways without a single new
sprite.

What has to be decided rather than derived:

- **Corner-cutting.** Moving diagonally past the corner of a building either
  clips through it or requires both orthogonal neighbours to be free. The
  second is the usual answer and the one that will not look like a bug.
- **What a diagonal step does to the facing.** Up-and-left has to snap to one
  of them, and whichever it picks is the tile that gardening will act on.
- **`stepsToSpeak` vs `stepsBetween`.** The comment on `stepsToSpeak` says
  diagonals are out of reach for gardening *because* there is no diagonal
  facing to turn to. That reasoning survives — the facing is still one of
  four — but the comment will need rewriting so the next reader does not
  conclude the codebase disagrees with itself.
- **The joystick and the keyboard have to agree**, including two arrow keys
  held at once.

**Fixed, and it was as small as it looked.** `joystickStep` snaps the stick
into eight equal octants of 45 degrees, beside the four-way `joystickDirection`
that still decides how the character is *drawn* — the two are allowed to
disagree, and a child walking up and to the left is drawn facing up.
`pressedDirection` adds the held keys along each axis instead of returning the
first one it finds, so two arrows make a diagonal and opposite arrows cancel.

Three decisions that were not derivable:

- **No corner-cutting.** A diagonal needs *both* its orthogonal neighbours
  open. Verified in the browser by hunting the world for a diagonal pinch —
  two blocked cells with a free corner behind them — standing on it and
  pushing into it.
- **Sliding.** A refused diagonal falls back to whichever single axis is
  still open, so pushing diagonally at a wall runs along it instead of
  stopping dead. That is most of why eight-way movement feels better than
  four, and it has a second effect worth naming: a door is never entered on a
  diagonal, because pushing into the corner beside one slides past it.
- **A diagonal takes longer.** The step tween is scaled by root two.
  Otherwise cutting across is forty per cent faster than walking round, which
  turns a convenience into the only sensible way to travel.

Equal octants were worth being careful about: a diagonal band narrower than
the cardinal ones is a stick that will not go diagonally when you ask it, and
a wider one goes diagonally when you did not. There is a test that sweeps all
360 degrees and counts the slices.

The `stepsToSpeak` comment was rewritten rather than left to rot. Its claim —
that a diagonal neighbour is out of reach *because there is no diagonal facing
to turn to* — is still true, but only because the facing stayed four-way while
the walking went to eight, and the next reader would otherwise have concluded
the codebase disagreed with itself.

## 3. The city is not paved — **fixed**

**Reported:** the city should be completely covered with cobbled terrain.

**Found:** confirmed, and it looks worse in place than it sounds. `city.ts`
cobbles the ring road, the streets and the two doorstep cells; everything
*inside* a block is left as whatever the ground already was. In seed 424242
that is bare dirt with patches of grass growing through it, so a walled city
of townhouses reads as a set of houses standing in a muddy field with paths
between them. The wall and the street grid are doing all the work of saying
"city" and the ground is arguing with them.

The fix is a one-line change in intent — pave the whole enclosure rather than
the streets — but it is worth checking two things first:

- **What cobble means elsewhere.** `terrain.ts` documents Cobble as "laid
  stone, not grown ground: the village square", and it is last in the
  autotile priority so its edge always wins. Paving a whole city is a much
  larger use of the same terrain than the doc describes; the doc should say
  what it now means.
- **Where the paving stops.** The wall is the natural boundary. The gate and
  the approach outside it are already cobbled, which is right.

**Fixed: the whole enclosure, in one pass, before anything is put on it.** The
ring road, the streets and the plaza no longer pave anything of their own —
there is nothing left for them to pave — and the patch of dirt that used to go
under each building is gone with them. What the block walk still does is say
where the blocks are.

Two consequences, both intended and both worth having said out loud:

- **Nothing inside the walls is plantable.** Cobble is not in any crop's
  allowed terrain, so the array spell's patch selection will find no live
  cells in there. That is right for a city — one you could farm would be a
  village with more houses in it — and the garden is at home.
- **A sliver of block too small for a building is simply street now**, rather
  than a scrap paved separately. The whole enclosure is one surface, so there
  is nothing for a sliver to be a hole in.

`levelForTerrain` puts Cobble at level 0, the same as dirt and grass, so
paving cannot introduce a step; and the sweep test below would catch it if the
box ever sat on ground that was not already flat.

There is a test that walks every cell inside the wall and insists on cobble —
swept rather than sampled, because the failure being guarded against is
exactly a patch that got missed.

## 4. Three difficulty levels, not four — **fixed**

**Reported:** let's have 3 difficulty levels, not 4.

**Found:** `BANDS` in `difficulty.ts` has four entries, and each one carries
more than a difficulty:

| band | starts at rung | ceiling | one crop fetches |
|---|---|---|---|
| 0 | 0 | 2 | 1,00 |
| 1 | 2 | 5 | 0,50 |
| 2 | 5 | 7 | 1,50 |
| 3 | 7 | hardest | 2,50 |

They are shown in two places — the options panel and the new-player screen —
as a *sample sum* built by the spell itself rather than as a label, so
nothing has to be renamed. `SUGGESTED_BAND` is 1 and `DEFAULT_BAND` is 3 (the
hardest, because that is what the game was before bands existed).

Three things move when a band is removed:

- **The rung boundaries.** The bands overlap on purpose, so that picking the
  neighbour is "off by a nudge, not by a year". Three bands over the same
  ladder means each is wider, and the overlap has to be re-chosen rather than
  inherited.
- **The crop-price ladder.** It runs 1,00 → 0,50 → 1,50 → 2,50: a whole coin,
  then a half, then a sum needing two coins, then the one the game shipped
  with. One of those four teaching steps has to go, and which one is a real
  choice.
- **Saved `band` values.** A save holding band 3 has to mean something. The
  standing permission to lose data covers this, but silently reinterpreting
  a saved 3 as the new hardest is different from losing it.

Since the round above already decided *the band is a starting point, not a
fence*, the ceiling column matters less than it used to — which makes three
bands cheaper than it would have been.

**Fixed: the two middle bands become one.** They were the two hardest to tell
apart — both two-place, differing only in whether the ones came done — and
merging them leaves the outer two untouched. That matters more than it looks:
the gentlest band still opens on `3 + 4`, and a child put in the suggested
band still starts on exactly the sum they used to, because `SUGGESTED_BAND`
is still index 1 and index 1 still starts at rung 2. The new middle band is
deliberately the widest; it is where most children live, and a band is a
starting point rather than a fence, so width costs nothing.

| band | starts at | one crop fetches |
|---|---|---|
| 0 | `5 + 2` | 1,00 |
| 1 | `50 + 27` | 1,50 |
| 2 | `504 + 274` | 2,50 |

**The price that stopped being taught is the half.** The ladder ran
1,00 → 0,50 → 1,50 → 2,50 — a whole coin, then a half, then a coin and a
half, then two and a half — which taught halves early but meant the
second-easiest band paid *least of all*. Dropping the 0,50 makes it climb:
one coin, one and a half, two and a half. Two of the three still carry a half,
so the fifty-piece is not a coin a child never meets, and there is now a test
that the prices rise with the sums.

**Assumption, stated:** a saved `band` of 3 clamps to 2 and a saved 2 becomes
the new 2 — so a child who was on the old third band finds their crop worth
2,50 instead of 1,50. Their *rung* is untouched, because `rungInBand` clamps
to the ladder rather than to the band. This is covered by the standing "ok to
lose data while we are playtesting" permission, and is a price change rather
than a difficulty change.

## 5. The portal spell is unusable at the second difficulty — **fixed**

**Reported:** the portal spell is awful at difficulty two, the map is way too
small and you can't read the coordinates.

**Found:** confirmed, and the second half of the report understates it.
Reproduced with `?learned=all&reached=all&portalRung=2`, asking for the
harbour:

- **There are no marks on the map to read.** The panel says *"one mark = 25
  paces"* and asks *"How far south is it?"*, the answer is 7 — and nothing
  on the map is graduated. The leg is drawn as a plain line from the player
  to the target with no ticks along it. The child is asked to count
  something that is not drawn.
- **This is a cliff, not a slope.** At rung 0 the counting tier draws actual
  white stones along the route and they are countable. Rung 1 takes the
  stones away and puts nothing in their place. The ladder goes from "count
  these five stones" straight to "read a ruler with no ticks on it".
- **The map is 222 px in a 520 px panel.** Less than half the width, with
  about 150 px of blank parchment down each side and the keypad below. The
  panel is not short of room; the map is just small.
- **The axis labels are unreadable and sparse.** Roughly 8 px type outside
  the frame, labelled every third mark at rung 2 and every sixth at rung 5.
- **The place label covers the target.** *"the harbour"* is drawn as a
  tooltip that sits over the destination mark and the bottom-right corner of
  the map, which is exactly where the two legs meet.

The same faults are present at rung 5 (`one mark = 10 paces`, answer 29) —
this is not specific to one rung, it is the whole reading tier and everything
above it. Rung 0 is fine because it draws what it asks about.

**Correction to the report above:** the place label does *not* cover the
destination mark. `drawPlaces` already puts the name on the far side of the
mark from the traveller, and the screenshot shows the mark clear above it.
Left in because a note that quietly deletes what it got wrong is a note you
cannot trust; nothing was changed for it.

**Fixed, in three parts.**

- **The legs are ruled.** `marksOnLegs` splits the marks the bottom rung lays
  stones on into the two legs, and the panel draws a graduation across each
  one — bold on the leg the question is about, faint on the other, and faint
  on both at the crow rung where the hypotenuse is the answer and the legs
  are the working. The count of ticks on a leg *is* that leg's number, which
  is the same arithmetic the stones do a rung below, so the ladder now has a
  step where it had a cliff. There is a test that each leg carries exactly as
  many marks as it is worth: ticks that disagreed with the ruler by one would
  be worse than no ticks at all.
- **The map got the room.** The sheet was capped at 520 x 560 and the map at
  222; it is capped at 660 x 820 now and the map came out at 480. The
  parchment is also capped at *its own width plus 320*, because the map is
  square and is most of the page — without that a phone held upright got a
  full-height sheet with a 200-pixel band of blank paper across the middle.
  Checked at 900x900, 1600x1000, 390x844 and 844x390.
- **The numbers are readable.** Ruler figures are full ink at 11px rather
  than a dimmed 10, and the spacing that decides how many are printed came
  down from 26 pixels to 22 — which on a full-size map at one mark to
  twenty-five paces numbers *every* mark, so the answer 7 is now written on
  the paper as well as countable along the leg. `drawRulers` also thins the
  numbers out rather than running off the end of its pool of text objects,
  which used to fail silently and looked exactly like a ruler meant to be
  sparse.

---

## Where this stands

**All five are done**, and every one of them is verified in a browser as well
as by tests — the portal at five rungs and four viewport shapes, the tree by
walking to it in the wood and reading what it says, the city by standing in
it, the bands by opening the new-player screen, and the diagonals by holding
two arrows and then by dragging a joystick on a phone-shaped viewport with a
phone's user agent (the first attempt at that measured nothing: Playwright's
`isMobile` does not change `device.os.desktop`, so the joystick was never
built and the probe was quietly testing click-to-walk).

Two things changed that nobody reported, both found while fixing something
that was:

- **`drawRulers` could run off the end of its pool of text objects**, which
  left the rest of a ruler blank — silent, and indistinguishable from a ruler
  meant to be sparse. It thins the numbers out instead now.
- **The prices dipped in the middle.** Nobody complained, but a rule nobody
  could learn and everybody would eventually notice is worth removing while
  the bands are open anyway.

---

# Playtest — 2026-08-21

Six things, from the first session with the wordless interface and the
animals in it. Two of them are faults introduced by that work; one is a
rendering bug that had been waiting for somebody to turn a phone sideways.

Ordered as reported. What was *found* on looking is kept apart from what was
*reported*, because three of the six turned out not to be what they looked
like from the outside.

---

## 1. Rotating the device breaks the game — **fixed**

**Reported:** rotating the device breaks the game, the screen rotates and
goes black.

**Found:** reproduced on the first try at 390x844 turned to 844x390. The
canvas resizes and the world keeps drawing into the old rectangle; the rest
is black. Turning back is worse, because the black band is then the *top* of
the screen rather than the side.

Two separate things were wrong, and the first hid the second.

- **The world camera was never resized.** `layoutForViewport` resized the
  interface camera and the night overlay and nothing else. Phaser resizes
  only those cameras whose size still matches the game's *previous* size, and
  a manual `game.scale.resize` does not reliably leave one looking like that.
- **The renderer was never resized either**, which is the black. In RESIZE
  mode `scale.resize` sets the canvas and then calls `refresh`, and `refresh`
  overwrites the size it was just handed with the parent element's *last
  measured* bounds — which, on the turn of a phone, are the bounds from
  before it turned. The renderer compares what it is given against its own
  size, sees no change, and keeps a portrait viewport on a landscape screen.

The renderer is now resized to the *canvas's* own size rather than to the
window's, because its scissor is computed against `gl.drawingBufferHeight`
and a height the canvas has not taken yet puts the scissor off the bottom of
the buffer. That is the same black band, one turn later, and it is what the
first attempt at this fix produced.

The whole thing runs twice — once on the event and once on the next frame —
because the first pass runs before the browser has reflowed. Doing it twice
is cheap and does not depend on guessing when a reflow lands.

Rooms are re-framed on rotation too: a room's camera bounds are computed from
the camera's own size, so a room framed for a portrait screen is framed wrong
the moment it is not one.

## 2. Spell targeting is hard — **open**

**Reported:** instead of the field in front of you, let the player pick the
tile the spell should affect, in a two-to-three tile circle around the
player. For multiplication, maybe use that for the starting field.

Every gardening action currently works on `facingTile()` — the one square she
is pointing at — and that is one rule shared by planting, growing, clearing
and picking. It reads well in the code and badly in a hand: lining a
character up with a square is a thing an adult does without noticing and a
six-year-old cannot do at all.

The array spell already has the machinery this wants — tap a corner, tap the
other, a painted rectangle — so the shape of the answer is in the game
already. What has to be decided is what happens to *facing*: it is currently
the whole of how the game knows which square an action is about, and there is
art for four of them.

## 3. The city has no people — **open**

**Reported:** the city has no people!

True. `spawnNpcs` is handed `world.village.npcs` and nothing else; the
harbour, the city and the observatory have exactly one attendant between
them, and she is indoors. Twenty-four buildings and nobody on the street is
not a city, it is a model of one.

## 4. The harbour and the city should have shops — **open**

**Reported:** the harbour and city should have shops.

There is one shop in the world and it is in the village. The city already
builds `store` buildings — a fifth of its blocks — but they are scenery with
a door: walking in gets a room and nobody in it.

## 5. Buildings behind the clock tower are blocked — **fixed**

**Reported:** buildings behind the clocktower in the city are blocked.

**Found: nothing was blocked.** Every door in the city is reachable from the
player's start, and every walkable cell inside the walls can be walked to —
checked by flood fill across four seeds before changing anything.

What is true is that the tower's *art* is five tiles taller than the two
cells it stands on, so the block immediately behind it was drawn over
completely. A building nobody can see is a building that is not there, which
from the outside is the same complaint.

The city now leaves that block empty, which is a better answer than a
townhouse hidden behind a clock: a square in front of a town clock is what a
town with a clock looks like. `LANDMARK_OVERHANG` says how far each landmark
rises above what it stands on, written next to the footprint it already
duplicates, and checked against the shipped sidecars by the same test.

## 6. A cancelled spell animates like a cast one — **fixed**

**Reported:** cancelling the spell still shows the icon of the spell over the
player, which looks identical to a spell cast. If the player cancels, just
don't animate anything.

**Found:** self-inflicted, three commits ago. When the status line went, *the
spell fades unspoken* became the spell's own rune dimming out where the cast
was aimed. The reasoning was that a cross would wrongly say the game had
refused something. The reasoning was fine and the picture was not: a rune
over the player, moving, is what *earning* one looks like and close enough to
what casting one looks like that the two cannot be told apart.

Nothing is drawn now. Closing a parchment is not an event and does not need
announcing — the parchment closing is the whole of it.

---

## Where this stands

**Fixed:** 1, 5 and 6. **Open:** 2, 3 and 4.

Three of the six were not what they looked like from the outside — the
rotation was two bugs, the blocked buildings were not blocked, and the
cancelled spell was a picture this session had added. That is the argument
for reproducing before fixing, and it earned its keep three times in one
round.
