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
