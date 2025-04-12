import { describe, it, expect, mock, spyOn, beforeEach } from "bun:test";
import { handleDel } from "../src/commands/del";
import { formatError, formatInteger } from "../src/commands/index";
import { KeyValueStore } from "../src/store/store";
import { type Socket } from "bun";

// Mock KeyValueStore
mock.module('../src/store/store', () => ({
    KeyValueStore: mock(() => ({
        get: mock(() => undefined),
        set: mock(() => {}),
        delete: mock(() => false), // Default mock behavior
    })),
    store: {
        get: mock(() => undefined),
        set: mock(() => {}),
        delete: mock(() => false),
    }
}));

describe("handleDel Command", () => {

    let mockSocket: Partial<Socket>;
    let mockStoreInstance: KeyValueStore;
    let socketWriteSpy: any;
    let storeDeleteSpy: any;

    beforeEach(() => {
        mockStoreInstance = new KeyValueStore();
        storeDeleteSpy = spyOn(mockStoreInstance, 'delete');

        mockSocket = {
            write: mock((_output: string | Buffer) => { return 0; }),
            remoteAddress: "mock:1234"
        };
        socketWriteSpy = spyOn(mockSocket, 'write');
    });

    it("should return error if no keys are provided", () => {
        const args: string[] = [];
        handleDel(args, mockSocket as Socket, mockStoreInstance);

        expect(socketWriteSpy).toHaveBeenCalledTimes(1);
        expect(socketWriteSpy).toHaveBeenCalledWith(
            formatError("ERR wrong number of arguments for 'del' command")
        );
        expect(storeDeleteSpy).not.toHaveBeenCalled();
    });

    it("should call store.delete for a single key and return 1 if deleted", () => {
        const key = "key_to_delete";
        const args = [key];
        storeDeleteSpy.mockReturnValue(true); // Mock successful deletion

        handleDel(args, mockSocket as Socket, mockStoreInstance);

        expect(storeDeleteSpy).toHaveBeenCalledTimes(1);
        expect(storeDeleteSpy).toHaveBeenCalledWith(key);
        expect(socketWriteSpy).toHaveBeenCalledTimes(1);
        expect(socketWriteSpy).toHaveBeenCalledWith(formatInteger(1));
    });

    it("should call store.delete for a single key and return 0 if not found", () => {
        const key = "non_existent_key";
        const args = [key];
        storeDeleteSpy.mockReturnValue(false); // Mock key not found

        handleDel(args, mockSocket as Socket, mockStoreInstance);

        expect(storeDeleteSpy).toHaveBeenCalledTimes(1);
        expect(storeDeleteSpy).toHaveBeenCalledWith(key);
        expect(socketWriteSpy).toHaveBeenCalledTimes(1);
        expect(socketWriteSpy).toHaveBeenCalledWith(formatInteger(0));
    });

    it("should call store.delete for multiple keys and return the count of deleted keys", () => {
        const keys = ["key1", "missing_key", "key2"];
        const args = keys;

        // Mock behavior for each key
        storeDeleteSpy.mockImplementation((k: string) => {
            if (k === "key1" || k === "key2") {
                return true; // Simulate deletion
            }
            return false; // Simulate key not found
        });

        handleDel(args, mockSocket as Socket, mockStoreInstance);

        // Check store interaction for each key
        expect(storeDeleteSpy).toHaveBeenCalledTimes(keys.length);
        expect(storeDeleteSpy).toHaveBeenCalledWith("key1");
        expect(storeDeleteSpy).toHaveBeenCalledWith("missing_key");
        expect(storeDeleteSpy).toHaveBeenCalledWith("key2");

        // Check socket response (count should be 2)
        expect(socketWriteSpy).toHaveBeenCalledTimes(1);
        expect(socketWriteSpy).toHaveBeenCalledWith(formatInteger(2));
    });

    // TODO: Add tests for TTL clearing if/when implemented
}); 