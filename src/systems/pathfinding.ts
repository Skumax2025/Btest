/**
 * L1: A* over the tile grid.
 *
 * Budgeted by node count rather than time, so the same request always expands
 * the same nodes — pathfinding must never be a source of divergence. Ties break
 * on insertion order, which keeps the heap deterministic too.
 *
 * Every structure here is allocated once and reused. A search runs several times
 * a tick with a crowd on screen, and three fresh containers plus an object per
 * pushed node was, on a profile, most of what the collector had to do. Reuse is
 * safe because a search never yields: nothing can start a second one while this
 * one is running, and each call clears what it inherits.
 */

import type { SolidSampler } from './collision';

/**
 * The open set, as three parallel arrays rather than an array of entries. Same
 * heap, same order, no object per node.
 */
class MinHeap {
  /**
   * Keys are packed tile coordinates and run past what an Int32 holds, so the
   * store is a Float64Array: every packed key is an exact integer in it.
   */
  private keys: Float64Array = new Float64Array(256);
  private scores: Float64Array = new Float64Array(256);
  private orders: Int32Array = new Int32Array(256);
  private length = 0;

  get size(): number {
    return this.length;
  }

  clear(): void {
    this.length = 0;
  }

  push(key: number, score: number, order: number): void {
    if (this.length === this.keys.length) this.grow();
    let index = this.length++;
    this.keys[index] = key;
    this.scores[index] = score;
    this.orders[index] = order;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (!this.less(index, parent)) break;
      this.swap(index, parent);
      index = parent;
    }
  }

  /** Pops the smallest and leaves its key in `topKey`. */
  pop(): number {
    const top = this.keys[0];
    const last = --this.length;
    if (last > 0) {
      this.keys[0] = this.keys[last];
      this.scores[0] = this.scores[last];
      this.orders[0] = this.orders[last];
      let index = 0;
      for (;;) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < this.length && this.less(left, smallest)) smallest = left;
        if (right < this.length && this.less(right, smallest)) smallest = right;
        if (smallest === index) break;
        this.swap(index, smallest);
        index = smallest;
      }
    }
    return top;
  }

  private less(a: number, b: number): boolean {
    return this.scores[a] === this.scores[b]
      ? this.orders[a] < this.orders[b]
      : this.scores[a] < this.scores[b];
  }

  private swap(a: number, b: number): void {
    const key = this.keys[a];
    this.keys[a] = this.keys[b];
    this.keys[b] = key;
    const score = this.scores[a];
    this.scores[a] = this.scores[b];
    this.scores[b] = score;
    const order = this.orders[a];
    this.orders[a] = this.orders[b];
    this.orders[b] = order;
  }

  private grow(): void {
    const keys = new Float64Array(this.keys.length * 2);
    keys.set(this.keys);
    this.keys = keys;
    const scores = new Float64Array(this.scores.length * 2);
    scores.set(this.scores);
    this.scores = scores;
    const orders = new Int32Array(this.orders.length * 2);
    orders.set(this.orders);
    this.orders = orders;
  }
}

const KEY_OFFSET = 0x8000;
const packKey = (tx: number, ty: number): number => (tx + KEY_OFFSET) * 0x10000 + (ty + KEY_OFFSET);
const unpackX = (key: number): number => Math.floor(key / 0x10000) - KEY_OFFSET;
const unpackY = (key: number): number => (key % 0x10000) - KEY_OFFSET;

/** Neighbour offsets and their step costs, flattened so the loop allocates nothing. */
const NEIGHBOURS = [
  1, 0, 1,
  -1, 0, 1,
  0, 1, 1,
  0, -1, 1,
  1, 1, Math.SQRT2,
  1, -1, Math.SQRT2,
  -1, 1, Math.SQRT2,
  -1, -1, Math.SQRT2,
];

const open = new MinHeap();
const cameFrom = new Map<number, number>();
const costSoFar = new Map<number, number>();
const keys: number[] = [];

/**
 * Returns a flat [tx0, ty0, tx1, ty1, ...] path from start to goal, or null when
 * the goal is unreachable inside the node budget. The start tile is not included.
 */
export const findPath = (
  startTx: number,
  startTy: number,
  goalTx: number,
  goalTy: number,
  isSolid: SolidSampler,
  maxNodes: number,
): number[] | null => {
  if (startTx === goalTx && startTy === goalTy) return [];
  if (isSolid(goalTx, goalTy)) return null;

  open.clear();
  cameFrom.clear();
  costSoFar.clear();
  const startKey = packKey(startTx, startTy);
  const goalKey = packKey(goalTx, goalTy);
  costSoFar.set(startKey, 0);
  open.push(startKey, 0, 0);

  let order = 1;
  let expanded = 0;
  while (open.size > 0 && expanded < maxNodes) {
    const current = open.pop();
    if (current === goalKey) return rebuild(goalKey);
    expanded++;
    const cx = unpackX(current);
    const cy = unpackY(current);
    const baseCost = costSoFar.get(current) ?? 0;

    for (let i = 0; i < NEIGHBOURS.length; i += 3) {
      const dx = NEIGHBOURS[i];
      const dy = NEIGHBOURS[i + 1];
      const nx = cx + dx;
      const ny = cy + dy;
      if (isSolid(nx, ny)) continue;
      // No cutting corners: a diagonal needs both orthogonal neighbours open.
      if (dx !== 0 && dy !== 0 && (isSolid(cx + dx, cy) || isSolid(cx, cy + dy))) continue;
      const key = packKey(nx, ny);
      const cost = baseCost + NEIGHBOURS[i + 2];
      const known = costSoFar.get(key);
      if (known !== undefined && known <= cost) continue;
      costSoFar.set(key, cost);
      cameFrom.set(key, current);
      const hx = goalTx - nx;
      const hy = goalTy - ny;
      open.push(key, cost + Math.sqrt(hx * hx + hy * hy), order++);
    }
  }
  return null;
};

const rebuild = (goalKey: number): number[] => {
  keys.length = 0;
  let key: number | undefined = goalKey;
  while (key !== undefined) {
    keys.push(key);
    key = cameFrom.get(key);
  }
  // Reverse by node, not by number: the output is flat [tx, ty, tx, ty, ...].
  // Drop the last key on the way out — a walker already stands on the start.
  const path: number[] = [];
  for (let i = keys.length - 2; i >= 0; i--) path.push(unpackX(keys[i]), unpackY(keys[i]));
  return path;
};
