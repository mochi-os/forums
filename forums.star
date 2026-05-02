# Mochi Forums app
# Copyright Alistair Cunningham 2024-2026

def notify(topic, object="", title="", body="", url=""):
	mochi.service.call("notifications", "send", topic, object, title, body, url, mochi.app.label("notifications.topic." + topic.replace("/", ".")))

# Helper: Build a map of qid -> weight from user interests
def get_interest_map():
	interests = mochi.interests.list()
	m = {}
	for i in interests:
		m[i["qid"]] = i["weight"]
	return m

# Helper: Annotate tags that match a user interest with the interest weight
def enrich_tags(tags, interest_map):
	for t in tags:
		qid = t.get("qid", "")
		if qid and qid in interest_map:
			t["interest"] = interest_map[qid]
	return tags

# Access level hierarchy: moderate > post > comment > vote > view
# Each level grants access to that operation and all operations below it.
# Only owners (with "*" access) have full management permissions.
# "none" means no access (user has no rules or explicit deny).
ACCESS_LEVELS = ["view", "vote", "comment", "post", "moderate"]

# Map old role names to new access levels for migration
ROLE_TO_ACCESS = {
    "disabled": None,  # No access
    "viewer": "view",
    "voter": "vote",
    "commenter": "comment",
    "poster": "post",
    "administrator": None  # Admins migrated to owner role, not access rules
}

# Create database
def database_create():
    mochi.db.execute("""create table if not exists forums (
        id text not null primary key, name text not null, members integer not null default 0, updated integer not null,
        owner integer not null default 0, server text not null default '',
        moderation_posts integer not null default 0, moderation_comments integer not null default 0,
        moderation_new integer not null default 0, new_user_days integer not null default 0,
        post_limit integer not null default 0, comment_limit integer not null default 0,
        limit_window integer not null default 3600, fingerprint text not null default '',
        ai_mode text not null default '', ai_account integer not null default 0,
        ai_prompt_tag text not null default '', ai_prompt_score text not null default '',
        banner text not null default '', sort text not null default '' )""")
    mochi.db.execute("create index if not exists forums_name on forums( name )")
    mochi.db.execute("create index if not exists forums_updated on forums( updated )")
    mochi.db.execute("create index if not exists forums_fingerprint on forums( fingerprint )")

    mochi.db.execute("create table if not exists members ( forum references forums( id ), id text not null, name text not null default '', subscribed integer not null, primary key ( forum, id ) )")
    mochi.db.execute("create index if not exists members_id on members( id )")

    mochi.db.execute("""create table if not exists posts (
        id text not null primary key, forum references forums( id ), member text not null, name text not null,
        title text not null, body text not null, comments integer not null default 0,
        up integer not null default 0, down integer not null default 0,
        created integer not null, updated integer not null, edited integer not null default 0,
        status text not null default 'approved', remover text, reason text not null default '',
        locked integer not null default 0, pinned integer not null default 0 )""")
    mochi.db.execute("create index if not exists posts_forum on posts( forum )")
    mochi.db.execute("create index if not exists posts_forum_status on posts( forum, status )")
    mochi.db.execute("create index if not exists posts_created on posts( created )")
    mochi.db.execute("create index if not exists posts_updated on posts( updated )")

    mochi.db.execute("""create table if not exists comments (
        id text not null primary key, forum references forums( id ), post text not null, parent text not null,
        member text not null, name text not null, body text not null,
        up integer not null default 0, down integer not null default 0,
        created integer not null, edited integer not null default 0,
        status text not null default 'approved', remover text, reason text not null default '' )""")
    mochi.db.execute("create index if not exists comments_forum on comments( forum )")
    mochi.db.execute("create index if not exists comments_post on comments( post )")
    mochi.db.execute("create index if not exists comments_parent on comments( parent )")
    mochi.db.execute("create index if not exists comments_created on comments( created )")

    mochi.db.execute("create table if not exists votes ( forum references forums( id ), post text not null, comment text not null default '', voter text not null, vote text not null, primary key ( forum, post, comment, voter ) )")
    mochi.db.execute("create index if not exists votes_post on votes( post )")
    mochi.db.execute("create index if not exists votes_comment on votes( comment )")
    mochi.db.execute("create index if not exists votes_voter on votes( voter )")

    # Moderation tables
    mochi.db.execute("""create table if not exists moderation (
        id text primary key, forum text not null, moderator text not null, action text not null,
        type text not null, target text not null, author text, reason text not null default '',
        created integer not null )""")
    mochi.db.execute("create index if not exists moderation_forum on moderation( forum )")
    mochi.db.execute("create index if not exists moderation_created on moderation( created )")

    mochi.db.execute("""create table if not exists restrictions (
        forum text not null, user text not null, type text not null, reason text not null default '',
        moderator text not null, expires integer, created integer not null,
        primary key ( forum, user ) )""")
    mochi.db.execute("create index if not exists restrictions_user on restrictions( user )")

    mochi.db.execute("""create table if not exists reports (
        id text primary key, forum text not null, reporter text not null, type text not null,
        target text not null, author text not null, reason text not null,
        details text not null default '', status text not null default 'pending',
        resolver text, action text, created integer not null, resolved integer )""")
    mochi.db.execute("create index if not exists reports_forum on reports( forum )")
    mochi.db.execute("create index if not exists reports_status on reports( status )")
    mochi.db.execute("create index if not exists reports_target on reports( type, target )")

    mochi.db.execute("create table if not exists rss ( token text not null primary key, entity text not null, mode text not null, created integer not null, unique(entity, mode) )")
    mochi.db.execute("create index if not exists rss_entity on rss( entity )")

    mochi.db.execute("create table if not exists tags ( id text not null primary key, object text not null, label text not null, qid text not null default '', relevance real not null default 0.0, source text not null default 'manual' )")
    mochi.db.execute("create index if not exists tags_object on tags( object )")
    mochi.db.execute("create index if not exists tags_label on tags( label )")
    mochi.db.execute("create index if not exists tags_qid on tags( qid )")

    mochi.db.execute("create table if not exists score_cache (forum text not null, post text not null, score integer not null default 0, computed integer not null default 0, primary key (forum, post))")
    mochi.db.execute("create index if not exists score_cache_forum on score_cache(forum, computed)")

    mochi.db.execute("create table if not exists settings ( id integer primary key check ( id = 1 ), sort text not null default '' )")
    mochi.db.execute("insert or ignore into settings ( id, sort ) values ( 1, '' )")


# Upgrade database schema
def database_upgrade(to_version):
    if to_version == 26:
        cols = [r["name"] for r in mochi.db.table("forums")]
        if "banner" not in cols:
            mochi.db.execute("alter table forums add column banner text not null default ''")
    if to_version == 27:
        mochi.db.execute("delete from members where forum not in (select id from forums)")
    if to_version == 28:
        # Re-plant ai_prompt_tag/ai_prompt_score on forums — they were only ever
        # added by a legacy migration that was later deleted, so fresh installs
        # lack them and get_ai_prompt() crashes with "no such column".
        cols = [r["name"] for r in mochi.db.table("forums")]
        if "ai_prompt_tag" not in cols:
            mochi.db.execute("alter table forums add column ai_prompt_tag text not null default ''")
        if "ai_prompt_score" not in cols:
            mochi.db.execute("alter table forums add column ai_prompt_score text not null default ''")
    if to_version == 29:
        cols = [r["name"] for r in mochi.db.table("forums")]
        if "sort" not in cols:
            mochi.db.execute("alter table forums add column sort text not null default ''")
        mochi.db.execute("create table if not exists settings ( id integer primary key check ( id = 1 ), sort text not null default '' )")
        mochi.db.execute("insert or ignore into settings ( id, sort ) values ( 1, '' )")
    if to_version == 30:
        # score_cache was added to database_create() but never via a migration,
        # so older forum DBs lack it and any AI/relevance sort path crashes.
        mochi.db.execute("create table if not exists score_cache (forum text not null, post text not null, score integer not null default 0, computed integer not null default 0, primary key (forum, post))")
        mochi.db.execute("create index if not exists score_cache_forum on score_cache(forum, computed)")

# Helper: Get forum by ID or fingerprint
def get_forum(forum_id):
    forum = mochi.db.row("select * from forums where id=?", forum_id)
    if not forum:
        # Try to find by fingerprint
        forum = mochi.db.row("select * from forums where fingerprint=?", forum_id)
    return forum

# Helper: Check if current user has access (queries remote owner if not local owner)
# Use this for actions that need to work for both owners and delegated moderators
def check_access_remote(a, forum_id, operation):
    # If we own the forum, check locally
    row = mochi.db.row("select owner from forums where id=?", forum_id)
    if row and row["owner"] == 1:
        return check_access(a, forum_id, operation)

    # Query owner for access
    user_id = a.user.identity.id if a.user and a.user.identity else None
    if not user_id:
        return False

    access_response = mochi.remote.request(forum_id, "forums", "access/check", {
        "operations": [operation],
        "user": user_id,
    })
    return access_response.get(operation, False)

# Helper: Check if current user has access to perform an operation
# Uses hierarchical access levels: post grants comment+vote+view, etc.
# Only owners (with "*" access) have full permissions.
def check_access(a, forum_id, operation):
    resource = "forum/" + forum_id
    user = None
    if a.user and a.user.identity:
        user = a.user.identity.id

    # Owner has full access
    row = mochi.db.row("select owner from forums where id=?", forum_id)
    if row and row["owner"] == 1:
        return True

    # Wildcard grants full access (owner only)
    if mochi.access.check(user, resource, "*"):
        return True

    # Check if user has a user-specific access rule
    # If so, prioritize that rule over wildcards
    if user:
        rules = mochi.access.list.resource(resource)
        for rule in rules:
            if rule.get("subject") == user:
                # Found user-specific rule - check grant field first
                grant = rule.get("grant", 1)
                if grant == 0:
                    # Explicit deny - block access immediately
                    return False
                # Check if it grants the requested access level
                user_level = rule.get("operation")
                if user_level and operation in ACCESS_LEVELS and user_level in ACCESS_LEVELS:
                    if ACCESS_LEVELS.index(user_level) >= ACCESS_LEVELS.index(operation):
                        return True
                # User-specific rule doesn't grant access, but continue to check member fallback
                break

    # No user-specific rule or it didn't grant access - use normal access checks
    if operation in ACCESS_LEVELS:
        op_index = ACCESS_LEVELS.index(operation)
        for level in ACCESS_LEVELS[op_index:]:
            if mochi.access.check(user, resource, level):
                return True

    return False

# Helper: Check if remote user (from event header) has access to perform an operation
# Uses same hierarchical levels as check_access.
def check_event_access(user_id, forum_id, operation):
    resource = "forum/" + forum_id

    # Owner has full access - check if requester owns the forum entity
    entity = mochi.entity.info(forum_id)
    if entity and entity.get("creator") == user_id:
        return True

    # Wildcard grants full access (owner only)
    if mochi.access.check(user_id, resource, "*"):
        return True

    # Check if user has a user-specific access rule
    # If so, that rule takes precedence - don't check wildcard rules
    if user_id:
        rules = mochi.access.list.resource(resource)
        for rule in rules:
            if rule.get("subject") == user_id:
                # Found user-specific rule - check grant field first
                grant = rule.get("grant", 1)
                if grant == 0:
                    # Explicit deny - block access immediately
                    return False
                # Check if it grants the requested access level
                user_level = rule.get("operation")
                if user_level and operation in ACCESS_LEVELS and user_level in ACCESS_LEVELS:
                    if ACCESS_LEVELS.index(user_level) >= ACCESS_LEVELS.index(operation):
                        return True
                # User-specific rule exists but doesn't grant this operation
                # Return false - don't fall through to wildcard checks
                return False

    # No user-specific rule - check normal access levels (including + and * wildcards)
    if operation in ACCESS_LEVELS:
        op_index = ACCESS_LEVELS.index(operation)
        for level in ACCESS_LEVELS[op_index:]:
            if mochi.access.check(user_id, resource, level):
                return True

    return False

# Helper: Broadcast event to all subscribers of a forum
def broadcast_event(forum_id, event, data, exclude=None):
    if not forum_id:
        return
    members = mochi.db.rows("select id from members where forum=?", forum_id)
    for m in members:
        if exclude and m["id"] == exclude:
            continue
        mochi.message.send(
            {"from": forum_id, "to": m["id"], "service": "forums", "event": event},
            data
        )

# Helper: Broadcast WebSocket notification to forum subscribers
# Uses fingerprint as key since that's what frontend connects with (from URL)
def broadcast_websocket(forum_id, data):
    if not forum_id:
        return
    fingerprint = mochi.entity.fingerprint(forum_id)
    if not fingerprint:
        return
    mochi.websocket.write(fingerprint, data)

# Helper: Check if user is restricted from a forum
# Returns error message if restricted, None if allowed
def check_restriction(forum_id, user_id, operation):
    restriction = mochi.db.row(
        "select * from restrictions where forum=? and user=? and (expires is null or expires > ?)",
        forum_id, user_id, mochi.time.now())

    if not restriction:
        return None

    if restriction["type"] == "banned":
        return "You are banned from this forum"

    if restriction["type"] == "muted" and operation in ["post", "comment"]:
        return "You are muted in this forum"

    # Shadowban returns None but content will be auto-removed
    return None

# Helper: Check if user is shadowbanned
def is_shadowbanned(forum_id, user_id):
    return mochi.db.exists(
        "select 1 from restrictions where forum=? and user=? and type='shadowban' and (expires is null or expires > ?)",
        forum_id, user_id, mochi.time.now())

# Helper: Log a moderation action for audit trail
def log_moderation(forum_id, moderator_id, action, target_type, target_id, author_id, reason):
    mochi.db.execute(
        "insert into moderation (id, forum, moderator, action, type, target, author, reason, created) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        mochi.uid(), forum_id, moderator_id, action, target_type, target_id, author_id, reason, mochi.time.now())

# Helper: Check if user's content requires pre-moderation
def requires_premoderation(forum, user_id, kind):
    # Check content-specific pre-moderation setting
    if kind == "post" and forum.get("moderation_posts"):
        return True
    if kind == "comment" and forum.get("moderation_comments"):
        return True

    # Check new user pre-moderation
    if not forum.get("moderation_new"):
        return False

    # If new_user_days is 0, require first approved content
    if forum.get("new_user_days", 0) == 0:
        approved = mochi.db.exists(
            "select 1 from posts where forum=? and member=? and status='approved' union select 1 from comments where forum=? and member=? and status='approved'",
            forum["id"], user_id, forum["id"], user_id)
        return not approved

    # Check membership age
    member = mochi.db.row("select subscribed from members where forum=? and id=?", forum["id"], user_id)
    if not member:
        return True
    days = (mochi.time.now() - member["subscribed"]) / 86400
    return days < forum.get("new_user_days", 0)

# Helper: Check rate limit for posting/commenting
# Returns error message if rate limited, None if allowed
def check_rate_limit(forum, user_id, kind):
    if kind == "post":
        limit = forum.get("post_limit", 0)
    elif kind == "comment":
        limit = forum.get("comment_limit", 0)
    else:
        return None

    if limit == 0:
        return None

    window = forum.get("limit_window", 3600)
    since = mochi.time.now() - window

    if kind == "post":
        row = mochi.db.row(
            "select count(*) as count from posts where forum=? and member=? and created > ?",
            forum["id"], user_id, since)
    else:
        row = mochi.db.row(
            "select count(*) as count from comments where forum=? and member=? and created > ?",
            forum["id"], user_id, since)

    count = row["count"] if row else 0
    if count >= limit:
        minutes = window // 60
        return "Rate limit exceeded. You can only create " + str(limit) + " " + kind + "s per " + str(minutes) + " minutes."

    return None

# Helper: Send moderation notification to a user
def notify_moderation_action(forum_id, user_id, action, target_type, reason):
    forum = get_forum(forum_id)
    forum_name = forum["name"] if forum else "Unknown forum"

    if action == "remove":
        title = "Content removed in " + forum_name
        body = "Your " + target_type + " was removed"
        if reason:
            body = body + ": " + reason
    elif action == "approve":
        title = "Content approved in " + forum_name
        body = "Your " + target_type + " has been approved and is now visible"
    elif action == "restrict":
        title = "Restricted in " + forum_name
        body = "You have been restricted"
        if reason:
            body = body + ": " + reason
    elif action == "unrestrict":
        title = "Restriction lifted in " + forum_name
        body = "Your restriction has been removed"
    else:
        return

    topic = "moderation/restricted" if action in ("remove", "restrict") else "moderation/unrestricted"
    notify(topic, forum_id, title, body, "/forums/" + forum_id)

# Stream an entity's asset from its owning service via a Mochi stream.
# Location-transparent: mochi.remote.stream() loops back in-process when the
# entity lives on this server, or goes over P2P otherwise. Handles both binary
# assets (avatar/banner/favicon — header + bytes) and JSON assets
# (style/information — single JSON write with a "data" field).
def stream_asset(a, entity_id, service, asset):
	if not entity_id:
		a.error(404, asset + " unavailable", log=False)
		return None
	s = mochi.remote.stream(entity_id, service, asset, {})
	if not s:
		a.error(404, asset + " unavailable", log=False)
		return None
	header = s.read()
	if not header or header.get("status") != "200":
		a.error(404, asset + " not set", log=False)
		return None
	a.header("Cache-Control", "private, max-age=300")
	if "data" in header:
		return {"data": header["data"]}
	a.header("Content-Type", header.get("content_type", "application/octet-stream"))
	a.write.stream(s)
	return None

_PERSON_ASSETS = ("avatar", "banner", "favicon", "style", "information")

# Proxy a post author's person asset from the people service.
def action_post_asset(a):
	asset = a.input("asset")
	if asset not in _PERSON_ASSETS:
		a.error.label(404, "errors.unknown_asset")
		return
	row = mochi.db.row("select member from posts where id=?", a.input("post"))
	return stream_asset(a, row["member"] if row else "", "people", asset)

# Proxy a comment author's person asset from the people service.
def action_comment_asset(a):
	asset = a.input("asset")
	if asset not in _PERSON_ASSETS:
		a.error.label(404, "errors.unknown_asset")
		return
	row = mochi.db.row("select member from comments where id=?", a.input("comment"))
	return stream_asset(a, row["member"] if row else "", "people", asset)

VALID_SORTS = ["", "new", "hot", "top", "interests", "ai", "relevant"]

# Helper: Get post sort order based on sort type
def get_post_order(sort):
    if sort == "top":
        return "(up - down) desc, created desc"
    if sort == "hot":
        # score / (age_in_hours + 2)
        # We use string formatting because mochi.time.now() is a variable value at runtime
        # Use max(..., 1) to prevent divide by zero if created time is in the future due to clock skew
        return "((up - down) + 1) / max(((" + str(mochi.time.now()) + " - created) / 3600) + 2, 1) desc, created desc"
    # Default is "new" (also used as fallback for ai/interests/relevant which do post-query sorting)
    return "created desc"

# Validate and clean a tag label
def validate_tag(label):
    if not label:
        return None
    label = label.strip().lower()
    if not label or len(label) > 50:
        return None
    for ch in label.elems():
        if not (ch.isalpha() or ch.isdigit() or ch == " " or ch == "-" or ch == "/"):
            return None
    return label

# Check if a user can tag a post in a forum
def can_tag_post(user_id, forum, post):
    if forum.get("owner") == 1:
        return True
    if post.get("member") == user_id:
        return True
    if check_event_access(user_id, forum["id"], "moderate"):
        return True
    return False

# Default AI prompts
AI_PROMPT_TAG = "For each post:\n1. Extract the key entities and topics (up to 10), with canonical English names and relevance scores (0-100). Prefer well-known entities and broad topics that would have their own Wikipedia article (e.g. 'technology', 'sport', 'football') over compound phrases or niche terms. Prefer singular forms (e.g. 'sport' not 'sports'). Include specific names only when they are the central subject.\n2. Assign a novelty score (0-100) where 100 means unique and lower scores mean the post is a near-duplicate of a better version covering the same story.\n\nIf a post is an advertisement, deal, sponsored content, or product promotion, include 'advertising' as an entity with high relevance.\n\nIf the title uses clickbait patterns, include 'clickbait' as an entity with high relevance. Patterns: vague demonstratives ('this', 'these'), withholding ('you won't believe', 'what happened next', 'not what you think'), emotional bait ('will blow your mind', 'will shock you', 'changed my life'), affiliate language ('you need to know', 'we tested', 'we found').\n\nReturn JSON only:\n[{\"index\": 0, \"novelty\": 100, \"entities\": [{\"name\": \"Germany\", \"relevance\": 90}]}, ...]\n\nPosts:\n{{posts}}"
AI_PROMPT_SCORE = "Given a user's interests and a list of posts, score each post 0-100 based on relevance to the user.\n\nUser interests: {{interests}}\n\nPosts:\n{{posts}}\n\nReturn JSON only, one score per post in order:\n[{\"index\": 0, \"score\": 85}, ...]"

AI_PROMPT_DEFAULTS = {
    "tag": AI_PROMPT_TAG,
    "score": AI_PROMPT_SCORE,
}

# Get custom AI prompt for a forum entity, or return default
def get_ai_prompt(forum_id, prompt_type):
    col = "ai_prompt_" + prompt_type
    row = mochi.db.row("select " + col + " from forums where id=?", forum_id)
    if row and row.get(col, ""):
        return row[col]
    return AI_PROMPT_DEFAULTS.get(prompt_type, "")

# Parse unified tag response: [{"index": N, "novelty": N, "entities": [{"name": "...", "relevance": N}]}]
def parse_unified_tag_response(text):
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1])
    items = json.decode(text)
    if not items:
        return []
    result = []
    for item in items:
        idx = item.get("index", 0)
        novelty = item.get("novelty", 100)
        if type(novelty) not in ("int", "float"):
            novelty = 100
        novelty = int(novelty)
        if novelty < 0:
            novelty = 0
        if novelty > 100:
            novelty = 100
        entities = []
        for e in item.get("entities", []):
            name = e.get("name", "")
            relevance = e.get("relevance", 0)
            if not name or type(name) != "string":
                continue
            if type(relevance) not in ("int", "float"):
                continue
            relevance = int(relevance)
            if relevance < 0 or relevance > 100:
                continue
            entities.append({"name": name, "relevance": relevance})
        result.append({"index": idx, "novelty": novelty, "entities": entities[:10]})
    return result

# Parse AI tag response into validated list of {qid, relevance} dicts
def parse_ai_tags(text):
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1])
    items = json.decode(text)
    if not items:
        return []
    valid = []
    for item in items:
        name = item.get("name", "")
        relevance = item.get("relevance", 0)
        if not name or type(name) != "string":
            continue
        if type(relevance) not in ("int", "float"):
            continue
        relevance = int(relevance)
        if relevance < 0 or relevance > 100:
            continue
        valid.append({"name": name, "relevance": relevance})
    return valid[:10]

# Resolve AI account: 0 means use default AI account
def resolve_ai_account(ai_account):
    if ai_account > 0:
        return ai_account
    accounts = mochi.account.list("ai")
    if not accounts:
        return 0
    for acc in accounts:
        if "ai" in acc.get("default", "").split(","):
            return acc["id"]
    return accounts[0]["id"]

# Tag a post using AI, storing results as AI tags (unified prompt)
def ai_tag_post(forum_id, post_id):
    forum = mochi.db.row("select * from forums where id=?", forum_id)
    if not forum or forum.get("ai_mode", "") == "":
        return
    account = resolve_ai_account(forum.get("ai_account", 0))
    if account == 0:
        return
    post = mochi.db.row("select id, title, body from posts where id=?", post_id)
    if not post:
        return
    body = post["body"]
    if len(body) < 20:
        return
    title = post.get("title", "")
    text = (title + ": " + body).strip() if title else body
    if len(text) > 500:
        text = text[:500]
    post_text = "0. " + text.replace("\n", " ")
    prompt = get_ai_prompt(forum_id, "tag").replace("{{posts}}", post_text)
    result = mochi.ai.prompt(prompt, account=account)
    if result["status"] != 200:
        return
    items = parse_unified_tag_response(result["text"])
    if not items:
        return
    entry = items[0] if items else None
    if not entry:
        return
    entities = entry.get("entities", [])
    if not entities:
        return
    # Resolve each name to a Wikidata QID via search (skip tags with no QID)
    for item in entities:
        label = item["name"].lower()
        results = mochi.qid.search(item["name"], "en")
        if not results:
            continue
        qid = results[0]["qid"]
        tag_id = mochi.uid()
        mochi.db.execute(
            "insert or ignore into tags (id, object, label, qid, relevance, source) values (?, ?, ?, ?, ?, 'ai')",
            tag_id, post_id, label, qid, item["relevance"]
        )
        broadcast_event(forum_id, "tag/add", {"id": tag_id, "object": post_id, "label": label, "qid": qid, "relevance": item["relevance"], "source": "ai"})

# Scheduled event handler for AI tagging
def event_ai_tag(e):
    if e.source != "schedule":
        return
    forum_id = e.data.get("forum", "")
    post_id = e.data.get("post", "")
    if forum_id and post_id:
        ai_tag_post(forum_id, post_id)

# Set AI mode and account for a forum
def action_ai_settings(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return
    user_id = a.user.identity.id
    forum_id = a.input("forum")
    mode = a.input("mode", "")
    account = int(a.input("account", "0"))
    forum = get_forum(forum_id)
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return
    if forum.get("owner") != 1:
        a.error.label(403, "errors.not_allowed")
        return
    if mode not in ("", "tag"):
        a.error.label(400, "errors.invalid_ai_mode")
        return
    if account > 0:
        accounts = mochi.account.list("ai")
        found = False
        for acc in accounts:
            if acc["id"] == account:
                found = True
                break
        if not found:
            a.error.label(400, "errors.ai_account_not_found")
            return
    mochi.db.execute("update forums set ai_mode=?, ai_account=? where id=?", mode, account, forum["id"])
    return {"data": {"ok": True}}

# Get custom AI prompts for a forum
def action_ai_prompts_get(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return
    forum_id = a.input("forum")
    forum = get_forum(forum_id)
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return
    if forum.get("owner") != 1:
        a.error.label(403, "errors.not_allowed")
        return
    prompts = {}
    if forum.get("ai_prompt_tag", ""):
        prompts["tag"] = forum["ai_prompt_tag"]
    if forum.get("ai_prompt_score", ""):
        prompts["score"] = forum["ai_prompt_score"]
    return {"data": {"prompts": prompts, "defaults": AI_PROMPT_DEFAULTS}}

# Set custom AI prompts for a forum
def action_ai_prompts_set(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return
    forum_id = a.input("forum")
    forum = get_forum(forum_id)
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return
    if forum.get("owner") != 1:
        a.error.label(403, "errors.not_allowed")
        return
    prompt_type = a.input("type")
    prompt_text = a.input("prompt", "")
    if prompt_type not in ("tag", "score"):
        a.error.label(400, "errors.invalid_prompt_type")
        return
    col = "ai_prompt_" + prompt_type
    mochi.db.execute("update forums set " + col + "=? where id=?", prompt_text, forum["id"])
    return {"data": {"ok": True}}

# List tags for a post
def action_tags_list(a):
    post_id = a.input("post")
    if not post_id:
        a.error.label(400, "errors.missing_post")
        return
    tags = enrich_tags(mochi.db.rows("select id, label, qid, source, relevance from tags where object=?", post_id) or [], get_interest_map())
    return {"data": {"tags": tags}}

# Add a tag to a post
def action_tags_add(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return
    user_id = a.user.identity.id
    forum_id = a.input("forum")
    post_id = a.input("post")
    label = a.input("label")

    forum = get_forum(forum_id)
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    post = mochi.db.row("select * from posts where id=? and forum=?", post_id, forum["id"])
    if not post:
        a.error.label(404, "errors.post_not_found")
        return

    if not can_tag_post(user_id, forum, post):
        a.error.label(403, "errors.not_allowed_to_tag_posts")
        return

    label = validate_tag(label)
    if not label:
        a.error.label(400, "errors.invalid_tag")
        return

    # Deduplicate
    existing = mochi.db.row("select id, label from tags where object=? and label=?", post_id, label)
    if existing:
        return {"data": existing}

    tag_id = mochi.uid()
    mochi.db.execute("insert into tags (id, object, label) values (?, ?, ?)", tag_id, post_id, label)

    # Broadcast to subscribers via WebSocket (not P2P, which requires entity ownership)
    broadcast_websocket(forum["id"], {"type": "tag/add", "forum": forum["id"], "post": post_id, "tag": {"id": tag_id, "label": label, "source": "manual"}, "sender": user_id})

    # Update user interests from the manually added tag
    update_interests_from_manual_tag(label)

    return {"data": {"id": tag_id, "label": label, "source": "manual"}}

# Remove a tag from a post
def action_tags_remove(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return
    user_id = a.user.identity.id
    forum_id = a.input("forum")
    post_id = a.input("post")
    tag_id = a.input("tag")

    forum = get_forum(forum_id)
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    post = mochi.db.row("select * from posts where id=? and forum=?", post_id, forum["id"])
    if not post:
        a.error.label(404, "errors.post_not_found")
        return

    if not can_tag_post(user_id, forum, post):
        a.error.label(403, "errors.not_allowed_to_remove_tags")
        return

    mochi.db.execute("delete from tags where id=? and object=?", tag_id, post_id)

    # Broadcast to subscribers via WebSocket (not P2P, which requires entity ownership)
    broadcast_websocket(forum["id"], {"type": "tag/remove", "forum": forum["id"], "post": post_id, "tag": tag_id, "sender": user_id})

    return {"data": {"ok": True}}

# List all tags used in a forum with counts
def action_forum_tags(a):
    forum_id = a.input("forum")
    if not forum_id:
        a.error.label(400, "errors.missing_forum")
        return

    forum = get_forum(forum_id)
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    tags = mochi.db.rows("select label, count(*) as count from tags where object in (select id from posts where forum=?) group by label order by count desc", forum["id"]) or []
    return {"data": {"tags": tags}}

# ACTIONS

# Info endpoint for class context - returns list of forums
def action_info_class(a):
    forums = mochi.db.rows("select * from forums order by updated desc")

    # Add fingerprints and permissions for owned forums (no P2P calls)
    for f in forums:
        f["fingerprint"] = mochi.entity.fingerprint(f["id"])
        is_owner = f.get("owner") == 1
        if is_owner:
            f["can_manage"] = check_access(a, f["id"], "manage")
            f["can_moderate"] = check_access(a, f["id"], "moderate")
        # For subscribed forums, permissions require P2P - skip here for speed

    settings = mochi.db.row("select sort from settings where id=1") or {"sort": ""}

    return {"data": {"entity": False, "forums": forums, "settings": settings}}

# Info endpoint for entity context - returns forum info with permissions
def action_info_entity(a):
    forum_id = a.input("forum")
    if not forum_id:
        a.error.label(400, "errors.forum_id_required")
        return

    forum = get_forum(forum_id)
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    is_owner = forum.get("owner") == 1
    user_id = a.user.identity.id if a.user else None

    # Determine permissions for current user
    if is_owner:
        can_manage = check_access(a, forum["id"], "manage")
        can_post = check_access(a, forum["id"], "post")
    elif user_id:
        can_manage = False
        # Query owner for post access
        access_response = mochi.remote.request(forum["id"], "forums", "access/check", {
            "operations": ["post"],
            "user": user_id,
        })
        can_post = access_response.get("post", False)
    else:
        can_manage = False
        can_post = False

    permissions = {
        "view": True,
        "post": can_post,
        "manage": can_manage,
    }

    # Render banner markdown to HTML
    banner = forum.get("banner", "")
    if banner:
        forum["banner_html"] = mochi.text.markdown(banner)

    raw = mochi.entity.fingerprint(forum["id"])
    fp = raw[:3] + "-" + raw[3:6] + "-" + raw[6:]

    return {"data": {
        "entity": True,
        "forum": forum,
        "permissions": permissions,
        "fingerprint": fp
    }}

# View a forum or list all forums
def action_view(a):
    forum_id = a.input("forum")
    server = a.input("server")
    user_id = a.user.identity.id if a.user else None

    if forum_id:
        forum = get_forum(forum_id)
        sort = a.input("sort") or "new"
        tags = a.inputs("tag")

        # Use the full entity ID from the database if we found the forum
        entity_id = forum["id"] if forum else forum_id

        # Only fetch remotely if we don't have the forum locally at all
        # Subscribed forums have local data via push sync
        is_remote = not forum

        # For remote forums, fetch via P2P
        if is_remote:
            if not user_id:
                a.error.label(401, "errors.not_logged_in")
                return

            # Can only fetch remote forums if we have a full entity ID (49-51 chars)
            # Fingerprints (9 chars) can't be used for P2P addressing
            if len(entity_id) < 49:
                a.error.label(404, "errors.forum_not_found")
                return

            # Connect to specified server, or use directory lookup
            peer = mochi.remote.peer(server) if server else None
            if server and not peer:
                a.error.label(502, "errors.unable_to_connect_to_server")
                return

            # Request forum data via P2P
            response = mochi.remote.request(entity_id, "forums", "view", {"forum": entity_id, "sort": sort}, peer)
            if response.get("error"):
                a.error(response.get("code", 403), response["error"])
                return

            # Return remote data in same format as local view
            return {
                "data": {
                    "forum": {
                        "id": entity_id,
                        "name": response.get("name", forum["name"] if forum else ""),
                        "fingerprint": response.get("fingerprint", mochi.entity.fingerprint(entity_id)),
                        "members": 0,
                        "updated": 0,
                        "can_manage": False,
                        "can_post": response.get("can_post", False),
                        "banner": response.get("banner", ""),
                        "banner_html": response.get("banner_html", ""),
                    },
                    "posts": response.get("posts", []),
                    "member": None,
                    "can_manage": False,
                    "can_moderate": response.get("can_moderate", False),
                    "hasMore": False,
                    "nextCursor": None,
                    "remote": True,
                    "server": server,
                }
            }

        if not forum:
            a.error.label(404, "errors.forum_not_found")
            return

        is_owner = forum.get("owner") == 1
        forum["fingerprint"] = mochi.entity.fingerprint(forum["id"])
        # Render banner markdown to HTML
        banner = forum.get("banner", "")
        if banner:
            forum["banner_html"] = mochi.text.markdown(banner)

        # Get member info if user is logged in
        member = None
        if a.user:
            member = mochi.db.row("select * from members where forum=? and id=?", forum["id"], a.user.identity.id)

        # Pagination parameters
        limit_str = a.input("limit")
        before_str = a.input("before")
        limit = 20
        if limit_str and mochi.text.valid(limit_str, "natural"):
            limit = min(int(limit_str), 100)
        before = None
        if before_str and mochi.text.valid(before_str, "natural"):
            before = int(before_str)

        # Determine access permissions
        # For subscribed forums, do one P2P round-trip to check all permissions at once
        can_post = False
        can_moderate = False
        if is_owner:
            can_moderate = check_access(a, forum["id"], "moderate")
        elif user_id:
            access_response = mochi.remote.request(forum["id"], "forums", "access/check", {
                "operations": ["post", "moderate"],
                "user": user_id,
            })
            can_post = access_response.get("post", False)
            can_moderate = access_response.get("moderate", False)

        # Get posts order
        order_by = get_post_order(sort)

        # Get posts for this forum with pagination
        # Moderators see all posts; regular users see only approved or their own pending
        if len(tags) > 0:
            # Tag-filtered queries (AND logic — posts must have all specified tags)
            valid_tags = []
            for t in tags:
                vt = validate_tag(t)
                if vt:
                    valid_tags.append(vt)
            if len(valid_tags) == 0:
                posts = []
            else:
                p_order = order_by.replace("created", "p.created").replace("updated", "p.updated").replace("pinned", "p.pinned").replace("up", "p.up").replace("down", "p.down")
                placeholders = ", ".join(["?" for _ in valid_tags])
                tag_filter = "(select count(*) from tags t where t.object = p.id and lower(t.label) in (" + placeholders + ")) = " + str(len(valid_tags))
                if can_moderate:
                    if before:
                        posts = mochi.db.rows("select p.* from posts p where p.forum=? and " + tag_filter + " and p.updated<? order by p.pinned desc, " + p_order + " limit ?",
                            forum["id"], valid_tags, before, limit + 1)
                    else:
                        posts = mochi.db.rows("select p.* from posts p where p.forum=? and " + tag_filter + " order by p.pinned desc, " + p_order + " limit ?",
                            forum["id"], valid_tags, limit + 1)
                else:
                    if before:
                        posts = mochi.db.rows("select p.* from posts p where p.forum=? and " + tag_filter + " and p.updated<? and (p.status='approved' or (p.status='pending' and p.member=?)) order by p.pinned desc, " + p_order + " limit ?",
                            forum["id"], valid_tags, before, user_id or "", limit + 1)
                    else:
                        posts = mochi.db.rows("select p.* from posts p where p.forum=? and " + tag_filter + " and (p.status='approved' or (p.status='pending' and p.member=?)) order by p.pinned desc, " + p_order + " limit ?",
                            forum["id"], valid_tags, user_id or "", limit + 1)
        elif can_moderate:
            if before:
                posts = mochi.db.rows("select * from posts where forum=? and updated<? order by pinned desc, " + order_by + " limit ?",
                    forum["id"], before, limit + 1)
            else:
                posts = mochi.db.rows("select * from posts where forum=? order by pinned desc, " + order_by + " limit ?",
                    forum["id"], limit + 1)
        else:
            # Regular users see approved posts or their own pending posts
            if before:
                posts = mochi.db.rows("select * from posts where forum=? and updated<? and (status='approved' or (status='pending' and member=?)) order by pinned desc, " + order_by + " limit ?",
                    forum["id"], before, user_id or "", limit + 1)
            else:
                posts = mochi.db.rows("select * from posts where forum=? and (status='approved' or (status='pending' and member=?)) order by pinned desc, " + order_by + " limit ?",
                    forum["id"], user_id or "", limit + 1)

        # Check if there are more posts (we fetched limit+1)
        has_more = len(posts) > limit
        if has_more:
            posts = posts[:limit]

        im = get_interest_map()
        for p in posts:
            p["fingerprint"] = forum.get("fingerprint") or mochi.entity.fingerprint(p["forum"])
            p["body_markdown"] = mochi.text.markdown(p["body"])
            p["attachments"] = mochi.attachment.list(p["id"], forum["id"])
            # Fetch attachments from forum owner if we don't have them locally
            if not p["attachments"] and forum.get("owner") != 1:
                p["attachments"] = mochi.attachment.fetch(p["id"], forum["id"])
            # Get comment COUNT for post list (full comments loaded on thread view)
            if can_moderate:
                row = mochi.db.row("select count(*) as cnt from comments where forum=? and post=?",
                    forum["id"], p["id"])
            else:
                row = mochi.db.row("select count(*) as cnt from comments where forum=? and post=? and (status='approved' or (status='pending' and member=?))",
                    forum["id"], p["id"], user_id or "")
            p["comments"] = row["cnt"] if row else 0
            p["tags"] = enrich_tags(mochi.db.rows("select id, label, qid, source, relevance from tags where object=?", p["id"]) or [], im)
            # Get user's vote on this post
            if user_id:
                pv = mochi.db.row("select vote from votes where post=? and comment='' and voter=?", p["id"], user_id)
                p["user_vote"] = pv["vote"] if pv else ""

        # Calculate next cursor
        next_cursor = None
        if has_more and len(posts) > 0:
            next_cursor = posts[-1]["updated"]

        # Re-rank by relevance if requested (ai = with AI reranking, interests = formula only)
        matches_info = []
        if sort in ("relevant", "ai", "interests") and user_id:
            posts, matches_info = score_posts_relevant(posts, forum, sort)

        # Clean up internal scoring fields and extract match info
        # Collect all match QIDs to resolve labels in one batch
        all_match_qids = []
        for p in posts:
            if "_matches" in p:
                for m in p["_matches"]:
                    if m["qid"] not in all_match_qids:
                        all_match_qids.append(m["qid"])
        match_labels = mochi.qid.lookup(all_match_qids, "en") if all_match_qids else {}
        for p in posts:
            if "_matches" in p:
                matches = p.pop("_matches")
                for m in matches:
                    m["label"] = match_labels.get(m["qid"], m["qid"]) if type(match_labels) == type({}) else m["qid"]
                p["matches"] = matches
            if "_score" in p:
                p.pop("_score")

        # Add access flags to forum object (is_owner already set above)
        if is_owner:
            forum["can_manage"] = check_access(a, forum["id"], "manage")
            forum["can_post"] = check_access(a, forum["id"], "post")
            forum["can_moderate"] = can_moderate
        else:
            forum["can_manage"] = False
            forum["can_post"] = can_post
            forum["can_moderate"] = can_moderate

        has_ai = resolve_ai_account(0) > 0 if user_id else False

        result = {
            "data": {
                "forum": forum,
                "posts": posts,
                "member": member,
                "can_manage": forum["can_manage"],
                "can_moderate": can_moderate,
                "hasMore": has_more,
                "nextCursor": next_cursor,
                "hasAi": has_ai,
            }
        }

        # Add hint if relevance sort was requested but no interests exist
        if sort in ("relevant", "ai", "interests") and not matches_info:
            result["data"]["relevantFallback"] = True

        return result
    else:
        # List all forums
        sort = a.input("sort") or "new"
        order_by = get_post_order(sort)

        forums = mochi.db.rows("select * from forums order by updated desc")
        # Only show approved posts or user's own pending posts
        if user_id:
            posts = mochi.db.rows("select * from posts where status='approved' or (status='pending' and member=?) order by pinned desc, " + order_by, user_id)
        else:
            posts = mochi.db.rows("select * from posts where status='approved' order by pinned desc, " + order_by)

        # Add fingerprint and access flags to each forum
        # For owned forums, check locally. For subscribed forums, skip remote
        # access check (too slow for list view) - permissions checked on forum view
        for f in forums:
            f["fingerprint"] = mochi.entity.fingerprint(f["id"])
            f_is_owner = f.get("owner") == 1
            if f_is_owner:
                f["can_manage"] = check_access(a, f["id"], "manage")
                f["can_post"] = check_access(a, f["id"], "post")
                f["can_moderate"] = check_access(a, f["id"], "moderate")
            else:
                # Subscribers can never manage; defer post/moderate checks to forum view
                f["can_manage"] = False
                f["can_post"] = False
                f["can_moderate"] = False

        # Build forum lookup map for O(1) access
        forum_map = {f["id"]: f for f in forums}

        im = get_interest_map()
        for p in posts:
            # Get attachments for this post (local only - skip remote fetch for speed)
            p["body_markdown"] = mochi.text.markdown(p["body"])
            p["attachments"] = mochi.attachment.list(p["id"], p["forum"])
            # Find the forum for this post and add fingerprint
            forum = forum_map.get(p["forum"])
            p["fingerprint"] = forum["fingerprint"] if forum else mochi.entity.fingerprint(p["forum"])
            # Get comment COUNT only for list view (not full comments)
            if user_id:
                row = mochi.db.row("select count(*) as cnt from comments where forum=? and post=? and (status='approved' or (status='pending' and member=?))",
                    p["forum"], p["id"], user_id)
            else:
                row = mochi.db.row("select count(*) as cnt from comments where forum=? and post=? and status='approved'",
                    p["forum"], p["id"])
            p["comments"] = row["cnt"] if row else 0
            p["tags"] = enrich_tags(mochi.db.rows("select id, label, qid, source, relevance from tags where object=?", p["id"]) or [], im)
            # Get user's vote on this post
            if user_id:
                pv = mochi.db.row("select vote from votes where post=? and comment='' and voter=?", p["id"], user_id)
                p["user_vote"] = pv["vote"] if pv else ""

        has_ai = resolve_ai_account(0) > 0 if user_id else False
        settings = mochi.db.row("select sort from settings where id=1") or {"sort": ""}

        return {
            "data": {
                "forums": forums,
                "posts": posts,
                "hasAi": has_ai,
                "settings": settings,
            }
        }

# Create new forum
def action_create(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    name = a.input("name")
    if not mochi.text.valid(name, "name"):
        a.error.label(400, "errors.invalid_name")
        return

    privacy = a.input("privacy") or "public"
    if privacy not in ["public", "private"]:
        a.error.label(400, "errors.invalid_privacy_setting")
        return

    # Create entity for the forum
    entity_id = mochi.entity.create("forum", name, privacy, "")
    if not entity_id:
        a.error.label(500, "errors.failed_to_create_forum_entity")
        return

    # Create forum record
    now = mochi.time.now()
    fp = mochi.entity.fingerprint(entity_id) or ""
    mochi.db.execute("replace into forums ( id, name, members, updated, owner, fingerprint ) values ( ?, ?, ?, ?, 1, ? )",
        entity_id, name, 1, now, fp)

    # Add creator as subscriber (they have implicit manage access as entity owner)
    mochi.db.execute("replace into members ( forum, id, name, subscribed ) values ( ?, ?, ?, ? )",
        entity_id, a.user.identity.id, a.user.identity.name, now)

    # Set default access rules
    resource = "forum/" + entity_id
    creator = a.user.identity.id
    mochi.access.allow(creator, resource, "*", creator)  # Creator has full access
    mochi.access.allow("+", resource, "post", creator)   # Authenticated users can post
    mochi.access.allow("*", resource, "view", creator)   # Anyone can view

    return {
        "data": {"id": entity_id, "fingerprint": mochi.entity.fingerprint(entity_id)}
    }

# Form for new forum
def action_new(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return
    return {
        "data": {}
    }

# Create new post
def action_post_create(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum_id = a.input("forum")
    forum = get_forum(forum_id)

    title = a.input("title")
    if not mochi.text.valid(title, "name"):
        a.error.label(400, "errors.invalid_title")
        return

    body = a.input("body")
    if not mochi.text.valid(body, "text"):
        a.error.label(400, "errors.invalid_body")
        return

    user_id = a.user.identity.id
    user_name = a.user.identity.name
    id = mochi.uid()
    now = mochi.time.now()

    # Check if forum exists locally
    if forum:
        # Check if we own this forum
        is_owner = forum.get("owner") == 1

        if is_owner:
            # Owner processes locally
            if not check_access(a, forum["id"], "post"):
                a.error.label(403, "errors.not_allowed_to_post")
                return

            # Check for restrictions
            restriction_error = check_restriction(forum["id"], user_id, "post")
            if restriction_error:
                a.error(403, restriction_error)
                return

            # Check rate limit (skip for moderators)
            if not check_access_remote(a, forum["id"], "moderate"):
                rate_error = check_rate_limit(forum, user_id, "post")
                if rate_error:
                    a.error(429, rate_error)
                    return

            # Determine initial status (moderators skip pre-moderation)
            status = "approved"
            if is_shadowbanned(forum["id"], user_id):
                status = "removed"
            elif not check_access(a, forum["id"], "moderate") and requires_premoderation(forum, user_id, "post"):
                status = "pending"

            mochi.db.execute("replace into posts ( id, forum, member, name, title, body, status, created, updated ) values ( ?, ?, ?, ?, ?, ?, ?, ?, ? )",
                id, forum["id"], user_id, user_name, title, body, status, now, now)

            mochi.db.execute("update forums set updated=? where id=?", now, forum["id"])

            # Get members for notification (excluding sender)
            members = mochi.db.rows("select id from members where forum=? and id!=?", forum["id"], user_id)

            # Save any uploaded attachments locally
            attachments = mochi.attachment.save(id, "attachments", [], [], [])

            # Only broadcast if approved
            if status == "approved":
                post_data = {
                    "id": id,
                    "member": user_id,
                    "name": user_name,
                    "title": title,
                    "body": body,
                    "created": now
                }
                if attachments:
                    post_data["attachments"] = [{"id": att["id"], "name": att["name"], "size": att["size"], "content_type": att.get("type", ""), "rank": att.get("rank", 0), "created": att.get("created", now)} for att in attachments]

                broadcast_event(forum["id"], "post/create", post_data, user_id)
                broadcast_websocket(forum["id"], {"type": "post/create", "forum": forum["id"], "post": id, "sender": user_id})
                if body:
                    notify_mentions(forum["id"], id, body, user_id, user_name)

                # Schedule AI tagging
                if forum.get("ai_mode", ""):
                    mochi.schedule.after("ai/tag", {"forum": forum["id"], "post": id}, 0)
        else:
            # We're a subscriber - check access with owner first
            access_response = mochi.remote.request(forum["id"], "forums", "access/check", {
                "operations": ["post"],
                "user": user_id,
            })
            if not access_response.get("post", False):
                a.error(403, access_response.get("error", "Not allowed to post"))
                return

            # Save attachments locally
            attachments = mochi.attachment.save(id, "attachments", [], [], [])

            submit_data = {"id": id, "title": title, "body": body}
            if attachments:
                submit_data["attachments"] = [{"id": att["id"], "name": att["name"], "size": att["size"], "content_type": att.get("type", ""), "rank": att.get("rank", 0), "created": att.get("created", now)} for att in attachments]

            mochi.message.send(
                {"from": user_id, "to": forum["id"], "service": "forums", "event": "post/submit"},
                submit_data
            )

            # Save locally for optimistic UI (status pending until owner confirms)
            mochi.db.execute("replace into posts ( id, forum, member, name, title, body, status, created, updated ) values ( ?, ?, ?, ?, ?, ?, 'pending', ?, ? )",
                id, forum["id"], user_id, user_name, title, body, now, now)

        return {
            "data": {"forum": forum["id"], "post": id}
        }

    # Forum not found locally - send to remote forum
    if not mochi.text.valid(forum_id, "entity"):
        a.error.label(404, "errors.forum_not_found")
        return

    # Check access with remote forum owner
    access_response = mochi.remote.request(forum_id, "forums", "access/check", {
        "operations": ["post"],
        "user": user_id,
    })
    if not access_response.get("post", False):
        a.error(403, access_response.get("error", "Not allowed to post"))
        return

    # Save attachments locally
    attachments = mochi.attachment.save(id, "attachments", [], [], [])

    # Send post to remote forum owner with attachment metadata
    submit_data = {"id": id, "title": title, "body": body}
    if attachments:
        submit_data["attachments"] = [{"id": att["id"], "name": att["name"], "size": att["size"], "content_type": att.get("type", ""), "rank": att.get("rank", 0), "created": att.get("created", now)} for att in attachments]

    mochi.message.send(
        {"from": user_id, "to": forum_id, "service": "forums", "event": "post/submit"},
        submit_data
    )

    return {
        "data": {"forum": forum_id, "post": id}
    }

# Form for new post
def action_post_new(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    if not check_access(a, forum["id"], "post"):
        a.error.label(403, "errors.not_allowed_to_post")
        return

    return {
        "data": {"forum": forum}
    }

# Search for forums
# Supports searching by name, entity ID, fingerprint (with or without hyphens), or URL
def action_search(a):
    search = a.input("search", "").strip()
    if not search:
        return {"data": {"results": []}}

    results = []

    # Check if search term is an entity ID (49-51 word characters)
    if mochi.text.valid(search, "entity"):
        entry = mochi.directory.get(search)
        if entry and entry.get("class") == "forum":
            results.append(entry)

    # Check if search term is a fingerprint (9 alphanumeric, with or without hyphens)
    fingerprint = search.replace("-", "")
    if mochi.text.valid(fingerprint, "fingerprint"):
        matches = mochi.directory.search("forum", "", True, fingerprint=fingerprint)
        for entry in matches:
            found = False
            for r in results:
                if r.get("id") == entry.get("id"):
                    found = True
                    break
            if not found:
                results.append(entry)

    # Check if search term is a URL (e.g., https://example.com/forums/ENTITY_ID)
    if search.startswith("http://") or search.startswith("https://"):
        # Extract entity ID from URL
        url = search
        if "/forums/" in url:
            parts = url.split("/forums/", 1)
            forum_path = parts[1]
            # Handle query parameter format: ?forum=ENTITY_ID
            if forum_path.startswith("?forum="):
                forum_id = forum_path[7:]
                if "&" in forum_id:
                    forum_id = forum_id.split("&")[0]
                if "#" in forum_id:
                    forum_id = forum_id.split("#")[0]
            else:
                # Path format: /forums/ENTITY_ID or /forums/ENTITY_ID/...
                forum_id = forum_path.split("/")[0] if "/" in forum_path else forum_path
                if "?" in forum_id:
                    forum_id = forum_id.split("?")[0]
                if "#" in forum_id:
                    forum_id = forum_id.split("#")[0]

            if mochi.text.valid(forum_id, "entity"):
                entry = mochi.directory.get(forum_id)
                if entry and entry.get("class") == "forum":
                    # Avoid duplicates
                    found = False
                    for r in results:
                        if r.get("id") == entry.get("id"):
                            found = True
                            break
                    if not found:
                        results.append(entry)
            # Try as fingerprint
            elif mochi.text.valid(forum_id, "fingerprint"):
                all_forums = mochi.directory.search("forum", "", True)
                for entry in all_forums:
                    entry_fp = entry.get("fingerprint", "").replace("-", "")
                    if entry_fp == forum_id.replace("-", ""):
                        found = False
                        for r in results:
                            if r.get("id") == entry.get("id"):
                                found = True
                                break
                        if not found:
                            results.append(entry)
                        break

    # Also search by name
    name_results = mochi.directory.search("forum", search, True)
    for entry in name_results:
        # Avoid duplicates
        found = False
        for r in results:
            if r.get("id") == entry.get("id"):
                found = True
                break
        if not found:
            results.append(entry)

    # Annotate results with subscription status from local members table.
    # Directory entries may be frozen dicts, so copy before adding fields.
    if a.user and results:
        user_id = a.user.identity.id
        annotated = []
        for entry in results:
            entry_id = entry.get("id", "")
            if entry_id and mochi.db.exists("select id from members where forum=? and id=?", entry_id, user_id):
                e = dict(entry)
                e["subscribed"] = True
                annotated.append(e)
            else:
                annotated.append(entry)
        results = annotated

    return {"data": {"results": results}}

# Get recommended forums from the recommendations service
def action_recommendations(a):
    # Get user's existing forums (owned or subscribed)
    existing_ids = set()
    forums = mochi.db.rows("select id from forums")
    for f in forums:
        existing_ids.add(f["id"])

    # Connect to recommendations service
    s = mochi.remote.stream("1JYmMpQU7fxvTrwHpNpiwKCgUg3odWqX7s9t1cLswSMAro5M2P", "recommendations", "list", {"type": "forum", "language": "en"})
    if not s:
        return {"status": 500, "error": "Unable to connect to the recommendations service", "data": {"forums": []}}

    r = s.read()
    if r.get("status") != "200":
        return {"status": 500, "error": "Unable to connect to the recommendations service", "data": {"forums": []}}

    recommendations = []
    items = s.read()
    if type(items) not in ["list", "tuple"]:
        return {"data": {"forums": []}}

    # Get the server location from the recommendations entity so subscribers can reach the forums
    rec_dir = mochi.directory.get("1JYmMpQU7fxvTrwHpNpiwKCgUg3odWqX7s9t1cLswSMAro5M2P")
    rec_server = ""
    if rec_dir:
        rec_server = rec_dir.get("location", "")

    for item in items:
        entity_id = item.get("entity", "")
        if entity_id and entity_id not in existing_ids:
            recommendations.append({
                "id": entity_id,
                "name": item.get("name", ""),
                "blurb": item.get("blurb", ""),
                "fingerprint": mochi.entity.fingerprint(entity_id),
                "server": rec_server,
            })

    return {"data": {"forums": recommendations}}

# Probe a remote forum by URL
def action_probe(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    user_id = a.user.identity.id

    url = a.input("url")
    if not url:
        a.error.label(400, "errors.no_url_provided")
        return

    # Parse URL to extract server and forum ID
    # Expected formats:
    #   https://example.com/forums/ENTITY_ID
    #   https://example.com/forums/?forum=ENTITY_ID
    #   http://example.com/forums/ENTITY_ID
    #   example.com/forums/ENTITY_ID
    server = ""
    forum_id = ""
    protocol = "https://"

    # Extract and preserve protocol prefix
    if url.startswith("https://"):
        protocol = "https://"
        url = url[8:]
    elif url.startswith("http://"):
        protocol = "http://"
        url = url[7:]

    # Split by /forums/ to get server and forum ID
    if "/forums/" in url:
        parts = url.split("/forums/", 1)
        server = protocol + parts[0]
        # Forum ID is everything after /forums/ up to next / or end
        forum_path = parts[1]

        # Handle query parameter format: ?forum=ENTITY_ID
        if forum_path.startswith("?forum="):
            forum_id = forum_path[7:]  # Remove "?forum="
            # Strip any additional query params or fragments
            if "&" in forum_id:
                forum_id = forum_id.split("&")[0]
            if "#" in forum_id:
                forum_id = forum_id.split("#")[0]
        elif "/" in forum_path:
            forum_id = forum_path.split("/")[0]
        else:
            forum_id = forum_path
            # Strip any query params or fragments from path format
            if "?" in forum_id:
                forum_id = forum_id.split("?")[0]
            if "#" in forum_id:
                forum_id = forum_id.split("#")[0]
    else:
        a.error.label(400, "errors.invalid_url_format_expected_https_server_forums_forum_id")
        return

    if not server or server == protocol:
        a.error.label(400, "errors.could_not_extract_server_from_url")
        return

    if not forum_id or (not mochi.text.valid(forum_id, "entity") and not mochi.text.valid(forum_id, "fingerprint")):
        a.error.label(400, "errors.could_not_extract_valid_forum_id_from_url")
        return

    # Connect to server and query forum info
    peer = mochi.remote.peer(server)
    if not peer:
        a.error.label(502, "errors.unable_to_connect_to_server")
        return

    response = mochi.remote.request(forum_id, "forums", "info", {"forum": forum_id}, peer)
    if response.get("error"):
        a.error(404, response.get("error", "Forum not found"))
        return

    # Return forum info as a directory-like entry
    return {"data": {
        "id": forum_id,
        "name": response.get("name", ""),
        "fingerprint": response.get("fingerprint", ""),
        "class": "forum",
        "server": server,
    }}

# Edit forum members
def action_members_edit(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    if not check_access(a, forum["id"], "manage"):
        a.error.label(403, "errors.not_allowed")
        return

    members = mochi.db.rows("select * from members where forum=?", forum["id"])

    return {
        "data": {
            "forum": forum,
            "members": members
        }
    }

def action_member_search(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return
    forum = get_forum(a.input("forum"))
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return
    query = (a.input("q") or "").lower().strip()
    if query:
        escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        members = mochi.db.rows(
            "select id, name from members where forum=? and lower(name) like ? escape '\\'",
            forum["id"], "%" + escaped + "%")
    else:
        members = mochi.db.rows("select id, name from members where forum=?", forum["id"])
    return {"data": {"members": members[:20]}}

# Save forum members (deprecated - use access endpoints instead)
# Kept for removing members from the forum
def action_members_save(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    if not check_access(a, forum["id"], "manage"):
        a.error.label(403, "errors.not_allowed")
        return

    # Handle member removal
    remove_id = a.input("remove")
    if remove_id and remove_id != a.user.identity.id:
        # Clean up member's votes and adjust comment vote counts
        votes = mochi.db.rows("select comment, vote from votes where forum=? and voter=?", forum["id"], remove_id)
        for v in votes:
            if v["vote"] == "up":
                mochi.db.execute("update comments set up=up-1 where id=? and up>0", v["comment"])
            elif v["vote"] == "down":
                mochi.db.execute("update comments set down=down-1 where id=? and down>0", v["comment"])
        mochi.db.execute("delete from votes where forum=? and voter=?", forum["id"], remove_id)
        # Remove from members table
        mochi.db.execute("delete from members where forum=? and id=?", forum["id"], remove_id)
        # Revoke all access
        resource = "forum/" + forum["id"]
        for op in ACCESS_LEVELS + ["manage", "*"]:
            mochi.access.revoke(remove_id, resource, op)

    # Update member count
    members = mochi.db.rows("select id from members where forum=?", forum["id"])
    mochi.db.execute("update forums set members=?, updated=? where id=?", len(members), mochi.time.now(), forum["id"])

    # Broadcast updated member count
    broadcast_event(forum["id"], "update", {"members": len(members)}, a.user.identity.id)

    return {
        "data": {"forum": forum}
    }

# Clear notifications for a specific forum
def action_notifications_clear(a):
    if not a.user:
        return
    forum = get_forum(a.input("forum"))
    if forum:
        mochi.service.call("notifications", "clear/object", "forums", forum["id"])

def action_sort_set_default(a):
    """Set the user's default post sort (applied to All forums and to forums with no override)."""
    if not a.user:
        a.error.label(401, "errors.authentication_required")
        return
    sort = a.input("sort", "")
    if sort not in VALID_SORTS:
        a.error.label(400, "errors.invalid_sort")
        return
    mochi.db.execute("update settings set sort=? where id=1", sort)
    return {"data": {"sort": sort}}

def action_sort_set_forum(a):
    """Set the post sort for a specific forum (empty string clears the override)."""
    if not a.user:
        a.error.label(401, "errors.authentication_required")
        return
    forum = get_forum(a.input("forum"))
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return
    sort = a.input("sort", "")
    if sort not in VALID_SORTS:
        a.error.label(400, "errors.invalid_sort")
        return
    mochi.db.execute("update forums set sort=? where id=?", sort, forum["id"])
    return {"data": {"sort": sort}}

# Subscribe to a forum
def action_subscribe(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum_id = a.input("forum")
    server = a.input("server")

    if not mochi.text.valid(forum_id, "entity"):
        a.error.label(400, "errors.invalid_id")
        return

    # Check if already subscribed
    if mochi.db.exists("select id from members where forum=? and id=?", forum_id, a.user.identity.id):
        return {
            "data": {"already_subscribed": True}
        }

    # Get forum info from remote server or directory
    schema = None
    if server:
        peer = mochi.remote.peer(server)
        if not peer:
            a.error.label(502, "errors.unable_to_connect_to_server")
            return
        response = mochi.remote.request(forum_id, "forums", "info", {"forum": forum_id}, peer)
        if response.get("error"):
            a.error(response.get("code", 404), response["error"])
            return
        forum_name = response.get("name", "")
        schema = mochi.remote.request(forum_id, "forums", "schema", {}, peer)
    else:
        # Use directory lookup when no server specified
        directory = mochi.directory.get(forum_id)
        if not directory:
            a.error.label(404, "errors.forum_not_found_in_directory")
            return
        forum_name = directory["name"]
        server = directory.get("location", "")
        if server:
            peer = mochi.remote.peer(server)
            if peer:
                schema = mochi.remote.request(forum_id, "forums", "schema", {}, peer)

    # Create local forum record
    now = mochi.time.now()
    fp = mochi.entity.fingerprint(forum_id) or ""
    mochi.db.execute("""replace into forums ( id, name, members, updated, server, fingerprint ) values ( ?, ?, ?, ?, ?, ? )""",
        forum_id, forum_name, 0, now, server or "", fp)

    # Add self as subscriber
    mochi.db.execute("replace into members ( forum, id, name, subscribed ) values ( ?, ?, ?, ? )",
        forum_id, a.user.identity.id, a.user.identity.name, now)

    # Insert schema data so posts/comments are available immediately
    if schema and not schema.get("error"):
        insert_forum_schema(forum_id, schema)

    # Send subscribe message to forum owner
    mochi.message.send(
        {"from": a.user.identity.id, "to": forum_id, "service": "forums", "event": "subscribe"},
        {"name": a.user.identity.name},
        []
    )

    return {
        "data": {"fingerprint": mochi.entity.fingerprint(forum_id)}
    }

# Unsubscribe from forum
def action_unsubscribe(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    # Cannot unsubscribe from own forum
    if forum.get("owner") == 1:
        a.error.label(400, "errors.cannot_unsubscribe_from_your_own_forum")
        return

    # Delete all local data for this forum
    mochi.db.execute("delete from votes where forum=?", forum["id"])
    mochi.db.execute("delete from comments where forum=?", forum["id"])
    mochi.db.execute("delete from posts where forum=?", forum["id"])
    mochi.db.execute("delete from members where forum=?", forum["id"])
    mochi.db.execute("delete from forums where id=?", forum["id"])

    # Notify forum owner
    mochi.message.send(
        {"from": a.user.identity.id, "to": forum["id"], "service": "forums", "event": "unsubscribe"},
        {},
        []
    )

    return {
        "data": {}
    }

# Delete a forum (owner only)
def action_delete(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum_id = a.input("forum")
    forum = get_forum(forum_id)
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    # Only owner can delete
    if forum.get("owner") != 1:
        a.error.label(403, "errors.only_the_owner_can_delete_this_forum")
        return

    # Delete all local data
    mochi.db.execute("delete from votes where forum=?", forum["id"])
    mochi.db.execute("delete from comments where forum=?", forum["id"])
    mochi.db.execute("delete from posts where forum=?", forum["id"])
    mochi.db.execute("delete from members where forum=?", forum["id"])
    mochi.db.execute("delete from forums where id=?", forum["id"])

    # Revoke all access rules
    resource = "forum/" + forum["id"]
    for op in ACCESS_LEVELS + ["manage", "*"]:
        mochi.access.revoke("*", resource, op)

    # Delete the entity
    mochi.entity.delete(forum["id"])

    return {
        "data": {}
    }

# Rename a forum
def action_rename(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum_id = a.input("forum")
    if not mochi.text.valid(forum_id, "entity"):
        a.error.label(400, "errors.invalid_forum_id")
        return

    forum = get_forum(forum_id)
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    # Only owner can rename
    if forum.get("owner") != 1:
        a.error.label(403, "errors.not_forum_owner")
        return

    name = a.input("name")
    if not name or not mochi.text.valid(name, "name"):
        a.error.label(400, "errors.invalid_name")
        return

    # Update entity (triggers directory update and timestamp reset for public forums)
    mochi.entity.update(forum_id, name=name)

    # Update local forums table
    mochi.db.execute("update forums set name=?, updated=? where id=?", name, mochi.time.now(), forum_id)

    # Broadcast to members
    broadcast_event(forum_id, "update", {"name": name})

    return {"data": {"success": True}}

# Get banner text (owner only, for settings editor)
def action_banner_get(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return
    forum_id = a.input("forum")
    forum = get_forum(forum_id)
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return
    if forum.get("owner") != 1:
        a.error.label(403, "errors.not_forum_owner")
        return
    return {"data": {"banner": forum.get("banner", "")}}

# Set banner text (owner only)
def action_banner_set(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return
    forum_id = a.input("forum")
    forum = get_forum(forum_id)
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return
    if forum.get("owner") != 1:
        a.error.label(403, "errors.not_forum_owner")
        return
    banner = a.input("banner", "")
    if len(banner) > 10000:
        a.error.label(400, "errors.banner_too_long")
        return
    mochi.db.execute("update forums set banner=? where id=?", banner, forum["id"])
    broadcast_event(forum["id"], "update", {"banner": banner})
    return {"data": {"success": True}}

# View a post with comments
def action_post_view(a):
    post_id = a.input("post")
    forum_id = a.input("forum")
    server = a.input("server")
    user_id = a.user.identity.id if a.user else None

    post = mochi.db.row("select * from posts where id=?", post_id)

    # If post not found locally, fetch remotely (via server param or directory lookup)
    if not post and forum_id:
        if not user_id:
            a.error.label(401, "errors.not_logged_in")
            return

        # Connect to specified server, or use directory lookup
        peer = mochi.remote.peer(server) if server else None
        if server and not peer:
            a.error.label(502, "errors.unable_to_connect_to_server")
            return

        # Request post data via P2P
        response = mochi.remote.request(forum_id, "forums", "post/view", {"forum": forum_id, "post": post_id}, peer)
        if response.get("error"):
            a.error(response.get("code", 403), response["error"])
            return

        # Return remote data
        return {"data": response}

    if not post:
        a.error.label(404, "errors.post_not_found")
        return

    forum = get_forum(post["forum"])
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    is_owner = forum.get("owner") == 1

    member = None
    if a.user:
        member = mochi.db.row("select * from members where forum=? and id=?", forum["id"], a.user.identity.id)

    # Check access levels for UI permissions (is_owner already set above)
    if is_owner:
        can_vote = check_access(a, forum["id"], "vote")
        can_comment = check_access(a, forum["id"], "comment")
        can_moderate = check_access_remote(a, forum["id"], "moderate")
        # Check restrictions for vote/comment (banned users can't do either, muted can vote)
        if user_id:
            if can_vote and check_restriction(forum["id"], user_id, "vote"):
                can_vote = False
            if can_comment and check_restriction(forum["id"], user_id, "comment"):
                can_comment = False
    else:
        # Query owner for access permissions
        access_response = mochi.remote.request(forum["id"], "forums", "access/check", {
            "operations": ["vote", "comment", "moderate"],
            "user": user_id,
        })
        can_vote = access_response.get("vote", False)
        can_comment = access_response.get("comment", False)
        can_moderate = access_response.get("moderate", False)

    # Get user's vote on post
    user_post_vote = ""
    if a.user:
        vote_row = mochi.db.row("select vote from votes where post=? and comment='' and voter=?", post_id, a.user.identity.id)
        if vote_row:
            user_post_vote = vote_row["vote"]

    # Get comments recursively
    def get_comments(parent_id, depth):
        if depth > 100:  # Prevent infinite recursion
            return []

        # Filter out removed comments for non-moderators
        if can_moderate:
            comments = mochi.db.rows("select * from comments where forum=? and post=? and parent=? order by created desc",
                forum["id"], post_id, parent_id)
        else:
            comments = mochi.db.rows("select * from comments where forum=? and post=? and parent=? and status!='removed' order by created desc",
                forum["id"], post_id, parent_id)

        for c in comments:
            c["children"] = get_comments(c["id"], depth + 1)
            c["attachments"] = mochi.attachment.list(c["id"], forum["id"])
            c["can_vote"] = can_vote
            c["can_comment"] = can_comment
            # Get user's vote on this comment
            c["user_vote"] = ""
            if a.user:
                cv = mochi.db.row("select vote from votes where comment=? and voter=?", c["id"], a.user.identity.id)
                if cv:
                    c["user_vote"] = cv["vote"]

        return comments

    post["user_vote"] = user_post_vote
    post["body_markdown"] = mochi.text.markdown(post["body"])
    post["attachments"] = mochi.attachment.list(post_id, forum["id"])
    # Fetch attachments from forum owner if we don't have them locally
    if not post["attachments"] and forum.get("owner") != 1:
        post["attachments"] = mochi.attachment.fetch(post_id, forum["id"])
    post["tags"] = enrich_tags(mochi.db.rows("select id, label, qid, source, relevance from tags where object=?", post_id) or [], get_interest_map())

    comments = get_comments("", 0)

    # Render banner markdown to HTML
    banner = forum.get("banner", "")
    if banner:
        forum["banner_html"] = mochi.text.markdown(banner)

    return {
        "data": {
            "forum": forum,
            "post": post,
            "comments": comments,
            "member": member,
            "can_vote": can_vote,
            "can_comment": can_comment,
            "can_moderate": can_moderate
        }
    }

# Edit a post
def action_post_edit(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum_id = a.input("forum")
    post_id = a.input("post")
    user_id = a.user.identity.id

    title = a.input("title")
    if not mochi.text.valid(title, "name"):
        a.error.label(400, "errors.invalid_title")
        return

    body = a.input("body")
    if not mochi.text.valid(body, "text"):
        a.error.label(400, "errors.invalid_body")
        return

    post = mochi.db.row("select * from posts where id=?", post_id)
    forum = get_forum(forum_id)

    # Check if we have the post locally
    if post and forum:
        # Check if we own this forum
        is_owner = forum.get("owner") == 1

        if is_owner:
            # Owner processes locally - full edit with attachments
            is_author = user_id == post["member"]
            is_manager = check_access(a, forum["id"], "manage")
            if not is_author and not is_manager:
                a.error.label(403, "errors.not_allowed_to_edit_this_post")
                return

            # Check if post has been removed
            if post.get("status") == "removed":
                a.error.label(403, "errors.this_post_has_been_removed")
                return

            now = mochi.time.now()

            # Handle attachment changes
            order_json = a.input("order")
            if order_json:
                order = json.decode(order_json)
            else:
                order = []

            current_attachments = mochi.attachment.list(post_id, forum["id"])
            current_ids = [att["id"] for att in current_attachments]
            new_attachments = mochi.attachment.save(post_id, "attachments", [], [], [])

            final_order = []
            for item in order:
                if item.startswith("new:"):
                    idx = int(item[4:])
                    if idx < len(new_attachments):
                        final_order.append(new_attachments[idx]["id"])
                else:
                    final_order.append(item)

            if final_order:
                for att_id in current_ids:
                    if att_id not in final_order:
                        mochi.attachment.delete(att_id, [])
                for i, att_id in enumerate(final_order):
                    mochi.attachment.move(att_id, i + 1, [])
            else:
                for att_id in current_ids:
                    mochi.attachment.delete(att_id, [])

            mochi.db.execute("update posts set title=?, body=?, updated=?, edited=? where id=?",
                title, body, now, now, post_id)
            mochi.db.execute("update forums set updated=? where id=?", now, forum["id"])

            post_data = {
                "id": post_id,
                "title": title,
                "body": body,
                "edited": now
            }
            post_data["attachments"] = mochi.attachment.list(post_id, forum["id"])
            broadcast_event(forum["id"], "post/edit", post_data, user_id)
            broadcast_websocket(forum["id"], {"type": "post/edit", "forum": forum["id"], "post": post_id, "sender": user_id})

            # Re-tag with AI if enabled
            if forum.get("ai_mode", ""):
                mochi.db.execute("delete from tags where object=? and source='ai'", post_id)
                mochi.schedule.after("ai/tag", {"forum": forum["id"], "post": post_id}, 0)
        else:
            # Subscriber - must be author or have manage access to edit
            is_author = user_id == post["member"]
            is_manager = check_access(a, forum["id"], "manage")
            if not is_author and not is_manager:
                a.error.label(403, "errors.not_allowed_to_edit_this_post")
                return

            now = mochi.time.now()

            # Handle attachments - save new ones and send to owner
            order_json = a.input("order")
            if order_json:
                order = json.decode(order_json)
            else:
                order = []

            current_attachments = mochi.attachment.list(post_id, forum["id"])
            current_ids = [att["id"] for att in current_attachments]

            # Save new attachments locally
            new_attachments = mochi.attachment.save(post_id, "attachments", [], [], [])

            # Build final order
            final_order = []
            for item in order:
                if item.startswith("new:"):
                    idx = int(item[4:])
                    if idx < len(new_attachments):
                        final_order.append(new_attachments[idx]["id"])
                else:
                    final_order.append(item)

            # Determine which attachments to delete
            delete_ids = [att_id for att_id in current_ids if att_id not in final_order]

            # Send edit request to forum owner with attachment metadata
            submit_data = {"id": post_id, "title": title, "body": body, "order": final_order, "delete": delete_ids}
            if new_attachments:
                submit_data["attachments"] = [{"id": att["id"], "name": att["name"], "size": att["size"], "content_type": att.get("type", ""), "rank": att.get("rank", 0), "created": att.get("created", 0)} for att in new_attachments]
            mochi.message.send(
                {"from": user_id, "to": forum["id"], "service": "forums", "event": "post/edit/submit"},
                submit_data
            )

            # Update locally for optimistic UI
            mochi.db.execute("update posts set title=?, body=?, updated=?, edited=? where id=?",
                title, body, now, now, post_id)

            # Handle local attachment changes for optimistic UI
            for att_id in delete_ids:
                mochi.attachment.delete(att_id)
            for i, att_id in enumerate(final_order):
                mochi.attachment.move(att_id, i + 1)

        return {
            "data": {"forum": forum_id, "post": post_id}
        }

    # Post not found locally - remote forum edit (no local attachments to handle)
    if not mochi.text.valid(forum_id, "entity"):
        a.error.label(404, "errors.forum_not_found")
        return

    # For remote forums, we can still send new attachments
    order_json = a.input("order")
    if order_json:
        order = json.decode(order_json)
    else:
        order = []

    # Save new attachments locally
    new_attachments = mochi.attachment.save(post_id, "attachments", [], [], [])

    # Build final order (only new attachments, no existing ones locally)
    final_order = []
    for item in order:
        if item.startswith("new:"):
            idx = int(item[4:])
            if idx < len(new_attachments):
                final_order.append(new_attachments[idx]["id"])
        else:
            final_order.append(item)

    submit_data = {"id": post_id, "title": title, "body": body, "order": final_order, "delete": []}
    if new_attachments:
        submit_data["attachments"] = [{"id": att["id"], "name": att["name"], "size": att["size"], "content_type": att.get("type", ""), "rank": att.get("rank", 0), "created": att.get("created", 0)} for att in new_attachments]
    mochi.message.send(
        {"from": user_id, "to": forum_id, "service": "forums", "event": "post/edit/submit"},
        submit_data
    )

    return {
        "data": {"forum": forum_id, "post": post_id}
    }

# Delete a post
def action_post_delete(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum_id = a.input("forum")
    post_id = a.input("post")
    user_id = a.user.identity.id

    post = mochi.db.row("select * from posts where id=?", post_id)
    forum = get_forum(forum_id)

    # Check if we have the post locally
    if post and forum:
        # Check if we own this forum
        is_owner = forum.get("owner") == 1

        if is_owner:
            # Owner processes locally
            is_author = user_id == post["member"]
            is_manager = check_access(a, forum["id"], "manage")
            if not is_author and not is_manager:
                a.error.label(403, "errors.not_allowed_to_delete_this_post")
                return

            # Delete tags for this post
            mochi.db.execute("delete from tags where object=?", post_id)

            # Delete all attachments for this post
            attachments = mochi.attachment.list(post_id, forum["id"])
            for att in attachments:
                mochi.attachment.delete(att["id"])

            # Delete votes for all comments on this post
            mochi.db.execute("delete from votes where forum=? and post=?", forum["id"], post_id)

            # Delete all comments on this post
            mochi.db.execute("delete from comments where forum=? and post=?", forum["id"], post_id)

            # Delete the post
            mochi.db.execute("delete from posts where id=?", post_id)

            now = mochi.time.now()
            mochi.db.execute("update forums set updated=? where id=?", now, forum["id"])

            # Broadcast delete to members
            broadcast_event(forum["id"], "post/delete", {"id": post_id}, user_id)
            broadcast_websocket(forum["id"], {"type": "post/delete", "forum": forum["id"], "post": post_id, "sender": user_id})
        else:
            # Subscriber - must be author or have manage access to delete
            is_author = user_id == post["member"]
            is_manager = check_access(a, forum["id"], "manage")
            if not is_author and not is_manager:
                a.error.label(403, "errors.not_allowed_to_delete_this_post")
                return

            # Send delete request to forum owner
            mochi.message.send(
                {"from": user_id, "to": forum["id"], "service": "forums", "event": "post/delete/submit"},
                {"id": post_id}
            )

            # Delete locally for optimistic UI
            mochi.db.execute("delete from votes where forum=? and post=?", forum["id"], post_id)
            mochi.db.execute("delete from comments where forum=? and post=?", forum["id"], post_id)
            mochi.db.execute("delete from posts where id=?", post_id)

        return {
            "data": {"forum": forum_id}
        }

    # Post not found locally - send delete to remote forum
    if not mochi.text.valid(forum_id, "entity"):
        a.error.label(404, "errors.forum_not_found")
        return

    mochi.message.send(
        {"from": user_id, "to": forum_id, "service": "forums", "event": "post/delete/submit"},
        {"id": post_id}
    )

    return {
        "data": {"forum": forum_id}
    }

# Form for new comment
def action_comment_new(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return
    
    forum = get_forum(a.input("forum"))
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return
    
    return {
        "data": {
            "forum": forum,
            "post": a.input("post"),
            "parent": a.input("parent")
        }
    }

# Create new comment
def notify_mentions(forum_id, post_id, body, author_id, author_name):
    """Notify only the @mentioned forum members via P2P."""
    body_lower = body.lower()
    members = mochi.db.rows(
        "select id, name from members where forum=? and id!=?",
        forum_id, author_id)
    if not members:
        return
    post = mochi.db.row("select title from posts where id=?", post_id)
    post_title = (post.get("title") or "") if post else ""
    excerpt = body.strip()[:80]
    fp = mochi.entity.fingerprint(forum_id)
    url = "/forums/" + fp if fp else "/forums"
    for m in members:
        name = m.get("name")
        if name and ("@[" + name + "]").lower() in body_lower:
            mochi.message.send(
                {"from": forum_id, "to": m["id"], "service": "forums", "event": "mention/notify"},
                {"post": post_id, "title": post_title, "excerpt": excerpt, "author": author_name, "url": url}
            )

def action_comment_create(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum_id = a.input("forum")
    forum = get_forum(forum_id)

    post_id = a.input("post")
    parent_id = a.input("parent")
    body = a.input("body")

    if not mochi.text.valid(body, "text"):
        a.error.label(400, "errors.invalid_body")
        return

    user_id = a.user.identity.id
    user_name = a.user.identity.name
    id = mochi.uid()
    now = mochi.time.now()

    # Check if forum exists locally
    if forum:
        # Check if we own this forum
        is_owner = forum.get("owner") == 1

        if is_owner:
            # Owner processes locally
            if not check_access(a, forum["id"], "comment"):
                a.error.label(403, "errors.not_allowed_to_comment")
                return

            # Check for restrictions
            restriction_error = check_restriction(forum["id"], user_id, "comment")
            if restriction_error:
                a.error(403, restriction_error)
                return

            # Check rate limit (skip for moderators)
            if not check_access_remote(a, forum["id"], "moderate"):
                rate_error = check_rate_limit(forum, user_id, "comment")
                if rate_error:
                    a.error(429, rate_error)
                    return

            post = mochi.db.row("select * from posts where id=? and forum=?", post_id, forum["id"])
            if not post:
                a.error.label(404, "errors.post_not_found")
                return

            # Check if post is locked
            if post.get("locked"):
                a.error.label(403, "errors.this_post_is_locked")
                return

            if parent_id and not mochi.db.exists("select id from comments where id=? and post=?", parent_id, post_id):
                a.error.label(404, "errors.parent_comment_not_found")
                return

            # Determine initial status (moderators skip pre-moderation)
            status = "approved"
            if is_shadowbanned(forum["id"], user_id):
                status = "removed"
            elif not check_access(a, forum["id"], "moderate") and requires_premoderation(forum, user_id, "comment"):
                status = "pending"

            mochi.db.execute("replace into comments ( id, forum, post, parent, member, name, body, status, created ) values ( ?, ?, ?, ?, ?, ?, ?, ?, ? )",
                id, forum["id"], post_id, parent_id or "", user_id, user_name, body, status, now)

            # Save comment attachments locally
            attachments = mochi.attachment.save(id, "files", [], [], [])

            mochi.db.execute("update posts set updated=?, comments=comments+1 where id=?", now, post_id)
            mochi.db.execute("update forums set updated=? where id=?", now, forum["id"])

            # Only broadcast if approved
            if status == "approved":
                comment_data = {
                    "id": id,
                    "post": post_id,
                    "parent": parent_id or "",
                    "member": user_id,
                    "name": user_name,
                    "body": body,
                    "created": now
                }
                if attachments:
                    comment_data["attachments"] = [{"id": att["id"], "name": att["name"], "size": att["size"], "content_type": att.get("type", ""), "rank": att.get("rank", 0), "created": att.get("created", now)} for att in attachments]

                broadcast_event(forum["id"], "comment/create", comment_data, user_id)
                broadcast_websocket(forum["id"], {"type": "comment/create", "forum": forum["id"], "post": post_id, "comment": id, "sender": user_id})
                if body:
                    notify_mentions(forum["id"], post_id, body, user_id, user_name)
        else:
            # We're a subscriber - check access with owner first
            access_response = mochi.remote.request(forum["id"], "forums", "access/check", {
                "operations": ["comment"],
                "user": user_id,
            })
            if not access_response.get("comment", False):
                a.error(403, access_response.get("error", "Not allowed to comment"))
                return

            # Save comment attachments locally
            attachments = mochi.attachment.save(id, "files", [], [], [])

            # Send comment to forum owner with attachment metadata
            submit_data = {"id": id, "post": post_id, "parent": parent_id or "", "body": body}
            if attachments:
                submit_data["attachments"] = [{"id": att["id"], "name": att["name"], "size": att["size"], "content_type": att.get("type", ""), "rank": att.get("rank", 0), "created": att.get("created", now)} for att in attachments]
            mochi.message.send(
                {"from": user_id, "to": forum["id"], "service": "forums", "event": "comment/submit"},
                submit_data
            )

            # Save locally for optimistic UI (status pending until owner confirms)
            mochi.db.execute("replace into comments ( id, forum, post, parent, member, name, body, status, created ) values ( ?, ?, ?, ?, ?, ?, ?, 'pending', ? )",
                id, forum["id"], post_id, parent_id or "", user_id, user_name, body, now)

            mochi.db.execute("update posts set updated=?, comments=comments+1 where id=?", now, post_id)

        return {
            "data": {"forum": forum["id"], "post": post_id, "comment": id}
        }

    # Forum not found locally - send to remote forum
    if not mochi.text.valid(forum_id, "entity"):
        a.error.label(404, "errors.forum_not_found")
        return

    # Check access with remote forum owner
    access_response = mochi.remote.request(forum_id, "forums", "access/check", {
        "operations": ["comment"],
        "user": user_id,
    })
    if not access_response.get("comment", False):
        a.error(403, access_response.get("error", "Not allowed to comment"))
        return

    # Save comment attachments locally
    attachments = mochi.attachment.save(id, "files", [], [], [])

    # Send comment to remote forum owner with attachment metadata
    submit_data = {"id": id, "post": post_id, "parent": parent_id or "", "body": body}
    if attachments:
        submit_data["attachments"] = [{"id": att["id"], "name": att["name"], "size": att["size"], "content_type": att.get("type", ""), "rank": att.get("rank", 0), "created": att.get("created", now)} for att in attachments]
    mochi.message.send(
        {"from": user_id, "to": forum_id, "service": "forums", "event": "comment/submit"},
        submit_data
    )

    return {
        "data": {"forum": forum_id, "post": post_id, "comment": id}
    }

# Edit a comment
def action_comment_edit(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum_id = a.input("forum")
    post_id = a.input("post")
    comment_id = a.input("comment")
    user_id = a.user.identity.id

    body = a.input("body")
    if not mochi.text.valid(body, "text"):
        a.error.label(400, "errors.invalid_body")
        return

    comment = mochi.db.row("select * from comments where id=?", comment_id)
    forum = get_forum(forum_id)

    # Check if we have the comment locally
    if comment and forum:
        # Check if we own this forum
        is_owner = forum.get("owner") == 1

        if is_owner:
            # Owner processes locally
            is_author = user_id == comment["member"]
            is_manager = check_access(a, forum["id"], "manage")
            if not is_author and not is_manager:
                a.error.label(403, "errors.not_allowed_to_edit_this_comment")
                return

            # Check if comment has been removed
            if comment.get("status") == "removed":
                a.error.label(403, "errors.this_comment_has_been_removed")
                return

            now = mochi.time.now()

            mochi.db.execute("update comments set body=?, edited=? where id=?", body, now, comment_id)
            mochi.db.execute("update posts set updated=? where id=?", now, comment["post"])
            mochi.db.execute("update forums set updated=? where id=?", now, forum["id"])

            comment_data = {
                "id": comment_id,
                "post": comment["post"],
                "body": body,
                "edited": now
            }
            broadcast_event(forum["id"], "comment/edit", comment_data, user_id)
            broadcast_websocket(forum["id"], {"type": "comment/edit", "forum": forum["id"], "post": comment["post"], "comment": comment_id, "sender": user_id})
        else:
            # Subscriber - must be author or have manage access to edit
            is_author = user_id == comment["member"]
            is_manager = check_access(a, forum["id"], "manage")
            if not is_author and not is_manager:
                a.error.label(403, "errors.not_allowed_to_edit_this_comment")
                return

            # Send edit request to forum owner
            mochi.message.send(
                {"from": user_id, "to": forum["id"], "service": "forums", "event": "comment/edit/submit"},
                {"id": comment_id, "body": body}
            )

            # Update locally for optimistic UI
            now = mochi.time.now()
            mochi.db.execute("update comments set body=?, edited=? where id=?", body, now, comment_id)

        return {
            "data": {"forum": forum_id, "post": post_id, "comment": comment_id}
        }

    # Comment not found locally - send edit to remote forum
    if not mochi.text.valid(forum_id, "entity"):
        a.error.label(404, "errors.forum_not_found")
        return

    mochi.message.send(
        {"from": user_id, "to": forum_id, "service": "forums", "event": "comment/edit/submit"},
        {"id": comment_id, "body": body}
    )

    return {
        "data": {"forum": forum_id, "post": post_id, "comment": comment_id}
    }

# Delete a comment (and all children)
def action_comment_delete(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum_id = a.input("forum")
    post_id = a.input("post")
    comment_id = a.input("comment")
    user_id = a.user.identity.id

    comment = mochi.db.row("select * from comments where id=?", comment_id)
    forum = get_forum(forum_id)

    # Helper to recursively collect descendant comment IDs
    def collect_descendants(forum_id, post_id, parent_id):
        ids = []
        children = mochi.db.rows("select id from comments where forum=? and post=? and parent=?",
            forum_id, post_id, parent_id)
        for child in children:
            ids.append(child["id"])
            ids.extend(collect_descendants(forum_id, post_id, child["id"]))
        return ids

    # Check if we have the comment locally
    if comment and forum:
        # Check if we own this forum
        is_owner = forum.get("owner") == 1

        if is_owner:
            # Owner processes locally
            is_author = user_id == comment["member"]
            is_manager = check_access(a, forum["id"], "manage")
            if not is_author and not is_manager:
                a.error.label(403, "errors.not_allowed_to_delete_this_comment")
                return

            comment_ids = [comment_id] + collect_descendants(forum["id"], comment["post"], comment_id)
            deleted_count = len(comment_ids)

            # Delete attachments for all comments being deleted
            for cid in comment_ids:
                attachments = mochi.attachment.list(cid, forum["id"])
                for att in attachments:
                    mochi.attachment.delete(att["id"])

            for cid in comment_ids:
                mochi.db.execute("delete from votes where comment=?", cid)
            for cid in comment_ids:
                mochi.db.execute("delete from comments where id=?", cid)

            now = mochi.time.now()
            mochi.db.execute("update posts set updated=?, comments=comments-? where id=?",
                now, deleted_count, comment["post"])
            mochi.db.execute("update forums set updated=? where id=?", now, forum["id"])

            broadcast_event(forum["id"], "comment/delete",
                {"ids": comment_ids, "post": comment["post"]}, user_id)
            broadcast_websocket(forum["id"], {"type": "comment/delete", "forum": forum["id"], "post": comment["post"], "comment": comment_id, "sender": user_id})
        else:
            # Subscriber - must be author or have manage access to delete
            is_author = user_id == comment["member"]
            is_manager = check_access(a, forum["id"], "manage")
            if not is_author and not is_manager:
                a.error.label(403, "errors.not_allowed_to_delete_this_comment")
                return

            # Send delete request to forum owner
            mochi.message.send(
                {"from": user_id, "to": forum["id"], "service": "forums", "event": "comment/delete/submit"},
                {"id": comment_id}
            )

            # Delete locally for optimistic UI
            comment_ids = [comment_id] + collect_descendants(forum["id"], comment["post"], comment_id)
            deleted_count = len(comment_ids)

            for cid in comment_ids:
                mochi.db.execute("delete from votes where comment=?", cid)
            for cid in comment_ids:
                mochi.db.execute("delete from comments where id=?", cid)

            mochi.db.execute("update posts set comments=comments-? where id=?", deleted_count, comment["post"])

        return {
            "data": {"forum": forum_id, "post": post_id}
        }

    # Comment not found locally - send delete to remote forum
    if not mochi.text.valid(forum_id, "entity"):
        a.error.label(404, "errors.forum_not_found")
        return

    mochi.message.send(
        {"from": user_id, "to": forum_id, "service": "forums", "event": "comment/delete/submit"},
        {"id": comment_id}
    )

    return {
        "data": {"forum": forum_id, "post": post_id}
    }

# MODERATION ACTIONS

# Remove a post (moderator action)
def action_post_remove(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    if not check_access_remote(a, forum["id"], "moderate"):
        a.error.label(403, "errors.not_allowed_to_moderate")
        return

    post_id = a.input("post")
    post = mochi.db.row("select * from posts where id=? and forum=?", post_id, forum["id"])
    if not post:
        a.error.label(404, "errors.post_not_found")
        return

    if post.get("status") == "removed":
        a.error.label(400, "errors.post_already_removed")
        return

    user = a.user.identity.id
    reason = a.input("reason", "")
    is_owner = forum.get("owner") == 1

    if is_owner:
        now = mochi.time.now()
        mochi.db.execute(
            "update posts set status='removed', remover=?, reason=?, updated=? where id=?",
            user, reason, now, post_id)

        log_moderation(forum["id"], user, "remove", "post", post_id, post["member"], reason)
        notify_moderation_action(forum["id"], post["member"], "remove", "post", reason)

        broadcast_event(forum["id"], "post/remove", {
            "id": post_id,
            "remover": user,
            "reason": reason
        })
        broadcast_websocket(forum["id"], {"type": "post/remove", "forum": forum["id"], "post": post_id, "sender": user})
    else:
        mochi.message.send(
            {"from": user, "to": forum["id"], "service": "forums", "event": "post/remove/submit"},
            {"id": post_id, "reason": reason}
        )
        # Optimistic local update
        mochi.db.execute(
            "update posts set status='removed', remover=?, reason=? where id=?",
            user, reason, post_id)

    return {"data": {"success": True}}

# Restore a removed post (moderator action)
def action_post_restore(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    if not check_access_remote(a, forum["id"], "moderate"):
        a.error.label(403, "errors.not_allowed_to_moderate")
        return

    post_id = a.input("post")
    post = mochi.db.row("select * from posts where id=? and forum=?", post_id, forum["id"])
    if not post:
        a.error.label(404, "errors.post_not_found")
        return

    if post.get("status") != "removed":
        a.error.label(400, "errors.post_is_not_removed")
        return

    user = a.user.identity.id
    is_owner = forum.get("owner") == 1

    if is_owner:
        now = mochi.time.now()
        mochi.db.execute(
            "update posts set status='approved', remover=null, reason='', updated=? where id=?",
            now, post_id)

        log_moderation(forum["id"], user, "restore", "post", post_id, post["member"], "")

        broadcast_event(forum["id"], "post/restore", {"id": post_id}, user)
        broadcast_websocket(forum["id"], {"type": "post/restore", "forum": forum["id"], "post": post_id, "sender": user})
    else:
        mochi.message.send(
            {"from": user, "to": forum["id"], "service": "forums", "event": "post/restore/submit"},
            {"id": post_id}
        )
        mochi.db.execute(
            "update posts set status='approved', remover=null, reason='' where id=?",
            post_id)

    return {"data": {"success": True}}

# Approve a pending post (moderator action)
def action_post_approve(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    if not check_access_remote(a, forum["id"], "moderate"):
        a.error.label(403, "errors.not_allowed_to_moderate")
        return

    post_id = a.input("post")
    post = mochi.db.row("select * from posts where id=? and forum=?", post_id, forum["id"])
    if not post:
        a.error.label(404, "errors.post_not_found")
        return

    if post.get("status") != "pending":
        a.error.label(400, "errors.post_is_not_pending")
        return

    user = a.user.identity.id
    is_owner = forum.get("owner") == 1

    if is_owner:
        now = mochi.time.now()
        mochi.db.execute(
            "update posts set status='approved', updated=? where id=?",
            now, post_id)

        log_moderation(forum["id"], user, "approve", "post", post_id, post["member"], "")
        notify_moderation_action(forum["id"], post["member"], "approve", "post", "")

        # Now broadcast the post to members
        post_data = {
            "id": post_id,
            "member": post["member"],
            "name": post["name"],
            "title": post["title"],
            "body": post["body"],
            "created": post["created"]
        }
        broadcast_event(forum["id"], "post/create", post_data)
    else:
        mochi.message.send(
            {"from": user, "to": forum["id"], "service": "forums", "event": "post/approve/submit"},
            {"id": post_id}
        )
        mochi.db.execute("update posts set status='approved' where id=?", post_id)

    return {"data": {"success": True}}

# Lock a post (prevent new comments)
def action_post_lock(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    if not check_access_remote(a, forum["id"], "moderate"):
        a.error.label(403, "errors.not_allowed_to_moderate")
        return

    post_id = a.input("post")
    post = mochi.db.row("select * from posts where id=? and forum=?", post_id, forum["id"])
    if not post:
        a.error.label(404, "errors.post_not_found")
        return

    if post.get("locked"):
        a.error.label(400, "errors.post_already_locked")
        return

    user = a.user.identity.id
    is_owner = forum.get("owner") == 1

    if is_owner:
        now = mochi.time.now()
        mochi.db.execute("update posts set locked=1, updated=? where id=?", now, post_id)
        log_moderation(forum["id"], user, "lock", "post", post_id, post["member"], "")
        broadcast_event(forum["id"], "post/lock", {"id": post_id, "locked": True})
        broadcast_websocket(forum["id"], {"type": "post/lock", "forum": forum["id"], "post": post_id, "locked": True, "sender": user})
    else:
        mochi.message.send(
            {"from": user, "to": forum["id"], "service": "forums", "event": "post/lock/submit"},
            {"id": post_id}
        )
        mochi.db.execute("update posts set locked=1 where id=?", post_id)

    return {"data": {"success": True}}

# Unlock a post (allow new comments)
def action_post_unlock(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    if not check_access_remote(a, forum["id"], "moderate"):
        a.error.label(403, "errors.not_allowed_to_moderate")
        return

    post_id = a.input("post")
    post = mochi.db.row("select * from posts where id=? and forum=?", post_id, forum["id"])
    if not post:
        a.error.label(404, "errors.post_not_found")
        return

    if not post.get("locked"):
        a.error.label(400, "errors.post_is_not_locked")
        return

    user = a.user.identity.id
    is_owner = forum.get("owner") == 1

    if is_owner:
        now = mochi.time.now()
        mochi.db.execute("update posts set locked=0, updated=? where id=?", now, post_id)
        log_moderation(forum["id"], user, "unlock", "post", post_id, post["member"], "")
        broadcast_event(forum["id"], "post/lock", {"id": post_id, "locked": False})
        broadcast_websocket(forum["id"], {"type": "post/lock", "forum": forum["id"], "post": post_id, "locked": False, "sender": user})
    else:
        mochi.message.send(
            {"from": user, "to": forum["id"], "service": "forums", "event": "post/unlock/submit"},
            {"id": post_id}
        )
        mochi.db.execute("update posts set locked=0 where id=?", post_id)

    return {"data": {"success": True}}

# Pin a post (sticky to top)
def action_post_pin(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    if not check_access_remote(a, forum["id"], "moderate"):
        a.error.label(403, "errors.not_allowed_to_moderate")
        return

    post_id = a.input("post")
    post = mochi.db.row("select * from posts where id=? and forum=?", post_id, forum["id"])
    if not post:
        a.error.label(404, "errors.post_not_found")
        return

    if post.get("pinned"):
        a.error.label(400, "errors.post_already_pinned")
        return

    user = a.user.identity.id
    is_owner = forum.get("owner") == 1

    if is_owner:
        mochi.db.execute("update posts set pinned=1 where id=?", post_id)
        log_moderation(forum["id"], user, "pin", "post", post_id, post["member"], "")
        broadcast_event(forum["id"], "post/pin", {"id": post_id, "pinned": True})
        broadcast_websocket(forum["id"], {"type": "post/pin", "forum": forum["id"], "post": post_id, "pinned": True, "sender": user})
    else:
        mochi.message.send(
            {"from": user, "to": forum["id"], "service": "forums", "event": "post/pin/submit"},
            {"id": post_id}
        )
        mochi.db.execute("update posts set pinned=1 where id=?", post_id)

    return {"data": {"success": True}}

# Unpin a post
def action_post_unpin(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    if not check_access_remote(a, forum["id"], "moderate"):
        a.error.label(403, "errors.not_allowed_to_moderate")
        return

    post_id = a.input("post")
    post = mochi.db.row("select * from posts where id=? and forum=?", post_id, forum["id"])
    if not post:
        a.error.label(404, "errors.post_not_found")
        return

    if not post.get("pinned"):
        a.error.label(400, "errors.post_is_not_pinned")
        return

    user = a.user.identity.id
    is_owner = forum.get("owner") == 1

    if is_owner:
        mochi.db.execute("update posts set pinned=0 where id=?", post_id)
        log_moderation(forum["id"], user, "unpin", "post", post_id, post["member"], "")
        broadcast_event(forum["id"], "post/pin", {"id": post_id, "pinned": False})
        broadcast_websocket(forum["id"], {"type": "post/pin", "forum": forum["id"], "post": post_id, "pinned": False, "sender": user})
    else:
        mochi.message.send(
            {"from": user, "to": forum["id"], "service": "forums", "event": "post/unpin/submit"},
            {"id": post_id}
        )
        mochi.db.execute("update posts set pinned=0 where id=?", post_id)

    return {"data": {"success": True}}

# Remove a comment (moderator action)
def action_comment_remove(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    if not check_access_remote(a, forum["id"], "moderate"):
        a.error.label(403, "errors.not_allowed_to_moderate")
        return

    comment_id = a.input("comment")
    comment = mochi.db.row("select * from comments where id=? and forum=?", comment_id, forum["id"])
    if not comment:
        a.error.label(404, "errors.comment_not_found")
        return

    if comment.get("status") == "removed":
        a.error.label(400, "errors.comment_already_removed")
        return

    user = a.user.identity.id
    reason = a.input("reason", "")
    is_owner = forum.get("owner") == 1

    if is_owner:
        now = mochi.time.now()
        mochi.db.execute(
            "update comments set status='removed', remover=?, reason=? where id=?",
            user, reason, comment_id)
        mochi.db.execute("update posts set updated=?, comments=comments-1 where id=?", now, comment["post"])

        log_moderation(forum["id"], user, "remove", "comment", comment_id, comment["member"], reason)
        notify_moderation_action(forum["id"], comment["member"], "remove", "comment", reason)

        broadcast_event(forum["id"], "comment/remove", {
            "id": comment_id,
            "post": comment["post"],
            "remover": user,
            "reason": reason
        })
        broadcast_websocket(forum["id"], {"type": "comment/remove", "forum": forum["id"], "post": comment["post"], "comment": comment_id, "sender": user})
    else:
        mochi.message.send(
            {"from": user, "to": forum["id"], "service": "forums", "event": "comment/remove/submit"},
            {"id": comment_id, "reason": reason}
        )
        mochi.db.execute(
            "update comments set status='removed', remover=?, reason=? where id=?",
            user, reason, comment_id)

    return {"data": {"success": True}}

# Restore a removed comment (moderator action)
def action_comment_restore(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    if not check_access_remote(a, forum["id"], "moderate"):
        a.error.label(403, "errors.not_allowed_to_moderate")
        return

    comment_id = a.input("comment")
    comment = mochi.db.row("select * from comments where id=? and forum=?", comment_id, forum["id"])
    if not comment:
        a.error.label(404, "errors.comment_not_found")
        return

    if comment.get("status") != "removed":
        a.error.label(400, "errors.comment_is_not_removed")
        return

    user = a.user.identity.id
    is_owner = forum.get("owner") == 1

    if is_owner:
        now = mochi.time.now()
        mochi.db.execute(
            "update comments set status='approved', remover=null, reason='' where id=?",
            comment_id)
        mochi.db.execute("update posts set updated=?, comments=comments+1 where id=?", now, comment["post"])

        log_moderation(forum["id"], user, "restore", "comment", comment_id, comment["member"], "")

        broadcast_event(forum["id"], "comment/restore", {"id": comment_id, "post": comment["post"]}, user)
        broadcast_websocket(forum["id"], {"type": "comment/restore", "forum": forum["id"], "post": comment["post"], "comment": comment_id, "sender": user})
    else:
        mochi.message.send(
            {"from": user, "to": forum["id"], "service": "forums", "event": "comment/restore/submit"},
            {"id": comment_id}
        )
        mochi.db.execute(
            "update comments set status='approved', remover=null, reason='' where id=?",
            comment_id)

    return {"data": {"success": True}}

# Approve a pending comment (moderator action)
def action_comment_approve(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    if not check_access_remote(a, forum["id"], "moderate"):
        a.error.label(403, "errors.not_allowed_to_moderate")
        return

    comment_id = a.input("comment")
    comment = mochi.db.row("select * from comments where id=? and forum=?", comment_id, forum["id"])
    if not comment:
        a.error.label(404, "errors.comment_not_found")
        return

    if comment.get("status") != "pending":
        a.error.label(400, "errors.comment_is_not_pending")
        return

    user = a.user.identity.id
    is_owner = forum.get("owner") == 1

    if is_owner:
        now = mochi.time.now()
        mochi.db.execute("update comments set status='approved' where id=?", comment_id)
        mochi.db.execute("update posts set updated=? where id=?", now, comment["post"])

        log_moderation(forum["id"], user, "approve", "comment", comment_id, comment["member"], "")
        notify_moderation_action(forum["id"], comment["member"], "approve", "comment", "")

        # Now broadcast the comment to members
        comment_data = {
            "id": comment_id,
            "post": comment["post"],
            "parent": comment["parent"],
            "member": comment["member"],
            "name": comment["name"],
            "body": comment["body"],
            "created": comment["created"]
        }
        broadcast_event(forum["id"], "comment/create", comment_data)
        broadcast_websocket(forum["id"], {"type": "comment/create", "forum": forum["id"], "post": comment["post"], "comment": comment_id, "sender": comment["member"]})
    else:
        mochi.message.send(
            {"from": user, "to": forum["id"], "service": "forums", "event": "comment/approve/submit"},
            {"id": comment_id}
        )
        mochi.db.execute("update comments set status='approved' where id=?", comment_id)

    return {"data": {"success": True}}

# RESTRICTION ACTIONS

# Restrict a user from a forum (mute/ban/shadowban)
def action_restrict(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    if not check_access_remote(a, forum["id"], "moderate"):
        a.error.label(403, "errors.not_allowed_to_moderate")
        return

    target_user = a.input("user")
    if not mochi.text.valid(target_user, "entity"):
        a.error.label(400, "errors.invalid_user")
        return

    restriction_type = a.input("type")
    if restriction_type not in ["muted", "banned", "shadowban"]:
        a.error.label(400, "errors.invalid_restriction_type")
        return

    reason = a.input("reason", "")
    duration = a.input("duration")  # In seconds, None for permanent
    expires = None
    if duration:
        if not mochi.text.valid(duration, "natural"):
            a.error.label(400, "errors.invalid_duration")
            return
        expires = mochi.time.now() + int(duration)

    user = a.user.identity.id
    is_owner = forum.get("owner") == 1

    if is_owner:
        now = mochi.time.now()
        mochi.db.execute(
            "replace into restrictions (forum, user, type, reason, moderator, expires, created) values (?, ?, ?, ?, ?, ?, ?)",
            forum["id"], target_user, restriction_type, reason, user, expires, now)

        log_moderation(forum["id"], user, "restrict", "user", target_user, None, reason)
        notify_moderation_action(forum["id"], target_user, "restrict", restriction_type, reason)

        broadcast_event(forum["id"], "user/restrict", {
            "user": target_user,
            "type": restriction_type,
            "expires": expires
        })
    else:
        mochi.message.send(
            {"from": user, "to": forum["id"], "service": "forums", "event": "restrict/submit"},
            {"user": target_user, "type": restriction_type, "reason": reason, "expires": expires}
        )

    return {"data": {"success": True}}

# Remove a restriction from a user
def action_unrestrict(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    if not check_access_remote(a, forum["id"], "moderate"):
        a.error.label(403, "errors.not_allowed_to_moderate")
        return

    target_user = a.input("user")
    if not mochi.text.valid(target_user, "entity"):
        a.error.label(400, "errors.invalid_user")
        return

    restriction = mochi.db.row("select * from restrictions where forum=? and user=?", forum["id"], target_user)
    if not restriction:
        a.error.label(404, "errors.restriction_not_found")
        return

    user = a.user.identity.id
    is_owner = forum.get("owner") == 1

    if is_owner:
        mochi.db.execute("delete from restrictions where forum=? and user=?", forum["id"], target_user)

        log_moderation(forum["id"], user, "unrestrict", "user", target_user, None, "")
        notify_moderation_action(forum["id"], target_user, "unrestrict", "", "")

        broadcast_event(forum["id"], "user/unrestrict", {"user": target_user})
    else:
        mochi.message.send(
            {"from": user, "to": forum["id"], "service": "forums", "event": "unrestrict/submit"},
            {"user": target_user}
        )

    return {"data": {"success": True}}

# List restrictions for a forum
def action_restrictions(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    if not check_access_remote(a, forum["id"], "moderate"):
        a.error.label(403, "errors.not_allowed_to_moderate")
        return

    # If we don't own the forum, proxy request to owner via P2P event
    if forum.get("owner") != 1:
        response = mochi.remote.request(forum["id"], "forums", "restrictions", {})
        if response and response.get("error"):
            a.error(403, response["error"])
            return
        return {"data": response}

    restrictions = mochi.db.rows("select * from restrictions where forum=? order by created desc", forum["id"])

    # Look up names from members table
    for r in restrictions:
        member = mochi.db.row("select name from members where forum=? and id=?", forum["id"], r["user"])
        if member:
            r["name"] = member["name"]
        moderator = mochi.db.row("select name from members where forum=? and id=?", forum["id"], r["moderator"])
        if moderator:
            r["moderator_name"] = moderator["name"]

    return {"data": {"restrictions": restrictions}}

# REPORTING ACTIONS

# Report a post
def action_post_report(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    post_id = a.input("post")
    post = mochi.db.row("select * from posts where id=? and forum=?", post_id, forum["id"])
    if not post:
        a.error.label(404, "errors.post_not_found")
        return

    user = a.user.identity.id

    if post["member"] == user:
        a.error.label(400, "errors.cannot_report_your_own_content")
        return

    reason = a.input("reason")
    if reason not in ["spam", "harassment", "hate", "violence", "misinformation", "offtopic", "other"]:
        a.error.label(400, "errors.invalid_reason")
        return

    details = a.input("details", "")
    if reason == "other" and not details:
        a.error.label(400, "errors.details_required_for_other_reason")
        return

    # Check for duplicate pending report
    if mochi.db.exists(
        "select 1 from reports where forum=? and type='post' and target=? and reporter=? and status='pending'",
        forum["id"], post_id, user):
        a.error.label(400, "errors.you_have_already_reported_this_post")
        return

    # Rate limit: 5 reports per hour
    one_hour_ago = mochi.time.now() - 3600
    report_count = mochi.db.row(
        "select count(*) as count from reports where forum=? and reporter=? and created > ?",
        forum["id"], user, one_hour_ago)
    if report_count and report_count["count"] >= 5:
        a.error.label(429, "errors.report_limit_exceeded_try_again_later")
        return

    report_id = mochi.uid()
    now = mochi.time.now()
    is_owner = forum.get("owner") == 1

    if is_owner:
        mochi.db.execute(
            "insert into reports (id, forum, reporter, type, target, author, reason, details, created) values (?, ?, ?, 'post', ?, ?, ?, ?, ?)",
            report_id, forum["id"], user, post_id, post["member"], reason, details, now)
    else:
        mochi.message.send(
            {"from": user, "to": forum["id"], "service": "forums", "event": "report/submit"},
            {"id": report_id, "type": "post", "target": post_id, "reason": reason, "details": details}
        )

    return {"data": {"success": True}}

# Report a comment
def action_comment_report(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    comment_id = a.input("comment")
    comment = mochi.db.row("select * from comments where id=? and forum=?", comment_id, forum["id"])
    if not comment:
        a.error.label(404, "errors.comment_not_found")
        return

    user = a.user.identity.id

    if comment["member"] == user:
        a.error.label(400, "errors.cannot_report_your_own_content")
        return

    reason = a.input("reason")
    if reason not in ["spam", "harassment", "hate", "violence", "misinformation", "offtopic", "other"]:
        a.error.label(400, "errors.invalid_reason")
        return

    details = a.input("details", "")
    if reason == "other" and not details:
        a.error.label(400, "errors.details_required_for_other_reason")
        return

    # Check for duplicate pending report
    if mochi.db.exists(
        "select 1 from reports where forum=? and type='comment' and target=? and reporter=? and status='pending'",
        forum["id"], comment_id, user):
        a.error.label(400, "errors.you_have_already_reported_this_comment")
        return

    # Rate limit: 5 reports per hour
    one_hour_ago = mochi.time.now() - 3600
    report_count = mochi.db.row(
        "select count(*) as count from reports where forum=? and reporter=? and created > ?",
        forum["id"], user, one_hour_ago)
    if report_count and report_count["count"] >= 5:
        a.error.label(429, "errors.report_limit_exceeded_try_again_later")
        return

    report_id = mochi.uid()
    now = mochi.time.now()
    is_owner = forum.get("owner") == 1

    if is_owner:
        mochi.db.execute(
            "insert into reports (id, forum, reporter, type, target, author, reason, details, created) values (?, ?, ?, 'comment', ?, ?, ?, ?, ?)",
            report_id, forum["id"], user, comment_id, comment["member"], reason, details, now)
    else:
        mochi.message.send(
            {"from": user, "to": forum["id"], "service": "forums", "event": "report/submit"},
            {"id": report_id, "type": "comment", "target": comment_id, "reason": reason, "details": details}
        )

    return {"data": {"success": True}}

# List reports for a forum (moderator view)
def action_moderation_reports(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    if not check_access_remote(a, forum["id"], "moderate"):
        a.error.label(403, "errors.not_allowed_to_moderate")
        return

    # If we don't own the forum, proxy request to owner via P2P event
    if forum.get("owner") != 1:
        status = a.input("status", "pending")
        response = mochi.remote.request(forum["id"], "forums", "moderation/reports", {"status": status})
        if response and response.get("error"):
            a.error(403, response["error"])
            return
        return {"data": response}

    status = a.input("status", "pending")
    if status not in ["pending", "resolved", "all"]:
        a.error.label(400, "errors.invalid_status")
        return

    if status == "all":
        reports = mochi.db.rows(
            "select * from reports where forum=? order by created desc limit 100",
            forum["id"])
    else:
        reports = mochi.db.rows(
            "select * from reports where forum=? and status=? order by created desc limit 100",
            forum["id"], status)

    # Enrich reports with content and names
    for r in reports:
        # Get reporter name (try members first, then entity name)
        reporter = mochi.db.row("select name from members where forum=? and id=?", forum["id"], r["reporter"])
        if reporter and reporter["name"]:
            r["reporter_name"] = reporter["name"]
        else:
            r["reporter_name"] = mochi.entity.name(r["reporter"]) or r["reporter"]
        # Get author name (try members first, then entity name)
        author = mochi.db.row("select name from members where forum=? and id=?", forum["id"], r["author"])
        if author and author["name"]:
            r["author_name"] = author["name"]
        else:
            r["author_name"] = mochi.entity.name(r["author"]) or r["author"]
        # Get resolver name if resolved
        if r.get("resolver"):
            resolver = mochi.db.row("select name from members where forum=? and id=?", forum["id"], r["resolver"])
            if resolver and resolver["name"]:
                r["resolver_name"] = resolver["name"]
            else:
                r["resolver_name"] = mochi.entity.name(r["resolver"]) or r["resolver"]
        # Get content being reported
        if r["type"] == "post":
            post = mochi.db.row("select title, body from posts where id=?", r["target"])
            if post:
                r["content_title"] = post["title"]
                r["content_preview"] = post["body"][:200] if len(post["body"]) > 200 else post["body"]
                r["attachments"] = mochi.attachment.list(r["target"], forum["id"])
        elif r["type"] == "comment":
            comment = mochi.db.row("select body from comments where id=?", r["target"])
            if comment:
                r["content_preview"] = comment["body"][:200] if len(comment["body"]) > 200 else comment["body"]

    return {"data": {"forum": forum, "reports": reports}}

# Resolve a report
def action_report_resolve(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    if not check_access_remote(a, forum["id"], "moderate"):
        a.error.label(403, "errors.not_allowed_to_moderate")
        return

    # If we don't own the forum, proxy request to owner via P2P event
    if forum.get("owner") != 1:
        report_id = a.input("report")
        action = a.input("action")
        response = mochi.remote.request(forum["id"], "forums", "moderation/report/resolve", {"report": report_id, "action": action})
        if response and response.get("error"):
            a.error(400, response["error"])
            return
        return {"data": {"success": True}}

    report_id = a.input("report")
    report = mochi.db.row("select * from reports where id=? and forum=?", report_id, forum["id"])
    if not report:
        a.error.label(404, "errors.report_not_found")
        return

    if report.get("status") != "pending":
        a.error.label(400, "errors.report_already_resolved")
        return

    action = a.input("action")
    if action not in ["removed", "ignored"]:
        a.error.label(400, "errors.invalid_action")
        return

    user = a.user.identity.id
    now = mochi.time.now()
    is_owner = forum.get("owner") == 1

    if is_owner:
        # Perform the actual action
        if action == "removed":
            # Remove the reported content
            if report["type"] == "post":
                post = mochi.db.row("select * from posts where id=?", report["target"])
                if post and post.get("status") != "removed":
                    mochi.db.execute(
                        "update posts set status='removed', remover=?, reason=?, updated=? where id=?",
                        user, report["reason"], now, report["target"])
                    log_moderation(forum["id"], user, "remove", "post", report["target"], report["author"], report["reason"])
                    notify_moderation_action(forum["id"], report["author"], "remove", "post", report["reason"])
                    broadcast_event(forum["id"], "post/remove", {
                        "id": report["target"], "remover": user, "reason": report["reason"]
                    })
            elif report["type"] == "comment":
                comment = mochi.db.row("select * from comments where id=?", report["target"])
                if comment and comment.get("status") != "removed":
                    mochi.db.execute(
                        "update comments set status='removed', remover=?, reason=? where id=?",
                        user, report["reason"], report["target"])
                    log_moderation(forum["id"], user, "remove", "comment", report["target"], report["author"], report["reason"])
                    notify_moderation_action(forum["id"], report["author"], "remove", "comment", report["reason"])
                    broadcast_event(forum["id"], "comment/remove", {
                        "id": report["target"], "post": comment["post"], "remover": user, "reason": report["reason"]
                    })

        # Mark report as resolved
        mochi.db.execute(
            "update reports set status='resolved', resolver=?, action=?, resolved=? where id=?",
            user, action, now, report_id)

        log_moderation(forum["id"], user, "resolve_report", "report", report_id, report["author"], action)

        # Broadcast resolution to all members so other moderators' queues update
        broadcast_event(forum["id"], "report/resolve", {
            "id": report_id,
            "action": action,
            "resolver": user
        })
    else:
        mochi.message.send(
            {"from": user, "to": forum["id"], "service": "forums", "event": "report/resolve/submit"},
            {"id": report_id, "action": action}
        )
        # Optimistic local update for report status
        mochi.db.execute(
            "update reports set status='resolved', resolver=?, action=?, resolved=? where id=?",
            user, action, now, report_id)
        # Also do optimistic update for content if removed
        if action == "removed":
            if report["type"] == "post":
                mochi.db.execute(
                    "update posts set status='removed', remover=?, reason=? where id=?",
                    user, report["reason"], report["target"])
            elif report["type"] == "comment":
                mochi.db.execute(
                    "update comments set status='removed', remover=?, reason=? where id=?",
                    user, report["reason"], report["target"])

    return {"data": {"success": True}}

# MODERATION QUEUE ACTION

# Get the moderation queue (pending posts, comments, and reports)
def action_moderation_queue(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    if not check_access_remote(a, forum["id"], "moderate"):
        a.error.label(403, "errors.not_allowed_to_moderate")
        return

    # If we don't own the forum, proxy request to owner via P2P event
    if forum.get("owner") != 1:
        response = mochi.remote.request(forum["id"], "forums", "moderation/queue", {})
        if response and response.get("error"):
            a.error(403, response["error"])
            return
        return {"data": response}

    posts = mochi.db.rows(
        "select id, forum, title, body, member, name, created from posts where forum=? and status='pending' order by created asc",
        forum["id"])
    for p in posts:
        p["attachments"] = mochi.attachment.list(p["id"], forum["id"])

    comments = mochi.db.rows(
        "select id, body, post, member, name, created from comments where forum=? and status='pending' order by created asc",
        forum["id"])
    reports = mochi.db.rows("""
        select type, target, author, reason, min(id) as id, min(details) as details,
               min(reporter) as reporter, min(created) as created, count(*) as count
        from reports
        where forum=? and status='pending'
        group by type, target
        order by count desc, created asc
    """, forum["id"])

    return {
        "data": {
            "forum": forum,
            "posts": posts,
            "comments": comments,
            "reports": reports,
            "counts": {
                "posts": len(posts),
                "comments": len(comments),
                "reports": len(reports),
                "total": len(posts) + len(comments) + len(reports)
            }
        }
    }

# MODERATION SETTINGS ACTIONS

# Get moderation settings for a forum (owner only)
def action_moderation_settings(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    # Only owner can view/modify settings
    if forum.get("owner") != 1:
        a.error.label(403, "errors.not_allowed")
        return

    return {
        "data": {
            "settings": {
                "moderation_posts": forum.get("moderation_posts", 0),
                "moderation_comments": forum.get("moderation_comments", 0),
                "moderation_new": forum.get("moderation_new", 0),
                "new_user_days": forum.get("new_user_days", 0),
                "post_limit": forum.get("post_limit", 0),
                "comment_limit": forum.get("comment_limit", 0),
                "limit_window": forum.get("limit_window", 3600)
            }
        }
    }

# Save moderation settings for a forum (owner only)
def action_moderation_settings_save(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    # Only owner can modify settings
    if forum.get("owner") != 1:
        a.error.label(403, "errors.not_allowed")
        return

    # Get and validate settings
    moderation_posts = a.input("moderation_posts")
    moderation_comments = a.input("moderation_comments")
    moderation_new = a.input("moderation_new")
    new_user_days = a.input("new_user_days")
    post_limit = a.input("post_limit")
    comment_limit = a.input("comment_limit")
    limit_window = a.input("limit_window")

    updates = []
    params = []

    if moderation_posts != None:
        updates.append("moderation_posts=?")
        params.append(1 if moderation_posts in ["1", "true", True] else 0)

    if moderation_comments != None:
        updates.append("moderation_comments=?")
        params.append(1 if moderation_comments in ["1", "true", True] else 0)

    if moderation_new != None:
        updates.append("moderation_new=?")
        params.append(1 if moderation_new in ["1", "true", True] else 0)

    if new_user_days != None:
        if not mochi.text.valid(new_user_days, "natural"):
            a.error.label(400, "errors.invalid_new_user_days")
            return
        updates.append("new_user_days=?")
        params.append(int(new_user_days))

    if post_limit != None:
        if not mochi.text.valid(post_limit, "natural"):
            a.error.label(400, "errors.invalid_post_limit")
            return
        updates.append("post_limit=?")
        params.append(int(post_limit))

    if comment_limit != None:
        if not mochi.text.valid(comment_limit, "natural"):
            a.error.label(400, "errors.invalid_comment_limit")
            return
        updates.append("comment_limit=?")
        params.append(int(comment_limit))

    if limit_window != None:
        if not mochi.text.valid(limit_window, "natural"):
            a.error.label(400, "errors.invalid_limit_window")
            return
        val = int(limit_window)
        if val < 60:
            a.error.label(400, "errors.limit_window_must_be_at_least_60_seconds")
            return
        updates.append("limit_window=?")
        params.append(val)

    if updates:
        params.append(forum["id"])
        mochi.db.execute("update forums set " + ", ".join(updates) + " where id=?", *params)

    return {"data": {"success": True}}

# View moderation log
def action_moderation_log(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    if not check_access_remote(a, forum["id"], "moderate"):
        a.error.label(403, "errors.not_allowed_to_moderate")
        return

    # If we don't own the forum, proxy request to owner via P2P event
    if forum.get("owner") != 1:
        limit_str = a.input("limit")
        response = mochi.remote.request(forum["id"], "forums", "moderation/log", {"limit": limit_str or "50"})
        if response and response.get("error"):
            a.error(403, response["error"])
            return
        return {"data": response}

    limit_str = a.input("limit")
    limit = 50
    if limit_str and mochi.text.valid(limit_str, "natural"):
        limit = min(int(limit_str), 200)

    logs = mochi.db.rows(
        "select * from moderation where forum=? order by created desc limit ?",
        forum["id"], limit)

    # Look up names from members table
    for entry in logs:
        moderator = mochi.db.row("select name from members where forum=? and id=?", forum["id"], entry["moderator"])
        if moderator:
            entry["moderator_name"] = moderator["name"]
        # Look up author/target name
        if entry["author"]:
            author = mochi.db.row("select name from members where forum=? and id=?", forum["id"], entry["author"])
            if author:
                entry["author_name"] = author["name"]
        elif entry["type"] == "user":
            # For user restrictions, target is the user ID
            target = mochi.db.row("select name from members where forum=? and id=?", forum["id"], entry["target"])
            if target:
                entry["author_name"] = target["name"]

    return {"data": {"entries": logs}}

# Vote on a post
def action_post_vote(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    post_id = a.input("post")
    forum_id = a.input("forum")

    vote = a.input("vote")
    # "none" in URL path means remove vote
    if vote == "none":
        vote = ""
    if vote not in ["up", "down", ""]:
        a.error.label(400, "errors.invalid_vote")
        return

    user_id = a.user.identity.id

    # Try to find post locally
    post = mochi.db.row("select * from posts where id=?", post_id)

    if post:
        forum = get_forum(post["forum"])
        if not forum:
            a.error.label(404, "errors.forum_not_found")
            return

        # Check if we own this forum
        is_owner = forum.get("owner") == 1

        if is_owner:
            # Owner checks access locally
            if not check_access(a, forum["id"], "vote"):
                a.error.label(403, "errors.not_allowed_to_vote")
                return
            # We own the forum - process locally and broadcast to members
            # Remove old vote if exists
            old_vote = mochi.db.row("select vote from votes where post=? and comment='' and voter=?", post["id"], user_id)
            if old_vote:
                if old_vote["vote"] == "up":
                    mochi.db.execute("update posts set up=up-1 where id=? and up>0", post["id"])
                elif old_vote["vote"] == "down":
                    mochi.db.execute("update posts set down=down-1 where id=? and down>0", post["id"])

            # Add new vote or remove if empty
            if vote == "":
                mochi.db.execute("delete from votes where post=? and comment='' and voter=?", post["id"], user_id)
            else:
                mochi.db.execute("replace into votes ( forum, post, comment, voter, vote ) values ( ?, ?, '', ?, ? )",
                    forum["id"], post["id"], user_id, vote)

                if vote == "up":
                    mochi.db.execute("update posts set up=up+1 where id=?", post["id"])
                elif vote == "down":
                    mochi.db.execute("update posts set down=down+1 where id=?", post["id"])

            now = mochi.time.now()
            mochi.db.execute("update posts set updated=? where id=?", now, post["id"])
            mochi.db.execute("update forums set updated=? where id=?", now, forum["id"])

            # Broadcast update to members
            updated_post = mochi.db.row("select up, down from posts where id=?", post["id"])
            broadcast_event(forum["id"], "post/update",
                {"id": post["id"], "up": updated_post["up"], "down": updated_post["down"]},
                user_id)

            # Update user interests from vote
            if vote:
                update_interests_from_vote(post["id"], vote == "up")
        else:
            # We're a subscriber - check access with owner first
            access_response = mochi.remote.request(forum["id"], "forums", "access/check", {
                "operations": ["vote"],
                "user": user_id,
            })
            if not access_response.get("vote", False):
                a.error.label(403, "errors.not_allowed_to_vote")
                return

            # Send vote to forum owner
            mochi.message.send(
                {"from": user_id, "to": forum["id"], "service": "forums", "event": "post/vote"},
                {"post": post["id"], "vote": vote if vote else "none"}
            )

            # Save vote locally for optimistic UI
            # Remove old vote count if exists
            old_vote = mochi.db.row("select vote from votes where post=? and comment='' and voter=?", post["id"], user_id)
            if old_vote:
                if old_vote["vote"] == "up":
                    mochi.db.execute("update posts set up=up-1 where id=? and up>0", post["id"])
                elif old_vote["vote"] == "down":
                    mochi.db.execute("update posts set down=down-1 where id=? and down>0", post["id"])

            # Add new vote or remove if empty
            if vote == "":
                mochi.db.execute("delete from votes where post=? and comment='' and voter=?", post["id"], user_id)
            else:
                mochi.db.execute("replace into votes ( forum, post, comment, voter, vote ) values ( ?, ?, '', ?, ? )",
                    forum["id"], post["id"], user_id, vote)
                if vote == "up":
                    mochi.db.execute("update posts set up=up+1 where id=?", post["id"])
                elif vote == "down":
                    mochi.db.execute("update posts set down=down+1 where id=?", post["id"])

        return {
            "data": {"forum": forum["id"], "post": post["id"]}
        }

    # Post not found locally - send vote to remote forum
    if not forum_id or not mochi.text.valid(forum_id, "entity"):
        a.error.label(404, "errors.post_not_found")
        return

    # Check access with remote forum owner
    access_response = mochi.remote.request(forum_id, "forums", "access/check", {
        "operations": ["vote"],
        "user": user_id,
    })
    if not access_response.get("vote", False):
        a.error.label(403, "errors.not_allowed_to_vote")
        return

    mochi.message.send(
        {"from": user_id, "to": forum_id, "service": "forums", "event": "post/vote"},
        {"post": post_id, "vote": vote if vote else "none"}
    )

    return {
        "data": {"forum": forum_id, "post": post_id}
    }

# Vote on a comment
def action_comment_vote(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    comment_id = a.input("comment")
    forum_id = a.input("forum")

    vote = a.input("vote")
    # "none" in URL path means remove vote
    if vote == "none":
        vote = ""
    if vote not in ["up", "down", ""]:
        a.error.label(400, "errors.invalid_vote")
        return

    user_id = a.user.identity.id

    # Try to find comment locally
    comment = mochi.db.row("select * from comments where id=?", comment_id)

    if comment:
        forum = get_forum(comment["forum"])
        if not forum:
            a.error.label(404, "errors.forum_not_found")
            return

        # Check if we own this forum
        is_owner = forum.get("owner") == 1

        if is_owner:
            # Owner checks access locally
            if not check_access(a, forum["id"], "vote"):
                a.error.label(403, "errors.not_allowed_to_vote")
                return
            # We own the forum - process locally and broadcast to members
            # Remove old vote if exists
            old_vote = mochi.db.row("select vote from votes where comment=? and voter=?", comment["id"], user_id)
            if old_vote:
                if old_vote["vote"] == "up":
                    mochi.db.execute("update comments set up=up-1 where id=?", comment["id"])
                elif old_vote["vote"] == "down":
                    mochi.db.execute("update comments set down=down-1 where id=?", comment["id"])

            # Add new vote or remove if empty
            if vote == "":
                mochi.db.execute("delete from votes where comment=? and voter=?", comment["id"], user_id)
            else:
                mochi.db.execute("replace into votes ( forum, post, comment, voter, vote ) values ( ?, ?, ?, ?, ? )",
                    forum["id"], comment["post"], comment["id"], user_id, vote)

                if vote == "up":
                    mochi.db.execute("update comments set up=up+1 where id=?", comment["id"])
                elif vote == "down":
                    mochi.db.execute("update comments set down=down+1 where id=?", comment["id"])

            now = mochi.time.now()
            mochi.db.execute("update posts set updated=? where id=?", now, comment["post"])
            mochi.db.execute("update forums set updated=? where id=?", now, forum["id"])

            # Broadcast update to members
            updated_comment = mochi.db.row("select up, down from comments where id=?", comment["id"])
            broadcast_event(forum["id"], "comment/update",
                {"id": comment["id"], "post": comment["post"], "up": updated_comment["up"], "down": updated_comment["down"]},
                user_id)
        else:
            # We're a subscriber - check access with owner first
            access_response = mochi.remote.request(forum["id"], "forums", "access/check", {
                "operations": ["vote"],
                "user": user_id,
            })
            if not access_response.get("vote", False):
                a.error.label(403, "errors.not_allowed_to_vote")
                return

            # Send vote to forum owner
            mochi.message.send(
                {"from": user_id, "to": forum["id"], "service": "forums", "event": "comment/vote"},
                {"comment": comment["id"], "vote": vote if vote else "none"}
            )

            # Save vote locally for optimistic UI
            # Remove old vote count if exists
            old_vote = mochi.db.row("select vote from votes where comment=? and voter=?", comment["id"], user_id)
            if old_vote:
                if old_vote["vote"] == "up":
                    mochi.db.execute("update comments set up=up-1 where id=? and up>0", comment["id"])
                elif old_vote["vote"] == "down":
                    mochi.db.execute("update comments set down=down-1 where id=? and down>0", comment["id"])

            # Add new vote or remove if empty
            if vote == "":
                mochi.db.execute("delete from votes where comment=? and voter=?", comment["id"], user_id)
            else:
                mochi.db.execute("replace into votes ( forum, post, comment, voter, vote ) values ( ?, ?, ?, ?, ? )",
                    forum["id"], comment["post"], comment["id"], user_id, vote)
                if vote == "up":
                    mochi.db.execute("update comments set up=up+1 where id=?", comment["id"])
                elif vote == "down":
                    mochi.db.execute("update comments set down=down+1 where id=?", comment["id"])

        return {
            "data": {"forum": forum["id"], "post": comment["post"]}
        }

    # Comment not found locally - send vote to remote forum
    if not forum_id or not mochi.text.valid(forum_id, "entity"):
        a.error.label(404, "errors.comment_not_found")
        return

    # Check access with remote forum owner
    access_response = mochi.remote.request(forum_id, "forums", "access/check", {
        "operations": ["vote"],
        "user": user_id,
    })
    if not access_response.get("vote", False):
        a.error.label(403, "errors.not_allowed_to_vote")
        return

    mochi.message.send(
        {"from": user_id, "to": forum_id, "service": "forums", "event": "comment/vote"},
        {"comment": comment_id, "vote": vote if vote else "none"}
    )

    return {
        "data": {"forum": forum_id, "comment": comment_id}
    }


# ACCESS MANAGEMENT

# Get access rules for a forum
def action_access(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    if not check_access(a, forum["id"], "manage"):
        a.error.label(403, "errors.not_allowed")
        return

    # Get owner - if we own this entity, use current user's info
    owner = None
    if forum.get("owner") == 1:
        if a.user and a.user.identity:
            owner = {"id": a.user.identity.id, "name": a.user.identity.name}

    resource = "forum/" + forum["id"]
    rules = mochi.access.list.resource(resource)

    # Group rules by subject to handle deny rules correctly
    subjects = {}
    for rule in rules:
        subject = rule.get("subject", "")
        grant = rule.get("grant", 1)
        operation = rule.get("operation", "")

        if subject not in subjects:
            subjects[subject] = {"grant": grant, "operation": operation}
        elif grant == 0:
            # Deny rule takes precedence
            subjects[subject] = {"grant": 0, "operation": "none"}
        elif subjects[subject]["grant"] == 1:
            # Keep the allow rule (they're equivalent since we store one level)
            pass

    # Build access list with resolved names
    access_list = []
    for subject, info in subjects.items():
        # Resolve names for subjects
        name = ""
        if subject and subject not in ("*", "+") and not subject.startswith("#"):
            if subject.startswith("@"):
                # Look up group name
                group_id = subject[1:]  # Remove @ prefix
                group = mochi.group.get(group_id)
                if group:
                    name = group.get("name", group_id)
            elif mochi.text.valid(subject, "entity"):
                # Try directory first (for user identities), then local entities
                entry = mochi.directory.get(subject)
                if entry:
                    name = entry.get("name", "")
                else:
                    entity = mochi.entity.info(subject)
                    if entity:
                        name = entity.get("name", "")

        is_owner = owner and subject == owner.get("id")
        level = "none" if info["grant"] == 0 else info["operation"]
        access_list.append({
            "id": subject,
            "name": name,
            "level": level,
            "isOwner": is_owner
        })

    return {
        "data": {
            "forum": forum,
            "access": access_list,
            "levels": ACCESS_LEVELS
        }
    }

# Set access level for a user
def action_access_set(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    if not check_access(a, forum["id"], "manage"):
        a.error.label(403, "errors.not_allowed")
        return

    target = a.input("target")
    # Allow special subjects (*, +), groups (@name), and valid entity IDs
    if target not in ["*", "+"] and not target.startswith("@") and not mochi.text.valid(target, "entity"):
        a.error.label(400, "errors.invalid_target")
        return

    level = a.input("level")
    if level not in ACCESS_LEVELS + ["none"]:
        a.error.label(400, "errors.invalid_access_level")
        return

    resource = "forum/" + forum["id"]
    granter = a.user.identity.id

    # Revoke all existing access levels first
    for op in ACCESS_LEVELS + ["manage", "*"]:
        mochi.access.revoke(target, resource, op)

    # Set the new level
    if level == "none":
        # Store deny rules for all levels to block access
        for op in ACCESS_LEVELS:
            mochi.access.deny(target, resource, op, granter)
    else:
        # Grant the new level
        mochi.access.allow(target, resource, level, granter)

    return {
        "data": {"forum": forum["id"], "target": target, "level": level}
    }

# Revoke all access for a user
def action_access_revoke(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    if not check_access(a, forum["id"], "manage"):
        a.error.label(403, "errors.not_allowed")
        return

    target = a.input("target")
    # Allow special subjects (*, +), groups (@name), and valid entity IDs
    if target not in ["*", "+"] and not target.startswith("@") and not mochi.text.valid(target, "entity"):
        a.error.label(400, "errors.invalid_target")
        return

    resource = "forum/" + forum["id"]

    # Revoke all access levels
    for op in ACCESS_LEVELS + ["manage", "*"]:
        mochi.access.revoke(target, resource, op)

    return {
        "data": {"forum": forum["id"], "target": target}
    }


# EVENTS

# Handle attachment view request from subscriber (stream-based request/response)
def event_attachment_view(e):
    forum_id = e.header("to")

    # Read request data from stream
    request = e.stream.read()
    if not request:
        e.stream.write({"status": "400", "error": "No request data"})
        return
    attachment_id = request.get("attachment", "")
    want_thumbnail = request.get("thumbnail", False)

    # Get forum data - check if we own this forum
    forum = mochi.db.row("select * from forums where id=?", forum_id)
    if not forum:
        e.stream.write({"status": "404", "error": "Forum not found"})
        return

    # Check access for private forums only (public forums allow anyone to view attachments)
    entity = mochi.entity.info(forum_id)
    forum_privacy = entity.get("privacy", "public") if entity else "public"
    if forum_privacy == "private":
        requester = e.header("from")
        if not check_event_access(requester, forum_id, "view"):
            e.stream.write({"status": "403", "error": "Not allowed to view this forum"})
            return

    # Verify attachment exists
    if not mochi.attachment.exists(attachment_id):
        e.stream.write({"status": "404", "error": "Attachment not found"})
        return

    # Get the file path (thumbnail or original)
    if want_thumbnail:
        path = mochi.attachment.thumbnail(attachment_id)
        if not path:
            path = mochi.attachment.path(attachment_id)
        content_type = "image/jpeg"  # Thumbnails are always JPEG
    else:
        path = mochi.attachment.path(attachment_id)
        content_type = "application/octet-stream"

    if not path:
        e.stream.write({"status": "404", "error": "Attachment file not found"})
        return
    e.stream.write({"status": "200", "content_type": content_type})
    e.write.file(path)

# Received a comment from forum owner
def event_mention_notify(e):
	"""Member receives a mention notification from a forum owner."""
	forum_id = e.header("from")
	title = e.content("title") or ""
	excerpt = e.content("excerpt") or ""
	author = e.content("author") or "Someone"
	url = e.content("url") or "/forums"
	notify("mention", forum_id, title, author + " mentioned you: " + excerpt, url)

def event_comment_create_event(e):
    forum = get_forum(e.header("from"))
    if not forum:
        return

    id = e.content("id")
    if not mochi.text.valid(id, "id"):
        return

    up = e.content("up") or 0
    down = e.content("down") or 0

    # If comment exists, update vote counts and mark as approved (for subscription sync and approval notification)
    if mochi.db.exists("select id from comments where id=?", id):
        mochi.db.execute("update comments set up=?, down=?, status='approved' where id=?", up, down, id)
        return

    post = e.content("post")
    if not mochi.db.exists("select id from posts where forum=? and id=?", forum["id"], post):
        return

    parent = e.content("parent") or ""
    member = e.content("member")
    name = e.content("name")
    body = e.content("body")
    created = e.content("created")

    if not mochi.text.valid(member, "entity"):
        return
    if not mochi.text.valid(name, "name"):
        return
    if not mochi.text.valid(body, "text"):
        return

    # Validate timestamp is within reasonable range (not more than 1 day in future or 1 year in past)
    now = mochi.time.now()
    if created > now + 86400 or created < now - 31536000:
        return

    mochi.db.execute("replace into comments ( id, forum, post, parent, member, name, body, up, down, created ) values ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ? )",
        id, forum["id"], post, parent, member, name, body, up, down, created)

    # Store attachment metadata from the event
    attachments = e.content("attachments") or []
    if attachments:
        mochi.attachment.store(attachments, e.header("from"), id)

    mochi.db.execute("update posts set updated=?, comments=comments+1 where id=?", created, post)
    mochi.db.execute("update forums set updated=? where id=?", created, forum["id"])

# Received a comment submission from member (we are forum owner)
def event_comment_submit_event(e):
    forum = get_forum(e.header("to"))
    if not forum:
        return

    sender_id = e.header("from")
    if not check_event_access(sender_id, forum["id"], "comment"):
        return

    # Check for restrictions
    restriction_error = check_restriction(forum["id"], sender_id, "comment")
    if restriction_error:
        return

    # Check rate limit (skip for moderators)
    if not check_event_access(sender_id, forum["id"], "moderate"):
        rate_error = check_rate_limit(forum, sender_id, "comment")
        if rate_error:
            return

    # Get sender name from members table, fall back to directory lookup
    member = mochi.db.row("select name from members where forum=? and id=?", forum["id"], sender_id)
    sender_name = member["name"] if member and member["name"] else ""
    if not sender_name:
        entity = mochi.directory.get(sender_id)
        sender_name = entity["name"] if entity and entity["name"] else "Anonymous"

    id = e.content("id")
    if not mochi.text.valid(id, "id"):
        return

    if mochi.db.exists("select id from comments where id=?", id):
        return  # Duplicate

    post_id = e.content("post")
    post = mochi.db.row("select * from posts where forum=? and id=?", forum["id"], post_id)
    if not post:
        return

    # Check if post is locked
    if post.get("locked"):
        return

    parent = e.content("parent") or ""
    if parent and not mochi.db.exists("select id from comments where forum=? and post=? and id=?", forum["id"], post_id, parent):
        return

    body = e.content("body")
    if not mochi.text.valid(body, "text"):
        return

    now = mochi.time.now()

    # Determine initial status
    status = "approved"
    if is_shadowbanned(forum["id"], sender_id):
        status = "removed"
    elif requires_premoderation(forum, sender_id, "comment"):
        status = "pending"

    mochi.db.execute("replace into comments ( id, forum, post, parent, member, name, body, status, created ) values ( ?, ?, ?, ?, ?, ?, ?, ?, ? )",
        id, forum["id"], post_id, parent, sender_id, sender_name, body, status, now)

    # Store attachment metadata from the subscriber's event
    attachments = e.content("attachments") or []
    if attachments:
        mochi.attachment.store(attachments, sender_id, id)

    mochi.db.execute("update posts set updated=?, comments=comments+1 where id=?", now, post_id)
    mochi.db.execute("update forums set updated=? where id=?", now, forum["id"])

    # Only broadcast if approved
    if status == "approved":
        comment_data = {
            "id": id,
            "post": post_id,
            "parent": parent,
            "member": sender_id,
            "name": sender_name,
            "body": body,
            "created": now
        }
        if attachments:
            comment_data["attachments"] = attachments

        broadcast_event(forum["id"], "comment/create", comment_data)
        if body:
            notify_mentions(forum["id"], post_id, body, sender_id, sender_name)

# Received a comment edit request from member (we are forum owner)
def event_comment_edit_submit_event(e):
    forum = get_forum(e.header("to"))
    if not forum:
        return

    sender_id = e.header("from")
    comment_id = e.content("id")
    if not mochi.text.valid(comment_id, "id"):
        return

    comment = mochi.db.row("select * from comments where forum=? and id=?", forum["id"], comment_id)
    if not comment:
        return

    # Check authorization: must be comment author
    if sender_id != comment["member"]:
        return

    body = e.content("body")
    if not mochi.text.valid(body, "text"):
        return

    now = mochi.time.now()

    # Update the comment
    mochi.db.execute("update comments set body=?, edited=? where id=?", body, now, comment_id)
    mochi.db.execute("update posts set updated=? where id=?", now, comment["post"])
    mochi.db.execute("update forums set updated=? where id=?", now, forum["id"])

    # Broadcast update to all members
    comment_data = {
        "id": comment_id,
        "post": comment["post"],
        "body": body,
        "edited": now
    }
    broadcast_event(forum["id"], "comment/edit", comment_data)

# Received a comment delete request from member (we are forum owner)
def event_comment_delete_submit_event(e):
    forum = get_forum(e.header("to"))
    if not forum:
        return

    sender_id = e.header("from")
    comment_id = e.content("id")
    if not mochi.text.valid(comment_id, "id"):
        return

    comment = mochi.db.row("select * from comments where forum=? and id=?", forum["id"], comment_id)
    if not comment:
        return

    # Check authorization: must be comment author
    if sender_id != comment["member"]:
        return

    # Recursively collect all descendant comment IDs
    def collect_descendants(parent_id):
        ids = []
        children = mochi.db.rows("select id from comments where forum=? and post=? and parent=?",
            forum["id"], comment["post"], parent_id)
        for child in children:
            ids.append(child["id"])
            ids.extend(collect_descendants(child["id"]))
        return ids

    # Get all comment IDs to delete (this comment + descendants)
    comment_ids = [comment_id] + collect_descendants(comment_id)
    deleted_count = len(comment_ids)

    # Delete attachments for these comments
    for cid in comment_ids:
        attachments = mochi.attachment.list(cid, forum["id"])
        for att in attachments:
            mochi.attachment.delete(att["id"])

    # Delete votes for these comments
    for cid in comment_ids:
        mochi.db.execute("delete from votes where comment=?", cid)

    # Delete the comments
    for cid in comment_ids:
        mochi.db.execute("delete from comments where id=?", cid)

    now = mochi.time.now()
    mochi.db.execute("update posts set updated=?, comments=comments-? where id=?", now, deleted_count, comment["post"])
    mochi.db.execute("update forums set updated=? where id=?", now, forum["id"])

    # Broadcast delete to all members (they will recursively delete descendants)
    broadcast_event(forum["id"], "comment/delete", {"ids": [comment_id], "post": comment["post"]})

# Received a comment update from forum owner
def event_comment_update_event(e):
    id = e.content("id")
    forum_id = e.header("from")
    old_comment = mochi.db.row("select * from comments where forum=? and id=?", forum_id, id)
    if not old_comment:
        return

    now = mochi.time.now()
    up = e.content("up") or 0
    down = e.content("down") or 0
    mochi.db.execute("update comments set up=?, down=? where id=?", up, down, id)
    mochi.db.execute("update posts set updated=? where id=?", now, old_comment["post"])
    mochi.db.execute("update forums set updated=? where id=?", now, old_comment["forum"])

# Received a comment edit from forum owner
def event_comment_edit_event(e):
    id = e.content("id")
    forum_id = e.header("from")
    old_comment = mochi.db.row("select * from comments where forum=? and id=?", forum_id, id)
    if not old_comment:
        return

    body = e.content("body")
    edited = e.content("edited")

    if not mochi.text.valid(body, "text"):
        return

    now = mochi.time.now()
    mochi.db.execute("update comments set body=?, edited=? where id=?", body, edited, id)
    mochi.db.execute("update posts set updated=? where id=?", now, old_comment["post"])
    mochi.db.execute("update forums set updated=? where id=?", now, old_comment["forum"])

# Received a comment delete from forum owner
def event_comment_delete_event(e):
    forum_id = e.header("from")
    forum = get_forum(forum_id)
    if not forum:
        return

    # Get the list of comment IDs to delete
    comment_ids = e.content("ids")
    post_id = e.content("post")
    if not comment_ids:
        comment_ids = []

    if not comment_ids or not post_id:
        return

    deleted_count = 0
    for comment_id in comment_ids:
        # Verify this comment belongs to this forum
        if mochi.db.exists("select id from comments where id=? and forum=?", comment_id, forum_id):
            # Delete attachments for this comment
            attachments = mochi.attachment.list(comment_id, forum_id)
            for att in attachments:
                mochi.attachment.delete(att["id"])
            # Delete votes for this comment
            mochi.db.execute("delete from votes where comment=?", comment_id)
            # Delete the comment
            mochi.db.execute("delete from comments where id=?", comment_id)
            deleted_count += 1

    if deleted_count > 0:
        now = mochi.time.now()
        mochi.db.execute("update posts set updated=?, comments=comments-? where id=?",
            now, deleted_count, post_id)
        mochi.db.execute("update forums set updated=? where id=?", now, forum_id)

# Received a comment vote from member (we are forum owner)
def event_comment_vote_event(e):
    comment_id = e.content("comment")
    if not comment_id:
        return

    comment = mochi.db.row("select * from comments where id=?", comment_id)
    if not comment:
        return

    forum = get_forum(comment["forum"])
    if not forum:
        return

    sender_id = e.header("from")
    if not check_event_access(sender_id, forum["id"], "vote"):
        return

    vote = e.content("vote")
    # Handle "none" as vote removal
    if vote == "none":
        vote = ""
    if vote not in ["up", "down", ""]:
        return

    # Delete old vote first to minimize race window, then adjust counts
    old_vote = mochi.db.row("select vote from votes where comment=? and voter=?", comment_id, sender_id)
    mochi.db.execute("delete from votes where comment=? and voter=?", comment_id, sender_id)

    # Adjust count for removed vote (with guards to prevent negative)
    if old_vote:
        if old_vote["vote"] == "up":
            mochi.db.execute("update comments set up=up-1 where id=? and up>0", comment_id)
        elif old_vote["vote"] == "down":
            mochi.db.execute("update comments set down=down-1 where id=? and down>0", comment_id)

    # Add new vote if not empty
    if vote != "":
        mochi.db.execute("insert or replace into votes ( forum, post, comment, voter, vote ) values ( ?, ?, ?, ?, ? )",
            forum["id"], comment["post"], comment_id, sender_id, vote)

        if vote == "up":
            mochi.db.execute("update comments set up=up+1 where id=?", comment_id)
        elif vote == "down":
            mochi.db.execute("update comments set down=down+1 where id=?", comment_id)

    now = mochi.time.now()
    mochi.db.execute("update posts set updated=? where id=?", now, comment["post"])
    mochi.db.execute("update forums set updated=? where id=?", now, forum["id"])

    # Broadcast update to all members except sender
    updated_comment = mochi.db.row("select up, down from comments where id=?", comment_id)
    broadcast_event(forum["id"], "comment/update",
        {"id": comment_id, "post": comment["post"], "up": updated_comment["up"], "down": updated_comment["down"]},
        sender_id)

# Received a member access update from forum owner
def event_member_update_event(e):
    forum = get_forum(e.header("from"))
    if not forum:
        return

    # Access is now managed via mochi.access, so this event is a no-op for subscribers.
    # The forum owner grants/revokes access directly via mochi.access API.
    # This event could be used for notifications in the future.

# Received a post from forum owner
def event_post_create_event(e):
    forum_id = e.header("from")
    forum = get_forum(forum_id)
    if not forum:
        return

    id = e.content("id")
    if not mochi.text.valid(id, "id"):
        return

    up = e.content("up") or 0
    down = e.content("down") or 0
    comments_count = e.content("comments") or 0

    # If post exists, update vote counts and status (for subscription sync and approval)
    if mochi.db.exists("select id from posts where id=?", id):
        mochi.db.execute("update posts set up=?, down=?, comments=?, status='approved' where id=?", up, down, comments_count, id)
        return

    member = e.content("member")
    name = e.content("name")
    title = e.content("title")
    body = e.content("body")
    created = e.content("created")

    if not mochi.text.valid(member, "entity"):
        return
    if not mochi.text.valid(name, "name"):
        return
    if not mochi.text.valid(title, "name"):
        return
    if not mochi.text.valid(body, "text"):
        return

    # Validate timestamp is within reasonable range (not more than 1 day in future or 1 year in past)
    now = mochi.time.now()
    if created > now + 86400 or created < now - 31536000:
        return

    mochi.db.execute("replace into posts ( id, forum, member, name, title, body, up, down, comments, created, updated ) values ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? )",
        id, forum["id"], member, name, title, body, up, down, comments_count, created, created)

    # Store attachment metadata from the event
    attachments = e.content("attachments") or []
    if attachments:
        mochi.attachment.store(attachments, e.header("from"), id)

    mochi.db.execute("update forums set updated=? where id=?", created, forum["id"])

# Received a post submission from member (we are forum owner)
def event_post_submit_event(e):
    forum = get_forum(e.header("to"))
    if not forum:
        return

    sender_id = e.header("from")
    if not check_event_access(sender_id, forum["id"], "post"):
        return

    # Check for restrictions
    restriction_error = check_restriction(forum["id"], sender_id, "post")
    if restriction_error:
        return

    # Check rate limit (skip for moderators)
    if not check_event_access(sender_id, forum["id"], "moderate"):
        rate_error = check_rate_limit(forum, sender_id, "post")
        if rate_error:
            return

    # Get sender name from members table, fall back to directory lookup
    member = mochi.db.row("select name from members where forum=? and id=?", forum["id"], sender_id)
    sender_name = member["name"] if member and member["name"] else ""
    if not sender_name:
        entity = mochi.directory.get(sender_id)
        sender_name = entity["name"] if entity and entity["name"] else "Anonymous"

    id = e.content("id")
    if not mochi.text.valid(id, "id"):
        return

    if mochi.db.exists("select id from posts where id=?", id):
        return  # Duplicate

    title = e.content("title")
    if not mochi.text.valid(title, "name"):
        return

    body = e.content("body")
    if not mochi.text.valid(body, "text"):
        return

    now = mochi.time.now()

    # Determine initial status
    status = "approved"
    if is_shadowbanned(forum["id"], sender_id):
        status = "removed"
    elif requires_premoderation(forum, sender_id, "post"):
        status = "pending"

    mochi.db.execute("replace into posts ( id, forum, member, name, title, body, status, created, updated ) values ( ?, ?, ?, ?, ?, ?, ?, ?, ? )",
        id, forum["id"], sender_id, sender_name, title, body, status, now, now)

    # Store attachment metadata from the subscriber's event
    attachments = e.content("attachments") or []
    if attachments:
        mochi.attachment.store(attachments, sender_id, id)

    mochi.db.execute("update forums set updated=? where id=?", now, forum["id"])

    # Only broadcast if approved
    if status == "approved":
        post_data = {
            "id": id,
            "member": sender_id,
            "name": sender_name,
            "title": title,
            "body": body,
            "created": now
        }
        if attachments:
            post_data["attachments"] = attachments

        broadcast_event(forum["id"], "post/create", post_data)
        if body:
            notify_mentions(forum["id"], id, body, sender_id, sender_name)

        # Schedule AI tagging
        if forum.get("ai_mode", ""):
            mochi.schedule.after("ai/tag", {"forum": forum["id"], "post": id}, 0)

# Received a post edit request from member (we are forum owner)
def event_post_edit_submit_event(e):
    forum = get_forum(e.header("to"))
    if not forum:
        return

    sender_id = e.header("from")
    post_id = e.content("id")
    if not mochi.text.valid(post_id, "id"):
        return

    post = mochi.db.row("select * from posts where forum=? and id=?", forum["id"], post_id)
    if not post:
        return

    # Check authorization: must be post author
    if sender_id != post["member"]:
        return

    title = e.content("title")
    if not mochi.text.valid(title, "name"):
        return

    body = e.content("body")
    if not mochi.text.valid(body, "text"):
        return

    now = mochi.time.now()

    # Store new attachment metadata from the subscriber's event
    new_attachments = e.content("attachments") or []
    if new_attachments:
        mochi.attachment.store(new_attachments, sender_id, post_id)

    # Handle attachment changes
    order = e.content("order") or []

    # Get current attachments and delete any not in the order list
    current_attachments = mochi.attachment.list(post_id, forum["id"])
    current_ids = [att["id"] for att in current_attachments]

    # Delete attachments not in order (those being removed)
    for att_id in current_ids:
        if att_id not in order:
            mochi.attachment.delete(att_id, [])

    # Reorder attachments according to order
    for i, att_id in enumerate(order):
        mochi.attachment.move(att_id, i + 1, [])

    # Update the post
    mochi.db.execute("update posts set title=?, body=?, updated=?, edited=? where id=?", title, body, now, now, post_id)
    mochi.db.execute("update forums set updated=? where id=?", now, forum["id"])

    # Broadcast update to all members with attachment metadata
    post_data = {
        "id": post_id,
        "title": title,
        "body": body,
        "edited": now
    }
    post_data["attachments"] = mochi.attachment.list(post_id, forum["id"])
    broadcast_event(forum["id"], "post/edit", post_data)

    # Re-tag with AI if enabled
    if forum.get("ai_mode", ""):
        mochi.db.execute("delete from tags where object=? and source='ai'", post_id)
        mochi.schedule.after("ai/tag", {"forum": forum["id"], "post": post_id}, 0)

# Received a post delete request from member (we are forum owner)
def event_post_delete_submit_event(e):
    forum = get_forum(e.header("to"))
    if not forum:
        return

    sender_id = e.header("from")
    post_id = e.content("id")
    if not mochi.text.valid(post_id, "id"):
        return

    post = mochi.db.row("select * from posts where forum=? and id=?", forum["id"], post_id)
    if not post:
        return

    # Check authorization: must be post author
    if sender_id != post["member"]:
        return

    # Delete tags for this post
    mochi.db.execute("delete from tags where object=?", post_id)

    # Delete all attachments for this post
    attachments = mochi.attachment.list(post_id, forum["id"])
    for att in attachments:
        mochi.attachment.delete(att["id"])

    # Delete votes for all comments on this post
    mochi.db.execute("delete from votes where forum=? and post=?", forum["id"], post_id)

    # Delete all comments on this post
    mochi.db.execute("delete from comments where forum=? and post=?", forum["id"], post_id)

    # Delete the post
    mochi.db.execute("delete from posts where id=?", post_id)

    now = mochi.time.now()
    mochi.db.execute("update forums set updated=? where id=?", now, forum["id"])

    # Broadcast delete to all members
    broadcast_event(forum["id"], "post/delete", {"id": post_id})

# Received a post update from forum owner
def event_post_update_event(e):
    id = e.content("id")
    if not id:
        return

    forum_id = e.header("from")
    old_post = mochi.db.row("select * from posts where forum=? and id=?", forum_id, id)
    if not old_post:
        return

    up = e.content("up")
    down = e.content("down")
    if up == None:
        up = 0
    if down == None:
        down = 0

    now = mochi.time.now()
    mochi.db.execute("update posts set up=?, down=? where id=?", up, down, id)
    mochi.db.execute("update posts set updated=? where id=?", now, id)
    mochi.db.execute("update forums set updated=? where id=?", now, old_post["forum"])

# Received a post edit from forum owner
def event_post_edit_event(e):
    id = e.content("id")
    if not id:
        return

    forum_id = e.header("from")
    old_post = mochi.db.row("select * from posts where forum=? and id=?", forum_id, id)
    if not old_post:
        return

    title = e.content("title")
    body = e.content("body")
    edited = e.content("edited")

    if not mochi.text.valid(title, "name"):
        return
    if not mochi.text.valid(body, "text"):
        return

    now = mochi.time.now()
    mochi.db.execute("update posts set title=?, body=?, updated=?, edited=? where id=?",
        title, body, now, edited, id)

    # Update attachments from event
    attachments = e.content("attachments")
    if attachments != None:
        mochi.attachment.clear(id, [])
        if attachments:
            mochi.attachment.store(attachments, e.header("from"), id)

    mochi.db.execute("update forums set updated=? where id=?", now, old_post["forum"])

# Received a post delete from forum owner
def event_post_delete_event(e):
    id = e.content("id")
    if not id:
        return

    forum_id = e.header("from")
    old_post = mochi.db.row("select * from posts where forum=? and id=?", forum_id, id)
    if not old_post:
        return

    forum_id = old_post["forum"]

    # Delete tags for this post
    mochi.db.execute("delete from tags where object=?", id)

    # Delete all attachments for this post
    attachments = mochi.attachment.list(id, forum_id)
    for att in attachments:
        mochi.attachment.delete(att["id"])

    # Delete votes for all comments on this post
    mochi.db.execute("delete from votes where forum=? and post=?", forum_id, id)

    # Delete all comments on this post
    mochi.db.execute("delete from comments where forum=? and post=?", forum_id, id)

    # Delete the post
    mochi.db.execute("delete from posts where id=?", id)

    now = mochi.time.now()
    mochi.db.execute("update forums set updated=? where id=?", now, forum_id)

# Received a post vote from member (we are forum owner)
def event_post_vote_event(e):
    post_id = e.content("post")
    if not post_id:
        return

    post = mochi.db.row("select * from posts where id=?", post_id)
    if not post:
        return

    forum = get_forum(post["forum"])
    if not forum:
        return

    sender_id = e.header("from")
    if not check_event_access(sender_id, forum["id"], "vote"):
        return

    vote = e.content("vote")
    # Handle "none" as vote removal
    if vote == "none":
        vote = ""
    if vote not in ["up", "down", ""]:
        return

    # Remove old vote if exists
    old_vote = mochi.db.row("select vote from votes where post=? and comment='' and voter=?", post_id, sender_id)
    if old_vote:
        if old_vote["vote"] == "up":
            mochi.db.execute("update posts set up=up-1 where id=? and up>0", post_id)
        elif old_vote["vote"] == "down":
            mochi.db.execute("update posts set down=down-1 where id=? and down>0", post_id)

    # Add new vote or remove if empty
    if vote == "":
        mochi.db.execute("delete from votes where post=? and comment='' and voter=?", post_id, sender_id)
    else:
        mochi.db.execute("replace into votes ( forum, post, comment, voter, vote ) values ( ?, ?, '', ?, ? )",
            forum["id"], post_id, sender_id, vote)

        if vote == "up":
            mochi.db.execute("update posts set up=up+1 where id=?", post_id)
        elif vote == "down":
            mochi.db.execute("update posts set down=down+1 where id=?", post_id)

    now = mochi.time.now()
    mochi.db.execute("update posts set updated=? where id=?", now, post_id)
    mochi.db.execute("update forums set updated=? where id=?", now, forum["id"])

    # Broadcast update to all members except sender
    updated_post = mochi.db.row("select up, down from posts where id=?", post_id)
    broadcast_event(forum["id"], "post/update",
        {"id": post_id, "up": updated_post["up"], "down": updated_post["down"]},
        sender_id)

# Handle tag add event from forum owner
def event_tag_add(e):
    forum_id = e.header("from")
    forum = get_forum(forum_id)
    if not forum:
        return
    tag_id = e.content("id")
    object_id = e.content("object")
    label = e.content("label")
    if not tag_id or not object_id or not label:
        return
    qid = e.content("qid") or ""
    relevance = e.content("relevance") or 0
    source = e.content("source") or "manual"
    mochi.db.execute("insert or ignore into tags (id, object, label, qid, relevance, source) values (?, ?, ?, ?, ?, ?)", tag_id, object_id, label, qid, relevance, source)

# Handle tag remove event from forum owner
def event_tag_remove(e):
    forum_id = e.header("from")
    forum = get_forum(forum_id)
    if not forum:
        return
    tag_id = e.content("id")
    if not tag_id:
        return
    mochi.db.execute("delete from tags where id=?", tag_id)

# Received a subscribe request from member (we are forum owner)
def event_subscribe_event(e):
    forum = get_forum(e.header("to"))
    if not forum:
        return

    member_id = e.header("from")
    name = e.content("name")

    if not mochi.text.valid(member_id, "entity"):
        return
    if not mochi.text.valid(name, "name"):
        return

    # Add as subscriber if not already a member
    if not mochi.db.exists("select id from members where forum=? and id=?", forum["id"], member_id):
        now = mochi.time.now()
        mochi.db.execute("replace into members ( forum, id, name, subscribed ) values ( ?, ?, ?, ? )",
            forum["id"], member_id, name, now)

        # Update member count
        members = mochi.db.rows("select id from members where forum=?", forum["id"])
        mochi.db.execute("update forums set members=?, updated=? where id=?", len(members), now, forum["id"])

        # Send recent posts to new member with attachment metadata
        posts = mochi.db.rows("select * from posts where forum=? order by created desc limit 20", forum["id"])
        mochi.log.info("event_subscribe: sending %v posts to %v", len(posts), member_id)
        for p in posts:
            post_data = {
                "id": p["id"],
                "member": p["member"],
                "name": p["name"],
                "title": p["title"],
                "body": p["body"],
                "up": p["up"],
                "down": p["down"],
                "comments": p["comments"],
                "created": p["created"],
                "sync": True
            }
            post_data["attachments"] = mochi.attachment.list(p["id"], forum["id"])
            mochi.message.send(
                {"from": forum["id"], "to": member_id, "service": "forums", "event": "post/create"},
                post_data
            )

            # Send comments for this post with attachment metadata
            comments = mochi.db.rows("select * from comments where forum=? and post=? order by created asc", forum["id"], p["id"])
            for c in comments:
                comment_data = {
                    "id": c["id"],
                    "post": c["post"],
                    "parent": c["parent"],
                    "member": c["member"],
                    "name": c["name"],
                    "body": c["body"],
                    "up": c["up"],
                    "down": c["down"],
                    "created": c["created"],
                    "sync": True
                }
                comment_data["attachments"] = mochi.attachment.list(c["id"], forum["id"])
                mochi.message.send(
                    {"from": forum["id"], "to": member_id, "service": "forums", "event": "comment/create"},
                    comment_data
                )

            # Send tags for this post
            post_tags = mochi.db.rows("select id, object, label, qid, relevance, source from tags where object=?", p["id"]) or []
            for t in post_tags:
                mochi.message.send(
                    {"from": forum["id"], "to": member_id, "service": "forums", "event": "tag/add"},
                    {"id": t["id"], "object": t["object"], "label": t["label"], "qid": t.get("qid", ""), "relevance": t.get("relevance", 0), "source": t.get("source", "manual")}
                )

        # Notify all members of new subscription
        broadcast_event(forum["id"], "update", {"members": len(members)}, member_id)

# Received an unsubscribe request from member (we are forum owner)
def event_unsubscribe_event(e):
    forum = get_forum(e.header("to"))
    if not forum:
        return

    member_id = e.header("from")

    # Clean up member's votes and adjust comment vote counts
    votes = mochi.db.rows("select comment, vote from votes where forum=? and voter=?", forum["id"], member_id)
    for v in votes:
        if v["vote"] == "up":
            mochi.db.execute("update comments set up=up-1 where id=? and up>0", v["comment"])
        elif v["vote"] == "down":
            mochi.db.execute("update comments set down=down-1 where id=? and down>0", v["comment"])
    mochi.db.execute("delete from votes where forum=? and voter=?", forum["id"], member_id)

    # Remove from members table
    mochi.db.execute("delete from members where forum=? and id=?", forum["id"], member_id)

    # Revoke all access
    resource = "forum/" + forum["id"]
    for op in ACCESS_LEVELS + ["manage", "*"]:
        mochi.access.revoke(member_id, resource, op)

    # Update member count and notify remaining members
    members = mochi.db.rows("select id from members where forum=?", forum["id"])
    mochi.db.execute("update forums set members=?, updated=? where id=?", len(members), mochi.time.now(), forum["id"])

    broadcast_event(forum["id"], "update", {"members": len(members)})

# Received a forum update from forum owner
def event_update_event(e):
    forum_id = e.header("from")
    forum = get_forum(forum_id)
    if not forum:
        return

    # Don't update forums we own
    if forum.get("owner") == 1:
        return

    # Handle name update
    name = e.content("name")
    if name:
        mochi.db.execute("update forums set name=?, updated=? where id=?", name, mochi.time.now(), forum_id)
        return

    # Handle banner update
    banner = e.content("banner")
    if banner != None:
        mochi.db.execute("update forums set banner=?, updated=? where id=?", banner, mochi.time.now(), forum_id)
        return

    # Handle member count update
    members = e.content("members")
    if type(members) != "int" or members < 0:
        return

    mochi.db.execute("update forums set members=?, updated=? where id=?", members, mochi.time.now(), forum_id)

# MODERATION EVENTS

# Received a post removal request from moderator (we are forum owner)
def event_post_remove_submit_event(e):
    forum = get_forum(e.header("to"))
    if not forum:
        return

    sender = e.header("from")
    if not check_event_access(sender, forum["id"], "moderate"):
        return

    post_id = e.content("id")
    post = mochi.db.row("select * from posts where id=? and forum=?", post_id, forum["id"])
    if not post or post.get("status") == "removed":
        return

    reason = e.content("reason") or ""
    now = mochi.time.now()

    mochi.db.execute(
        "update posts set status='removed', remover=?, reason=?, updated=? where id=?",
        sender, reason, now, post_id)

    log_moderation(forum["id"], sender, "remove", "post", post_id, post["member"], reason)
    notify_moderation_action(forum["id"], post["member"], "remove", "post", reason)

    broadcast_event(forum["id"], "post/remove", {"id": post_id, "remover": sender, "reason": reason})

# Received a post removal from forum owner
def event_post_remove_event(e):
    forum = get_forum(e.header("from"))
    if not forum:
        return

    # Don't update forums we own
    if forum.get("owner") == 1:
        return

    post_id = e.content("id")
    remover = e.content("remover")
    reason = e.content("reason") or ""

    mochi.db.execute(
        "update posts set status='removed', remover=?, reason=? where id=? and forum=?",
        remover, reason, post_id, forum["id"])

# Received a post restoration request from moderator (we are forum owner)
def event_post_restore_submit_event(e):
    forum = get_forum(e.header("to"))
    if not forum:
        return

    sender = e.header("from")
    if not check_event_access(sender, forum["id"], "moderate"):
        return

    post_id = e.content("id")
    post = mochi.db.row("select * from posts where id=? and forum=?", post_id, forum["id"])
    if not post or post.get("status") != "removed":
        return

    now = mochi.time.now()
    mochi.db.execute(
        "update posts set status='approved', remover=null, reason='', updated=? where id=?",
        now, post_id)

    log_moderation(forum["id"], sender, "restore", "post", post_id, post["member"], "")
    broadcast_event(forum["id"], "post/restore", {"id": post_id})

# Received a post restoration from forum owner
def event_post_restore_event(e):
    forum = get_forum(e.header("from"))
    if not forum:
        return

    if forum.get("owner") == 1:
        return

    post_id = e.content("id")
    mochi.db.execute(
        "update posts set status='approved', remover=null, reason='' where id=? and forum=?",
        post_id, forum["id"])

# Received a post approval request from moderator (we are forum owner)
def event_post_approve_submit_event(e):
    forum = get_forum(e.header("to"))
    if not forum:
        return

    sender = e.header("from")
    if not check_event_access(sender, forum["id"], "moderate"):
        return

    post_id = e.content("id")
    post = mochi.db.row("select * from posts where id=? and forum=?", post_id, forum["id"])
    if not post or post.get("status") != "pending":
        return

    now = mochi.time.now()
    mochi.db.execute("update posts set status='approved', updated=? where id=?", now, post_id)

    log_moderation(forum["id"], sender, "approve", "post", post_id, post["member"], "")
    notify_moderation_action(forum["id"], post["member"], "approve", "post", "")

    # Broadcast the post to members
    post_data = {
        "id": post_id,
        "member": post["member"],
        "name": post["name"],
        "title": post["title"],
        "body": post["body"],
        "created": post["created"]
    }
    broadcast_event(forum["id"], "post/create", post_data)

# Received a post lock request from moderator (we are forum owner)
def event_post_lock_submit_event(e):
    forum = get_forum(e.header("to"))
    if not forum:
        return

    sender = e.header("from")
    if not check_event_access(sender, forum["id"], "moderate"):
        return

    post_id = e.content("id")
    post = mochi.db.row("select * from posts where id=? and forum=?", post_id, forum["id"])
    if not post or post.get("locked"):
        return

    now = mochi.time.now()
    mochi.db.execute("update posts set locked=1, updated=? where id=?", now, post_id)
    log_moderation(forum["id"], sender, "lock", "post", post_id, post["member"], "")
    broadcast_event(forum["id"], "post/lock", {"id": post_id, "locked": True})

# Received a post unlock request from moderator (we are forum owner)
def event_post_unlock_submit_event(e):
    forum = get_forum(e.header("to"))
    if not forum:
        return

    sender = e.header("from")
    if not check_event_access(sender, forum["id"], "moderate"):
        return

    post_id = e.content("id")
    post = mochi.db.row("select * from posts where id=? and forum=?", post_id, forum["id"])
    if not post or not post.get("locked"):
        return

    now = mochi.time.now()
    mochi.db.execute("update posts set locked=0, updated=? where id=?", now, post_id)
    log_moderation(forum["id"], sender, "unlock", "post", post_id, post["member"], "")
    broadcast_event(forum["id"], "post/lock", {"id": post_id, "locked": False})

# Received a post lock/unlock from forum owner
def event_post_lock_event(e):
    forum = get_forum(e.header("from"))
    if not forum:
        return

    if forum.get("owner") == 1:
        return

    post_id = e.content("id")
    locked = e.content("locked")
    mochi.db.execute("update posts set locked=? where id=? and forum=?", 1 if locked else 0, post_id, forum["id"])

# Received a post pin request from moderator (we are forum owner)
def event_post_pin_submit_event(e):
    forum = get_forum(e.header("to"))
    if not forum:
        return

    sender = e.header("from")
    if not check_event_access(sender, forum["id"], "moderate"):
        return

    post_id = e.content("id")
    post = mochi.db.row("select * from posts where id=? and forum=?", post_id, forum["id"])
    if not post or post.get("pinned"):
        return

    mochi.db.execute("update posts set pinned=1 where id=?", post_id)
    log_moderation(forum["id"], sender, "pin", "post", post_id, post["member"], "")
    broadcast_event(forum["id"], "post/pin", {"id": post_id, "pinned": True})

# Received a post unpin request from moderator (we are forum owner)
def event_post_unpin_submit_event(e):
    forum = get_forum(e.header("to"))
    if not forum:
        return

    sender = e.header("from")
    if not check_event_access(sender, forum["id"], "moderate"):
        return

    post_id = e.content("id")
    post = mochi.db.row("select * from posts where id=? and forum=?", post_id, forum["id"])
    if not post or not post.get("pinned"):
        return

    mochi.db.execute("update posts set pinned=0 where id=?", post_id)
    log_moderation(forum["id"], sender, "unpin", "post", post_id, post["member"], "")
    broadcast_event(forum["id"], "post/pin", {"id": post_id, "pinned": False})

# Received a post pin/unpin from forum owner
def event_post_pin_event(e):
    forum = get_forum(e.header("from"))
    if not forum:
        return

    if forum.get("owner") == 1:
        return

    post_id = e.content("id")
    pinned = e.content("pinned")
    mochi.db.execute("update posts set pinned=? where id=? and forum=?", 1 if pinned else 0, post_id, forum["id"])

# Received a comment removal request from moderator (we are forum owner)
def event_comment_remove_submit_event(e):
    forum = get_forum(e.header("to"))
    if not forum:
        return

    sender = e.header("from")
    if not check_event_access(sender, forum["id"], "moderate"):
        return

    comment_id = e.content("id")
    comment = mochi.db.row("select * from comments where id=? and forum=?", comment_id, forum["id"])
    if not comment or comment.get("status") == "removed":
        return

    reason = e.content("reason") or ""
    now = mochi.time.now()

    mochi.db.execute(
        "update comments set status='removed', remover=?, reason=? where id=?",
        sender, reason, comment_id)
    mochi.db.execute("update posts set updated=? where id=?", now, comment["post"])

    log_moderation(forum["id"], sender, "remove", "comment", comment_id, comment["member"], reason)
    notify_moderation_action(forum["id"], comment["member"], "remove", "comment", reason)

    broadcast_event(forum["id"], "comment/remove", {
        "id": comment_id, "post": comment["post"], "remover": sender, "reason": reason
    })

# Received a comment removal from forum owner
def event_comment_remove_event(e):
    forum = get_forum(e.header("from"))
    if not forum:
        return

    if forum.get("owner") == 1:
        return

    comment_id = e.content("id")
    remover = e.content("remover")
    reason = e.content("reason") or ""

    mochi.db.execute(
        "update comments set status='removed', remover=?, reason=? where id=? and forum=?",
        remover, reason, comment_id, forum["id"])

# Received a comment restoration request from moderator (we are forum owner)
def event_comment_restore_submit_event(e):
    forum = get_forum(e.header("to"))
    if not forum:
        return

    sender = e.header("from")
    if not check_event_access(sender, forum["id"], "moderate"):
        return

    comment_id = e.content("id")
    comment = mochi.db.row("select * from comments where id=? and forum=?", comment_id, forum["id"])
    if not comment or comment.get("status") != "removed":
        return

    now = mochi.time.now()
    mochi.db.execute("update comments set status='approved', remover=null, reason='' where id=?", comment_id)
    mochi.db.execute("update posts set updated=? where id=?", now, comment["post"])

    log_moderation(forum["id"], sender, "restore", "comment", comment_id, comment["member"], "")
    broadcast_event(forum["id"], "comment/restore", {"id": comment_id, "post": comment["post"]})

# Received a comment restoration from forum owner
def event_comment_restore_event(e):
    forum = get_forum(e.header("from"))
    if not forum:
        return

    if forum.get("owner") == 1:
        return

    comment_id = e.content("id")
    mochi.db.execute(
        "update comments set status='approved', remover=null, reason='' where id=? and forum=?",
        comment_id, forum["id"])

# Received a comment approval request from moderator (we are forum owner)
def event_comment_approve_submit_event(e):
    forum = get_forum(e.header("to"))
    if not forum:
        return

    sender = e.header("from")
    if not check_event_access(sender, forum["id"], "moderate"):
        return

    comment_id = e.content("id")
    comment = mochi.db.row("select * from comments where id=? and forum=?", comment_id, forum["id"])
    if not comment or comment.get("status") != "pending":
        return

    now = mochi.time.now()
    mochi.db.execute("update comments set status='approved' where id=?", comment_id)
    mochi.db.execute("update posts set updated=? where id=?", now, comment["post"])

    log_moderation(forum["id"], sender, "approve", "comment", comment_id, comment["member"], "")
    notify_moderation_action(forum["id"], comment["member"], "approve", "comment", "")

    # Broadcast the comment to members
    comment_data = {
        "id": comment_id,
        "post": comment["post"],
        "parent": comment["parent"],
        "member": comment["member"],
        "name": comment["name"],
        "body": comment["body"],
        "created": comment["created"]
    }
    broadcast_event(forum["id"], "comment/create", comment_data)

# Received a user restriction request from moderator (we are forum owner)
def event_restrict_submit_event(e):
    forum = get_forum(e.header("to"))
    if not forum:
        return

    sender = e.header("from")
    if not check_event_access(sender, forum["id"], "moderate"):
        return

    target_user = e.content("user")
    restriction_type = e.content("type")
    if restriction_type not in ["muted", "banned", "shadowban"]:
        return

    reason = e.content("reason") or ""
    expires = e.content("expires")
    now = mochi.time.now()

    mochi.db.execute(
        "replace into restrictions (forum, user, type, reason, moderator, expires, created) values (?, ?, ?, ?, ?, ?, ?)",
        forum["id"], target_user, restriction_type, reason, sender, expires, now)

    log_moderation(forum["id"], sender, "restrict", "user", target_user, None, reason)
    notify_moderation_action(forum["id"], target_user, "restrict", restriction_type, reason)

    broadcast_event(forum["id"], "user/restrict", {
        "user": target_user, "type": restriction_type, "expires": expires
    })

# Received a user restriction from forum owner
def event_user_restrict_event(e):
    forum = get_forum(e.header("from"))
    if not forum:
        return

    if forum.get("owner") == 1:
        return

    target_user = e.content("user")
    restriction_type = e.content("type")
    expires = e.content("expires")
    now = mochi.time.now()

    mochi.db.execute(
        "replace into restrictions (forum, user, type, reason, moderator, expires, created) values (?, ?, ?, '', '', ?, ?)",
        forum["id"], target_user, restriction_type, expires, now)

# Received a user unrestriction request from moderator (we are forum owner)
def event_unrestrict_submit_event(e):
    forum = get_forum(e.header("to"))
    if not forum:
        return

    sender = e.header("from")
    if not check_event_access(sender, forum["id"], "moderate"):
        return

    target_user = e.content("user")
    restriction = mochi.db.row("select * from restrictions where forum=? and user=?", forum["id"], target_user)
    if not restriction:
        return

    mochi.db.execute("delete from restrictions where forum=? and user=?", forum["id"], target_user)
    log_moderation(forum["id"], sender, "unrestrict", "user", target_user, None, "")
    notify_moderation_action(forum["id"], target_user, "unrestrict", "", "")

    broadcast_event(forum["id"], "user/unrestrict", {"user": target_user})

# Received a user unrestriction from forum owner
def event_user_unrestrict_event(e):
    forum = get_forum(e.header("from"))
    if not forum:
        return

    if forum.get("owner") == 1:
        return

    target_user = e.content("user")
    mochi.db.execute("delete from restrictions where forum=? and user=?", forum["id"], target_user)

# Received a report submission from user (we are forum owner)
def event_report_submit_event(e):
    forum = get_forum(e.header("to"))
    if not forum:
        return

    sender = e.header("from")
    report_id = e.content("id")
    report_type = e.content("type")
    target = e.content("target")
    reason = e.content("reason")
    details = e.content("details") or ""

    if report_type not in ["post", "comment"]:
        return

    if reason not in ["spam", "harassment", "hate", "violence", "misinformation", "offtopic", "other"]:
        return

    # Get author
    author = None
    if report_type == "post":
        item = mochi.db.row("select member from posts where id=? and forum=?", target, forum["id"])
        if item:
            author = item["member"]
    else:
        item = mochi.db.row("select member from comments where id=? and forum=?", target, forum["id"])
        if item:
            author = item["member"]

    if not author:
        return

    # Check rate limit
    one_hour_ago = mochi.time.now() - 3600
    report_count = mochi.db.row(
        "select count(*) as count from reports where forum=? and reporter=? and created > ?",
        forum["id"], sender, one_hour_ago)
    if report_count and report_count["count"] >= 5:
        return

    now = mochi.time.now()
    mochi.db.execute(
        "insert into reports (id, forum, reporter, type, target, author, reason, details, created) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        report_id, forum["id"], sender, report_type, target, author, reason, details, now)

# Received a report resolution request from moderator (we are forum owner)
def event_report_resolve_submit_event(e):
    forum = get_forum(e.header("to"))
    if not forum:
        return

    sender = e.header("from")
    if not check_event_access(sender, forum["id"], "moderate"):
        return

    report_id = e.content("id")
    action = e.content("action")

    if action not in ["removed", "ignored"]:
        return

    report = mochi.db.row("select * from reports where id=? and forum=?", report_id, forum["id"])
    if not report or report.get("status") != "pending":
        return

    now = mochi.time.now()

    # Perform the actual action
    if action == "removed":
        # Remove the reported content
        if report["type"] == "post":
            post = mochi.db.row("select * from posts where id=?", report["target"])
            if post and post.get("status") != "removed":
                mochi.db.execute(
                    "update posts set status='removed', remover=?, reason=?, updated=? where id=?",
                    sender, report["reason"], now, report["target"])
                log_moderation(forum["id"], sender, "remove", "post", report["target"], report["author"], report["reason"])
                notify_moderation_action(forum["id"], report["author"], "remove", "post", report["reason"])
                broadcast_event(forum["id"], "post/remove", {
                    "id": report["target"], "remover": sender, "reason": report["reason"]
                })
        elif report["type"] == "comment":
            comment = mochi.db.row("select * from comments where id=?", report["target"])
            if comment and comment.get("status") != "removed":
                mochi.db.execute(
                    "update comments set status='removed', remover=?, reason=? where id=?",
                    sender, report["reason"], report["target"])
                log_moderation(forum["id"], sender, "remove", "comment", report["target"], report["author"], report["reason"])
                notify_moderation_action(forum["id"], report["author"], "remove", "comment", report["reason"])
                broadcast_event(forum["id"], "comment/remove", {
                    "id": report["target"], "post": comment["post"], "remover": sender, "reason": report["reason"]
                })

    # Mark report as resolved
    mochi.db.execute(
        "update reports set status='resolved', resolver=?, action=?, resolved=? where id=?",
        sender, action, now, report_id)

    log_moderation(forum["id"], sender, "resolve_report", "report", report_id, report["author"], action)

    # Broadcast resolution to all members so other moderators' queues update
    broadcast_event(forum["id"], "report/resolve", {
        "id": report_id,
        "action": action,
        "resolver": sender
    })

# Received a report resolution from forum owner
def event_report_resolve_event(e):
    forum = get_forum(e.header("from"))
    if not forum:
        return

    # Don't update forums we own
    if forum.get("owner") == 1:
        return

    report_id = e.content("id")
    action = e.content("action")
    resolver = e.content("resolver")
    now = mochi.time.now()

    mochi.db.execute(
        "update reports set status='resolved', resolver=?, action=?, resolved=? where id=? and forum=?",
        resolver, action, now, report_id, forum["id"])

# Handle info request for a forum (used by probe for remote forum lookup)
def event_info(e):
    forum_id = e.header("to")

    # Get entity info
    entity = mochi.entity.info(forum_id)
    if not entity or entity.get("class") != "forum":
        e.stream.write({"error": "Forum not found"})
        return

    e.stream.write({
        "id": entity["id"],
        "name": entity["name"],
        "fingerprint": entity.get("fingerprint", mochi.entity.fingerprint(forum_id)),
        "privacy": entity.get("privacy", "public"),
    })

# Return full forum content for reliable subscription sync
def event_schema(e):
    forum_id = e.header("to")
    entity = mochi.entity.info(forum_id)
    if not entity or entity.get("class") != "forum":
        e.stream.write({"error": "Forum not found"})
        return

    posts = mochi.db.rows(
        "select id, member, name, title, body, up, down, comments, created, updated from posts where forum=? order by created desc limit 100",
        forum_id
    ) or []

    # Fetch comments for all returned posts
    post_ids = [p["id"] for p in posts]
    comments = []
    for pid in post_ids:
        rows = mochi.db.rows(
            "select id, post, parent, member, name, body, up, down, created from comments where forum=? and post=? order by created",
            forum_id, pid
        ) or []
        for r in rows:
            comments.append(r)

    tags = mochi.db.rows("select id, object, label, qid, relevance, source from tags where object in (select id from posts where forum=?)", forum_id) or []

    e.stream.write({
        "posts": posts,
        "comments": comments,
        "tags": tags,
    })

# Insert forum schema data into local database
def insert_forum_schema(forum_id, schema):
    for p in (schema.get("posts") or []):
        mochi.db.execute(
            "replace into posts (id, forum, member, name, title, body, up, down, comments, created, updated) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            p.get("id", ""), forum_id, p.get("member", ""), p.get("name", ""),
            p.get("title", ""), p.get("body", ""), p.get("up", 0), p.get("down", 0),
            p.get("comments", 0), p.get("created", 0), p.get("updated", 0)
        )
    for c in (schema.get("comments") or []):
        mochi.db.execute(
            "insert or ignore into comments (id, forum, post, parent, member, name, body, up, down, created) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            c.get("id", ""), forum_id, c.get("post", ""), c.get("parent", ""),
            c.get("member", ""), c.get("name", ""), c.get("body", ""),
            c.get("up", 0), c.get("down", 0), c.get("created", 0)
        )
    for t in (schema.get("tags") or []):
        mochi.db.execute(
            "insert or ignore into tags (id, object, label, qid, relevance, source) values (?, ?, ?, ?, ?, ?)",
            t.get("id", ""), t.get("object", ""), t.get("label", ""),
            t.get("qid", ""), t.get("relevance", 0.0), t.get("source", "manual")
        )

# Handle view request for a forum (used for remote forum viewing)
def event_view(e):
    forum_id = e.header("to")
    requester = e.header("from")

    # Get entity info - must be a forum we own
    entity = mochi.entity.info(forum_id)
    if not entity or entity.get("class") != "forum":
        e.stream.write({"error": "Forum not found"})
        return

    # Get forum from database
    forum = get_forum(forum_id)
    if not forum:
        e.stream.write({"error": "Forum not found"})
        return

    forum_name = entity.get("name", forum.get("name", ""))
    forum_fingerprint = entity.get("fingerprint", mochi.entity.fingerprint(forum_id))
    forum_privacy = entity.get("privacy", "public")

    # Check access for private forums
    if forum_privacy == "private":
        can_view = check_event_access(requester, forum_id, "view")
        if not can_view:
            e.stream.write({"error": "Not allowed to view this forum"})
            return

    can_post = check_event_access(requester, forum_id, "post")
    can_moderate = check_event_access(requester, forum_id, "moderate")

    # Get posts for this forum (filter removed posts for non-moderators)
    if can_moderate:
        posts = mochi.db.rows("select * from posts where forum=? order by pinned desc, updated desc limit 100", forum_id)
    else:
        posts = mochi.db.rows("select * from posts where forum=? and status!='removed' order by pinned desc, updated desc limit 100", forum_id)

    # Format posts with comments
    formatted_posts = []
    for post in posts:
        post_data = dict(post)
        post_data["body_markdown"] = mochi.text.markdown(post["body"])
        post_data["attachments"] = mochi.attachment.list(post["id"], forum_id)
        # Filter comments for non-moderators
        if can_moderate:
            post_data["comments"] = mochi.db.rows("select * from comments where forum=? and post=? order by created desc",
                forum_id, post["id"])
        else:
            post_data["comments"] = mochi.db.rows("select * from comments where forum=? and post=? and status!='removed' order by created desc",
                forum_id, post["id"])
        post_data["tags"] = mochi.db.rows("select id, label, qid, source, relevance from tags where object=?", post["id"]) or []
        formatted_posts.append(post_data)

    # Get banner for remote viewers
    banner = forum.get("banner", "")
    banner_html = mochi.text.markdown(banner) if banner else ""

    e.stream.write({
        "name": forum_name,
        "fingerprint": forum_fingerprint,
        "banner": banner,
        "banner_html": banner_html,
        "posts": formatted_posts,
        "can_post": can_post,
        "can_moderate": can_moderate,
    })

# Handle access check request from subscribers
def event_access_check(e):
    forum_id = e.header("to")
    # Use user from content if provided, otherwise fall back to P2P header
    requester = e.content("user") or e.header("from")
    operations = e.content("operations") or []

    # Get entity info - must be a forum we own
    entity = mochi.entity.info(forum_id)
    if not entity or entity.get("class") != "forum":
        e.stream.write({"error": "Forum not found"})
        return

    # Check each requested operation
    result = {}
    for op in operations:
        has_access = check_event_access(requester, forum_id, op)
        if has_access and op in ["post", "comment", "vote"]:
            # Also check for restrictions (muted/banned)
            restriction_error = check_restriction(forum_id, requester, op)
            if restriction_error:
                has_access = False
                result["error"] = restriction_error
        result[op] = has_access

    e.stream.write(result)

# Handle post view request for remote viewing
def event_post_view(e):
    forum_id = e.header("to")
    requester = e.header("from")
    post_id = e.content("post")

    if not post_id:
        e.stream.write({"error": "Post ID required"})
        return

    # Get entity info - must be a forum we own
    entity = mochi.entity.info(forum_id)
    if not entity or entity.get("class") != "forum":
        e.stream.write({"error": "Forum not found"})
        return

    # Get forum from database
    forum = get_forum(forum_id)
    if not forum:
        e.stream.write({"error": "Forum not found"})
        return

    forum_privacy = entity.get("privacy", "public")

    # Check access for private forums
    if forum_privacy == "private":
        can_view = check_event_access(requester, forum_id, "view")
        if not can_view:
            e.stream.write({"error": "Not allowed to view this forum"})
            return

    # Get post
    post = mochi.db.row("select * from posts where id=? and forum=?", post_id, forum_id)
    if not post:
        e.stream.write({"error": "Post not found"})
        return

    can_vote = check_event_access(requester, forum_id, "vote")
    can_comment = check_event_access(requester, forum_id, "comment")
    can_moderate = check_event_access(requester, forum_id, "moderate")

    post_data = dict(post)
    post_data["body_markdown"] = mochi.text.markdown(post["body"])
    post_data["attachments"] = mochi.attachment.list(post_id, forum_id)
    post_data["tags"] = mochi.db.rows("select id, label, qid, source, relevance from tags where object=?", post_id) or []

    # Get requester's vote on the post
    post_vote = mochi.db.row("select vote from votes where post=? and comment='' and voter=?", post_id, requester)
    post_data["user_vote"] = post_vote["vote"] if post_vote else ""

    # Get comments recursively
    def get_comments(parent_id, depth):
        if depth > 100:
            return []

        # Filter out removed comments for non-moderators
        if can_moderate:
            comments = mochi.db.rows("select * from comments where forum=? and post=? and parent=? order by created desc",
                forum_id, post_id, parent_id)
        else:
            comments = mochi.db.rows("select * from comments where forum=? and post=? and parent=? and status!='removed' order by created desc",
                forum_id, post_id, parent_id)

        for c in comments:
            c["children"] = get_comments(c["id"], depth + 1)
            c["can_vote"] = can_vote
            c["can_comment"] = can_comment
            # Get requester's vote on this comment
            comment_vote = mochi.db.row("select vote from votes where comment=? and voter=?", c["id"], requester)
            c["user_vote"] = comment_vote["vote"] if comment_vote else ""

        return comments

    comments = get_comments("", 0)

    e.stream.write({
        "forum": forum,
        "post": post_data,
        "comments": comments,
        "member": None,
        "can_vote": can_vote,
        "can_comment": can_comment,
        "can_moderate": can_moderate,
    })

# MODERATION EVENT HANDLERS (for delegated moderators)

# Handle moderation queue request from delegated moderators
def event_moderation_queue(e):
    forum_id = e.header("to")
    requester = e.header("from")

    forum = get_forum(forum_id)
    if not forum:
        e.stream.write({"error": "Forum not found"})
        return

    if not check_event_access(requester, forum_id, "moderate"):
        e.stream.write({"error": "Not allowed to moderate"})
        return

    posts = mochi.db.rows(
        "select id, forum, title, body, member, name, created from posts where forum=? and status='pending' order by created asc",
        forum["id"])
    for p in posts:
        p["attachments"] = mochi.attachment.list(p["id"], forum["id"])

    comments = mochi.db.rows(
        "select id, body, post, member, name, created from comments where forum=? and status='pending' order by created asc",
        forum["id"])
    reports = mochi.db.rows("""
        select type, target, author, reason, min(id) as id, min(details) as details,
               min(reporter) as reporter, min(created) as created, count(*) as count
        from reports
        where forum=? and status='pending'
        group by type, target
        order by count desc, created asc
    """, forum["id"])

    e.stream.write({
        "forum": forum,
        "posts": posts,
        "comments": comments,
        "reports": reports,
        "counts": {
            "posts": len(posts),
            "comments": len(comments),
            "reports": len(reports),
            "total": len(posts) + len(comments) + len(reports)
        }
    })

# Handle moderation reports request from delegated moderators
def event_moderation_reports(e):
    forum_id = e.header("to")
    requester = e.header("from")
    status = e.content("status") or "pending"

    forum = get_forum(forum_id)
    if not forum:
        e.stream.write({"error": "Forum not found"})
        return

    if not check_event_access(requester, forum_id, "moderate"):
        e.stream.write({"error": "Not allowed to moderate"})
        return

    if status not in ["pending", "resolved", "all"]:
        e.stream.write({"error": "Invalid status"})
        return

    if status == "all":
        reports = mochi.db.rows(
            "select * from reports where forum=? order by created desc limit 100",
            forum["id"])
    else:
        reports = mochi.db.rows(
            "select * from reports where forum=? and status=? order by created desc limit 100",
            forum["id"], status)

    for r in reports:
        reporter = mochi.db.row("select name from members where forum=? and id=?", forum["id"], r["reporter"])
        if reporter:
            r["reporter_name"] = reporter["name"]
        else:
            r["reporter_name"] = mochi.entity.name(r["reporter"]) or r["reporter"]
        author = mochi.db.row("select name from members where forum=? and id=?", forum["id"], r["author"])
        if author:
            r["author_name"] = author["name"]
        else:
            r["author_name"] = mochi.entity.name(r["author"]) or r["author"]
        if r["resolver"]:
            resolver = mochi.db.row("select name from members where forum=? and id=?", forum["id"], r["resolver"])
            if resolver:
                r["resolver_name"] = resolver["name"]
            else:
                r["resolver_name"] = mochi.entity.name(r["resolver"]) or r["resolver"]
        if r["type"] == "post":
            post = mochi.db.row("select title, body from posts where id=?", r["target"])
            if post:
                r["content_title"] = post["title"]
                r["content_preview"] = post["body"][:200] if len(post["body"]) > 200 else post["body"]
                r["attachments"] = mochi.attachment.list(r["target"], forum["id"])
        elif r["type"] == "comment":
            comment = mochi.db.row("select body from comments where id=?", r["target"])
            if comment:
                r["content_preview"] = comment["body"][:200] if len(comment["body"]) > 200 else comment["body"]

    e.stream.write({"forum": forum, "reports": reports})

# Handle moderation log request from delegated moderators
def event_moderation_log(e):
    forum_id = e.header("to")
    requester = e.header("from")
    limit_str = e.content("limit")

    forum = get_forum(forum_id)
    if not forum:
        e.stream.write({"error": "Forum not found"})
        return

    if not check_event_access(requester, forum_id, "moderate"):
        e.stream.write({"error": "Not allowed to moderate"})
        return

    limit = 50
    if limit_str and mochi.text.valid(str(limit_str), "natural"):
        limit = min(int(limit_str), 200)

    logs = mochi.db.rows(
        "select * from moderation where forum=? order by created desc limit ?",
        forum["id"], limit)

    for entry in logs:
        moderator = mochi.db.row("select name from members where forum=? and id=?", forum["id"], entry["moderator"])
        if moderator:
            entry["moderator_name"] = moderator["name"]
        if entry.get("author"):
            author = mochi.db.row("select name from members where forum=? and id=?", forum["id"], entry["author"])
            if author:
                entry["author_name"] = author["name"]
        if entry.get("target"):
            target = mochi.db.row("select name from members where forum=? and id=?", forum["id"], entry["target"])
            if target:
                entry["target_name"] = target["name"]

    e.stream.write({"entries": logs})

# Handle restrictions list request from delegated moderators
def event_restrictions(e):
    forum_id = e.header("to")
    requester = e.header("from")

    forum = get_forum(forum_id)
    if not forum:
        e.stream.write({"error": "Forum not found"})
        return

    if not check_event_access(requester, forum_id, "moderate"):
        e.stream.write({"error": "Not allowed to moderate"})
        return

    restrictions = mochi.db.rows("select * from restrictions where forum=? order by created desc", forum["id"])

    for r in restrictions:
        member = mochi.db.row("select name from members where forum=? and id=?", forum["id"], r["user"])
        if member:
            r["name"] = member["name"]
        moderator = mochi.db.row("select name from members where forum=? and id=?", forum["id"], r["moderator"])
        if moderator:
            r["moderator_name"] = moderator["name"]

    e.stream.write({"restrictions": restrictions})

# Handle report resolution request from delegated moderators
def event_report_resolve_action(e):
    forum_id = e.header("to")
    requester = e.header("from")
    report_id = e.content("report")
    action = e.content("action")

    forum = get_forum(forum_id)
    if not forum:
        e.stream.write({"error": "Forum not found"})
        return

    if not check_event_access(requester, forum_id, "moderate"):
        e.stream.write({"error": "Not allowed to moderate"})
        return

    if not report_id:
        e.stream.write({"error": "Report ID required"})
        return

    report = mochi.db.row("select * from reports where id=? and forum=?", report_id, forum_id)
    if not report:
        e.stream.write({"error": "Report not found"})
        return

    if report.get("status") != "pending":
        e.stream.write({"error": "Report already resolved"})
        return

    if action not in ["removed", "ignored"]:
        e.stream.write({"error": "Invalid action"})
        return

    now = mochi.time.now()

    # Perform the actual action
    if action == "removed":
        if report["type"] == "post":
            post = mochi.db.row("select * from posts where id=?", report["target"])
            if post and post.get("status") != "removed":
                mochi.db.execute(
                    "update posts set status='removed', remover=?, reason=?, updated=? where id=?",
                    requester, report["reason"], now, report["target"])
                log_moderation(forum_id, requester, "remove", "post", report["target"], report["author"], report["reason"])
                notify_moderation_action(forum_id, report["author"], "remove", "post", report["reason"])
                broadcast_event(forum_id, "post/remove", {
                    "id": report["target"], "remover": requester, "reason": report["reason"]
                })
        elif report["type"] == "comment":
            comment = mochi.db.row("select * from comments where id=?", report["target"])
            if comment and comment.get("status") != "removed":
                mochi.db.execute(
                    "update comments set status='removed', remover=?, reason=? where id=?",
                    requester, report["reason"], report["target"])
                log_moderation(forum_id, requester, "remove", "comment", report["target"], report["author"], report["reason"])
                notify_moderation_action(forum_id, report["author"], "remove", "comment", report["reason"])
                broadcast_event(forum_id, "comment/remove", {
                    "id": report["target"], "post": comment["post"], "remover": requester, "reason": report["reason"]
                })

    # Mark report as resolved
    mochi.db.execute(
        "update reports set status='resolved', resolver=?, action=?, resolved=? where id=?",
        requester, action, now, report_id)

    log_moderation(forum_id, requester, "resolve_report", "report", report_id, report["author"], action)

    # Broadcast resolution to all members
    broadcast_event(forum_id, "report/resolve", {
        "id": report_id,
        "action": action,
        "resolver": requester
    })

    e.stream.write({"success": True})

# CROSS-APP PROXY ACTIONS

# Proxy user search to people app
def action_users_search(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return
    query = a.input("search", "")
    results = mochi.service.call("people", "users/search", query)
    return {"data": {"results": results}}

# Proxy groups list to people app
def action_groups(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return
    groups = mochi.service.call("friends", "groups/list")
    return {"data": {"groups": groups}}

# RSS

# Escape special XML characters
def escape_xml(s):
    if not s:
        return ""
    s = s.replace("&", "&amp;")
    s = s.replace("<", "&lt;")
    s = s.replace(">", "&gt;")
    s = s.replace('"', "&quot;")
    return s

# Get or create an RSS token for an entity+mode combination
def action_rss_token(a):
    if not a.user:
        a.error.label(401, "errors.authentication_required")
        return

    entity = a.input("entity")
    mode = a.input("mode")
    if not entity or not mode:
        a.error.label(400, "errors.missing_entity_or_mode")
        return
    if mode != "posts" and mode != "all":
        a.error.label(400, "errors.mode_must_be_posts_or_all")
        return

    if entity == "*":
        forum_id = "*"
    else:
        forum = get_forum(entity)
        if not forum:
            a.error.label(404, "errors.forum_not_found")
            return
        forum_id = forum["id"]

    # Check existing token
    existing = mochi.db.row("select token from rss where entity=? and mode=?", forum_id, mode)
    if existing:
        return {"data": {"token": existing["token"]}}

    # Create new token
    token = mochi.token.create("rss", ["rss"])
    if not token:
        a.error.label(500, "errors.failed_to_create_token")
        return

    now = mochi.time.now()
    mochi.db.execute("insert into rss (token, entity, mode, created) values (?, ?, ?, ?)", token, forum_id, mode, now)
    return {"data": {"token": token}}

# Serve RSS feed for all subscribed forums
def action_rss_all(a):
    if not a.user:
        a.error.label(401, "errors.authentication_required")
        return

    user_id = a.user.identity.id

    # Look up mode from token
    token = a.input("token")
    mode = "posts"
    if token:
        rss_row = mochi.db.row("select mode from rss where token=? and entity='*'", token)
        if rss_row:
            mode = rss_row["mode"]

    a.header("Content-Type", "application/rss+xml; charset=utf-8")
    a.print('<?xml version="1.0" encoding="UTF-8"?>\n')
    a.print('<rss version="2.0">\n')
    a.print('<channel>\n')
    a.print('<title>All forums</title>\n')
    a.print('<link>/forums</link>\n')
    a.print('<description>All subscribed forums</description>\n')

    # Build forum name lookup
    forum_names = {}
    all_forums = mochi.db.rows("select id, name from forums")
    for f in all_forums:
        forum_names[f["id"]] = f["name"]

    if mode == "all":
        rows = mochi.db.rows("""
            select 'post' as type, p.id, p.forum, p.name as author, p.title, p.body, p.created
            from posts p inner join members m on p.forum = m.forum
            where m.id = ? and p.status = 'approved'
            union all
            select 'comment' as type, c.id, c.forum, c.name as author, '' as title, c.body, c.created
            from comments c inner join members m on c.forum = m.forum
            where m.id = ? and c.status = 'approved'
            order by created desc limit 100
        """, user_id, user_id)
    else:
        rows = mochi.db.rows("""
            select 'post' as type, p.id, p.forum, p.name as author, p.title, p.body, p.created
            from posts p inner join members m on p.forum = m.forum
            where m.id = ? and p.status = 'approved'
            order by p.created desc limit 50
        """, user_id)

    if rows:
        a.print('<lastBuildDate>' + mochi.time.local(rows[0]["created"], "rfc822") + '</lastBuildDate>\n')

    # Build post title lookup for comment "Re: title" format
    post_titles = {}
    if mode == "all":
        comment_ids = [row["id"] for row in rows if row["type"] == "comment"]
        if comment_ids:
            for cid in comment_ids:
                comment_row = mochi.db.row("select post from comments where id=?", cid)
                if comment_row:
                    post_row = mochi.db.row("select title from posts where id=?", comment_row["post"])
                    if post_row:
                        post_titles[cid] = post_row["title"]

    for row in rows:
        item_id = row["id"]
        forum_id = row["forum"]
        forum_fp = mochi.entity.fingerprint(forum_id) if mochi.text.valid(forum_id, "entity") else forum_id
        item_fp = mochi.entity.fingerprint(item_id) if mochi.text.valid(item_id, "entity") else item_id
        forum_name = forum_names.get(forum_id, "Forum")
        body = row["body"]
        if len(body) > 500:
            body = body[:500] + "..."

        if row["type"] == "comment":
            parent_title = post_titles.get(item_id, "")
            if parent_title:
                title = forum_name + ": Re: " + parent_title
            else:
                title = forum_name + ": Comment by " + row["author"]
        else:
            title = forum_name + ": " + row["title"] if row["title"] else forum_name

        link = "/forums/" + forum_fp + "/" + item_fp

        a.print('<item>\n')
        a.print('<title>' + escape_xml(title) + '</title>\n')
        a.print('<link>' + escape_xml(link) + '</link>\n')
        a.print('<description>' + escape_xml(body) + '</description>\n')
        a.print('<pubDate>' + mochi.time.local(row["created"], "rfc822") + '</pubDate>\n')
        a.print('<guid isPermaLink="false">' + escape_xml(item_id) + '</guid>\n')
        if row["type"] == "post":
            item_tags = mochi.db.rows("select label from tags where object=?", item_id) or []
            for it in item_tags:
                a.print('<category>' + escape_xml(it["label"]) + '</category>\n')
        a.print('</item>\n')

    a.print('</channel>\n')
    a.print('</rss>\n')

# Serve RSS feed for a forum entity
def action_rss(a):
    if not a.user:
        a.error.label(401, "errors.authentication_required")
        return

    forum_id = a.input("forum")
    if not forum_id:
        a.error.label(400, "errors.no_forum_specified")
        return

    forum = get_forum(forum_id)
    if not forum:
        a.error.label(404, "errors.forum_not_found")
        return

    forum_id = forum["id"]
    if not check_access(a, forum_id, "view"):
        a.error.label(403, "errors.not_allowed_to_view_this_forum")
        return

    # Look up mode from token
    token = a.input("token")
    mode = "posts"
    if token:
        rss_row = mochi.db.row("select mode from rss where token=? and entity=?", token, forum_id)
        if rss_row:
            mode = rss_row["mode"]

    forum_name = forum.get("name", "Forum")
    fingerprint = mochi.entity.fingerprint(forum_id)

    a.header("Content-Type", "application/rss+xml; charset=utf-8")
    a.print('<?xml version="1.0" encoding="UTF-8"?>\n')
    a.print('<rss version="2.0">\n')
    a.print('<channel>\n')
    a.print('<title>' + escape_xml(forum_name) + '</title>\n')
    a.print('<link>/forums/' + escape_xml(fingerprint) + '</link>\n')
    a.print('<description>' + escape_xml(forum_name) + ' RSS feed</description>\n')

    if mode == "all":
        # Interleave posts and comments by date, only approved content
        rows = mochi.db.rows("""
            select 'post' as type, id, name as author, title, body, created from posts where forum=? and status='approved'
            union all
            select 'comment' as type, id, name as author, '' as title, body, created from comments where forum=? and status='approved'
            order by created desc limit 100
        """, forum_id, forum_id)
    else:
        rows = mochi.db.rows("select 'post' as type, id, name as author, title, body, created from posts where forum=? and status='approved' order by created desc limit 50", forum_id)

    if rows:
        a.print('<lastBuildDate>' + mochi.time.local(rows[0]["created"], "rfc822") + '</lastBuildDate>\n')

    # Build post title lookup for comment "Re: title" format
    post_titles = {}
    if mode == "all":
        comment_ids = [row["id"] for row in rows if row["type"] == "comment"]
        if comment_ids:
            # Get parent post IDs for these comments
            for cid in comment_ids:
                comment_row = mochi.db.row("select post from comments where id=?", cid)
                if comment_row:
                    post_row = mochi.db.row("select title from posts where id=?", comment_row["post"])
                    if post_row:
                        post_titles[cid] = post_row["title"]

    for row in rows:
        item_id = row["id"]
        item_fp = mochi.entity.fingerprint(item_id) if mochi.text.valid(item_id, "entity") else item_id
        body = row["body"]
        if len(body) > 500:
            body = body[:500] + "..."

        if row["type"] == "comment":
            parent_title = post_titles.get(item_id, "")
            if parent_title:
                title = "Re: " + parent_title
            else:
                title = "Comment by " + row["author"]
        else:
            title = row["title"] if row["title"] else forum_name

        link = "/forums/" + fingerprint + "/" + item_fp

        a.print('<item>\n')
        a.print('<title>' + escape_xml(title) + '</title>\n')
        a.print('<link>' + escape_xml(link) + '</link>\n')
        a.print('<description>' + escape_xml(body) + '</description>\n')
        a.print('<pubDate>' + mochi.time.local(row["created"], "rfc822") + '</pubDate>\n')
        a.print('<guid isPermaLink="false">' + escape_xml(item_id) + '</guid>\n')
        if row["type"] == "post":
            item_tags = mochi.db.rows("select label from tags where object=?", item_id) or []
            for it in item_tags:
                a.print('<category>' + escape_xml(it["label"]) + '</category>\n')
        a.print('</item>\n')

    a.print('</channel>\n')
    a.print('</rss>')

# Update user interests based on a vote on a post
def update_interests_from_vote(post_id, positive):
    tags = mochi.db.rows("select qid from tags where object=? and source='ai' and qid != ''", post_id)
    if not tags:
        return
    qids = [t["qid"] for t in tags]
    delta = 5 if positive else -10
    mochi.interests.adjust(qids, delta)

# Update user interests based on a manually added tag
def update_interests_from_manual_tag(label):
    results = mochi.qid.search(label, "en")
    if results and len(results) > 0:
        top = results[0]
        if top["label"].lower() == label.lower():
            mochi.interests.adjust(top["qid"], 10)

# Adjust interest weight for a specific tag QID
def action_tag_interest(a):
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return
    qid = a.input("qid")
    direction = a.input("direction")
    if not qid:
        a.error.label(400, "errors.qid_required")
        return
    if direction == "up":
        mochi.interests.adjust(qid, 15)
    elif direction == "down":
        mochi.interests.adjust(qid, -20)
    elif direction == "remove":
        mochi.interests.remove(qid)
    else:
        a.error.label(400, "errors.invalid_direction")
        return
    return {"data": {"ok": True}}


# Score posts by relevance to user interests
def score_posts_relevant(posts, forum_data, sort="ai"):
    interests = mochi.interests.top(30)
    if not interests:
        return posts, []

    # Build interest map: qid -> weight
    interest_map = {}
    for i in interests:
        interest_map[i["qid"]] = i["weight"]

    # Build negative interest map for penalties
    negative_interests = mochi.interests.bottom(30)
    negative_map = {}
    for i in negative_interests:
        negative_map[i["qid"]] = i["weight"]

    # Get all post IDs
    post_ids = [p["id"] for p in posts]
    if not post_ids:
        return posts, []

    # Batch-load AI tags for all posts
    placeholders = ", ".join(["?" for _ in post_ids])
    all_tags = mochi.db.rows(
        "select object, qid, relevance from tags where object in (" + placeholders + ") and source='ai' and qid != ''",
        *post_ids
    ) or []
    post_tags = {}
    for t in all_tags:
        pid = t["object"]
        if pid not in post_tags:
            post_tags[pid] = []
        post_tags[pid].append(t)

    # Score each post
    now_ts = mochi.time.now()
    scored = []
    for p in posts:
        pid = p["id"]
        tags = post_tags.get(pid, [])
        best_score = 0
        matches = []
        for t in tags:
            qid = t["qid"]
            relevance = t["relevance"] if t["relevance"] else 0.5
            weight = interest_map.get(qid, 0)
            if weight > 0:
                tag_score = weight * relevance
                if tag_score > best_score:
                    best_score = tag_score
                matches.append({"qid": qid, "score": tag_score})

        # Penalty from negative interests
        worst_penalty = 0
        for t in tags:
            qid = t["qid"]
            relevance = t["relevance"] if t["relevance"] else 0.5
            neg_weight = negative_map.get(qid, 0)
            if neg_weight < 0:
                penalty = neg_weight * relevance / 100
                if penalty < worst_penalty:
                    worst_penalty = penalty

        # Time decay: halve score every 7 days
        age_hours = max((now_ts - p["created"]) / 3600, 1)
        decay = 168.0 / (age_hours + 168.0)
        score = best_score * decay
        if worst_penalty < 0:
            score = score * max(0, 1 + worst_penalty)

        # Sort matches by score descending
        matches = sorted(matches, key=lambda m: -m["score"])
        p["_score"] = score
        p["_matches"] = matches[:3]
        scored.append(p)

    # Sort by score descending, then created descending
    scored = sorted(scored, key=lambda p: (-p["_score"], -p["created"]))

    # AI re-ranking for sort=ai (or legacy sort=relevant) when forum has an AI account
    if sort in ("ai", "relevant"):
        scored = ai_rerank(forum_data, scored, interests)

    return scored, interests

# AI re-ranking: re-score top candidates using LLM
def ai_rerank(forum_data, posts, interests):
    if not posts:
        return posts
    account = resolve_ai_account(forum_data.get("ai_account", 0))
    if account == 0:
        return posts

    # Only re-rank top 50 candidates
    candidates = posts[:50]
    rest = posts[50:]

    # Check cache freshness — skip if all candidates have fresh scores (< 1 hour)
    now_ts = mochi.time.now()
    cache_cutoff = now_ts - 3600
    cached = {}
    all_fresh = True
    placeholders = ", ".join(["?" for _ in candidates])
    cache_rows = mochi.db.rows(
        "select post, score, computed from score_cache where forum=? and post in (" + placeholders + ")",
        forum_data["id"], *[p["id"] for p in candidates]
    ) or []
    for row in cache_rows:
        if row["computed"] > cache_cutoff:
            cached[row["post"]] = row["score"]
    if len(cached) < len(candidates):
        all_fresh = False

    if all_fresh and len(cached) == len(candidates):
        # Use cached scores
        for p in candidates:
            p["_score"] = cached.get(p["id"], 0)
        candidates = sorted(candidates, key=lambda p: (-p["_score"], -p["created"]))
        return candidates + rest

    # Build interest summary
    summary = mochi.interests.summary()
    if not summary:
        interest_labels = []
        for i in interests:
            interest_labels.append(i["qid"])
        summary = ", ".join(interest_labels[:15])

    # Build post summaries for the prompt
    post_lines = []
    for i, p in enumerate(candidates):
        title = p.get("title", "")
        body = p.get("body", "")
        if len(body) > 200:
            body = body[:200]
        text = (title + ": " + body).strip() if title else body
        tags = [m["qid"] for m in p.get("_matches", [])]
        tag_str = ", ".join(tags) if tags else "none"
        post_lines.append(str(i) + ". [" + tag_str + "] " + text.replace("\n", " "))

    prompt = get_ai_prompt(forum_data["id"], "score").replace("{{interests}}", summary).replace("{{posts}}", "\n".join(post_lines))

    result = mochi.ai.prompt(prompt, account=account)
    if result["status"] != 200:
        return candidates + rest

    # Parse scores
    text = result["text"].strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1])
    scores = json.decode(text)
    if not scores:
        return candidates + rest

    # Apply scores and update cache
    score_map = {}
    for s in scores:
        idx = s.get("index", -1)
        sc = s.get("score", 0)
        if type(idx) == "int" and idx >= 0 and idx < len(candidates):
            score_map[idx] = sc

    for i, p in enumerate(candidates):
        ai_score = score_map.get(i, 0)
        p["_score"] = ai_score
        mochi.db.execute("insert or replace into score_cache (forum, post, score, computed) values (?, ?, ?, ?)",
            forum_data["id"], p["id"], ai_score, now_ts)

    candidates = sorted(candidates, key=lambda p: (-p["_score"], -p["created"]))
    return candidates + rest
