# Mochi Forums app
# Copyright Alistair Cunningham 2024-2025

# Access level hierarchy: post > comment > vote > view
# Each level grants access to that operation and all operations below it.
# Only owners (with "*" access) have full management permissions.
# "none" means no access (user has no rules or explicit deny).
ACCESS_LEVELS = ["view", "vote", "comment", "post"]

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
    mochi.db.execute("create table settings ( name text not null primary key, value text not null )")

    mochi.db.execute("create table forums ( id text not null primary key, fingerprint text not null, name text not null, members integer not null default 0, updated integer not null )")
    mochi.db.execute("create index forums_fingerprint on forums( fingerprint )")
    mochi.db.execute("create index forums_name on forums( name )")
    mochi.db.execute("create index forums_updated on forums( updated )")

    mochi.db.execute("create table members ( forum references forums( id ), id text not null, name text not null default '', subscribed integer not null, primary key ( forum, id ) )")
    mochi.db.execute("create index members_id on members( id )")

    mochi.db.execute("create table posts ( id text not null primary key, forum references forums( id ), member text not null, name text not null, title text not null, body text not null, comments integer not null default 0, up integer not null default 0, down integer not null default 0, created integer not null, updated integer not null, edited integer not null default 0 )")
    mochi.db.execute("create index posts_forum on posts( forum )")
    mochi.db.execute("create index posts_created on posts( created )")
    mochi.db.execute("create index posts_updated on posts( updated )")

    mochi.db.execute("create table comments ( id text not null primary key, forum references forums( id ), post text not null, parent text not null, member text not null, name text not null, body text not null, up integer not null default 0, down integer not null default 0, created integer not null, edited integer not null default 0 )")
    mochi.db.execute("create index comments_forum on comments( forum )")
    mochi.db.execute("create index comments_post on comments( post )")
    mochi.db.execute("create index comments_parent on comments( parent )")
    mochi.db.execute("create index comments_created on comments( created )")

    mochi.db.execute("create table votes ( forum references forums( id ), post text not null, comment text not null default '', voter text not null, vote text not null, primary key ( forum, post, comment, voter ) )")
    mochi.db.execute("create index votes_post on votes( post )")
    mochi.db.execute("create index votes_comment on votes( comment )")
    mochi.db.execute("create index votes_voter on votes( voter )")

# Database upgrade
def database_upgrade(version):
    if version == 2:
        # Migrate from role-based to mochi.access-based permissions

        # Step 1: Migrate member roles to access rules
        forums = mochi.db.rows("select id from forums")
        for forum in forums:
            forum_id = forum["id"]
            resource = "forum/" + forum_id

            # Get forum owner (entity creator)
            entity = mochi.entity.info(forum_id)
            owner_id = entity.get("creator") if entity else None

            # Migrate each member's role to access rules
            members = mochi.db.rows("select id, role from members where forum=?", forum_id)
            for member in members:
                member_id = member["id"]
                role = member["role"]

                # Skip owner - they have implicit full access
                if owner_id and member_id == owner_id:
                    continue

                # Map role to access level
                access_level = ROLE_TO_ACCESS.get(role)
                if access_level and owner_id:
                    mochi.access.allow(member_id, resource, access_level, owner_id)

        # Step 2: Rename forums.role to forums.access
        mochi.db.execute("alter table forums rename column role to access")

        # Step 3: Rebuild members table without role column
        mochi.db.execute("create table members_new ( forum references forums( id ), id text not null, name text not null default '', subscribed integer not null default 0, primary key ( forum, id ) )")
        mochi.db.execute("insert into members_new ( forum, id, name, subscribed ) select forum, id, name, 0 from members")
        mochi.db.execute("drop table members")
        mochi.db.execute("alter table members_new rename to members")
        mochi.db.execute("create index members_id on members( id )")

    if version == 3:
        # Add edited timestamp to posts and comments for edit tracking
        mochi.db.execute("alter table posts add column edited integer not null default 0")
        mochi.db.execute("alter table comments add column edited integer not null default 0")

    if version == 4:
        # Remove access column - access is now handled entirely by mochi.access rules
        mochi.db.execute("create table forums_new ( id text not null primary key, fingerprint text not null, name text not null, members integer not null default 0, updated integer not null )")
        mochi.db.execute("insert into forums_new ( id, fingerprint, name, members, updated ) select id, fingerprint, name, members, updated from forums")
        mochi.db.execute("drop table forums")
        mochi.db.execute("alter table forums_new rename to forums")
        mochi.db.execute("create index forums_fingerprint on forums( fingerprint )")
        mochi.db.execute("create index forums_name on forums( name )")
        mochi.db.execute("create index forums_updated on forums( updated )")

    if version == 5:
        # Previously ran but mochi.entity.info() didn't include creator
        # Re-run in version 6
        pass

    if version == 6:
        # Add default access rules for existing forums
        # Previously these were implicit in code, now they're explicit in the access system
        forums = mochi.db.rows("select id from forums")
        for forum in forums:
            forum_id = forum["id"]
            resource = "forum/" + forum_id

            # Get forum owner (entity creator)
            entity = mochi.entity.info(forum_id)
            owner_id = entity.get("creator") if entity else None

            if owner_id:
                # Owner has full access
                mochi.access.allow(owner_id, resource, "*", owner_id)
                # Authenticated users can post
                mochi.access.allow("+", resource, "post", owner_id)
                # Anyone can view
                mochi.access.allow("*", resource, "view", owner_id)

# Helper: Get forum by ID or fingerprint
def get_forum(forum_id):
    forum = mochi.db.row("select * from forums where id=?", forum_id)
    if not forum:
        forum = mochi.db.row("select * from forums where fingerprint=?", forum_id)
    return forum

# Helper: Check if current user has access to perform an operation
# Uses hierarchical access levels: post grants comment+vote+view, etc.
# Only owners (with "*" access) have full permissions.
def check_access(a, forum_id, operation):
    resource = "forum/" + forum_id
    user = None
    if a.user and a.user.identity:
        user = a.user.identity.id

    # Owner has full access (mochi.entity.get returns entity only if current user owns it)
    if mochi.entity.get(forum_id):
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

# ACTIONS

# View a forum or list all forums
def action_view(a):
    forum_id = a.input("forum")
    server = a.input("server")
    user_id = a.user.identity.id if a.user else None

    if forum_id:
        forum = get_forum(forum_id)

        # Determine if we need to fetch remotely
        # Remote if: forum not found locally (will use server param or directory lookup)
        is_remote = forum_id and not forum

        # For remote forums, fetch via P2P
        if is_remote:
            if not user_id:
                a.error(401, "Not logged in")
                return

            # Connect to specified server, or use directory lookup
            peer = mochi.remote.peer(server) if server else None
            if server and not peer:
                a.error(502, "Unable to connect to server")
                return

            # Request forum data via P2P
            response = mochi.remote.request(forum_id, "view", {"forum": forum_id}, peer)
            if response.get("error"):
                a.error(response.get("code", 403), response["error"])
                return

            # Return remote data in same format as local view
            return {
                "data": {
                    "forum": {
                        "id": forum_id,
                        "name": response.get("name", ""),
                        "fingerprint": response.get("fingerprint", mochi.entity.fingerprint(forum_id)),
                        "members": 0,
                        "updated": 0,
                        "can_manage": False,
                        "can_post": response.get("can_post", False),
                    },
                    "posts": response.get("posts", []),
                    "member": None,
                    "can_manage": False,
                    "hasMore": False,
                    "nextCursor": None,
                    "remote": True,
                    "server": server,
                }
            }

        if not forum:
            a.error(404, "Forum not found")
            return

        is_owner = mochi.entity.get(forum["id"])

        # Get member info if user is logged in
        member = None
        if a.user:
            member = mochi.db.row("select * from members where forum=? and id=?", forum["id"], a.user.identity.id)

        # Pagination parameters
        limit_str = a.input("limit")
        before_str = a.input("before")
        limit = 20
        if limit_str and mochi.valid(limit_str, "natural"):
            limit = min(int(limit_str), 100)
        before = None
        if before_str and mochi.valid(before_str, "natural"):
            before = int(before_str)

        # Get posts for this forum with pagination
        if before:
            posts = mochi.db.rows("select * from posts where forum=? and updated<? order by updated desc limit ?",
                forum["id"], before, limit + 1)
        else:
            posts = mochi.db.rows("select * from posts where forum=? order by updated desc limit ?",
                forum["id"], limit + 1)

        # Check if there are more posts (we fetched limit+1)
        has_more = len(posts) > limit
        if has_more:
            posts = posts[:limit]

        for p in posts:
            p["created_local"] = mochi.time.local(p["created"])
            p["attachments"] = mochi.attachment.list(p["id"])
            # Fetch attachments from forum owner if we don't have them locally
            if not p["attachments"] and not mochi.entity.get(forum["id"]):
                p["attachments"] = mochi.attachment.fetch(p["id"], forum["id"])
            # Get comment count for this post
            p["comments"] = mochi.db.rows("select * from comments where forum=? and post=? order by created desc",
                forum["id"], p["id"])

        # Calculate next cursor
        next_cursor = None
        if has_more and len(posts) > 0:
            next_cursor = posts[-1]["updated"]

        # Add access flags to forum object (is_owner already set above)
        if is_owner:
            forum["can_manage"] = check_access(a, forum["id"], "manage")
            forum["can_post"] = check_access(a, forum["id"], "post")
        else:
            forum["can_manage"] = False  # Subscribers can never manage
            # Query owner for post access
            access_response = mochi.remote.request(forum["id"], "access/check", {
                "operations": ["post"],
                "user": user_id,
            })
            forum["can_post"] = access_response.get("post", False)

        return {
            "data": {
                "forum": forum,
                "posts": posts,
                "member": member,
                "can_manage": forum["can_manage"],
                "hasMore": has_more,
                "nextCursor": next_cursor
            }
        }
    else:
        # List all forums
        forums = mochi.db.rows("select * from forums order by updated desc")
        posts = mochi.db.rows("select * from posts order by updated desc")

        # Add access flags to each forum
        # For owned forums, check locally. For subscribed forums, query owner.
        for f in forums:
            is_owner = mochi.entity.get(f["id"])
            if is_owner:
                f["can_manage"] = check_access(a, f["id"], "manage")
                f["can_post"] = check_access(a, f["id"], "post")
            else:
                f["can_manage"] = False  # Subscribers can never manage
                # Query owner for post access
                access_response = mochi.remote.request(f["id"], "access/check", {
                    "operations": ["post"],
                    "user": user_id,
                })
                f["can_post"] = access_response.get("post", False)

        for p in posts:
            p["created_local"] = mochi.time.local(p["created"])
            # Get attachments for this post
            p["attachments"] = mochi.attachment.list(p["id"])
            # Fetch attachments from forum owner if we don't have them locally
            forum = None
            for f in forums:
                if f["id"] == p["forum"]:
                    forum = f
                    break
            if not p["attachments"] and forum and not mochi.entity.get(forum["id"]):
                p["attachments"] = mochi.attachment.fetch(p["id"], forum["id"])
            # Get comments for this post
            p["comment_list"] = mochi.db.rows("select * from comments where forum=? and post=? order by created desc",
                p["forum"], p["id"])

        return {
            "data": {
                "forums": forums,
                "posts": posts
            }
        }

# Create new forum
def action_create(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    name = a.input("name")
    if not mochi.valid(name, "name"):
        a.error(400, "Invalid name")
        return

    # Create entity for the forum
    entity_id = mochi.entity.create("forum", name, "public", "")
    if not entity_id:
        a.error(500, "Failed to create forum entity")
        return

    # Create forum record
    entity_fp = mochi.entity.fingerprint(entity_id)
    now = mochi.time.now()
    mochi.db.execute("replace into forums ( id, fingerprint, name, members, updated ) values ( ?, ?, ?, ?, ? )",
        entity_id, entity_fp, name, 1, now)

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
        "data": {"id": entity_id, "fingerprint": entity_fp}
    }

# Find forums by searching
def action_find(a):
    search = a.input("search")
    forums = []
    if search:
        forums = mochi.directory.search("forum", search, False)
    return {
        "data": {"forums": forums}
    }

# Form for new forum
def action_new(a):
    if not a.user:
        a.error(401, "Not logged in")
        return
    return {
        "data": {}
    }

# Create new post
def action_post_create(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    forum_id = a.input("forum")
    forum = get_forum(forum_id)

    title = a.input("title")
    if not mochi.valid(title, "name"):
        a.error(400, "Invalid title")
        return

    body = a.input("body")
    if not mochi.valid(body, "text"):
        a.error(400, "Invalid body")
        return

    user_id = a.user.identity.id
    user_name = a.user.identity.name
    id = mochi.uid()
    now = mochi.time.now()

    # Check if forum exists locally
    if forum:
        # Check if we own this forum
        entity = mochi.entity.get(forum["id"])
        is_owner = len(entity) > 0 if entity else False

        if is_owner:
            # Owner processes locally
            if not check_access(a, forum["id"], "post"):
                a.error(403, "Not authorized to post")
                return

            mochi.db.execute("replace into posts ( id, forum, member, name, title, body, created, updated ) values ( ?, ?, ?, ?, ?, ?, ?, ? )",
                id, forum["id"], user_id, user_name, title, body, now, now)

            mochi.db.execute("update forums set updated=? where id=?", now, forum["id"])

            # Get members for notification (excluding sender)
            members = mochi.db.rows("select id from members where forum=? and id!=?", forum["id"], user_id)

            # Save any uploaded attachments and notify members via _attachment/create events
            attachments = mochi.attachment.save(id, "attachments", [], [], members)

            # Broadcast post to members (attachments sent separately via federation)
            post_data = {
                "id": id,
                "member": user_id,
                "name": user_name,
                "title": title,
                "body": body,
                "created": now
            }

            broadcast_event(forum["id"], "post/create", post_data, user_id)
        else:
            # We're a subscriber - check access with owner first
            access_response = mochi.remote.request(forum["id"], "access/check", {
                "operations": ["post"],
                "user": user_id,
            })
            if not access_response.get("post", False):
                a.error(403, "Not authorized to post")
                return

            # Save attachments and send to forum owner
            attachments = mochi.attachment.save(id, "attachments", [], [], [forum["id"]])

            mochi.message.send(
                {"from": user_id, "to": forum["id"], "service": "forums", "event": "post/submit"},
                {"id": id, "title": title, "body": body}
            )

            # Save locally for optimistic UI
            mochi.db.execute("replace into posts ( id, forum, member, name, title, body, created, updated ) values ( ?, ?, ?, ?, ?, ?, ?, ? )",
                id, forum["id"], user_id, user_name, title, body, now, now)

        return {
            "data": {"forum": forum["id"], "post": id}
        }

    # Forum not found locally - send to remote forum
    if not mochi.valid(forum_id, "entity"):
        a.error(404, "Forum not found")
        return

    # Check access with remote forum owner
    access_response = mochi.remote.request(forum_id, "access/check", {
        "operations": ["post"],
        "user": user_id,
    })
    if not access_response.get("post", False):
        a.error(403, "Not authorized to post")
        return

    # Save attachments and send to forum owner
    attachments = mochi.attachment.save(id, "attachments", [], [], [forum_id])

    # Send post to remote forum owner
    mochi.message.send(
        {"from": user_id, "to": forum_id, "service": "forums", "event": "post/submit"},
        {"id": id, "title": title, "body": body}
    )

    return {
        "data": {"forum": forum_id, "post": id}
    }

# Form for new post
def action_post_new(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error(404, "Forum not found")
        return

    if not check_access(a, forum["id"], "post"):
        a.error(403, "Not authorized to post")
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
    if mochi.valid(search, "entity"):
        entry = mochi.directory.get(search)
        if entry and entry.get("class") == "forum":
            results.append(entry)

    # Check if search term is a fingerprint (9 alphanumeric, with or without hyphens)
    fingerprint = search.replace("-", "")
    if mochi.valid(fingerprint, "fingerprint"):
        all_forums = mochi.directory.search("forum", "", True)
        for entry in all_forums:
            entry_fp = entry.get("fingerprint", "").replace("-", "")
            if entry_fp == fingerprint:
                # Avoid duplicates
                found = False
                for r in results:
                    if r.get("id") == entry.get("id"):
                        found = True
                        break
                if not found:
                    results.append(entry)
                break

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

            if mochi.valid(forum_id, "entity"):
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

    return {"data": {"results": results}}

# Probe a remote forum by URL
def action_probe(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    user_id = a.user.identity.id

    url = a.input("url")
    if not url:
        a.error(400, "No URL provided")
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
        a.error(400, "Invalid URL format. Expected: https://server/forums/FORUM_ID")
        return

    if not server or server == protocol:
        a.error(400, "Could not extract server from URL")
        return

    if not forum_id or not mochi.valid(forum_id, "entity"):
        a.error(400, "Could not extract valid forum ID from URL")
        return

    # Connect to server and query forum info
    peer = mochi.remote.peer(server)
    if not peer:
        a.error(502, "Unable to connect to server")
        return

    response = mochi.remote.request(forum_id, "info", {"forum": forum_id}, peer)
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
        a.error(401, "Not logged in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error(404, "Forum not found")
        return

    if not check_access(a, forum["id"], "manage"):
        a.error(403, "Not authorized")
        return

    members = mochi.db.rows("select * from members where forum=? order by name", forum["id"])

    return {
        "data": {
            "forum": forum,
            "members": members
        }
    }

# Save forum members (deprecated - use access endpoints instead)
# Kept for removing members from the forum
def action_members_save(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error(404, "Forum not found")
        return

    if not check_access(a, forum["id"], "manage"):
        a.error(403, "Not authorized")
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

# Subscribe to a forum
def action_subscribe(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    forum_id = a.input("forum")
    forum = mochi.directory.get(forum_id)
    if not forum:
        a.error(404, "Forum not found")
        return

    # Check if already subscribed
    if mochi.db.exists("select id from members where forum=? and id=?", forum_id, a.user.identity.id):
        return {
            "data": {"already_subscribed": True}
        }

    # Create local forum record
    now = mochi.time.now()
    mochi.db.execute("replace into forums ( id, fingerprint, name, members, updated ) values ( ?, ?, ?, ?, ? )",
        forum_id, forum["fingerprint"], forum["name"], 0, now)

    # Add self as subscriber
    mochi.db.execute("replace into members ( forum, id, name, subscribed ) values ( ?, ?, ?, ? )",
        forum_id, a.user.identity.id, a.user.identity.name, now)

    # Send subscribe message to forum owner
    mochi.message.send(
        {"from": a.user.identity.id, "to": forum_id, "service": "forums", "event": "subscribe"},
        {"name": a.user.identity.name},
        []
    )

    return {
        "data": {}
    }

# Unsubscribe from forum
def action_unsubscribe(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error(404, "Forum not found")
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
        a.error(401, "Not logged in")
        return

    forum_id = a.input("forum")
    forum = get_forum(forum_id)
    if not forum:
        a.error(404, "Forum not found")
        return

    # Only owner can delete
    if not mochi.entity.get(forum["id"]):
        a.error(403, "Only the owner can delete this forum")
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
            a.error(401, "Not logged in")
            return

        # Connect to specified server, or use directory lookup
        peer = mochi.remote.peer(server) if server else None
        if server and not peer:
            a.error(502, "Unable to connect to server")
            return

        # Request post data via P2P
        response = mochi.remote.request(forum_id, "post/view", {"forum": forum_id, "post": post_id}, peer)
        if response.get("error"):
            a.error(response.get("code", 403), response["error"])
            return

        # Return remote data
        return {"data": response}

    if not post:
        a.error(404, "Post not found")
        return

    forum = get_forum(post["forum"])
    if not forum:
        a.error(404, "Forum not found")
        return

    is_owner = mochi.entity.get(forum["id"])

    member = None
    if a.user:
        member = mochi.db.row("select * from members where forum=? and id=?", forum["id"], a.user.identity.id)

    # Check access levels for UI permissions (is_owner already set above)
    if is_owner:
        can_vote = check_access(a, forum["id"], "vote")
        can_comment = check_access(a, forum["id"], "comment")
    else:
        # Query owner for access permissions
        access_response = mochi.remote.request(forum["id"], "access/check", {
            "operations": ["vote", "comment"],
            "user": user_id,
        })
        can_vote = access_response.get("vote", False)
        can_comment = access_response.get("comment", False)

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

        comments = mochi.db.rows("select * from comments where forum=? and post=? and parent=? order by created desc",
            forum["id"], post_id, parent_id)

        for c in comments:
            c["created_local"] = mochi.time.local(c["created"])
            c["children"] = get_comments(c["id"], depth + 1)
            c["can_vote"] = can_vote
            c["can_comment"] = can_comment
            # Get user's vote on this comment
            c["user_vote"] = ""
            if a.user:
                cv = mochi.db.row("select vote from votes where comment=? and voter=?", c["id"], a.user.identity.id)
                if cv:
                    c["user_vote"] = cv["vote"]

        return comments

    post["created_local"] = mochi.time.local(post["created"])
    post["user_vote"] = user_post_vote
    post["attachments"] = mochi.attachment.list(post_id)
    # Fetch attachments from forum owner if we don't have them locally
    if not post["attachments"] and not mochi.entity.get(forum["id"]):
        post["attachments"] = mochi.attachment.fetch(post_id, forum["id"])

    comments = get_comments("", 0)

    return {
        "data": {
            "forum": forum,
            "post": post,
            "comments": comments,
            "member": member,
            "can_vote": can_vote,
            "can_comment": can_comment
        }
    }

# Edit a post
def action_post_edit(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    forum_id = a.input("forum")
    post_id = a.input("post")
    user_id = a.user.identity.id

    title = a.input("title")
    if not mochi.valid(title, "name"):
        a.error(400, "Invalid title")
        return

    body = a.input("body")
    if not mochi.valid(body, "text"):
        a.error(400, "Invalid body")
        return

    post = mochi.db.row("select * from posts where id=?", post_id)
    forum = get_forum(forum_id)

    # Check if we have the post locally
    if post and forum:
        # Check if we own this forum
        entity = mochi.entity.get(forum["id"])
        is_owner = len(entity) > 0 if entity else False

        if is_owner:
            # Owner processes locally - full edit with attachments
            is_author = user_id == post["member"]
            is_manager = check_access(a, forum["id"], "manage")
            if not is_author and not is_manager:
                a.error(403, "Not authorized to edit this post")
                return

            now = mochi.time.now()

            # Handle attachment changes
            order_json = a.input("order")
            if order_json:
                order = json.decode(order_json)
            else:
                order = []

            current_attachments = mochi.attachment.list(post_id)
            current_ids = [att["id"] for att in current_attachments]
            members = [m["id"] for m in mochi.db.rows("select id from members where forum=?", forum["id"])]
            new_attachments = mochi.attachment.save(post_id, "attachments", [], [], members)

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
                        mochi.attachment.delete(att_id, members)
                for i, att_id in enumerate(final_order):
                    mochi.attachment.move(att_id, i + 1, members)
            else:
                for att_id in current_ids:
                    mochi.attachment.delete(att_id, members)

            mochi.db.execute("update posts set title=?, body=?, updated=?, edited=? where id=?",
                title, body, now, now, post_id)
            mochi.db.execute("update forums set updated=? where id=?", now, forum["id"])

            post_data = {
                "id": post_id,
                "title": title,
                "body": body,
                "edited": now
            }
            broadcast_event(forum["id"], "post/edit", post_data, user_id)
        else:
            # Subscriber - must be author or have manage access to edit
            is_author = user_id == post["member"]
            is_manager = check_access(a, forum["id"], "manage")
            if not is_author and not is_manager:
                a.error(403, "Not authorized to edit this post")
                return

            now = mochi.time.now()

            # Handle attachments - save new ones and send to owner
            order_json = a.input("order")
            if order_json:
                order = json.decode(order_json)
            else:
                order = []

            current_attachments = mochi.attachment.list(post_id)
            current_ids = [att["id"] for att in current_attachments]

            # Save new attachments and send to forum owner
            new_attachments = mochi.attachment.save(post_id, "attachments", [], [], [forum["id"]])

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

            # Send edit request to forum owner with attachment info
            mochi.message.send(
                {"from": user_id, "to": forum["id"], "service": "forums", "event": "post/edit/submit"},
                {"id": post_id, "title": title, "body": body, "order": final_order, "delete": delete_ids}
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
    if not mochi.valid(forum_id, "entity"):
        a.error(404, "Forum not found")
        return

    # For remote forums, we can still send new attachments
    order_json = a.input("order")
    if order_json:
        order = json.decode(order_json)
    else:
        order = []

    # Save new attachments and send to forum owner
    new_attachments = mochi.attachment.save(post_id, "attachments", [], [], [forum_id])

    # Build final order (only new attachments, no existing ones locally)
    final_order = []
    for item in order:
        if item.startswith("new:"):
            idx = int(item[4:])
            if idx < len(new_attachments):
                final_order.append(new_attachments[idx]["id"])
        else:
            final_order.append(item)

    mochi.message.send(
        {"from": user_id, "to": forum_id, "service": "forums", "event": "post/edit/submit"},
        {"id": post_id, "title": title, "body": body, "order": final_order, "delete": []}
    )

    return {
        "data": {"forum": forum_id, "post": post_id}
    }

# Delete a post
def action_post_delete(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    forum_id = a.input("forum")
    post_id = a.input("post")
    user_id = a.user.identity.id

    post = mochi.db.row("select * from posts where id=?", post_id)
    forum = get_forum(forum_id)

    # Check if we have the post locally
    if post and forum:
        # Check if we own this forum
        entity = mochi.entity.get(forum["id"])
        is_owner = len(entity) > 0 if entity else False

        if is_owner:
            # Owner processes locally
            is_author = user_id == post["member"]
            is_manager = check_access(a, forum["id"], "manage")
            if not is_author and not is_manager:
                a.error(403, "Not authorized to delete this post")
                return

            # Delete all attachments for this post
            attachments = mochi.attachment.list(post_id)
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
        else:
            # Subscriber - must be author or have manage access to delete
            is_author = user_id == post["member"]
            is_manager = check_access(a, forum["id"], "manage")
            if not is_author and not is_manager:
                a.error(403, "Not authorized to delete this post")
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
    if not mochi.valid(forum_id, "entity"):
        a.error(404, "Forum not found")
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
        a.error(401, "Not logged in")
        return
    
    forum = get_forum(a.input("forum"))
    if not forum:
        a.error(404, "Forum not found")
        return
    
    return {
        "data": {
            "forum": forum,
            "post": a.input("post"),
            "parent": a.input("parent")
        }
    }

# Create new comment
def action_comment_create(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    forum_id = a.input("forum")
    forum = get_forum(forum_id)

    post_id = a.input("post")
    parent_id = a.input("parent")
    body = a.input("body")

    if not mochi.valid(body, "text"):
        a.error(400, "Invalid body")
        return

    user_id = a.user.identity.id
    user_name = a.user.identity.name
    id = mochi.uid()
    now = mochi.time.now()

    # Check if forum exists locally
    if forum:
        # Check if we own this forum
        entity = mochi.entity.get(forum["id"])
        is_owner = len(entity) > 0 if entity else False

        if is_owner:
            # Owner processes locally
            if not check_access(a, forum["id"], "comment"):
                a.error(403, "Not authorized to comment")
                return

            if not mochi.db.exists("select id from posts where id=? and forum=?", post_id, forum["id"]):
                a.error(404, "Post not found")
                return

            if parent_id and not mochi.db.exists("select id from comments where id=? and post=?", parent_id, post_id):
                a.error(404, "Parent comment not found")
                return

            mochi.db.execute("replace into comments ( id, forum, post, parent, member, name, body, created ) values ( ?, ?, ?, ?, ?, ?, ?, ? )",
                id, forum["id"], post_id, parent_id or "", user_id, user_name, body, now)

            mochi.db.execute("update posts set updated=?, comments=comments+1 where id=?", now, post_id)
            mochi.db.execute("update forums set updated=? where id=?", now, forum["id"])

            # Broadcast to members
            comment_data = {
                "id": id,
                "post": post_id,
                "parent": parent_id or "",
                "member": user_id,
                "name": user_name,
                "body": body,
                "created": now
            }

            broadcast_event(forum["id"], "comment/create", comment_data, user_id)
        else:
            # We're a subscriber - check access with owner first
            access_response = mochi.remote.request(forum["id"], "access/check", {
                "operations": ["comment"],
                "user": user_id,
            })
            if not access_response.get("comment", False):
                a.error(403, "Not authorized to comment")
                return

            # Send comment to forum owner
            mochi.message.send(
                {"from": user_id, "to": forum["id"], "service": "forums", "event": "comment/submit"},
                {"id": id, "post": post_id, "parent": parent_id or "", "body": body}
            )

            # Save locally for optimistic UI
            mochi.db.execute("replace into comments ( id, forum, post, parent, member, name, body, created ) values ( ?, ?, ?, ?, ?, ?, ?, ? )",
                id, forum["id"], post_id, parent_id or "", user_id, user_name, body, now)
            mochi.db.execute("update posts set updated=?, comments=comments+1 where id=?", now, post_id)

        return {
            "data": {"forum": forum["id"], "post": post_id, "comment": id}
        }

    # Forum not found locally - send to remote forum
    if not mochi.valid(forum_id, "entity"):
        a.error(404, "Forum not found")
        return

    # Check access with remote forum owner
    access_response = mochi.remote.request(forum_id, "access/check", {
        "operations": ["comment"],
        "user": user_id,
    })
    if not access_response.get("comment", False):
        a.error(403, "Not authorized to comment")
        return

    # Send comment to remote forum owner
    mochi.message.send(
        {"from": user_id, "to": forum_id, "service": "forums", "event": "comment/submit"},
        {"id": id, "post": post_id, "parent": parent_id or "", "body": body}
    )

    return {
        "data": {"forum": forum_id, "post": post_id, "comment": id}
    }

# Edit a comment
def action_comment_edit(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    forum_id = a.input("forum")
    post_id = a.input("post")
    comment_id = a.input("comment")
    user_id = a.user.identity.id

    body = a.input("body")
    if not mochi.valid(body, "text"):
        a.error(400, "Invalid body")
        return

    comment = mochi.db.row("select * from comments where id=?", comment_id)
    forum = get_forum(forum_id)

    # Check if we have the comment locally
    if comment and forum:
        # Check if we own this forum
        entity = mochi.entity.get(forum["id"])
        is_owner = len(entity) > 0 if entity else False

        if is_owner:
            # Owner processes locally
            is_author = user_id == comment["member"]
            is_manager = check_access(a, forum["id"], "manage")
            if not is_author and not is_manager:
                a.error(403, "Not authorized to edit this comment")
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
        else:
            # Subscriber - must be author or have manage access to edit
            is_author = user_id == comment["member"]
            is_manager = check_access(a, forum["id"], "manage")
            if not is_author and not is_manager:
                a.error(403, "Not authorized to edit this comment")
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
    if not mochi.valid(forum_id, "entity"):
        a.error(404, "Forum not found")
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
        a.error(401, "Not logged in")
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
        entity = mochi.entity.get(forum["id"])
        is_owner = len(entity) > 0 if entity else False

        if is_owner:
            # Owner processes locally
            is_author = user_id == comment["member"]
            is_manager = check_access(a, forum["id"], "manage")
            if not is_author and not is_manager:
                a.error(403, "Not authorized to delete this comment")
                return

            comment_ids = [comment_id] + collect_descendants(forum["id"], comment["post"], comment_id)
            deleted_count = len(comment_ids)

            # Delete attachments for all comments being deleted
            for cid in comment_ids:
                attachments = mochi.attachment.list(cid)
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
        else:
            # Subscriber - must be author or have manage access to delete
            is_author = user_id == comment["member"]
            is_manager = check_access(a, forum["id"], "manage")
            if not is_author and not is_manager:
                a.error(403, "Not authorized to delete this comment")
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
    if not mochi.valid(forum_id, "entity"):
        a.error(404, "Forum not found")
        return

    mochi.message.send(
        {"from": user_id, "to": forum_id, "service": "forums", "event": "comment/delete/submit"},
        {"id": comment_id}
    )

    return {
        "data": {"forum": forum_id, "post": post_id}
    }

# Vote on a post
def action_post_vote(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    post_id = a.input("post")
    forum_id = a.input("forum")

    vote = a.input("vote")
    # "none" in URL path means remove vote
    if vote == "none":
        vote = ""
    if vote not in ["up", "down", ""]:
        a.error(400, "Invalid vote")
        return

    user_id = a.user.identity.id

    # Try to find post locally
    post = mochi.db.row("select * from posts where id=?", post_id)

    if post:
        forum = get_forum(post["forum"])
        if not forum:
            a.error(404, "Forum not found")
            return

        # Check if we own this forum
        entity = mochi.entity.get(forum["id"])
        is_owner = len(entity) > 0 if entity else False

        if is_owner:
            # Owner checks access locally
            if not check_access(a, forum["id"], "vote"):
                a.error(403, "Not authorized to vote")
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
        else:
            # We're a subscriber - check access with owner first
            access_response = mochi.remote.request(forum["id"], "access/check", {
                "operations": ["vote"],
                "user": user_id,
            })
            if not access_response.get("vote", False):
                a.error(403, "Not authorized to vote")
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
    if not forum_id or not mochi.valid(forum_id, "entity"):
        a.error(404, "Post not found")
        return

    # Check access with remote forum owner
    access_response = mochi.remote.request(forum_id, "access/check", {
        "operations": ["vote"],
        "user": user_id,
    })
    if not access_response.get("vote", False):
        a.error(403, "Not authorized to vote")
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
        a.error(401, "Not logged in")
        return

    comment_id = a.input("comment")
    forum_id = a.input("forum")

    vote = a.input("vote")
    # "none" in URL path means remove vote
    if vote == "none":
        vote = ""
    if vote not in ["up", "down", ""]:
        a.error(400, "Invalid vote")
        return

    user_id = a.user.identity.id

    # Try to find comment locally
    comment = mochi.db.row("select * from comments where id=?", comment_id)

    if comment:
        forum = get_forum(comment["forum"])
        if not forum:
            a.error(404, "Forum not found")
            return

        # Check if we own this forum
        entity = mochi.entity.get(forum["id"])
        is_owner = len(entity) > 0 if entity else False

        if is_owner:
            # Owner checks access locally
            if not check_access(a, forum["id"], "vote"):
                a.error(403, "Not authorized to vote")
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
            access_response = mochi.remote.request(forum["id"], "access/check", {
                "operations": ["vote"],
                "user": user_id,
            })
            if not access_response.get("vote", False):
                a.error(403, "Not authorized to vote")
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
    if not forum_id or not mochi.valid(forum_id, "entity"):
        a.error(404, "Comment not found")
        return

    # Check access with remote forum owner
    access_response = mochi.remote.request(forum_id, "access/check", {
        "operations": ["vote"],
        "user": user_id,
    })
    if not access_response.get("vote", False):
        a.error(403, "Not authorized to vote")
        return

    mochi.message.send(
        {"from": user_id, "to": forum_id, "service": "forums", "event": "comment/vote"},
        {"comment": comment_id, "vote": vote if vote else "none"}
    )

    return {
        "data": {"forum": forum_id, "comment": comment_id}
    }


# ATTACHMENT VIEWING

# Unified attachment view - handles both local and remote forums
def action_attachment_view(a):
    user_id = a.user.identity.id if a.user and a.user.identity else None

    forum_id = a.input("forum")
    attachment_id = a.input("attachment")

    if not attachment_id:
        a.error(400, "Missing attachment")
        return

    # Get local forum data if available
    forum = None
    if forum_id and (mochi.valid(forum_id, "entity") or mochi.valid(forum_id, "fingerprint")):
        forum = get_forum(forum_id)

    # If forum is local and we own it, serve directly
    if forum and mochi.entity.get(forum["id"]):
        # Check view access
        if not check_access(a, forum["id"], "view"):
            a.error(403, "Access denied")
            return

        # Find the attachment by searching through posts in this forum
        posts = mochi.db.rows("select id from posts where forum=?", forum["id"])
        found = None
        for post in posts:
            attachments = mochi.attachment.list(post["id"])
            for att in attachments:
                if att.get("id") == attachment_id:
                    found = att
                    break
            if found:
                break

        if not found:
            a.error(404, "Attachment not found")
            return

        # Get attachment file path and serve directly
        path = mochi.attachment.path(attachment_id)
        if not path:
            a.error(404, "Attachment file not found")
            return

        a.write_from_file(path)
        return

    # Remote forum - stream via P2P
    if not user_id:
        a.error(401, "Not logged in")
        return

    if not mochi.valid(forum_id, "entity") and not mochi.valid(forum_id, "fingerprint"):
        a.error(400, "Invalid forum ID")
        return

    # Create stream to forum owner and request attachment
    s = mochi.remote.stream(forum_id, "attachment/view", {"attachment": attachment_id})
    if not s:
        a.error(502, "Unable to connect to forum")
        return

    # Read status response
    response = s.read()
    if not response or response.get("status") != "200":
        s.close()
        error = response.get("error", "Attachment not found") if response else "No response"
        a.error(404, error)
        return

    # Set Content-Type header before streaming
    content_type = response.get("content_type", "application/octet-stream")
    a.header("Content-Type", content_type)

    # Stream file directly to HTTP response
    a.write_from_stream(s)
    s.close()

# Unified thumbnail view - handles both local and remote forums
def action_attachment_thumbnail(a):
    user_id = a.user.identity.id if a.user and a.user.identity else None

    forum_id = a.input("forum")
    attachment_id = a.input("attachment")
    server = a.input("server")

    if not attachment_id:
        a.error(400, "Missing attachment")
        return

    # Get local forum data if available
    forum = None
    if forum_id and (mochi.valid(forum_id, "entity") or mochi.valid(forum_id, "fingerprint")):
        forum = get_forum(forum_id)

    # If forum is local and we own it, serve thumbnail directly
    if forum and mochi.entity.get(forum["id"]):
        # Check view access
        if not check_access(a, forum["id"], "view"):
            a.error(403, "Access denied")
            return

        # Get thumbnail path (creates thumbnail if needed)
        path = mochi.attachment.thumbnail_path(attachment_id)
        if not path:
            # Fall back to original if no thumbnail available
            path = mochi.attachment.path(attachment_id)
        if not path:
            a.error(404, "Attachment not found")
            return

        a.write_from_file(path)
        return

    # Remote forum - stream via P2P (request thumbnail)
    if not user_id:
        a.error(401, "Not logged in")
        return

    if not mochi.valid(forum_id, "entity") and not mochi.valid(forum_id, "fingerprint"):
        a.error(400, "Invalid forum ID")
        return

    # Connect to server if provided
    peer = mochi.remote.peer(server) if server else None
    if server and not peer:
        a.error(502, "Unable to connect to server")
        return

    # Create stream to forum owner and request thumbnail
    s = mochi.remote.stream(forum_id, "attachment/view", {"attachment": attachment_id, "thumbnail": True}, peer)
    if not s:
        a.error(502, "Unable to connect to forum")
        return

    # Read status response
    response = s.read()
    if not response or response.get("status") != "200":
        s.close()
        error = response.get("error", "Thumbnail not found") if response else "No response"
        a.error(404, error)
        return

    # Set Content-Type header before streaming
    content_type = response.get("content_type", "image/jpeg")
    a.header("Content-Type", content_type)

    # Stream file directly to HTTP response
    a.write_from_stream(s)
    s.close()


# ACCESS MANAGEMENT

# Get access rules for a forum
def action_access(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error(404, "Forum not found")
        return

    if not check_access(a, forum["id"], "manage"):
        a.error(403, "Not authorized")
        return

    # Get owner - if we own this entity, use current user's info
    owner = None
    if mochi.entity.get(forum["id"]):
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
            elif mochi.valid(subject, "entity"):
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
        a.error(401, "Not logged in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error(404, "Forum not found")
        return

    if not check_access(a, forum["id"], "manage"):
        a.error(403, "Not authorized")
        return

    target = a.input("target")
    # Allow special subjects (*, +), groups (@name), and valid entity IDs
    if target not in ["*", "+"] and not target.startswith("@") and not mochi.valid(target, "entity"):
        a.error(400, "Invalid target")
        return

    level = a.input("level")
    if level not in ACCESS_LEVELS + ["none"]:
        a.error(400, "Invalid access level")
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
        a.error(401, "Not logged in")
        return

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error(404, "Forum not found")
        return

    if not check_access(a, forum["id"], "manage"):
        a.error(403, "Not authorized")
        return

    target = a.input("target")
    # Allow special subjects (*, +), groups (@name), and valid entity IDs
    if target not in ["*", "+"] and not target.startswith("@") and not mochi.valid(target, "entity"):
        a.error(400, "Invalid target")
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
            e.stream.write({"status": "403", "error": "Not authorized to view this forum"})
            return

    # Find the attachment by searching through posts in this forum
    posts = mochi.db.rows("select id from posts where forum=?", forum_id)
    found = None
    for post in posts:
        attachments = mochi.attachment.list(post["id"])
        for att in attachments:
            if att.get("id") == attachment_id:
                found = att
                break
        if found:
            break

    if not found:
        e.stream.write({"status": "404", "error": "Attachment not found"})
        return

    # Get the file path (thumbnail or original)
    if want_thumbnail:
        path = mochi.attachment.thumbnail_path(attachment_id)
        if not path:
            path = mochi.attachment.path(attachment_id)
    else:
        path = mochi.attachment.path(attachment_id)

    if not path:
        e.stream.write({"status": "404", "error": "Attachment file not found"})
        return

    # Send success status with content type, then stream the file
    content_type = found.get("type", "application/octet-stream")
    if want_thumbnail:
        content_type = "image/jpeg"  # Thumbnails are always JPEG
    e.stream.write({"status": "200", "content_type": content_type})
    e.stream.write_from_file(path)

# Received a comment from forum owner
def event_comment_create_event(e):
    forum = get_forum(e.header("from"))
    if not forum:
        return

    id = e.content("id")
    if not mochi.valid(id, "id"):
        return

    up = e.content("up") or 0
    down = e.content("down") or 0

    # If comment exists, just update vote counts (for subscription sync)
    if mochi.db.exists("select id from comments where id=?", id):
        mochi.db.execute("update comments set up=?, down=? where id=?", up, down, id)
        return

    post = e.content("post")
    if not mochi.db.exists("select id from posts where forum=? and id=?", forum["id"], post):
        return

    parent = e.content("parent") or ""
    member = e.content("member")
    name = e.content("name")
    body = e.content("body")
    created = e.content("created")

    if not mochi.valid(member, "entity"):
        return
    if not mochi.valid(name, "name"):
        return
    if not mochi.valid(body, "text"):
        return

    # Validate timestamp is within reasonable range (not more than 1 day in future or 1 year in past)
    now = mochi.time.now()
    if created > now + 86400 or created < now - 31536000:
        return

    mochi.db.execute("replace into comments ( id, forum, post, parent, member, name, body, up, down, created ) values ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ? )",
        id, forum["id"], post, parent, member, name, body, up, down, created)

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

    # Get sender name from members table, fall back to directory lookup
    member = mochi.db.row("select name from members where forum=? and id=?", forum["id"], sender_id)
    sender_name = member["name"] if member and member["name"] else ""
    if not sender_name:
        entity = mochi.directory.get(sender_id)
        sender_name = entity["name"] if entity and entity["name"] else "Anonymous"

    id = e.content("id")
    if not mochi.valid(id, "id"):
        return

    if mochi.db.exists("select id from comments where id=?", id):
        return  # Duplicate

    post = e.content("post")
    if not mochi.db.exists("select id from posts where forum=? and id=?", forum["id"], post):
        return

    parent = e.content("parent") or ""
    if parent and not mochi.db.exists("select id from comments where forum=? and post=? and id=?", forum["id"], post, parent):
        return

    body = e.content("body")
    if not mochi.valid(body, "text"):
        return

    now = mochi.time.now()

    mochi.db.execute("replace into comments ( id, forum, post, parent, member, name, body, created ) values ( ?, ?, ?, ?, ?, ?, ?, ? )",
        id, forum["id"], post, parent, sender_id, sender_name, body, now)

    mochi.db.execute("update posts set updated=?, comments=comments+1 where id=?", now, post)
    mochi.db.execute("update forums set updated=? where id=?", now, forum["id"])

    # Broadcast to all members except sender
    comment_data = {
        "id": id,
        "post": post,
        "parent": parent,
        "member": sender_id,
        "name": sender_name,
        "body": body,
        "created": now
    }

    broadcast_event(forum["id"], "comment/create", comment_data)

# Received a comment edit request from member (we are forum owner)
def event_comment_edit_submit_event(e):
    forum = get_forum(e.header("to"))
    if not forum:
        return

    sender_id = e.header("from")
    comment_id = e.content("id")
    if not mochi.valid(comment_id, "id"):
        return

    comment = mochi.db.row("select * from comments where forum=? and id=?", forum["id"], comment_id)
    if not comment:
        return

    # Check authorization: must be comment author
    if sender_id != comment["member"]:
        return

    body = e.content("body")
    if not mochi.valid(body, "text"):
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
    if not mochi.valid(comment_id, "id"):
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
        attachments = mochi.attachment.list(cid)
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

    if not mochi.valid(body, "text"):
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
            attachments = mochi.attachment.list(comment_id)
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
    if not mochi.valid(id, "id"):
        return

    up = e.content("up") or 0
    down = e.content("down") or 0
    comments_count = e.content("comments") or 0

    # If post exists, just update vote counts (for subscription sync)
    if mochi.db.exists("select id from posts where id=?", id):
        mochi.db.execute("update posts set up=?, down=?, comments=? where id=?", up, down, comments_count, id)
        return

    member = e.content("member")
    name = e.content("name")
    title = e.content("title")
    body = e.content("body")
    created = e.content("created")

    if not mochi.valid(member, "entity"):
        return
    if not mochi.valid(name, "name"):
        return
    if not mochi.valid(title, "name"):
        return
    if not mochi.valid(body, "text"):
        return

    # Validate timestamp is within reasonable range (not more than 1 day in future or 1 year in past)
    now = mochi.time.now()
    if created > now + 86400 or created < now - 31536000:
        return

    mochi.db.execute("replace into posts ( id, forum, member, name, title, body, up, down, comments, created, updated ) values ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? )",
        id, forum["id"], member, name, title, body, up, down, comments_count, created, created)

    mochi.db.execute("update forums set updated=? where id=?", created, forum["id"])
    # Attachments arrive via _attachment/create events and are saved automatically

# Received a post submission from member (we are forum owner)
def event_post_submit_event(e):
    forum = get_forum(e.header("to"))
    if not forum:
        return

    sender_id = e.header("from")
    if not check_event_access(sender_id, forum["id"], "post"):
        return

    # Get sender name from members table, fall back to directory lookup
    member = mochi.db.row("select name from members where forum=? and id=?", forum["id"], sender_id)
    sender_name = member["name"] if member and member["name"] else ""
    if not sender_name:
        entity = mochi.directory.get(sender_id)
        sender_name = entity["name"] if entity and entity["name"] else "Anonymous"

    id = e.content("id")
    if not mochi.valid(id, "id"):
        return

    if mochi.db.exists("select id from posts where id=?", id):
        return  # Duplicate

    title = e.content("title")
    if not mochi.valid(title, "name"):
        return

    body = e.content("body")
    if not mochi.valid(body, "text"):
        return

    now = mochi.time.now()

    mochi.db.execute("replace into posts ( id, forum, member, name, title, body, created, updated ) values ( ?, ?, ?, ?, ?, ?, ?, ? )",
        id, forum["id"], sender_id, sender_name, title, body, now, now)

    mochi.db.execute("update forums set updated=? where id=?", now, forum["id"])
    # Attachments arrive via _attachment/create events and are saved automatically

    # Broadcast to all members except sender (attachments fetched on-demand)
    post_data = {
        "id": id,
        "member": sender_id,
        "name": sender_name,
        "title": title,
        "body": body,
        "created": now
    }

    broadcast_event(forum["id"], "post/create", post_data)

# Received a post edit request from member (we are forum owner)
def event_post_edit_submit_event(e):
    forum = get_forum(e.header("to"))
    if not forum:
        return

    sender_id = e.header("from")
    post_id = e.content("id")
    if not mochi.valid(post_id, "id"):
        return

    post = mochi.db.row("select * from posts where forum=? and id=?", forum["id"], post_id)
    if not post:
        return

    # Check authorization: must be post author
    if sender_id != post["member"]:
        return

    title = e.content("title")
    if not mochi.valid(title, "name"):
        return

    body = e.content("body")
    if not mochi.valid(body, "text"):
        return

    now = mochi.time.now()

    # Handle attachment changes
    order = e.content("order") or []
    members = [m["id"] for m in mochi.db.rows("select id from members where forum=?", forum["id"])]

    # Get current attachments and delete any not in the order list
    current_attachments = mochi.attachment.list(post_id)
    current_ids = [att["id"] for att in current_attachments]

    # Delete attachments not in order (those being removed)
    for att_id in current_ids:
        if att_id not in order:
            mochi.attachment.delete(att_id, members)

    # Reorder attachments according to order
    for i, att_id in enumerate(order):
        mochi.attachment.move(att_id, i + 1, members)

    # Update the post
    mochi.db.execute("update posts set title=?, body=?, updated=?, edited=? where id=?", title, body, now, now, post_id)
    mochi.db.execute("update forums set updated=? where id=?", now, forum["id"])

    # Broadcast update to all members
    post_data = {
        "id": post_id,
        "title": title,
        "body": body,
        "edited": now
    }
    broadcast_event(forum["id"], "post/edit", post_data)

# Received a post delete request from member (we are forum owner)
def event_post_delete_submit_event(e):
    forum = get_forum(e.header("to"))
    if not forum:
        return

    sender_id = e.header("from")
    post_id = e.content("id")
    if not mochi.valid(post_id, "id"):
        return

    post = mochi.db.row("select * from posts where forum=? and id=?", forum["id"], post_id)
    if not post:
        return

    # Check authorization: must be post author
    if sender_id != post["member"]:
        return

    # Delete all attachments for this post
    attachments = mochi.attachment.list(post_id)
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

    if not mochi.valid(title, "name"):
        return
    if not mochi.valid(body, "text"):
        return

    now = mochi.time.now()
    mochi.db.execute("update posts set title=?, body=?, updated=?, edited=? where id=?",
        title, body, now, edited, id)
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

    # Delete all attachments for this post
    attachments = mochi.attachment.list(id)
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

# Received a subscribe request from member (we are forum owner)
def event_subscribe_event(e):
    forum = get_forum(e.header("to"))
    if not forum:
        return

    member_id = e.header("from")
    name = e.content("name")

    if not mochi.valid(member_id, "entity"):
        return
    if not mochi.valid(name, "name"):
        return

    # Add as subscriber if not already a member
    if not mochi.db.exists("select id from members where forum=? and id=?", forum["id"], member_id):
        now = mochi.time.now()
        mochi.db.execute("replace into members ( forum, id, name, subscribed ) values ( ?, ?, ?, ? )",
            forum["id"], member_id, name, now)

        # Update member count
        members = mochi.db.rows("select id from members where forum=?", forum["id"])
        mochi.db.execute("update forums set members=?, updated=? where id=?", len(members), now, forum["id"])

        # Send recent posts to new member (attachments fetched on-demand)
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
                "created": p["created"]
            }
            mochi.message.send(
                {"from": forum["id"], "to": member_id, "service": "forums", "event": "post/create"},
                post_data
            )

            # Send comments for this post
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
                    "created": c["created"]
                }
                mochi.message.send(
                    {"from": forum["id"], "to": member_id, "service": "forums", "event": "comment/create"},
                    comment_data
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
    forum = get_forum(e.header("from"))
    if not forum:
        return

    members = e.content("members")
    if type(members) != "int" or members < 0:
        return

    mochi.db.execute("update forums set members=?, updated=? where id=?", members, mochi.time.now(), forum["id"])

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
            e.stream.write({"error": "Not authorized to view this forum"})
            return

    can_post = check_event_access(requester, forum_id, "post")

    # Get posts for this forum
    posts = mochi.db.rows("select * from posts where forum=? order by updated desc limit 100", forum_id)

    # Format posts with comments
    formatted_posts = []
    for post in posts:
        post_data = dict(post)
        post_data["created_local"] = mochi.time.local(post["created"])
        post_data["attachments"] = mochi.attachment.list(post["id"])
        post_data["comments"] = mochi.db.rows("select * from comments where forum=? and post=? order by created desc",
            forum_id, post["id"])
        formatted_posts.append(post_data)

    e.stream.write({
        "name": forum_name,
        "fingerprint": forum_fingerprint,
        "posts": formatted_posts,
        "can_post": can_post,
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
        result[op] = check_event_access(requester, forum_id, op)

    # DEBUG
    result["_debug"] = {"requester": requester, "operations": operations, "forum": forum_id}
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
            e.stream.write({"error": "Not authorized to view this forum"})
            return

    # Get post
    post = mochi.db.row("select * from posts where id=? and forum=?", post_id, forum_id)
    if not post:
        e.stream.write({"error": "Post not found"})
        return

    can_vote = check_event_access(requester, forum_id, "vote")
    can_comment = check_event_access(requester, forum_id, "comment")

    post_data = dict(post)
    post_data["created_local"] = mochi.time.local(post["created"])
    post_data["attachments"] = mochi.attachment.list(post_id)

    # Get requester's vote on the post
    post_vote = mochi.db.row("select vote from votes where post=? and comment='' and voter=?", post_id, requester)
    post_data["user_vote"] = post_vote["vote"] if post_vote else ""

    # Get comments recursively
    def get_comments(parent_id, depth):
        if depth > 100:
            return []

        comments = mochi.db.rows("select * from comments where forum=? and post=? and parent=? order by created desc",
            forum_id, post_id, parent_id)

        for c in comments:
            c["created_local"] = mochi.time.local(c["created"])
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
    })

# CROSS-APP PROXY ACTIONS

# Proxy user search to people app
def action_users_search(a):
    if not a.user:
        a.error(401, "Not logged in")
        return
    query = a.input("search", "")
    results = mochi.service.call("friends", "users/search", query)
    return {"data": {"results": results}}

# Proxy groups list to people app
def action_groups(a):
    if not a.user:
        a.error(401, "Not logged in")
        return
    groups = mochi.service.call("friends", "groups/list")
    return {"data": {"groups": groups}}
