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
import * as handlers from "../../src/socket/handlers";
import { debug } from "../../src/utils/debug";

// Mock store
mock.module("../../src/store/store", () => ({
	store: {
		get: mock(() => undefined),
		set: mock(() => {}),
		delete: mock(() => false),
	},
}));

// Mock parser
mock.module("../../src/protocol/parser", () => ({
	RESPParser: mock((callback) => ({
		parse: mock((data: Buffer) => {
			if (data.toString().includes("PING")) {
				callback(["PING"]);
			} else {
				throw new Error("Invalid RESP data");
			}
		}),
	})),
}));

// Mock command handlers
mock.module("../../src/commands/index", () => ({
	commandMap: new Map([
		[
			"PING",
			mock((_args, socket) => {
				socket.write("+PONG\\r\\n");
			}),
		],
	]),
	formatError: (msg: string) => `-ERR ${msg}\\r\\n`,
}));

describe("Socket Handlers", () => {
	let mockSocket: Partial<Socket>;

	beforeEach(() => {
		mockSocket = {
			write: mock((_output: string | Buffer) => {
				return 0;
			}),
			remoteAddress: "mock:1234",
		};
	});

	describe("handleSocketOpen", () => {
		it("should set up parser and handle commands", () => {
			const socketWriteSpy = spyOn(mockSocket, "write");
			handlers.handleSocketOpen(mockSocket as Socket);

			// Send a PING command to test parser setup
			handlers.handleSocketData(
				mockSocket as Socket,
				Buffer.from("*1\\r\\n$4\\r\\nPING\\r\\n"),
			);

			expect(socketWriteSpy).toHaveBeenCalledWith("+PONG\\r\\n");
		});

		it("should log client connection", () => {
			const debugSpy = spyOn(debug, "log");
			handlers.handleSocketOpen(mockSocket as Socket);

			expect(debugSpy).toHaveBeenCalledWith("Client connected", "mock:1234");
		});
	});

	describe("handleSocketData", () => {
		beforeEach(() => {
			handlers.handleSocketOpen(mockSocket as Socket);
		});

		it("should handle valid commands", () => {
			const debugSpy = spyOn(debug, "log");
			const socketWriteSpy = spyOn(mockSocket, "write");

			handlers.handleSocketData(
				mockSocket as Socket,
				Buffer.from("*1\\r\\n$4\\r\\nPING\\r\\n"),
			);

			expect(debugSpy).toHaveBeenCalled();
			expect(socketWriteSpy).toHaveBeenCalledWith("+PONG\\r\\n");
		});

		it("should handle parser errors", () => {
			const debugSpy = spyOn(debug, "error");
			handlers.handleSocketData(
				mockSocket as Socket,
				Buffer.from("INVALID\\r\\n"),
			);

			expect(debugSpy).toHaveBeenCalled();
		});

		it("should handle missing parser gracefully", () => {
			const debugSpy = spyOn(debug, "error");
			// Create new socket without initializing parser
			const newSocket = { ...mockSocket, remoteAddress: "mock:5678" };

			handlers.handleSocketData(newSocket as Socket, Buffer.from("PING\\r\\n"));

			expect(debugSpy).toHaveBeenCalledWith(
				"Parser not found for socket:",
				"mock:5678",
			);
		});
	});

	describe("handleSocketClose", () => {
		it("should clean up parser and log disconnection", () => {
			const debugSpy = spyOn(debug, "log");
			const socketWriteSpy = spyOn(mockSocket, "write");

			handlers.handleSocketOpen(mockSocket as Socket);
			handlers.handleSocketClose(mockSocket as Socket);

			// Try to use the cleaned up parser
			handlers.handleSocketData(
				mockSocket as Socket,
				Buffer.from("*1\\r\\n$4\\r\\nPING\\r\\n"),
			);

			expect(debugSpy).toHaveBeenCalledWith("Client disconnected", "mock:1234");
			expect(socketWriteSpy).not.toHaveBeenCalledWith("+PONG\\r\\n");
		});
	});

	describe("handleSocketError", () => {
		it("should log error and clean up parser", () => {
			const debugSpy = spyOn(debug, "error");
			const socketWriteSpy = spyOn(mockSocket, "write");
			const error = new Error("Test error");

			handlers.handleSocketOpen(mockSocket as Socket);
			handlers.handleSocketError(mockSocket as Socket, error);

			// Try to use the cleaned up parser
			handlers.handleSocketData(
				mockSocket as Socket,
				Buffer.from("*1\\r\\n$4\\r\\nPING\\r\\n"),
			);

			expect(debugSpy).toHaveBeenCalledWith("Socket error (mock:1234):", error);
			expect(socketWriteSpy).not.toHaveBeenCalledWith("+PONG\\r\\n");
		});
	});

	describe("handleSocketDrain", () => {
		it("should log drain event", () => {
			const debugSpy = spyOn(debug, "log");

			handlers.handleSocketDrain(mockSocket as Socket);

			expect(debugSpy).toHaveBeenCalledWith("Socket drained (mock:1234)");
		});
	});
});
