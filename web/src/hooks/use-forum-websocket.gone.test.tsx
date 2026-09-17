// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useForumWebsocket } from './use-forum-websocket'
import { forumsInfoQueryOptions } from './use-forums-queries'

const { subscribe } = vi.hoisted(() => ({ subscribe: vi.fn() }))

vi.mock('@mochi/web', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@mochi/web')>()),
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ isInitialized: true, token: 'token' }),
  entityWebsocketManager: { subscribe },
}))

type Handler = (event: Record<string, unknown>) => void

function mount(onGone: (reason: 'removed' | 'deleted') => void) {
  const client = new QueryClient()
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  renderHook(
    () => useForumWebsocket('fp1', 'me', undefined, undefined, onGone),
    { wrapper }
  )
  expect(subscribe).toHaveBeenCalledWith('fp1', expect.any(Function))
  return { handle: subscribe.mock.calls[0][1] as Handler, invalidate }
}

beforeEach(() => {
  vi.clearAllMocks()
  subscribe.mockReturnValue(() => {})
})

describe('useForumWebsocket gone events', () => {
  it('reports a removal and refreshes the forums list', () => {
    const onGone = vi.fn()
    const { handle, invalidate } = mount(onGone)

    handle({ type: 'forum/removed', forum: 'forum-1' })

    expect(onGone).toHaveBeenCalledWith('removed')
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: forumsInfoQueryOptions().queryKey,
    })
  })

  it('reports a deletion', () => {
    const onGone = vi.fn()
    const { handle } = mount(onGone)

    handle({ type: 'forum/deleted', forum: 'forum-1' })

    expect(onGone).toHaveBeenCalledWith('deleted')
  })

  it('leaves ordinary events alone', () => {
    const onGone = vi.fn()
    const { handle } = mount(onGone)

    handle({ type: 'post/edit', forum: 'forum-1', post: 'p1', sender: 'other' })

    expect(onGone).not.toHaveBeenCalled()
  })
})
