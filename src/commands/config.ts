import type { Socket } from "bun";
import type { KeyValueStore } from "../store/store";
import { formatBulkString, formatError } from "../protocol/resp";

// Basic implementation to handle CONFIG GET for redis-benchmark
// Doesn't actually get/set real config yet.
export function handleConfig(
	args: string[],
	socket: Socket,
	store: KeyValueStore, // Not used by CONFIG GET
): void {
	if (args.length < 1) {
		socket.write(
			formatError("ERR wrong number of arguments for 'config' command"),
		);
		return;
	}

	const subCommand = args[0]?.toUpperCase();

	if (subCommand === "GET") {
		if (args.length !== 2) {
			socket.write(
				formatError("ERR wrong number of arguments for 'config|get' command"),
			);
			return;
		}
		const parameter = args[1];
		if (parameter === undefined) {
			socket.write(formatError("ERR syntax error"));
			return;
		}

		// Respond like Redis: an array of [parameterName, value]
		// For now, just return an empty string as the value for any parameter.
		// Redis typically returns ["save", "", "appendonly", "no"] etc.
		const responseValue = ""; // Placeholder value
		const response = `*2\r\n${formatBulkString(parameter)}${formatBulkString(responseValue)}`;
		socket.write(response);
	} else if (subCommand === "SET") {
		// Not implemented yet
		socket.write(
			formatError(
				"ERR Unsupported CONFIG subcommand or wrong number of arguments for 'SET'",
			),
		);
	} else {
		socket.write(
			formatError(
				`ERR Unknown subcommand or wrong number of arguments for '${args[0]}'`,
			),
		);
	}
}
