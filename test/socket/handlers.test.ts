import {
	type Mock,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	spyOn,
} from "bun:test";
import type { Socket } from "bun";
import { formatError } from "../../src/commands/index";
import * as handlers from "../../src/socket/handlers";
import { RESPParser } from "../../src/protocol/parser";

// Mock dependencies
mock.module("../../src/protocol/parser", () => ({
	RESPParser: mock((callback) => ({
		parse: mock((data: Buffer) => {
			// Simulate parser behavior by calling the callback with mock data
			if (data.toString().includes("PING")) {
				callback(["PING"]);
			} else if (data.toString().includes("SET")) {
				callback(["SET", "key", "value"]);
			} else {
				throw new Error("Invalid RESP data");
			}
		}),
	})),
}));

mock.module("../../src/commands/index", () => ({
	commandMap: new Map([
		[
			"PING",
			mock((_args, socket) => {
				socket.write("+PONG\\r\\n");
			}),
		],
		[
			"SET",
			mock((_args, socket) => {
				socket.write("+OK\\r\\n");
			}),
		],
	]),
	formatError: (msg: string) => `-${msg}\\r\\n`,
}));

describe("Socket Handlers", () => {
	let mockSocket: Partial<Socket>;
	let socketWriteSpy: Mock<(output: string | Buffer) => number>;

	beforeEach(() => {
		// Reset mocks before each test
		mockSocket = {
			write: mock((_output: string | Buffer) => 0),
			remoteAddress: "mock:1234",
		};
		socketWriteSpy = spyOn(mockSocket, "write");
	});

	describe("handleSocketOpen", () => {
		it("should set up parser for new connections", () => {
			handlers.handleSocketOpen(mockSocket as Socket);

			// Send a PING command to test parser setup
			handlers.handleSocketData(
				mockSocket as Socket,
				Buffer.from("PING\\r\\n"),
			);

			expect(socketWriteSpy).toHaveBeenCalledTimes(1);
			expect(socketWriteSpy).toHaveBeenCalledWith("+PONG\\r\\n");
		});

		it("should log client connection", () => {
			const consoleSpy = spyOn(console, "log");
			handlers.handleSocketOpen(mockSocket as Socket);

			expect(consoleSpy).toHaveBeenCalledWith("Client connected", "mock:1234");
		});
	});

	describe("handleSocketData", () => {
		beforeEach(() => {
			// Set up connection first
			handlers.handleSocketOpen(mockSocket as Socket);
		});

		it("should handle valid commands", () => {
			handlers.handleSocketData(
				mockSocket as Socket,
				Buffer.from("SET key value\\r\\n"),
			);

			expect(socketWriteSpy).toHaveBeenCalledTimes(1);
			expect(socketWriteSpy).toHaveBeenCalledWith("+OK\\r\\n");
		});

		it("should handle parser errors", () => {
			const consoleSpy = spyOn(console, "error");
			handlers.handleSocketData(
				mockSocket as Socket,
				Buffer.from("INVALID\\r\\n"),
			);

			expect(consoleSpy).toHaveBeenCalled();
			expect(socketWriteSpy).toHaveBeenCalledWith(
				"-ERR protocol error: Invalid RESP data\\r\\n",
			);
		});

		it("should handle missing parser gracefully", () => {
			const consoleSpy = spyOn(console, "error");
			// Create new socket without initializing parser
			const newSocket = { ...mockSocket, remoteAddress: "mock:5678" };

			handlers.handleSocketData(newSocket as Socket, Buffer.from("PING\\r\\n"));

			expect(consoleSpy).toHaveBeenCalledWith(
				"Parser not found for socket:",
				"mock:5678",
			);
		});
	});

	describe("handleSocketClose", () => {
		it("should clean up parser and log disconnection", () => {
			const consoleSpy = spyOn(console, "log");

			handlers.handleSocketOpen(mockSocket as Socket);
			handlers.handleSocketClose(mockSocket as Socket);

			// Try to use the cleaned up parser
			handlers.handleSocketData(
				mockSocket as Socket,
				Buffer.from("PING\\r\\n"),
			);

			expect(consoleSpy).toHaveBeenCalledWith(
				"Client disconnected",
				"mock:1234",
			);
			// Should log parser not found error since it was cleaned up
			expect(console.error).toHaveBeenCalledWith(
				"Parser not found for socket:",
				"mock:1234",
			);
		});
	});

	describe("handleSocketError", () => {
		it("should log error and clean up parser", () => {
			const consoleSpy = spyOn(console, "error");
			const error = new Error("Test error");

			handlers.handleSocketOpen(mockSocket as Socket);
			handlers.handleSocketError(mockSocket as Socket, error);

			expect(consoleSpy).toHaveBeenCalledWith(
				`Socket error (${mockSocket.remoteAddress}):`,
				error,
			);

			// Try to use the cleaned up parser
			handlers.handleSocketData(
				mockSocket as Socket,
				Buffer.from("PING\\r\\n"),
			);
			expect(console.error).toHaveBeenCalledWith(
				"Parser not found for socket:",
				"mock:1234",
			);
		});
	});

	describe("handleSocketDrain", () => {
		it("should log drain event", () => {
			const consoleSpy = spyOn(console, "log");

			handlers.handleSocketDrain(mockSocket as Socket);

			expect(consoleSpy).toHaveBeenCalledWith(
				`Socket drained (${mockSocket.remoteAddress})`,
			);
		});
	});
});
