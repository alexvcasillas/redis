import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { TTLManager } from "../../src/store/ttl";

describe("TTLManager", () => {
	let ttlManager: TTLManager;
	let deletedKeys: string[];

	beforeEach(() => {
		deletedKeys = [];
		ttlManager = new TTLManager({
			onDelete: (key: string) => {
				deletedKeys.push(key);
			},
		});
	});

	afterEach(() => {
		ttlManager.dispose();
	});

	describe("Basic TTL Operations", () => {
		test("should set and get TTL in seconds", () => {
			ttlManager.expire("test-key", 100);
			expect(ttlManager.ttl("test-key")).toBeLessThanOrEqual(100);
			expect(ttlManager.ttl("test-key")).toBeGreaterThan(98);
		});

		test("should set and get TTL in milliseconds", () => {
			ttlManager.pexpire("test-key", 5000);
			expect(ttlManager.pttl("test-key")).toBeLessThanOrEqual(5000);
			expect(ttlManager.pttl("test-key")).toBeGreaterThan(4900);
		});

		test("should return -1 for keys without TTL", () => {
			expect(ttlManager.ttl("non-existent")).toBe(-1);
			expect(ttlManager.pttl("non-existent")).toBe(-1);
		});

		test("should persist TTL", () => {
			ttlManager.expire("test-key", 100);
			expect(ttlManager.ttl("test-key")).toBeGreaterThan(0);
			expect(ttlManager.persist("test-key")).toBe(true);
			expect(ttlManager.ttl("test-key")).toBe(-1);
		});

		test("should return false when persisting non-existent TTL", () => {
			expect(ttlManager.persist("non-existent")).toBe(false);
		});
	});

	describe("Expiration Behavior", () => {
		test("should expire keys after TTL", async () => {
			ttlManager.expire("expire-key", 1);
			expect(ttlManager.ttl("expire-key")).toBeGreaterThan(0);
			await Bun.sleep(1100);
			expect(ttlManager.ttl("expire-key")).toBe(-1);
			expect(deletedKeys).toContain("expire-key");
		});

		test("should expire keys with millisecond precision", async () => {
			ttlManager.pexpire("expire-key", 500);
			expect(ttlManager.pttl("expire-key")).toBeGreaterThan(0);
			await Bun.sleep(600);
			expect(ttlManager.pttl("expire-key")).toBe(-1);
			expect(deletedKeys).toContain("expire-key");
		});

		test("should immediately expire keys with zero or negative TTL", () => {
			ttlManager.expire("zero-ttl", 0);
			expect(ttlManager.ttl("zero-ttl")).toBe(-1);
			expect(deletedKeys).toContain("zero-ttl");

			ttlManager.pexpire("negative-ttl", -100);
			expect(ttlManager.pttl("negative-ttl")).toBe(-1);
			expect(deletedKeys).toContain("negative-ttl");
		});

		test("should correctly identify expired keys", async () => {
			ttlManager.expire("test-key", 1);
			expect(ttlManager.isExpired("test-key")).toBe(false);
			await Bun.sleep(1100);
			expect(ttlManager.isExpired("test-key")).toBe(true);
		});
	});

	describe("Cleanup and Resource Management", () => {
		test("should clear all TTLs", () => {
			ttlManager.expire("key1", 100);
			ttlManager.expire("key2", 200);
			ttlManager.clear();
			expect(ttlManager.ttl("key1")).toBe(-1);
			expect(ttlManager.ttl("key2")).toBe(-1);
		});

		test("should handle deletion of keys with TTL", () => {
			ttlManager.expire("key1", 100);
			ttlManager.delete("key1");
			expect(ttlManager.ttl("key1")).toBe(-1);
			expect(deletedKeys).toContain("key1");
		});

		test("should handle deletion of keys without TTL", () => {
			ttlManager.delete("non-existent");
			expect(deletedKeys).not.toContain("non-existent");
		});

		test("should cleanup resources on dispose", () => {
			ttlManager.expire("key1", 100);
			ttlManager.expire("key2", 200);
			ttlManager.dispose();
			expect(ttlManager.ttl("key1")).toBe(-1);
			expect(ttlManager.ttl("key2")).toBe(-1);
		});
	});

	describe("Internal Methods", () => {
		test("should get all keys with TTL", () => {
			ttlManager.expire("key1", 100);
			ttlManager.expire("key2", 200);
			const keys = ttlManager.getAllKeys();
			expect(keys).toContain("key1");
			expect(keys).toContain("key2");
			expect(keys.length).toBe(2);
		});

		test("should get TTL entry", () => {
			ttlManager.expire("key1", 100);
			const entry = ttlManager.getTTL("key1");
			expect(entry).toBeDefined();
			if (entry) {
				expect(entry.expiresAt).toBeGreaterThan(Date.now());
			}
		});
	});

	describe("Edge Cases", () => {
		test("should handle rapid TTL updates", () => {
			for (let i = 0; i < 100; i++) {
				ttlManager.expire("key", 100 - i);
			}
			expect(ttlManager.ttl("key")).toBeLessThanOrEqual(1);
			expect(ttlManager.ttl("key")).toBeGreaterThan(-1);
		});

		test("should handle concurrent operations", async () => {
			const promises = [];
			for (let i = 0; i < 100; i++) {
				promises.push(
					Promise.resolve().then(() => {
						ttlManager.expire(`key${i}`, 100);
						return ttlManager.ttl(`key${i}`);
					}),
				);
			}
			const results = await Promise.all(promises);
			expect(results.length).toBe(100);
			expect(results.every((ttl) => ttl > 0)).toBe(true);
		});

		test("should handle cleanup interval correctly", async () => {
			const customTTLManager = new TTLManager({
				cleanupIntervalMs: 100,
				onDelete: (key: string) => {
					deletedKeys.push(key);
				},
			});

			customTTLManager.expire("quick-expire", 1);
			await Bun.sleep(1200); // Wait for cleanup interval
			expect(customTTLManager.ttl("quick-expire")).toBe(-1);
			expect(deletedKeys).toContain("quick-expire");

			customTTLManager.dispose();
		});
	});
});
