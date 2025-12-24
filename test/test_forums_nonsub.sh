#!/bin/bash
# Forums P2P non-subscriber test suite
# Tests interactions from users who are NOT subscribed to a forum

set -e

CURL="/home/alistair/mochi/test/claude/curl.sh"

PASSED=0
FAILED=0

pass() {
    echo "[PASS] $1"
    ((PASSED++)) || true
}

fail() {
    echo "[FAIL] $1: $2"
    ((FAILED++)) || true
}

echo "=============================================="
echo "Forums Non-Subscriber P2P Test Suite"
echo "=============================================="

# ============================================================================
# SETUP: Create forum on instance 1 with "post" access (anyone can post)
# ============================================================================

echo ""
echo "--- Setup: Create Forum on Instance 1 ---"

RESULT=$("$CURL" -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d '{"name":"Non-Sub Test Forum","access":"post"}' "/forums/create")
FORUM_ID=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)

if [ -n "$FORUM_ID" ]; then
    pass "Create forum on instance 1 (id: $FORUM_ID)"
else
    fail "Create forum" "$RESULT"
    exit 1
fi

# Create a post as owner
RESULT=$("$CURL" -i 1 -a admin -X POST \
    -F "forum=$FORUM_ID" -F "title=Owner Post" -F "body=This is a post by the forum owner" \
    "/forums/post/create")
OWNER_POST_ID=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['post'])" 2>/dev/null)

if [ -n "$OWNER_POST_ID" ]; then
    pass "Create post as owner (id: $OWNER_POST_ID)"
else
    fail "Create post as owner" "$RESULT"
fi

# Owner votes on their post
RESULT=$("$CURL" -i 1 -a admin -X POST "/forums/$FORUM_ID/-/$OWNER_POST_ID/vote/up")
if echo "$RESULT" | grep -q '"post"'; then
    pass "Owner upvotes their post"
else
    fail "Owner upvotes post" "$RESULT"
fi

# Owner adds a comment
RESULT=$("$CURL" -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d '{"body":"Owner comment on the post"}' "/forums/$FORUM_ID/-/$OWNER_POST_ID/create")
OWNER_COMMENT_ID=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['comment'])" 2>/dev/null)

if [ -n "$OWNER_COMMENT_ID" ]; then
    pass "Owner creates comment (id: $OWNER_COMMENT_ID)"
else
    fail "Owner creates comment" "$RESULT"
fi

sleep 1

# ============================================================================
# TEST: Non-subscriber views forum (without subscribing)
# ============================================================================

echo ""
echo "--- Non-Subscriber View Test ---"

# Instance 2 views posts WITHOUT subscribing
RESULT=$("$CURL" -i 2 -a admin -X GET "/forums/$FORUM_ID/-/posts")
if echo "$RESULT" | grep -q '"posts":\['; then
    pass "Non-subscriber can view forum posts"
    # Check if vote counts are included
    if echo "$RESULT" | grep -q '"up":1'; then
        pass "Vote counts visible to non-subscriber"
    else
        fail "Vote counts visible to non-subscriber" "$RESULT"
    fi
else
    fail "Non-subscriber can view forum posts" "$RESULT"
fi

# View single post with comments
RESULT=$("$CURL" -i 2 -a admin -X GET "/forums/$FORUM_ID/-/$OWNER_POST_ID")
if echo "$RESULT" | grep -q '"comments":\[{'; then
    pass "Non-subscriber can view post with comments"
else
    fail "Non-subscriber can view post with comments" "$RESULT"
fi

# ============================================================================
# TEST: Non-subscriber creates post
# ============================================================================

echo ""
echo "--- Non-Subscriber Post Creation Test ---"

RESULT=$("$CURL" -i 2 -a admin -X POST \
    -F "forum=$FORUM_ID" -F "title=Non-Subscriber Post" -F "body=This is a post by a non-subscriber" \
    "/forums/post/create")
NONSUB_POST_ID=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['post'])" 2>/dev/null)

if [ -n "$NONSUB_POST_ID" ]; then
    pass "Non-subscriber creates post (id: $NONSUB_POST_ID)"
else
    fail "Non-subscriber creates post" "$RESULT"
fi

sleep 2

# Check if owner received the post
RESULT=$("$CURL" -i 1 -a admin -X GET "/forums/$FORUM_ID/-/posts")
if echo "$RESULT" | grep -q "Non-Subscriber Post"; then
    pass "Owner received non-subscriber's post"
else
    fail "Owner received non-subscriber's post" "$RESULT"
fi

# ============================================================================
# TEST: Non-subscriber creates post with attachment
# ============================================================================

echo ""
echo "--- Non-Subscriber Post with Attachment Test ---"

TEST_IMG="/tmp/test_nonsub_att_$$.png"
echo -n 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' | base64 -d > "$TEST_IMG"

RESULT=$("$CURL" -i 2 -a admin -X POST \
    -F "forum=$FORUM_ID" -F "title=Non-Sub Attachment Post" -F "body=Post with attachment from non-subscriber" \
    -F "attachments=@$TEST_IMG" \
    "/forums/post/create")
NONSUB_ATT_POST_ID=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['post'])" 2>/dev/null)

if [ -n "$NONSUB_ATT_POST_ID" ]; then
    pass "Non-subscriber creates post with attachment (id: $NONSUB_ATT_POST_ID)"
else
    fail "Non-subscriber creates post with attachment" "$RESULT"
fi

sleep 3

# Check if owner received attachment
RESULT=$("$CURL" -i 1 -a admin -X GET "/forums/$FORUM_ID/-/$NONSUB_ATT_POST_ID")
if echo "$RESULT" | grep -q '"attachments":\[{'; then
    pass "Owner received post with attachment"
    ATT_ID=$(echo "$RESULT" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d['data']['post']['attachments'][0]['id'])" 2>/dev/null)
    echo "    Attachment ID: $ATT_ID"
else
    fail "Owner received post with attachment" "$RESULT"
fi

# ============================================================================
# TEST: Non-subscriber votes on owner's post
# ============================================================================

echo ""
echo "--- Non-Subscriber Voting Test ---"

RESULT=$("$CURL" -i 2 -a admin -X POST "/forums/$FORUM_ID/-/$OWNER_POST_ID/vote/up")
if echo "$RESULT" | grep -q '"post"'; then
    pass "Non-subscriber upvotes owner's post"
else
    fail "Non-subscriber upvotes owner's post" "$RESULT"
fi

sleep 2

# Check vote count on owner's instance
RESULT=$("$CURL" -i 1 -a admin -X GET "/forums/$FORUM_ID/-/$OWNER_POST_ID")
if echo "$RESULT" | grep -q '"up":2'; then
    pass "Vote synced to owner (up:2)"
else
    fail "Vote synced to owner" "$RESULT"
fi

# ============================================================================
# TEST: Non-subscriber creates comment
# ============================================================================

echo ""
echo "--- Non-Subscriber Comment Test ---"

RESULT=$("$CURL" -i 2 -a admin -X POST -H "Content-Type: application/json" \
    -d '{"body":"Non-subscriber comment on owner post"}' "/forums/$FORUM_ID/-/$OWNER_POST_ID/create")
NONSUB_COMMENT_ID=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['comment'])" 2>/dev/null)

if [ -n "$NONSUB_COMMENT_ID" ]; then
    pass "Non-subscriber creates comment (id: $NONSUB_COMMENT_ID)"
else
    fail "Non-subscriber creates comment" "$RESULT"
fi

sleep 2

# Check if owner received the comment
RESULT=$("$CURL" -i 1 -a admin -X GET "/forums/$FORUM_ID/-/$OWNER_POST_ID")
if echo "$RESULT" | grep -q "Non-subscriber comment"; then
    pass "Owner received non-subscriber's comment"
else
    fail "Owner received non-subscriber's comment" "$RESULT"
fi

# ============================================================================
# TEST: Non-subscriber edits their post
# ============================================================================

echo ""
echo "--- Non-Subscriber Edit Post Test ---"

RESULT=$("$CURL" -i 2 -a admin -X POST \
    -F "title=Non-Subscriber Post EDITED" -F "body=This post was edited by the non-subscriber" \
    "/forums/$FORUM_ID/-/$NONSUB_POST_ID/edit")
if echo "$RESULT" | grep -q '"post"'; then
    pass "Non-subscriber edits their post"
else
    fail "Non-subscriber edits their post" "$RESULT"
fi

sleep 2

# Check if edit synced to owner
RESULT=$("$CURL" -i 1 -a admin -X GET "/forums/$FORUM_ID/-/$NONSUB_POST_ID")
if echo "$RESULT" | grep -q "EDITED"; then
    pass "Edit synced to owner"
else
    fail "Edit synced to owner" "$RESULT"
fi

# ============================================================================
# TEST: Non-subscriber edits post adding attachment
# ============================================================================

echo ""
echo "--- Non-Subscriber Edit Add Attachment Test ---"

TEST_IMG2="/tmp/test_nonsub_att2_$$.png"
echo -n 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' | base64 -d > "$TEST_IMG2"

if [ -n "$ATT_ID" ]; then
    ORDER_JSON="[\"$ATT_ID\",\"new:0\"]"
else
    ORDER_JSON="[\"new:0\"]"
fi

RESULT=$("$CURL" -i 2 -a admin -X POST \
    -F "title=Non-Sub Two Attachments" -F "body=Added another attachment" \
    -F "order=$ORDER_JSON" \
    -F "attachments=@$TEST_IMG2" \
    "/forums/$FORUM_ID/-/$NONSUB_ATT_POST_ID/edit")

if echo "$RESULT" | grep -q '"post"'; then
    pass "Non-subscriber edits post adding attachment"
else
    fail "Non-subscriber edits post adding attachment" "$RESULT"
fi

sleep 3

# Check if owner has both attachments
RESULT=$("$CURL" -i 1 -a admin -X GET "/forums/$FORUM_ID/-/$NONSUB_ATT_POST_ID")
ATT_COUNT=$(echo "$RESULT" | python3 -c "import sys, json; d=json.load(sys.stdin); print(len(d['data']['post'].get('attachments', [])))" 2>/dev/null)

if [ "$ATT_COUNT" = "2" ]; then
    pass "Owner has both attachments (count: 2)"
    ATT_IDS=$(echo "$RESULT" | python3 -c "import sys, json; d=json.load(sys.stdin); print(' '.join([a['id'] for a in d['data']['post'].get('attachments', [])]))" 2>/dev/null)
    ATT_ID2=$(echo "$ATT_IDS" | cut -d' ' -f2)
    echo "    Second attachment ID: $ATT_ID2"
else
    fail "Owner has both attachments" "Expected 2, got $ATT_COUNT"
fi

# ============================================================================
# TEST: Non-subscriber edits post deleting attachment
# ============================================================================

echo ""
echo "--- Non-Subscriber Edit Delete Attachment Test ---"

if [ -n "$ATT_ID2" ]; then
    ORDER_JSON="[\"$ATT_ID2\"]"

    RESULT=$("$CURL" -i 2 -a admin -X POST \
        -F "title=Non-Sub One Attachment" -F "body=Deleted one attachment" \
        -F "order=$ORDER_JSON" \
        "/forums/$FORUM_ID/-/$NONSUB_ATT_POST_ID/edit")

    if echo "$RESULT" | grep -q '"post"'; then
        pass "Non-subscriber edits post deleting attachment"
    else
        fail "Non-subscriber edits post deleting attachment" "$RESULT"
    fi

    sleep 3

    RESULT=$("$CURL" -i 1 -a admin -X GET "/forums/$FORUM_ID/-/$NONSUB_ATT_POST_ID")
    ATT_COUNT=$(echo "$RESULT" | python3 -c "import sys, json; d=json.load(sys.stdin); print(len(d['data']['post'].get('attachments', [])))" 2>/dev/null)

    if [ "$ATT_COUNT" = "1" ]; then
        pass "Owner has one attachment after delete (count: 1)"
    else
        fail "Owner has one attachment after delete" "Expected 1, got $ATT_COUNT"
    fi
else
    echo "[SKIP] Attachment delete test - no attachment ID"
fi

# Cleanup temp files
rm -f "$TEST_IMG" "$TEST_IMG2"

# ============================================================================
# TEST: Non-subscriber edits their comment
# ============================================================================

echo ""
echo "--- Non-Subscriber Edit Comment Test ---"

RESULT=$("$CURL" -i 2 -a admin -X POST -H "Content-Type: application/json" \
    -d '{"body":"Non-subscriber comment EDITED"}' "/forums/$FORUM_ID/-/$OWNER_POST_ID/$NONSUB_COMMENT_ID/edit")
if echo "$RESULT" | grep -q '"comment"'; then
    pass "Non-subscriber edits their comment"
else
    fail "Non-subscriber edits their comment" "$RESULT"
fi

sleep 2

# Check if comment edit synced to owner
RESULT=$("$CURL" -i 1 -a admin -X GET "/forums/$FORUM_ID/-/$OWNER_POST_ID")
if echo "$RESULT" | grep -q "EDITED"; then
    pass "Comment edit synced to owner"
else
    fail "Comment edit synced to owner" "$RESULT"
fi

# ============================================================================
# TEST: Non-subscriber deletes their comment
# ============================================================================

echo ""
echo "--- Non-Subscriber Delete Comment Test ---"

RESULT=$("$CURL" -i 2 -a admin -X POST "/forums/$FORUM_ID/-/$OWNER_POST_ID/$NONSUB_COMMENT_ID/delete")
if echo "$RESULT" | grep -q '"forum"\|"post"'; then
    pass "Non-subscriber deletes their comment"
else
    fail "Non-subscriber deletes their comment" "$RESULT"
fi

sleep 2

# Check if delete synced to owner
RESULT=$("$CURL" -i 1 -a admin -X GET "/forums/$FORUM_ID/-/$OWNER_POST_ID")
if ! echo "$RESULT" | grep -q "Non-subscriber comment"; then
    pass "Comment delete synced to owner"
else
    fail "Comment delete synced to owner" "$RESULT"
fi

# ============================================================================
# TEST: Non-subscriber deletes their post
# ============================================================================

echo ""
echo "--- Non-Subscriber Delete Post Test ---"

RESULT=$("$CURL" -i 2 -a admin -X POST "/forums/$FORUM_ID/-/$NONSUB_POST_ID/delete")
if echo "$RESULT" | grep -q '"forum"'; then
    pass "Non-subscriber deletes their post"
else
    fail "Non-subscriber deletes their post" "$RESULT"
fi

sleep 2

# Check if delete synced to owner
RESULT=$("$CURL" -i 1 -a admin -X GET "/forums/$FORUM_ID/-/posts")
if ! echo "$RESULT" | grep -q "Non-Subscriber Post"; then
    pass "Post delete synced to owner"
else
    fail "Post delete synced to owner" "$RESULT"
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
