// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { createSavedApi } from '@mochi/web'
import endpoints from '@/api/endpoints'
import type { Post, SavedItem, SavedPostSnapshot } from '@/api/types/posts'

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

export const savedApi = createSavedApi<Post, SavedItem>({
  appName: 'forums',
  endpoints: endpoints.saved,
  toSnapshot,
})
