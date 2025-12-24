#!/bin/bash
# Forums P2P dual-instance test suite
# Tests subscriber/non-subscriber interactions between two instances

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
echo "Forums Dual-Instance P2P Test Suite"
echo "=============================================="

# ============================================================================
# SETUP: Create forum on instance 1
# ============================================================================

echo ""
echo "--- Setup: Create Forum on Instance 1 ---"

RESULT=$("$CURL" -i 1 -a admin -X POST -H "Content-Type: application/json" \
    -d '{"name":"P2P Test Forum","access":"post"}' "/forums/create")
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

# Owner votes on their comment
RESULT=$("$CURL" -i 1 -a admin -X POST "/forums/$FORUM_ID/-/$OWNER_POST_ID/$OWNER_COMMENT_ID/vote/up")
if echo "$RESULT" | grep -q '"post"'; then
    pass "Owner upvotes their comment"
else
    fail "Owner upvotes comment" "$RESULT"
fi

sleep 1

# ============================================================================
# TEST: Subscribe from instance 2
# ============================================================================

echo ""
echo "--- Subscription Test ---"

RESULT=$("$CURL" -i 2 -a admin -X POST "/forums/$FORUM_ID/-/subscribe")
if echo "$RESULT" | grep -q '"data"\|"already_subscribed"\|"ok"'; then
    pass "Subscribe from instance 2"
else
    fail "Subscribe from instance 2" "$RESULT"
fi

sleep 2  # Wait for P2P sync

# Check if posts synced with vote counts
RESULT=$("$CURL" -i 2 -a admin -X GET "/forums/$FORUM_ID/-/posts")
if echo "$RESULT" | grep -q '"up":1'; then
    pass "Post vote counts synced"
else
    fail "Post vote counts synced" "$RESULT"
fi

# Check if comments synced
RESULT=$("$CURL" -i 2 -a admin -X GET "/forums/$FORUM_ID/-/$OWNER_POST_ID")
if echo "$RESULT" | grep -q '"comments":\[{'; then
    pass "Comments synced"
else
    fail "Comments synced" "$RESULT"
fi

# ============================================================================
# TEST: Subscriber creates post
# ============================================================================

echo ""
echo "--- Subscriber Post Creation Test ---"

RESULT=$("$CURL" -i 2 -a admin -X POST \
    -F "forum=$FORUM_ID" -F "title=Subscriber Post" -F "body=This is a post by a subscriber" \
    "/forums/post/create")
SUB_POST_ID=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['post'])" 2>/dev/null)

if [ -n "$SUB_POST_ID" ]; then
    pass "Subscriber creates post (id: $SUB_POST_ID)"
else
    fail "Subscriber creates post" "$RESULT"
fi

sleep 2  # Wait for P2P

# Check if owner received the post
RESULT=$("$CURL" -i 1 -a admin -X GET "/forums/$FORUM_ID/-/posts")
if echo "$RESULT" | grep -q "Subscriber Post"; then
    pass "Owner received subscriber's post"
else
    fail "Owner received subscriber's post" "$RESULT"
fi

# ============================================================================
# TEST: Subscriber creates post with attachment
# ============================================================================

echo ""
echo "--- Subscriber Post with Attachment Test ---"

# Create a test image file
TEST_IMG="/tmp/test_attachment_$$.png"
echo -n 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' | base64 -d > "$TEST_IMG"

RESULT=$("$CURL" -i 2 -a admin -X POST \
    -F "forum=$FORUM_ID" -F "title=Post With Attachment" -F "body=This post has an attachment" \
    -F "attachments=@$TEST_IMG" \
    "/forums/post/create")
ATT_POST_ID=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['post'])" 2>/dev/null)

if [ -n "$ATT_POST_ID" ]; then
    pass "Subscriber creates post with attachment (id: $ATT_POST_ID)"
else
    fail "Subscriber creates post with attachment" "$RESULT"
fi

sleep 3  # Wait for P2P (attachments may take longer)

# Check if owner received the post with attachment
RESULT=$("$CURL" -i 1 -a admin -X GET "/forums/$FORUM_ID/-/$ATT_POST_ID")
if echo "$RESULT" | grep -q '"attachments":\[{'; then
    pass "Owner received post with attachment"
    # Extract attachment ID for later tests
    ATT_ID=$(echo "$RESULT" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d['data']['post']['attachments'][0]['id'])" 2>/dev/null)
    echo "    Attachment ID: $ATT_ID"
else
    fail "Owner received post with attachment" "$RESULT"
fi

# ============================================================================
# TEST: Subscriber edits post adding another attachment
# ============================================================================

echo ""
echo "--- Subscriber Edit Post Add Attachment Test ---"

# Create another test image
TEST_IMG2="/tmp/test_attachment2_$$.png"
echo -n 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' | base64 -d > "$TEST_IMG2"

# Edit with existing attachment + new one
if [ -n "$ATT_ID" ]; then
    ORDER_JSON="[\"$ATT_ID\",\"new:0\"]"
else
    ORDER_JSON="[\"new:0\"]"
fi

RESULT=$("$CURL" -i 2 -a admin -X POST \
    -F "title=Post With Two Attachments" -F "body=This post now has two attachments" \
    -F "order=$ORDER_JSON" \
    -F "attachments=@$TEST_IMG2" \
    "/forums/$FORUM_ID/-/$ATT_POST_ID/edit")

if echo "$RESULT" | grep -q '"post"'; then
    pass "Subscriber edits post adding attachment"
else
    fail "Subscriber edits post adding attachment" "$RESULT"
fi

sleep 3

# Check if owner has both attachments
RESULT=$("$CURL" -i 1 -a admin -X GET "/forums/$FORUM_ID/-/$ATT_POST_ID")
ATT_COUNT=$(echo "$RESULT" | python3 -c "import sys, json; d=json.load(sys.stdin); print(len(d['data']['post'].get('attachments', [])))" 2>/dev/null)

if [ "$ATT_COUNT" = "2" ]; then
    pass "Owner has both attachments (count: 2)"
    # Get attachment IDs for delete test
    ATT_IDS=$(echo "$RESULT" | python3 -c "import sys, json; d=json.load(sys.stdin); print(' '.join([a['id'] for a in d['data']['post'].get('attachments', [])]))" 2>/dev/null)
    ATT_ID1=$(echo "$ATT_IDS" | cut -d' ' -f1)
    ATT_ID2=$(echo "$ATT_IDS" | cut -d' ' -f2)
    echo "    Attachment IDs: $ATT_ID1, $ATT_ID2"
else
    fail "Owner has both attachments" "Expected 2, got $ATT_COUNT - $RESULT"
fi

# ============================================================================
# TEST: Subscriber edits post deleting an attachment
# ============================================================================

echo ""
echo "--- Subscriber Edit Post Delete Attachment Test ---"

# Keep only the second attachment
if [ -n "$ATT_ID2" ]; then
    ORDER_JSON="[\"$ATT_ID2\"]"

    RESULT=$("$CURL" -i 2 -a admin -X POST \
        -F "title=Post With One Attachment" -F "body=One attachment was deleted" \
        -F "order=$ORDER_JSON" \
        "/forums/$FORUM_ID/-/$ATT_POST_ID/edit")

    if echo "$RESULT" | grep -q '"post"'; then
        pass "Subscriber edits post deleting attachment"
    else
        fail "Subscriber edits post deleting attachment" "$RESULT"
    fi

    sleep 3

    # Check if owner has only one attachment
    RESULT=$("$CURL" -i 1 -a admin -X GET "/forums/$FORUM_ID/-/$ATT_POST_ID")
    ATT_COUNT=$(echo "$RESULT" | python3 -c "import sys, json; d=json.load(sys.stdin); print(len(d['data']['post'].get('attachments', [])))" 2>/dev/null)

    if [ "$ATT_COUNT" = "1" ]; then
        pass "Owner has one attachment after delete (count: 1)"
    else
        fail "Owner has one attachment after delete" "Expected 1, got $ATT_COUNT"
    fi
else
    echo "[SKIP] Attachment delete test - no attachment IDs available"
fi

# Cleanup temp files
rm -f "$TEST_IMG" "$TEST_IMG2"

# ============================================================================
# TEST: Subscriber votes on owner's post
# ============================================================================

echo ""
echo "--- Subscriber Voting Test ---"

RESULT=$("$CURL" -i 2 -a admin -X POST "/forums/$FORUM_ID/-/$OWNER_POST_ID/vote/up")
if echo "$RESULT" | grep -q '"post"'; then
    pass "Subscriber upvotes owner's post"
else
    fail "Subscriber upvotes owner's post" "$RESULT"
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
# TEST: Subscriber creates comment
# ============================================================================

echo ""
echo "--- Subscriber Comment Test ---"

RESULT=$("$CURL" -i 2 -a admin -X POST -H "Content-Type: application/json" \
    -d '{"body":"Subscriber comment on owner post"}' "/forums/$FORUM_ID/-/$OWNER_POST_ID/create")
SUB_COMMENT_ID=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['comment'])" 2>/dev/null)

if [ -n "$SUB_COMMENT_ID" ]; then
    pass "Subscriber creates comment (id: $SUB_COMMENT_ID)"
else
    fail "Subscriber creates comment" "$RESULT"
fi

sleep 2

# Check if owner received the comment
RESULT=$("$CURL" -i 1 -a admin -X GET "/forums/$FORUM_ID/-/$OWNER_POST_ID")
if echo "$RESULT" | grep -q "Subscriber comment"; then
    pass "Owner received subscriber's comment"
else
    fail "Owner received subscriber's comment" "$RESULT"
fi

# ============================================================================
# TEST: Subscriber edits their post
# ============================================================================

echo ""
echo "--- Subscriber Edit Test ---"

RESULT=$("$CURL" -i 2 -a admin -X POST \
    -F "title=Subscriber Post Edited" -F "body=This post was edited by the subscriber" \
    "/forums/$FORUM_ID/-/$SUB_POST_ID/edit")
if echo "$RESULT" | grep -q '"post"'; then
    pass "Subscriber edits their post"
else
    fail "Subscriber edits their post" "$RESULT"
fi

sleep 2

# Check if edit synced to owner
RESULT=$("$CURL" -i 1 -a admin -X GET "/forums/$FORUM_ID/-/$SUB_POST_ID")
if echo "$RESULT" | grep -q "Subscriber Post Edited"; then
    pass "Edit synced to owner"
else
    fail "Edit synced to owner" "$RESULT"
fi

# ============================================================================
# TEST: Subscriber edits their comment
# ============================================================================

echo ""
echo "--- Subscriber Comment Edit Test ---"

RESULT=$("$CURL" -i 2 -a admin -X POST -H "Content-Type: application/json" \
    -d '{"body":"Subscriber comment EDITED"}' "/forums/$FORUM_ID/-/$OWNER_POST_ID/$SUB_COMMENT_ID/edit")
if echo "$RESULT" | grep -q '"comment"'; then
    pass "Subscriber edits their comment"
else
    fail "Subscriber edits their comment" "$RESULT"
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
# TEST: Subscriber deletes their comment
# ============================================================================

echo ""
echo "--- Subscriber Delete Comment Test ---"

RESULT=$("$CURL" -i 2 -a admin -X POST "/forums/$FORUM_ID/-/$OWNER_POST_ID/$SUB_COMMENT_ID/delete")
if echo "$RESULT" | grep -q '"forum"\|"post"'; then
    pass "Subscriber deletes their comment"
else
    fail "Subscriber deletes their comment" "$RESULT"
fi

sleep 2

# Check if delete synced to owner
RESULT=$("$CURL" -i 1 -a admin -X GET "/forums/$FORUM_ID/-/$OWNER_POST_ID")
if ! echo "$RESULT" | grep -q "Subscriber comment"; then
    pass "Comment delete synced to owner"
else
    fail "Comment delete synced to owner" "$RESULT"
fi

# ============================================================================
# TEST: Subscriber deletes their post
# ============================================================================

echo ""
echo "--- Subscriber Delete Post Test ---"

RESULT=$("$CURL" -i 2 -a admin -X POST "/forums/$FORUM_ID/-/$SUB_POST_ID/delete")
if echo "$RESULT" | grep -q '"forum"'; then
    pass "Subscriber deletes their post"
else
    fail "Subscriber deletes their post" "$RESULT"
fi

sleep 2

# Check if delete synced to owner
RESULT=$("$CURL" -i 1 -a admin -X GET "/forums/$FORUM_ID/-/posts")
if ! echo "$RESULT" | grep -q "Subscriber Post"; then
    pass "Post delete synced to owner"
else
    fail "Post delete synced to owner" "$RESULT"
fi

# ============================================================================
# CLEANUP: Unsubscribe
# ============================================================================

echo ""
echo "--- Cleanup ---"

RESULT=$("$CURL" -i 2 -a admin -X POST "/forums/$FORUM_ID/-/unsubscribe")
if echo "$RESULT" | grep -q '"data"'; then
    pass "Unsubscribe from instance 2"
else
    fail "Unsubscribe from instance 2" "$RESULT"
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
