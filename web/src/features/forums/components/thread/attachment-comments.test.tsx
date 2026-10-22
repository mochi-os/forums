// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
// The image viewer's comments panel never cuts deep replies, even when the page
// wraps it in a thread that does: "Continue this thread" navigates, and the
// viewer keeps its open state to itself, so the thread would change behind it.
// Feeds keeps its panel out of the cut the same way.
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { CommentThreadProvider, useCommentThread } from '@mochi/web'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AttachmentComments } from './attachment-comments'
import type { ThreadCommentType } from './thread-comment'

// Each comment reports whether its thread would cut deep replies.
vi.mock('./thread-comment', () => ({
  ThreadComment: () => {
    const { onContinue } = useCommentThread()
    return <span>{onContinue ? 'cuts' : 'never cuts'}</span>
  },
}))

const comments = [
  { id: 'c1', attachment: 'img1', children: [] },
] as unknown as ThreadCommentType[]

describe('the image viewer panel', () => {
  it('never cuts, even inside a thread that does', () => {
    render(
      <I18nProvider i18n={i18n}>
        <CommentThreadProvider value={{ onContinue: () => {} }}>
          <AttachmentComments
            comments={comments}
            attachmentId='img1'
            commentProps={{ onVote: () => {} }}
            canComment={false}
          />
        </CommentThreadProvider>
      </I18nProvider>
    )
    expect(screen.getByText('never cuts')).toBeTruthy()
  })
})
