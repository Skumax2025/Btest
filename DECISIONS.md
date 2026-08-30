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
