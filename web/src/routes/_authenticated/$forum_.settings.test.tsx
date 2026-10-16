// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import forumsApi from '@/api/forums'
import { CommunitySection, MembersSection } from './$forum_.settings'

vi.mock('@/api/forums', () => ({
  default: {
    listMembers: vi.fn(),
    removeMember: vi.fn(),
    setAccess: vi.fn(),
    getPublish: vi.fn(),
    setPublish: vi.fn(),
    clearPublish: vi.fn(),
  },
}))

vi.mock('@mochi/web', async (original) => ({
  ...(await original<typeof import('@mochi/web')>()),
  toast: { success: vi.fn(), error: vi.fn() },
}))

function renderCommunity(onChanged = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <CommunitySection forumId='f1' onChanged={onChanged} />
      </QueryClientProvider>
    </I18nProvider>
  )
  return onChanged
}

const unpublished = {
  data: {
    published: false,
    address: '',
    identifier: '',
    domains: ['example.com'],
    handles: [],
  },
}
const published = {
  data: {
    published: true,
    address: 'https://example.com/~g1',
    identifier: '@books@example.com',
    domains: ['example.com'],
    handles: [],
  },
}

describe('CommunitySection', () => {
  it('publishes the forum on the name given and then shows the community', async () => {
    vi.mocked(forumsApi.getPublish)
      .mockResolvedValueOnce(unpublished as never)
      .mockResolvedValue(published as never)
    vi.mocked(forumsApi.setPublish).mockResolvedValue(published as never)
    const user = userEvent.setup()
    const onChanged = renderCommunity()
    // One domain: no chooser, the name alone.
    const name = await screen.findByLabelText('Community name')
    expect(screen.queryByLabelText('Domain')).not.toBeInTheDocument()
    await user.type(name, 'Books')
    await user.click(screen.getByRole('button', { name: 'Publish' }))
    await waitFor(() =>
      expect(forumsApi.setPublish).toHaveBeenCalledWith('f1', 'books', 'example.com')
    )
    expect(await screen.findByText('@books@example.com')).toBeInTheDocument()
    expect(onChanged).toHaveBeenCalled()
  })

  it('withdraws a published community', async () => {
    vi.mocked(forumsApi.getPublish).mockResolvedValue(published as never)
    vi.mocked(forumsApi.clearPublish).mockResolvedValue(unpublished as never)
    const user = userEvent.setup()
    renderCommunity()
    await screen.findByText('@books@example.com')
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Withdraw' }))
    await waitFor(() => expect(forumsApi.clearPublish).toHaveBeenCalledWith('f1'))
  })

  it('offers the domain where the owner may take names on several', async () => {
    vi.mocked(forumsApi.getPublish).mockResolvedValue({
      data: { ...unpublished.data, domains: ['example.com', 'alice.example'] },
    } as never)
    renderCommunity()
    expect(await screen.findByLabelText('Domain')).toBeInTheDocument()
  })
})

const members = [
  { id: 'owner-1', name: 'Owner Person', subscribed: 0 },
  { id: 'member-1', name: 'Member One', subscribed: 0 },
]

function renderSection(canRemove: boolean) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MembersSection forumId='f1' ownerId='owner-1' canRemove={canRemove} />
      </QueryClientProvider>
    </I18nProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(forumsApi.listMembers).mockResolvedValue({
    data: { forum: {}, members },
  } as never)
})

describe('MembersSection', () => {
  it('renders the roster and never offers to remove the owner', async () => {
    renderSection(true)

    await screen.findByText('Member One')
    expect(screen.getByText('Owner Person')).toBeInTheDocument()
    expect(screen.getByText('Owner')).toBeInTheDocument()
    // Avatars come through the forum's own roster route, never cross-app.
    expect(
      document.querySelector('img[src*="/f1/-/members/member-1/asset/avatar"]')
    ).not.toBeNull()
    expect(
      screen.queryByRole('button', { name: /Remove Owner Person/ })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Block Owner Person/ })
    ).not.toBeInTheDocument()
  })

  it('hides the remove and block controls on every row when canRemove is false', async () => {
    renderSection(false)

    await screen.findByText('Member One')
    expect(
      screen.queryByRole('button', { name: /Remove/ })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Block/ })
    ).not.toBeInTheDocument()
  })

  it('blocks a member through the No access level after the confirm dialog is accepted', async () => {
    vi.mocked(forumsApi.setAccess).mockResolvedValue({
      data: { forum: 'f1', target: 'member-1', level: 'none' },
    } as never)
    const user = userEvent.setup()
    renderSection(true)

    await user.click(
      await screen.findByRole('button', { name: /Block Member One/ })
    )
    await user.click(await screen.findByRole('button', { name: 'Block' }))

    await waitFor(() =>
      expect(forumsApi.setAccess).toHaveBeenCalledWith({
        forum: 'f1',
        user: 'member-1',
        level: 'none',
      })
    )
    expect(forumsApi.removeMember).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
  })

  it('removes a member after the confirm dialog is accepted', async () => {
    vi.mocked(forumsApi.removeMember).mockResolvedValue({
      data: { forum: {} },
    } as never)
    const user = userEvent.setup()
    renderSection(true)

    await user.click(
      await screen.findByRole('button', { name: /Remove Member One/ })
    )
    await user.click(await screen.findByRole('button', { name: 'Remove' }))

    await waitFor(() =>
      expect(forumsApi.removeMember).toHaveBeenCalledWith('f1', 'member-1')
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
  })

  it('keeps the member listed when removal fails', async () => {
    vi.mocked(forumsApi.removeMember).mockRejectedValue(new Error('nope'))
    const user = userEvent.setup()
    renderSection(true)

    await user.click(
      await screen.findByRole('button', { name: /Remove Member One/ })
    )
    await user.click(await screen.findByRole('button', { name: 'Remove' }))

    await waitFor(() => expect(forumsApi.removeMember).toHaveBeenCalled())
    expect(screen.getByText('Member One')).toBeInTheDocument()
  })

  it('shows the inline error view when the roster fails to load', async () => {
    vi.mocked(forumsApi.listMembers).mockRejectedValue(new Error('offline'))
    renderSection(true)

    await screen.findByRole('status')
    expect(screen.queryByText('Member One')).not.toBeInTheDocument()
  })
})
