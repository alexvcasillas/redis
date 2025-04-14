import type { Socket } from "bun";
import { formatError, formatSimpleString } from "../protocol/resp";
import type { KeyValueStore } from "../store/store";

export function handleSet(
	args: string[],
	socket: Socket,
	store: KeyValueStore,
): void {
	if (args.length !== 2) {
		socket.write(
			formatError("ERR wrong number of arguments for 'set' command"),
		);
		return;
	}

	const key = args[0];
	const value = args[1];

	if (key === undefined || value === undefined) {
		// Should be caught by length check, but belts and suspenders
		socket.write(formatError("ERR syntax error"));
		return;
	}

	// Store value as Buffer
	store.set(key, Buffer.from(value));

	// TODO: Handle options like EX, PX, NX, XX

	socket.write(formatSimpleString("OK"));
}
