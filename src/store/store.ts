/**
 * Simple in-memory key-value store.
 * Stores values as Buffers for efficiency.
 */
export class KeyValueStore {
  private store: Map<string, Buffer>;

  constructor() {
    this.store = new Map<string, Buffer>();
    console.log("In-memory store initialized.");
  }

  /**
   * Retrieves the value (Buffer) associated with a key.
   * Returns undefined if the key doesn't exist.
   * TODO: Implement TTL logic here or in a wrapper.
   */
  get(key: string): Buffer | undefined {
    // TODO: Check TTL before returning
    return this.store.get(key);
  }

  /**
   * Stores a key-value pair.
   * TODO: Handle TTL options (EX, PX).
   */
  set(key: string, value: Buffer /*, ttl?: number */): void {
    this.store.set(key, value);
    // TODO: Set TTL if provided
  }

  /**
   * Deletes a key-value pair.
   * Returns true if a key was deleted, false otherwise.
   */
  delete(key: string): boolean {
    // TODO: Clear associated TTL
    return this.store.delete(key);
  }

  // Optional: Add methods for other commands like EXISTS, KEYS etc. later
}

// Export a singleton instance for the application to use
export const store = new KeyValueStore();
