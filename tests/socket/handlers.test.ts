import { beforeEach, describe, expect, test } from "bun:test";
import type { Socket } from "bun";
import {
	handleSocketClose,
	handleSocketData,
	handleSocketDrain,
	handleSocketError,
	handleSocketOpen,
} from "../../src/socket/handlers";

// Mock Socket class to capture writes
class MockSocket {
	public writes: Buffer[] = [];
	public remoteAddress = "127.0.0.1";

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

describe("Socket Handlers", () => {
	let socket: MockSocket;

	beforeEach(() => {
		socket = new MockSocket();
	});

	describe("handleSocketOpen", () => {
		test("should set up parser and handle commands", () => {
			handleSocketOpen(socket as unknown as Socket);
			// Verify parser is set up by sending a command
			handleSocketData(
				socket as unknown as Socket,
				Buffer.from("*1\r\n$4\r\nPING\r\n"),
			);
			expect(socket.writes[0]?.toString()).toBe("+PONG\r\n");
		});

		test("should handle empty command array", () => {
			handleSocketOpen(socket as unknown as Socket);
			handleSocketData(socket as unknown as Socket, Buffer.from("*0\r\n"));
			expect(socket.writes[0]?.toString()).toBe(
				"-ERR protocol error: received empty command array\r\n",
			);
		});

		test("should handle undefined command name", () => {
			handleSocketOpen(socket as unknown as Socket);
			// Send array with undefined element
			handleSocketData(
				socket as unknown as Socket,
				Buffer.from("*1\r\n$-1\r\n"),
			);
			expect(socket.writes[0]?.toString()).toBe(
				"-ERR protocol error: received empty command name\r\n",
			);
		});

		test("should handle unknown commands", () => {
			handleSocketOpen(socket as unknown as Socket);
			handleSocketData(
				socket as unknown as Socket,
				Buffer.from("*1\r\n$7\r\nUNKNOWN\r\n"),
			);
			expect(socket.writes[0]?.toString()).toBe(
				"-ERR unknown command `UNKNOWN`\r\n",
			);
		});

		test("should handle command execution errors", () => {
			handleSocketOpen(socket as unknown as Socket);
			// Send a command that will throw an error
			handleSocketData(
				socket as unknown as Socket,
				Buffer.from("*2\r\n$3\r\nGET\r\n$-1\r\n"),
			);
			expect(socket.writes[0]?.toString()).toBe("-ERR syntax error\r\n");
		});

		test("should log client connection", () => {
			handleSocketOpen(socket as unknown as Socket);
			// Logging is handled by debug utility, which we've tested separately
		});

		test("should handle commands from client", () => {
			handleSocketOpen(socket as unknown as Socket);
			handleSocketData(
				socket as unknown as Socket,
				Buffer.from("*1\r\n$4\r\nPING\r\n"),
			);
			expect(socket.writes[0]?.toString()).toBe("+PONG\r\n");
		});
	});

	describe("handleSocketData", () => {
		test("should handle valid commands", () => {
			handleSocketOpen(socket as unknown as Socket);
			handleSocketData(
				socket as unknown as Socket,
				Buffer.from("*1\r\n$4\r\nPING\r\n"),
			);
			expect(socket.writes[0]?.toString()).toBe("+PONG\r\n");
		});

		test("should handle missing parser", () => {
			// Don't call handleSocketOpen, so no parser is set up
			handleSocketData(
				socket as unknown as Socket,
				Buffer.from("*1\r\n$4\r\nPING\r\n"),
			);
			expect(socket.writes).toHaveLength(0);
		});

		test("should handle parser errors", () => {
			handleSocketOpen(socket as unknown as Socket);
			// Send invalid RESP data
			handleSocketData(socket as unknown as Socket, Buffer.from("invalid"));
			expect(socket.writes[0]?.toString()).toContain(
				"-ERR Invalid RESP type byte",
			);
		});

		test("should handle malformed array (incomplete)", () => {
			handleSocketOpen(socket as unknown as Socket); // Reinitialize parser
			handleSocketData(
				socket as unknown as Socket,
				Buffer.from("*2\r\n$4\r\nPING\r\n"),
			);
			expect(socket.writes).toHaveLength(0); // Should wait for more data
		});

		test("should handle invalid length specifier", () => {
			handleSocketOpen(socket as unknown as Socket); // Reinitialize parser
			handleSocketData(
				socket as unknown as Socket,
				Buffer.from("$-2\r\nPING\r\n"),
			);
			const response = socket.writes[0]?.toString() || "";
			expect(response).toBe("-ERR Invalid bulk string length: -2\r\n");
			socket.writes = [];
		});

		test("should handle invalid RESP type", () => {
			handleSocketOpen(socket as unknown as Socket); // Reinitialize parser
			handleSocketData(
				socket as unknown as Socket,
				Buffer.from("X1\r\n$4\r\nPING\r\n"),
			);
			const response = socket.writes[0]?.toString() || "";
			expect(response).toBe(
				"-ERR Invalid RESP type byte: X (Code: 88) at offset 0\r\n",
			);
			socket.writes = [];
		});

		test("should handle missing parser gracefully", () => {
			handleSocketData(
				socket as unknown as Socket,
				Buffer.from("*1\r\n$4\r\nPING\r\n"),
			);
			// Should not throw, just log error
		});

		test("should handle partial commands", () => {
			handleSocketOpen(socket as unknown as Socket);
			handleSocketData(socket as unknown as Socket, Buffer.from("*1\r\n$4"));
			expect(socket.writes).toHaveLength(0); // No response for partial command
			handleSocketData(
				socket as unknown as Socket,
				Buffer.from("\r\nPING\r\n"),
			);
			expect(socket.writes[0]?.toString()).toBe("+PONG\r\n");
		});

		test("should handle multiple commands in one data chunk", () => {
			handleSocketOpen(socket as unknown as Socket);
			handleSocketData(
				socket as unknown as Socket,
				Buffer.from("*1\r\n$4\r\nPING\r\n*1\r\n$4\r\nPING\r\n"),
			);
			expect(socket.writes).toHaveLength(2);
			expect(socket.writes[0]?.toString()).toBe("+PONG\r\n");
			expect(socket.writes[1]?.toString()).toBe("+PONG\r\n");
		});
	});

	describe("handleSocketClose", () => {
		test("should clean up parser", () => {
			handleSocketOpen(socket as unknown as Socket);
			handleSocketClose(socket as unknown as Socket);
			// Try to use the parser after cleanup
			handleSocketData(
				socket as unknown as Socket,
				Buffer.from("*1\r\n$4\r\nPING\r\n"),
			);
			expect(socket.writes).toHaveLength(0);
		});
	});

	describe("handleSocketError", () => {
		test("should handle socket errors", () => {
			handleSocketOpen(socket as unknown as Socket);
			const error = new Error("Test error");
			handleSocketError(socket as unknown as Socket, error);
			// Try to use the parser after error
			handleSocketData(
				socket as unknown as Socket,
				Buffer.from("*1\r\n$4\r\nPING\r\n"),
			);
			expect(socket.writes).toHaveLength(0);
		});
	});

	describe("handleSocketDrain", () => {
		test("should handle drain event", () => {
			handleSocketDrain(socket as unknown as Socket);
			// This just logs, no writes to verify
		});
	});
});
