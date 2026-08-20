#!/usr/bin/env bash
# Runs the WebSocket end-to-end test inside the backend container,
# where the `ws` module is installed and localhost:3001 is the backend.
# Requires the stack to be running (make up).
set -euo pipefail

SERVICE=backend
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "== Copying test into the $SERVICE container"
docker compose cp "$SCRIPT_DIR/test-websocket.js" "$SERVICE:/usr/src/app/ws-test.js"

echo "== Running WebSocket test"
set +e
docker compose exec -T "$SERVICE" node /usr/src/app/ws-test.js
STATUS=$?
set -e

echo "== Cleaning up"
docker compose exec -T "$SERVICE" rm -f /usr/src/app/ws-test.js || true

exit $STATUS
