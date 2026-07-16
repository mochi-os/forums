// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { createAppClient } from '@mochi/web'
import endpoints from '@/api/endpoints'
import type { Post, SavedItem, SavedPostSnapshot } from '@/api/types/posts'

const client = createAppClient({ appName: 'forums' })

type Wrapped<T> = T | { data: T }

const unwrap = <T>(payload: Wrapped<T>): T =>
  payload && typeof payload === 'object' && 'data' in payload
    ? (payload as { data: T }).data
    : (payload as T)

// Build the slim snapshot we persist for a post. Deliberately omits comments
// and other heavy/thread data — the saved card is read-only and links back to
// the live thread for everything else.
export function toSnapshot(post: Post): SavedPostSnapshot {
  return {
    id: post.id,
    forum: post.forum,
    fingerprint: post.fingerprint,
    forumName: post.forumName,
    member: post.member,
    name: post.name,
    title: post.title,
    body: post.body,
    body_markdown: post.body_markdown,
    created: post.created,
    up: post.up,
    down: post.down,
    tags: post.tags,
    attachments: post.attachments,
  }
}

export const savedApi = {
  list: async (): Promise<{ saved: SavedItem[]; total: number }> => {
    const response = await client.post<
      Wrapped<{ saved: SavedItem[]; total: number }>,
      Record<string, never>
    >(endpoints.saved.list, {})
    const data = unwrap(response)
    return { saved: data?.saved ?? [], total: data?.total ?? 0 }
  },

  add: async (post: Post): Promise<{ saved: boolean }> => {
    const response = await client.post<
      Wrapped<{ saved: boolean }>,
      { post: string; data: string }
    >(endpoints.saved.add, {
      post: post.id,
      data: JSON.stringify(toSnapshot(post)),
    })
    return unwrap(response)
  },

  remove: async (id: string): Promise<{ saved: boolean }> => {
    const response = await client.post<
      Wrapped<{ saved: boolean }>,
      { post: string }
    >(endpoints.saved.remove, { post: id })
    return unwrap(response)
  },

  clear: async (): Promise<{ saved: boolean }> => {
    const response = await client.post<
      Wrapped<{ saved: boolean }>,
      Record<string, never>
    >(endpoints.saved.clear, {})
    return unwrap(response)
  },
}
