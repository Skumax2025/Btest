/**
 * L1: A* over the tile grid.
 *
 * Budgeted by node count rather than time, so the same request always expands
 * the same nodes — pathfinding must never be a source of divergence. Ties break
 * on insertion order, which keeps the heap deterministic too.
 */

import type { SolidSampler } from './collision';

interface HeapEntry {
  readonly key: number;
  readonly score: number;
  readonly order: number;
}

class MinHeap {
  private readonly items: HeapEntry[] = [];

  get size(): number {
    return this.items.length;
  }

  push(entry: HeapEntry): void {
    this.items.push(entry);
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (!this.less(this.items[index], this.items[parent])) break;
      this.swap(index, parent);
      index = parent;
    }
  }

  pop(): HeapEntry | undefined {
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0 && last) {
      this.items[0] = last;
      let index = 0;
      for (;;) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < this.items.length && this.less(this.items[left], this.items[smallest])) {
          smallest = left;
        }
        if (right < this.items.length && this.less(this.items[right], this.items[smallest])) {
          smallest = right;
        }
        if (smallest === index) break;
        this.swap(index, smallest);
        index = smallest;
      }
    }
    return top;
  }

  private less(a: HeapEntry, b: HeapEntry): boolean {
    return a.score === b.score ? a.order < b.order : a.score < b.score;
  }

  private swap(a: number, b: number): void {
    const tmp = this.items[a];
    this.items[a] = this.items[b];
    this.items[b] = tmp;
  }
}

const KEY_OFFSET = 0x8000;
const packKey = (tx: number, ty: number): number => (tx + KEY_OFFSET) * 0x10000 + (ty + KEY_OFFSET);
const unpackX = (key: number): number => Math.floor(key / 0x10000) - KEY_OFFSET;
const unpackY = (key: number): number => (key % 0x10000) - KEY_OFFSET;

const NEIGHBOURS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

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

  const open = new MinHeap();
  const cameFrom = new Map<number, number>();
  const costSoFar = new Map<number, number>();
  const startKey = packKey(startTx, startTy);
  const goalKey = packKey(goalTx, goalTy);
  costSoFar.set(startKey, 0);
  open.push({ key: startKey, score: 0, order: 0 });

  let order = 1;
  let expanded = 0;
  while (open.size > 0 && expanded < maxNodes) {
    const current = open.pop();
    if (!current) break;
    if (current.key === goalKey) return rebuild(cameFrom, goalKey);
    expanded++;
    const cx = unpackX(current.key);
    const cy = unpackY(current.key);
    const baseCost = costSoFar.get(current.key) ?? 0;

    for (const [dx, dy, step] of NEIGHBOURS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (isSolid(nx, ny)) continue;
      // No cutting corners: a diagonal needs both orthogonal neighbours open.
      if (dx !== 0 && dy !== 0 && (isSolid(cx + dx, cy) || isSolid(cx, cy + dy))) continue;
      const key = packKey(nx, ny);
      const cost = baseCost + step;
      const known = costSoFar.get(key);
      if (known !== undefined && known <= cost) continue;
      costSoFar.set(key, cost);
      cameFrom.set(key, current.key);
      const heuristic = Math.hypot(goalTx - nx, goalTy - ny);
      open.push({ key, score: cost + heuristic, order: order++ });
    }
  }
  return null;
};

const rebuild = (cameFrom: Map<number, number>, goalKey: number): number[] => {
  const keys: number[] = [];
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
