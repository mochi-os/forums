// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { describe, expect, it } from 'vitest'
import {
  forumPostEditOriginalFromPost,
  isForumPostEditUnchanged,
} from './edit-compare'

const original = forumPostEditOriginalFromPost({
  title: 'A title',
  body: 'A body',
  sensitive: 1,
  language: 'fr',
})

describe('isForumPostEditUnchanged and the marks', () => {
  it('is unchanged when the marks are as they were', () => {
    expect(
      isForumPostEditUnchanged(original, {
        title: 'A title',
        body: 'A body',
        sensitive: true,
        language: 'fr',
      })
    ).toBe(true)
  })

  it('is changed by the sensitive mark alone', () => {
    expect(
      isForumPostEditUnchanged(original, {
        title: 'A title',
        body: 'A body',
        sensitive: false,
      })
    ).toBe(false)
  })

  it('is changed by the language alone', () => {
    expect(
      isForumPostEditUnchanged(original, {
        title: 'A title',
        body: 'A body',
        language: '',
      })
    ).toBe(false)
  })
})
