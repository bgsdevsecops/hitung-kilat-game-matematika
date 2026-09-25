#!/usr/bin/env bash
set -e

# Test that TARGET=web selects hitung-kilat-web
OUTPUT_WEB=$(TARGET=web ./hitung-kilat.sh help | grep "Image:")
echo "$OUTPUT_WEB" | grep -q "hitung-kilat-web" || { echo "FAIL: web target image mismatch"; exit 1; }

# Test that TARGET=api selects hitung-kilat-api
OUTPUT_API=$(TARGET=api ./hitung-kilat.sh help | grep "Image:")
echo "$OUTPUT_API" | grep -q "hitung-kilat-api" || { echo "FAIL: api target image mismatch"; exit 1; }

echo "PASS: hitung-kilat.sh TARGET routing tests succeeded."
