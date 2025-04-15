import type { Socket } from "bun";
import { commandMap } from "../commands/index";
import { RESPParser } from "../protocol/parser";
import { formatError } from "../protocol/resp";
import { store } from "../store/store";
import { debug } from "../utils/debug";

// Use WeakMap to store parser instances per socket
const clientParsers = new WeakMap<Socket, RESPParser>();

// Pre-create common error messages as buffers for better performance
const COMMON_ERRORS = {
	EMPTY_COMMAND: Buffer.from(
		formatError("protocol error: received empty command array"),
	),
	EMPTY_NAME: Buffer.from(
		formatError("protocol error: received empty command name"),
	),
} as const;

// Cache for uppercase command names
const commandNameCache = new Map<string, string>();

function getUpperCaseCommand(name: string): string {
	let upperName = commandNameCache.get(name);
	if (!upperName) {
		upperName = name.toUpperCase();
		commandNameCache.set(name, upperName);
	}
	return upperName;
}

function handleCommand(commandArgs: string[], socket: Socket) {
	if (!Array.isArray(commandArgs) || commandArgs.length === 0) {
		socket.write(COMMON_ERRORS.EMPTY_COMMAND);
		return;
	}

	const commandNameArg = commandArgs[0];
	if (
		commandNameArg === undefined ||
		commandNameArg === null ||
		commandNameArg === ""
	) {
		socket.write(COMMON_ERRORS.EMPTY_NAME);
		return;
	}

	const commandName = getUpperCaseCommand(commandNameArg);
	const handler = commandMap.get(commandName);

	if (handler) {
		try {
			const args = commandArgs.slice(1);
			handler(args, socket, store);
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			debug.error(`Error executing command '${commandName}':`, error);
			socket.write(Buffer.from(formatError(errorMessage)));
		}
	} else {
		socket.write(
			Buffer.from(formatError(`unknown command \`${commandName}\``)),
		);
	}
}

export function handleSocketOpen(socket: Socket) {
	debug.log("Client connected", socket.remoteAddress);

	const parser = new RESPParser((commandArgs: string[]) => {
		debug.log(`Received command from ${socket.remoteAddress}:`, commandArgs);
		handleCommand(commandArgs, socket);
	});

	clientParsers.set(socket, parser);
}

export function handleSocketData(socket: Socket, data: Buffer) {
	const parser = clientParsers.get(socket);
	if (parser) {
		try {
			parser.parse(data);
		} catch (error: unknown) {
			debug.error(`Parser error for ${socket.remoteAddress}:`, error);
			const errorMessage =
				error instanceof Error ? error.message : "Invalid input";
			socket.write(Buffer.from(formatError(errorMessage)));
			clientParsers.delete(socket);
		}
	} else {
		debug.error("Parser not found for socket:", socket.remoteAddress);
	}
}

export function handleSocketClose(socket: Socket) {
	debug.log("Client disconnected", socket.remoteAddress);
	clientParsers.delete(socket);
}

export function handleSocketError(socket: Socket, error: Error) {
	debug.error(`Socket error (${socket.remoteAddress}):`, error);
	clientParsers.delete(socket);
}

export function handleSocketDrain(socket: Socket) {
	debug.log(`Socket drained (${socket.remoteAddress})`);
}
