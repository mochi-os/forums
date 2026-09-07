// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Post } from '@/api/types/posts'
import { EditPostDialog } from './edit-post-dialog'

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'p1',
    forum: 'f1',
    member: 'author-1',
    name: 'Author One',
    title: 'Original title',
    body: 'Original body',
    comments: 0,
    up: 0,
    down: 0,
    created: 1_700_000_000,
    updated: 1_700_000_000,
    ...overrides,
  }
}

// Create the client once per test (outside any component render) so it stays
// stable across rerenders, and drive rerender through the same tree.
function renderHarness(post: Post) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const tree = (p: Post) => (
    <QueryClientProvider client={client}>
      <I18nProvider i18n={i18n}>
        <EditPostDialog post={p} open onOpenChange={vi.fn()} onSave={vi.fn()} />
      </I18nProvider>
    </QueryClientProvider>
  )
  const utils = render(tree(post))
  return { ...utils, rerenderPost: (p: Post) => utils.rerender(tree(p)) }
}

describe('EditPostDialog draft persistence', () => {
  it('keeps the in-progress edit when the thread refetches the same post', async () => {
    const user = userEvent.setup()
    const { rerenderPost } = renderHarness(makePost())

    const title = screen.getByDisplayValue('Original title') as HTMLInputElement
    await user.clear(title)
    await user.type(title, 'My unsaved edit')
    expect(title.value).toBe('My unsaved edit')

    // A refetch hands back a fresh Post object with the SAME id (and even the
    // same server-side title). Negative control: keyed on object identity, the
    // reset effect fires and the field snaps back to "Original title".
    rerenderPost(makePost())

    expect((screen.getByDisplayValue('My unsaved edit') as HTMLInputElement).value).toBe(
      'My unsaved edit'
    )
    expect(screen.queryByDisplayValue('Original title')).toBeNull()
  })

  it('re-initialises when switched to a different post', async () => {
    const { rerenderPost } = renderHarness(makePost())
    expect(screen.getByDisplayValue('Original title')).toBeInTheDocument()

    rerenderPost(makePost({ id: 'p2', title: 'Second post' }))
    expect(screen.getByDisplayValue('Second post')).toBeInTheDocument()
  })
})
