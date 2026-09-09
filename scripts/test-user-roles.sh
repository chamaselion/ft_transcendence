#!/usr/bin/env bash
# End-to-end smoke test for the roles / permissions module through nginx.
#
# Requires:
#   - the stack running (make up)
#   - EMAIL_TRANSPORT=console in .env, so the login response carries the
#     one-time code as `debugCode` and the 2FA flow can be scripted
#   - an account that already has the admin role. Defaults to the ADMIN_EMAIL
#     account from .env; override with ADMIN_EMAIL=... ADMIN_PASS=... if yours
#     differs. (The bootstrap only promotes on backend startup, so this script
#     cannot create an admin by itself.)
#
# Regular users are created fresh on every run, so it can be run repeatedly.
#
# Heads up - this script has two side effects:
#   - it renames the admin's login to testadmin_<timestamp> (that is the check
#     proving an admin may change their own login but not their own role);
#     email and password are left untouched
#   - it deletes the throwaway user it created (that is the point of step 7)
set -uo pipefail

BASE="${BASE:-https://localhost:8443}"
ADMIN_EMAIL="${ADMIN_EMAIL:-test@gmail.com}"
ADMIN_PASS="${ADMIN_PASS:-password123}"
STAMP="$(date +%s)"

PASS=0
FAIL=0

# --- helpers ----------------------------------------------------------------

# check <description> <expected> <actual>
check() {
  if [ "$2" = "$3" ]; then
    printf '  \033[32mPASS\033[0m  %-58s %s\n' "$1" "$3"
    PASS=$((PASS + 1))
  else
    printf '  \033[31mFAIL\033[0m  %-58s expected %s, got %s\n' "$1" "$2" "$3"
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
  local args=(-sk -o /dev/null -w '%{http_code}' -X "$method" "$BASE$path")
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

ADMIN_JAR="$(mktemp)"; A_JAR="$(mktemp)"; B_JAR="$(mktemp)"
cleanup() { rm -f "$ADMIN_JAR" "$A_JAR" "$B_JAR"; }
trap cleanup EXIT

# --- setup ------------------------------------------------------------------

echo "== Base URL: $BASE"
echo "== Admin:    $ADMIN_EMAIL"
echo

echo "Setup: log in as admin"
login "$ADMIN_EMAIL" "$ADMIN_PASS" "$ADMIN_JAR" || exit 1

ME="$(body "$ADMIN_JAR" GET /api/auth/me)"
ADMIN_ID="$(json_field "$ME" id)"
ADMIN_ROLE="$(json_field "$ME" role)"
if [ "$ADMIN_ROLE" != "admin" ]; then
  echo "!! $ADMIN_EMAIL has role='$ADMIN_ROLE', not 'admin'."
  echo "   Set ADMIN_EMAIL in .env and run 'docker compose restart backend'."
  exit 1
fi

echo "Setup: create two regular users"
A_EMAIL="user_a_${STAMP}@example.com"; A_LOGIN="user_a_${STAMP}"
B_EMAIL="user_b_${STAMP}@example.com"; B_LOGIN="user_b_${STAMP}"
register "$A_LOGIN" "$A_EMAIL" password123
register "$B_LOGIN" "$B_EMAIL" password123
login "$A_EMAIL" password123 "$A_JAR" || exit 1
login "$B_EMAIL" password123 "$B_JAR" || exit 1
A_ID="$(json_field "$(body "$A_JAR" GET /api/auth/me)" id)"
echo

# --- 1) role gating ---------------------------------------------------------

echo "1) Role gating on /api/users"
check "no cookie -> 401"                    401 "$(status - GET /api/users)"
check "regular user -> 403"                 403 "$(status "$A_JAR" GET /api/users)"
check "admin -> 200"                        200 "$(status "$ADMIN_JAR" GET /api/users)"
check "regular user PATCH -> 403"           403 "$(status "$A_JAR" PATCH "/api/users/$A_ID" '{"role":"admin"}')"
check "regular user DELETE -> 403"          403 "$(status "$A_JAR" DELETE "/api/users/$ADMIN_ID")"
echo

# --- 2) role in the profile -------------------------------------------------

echo "2) role exposed by /api/auth/me"
check "admin sees role=admin"               admin "$(json_field "$(body "$ADMIN_JAR" GET /api/auth/me)" role)"
check "user sees role=user"                 user  "$(json_field "$(body "$A_JAR" GET /api/auth/me)" role)"
echo

# --- 3) UUID validation -----------------------------------------------------

echo "3) Malformed ids -> 400 instead of 500"
check "GET /api/users/abc"                  400 "$(status "$ADMIN_JAR" GET /api/users/abc)"
check "PATCH /api/users/abc"                400 "$(status "$ADMIN_JAR" PATCH /api/users/abc '{"role":"user"}')"
check "DELETE /api/users/abc"               400 "$(status "$ADMIN_JAR" DELETE /api/users/abc)"
check "GET /api/documents/abc"              400 "$(status "$A_JAR" GET /api/documents/abc)"
echo

# --- 4) guards against yourself ---------------------------------------------

echo "4) Guards against acting on your own account"
ADMIN_ID_UPPER="$(echo "$ADMIN_ID" | tr '[:lower:]' '[:upper:]')"
check "DELETE own account"                  400 "$(status "$ADMIN_JAR" DELETE "/api/users/$ADMIN_ID")"
check "DELETE own id, UPPERCASED"           400 "$(status "$ADMIN_JAR" DELETE "/api/users/$ADMIN_ID_UPPER")"
check "PATCH own role -> user"              400 "$(status "$ADMIN_JAR" PATCH "/api/users/$ADMIN_ID" '{"role":"user"}')"
check "PATCH own role -> admin"             400 "$(status "$ADMIN_JAR" PATCH "/api/users/$ADMIN_ID" '{"role":"admin"}')"
check "own login is still changeable"       200 "$(status "$ADMIN_JAR" PATCH "/api/users/$ADMIN_ID" "{\"login\":\"testadmin_$STAMP\"}")"
echo

# --- 5) admin view on documents ---------------------------------------------

echo "5) Documents: admin sees everything, users only their own"
DOC="$(body "$A_JAR" POST /api/documents '{"title":"Doc owned by user A","content":"secret"}')"
DOC_ID="$(json_field "$DOC" id)"
check "user A creates a document"           201 "$(status "$A_JAR" POST /api/documents '{"title":"another one","content":"x"}')"

ADMIN_LIST="$(body "$ADMIN_JAR" GET /api/documents)"
case "$ADMIN_LIST" in *"$DOC_ID"*) F=yes ;; *) F=no ;; esac
check "admin list contains foreign doc"     yes "$F"
case "$ADMIN_LIST" in *'"ownerId"'*) F=yes ;; *) F=no ;; esac
check "admin list exposes ownerId"          yes "$F"

B_LIST="$(body "$B_JAR" GET /api/documents)"
case "$B_LIST" in *"$DOC_ID"*) F=yes ;; *) F=no ;; esac
check "user B does NOT see foreign doc"     no "$F"
case "$B_LIST" in *'"ownerId"'*) F=yes ;; *) F=no ;; esac
check "user B gets no ownerId"              no "$F"

check "admin reads foreign doc"             200 "$(status "$ADMIN_JAR" GET "/api/documents/$DOC_ID")"
check "admin edits foreign doc"             200 "$(status "$ADMIN_JAR" PATCH "/api/documents/$DOC_ID" '{"content":"edited by admin"}')"
check "user B reads foreign doc -> 404"     404 "$(status "$B_JAR" GET "/api/documents/$DOC_ID")"
check "user B edits foreign doc -> 404"     404 "$(status "$B_JAR" PATCH "/api/documents/$DOC_ID" '{"content":"hack"}')"
check "user B deletes foreign doc -> 404"   404 "$(status "$B_JAR" DELETE "/api/documents/$DOC_ID")"
check "admin deletes foreign doc -> 204"    204 "$(status "$ADMIN_JAR" DELETE "/api/documents/$DOC_ID")"
echo

# --- 6) role changes performed by an admin ----------------------------------

echo "6) Role changes performed by an admin"
check "promote user A to admin"             200 "$(status "$ADMIN_JAR" PATCH "/api/users/$A_ID" '{"role":"admin"}')"
check "A now sees role=admin"               admin "$(json_field "$(body "$A_JAR" GET /api/auth/me)" role)"
check "A may now use /api/users"            200 "$(status "$A_JAR" GET /api/users)"
check "demote user A back to user"          200 "$(status "$ADMIN_JAR" PATCH "/api/users/$A_ID" '{"role":"user"}')"
check "A is locked out again"               403 "$(status "$A_JAR" GET /api/users)"
check "unknown role -> 400"                 400 "$(status "$ADMIN_JAR" PATCH "/api/users/$A_ID" '{"role":"superadmin"}')"
check "empty body -> 400"                   400 "$(status "$ADMIN_JAR" PATCH "/api/users/$A_ID" '{}')"
check "login already taken -> 409"          409 "$(status "$ADMIN_JAR" PATCH "/api/users/$A_ID" "{\"login\":\"$B_LOGIN\"}")"
echo

# --- 7) deletion performed by an admin --------------------------------------

echo "7) Admin deletes a user"
check "DELETE user A -> 204"                204 "$(status "$ADMIN_JAR" DELETE "/api/users/$A_ID")"
check "GET afterwards -> 404"               404 "$(status "$ADMIN_JAR" GET "/api/users/$A_ID")"
check "A's cookie is dead"                  401 "$(status "$A_JAR" GET /api/auth/me)"
check "deleting again -> 404"               404 "$(status "$ADMIN_JAR" DELETE "/api/users/$A_ID")"
echo "  Note: this script does not verify that the GDPR rows are gone too."
echo "  Check by hand:  docker compose exec db psql -U \$POSTGRES_USER -d \$POSTGRES_DB \\"
echo "                    -c \"select count(*) from gdpr_audit_events where user_id='$A_ID';\""
echo

# --- 8) rate limit (opt-in) -------------------------------------------------

if [ "${RATE_LIMIT_TEST:-0}" = "1" ]; then
  echo "8) Rate limit (60/min) - blocks this admin for a minute afterwards"
  LAST=200
  for _ in $(seq 1 65); do LAST="$(status "$ADMIN_JAR" GET /api/users)"; done
  check "429 after 65 requests"             429 "$LAST"
  echo
else
  echo "8) Rate limit test skipped (set RATE_LIMIT_TEST=1 to enable)"
  echo
fi

# --- summary ----------------------------------------------------------------

echo "================================"
echo "  PASS: $PASS    FAIL: $FAIL"
echo "================================"
[ "$FAIL" -eq 0 ] || exit 1
