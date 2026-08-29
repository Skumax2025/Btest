# PLAN

Working notes: files touched per phase. Not a report.

## F0 — skeleton
package.json, tsconfig.json, vite.config.ts, eslint.config.js, index.html,
src/core/{math,rng,loop,input,renderer,camera}.ts, src/main.ts, tests/rng.test.ts

## F1 — full L0 core
src/core/{world,events,spatial,assets,serialize}.ts, src/core/index.ts
tests/{world,spatial,layers,determinism}.test.ts

## F2 — level generation, collision, camera follow
src/game/levelgen/{grid,blocks,templates-api,chunk,landmarks,index}.ts
src/systems/{collision,movement}.ts
src/content/{tuning,rooms,palettes}.ts
src/view/{world-view,tiles}.ts
tests/levelgen.test.ts

## F3 — stats, lighting, inventory, loot
src/game/{stats,inventory,loot,lighting,interaction}.ts
src/content/{items,loot-tables,sprites,texts}.ts
src/ui/{hud,inventory-ui}.ts
tests/{stats,inventory,loot}.test.ts

## F4 — sound, entities, death, save
src/systems/{sound,pathfinding,vision,particles,timers}.ts
src/game/{ai,run,save}.ts
src/content/entities.ts
tests/{sound,ai,save}.test.ts

## F5 — second level, transition, summary, tutorial room, debug overlay
src/game/transition.ts, src/content/levels.ts, src/ui/{summary,debug-overlay}.ts

## F6 — polish
README.md, DECISIONS.md, balance pass, dead code sweep
