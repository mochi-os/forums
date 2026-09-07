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
import { ThreadContent } from './thread-content'

function makePost(): Post {
  return {
    id: 'p1',
    forum: 'f1',
    member: 'author-1',
    name: 'Author One',
    title: 'A title',
    body: 'Some body text',
    comments: 0,
    up: 0,
    down: 0,
    created: 1_700_000_000,
    updated: 1_700_000_000,
  }
}

function renderContent(props: Partial<Parameters<typeof ThreadContent>[0]>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider i18n={i18n}>
        <ThreadContent
          post={makePost()}
          onVote={vi.fn()}
          isLoggedIn={false}
          canModerate
          {...props}
        />
      </I18nProvider>
    </QueryClientProvider>
  )
}

describe('ThreadContent moderation confirmations', () => {
  it('confirms before muting the author instead of firing immediately', async () => {
    const user = userEvent.setup()
    const onMuteAuthor = vi.fn()
    renderContent({ onMuteAuthor })

    await user.click(screen.getByLabelText('More options'))
    await user.click(await screen.findByText('Mute author'))

    // Negative control: the pre-fix menu item called onMuteAuthor directly, so
    // it would already be invoked here with no confirmation.
    expect(onMuteAuthor).not.toHaveBeenCalled()

    await user.click(await screen.findByRole('button', { name: 'Mute' }))
    expect(onMuteAuthor).toHaveBeenCalledTimes(1)
  })

  it('confirms before banning the author instead of firing immediately', async () => {
    const user = userEvent.setup()
    const onBanAuthor = vi.fn()
    renderContent({ onBanAuthor })

    await user.click(screen.getByLabelText('More options'))
    await user.click(await screen.findByText('Ban author'))
    expect(onBanAuthor).not.toHaveBeenCalled()

    await user.click(await screen.findByRole('button', { name: 'Ban' }))
    expect(onBanAuthor).toHaveBeenCalledTimes(1)
  })
})
