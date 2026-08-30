/** L0: pure scalar/vector helpers. Knows nothing about the game. */

export const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const length = (x: number, y: number): number => Math.sqrt(x * x + y * y);

export const distance = (ax: number, ay: number, bx: number, by: number): number =>
  length(bx - ax, by - ay);



/** Shortest signed difference between two angles, in radians. */
export const angleDelta = (from: number, to: number): number => {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
};


/** Euclidean modulo: result always has the sign of `m`. */
export const mod = (n: number, m: number): number => ((n % m) + m) % m;

/** Integer floor division, correct for negative operands. */
export const floorDiv = (n: number, m: number): number => Math.floor(n / m);

