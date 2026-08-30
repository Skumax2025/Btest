# No Exit — a Backrooms survival demo

A single-run, top-down survival demo set in an endless yellow building. Find
supplies, watch your body, avoid what lives here, find the way down, and
eventually stop. Death is permanent; the next run is a new seed.

TypeScript, Canvas 2D, no game libraries. Vite, Vitest and ESLint are the only
dependencies.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type check + production build into dist/
npm run check      # typecheck + lint + tests
```

`npm run check` is what CI would run: `tsc --noEmit`, `eslint .`, `vitest run`.

## Controls

| Key | Action |
| --- | --- |
| `W A S D` / arrows | Move (eight directions) |
| Mouse | Look — your eyes and your flashlight point at the cursor |
| `Shift` | Sprint. Fast, loud, costs breath |
| `Ctrl` / `C` | Crouch. Slow and silent |
| `E` | Search a container, pick something up, take the way down |
| `F` | Use what is in your hand |
| `R` | Switch the flashlight on or off |
| `Q` | Throw what is in your hand |
| `G` | Drop what is in your hand |
| `Space` | Swing |
| `Tab` | Bag. Drag to move a stack, right click to put one in hand |
| `F3` / `` ` `` | Debug overlay |
| `Enter` | After death: go back in with a new seed |

Rebinding is supported at runtime through `InputDevice.rebind(action, codes)`;
the default table is `KEY_BINDINGS` in `src/content/tuning.ts`.

## How it plays

Thirst is the tightest clock, hunger the second. Nerve drains in the dark, in
total silence, and near anything living — and silence is the trap, because the
cheapest way to keep your nerve is to make noise, and noise is what everything
here listens for. Sprinting is the loudest thing you can do; crouching is free.

Fighting is the worst option available and is meant to stay that way. The hunter
is faster than your sprint but has to stop and breathe; break line of sight and
outlast it. The stationary threat kills on contact and is drawn even in the dark,
so you can see it before it matters — walk around it.

Landmarks are the only navigation there is: no map, no compass, no coordinates.
The generator guarantees one memorable room every few chunks and one way down
every few chunks after that.

## Structure

Five layers. A layer may import only layers strictly below it. This is enforced
by ESLint (`no-restricted-imports` per directory in `eslint.config.js`) and by
`tests/layers.test.ts`, which parses the real import graph and also fails on
cycles.

```
src/
  core/      L0  loop, entity/component store, event bus, seeded RNG, input,
                 renderer interface, camera, spatial index, assets, audio,
                 serialization                       — no game words at all
  systems/   L1  collision, ray marching, visibility, pathfinding, sound
  game/      L2  level generation and streaming, player, stats, inventory,
                 items, loot, lighting, creature AI, the run itself
  content/   L3  data only: rooms, levels, items, loot tables, creatures,
                 palettes, sprites, audio cues, texts, every tuning number
  ui/, view/ L4  DOM overlay, canvas rendering, the entry point
```

Two things follow from the ordering, and both are deliberate (see DECISIONS.md):

- **L2 never imports L3.** Game modules take their data as configuration.
  `src/content/run-config.ts` is where every table and every number is bolted
  onto the modules that use them; both `App` and the headless tests build a run
  from it, so they are provably playing the same game.
- **L3 imports L2 types.** `ITEMS` is typed as `ItemCatalog`, so content is
  type-checked against the modules that consume it.

Each L2 module opens with a comment saying what it knows and what it does not.

### Determinism

The same seed and the same sequence of input frames produce the same world, tick
for tick. `tests/determinism.test.ts` runs two simulations for 1000 ticks and
compares a fingerprint of the whole state, checks that a detour does not change
the world, and checks that a save resumes identically.

Rules that keep it that way: one clock (the fixed step), `performance.now()` in
exactly one injected place, chunk generation budgeted by count rather than time,
and world generation derived from stateless coordinate hashes.

## Extending it

### Add an item

1. Add an entry to `ITEMS` in `src/content/items.ts` — footprint in cells, stack
   size, weight, tags, what using one does, melee damage, how loud it is when it
   lands.
2. Add a sprite spec under the same `sprite` id in `src/content/sprites.ts`.
3. Put it in a loot table in `src/content/loot-tables.ts`.

No module above L3 changes. `tests/survival.test.ts` will fail if a loot table
points at an item that does not exist.

### Add a creature

1. Add an entry to `CREATURES` in `src/content/entities.ts`, picking one of the
   three archetypes: `wanderer` (hears only), `hunter` (hears and sees, commits,
   then has to rest) or `sentinel` (never moves, lethal, telegraphed).
2. Add a sprite spec with the same `sprite` id.
3. Add its id with a weight to a level's `creatures` list in
   `src/content/levels.ts`.

A genuinely new *behaviour* — not a reskin of the three — is the one case that
needs a code change: a branch in `decide()` in `src/game/ai.ts`. That function is
pure and is where all three archetypes already live.

### Add a room type

Add a template to `LEVEL0_ROOMS` (or `LEVEL1_ROOMS`) in `src/content/rooms.ts`:
`blockSize - 1` rows of `blockSize - 1` characters.

```
.  floor        #  wall         o  pillar      ,  stained carpet
~  wet carpet   L  lamp         c  container   s  creature spawn
```

The generator carves a doorway lane through the middle two rows and columns of
any block that has a doorway on that axis, so structure placed in the middle band
will be cut through. Anything the lanes cannot reach is turned back into wall, so
a template can never produce an unreachable pocket. A landmark is the same thing
plus a `marker` decal id, in `LEVEL0_LANDMARKS`.

`tests/levelgen.test.ts` checks every template's size and characters, and checks
connectivity and density for every level.

### Add a level

Add a `LevelSpec` to `LEVELS` in `src/content/levels.ts`: its own rooms,
landmarks, palette id, corridor-lattice period, lamp and container odds, creature
mix and ambient light. Add the palette to `src/content/palettes.ts`. The descent
walks the array in order.

## Performance

60 FPS with the debug overlay open, measured in Chromium at 1280x720: about
0.6 ms of simulation and 6 ms of rendering per frame with 20 creatures and 9
chunks live. `tests/performance.test.ts` steps 200 active creatures and asserts
the tick stays under 4 ms (it is around 2 ms), which is really a guard against an
accidental O(n²) — the uniform grid and the source-bucketed noise field exist to
keep it linear.

## What is not done

Nothing on the brief's cut list was cut, but these are the honest gaps:

- **Only two levels.** Level 1 differs in palette, room set, lattice period,
  lighting and creature mix, which is enough to feel the change, and the exit on
  Level 1 leads nowhere — the array ends there.
- **Descent is one-way.** There is no way back up, and the level you leave is
  discarded along with its deltas.
- **The tutorial is the opening room plus one contextual line.** No text screen,
  as asked, but a player who never presses `Tab` will never find the bag.
- **Low-nerve effects are modest**: false silhouettes at the edge of sight, a
  souring hum, whispers, and a colour shift on the HUD. No screen-space
  distortion.
- **No item rotation in the bag**, and no split-a-stack gesture.
- **A creature despawns with its home chunk** and respawns at its spawn point when
  you come back, so you cannot lose a hunter permanently by outrunning it two
  chunks away.
- **Lamp light is not intersected with creature vision** — creatures use line of
  sight and hearing only; they do not care whether they are standing in the dark.
- **No touch input.** The input layer is abstracted so an adapter that produces
  `InputFrame`s is all it would take, but the adapter is not written.
- **Sound is synthesised placeholder tones**, like the sprites. Both sit behind
  interfaces (`SpriteProvider`, `AudioOutput`) so real assets can replace them
  without touching a game module.

## Layout

```
src/core/          fixed-step loop, ECS store, event bus, RNG, input, camera,
                   renderer interface + canvas backend, spatial grid, assets,
                   audio, save/serialize, math
src/systems/       collision, raycast, vision, pathfinding, sound
src/game/level/    chunk generation, carving, streaming, chunk deltas
src/game/run/      the tick order, player actions and their effects, creatures,
                   perception, prop index, save
src/game/          player body, stats, inventory, items, loot, lighting, AI
src/content/       all data and all numbers
src/view/          tiles, props, lighting, debug drawing
src/ui/            app shell, HUD, bag, summary, debug overlay, audio view
tests/             layer/cycle guard, determinism, generation, survival, AI,
                   input, gameplay loop, frame budget
```
