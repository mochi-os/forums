// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { AttachmentGallery } from '@mochi/web'
import type { Attachment } from '@/api/types/posts'
import { attachmentUrl } from '../attachment-url'

interface CommentAttachmentsProps {
  attachments?: Attachment[]
  forumId: string
  server?: string
}

export function CommentAttachments({ attachments, forumId, server }: CommentAttachmentsProps) {
  if (!attachments || attachments.length === 0) return null

  // The addresses carry the viewer's token, as the post gallery's do: inside
  // the sandboxed shell iframe an <img> sends no cookies, so a private
  // container's attachment would 401 and the thumbnail never appear.
  return (
    <AttachmentGallery
      attachments={attachments}
      getUrl={(att) => attachmentUrl(forumId, att.id, '', server)}
      getThumbnailUrl={(att) => attachmentUrl(forumId, att.id, 'thumbnail', server)}
      rowHeight={80}
    />
  )
}
