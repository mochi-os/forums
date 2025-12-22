# Mochi Forums app
# Copyright Alistair Cunningham 2024-2025

# Access level hierarchy: post > comment > vote > view
# Each level grants access to that operation and all operations below it.
# "manage" is separate and grants all permissions (owner/admin only).
# "none" means no access (user has no rules or explicit deny).
ACCESS_LEVELS = ["view", "vote", "comment", "post"]

# Map old role names to new access levels for migration
ROLE_TO_ACCESS = {
    "disabled": None,  # No access
    "viewer": "view",
    "voter": "vote",
    "commenter": "comment",
    "poster": "post",
    "administrator": "manage"
}

# Create database
def database_create():
    mochi.db.execute("create table settings ( name text not null primary key, value text not null )")

    mochi.db.execute("create table forums ( id text not null primary key, fingerprint text not null, name text not null, access text not null default 'view', members integer not null default 0, updated integer not null )")
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
                if access_level:
                    mochi.access.grant(member_id, resource, access_level)

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

# Helper: Get forum by ID or fingerprint
def get_forum(forum_id):
    forum = mochi.db.row("select * from forums where id=?", forum_id)
    if not forum:
        forum = mochi.db.row("select * from forums where fingerprint=?", forum_id)
    return forum

# Helper: Check if current user has access to perform an operation
# Uses hierarchical access levels: post grants comment+vote+view, etc.
# Users with "manage" or "*" permission automatically have all permissions.
def check_access(a, forum_id, operation):
    resource = "forum/" + forum_id
    user = None
    if a.user and a.user.identity:
        user = a.user.identity.id

    # Owner has full access (mochi.entity.get returns entity only if current user owns it)
    if mochi.entity.get(forum_id):
        return True

    # Manage or wildcard grants full access
    if mochi.access.check(user, resource, "manage") or mochi.access.check(user, resource, "*"):
        return True

    # For hierarchical levels, check if user has the required level or higher
    # ACCESS_LEVELS is ordered lowest to highest: ["view", "vote", "comment", "post"]
    if operation in ACCESS_LEVELS:
        op_index = ACCESS_LEVELS.index(operation)
        for level in ACCESS_LEVELS[op_index:]:
            if mochi.access.check(user, resource, level):
                return True

    # For view operation, also check if user is a subscriber
    if operation == "view" and user:
        if mochi.db.exists("select 1 from members where forum=? and id=?", forum_id, user):
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

    # Manage or wildcard grants full access
    if mochi.access.check(user_id, resource, "manage") or mochi.access.check(user_id, resource, "*"):
        return True

    # For hierarchical levels, check if user has the required level or higher
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

    if forum_id:
        forum = get_forum(forum_id)
        if not forum:
            a.error(404, "Forum not found")
            return

        # Check if user can view this forum
        if not check_access(a, forum["id"], "view"):
            a.error(404, "Forum not found")
            return

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

        # Add access flags to forum object
        forum["can_manage"] = check_access(a, forum["id"], "manage")
        forum["can_post"] = check_access(a, forum["id"], "post")

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
        for f in forums:
            f["can_manage"] = check_access(a, f["id"], "manage")
            f["can_post"] = check_access(a, f["id"], "post")

        for p in posts:
            p["created_local"] = mochi.time.local(p["created"])
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

    # Default access level for new subscribers (must be valid)
    access = a.input("access")
    if not access or access not in ACCESS_LEVELS:
        access = "view"

    # Create entity for the forum
    entity_id = mochi.entity.create("forum", name, "public", "")
    if not entity_id:
        a.error(500, "Failed to create forum entity")
        return

    # Create forum record with default access level for new subscribers
    entity_fp = mochi.entity.fingerprint(entity_id)
    now = mochi.time.now()
    mochi.db.execute("replace into forums ( id, fingerprint, name, access, members, updated ) values ( ?, ?, ?, ?, ?, ? )",
        entity_id, entity_fp, name, access, 1, now)

    # Add creator as subscriber (they have implicit manage access as entity owner)
    mochi.db.execute("replace into members ( forum, id, name, subscribed ) values ( ?, ?, ?, ? )",
        entity_id, a.user.identity.id, a.user.identity.name, now)

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

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error(404, "Forum not found")
        return

    if not check_access(a, forum["id"], "post"):
        a.error(403, "Not authorized to post")
        return

    title = a.input("title")
    if not mochi.valid(title, "name"):
        a.error(400, "Invalid title")
        return

    body = a.input("body")
    if not mochi.valid(body, "text"):
        a.error(400, "Invalid body")
        return

    id = mochi.uid()
    now = mochi.time.now()

    mochi.db.execute("replace into posts ( id, forum, member, name, title, body, created, updated ) values ( ?, ?, ?, ?, ?, ?, ?, ? )",
        id, forum["id"], a.user.identity.id, a.user.identity.name, title, body, now, now)

    mochi.db.execute("update forums set updated=? where id=?", now, forum["id"])

    # Get members for notification (excluding sender)
    members = mochi.db.rows("select id from members where forum=? and id!=?", forum["id"], a.user.identity.id)

    # Save any uploaded attachments and notify members via _attachment/create events
    attachments = mochi.attachment.save(id, "attachments", [], [], members)

    # Broadcast post to members (attachments sent separately via federation)
    post_data = {
        "id": id,
        "member": a.user.identity.id,
        "name": a.user.identity.name,
        "title": title,
        "body": body,
        "created": now
    }

    broadcast_event(forum["id"], "post/create", post_data, a.user.identity.id)

    return {
        "data": {"forum": forum["id"], "post": id}
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

# Search forums
def action_search(a):
    search = a.input("search")
    results = []
    if search:
        results = mochi.directory.search("forum", search, True)
    return {
        "data": {"results": results}
    }

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

    # Create local forum record with default access level
    now = mochi.time.now()
    mochi.db.execute("replace into forums ( id, fingerprint, name, access, members, updated ) values ( ?, ?, ?, ?, ?, ? )",
        forum_id, forum["fingerprint"], forum["name"], "view", 0, now)

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

# View a post with comments
def action_post_view(a):
    post_id = a.input("post")
    post = mochi.db.row("select * from posts where id=?", post_id)
    if not post:
        a.error(404, "Post not found")
        return

    forum = get_forum(post["forum"])
    if not forum:
        a.error(404, "Forum not found")
        return

    # Check view access
    if not check_access(a, forum["id"], "view"):
        a.error(404, "Forum not found")
        return

    member = None
    if a.user:
        member = mochi.db.row("select * from members where forum=? and id=?", forum["id"], a.user.identity.id)

    # Check access levels for UI permissions
    can_vote = check_access(a, forum["id"], "vote")
    can_comment = check_access(a, forum["id"], "comment")

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

        return comments

    post["created_local"] = mochi.time.local(post["created"])
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

    post_id = a.input("post")
    post = mochi.db.row("select * from posts where id=?", post_id)
    if not post:
        a.error(404, "Post not found")
        return

    forum = get_forum(post["forum"])
    if not forum:
        a.error(404, "Forum not found")
        return

    # Check authorization: post author or forum manager
    is_author = a.user.identity.id == post["member"]
    is_manager = check_access(a, forum["id"], "manage")
    if not is_author and not is_manager:
        a.error(403, "Not authorized to edit this post")
        return

    title = a.input("title")
    if not mochi.valid(title, "name"):
        a.error(400, "Invalid title")
        return

    body = a.input("body")
    if not mochi.valid(body, "text"):
        a.error(400, "Invalid body")
        return

    now = mochi.time.now()

    # Handle attachment changes
    # order_json is a JSON array of attachment IDs (existing) and "new:N" placeholders
    order_json = a.input("order")
    if order_json:
        order = json.decode(order_json)
    else:
        order = []

    # Get current attachments to determine which to delete
    current_attachments = mochi.attachment.list(post_id)
    current_ids = [att["id"] for att in current_attachments]

    # Get members for attachment notifications
    members = [m["id"] for m in mochi.db.rows("select id from members where forum=?", forum["id"])]

    # Save new attachments first (if any files were uploaded)
    new_attachments = mochi.attachment.save(post_id, "attachments", [], [], members)

    # Build final order by replacing "new:N" placeholders with actual IDs
    final_order = []
    for item in order:
        if item.startswith("new:"):
            idx = int(item[4:])
            if idx < len(new_attachments):
                final_order.append(new_attachments[idx]["id"])
        else:
            final_order.append(item)

    if final_order:
        # Delete attachments not in the final order
        for att_id in current_ids:
            if att_id not in final_order:
                mochi.attachment.delete(att_id, members)

        # Reorder all attachments according to final order (positions start at 1)
        for i, att_id in enumerate(final_order):
            mochi.attachment.move(att_id, i + 1, members)
    else:
        # No attachments in order - delete all existing
        for att_id in current_ids:
            mochi.attachment.delete(att_id, members)

    # Update the post
    mochi.db.execute("update posts set title=?, body=?, updated=?, edited=? where id=?",
        title, body, now, now, post_id)

    mochi.db.execute("update forums set updated=? where id=?", now, forum["id"])

    # Broadcast update to members
    post_data = {
        "id": post_id,
        "title": title,
        "body": body,
        "edited": now
    }
    broadcast_event(forum["id"], "post/edit", post_data, a.user.identity.id)

    return {
        "data": {"forum": forum["id"], "post": post_id}
    }

# Delete a post
def action_post_delete(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    post_id = a.input("post")
    post = mochi.db.row("select * from posts where id=?", post_id)
    if not post:
        a.error(404, "Post not found")
        return

    forum = get_forum(post["forum"])
    if not forum:
        a.error(404, "Forum not found")
        return

    # Check authorization: post author or forum manager
    is_author = a.user.identity.id == post["member"]
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
    broadcast_event(forum["id"], "post/delete", {"id": post_id}, a.user.identity.id)

    return {
        "data": {"forum": forum["id"]}
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

    forum = get_forum(a.input("forum"))
    if not forum:
        a.error(404, "Forum not found")
        return

    if not check_access(a, forum["id"], "comment"):
        a.error(403, "Not authorized to comment")
        return

    post_id = a.input("post")
    if not mochi.db.exists("select id from posts where id=? and forum=?", post_id, forum["id"]):
        a.error(404, "Post not found")
        return

    parent_id = a.input("parent")
    if parent_id and not mochi.db.exists("select id from comments where id=? and post=?", parent_id, post_id):
        a.error(404, "Parent comment not found")
        return

    body = a.input("body")
    if not mochi.valid(body, "text"):
        a.error(400, "Invalid body")
        return

    id = mochi.uid()
    now = mochi.time.now()

    mochi.db.execute("replace into comments ( id, forum, post, parent, member, name, body, created ) values ( ?, ?, ?, ?, ?, ?, ?, ? )",
        id, forum["id"], post_id, parent_id or "", a.user.identity.id, a.user.identity.name, body, now)

    mochi.db.execute("update posts set updated=?, comments=comments+1 where id=?", now, post_id)
    mochi.db.execute("update forums set updated=? where id=?", now, forum["id"])

    # Broadcast to members
    comment_data = {
        "id": id,
        "post": post_id,
        "parent": parent_id or "",
        "member": a.user.identity.id,
        "name": a.user.identity.name,
        "body": body,
        "created": now
    }

    broadcast_event(forum["id"], "comment/create", comment_data, a.user.identity.id)

    return {
        "data": {"forum": forum["id"], "post": post_id, "comment": id}
    }

# Edit a comment
def action_comment_edit(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    comment_id = a.input("comment")
    comment = mochi.db.row("select * from comments where id=?", comment_id)
    if not comment:
        a.error(404, "Comment not found")
        return

    forum = get_forum(comment["forum"])
    if not forum:
        a.error(404, "Forum not found")
        return

    # Check authorization: comment author or forum manager
    is_author = a.user.identity.id == comment["member"]
    is_manager = check_access(a, forum["id"], "manage")
    if not is_author and not is_manager:
        a.error(403, "Not authorized to edit this comment")
        return

    body = a.input("body")
    if not mochi.valid(body, "text"):
        a.error(400, "Invalid body")
        return

    now = mochi.time.now()

    # Update the comment
    mochi.db.execute("update comments set body=?, edited=? where id=?", body, now, comment_id)
    mochi.db.execute("update posts set updated=? where id=?", now, comment["post"])
    mochi.db.execute("update forums set updated=? where id=?", now, forum["id"])

    # Broadcast update to members
    comment_data = {
        "id": comment_id,
        "post": comment["post"],
        "body": body,
        "edited": now
    }
    broadcast_event(forum["id"], "comment/edit", comment_data, a.user.identity.id)

    return {
        "data": {"forum": forum["id"], "post": comment["post"], "comment": comment_id}
    }

# Delete a comment (and all children)
def action_comment_delete(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    comment_id = a.input("comment")
    comment = mochi.db.row("select * from comments where id=?", comment_id)
    if not comment:
        a.error(404, "Comment not found")
        return

    forum = get_forum(comment["forum"])
    if not forum:
        a.error(404, "Forum not found")
        return

    # Check authorization: comment author or forum manager
    is_author = a.user.identity.id == comment["member"]
    is_manager = check_access(a, forum["id"], "manage")
    if not is_author and not is_manager:
        a.error(403, "Not authorized to delete this comment")
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

    # Delete votes for all affected comments
    for cid in comment_ids:
        mochi.db.execute("delete from votes where comment=?", cid)

    # Delete all affected comments
    for cid in comment_ids:
        mochi.db.execute("delete from comments where id=?", cid)

    now = mochi.time.now()

    # Update comment count on post
    mochi.db.execute("update posts set updated=?, comments=comments-? where id=?",
        now, deleted_count, comment["post"])
    mochi.db.execute("update forums set updated=? where id=?", now, forum["id"])

    # Broadcast delete to members (include all deleted IDs)
    broadcast_event(forum["id"], "comment/delete",
        {"ids": comment_ids, "post": comment["post"]}, a.user.identity.id)

    return {
        "data": {"forum": forum["id"], "post": comment["post"]}
    }

# Vote on a post
def action_post_vote(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    post = mochi.db.row("select * from posts where id=?", a.input("post"))
    if not post:
        a.error(404, "Post not found")
        return

    forum = get_forum(post["forum"])
    if not forum:
        a.error(404, "Forum not found")
        return

    if not check_access(a, forum["id"], "vote"):
        a.error(403, "Not authorized to vote")
        return

    vote = a.input("vote")
    if vote not in ["up", "down"]:
        a.error(400, "Invalid vote")
        return

    # Remove old vote if exists
    old_vote = mochi.db.row("select vote from votes where post=? and comment='' and voter=?", post["id"], a.user.identity.id)
    if old_vote:
        if old_vote["vote"] == "up":
            mochi.db.execute("update posts set up=up-1 where id=?", post["id"])
        elif old_vote["vote"] == "down":
            mochi.db.execute("update posts set down=down-1 where id=?", post["id"])
    
    # Add new vote
    mochi.db.execute("replace into votes ( forum, post, comment, voter, vote ) values ( ?, ?, '', ?, ? )",
        forum["id"], post["id"], a.user.identity.id, vote)

    if vote == "up":
        mochi.db.execute("update posts set up=up+1 where id=?", post["id"])
    elif vote == "down":
        mochi.db.execute("update posts set down=down+1 where id=?", post["id"])

    now = mochi.time.now()
    mochi.db.execute("update posts set updated=? where id=?", now, post["id"])
    mochi.db.execute("update forums set updated=? where id=?", now, forum["id"])

    # Broadcast update
    updated_post = mochi.db.row("select up, down from posts where id=?", post["id"])
    broadcast_event(forum["id"], "post/update",
        {"id": post["id"], "up": updated_post["up"], "down": updated_post["down"]},
        a.user.identity.id)

    return {
        "data": {"forum": forum["id"], "post": post["id"]}
    }

# Vote on a comment
def action_comment_vote(a):
    if not a.user:
        a.error(401, "Not logged in")
        return

    comment = mochi.db.row("select * from comments where id=?", a.input("comment"))
    if not comment:
        a.error(404, "Comment not found")
        return

    forum = get_forum(comment["forum"])
    if not forum:
        a.error(404, "Forum not found")
        return

    if not check_access(a, forum["id"], "vote"):
        a.error(403, "Not authorized to vote")
        return

    vote = a.input("vote")
    if vote not in ["up", "down"]:
        a.error(400, "Invalid vote")
        return

    # Remove old vote if exists
    old_vote = mochi.db.row("select vote from votes where comment=? and voter=?", comment["id"], a.user.identity.id)
    if old_vote:
        if old_vote["vote"] == "up":
            mochi.db.execute("update comments set up=up-1 where id=?", comment["id"])
        elif old_vote["vote"] == "down":
            mochi.db.execute("update comments set down=down-1 where id=?", comment["id"])

    # Add new vote
    mochi.db.execute("replace into votes ( forum, post, comment, voter, vote ) values ( ?, ?, ?, ?, ? )",
        forum["id"], comment["post"], comment["id"], a.user.identity.id, vote)

    if vote == "up":
        mochi.db.execute("update comments set up=up+1 where id=?", comment["id"])
    elif vote == "down":
        mochi.db.execute("update comments set down=down+1 where id=?", comment["id"])

    now = mochi.time.now()
    mochi.db.execute("update posts set updated=? where id=?", now, comment["post"])
    mochi.db.execute("update forums set updated=? where id=?", now, forum["id"])

    # Broadcast update
    updated_comment = mochi.db.row("select up, down from comments where id=?", comment["id"])
    broadcast_event(forum["id"], "comment/update",
        {"id": comment["id"], "post": comment["post"], "up": updated_comment["up"], "down": updated_comment["down"]},
        a.user.identity.id)

    return {
        "data": {"forum": forum["id"], "post": comment["post"]}
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

    # Check directory for the forum if not local
    if not forum:
        directory = mochi.directory.get(forum_id)
        if not directory:
            a.error(404, "Forum not found")
            return

    # Create stream to forum owner and request attachment
    s = mochi.stream(
        {"from": user_id, "to": forum_id, "service": "forums", "event": "attachment/view"},
        {}
    )

    # Write the attachment request
    s.write({"attachment": attachment_id})

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

    # Check directory for the forum if not local
    if not forum:
        directory = mochi.directory.get(forum_id)
        if not directory:
            a.error(404, "Forum not found")
            return

    # Create stream to forum owner and request thumbnail
    s = mochi.stream(
        {"from": user_id, "to": forum_id, "service": "forums", "event": "attachment/view"},
        {}
    )

    # Write the attachment request with thumbnail flag
    s.write({"attachment": attachment_id, "thumbnail": True})

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

    resource = "forum/" + forum["id"]

    # Build access list with current levels for each member
    members = mochi.db.rows("select id, name from members where forum=?", forum["id"])
    access_list = []

    for m in members:
        # Determine current access level
        current_level = None
        for op in ACCESS_LEVELS + ["*"]:
            if mochi.access.check(m["id"], resource, op):
                current_level = op
                break
        if mochi.access.check(m["id"], resource, "manage"):
            current_level = "manage"

        access_list.append({
            "id": m["id"],
            "name": m["name"],
            "level": current_level
        })

    return {
        "data": {
            "forum": forum,
            "access": access_list,
            "levels": ACCESS_LEVELS + ["manage"]
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
    if not mochi.valid(target, "entity"):
        a.error(400, "Invalid target")
        return

    level = a.input("level")
    if level not in ACCESS_LEVELS + ["manage"]:
        a.error(400, "Invalid access level")
        return

    resource = "forum/" + forum["id"]

    # Revoke all existing access levels first
    for op in ACCESS_LEVELS + ["manage", "*"]:
        mochi.access.revoke(target, resource, op)

    # Grant the new level
    mochi.access.grant(target, resource, level)

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
    if not mochi.valid(target, "entity"):
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

    # Check access for the requester
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
    forum = get_forum(e.content("from"))
    if not forum:
        return
    
    comment = mochi.event.segment()
    if not comment:
        return
    
    id = comment.get("id")
    if not mochi.valid(id, "id"):
        return
    
    if mochi.db.exists("select id from comments where id=?", id):
        return  # Duplicate
    
    post = comment.get("post")
    parent = comment.get("parent", "")
    member = comment.get("member")
    name = comment.get("name")
    body = comment.get("body")
    created = comment.get("created")
    
    if not mochi.valid(member, "entity"):
        return
    if not mochi.valid(name, "name"):
        return
    if not mochi.valid(body, "text"):
        return
    
    mochi.db.execute("replace into comments ( id, forum, post, parent, member, name, body, created ) values ( ?, ?, ?, ?, ?, ?, ?, ? )",
        id, forum["id"], post, parent, member, name, body, created)
    
    mochi.db.execute("update posts set updated=?, comments=comments+1 where id=?", created, post)
    mochi.db.execute("update forums set updated=? where id=?", created, forum["id"])

# Received a comment submission from member (we are forum owner)
def event_comment_submit_event(e):
    forum = get_forum(e.content("to"))
    if not forum:
        return

    sender_id = e.content("from")
    if not check_event_access(sender_id, forum["id"], "comment"):
        return

    # Get sender name from members table
    member = mochi.db.row("select name from members where forum=? and id=?", forum["id"], sender_id)
    sender_name = member["name"] if member else ""

    comment = mochi.event.segment()
    if not comment:
        return

    id = comment.get("id")
    if not mochi.valid(id, "id"):
        return

    if mochi.db.exists("select id from comments where id=?", id):
        return  # Duplicate

    post = comment.get("post")
    if not mochi.db.exists("select id from posts where forum=? and id=?", forum["id"], post):
        return

    parent = comment.get("parent", "")
    if parent and not mochi.db.exists("select id from comments where forum=? and post=? and id=?", forum["id"], post, parent):
        return

    body = comment.get("body")
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

    broadcast_event(forum["id"], "comment/create", comment_data, sender_id)

# Received a comment update from forum owner
def event_comment_update_event(e):
    comment = mochi.event.segment()
    if not comment:
        return

    id = comment.get("id")
    old_comment = mochi.db.row("select * from comments where forum=? and id=?", e.content("from"), id)
    if not old_comment:
        return

    now = mochi.time.now()
    mochi.db.execute("update comments set up=?, down=? where id=?", comment.get("up", 0), comment.get("down", 0), id)
    mochi.db.execute("update posts set updated=? where id=?", now, old_comment["post"])
    mochi.db.execute("update forums set updated=? where id=?", now, old_comment["forum"])

# Received a comment edit from forum owner
def event_comment_edit_event(e):
    comment = mochi.event.segment()
    if not comment:
        return

    id = comment.get("id")
    old_comment = mochi.db.row("select * from comments where forum=? and id=?", e.content("from"), id)
    if not old_comment:
        return

    body = comment.get("body")
    edited = comment.get("edited")

    if not mochi.valid(body, "text"):
        return

    now = mochi.time.now()
    mochi.db.execute("update comments set body=?, edited=? where id=?", body, edited, id)
    mochi.db.execute("update posts set updated=? where id=?", now, old_comment["post"])
    mochi.db.execute("update forums set updated=? where id=?", now, old_comment["forum"])

# Received a comment delete from forum owner
def event_comment_delete_event(e):
    data = mochi.event.segment()
    if not data:
        return

    forum_id = e.content("from")
    forum = get_forum(forum_id)
    if not forum:
        return

    # Get the list of comment IDs to delete
    comment_ids = data.get("ids", [])
    post_id = data.get("post")

    if not comment_ids or not post_id:
        return

    deleted_count = 0
    for comment_id in comment_ids:
        # Verify this comment belongs to this forum
        if mochi.db.exists("select id from comments where id=? and forum=?", comment_id, forum_id):
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
    vote_data = mochi.event.segment()
    if not vote_data:
        return

    comment_id = vote_data.get("comment")
    comment = mochi.db.row("select * from comments where id=?", comment_id)
    if not comment:
        return

    forum = get_forum(comment["forum"])
    if not forum:
        return

    sender_id = e.content("from")
    if not check_event_access(sender_id, forum["id"], "vote"):
        return

    vote = vote_data.get("vote")
    if vote not in ["up", "down"]:
        return

    # Remove old vote if exists
    old_vote = mochi.db.row("select vote from votes where comment=? and voter=?", comment_id, sender_id)
    if old_vote:
        if old_vote["vote"] == "up":
            mochi.db.execute("update comments set up=up-1 where id=?", comment_id)
        elif old_vote["vote"] == "down":
            mochi.db.execute("update comments set down=down-1 where id=?", comment_id)

    # Add new vote
    mochi.db.execute("replace into votes ( forum, post, comment, voter, vote ) values ( ?, ?, ?, ?, ? )",
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
    forum = get_forum(e.content("from"))
    if not forum:
        return

    # Access is now managed via mochi.access, so this event is a no-op for subscribers.
    # The forum owner grants/revokes access directly via mochi.access API.
    # This event could be used for notifications in the future.

# Received a post from forum owner
def event_post_create_event(e):
    forum = get_forum(e.content("from"))
    if not forum:
        return
    
    post = mochi.event.segment()
    if not post:
        return
    
    id = post.get("id")
    if not mochi.valid(id, "id"):
        return
    
    if mochi.db.exists("select id from posts where id=?", id):
        return  # Duplicate
    
    member = post.get("member")
    name = post.get("name")
    title = post.get("title")
    body = post.get("body")
    created = post.get("created")
    
    if not mochi.valid(member, "entity"):
        return
    if not mochi.valid(name, "name"):
        return
    if not mochi.valid(title, "name"):
        return
    if not mochi.valid(body, "text"):
        return
    
    mochi.db.execute("replace into posts ( id, forum, member, name, title, body, created, updated ) values ( ?, ?, ?, ?, ?, ?, ?, ? )",
        id, forum["id"], member, name, title, body, created, created)

    mochi.db.execute("update forums set updated=? where id=?", created, forum["id"])
    # Attachments arrive via _attachment/create events and are saved automatically

# Received a post submission from member (we are forum owner)
def event_post_submit_event(e):
    forum = get_forum(e.content("to"))
    if not forum:
        return

    sender_id = e.content("from")
    if not check_event_access(sender_id, forum["id"], "post"):
        return

    # Get sender name from members table
    member = mochi.db.row("select name from members where forum=? and id=?", forum["id"], sender_id)
    sender_name = member["name"] if member else ""

    post = mochi.event.segment()
    if not post:
        return

    id = post.get("id")
    if not mochi.valid(id, "id"):
        return

    if mochi.db.exists("select id from posts where id=?", id):
        return  # Duplicate

    title = post.get("title")
    if not mochi.valid(title, "name"):
        return

    body = post.get("body")
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

    broadcast_event(forum["id"], "post/create", post_data, sender_id)

# Received a post update from forum owner
def event_post_update_event(e):
    post = mochi.event.segment()
    if not post:
        return

    id = post.get("id")
    old_post = mochi.db.row("select * from posts where forum=? and id=?", e.content("from"), id)
    if not old_post:
        return

    now = mochi.time.now()
    mochi.db.execute("update posts set up=?, down=? where id=?", post.get("up", 0), post.get("down", 0), id)
    mochi.db.execute("update posts set updated=? where id=?", now, id)
    mochi.db.execute("update forums set updated=? where id=?", now, old_post["forum"])

# Received a post edit from forum owner
def event_post_edit_event(e):
    post = mochi.event.segment()
    if not post:
        return

    id = post.get("id")
    old_post = mochi.db.row("select * from posts where forum=? and id=?", e.content("from"), id)
    if not old_post:
        return

    title = post.get("title")
    body = post.get("body")
    edited = post.get("edited")

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
    post = mochi.event.segment()
    if not post:
        return

    id = post.get("id")
    old_post = mochi.db.row("select * from posts where forum=? and id=?", e.content("from"), id)
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
    vote_data = mochi.event.segment()
    if not vote_data:
        return

    post_id = vote_data.get("post")
    post = mochi.db.row("select * from posts where id=?", post_id)
    if not post:
        return

    forum = get_forum(post["forum"])
    if not forum:
        return

    sender_id = e.content("from")
    if not check_event_access(sender_id, forum["id"], "vote"):
        return

    vote = vote_data.get("vote")
    if vote not in ["up", "down"]:
        return

    # Remove old vote if exists
    old_vote = mochi.db.row("select vote from votes where post=? and comment='' and voter=?", post_id, sender_id)
    if old_vote:
        if old_vote["vote"] == "up":
            mochi.db.execute("update posts set up=up-1 where id=?", post_id)
        elif old_vote["vote"] == "down":
            mochi.db.execute("update posts set down=down-1 where id=?", post_id)

    # Add new vote
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

        # Grant default access level based on forum settings
        resource = "forum/" + forum["id"]
        default_access = forum.get("access", "view")
        if default_access and default_access in ACCESS_LEVELS:
            mochi.access.grant(member_id, resource, default_access)

        # Update member count
        members = mochi.db.rows("select id from members where forum=?", forum["id"])
        mochi.db.execute("update forums set members=?, updated=? where id=?", len(members), now, forum["id"])

        # Send recent posts to new member (attachments fetched on-demand)
        posts = mochi.db.rows("select * from posts where forum=? order by created desc limit 20", forum["id"])
        for p in posts:
            post_data = {
                "id": p["id"],
                "member": p["member"],
                "name": p["name"],
                "title": p["title"],
                "body": p["body"],
                "created": p["created"]
            }
            mochi.message.send(
                {"from": forum["id"], "to": member_id, "service": "forums", "event": "post/create"},
                post_data
            )

        # Notify all members of new subscription
        broadcast_event(forum["id"], "update", {"members": len(members)}, member_id)

# Received an unsubscribe request from member (we are forum owner)
def event_unsubscribe_event(e):
    forum = get_forum(e.header("to"))
    if not forum:
        return

    member_id = e.header("from")

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
    forum = get_forum(e.content("from"))
    if not forum:
        return
    
    members = e.content("members")
    if type(members) != "int" or members < 0:
        return

    mochi.db.execute("update forums set members=?, updated=? where id=?", members, mochi.time.now(), forum["id"])

# CROSS-APP PROXY ACTIONS

# Proxy user search to people app
def action_users_search(a):
    if not a.user:
        a.error(401, "Not logged in")
        return
    query = a.input("query", "")
    results = mochi.service.call("people", "users/search", query)
    return {"data": {"results": results}}

# Proxy groups list to people app
def action_groups(a):
    if not a.user:
        a.error(401, "Not logged in")
        return
    groups = mochi.service.call("people", "groups/list")
    return {"data": {"groups": groups}}
