#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<EOF
Usage: $(basename "$0") [base_url]

Checks the backend endpoints with curl.
Default base URL: http://localhost:3001
You can also set API_BASE_URL.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

BASE_URL="${1:-${API_BASE_URL:-http://localhost:3001}}"
RUN_ID="$(date +%s)-$$"
TEST_LOGIN="testuser-${RUN_ID}"
TEST_EMAIL="testuser-${RUN_ID}@example.com"
TEST_PASSWORD="Password123!"
FAILED=0

cleanup() {
  if [[ -n "${TMP_DIR:-}" && -d "$TMP_DIR" ]]; then
    rm -rf "$TMP_DIR"
  fi
}

trap cleanup EXIT

TMP_DIR="$(mktemp -d)"

log() {
  printf '%s\n' "$1"
}

fail() {
  log "✗ $1"
  FAILED=1
}

pass() {
  log "✓ $1"
}

assert_status() {
  local expected="$1"
  local actual="$2"
  local label="$3"

  if [[ "$actual" == "$expected" ]]; then
    pass "$label"
  else
    fail "$label (expected HTTP $expected, got HTTP $actual)"
  fi
}

assert_contains() {
  local haystack="$1"
  local needle="$2"
  local label="$3"

  if grep -Fq "$needle" <<<"$haystack"; then
    pass "$label"
  else
    fail "$label (missing: $needle)"
  fi
}

request_json() {
  local method="$1"
  local path="$2"
  local data="${3:-}"
  local body_file

  body_file="$(mktemp "$TMP_DIR/response.XXXXXX")"
  local curl_args=(-sS -o "$body_file" -w '%{http_code}' -X "$method" "$BASE_URL$path")

  if [[ -n "$data" ]]; then
    curl_args+=(-H 'Content-Type: application/json' -d "$data")
  fi

  if ! RESPONSE_STATUS="$(curl "${curl_args[@]}")"; then
    RESPONSE_BODY="$(cat "$body_file" 2>/dev/null || true)"
    fail "Request to $method $path failed"
    exit 1
  fi
  RESPONSE_BODY="$(cat "$body_file")"
}

log "Checking backend at $BASE_URL"
log ""

log "[1/5] GET /health"
request_json "GET" "/health"
assert_status "200" "$RESPONSE_STATUS" "Health endpoint returns HTTP 200"
assert_contains "$RESPONSE_BODY" '"status":"ok"' "Health endpoint returns ok payload"
log ""

log "[2/5] POST /api/auth/register"
register_payload="{\"login\":\"$TEST_LOGIN\",\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}"
request_json "POST" "/api/auth/register" "$register_payload"
assert_status "201" "$RESPONSE_STATUS" "Register endpoint creates a user"
assert_contains "$RESPONSE_BODY" "\"login\":\"$TEST_LOGIN\"" "Register response includes login"
assert_contains "$RESPONSE_BODY" "\"email\":\"$TEST_EMAIL\"" "Register response includes email"
assert_contains "$RESPONSE_BODY" '"id":' "Register response includes id"
log ""

log "[3/5] POST /api/auth/register with duplicate email"
request_json "POST" "/api/auth/register" "$register_payload"
assert_status "409" "$RESPONSE_STATUS" "Duplicate registration is rejected"
assert_contains "$RESPONSE_BODY" '"error":"Email already in use"' "Duplicate registration returns expected error"
log ""

log "[4/5] POST /api/auth/login"
login_payload="{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}"
request_json "POST" "/api/auth/login" "$login_payload"
assert_status "200" "$RESPONSE_STATUS" "Login endpoint authenticates user"
assert_contains "$RESPONSE_BODY" '"token":"' "Login response includes token"
log ""

log "[5/5] POST /api/auth/login with wrong password"
wrong_login_payload="{\"email\":\"$TEST_EMAIL\",\"password\":\"wrong-password\"}"
request_json "POST" "/api/auth/login" "$wrong_login_payload"
assert_status "401" "$RESPONSE_STATUS" "Invalid login credentials are rejected"
assert_contains "$RESPONSE_BODY" '"error":"Invalid credentials"' "Invalid login returns expected error"
log ""

if [[ "$FAILED" -eq 0 ]]; then
  log "All endpoint checks passed."
  exit 0
fi

log "One or more endpoint checks failed."
exit 1
