import {
	afterEach,
	beforeEach,
	describe,
	expect,
	setSystemTime,
	test,
} from "bun:test";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SnapshotManager } from "../../src/persistence/snapshot-manager";
import { KeyValueStore } from "../../src/store/store";

describe("SnapshotManager", () => {
	let snapshotManager: SnapshotManager;
	let testDir: string;
	let snapshotPath: string;
	let store: KeyValueStore;
	let initialTime: number;

	beforeEach(() => {
		testDir = join(tmpdir(), `redis-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		snapshotPath = join(testDir, "test-dump.json");
		store = new KeyValueStore();
		initialTime = Date.now();
		setSystemTime(new Date(initialTime));
	});

	afterEach(() => {
		if (snapshotManager) {
			snapshotManager.stop();
		}
		try {
			unlinkSync(snapshotPath);
		} catch (error) {
			// Ignore if file doesn't exist
		}
		setSystemTime(); // Reset to actual time
	});

	describe("Configuration", () => {
		test("should initialize with valid save rules", () => {
			snapshotManager = new SnapshotManager(
				"900 1 300 10 60 10000",
				"test-dump.json",
				testDir,
			);
			snapshotManager.setStore(store);
			expect(snapshotManager.getSnapshotFilePath()).toBe(snapshotPath);
		});

		test("should handle empty save rules", () => {
			snapshotManager = new SnapshotManager("", "test-dump.json", testDir);
			snapshotManager.setStore(store);
			expect(snapshotManager.getSnapshotFilePath()).toBe(snapshotPath);
		});

		test("should handle invalid save rules", () => {
			snapshotManager = new SnapshotManager(
				"invalid rules",
				"test-dump.json",
				testDir,
			);
			snapshotManager.setStore(store);

			// Verify the snapshot path is still set correctly
			expect(snapshotManager.getSnapshotFilePath()).toBe(snapshotPath);

			// Start the manager and make changes
			snapshotManager.start();
			store.set("key1", Buffer.from("value1"));

			// Advance time and trigger check
			setSystemTime(new Date(initialTime + 1500));
			snapshotManager.checkNow();

			// Verify no snapshot was created since rules were invalid
			expect(existsSync(snapshotPath)).toBe(false);
		});

		test("should handle malformed save rules", () => {
			snapshotManager = new SnapshotManager("900", "test-dump.json", testDir);
			snapshotManager.setStore(store);
			expect(snapshotManager.getSnapshotFilePath()).toBe(snapshotPath);
		});

		test("should handle negative numbers in save rules", () => {
			snapshotManager = new SnapshotManager(
				"-900 1 300 -10",
				"test-dump.json",
				testDir,
			);
			snapshotManager.setStore(store);
			expect(snapshotManager.getSnapshotFilePath()).toBe(snapshotPath);
		});
	});

	describe("Snapshot Operations", () => {
		beforeEach(() => {
			snapshotManager = new SnapshotManager("1 1", "test-dump.json", testDir);
			snapshotManager.setStore(store);
		});

		test("should create snapshot when conditions are met", async () => {
			snapshotManager = new SnapshotManager("1 1", "test-dump.json", testDir);
			snapshotManager.setStore(store);

			// Start snapshot manager and make changes
			snapshotManager.start();
			store.set("key1", Buffer.from("value1"));

			// Advance time and trigger check
			setSystemTime(new Date(initialTime + 1500));
			snapshotManager.checkNow();

			// Verify snapshot was created
			expect(existsSync(snapshotPath)).toBe(true);
		});

		test("should load initial snapshot", () => {
			// Set some data and create initial snapshot
			store.set("test-key", Buffer.from("test-value"));

			// Create new snapshot manager and save initial snapshot
			const initialManager = new SnapshotManager(
				"1 1",
				"test-dump.json",
				testDir,
			);
			initialManager.setStore(store);
			initialManager.saveSnapshot(snapshotPath);

			// Create new store and manager for loading
			const newStore = new KeyValueStore();
			const newManager = new SnapshotManager("1 1", "test-dump.json", testDir);
			newManager.setStore(newStore);
			newManager.loadInitialSnapshot();

			// Verify data was loaded
			expect(newStore.get("test-key")?.toString()).toBe("test-value");
		});

		test("should handle missing snapshot file", () => {
			const newManager = new SnapshotManager(
				"1 1",
				"non-existent.json",
				testDir,
			);
			newManager.setStore(store);
			newManager.loadInitialSnapshot(); // Should not throw
		});
	});

	describe("Save Rules", () => {
		test("should save based on time and changes", async () => {
			snapshotManager = new SnapshotManager("1 2", "test-dump.json", testDir);
			snapshotManager.setStore(store);

			// Start snapshot manager and make changes
			snapshotManager.start();
			store.set("key1", Buffer.from("value1"));
			store.set("key2", Buffer.from("value2"));

			// Advance time and trigger check
			setSystemTime(new Date(initialTime + 1500));
			snapshotManager.checkNow();

			// Verify snapshot was created
			expect(existsSync(snapshotPath)).toBe(true);
		});

		test("should not save when changes are below threshold", async () => {
			snapshotManager = new SnapshotManager("1 3", "test-dump.json", testDir);
			snapshotManager.setStore(store);

			// Start snapshot manager and make fewer changes than required
			snapshotManager.start();
			store.set("key1", Buffer.from("value1"));

			// Advance time and trigger check
			setSystemTime(new Date(initialTime + 1500));
			snapshotManager.checkNow();

			// Verify snapshot was not created
			expect(existsSync(snapshotPath)).toBe(false);
		});

		test("should handle multiple save rules", async () => {
			snapshotManager = new SnapshotManager(
				"1 5 2 2",
				"test-dump.json",
				testDir,
			);
			snapshotManager.setStore(store);

			// Start snapshot manager and make changes
			snapshotManager.start();
			store.set("key1", Buffer.from("value1"));
			store.set("key2", Buffer.from("value2"));

			// Advance time and trigger check
			setSystemTime(new Date(initialTime + 2500));
			snapshotManager.checkNow();

			// Verify snapshot was created
			expect(existsSync(snapshotPath)).toBe(true);
		});
	});

	describe("Resource Management", () => {
		test("should stop and restart snapshot manager", async () => {
			snapshotManager = new SnapshotManager("1 1", "test-dump.json", testDir);
			snapshotManager.setStore(store);

			// Start and make changes
			snapshotManager.start();
			store.set("key1", Buffer.from("value1"));

			// Stop before save rule triggers
			snapshotManager.stop();

			// Advance time and trigger check (should not save)
			setSystemTime(new Date(initialTime + 1500));
			snapshotManager.checkNow();

			// Verify no snapshot was created
			expect(existsSync(snapshotPath)).toBe(false);

			// Restart and trigger check
			snapshotManager.start();
			setSystemTime(new Date(initialTime + 3000));
			snapshotManager.checkNow();

			// Verify snapshot was created after restart
			expect(existsSync(snapshotPath)).toBe(true);
		});

		test("should handle rapid start/stop cycles", () => {
			snapshotManager = new SnapshotManager("1 1", "test-dump.json", testDir);
			snapshotManager.setStore(store);

			for (let i = 0; i < 10; i++) {
				snapshotManager.start();
				snapshotManager.stop();
			}

			// Should not throw or leave dangling timers
		});
	});
});
