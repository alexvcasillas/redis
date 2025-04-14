import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { debug } from "../utils/debug";

export class SnapshotManager {
	private lastSave: Date | null = null;

	/**
	 * Saves the current state of the store to a snapshot file.
	 * Uses JSON format with Buffers encoded as base64.
	 */
	saveSnapshot(filePath: string, store: Map<string, Buffer>): void {
		try {
			debug.log(`Saving snapshot to ${filePath}...`);
			const snapshotData: Record<string, string> = {};

			for (const [key, value] of store.entries()) {
				snapshotData[key] = value.toString("base64");
			}

			const dir = dirname(filePath);
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true });
				debug.log(`Created directory ${dir}`);
			}

			writeFileSync(filePath, JSON.stringify(snapshotData));
			this.lastSave = new Date();
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
	loadSnapshot(filePath: string): Map<string, Buffer> {
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

			this.lastSave = new Date();
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

	getLastSaveTime(): Date | null {
		return this.lastSave;
	}
}

// Export a singleton instance
export const snapshotManager = new SnapshotManager();
