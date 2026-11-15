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

const { subscribe, auth } = vi.hoisted(() => ({
  subscribe: vi.fn(),
  auth: { isInitialized: true, isAuthenticated: true, token: 'token' },
}))

vi.mock('@mochi/web', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@mochi/web')>()),
  useAuthStore: (selector: (state: unknown) => unknown) => selector(auth),
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
  Object.assign(auth, { isAuthenticated: true, token: 'token' })
})

// Core refuses a socket with no signed-in user, and a refused one is retried
// for as long as the page is open: about 120 refusals an hour for each
// anonymous reader of a public forum.
describe('useForumWebsocket for a reader who is not signed in', () => {
  function anonymous() {
    Object.assign(auth, { isAuthenticated: false, token: '' })
    const client = new QueryClient()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    return renderHook(() => useForumWebsocket('fp1'), { wrapper })
  }

  it('opens no socket', () => {
    anonymous()
    expect(subscribe).not.toHaveBeenCalled()
  })

  it('opens it once the reader signs in', () => {
    const { rerender } = anonymous()
    Object.assign(auth, { isAuthenticated: true, token: 'token' })
    rerender()
    expect(subscribe).toHaveBeenCalledWith('fp1', expect.any(Function))
  })
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
