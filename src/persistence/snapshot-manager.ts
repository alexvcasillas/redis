import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { debug } from "../utils/debug";
import type { KeyValueStore } from "../store/store";

interface SaveRule {
	seconds: number;
	changes: number;
}

export class SnapshotManager {
	private rules: SaveRule[] = [];
	private nextCheckTime = 0;
	private timer: NodeJS.Timeout | null = null;
	private lastSaveTime = Date.now();
	private lastDirtyCount = 0;
	private snapshotFilePath: string;
	private store: KeyValueStore | null = null;

	constructor(
		saveConfig: string,
		dbFilename = "dump.json",
		dbDirectory = "./data",
	) {
		// Configure snapshot path
		const snapshotDirectory = path.resolve(process.cwd(), dbDirectory);
		this.snapshotFilePath = path.join(snapshotDirectory, dbFilename);
		debug.log(`Snapshot file path configured to: ${this.snapshotFilePath}`);

		this.parseRules(saveConfig);
	}

	public setStore(store: KeyValueStore): void {
		this.store = store;
		this.scheduleNextCheck();
	}

	private parseRules(saveConfig: string) {
		if (!saveConfig.trim()) return;

		const parts = saveConfig.trim().split(/\s+/);
		if (parts.length % 2 !== 0) {
			debug.warn(
				"Invalid REDIS_SAVE format: Must be pairs of seconds and changes.",
			);
			return;
		}

		try {
			for (let i = 0; i < parts.length; i += 2) {
				const secondsStr = parts[i];
				const changesStr = parts[i + 1];

				// Explicit check for undefined values
				if (
					typeof secondsStr === "undefined" ||
					typeof changesStr === "undefined"
				) {
					debug.error(
						"Internal error parsing REDIS_SAVE: Unexpected undefined part.",
					);
					break;
				}

				const seconds = Number.parseInt(secondsStr, 10);
				const changes = Number.parseInt(changesStr, 10);

				if (
					Number.isNaN(seconds) ||
					Number.isNaN(changes) ||
					seconds <= 0 ||
					changes <= 0
				) {
					throw new Error(`Invalid rule pair: ${secondsStr} ${changesStr}`);
				}
				this.rules.push({ seconds, changes });
			}

			if (this.rules.length > 0) {
				debug.log("Configured save rules:", this.rules);
			} else {
				debug.log("Snapshotting is disabled (no valid rules parsed).");
			}
		} catch (err) {
			debug.error(
				"Error parsing REDIS_SAVE rules:",
				err instanceof Error ? err.message : err,
			);
			this.rules = [];
		}
	}

	private scheduleNextCheck() {
		if (!this.store) {
			debug.warn("Store not set, skipping snapshot check scheduling");
			return;
		}

		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}

		if (this.rules.length === 0) return;

		const now = Date.now();
		const dirtyCount = this.store.getDirtyCount();

		// Check if we need to save now based on rules
		const elapsedSeconds = (now - this.lastSaveTime) / 1000;

		for (const rule of this.rules) {
			if (dirtyCount >= rule.changes && elapsedSeconds >= rule.seconds) {
				// Need to save now
				this.save();
				return;
			}
		}

		// If no immediate save needed, schedule next check
		let earliestCheck = Number.POSITIVE_INFINITY;

		for (const rule of this.rules) {
			if (dirtyCount >= rule.changes) {
				const timeUntilSave = Math.max(
					0,
					(rule.seconds - elapsedSeconds) * 1000,
				);
				earliestCheck = Math.min(earliestCheck, timeUntilSave);
			}
		}

		// If no rules match current dirty count, check again in 1 minute
		if (earliestCheck === Number.POSITIVE_INFINITY) {
			earliestCheck = 60000;
		}

		// Schedule next check
		const delay = Math.max(0, earliestCheck);
		this.timer = setTimeout(() => {
			this.scheduleNextCheck();
		}, delay);
	}

	/**
	 * Saves the current state of the store to a snapshot file.
	 * Uses JSON format with Buffers encoded as base64.
	 */
	private saveSnapshotToFile(
		store: Map<string, Buffer>,
		filePath: string,
	): void {
		try {
			debug.log(`Saving snapshot to ${filePath}...`);
			const snapshotData: Record<string, string> = {};

			for (const [key, value] of store.entries()) {
				snapshotData[key] = value.toString("base64");
			}

			const dir = path.dirname(filePath);
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true });
				debug.log(`Created directory ${dir}`);
			}

			writeFileSync(filePath, JSON.stringify(snapshotData));
			debug.log(
				`Snapshot saved to ${filePath} (${store.size} keys, ${JSON.stringify(snapshotData).length} bytes)`,
			);
		} catch (error) {
			debug.error(`Error saving snapshot to ${filePath}:`, error);
			throw error; // Propagate error to caller
		}
	}

	/**
	 * Loads the store state from a snapshot file.
	 * Returns a new Map with the loaded data.
	 */
	private loadSnapshotFromFile(filePath: string): Map<string, Buffer> {
		try {
			if (!existsSync(filePath)) {
				debug.log(`Snapshot file ${filePath} not found, starting fresh.`);
				return new Map<string, Buffer>();
			}

			debug.log(`Loading snapshot from ${filePath}...`);
			const fileContent = readFileSync(filePath, "utf-8");

			if (!fileContent) {
				debug.log(`Snapshot file ${filePath} is empty, starting fresh.`);
				return new Map<string, Buffer>();
			}

			const snapshotData: Record<string, string> = JSON.parse(fileContent);
			const loadedStore = new Map<string, Buffer>();

			for (const [key, base64Value] of Object.entries(snapshotData)) {
				loadedStore.set(key, Buffer.from(base64Value, "base64"));
			}

			debug.log(
				`Snapshot loaded from ${filePath} (${loadedStore.size} keys, ${JSON.stringify(snapshotData).length} bytes)`,
			);

			return loadedStore;
		} catch (error) {
			debug.error(`Error loading snapshot from ${filePath}:`, error);
			debug.warn(
				"Starting fresh due to snapshot load error. Data may be lost.",
			);
			return new Map<string, Buffer>();
		}
	}

	private save() {
		if (!this.store) {
			debug.warn("Store not set, skipping snapshot save");
			return;
		}

		try {
			this.saveSnapshotToFile(this.store.getStore(), this.snapshotFilePath);
			this.lastSaveTime = Date.now();
			this.lastDirtyCount = 0;
			this.scheduleNextCheck();
		} catch (error) {
			debug.error("Error during snapshot save:", error);
		}
	}

	public start() {
		if (!this.store) {
			debug.warn("Store not set, cannot start snapshot manager");
			return;
		}
		this.scheduleNextCheck();
	}

	public stop() {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
	}

	public getSnapshotFilePath(): string {
		return this.snapshotFilePath;
	}

	public getLastSaveTime(): Date | null {
		return new Date(this.lastSaveTime);
	}

	public loadInitialSnapshot(): void {
		if (!this.store) {
			debug.warn("Store not set, skipping initial snapshot load");
			return;
		}

		try {
			const loadedStore = this.loadSnapshotFromFile(this.snapshotFilePath);
			this.store.loadFromSnapshot(loadedStore);
		} catch (loadError) {
			debug.error("Critical error during initial snapshot load:", loadError);
			// Decide if you want to exit or continue with an empty store
			// process.exit(1);
		}
	}

	public saveSnapshot(filePath: string): void {
		if (!this.store) {
			debug.warn("Store not set, skipping snapshot save");
			return;
		}
		this.saveSnapshotToFile(this.store.getStore(), filePath);
		this.lastSaveTime = Date.now();
	}

	/**
	 * Manually trigger a check for snapshot conditions.
	 * @internal Used for testing only
	 */
	public checkNow(): void {
		if (!this.store || this.timer === null) {
			debug.warn("Store not set or manager stopped, skipping snapshot check");
			return;
		}
		this.scheduleNextCheck();
	}
}

// Export a singleton instance
export const snapshotManager = new SnapshotManager(
	process.env.REDIS_SAVE ?? "900 1 300 10",
	process.env.REDIS_DBFILENAME,
	process.env.REDIS_DIR,
);
