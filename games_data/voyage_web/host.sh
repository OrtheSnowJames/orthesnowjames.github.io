#!/usr/bin/env bash
set -euo pipefail

# Serves this folder (the web build) so you can play it in a browser.
#   ./host.sh          -> http://localhost:8000
#   ./host.sh 9000     -> http://localhost:9000
PORT="${1:-8000}"

cd "$(dirname "$0")"
echo "Serving the web build on http://localhost:${PORT}  (Ctrl+C to stop)"
exec python3 -m http.server "$PORT"
