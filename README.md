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

All benchmarks represent statistical analysis from 30 runs each, using `redis-benchmark` with 100,000 operations per test.

Bun Redis implementation (30 runs):
- SET: 161,729.57 ±3,452.67 req/sec (95% CI) [p50=0.143-0.247 msec]
- GET: 165,915.76 ±5,218.45 req/sec (95% CI) [p50=0.135-0.247 msec]

Official Redis server (30 runs):
- SET: 173,477.73 ±2,952.97 req/sec (95% CI) [p50=0.127-0.175 msec]
- GET: 177,481.51 ±4,636.00 req/sec (95% CI) [p50=0.127-0.231 msec]

Performance Analysis:
- SET operations: Our implementation is ~6.77% slower than Redis (±1.89% CI)
- GET operations: Our implementation is ~6.52% slower than Redis (±2.12% CI)

Statistical Insights:
- Our implementation shows slightly higher variance in performance
- Both implementations have occasional performance outliers
- Redis shows more consistent baseline performance
- Latency (p50) ranges are comparable between implementations

Performance Summary:
- Both SET and GET operations maintain consistent performance within confidence intervals
- Performance gap with Redis is statistically significant but stable
- Latency remains competitive across implementations
- System load variations affect both implementations similarly

Note: Benchmark results can vary based on system load, hardware, and other environmental factors. These numbers represent performance on a MacOS system under specific test conditions. Each implementation's numbers were gathered from separate benchmark sessions with 2-second cool-down periods between runs to minimize thermal effects.

### Raw Benchmark Data

#### Bun Redis Implementation

```bash
Run 1:
$ redis-benchmark -t set,get -n 100000 -q
SET: 158730.16 requests per second, p50=0.151 msec                    
GET: 162866.44 requests per second, p50=0.143 msec                    

Run 2:
$ redis-benchmark -t set,get -n 100000 -q
SET: 164744.64 requests per second, p50=0.151 msec                    
GET: 186915.88 requests per second, p50=0.135 msec                    

Run 3:
$ redis-benchmark -t set,get -n 100000 -q
SET: 162866.44 requests per second, p50=0.151 msec                    
GET: 174216.03 requests per second, p50=0.135 msec                    

Run 4:
$ redis-benchmark -t set,get -n 100000 -q
SET: 164203.61 requests per second, p50=0.151 msec                    
GET: 168918.92 requests per second, p50=0.143 msec                    

Run 5:
$ redis-benchmark -t set,get -n 100000 -q
SET: 165289.25 requests per second, p50=0.151 msec                    
GET: 167224.08 requests per second, p50=0.143 msec                    

Run 6:
$ redis-benchmark -t set,get -n 100000 -q
SET: 168918.92 requests per second, p50=0.151 msec                    
GET: 175438.59 requests per second, p50=0.135 msec                    

Run 7:
$ redis-benchmark -t set,get -n 100000 -q
SET: 173913.05 requests per second, p50=0.143 msec                    
GET: 175438.59 requests per second, p50=0.143 msec                    

Run 8:
$ redis-benchmark -t set,get -n 100000 -q
SET: 158478.61 requests per second, p50=0.159 msec                    
GET: 156985.86 requests per second, p50=0.151 msec                    

Run 9:
$ redis-benchmark -t set,get -n 100000 -q
SET: 164473.69 requests per second, p50=0.151 msec                    
GET: 172413.80 requests per second, p50=0.143 msec                    

Run 10:
$ redis-benchmark -t set,get -n 100000 -q
SET: 170068.03 requests per second, p50=0.143 msec                    
GET: 159744.41 requests per second, p50=0.143 msec                    

Run 11:
$ redis-benchmark -t set,get -n 100000 -q
SET: 166389.34 requests per second, p50=0.143 msec                    
GET: 172413.80 requests per second, p50=0.143 msec                    

Run 12:
$ redis-benchmark -t set,get -n 100000 -q
SET: 170940.17 requests per second, p50=0.143 msec                    
GET: 163934.42 requests per second, p50=0.143 msec                    

Run 13:
$ redis-benchmark -t set,get -n 100000 -q
SET: 169491.53 requests per second, p50=0.143 msec                    
GET: 166666.66 requests per second, p50=0.143 msec                    

Run 14:
$ redis-benchmark -t set,get -n 100000 -q
SET: 161550.89 requests per second, p50=0.151 msec                    
GET: 170648.45 requests per second, p50=0.143 msec                    

Run 15:
$ redis-benchmark -t set,get -n 100000 -q
SET: 169779.30 requests per second, p50=0.143 msec                    
GET: 167224.08 requests per second, p50=0.143 msec                    

Run 16:
$ redis-benchmark -t set,get -n 100000 -q
SET: 166389.34 requests per second, p50=0.143 msec                    
GET: 174216.03 requests per second, p50=0.135 msec                    

Run 17:
$ redis-benchmark -t set,get -n 100000 -q
SET: 164744.64 requests per second, p50=0.151 msec                    
GET: 173010.38 requests per second, p50=0.135 msec                    

Run 18:
$ redis-benchmark -t set,get -n 100000 -q
SET: 164203.61 requests per second, p50=0.143 msec                    
GET: 165289.25 requests per second, p50=0.143 msec                    

Run 19:
$ redis-benchmark -t set,get -n 100000 -q
SET: 148367.95 requests per second, p50=0.183 msec                    
GET: 141442.72 requests per second, p50=0.231 msec                    

Run 20:
$ redis-benchmark -t set,get -n 100000 -q
SET: 157728.70 requests per second, p50=0.159 msec                    
GET: 168350.17 requests per second, p50=0.143 msec                    

Run 21:
$ redis-benchmark -t set,get -n 100000 -q
SET: 152905.20 requests per second, p50=0.159 msec                    
GET: 162074.56 requests per second, p50=0.143 msec                    

Run 22:
$ redis-benchmark -t set,get -n 100000 -q
SET: 127064.80 requests per second, p50=0.247 msec                    
GET: 137931.03 requests per second, p50=0.239 msec                    

Run 23:
$ redis-benchmark -t set,get -n 100000 -q
SET: 157728.70 requests per second, p50=0.151 msec                    
GET: 134770.89 requests per second, p50=0.167 msec                    

Run 24:
$ redis-benchmark -t set,get -n 100000 -q
SET: 159489.64 requests per second, p50=0.151 msec                    
GET: 169779.30 requests per second, p50=0.143 msec                    

Run 25:
$ redis-benchmark -t set,get -n 100000 -q
SET: 160513.64 requests per second, p50=0.159 msec                    
GET: 163398.70 requests per second, p50=0.143 msec                    

Run 26:
$ redis-benchmark -t set,get -n 100000 -q
SET: 156006.25 requests per second, p50=0.151 msec                    
GET: 173010.38 requests per second, p50=0.135 msec                    

Run 27:
$ redis-benchmark -t set,get -n 100000 -q
SET: 161550.89 requests per second, p50=0.151 msec                    
GET: 159235.66 requests per second, p50=0.151 msec                    

Run 28:
$ redis-benchmark -t set,get -n 100000 -q
SET: 166944.92 requests per second, p50=0.143 msec                    
GET: 163934.42 requests per second, p50=0.143 msec                    

Run 29:
$ redis-benchmark -t set,get -n 100000 -q
SET: 154559.50 requests per second, p50=0.159 msec                    
GET: 123152.71 requests per second, p50=0.247 msec                    

Run 30:
$ redis-benchmark -t set,get -n 100000 -q
SET: 150150.14 requests per second, p50=0.159 msec                    
GET: 156250.00 requests per second, p50=0.151 msec                    
```

#### Official Redis Server

```bash
Run 1:
$ redis-benchmark -t set,get -n 100000 -q
SET: 165562.92 requests per second, p50=0.135 msec                    
GET: 183486.23 requests per second, p50=0.127 msec                    

Run 2:
$ redis-benchmark -t set,get -n 100000 -q
SET: 176056.33 requests per second, p50=0.135 msec                    
GET: 174825.17 requests per second, p50=0.135 msec                    

Run 3:
$ redis-benchmark -t set,get -n 100000 -q
SET: 147492.62 requests per second, p50=0.175 msec                    
GET: 140056.03 requests per second, p50=0.223 msec                    

Run 4:
$ redis-benchmark -t set,get -n 100000 -q
SET: 154320.98 requests per second, p50=0.151 msec                    
GET: 134228.19 requests per second, p50=0.231 msec                    

Run 5:
$ redis-benchmark -t set,get -n 100000 -q
SET: 169204.73 requests per second, p50=0.135 msec                    
GET: 176056.33 requests per second, p50=0.135 msec                    

Run 6:
$ redis-benchmark -t set,get -n 100000 -q
SET: 182149.36 requests per second, p50=0.127 msec                    
GET: 184162.06 requests per second, p50=0.127 msec                    

Run 7:
$ redis-benchmark -t set,get -n 100000 -q
SET: 174216.03 requests per second, p50=0.135 msec                    
GET: 181818.17 requests per second, p50=0.127 msec                    

Run 8:
$ redis-benchmark -t set,get -n 100000 -q
SET: 180505.41 requests per second, p50=0.127 msec                    
GET: 162601.62 requests per second, p50=0.135 msec                    

Run 9:
$ redis-benchmark -t set,get -n 100000 -q
SET: 164744.64 requests per second, p50=0.135 msec                    
GET: 175438.59 requests per second, p50=0.135 msec                    

Run 10:
$ redis-benchmark -t set,get -n 100000 -q
SET: 170357.75 requests per second, p50=0.135 msec                    
GET: 183486.23 requests per second, p50=0.127 msec                    

Run 11:
$ redis-benchmark -t set,get -n 100000 -q
SET: 173010.38 requests per second, p50=0.135 msec                    
GET: 182481.77 requests per second, p50=0.127 msec                    

Run 12:
$ redis-benchmark -t set,get -n 100000 -q
SET: 177935.95 requests per second, p50=0.135 msec                    
GET: 180180.17 requests per second, p50=0.135 msec                    

Run 13:
$ redis-benchmark -t set,get -n 100000 -q
SET: 182149.36 requests per second, p50=0.127 msec                    
GET: 188679.25 requests per second, p50=0.127 msec                    

Run 14:
$ redis-benchmark -t set,get -n 100000 -q
SET: 176366.86 requests per second, p50=0.135 msec                    
GET: 178253.12 requests per second, p50=0.135 msec                    

Run 15:
$ redis-benchmark -t set,get -n 100000 -q
SET: 176056.33 requests per second, p50=0.135 msec                    
GET: 184162.06 requests per second, p50=0.127 msec                    

Run 16:
$ redis-benchmark -t set,get -n 100000 -q
SET: 180180.17 requests per second, p50=0.135 msec                    
GET: 183486.23 requests per second, p50=0.127 msec                    

Run 17:
$ redis-benchmark -t set,get -n 100000 -q
SET: 176991.16 requests per second, p50=0.135 msec                    
GET: 177619.89 requests per second, p50=0.135 msec                    

Run 18:
$ redis-benchmark -t set,get -n 100000 -q
SET: 180505.41 requests per second, p50=0.127 msec                    
GET: 176056.33 requests per second, p50=0.135 msec                    

Run 19:
$ redis-benchmark -t set,get -n 100000 -q
SET: 170940.17 requests per second, p50=0.135 msec                    
GET: 185185.17 requests per second, p50=0.127 msec                    

Run 20:
$ redis-benchmark -t set,get -n 100000 -q
SET: 180180.17 requests per second, p50=0.127 msec                    
GET: 184162.06 requests per second, p50=0.127 msec                    

Run 21:
$ redis-benchmark -t set,get -n 100000 -q
SET: 173611.12 requests per second, p50=0.135 msec                    
GET: 183486.23 requests per second, p50=0.127 msec                    

Run 22:
$ redis-benchmark -t set,get -n 100000 -q
SET: 170940.17 requests per second, p50=0.135 msec                    
GET: 177619.89 requests per second, p50=0.135 msec                    

Run 23:
$ redis-benchmark -t set,get -n 100000 -q
SET: 170357.75 requests per second, p50=0.135 msec                    
GET: 189393.94 requests per second, p50=0.127 msec                    

Run 24:
$ redis-benchmark -t set,get -n 100000 -q
SET: 175131.36 requests per second, p50=0.135 msec                    
GET: 178253.12 requests per second, p50=0.135 msec                    

Run 25:
$ redis-benchmark -t set,get -n 100000 -q
SET: 181818.17 requests per second, p50=0.127 msec                    
GET: 185873.61 requests per second, p50=0.127 msec                    

Run 26:
$ redis-benchmark -t set,get -n 100000 -q
SET: 179211.45 requests per second, p50=0.127 msec                    
GET: 179856.11 requests per second, p50=0.135 msec                    

Run 27:
$ redis-benchmark -t set,get -n 100000 -q
SET: 173913.05 requests per second, p50=0.135 msec                    
GET: 182815.36 requests per second, p50=0.135 msec                    

Run 28:
$ redis-benchmark -t set,get -n 100000 -q
SET: 177935.95 requests per second, p50=0.135 msec                    
GET: 176678.45 requests per second, p50=0.135 msec                    

Run 29:
$ redis-benchmark -t set,get -n 100000 -q
SET: 169779.30 requests per second, p50=0.135 msec                    
GET: 165016.50 requests per second, p50=0.143 msec                    

Run 30:
$ redis-benchmark -t set,get -n 100000 -q
SET: 165562.92 requests per second, p50=0.135 msec                    
GET: 172413.80 requests per second, p50=0.135 msec                    
```

## Contributing

Please see `