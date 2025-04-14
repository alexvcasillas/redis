import * as path from "node:path";
import { store } from "../store/store";
import { existsSync } from "node:fs";
import { debug } from "../utils/debug";

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
		this.scheduleNextCheck();
	}

	private parseRules(saveConfig: string) {
		if (!saveConfig.trim()) return;

		const parts = saveConfig.trim().split(/\s+/);
		if (parts.length % 2 !== 0) {
			console.error(
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
					console.error(
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
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}

		if (this.rules.length === 0) return;

		const now = Date.now();
		const dirtyCount = store.getDirtyCount();

		// If dirty count hasn't changed and we haven't hit any time thresholds, no need to check
		if (dirtyCount === this.lastDirtyCount && now < this.nextCheckTime) return;

		this.lastDirtyCount = dirtyCount;

		if (dirtyCount === 0) {
			// No changes, schedule far future check
			this.nextCheckTime = now + 60000; // Check again in 1 minute
		} else {
			// Find the earliest time we need to check based on current rules
			let earliestCheck = Number.POSITIVE_INFINITY;
			const elapsedSeconds = (now - this.lastSaveTime) / 1000;

			for (const rule of this.rules) {
				if (dirtyCount >= rule.changes) {
					const timeUntilSave = Math.max(
						0,
						(rule.seconds - elapsedSeconds) * 1000,
					);
					earliestCheck = Math.min(earliestCheck, timeUntilSave);
				}
			}

			if (earliestCheck === 0) {
				// Need to save now
				this.save();
				return;
			}

			// Set next check time
			this.nextCheckTime = now + Math.min(earliestCheck, 60000); // Cap at 1 minute
		}

		// Schedule next check
		const delay = Math.max(0, this.nextCheckTime - now);
		this.timer = setTimeout(() => this.scheduleNextCheck(), delay);
	}

	private save() {
		try {
			store.saveSnapshot(this.snapshotFilePath);
			this.lastSaveTime = Date.now();
			this.lastDirtyCount = 0;
			this.scheduleNextCheck();
		} catch (error) {
			debug.error("Error during snapshot save:", error);
		}
	}

	public start() {
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

	public loadInitialSnapshot(): void {
		try {
			store.loadSnapshot(this.snapshotFilePath);
		} catch (loadError) {
			debug.error("Critical error during initial snapshot load:", loadError);
			// Decide if you want to exit or continue with an empty store
			// process.exit(1);
		}
	}
}
