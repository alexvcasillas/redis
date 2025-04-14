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

Using `redis-benchmark` with this project in the production compilation environment (MacOS native):

```bash
redis-benchmark -t set,get -n 100000 -q
SET: 153,264.93 requests per second, p50=0.159 msec                    
GET: 161,190.10 requests per second, p50=0.143 msec                    
```

Using `redis-benchmark` with this project against the official Redis server:

```bash
redis-benchmark -t set,get -n 100000 -q
SET: 161,343.75 requests per second, p50=0.143 msec                    
GET: 173,622.50 requests per second, p50=0.143 msec
```

Bun Redis implementation:
- SET: ~153,264.93 requests per second
- GET: ~161,190.10 requests per second

Official Redis:
- SET: ~161,343.75 requests per second
- GET: ~173,622.50 requests per second

For SET operations:
- Difference: ~161,343.75 - ~153,264.93 = ~8,078.82 req/s
- Percentage faster: (~8,078.82 / ~153,264.93) × 100 ≈ ~5.27%

For GET operations:
- Difference: ~173,622.50 - ~161,190.10 = ~12,432.40 req/s
- Percentage faster: (~12,432.40 / ~161,190.10) × 100 ≈ ~7.16%

The official Redis server is:
- Approximately ~5.27% faster for SET operations
- Approximately ~7.16% faster for GET operations

Recent Improvements:
- GET operations improved by ~2.86% through TTL optimization
- SET operations improved by ~2.72% through storage optimization
- Overall performance gap with Redis reduced from ~10.80% to ~7.16%

## Contributing

Please see `CONTRIBUTING.md` for details.

## License

Please see `LICENSE.md` for details.