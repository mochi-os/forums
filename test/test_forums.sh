#!/bin/bash
# Forums app test suite
# Usage: ./test_forums.sh

set -e

SCRIPT_DIR="$(dirname "$0")"
CURL_HELPER="/home/alistair/mochi/test/claude/curl.sh"

PASSED=0
FAILED=0
FORUM_ENTITY=""
POST_ID=""
COMMENT_ID=""

pass() {
    echo "[PASS] $1"
    ((PASSED++)) || true
}

fail() {
    echo "[FAIL] $1: $2"
    ((FAILED++))
}

# Helper for forum-level routes that need /-/ prefix in entity context
forum_api_curl() {
    local method="$1"
    local path="$2"
    shift 2
    "$CURL_HELPER" -a admin -X "$method" "$@" "$BASE_URL/-$path"
}

echo "=============================================="
echo "Forums Test Suite"
echo "=============================================="

# ============================================================================
# FORUM CREATION TEST
# ============================================================================

echo ""
echo "--- Forum Creation Test ---"

# Test: Create forum
RESULT=$("$CURL_HELPER" -a admin -X POST -H "Content-Type: application/json" -d '{"name":"Test Forum","access":"post"}' "/forums/create")
if echo "$RESULT" | grep -q '"id":"'; then
    FORUM_ENTITY=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
    if [ -n "$FORUM_ENTITY" ]; then
        pass "Create forum (entity: $FORUM_ENTITY)"
        BASE_URL="/forums/$FORUM_ENTITY"
    else
        fail "Create forum" "Could not extract entity ID"
        exit 1
    fi
else
    fail "Create forum" "$RESULT"
    exit 1
fi

echo "Using forum entity: $FORUM_ENTITY"

# ============================================================================
# FORUM INFO TESTS
# ============================================================================

echo ""
echo "--- Forum Info Tests ---"

# Test: Get forum info (posts list)
RESULT=$(forum_api_curl GET "/posts")
if echo "$RESULT" | grep -q '"forum":{'; then
    pass "Get forum info"
else
    fail "Get forum info" "$RESULT"
fi

# Test: Class-level list
RESULT=$("$CURL_HELPER" -a admin -X GET "/forums/list")
if echo "$RESULT" | grep -q '"forums":\['; then
    pass "Get forums list"
else
    fail "Get forums list" "$RESULT"
fi

# ============================================================================
# SUBSCRIPTION TESTS
# ============================================================================

echo ""
echo "--- Subscription Tests ---"

# Test: Subscribe to forum (should already be subscribed as creator)
RESULT=$(forum_api_curl POST "/subscribe")
if echo "$RESULT" | grep -q '"already_subscribed":true\|"ok":true'; then
    pass "Subscribe to forum"
else
    fail "Subscribe to forum" "$RESULT"
fi

# ============================================================================
# POST LIFECYCLE TESTS
# ============================================================================

echo ""
echo "--- Post Lifecycle Tests ---"

# Test: Create post (class-level endpoint with forum param)
RESULT=$("$CURL_HELPER" -a admin -X POST "/forums/post/create" -F "forum=$FORUM_ENTITY" -F "title=Test Post Title" -F "body=Test post content for the forum")
if echo "$RESULT" | grep -q '"post":"'; then
    POST_ID=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['post'])" 2>/dev/null)
    if [ -n "$POST_ID" ]; then
        pass "Create post (id: $POST_ID)"
    else
        fail "Create post" "Could not extract post ID"
    fi
else
    fail "Create post" "$RESULT"
fi

# Test: Get posts list
RESULT=$(forum_api_curl GET "/posts")
if echo "$RESULT" | grep -q '"posts":\['; then
    pass "Get posts list"
else
    fail "Get posts list" "$RESULT"
fi

# Test: Get single post
RESULT=$(forum_api_curl GET "/$POST_ID")
if echo "$RESULT" | grep -q '"post":{'; then
    pass "Get single post"
else
    fail "Get single post" "$RESULT"
fi

# ============================================================================
# VOTING TESTS
# ============================================================================

echo ""
echo "--- Voting Tests ---"

# Test: Upvote post
RESULT=$(forum_api_curl POST "/$POST_ID/vote/up")
if echo "$RESULT" | grep -q '"post":"'; then
    pass "Upvote post"
else
    fail "Upvote post" "$RESULT"
fi

# Test: Downvote post
RESULT=$(forum_api_curl POST "/$POST_ID/vote/down")
if echo "$RESULT" | grep -q '"post":"'; then
    pass "Downvote post"
else
    fail "Downvote post" "$RESULT"
fi

# ============================================================================
# COMMENT TESTS
# ============================================================================

echo ""
echo "--- Comment Tests ---"

# Test: Create comment
RESULT=$(forum_api_curl POST "/$POST_ID/create" -H "Content-Type: application/json" -d '{"body":"Test comment on the post"}')
if echo "$RESULT" | grep -q '"comment":"'; then
    COMMENT_ID=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['comment'])" 2>/dev/null)
    if [ -n "$COMMENT_ID" ]; then
        pass "Create comment (id: $COMMENT_ID)"
    else
        fail "Create comment" "Could not extract comment ID"
    fi
else
    fail "Create comment" "$RESULT"
fi

# Test: Get post with comments
RESULT=$(forum_api_curl GET "/$POST_ID")
if echo "$RESULT" | grep -q '"comments":\['; then
    pass "Get post with comments"
else
    fail "Get post with comments" "$RESULT"
fi

# Test: Upvote comment
RESULT=$(forum_api_curl POST "/$POST_ID/$COMMENT_ID/vote/up")
if echo "$RESULT" | grep -q '"post":"'; then
    pass "Upvote comment"
else
    fail "Upvote comment" "$RESULT"
fi

# ============================================================================
# ACCESS CONTROL TESTS
# ============================================================================

echo ""
echo "--- Access Control Tests ---"

# Test: Get access list
RESULT=$(forum_api_curl GET "/access")
if echo "$RESULT" | grep -q '"access":\['; then
    pass "Get access list"
else
    fail "Get access list" "$RESULT"
fi

# Test: Get members list
RESULT=$(forum_api_curl GET "/members")
if echo "$RESULT" | grep -q '"members":\|"access":\['; then
    pass "Get members list"
else
    fail "Get members list" "$RESULT"
fi

# ============================================================================
# SEARCH TESTS
# ============================================================================

echo ""
echo "--- Search Tests ---"

# Test: Search forums
RESULT=$("$CURL_HELPER" -a admin -X GET "/forums/directory/search?search=Test")
if echo "$RESULT" | grep -q '"results":\['; then
    pass "Search forums"
else
    fail "Search forums" "$RESULT"
fi

# ============================================================================
# UNSUBSCRIBE TEST
# ============================================================================

echo ""
echo "--- Unsubscribe Test ---"

# Test: Unsubscribe from forum
RESULT=$(forum_api_curl POST "/unsubscribe")
if echo "$RESULT" | grep -q '"data":'; then
    pass "Unsubscribe from forum"
else
    fail "Unsubscribe from forum" "$RESULT"
fi

# ============================================================================
# SUMMARY
# ============================================================================

echo ""
echo "=============================================="
echo "Results: $PASSED passed, $FAILED failed"
echo "=============================================="

if [ $FAILED -gt 0 ]; then
    exit 1
fi
