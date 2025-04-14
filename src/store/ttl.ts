import { debug } from "../utils/debug";

interface TTLEntry {
	expiresAt: number; // Unix timestamp in milliseconds
}

/**
 * Manages Time-To-Live (TTL) functionality for the key-value store.
 * Handles expiration of keys in a Redis-compatible way.
 */
export class TTLManager {
	private ttlStore: Map<string, TTLEntry>;
	private timeouts: Map<string, NodeJS.Timeout>;
	private cleanupInterval: number;
	private lastCleanup: number;
	private onDelete: (key: string) => void;
	private cleanupIntervalId?: NodeJS.Timeout;

	constructor(options: {
		cleanupIntervalMs?: number;
		onDelete: (key: string) => void;
	}) {
		this.ttlStore = new Map<string, TTLEntry>();
		this.timeouts = new Map<string, NodeJS.Timeout>();
		this.cleanupInterval = options.cleanupIntervalMs ?? 100; // Default: 100ms like Redis
		this.lastCleanup = Date.now();
		this.onDelete = options.onDelete;

		this.startCleanupLoop();
		debug.log("TTL manager initialized");
	}

	/**
	 * Sets TTL for a key in seconds.
	 * @param key The key to set TTL for
	 * @param seconds TTL in seconds
	 */
	expire(key: string, seconds: number): void {
		// Clear any existing timeout
		this.clearTimeout(key);

		if (seconds <= 0) {
			this.ttlStore.delete(key);
			this.onDelete(key);
			return;
		}

		this.ttlStore.set(key, {
			expiresAt: Date.now() + seconds * 1000,
		});

		// Set new timeout
		const timeout = setTimeout(() => {
			debug.log(`TTL expired for key: ${key}`);
			this.delete(key);
		}, seconds * 1000);

		this.timeouts.set(key, timeout);
		debug.log(`Set TTL for key: ${key} to expire in ${seconds}s`);
	}

	/**
	 * Sets TTL for a key in milliseconds.
	 * @param key The key to set TTL for
	 * @param milliseconds TTL in milliseconds
	 */
	pexpire(key: string, milliseconds: number): void {
		// Clear any existing timeout
		this.clearTimeout(key);

		if (milliseconds <= 0) {
			this.ttlStore.delete(key);
			this.onDelete(key);
			return;
		}

		this.ttlStore.set(key, {
			expiresAt: Date.now() + milliseconds,
		});

		// Set new timeout
		const timeout = setTimeout(() => {
			debug.log(`TTL expired for key: ${key}`);
			this.delete(key);
		}, milliseconds);

		this.timeouts.set(key, timeout);
	}

	/**
	 * Gets the remaining TTL for a key in seconds.
	 * @returns TTL in seconds, or -1 if no TTL set
	 */
	ttl(key: string): number {
		const ttlEntry = this.ttlStore.get(key);
		if (!ttlEntry) {
			return -1;
		}

		const remainingMs = ttlEntry.expiresAt - Date.now();
		if (remainingMs <= 0) {
			this.ttlStore.delete(key);
			this.onDelete(key);
			return -2;
		}

		return Math.ceil(remainingMs / 1000);
	}

	/**
	 * Gets the remaining TTL for a key in milliseconds.
	 * @returns TTL in milliseconds, or -1 if no TTL set
	 */
	pttl(key: string): number {
		const ttlEntry = this.ttlStore.get(key);
		if (!ttlEntry) {
			return -1;
		}

		const remainingMs = ttlEntry.expiresAt - Date.now();
		if (remainingMs <= 0) {
			this.ttlStore.delete(key);
			this.onDelete(key);
			return -2;
		}

		return Math.max(0, remainingMs);
	}

	/**
	 * Gets the TTL entry for a key.
	 * @internal Used by KeyValueStore for expiration checks
	 */
	getTTL(key: string): TTLEntry | undefined {
		return this.ttlStore.get(key);
	}

	/**
	 * Gets all keys that have TTL set.
	 * @internal Used by KeyValueStore for cleanup
	 */
	getAllKeys(): string[] {
		return Array.from(this.ttlStore.keys());
	}

	/**
	 * Removes TTL from a key.
	 * @returns true if TTL was removed, false if key had no TTL
	 */
	persist(key: string): boolean {
		this.clearTimeout(key);
		return this.ttlStore.delete(key);
	}

	/**
	 * Checks if a key has expired.
	 */
	isExpired(key: string): boolean {
		const ttlEntry = this.ttlStore.get(key);
		if (!ttlEntry) {
			return false;
		}
		const expired = Date.now() >= ttlEntry.expiresAt;
		if (expired) {
			debug.log(`Key ${key} has expired`);
		}
		return expired;
	}

	/**
	 * Removes TTL tracking for a key.
	 */
	delete(key: string): void {
		const ttlEntry = this.ttlStore.get(key);
		if (ttlEntry) {
			this.clearTimeout(key);
			this.ttlStore.delete(key);
			this.onDelete(key);
		}
	}

	/**
	 * Clears all TTL entries.
	 */
	clear(): void {
		debug.log("Clearing all TTL tracking");
		// Clear all timeouts
		for (const key of this.timeouts.keys()) {
			this.clearTimeout(key);
		}
		this.ttlStore.clear();
	}

	/**
	 * Clears the timeout for a specific key
	 * @internal
	 */
	private clearTimeout(key: string): void {
		const timeout = this.timeouts.get(key);
		if (timeout) {
			clearTimeout(timeout);
			this.timeouts.delete(key);
		}
	}

	private startCleanupLoop(): void {
		this.cleanupIntervalId = setInterval(() => {
			const now = Date.now();
			if (now - this.lastCleanup < this.cleanupInterval) {
				return;
			}
			this.lastCleanup = now;

			// Sample 20 random keys with TTL (Redis behavior)
			const keysWithTTL = [...this.ttlStore.keys()];
			const sampleSize = Math.min(20, keysWithTTL.length);

			for (let i = 0; i < sampleSize; i++) {
				const randomIndex = Math.floor(Math.random() * keysWithTTL.length);
				const key = keysWithTTL[randomIndex];

				if (key === undefined) continue;

				if (this.isExpired(key)) {
					this.ttlStore.delete(key);
					this.onDelete(key);
				}

				keysWithTTL.splice(randomIndex, 1);
			}
		}, this.cleanupInterval);
	}

	/**
	 * Disposes of the TTL manager and cleans up resources.
	 * Should be called when the TTL manager is no longer needed.
	 */
	dispose(): void {
		debug.log("Disposing TTL manager");
		if (this.cleanupIntervalId) {
			clearInterval(this.cleanupIntervalId);
			this.cleanupIntervalId = undefined;
		}
		// Clear all timeouts
		for (const key of this.timeouts.keys()) {
			this.clearTimeout(key);
		}
		this.ttlStore.clear();
		this.timeouts.clear();
	}
}
