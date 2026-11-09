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
import { CommunityResult, looksLikeCommunity } from './join-community'

const navigate = vi.fn()

vi.mock('@/api/forums', () => ({
  default: {
    listAccounts: vi.fn(),
    lookupCommunity: vi.fn(),
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

const technology = {
  id: 'https://lemmy.world/c/technology',
  name: 'Technology',
  handle: 'technology@lemmy.world',
  avatar: '',
}

function show(query: string, found?: (yes: boolean) => void) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <CommunityResult query={query} found={found} />
      </QueryClientProvider>
    </I18nProvider>
  )
  return client
}

describe('looksLikeCommunity', () => {
  it('takes what may name a community elsewhere, and nothing else', () => {
    for (const query of ['!technology@lemmy.world', '@books@lemmy.example', 'books@lemmy.example', 'https://lemmy.world/c/technology']) {
      expect(looksLikeCommunity(query), query).toBe(true)
    }
    for (const query of ['technology', 'my forum', 'mochi://forum/x', 'https://example.com/forums/abcdefghi', '']) {
      expect(looksLikeCommunity(query), query).toBe(false)
    }
  })
})

describe('CommunityResult', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the community a search names and joins it as the one hosted account', async () => {
    const user = userEvent.setup()
    vi.mocked(forumsApi.listAccounts).mockResolvedValue([
      { id: 'l1', type: 'lemmy', identifier: 'me@lemmy.example' },
      { id: 'h1', type: 'fediverse', identifier: '@me@example.com', hosted: true },
    ])
    vi.mocked(forumsApi.lookupCommunity).mockResolvedValue({ data: technology })
    vi.mocked(forumsApi.joinCommunity).mockResolvedValue({
      data: { id: technology.id, fingerprint: 'technolog', name: 'Technology', already_subscribed: false },
    })
    const found = vi.fn()
    show('!technology@lemmy.world', found)

    // THE POINT: a result like the forums found here, not a form to fill.
    expect(await screen.findByText('Technology')).toBeTruthy()
    // and the page is told, so it does not also say no forums were found.
    await waitFor(() => expect(found).toHaveBeenLastCalledWith(true))
    expect(screen.getByText('!technology@lemmy.world')).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(forumsApi.lookupCommunity).toHaveBeenCalledWith('!technology@lemmy.world')
    await user.click(screen.getByRole('button', { name: 'Join' }))

    expect(forumsApi.joinCommunity).toHaveBeenCalledWith(technology.id, 'h1')
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: '/$forum',
        params: { forum: 'technolog' },
      })
    )
  })

  it('asks which account joins where there is more than one, naming each in full', async () => {
    const user = userEvent.setup()
    vi.mocked(forumsApi.listAccounts).mockResolvedValue([
      { id: 'h2', type: 'fediverse', identifier: '@acunningham@wasabi.mochi-os.org', hosted: true },
      { id: 'h1', type: 'fediverse', identifier: '@a@wasabi.mochi-os.org', hosted: true },
    ])
    vi.mocked(forumsApi.lookupCommunity).mockResolvedValue({ data: technology })
    vi.mocked(forumsApi.joinCommunity).mockResolvedValue({
      data: { id: technology.id, fingerprint: 'technolog', name: 'Technology', already_subscribed: false },
    })
    show('!technology@lemmy.world')

    await user.click(await screen.findByRole('button', { name: 'Join' }))
    expect(forumsApi.joinCommunity).not.toHaveBeenCalled()
    const items = await screen.findAllByRole('menuitem')
    expect(items.map((item) => item.textContent)).toEqual([
      '@a@wasabi.mochi-os.org',
      '@acunningham@wasabi.mochi-os.org',
    ])
    await user.click(items[1])
    await waitFor(() =>
      expect(forumsApi.joinCommunity).toHaveBeenCalledWith(technology.id, 'h2')
    )
  })

  it('offers nothing to a user with no hosted fediverse account', async () => {
    vi.mocked(forumsApi.listAccounts).mockResolvedValue([
      { id: 'l1', type: 'lemmy', identifier: 'me@lemmy.example' },
    ])
    const found = vi.fn()
    const client = show('!technology@lemmy.world', found)
    // The accounts have arrived and been read before absence is judged.
    await waitFor(() =>
      expect(
        client.getQueryState(['forums', 'accounts', 'network'])?.status
      ).toBe('success')
    )
    expect(forumsApi.lookupCommunity).not.toHaveBeenCalled()
    expect(screen.queryByTestId('community-result')).toBeNull()
    expect(found).not.toHaveBeenCalledWith(true)
  })

  it('looks nothing up for a search that names no community', () => {
    show('technology')
    expect(forumsApi.listAccounts).not.toHaveBeenCalled()
    expect(forumsApi.lookupCommunity).not.toHaveBeenCalled()
  })
})
