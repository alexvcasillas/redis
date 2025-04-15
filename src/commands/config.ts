import type { Socket } from "bun";
import { formatBulkString, formatError } from "../protocol/resp";
import type { KeyValueStore } from "../store/store";

// Basic implementation to handle CONFIG GET for redis-benchmark
// Doesn't actually get/set real config yet.
export function handleConfig(
	args: string[],
	socket: Socket,
	store: KeyValueStore, // Not used by CONFIG GET
): void {
	if (args.length === 0) {
		socket.write(
			Buffer.from(
				formatError("wrong number of arguments for 'config' command"),
			),
		);
		return;
	}

	const subCommand = args[0];

	if (subCommand === undefined) {
		socket.write(
			Buffer.from(
				formatError("wrong number of arguments for 'config' command"),
			),
		);
		return;
	}

	const subCommandLower = subCommand.toLowerCase();

	if (subCommandLower === "get") {
		if (args.length !== 2) {
			socket.write(
				Buffer.from(
					formatError("wrong number of arguments for 'config|get' command"),
				),
			);
			return;
		}
		const parameter = args[1];
		if (parameter === undefined) {
			socket.write(Buffer.from(formatError("syntax error")));
			return;
		}

		// Respond like Redis: an array of [parameterName, value]
		// For now, just return an empty string as the value for any parameter.
		// Redis typically returns ["save", "", "appendonly", "no"] etc.
		const responseValue = ""; // Placeholder value
		const response = `*2\r\n${formatBulkString(parameter)}${formatBulkString(responseValue)}`;
		socket.write(response);
	} else if (subCommandLower === "set") {
		// Not implemented yet
		socket.write(
			Buffer.from(
				formatError(
					"ERR Unsupported CONFIG subcommand or wrong number of arguments for 'SET'",
				),
			),
		);
	} else {
		socket.write(
			Buffer.from(
				formatError(
					`Unknown subcommand or wrong number of arguments for '${subCommand}'`,
				),
			),
		);
	}
}
