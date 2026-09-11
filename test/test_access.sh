#!/bin/bash
# Copyright © 2026 Mochisoft OÜ
# SPDX-License-Identifier: AGPL-3.0-only
# This file is part of Mochi, licensed under the GNU AGPL v3 with the
# Mochi Application Interface Exception - see license.txt and license-exception.md.

# Forums Access Control Test Script
# Tests access levels for subscribers and verifies permissions are correct.
# Self-seeding: instance 1's admin owns a new forum and post, instance 2's
# admin subscribes and is the target of every access change, and the forum
# is deleted at the end.

# Don't exit on error - we want to run all tests
set +e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CURL="$SCRIPT_DIR/../../../claude/scripts/curl.sh"

FORUM_ID=$($CURL -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d '{"name":"Access Test Forum","access":"post"}' "/forums/-/create" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
POST_ID=$($CURL -i 1 -a admin -X POST -F "forum=$FORUM_ID" -F "title=Access Test Post" \
    -F "body=Access test post" "/forums/-/post/create" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
SUBSCRIBER_SESSION=$("$SCRIPT_DIR/../../../claude/scripts/get-token.sh" admin 2 2>/dev/null)
SUBSCRIBER_ID=$(curl -s -b "session=$SUBSCRIBER_SESSION" "http://localhost:8082/_/identity" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['identity']['id'])" 2>/dev/null)

if [ -z "$FORUM_ID" ] || [ -z "$POST_ID" ] || [ -z "$SUBSCRIBER_ID" ]; then
    echo "error: could not seed the forum, post or subscriber (are both instances running?)" >&2
    [ -n "$FORUM_ID" ] && $CURL -i 1 -a admin -X POST "/forums/$FORUM_ID/-/delete" > /dev/null 2>&1
    exit 2
fi

$CURL -i 2 -a admin -X POST "/forums/$FORUM_ID/-/subscribe" > /dev/null 2>&1
sleep 2  # Allow time for P2P sync

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

TESTS_PASSED=0
TESTS_FAILED=0

pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((TESTS_PASSED++))
}

fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    echo "  Expected: $2"
    echo "  Got: $3"
    ((TESTS_FAILED++))
}

# Helper to set the subscriber's access level on instance 1
set_access() {
    local level=$1
    echo -e "\n${YELLOW}Setting access level to: $level${NC}"
    $CURL -i 1 -a admin -X POST "/forums/$FORUM_ID/-/access/set" \
        -d "target=$SUBSCRIBER_ID&level=$level" > /dev/null 2>&1
    sleep 0.5  # Allow time for P2P sync
}

# Helper to extract JSON field (normalizes Python True/False to lowercase)
json_field() {
    local result
    result=$(echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin); v=d$2; print(str(v).lower() if isinstance(v, bool) else v)" 2>/dev/null) || result="ERROR"
    echo "$result"
}

# Test forum view as subscriber (instance 2)
test_forum_view() {
    local expected_can_post=$1
    local level_name=$2

    echo "Testing forum view with '$level_name' access..."

    local response
    response=$($CURL -i 2 -a admin -X GET "/forums/$FORUM_ID/-/posts" 2>/dev/null)

    # Check forum is returned
    local forum_id
    forum_id=$(json_field "$response" "['data']['forum']['id']")
    if [ "$forum_id" = "$FORUM_ID" ]; then
        pass "Forum view returns forum data ($level_name)"
    else
        fail "Forum view returns forum data ($level_name)" "$FORUM_ID" "$forum_id"
    fi

    # Check posts are returned
    local posts_count
    posts_count=$(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d['data']['posts']))" 2>/dev/null || echo "0")
    if [ "$posts_count" -gt 0 ]; then
        pass "Forum view returns posts ($level_name) - got $posts_count posts"
    else
        fail "Forum view returns posts ($level_name)" ">0 posts" "$posts_count posts"
    fi

    # Check can_post flag
    local can_post
    can_post=$(json_field "$response" "['data']['forum']['can_post']")
    if [ "$can_post" = "$expected_can_post" ]; then
        pass "Forum can_post is $expected_can_post ($level_name)"
    else
        fail "Forum can_post ($level_name)" "$expected_can_post" "$can_post"
    fi
}

# Test post view as subscriber (instance 2)
test_post_view() {
    local expected_can_vote=$1
    local expected_can_comment=$2
    local level_name=$3

    echo "Testing post view with '$level_name' access..."

    local response
    response=$($CURL -i 2 -a admin -X GET "/forums/$FORUM_ID/-/$POST_ID" 2>/dev/null)

    # Check post is returned
    local post_id
    post_id=$(json_field "$response" "['data']['post']['id']")
    if [ "$post_id" = "$POST_ID" ]; then
        pass "Post view returns post data ($level_name)"
    else
        fail "Post view returns post data ($level_name)" "$POST_ID" "$post_id"
    fi

    # Check can_vote flag
    local can_vote
    can_vote=$(json_field "$response" "['data']['can_vote']")
    if [ "$can_vote" = "$expected_can_vote" ]; then
        pass "Post can_vote is $expected_can_vote ($level_name)"
    else
        fail "Post can_vote ($level_name)" "$expected_can_vote" "$can_vote"
    fi

    # Check can_comment flag
    local can_comment
    can_comment=$(json_field "$response" "['data']['can_comment']")
    if [ "$can_comment" = "$expected_can_comment" ]; then
        pass "Post can_comment is $expected_can_comment ($level_name)"
    else
        fail "Post can_comment ($level_name)" "$expected_can_comment" "$can_comment"
    fi
}

# Test owner view (instance 1)
test_owner_view() {
    echo -e "\n${YELLOW}Testing owner access (instance 1)${NC}"

    local response
    response=$($CURL -i 1 -a admin -X GET "/forums/$FORUM_ID/-/posts" 2>/dev/null)

    # Check forum is returned with manage access
    local can_manage
    can_manage=$(json_field "$response" "['data']['forum']['can_manage']")
    if [ "$can_manage" = "true" ]; then
        pass "Owner has can_manage=true"
    else
        fail "Owner has can_manage" "true" "$can_manage"
    fi

    local can_post
    can_post=$(json_field "$response" "['data']['forum']['can_post']")
    if [ "$can_post" = "true" ]; then
        pass "Owner has can_post=true"
    else
        fail "Owner has can_post" "true" "$can_post"
    fi
}

echo "========================================"
echo "Forums Access Control Tests"
echo "========================================"
echo "Forum: $FORUM_ID"
echo "Subscriber: $SUBSCRIBER_ID"
echo "Post: $POST_ID"
echo "========================================"

# Test 1: Owner access
test_owner_view

# Test 2: Subscriber with 'none' access
set_access "none"
echo -e "\n--- Testing 'none' access level ---"
test_forum_view "false" "none"
test_post_view "false" "false" "none"

# Test 3: Subscriber with 'view' access
set_access "view"
echo -e "\n--- Testing 'view' access level ---"
test_forum_view "false" "view"
test_post_view "false" "false" "view"

# Test 4: Subscriber with 'vote' access
set_access "vote"
echo -e "\n--- Testing 'vote' access level ---"
test_forum_view "false" "vote"
test_post_view "true" "false" "vote"

# Test 5: Subscriber with 'comment' access
set_access "comment"
echo -e "\n--- Testing 'comment' access level ---"
test_forum_view "false" "comment"
test_post_view "true" "true" "comment"

# Test 6: Subscriber with 'post' access
set_access "post"
echo -e "\n--- Testing 'post' access level ---"
test_forum_view "true" "post"
test_post_view "true" "true" "post"

$CURL -i 1 -a admin -X POST "/forums/$FORUM_ID/-/delete" > /dev/null 2>&1

# Summary
echo ""
echo "========================================"
echo "Test Summary"
echo "========================================"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo "========================================"

if [ $TESTS_FAILED -gt 0 ]; then
    exit 1
fi
