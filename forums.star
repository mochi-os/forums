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

    mochi.db.execute("create table posts ( id text not null primary key, forum references forums( id ), member text not null, name text not null, title text not null, body text not null, comments integer not null default 0, up integer not null default 0, down integer not null default 0, created integer not null, updated integer not null )")
    mochi.db.execute("create index posts_forum on posts( forum )")
    mochi.db.execute("create index posts_created on posts( created )")
    mochi.db.execute("create index posts_updated on posts( updated )")

    mochi.db.execute("create table comments ( id text not null primary key, forum references forums( id ), post text not null, parent text not null, member text not null, name text not null, body text not null, up integer not null default 0, down integer not null default 0, created integer not null )")
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

        # Get posts for this forum
        posts = mochi.db.rows("select * from posts where forum=? order by updated desc", forum["id"])
        for p in posts:
            p["created_local"] = mochi.time.local(p["created"])
            p["attachments"] = mochi.attachment.list(p["id"])
            # Fetch attachments from forum owner if we don't have them locally
            if not p["attachments"] and not mochi.entity.get(forum["id"]):
                p["attachments"] = mochi.attachment.fetch(p["id"], forum["id"])
            # Get comment count for this post
            p["comments"] = mochi.db.rows("select * from comments where forum=? and post=? order by created desc",
                forum["id"], p["id"])

        # Add access flags to forum object
        forum["can_manage"] = check_access(a, forum["id"], "manage")
        forum["can_post"] = check_access(a, forum["id"], "post")

        return {
            "data": {
                "forum": forum,
                "posts": posts,
                "member": member,
                "can_manage": forum["can_manage"]
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
