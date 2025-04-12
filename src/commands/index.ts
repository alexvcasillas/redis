import type { Socket } from "bun";
import type { KeyValueStore } from "../store/store";

// --- RESP Response Formatting --- //
export function formatSimpleString(str: string): string {
	return `+${str}\r\n`;
}

export function formatError(err: string): string {
	return `-${err}\r\n`;
}

export function formatInteger(num: number): string {
	return `:${num}\r\n`;
}

export function formatBulkString(str: Buffer | string | null): string {
	if (str === null) {
		return "$-1\r\n";
	}
	const buffer = Buffer.isBuffer(str) ? str : Buffer.from(str);
	return `$${buffer.length}\r\n${buffer.toString("binary")}\r\n`;
}

export function formatNull(): string {
	return "$-1\r\n";
}

// TODO: formatArray

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

console.log("Command registry initialized.");
console.log("Registered commands:", Array.from(commandMap.keys()));
