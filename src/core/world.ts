/**
 * L0: entity + component storage.
 *
 * Components are plain JSON-serializable objects held in named stores. Iteration
 * follows insertion order, which is deterministic for a deterministic sequence
 * of operations — that is what the determinism test relies on.
 */

export type EntityId = number;

export interface ComponentSnapshot {
  readonly name: string;
  readonly entries: ReadonlyArray<readonly [EntityId, unknown]>;
}

export interface WorldSnapshot {
  readonly nextId: EntityId;
  readonly alive: readonly EntityId[];
  readonly components: readonly ComponentSnapshot[];
}

export class ComponentStore<T> {
  private readonly data = new Map<EntityId, T>();

  constructor(readonly name: string) {}

  get size(): number {
    return this.data.size;
  }

  has(entity: EntityId): boolean {
    return this.data.has(entity);
  }

  get(entity: EntityId): T | undefined {
    return this.data.get(entity);
  }

  /** Throws when absent — for call sites where the component is an invariant. */
  require(entity: EntityId): T {
    const value = this.data.get(entity);
    if (value === undefined) {
      throw new Error(`entity ${entity} has no component "${this.name}"`);
    }
    return value;
  }

  set(entity: EntityId, value: T): T {
    this.data.set(entity, value);
    return value;
  }

  remove(entity: EntityId): void {
    this.data.delete(entity);
  }

  entries(): IterableIterator<[EntityId, T]> {
    return this.data.entries();
  }

  keys(): IterableIterator<EntityId> {
    return this.data.keys();
  }

  values(): IterableIterator<T> {
    return this.data.values();
  }

  clear(): void {
    this.data.clear();
  }
}

export class World {
  private readonly stores = new Map<string, ComponentStore<unknown>>();
  private readonly aliveSet = new Set<EntityId>();
  private nextId: EntityId = 1;

  get entityCount(): number {
    return this.aliveSet.size;
  }

  createEntity(): EntityId {
    const id = this.nextId++;
    this.aliveSet.add(id);
    return id;
  }

  isAlive(entity: EntityId): boolean {
    return this.aliveSet.has(entity);
  }

  destroyEntity(entity: EntityId): void {
    if (!this.aliveSet.delete(entity)) return;
    for (const store of this.stores.values()) store.remove(entity);
  }

  /** Returns the named store, creating it on first use. */
  store<T>(name: string): ComponentStore<T> {
    const existing = this.stores.get(name);
    if (existing) return existing as ComponentStore<T>;
    const created = new ComponentStore<T>(name);
    this.stores.set(name, created as ComponentStore<unknown>);
    return created;
  }

  entities(): IterableIterator<EntityId> {
    return this.aliveSet.values();
  }

  clear(): void {
    for (const store of this.stores.values()) store.clear();
    this.aliveSet.clear();
    this.nextId = 1;
  }

  serialize(): WorldSnapshot {
    const components: ComponentSnapshot[] = [];
    for (const [name, store] of this.stores) {
      const entries: Array<readonly [EntityId, unknown]> = [];
      for (const [entity, value] of store.entries()) entries.push([entity, value]);
      components.push({ name, entries });
    }
    return { nextId: this.nextId, alive: [...this.aliveSet], components };
  }

  restore(snapshot: WorldSnapshot): void {
    this.clear();
    this.nextId = snapshot.nextId;
    for (const id of snapshot.alive) this.aliveSet.add(id);
    for (const component of snapshot.components) {
      const store = this.store<unknown>(component.name);
      for (const [entity, value] of component.entries) store.set(entity, value);
    }
  }
}
