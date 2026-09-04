// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import forumsApi from '@/api/forums'
import { ModerationTab } from './$forum_.settings'

vi.mock('@/api/forums', () => ({
  default: {
    getModerationSettings: vi.fn(),
    saveModerationSettings: vi.fn(),
  },
}))

const baseSettings = {
  moderation_posts: false,
  moderation_comments: false,
  moderation_new: false,
  new_user_days: 0,
  post_limit: 0,
  comment_limit: 0,
  limit_window: 3600,
}

beforeEach(() => {
  vi.mocked(forumsApi.getModerationSettings).mockResolvedValue({
    data: { forum: {}, settings: { ...baseSettings } },
  } as never)
})

function renderTab() {
  return render(
    <I18nProvider i18n={i18n}>
      <ModerationTab forumId='f1' />
    </I18nProvider>
  )
}

describe('ModerationTab optimistic settings', () => {
  it('reverts the toggle when the server rejects the change', async () => {
    vi.mocked(forumsApi.saveModerationSettings).mockRejectedValue(new Error('nope'))
    const user = userEvent.setup()
    renderTab()

    // The three switches (posts, comments, new users) carry no accessible name,
    // so address the first one — "Require approval for new posts" — by order.
    const [toggle] = await screen.findAllByRole('switch')
    expect(toggle).not.toBeChecked()

    await user.click(toggle)
    // Negative control: without the revert the optimistic value sticks, so the
    // switch would stay checked even though the save failed.
    await waitFor(() => expect(toggle).not.toBeChecked())
    expect(forumsApi.saveModerationSettings).toHaveBeenCalled()
  })

  it('clamps the rate-limit window to the 60s minimum before saving', async () => {
    vi.mocked(forumsApi.saveModerationSettings).mockResolvedValue({
      data: { forum: 'f1' },
    } as never)
    const user = userEvent.setup()
    renderTab()

    const windowInput = (await screen.findByDisplayValue('3600')) as HTMLInputElement
    await user.clear(windowInput)
    await user.type(windowInput, '30')
    // Blur to commit; updateSetting runs on blur.
    await user.tab()

    await waitFor(() =>
      expect(forumsApi.saveModerationSettings).toHaveBeenCalledWith(
        expect.objectContaining({ limit_window: 60 })
      )
    )
    expect(windowInput.value).toBe('60')
  })
})
