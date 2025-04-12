import { describe, it, expect, mock, spyOn, beforeEach } from "bun:test";
import { handlePing } from "../src/commands/ping";
import { formatError, formatSimpleString, formatBulkString } from "../src/commands/index";
// KeyValueStore mock/import isn't strictly necessary here as PING doesn't use it,
// but we include the parameter for handler signature consistency.
import { KeyValueStore } from "../src/store/store";
import { type Socket } from "bun";

// Mock KeyValueStore just to satisfy the handler signature
mock.module('../src/store/store', () => ({
    KeyValueStore: mock(() => ({ get: mock(), set: mock(), delete: mock() })),
    store: { get: mock(), set: mock(), delete: mock() }
}));

describe("handlePing Command", () => {

    let mockSocket: Partial<Socket>;
    let mockStoreInstance: KeyValueStore; // Present for signature, not used
    let socketWriteSpy: any;

    beforeEach(() => {
        mockStoreInstance = new KeyValueStore(); // Instance needed for signature

        mockSocket = {
            write: mock((_output: string | Buffer) => { return 0; }),
            remoteAddress: "mock:1234"
        };
        socketWriteSpy = spyOn(mockSocket, 'write');
    });

    it("should return error for wrong number of arguments (more than 1)", () => {
        const args = ["message1", "message2"];
        handlePing(args, mockSocket as Socket, mockStoreInstance);

        expect(socketWriteSpy).toHaveBeenCalledTimes(1);
        expect(socketWriteSpy).toHaveBeenCalledWith(
            formatError("ERR wrong number of arguments for 'ping' command")
        );
    });

    it("should return PONG when no arguments are provided", () => {
        const args: string[] = [];
        handlePing(args, mockSocket as Socket, mockStoreInstance);

        expect(socketWriteSpy).toHaveBeenCalledTimes(1);
        expect(socketWriteSpy).toHaveBeenCalledWith(formatSimpleString("PONG"));
    });

    it("should return the provided message as a bulk string when one argument is given", () => {
        const message = "Hello there!";
        const args = [message];
        handlePing(args, mockSocket as Socket, mockStoreInstance);

        expect(socketWriteSpy).toHaveBeenCalledTimes(1);
        expect(socketWriteSpy).toHaveBeenCalledWith(formatBulkString(message));
    });

     it("should handle empty string argument", () => {
        const message = "";
        const args = [message];
        handlePing(args, mockSocket as Socket, mockStoreInstance);

        expect(socketWriteSpy).toHaveBeenCalledTimes(1);
        expect(socketWriteSpy).toHaveBeenCalledWith(formatBulkString(message));
    });

}); 