# No Exit — a Backrooms survival demo

A single-run, top-down survival demo set in an endless yellow building. Find
supplies, watch your body, avoid what lives here, find the way down, and
eventually stop. Death is permanent; the next run is a new seed.

Russian and English, switchable mid-run. TypeScript, Canvas 2D, no game
libraries. Vite, Vitest and ESLint are the only dependencies.

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
| `Ctrl` / `C` | Crouch. Slow, silent, and never swings |
| `E` | Search a container, pick something up, take the way down |
| `F` | Use what is in your hand |
| `R` | Switch the flashlight on or off |
| `Q` | Throw what is in your hand |
| `G` | Put down what is in your hand |
| `1` – `4` | Belt slots: use what hangs there, or take a weapon in hand |
| `X` | Swap main hand and off hand |
| `Tab` | Bag. Drag between the bag, the slots and the belt |
| `H` | Guidebook |
| `Esc` | Pause; from a screen, back |
| `F3` / `` ` `` | Debug overlay |
| `Enter` | After death: go back in with a new seed |

There is no attack key: melee is automatic (see below). Every key can be rebound
in the settings, and the change applies immediately — including to every hint in
the game and to the controls table in the guidebook, which are all generated from
the live bindings. The default table is `KEY_BINDINGS` in `src/content/tuning.ts`.

## How it plays

Thirst is the tightest clock, hunger the second. Nerve drains in the dark, in
total silence, and near anything living — and silence is the trap, because the
cheapest way to keep your nerve is to make noise, and noise is what everything
here listens for. Sprinting is the loudest thing you can do; crouching is free.

Landmarks are the only navigation there is: no map, no compass, no coordinates.
The generator guarantees one memorable room every few chunks and one way down
every few chunks after that.

### Carrying

There is no weight. There are cells, and nine equipment slots — head, face,
body, vest, legs, feet, back, and two hands. With nothing on your back the bag
is four cells; a pack is worth four to nine more and trouser and coat pockets
one or two. One thing is one cell, and a stack of any size is also one cell, so
what limits you is variety, not mass. Swapping to a smaller pack while the bag
is full drops what no longer fits, and says how much before you agree to it.

Four belt slots sit under the number keys: food is eaten and weapons are drawn
from there without opening anything. The bag does not pause the world.

Every item carries one condition value, and what it means is written in the item
rather than in the code: swing damage for a weapon, damage soaked for armour,
footstep noise and pocket count for clothes, cells for a pack, freshness for
food. Zero means something different in each case — bare hands, destroyed, merely
tired, or edible and regrettable. The bar under every icon is that one number.

### Fighting

Melee runs itself. While anything stands inside the reach of the item in your
hand, you swing on that weapon's own interval — a ring shows the reach the moment
something enters it, and a second ring closing in on it is the time to your next
swing. A swing catches **everything** inside the ring, not the nearest thing.

You pay for the width, and you pay in breath and in noise rather than in damage:
every extra body caught adds to both. One or two is expensive. Five empties the
bar in two swings and shouts far enough to bring more, and then you are standing
still with nothing left — which is how the game intends you to die if you choose
to fight a crowd.

A block swallows one incoming hit whole — not part of it — on a cooldown, for
breath, and not at all at zero breath. Only one hit per tick: if three of them
land together you turn aside one and take two.

There are exactly two ways to refuse a fight, and both are guaranteed: **crouch**,
or carry **nothing in your hand slot**. Neither will ever swing. Weapons blunt as
you use them, hit weaker as they go, and a broken one is bare hands — which are
themselves an ordinary entry in the item catalogue rather than a special case.

Trading blows with the hunter, head on, is always fatal. That is a designed
property, checked by a test.

## Menus and settings

The game opens on a main menu and runs a five-state machine — menu, playing,
paused, guidebook, death screen. The simulation advances in exactly one of them,
so a pause or an open guidebook stops the world completely: stats, timers,
creatures and the ambient hum together.

Settings (reachable from the main menu and from a pause, the same screen in both):
language, master/effects/ambient volume, brightness, interface scale, the debug
overlay, full key rebinding with conflict handling and a reset, and confirmed
wipes of the saved run and of the settings themselves. They live under their own
storage key, so erasing a run never costs you your language, keys or volume.

## Guidebook

Eight sections, available from the menu, from a pause, and on `H` in play. It
describes only mechanics that exist in the code, and every number in it is
substituted from the tuning tables in `src/content/` — re-balancing the game
rewrites the guidebook with it, and a test fails if a paragraph asks for a value
its section does not supply.

## Localization

Russian by default, English complete, switchable at any moment without losing the
run. `src/content/locales/ru.ts` is the source of truth for the key set;
`en.ts` is typed against it, so a missing English string is a compile error. Key
names never appear inside a locale string — hints take the key as a parameter and
the interface fills it from the live bindings.

To add a language: add a locale file, type it as `Record<TextKey, LocaleString>`,
and add one entry to `src/content/locales/index.ts`. Plural rules live in
`src/core/i18n.ts`; Russian uses one/few/many including the 11-14 exception.

## Structure

Five layers. A layer may import only layers strictly below it. This is enforced
by ESLint (`no-restricted-imports` per directory in `eslint.config.js`) and by
`tests/layers.test.ts`, which parses the real import graph and also fails on
cycles.

```
src/
  core/      L0  loop, entity/component store, event bus, seeded RNG, input,
                 renderer interface, camera, spatial index, assets, audio,
                 localization, serialization         — no game words at all
  systems/   L1  collision, ray marching, visibility, pathfinding, sound
  game/      L2  level generation and streaming, player, stats, inventory,
                 items, loot, lighting, melee, creature AI, the run itself
  content/   L3  data only: rooms, levels, items, weapons, loot tables,
                 creatures, palettes, sprites, audio cues, locales, guidebook
                 structure, every tuning number
  ui/, view/ L4  DOM overlay, screens, canvas rendering, the entry point
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

1. Add an entry to `ITEMS` in `src/content/items.ts` — which slots it fits,
   stack size, tags, its `durability` block (what condition means and what zero
   does), its `use` effects, and any of `armor`, `carry`, `passive`, `light` or
   `beacon` it needs. Behaviour is a combination of effects the item module
   already executes; an item never gets code of its own.
2. Add `item.<id>.name` and `item.<id>.desc` to both locale files.
3. Add a sprite spec under the same `sprite` id in `src/content/sprites.ts`.
4. Put it in a loot table in `src/content/loot-tables.ts`.

No module above L3 changes. The tests fail if a loot table points at an item that
does not exist, or if either locale is missing a key.

### Add a weapon

A weapon is an item whose `melee` field is a `WeaponStats` block: reach, damage,
swing interval, wind-up, stamina cost and its growth per extra body caught, noise
and its growth, wear per swing, durability, the damage floor when nearly broken,
and block chance, cost and cooldown. Add the block to `WEAPONS` in
`src/content/tuning.ts` and point an item at it. Bare hands (`item.hands`) are
one of these, which is why nothing above L3 has a branch for "no weapon".

### Add a creature

1. Add an entry to `CREATURES` in `src/content/entities.ts`, picking one of the
   three archetypes: `wanderer` (hears only), `hunter` (hears and sees, commits,
   then has to rest) or `sentinel` (never moves, lethal, telegraphed). The block
   fields (`blockChance`, `blockCooldownTicks`) are data too — a creature that
   parries incoming swings is a table edit.
2. Add `creature.<id>.name` to both locale files.
3. Add a sprite spec with the same `sprite` id.
4. Add its id with a weight to a level's `creatures` list in
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
0.9 ms of simulation and 6.4 ms of rendering per frame with 20 creatures and 9
chunks live. `tests/performance.test.ts` steps 200 active creatures and asserts
the tick stays under 4 ms (it is around 2 ms), which is really a guard against an
accidental O(n²) — the uniform grid and the source-bucketed noise field exist to
keep it linear.

## What is not done

Nothing on either brief's cut list was cut. These are the honest gaps:

- **The guidebook has no illustrations** and no per-item pages; it describes
  systems, not the catalogue.
- **Settings have no gamepad or touch section**, because neither input exists.
- **Creature block chance is data but almost entirely unused** — only the hound
  has a non-zero value.
- **The reach ring is a circle, not the weapon's silhouette.** A swing really is
  radial, so the circle is honest, but it does not communicate facing.

- **Only two levels.** Level 1 differs in palette, room set, lattice period,
  lighting and creature mix, which is enough to feel the change, and the exit on
  Level 1 leads nowhere — the array ends there.
- **Descent is one-way.** There is no way back up, and the level you leave is
  discarded along with its deltas.
- **The tutorial is the opening room plus one contextual line.** No text screen,
  as asked, but a player who never presses `Tab` will never find the bag.
- **Splitting a stack always halves it.** There is no number picker; the context
  menu splits down the middle and that is the whole of it.
- **Equipment has no silhouette art.** The slot panel is a labelled body layout,
  not a drawn figure.
- **Low-nerve effects are modest**: false silhouettes at the edge of sight, a
  souring hum, whispers, and a colour shift on the HUD. No screen-space
  distortion.
- **No item rotation in the bag**, and no split-a-stack gesture.
- **A creature despawns with its home chunk** and respawns at its spawn point when
  you come back, so you cannot lose a hunter permanently by outrunning it two
  chunks away.
- **Lamp light is not intersected with creature vision** — creatures use line of
  sight and hearing only; they do not care whether they are standing in the dark.
- **Shadows are cast by a ray fan, not by wall corners.** The angular gap between
  two rays is the size of the jagged step a shadow edge can show, so the counts
  in `VISION` are set to keep that gap under a tile out to the distance the
  player can actually see. Beyond that, far shadow edges are approximate.
- **Light is a flat overlay, so nothing is shaded by direction.** A wall's lit
  face is the near half of its tile rather than a surface with a normal.
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
src/game/run/      the tick order, player actions and their effects, melee,
                   creatures, perception, prop index, save
src/game/          player body, stats, inventory, items, combat, loot, lighting,
                   AI
src/content/       all data and all numbers, locales, guidebook structure
src/view/          tiles, props, lighting, combat marks, prompts, debug drawing
src/ui/            app shell and state machine, HUD, bag, menu, settings,
                   guidebook, summary, debug overlay, audio view
tests/             layer/cycle guard, determinism, generation, survival, AI,
                   input, localization, combat, gameplay loop, frame budget
```
