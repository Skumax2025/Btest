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
    name: 'Drifter',
    archetype: 'wanderer',
    sprite: 'creature.drifter',
    radius: 13,
    walkSpeed: 46,
    chaseSpeed: 74,
    hearingThreshold: 0.22,
    sightRange: 0,
    sightHalfAngle: 0,
    loseInterestTicks: 260,
    staminaTicks: 100000,
    restTicks: 0,
    damage: 14,
    attackRange: 22,
    attackCooldownTicks: 48,
    health: 60,
    noiseRadius: 120,
    telegraphRadius: 0,
    sanityRadius: 220,
    killsOnContact: false,
    wanderRange: 280,
  },
  'creature.hound': {
    id: 'creature.hound',
    name: 'Hound',
    archetype: 'hunter',
    sprite: 'creature.hound',
    radius: 12,
    walkSpeed: 72,
    // Faster than a sprint, but only for a while: breaking line of sight and
    // outlasting it is the intended answer, never a straight race.
    chaseSpeed: 182,
    hearingThreshold: 0.14,
    sightRange: 390,
    sightHalfAngle: 1.05,
    loseInterestTicks: 200,
    staminaTicks: 420,
    restTicks: 300,
    damage: 22,
    attackRange: 26,
    attackCooldownTicks: 40,
    health: 45,
    noiseRadius: 180,
    telegraphRadius: 0,
    sanityRadius: 300,
    killsOnContact: false,
    wanderRange: 420,
  },
  'creature.bloom': {
    id: 'creature.bloom',
    name: 'Bloom',
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
    // Cannot be cleared by hitting it; the answer is to notice it and go around.
    health: 100000,
    noiseRadius: 96,
    telegraphRadius: 160,
    sanityRadius: 180,
    killsOnContact: true,
    wanderRange: 0,
  },
};
