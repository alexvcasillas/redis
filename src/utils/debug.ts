/**
 * Debug logging utility that only logs when process.env.DEBUG is true
 */
export const debug = {
	log: (...args: unknown[]) => {
		if (process.env.DEBUG === "true") {
			console.log(...args);
		}
	},
	error: (...args: unknown[]) => {
		if (process.env.DEBUG === "true") {
			console.error(...args);
		}
	},
	warn: (...args: unknown[]) => {
		if (process.env.DEBUG === "true") {
			console.warn(...args);
		}
	},
};
