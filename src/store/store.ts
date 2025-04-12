import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Simple in-memory key-value store with snapshot persistence.
 * Stores values as Buffers for efficiency.
 */
export class KeyValueStore {
	private store: Map<string, Buffer>;
	private dirty: number; // Number of changes since last save
	private lastSave: Date | null; // Time of the last successful save

	constructor() {
		this.store = new Map<string, Buffer>();
		this.dirty = 0;
		this.lastSave = null;
		console.log("In-memory store initialized.");
	}

	/**
	 * Retrieves the value (Buffer) associated with a key.
	 * Returns undefined if the key doesn't exist.
	 * TODO: Implement TTL logic here or in a wrapper.
	 */
	get(key: string): Buffer | undefined {
		// TODO: Check TTL before returning
		return this.store.get(key);
	}

	/**
	 * Stores a key-value pair.
	 * Increments the dirty counter.
	 * TODO: Handle TTL options (EX, PX).
	 */
	set(key: string, value: Buffer /*, ttl?: number */): void {
		this.store.set(key, value);
		this.dirty++;
		// TODO: Set TTL if provided
	}

	/**
	 * Deletes a key-value pair.
	 * Returns true if a key was deleted, false otherwise.
	 * Increments the dirty counter if a key was actually deleted.
	 */
	delete(key: string): boolean {
		// TODO: Clear associated TTL
		const deleted = this.store.delete(key);
		if (deleted) {
			this.dirty++;
		}
		return deleted;
	}

	getDirtyCount(): number {
		return this.dirty;
	}

	getLastSaveTime(): Date | null {
		return this.lastSave;
	}

	/**
	 * Saves the current state of the store to a snapshot file.
	 * Uses JSON format with Buffers encoded as base64.
	 * @param filePath The absolute path to the snapshot file.
	 */
	saveSnapshot(filePath: string): void {
		if (this.dirty === 0 && this.lastSave !== null) {
			// Avoid saving if nothing changed since the last successful save
			// console.log("No changes since last save, skipping snapshot.");
			return;
		}

		console.log(`Saving snapshot to ${filePath}...`);
		const snapshotData: Record<string, string> = {};
		// Use Object.fromEntries for potentially cleaner Map -> Object conversion
		for (const [key, value] of this.store.entries()) {
			snapshotData[key] = value.toString("base64");
		}

		try {
			// Ensure directory exists
			const dir = dirname(filePath);
			if (!existsSync(dir)) {
				// Use { recursive: true } to create parent directories if needed
				mkdirSync(dir, { recursive: true });
				console.log(`Created directory ${dir}`);
			}

			// Write synchronously to ensure data is saved before proceeding in typical Redis fashion
			// Consider async for non-blocking, but Redis save is often blocking.
			writeFileSync(filePath, JSON.stringify(snapshotData)); // Compact format is fine
			const saveTime = new Date();
			this.lastSave = saveTime;
			this.dirty = 0; // Reset dirty counter after successful save
			console.log(
				`Snapshot saved successfully to ${filePath} at ${saveTime.toISOString()}.`,
			);
		} catch (error) {
			console.error(`Error saving snapshot to ${filePath}:`, error);
			// Avoid resetting dirty count if save failed
		}
	}

	/**
	 * Loads the store state from a snapshot file.
	 * @param filePath The absolute path to the snapshot file.
	 */
	loadSnapshot(filePath: string): void {
		if (!existsSync(filePath)) {
			console.log(`Snapshot file ${filePath} not found, starting fresh.`);
			return;
		}

		console.log(`Loading snapshot from ${filePath}...`);
		try {
			const fileContent = readFileSync(filePath, "utf-8");
			// Handle empty file case
			if (!fileContent) {
				console.log(`Snapshot file ${filePath} is empty, starting fresh.`);
				this.store = new Map<string, Buffer>();
				this.dirty = 0;
				this.lastSave = null; // Or new Date() if we consider loading an empty file a "save"?
				return;
			}

			const snapshotData: Record<string, string> = JSON.parse(fileContent);

			const newStore = new Map<string, Buffer>();
			for (const [key, base64Value] of Object.entries(snapshotData)) {
				// Basic validation for base64 format could be added here
				newStore.set(key, Buffer.from(base64Value, "base64"));
			}

			this.store = newStore; // Replace the old map
			this.lastSave = new Date(); // Consider the load time as the "last save" time
			this.dirty = 0; // Reset dirty counter as we loaded a clean state
			console.log(
				`Snapshot loaded successfully from ${filePath}. Store contains ${this.store.size} keys.`,
			);
		} catch (error) {
			console.error(`Error loading snapshot from ${filePath}:`, error);
			// If loading fails (e.g., corrupted JSON), start with an empty store
			console.warn(
				"Proceeding with an empty store due to snapshot load error.",
			);
			this.store = new Map<string, Buffer>();
			this.dirty = 0;
			this.lastSave = null;
		}
	}

	// Optional: Add methods for other commands like EXISTS, KEYS etc. later
}

// Export a singleton instance for the application to use
// The loading logic will be called on this instance from server.ts at startup.
export const store = new KeyValueStore();
