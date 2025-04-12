import { type Socket } from "bun";
import { RESPParser } from "./protocol/parser"; // Import the parser
import { commandMap, formatError } from "./commands/index"; // Import command map and error formatter
import { store } from "./store/store"; // Import the store instance

// Use WeakMap to store parser instances per socket
const clientParsers = new WeakMap<Socket, RESPParser>();

const server = Bun.listen({
  hostname: "127.0.0.1",
  port: Number(process.env.PORT) || 6379,
  socket: {
    open(socket: Socket) {
      console.log("Client connected", socket.remoteAddress);

      // Create a parser for this client
      const parser = new RESPParser((commandArgs: string[]) => {
        // This callback is invoked when a full command is parsed
        console.log(`Received command from ${socket.remoteAddress}:`, commandArgs);

        if (commandArgs.length === 0) {
          // Empty command, ignore or send error?
          socket.write(formatError("ERR protocol error: received empty command array"));
          return;
        }

        // Guaranteed to have at least one element now
        const commandNameArg = commandArgs[0];

        // Explicit check for undefined to satisfy linter
        if (commandNameArg === undefined) {
             socket.write(formatError("ERR protocol error: received empty command name"));
             return;
        }

        const commandName = commandNameArg.toUpperCase();
        const handler = commandMap.get(commandName);

        if (handler) {
          try {
            // Execute the command handler
            const args = commandArgs.slice(1);
            handler(args, socket, store);
            // Note: Response writing is now handled within each command handler
          } catch (error: any) {
            console.error(`Error executing command '${commandName}':`, error);
            // Send a generic error back to the client
            socket.write(formatError(`ERR executing command '${commandName}': ${error.message || 'Unknown error'}`));
          }
        } else {
          // Unknown command
          socket.write(formatError(`ERR unknown command \`${commandName}\``));
        }
      });

      // Store the parser instance
      clientParsers.set(socket, parser);
    },
    data(socket: Socket, data: Buffer) {
      // Get the parser for this client
      const parser = clientParsers.get(socket);
      if (parser) {
        try {
          parser.parse(data); // Feed data to the parser
        } catch (error: any) {
          console.error(`Parser error for ${socket.remoteAddress}:`, error);
          // Send error response and/or close connection on parser error
          socket.write(formatError(`ERR protocol error: ${error.message || 'Invalid input'}`));
          // Consider closing the socket on severe parsing errors
          // socket.end();
          clientParsers.delete(socket); // Clean up broken parser state
        }
      } else {
        // This should ideally not happen if open logic is correct
        console.error("Parser not found for socket:", socket.remoteAddress);
        // socket.end();
      }
    },
    close(socket: Socket) {
      console.log("Client disconnected", socket.remoteAddress);
      // Clean up parser instance
      clientParsers.delete(socket);
    },
    error(socket: Socket, error: Error) {
      console.error(`Socket error (${socket.remoteAddress}):`, error);
      // Clean up parser instance on error too
      clientParsers.delete(socket);
    },
    drain(socket: Socket) {
      // Handle backpressure if needed
      console.log(`Socket drained (${socket.remoteAddress})`);
    },
  },
});

console.log(`Bun Redis server listening on ${server.hostname}:${server.port}`);
