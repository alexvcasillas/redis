import { beforeEach, describe, expect, test } from "bun:test";
import { EnhancedBufferPool } from "../../src/utils/buffer-pool";

describe("EnhancedBufferPool", () => {
	let pool: EnhancedBufferPool;

	beforeEach(() => {
		pool = new EnhancedBufferPool();
	});

	test("should allocate buffers of appropriate size", () => {
		const buf50 = pool.acquire(50); // Should get 64-byte buffer
		const buf100 = pool.acquire(100); // Should get 128-byte buffer
		const buf200 = pool.acquire(200); // Should get 256-byte buffer

		expect(buf50.length).toBe(64);
		expect(buf100.length).toBe(128);
		expect(buf200.length).toBe(256);
	});

	test("should reuse released buffers", () => {
		// First acquire a buffer and note its properties
		const buf1 = pool.acquire(100);
		const originalLength = buf1.length;
		const originalAddress = buf1.buffer;

		// Release it back to the pool
		pool.release(buf1);

		// Acquire another buffer of the same size
		const buf2 = pool.acquire(100);

		// Should get a buffer of the same size
		expect(buf2.length).toBe(originalLength);

		// Should be the same underlying buffer (reused from pool)
		expect(buf2.buffer).toBe(originalAddress);
	});

	test("should handle buffers larger than largest tier", () => {
		const largeSize = 1024 * 1024; // 1MB
		const buf = pool.acquire(largeSize);
		expect(buf.length).toBe(2048); // Should get largest tier
	});

	test("should track statistics correctly", () => {
		const buf1 = pool.acquire(100);
		pool.release(buf1);
		const buf2 = pool.acquire(100); // Should be a hit

		const stats = pool.getStats();
		const tier128Stats = Array.from(stats.entries()).find(
			([size]) => size === 128,
		)?.[1];

		expect(tier128Stats).toBeDefined();
		if (tier128Stats) {
			expect(tier128Stats.hits).toBe(1);
			expect(tier128Stats.misses).toBe(1);
			expect(tier128Stats.releases).toBe(1);
		}
	});

	test("should respect max pool size", () => {
		const smallPool = new EnhancedBufferPool(2); // Max 2 buffers per tier

		const buf1 = smallPool.acquire(100);
		const buf2 = smallPool.acquire(100);
		const buf3 = smallPool.acquire(100);

		// Release all buffers
		smallPool.release(buf1);
		smallPool.release(buf2);
		smallPool.release(buf3);

		const stats = smallPool.getStats();
		const tier128Stats = Array.from(stats.entries()).find(
			([size]) => size === 128,
		)?.[1];

		expect(tier128Stats).toBeDefined();
		if (tier128Stats) {
			expect(tier128Stats.currentSize).toBeLessThanOrEqual(2);
		}
	});

	test("should clear pools and reset statistics", () => {
		// Acquire and release some buffers
		const buf1 = pool.acquire(100);
		const buf2 = pool.acquire(200);
		pool.release(buf1);
		pool.release(buf2);

		// Clear the pool
		pool.clear();

		// Check that stats are reset
		const stats = pool.getStats();
		for (const [, tierStats] of stats) {
			expect(tierStats.hits).toBe(0);
			expect(tierStats.misses).toBe(0);
			expect(tierStats.allocations).toBe(0);
			expect(tierStats.releases).toBe(0);
			expect(tierStats.currentSize).toBe(0);
		}
	});
});
