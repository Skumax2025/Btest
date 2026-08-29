/**
 * L2: everything a run needs handed to it from outside. Content (L3) builds one
 * of these; the run itself contains no numbers and no data tables.
 */

import type { LevelGeometry, LevelSpec, StreamOptions } from '@game/level';
import type { PlayerConfig } from '@game/player';

/** Names of the input actions the simulation reacts to. */
export interface ActionNames {
  readonly sprint: string;
  readonly crouch: string;
  readonly interact: string;
  readonly use: string;
  readonly attack: string;
  readonly throwItem: string;
  readonly drop: string;
  readonly flashlight: string;
}

export interface RunConfig {
  readonly seed: number;
  readonly levels: readonly LevelSpec[];
  readonly geometry: LevelGeometry;
  readonly stream: StreamOptions;
  readonly player: PlayerConfig;
  readonly actions: ActionNames;
  /** Length of one simulation step in seconds. */
  readonly stepSeconds: number;
  /** Cell size of the static prop index, in world units. */
  readonly propCellSize: number;
}
