import {
	afterEach,
	beforeEach,
	describe,
	expect,
	setSystemTime,
	test,
} from "bun:test";
import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KeyValueStore } from "../../src/store/store";

describe("KeyValueStore", () => {
	let store: KeyValueStore;
	const snapshotPath = join(tmpdir(), "test-snapshot.json");
	const initialTime = Date.now();

	beforeEach(() => {
		store = new KeyValueStore();
		setSystemTime(new Date(initialTime));
		try {
			unlinkSync(snapshotPath);
		} catch {
			// Ignore if file doesn't exist
		}
	});

	afterEach(() => {
		store.dispose();
		setSystemTime(); // Reset to real time
		try {
			unlinkSync(snapshotPath);
		} catch {
			// Ignore if file doesn't exist
		}
	});

	describe("Basic Operations", () => {
		test("should set and get a value", () => {
			const key = "test-key";
			const value = Buffer.from("test-value");
			store.set(key, value);
			expect(store.get(key)).toEqual(value);
		});

		test("should return undefined for non-existent key", () => {
			expect(store.get("non-existent")).toBeUndefined();
		});

		test("should delete a key", () => {
			const key = "test-key";
			const value = Buffer.from("test-value");
			store.set(key, value);
			expect(store.delete(key)).toBe(true);
			expect(store.get(key)).toBeUndefined();
		});

		test("should return false when deleting non-existent key", () => {
			expect(store.delete("non-existent")).toBe(false);
		});
	});

	describe("TTL Operations", () => {
		test("should set TTL on key", () => {
			const key = "ttl-key";
			const value = Buffer.from("ttl-value");
			store.set(key, value, 100);
			expect(store.ttl(key)).toBeGreaterThan(0);
			expect(store.ttl(key)).toBeLessThanOrEqual(100);
		});

		test("should return -1 for key without TTL", () => {
			const key = "no-ttl-key";
			store.set(key, Buffer.from("value"));
			expect(store.ttl(key)).toBe(-1);
		});

		test("should return -2 for non-existent key TTL", () => {
			expect(store.ttl("non-existent")).toBe(-2);
		});

		test("should handle millisecond precision TTL", () => {
			const key = "pttl-key";
			store.set(key, Buffer.from("value"));
			store.pexpire(key, 5000);
			expect(store.pttl(key)).toBeGreaterThan(0);
			expect(store.pttl(key)).toBeLessThanOrEqual(5000);
		});

		test("should persist TTL", () => {
			const key = "persist-key";
			store.set(key, Buffer.from("value"), 100);
			expect(store.ttl(key)).toBeGreaterThan(0);
			expect(store.persist(key)).toBe(true);
			expect(store.ttl(key)).toBe(-1);
		});

		test("should expire keys after TTL", () => {
			const key = "expire-key";
			store.set(key, Buffer.from("value"), 1);
			expect(store.get(key)).toBeDefined();

			// Advance time by 1.1 seconds
			setSystemTime(new Date(initialTime + 1100));

			expect(store.get(key)).toBeUndefined();
		});
	});

	describe("Persistence Operations", () => {
		test("should save and load snapshot", () => {
			const testData = new Map([
				["key1", Buffer.from("value1")],
				["key2", Buffer.from("value2")],
			]);

			// Set test data
			for (const [key, value] of testData) {
				store.set(key, value);
			}

			// Save snapshot
			store.saveSnapshot(snapshotPath);

			// Create new store and load snapshot
			const newStore = new KeyValueStore();
			newStore.loadSnapshot(snapshotPath);

			// Verify data
			for (const [key, value] of testData) {
				expect(newStore.get(key)).toEqual(value);
			}

			newStore.dispose();
		});

		test("should track dirty state", () => {
			expect(store.getDirtyCount()).toBe(0);
			store.set("key", Buffer.from("value"));
			expect(store.getDirtyCount()).toBe(1);
			store.saveSnapshot(snapshotPath);
			expect(store.getDirtyCount()).toBe(0);
		});

		test("should update last save time", () => {
			expect(store.getLastSaveTime()).toBeNull();
			store.set("key", Buffer.from("value"));
			store.saveSnapshot(snapshotPath);
			expect(store.getLastSaveTime()).toBeInstanceOf(Date);
		});
	});

	describe("Edge Cases", () => {
		test("should handle empty values", () => {
			store.set("empty", Buffer.from(""));
			expect(store.get("empty")).toEqual(Buffer.from(""));
		});

		test("should handle special characters in keys", () => {
			const key = "!@#$%^&*()_+";
			const value = Buffer.from("special");
			store.set(key, value);
			expect(store.get(key)).toEqual(value);
		});

		test("should handle large values", () => {
			const largeValue = Buffer.alloc(1024 * 1024); // 1MB
			store.set("large", largeValue);
			expect(store.get("large")).toEqual(largeValue);
		});

		test("should handle concurrent operations", async () => {
			const promises = [];
			for (let i = 0; i < 100; i++) {
				promises.push(
					Promise.resolve().then(() => {
						store.set(`key${i}`, Buffer.from(`value${i}`));
						return store.get(`key${i}`);
					}),
				);
			}
			const results = await Promise.all(promises);
			expect(results.length).toBe(100);
			expect(results.every((r) => r !== undefined)).toBe(true);
		});
	});
});
