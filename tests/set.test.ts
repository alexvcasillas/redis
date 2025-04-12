import { describe, it, expect, mock, spyOn, beforeEach } from "bun:test";
import { handleSet } from "../src/commands/set";
import { formatError, formatSimpleString } from "../src/commands/index";
import { KeyValueStore } from "../src/store/store";
import { type Socket } from "bun";

// Mock KeyValueStore
mock.module('../src/store/store', () => ({
    KeyValueStore: mock(() => ({
        get: mock(() => undefined),
        set: mock(() => {}),
        delete: mock(() => false),
    })),
    // Ensure the singleton export is also mocked if handlers import it directly
    // Although our handlers receive the store as an argument, this is safer.
    store: {
        get: mock(() => undefined),
        set: mock(() => {}),
        delete: mock(() => false),
    }
}));

describe("handleSet Command", () => {

    let mockSocket: Partial<Socket>;
    let mockStoreInstance: KeyValueStore;
    let socketWriteSpy: any; // To check responses
    let storeSetSpy: any; // To check store interactions

    beforeEach(() => {
        // Reset mocks before each test
        mockStoreInstance = new KeyValueStore(); // Create instance of mocked class
        storeSetSpy = spyOn(mockStoreInstance, 'set');

        // Simple mock socket with a spyable write method
        mockSocket = {
            write: mock((_output: string | Buffer) => { return 0; }),
            remoteAddress: "mock:1234"
        };
        socketWriteSpy = spyOn(mockSocket, 'write');
    });

    it("should return error for wrong number of arguments (less than 2)", () => {
        const args = ["mykey"];
        handleSet(args, mockSocket as Socket, mockStoreInstance);

        expect(socketWriteSpy).toHaveBeenCalledTimes(1);
        expect(socketWriteSpy).toHaveBeenCalledWith(
            formatError("ERR wrong number of arguments for 'set' command")
        );
        expect(storeSetSpy).not.toHaveBeenCalled();
    });

    it("should return error for wrong number of arguments (more than 2)", () => {
        const args = ["mykey", "myvalue", "extra"];
        handleSet(args, mockSocket as Socket, mockStoreInstance);

        expect(socketWriteSpy).toHaveBeenCalledTimes(1);
        expect(socketWriteSpy).toHaveBeenCalledWith(
            formatError("ERR wrong number of arguments for 'set' command")
        );
        expect(storeSetSpy).not.toHaveBeenCalled();
    });

    it("should call store.set with correct key/value and return OK", () => {
        const args = ["mykey", "myvalue"];
        handleSet(args, mockSocket as Socket, mockStoreInstance);

        // Check store interaction
        expect(storeSetSpy).toHaveBeenCalledTimes(1);
        // Verify value is stored as a Buffer
        expect(storeSetSpy).toHaveBeenCalledWith("mykey", Buffer.from("myvalue"));

        // Check socket response
        expect(socketWriteSpy).toHaveBeenCalledTimes(1);
        expect(socketWriteSpy).toHaveBeenCalledWith(formatSimpleString("OK"));
    });

    it("should handle keys and values with spaces", () => {
        const key = "my key with spaces";
        const value = "my value with spaces";
        const args = [key, value];
        handleSet(args, mockSocket as Socket, mockStoreInstance);

        expect(storeSetSpy).toHaveBeenCalledTimes(1);
        expect(storeSetSpy).toHaveBeenCalledWith(key, Buffer.from(value));
        expect(socketWriteSpy).toHaveBeenCalledTimes(1);
        expect(socketWriteSpy).toHaveBeenCalledWith(formatSimpleString("OK"));
    });

    // TODO: Add tests for options like EX, PX, NX, XX once implemented
});
