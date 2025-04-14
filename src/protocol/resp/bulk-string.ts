import { globalBufferPool } from "../../utils/buffer-pool";
import { NULL_RESPONSE } from "./constants";

/**
 * Formats a value as a RESP bulk string.
 * Format: $<length>\r\n<data>\r\n
 */
export function formatBulkString(str: Buffer | string | null): Buffer {
	if (str === null) {
		return NULL_RESPONSE;
	}

	const buffer = Buffer.isBuffer(str) ? str : Buffer.from(str);
	const lengthStr = buffer.length.toString();

	// Calculate total size needed:
	// $<length>\r\n<data>\r\n
	const totalSize =
		1 + // '$' character
		lengthStr.length + // length digits
		2 + // \r\n after length
		buffer.length + // actual data
		2; // final \r\n

	// Get a buffer from the pool
	const response = globalBufferPool.acquire(totalSize);
	let offset = 0;

	// Write $length\r\n
	response[offset++] = 0x24; // '$'
	for (let i = 0; i < lengthStr.length; i++) {
		response[offset++] = lengthStr.charCodeAt(i);
	}
	response[offset++] = 0x0d; // \r
	response[offset++] = 0x0a; // \n

	// Write data
	buffer.copy(response, offset);
	offset += buffer.length;

	// Write final \r\n
	response[offset++] = 0x0d;
	response[offset++] = 0x0a;

	return response.subarray(0, offset);
}
