#!/bin/bash
# Copyright © 2026 Mochisoft OÜ
# SPDX-License-Identifier: AGPL-3.0-only
# This file is part of Mochi, licensed under the GNU AGPL v3 with the
# Mochi Application Interface Exception - see license.txt and license-exception.md.

# Forum read access-control test (privacy gate + moderation-status gate).
#
# Two regressions:
#  1. Private forums: the public HTTP read actions :forum/-/posts (action_view)
#     and :forum/-/:post (action_post_view) must gate on view access when the
#     forum is private, so an anonymous or non-member caller cannot read a
#     private forum's approved posts/comments from the owner's node. Public
#     forums must stay fully readable (including anonymously).
#  2. Moderation status: action_post_view must not serve a removed post to a
#     non-moderator. An anonymous caller on a public forum runs as the ambient
#     owner and loads the post from the owner's full DB, so without a status gate
#     it could read a removed post by id.
# Self-seeding and single-instance; leaves no test data.

set +e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS="$SCRIPT_DIR/../../../claude/scripts"
BASE="http://localhost:8081"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
PASS=0; FAIL=0
pass() { echo -e "${GREEN}✓ PASS${NC}: $1"; PASS=$((PASS+1)); }
fail() { echo -e "${RED}✗ FAIL${NC}: $1 (expected HTTP $2, got $3)"; FAIL=$((FAIL+1)); }

# App-scoped JWT for a role's session (non-public POST actions need it; reads
# accept it too). Falls back cleanly if the session/token cannot be minted.
app_token() {
    local role="$1"
    local session
    session=$("$SCRIPTS/get-token.sh" "$role" 1 2>/dev/null)
    [ -z "$session" ] && return 1
    curl -s -b "session=$session" -X POST "$BASE/_/token" \
        -H "Content-Type: application/json" -d '{"app":"forums"}' \
        | python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))" 2>/dev/null
}

# HTTP status for a GET, optionally with a bearer token ($2 empty = anonymous).
get_code() {
    local url="$1" tok="$2"
    if [ -n "$tok" ]; then
        curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $tok" "$url"
    else
        curl -s -o /dev/null -w "%{http_code}" "$url"
    fi
}

check() { # label url token expected
    local label="$1" url="$2" tok="$3" expected="$4"
    local code; code=$(get_code "$url" "$tok")
    if [ "$code" = "$expected" ]; then pass "$label"; else fail "$label" "$expected" "$code"; fi
}

OWNER=$(app_token admin)
NONMEMBER=$(app_token user)
if [ -z "$OWNER" ]; then
    echo "error: could not mint an owner app token (is instance 1 running?)" >&2
    exit 2
fi

echo "========================================"
echo "Forums private-read access-control tests"
echo "========================================"

# --- Seed a private forum with a post, and a public forum with a post ---
PRIV=$(curl -s -X POST "$BASE/forums/-/create" -H "Authorization: Bearer $OWNER" \
    -F "name=PrivReadTest" -F "privacy=private" \
    | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
PRIV_POST=$(curl -s -X POST "$BASE/forums/-/post/create" -H "Authorization: Bearer $OWNER" \
    -F "forum=$PRIV" -F "title=Secret" -F "body=secret body" \
    | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
PUB=$(curl -s -X POST "$BASE/forums/-/create" -H "Authorization: Bearer $OWNER" \
    -F "name=PubReadTest" -F "privacy=public" \
    | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
PUB_POST=$(curl -s -X POST "$BASE/forums/-/post/create" -H "Authorization: Bearer $OWNER" \
    -F "forum=$PUB" -F "title=Open" -F "body=open body" \
    | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)

if [ -z "$PRIV" ] || [ -z "$PRIV_POST" ] || [ -z "$PUB" ] || [ -z "$PUB_POST" ]; then
    echo "error: failed to seed forums/posts" >&2
    [ -n "$PRIV" ] && curl -s -o /dev/null -X POST -H "Authorization: Bearer $OWNER" "$BASE/forums/$PRIV/-/delete"
    [ -n "$PUB" ] && curl -s -o /dev/null -X POST -H "Authorization: Bearer $OWNER" "$BASE/forums/$PUB/-/delete"
    exit 2
fi

echo -e "\n${YELLOW}Private forum: posts list (:forum/-/posts)${NC}"
check "owner reads private posts"          "$BASE/forums/$PRIV/-/posts" "$OWNER"     200
check "non-member blocked from private"    "$BASE/forums/$PRIV/-/posts" "$NONMEMBER" 403
check "anonymous blocked from private"     "$BASE/forums/$PRIV/-/posts" ""           403

echo -e "\n${YELLOW}Private forum: thread view (:forum/-/:post)${NC}"
check "owner reads private thread"         "$BASE/forums/$PRIV/-/$PRIV_POST" "$OWNER"     200
check "non-member blocked from thread"     "$BASE/forums/$PRIV/-/$PRIV_POST" "$NONMEMBER" 403
check "anonymous blocked from thread"      "$BASE/forums/$PRIV/-/$PRIV_POST" ""           403

echo -e "\n${YELLOW}Public forum control (must stay readable)${NC}"
check "anonymous reads public posts"       "$BASE/forums/$PUB/-/posts" ""      200
check "anonymous reads public thread"      "$BASE/forums/$PUB/-/$PUB_POST" ""  200

# --- Removed post on a public forum: hidden from non-moderators ---
REMOVED_POST=$(curl -s -X POST "$BASE/forums/-/post/create" -H "Authorization: Bearer $OWNER" \
    -F "forum=$PUB" -F "title=Removed" -F "body=removed body" \
    | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
curl -s -o /dev/null -X POST -H "Authorization: Bearer $OWNER" \
    "$BASE/forums/$PUB/-/$REMOVED_POST/remove" -F "forum=$PUB" -F "post=$REMOVED_POST"

echo -e "\n${YELLOW}Removed post on a public forum (non-moderators must not see it)${NC}"
# The owner is a moderator and still sees it. The non-member's request falls
# through to the P2P post/view handler (403); the anonymous caller is stopped by
# action_post_view's local status gate (404). Both mean "not disclosed".
check "owner (moderator) sees removed"     "$BASE/forums/$PUB/-/$REMOVED_POST" "$OWNER"     200
check "non-member cannot see removed"      "$BASE/forums/$PUB/-/$REMOVED_POST" "$NONMEMBER" 403
check "anonymous cannot see removed"       "$BASE/forums/$PUB/-/$REMOVED_POST" ""           404

# --- Clean up seeded data ---
curl -s -o /dev/null -X POST -H "Authorization: Bearer $OWNER" "$BASE/forums/$PRIV/-/delete"
curl -s -o /dev/null -X POST -H "Authorization: Bearer $OWNER" "$BASE/forums/$PUB/-/delete"

echo ""
echo "========================================"
echo -e "Passed: ${GREEN}$PASS${NC}   Failed: ${RED}$FAIL${NC}"
echo "========================================"
[ "$FAIL" -gt 0 ] && exit 1
exit 0
