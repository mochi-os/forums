// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { arraysEqual, textUnchanged } from '@mochi/web'

export interface ForumPostEditOriginal {
  title: string
  body: string
  attachmentIds: string[]
  // Caption per attachment id; absent means uncaptioned.
  captions: Record<string, string>
}

interface ForumPostEditDraft {
  title: string
  body: string
  order?: string[]
  attachments?: File[]
  // Keyed by order entry (attachment id or "new:N"). Existing ids always
  // appear, so clearing a caption reaches the server as an empty string.
  captions?: Record<string, string>
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
  const existing = existingOrderIds(draft.order)
  if (!arraysEqual(existing, original.attachmentIds)) return false
  return existing.every(
    (id) => (draft.captions?.[id] ?? '') === (original.captions[id] ?? '')
  )
}

export function buildForumPostEditDraft(
  items: Array<
    { kind: 'existing'; attachment: { id: string } } | { kind: 'new'; file: File }
  >,
  values: { title: string; body: string },
  // Keyed by attachment id for existing items and by the caller's file key
  // for new ones; `fileKey` maps a new file to that key.
  itemCaptions: Record<string, string> = {},
  fileKey: (file: File) => string = () => ''
): ForumPostEditDraft {
  const order: string[] = []
  const attachments: File[] = []
  const captions: Record<string, string> = {}
  let newIndex = 0
  for (const item of items) {
    if (item.kind === 'existing') {
      order.push(item.attachment.id)
      captions[item.attachment.id] = itemCaptions[item.attachment.id] ?? ''
    } else {
      const placeholder = `new:${newIndex}`
      order.push(placeholder)
      const caption = itemCaptions[fileKey(item.file)]
      if (caption) captions[placeholder] = caption
      attachments.push(item.file)
      newIndex++
    }
  }
  return {
    title: values.title,
    body: values.body,
    order,
    attachments,
    captions,
  }
}

export function forumPostEditOriginalFromPost(post: {
  title: string
  body: string
  attachments?: Array<{ id: string; caption?: string }>
}): ForumPostEditOriginal {
  const captions: Record<string, string> = {}
  for (const att of post.attachments ?? []) {
    if (att.caption) captions[att.id] = att.caption
  }
  return {
    title: post.title,
    body: post.body,
    attachmentIds: (post.attachments ?? []).map((att) => att.id),
    captions,
  }
}
