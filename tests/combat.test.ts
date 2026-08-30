/**
 * Melee runs itself now, so the rules have to be provable without a screen:
 * what a swing costs, who it catches, what a worn or broken weapon is worth, and
 * exactly how much a block swallows.
 */
import { describe, expect, it } from 'vitest';
import { createRandom } from '@core/rng';
import { EMPTY_INPUT } from '@core/input';
import {
  attackVeto,
  canBlock,
  resolveWeapon,
  rollBlock,
  swingCost,
  targetsInReach,
  wearAfterSwing,
} from '@game/combat';
import { Run } from '@game/run';
import type { CreatureState } from '@game/ai';
import { createRunConfig } from '@content/run-config';
import { ITEMS } from '@content/items';
import { CREATURES } from '@content/entities';
import { STATS, WEAPONS } from '@content/tuning';

const hands = WEAPONS.hands;
const pipe = WEAPONS.pipe;

const attack = (over: Partial<Parameters<typeof attackVeto>[0]> = {}) =>
  attackVeto({
    cooldown: 0,
    stamina: 100,
    crouching: false,
    hasItemInHand: true,
    targetCount: 1,
    stats: pipe,
    ...over,
  });

describe('weapon resolution', () => {
  it('falls back to bare hands for anything that is not a weapon', () => {
    const resolved = resolveWeapon(ITEMS['item.water'].melee, 0, hands);
    expect(resolved.stats).toBe(hands);
    expect(resolved.broken).toBe(false);
    expect(resolved.damage).toBe(hands.damage);
  });

  it('treats a broken weapon as bare hands, and says so', () => {
    const resolved = resolveWeapon(pipe, 0, hands);
    expect(resolved.stats).toBe(hands);
    expect(resolved.broken).toBe(true);
    expect(resolved.damage).toBe(hands.damage);
  });

  it('scales damage down with wear but never below the worn floor', () => {
    const fresh = resolveWeapon(pipe, pipe.maxDurability, hands).damage;
    const halfWorn = resolveWeapon(pipe, pipe.maxDurability / 2, hands).damage;
    const nearlyGone = resolveWeapon(pipe, 1, hands).damage;
    expect(fresh).toBeCloseTo(pipe.damage);
    expect(halfWorn).toBeLessThan(fresh);
    expect(nearlyGone).toBeLessThan(halfWorn);
    expect(nearlyGone).toBeGreaterThanOrEqual(pipe.damage * pipe.wornDamageFactor);
  });

  it('wears a weapon down one swing at a time and stops at zero', () => {
    let durability = 2;
    durability = wearAfterSwing(pipe, durability);
    expect(durability).toBe(1);
    durability = wearAfterSwing(pipe, 0);
    expect(durability).toBe(0);
    expect(wearAfterSwing(hands, 0)).toBe(0);
  });
});

describe('reach and cost', () => {
  it('catches everything inside the ring, not just the nearest', () => {
    const found = targetsInReach(0, 0, 20, [
      { id: 1, x: 10, y: 0, radius: 0 },
      { id: 2, x: -15, y: 0, radius: 0 },
      { id: 3, x: 0, y: 19, radius: 0 },
      { id: 4, x: 100, y: 0, radius: 0 },
    ]);
    expect(found.map((c) => c.id).sort()).toEqual([1, 2, 3]);
  });

  it('counts a body whose own radius reaches into the ring', () => {
    expect(targetsInReach(0, 0, 10, [{ id: 1, x: 18, y: 0, radius: 9 }]).length).toBe(1);
  });

  it('charges more stamina and makes more noise for every extra body', () => {
    const one = swingCost(pipe, 1);
    const three = swingCost(pipe, 3);
    const five = swingCost(pipe, 5);
    expect(one.stamina).toBe(pipe.staminaCost);
    expect(three.stamina).toBe(pipe.staminaCost + pipe.staminaPerExtraTarget * 2);
    expect(five.stamina).toBeGreaterThan(three.stamina);
    expect(five.noise).toBeGreaterThan(three.noise);
    expect(three.noise).toBeGreaterThan(one.noise);
    // A wide swing has to be affordable once and ruinous repeatedly.
    expect(five.stamina).toBeLessThan(STATS.maxStamina);
    expect(five.stamina * 3).toBeGreaterThan(STATS.maxStamina);
  });
});

describe('when a swing refuses to start', () => {
  it('swings with something in hand and a body in reach', () => {
    expect(attack()).toBe('ready');
  });

  it('never swings while crouching — that is the way past a fight', () => {
    expect(attack({ crouching: true })).toBe('crouching');
  });

  it('never swings with an empty hand slot', () => {
    expect(attack({ hasItemInHand: false })).toBe('emptyHands');
  });

  it('does not swing at nothing', () => {
    expect(attack({ targetCount: 0 })).toBe('noTargets');
  });

  it('stops when the breath runs out', () => {
    expect(attack({ stamina: 0 })).toBe('spent');
    expect(attack({ stamina: swingCost(pipe, 1).stamina - 0.01 })).toBe('spent');
  });

  it('costs more against a crowd, so a crowd stops the swing sooner', () => {
    const stamina = swingCost(pipe, 1).stamina + 1;
    expect(attack({ stamina, targetCount: 1 })).toBe('ready');
    expect(attack({ stamina, targetCount: 5 })).toBe('spent');
  });

  it('waits out its own interval', () => {
    expect(attack({ cooldown: 3 })).toBe('cooling');
  });
});

describe('block', () => {
  const input = { cooldown: 0, stamina: 100, chance: 0.5, staminaCost: 10 };

  it('is unavailable while cooling down', () => {
    expect(canBlock({ ...input, cooldown: 1 })).toBe(false);
  });

  it('is unavailable with no breath left', () => {
    expect(canBlock({ ...input, stamina: 0 })).toBe(false);
    expect(canBlock({ ...input, stamina: 9.9 })).toBe(false);
    expect(canBlock({ ...input, stamina: 10 })).toBe(true);
  });

  it('never fires for something that cannot block at all', () => {
    const rng = createRandom(1);
    for (let i = 0; i < 50; i++) {
      expect(rollBlock({ ...input, chance: 0 }, rng)).toBe(false);
    }
  });

  it('fires about as often as its chance says', () => {
    const rng = createRandom('block');
    let fired = 0;
    for (let i = 0; i < 4000; i++) if (rollBlock(input, rng)) fired++;
    expect(fired / 4000).toBeGreaterThan(0.44);
    expect(fired / 4000).toBeLessThan(0.56);
  });
});

// ── the same rules, played out inside a real run ─────────────────────────────

const spawnCreature = (run: Run, defId: string, x: number, y: number): CreatureState => {
  const state: CreatureState = {
    defId,
    spawnKey: `test:${x}:${y}`,
    homeCx: 0,
    homeCy: 0,
    x,
    y,
    prevX: x,
    prevY: y,
    facing: 0,
    mode: 'idle',
    targetX: x,
    targetY: y,
    modeTicks: 0,
    chaseTicks: 0,
    attackCooldown: 0,
    blockCooldown: 0,
    health: CREATURES[defId].health,
    repathIn: 0,
    path: [],
    pathIndex: 0,
    noiseIn: 10_000,
  };
  run.spawn(run.creatures, state);
  return state;
};

const arm = (run: Run, itemId: string): void => {
  const def = ITEMS[itemId];
  run.inventory.stacks.push({
    id: 1,
    itemId,
    count: 1,
    x: 0,
    y: 0,
    charge: 0,
    durability: def.melee?.maxDurability ?? 0,
  });
  run.inventory.nextId = 2;
  run.inventory.hand = 1;
};

/** Drops the level's own creatures so a scenario is only what it says it is. */
const clearWorld = (run: Run): void => {
  for (const id of [...run.creatures.keys()]) run.world.destroyEntity(id);
};

const surround = (run: Run, count: number, defId = 'creature.drifter'): CreatureState[] => {
  const reach = WEAPONS.pipe.reach;
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    return spawnCreature(
      run,
      defId,
      run.player.x + Math.cos(angle) * reach * 0.5,
      run.player.y + Math.sin(angle) * reach * 0.5,
    );
  });
};

const run60 = (run: Run, ticks: number, held: string[] = []): void => {
  for (let i = 0; i < ticks; i++) run.step({ ...EMPTY_INPUT, held });
};

describe('melee inside a run', () => {
  it('attacks with no key pressed at all', () => {
    const run = new Run(createRunConfig(101));
    clearWorld(run);
    arm(run, 'item.pipe');
    const target = surround(run, 1)[0];
    const before = target.health;
    run60(run, 60);
    expect(target.health).toBeLessThan(before);
    expect(run.combat.reach).toBe(WEAPONS.pipe.reach);
  });

  it('catches every body in the ring with one swing', () => {
    const run = new Run(createRunConfig(102));
    clearWorld(run);
    arm(run, 'item.pipe');
    const targets = surround(run, 4);
    const before = targets.map((t) => t.health);
    run60(run, WEAPONS.pipe.windupTicks + 2);
    expect(targets.every((t, i) => t.health < before[i])).toBe(true);
  });

  it('makes noise, and more of it against a crowd', () => {
    const lone = new Run(createRunConfig(103));
    clearWorld(lone);
    arm(lone, 'item.pipe');
    surround(lone, 1);
    run60(lone, WEAPONS.pipe.windupTicks + 2);
    const single = lone.noise.recent().filter((e) => e.source === 'melee').at(-1);

    const crowd = new Run(createRunConfig(103));
    clearWorld(crowd);
    arm(crowd, 'item.pipe');
    surround(crowd, 5);
    run60(crowd, WEAPONS.pipe.windupTicks + 2);
    const many = crowd.noise.recent().filter((e) => e.source === 'melee').at(-1);

    expect(single).toBeDefined();
    expect(many).toBeDefined();
    expect(many?.radius ?? 0).toBeGreaterThan(single?.radius ?? 0);
  });

  it('never swings while crouching, so a player can walk past', () => {
    const run = new Run(createRunConfig(104));
    clearWorld(run);
    arm(run, 'item.pipe');
    const target = surround(run, 1)[0];
    const before = target.health;
    run60(run, 120, ['crouch']);
    expect(target.health).toBe(before);
    expect(run.stats.stamina).toBeGreaterThan(90);
  });

  it('never swings with empty hands', () => {
    const run = new Run(createRunConfig(105));
    clearWorld(run);
    const target = surround(run, 1)[0];
    const before = target.health;
    run60(run, 120);
    expect(target.health).toBe(before);
  });

  it('wears the weapon down and turns it into bare hands when it fails', () => {
    const run = new Run(createRunConfig(106));
    clearWorld(run);
    arm(run, 'item.wrench');
    run.inventory.stacks[0].durability = 1;
    run.stats.stamina = 100;
    surround(run, 1);
    run60(run, WEAPONS.wrench.windupTicks + 2);
    expect(run.inventory.stacks[0].durability).toBe(0);
    expect(run.combat.event).toBe('broke');
    run60(run, 2);
    expect(run.combat.broken).toBe(true);
    expect(run.combat.reach).toBe(WEAPONS.hands.reach);
  });

  it('misses when the target leaves during the wind-up, and still pays for it', () => {
    const run = new Run(createRunConfig(107));
    clearWorld(run);
    arm(run, 'item.pipe');
    const target = surround(run, 1)[0];
    run60(run, 1);
    expect(run.combat.windup).toBeGreaterThan(0);
    target.x += 10_000;
    const stamina = run.stats.stamina;
    run60(run, WEAPONS.pipe.windupTicks + 2);
    expect(run.combat.event).toBe('miss');
    expect(run.stats.stamina).toBeLessThan(stamina);
  });

  it('cannot sustain a swing rhythm against a crowd', () => {
    const run = new Run(createRunConfig(108));
    clearWorld(run);
    arm(run, 'item.pipe');
    const targets = surround(run, 5);
    for (const target of targets) target.health = 1_000_000;

    let swings = 0;
    let ranOut = false;
    let lastSerial = 0;
    const pinned = targets.map((target) => ({ x: target.x, y: target.y }));
    for (let i = 0; i < 600; i++) {
      // Hold the ring together: this test is about breath, not about pathing.
      targets.forEach((target, index) => {
        target.x = pinned[index].x;
        target.y = pinned[index].y;
      });
      run.stats.health = STATS.maxHealth;
      run.step(EMPTY_INPUT);
      if (run.combat.eventSerial !== lastSerial) {
        lastSerial = run.combat.eventSerial;
        if (run.combat.event === 'tired') ranOut = true;
      }
      swings += run.noise.recent().filter((e) => e.source === 'melee' && e.tick === run.tick).length;
    }
    const unlimited = 600 / (WEAPONS.pipe.intervalTicks + WEAPONS.pipe.windupTicks);
    expect(ranOut).toBe(true);
    // Breath, not the interval, is what caps the swing rate against five.
    expect(swings).toBeLessThan(unlimited / 2);
  });

  it('swallows a blocked hit whole — a lone attacker takes nothing off', () => {
    const run = new Run(createRunConfig(109));
    clearWorld(run);
    arm(run, 'item.pipe');
    const attacker = spawnCreature(run, 'creature.drifter', run.player.x, run.player.y);
    attacker.health = 1_000_000;

    let blocks = 0;
    let hitsTaken = 0;
    let serial = run.combat.eventSerial;
    for (let i = 0; i < 900; i++) {
      // Damage is clamped to the maximum, so top the bar up rather than inflate it.
      run.stats.health = STATS.maxHealth;
      const before = run.stats.health;
      run.step(EMPTY_INPUT);
      attacker.x = run.player.x;
      attacker.y = run.player.y;
      const lost = before - run.stats.health;
      const fresh = run.combat.eventSerial !== serial;
      serial = run.combat.eventSerial;
      if (fresh && run.combat.event === 'blockedByYou') {
        blocks++;
        expect(lost).toBeLessThanOrEqual(0);
      } else if (lost > 0) {
        hitsTaken++;
      }
    }
    expect(blocks).toBeGreaterThan(0);
    expect(hitsTaken).toBeGreaterThan(0);
  });

  it('blocks only one of several hits arriving on the same tick', () => {
    const run = new Run(createRunConfig(110));
    clearWorld(run);
    arm(run, 'item.pipe');
    // Sit them on top of the player so all four land together.
    const attackers = Array.from({ length: 4 }, (_, i) =>
      spawnCreature(run, 'creature.drifter', run.player.x + i * 0.5, run.player.y),
    );
    for (const attacker of attackers) attacker.health = 1_000_000;
    const damage = CREATURES['creature.drifter'].damage;

    let blockedTicks = 0;
    let plainTicks = 0;
    let serial = run.combat.eventSerial;
    for (let i = 0; i < 900; i++) {
      // Every attacker ready, every attacker touching: four hits per tick.
      for (const attacker of attackers) {
        attacker.attackCooldown = 0;
        attacker.x = run.player.x;
        attacker.y = run.player.y;
      }
      // Damage is clamped to the maximum, so top the bar up rather than inflate it.
      run.stats.health = STATS.maxHealth;
      const before = run.stats.health;
      run.step(EMPTY_INPUT);
      const lost = before - run.stats.health;
      const blocked = run.combat.eventSerial !== serial && run.combat.event === 'blockedByYou';
      serial = run.combat.eventSerial;
      // Health regen runs in the same tick, hence the tolerance rather than ===.
      if (blocked) {
        blockedTicks++;
        expect(lost).toBeCloseTo(damage * (attackers.length - 1), 1);
      } else {
        plainTicks++;
        expect(lost).toBeCloseTo(damage * attackers.length, 1);
      }
    }
    expect(blockedTicks).toBeGreaterThan(0);
    expect(plainTicks).toBeGreaterThan(0);
  });
});

describe('the shape of a fight', () => {
  const fight = (count: number, defId = 'creature.drifter'): Run => {
    const run = new Run(createRunConfig(1234));
    clearWorld(run);
    arm(run, 'item.pipe');
    const targets = surround(run, count, defId);
    for (const target of targets) target.mode = 'chase';
    for (let i = 0; i < 900 && run.phase === 'alive'; i++) {
      // Bodies that are still alive keep pressing in.
      for (const creature of run.creatures.values()) {
        creature.x = run.player.x + (creature.x - run.player.x) * 0.6;
        creature.y = run.player.y + (creature.y - run.player.y) * 0.6;
      }
      run.step(EMPTY_INPUT);
      if (run.creatures.size === 0) break;
    }
    return run;
  };

  it('lets a player win against two, expensively', () => {
    const run = fight(2);
    expect(run.phase).toBe('alive');
    expect(run.creatures.size).toBe(0);
    expect(run.stats.health).toBeLessThan(STATS.maxHealth);
  });

  it('kills a player surrounded by five', () => {
    expect(fight(5).phase).toBe('dead');
  });

  it('kills a player who trades blows with a hound', () => {
    expect(fight(1, 'creature.hound').phase).toBe('dead');
  });
});
