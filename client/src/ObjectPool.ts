export class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;

  constructor(factory: () => T, reset: (obj: T) => void, initialSize?: number) {
    this.factory = factory;
    this.reset = reset;

    // Pre-allocate objects if initialSize is provided
    if (initialSize !== undefined) {
      for (let i = 0; i < initialSize; i++) {
        this.pool.push(this.factory());
      }
    }
  }

  /** Acquire an object from the pool (creates new if empty) */
  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.factory();
  }

  /** Release an object back to the pool */
  release(obj: T): void {
    this.reset(obj);
    this.pool.push(obj);
  }

  /** Get current pool size (available objects) */
  get available(): number {
    return this.pool.length;
  }
}
