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

All benchmarks below represent averages from 10 runs each, using `redis-benchmark` with 100,000 operations per test.

Bun Redis implementation (averaged over 10 runs):
- SET: ~158,211.82 requests per second (p50=0.143-0.239 msec)
- GET: ~157,587.95 requests per second (p50=0.143-0.255 msec)

Official Redis server (averaged over 10 runs):
- SET: ~163,013.53 requests per second (p50=0.127-0.231 msec)
- GET: ~160,759.53 requests per second (p50=0.127-0.239 msec)

Performance Analysis:
- SET operations: Our implementation is ~2.95% slower than Redis
- GET operations: Our implementation is ~1.97% slower than Redis

Performance Summary:
- Both SET and GET operations are within ~3% of Redis performance
- Consistent performance across multiple runs
- Latency (p50) is comparable between both implementations

Note: Benchmark results can vary based on system load, hardware, and other environmental factors. These numbers represent performance on a MacOS system under specific test conditions. Each implementation's numbers were gathered from separate benchmark sessions.

### Raw Benchmark Data

#### Bun Redis Implementation

```bash
Run 1:
$ redis-benchmark -t set,get -n 100000 -q
SET: 162337.66 requests per second, p50=0.151 msec                    
GET: 175438.59 requests per second, p50=0.143 msec                    

Run 2:
$ redis-benchmark -t set,get -n 100000 -q
SET: 157728.70 requests per second, p50=0.167 msec                    
GET: 157977.88 requests per second, p50=0.159 msec                    

Run 3:
$ redis-benchmark -t set,get -n 100000 -q
SET: 164203.61 requests per second, p50=0.151 msec                    
GET: 172117.05 requests per second, p50=0.143 msec                    

Run 4:
$ redis-benchmark -t set,get -n 100000 -q
SET: 168634.06 requests per second, p50=0.151 msec                    
GET: 170940.17 requests per second, p50=0.143 msec                    

Run 5:
$ redis-benchmark -t set,get -n 100000 -q
SET: 168350.17 requests per second, p50=0.143 msec                    
GET: 149031.30 requests per second, p50=0.175 msec                    

Run 6:
$ redis-benchmark -t set,get -n 100000 -q
SET: 147058.83 requests per second, p50=0.199 msec                    
GET: 131926.12 requests per second, p50=0.175 msec                    

Run 7:
$ redis-benchmark -t set,get -n 100000 -q
SET: 138312.59 requests per second, p50=0.239 msec                    
GET: 122100.12 requests per second, p50=0.255 msec                    

Run 8:
$ redis-benchmark -t set,get -n 100000 -q
SET: 144092.22 requests per second, p50=0.231 msec                    
GET: 169204.73 requests per second, p50=0.143 msec                    

Run 9:
$ redis-benchmark -t set,get -n 100000 -q
SET: 165562.92 requests per second, p50=0.159 msec                    
GET: 166112.95 requests per second, p50=0.143 msec                    

Run 10:
$ redis-benchmark -t set,get -n 100000 -q
SET: 165837.48 requests per second, p50=0.151 msec                    
GET: 161030.59 requests per second, p50=0.151 msec                    
```

#### Official Redis Server

```bash
Run 1:
$ redis-benchmark -t set,get -n 100000 -q
SET: 166112.95 requests per second, p50=0.135 msec                    
GET: 174520.06 requests per second, p50=0.135 msec                    

Run 2:
$ redis-benchmark -t set,get -n 100000 -q
SET: 182481.77 requests per second, p50=0.127 msec                    
GET: 173611.12 requests per second, p50=0.135 msec                    

Run 3:
$ redis-benchmark -t set,get -n 100000 -q
SET: 170940.17 requests per second, p50=0.135 msec                    
GET: 177619.89 requests per second, p50=0.135 msec                    

Run 4:
$ redis-benchmark -t set,get -n 100000 -q
SET: 177935.95 requests per second, p50=0.135 msec                    
GET: 185185.17 requests per second, p50=0.127 msec                    

Run 5:
$ redis-benchmark -t set,get -n 100000 -q
SET: 176366.86 requests per second, p50=0.135 msec                    
GET: 177619.89 requests per second, p50=0.135 msec                    

Run 6:
$ redis-benchmark -t set,get -n 100000 -q
SET: 180831.83 requests per second, p50=0.127 msec                    
GET: 156006.25 requests per second, p50=0.143 msec                    

Run 7:
$ redis-benchmark -t set,get -n 100000 -q
SET: 171526.58 requests per second, p50=0.135 msec                    
GET: 164203.61 requests per second, p50=0.143 msec                    

Run 8:
$ redis-benchmark -t set,get -n 100000 -q
SET: 131406.05 requests per second, p50=0.231 msec                    
GET: 121359.23 requests per second, p50=0.239 msec                    

Run 9:
$ redis-benchmark -t set,get -n 100000 -q
SET: 130890.05 requests per second, p50=0.231 msec                    
GET: 134408.59 requests per second, p50=0.231 msec                    

Run 10:
$ redis-benchmark -t set,get -n 100000 -q
SET: 141643.06 requests per second, p50=0.231 msec                    
GET: 143061.52 requests per second, p50=0.223 msec                    
```

## Contributing

Please see `CONTRIBUTING.md` for details.

## License

Please see `LICENSE.md` for details.