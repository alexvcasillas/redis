export type RESPValue = string | number | Buffer | null | RESPValue[];
import { debug } from "../utils/debug";

// Helper to find CRLF
const CRLF = Buffer.from("\r\n");
const CRLF_LENGTH = CRLF.length;

// Buffer pool for reuse
class BufferPool {
	private pool: Buffer[] = [];
	private readonly maxSize: number;
	private readonly initialSize: number;

	constructor(maxSize = 10, initialSize = 1024) {
		this.maxSize = maxSize;
		this.initialSize = initialSize;
	}

	acquire(minSize: number): Buffer {
		const idealSize = Math.max(minSize, this.initialSize);

		// Try to find a buffer of suitable size
		for (let i = 0; i < this.pool.length; i++) {
			const buffer = this.pool[i];
			if (buffer && buffer.length >= minSize) {
				const result = this.pool.splice(i, 1)[0];
				if (!result) {
					// This should never happen due to the check above, but satisfy the linter
					return Buffer.allocUnsafe(idealSize);
				}
				return result;
			}
		}

		// Create new buffer if none found
		return Buffer.allocUnsafe(idealSize);
	}

	release(buffer: Buffer): void {
		if (this.pool.length < this.maxSize) {
			this.pool.push(buffer);
		}
	}
}

// Singleton buffer pool
const bufferPool = new BufferPool();

export class RESPParser {
	private buffer: Buffer = bufferPool.acquire(1024);
	private offset = 0;
	private bufferSize = 0;

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
		// Check if we need to grow the buffer
		const requiredSize = this.bufferSize + data.length;
		if (this.buffer.length < requiredSize) {
			debug.log(
				`Growing buffer from ${this.buffer.length} to ${Math.max(requiredSize * 2, 1024)} bytes`,
			);
			// Allocate new buffer with some extra space
			const newBuffer = bufferPool.acquire(Math.max(requiredSize * 2, 1024));
			this.buffer.copy(newBuffer, 0, this.offset, this.bufferSize);
			const oldBuffer = this.buffer;
			this.buffer = newBuffer;
			bufferPool.release(oldBuffer);
			this.bufferSize -= this.offset;
			this.offset = 0;
		} else if (this.offset > 0) {
			debug.log(`Compacting buffer, removing ${this.offset} bytes`);
			// Compact buffer if needed
			this.buffer.copy(this.buffer, 0, this.offset, this.bufferSize);
			this.bufferSize -= this.offset;
			this.offset = 0;
		}

		// Append new data
		data.copy(this.buffer, this.bufferSize);
		this.bufferSize += data.length;
		debug.log(
			`Appended ${data.length} bytes to buffer, total size: ${this.bufferSize}`,
		);

		while (this.offset < this.bufferSize) {
			const initialOffset = this.offset;
			try {
				const value = this._parseValue();

				if (value === undefined) {
					debug.log("Need more data to complete parsing");
					break;
				}

				if (Array.isArray(value)) {
					// Convert array items to strings efficiently
					const command = this._convertArrayToStrings(value);
					if (command.length > 0) {
						debug.log("Parsed command:", command);
						this.onCommand(command);
					}
				} else {
					debug.warn("Parsed non-array value at top level:", value);
				}

				if (this.offset === initialOffset) {
					debug.error("Parsing stalled. Offset did not advance.");
					break;
				}
			} catch (e) {
				debug.error("RESP Parsing Error:", e);
				this.bufferSize = 0;
				this.offset = 0;
				break;
			}
		}

		// If we've processed everything, reset the buffer
		if (this.offset >= this.bufferSize) {
			debug.log("Buffer fully processed, resetting");
			this.bufferSize = 0;
			this.offset = 0;
		}
	}

	private _convertArrayToStrings(value: RESPValue[]): string[] {
		const result: string[] = [];
		for (const item of value) {
			if (Buffer.isBuffer(item)) {
				result.push(item.toString("utf8")); // More efficient than "utf-8"
			} else if (typeof item === "string") {
				result.push(item);
			} else {
				debug.error(
					"Malformed command: array contains non-string/buffer element",
					item,
				);
			}
		}
		return result;
	}

	private _readLine(): Buffer | null {
		// Optimized CRLF search for small buffers
		if (this.bufferSize - this.offset < 64) {
			const crlfIndex = this.buffer.indexOf(CRLF, this.offset);
			if (crlfIndex === -1) {
				return null;
			}
			const line = this.buffer.subarray(this.offset, crlfIndex);
			this.offset = crlfIndex + CRLF_LENGTH;
			return line;
		}

		// For larger buffers, use a more efficient search
		let i = this.offset;
		const end = this.bufferSize - 1;
		while (i < end) {
			if (this.buffer[i] === 13 && this.buffer[i + 1] === 10) {
				// \r\n
				const line = this.buffer.subarray(this.offset, i);
				this.offset = i + CRLF_LENGTH;
				return line;
			}
			i++;
		}
		return null;
	}

	private _parseValue(): RESPValue | undefined {
		if (this.offset >= this.bufferSize) {
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
		if (this.offset + totalLength > this.bufferSize) {
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

	dispose() {
		debug.log("Disposing parser and releasing buffer");
		bufferPool.release(this.buffer);
	}
}
