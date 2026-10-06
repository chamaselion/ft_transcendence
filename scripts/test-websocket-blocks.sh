#!/usr/bin/env bash
# Runs the block-based WebSocket end-to-end test inside the backend container.
# Requires the stack to be running (make up).
set -euo pipefail

SERVICE=backend
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "== Copying block test into the $SERVICE container"
docker compose cp "$SCRIPT_DIR/test-websocket-blocks.js" "$SERVICE:/usr/src/app/ws-block-test.js"

echo "== Running block-based WebSocket test"
set +e
docker compose exec -T "$SERVICE" node /usr/src/app/ws-block-test.js
STATUS=$?
set -e

echo "== Cleaning up"
docker compose exec -T "$SERVICE" rm -f /usr/src/app/ws-block-test.js || true

exit $STATUS
