export type RESPValue = string | number | Buffer | null | RESPValue[];

// Helper to find CRLF
const CRLF = Buffer.from("\r\n");

export class RESPParser {
	private buffer: Buffer = Buffer.alloc(0);
	private offset = 0; // Keep track of the current position in the buffer

	// Callback to be called when a full command (array) is parsed
	onCommand: (command: string[]) => void;

	constructor(onCommand: (command: string[]) => void) {
		this.onCommand = onCommand;
	}

	/**
	 * Appends new data to the internal buffer and attempts to parse commands.
	 * @param data The incoming data chunk.
	 */
	parse(data: Buffer) {
		// Append new data and reset offset if buffer was empty
		if (this.buffer.length === 0) {
			this.buffer = data;
			this.offset = 0;
		} else {
			// If there's remaining data, create a new buffer consolidating the old fragment and new data
			const remaining = this.buffer.subarray(this.offset);
			this.buffer = Buffer.concat([remaining, data]);
			this.offset = 0; // Reset offset for the new concatenated buffer
		}

		// console.log(`Parser buffer (${this.buffer.length}, offset ${this.offset}): ${this.buffer.toString('utf-8', this.offset).replace(/\r\n/g, '\\r\\n')}`); // Debug logging

		while (this.offset < this.buffer.length) {
			const initialOffset = this.offset;
			try {
				const value = this._parseValue();

				// If value is undefined, it means we need more data
				if (value === undefined) {
					// console.log("Need more data...");
					break; // Exit the loop and wait for more data
				}

				// If we successfully parsed an array (top-level command)
				if (Array.isArray(value)) {
					// console.log("Parsed command array:", value);
					// Validate command format (array of strings/buffers) and convert to string[]
					const command = value
						.map((item) => {
							if (Buffer.isBuffer(item)) {
								return item.toString("utf-8");
							}
							if (typeof item === "string") {
								return item; // Should not happen with RESP arrays from clients normally, but handle it
							}
							// Malformed command - non-string/buffer element
							// For simplicity, we might throw or send an error response later
							console.error(
								"Malformed command: array contains non-string/buffer element",
								item,
							);
							return ""; // Or throw an error
						})
						.filter((s) => s !== ""); // Filter out errors for now

					if (command.length > 0) {
						this.onCommand(command);
					}
				} else {
					// Parsed a value, but it wasn't a top-level array (command).
					// This shouldn't happen for client commands according to Redis spec.
					// We could log this as an error or ignore it.
					console.warn("Parsed non-array value at top level:", value);
				}

				// If offset hasn't moved, it means parsing finished but didn't consume data (error state)
				if (this.offset === initialOffset) {
					console.error("Parsing stalled. Offset did not advance.");
					// Potentially break or reset state to avoid infinite loops
					break;
				}
			} catch (e) {
				// Handle parsing errors (e.g., invalid format)
				console.error("RESP Parsing Error:", e);
				// TODO: Send error response to client? Close connection?
				// For now, we might just reset the buffer to avoid processing corrupted data.
				this.buffer = Buffer.alloc(0);
				this.offset = 0;
				break; // Exit loop on error
			}
		}

		// If we've processed the entire buffer, clear it
		if (this.offset >= this.buffer.length) {
			this.buffer = Buffer.alloc(0);
			this.offset = 0;
		}
	}

	private _readLine(): Buffer | null {
		const crlfIndex = this.buffer.indexOf(CRLF, this.offset);
		if (crlfIndex === -1) {
			return null; // Not enough data for a complete line
		}
		const line = this.buffer.subarray(this.offset, crlfIndex);
		this.offset = crlfIndex + CRLF.length; // Move offset past CRLF
		return line;
	}

	private _parseValue(): RESPValue | undefined {
		if (this.offset >= this.buffer.length) {
			return undefined; // Need more data
		}

		const typeByte = this.buffer[this.offset]; // Peek
		let result: RESPValue | undefined;
		let incrementedOffset = false;

		// Process based on type BEFORE consuming the byte
		switch (typeByte) {
			case 43: // '+' Simple String
				this.offset++; // Consume type byte
				incrementedOffset = true;
				result = this._parseSimpleString();
				break;
			case 45: // '-' Error
				this.offset++; // Consume type byte
				incrementedOffset = true;
				result = this._parseError();
				break;
			case 58: // ':' Integer
				this.offset++; // Consume type byte
				incrementedOffset = true;
				result = this._parseInteger();
				break;
			case 36: // '$' Bulk String
				this.offset++; // Consume type byte
				incrementedOffset = true;
				result = this._parseBulkString();
				break;
			case 42: // '*' Array
				this.offset++; // Consume type byte
				incrementedOffset = true;
				result = this._parseArray();
				break;
			default:
				// Explicitly check typeByte although it should be guaranteed by bounds check
				if (typeof typeByte !== "number") {
					// This case should logically be unreachable
					throw new Error(
						`Invalid state: typeByte is not a number at offset ${this.offset}`,
					);
				}
				// Invalid type byte, throw error *without* incrementing offset
				// typeByte is guaranteed number here due to initial bounds check
				throw new Error(
					`Invalid RESP type byte: ${String.fromCharCode(typeByte)} (Code: ${typeByte}) at offset ${this.offset}`,
				);
		}

		// If parsing failed (returned undefined) and we consumed the type byte,
		// reset the offset back.
		if (result === undefined && incrementedOffset) {
			this.offset--; // Put back type byte
		}

		return result;
	}

	private _parseSimpleString(): string | undefined {
		const line = this._readLine();
		if (line === null) {
			// No offset-- needed here
			return undefined; // Need more data
		}
		return line.toString("utf-8");
	}

	private _parseError(): string | undefined {
		const line = this._readLine();
		if (line === null) {
			// No offset-- needed here
			return undefined; // Need more data
		}
		// Conventionally return the error message itself
		return line.toString("utf-8");
	}

	private _parseInteger(): number | undefined {
		const line = this._readLine();
		if (line === null) {
			// No offset-- needed here
			return undefined; // Need more data
		}
		const numStr = line.toString("utf-8");
		// Explicitly type value as number
		const value: number = Number.parseInt(numStr, 10);
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore - Suppress persistent type error on the line below
		if (Number.isNaN(value)) {
			throw new Error(`Invalid integer value: ${numStr}`);
		}
		return value;
	}

	private _parseBulkString(): Buffer | null | undefined {
		const initialOffsetForLength = this.offset; // Offset is *after* type byte '$'
		const line = this._readLine(); // Reads the length line
		if (line === null) {
			// No offset-- needed here
			return undefined; // Need more data for length line
		}

		const length = Number.parseInt(line.toString("utf-8"), 10);
		if (Number.isNaN(length)) {
			throw new Error(`Invalid bulk string length: ${line.toString("utf-8")}`);
		}

		if (length === -1) {
			return null; // Null bulk string
		}

		const totalLength = length + CRLF.length;
		if (this.offset + totalLength > this.buffer.length) {
			// Not enough data for the bulk string content + CRLF
			// Reset offset to before the length line was read
			this.offset = initialOffsetForLength;
			return undefined;
		}

		const data = this.buffer.subarray(this.offset, this.offset + length);
		// Check for trailing CRLF
		if (
			!this.buffer
				.subarray(this.offset + length, this.offset + totalLength)
				.equals(CRLF)
		) {
			throw new Error(
				"Malformed bulk string: Missing or incorrect trailing CRLF",
			);
		}

		this.offset += totalLength; // Move offset past data + CRLF
		return data;
	}

	private _parseArray(): RESPValue[] | null | undefined {
		const initialOffsetForCount = this.offset; // Offset is *after* type byte '*'
		const line = this._readLine(); // Reads the count line
		if (line === null) {
			// No offset-- needed here
			return undefined; // Need more data for count line
		}

		const count = Number.parseInt(line.toString("utf-8"), 10);
		if (Number.isNaN(count)) {
			throw new Error(`Invalid array length: ${line.toString("utf-8")}`);
		}

		if (count === -1) {
			return null; // Null array
		}

		const array: RESPValue[] = [];
		const initialOffsetForElements = this.offset; // Store offset *after* count line is read

		for (let i = 0; i < count; i++) {
			const element = this._parseValue(); // Recursive call
			if (element === undefined) {
				// Not enough data for an element.
				// Reset offset back to before we started trying to read elements.
				this.offset = initialOffsetForElements;
				// Also need to put back the consumed count line + CRLF
				this.offset -= line.length + CRLF.length;
				return undefined; // Indicate failure
			}
			// Assert element is not undefined here, as we checked above
			array.push(element as RESPValue);
		}

		return array;
	}

	// TODO: Add private methods for parsing different RESP types
	// e.g., parseSimpleString, parseError, parseInteger, parseBulkString, parseArray
}
