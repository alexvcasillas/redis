import type { Socket } from "bun";
import type { KeyValueStore } from "../store/store";
import { debug } from "../utils/debug";

// Common string constants
const ERROR_PREFIX = "-ERR ";
const CRLF = "\r\n";

// Pre-formatted responses for common cases
const NULL_RESPONSE = Buffer.from("$-1\r\n");
const OK_RESPONSE = Buffer.from("+OK\r\n");
const PONG_RESPONSE = Buffer.from("+PONG\r\n");
const ZERO_RESPONSE = Buffer.from(":0\r\n");
const ONE_RESPONSE = Buffer.from(":1\r\n");
const TWO_RESPONSE = Buffer.from(":2\r\n");
const THREE_RESPONSE = Buffer.from(":3\r\n");
const SYNTAX_ERROR_RESPONSE = Buffer.from("-ERR syntax error\r\n");

// Buffer pool for bulk strings
const bulkStringBuffers = new Map<number, Buffer>();
const MAX_CACHED_BULK_LENGTH = 1024; // Only cache responses up to 1KB

// --- RESP Response Formatting --- //
export function formatSimpleString(str: string): Buffer {
	if (str === "OK") return OK_RESPONSE;
	if (str === "PONG") return PONG_RESPONSE;
	return Buffer.from(`+${str}\r\n`);
}

export function formatInteger(num: number): Buffer {
	switch (num) {
		case 0:
			return ZERO_RESPONSE;
		case 1:
			return ONE_RESPONSE;
		case 2:
			return TWO_RESPONSE;
		case 3:
			return THREE_RESPONSE;
		default:
			return Buffer.from(`:${num}\r\n`);
	}
}

export function formatBulkString(str: Buffer | string | null): Buffer {
	if (str === null) {
		return NULL_RESPONSE;
	}

	const buffer = Buffer.isBuffer(str) ? str : Buffer.from(str);
	return Buffer.concat([
		Buffer.from(`$${buffer.length}\r\n`),
		buffer,
		Buffer.from("\r\n"),
	]);
}

export function formatError(msg: string): Buffer {
	if (msg === "ERR syntax error") return SYNTAX_ERROR_RESPONSE;
	return Buffer.from(`-ERR ${msg}\r\n`);
}

export function formatNull(): Buffer {
	return NULL_RESPONSE;
}

// Define the structure for a command handler function
export type CommandHandler = (
	args: string[],
	socket: Socket, // Pass socket for writing response
	store: KeyValueStore, // Pass store for data operations
) => void | Promise<void>; // Allow async handlers if needed

// Create the command map
export const commandMap = new Map<string, CommandHandler>();

// Function to register commands (optional helper)
export function registerCommand(name: string, handler: CommandHandler) {
	commandMap.set(name.toUpperCase(), handler);
}

import { handleConfig } from "./config";
import { handleDel } from "./del";
import { handleGet } from "./get";
// --- Import Handlers ---
import { handlePing } from "./ping";
import { handleSet } from "./set";

// --- Register Commands ---
registerCommand("PING", handlePing);
registerCommand("SET", handleSet);
registerCommand("GET", handleGet);
registerCommand("DEL", handleDel);
registerCommand("CONFIG", handleConfig);

debug.log("Command registry initialized.");
debug.log("Registered commands:", Array.from(commandMap.keys()));
