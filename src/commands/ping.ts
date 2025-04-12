import { type Socket } from "bun";
import { formatSimpleString, formatBulkString, formatError } from "./index";
import { type KeyValueStore } from "../store/store";

export function handlePing(
    args: string[],
    socket: Socket,
    store: KeyValueStore // Included for consistency, though not used by PING
): void {
    if (args.length > 1) {
        socket.write(formatError("ERR wrong number of arguments for 'ping' command"));
        return;
    }

    if (args.length === 1) {
        const message = args[0];
        // Check if message exists (should always, but good practice)
        if (message !== undefined) {
            socket.write(formatBulkString(message));
        } else {
            // This case is unlikely given args.length check, but handles type error
            socket.write(formatError("ERR PING argument is missing"));
        }
    } else {
        // PING
        socket.write(formatSimpleString("PONG"));
    }
} 