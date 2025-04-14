import { OK_RESPONSE, PONG_RESPONSE } from "./constants";

/**
 * Formats a value as a RESP simple string.
 * Format: +<string>\r\n
 */
export function formatSimpleString(str: string): Buffer {
	if (str === "OK") return OK_RESPONSE;
	if (str === "PONG") return PONG_RESPONSE;
	return Buffer.from(`+${str}\r\n`);
}
