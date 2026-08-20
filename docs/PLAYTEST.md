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
