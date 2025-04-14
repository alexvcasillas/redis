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
SET: 160771.70 requests per second, p50=0.151 msec                    
GET: 178253.12 requests per second, p50=0.143 msec                    
```

Using `redis-benchmark` with this project against the official Redis server:

```bash
redis-benchmark -t set,get -n 100000 -q
SET: 171821.30 requests per second, p50=0.143 msec                    
GET: 185185.17 requests per second, p50=0.143 msec
```

Bun Redis implementation:
- SET: 160,771.70 requests per second
- GET: 178,253.12 requests per second

Official Redis:
- SET: 171,821.30 requests per second
- GET: 185,185.17 requests per second


For SET operations:
- Difference: 171,821.30 - 160,771.70 = 11,049.60 req/s
- Percentage faster: (11,049.60 / 160,771.70) × 100 ≈ 6.87%

For GET operations:
- Difference: 185,185.17 - 178,253.12 = 6,932.05 req/s
- Percentage faster: (6,932.05 / 178,253.12) × 100 ≈ 3.89%

The official Redis server is now only:
- Approximately 6.87% faster for SET operations
- Approximately 3.89% faster for GET operations

This represents a remarkable improvement over our previous performance:
- SET operations improved by ~39% (from 115,874.86 to 160,771.70 req/s)
- GET operations improved by ~48% (from 120,048.02 to 178,253.12 req/s)

The performance gap with the official Redis server has been dramatically reduced from ~51% (the initial implementation) to just ~5.4% on average.
This puts our Bun Redis implementation very close to native C Redis performance!

## Contributing

Please see `CONTRIBUTING.md` for details.

## License

Please see `LICENSE.md` for details.
