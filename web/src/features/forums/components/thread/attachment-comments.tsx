// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useCallback, useMemo, useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { plural } from '@lingui/core/macro'
import { Button, Textarea, offlineBlocked, useFormat } from '@mochi/web'
import { Loader2, Send } from 'lucide-react'
import type { ThreadCommentType } from './thread-comment'

/**
 * The comment thread for one image, shown in the lightbox's comments panel.
 *
 * Comments are one thread per post; a comment may be ANCHORED to one of the
 * post's attachments. This panel filters that thread down to the comments
 * anchored to the image being viewed, offers the rest of the post's comments
 * behind a toggle, and composes new comments anchored to this image without
 * the writer having to say so.
 */
export function AttachmentComments({
  comments,
  attachmentId,
  canComment,
  onAddComment,
}: {
  comments: ThreadCommentType[]
  attachmentId: string
  canComment: boolean
  onAddComment?: (body: string, attachment: string) => Promise<unknown>
}) {
  const { t } = useLingui()
  const { formatTimestamp } = useFormat()
  const [showAll, setShowAll] = useState(false)
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Anchors live on top-level comments; a reply inherits its parent's context.
  const anchored = useMemo(
    () => comments.filter((comment) => comment.attachment === attachmentId),
    [comments, attachmentId]
  )
  const others = comments.length - anchored.length
  const shown = showAll ? comments : anchored

  const submit = useCallback(async () => {
    const body = draft.trim()
    if (!body || submitting || !onAddComment || offlineBlocked()) return
    setSubmitting(true)
    try {
      await onAddComment(body, attachmentId)
      setDraft('')
    } catch {
      // The mutation reported the failure; keep the draft for another go.
    } finally {
      setSubmitting(false)
    }
  }, [draft, submitting, onAddComment, attachmentId])

  return (
    <div className='flex h-full flex-col'>
      <div className='min-h-0 flex-1 space-y-3 overflow-y-auto p-4'>
        {shown.length === 0 && (
          <p className='text-muted-foreground text-sm'>
            <Trans>No comments on this image yet.</Trans>
          </p>
        )}
        {shown.map((comment) => (
          <div key={comment.id} className='text-sm'>
            <div className='text-muted-foreground flex items-center gap-2 text-xs'>
              <span className='text-foreground font-medium'>{comment.name}</span>
              <span>{formatTimestamp(comment.created)}</span>
              {comment.attachment !== attachmentId && comment.attachment_name && (
                <span className='truncate' title={comment.attachment_name}>
                  · {comment.attachment_name}
                </span>
              )}
            </div>
            <p className='mt-0.5 whitespace-pre-wrap break-words'>{comment.body}</p>
          </div>
        ))}
        {others > 0 && (
          <button
            type='button'
            className='text-muted-foreground hover:text-foreground text-xs font-medium transition-colors'
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
        <div className='border-t p-3'>
          <Textarea
            placeholder={t`Comment on this image…`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                void submit()
              }
            }}
            rows={2}
            className='min-h-16'
            disabled={submitting}
          />
          <div className='mt-2 flex justify-end'>
            <Button size='sm' onClick={() => void submit()} disabled={!draft.trim() || submitting}>
              {submitting ? <Loader2 className='size-4 animate-spin' /> : <Send className='size-4' />}
              <Trans>Comment</Trans>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
