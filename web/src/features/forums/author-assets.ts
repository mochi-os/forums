// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import {
  addressByAuthor,
  getAppPath,
  paramShapes,
  path,
  tryPath,
} from '@mochi/web'
import { forumPath } from '@/lib/forum-path'

interface PostRow {
  id: string
  forum: string
  fingerprint?: string
  member: string
  status?: string
}

interface CommentRow {
  id: string
  forum: string
  post: string
  member: string
  status?: string
  children?: CommentRow[]
}

// A remote forum's rows come from its server, and the style behind each
// avatar is fetched with the reader's token, so an address is built only from
// what names a forum, a row and a person - a forum's fingerprint or entity id,
// a row's id and a Mochi identity - each as one encoded segment. Any other
// row gives no address, and its author shows their initials.
const forumShape = [paramShapes.fingerprint, paramShapes.entity]

function fits(value: unknown, shapes: RegExp | RegExp[]): value is string {
  return (
    typeof value === 'string' &&
    [shapes].flat().some((shape) => shape.test(value))
  )
}

// The segment that names a forum, if what the row gives names one.
function forumSegment(id: unknown): string | undefined {
  if (typeof id !== 'string') return undefined
  const segment = forumPath(id)
  return fits(segment, forumShape) ? segment : undefined
}

// Where an author's person assets (avatar, style) are served: under one of
// their posts or comments, whose route resolves the author. Append the slot.
export const postAssets = (post: PostRow): string | undefined => {
  const forum = forumSegment(post.fingerprint ?? post.forum)
  if (!forum || !fits(post.id, paramShapes.id)) return undefined
  return tryPath(() => `${getAppPath()}/${path`${forum}/-/${post.id}/asset`}`)
}

export const commentAssets = (comment: CommentRow): string | undefined => {
  const forum = forumSegment(comment.forum)
  if (!forum || !fits(comment.post, paramShapes.id)) return undefined
  if (!fits(comment.id, paramShapes.id)) return undefined
  return tryPath(
    () =>
      `${getAppPath()}/${path`${forum}/-/${comment.post}/${comment.id}/asset`}`
  )
}

// Where a person's avatar and style are served through the forum's moderation
// proxy. The route serves a Mochi identity and a person on another network
// alike, by any identifier that stands as one path segment (a Bluesky DID, a
// Matrix or XMPP address); a fediverse actor is named by a web address, which
// cannot, so they show their initials.
export const moderationAssets = (
  forumId: string,
  person: string
): { avatar: string; style: string } | null => {
  const forum = forumSegment(forumId)
  if (!forum || !person || /^https?:\/\//i.test(person)) return null
  const base = tryPath(
    () => `${getAppPath()}/${path`${forum}/-/moderation/${person}/asset`}`
  )
  return base ? { avatar: `${base}/avatar`, style: `${base}/style` } : null
}

// Only an approved row stands in for its author: the route answers for a
// pending or removed one only to its author and the forum's managers.
const approved = (status?: string) => !status || status === 'approved'

// One asset address per author across a list of posts and their comments, so
// the browser and the style query fetch each author's avatar once rather than
// once per row.
export function authorAssets(
  posts: readonly PostRow[],
  comments: readonly CommentRow[] = []
): Map<string, string> {
  const found = addressByAuthor(posts, {
    getAuthor: (post) => post.member,
    getAddress: (post) =>
      approved(post.status) ? postAssets(post) : undefined,
  })
  return addressByAuthor(
    comments,
    {
      getAuthor: (comment) => comment.member,
      getAddress: (comment) =>
        approved(comment.status) ? commentAssets(comment) : undefined,
      getChildren: (comment) => comment.children,
    },
    found
  )
}
