/**
 * L2: one run of the game.
 *
 * Knows: the order in which systems advance inside a single fixed tick, and how
 * the pieces of a run reference each other.
 * Does not know: rendering, the DOM, wall-clock time, or any concrete item,
 * creature or level — those arrive through `RunConfig`. Feeding this class a
 * sequence of `InputFrame`s is the whole game; the browser is optional.
 */

import { World } from '@core/world';
import type { ComponentStore, EntityId } from '@core/world';
import { createRandom } from '@core/rng';
import type { RandomStream } from '@core/rng';
import type { InputFrame } from '@core/input';
import { isHeld } from '@core/input';
import { LevelStream, TILE, isSolidTile } from '@game/level';
import type { LevelSpec, PropSpawn } from '@game/level';
import { createPlayer, stepPlayer } from '@game/player';
import type { PlayerState } from '@game/player';
import { createInventory } from '@game/inventory';
import type { InventoryState } from '@game/inventory';
import { canSprint, createStats, isDead, stepStats } from '@game/stats';
import type { StatsState } from '@game/stats';
import type { CreatureState } from '@game/ai';
import { NoiseField } from '@systems/sound';
import type { RunConfig } from './config';
import { handleActions, nearestInteractable } from './actions';
import { stepCreatures, syncCreatures } from './creatures';
import { stepLight, stepProjectiles, stepSearch } from './effects';
import { applyContactDamage, stepMelee } from './melee';
import { perceive } from './perception';
import { PropIndex, groundItemsNear } from './prop-index';
import type { Perception } from './perception';
import { createCombatState } from './world-access';
import type {
  CombatState,
  GroundItem,
  HintKey,
  Projectile,
  RunWorld,
  SearchProgress,
} from './world-access';

export type RunPhase = 'alive' | 'dead';

export class Run implements RunWorld {
  readonly world = new World();
  readonly config: RunConfig;
  readonly player: PlayerState;
  readonly stats: StatsState;
  readonly inventory: InventoryState;
  readonly noise: NoiseField;
  readonly projectiles: ComponentStore<Projectile>;
  readonly creatures: ComponentStore<CreatureState>;
  readonly rng: RandomStream;
  readonly spawnedChunks = new Set<string>();
  readonly combat: CombatState = createCombatState();

  level: LevelStream;
  levelIndex = 0;
  tick = 0;
  phase: RunPhase = 'alive';
  flashlightOn = false;
  flashlightCharge = 0;
  search: SearchProgress | null = null;
  descendRequested = false;
  collected = 0;
  distance = 0;
  hint: HintKey | null = null;
  perception: Perception;

  /** Public because the save file owns them; nothing else should write them. */
  lastNoiseTick = 0;
  lastFootstepTick = 0;

  private readonly propIndex: PropIndex;

  constructor(config: RunConfig) {
    this.config = config;
    this.creatures = this.world.store<CreatureState>('creature');
    this.projectiles = this.world.store<Projectile>('projectile');
    this.rng = createRandom(config.seed);
    this.propIndex = new PropIndex(config.propCellSize);
    this.noise = new NoiseField(config.sound);
    this.stats = createStats(config.stats);
    this.inventory = createInventory(
      config.inventory.width,
      config.inventory.height,
      config.inventory.capacity,
    );
    this.level = this.createLevel(0);
    const spawn = this.spawnPoint();
    this.player = createPlayer(spawn.x, spawn.y);
    this.level.prime(spawn.x, spawn.y);
    syncCreatures(this);
    this.rebuildPropIndex();
    this.perception = this.perceiveNow();
  }

  get spec(): LevelSpec {
    return this.level.spec;
  }

  /** Middle of the very first block, which the generator always keeps walkable. */
  spawnPoint(): { x: number; y: number } {
    const { tileSize, blockSize } = this.config.geometry;
    const centre = Math.floor(blockSize / 2);
    return { x: (centre + 0.5) * tileSize, y: (centre + 0.5) * tileSize };
  }

  createLevel(index: number): LevelStream {
    const levels = this.config.content.levels;
    return new LevelStream(
      this.config.seed,
      index,
      levels[Math.min(index, levels.length - 1)],
      this.config.geometry,
      this.config.stream,
    );
  }

  readonly isSolid = (tx: number, ty: number): boolean => isSolidTile(this.level.tileAt(tx, ty));
  readonly isWet = (tx: number, ty: number): boolean => this.level.tileAt(tx, ty) === TILE.WET;

  step(input: InputFrame): void {
    this.tick++;
    this.level.update(this.player.x, this.player.y);
    if (syncCreatures(this) > 0) this.rebuildPropIndex();
    if (this.phase !== 'alive') return;

    this.noise.prune(this.tick);
    this.perception = this.perceiveNow();

    stepPlayer(this.player, {
      input,
      config: this.config.player,
      actions: this.config.actions,
      tileSize: this.config.geometry.tileSize,
      stepSeconds: this.config.stepSeconds,
      isSolid: this.isSolid,
      isWet: this.isWet,
      canSprint: canSprint(this.stats),
    });
    this.distance += this.player.moved;
    this.emitFootstep();

    handleActions(this, input);
    if (this.descendRequested) this.descend();
    stepCreatures(this);
    stepSearch(this);
    stepProjectiles(this);
    this.flashlightCharge = stepLight(this);
    // Swing first, then take the hit: a committed swing lands even if it is the
    // last thing the player does.
    stepMelee(this);
    applyContactDamage(this);
    for (const creature of this.creatures.values()) {
      if (creature.attackCooldown > 0) creature.attackCooldown--;
      if (creature.blockCooldown > 0) creature.blockCooldown--;
    }

    stepStats(
      this.stats,
      {
        stepSeconds: this.config.stepSeconds,
        sprinting: this.player.stance === 'sprint' && this.player.moved > 0,
        crouching: this.player.stance === 'crouch',
        resting: this.player.moved === 0,
        inDark: this.perception.inDark,
        inSilence: this.perception.inSilence,
        creaturePressure: this.perception.creaturePressure,
      },
      this.config.stats,
    );
    if (isDead(this.stats)) this.phase = 'dead';
    this.updateHint(input);
  }

  /**
   * One way only. The next level is a different generator seed stream, so the
   * one above is gone — which is why the exit is called a way down and not a
   * door.
   */
  descend(): void {
    this.descendRequested = false;
    if (this.levelIndex + 1 >= this.config.content.levels.length) return;
    this.levelIndex++;
    this.level = this.createLevel(this.levelIndex);
    const spawn = this.spawnPoint();
    this.player.x = spawn.x;
    this.player.y = spawn.y;
    this.player.prevX = spawn.x;
    this.player.prevY = spawn.y;
    this.player.vx = 0;
    this.player.vy = 0;
    this.creatures.clear();
    this.projectiles.clear();
    this.world.clear();
    this.search = null;
    this.spawnedChunks.clear();
    this.noise.clear();
    this.level.prime(spawn.x, spawn.y);
    syncCreatures(this);
    this.rebuildPropIndex();
  }

  /** Seconds the run has lasted, from the only clock the simulation has. */
  get elapsedSeconds(): number {
    return this.tick * this.config.stepSeconds;
  }

  private perceiveNow(): Perception {
    return perceive({
      props: this.propsNear(this.player.x, this.player.y, this.config.lighting.lampRadius * 2),
      creatures: this.creatures.values(),
      creatureDefs: this.config.content.creatures,
      tick: this.tick,
      x: this.player.x,
      y: this.player.y,
      ambient: this.spec.ambientLight,
      lighting: this.config.lighting,
      flashlightOn: this.flashlightOn,
      ticksSinceNoise: this.tick - this.lastNoiseTick,
      silenceTicks: this.config.noise.silenceTicks,
    });
  }

  private emitFootstep(): void {
    if (this.player.moved <= 0) return;
    if (this.tick - this.lastFootstepTick < this.config.noise.stepInterval) return;
    this.lastFootstepTick = this.tick;
    const { noise } = this.config;
    const radius =
      this.player.stance === 'sprint'
        ? noise.sprint
        : this.player.stance === 'crouch'
          ? noise.crouch
          : noise.walk;
    const wet = this.player.onWet ? noise.wetFactor : 1;
    if (radius > 0) this.emitNoise(this.player.x, this.player.y, radius * wet, 'step');
  }

  private updateHint(input: InputFrame): void {
    const target = nearestInteractable(this);
    if (this.search) {
      this.hint = 'search';
    } else if (target?.kind === 'ground') {
      this.hint = 'pickup';
    } else if (target?.kind === 'container') {
      this.hint = 'search';
    } else if (target?.kind === 'exit') {
      this.hint = 'descend';
    } else if (this.stats.exhausted && isHeld(input, this.config.actions.sprint)) {
      this.hint = 'exhausted';
    } else if (this.perception.inDark) {
      this.hint = this.flashlightCharge > 0 && !this.flashlightOn ? 'flashlight' : 'darkness';
    } else if (this.tick < this.config.openingHintTicks) {
      this.hint = 'move';
    } else {
      this.hint = null;
    }
  }

  /** Creates an entity carrying one component — the only way things get spawned. */
  spawn<T>(store: ComponentStore<T>, value: T): EntityId {
    const entity = this.world.createEntity();
    store.set(entity, value);
    return entity;
  }

  emitNoise(x: number, y: number, radius: number, source: string): void {
    if (radius <= 0) return;
    this.noise.emit({ x, y, radius, tick: this.tick, source });
    this.lastNoiseTick = this.tick;
  }

  setHint(hint: HintKey | null): void {
    this.hint = hint;
  }

  /** Rebuilt only when chunks come and go, never per tick. */
  rebuildPropIndex(): void {
    this.propIndex.rebuild(this.level);
  }

  propsNear(x: number, y: number, radius: number): PropSpawn[] {
    return this.propIndex.near(x, y, radius);
  }

  propsInRect(minX: number, minY: number, maxX: number, maxY: number): PropSpawn[] {
    return this.propIndex.inRect(minX, minY, maxX, maxY);
  }

  groundItemsNear(x: number, y: number, radius: number): GroundItem[] {
    return groundItemsNear(this.level, x, y, radius);
  }
}
