// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useMemo, useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { plural } from '@lingui/core/macro'
import { CommentBox } from '@mochi/web'
import { ThreadComment, type ThreadCommentType, type ThreadCommentProps } from './thread-comment'

/**
 * The lightbox's comments panel: the post's real comments (ThreadComment)
 * filtered to those anchored to the viewed image, the rest behind a toggle, new
 * comments anchored to it.
 */
export function AttachmentComments({
  comments,
  attachmentId,
  commentProps,
  canComment,
  onAddComment,
}: {
  comments: ThreadCommentType[]
  attachmentId: string
  /** Every per-comment prop the post page passes to ThreadComment. */
  commentProps: Omit<ThreadCommentProps, 'comment'>
  canComment: boolean
  onAddComment?: (body: string, files: File[] | undefined, attachment: string) => Promise<unknown>
}) {
  const { t } = useLingui()
  const [showAll, setShowAll] = useState(false)
  const [draft, setDraft] = useState('')

  // Anchors live on top-level comments; a reply inherits its parent's context.
  const anchored = useMemo(
    () => comments.filter((comment) => comment.attachment === attachmentId),
    [comments, attachmentId]
  )
  const others = comments.length - anchored.length
  const shown = showAll ? comments : anchored

  return (
    <div className='flex h-full flex-col'>
      <div className='min-h-0 flex-1 overflow-y-auto p-4'>
        {shown.length === 0 && (
          <p className='text-muted-foreground text-sm'>
            <Trans>No comments on this image yet.</Trans>
          </p>
        )}
        <div className='divide-y-0'>
          {shown.map((comment) => (
            <ThreadComment key={comment.id} comment={comment} {...commentProps} />
          ))}
        </div>
        {others > 0 && (
          <button
            type='button'
            className='text-muted-foreground hover:text-foreground mt-3 text-xs font-medium transition-colors'
            onClick={() => setShowAll((value) => !value)}
          >
            {showAll ? (
              <Trans>Show only comments on this image</Trans>
            ) : (
              plural(others, {
                one: 'Show # other comment on this post',
                other: 'Show # other comments on this post',
              })
            )}
          </button>
        )}
      </div>
      {canComment && onAddComment && (
        <CommentBox
          className='border-t p-3'
          value={draft}
          onValueChange={setDraft}
          // Rejects on failure so the box keeps the draft and files for Retry.
          onSubmit={async (body, files) => {
            await onAddComment(body, files, attachmentId)
            setDraft('')
          }}
          onSearchPeople={commentProps.onSearchPeople}
          progress={commentProps.replyProgress}
          placeholder={t`Comment on this image…`}
        />
      )}
    </div>
  )
}
