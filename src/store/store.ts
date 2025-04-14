import { snapshotManager } from "../persistence/snapshot";
import { TTLManager } from "./ttl";
import { debug } from "../utils/debug";

// Threshold for when to perform lazy cleanup
const LAZY_CLEANUP_THRESHOLD = 1000;
// Maximum number of expired keys to clean up in one pass
const MAX_CLEANUP_BATCH = 100;

/**
 * Simple in-memory key-value store with snapshot persistence.
 * Stores values as Buffers for efficiency.
 */
export class KeyValueStore {
	private store: Map<string, Buffer>;
	private ttlManager: TTLManager;
	private dirty = 0; // Number of changes since last save
	private expiredCount = 0; // Counter for potentially expired keys

	constructor() {
		this.store = new Map<string, Buffer>();
		this.ttlManager = new TTLManager({
			onDelete: (key) => this.delete(key),
		});
		debug.log("In-memory store initialized.");
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
		for (const [key] of this.store) {
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
		const value = this.store.get(key);
		if (!value) {
			debug.log(`Key not found: ${key}`);
			return undefined;
		}

		if (this.ttlManager.isExpired(key)) {
			debug.log(`Key expired: ${key}`);
			this.delete(key);
			this.expiredCount++;
			return undefined;
		}

		debug.log(`Retrieved key: ${key}`);
		return value;
	}

	/**
	 * Stores a key-value pair with an optional TTL.
	 * @param key The key to store
	 * @param value The value to store
	 * @param ttlSeconds Optional TTL in seconds (Redis compatible)
	 */
	set(key: string, value: Buffer, ttlSeconds?: number): void {
		// If key exists and has TTL, increment expired count as it might be expired
		if (this.store.has(key) && this.ttlManager.ttl(key) !== -1) {
			this.expiredCount++;
		}

		this.store.set(key, value);
		debug.log(
			`Set key: ${key}${ttlSeconds ? ` with TTL: ${ttlSeconds}s` : ""}`,
		);

		if (ttlSeconds !== undefined) {
			this.ttlManager.expire(key, ttlSeconds);
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
		if (!this.store.has(key)) {
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
		if (!this.store.has(key)) {
			return false;
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
		if (!this.store.has(key)) {
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
		if (!this.store.has(key)) {
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
		if (!this.store.has(key)) {
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
		const deleted = this.store.delete(key);
		if (deleted) {
			this.ttlManager.delete(key);
			this.dirty++;
			debug.log(`Deleted key: ${key}`);
		} else {
			debug.log(`Key not found for deletion: ${key}`);
		}
		return deleted;
	}

	getDirtyCount(): number {
		return this.dirty;
	}

	getLastSaveTime(): Date | null {
		return snapshotManager.getLastSaveTime();
	}

	/**
	 * Saves the current state of the store to a snapshot file.
	 */
	saveSnapshot(filePath: string): void {
		// Clean up expired keys before saving
		this.cleanupExpired();

		if (this.dirty === 0 && snapshotManager.getLastSaveTime() !== null) {
			debug.log("No changes since last snapshot, skipping save");
			return;
		}

		try {
			debug.log(`Saving snapshot to: ${filePath}`);
			snapshotManager.saveSnapshot(filePath, this.store);
			this.dirty = 0;
			debug.log("Snapshot saved successfully");
		} catch (error) {
			debug.error("Failed to save snapshot:", error);
		}
	}

	loadSnapshot(filePath: string): void {
		debug.log(`Loading snapshot from: ${filePath}`);
		this.store = snapshotManager.loadSnapshot(filePath);
		this.ttlManager.clear(); // Reset TTL store on load
		this.dirty = 0;
		this.expiredCount = 0;
		debug.log("Snapshot loaded successfully");
	}

	/**
	 * Cleans up resources used by the store.
	 * Should be called when shutting down the server.
	 */
	dispose(): void {
		debug.log("Disposing store and cleaning up resources");
		this.ttlManager.dispose();
		this.store.clear();
		this.expiredCount = 0;
	}

	// Optional: Add methods for other commands like EXISTS, KEYS etc. later
}

// Export a singleton instance for the application to use
// The loading logic will be called on this instance from server.ts at startup.
export const store = new KeyValueStore();
