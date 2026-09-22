#!/usr/bin/env bash
# Smoke test for the search, filter, sort and paging parameters on the
# admin-only users API, through nginx.
#
# Requires:
#   - the stack running (make up)
#   - EMAIL_TRANSPORT=console in .env, so the login response carries the
#     one-time code as `debugCode` and the 2FA flow can be scripted
#   - an account with the admin role. Defaults to ADMIN_EMAIL from .env;
#     override with ADMIN_EMAIL=... ADMIN_PASS=... if yours differs.
#
# Creates three throwaway accounts per run and deletes them again at the end,
# so it can be run repeatedly.
#
# The documents side of the same feature lives in test-document-sharing.sh
# (step 9); this file covers what only exists here: the role filter and the
# 403 for non-admins.
set -uo pipefail

BASE="${BASE:-https://localhost:8443}"
ADMIN_EMAIL="${ADMIN_EMAIL:-test@gmail.com}"
ADMIN_PASS="${ADMIN_PASS:-password123}"
STAMP="$(date +%s)"
TAG="usrsrch${STAMP}"

PASS=0
FAIL=0
LAST_BODY_FILE="$(mktemp)"

check() {
  if [ "$2" = "$3" ]; then
    printf '  \033[32mPASS\033[0m  %-52s %s\n' "$1" "$3"
    PASS=$((PASS + 1))
  else
    printf '  \033[31mFAIL\033[0m  %-52s expected %s, got %s\n' "$1" "$2" "$3"
    if [ -s "$LAST_BODY_FILE" ]; then
      printf '        server: %s\n' "$(head -c 300 "$LAST_BODY_FILE")"
    fi
    FAIL=$((FAIL + 1))
  fi
}

json_field()  { echo "$1" | grep -o "\"$2\":\"[^\"]*\"" | head -1 | cut -d'"' -f4 || true; }
json_number() { echo "$1" | grep -o "\"$2\":[0-9]*" | head -1 | cut -d: -f2; }
count_matches() { echo "$1" | grep -o "$2" | wc -l | tr -d ' '; }

status() {
  local jar="$1" method="$2" path="$3" payload="${4:-}"
  local args=(-sk -o "$LAST_BODY_FILE" -w '%{http_code}' -X "$method" "$BASE$path")
  [ "$jar" != "-" ] && args+=(-b "$jar")
  [ -n "$payload" ] && args+=(-H 'Content-Type: application/json' -d "$payload")
  curl "${args[@]}"
}

body() {
  local jar="$1" method="$2" path="$3" payload="${4:-}"
  local args=(-sk -X "$method" "$BASE$path")
  [ "$jar" != "-" ] && args+=(-b "$jar")
  [ -n "$payload" ] && args+=(-H 'Content-Type: application/json' -d "$payload")
  curl "${args[@]}"
}

login() {
  local email="$1" pass="$2" jar="$3" resp cid code
  resp="$(curl -sk -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
    -d "$(printf '{"email":"%s","password":"%s"}' "$email" "$pass")")"
  cid="$(json_field "$resp" challengeId)"
  code="$(json_field "$resp" debugCode)"
  if [ -z "$code" ]; then
    echo "!! No debugCode for $email. Is EMAIL_TRANSPORT=console set in .env?"
    return 1
  fi
  curl -sk -c "$jar" -o /dev/null -X POST "$BASE/api/auth/login/confirm" \
    -H 'Content-Type: application/json' \
    -d "$(printf '{"challengeId":"%s","email":"%s","code":"%s"}' "$cid" "$email" "$code")"
}

register() {
  curl -sk -o /dev/null -X POST "$BASE/api/auth/register" -H 'Content-Type: application/json' \
    -d "$(printf '{"login":"%s","email":"%s","password":"%s"}' "$1" "$2" "$3")"
}

ADMIN_JAR="$(mktemp)"; USER_JAR="$(mktemp)"
cleanup() { rm -f "$ADMIN_JAR" "$USER_JAR" "$LAST_BODY_FILE"; }
trap cleanup EXIT

echo "== Base URL: $BASE"
echo

echo "Setup: three throwaway accounts and an admin session"
for name in alpha beta gamma; do
  register "${TAG}_${name}" "${TAG}_${name}@example.com" password123
done
login "$ADMIN_EMAIL" "$ADMIN_PASS" "$ADMIN_JAR" || exit 1
login "${TAG}_alpha@example.com" password123 "$USER_JAR" || exit 1

ADMIN_ROLE="$(json_field "$(body "$ADMIN_JAR" GET /api/auth/me)" role)"
if [ "$ADMIN_ROLE" != "admin" ]; then
  echo "!! $ADMIN_EMAIL is not an admin account - set ADMIN_EMAIL / ADMIN_PASS."
  exit 1
fi
echo

echo "1) The endpoint stays admin-only"
check "a regular user gets 403"             403 "$(status "$USER_JAR" GET /api/users)"
check "no cookie -> 401"                    401 "$(status - GET /api/users)"
echo

echo "2) Search"
FOUND="$(body "$ADMIN_JAR" GET "/api/users?q=$TAG")"
check "q finds the three new accounts"      3 "$(json_number "$FOUND" total)"
check "and all three are returned"          3 "$(count_matches "$FOUND" '"role":')"
check "q matches the email as well"         1 "$(json_number "$(body "$ADMIN_JAR" GET "/api/users?q=${TAG}_beta@example.com")" total)"
check "a term nobody matches -> 0"          0 "$(json_number "$(body "$ADMIN_JAR" GET "/api/users?q=${TAG}_nobody")" total)"
echo

echo "3) Paging"
PAGE1="$(body "$ADMIN_JAR" GET "/api/users?q=$TAG&limit=2")"
check "limit=2 returns two rows"            2 "$(count_matches "$PAGE1" '"role":')"
check "but total still says three"          3 "$(json_number "$PAGE1" total)"
check "offset=2 returns the remaining one"  1 "$(count_matches "$(body "$ADMIN_JAR" GET "/api/users?q=$TAG&limit=2&offset=2")" '"role":')"
check "paging past the end is empty, not an error" 0 "$(count_matches "$(body "$ADMIN_JAR" GET "/api/users?q=$TAG&offset=99")" '"role":')"
echo

echo "4) Sorting"
check "sort=login,asc starts at _alpha"     "${TAG}_alpha" "$(json_field "$(body "$ADMIN_JAR" GET "/api/users?q=$TAG&sort=login&order=asc")" login)"
check "sort=login,desc starts at _gamma"    "${TAG}_gamma" "$(json_field "$(body "$ADMIN_JAR" GET "/api/users?q=$TAG&sort=login&order=desc")" login)"
echo

echo "5) Filtering by role"
ALPHA_ID="$(json_field "$(body "$ADMIN_JAR" GET "/api/users?q=${TAG}_alpha")" id)"
check "all three start out as 'user'"       3 "$(json_number "$(body "$ADMIN_JAR" GET "/api/users?q=$TAG&role=user")" total)"
check "none of them is an admin yet"        0 "$(json_number "$(body "$ADMIN_JAR" GET "/api/users?q=$TAG&role=admin")" total)"
check "promote alpha -> 200"                200 "$(status "$ADMIN_JAR" PATCH "/api/users/$ALPHA_ID" '{"role":"admin"}')"
check "role=admin now finds exactly alpha"  1 "$(json_number "$(body "$ADMIN_JAR" GET "/api/users?q=$TAG&role=admin")" total)"
check "role=user finds the other two"       2 "$(json_number "$(body "$ADMIN_JAR" GET "/api/users?q=$TAG&role=user")" total)"
check "demote alpha again -> 200"           200 "$(status "$ADMIN_JAR" PATCH "/api/users/$ALPHA_ID" '{"role":"user"}')"
echo

echo "6) Invalid input is rejected, not ignored"
check "unknown sort -> 400"                 400 "$(status "$ADMIN_JAR" GET "/api/users?sort=bogus")"
check "sort injection attempt -> 400"       400 "$(status "$ADMIN_JAR" GET "/api/users?sort=login;DROP%20TABLE%20users")"
check "unknown order -> 400"                400 "$(status "$ADMIN_JAR" GET "/api/users?order=sideways")"
check "unknown role -> 400"                 400 "$(status "$ADMIN_JAR" GET "/api/users?role=superuser")"
check "limit=0 -> 400"                      400 "$(status "$ADMIN_JAR" GET "/api/users?limit=0")"
check "limit=101 -> 400"                    400 "$(status "$ADMIN_JAR" GET "/api/users?limit=101")"
check "limit=12abc -> 400"                  400 "$(status "$ADMIN_JAR" GET "/api/users?limit=12abc")"
check "negative offset -> 400"              400 "$(status "$ADMIN_JAR" GET "/api/users?offset=-1")"
echo

echo "Cleanup: removing the three throwaway accounts"
for name in alpha beta gamma; do
  ID="$(json_field "$(body "$ADMIN_JAR" GET "/api/users?q=${TAG}_${name}")" id)"
  [ -n "$ID" ] && status "$ADMIN_JAR" DELETE "/api/users/$ID" > /dev/null
done
echo

echo "================================"
echo "  PASS: $PASS    FAIL: $FAIL"
echo "================================"
[ "$FAIL" -eq 0 ] || exit 1
