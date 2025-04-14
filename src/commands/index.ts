import type { Socket } from "bun";
import type { KeyValueStore } from "../store/store";
import { debug } from "../utils/debug";

// Define the structure for a command handler function
export type CommandHandler = (
	args: string[],
	socket: Socket,
	store: KeyValueStore,
) => void | Promise<void>;

// Command handlers
import { handleConfig } from "./config";
import { handleDel } from "./del";
import { handleGet } from "./get";
import { handlePing } from "./ping";
import { handleSet } from "./set";

// Command registry - maps command names to their handlers
export const commands = {
	PING: handlePing,
	SET: handleSet,
	GET: handleGet,
	DEL: handleDel,
	CONFIG: handleConfig,
} as const;

// Type-safe command map
export const commandMap = new Map<string, CommandHandler>(
	Object.entries(commands),
);

debug.log("Command registry initialized.");
debug.log("Registered commands:", Array.from(commandMap.keys()));

// Re-export command handlers for testing
export { handleConfig, handleDel, handleGet, handlePing, handleSet };
