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
import { MembersSection } from './$forum_.settings'

vi.mock('@/api/forums', () => ({
  default: { listMembers: vi.fn(), removeMember: vi.fn() },
}))

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
    expect(
      screen.queryByRole('button', { name: /Remove Owner Person/ })
    ).not.toBeInTheDocument()
  })

  it('hides the remove control on every row when canRemove is false', async () => {
    renderSection(false)

    await screen.findByText('Member One')
    expect(
      screen.queryByRole('button', { name: /Remove/ })
    ).not.toBeInTheDocument()
  })

  it('removes a member after the confirm dialog is accepted', async () => {
    vi.mocked(forumsApi.removeMember).mockResolvedValue({
      data: { forum: {} },
    } as never)
    const user = userEvent.setup()
    renderSection(true)

    await user.click(await screen.findByRole('button', { name: /Remove Member One/ }))
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

    await user.click(await screen.findByRole('button', { name: /Remove Member One/ }))
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
