#!/bin/sh
set -e

# Target output file (allows override for testing)
CONFIG_FILE="${TARGET_CONFIG_FILE:-/usr/share/nginx/html/firebase-config.js}"

if [ -n "$FIREBASE_CONFIG_JSON" ]; then
  echo "window.__FIREBASE_CONFIG__ = $FIREBASE_CONFIG_JSON;" > "$CONFIG_FILE"
  echo "[entrypoint] Injected production Firebase runtime configuration into $CONFIG_FILE"
else
  echo "// Default local fallback" > "$CONFIG_FILE"
  echo "[entrypoint] No FIREBASE_CONFIG_JSON specified; using default bundled configuration."
fi
