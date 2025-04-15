import type { Socket } from "bun";
import { NULL_RESPONSE, formatBulkString, formatError } from "../protocol/resp";
import type { KeyValueStore } from "../store/store";

// Pre-format common error for GET
const GET_WRONG_ARGS = formatError(
	"wrong number of arguments for 'get' command",
);
// Pre-create common responses for better performance
const GET_SYNTAX_ERROR = formatError("syntax error");

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

	// A null bulk string becomes an empty string in our parser
	// We should treat both empty strings and undefined as invalid keys
	if (key === undefined || key === "") {
		socket.write(GET_SYNTAX_ERROR);
		return;
	}

	const value = store.get(key);

	if (!value) {
		socket.write(NULL_RESPONSE); // Key not found
	} else {
		socket.write(formatBulkString(value)); // Return value as Buffer
	}
}
