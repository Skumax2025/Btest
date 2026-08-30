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
