import { beforeEach, describe, expect, test } from "bun:test";
import type { Socket } from "bun";
import { handleConfig } from "../../src/commands/config";
import { store } from "../../src/store/store";

// Mock Socket class to capture writes
class MockSocket {
	public writes: Buffer[] = [];
	write(
		data: Buffer | string | ArrayBufferView | ArrayBuffer,
		byteOffset?: number,
		byteLength?: number,
	): number {
		const buffer = Buffer.isBuffer(data)
			? data
			: Buffer.from(data as ArrayBuffer);
		this.writes.push(buffer);
		return buffer.length;
	}
}

describe("Config Command", () => {
	let socket: MockSocket;

	beforeEach(() => {
		socket = new MockSocket();
	});

	describe("Input Validation", () => {
		test("should handle missing arguments", () => {
			handleConfig([], socket as unknown as Socket, store);
			expect(socket.writes[0]?.toString()).toBe(
				"-ERR wrong number of arguments for 'config' command\r\n",
			);
		});

		test("should handle missing subcommand", () => {
			handleConfig([""], socket as unknown as Socket, store);
			expect(socket.writes[0]?.toString()).toBe(
				"-ERR Unknown subcommand or wrong number of arguments for ''\r\n",
			);
		});

		test("should handle undefined subcommand", () => {
			// @ts-expect-error Testing undefined subcommand
			handleConfig([undefined], socket as unknown as Socket, store);
			expect(socket.writes[0]?.toString()).toBe(
				"-ERR wrong number of arguments for 'config' command\r\n",
			);
		});
	});

	describe("CONFIG GET", () => {
		test("should handle CONFIG GET with wrong number of arguments", () => {
			handleConfig(["GET"], socket as unknown as Socket, store);
			expect(socket.writes[0]?.toString()).toBe(
				"-ERR wrong number of arguments for 'config|get' command\r\n",
			);
		});

		test("should handle CONFIG GET with undefined parameter", () => {
			// @ts-expect-error Testing undefined parameter
			handleConfig(["GET", undefined], socket as unknown as Socket, store);
			expect(socket.writes[0]?.toString()).toBe("-ERR syntax error\r\n");
		});

		test("should handle CONFIG GET with empty parameter", () => {
			handleConfig(["GET", ""], socket as unknown as Socket, store);
			expect(socket.writes[0]?.toString()).toBe("*2\r\n$0\r\n\r\n$0\r\n\r\n");
		});

		test("should handle valid CONFIG GET command", () => {
			handleConfig(["GET", "save"], socket as unknown as Socket, store);
			const response = socket.writes[0]?.toString();
			expect(response).toContain("*2"); // Array of 2 elements
			expect(response).toContain("$4"); // Length of "save"
			expect(response).toContain("save");
			expect(response).toContain("$0"); // Empty string value
		});
	});

	describe("CONFIG SET", () => {
		test("should handle CONFIG SET command", () => {
			handleConfig(["SET", "save", "900"], socket as unknown as Socket, store);
			expect(socket.writes[0]?.toString()).toBe(
				"-ERR ERR Unsupported CONFIG subcommand or wrong number of arguments for 'SET'\r\n",
			);
		});
	});

	describe("Invalid Subcommands", () => {
		test("should handle invalid subcommand", () => {
			handleConfig(["INVALID"], socket as unknown as Socket, store);
			expect(socket.writes[0]?.toString()).toBe(
				"-ERR Unknown subcommand or wrong number of arguments for 'INVALID'\r\n",
			);
		});
	});
});
