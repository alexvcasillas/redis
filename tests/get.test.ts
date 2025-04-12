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
import { handleGet } from "../src/commands/get";
import {
	formatBulkString,
	formatError,
	formatNull,
} from "../src/commands/index";
import { KeyValueStore } from "../src/store/store";

// Mock KeyValueStore (can potentially share this mock setup across files)
mock.module("../src/store/store", () => ({
	KeyValueStore: mock(() => ({
		get: mock(() => undefined), // Default mock behavior
		set: mock(() => {}),
		delete: mock(() => false),
	})),
	store: {
		get: mock(() => undefined),
		set: mock(() => {}),
		delete: mock(() => false),
	},
}));

describe("handleGet Command", () => {
	let mockSocket: Partial<Socket>;
	let mockStoreInstance: KeyValueStore;
	let socketWriteSpy: Mock<(output: string | Buffer) => number>;
	let storeGetSpy: Mock<(key: string) => Buffer | undefined>;

	beforeEach(() => {
		mockStoreInstance = new KeyValueStore();
		storeGetSpy = spyOn(mockStoreInstance, "get");

		mockSocket = {
			write: mock((_output: string | Buffer) => {
				return 0;
			}),
			remoteAddress: "mock:1234",
		};
		socketWriteSpy = spyOn(mockSocket, "write");
	});

	it("should return error for wrong number of arguments (none)", () => {
		const args: string[] = [];
		handleGet(args, mockSocket as Socket, mockStoreInstance);

		expect(socketWriteSpy).toHaveBeenCalledTimes(1);
		expect(socketWriteSpy).toHaveBeenCalledWith(
			formatError("ERR wrong number of arguments for 'get' command"),
		);
		expect(storeGetSpy).not.toHaveBeenCalled();
	});

	it("should return error for wrong number of arguments (more than 1)", () => {
		const args = ["mykey", "extra"];
		handleGet(args, mockSocket as Socket, mockStoreInstance);

		expect(socketWriteSpy).toHaveBeenCalledTimes(1);
		expect(socketWriteSpy).toHaveBeenCalledWith(
			formatError("ERR wrong number of arguments for 'get' command"),
		);
		expect(storeGetSpy).not.toHaveBeenCalled();
	});

	it("should call store.get with the correct key and return null if key doesn't exist", () => {
		const key = "non_existent_key";
		const args = [key];
		// Ensure the mock returns undefined for this key
		storeGetSpy.mockReturnValue(undefined);

		handleGet(args, mockSocket as Socket, mockStoreInstance);

		// Check store interaction
		expect(storeGetSpy).toHaveBeenCalledTimes(1);
		expect(storeGetSpy).toHaveBeenCalledWith(key);

		// Check socket response
		expect(socketWriteSpy).toHaveBeenCalledTimes(1);
		expect(socketWriteSpy).toHaveBeenCalledWith(formatNull());
	});

	it("should call store.get with the correct key and return value if key exists", () => {
		const key = "existing_key";
		const value = "stored_value";
		const valueBuffer = Buffer.from(value);
		const args = [key];
		// Ensure the mock returns the value for this key
		storeGetSpy.mockReturnValue(valueBuffer);

		handleGet(args, mockSocket as Socket, mockStoreInstance);

		// Check store interaction
		expect(storeGetSpy).toHaveBeenCalledTimes(1);
		expect(storeGetSpy).toHaveBeenCalledWith(key);

		// Check socket response
		expect(socketWriteSpy).toHaveBeenCalledTimes(1);
		expect(socketWriteSpy).toHaveBeenCalledWith(formatBulkString(valueBuffer));
	});

	// TODO: Add tests for TTL expiration if/when implemented
});
