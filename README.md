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

Using `redis-benchmark`:

**SET Command:**

```bash
redis-benchmark -h 127.0.0.1 -t SET -n 100000 -c 50
```

```
Latency by percentile distribution:
0.000% <= 0.111 milliseconds (cumulative count 1)
50.000% <= 0.423 milliseconds (cumulative count 50179)
75.000% <= 0.559 milliseconds (cumulative count 77305)
87.500% <= 0.583 milliseconds (cumulative count 87645)
93.750% <= 0.647 milliseconds (cumulative count 93942)
96.875% <= 0.887 milliseconds (cumulative count 96930)
98.438% <= 1.031 milliseconds (cumulative count 98454)
99.219% <= 1.103 milliseconds (cumulative count 99270)
99.609% <= 1.151 milliseconds (cumulative count 99642)
99.805% <= 1.215 milliseconds (cumulative count 99807)
99.902% <= 1.343 milliseconds (cumulative count 99916)
99.951% <= 1.391 milliseconds (cumulative count 99956)
99.976% <= 1.463 milliseconds (cumulative count 99976)
99.988% <= 1.551 milliseconds (cumulative count 99988)
99.994% <= 1.575 milliseconds (cumulative count 99994)
99.997% <= 1.671 milliseconds (cumulative count 99997)
99.998% <= 1.895 milliseconds (cumulative count 99999)
99.999% <= 1.903 milliseconds (cumulative count 100000)
100.000% <= 1.903 milliseconds (cumulative count 100000)

Cumulative distribution of latencies:
0.000% <= 0.103 milliseconds (cumulative count 0)
0.005% <= 0.207 milliseconds (cumulative count 5)
22.054% <= 0.303 milliseconds (cumulative count 22054)
48.686% <= 0.407 milliseconds (cumulative count 48686)
54.791% <= 0.503 milliseconds (cumulative count 54791)
91.867% <= 0.607 milliseconds (cumulative count 91867)
94.751% <= 0.703 milliseconds (cumulative count 94751)
95.909% <= 0.807 milliseconds (cumulative count 95909)
97.143% <= 0.903 milliseconds (cumulative count 97143)
98.214% <= 1.007 milliseconds (cumulative count 98214)
99.270% <= 1.103 milliseconds (cumulative count 99270)
99.791% <= 1.207 milliseconds (cumulative count 99791)
99.887% <= 1.303 milliseconds (cumulative count 99887)
99.960% <= 1.407 milliseconds (cumulative count 99960)
99.983% <= 1.503 milliseconds (cumulative count 99983)
99.995% <= 1.607 milliseconds (cumulative count 99995)
99.998% <= 1.703 milliseconds (cumulative count 99998)
100.000% <= 1.903 milliseconds (cumulative count 100000)

Summary:
  throughput summary: 108342.37 requests per second
  latency summary (msec):
          avg       min       p50       p95       p99       max
        0.454     0.104     0.423     0.727     1.087     1.903
```

**GET Command:**

```bash
redis-benchmark -h 127.0.0.1 -t GET -n 100000 -c 50
```

```
Latency by percentile distribution:
0.000% <= 0.095 milliseconds (cumulative count 1)
50.000% <= 0.415 milliseconds (cumulative count 50138)
75.000% <= 0.527 milliseconds (cumulative count 79769)
87.500% <= 0.551 milliseconds (cumulative count 88485)
93.750% <= 0.695 milliseconds (cumulative count 93774)
96.875% <= 0.839 milliseconds (cumulative count 96918)
98.438% <= 0.975 milliseconds (cumulative count 98454)
99.219% <= 1.039 milliseconds (cumulative count 99238)
99.609% <= 1.071 milliseconds (cumulative count 99623)
99.805% <= 1.103 milliseconds (cumulative count 99807)
99.902% <= 1.215 milliseconds (cumulative count 99905)
99.951% <= 1.279 milliseconds (cumulative count 99956)
99.976% <= 1.343 milliseconds (cumulative count 99976)
99.988% <= 1.383 milliseconds (cumulative count 99988)
99.994% <= 1.431 milliseconds (cumulative count 99996)
99.997% <= 1.439 milliseconds (cumulative count 99997)
99.998% <= 1.591 milliseconds (cumulative count 99999)
99.999% <= 1.599 milliseconds (cumulative count 100000)
100.000% <= 1.599 milliseconds (cumulative count 100000)

Cumulative distribution of latencies:
0.015% <= 0.103 milliseconds (cumulative count 15)
0.315% <= 0.207 milliseconds (cumulative count 315)
29.767% <= 0.303 milliseconds (cumulative count 29767)
49.355% <= 0.407 milliseconds (cumulative count 49355)
63.496% <= 0.503 milliseconds (cumulative count 63496)
91.878% <= 0.607 milliseconds (cumulative count 91878)
93.973% <= 0.703 milliseconds (cumulative count 93973)
96.514% <= 0.807 milliseconds (cumulative count 96514)
97.617% <= 0.903 milliseconds (cumulative count 97617)
98.745% <= 1.007 milliseconds (cumulative count 98745)
99.807% <= 1.103 milliseconds (cumulative count 99807)
99.901% <= 1.207 milliseconds (cumulative count 99901)
99.965% <= 1.303 milliseconds (cumulative count 99965)
99.990% <= 1.407 milliseconds (cumulative count 99990)
99.998% <= 1.503 milliseconds (cumulative count 99998)
100.000% <= 1.607 milliseconds (cumulative count 100000)

Summary:
  throughput summary: 111607.14 requests per second
  latency summary (msec):
          avg       min       p50       p95       p99       max
        0.434     0.088     0.415     0.743     1.031     1.599
```

## Contributing

Please see `CONTRIBUTING.md` for details.

## License

Please see `LICENSE.md` for details.
