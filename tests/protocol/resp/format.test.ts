import { describe, expect, test } from "bun:test";
import {
	NULL_RESPONSE,
	formatBulkString,
	formatError,
	formatInteger,
	formatSimpleString,
} from "../../../src/protocol/resp";

describe("RESP Response Formatting", () => {
	describe("formatBulkString", () => {
		test("should format null correctly", () => {
			const result = formatBulkString(null);
			expect(result).toBe(NULL_RESPONSE); // Should reuse the constant
			expect(result.toString()).toBe("$-1\r\n");
		});

		test("should format empty string correctly", () => {
			const result = formatBulkString("");
			expect(result.toString()).toBe("$0\r\n\r\n");
		});

		test("should format string data correctly", () => {
			const result = formatBulkString("hello");
			expect(result.toString()).toBe("$5\r\nhello\r\n");
		});

		test("should format Buffer data correctly", () => {
			const buf = Buffer.from("world");
			const result = formatBulkString(buf);
			expect(result.toString()).toBe("$5\r\nworld\r\n");
		});

		test("should handle multi-byte characters correctly", () => {
			const result = formatBulkString("你好");
			expect(result.toString()).toBe("$6\r\n你好\r\n");
		});

		test("should handle large strings efficiently", () => {
			const largeString = "x".repeat(1000);
			const result = formatBulkString(largeString);
			expect(result.toString()).toBe(`$1000\r\n${largeString}\r\n`);
		});

		test("should reuse buffer from pool for similar sizes", () => {
			// Get two strings of the same length
			const result1 = formatBulkString("test1");
			const buffer1 = result1.buffer;

			// Release the first buffer implicitly by letting it be garbage collected
			const result2 = formatBulkString("test2");
			const buffer2 = result2.buffer;

			// The underlying ArrayBuffer should be from the same pool tier
			expect(buffer1.byteLength).toBe(buffer2.byteLength);
		});
	});

	describe("formatSimpleString", () => {
		test("should format OK correctly", () => {
			const result = formatSimpleString("OK");
			expect(result.toString()).toBe("+OK\r\n");
		});

		test("should format PONG correctly", () => {
			const result = formatSimpleString("PONG");
			expect(result.toString()).toBe("+PONG\r\n");
		});

		test("should format other strings correctly", () => {
			const result = formatSimpleString("hello");
			expect(result.toString()).toBe("+hello\r\n");
		});
	});

	describe("formatInteger", () => {
		test("should format common integers correctly", () => {
			expect(formatInteger(0).toString()).toBe(":0\r\n");
			expect(formatInteger(1).toString()).toBe(":1\r\n");
			expect(formatInteger(2).toString()).toBe(":2\r\n");
			expect(formatInteger(3).toString()).toBe(":3\r\n");
		});

		test("should format other integers correctly", () => {
			expect(formatInteger(42).toString()).toBe(":42\r\n");
			expect(formatInteger(-1).toString()).toBe(":-1\r\n");
			expect(formatInteger(1000).toString()).toBe(":1000\r\n");
		});
	});

	describe("formatError", () => {
		test("should format syntax error correctly", () => {
			const result = formatError("syntax error");
			expect(result).toEqual(Buffer.from("-ERR syntax error\r\n"));
		});

		test("should format custom errors correctly", () => {
			const result = formatError("wrong number of arguments");
			expect(result.toString()).toBe("-ERR wrong number of arguments\r\n");
		});
	});
});
