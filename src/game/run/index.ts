/**
 * L2 module: run.
 *
 * Knows: the fixed-step order of the whole simulation and how one playthrough
 * begins, advances and ends.
 *
 * Does not know: anything about drawing, input devices, storage or real time.
 * A run is driven by feeding it `InputFrame`s, which is exactly what the
 * determinism test does without a browser.
 */

export { Run } from './run';
export type { RunPhase } from './run';
export {
  defaultSlotFor,
  dropStack,
  equipStack,
  nearestInteractable,
  unequipStack,
  useStack,
} from './actions';
export type { Interactable } from './actions';
export { SAVE_VERSION, restoreRun, snapshotRun } from './save';
export type { RunSave } from './save';
export type {
  ActionNames,
  InteractionConfig,
  NoiseConfig,
  SandboxConfig,
  RunConfig,
  RunContent,
} from './config';
export type {
  Beacon,
  CombatEvent,
  CombatState,
  GroundItem,
  HintKey,
  LastingEffect,
  Projectile,
  RunWorld,
  SearchProgress,
} from './world-access';
export type { Perception } from './perception';
