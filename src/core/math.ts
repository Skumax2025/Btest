/** L0: pure scalar/vector helpers. Knows nothing about the game. */

export interface Vec2 {
  x: number;
  y: number;
}

export const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const length = (x: number, y: number): number => Math.sqrt(x * x + y * y);

export const distance = (ax: number, ay: number, bx: number, by: number): number =>
  length(bx - ax, by - ay);

export const distanceSq = (ax: number, ay: number, bx: number, by: number): number => {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
};

export const normalize = (x: number, y: number): Vec2 => {
  const len = length(x, y);
  return len === 0 ? { x: 0, y: 0 } : { x: x / len, y: y / len };
};

/** Shortest signed difference between two angles, in radians. */
export const angleDelta = (from: number, to: number): number => {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
};

/** Frame-rate independent approach: moves `current` toward `target` by `rate` per second. */
export const approach = (current: number, target: number, maxDelta: number): number => {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
};

/** Euclidean modulo: result always has the sign of `m`. */
export const mod = (n: number, m: number): number => ((n % m) + m) % m;

/** Integer floor division, correct for negative operands. */
export const floorDiv = (n: number, m: number): number => Math.floor(n / m);

export const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};
