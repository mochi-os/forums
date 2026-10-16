// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { CreatePostDialog } from './create-post-dialog'

// Radix's select reads pointer capture and scrolls its item into view, which
// jsdom has not got.
beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.releasePointerCapture ??= () => {}
  Element.prototype.scrollIntoView ??= () => {}
})

function renderDialog(onCreate = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider i18n={i18n}>
        <CreatePostDialog
          forumId='f1'
          forumName='Forum'
          onCreate={onCreate}
          open
          onOpenChange={vi.fn()}
          hideTrigger
        />
      </I18nProvider>
    </QueryClientProvider>
  )
  return onCreate
}

describe('CreatePostDialog marks', () => {
  it('sends the sensitive mark and the language chosen', async () => {
    const user = userEvent.setup()
    const onCreate = renderDialog()
    await user.type(screen.getByLabelText('Title'), 'A title')
    await user.type(screen.getByLabelText('Content'), 'A body')
    await user.click(screen.getByRole('switch', { name: 'Sensitive' }))
    await user.click(screen.getByRole('combobox', { name: 'Language' }))
    await user.click(await screen.findByRole('option', { name: 'Français' }))
    await user.click(screen.getByRole('button', { name: 'Publish post' }))

    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(onCreate.mock.calls[0][0]).toMatchObject({
      forum: 'f1',
      title: 'A title',
      body: 'A body',
      sensitive: true,
      language: 'fr',
    })
  })

  it('sends neither mark by default', async () => {
    const user = userEvent.setup()
    const onCreate = renderDialog()
    await user.type(screen.getByLabelText('Title'), 'A title')
    await user.type(screen.getByLabelText('Content'), 'A body')
    await user.click(screen.getByRole('button', { name: 'Publish post' }))

    expect(onCreate.mock.calls[0][0].sensitive).toBeUndefined()
    expect(onCreate.mock.calls[0][0].language).toBeUndefined()
  })
})
