#!/bin/sh
set -e

# Target output file (allows override for testing)
CONFIG_FILE="${TARGET_CONFIG_FILE:-/usr/share/nginx/html/firebase-config.js}"

if [ -n "$FIREBASE_CONFIG_JSON" ]; then
  printf 'window.__FIREBASE_CONFIG__ = %s;\n' "$FIREBASE_CONFIG_JSON" > "$CONFIG_FILE"
  echo "[entrypoint] Injected production Firebase runtime configuration into $CONFIG_FILE"
else
  printf '// Default local fallback\n' > "$CONFIG_FILE"
  echo "[entrypoint] No FIREBASE_CONFIG_JSON specified; using default bundled configuration."
fi
