// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import type { MutableRefObject, ReactNode } from 'react'
import { AttachmentGallery } from '@mochi/web'
import type { Attachment } from '@/api/types/posts'
import { attachmentUrl } from '../../attachment-url'

interface PostAttachmentsProps {
  attachments: Attachment[]
  forumId: string
  server?: string
  mediaCap?: number
  /** The lightbox comments slot: the count and the thread panel per attachment id. */
  commentCount?: (attachmentId: string) => number
  renderComments?: (attachmentId: string) => ReactNode
  /** Filled with a function that opens the lightbox on an attachment, comments showing. */
  openerRef?: MutableRefObject<((attachmentId: string) => void) | null>
}

export function PostAttachments({
  attachments,
  forumId,
  server,
  mediaCap = 8,
  commentCount,
  renderComments,
  openerRef,
}: PostAttachmentsProps) {
  return (
    <AttachmentGallery
      attachments={attachments}
      getUrl={(att) => attachmentUrl(forumId, att.id, '', server)}
      getThumbnailUrl={(att) => attachmentUrl(forumId, att.id, 'thumbnail', server)}
      getPreviewUrl={(att) => attachmentUrl(forumId, att.id, 'preview', server)}
      mediaCap={mediaCap}
      showCaptions
      commentCount={commentCount}
      renderComments={renderComments}
      openerRef={openerRef}
    />
  )
}
