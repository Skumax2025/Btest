# DECISIONS

One line per fork in the road: what was chosen, what was dropped, why. Written as
I went, so the order is roughly chronological.

## Architecture

- **L3 content sits *above* L2 game, not below.** The layer list in the brief is
  ordered, and "a layer imports only layers below it" then means game modules may
  not import content. So every module takes its data as configuration and L3
  supplies it, with `src/content/run-config.ts` as the single assembly point.
  Dropped: letting game modules `import { ITEMS }` directly, which would have
  been shorter but would have put content ids inside the engine.
- **L3 imports L2 *types*.** `ITEMS` is typed `ItemCatalog` from `@game/items`.
  That is a downward import and keeps content type-checked against the modules
  that consume it. Dropped: duplicating the shapes in L3.
- **Layer rules are enforced twice.** ESLint `no-restricted-imports` per
  directory catches it while editing; `tests/layers.test.ts` parses the real
  import graph and also fails on cycles, which the linter does not do without an
  extra plugin. Dropped: `eslint-plugin-import`, to keep the dependency list at
  the four tools the brief allows.
- **Path aliases (`@core`, `@systems`, `@game`, `@content`, `@ui`, `@view`).**
  Makes the layer rules expressible as glob patterns and makes an upward import
  visible on sight. Dropped: relative paths only.
- **Rendering lives in L4 (`src/view`), not L2.** Game modules never draw, which
  is what makes the whole simulation runnable in Node for the determinism test.
- **Modules that player actions touch are written against `RunWorld`, not
  `Run`.** `actions.ts`, `effects.ts` and `creatures.ts` take an interface that
  `Run` happens to satisfy. That keeps the module graph acyclic and lets the
  action code be exercised with a stub. Dropped: passing `Run` around, which
  would have made `run.ts -> actions.ts -> run.ts` a cycle.
- **Creatures and thrown items are components in the L0 entity store**, not
  arrays on `Run`. The store then earns its place in L0 and the save file is
  literally `world.serialize()`.

## Determinism

- **Two kinds of randomness.** A stateful `RandomStream` for gameplay (its state
  is in the save) and a stateless `streamFor(...coords)` for world generation.
  A chunk is a pure function of `(seed, level, cx, cy)`, so the world is
  identical whatever route the player took to reach it — there is a test for
  exactly that.
- **Chunk generation is budgeted by count, never by time.** The brief asks for
  generation not to block a frame; a time budget would make two identical runs
  diverge. Two chunks per tick, with the whole load radius primed synchronously
  at run start.
- **`performance.now()` appears in exactly one place** (`GameLoop`, injected).
  Simulation code sees only a tick index and a constant step. Lamp flicker,
  phantom silhouettes and every other "random-looking" effect are derived from
  the tick.
- **Creatures share the run's RNG stream instead of forking one each.** Forking
  per creature per tick allocated 200 objects a tick for no behavioural gain;
  the shared stream is just as deterministic.

## World generation

- **Connectivity is proved, not tested-and-hoped.** Every `spinePeriod`-th block
  row and column is an open corridor; those spines all cross. Every block off the
  lattice gets exactly one forced doorway, west or north, and following those
  links strictly decreases x or y, so the chain reaches a spine within a bounded
  number of steps. Extra doorways only add loops and so can never disconnect
  anything. Dropped: a spanning tree over the infinite lattice, which cannot be
  decided chunk-locally.
- **Spine period 3 rather than 2.** Period 2 produced a visibly regular grid.
  Period 3 leaves 2x2 pockets hanging off the lattice as trees, which is where
  the dead ends come from. Level 1 uses 4 and feels more like a maze.
- **Doorway access lanes plus a seal pass.** After stamping a template the
  generator carves the middle band on any axis that has a doorway, then floods
  from those lanes and turns unreachable floor into wall. That makes "no
  unreachable zones" structural rather than a property of careful template
  authoring.
- **Landmarks and exits are guaranteed by a modular lattice**, not by
  probability: one landmark chunk per `landmarkStride` squared and one exit per
  `exitStride` squared, offset by a hash of the seed. A probabilistic rule can
  leave a player with no anchors for a long time, which is boring rather than
  frightening.
- **Chunks are thrown away; what the player did to them is not.** `ChunkDelta`
  holds opened containers, taken spawns and dropped items per chunk and is the
  only part of the world in the save file.
- **A creature that wanders out of its home chunk vanishes with it and respawns
  at its spawn point on return.** Simpler than migrating creatures between
  chunks, and invisible at the load radius used. It does mean you cannot lead a
  hunter two chunks away and lose it permanently.

## Feel

- **Light is clipped twice.** Each lamp is clipped to its own visibility polygon
  so it does not shine through walls, and the whole lamp pass is clipped to the
  player's line of sight so a lit room behind a wall is not visible from the
  other side. Without the second clip the game had x-ray vision; with it, a lit
  corridor seen through a doorway is the only navigation aid there is.
- **Light stops on the midplane of a wall, measured against the face it crossed.**
  Stopping at the face leaves the wall black, which reads as a hole in the floor;
  going past it puts light in the next room. Measuring the depth along the ray
  instead of against the face was worse than either: a ray clipping a corner
  travels almost nothing inside the tile and one going straight through travels a
  full one, which put a sawtooth on every wall in the game.
- **The flashlight is a string of soft pools down the aim line, not a wedge.** A
  wedge is a polygon and a polygon has a hard edge wherever it is not a wall.
  Stacking narrowing wedges to fake a soft edge only trades that edge for a fan
  of seams where their clips overlap — each clip is antialiased, and fourteen of
  them are fourteen visible streaks. Pools have no edge to begin with. One
  visibility cone, cast once, still does the blocking.
- **Shadow edges are pinned to the corner that casts them, not to the nearest
  ray.** An even fan can only put an edge on a ray, so walking past a corner
  moved the drawn edge a whole ray-step at a time while the true one slid
  smoothly — shadows crawled and shimmered along every wall end. Neighbouring
  rays that disagree by more than a tile have a corner between them, and a few
  bisections find its angle; the polygon then pivots about the corner itself.
  Real levels turn out to have about a dozen silhouettes in view at once, so it
  costs almost nothing and is far cheaper than the ray count that would be
  needed to hide the problem.
- **The player casts one ray fan per frame, not three.** Line of sight, the much
  smaller bubble of vision inside it and the torch's floor spill are all read off
  a single cast at different radii. They cannot disagree about where a wall is,
  and the rays that used to be split between them buy a far smoother edge.
- **Lamp shadows are cached against the level's geometry, not just its lamps.**
  An unloaded chunk reads as solid, so a lamp traced beside one keeps the shadow
  of a wall that was never there once the chunk arrives. The cache is keyed on
  the level index and a revision the stream bumps whenever a chunk appears or
  disappears.
- **An unstable lamp browns out rather than strobing.** It used to switch between
  full and black in a single tick, eight times a second. It now interpolates
  between the same flicker decisions, so the sequence and its statistics are
  unchanged and still a pure function of seed and tick — it is only the shape
  between two decisions that is different.
- **Facing follows the mouse, movement is eight-way on WASD.** The flashlight
  cone needs to be aimable independently of where you are walking.
- **The hunter is faster than a sprint, but only for seven seconds.** Racing it
  must never be the answer; breaking line of sight and outlasting it is.
- **The sentinel kills on contact and is drawn *after* the darkness pass.** A
  thing that kills instantly has to be recognisable before you touch it, and the
  player cannot be relied on to have light. It reads as sensed rather than seen.
- **Searching a container spills its contents on the floor.** No container UI to
  build, the loot is physical, and picking it up is a second, separate noise.
- **Silence costs nerve.** It pushes the player to make noise, which is exactly
  what attracts creatures. Cheapest way to make the sound system matter to a
  player who is standing still.
- **Audio is synthesised, no asset files.** The brief bans external sound files
  but asks for a hum and for audio distortion at low nerve, so `src/core/audio.ts`
  builds everything from oscillators and a noise buffer. It only ever observes
  the run, so it cannot affect the outcome.
- **No minimap, no coordinates, no compass**, per the brief. The debug overlay
  shows the seed and tick but is off by default and clearly a developer tool.

## Scope

- **English UI.** Every string is in `src/content/texts.ts`, one file to
  translate. Dropped: shipping two languages.
- **No item rotation in the bag.** Multi-cell footprints, stacking, weight and
  drag are in; rotating a pipe to fit is not. It adds a second placement rule to
  every call site for very little.
- **Descent is one-way.** Going back up would need a delta store per level and a
  reason to want to. The level above is gone when you take the noclip point.
- **Thrown items are real projectiles**, not an instant relocation, because the
  arc is the feedback that tells you where the noise will happen.
- **Placeholder sprites are procedural shape stacks** described in L3 and built
  into offscreen canvases at first use. Swapping in an atlas means writing one
  more `SpriteProvider` and changing one line in `app.ts`.

---

# Second pass

## Localization (G0)

- **Flat dotted keys, Russian as the source of truth.** `ru.ts` is a plain
  object; `en.ts` is typed `Record<TextKey, LocaleString>` against it, so a
  missing English key is a compile error rather than a blank on screen. The test
  covers the other direction (no extra English keys) and parameter parity.
- **Static labels go through a `TextBinder`; live text is re-read every frame.**
  Switching language calls `refresh()`, which rewrites every registered element
  in place. Dropped: rebuilding the DOM on a language change, which would have
  lost drag state and scroll position.
- **No key name ever appears inside a locale string.** Hints take `{key}` and the
  UI fills it from the live bindings, so rebinding a key rewrites every hint that
  mentions it. There is a test that fails if a hint hard-codes one.
- **Display names of items, containers and creatures became keys** (`nameKey`),
  so even the L3 data tables hold no prose. Prose lives only in locale files.
- **Plural rules live in L0**, the locale picks one. Russian needs one/few/many
  with the 11-14 exception, which is exactly the case a naive implementation
  gets wrong, so it has its own test.
- **The font stack is system monospace with Cyrillic fallbacks** (`DejaVu Sans
  Mono`, `Liberation Mono`) — no web font, because the project ships no external
  asset files. Fixed-width interface elements were widened by roughly a third to
  absorb the longer Russian strings.

## Combat (G1)

- **Bare hands are an item.** `item.hands` sits in the catalogue with the weakest
  stat block, and `resolveWeapon` falls back to it for a broken weapon and for
  anything that was never a weapon. There is no "no weapon" branch in the code.
- **An empty hand slot is the way out, not a weak weapon.** Auto-attack refuses
  to start with nothing held and refuses while crouching. Those are the two
  promises that let a player walk past a fight, and both are tested.
- **A swing has a wind-up.** Without it "miss" could not exist — targets are
  counted again when the swing lands, so stepping out of the ring during the
  wind-up costs the attacker stamina and noise and hits nothing. It also gives
  the reach ring something to mean.
- **The price of a wide swing is stamina and noise, never damage.** Damage
  ignores how many bodies are in the ring, because a ring does. What scales is
  `staminaPerExtraTarget` and `noisePerExtraTarget`: five bodies cost more breath
  than the bar holds and shout far enough to bring more.
- **A block swallows one hit whole, once per tick.** Partial mitigation would
  have made blocking a damage multiplier; all-or-nothing makes it an event the
  player can see and hear. Everything else landing on the same tick goes through,
  which is the whole reason being surrounded kills.
- **Creatures carry `blockChance` even though almost all of them are zero.** It
  is a column in the data, so a parrying creature is a table edit rather than a
  branch. The hound has a small non-zero value; it is the one thing the design
  wants you never to trade with.
- **The hound got much tougher (45 → 190 health, 22 → 32 damage).** Area attacks
  made a one-on-one trade winnable, which the design forbids. Raising its health
  past what a good weapon can chew through in the time it needs to kill you
  restores "run, do not fight" without touching the player's numbers.
- **Feedback is split: shapes in the world, words in the HUD.** The reach ring,
  the closing swing timer and the expanding event ring carry no text, so the view
  layer stays free of strings; the sentence naming what happened lives in the HUD
  where the localizer already is.

## States, menu and settings (G2)

- **Five states, one of which ticks.** `PLAYING` is the only state that calls
  `run.step`, so a pause or an open guidebook freezes stats, timers, creatures
  and the ambient hum together — there is no list of things to remember to stop.
  Verified in a real browser by watching the tick counter stand still.
- **The world keeps rendering behind every screen.** A menu over a real corridor
  costs nothing (the frame is drawn anyway) and is the cheapest atmosphere in the
  project.
- **Menus are navigated with the player's own movement keys.** The screens read
  the same `InputFrame` actions the game does, so rebinding "forward" rebinds
  menu navigation too and there is no second input path to keep in sync.
- **Settings are one instance, opened from two places.** The pause menu and the
  main menu call `open()` on the same object.
- **Settings live under their own storage key and their own version.** Erasing a
  run, or a save-format bump, never costs the player their language, keys or
  volume — which is why the run's version bump in G1 was safe.
- **A rebind displaces rather than refuses.** Taking a key that another action
  holds removes it there and says which action lost it. Refusing would have made
  the screen a puzzle.
- **Interface scale is a CSS transform per anchored panel**, not a zoom on the
  whole overlay: each panel scales about the corner it is pinned to, so nothing
  drifts off screen at 160%. Brightness is a CSS filter on the canvas, which
  leaves the palette and the lighting mechanic untouched.

## Interface (G3)

- **Two tiers of bar, not five equals.** Body and breath are large; hunger,
  thirst and nerve are small and dim. Breath moved to second place because melee
  now spends it continuously and a player must not have to look for it.
- **Numbers came off the bars.** A bar already says what a number would, and the
  brief forbids numbers where an indicator is enough. What survives as text is
  what a bar cannot say: the item in hand, its charge, the load.
- **Critical bars pulse.** A brightness animation is caught by peripheral vision
  in a way a colour change alone is not.
- **The interface goes quiet on its own** after a couple of seconds of nothing
  happening, and comes back on any stat jump, any combat event, any body inside
  weapon reach, or any prompt. Standing conditions like "it is too dark" are
  excluded from that, or the interface would never fade in a dark building.
- **Key prompts moved into the world**, drawn above the crate or the item they
  are about. The centre line now carries only what has nowhere better to be.
  The text is localized before it reaches the view, so the view still holds no
  strings of its own.
- **Wear is a bar under the hand slot**, not a percentage — it is a state, not a
  measurement, and it turns red before it fails.
- **Dragging shows a ghost** of the footprint, green where the stack may land and
  red where it may not, and every item block is drawn with its cell grid so the
  footprint can be counted at a glance.

## Guidebook (G4)

- **Every number in it is a parameter read from L3.** `content/guide.ts` computes
  them from the same tuning tables the simulation uses, so re-balancing rewrites
  the guidebook. A test renders every paragraph and fails if any placeholder is
  left unfilled or any section forgets to supply a value it asks for.
- **Distances are given in metres with one decimal.** A tile is about a metre;
  the fixed decimal is not cosmetic — in Russian a decimal always takes the same
  case, so "0.9 метра" and "6.6 метра" are both correct without needing a plural
  rule in the middle of a sentence.
- **Creatures are described by behaviour, never by numbers.** The section says
  what each one does and what answers it, so the player learns to recognise them
  instead of reading a table.
- **Section 8 is generated from the live bindings**, never written, so it cannot
  disagree with the settings screen.
- **Only implemented mechanics are described.** Every claim in the text
  corresponds to code in this repository; a test checks the keys and the numbers,
  and the writing was done by reading the modules rather than the design brief.

## Polish (G5)

- **The reach ring is only drawn when a swing could actually happen** — something
  in hand, not crouching. Drawing it with empty hands would have promised an
  attack that never comes.
- **The combat feedback window moved to L3.** It was the same number written in
  two files (the simulation and the view); now both read it from the tuning
  table, which is also what the rule about numbers living in L3 is for.
- **Guide distances are metres, not tiles.** "0.9 шага" was nonsense next to
  "шаг слышно за 4 шага"; a tile is about a metre and the word stops colliding
  with the action.
- **Verified by driving the real game, not only by tests**: the world frozen in
  pause and in the guidebook (tick counter standing still), a language switch
  mid-run rewriting the HUD, the guidebook and the generated controls table, a
  rebind from E to K propagating to every hint, volume and brightness applying
  live, a run wipe leaving language, keys and volume intact, an automatic fight
  against three at once, and a sweep of every screen for untranslated keys.

## Slots, cells and wear (G6)

- **Weight is gone; cells replaced it.** A weight budget and a footprint grid
  were two limits doing one job, and neither produced an interesting decision —
  the answer was always "drop the pipe". Four cells with nothing on your back is
  one limit, and it is about variety rather than mass.
- **One stack is one cell, whatever the count.** It makes a full stack of
  crackers strictly better than a partial one, which is the point: it rewards
  consolidating, and it makes the number on the icon worth reading.
- **Quick slots do not cost bag cells.** The belt is a separate place, not a
  reserved corner of the bag. Charging cells for it would have made the number
  keys a trap rather than a convenience.
- **One condition field, nine meanings, all of them data.** `DurabilityDef` says
  what wears an item down (time, footsteps, damage, uses) and what zero does
  (`break`, `destroy`, `keep`). Nothing in L2 branches on item category; the
  categories live entirely in the catalogue.
- **`wornPassive` interpolates against `passive`.** Rather than thresholds, every
  worn effect is two blocks and a lerp by condition, so "boots get louder as they
  go" is two numbers instead of a rule.
- **Weapon condition still belongs to `WeaponStats`.** The combat module owns
  `maxDurability` and `wearPerHit` and is tested without an inventory; the
  catalogue derives the item's `DurabilityDef` from the same block so the two can
  never disagree.
- **Merged stacks take the worse condition.** Dropping a fresh tin onto an old
  one averaging them upward would have been a free repair; taking the minimum is
  the honest reading and keeps stacking usable.
- **Taking a pack off into the bag it was holding open fails.** It is not a
  special case — capacity is recomputed and the item simply does not fit. The
  player drops it instead, which is the true answer.
- **Overflow drops newest first.** The thing picked up last is the thing least
  planned for. The preview runs the same code on a clone of the state, so the
  warning and the outcome cannot drift apart.
- **Armour caps are ceilings, not curves.** A full set removes at most 55% of a
  blow and at least 20% always lands. Armour has to make a mauling survivable
  without making the creatures ignorable.
- **Blocks come from whichever hand is better at it.** That is what makes an off
  hand a decision rather than a spare weapon rack, and it is why the cafeteria
  tray exists at all.
- **The bag does not pause the world.** Sorting is a risk, which is the only
  reason sorting is interesting.
- **Splitting always halves.** A number picker is three more widgets for a
  decision nobody agonises over.
- **Consumables and throwables can be held.** Not because it is needed — food is
  eaten from the bag — but because throwing means throwing what is in your hand,
  and a can that cannot be held could not be thrown.
- **Creatures drop loot from their own table.** A drifter was a person and has
  their pockets; a hound never was. It is the same `rollLoot` the containers use.
- **The light cone comes from the item.** A head torch is wider and shorter than
  a hand torch and a glow stick lights all around; the view overrides the three
  lighting numbers from the burning item rather than owning a lamp type.

## The test level and the hotbar (G7)

- **The test level is a run, not a viewer.** It uses `level.drop` and the ordinary
  creature spawn, so picking something up off its floor exercises exactly the code
  a real run does. A display case that showed items some other way would prove
  nothing about the game.
- **It is one flag on `RunConfig`, not a mode.** `sandbox` is either a block of
  numbers or `null`; no system below asks whether it is running in a test. The
  level itself is Level 0's spec with the lamps, containers and exits turned up.
- **It is never persisted.** Walking into the workshop must not cost the player
  the run they had going, so `persist()` returns early and the saved run is left
  untouched. That also means the test level cannot be resumed, which is right: it
  is meant to be entered fresh.
- **It starts you dressed.** Four cells cannot hold a catalogue, so the kit is
  part of the level's data — and ordering it so the pipe takes the hand and the
  torch the off hand means both hands are demonstrated from the first frame.
- **The hotbar shows wear and which slot is in hand.** The belt was the one part
  of the inventory that mattered without the bag open and had no representation
  at all; a name and a count would have been half the information, because what
  makes a belt slot worth pressing is whether the thing on it still works.
- **The HUD gained armour and footstep-noise readouts rather than more bars.**
  Both are what worn equipment actually does, both move as it wears down, and
  neither was visible anywhere outside the bag. A worn-slot pip row would have
  said what was worn without saying what wearing it was worth.
- **One failing-gear warning at a time.** A list of everything below half
  condition is a list nobody reads; the worst piece, named, is a decision.
- **The key legend is generated from the bindings, not written.** Same rule the
  guidebook's control table already follows, and `applySettings` now refreshes
  the binder so a rebind rewrites the legend, the bag's help line and every hint
  at once — that was stale before.

## Interface pass (G8)

- **Two hands, two keys.** One "use" key could only ever address one hand, which
  made the off hand a slot you loaded and then forgot. `E` and `F` make it a
  thing you operate; `interact` moved to `Space` to make room, since searching is
  the one action that already knows what it is aimed at.
- **The belt only takes what the catalogue says it takes.** `belt: true` is data,
  not a tag test, so "can this hang on my belt" is answered where the item is
  described. It also removes a branch: a belt key now only ever uses a thing,
  because nothing needing a hand can be on the belt in the first place.
- **A belt slot is a button.** It was the one part of the display that named a
  key without being reachable by the mouse.
- **Pockets, rather than a warning about loss.** A smaller pack costing you the
  room is a decision; costing you the things was just a punishment for finding a
  pack. What no longer fits goes into the pockets of the one coming off, and only
  a genuinely full set of pockets puts anything on the floor — which is also the
  only case the confirmation now interrupts for.
- **Wearing through a pack empties it at your feet.** Pockets are capacity, and
  capacity that shrinks has to put its contents somewhere visible. Silently
  deleting them, or silently keeping them in a pack that no longer has room,
  would both be lies.
- **The top bar became a corner panel.** A full-width strip of four bars was the
  largest thing on screen and the least urgent; the same four bars in a top-left
  block read faster and give the middle of the screen back to the game.
- **Breath is a hairline and a vignette, not a panel with a number.** Running out
  of air is a state to feel: the line only appears once breath is being spent,
  and the edges of the screen close in as it goes. No stat carries a number now —
  a bar already says everything a number would.
- **The legend hides, and remembers.** It is written from the live bindings and
  it is the one part of the interface a player is meant to outgrow, so `F1` or a
  click on its title folds it away and the choice is kept with the settings.
- **One panel treatment for everything.** `.hud-panel` and one set of tokens —
  ink, surface, line, state — now cover the corners, the bag and the screens, so
  the interface reads as one object instead of five separately-invented ones.

## Two corrections (G9)

- **The bag's context menu was dead, and the fix is one guard.** The panel closed
  the menu on any `pointerdown` inside itself, which took the button out from
  under the click that was about to land on it — so every entry in the list did
  nothing. A press that starts inside the menu is now left alone. Worth writing
  down because the menu *looked* correct in every screenshot: only clicking an
  entry and checking the world afterwards catches it.
- **The vitals took the middle of the screen after all.** They were moved to a
  corner to give the centre back to the game, but they are the one readout looked
  at mid-stride without being searched for, and a corner made them something to
  find. They are centred again and half as large again, with the level line left
  alone in the corner they vacated.

## The bug sweep (G10)

Found by hammering invariants and by reading, not by playing — which is the point
of `tests/invariants.test.ts` and `tests/content.test.ts` now being in the suite.

- **Swapping hands ignored what fits where.** `swapHands` traded the two slot ids
  without asking the catalogue, so a pipe — main hand only, by design — ended up
  in the off hand, where it then offered to block. It now refuses a swap that
  would put something where it does not belong.
- **Capacity could shrink without the bag being trimmed.** Wearing a pack through,
  or dropping the one off your back, took cells away while the contents stayed.
  `settle` now runs every tick: overflow goes to pockets first and to the floor
  second, which is the same rule swapping packs already followed.
- **Every lamp burned at once.** `stepLight` walked the whole bag, so a spare
  torch and three glow sticks drained together. One lamp is active — worn or held
  first, then the bag — and it is the one that burns, the one a battery fills and
  the one the display reports.
- **Armour softened a creature that kills by touching you.** `killsOnContact`
  went through the armour formula and came out survivable. It bypasses armour
  now; that flag is the whole of what those creatures are.
- **Putting something down repaired it.** Dropped and thrown items carried only
  an id and a count, so a pipe one swing from breaking came back off the floor as
  good as new. Condition and charge travel with a stack onto the ground and back.
- **Two UI paths could push the bag past its cells.** Dragging a worn piece or a
  belt item into the bag called the unguarded move rather than the guarded one;
  with `settle` running, the excess would have quietly hit the floor. Both now go
  through the same refusal the context menu already used.
- **Tape was spent on gear that needed nothing**, and the crowbar promised a
  quieter search while only making it faster. Both now do what they say.
- **Three belt items did nothing when their key was pressed.** A lure has no
  `use`, so the belt did nothing with it; the belt now throws what it cannot eat
  or switch on, which is what a lure on a belt is for.
- **The belt overlapped the key legend at 1024 wide.** The adaptive breakpoint sat
  at 860 and the collision starts at about 1200.
- **The visibility fan invented corners in open floor.** Refinement compared the
  tile each ray ended in without asking whether the ray had hit anything, so two
  rays that simply ran out at the radius looked like two different surfaces. In a
  room the budget of ninety-six refinements was spent within the first ninety-six
  rays — real corners went unrefined — and the corner stitch could join two
  unrelated end tiles into a spike of false geometry that flickered as the player
  moved. Every topology test now requires the ray to have been blocked.
- **Every light subtracted its own darkness.** Two lights over the same floor
  removed more than either had asked for, which is why the middle of the torch
  beam went white and why rings appeared where the pools it was made of met. All
  light now lands on one mask and the mask comes off the darkness once, so what
  a place is worth in light is decided before anything is drawn.
- **Shadows had the exact edge of the ray that found them.** The mask is blurred
  by a couple of pixels on its way off the darkness, which is both what a real
  penumbra looks like and what stops a shadow edge crawling ray by ray as the
  player walks. Bloom is blurred far harder over its own crisp core.
- **The beam was a chain of twelve pools.** It is one shape now, built into a
  mask once — falloff along it and a soft edge across it in the same texture —
  and opened out into a bulb at the player's hand so the torch reads as held.
- **A browning-out lamp blinked out.** `collectLights` dropped a lamp the moment
  it fell under the lit threshold, taking a sixth of full brightness out of the
  room in one tick. It fades to nothing below the threshold instead.
- **Walls were paint on the floor.** They are drawn standing now: the top is
  pushed away from the middle of the screen by its height over the camera's, and
  the strip that opens between the footprint's near edge and the same edge of the
  top is the side of the wall the camera has come round to see. Corners are
  projected one at a time so a block of wall has no seams down it, and the
  footprint never moves, so what is drawn still says where the player may walk.
  A gradient at the base of every wall is the contact shadow, which is the one
  depth cue that survives the wall being unlit.
- **The floor was ruled into squares.** Two rects sharing an edge each covered
  part of the device pixel under it and neither covered all of it, so the
  background showed through as a grid. Every tile is drawn half a unit past its
  own edge.
- **Props sat on the floor whatever they were.** A tube bolted to the ceiling and
  a crate standing on it now slide past the camera at their own rates, on the
  same projection the walls use, and everything on the floor drops a shadow at
  the spot it actually occupies. The pool a lamp casts stays under the lamp, not
  under the picture of it.
- **The darkness pass cost more than the rest of the frame.** Light is gathered
  at a quarter of the screen's resolution and the bloom at a sixteenth: every
  pixel of it is about to be blurred and then used only to say how much darkness
  to take away, so a full-resolution pass buys nothing and costs the largest
  fills in the frame four times over. Blurring at that size makes the penumbra
  and the halo close to free; a scene full of lamps is now faster than it was
  before any of this.
- **Lamps blinked into being as you walked towards them.** Perception collected
  lamps within two lamp radii of the player and the view draws exactly that list,
  so on a wide screen a lamp far enough out to be culled still had half its pool
  inside the frame. Four radii now, and props are gathered four tiles past the
  edge of the view rather than two, because a lamp hung off the top of the screen
  leans back into it.
