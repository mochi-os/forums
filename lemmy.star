# Copyright © 2026 Mochisoft OÜ
# SPDX-License-Identifier: AGPL-3.0-only
# This file is part of Mochi, licensed under the GNU AGPL v3 with the
# Mochi Application Interface Exception - see license.txt and license-exception.md.

# Lemmy apps (the federation plan, phase 28): what core's Lemmy interface
# asks of the forums a hosted fediverse account takes part in - communities,
# posts, comments, votes, saved posts, reports and moderation - through the
# helpers the forums actions use. The Local and All listings are the forums
# the user holds (decision 6). Core numbers every item for the apps; these
# functions deal in forums' own ids.

LEMMY_SORTS = {"Hot": "hot", "Active": "active", "Scaled": "scaled", "New": "new", "Old": "old", "MostComments": "comments", "NewComments": "active", "Controversial": "controversial"}

def lemmy_identity():
    """The user's person entity, as the functions act for it."""
    for e in mochi.entity.owned() or []:
        if e.get("class") == "person":
            return {"id": e["id"], "name": e.get("name", "")}
    return None

def lemmy_hosted(account):
    """The hosted fediverse account a function names, or None."""
    for acc in hosted_accounts():
        if acc["id"] == account and acc.get("kind") != "group":
            return acc
    return None

def lemmy_failure(failure):
    """A helper's refusal as the interface answers it: its label's words."""
    if len(failure) > 2:
        return {"error": mochi.app.label(failure[1], **failure[2])}
    return {"error": mochi.app.label(failure[1])}

def lemmy_slug(text):
    """A name as Lemmy writes one: lower case letters, digits and underscores."""
    out = []
    for c in str(text or "").lower().elems():
        out.append(c if c.isalnum() else "_")
    slug = "".join(out).strip("_")
    return slug or "forum"

def lemmy_sort(sort):
    if sort.startswith("Top"):
        return "top"
    return LEMMY_SORTS.get(sort, "active")

# --- People ---

def lemmy_member(forum_id, member, name, me):
    """Someone in a forum as the interface takes them: a Mochi person by
    their entity, or a person on another server by their id there."""
    remote = member.startswith("https://") or member.startswith("http://")
    person = {"id": member, "display": name or "", "name": lemmy_slug(name), "url": member if remote else "", "local": not remote, "mine": member == me, "moderator": False, "banned": False}
    if forum_id and not remote:
        row = mochi.db.row("select address from addresses where forum=? and member=?", forum_id, member)
        if row and row.get("address"):
            handle = row["address"].lstrip("@").split("@", 1)
            person["name"] = handle[0]
    if forum_id and mochi.db.exists("select 1 from restrictions where forum=? and user=? and type='banned' and (expires is null or expires>?)", forum_id, member, mochi.time.now()):
        person["banned"] = True
    return person

# --- Communities ---

def lemmy_community_name(forum):
    """A forum's name for Lemmy apps: its community's handle where it is
    published as one, the community's own name where it is on another
    server, else its fingerprint."""
    if forum.get("hosted"):
        acc = mochi.account.get(forum["hosted"])
        if acc and acc.get("identifier"):
            return acc["identifier"].lstrip("!@").split("@", 1)[0]
    if not mochi.text.valid(forum["id"], "entity"):
        path = forum["id"].rstrip("/").split("/")
        return path[-1] if path else lemmy_slug(forum["name"])
    return forum.get("fingerprint") or forum_fingerprint(forum["id"])

def lemmy_community_url(forum):
    """A forum's address as an actor: the community's on another server, or
    its group's where it is published as one."""
    if not mochi.text.valid(forum["id"], "entity"):
        return forum["id"]
    if forum.get("hosted"):
        acc = mochi.account.get(forum["hosted"])
        if acc and acc.get("url"):
            return acc["url"]
    return ""

def lemmy_community(forum, me, full=False):
    """A forum as a community: its standing for the user and its counts, and
    with full its moderators."""
    owner = owned(forum["id"])
    member = mochi.db.row("select subscribed from members where forum=? and id=?", forum["id"], me) if me else None
    counts = mochi.db.row("select count(*) as posts, coalesce(sum(comments), 0) as comments from posts where forum=? and status='approved'", forum["id"])
    out = {
        "id": forum["id"], "name": lemmy_community_name(forum), "title": forum["name"], "description": forum.get("banner", "") or "",
        "url": lemmy_community_url(forum), "local": mochi.text.valid(forum["id"], "entity"), "nsfw": bool(forum.get("sensitive")),
        "restricted": False, "created": forum.get("updated", 0), "updated": forum.get("updated", 0),
        "subscribed": "yes" if member else "no", "blocked": False, "banned": False,
        "members": forum.get("members", 0) or 0, "posts": counts["posts"] if counts else 0, "comments": counts["comments"] if counts else 0,
        "moderator": owner,
    }
    if me and mochi.db.exists("select 1 from restrictions where forum=? and user=? and type='banned' and (expires is null or expires>?)", forum["id"], me, mochi.time.now()):
        out["banned"] = True
    if full:
        moderators = []
        creator = forum_owner(forum["id"]) if out["local"] else ""
        if creator:
            moderators.append(lemmy_member(forum["id"], creator, mochi.entity.name(creator) or "", me))
        for rule in mochi.access.list.resource("forum/" + forum["id"]) or [] if out["local"] and owner else []:
            subject = rule.get("subject", "")
            if rule.get("operation") in ("moderate", "manage", "*") and rule.get("grant", 1) and mochi.text.valid(subject, "entity") and subject != creator:
                moderators.append(lemmy_member(forum["id"], subject, mochi.entity.name(subject) or "", me))
        out["moderators"] = moderators
    return out

def lemmy_forum(id, name=""):
    """A forum the user holds, by its id, or by a name as apps write one:
    its fingerprint, its community's handle, or name@host."""
    if id:
        return get_forum(id)
    wanted = str(name or "").strip().lstrip("!")
    local = wanted.split("@", 1)[0]
    for forum in mochi.db.rows("select * from forums") or []:
        if lemmy_community_name(forum).lower() != local.lower() and forum.get("fingerprint") != local:
            continue
        # name@host names a community on that host.
        if "@" in wanted and not mochi.text.valid(forum["id"], "entity") and host_of_link(forum["id"]) != wanted.split("@", 1)[1].lower():
            continue
        return forum
    return None

def host_of_link(link):
    rest = str(link or "").split("://", 1)
    return rest[1].split("/", 1)[0].lower() if len(rest) == 2 else ""

def function_lemmy_communities(context, account, type="", sort="", page=1, limit=20):
    """The forums the user holds, as communities: by name, or the latest
    first for New and Active."""
    identity = lemmy_identity()
    if not identity or not lemmy_hosted(account):
        return []
    forums = mochi.db.rows("select * from forums") or []
    if sort in ("New", "Active", "Hot", "NewComments"):
        forums = sorted(forums, key=lambda f: -(f.get("updated", 0) or 0))
    else:
        forums = sorted(forums, key=lambda f: mochi.text.sortkey(f["name"]))
    start = (int(page or 1) - 1) * int(limit or 20)
    return [lemmy_community(f, identity["id"]) for f in forums[start:start + int(limit or 20)]]

def function_lemmy_community(context, account, community="", name=""):
    identity = lemmy_identity()
    if not identity or not lemmy_hosted(account):
        return {"error": "couldnt_find_community"}
    forum = lemmy_forum(community, name)
    if not forum:
        return {"error": "couldnt_find_community"}
    return lemmy_community(forum, identity["id"], True)

def function_lemmy_follow(context, account, community, follow=True):
    """Join a community or leave it: a Mochi forum by subscribing, one on
    another server as the account."""
    identity = lemmy_identity()
    if not identity or not lemmy_hosted(account):
        return {"error": "not_logged_in"}
    forum = get_forum(community)
    if follow:
        if not forum:
            if mochi.text.valid(community, "entity"):
                result, failure = forum_subscribe(community, identity["id"], identity["name"], "", None)
            else:
                result, failure = communities_join(identity["id"], identity["name"], community, account)
            if failure:
                return lemmy_failure(failure)
            forum = get_forum(community)
        if not forum:
            return {"error": "couldnt_find_community"}
        return lemmy_community(forum, identity["id"], True)
    if not forum:
        return {"error": "couldnt_find_community"}
    if owned(forum["id"]):
        return {"error": "community_owner_cannot_leave"}
    result, failure = forum_unsubscribe(forum["id"], identity["id"])
    if failure:
        return lemmy_failure(failure)
    out = lemmy_community(forum, identity["id"], True)
    out["subscribed"] = "no"
    return out

def function_lemmy_block(context, account, community, block=True):
    """Forums keeps no blocked communities: leaving one is how a user stops
    seeing it."""
    return {"error": "not_available"}

# --- Posts ---

def lemmy_post(post, forum, me, moderator=False):
    """A post as the interface takes it, with the user's vote and save."""
    vote = mochi.db.row("select vote from votes where forum=? and post=? and comment='' and voter=?", forum["id"], post["id"], me) if me else None
    latest = mochi.db.row("select max(created) as latest from comments where post=?", post["id"])
    embed = json.decode(post.get("embed", "") or "{}", {}) if post.get("embed") else {}
    community = lemmy_community(forum, me)
    creator = lemmy_member(forum["id"], post["member"], post["name"], me)
    creator["moderator"] = moderator and post["member"] == me
    return {
        "id": post["id"], "community": community, "creator": creator, "title": post["title"], "body": post["body"],
        "url": post.get("url", "") or "", "thumbnail": post.get("thumbnail", "") or "",
        "embed_title": embed.get("title", "") if type(embed) == "dict" else "", "embed_description": embed.get("description", "") if type(embed) == "dict" else "",
        "nsfw": bool(post.get("sensitive")), "locked": bool(post.get("locked")), "pinned": bool(post.get("pinned")),
        "removed": post.get("status") == "removed", "deleted": False, "created": post["created"], "edited": post.get("edited", 0) or 0,
        "language": post.get("language", "") or "", "remote": post.get("remote", "") if str(post.get("remote", "")).startswith("https://") else "",
        "comments": post.get("comments", 0) or 0, "up": post.get("up", 0) or 0, "down": post.get("down", 0) or 0,
        "latest": (latest["latest"] if latest and latest.get("latest") else 0) or 0,
        "vote": 1 if vote and vote["vote"] == "up" else (-1 if vote and vote["vote"] == "down" else 0),
        "saved": mochi.db.exists("select 1 from saved where user=? and post=?", me, post["id"]) if me else False,
        "mine": post["member"] == me,
    }

def lemmy_visible(forum, me):
    """The status filter of what the user sees in a forum: everything where
    they moderate it, else the approved posts and their own."""
    if owned(forum["id"]):
        return ("", [])
    return (" and (status='approved' or member=?)", [me])

def lemmy_post_find(post_id, me):
    """A post the user may see, with its forum, or (None, None)."""
    post = mochi.db.row("select * from posts where id=?", post_id) if post_id else None
    if not post:
        return None, None
    forum = get_forum(post["forum"])
    if not forum:
        return None, None
    if post["status"] != "approved" and post["member"] != me and not owned(forum["id"]):
        return None, None
    return post, forum

def function_lemmy_posts(context, account, community="", name="", type="", sort="", page=1, limit=20, saved=False, liked=False):
    """Posts of the forums the user holds, or of one: sorted as asked, the
    pinned first within a community."""
    identity = lemmy_identity()
    if not identity or not lemmy_hosted(account):
        return []
    me = identity["id"]
    forums = []
    if community or name:
        forum = lemmy_forum(community, name)
        if not forum:
            return []
        forums = [forum]
    else:
        forums = mochi.db.rows("select * from forums") or []
    if not forums:
        return []
    order = get_post_order(lemmy_sort(sort))
    if len(forums) == 1:
        order = "pinned desc, " + order
    limit = min(max(int(limit or 20), 1), 50)
    start = (int(page or 1) - 1) * limit
    clauses = []
    args = []
    for forum in forums:
        extra, extra_args = lemmy_visible(forum, me)
        clauses.append("(forum=?" + extra + ")")
        args += [forum["id"]] + extra_args
    sql = "select * from posts where (" + " or ".join(clauses) + ")"
    if saved:
        sql += " and id in (select post from saved where user=?)"
        args.append(me)
    if liked:
        sql += " and id in (select post from votes where comment='' and voter=? and vote='up')"
        args.append(me)
    rows = mochi.db.rows(sql + " order by " + order + " limit ? offset ?", *(args + [limit, start])) or []
    held = {f["id"]: f for f in forums}
    return [lemmy_post(p, held[p["forum"]], me, owned(p["forum"])) for p in rows if p["forum"] in held]

def function_lemmy_post(context, account, post):
    identity = lemmy_identity()
    if not identity or not lemmy_hosted(account):
        return {"error": "couldnt_find_post"}
    row, forum = lemmy_post_find(post, identity["id"])
    if not row:
        return {"error": "couldnt_find_post"}
    out = lemmy_post(row, forum, identity["id"], owned(forum["id"]))
    out["community"] = lemmy_community(forum, identity["id"], True)
    return out

def lemmy_post_after(post_id, identity):
    """A post as it stands after a change, or the refusal where it is gone."""
    # access-ok: core's Lemmy interface calls these functions as the signed-in user, never anonymously
    row, forum = lemmy_post_find(post_id, identity["id"])
    if not row:
        return {"error": "couldnt_find_post"}
    return lemmy_post(row, forum, identity["id"], owned(forum["id"]))

def lemmy_link(url):
    """A post's link as forums keeps it: empty for none, else a web link, or
    None where it is not one."""
    url = str(url or "").strip()
    if not url:
        return ""
    return safe_web_link(url) or None

def function_lemmy_post_create(context, account, community, name, body="", url="", nsfw=False, language=""):
    """A post to a forum from the app, checked as the post form checks it."""
    identity = lemmy_identity()
    if not identity or not lemmy_hosted(account):
        return {"error": "not_logged_in"}
    if not mochi.text.valid(name, "name"):
        return {"error": mochi.app.label("errors.invalid_title")}
    body = body or ""
    if body and not mochi.text.valid(body, "text"):
        return {"error": mochi.app.label("errors.invalid_body")}
    link = lemmy_link(url)
    if link == None:
        return {"error": mochi.app.label("errors.invalid_link")}
    result, failure = post_create(community, identity["id"], identity["name"], name, body, link, 1 if nsfw else 0, language_tag(language) if language else "", lambda object: [])
    if failure:
        return lemmy_failure(failure)
    return lemmy_post_after(result["id"], identity)

def function_lemmy_post_edit(context, account, post, name=None, body=None, url=None, nsfw=None, language=None):
    """The user's change to their post: what the app sends, the rest as it
    was."""
    identity = lemmy_identity()
    row, forum = lemmy_post_find(post, identity["id"]) if identity and lemmy_hosted(account) else (None, None)
    if not row:
        return {"error": "couldnt_find_post"}
    title = name if name != None else row["title"]
    text = body if body != None else row["body"]
    if not mochi.text.valid(title, "name"):
        return {"error": mochi.app.label("errors.invalid_title")}
    if text and not mochi.text.valid(text, "text"):
        return {"error": mochi.app.label("errors.invalid_body")}
    link = None
    if url != None:
        link = lemmy_link(url)
        if link == None:
            return {"error": mochi.app.label("errors.invalid_link")}
    sensitive = (1 if nsfw else 0) if nsfw != None else None
    result, failure = post_edit(forum["id"], post, identity["id"], title, text, link, sensitive, language_tag(language) if language else language, None, [], lambda object: [])
    if failure:
        return lemmy_failure(failure)
    return lemmy_post_after(post, identity)

def function_lemmy_post_delete(context, account, post, deleted=True):
    """Delete the user's post; a deleted post is gone, so cannot come back."""
    identity = lemmy_identity()
    row, forum = lemmy_post_find(post, identity["id"]) if identity and lemmy_hosted(account) else (None, None)
    if not row:
        return {"error": "couldnt_find_post"}
    if not deleted:
        return {"error": "not_available"}
    out = lemmy_post(row, forum, identity["id"], owned(forum["id"]))
    result, failure = post_delete(forum["id"], post, identity["id"])
    if failure:
        return lemmy_failure(failure)
    out["deleted"] = True
    return out

def function_lemmy_post_remove(context, account, post, removed=True, reason=""):
    """A moderator removes a post, or restores it."""
    identity = lemmy_identity()
    row, forum = lemmy_post_find(post, identity["id"]) if identity and lemmy_hosted(account) else (None, None)
    if not row:
        return {"error": "couldnt_find_post"}
    if removed:
        result, failure = post_remove(forum["id"], post, identity["id"], reason or "")
    else:
        result, failure = post_restore(forum["id"], post, identity["id"])
    if failure:
        return lemmy_failure(failure)
    return lemmy_post_after(post, identity)

def function_lemmy_post_lock(context, account, post, locked=True):
    identity = lemmy_identity()
    row, forum = lemmy_post_find(post, identity["id"]) if identity and lemmy_hosted(account) else (None, None)
    if not row:
        return {"error": "couldnt_find_post"}
    result, failure = post_lock(forum["id"], post, identity["id"], bool(locked))
    if failure:
        return lemmy_failure(failure)
    return lemmy_post_after(post, identity)

def function_lemmy_post_feature(context, account, post, featured=True):
    identity = lemmy_identity()
    row, forum = lemmy_post_find(post, identity["id"]) if identity and lemmy_hosted(account) else (None, None)
    if not row:
        return {"error": "couldnt_find_post"}
    result, failure = post_pin(forum["id"], post, identity["id"], bool(featured))
    if failure:
        return lemmy_failure(failure)
    return lemmy_post_after(post, identity)

def lemmy_vote_of(score):
    """A Lemmy score as forums' vote: up, down, or none to take it back."""
    if int(score or 0) > 0:
        return "up"
    if int(score or 0) < 0:
        return "down"
    return "none"

def function_lemmy_post_vote(context, account, post, score=0):
    identity = lemmy_identity()
    row, forum = lemmy_post_find(post, identity["id"]) if identity and lemmy_hosted(account) else (None, None)
    if not row:
        return {"error": "couldnt_find_post"}
    result, failure = post_vote(forum["id"], post, identity["id"], lemmy_vote_of(score))
    if failure:
        return lemmy_failure(failure)
    return lemmy_post_after(post, identity)

def lemmy_snapshot(post, forum):
    """What the saved list keeps of a post, as the forums web app keeps it."""
    return json.encode({"id": post["id"], "forum": forum["id"], "fingerprint": forum_fingerprint(forum["id"]), "forumName": forum["name"],
        "member": post["member"], "name": post["name"], "title": post["title"], "body": post["body"], "created": post["created"],
        "up": post.get("up", 0), "down": post.get("down", 0), "tags": [], "attachments": []})

def function_lemmy_post_save(context, account, post, save=True):
    identity = lemmy_identity()
    row, forum = lemmy_post_find(post, identity["id"]) if identity and lemmy_hosted(account) else (None, None)
    if not row:
        return {"error": "couldnt_find_post"}
    if save:
        result, failure = saved_add(identity["id"], post, lemmy_snapshot(row, forum))
    else:
        result, failure = saved_remove(identity["id"], post)
    if failure:
        return lemmy_failure(failure)
    return lemmy_post_after(post, identity)

# --- Comments ---

def lemmy_path(comment):
    """The ids of the comments above a comment, from the root."""
    path = []
    parent = comment.get("parent", "")
    seen = {}
    while parent and parent not in seen and len(path) < 100:
        seen[parent] = True
        path.insert(0, parent)
        above = mochi.db.row("select parent from comments where id=?", parent)
        parent = above["parent"] if above else ""
    return path

def lemmy_comment(comment, post, forum, me, moderator=False):
    """A comment as the interface takes it, with its post, the user's vote
    and how many answer it."""
    vote = mochi.db.row("select vote from votes where forum=? and post=? and comment=? and voter=?", forum["id"], post["id"], comment["id"], me) if me else None
    children = mochi.db.row("select count(*) as n from comments where parent=?", comment["id"])
    creator = lemmy_member(forum["id"], comment["member"], comment["name"], me)
    creator["moderator"] = moderator and comment["member"] == me
    return {
        "id": comment["id"], "post": lemmy_post(post, forum, me, moderator), "creator": creator, "body": comment["body"],
        "parent": comment.get("parent", "") or "", "path": lemmy_path(comment),
        "removed": comment.get("status") == "removed", "deleted": False, "created": comment["created"], "edited": comment.get("edited", 0) or 0,
        "remote": comment.get("remote", "") if str(comment.get("remote", "")).startswith("https://") else "",
        "up": comment.get("up", 0) or 0, "down": comment.get("down", 0) or 0, "children": children["n"] if children else 0,
        "vote": 1 if vote and vote["vote"] == "up" else (-1 if vote and vote["vote"] == "down" else 0),
        "saved": False, "mine": comment["member"] == me,
    }

def lemmy_comment_find(comment_id, me):
    """A comment the user may see, with its post and forum, or Nones."""
    comment = mochi.db.row("select * from comments where id=?", comment_id) if comment_id else None
    if not comment:
        return None, None, None
    post, forum = lemmy_post_find(comment["post"], me)
    if not post:
        return None, None, None
    if comment["status"] != "approved" and comment["member"] != me and not owned(forum["id"]):
        return None, None, None
    return comment, post, forum

def lemmy_comment_after(comment_id, identity):
    # access-ok: core's Lemmy interface calls these functions as the signed-in user, never anonymously
    comment, post, forum = lemmy_comment_find(comment_id, identity["id"])
    if not comment:
        return {"error": "couldnt_find_comment"}
    return lemmy_comment(comment, post, forum, identity["id"], owned(forum["id"]))

def function_lemmy_comments(context, account, post="", parent="", community="", type="", sort="", page=1, limit=50, saved=False, liked=False, depth=0):
    """Comments of a post, under a comment, or of the forums the user holds:
    the oldest first under a post, as a thread reads, else the latest."""
    identity = lemmy_identity()
    if not identity or not lemmy_hosted(account):
        return []
    me = identity["id"]
    if saved:
        return []
    limit = min(max(int(limit or 50), 1), 500)
    start = (int(page or 1) - 1) * limit
    if post:
        row, forum = lemmy_post_find(post, me)
        if not row:
            return []
        moderator = owned(forum["id"])
        visible = "" if moderator else " and (status='approved' or member=?)"
        args = [] if moderator else [me]
        order = "created asc" if sort in ("", "Old", "Hot", "Top") else "created desc"
        if sort == "Top":
            order = "(up - down) desc, created asc"
        rows = mochi.db.rows("select * from comments where post=?" + visible + " order by " + order, post, *args) or []
        if parent:
            under = {parent: True}
            kept = []
            for c in rows:
                if c["parent"] in under:
                    under[c["id"]] = True
                    kept.append(c)
            rows = kept
        if depth and int(depth) > 0:
            rows = [c for c in rows if len(lemmy_path(c)) - (len(lemmy_path({"parent": parent})) + 1 if parent else 0) < int(depth)]
        if liked:
            rows = [c for c in rows if mochi.db.exists("select 1 from votes where comment=? and voter=? and vote='up'", c["id"], me)]
        return [lemmy_comment(c, row, forum, me, moderator) for c in rows[start:start + limit]]
    forums = [get_forum(community)] if community else mochi.db.rows("select * from forums") or []
    out = []
    for forum in forums:
        if not forum:
            continue
        moderator = owned(forum["id"])
        visible = "" if moderator else " and (status='approved' or member=?)"
        args = [] if moderator else [me]
        for c in mochi.db.rows("select * from comments where forum=?" + visible + " order by created desc limit ?", forum["id"], *(args + [start + limit])) or []:
            p = mochi.db.row("select * from posts where id=?", c["post"])
            if p:
                out.append(lemmy_comment(c, p, forum, me, moderator))
    out = sorted(out, key=lambda c: -c["created"])
    if liked:
        out = [c for c in out if c["vote"] == 1]
    return out[start:start + limit]

def function_lemmy_comment(context, account, comment):
    identity = lemmy_identity()
    if not identity or not lemmy_hosted(account):
        return {"error": "couldnt_find_comment"}
    return lemmy_comment_after(comment, identity)

def function_lemmy_comment_create(context, account, post, content, parent=""):
    """A comment from the app, checked as the comment form checks it."""
    identity = lemmy_identity()
    row, forum = lemmy_post_find(post, identity["id"]) if identity and lemmy_hosted(account) else (None, None)
    if not row:
        return {"error": "couldnt_find_post"}
    if not mochi.text.valid(content, "text") or not str(content).strip():
        return {"error": mochi.app.label("errors.invalid_body")}
    result, failure = comment_create(forum["id"], post, parent or "", identity["id"], identity["name"], content, lambda object: [])
    if failure:
        return lemmy_failure(failure)
    return lemmy_comment_after(result["id"], identity)

def function_lemmy_comment_edit(context, account, comment, content):
    identity = lemmy_identity()
    row, post, forum = lemmy_comment_find(comment, identity["id"]) if identity and lemmy_hosted(account) else (None, None, None)
    if not row:
        return {"error": "couldnt_find_comment"}
    if not mochi.text.valid(content, "text") or not str(content).strip():
        return {"error": mochi.app.label("errors.invalid_body")}
    result, failure = comment_edit(forum["id"], post["id"], comment, identity["id"], content, None, lambda object: [])
    if failure:
        return lemmy_failure(failure)
    return lemmy_comment_after(comment, identity)

def function_lemmy_comment_delete(context, account, comment, deleted=True):
    identity = lemmy_identity()
    row, post, forum = lemmy_comment_find(comment, identity["id"]) if identity and lemmy_hosted(account) else (None, None, None)
    if not row:
        return {"error": "couldnt_find_comment"}
    if not deleted:
        return {"error": "not_available"}
    out = lemmy_comment(row, post, forum, identity["id"], owned(forum["id"]))
    result, failure = comment_delete(forum["id"], post["id"], comment, identity["id"])
    if failure:
        return lemmy_failure(failure)
    out["deleted"] = True
    return out

def function_lemmy_comment_remove(context, account, comment, removed=True, reason=""):
    identity = lemmy_identity()
    row, post, forum = lemmy_comment_find(comment, identity["id"]) if identity and lemmy_hosted(account) else (None, None, None)
    if not row:
        return {"error": "couldnt_find_comment"}
    if removed:
        result, failure = comment_remove(forum["id"], comment, identity["id"], reason or "")
    else:
        result, failure = comment_restore(forum["id"], comment, identity["id"])
    if failure:
        return lemmy_failure(failure)
    return lemmy_comment_after(comment, identity)

def function_lemmy_comment_vote(context, account, comment, score=0):
    identity = lemmy_identity()
    row, post, forum = lemmy_comment_find(comment, identity["id"]) if identity and lemmy_hosted(account) else (None, None, None)
    if not row:
        return {"error": "couldnt_find_comment"}
    result, failure = comment_vote(forum["id"], comment, identity["id"], lemmy_vote_of(score))
    if failure:
        return lemmy_failure(failure)
    return lemmy_comment_after(comment, identity)

def function_lemmy_comment_save(context, account, comment, save=True):
    """Forums saves posts, not comments."""
    return {"error": "not_available"}

# --- Reports ---

def lemmy_report(report, forum, me):
    """A report as the interface takes it, with what it is about."""
    out = {"id": report["id"], "kind": report["type"], "reason": (report.get("details") or report.get("reason") or ""),
        "resolved": report.get("status", "pending") != "pending", "created": report["created"], "updated": report.get("resolved") or 0,
        "reporter": lemmy_member(forum["id"], report["reporter"], mochi.entity.name(report["reporter"]) or report["reporter"], me), "resolver": None}
    if report.get("resolver"):
        out["resolver"] = lemmy_member(forum["id"], report["resolver"], mochi.entity.name(report["resolver"]) or report["resolver"], me)
    if report["type"] == "comment":
        comment = mochi.db.row("select * from comments where id=?", report["target"])
        post = mochi.db.row("select * from posts where id=?", comment["post"]) if comment else None
        if not comment or not post:
            return None
        out["comment"] = lemmy_comment(comment, post, forum, me, True)
    else:
        post = mochi.db.row("select * from posts where id=?", report["target"])
        if not post:
            return None
        out["post"] = lemmy_post(post, forum, me, True)
    return out

def lemmy_report_made(forum, kind, target, me, reason):
    """The report just made: the forum's row where it is the user's own, else
    as it was sent to its owner."""
    row = mochi.db.row("select * from reports where forum=? and type=? and target=? and reporter=? order by created desc limit 1", forum["id"], kind, target, me)
    if not row:
        row = {"id": kind + "/" + target + "/" + me, "type": kind, "target": target, "reporter": me, "reason": "other", "details": reason, "status": "pending", "created": mochi.time.now()}
    return lemmy_report(row, forum, me)

def function_lemmy_post_report(context, account, post, reason=""):
    identity = lemmy_identity()
    row, forum = lemmy_post_find(post, identity["id"]) if identity and lemmy_hosted(account) else (None, None)
    if not row:
        return {"error": "couldnt_find_post"}
    result, failure = post_report(forum["id"], post, identity["id"], "other", reason or "")
    if failure:
        return lemmy_failure(failure)
    return lemmy_report_made(forum, "post", post, identity["id"], reason)

def function_lemmy_comment_report(context, account, comment, reason=""):
    identity = lemmy_identity()
    row, post, forum = lemmy_comment_find(comment, identity["id"]) if identity and lemmy_hosted(account) else (None, None, None)
    if not row:
        return {"error": "couldnt_find_comment"}
    result, failure = comment_report(forum["id"], comment, identity["id"], "other", reason or "")
    if failure:
        return lemmy_failure(failure)
    return lemmy_report_made(forum, "comment", comment, identity["id"], reason)

def function_lemmy_reports(context, account, kind="", unresolved=False, community="", page=1, limit=20):
    """Reports of the forums the user owns and moderates, the latest first."""
    identity = lemmy_identity()
    if not identity or not lemmy_hosted(account):
        return []
    me = identity["id"]
    forums = [get_forum(community)] if community else mochi.db.rows("select * from forums") or []
    out = []
    for forum in forums:
        if not forum or not owned(forum["id"]):
            continue
        sql = "select * from reports where forum=?"
        args = [forum["id"]]
        if kind:
            sql += " and type=?"
            args.append(kind)
        if unresolved:
            sql += " and status='pending'"
        for report in mochi.db.rows(sql + " order by created desc limit 500", *args) or []:
            item = lemmy_report(report, forum, me)
            if item:
                out.append(item)
    out = sorted(out, key=lambda r: -r["created"])
    start = (int(page or 1) - 1) * int(limit or 20)
    return out[start:start + int(limit or 20)]

def function_lemmy_report_resolve(context, account, report, resolved=True):
    """A moderator settles a report, leaving what it is about as it stands;
    a settled report is not reopened."""
    identity = lemmy_identity()
    if not identity or not lemmy_hosted(account):
        return {"error": "not_logged_in"}
    row = mochi.db.row("select * from reports where id=?", report)
    forum = get_forum(row["forum"]) if row else None
    if not row or not forum:
        return {"error": "couldnt_find_object"}
    if not resolved:
        return {"error": "not_available"}
    if row.get("status") == "pending":
        result, failure = report_resolve(forum["id"], report, identity["id"], "ignored")
        if failure:
            return lemmy_failure(failure)
    return lemmy_report(mochi.db.row("select * from reports where id=?", report), forum, identity["id"]) or {"error": "couldnt_find_object"}

# --- Moderation ---

LEMMY_MODLOG = {("remove", "post"): ("post/remove", False), ("restore", "post"): ("post/remove", True), ("lock", "post"): ("post/lock", False),
    ("unlock", "post"): ("post/lock", True), ("pin", "post"): ("post/feature", False), ("unpin", "post"): ("post/feature", True),
    ("remove", "comment"): ("comment/remove", False), ("restore", "comment"): ("comment/remove", True),
    ("restrict", "user"): ("ban", False), ("unrestrict", "user"): ("ban", True)}

def function_lemmy_modlog(context, account, community="", page=1, limit=20):
    """The moderation log of the forums the user owns, the latest first."""
    identity = lemmy_identity()
    if not identity or not lemmy_hosted(account):
        return []
    me = identity["id"]
    forums = [get_forum(community)] if community else mochi.db.rows("select * from forums") or []
    out = []
    count = (int(page or 1)) * int(limit or 20)
    for forum in forums:
        if not forum or not owned(forum["id"]):
            continue
        for entry in moderation_log_data(forum, count)["entries"]:
            kind = LEMMY_MODLOG.get((entry["action"], entry["type"]))
            if not kind:
                continue
            item = {"id": entry["id"], "kind": kind[0], "undone": kind[1], "reason": entry.get("reason", ""), "created": entry["created"],
                "moderator": lemmy_member(forum["id"], entry["moderator"], entry.get("moderator_name", ""), me), "community": lemmy_community(forum, me)}
            if entry["type"] == "post":
                post = mochi.db.row("select * from posts where id=?", entry["target"])
                if not post:
                    continue
                item["post"] = lemmy_post(post, forum, me, True)
            elif entry["type"] == "comment":
                comment = mochi.db.row("select * from comments where id=?", entry["target"])
                post = mochi.db.row("select * from posts where id=?", comment["post"]) if comment else None
                if not comment or not post:
                    continue
                item["comment"] = lemmy_comment(comment, post, forum, me, True)
            else:
                item["person"] = lemmy_member(forum["id"], entry["target"], entry.get("author_name", ""), me)
            out.append(item)
    out = sorted(out, key=lambda e: -e["created"])
    start = (int(page or 1) - 1) * int(limit or 20)
    return out[start:start + int(limit or 20)]

def function_lemmy_ban(context, account, community, person, ban=True, reason="", expires=0, remove=False):
    """A moderator bans someone from a forum until a time, or lifts it."""
    identity = lemmy_identity()
    forum = get_forum(community) if identity and lemmy_hosted(account) else None
    if not forum:
        return {"error": "couldnt_find_community"}
    if ban:
        duration = ""
        if expires and int(expires) > mochi.time.now():
            duration = str(int(expires) - mochi.time.now())
        result, failure = restrict(forum["id"], identity["id"], person, "banned", reason or "", duration)
    else:
        result, failure = unrestrict(forum["id"], identity["id"], person)
    if failure:
        return lemmy_failure(failure)
    return {"person": lemmy_member(forum["id"], person, mochi.entity.name(person) or "", identity["id"])}

def function_lemmy_moderator(context, account, community, person, added=True):
    """The forum's manager makes someone a moderator, or takes it back."""
    identity = lemmy_identity()
    forum = get_forum(community) if identity and lemmy_hosted(account) else None
    if not forum:
        return {"error": "couldnt_find_community"}
    if added:
        result, failure = access_set(forum["id"], identity["id"], person, "moderate")
    else:
        result, failure = access_revoke(forum["id"], identity["id"], person)
    if failure:
        return lemmy_failure(failure)
    return lemmy_community(forum, identity["id"], True)

# --- Search, people and the inbox ---

def function_lemmy_search(context, account, query, type="All", community="", page=1, limit=20):
    """Posts, comments and forums the user holds whose words hold the query."""
    identity = lemmy_identity()
    if not identity or not lemmy_hosted(account) or not str(query or "").strip():
        return {"posts": [], "comments": [], "communities": []}
    me = identity["id"]
    like = "%" + str(query).strip().replace("%", "").replace("_", "") + "%"
    limit = min(max(int(limit or 20), 1), 50)
    start = (int(page or 1) - 1) * limit
    out = {"posts": [], "comments": [], "communities": []}
    forums = {f["id"]: f for f in ([get_forum(community)] if community else mochi.db.rows("select * from forums") or []) if f}
    if type in ("All", "Communities"):
        out["communities"] = [lemmy_community(f, me) for f in forums.values() if str(query).lower() in f["name"].lower()][start:start + limit]
    if type in ("All", "Posts", "Url"):
        for p in mochi.db.rows("select * from posts where status='approved' and (title like ? or body like ? or url like ?) order by created desc limit ? offset ?", like, like, like, limit, start) or []:
            if p["forum"] in forums:
                out["posts"].append(lemmy_post(p, forums[p["forum"]], me, owned(p["forum"])))
    if type in ("All", "Comments"):
        for c in mochi.db.rows("select * from comments where status='approved' and body like ? order by created desc limit ? offset ?", like, limit, start) or []:
            p = mochi.db.row("select * from posts where id=?", c["post"])
            if p and c["forum"] in forums:
                out["comments"].append(lemmy_comment(c, p, forums[c["forum"]], me, owned(c["forum"])))
    return out

def function_lemmy_resolve(context, account, query):
    """What an address or link names: a forum the user holds, a community on
    another server found as the account finds one, or a post or comment
    held."""
    identity = lemmy_identity()
    if not identity or not lemmy_hosted(account):
        return {"error": "couldnt_find_object"}
    me = identity["id"]
    query = str(query or "").strip()
    post = mochi.db.row("select * from posts where remote=? or url=?", query, query) if query.startswith("https://") else None
    if post:
        row, forum = lemmy_post_find(post["id"], me)
        if row:
            return {"post": lemmy_post(row, forum, me, owned(forum["id"]))}
    comment = mochi.db.row("select * from comments where remote=?", query) if query.startswith("https://") else None
    if comment:
        row, p, forum = lemmy_comment_find(comment["id"], me)
        if row:
            return {"comment": lemmy_comment(row, p, forum, me, owned(forum["id"]))}
    forum = get_forum(query) or lemmy_forum("", query)
    if forum:
        return {"community": lemmy_community(forum, me)}
    identifier = community_identifier(query)
    found = mochi.account.resolve(identifier) if identifier else None
    if found and found.get("network") == "fediverse" and found.get("type") == "group" and remote_ok(found.get("id", "")):
        held = get_forum(found["id"])
        if held:
            return {"community": lemmy_community(held, me)}
        name = str(found.get("name", "") or found.get("address", "") or found["id"])[:200]
        return {"community": {"id": found["id"], "name": str(found.get("address", "")).lstrip("!@").split("@", 1)[0] or lemmy_slug(name), "title": name,
            "description": str(found.get("summary", "") or ""), "url": found["id"], "local": False, "nsfw": False, "restricted": False,
            "created": 0, "updated": 0, "subscribed": "no", "blocked": False, "banned": False, "members": 0, "posts": 0, "comments": 0,
            "moderator": False, "icon": found.get("avatar", "")}}
    return {"error": "couldnt_find_object"}

def function_lemmy_person(context, account, person, self=False, page=1, limit=20, saved=False, sort=""):
    """Someone's posts and comments in the forums the user holds, and the
    forums they moderate: the user's own where self."""
    identity = lemmy_identity()
    if not identity or not lemmy_hosted(account):
        return {"error": "couldnt_find_person"}
    me = identity["id"]
    who = me if self else person
    limit = min(max(int(limit or 20), 1), 50)
    start = (int(page or 1) - 1) * limit
    forums = {f["id"]: f for f in mochi.db.rows("select * from forums") or []}
    posts = []
    if saved and self:
        rows = mochi.db.rows("select p.* from posts p join saved s on s.post=p.id where s.user=? order by s.created desc limit ? offset ?", me, limit, start) or []
    else:
        rows = mochi.db.rows("select * from posts where member=? and (status='approved' or member=?) order by created desc limit ? offset ?", who, me, limit, start) or []
    for p in rows:
        if p["forum"] in forums:
            posts.append(lemmy_post(p, forums[p["forum"]], me, owned(p["forum"])))
    comments = []
    if not saved:
        for c in mochi.db.rows("select * from comments where member=? and (status='approved' or member=?) order by created desc limit ? offset ?", who, me, limit, start) or []:
            p = mochi.db.row("select * from posts where id=?", c["post"])
            if p and c["forum"] in forums:
                comments.append(lemmy_comment(c, p, forums[c["forum"]], me, owned(c["forum"])))
    counts = mochi.db.row("select (select count(*) from posts where member=?) as posts, (select count(*) from comments where member=?) as comments", who, who)
    moderates = [lemmy_community(f, me) for f in forums.values() if self and owned(f["id"])]
    name = ""
    seen = mochi.db.row("select name from posts where member=? limit 1", who) or mochi.db.row("select name from comments where member=? limit 1", who)
    if seen:
        name = seen["name"]
    return {"person": lemmy_member("", who, name, me), "posts": posts, "comments": comments, "moderates": moderates,
        "post_count": counts["posts"] if counts else 0, "comment_count": counts["comments"] if counts else 0}

def function_lemmy_replies(context, account, page=1, limit=20):
    """Comments answering the user's posts and comments, the latest first."""
    identity = lemmy_identity()
    if not identity or not lemmy_hosted(account):
        return []
    me = identity["id"]
    limit = min(max(int(limit or 20), 1), 500)
    start = (int(page or 1) - 1) * limit
    rows = mochi.db.rows("select c.* from comments c where c.member!=? and c.status='approved' and ((c.parent!='' and c.parent in (select id from comments where member=?)) or (c.parent='' and c.post in (select id from posts where member=?))) order by c.created desc limit ? offset ?", me, me, me, limit, start) or []
    out = []
    for c in rows:
        row, post, forum = lemmy_comment_find(c["id"], me)
        if row:
            out.append(lemmy_comment(row, post, forum, me, owned(forum["id"])))
    return out

def function_lemmy_mentions(context, account, page=1, limit=20):
    """Comments naming the user: by the name forums shows, or the account's
    address."""
    identity = lemmy_identity()
    acc = lemmy_hosted(account)
    if not identity or not acc:
        return []
    me = identity["id"]
    limit = min(max(int(limit or 20), 1), 500)
    start = (int(page or 1) - 1) * limit
    patterns = ["%@[" + identity["name"] + "]%"]
    address = str(acc.get("identifier", "") or "").lstrip("@")
    if "@" in address:
        patterns.append("%@" + address + "%")
    likes = " or ".join(["body like ?" for _ in patterns])
    rows = mochi.db.rows("select * from comments where member!=? and status='approved' and (" + likes + ") order by created desc limit ? offset ?", me, *(patterns + [limit, start])) or []
    out = []
    for c in rows:
        row, post, forum = lemmy_comment_find(c["id"], me)
        if row:
            out.append(lemmy_comment(row, post, forum, me, owned(forum["id"])))
    return out
