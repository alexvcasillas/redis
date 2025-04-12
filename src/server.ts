import * as path from "node:path"; // For path manipulation
import type { Socket } from "bun";
import { commandMap, formatError } from "./commands/index"; // Import command map and error formatter
import { RESPParser } from "./protocol/parser"; // Import the parser
import { store } from "./store/store"; // Import the store instance

// --- Snapshot Configuration ---
const dbFilename = process.env.REDIS_DBFILENAME || "dump.json";
const dbDirectory = process.env.REDIS_DIR || "./data"; // Relative to project root
// Resolve the directory relative to the current working directory
const snapshotDirectory = path.resolve(process.cwd(), dbDirectory);
const snapshotFilePath = path.join(snapshotDirectory, dbFilename);
console.log(`Snapshot file path configured to: ${snapshotFilePath}`);

interface SaveRule {
	seconds: number;
	changes: number;
}
const saveRules: SaveRule[] = [];
const saveConfig = process.env.REDIS_SAVE || "900 1 300 10"; // e.g., "900 1 300 10"

if (saveConfig.trim()) {
	const parts = saveConfig.trim().split(/\s+/);
	if (parts.length % 2 !== 0) {
		console.error(
			"Invalid REDIS_SAVE format: Must be pairs of seconds and changes.",
		);
	} else {
		try {
			for (let i = 0; i < parts.length; i += 2) {
				const secondsStr = parts[i];
				const changesStr = parts[i + 1];

				// Explicit check to satisfy stricter linters, though length check should prevent this
				if (secondsStr === undefined || changesStr === undefined) {
					console.error(
						"Internal error parsing REDIS_SAVE: Unexpected undefined part.",
					);
					break; // Stop processing further rules
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
				saveRules.push({ seconds, changes });
			}
			if (saveRules.length > 0) {
				console.log("Configured save rules:", saveRules);
			} else {
				// This case might happen if the input was valid pairs but all resulted in non-positive numbers, although the check above prevents it.
				console.log("Snapshotting is disabled (no valid rules parsed).");
			}
		} catch (err) {
			console.error(
				"Error parsing REDIS_SAVE rules:",
				err instanceof Error ? err.message : err,
			);
			saveRules.length = 0; // Clear rules on error
		}
	}
}

// Load snapshot *before* listening
try {
	store.loadSnapshot(snapshotFilePath);
} catch (loadError) {
	console.error("Critical error during initial snapshot load:", loadError);
	// Decide if you want to exit or continue with an empty store
	// process.exit(1);
}

// Setup snapshot timer if rules exist
if (saveRules.length > 0) {
	const checkInterval = 1000; // Check every 1 second (1000 ms)
	console.log(`Snapshot check interval set to ${checkInterval}ms.`);

	setInterval(() => {
		try {
			const dirtyCount = store.getDirtyCount();
			if (dirtyCount === 0) {
				// No changes, no need to check time
				return;
			}

			const lastSaveTime = store.getLastSaveTime();
			const now = new Date();
			// If never saved, treat epoch as last save time for time comparison, ensuring first save happens if changes condition is met
			const elapsedSeconds =
				lastSaveTime === null
					? Number.POSITIVE_INFINITY
					: (now.getTime() - lastSaveTime.getTime()) / 1000;

			let shouldSave = false;
			for (const rule of saveRules) {
				if (dirtyCount >= rule.changes && elapsedSeconds >= rule.seconds) {
					console.log(
						`Snapshot condition met: ${dirtyCount} changes >= ${rule.changes} changes && ${elapsedSeconds.toFixed(0)}s elapsed >= ${rule.seconds}s.`,
					);
					shouldSave = true;
					break; // Found a reason to save
				}
			}

			if (shouldSave) {
				store.saveSnapshot(snapshotFilePath); // snapshotFilePath needs to be defined
			}
		} catch (intervalError) {
			// Prevent interval from stopping due to an error within the check
			console.error("Error during snapshot check interval:", intervalError);
		}
	}, checkInterval);
} else {
	console.log("Snapshotting is disabled (no REDIS_SAVE rules configured).");
}
// --- End Snapshot Configuration & Setup ---

// Use WeakMap to store parser instances per socket
const clientParsers = new WeakMap<Socket, RESPParser>();

const server = Bun.listen({
	hostname: "127.0.0.1",
	port: Number(process.env.PORT) || 6379,
	socket: {
		open(socket: Socket) {
			console.log("Client connected", socket.remoteAddress);

			// Create a parser for this client
			const parser = new RESPParser((commandArgs: string[]) => {
				// This callback is invoked when a full command is parsed
				console.log(
					`Received command from ${socket.remoteAddress}:`,
					commandArgs,
				);

				if (commandArgs.length === 0) {
					// Empty command, ignore or send error?
					socket.write(
						formatError("ERR protocol error: received empty command array"),
					);
					return;
				}

				// Guaranteed to have at least one element now
				const commandNameArg = commandArgs[0];

				// Explicit check for undefined to satisfy linter
				if (commandNameArg === undefined) {
					socket.write(
						formatError("ERR protocol error: received empty command name"),
					);
					return;
				}

				const commandName = commandNameArg.toUpperCase();
				const handler = commandMap.get(commandName);

				if (handler) {
					try {
						// Execute the command handler
						const args = commandArgs.slice(1);
						handler(args, socket, store);
						// Note: Response writing is now handled within each command handler
					} catch (error: unknown) {
						console.error(`Error executing command '${commandName}':`, error);
						// Send a generic error back to the client
						const errorMessage =
							error instanceof Error ? error.message : "Unknown error";
						socket.write(
							formatError(
								`ERR executing command '${commandName}': ${errorMessage}`,
							),
						);
					}
				} else {
					// Unknown command
					socket.write(formatError(`ERR unknown command \`${commandName}\``));
				}
			});

			// Store the parser instance
			clientParsers.set(socket, parser);
		},
		data(socket: Socket, data: Buffer) {
			// Get the parser for this client
			const parser = clientParsers.get(socket);
			if (parser) {
				try {
					parser.parse(data); // Feed data to the parser
				} catch (error: unknown) {
					console.error(`Parser error for ${socket.remoteAddress}:`, error);
					// Send error response and/or close connection on parser error
					const errorMessage =
						error instanceof Error ? error.message : "Invalid input";
					socket.write(formatError(`ERR protocol error: ${errorMessage}`));
					// Consider closing the socket on severe parsing errors
					// socket.end();
					clientParsers.delete(socket); // Clean up broken parser state
				}
			} else {
				// This should ideally not happen if open logic is correct
				console.error("Parser not found for socket:", socket.remoteAddress);
				// socket.end();
			}
		},
		close(socket: Socket) {
			console.log("Client disconnected", socket.remoteAddress);
			// Clean up parser instance
			clientParsers.delete(socket);
		},
		error(socket: Socket, error: Error) {
			console.error(`Socket error (${socket.remoteAddress}):`, error);
			// Clean up parser instance on error too
			clientParsers.delete(socket);
		},
		drain(socket: Socket) {
			// Handle backpressure if needed
			console.log(`Socket drained (${socket.remoteAddress})`);
		},
	},
});

console.log(`Bun Redis server listening on ${server.hostname}:${server.port}`);
