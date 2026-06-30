// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { arraysEqual, textUnchanged } from '@mochi/web'

export interface ForumPostEditOriginal {
  title: string
  body: string
  attachmentIds: string[]
}

export interface ForumPostEditDraft {
  title: string
  body: string
  order?: string[]
  attachments?: File[]
}

function existingOrderIds(order: string[] | undefined): string[] {
  return (order ?? []).filter((item) => !item.startsWith('new:'))
}

export function isForumPostEditUnchanged(
  original: ForumPostEditOriginal,
  draft: ForumPostEditDraft
): boolean {
  if (!textUnchanged(draft.title, original.title)) return false
  if (!textUnchanged(draft.body, original.body)) return false
  if ((draft.attachments?.length ?? 0) > 0) return false
  return arraysEqual(existingOrderIds(draft.order), original.attachmentIds)
}

export function buildForumPostEditDraft(items: Array<
  { kind: 'existing'; attachment: { id: string } } | { kind: 'new'; file: File }
>, values: { title: string; body: string }): ForumPostEditDraft {
  const order: string[] = []
  const attachments: File[] = []
  let newIndex = 0
  for (const item of items) {
    if (item.kind === 'existing') {
      order.push(item.attachment.id)
    } else {
      order.push(`new:${newIndex}`)
      attachments.push(item.file)
      newIndex++
    }
  }
  return {
    title: values.title,
    body: values.body,
    order,
    attachments,
  }
}

export function forumPostEditOriginalFromPost(post: {
  title: string
  body: string
  attachments?: Array<{ id: string }>
}): ForumPostEditOriginal {
  return {
    title: post.title,
    body: post.body,
    attachmentIds: (post.attachments ?? []).map((att) => att.id),
  }
}
