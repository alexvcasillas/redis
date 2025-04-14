import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { SnapshotManager } from "../../src/persistence/snapshot-manager";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unlinkSync, existsSync, mkdirSync } from "node:fs";
import { store } from "../../src/store/store";

describe("SnapshotManager", () => {
	let snapshotManager: SnapshotManager;
	let testDir: string;
	let snapshotPath: string;

	beforeEach(() => {
		testDir = join(tmpdir(), `redis-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		snapshotPath = join(testDir, "test-dump.json");
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
	});

	describe("Configuration", () => {
		test("should initialize with valid save rules", () => {
			snapshotManager = new SnapshotManager(
				"900 1 300 10 60 10000",
				"test-dump.json",
				testDir,
			);
			expect(snapshotManager.getSnapshotFilePath()).toBe(snapshotPath);
		});

		test("should handle empty save rules", () => {
			snapshotManager = new SnapshotManager("", "test-dump.json", testDir);
			expect(snapshotManager.getSnapshotFilePath()).toBe(snapshotPath);
		});

		test("should handle invalid save rules", () => {
			snapshotManager = new SnapshotManager(
				"invalid rules",
				"test-dump.json",
				testDir,
			);
			expect(snapshotManager.getSnapshotFilePath()).toBe(snapshotPath);
		});

		test("should handle malformed save rules", () => {
			snapshotManager = new SnapshotManager("900", "test-dump.json", testDir);
			expect(snapshotManager.getSnapshotFilePath()).toBe(snapshotPath);
		});

		test("should handle negative numbers in save rules", () => {
			snapshotManager = new SnapshotManager(
				"-900 1 300 -10",
				"test-dump.json",
				testDir,
			);
			expect(snapshotManager.getSnapshotFilePath()).toBe(snapshotPath);
		});
	});

	describe("Snapshot Operations", () => {
		beforeEach(() => {
			snapshotManager = new SnapshotManager("1 1", "test-dump.json", testDir);
		});

		test("should create snapshot when conditions are met", async () => {
			// Set some data
			store.set("test-key", Buffer.from("test-value"));

			// Start snapshot manager and wait for potential save
			snapshotManager.start();
			await Bun.sleep(1100); // Wait for 1.1 seconds to ensure save rule triggers

			// Verify snapshot was created
			expect(existsSync(snapshotPath)).toBe(true);
		});

		test("should load initial snapshot", () => {
			// Set some data and create initial snapshot
			store.set("test-key", Buffer.from("test-value"));
			store.saveSnapshot(snapshotPath);

			// Create new snapshot manager and load snapshot
			const newManager = new SnapshotManager("1 1", "test-dump.json", testDir);
			newManager.loadInitialSnapshot();

			// Verify data was loaded
			expect(store.get("test-key")?.toString()).toBe("test-value");
		});

		test("should handle missing snapshot file", () => {
			const newManager = new SnapshotManager(
				"1 1",
				"non-existent.json",
				testDir,
			);
			newManager.loadInitialSnapshot(); // Should not throw
		});
	});

	describe("Save Rules", () => {
		test("should save based on time and changes", async () => {
			snapshotManager = new SnapshotManager("1 2", "test-dump.json", testDir);
			snapshotManager.start();

			// Make changes
			store.set("key1", Buffer.from("value1"));
			store.set("key2", Buffer.from("value2"));

			// Wait for save rule to trigger
			await Bun.sleep(1100);

			// Verify snapshot was created
			expect(existsSync(snapshotPath)).toBe(true);
		});

		test("should not save when changes are below threshold", async () => {
			snapshotManager = new SnapshotManager("1 3", "test-dump.json", testDir);
			snapshotManager.start();

			// Make fewer changes than required
			store.set("key1", Buffer.from("value1"));

			// Wait for potential save
			await Bun.sleep(1100);

			// Verify snapshot was not created
			expect(existsSync(snapshotPath)).toBe(false);
		});

		test("should handle multiple save rules", async () => {
			snapshotManager = new SnapshotManager(
				"1 5 2 2",
				"test-dump.json",
				testDir,
			);
			snapshotManager.start();

			// Make changes to trigger second rule
			store.set("key1", Buffer.from("value1"));
			store.set("key2", Buffer.from("value2"));

			// Wait for save rule to trigger
			await Bun.sleep(2100);

			// Verify snapshot was created
			expect(existsSync(snapshotPath)).toBe(true);
		});
	});

	describe("Resource Management", () => {
		test("should stop and restart snapshot manager", async () => {
			snapshotManager = new SnapshotManager("1 1", "test-dump.json", testDir);

			// Start and make changes
			snapshotManager.start();
			store.set("key1", Buffer.from("value1"));

			// Stop before save rule triggers
			snapshotManager.stop();
			await Bun.sleep(1100);

			// Verify no snapshot was created
			expect(existsSync(snapshotPath)).toBe(false);

			// Restart and wait for save
			snapshotManager.start();
			await Bun.sleep(1100);

			// Verify snapshot was created after restart
			expect(existsSync(snapshotPath)).toBe(true);
		});

		test("should handle rapid start/stop cycles", () => {
			snapshotManager = new SnapshotManager("1 1", "test-dump.json", testDir);

			for (let i = 0; i < 10; i++) {
				snapshotManager.start();
				snapshotManager.stop();
			}

			// Should not throw or leave dangling timers
		});
	});
});
