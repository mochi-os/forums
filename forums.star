# Mochi Forums app

# Create database
def database_create():
    # mochi.db.query("create table settings ( name text not null primary key, value text not null )")
    # mochi.db.query("replace into settings ( name, value ) values ( 'schema', 1 )")

    # mochi.db.query("create table forums ( id text not null primary key, fingerprint text not null, name text not null, role text not null default '', members integer not null default 0, updated integer not null )")
    # mochi.db.query("create index forums_fingerprint on forums( fingerprint )")
    # mochi.db.query("create index forums_name on forums( name )")
    # mochi.db.query("create index forums_updated on forums( updated )")

    # mochi.db.query("create table members ( forum references forums( id ), id text not null, name text not null default '', role text not null, primary key ( forum, id ) )")
    # mochi.db.query("create index members_id on members( id )")

    # mochi.db.query("create table posts ( id text not null primary key, forum references forum( id ), member text not null, name text not null, title text not null, body text not null, comments integer not null default 0, up integer not null default 0, down integer not null default 0, created integer not null, updated integer not null )")
    # mochi.db.query("create index posts_forum on posts( forum )")
    # mochi.db.query("create index posts_created on posts( created )")
    # mochi.db.query("create index posts_updated on posts( updated )")

    # mochi.db.query("create table comments ( id text not null primary key, forum references forum( id ), post text not null, parent text not null, member text not null, name text not null, body text not null, up integer not null default 0, down integer not null default 0, created integer not null )")
    # mochi.db.query("create index comments_forum on comments( forum )")
    # mochi.db.query("create index comments_post on comments( post )")
    # mochi.db.query("create index comments_parent on comments( parent )")
    # mochi.db.query("create index comments_created on comments( created )")

    # mochi.db.query("create table votes ( forum references forum( id ), post text not null, comment text not null default '', voter text not null, vote text not null, primary key ( forum, post, comment, voter ) )")
    # mochi.db.query("create index votes_post on votes( post )")
    # mochi.db.query("create index votes_comment on votes( comment )")
    # mochi.db.query("create index votes_voter on votes( voter )")
    return 1

# ACTIONS

def action_view(action, inputs):
    return 1

def action_create(action, inputs):
    return 1

def action_find(action, inputs):
    return 1

def action_new(action, inputs):
    return 1

def action_post_create(action, inputs):
    return 1

def action_post_new(action, inputs):
    return 1

def action_search(action, inputs):
    return 1

def action_members_edit(action, inputs):
    return 1

def action_members_save(action, inputs):
    return 1

def action_subscribe(action, inputs):
    return 1

def action_unsubscribe(action, inputs):
    return 1

def action_post_view(action, inputs):
    return 1

def action_comment_new(action, inputs):
    return 1

def action_comment_create(action, inputs):
    return 1

def action_post_vote(action, inputs):
    return 1

def action_comment_vote(action, inputs):
    return 1

# EVENTS

def event_comment_create_event(event, content):
    return 1

def event_comment_submit_event(action, inputs):
    return 1

def event_comment_update_event(event, content):
    return 1

def event_comment_vote_event(action, inputs):
    return 1

def event_member_update_event(event, content):
    return 1

def event_post_create_event(action, inputs):
    return 1

def event_post_submit_event(event, content):
    return 1

def event_post_update_event(action, inputs):
    return 1

def event_post_vote_event(event, content):
    return 1

def event_subscribe_event(action, inputs):
    return 1

def event_unsubscribe_event(event, content):
    return 1

def event_update_event(action, inputs):
    return 1


# # Create new chat
# def action_create(action, inputs):
#     chat = mochi.uid()
#     name = inputs.get("name")
#     if not mochi.valid(name, "name"):
#         mochi.action.error(400, "Invalid chat name")
#         return
    
#     mochi.db.query("replace into chats ( id, identity, name, key, updated ) values ( ?, ?, ?, ?, ? )", chat, action["identity.id"], name, mochi.random.alphanumeric(12), mochi.time.now())
#     mochi.db.query("replace into members ( chat, member, name ) values ( ?, ?, ? )", chat, action["identity.id"], action["identity.name"])

#     members = [{"id": action["identity.id"], "name": action["identity.name"]}]
#     for friend in mochi.service.call("friends", "list"):
#         if inputs.get(friend["id"]):
#             mochi.db.query("replace into members ( chat, member, name ) values ( ?, ?, ? )", chat, friend["id"], friend["name"])
#             members.append({"id": friend["id"], "name": friend["name"]})

#     for member in members:
#         if member["id"] != action["identity.id"]:
#             mochi.message.send({"from": action["identity.id"], "to": member["id"], "service": "chat", "event": "new"}, {"id": chat, "name": name}, members)

#     mochi.action.redirect("/chat/" + chat)


# # List chats
# def action_list(action, inputs):
#     mochi.action.write("list", action["format"], mochi.db.query("select * from chats order by updated desc"))


# # Enter details of new chat
# def action_new(action, inputs):
#     mochi.action.write("new", action["format"], {"name": action["identity.name"], "friends": mochi.service.call("friends", "list")})


# # Send latest previous messages to client
# def action_messages(action, inputs):
#     chat = mochi.db.row("select * from chats where id=?", inputs.get("chat"))
#     if not chat:
#         mochi.action.error(404, "Chat not found")
#         return

#     messages = mochi.db.query("select * from ( select * from messages where chat=? order by id desc limit 1000 ) as ss order by id", chat["id"])
    
#     for m in messages:
#         m["attachments"] = mochi.attachment.get("chat/" + chat["id"] + "/" + m["id"])
#         m["created_local"] = mochi.time.local(m["created"])

#     mochi.action.write("", "json", {"messages": messages})


# # Send a message
# def action_send(action, inputs):
#     chat = mochi.db.row("select * from chats where id=?", inputs.get("chat"))
#     if not chat:
#         mochi.action.error(404, "Chat not found")
#         return

#     body = inputs.get("body")
#     if not mochi.valid(body, "text"):
#         mochi.action.error(400, "Invalid message")
#         return
    
#     id = mochi.uid()
#     mochi.db.query("replace into messages ( id, chat, member, name, body, created ) values ( ?, ?, ?, ?, ?, ? )", id, chat["id"], action["identity.id"], action["identity.name"], body, mochi.time.now())

#     attachments = mochi.attachment.put("attachments", "chat/" + chat["id"] + "/" + id, action["identity.id"], True)
#     mochi.action.websocket.write(chat["key"], {"created_local": mochi.time.local(mochi.time.now()), "name": action["identity.name"], "body": body, "attachments": attachments})

#     for member in mochi.db.query("select * from members where chat=? and member!=?", chat["id"], action["identity.id"]):
#         mochi.message.send({"from": action["identity.id"], "to": member["member"], "service": "chat", "event": "message"}, {"chat": chat["id"], "message": id, "created": mochi.time.now(), "body": body}, attachments)


# # View a chat
# def action_view(action, inputs):
#     chat = mochi.db.row("select * from chats where id=?", inputs.get("chat"))
#     if not chat:
#         mochi.action.error(404, "Chat not found")
#         return
    
#     mochi.service.call("notifications", "clear.object", "chat", chat["id"])
#     mochi.action.write("view", action["format"], {"chat": chat})


# # Recieve a chat message from another member
# def event_message(event, content):
#     chat = mochi.db.row("select * from chats where id=?", content.get("chat"))
#     if not chat:
#         return

#     member = mochi.db.row("select * from members where chat=? and member=?", chat["id"], event["from"])
#     if not member:
#         return
    
#     id = content.get("message")
#     if not mochi.valid(id, "id"):
#         return
    
#     created = content.get("created")
#     if not mochi.valid(created, "integer"):
#         return
    
#     body = content.get("body")
#     if not mochi.valid(body, "text"):
#         return
    
#     mochi.db.query("replace into messages ( id, chat, member, name, body, created ) values ( ?, ?, ?, ?, ?, ? )", id, chat["id"], member["member"], member["name"], body, created)

#     attachments = mochi.event.segment()
#     mochi.attachment.save(attachments, "chat/" + chat["id"] + "/" + id, event["from"])

#     mochi.action.websocket.write(chat["key"], {"created_local": mochi.time.local(created), "name": member["name"], "body": body, "attachments": attachments})
#     mochi.service.call("notifications", "create", "chat", "message", chat["id"], member["name"] + ": " + body, "/chat/" + chat["id"])


# # Received a new chat event
# def event_new(event, content):
#     f = mochi.service.call("friends", "get", event["from"])
#     if not f:
#         return
    
#     chat = content.get("id")
#     if not mochi.valid(chat, "id"):
#         return
    
#     if mochi.db.exists("select id from chats where id=?", chat):
#         # Duplicate chat
#         return
    
#     name = content.get("name")
#     if not mochi.valid(name, "name"):
#         return
    
#     mochi.db.query("replace into chats ( id, identity, name, key, updated ) values ( ?, ?, ?, ?, ? )", chat, event["to"], name, mochi.random.alphanumeric(12), mochi.time.now())

#     for member in mochi.event.segment():
#         if not mochi.valid(member["id"], "entity"):
#             continue
#         if not mochi.valid(member["name"], "name"):
#             continue
#         mochi.db.query("replace into members ( chat, member, name ) values ( ?, ?, ? )", chat, member["id"], member["name"])

#     mochi.service.call("notifications", "create", "chat", "new", chat, "New chat from " + f["name"] + ": " + name, "/chat/" + chat)
