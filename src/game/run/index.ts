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
export type { ActionNames, RunConfig } from './config';
