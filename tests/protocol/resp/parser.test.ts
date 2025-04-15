import { describe, expect, test } from "bun:test";
import { RESPParser } from "../../../src/protocol/parser";

describe("RESP Parser", () => {
	describe("Edge Cases and Error Handling", () => {
		test("should handle invalid integer values", () => {
			const parser = new RESPParser(() => {});
			const invalidInt = Buffer.from(":abc\r\n");

			expect(() => parser.parse(invalidInt)).toThrow(
				"Invalid integer value: abc",
			);
		});

		test("should handle invalid bulk string length", () => {
			const parser = new RESPParser(() => {});
			const invalidLength = Buffer.from("$abc\r\n");

			expect(() => parser.parse(invalidLength)).toThrow(
				"Invalid bulk string length: abc",
			);
		});

		test("should handle negative bulk string length", () => {
			const parser = new RESPParser(() => {});
			const negativeLength = Buffer.from("$-2\r\n");

			expect(() => parser.parse(negativeLength)).toThrow(
				"Invalid bulk string length: -2",
			);
		});

		test("should handle malformed bulk string (missing CRLF)", () => {
			const parser = new RESPParser(() => {});
			// Create a bulk string with correct length but incorrect trailing CRLF
			const malformedBulk = Buffer.from("$5\r\nhello\n\r"); // CRLF in wrong order

			expect(() => parser.parse(malformedBulk)).toThrow(
				"Malformed bulk string: Missing or incorrect trailing CRLF",
			);
		});

		test("should handle invalid array length", () => {
			const parser = new RESPParser(() => {});
			const invalidArrayLength = Buffer.from("*abc\r\n");

			expect(() => parser.parse(invalidArrayLength)).toThrow(
				"Invalid array length: abc",
			);
		});

		test("should handle null array", () => {
			const commands: string[][] = [];
			const parser = new RESPParser((cmd) => commands.push(cmd));
			const nullArray = Buffer.from("*-1\r\n");

			parser.parse(nullArray);
			expect(commands).toHaveLength(0); // Null arrays should be ignored
		});

		test("should handle null bulk string", () => {
			const commands: string[][] = [];
			const parser = new RESPParser((cmd) => commands.push(cmd));
			const nullBulk = Buffer.from("$-1\r\n");

			parser.parse(nullBulk);
			expect(commands).toHaveLength(0); // Null bulk strings should be ignored
		});

		test("should handle invalid RESP type byte", () => {
			const parser = new RESPParser(() => {});
			const invalidType = Buffer.from("x1\r\n");

			expect(() => parser.parse(invalidType)).toThrow(
				"Invalid RESP type byte: x",
			);
		});

		test("should handle partial data", () => {
			const commands: string[][] = [];
			const parser = new RESPParser((cmd) => commands.push(cmd));

			// Send partial array
			parser.parse(Buffer.from("*2\r\n$4\r\n"));
			expect(commands).toHaveLength(0);

			// Complete the command
			parser.parse(Buffer.from("PING\r\n$4\r\nPONG\r\n"));
			expect(commands).toHaveLength(1);
			expect(commands[0]).toEqual(["PING", "PONG"]);
		});

		test("should handle buffer growth", () => {
			const commands: string[][] = [];
			const parser = new RESPParser((cmd) => commands.push(cmd));

			// Create a large bulk string that will require buffer growth
			const largeValue = "x".repeat(2000);
			const command = `*2\r\n$4\r\nECHO\r\n$${largeValue.length}\r\n${largeValue}\r\n`;

			parser.parse(Buffer.from(command));
			expect(commands).toHaveLength(1);
			const firstCommand = commands[0];
			if (firstCommand) {
				expect(firstCommand[0]).toBe("ECHO");
				expect(firstCommand[1]).toBe(largeValue);
			}
		});

		test("should handle buffer compaction", () => {
			const commands: string[][] = [];
			const parser = new RESPParser((cmd) => commands.push(cmd));

			// Send multiple small commands to trigger compaction
			for (let i = 0; i < 100; i++) {
				parser.parse(Buffer.from("*1\r\n$4\r\nPING\r\n"));
			}

			expect(commands).toHaveLength(100);
			for (const cmd of commands) {
				expect(cmd).toEqual(["PING"]);
			}
		});
	});

	describe("Resource Management", () => {
		test("should properly dispose of resources", () => {
			const parser = new RESPParser(() => {});
			parser.parse(Buffer.from("*1\r\n$4\r\nPING\r\n"));

			// Should not throw
			expect(() => parser.dispose()).not.toThrow();

			// Further operations should still work
			expect(() =>
				parser.parse(Buffer.from("*1\r\n$4\r\nPING\r\n")),
			).not.toThrow();
		});
	});
});
