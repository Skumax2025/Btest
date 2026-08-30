/**
 * L3: the creature catalogue.
 *
 * Three archetypes, deliberately: one that only hears, one that hunts, and one
 * that never moves at all. To add a creature, add an entry here, a sprite spec
 * with the same `sprite` id, and put its id in a level's `creatures` list.
 */

import type { CreatureCatalog } from '@game/ai';

export const CREATURES: CreatureCatalog = {
  'creature.drifter': {
    id: 'creature.drifter',
    nameKey: 'creature.creature.drifter.name',
    archetype: 'wanderer',
    sprite: 'creature.drifter',
    radius: 13,
    walkSpeed: 46,
    chaseSpeed: 74,
    hearingThreshold: 0.17,
    sightRange: 0,
    sightHalfAngle: 0,
    loseInterestTicks: 260,
    staminaTicks: 100000,
    restTicks: 0,
    damage: 14,
    attackRange: 22,
    attackCooldownTicks: 48,
    blockChance: 0,
    blockCooldownTicks: 120,
    health: 60,
    noiseRadius: 120,
    telegraphRadius: 0,
    sanityRadius: 220,
    killsOnContact: false,
    wanderRange: 280,
    wanderMinFactor: 0.35,
  },
  'creature.hound': {
    id: 'creature.hound',
    nameKey: 'creature.creature.hound.name',
    archetype: 'hunter',
    sprite: 'creature.hound',
    radius: 12,
    walkSpeed: 72,
    // Faster than a sprint, but only for a while: breaking line of sight and
    // outlasting it is the intended answer, never a straight race.
    chaseSpeed: 182,
    hearingThreshold: 0.1,
    sightRange: 390,
    sightHalfAngle: 1.05,
    loseInterestTicks: 200,
    staminaTicks: 420,
    restTicks: 300,
    damage: 32,
    attackRange: 26,
    attackCooldownTicks: 30,
    // Deliberately more health than a good weapon can chew through before the
    // hound finishes you: trading blows with a hunter is never the answer.
    blockChance: 0.12,
    blockCooldownTicks: 90,
    health: 190,
    noiseRadius: 180,
    telegraphRadius: 0,
    sanityRadius: 300,
    killsOnContact: false,
    wanderRange: 420,
    wanderMinFactor: 0.3,
  },
  'creature.bloom': {
    id: 'creature.bloom',
    nameKey: 'creature.creature.bloom.name',
    archetype: 'sentinel',
    sprite: 'creature.bloom',
    radius: 17,
    walkSpeed: 0,
    chaseSpeed: 0,
    hearingThreshold: 1.1,
    sightRange: 0,
    sightHalfAngle: 0,
    loseInterestTicks: 0,
    staminaTicks: 0,
    restTicks: 0,
    damage: 100,
    attackRange: 30,
    attackCooldownTicks: 60,
    blockChance: 0,
    blockCooldownTicks: 0,
    // Cannot be cleared by hitting it; the answer is to notice it and go around.
    health: 100000,
    noiseRadius: 96,
    telegraphRadius: 160,
    sanityRadius: 180,
    killsOnContact: true,
    wanderRange: 0,
    wanderMinFactor: 0,
  },
};
