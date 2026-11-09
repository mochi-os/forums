// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { addressByAuthor, getAppPath } from '@mochi/web'
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

// Where an author's person assets (avatar, style) are served: under one of
// their posts or comments, whose route resolves the author. Append the slot.
export const postAssets = (post: PostRow) =>
  `${getAppPath()}/${forumPath(post.fingerprint ?? post.forum)}/-/${post.id}/asset`

export const commentAssets = (comment: CommentRow) =>
  `${getAppPath()}/${forumPath(comment.forum)}/-/${comment.post}/${comment.id}/asset`

// Where a person's avatar and style are served through the forum's moderation
// proxy: a Mochi identity only. A person from another network is named by
// their address, which no route takes, so they show their initials.
export const moderationAssets = (
  forumId: string,
  person: string
): { avatar: string; style: string } | null => {
  if (/^https?:\/\//.test(person)) return null
  const base = `${getAppPath()}/${forumPath(forumId)}/-/moderation/${person}/asset`
  return { avatar: `${base}/avatar`, style: `${base}/style` }
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
