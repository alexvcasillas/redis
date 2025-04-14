#!/bin/bash
echo "Bun Redis Implementation Benchmark"
echo "================================"
echo
for i in {1..30}; do
    echo "Run $i:"
    bun run benchmark
    sleep 2  # Cool down period
done
