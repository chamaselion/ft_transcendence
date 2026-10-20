#!/usr/bin/env bash
# Runs the document translation and zero-drift end-to-end test inside the backend container.
# Requires the stack to be running (make up).
set -euo pipefail

SERVICE=backend
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "== Copying translation test into the $SERVICE container"
docker compose cp "$SCRIPT_DIR/test-translation.js" "$SERVICE:/usr/src/app/translation-test.js"

echo "== Running Document Translation End-to-End Test"
set +e
docker compose exec -T "$SERVICE" node /usr/src/app/translation-test.js
STATUS=$?
set -e

echo "== Cleaning up"
docker compose exec -T "$SERVICE" rm -f /usr/src/app/translation-test.js || true

exit $STATUS
