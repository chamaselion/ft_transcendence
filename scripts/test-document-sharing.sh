#!/usr/bin/env bash
# End-to-end smoke test for document sharing and per-document permissions,
# through nginx.
#
# Requires:
#   - the stack running (make up)
#   - EMAIL_TRANSPORT=console in .env, so the login response carries the
#     one-time code as `debugCode` and the 2FA flow can be scripted
#   - an account that already has the admin role (only for the admin-reach
#     check). Defaults to the ADMIN_EMAIL account from .env; override with
#     ADMIN_EMAIL=... ADMIN_PASS=... if yours differs.
#
# All other users and documents are created fresh on every run, so it can be
# run repeatedly. It only deletes what it created itself.
#
# Not covered here: the live WebSocket behaviour (viewer cannot push updates,
# revoked user is evicted from the room). See scripts/test-websocket.sh.
set -uo pipefail

BASE="${BASE:-https://localhost:8443}"
ADMIN_EMAIL="${ADMIN_EMAIL:-test@gmail.com}"
ADMIN_PASS="${ADMIN_PASS:-password123}"
STAMP="$(date +%s)"

PASS=0
FAIL=0

# The body of the most recent status() call. Written to a file rather than a
# variable because status() runs inside $( ), so a plain assignment would be
# lost with the subshell.
LAST_BODY_FILE="$(mktemp)"

# --- helpers ----------------------------------------------------------------

# check <description> <expected> <actual>
# On failure it also prints what the server actually answered, which is the
# difference between "something returns 400" and knowing which check fired.
check() {
  if [ "$2" = "$3" ]; then
    printf '  \033[32mPASS\033[0m  %-58s %s\n' "$1" "$3"
    PASS=$((PASS + 1))
  else
    printf '  \033[31mFAIL\033[0m  %-58s expected %s, got %s\n' "$1" "$2" "$3"
    if [ -s "$LAST_BODY_FILE" ]; then
      printf '        server: %s\n' "$(head -c 300 "$LAST_BODY_FILE")"
    fi
    FAIL=$((FAIL + 1))
  fi
}

# json_field <json> <key>   -> first string value for that key
json_field() {
  echo "$1" | grep -o "\"$2\":\"[^\"]*\"" | head -1 | cut -d'"' -f4 || true
}

# status <cookie-jar|-> <method> <path> [body]  -> HTTP status code only
status() {
  local jar="$1" method="$2" path="$3" body="${4:-}"
  local args=(-sk -o "$LAST_BODY_FILE" -w '%{http_code}' -X "$method" "$BASE$path")
  [ "$jar" != "-" ] && args+=(-b "$jar")
  [ -n "$body" ] && args+=(-H 'Content-Type: application/json' -d "$body")
  curl "${args[@]}"
}

# body <cookie-jar|-> <method> <path> [body]  -> response body
body() {
  local jar="$1" method="$2" path="$3" payload="${4:-}"
  local args=(-sk -X "$method" "$BASE$path")
  [ "$jar" != "-" ] && args+=(-b "$jar")
  [ -n "$payload" ] && args+=(-H 'Content-Type: application/json' -d "$payload")
  curl "${args[@]}"
}

# login <email> <password> <cookie-jar>  -> 0 on success
login() {
  local email="$1" pass="$2" jar="$3"
  local resp cid code
  resp="$(curl -sk -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$pass\"}")"
  cid="$(json_field "$resp" challengeId)"
  code="$(json_field "$resp" debugCode)"
  if [ -z "$code" ]; then
    echo "!! No debugCode for $email. Is EMAIL_TRANSPORT=console set in .env?"
    echo "   Response: $resp"
    return 1
  fi
  curl -sk -c "$jar" -o /dev/null -X POST "$BASE/api/auth/login/confirm" \
    -H 'Content-Type: application/json' \
    -d "{\"challengeId\":\"$cid\",\"email\":\"$email\",\"code\":\"$code\"}"
}

# register <login> <email> <password>
register() {
  curl -sk -o /dev/null -X POST "$BASE/api/auth/register" -H 'Content-Type: application/json' \
    -d "{\"login\":\"$1\",\"email\":\"$2\",\"password\":\"$3\"}"
}

# share_json <email> <permission>   -> a JSON body, built without backslashes
#
# Do NOT inline a body as "{\"email\":\"$VAR\"}" inside a $( ) that is itself
# inside double quotes: bash 3.2 - still the default /bin/bash on macOS -
# mis-parses the escaped quotes there and produces malformed JSON. The request
# then dies in express.json() with a 400 before it ever reaches a route, which
# looks exactly like a failing permission check. printf with %s avoids the
# escaping entirely and behaves the same on every shell.
share_json() { printf '{"email":"%s","permission":"%s"}' "$1" "$2"; }

# contains <haystack> <needle>  -> yes|no
contains() {
  case "$1" in
    *"$2"*) echo yes ;;
    *)      echo no ;;
  esac
}

ADMIN_JAR="$(mktemp)"; A_JAR="$(mktemp)"; B_JAR="$(mktemp)"; C_JAR="$(mktemp)"
cleanup() { rm -f "$ADMIN_JAR" "$A_JAR" "$B_JAR" "$C_JAR" "$LAST_BODY_FILE"; }
trap cleanup EXIT

# --- setup ------------------------------------------------------------------

echo "== Base URL: $BASE"
echo

echo "Setup: create owner (A), recipient (B) and outsider (C)"
A_EMAIL="share_a_${STAMP}@example.com"; A_LOGIN="share_a_${STAMP}"
B_EMAIL="share_b_${STAMP}@example.com"; B_LOGIN="share_b_${STAMP}"
C_EMAIL="share_c_${STAMP}@example.com"; C_LOGIN="share_c_${STAMP}"
register "$A_LOGIN" "$A_EMAIL" password123
register "$B_LOGIN" "$B_EMAIL" password123
register "$C_LOGIN" "$C_EMAIL" password123
login "$A_EMAIL" password123 "$A_JAR" || exit 1
login "$B_EMAIL" password123 "$B_JAR" || exit 1
login "$C_EMAIL" password123 "$C_JAR" || exit 1
B_ID="$(json_field "$(body "$B_JAR" GET /api/auth/me)" id)"

echo "Setup: log in as admin (for the admin-reach check)"
if login "$ADMIN_EMAIL" "$ADMIN_PASS" "$ADMIN_JAR"; then
  ADMIN_ROLE="$(json_field "$(body "$ADMIN_JAR" GET /api/auth/me)" role)"
  [ "$ADMIN_ROLE" = "admin" ] || echo "   (warning: $ADMIN_EMAIL is '$ADMIN_ROLE', admin checks will be skipped)"
else
  ADMIN_ROLE="none"
fi

echo "Setup: ids in use"
echo "   A: $A_EMAIL"
echo "   B: $B_EMAIL  (id: ${B_ID:-<EMPTY!>})"
echo "   C: $C_EMAIL"

# Bodies are built once, up front, for the reason given at share_json().
B_VIEWER="$(share_json "$B_EMAIL" viewer)"
B_EDITOR="$(share_json "$B_EMAIL" editor)"
B_BAD_PERM="$(share_json "$B_EMAIL" admin)"
A_SELF="$(share_json "$A_EMAIL" viewer)"
C_VIEWER="$(share_json "$C_EMAIL" viewer)"
UNKNOWN_VIEWER="$(share_json "nobody_${STAMP}@example.com" viewer)"

echo "Setup: A creates a document"
DOC="$(body "$A_JAR" POST /api/documents '{"title":"Shared doc","content":"hello"}')"
DOC_ID="$(json_field "$DOC" id)"
check "owner sees permission 'owner'"       owner "$(json_field "$DOC" permission)"
[ -n "$DOC_ID" ] || { echo "!! Could not create a document: $DOC"; exit 1; }
echo

# --- 1) no access without a share -------------------------------------------

echo "1) Without a share, B cannot reach the document"
check "B GET -> 404"                        404 "$(status "$B_JAR" GET "/api/documents/$DOC_ID")"
check "B PATCH -> 404"                      404 "$(status "$B_JAR" PATCH "/api/documents/$DOC_ID" '{"content":"nope"}')"
check "B DELETE -> 404"                     404 "$(status "$B_JAR" DELETE "/api/documents/$DOC_ID")"
check "B cannot list the shares -> 404"     404 "$(status "$B_JAR" GET "/api/documents/$DOC_ID/shares")"
check "B cannot re-share -> 404"            404 "$(status "$B_JAR" POST "/api/documents/$DOC_ID/shares" "$C_VIEWER")"
echo

# --- 2) creating a share ----------------------------------------------------

echo "2) A shares the document"
check "unknown email -> 404"                404 "$(status "$A_JAR" POST "/api/documents/$DOC_ID/shares" "$UNKNOWN_VIEWER")"
check "invalid permission -> 400"           400 "$(status "$A_JAR" POST "/api/documents/$DOC_ID/shares" "$B_BAD_PERM")"
check "malformed email -> 400"              400 "$(status "$A_JAR" POST "/api/documents/$DOC_ID/shares" '{"email":"not-an-email","permission":"viewer"}')"
check "sharing with yourself -> 400"        400 "$(status "$A_JAR" POST "/api/documents/$DOC_ID/shares" "$A_SELF")"
check "share with B as viewer -> 201"       201 "$(status "$A_JAR" POST "/api/documents/$DOC_ID/shares" "$B_VIEWER")"
SHARES="$(body "$A_JAR" GET "/api/documents/$DOC_ID/shares")"
check "share listing contains B"            yes "$(contains "$SHARES" "$B_EMAIL")"
echo

# --- 3) viewer ---------------------------------------------------------------

echo "3) B as viewer"
B_DOC="$(body "$B_JAR" GET "/api/documents/$DOC_ID")"
check "B GET -> 200"                        200 "$(status "$B_JAR" GET "/api/documents/$DOC_ID")"
check "B sees permission 'viewer'"          viewer "$(json_field "$B_DOC" permission)"
check "B PATCH -> 404"                      404 "$(status "$B_JAR" PATCH "/api/documents/$DOC_ID" '{"content":"nope"}')"
check "document appears in B's list"        yes "$(contains "$(body "$B_JAR" GET /api/documents)" "$DOC_ID")"
check "C still cannot see it"               no  "$(contains "$(body "$C_JAR" GET /api/documents)" "$DOC_ID")"
check "non-admin response hides ownerId"    no  "$(contains "$B_DOC" '"ownerId"')"
# A recipient has to be able to see who shared the document with them, and the
# login rather than the raw id: GET /api/users is admin-only, so a regular user
# cannot resolve an owner id into a name themselves.
#
# Match on '"owner":{' and not on '"owner"': every response also carries a
# `permission` field, whose value is the string "owner" on your own documents -
# a bare '"owner"' needle matches that and reports the block as present on
# exactly the documents that must not have it.
check "shared document names its owner"     yes "$(contains "$B_DOC" '"owner":{')"
check "and names A by login"                "$A_LOGIN" "$(json_field "$B_DOC" login)"
check "B's listing carries it too"          yes "$(contains "$(body "$B_JAR" GET /api/documents)" '"owner":{')"
# On your own document the owner is you, so the field would say nothing.
check "A's own document omits owner"        no  "$(contains "$(body "$A_JAR" GET "/api/documents/$DOC_ID")" '"owner":{')"
echo

# --- 4) upgrade to editor ----------------------------------------------------

echo "4) A upgrades B to editor"
check "re-sharing upgrades, no duplicate -> 200" 200 "$(status "$A_JAR" POST "/api/documents/$DOC_ID/shares" "$B_EDITOR")"
check "B PATCH -> 200"                      200 "$(status "$B_JAR" PATCH "/api/documents/$DOC_ID" '{"content":"edited by B"}')"
check "edit is visible to A"                yes "$(contains "$(body "$A_JAR" GET "/api/documents/$DOC_ID")" "edited by B")"
check "editor still cannot delete -> 404"   404 "$(status "$B_JAR" DELETE "/api/documents/$DOC_ID")"
check "editor still cannot re-share -> 404" 404 "$(status "$B_JAR" POST "/api/documents/$DOC_ID/shares" "$C_VIEWER")"
echo

# --- 5) admin reach ----------------------------------------------------------

if [ "$ADMIN_ROLE" = "admin" ]; then
  echo "5) An admin reaches the document without a share"
  ADMIN_DOC="$(body "$ADMIN_JAR" GET "/api/documents/$DOC_ID")"
  check "admin GET -> 200"                  200 "$(status "$ADMIN_JAR" GET "/api/documents/$DOC_ID")"
  check "admin resolves to 'owner'"         owner "$(json_field "$ADMIN_DOC" permission)"
  check "admin response carries ownerId"    yes "$(contains "$ADMIN_DOC" '"ownerId"')"
else
  echo "5) Admin checks skipped (no admin account available)"
fi
echo

# --- 6) downgrade and revocation --------------------------------------------

echo "6) A downgrades, then revokes"
check "downgrade to viewer -> 200"          200 "$(status "$A_JAR" PATCH "/api/documents/$DOC_ID/shares/$B_ID" '{"permission":"viewer"}')"
check "B PATCH -> 404 again"                404 "$(status "$B_JAR" PATCH "/api/documents/$DOC_ID" '{"content":"nope"}')"
check "revoke -> 204"                       204 "$(status "$A_JAR" DELETE "/api/documents/$DOC_ID/shares/$B_ID")"
check "B GET -> 404"                        404 "$(status "$B_JAR" GET "/api/documents/$DOC_ID")"
check "document gone from B's list"         no  "$(contains "$(body "$B_JAR" GET /api/documents)" "$DOC_ID")"
check "revoking twice -> 404"               404 "$(status "$A_JAR" DELETE "/api/documents/$DOC_ID/shares/$B_ID")"
check "patching a gone share -> 404"        404 "$(status "$A_JAR" PATCH "/api/documents/$DOC_ID/shares/$B_ID" '{"permission":"editor"}')"
echo

# --- 7) input validation -----------------------------------------------------

echo "7) Input validation"
check "malformed document id -> 400"        400 "$(status "$A_JAR" GET "/api/documents/not-a-uuid/shares")"
check "malformed user id -> 400"            400 "$(status "$A_JAR" DELETE "/api/documents/$DOC_ID/shares/not-a-uuid")"
check "no cookie -> 401"                    401 "$(status - GET "/api/documents/$DOC_ID/shares")"
check "empty share body -> 400"             400 "$(status "$A_JAR" POST "/api/documents/$DOC_ID/shares" '{}')"
echo

# --- 8) cascade --------------------------------------------------------------

echo "8) Deleting the document takes its shares with it"
check "re-share with B -> 201"              201 "$(status "$A_JAR" POST "/api/documents/$DOC_ID/shares" "$B_EDITOR")"
check "owner DELETE -> 204"                 204 "$(status "$A_JAR" DELETE "/api/documents/$DOC_ID")"
check "B GET after delete -> 404"           404 "$(status "$B_JAR" GET "/api/documents/$DOC_ID")"
echo "  Note: verify the share rows are gone too:"
echo "    docker compose exec db psql -U \$POSTGRES_USER -d \$POSTGRES_DB \\"
echo "      -c \"select count(*) from document_shares where document_id='$DOC_ID';\""
echo

# --- 9) rate limit (opt-in) --------------------------------------------------

if [ "${RATE_LIMIT_TEST:-0}" = "1" ]; then
  echo "9) Share rate limit (60/min) - blocks user A for a minute afterwards"
  NEW_DOC_ID="$(json_field "$(body "$A_JAR" POST /api/documents '{"title":"rl","content":"x"}')" id)"
  LAST=200
  for _ in $(seq 1 65); do LAST="$(status "$A_JAR" GET "/api/documents/$NEW_DOC_ID/shares")"; done
  check "429 after 65 requests"             429 "$LAST"
  echo
else
  echo "9) Rate limit test skipped (set RATE_LIMIT_TEST=1 to enable)"
  echo
fi

# --- summary ----------------------------------------------------------------

echo "================================"
echo "  PASS: $PASS    FAIL: $FAIL"
echo "================================"
[ "$FAIL" -eq 0 ] || exit 1
