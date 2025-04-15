import type { Socket } from "bun";
import {
	formatBulkString,
	formatError,
	formatSimpleString,
} from "../protocol/resp";
import type { KeyValueStore } from "../store/store";

export function handlePing(
	args: string[],
	socket: Socket,
	store: KeyValueStore, // Included for consistency, though not used by PING
): void {
	if (args.length > 1) {
		socket.write(
			Buffer.from(formatError("wrong number of arguments for 'ping' command")),
		);
		return;
	}

	if (args.length === 1) {
		const message = args[0];
		if (message === undefined) {
			socket.write(Buffer.from(formatError("PING argument is missing")));
			return;
		}
		socket.write(formatBulkString(message));
		return;
	}

	// PING
	socket.write(formatSimpleString("PONG"));
}
