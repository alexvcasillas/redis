# Bun Redis Server

A Redis server implementation in Bun.

## Installation

```bash
bun install
```

## Development

```bash
bun run dev
```

## Production

```bash
bun run build
./bun-redis-server
```

## Features

This server currently supports the following Redis commands:

**PING:** Checks if the server is alive. Returns "PONG" if no argument is provided, otherwise returns the argument.

```redis
> PING
PONG
> PING "hello world"
hello world
```

**SET:** Sets a key-value pair.

```redis
> SET color red
OK
```

**GET:** Retrieves the value associated with a key.

```redis
> GET color
red
> GET nonexistingkey
(nil)
```

**DEL:** Deletes one or more keys. Returns the number of keys deleted.

```redis
> DEL color
(integer) 1
> DEL nonexistingkey
(integer) 0
```

**CONFIG:** (Currently limited) Used to get configuration parameters.

```redis
> CONFIG GET dir
*2
$3
dir
$1
.
> CONFIG GET databases
*2
$9
databases
$1
1
```

## Benchmarks

Using `redis-benchmark` with this project in the production compilation environment:

```bash
redis-benchmark -t set,get -n 100000 -q
SET: 103092.78 requests per second, p50=0.519 msec                    
GET: 111982.08 requests per second, p50=0.407 msec                    
```

Using `redis-benchmark` with this project against the official Redis server:

```bash
redis-benchmark -t set,get -n 100000 -q
SET: 171821.30 requests per second, p50=0.143 msec                    
GET: 185185.17 requests per second, p50=0.143 msec
```

Bun Redist implementation:
- SET: 103,092.78 requests per second
- GET: 111,982.08 requests per second

Official Redis:
- SET: 171,821.30 requests per second
- GET: 185,185.17 requests per second


For SET operations:
- Difference: 171,821.30 - 103,092.78 = 68,728.52 req/s
- Percentage faster: (68,728.52 / 103,092.78) × 100 ≈ 66.67%

For GET operations:
- Difference: 185,185.17 - 111,982.08 = 73,203.09 req/s
- Percentage faster: (73,203.09 / 111,982.08) × 100 ≈ 65.37%

The official Redis server is:
- Approximately 66.67% faster for SET operations
- Approximately 65.37% faster for GET operations

## Contributing

Please see `CONTRIBUTING.md` for details.

## License

Please see `LICENSE.md` for details.
