import { SYNTAX_ERROR_RESPONSE } from "./constants";

/**
 * Formats a value as a RESP error.
 * Format: -ERR <message>\r\n
 */
export function formatError(msg: string): Buffer {
	if (msg === "ERR syntax error") return SYNTAX_ERROR_RESPONSE;
	return Buffer.from(`-ERR ${msg}\r\n`);
}
