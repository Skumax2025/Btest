# PLAN

Working notes: files touched per phase. Kept as a record of the route taken, not
as a report — the README is the report.

## F0 — skeleton (done)
package.json, tsconfig.json, vite.config.ts, eslint.config.js, index.html,
src/core/{math,rng,loop,input,renderer,camera}.ts, src/main.ts

## F1 — full L0 core (done)
src/core/{world,events,spatial,assets,serialize}.ts
tests/{rng,core,layers}.test.ts

## F2 — level generation, collision, camera (done)
src/game/level/{types,generate,carve,stream,index}.ts
src/systems/{collision,raycast}.ts
src/content/{tuning,palettes,rooms,levels,sprites}.ts
src/game/{player,lighting}.ts, src/game/run/{config,run,index}.ts
src/view/{tiles,props,world-view}.ts, src/ui/app.ts
tests/{levelgen,collision}.test.ts

## F3 — stats, lighting, inventory, loot (done)
src/systems/{vision,sound}.ts, src/core/canvas-renderer.ts
src/game/{stats,items,inventory,loot,ai}.ts
src/game/run/{perception,world-access,actions,effects}.ts
src/content/{items,loot-tables,entities,texts}.ts
src/ui/{dom,hud,inventory-ui}.ts, src/view/lighting-view.ts
tests/survival.test.ts

## F4 — sound, creatures, death, save (done)
src/systems/pathfinding.ts, src/core/audio.ts
src/game/run/{creatures,save}.ts
src/content/{audio,run-config}.ts, src/ui/audio-view.ts
tests/{ai,determinism,gameplay}.test.ts

## F5 — second level, transition, summary, debug overlay (done)
src/content/rooms.ts (level 1), src/content/levels.ts
src/ui/{summary,debug-overlay}.ts, src/view/debug-view.ts
src/game/run/run.ts (descend), component-store wiring
tests/performance.test.ts

## F6 — polish (done)
README.md, DECISIONS.md, balance pass, dead-code sweep,
src/game/run/prop-index.ts (split out of run.ts), src/content/view.ts
tests/input.test.ts

---

# Second pass: localization, auto-combat, menus, UI, guidebook

## G0 — localization layer
new  src/core/i18n.ts                       (L0: dictionary, active locale, params, plurals)
new  src/content/locales/{ru,en,index}.ts   (L3: all strings, ru is the source of key truth)
new  src/ui/i18n-dom.ts                     (L4: text bindings that re-render on locale change)
new  src/ui/keys.ts                         (L4: key code -> localized label)
del  src/content/texts.ts
mod  src/ui/{hud,inventory-ui,summary,app}.ts, src/style.css
new  tests/i18n.test.ts                     (key parity, no on-screen literals in L2/L4)

## G1 — combat
new  src/game/combat.ts                     (L2: pure reach/damage/cost/block logic)
mod  src/game/items.ts                      (weapon stat block on ItemDef)
mod  src/game/inventory.ts                  (durability on a stack)
mod  src/game/ai.ts                         (blockChance on CreatureDef)
mod  src/game/run/{config,world-access,actions,effects,run,save}.ts
mod  src/content/{items,entities,tuning}.ts
new  src/view/combat-view.ts                (reach ring, cooldown arc, hit/block marks)
mod  src/ui/audio-view.ts, src/content/audio.ts
new  tests/combat.test.ts

## G2 — state machine, menu, settings
new  src/ui/{screen,menu,settings,settings-store}.ts
mod  src/core/audio.ts                      (separate effect and ambient gain)
mod  src/ui/app.ts                          (AppState; simulation ticks only in PLAYING)

## G3 — HUD rework
mod  src/ui/hud.ts, src/ui/inventory-ui.ts, src/style.css

## G4 — guidebook
new  src/ui/guidebook.ts, src/content/guide.ts
mod  src/content/locales/*

## G5 — polish
README.md, DECISIONS.md, balance pass over the numbers in L3
