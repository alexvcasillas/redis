import { snapshotManager } from "../persistence/snapshot-manager";
import { debug } from "../utils/debug";
import { TTLManager } from "./ttl";

// Threshold for when to perform lazy cleanup
const LAZY_CLEANUP_THRESHOLD = 1000;
// Maximum number of expired keys to clean up in one pass
const MAX_CLEANUP_BATCH = 100;

/**
 * Simple in-memory key-value store with snapshot persistence.
 * Stores values as Buffers for efficiency.
 */
export class KeyValueStore {
	private ttlStore: Map<string, Buffer>;
	private permanentStore: Map<string, Buffer>;
	private ttlManager: TTLManager;
	private dirty = 0; // Number of changes since last save
	private expiredCount = 0; // Counter for potentially expired keys

	constructor() {
		this.ttlStore = new Map<string, Buffer>();
		this.permanentStore = new Map<string, Buffer>();
		this.ttlManager = new TTLManager({
			onDelete: (key) => this.delete(key),
		});
		snapshotManager.setStore(this);
		debug.log(
			"In-memory store initialized with separate TTL and permanent stores.",
		);
	}

	/**
	 * Performs lazy cleanup of expired keys if needed
	 */
	private cleanupExpired(): void {
		if (this.expiredCount < LAZY_CLEANUP_THRESHOLD) {
			return;
		}

		debug.log(`Starting cleanup of expired keys (count: ${this.expiredCount})`);
		let cleaned = 0;
		for (const [key] of this.ttlStore) {
			if (cleaned >= MAX_CLEANUP_BATCH) {
				break;
			}
			if (this.ttlManager.isExpired(key)) {
				this.delete(key);
				cleaned++;
			}
		}
		this.expiredCount = Math.max(0, this.expiredCount - cleaned);
		debug.log(
			`Cleaned up ${cleaned} expired keys, remaining: ${this.expiredCount}`,
		);
	}

	/**
	 * Retrieves the value (Buffer) associated with a key.
	 * Returns undefined if the key doesn't exist or has expired.
	 */
	get(key: string): Buffer | undefined {
		// First check permanent store (no TTL check needed)
		const permanentValue = this.permanentStore.get(key);
		if (permanentValue) {
			debug.log(`Retrieved permanent key: ${key}`);
			return permanentValue;
		}

		// Then check TTL store
		const ttlValue = this.ttlStore.get(key);
		if (!ttlValue) {
			debug.log(`Key not found: ${key}`);
			return undefined;
		}

		if (this.ttlManager.isExpired(key)) {
			debug.log(`Key expired: ${key}`);
			this.delete(key);
			this.expiredCount++;
			return undefined;
		}

		debug.log(`Retrieved TTL key: ${key}`);
		return ttlValue;
	}

	/**
	 * Stores a key-value pair with an optional TTL.
	 * @param key The key to store
	 * @param value The value to store
	 * @param ttlSeconds Optional TTL in seconds (Redis compatible)
	 */
	set(key: string, value: Buffer, ttlSeconds?: number): void {
		// Remove from both stores to handle moves between TTL/non-TTL
		this.permanentStore.delete(key);
		this.ttlStore.delete(key);

		if (ttlSeconds !== undefined) {
			this.ttlStore.set(key, value);
			this.ttlManager.expire(key, ttlSeconds);
			debug.log(`Set TTL key: ${key} with TTL: ${ttlSeconds}s`);
		} else {
			this.permanentStore.set(key, value);
			this.ttlManager.persist(key);
			debug.log(`Set permanent key: ${key}`);
		}

		this.dirty++;
		this.cleanupExpired();
	}

	/**
	 * Sets or updates the TTL for a key.
	 * @param key The key to set TTL for
	 * @param seconds TTL in seconds (Redis compatible)
	 * @returns true if the TTL was set, false if the key doesn't exist
	 */
	expire(key: string, seconds: number): boolean {
		if (!this.ttlStore.has(key)) {
			debug.log(`Cannot set TTL: key not found: ${key}`);
			return false;
		}

		debug.log(`Setting TTL for key: ${key} to ${seconds}s`);
		this.ttlManager.expire(key, seconds);
		this.dirty++;
		return true;
	}

	/**
	 * Sets or updates the TTL for a key using millisecond precision.
	 * @param key The key to set TTL for
	 * @param milliseconds TTL in milliseconds (Redis compatible)
	 * @returns true if the TTL was set, false if the key doesn't exist
	 */
	pexpire(key: string, milliseconds: number): boolean {
		const value = this.get(key);
		if (!value) {
			return false;
		}

		// Move to TTL store if in permanent store
		if (this.permanentStore.has(key)) {
			this.permanentStore.delete(key);
			this.ttlStore.set(key, value);
		}

		this.ttlManager.pexpire(key, milliseconds);
		this.dirty++;
		return true;
	}

	/**
	 * Gets the remaining TTL for a key in seconds (Redis compatible).
	 * @param key The key to get TTL for
	 * @returns
	 *   -2 if the key does not exist
	 *   -1 if the key exists but has no associated expiration
	 *   Otherwise, TTL in seconds
	 */
	ttl(key: string): number {
		// Check if key exists in permanent store (no TTL)
		if (this.permanentStore.has(key)) {
			return -1;
		}
		// Check if key exists in TTL store
		if (!this.ttlStore.has(key)) {
			return -2;
		}
		return this.ttlManager.ttl(key);
	}

	/**
	 * Gets the remaining TTL for a key in milliseconds (Redis compatible).
	 * @param key The key to get TTL for
	 * @returns
	 *   -2 if the key does not exist
	 *   -1 if the key exists but has no associated expiration
	 *   Otherwise, TTL in milliseconds
	 */
	pttl(key: string): number {
		// Check if key exists in permanent store (no TTL)
		if (this.permanentStore.has(key)) {
			return -1;
		}
		// Check if key exists in TTL store
		if (!this.ttlStore.has(key)) {
			return -2;
		}
		return this.ttlManager.pttl(key);
	}

	/**
	 * Removes the TTL from a key.
	 * @param key The key to persist
	 * @returns true if the TTL was removed, false if key doesn't exist or had no TTL
	 */
	persist(key: string): boolean {
		if (!this.ttlStore.has(key)) {
			return false;
		}

		const hadTTL = this.ttlManager.persist(key);
		if (hadTTL) {
			this.dirty++;
		}
		return hadTTL;
	}

	/**
	 * Deletes a key-value pair and its TTL if exists.
	 * Returns true if a key was deleted, false otherwise.
	 */
	delete(key: string): boolean {
		const deletedFromTTL = this.ttlStore.delete(key);
		const deletedFromPermanent = this.permanentStore.delete(key);

		if (deletedFromTTL || deletedFromPermanent) {
			this.ttlManager.delete(key);
			this.dirty++;
			debug.log(`Deleted key: ${key}`);
			return true;
		}

		debug.log(`Key not found for deletion: ${key}`);
		return false;
	}

	getDirtyCount(): number {
		return this.dirty;
	}

	/**
	 * Gets the last save time.
	 * Returns null if there are dirty changes or if no save has occurred yet.
	 */
	getLastSaveTime(): Date | null {
		if (this.dirty > 0 || !snapshotManager.getLastSaveTime()) {
			return null;
		}
		return snapshotManager.getLastSaveTime();
	}

	/**
	 * Gets the internal store for snapshot saving.
	 * @internal Used by SnapshotManager
	 */
	getStore(): Map<string, Buffer> {
		// Combine both stores for snapshot
		const combined = new Map<string, Buffer>();
		for (const [key, value] of this.permanentStore) {
			combined.set(key, value);
		}
		for (const [key, value] of this.ttlStore) {
			combined.set(key, value);
		}
		return combined;
	}

	/**
	 * Loads the store state from a snapshot.
	 * @internal Used by SnapshotManager
	 */
	loadFromSnapshot(loadedStore: Map<string, Buffer>): void {
		this.permanentStore.clear();
		this.ttlStore.clear();

		// All keys from snapshot go to permanent store initially
		for (const [key, value] of loadedStore) {
			this.permanentStore.set(key, value);
		}

		this.ttlManager.clear();
		this.dirty = 0;
		this.expiredCount = 0;
		debug.log("Store loaded from snapshot successfully");
	}

	/**
	 * Saves the current state to a snapshot file.
	 * @param filePath The path to save the snapshot to
	 */
	saveSnapshot(filePath: string): void {
		// Clean up expired keys before saving
		this.cleanupExpired();

		// Save snapshot using the snapshot manager
		snapshotManager.setStore(this);
		snapshotManager.saveSnapshot(filePath);
		this.dirty = 0;
	}

	/**
	 * Loads the store state from a snapshot file.
	 * @param filePath The path to load the snapshot from
	 */
	loadSnapshot(filePath: string): void {
		// Clean up current state
		this.permanentStore.clear();
		this.ttlStore.clear();
		this.ttlManager.clear();
		this.dirty = 0;
		this.expiredCount = 0;

		// Set this store in the snapshot manager and load
		snapshotManager.setStore(this);
		snapshotManager.loadInitialSnapshot();

		debug.log("Store loaded from snapshot successfully");
	}

	/**
	 * Cleans up resources used by the store.
	 * Should be called when shutting down the server.
	 */
	dispose(): void {
		debug.log("Disposing store and cleaning up resources");
		this.ttlManager.dispose();
		this.ttlStore.clear();
		this.permanentStore.clear();
		this.expiredCount = 0;
	}

	// Optional: Add methods for other commands like EXISTS, KEYS etc. later
}

// Export a singleton instance for the application to use
// The loading logic will be called on this instance from server.ts at startup.
export const store = new KeyValueStore();
