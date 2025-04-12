import type { Socket } from "bun";
import type { KeyValueStore } from "../store/store";
import { formatBulkString, formatError, formatNull } from "./index";

export function handleGet(
	args: string[],
	socket: Socket,
	store: KeyValueStore,
): void {
	if (args.length !== 1) {
		socket.write(
			formatError("ERR wrong number of arguments for 'get' command"),
		);
		return;
	}

	const key = args[0];

	if (key === undefined) {
		socket.write(formatError("ERR syntax error"));
		return;
	}

	const value = store.get(key);

	if (value === undefined) {
		socket.write(formatNull()); // Key not found
	} else {
		socket.write(formatBulkString(value)); // Return value as Buffer
	}
}
