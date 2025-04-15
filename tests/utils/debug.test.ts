import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import { debug } from "../../src/utils/debug";

describe("Debug Utility", () => {
	const originalConsole = global.console;
	const originalEnv = process.env.DEBUG;

	beforeEach(() => {
		// Mock console methods
		global.console = {
			...console,
			log: jest.fn(),
			error: jest.fn(),
			warn: jest.fn(),
		};
	});

	afterEach(() => {
		// Restore console
		global.console = originalConsole;
		process.env.DEBUG = originalEnv;
	});

	describe("with DEBUG=true", () => {
		beforeEach(() => {
			process.env.DEBUG = "true";
		});

		test("should log messages when DEBUG is true", () => {
			const message = "test message";
			debug.log(message);
			expect(console.log).toHaveBeenCalledWith(message);
		});

		test("should log error messages when DEBUG is true", () => {
			const error = "test error";
			debug.error(error);
			expect(console.error).toHaveBeenCalledWith(error);
		});

		test("should log warning messages when DEBUG is true", () => {
			const warning = "test warning";
			debug.warn(warning);
			expect(console.warn).toHaveBeenCalledWith(warning);
		});

		test("should handle multiple arguments", () => {
			const arg1 = "test";
			const arg2 = { key: "value" };
			debug.log(arg1, arg2);
			expect(console.log).toHaveBeenCalledWith(arg1, arg2);
		});
	});

	describe("with DEBUG=false", () => {
		beforeEach(() => {
			process.env.DEBUG = "false";
		});

		test("should not log messages when DEBUG is false", () => {
			debug.log("test");
			expect(console.log).not.toHaveBeenCalled();
		});

		test("should not log error messages when DEBUG is false", () => {
			debug.error("test");
			expect(console.error).not.toHaveBeenCalled();
		});

		test("should not log warning messages when DEBUG is false", () => {
			debug.warn("test");
			expect(console.warn).not.toHaveBeenCalled();
		});
	});
});
