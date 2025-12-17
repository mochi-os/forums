# Mochi Forums app
# Copyright Alistair Cunningham 2024-2025

# Forum roles: disabled=0, viewer=1, voter=2, commenter=3, poster=4, administrator=5
FORUM_ROLES = {
    "disabled": 0,
    "viewer": 1,
    "voter": 2,
    "commenter": 3,
    "poster": 4,
    "administrator": 5
}

# Create database
def database_create():
    mochi.db.execute("create table settings ( name text not null primary key, value text not null )")
    mochi.db.execute("replace into settings ( name, value ) values ( 'schema', 1 )")

    mochi.db.execute("create table forums ( id text not null primary key, fingerprint text not null, name text not null, role text not null default '', members integer not null default 0, updated integer not null )")
    mochi.db.execute("create index forums_fingerprint on forums( fingerprint )")
    mochi.db.execute("create index forums_name on forums( name )")
    mochi.db.execute("create index forums_updated on forums( updated )")

    mochi.db.execute("create table members ( forum references forums( id ), id text not null, name text not null default '', role text not null, primary key ( forum, id ) )")
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

# Helper: Get forum by ID or fingerprint
def get_forum(forum_id):
    forum = mochi.db.row("select * from forums where id=?", forum_id)
    if not forum:
        forum = mochi.db.row("select * from forums where fingerprint=?", forum_id)
    return forum

# Helper: Get forum member with role check
def get_member(forum_id, member_id, required_role):
    member = mochi.db.row("select * from members where forum=? and id=?", forum_id, member_id)
    if not member:
        return None
    if required_role and not check_role(member["role"], required_role):
        return None
    return member

# Helper: Check if member has required role
def check_role(member_role, required_role):
    if not required_role:
        return True
    member_level = FORUM_ROLES.get(member_role, 0)
    required_level = FORUM_ROLES.get(required_role, 0)
    return member_level >= required_level

# ACTIONS

# View a forum or list all forums
def action_view(a):
    forum_id = a.input("forum")
    
    if forum_id:
        forum = get_forum(forum_id)
        if not forum:
            a.error(404, "Forum not found")
            return
        
        # Check if user is member or if forum allows viewing
        member = None
        if a.user:
            member = mochi.db.row("select * from members where forum=? and id=?", forum["id"], a.user.identity.id)
        
        if not member and forum["role"] == "disabled":
            a.error(404, "Forum not found")
            return
        
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
        
        return {
            "data": {
                "forum": forum,
                "posts": posts,
                "member": member,
                "role_administrator": check_role(member["role"] if member else "", "administrator")
            }
        }
    else:
        # List all forums
        forums = mochi.db.rows("select * from forums order by updated desc")
        posts = mochi.db.rows("select * from posts order by updated desc")
        
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
    
    # Create entity for the forum
    entity_id = mochi.entity.create("forum", name, "public", "")
    if not entity_id:
        a.error(500, "Failed to create forum entity")
        return
    
    # Create forum record
    entity_fp = mochi.entity.fingerprint(entity_id)
    now = mochi.time.now()
    mochi.db.execute("replace into forums ( id, fingerprint, name, role, members, updated ) values ( ?, ?, ?, ?, ?, ? )",
        entity_id, entity_fp, name, "", 1, now)
    
    # Add creator as administrator
    mochi.db.execute("replace into members ( forum, id, name, role ) values ( ?, ?, ?, ? )",
        entity_id, a.user.identity.id, a.user.identity.name, "administrator")
    
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
    
    member = get_member(forum["id"], a.user.identity.id, "poster")
    if not member:
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

    # Get members for notification
    members = mochi.db.rows("select id from members where forum=? and role!='disabled' and id!=?", forum["id"], a.user.identity.id)

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

    for m in members:
        mochi.message.send(
            {"from": forum["id"], "to": m["id"], "service": "forums", "event": "post/create"},
            post_data
        )
    
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
    
    member = get_member(forum["id"], a.user.identity.id, "poster")
    if not member:
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
    
    member = get_member(forum["id"], a.user.identity.id, "administrator")
    if not member:
        a.error(403, "Not authorized")
        return
    
    members = mochi.db.rows("select * from members where forum=? order by name", forum["id"])
    
    return {
        "data": {
            "forum": forum,
            "members": members
        }
    }

# Save forum members
def action_members_save(a):
    if not a.user:
        a.error(401, "Not logged in")
        return
    
    forum = get_forum(a.input("forum"))
    if not forum:
        a.error(404, "Forum not found")
        return
    
    # Check if user is owner (has entity)
    entity = mochi.entity.get(forum["id"])
    if not entity:
        a.error(404, "Forum not found")
        return
    
    # Update member roles from form inputs (excluding current user)
    members = mochi.db.rows("select * from members where forum=? and id!=?", forum["id"], a.user.identity.id)
    for m in members:
        new_role = a.input("role_" + m["id"])
        if new_role and new_role != m["role"]:
            if new_role not in FORUM_ROLES:
                a.error(400, "Invalid role")
                return
            
            mochi.db.execute("update members set role=? where forum=? and id=?", new_role, forum["id"], m["id"])
            
            # Notify member of role change
            mochi.message.send(
                {"from": forum["id"], "to": m["id"], "service": "forums", "event": "member/update"},
                {"role": new_role},
                []
            )
            
            # If member was disabled and now has access, send recent posts
            # Attachments are fetched on-demand when viewing posts
            if m["role"] == "disabled" and new_role != "disabled":
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
                        {"from": forum["id"], "to": m["id"], "service": "forums", "event": "post/create"},
                        post_data
                    )
    
    # Broadcast updated member count to all members
    updated_members = mochi.db.rows("select * from members where forum=? and role!='disabled'", forum["id"])
    mochi.db.execute("update forums set members=?, updated=? where id=?", len(updated_members), mochi.time.now(), forum["id"])
    
    for m in updated_members:
        if m["id"] != a.user.identity.id:
            mochi.message.send(
                {"from": forum["id"], "to": m["id"], "service": "forums", "event": "update"},
                {"members": len(updated_members)},
                []
            )
    
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
    if mochi.db.exists("select id from forums where id=?", forum_id):
        return {
            "data": {"already_subscribed": True}
        }
    
    # Create local forum record
    now = mochi.time.now()
    mochi.db.execute("replace into forums ( id, fingerprint, name, role, members, updated ) values ( ?, ?, ?, ?, ?, ? )",
        forum_id, forum["fingerprint"], forum["name"], "viewer", 0, now)
    
    # Add self as member with viewer role
    mochi.db.execute("replace into members ( forum, id, name, role ) values ( ?, ?, ?, ? )",
        forum_id, a.user.identity.id, a.user.identity.name, "viewer")
    
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
    
    member = None
    if a.user:
        member = mochi.db.row("select * from members where forum=? and id=?", forum["id"], a.user.identity.id)
    
    # Get comments recursively
    def get_comments(parent_id, depth):
        if depth > 100:  # Prevent infinite recursion
            return []
        
        comments = mochi.db.rows("select * from comments where forum=? and post=? and parent=? order by created desc",
            forum["id"], post_id, parent_id)
        
        for c in comments:
            c["created_local"] = mochi.time.local(c["created"])
            c["children"] = get_comments(c["id"], depth + 1)
            c["role_voter"] = check_role(member["role"] if member else "", "voter")
            c["role_commenter"] = check_role(member["role"] if member else "", "commenter")
        
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
            "role_voter": check_role(member["role"] if member else "", "voter"),
            "role_commenter": check_role(member["role"] if member else "", "commenter")
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
    
    member = get_member(forum["id"], a.user.identity.id, "commenter")
    if not member:
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
    
    members = mochi.db.rows("select * from members where forum=? and role!='disabled'", forum["id"])
    for m in members:
        if m["id"] != a.user.identity.id:
            mochi.message.send(
                {"from": forum["id"], "to": m["id"], "service": "forums", "event": "comment/create"},
                comment_data,
                []
            )
    
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
    
    member = get_member(forum["id"], a.user.identity.id, "voter")
    if not member:
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
    members = mochi.db.rows("select * from members where forum=? and role!='disabled'", forum["id"])
    for m in members:
        if m["id"] != a.user.identity.id:
            mochi.message.send(
                {"from": forum["id"], "to": m["id"], "service": "forums", "event": "post/update"},
                {"id": post["id"], "up": updated_post["up"], "down": updated_post["down"]},
                []
            )
    
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
    
    member = get_member(forum["id"], a.user.identity.id, "voter")
    if not member:
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
    members = mochi.db.rows("select * from members where forum=? and role!='disabled'", forum["id"])
    for m in members:
        if m["id"] != a.user.identity.id:
            mochi.message.send(
                {"from": forum["id"], "to": m["id"], "service": "forums", "event": "comment/update"},
                {"id": comment["id"], "post": comment["post"], "up": updated_comment["up"], "down": updated_comment["down"]},
                []
            )
    
    return {
        "data": {"forum": forum["id"], "post": comment["post"]}
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
    
    member = get_member(forum["id"], e.content("from"), "commenter")
    if not member:
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
        id, forum["id"], post, parent, e.content("from"), member["name"], body, now)
    
    mochi.db.execute("update posts set updated=?, comments=comments+1 where id=?", now, post)
    mochi.db.execute("update forums set updated=? where id=?", now, forum["id"])
    
    # Broadcast to all members except sender
    comment_data = {
        "id": id,
        "post": post,
        "parent": parent,
        "member": e.content("from"),
        "name": member["name"],
        "body": body,
        "created": now
    }
    
    members = mochi.db.rows("select * from members where forum=? and role!='disabled'", forum["id"])
    for m in members:
        if m["id"] != e.content("from"):
            mochi.message.send(
                {"from": forum["id"], "to": m["id"], "service": "forums", "event": "comment/create"},
                comment_data,
                []
            )

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
    
    member = get_member(forum["id"], e.content("from"), "voter")
    if not member:
        return
    
    vote = vote_data.get("vote")
    if vote not in ["up", "down"]:
        return
    
    # Remove old vote if exists
    old_vote = mochi.db.row("select vote from votes where comment=? and voter=?", comment_id, e.content("from"))
    if old_vote:
        if old_vote["vote"] == "up":
            mochi.db.execute("update comments set up=up-1 where id=?", comment_id)
        elif old_vote["vote"] == "down":
            mochi.db.execute("update comments set down=down-1 where id=?", comment_id)
    
    # Add new vote
    mochi.db.execute("replace into votes ( forum, post, comment, voter, vote ) values ( ?, ?, ?, ?, ? )",
        forum["id"], comment["post"], comment_id, e.content("from"), vote)
    
    if vote == "up":
        mochi.db.execute("update comments set up=up+1 where id=?", comment_id)
    elif vote == "down":
        mochi.db.execute("update comments set down=down+1 where id=?", comment_id)
    
    now = mochi.time.now()
    mochi.db.execute("update posts set updated=? where id=?", now, comment["post"])
    mochi.db.execute("update forums set updated=? where id=?", now, forum["id"])
    
    # Broadcast update to all members except sender
    updated_comment = mochi.db.row("select up, down from comments where id=?", comment_id)
    members = mochi.db.rows("select * from members where forum=? and role!='disabled'", forum["id"])
    for m in members:
        if m["id"] != e.content("from"):
            mochi.message.send(
                {"from": forum["id"], "to": m["id"], "service": "forums", "event": "comment/update"},
                {"id": comment_id, "post": comment["post"], "up": updated_comment["up"], "down": updated_comment["down"]},
                []
            )

# Received a member role update from forum owner
def event_member_update_event(e):
    forum = get_forum(e.content("from"))
    if not forum:
        return
    
    role = e.content("role")
    if not role or role not in FORUM_ROLES:
        return
    
    mochi.db.execute("update members set role=? where forum=? and id=?", role, forum["id"], e.content("to"))

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
    
    member = get_member(forum["id"], e.content("from"), "poster")
    if not member:
        return
    
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
        id, forum["id"], e.content("from"), member["name"], title, body, now, now)

    mochi.db.execute("update forums set updated=? where id=?", now, forum["id"])
    # Attachments arrive via _attachment/create events and are saved automatically

    # Broadcast to all members except sender (attachments fetched on-demand)
    post_data = {
        "id": id,
        "member": e.content("from"),
        "name": member["name"],
        "title": title,
        "body": body,
        "created": now
    }

    members = mochi.db.rows("select id from members where forum=? and role!='disabled' and id!=?", forum["id"], e.content("from"))
    for m in members:
        mochi.message.send(
            {"from": forum["id"], "to": m["id"], "service": "forums", "event": "post/create"},
            post_data
        )

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
    
    member = get_member(forum["id"], e.content("from"), "voter")
    if not member:
        return
    
    vote = vote_data.get("vote")
    if vote not in ["up", "down"]:
        return
    
    # Remove old vote if exists
    old_vote = mochi.db.row("select vote from votes where post=? and comment='' and voter=?", post_id, e.content("from"))
    if old_vote:
        if old_vote["vote"] == "up":
            mochi.db.execute("update posts set up=up-1 where id=?", post_id)
        elif old_vote["vote"] == "down":
            mochi.db.execute("update posts set down=down-1 where id=?", post_id)
    
    # Add new vote
    mochi.db.execute("replace into votes ( forum, post, comment, voter, vote ) values ( ?, ?, '', ?, ? )",
        forum["id"], post_id, e.content("from"), vote)
    
    if vote == "up":
        mochi.db.execute("update posts set up=up+1 where id=?", post_id)
    elif vote == "down":
        mochi.db.execute("update posts set down=down+1 where id=?", post_id)
    
    now = mochi.time.now()
    mochi.db.execute("update posts set updated=? where id=?", now, post_id)
    mochi.db.execute("update forums set updated=? where id=?", now, forum["id"])
    
    # Broadcast update to all members except sender
    updated_post = mochi.db.row("select up, down from posts where id=?", post_id)
    members = mochi.db.rows("select * from members where forum=? and role!='disabled'", forum["id"])
    for m in members:
        if m["id"] != e.content("from"):
            mochi.message.send(
                {"from": forum["id"], "to": m["id"], "service": "forums", "event": "post/update"},
                {"id": post_id, "up": updated_post["up"], "down": updated_post["down"]},
                []
            )

# Received a subscribe request from member (we are forum owner)
def event_subscribe_event(e):
    forum = get_forum(e.content("to"))
    if not forum:
        return
    
    member_id = e.content("from")
    name = e.content("name")
    
    if not mochi.valid(member_id, "entity"):
        return
    if not mochi.valid(name, "name"):
        return
    
    # Add as viewer if not already a member
    if not mochi.db.exists("select id from members where forum=? and id=?", forum["id"], member_id):
        mochi.db.execute("replace into members ( forum, id, name, role ) values ( ?, ?, ?, ? )",
            forum["id"], member_id, name, "viewer")
        
        # Update member count
        members = mochi.db.rows("select * from members where forum=? and role!='disabled'", forum["id"])
        mochi.db.execute("update forums set members=?, updated=? where id=?", len(members), mochi.time.now(), forum["id"])
        
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
        for m in members:
            if m["id"] != member_id:
                mochi.message.send(
                    {"from": forum["id"], "to": m["id"], "service": "forums", "event": "update"},
                    {"members": len(members)},
                    []
                )

# Received an unsubscribe request from member (we are forum owner)
def event_unsubscribe_event(e):
    forum = get_forum(e.content("to"))
    if not forum:
        return
    
    member_id = e.content("from")
    
    mochi.db.execute("delete from members where forum=? and id=?", forum["id"], member_id)
    
    # Update member count and notify remaining members
    members = mochi.db.rows("select * from members where forum=? and role!='disabled'", forum["id"])
    mochi.db.execute("update forums set members=?, updated=? where id=?", len(members), mochi.time.now(), forum["id"])
    
    for m in members:
        mochi.message.send(
            {"from": forum["id"], "to": m["id"], "service": "forums", "event": "update"},
            {"members": len(members)},
            []
        )

# Received a forum update from forum owner
def event_update_event(e):
    forum = get_forum(e.content("from"))
    if not forum:
        return
    
    members = e.content("members")
    if type(members) != "int" or members < 0:
        return

    mochi.db.execute("update forums set members=?, updated=? where id=?", members, mochi.time.now(), forum["id"])
