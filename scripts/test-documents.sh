#!/usr/bin/env bash
# End-to-end smoke test for the documents API through nginx.
# Requires the stack to be running (make up). Uses a unique test user
# each run so it can be run repeatedly without conflicts.
set -euo pipefail

BASE="${BASE:-https://localhost:8443}"
STAMP="$(date +%s)"
EMAIL="tester_${STAMP}@example.com"
LOGIN="tester_${STAMP}"
PASS="password123"
COOKIES="$(mktemp)"

echo "== Base URL: $BASE"
echo "== Test user: $EMAIL"
echo

echo "1) Register user"
curl -sk -X POST "$BASE/api/auth/register" -H 'Content-Type: application/json' \
  -d "{\"login\":\"$LOGIN\",\"email\":\"$EMAIL\",\"password\":\"$PASS\"}"
echo; echo

echo "2) Login (returns challengeId + 2FA debug code)"
RESP="$(curl -sk -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")"
echo "$RESP"
CID="$(echo "$RESP" | grep -o '"challengeId":"[^"]*"' | cut -d'"' -f4)"
CODE="$(echo "$RESP" | grep -o '"debugCode":"[^"]*"' | cut -d'"' -f4)"
echo
if [ -z "$CODE" ]; then
  echo "!! No debugCode in response. Read it from the backend log instead:"
  echo "   docker compose logs backend | tail"
  exit 1
fi

echo "3) Confirm 2FA -> stores login cookie"
curl -sk -c "$COOKIES" -X POST "$BASE/api/auth/login/confirm" -H 'Content-Type: application/json' \
  -d "{\"challengeId\":\"$CID\",\"email\":\"$EMAIL\",\"code\":\"$CODE\"}"
echo; echo

echo "4) Create a document"
DOC="$(curl -sk -b "$COOKIES" -X POST "$BASE/api/documents" -H 'Content-Type: application/json' \
  -d '{"title":"My first doc","content":"hello world"}')"
echo "$DOC"
DOC_ID="$(echo "$DOC" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)"
echo; echo

echo "5) List documents"
curl -sk -b "$COOKIES" "$BASE/api/documents"
echo; echo

echo "6) Update the document"
curl -sk -b "$COOKIES" -X PATCH "$BASE/api/documents/$DOC_ID" -H 'Content-Type: application/json' \
  -d '{"content":"edited content"}'
echo; echo

echo "7) Delete the document (expect HTTP 204)"
curl -sk -b "$COOKIES" -o /dev/null -w "HTTP %{http_code}\n" -X DELETE "$BASE/api/documents/$DOC_ID"
echo

rm -f "$COOKIES"
echo "Done."
