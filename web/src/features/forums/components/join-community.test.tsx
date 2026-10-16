// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import forumsApi from '@/api/forums'
import { JoinCommunity } from './join-community'

const navigate = vi.fn()

vi.mock('@/api/forums', () => ({
  default: {
    listAccounts: vi.fn(),
    joinCommunity: vi.fn(),
  },
}))

vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<typeof import('@tanstack/react-router')>()),
  useNavigate: () => navigate,
}))

vi.mock('@mochi/web', async (original) => ({
  ...(await original<typeof import('@mochi/web')>()),
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

function renderJoin() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  renderWith(client)
  return client
}

function renderWith(client: QueryClient) {
  render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <JoinCommunity />
      </QueryClientProvider>
    </I18nProvider>
  )
}

describe('JoinCommunity', () => {
  beforeEach(() => vi.clearAllMocks())

  it('joins by !name@host as the hosted account and opens the forum', async () => {
    const user = userEvent.setup()
    vi.mocked(forumsApi.listAccounts).mockResolvedValue([
      { id: 'l1', type: 'lemmy', identifier: 'me@lemmy.example' },
      { id: 'h1', type: 'fediverse', identifier: '@me@example.com', hosted: true },
    ])
    vi.mocked(forumsApi.joinCommunity).mockResolvedValue({
      data: {
        id: 'https://lemmy.example/c/books',
        fingerprint: 'abcdefghi',
        name: 'Books',
        already_subscribed: false,
      },
    })
    renderJoin()

    const input = await screen.findByLabelText('Community address')
    await user.type(input, '!books@lemmy.example')
    await user.click(screen.getByRole('button', { name: 'Join' }))

    expect(forumsApi.joinCommunity).toHaveBeenCalledWith(
      '!books@lemmy.example',
      'h1'
    )
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: '/$forum',
        params: { forum: 'abcdefghi' },
      })
    )
  })

  it('offers nothing to a user with no hosted fediverse account', async () => {
    vi.mocked(forumsApi.listAccounts).mockResolvedValue([
      { id: 'l1', type: 'lemmy', identifier: 'me@lemmy.example' },
    ])
    const client = renderJoin()
    // The accounts have arrived and been read before absence is judged.
    await waitFor(() =>
      expect(
        client.getQueryState(['forums', 'accounts', 'network'])?.status
      ).toBe('success')
    )
    expect(screen.queryByLabelText('Community address')).toBeNull()
  })
})
