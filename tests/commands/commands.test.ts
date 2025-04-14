import { beforeEach, describe, expect, test } from "bun:test";
import type { Socket } from "bun";
import { handleDel } from "../../src/commands/del";
import { handleGet } from "../../src/commands/get";
import { handlePing } from "../../src/commands/ping";
import { handleSet } from "../../src/commands/set";
import { KeyValueStore } from "../../src/store/store";

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

describe("Redis Commands", () => {
	let store: KeyValueStore;
	let socket: MockSocket;

	beforeEach(() => {
		store = new KeyValueStore();
		socket = new MockSocket();
	});

	describe("PING Command", () => {
		test("should return PONG with no arguments", () => {
			handlePing([], socket as unknown as Socket, store);
			expect(socket.writes[0]?.toString()).toBe("+PONG\r\n");
		});

		test("should echo message with one argument", () => {
			handlePing(["hello"], socket as unknown as Socket, store);
			expect(socket.writes[0]?.toString()).toBe("$5\r\nhello\r\n");
		});

		test("should return error with too many arguments", () => {
			handlePing(["hello", "world"], socket as unknown as Socket, store);
			expect(socket.writes[0]?.toString()).toContain(
				"ERR wrong number of arguments",
			);
		});
	});

	describe("GET Command", () => {
		test("should return null for non-existent key", () => {
			handleGet(["non-existent"], socket as unknown as Socket, store);
			expect(socket.writes[0]?.toString()).toBe("$-1\r\n");
		});

		test("should return value for existing key", () => {
			store.set("test-key", Buffer.from("test-value"));
			handleGet(["test-key"], socket as unknown as Socket, store);
			expect(socket.writes[0]?.toString()).toBe("$10\r\ntest-value\r\n");
		});

		test("should return error with wrong number of arguments", () => {
			handleGet([], socket as unknown as Socket, store);
			expect(socket.writes[0]?.toString()).toContain(
				"ERR wrong number of arguments",
			);

			handleGet(["key1", "key2"], socket as unknown as Socket, store);
			expect(socket.writes[1]?.toString()).toContain(
				"ERR wrong number of arguments",
			);
		});
	});

	describe("SET Command", () => {
		test("should set key-value pair", () => {
			handleSet(["test-key", "test-value"], socket as unknown as Socket, store);
			expect(socket.writes[0]?.toString()).toBe("+OK\r\n");
			expect(store.get("test-key")?.toString()).toBe("test-value");
		});

		test("should overwrite existing key", () => {
			store.set("test-key", Buffer.from("old-value"));
			handleSet(["test-key", "new-value"], socket as unknown as Socket, store);
			expect(socket.writes[0]?.toString()).toBe("+OK\r\n");
			expect(store.get("test-key")?.toString()).toBe("new-value");
		});

		test("should return error with wrong number of arguments", () => {
			handleSet(["key"], socket as unknown as Socket, store);
			expect(socket.writes[0]?.toString()).toContain(
				"ERR wrong number of arguments",
			);

			handleSet(["key", "value", "extra"], socket as unknown as Socket, store);
			expect(socket.writes[1]?.toString()).toContain(
				"ERR wrong number of arguments",
			);
		});
	});

	describe("DEL Command", () => {
		test("should delete single key", () => {
			store.set("key1", Buffer.from("value1"));
			handleDel(["key1"], socket as unknown as Socket, store);
			expect(socket.writes[0]?.toString()).toBe(":1\r\n");
			expect(store.get("key1")).toBeUndefined();
		});

		test("should delete multiple keys", () => {
			store.set("key1", Buffer.from("value1"));
			store.set("key2", Buffer.from("value2"));
			store.set("key3", Buffer.from("value3"));
			handleDel(["key1", "key2", "key3"], socket as unknown as Socket, store);
			expect(socket.writes[0]?.toString()).toBe(":3\r\n");
			expect(store.get("key1")).toBeUndefined();
			expect(store.get("key2")).toBeUndefined();
			expect(store.get("key3")).toBeUndefined();
		});

		test("should return zero for non-existent keys", () => {
			handleDel(["non-existent"], socket as unknown as Socket, store);
			expect(socket.writes[0]?.toString()).toBe(":0\r\n");
		});

		test("should handle mixed existing and non-existent keys", () => {
			store.set("key1", Buffer.from("value1"));
			handleDel(["key1", "non-existent"], socket as unknown as Socket, store);
			expect(socket.writes[0]?.toString()).toBe(":1\r\n");
		});

		test("should return error with no arguments", () => {
			handleDel([], socket as unknown as Socket, store);
			expect(socket.writes[0]?.toString()).toContain(
				"ERR wrong number of arguments",
			);
		});
	});

	describe("Integration Tests", () => {
		test("should handle sequence of commands", () => {
			// SET a value
			handleSet(["key1", "value1"], socket as unknown as Socket, store);
			expect(socket.writes[0]?.toString()).toBe("+OK\r\n");

			// GET the value
			handleGet(["key1"], socket as unknown as Socket, store);
			expect(socket.writes[1]?.toString()).toBe("$6\r\nvalue1\r\n");

			// DELETE the value
			handleDel(["key1"], socket as unknown as Socket, store);
			expect(socket.writes[2]?.toString()).toBe(":1\r\n");

			// GET should return null
			handleGet(["key1"], socket as unknown as Socket, store);
			expect(socket.writes[3]?.toString()).toBe("$-1\r\n");
		});

		test("should handle multiple operations on same key", () => {
			// Multiple SETs
			handleSet(["key", "value1"], socket as unknown as Socket, store);
			handleSet(["key", "value2"], socket as unknown as Socket, store);
			handleGet(["key"], socket as unknown as Socket, store);
			expect(socket.writes[2]?.toString()).toBe("$6\r\nvalue2\r\n");

			// DELETE and verify
			handleDel(["key"], socket as unknown as Socket, store);
			handleGet(["key"], socket as unknown as Socket, store);
			expect(socket.writes[4]?.toString()).toBe("$-1\r\n");
		});
	});
});
