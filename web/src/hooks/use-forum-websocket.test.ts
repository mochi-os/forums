// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { describe, expect, it } from 'vitest'
import { rejectMessage } from './use-forum-websocket'

describe('rejectMessage', () => {
  it('uses comment wording for a rejected comment', () => {
    // Negative control: the old single-argument version reused the post copy,
    // so a rejected comment read "Post couldn't be saved — title or body is
    // invalid".
    const message = rejectMessage('invalid', 'comment')
    expect(message).toBe("Comment couldn't be saved — it is invalid")
    expect(message.toLowerCase()).not.toContain('post')
    expect(message.toLowerCase()).not.toContain('title')
  })

  it('keeps post wording for a rejected post', () => {
    const message = rejectMessage('invalid', 'post')
    expect(message).toBe("Post couldn't be saved — title or body is invalid")
  })

  it('reflects the kind for rate-limited rejections', () => {
    expect(rejectMessage('rate_limited', 'comment')).toContain('commenting')
    expect(rejectMessage('rate_limited', 'post')).toContain('posting')
  })

  it('falls back to a kind-appropriate server-error message', () => {
    expect(rejectMessage(undefined, 'comment')).toBe(
      "Comment couldn't be saved on the forum server"
    )
    expect(rejectMessage('server_error', 'post')).toBe(
      "Post couldn't be saved on the forum server"
    )
  })
})
