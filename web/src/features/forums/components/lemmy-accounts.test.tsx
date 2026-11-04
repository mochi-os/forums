// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LemmyAccounts } from './lemmy-accounts'

const api = vi.hoisted(() => ({
  listAccounts: vi.fn(),
  addCommunities: vi.fn(),
  importCommunities: vi.fn(),
}))

vi.mock('@/api/forums', () => ({ default: api }))

function renderAccounts() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider i18n={i18n}>
        <LemmyAccounts />
      </I18nProvider>
    </QueryClientProvider>
  )
}

// Only the button clicked spins; the account's other one waits, as both write
// its communities.
describe('LemmyAccounts', () => {
  beforeEach(() => {
    i18n.load('en', {})
    i18n.activate('en')
    api.listAccounts.mockResolvedValue([
      { id: 'l1', type: 'lemmy', identifier: 'me@lemmy.example' },
    ])
  })

  it.each([
    ['Add communities', 'Import settings'],
    ['Import settings', 'Add communities'],
  ])(
    'spins %s alone while it runs, with %s waiting',
    async (clicked, other) => {
      let finish: (value: unknown) => void = () => {}
      const running = new Promise((resolve) => (finish = resolve))
      api.addCommunities.mockReturnValue(running)
      api.importCommunities.mockReturnValue(running)
      const user = userEvent.setup()
      renderAccounts()

      await user.click(await screen.findByRole('button', { name: clicked }))
      const pressed = screen.getByRole('button', { name: clicked })
      const waiting = screen.getByRole('button', { name: other })
      expect(pressed).toHaveAttribute('aria-busy', 'true')
      expect(waiting).not.toHaveAttribute('aria-busy')
      expect(waiting).toBeDisabled()

      await act(async () => {
        finish({ added: 0, communities: 0, blocks: 0, saved: 0, more: false })
        await running
      })
      expect(screen.getByRole('button', { name: other })).toBeEnabled()
    }
  )
})
