// Common string constants
export const ERROR_PREFIX = "-ERR ";
export const CRLF = "\r\n";

// Pre-formatted responses for common cases
export const NULL_RESPONSE = Buffer.from("$-1\r\n");
export const OK_RESPONSE = Buffer.from("+OK\r\n");
export const PONG_RESPONSE = Buffer.from("+PONG\r\n");
export const ZERO_RESPONSE = Buffer.from(":0\r\n");
export const ONE_RESPONSE = Buffer.from(":1\r\n");
export const TWO_RESPONSE = Buffer.from(":2\r\n");
export const THREE_RESPONSE = Buffer.from(":3\r\n");
export const SYNTAX_ERROR_RESPONSE = Buffer.from("-ERR syntax error\r\n");
