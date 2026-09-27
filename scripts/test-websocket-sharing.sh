#!/usr/bin/env bash
# Runs the WebSocket sharing/permission test inside the backend container,
# where the `ws` module is installed and localhost:3001 is the backend.
# Requires the stack to be running (make up) and EMAIL_TRANSPORT=console.
set -euo pipefail

SERVICE=backend
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "== Copying test into the $SERVICE container"
docker compose cp "$SCRIPT_DIR/test-websocket-sharing.js" "$SERVICE:/usr/src/app/ws-sharing-test.js"

echo "== Running WebSocket sharing test"
# Forwarded for case 6, which promotes and demotes a throwaway account and
# therefore needs an existing admin. Defaults match test-document-sharing.sh.
ADMIN_EMAIL="${ADMIN_EMAIL:-test@gmail.com}"
ADMIN_PASS="${ADMIN_PASS:-password123}"

set +e
docker compose exec -T \
  -e ADMIN_EMAIL="$ADMIN_EMAIL" \
  -e ADMIN_PASS="$ADMIN_PASS" \
  -e WS_HEARTBEAT_MS="${WS_HEARTBEAT_MS:-}" \
  "$SERVICE" node /usr/src/app/ws-sharing-test.js
STATUS=$?
set -e

echo "== Cleaning up"
docker compose exec -T "$SERVICE" rm -f /usr/src/app/ws-sharing-test.js || true

exit $STATUS
