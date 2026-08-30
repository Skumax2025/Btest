/**
 * L1: circle-versus-tile-grid collision.
 *
 * The grid is reached through a sampler callback, so this file has no idea
 * where tiles come from — chunks, a test fixture or a fixed array all work.
 */

export type SolidSampler = (tx: number, ty: number) => boolean;

export interface MoveResult {
  readonly x: number;
  readonly y: number;
  readonly hitX: boolean;
  readonly hitY: boolean;
}

const overlapsSolid = (
  x: number,
  y: number,
  radius: number,
  tileSize: number,
  isSolid: SolidSampler,
): boolean => {
  const minTx = Math.floor((x - radius) / tileSize);
  const maxTx = Math.floor((x + radius) / tileSize);
  const minTy = Math.floor((y - radius) / tileSize);
  const maxTy = Math.floor((y + radius) / tileSize);
  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (!isSolid(tx, ty)) continue;
      const left = tx * tileSize;
      const top = ty * tileSize;
      const closestX = Math.min(Math.max(x, left), left + tileSize);
      const closestY = Math.min(Math.max(y, top), top + tileSize);
      const dx = x - closestX;
      const dy = y - closestY;
      if (dx * dx + dy * dy < radius * radius) return true;
    }
  }
  return false;
};

export const isBlocked = overlapsSolid;

/**
 * Moves a circle one step, resolving each axis separately so the body slides
 * along walls instead of sticking to them.
 */
export const moveCircle = (
  x: number,
  y: number,
  radius: number,
  dx: number,
  dy: number,
  tileSize: number,
  isSolid: SolidSampler,
): MoveResult => {
  let nextX = x;
  let nextY = y;
  let hitX = false;
  let hitY = false;
  if (dx !== 0) {
    if (overlapsSolid(x + dx, y, radius, tileSize, isSolid)) hitX = true;
    else nextX = x + dx;
  }
  if (dy !== 0) {
    if (overlapsSolid(nextX, y + dy, radius, tileSize, isSolid)) hitY = true;
    else nextY = y + dy;
  }
  return { x: nextX, y: nextY, hitX, hitY };
};

/** Nudges a body out of geometry it is already stuck inside. */
export const unstick = (
  x: number,
  y: number,
  radius: number,
  tileSize: number,
  isSolid: SolidSampler,
  maxRings: number,
): { x: number; y: number } => {
  if (!overlapsSolid(x, y, radius, tileSize, isSolid)) return { x, y };
  const step = tileSize / 2;
  for (let ring = 1; ring <= maxRings; ring++) {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const testX = x + Math.cos(angle) * step * ring;
      const testY = y + Math.sin(angle) * step * ring;
      if (!overlapsSolid(testX, testY, radius, tileSize, isSolid)) return { x: testX, y: testY };
    }
  }
  return { x, y };
};
