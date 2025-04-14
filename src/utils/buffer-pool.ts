import { debug } from "./debug";

// Size tiers for different response types (in bytes)
const BUFFER_TIERS = [
	64, // Small responses (simple strings, small integers)
	128, // Medium responses (bulk strings < 100 bytes)
	256, // Large responses (bulk strings < 200 bytes)
	512, // Extra large responses (bulk strings < 400 bytes)
	1024, // Huge responses (bulk strings < 900 bytes)
	2048, // Giant responses (bulk strings < 1900 bytes)
] as const;

// Default tier to use if no appropriate tier is found
const DEFAULT_TIER = BUFFER_TIERS[BUFFER_TIERS.length - 1] || 2048;

interface PoolStats {
	hits: number;
	misses: number;
	allocations: number;
	releases: number;
	currentSize: number;
}

export class EnhancedBufferPool {
	private pools: Map<number, Buffer[]>;
	private stats: Map<number, PoolStats>;
	private maxPoolSize: number;

	constructor(maxPoolSize = 1000) {
		this.pools = new Map();
		this.stats = new Map();
		this.maxPoolSize = maxPoolSize;

		// Initialize pools for each tier
		for (const size of BUFFER_TIERS) {
			this.pools.set(size, []);
			this.stats.set(size, {
				hits: 0,
				misses: 0,
				allocations: 0,
				releases: 0,
				currentSize: 0,
			});
		}

		debug.log("EnhancedBufferPool initialized with tiers:", BUFFER_TIERS);
	}

	/**
	 * Acquires a buffer of at least the specified size.
	 * The buffer may be larger than requested due to tiered sizing.
	 */
	acquire(minSize: number): Buffer {
		const tier = this.findTier(minSize);
		const pool = this.pools.get(tier);
		const stats = this.stats.get(tier);

		if (!stats) {
			debug.error(`No stats found for tier ${tier}`);
			return Buffer.allocUnsafe(minSize);
		}

		if (pool && pool.length > 0) {
			stats.hits++;
			stats.currentSize = pool.length - 1;
			const buffer = pool.pop();
			if (!buffer) {
				// This should never happen due to length check, but TypeScript needs it
				debug.error("Buffer.pop() returned undefined despite length > 0");
				return Buffer.allocUnsafe(tier);
			}
			debug.log(
				`Buffer hit: size=${minSize}, tier=${tier}, remaining=${pool.length}`,
			);
			return buffer;
		}

		stats.misses++;
		stats.allocations++;
		debug.log(`Buffer miss: size=${minSize}, tier=${tier}, allocating new`);
		return Buffer.allocUnsafe(tier);
	}

	/**
	 * Returns a buffer to the pool for reuse.
	 * The buffer must not be used after being released.
	 */
	release(buffer: Buffer): void {
		const tier = this.findTier(buffer.length);
		const pool = this.pools.get(tier);
		const stats = this.stats.get(tier);

		if (!stats || !pool) {
			debug.error(`No pool or stats found for tier ${tier}`);
			return;
		}

		if (pool.length < this.maxPoolSize) {
			pool.push(buffer);
			stats.releases++;
			stats.currentSize = pool.length;
			debug.log(
				`Buffer released: size=${buffer.length}, tier=${tier}, total=${pool.length}`,
			);
		} else {
			debug.log(
				`Buffer discarded: size=${buffer.length}, tier=${tier}, pool full`,
			);
		}
	}

	/**
	 * Finds the appropriate size tier for a given buffer size.
	 * Returns the smallest tier that can accommodate the size.
	 */
	private findTier(size: number): number {
		// Find the first tier that can fit the requested size
		for (const tier of BUFFER_TIERS) {
			if (tier >= size) {
				return tier;
			}
		}
		// If no tier is big enough, return the default tier
		return DEFAULT_TIER;
	}

	/**
	 * Returns statistics about buffer pool usage.
	 */
	getStats(): Map<number, PoolStats> {
		return new Map(this.stats);
	}

	/**
	 * Clears all pools and resets statistics.
	 */
	clear(): void {
		for (const size of BUFFER_TIERS) {
			this.pools.set(size, []);
			this.stats.set(size, {
				hits: 0,
				misses: 0,
				allocations: 0,
				releases: 0,
				currentSize: 0,
			});
		}
		debug.log("Buffer pool cleared");
	}
}

// Global instance for shared use
export const globalBufferPool = new EnhancedBufferPool();
