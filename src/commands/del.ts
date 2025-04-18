import type { Socket } from "bun";
import { formatError, formatInteger } from "../protocol/resp";
import type { KeyValueStore } from "../store/store";

export function handleDel(
	args: string[],
	socket: Socket,
	store: KeyValueStore,
): void {
	if (args.length === 0) {
		socket.write(
			Buffer.from(formatError("wrong number of arguments for 'del' command")),
		);
		return;
	}

	let deletedCount = 0;
	for (const key of args) {
		if (key === undefined) continue; // Should not happen with length check

		if (store.delete(key)) {
			deletedCount++;
		}
	}

	socket.write(formatInteger(deletedCount));
}
