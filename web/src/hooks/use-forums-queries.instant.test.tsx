// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import forumsApi from '@/api/forums'
import { useFollowPost, useSetForumNotification } from './use-forums-queries'

vi.mock('@/api/forums', () => ({
  default: { setNotification: vi.fn(), followPost: vi.fn() },
}))
vi.mock('@mochi/web', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@mochi/web')>()),
  handleServerError: vi.fn(),
}))

// A notification tick and Follow change on the click, and go back if the
// server refuses. Each request here waits until the test answers it.
let refuse: (error: unknown) => void
beforeEach(() => {
  const waiting = () =>
    new Promise<never>((_resolve, reject) => {
      refuse = reject
    })
  vi.mocked(forumsApi.setNotification).mockImplementation(waiting)
  vi.mocked(forumsApi.followPost).mockImplementation(waiting)
})

function mount<T>(hook: () => T, seed: (client: QueryClient) => void) {
  const client = new QueryClient()
  seed(client)
  const view = renderHook(hook, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  })
  return { client, view }
}

describe('useSetForumNotification', () => {
  const key = ['forums', 'notifications', 'f1']

  it('ticks at once and unticks when refused', async () => {
    const { client, view } = mount(
      () => useSetForumNotification('f1'),
      (c) =>
        c.setQueryData(key, {
          data: { post: false, reply: false, comment: false },
        })
    )
    const post = () =>
      client.getQueryData<{ data: { post: boolean } }>(key)?.data.post

    act(() => view.result.current.mutate({ kind: 'post', enabled: true }))
    await waitFor(() => expect(post()).toBe(true))

    act(() => refuse(new Error('refused')))
    await waitFor(() => expect(view.result.current.isError).toBe(true))
    expect(post()).toBe(false)
  })
})

describe('useFollowPost', () => {
  // The post is cached under the server it came from, after the post id.
  const key = ['forums', 'post', 'f1', 'p1', undefined]

  it('follows at once and unfollows when refused', async () => {
    const { client, view } = mount(
      () => useFollowPost('f1', 'p1'),
      (c) => c.setQueryData(key, { data: { following: false } })
    )
    const following = () =>
      client.getQueryData<{ data: { following: boolean } }>(key)?.data.following

    act(() => view.result.current.mutate(true))
    await waitFor(() => expect(following()).toBe(true))

    act(() => refuse(new Error('refused')))
    await waitFor(() => expect(view.result.current.isError).toBe(true))
    expect(following()).toBe(false)
  })
})
