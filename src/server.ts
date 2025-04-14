import * as path from "node:path"; // For path manipulation
import { store } from "./store/store";
import { SnapshotManager } from "./persistence/snapshot-manager";
import {
	handleSocketOpen,
	handleSocketData,
	handleSocketClose,
	handleSocketError,
	handleSocketDrain,
} from "./socket/handlers";
import { debug } from "./utils/debug";

// Initialize snapshot manager with environment variables or defaults
const snapshotManager = new SnapshotManager(
	process.env.REDIS_SAVE ?? "900 1 300 10",
	process.env.REDIS_DBFILENAME,
	process.env.REDIS_DIR,
);

// Load snapshot *before* listening
snapshotManager.loadInitialSnapshot();

// Start snapshot manager
snapshotManager.start();

const server = Bun.listen({
	hostname: "127.0.0.1",
	port: Number(process.env.PORT) || 6379,
	socket: {
		open: handleSocketOpen,
		data: handleSocketData,
		close: handleSocketClose,
		error: handleSocketError,
		drain: handleSocketDrain,
	},
});

console.log(`Bun Redis server listening on ${server.hostname}:${server.port}`);

// Handle graceful shutdown
process.on("SIGINT", () => {
	debug.log("\nGracefully shutting down...");
	snapshotManager.stop(); // Stop the snapshot manager
	store.saveSnapshot(snapshotManager.getSnapshotFilePath()); // Save final snapshot
	store.dispose(); // Clean up TTL manager
	process.exit(0);
});

process.on("SIGTERM", () => {
	debug.log("\nGracefully shutting down...");
	snapshotManager.stop(); // Stop the snapshot manager
	store.saveSnapshot(snapshotManager.getSnapshotFilePath()); // Save final snapshot
	store.dispose(); // Clean up TTL manager
	process.exit(0);
});
