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
| `Space` | Search a container, pick something up, take the way down |
| `E` | Use what is in the main hand |
| `F` | Use what is in the off hand |
| `R` | Switch the flashlight on or off |
| `Q` | Throw what is in your hand |
| `G` | Put down what is in your hand |
| `1` – `4` | Belt slots: use what hangs there (clicking a slot does the same) |
| `X` | Swap main hand and off hand |
| `Tab` | Bag. Drag between the bag, the slots and the belt |
| `F1` | Show or hide the key legend |
| `H` | Guidebook |
| `Esc` | Pause; from a screen, back |
| `F3` / `` ` `` | Debug overlay |
| `Enter` | After death: go back in with a new seed |

The heads-up display carries a legend of these keys in the bottom-left corner,
written from the live bindings, so it is never out of date with what is bound;
`F1` or a click on its title folds it away, and the choice is remembered. The
four vitals sit across the top centre, the worn gear top right, the hands bottom
right and the belt bottom centre.

There is no attack key: melee is automatic (see below). Every key can be rebound
in the settings, and the change applies immediately — including to every hint in
the game and to the controls table in the guidebook, which are all generated from
the live bindings. The default table is `KEY_BINDINGS` in `src/content/tuning.ts`.

### On a touchscreen

There is nothing to set up: touch the screen and the pad appears; use a key or a
mouse and it goes away again. A laptop with a touchscreen therefore gets whichever
one is in the player's hands at that moment. **Settings → Controls → Touch** pins
it either way.

| | |
| --- | --- |
| Left half, anywhere | Walk. The stick appears under the thumb that lands, so there is nothing to find |
| …pushed all the way out | Sprint. There is no button for it: both thumbs are already holding something |
| Right half, anywhere | Look. Released, the aim stays where it was left; untouched, you face the way you walk |
| ◎ | Search, pick up, take the way down |
| ✱ ✲ | The two hands — each button wears the icon of what is in it |
| ☀ ▦ ⌄ | Torch, bag, crouch. Crouch is a toggle: a stance is not something you hold |
| ➤ ⤓ ⇄ ❚❚ | Throw, put down, swap hands, pause |
| Belt | The four slots are buttons already; tap one |
| In the bag | Drag as with a mouse; double tap does the obvious thing, and a long press opens the list the right button opens |

While the pad is up, two panels go away — the hands panel, because the two hand
buttons already carry what is in them, and the key legend, because it is a list of
keys nobody has. Every hint that would name a key names the button instead: the
prompt over a crate reads `◎ — pick up`, not `Space — pick up`.

## How it plays

Thirst is the tightest clock, hunger the second. Nerve drains in the dark, in
total silence, and near anything living — and silence is the trap, because the
cheapest way to keep your nerve is to make noise, and noise is what everything
here listens for. Sprinting is the loudest thing you can do; crouching is free.

Landmarks are the only navigation there is: no map, no compass, no coordinates.
The generator guarantees one memorable room every few chunks and one way down
every few chunks after that.

### Light

Light is the mechanic the building is built around, so it is drawn from the same
curve the simulation reads: the pool you see is the pool the game counts as lit.
Ceiling tubes burn the colour of the level's own bulbs; a torch, a head lamp and
a chemical stick each burn their own, so what is in your hand is legible from the
colour on the walls. Every lamp is two pools — a wide one on the floor and a
tight one on the fitting, because a light you cannot see the source of reads as a
stain rather than a lamp. A hand-held beam sways slightly, being held by a hand.

Stepping out of a lit room into the dark is briefly worse than being in the dark
already was: the eye takes about a second to adjust. That is brightness only —
how far you can see is a number the simulation owns and the view never argues
with.

### Carrying

There is no weight. There are cells, and nine equipment slots — head, face,
body, vest, legs, feet, back, and two hands. With nothing on your back the bag
is four cells; a pack is worth four to nine more and trouser and coat pockets
one or two. One thing is one cell, and a stack of any size is also one cell, so
what limits you is variety, not mass. Swapping to a smaller pack while the bag
is full drops what no longer fits, and says how much before you agree to it.

Each hand has its own key, so a torch in the off hand switches on without the
weapon leaving the main one. Four belt slots sit under the number keys and take
only what the catalogue marks belt-worthy — food, water, bandages, a light stick
— never a weapon and never a coat; the hotbar shows what is on each of them and
how worn it is, and a slot can be clicked as well as pressed. The bag does not
pause the world.

A pack, a satchel and a pair of cargo trousers have pockets of their own. Swap to
a smaller pack and what no longer fits goes into the pockets of the one coming
off rather than onto the floor; only what no pocket will take is dropped, and you
are warned before it is. Wear a pack through and its pockets shrink — whatever
was in them lands at your feet.

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

## The test level

The main menu has a **Test level** entry beside "New run". It starts an ordinary
run with one extra level in front of the others and lays the entire catalogue —
every item, three stacks of each — on the floor in rings around the spawn, with
one of every creature standing on a ring beyond that and a full set of gear
already worn. It is the same drop, spawn and pickup code a real run uses, so what
it shows is the real behaviour rather than a display case.

It is never written to storage: starting it, dying in it and walking back out
leave a saved run exactly where it was. Its numbers live in `SANDBOX` in
`src/content/tuning.ts` and its level in `SANDBOX_LEVEL` in
`src/content/levels.ts`.

## Menus and settings

The game opens on a main menu and runs a five-state machine — menu, playing,
paused, guidebook, death screen. The simulation advances in exactly one of them,
so a pause or an open guidebook stops the world completely: stats, timers,
creatures and the ambient hum together.

Settings (reachable from the main menu and from a pause, the same screen in both):
language, master/effects/ambient volume, quality, brightness, interface scale, the
debug overlay, whether the on-screen pad is up, full key rebinding with conflict
handling and a reset, and confirmed wipes of the saved run and of the settings
themselves. They live under their own
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
  core/      L0  loop, entity/component store, event bus, seeded RNG, input
                 (keyboard, mouse and whatever a pad feeds it),
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

### Invariants

`tests/invariants.test.ts` plays thousands of ticks of seeded nonsense through
`Run` and hammers the inventory API directly, asserting the rules no single
feature owns: a stack is in exactly one place, the bag never holds more than its
cells, a worn thing is worn where it fits, nothing becomes NaN, and a save is the
run it came from. `tests/content.test.ts` checks the cross-references between the
L3 tables — sprites, loot, creatures, levels and the keys the interface builds at
runtime — which a compiler cannot see.

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
3. Draw an icon under the same `sprite` id in `src/content/sprites.ts` — a stack
   of shapes in fractions of its own box, in whatever proportions the thing has.
   The same spec is what the bag, the belt, the hands, the tooltips and the floor
   all draw, so it only has to be authored once. A test fails if it is left on
   the shared ground marker or borrows another item's art.
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

### Change what a frame costs

`QUALITY` in `src/content/view.ts` is the whole of it: three tiers, each naming a
pixel ratio, a backing-store ceiling, the share of the frame light is computed
over, ray counts, beam pools and whether bloom and lamp cores are drawn at all.
`viewFor(tier)` derives the `ViewConfig` the view actually reads, and a tier may
only ever turn a number down — a test asserts that. `QUALITY_GOVERNOR` holds the
thresholds the frame clock is judged against.

### Add a level

Add a `LevelSpec` to `LEVELS` in `src/content/levels.ts`: its own rooms,
landmarks, palette id, corridor-lattice period, lamp and container odds, creature
mix and ambient light. Add the palette to `src/content/palettes.ts` — a palette
declares the ids of the tiles painted with it, and `sprites.ts` builds carpet,
wallpaper, pillars, damp and stains out of that palette's own colours, so a new
level is a colour table rather than thirty new sprites. The descent walks the
array in order.

## Performance

The frame decides for itself how much work it is allowed to be.

Almost the whole cost of a frame is the darkness pass — full-screen fill, one
gradient per light — and what it costs scales with the number of pixels it is
computed over, which is a property of the machine rather than of anything the
player chose. So `QUALITY` in `src/content/view.ts` is three tiers of the same
picture at three prices, and a governor moves between them from the clock.

| | low | medium | high |
| --- | --- | --- | --- |
| device pixels per CSS pixel, at most | 1 | 1.5 | 2 |
| backing store ceiling | 1.6 MP | 3.0 MP | 4.6 MP |
| light computed at, share of the frame | 0.40 | 0.60 | 0.85 |
| rays: lamp / sight / beam | 40 / 96 / 28 | 56 / 160 / 36 | 72 / 256 / 48 |
| pools along the torch beam | 6 | 9 | 12 |
| bloom, lamp cores, false silhouettes | — | full | full |

The governor reads two clocks, because one of them lies. The frame time is what
the player feels, but the browser pins it to the refresh rate: a machine drawing
comfortably at 60 Hz reports 16.6 ms whether it spent one millisecond of that on
us or fifteen. So quality is given up only when the frame is long **and** our own
work is the reason it is long, and taken back when our own work is small,
whatever the display is doing — which is what lets a tab throttled to 30 Hz keep
a tier it can plainly afford. It counts slow frames rather than averaging them,
so one 200 ms frame — a tab coming back, a chunk streaming in, a collection —
cannot cost a tier on its own. `tests/quality.test.ts` covers all of it,
including that a machine sitting between two tiers does not oscillate.

Auto starts in the middle and settles within a few seconds. The setting is in
**Settings → Picture → Quality**, and picking a tier by hand pins it.

Measured on the worst machine available — a headless Chromium in a container
with no GPU at all, where everything below is software-rasterised, 1280x760,
walking through a lit corridor with the torch on:

| | before | after |
| --- | --- | --- |
| render, per frame | 41 ms | 5.0 ms (low), 17 ms (medium), 29 ms (high) |
| frames per second | 18 | 57-61, auto |
| simulation, 200 creatures | 4.7 ms | 0.6 ms |

On hardware with a GPU the top tier is the one that runs, and the old figure —
about 6.4 ms of rendering per frame in Chromium at 1280x720 — is the one to
compare against; the changes below take work out of the frame rather than adding
any. A 46-second soak with streaming, torch and bag use holds 57 FPS and does not
move the heap (10.1 MB at both ends).

Where the time went, and where it went instead:

- **A failed path was searched again every tick.** A creature that could not
  reach its target got an empty path back, which read as a path that had run
  out, so it ran a full A* to the whole node budget on the next tick, and the
  next. It waits for the repath timer now. This alone was 46% of the tick.
- **`tileAt` built a string key per sample.** Every ray, path expansion and
  collision test goes through it; the `"cx,cy"` key and its hash were a quarter
  of the tick. Chunks are keyed by number, with a memo of the last one — rays and
  paths are spatially coherent, so most samples never reach the map at all.
- **A\* allocates nothing per search**: one heap in three parallel arrays,
  reused maps, no object per pushed node.
- **Creatures stagger their timers** from their spawn seed, so a chunk full of
  them is not one spike per repath and one per noise pulse.
- **Light is computed on smaller layers** and stretched back over the frame,
  without resampling on the way.
- **Every light fill is clipped to the visible rectangle**, lights entirely off
  screen are rejected once for both layers, the bloom layer is not composited in
  a frame where nothing glowed, and the torch beam pays for its bloom once
  rather than once per pool.
- **The backing store is capped by area as well as by ratio.** A 4K display at
  two device pixels per CSS pixel is thirty-three million pixels, three buffers
  over.
- **The interface gives up its blurs** and its full-screen filter animation at
  the bottom tier: a `backdrop-filter` is a full-screen composite per panel.

`tests/performance.test.ts` steps 200 active creatures and asserts the tick stays
under 2 ms, which is really a guard against an accidental O(n²) — and, now,
against the failed-path regression above coming back.

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
- **Equipment has no silhouette art.** The slot panel is a labelled body layout
  with the icons of what is worn in it, not a drawn figure.
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
  face is the near half of its tile rather than a surface with a normal, and the
  wallpaper on it does not turn with the light either.
- **Sound is synthesised placeholder tones.** Sprites are procedural too — every
  icon, tile and body is a stack of shapes drawn into a canvas at load time, not
  a painting. Both sit behind interfaces (`SpriteProvider`, `AudioOutput`) so
  real assets can replace them without touching a game module.
- **Dark adaptation eases per frame, not per second.** It is a purely visual
  memory kept in the view, so it is deliberately outside the fixed step; a
  machine at 30 FPS adjusts about half as quickly. Nothing the simulation reads
  depends on it.
- **The impact flash is read off the swing, not off each creature.** Everything
  inside the reach flinches when a swing lands, including the one that turned it
  aside. Fixing that would mean a new field in creature state, in the save and in
  the determinism fingerprint, to correct a highlight that lasts a sixth of a
  second.
- **The floor is four tiles and the walls three**, picked per cell from its own
  coordinates. That is enough that no repeat is ever adjacent to itself, but it
  is not the same as a building that is genuinely different everywhere.
- **Quality moves in three steps, not continuously.** A machine between two
  tiers gets the lower one and its spare capacity goes unused; the alternative
  is a dial with no name, which is harder to reason about and harder to test.
- **Touch has no rebinding and no layout options.** Where the pad puts its
  buttons is where they are; the keyboard can be remapped and the pad cannot.
  Nothing else in the game is a fixed control.
- **A double tap in the bag relies on the browser synthesising `dblclick`.**
  Every current one does, now that the page refuses to zoom, but it is the one
  touch gesture here that is not built from pointer events directly.
- **A failed path is retried on a timer, not on a change.** A creature whose
  route opens up waits out the rest of its repath interval before noticing,
  which is up to two fifths of a second of standing still.

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
                   guidebook, summary, debug overlay, audio view, touch pad,
                   quality governor
tests/             layer/cycle guard, determinism, generation, survival, AI,
                   input, localization, combat, gameplay loop, frame budget,
                   quality tiers
```
