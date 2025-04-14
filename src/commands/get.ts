import type { Socket } from "bun";
import type { KeyValueStore } from "../store/store";
import { formatBulkString, formatError, formatNull } from "./index";

// Pre-format common error for GET
const GET_WRONG_ARGS = formatError(
	"ERR wrong number of arguments for 'get' command",
);
const GET_SYNTAX_ERROR = formatError("ERR syntax error");

export function handleGet(
	args: string[],
	socket: Socket,
	store: KeyValueStore,
): void {
	if (args.length !== 1) {
		socket.write(GET_WRONG_ARGS);
		return;
	}

	const key = args[0];

	if (key === undefined) {
		socket.write(GET_SYNTAX_ERROR);
		return;
	}

	const value = store.get(key);

	if (value === undefined) {
		socket.write(formatNull()); // Key not found
	} else {
		socket.write(formatBulkString(value)); // Return value as Buffer
	}
}
