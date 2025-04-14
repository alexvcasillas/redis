import {
	ZERO_RESPONSE,
	ONE_RESPONSE,
	TWO_RESPONSE,
	THREE_RESPONSE,
} from "./constants";

/**
 * Formats a value as a RESP integer.
 * Format: :<number>\r\n
 */
export function formatInteger(num: number): Buffer {
	switch (num) {
		case 0:
			return ZERO_RESPONSE;
		case 1:
			return ONE_RESPONSE;
		case 2:
			return TWO_RESPONSE;
		case 3:
			return THREE_RESPONSE;
		default:
			return Buffer.from(`:${num}\r\n`);
	}
}
